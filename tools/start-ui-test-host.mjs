import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';

const path = mkdtempSync(join(tmpdir(), 'autoreels-ui-fixture-'));
const child = spawn(process.execPath, ['apps/desktop/dist/host/host/server.js'], {
  stdio: 'inherit',
  env: { ...process.env, PORT: '4175', AUTOREELS_DATA_DIR: path },
});
child.on('exit', (code) => {
  rmSync(path, { recursive: true, force: true });
  process.exit(code ?? 1);
});
process.on('SIGTERM', () => child.kill('SIGTERM'));
process.on('SIGINT', () => child.kill('SIGINT'));
