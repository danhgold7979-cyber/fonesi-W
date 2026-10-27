import { useEffect, useRef, useState } from 'react';
import type { DebugAction, DebugSnapshot, JsonValue, WorkflowBundle } from '@autoreels/contracts';
import { api } from './api.js';

const active = (snapshot: DebugSnapshot | null) =>
  !!snapshot && ['RUNNING', 'PAUSED', 'STOPPING'].includes(snapshot.state);
export function DebugPanel(props: {
  bundle: WorkflowBundle;
  notify: (message: string) => void;
  select: (graphId: string, nodeId: string) => void;
}) {
  const [snapshot, setSnapshot] = useState<DebugSnapshot | null>(null);
  const [row, setRow] = useState('{}'),
    [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const session = useRef<string | null>(null),
    mounted = useRef(false);
  const latest = useRef(snapshot);
  latest.current = snapshot;
  function receive(next: DebugSnapshot) {
    if (mounted.current && session.current === next.id)
      setSnapshot((old) => (old?.id === next.id && old.revision > next.revision ? old : next));
  }
  useEffect(() => {
    mounted.current = true;
    let polling = false;
    const timer = setInterval(() => {
      const id = session.current;
      if (!id || polling || !active(latest.current)) return;
      polling = true;
      void api
        .debugSnapshot(id)
        .then(receive)
        .catch((error: unknown) => {
          if (mounted.current && session.current === id) {
            setError(error instanceof Error ? error.message : 'Mất kết nối phiên debug.');
            session.current = null;
          }
        })
        .finally(() => {
          polling = false;
        });
    }, 250);
    return () => {
      mounted.current = false;
      clearInterval(timer);
      const id = session.current;
      session.current = null;
      if (id) void api.controlDebug(id, 'STOP').catch(() => undefined);
    };
  }, []);
  async function start() {
    setBusy(true);
    setError('');
    try {
      const value: unknown = JSON.parse(row);
      if (!value || typeof value !== 'object' || Array.isArray(value))
        throw new Error('Dữ liệu thử phải là object JSON.');
      const next = await api.startDebug(props.bundle, value as Record<string, JsonValue>);
      if (!mounted.current) {
        await api.controlDebug(next.id, 'STOP');
        return;
      }
      session.current = next.id;
      receive(next);
    } catch (error) {
      if (mounted.current)
        setError(error instanceof Error ? error.message : 'Không thể bắt đầu debug.');
    } finally {
      if (mounted.current) setBusy(false);
    }
  }
  async function control(action: DebugAction) {
    const id = session.current;
    if (!id) return;
    setBusy(true);
    setError('');
    try {
      receive(await api.controlDebug(id, action));
    } catch (error) {
      if (mounted.current) props.notify(error instanceof Error ? error.message : 'Debug thất bại.');
    } finally {
      if (mounted.current) setBusy(false);
    }
  }
  const paused = snapshot?.state === 'PAUSED';
  return (
    <section aria-label="Debug TRACE" className="debug-panel">
      <div className="debug-controls">
        <strong>TRACE · {snapshot?.state ?? 'Chưa bắt đầu'}</strong>
        <label>
          Dữ liệu thử (JSON)
          <input
            aria-label="Dữ liệu debug JSON"
            value={row}
            disabled={active(snapshot) || busy}
            onChange={(e) => setRow(e.target.value)}
          />
        </label>
        <button disabled={active(snapshot) || busy} onClick={() => void start()}>
          Bắt đầu Debug TRACE
        </button>
        {(
          [
            ['CONTINUE', 'Tiếp tục'],
            ['PAUSE', 'Tạm dừng'],
            ['STEP_INTO', 'Bước vào'],
            ['STEP_OVER', 'Bước qua'],
            ['STEP_OUT', 'Bước ra'],
            ['STOP', 'Dừng debug'],
          ] as const
        ).map(([action, label]) => (
          <button
            key={action}
            disabled={
              busy ||
              (action === 'STOP'
                ? !active(snapshot) || snapshot?.state === 'STOPPING'
                : action === 'PAUSE'
                  ? snapshot?.state !== 'RUNNING'
                  : !paused || (action === 'STEP_OUT' && (snapshot?.current?.depth ?? 0) < 2))
            }
            onClick={() => void control(action)}
          >
            {label}
          </button>
        ))}
      </div>
      <p className="muted">
        Chạy bản chụp workflow lúc bắt đầu; không gửi thao tác Android. Đóng panel sẽ dừng phiên.
        {snapshot?.reason && ' Điểm dừng: ' + snapshot.reason + '.'}
      </p>
      {error && <p role="alert">{error}</p>}
      {snapshot?.current && (
        <div className="debug-state">
          <div>
            <strong>Call stack</strong>
            {snapshot.current.stack.map((frame, i) => (
              <button key={i} onClick={() => props.select(frame.graphId, frame.nodeId)}>
                {frame.graphId} / {frame.nodeId}
              </button>
            ))}
          </div>
          <pre aria-label="Biến local debug">
            {JSON.stringify(snapshot.current.locals, null, 2)}
          </pre>
        </div>
      )}
      {snapshot?.report && <strong>Kết quả debug: {snapshot.report.status}</strong>}
      {snapshot && <small>{snapshot.totalEvents} sự kiện · hiển thị tối đa 2000</small>}
      {snapshot?.events.slice(-100).map((event, i) => (
        <div key={i} className="trace-line">
          <button onClick={() => props.select(event.graphId, event.nodeId)}>
            {event.type} · {event.nodeId}
          </button>
          <span>
            {event.status} · {event.detail}
          </span>
        </div>
      ))}
    </section>
  );
}
