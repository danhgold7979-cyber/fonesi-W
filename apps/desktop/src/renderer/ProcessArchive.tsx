import { useEffect, useRef, useState } from 'react';
import type { ProcessDefinition } from '@autoreels/contracts';
import { api } from './api.js';
import { Dialog } from './components.js';

export function ProcessArchive(props: {
  current: ProcessDefinition | null;
  isNew: boolean;
  deviceScope: string | null;
  save: () => Promise<ProcessDefinition | null>;
  refresh: () => Promise<void>;
  archived: (id: string) => void;
  restored: (process: ProcessDefinition) => void;
  notify: (message: string) => void;
}) {
  const [confirm, setConfirm] = useState<ProcessDefinition | null>(null);
  const [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false);
  const [records, setRecords] = useState<ProcessDefinition[]>([]),
    [error, setError] = useState('');
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  async function prepare() {
    setBusy(true);
    try {
      const current = await props.save();
      if (mounted.current && current) setConfirm(current);
    } catch (error) {
      props.notify(error instanceof Error ? error.message : 'Chưa thể lưu trữ.');
    } finally {
      if (mounted.current) setBusy(false);
    }
  }
  async function list() {
    setOpen(true);
    setBusy(true);
    setError('');
    setRecords([]);
    try {
      const all = await api.listProcesses(true);
      if (mounted.current)
        setRecords(
          all.filter((p) => p.archived && (!props.deviceScope || p.deviceId === props.deviceScope)),
        );
    } catch (error) {
      if (mounted.current)
        setError(error instanceof Error ? error.message : 'Không tải được kho lưu trữ.');
    } finally {
      if (mounted.current) setBusy(false);
    }
  }
  async function update(process: ProcessDefinition, archived: boolean) {
    setBusy(true);
    setError('');
    try {
      const updated = await api.saveProcess({ ...process, archived }, process.revision);
      await props.refresh();
      if (!mounted.current) return;
      if (archived) {
        props.archived(updated.id);
        setConfirm(null);
      } else {
        props.restored(updated);
        setOpen(false);
      }
      props.notify(
        archived
          ? 'Đã lưu trữ tiến trình; dữ liệu và lịch sử được giữ nguyên.'
          : 'Đã khôi phục tiến trình.',
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Không cập nhật được tiến trình.';
      if (mounted.current) {
        setError(message);
        props.notify(message);
      }
    } finally {
      if (mounted.current) setBusy(false);
    }
  }
  return (
    <>
      <button disabled={busy || !props.current || props.isNew} onClick={() => void prepare()}>
        Lưu trữ tiến trình
      </button>
      <button disabled={busy} onClick={() => void list()}>
        Kho lưu trữ tiến trình
      </button>
      {confirm && (
        <Dialog
          title="Lưu trữ tiến trình"
          close={() => {
            if (!busy) setConfirm(null);
          }}
        >
          <p>
            Lưu trữ <strong>{confirm.name}</strong>?
          </p>
          <p>
            Tiến trình sẽ ngừng nhận lượt chạy mới. Dữ liệu, tệp nguồn, lịch và lịch sử được giữ
            nguyên. Thao tác này không hủy hoặc chạy lại công việc đang thực thi. Có thể khôi phục
            từ kho lưu trữ.
          </p>
          {error && <p role="alert">{error}</p>}
          <div className="dialog-actions">
            <button disabled={busy} onClick={() => setConfirm(null)}>
              Giữ tiến trình
            </button>
            <button disabled={busy} onClick={() => void update(confirm, true)}>
              Xác nhận lưu trữ
            </button>
          </div>
        </Dialog>
      )}
      {open && (
        <Dialog
          title="Kho lưu trữ tiến trình"
          close={() => {
            if (!busy) setOpen(false);
          }}
        >
          {busy ? (
            <p role="status">Đang xử lý…</p>
          ) : error ? (
            <p role="alert">{error}</p>
          ) : !records.length ? (
            <p>Không có tiến trình lưu trữ trong phạm vi này.</p>
          ) : (
            records.map((process) => (
              <div key={process.id} className="section-heading">
                <span>{process.name}</span>
                <button
                  disabled={busy}
                  aria-label={'Khôi phục ' + process.name}
                  onClick={() => void update(process, false)}
                >
                  Khôi phục
                </button>
              </div>
            ))
          )}
        </Dialog>
      )}
    </>
  );
}
