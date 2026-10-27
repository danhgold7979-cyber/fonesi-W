import { beforeEach, afterEach, describe, it, expect } from 'vitest';
import {
  mkdtemp,
  rm,
  readFile,
  writeFile,
  unlink,
  symlink,
  mkdir,
  readdir,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { WorkflowSummary, WorkspaceStatus, WorkspaceBackupResult } from '@autoreels/contracts';
import { HostWorkspaceService } from '../apps/desktop/src/host/workspace-service.js';
import { DbClient } from '../apps/desktop/dist/host/host/db-client.js';
import { fingerprint } from '@autoreels/media';

let directory: string, db: DbClient;
const services: HostWorkspaceService[] = [];
const id = 'backup_' + 'a'.repeat(32),
  otherId = 'backup_' + 'b'.repeat(32);
beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'autoreels-workspace-'));
  db = new DbClient(join(directory, 'studio.sqlite'));
  await db.request('createWorkflow', {
    appId: 'fb',
    name: 'private-fixture-name-must-not-be-exported',
  });
});
afterEach(async () => {
  for (const service of services.splice(0)) await service.close();
  await db.close();
  await rm(directory, { recursive: true, force: true });
});
function host(disk?: ConstructorParameters<typeof HostWorkspaceService>[2]) {
  const service = new HostWorkspaceService(db, directory, disk);
  services.push(service);
  return service;
}
describe('workspace operations with real serialized SQLite worker and filesystem', () => {
  it('reports observed aggregates/resources without private names, paths, fields or IDs', async () => {
    const status = (await host().request('workspaceStatus')) as WorkspaceStatus;
    expect(status.database).toMatchObject({
      integrity: 'ok',
      schemaVersion: 12,
      counts: { workflows: 1, jobs: 0, devices: 0, pendingEffects: 0 },
    });
    expect(status.host).toMatchObject({
      platform: process.platform,
      arch: process.arch,
      node: process.versions.node,
    });
    expect(status.host.memoryRssBytes).toBeGreaterThan(0);
    expect(status.disk.status).toBe('READY');
    const json = JSON.stringify(status);
    expect(json).not.toContain(directory);
    expect(json).not.toContain('private-fixture-name');
    expect(json).not.toContain('workflow_');
  });
  it('creates a consistent verified online backup, retries after restart, and recovers a receipt lost after final file commit', async () => {
    const service = host();
    const created = (await service.request('createWorkspaceBackup', {
      backupId: id,
    })) as WorkspaceBackupResult;
    expect(created).toMatchObject({
      alreadyCreated: false,
      receipt: { id, integrity: 'ok', schemaVersion: 12 },
    });
    const path = join(directory, 'backups', id + '.sqlite');
    expect((await fingerprint(path)).hash).toBe(created.receipt.sha256);
    const backup = new DatabaseSync(path, { readOnly: true });
    expect(backup.prepare('PRAGMA integrity_check').get()?.integrity_check).toBe('ok');
    expect(backup.prepare('SELECT COUNT(*) AS n FROM workflows').get()?.n).toBe(1);
    backup.close();
    await db.request('createWorkflow', { appId: 'fb', name: 'Created after backup' });
    await service.close();
    await db.close();
    db = new DbClient(join(directory, 'studio.sqlite'));
    const retry = (await host().request('createWorkspaceBackup', {
      backupId: id,
    })) as WorkspaceBackupResult;
    expect(retry).toEqual({ receipt: created.receipt, alreadyCreated: true });
    await unlink(join(directory, 'backups', id + '.json'));
    const recovered = (await host().request('createWorkspaceBackup', {
      backupId: id,
    })) as WorkspaceBackupResult;
    expect(recovered).toMatchObject({
      alreadyCreated: true,
      receipt: { sha256: created.receipt.sha256, bytes: created.receipt.bytes },
    });
    expect(JSON.parse(await readFile(join(directory, 'backups', id + '.json'), 'utf8'))).toEqual(
      recovered.receipt,
    );
    expect((await readdir(join(directory, 'backups'))).some((name) => name.startsWith('.'))).toBe(
      false,
    );
  });
  it('rejects tampered/missing backups and malformed public IDs or raw paths without overwriting data', async () => {
    const service = host();
    await expect(
      service.request('createWorkspaceBackup', { backupId: '../studio.sqlite' }),
    ).rejects.toThrow();
    await expect(
      service.request('createWorkspaceBackup', { backupId: id, path: '/tmp/other.sqlite' }),
    ).rejects.toThrow();
    await service.request('createWorkspaceBackup', { backupId: id });
    const path = join(directory, 'backups', id + '.sqlite');
    await writeFile(path, 'corrupt fixture bytes');
    await expect(service.request('createWorkspaceBackup', { backupId: id })).rejects.toMatchObject({
      code: 'INVALID_BACKUP',
    });
    expect(await readFile(path, 'utf8')).toBe('corrupt fixture bytes');
    await unlink(path);
    await expect(service.request('createWorkspaceBackup', { backupId: id })).rejects.toMatchObject({
      code: 'BACKUP_MISSING',
    });
    const workflows = ((await db.request('bootstrap')) as { workflows: WorkflowSummary[] })
      .workflows;
    expect(workflows[0]!.name).toBe('private-fixture-name-must-not-be-exported');
  });
  it('blocks low/unavailable disk and symlink destinations while keeping user files intact', async () => {
    await expect(
      host(async () => ({ status: 'READY', capacityBytes: 100, availableBytes: 1 })).request(
        'createWorkspaceBackup',
        { backupId: id },
      ),
    ).rejects.toMatchObject({ code: 'DISK_LOW' });
    await expect(
      host(async () => ({ status: 'UNAVAILABLE', reason: 'test unavailable' })).request(
        'createWorkspaceBackup',
        { backupId: id },
      ),
    ).rejects.toMatchObject({ code: 'DISK_UNAVAILABLE' });
    await rm(join(directory, 'backups'), { recursive: true });
    const outside = join(directory, 'other');
    await mkdir(outside);
    await writeFile(join(outside, 'user.txt'), 'keep');
    await symlink(outside, join(directory, 'backups'), 'dir');
    await expect(host().request('createWorkspaceBackup', { backupId: id })).rejects.toMatchObject({
      code: 'BACKUP_PATH',
    });
    expect(await readFile(join(outside, 'user.txt'), 'utf8')).toBe('keep');
  });
  it('bounds backups and waits for in-flight work before close, retaining a retryable final file', async () => {
    let resume: (() => void) | undefined;
    const blocked = new Promise<void>((resolve) => {
      resume = resolve;
    });
    const service = host(async () => {
      await blocked;
      return { status: 'READY', capacityBytes: 1e12, availableBytes: 1e12 };
    });
    const first = service.request('createWorkspaceBackup', { backupId: id });
    const same = service.request('createWorkspaceBackup', { backupId: id });
    await expect(
      service.request('createWorkspaceBackup', { backupId: otherId }),
    ).rejects.toMatchObject({ code: 'BACKUP_BUSY' });
    const closed = service.close();
    resume!();
    await expect(first).rejects.toMatchObject({ code: 'CANCELLED' });
    await expect(same).rejects.toMatchObject({ code: 'CANCELLED' });
    await closed;
    await expect(service.request('workspaceStatus')).rejects.toMatchObject({
      code: 'WORKSPACE_CLOSED',
    });
    expect(
      (await readdir(join(directory, 'backups'))).some((name) => name.startsWith('.backup-')),
    ).toBe(false);
    await expect(host().request('createWorkspaceBackup', { backupId: id })).resolves.toMatchObject({
      alreadyCreated: false,
    });
  });
});
