import { useEffect, useRef, useState } from 'react';
import { jobStates } from '@autoreels/contracts';
import type { ProcessDefinition, ScheduledJobSummary, JobDefinition } from '@autoreels/contracts';
import { api } from './api.js';
import { Dialog, Empty } from './components.js';

const stateLabels: Record<JobDefinition['state'], string> = {
  DRAFT: 'Nháp',
  SCHEDULED: 'Đã lưu lịch',
  QUEUED: 'Chờ lượt',
  PREFLIGHT: 'Đang kiểm tra',
  RUNNING: 'Đang chạy',
  POST_INTENT: 'Chuẩn bị đăng',
  POST_PENDING: 'Đang xác minh bài',
  POSTED: 'Đã đăng',
  COMMENT_PENDING: 'Đang xác minh bình luận',
  SUCCESS: 'Hoàn tất',
  SUCCESS_WITH_WARNINGS: 'Hoàn tất có lưu ý',
  WAITING_DEVICE: 'Chờ điện thoại',
  WAITING_NETWORK: 'Chờ mạng',
  MEDIA_MISSING: 'Thiếu media',
  MEDIA_CHANGED: 'Media đã đổi',
  TARGET_MISSING: 'Thiếu đích đăng',
  NEEDS_REVIEW: 'Cần đối soát',
  FAILED: 'Thất bại',
  CANCELLED: 'Đã hủy',
  SKIPPED: 'Đã bỏ lượt',
};
interface Props {
  processes: ProcessDefinition[];
  devices: { id: string; name: string; enabled: boolean }[];
  notify: (message: string) => void;
  openProcesses: () => void;
}
export function Schedule(props: Props) {
  const [processId, setProcessId] = useState(''),
    [deviceId, setDeviceId] = useState(''),
    [state, setState] = useState('');
  const [from, setFrom] = useState(''),
    [to, setTo] = useState('');
  const [jobs, setJobs] = useState<ScheduledJobSummary[]>([]),
    [hasMore, setHasMore] = useState(false),
    [loading, setLoading] = useState(true),
    [error, setError] = useState('');
  const [revision, setRevision] = useState(0),
    [selected, setSelected] = useState<ScheduledJobSummary | null>(null),
    [date, setDate] = useState(''),
    [time, setTime] = useState(''),
    [busy, setBusy] = useState(false);
  const generation = useRef(0),
    mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      generation.current++;
    };
  }, []);
  useEffect(() => {
    const token = ++generation.current;
    setLoading(true);
    setError('');
    void api
      .jobs({
        ...(processId ? { processId } : {}),
        ...(deviceId ? { deviceId } : {}),
        ...(state ? { state: state as JobDefinition['state'] } : {}),
        ...(from ? { fromUtc: new Date(from + 'T00:00:00Z').toISOString() } : {}),
        ...(to
          ? { toUtc: new Date(new Date(to + 'T00:00:00Z').getTime() + 86400000).toISOString() }
          : {}),
        limit: 500,
      })
      .then((result) => {
        if (token !== generation.current) return;
        setJobs(result.jobs);
        setHasMore(result.hasMore);
      })
      .catch((e) => {
        if (token === generation.current)
          setError(e instanceof Error ? e.message : 'Không tải được lịch.');
      })
      .finally(() => {
        if (token === generation.current) setLoading(false);
      });
  }, [processId, deviceId, state, from, to, revision]);
  function open(job: ScheduledJobSummary): void {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: job.timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(new Date(job.scheduledUtc));
    const part = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
    setDate(part('year') + '-' + part('month') + '-' + part('day'));
    setTime(part('hour') + ':' + part('minute'));
    setSelected(job);
  }
  async function change(action: () => Promise<unknown>): Promise<void> {
    setBusy(true);
    try {
      await action();
      if (mounted.current) {
        setSelected(null);
        setRevision((r) => r + 1);
        props.notify('Đã cập nhật lịch.');
      }
    } catch (e) {
      if (mounted.current)
        props.notify(e instanceof Error ? e.message : 'Không cập nhật được lịch.');
    } finally {
      if (mounted.current) setBusy(false);
    }
  }
  return (
    <div className="page schedule-page">
      <div className="page-heading">
        <div>
          <h1>Lịch đăng</h1>
          <p>Công việc đã lưu theo từng điện thoại. Android runtime chưa khả dụng.</p>
        </div>
        <div className="actions">
          <button onClick={() => setRevision((r) => r + 1)}>Tải lại</button>
          <button onClick={props.openProcesses}>Lên lịch trong tiến trình</button>
        </div>
      </div>
      <div className="surface schedule-filters">
        <label>
          Tiến trình
          <select
            aria-label="Lọc lịch theo tiến trình"
            value={processId}
            onChange={(e) => setProcessId(e.target.value)}
          >
            <option value="">Tất cả</option>
            {props.processes.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Điện thoại
          <select
            aria-label="Lọc lịch theo điện thoại"
            value={deviceId}
            onChange={(e) => setDeviceId(e.target.value)}
          >
            <option value="">Tất cả</option>
            {props.devices.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Trạng thái
          <select
            aria-label="Lọc trạng thái lịch"
            value={state}
            onChange={(e) => setState(e.target.value)}
          >
            <option value="">Tất cả</option>
            {jobStates.map((s) => (
              <option key={s} value={s}>
                {stateLabels[s]}
              </option>
            ))}
          </select>
        </label>
        <label>
          Từ ngày (UTC)
          <input
            aria-label="Lọc lịch từ ngày UTC"
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </label>
        <label>
          Đến ngày (UTC)
          <input
            aria-label="Lọc lịch đến ngày UTC"
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </label>
      </div>
      {error ? (
        <Empty title="Không tải được lịch">{error}</Empty>
      ) : loading ? (
        <p role="status">Đang tải lịch…</p>
      ) : !jobs.length ? (
        <Empty icon="▣" title="Chưa có công việc trong phạm vi này">
          Chọn nội dung trong Tiến trình, xem trước giờ và áp dụng để lưu lịch. Cần điện thoại đã
          đăng ký cùng phiên bản workflow.
        </Empty>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Giờ chạy · múi giờ tiến trình</th>
                <th>Tiến trình</th>
                <th>Điện thoại</th>
                <th>Nội dung</th>
                <th>Trạng thái</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((job) => (
                <tr key={job.id}>
                  <td>
                    <strong>
                      {new Date(job.scheduledUtc).toLocaleString('vi-VN', {
                        timeZone: job.timezone,
                      })}
                    </strong>
                    <small className="timeline-timezone">{job.timezone}</small>
                  </td>
                  <td>{job.processName}</td>
                  <td>{job.deviceName}</td>
                  <td>
                    <code title={job.contentId}>{job.contentId.slice(0, 18)}</code>
                  </td>
                  <td>
                    <span className="badge">{stateLabels[job.state]}</span>
                  </td>
                  <td>
                    <button
                      disabled={job.state !== 'SCHEDULED'}
                      aria-label={'Sửa lịch ' + job.id}
                      onClick={() => open(job)}
                    >
                      Sửa lịch
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {hasMore && (
        <p className="muted">
          Đang hiển thị 500 công việc đầu tiên. Thu hẹp bộ lọc để xem các công việc còn lại.
        </p>
      )}
      {selected && (
        <Dialog
          title="Sửa lịch công việc"
          close={() => {
            if (!busy) setSelected(null);
          }}
        >
          <p>
            {selected.processName} · {selected.deviceName}
          </p>
          <p className="muted">
            Múi giờ: {selected.timezone}. Dữ liệu và workflow của công việc được giữ nguyên.
          </p>
          <div className="form-grid">
            <label className="field">
              Ngày
              <input
                aria-label="Ngày chạy mới"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </label>
            <label className="field">
              Giờ
              <input
                aria-label="Giờ chạy mới"
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
              />
            </label>
          </div>
          <div className="dialog-actions">
            <button
              disabled={busy}
              onClick={() => {
                void change(() => api.cancelScheduledJob(selected.id, selected.revision));
              }}
            >
              Hủy công việc
            </button>
            <button
              className="primary"
              disabled={busy || !date || !time}
              onClick={() => {
                void change(() =>
                  api.rescheduleJob(selected.id, selected.revision, date, time, selected.timezone),
                );
              }}
            >
              Lưu giờ mới
            </button>
          </div>
        </Dialog>
      )}
    </div>
  );
}
