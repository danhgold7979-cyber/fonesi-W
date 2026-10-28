import { createServer, type Socket } from 'node:net';
import { crc32, deflateSync } from 'node:zlib';
export function png(width = 360, height = 640): Buffer {
  const chunk = (name: string, data: Buffer) => {
    const type = Buffer.from(name),
      length = Buffer.alloc(4),
      crc = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    crc.writeUInt32BE(crc32(Buffer.concat([type, data])));
    return Buffer.concat([length, type, data, crc]);
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 2;
  const pixels = Buffer.alloc((width * 3 + 1) * height, 100);
  for (let row = 0; row < height; row++) pixels[row * (width * 3 + 1)] = 0;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(pixels)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}
export async function startAdbFixture() {
  const sockets = new Set<Socket>();
  let closing = false;
  const state = {
    protocol: 41,
    hardwareSerial: 'SERIAL_FIXTURE',
    connectAlias: '',
    connectError: false,
    autoConnect: false,
    list: 'USB_FIXTURE\tdevice product:fixture model:Fixture_Phone transport_id:1\n',
    requests: [] as string[],
    shells: [] as string[],
    rotation: 0,
    rotateOnXml: false,
    xml: '<?xml version="1.0"?><hierarchy rotation="0"><node bounds="[0,0][360,640]" class="android.view.View" package="com.facebook.katana" enabled="true"><node bounds="[20,30][200,100]" resource-id="com.facebook.katana:id/submit" text="Publish fixture" class="android.widget.Button" package="com.facebook.katana" clickable="true" enabled="true"/></node></hierarchy>',

    width: 360,
    height: 640,
    foreground: 'com.facebook.katana',
    exitCode: 0,
    stall: false,
    split: false,
  };
  const properties = () =>
    '[ro.serialno]: [' + state.hardwareSerial + ']\n[ro.product.manufacturer]: [Fixture]\n[ro.product.model]: [Fixture Phone]\n[ro.product.device]: [fixture_product]\n[ro.build.version.sdk]: [34]\n[ro.build.version.release]: [14]\n[persist.sys.locale]: [vi-VN]\n';
  const server = createServer((socket) => {
    if (closing) {
      socket.destroy();
      return;
    }
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
    socket.on('error', () => undefined);
    let buffer = Buffer.alloc(0),
      stream = false;
    const write = (data: Buffer | string, end = false) => {
      const value = typeof data === 'string' ? Buffer.from(data) : data;
      if (state.split) {
        for (let index = 0; index < value.length; index += 3)
          socket.write(value.subarray(index, index + 3));
        if (end) socket.end();
      } else if (end) socket.end(value);
      else socket.write(value);
    };
    const string = (value: string) =>
      write('OKAY' + Buffer.byteLength(value).toString(16).padStart(4, '0') + value);
    const frame = (channel: number, bytes: Buffer) => {
      const header = Buffer.alloc(5);
      header[0] = channel;
      header.writeUInt32LE(bytes.length, 1);
      return Buffer.concat([header, bytes]);
    };
    socket.on('data', (data: Buffer) => {
      if (stream) return;
      buffer = Buffer.concat([buffer, data]);
      while (buffer.length >= 4) {
        const length = parseInt(buffer.toString('ascii', 0, 4), 16);
        if (!Number.isFinite(length) || buffer.length < 4 + length) return;
        const service = buffer.toString('utf8', 4, 4 + length);
        buffer = buffer.subarray(4 + length);
        state.requests.push(service.startsWith('host:pair:') ? 'host:pair:[REDACTED]' : service);
        if (state.stall) return;
        if (service === 'host:version') string(state.protocol.toString(16).padStart(4, '0'));
        else if (service === 'host:devices-l') string(state.list);
        else if (service.startsWith('host:transport:')) write('OKAY');
        else if (service.startsWith('host:connect:')) {
          const serial = state.connectAlias || service.slice(13);
          if (state.connectError) string('failed to connect');
          else {
            if (state.autoConnect && !state.list.includes(serial))
              state.list += serial + '\tdevice product:fixture\n';
            string('connected to ' + serial);
          }
        } else if (service.startsWith('host:pair:')) string('Successfully paired');
        else if (service.startsWith('host:disconnect:')) {
          state.list = state.list
            .split('\n')
            .filter((row) => !row.startsWith(service.slice(16) + '\t'))
            .join('\n');
          string('disconnected');
        } else if (service === 'exec:screencap -p') {
          stream = true;
          write(Buffer.concat([Buffer.from('OKAY'), png(state.width, state.height)]), true);
        } else if (service.startsWith('shell,v2,raw:')) {
          stream = true;
          const command = service.slice(13);
          state.shells.push(command);
          let stdout = '';
          if (command.startsWith("'cat' '/data/local/tmp/autoreels-inspector-")) {
            stdout = state.xml;
            if (state.rotateOnXml) state.rotation = 1;
          } else if (command === "'getprop'") stdout = properties();
          else if (command === "'pm' 'list' 'packages'")
            stdout = 'package:com.facebook.katana\npackage:com.android.settings\n';
          else if (command === "'dumpsys' 'input'")
            stdout = 'SurfaceOrientation: ' + state.rotation + '\n';
          else if (command === "'dumpsys' 'activity' 'activities'")
            stdout = state.foreground
              ? 'mResumedActivity: ActivityRecord{abc u0 ' + state.foreground + '/.Main t1}\n'
              : '';
          else if (command.startsWith("'cmd' 'package' 'resolve-activity'"))
            stdout = 'com.facebook.katana/.Main\n';
          else if (command.startsWith("'am' 'start'")) state.foreground = 'com.facebook.katana';
          else if (command.startsWith("'am' 'force-stop'")) state.foreground = '';
          else if (command === "'am' 'get-current-user'") stdout = '0';
          else if (command.startsWith("'dumpsys' 'package'"))
            stdout = 'User 0: installed=true stopped=true';
          write(
            Buffer.concat([
              Buffer.from('OKAY'),
              frame(1, Buffer.from(stdout)),
              frame(3, Buffer.from([state.exitCode])),
            ]),
            true,
          );
        } else write('FAIL000bunsupported', true);
      }
    });
  });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve());
  });
  return {
    state,
    port: (server.address() as { port: number }).port,
    close: async () => {
      closing = true;
      for (const socket of sockets) socket.destroy();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}
