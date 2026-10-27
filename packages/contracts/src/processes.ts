import type { ProcessDefinition } from './models.js';
import { z } from 'zod';

export const processCloneOptionsSchema = z
  .strictObject({
    name: z.string().trim().min(1).max(160),
    includeContent: z.boolean(),
    includeSources: z.boolean(),
    keepDevice: z.boolean(),
  })
  .refine(
    (options) => !options.includeSources || options.includeContent,
    'Copy content when copying registered sources',
  );

export interface ProcessCloneOptions {
  name: string;
  includeContent: boolean;
  includeSources: boolean;
  keepDevice: boolean;
}
export interface ProcessClonePreview {
  token: string;
  expiresAt: string;
  sourceProcessId: string;
  name: string;
  contentCount: number;
  sourceCount: number;
  assetCount: number;
  keepDevice: boolean;
  removedFields: { scope: 'row' | 'process'; key: string; reason: string }[];
  warnings: string[];
}
export interface ProcessCloneResult {
  process: ProcessDefinition;
  contentIds: string[];
  alreadyApplied: boolean;
}
