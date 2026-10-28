import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, rm, writeFile, readFile, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { ProcessDefinition, JobSnapshot } from '@autoreels/contracts';
import { StudioDatabase } from '@autoreels/database';
import { contentHash } from '@autoreels/domain';
import { fingerprint } from '@autoreels/media';
import { HostMediaService } from '../apps/desktop/src/host/media-service.js';
import { dispatchInternal } from '../apps/desktop/src/host/internal.js';
import { dispatch } from '../apps/desktop/src/host/service.js';

let dir: string, db: StudioDatabase, service: HostMediaService, file: string;
const hostId = 'host_media_preflight';
const processId = 'process_media_preflight';
const jobId = 'job_media_preflight';
const originalBytes = 'actual pinned host media bytes';
async function fixture(hasMedia = true) {
  db.registerObservedDevice('device_media_preflight', 'Fixture phone');
  const draft = db.createWorkflow('fb', 'Media preflight source'),
    version = db.createVersion(draft.workflowId, 0);
  const process: ProcessDefinition = {
    id: processId, name: processId, appId: 'fb',
    workflowId: draft.workflowId, workflowVersionId: version.id,
    deviceId: 'device_media_preflight', accountId: null, targetId: null,
    revision: 0, archived: false,
    schedule: {
      timezone: 'Asia/Ho_Chi_Minh', startDate: '2026-10-26',
      slots: ['08:00'], weekdays: [1,2,3,4,5,6,7],
      overduePolicy: 'NEXT_FUTURE_SLOT', jitterMinutes: 0,
    },
  };
  db.saveProcess(process, null);
  let assets: JobSnapshot['assets'] = [];
  let assetIds: string[] = [];
  let contentId = 'content_text_only_preflight';
  let sourceId = '';
  if (hasMedia) {
    const source = db.registerNativeSource({
      processId, kind: 'FILE', rootPath: file, recursive: false,
      watch: false, hostId,
    });
    sourceId = source.id;
    const observed = await fingerprint(file);
    db.applyScannedAsset(source.id, hostId, source.revision, 'gen_first', {
      relativePath: basename(file), kind: 'video',
      hash: observed.hash, bytes: observed.bytes, mtimeMs: observed.mtimeMs,
      probe: { status: 'UNAVAILABLE', reason: 'Test fixture' },
    });
    const row = db.listContent(processId)[0]!;
    contentId = row.id;
    assetIds = [...row.assetIds];
    assets = db.listContentAssets(processId);
  } else {
    db.saveContent({
      id: contentId, processId, revision: 0,
      fields: { caption: 'Text only' }, assetIds: [], ignored: false,
    }, null);
  }
  const snapshot: JobSnapshot = {
    workflowVersionId: version.id, workflowHash: version.hash,
    bundle: version.bundle, contentId,
    fields: { caption: 'Sensitive caption' }, assetIds,
    assets, targetId: null, networkProfileId: null,
  };
  db.createJob({
    id: jobId, occurrenceKey: contentHash(jobId),
    processId, deviceId: process.deviceId!, contentId,
    scheduledUtc: '2035-01-01T00:00:00.000Z',
    state: 'SCHEDULED', revision: 0, priority: 0,
  }, snapshot);
  return {sourceId, assetIds, snapshot};
}
beforeEach(async () => {
  dir = await realpath(await mkdtemp(join(tmpdir(), 'autoreels-media-preflight-')));
  file = join(dir, 'pinned.mp4');
  await writeFile(file, originalBytes);
  db = new StudioDatabase(join(dir,'data.sqlite'));
  service = new HostMediaService({
    request: async (command, input = {}) =>
      dispatch(db, { operationId: 'op_media_preflight', command, input }),
    internal: async <T>(request: Parameters<typeof dispatchInternal>[1]) =>
      dispatchInternal(db, request) as T,
  }, hostId);
});
afterEach(async () => {
  await service.close();
  db.close();
  await rm(dir, {recursive: true, force: true});
});

describe('P11/S094 private host media bytes', () => {
  it('rehashes real pinned file bytes without device action, DB mutation or path disclosure', async () => {
    await fixture();
    const before = db.getJob(jobId);
    const bytes = await readFile(file);
    const result = await service.inspectJobMediaBytes(jobId);
    expect(result).toMatchObject({
      jobId, scope: 'HOST_BYTES_ONLY', status: 'BYTES_MATCHED',
      verifiedMediaCount: 1, canDispatch: false,
    });
    expect(JSON.stringify(result)).not.toContain(dir);
    expect(JSON.stringify(result)).not.toContain('Sensitive caption');
    expect(db.getJob(jobId)).toEqual(before);
    expect(await readFile(file)).toEqual(bytes);
    const raw = new DatabaseSync(join(dir, 'data.sqlite'));
    expect(raw.prepare('SELECT COUNT(*) AS count FROM effects').get()?.count).toBe(0);
    expect(raw.prepare('SELECT COUNT(*) AS count FROM leases').get()?.count).toBe(0);
    raw.close();
    await expect(dispatch(db, {
      operationId:'op_media_privacy', command: 'job.mediaPlan' as never,
      input: {jobId,hostId},
    })).rejects.toThrow();
  });
  it('refuses changed bytes even when SQLite has not yet reconciled the source', async () => {
    await fixture();
    await writeFile(file, 'a totally different file content');
    await expect(service.inspectJobMediaBytes(jobId))
      .rejects.toMatchObject({code: 'MEDIA_BYTES_CHANGED'});
    expect(db.getJob(jobId).job.state).toBe('SCHEDULED');
  });
  it('fails closed on a changed source ledger and wrong host identity', async () => {
    const f = await fixture();
    const originalPlan = db.jobMediaPreflightPlan(jobId,hostId);
    expect(originalPlan.entries).toHaveLength(1);
    expect(() => db.jobMediaPreflightPlan(jobId,'host_other'))
      .toThrow('Source belongs to another host');
    const raw = new DatabaseSync(join(dir, 'data.sqlite'));
    raw.prepare("UPDATE source_entries SET state='CHANGED' WHERE asset_id=?")
      .run(f.assetIds[0]);
    raw.close();
    await expect(service.inspectJobMediaBytes(jobId))
      .rejects.toMatchObject({code:'MEDIA_LEDGER_CHANGED'});
  });
  it('does not claim media proof for a text-only job and denies archived Process', async () => {
    await fixture(false);
    expect(await service.inspectJobMediaBytes(jobId)).toMatchObject({
      status:'NO_MEDIA', verifiedMediaCount:0, canDispatch:false,
    });
    const p=db.getProcess(processId);
    db.saveProcess({...p,archived:true},p.revision);
    await expect(service.inspectJobMediaBytes(jobId))
      .rejects.toMatchObject({code:'PROCESS_ARCHIVED'});
  });
  it('rejects missing host files without treating their old metadata as valid', async () => {
    await fixture();
    await rm(file);
    await expect(service.inspectJobMediaBytes(jobId))
      .rejects.toMatchObject({code:'MEDIA_READ_FAILED'});
  });
});
