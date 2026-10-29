import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { StudioDatabase } from '@autoreels/database';
import type {
  DeviceSnapshot, DeviceCapture, InspectorSnapshot,
  DeviceResolutionPreview, DeviceResolutionApplyResponse,
} from '@autoreels/contracts';
import { SdkManager } from '@autoreels/devices';
import { HostDeviceService } from '../apps/desktop/src/host/device-service.js';
import { dispatchInternal } from '../apps/desktop/src/host/internal.js';
import { dispatch } from '../apps/desktop/src/host/service.js';
import { startAdbFixture } from './fixtures/adb-server.js';
let dir: string,
  db: StudioDatabase,
  f: Awaited<ReturnType<typeof startAdbFixture>>,
  service: HostDeviceService;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'autoreels-device-service-'));
  db = new StudioDatabase(join(dir, 'studio.sqlite'));
  f = await startAdbFixture();
  service = new HostDeviceService(
    {
      request: async (command, input = {}) =>
        dispatch(db, { operationId: 'op_device_fixture', command, input }),
      internal: async <T>(request: Parameters<typeof dispatchInternal>[1]) =>
        dispatchInternal(db, request) as T,
    },
    'host_fixture',
    dir,
    undefined,
    { port: f.port },
  );
  await service.ready();
  await service.scan();
});
afterEach(async () => {
  await service.close();
  await f.close();
  db.close();
  await rm(dir, { recursive: true, force: true });
});
async function snapshot() {
  return (await service.request('deviceSnapshot', {})) as DeviceSnapshot;
}
async function device() {
  return (await snapshot()).devices[0]!;
}
describe('host device integration', () => {

  it('native stage reader acquires and releases a fresh MANUAL lease without device input', async () => {
    const d = await device();
    const priorShells = [...f.state.shells];
    const output = await service.withManualStageReviewLease(
      d.id, async (lease, transport) => {
        expect(lease.ownerKind).toBe('MANUAL');
        expect(lease.deviceId).toBe(d.id);
        expect(lease.expiresAt).toBeGreaterThan(Date.now());
        db.assertLease(lease, Date.now());
        expect(transport.serial).toBe('USB_FIXTURE');
        expect(transport.generation).toBeGreaterThan(0);
        return { seen: true };
      });
    expect(output).toEqual({ seen: true });
    expect((await device()).owner).toBeNull();
    // A fresh scan legitimately re-reads Android getprop, but never sends
    // touch, delete, reboot or other mutation from a stage-review lease.
    expect(f.state.shells.slice(priorShells.length)).toEqual(["'getprop'"]);
    expect(f.state.requests.filter((r) => r.startsWith('shell,v2,raw:') &&
      /input|rm|reboot/.test(r))).toHaveLength(0);
  });
  it('native stage reader rejects a busy or offline device without running its callback', async () => {
    const d = await device();
    let called = false;
    const held = db.acquireLease(d.id, 'held_job', 'JOB', Date.now(), 30000);
    try {
      await expect(service.withManualStageReviewLease(d.id, async () => {
        called = true;
      })).rejects.toThrow();
    } finally {
      db.releaseLease(held);
    }
    expect(called).toBe(false);
    f.state.list = 'USB_FIXTURE\toffline\n';
    await expect(service.withManualStageReviewLease(d.id, async () => {
      called = true;
    })).rejects.toThrow();
    expect(called).toBe(false);
  });

  it('discovers actual TCP fixture properties, exposes actual connection separately from automation and rejects raw path/shell requests', async () => {
    const data = await snapshot();
    expect(data.diagnostic.status).toBe('READY');
    expect(data.devices[0]!.capabilities).toMatchObject({
      connected: true,
      manualControl: true,
      stream: false,
      automation: false,
    });
    await expect(service.request('chooseAdbSdk', { path: '/tmp/adb' })).rejects.toThrow();
    await expect(
      service.request('deviceAction', {
        id: data.devices[0]!.id,
        action: { type: 'KEY', key: 'HOME', shell: 'reboot' },
      }),
    ).rejects.toThrow();
    await expect(
      dispatch(db, { operationId: 'op_forged', command: 'lease.acquire', input: {} }),
    ).rejects.toThrow();
  });
  it('requires the same current capture and orientation before dispatching coordinate input', async () => {
    const d = await device(),
      capture = (await service.request('captureDevice', { id: d.id })) as DeviceCapture;
    expect(capture).toMatchObject({ width: 360, height: 640, rotation: 0 });
    f.state.rotation = 1;
    await expect(
      service.request('deviceAction', {
        id: d.id,
        action: { type: 'TAP', captureId: capture.id, x: 10, y: 20 },
      }),
    ).rejects.toThrow('Orientation');
    expect(f.state.shells.some((s) => s.startsWith("'input' 'tap'"))).toBe(false);
    f.state.rotation = 0;
    const next = (await service.request('captureDevice', { id: d.id })) as DeviceCapture;
    await service.request('deviceAction', {
      id: d.id,
      action: { type: 'TAP', captureId: next.id, x: 10, y: 20 },
    });
    expect(f.state.shells).toContain("'input' 'tap' '10' '20'");
    await expect(
      service.request('deviceAction', {
        id: d.id,
        action: { type: 'TAP', captureId: next.id, x: 10, y: 20 },
      }),
    ).rejects.toThrow('hết hiệu lực');
  });
  it('shares real DB leases with jobs and rejects input while another owner holds the phone', async () => {
    const d = await device(),
      lease = db.acquireLease(d.id, 'job_fixture', 'JOB', Date.now(), 30000);
    await expect(
      service.request('deviceAction', { id: d.id, action: { type: 'KEY', key: 'HOME' } }),
    ).rejects.toThrow('owned');
    expect(f.state.shells.some((s) => s.startsWith("'input'"))).toBe(false);
    db.releaseLease(lease);
    await service.request('deviceAction', { id: d.id, action: { type: 'KEY', key: 'HOME' } });
    expect(f.state.shells).toContain("'input' 'keyevent' '3'");
  });
  it('drops queued old input after a failed command and requires a fresh observation before accepting new commands', async () => {
    const d = await device();
    f.state.exitCode = 1;
    const results = await Promise.allSettled([
      service.request('deviceAction', { id: d.id, action: { type: 'KEY', key: 'HOME' } }),
      service.request('deviceAction', { id: d.id, action: { type: 'KEY', key: 'BACK' } }),
    ]);
    expect(results.every((r) => r.status === 'rejected')).toBe(true);
    expect(f.state.shells.filter((s) => s.startsWith("'input'"))).toHaveLength(1);
    expect((await device()).capabilities.manualControl).toBe(false);
    f.state.exitCode = 0;
    await service.scan();
    await service.request('deviceAction', { id: d.id, action: { type: 'KEY', key: 'BACK' } });
    expect(f.state.shells.at(-1)).toBe("'input' 'keyevent' '4'");
  });
  it('limits app operations to registered packages and reads real package/foreground responses', async () => {
    const d = await device();
    expect(await service.request('devicePackages', { id: d.id })).toMatchObject({
      packages: ['com.android.settings', 'com.facebook.katana'],
      foreground: 'com.facebook.katana',
    });
    await expect(
      service.request('deviceAction', {
        id: d.id,
        action: { type: 'FORCE_STOP', packageName: 'com.android.settings' },
      }),
    ).rejects.toThrow('registry');
    await service.request('deviceAction', {
      id: d.id,
      action: { type: 'FORCE_STOP', packageName: 'com.facebook.katana' },
    });
    expect(f.state.shells).toContain("'am' 'force-stop' '--user' '0' 'com.facebook.katana'");
  });
  it('keeps pairing PIN transient and rejects malformed endpoints without sending untrusted shell content', async () => {
    const data = (await service.request('pairDevice', {
      endpoint: '192.168.1.2:12345',
      code: '123456',
    })) as DeviceSnapshot;
    expect(JSON.stringify(data)).not.toContain('123456');
    expect(f.state.requests).toContain('host:pair:[REDACTED]');
    const before = f.state.requests.length;
    await expect(
      service.request('connectDevice', { endpoint: 'host;reboot:5555' }),
    ).rejects.toThrow('host:port');
    expect(f.state.requests).toHaveLength(before);
  });
  it('correlates XML and PNG in one Inspector lease, cleans only its nonce file and rejects changing orientation', async () => {
    const d = await device(),
      result = (await service.request('inspectDevice', { id: d.id })) as InspectorSnapshot;
    expect(result).toMatchObject({
      correlation: 'BOUNDED_SEQUENTIAL',
      capture: { deviceId: d.id, width: 360, height: 640, rotation: 0 },
    });
    expect(result.nodes).toHaveLength(2);
    expect(result.nodes[1]!.resourceId).toBe('com.facebook.katana:id/submit');
    const dump = f.state.shells.find((s) => s.startsWith("'uiautomator' 'dump'"))!;
    const path = dump.match(/'([/][^']+[.]xml)'$/)![1]!;
    expect(path).toMatch(/^[/]data[/]local[/]tmp[/]autoreels-inspector-[a-f0-9-]+[.]xml$/);
    expect(f.state.shells).toContain("'cat' '" + path + "'");
    expect(f.state.shells).toContain("'rm' '-f' '" + path + "'");
    expect(f.state.shells.some((s) => s.startsWith("'input'"))).toBe(false);
    f.state.rotateOnXml = true;
    await expect(service.request('inspectDevice', { id: d.id })).rejects.toThrow('Orientation');
    expect((await snapshot()).devices[0]!.owner).toBeNull();
  });
  it('reconnects remembered endpoints once, resolves hostname aliases, and disables policy on scoped disconnect', async () => {
    f.state.autoConnect = true;
    f.state.connectAlias = '192.168.1.2:5555';
    db.setDeviceEndpoint('host_fixture', 'phone.local:5555', true);
    await service.scan();
    let data = await snapshot();
    expect(data.endpoints[0]).toMatchObject({
      resolvedSerial: '192.168.1.2:5555',
      desired: true,
      failures: 0,
      deviceId: data.devices[0]!.id,
    });
    expect(data.devices).toHaveLength(1);
    expect(data.devices[0]!.transports).toHaveLength(2);
    await service.scan();
    expect(f.state.requests.filter((x) => x.startsWith('host:connect:'))).toHaveLength(1);
    await service.request('disconnectDevice', { id: data.devices[0]!.id });
    data = await snapshot();
    expect(data.endpoints[0]!.desired).toBe(false);
    await service.scan();
    expect(f.state.requests.filter((x) => x.startsWith('host:connect:'))).toHaveLength(1);
    expect(f.state.requests).toContain('host:disconnect:192.168.1.2:5555');
    expect(f.state.requests).not.toContain('host:disconnect:');
    expect(data.devices[0]!.capabilities.connected).toBe(true); // USB remains.
  });
  it('connects once without remembering a new endpoint and disables a previously remembered policy', async () => {
    f.state.autoConnect = true;
    await service.request('connectDevice', { endpoint: 'phone.local:5555', reconnect: false });
    expect((await snapshot()).endpoints).toEqual([]);
    db.setDeviceEndpoint('host_fixture', 'phone.local:5555', true);
    await service.request('connectDevice', { endpoint: 'phone.local:5555', reconnect: false });
    expect((await snapshot()).endpoints[0]!.desired).toBe(false);
  });
  it('bounds reconnect attempts per scan, backs off failures and enforces policy revisions', async () => {
    f.state.connectError = true;
    for (let i = 0; i < 4; i++)
      db.setDeviceEndpoint('host_fixture', 'phone' + i + '.local:5555', true);
    await service.scan();
    expect(f.state.requests.filter((x) => x.startsWith('host:connect:'))).toHaveLength(2);
    let data = await snapshot();
    expect(data.endpoints.filter((p) => p.failures === 1)).toHaveLength(2);
    await service.scan();
    expect(f.state.requests.filter((x) => x.startsWith('host:connect:'))).toHaveLength(4);
    const p = data.endpoints[0]!;
    await service.request('setDeviceReconnect', {
      endpoint: p.endpoint,
      expectedRevision: p.revision,
      desired: false,
    });
    await expect(
      service.request('setDeviceReconnect', {
        endpoint: p.endpoint,
        expectedRevision: p.revision,
        desired: true,
      }),
    ).rejects.toThrow('đã đổi');
    data = await snapshot();
    expect(data.endpoints[0]!.desired).toBe(false);
    await service.scan();
    expect(f.state.requests.filter((x) => x.startsWith('host:connect:'))).toHaveLength(4);
  });
  it('cancels and closes owned pending operations without leaving live connections or false state', async () => {
    f.state.stall = true;
    const scanning = service.scan();
    await service.request('cancelDeviceScan', {});
    await scanning;
    await service.close();
    await expect(service.request('deviceSnapshot', {})).rejects.toThrow('đóng');
  });
});
describe('native SDK grant hashing', () => {
  it('inspects a real executable test adapter with a pinned hash and rejects replacement before running it', async (context) => {
    if (process.platform === 'win32')
      context.skip('Unix executable fixture; Windows native SDK acceptance is separate.');
    const bin = join(dir, 'bin');
    await mkdir(bin);
    const path = join(bin, 'adb');
    await writeFile(
      path,
      '#!/usr/bin/env node\nconsole.log("Android Debug Bridge version 1.0.41\\nVersion 37.0.1-fixture");\n',
      { mode: 0o755 },
    );
    const info = await new SdkManager(path).inspect();
    expect(info.protocol).toBe(41);
    expect(info.hash).toMatch(/^[a-f0-9]{64}$/);
    await writeFile(path, '#!/usr/bin/env node\nconsole.log("modified");\n', { mode: 0o755 });
    await expect(new SdkManager(path, info.hash).inspect()).rejects.toThrow('đã đổi');
  });
});


