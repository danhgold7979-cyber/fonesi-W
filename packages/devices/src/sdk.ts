import { spawn, type ChildProcess } from 'node:child_process';
import { access, realpath, stat } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { createHash } from 'node:crypto';
import { basename, delimiter, join, isAbsolute } from 'node:path';
import { DomainError } from '@autoreels/domain';
import { serverVersion } from './protocol.js';

export interface SdkInfo {
  path: string;
  hash: string;
  version: string;
  protocol: number;
}
export class SdkManager {
  private child: ChildProcess | null = null;
  constructor(
    private configuredPath?: string,
    private expectedHash?: string,
  ) {}
  get owned(): boolean {
    return this.child !== null && this.child.exitCode === null;
  }
  async inspect(signal?: AbortSignal): Promise<SdkInfo> {
    if (signal?.aborted) throw new DomainError('CANCELLED', 'Đã hủy kiểm tra SDK.');
    let path = this.configuredPath;
    if (path && !isAbsolute(path))
      throw new DomainError('SDK_INVALID', 'SDK phải được chọn bằng hộp thoại host.');
    if (!path) {
      for (const directory of (process.env.PATH ?? '').split(delimiter)) {
        if (!directory) continue;
        const candidate = join(directory, process.platform === 'win32' ? 'adb.exe' : 'adb');
        try {
          await access(candidate);
          path = candidate;
          break;
        } catch {
          /* Try the next installed PATH directory. */
        }
      }
    }
    if (!path)
      throw new DomainError(
        'SDK_MISSING',
        'Chưa tìm thấy Platform-Tools. Chọn adb/adb.exe trong bản desktop hoặc cài SDK trên host.',
      );
    path = await realpath(path);
    if (!['adb', 'adb.exe'].includes(basename(path).toLowerCase()))
      throw new DomainError('SDK_INVALID', 'Chọn đúng adb hoặc adb.exe từ Platform-Tools.');
    const before = await stat(path);
    if (!before.isFile()) throw new DomainError('SDK_INVALID', 'ADB executable không hợp lệ.');
    const hash = createHash('sha256');
    for await (const chunk of createReadStream(path)) hash.update(chunk as Buffer);
    const digest = hash.digest('hex'),
      after = await stat(path);
    if (
      before.size !== after.size ||
      before.mtimeMs !== after.mtimeMs ||
      (this.expectedHash && digest !== this.expectedHash)
    )
      throw new DomainError(
        'SDK_CHANGED',
        'ADB binary đã đổi; chọn lại SDK để xác nhận cấu hình host.',
      );
    const output = await new Promise<string>((resolve, reject) => {
      const child = spawn(path!, ['version'], {
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      let stdout = '',
        stderr = '',
        done = false;
      const timer = setTimeout(() => {
        child.kill();
        finish(new DomainError('SDK_TIMEOUT', 'ADB version probe quá thời hạn.'));
      }, 4000);
      const cancel = (): void => {
        child.kill();
        finish(new DomainError('CANCELLED', 'Đã hủy kiểm tra SDK.'));
      };
      signal?.addEventListener('abort', cancel, { once: true });
      const finish = (error?: Error): void => {
        if (done) return;
        done = true;
        signal?.removeEventListener('abort', cancel);
        clearTimeout(timer);
        if (error) reject(error);
        else resolve(stdout);
      };
      child.stdout.on('data', (chunk: Buffer) => {
        stdout += chunk.toString();
        if (stdout.length > 8192) {
          child.kill();
          finish(new DomainError('SDK_INVALID', 'ADB version output không hợp lệ.'));
        }
      });
      child.stderr.on('data', (chunk: Buffer) => {
        stderr = (stderr + chunk.toString()).slice(-8192);
      });
      if (signal?.aborted) cancel();
      child.once('error', () =>
        finish(new DomainError('SDK_MISSING', 'Không chạy được ADB executable trên host.')),
      );
      child.once('exit', (code) =>
        finish(
          code === 0
            ? undefined
            : new DomainError(
                /Cannot mkdir|Read-only|Permission denied/i.test(stderr)
                  ? 'SDK_PERMISSION'
                  : 'SDK_INVALID',
                /Cannot mkdir|Read-only|Permission denied/i.test(stderr)
                  ? 'ADB không có quyền tạo thư mục cấu hình người dùng trên host.'
                  : 'ADB version probe báo lỗi; kiểm tra SDK và hệ điều hành.',
              ),
        ),
      );
    });
    const protocol = /Android Debug Bridge version \d+\.\d+\.(\d+)/.exec(output),
      version = /^Version ([^\r\n]+)/m.exec(output)?.[1] ?? protocol?.[0];
    if (!protocol || Number(protocol[1]) !== 41 || !version)
      throw new DomainError('SDK_INVALID', 'SDK/ADB protocol chưa được hỗ trợ.');
    return { path, hash: digest, version, protocol: Number(protocol[1]) };
  }
  async startOwned(port = 5038, signal?: AbortSignal): Promise<void> {
    if (this.owned) return;
    if (!Number.isInteger(port) || port < 1024 || port > 65535 || port === 5037)
      throw new DomainError(
        'INVALID_PORT',
        'Server riêng cần cổng 1024–65535, khác cổng shared 5037.',
      );
    try {
      await serverVersion(port);
      throw new DomainError(
        'ADB_PORT_BUSY',
        'Cổng riêng đã có server; không chiếm hoặc dừng server đó.',
      );
    } catch (error) {
      if (!(error instanceof DomainError) || error.code !== 'ADB_SERVER_MISSING') throw error;
    }
    const sdk = await this.inspect(signal);
    if (signal?.aborted) throw new DomainError('CANCELLED', 'Đã hủy khởi động ADB.');
    const child = spawn(sdk.path, ['-L', 'tcp:127.0.0.1:' + port, 'nodaemon', 'server'], {
      windowsHide: true,
      env: { ...process.env, ADB_REJECT_KILL_SERVER: '1' },
      stdio: ['ignore', 'ignore', 'pipe'],
    });
    this.child = child;
    let startupError = false;
    child.stderr!.on('data', () => {
      /* Do not put key paths or private server diagnostics in public logs. */
    });
    child.once('error', () => {
      startupError = true;
      if (this.child === child) this.child = null;
    });
    child.once('exit', () => {
      if (this.child === child) this.child = null;
    });
    for (let attempt = 0; attempt < 20; attempt++) {
      if (signal?.aborted || startupError || child.exitCode !== null) break;
      try {
        if ((await serverVersion(port)) === 41) return;
      } catch {
        /* Owned server is starting; no device input is retried here. */
      }
      await new Promise<void>((resolve) => setTimeout(resolve, 100));
    }
    await this.close();
    throw new DomainError(
      'ADB_START_FAILED',
      'Không khởi động được server riêng; kiểm tra cổng/quyền SDK.',
    );
  }
  async close(): Promise<void> {
    const child = this.child;
    if (!child) return;
    this.child = null;
    await new Promise<void>((resolve) => {
      const timer = setTimeout(() => {
        child.kill('SIGKILL');
        resolve();
      }, 1000);
      child.once('exit', () => {
        clearTimeout(timer);
        resolve();
      });
      child.kill('SIGTERM');
    });
  }
}
