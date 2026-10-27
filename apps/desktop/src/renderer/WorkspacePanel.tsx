import { useEffect, useRef, useState } from 'react';
import type { BackupReceipt, WorkspaceStatus } from '@autoreels/contracts';
import { api } from './api.js';
import { Dialog } from './components.js';

const newBackupId = () => 'backup_' + crypto.randomUUID().replaceAll('-', '');
const bytes = (value: number) =>
  (value / 1024 / 1024).toLocaleString('vi', { maximumFractionDigits: 1 }) + ' MiB';
export function WorkspacePanel(props: { close: () => void; save: () => Promise<void> }) {
  const [status, setStatus] = useState<WorkspaceStatus | null>(null),
    [receipt, setReceipt] = useState<BackupReceipt | null>(null),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [message, setMessage] = useState('');
  const mounted = useRef(true),
    generation = useRef(0),
    backupId = useRef(newBackupId());
  async function load() {
    const at = ++generation.current;
    setLoading(true);
    setError('');
    try {
      const result = await api.workspaceStatus();
      if (mounted.current && generation.current === at) setStatus(result);
    } catch (e) {
      if (mounted.current && generation.current === at)
        setError(e instanceof Error ? e.message : 'Không kiểm tra được workspace.');
    } finally {
      if (mounted.current && generation.current === at) setLoading(false);
    }
  }
  useEffect(() => {
    mounted.current = true;
    void load();
    return () => {
      mounted.current = false;
      generation.current++;
    };
  }, []);
  async function backup() {
    if (receipt) {
      backupId.current = newBackupId();
      setReceipt(null);
    }
    setBusy(true);
    setError('');
    setMessage('Đang lưu thay đổi và kiểm tra bản sao lưu…');
    try {
      await props.save();
      const result = await api.createWorkspaceBackup(backupId.current);
      if (!mounted.current) return;
      setReceipt(result.receipt);
      setMessage(
        result.alreadyCreated
          ? 'Đã xác minh lại bản sao lưu đã có.'
          : 'Đã tạo và kiểm tra bản sao lưu.',
      );
      await load();
    } catch (e) {
      if (mounted.current) {
        setError(
          e instanceof Error ? e.message : 'Chưa nhận được kết quả; thử lại cùng ID sao lưu.',
        );
        setMessage('');
      }
    } finally {
      if (mounted.current) setBusy(false);
    }
  }
  function download() {
    if (!status) return;
    const url = URL.createObjectURL(
        new Blob([JSON.stringify(status, null, 2)], { type: 'application/json' }),
      ),
      anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'autoreels-diagnostics-' + status.observedAt.replaceAll(':', '-') + '.json';
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <Dialog
      title="Workspace · chẩn đoán và sao lưu"
      wide
      close={() => {
        if (!busy) props.close();
      }}
    >
      {error && <p role="alert">{error}</p>}
      {loading && <p role="status">Đang kiểm tra workspace…</p>}
      {status && (
        <>
          <p>
            Đo lúc {new Date(status.observedAt).toLocaleString('vi-VN')}. Thống kê bao gồm dữ liệu
            đã lưu trữ.
          </p>
          <table aria-label="Tình trạng workspace">
            <tbody>
              <tr>
                <th>Máy chạy</th>
                <td>
                  {status.host.platform} · {status.host.arch} · Node {status.host.node}
                  {status.host.electron ? ' · Electron ' + status.host.electron : ''}
                </td>
              </tr>
              <tr>
                <th>RAM tiến trình host</th>
                <td>{bytes(status.host.memoryRssBytes)}</td>
              </tr>
              <tr>
                <th>Đĩa chứa dữ liệu</th>
                <td>
                  {status.disk.status === 'READY'
                    ? `Trống ${bytes(status.disk.availableBytes)} / ${bytes(status.disk.capacityBytes)}`
                    : status.disk.reason}
                </td>
              </tr>
              <tr>
                <th>SQLite</th>
                <td>
                  Schema {status.database.schemaVersion} · quick check: {status.database.integrity}
                </td>
              </tr>
              <tr>
                <th>Dữ liệu</th>
                <td>
                  {status.database.counts.workflows} workflow · {status.database.counts.processes}{' '}
                  tiến trình · {status.database.counts.contentItems} nội dung
                </td>
              </tr>
              <tr>
                <th>Công việc</th>
                <td>
                  {status.database.counts.jobs} job · {status.database.counts.devices} điện thoại đã
                  đăng ký · {status.database.counts.pendingEffects} effect cần đối soát
                </td>
              </tr>
            </tbody>
          </table>
          <p className="muted">
            Báo cáo JSON chỉ chứa các số đo ở đây. Bạn chọn tệp và nơi chia sẻ sau khi tải về máy.
          </p>
        </>
      )}
      <div className="actions">
        <button disabled={loading || busy} onClick={() => void load()}>
          Kiểm tra lại workspace
        </button>
        <button disabled={!status || loading || busy} onClick={download}>
          Tải báo cáo chẩn đoán JSON
        </button>
      </div>
      <hr />
      <h3>Sao lưu cơ sở dữ liệu</h3>
      <p>
        Bản sao chứa dữ liệu và cấu hình riêng tư trong SQLite, lưu tại thư mục <code>backups</code>{' '}
        trong dữ liệu ứng dụng. Hãy giữ thêm bản sao media nguồn riêng.
      </p>
      <p className="muted">
        Thay đổi đang soạn được lưu trước. Mỗi bản sao có integrity/schema check và SHA-256; tệp gốc
        và các bản sao trước được giữ nguyên.
      </p>
      {message && <p role="status">{message}</p>}
      {receipt && (
        <div className="surface" aria-label="Receipt sao lưu">
          <p>
            <strong>{receipt.id}</strong> · {bytes(receipt.bytes)} · schema {receipt.schemaVersion}{' '}
            · integrity {receipt.integrity}
          </p>
          <p style={{ overflowWrap: 'anywhere' }}>
            SHA-256: <code>{receipt.sha256}</code>
          </p>
        </div>
      )}
      <div className="dialog-actions">
        <button
          disabled={busy || loading || status?.database.integrity !== 'ok'}
          onClick={() => void backup()}
        >
          {busy
            ? 'Đang sao lưu…'
            : receipt
              ? 'Tạo bản sao lưu khác'
              : 'Tạo bản sao lưu đã kiểm tra'}
        </button>
      </div>
    </Dialog>
  );
}
