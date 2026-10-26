import { useEffect, useRef, useState } from 'react';
import type {
  AppDefinition,
  WorkflowSummary,
  ProcessDefinition,
  ContentItem,
  FieldDefinition,
  JsonValue,
  ContentAssetInfo,
} from '@autoreels/contracts';
import { api } from './api.js';
import { Dialog, Empty } from './components.js';
import { Sources } from './Sources.js';
import { useVirtualizer } from '@tanstack/react-virtual';
import { ContentActions } from './ContentActions.js';
import { ContentFields } from './ContentFields.js';

interface Props {
  deviceScope?: string | null;
  clearDeviceScope?: () => void;
  apps: AppDefinition[];
  workflows: WorkflowSummary[];
  processes: ProcessDefinition[];
  devices: { id: string; name: string; enabled: boolean }[];
  notify: (message: string) => void;
  refresh: () => Promise<void>;
  registerSave: (save: (() => Promise<unknown>) | null) => void;
}
function newProcess(appId: string): ProcessDefinition {
  return {
    id: 'process_' + crypto.randomUUID().replaceAll('-', ''),
    name: 'Tiến trình mới',
    appId,
    workflowId: null,
    workflowVersionId: null,
    deviceId: null,
    accountId: null,
    targetId: null,
    revision: 0,
    archived: false,
    schedule: {
      timezone: 'Asia/Ho_Chi_Minh',
      startDate: new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }),
      slots: ['08:00', '12:00', '19:00'],
      weekdays: [1, 2, 3, 4, 5, 6, 7],
      overduePolicy: 'NEXT_FUTURE_SLOT',
      jitterMinutes: 0,
    },
  };
}
export function Processes(props: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const contentScroll = useRef<HTMLDivElement>(null);
  const [applying, setApplying] = useState(false);
  const [preview, setPreview] = useState<Awaited<ReturnType<typeof api.previewSchedule>> | null>(
    null,
  );
  const [processJson, setProcessJson] = useState('{}'),
    [processJsonError, setProcessJsonError] = useState(false);
  const [assets, setAssets] = useState<ContentAssetInfo[]>([]);
  const [current, setCurrent] = useState<ProcessDefinition | null>(null),
    [rows, setRows] = useState<ContentItem[]>([]),
    [schema, setSchema] = useState<FieldDefinition[]>([]),
    [processSchema, setProcessSchema] = useState<FieldDefinition[]>([]),
    [dirty, setDirty] = useState(false),
    [isNew, setIsNew] = useState(false),
    [versions, setVersions] = useState<Awaited<ReturnType<typeof api.versions>>>([]);
  const [rowModal, setRowModal] = useState<ContentItem | null>(null),
    [rowJson, setRowJson] = useState('{}'),
    [filter, setFilter] = useState('');
  const rowGeneration = useRef(0),
    schemaGeneration = useRef(0),
    edits = useRef(0),
    context = useRef(current);
  context.current = current;
  const live = useRef({ current, dirty, isNew, validInputs: !processJsonError });
  live.current = { current, dirty, isNew, validInputs: !processJsonError };
  const saving = useRef<Promise<unknown> | null>(null);
  const saveRef = useRef<() => Promise<unknown>>(async () => undefined);
  async function save(): Promise<ProcessDefinition | null> {
    if (saving.current) {
      await saving.current;
      return save();
    }
    const state = live.current;
    if (!state.validInputs) throw new Error('Sửa JSON trường tiến trình trước khi lưu.');
    if (!state.current || !state.dirty) return state.current;
    const snapshot = state.current,
      id = snapshot.id,
      at = edits.current;
    const promise = api
      .saveProcess(snapshot, state.isNew ? null : snapshot.revision)
      .then(async (result) => {
        if (live.current.current?.id === id) {
          const changed = edits.current !== at,
            next = changed ? { ...live.current.current, revision: result.revision } : result;
          live.current = {
            current: next,
            dirty: changed,
            isNew: false,
            validInputs: live.current.validInputs,
          };
          context.current = next;
          setCurrent(next);
          setDirty(changed);
          setIsNew(false);
        }
        await props.refresh();
        return result;
      })
      .finally(() => {
        saving.current = null;
      });
    saving.current = promise;
    const result = await promise;
    return live.current.dirty ? save() : result;
  }
  saveRef.current = save;
  useEffect(() => {
    props.registerSave(() => saveRef.current());
    return () => props.registerSave(null);
  }, [props.registerSave]);
  async function select(process: ProcessDefinition) {
    try {
      await save();
      const token = ++rowGeneration.current;
      context.current = process;
      live.current = { current: process, dirty: false, isNew: false, validInputs: true };
      setProcessJsonError(false);
      setCurrent(process);
      setDirty(false);
      setIsNew(false);
      setRows([]);
      setSelected(new Set());
      setAssets([]);
      setPreview(null);
      setRowModal(null);
      const data = await api.content(process.id);
      if (token === rowGeneration.current && context.current?.id === process.id) setRows(data);
    } catch (e) {
      props.notify(e instanceof Error ? e.message : 'Không thể đổi tiến trình.');
    }
  }
  useEffect(() => {
    const token = ++schemaGeneration.current;
    if (!current?.workflowId) {
      setSchema([]);
      setProcessSchema([]);
      setVersions([]);
      return;
    }
    void Promise.all([api.loadWorkflow(current.workflowId), api.versions(current.workflowId)])
      .then(([draft, list]) => {
        if (token !== schemaGeneration.current) return;
        setVersions(list);
        const pinned = list.find((v) => v.id === current.workflowVersionId);
        setSchema((pinned?.bundle ?? draft.bundle).inputs.filter((f) => f.scope === 'row'));
        setProcessSchema(
          (pinned?.bundle ?? draft.bundle).inputs.filter((f) => f.scope === 'process'),
        );
      })
      .catch((e) => props.notify(String(e)));
  }, [current?.workflowId, current?.workflowVersionId]);
  useEffect(() => {
    // Reset on context switch; a save acknowledgement must preserve an in-progress JSON draft.
    setProcessJson(JSON.stringify(current?.fields ?? {}, null, 2));
    setProcessJsonError(false);
  }, [current?.id]);
  function edit(patch: Partial<ProcessDefinition>) {
    if (!live.current.current) return;
    const next = { ...live.current.current, ...patch };
    edits.current++;
    live.current = { ...live.current, current: next, dirty: true };
    context.current = next;
    setCurrent(next);
    setDirty(true);
  }
  const filtered = rows.filter((r) =>
    JSON.stringify(r.fields).toLocaleLowerCase('vi').includes(filter.toLocaleLowerCase('vi')),
  );
  const virtualRows = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => contentScroll.current,
    estimateSize: () => 62,
    getItemKey: (index) => filtered[index]!.id,
    overscan: 8,
  });
  const visible = virtualRows.getVirtualItems();
  useEffect(() => {
    contentScroll.current?.scrollTo({ top: 0 });
  }, [filter, current?.id]);
  useEffect(() => {
    setSelected((previous) => {
      const ids = new Set(rows.map((row) => row.id)),
        next = new Set([...previous].filter((id) => ids.has(id)));
      return next.size === previous.size ? previous : next;
    });
  }, [rows]);
  const dataScope = selected.size ? rows.filter((row) => selected.has(row.id)) : filtered;
  const unknownProcessKeys = Object.keys(current?.fields ?? {}).filter(
    (key) => !processSchema.some((field) => field.key === key),
  );
  return (
    <div className="page process-page">
      <div className="page-heading">
        <div>
          <h1>Tiến trình</h1>
          <p>Mỗi tiến trình có app, workflow, dữ liệu và lịch riêng.</p>
        </div>
        <div className="actions">
          <button
            onClick={() => {
              void save().then(() => {
                setCurrent({
                  ...newProcess(props.apps[0]!.id),
                  deviceId: props.deviceScope ?? null,
                });
                setRows([]);
                setIsNew(true);
                setDirty(true);
              });
            }}
          >
            ＋ Tiến trình mới
          </button>
          <button
            className="primary"
            disabled={!current || !dirty}
            onClick={() =>
              void save()
                .then(() => props.notify('Đã lưu tiến trình.'))
                .catch((e) => props.notify(e instanceof Error ? e.message : 'Lưu lỗi.'))
            }
          >
            ▣ Lưu tiến trình
          </button>
        </div>
      </div>
      <div className="process-selector">
        {props.deviceScope && (
          <span className="badge">
            Thiết bị:{' '}
            {props.devices.find((d) => d.id === props.deviceScope)?.name ?? props.deviceScope}{' '}
            <button onClick={props.clearDeviceScope}>Hiện tất cả</button>
          </span>
        )}
        <label>
          Tiến trình
          <select
            aria-label="Chọn tiến trình"
            value={current?.id ?? ''}
            onChange={(e) => {
              const p = props.processes.find((p) => p.id === e.target.value);
              if (p) void select(p);
            }}
          >
            <option value="">Chọn tiến trình</option>
            {isNew && current && <option value={current.id}>{current.name} · mới</option>}
            {props.processes
              .filter((p) => !props.deviceScope || p.deviceId === props.deviceScope)
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
          </select>
        </label>
        <span className="badge">
          {processJsonError
            ? 'Dữ liệu chưa hợp lệ'
            : dirty
              ? 'Chưa lưu'
              : current
                ? 'Đã lưu r' + current.revision
                : 'Chưa chọn'}
        </span>
      </div>
      {!current ? (
        <Empty title="Chưa chọn tiến trình">
          Tạo tiến trình để gán workflow, khai báo nguồn dữ liệu và cấu hình lịch. Có thể lưu draft
          khi chưa gán điện thoại.
        </Empty>
      ) : (
        <>
          <div className="surface">
            <div className="form-grid">
              <label className="field">
                <span>Tên tiến trình</span>
                <input
                  aria-label="Tên tiến trình"
                  value={current.name}
                  onChange={(e) => edit({ name: e.target.value })}
                />
              </label>
              <label className="field">
                <span>Ứng dụng</span>
                <select
                  value={current.appId}
                  onChange={(e) =>
                    edit({
                      appId: e.target.value,
                      workflowId: null,
                      workflowVersionId: null,
                      accountId: null,
                      targetId: null,
                    })
                  }
                >
                  {props.apps.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Workflow</span>
                <select
                  aria-label="Workflow tiến trình"
                  value={current.workflowId ?? ''}
                  onChange={(e) =>
                    edit({ workflowId: e.target.value || null, workflowVersionId: null })
                  }
                >
                  <option value="">Chưa gán workflow</option>
                  {props.workflows
                    .filter((w) => w.appId === current.appId)
                    .map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name}
                      </option>
                    ))}
                </select>
              </label>
              <label className="field">
                <span>Phiên bản</span>
                <select
                  aria-label="Phiên bản tiến trình"
                  value={current.workflowVersionId ?? ''}
                  onChange={(e) => edit({ workflowVersionId: e.target.value || null })}
                >
                  <option value="">Draft · chưa dùng cho real job</option>
                  {versions.map((v) => (
                    <option key={v.id} value={v.id}>
                      v{v.number} · {v.hash.slice(0, 8)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Điện thoại</span>
                <select
                  aria-label="Điện thoại tiến trình"
                  disabled={!props.devices.length}
                  value={current.deviceId ?? ''}
                  onChange={(e) =>
                    edit({ deviceId: e.target.value || null, accountId: null, targetId: null })
                  }
                >
                  <option value="">
                    {props.devices.length ? 'Chưa gán điện thoại' : 'Chưa kết nối thiết bị'}
                  </option>
                  {props.devices.map((device) => (
                    <option key={device.id} value={device.id} disabled={!device.enabled}>
                      {device.name}
                      {device.enabled ? '' : ' · đã tắt'}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Tài khoản / đích</span>
                <input disabled value="Cần discovery/verification trên máy thật" />
              </label>
            </div>
          </div>
          {(!!processSchema.length || !!unknownProcessKeys.length || processJsonError) && (
            <details className="surface process-inputs" open>
              <summary>Dữ liệu riêng của tiến trình · {processSchema.length} trường</summary>
              {!!unknownProcessKeys.length && (
                <div className="schedule-blocker">
                  <p>
                    Giá trị ngoài schema hiện tại: {unknownProcessKeys.join(', ')}. Dữ liệu được giữ
                    để bạn kiểm tra trước khi đổi workflow.
                  </p>
                  <button
                    disabled={processJsonError}
                    onClick={() => {
                      const fields = Object.fromEntries(
                        Object.entries(current.fields ?? {}).filter(
                          ([key]) => !unknownProcessKeys.includes(key),
                        ),
                      );
                      setProcessJson(JSON.stringify(fields, null, 2));
                      edit({ fields });
                    }}
                  >
                    Bỏ giá trị không còn trong schema
                  </button>
                </div>
              )}
              <ContentFields
                schema={processSchema}
                assets={assets}
                json={processJson}
                change={(json) => {
                  setProcessJson(json);
                  try {
                    const fields: unknown = JSON.parse(json);
                    if (!fields || typeof fields !== 'object' || Array.isArray(fields))
                      throw new Error('Expected field map');
                    setProcessJsonError(false);
                    edit({ fields: fields as Record<string, JsonValue> });
                  } catch {
                    setProcessJsonError(true);
                  }
                }}
              />
            </details>
          )}
          <div className="section-heading">
            <h2>Nội dung</h2>
            <div className="actions">
              <span className="muted">
                {selected.size} chọn · {filtered.length} đang lọc
              </span>
              {!isNew && (
                <ContentActions
                  key={current.id}
                  process={current}
                  scope={dataScope}
                  selected={selected.size > 0}
                  schema={schema}
                  assets={assets}
                  save={save}
                  notify={props.notify}
                  changed={async () => {
                    const id = current.id,
                      token = ++rowGeneration.current;
                    const data = await api.content(id);
                    if (context.current?.id === id && token === rowGeneration.current) {
                      setRows(data);
                      setSelected(new Set());
                    }
                  }}
                />
              )}
              <input
                aria-label="Tìm nội dung"
                placeholder="Tìm nội dung…"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              />
              <button
                disabled={isNew || !current.workflowId}
                onClick={() => {
                  const fields: Record<string, JsonValue> = {};
                  for (const f of schema)
                    if (f.type === 'number') fields[f.key] = 0;
                    else if (f.type === 'boolean') fields[f.key] = false;
                    else if (f.type === 'text') fields[f.key] = '';
                    else if (['list', 'file[]'].includes(f.type)) fields[f.key] = [];
                  const row = {
                    id: 'content_' + crypto.randomUUID().replaceAll('-', ''),
                    processId: current.id,
                    revision: 0,
                    fields,
                    assetIds: [],
                    ignored: false,
                  };
                  setRowModal(row);
                  setRowJson(JSON.stringify(fields, null, 2));
                }}
              >
                ＋ Thêm nội dung
              </button>
            </div>
          </div>
          {!isNew && (
            <Sources
              key={current.id}
              process={current}
              save={save}
              notify={props.notify}
              onAssets={setAssets}
              onContentChanged={() => {
                const id = current.id,
                  token = ++rowGeneration.current;
                void api
                  .content(id)
                  .then((data) => {
                    if (context.current?.id === id && token === rowGeneration.current)
                      setRows(data);
                  })
                  .catch((e) => props.notify(String(e)));
              }}
            />
          )}
          <div className="table-wrap content-table-scroll" ref={contentScroll}>
            <table>
              <thead>
                <tr>
                  <th>
                    <input
                      type="checkbox"
                      aria-label={'Chọn toàn bộ ' + filtered.length + ' nội dung đang lọc'}
                      checked={!!filtered.length && filtered.every((row) => selected.has(row.id))}
                      onChange={(e) =>
                        setSelected((previous) => {
                          const next = new Set(previous);
                          for (const row of filtered)
                            if (e.target.checked) next.add(row.id);
                            else next.delete(row.id);
                          return next;
                        })
                      }
                    />
                  </th>
                  <th>Nội dung ID</th>
                  {schema.map((f) => (
                    <th key={f.key}>{f.label ?? f.key}</th>
                  ))}
                  <th>Assets</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {!!visible.length && visible[0]!.start > 0 && (
                  <tr aria-hidden="true">
                    <td
                      colSpan={schema.length + 4}
                      style={{ height: visible[0]!.start, padding: 0, border: 0 }}
                    />
                  </tr>
                )}
                {visible.map((virtualRow) => {
                  const row = filtered[virtualRow.index]!;
                  return (
                    <tr
                      key={row.id}
                      data-index={virtualRow.index}
                      ref={virtualRows.measureElement}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        setRowModal(row);
                        setRowJson(JSON.stringify(row.fields, null, 2));
                      }}
                    >
                      <td>
                        <input
                          type="checkbox"
                          aria-label={'Chọn ' + row.id}
                          checked={selected.has(row.id)}
                          onChange={(e) =>
                            setSelected((previous) => {
                              const next = new Set(previous);
                              if (e.target.checked) next.add(row.id);
                              else next.delete(row.id);
                              return next;
                            })
                          }
                        />
                      </td>
                      <td>
                        <code>{row.id.slice(0, 18)}</code>
                      </td>
                      {schema.map((f) => (
                        <td key={f.key}>
                          {typeof row.fields[f.key] === 'object'
                            ? JSON.stringify(row.fields[f.key])
                            : String(row.fields[f.key] ?? '')}
                        </td>
                      ))}
                      <td>
                        {row.assetIds.length
                          ? assets
                              .filter((a) => a.contentId === row.id)
                              .map((a) => (
                                <div key={a.id} className="asset-label" title={a.hash}>
                                  {a.relativePath}{' '}
                                  <small className={'asset-state ' + a.state.toLowerCase()}>
                                    {
                                      {
                                        READY: 'Sẵn có',
                                        CHANGED: 'File đã đổi',
                                        MISSING: 'Mất file',
                                        IGNORED: 'Bỏ qua',
                                        UNTRACKED: 'Chưa theo dõi',
                                      }[a.state]
                                    }
                                  </small>
                                </div>
                              ))
                          : 'Không có media'}
                      </td>
                      <td>
                        <button
                          aria-label={'Sửa ' + row.id}
                          onClick={() => {
                            setRowModal(row);
                            setRowJson(JSON.stringify(row.fields, null, 2));
                          }}
                        >
                          Sửa
                        </button>
                        <button
                          aria-label={'Bỏ qua ' + row.id}
                          title="Bỏ qua nội dung, giữ nguyên tệp gốc"
                          onClick={() => {
                            const id = row.processId;
                            void api
                              .ignoreContent(row.id, row.revision)
                              .then(() => api.content(id))
                              .then((data) => {
                                if (context.current?.id === id) setRows(data);
                              })
                              .catch((e) => props.notify(String(e)));
                          }}
                        >
                          Bỏ qua
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {!!visible.length && virtualRows.getTotalSize() > visible.at(-1)!.end && (
                  <tr aria-hidden="true">
                    <td
                      colSpan={schema.length + 4}
                      style={{
                        height: virtualRows.getTotalSize() - visible.at(-1)!.end,
                        padding: 0,
                        border: 0,
                      }}
                    />
                  </tr>
                )}
              </tbody>
            </table>
            {!rows.length && (
              <div className="table-empty">
                Chưa có nội dung. Fields được lấy từ schema workflow đã chọn.
              </div>
            )}
          </div>
          <div className="section-heading">
            <h2>Cấu hình lịch riêng</h2>
            <button
              disabled={isNew || !rows.length}
              onClick={() => {
                const id = current.id;
                void save()
                  .then(() =>
                    api.previewSchedule(
                      id,
                      filtered.map((row) => row.id),
                    ),
                  )
                  .then((result) => {
                    if (context.current?.id === id) setPreview(result);
                  })
                  .catch((error) =>
                    props.notify(
                      error instanceof Error ? error.message : 'Không tạo được preview.',
                    ),
                  );
              }}
            >
              Xem trước lịch ({filtered.length})
            </button>
            <span className="muted">
              Timezone: {current.schedule.timezone} · xem trước trước khi tạo lịch
            </span>
          </div>
          <div className="surface">
            <div className="form-grid">
              <label className="field">
                <span>Ngày bắt đầu</span>
                <input
                  type="date"
                  value={current.schedule.startDate}
                  onChange={(e) =>
                    edit({ schedule: { ...current.schedule, startDate: e.target.value } })
                  }
                />
              </label>
              <label className="field">
                <span>Timezone IANA</span>
                <input
                  value={current.schedule.timezone}
                  onChange={(e) =>
                    edit({ schedule: { ...current.schedule, timezone: e.target.value } })
                  }
                />
              </label>
              <label className="field">
                <span>Khi bỏ lỡ giờ</span>
                <select
                  value={current.schedule.overduePolicy}
                  onChange={(e) =>
                    edit({
                      schedule: {
                        ...current.schedule,
                        overduePolicy: e.target
                          .value as ProcessDefinition['schedule']['overduePolicy'],
                      },
                    })
                  }
                >
                  <option value="NEXT_FUTURE_SLOT">Chuyển slot tương lai</option>
                  <option value="CATCH_UP">Xếp hàng chạy bù</option>
                  <option value="SKIP">Bỏ lượt, giữ lý do</option>
                </select>
              </label>
              <label className="field">
                <span>Jitter tối đa (phút)</span>
                <input
                  type="number"
                  min="0"
                  max="1440"
                  value={current.schedule.jitterMinutes}
                  onChange={(e) =>
                    edit({
                      schedule: { ...current.schedule, jitterMinutes: Number(e.target.value) },
                    })
                  }
                />
              </label>
            </div>
            <div className="slot-list">
              {current.schedule.slots.map((slot, i) => (
                <label key={i}>
                  Slot {i + 1}
                  <input
                    type="time"
                    value={slot}
                    onChange={(e) =>
                      edit({
                        schedule: {
                          ...current.schedule,
                          slots: current.schedule.slots.map((s, j) =>
                            j === i ? e.target.value : s,
                          ),
                        },
                      })
                    }
                  />
                </label>
              ))}
              <button
                onClick={() =>
                  edit({
                    schedule: { ...current.schedule, slots: [...current.schedule.slots, '20:00'] },
                  })
                }
              >
                ＋ Thêm slot
              </button>
            </div>
            <div className="weekdays">
              {['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map((day, i) => (
                <label key={day}>
                  <input
                    type="checkbox"
                    checked={current.schedule.weekdays.includes(i + 1)}
                    onChange={(e) =>
                      edit({
                        schedule: {
                          ...current.schedule,
                          weekdays: e.target.checked
                            ? [...current.schedule.weekdays, i + 1].sort()
                            : current.schedule.weekdays.filter((n) => n !== i + 1),
                        },
                      })
                    }
                  />
                  {day}
                </label>
              ))}
            </div>
          </div>
        </>
      )}
      {preview && current && (
        <Dialog title="Xem trước lịch" close={() => setPreview(null)} wide>
          <p>
            {preview.slots.length} nội dung · {preview.timezone}
          </p>
          {preview.blockers.map((message) => (
            <p key={message} className="schedule-blocker">
              {message}
            </p>
          ))}
          {preview.warnings.map((message) => (
            <p key={message} className="muted">
              {message}
            </p>
          ))}
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Nội dung</th>
                  <th>Giờ địa phương</th>
                  <th>UTC</th>
                </tr>
              </thead>
              <tbody>
                {preview.slots.map((slot) => (
                  <tr key={slot.contentId}>
                    <td>
                      <code>{slot.contentId.slice(0, 20)}</code>
                    </td>
                    <td>
                      {new Date(slot.scheduledUtc).toLocaleString('vi-VN', {
                        timeZone: preview.timezone,
                      })}
                      {slot.crossesLocalDay ? ' · Qua ngày' : ''}
                    </td>
                    <td>{slot.scheduledUtc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <small className="muted">
            Hết hạn: {new Date(preview.expiresAt).toLocaleTimeString('vi-VN')}
          </small>
          <div className="dialog-actions">
            <button onClick={() => setPreview(null)}>Đóng</button>
            <button
              className="primary"
              disabled={
                applying || !preview.canApply || Date.parse(preview.expiresAt) <= Date.now()
              }
              title={
                preview.blockers.join(' ') || 'Lưu đúng lịch đã xem; chưa thực thi trên điện thoại.'
              }
              onClick={() => {
                setApplying(true);
                void api
                  .applySchedule(preview.token)
                  .then((result) => {
                    setPreview(null);
                    props.notify(
                      'Đã lưu ' +
                        result.jobIds.length +
                        ' công việc' +
                        (result.alreadyApplied
                          ? ' từ lần áp dụng trước.'
                          : '. Android runtime chưa khả dụng.'),
                    );
                  })
                  .catch((e) =>
                    props.notify(e instanceof Error ? e.message : 'Không áp dụng được lịch.'),
                  )
                  .finally(() => setApplying(false));
              }}
            >
              {applying ? 'Đang lưu…' : 'Áp dụng lịch'}
            </button>
          </div>
        </Dialog>
      )}
      {rowModal && (
        <Dialog title="Dữ liệu nội dung" close={() => setRowModal(null)} wide>
          <p className="muted">
            Trường có dấu * là bắt buộc. “Chưa nhập” khác với số 0 hoặc trạng thái tắt.
          </p>
          <ContentFields schema={schema} assets={assets} json={rowJson} change={setRowJson} />
          <div className="dialog-actions">
            <button onClick={() => setRowModal(null)}>Hủy</button>
            <button
              className="primary"
              onClick={() => {
                try {
                  const fields = JSON.parse(rowJson) as Record<string, JsonValue>,
                    original = rows.find((r) => r.id === rowModal.id),
                    processId = rowModal.processId;
                  const referenced: string[] = [];
                  for (const field of schema) {
                    const value = fields[field.key];
                    if (
                      field.type === 'file' &&
                      value &&
                      typeof value === 'object' &&
                      !Array.isArray(value)
                    )
                      referenced.push(String(value.assetId));
                    if (field.type === 'file[]' && Array.isArray(value))
                      for (const ref of value)
                        if (ref && typeof ref === 'object' && !Array.isArray(ref))
                          referenced.push(String(ref.assetId));
                  }
                  void api
                    .saveContent(
                      {
                        ...rowModal,
                        fields,
                        assetIds: [...new Set([...rowModal.assetIds, ...referenced])],
                      },
                      original?.revision ?? null,
                    )
                    .then(async () => {
                      const data = await api.content(processId);
                      if (context.current?.id === processId) setRows(data);
                      setRowModal(null);
                      props.notify('Đã lưu nội dung.');
                    })
                    .catch((e) =>
                      props.notify(e instanceof Error ? e.message : 'Lưu nội dung thất bại.'),
                    );
                } catch {
                  props.notify('JSON không hợp lệ.');
                }
              }}
            >
              Lưu nội dung
            </button>
          </div>
        </Dialog>
      )}
    </div>
  );
}
