export type TransportState =
  'CONNECTED' | 'UNAUTHORIZED' | 'OFFLINE' | 'NO_PERMISSIONS' | 'DISCONNECTED';
export interface AdbDiagnostic {
  status: 'READY' | 'SDK_MISSING' | 'SDK_INVALID' | 'SERVER_MISSING' | 'SERVER_MISMATCH' | 'ERROR';
  message: string;
  version: string | null;
  protocol: number | null;
  binaryHash: string | null;
  serverPort: number;
  ownedServer: boolean;
}
export interface DeviceMetadata {
  hardwareSerial: string | null;
  manufacturer: string;
  model: string;
  product: string;
  androidVersion: string;
  sdk: number;
  locale: string;
}
export interface TransportObservation {
  serial: string;
  kind: 'USB' | 'TCP' | 'EMULATOR';
  state: TransportState;
  metadata: DeviceMetadata | null;
}
export interface DeviceRecord {
  id: string;
  name: string;
  enabled: boolean;
  revision: number;
  metadata: DeviceMetadata | null;
  identity: 'VERIFIED_PROPERTIES' | 'PROVISIONAL' | 'CONFLICT';
  transports: {
    serial: string;
    kind: TransportObservation['kind'];
    state: TransportState;
    generation: number;
    identityVerified: boolean;
    lastSeen: string;
  }[];
  owner: { kind: string; expiresAt: number } | null;
  capabilities: {
    connected: boolean;
    manualControl: boolean;
    screenshot: boolean;
    stream: false;
    automation: false;
    reasons: string[];
  };
}
export interface DeviceEndpointPolicy {
  endpoint: string;
  resolvedSerial: string | null;
  desired: boolean;
  revision: number;
  failures: number;
  nextAttemptUtc: string | null;
  lastErrorCode: string | null;
  deviceId: string | null;
}
export interface DeviceSnapshot {
  sequence: number;
  scanning: boolean;
  observedAt: string | null;
  diagnostic: AdbDiagnostic;
  devices: DeviceRecord[];
  nativeSdkPicker: boolean;
  endpoints: DeviceEndpointPolicy[];
}
export interface DeviceCapture {
  id: string;
  deviceId: string;
  transportGeneration: number;
  transportSerial: string;
  deviceRevision: number;
  width: number;
  height: number;
  capturedAt: string;
  rotation: number | null;
  mimeType: 'image/png';
  data: string;
}
export type ManualDeviceAction =
  | { type: 'KEY'; key: 'BACK' | 'HOME' | 'RECENT' | 'POWER' | 'VOLUME_UP' | 'VOLUME_DOWN' }
  | { type: 'TAP'; captureId: string; x: number; y: number }
  | {
      type: 'SWIPE';
      captureId: string;
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      durationMs: number;
    }
  | { type: 'LAUNCH' | 'FORCE_STOP'; packageName: string }
  | { type: 'SYSTEM'; target: 'SETTINGS' | 'FILES' | 'GALLERY' | 'BROWSER' | 'VPN' };
export interface DevicePackage {
  packageName: string;
}


/** Display-safe, bounded preview: never exposes a raw ADB serial or identity fingerprint. */
export interface DeviceResolutionPreview {
  deviceId: string;
  expectedRevision: number;
  name: string;
  model: string | null;
  token: string | null;
  expiresAt: string | null;
  canApply: boolean;
  blockers: string[];
}
export interface DeviceResolutionResult {
  deviceId: string;
  auditId: string;
  revision: number;
  enabled: false;
}

export interface DeviceResolutionApplyResponse {
  cancelled: boolean;
  resolution: DeviceResolutionResult | null;
  snapshot: DeviceSnapshot;
}
