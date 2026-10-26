export interface SourceDefinition {
  id: string;
  processId: string;
  kind: 'FOLDER' | 'FILE';
  displayPath: string;
  recursive: boolean;
  watch: boolean;
  revision: number;
  active: boolean;
  requiresRebind: boolean;
}
/** Private host grant. Never accept this shape from a renderer or imported document. */
export interface SourceGrant {
  id: string;
  processId: string;
  kind: 'FOLDER' | 'FILE';
  rootPath: string;
  recursive: boolean;
  watch: boolean;
  revision: number;
  active: boolean;
  hostId: string;
}
export interface ScannedAsset {
  relativePath: string;
  hash: string;
  bytes: number;
  mtimeMs: number;
  kind: 'image' | 'video';
  probe:
    | {
        status: 'READY';
        durationSeconds: number | null;
        width: number | null;
        height: number | null;
      }
    | { status: 'UNAVAILABLE' | 'ERROR'; reason: string };
}
export interface SourceScanReport {
  sourceId: string;
  status: 'COMPLETED' | 'CANCELLED' | 'ERROR';
  scanned: number;
  added: number;
  unchanged: number;
  changed: number;
  ignored: number;
  missing: number;
  failed: number;
  errors: string[];
}
