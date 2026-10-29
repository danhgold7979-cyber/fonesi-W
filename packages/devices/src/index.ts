import { randomUUID } from 'node:crypto';
import { createHash } from 'node:crypto';
import { constants } from 'node:fs';
import { open, lstat } from 'node:fs/promises';
import { basename, dirname, extname, isAbsolute, resolve } from 'node:path';
import type { Socket } from 'node:net';
import type { DeviceMetadata, TransportObservation } from '@autoreels/contracts';
import { idSchema, packageNameSchema, hashSchema } from '@autoreels/contracts';
import { DomainError } from '@autoreels/domain';
import { AdbConnection } from './connection.js';
import { ownedStageLocation, ownedStageExtensions } from './owned-stage.js';
export { ownedStageLocation, assertOwnedStageLocation } from './owned-stage.js';
export { assessOwnedCleanupReadback } from './owned-cleanup-reconcile.js';
export type { OwnedCleanupReadbackSummary, OwnedRemoteStatReadback, OwnedMediaStoreReadback } from './owned-cleanup-reconcile.js';
import { assertSerial, quoteAndroidArg, parseEndpoint, serverVersion } from './protocol.js';
export { assertSerial, quoteAndroidArg, parseEndpoint, serverVersion } from './protocol.js';
export { SdkManager } from './sdk.js';
export { parseUiXml } from './xml.js';

export function parseDevices(text: string): TransportObservation[] {
  const result: TransportObservation[] = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim() || line.startsWith('List of devices') || line.startsWith('*')) continue;
    const match = /^(\S+)\s+(device|unauthorized|offline|no permissions)(?:\s|$)/.exec(line);
    if (!match) throw new DomainError('ADB_DEVICE_LIST', 'Không đọc được trạng thái thiết bị ADB.');
    const rawSerial = match[1]!,
      serial =
        match[2] === 'no permissions' && /^\?+$/.test(rawSerial)
          ? rawSerial + '#' + result.length
          : rawSerial;
    if (match[2] !== 'no permissions') assertSerial(serial);
    result.push({
      serial,
      kind: serial.startsWith('emulator-')
        ? 'EMULATOR'
        : serial.includes(':') || serial.includes('._tcp')
          ? 'TCP'
          : 'USB',
      state: (
        {
          device: 'CONNECTED',
          unauthorized: 'UNAUTHORIZED',
          offline: 'OFFLINE',
          'no permissions': 'NO_PERMISSIONS',
        } as const
      )[match[2] as 'device'],
      metadata: null,
    });
  }
  if (new Set(result.map((d) => d.serial)).size !== result.length)
    throw new DomainError('ADB_DEVICE_LIST', 'Transport serial trùng trong response.');
  return result;
}
export function parseProperties(text: string): DeviceMetadata {
  const values = new Map<string, string>();
  for (const line of text.split(/\r?\n/)) {
    const m = /^\[([^\]]+)\]: \[(.*)\]$/.exec(line);
    if (m) values.set(m[1]!, m[2]!);
  }
  const serial = [values.get('ro.serialno'), values.get('ro.boot.serialno')].find(
    (s) => s && s.length >= 4 && !/^(unknown|null|0+)$/i.test(s),
  );
  const sdk = Number(values.get('ro.build.version.sdk'));
  if (!Number.isInteger(sdk) || sdk < 16 || sdk > 1000 || !values.get('ro.product.model'))
    throw new DomainError('ADB_PROPERTIES', 'Thiết bị chưa trả đủ metadata hợp lệ.');
  return {
    hardwareSerial: serial ?? null,
    manufacturer: values.get('ro.product.manufacturer') ?? '',
    model: values.get('ro.product.model')!,
    product: values.get('ro.product.device') ?? '',
    androidVersion: values.get('ro.build.version.release') ?? '',
    sdk,
    locale: values.get('persist.sys.locale') ?? values.get('ro.product.locale') ?? '',
  };
}
export function deviceFingerprint(
  metadata: DeviceMetadata | null,
  hostId: string,
  serial: string,
): { fingerprint: string; provisional: boolean } {
  const verified = Boolean(metadata?.hardwareSerial && metadata.manufacturer && metadata.product);
  const evidence = verified
    ? {
        serial: metadata!.hardwareSerial,
        manufacturer: metadata!.manufacturer,
        product: metadata!.product,
      }
    : { hostId, transport: serial };
  return {
    fingerprint: createHash('sha256').update(JSON.stringify(evidence)).digest('hex'),
    provisional: !verified,
  };
}

