import { constants } from 'node:fs';
import {
  lstat, mkdir, mkdtemp, open, readFile, readdir, realpath, rename, rm, stat, statfs,
} from 'node:fs/promises';
import { extname, join, relative, resolve, sep } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { assertJsonSafe, hashSchema, idSchema } from '@autoreels/contracts';
import type { JobMediaPreflightPlan } from '@autoreels/contracts';
import { contentHash, DomainError } from '@autoreels/domain';
import { fingerprint, mediaKind, resolveGrantedFile } from './index.js';

type Entry = { ordinal: number; assetId: string; name: string; hash: string; bytes: number };
type Body = {
  format: 'autoreels-host-stage-v1';
  hostId: string;
  jobId: string;
  jobRevision: number;
  snapshotHash: string;
  createdAt: string;
  entries: Entry[];
};
type Manifest = Body & { digest: string };
export interface HostStageResult {
  jobId: string;
  scope: 'HOST_STAGED_NOT_ANDROID';
  status: 'CREATED' | 'REUSED' | 'NO_MEDIA';
  mediaCount: number;
  canDispatch: false;
}
const MAX_FILES = 32;
const MAX_FILE_BYTES = 4 * 1024 * 1024 * 1024;
const MAX_TOTAL_BYTES = 8 * 1024 * 1024 * 1024;
const MIN_FREE_RESERVE = 64 * 1024 * 1024;
const MAX_MANIFEST_BYTES = 65536;
const allowedExtensions = new Set([
  '.mp4', '.mov', '.mkv', '.webm', '.m4v', '.avi',
  '.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp',
]);
const isCode = (error: unknown, code: string): boolean =>
  !!error && typeof error === 'object' && 'code' in error && error.code === code;
const result = (jobId: string, status: HostStageResult['status'], mediaCount: number): HostStageResult =>
  ({ jobId, status, mediaCount, scope: 'HOST_STAGED_NOT_ANDROID', canDispatch: false });
const inside = (base: string, child: string): boolean => {
  const path = relative(base, child);
  return path !== '' && path !== '..' && !path.startsWith('..' + sep) && !path.startsWith(sep);
};
function fileName(index: number, path: string): string {
  const ext = extname(path).toLowerCase();
  if (!allowedExtensions.has(ext) || !mediaKind('file' + ext))
    throw new DomainError('STAGE_FILE_TYPE', 'Unsupported registered media type.');
  return 'asset-' + String(index).padStart(3, '0') + ext;
}
function validatePlan(plan: JobMediaPreflightPlan, hostId: string): number {
  idSchema.parse(hostId);
  idSchema.parse(plan.jobId);
  hashSchema.parse(plan.snapshotHash);
  if (!Number.isSafeInteger(plan.jobRevision) || plan.jobRevision < 0 ||
      plan.entries.length > MAX_FILES)
    throw new DomainError('STAGE_LIMIT', 'Invalid staging revision or asset limit.');
  let total = 0;
  const ids = new Set<string>();
  for (const entry of plan.entries) {
    idSchema.parse(entry.assetId);
    hashSchema.parse(entry.pinnedHash);
    if (ids.has(entry.assetId) ||
        !Number.isSafeInteger(entry.pinnedBytes) ||
        entry.pinnedBytes <= 0 || entry.pinnedBytes > MAX_FILE_BYTES)
      throw new DomainError('STAGE_LIMIT', 'Invalid or duplicate pinned staging asset.');
    ids.add(entry.assetId);
    total += entry.pinnedBytes;
    if (total > MAX_TOTAL_BYTES)
      throw new DomainError('STAGE_LIMIT', 'Job staging exceeds aggregate resource budget.');
    if (entry.binding.assetId !== entry.assetId ||
        entry.binding.grant.hostId !== hostId ||
        !entry.binding.grant.active ||
        entry.binding.expectedHash !== entry.pinnedHash ||
        entry.binding.observedHash !== entry.pinnedHash ||
        entry.binding.state !== 'READY')
      throw new DomainError('STAGE_BINDING_INVALID', 'Approved source no longer matches pinned data.');
    fileName(ids.size - 1, entry.binding.relativePath);
  }
  return total;
}
function manifestBody(plan: JobMediaPreflightPlan, hostId: string, createdAt: string): Body {
  return {
    format: 'autoreels-host-stage-v1',
    hostId,
    jobId: plan.jobId,
    jobRevision: plan.jobRevision,
    snapshotHash: plan.snapshotHash,
    createdAt,
    entries: plan.entries.map((entry, ordinal) => ({
      ordinal, assetId: entry.assetId,
      name: fileName(ordinal, entry.binding.relativePath),
      hash: entry.pinnedHash, bytes: entry.pinnedBytes,
    })),
  };
}
function parseManifest(raw: string, plan: JobMediaPreflightPlan, hostId: string): Manifest {
  if (Buffer.byteLength(raw) > MAX_MANIFEST_BYTES)
    throw new DomainError('STAGE_MANIFEST_INVALID', 'Owned manifest exceeds safe size.');
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
    assertJsonSafe(parsed, { depth: 8, entries: 256, stringLength: MAX_MANIFEST_BYTES });
  } catch {
    throw new DomainError('STAGE_MANIFEST_INVALID', 'Owned stage manifest is invalid.');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
    throw new DomainError('STAGE_MANIFEST_INVALID', 'Owned stage manifest is invalid.');
  const data = parsed as Record<string, unknown>;
  if (
    Object.keys(data).length !== 8 ||
    typeof data.digest !== 'string' ||
    !hashSchema.safeParse(data.digest).success ||
    typeof data.createdAt !== 'string' ||
    !Number.isFinite(Date.parse(data.createdAt)) ||
    !Array.isArray(data.entries)
  ) throw new DomainError('STAGE_MANIFEST_INVALID', 'Owned stage manifest shape is invalid.');
  const { digest, ...body } = data;
  if (contentHash(body) !== digest)
    throw new DomainError('STAGE_MANIFEST_TAMPERED', 'Stage manifest digest mismatch.');
  const expected = manifestBody(plan, hostId, data.createdAt);
  if (contentHash(body) !== contentHash(expected))
    throw new DomainError('STAGE_OWNERSHIP_MISMATCH', 'Stage is owned by a different job snapshot.');
  return parsed as Manifest;
}

