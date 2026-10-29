import { useEffect, useRef, useState } from 'react';
import type {
  JobStageReviewPage, NativeStageReviewResult, NativeStageCleanupReviewResult,
  NativeStageCleanupAbsenceResult,
  MediaOrderBlocker, FrozenUnicodeBlocker, FrozenComposeBlocker,
} from '@autoreels/contracts';
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

const orderBlockerLabels: Record<MediaOrderBlocker, string> = {
  JOB_STATE_NOT_REVIEWABLE: 'Trạng thái job không phù hợp để đối chiếu staging',
  EXTERNAL_EFFECT_PRESENT: 'Đã có external effect; không thể dùng lại chứng cứ này',
  FROZEN_SELECTION_INVALID: 'Thứ tự asset trong snapshot không hợp lệ',
  PINNED_ASSET_INVALID: 'Asset ghim không đầy đủ hoặc đã không còn READY',
  STAGE_MISSING: 'Chưa có stage đúng vị trí asset',
  STAGE_UNEXPECTED_OR_DUPLICATE: 'Stage thừa, trùng hoặc nằm ngoài thứ tự asset',
  STAGE_OWNER_MISMATCH: 'Stage không khớp owner, asset, hash, byte hoặc đường dẫn sở hữu',
  STAGE_GENERATION_MISMATCH: 'Stage không khớp thế hệ JOB claim lịch sử',
  REMOTE_BYTES_NOT_VERIFIED: 'Chưa có bằng chứng readback byte đúng và ACK',
  MEDIASTORE_ROW_NOT_VERIFIED: 'Chưa có hàng MediaStore chính xác theo stage',
  MEDIASTORE_ROW_COLLISION: 'Nhiều asset dùng chung một hàng MediaStore',
  LATEST_OBSERVATION_CONTRADICTS_ROW: 'Quan sát gần nhất không còn xác nhận hàng MediaStore',
};
const unicodeBlockerLabels: Record<FrozenUnicodeBlocker, string> = {
  DECLARATION_INVALID: 'Khai báo field không hợp lệ hoặc bị lặp',
  UNDECLARED_VALUE: 'Snapshot có giá trị chưa khai báo đúng scope',
  REQUIRED_VALUE_MISSING: 'Giá trị bắt buộc bị thiếu hoặc rỗng',
  VALUE_NOT_TEXT: 'Kiểu field không phải chuỗi Unicode',
  UNSAFE_UNICODE: 'Chuỗi có Unicode hỏng hoặc ký tự điều khiển nguy hiểm',
  TEXT_TOO_LARGE: 'Chuỗi vượt giới hạn byte/độ dài an toàn',
  URL_UNSAFE: 'URL sai giao thức hoặc có thông tin xác thực',
};
const composeBlockerLabels: Record<FrozenComposeBlocker, string> = {
  JOB_NOT_PREFLIGHT: 'Job không ở pha PREFLIGHT an toàn để chuẩn bị compose',
  WORKFLOW_BINDING_INVALID: 'Workflow hoặc ứng dụng đóng băng thiếu định danh hợp lệ',
  WORKFLOW_FINGERPRINT_MISMATCH: 'Mã băm workflow không khớp nội dung workflow đã ghim',
  FROZEN_MEDIA_BINDING_INVALID: 'Media đã ghim thiếu, trùng hoặc sai hash/byte/loại tại vị trí',
  SNAPSHOT_FINGERPRINT_MISMATCH: 'Hash snapshot công việc không khớp dữ liệu đóng băng',
  ACCOUNT_NOT_PINNED: 'Chưa ghim tài khoản cho job',
  TARGET_NOT_PINNED: 'Chưa ghim đích đăng cho job',
  CONTENT_BINDING_MISMATCH: 'Nội dung không khớp job đã lên lịch',
  MEDIA_ORDER_NOT_VERIFIED: 'Thứ tự media chưa có bằng chứng lưu trữ nhất quán',
  UNICODE_SOURCE_INVALID: 'Nội dung Unicode chưa có nguồn đóng băng hợp lệ',
  EMPTY_FROZEN_CONTENT: 'Job không có media hoặc text được đóng băng',
  EXTERNAL_EFFECT_PRESENT: 'Có external effect cũ; không tự tiếp tục compose',
};
const effectStateLabels: Record<
  JobStageReviewPage['effectReview']['entries'][number]['state'], string