/** Only a trusted host worker may supply this app-owned staged file. */
export interface OwnedSyncInput {
  serial: string;
  localPath: string;
  jobId: string;
  ordinal: number;
  nonce: string;
  expectedHash: string;
  expectedBytes: number;
}
export interface OwnedSyncAck {
  status: 'SYNC_ACK_UNVERIFIED';
  remotePath: string;
  bytes: number;
  /** ADB Sync ACK is NOT MediaStore index or post verification. */
  canDispatch: false;
}
const syncExtensions = ownedStageExtensions;
const MAX_SYNC_BYTES = 512 * 1024 * 1024;
async function sendPacket(socket: Socket, bytes: Buffer, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) throw new DomainError('CANCELLED', 'Staging transfer cancelled.');
  if (socket.destroyed) throw new DomainError('ADB_CONNECTION', 'ADB transport closed.');
  if (socket.write(bytes)) return;
  await new Promise<void>((resolve, reject) => {
    const done = (error?: Error): void => {
      socket.off('drain', drained);
      socket.off('close', closed);
      socket.off('error', failed);
      signal?.removeEventListener('abort', aborted);
      if (error) reject(error);
      else resolve();
    };
    const drained = () => done();
    const closed = () => done(new DomainError('ADB_CONNECTION', 'ADB Sync transport closed.'));
    const failed = () => done(new DomainError('ADB_CONNECTION', 'ADB Sync transport failed.'));
    const aborted = () => done(new DomainError('CANCELLED', 'ADB Sync was cancelled.'));
    socket.once('drain', drained);
    socket.once('close', closed);
    socket.once('error', failed);
    signal?.addEventListener('abort', aborted, { once: true });
    if (socket.destroyed || signal?.aborted) aborted();
  });
}
function syncHeader(op: 'SEND' | 'DATA' | 'DONE' | 'RECV' | 'STAT', size: number): Buffer {
  const result = Buffer.alloc(8);
  result.write(op, 0, 'ascii');
  result.writeUInt32LE(size, 4);
  return result;
}

