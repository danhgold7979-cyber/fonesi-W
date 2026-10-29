import type { JsonValue } from './types.js';
import type { TraceReportDto } from './api.js';

export type DebugAction = 'CONTINUE' | 'PAUSE' | 'STEP_INTO' | 'STEP_OVER' | 'STEP_OUT' | 'STOP';
export type DebugState =
  | 'RUNNING'
  | 'PAUSED'
  | 'STOPPING'
  | 'COMPLETED'
  | 'UNSUPPORTED'
  | 'REVIEW'
  | 'ERROR'
  | 'CANCELLED';
export interface DebugSnapshot {
  id: string;
  revision: number;
  mode: 'TRACE';
  state: DebugState;
  reason: 'entry' | 'breakpoint' | 'step' | 'pause' | null;
  current: {
    graphId: string;
    nodeId: string;
    depth: number;
    stack: { graphId: string; nodeId: string }[];
    locals: Record<string, JsonValue>;
    outputs: Record<string, JsonValue>;
  } | null;
  events: TraceReportDto['events'];
  totalEvents: number;
  report: TraceReportDto | null;
}
