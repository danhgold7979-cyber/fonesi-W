import { useEffect, useRef, useState } from 'react';
import type { JobChangePreview, JobChangeRequest, ScheduledJobSummary } from '@autoreels/contracts';
import { api } from './api.js';
import { Dialog } from './components.js';

export function JobBatchActions(props: {
  jobs: ScheduledJobSummary[];
  committed: () => void;
  notify: (message: string) => void;
}) {
  const [operation, setOperation] = useState<JobChangeRequest['operation'] | null>(null),
    [minimum, setMinimum] = useState(60),
    [maximum, setMaximum] = useState(120),
    [preview, setPreview] = useState<JobChangePreview | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const live = useRef(props),
    generation = useRef(0);
  live.current = props;
  const signature = props.jobs.map((job) => job.id + ':' + job.revision).join(',');
  useEffect(() => {
    generation.current++;
    setOperation(null);
    setPreview(null);
    setError('');
    setBusy(false);
    return () => {
      generation.current++;
    };
  }, [signature]);
  function begin(next: JobChangeRequest['operation']) {
    setOperation(next);
    setPreview(null);
    setError('');
  }
  async function prepare() {
    if (!operation) return;
    const at = generation.current;
    setBusy(true);
    setError('');
    try {
      const jobs = props.jobs.map((job) => ({ id: job.id, revision: job.revision }));
      const result = await api.previewJobChanges(
        operation === 'SPREAD'
          ? { operation, jobs, minGapMinutes: minimum, maxGapMinutes: maximum }
          : { operation, jobs },
      );
      if (generation.current === at) setPreview(result);
    } catch (e) {
      if (generation.current === at)
        setError(e instanceof Error ? e.message : 'Không xem trước được lịch.');
    } finally {
      if (generation.current === at) setBusy(false);
    }
  }
  async function apply() {
    if (!preview) return;
    const at = generation.current;
    setBusy(true);
    setError('');
    try {
      const result = await api.applyJobChanges(preview.token);
      if (generation.current !== at) return;
      setOperation(null);
      setPreview(null);
      live.current.notify(
        result.alreadyApplied
          ? 'Thay đổi đã được lưu trước đó; không áp dụng lần nữa.'
          : 'Đã cập nhật đúng nhóm lịch đã chọn.',
      );
      live.current.committed();
    } catch (e) {
      if (generation.current === at)
        setError(e instanceof Error ? e.message : 'Chưa nhận được kết quả; thử lại cùng xác nhận.');
    } finally {
      if (generation.current === at) setBusy(false);
    }
  }
  const format = (utc: string, timezone: string) =>
    new Date(utc).toLocaleString('vi-VN', { timeZone: timezone });
  return (
    <>
      <span>Đã chọn {props.jobs.length} công việc</span>
      <button
        disabled={!props.jobs.length || props.jobs.length > 1000 || busy}
        onClick={() => begin('SPREAD')}
      >
        Giãn lịch đã chọn
      </button>
      <button
        disabled={!props.jobs.length || props.jobs.length > 1000 || busy}
        onClick={() => begin('CANCEL')}
      >
        Hủy lịch đã chọn
      </button>
      {props.jobs.length > 1000 && (
        <p role="alert">Chia lựa chọn thành tối đa 1000 công việc mỗi lần.</p>
      )}
      {operation && (
        <Dialog
          wide
          title={operation === 'SPREAD' ? 'Giãn lịch đã chọn' : 'Hủy lịch đã chọn'}
          close={() => {
            if (!busy) setOperation(null);
          }}
        >
          {error && <p role="alert">{error}</p>}
          {!preview ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void prepare();
              }}
            >
              <p>
                Chỉ áp dụng cho {props.jobs.length} công việc đã chọn, giữ nguyên nội dung và phiên
                bản workflow.
              </p>
              {operation === 'SPREAD' && (
                <div className="form-grid">
                  <label className="field">
                    Khoảng giãn tối thiểu (phút)
                    <input
                      aria-label="Khoảng giãn tối thiểu"
                      type="number"
                      min={60}
                      max={120}
                      required
                      value={minimum}
                      disabled={busy}
                      onChange={(e) => setMinimum(e.target.valueAsNumber)}
                    />
                  </label>
                  <label className="field">
                    Khoảng giãn tối đa (phút)
                    <input
                      aria-label="Khoảng giãn tối đa"
                      type="number"
                      min={minimum}
                      max={120}
                      required
                      value={maximum}
                      disabled={busy}
                      onChange={(e) => setMaximum(e.target.valueAsNumber)}
                    />
                  </label>
                </div>
              )}
              <div className="dialog-actions">
                <button disabled={busy}>Xem trước thay đổi lịch</button>
              </div>
            </form>
          ) : (
            <>
              {preview.warnings.map((warning) => (
                <p key={warning}>{warning}</p>
              ))}
              {!!preview.blockers.length && (
                <div role="alert">
                  <strong>Chưa thể áp dụng</strong>
                  <ul>
                    {preview.blockers.map((blocker, i) => (
                      <li key={i}>
                        {blocker.jobId}: {blocker.message}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="table-wrap" style={{ maxHeight: 320, overflow: 'auto' }}>
                <table aria-label="Đề xuất thay đổi lịch">
                  <thead>
                    <tr>
                      <th>Công việc / điện thoại</th>
                      <th>Giờ cũ</th>
                      <th>{operation === 'SPREAD' ? 'Giờ đề xuất' : 'Kết quả'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.slots.map((slot) => (
                      <tr key={slot.jobId}>
                        <td>
                          {slot.jobId}
                          <small className="timeline-timezone">
                            {slot.deviceId} · {slot.timezone}
                          </small>
                        </td>
                        <td>{format(slot.previousUtc, slot.timezone)}</td>
                        <td>
                          {operation === 'SPREAD'
                            ? format(slot.proposedUtc, slot.timezone)
                            : 'Đã hủy'}
                          {slot.crossesLocalDay && <strong> · Sang ngày khác</strong>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="dialog-actions">
                <button
                  disabled={busy}
                  onClick={() => {
                    setPreview(null);
                    setError('');
                  }}
                >
                  Xem trước lại
                </button>
                <button disabled={busy || !preview.canApply} onClick={() => void apply()}>
                  Áp dụng thay đổi lịch
                </button>
              </div>
            </>
          )}
        </Dialog>
      )}
    </>
  );
}
