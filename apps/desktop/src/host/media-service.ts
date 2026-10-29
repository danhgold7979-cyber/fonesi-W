import { mkdir, readFile, writeFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { contentHash } from '@autoreels/domain';
import {
  approveNativeSource,
  MediaCoordinator,
  resolveGrantedFile,
  fingerprint,
  probeMedia,
  mediaKind,
  HostStagingLedger,
} from '@autoreels/media';
import type {
  JobMediaPreflightPlan,
  JobMediaByteReport,
  MediaAssetBinding,
  MediaAdoptionPlan,
  MediaAdoptionResult,
  MediaAdoptionPreview,
  ScannedAsset,
} from '@autoreels/contracts';
import type { ApiCommand, SourceDefinition, SourceGrant } from '@autoreels/contracts';
import { assertJsonSafe } from '@autoreels/contracts';
import { DomainError } from '@autoreels/domain';
import type { InternalRequest } from './internal.js';
export interface MediaHostPort {
  request(command: ApiCommand, input?: unknown): Promise<unknown>;
  internal<T>(request: InternalRequest): Promise<T>;
}
import { mediaSchemas } from './service.js';

export type NativeSourcePicker = (kind: 'FOLDER' | 'FILE') => Promise<string[] | null>;
export async function loadHostId(directory: string): Promise<string> {
  await mkdir(directory, { recursive: true });
  const path = resolve(directory, 'host-id');
  try {
    await writeFile(path, 'host_' + randomUUID().replaceAll('-', ''), { flag: 'wx', mode: 0o600 });
  } catch (error) {
    if (!(error && typeof error === 'object' && 'code' in error && error.code === 'EEXIST'))
      throw error;
  }
  const id = (await readFile(path, 'utf8')).trim();
  if (!/^host_[a-f0-9]{32}$/.test(id))
    throw new DomainError('INVALID_HOST_ID', 'Host identity không hợp lệ.');
  return id;
}
export class HostMediaService {
  private closed = false;
  private mediaReads = new Set<Promise<unknown>>();
  private readControllers = new Set<AbortController>();
  private withMediaRead<T>(work: (signal: AbortSignal) => Promise<T>): Promise<T> {
    if (this.closed)
      return Promise.reject(new DomainError('MEDIA_CLOSED', 'Media service đã đóng.'));
    if (this.mediaReads.size >= 2)
      return Promise.reject(
        new DomainError('MEDIA_BUSY', 'Đang đọc fingerprint; đợi thao tác hiện tại hoàn tất.'),
      );
    const controller = new AbortController(),
      task = work(controller.signal);
    this.readControllers.add(controller);
    this.mediaReads.add(task);
    void task
      .finally(() => {
        this.readControllers.delete(controller);
        this.mediaReads.delete(task);
      })
      .catch(() => undefined);
    return task;
  }
  private async readMedia(binding: MediaAssetBinding, signal: AbortSignal): Promise<ScannedAsset> {
    if (signal.aborted) throw new DomainError('CANCELLED', 'Đã hủy đọc media.');
    const path = await resolveGrantedFile(binding.grant, binding.relativePath, this.hostId);
    const before = await stat(path),
      kind = mediaKind(path);
    if (!kind) throw new DomainError('INVALID_MEDIA', 'Loại media không được hỗ trợ.');
    const value = await fingerprint(path, signal),
      probe = await probeMedia(path, 'ffprobe', signal);
    const after = await stat(path);
    if (
      before.ino !== after.ino ||
      after.size !== value.bytes ||
      after.mtimeMs !== value.mtimeMs ||
      (await resolveGrantedFile(binding.grant, binding.relativePath, this.hostId)) !== path
    )
      throw new DomainError(
        'FILE_CHANGED_DURING_READ',
        'Tệp thay đổi trong khi đọc; xem trước lại.',
      );
    if (signal.aborted) throw new DomainError('CANCELLED', 'Đã hủy đọc media.');
    return { ...value, kind, relativePath: binding.relativePath, probe };
  }

  /**
   * Host-only byte-level diagnostic. Never a staging receipt, dispatch permit,
   * network proof or Android operation. Re-observe inside the actual runner.
   */
  inspectJobMediaBytes(jobId: string): Promise<JobMediaByteReport> {
    return this.withMediaRead(async (parentSignal) => {
      const plan = await this.db.internal<JobMediaPreflightPlan>({
        command: 'job.mediaPlan', jobId, hostId: this.hostId,
      });
      if (!plan.entries.length)
        return {
          jobId, inspectedAt: new Date().toISOString(), scope: 'HOST_BYTES_ONLY',
          status: 'NO_MEDIA', verifiedMediaCount: 0, canDispatch: false,
        };
      let totalBytes = 0;
      for (const entry of plan.entries) {
        if (parentSignal.aborted)
          throw new DomainError('CANCELLED', 'Đã dừng kiểm tra media.');
        if (
          !Number.isSafeInteger(entry.pinnedBytes) ||
          entry.pinnedBytes <= 0 ||
          entry.pinnedBytes > 4 * 1024 * 1024 * 1024 ||
          totalBytes + entry.pinnedBytes > 8 * 1024 * 1024 * 1024
        ) throw new DomainError('MEDIA_PREFLIGHT_BUDGET', 'Media exceeds host inspection budget.');
        totalBytes += entry.pinnedBytes;
        try {
          const signal = AbortSignal.any([parentSignal, AbortSignal.timeout(120000)]);
          const path = await resolveGrantedFile(
            entry.binding.grant, entry.binding.relativePath, this.hostId,
          );
          const before = await stat(path);
          if (!before.isFile() || before.size !== entry.pinnedBytes)
            throw new DomainError('MEDIA_BYTES_CHANGED', 'Media size no longer matches the snapshot.');
          const found = await fingerprint(path, signal);
          const after = await stat(path);
          if (
            found.hash !== entry.pinnedHash ||
            found.bytes !== entry.pinnedBytes ||
            after.ino !== before.ino ||
            after.mtimeMs !== before.mtimeMs ||
            (await resolveGrantedFile(
              entry.binding.grant, entry.binding.relativePath, this.hostId,
            )) !== path
          ) throw new DomainError('MEDIA_BYTES_CHANGED', 'Media bytes no longer match the snapshot.');
        } catch (error) {
          if (error instanceof DomainError) throw error;
          throw new DomainError(
            parentSignal.aborted ? 'CANCELLED' : 'MEDIA_READ_FAILED',
            'Không đọc được media đã cấp quyền trên host.',
          );
        }
      }
      const fresh = await this.db.internal<JobMediaPreflightPlan>({
        command: 'job.mediaPlan', jobId, hostId: this.hostId,
      });
      if (contentHash(plan) !== contentHash(fresh))
        throw new DomainError('JOB_MEDIA_STALE', 'Job or host source changed during inspection.');
      return {
        jobId, inspectedAt: new Date().toISOString(), scope: 'HOST_BYTES_ONLY',
        status: 'BYTES_MATCHED', verifiedMediaCount: plan.entries.length,
        canDispatch: false,
      };
    });
  }

  /**
   * Private host operation. This is neither an Android MediaStore upload nor
   * a durable dispatch token; it is not routed to the public API.
   */
  stageJobHostMedia(jobId: string): Promise<import('@autoreels/media').HostStageResult> {
    if (!this.staging)
      return Promise.reject(new DomainError('STAGING_NOT_CONFIGURED', 'Host staging is unavailable.'));
    return this.withMediaRead(async (signal) => {
      const prior = await this.db.internal<JobMediaPreflightPlan>({
        command: 'job.mediaPlan', jobId, hostId: this.hostId,
      });
      const staged = await this.staging!.stage(prior, this.hostId, signal);
      const current = await this.db.internal<JobMediaPreflightPlan>({
        command: 'job.mediaPlan', jobId, hostId: this.hostId,
      });
      if (contentHash(prior) !== contentHash(current))
        throw new DomainError('JOB_MEDIA_STALE', 'Job/media changed during host staging.');
      return staged;
    });
  }

  readonly coordinator: MediaCoordinator;
  private choosing = false;
  private readonly staging: HostStagingLedger | null;
  constructor(
    private db: MediaHostPort,
    private hostId: string,
    private picker?: NativeSourcePicker,
    appDataDirectory?: string,
  ) {
    this.staging = appDataDirectory ? new HostStagingLedger(appDataDirectory) : null;
    this.coordinator = new MediaCoordinator(
      {
        grant: (id) => db.internal<SourceGrant>({ command: 'source.grant', id, hostId }),
        active: () => db.internal<SourceGrant[]>({ command: 'source.active', hostId }),
        apply: (grant, generation, asset) =>
          db.internal({ command: 'source.apply', grant, generation, asset }),
        finish: (grant, generation) => db.internal({ command: 'source.finish', grant, generation }),
      },
      hostId,
    );
  }
  async ready(): Promise<void> {
    await this.coordinator.refresh();
  }
  async request(command: ApiCommand, input: unknown): Promise<unknown> {
    if (command === 'saveProcess' || command === 'applyProcessClone') {
      const result = await this.db.request(command, input);
      await this.coordinator.refresh();
      return result;
    }
    if (!Object.hasOwn(mediaSchemas, command)) return this.db.request(command, input);
    assertJsonSafe(input);
    switch (command) {
      case 'previewMediaAdoption': {
        const p = mediaSchemas.previewMediaAdoption.parse(input);
        return this.withMediaRead(async (signal) => {
          const binding = await this.db.internal<MediaAssetBinding>({
            command: 'asset.binding',
            ...p,
            hostId: this.hostId,
          });
          const scanned = await this.readMedia(binding, signal);
          return this.db.internal<MediaAdoptionPreview>({
            command: 'asset.adoptPreview',
            binding,
            scanned,
          });
        });
      }
      case 'applyMediaAdoption': {
        const p = mediaSchemas.applyMediaAdoption.parse(input);
        return this.withMediaRead(async (signal) => {
          const plan = await this.db.internal<MediaAdoptionPlan>({
            command: 'asset.adoptPlan',
            token: p.token,
            hostId: this.hostId,
          });
          if (plan.status === 'APPLIED') return plan.result;
          const scanned = await this.readMedia(plan.binding, signal);
          return this.db.internal<MediaAdoptionResult>({
            command: 'asset.adoptApply',
            token: p.token,
            hostId: this.hostId,
            scanned,
          });
        });
      }
      case 'mediaCapabilities':
        mediaSchemas.mediaCapabilities.parse(input);
        return { nativeChooser: Boolean(this.picker) };
      case 'sources': {
        const p = mediaSchemas.sources.parse(input);
        const sources = await this.db.internal<SourceDefinition[]>({
          command: 'source.list',
          processId: p.processId,
          hostId: this.hostId,
        });
        return sources.map((source) => ({
          source,
          scan: this.coordinator.progress(source.id),
          watchWarning: this.coordinator.watchWarning(source.id),
        }));
      }
      case 'rebindSource': {
        const p = mediaSchemas.rebindSource.parse(input);
        if (!this.picker)
          throw new DomainError(
            'NATIVE_CHOOSER_UNAVAILABLE',
            'Mở bản desktop để chọn lại nguồn trên máy.',
          );
        if (this.choosing) throw new DomainError('CHOOSER_BUSY', 'Đang có hộp thoại chọn nguồn.');
        this.choosing = true;
        try {
          const binding = await this.db.internal<SourceGrant>({
            command: 'source.binding',
            id: p.id,
          });
          if (binding.revision !== p.expectedRevision)
            throw new DomainError('SOURCE_CHANGED', 'Nguồn đã đổi; tải lại trước khi chọn lại.');
          const paths = await this.picker(binding.kind);
          if (!paths?.length) return { cancelled: true, source: null };
          if (paths.length !== 1)
            throw new DomainError('SOURCE_LIMIT', 'Chọn đúng một thư mục hoặc tệp thay thế.');
          const rootPath = await approveNativeSource(paths[0]!, binding.kind);
          this.coordinator.cancel(p.id);
          await this.coordinator.idle(p.id);
          const source = await this.db.internal<SourceDefinition>({
            command: 'source.rebind',
            id: p.id,
            hostId: this.hostId,
            expectedRevision: p.expectedRevision,
            rootPath,
          });
          await this.coordinator.refresh();
          await this.coordinator.start(p.id);
          return { cancelled: false, source };
        } finally {
          this.choosing = false;
        }
      }
      case 'chooseSource': {
        const p = mediaSchemas.chooseSource.parse(input);
        if (!this.picker)
          throw new DomainError(
            'NATIVE_CHOOSER_UNAVAILABLE',
            'Mở bản desktop để chọn thư mục hoặc tệp trên máy.',
          );
        if (this.choosing) throw new DomainError('CHOOSER_BUSY', 'Đang có hộp thoại chọn nguồn.');
        this.choosing = true;
        try {
          const paths = await this.picker(p.kind);
          if (!paths?.length) return { cancelled: true, sources: [] };
          if (paths.length > 128 || (p.kind === 'FOLDER' && paths.length !== 1))
            throw new DomainError('SOURCE_LIMIT', 'Chọn tối đa 128 tệp hoặc một thư mục mỗi lần.');
          // Approval is all-or-nothing before any DB write; renderer cannot supply these paths.
          const approved = await Promise.all(
            paths.map((path) => approveNativeSource(path, p.kind)),
          );
          const sources = await this.db.internal<SourceDefinition[]>({
            command: 'source.register',
            processId: p.processId,
            expectedRevision: p.expectedRevision,
            grants: [...new Set(approved)].map((rootPath) => ({
              processId: p.processId,
              rootPath,
              kind: p.kind,
              recursive: p.kind === 'FOLDER' && p.recursive,
              watch: p.watch,
              hostId: this.hostId,
            })),
          });
          await this.coordinator.refresh();
          await Promise.all(sources.map((s) => this.coordinator.start(s.id)));
          return { cancelled: false, sources };
        } finally {
          this.choosing = false;
        }
      }
      case 'scanSource':
        return this.coordinator.start(mediaSchemas.scanSource.parse(input).id);
      case 'cancelSourceScan': {
        const p = mediaSchemas.cancelSourceScan.parse(input);
        await this.db.internal({ command: 'source.grant', id: p.id, hostId: this.hostId });
        this.coordinator.cancel(p.id);
        return null;
      }
      case 'updateSource': {
        const p = mediaSchemas.updateSource.parse(input);
        this.coordinator.cancel(p.id);
        await this.coordinator.idle(p.id);
        const source = await this.db.internal<SourceDefinition>({
          command: 'source.options',
          id: p.id,
          hostId: this.hostId,
          expectedRevision: p.expectedRevision,
          options: p.options,
        });
        await this.coordinator.refresh();
        if (source.active) await this.coordinator.start(source.id);
        return source;
      }
    }
    throw new DomainError('INVALID_REQUEST', 'Unsupported media operation');
  }
  async close(): Promise<void> {
    this.closed = true;
    for (const controller of this.readControllers) controller.abort();
    await Promise.allSettled([...this.mediaReads]);
    await this.coordinator.close();
  }
}
