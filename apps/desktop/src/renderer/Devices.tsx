import { useEffect, useRef, useState } from 'react';
import type {
  AppDefinition,
  DeviceCapture,
  DeviceRecord,
  DeviceSnapshot,
  DeviceResolutionPreview,
  ManualDeviceAction,
} from '@autoreels/contracts';
import { api } from './api.js';
import { Dialog, Empty } from './components.js';
import { Inspector } from './Inspector.js';

const transportLabels = {
  CONNECTED: 'Đã kết nối',
  UNAUTHORIZED: 'Chờ cấp quyền',
  OFFLINE: 'ADB offline',
  NO_PERMISSIONS: 'Thiếu quyền USB',
  DISCONNECTED: 'Chưa kết nối',
};
interface Props {
  apps: AppDefinition[];
  processCount: number;
  workflowCount: number;
  notify: (message: string) => void;
  snapshot: (value: DeviceSnapshot) => void;
  openProcesses: (deviceId: string) => void;
  createWorkflow: () => void;
}
export function Devices(props: Props) {
  const [data, setData] = useState<DeviceSnapshot | null>(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(''),
    [search, setSearch] = useState(''),
    [selected, setSelected] = useState<Set<string>>(new Set()),
    [active, setActive] = useState<string | null>(null),
    [inspectorId, setInspectorId] = useState<string | null>(null),
    [network, setNetwork] = useState(false),
    [endpoint, setEndpoint] = useState(''),
    [rememberEndpoint, setRememberEndpoint] = useState(true),
    [pairEndpoint, setPairEndpoint] = useState(''),
    [code, setCode] = useState(''),
    [tile, setTile] = useState<'SMALL' | 'NORMAL'>('NORMAL');
  const [pendingEnabled, setPendingEnabled] = useState<Map<string, boolean>>(new Map());
  const live = useRef(props),
    mounted = useRef(true),
    generation = useRef(0),
    working = useRef(false);
  live.current = props;
  const acceptedSequence = useRef(-1);
  const accept = (value: DeviceSnapshot): void => {
    if (value.sequence < acceptedSequence.current) return;
    acceptedSequence.current = value.sequence;
    setData((current) => (current && value.sequence < current.sequence ? current : value));
    live.current.snapshot(value);
  };
  useEffect(() => {
    mounted.current = true;
    let running = true,
      timer: ReturnType<typeof setTimeout>;
    const load = async () => {
      const token = ++generation.current;
      try {
        const value = await api.deviceSnapshot();
        if (running && token === generation.current) {
          accept(value);
          setError('');
        }
      } catch (e) {
        if (running) setError(e instanceof Error ? e.message : 'Không tải được thiết bị.');
      }
      if (running)
        timer = setTimeout(() => {
          void load();
        }, 2000);
    };
    void load();
    return () => {
      running = false;
      mounted.current = false;
      generation.current++;
      clearTimeout(timer);
    };
  }, []);
  async function run(label: string, task: () => Promise<DeviceSnapshot | void>): Promise<void> {
    if (working.current) return;
    working.current = true;
    setBusy(label);
    generation.current++;
    try {
      const result = await task();
      if (mounted.current) {
        if (result) accept(result);
        setError('');
      }
    } catch (e) {
      if (mounted.current)
        props.notify(e instanceof Error ? e.message : 'Thao tác thiết bị thất bại.');
    } finally {
      working.current = false;
      if (mounted.current) setBusy('');
    }
  }
  const filtered =
    data?.devices.filter((device) =>
      (
        device.name +
        ' ' +
        device.metadata?.model +
        ' ' +
        device.transports.map((t) => t.serial).join(' ')
      )
        .toLocaleLowerCase('vi')
        .includes(search.toLocaleLowerCase('vi')),
    ) ?? [];
  const inspectorDevice = data?.devices.find((d) => d.id === inspectorId) ?? null;
  const activeDevice = data?.devices.find((device) => device.id === active) ?? null;
  function changeEnabled(device: DeviceRecord, enabled: boolean): void {
    setPendingEnabled((previous) => new Map(previous).set(device.id, enabled));
    void run('ENABLE', () => api.updateDevice(device.id, device.revision, { enabled })).finally(
      () => {
        if (mounted.current)
          setPendingEnabled((previous) => {
            const next = new Map(previous);
            next.delete(device.id);
            return next;
          });
      },
    );
  }
  async function batchEnabled(enabled: boolean): Promise<DeviceSnapshot> {
    const scope = data!.devices.filter((device) => selected.has(device.id));
    let next = 0,
      succeeded = 0,
      failed = 0;
    await Promise.all(
      Array.from({ length: Math.min(4, scope.length) }, async () => {
        while (next < scope.length) {
          const device = scope[next++]!;
          try {
            await api.updateDevice(device.id, device.revision, { enabled });
            succeeded++;
          } catch {
            failed++;
          }
        }
      }),
    );
    props.notify(
      `Đã cập nhật ${succeeded}/${scope.length} thiết bị${failed ? `; ${failed} lỗi, tải lại để xem trạng thái` : ''}.`,
    );
    return api.deviceSnapshot();
  }
  return (
    <div className="page devices-page">
      <div className="page-heading">
        <div>
          <h1>Điện thoại</h1>
          <p>Kết nối USB/LAN, quyền điều khiển và tiến trình theo từng thiết bị.</p>
        </div>
        <div className="actions">
          <button
            disabled={!!busy}
            onClick={() => {
              void run('SCAN', () => api.scanDevices());
            }}
          >
            Quét thiết bị
          </button>
          {(busy === 'SCAN' || data?.scanning) && (
            <button
              onClick={() => {
                void api.cancelDeviceScan().catch((e) => props.notify(String(e)));
              }}
            >
              Hủy quét
            </button>
          )}
          <button
            className="primary"
            disabled={!!busy || data?.diagnostic.status !== 'READY'}
            onClick={() => setNetwork(true)}
          >
            ＋ Kết nối LAN
          </button>
        </div>
      </div>
      <div className="surface adb-diagnostic">
        <div>
          <strong>
            ADB ·{' '}
            {data?.diagnostic.status === 'READY'
              ? 'Sẵn sàng'
              : data?.diagnostic.status === 'SDK_MISSING'
                ? 'Chưa có SDK'
                : 'Kết nối và SDK'}
          </strong>
          <p>{error || data?.diagnostic.message || 'Đang đọc trạng thái host…'}</p>
          {data?.diagnostic.version && (
            <small className="muted">
              {data.diagnostic.version} · protocol {data.diagnostic.protocol ?? '—'} · cổng{' '}
              {data.diagnostic.serverPort}
              {data.diagnostic.ownedServer ? ' · server riêng' : ''}
            </small>
          )}
        </div>
        <div className="actions">
          <button
            disabled={!!busy || !data?.nativeSdkPicker}
            title={
              !data?.nativeSdkPicker ? 'Chọn adb/adb.exe bằng bản desktop trên host.' : undefined
            }
            onClick={() => {
              void run('SDK', async () => {
                const result = await api.chooseAdbSdk();
                return result.snapshot;
              });
            }}
          >
            Chọn SDK
          </button>
          {data?.diagnostic.status === 'SERVER_MISSING' && (
            <button
              disabled={!!busy}
              onClick={() => {
                void run('SERVER', () => api.startAdbServer());
              }}
            >
              Khởi động server riêng
            </button>
          )}
        </div>
      </div>
      <div className="metric-grid">
        <div>
          <span>Đã kết nối</span>
          <strong>{data?.devices.filter((d) => d.capabilities.connected).length ?? 0}</strong>
        </div>
        <div>
          <span>Đã đăng ký</span>
          <strong>{data?.devices.length ?? 0}</strong>
        </div>
        <div>
          <span>Tiến trình</span>
          <strong>{props.processCount}</strong>
        </div>
        <div>
          <span>Workflow</span>
          <strong>{props.workflowCount}</strong>
        </div>
      </div>
      <div className="device-toolbar">
        <input
          aria-label="Tìm điện thoại"
          placeholder="Tên, model, transport…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <label>
          <input
            type="checkbox"
            aria-label={'Chọn ' + filtered.length + ' thiết bị đang lọc'}
            checked={!!filtered.length && filtered.every((d) => selected.has(d.id))}
            onChange={(e) =>
              setSelected((previous) => {
                const next = new Set(previous);
                for (const device of filtered)
                  if (e.target.checked) next.add(device.id);
                  else next.delete(device.id);
                return next;
              })
            }
          />{' '}
          {selected.size} chọn
        </label>
        <button
          disabled={!!busy || !selected.size}
          onClick={() => {
            void run('ENABLE', () => batchEnabled(true));
          }}
        >
          Bật nhóm
        </button>
        <button
          disabled={!!busy || !selected.size}
          onClick={() => {
            void run('DISABLE', () => batchEnabled(false));
          }}
        >
          Tắt nhóm
        </button>
        <label>
          Cỡ thẻ
          <select
            aria-label="Cỡ thẻ điện thoại"
            value={tile}
            onChange={(e) => setTile(e.target.value as 'SMALL' | 'NORMAL')}
          >
            <option value="NORMAL">Vừa</option>
            <option value="SMALL">Nhỏ</option>
          </select>
        </label>
      </div>
      {!data ? (
        <p role="status">Đang tải thiết bị…</p>
      ) : !data.devices.length ? (
        <Empty
          icon="▯"
          title="Chưa có điện thoại kết nối"
          action={
            <button className="primary" onClick={props.createWorkflow}>
              ＋ Tạo workflow trước
            </button>
          }
        >
          USB: bật USB debugging, cài OEM driver khi cần và xác nhận RSA trên điện thoại. LAN: bật
          Wireless debugging rồi nhập đúng cổng ghép đôi/kết nối trên host đang cắm máy.
        </Empty>
      ) : !filtered.length ? (
        <Empty title="Không có thiết bị khớp bộ lọc">
          Đổi từ khóa để xem các thiết bị đã đăng ký.
        </Empty>
      ) : (
        <div className={'device-grid ' + (tile === 'SMALL' ? 'small' : '')}>
          {filtered.map((device) => (
            <article
              key={device.id}
              data-device-id={device.id}
              className={'surface device-card ' + (selected.has(device.id) ? 'selected' : '')}
            >
              <div className="device-card-heading">
                <label>
                  <input
                    type="checkbox"
                    aria-label={'Chọn thiết bị ' + device.id}
                    checked={selected.has(device.id)}
                    onChange={(e) =>
                      setSelected((previous) => {
                        const next = new Set(previous);
                        if (e.target.checked) next.add(device.id);
                        else next.delete(device.id);
                        return next;
                      })
                    }
                  />
                  <strong>{device.name}</strong>
                </label>
                <label>
                  <input
                    type="checkbox"
                    aria-label={'Bật thiết bị ' + device.id}
                    checked={pendingEnabled.get(device.id) ?? device.enabled}
                    disabled={!!busy}
                    onChange={(e) => changeEnabled(device, e.target.checked)}
                  />{' '}
                  Bật
                </label>
              </div>
              <p>
                {device.metadata?.manufacturer} {device.metadata?.model ?? 'Chưa có metadata'}
              </p>
              <div className="device-status-list">
                {device.transports.length ? (
                  device.transports.map((t) => (
                    <span
                      key={t.serial}
                      className={'badge ' + (t.state === 'CONNECTED' ? 'local' : '')}
                    >
                      {t.kind} · {transportLabels[t.state]}
                    </span>
                  ))
                ) : (
                  <span className="badge">Chưa kết nối trên host này</span>
                )}
              </div>
              <small className="muted">
                {device.owner
                  ? 'Đang được giữ bởi ' + device.owner.kind
                  : (device.capabilities.reasons[0] ?? 'Sẵn sàng thao tác thủ công')}
                {device.identity === 'CONFLICT' ? ' · Cần xử lý xung đột nhận diện' : ''}
              </small>
              <div className="actions">
                <button onClick={() => setActive(device.id)}>Chi tiết / điều khiển</button>
                <button
                  disabled={!device.capabilities.manualControl}
                  onClick={() => setInspectorId(device.id)}
                >
                  Inspector
                </button>
                <button onClick={() => props.openProcesses(device.id)}>Tiến trình</button>
              </div>
            </article>
          ))}
        </div>
      )}
      {inspectorDevice && (
        <Inspector
          key={inspectorDevice.id}
          device={inspectorDevice}
          close={() => setInspectorId(null)}
          notify={props.notify}
        />
      )}
      {activeDevice && (
        <DeviceDetails
          key={activeDevice.id}
          device={activeDevice}
          apps={props.apps}
          notify={props.notify}
          changed={accept}
          close={() => setActive(null)}
        />
      )}
      {network && (
        <Dialog
          title="Kết nối điện thoại qua LAN"
          close={() => {
            if (!busy) {
              setNetwork(false);
              setCode('');
            }
          }}
        >
          <p className="muted">
            Cổng ghép đôi và cổng kết nối có thể khác nhau. Mã chỉ dùng trong lần ghép đôi này.
          </p>
          <label className="field">
            Endpoint kết nối
            <input
              aria-label="Endpoint kết nối"
              value={endpoint}
              placeholder="192.168.1.20:37123"
              onChange={(e) => setEndpoint(e.target.value)}
            />
          </label>
          <label>
            <input
              type="checkbox"
              checked={rememberEndpoint}
              onChange={(e) => setRememberEndpoint(e.target.checked)}
            />{' '}
            Nhớ và tự kết nối lại
          </label>
          <button
            disabled={!!busy || !endpoint}
            onClick={() => {
              void run('CONNECT', () => api.connectDevice(endpoint, rememberEndpoint));
            }}
          >
            Kết nối endpoint
          </button>
          {!!data?.endpoints.length && (
            <details open>
              <summary>Endpoint đã lưu trên host này</summary>
              {data.endpoints.map((p) => (
                <div key={p.endpoint} className="device-endpoint">
                  <button onClick={() => setEndpoint(p.endpoint)}>{p.endpoint}</button>
                  <span className="muted">
                    {p.resolvedSerial && p.resolvedSerial !== p.endpoint
                      ? ' → ' + p.resolvedSerial
                      : ''}
                    {p.lastErrorCode ? ' · ' + p.lastErrorCode : ''}
                    {p.nextAttemptUtc
                      ? ' · Thử lại sau ' + new Date(p.nextAttemptUtc).toLocaleTimeString('vi-VN')
                      : ''}
                  </span>
                  <button
                    disabled={!!busy}
                    onClick={() => {
                      void run('RECONNECT', () =>
                        api.setDeviceReconnect(p.endpoint, p.revision, !p.desired),
                      );
                    }}
                  >
                    {p.desired ? 'Tắt tự kết nối' : 'Bật tự kết nối'}
                  </button>
                </div>
              ))}
            </details>
          )}
          <details className="wireless-pairing">
            <summary>Ghép đôi Wireless debugging</summary>
            <label className="field">
              Endpoint ghép đôi
              <input
                aria-label="Endpoint ghép đôi"
                value={pairEndpoint}
                placeholder="192.168.1.20:42000"
                onChange={(e) => setPairEndpoint(e.target.value)}
              />
            </label>
            <label className="field">
              Mã 6 chữ số
              <input
                aria-label="Mã ghép đôi"
                type="password"
                autoComplete="off"
                inputMode="numeric"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
            </label>
            <button
              disabled={!!busy || !pairEndpoint || !/^\d{6}$/.test(code)}
              onClick={() => {
                const current = code;
                setCode('');
                void run('PAIR', () => api.pairDevice(pairEndpoint, current));
              }}
            >
              Ghép đôi
            </button>
          </details>
          <div className="dialog-actions">
            <button
              disabled={!!busy}
              onClick={() => {
                setNetwork(false);
                setCode('');
              }}
            >
              Đóng
            </button>
          </div>
        </Dialog>
      )}
    </div>
  );
}
function DeviceDetails({
  device,
  apps,
  notify,
  changed,
  close,
}: {
  device: DeviceRecord;
  apps: AppDefinition[];
  notify: Props['notify'];
  changed: (data: DeviceSnapshot) => void;
  close: () => void;
}) {
  const [tab, setTab] = useState<'CONNECTION' | 'APPS' | 'NETWORK'>('CONNECTION'),
    [name, setName] = useState(device.name),
    [capture, setCapture] = useState<DeviceCapture | null>(null),
    [control, setControl] = useState(false),
    [busy, setBusy] = useState(false),
    [packages, setPackages] = useState<string[]>([]),
    [foreground, setForeground] = useState<string | null>(null),
    [packageFilter, setPackageFilter] = useState('');
  const [resolution, setResolution] = useState<DeviceResolutionPreview | null>(null),
    [resolutionName, setResolutionName] = useState(''),
    [physicallyChecked, setPhysicallyChecked] = useState(false);
  const alive = useRef(true),
    working = useRef(false),
    pointer = useRef<{ x: number; y: number; at: number } | null>(null);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => {
    setResolution(null);
    setResolutionName('');
    setPhysicallyChecked(false);
  }, [device.id, device.revision, device.identity]);
  async function task(operation: () => Promise<void>): Promise<void> {
    if (working.current) return;
    working.current = true;
    setBusy(true);
    try {
      await operation();
    } catch (e) {
      if (alive.current) notify(e instanceof Error ? e.message : 'Thao tác thiết bị thất bại.');
    } finally {
      working.current = false;
      if (alive.current) setBusy(false);
    }
  }
  async function takeCapture(): Promise<void> {
    const result = await api.captureDevice(device.id);
    if (alive.current) setCapture(result);
  }
  function action(value: ManualDeviceAction): void {
    void task(async () => {
      await api.deviceAction(device.id, value);
      if (!alive.current) return;
      setCapture(null);
      notify('Thiết bị đã ACK lệnh thủ công.');
      if (tab === 'APPS') {
        setForeground(null);
        try {
          const result = await api.devicePackages(device.id);
          if (alive.current) {
            setPackages(result.packages);
            setForeground(result.foreground);
          }
        } catch {
          notify('Lệnh đã được ACK; chưa đọc lại được trạng thái app.');
        }
      }
      if (tab === 'CONNECTION' && device.capabilities.screenshot)
        try {
          await takeCapture();
        } catch {
          notify('Lệnh đã được ACK; chưa chụp được ảnh mới.');
        }
    });
  }
  const managed = new Set(apps.flatMap((app) => app.packages)),
    coordinateReady =
      !!capture &&
      capture.rotation !== null &&
      capture.deviceRevision === device.revision &&
      Date.now() - Date.parse(capture.capturedAt) < 60000 &&
      device.capabilities.manualControl &&
      device.transports.some(
        (t) =>
          t.state === 'CONNECTED' &&
          t.serial === capture.transportSerial &&
          t.generation === capture.transportGeneration,
      );
  const point = (event: React.PointerEvent<HTMLImageElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: Math.max(
        0,
        Math.min(
          capture!.width - 1,
          Math.floor(
            ((event.clientX - rect.left - event.currentTarget.clientLeft) * capture!.width) /
              event.currentTarget.clientWidth,
          ),
        ),
      ),
      y: Math.max(
        0,
        Math.min(
          capture!.height - 1,
          Math.floor(
            ((event.clientY - rect.top - event.currentTarget.clientTop) * capture!.height) /
              event.currentTarget.clientHeight,
          ),
        ),
      ),
    };
  };
  return (
    <Dialog
      title={device.name}
      close={() => {
        if (!busy) close();
      }}
      wide
    >
      <div className="device-detail-tabs">
        {(
          [
            ['CONNECTION', 'Kết nối'],
            ['APPS', 'Ứng dụng'],
            ['NETWORK', 'Mạng'],
          ] as const
        ).map(([id, label]) => (
          <button key={id} className={tab === id ? 'primary' : ''} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </div>
      {tab === 'CONNECTION' && (
        <div className="device-detail-grid">
          <div>
            <label className="field">
              Tên thiết bị
              <input
                aria-label="Tên thiết bị"
                value={name}
                disabled={busy}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <button
              disabled={busy || !name.trim() || name === device.name}
              onClick={() => {
                void task(async () => {
                  const snapshot = await api.updateDevice(device.id, device.revision, { name });
                  if (alive.current) changed(snapshot);
                });
              }}
            >
              Lưu tên
            </button>
            <dl className="device-metadata">
              <dt>Model</dt>
              <dd>{device.metadata?.model ?? 'Chưa đọc được'}</dd>
              <dt>Android</dt>
              <dd>
                {device.metadata?.androidVersion ?? '—'} · SDK {device.metadata?.sdk ?? '—'}
              </dd>
              <dt>Locale</dt>
              <dd>{device.metadata?.locale || 'Chưa xác định'}</dd>
              <dt>Nhận diện</dt>
              <dd>{device.identity}</dd>
            </dl>
            {device.capabilities.reasons.map((reason) => (
              <p className="muted" key={reason}>
                {reason}
              </p>
            ))}
            {device.identity === 'CONFLICT' && (
              <section className="device-resolution" aria-label="Khôi phục nhận diện thiết bị">
                <strong>Thiết bị bị khóa do nhận diện ADB mâu thuẫn</strong>
                <p className="muted">
                  Chỉ khôi phục khi điện thoại thực đã kết nối trả lại fingerprint cũ và
                  bạn đã tự kiểm tra trên máy. Không thay thế/di chuyển lịch của thiết bị.
                </p>
                <button
                  disabled={busy}
                  onClick={() => {
                    void task(async () => {
                      const preview = await api.previewDeviceConflictResolution(
                        device.id, device.revision,
                      );
                      if (alive.current) {
                        setResolution(preview);
                        setResolutionName('');
                        setPhysicallyChecked(false);
                      }
                    });
                  }}
                >
                  Kiểm tra khả năng khôi phục
                </button>
                {resolution && (
                  <div className="device-resolution-preview">
                    {resolution.blockers.length > 0 && (
                      <p role="alert">Chưa thể khôi phục: {resolution.blockers.join(', ')}</p>
                    )}
                    {resolution.canApply && resolution.token && (
                      <>
                        <p>
                          ADB đã đối chiếu được fingerprint lịch sử. Điều này chưa thay
                          thế việc bạn xác nhận đúng điện thoại bằng mắt.
                        </p>
                        <p className="muted">
                          Phiếu hết hạn: {resolution.expiresAt
                            ? new Date(resolution.expiresAt).toLocaleTimeString('vi-VN')
                            : '—'}
                        </p>
                        <label className="field">
                          Nhập lại đúng tên thiết bị đã đăng ký: {resolution.name}
                          <input
                            aria-label="Tên thiết bị xác nhận"
                            value={resolutionName}
                            autoComplete="off"
                            onChange={(event) => setResolutionName(event.target.value)}
                          />
                        </label>
                        <label>
                          <input
                            aria-label="Tôi đã kiểm tra điện thoại thật"
                            type="checkbox"
                            checked={physicallyChecked}
                            onChange={(event) => setPhysicallyChecked(event.target.checked)}
                          />{' '}
                          Tôi đang cầm đúng điện thoại lịch sử và đồng ý kiểm tra lần cuối
                          trong hộp thoại desktop. Sau khi khôi phục, thiết bị sẽ TẮT.
                        </label>
                        <button
                          disabled={
                            busy ||
                            !physicallyChecked ||
                            resolutionName.normalize('NFC').trim() !==
                              resolution.name.normalize('NFC').trim() ||
                            resolution.expectedRevision !== device.revision
                          }
                          onClick={() => {
                            const token = resolution.token!;
                            void task(async () => {
                              const result = await api.applyDeviceConflictResolution(
                                device.id, token, resolutionName,
                              );
                              if (!alive.current) return;
                              changed(result.snapshot);
                              setResolution(null);
                              setResolutionName('');
                              setPhysicallyChecked(false);
                              notify(
                                result.cancelled
                                  ? 'Đã hủy xác nhận. Xung đột vẫn được khóa.'
                                  : 'Đã ghi audit khôi phục. Thiết bị đang TẮT; quét và chủ động bật lại sau khi kiểm tra.',
                              );
                            });
                          }}
                        >
                          Xác nhận khôi phục bằng Electron
                        </button>
                      </>
                    )}
                  </div>
                )}
              </section>
            )}
            <div className="quick-key-actions">
              {(['BACK', 'HOME', 'RECENT', 'POWER', 'VOLUME_UP', 'VOLUME_DOWN'] as const).map(
                (key, index) => (
                  <button
                    key={key}
                    disabled={busy || !device.capabilities.manualControl}
                    onClick={() => action({ type: 'KEY', key })}
                  >
                    {['Back', 'Home', 'Recent', 'Nguồn', 'Âm lượng +', 'Âm lượng −'][index]}
                  </button>
                ),
              )}
            </div>
            <details>
              <summary>Mở nhanh</summary>
              <div className="quick-key-actions">
                {(['SETTINGS', 'FILES', 'GALLERY', 'BROWSER', 'VPN'] as const).map(
                  (target, index) => (
                    <button
                      key={target}
                      disabled={busy || !device.capabilities.manualControl}
                      onClick={() => action({ type: 'SYSTEM', target })}
                    >
                      {['Cài đặt', 'Tệp', 'Gallery', 'Trình duyệt', 'VPN'][index]}
                    </button>
                  ),
                )}
              </div>
            </details>
          </div>
          <div className="device-capture-pane">
            <div className="actions">
              <button
                disabled={busy || !device.capabilities.screenshot}
                onClick={() => {
                  void task(takeCapture);
                }}
              >
                Chụp màn hình
              </button>
              <label>
                <input
                  type="checkbox"
                  aria-label="Cho phép thao tác trên ảnh"
                  checked={control}
                  disabled={busy || (!coordinateReady && !control)}
                  onChange={(e) => setControl(e.target.checked)}
                />{' '}
                Điều khiển trên ảnh
              </label>
            </div>
            {capture ? (
              <>
                <img
                  className={'device-capture ' + (control && coordinateReady ? 'interactive' : '')}
                  src={'data:image/png;base64,' + capture.data}
                  alt={'Ảnh chụp ' + device.name}
                  draggable={false}
                  onPointerDown={(event) => {
                    if (!control || busy || !coordinateReady || event.button !== 0) return;
                    event.currentTarget.setPointerCapture(event.pointerId);
                    pointer.current = { ...point(event), at: performance.now() };
                  }}
                  onPointerUp={(event) => {
                    const start = pointer.current;
                    pointer.current = null;
                    if (!start || !control || !coordinateReady || busy) return;
                    const end = point(event);
                    if (Math.hypot(end.x - start.x, end.y - start.y) < 8)
                      action({ type: 'TAP', captureId: capture.id, x: end.x, y: end.y });
                    else
                      action({
                        type: 'SWIPE',
                        captureId: capture.id,
                        x1: start.x,
                        y1: start.y,
                        x2: end.x,
                        y2: end.y,
                        durationMs: Math.max(
                          50,
                          Math.min(10000, Math.round(performance.now() - start.at)),
                        ),
                      });
                  }}
                  onPointerCancel={() => {
                    pointer.current = null;
                  }}
                  onContextMenu={(event) => {
                    event.preventDefault();
                    if (control && !busy) action({ type: 'KEY', key: 'BACK' });
                  }}
                />
                <small className="muted">
                  Ảnh chụp {new Date(capture.capturedAt).toLocaleTimeString('vi-VN')} ·{' '}
                  {capture.width}×{capture.height}. Nhấp để chạm, kéo để vuốt, chuột phải Back khi
                  bật điều khiển.
                </small>
              </>
            ) : (
              <Empty title="Chưa có ảnh chụp">
                Chụp từ thiết bị đang kết nối để xem và thao tác thủ công. Video stream được triển
                khai riêng.
              </Empty>
            )}
          </div>
        </div>
      )}
      {tab === 'APPS' && (
        <>
          <div className="device-toolbar">
            <input
              aria-label="Lọc package"
              value={packageFilter}
              onChange={(e) => setPackageFilter(e.target.value)}
              placeholder="Package…"
            />
            <button
              disabled={busy || !device.capabilities.manualControl}
              onClick={() => {
                void task(async () => {
                  const result = await api.devicePackages(device.id);
                  if (alive.current) {
                    setPackages(result.packages);
                    setForeground(result.foreground);
                  }
                });
              }}
            >
              Đọc ứng dụng
            </button>
          </div>
          <p className="muted">
            Foreground: {foreground ?? 'Chưa xác định'}. Mở/force-stop dùng các package đã đăng ký
            trong workspace.
          </p>
          <div className="table-wrap device-packages">
            <table>
              <thead>
                <tr>
                  <th>Package</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {packages
                  .filter((p) => p.toLowerCase().includes(packageFilter.toLowerCase()))
                  .map((packageName) => (
                    <tr key={packageName}>
                      <td>{packageName}</td>
                      <td>
                        <button
                          disabled={busy || !managed.has(packageName)}
                          onClick={() => action({ type: 'LAUNCH', packageName })}
                        >
                          Mở
                        </button>
                        <button
                          disabled={busy || !managed.has(packageName)}
                          onClick={() => action({ type: 'FORCE_STOP', packageName })}
                        >
                          Force-stop
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
            {!packages.length && (
              <p className="table-empty">Đọc danh sách từ thiết bị để xem package thực.</p>
            )}
          </div>
        </>
      )}
      {tab === 'NETWORK' && (
        <>
          <p>Transport của thiết bị trên host hiện tại:</p>
          {device.transports.map((t) => (
            <p key={t.serial}>
              <code>{t.serial}</code> · {t.kind} · {transportLabels[t.state]}
            </p>
          ))}
          <button
            disabled={
              busy || !device.transports.some((t) => t.kind === 'TCP' && t.state === 'CONNECTED')
            }
            onClick={() => {
              void task(async () => {
                const snapshot = await api.disconnectDevice(device.id);
                if (alive.current) changed(snapshot);
              });
            }}
          >
            Ngắt các transport LAN của thiết bị này
          </button>
          <p className="muted">
            Proxy/VPN routing và APK manager có providers riêng; nút VPN ở Mở nhanh chỉ mở màn cài
            đặt trên điện thoại.
          </p>
        </>
      )}
    </Dialog>
  );
}
