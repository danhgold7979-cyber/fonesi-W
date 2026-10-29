import { afterEach, describe, expect, it } from 'vitest';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createServer } from 'node:net';
import {
  AdbClient,
  parseDevices,
  parseEndpoint,
  quoteAndroidArg,
  serverVersion,
  deviceFingerprint,
} from './index.js';
import { startAdbFixture } from '../../../tests/fixtures/adb-server.js';

const closers: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const close of closers.splice(0)) await close();
});
async function fixture() {
  const value = await startAdbFixture();
  closers.push(value.close);
  return value;
}
describe('ADB protocol and command boundaries', () => {
  it('validates IPv4/IPv6/DNS endpoints and rejects shell/port injection', () => {
    expect(parseEndpoint('192.168.1.2:5555')).toBe('192.168.1.2:5555');
    expect(parseEndpoint('[2001:DB8::1]:12345')).toBe('[2001:db8::1]:12345');
    for (const value of [
      'host:0',
      'host:65536',
      'host;reboot:5555',
      '127.999.1.1:5555',
      'bad..host:5555',
      '[:::]:5555',
      'host:55\n55',
    ])
      expect(() => parseEndpoint(value)).toThrow();
  });
  it('parses unauthorized/offline/no-permission states without claiming they are connected', () => {
    expect(
      parseDevices(
        'usb1\tunauthorized\n192.168.0.2:5555\toffline\n????????????\tno permissions (missing udev rules)\n',
      ).map((d) => d.state),
    ).toEqual(['UNAUTHORIZED', 'OFFLINE', 'NO_PERMISSIONS']);
    expect(() => parseDevices('bad;serial\tdevice')).toThrow();
    expect(() => parseDevices('a\tdevice\na\tdevice')).toThrow();
  });
  it('reads segmented smart-socket and shell_v2 stdout/exit and binary PNG bytes', async () => {
    const f = await fixture();
    f.state.split = true;
    const adb = new AdbClient(f.port);
    expect(await serverVersion(f.port)).toBe(41);
    expect((await adb.devices())[0]!.state).toBe('CONNECTED');
    const metadata = await adb.metadata('USB_FIXTURE');
    expect(metadata).toMatchObject({ hardwareSerial: 'SERIAL_FIXTURE', sdk: 34, locale: 'vi-VN' });
    expect(await adb.packages('USB_FIXTURE')).toContain('com.facebook.katana');
    expect(await adb.foreground('USB_FIXTURE')).toBe('com.facebook.katana');
    const image = await adb.screenshot('USB_FIXTURE');
    expect(image).toMatchObject({ width: 360, height: 640 });
    expect(image.bytes.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    await adb.tap('USB_FIXTURE', 10, 20);
    await adb.swipe('USB_FIXTURE', 1, 2, 3, 4, 300);
    await adb.key('USB_FIXTURE', 'HOME');
    expect(f.state.shells).toContain("'input' 'tap' '10' '20'");
    await adb.launch('USB_FIXTURE', 'com.facebook.katana');
    await adb.forceStop('USB_FIXTURE', 'com.facebook.katana');
  });
  it('blocks version mismatch without sending kill/restart, propagates nonzero exit and redacts pairing secrets', async () => {
    const f = await fixture(),
      adb = new AdbClient(f.port);
    f.state.protocol = 40;
    await expect(adb.devices()).rejects.toThrow('giữ nguyên');
    expect(f.state.requests.every((s) => s === 'host:version')).toBe(true);
    f.state.protocol = 41;
    f.state.exitCode = 1;
    await expect(adb.key('USB_FIXTURE', 'HOME')).rejects.toThrow('không tự thử lại');
    f.state.exitCode = 0;
    await adb.pair('192.168.1.1:1234', '123456');
    expect(f.state.requests.at(-1)).toBe('host:pair:[REDACTED]');
    await expect(adb.pair('host:1234', '123456;reboot')).rejects.toThrow('6 chữ số');
  });
  it('quotes remote shell metacharacters as literal bytes rather than evaluating them', async () => {
    const value = "hello '$(printf injected)'; echo wrong & $HOME";
    if (process.platform !== 'win32') {
      const { stdout } = await promisify(execFile)('/bin/sh', [
        '-c',
        'printf %s ' + quoteAndroidArg(value),
      ]);
      expect(stdout).toBe(value);
    }
    expect(() => quoteAndroidArg('bad\ncommand')).toThrow();
    expect(() => quoteAndroidArg('bad\0command')).toThrow();
  });
  it('cancels stalled connections and rejects malformed protocol before using a transport', async () => {
    const f = await fixture();
    f.state.stall = true;
    const controller = new AbortController(),
      pending = new AdbClient(f.port).devices(controller.signal);
    controller.abort();
    await expect(pending).rejects.toThrow('hủy');
    const server = createServer((socket) => {
      socket.on('error', () => undefined);
      socket.on('data', () => {
        socket.end('NOT_A_PROTOCOL', () => socket.destroy());
      });
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
    closers.push(() => new Promise<void>((resolve) => server.close(() => resolve())));
    await expect(serverVersion((server.address() as { port: number }).port)).rejects.toThrow(
      'protocol',
    );
  });
  it('merges stable property evidence independently of USB/LAN and keeps unknown transports provisional', () => {
    const metadata = {
      hardwareSerial: 'serial1',
      manufacturer: 'Vendor',
      model: 'Phone',
      product: 'model1',
      androidVersion: '14',
      sdk: 34,
      locale: 'vi-VN',
    };
    expect(deviceFingerprint(metadata, 'host_1', 'USB_SERIAL')).toEqual(
      deviceFingerprint({ ...metadata, androidVersion: '15' }, 'host_2', '192.168.1.2:5555'),
    );
    expect(deviceFingerprint(null, 'host_1', 'USB_SERIAL').provisional).toBe(true);
    expect(deviceFingerprint(null, 'host_1', 'a').fingerprint).not.toBe(
      deviceFingerprint(null, 'host_1', 'b').fingerprint,
    );
  });
});


describe('S102.2 fenced ADB Sync STAT of canonical owned media is read-only', () => {
  const owned = {
    serial: 'USB_FIXTURE',
    jobId: 'job_owned_stat_fixture',
    ordinal: 0,
    nonce: 'a'.repeat(32),
    extension: '.mp4',
    expectedBytes: 1234,
  };
  it('reads a fragmented regular-file STAT and a canonical missing-file response without deleting', async () => {
    const f = await fixture();
    f.state.split = true;
    let fenced = 0;
    const adb = new AdbClient(f.port).scoped(async () => { fenced++; });
    const expectedPath = '/sdcard/Download/AutoReelsStudio/job-' +
      owned.jobId + '/asset-000-' + owned.nonce + '.mp4';
    expect(await adb.statOwnedStage(owned)).toEqual({
      status: 'REMOTE_PRESENT_OBSERVED',
      remotePath: expectedPath,
      observedBytes: 1234,
      matchesExpectedBytes: true,
      canDelete: false,
      canMarkClean: false,
    });
    expect(fenced).toBeGreaterThanOrEqual(2);
    expect(f.state.syncPaths).toEqual([expectedPath]);
    f.state.syncStatMode = 0;
    f.state.syncStatSize = 0;
    f.state.syncStatMtime = 0;
    expect(await adb.statOwnedStage(owned)).toEqual({
      status: 'REMOTE_ABSENT_OBSERVED',
      remotePath: expectedPath,
      observedBytes: null,
      matchesExpectedBytes: false,
      canDelete: false,
      canMarkClean: false,
    });
    expect(f.state.syncPaths).toEqual([expectedPath, expectedPath]);
    expect(f.state.shells).toEqual([]);
  });

  it('reports mismatched remote length without asserting cleanup or retry', async () => {
    const f = await fixture();
    f.state.syncStatSize = 999;
    const result = await new AdbClient(f.port).scoped(async () => undefined)
      .statOwnedStage(owned);
    expect(result).toMatchObject({
      status: 'REMOTE_PRESENT_OBSERVED', observedBytes: 999,
      matchesExpectedBytes: false, canDelete: false, canMarkClean: false,
    });
  });

  it('rejects unscoped, stale-fenced or malformed owned paths before Sync dispatch', async () => {
    const f = await fixture();
    const unscoped = new AdbClient(f.port);
    await expect(unscoped.statOwnedStage(owned)).rejects
      .toMatchObject({ code: 'ADB_STAGE_LEASE_REQUIRED' });
    const stale = new AdbClient(f.port).scoped(async () => {
      throw new Error('STALE_DEVICE_LEASE_FIXTURE');
    });
    await expect(stale.statOwnedStage(owned)).rejects.toThrow('STALE_DEVICE_LEASE_FIXTURE');
    const client = new AdbClient(f.port).scoped(async () => undefined);
    for (const malformed of [
      { ...owned, jobId: '../camera' },
      { ...owned, nonce: 'not-a-nonce' },
      { ...owned, extension: '.APK' },
      { ...owned, extension: '.sh' },
      { ...owned, ordinal: 32 },
      { ...owned, ordinal: -1 },
      { ...owned, expectedBytes: 0 },
      { ...owned, expectedBytes: Number.NaN },
      { ...owned, expectedBytes: 512 * 1024 * 1024 + 1 },
      { ...owned, serial: 'USB_FIXTURE;rm -rf /' },
    ]) await expect(client.statOwnedStage(malformed)).rejects.toThrow();
    const abort = new AbortController();
    abort.abort();
    await expect(client.statOwnedStage(owned, abort.signal)).rejects
      .toMatchObject({ code: 'CANCELLED' });
    expect(f.state.syncPaths).toEqual([]);
    expect(f.state.shells).toEqual([]);
  });

  it('never converts malformed STAT, symlink, nonzero missing fields or FAIL into confirmed absence', async () => {
    const f = await fixture();
    const client = new AdbClient(f.port).scoped(async () => undefined);
    f.state.syncStatMode = 0;
    f.state.syncStatSize = 5;
    f.state.syncStatMtime = 0;
    await expect(client.statOwnedStage(owned)).rejects
      .toMatchObject({ code: 'ADB_OWNED_STAT_PROTOCOL' });
    f.state.syncStatMode = 0o120777;
    f.state.syncStatSize = 1234;
    f.state.syncStatMtime = 1000;
    await expect(client.statOwnedStage(owned)).rejects
      .toMatchObject({ code: 'ADB_OWNED_STAT_TYPE' });
    f.state.syncStatResponse = 'MALFORMED';
    await expect(client.statOwnedStage(owned)).rejects
      .toMatchObject({ code: 'ADB_OWNED_STAT_PROTOCOL' });
    f.state.syncStatResponse = 'FAIL';
    await expect(client.statOwnedStage(owned)).rejects
      .toMatchObject({ code: 'ADB_OWNED_STAT_PROTOCOL' });
    expect(f.state.shells).toEqual([]);
  });
});