/**
 * App-owned HOST staging only. A durable manifest documents local bytes; it
 * cannot prove a phone upload, Android MediaStore index or external post.
 */
export class HostStagingLedger {
  constructor(private readonly appDataDirectory: string) {}

  private async root(): Promise<string> {
    const owner = resolve(this.appDataDirectory);
    const realOwner = await realpath(owner);
    if (realOwner !== owner)
      throw new DomainError('STAGE_ROOT_UNTRUSTED', 'App data root must not be a symlink.');
    const stage = join(owner, 'owned-media-stage');
    try {
      await mkdir(stage, { mode: 0o700 });
    } catch (e) {
      if (!isCode(e, 'EEXIST')) throw e;
    }
    const info = await lstat(stage);
    if (!info.isDirectory() || info.isSymbolicLink() ||
        !inside(owner, await realpath(stage)))
      throw new DomainError('STAGE_ROOT_UNTRUSTED', 'Private staging root is not a directory.');
    return stage;
  }

  private async checkExisting(
    directory: string, plan: JobMediaPreflightPlan, hostId: string,
    signal?: AbortSignal,
  ): Promise<HostStageResult> {
    const info = await lstat(directory);
    if (!info.isDirectory() || info.isSymbolicLink())
      throw new DomainError('STAGE_OWNERSHIP_MISMATCH', 'Existing staging location is unsafe.');
    let raw: string;
    try {
      const statManifest = await lstat(join(directory, 'manifest.json'));
      if (!statManifest.isFile() || statManifest.isSymbolicLink() ||
          statManifest.size > MAX_MANIFEST_BYTES)
        throw new DomainError('STAGE_MANIFEST_INVALID', 'Invalid owned stage manifest.');
      raw = await readFile(join(directory, 'manifest.json'), 'utf8');
    } catch (cause) {
      if (cause instanceof DomainError) throw cause;
      throw new DomainError('STAGE_MANIFEST_INVALID', 'Owned stage manifest is missing.');
    }
    const manifest = parseManifest(raw, plan, hostId);
    const actualNames = (await readdir(directory)).sort();
    const expectedNames = ['manifest.json', ...manifest.entries.map((e) => e.name)].sort();
    if (contentHash(actualNames) !== contentHash(expectedNames))
      throw new DomainError('STAGE_EXTRA_FILES', 'Existing stage contains unknown files.');
    for (const item of manifest.entries) {
      if (signal?.aborted) throw new DomainError('CANCELLED', 'Staging check cancelled.');
      const file = join(directory, item.name);
      const meta = await lstat(file);
      if (!meta.isFile() || meta.isSymbolicLink() || meta.size !== item.bytes)
        throw new DomainError('STAGE_BYTES_CHANGED', 'Staged media is not a regular matching file.');
      const found = await fingerprint(file, signal);
      if (found.hash !== item.hash || found.bytes !== item.bytes)
        throw new DomainError('STAGE_BYTES_CHANGED', 'Previously staged bytes have changed.');
    }
    return result(plan.jobId, 'REUSED', manifest.entries.length);
  }

