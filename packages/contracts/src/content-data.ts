import type { ContentItem } from './persistence.js';
import type { FieldDefinition, JsonValue } from './types.js';
export type ContentFormat = 'JSON' | 'CSV' | 'XLSX';
export interface ContentImportRecord {
  contentId?: string;
  sourceId?: string;
  relativePath?: string;
  filename?: string;
  fields: Record<string, JsonValue>;
  errors?: string[];
  assetIds?: string[];
}
export interface ContentImportDocument {
  processId?: string;
  schema?: FieldDefinition[];
  records: ContentImportRecord[];
  conversions: string[];
}
export interface BulkContentRequest {
  selection: { id: string; revision: number }[];
  fieldKey: string;
  operation: 'SET' | 'APPEND' | 'PREPEND' | 'REMOVE';
  value?: JsonValue | undefined;
}
export interface ContentChange {
  line: number;
  contentId: string | null;
  action: 'CREATE' | 'UPDATE' | 'UNCHANGED' | 'ERROR';
  fields: string[];
  errors: string[];
  deltas?: {
    key: string;
    beforePresent: boolean;
    afterPresent: boolean;
    before?: JsonValue;
    after?: JsonValue;
  }[];
}
export interface ContentPreviewDto {
  token: string;
  processId: string;
  expiresAt: string;
  changes: ContentChange[];
  conversions: string[];
  impactedJobIds: string[];
  canApply: boolean;
}
export interface ContentApplyResult {
  contentIds: string[];
  created: number;
  updated: number;
  alreadyApplied: boolean;
}
export interface ContentExportDocument {
  format: 'autoreels-content';
  version: 1;
  processId: string;
  schema: FieldDefinition[];
  rows: { contentId: string; fields: ContentItem['fields']; assetIds: string[] }[];
}
export interface ContentDownload {
  filename: string;
  mimeType: string;
  encoding: 'utf8' | 'base64';
  data: string;
}