> = {
  INTENT: 'Đã ghi ý định, chưa rõ đã gửi thao tác hay chưa',
  ATTEMPT_UNCERTAIN: 'Đã ghi cửa sổ thao tác không chắc chắn, cần đối soát',
  CONFIRMED: 'Đã ghi nhận xác nhận trong DB; cần kiểm tra chứng cứ provider riêng',
  DEFINITIVELY_REJECTED: 'Đã ghi nhận từ chối; không tự chạy lại',
  NEEDS_REVIEW: 'Cần người vận hành đối soát',
  UNKNOWN: 'Trạng thái không xác định; phải dừng để kiểm tra',
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
  const [cleanupResult, setCleanupResult] = useState<NativeStageCleanupReviewResult | null>(null);
  const [absenceResult, setAbsenceResult] = useState<{
    ordinal: number;
    result: NativeStageCleanupAbsenceResult;
  } | null>(null);
  const generation = useRef(0);

  useEffect(() => {
    const token = ++generation.current;
    setReport(null);
    setObservations([]);
    setAbsenceResult(null);
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
    setCleanupResult(null);
    setAbsenceResult(null);
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

  async function requestCleanupReview(ordinal: number): Promise<void> {
    if (!nativeStageReview || reviewBusy || loading || loadingMore) return;
    const token = generation.current;
    setReviewError('');
    setLastLive(null);
    setCleanupResult(null);
    setAbsenceResult(null);
    setReviewBusy(true);
    try {
      const result = await nativeStageReview.requestCleanupReview(jobId, ordinal);
      if (token !== generation.current) return;
      if (result.jobId !== jobId || result.ordinal !== ordinal ||
          result.scope !== 'LIVE_ANDROID_REVIEW_REQUEST_ONLY' ||
          result.canDelete !== false || result.canDispatch !== false ||
          !['CANCELLED', 'REVIEW_REQUEST_RECORDED'].includes(result.status) ||
          (result.status === 'CANCELLED' && result.recordedAt !== null) ||
          (result.status === 'REVIEW_REQUEST_RECORDED' && !result.recordedAt))
        throw new Error('Phản hồi ghi yêu cầu đối soát không hợp lệ.');
      setCleanupResult(result);
      setReload((value) => value + 1);
    } catch (cause) {
      if (token === generation.current)
        setReviewError(cause instanceof Error ? cause.message : 'Không ghi được yêu cầu rà soát.');
    } finally {
      if (token === generation.current) setReviewBusy(false);
    }
  }

  async function reviewCleanupAbsence(ordinal: number): Promise<void> {
    if (!nativeStageReview || reviewBusy || loading || loadingMore) return;
    const token = generation.current;
    setReviewError('');
    setLastLive(null);
    setCleanupResult(null);
    setAbsenceResult(null);
    setReviewBusy(true);
    try {
      const result = await nativeStageReview.reviewCleanupAbsence(jobId, ordinal);
      if (token !== generation.current) return;
      const validStatus = [
        'BLOCKED', 'REMOTE_PRESENT_REVIEW', 'MEDIASTORE_PRESENT_REVIEW',
        'UNSUPPORTED_REVIEW', 'ABSENCE_CANDIDATE_UNCERTIFIED',
      ];
      const validBlockers = [
        'OWNED_EXPECTATION_INVALID', 'REMOTE_STAT_INVALID', 'REMOTE_BYTES_MISMATCH',
        'MEDIASTORE_READBACK_INVALID', 'REMOTE_STILL_PRESENT',
        'MEDIASTORE_STILL_INDEXED', 'MEDIASTORE_UNSUPPORTED_OR_AMBIGUOUS',
        'PROVIDER_AND_CLEANUP_UNCERTIFIED',
      ];
      // Reject a malicious/incomplete receipt rather than render any private
      // host path, ADB serial or MediaStore row accidentally attached to it.
      if (result.scope !== 'PRIVATE_OWNED_STAGE_ABSENCE_NOT_DELETE_CERTIFIED' ||
          !validStatus.includes(result.status) ||
          !['PRESENT', 'ABSENT', 'UNKNOWN'].includes(result.remote) ||
          !['INDEXED_EXACT', 'NOT_INDEXED', 'AMBIGUOUS', 'UNSUPPORTED', 'UNKNOWN']
            .includes(result.mediaStore) ||
          result.canDelete !== false || result.canMarkClean !== false ||
          result.canRetry !== false || result.canDispatch !== false ||
          !Array.isArray(result.blockers) ||
          result.blockers.length === 0 || result.blockers.length > 8 ||
          !result.blockers.every((code) => validBlockers.includes(code)) ||
          !result.blockers.includes('PROVIDER_AND_CLEANUP_UNCERTIFIED') ||
          (result.status === 'ABSENCE_CANDIDATE_UNCERTIFIED' &&
            (result.remote !== 'ABSENT' || result.mediaStore !== 'NOT_INDEXED')) ||
          Object.keys(result).sort().join(',') !==
            'blockers,canDelete,canDispatch,canMarkClean,canRetry,mediaStore,remote,scope,status')
        throw new Error('Bằng chứng kiểm tra file staging không hợp lệ hoặc chưa an toàn.');
      setAbsenceResult({ ordinal, result });
    } catch (cause) {
      if (token === generation.current)
        setReviewError(cause instanceof Error ? cause.message : 'Không kiểm tra được file staging.');
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
    <Dialog title="Hồ sơ đối soát staging" close={close}>
      <p>Job: <code>{jobId}</code></p>
      <p className="muted">
        Dữ liệu bên dưới là lịch sử SQLite; việc mở hồ sơ không kiểm tra điện thoại trực tiếp.
        {nativeStageReview
          ? ' Kiểm tra Android chỉ đọc byte từ xa và MediaStore; ghi yêu cầu rà soát cleanup cần thêm xác nhận native và KHÔNG xóa file.'
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
      {reviewBusy && <p role="status">
        Đang xác minh Android và, nếu được yêu cầu, mở hộp thoại xác nhận native…
      </p>}
      {cleanupResult && (
        <p role="status" data-testid="stage-cleanup-review-result">
          Media {cleanupResult.ordinal + 1}:
          {' '}{cleanupResult.status === 'CANCELLED'
            ? 'Đã hủy xác nhận; không ghi yêu cầu cleanup.'
            : 'Đã ghi yêu cầu kiểm tra cleanup vào SQLite.'}
          {' '}Không xóa file Android và không cho phép đăng bài.
        </p>
      )}
      {absenceResult && (
        <p role="status" data-testid="stage-cleanup-absence-result">
          Media {absenceResult.ordinal + 1}: {' '}
          {absenceResult.result.status === 'ABSENCE_CANDIDATE_UNCERTIFIED'
            ? 'Không thấy file ở đường dẫn staging sở hữu và MediaStore không trả hàng trong lần quan sát.'
            : absenceResult.result.status === 'REMOTE_PRESENT_REVIEW'
              ? 'File staging vẫn hiện diện trên Android trong lần quan sát.'
              : absenceResult.result.status === 'MEDIASTORE_PRESENT_REVIEW'
                ? 'MediaStore vẫn trả hàng tương ứng; không thể đánh dấu đã dọn.'
                : absenceResult.result.status === 'UNSUPPORTED_REVIEW'
                  ? 'MediaStore mơ hồ hoặc không hỗ trợ; cần kiểm tra thủ công.'
                  : 'Bằng chứng file hoặc MediaStore không khớp; cần rà soát.'}
          {' '}Không xác nhận đã xóa, không có quyền xóa, không cho phép đăng lại hay dọn dữ liệu PC.
        </p>
      )}
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
                  {nativeStageReview && report.jobState === 'NEEDS_REVIEW' &&
                    ['TRANSFER_UNCERTAIN', 'SYNC_ACK_UNVERIFIED'].includes(stage.state) && (
                      <button
                        aria-label={'Kiểm tra file staging còn hay mất media ' + (stage.ordinal + 1)}
                        disabled={reviewBusy || loading || loadingMore}
                        onClick={() => void reviewCleanupAbsence(stage.ordinal)}
                      >
                        Kiểm tra file staging còn hay mất (chỉ đọc)
                      </button>
                    )}
                  {nativeStageReview && report.jobState === 'NEEDS_REVIEW' &&
                    stage.state === 'SYNC_ACK_UNVERIFIED' &&
                    stage.remoteBytes === 'MATCH_RECORDED_NOT_LIVE' &&
                    stage.mediaStore === 'NOT_RECORDED' &&
                    !report.cleanupRequests.some((r) => r.stageOrdinal === stage.ordinal) && (
                      <button
                        aria-label={'Ghi yêu cầu rà soát cleanup media ' + (stage.ordinal + 1)}
                        disabled={reviewBusy || loading || loadingMore}
                        onClick={() => void requestCleanupReview(stage.ordinal)}
                      >
                        Ghi yêu cầu rà soát cleanup (không xóa)
                      </button>
                    )}
                </li>
              ))}
            </ol>
          )}
          <h3>Thứ tự media đóng băng (chưa xác minh picker)</h3>
          <p className="muted">
            Mỗi vị trí lấy từ snapshot job, không chọn theo tên tệp hoặc thumbnail.
            Bằng chứng hàng MediaStore chỉ là bản ghi lịch sử, không xác nhận file đã được
            chọn trong Android picker. Không có quyền chọn, đăng hoặc điều khiển điện thoại.
          </p>
          <p role="status" data-testid="media-order-status">
            {report.mediaOrder.status === 'NO_MEDIA'
              ? 'Job không ghim media nào; không có quyền thực thi.'
              : report.mediaOrder.status === 'BLOCKED'
                ? 'Đối chiếu media bị chặn; không được tiếp tục chọn media.'
                : 'Các hàng MediaStore khớp dữ liệu đã lưu, nhưng chưa xác minh trong picker.'}
          </p>
          {report.mediaOrder.blockers.length > 0 && (
            <ul aria-label="Điều kiện chặn thứ tự media">
              {report.mediaOrder.blockers.map((code) =>
                <li key={code}>{orderBlockerLabels[code]}</li>)}
            </ul>
          )}
          {report.mediaOrder.slots.length > 0 && (
            <ol aria-label="Thứ tự media đã ghim">
              {report.mediaOrder.slots.map((entry) => (
                <li key={entry.ordinal} data-testid="media-order-slot">
                  <strong>Media {entry.ordinal + 1}</strong> ·
                  {' '}{entry.kind === 'IMAGE' ? 'Ảnh' : entry.kind === 'VIDEO' ? 'Video' : 'Không rõ định dạng'} ·
                  {' '}{entry.evidence === 'INDEXED_ROW_RECORDED_NOT_LIVE'
                    ? 'Đã ghi đúng hàng MediaStore lịch sử (chưa xác minh picker)'
                    : 'Chưa đủ bằng chứng an toàn'}.
                  {entry.blockers.length > 0 && (
                    <span> {entry.blockers.map((code) => orderBlockerLabels[code]).join('; ')}.</span>
                  )}
                </li>
              ))}
            </ol>
          )}
          <h3>Nội dung Unicode đã ghim (chưa nhập Android)</h3>
          <p className="muted">
            Chỉ kiểm tra chuỗi trong snapshot của job. Không hiển thị nội dung,
            caption, URL hoặc hash của người dùng; không tự trim, đổi Unicode,
            xuống dòng hay dùng adb input text. Phương thức nhập trên điện thoại
            cần được kiểm chứng riêng theo ứng dụng và profile.
          </p>
          <p role="status" data-testid="frozen-unicode-status">
            {report.frozenUnicode.status === 'NO_TEXT_FIELDS'
              ? 'Không có trường text/URL đóng băng để nhập.'
              : report.frozenUnicode.status === 'BLOCKED'
                ? 'Kiểm tra dữ liệu Unicode bị chặn; không được nhập.'
                : 'Chuỗi Unicode đóng băng hợp lệ; chưa xác minh phương thức nhập Android.'}
          </p>
          {report.frozenUnicode.blockers.length > 0 && (
            <ul aria-label="Điều kiện chặn nội dung Unicode">
              {report.frozenUnicode.blockers.map((code) =>
                <li key={code}>{unicodeBlockerLabels[code]}</li>)}
            </ul>
          )}
          {report.frozenUnicode.fields.length > 0 && (
            <ol aria-label="Trường Unicode đã ghim">
              {report.frozenUnicode.fields.map((field) => (
                <li key={field.ordinal} data-testid="frozen-unicode-field">
                  <strong>Trường {field.ordinal + 1}</strong> ·
                  {' '}{field.scope === 'ROW' ? 'Dòng nội dung' : 'Tiến trình'} ·
                  {' '}{field.kind === 'URL' ? 'URL' : 'Text'} ·
                  {' '}{field.evidence === 'EXACT_FROZEN_TEXT'
                    ? 'Giữ chính xác chuỗi đã lưu; chưa nhập điện thoại'
                    : 'Bằng chứng dữ liệu không hợp lệ'}.
                </li>
              ))}
            </ol>
          )}
          <h3>Đích đăng và nội dung đã ghim (chưa kiểm chứng Android)</h3>
          <p className="muted">
            Đây chỉ là kế hoạch dữ liệu đóng băng: không kiểm tra tài khoản/đích đang mở,
            picker, trường nhập thực tế hay trạng thái Publish trong ứng dụng Android.
            Không hiển thị định danh tài khoản, đích đăng, caption hoặc mã băm.
          </p>
          <p role="status" data-testid="frozen-compose-status">
            {report.compose.status === 'BLOCKED'
              ? 'Compose bị chặn bởi dữ liệu đã lưu; không được đăng.'
              : 'Kế hoạch compose đã ghim nhất quán; vẫn chưa xác minh Android và không được đăng.'}
          </p>
          <p>
            Ứng dụng: {report.compose.app === 'PINNED_NOT_OBSERVED' ? 'đã ghim, chưa quan sát' : 'thiếu'} ·
            {' '}Tài khoản: {report.compose.account === 'PINNED_NOT_OBSERVED' ? 'đã ghim, chưa quan sát' : 'thiếu'} ·
            {' '}Đích đăng: {report.compose.target === 'PINNED_NOT_OBSERVED' ? 'đã ghim, chưa quan sát' : 'thiếu'} ·
            {' '}Nội dung: {report.compose.content === 'PINNED_NOT_OBSERVED' ? 'đã ghim, chưa quan sát' : 'không khớp'}.
            {' '}{report.compose.mediaSlots} vị trí media; {report.compose.textFields} trường text/URL.
          </p>
          {report.compose.blockers.length > 0 && (
            <ul aria-label="Điều kiện chặn compose đã ghim">
              {report.compose.blockers.map((code) =>
                <li key={code}>{composeBlockerLabels[code]}</li>)}
            </ul>
          )}
          <h3>Nhật ký effect đã lưu (chưa xác minh bài đăng)</h3>
          <p className="muted">
            Chỉ hiển thị trạng thái đã lưu trong SQLite. Không hiển thị ID effect,
            khóa idempotency, mã băm, nội dung hay mã bài đăng. Dữ liệu lịch sử
            không chứng nhận bài đã đăng và không cấp quyền đăng lại hoặc xác nhận.
          </p>
          <p role="status" data-testid="effect-journal-status">
            {report.effectReview.status === 'NO_EFFECTS'
              ? 'Chưa có external effect được ghi.'
              : report.effectReview.status === 'REVIEW_REQUIRED'
                ? 'Có effect chưa được đối soát; không tự đăng lại hoặc gửi bình luận.'
                : 'Có kết quả effect đã ghi nhưng chưa có xác minh provider trực tiếp.'}
          </p>
          <p>
            Tổng số bản ghi: {report.effectReview.total}.
            {' '}{report.effectReview.hasMore ? 'Chỉ hiển thị 20 bản ghi mới nhất.' : 'Hiển thị toàn bộ bản ghi trong giới hạn.'}
            {' '}{report.effectReview.hasUnresolved
              ? 'Cần review cả các effect có thể nằm ngoài trang hiển thị.'
              : 'Không ghi nhận trạng thái chưa giải quyết trong journal hiện tại.'}
          </p>
          {report.effectReview.entries.length > 0 && (
            <ol aria-label="Các external effect đã ghi">
              {report.effectReview.entries.map((entry) => (
                <li key={entry.ordinal} data-testid="effect-journal-entry">
                  <strong>Effect {entry.ordinal + 1}</strong> ·
                  {' '}{entry.kind === 'PUBLISH' ? 'Đăng bài' :
                    entry.kind === 'COMMENT' ? 'Bình luận' : 'Loại không xác định'} ·
                  {' '}{effectStateLabels[entry.state]}.
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
