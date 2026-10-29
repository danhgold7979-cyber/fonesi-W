import { afterEach, beforeEach, expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { StudioDatabase } from '@autoreels/database';
import type { DeviceSnapshot, DeviceCapture, DeviceSelectorLiveReport } from '@autoreels/contracts';
import { HostDeviceService } from '../apps/desktop/src/host/device-service.js';
import { dispatchInternal } from '../apps/desktop/src/host/internal.js';
import { dispatch } from '../apps/desktop/src/host/service.js';
import { startAdbFixture } from './fixtures/adb-server.js';

let directory: string,
  db: StudioDatabase,
  fixture: Awaited<ReturnType<typeof startAdbFixture>>,
  host: HostDeviceService;

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'autoreels-live-selector-'));
  db = new StudioDatabase(join(directory, 'studio.sqlite'));
  fixture = await startAdbFixture();
  host = new HostDeviceService({
    request: async (command, input = {}) =>
      dispatch(db, { operationId: 'op_live_probe', command, input }),
    internal: async <T>(request: Parameters<typeof dispatchInternal>[1]) =>
      dispatchInternal(db, request) as T,
  }, 'host_live_probe', directory, undefined, { port: fixture.port });
  await host.ready();
  await host.scan();
});
afterEach(async () => {
  await host.close();
  await fixture.close();
  db.close();
  await rm(directory, { recursive: true, force: true });
});
async function deviceId(): Promise<string> {
  const snapshot = (await host.request('deviceSnapshot', {})) as DeviceSnapshot;
  expect(snapshot.devices).toHaveLength(1);
  return snapshot.devices[0]!.id;
}
const exact = { version: 1, all: [
  { field: 'resourceId', op: 'EQ', value: 'com.facebook.katana:id/submit' },
] };

it('reports fresh ADB v1/v2 selector 0/1/n match counts without touching the phone', async () => {
  const id = await deviceId();
  const inputs = fixture.state.shells.filter((s) => s.startsWith("'input'")).length;
  const one = (await host.request('testDeviceSelector', {
    id, selector: exact,
  })) as DeviceSelectorLiveReport;
  expect(one).toMatchObject({
    deviceId: id, status: 'UNIQUE', totalMatches: 1, strategyIndex: 1,
    attempts: [{ strategyIndex: 1, count: 1 }], truncated: false,
    correlation: 'BOUNDED_SEQUENTIAL',
  });
  expect(one.samples).toHaveLength(1);
  expect(one.samples[0]).toMatchObject({
    resourceId: 'com.facebook.katana:id/submit',
    bounds: { left: 20, top: 30, right: 200, bottom: 100 },
  });
  expect(JSON.stringify(one)).not.toContain('Publish fixture');
  expect(JSON.stringify(one)).not.toContain('SERIAL_FIXTURE');
  expect(JSON.stringify(one)).not.toContain('"data":"');

  const fallback = (await host.request('testDeviceSelector', {
    id, selector: {
      version: 2,
      strategies: [
        { all: [{ field: 'text', op: 'EQ', value: 'not present' }] },
        { all: [{ field: 'resourceId', op: 'EQ', value: 'com.facebook.katana:id/submit' }] },
      ],
    },
  })) as DeviceSelectorLiveReport;
  expect(fallback).toMatchObject({
    status: 'UNIQUE', totalMatches: 1, strategyIndex: 2,
    attempts: [{ strategyIndex: 1, count: 0 }, { strategyIndex: 2, count: 1 }],
  });
  const many = (await host.request('testDeviceSelector', {
    id, selector: {
      version: 1,
      all: [{ field: 'className', op: 'CONTAINS', value: 'android.' }],
    },
  })) as DeviceSelectorLiveReport;
  expect(many).toMatchObject({ status: 'AMBIGUOUS', totalMatches: 2 });
  expect(many.samples).toHaveLength(2);
  const zero = (await host.request('testDeviceSelector', {
    id, selector: { version: 1, all: [{ field: 'resourceId', op: 'EQ', value: 'missing' }] },
  })) as DeviceSelectorLiveReport;
  expect(zero).toMatchObject({ status: 'NONE', totalMatches: 0, samples: [] });
  expect(fixture.state.shells.filter((s) => s.startsWith("'input'")).length).toBe(inputs);
});

it('rejects invalid selectors before any device command and never leaves a tap-capable token', async () => {
  const id = await deviceId();
  const capture = (await host.request('captureDevice', { id })) as DeviceCapture;
  const before = fixture.state.shells.length;
  for (const bad of [
    { version: 2, strategies: [] },
    { version: 1, all: [{ field: '__proto__', op: 'EQ', value: 'unsafe' }] },
    { version: 1, all: [{ field: 'text', op: 'REGEX', value: '.*' }] },
  ]) {
    await expect(host.request('testDeviceSelector', { id, selector: bad })).rejects.toMatchObject({
      code: 'INVALID_SELECTOR',
    });
  }
  expect(fixture.state.shells).toHaveLength(before);
  await host.request('testDeviceSelector', {
    id, selector: { version: 1, all: [{ field: 'className', op: 'EQ', value: 'absent' }] },
  });
  await expect(host.request('deviceAction', {
    id, action: { type: 'TAP', captureId: capture.id, x: 30, y: 40 },
  })).rejects.toThrow();
  expect(fixture.state.shells.some((s) => s.startsWith("'input' 'tap'"))).toBe(false);
});

it('does not bypass a real DB lease or offline transport during live selector probes', async () => {
  const id = await deviceId();
  const lease = db.acquireLease(id, 'active_job', 'JOB', Date.now(), 30000);
  await expect(host.request('testDeviceSelector', { id, selector: exact })).rejects.toThrow();
  db.releaseLease(lease);
  fixture.state.list = 'USB_FIXTURE\toffline product:fixture model:Fixture_Phone transport_id:1\n';
  await host.scan();
  await expect(host.request('testDeviceSelector', { id, selector: exact })).rejects.toMatchObject({
    code: 'DEVICE_UNAVAILABLE',
  });
  expect(fixture.state.shells.some((s) => s.startsWith("'input'"))).toBe(false);
});
