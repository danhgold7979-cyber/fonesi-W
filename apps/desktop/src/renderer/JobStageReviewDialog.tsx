import { useEffect, useRef, useState } from 'react';
import type { JobStageReviewPage } from '@autoreels/contracts';
import { api } from './api.js';
import { Dialog } from './components.js';

interface Props { jobId: string; close: () => void }
type Observation = JobStageReviewPage['observations'][number];

const stageLabels: Record<JobStageReviewPage['stages'][number]['state'], string> = {
  INTENT: 'Đã lưu ý định chuyển tệp · chưa có ACK',
  TRANSFER_UNCERTAIN: 'Kết quả chuyển tệp chưa chắc chắn',
  SYNC_ACK_UNVERIFIED: 'Có ACK · chưa xác minh picker',
  NEEDS_REVIEW: 'Cần người vận hành đối soát',
};

const observationLabels: Record<Observation['classification'], string> = {
  REMOTE_BYTES_MATCHED: 'Đã quan sát byte từ xa khớp (ở thời điểm ghi)',
  MEDIASTORE_ROW_MATCHED_NOT_PICKER_VERIFIED: 'Đã quan sát hàng MediaStore; chưa xác minh picker',
  REMOTE_MISSING: 'Không tìm thấy tệp từ xa trong lần kiểm tra',
  REMOTE_MISMATCH: 'Byte từ xa khác với dữ liệu đã ghim',
  PROBE_UNSUPPORTED: 'Không hỗ trợ phép kiểm tra',
  REVIEW_REQUIRED: 'Bằng chứng không rõ; cần đối soát',
};

/** Operator-facing persisted history only. No lease, ADB, deletion or dispatch. */
export function JobStageReviewDialog({ jobId, close }: Props) {
  const [report, setReport] = useState<JobStageReviewPage | null>(null);
  const [observations, setObservations] = useState<Observation[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [reload, setReload] = useState(0);
  const generation = useRef(0);

  useEffect(() => {
    const token = ++generation.current;
    setReport(null);
    setObservations([]);
    setError('');
    setLoading(true);
    setLoadingMore(false);
    void api.jobStageReview(jobId)
      .then((result) => {
        if (token !== generation.current) return;
        setReport(result);
        setObservations(result.observations);
      })
      .catch((cause: unknown) => {
        if (token === generation.current)
          setError(cause instanceof Error ? cause.message : 'Không thể đọc hồ sơ đối soát.');
      })
      .finally(() => { if (token === generation.current) setLoading(false); });
    return () => { generation.current++; };
  }, [jobId, reload]);

  async function loadMore(): Promise<void> {
    if (!report?.nextCursor || loadingMore) return;
    const token = generation.current;
    setLoadingMore(true);
    setError('');
    try {
      const next = await api.jobStageReview(jobId, report.nextCursor);
      if (token !== generation.current) return;
      if (next.jobRevision !== report.jobRevision || next.jobState !== report.jobState)
        throw new Error('Công việc đã thay đổi. Làm mới để xem hồ sơ hiện tại.');
      setObservations((old) => [...old, ...next.observations]);
      setReport(next);
    } catch (cause) {
      if (token === generation.current)
        setError(cause instanceof Error ? cause.message : 'Không tải được lịch sử tiếp theo.');
    } finally {
      if (token === generation.current) setLoadingMore(false);
    }
  }

  return (
    <Dialog title="Hồ sơ đối soát staging (chỉ đọc)" close={close}>
      <p>Job: <code>{jobId}</code></p>
      <p className="muted">
        Chỉ hiển thị dữ liệu đã lưu trong SQLite, không kiểm tra điện thoại trực tiếp.
        Không xác nhận tệp đã được chọn trong picker, bài đã đăng hay quyền thực thi.
        Không xóa tệp hoặc tự chạy lại công việc.
      </p>
      <div className="actions">
        <button onClick={() => setReload((value) => value + 1)} disabled={loading || loadingMore}>
          Làm mới hồ sơ
        </button>
      </div>
      {error && <p className="error" role="alert">{error}</p>}
      {loading && <p role="status">Đang đọc hồ sơ đã lưu…</p>}
      {report && (
        <section aria-label="Bằng chứng staging đã lưu">
          <p role="status">
            Trạng thái job: <strong>{report.jobState}</strong> · revision {report.jobRevision} ·
            không có quyền đăng bài.
          </p>
          {!report.stages.length ? (
            <p>Chưa có staging được ghi trong cơ sở dữ liệu cho công việc này.</p>
          ) : (
            <ol aria-label="Danh sách staging">
              {report.stages.map((stage) => (
                <li key={stage.ordinal} data-testid="stage-review-summary">
                  <strong>Media {stage.ordinal + 1}</strong>: {stageLabels[stage.state]}.
                  {' '}Byte từ xa: {stage.remoteBytes === 'MATCH_RECORDED_NOT_LIVE'
                    ? 'Có bản ghi byte khớp (không phải xác minh hiện tại)'
                    : 'Chưa có bản ghi khớp'}.
                  {' '}MediaStore: {stage.mediaStore === 'ROW_RECORDED_NOT_PICKER_VERIFIED'
                    ? 'Có bản ghi hàng MediaStore, chưa xác minh picker'
                    : 'Chưa có bằng chứng hàng MediaStore'}.
                </li>
              ))}
            </ol>
          )}
          <h3>Lịch sử quan sát (mới nhất trước)</h3>
          {!observations.length ? (
            <p>Chưa có lần quan sát đối soát được lưu.</p>
          ) : (
            <ol aria-label="Lịch sử đối soát staging">
              {observations.map((entry, index) => (
                <li key={entry.createdAt + '-' + index} data-testid="stage-review-observation">
                  <strong>Media {entry.stageOrdinal + 1}</strong> ·
                  {' '}{new Date(entry.createdAt).toLocaleString('vi-VN')} ·
                  {' '}{entry.leaseOwnerKind === 'MANUAL' ? 'Quan sát thủ công' : 'JOB lease'}:
                  {' '}{observationLabels[entry.classification]}
                  {' '}(<code>{entry.classification}</code>; MediaStore: {entry.mediaStoreStatus ?? 'không ghi nhận'}).
                </li>
              ))}
            </ol>
          )}
          {report.hasMore && report.nextCursor && (
            <button disabled={loadingMore} onClick={() => void loadMore()}>
              {loadingMore ? 'Đang tải thêm lịch sử…' : 'Tải thêm lịch sử'}
            </button>
          )}
        </section>
      )}
    </Dialog>
  );
}
