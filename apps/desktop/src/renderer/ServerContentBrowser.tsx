import { useEffect, useRef, useState } from 'react';
import type { ContentPage, ContentQuery } from '@autoreels/contracts';
import { api } from './api.js';

interface Props {
  processId: string;
  notify: (message: string) => void;
}
const PAGE_SIZE = 50;

/**
 * Independent read-only server view. The authoring table remains full-scope:
 * do NOT reinterpret Select All, bulk edit or schedule as the current page.
 */
export function ServerContentBrowser({ processId, notify }: Props) {
  const [search, setSearch] = useState(''),
    [includeIgnored, setIncludeIgnored] = useState(false),
    [sortOrder, setSortOrder] = useState<'OLDEST_FIRST' | 'NEWEST_FIRST'>('OLDEST_FIRST'),
    [page, setPage] = useState<ContentPage | null>(null),
    [pageIndex, setPageIndex] = useState(0),
    [cursors, setCursors] = useState<(string | null)[]>([null]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const mounted = useRef(true),
    generation = useRef(0);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      generation.current++;
    };
  }, []);

  function clearQuery() {
    generation.current++;
    setPage(null);
    setPageIndex(0);
    setCursors([null]);
    setError('');
    setBusy(false);
  }

  async function load(cursor: string | null, index: number) {
    if (busy) return;
    const token = ++generation.current;
    const filter = search.trim();
    if (filter.length > 120) {
      setError('Từ khóa tìm kiếm vượt 120 ký tự.');
      setPage(null);
      return;
    }
    setBusy(true);
    setError('');
    const query: ContentQuery = {
      processId,
      limit: PAGE_SIZE,
      includeIgnored,
      sortOrder,
      ...(filter ? { search: filter } : {}),
      ...(cursor ? { cursor } : {}),
    };
    try {
      const result = await api.contentPage(query);
      if (!mounted.current || token !== generation.current) return;
      setPage(result);
      setPageIndex(index);
      setCursors((history) => {
        const next = history.slice(0, index);
        next.push(cursor);
        return next;
      });
    } catch (cause) {
      if (!mounted.current || token !== generation.current) return;
      setPage(null);
      setPageIndex(0);
      setCursors([null]);
      const reason = cause instanceof Error ? cause.message : 'Không tải được nội dung.';
      setError(reason);
      notify('Duyệt SQLite: ' + reason);
    } finally {
      if (mounted.current && token === generation.current) setBusy(false);
    }
  }

  return (
    <section className="surface" aria-label="Duyệt nội dung SQLite" data-testid="server-content-browser">
      <p className="muted">
        Duyệt nội dung từ SQLite theo trang, chỉ đọc. Không thay đổi chọn tất cả,
        sửa hàng loạt, xuất dữ liệu hoặc lập lịch ở bảng bên dưới.
      </p>
      <div className="actions">
        <label>
          Tìm trong SQLite{' '}
          <input
            aria-label="Tìm trong SQLite"
            value={search}
            maxLength={121}
            disabled={busy}
            onChange={(event) => {
              setSearch(event.target.value);
              clearQuery();
            }}
          />
        </label>
        <label>
          <input
            type="checkbox"
            checked={includeIgnored}
            disabled={busy}
            onChange={(event) => {
              setIncludeIgnored(event.target.checked);
              clearQuery();
            }}
          />{' '}
          Bao gồm nội dung đã bỏ qua
        </label>
        <label>
          Sắp xếp SQLite{' '}
          <select
            aria-label="Sắp xếp SQLite"
            value={sortOrder}
            disabled={busy}
            onChange={(event) => {
              const next = event.target.value;
              if (next !== 'OLDEST_FIRST' && next !== 'NEWEST_FIRST') return;
              setSortOrder(next);
              clearQuery();
            }}
          >
            <option value="OLDEST_FIRST">Cũ nhất trước</option>
            <option value="NEWEST_FIRST">Mới nhất trước</option>
          </select>
        </label>
        <button disabled={busy || search.trim().length > 120} onClick={() => void load(null, 0)}>
          Tải trang đầu từ SQLite
        </button>
      </div>
      {error && <p className="error" role="alert">{error} Hãy tải lại trang đầu để tiếp tục.</p>}
      {page && (
        <>
          <p role="status">
            Tổng chính xác: {page.total} nội dung · Trang {pageIndex + 1} ·
            {page.items.length} bản ghi trên trang này (tối đa {PAGE_SIZE}).
          </p>
          {page.items.length ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Nội dung ID</th><th>Media</th><th>Dữ liệu (chỉ đọc)</th></tr>
                </thead>
                <tbody>
                  {page.items.map((item) => (
                    <tr key={item.id} data-testid="server-content-row">
                      <td><code>{item.id}</code>{item.ignored && <small> · Đã bỏ qua</small>}</td>
                      <td>{item.assetIds.length} asset</td>
                      <td>
                        <details>
                          <summary>Đọc trường dữ liệu</summary>
                          <pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
                            {JSON.stringify(item.fields, null, 2)}
                          </pre>
                        </details>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <p className="muted">Không có bản ghi phù hợp bộ lọc.</p>}
          <div className="actions">
            <button
              disabled={busy || pageIndex === 0}
              onClick={() => void load(cursors[pageIndex - 1] ?? null, pageIndex - 1)}
            >
              Trang trước (SQLite)
            </button>
            <button
              disabled={busy || !page.hasMore || !page.nextCursor}
              onClick={() => {
                if (page.nextCursor) void load(page.nextCursor, pageIndex + 1);
              }}
            >
              Trang tiếp theo (SQLite)
            </button>
          </div>
        </>
      )}
    </section>
  );
}
