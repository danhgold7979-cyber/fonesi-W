import { useEffect, useRef, useState } from 'react';
import type { DeviceSnapshot } from '@autoreels/contracts';
import { api } from './api.js';
import { Inspector } from './Inspector.js';
export function EditorDevicePanel({ notify }: { notify: (message: string) => void }) {
  const [snapshot, setSnapshot] = useState<DeviceSnapshot | null>(null),
    [deviceId, setDeviceId] = useState(''),
    [inspector, setInspector] = useState(false),
    [consent, setConsent] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const alive = useRef(true),
    working = useRef(false),
    sequence = useRef(-1);
  useEffect(() => {
    alive.current = true;
    let running = true,
      timer: ReturnType<typeof setTimeout>;
    const load = async () => {
      try {
        const value = await api.deviceSnapshot();
        if (running && value.sequence >= sequence.current) {
          sequence.current = value.sequence;
          setSnapshot(value);
          setError('');
        }
      } catch {
        if (running) setError('Chưa đọc được thiết bị trên host.');
      }
      if (running)
        timer = setTimeout(() => {
          void load();
        }, 3000);
    };
    void load();
    return () => {
      running = false;
      alive.current = false;
      clearTimeout(timer);
    };
  }, []);
  const device = snapshot?.devices.find((d) => d.id === deviceId) ?? null;
  async function key(value: 'BACK' | 'HOME' | 'RECENT') {
    if (!device?.capabilities.manualControl || !consent || working.current) return;
    working.current = true;
    setBusy(true);
    try {
      await api.deviceAction(device.id, { type: 'KEY', key: value });
      if (alive.current) notify('Điện thoại đã ACK phím.');
    } catch (e) {
      if (alive.current) notify(e instanceof Error ? e.message : 'Lệnh phím thất bại.');
    } finally {
      working.current = false;
      if (alive.current) setBusy(false);
    }
  }
  return (
    <>
      <select
        aria-label="Điện thoại kiểm thử"
        value={deviceId}
        disabled={busy}
        onChange={(e) => {
          setDeviceId(e.target.value);
          setConsent(false);
        }}
      >
        <option value="">Chọn điện thoại kiểm thử</option>
        {snapshot?.devices.map((d) => (
          <option key={d.id} value={d.id}>
            {d.name}
            {d.capabilities.manualControl ? '' : ' · chưa sẵn sàng'}
          </option>
        ))}
      </select>
      <div className="phone-placeholder">
        <span>▯</span>
        <strong>{device?.name ?? 'Chưa chọn điện thoại'}</strong>
        <p>
          {error ||
            device?.capabilities.reasons.join(' ') ||
            'Thiết bị kiểm thử độc lập với tiến trình. Inspector dùng snapshot đọc từ điện thoại.'}
        </p>
        <button
          disabled={busy || !device?.capabilities.manualControl}
          onClick={() => setInspector(true)}
        >
          Chọn phần tử / Inspector
        </button>
      </div>
      <label className="muted">
        <input
          type="checkbox"
          checked={consent}
          disabled={busy || !device?.capabilities.manualControl}
          onChange={(e) => setConsent(e.target.checked)}
        />{' '}
        Cho phép phím thủ công
      </label>
      <div className="phone-quick">
        {(['BACK', 'HOME', 'RECENT'] as const).map((value, i) => (
          <button
            key={value}
            aria-label={'Điện thoại ' + value}
            disabled={busy || !consent || !device?.capabilities.manualControl}
            onClick={() => {
              void key(value);
            }}
          >
            {['←', '⌂', '▢'][i]}
          </button>
        ))}
      </div>
      <small className="muted">Inspector đọc cây và ảnh. Video stream chưa khả dụng.</small>
      {inspector && device && (
        <Inspector
          key={device.id}
          device={device}
          close={() => setInspector(false)}
          notify={notify}
        />
      )}
    </>
  );
}
