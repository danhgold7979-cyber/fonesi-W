import { useEffect, useRef, useState } from 'react';
import { jobStates } from '@autoreels/contracts';
import type {
  ProcessDefinition,
  ScheduledJobSummary,
  JobDefinition,
  JobQuery,
  AppDefinition,
} from '@autoreels/contracts';
import { api } from './api.js';
import { Dialog, Empty } from './components.js';
import { useVirtualizer } from '@tanstack/react-virtual';
import { JobBatchActions } from './JobBatchActions.js';
import { calendarRange, localToday, moveCalendar, type CalendarView } from './calendar.js';
import { ScheduleCalendar } from './ScheduleCalendar.js';
import { JobPreflightDialog } from './JobPreflightDialog.js';

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
  apps: AppDefinition[];
  processes: ProcessDefinition[];
  devices: { id: string; name: string; enabled: boolean }[];
  notify: (message: string) => void;
  openProcesses: () => void;
}
export function Schedule(props: Props) {
  const [appId, setAppId] = useState(''),
    [view, setView] = useState<CalendarView>('LIST'),
    [timezone, setTimezone] = useState('Asia/Ho_Chi_Minh'),
    [anchor, setAnchor] = useState(() => localToday('Asia/Ho_Chi_Minh'));
  const [processId, setProcessId] = useState(''),
    [deviceId, setDeviceId] = useState(''),
    [state, setState] = useState('');
  const [from, setFrom] = useState(''),
    [to, setTo] = useState('');
  const [jobs, setJobs] = useState<ScheduledJobSummary[]>([]),
    [hasMore, setHasMore] = useState(false),
    [nextCursor, setNextCursor] = useState<string | null>(null),
    [loadingMore, setLoadingMore] = useState(false),
    [loading, setLoading] = useState(true),
    [error, setError] = useState('');
  const [revision, setRevision] = useState(0),
    [selection, setSelection] = useState<Set<string>>(new Set()),
    [selected, setSelected] = useState<ScheduledJobSummary | null>(null),
    [preflightJobId, setPreflightJobId] = useState<string | null>(null),
    [date, setDate] = useState(''),
    [time, setTime] = useState(''),
    [busy, setBusy] = useState(false);
  const generation = useRef(0),
    mounted = useRef(true),
    scroll = useRef<HTMLDivElement>(null);
  const virtual = useVirtualizer({
    count: jobs.length,
    getScrollElement: () => scroll.current,
    getItemKey: (index) => jobs[index]!.id,
    estimateSize: () => 70,
    overscan: 8,
  });
  const visible = virtual.getVirtualItems();
  let range: ReturnType<typeof calendarRange> | null = null,
    rangeError = '';
  if (view !== 'LIST') {
    try {
      range = calendarRange(anchor, view, timezone);
    } catch (e) {
      rangeError = e instanceof Error ? e.message : 'Ngày hoặc múi giờ không hợp lệ.';
    }
  }
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      generation.current++;
    };
  }, []);
  function query(cursor?: string): JobQuery {
    if (rangeError) throw new Error(rangeError);
    return {
      ...(appId ? { appId } : {}),
      ...(cursor ? { cursor } : {}),
      ...(processId ? { processId } : {}),
      ...(deviceId ? { deviceId } : {}),
      ...(state ? { state: state as JobDefinition['state'] } : {}),
      ...(view !== 'LIST' && range ? { fromUtc: range.fromUtc, toUtc: range.toUtc } : {}),
      ...(view === 'LIST' && from ? { fromUtc: new Date(from + 'T00:00:00Z').toISOString() } : {}),
      ...(view === 'LIST' && to
        ? { toUtc: new Date(new Date(to + 'T00:00:00Z').getTime() + 86400000).toISOString() }
        : {}),
      limit: 500,
    };
  }
  useEffect(() => {
    const token = ++generation.current;
    setLoading(true);
    setError('');
    setNextCursor(null);
    setLoadingMore(false);
    setSelected(null);
    setPreflightJobId(null);
    setSelection(new Set());
    scroll.current?.scrollTo({ top: 0 });
    void Promise.resolve()
      .then(() => api.jobs(query()))
      .then((result) => {
        if (token !== generation.current) return;
        setJobs(result.jobs);
        setHasMore(result.hasMore);
        setNextCursor(result.nextCursor);
      })
      .catch((e) => {
        if (token === generation.current)
          setError(e instanceof Error ? e.message : 'Không tải được lịch.');
      })
      .finally(() => {
        if (token === generation.current) setLoading(false);
      });
  }, [appId, processId, deviceId, state, from, to, revision, view, timezone, anchor]);
  function toggle(id: string, checked: boolean) {
    setSelection((previous) => {
      const next = new Set(previous);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }
  async function more(): Promise<void> {
    if (!nextCursor || loadingMore) return;
    const token = generation.current;
    setLoadingMore(true);
    try {
      const result = await api.jobs(query(nextCursor));
      if (!mounted.current || token !== generation.current) return;
      setJobs((previous) => [...previous, ...result.jobs]);
      setHasMore(result.hasMore);
      setNextCursor(result.nextCursor);
    } catch (error) {
      if (mounted.current && token === generation.current) {
        props.notify(error instanceof Error ? error.message : 'Không tải được trang tiếp.');
        setRevision((value) => value + 1);
      }
    } finally {
      if (mounted.current && token === generation.current) setLoadingMore(false);
    }
  }
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
          Ứng dụng
          <select
            aria-label="Lọc lịch theo ứng dụng"
            value={appId}
            onChange={(e) => {
              setAppId(e.target.value);
              setProcessId('');
            }}
          >
            <option value="">Tất cả</option>
            {props.apps.map((app) => (
              <option key={app.id} value={app.id}>
                {app.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Tiến trình
          <select
            aria-label="Lọc lịch theo tiến trình"
            value={processId}
            onChange={(e) => setProcessId(e.target.value)}
          >
            <option value="">Tất cả</option>
            {props.processes
              .filter((p) => !appId || p.appId === appId)
              .map((p) => (
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
        {view === 'LIST' && (
          <label>
            Từ ngày (UTC)
            <input
              aria-label="Lọc lịch từ ngày UTC"
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </label>
        )}
        {view === 'LIST' && (
          <label>
            Đến ngày (UTC)
            <input
              aria-label="Lọc lịch đến ngày UTC"
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </label>
        )}
      </div>
      <div className="surface calendar-controls">
        <label>
          Chế độ xem
          <select
            aria-label="Chế độ xem lịch"
            value={view}
            onChange={(e) => setView(e.target.value as CalendarView)}
          >
            <option value="LIST">Danh sách</option>
            <option value="DAY">Ngày</option>
            <option value="WEEK">Tuần</option>
            <option value="MONTH">Tháng</option>
          </select>
        </label>
        {view !== 'LIST' && (
          <>
            <button
              aria-label="Khoảng lịch trước"
              disabled={!!rangeError}
              onClick={() => setAnchor(moveCalendar(anchor, view, -1))}
            >
              ←
            </button>
            <label>
              Ngày mốc
              <input
                aria-label="Ngày mốc lịch"
                type="date"
                value={anchor}
                onChange={(e) => setAnchor(e.target.value)}
              />
            </label>
            <button
              aria-label="Khoảng lịch sau"
              disabled={!!rangeError}
              onClick={() => setAnchor(moveCalendar(anchor, view, 1))}
            >
              →
            </button>
            <button
              onClick={() => {
                try {
                  setAnchor(localToday(timezone));
                } catch (e) {
                  props.notify(String(e));
                }
              }}
            >
              Hôm nay
            </button>
            <label>
              Múi giờ hiển thị
              <input
                aria-label="Múi giờ hiển thị lịch"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                spellCheck={false}
              />
            </label>
            <small>Giờ trong thẻ theo múi giờ hiển thị; sửa lịch theo múi giờ công việc.</small>
          </>
        )}
      </div>
      {error ? (
        <Empty title="Không tải được lịch">{error}</Empty>
      ) : loading ? (
        <p role="status">Đang tải lịch…</p>
      ) : (view === 'WEEK' || view === 'MONTH') && range ? (
        <ScheduleCalendar
            cardsPerDay={view === 'MONTH' ? 3 : 6}
          range={range}
          jobs={jobs}
          timezone={timezone}
          hasMore={hasMore}
          selection={selection}
          toggle={toggle}
          open={open}
          labels={stateLabels}
          showDay={(day) => {
            setAnchor(day);
            setView('DAY');
          }}
        />
      ) : !jobs.length ? (
        <Empty icon="▣" title="Chưa có công việc trong phạm vi này">
          Chọn nội dung trong Tiến trình, xem trước giờ và áp dụng để lưu lịch. Cần điện thoại đã
          đăng ký cùng phiên bản workflow.
        </Empty>
      ) : (
        <div className="table-wrap schedule-scroll" ref={scroll}>
          <table>
            <thead>
              <tr>
                <th>
                  <input
                    type="checkbox"
                    aria-label="Chọn lịch chưa bắt đầu đã tải"
                    checked={
                      jobs.some((j) => j.state === 'SCHEDULED') &&
                      jobs.filter((j) => j.state === 'SCHEDULED').every((j) => selection.has(j.id))
                    }
                    onChange={(e) =>
                      setSelection(
                        e.target.checked
                          ? new Set(jobs.filter((j) => j.state === 'SCHEDULED').map((j) => j.id))
                          : new Set(),
                      )
                    }
                  />
                </th>
                <th>
                  {view === 'DAY' ? 'Giờ chạy · ' + timezone : 'Giờ chạy · múi giờ tiến trình'}
                </th>
                <th>Tiến trình</th>
                <th>Điện thoại</th>
                <th>Nội dung</th>
                <th>Trạng thái</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {!!visible.length && visible[0]!.start > 0 && (
                <tr aria-hidden="true">
                  <td colSpan={7} style={{ height: visible[0]!.start, padding: 0, border: 0 }} />
                </tr>
              )}
              {visible.map((row) => {
                const job = jobs[row.index]!;
                return (
                  <tr key={job.id} data-index={row.index} ref={virtual.measureElement}>
                    <td>
                      <input
                        type="checkbox"
                        aria-label={'Chọn lịch ' + job.id}
                        disabled={job.state !== 'SCHEDULED'}
                        checked={selection.has(job.id)}
                        onChange={(e) =>
                          setSelection((previous) => {
                            const next = new Set(previous);
                            if (e.target.checked) next.add(job.id);
                            else next.delete(job.id);
                            return next;
                          })
                        }
                      />
                    </td>
                    <td>
                      <strong>
                        {new Date(job.scheduledUtc).toLocaleString('vi-VN', {
                          timeZone: view === 'DAY' ? timezone : job.timezone,
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
                        aria-label={'Kiểm tra điều kiện ' + job.id}
                        onClick={() => setPreflightJobId(job.id)}
                      >
                        Kiểm tra
                      </button>
                      <button
                        disabled={job.state !== 'SCHEDULED'}
                        aria-label={'Sửa lịch ' + job.id}
                        onClick={() => open(job)}
                      >
                        Sửa lịch
                      </button>
                    </td>
                  </tr>
                );
              })}
              {!!visible.length && virtual.getTotalSize() > visible.at(-1)!.end && (
                <tr aria-hidden="true">
                  <td
                    colSpan={7}
                    style={{
                      height: virtual.getTotalSize() - visible.at(-1)!.end,
                      padding: 0,
                      border: 0,
                    }}
                  />
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      {!loading && !error && (
        <div className="section-heading">
          <div className="actions">
            <JobBatchActions
              jobs={jobs.filter((job) => selection.has(job.id))}
              notify={props.notify}
              committed={() => setRevision((value) => value + 1)}
            />
          </div>
          <p className="muted">
            Đã tải {jobs.length} công việc
            {hasMore ? ' · còn trang tiếp theo' : ' · hết phạm vi lọc'}.
          </p>
          {hasMore && nextCursor && (
            <button disabled={loadingMore} onClick={() => void more()}>
              {loadingMore ? 'Đang tải thêm…' : 'Tải thêm công việc'}
            </button>
          )}
        </div>
      )}
      {preflightJobId && (
        <JobPreflightDialog
          jobId={preflightJobId}
          close={() => setPreflightJobId(null)}
        />
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
