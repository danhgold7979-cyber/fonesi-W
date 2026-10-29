import { useEffect, useRef, useState } from 'react';
import type { JobStageReviewPage, NativeStageReviewResult } from '@autoreels/contracts';
import { api, nativeStageReview } from './api.js';
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
  const [reviewBusy, setReviewBusy] = useState(false);
  const [reviewError, setReviewError] = useState('');
  const [lastLive, setLastLive] = useState<NativeStageReviewResult | null>(null);
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

  async function reobserve(ordinal: number): Promise<void> {
    if (!nativeStageReview || reviewBusy || loading || loadingMore) return;
    const token = generation.current;
    setReviewError('');
    setLastLive(null);
    setReviewBusy(true);
    try {
      const result = await nativeStageReview.reobserve(jobId, ordinal);
      if (token !== generation.current) return;
      if (result.jobId !== jobId || result.ordinal !== ordinal ||
          result.canDelete !== false || result.canDispatch !== false ||
          result.scope !== 'LIVE_ANDROID_OBSERVATION_NOT_PICKER_VERIFIED')
        throw new Error('Bằng chứng kiểm tra Android không hợp lệ.');
      setLastLive(result);
      setReload((value) => value + 1);
    } catch (cause) {
      if (token === generation.current)
        setReviewError(cause instanceof Error ? cause.message : 'Không thể đối soát Android.');
    } finally {
      if (token === generation.current) setReviewBusy(false);
    }
  }

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
        Dữ liệu bên dưới là lịch sử SQLite; việc mở hồ sơ không kiểm tra điện thoại trực tiếp.
        {nativeStageReview
          ? ' Nút kiểm tra Android chỉ thực hiện một lần đọc byte từ xa và truy vấn MediaStore.'
          : ' Chỉ ứng dụng Electron mới có thể yêu cầu quan sát Android trực tiếp.'}
        {' '}Không xác nhận tệp đã được chọn trong picker, bài đã đăng hay quyền thực thi.
        Không xóa tệp hoặc tự chạy lại công việc.
      </p>
      <div className="actions">
        <button onClick={() => setReload((value) => value + 1)}
                disabled={loading || loadingMore || reviewBusy}>
          Làm mới hồ sơ
        </button>
      </div>
      {error && <p className="error" role="alert">{error}</p>}
      {reviewError && <p className="error" role="alert">{reviewError}</p>}
      {reviewBusy && <p role="status">Đang kiểm tra lại byte Android và MediaStore (chỉ đọc)…</p>}
      {lastLive && (
        <p role="status" data-testid="stage-live-review-result">
          Media {lastLive.ordinal + 1}: {observationLabels[lastLive.classification]} ·
          MediaStore: {lastLive.mediaStoreStatus ?? 'không ghi nhận'} ·
          {new Date(lastLive.completedAt).toLocaleString('vi-VN')}.
          Chưa xác minh picker, không xóa file, không cho phép đăng bài.
        </p>
      )}
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
                  {nativeStageReview && report.jobState === 'NEEDS_REVIEW' &&
                    ['TRANSFER_UNCERTAIN', 'SYNC_ACK_UNVERIFIED'].includes(stage.state) && (
                      <button
                        aria-label={'Kiểm tra lại Android media ' + (stage.ordinal + 1)}
                        disabled={reviewBusy || loading || loadingMore}
                        onClick={() => void reobserve(stage.ordinal)}
                      >
                        Kiểm tra lại Android (chỉ đọc)
                      </button>
                    )}
                </li>
              ))}
            </ol>
          )}
          <h3>Yêu cầu rà soát cleanup đã lưu</h3>
          <p className="muted">
            Đây chỉ là lịch sử người vận hành yêu cầu kiểm tra; không có file nào
            được xóa và không cho phép chuyển công việc sang trạng thái có thể đăng.
            Tất cả thông tin đều là bản ghi cũ, không phải kết quả kiểm tra điện thoại hiện tại.
          </p>
          {!report.cleanupRequests.length ? (
            <p>Chưa ghi nhận yêu cầu rà soát cleanup cho công việc này.</p>
          ) : (
            <ol aria-label="Yêu cầu rà soát cleanup đã lưu">
              {report.cleanupRequests.map((entry, index) => (
                <li key={entry.recordedAt + '-' + entry.stageOrdinal + '-' + index}
                    data-testid="stage-cleanup-review-request">
                  <strong>Media {entry.stageOrdinal + 1}</strong> ·
                  {' '}{new Date(entry.recordedAt).toLocaleString('vi-VN')} ·
                  {' '}Đã ghi yêu cầu rà soát, đang chờ kiểm tra phần cứng.
                </li>
              ))}
            </ol>
          )}
          {report.cleanupHasMore && (
            <p role="status">
              Chỉ hiển thị 20 yêu cầu rà soát cleanup gần nhất; còn lịch sử cũ hơn.
            </p>
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
