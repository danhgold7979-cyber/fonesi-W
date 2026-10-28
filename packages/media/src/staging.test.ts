import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, readFile, realpath, rm, symlink, writeFile, lstat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { createHash } from 'node:crypto';
import type { JobMediaPreflightPlan, SourceGrant } from '@autoreels/contracts';
import { HostStagingLedger } from './staging.js';

let root: string;
let sourceFile: string;
const hostId = 'host_stage_test';
const hash = (v: string) => createHash('sha256').update(v).digest('hex');
const bytes = 'Original media bytes under exclusive host grant';
beforeEach(async () => {
  root = await realpath(await mkdtemp(join(tmpdir(), 'autoreels-host-stage-')));
  sourceFile = join(root, 'source.mp4');
  await writeFile(sourceFile, bytes);
});
afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});
function plan(jobId = 'job_stage_1', rootFile = sourceFile): JobMediaPreflightPlan {
  const grant: SourceGrant = {
    id: 'source_stage', processId: 'process_stage', rootPath: rootFile,
    kind: 'FILE', recursive: false, watch: false, revision: 0, active: true, hostId,
  };
  return {
    jobId, jobRevision: 0, snapshotHash: hash('snapshot'),
    entries: [{
      assetId: 'asset_stage', pinnedHash: hash(bytes),
      pinnedBytes: Buffer.byteLength(bytes),
      binding: {
        grant, assetId: 'asset_stage', expectedHash: hash(bytes),
        observedHash: hash(bytes), relativePath: basename(rootFile), state: 'READY',
      },
    }],
  };
}
describe('S095 local host-owned staging ledger (not Android MediaStore)', () => {
  it('copies actual bytes atomically with a manifest, then verifies and reuses without duplication', async () => {
    const ledger = new HostStagingLedger(root);
    const snapshot = plan();
    const original = await readFile(sourceFile);
    expect(await ledger.stage(snapshot, hostId)).toMatchObject({
      scope: 'HOST_STAGED_NOT_ANDROID', status: 'CREATED',
      mediaCount: 1, canDispatch: false,
    });
    const saved = join(root, 'owned-media-stage', 'job-job_stage_1');
    const manifest = JSON.parse(await readFile(join(saved, 'manifest.json'), 'utf8')) as {
      entries: { name: string; hash: string; bytes: number }[];
    };
    expect(manifest.entries).toMatchObject([{ name: 'asset-000.mp4', hash: hash(bytes) }]);
    expect(await readFile(join(saved, 'asset-000.mp4'))).toEqual(original);
    expect(await ledger.stage(snapshot, hostId)).toMatchObject({ status: 'REUSED' });
    expect(await readFile(sourceFile)).toEqual(original);
  });
  it('refuses altered staged bytes and foreign snapshots without removing either file', async () => {
    const ledger = new HostStagingLedger(root), original = plan();
    await ledger.stage(original, hostId);
    const filename = join(root, 'owned-media-stage', 'job-job_stage_1', 'asset-000.mp4');
    await writeFile(filename, 'tampered');
    await expect(ledger.stage(original, hostId)).rejects.toMatchObject({
      code: 'STAGE_BYTES_CHANGED',
    });
    expect(await readFile(filename, 'utf8')).toBe('tampered');
    const newSnapshot = { ...original, snapshotHash: hash('other') };
    await expect(ledger.stage(newSnapshot, hostId)).rejects.toMatchObject({
      code: 'STAGE_OWNERSHIP_MISMATCH',
    });
  });
  it('rejects source mutation without deleting the original user file', async () => {
    const ledger = new HostStagingLedger(root);
    await writeFile(sourceFile, 'source changed after snapshot');
    await expect(ledger.stage(plan(), hostId)).rejects.toMatchObject({
      code: 'STAGE_SOURCE_CHANGED',
    });
    expect(await readFile(sourceFile, 'utf8')).toBe('source changed after snapshot');
  });
  it('rejects unexpected manifest files, foreign hosts and duplicate assets', async () => {
    const ledger = new HostStagingLedger(root), original = plan();
    await ledger.stage(original, hostId);
    const saved = join(root, 'owned-media-stage', 'job-job_stage_1');
    await writeFile(join(saved, 'foreign.txt'), 'not owned');
    await expect(ledger.stage(original, hostId)).rejects.toMatchObject({
      code: 'STAGE_EXTRA_FILES',
    });
    const foreign = {
      ...original,
      jobId: 'job_stage_foreign',
      entries: original.entries.map((e) => ({ ...e, binding: {
        ...e.binding, grant: { ...e.binding.grant, hostId: 'other_host' },
      } })),
    };
    await expect(ledger.stage(foreign, hostId)).rejects.toMatchObject({
      code: 'STAGE_BINDING_INVALID',
    });
    expect(await lstat(saved)).toBeDefined();
  });
  it('does not stage empty jobs or follow a symlinked staging root', async (context) => {
    const ledger = new HostStagingLedger(root), empty = { ...plan(), entries: [] };
    expect(await ledger.stage(empty, hostId)).toMatchObject({
      status: 'NO_MEDIA', mediaCount: 0, canDispatch: false,
    });
    const foreign = join(root, 'other');
    await writeFile(foreign, 'private');
    try {
      await symlink(foreign, join(root, 'owned-media-stage'));
    } catch (error) {
      if (process.platform === 'win32') {
        context.skip('Windows symlink permission is unavailable on this runner.');
        return;
      }
      throw error;
    }
    await expect(ledger.stage(plan(), hostId)).rejects.toMatchObject({
      code: 'STAGE_ROOT_UNTRUSTED',
    });
  });
});
