import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DbClient } from './db-client.js';
import { envelopeSchema } from './service.js';

const root = fileURLToPath(new URL('../../../../../', import.meta.url));
const renderer = resolve(fileURLToPath(new URL('../../renderer/', import.meta.url)));
const db = new DbClient(
  resolve(process.env.AUTOREELS_DATA_DIR ?? resolve(root, '.data'), 'studio.sqlite'),
);
await db.request('bootstrap');
const token = randomBytes(32).toString('hex');
const csp =
  "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'";
const server = createServer(async (req, res) => {
  res.setHeader('Content-Security-Policy', csp);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'no-store');
  try {
    const port = (server.address() as { port: number }).port;
    const expectedHost = '127.0.0.1:' + port,
      origin = 'http://' + expectedHost;
    if (req.headers.host !== expectedHost) {
      res.writeHead(403);
      res.end('Forbidden host');
      return;
    }
    const url = new URL(req.url ?? '/', origin);
    if (url.pathname === '/health' && req.method === 'GET') {
      await db.request('bootstrap');
      res.setHeader('Content-Type', 'application/json');
      res.end('{"ok":true,"database":"ready"}');
      return;
    }
    if (url.pathname === '/api' && req.method === 'POST') {
      if (
        req.headers.origin !== origin ||
        req.headers['x-studio-token'] !== token ||
        req.headers['content-type'] !== 'application/json'
      ) {
        res.writeHead(403);
        res.end('Forbidden origin/token');
        return;
      }
      let size = 0;
      const chunks: Buffer[] = [];
      for await (const chunk of req) {
        const b = Buffer.from(chunk as Buffer);
        size += b.length;
        if (size > 8388608) {
          res.writeHead(413);
          res.end('Request too large');
          return;
        }
        chunks.push(b);
      }
      const request = envelopeSchema.parse(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      const value = await db.request(request.command, request.input);
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ ok: true, value }));
      return;
    }
    if (req.method !== 'GET') {
      res.writeHead(405);
      res.end();
      return;
    }
    const pathname = decodeURIComponent(url.pathname),
      file = resolve(renderer, '.' + pathname);
    if (file !== renderer && !file.startsWith(renderer + sep)) {
      res.writeHead(403);
      res.end();
      return;
    }
    const target = pathname === '/' ? resolve(renderer, 'index.html') : file;
    let content = await readFile(target);
    if (target.endsWith('index.html'))
      content = Buffer.from(content.toString('utf8').replace('__STUDIO_TOKEN__', token));
    const mime: Record<string, string> = {
      '.html': 'text/html; charset=utf-8',
      '.js': 'text/javascript',
      '.css': 'text/css',
      '.svg': 'image/svg+xml',
      '.png': 'image/png',
    };
    res.setHeader('Content-Type', mime[extname(target)] ?? 'application/octet-stream');
    res.end(content);
  } catch (error) {
    const code =
      error && typeof error === 'object' && 'code' in error
        ? String(error.code)
        : 'INVALID_REQUEST';
    const message =
      code === 'ENOENT'
        ? 'Not found'
        : error instanceof Error && 'code' in error
          ? error.message
          : 'Dữ liệu không hợp lệ.';
    res.writeHead(code === 'ENOENT' ? 404 : 400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: false, error: { code, message } }));
  }
});
server.listen(Number(process.env.PORT ?? 4173), '127.0.0.1', () =>
  console.log(
    'AutoReels authoring host ready on port ' + (server.address() as { port: number }).port,
  ),
);
const stop = (): void => {
  server.close(() => {
    void db.close().then(() => process.exit(0));
  });
};
process.on('SIGTERM', stop);
process.on('SIGINT', stop);
