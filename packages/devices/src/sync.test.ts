import { afterEach, describe, expect, it } from 'vitest';
import { createServer, type Socket } from 'node:net';
import { mkdtemp, mkdir, writeFile, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { AdbClient, type OwnedSyncInput } from './index.js';

const digest = (data: Buffer) => createHash('sha256').update(data).digest('hex');
const cleanup: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const close of cleanup.splice(0)) await close();
});
async function fixture() {
  const sockets = new Set<Socket>();
  const state = {
    requests: [] as string[],
    paths: [] as string[],
    sent: [] as Buffer[],
    fail: false,
    truncateAck: false,
    mkdirCount: 0,
    remote: Buffer.from('streamed ADB Sync exact bytes unicode: tiếng Việt'),
    readFail: false,
    readMode: 'OK' as 'OK' | 'FAIL' | 'TRUNCATED',
  };
  const server = createServer((socket) => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
    socket.on('error', () => undefined);
    let input = Buffer.alloc(0), sync = false, streamShell = false;
    const acknowledge = () => {
      const status = Buffer.alloc(8);
      status.write(state.fail ? 'FAIL' : 'OKAY', 0, 'ascii');
      if (state.fail) {
        const reason = Buffer.from('simulated failure');
        status.writeUInt32LE(reason.length, 4);
        socket.end(Buffer.concat([status, reason]));
      } else if (state.truncateAck) socket.end(status.subarray(0, 4));
      else socket.end(status);
    };
    const handle = () => {
      if (streamShell) return;
      while (true) {
        if (sync) {
          if (input.length < 8) return;
          const op = input.toString('ascii', 0, 4), length = input.readUInt32LE(4);
          if (op === 'RECV') {
            if (input.length < 8 + length) return;
            const remotePath = input.toString('utf8', 8, 8 + length);
            input = input.subarray(8 + length);
            state.paths.push(remotePath);
            if (state.readMode === 'FAIL') {
              const reason = Buffer.from('missing');
              const frame = Buffer.alloc(8);
              frame.write('FAIL', 0, 'ascii');
              frame.writeUInt32LE(reason.length, 4);
              socket.end(Buffer.concat([frame, reason]));
              return;
            }
            const pieces: Buffer[] = [];
            if (state.readMode === 'TRUNCATED') {
              const frame = Buffer.alloc(8);
              frame.write('DATA', 0, 'ascii');
              frame.writeUInt32LE(Math.min(5, state.remote.length), 4);
              pieces.push(frame, state.remote.subarray(0, 2));
            } else {
              for (let offset = 0; offset < state.remote.length; offset += 7) {
                const data = state.remote.subarray(offset, offset + 7);
                const frame = Buffer.alloc(8);
                frame.write('DATA', 0, 'ascii');
                frame.writeUInt32LE(data.length, 4);
                pieces.push(frame, data);
              }
              const done = Buffer.alloc(8);
              done.write('DONE', 0, 'ascii');
              done.writeUInt32LE(0, 4);
              pieces.push(done);
            }
            socket.end(Buffer.concat(pieces));
            return;
          }
          if (op === 'DONE') {
            input = input.subarray(8);
            acknowledge();
            return;
          }
          if (length > 1024 * 1024 || input.length < 8 + length) return;
          const payload = input.subarray(8, 8 + length);
          input = input.subarray(8 + length);
          if (op === 'SEND') state.paths.push(payload.toString('utf8').split(',')[0]!);
          else if (op === 'DATA') state.sent.push(Buffer.from(payload));
          else { socket.destroy(); return; }
          continue;
        }
        if (input.length < 4) return;
        const length = parseInt(input.toString('ascii', 0, 4), 16);
        if (!Number.isInteger(length) || input.length < 4 + length) return;
        const service = input.toString('utf8', 4, 4 + length);
        input = input.subarray(4 + length);
        state.requests.push(service);
        if (service === 'host:version') {
          socket.end('OKAY00040029');
          return;
        }
        if (service.startsWith('host:transport:')) socket.write('OKAY');
        else if (service.startsWith('shell,v2,raw:')) {
          state.mkdirCount++;
          streamShell = true;
          const frame = Buffer.alloc(6);
          frame[0] = 3;
          frame.writeUInt32LE(1, 1);
          frame[5] = 0;
          socket.end(Buffer.concat([Buffer.from('OKAY'), frame]));
          return;
        } else if (service === 'sync:') {
          socket.write('OKAY');
          sync = true;
        } else { socket.end('FAIL000bunsupported'); return; }
      }
    };
    socket.on('data', (part: Buffer) => {
      input = Buffer.concat([input, part]);
      handle();
    });
  });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve());
  });
  const dir = await mkdtemp(join(tmpdir(), 'autoreels-sync-'));
  const folder = join(dir, 'owned-media-stage', 'job-job_sync_1');
  await mkdir(folder, { recursive: true });
  const localPath = join(folder, 'asset-000.mp4');
  const bytes = state.remote;
  await writeFile(localPath, bytes);
  const input: OwnedSyncInput = {
    serial: 'USB_SYNC', localPath, jobId: 'job_sync_1', ordinal: 0,
    nonce: 'b'.repeat(32), expectedBytes: bytes.length, expectedHash: digest(bytes),
  };
  cleanup.push(async () => {
    for (const s of sockets) s.destroy();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await rm(dir, { recursive: true, force: true });
  });
  return { port: (server.address() as {port:number}).port, state, bytes, input, dir };
}

