import { useEffect, useRef, useState } from 'react';
import type { ContentAssetInfo, ProcessDefinition, SourceState } from '@autoreels/contracts';
import { api } from './api.js';

const scanLabels = {
  QUEUED: 'Đang đợi',
  SCANNING: 'Đang quét',
  COMPLETED: 'Đã quét',
  CANCELLED: 'Đã hủy',
  ERROR: 'Có lỗi',
};
interface Props {
  process: ProcessDefinition;
  save: () => Promise<ProcessDefinition | null>;
  notify: (message: string) => void;
  onAssets: (assets: ContentAssetInfo[]) => void;
  onContentChanged: () => void;
}
export function Sources(props: Props) {
  const [sources, setSources] = useState<SourceState[]>([]),
    [native, setNative] = useState(false),
    [recursive, setRecursive] = useState(false),
    [watch, setWatch] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const live = useRef(props),
    alive = useRef(true),
    signature = useRef('');
  live.current = props;
  const reload = useRef<() => Promise<void>>(async () => undefined);
  useEffect(() => {
    let active = true,
      generation = 0;
    alive.current = true;
    let timer: ReturnType<typeof setTimeout>;
    const load = async (): Promise<void> => {
      const token = ++generation;
      try {
        const [list, assets] = await Promise.all([
          api.sources(props.process.id),
          api.contentAssets(props.process.id),
        ]);
        if (!active || token !== generation) return;
        setSources(list);
        setError('');
        live.current.onAssets(assets);
        const nextSignature = JSON.stringify([
          assets,
          list.map((s) => [s.source.id, s.scan?.scanId, s.scan?.updatedAt]),
        ]);
        if (nextSignature !== signature.current) {
          signature.current = nextSignature;
          live.current.onContentChanged();
        }
      } catch (e) {
        if (active && token === generation)
          setError(e instanceof Error ? e.message : 'Không tải được nguồn.');
      }
    };
    reload.current = load;
    const tick = async (): Promise<void> => {
      await load();
      if (active)
        timer = setTimeout(() => {
          void tick();
        }, 1500);
    };
    void api
      .mediaCapabilities()
      .then((result) => {
        if (active) setNative(result.nativeChooser);
      })
      .catch(() => undefined);
    void tick();
    return () => {
      active = false;
      alive.current = false;
      clearTimeout(timer);
    };
  }, [props.process.id]);
  async function act(action: () => Promise<unknown>): Promise<void> {
    setBusy(true);
    try {
      await action();
      await reload.current();
    } catch (e) {
      if (alive.current) props.notify(e instanceof Error ? e.message : 'Thao tác nguồn thất bại.');
    } finally {
      if (alive.current) setBusy(false);
    }
  }
  function choose(kind: 'FOLDER' | 'FILE'): void {
    void act(async () => {
      const saved = await props.save();
      if (!saved) return;
      const result = await api.chooseSource(saved.id, saved.revision, kind, recursive, watch);
      if (!result.cancelled) props.notify('Đã nhận nguồn; đang quét media.');
    });
  }
  return (
    <section className="surface sources-panel" aria-label="Nguồn media">
      <div className="source-toolbar">
        <strong>Nguồn media</strong>
        <label>
          <input
            type="checkbox"
            checked={recursive}
            onChange={(e) => setRecursive(e.target.checked)}
          />{' '}
          Gồm thư mục con
        </label>
        <label>
          <input type="checkbox" checked={watch} onChange={(e) => setWatch(e.target.checked)} /> Tự
          đối chiếu
        </label>
        <div className="actions">
          <button
            disabled={busy || !native}
            title={!native ? 'Mở bản desktop để chọn nguồn trên máy.' : undefined}
            onClick={() => choose('FOLDER')}
          >
            Chọn thư mục
          </button>
          <button
            disabled={busy || !native}
            title={!native ? 'Mở bản desktop để chọn nguồn trên máy.' : undefined}
            onClick={() => choose('FILE')}
          >
            Chọn tệp
          </button>
        </div>
      </div>
      {!native && (
        <p className="muted">
          Chọn nguồn trên máy cần bản desktop. Bản web vẫn sửa dữ liệu và cấu hình lịch được.
        </p>
      )}
      {error && <p role="alert">{error}</p>}
      {!sources.some((s) => s.source.active) && (
        <p className="muted">
          Chưa có nguồn. Quét chỉ thêm nội dung; bỏ qua dòng sẽ giữ nguyên tệp gốc.
        </p>
      )}
      {sources
        .filter((s) => s.source.active)
        .map(({ source, scan, watchWarning }) => {
          const scanning = scan?.status === 'QUEUED' || scan?.status === 'SCANNING';
          return (
            <div className="source-row" key={source.id}>
              <div className="source-summary">
                <span className="source-path" title={source.displayPath}>
                  {source.kind === 'FOLDER' ? '▤' : '▧'} {source.displayPath}
                </span>
                <small className="muted">
                  {source.requiresRebind
                    ? 'Nguồn thuộc máy khác — chọn lại bằng các nút phía trên.'
                    : scan
                      ? `${scanLabels[scan.status]} · ${scan.scanned} tệp · mới ${scan.added} · đổi ${scan.changed} · mất ${scan.missing} · bỏ qua ${scan.ignored}`
                      : 'Chưa quét trên phiên này'}
                </small>
                {watchWarning && <small role="status">{watchWarning}</small>}
                {!!scan?.errors.length && (
                  <details>
                    <summary>{scan.failed} lỗi đọc nguồn</summary>
                    {scan.errors.map((message, index) => (
                      <p key={index}>{message}</p>
                    ))}
                  </details>
                )}
              </div>
              <div className="actions source-options">
                {source.kind === 'FOLDER' && (
                  <label>
                    <input
                      type="checkbox"
                      aria-label={'Thư mục con ' + source.id}
                      checked={source.recursive}
                      disabled={busy || source.requiresRebind}
                      onChange={(e) => {
                        void act(() =>
                          api.updateSource(source.id, source.revision, {
                            recursive: e.target.checked,
                            watch: source.watch,
                            active: true,
                          }),
                        );
                      }}
                    />{' '}
                    Thư mục con
                  </label>
                )}
                <label>
                  <input
                    type="checkbox"
                    aria-label={'Tự đối chiếu ' + source.id}
                    checked={source.watch}
                    disabled={busy || source.requiresRebind}
                    onChange={(e) => {
                      void act(() =>
                        api.updateSource(source.id, source.revision, {
                          recursive: source.recursive,
                          watch: e.target.checked,
                          active: true,
                        }),
                      );
                    }}
                  />{' '}
                  Tự đối chiếu
                </label>
                <button
                  disabled={busy || source.requiresRebind}
                  onClick={() => {
                    void act(() =>
                      scanning ? api.cancelSourceScan(source.id) : api.scanSource(source.id),
                    );
                  }}
                >
                  {scanning ? 'Hủy quét' : 'Quét lại'}
                </button>
                <button
                  disabled={busy}
                  title="Ngừng theo dõi, giữ nguyên nội dung và tệp gốc"
                  onClick={() => {
                    void act(() =>
                      api.updateSource(source.id, source.revision, {
                        recursive: source.recursive,
                        watch: false,
                        active: false,
                      }),
                    );
                  }}
                >
                  Ngừng dùng
                </button>
              </div>
            </div>
          );
        })}
    </section>
  );
}
