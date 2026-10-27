import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, writeFile, mkdir, realpath, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { ProcessDefinition, SourceDefinition, SourceGrant } from '@autoreels/contracts';
import { StudioDatabase } from '@autoreels/database';
import { DomainError } from '@autoreels/domain';
import { MediaCoordinator, type MediaRepository } from '@autoreels/media';
import { HostMediaService, loadHostId } from '../apps/desktop/src/host/media-service.js';
import { dispatchInternal } from '../apps/desktop/src/host/internal.js';
import { dispatch } from '../apps/desktop/src/host/service.js';

let dir: string, db: StudioDatabase;
const services: { close(): Promise<void> }[] = [];
const hostId = 'host_fixture';
const processInput: ProcessDefinition = {
  id: 'process_media',
  name: 'Media integration',
  appId: 'fb',
  workflowId: null,
  workflowVersionId: null,
  deviceId: null,
  accountId: null,
  targetId: null,
  revision: 0,
  archived: false,
  schedule: {
    timezone: 'Asia/Ho_Chi_Minh',
    startDate: '2026-10-26',
    slots: ['08:00'],
    weekdays: [1, 2, 3, 4, 5, 6, 7],
    overduePolicy: 'NEXT_FUTURE_SLOT',
    jitterMinutes: 0,
  },
};
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'autoreels-media-service-'));
  db = new StudioDatabase(join(dir, 'studio.sqlite'));
  db.saveProcess(processInput, null);
});
afterEach(async () => {
  for (const service of services.splice(0)) await service.close();
  db.close();
  await rm(dir, { recursive: true, force: true });
});
function repo(overrides: Partial<MediaRepository> = {}): MediaRepository {
  return {
    grant: async (id) => db.getSourceGrant(id, hostId),
    active: async () => db.activeSourceGrants(hostId),
    apply: async (grant, generation, asset) =>
      db.applyScannedAsset(grant.id, hostId, grant.revision, generation, asset),
    finish: async (grant, generation) =>
      db.finishSourceScan(grant.id, hostId, grant.revision, generation),
    ...overrides,
  };
}
function coordinator(overrides: Partial<MediaRepository> = {}): MediaCoordinator {
  const service = new MediaCoordinator(repo(overrides), hostId, {
    probeExecutable: join(dir, 'missing-ffprobe'),
  });
  services.push(service);
  return service;
}
async function source(kind: 'FOLDER' | 'FILE' = 'FOLDER', path = dir): Promise<SourceDefinition> {
  return db.registerNativeSource({
    processId: processInput.id,
    kind,
    rootPath: await realpath(path),
    recursive: false,
    watch: false,
    hostId,
  });
}
function host(picker?: (kind: 'FOLDER' | 'FILE') => Promise<string[] | null>): HostMediaService {
  const service = new HostMediaService(
    {
      request: async (command, input = {}) =>
        dispatch(db, { command, input, operationId: 'op_fixture' }),
      internal: async <T>(request: Parameters<typeof dispatchInternal>[1]) =>
        dispatchInternal(db, request) as T,
    },
    hostId,
    picker,
  );
  services.push(service);
  return service;
}
describe('native grants and host boundary', () => {
  it('stops source observation on archive and restores the original host grants without deleting source files', async () => {
    const path = join(dir, 'archive-media.mp4');
    await writeFile(path, 'fixture-media-bytes');
    const definition = await source('FILE', path);
    db.updateSourceOptions(definition.id, hostId, definition.revision, {
      active: true,
      recursive: false,
      watch: true,
    });
    const service = host();
    await service.ready();
    await service.coordinator.start(definition.id);
    await service.coordinator.idle(definition.id);
    const process = db.getProcess(processInput.id);
    const archived = (await service.request('saveProcess', {
      process: { ...process, archived: true },
      expectedRevision: process.revision,
    })) as ProcessDefinition;
    expect(db.activeSourceGrants(hostId)).toEqual([]);
    expect(db.getSourceGrant(definition.id, hostId).active).toBe(false);
    expect(await readFile(path, 'utf8')).toBe('fixture-media-bytes');
    await service.request('saveProcess', {
      process: { ...archived, archived: false },
      expectedRevision: archived.revision,
    });
    expect(db.activeSourceGrants(hostId).map((g) => g.id)).toEqual([definition.id]);
    await service.coordinator.start(definition.id);
    await service.coordinator.idle(definition.id);
    expect(db.listContent(processInput.id)).toHaveLength(1);
  });
  it('keeps a stable separate host identity across restarts and requires rebind on another host', async () => {
    const id = await loadHostId(join(dir, 'host'));
    expect(await loadHostId(join(dir, 'host'))).toBe(id);
    expect(await loadHostId(join(dir, 'other'))).not.toBe(id);
    const s = await source();
    expect(db.listSources(processInput.id, 'other_host')[0]?.requiresRebind).toBe(true);
    expect(() => db.getSourceGrant(s.id, 'other_host')).toThrow('another host');
    // Detach imported grants without granting any file access.
    expect(
      db.updateSourceOptions(s.id, 'other_host', 0, {
        recursive: false,
        watch: false,
        active: false,
      }).active,
    ).toBe(false);
  });
  it('rejects raw renderer paths, private commands and browser chooser without granting access', async () => {
    const service = host();
    await expect(
      service.request('chooseSource', {
        processId: processInput.id,
        expectedRevision: 0,
        kind: 'FOLDER',
        recursive: false,
        watch: false,
      }),
    ).rejects.toThrow('desktop');
    await expect(
      service.request('chooseSource', {
        processId: processInput.id,
        expectedRevision: 0,
        kind: 'FOLDER',
        recursive: false,
        watch: false,
        rootPath: dir,
      }),
    ).rejects.toThrow();
    await expect(
      dispatch(db, {
        operationId: 'op_inject',
        command: 'source.register',
        input: { rootPath: dir },
      }),
    ).rejects.toThrow();
    expect(db.listSources(processInput.id, hostId)).toEqual([]);
  });
  it('cancels dialogs without writes and approves all selected files before registration', async () => {
    const cancelled = host(async () => null);
    expect(
      await cancelled.request('chooseSource', {
        processId: processInput.id,
        expectedRevision: 0,
        kind: 'FILE',
        recursive: false,
        watch: false,
      }),
    ).toEqual({ cancelled: true, sources: [] });
    const valid = join(dir, 'a.mp4');
    await writeFile(valid, 'a');
    const invalid = host(async () => [valid, join(dir, 'missing.mp4')]);
    await expect(
      invalid.request('chooseSource', {
        processId: processInput.id,
        expectedRevision: 0,
        kind: 'FILE',
        recursive: false,
        watch: false,
      }),
    ).rejects.toThrow();
    expect(db.listSources(processInput.id, hostId)).toEqual([]);
  });
  it('rejects a stale Process after native dialog and rolls back a partial grant batch', async () => {
    const service = host(async () => {
      db.saveProcess({ ...processInput, name: 'Changed while picking' }, 0);
      return [dir];
    });
    await expect(
      service.request('chooseSource', {
        processId: processInput.id,
        expectedRevision: 0,
        kind: 'FOLDER',
        recursive: false,
        watch: false,
      }),
    ).rejects.toThrow('đã đổi');
    const grant = {
      processId: processInput.id,
      kind: 'FOLDER' as const,
      rootPath: dir,
      recursive: false,
      watch: false,
      hostId,
    };
    expect(() =>
      db.registerNativeSources(processInput.id, 1, [
        grant,
        { ...grant, kind: 'FILE', rootPath: '' },
      ]),
    ).toThrow('grant');
    expect(db.listSources(processInput.id, hostId)).toEqual([]);
  });
});
describe('real source scans and durable reconciliation', () => {
  it('connects a native selection to real content, preserves ignore and source files through restart', async () => {
    const filename = join(dir, 'tiếng Việt.mp4');
    await writeFile(filename, 'actual bytes');
    const service = host(async () => [filename]);
    const result = (await service.request('chooseSource', {
      processId: processInput.id,
      expectedRevision: 0,
      kind: 'FILE',
      recursive: false,
      watch: false,
    })) as { sources: SourceDefinition[] };
    const id = result.sources[0]!.id;
    await service.coordinator.idle(id);
    expect(service.coordinator.progress(id)?.added).toBe(1);
    const row = db.listContent(processInput.id)[0]!;
    expect(db.listContentAssets(processInput.id)[0]?.relativePath).toBe('tiếng Việt.mp4');
    db.ignoreContent(row.id, row.revision);
    await service.coordinator.start(id);
    await service.coordinator.idle(id);
    expect(service.coordinator.progress(id)?.ignored).toBe(1);
    expect(db.listContent(processInput.id)).toEqual([]);
    await service.close();
    db.close();
    db = new StudioDatabase(join(dir, 'studio.sqlite'));
    const resumed = coordinator();
    await resumed.start(id);
    await resumed.idle(id);
    expect(resumed.progress(id)?.ignored).toBe(1);
    expect(db.listContent(processInput.id)).toEqual([]);
    expect(await readFile(filename, 'utf8')).toBe('actual bytes');
  });
  it('marks changed/missing files while preserving the original immutable asset and row', async () => {
    const filename = join(dir, 'a.mp4');
    await writeFile(filename, 'original');
    const s = await source(),
      c = coordinator();
    await c.start(s.id);
    await c.idle(s.id);
    const original = db.listContentAssets(processInput.id)[0]!;
    await writeFile(filename, 'changed bytes');
    await c.start(s.id);
    await c.idle(s.id);
    expect(c.progress(s.id)?.changed).toBe(1);
    expect(db.listContentAssets(processInput.id)[0]).toMatchObject({
      id: original.id,
      hash: original.hash,
      bytes: original.bytes,
      state: 'CHANGED',
    });
    await rm(filename);
    await c.start(s.id);
    await c.idle(s.id);
    expect(c.progress(s.id)?.missing).toBe(1);
    expect(db.listContentAssets(processInput.id)[0]?.state).toBe('MISSING');
    expect(db.listContent(processInput.id)).toHaveLength(1);
  });
  it('never finalizes missing entries after cancellation or an incomplete scan', async () => {
    await writeFile(join(dir, 'a.mp4'), 'a');
    const s = await source(),
      finish = vi.fn(repo().finish);
    let cancel!: () => void;
    const c = coordinator({
      finish,
      apply: async (g, generation, asset) => {
        const result = await repo().apply(g, generation, asset);
        cancel();
        return result;
      },
    });
    cancel = () => c.cancel(s.id);
    await c.start(s.id);
    await c.idle(s.id);
    expect(c.progress(s.id)?.status).toBe('CANCELLED');
    expect(finish).not.toHaveBeenCalled();
    const broken = coordinator({
      finish,
      apply: async () => {
        throw new DomainError('SOURCE_CHANGED', 'Source changed during scan');
      },
    });
    await broken.start(s.id);
    await broken.idle(s.id);
    expect(broken.progress(s.id)).toMatchObject({ status: 'ERROR', failed: 1, missing: 0 });
    expect(finish).not.toHaveBeenCalled();
    expect(db.listContentAssets(processInput.id)[0]?.state).toBe('READY');
  });
  it('deduplicates overlapping requests, bounds scans to two, and drains queued work on shutdown', async () => {
    const ids: string[] = [];
    for (const name of ['a.mp4', 'b.mp4', 'c.mp4']) {
      const path = join(dir, name);
      await writeFile(path, name);
      ids.push((await source('FILE', path)).id);
    }
    let release!: () => void,
      entered = 0,
      maxEntered = 0;
    const gate = new Promise<void>((r) => {
      release = r;
    });
    const c = coordinator({
      apply: async (g, generation, asset) => {
        entered++;
        maxEntered = Math.max(maxEntered, entered);
        await gate;
        const result = await repo().apply(g, generation, asset);
        entered--;
        return result;
      },
    });
    const started = await Promise.all(ids.map((id) => c.start(id)));
    expect((await c.start(ids[0]!)).scanId).toBe(started[0]!.scanId);
    await vi.waitFor(() => expect(entered).toBe(2));
    expect(c.progress(ids[2]!)?.status).toBe('QUEUED');
    const closing = c.close();
    release();
    await closing;
    expect(maxEntered).toBe(2);
    expect(c.progress(ids[2]!)?.status).toBe('CANCELLED');
    await expect(c.start(ids[0]!)).rejects.toThrow('đóng');
  });
  it('uses polling when watcher is unavailable and restores observation from saved grants', async () => {
    const root = join(dir, 'watch');
    await mkdir(root);
    const s = db.registerNativeSource({
      processId: processInput.id,
      kind: 'FOLDER',
      rootPath: await realpath(root),
      recursive: false,
      watch: true,
      hostId,
    });
    const make = () => {
      const c = new MediaCoordinator(repo(), hostId, {
        probeExecutable: join(dir, 'missing'),
        reconcileMs: 100,
        watchFactory: (() => {
          throw new Error('unsupported');
        }) as typeof import('node:fs').watch,
      });
      services.push(c);
      return c;
    };
    const c = make();
    await c.refresh();
    expect(c.watchWarning(s.id)).toContain('Watcher');
    await writeFile(join(root, 'a.mp4'), 'a');
    await vi.waitFor(() => expect(db.listContent(processInput.id)).toHaveLength(1), {
      timeout: 3000,
    });
    await c.close();
    const resumed = make();
    await resumed.refresh();
    await writeFile(join(root, 'b.mp4'), 'b');
    await vi.waitFor(() => expect(db.listContent(processInput.id)).toHaveLength(2), {
      timeout: 3000,
    });
  });
  it('preserves the same source ledger when repicking changes its options', async () => {
    await writeFile(join(dir, 'a.mp4'), 'a');
    const s = await source(),
      c = coordinator();
    await c.start(s.id);
    await c.idle(s.id);
    const row = db.listContent(processInput.id)[0]!;
    db.ignoreContent(row.id, row.revision);
    const picked = db.registerNativeSources(processInput.id, 0, [
      {
        processId: processInput.id,
        kind: 'FOLDER',
        rootPath: dir,
        recursive: true,
        watch: false,
        hostId,
      },
    ])[0]!;
    expect(picked).toMatchObject({ id: s.id, revision: 1, recursive: true });
    expect(() => db.finishSourceScan(s.id, hostId, 0, 'stale')).toThrow('changed');
    await c.start(s.id);
    await c.idle(s.id);
    expect(c.progress(s.id)?.ignored).toBe(1);
    expect(db.listContent(processInput.id)).toHaveLength(0);
    db.updateSourceOptions(s.id, hostId, picked.revision, {
      recursive: false,
      watch: false,
      active: false,
    });
    const resumed = await source();
    expect(resumed.id).toBe(s.id);
    await c.start(resumed.id);
    await c.idle(resumed.id);
    expect(c.progress(resumed.id)?.ignored).toBe(1);
    expect(db.listContent(processInput.id)).toHaveLength(0);
  });
  it('rejects file fields from another Process or omitted snapshot assets at the public boundary', async () => {
    const draft = db.createWorkflow('fb', 'Media inputs');
    draft.bundle.inputs = [{ key: 'media', type: 'file', scope: 'row', required: true }];
    db.saveDraft(draft.bundle, 0);
    db.saveProcess({ ...processInput, workflowId: draft.workflowId }, 0);
    const filename = join(dir, 'a.mp4');
    await writeFile(filename, 'a');
    const s = await source('FILE', filename),
      c = coordinator();
    await c.start(s.id);
    await c.idle(s.id);
    const row = db.listContent(processInput.id)[0]!,
      asset = row.assetIds[0]!;
    const save = (fields: Record<string, { assetId: string }>, assetIds: string[]) =>
      dispatch(db, {
        operationId: 'op_media_scope',
        command: 'saveContent',
        input: { item: { ...row, fields, assetIds }, expectedRevision: row.revision },
      });
    await expect(save({ media: { assetId: asset } }, [])).rejects.toThrow('tiến trình');
    const other = { ...processInput, id: 'process_other' };
    db.saveProcess(other, null);
    const foreign = db.registerNativeSource({
      processId: other.id,
      kind: 'FILE',
      rootPath: filename,
      recursive: false,
      watch: false,
      hostId,
    });
    await c.start(foreign.id);
    await c.idle(foreign.id);
    const foreignAsset = db.listContent(other.id)[0]!.assetIds[0]!;
    await expect(save({ media: { assetId: foreignAsset } }, [foreignAsset])).rejects.toThrow(
      'tiến trình',
    );
    await expect(save({ media: { assetId: asset } }, [asset])).resolves.toMatchObject({
      revision: 1,
    });
  });
  it('fences stale source callbacks and does not replace another Process source', async () => {
    const s = await source();
    db.updateSourceOptions(s.id, hostId, 0, { recursive: true, watch: false, active: true });
    expect(() => db.finishSourceScan(s.id, hostId, 0, 'scan_old')).toThrow('changed');
    expect(() =>
      db.updateSourceOptions(s.id, hostId, 0, { recursive: false, watch: false, active: false }),
    ).toThrow('đã đổi');
    const second = { ...processInput, id: 'process_second' };
    db.saveProcess(second, null);
    const other = db.registerNativeSource({
      processId: second.id,
      kind: 'FOLDER',
      rootPath: dir,
      recursive: false,
      watch: false,
      hostId,
    });
    await source();
    expect(db.getSourceGrant(other.id, hostId).active).toBe(true);
  });
});
