import { afterEach, describe, expect, it } from 'vitest';
import type { DebugSnapshot, WorkflowBundle } from '@autoreels/contracts';
import { HostDebugService } from '../apps/desktop/src/host/debug-service.js';

const bundle: WorkflowBundle = {
  format: 'autoreels-workflow',
  schemaVersion: 2,
  workflow: { id: 'wf_debug_host', appId: 'fb', name: 'Host debugger', kind: 'main' },
  mainGraphId: 'main',
  inputs: [],
  outputs: [],
  dependencies: [],
  graphs: [
    {
      id: 'main',
      inputs: [],
      outputs: [],
      nodes: [
        { id: 'start', type: 'start', name: 'Start', x: 0, y: 0, config: {} },
        { id: 'end', type: 'end', name: 'End', x: 200, y: 0, config: {} },
      ],
      edges: [{ id: 'e', source: 'start', target: 'end', port: 'next' }],
    },
  ],
};
describe('named host debugger service', () => {
  const services: HostDebugService[] = [];
  afterEach(async () => {
    await Promise.all(services.splice(0).map((s) => s.close()));
  });
  it('returns a paused session immediately and processes controls outside the DB worker', async () => {
    const host = new HostDebugService();
    services.push(host);
    const started = (await host.request('startDebug', { bundle, row: {} })) as DebugSnapshot;
    expect(started.state).toBe('PAUSED');
    expect(host.handles('deviceAction')).toBe(false);
    await host.request('controlDebug', { id: started.id, action: 'CONTINUE' });
    let snapshot = (await host.request('debugSnapshot', { id: started.id })) as DebugSnapshot;
    for (let attempt = 0; snapshot.state === 'RUNNING' && attempt < 20; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 1));
      snapshot = (await host.request('debugSnapshot', { id: started.id })) as DebugSnapshot;
    }
    expect(snapshot.state).toBe('COMPLETED');
    expect(snapshot.report!.events).toHaveLength(2);
  });
  it('bounds active sessions, validates commands and releases suspended sessions on close', async () => {
    const host = new HostDebugService();
    services.push(host);
    for (let i = 0; i < 4; i++) await host.request('startDebug', { bundle, row: {} });
    await expect(host.request('startDebug', { bundle, row: {} })).rejects.toThrow('4');
    await expect(
      host.request('controlDebug', { id: 'unknown', action: 'PUBLISH' }),
    ).rejects.toThrow();
    await host.close();
    await expect(host.request('startDebug', { bundle, row: {} })).rejects.toThrow('đóng');
  });
});