it('requires fresh historical ADB proof and refuses recovery outside native desktop confirmation', async () => {
  const original = await device();
  f.state.hardwareSerial = 'REUSED_ALIAS_DIFFERENT_PHONE';
  await service.scan();
  const locked = await device();
  expect(locked.id).toBe(original.id);
  expect(locked.identity).toBe('CONFLICT');
  expect(locked.capabilities.manualControl).toBe(false);
  f.state.hardwareSerial = 'SERIAL_FIXTURE';
  await service.scan();
  const matched = await device();
  const preview = (await service.request('previewDeviceConflictResolution', {
    id: locked.id, expectedRevision: matched.revision,
  })) as DeviceResolutionPreview;
  expect(preview).toMatchObject({ deviceId: locked.id, canApply: true, blockers: [] });
  expect(JSON.stringify(preview)).not.toContain('SERIAL_FIXTURE');
  await expect(
    service.request('applyDeviceConflictResolution', {
      id: locked.id, token: preview.token, confirmedName: preview.name,
    }),
  ).rejects.toMatchObject({ code: 'NATIVE_DIALOG_REQUIRED' });
  expect((await device()).identity).toBe('CONFLICT');
  expect(f.state.shells.some((s) => s.startsWith("'input'"))).toBe(false);
});

it('asks native operator and independently re-probes ADB, then disables controls after audited recovery', async () => {
  const original = await device();
  f.state.hardwareSerial = 'A_NEW_PHONE';
  await service.scan();
  const conflict = await device();
  expect(conflict.identity).toBe('CONFLICT');
  f.state.hardwareSerial = 'SERIAL_FIXTURE';
  await service.close();
  const dbPort = {
    request: async (command: Parameters<typeof dispatch>[1]['command'], input = {}) =>
      dispatch(db, { operationId: 'op_resolution_fixture', command, input }),
    internal: async <T>(request: Parameters<typeof dispatchInternal>[1]) =>
      dispatchInternal(db, request) as T,
  };
  let confirmationCount = 0;
  service = new HostDeviceService(
    dbPort, 'host_fixture', dir, undefined, { port: f.port },
    async (name, model) => {
      confirmationCount++;
      expect(name).toBe(original.name);
      expect(model).toBe('Fixture Phone');
      return true;
    },
  );
  await service.ready();
  await service.scan();
  const current = await device();
  const preview = (await service.request('previewDeviceConflictResolution', {
    id: current.id, expectedRevision: current.revision,
  })) as DeviceResolutionPreview;
  expect(preview.canApply).toBe(true);
  const result = (await service.request('applyDeviceConflictResolution', {
    id: current.id, token: preview.token, confirmedName: preview.name,
  })) as DeviceResolutionApplyResponse;
  expect(result).toMatchObject({
    cancelled: false,
    resolution: { deviceId: original.id, enabled: false },
  });
  expect(confirmationCount).toBe(1);
  const after = await device();
  expect(after.id).toBe(original.id);
  expect(after.identity).toBe('VERIFIED_PROPERTIES');
  expect(after.enabled).toBe(false);
  expect(after.capabilities.manualControl).toBe(false);
  expect(f.state.shells.some((s) => s.startsWith("'input'"))).toBe(false);
  await expect(
    service.request('applyDeviceConflictResolution', {
      id: current.id, token: preview.token, confirmedName: preview.name,
    }),
  ).rejects.toThrow();
});


