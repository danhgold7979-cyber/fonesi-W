import { createConnection } from 'node:net';
import { isIP } from 'node:net';
import { DomainError } from '@autoreels/domain';
export function parseEndpoint(input: string): string {
  const value = input.trim();
  const match = /^(?:\[([0-9a-fA-F:]+)\]|([A-Za-z0-9][A-Za-z0-9.-]*)):(\d{1,5})$/.exec(value);
  if (!match) throw new DomainError('INVALID_ENDPOINT', 'Nhập host:port hoặc [IPv6]:port.');
  const host = match[1] ?? match[2]!,
    port = Number(match[3]);
  if (
    port < 1 ||
    port > 65535 ||
    (match[1] && isIP(host) !== 6) ||
    (!match[1] &&
      (/^[\d.]+$/.test(host)
        ? isIP(host) !== 4
        : host.split('.').some((part) => !part || part.length > 63 || part.endsWith('-'))))
  )
    throw new DomainError('INVALID_ENDPOINT', 'Host/port không hợp lệ.');
  return match[1] ? '[' + host.toLowerCase() + ']:' + port : host.toLowerCase() + ':' + port;
}
export function assertSerial(serial: string): void {
  if (!/^[A-Za-z0-9][A-Za-z0-9_.:[\]-]{0,199}$/.test(serial))
    throw new DomainError('INVALID_SERIAL', 'Transport serial không hợp lệ.');
}
export function quoteAndroidArg(value: string): string {
  if (value.includes('\0') || /[\r\n]/.test(value))
    throw new DomainError('INVALID_ARGUMENT', 'Android command argument không hợp lệ.');
  return "'" + value.replaceAll("'", "'\\''") + "'";
}
export function serverVersion(
  port: number,
  signal?: AbortSignal,
  timeoutMs = 800,
): Promise<number> {
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    return Promise.reject(new DomainError('INVALID_PORT', 'ADB server port không hợp lệ.'));
  return new Promise((resolve, reject) => {
    const socket = createConnection({ host: '127.0.0.1', port });
    let bytes = Buffer.alloc(0),
      finished = false;
    const complete = (error?: Error, value?: number): void => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      signal?.removeEventListener('abort', cancel);
      socket.destroy();
      if (error) reject(error);
      else resolve(value!);
    };
    const cancel = () => complete(new DomainError('CANCELLED', 'Đã hủy thao tác ADB.'));
    const timer = setTimeout(
      () => complete(new DomainError('ADB_SERVER_TIMEOUT', 'ADB server không phản hồi.')),
      timeoutMs,
    );
    signal?.addEventListener('abort', cancel, { once: true });
    if (signal?.aborted) {
      cancel();
      return;
    }
    socket.once('connect', () => socket.write('000chost:version'));
    socket.on('data', (chunk: Buffer) => {
      bytes = Buffer.concat([bytes, chunk]);
      if (bytes.length > 4096) {
        complete(new DomainError('ADB_PROTOCOL', 'ADB response vượt budget.'));
        return;
      }
      if (bytes.length < 8) return;
      const status = bytes.toString('ascii', 0, 4),
        lengthText = bytes.toString('ascii', 4, 8);
      if (!['OKAY', 'FAIL'].includes(status) || !/^[\da-fA-F]{4}$/.test(lengthText)) {
        complete(new DomainError('ADB_PROTOCOL', 'Cổng này không trả ADB protocol hợp lệ.'));
        return;
      }
      const length = parseInt(lengthText, 16);
      if (length > 1024) {
        complete(new DomainError('ADB_PROTOCOL', 'ADB response vượt budget.'));
        return;
      }
      if (bytes.length < 8 + length) return;
      const value = bytes.toString('ascii', 8, 8 + length);
      if (status !== 'OKAY' || !/^[\da-fA-F]{1,8}$/.test(value)) {
        complete(new DomainError('ADB_PROTOCOL', 'Không xác định được ADB protocol version.'));
        return;
      }
      complete(undefined, parseInt(value, 16));
    });
    socket.once('error', () =>
      complete(new DomainError('ADB_SERVER_MISSING', 'Chưa có ADB server ở cổng đã cấu hình.')),
    );
    socket.once('close', () => {
      if (!finished)
        complete(
          new DomainError('ADB_PROTOCOL', 'ADB server đóng kết nối trước khi trả đủ dữ liệu.'),
        );
    });
  });
}
