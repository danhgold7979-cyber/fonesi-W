import type { ApiCommand } from '@autoreels/contracts';
import type { HostDeviceService } from './device-service.js';
import type { HostMediaService } from './media-service.js';
/** Named host services keep privileged network/device/file work out of the SQLite worker. */
export class HostServices {
  constructor(
    readonly media: HostMediaService,
    readonly devices: HostDeviceService,
  ) {}
  async ready(): Promise<void> {
    await this.media.ready();
    await this.devices.ready();
  }
  request(command: ApiCommand, input: unknown): Promise<unknown> {
    return this.devices.handles(command)
      ? this.devices.request(command, input)
      : this.media.request(command, input);
  }
  async close(): Promise<void> {
    await this.devices.close();
    await this.media.close();
  }
}
