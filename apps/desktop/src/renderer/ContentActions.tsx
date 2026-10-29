import { useEffect, useRef, useState } from 'react';
import type {
  ContentItem,
  ProcessDefinition,
  FieldDefinition,
  ContentFormat,
  ContentPreviewDto,
  JsonValue,
  BulkContentRequest,
} from '@autoreels/contracts';
import { api } from './api.js';
import { Dialog } from './components.js';
import { ContentFields } from './ContentFields.js';

interface Props {
  process: ProcessDefinition;
  scope: ContentItem[];
  selected: boolean;
  schema: FieldDefinition[];
  assets: Parameters<typeof ContentFields>[0]['assets'];
  save: () => Promise<ProcessDefinition | null>;
  changed: () => Promise<void>;
  notify: (message: string) => void;
}
function readFile(file: File, format: ContentFormat): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Không đọc được file đã chọn.'));
    reader.onload = () => {
      const value = String(reader.result);
      resolve(format === 'XLSX' ? value.slice(value.indexOf(',') + 1) : value);
    };
    if (format === 'XLSX') reader.readAsDataURL(file);
    else reader.readAsText(file);
  });
}
const labels = { CREATE: 'Tạo mới', UPDATE: 'Cập nhật', UNCHANGED: 'Giữ nguyên', ERROR: 'Có lỗi' };
export function ContentActions(props: Props) {
  const [busy, setBusy] = useState(false),
    [preview, setPreview] = useState<ContentPreviewDto | null>(null),
    [bulk, setBulk] = useState(false),
    [key, setKey] = useState(''),
    [operation, setOperation] = useState<BulkContentRequest['operation']>('SET'),
    [json, setJson] = useState('{}');
  const [bulkRows, setBulkRows] = useState<ContentItem[]>([]);
  const working = useRef(false);
  const input = useRef<HTMLInputElement>(null),
    alive = useRef(true),
    menu = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  async function perform(action: () => Promise<unknown>): Promise<void> {
    if (working.current) return;
    working.current = true;
    setBusy(true);
    try {
      await action();
    } catch (e) {
      if (alive.current)
        props.notify(e instanceof Error ? e.message : 'Thao tác dữ liệu thất bại.');
    } finally {
      working.current = false;
      if (alive.current) setBusy(false);
    }
  }
  async function imported(file: File): Promise<void> {
    const extension = file.name.split('.').at(-1)?.toUpperCase(),
      format = extension as ContentFormat;
    if (!['CSV', 'JSON', 'XLSX'].includes(format))
      throw new Error('Chọn file CSV, JSON hoặc XLSX.');
    if (file.size > 4 * 1024 * 1024)
      throw new Error('File tối đa 4 MiB; chia dữ liệu thành nhiều lô.');
    const process = await props.save();
    if (!process) return;
    const result = await api.previewContentImport(
      process.id,
      process.revision,
      format,
      await readFile(file, format),
    );
    if (alive.current) setPreview(result);
  }
  function download(format: ContentFormat): void {
    void perform(async () => {
      const process = await props.save();
      if (!process) return;
      const result = await api.exportContent(
        process.id,
        props.scope.map((row) => row.id),
        format,
      );
      if (!alive.current) return;
      const bytes =
        result.encoding === 'base64'
          ? Uint8Array.from(atob(result.data), (c) => c.charCodeAt(0))
          : result.data;
      const url = URL.createObjectURL(new Blob([bytes], { type: result.mimeType })),
        link = document.createElement('a');
      link.href = url;
      link.download = result.filename;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      if (menu.current) menu.current.open = false;
    });
  }
  return (
    <>
      <input
        ref={input}
        type="file"
        accept=".csv,.json,.xlsx"
        aria-label="File dữ liệu nội dung"
        className="hidden-file-input"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) void perform(() => imported(file));
        }}
      />
      <details className="data-menu" ref={menu}>
        <summary aria-label="Menu dữ liệu" aria-disabled={busy}>
          Dữ liệu ▾
        </summary>
        <div className="data-menu-options">
          <small>
            {props.selected ? 'Đã chọn' : 'Đang lọc'}: {props.scope.length} nội dung
          </small>
          <button
            disabled={busy}
            onClick={() => {
              if (menu.current) menu.current.open = false;
              input.current?.click();
            }}
          >
            Nhập CSV / JSON / XLSX…
          </button>
          <button
            disabled={
              busy || !props.scope.length || props.scope.length > 1000 || !props.schema.length
            }
            onClick={() => {
              setBulkRows(structuredClone(props.scope));
              setKey(props.schema[0]!.key);
              setJson('{}');
              setOperation('SET');
              setBulk(true);
              if (menu.current) menu.current.open = false;
            }}
          >
            Sửa hàng loạt ({props.scope.length})…
          </button>
          {(['JSON', 'CSV', 'XLSX'] as const).map((format) => (
            <button
              key={format}
              disabled={busy || !props.scope.length || props.scope.length > 1000}
              onClick={() => download(format)}
            >
              Xuất {format} ({props.scope.length})
            </button>
          ))}
          <small>Mỗi thao tác tối đa 1000 nội dung; không tự bỏ các dòng ngoài giới hạn.</small>
        </div>
      </details>
      {bulk && (
        <Dialog
          title="Sửa dữ liệu hàng loạt"
          close={() => {
            if (!busy) setBulk(false);
          }}
          wide
        >
          <p>
            {bulkRows.length} nội dung {props.selected ? 'đã chọn' : 'trong bộ lọc'} ·{' '}
            {props.process.name}
          </p>
          <div className="form-grid">
            <label className="field">
              Trường
              <select
                aria-label="Trường sửa hàng loạt"
                value={key}
                onChange={(e) => {
                  setKey(e.target.value);
                  setJson('{}');
                }}
              >
                {props.schema.map((f) => (
                  <option key={f.key} value={f.key}>
                    {f.label ?? f.key}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              Thao tác
              <select
                aria-label="Thao tác hàng loạt"
                value={operation}
                onChange={(e) => setOperation(e.target.value as BulkContentRequest['operation'])}
              >
                <option value="SET">Đặt giá trị</option>
                <option value="APPEND">Thêm vào cuối</option>
                <option value="PREPEND">Thêm vào đầu</option>
                <option value="REMOVE">Bỏ trường · chưa nhập</option>
              </select>
            </label>
          </div>
          {operation !== 'REMOVE' && (
            <ContentFields
              schema={props.schema.filter((f) => f.key === key)}
              assets={props.assets}
              json={json}
              change={setJson}
            />
          )}
          <div className="dialog-actions">
            <button disabled={busy} onClick={() => setBulk(false)}>
              Hủy
            </button>
            <button
              className="primary"
              disabled={busy}
              onClick={() => {
                void perform(async () => {
                  const process = await props.save();
                  if (!process) return;
                  const fields = JSON.parse(json) as Record<string, JsonValue>,
                    value = fields[key];
                  if (operation !== 'REMOVE' && value === undefined)
                    throw new Error('Nhập giá trị cho trường đã chọn.');
                  const result = await api.previewBulkContent(process.id, process.revision, {
                    selection: bulkRows.map((row) => ({ id: row.id, revision: row.revision })),
                    fieldKey: key,
                    operation,
                    ...(operation !== 'REMOVE' ? { value } : {}),
                  });
                  if (alive.current) {
                    setBulk(false);
                    setPreview(result);
                  }
                });
              }}
            >
              Xem trước thay đổi
            </button>
          </div>
        </Dialog>
      )}
      {preview && (
        <Dialog
          title="Xem trước thay đổi dữ liệu"
          close={() => {
            if (!busy) setPreview(null);
          }}
          wide
        >
          <p>
            {props.process.name} · {preview.changes.length} dòng ·{' '}
            {preview.changes.filter((c) => c.action === 'CREATE').length} mới ·{' '}
            {preview.changes.filter((c) => c.action === 'UPDATE').length} cập nhật ·{' '}
            {preview.changes.filter((c) => c.action === 'ERROR').length} lỗi
          </p>
          {!!preview.impactedJobIds.length && (
            <p className="schedule-blocker">
              Có {preview.impactedJobIds.length} công việc liên quan. Các công việc đã tạo sẽ giữ
              nguyên snapshot cũ.
            </p>
          )}
          {preview.conversions.map((message) => (
            <p className="muted" key={message}>
              {message}
            </p>
          ))}
          <div className="table-wrap import-preview-table">
            <table>
              <thead>
                <tr>
                  <th>Dòng</th>
                  <th>Nội dung</th>
                  <th>Thay đổi</th>
                  <th>Trường / lỗi</th>
                </tr>
              </thead>
              <tbody>
                {preview.changes.map((change) => (
                  <tr key={change.line}>
                    <td>{change.line}</td>
                    <td>
                      <code>{change.contentId?.slice(0, 22) ?? 'Chưa khớp'}</code>
                    </td>
                    <td>{labels[change.action]}</td>
                    <td>
                      {change.errors.length
                        ? change.errors.join(' ')
                        : change.deltas?.length
                          ? change.deltas.map((delta) => (
                              <details className="content-delta" key={delta.key}>
                                <summary>
                                  {delta.key}:{' '}
                                  {delta.beforePresent
                                    ? JSON.stringify(delta.before).slice(0, 80)
                                    : 'Chưa nhập'}{' '}
                                  →{' '}
                                  {delta.afterPresent
                                    ? JSON.stringify(delta.after).slice(0, 80)
                                    : 'Chưa nhập'}
                                </summary>
                                <div className="delta-values">
                                  <pre>
                                    {delta.beforePresent
                                      ? JSON.stringify(delta.before, null, 2)
                                      : 'Chưa nhập'}
                                  </pre>
                                  <span>→</span>
                                  <pre>
                                    {delta.afterPresent
                                      ? JSON.stringify(delta.after, null, 2)
                                      : 'Chưa nhập'}
                                  </pre>
                                </div>
                              </details>
                            ))
                          : 'Giữ nguyên'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <small className="muted">
            Hết hạn {new Date(preview.expiresAt).toLocaleTimeString('vi-VN')}. File nguồn và lịch sử
            công việc được giữ nguyên.
          </small>
          <div className="dialog-actions">
            <button disabled={busy} onClick={() => setPreview(null)}>
              Hủy
            </button>
            <button
              className="primary"
              disabled={busy || !preview.canApply || Date.parse(preview.expiresAt) <= Date.now()}
              onClick={() => {
                void perform(async () => {
                  const result = await api.applyContentPreview(preview.token);
                  if (!alive.current) return;
                  await props.changed();
                  setPreview(null);
                  props.notify(
                    `Đã tạo ${result.created}, cập nhật ${result.updated} nội dung${result.alreadyApplied ? ' từ lần áp dụng trước' : ''}.`,
                  );
                });
              }}
            >
              {busy ? 'Đang áp dụng…' : 'Áp dụng thay đổi'}
            </button>
          </div>
        </Dialog>
      )}
    </>
  );
}
