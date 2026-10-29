import { useEffect, useRef, useState } from 'react';
import type {
  ContentAssetInfo,
  MediaAdoptionPreview,
  MediaAdoptionResult,
  ProcessDefinition,
} from '@autoreels/contracts';
import { api } from './api.js';
import { Dialog } from './components.js';

export function MediaAdoption(props: {
  processId: string;
  assets: ContentAssetInfo[];
  save: () => Promise<ProcessDefinition | null>;
  committed: (result: MediaAdoptionResult) => Promise<void>;
}) {
  const [preview, setPreview] = useState<MediaAdoptionPreview | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const generation = useRef(0),
    live = useRef(props);
  live.current = props;
  useEffect(() => {
    const at = ++generation.current;
    setPreview(null);
    setError('');
    setBusy(false);
    return () => {
      if (generation.current === at) generation.current++;
    };
  }, [props.processId]);
  async function prepare(assetId: string) {
    const at = generation.current;
    setBusy(true);
    setError('');
    try {
      const saved = await props.save();
      if (!saved || saved.id !== props.processId || generation.current !== at) return;
      const result = await api.previewMediaAdoption(saved.id, assetId);
      if (generation.current === at) setPreview(result);
    } catch (e) {
      if (generation.current === at)
        setError(e instanceof Error ? e.message : 'Không đọc được media.');
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
      const result = await api.applyMediaAdoption(preview.token);
      // A committed result must reach the owning Process before refreshing its content.
      if (generation.current !== at) return;
      await live.current.committed(result);
      if (generation.current === at) setPreview(null);
    } catch (e) {
      if (generation.current === at)
        setError(
          e instanceof Error ? e.message : 'Chưa nhận được kết quả; có thể thử lại cùng xác nhận.',
        );
    } finally {
      if (generation.current === at) setBusy(false);
    }
  }
  const changed = [
    ...new Map(
      props.assets.filter((asset) => asset.state === 'CHANGED').map((asset) => [asset.id, asset]),
    ).values(),
  ];
  return (
    <>
      {!!changed.length && (
        <details open className="media-changes">
          <summary>{changed.length} media đã đổi — cần xác nhận phiên bản mới</summary>
          {changed.map((asset) => (
            <div className="source-row" key={asset.id}>
              <span className="source-path">{asset.relativePath}</span>
              <button
                disabled={busy}
                onClick={() => void prepare(asset.id)}
                aria-label={'Xem thay đổi ' + asset.relativePath}
              >
                Xem thay đổi
              </button>
            </div>
          ))}
        </details>
      )}
      {error && !preview && <p role="alert">{error}</p>}
      {preview && (
        <Dialog
          title="Tiếp nhận phiên bản media mới"
          close={() => {
            if (!busy) {
              setPreview(null);
              setError('');
            }
          }}
        >
          {error && <p role="alert">{error}</p>}
          <p>
            <strong>{preview.relativePath}</strong> · {preview.bytes.toLocaleString('vi')} byte ·{' '}
            {preview.contentCount} nội dung
          </p>
          <p>
            Hash cũ: <code>{preview.previousHash.slice(0, 16)}</code>
            <br />
            Hash mới: <code>{preview.nextHash.slice(0, 16)}</code>
          </p>
          {preview.warnings.map((warning) => (
            <p key={warning}>{warning}</p>
          ))}
          <div className="dialog-actions">
            <button
              disabled={busy}
              onClick={() => {
                setPreview(null);
                setError('');
              }}
            >
              Hủy
            </button>
            <button disabled={busy} onClick={() => void apply()}>
              Tiếp nhận phiên bản mới
            </button>
          </div>
        </Dialog>
      )}
    </>
  );
}
