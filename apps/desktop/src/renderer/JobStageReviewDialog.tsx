import { useEffect, useRef, useState } from 'react';
import type {
  JobStageReviewPage, NativeStageReviewResult, NativeStageCleanupReviewResult,
  NativeStageCleanupAbsenceResult, NativeStageCleanupRecheckResult,
  NativeEffectManualReviewResult,
  MediaOrderBlocker, FrozenUnicodeBlocker, FrozenComposeBlocker,
} from '@autoreels/contracts';
import { api, nativeStageReview, nativeEffectReview } from './api.js';
import { Dialog } from './components.js';

interface Props { jobId: string; close: () => void }
type Observation = JobStageReviewPage['observations'][number];
type EffectReviewReason = NativeEffectManualReviewResult['reasonCode'];
type EffectReviewDisposition = NativeEffectManualReviewResult['disposition'];
interface EffectReviewDraft {
  actorId: string;
  reasonCode: EffectReviewReason;
  disposition: EffectReviewDisposition;
  evidenceRefsText: string;
}
const defaultEffectReviewDraft: EffectReviewDraft = {
  actorId: '',
  reasonCode: 'PROVIDER_EVIDENCE_MISSING',
  disposition: 'AWAITING_EVIDENCE',
  evidenceRefsText: '',
};
const effectReviewReasonLabels: Record<EffectReviewReason, string> = {
  UNKNOWN_EFFECT: 'Không rõ effect đã xảy ra hay chưa',
  CANCEL_REQUESTED: 'Đã yêu cầu hủy, cần rà soát effect',
  PROVIDER_EVIDENCE_MISSING: 'Thiếu chứng cứ từ provider',
  COMMENT_UNCERTAIN: 'Kết quả bình luận chưa chắc chắn',
};
const effectReviewDispositionLabels: Record<EffectReviewDisposition, string> = {
  AWAITING_EVIDENCE: 'Chờ chứng cứ',
  ESCALATED: 'Chuyển cấp xử lý',
  INSPECTED_UNCERTIFIED: 'Đã xem nhưng chưa chứng nhận',
};

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
const cleanupRecheckStatusLabels: Record<
  NativeStageCleanupAbsenceResult['status'], string