  private async transfer(
    item: JobMediaPreflightPlan['entries'][number],
    filename: string,
    pending: string,
    hostId: string,
    signal?: AbortSignal,
  ): Promise<void> {
    if (signal?.aborted) throw new DomainError('CANCELLED', 'Staging cancelled.');
    const sourcePath = await resolveGrantedFile(
      item.binding.grant, item.binding.relativePath, hostId,
    );
    const from = await open(sourcePath, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
    let to: Awaited<ReturnType<typeof open>> | null = null;
    try {
      const before = await from.stat();
      if (!before.isFile() || before.size !== item.pinnedBytes)
        throw new DomainError('STAGE_SOURCE_CHANGED', 'Source size does not match pinned media.');
      to = await open(join(pending, filename), 'wx', 0o600);
      await pipeline(
        from.createReadStream({ autoClose: false }),
        to.createWriteStream({ autoClose: false }),
        { signal },
      );
      await to.sync();
      const after = await from.stat();
      const resolvedAgain = await resolveGrantedFile(
        item.binding.grant, item.binding.relativePath, hostId,
      );
      const current = await stat(resolvedAgain);
      if (resolvedAgain !== sourcePath ||
          after.dev !== before.dev || after.ino !== before.ino ||
          after.size !== before.size || after.mtimeMs !== before.mtimeMs ||
          current.dev !== before.dev || current.ino !== before.ino ||
          current.size !== before.size || current.mtimeMs !== before.mtimeMs)
        throw new DomainError('STAGE_SOURCE_CHANGED', 'Source changed while being staged.');
    } finally {
      await to?.close();
      await from.close();
    }
    const staged = await fingerprint(join(pending, filename), signal);
    if (staged.bytes !== item.pinnedBytes || staged.hash !== item.pinnedHash)
      throw new DomainError('STAGE_HASH_MISMATCH', 'Staged bytes failed pinned hash verification.');
  }

  async stage(
    plan: JobMediaPreflightPlan, hostId: string, signal?: AbortSignal,
  ): Promise<HostStageResult> {
    const totalBytes = validatePlan(plan, hostId);
    if (!plan.entries.length) return result(plan.jobId, 'NO_MEDIA', 0);
    const root = await this.root();
    const lockPath = join(root, 'job-' + plan.jobId + '.lock');
    let lock: Awaited<ReturnType<typeof open>>;
    try {
      lock = await open(lockPath, 'wx', 0o600);
    } catch (error) {
      if (isCode(error, 'EEXIST'))
        throw new DomainError('STAGE_BUSY_REVIEW', 'Stage lock exists; inspect before retry.');
      throw error;
    }
    try {
      const destination = join(root, 'job-' + plan.jobId);
      try {
        await lstat(destination);
        return await this.checkExisting(destination, plan, hostId, signal);
      } catch (error) {
        if (!isCode(error, 'ENOENT')) throw error;
      }
      const filesystem = await statfs(root);
      const available = filesystem.bavail * filesystem.bsize;
      if (!Number.isFinite(available) || available < totalBytes + MIN_FREE_RESERVE)
        throw new DomainError('STAGE_DISK_LOW', 'Insufficient free disk for safe staging.');
      const pending = await mkdtemp(join(root, '.pending-' + plan.jobId + '-'));
      let published = false;
      try {
        const body = manifestBody(plan, hostId, new Date().toISOString());
        for (const [index, item] of plan.entries.entries())
          await this.transfer(item, body.entries[index]!.name, pending, hostId, signal);
        const manifest: Manifest = { ...body, digest: contentHash(body) };
        const handle = await open(join(pending, 'manifest.json'), 'wx', 0o600);
        try {
          await handle.writeFile(JSON.stringify(manifest));
          await handle.sync();
        } finally {
          await handle.close();
        }
        // A lock serializes all cooperating processes. Do not replace a
        // pre-existing namespace even if it appears empty.
        try {
          await lstat(destination);
          throw new DomainError('STAGE_BUSY_REVIEW', 'Staging namespace already exists.');
        } catch (error) {
          if (!isCode(error, 'ENOENT')) throw error;
        }
        await rename(pending, destination);
        published = true;
        return result(plan.jobId, 'CREATED', plan.entries.length);
      } finally {
        // Only this process-created temporary namespace is eligible for
        // cleanup; crash or unknown namespaces are deliberately preserved.
        if (!published) await rm(pending, { recursive: true, force: true });
      }
    } finally {
      await lock.close();
      await rm(lockPath, { force: true });
    }
  }
}
