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

export interface SourceScanProgress extends Omit<SourceScanReport, 'status'> {
  scanId: string;
  status: 'QUEUED' | 'SCANNING' | SourceScanReport['status'];
  updatedAt: string;
}
export interface SourceState {
  source: SourceDefinition;
  scan: SourceScanProgress | null;
  watchWarning: string | null;
}
export interface ContentAssetInfo {
  id: string;
  contentId: string;
  relativePath: string;
  hash: string;
  kind: 'image' | 'video';
  bytes: number;
  state: 'READY' | 'CHANGED' | 'MISSING' | 'IGNORED' | 'UNTRACKED';
  probe: ScannedAsset['probe'] | null;
}
export interface MediaAdoptionPreview {
  token: string;
  expiresAt: string;
  processId: string;
  assetId: string;
  relativePath: string;
  previousHash: string;
  nextHash: string;
  bytes: number;
  contentCount: number;
  warnings: string[];
}
export interface MediaAdoptionResult {
  process: import('./models.js').ProcessDefinition;
  oldAssetId: string;
  assetId: string;
  contentIds: string[];
  alreadyApplied: boolean;
}
/** Private host-only read capability. Never expose grant/rootPath to adoption requests. */
export interface MediaAssetBinding {
  grant: SourceGrant;
  assetId: string;
  relativePath: string;
  expectedHash: string;
  observedHash: string;
  state: ContentAssetInfo['state'];
}
export type MediaAdoptionPlan =
  | { status: 'APPLIED'; result: MediaAdoptionResult }
  | { status: 'PENDING'; binding: MediaAssetBinding; scanned: ScannedAsset };

/** PRIVATE host/DB-worker grant plan. Never expose to StudioApi, HTTP or preload. */
export interface JobMediaPreflightPlan {
  jobId: string;
  jobRevision: number;
  snapshotHash: string;
  entries: {
    assetId: string;
    pinnedHash: string;
    pinnedBytes: number;
    binding: MediaAssetBinding;
  }[];
}
/** Redacted host-only observation, not durable evidence or execution permission. */
export interface JobMediaByteReport {
  jobId: string;
  inspectedAt: string;
  scope: 'HOST_BYTES_ONLY';
  status: 'BYTES_MATCHED' | 'NO_MEDIA';
  verifiedMediaCount: number;
  canDispatch: false;
}

export type StageReconciliationClassification =
  | 'REMOTE_BYTES_MATCHED' | 'MEDIASTORE_ROW_MATCHED_NOT_PICKER_VERIFIED'
  | 'REMOTE_MISSING' | 'REMOTE_MISMATCH' | 'PROBE_UNSUPPORTED' | 'REVIEW_REQUIRED';
export interface DeviceStageReconciliation {
  id: string; requestId: string; stageId: string; jobId: string; deviceId: string;
  hostId: string; claimGeneration: number; classification: StageReconciliationClassification;
  observedHash: string | null; observedBytes: number | null;
  mediaStoreStatus: 'INDEXED_EXACT' | 'NOT_INDEXED' | 'AMBIGUOUS' | 'UNSUPPORTED' | null;
  createdAt: string;
}
/** Private DB/host remote staging journal; not a posting or MediaStore receipt. */
export interface DeviceStageTransfer {
  id: string;
  jobId: string;
  deviceId: string;
  hostId: string;
  assetId: string;
  ordinal: number;
  snapshotHash: string;
  expectedHash: string;
  expectedBytes: number;
  claimGeneration: number;
  remotePath: string;
  nonce: string;
  state: 'INTENT' | 'TRANSFER_UNCERTAIN' | 'SYNC_ACK_UNVERIFIED' | 'NEEDS_REVIEW';
  remoteReadbackHash: string | null;
  remoteReadbackBytes: number | null;
  remoteReadbackAt: string | null;
  mediaStoreRowId: string | null;
  mediaStoreDisplayName: string | null;
  mediaStoreRelativePath: string | null;
  mediaStoreMimeType: string | null;
  mediaStoreBytes: number | null;
  mediaStoreAt: string | null;
  createdAt: string;
  updatedAt: string;
}