export class AdbClient {
  constructor(
    readonly port = 5037,
    private beforeDispatch?: () => Promise<void>,
  ) {}
  scoped(beforeDispatch: () => Promise<void>): AdbClient {
    return new AdbClient(this.port, beforeDispatch);
  }
  async diagnostic(signal?: AbortSignal): Promise<number> {
    const version = await serverVersion(this.port, signal);
    if (version !== 41)
      throw new DomainError(
        'ADB_SERVER_MISMATCH',
        'ADB server protocol chưa được hỗ trợ; giữ nguyên server hiện có.',
      );
    return version;
  }
  private async host(service: string, signal?: AbortSignal): Promise<string> {
    await this.diagnostic(signal);
    const c = new AdbConnection(this.port, 10000, 1024 * 1024, signal);
    try {
      await c.request(service);
      return await c.protocolString();
    } finally {
      c.close();
    }
  }
  async devices(signal?: AbortSignal): Promise<TransportObservation[]> {
    return parseDevices(await this.host('host:devices-l', signal));
  }
  async connect(endpoint: string, signal?: AbortSignal): Promise<string> {
    const result = await this.host('host:connect:' + parseEndpoint(endpoint), signal);
    const match = /^(?:already )?connected to ([^\s]+)\s*$/i.exec(result.trim());
    if (!match || /failed|unable|cannot/i.test(result))
      throw new DomainError(
        'ADB_CONNECT_FAILED',
        'ADB chưa kết nối được endpoint; kiểm tra Wireless debugging và cổng kết nối.',
      );
    return parseEndpoint(match[1]!);
  }
  async pair(endpoint: string, code: string, signal?: AbortSignal): Promise<void> {
    if (!/^\d{6}$/.test(code))
      throw new DomainError('INVALID_PAIR_CODE', 'Mã ghép đôi phải có 6 chữ số.');
    const result = await this.host('host:pair:' + code + ':' + parseEndpoint(endpoint), signal);
    if (!/successfully paired/i.test(result))
      throw new DomainError(
        'ADB_PAIR_FAILED',
        'Không ghép đôi được; kiểm tra mã và cổng ghép đôi.',
      );
  }
  async disconnect(serial: string, signal?: AbortSignal): Promise<void> {
    assertSerial(serial);
    if (!serial.includes(':') && !serial.includes('._tcp'))
      throw new DomainError('INVALID_ENDPOINT', 'Chỉ ngắt network transport cụ thể.');
    const result = await this.host('host:disconnect:' + serial, signal);
    if (!/disconnected|no such device/i.test(result))
      throw new DomainError('ADB_DISCONNECT_FAILED', 'Chưa xác minh được transport đã ngắt.');
  }
  private async device(
    serial: string,
    service: string,
    budget: number,
    signal?: AbortSignal,
    timeoutMs = 15000,
  ): Promise<AdbConnection> {
    assertSerial(serial);
    await this.diagnostic(signal);
    const c = new AdbConnection(this.port, timeoutMs, budget, signal);
    try {
      await c.request('host:transport:' + serial);
      await this.beforeDispatch?.();
      await c.request(service);
      return c;
    } catch (error) {
      c.close();
      throw error;
    }
  }
  private async shell(serial: string, args: string[], signal?: AbortSignal): Promise<Buffer> {
    const c = await this.device(
        serial,
        'shell,v2,raw:' + args.map(quoteAndroidArg).join(' '),
        4 * 1024 * 1024,
        signal,
      ),
      stdout: Buffer[] = [];
    try {
      c.socket.write(Buffer.from([4, 0, 0, 0, 0]));
      while (true) {
        const header = await c.read(5),
          channel = header[0],
          length = header.readUInt32LE(1);
        if (length > 1024 * 1024) throw new DomainError('ADB_PROTOCOL', 'Shell frame vượt budget.');
        const data = await c.read(length);
        if (channel === 1) stdout.push(data);
        else if (channel === 2) {
          /* stderr is intentionally not exported; it can contain device/private values. */
        } else if (channel === 3) {
          if ((length !== 1 && length !== 4) || data.readUInt8(0) !== 0)
            throw new DomainError(
              'ADB_COMMAND_FAILED',
              'Lệnh thiết bị báo lỗi; không tự thử lại thao tác nhập.',
            );
          return Buffer.concat(stdout);
        } else throw new DomainError('ADB_PROTOCOL', 'Shell v2 channel không được hỗ trợ.');
      }
    } finally {
      c.close();
    }
  }
  /**
   * ADB Sync v1 byte transfer; no public IPC, no MediaStore index, no posting
   * success. The caller must persist remote ownership before invoking this.
   */
  async sendOwnedStage(input: OwnedSyncInput, signal?: AbortSignal): Promise<OwnedSyncAck> {
    if (!this.beforeDispatch)
      throw new DomainError('ADB_STAGE_LEASE_REQUIRED', 'A fenced JOB owner is required.');
    assertSerial(input.serial);
    idSchema.parse(input.jobId);
    hashSchema.parse(input.expectedHash);
    if (!/^[a-f0-9]{32}$/.test(input.nonce) ||
        !Number.isSafeInteger(input.ordinal) || input.ordinal < 0 || input.ordinal >= 32 ||
        !Number.isSafeInteger(input.expectedBytes) || input.expectedBytes <= 0 ||
        input.expectedBytes > MAX_SYNC_BYTES)
      throw new DomainError('ADB_SYNC_INVALID', 'Invalid owned staged asset specification.');
    if (!isAbsolute(input.localPath))
      throw new DomainError('ADB_SYNC_SOURCE', 'Stage path must be app-owned and absolute.');
    const sourcePath = resolve(input.localPath),
      extension = extname(sourcePath).toLowerCase(),
      ordinalText = String(input.ordinal).padStart(3, '0');
    if (!syncExtensions.has(extension) ||
        basename(sourcePath) !== 'asset-' + ordinalText + extension ||
        basename(dirname(sourcePath)) !== 'job-' + input.jobId ||
        basename(dirname(dirname(sourcePath))) !== 'owned-media-stage')
      throw new DomainError('ADB_SYNC_SOURCE', 'Only an app-owned job stage file is admissible.');
    // Do not compare realpath strings: Windows can alter drive-letter case
    // and normalize segments without changing which file was opened.
    // Reject symlinked file *and* job/staging directories by inode metadata.
    const stats = await lstat(sourcePath),
      jobDir = await lstat(dirname(sourcePath)),
      stageDir = await lstat(dirname(dirname(sourcePath)));
    if (!stats.isFile() || stats.isSymbolicLink() || stats.size !== input.expectedBytes ||
        !jobDir.isDirectory() || jobDir.isSymbolicLink() ||
        !stageDir.isDirectory() || stageDir.isSymbolicLink())
      throw new DomainError('ADB_SYNC_SOURCE', 'Local staged file is not a stable regular file.');

    const handle = await open(sourcePath, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
    try {
      const before = await handle.stat();
      if (!before.isFile() || before.size !== input.expectedBytes ||
          before.ino !== stats.ino || before.dev !== stats.dev ||
          before.mtimeMs !== stats.mtimeMs)
        throw new DomainError('ADB_SYNC_SOURCE', 'Staged file identity changed before upload.');
      const block = Buffer.allocUnsafe(64 * 1024);
      const hashFile = async (): Promise<string> => {
        const digest = createHash('sha256');
        let offset = 0;
        while (offset < input.expectedBytes) {
          if (signal?.aborted) throw new DomainError('CANCELLED', 'ADB Sync was cancelled.');
          const { bytesRead } = await handle.read(
            block, 0, Math.min(block.length, input.expectedBytes - offset), offset,
          );
          if (!bytesRead) throw new DomainError('ADB_SYNC_SOURCE', 'Staged bytes ended early.');
          digest.update(block.subarray(0, bytesRead));
          offset += bytesRead;
        }
        return digest.digest('hex');
      };
      // Verify *before* Android input, then hash the actual bytes once more as
      // they are transmitted. Any mutation means an unknown remote side effect.
      if (await hashFile() !== input.expectedHash)
        throw new DomainError('ADB_SYNC_SOURCE_HASH', 'Local staged bytes do not match snapshot.');
      const fresh = await handle.stat();
      if (fresh.size !== before.size || fresh.mtimeMs !== before.mtimeMs ||
          fresh.ino !== before.ino || fresh.dev !== before.dev)
        throw new DomainError('ADB_SYNC_SOURCE', 'Staged file changed while verifying.');

      const location = ownedStageLocation({
        jobId: input.jobId, ordinal: input.ordinal, nonce: input.nonce, extension,
      });
      const folder = location.remoteDirectory, remotePath = location.remotePath;
      // Shell command arguments are quoted by the existing restricted shell
      // provider. No generic path from renderer or user inputs is accepted.
      await this.shell(input.serial, ['mkdir', '-p', folder], signal);
      const connection = await this.device(input.serial, 'sync:', 64 * 1024, signal, 180000);
      try {
        const setup = Buffer.from(remotePath + ',' + String(0o100644), 'utf8');
        await sendPacket(
          connection.socket,
          Buffer.concat([syncHeader('SEND', setup.length), setup]),
          signal,
        );
        const digest = createHash('sha256');
        let offset = 0;
        let nextFence = 1024 * 1024;
        const deadline = Date.now() + 180000;
        while (offset < input.expectedBytes) {
          if (signal?.aborted) throw new DomainError('CANCELLED', 'ADB Sync was cancelled.');
          if (Date.now() >= deadline)
            throw new DomainError('ADB_SYNC_TIMEOUT', 'ADB Sync exceeded its transfer budget.');
          if (offset >= nextFence) {
            await this.beforeDispatch();
            nextFence = offset + 1024 * 1024;
          }
          const { bytesRead } = await handle.read(
            block, 0, Math.min(block.length, input.expectedBytes - offset), offset,
          );
          if (!bytesRead) throw new DomainError('ADB_SYNC_SOURCE', 'Staged bytes ended early.');
          digest.update(block.subarray(0, bytesRead));
          await sendPacket(connection.socket, syncHeader('DATA', bytesRead), signal);
          await sendPacket(connection.socket, Buffer.from(block.subarray(0, bytesRead)), signal);
          offset += bytesRead;
        }
        if (digest.digest('hex') !== input.expectedHash)
          throw new DomainError('ADB_SYNC_SOURCE_HASH', 'Staged file changed during upload.');
        const after = await handle.stat(),
          pathAgain = await lstat(sourcePath);
        if (after.size !== before.size || after.mtimeMs !== before.mtimeMs ||
            after.ino !== before.ino || after.dev !== before.dev ||
            pathAgain.ino !== before.ino || pathAgain.dev !== before.dev)
          throw new DomainError('ADB_SYNC_SOURCE', 'Staged source changed during upload.');
        await this.beforeDispatch();
        const mtime = Math.floor(before.mtimeMs / 1000);
        if (!Number.isSafeInteger(mtime) || mtime < 0 || mtime > 0xffffffff)
          throw new DomainError('ADB_SYNC_SOURCE', 'Invalid staged file timestamp.');
        await sendPacket(connection.socket, syncHeader('DONE', mtime), signal);
        const status = await connection.read(8);
        const kind = status.toString('ascii', 0, 4), length = status.readUInt32LE(4);
        if (kind === 'FAIL') {
          if (length > 4096)
            throw new DomainError('ADB_SYNC_PROTOCOL', 'ADB Sync failure frame exceeds budget.');
          await connection.read(length);
          throw new DomainError('ADB_SYNC_FAILED', 'ADB Sync rejected the staged file.');
        }
        if (kind !== 'OKAY' || length !== 0)
          throw new DomainError('ADB_SYNC_PROTOCOL', 'ADB Sync completion was not confirmed.');
        return {
          status: 'SYNC_ACK_UNVERIFIED', remotePath, bytes: input.expectedBytes,
          canDispatch: false,
        };
      } finally {
        connection.close();
      }
    } finally {
      await handle.close();
    }
  }

  /**
   * Reads back an owned remote stage through ADB Sync RECV and hashes bytes
   * in-stream. This proves byte equality only, never MediaStore indexing.
   */
  async readOwnedStage(input: {
    serial: string;
    jobId: string;
    ordinal: number;
    nonce: string;
    extension: string;
    expectedHash: string;
    expectedBytes: number;
  }, signal?: AbortSignal): Promise<{ remotePath: string; hash: string; bytes: number }> {
    if (!this.beforeDispatch)
      throw new DomainError('ADB_STAGE_LEASE_REQUIRED', 'A fenced JOB owner is required.');
    assertSerial(input.serial);
    idSchema.parse(input.jobId);
    hashSchema.parse(input.expectedHash);
    const extension = input.extension.toLowerCase();
    if (!syncExtensions.has(extension) ||
        !/^[a-f0-9]{32}$/.test(input.nonce) ||
        !Number.isSafeInteger(input.ordinal) || input.ordinal < 0 || input.ordinal >= 32 ||
        !Number.isSafeInteger(input.expectedBytes) || input.expectedBytes <= 0 ||
        input.expectedBytes > MAX_SYNC_BYTES)
      throw new DomainError('ADB_SYNC_INVALID', 'Invalid remote stage readback specification.');
    const { remotePath } = ownedStageLocation({
      jobId: input.jobId, ordinal: input.ordinal, nonce: input.nonce, extension,
    });
    if (signal?.aborted) throw new DomainError('CANCELLED', 'Remote readback cancelled.');
    await this.beforeDispatch();
    // Budget includes both ADB OKAY responses, DATA headers and final DONE.
    const frameCount = Math.ceil(input.expectedBytes / (64 * 1024));
    const budget = input.expectedBytes + frameCount * 8 + 16;
    const connection = await this.device(input.serial, 'sync:', budget, signal, 180000);
    try {
      const request = Buffer.from(remotePath, 'utf8');
      if (request.length > 1024)
        throw new DomainError('ADB_SYNC_INVALID', 'Generated remote path exceeds protocol budget.');
      await sendPacket(connection.socket, syncHeader('RECV', request.length), signal);
      await sendPacket(connection.socket, request, signal);
      const digest = createHash('sha256');
      let received = 0;
      let nextFence = 1024 * 1024;
      const deadline = Date.now() + 180000;
      while (true) {
        if (signal?.aborted) throw new DomainError('CANCELLED', 'Remote readback cancelled.');
        if (Date.now() >= deadline)
          throw new DomainError('ADB_SYNC_TIMEOUT', 'Remote readback exceeded its time budget.');
        const header = await connection.read(8);
        const op = header.toString('ascii', 0, 4);
        const length = header.readUInt32LE(4);
        if (op === 'FAIL') {
          if (length > 4096)
            throw new DomainError('ADB_SYNC_PROTOCOL', 'ADB Sync failure frame exceeds budget.');
          // Consume bounded text without exporting remote/private path details.
          await connection.read(length);
          throw new DomainError('ADB_SYNC_READ_FAILED', 'ADB could not read the owned remote stage.');
        }
        if (op === 'DONE') {
          if (length !== 0)
            throw new DomainError('ADB_SYNC_PROTOCOL', 'ADB Sync DONE frame is malformed.');
          break;
        }
        if (op !== 'DATA' || length < 1 || length > 64 * 1024 ||
            received + length > input.expectedBytes)
          throw new DomainError('ADB_SYNC_PROTOCOL', 'ADB Sync DATA frame is invalid or over budget.');
        const bytes = await connection.read(length);
        digest.update(bytes);
        received += length;
        if (received >= nextFence) {
          await this.beforeDispatch();
          nextFence = received + 1024 * 1024;
        }
      }
      const hash = digest.digest('hex');
      if (received !== input.expectedBytes)
        throw new DomainError('ADB_SYNC_READ_LENGTH', 'Remote byte count does not match the pinned asset.');
      if (hash !== input.expectedHash)
        throw new DomainError('ADB_SYNC_READ_HASH', 'Remote bytes do not match the pinned asset hash.');
      await this.beforeDispatch();
      return { remotePath, hash, bytes: received };
    } finally {
      connection.close();
    }
  }

  /**
   * S102.2: non-destructive ADB Sync v1 STAT of the exact app-owned remote
   * stage. A missing remote file is only an observation, never proof that a
   * cleanup command ran or that MediaStore/provider state is reconciled.
   * Requires a trusted, freshly fenced client; no shell/rm/unlink is invoked.
   */
  async statOwnedStage(input: {
    serial: string;
    jobId: string;
    ordinal: number;
    nonce: string;
    extension: string;
    expectedBytes: number;
  }, signal?: AbortSignal): Promise<{
    status: 'REMOTE_PRESENT_OBSERVED' | 'REMOTE_ABSENT_OBSERVED';
    remotePath: string;
    observedBytes: number | null;
    matchesExpectedBytes: boolean;
    canDelete: false;
    canMarkClean: false;
  }> {
    if (!this.beforeDispatch)
      throw new DomainError('ADB_STAGE_LEASE_REQUIRED',
        'Trusted current device fence required before remote existence check.');
    assertSerial(input.serial);
    idSchema.parse(input.jobId);
    if (!Number.isSafeInteger(input.ordinal) ||
        input.ordinal < 0 || input.ordinal >= 32 ||
        typeof input.extension !== 'string' ||
        input.extension !== input.extension.toLowerCase() ||
        !syncExtensions.has(input.extension) ||
        typeof input.nonce !== 'string' || !/^[a-f0-9]{32}$/.test(input.nonce) ||
        !Number.isSafeInteger(input.expectedBytes) || input.expectedBytes <= 0 ||
        input.expectedBytes > MAX_SYNC_BYTES)
      throw new DomainError('ADB_OWNED_STAT_INVALID', 'Invalid owned-stage identity or byte budget.');
    const { remotePath } = ownedStageLocation({
      jobId: input.jobId, ordinal: input.ordinal,
      nonce: input.nonce, extension: input.extension,
    });
    const encodedPath = Buffer.from(remotePath, 'utf8');
    if (encodedPath.byteLength > 1024)
      throw new DomainError('ADB_OWNED_STAT_INVALID', 'Owned path exceeds Sync protocol budget.');
    if (signal?.aborted)
      throw new DomainError('CANCELLED', 'Remote existence inspection cancelled.');
    await this.beforeDispatch();
    const connection = await this.device(input.serial, 'sync:', 2048, signal);
    try {
      await sendPacket(connection.socket, syncHeader('STAT', encodedPath.length), signal);
      await sendPacket(connection.socket, encodedPath, signal);
      const frame = await connection.read(16);
      if (frame.toString('ascii', 0, 4) !== 'STAT')
        throw new DomainError('ADB_OWNED_STAT_PROTOCOL', 'Unexpected Android Sync STAT response.');
      const mode = frame.readUInt32LE(4),
        size = frame.readUInt32LE(8),
        mtime = frame.readUInt32LE(12);
      if (mode === 0) {
        // Sync v1 signals a missing path with three zero fields. Do not infer
        // absence from FAIL, permission denied, malformed response or timeout.
        if (size !== 0 || mtime !== 0)
          throw new DomainError('ADB_OWNED_STAT_PROTOCOL',
            'Contradictory missing-file response.');
        await this.beforeDispatch();
        return {
          status: 'REMOTE_ABSENT_OBSERVED', remotePath,
          observedBytes: null, matchesExpectedBytes: false,
          canDelete: false, canMarkClean: false,
        };
      }
      // Never treat a directory, symlink, device or unknown type as a staged
      // regular file, even when its reported size matches the frozen bytes.
      if ((mode & 0o170000) !== 0o100000)
        throw new DomainError('ADB_OWNED_STAT_TYPE',
          'Remote owned path is not a regular file.');
      await this.beforeDispatch();
      return {
        status: 'REMOTE_PRESENT_OBSERVED', remotePath,
        observedBytes: size, matchesExpectedBytes: size === input.expectedBytes,
        canDelete: false, canMarkClean: false,
      };
    } finally {
      connection.close();
    }
  }

  /** Read-only, bounded MediaStore query for a deterministic owned filename. */
  async probeOwnedStageMediaStore(input: {
    serial: string; jobId: string; ordinal: number; nonce: string; extension: string; expectedBytes: number;
  }, signal?: AbortSignal): Promise<
    | { status: 'INDEXED_EXACT'; rowId: string; displayName: string; relativePath: string; mimeType: string; bytes: number }
    | { status: 'NOT_INDEXED' | 'AMBIGUOUS' | 'UNSUPPORTED' }
  > {
    if (!this.beforeDispatch)
      throw new DomainError('ADB_STAGE_LEASE_REQUIRED', 'A fenced JOB owner is required.');
    assertSerial(input.serial);
    idSchema.parse(input.jobId);
    const extension = input.extension.toLowerCase();
    if (!syncExtensions.has(extension) || !/^[a-f0-9]{32}$/.test(input.nonce) ||
        !Number.isSafeInteger(input.ordinal) || input.ordinal < 0 || input.ordinal >= 32 ||
        !Number.isSafeInteger(input.expectedBytes) || input.expectedBytes <= 0 ||
        input.expectedBytes > MAX_SYNC_BYTES)
      throw new DomainError('ADB_MEDIASTORE_INVALID', 'Invalid owned MediaStore probe specification.');
    const { displayName: filename, relativePath } = ownedStageLocation({
      jobId: input.jobId, ordinal: input.ordinal, nonce: input.nonce, extension,
    });
    const where = "_display_name='" + filename + "' AND relative_path='" + relativePath +
      "' AND _size=" + String(input.expectedBytes);
    let raw: string;
    try {
      raw = (await this.shell(input.serial, [
        'content', 'query', '--uri', 'content://media/external/file',
        '--projection', '_id:_display_name:relative_path:_size:mime_type',
        '--where', where,
      ], signal)).toString('utf8');
    } catch (error) {
      if (error instanceof DomainError && error.code === 'ADB_COMMAND_FAILED')
        return { status: 'UNSUPPORTED' };
      throw error;
    }
    if (Buffer.byteLength(raw) > 32 * 1024)
      throw new DomainError('ADB_MEDIASTORE_OUTPUT_LIMIT', 'MediaStore response exceeds bounded output.');
    if (/permission denied|not allowed|unknown column|unsupported|securityexception|exception/i.test(raw))
      return { status: 'UNSUPPORTED' };
    if (/no result found|no rows/i.test(raw.trim())) return { status: 'NOT_INDEXED' };
    const lines = raw.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    if (!lines.length || lines.some((line) => !/^Row: \d+\s/.test(line)))
      return { status: 'UNSUPPORTED' };
    if (lines.length > 1) return { status: 'AMBIGUOUS' };
    const line = lines[0]!.replace(/^Row: \d+\s*/, '');
    const field = (key: string): string | null =>
      new RegExp('(?:^|,\\s*)' + key + '=([^,]*)').exec(line)?.[1]?.trim() ?? null;
    const rowId = field('_id'), displayName = field('_display_name');
    const observedPath = field('relative_path'), sizeText = field('_size'), mimeType = field('mime_type');
    const bytes = sizeText && /^\d+$/.test(sizeText) ? Number(sizeText) : NaN;
    const family = /^\.(?:jpg|jpeg|png|webp|gif|bmp)$/.test(extension) ? 'image/' : 'video/';
    if (!rowId || !/^\d+$/.test(rowId) || !displayName || !observedPath || !mimeType ||
        !mimeType.startsWith(family) || displayName !== filename ||
        observedPath.replace(/^\/+/, '') !== relativePath ||
        !Number.isSafeInteger(bytes) || bytes !== input.expectedBytes)
      return { status: 'UNSUPPORTED' };
    await this.beforeDispatch();
    return { status: 'INDEXED_EXACT', rowId, displayName, relativePath: observedPath, mimeType, bytes };
  }

  async uiXml(serial: string, signal?: AbortSignal): Promise<string> {
    const path = '/data/local/tmp/autoreels-inspector-' + randomUUID() + '.xml';
    let result: string | undefined,
      cleanupFailed = false;
    try {
      await this.shell(serial, ['uiautomator', 'dump', '--compressed', path], signal);
      result = (await this.shell(serial, ['cat', path], signal)).toString('utf8');
      if (Buffer.byteLength(result) > 2 * 1024 * 1024)
        throw new DomainError('INSPECTOR_XML', 'XML vượt giới hạn.');
    } finally {
      try {
        await this.shell(serial, ['rm', '-f', path], AbortSignal.timeout(2000));
      } catch {
        cleanupFailed = true;
      }
    }
    if (cleanupFailed)
      throw new DomainError(
        'INSPECTOR_CLEANUP_REQUIRED',
        'Chưa dọn được XML tạm của lượt Inspector; kết nối lại trước khi thử.',
      );
    return result;
  }
  async metadata(serial: string, signal?: AbortSignal): Promise<DeviceMetadata> {
    return parseProperties((await this.shell(serial, ['getprop'], signal)).toString('utf8'));
  }
  async packages(serial: string, signal?: AbortSignal): Promise<string[]> {
    const text = (await this.shell(serial, ['pm', 'list', 'packages'], signal)).toString('utf8');
    return text
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => {
        if (!line.startsWith('package:') || !packageNameSchema.safeParse(line.slice(8)).success)
          throw new DomainError('ADB_PACKAGES', 'Danh sách package không hợp lệ.');
        return line.slice(8);
      })
      .sort();
  }
  async foreground(serial: string, signal?: AbortSignal): Promise<string | null> {
    const text = (await this.shell(serial, ['dumpsys', 'activity', 'activities'], signal)).toString(
      'utf8',
    );
    const match = /(?:mResumedActivity|topResumedActivity).*?\s([A-Za-z][\w.]+)\/[\w.$]+/.exec(
      text,
    );
    return match?.[1] ?? null;
  }
  async rotation(serial: string, signal?: AbortSignal): Promise<number> {
    const text = (await this.shell(serial, ['dumpsys', 'input'], signal)).toString('utf8'),
      match = /SurfaceOrientation:\s*([0-3])\b/.exec(text);
    if (!match)
      throw new DomainError(
        'DEVICE_GEOMETRY_UNAVAILABLE',
        'Chưa xác định được orientation; chỉ dùng phím và quick actions.',
      );
    return Number(match[1]);
  }
  async screenshot(
    serial: string,
    signal?: AbortSignal,
  ): Promise<{ bytes: Buffer; width: number; height: number }> {
    const c = await this.device(serial, 'exec:screencap -p', 16 * 1024 * 1024, signal);
    try {
      const bytes = await c.all();
      if (
        bytes.length < 33 ||
        !bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) ||
        bytes.toString('ascii', 12, 16) !== 'IHDR'
      )
        throw new DomainError('ADB_SCREENSHOT', 'Thiết bị không trả PNG hợp lệ.');
      const width = bytes.readUInt32BE(16),
        height = bytes.readUInt32BE(20);
      if (!width || !height || width > 8192 || height > 8192 || width * height > 32000000)
        throw new DomainError('ADB_SCREENSHOT', 'Kích thước ảnh thiết bị vượt budget.');
      return { bytes, width, height };
    } finally {
      c.close();
    }
  }
  async tap(serial: string, x: number, y: number, signal?: AbortSignal): Promise<void> {
    this.coordinates(x, y);
    await this.shell(serial, ['input', 'tap', String(x), String(y)], signal);
  }
  async swipe(
    serial: string,
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    duration: number,
    signal?: AbortSignal,
  ): Promise<void> {
    this.coordinates(x1, y1);
    this.coordinates(x2, y2);
    if (!Number.isInteger(duration) || duration < 50 || duration > 10000)
      throw new DomainError('INVALID_GESTURE', 'Thời gian vuốt từ 50–10000ms.');
    await this.shell(
      serial,
      ['input', 'swipe', String(x1), String(y1), String(x2), String(y2), String(duration)],
      signal,
    );
  }
  private coordinates(x: number, y: number): void {
    if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x > 8191 || y > 8191)
      throw new DomainError('INVALID_COORDINATES', 'Tọa độ không hợp lệ.');
  }
  async key(
    serial: string,
    key: 'BACK' | 'HOME' | 'RECENT' | 'POWER' | 'VOLUME_UP' | 'VOLUME_DOWN',
    signal?: AbortSignal,
  ): Promise<void> {
    const code = { BACK: 4, HOME: 3, RECENT: 187, POWER: 26, VOLUME_UP: 24, VOLUME_DOWN: 25 }[key];
    if (!code) throw new DomainError('INVALID_KEY', 'Phím không được hỗ trợ.');
    await this.shell(serial, ['input', 'keyevent', String(code)], signal);
  }
  async launch(serial: string, packageName: string, signal?: AbortSignal): Promise<void> {
    packageNameSchema.parse(packageName);
    const component = (
      await this.shell(
        serial,
        ['cmd', 'package', 'resolve-activity', '--brief', packageName],
        signal,
      )
    )
      .toString('utf8')
      .trim()
      .split(/\r?\n/)
      .at(-1)!;
    if (
      !/^[A-Za-z][\w.]+\/[A-Za-z_.$][\w.$]*$/.test(component) ||
      component.split('/')[0] !== packageName
    )
      throw new DomainError('APP_NOT_LAUNCHABLE', 'Package không có launcher activity hợp lệ.');
    await this.shell(serial, ['am', 'start', '-W', '-n', component], signal);
    if ((await this.foreground(serial, signal)) !== packageName)
      throw new DomainError(
        'APP_OPEN_UNVERIFIED',
        'Đã yêu cầu mở app nhưng chưa xác minh foreground; không tự bấm lại.',
      );
  }
  async forceStop(serial: string, packageName: string, signal?: AbortSignal): Promise<void> {
    packageNameSchema.parse(packageName);
    const user = (await this.shell(serial, ['am', 'get-current-user'], signal))
      .toString('utf8')
      .trim();
    if (!/^\d{1,5}$/.test(user))
      throw new DomainError('APP_STOP_UNVERIFIED', 'Không xác định được Android user hiện tại.');
    await this.shell(serial, ['am', 'force-stop', '--user', user, packageName], signal);
    const detail = (await this.shell(serial, ['dumpsys', 'package', packageName], signal)).toString(
        'utf8',
      ),
      line = detail.split(/\r?\n/).find((row) => new RegExp('User ' + user + ':').test(row));
    if (!line || !/(?:^|\s)stopped=true(?:\s|$)/.test(line))
      throw new DomainError(
        'APP_STOP_UNVERIFIED',
        'Chưa xác minh package stopped flag trên đúng Android user.',
      );
  }
  async system(
    serial: string,
    target: 'SETTINGS' | 'FILES' | 'GALLERY' | 'BROWSER' | 'VPN',
    signal?: AbortSignal,
  ): Promise<void> {
    const intents = {
      SETTINGS: ['android.settings.SETTINGS'],
      FILES: ['android.intent.action.OPEN_DOCUMENT', '*/*'],
      GALLERY: ['android.intent.action.VIEW', 'image/*'],
      BROWSER: ['android.intent.action.MAIN', 'android.intent.category.APP_BROWSER'],
      VPN: ['android.settings.VPN_SETTINGS'],
    }[target];
    if (!intents) throw new DomainError('INVALID_TARGET', 'Quick action không hợp lệ.');
    const args = ['am', 'start', '-W', '-a', intents[0]!];
    if (target === 'FILES' || target === 'GALLERY') args.push('-t', intents[1]!);
    if (target === 'BROWSER') args.push('-c', intents[1]!);
    const output = (await this.shell(serial, args, signal)).toString('utf8');
    if (/Error:|Exception|unable to resolve/i.test(output))
      throw new DomainError('SYSTEM_ACTION_UNAVAILABLE', 'Thiết bị không hỗ trợ intent này.');
  }
}