> = {
  BLOCKED: 'Bằng chứng không khớp, chưa được phép dọn',
  REMOTE_PRESENT_REVIEW: 'File staging vẫn hiện diện trong lần quan sát',
  MEDIASTORE_PRESENT_REVIEW: 'MediaStore vẫn có hàng tương ứng',
  UNSUPPORTED_REVIEW: 'MediaStore không hỗ trợ hoặc mơ hồ',
  ABSENCE_CANDIDATE_UNCERTIFIED: 'Không thấy file và hàng MediaStore; chưa chứng nhận đã xóa',
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
  const [recheckResult, setRecheckResult] = useState<NativeStageCleanupRecheckResult | null>(null);
  const [effectReviewDrafts, setEffectReviewDrafts] =
    useState<Record<number, EffectReviewDraft>>({});
  const [manualEffectReceipt, setManualEffectReceipt] =
    useState<NativeEffectManualReviewResult | null>(null);
  const generation = useRef(0);

  useEffect(() => {
    const token = ++generation.current;
    setReport(null);
    setObservations([]);
    setAbsenceResult(null);
    setRecheckResult(null);
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

  useEffect(() => {
    setEffectReviewDrafts({});
    setManualEffectReceipt(null);
  }, [jobId]);

  async function reobserve(ordinal: number): Promise<void> {
    if (!nativeStageReview || reviewBusy || loading || loadingMore) return;
    const token = generation.current;
    setReviewError('');
    setLastLive(null);
    setCleanupResult(null);
    setAbsenceResult(null);
    setRecheckResult(null);
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
    setRecheckResult(null);
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
    setRecheckResult(null);
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

  async function recordCleanupRecheck(ordinal: number): Promise<void> {
    if (!nativeStageReview || reviewBusy || loading || loadingMore) return;
    const token = generation.current;
    setReviewError('');
    setAbsenceResult(null);
    setLastLive(null);
    setCleanupResult(null);
    setRecheckResult(null);
    setReviewBusy(true);
    try {
      const result = await nativeStageReview.recordCleanupRecheck(jobId, ordinal);
      if (token !== generation.current) return;
      const statuses = [
        'BLOCKED', 'REMOTE_PRESENT_REVIEW', 'MEDIASTORE_PRESENT_REVIEW',
        'UNSUPPORTED_REVIEW', 'ABSENCE_CANDIDATE_UNCERTIFIED',
      ];
      if (result.scope !== 'LIVE_ANDROID_CLEANUP_RECHECK_NOT_DELETE_CERTIFIED' ||
          result.jobId !== jobId || result.ordinal !== ordinal ||
          !statuses.includes(result.status) ||
          !Number.isSafeInteger(result.attemptOrdinal) ||
          result.attemptOrdinal < 1 || result.attemptOrdinal > 3 ||
          !Number.isFinite(Date.parse(result.recordedAt)) ||
          result.canDelete !== false || result.canMarkClean !== false ||
          result.canRetry !== false || result.canDispatch !== false ||
          Object.keys(result).sort().join(',') !==
            'attemptOrdinal,canDelete,canDispatch,canMarkClean,canRetry,jobId,ordinal,recordedAt,scope,status')
        throw new Error('Biên nhận đối soát cleanup chứa quyền nguy hiểm hoặc dữ liệu không hợp lệ.');
      setRecheckResult(result);
    } catch (cause) {
      if (token === generation.current)
        setReviewError(cause instanceof Error ? cause.message : 'Không thể ghi lần đối soát cleanup.');
    } finally {
      if (token === generation.current) setReviewBusy(false);
    }
  }

  function updateEffectReviewDraft(
    ordinal: number, patch: Partial<EffectReviewDraft>,
  ): void {
    setEffectReviewDrafts((current) => ({
      ...current,
      [ordinal]: { ...(current[ordinal] ?? defaultEffectReviewDraft), ...patch },
    }));
  }

  async function recordManualEffectReview(
    ordinal: number,
    kind: 'PUBLISH' | 'COMMENT',
    state: 'INTENT' | 'ATTEMPT_UNCERTAIN' | 'NEEDS_REVIEW',
  ): Promise<void> {
    if (!nativeEffectReview || reviewBusy || loading || loadingMore ||
        report?.jobState !== 'NEEDS_REVIEW') return;
    const token = generation.current;
    const draft = effectReviewDrafts[ordinal] ?? defaultEffectReviewDraft;
    const actorId = draft.actorId.trim();
    const evidenceRefs = draft.evidenceRefsText.split(',')
      .map((item) => item.trim()).filter(Boolean);
    const missingEvidenceOnly =
      draft.reasonCode === 'PROVIDER_EVIDENCE_MISSING' &&
      draft.disposition === 'AWAITING_EVIDENCE';
    if (!/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,199}$/.test(actorId) ||
        evidenceRefs.length > 8 ||
        evidenceRefs.some((item) => !/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,199}$/.test(item)) ||
        new Set(evidenceRefs).size !== evidenceRefs.length ||
        (!missingEvidenceOnly && evidenceRefs.length === 0)) {
      setReviewError(missingEvidenceOnly
        ? 'Nhập actor ID tự khai báo hợp lệ; nếu có chứng cứ, nhập 1–8 ID duy nhất.'
        : 'Cần actor ID tự khai báo và 1–8 ID chứng cứ hợp lệ cho lựa chọn này.');
      return;
    }
    setReviewError('');
    setManualEffectReceipt(null);
    setLastLive(null);
    setCleanupResult(null);
    setAbsenceResult(null);
    setRecheckResult(null);
    setReviewBusy(true);
    try {
      const result = await nativeEffectReview.recordManualReview({
        jobId, ordinal, actorId,
        reasonCode: draft.reasonCode,
        disposition: draft.disposition,
        evidenceRefs,
      });
      if (token !== generation.current) return;
      if (result.scope !== 'PRIVATE_EFFECT_MANUAL_REVIEW_NOTE_NOT_CERTIFIED' ||
          result.jobId !== jobId || result.ordinal !== ordinal ||
          result.kind !== kind || result.state !== state ||
          result.reasonCode !== draft.reasonCode ||
          result.disposition !== draft.disposition ||
          result.evidenceCount !== evidenceRefs.length ||
          !Number.isFinite(Date.parse(result.createdAt)) ||
          result.canConfirm !== false || result.canRetry !== false ||
          result.canDispatch !== false ||
          Object.keys(result).sort().join(',') !==
            'alreadyRecorded,canConfirm,canDispatch,canRetry,createdAt,disposition,evidenceCount,jobId,kind,ordinal,reasonCode,scope,state')
        throw new Error('Biên nhận rà soát effect không hợp lệ hoặc có quyền thực thi.');
      setManualEffectReceipt(result);
      setReload((value) => value + 1);
    } catch (cause) {
      if (token === generation.current) {
        setManualEffectReceipt(null);
        setReviewError(cause instanceof Error ? cause.message : 'Không thể ghi chú rà soát effect.');
      }
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
      {manualEffectReceipt && (
        <p role="status" data-testid="effect-manual-review-result">
          Effect {manualEffectReceipt.ordinal + 1}: đã ghi chú
          {' '}{effectReviewReasonLabels[manualEffectReceipt.reasonCode]} ·
          {' '}{effectReviewDispositionLabels[manualEffectReceipt.disposition]}.
          {' '}Actor là tự khai báo, chưa xác thực. Không xác nhận provider,
          không đổi trạng thái effect/job và không cho phép retry hay dispatch.
        </p>
      )}
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
      {recheckResult && (
        <p role="status" data-testid="stage-cleanup-recheck-result">
          Media {recheckResult.ordinal + 1}:
          {' '}Đã ghi lần đối soát cleanup số {recheckResult.attemptOrdinal}/3.
          {' '}{recheckResult.status === 'ABSENCE_CANDIDATE_UNCERTIFIED'
            ? 'Không tìm thấy file và MediaStore không có hàng trong lần kiểm tra; vẫn chưa xác nhận đã xóa.'
            : 'Kết quả còn yêu cầu rà soát; chưa xác nhận đã dọn file.'}
          {' '}Chỉ ghi nhật ký kiểm tra, không xóa file, không đăng lại bài và không tự retry.
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
                  {' '}Đã ghi {Math.max(
                    report.cleanupRechecks.filter((r) => r.stageOrdinal === stage.ordinal).length,
                    recheckResult?.ordinal === stage.ordinal
                      ? recheckResult.attemptOrdinal : 0,
                  )}/3 lượt đối soát cleanup (không xóa).
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
                    ['TRANSFER_UNCERTAIN', 'SYNC_ACK_UNVERIFIED'].includes(stage.state) && (
                      <button
                        aria-label={'Ghi lần đối soát cleanup media ' + (stage.ordinal + 1)}
                        disabled={reviewBusy || loading || loadingMore ||
                          report.cleanupRechecks.filter((r) =>
                            r.stageOrdinal === stage.ordinal).length >= 3 ||
                          (recheckResult?.ordinal === stage.ordinal &&
                            recheckResult.attemptOrdinal >= 3)}
                        onClick={() => void recordCleanupRecheck(stage.ordinal)}
                      >
                        Ghi lần đối soát cleanup (tối đa 3, không xóa)
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
          <h3>Nhật ký đối soát cleanup (chỉ đọc, không xóa)</h3>
          <p className="muted">
            Các lượt kiểm tra file staging đã lưu trong SQLite, tối đa 3 lượt cho mỗi media.
            Đây là quan sát cũ, không xác nhận đã xóa Android, không thay kết quả đăng bài,
            không cho phép chạy lại job hoặc xóa file nguồn trên PC.
          </p>
          {report.cleanupRechecks.length === 0 ? (
            <p>Chưa có lượt đối soát cleanup được lưu.</p>
          ) : (
            <ol aria-label="Lịch sử đối soát cleanup đã lưu">
              {report.cleanupRechecks.map((entry) => (
                <li key={entry.stageOrdinal + '-' + entry.attemptOrdinal}
                    data-testid="stage-cleanup-recheck-history">
                  Media {entry.stageOrdinal + 1} · lần {entry.attemptOrdinal}/3 ·
                  {' '}{cleanupRecheckStatusLabels[entry.status]} ·
                  {' '}{new Date(entry.recordedAt).toLocaleString('vi-VN')}.
                  {' '}Không có quyền xóa hoặc retry.
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
              {report.effectReview.entries.map((entry) => {
                const draft = effectReviewDrafts[entry.ordinal] ?? defaultEffectReviewDraft;
                const unresolved = ['INTENT', 'ATTEMPT_UNCERTAIN', 'NEEDS_REVIEW'].includes(entry.state);
                const evidenceRefs = draft.evidenceRefsText.split(',').map((item) => item.trim()).filter(Boolean);
                const missingEvidenceOnly =
                  draft.reasonCode === 'PROVIDER_EVIDENCE_MISSING' &&
                  draft.disposition === 'AWAITING_EVIDENCE';
                const canSubmit =
                  /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,199}$/.test(draft.actorId.trim()) &&
                  evidenceRefs.length <= 8 &&
                  evidenceRefs.every((item) => /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,199}$/.test(item)) &&
                  new Set(evidenceRefs).size === evidenceRefs.length &&
                  (missingEvidenceOnly || evidenceRefs.length > 0);
                return (
                  <li key={entry.ordinal} data-testid="effect-journal-entry">
                    <strong>Effect {entry.ordinal + 1}</strong> ·
                    {' '}{entry.kind === 'PUBLISH' ? 'Đăng bài' :
                      entry.kind === 'COMMENT' ? 'Bình luận' : 'Loại không xác định'} ·
                    {' '}{effectStateLabels[entry.state]}.
                    <p>Ghi chú rà soát đã lưu: {entry.manualReviewCount}.</p>
                    {entry.latestManualReview && (
                      <p data-testid="effect-manual-review-history">
                        Actor tự khai báo (chưa xác thực): <code>{entry.latestManualReview.actorId}</code> ·
                        {' '}{effectReviewReasonLabels[entry.latestManualReview.reasonCode]} ·
                        {' '}{effectReviewDispositionLabels[entry.latestManualReview.disposition]} ·
                        {' '}{entry.latestManualReview.evidenceCount} ID chứng cứ ·
                        {' '}{new Date(entry.latestManualReview.createdAt).toLocaleString('vi-VN')}.
                      </p>
                    )}
                    {nativeEffectReview && report.jobState === 'NEEDS_REVIEW' &&
                      unresolved && entry.kind !== 'UNKNOWN' && entry.manualReviewCount < 32 && (
                        <div className="effect-manual-review-form" data-testid="effect-manual-review-form">
                          <p className="muted">
                            Ghi chú này không xác thực bài đăng, không thay đổi trạng thái effect,
                            không cấp quyền retry/dispatch và không xóa uncertainty.
                            Actor ID và ID tham chiếu chứng cứ do người vận hành tự khai báo;
                            danh tính và nội dung chứng cứ không được xác thực bởi ghi chú này.
                          </p>
                          <label>
                            Actor ID tự khai báo
                            <input
                              aria-label={'Actor ID tự khai báo cho effect ' + (entry.ordinal + 1)}
                              value={draft.actorId}
                              onChange={(event) => updateEffectReviewDraft(entry.ordinal, {
                                actorId: event.currentTarget.value,
                              })}
                            />
                          </label>
                          <label>
                            Lý do rà soát
                            <select
                              aria-label={'Lý do rà soát effect ' + (entry.ordinal + 1)}
                              value={draft.reasonCode}
                              onChange={(event) => updateEffectReviewDraft(entry.ordinal, {
                                reasonCode: event.currentTarget.value as EffectReviewReason,
                                ...(event.currentTarget.value === 'PROVIDER_EVIDENCE_MISSING'
                                  ? { disposition: 'AWAITING_EVIDENCE' as const } : {}),
                              })}
                            >
                              {Object.entries(effectReviewReasonLabels).map(([value, label]) => (
                                <option key={value} value={value}>{label}</option>
                              ))}
                            </select>
                          </label>
                          <label>
                            Kết luận ghi chú (không phải kết quả provider)
                            <select
                              aria-label={'Kết luận ghi chú effect ' + (entry.ordinal + 1)}
                              value={draft.disposition}
                              onChange={(event) => updateEffectReviewDraft(entry.ordinal, {
                                disposition: event.currentTarget.value as EffectReviewDisposition,
                              })}
                            >
                              {Object.entries(effectReviewDispositionLabels).map(([value, label]) => (
                                <option key={value} value={value}>{label}</option>
                              ))}
                            </select>
                          </label>
                          <label>
                            ID tham chiếu chứng cứ tự khai báo (tối đa 8, phân tách bằng dấu phẩy)
                            <input
                              aria-label={'ID chứng cứ effect ' + (entry.ordinal + 1)}
                              value={draft.evidenceRefsText}
                              placeholder={missingEvidenceOnly ? 'Để trống nếu chưa có chứng cứ' : 'Nhập ID chứng cứ đã tồn tại'}
                              onChange={(event) => updateEffectReviewDraft(entry.ordinal, {
                                evidenceRefsText: event.currentTarget.value,
                              })}
                            />
                          </label>
                          <button
                            aria-label={'Ghi chú rà soát effect ' + (entry.ordinal + 1)}
                            disabled={reviewBusy || loading || loadingMore || !canSubmit}
                            onClick={() => void recordManualEffectReview(
                              entry.ordinal, entry.kind as 'PUBLISH' | 'COMMENT',
                              entry.state as 'INTENT' | 'ATTEMPT_UNCERTAIN' | 'NEEDS_REVIEW',
                            )}
                          >
                            Ghi chú rà soát (không xác nhận, không retry)
                          </button>
                        </div>
                      )}
                  </li>
                );
              })}
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
