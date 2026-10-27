import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { approveNativeSource, MediaCoordinator } from '@autoreels/media';
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
  readonly coordinator: MediaCoordinator;
  private choosing = false;
  constructor(
    private db: MediaHostPort,
    private hostId: string,
    private picker?: NativeSourcePicker,
  ) {
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
    await this.coordinator.close();
  }
}
