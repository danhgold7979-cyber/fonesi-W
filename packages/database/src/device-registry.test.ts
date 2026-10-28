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


it('fences a reused verified host transport without stealing the old device, name, enabled state or history', () => {
  db.reconcileDeviceTransports('host', [observation('usb_1')]);
  const existing = db.listDeviceRecords('host')[0]!;
  db.updateDevice(existing.id, existing.revision, { name: 'Original handset', enabled: false });
  const previous = db.listDeviceRecords('host')[0]!;
  const counterfeit = {
    ...observation('usb_1'),
    metadata: { ...metadata, hardwareSerial: 'DIFFERENT_HANDSET' },
  };
  db.reconcileDeviceTransports('host', [counterfeit]);
  let records = db.listDeviceRecords('host');
  expect(records).toHaveLength(1);
  expect(records[0]).toMatchObject({
    id: existing.id,
    name: 'Original handset',
    enabled: false,
    identity: 'CONFLICT',
    metadata: { hardwareSerial: metadata.hardwareSerial },
  });
  expect(records[0]!.transports[0]).toMatchObject({
    serial: 'usb_1',
    state: 'CONNECTED',
    identityVerified: false,
  });
  const fencedGeneration = records[0]!.transports[0]!.generation;
  expect(fencedGeneration).toBeGreaterThan(previous.transports[0]!.generation);
  expect(records[0]!.capabilities.manualControl).toBe(false);
  expect(() => db.assertDeviceTransport('host', existing.id, 'usb_1', previous.transports[0]!.generation)).toThrow();

  // Polling the same contradictory identity must not repeatedly increment generation.
  db.reconcileDeviceTransports('host', [counterfeit]);
  records = db.listDeviceRecords('host');
  expect(records[0]!.transports[0]!.generation).toBe(fencedGeneration);
  expect(records).toHaveLength(1);

  // Even a later matching scan must not silently clear a previously latched conflict.
  db.reconcileDeviceTransports('host', [observation('usb_1')]);
  records = db.listDeviceRecords('host');
  expect(records[0]!.identity).toBe('CONFLICT');
  expect(records[0]!.capabilities.manualControl).toBe(false);
  db.close();
  db = new StudioDatabase(join(dir, 'studio.sqlite'));
  const reopened = db.listDeviceRecords('host');
  expect(reopened[0]!.id).toBe(existing.id);
  expect(reopened[0]!.identity).toBe('CONFLICT');
  expect(reopened[0]!.name).toBe('Original handset');
});

it('latches both historical identities when a reused serial claims another registered device fingerprint', () => {
  const otherMetadata: DeviceMetadata = { ...metadata, hardwareSerial: 'KNOWN_OTHER' };
  db.reconcileDeviceTransports('host', [
    observation('usb_old'),
    { ...observation('usb_other'), metadata: otherMetadata },
  ]);
  const before = db.listDeviceRecords('host'),
    old = before.find((r) => r.metadata?.hardwareSerial === metadata.hardwareSerial)!,
    other = before.find((r) => r.metadata?.hardwareSerial === 'KNOWN_OTHER')!;
  expect(old.id).not.toBe(other.id);
  expect(before.every((r) => r.capabilities.manualControl)).toBe(true);

  db.reconcileDeviceTransports('host', [
    { ...observation('usb_old'), metadata: otherMetadata },
    { ...observation('usb_other'), metadata: otherMetadata },
  ]);
  const after = db.listDeviceRecords('host');
  expect(after).toHaveLength(2);
  expect(after.find((r) => r.id === old.id)).toMatchObject({
    identity: 'CONFLICT',
    transports: [expect.objectContaining({ serial: 'usb_old', identityVerified: false })],
  });
  expect(after.find((r) => r.id === other.id)!.identity).toBe('CONFLICT');
  expect(after.every((r) => !r.capabilities.manualControl)).toBe(true);
  expect(() => db.assertDeviceTransport('host', old.id, 'usb_old', old.transports[0]!.generation)).toThrow();

  // The same metadata on a different, unrelated phone never authorizes the old ID.
  db.reconcileDeviceTransports('host', [
    observation('usb_old'),
    { ...observation('usb_other'), metadata: otherMetadata },
  ]);
  expect(db.listDeviceRecords('host').every((r) => r.identity === 'CONFLICT')).toBe(true);
});

