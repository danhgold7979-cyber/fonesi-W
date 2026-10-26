import { realpath, stat, opendir } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { setTimeout as delay } from 'node:timers/promises';
import { basename, extname, isAbsolute, relative, resolve, sep } from 'node:path';
import type { SourceGrant, ScannedAsset } from '@autoreels/contracts';
import { DomainError } from '@autoreels/domain';

const run = promisify(execFile);
const imageExtensions = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp']);
const videoExtensions = new Set(['.mp4', '.mov', '.mkv', '.webm', '.m4v', '.avi']);
const junkDirectories = new Set([
  '.git',
  'node_modules',
  '.cache',
  '.tools',
  '$RECYCLE.BIN',
  'System Volume Information',
]);
export function mediaKind(path: string): 'image' | 'video' | null {
  const ext = extname(path).toLowerCase();
  return imageExtensions.has(ext) ? 'image' : videoExtensions.has(ext) ? 'video' : null;
}
export function withinRoot(root: string, path: string): boolean {
  const rel = relative(root, path);
  return !isAbsolute(rel) && rel !== '..' && !rel.startsWith('..' + sep);
}
export async function approveNativeSource(path: string, kind: 'FOLDER' | 'FILE'): Promise<string> {
  if (!isAbsolute(path))
    throw new DomainError(
      'INVALID_SOURCE',
      'Source must be an absolute path returned by the host dialog',
    );
  const canonical = await realpath(path),
    info = await stat(canonical);
  if (kind === 'FOLDER' ? !info.isDirectory() : !info.isFile() || !mediaKind(canonical))
    throw new DomainError('INVALID_SOURCE', 'Choose a folder or supported media file');
  return canonical;
}
export async function resolveGrantedFile(
  grant: SourceGrant,
  relativePath: string,
  hostId: string,
): Promise<string> {
  if (grant.hostId !== hostId)
    throw new DomainError(
      'SOURCE_REBIND_REQUIRED',
      'Nguồn thuộc máy khác; chọn lại nguồn bằng hộp thoại trên host.',
    );
  if (isAbsolute(relativePath) || relativePath.split(/[\\/]/).includes('..'))
    throw new DomainError('SOURCE_ESCAPE', 'Invalid relative asset path');
  const root = await realpath(grant.rootPath);
  if (root !== grant.rootPath) throw new DomainError('SOURCE_MOVED', 'Registered source has moved');
  const expected = grant.kind === 'FILE' ? grant.rootPath : resolve(root, relativePath),
    canonical = await realpath(expected);
  if (
    (grant.kind === 'FOLDER' && !withinRoot(root, canonical)) ||
    (grant.kind === 'FILE' && (relativePath !== basename(root) || canonical !== root))
  )
    throw new DomainError('SOURCE_ESCAPE', 'Asset resolves outside its registered source');
  return canonical;
}
export async function fingerprint(
  path: string,
  signal?: AbortSignal,
): Promise<{ hash: string; bytes: number; mtimeMs: number }> {
  const before = await stat(path);
  if (!before.isFile()) throw new DomainError('NOT_A_FILE', 'Source entry is not a file');
  const hash = createHash('sha256'),
    stream = createReadStream(path, signal ? { signal } : {});
  for await (const chunk of stream) hash.update(chunk as Buffer);
  const after = await stat(path);
  if (before.size !== after.size || before.mtimeMs !== after.mtimeMs || before.ino !== after.ino)
    throw new DomainError(
      'FILE_CHANGED_DURING_READ',
      'File changed while fingerprinting; retry after it is stable',
    );
  return { hash: hash.digest('hex'), bytes: after.size, mtimeMs: after.mtimeMs };
}
export async function probeMedia(
  path: string,
  executable = 'ffprobe',
  signal?: AbortSignal,
): Promise<ScannedAsset['probe']> {
  try {
    const { stdout } = await run(
      executable,
      [
        '-v',
        'error',
        '-show_entries',
        'format=duration:stream=width,height,codec_type',
        '-of',
        'json',
        '-i',
        path,
      ],
      { timeout: 10000, maxBuffer: 1048576, ...(signal ? { signal } : {}) },
    );
    const data = JSON.parse(stdout) as {
        format?: { duration?: string };
        streams?: { width?: number; height?: number; codec_type?: string }[];
      },
      video = data.streams?.find((s) => s.codec_type === 'video');
    const rawDuration = data.format?.duration;
    const duration =
      typeof rawDuration === 'string' && rawDuration.trim() ? Number(rawDuration) : NaN;
    return {
      status: 'READY',
      durationSeconds: Number.isFinite(duration) && duration >= 0 ? duration : null,
      width: Number.isFinite(video?.width) ? video!.width! : null,
      height: Number.isFinite(video?.height) ? video!.height! : null,
    };
  } catch (error) {
    if (signal?.aborted) throw error;
    const missing =
      error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT';
    return {
      status: missing ? 'UNAVAILABLE' : 'ERROR',
      reason: missing ? 'Chưa có ffprobe trong host.' : 'Không đọc được thông tin media.',
    };
  }
}
export async function* enumerateMedia(
  grant: SourceGrant,
  hostId: string,
  signal?: AbortSignal,
): AsyncGenerator<string> {
  if (grant.hostId !== hostId)
    throw new DomainError('SOURCE_REBIND_REQUIRED', 'Nguồn cần được chọn lại trên máy hiện tại.');
  if ((await realpath(grant.rootPath)) !== grant.rootPath)
    throw new DomainError('SOURCE_MOVED', 'Registered source has moved');
  if (grant.kind === 'FILE') {
    yield basename(grant.rootPath);
    return;
  }
  async function* walk(path: string, depth: number): AsyncGenerator<string> {
    if (depth > 64)
      throw new DomainError('SOURCE_DEPTH', 'Directory depth exceeds the scan operation budget');
    for await (const entry of await opendir(path)) {
      if (signal?.aborted) return;
      if (entry.isSymbolicLink()) continue;
      const full = resolve(path, entry.name);
      if (entry.isDirectory() && grant.recursive && !junkDirectories.has(entry.name))
        yield* walk(full, depth + 1);
      else if (entry.isFile() && mediaKind(full)) yield relative(grant.rootPath, full);
    }
  }
  yield* walk(grant.rootPath, 0);
}
export async function scanSource(
  grant: SourceGrant,
  hostId: string,
  onAsset: (asset: ScannedAsset) => Promise<void>,
  options: {
    signal?: AbortSignal;
    probeExecutable?: string;
    onError?: (relativePath: string, error: unknown) => void;
  } = {},
): Promise<void> {
  for await (const relativePath of enumerateMedia(grant, hostId, options.signal)) {
    if (options.signal?.aborted) return;
    try {
      const path = await resolveGrantedFile(grant, relativePath, hostId),
        kind = mediaKind(path);
      if (!kind) continue;
      const before = await stat(path);
      // Only recent writes need settling; do not delay every item in an old library.
      if (Date.now() - before.mtimeMs < 1500) {
        await delay(250, undefined, options.signal ? { signal: options.signal } : {});
        const stable = await stat(path);
        if (
          stable.size !== before.size ||
          stable.mtimeMs !== before.mtimeMs ||
          stable.ino !== before.ino
        )
          throw new DomainError(
            'FILE_NOT_STABLE',
            'File đang được ghi; quét lại khi file ổn định.',
          );
      }
      const value = await fingerprint(path, options.signal);
      const probe = await probeMedia(path, options.probeExecutable ?? 'ffprobe', options.signal);
      const after = await stat(path);
      if (after.size !== value.bytes || after.mtimeMs !== value.mtimeMs)
        throw new DomainError('FILE_CHANGED_DURING_READ', 'Media changed during probe');
      await onAsset({ relativePath, kind, ...value, probe });
    } catch (error) {
      if (options.signal?.aborted) return;
      if (options.onError) options.onError(relativePath, error);
      else throw error;
    }
  }
}

export { MediaCoordinator } from './coordinator.js';
export type { MediaRepository } from './coordinator.js';
