import { z } from 'zod';

export const backupIdSchema = z.string().regex(/^backup_[a-f0-9]{32}$/);
export const backupReceiptSchema = z.strictObject({
  id: backupIdSchema,
  createdAt: z.string().datetime(),
  bytes: z.number().int().nonnegative(),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  schemaVersion: z.number().int().positive(),
  integrity: z.literal('ok'),
});
export type BackupReceipt = z.infer<typeof backupReceiptSchema>;
export interface WorkspaceDatabaseStatus {
  schemaVersion: number;
  integrity: 'ok' | 'error';
  counts: {
    workflows: number;
    processes: number;
    contentItems: number;
    jobs: number;
    devices: number;
    pendingEffects: number;
  };
}
export interface WorkspaceStatus {
  format: 'autoreels-diagnostics-v1';
  observedAt: string;
  host: {
    platform: string;
    arch: string;
    node: string;
    electron: string | null;
    uptimeSeconds: number;
    memoryRssBytes: number;
  };
  disk:
    | { status: 'READY'; capacityBytes: number; availableBytes: number }
    | { status: 'UNAVAILABLE'; reason: string };
  database: WorkspaceDatabaseStatus;
}
export interface WorkspaceBackupResult {
  receipt: BackupReceipt;
  alreadyCreated: boolean;
}