it('ignores identity-looking metadata from unauthorized/offline transports without creating a new device', () => {
  db.reconcileDeviceTransports('host', [observation('usb_1')]);
  const before = db.listDeviceRecords('host')[0]!;
  const untrusted: DeviceMetadata = { ...metadata, hardwareSerial: 'FORGED_NONCONNECTED' };
  db.reconcileDeviceTransports('host', [
    { ...observation('usb_1'), state: 'UNAUTHORIZED', metadata: untrusted },
  ]);
  let after = db.listDeviceRecords('host');
  expect(after).toHaveLength(1);
  expect(after[0]).toMatchObject({
    id: before.id,
    identity: 'VERIFIED_PROPERTIES',
    metadata: { hardwareSerial: metadata.hardwareSerial },
  });
  expect(after[0]!.capabilities.manualControl).toBe(false);
  expect(after[0]!.transports[0]!.identityVerified).toBe(false);
  db.reconcileDeviceTransports('host', [
    { ...observation('usb_1'), state: 'OFFLINE', metadata: untrusted },
  ]);
  after = db.listDeviceRecords('host');
  expect(after).toHaveLength(1);
  expect(after[0]!.identity).toBe('VERIFIED_PROPERTIES');
  db.reconcileDeviceTransports('host', [observation('usb_1')]);
  expect(db.listDeviceRecords('host')[0]!.capabilities.manualControl).toBe(true);
});

it('keeps a legitimate USB+TCP pair and an unrelated phone unaffected by a contradictory alias', () => {
  const second = { ...metadata, hardwareSerial: 'SECOND_PHONE' };
  db.reconcileDeviceTransports('host', [
    observation('usb_1'),
    observation('192.168.1.3:5555', 'TCP'),
    { ...observation('usb_2'), metadata: second },
  ]);
  const records = db.listDeviceRecords('host');
  expect(records).toHaveLength(2);
  const original = records.find((r) => r.metadata?.hardwareSerial === metadata.hardwareSerial)!;
  expect(original.transports).toHaveLength(2);
  expect(original.capabilities.manualControl).toBe(true);
  db.reconcileDeviceTransports('host', [
    { ...observation('usb_1'), metadata: { ...metadata, hardwareSerial: 'UNKNOWN_NEW' } },
    observation('192.168.1.3:5555', 'TCP'),
    { ...observation('usb_2'), metadata: second },
  ]);
  const after = db.listDeviceRecords('host');
  expect(after.find((r) => r.id === original.id)!.identity).toBe('CONFLICT');
  expect(after.find((r) => r.id === original.id)!.capabilities.manualControl).toBe(false);
  const unaffected = after.find((r) => r.metadata?.hardwareSerial === 'SECOND_PHONE')!;
  expect(unaffected.identity).toBe('VERIFIED_PROPERTIES');
  expect(unaffected.capabilities.manualControl).toBe(true);
});

it('never remaps a verified transport on partial property probe with no hardware serial', () => {
  db.reconcileDeviceTransports('host', [observation('usb_1')]);
  const verified = db.listDeviceRecords('host')[0]!;
  db.reconcileDeviceTransports('host', [{
    ...observation('usb_1'),
    metadata: { ...metadata, hardwareSerial: null, manufacturer: 'Unconfirmed', model: 'Uncertain' },
  }]);
  const pending = db.listDeviceRecords('host');
  expect(pending).toHaveLength(1);
  expect(pending[0]).toMatchObject({
    id: verified.id,
    identity: 'VERIFIED_PROPERTIES',
    metadata: { hardwareSerial: metadata.hardwareSerial, manufacturer: metadata.manufacturer },
  });
  expect(pending[0]!.transports[0]!.identityVerified).toBe(false);
  expect(pending[0]!.capabilities.manualControl).toBe(false);
  db.reconcileDeviceTransports('host', [observation('usb_1')]);
  expect(db.listDeviceRecords('host')[0]!.capabilities.manualControl).toBe(true);
});
