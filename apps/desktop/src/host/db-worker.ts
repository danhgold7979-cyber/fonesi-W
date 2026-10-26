import { parentPort, workerData } from 'node:worker_threads';
import { StudioDatabase } from '@autoreels/database';
import { DomainError } from '@autoreels/domain';
import { dispatch } from './service.js';
import { dispatchInternal, type InternalRequest } from './internal.js';

const db = new StudioDatabase((workerData as { path: string }).path);
let queue = Promise.resolve();
parentPort?.on(
  'message',
  (message: { id: number; request?: unknown; internal?: InternalRequest; close?: boolean }) => {
    queue = queue.then(async () => {
      if (message.close) {
        db.close();
        parentPort?.postMessage({ id: message.id, ok: true, value: null });
        parentPort?.close();
        return;
      }
      try {
        const value = message.internal
          ? dispatchInternal(db, message.internal)
          : await dispatch(
              db,
              message.request,
              (workerData as { hostId?: string | null }).hostId ?? null,
            );
        parentPort?.postMessage({ id: message.id, ok: true, value });
      } catch (error) {
        parentPort?.postMessage({
          id: message.id,
          ok: false,
          error: {
            code: error instanceof DomainError ? error.code : 'INVALID_REQUEST',
            message:
              error instanceof DomainError ? error.message : 'Dữ liệu hoặc thao tác không hợp lệ.',
          },
        });
      }
    });
  },
);
parentPort?.postMessage({ ready: true });
