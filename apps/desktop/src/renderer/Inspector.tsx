import { useEffect, useMemo, useRef, useState } from 'react';
import type { DeviceRecord, InspectorSnapshot, UiElement, DeviceSelectorLiveReport } from '@autoreels/contracts';
import { pickUiElement, inspectUiSelectorMatches, suggestUiSelector } from '@autoreels/contracts';
import { api } from './api.js';
import { Dialog, Empty } from './components.js';
export function Inspector({
  device,
  close,
  notify,
}: {
  device: DeviceRecord;
  close: () => void;
  notify: (message: string) => void;
}) {
  const [snapshot, setSnapshot] = useState<InspectorSnapshot | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [search, setSearch] = useState(''),
    [selected, setSelected] = useState<string | null>(null),
    [selector, setSelector] = useState(''),
    [liveProbe, setLiveProbe] = useState<DeviceSelectorLiveReport | null>(null),
    [now, setNow] = useState(Date.now());
  const alive = useRef(true),
    pending = useRef(false),
    probeRevision = useRef(0);
  useEffect(() => {
    alive.current = true;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      alive.current = false;
      clearInterval(timer);
    };
  }, []);
  const query = useMemo(() => {
    if (!snapshot || !selector.trim())
      return { nodes: [], error: '', strategyIndex: null, totalStrategies: 0, ambiguous: false };
    try {
      return { ...inspectUiSelectorMatches(snapshot.nodes, JSON.parse(selector)), error: '' };
    } catch {
      return {
        nodes: [],
        strategyIndex: null,
        totalStrategies: 0,
        ambiguous: false,
        error: 'Selector JSON không hợp lệ. Dùng version:1/all hoặc version:2/strategies với các predicate cho phép.',
      };
    }
  }, [snapshot, selector]);
  const chosen = snapshot?.nodes.find((n) => n.id === selected) ?? null;
  const filtered =
    snapshot?.nodes.filter((n) =>
      (n.resourceId + ' ' + n.text + ' ' + n.description + ' ' + n.className + ' ' + n.packageName)
        .toLocaleLowerCase('vi')
        .includes(search.toLocaleLowerCase('vi')),
    ) ?? [];
  const stale =
    !!snapshot &&
    (now - Date.parse(snapshot.capture.capturedAt) > 60000 ||
      snapshot.capture.deviceRevision !== device.revision ||
      !device.transports.some(
        (t) =>
          t.serial === snapshot.capture.transportSerial &&
          t.generation === snapshot.capture.transportGeneration &&
          t.state === 'CONNECTED',
      ));
  function choose(node: UiElement | null) {
    probeRevision.current++;
    setLiveProbe(null);
    setSelected(node?.id ?? null);
    if (node) setSelector(JSON.stringify(suggestUiSelector(node), null, 2));
  }
  async function refresh() {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError('');
    setSnapshot(null);
    setSelected(null);
    setSelector('');
    probeRevision.current++;
    setLiveProbe(null);
    try {
      const result = await api.inspectDevice(device.id);
      if (alive.current) setSnapshot(result);
    } catch (e) {
      if (alive.current) setError(e instanceof Error ? e.message : 'Không đọc được giao diện.');
    } finally {
      pending.current = false;
      if (alive.current) setBusy(false);
    }
  }
  async function testLiveSelector() {
    if (pending.current || !selector || !!query.error || stale) return;
    const generation = ++probeRevision.current;
    pending.current = true;
    setBusy(true);
    setError('');
    setLiveProbe(null);
    try {
      const raw: unknown = JSON.parse(selector);
      const result = await api.testDeviceSelector(device.id, raw);
      if (alive.current && generation === probeRevision.current)
        setLiveProbe(result);
    } catch (error) {
      if (alive.current && generation === probeRevision.current)
        setError(error instanceof Error ? error.message : 'Không kiểm tra được selector trên điện thoại.');
    } finally {
      pending.current = false;
      if (alive.current) setBusy(false);
    }
  }
  return (
    <Dialog
      wide
      title={'Inspector · ' + device.name}
      close={() => {
        if (!busy) close();
      }}
    >
      <div className="device-toolbar">
        <button
          className="primary"
          disabled={busy || !device.capabilities.manualControl}
          onClick={() => {
            void refresh();
          }}
        >
          {busy ? 'Đang đọc giao diện…' : 'Chụp cây và ảnh'}
        </button>
        <span className="muted">Chọn phần tử để xem; thao tác này không gửi touch.</span>
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {!snapshot ? (
        <Empty title={busy ? 'Đang tạo snapshot' : 'Chưa có snapshot'}>
          Đọc cây UI và ảnh từ đúng điện thoại. Màn hình bảo mật hoặc app không cung cấp
          accessibility có thể không đọc được.
        </Empty>
      ) : (
        <>
          <p className={'badge ' + (stale ? '' : 'local')}>
            {stale ? 'Snapshot cũ — chụp lại trước khi dùng' : 'Snapshot đóng băng'} ·{' '}
            {snapshot.capture.width}×{snapshot.capture.height} · xoay {snapshot.capture.rotation} ·{' '}
            {snapshot.durationMs} ms · {snapshot.nodes.length} phần tử
          </p>
          <p className="muted">
            {snapshot.foreground ?? 'Chưa xác định foreground'} ·{' '}
            {new Date(snapshot.capture.capturedAt).toLocaleTimeString('vi-VN')}. Ảnh và cây đọc tuần
            tự; chuyển động trong app có thể gây lệch.
          </p>
          <div className="inspector-snapshot-grid">
            <div className="inspector-image-pane">
              <div className="inspector-image-wrap">
                <img
                  className="device-capture interactive"
                  src={'data:image/png;base64,' + snapshot.capture.data}
                  alt={'Inspector ' + device.name}
                  draggable={false}
                  onClick={(event) => {
                    const rect = event.currentTarget.getBoundingClientRect();
                    choose(
                      pickUiElement(
                        snapshot.nodes,
                        ((event.clientX - rect.left) * snapshot.capture.width) / rect.width,
                        ((event.clientY - rect.top) * snapshot.capture.height) / rect.height,
                      ),
                    );
                  }}
                />
                <svg
                  className="inspector-bounds"
                  viewBox={`0 0 ${snapshot.capture.width} ${snapshot.capture.height}`}
                  aria-hidden="true"
                >
                  {query.nodes.slice(0, 200).map((n) => (
                    <rect
                      key={n.id}
                      x={n.bounds.left}
                      y={n.bounds.top}
                      width={n.bounds.right - n.bounds.left}
                      height={n.bounds.bottom - n.bounds.top}
                      className={n.id === selected ? 'chosen' : ''}
                    />
                  ))}
                </svg>
              </div>
            </div>
            <div className="inspector-tree-pane">
              <input
                aria-label="Tìm phần tử UI"
                placeholder="Tìm text, resource-id, package…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <div role="list" aria-label="Cây giao diện" className="inspector-tree">
                {filtered.slice(0, 200).map((n) => (
                  <button
                    role="listitem"
                    key={n.id}
                    aria-pressed={n.id === selected}
                    style={{ paddingLeft: 8 + Math.min(n.depth, 8) * 10 }}
                    onClick={() => choose(n)}
                  >
                    <strong>{n.resourceId || n.className || n.id}</strong>
                    <small>
                      {n.password
                        ? '[Nội dung mật khẩu được ẩn]'
                        : n.text || n.description || 'Không có nhãn'}{' '}
                      · {n.bounds.left},{n.bounds.top} → {n.bounds.right},{n.bounds.bottom}
                    </small>
                  </button>
                ))}
              </div>
              <small className="muted">
                {filtered.length} kết quả · hiển thị tối đa 200, thu hẹp tìm kiếm để xem tiếp.
              </small>
              {chosen && (
                <p className="muted">
                  {chosen.id} · cha {chosen.parentId ?? 'hierarchy'} ·{' '}
                  {chosen.clickable ? 'clickable' : 'không clickable'} ·{' '}
                  {chosen.enabled ? 'enabled' : 'disabled'}
                </p>
              )}
              <label className="field">
                Selector JSON
                <textarea
                  aria-label="Selector JSON"
                  rows={6}
                  value={selector}
                  onChange={(e) => {
                    probeRevision.current++;
                    setLiveProbe(null);
                    setSelector(e.target.value);
                  }}
                />
              </label>
              {query.error ? (
                <p role="alert" className="error">
                  {query.error}
                </p>
              ) : (
                <p role="status">
                  {query.nodes.length} phần tử khớp
                  {query.totalStrategies > 1 && query.strategyIndex
                    ? ' · chiến lược ' + query.strategyIndex + '/' + query.totalStrategies
                    : ''}
                  {query.totalStrategies > 1 && !query.strategyIndex
                    ? ' · đã thử ' + query.totalStrategies + ' fallback'
                    : ''}
                  {query.nodes.length > 1
                    ? ' — chưa duy nhất'
                    : query.nodes.length === 0
                      ? ' — không có phần tử khớp'
                      : ''}
                </p>
              )}
              <div className="inspector-live-probe">
                <button
                  disabled={busy || stale || !snapshot || !selector || !!query.error || !device.capabilities.manualControl}
                  onClick={() => void testLiveSelector()}
                >
                  Kiểm tra selector trực tiếp trên điện thoại
                </button>
                <p className="muted">
                  Kiểm tra ADB/XML mới trên điện thoại, không chạm hoặc tự chọn phần tử.
                  Kết quả snapshot bên trên có thể đã cũ.
                </p>
                {liveProbe && (
                  <p role="status" aria-label="Kết quả selector trực tiếp">
                    {liveProbe.totalMatches} phần tử khớp trực tiếp ·{' '}
                    {liveProbe.status === 'UNIQUE'
                      ? 'duy nhất'
                      : liveProbe.status === 'AMBIGUOUS'
                        ? 'không duy nhất — không tự chọn'
                        : 'không tìm thấy'}
                    {liveProbe.strategyIndex
                      ? ' · chiến lược ' + liveProbe.strategyIndex + '/' + liveProbe.totalStrategies
                      : ''}
                    {' · '}
                    {new Date(liveProbe.observedAt).toLocaleTimeString('vi-VN')}
                    {' · '}correlation: {liveProbe.correlation}
                    {liveProbe.truncated && ' · chỉ xem 100 vùng hình học đầu tiên'}
                  </p>
                )}
              </div>
              <button
                disabled={!selector || !!query.error}
                onClick={() => {
                  void navigator.clipboard.writeText(selector).then(
                    () => notify('Đã sao chép selector.'),
                    () => notify('Không truy cập được clipboard. Chọn và sao chép từ ô selector.'),
                  );
                }}
              >
                Sao chép selector
              </button>
            </div>
          </div>
        </>
      )}
    </Dialog>
  );
}
