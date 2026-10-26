import { z } from 'zod';
import { idSchema, hashSchema, jobStateSchema } from './models.js';
import type { WorkflowBundle, JsonValue } from './types.js';

export interface WorkflowDraft {
  workflowId: string;
  revision: number;
  bundle: WorkflowBundle;
  updatedAt: string;
}
export interface WorkflowVersion {
  id: string;
  workflowId: string;
  number: number;
  hash: string;
  bundle: WorkflowBundle;
  createdAt: string;
}
export interface MediaAsset {
  id: string;
  sourceRef: string;
  relativePath: string;
  hash: string;
  kind: 'image' | 'video' | 'other';
  bytes: number;
  mtimeMs: number;
}
export interface ContentItem {
  id: string;
  processId: string;
  revision: number;
  fields: Record<string, JsonValue>;
  assetIds: string[];
  ignored: boolean;
}
export interface JobSnapshot {
  workflowVersionId: string;
  workflowHash: string;
  bundle: WorkflowBundle;
  contentId: string;
  fields: Record<string, JsonValue>;
  assetIds: string[];
  targetId: string | null;
  accountId?: string | null;
  processRevision?: number;
  scheduleProfile?: import('./models.js').ScheduleProfile;
  assets?: import('./media.js').ContentAssetInfo[];
  networkProfileId: string | null;
}
export const jobSchema = z.strictObject({
  id: idSchema,
  occurrenceKey: hashSchema,
  processId: idSchema,
  deviceId: idSchema,
  contentId: idSchema,
  scheduledUtc: z.string().datetime(),
  state: jobStateSchema,
  revision: z.number().int().nonnegative(),
  priority: z.number().int(),
});
export type JobDefinition = z.infer<typeof jobSchema>;
export interface DeviceLease {
  deviceId: string;
  ownerId: string;
  ownerKind: 'MANUAL' | 'JOB' | 'INSPECTOR' | 'APK' | 'NETWORK';
  generation: number;
  expiresAt: number;
}
export interface BatchItem<T> {
  deviceId: string;
  outcome: 'SUCCESS' | 'FAILED' | 'CANCELLED';
  value?: T;
  errorCode?: string;
}
export function summarizeBatch<T>(items: readonly BatchItem<T>[]): {
  requested: number;
  succeeded: number;
  failed: number;
  cancelled: number;
} {
  if (new Set(items.map((i) => i.deviceId)).size !== items.length)
    throw new Error('Duplicate device in batch');
  return {
    requested: items.length,
    succeeded: items.filter((i) => i.outcome === 'SUCCESS').length,
    failed: items.filter((i) => i.outcome === 'FAILED').length,
    cancelled: items.filter((i) => i.outcome === 'CANCELLED').length,
  };
}
