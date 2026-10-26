import { randomUUID } from 'node:crypto';
import { createHash } from 'node:crypto';
import type { DeviceMetadata, TransportObservation } from '@autoreels/contracts';
import { packageNameSchema } from '@autoreels/contracts';
import { DomainError } from '@autoreels/domain';
import { AdbConnection } from './connection.js';
import { assertSerial, quoteAndroidArg, parseEndpoint, serverVersion } from './protocol.js';
export { assertSerial, quoteAndroidArg, parseEndpoint, serverVersion } from './protocol.js';
export { SdkManager } from './sdk.js';
export { parseUiXml } from './xml.js';

export function parseDevices(text: string): TransportObservation[] {
  const result: TransportObservation[] = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim() || line.startsWith('List of devices') || line.startsWith('*')) continue;
    const match = /^(\S+)\s+(device|unauthorized|offline|no permissions)(?:\s|$)/.exec(line);
    if (!match) throw new DomainError('ADB_DEVICE_LIST', 'Không đọc được trạng thái thiết bị ADB.');
    const rawSerial = match[1]!,
      serial =
        match[2] === 'no permissions' && /^\?+$/.test(rawSerial)
          ? rawSerial + '#' + result.length
          : rawSerial;
    if (match[2] !== 'no permissions') assertSerial(serial);
    result.push({
      serial,
      kind: serial.startsWith('emulator-')
        ? 'EMULATOR'
        : serial.includes(':') || serial.includes('._tcp')
          ? 'TCP'
          : 'USB',
      state: (
        {
          device: 'CONNECTED',
          unauthorized: 'UNAUTHORIZED',
          offline: 'OFFLINE',
          'no permissions': 'NO_PERMISSIONS',
        } as const
      )[match[2] as 'device'],
      metadata: null,
    });
  }
  if (new Set(result.map((d) => d.serial)).size !== result.length)
    throw new DomainError('ADB_DEVICE_LIST', 'Transport serial trùng trong response.');
  return result;
}
export function parseProperties(text: string): DeviceMetadata {
  const values = new Map<string, string>();
  for (const line of text.split(/\r?\n/)) {
    const m = /^\[([^\]]+)\]: \[(.*)\]$/.exec(line);
    if (m) values.set(m[1]!, m[2]!);
  }
  const serial = [values.get('ro.serialno'), values.get('ro.boot.serialno')].find(
    (s) => s && s.length >= 4 && !/^(unknown|null|0+)$/i.test(s),
  );
  const sdk = Number(values.get('ro.build.version.sdk'));
  if (!Number.isInteger(sdk) || sdk < 16 || sdk > 1000 || !values.get('ro.product.model'))
    throw new DomainError('ADB_PROPERTIES', 'Thiết bị chưa trả đủ metadata hợp lệ.');
  return {
    hardwareSerial: serial ?? null,
    manufacturer: values.get('ro.product.manufacturer') ?? '',
    model: values.get('ro.product.model')!,
    product: values.get('ro.product.device') ?? '',
    androidVersion: values.get('ro.build.version.release') ?? '',
    sdk,
    locale: values.get('persist.sys.locale') ?? values.get('ro.product.locale') ?? '',
  };
}
export function deviceFingerprint(
  metadata: DeviceMetadata | null,
  hostId: string,
  serial: string,
): { fingerprint: string; provisional: boolean } {
  const verified = Boolean(metadata?.hardwareSerial && metadata.manufacturer && metadata.product);
  const evidence = verified
    ? {
        serial: metadata!.hardwareSerial,
        manufacturer: metadata!.manufacturer,
        product: metadata!.product,
      }
    : { hostId, transport: serial };
  return {
    fingerprint: createHash('sha256').update(JSON.stringify(evidence)).digest('hex'),
    provisional: !verified,
  };
}
export class AdbClient {
  constructor(
    readonly port = 5037,
    private beforeDispatch?: () => Promise<void>,
  ) {}
  scoped(beforeDispatch: () => Promise<void>): AdbClient {
    return new AdbClient(this.port, beforeDispatch);
  }
  async diagnostic(signal?: AbortSignal): Promise<number> {
    const version = await serverVersion(this.port, signal);
    if (version !== 41)
      throw new DomainError(
        'ADB_SERVER_MISMATCH',
        'ADB server protocol chưa được hỗ trợ; giữ nguyên server hiện có.',
      );
    return version;
  }
  private async host(service: string, signal?: AbortSignal): Promise<string> {
    await this.diagnostic(signal);
    const c = new AdbConnection(this.port, 10000, 1024 * 1024, signal);
    try {
      await c.request(service);
      return await c.protocolString();
    } finally {
      c.close();
    }
  }
  async devices(signal?: AbortSignal): Promise<TransportObservation[]> {
    return parseDevices(await this.host('host:devices-l', signal));
  }
  async connect(endpoint: string, signal?: AbortSignal): Promise<string> {
    const result = await this.host('host:connect:' + parseEndpoint(endpoint), signal);
    const match = /^(?:already )?connected to ([^\s]+)\s*$/i.exec(result.trim());
    if (!match || /failed|unable|cannot/i.test(result))
      throw new DomainError(
        'ADB_CONNECT_FAILED',
        'ADB chưa kết nối được endpoint; kiểm tra Wireless debugging và cổng kết nối.',
      );
    return parseEndpoint(match[1]!);
  }
  async pair(endpoint: string, code: string, signal?: AbortSignal): Promise<void> {
    if (!/^\d{6}$/.test(code))
      throw new DomainError('INVALID_PAIR_CODE', 'Mã ghép đôi phải có 6 chữ số.');
    const result = await this.host('host:pair:' + code + ':' + parseEndpoint(endpoint), signal);
    if (!/successfully paired/i.test(result))
      throw new DomainError(
        'ADB_PAIR_FAILED',
        'Không ghép đôi được; kiểm tra mã và cổng ghép đôi.',
      );
  }
  async disconnect(serial: string, signal?: AbortSignal): Promise<void> {
    assertSerial(serial);
    if (!serial.includes(':') && !serial.includes('._tcp'))
      throw new DomainError('INVALID_ENDPOINT', 'Chỉ ngắt network transport cụ thể.');
    const result = await this.host('host:disconnect:' + serial, signal);
    if (!/disconnected|no such device/i.test(result))
      throw new DomainError('ADB_DISCONNECT_FAILED', 'Chưa xác minh được transport đã ngắt.');
  }
  private async device(
    serial: string,
    service: string,
    budget: number,
    signal?: AbortSignal,
  ): Promise<AdbConnection> {
    assertSerial(serial);
    await this.diagnostic(signal);
    const c = new AdbConnection(this.port, 15000, budget, signal);
    try {
      await c.request('host:transport:' + serial);
      await this.beforeDispatch?.();
      await c.request(service);
      return c;
    } catch (error) {
      c.close();
      throw error;
    }
  }
  private async shell(serial: string, args: string[], signal?: AbortSignal): Promise<Buffer> {
    const c = await this.device(
        serial,
        'shell,v2,raw:' + args.map(quoteAndroidArg).join(' '),
        4 * 1024 * 1024,
        signal,
      ),
      stdout: Buffer[] = [];
    try {
      c.socket.write(Buffer.from([4, 0, 0, 0, 0]));
      while (true) {
        const header = await c.read(5),
          channel = header[0],
          length = header.readUInt32LE(1);
        if (length > 1024 * 1024) throw new DomainError('ADB_PROTOCOL', 'Shell frame vượt budget.');
        const data = await c.read(length);
        if (channel === 1) stdout.push(data);
        else if (channel === 2) {
          /* stderr is intentionally not exported; it can contain device/private values. */
        } else if (channel === 3) {
          if ((length !== 1 && length !== 4) || data.readUInt8(0) !== 0)
            throw new DomainError(
              'ADB_COMMAND_FAILED',
              'Lệnh thiết bị báo lỗi; không tự thử lại thao tác nhập.',
            );
          return Buffer.concat(stdout);
        } else throw new DomainError('ADB_PROTOCOL', 'Shell v2 channel không được hỗ trợ.');
      }
    } finally {
      c.close();
    }
  }
  async uiXml(serial: string, signal?: AbortSignal): Promise<string> {
    const path = '/data/local/tmp/autoreels-inspector-' + randomUUID() + '.xml';
    let result: string | undefined,
      cleanupFailed = false;
    try {
      await this.shell(serial, ['uiautomator', 'dump', '--compressed', path], signal);
      result = (await this.shell(serial, ['cat', path], signal)).toString('utf8');
      if (Buffer.byteLength(result) > 2 * 1024 * 1024)
        throw new DomainError('INSPECTOR_XML', 'XML vượt giới hạn.');
    } finally {
      try {
        await this.shell(serial, ['rm', '-f', path], AbortSignal.timeout(2000));
      } catch {
        cleanupFailed = true;
      }
    }
    if (cleanupFailed)
      throw new DomainError(
        'INSPECTOR_CLEANUP_REQUIRED',
        'Chưa dọn được XML tạm của lượt Inspector; kết nối lại trước khi thử.',
      );
    return result;
  }
  async metadata(serial: string, signal?: AbortSignal): Promise<DeviceMetadata> {
    return parseProperties((await this.shell(serial, ['getprop'], signal)).toString('utf8'));
  }
  async packages(serial: string, signal?: AbortSignal): Promise<string[]> {
    const text = (await this.shell(serial, ['pm', 'list', 'packages'], signal)).toString('utf8');
    return text
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => {
        if (!line.startsWith('package:') || !packageNameSchema.safeParse(line.slice(8)).success)
          throw new DomainError('ADB_PACKAGES', 'Danh sách package không hợp lệ.');
        return line.slice(8);
      })
      .sort();
  }
  async foreground(serial: string, signal?: AbortSignal): Promise<string | null> {
    const text = (await this.shell(serial, ['dumpsys', 'activity', 'activities'], signal)).toString(
      'utf8',
    );
    const match = /(?:mResumedActivity|topResumedActivity).*?\s([A-Za-z][\w.]+)\/[\w.$]+/.exec(
      text,
    );
    return match?.[1] ?? null;
  }
  async rotation(serial: string, signal?: AbortSignal): Promise<number> {
    const text = (await this.shell(serial, ['dumpsys', 'input'], signal)).toString('utf8'),
      match = /SurfaceOrientation:\s*([0-3])\b/.exec(text);
    if (!match)
      throw new DomainError(
        'DEVICE_GEOMETRY_UNAVAILABLE',
        'Chưa xác định được orientation; chỉ dùng phím và quick actions.',
      );
    return Number(match[1]);
  }
  async screenshot(
    serial: string,
    signal?: AbortSignal,
  ): Promise<{ bytes: Buffer; width: number; height: number }> {
    const c = await this.device(serial, 'exec:screencap -p', 16 * 1024 * 1024, signal);
    try {
      const bytes = await c.all();
      if (
        bytes.length < 33 ||
        !bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) ||
        bytes.toString('ascii', 12, 16) !== 'IHDR'
      )
        throw new DomainError('ADB_SCREENSHOT', 'Thiết bị không trả PNG hợp lệ.');
      const width = bytes.readUInt32BE(16),
        height = bytes.readUInt32BE(20);
      if (!width || !height || width > 8192 || height > 8192 || width * height > 32000000)
        throw new DomainError('ADB_SCREENSHOT', 'Kích thước ảnh thiết bị vượt budget.');
      return { bytes, width, height };
    } finally {
      c.close();
    }
  }
  async tap(serial: string, x: number, y: number, signal?: AbortSignal): Promise<void> {
    this.coordinates(x, y);
    await this.shell(serial, ['input', 'tap', String(x), String(y)], signal);
  }
  async swipe(
    serial: string,
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    duration: number,
    signal?: AbortSignal,
  ): Promise<void> {
    this.coordinates(x1, y1);
    this.coordinates(x2, y2);
    if (!Number.isInteger(duration) || duration < 50 || duration > 10000)
      throw new DomainError('INVALID_GESTURE', 'Thời gian vuốt từ 50–10000ms.');
    await this.shell(
      serial,
      ['input', 'swipe', String(x1), String(y1), String(x2), String(y2), String(duration)],
      signal,
    );
  }
  private coordinates(x: number, y: number): void {
    if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x > 8191 || y > 8191)
      throw new DomainError('INVALID_COORDINATES', 'Tọa độ không hợp lệ.');
  }
  async key(
    serial: string,
    key: 'BACK' | 'HOME' | 'RECENT' | 'POWER' | 'VOLUME_UP' | 'VOLUME_DOWN',
    signal?: AbortSignal,
  ): Promise<void> {
    const code = { BACK: 4, HOME: 3, RECENT: 187, POWER: 26, VOLUME_UP: 24, VOLUME_DOWN: 25 }[key];
    if (!code) throw new DomainError('INVALID_KEY', 'Phím không được hỗ trợ.');
    await this.shell(serial, ['input', 'keyevent', String(code)], signal);
  }
  async launch(serial: string, packageName: string, signal?: AbortSignal): Promise<void> {
    packageNameSchema.parse(packageName);
    const component = (
      await this.shell(
        serial,
        ['cmd', 'package', 'resolve-activity', '--brief', packageName],
        signal,
      )
    )
      .toString('utf8')
      .trim()
      .split(/\r?\n/)
      .at(-1)!;
    if (
      !/^[A-Za-z][\w.]+\/[A-Za-z_.$][\w.$]*$/.test(component) ||
      component.split('/')[0] !== packageName
    )
      throw new DomainError('APP_NOT_LAUNCHABLE', 'Package không có launcher activity hợp lệ.');
    await this.shell(serial, ['am', 'start', '-W', '-n', component], signal);
    if ((await this.foreground(serial, signal)) !== packageName)
      throw new DomainError(
        'APP_OPEN_UNVERIFIED',
        'Đã yêu cầu mở app nhưng chưa xác minh foreground; không tự bấm lại.',
      );
  }
  async forceStop(serial: string, packageName: string, signal?: AbortSignal): Promise<void> {
    packageNameSchema.parse(packageName);
    const user = (await this.shell(serial, ['am', 'get-current-user'], signal))
      .toString('utf8')
      .trim();
    if (!/^\d{1,5}$/.test(user))
      throw new DomainError('APP_STOP_UNVERIFIED', 'Không xác định được Android user hiện tại.');
    await this.shell(serial, ['am', 'force-stop', '--user', user, packageName], signal);
    const detail = (await this.shell(serial, ['dumpsys', 'package', packageName], signal)).toString(
        'utf8',
      ),
      line = detail.split(/\r?\n/).find((row) => new RegExp('User ' + user + ':').test(row));
    if (!line || !/(?:^|\s)stopped=true(?:\s|$)/.test(line))
      throw new DomainError(
        'APP_STOP_UNVERIFIED',
        'Chưa xác minh package stopped flag trên đúng Android user.',
      );
  }
  async system(
    serial: string,
    target: 'SETTINGS' | 'FILES' | 'GALLERY' | 'BROWSER' | 'VPN',
    signal?: AbortSignal,
  ): Promise<void> {
    const intents = {
      SETTINGS: ['android.settings.SETTINGS'],
      FILES: ['android.intent.action.OPEN_DOCUMENT', '*/*'],
      GALLERY: ['android.intent.action.VIEW', 'image/*'],
      BROWSER: ['android.intent.action.MAIN', 'android.intent.category.APP_BROWSER'],
      VPN: ['android.settings.VPN_SETTINGS'],
    }[target];
    if (!intents) throw new DomainError('INVALID_TARGET', 'Quick action không hợp lệ.');
    const args = ['am', 'start', '-W', '-a', intents[0]!];
    if (target === 'FILES' || target === 'GALLERY') args.push('-t', intents[1]!);
    if (target === 'BROWSER') args.push('-c', intents[1]!);
    const output = (await this.shell(serial, args, signal)).toString('utf8');
    if (/Error:|Exception|unable to resolve/i.test(output))
      throw new DomainError('SYSTEM_ACTION_UNAVAILABLE', 'Thiết bị không hỗ trợ intent này.');
  }
}
