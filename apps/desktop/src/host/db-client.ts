import { Worker } from 'node:worker_threads';
import { randomUUID } from 'node:crypto';
import type { ApiCommand } from '@autoreels/contracts';
import type { InternalRequest } from './internal.js';

export class DbClient {
  private worker: Worker;
  private sequence = 0;
  private closed = false;
  private pending = new Map<
    number,
    { resolve: (value: unknown) => void; reject: (error: Error) => void }
  >();
  constructor(path: string, hostId: string | null = null) {
    this.worker = new Worker(new URL('./db-worker.js', import.meta.url), {
      workerData: { path, hostId },
    });
    this.worker.on(
      'message',
      (message: {
        id?: number;
        ready?: boolean;
        ok?: boolean;
        value?: unknown;
        error?: { code: string; message: string };
      }) => {
        if (message.id === undefined) return;
        const p = this.pending.get(message.id);
        if (!p) return;
        this.pending.delete(message.id);
        if (message.ok) p.resolve(message.value);
        else
          p.reject(
            Object.assign(new Error(message.error?.message ?? 'Database operation failed'), {
              code: message.error?.code ?? 'DATABASE_ERROR',
            }),
          );
      },
    );
    this.worker.on('error', (error) => {
      this.closed = true;
      this.fail(error);
    });
    this.worker.on('exit', () => {
      this.closed = true;
      this.fail(new Error('Database worker stopped'));
    });
  }
  private fail(error: Error): void {
    for (const p of this.pending.values()) p.reject(error);
    this.pending.clear();
  }
  request(command: ApiCommand, input: unknown = {}): Promise<unknown> {
    return this.enqueue({
      request: { operationId: 'op_' + randomUUID().replaceAll('-', ''), command, input },
    });
  }
  internal<T>(internal: InternalRequest): Promise<T> {
    return this.enqueue({ internal }) as Promise<T>;
  }
  private enqueue(payload: { request?: unknown; internal?: InternalRequest }): Promise<unknown> {
    if (this.closed) return Promise.reject(new Error('Database worker is closed'));
    if (this.pending.size >= 128) return Promise.reject(new Error('Database queue is busy'));
    const id = ++this.sequence;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.worker.postMessage({
        id,
        ...payload,
      });
    });
  }
  async close(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    const id = ++this.sequence;
    await new Promise<unknown>((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.worker.postMessage({ id, close: true });
    });
    await this.worker.terminate();
    this.fail(new Error('Database closed'));
  }
}
