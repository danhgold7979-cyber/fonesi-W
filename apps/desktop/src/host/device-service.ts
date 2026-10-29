import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { AdbClient, SdkManager, parseEndpoint, parseUiXml } from '@autoreels/devices';
import type {
  AdbDiagnostic,
  ApiCommand,
  BootstrapData,
  DeviceCapture,
  InspectorSnapshot,
  DeviceSelectorLiveReport,
  DeviceEndpointPolicy,
  DeviceLease,
  DeviceRecord,
  DeviceSnapshot,
  TransportObservation,
  DeviceResolutionPreview,
  DeviceResolutionResult,
  DeviceResolutionAuditPage,
  ManualDeviceAction,
} from '@autoreels/contracts';
import {
  assertJsonSafe,
  inspectUiSelectorMatches,
  uiSelectorSchema,
  uiSelectorV2Schema,
} from '@autoreels/contracts';
import { DomainError } from '@autoreels/domain';
import type { MediaHostPort } from './media-service.js';
import { deviceSchemas } from './service.js';

interface Config {
  path?: string;
  hash?: string;
  port: number;
}
export type SdkPicker = () => Promise<string | null>;
export class HostDeviceService {
  private config: Config;
  private sdk: SdkManager;
  private adb: AdbClient;
  private closed = false;
  private configuring = false;
  private sequence = 0;
  private observedAt: string | null = null;
  private scanPromise: Promise<void> | null = null;
  private scanController: AbortController | null = null;
  private lifecycle = new AbortController();
  private poll: ReturnType<typeof setTimeout> | null = null;
  private actors = new Map<string, Promise<unknown>>();
  private queued = 0;
  private connecting = new Set<string>();
  private networkTasks = new Set<Promise<unknown>>();
  private actorEpoch = new Map<string, number>();
  private captures = new Map<string, { capture: DeviceCapture; serial: string }>();
  private diagnostic: AdbDiagnostic = {
    status: 'ERROR',
    message: 'Đang kiểm tra ADB.',
    version: null,
    protocol: null,
    binaryHash: null,
    serverPort: 5037,
    ownedServer: false,
  };
  constructor(
    private db: MediaHostPort,
    private hostId: string,
    private directory: string,
    private picker?: SdkPicker,
    config: Config = { port: 5037 },
    private readonly confirmConflict?: (name: string, model: string | null) => Promise<boolean>,
  ) {
    this.config = config;
    this.sdk = new SdkManager(config.path, config.hash);
    this.adb = new AdbClient(config.port);
  }
  async ready(): Promise<void> {
    try {
      const raw = await readFile(resolve(this.directory, 'adb-host-config.json'), 'utf8');
      if (raw.length > 4096) throw new Error('config size');
      const c = JSON.parse(raw) as Config;
      assertJsonSafe(c);
      if (
        typeof c.port !== 'number' ||
        !Number.isInteger(c.port) ||
        c.port < 1 ||
        c.port > 65535 ||
        Object.keys(c).some((k) => !['port', 'path', 'hash'].includes(k)) ||
        (c.path !== undefined && typeof c.path !== 'string') ||
        (c.hash !== undefined && !/^[a-f0-9]{64}$/.test(c.hash))
      )
        throw new Error('invalid config');
      this.config = c;
    } catch (error) {
      if (!(error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT'))
        this.diagnostic.message = 'Cấu hình SDK không hợp lệ; chọn lại SDK.';
    }
    this.sdk = new SdkManager(this.config.path, this.config.hash);
    this.adb = new AdbClient(this.config.port);
    await this.db.internal({ command: 'device.invalidate', hostId: this.hostId });
    void this.scan().catch(() => undefined);
    const tick = async (): Promise<void> => {
      if (this.closed) return;
      await this.scan().catch(() => undefined);
      if (!this.closed) {
        this.poll = setTimeout(
          () => {
            void tick();
          },
          this.diagnostic.status === 'READY' ? 5000 : 30000,
        );
        this.poll.unref();
      }
    };
    this.poll = setTimeout(() => {
      void tick();
    }, 5000);
    this.poll.unref();
  }
  /** Trusted host-only ADB adapter; not exposed via the public service. */
  stageTransportAdapter(): Pick<AdbClient, 'scoped'> {
    if (this.closed || this.configuring || this.diagnostic.status !== 'READY')
      throw new DomainError('ADB_UNAVAILABLE', 'Trusted ADB device transport is unavailable.');
    return this.adb;
  }
  handles(command: ApiCommand): boolean {
    return command === 'bootstrap' || Object.hasOwn(deviceSchemas, command);
  }
  async snapshot(): Promise<DeviceSnapshot> {
    return {
      sequence: this.sequence,
      scanning: this.scanPromise !== null,
      observedAt: this.observedAt,
      diagnostic: { ...this.diagnostic },
      devices: await this.db.internal<DeviceRecord[]>({
        command: 'device.records',
        hostId: this.hostId,
      }),
      endpoints: await this.db.internal<DeviceEndpointPolicy[]>({
        command: 'endpoint.list',
        hostId: this.hostId,
      }),
      nativeSdkPicker: Boolean(this.picker),
    };
  }
  private async inspect(signal: AbortSignal): Promise<boolean> {
    let sdkInfo: Awaited<ReturnType<SdkManager['inspect']>> | null = null,
      sdkError: unknown;
    try {
      sdkInfo = await this.sdk.inspect(signal);
    } catch (error) {
      sdkError = error;
    }
    if (signal.aborted) throw new DomainError('CANCELLED', 'Đã hủy scan.');
    try {
      await this.adb.diagnostic(signal);
      this.diagnostic = {
        status: 'READY',
        message: 'ADB server đã kết nối; trạng thái thiết bị lấy từ host hiện tại.',
        version: sdkInfo?.version ?? null,
        protocol: 41,
        binaryHash: sdkInfo?.hash ?? null,
        serverPort: this.config.port,
        ownedServer: this.sdk.owned,
      };
      return true;
    } catch (error) {
      const code = error instanceof DomainError ? error.code : 'ERROR';
      this.diagnostic = {
        status:
          code === 'ADB_SERVER_MISMATCH'
            ? 'SERVER_MISMATCH'
            : code === 'ADB_SERVER_MISSING'
              ? sdkInfo
                ? 'SERVER_MISSING'
                : sdkError instanceof DomainError && sdkError.code === 'SDK_MISSING'
                  ? 'SDK_MISSING'
                  : 'SDK_INVALID'
              : 'ERROR',
        message:
          code === 'ADB_SERVER_MISSING'
            ? sdkInfo
              ? 'Chưa có ADB server. Có thể khởi động server riêng.'
              : sdkError instanceof Error
                ? sdkError.message
                : 'Chọn SDK trên host.'
            : error instanceof Error
              ? error.message
              : 'ADB chưa khả dụng.',
        version: sdkInfo?.version ?? null,
        protocol: null,
        binaryHash: sdkInfo?.hash ?? null,
        serverPort: this.config.port,
        ownedServer: this.sdk.owned,
      };
      return false;
    }
  }
  async scan(allowConfiguration = false): Promise<DeviceSnapshot> {
    if (this.configuring && !allowConfiguration) return this.snapshot();
    if (this.closed) throw new DomainError('DEVICE_SERVICE_CLOSED', 'Device service đã đóng.');
    if (!this.scanPromise) {
      const controller = new AbortController();
      this.scanController = controller;
      this.scanPromise = (async () => {
        try {
          if (!(await this.inspect(controller.signal))) {
            await this.db.internal({ command: 'device.invalidate', hostId: this.hostId });
            return;
          }
          let observations = await this.adb.devices(controller.signal);
          const policies = await this.db.internal<DeviceEndpointPolicy[]>({
            command: 'endpoint.list',
            hostId: this.hostId,
          });
          const due = policies
            .filter(
              (p) =>
                p.desired &&
                !this.connecting.has(p.endpoint) &&
                (!p.nextAttemptUtc || Date.parse(p.nextAttemptUtc) <= Date.now()) &&
                !observations.some(
                  (o) =>
                    o.state === 'CONNECTED' &&
                    (o.serial === p.endpoint || o.serial === p.resolvedSerial),
                ),
            )
            .slice(0, 2);
          for (const policy of due) {
            // A policy may be disabled while discovery was awaiting I/O.
            const current = (
              await this.db.internal<DeviceEndpointPolicy[]>({
                command: 'endpoint.list',
                hostId: this.hostId,
              })
            ).find((p) => p.endpoint === policy.endpoint);
            if (!current?.desired || current.revision !== policy.revision) continue;
            try {
              await this.connectEndpoint(policy.endpoint, controller.signal);
            } catch (error) {
              if (controller.signal.aborted) throw error;
            }
          }
          if (due.length) observations = await this.adb.devices(controller.signal);
          let next = 0;
          await Promise.all(
            Array.from({ length: Math.min(4, observations.length) }, async () => {
              while (next < observations.length) {
                const item = observations[next++]!;
                if (item.state === 'CONNECTED')
                  try {
                    item.metadata = await this.adb.metadata(item.serial, controller.signal);
                  } catch (error) {
                    if (controller.signal.aborted) throw error;
                    item.metadata = null;
                  }
              }
            }),
          );
          if (controller.signal.aborted || this.closed)
            throw new DomainError('CANCELLED', 'Đã hủy scan.');
          await this.db.internal({
            command: 'device.reconcile',
            hostId: this.hostId,
            observations,
            at: new Date().toISOString(),
          });
          this.observedAt = new Date().toISOString();
        } catch (error) {
          if (!controller.signal.aborted) {
            this.diagnostic = {
              ...this.diagnostic,
              status: 'ERROR',
              message: error instanceof Error ? error.message : 'Quét thiết bị thất bại.',
            };
            await this.db.internal({ command: 'device.invalidate', hostId: this.hostId });
          }
        } finally {
          this.sequence++;
          this.scanController = null;
          this.scanPromise = null;
        }
      })();
    }
    await this.scanPromise;
    return this.snapshot();
  }
  private async connectEndpoint(endpoint: string, signal: AbortSignal): Promise<void> {
    if (this.connecting.has(endpoint))
      throw new DomainError('ENDPOINT_BUSY', 'Endpoint đang kết nối.');
    this.connecting.add(endpoint);
    let resolvedSerial: string | null = null,
      errorCode: string | null = null;
    try {
      resolvedSerial = await this.adb.connect(endpoint, signal);
      const observed = (await this.adb.devices(signal)).find(
        (o) => o.serial === resolvedSerial || o.serial === endpoint,
      );
      if (observed?.state !== 'CONNECTED')
        throw new DomainError(
          observed?.state === 'UNAUTHORIZED' ? 'ADB_UNAUTHORIZED' : 'ADB_NOT_OBSERVED',
          'Endpoint chưa sẵn sàng; kiểm tra cấp quyền và cổng kết nối trên điện thoại.',
        );
    } catch (error) {
      errorCode = error instanceof DomainError ? error.code : 'ADB_CONNECT_FAILED';
      throw error;
    } finally {
      await this.db.internal({
        command: 'endpoint.attempt',
        hostId: this.hostId,
        endpoint,
        resolvedSerial,
        errorCode,
        at: Date.now(),
      });
      this.connecting.delete(endpoint);
      this.sequence++;
    }
  }
  private networkTask<T>(task: () => Promise<T>): Promise<T> {
    if (this.configuring) throw new DomainError('ADB_BUSY', 'Đang thay cấu hình SDK/server.');
    const pending = task();
    this.networkTasks.add(pending);
    void pending.finally(() => this.networkTasks.delete(pending)).catch(() => undefined);
    return pending;
  }
  private async configuration<T>(task: () => Promise<T>): Promise<T> {
    if (this.configuring || this.queued || this.networkTasks.size)
      throw new DomainError('ADB_BUSY', 'Thiết bị đang có thao tác; chờ trước khi đổi SDK/server.');
    this.configuring = true;
    try {
      const snapshot = await this.snapshot();
      if (snapshot.devices.some((d) => d.owner))
        throw new DomainError('ADB_BUSY', 'Có worker đang giữ thiết bị; chưa đổi SDK/server.');
      this.scanController?.abort();
      if (this.scanPromise) await this.scanPromise;
      if (this.closed) throw new DomainError('CANCELLED', 'Device service đã đóng.');
      return await task();
    } finally {
      this.configuring = false;
    }
  }
  private async saveConfig(): Promise<void> {
    await mkdir(this.directory, { recursive: true });
    await writeFile(resolve(this.directory, 'adb-host-config.json'), JSON.stringify(this.config), {
      mode: 0o600,
    });
  }
  private async actor<T>(
    deviceId: string,
    kind: DeviceLease['ownerKind'],
    task: (
      device: DeviceRecord,
      transport: DeviceRecord['transports'][number],
      lease: DeviceLease,
    ) => Promise<T>,
  ): Promise<T> {
    if (this.closed) throw new DomainError('DEVICE_SERVICE_CLOSED', 'Device service đã đóng.');
    if (this.configuring)
      throw new DomainError('ADB_BUSY', 'Đang thay cấu hình SDK/server; chờ hoàn tất.');
    if (this.queued >= 64)
      throw new DomainError('DEVICE_QUEUE_BUSY', 'Hàng đợi thao tác đầy; thử lại sau.');
    this.queued++;
    const epoch = this.actorEpoch.get(deviceId) ?? 0;
    const previous = this.actors.get(deviceId) ?? Promise.resolve();
    const next = previous
      .catch(() => undefined)
      .then(async () => {
        if (this.closed) throw new DomainError('CANCELLED', 'Thao tác đã hủy.');
        if (epoch !== (this.actorEpoch.get(deviceId) ?? 0))
          throw new DomainError(
            'DEVICE_COMMAND_RESET',
            'Lượt điều khiển cũ đã bị dừng; kiểm tra lại thiết bị trước khi gửi lệnh mới.',
          );
        const devices = await this.db.internal<DeviceRecord[]>({
            command: 'device.records',
            hostId: this.hostId,
          }),
          device = devices.find((d) => d.id === deviceId),
          transport = device?.transports.find((t) => t.state === 'CONNECTED' && t.identityVerified);
        if (!device || !transport || !device.capabilities.manualControl)
          throw new DomainError(
            'DEVICE_UNAVAILABLE',
            device?.capabilities.reasons.join(' ') || 'Thiết bị chưa kết nối.',
          );
        const lease = await this.db.internal<DeviceLease>({
          command: 'lease.acquire',
          deviceId,
          ownerId: 'manual_' + randomUUID().replaceAll('-', ''),
          kind,
          at: Date.now(),
          ttl: 60000,
        });
        try {
          await this.fence(deviceId, transport, lease);
          return await task(device, transport, lease);
        } catch (error) {
          this.actorEpoch.set(deviceId, (this.actorEpoch.get(deviceId) ?? 0) + 1);
          this.captures.delete(deviceId);
          if (error instanceof DomainError && /^(ADB_|DEVICE_GEOMETRY)/.test(error.code)) {
            await this.db.internal({ command: 'device.invalidate', hostId: this.hostId, deviceId });
            this.sequence++;
          }
          throw error;
        } finally {
          await this.db.internal({ command: 'lease.release', lease });
        }
      });
    this.actors.set(deviceId, next);
    try {
      return await next;
    } finally {
      this.queued--;
      if (this.actors.get(deviceId) === next) this.actors.delete(deviceId);
    }
  }
  private async fence(
    deviceId: string,
    transport: DeviceRecord['transports'][number],
    lease: DeviceLease,
  ): Promise<void> {
    if (this.closed || this.lifecycle.signal.aborted)
      throw new DomainError('CANCELLED', 'Thao tác đã hủy.');
    await this.db.internal({
      command: 'device.assertTransport',
      hostId: this.hostId,
      deviceId,
      serial: transport.serial,
      generation: transport.generation,
    });
    await this.db.internal({ command: 'lease.assert', lease, at: Date.now() });
  }

  /**
   * Trusted native-only live stage reader: fresh scan, a single identity-verified
   * transport, shared per-device MANUAL actor and guaranteed lease release.
   * The callback is host-only; renderer never supplies a lease or ADB serial.
   */
  async withManualStageReviewLease<T>(
    deviceId: string,
    task: (lease: DeviceLease, transport: { serial: string; generation: number }) => Promise<T>,
  ): Promise<T> {
    const snapshot = await this.scan();
    const observedAt = snapshot.observedAt ? Date.parse(snapshot.observedAt) : NaN;
    if (snapshot.diagnostic.status !== 'READY' || snapshot.scanning ||
        !Number.isFinite(observedAt) || observedAt > Date.now() ||
        Date.now() - observedAt > 10000)
      throw new DomainError('STAGE_LIVE_SCAN_UNAVAILABLE',
        'Fresh verified ADB scan is required for operator re-observation.');
    return this.actor(deviceId, 'MANUAL', async (device, transport, lease) => {
      const candidates = device.transports.filter((t) =>
        t.state === 'CONNECTED' && t.identityVerified);
      const lastSeen = Date.parse(transport.lastSeen);
      if (!device.enabled || device.identity !== 'VERIFIED_PROPERTIES' ||
          candidates.length !== 1 || candidates[0]?.serial !== transport.serial ||
          candidates[0]?.generation !== transport.generation ||
          !Number.isFinite(lastSeen) || lastSeen > Date.now() ||
          Date.now() - lastSeen > 10000)
        throw new DomainError('STAGE_LIVE_TRANSPORT_AMBIGUOUS',
          'A single fresh, identity-verified Android transport is required.');
      await this.fence(deviceId, transport, lease);
      return task(lease, { serial: transport.serial, generation: transport.generation });
    });
  }

  /** Host-side live selector test. No auto-tap, no private XML/text in the DTO. */
  private async testDeviceSelector(
    id: string,
    raw: unknown,
  ): Promise<DeviceSelectorLiveReport> {
    let selector: unknown;
    try {
      assertJsonSafe(raw, { depth: 20, entries: 10000, stringLength: 8192 });
      if (!raw || typeof raw !== 'object' || Array.isArray(raw) || !('version' in raw))
        throw new Error('Invalid selector');
      selector =
        raw.version === 1 ? uiSelectorSchema.parse(raw) : uiSelectorV2Schema.parse(raw);
    } catch {
      throw new DomainError(
        'INVALID_SELECTOR',
        'Selector phải đúng định dạng v1/v2; không gửi lệnh Android.',
      );
    }
    // Existing Inspector owns a real ADB lease and verifies device identity,
    // generation, orientation, foreground, and screenshot/XML correlation.
    const snapshot = await this.inspectDevice(id);
    try {
      const match = inspectUiSelectorMatches(snapshot.nodes, selector);
      const totalMatches = match.nodes.length;
      return {
        deviceId: id,
        observedAt: snapshot.capture.capturedAt,
        deviceRevision: snapshot.capture.deviceRevision,
        transportGeneration: snapshot.capture.transportGeneration,
        foreground: snapshot.foreground,
        correlation: snapshot.correlation,
        status:
          totalMatches === 0 ? 'NONE' : totalMatches === 1 ? 'UNIQUE' : 'AMBIGUOUS',
        totalMatches,
        strategyIndex: match.strategyIndex,
        totalStrategies: match.totalStrategies,
        attempts: match.attempts,
        samples: match.nodes.slice(0, 100).map((n) => ({
          id: n.id,
          bounds: { ...n.bounds },
          resourceId: n.resourceId,
          className: n.className,
          packageName: n.packageName,
        })),
        truncated: totalMatches > 100,
      };
    } finally {
      // A read-only probe must never leave an action-capable capture token.
      this.captures.delete(id);
    }
  }

  private async inspectDevice(id: string): Promise<InspectorSnapshot> {
    return this.actor(id, 'INSPECTOR', async (device, transport, lease) => {
      const start = Date.now(),
        signal = AbortSignal.any([this.lifecycle.signal, AbortSignal.timeout(10000)]);
      const adb = this.adb.scoped(() => this.fence(id, transport, lease));
      const rotation = await adb.rotation(transport.serial, signal),
        foreground = await adb.foreground(transport.serial, signal);
      const image = await adb.screenshot(transport.serial, signal);
      const xml = await adb.uiXml(transport.serial, signal);
      if (
        (await adb.rotation(transport.serial, signal)) !== rotation ||
        (await adb.foreground(transport.serial, signal)) !== foreground ||
        Date.now() - start > 10000
      )
        throw new DomainError(
          'INSPECTOR_STALE',
          'Orientation/app đã đổi trong lúc đọc cây; chụp lại.',
        );
      await this.fence(id, transport, lease);
      const nodes = parseUiXml(xml, image.width, image.height, rotation);
      const capture: DeviceCapture = {
        id: 'capture_' + randomUUID().replaceAll('-', ''),
        deviceId: id,
        deviceRevision: device.revision,
        transportSerial: transport.serial,
        transportGeneration: transport.generation,
        width: image.width,
        height: image.height,
        rotation,
        capturedAt: new Date().toISOString(),
        mimeType: 'image/png',
        data: image.bytes.toString('base64'),
      };
      this.captures.set(id, { capture, serial: transport.serial });
      return {
        capture,
        nodes,
        foreground,
        startedAt: new Date(start).toISOString(),
        durationMs: Date.now() - start,
        correlation: 'BOUNDED_SEQUENTIAL',
      };
    });
  }
  private async capture(id: string): Promise<DeviceCapture> {
    return this.actor(id, 'INSPECTOR', async (_device, transport, lease) => {
      const adb = this.adb.scoped(() => this.fence(id, transport, lease));
      const signal = this.lifecycle.signal;
      let rotation: number | null = null;
      try {
        rotation = await adb.rotation(transport.serial, signal);
      } catch (error) {
        if (signal.aborted) throw error;
      }
      await this.fence(id, transport, lease);
      const image = await adb.screenshot(transport.serial, signal);
      if (rotation !== null && (await adb.rotation(transport.serial, signal)) !== rotation)
        throw new DomainError('STALE_CAPTURE', 'Điện thoại đổi orientation khi chụp; chụp lại.');
      await this.fence(id, transport, lease);
      const capture: DeviceCapture = {
        id: 'capture_' + randomUUID().replaceAll('-', ''),
        deviceId: id,
        transportGeneration: transport.generation,
        transportSerial: transport.serial,
        deviceRevision: _device.revision,
        width: image.width,
        height: image.height,
        rotation,
        capturedAt: new Date().toISOString(),
        mimeType: 'image/png',
        data: image.bytes.toString('base64'),
      };
      this.captures.set(id, { capture, serial: transport.serial });
      return capture;
    });
  }
  private async action(id: string, action: ManualDeviceAction): Promise<{ acknowledged: true }> {
    return this.actor(id, 'MANUAL', async (_device, transport, lease) => {
      const adb = this.adb.scoped(() => this.fence(id, transport, lease));
      const signal = this.lifecycle.signal;
      if (action.type === 'TAP' || action.type === 'SWIPE') {
        const stored = this.captures.get(id),
          capture = stored?.capture;
        if (
          !capture ||
          capture.id !== action.captureId ||
          stored.serial !== transport.serial ||
          capture.transportGeneration !== transport.generation ||
          capture.deviceRevision !== _device.revision ||
          capture.rotation === null ||
          Date.now() - Date.parse(capture.capturedAt) > 60000
        )
          throw new DomainError(
            'STALE_CAPTURE',
            'Ảnh chụp hết hiệu lực; chụp lại trước khi thao tác tọa độ.',
          );
        const points =
          action.type === 'TAP'
            ? [[action.x, action.y]]
            : [
                [action.x1, action.y1],
                [action.x2, action.y2],
              ];
        if (points.some(([x, y]) => x! >= capture.width || y! >= capture.height))
          throw new DomainError('INVALID_COORDINATES', 'Tọa độ nằm ngoài ảnh hiện tại.');
        if ((await adb.rotation(transport.serial, signal)) !== capture.rotation)
          throw new DomainError('STALE_CAPTURE', 'Orientation đã đổi; chụp lại.');
        const current = await adb.screenshot(transport.serial, signal);
        if (current.width !== capture.width || current.height !== capture.height)
          throw new DomainError('STALE_CAPTURE', 'Kích thước màn hình đã đổi; chụp lại.');
      }
      if (action.type === 'LAUNCH' || action.type === 'FORCE_STOP') {
        const bootstrap = (await this.db.request('bootstrap')) as BootstrapData;
        if (!bootstrap.apps.some((app) => app.packages.includes(action.packageName)))
          throw new DomainError('APP_SCOPE', 'Chọn package trong app registry của workspace.');
      }
      await this.fence(id, transport, lease);
      if (action.type === 'KEY') await adb.key(transport.serial, action.key, signal);
      else if (action.type === 'TAP') await adb.tap(transport.serial, action.x, action.y, signal);
      else if (action.type === 'SWIPE')
        await adb.swipe(
          transport.serial,
          action.x1,
          action.y1,
          action.x2,
          action.y2,
          action.durationMs,
          signal,
        );
      else if (action.type === 'LAUNCH')
        await adb.launch(transport.serial, action.packageName, signal);
      else if (action.type === 'FORCE_STOP')
        await adb.forceStop(transport.serial, action.packageName, signal);
      else if (action.type === 'SYSTEM') await adb.system(transport.serial, action.target, signal);
      this.captures.delete(id);
      return { acknowledged: true };
    });
  }

  /** Trusted host reads a live ADB response; renderer never provides a serial. */
  private async freshConflictObservation(
    id: string,
  ): Promise<{ device: DeviceRecord; observation: TransportObservation | null; blockers: string[] }> {
    const devices = await this.db.internal<DeviceRecord[]>({
      command: 'device.records',
      hostId: this.hostId,
    });
    const device = devices.find((d) => d.id === id);
    if (!device) throw new DomainError('NOT_FOUND', 'Không tìm thấy thiết bị.');
    const connected = device.transports.filter((t) => t.state === 'CONNECTED');
    if (connected.length !== 1)
      return { device, observation: null, blockers: ['AMBIGUOUS_ACTIVE_TRANSPORTS'] };
    const candidate = connected[0]!;
    const live = (await this.adb.devices(this.lifecycle.signal)).find(
      (entry) => entry.serial === candidate.serial,
    );
    if (!live || live.state !== 'CONNECTED' || live.kind !== candidate.kind)
      return { device, observation: null, blockers: ['TRANSPORT_UNAVAILABLE'] };
    let metadata: TransportObservation['metadata'] = null;
    try {
      metadata = await this.adb.metadata(live.serial, this.lifecycle.signal);
    } catch (error) {
      if (this.lifecycle.signal.aborted) throw error;
      // No property evidence means no permission to clear a conflict.
    }
    return { device, observation: { ...live, metadata }, blockers: [] };
  }

  private async previewConflict(
    id: string,
    expectedRevision: number,
  ): Promise<DeviceResolutionPreview> {
    return this.configuration(async () => {
      await this.scan(true);
      const evidence = await this.freshConflictObservation(id);
      if (!evidence.observation) return {
        deviceId: id,
        expectedRevision,
        name: evidence.device.name,
        model: evidence.device.metadata?.model ?? null,
        token: null,
        expiresAt: null,
        canApply: false,
        blockers: evidence.blockers,
      };
      return this.db.internal<DeviceResolutionPreview>({
        command: 'device.resolutionPreview',
        hostId: this.hostId,
        deviceId: id,
        expectedRevision,
        observation: evidence.observation,
        at: Date.now(),
      });
    });
  }

  private async applyConflict(
    id: string,
    token: string,
    confirmedName: string,
  ): Promise<{ cancelled: boolean; resolution: DeviceResolutionResult | null; snapshot: DeviceSnapshot }> {
    if (!this.confirmConflict)
      throw new DomainError(
        'NATIVE_DIALOG_REQUIRED',
        'Khôi phục nhận diện chỉ hỗ trợ app Electron với xác nhận vật lý.',
      );
    return this.configuration(async () => {
      const current = (await this.snapshot()).devices.find((d) => d.id === id);
      if (!current || current.identity !== 'CONFLICT')
        throw new DomainError('RESOLUTION_NOT_CONFLICT', 'Thiết bị không còn xung đột.');
      if (current.name.normalize('NFC').trim() !== confirmedName.normalize('NFC').trim())
        throw new DomainError('RESOLUTION_NAME_REQUIRED', 'Nhập đúng tên thiết bị lịch sử.');
      if (!(await this.confirmConflict!(current.name, current.metadata?.model ?? null)))
        return { cancelled: true, resolution: null, snapshot: await this.snapshot() };
      await this.scan(true);
      const evidence = await this.freshConflictObservation(id);
      if (!evidence.observation)
        throw new DomainError(
          'RESOLUTION_PROOF_UNAVAILABLE', 'Không xác minh lại được điện thoại; giữ khóa.',
        );
      const resolution = await this.db.internal<DeviceResolutionResult>({
        command: 'device.resolutionApply',
        hostId: this.hostId,
        deviceId: id,
        token,
        confirmedName,
        observation: evidence.observation,
        at: Date.now(),
      });
      this.captures.delete(id);
      this.actorEpoch.set(id, (this.actorEpoch.get(id) ?? 0) + 1);
      this.sequence++;
      // All transports were fenced by the DB; require an independent new scan.
      // Device remains disabled until a deliberate user action.
      const snapshot = await this.scan(true);
      return { cancelled: false, resolution, snapshot };
    });
  }

  async request(command: ApiCommand, input: unknown): Promise<unknown> {
    if (this.closed) throw new DomainError('DEVICE_SERVICE_CLOSED', 'Device service đã đóng.');
    if (command === 'bootstrap') {
      const data = (await this.db.request(command, input)) as BootstrapData,
        snapshot = await this.snapshot();
      return {
        ...data,
        hardware: {
          connected: snapshot.devices.some((d) => d.capabilities.connected),
          reason: snapshot.diagnostic.message,
        },
      };
    }
    assertJsonSafe(input);
    switch (command) {
      case 'deviceSnapshot':
        deviceSchemas.deviceSnapshot.parse(input);
        return this.snapshot();
      case 'deviceResolutionHistory': {
        const p = deviceSchemas.deviceResolutionHistory.parse(input);
        return this.db.internal<DeviceResolutionAuditPage>({
          command: 'device.resolutionHistory',
          deviceId: p.id,
          limit: 20,
          cursor: p.cursor ?? null,
        });
      }
      case 'previewDeviceConflictResolution': {
        const p = deviceSchemas.previewDeviceConflictResolution.parse(input);
        return this.previewConflict(p.id, p.expectedRevision);
      }
      case 'applyDeviceConflictResolution': {
        const p = deviceSchemas.applyDeviceConflictResolution.parse(input);
        return this.applyConflict(p.id, p.token, p.confirmedName);
      }
      case 'scanDevices':
        deviceSchemas.scanDevices.parse(input);
        return this.scan();
      case 'cancelDeviceScan':
        deviceSchemas.cancelDeviceScan.parse(input);
        this.scanController?.abort();
        return null;
      case 'chooseAdbSdk': {
        deviceSchemas.chooseAdbSdk.parse(input);
        if (!this.picker)
          throw new DomainError(
            'NATIVE_DIALOG_REQUIRED',
            'Chọn SDK bằng bản desktop trên máy điều khiển điện thoại.',
          );
        return this.configuration(async () => {
          const path = await this.picker!();
          if (!path) return { cancelled: true, snapshot: await this.snapshot() };
          const manager = new SdkManager(path),
            info = await manager.inspect(this.lifecycle.signal);
          if (this.closed) throw new DomainError('CANCELLED', 'Đã hủy cấu hình SDK.');
          await this.sdk.close();
          this.sdk = new SdkManager(info.path, info.hash);
          this.config = { ...this.config, path: info.path, hash: info.hash };
          await this.saveConfig();
          return { cancelled: false, snapshot: await this.scan(true) };
        });
      }
      case 'startAdbServer': {
        deviceSchemas.startAdbServer.parse(input);
        return this.configuration(async () => {
          let running = false;
          try {
            await this.adb.diagnostic(this.lifecycle.signal);
            running = true;
          } catch {
            /* Missing or incompatible server is never killed. */
          }
          if (running)
            throw new DomainError('ADB_ALREADY_READY', 'ADB đã sẵn sàng; dùng server hiện tại.');
          await this.sdk.startOwned(5038, this.lifecycle.signal);
          if (this.closed) throw new DomainError('CANCELLED', 'Đã hủy cấu hình server.');
          this.config = { ...this.config, port: 5038 };
          this.adb = new AdbClient(5038);
          await this.saveConfig();
          return this.scan(true);
        });
      }
      case 'connectDevice': {
        const p = deviceSchemas.connectDevice.parse(input);
        const endpoint = parseEndpoint(p.endpoint);
        const existing = (
          await this.db.internal<DeviceEndpointPolicy[]>({
            command: 'endpoint.list',
            hostId: this.hostId,
          })
        ).some((policy) => policy.endpoint === endpoint);
        if (p.reconnect || existing)
          await this.db.internal({
            command: 'endpoint.set',
            hostId: this.hostId,
            endpoint,
            desired: p.reconnect,
          });
        try {
          await this.networkTask(() => this.connectEndpoint(endpoint, this.lifecycle.signal));
        } catch (error) {
          await this.scan();
          throw error;
        }
        return this.scan();
      }
      case 'setDeviceReconnect': {
        const p = deviceSchemas.setDeviceReconnect.parse(input);
        await this.db.internal({
          command: 'endpoint.set',
          hostId: this.hostId,
          endpoint: parseEndpoint(p.endpoint),
          desired: p.desired,
          expectedRevision: p.expectedRevision,
        });
        this.sequence++;
        return this.snapshot();
      }
      case 'pairDevice': {
        const p = deviceSchemas.pairDevice.parse(input);
        await this.networkTask(() =>
          this.adb.pair(parseEndpoint(p.endpoint), p.code, this.lifecycle.signal),
        );
        return this.scan();
      }
      case 'updateDevice': {
        const p = deviceSchemas.updateDevice.parse(input);
        const patch = {
          ...(p.patch.name !== undefined ? { name: p.patch.name } : {}),
          ...(p.patch.enabled !== undefined ? { enabled: p.patch.enabled } : {}),
        };
        await this.db.internal({
          command: 'device.update',
          id: p.id,
          expectedRevision: p.expectedRevision,
          patch,
        });
        if (p.patch.enabled !== undefined) {
          this.captures.delete(p.id);
          this.actorEpoch.set(p.id, (this.actorEpoch.get(p.id) ?? 0) + 1);
        }
        this.sequence++;
        return this.snapshot();
      }
      case 'inspectDevice':
        return this.inspectDevice(deviceSchemas.inspectDevice.parse(input).id);
      case 'testDeviceSelector': {
        const p = deviceSchemas.testDeviceSelector.parse(input);
        return this.testDeviceSelector(p.id, p.selector);
      }
      case 'captureDevice':
        return this.capture(deviceSchemas.captureDevice.parse(input).id);
      case 'deviceAction': {
        const p = deviceSchemas.deviceAction.parse(input);
        return this.action(p.id, p.action);
      }
      case 'devicePackages':
        return this.actor(
          deviceSchemas.devicePackages.parse(input).id,
          'INSPECTOR',
          async (_device, transport, lease) => {
            const adb = this.adb.scoped(() => this.fence(_device.id, transport, lease));
            return {
              packages: await adb.packages(transport.serial, this.lifecycle.signal),
              foreground: await adb.foreground(transport.serial, this.lifecycle.signal),
            };
          },
        );
      case 'disconnectDevice': {
        const p = deviceSchemas.disconnectDevice.parse(input);
        await this.actor(p.id, 'NETWORK', async (device, _transport, lease) => {
          const network = device.transports.filter(
            (t) => t.kind === 'TCP' && t.state === 'CONNECTED',
          );
          if (!network.length)
            throw new DomainError(
              'NO_NETWORK_TRANSPORT',
              'Thiết bị không có network transport đang kết nối.',
            );
          const policies = await this.db.internal<DeviceEndpointPolicy[]>({
            command: 'endpoint.list',
            hostId: this.hostId,
          });
          for (const policy of policies.filter((p) =>
            network.some((t) => t.serial === p.endpoint || t.serial === p.resolvedSerial),
          ))
            await this.db.internal({
              command: 'endpoint.set',
              hostId: this.hostId,
              endpoint: policy.endpoint,
              desired: false,
            });
          for (const t of network) {
            await this.fence(p.id, t, lease);
            await this.adb.disconnect(t.serial, this.lifecycle.signal);
          }
        });
        return this.scan();
      }
    }
    throw new DomainError('INVALID_REQUEST', 'Device operation không hợp lệ.');
  }
  async close(): Promise<void> {
    this.closed = true;
    this.lifecycle.abort();
    this.scanController?.abort();
    if (this.poll) clearTimeout(this.poll);
    await Promise.allSettled([
      ...this.actors.values(),
      ...this.networkTasks,
      ...(this.scanPromise ? [this.scanPromise] : []),
    ]);
    await this.sdk.close();
  }
}
