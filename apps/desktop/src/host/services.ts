import type { ApiCommand, WorkflowBundle } from '@autoreels/contracts';
import type { HostDeviceService } from './device-service.js';
import type { HostMediaService } from './media-service.js';
import { HostDebugService } from './debug-service.js';
/** Named host services keep privileged network/device/file work out of the SQLite worker. */
export class HostServices {
  readonly debug: HostDebugService;
  constructor(
    readonly media: HostMediaService,
    readonly devices: HostDeviceService,
  ) {
    this.debug = new HostDebugService(
      async (bundle) => (await this.media.request('resolveWorkflow', { bundle })) as WorkflowBundle,
    );
  }
  async ready(): Promise<void> {
    await this.media.ready();
    await this.devices.ready();
  }
  request(command: ApiCommand, input: unknown): Promise<unknown> {
    if (this.debug.handles(command)) return this.debug.request(command, input);
    return this.devices.handles(command)
      ? this.devices.request(command, input)
      : this.media.request(command, input);
  }
  async close(): Promise<void> {
    await this.debug.close();
    await this.devices.close();
    await this.media.close();
  }
}
