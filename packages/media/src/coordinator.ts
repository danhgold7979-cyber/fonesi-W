import { watch, type FSWatcher } from 'node:fs';
import { randomUUID } from 'node:crypto';
import type { SourceGrant, ScannedAsset, SourceScanProgress } from '@autoreels/contracts';
import { DomainError } from '@autoreels/domain';
import { scanSource } from './index.js';

export interface MediaRepository {
  grant(id: string): Promise<SourceGrant>;
  active(): Promise<SourceGrant[]>;
  apply(
    grant: SourceGrant,
    generation: string,
    asset: ScannedAsset,
  ): Promise<'added' | 'unchanged' | 'changed' | 'ignored'>;
  finish(grant: SourceGrant, generation: string): Promise<number>;
}
interface Task {
  grant: SourceGrant;
  controller: AbortController;
  progress: SourceScanProgress;
  done: Promise<void>;
  resolve: () => void;
  rescan: boolean;
}
interface Observation {
  revision: number;
  watcher: FSWatcher | null;
  timer: ReturnType<typeof setTimeout> | null;
  warning: string | null;
}
/** Host-only coordinator. Hash/probe are asynchronous; the DB port remains serialized. */
export class MediaCoordinator {
  private tasks = new Map<string, Task>();
  private reports = new Map<string, SourceScanProgress>();
  private observations = new Map<string, Observation>();
  private running = 0;
  private closed = false;
  private interval: ReturnType<typeof setInterval> | null = null;
  constructor(
    private repo: MediaRepository,
    private hostId: string,
    private options: {
      concurrency?: number;
      reconcileMs?: number;
      debounceMs?: number;
      probeExecutable?: string;
      watchFactory?: typeof watch;
    } = {},
  ) {
    if (
      !Number.isInteger(options.concurrency ?? 2) ||
      (options.concurrency ?? 2) < 1 ||
      (options.concurrency ?? 2) > 8
    )
      throw new Error('Invalid scan concurrency');
  }
  progress(id: string): SourceScanProgress | null {
    const value = this.tasks.get(id)?.progress ?? this.reports.get(id);
    return value ? structuredClone(value) : null;
  }
  watchWarning(id: string): string | null {
    return this.observations.get(id)?.warning ?? null;
  }
  async start(id: string): Promise<SourceScanProgress> {
    if (this.closed) throw new DomainError('MEDIA_CLOSED', 'Media service đã đóng.');
    const grant = await this.repo.grant(id);
    if (this.closed) throw new DomainError('MEDIA_CLOSED', 'Media service đã đóng.');
    if (!grant.active || grant.hostId !== this.hostId)
      throw new DomainError('SOURCE_CHANGED', 'Nguồn không còn hoạt động trên host.');
    const previous = this.tasks.get(id);
    if (previous) return structuredClone(previous.progress);
    let resolve!: () => void;
    const done = new Promise<void>((r) => {
      resolve = r;
    });
    const task: Task = {
      grant,
      controller: new AbortController(),
      done,
      resolve,
      rescan: false,
      progress: {
        sourceId: id,
        scanId: 'scan_' + randomUUID().replaceAll('-', ''),
        status: 'QUEUED',
        scanned: 0,
        added: 0,
        unchanged: 0,
        changed: 0,
        ignored: 0,
        missing: 0,
        failed: 0,
        errors: [],
        updatedAt: new Date().toISOString(),
      },
    };
    this.tasks.set(id, task);
    // Start on a microtask so the caller gets a stable queued/scanning DTO immediately.
    queueMicrotask(() => this.drain());
    return structuredClone(task.progress);
  }
  cancel(id: string): void {
    const task = this.tasks.get(id);
    if (task) {
      task.rescan = false;
      task.controller.abort();
    }
    const observation = this.observations.get(id);
    if (observation?.timer) {
      clearTimeout(observation.timer);
      observation.timer = null;
    }
    this.drain();
  }
  async idle(id: string): Promise<void> {
    await this.tasks.get(id)?.done;
  }
  private drain(): void {
    for (const task of this.tasks.values()) {
      if (task.progress.status !== 'QUEUED') continue;
      if (this.running >= (this.options.concurrency ?? 2)) break;
      task.progress.status = 'SCANNING';
      this.running++;
      void this.run(task);
    }
  }
  private async run(task: Task): Promise<void> {
    const p = task.progress,
      signal = task.controller.signal;
    const failed = (path: string, error: unknown): void => {
      p.failed++;
      if (p.errors.length < 20)
        p.errors.push(
          path +
            ': ' +
            (error instanceof DomainError
              ? error.message
              : 'Không đọc được media; kiểm tra quyền hoặc file đang được ghi.'),
        );
      p.updatedAt = new Date().toISOString();
    };
    try {
      if (!signal.aborted)
        await scanSource(
          task.grant,
          this.hostId,
          async (asset) => {
            if (signal.aborted) return;
            const outcome = await this.repo.apply(task.grant, p.scanId, asset);
            p.scanned++;
            p[outcome]++;
            p.updatedAt = new Date().toISOString();
          },
          {
            signal,
            ...(this.options.probeExecutable
              ? { probeExecutable: this.options.probeExecutable }
              : {}),
            onError: failed,
          },
        );
      // Incomplete enumeration must never mark unseen media as missing.
      if (!signal.aborted && p.failed === 0)
        p.missing = await this.repo.finish(task.grant, p.scanId);
      p.status = signal.aborted ? 'CANCELLED' : p.failed ? 'ERROR' : 'COMPLETED';
    } catch (error) {
      if (!signal.aborted) failed('Nguồn', error);
      p.status = signal.aborted ? 'CANCELLED' : 'ERROR';
    } finally {
      p.updatedAt = new Date().toISOString();
      this.reports.set(p.sourceId, structuredClone(p));
      this.tasks.delete(p.sourceId);
      this.running--;
      task.resolve();
      this.drain();
      if (task.rescan && !this.closed) this.requestRescan(p.sourceId);
    }
  }
  private requestRescan(id: string): void {
    if (this.closed) return;
    const observation = this.observations.get(id);
    if (!observation) return;
    const task = this.tasks.get(id);
    if (task) {
      task.rescan = true;
      return;
    }
    void this.start(id).catch(() => {
      observation.warning = 'Chưa quét được nguồn; kiểm tra nguồn và chọn quét lại.';
    });
  }
  async refresh(): Promise<void> {
    const grants = await this.repo.active();
    if (this.closed) return;
    const active = new Map(grants.map((g) => [g.id, g]));
    for (const [id, task] of this.tasks) {
      const current = active.get(id);
      if (!current || current.revision !== task.grant.revision) this.cancel(id);
    }
    for (const [id, observation] of this.observations) {
      const current = active.get(id);
      if (!current?.watch || current.revision !== observation.revision) {
        observation.watcher?.close();
        if (observation.timer) clearTimeout(observation.timer);
        this.observations.delete(id);
      }
    }
    for (const grant of grants) {
      if (!grant.watch || this.observations.has(grant.id)) continue;
      const observation: Observation = {
        revision: grant.revision,
        watcher: null,
        timer: null,
        warning: null,
      };
      this.observations.set(grant.id, observation);
      try {
        observation.watcher = (this.options.watchFactory ?? watch)(
          grant.rootPath,
          { recursive: grant.kind === 'FOLDER' && grant.recursive },
          () => {
            if (observation.timer) clearTimeout(observation.timer);
            observation.timer = setTimeout(() => {
              observation.timer = null;
              this.requestRescan(grant.id);
            }, this.options.debounceMs ?? 600);
            observation.timer.unref();
          },
        );
        observation.watcher.on('error', () => {
          observation.warning = 'Watcher không khả dụng; vẫn quét đối chiếu mỗi 10 giây.';
          observation.watcher?.close();
          observation.watcher = null;
        });
        observation.watcher.unref();
      } catch {
        observation.warning = 'Watcher không khả dụng; vẫn quét đối chiếu mỗi 10 giây.';
      }
      this.requestRescan(grant.id);
    }
    if (!this.interval && this.observations.size) {
      this.interval = setInterval(() => {
        // Skip scans already running: polling must not create an endless backlog.
        for (const id of this.observations.keys()) if (!this.tasks.has(id)) this.requestRescan(id);
      }, this.options.reconcileMs ?? 10000);
      this.interval.unref();
    } else if (this.interval && !this.observations.size) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }
  async close(): Promise<void> {
    this.closed = true;
    if (this.interval) clearInterval(this.interval);
    for (const observation of this.observations.values()) {
      observation.watcher?.close();
      if (observation.timer) clearTimeout(observation.timer);
    }
    this.observations.clear();
    const tasks = [...this.tasks.values()];
    for (const task of tasks) {
      task.rescan = false;
      task.controller.abort();
    }
    this.drain();
    await Promise.all(tasks.map((task) => task.done));
  }
}
