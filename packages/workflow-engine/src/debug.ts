import { randomUUID } from 'node:crypto';
import { traceWorkflow } from './index.js';
import type { TraceBoundary, TraceEvent } from './index.js';
import type { DebugAction, DebugSnapshot, JsonValue, WorkflowBundle } from '@autoreels/contracts';

const terminal = (state: DebugSnapshot['state']) =>
  !['RUNNING', 'PAUSED', 'STOPPING'].includes(state);
function redact(value: JsonValue): JsonValue {
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        /password|secret|token|authorization|cookie|credential/i.test(key)
          ? '[REDACTED]'
          : redact(item),
      ]),
    );
  return value;
}

/** A TRACE session owns no device provider; controls resume the suspended semantic boundary. */
export class TraceDebugSession {
  readonly id = 'debug_' + randomUUID().replaceAll('-', '');
  readonly completion: Promise<void>;
  readonly createdAt = Date.now();
  private controller = new AbortController();
  private data: DebugSnapshot;
  private wake: (() => void) | null = null;
  private first = true;
  private requestedPause = false;
  private mode: DebugAction = 'CONTINUE';
  private resumeDepth = 1;

  constructor(bundle: WorkflowBundle, row: Record<string, JsonValue> = {}) {
    this.data = {
      id: this.id,
      revision: 0,
      mode: 'TRACE',
      state: 'RUNNING',
      reason: null,
      current: null,
      events: [],
      totalEvents: 0,
      report: null,
    };
    this.completion = traceWorkflow(
      bundle,
      { row },
      {
        signal: this.controller.signal,
        beforeStep: (boundary) => this.boundary(boundary),
        onEvent: (event) => this.event(event),
      },
    )
      .then((report) => {
        this.data.state = report.status;
        this.data.reason = null;
        this.data.report = {
          ...report,
          events: this.data.events,
          outputs: redact(report.outputs) as Record<string, JsonValue>,
        };
        this.data.revision++;
      })
      .catch(() => {
        this.data.state = 'ERROR';
        this.data.reason = null;
        this.data.revision++;
      });
  }
  get snapshot(): DebugSnapshot {
    return structuredClone(this.data);
  }
  get finished(): boolean {
    return terminal(this.data.state);
  }
  control(action: DebugAction): DebugSnapshot {
    if (action === 'STOP') {
      if (!this.finished) {
        this.controller.abort();
        this.data.state = 'STOPPING';
        this.data.reason = null;
        this.wake?.();
        this.wake = null;
        this.data.revision++;
      }
      return this.snapshot;
    }
    if (this.finished || this.data.state === 'STOPPING')
      throw new Error('Debug session is finished');
    if (action === 'PAUSE') {
      if (this.data.state === 'RUNNING') this.requestedPause = true;
      return this.snapshot;
    }
    if (this.data.state !== 'PAUSED')
      throw new Error('Pause the debugger before stepping or continuing');
    if (action === 'STEP_OUT' && this.data.current!.depth <= 1)
      throw new Error('No caller frame to step out to');
    this.mode = action;
    this.resumeDepth = this.data.current!.depth;
    this.data.state = 'RUNNING';
    this.data.reason = null;
    this.data.revision++;
    this.wake?.();
    this.wake = null;
    return this.snapshot;
  }
  async close(): Promise<void> {
    this.control('STOP');
    await this.completion;
  }
  private event(event: TraceEvent): void {
    this.data.totalEvents++;
    this.data.events.push(structuredClone(event));
    if (this.data.events.length > 2000) this.data.events.shift();
    this.data.revision++;
  }
  private async boundary(boundary: TraceBoundary): Promise<void> {
    if (this.controller.signal.aborted) return;
    this.data.current = {
      graphId: boundary.graphId,
      nodeId: boundary.nodeId,
      depth: boundary.depth,
      stack: boundary.stack,
      locals: redact(boundary.bindings.local) as Record<string, JsonValue>,
      outputs: redact(boundary.bindings.output) as Record<string, JsonValue>,
    };
    const step =
      this.mode === 'STEP_INTO' ||
      (this.mode === 'STEP_OVER' && boundary.depth <= this.resumeDepth) ||
      (this.mode === 'STEP_OUT' && boundary.depth < this.resumeDepth);
    const reason = this.first
      ? 'entry'
      : this.requestedPause
        ? 'pause'
        : boundary.breakpoint
          ? 'breakpoint'
          : step
            ? 'step'
            : null;
    this.first = false;
    if (!reason) return;
    this.requestedPause = false;
    this.data.state = 'PAUSED';
    this.data.reason = reason;
    this.data.revision++;
    await new Promise<void>((resolve) => {
      this.wake = resolve;
    });
  }
}
