import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, mkdir, writeFile, realpath, symlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, basename } from 'node:path';
import { createHash } from 'node:crypto';
import type { SourceGrant, ScannedAsset } from '@autoreels/contracts';
import {
  approveNativeSource,
  enumerateMedia,
  fingerprint,
  mediaKind,
  probeMedia,
  resolveGrantedFile,
  scanSource,
  withinRoot,
} from './index.js';

let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'autoreels-media-'));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});
async function grant(recursive = false): Promise<SourceGrant> {
  return {
    id: 'source_1',
    processId: 'process_1',
    kind: 'FOLDER',
    rootPath: await realpath(dir),
    recursive,
    watch: false,
    revision: 0,
    active: true,
    hostId: 'host_test',
  };
}
describe('host-scoped filesystem permissions', () => {
  it('rejects relative/unsupported file sources', async () => {
    await expect(approveNativeSource('relative.mp4', 'FILE')).rejects.toThrow('absolute');
    const path = join(dir, 'secret.txt');
    await writeFile(path, 'private');
    await expect(approveNativeSource(path, 'FILE')).rejects.toThrow('supported');
  });
  it('rejects traversal, source rebinding on a different host and filename mismatches', async () => {
    const g = await grant();
    await writeFile(join(dir, 'a.mp4'), 'a');
    await expect(resolveGrantedFile(g, '../a.mp4', 'host_test')).rejects.toThrow('relative');
    await expect(resolveGrantedFile(g, 'a.mp4', 'another_host')).rejects.toThrow('máy khác');
    const file = { ...g, kind: 'FILE' as const, rootPath: await realpath(join(dir, 'a.mp4')) };
    expect(await resolveGrantedFile(file, basename(file.rootPath), 'host_test')).toBe(
      file.rootPath,
    );
    await expect(resolveGrantedFile(file, 'other.mp4', 'host_test')).rejects.toThrow('outside');
    expect(withinRoot(dir, dir + '-other/file')).toBe(false);
  });
  it('rejects symlinks that resolve outside the granted root', async (context) => {
    const root = join(dir, 'root');
    await mkdir(root);
    const outside = join(dir, 'outside.mp4');
    await writeFile(outside, 'outside');
    try {
      await symlink(outside, join(root, 'link.mp4'));
    } catch (e) {
      if (process.platform === 'win32')
        context.skip('Symlink permission is unavailable on this Windows runner');
      throw e;
    }
    const g = { ...(await grant()), rootPath: await realpath(root) };
    await expect(resolveGrantedFile(g, 'link.mp4', 'host_test')).rejects.toThrow('outside');
    const listed: string[] = [];
    for await (const p of enumerateMedia(g, 'host_test')) listed.push(p);
    expect(listed).toEqual([]);
  });
});
describe('streamed source scan', () => {
  it('hashes actual file bytes and preserves Unicode filenames', async () => {
    const path = join(dir, 'tiếng Việt.mp4');
    await writeFile(path, 'actual bytes');
    const value = await fingerprint(path);
    expect(value.hash).toBe(createHash('sha256').update('actual bytes').digest('hex'));
    expect(value.bytes).toBe(12);
    expect(mediaKind('x.MP4')).toBe('video');
    expect(mediaKind('x.txt')).toBe(null);
  });
  it('enumerates subfolders only when enabled and ignores non-media/junk', async () => {
    await mkdir(join(dir, 'child'));
    await mkdir(join(dir, '.git'));
    await writeFile(join(dir, 'a.mp4'), 'a');
    await writeFile(join(dir, 'child', 'b.jpg'), 'b');
    await writeFile(join(dir, '.git', 'c.mp4'), 'c');
    await writeFile(join(dir, 'token.txt'), 'secret');
    const shallow: string[] = [],
      deep: string[] = [];
    for await (const p of enumerateMedia(await grant(), 'host_test')) shallow.push(p);
    for await (const p of enumerateMedia(await grant(true), 'host_test')) deep.push(p);
    expect(shallow).toEqual(['a.mp4']);
    expect(deep).toHaveLength(2);
    expect(deep.some((p) => p.includes('token') || p.includes('.git'))).toBe(false);
  });
  it('reports missing probe support without inventing duration zero', async () => {
    const path = join(dir, 'a.mp4');
    await writeFile(path, 'not a real video');
    expect(await probeMedia(path, join(dir, 'no-such-ffprobe'))).toEqual({
      status: 'UNAVAILABLE',
      reason: 'Chưa có ffprobe trong host.',
    });
    const assets: ScannedAsset[] = [];
    await scanSource(
      await grant(),
      'host_test',
      async (a) => {
        assets.push(a);
      },
      { probeExecutable: join(dir, 'no-such-ffprobe') },
    );
    expect(assets).toHaveLength(1);
    expect(assets[0]!.probe.status).toBe('UNAVAILABLE');
  });
  it('cancels without treating unscanned files as deleted', async () => {
    await writeFile(join(dir, 'a.mp4'), 'a');
    const c = new AbortController();
    c.abort();
    let count = 0;
    await scanSource(
      await grant(),
      'host_test',
      async () => {
        count++;
      },
      { signal: c.signal },
    );
    expect(count).toBe(0);
  });
});