describe('P11/S095 bounded ADB Sync v1 transport-only spike', () => {
  it('streams exact DATA bytes and generated owner-only path, without claiming MediaStore', async () => {
    const f = await fixture();
    let fenced = 0;
    const adb = new AdbClient(f.port).scoped(async () => { fenced++; });
    const result = await adb.sendOwnedStage(f.input);
    expect(result).toMatchObject({
      status: 'SYNC_ACK_UNVERIFIED', bytes: f.bytes.length, canDispatch: false,
    });
    expect(result.remotePath).toBe(
      '/sdcard/Download/AutoReelsStudio/job-job_sync_1/asset-000-' + 'b'.repeat(32) + '.mp4',
    );
    expect(Buffer.concat(f.state.sent)).toEqual(f.bytes);
    expect(f.state.paths).toEqual([result.remotePath]);
    expect(f.state.mkdirCount).toBe(1);
    expect(fenced).toBeGreaterThanOrEqual(3);
  });
  it('rejects raw source paths, invalid target nonce and unscoped ADB before network traffic', async () => {
    const f = await fixture();
    await expect(new AdbClient(f.port).sendOwnedStage(f.input))
      .rejects.toMatchObject({ code: 'ADB_STAGE_LEASE_REQUIRED' });
    const adb = new AdbClient(f.port).scoped(async () => undefined);
    await expect(adb.sendOwnedStage({ ...f.input, nonce: 'bad' })).rejects.toThrow();
    await expect(adb.sendOwnedStage({ ...f.input, localPath: join(f.dir, 'secret.mp4') }))
      .rejects.toMatchObject({ code: 'ADB_SYNC_SOURCE' });
    await expect(adb.sendOwnedStage({ ...f.input, expectedHash: digest(Buffer.from('wrong')) }))
      .rejects.toMatchObject({ code: 'ADB_SYNC_SOURCE_HASH' });
    expect(f.state.requests).toHaveLength(0);
  });
  it('preserves ambiguity of FAIL and truncated ACK; never auto retries', async () => {
    const f = await fixture();
    const adb = new AdbClient(f.port).scoped(async () => undefined);
    f.state.fail = true;
    await expect(adb.sendOwnedStage(f.input)).rejects.toMatchObject({ code: 'ADB_SYNC_FAILED' });
    f.state.fail = false;
    f.state.truncateAck = true;
    await expect(adb.sendOwnedStage(f.input)).rejects.toMatchObject({ code: 'ADB_EOF' });
    expect(f.state.paths).toHaveLength(2);
    expect(Buffer.concat(f.state.sent)).toEqual(Buffer.concat([f.bytes, f.bytes]));
  });
  it('reads back the generated remote path and verifies streamed SHA-256 without buffering to disk', async () => {
    const f = await fixture();
    let fenced = 0;
    const result = await new AdbClient(f.port).scoped(async () => { fenced++; })
      .readOwnedStage({
        serial: f.input.serial, jobId: f.input.jobId, ordinal: f.input.ordinal,
        nonce: f.input.nonce, extension: '.mp4',
        expectedHash: f.input.expectedHash, expectedBytes: f.input.expectedBytes,
      });
    expect(result).toEqual({
      remotePath: '/sdcard/Download/AutoReelsStudio/job-job_sync_1/asset-000-' +
        'b'.repeat(32) + '.mp4',
      hash: f.input.expectedHash, bytes: f.bytes.length,
    });
    expect(f.state.paths).toEqual([result.remotePath]);
    expect(fenced).toBeGreaterThanOrEqual(2);
  });
  it('fails closed on missing remote file, hash mismatch and truncated DATA frames', async () => {
    const f = await fixture();
    const adb = new AdbClient(f.port).scoped(async () => undefined);
    const input = {
      serial: f.input.serial, jobId: f.input.jobId, ordinal: f.input.ordinal,
      nonce: f.input.nonce, extension: '.mp4',
      expectedHash: f.input.expectedHash, expectedBytes: f.input.expectedBytes,
    };
    f.state.readMode = 'FAIL';
    await expect(adb.readOwnedStage(input)).rejects.toMatchObject({ code: 'ADB_SYNC_READ_FAILED' });
    f.state.readMode = 'OK';
    f.state.remote = Buffer.from('different remote bytes');
    await expect(adb.readOwnedStage(input)).rejects.toMatchObject({ code: 'ADB_SYNC_READ_LENGTH' });
    f.state.remote = Buffer.from('streamed ADB Sync exact bytes unicode: tiếng Việt');
    f.state.readMode = 'TRUNCATED';
    await expect(adb.readOwnedStage(input)).rejects.toMatchObject({ code: 'ADB_EOF' });
  });
  it('rejects symlink and abort without sending any unowned source file', async (context) => {
    const f = await fixture();
    const linkPath = join(f.dir, 'owned-media-stage', 'job-job_sync_1', 'asset-001.mp4');
    try {
      await symlink(f.input.localPath, linkPath);
      const adb = new AdbClient(f.port).scoped(async () => undefined);
      await expect(adb.sendOwnedStage({ ...f.input, ordinal: 1, localPath: linkPath }))
        .rejects.toMatchObject({ code: 'ADB_SYNC_SOURCE' });
    } catch (error) {
      if (process.platform === 'win32') context.skip('Windows symlink creation not allowed');
      else throw error;
    }
    const controller = new AbortController();
    controller.abort();
    await expect(new AdbClient(f.port).scoped(async () => undefined)
      .sendOwnedStage(f.input, controller.signal))
      .rejects.toThrow();
    expect(f.state.paths).toHaveLength(0);
  });
});
