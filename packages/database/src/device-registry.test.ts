import { afterEach, beforeEach, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { DeviceMetadata, TransportObservation } from '@autoreels/contracts';
import { StudioDatabase } from './index.js';
let dir: string, db: StudioDatabase;
const metadata: DeviceMetadata = {
  hardwareSerial: 'SERIAL_1',
  manufacturer: 'Vendor',
  model: 'Phone',
  product: 'model1',
  androidVersion: '14',
  sdk: 34,
  locale: 'vi-VN',
};
const observation = (
  serial = 'usb_1',
  kind: TransportObservation['kind'] = 'USB',
): TransportObservation => ({ serial, kind, state: 'CONNECTED', metadata });
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'autoreels-device-db-'));
  db = new StudioDatabase(join(dir, 'studio.sqlite'));
});
afterEach(() => {
  db.close();
  rmSync(dir, { recursive: true, force: true });
});
it('reconciles USB/LAN by stable properties, preserving the device ID, names/enabled and old host history', () => {
  db.reconcileDeviceTransports('host_1', [observation(), observation('192.168.1.2:5555', 'TCP')]);
  let records = db.listDeviceRecords('host_1');
  expect(records).toHaveLength(1);
  expect(records[0]!.transports).toHaveLength(2);
  const id = records[0]!.id;
  db.updateDevice(id, records[0]!.revision, { name: 'My phone', enabled: false });
  db.invalidateDeviceTransports('host_1');
  db.close();
  db = new StudioDatabase(join(dir, 'studio.sqlite'));
  db.reconcileDeviceTransports('host_2', [observation('192.168.1.5:5555', 'TCP')]);
  records = db.listDeviceRecords('host_2');
  expect(records[0]).toMatchObject({ id, name: 'My phone', enabled: false });
  expect(records[0]!.capabilities.connected).toBe(true);
  expect(db.listDeviceRecords('host_1')[0]!.capabilities.connected).toBe(false);
});
it('keeps unauthorized transports provisional and promotes the same record only after fresh metadata arrives', () => {
  db.reconcileDeviceTransports('host', [
    { serial: 'usb_1', kind: 'USB', state: 'UNAUTHORIZED', metadata: null },
  ]);
  const before = db.listDeviceRecords('host')[0]!;
  expect(before.identity).toBe('PROVISIONAL');
  expect(before.capabilities.manualControl).toBe(false);
  db.reconcileDeviceTransports('host', [observation()]);
  const after = db.listDeviceRecords('host')[0]!;
  expect(after.id).toBe(before.id);
  expect(after.identity).toBe('VERIFIED_PROPERTIES');
  expect(after.capabilities.manualControl).toBe(true);
});
it('does not use historical metadata to authorize a transport whose fresh property probe failed', () => {
  db.reconcileDeviceTransports('host', [observation()]);
  const before = db.listDeviceRecords('host')[0]!;
  db.reconcileDeviceTransports('host', [{ ...observation(), metadata: null }]);
  const after = db.listDeviceRecords('host')[0]!;
  expect(after.id).toBe(before.id);
  expect(after.metadata).toEqual(before.metadata);
  expect(after.capabilities.connected).toBe(true);
  expect(after.capabilities.manualControl).toBe(false);
  expect(() =>
    db.assertDeviceTransport('host', before.id, 'usb_1', before.transports[0]!.generation),
  ).toThrow();
});
it('fences disconnect/reconnect generations and leaves stale host observations disconnected after startup reset', () => {
  db.reconcileDeviceTransports('host', [observation()]);
  const record = db.listDeviceRecords('host')[0]!,
    generation = record.transports[0]!.generation;
  db.reconcileDeviceTransports('host', []);
  expect(() => db.assertDeviceTransport('host', record.id, 'usb_1', generation)).toThrow();
  db.reconcileDeviceTransports('host', [observation()]);
  expect(db.listDeviceRecords('host')[0]!.transports[0]!.generation).toBeGreaterThan(generation);
  db.invalidateDeviceTransports('host');
  expect(db.listDeviceRecords('host')[0]!.capabilities.connected).toBe(false);
});
it('latches conflicting USB identity and keeps unrelated devices operational', () => {
  db.reconcileDeviceTransports('host', [
    observation('usb_1'),
    observation('usb_2'),
    { ...observation('usb_3'), metadata: { ...metadata, hardwareSerial: 'OTHER' } },
  ]);
  let records = db.listDeviceRecords('host');
  const conflicted = records.find((d) => d.identity === 'CONFLICT')!;
  expect(conflicted.capabilities.manualControl).toBe(false);
  expect(records.find((d) => d.id !== conflicted.id)!.capabilities.manualControl).toBe(true);
  db.reconcileDeviceTransports('host', [observation('usb_1')]);
  records = db.listDeviceRecords('host');
  expect(records.find((d) => d.id === conflicted.id)!.identity).toBe('CONFLICT');
});
it('rejects stale enabled/name revisions and duplicates atomically without losing registry history', () => {
  db.reconcileDeviceTransports('host', [observation()]);
  const record = db.listDeviceRecords('host')[0]!;
  db.updateDevice(record.id, record.revision, { enabled: false });
  expect(() => db.updateDevice(record.id, record.revision, { name: 'stale' })).toThrow('đã đổi');
  expect(() => db.reconcileDeviceTransports('host', [observation(), observation()])).toThrow(
    'trùng',
  );
  expect(db.listDeviceRecords('host')).toHaveLength(1);
});
it('persists host-scoped endpoint policies, resolved aliases and bounded backoff across restart', () => {
  db.setDeviceEndpoint('host', 'phone.local:5555', true);
  db.recordEndpointAttempt(
    'host',
    'phone.local:5555',
    '192.168.1.2:5555',
    'ADB_UNAUTHORIZED',
    10000,
  );
  let p = db.deviceEndpoints('host')[0]!;
  expect(p).toMatchObject({
    desired: true,
    failures: 1,
    nextAttemptUtc: new Date(12000).toISOString(),
    resolvedSerial: '192.168.1.2:5555',
  });
  expect(db.deviceEndpoints('other')).toEqual([]);
  for (let i = 0; i < 20; i++)
    db.recordEndpointAttempt('host', p.endpoint, null, 'ADB_CONNECT_FAILED', 20000);
  expect(db.deviceEndpoints('host')[0]!.nextAttemptUtc).toBe(new Date(320000).toISOString());
  db.close();
  db = new StudioDatabase(join(dir, 'studio.sqlite'));
  p = db.deviceEndpoints('host')[0]!;
  db.setDeviceEndpoint('host', p.endpoint, false, p.revision);
  expect(() => db.setDeviceEndpoint('host', p.endpoint, true, p.revision)).toThrow('đã đổi');
  db.recordEndpointAttempt('host', p.endpoint, null, null, 30000);
  expect(db.deviceEndpoints('host')[0]).toMatchObject({
    desired: false,
    failures: 0,
    lastErrorCode: null,
    nextAttemptUtc: null,
    resolvedSerial: '192.168.1.2:5555',
  });
});