it('rejects a handset swap between preview and the desktop confirmation without changing the old device', async () => {
  const original = await device();
  f.state.hardwareSerial = 'TEMP_REUSED_SERIAL';
  await service.scan();
  expect((await device()).identity).toBe('CONFLICT');
  f.state.hardwareSerial = 'SERIAL_FIXTURE';
  await service.close();
  service = new HostDeviceService(
    {
      request: async (command, input = {}) =>
        dispatch(db, { operationId: 'op_resolution_swap', command, input }),
      internal: async <T>(request: Parameters<typeof dispatchInternal>[1]) =>
        dispatchInternal(db, request) as T,
    },
    'host_fixture',
    dir,
    undefined,
    { port: f.port },
    async () => {
      // Simulated physical swap exactly while the user approves the OS dialog.
      f.state.hardwareSerial = 'ANOTHER_HANDSET_AT_CONFIRM';
      return true;
    },
  );
  await service.ready();
  await service.scan();
  const current = await device();
  const preview = (await service.request('previewDeviceConflictResolution', {
    id: current.id, expectedRevision: current.revision,
  })) as DeviceResolutionPreview;
  expect(preview.canApply).toBe(true);
  await expect(
    service.request('applyDeviceConflictResolution', {
      id: original.id, token: preview.token, confirmedName: preview.name,
    }),
  ).rejects.toMatchObject({ code: 'RESOLUTION_PROOF_CHANGED' });
  const after = await device();
  expect(after.id).toBe(original.id);
  expect(after.identity).toBe('CONFLICT');
  expect(after.capabilities.manualControl).toBe(false);
  expect(f.state.shells.some((s) => s.startsWith("'input'"))).toBe(false);
});
