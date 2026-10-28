import { useEffect, useState } from 'react';
import type { JobPreflightReport } from '@autoreels/contracts';
import { api } from './api.js';
import { Dialog } from './components.js';

interface Props {
  jobId: string;
  close: () => void;
}

/** Persisted facts only. Never enables an execution or Android action. */
export function JobPreflightDialog({ jobId, close }: Props) {
  const [report, setReport] = useState<JobPreflightReport | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let current = true;
    setReport(null);
    setError('');
    void api.jobPreflight(jobId)
      .then((result) => {
        if (current) setReport(result);
      })
      .catch((cause: unknown) => {
        if (current)
          setError(cause instanceof Error ? cause.message : 'Không thể kiểm tra công việc.');
      });
    return () => { current = false; };
  }, [jobId]);
  return (
    <Dialog title="Điều kiện thực thi (chỉ đọc)" close={close}>
      <p>Job: <code>{jobId}</code></p>
      {error && <p className="error" role="alert">{error}</p>}
      {!report && !error && <p role="status">Đang đọc dữ liệu công việc…</p>}
      {report && (
        <section aria-label="Kết quả kiểm tra điều kiện">
          <p role="status">
            {report.status === 'NEEDS_REVIEW' ? 'Cần đối soát' : 'Chưa được phép thực thi'} ·
            dữ liệu đã lưu · revision {report.jobRevision}
          </p>
          <p className="muted">
            Chưa kiểm tra điện thoại trực tiếp. Kết quả này không cho phép chạy workflow hoặc đăng bài.
          </p>
          <ul>
            {report.blockers.map((item) => (
              <li key={item.code}>
                <code>{item.code}</code> — {item.message}
              </li>
            ))}
          </ul>
        </section>
      )}
    </Dialog>
  );
}
