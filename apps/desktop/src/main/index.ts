import { app, BrowserWindow, ipcMain, shell, dialog, powerMonitor } from 'electron';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { mkdirSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { DbClient } from '../host/db-client.js';
import { envelopeSchema } from '../host/service.js';
import { HostMediaService, loadHostId } from '../host/media-service.js';
import { HostDeviceService } from '../host/device-service.js';
import { HostServices } from '../host/services.js';
import { HostWorkspaceService } from '../host/workspace-service.js';

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
    db: DbClient | null = null,
    services: HostServices | null = null;
  let suspendedAt: number | null = null;
  app.on('second-instance', () => {
    window?.show();
    window?.focus();
  });
  void app
    .whenReady()
    .then(async () => {
      const hostId = await loadHostId(app.getPath('userData'));
      db = new DbClient(resolve(app.getPath('userData'), 'studio.sqlite'), hostId);
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
      const media = new HostMediaService(db, hostId, async (kind) => {
        const result = await dialog.showOpenDialog(window!, {
          title: kind === 'FOLDER' ? 'Chọn thư mục media' : 'Chọn tệp media',
          properties: kind === 'FOLDER' ? ['openDirectory'] : ['openFile', 'multiSelections'],
          ...(kind === 'FILE'
            ? {
                filters: [
                  {
                    name: 'Media',
                    extensions: [
                      'mp4',
                      'mov',
                      'mkv',
                      'webm',
                      'm4v',
                      'avi',
                      'jpg',
                      'jpeg',
                      'png',
                      'webp',
                      'gif',
                      'bmp',
                    ],
                  },
                ],
              }
            : {}),
        });
        return result.canceled ? null : result.filePaths;
      });
      const devices = new HostDeviceService(
        db,
        hostId,
        app.getPath('userData'),
        async () => {
          const result = await dialog.showOpenDialog(window!, {
            title: 'Chọn adb / adb.exe từ Platform-Tools',
            properties: ['openFile'],
          });
          return result.canceled ? null : (result.filePaths[0] ?? null);
        },
        {
          port: Number(process.env.AUTOREELS_ADB_SERVER_PORT ?? 5037),
          ...(process.env.AUTOREELS_ADB ? { path: process.env.AUTOREELS_ADB } : {}),
        },
        async (name, model) => {
          const response = await dialog.showMessageBox(window!, {
            type: 'warning',
            title: 'Xác minh lại điện thoại',
            message: 'Bạn đã kiểm tra đúng điện thoại thực tế?',
            detail: 'Thiết bị đã đăng ký: ' + name + ' · ' + (model ?? 'không rõ model') + '. Chỉ xác nhận khi đang cầm đúng điện thoại lịch sử và ADB vừa được quét lại. Khôi phục sẽ TẮT thiết bị; bạn phải kiểm tra và bật lại thủ công.',
            buttons: ['Hủy', 'Tôi đã đối chiếu điện thoại thật'],
            defaultId: 0,
            cancelId: 0,
            noLink: true,
          });
          return response.response === 1;
        },
      );
      services = new HostServices(
        media,
        devices,
        new HostWorkspaceService(db, app.getPath('userData')),
      );
      await services.ready();
      // Only a paired, observed native suspend/resume can classify missed slots.
      // A startup, clock jump, busy queue or device reconnect is NOT a sleep gap.
      powerMonitor.on('suspend', () => { suspendedAt = Date.now(); });
      powerMonitor.on('resume', () => {
        const began = suspendedAt;
        suspendedAt = null;
        const resumed = Date.now();
        if (
          began === null ||
          resumed - began < 30000 ||
          resumed - began > 7 * 24 * 60 * 60 * 1000 ||
          !db
        ) return;
        void db
          .internal({ command: 'queue.reconcileSleep', suspendedAt: began, resumedAt: resumed })
          .catch((error: unknown) =>
            console.error(
              'Sleep recovery requires operator review:',
              error instanceof Error ? error.message : 'Unknown worker failure',
            ),
          );
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
        return services!.request(envelope.command, envelope.input);
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
        const result: unknown = await window.webContents.executeJavaScript(`(async()=>{
          for(let i=0;i<100&&document.querySelectorAll('[data-route]').length!==6;i++)await new Promise(r=>setTimeout(r,20));
          const api=window.studioApi, suffix=crypto.randomUUID().replaceAll('-','');
          const original=await api.createWorkflow('fb','Electron smoke fixture');
          original.bundle.workflow.name='Electron saved fixture';
          original.bundle.inputs=[{key:'caption',type:'text',scope:'row',required:true},{key:'count',type:'number',scope:'row',required:false},{key:'enabled',type:'boolean',scope:'row',required:false}];
          const saved=await api.saveWorkflow(original.bundle,0),loaded=await api.loadWorkflow(saved.workflowId);
          const process=await api.saveProcess({id:'process_'+suffix,name:'Electron XLSX fixture',appId:'fb',workflowId:saved.workflowId,workflowVersionId:null,deviceId:null,accountId:null,targetId:null,revision:0,archived:false,schedule:{timezone:'Asia/Ho_Chi_Minh',startDate:'2026-10-26',slots:['08:00'],weekdays:[1,2,3,4,5,6,7],overduePolicy:'NEXT_FUTURE_SLOT',jitterMinutes:0}},null);
          const item=await api.saveContent({id:'content_'+suffix,processId:process.id,revision:0,fields:{caption:['Electron','XLSX'].join(String.fromCharCode(10)),count:0,enabled:false},assetIds:[],ignored:false},null);
          const file=await api.exportContent(process.id,[item.id],'XLSX');
          const preview=await api.previewContentImport(process.id,process.revision,'XLSX',file.data);
          const applied=await api.applyContentPreview(preview.token);
          const contentXlsxRoundTrip=preview.canApply&&preview.changes[0].action==='UNCHANGED'&&applied.updated===0&&applied.created===0;
          await api.ignoreContent(item.id,item.revision);await api.saveProcess({...process,archived:true},process.revision);await api.archiveWorkflow(saved.workflowId);
          return{contentXlsxRoundTrip,nativeChooser:(await api.mediaCapabilities()).nativeChooser,privateApi:typeof api.internal,privateQueueApi:typeof api.claimDueJob,api:typeof api.bootstrap==='function',node:typeof window.require,routes:document.querySelectorAll('[data-route]').length,saveReload:loaded.bundle.workflow.name==='Electron saved fixture'&&loaded.revision===1};
        })()`);
        console.log(JSON.stringify({ scope: 'ELECTRON_RENDERER_SMOKE', result }));
        const check = result as {
          api?: boolean;
          contentXlsxRoundTrip?: boolean;
          privateQueueApi?: string;
          nativeChooser?: boolean;
          privateApi?: string;
          node?: string;
          routes?: number;
          saveReload?: boolean;
        };
        if (
          !check.api ||
          !check.contentXlsxRoundTrip ||
          check.privateQueueApi !== 'undefined' ||
          !check.nativeChooser ||
          check.privateApi !== 'undefined' ||
          check.node !== 'undefined' ||
          check.routes !== 6 ||
          !check.saveReload
        )
          throw new Error('Electron renderer smoke failed');
        window.destroy();
        await services.close();
        await db.close();
        app.exit(0);
      }
      app.on('window-all-closed', () => {
        void services
          ?.close()
          .then(() => db?.close())
          .finally(() => app.quit());
      });
    })
    .catch((error) => {
      console.error('Desktop startup failed:', error);
      app.exit(1);
    });
}
