import {
  mkdir,
  realpath,
  lstat,
  stat,
  statfs,
  open,
  readFile,
  link,
  unlink,
} from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import type {
  ApiCommand,
  BackupReceipt,
  WorkspaceDatabaseStatus,
  WorkspaceStatus,
  WorkspaceBackupResult,
} from '@autoreels/contracts';
import { backupIdSchema, backupReceiptSchema, assertJsonSafe } from '@autoreels/contracts';
import { z } from 'zod';
import { DomainError } from '@autoreels/domain';
import { fingerprint, withinRoot } from '@autoreels/media';
import type { InternalRequest } from './internal.js';

export const workspaceSchemas = {
  workspaceStatus: z.strictObject({}),
  createWorkspaceBackup: z.strictObject({ backupId: backupIdSchema }),
};
interface WorkspacePort {
  internal<T>(request: InternalRequest): Promise<T>;
}
type Disk = WorkspaceStatus['disk'];
export class HostWorkspaceService {
  private closed = false;
  private abort = new AbortController();
  private tasks = new Set<Promise<unknown>>();
  private backingUp: { id: string; task: Promise<WorkspaceBackupResult> } | null = null;
  constructor(
    private db: WorkspacePort,
    private dataDirectory: string,
    private disk: (path: string) => Promise<Disk> = async (path) => {
      try {
        const info = await statfs(path),
          capacityBytes = info.blocks * info.bsize,
          availableBytes = info.bavail * info.bsize;
        if (
          !Number.isSafeInteger(capacityBytes) ||
          !Number.isSafeInteger(availableBytes) ||
          availableBytes < 0 ||
          capacityBytes < availableBytes
        )
          throw new Error('Invalid disk measurement');
        return { status: 'READY', capacityBytes, availableBytes };
      } catch {
        return {
          status: 'UNAVAILABLE',
          reason: 'Không đo được dung lượng đĩa của thư mục dữ liệu.',
        };
      }
    },
  ) {}
  handles(command: ApiCommand): boolean {
    return Object.hasOwn(workspaceSchemas, command);
  }
  private track<T>(task: Promise<T>): Promise<T> {
    this.tasks.add(task);
    void task.finally(() => this.tasks.delete(task)).catch(() => undefined);
    return task;
  }
  async request(command: ApiCommand, input: unknown = {}): Promise<unknown> {
    if (this.closed)
      return Promise.reject(new DomainError('WORKSPACE_CLOSED', 'Dịch vụ workspace đã đóng.'));
    if (this.tasks.size >= 4)
      return Promise.reject(
        new DomainError('WORKSPACE_BUSY', 'Đang kiểm tra workspace; đợi thao tác hiện tại.'),
      );
    assertJsonSafe(input);
    if (command === 'workspaceStatus') {
      workspaceSchemas.workspaceStatus.parse(input);
      return this.track(this.status());
    }
    if (command === 'createWorkspaceBackup') {
      const { backupId } = workspaceSchemas.createWorkspaceBackup.parse(input);
      if (this.backingUp) {
        if (this.backingUp.id === backupId) return this.backingUp.task;
        return Promise.reject(new DomainError('BACKUP_BUSY', 'Đang tạo bản sao lưu khác.'));
      }
      const task = this.track(this.backup(backupId));
      this.backingUp = { id: backupId, task };
      void task
        .finally(() => {
          this.backingUp = null;
        })
        .catch(() => undefined);
      return task;
    }
    return Promise.reject(new DomainError('INVALID_REQUEST', 'Thao tác workspace không hợp lệ.'));
  }
  private async status(): Promise<WorkspaceStatus> {
    const [database, disk] = await Promise.all([
      this.db.internal<WorkspaceDatabaseStatus>({ command: 'workspace.status' }),
      this.disk(this.dataDirectory),
    ]);
    return {
      format: 'autoreels-diagnostics-v1',
      observedAt: new Date().toISOString(),
      database,
      disk,
      host: {
        platform: process.platform,
        arch: process.arch,
        node: process.versions.node,
        electron: process.versions.electron ?? null,
        uptimeSeconds: Math.floor(process.uptime()),
        memoryRssBytes: process.memoryUsage().rss,
      },
    };
  }
  private async root(): Promise<string> {
    const directory = await realpath(this.dataDirectory),
      root = join(directory, 'backups');
    await mkdir(root, { recursive: true, mode: 0o700 });
    const info = await lstat(root),
      canonical = await realpath(root);
    if (!info.isDirectory() || info.isSymbolicLink() || !withinRoot(directory, canonical))
      throw new DomainError(
        'BACKUP_PATH',
        'Thư mục sao lưu không được là symlink hoặc nằm ngoài workspace.',
      );
    return canonical;
  }
  private async safeFile(path: string, root: string): Promise<boolean> {
    try {
      const info = await lstat(path);
      if (!info.isFile() || info.isSymbolicLink() || !withinRoot(root, await realpath(path)))
        throw new DomainError('BACKUP_PATH', 'Tệp sao lưu không có quyền sở hữu hợp lệ.');
      return true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
      throw error;
    }
  }
  private async receipt(root: string, id: string, path: string): Promise<BackupReceipt> {
    const metadata = await this.db.internal<{ schemaVersion: number }>({
      command: 'workspace.validateBackup',
      path,
    });
    const value = await fingerprint(path, this.abort.signal),
      receiptPath = join(root, id + '.json');
    if (await this.safeFile(receiptPath, root)) {
      const receipt = backupReceiptSchema.parse(JSON.parse(await readFile(receiptPath, 'utf8')));
      if (
        receipt.id !== id ||
        receipt.bytes !== value.bytes ||
        receipt.sha256 !== value.hash ||
        receipt.schemaVersion !== metadata.schemaVersion
      )
        throw new DomainError(
          'BACKUP_CHANGED',
          'Bản sao lưu không còn khớp receipt; không ghi đè.',
        );
      return receipt;
    }
    const receipt: BackupReceipt = {
      id,
      createdAt: new Date().toISOString(),
      bytes: value.bytes,
      sha256: value.hash,
      schemaVersion: metadata.schemaVersion,
      integrity: 'ok',
    };
    const partial = join(root, '.receipt-' + randomUUID());
    try {
      const handle = await open(partial, 'wx', 0o600);
      try {
        await handle.writeFile(JSON.stringify(receipt, null, 2));
        await handle.sync();
      } finally {
        await handle.close();
      }
      try {
        await link(partial, receiptPath);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
        return this.receipt(root, id, path);
      }
    } finally {
      await unlink(partial);
    }
    return receipt;
  }
  private async backup(id: string): Promise<WorkspaceBackupResult> {
    const root = await this.root(),
      path = join(root, id + '.sqlite');
    if (await this.safeFile(path, root))
      return { receipt: await this.receipt(root, id, path), alreadyCreated: true };
    if (await this.safeFile(join(root, id + '.json'), root))
      throw new DomainError(
        'BACKUP_MISSING',
        'Tệp backup đã mất nhưng receipt còn; không tạo đè ID cũ.',
      );
    const disk = await this.disk(root);
    if (disk.status !== 'READY') throw new DomainError('DISK_UNAVAILABLE', disk.reason);
    const sizes = await Promise.all(
      ['studio.sqlite', 'studio.sqlite-wal'].map(async (name) => {
        try {
          return (await stat(join(this.dataDirectory, name))).size;
        } catch (e) {
          if ((e as NodeJS.ErrnoException).code === 'ENOENT') return 0;
          throw e;
        }
      }),
    );
    if (disk.availableBytes < sizes.reduce((sum, size) => sum + size, 0) + 64 * 1024 * 1024)
      throw new DomainError(
        'DISK_LOW',
        'Cần đủ dung lượng DB/WAL và tối thiểu 64 MiB dự phòng để sao lưu.',
      );
    const partial = join(root, '.backup-' + randomUUID());
    const handle = await open(partial, 'wx', 0o600);
    await handle.close();
    try {
      if (this.closed) throw new DomainError('CANCELLED', 'Đã dừng sao lưu khi đóng workspace.');
      await this.db.internal({ command: 'workspace.backup', path: partial });
      if (this.closed) throw new DomainError('CANCELLED', 'Đã dừng sao lưu khi đóng workspace.');
      const completed = await open(partial, 'r');
      try {
        await completed.sync();
      } finally {
        await completed.close();
      }
      let created = true;
      try {
        await link(partial, path);
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code !== 'EEXIST') throw e;
        created = false;
      }
      if (!(await this.safeFile(path, root)))
        throw new DomainError('BACKUP_MISSING', 'Chưa tìm thấy tệp sao lưu đã tạo.');
      return { receipt: await this.receipt(root, id, path), alreadyCreated: !created };
    } finally {
      await unlink(partial);
    }
  }
  async close(): Promise<void> {
    this.closed = true;
    this.abort.abort();
    await Promise.allSettled([...this.tasks]);
  }
}
