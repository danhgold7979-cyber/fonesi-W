import { useEffect, useRef, useState } from 'react';
import type {
  ProcessCloneOptions,
  ProcessClonePreview,
  ProcessDefinition,
} from '@autoreels/contracts';
import { api } from './api.js';
import { Dialog } from './components.js';

export function ProcessClone(props: {
  current: ProcessDefinition | null;
  isNew: boolean;
  save: () => Promise<ProcessDefinition | null>;
  refresh: () => Promise<void>;
  created: (process: ProcessDefinition, sourceId: string) => void;
  notify: (message: string) => void;
}) {
  const [source, setSource] = useState<ProcessDefinition | null>(null),
    [busy, setBusy] = useState(false);
  const [options, setOptions] = useState<ProcessCloneOptions>({
    name: '',
    includeContent: true,
    includeSources: true,
    keepDevice: false,
  });
  const [preview, setPreview] = useState<ProcessClonePreview | null>(null),
    [error, setError] = useState('');
  const live = useRef(props);
  live.current = props;
  const mounted = useRef(true),
    generation = useRef(0);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      generation.current++;
    };
  }, []);
  useEffect(() => {
    generation.current++;
    setSource(null);
    setPreview(null);
    setError('');
    setBusy(false);
  }, [props.current?.id]);
  async function begin() {
    const at = generation.current;
    setBusy(true);
    setError('');
    try {
      const saved = await props.save();
      if (
        !mounted.current ||
        generation.current !== at ||
        !saved ||
        live.current.current?.id !== saved.id
      )
        return;
      setSource(saved);
      setPreview(null);
      setOptions({
        name: (saved.name + ' — bản sao').slice(0, 160),
        includeContent: true,
        includeSources: true,
        keepDevice: false,
      });
    } catch (error) {
      if (mounted.current && generation.current === at)
        props.notify(error instanceof Error ? error.message : 'Không thể nhân bản.');
    } finally {
      if (mounted.current && generation.current === at) setBusy(false);
    }
  }
  async function prepare() {
    if (!source) return;
    const at = generation.current;
    setBusy(true);
    setError('');
    try {
      const result = await api.previewProcessClone(source.id, source.revision, options);
      if (mounted.current && generation.current === at) setPreview(result);
    } catch (error) {
      if (mounted.current && generation.current === at)
        setError(error instanceof Error ? error.message : 'Không tạo được xem trước.');
    } finally {
      if (mounted.current && generation.current === at) setBusy(false);
    }
  }
  async function apply() {
    if (!preview) return;
    const at = generation.current,
      selected = preview;
    setBusy(true);
    setError('');
    try {
      const result = await api.applyProcessClone(selected.token);
      await props.refresh();
      if (!mounted.current || generation.current !== at) return;
      setSource(null);
      setPreview(null);
      props.created(result.process, selected.sourceProcessId);
      props.notify(
        result.alreadyApplied
          ? 'Bản sao đã tồn tại; không tạo thêm bản trùng.'
          : 'Đã nhân bản tiến trình và dữ liệu đã chọn.',
      );
    } catch (error) {
      if (mounted.current && generation.current === at)
        setError(error instanceof Error ? error.message : 'Chưa nhận được kết quả nhân bản.');
    } finally {
      if (mounted.current && generation.current === at) setBusy(false);
    }
  }
  return (
    <>
      <button disabled={busy || props.isNew || !props.current} onClick={() => void begin()}>
        Nhân bản tiến trình
      </button>
      {source && (
        <Dialog
          title="Nhân bản tiến trình"
          close={() => {
            if (!busy) {
              setSource(null);
              setPreview(null);
            }
          }}
        >
          {error && <p role="alert">{error}</p>}
          {!preview ? (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void prepare();
              }}
            >
              <label className="field">
                Tên bản sao
                <input
                  aria-label="Tên tiến trình bản sao"
                  required
                  maxLength={160}
                  disabled={busy}
                  value={options.name}
                  onChange={(e) => setOptions({ ...options, name: e.target.value })}
                />
              </label>
              <label className="field">
                <span>
                  <input
                    type="checkbox"
                    checked={options.includeContent}
                    disabled={busy}
                    onChange={(e) =>
                      setOptions({
                        ...options,
                        includeContent: e.target.checked,
                        includeSources: e.target.checked && options.includeSources,
                      })
                    }
                  />{' '}
                  Sao chép nội dung đang dùng
                </span>
              </label>
              <label className="field">
                <span>
                  <input
                    type="checkbox"
                    checked={options.includeSources}
                    disabled={busy || !options.includeContent}
                    onChange={(e) => setOptions({ ...options, includeSources: e.target.checked })}
                  />{' '}
                  Giữ nguồn media hiện có
                </span>
              </label>
              <label className="field">
                <span>
                  <input
                    type="checkbox"
                    checked={options.keepDevice}
                    disabled={busy || !source.deviceId}
                    onChange={(e) => setOptions({ ...options, keepDevice: e.target.checked })}
                  />{' '}
                  Giữ điện thoại được gán
                </span>
              </label>
              <p className="muted">
                Tài khoản/đích, thông tin đăng nhập và công việc đã lên lịch không được sao chép.
              </p>
              <div className="dialog-actions">
                <button type="button" disabled={busy} onClick={() => setSource(null)}>
                  Hủy
                </button>
                <button disabled={busy}>Xem trước bản sao</button>
              </div>
            </form>
          ) : (
            <>
              <p>
                <strong>{preview.name}</strong> · {preview.contentCount} nội dung ·{' '}
                {preview.assetCount} media · {preview.sourceCount} nguồn
              </p>
              <p>
                {preview.keepDevice ? 'Giữ điện thoại được gán.' : 'Bản sao chưa gán điện thoại.'}
              </p>
              {!!preview.removedFields.length && (
                <div>
                  <strong>Các trường sẽ được bỏ</strong>
                  <ul>
                    {preview.removedFields.map((field) => (
                      <li key={field.scope + field.key}>
                        {field.scope === 'row' ? 'Nội dung' : 'Tiến trình'} · {field.key}:{' '}
                        {field.reason}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {preview.warnings.map((warning) => (
                <p className="muted" key={warning}>
                  {warning}
                </p>
              ))}
              <div className="dialog-actions">
                <button
                  disabled={busy}
                  onClick={() => {
                    setPreview(null);
                    setError('');
                  }}
                >
                  Sửa lựa chọn
                </button>
                <button disabled={busy} onClick={() => void apply()}>
                  Áp dụng nhân bản
                </button>
              </div>
            </>
          )}
        </Dialog>
      )}
    </>
  );
}
