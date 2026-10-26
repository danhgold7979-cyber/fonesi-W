import { z } from 'zod';

export const idSchema = z
  .string()
  .regex(/^[A-Za-z][A-Za-z0-9_-]*$/)
  .max(128);
export const packageNameSchema = z
  .string()
  .regex(/^[A-Za-z][A-Za-z0-9_]*(\.[A-Za-z][A-Za-z0-9_]*)+$/)
  .max(256);
export const hashSchema = z.string().regex(/^[a-f0-9]{64}$/);
export const appDefinitionSchema = z
  .strictObject({
    id: idSchema,
    name: z.string().trim().min(1).max(120),
    packages: z.array(packageNameSchema).min(1),
    targetKinds: z.array(z.enum(['profile', 'page', 'group', 'channel', 'custom'])),
    mediaKinds: z.array(z.enum(['text', 'image', 'video', 'multi'])),
    certification: z.enum(['NOT_RUN', 'SUPPORTED_PROFILES_ONLY']),
  })
  .refine((a) => new Set(a.packages).size === a.packages.length, 'Duplicate package');
export type AppDefinition = z.infer<typeof appDefinitionSchema>;

export const profileSchema = z.strictObject({
  deviceId: idSchema,
  packageName: packageNameSchema,
  versionCode: z.number().int().nonnegative(),
  versionName: z.string().min(1),
  locale: z.string().min(1),
  androidVersion: z.string().min(1),
  selectorProfileId: idSchema,
});
export type DeviceAppProfile = z.infer<typeof profileSchema>;
export interface WorkflowReceipt {
  workflowHash: string;
  profile: DeviceAppProfile;
  result: 'PASS' | 'FAIL';
  kind: 'DEVICE_TEST' | 'ADAPTER_CERTIFICATION';
  readyByUser: boolean;
}
export const workflowReceiptSchema = z.strictObject({
  workflowHash: hashSchema,
  profile: profileSchema,
  result: z.enum(['PASS', 'FAIL']),
  kind: z.enum(['DEVICE_TEST', 'ADAPTER_CERTIFICATION']),
  readyByUser: z.boolean(),
});

export const jobStates = [
  'DRAFT',
  'SCHEDULED',
  'QUEUED',
  'PREFLIGHT',
  'RUNNING',
  'POST_INTENT',
  'POST_PENDING',
  'POSTED',
  'COMMENT_PENDING',
  'SUCCESS',
  'SUCCESS_WITH_WARNINGS',
  'WAITING_DEVICE',
  'WAITING_NETWORK',
  'MEDIA_MISSING',
  'MEDIA_CHANGED',
  'TARGET_MISSING',
  'NEEDS_REVIEW',
  'FAILED',
  'CANCELLED',
  'SKIPPED',
] as const;
export const jobStateSchema = z.enum(jobStates);
export type JobState = z.infer<typeof jobStateSchema>;
export const effectStates = [
  'INTENT',
  'ATTEMPT_UNCERTAIN',
  'CONFIRMED',
  'DEFINITIVELY_REJECTED',
  'NEEDS_REVIEW',
] as const;
export type EffectState = (typeof effectStates)[number];
export type RunMode = 'TRACE' | 'DEVICE_TEST' | 'REAL_JOB';
export const overduePolicySchema = z.enum(['NEXT_FUTURE_SLOT', 'CATCH_UP', 'SKIP']);
export const timezoneSchema = z.string().refine((v) => {
  try {
    new Intl.DateTimeFormat('en', { timeZone: v });
    return true;
  } catch {
    return false;
  }
}, 'Invalid IANA timezone');
export const localDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((v) => {
    const d = new Date(v + 'T00:00:00Z');
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
  }, 'Invalid local calendar date');
export const scheduleProfileSchema = z
  .strictObject({
    timezone: timezoneSchema,
    startDate: localDateSchema,
    slots: z.array(z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/)).min(1),
    weekdays: z.array(z.number().int().min(1).max(7)).min(1),
    overduePolicy: overduePolicySchema,
    jitterMinutes: z.number().int().min(0).max(1440),
  })
  .refine(
    (s) =>
      new Set(s.slots).size === s.slots.length && new Set(s.weekdays).size === s.weekdays.length,
    'Duplicate slots or weekdays',
  );
export type ScheduleProfile = z.infer<typeof scheduleProfileSchema>;

export const processSchema = z.strictObject({
  id: idSchema,
  name: z.string().trim().min(1).max(160),
  appId: idSchema,
  workflowId: idSchema.nullable(),
  workflowVersionId: idSchema.nullable(),
  deviceId: idSchema.nullable(),
  accountId: idSchema.nullable(),
  targetId: idSchema.nullable(),
  revision: z.number().int().nonnegative(),
  archived: z.boolean(),
  schedule: scheduleProfileSchema,
});
export type ProcessDefinition = z.infer<typeof processSchema>;
export const requestSchema = z.strictObject({
  operationId: idSchema,
  expectedRevision: z.number().int().nonnegative().optional(),
});
export type OperationError = {
  code: string;
  message: string;
  retryable: boolean;
  retryScope: 'NONE' | 'READ' | 'SAFE_OPERATION' | 'VERIFY_FIRST';
  requiresReview: boolean;
};
export type OperationResult<T> =
  { ok: true; value: T } | { ok: false; error: OperationError } | { ok: false; cancelled: true };
export interface EventEnvelope<T> {
  sequence: number;
  operationId: string;
  entityId: string;
  revision: number;
  value: T;
}

export const SEED_APPS: readonly AppDefinition[] = [
  {
    id: 'fb',
    name: 'Facebook',
    packages: ['com.facebook.katana'],
    targetKinds: ['profile', 'page', 'group'],
    mediaKinds: ['text', 'image', 'video', 'multi'],
    certification: 'NOT_RUN',
  },
  {
    id: 'lite',
    name: 'Facebook Lite',
    packages: ['com.facebook.lite'],
    targetKinds: ['profile', 'page'],
    mediaKinds: ['text', 'image', 'video'],
    certification: 'NOT_RUN',
  },
  {
    id: 'ig',
    name: 'Instagram',
    packages: ['com.instagram.android'],
    targetKinds: ['profile'],
    mediaKinds: ['image', 'video', 'multi'],
    certification: 'NOT_RUN',
  },
  {
    id: 'tt',
    name: 'TikTok',
    packages: ['com.zhiliaoapp.musically', 'com.ss.android.ugc.trill'],
    targetKinds: ['profile'],
    mediaKinds: ['image', 'video'],
    certification: 'NOT_RUN',
  },
  {
    id: 'threads',
    name: 'Threads',
    packages: ['com.instagram.barcelona'],
    targetKinds: ['profile'],
    mediaKinds: ['text', 'image', 'video', 'multi'],
    certification: 'NOT_RUN',
  },
];
