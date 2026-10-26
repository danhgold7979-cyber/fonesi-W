import { createConnection, type Socket } from 'node:net';
import { DomainError } from '@autoreels/domain';

export class AdbConnection {
  private chunks: Buffer[] = [];
  private buffered = 0;
  private received = 0;
  private ended = false;
  private failure: Error | null = null;
  private waiter: (() => void) | null = null;
  private timer: ReturnType<typeof setTimeout>;
  private signal: AbortSignal | undefined;
  private abort = (): void => this.fail(new DomainError('CANCELLED', 'Đã hủy thao tác thiết bị.'));
  readonly socket: Socket;
  constructor(
    port: number,
    timeout: number,
    private budget: number,
    signal?: AbortSignal,
  ) {
    this.signal = signal;
    this.socket = createConnection({ host: '127.0.0.1', port });
    this.timer = setTimeout(
      () =>
        this.fail(new DomainError('ADB_TIMEOUT', 'Thiết bị/ADB không phản hồi trong thời hạn.')),
      timeout,
    );
    signal?.addEventListener('abort', this.abort, { once: true });
    this.socket.on('data', (chunk: Buffer) => {
      this.received += chunk.length;
      if (this.received > this.budget) {
        this.fail(new DomainError('ADB_OUTPUT_LIMIT', 'ADB response vượt budget.'));
        return;
      }
      this.chunks.push(chunk);
      this.buffered += chunk.length;
      this.wake();
    });
    this.socket.on('error', () =>
      this.fail(new DomainError('ADB_CONNECTION', 'Không kết nối được ADB server/transport.')),
    );
    this.socket.on('end', () => {
      this.ended = true;
      this.wake();
    });
    this.socket.on('close', () => {
      this.ended = true;
      this.wake();
    });
    if (signal?.aborted) this.abort();
  }
  private wake(): void {
    const fn = this.waiter;
    this.waiter = null;
    fn?.();
  }
  private fail(error: Error): void {
    if (!this.failure) this.failure = error;
    this.socket.destroy();
    this.wake();
  }
  private async available(): Promise<void> {
    if (this.failure) throw this.failure;
    if (this.buffered || this.ended) return;
    await new Promise<void>((resolve) => {
      this.waiter = resolve;
    });
    if (this.failure) throw this.failure;
  }
  async read(bytes: number): Promise<Buffer> {
    if (!Number.isInteger(bytes) || bytes < 0 || bytes > this.budget)
      throw new DomainError('ADB_PROTOCOL', 'ADB frame size không hợp lệ.');
    const result: Buffer[] = [];
    let need = bytes;
    while (need) {
      await this.available();
      if (!this.buffered && this.ended)
        throw new DomainError('ADB_EOF', 'ADB đóng kết nối trước khi trả đủ dữ liệu.');
      const first = this.chunks[0]!,
        count = Math.min(first.length, need);
      result.push(first.subarray(0, count));
      if (count === first.length) this.chunks.shift();
      else this.chunks[0] = first.subarray(count);
      this.buffered -= count;
      need -= count;
    }
    return Buffer.concat(result, bytes);
  }
  async all(): Promise<Buffer> {
    const result: Buffer[] = [];
    let total = 0;
    while (true) {
      await this.available();
      if (!this.buffered && this.ended) break;
      const part = this.chunks.shift()!;
      this.buffered -= part.length;
      result.push(part);
      total += part.length;
    }
    return Buffer.concat(result, total);
  }
  async request(service: string): Promise<void> {
    const data = Buffer.from(service);
    if (data.length > 65535 || data.includes(0))
      throw new DomainError('ADB_PROTOCOL', 'ADB request không hợp lệ.');
    this.socket.write(
      Buffer.concat([Buffer.from(data.length.toString(16).padStart(4, '0')), data]),
    );
    const status = (await this.read(4)).toString('ascii');
    if (status === 'OKAY') return;
    if (status === 'FAIL') {
      await this.protocolString();
      throw new DomainError(
        'ADB_SERVICE_FAILED',
        'ADB từ chối thao tác; kiểm tra kết nối/quyền hoặc capability thiết bị.',
      );
    }
    throw new DomainError('ADB_PROTOCOL', 'ADB status không hợp lệ.');
  }
  async protocolString(): Promise<string> {
    const raw = (await this.read(4)).toString('ascii');
    if (!/^[a-f\d]{4}$/i.test(raw))
      throw new DomainError('ADB_PROTOCOL', 'ADB string frame không hợp lệ.');
    return (await this.read(parseInt(raw, 16))).toString('utf8');
  }
  close(): void {
    clearTimeout(this.timer);
    this.signal?.removeEventListener('abort', this.abort);
    this.socket.destroy();
  }
}
