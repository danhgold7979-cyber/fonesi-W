import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import type {
  BootstrapData,
  WorkflowDraft,
  WorkflowSummary,
  JsonValue,
} from '@autoreels/contracts';
import { api } from './api.js';
import { Dialog, Empty } from './components.js';
import { Processes } from './Processes.js';
import { Schedule } from './Schedule.js';
const Editor = lazy(() => import('./Editor.js').then((module) => ({ default: module.Editor })));

const routes = [
  { id: 'devices', name: 'Điện thoại', icon: '▦' },
  { id: 'inspector', name: 'Inspector', icon: '⌘' },
  { id: 'processes', name: 'Tiến trình', icon: '☷' },
  { id: 'library', name: 'Thư viện', icon: '◇' },
  { id: 'schedule', name: 'Lịch đăng', icon: '▣' },
  { id: 'history', name: 'Lịch sử', icon: '◷' },
] as const;
type View = (typeof routes)[number]['id'];
export function App() {
  const [boot, setBoot] = useState<BootstrapData | null>(null),
    [failure, setFailure] = useState(''),
    [view, setView] = useState<View>('devices');
  const [active, setActive] = useState<WorkflowDraft | null>(null),
    [libraryApp, setLibraryApp] = useState('all'),
    [filter, setFilter] = useState('');
  const [modal, setModal] = useState<null | 'create' | 'app' | 'help' | 'archive' | 'palette'>(
      null,
    ),
    [toast, setToast] = useState('');
  const [workflowName, setWorkflowName] = useState(''),
    [workflowApp, setWorkflowApp] = useState('fb'),
    [appName, setAppName] = useState(''),
    [appPackage, setAppPackage] = useState('');
  const [archive, setArchive] = useState<WorkflowSummary | null>(null),
    [busy, setBusy] = useState(false),
    [theme, setTheme] = useState('light');
  const saveAction = useRef<(() => Promise<unknown>) | null>(null),
    fileInput = useRef<HTMLInputElement>(null),
    openGeneration = useRef(0);
  const notify = useCallback((message: string) => setToast(message), []);
  const registerSave = useCallback((save: (() => Promise<unknown>) | null) => {
    saveAction.current = save;
  }, []);
  const refresh = useCallback(async () => {
    const data = await api.bootstrap();
    setBoot(data);
    const pref = data.preferences?.value;
    if (pref && typeof pref === 'object' && !Array.isArray(pref) && typeof pref.theme === 'string')
      setTheme(pref.theme);
    return data;
  }, []);
  useEffect(() => {
    void refresh().catch((e) =>
      setFailure(e instanceof Error ? e.message : 'Không thể mở workspace.'),
    );
  }, [refresh]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 6000);
    return () => clearTimeout(t);
  }, [toast]);
  const navigation = useRef<(next: View) => Promise<void>>(async () => undefined);
  async function go(next: View) {
    try {
      if (view !== next && saveAction.current) await saveAction.current();
      setView(next);
      setModal(null);
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Chưa lưu được thay đổi.');
    }
  }
  navigation.current = go;
  const currentView = useRef(view);
  currentView.current = view;
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (document.querySelector('[role="dialog"]')) {
        if (e.ctrlKey && e.key.toLowerCase() === 's') e.preventDefault();
        return;
      }
      if (e.ctrlKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (saveAction.current)
          void saveAction
            .current()
            .catch((error) => notify(error instanceof Error ? error.message : 'Lưu lỗi.'));
      }
      if (e.ctrlKey && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (currentView.current === 'inspector') window.dispatchEvent(new Event('studio:palette'));
        else setModal('palette');
      }
      if (e.key === 'F1') {
        e.preventDefault();
        setModal('help');
      }
      if (e.altKey && /^[1-6]$/.test(e.key)) {
        e.preventDefault();
        void navigation.current(routes[Number(e.key) - 1]!.id);
      }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [notify]);
  async function open(id: string) {
    try {
      if (saveAction.current) await saveAction.current();
      const generation = ++openGeneration.current,
        draft = await api.loadWorkflow(id);
      if (generation !== openGeneration.current) return;
      setActive(draft);
      setView('inspector');
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Không thể mở workflow.');
    }
  }
  async function createWorkflow() {
    setBusy(true);
    try {
      const draft = await api.createWorkflow(workflowApp, workflowName);
      setActive(draft);
      setView('inspector');
      setModal(null);
      setWorkflowName('');
      await refresh();
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Tạo workflow thất bại.');
    } finally {
      setBusy(false);
    }
  }
  async function toggleTheme() {
    if (!boot) return;
    const next = theme === 'light' ? 'dark' : 'light',
      old = boot.preferences?.value;
    const value: JsonValue = {
      ...(old && typeof old === 'object' && !Array.isArray(old) ? old : {}),
      theme: next,
    };
    try {
      const result = await api.savePreference(value, boot.preferences?.revision ?? 0);
      setTheme(next);
      setBoot((b) => (b ? { ...b, preferences: result } : b));
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Không thể lưu giao diện.');
    }
  }
  if (!boot)
    return (
      <div className="startup">
        <span className="brand-logo">a</span>
        <h1>AutoReels Studio</h1>
        <p>{failure || 'Đang mở workspace cục bộ…'}</p>
        {failure && (
          <button
            onClick={() => {
              setFailure('');
              void refresh().catch((e) => setFailure(String(e)));
            }}
          >
            Thử lại
          </button>
        )}
      </div>
    );
  const library = boot.workflows.filter(
    (w) =>
      (libraryApp === 'all' || w.appId === libraryApp) &&
      w.name.toLocaleLowerCase('vi').includes(filter.toLocaleLowerCase('vi')),
  );
  return (
    <div
      className={'app-shell ' + (view === 'inspector' && active ? 'editor-active' : '')}
      data-theme={theme}
    >
      <aside className="rail">
        <span className="brand-logo">a</span>
        <nav>
          {routes.map((r) => (
            <button
              key={r.id}
              data-route={r.id}
              className={view === r.id ? 'active' : ''}
              title={r.name + ' · Alt+' + (routes.indexOf(r) + 1)}
              onClick={() => void go(r.id)}
            >
              <span>{r.icon}</span>
              <small>{r.name}</small>
            </button>
          ))}
        </nav>
        <div className="rail-bottom">
          <button
            aria-label="Đổi giao diện sáng tối"
            title="Giao diện sáng/tối"
            onClick={() => void toggleTheme()}
          >
            ☼
          </button>
          <button
            aria-label="Hướng dẫn thao tác"
            title="Trợ giúp · F1"
            onClick={() => setModal('help')}
          >
            ?
          </button>
        </div>
      </aside>
      <header className="app-header">
        <div>
          <strong>
            AutoReels <span>Studio</span>
          </strong>
          <i>/</i>
          <span>{routes.find((r) => r.id === view)?.name}</span>
        </div>
        <div className="header-right">
          <button
            className="command-button"
            onClick={() => {
              if (view === 'inspector') window.dispatchEvent(new Event('studio:palette'));
              else setModal('palette');
            }}
          >
            ⌕ Tìm lệnh <kbd>Ctrl K</kbd>
          </button>
          <span className="badge local">● Lưu cục bộ</span>
          <small className="muted">Android chưa kết nối</small>
        </div>
      </header>
      <main className="app-main">
        {view === 'devices' && (
          <div className="page">
            <div className="page-heading">
              <div>
                <h1>Điện thoại</h1>
                <p>Quản lý kết nối và các tiến trình trên thiết bị.</p>
              </div>
              <button disabled title={boot.hardware.reason}>
                ＋ Kết nối điện thoại
              </button>
            </div>
            <div className="metric-grid">
              <div>
                <span>Đã đăng ký</span>
                <strong>{boot.devices.length}</strong>
              </div>
              <div>
                <span>Tiến trình</span>
                <strong>{boot.processes.length}</strong>
              </div>
              <div>
                <span>Workflow</span>
                <strong>{boot.workflows.length}</strong>
              </div>
            </div>
            <Empty
              icon="▯"
              title="Chưa có điện thoại kết nối"
              action={
                <button
                  className="primary"
                  onClick={() => {
                    setWorkflowApp(libraryApp === 'all' ? 'fb' : libraryApp);
                    setModal('create');
                  }}
                >
                  ＋ Tạo workflow trước
                </button>
              }
            >
              Bạn có thể thiết kế và lưu workflow trước khi kết nối điện thoại. Điều khiển thiết bị
              chưa có trong phiên bản này.
            </Empty>
            <div className="notice">
              Workflow dùng chung nhiều máy. Mỗi tiến trình giữ dữ liệu và lịch riêng; thiết bị kiểm
              thử được chọn độc lập.
            </div>
          </div>
        )}
        {view === 'inspector' &&
          (active ? (
            <Suspense
              fallback={<Empty title="Đang mở editor">Đang tải thư viện node và canvas…</Empty>}
            >
              <Editor
                key={active.workflowId}
                initial={active}
                apps={boot.apps}
                notify={notify}
                saved={(d) => {
                  setActive(d);
                  void refresh().catch((e) => notify(String(e)));
                }}
                registerSave={registerSave}
                clone={(id) => {
                  void api
                    .cloneWorkflow(id)
                    .then(async (d) => {
                      setActive(d);
                      await refresh();
                    })
                    .catch((e) => notify(String(e)));
                }}
              />
            </Suspense>
          ) : (
            <Empty
              title="Chọn hoặc tạo workflow"
              action={
                <button className="primary" onClick={() => void go('library')}>
                  Mở thư viện workflow
                </button>
              }
            >
              Workflow dùng chung cho nhiều điện thoại. Bạn có thể bắt đầu mà chưa cần thiết bị.
            </Empty>
          ))}
        {view === 'library' && (
          <div className="page">
            <div className="page-heading">
              <div>
                <h1>Thư viện workflow</h1>
                <p>Thiết kế một lần, liên kết với nhiều tiến trình và thiết bị.</p>
              </div>
              <div className="actions">
                <button onClick={() => fileInput.current?.click()}>Nhập JSON</button>
                <button onClick={() => setModal('app')}>＋ Thêm app</button>
                <button
                  className="primary"
                  onClick={() => {
                    setWorkflowApp(libraryApp === 'all' ? 'fb' : libraryApp);
                    setModal('create');
                  }}
                >
                  ＋ Workflow mới
                </button>
              </div>
            </div>
            <div className="list-toolbar">
              <input
                aria-label="Tìm workflow"
                placeholder="Tìm workflow…"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              />
              <select
                aria-label="Lọc ứng dụng thư viện"
                value={libraryApp}
                onChange={(e) => setLibraryApp(e.target.value)}
              >
                <option value="all">Tất cả ứng dụng</option>
                {boot.apps.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
              <small className="muted">{library.length} workflow</small>
            </div>
            {library.length ? (
              <div className="workflow-grid">
                {library.map((w) => (
                  <article key={w.id} className="workflow-card">
                    <span className="app-icon">
                      {boot.apps.find((a) => a.id === w.appId)?.name[0] ?? 'A'}
                    </span>
                    <button className="card-open" onClick={() => void open(w.id)}>
                      <h3>{w.name}</h3>
                      <p>
                        {boot.apps.find((a) => a.id === w.appId)?.name} · Bản nháp r{w.revision}
                      </p>
                    </button>
                    <div className="card-footer">
                      <span className="badge">Chưa chứng nhận Android</span>
                      <button
                        aria-label={'Lưu trữ ' + w.name}
                        onClick={() => {
                          setArchive(w);
                          setModal('archive');
                        }}
                      >
                        ⋯
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <Empty
                title="Chưa có workflow trong bộ lọc này"
                action={
                  <button
                    onClick={() => {
                      setWorkflowApp(libraryApp === 'all' ? 'fb' : libraryApp);
                      setModal('create');
                    }}
                  >
                    Tạo workflow mới
                  </button>
                }
              >
                Tạo workflow generic hoặc nhập JSON đã xuất. App tùy chỉnh không tự có adapter đã
                chứng nhận.
              </Empty>
            )}
          </div>
        )}
        {view === 'processes' && (
          <Processes
            devices={boot.devices}
            apps={boot.apps}
            workflows={boot.workflows}
            processes={boot.processes}
            notify={notify}
            refresh={() => refresh().then(() => undefined)}
            registerSave={registerSave}
          />
        )}
        {view === 'schedule' && (
          <Schedule
            processes={boot.processes}
            devices={boot.devices}
            notify={notify}
            openProcesses={() => {
              void go('processes');
            }}
          />
        )}
        {view === 'history' && (
          <div className="page">
            <div className="page-heading">
              <div>
                <h1>Lịch sử</h1>
                <p>Kết quả thực thi được đối soát riêng với TRACE.</p>
              </div>
            </div>
            <Empty icon="◷" title="Chưa có thực thi trên điện thoại">
              TRACE trong Inspector chỉ kiểm tra luồng, không tạo bài đăng hoặc kết quả chạy thực.
              Kết quả đăng và bình luận sẽ được ghi sau khi xác minh trên thiết bị.
            </Empty>
          </div>
        )}
      </main>
      <footer className="app-footer">
        <span>● SQLite · Workspace cục bộ</span>
        <span>
          AutoReels Studio · {boot.workflows.length} workflow · {boot.processes.length} tiến trình
        </span>
      </footer>
      {toast && (
        <div role="status" className="toast">
          <span>{toast}</span>
          <button aria-label="Đóng thông báo" onClick={() => setToast('')}>
            ×
          </button>
        </div>
      )}
      <input
        ref={fileInput}
        type="file"
        accept=".json,application/json"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (!file) return;
          if (file.size > 8388608) {
            notify('JSON vượt giới hạn nhập 8 MiB.');
            return;
          }
          void file
            .text()
            .then((text) => api.importWorkflow(JSON.parse(text)))
            .then(async (d) => {
              setActive(d);
              setView('inspector');
              await refresh();
              notify('Đã nhập toàn bộ workflow bundle.');
            })
            .catch((error) =>
              notify(error instanceof Error ? error.message : 'Nhập workflow thất bại.'),
            );
        }}
      />
      {modal === 'create' && (
        <Dialog title="Tạo workflow mới" close={() => setModal(null)}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void createWorkflow();
            }}
          >
            <label className="field">
              <span>Tên workflow</span>
              <input
                aria-label="Tên workflow"
                value={workflowName}
                onChange={(e) => setWorkflowName(e.target.value)}
                placeholder="Ví dụ: Quy trình đăng nội dung"
                required
                maxLength={160}
              />
            </label>
            <label className="field">
              <span>Ứng dụng</span>
              <select
                aria-label="Ứng dụng workflow"
                value={workflowApp}
                onChange={(e) => setWorkflowApp(e.target.value)}
              >
                {boot.apps.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </label>
            <p className="muted">
              Workflow khởi đầu có Bắt đầu và Kết thúc. Bạn thêm node và khai báo dữ liệu theo nhu
              cầu.
            </p>
            <div className="dialog-actions">
              <button type="button" onClick={() => setModal(null)}>
                Hủy
              </button>
              <button className="primary" disabled={busy}>
                {busy ? 'Đang tạo…' : 'Tạo workflow'}
              </button>
            </div>
          </form>
        </Dialog>
      )}
      {modal === 'app' && (
        <Dialog title="Đăng ký ứng dụng" close={() => setModal(null)}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setBusy(true);
              void api
                .registerApp({
                  id: 'custom_' + crypto.randomUUID().replaceAll('-', ''),
                  name: appName,
                  packages: [appPackage],
                  targetKinds: ['custom'],
                  mediaKinds: ['text', 'image', 'video', 'multi'],
                  certification: 'NOT_RUN',
                })
                .then(async (app) => {
                  await refresh();
                  setLibraryApp(app.id);
                  setModal(null);
                  setAppName('');
                  setAppPackage('');
                  notify('Đã đăng ký app. Khả năng automation cần test riêng.');
                })
                .catch((error) =>
                  notify(error instanceof Error ? error.message : 'App không hợp lệ.'),
                )
                .finally(() => setBusy(false));
            }}
          >
            <label className="field">
              <span>Tên ứng dụng</span>
              <input required value={appName} onChange={(e) => setAppName(e.target.value)} />
            </label>
            <label className="field">
              <span>Android package</span>
              <input
                required
                placeholder="com.example.app"
                value={appPackage}
                onChange={(e) => setAppPackage(e.target.value)}
              />
            </label>
            <p className="muted">
              Đăng ký metadata không xác nhận package đã cài hoặc workflow chạy được.
            </p>
            <div className="dialog-actions">
              <button type="button" onClick={() => setModal(null)}>
                Hủy
              </button>
              <button className="primary" disabled={busy}>
                Thêm ứng dụng
              </button>
            </div>
          </form>
        </Dialog>
      )}
      {modal === 'archive' && archive && (
        <Dialog title="Lưu trữ workflow" close={() => setModal(null)}>
          <p>Lưu trữ “{archive.name}”? Các phiên bản và lịch sử vẫn được giữ.</p>
          <div className="dialog-actions">
            <button onClick={() => setModal(null)}>Hủy</button>
            <button
              className="primary"
              onClick={() => {
                void api
                  .archiveWorkflow(archive.id)
                  .then(async () => {
                    if (active?.workflowId === archive.id) setActive(null);
                    await refresh();
                    setModal(null);
                  })
                  .catch((error) => notify(String(error)));
              }}
            >
              Lưu trữ
            </button>
          </div>
        </Dialog>
      )}
      {modal === 'palette' && (
        <Dialog title="Đi tới màn hình" close={() => setModal(null)}>
          <div className="palette-list">
            {routes.map((r, i) => (
              <button key={r.id} onClick={() => void go(r.id)}>
                <span>
                  {r.icon} {r.name}
                </span>
                <kbd>Alt {i + 1}</kbd>
              </button>
            ))}
          </div>
        </Dialog>
      )}
      {modal === 'help' && (
        <Dialog title="Thao tác nhanh" close={() => setModal(null)} wide>
          <div className="help-grid">
            {[
              ['Ctrl+K', 'Tìm node/lệnh'],
              ['Ctrl+S', 'Lưu cấu hình đang chỉnh'],
              ['Alt+1…6', 'Chuyển màn hình'],
              ['Ctrl+Z / Shift+Z', 'Undo / redo trong canvas'],
              ['Ctrl+C / V / D', 'Copy / paste / nhân bản node'],
              ['Delete', 'Xóa node đang chọn'],
              ['Mũi tên / Shift+mũi tên', 'Dịch node 1 / 10 đơn vị'],
              ['Ctrl+lăn chuột', 'Zoom quanh con trỏ'],
              ['Lăn / Shift+lăn', 'Pan dọc / ngang'],
              ['Space+kéo / chuột giữa', 'Di chuyển canvas'],
              ['Ctrl+0 / Shift+F', 'Căn toàn bộ / vùng chọn'],
              ['Ctrl+B / Ctrl+Alt+P', 'Thu gọn library / điện thoại'],
            ].map(([key, value]) => (
              <div key={key}>
                <kbd>{key}</kbd>
                <span>{value}</span>
              </div>
            ))}
          </div>
          <div className="notice">
            Bắt đầu: tạo workflow → khai báo inputs → thêm/nối node → kiểm tra → TRACE → lưu
            version. TRACE không gửi thao tác xuống điện thoại. Chạy Android cần backend và
            profile/test receipt.
          </div>
        </Dialog>
      )}
    </div>
  );
}
