import { app, BrowserWindow, ipcMain, shell } from 'electron';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { mkdirSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { DbClient } from '../host/db-client.js';
import { envelopeSchema } from '../host/service.js';

app.setName('AutoReels Studio');
if (process.argv.includes('--smoke') && !process.env.AUTOREELS_DATA_DIR)
  throw new Error('Smoke tests require an explicit isolated AUTOREELS_DATA_DIR');
if (process.env.AUTOREELS_DATA_DIR) {
  mkdirSync(process.env.AUTOREELS_DATA_DIR, { recursive: true });
  app.setPath('userData', resolve(process.env.AUTOREELS_DATA_DIR));
}
if (!app.requestSingleInstanceLock()) app.quit();
else {
  let window: BrowserWindow | null = null,
    db: DbClient | null = null;
  app.on('second-instance', () => {
    window?.show();
    window?.focus();
  });
  void app
    .whenReady()
    .then(async () => {
      db = new DbClient(resolve(app.getPath('userData'), 'studio.sqlite'));
      await db.request('bootstrap');
      const rendererFile = fileURLToPath(new URL('../../renderer/index.html', import.meta.url)),
        allowedUrl = pathToFileURL(rendererFile).href;
      window = new BrowserWindow({
        width: 1600,
        height: 1000,
        minWidth: 1100,
        minHeight: 720,
        backgroundColor: '#f3f5f9',
        show: !process.argv.includes('--smoke'),
        webPreferences: {
          preload: fileURLToPath(new URL('../preload.cjs', import.meta.url)),
          contextIsolation: true,
          nodeIntegration: false,
          sandbox: true,
        },
      });
      const request = z.strictObject({ command: z.string(), input: z.unknown() });
      ipcMain.handle('studio:request', async (event, raw: unknown) => {
        if (
          event.sender !== window?.webContents ||
          event.senderFrame !== window.webContents.mainFrame ||
          event.senderFrame.url !== allowedUrl
        )
          throw new Error('Unauthorized sender');
        const parsed = request.parse(raw),
          envelope = envelopeSchema.parse({
            ...parsed,
            operationId: 'op_' + randomUUID().replaceAll('-', ''),
          });
        return db!.request(envelope.command, envelope.input);
      });
      window.webContents.setWindowOpenHandler(({ url }) => {
        if (url.startsWith('https://')) void shell.openExternal(url);
        return { action: 'deny' };
      });
      window.webContents.on('will-navigate', (event, url) => {
        if (url !== allowedUrl) event.preventDefault();
      });
      window.webContents.session.webRequest.onHeadersReceived((details, done) =>
        done({
          responseHeaders: {
            ...details.responseHeaders,
            'Content-Security-Policy': [
              "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'none'; object-src 'none'; base-uri 'none'",
            ],
          },
        }),
      );
      await window.loadFile(rendererFile);
      if (process.argv.includes('--smoke')) {
        const result: unknown = await window.webContents.executeJavaScript(
          "(async()=>{for(let i=0;i<100&&document.querySelectorAll('[data-route]').length!==6;i++)await new Promise(r=>setTimeout(r,20));const api=window.studioApi;const original=await api.createWorkflow('fb','Electron smoke fixture');original.bundle.workflow.name='Electron saved fixture';const saved=await api.saveWorkflow(original.bundle,0);const loaded=await api.loadWorkflow(saved.workflowId);await api.archiveWorkflow(saved.workflowId);return{api:typeof api.bootstrap==='function',node:typeof window.require,routes:document.querySelectorAll('[data-route]').length,saveReload:loaded.bundle.workflow.name==='Electron saved fixture'&&loaded.revision===1}})()",
        );
        console.log(JSON.stringify({ scope: 'ELECTRON_RENDERER_SMOKE', result }));
        const check = result as {
          api?: boolean;
          node?: string;
          routes?: number;
          saveReload?: boolean;
        };
        if (!check.api || check.node !== 'undefined' || check.routes !== 6 || !check.saveReload)
          throw new Error('Electron renderer smoke failed');
        window.destroy();
        await db.close();
        app.exit(0);
      }
      app.on('window-all-closed', () => {
        void db?.close().finally(() => app.quit());
      });
    })
    .catch((error) => {
      console.error('Desktop startup failed:', error);
      app.exit(1);
    });
}
