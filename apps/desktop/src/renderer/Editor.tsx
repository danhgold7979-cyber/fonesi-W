import { useEffect, useRef, useState } from 'react';
import {
  NODE_DEFINITIONS,
  NODE_CONFIG_SCHEMAS,
  isSafeKey,
  validateWorkflowShape,
} from '@autoreels/contracts';
import type {
  AppDefinition,
  WorkflowDraft,
  WorkflowBundle,
  WorkflowNode,
  NodeType,
  JsonValue,
  FieldDefinition,
  ValidationIssue,
  TraceReportDto,
} from '@autoreels/contracts';
import {
  EditorHistory,
  graphById,
  addNode,
  connect,
  removeNodes,
  duplicateNodes,
  insertOnEdge,
  layoutGraph,
  createSubgraph,
  copyPortableSelection,
  parsePortableSelection,
  serializePortableSelection,
  pastePortableSelection,
  createGroup,
  removeGroup,
  toggleGroup,
  moveNodes,
  rerouteEdge,
  alignNodes,
  selectionToSubgraph,
} from '@autoreels/editor';
import type { PortableGraphClipboard } from '@autoreels/editor';
import { api } from './api.js';
import { EditorDevicePanel } from './EditorDevicePanel.js';
import { Canvas } from './Canvas.js';
import type { CanvasMenu } from './Canvas.js';
import { Dialog, Empty, Field } from './components.js';
import { DebugPanel } from './DebugPanel.js';

export function downloadJson(name: string, value: unknown) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }),
  );
  const link = document.createElement('a');
  link.href = url;
  link.download = name + '.json';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
interface Props {
  initial: WorkflowDraft;
  apps: AppDefinition[];
  notify: (message: string) => void;
  saved: (draft: WorkflowDraft) => void;
  registerSave: (save: (() => Promise<unknown>) | null) => void;
  clone: (id: string) => void;
}
type Modal = null | 'inputs' | 'advanced' | 'subflow' | 'convert' | 'versions';
export function Editor(props: Props) {
  const history = useRef(new EditorHistory(props.initial.bundle)),
    revision = useRef(props.initial.revision),
    generation = useRef(0),
    savedGeneration = useRef(0),
    saving = useRef<Promise<WorkflowDraft> | null>(null);
  const [bundle, setBundle] = useState(props.initial.bundle),
    [status, setStatus] = useState('saved'),
    [dirty, setDirty] = useState(false);
  const [stack, setStack] = useState([bundle.mainGraphId]),
    [selected, setSelected] = useState<string[]>([]),
    [search, setSearch] = useState('');
  const [library, setLibrary] = useState(true),
    [phone, setPhone] = useState(true),
    [tab, setTab] = useState('properties');
  const [menu, setMenu] = useState<CanvasMenu | null>(null),
    [more, setMore] = useState(false),
    [modal, setModal] = useState<Modal>(null),
    [config, setConfig] = useState('');
  const [fields, setFields] = useState<FieldDefinition[]>([]),
    [subName, setSubName] = useState(''),
    [versions, setVersions] = useState<Awaited<ReturnType<typeof api.versions>>>([]);
  const [palette, setPalette] = useState(false),
    [query, setQuery] = useState(''),
    [paletteIndex, setPaletteIndex] = useState(0),
    [pendingEdge, setPendingEdge] = useState<string | null>(null);
  const [issues, setIssues] = useState<ValidationIssue[]>([]),
    [trace, setTrace] = useState<TraceReportDto | null>(null),
    [rowData, setRowData] = useState('{}');
  const [favorites, setFavorites] = useState<string[]>([]),
    clipboard = useRef<PortableGraphClipboard | null>(null),
    pasteCount = useRef(0),
    fit = useRef<(selection?: boolean) => void>(() => undefined);
  const graphId = stack.at(-1)!,
    graph = graphById(bundle, graphId),
    node = graph.nodes.find((n) => n.id === selected[0]);
  const app = props.apps.find((a) => a.id === bundle.workflow.appId);
  function apply(change: (bundle: WorkflowBundle) => void) {
    try {
      const next = history.current.mutate(change);
      setBundle(next);
      generation.current++;
      setDirty(true);
      setStatus('modified');
      setIssues([]);
      return true;
    } catch (e) {
      props.notify(e instanceof Error ? e.message : 'Thao tác không hợp lệ.');
      return false;
    }
  }
  function replace(next: WorkflowBundle) {
    setStack((previous) => {
      const retained = previous.filter((id) => next.graphs.some((g) => g.id === id));
      return retained.length ? retained : [next.mainGraphId];
    });
    setSelected([]);
    setBundle(next);
    generation.current++;
    setDirty(true);
    setStatus('modified');
  }
  function editNode(patch: Partial<WorkflowNode>) {
    if (node)
      apply((b) =>
        Object.assign(
          graphById(b, graphId).nodes.find((n) => n.id === node.id)!,
          patch,
        ),
      );
  }
  async function save(): Promise<WorkflowDraft> {
    if (saving.current) {
      await saving.current;
      if (generation.current !== savedGeneration.current) return save();
    }
    if (generation.current === savedGeneration.current)
      return {
        workflowId: bundle.workflow.id,
        bundle: history.current.bundle,
        revision: revision.current,
        updatedAt: props.initial.updatedAt,
      };
    const at = generation.current,
      snapshot = history.current.bundle;
    setStatus('saving');
    const promise = api
      .saveWorkflow(snapshot, revision.current)
      .then((result) => {
        revision.current = result.revision;
        savedGeneration.current = at;
        const stillDirty = generation.current !== at;
        setDirty(stillDirty);
        setStatus(stillDirty ? 'modified' : 'saved');
        props.saved(result);
        return result;
      })
      .catch((error) => {
        setStatus('error');
        throw error;
      })
      .finally(() => {
        saving.current = null;
      });
    saving.current = promise;
    const result = await promise;
    return generation.current !== savedGeneration.current ? save() : result;
  }
  async function copyNodes(cut = false) {
    try {
      if (!selected.length) return;
      const content = copyPortableSelection(bundle, graphId, selected);
      const encoded = serializePortableSelection(content);
      let systemCopy = false;
      try {
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(encoded);
          systemCopy = true;
        }
      } catch {
        // Restricted browser contexts can deny OS clipboard access.
      }
      if (cut && !systemCopy)
        throw new Error('Không thể cắt: clipboard hệ thống không cấp quyền.');
      clipboard.current = content;
      pasteCount.current = 0;
      if (!systemCopy)
        props.notify('Clipboard hệ thống không khả dụng; chỉ sao chép tạm trong editor hiện tại.');
      if (cut) {
        // Do not remove nodes from a graph that changed during the async write.
        if (actions.current.graphId !== graphId || actions.current.bundle.workflow.id !== bundle.workflow.id)
          return;
        apply((b) => removeNodes(graphById(b, graphId), selected));
        setSelected([]);
      }
    } catch (error) {
      props.notify(error instanceof Error ? error.message : 'Không thể sao chép node.');
    }
  }
  async function pasteNodes(at?: { x: number; y: number }) {
    try {
      let content = clipboard.current;
      let systemText: string | null = null;
      try {
        if (navigator.clipboard?.readText) systemText = await navigator.clipboard.readText();
      } catch {
        // A denied read can use the in-editor selection only.
      }
      if (systemText) {
        const parsed = parsePortableSelection(systemText);
        if (!parsed) {
          props.notify('Clipboard không chứa node AutoReels Studio.');
          return;
        }
        content = parsed;
      }
      if (!content?.selection.nodes.length) return;
      if (actions.current.graphId !== graphId || actions.current.bundle.workflow.id !== bundle.workflow.id) {
        props.notify('Graph đã thay đổi trong khi đọc clipboard; dán lại trên graph hiện tại.');
        return;
      }
      const nodes = content.selection.nodes;
      const amount = 28 * ++pasteCount.current;
      const offset = at
        ? {
            x: at.x - Math.min(...nodes.map((n) => n.x)),
            y: at.y - Math.min(...nodes.map((n) => n.y)),
          }
        : { x: amount, y: amount };
      apply((b) => setSelected(pastePortableSelection(b, graphId, content, offset)));
    } catch (error) {
      props.notify(error instanceof Error ? error.message : 'Không thể dán workflow.');
    }
  }
  function groupSelected() {
    apply((b) => {
      createGroup(graphById(b, graphId), selected);
    });
  }
  const actions = useRef({
    save,
    apply,
    bundle,
    graphId,
    selected,
    node,
    modal,
    palette,
    dirty,
    copyNodes,
    pasteNodes,
    groupSelected,
  });
  actions.current = {
    save,
    apply,
    bundle,
    graphId,
    selected,
    node,
    modal,
    palette,
    dirty,
    copyNodes,
    pasteNodes,
    groupSelected,
  };
  useEffect(() => {
    props.registerSave(() => actions.current.save());
    return () => props.registerSave(null);
  }, [props.registerSave]);
  useEffect(() => {
    if (!dirty || status !== 'modified') return;
    const timer = setTimeout(() => {
      void actions.current
        .save()
        .catch((error) => props.notify(error instanceof Error ? error.message : 'Lưu thất bại.'));
    }, 900);
    return () => clearTimeout(timer);
  }, [bundle, dirty, status, props.notify]);
  useEffect(() => {
    const openPalette = () => {
      setPalette(true);
      setQuery('');
      setPaletteIndex(0);
    };
    window.addEventListener('studio:palette', openPalette);
    const key = (e: KeyboardEvent) => {
      const a = actions.current,
        target = e.target as HTMLElement;
      if (
        a.modal ||
        a.palette ||
        target.closest('input,textarea,select,[contenteditable="true"],[role="dialog"]')
      )
        return;
      if (e.key === 'Escape') {
        setMenu(null);
        setMore(false);
        setPendingEdge(null);
        setSelected([]);
        return;
      }
      const canvas = document.activeElement?.closest('.canvas-wrap');
      if (e.ctrlKey && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        setLibrary((v) => !v);
        return;
      }
      if (e.ctrlKey && e.altKey && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        setPhone((v) => !v);
        return;
      }
      if (!canvas) return;
      const currentGraph = graphById(a.bundle, a.graphId),
        ids = a.selected;
      if (
        e.ctrlKey &&
        ['z', 'y', 'a', 'c', 'x', 'v', 'd', 'g', '0'].includes(e.key.toLowerCase())
      ) {
        e.preventDefault();
        switch (e.key.toLowerCase()) {
          case 'z':
            if (e.shiftKey ? history.current.canRedo : history.current.canUndo)
              replace(e.shiftKey ? history.current.redo() : history.current.undo());
            break;
          case 'y':
            if (history.current.canRedo) replace(history.current.redo());
            break;
          case 'a':
            setSelected(currentGraph.nodes.map((n) => n.id));
            break;
          case 'c':
            void a.copyNodes();
            break;
          case 'x':
            void a.copyNodes(true);
            break;
          case 'g':
            a.groupSelected();
            break;
          case 'd':
            a.apply((b) => {
              setSelected(duplicateNodes(graphById(b, a.graphId), ids));
            });
            break;
          case 'v':
            void a.pasteNodes();
            break;
          case '0':
            fit.current();
            break;
        }
      } else if (['Delete', 'Backspace'].includes(e.key)) {
        e.preventDefault();
        a.apply((b) => removeNodes(graphById(b, a.graphId), ids));
        setSelected([]);
      } else if (e.shiftKey && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        fit.current(true);
      } else if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
        e.preventDefault();
        const amount = e.shiftKey ? 10 : 1;
        a.apply((b) => {
          const graph = graphById(b, a.graphId);
          moveNodes(
            graph,
            graph.nodes
              .filter((n) => ids.includes(n.id))
              .map((n) => ({
                id: n.id,
                x: n.x + (e.key === 'ArrowLeft' ? -amount : e.key === 'ArrowRight' ? amount : 0),
                y: n.y + (e.key === 'ArrowUp' ? -amount : e.key === 'ArrowDown' ? amount : 0),
              })),
          );
        });
      }
    };
    window.addEventListener('keydown', key);
    return () => {
      window.removeEventListener('studio:palette', openPalette);
      window.removeEventListener('keydown', key);
    };
  }, []);
  useEffect(() => {
    if (!menu) return;
    document.querySelector<HTMLButtonElement>('[role="menu"] button')?.focus();
    const close = (e: PointerEvent) => {
      if (!(e.target as HTMLElement).closest('[role="menu"]')) setMenu(null);
    };
    window.addEventListener('pointerdown', close);
    return () => window.removeEventListener('pointerdown', close);
  }, [menu]);
  function add(type: NodeType, x = 180 + graph.nodes.length * 20, y = 250) {
    apply((b) => {
      const g = graphById(b, graphId);
      const added = pendingEdge ? insertOnEdge(g, pendingEdge, type) : addNode(g, type, x, y);
      setSelected([added]);
    });
    setPendingEdge(null);
    setPalette(false);
    setMenu(null);
  }
  function openNode(id: string) {
    const n = graph.nodes.find((n) => n.id === id);
    if (!n) return;
    if (
      n.type === 'subflow' &&
      typeof n.config.graphRef === 'string' &&
      bundle.graphs.some((g) => g.id === n.config.graphRef)
    ) {
      setStack((s) => [...s, String(n.config.graphRef)]);
      setSelected([]);
    } else {
      setSelected([id]);
      setConfig(JSON.stringify(n.config, null, 2));
      setModal('advanced');
    }
  }
  async function validate() {
    try {
      const found = await api.validateWorkflow(history.current.bundle);
      setIssues(found);
      setTab('validation');
      props.notify(
        found.length
          ? found.length + ' vấn đề cần xử lý.'
          : 'Graph hợp lệ về cấu trúc; chưa xác nhận khả năng chạy Android.',
      );
    } catch (e) {
      props.notify(String(e));
    }
  }
  async function runTrace() {
    try {
      const row: unknown = JSON.parse(rowData);
      if (!row || Array.isArray(row) || typeof row !== 'object')
        throw new Error('Dữ liệu thử phải là object.');
      const report = await api.traceWorkflow(
        history.current.bundle,
        row as Record<string, JsonValue>,
      );
      setTrace(report);
      setIssues(report.issues);
      setTab('trace');
    } catch (e) {
      props.notify(e instanceof Error ? e.message : 'Không thể chạy trace.');
    }
  }
  async function version() {
    try {
      const saved = await save(),
        result = await api.createVersion(saved.workflowId, saved.revision);
      props.notify('Đã tạo v' + result.number + '. Chạy thiết bị cần test receipt riêng.');
      setVersions(await api.versions(saved.workflowId));
      setModal('versions');
    } catch (e) {
      props.notify(e instanceof Error ? e.message : 'Tạo version thất bại.');
    }
  }
  const filtered = NODE_DEFINITIONS.filter((d) =>
    (d.label + ' ' + d.type).toLocaleLowerCase('vi').includes(search.toLocaleLowerCase('vi')),
  ).sort((a, b) => Number(favorites.includes(b.type)) - Number(favorites.includes(a.type)));
  const choices = NODE_DEFINITIONS.filter((d) =>
    (d.label + ' ' + d.type).toLocaleLowerCase('vi').includes(query.toLocaleLowerCase('vi')),
  );
  return (
    <div className="editor-page">
      <header className="workflow-header">
        <div className="workflow-title">
          <span className="app-icon">{app?.name[0] ?? 'A'}</span>
          <div>
            <strong>{bundle.workflow.name}</strong>
            <small>
              {app?.name ?? bundle.workflow.appId} · Bản nháp r{revision.current} ·{' '}
              {dirty ? 'Có thay đổi' : 'Đã lưu cục bộ'}
            </small>
          </div>
        </div>
        <div className="actions">
          <button aria-label="Menu workflow" onClick={() => setMore((v) => !v)}>
            ⋯
          </button>
          <button onClick={() => void validate()}>✓ Kiểm tra</button>
          <button
            onClick={() =>
              void save()
                .then(() => props.notify('Đã lưu workflow.'))
                .catch((e) => props.notify(String(e)))
            }
            disabled={status === 'saving'}
          >
            ▣ Lưu
          </button>
          <button className="primary" onClick={() => void runTrace()}>
            ▷ Chạy thử TRACE
          </button>
        </div>
        {more && (
          <div className="dropdown workflow-more">
            <button
              onClick={() => {
                setTab('debug');
                setMore(false);
              }}
            >
              Debug TRACE
            </button>
            <button
              onClick={() => {
                setFields(structuredClone(bundle.inputs));
                setModal('inputs');
                setMore(false);
              }}
            >
              Khai báo Inputs
            </button>
            <button
              onClick={() => {
                void version();
                setMore(false);
              }}
            >
              Tạo phiên bản
            </button>
            <button
              onClick={() => {
                void save().then((d) => props.clone(d.workflowId));
                setMore(false);
              }}
            >
              Nhân bản toàn bộ workflow
            </button>
            <button
              onClick={() => {
                downloadJson(bundle.workflow.name, history.current.bundle);
                setMore(false);
              }}
            >
              Xuất workflow JSON
            </button>
            <button
              onClick={() => {
                setSubName('');
                setModal('subflow');
                setMore(false);
              }}
            >
              Tạo quy trình con
            </button>
            <button
              onClick={() => {
                void api.versions(bundle.workflow.id).then((v) => {
                  setVersions(v);
                  setModal('versions');
                });
                setMore(false);
              }}
            >
              Danh sách phiên bản
            </button>
          </div>
        )}
      </header>
      <div
        className={'editor-columns ' + (!library ? 'no-library ' : '') + (!phone ? 'no-phone' : '')}
      >
        {library && (
          <aside className="node-library">
            <div className="panel-heading">
              <strong>Thư viện khối</strong>
              <span className="badge">40</span>
            </div>
            <input
              aria-label="Tìm node"
              placeholder="Tìm node…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <div className="library-scroll">
              {filtered.map((d, index) => (
                <div key={d.type}>
                  {(!index || filtered[index - 1]?.group !== d.group) && <h4>{d.group}</h4>}
                  <div className="library-row">
                    <button
                      className="library-item"
                      draggable
                      onDragStart={(e) =>
                        e.dataTransfer.setData('application/autoreels-node', d.type)
                      }
                      onClick={() => add(d.type)}
                      title={'Kéo vào canvas hoặc bấm để thêm ' + d.label}
                    >
                      <span>◇</span>
                      {d.label}
                    </button>
                    <button
                      className={'pin ' + (favorites.includes(d.type) ? 'active' : '')}
                      aria-label={'Ghim ' + d.label}
                      onClick={() =>
                        setFavorites((f) =>
                          f.includes(d.type) ? f.filter((t) => t !== d.type) : [...f, d.type],
                        )
                      }
                    >
                      ★
                    </button>
                  </div>
                </div>
              ))}
              <h4>QUY TRÌNH CON</h4>
              {bundle.graphs
                .filter((g) => g.id !== bundle.mainGraphId)
                .map((g) => (
                  <button
                    key={g.id}
                    className="library-item"
                    onClick={() => {
                      setStack((s) => [...s, g.id]);
                      setSelected([]);
                    }}
                  >
                    ◇ {g.name ?? g.id}
                  </button>
                ))}
              <button
                className="text-button"
                onClick={() => {
                  setSubName('');
                  setModal('subflow');
                }}
              >
                ＋ Tạo quy trình con
              </button>
            </div>
            <small className="muted library-footer">
              Kéo khối vào canvas · Chuột phải để thao tác
            </small>
          </aside>
        )}
        <section className="canvas-column">
          <div className="canvas-toolbar">
            <button aria-label="Ẩn hiện thư viện" onClick={() => setLibrary((v) => !v)}>
              ▤
            </button>
            <div className="breadcrumbs">
              {stack.map((id, i) => (
                <button
                  key={id + i}
                  onClick={() => {
                    setStack((s) => s.slice(0, i + 1));
                    setSelected([]);
                  }}
                >
                  {bundle.graphs.find((g) => g.id === id)?.name ??
                    (id === bundle.mainGraphId ? 'Quy trình chính' : id)}
                </button>
              ))}
            </div>
            <button
              aria-label="Hoàn tác"
              disabled={!history.current.canUndo}
              onClick={() => replace(history.current.undo())}
            >
              ↶
            </button>
            <button
              aria-label="Làm lại"
              disabled={!history.current.canRedo}
              onClick={() => replace(history.current.redo())}
            >
              ↷
            </button>
            <button
              aria-label="Gom nhóm vùng chọn"
              title="Gom nhóm · Ctrl+G"
              disabled={selected.length < 2}
              onClick={groupSelected}
            >
              ▧
            </button>
            <button aria-label="Ẩn hiện điện thoại" onClick={() => setPhone((v) => !v)}>
              ▥
            </button>
          </div>
          <Canvas
            graph={graph}
            selected={selected}
            select={setSelected}
            move={(positions) => {
              apply((b) => moveNodes(graphById(b, graphId), positions));
            }}
            resize={(id, p) =>
              apply((b) =>
                Object.assign(
                  graphById(b, graphId).nodes.find((n) => n.id === id)!,
                  { x: p.x, y: p.y, w: p.width, h: p.height },
                ),
              )
            }
            connect={(source, port, target) =>
              apply((b) => connect(graphById(b, graphId), source, port, target))
            }
            toggleGroup={(id) => {
              apply((b) => toggleGroup(graphById(b, graphId), id));
            }}
            reroute={(id, point) => {
              apply((b) => rerouteEdge(graphById(b, graphId), id, point));
            }}
            menu={setMenu}
            openNode={openNode}
            addAt={(type, p) => {
              if (NODE_DEFINITIONS.some((d) => d.type === type)) add(type as NodeType, p.x, p.y);
              else props.notify('Không nhận dạng được loại node.');
            }}
            fitRef={(callback) => {
              fit.current = callback;
            }}
          />
          <div className="bottom-tabs">
            {[
              ['properties', 'Thuộc tính'],
              ['tree', 'Cây UI'],
              ['variables', 'Biến'],
              ['trace', 'Nhật ký TRACE'],
              ['debug', 'Debug TRACE'],
              ['validation', 'Kiểm tra'],
            ].map(([id, label]) => (
              <button key={id} className={tab === id ? 'active' : ''} onClick={() => setTab(id!)}>
                {label}
                {id === 'validation' && issues.length ? ' (' + issues.length + ')' : ''}
              </button>
            ))}
          </div>
          {(tab !== 'properties' || node || graph.groups?.length || selected.length > 1) && (
            <div className={'bottom-panel ' + (tab === 'properties' ? 'properties-panel' : '')}>
              {tab === 'debug' && (
                <DebugPanel
                  bundle={bundle}
                  notify={props.notify}
                  select={(id, nodeId) => {
                    if (
                      !bundle.graphs.some(
                        (g) => g.id === id && g.nodes.some((n) => n.id === nodeId),
                      )
                    ) {
                      props.notify(
                        'Node thuộc bản chụp debug và không còn trong thiết kế hiện tại.',
                      );
                      return;
                    }
                    setStack(id === bundle.mainGraphId ? [id] : [bundle.mainGraphId, id]);
                    setSelected([nodeId]);
                  }}
                />
              )}
              {tab === 'properties' && !!graph.groups?.length && (
                <div className="editor-groups">
                  {graph.groups.map((group) => (
                    <div key={group.id}>
                      <input
                        aria-label={'Tên nhóm ' + group.id}
                        key={group.id + group.name}
                        defaultValue={group.name}
                        maxLength={120}
                        onBlur={(e) => {
                          const name = e.target.value.trim();
                          if (name && name !== group.name)
                            apply((b) => {
                              graphById(b, graphId).groups!.find((g) => g.id === group.id)!.name =
                                name;
                            });
                        }}
                      />
                      <button onClick={() => setSelected(group.nodeIds)}>
                        Chọn nhóm ({group.nodeIds.length})
                      </button>
                      <button
                        onClick={() => apply((b) => toggleGroup(graphById(b, graphId), group.id))}
                      >
                        {group.collapsed ? 'Mở nhóm' : 'Thu nhóm'}
                      </button>
                      <button
                        onClick={() => apply((b) => removeGroup(graphById(b, graphId), group.id))}
                      >
                        Bỏ nhóm
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {tab === 'properties' && node && (
                <>
                  <div className="property-heading">
                    <strong>{node.name}</strong>
                    <button
                      onClick={() => {
                        setConfig(JSON.stringify(node.config, null, 2));
                        setModal('advanced');
                      }}
                    >
                      Cấu hình nâng cao
                    </button>
                  </div>
                  <div className="property-grid">
                    <Field
                      key={node.id + 'name'}
                      label="Tên node"
                      value={node.name}
                      commit={(name) => editNode({ name })}
                    />
                    <Field
                      key={node.id + 'timeout'}
                      label="Timeout (ms)"
                      type="number"
                      value={node.timeoutMs ?? 10000}
                      commit={(value) => editNode({ timeoutMs: Number(value) })}
                    />
                    <Field
                      key={node.id + 'desc'}
                      label="Ghi chú"
                      value={node.description ?? ''}
                      commit={(description) => editNode({ description })}
                    />
                    {Object.entries(NODE_CONFIG_SCHEMAS[node.type])
                      .filter(([, m]) =>
                        ['string', 'number', 'integer', 'boolean'].includes(String(m.type)),
                      )
                      .slice(0, 4)
                      .map(([key, meta]) =>
                        key === 'graphRef' ? (
                          <label className="field" key={key}>
                            <span>Quy trình con</span>
                            <select
                              value={String(node.config[key] ?? '')}
                              onChange={(e) =>
                                editNode({ config: { ...node.config, [key]: e.target.value } })
                              }
                            >
                              <option value="">Chọn quy trình con</option>
                              {bundle.graphs
                                .filter((g) => g.id !== graphId)
                                .map((g) => (
                                  <option key={g.id} value={g.id}>
                                    {g.name ?? g.id}
                                  </option>
                                ))}
                            </select>
                          </label>
                        ) : meta.type === 'boolean' ? (
                          <label key={key} className="field">
                            <span>{key}</span>
                            <input
                              type="checkbox"
                              checked={Boolean(node.config[key])}
                              onChange={(e) =>
                                editNode({ config: { ...node.config, [key]: e.target.checked } })
                              }
                            />
                          </label>
                        ) : (
                          <Field
                            key={node.id + key}
                            label={key}
                            value={
                              typeof node.config[key] === 'number'
                                ? Number(node.config[key])
                                : String(node.config[key] ?? '')
                            }
                            type={
                              ['integer', 'number'].includes(String(meta.type)) ? 'number' : 'text'
                            }
                            commit={(value) =>
                              editNode({
                                config: {
                                  ...node.config,
                                  [key]: ['integer', 'number'].includes(String(meta.type))
                                    ? Number(value)
                                    : value,
                                },
                              })
                            }
                          />
                        ),
                      )}
                  </div>
                </>
              )}
              {tab === 'tree' && (
                <p className="muted">
                  Chưa có snapshot từ điện thoại thật. UI tree, pick và selector test sẽ mở sau khi
                  kết nối backend Android.
                </p>
              )}
              {tab === 'variables' && <pre>{JSON.stringify(trace?.outputs ?? {}, null, 2)}</pre>}
              {tab === 'trace' && (
                <>
                  <div className="trace-input">
                    <label>
                      Dữ liệu row thử (JSON)
                      <input
                        value={rowData}
                        onChange={(e) => setRowData(e.target.value)}
                        aria-label="Dữ liệu row thử"
                      />
                    </label>
                    <span className="badge">TRACE · Không gửi thao tác điện thoại</span>
                  </div>
                  {trace && <strong>Kết quả: {trace.status}</strong>}
                  {trace?.events.map((e, i) => (
                    <div key={i} className="trace-line">
                      <code>
                        {e.graphId}/{e.nodeId}
                      </code>
                      <span className={'status ' + e.status.toLowerCase()}>{e.status}</span>
                      {e.detail}
                    </div>
                  ))}
                </>
              )}
              {tab === 'validation' &&
                (!issues.length ? (
                  <p className="muted">
                    Bấm Kiểm tra để xác thực graph và các quy trình con. Cấu trúc hợp lệ không đồng
                    nghĩa đã chạy được Android.
                  </p>
                ) : (
                  issues.map((issue, i) => (
                    <button
                      className="issue"
                      key={i}
                      onClick={() => {
                        if (issue.graphId)
                          setStack((s) =>
                            s.at(-1) === issue.graphId ? s : [...s, issue.graphId!],
                          );
                        if (issue.nodeId) setSelected([issue.nodeId]);
                        setTab('properties');
                      }}
                    >
                      <code>{issue.code}</code> {issue.message}
                    </button>
                  ))
                ))}
            </div>
          )}
        </section>
        {phone && (
          <aside className="phone-panel">
            <div className="panel-heading">
              <strong>Điện thoại kiểm thử</strong>
              <button aria-label="Thu gọn điện thoại" onClick={() => setPhone(false)}>
                ×
              </button>
            </div>
            <EditorDevicePanel notify={props.notify} />
          </aside>
        )}
      </div>
      <footer className="editor-status">
        <span className={'dot ' + (status === 'error' ? 'red' : '')} />
        {status === 'saved'
          ? 'Đã lưu cục bộ'
          : status === 'saving'
            ? 'Đang lưu…'
            : status === 'error'
              ? 'Lưu lỗi · Thay đổi vẫn được giữ trong editor'
              : 'Có thay đổi chưa lưu'}
        <span className="muted">Workflow dùng chung · thiết bị kiểm thử độc lập</span>
      </footer>
      {menu && (
        <div
          role="menu"
          className="context-menu"
          style={{
            left: Math.min(menu.x, window.innerWidth - 240),
            top: Math.min(menu.y, window.innerHeight - 360),
          }}
          onKeyDown={(e) => {
            const buttons = [
              ...e.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'),
            ];
            const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
            if (['ArrowDown', 'ArrowUp'].includes(e.key)) {
              e.preventDefault();
              buttons[
                (index + (e.key === 'ArrowDown' ? 1 : buttons.length - 1)) % buttons.length
              ]?.focus();
            }
            if (e.key === 'Escape') setMenu(null);
          }}
        >
          {menu.kind === 'node' && (
            <>
              <button
                role="menuitem"
                onClick={() => {
                  void copyNodes();
                  setMenu(null);
                }}
              >
                Sao chép · Ctrl+C
              </button>
              <button
                role="menuitem"
                onClick={() => {
                  void copyNodes(true);
                  setMenu(null);
                }}
              >
                Cắt · Ctrl+X
              </button>
              <button
                role="menuitem"
                disabled={selected.length < 2}
                onClick={() => {
                  groupSelected();
                  setMenu(null);
                }}
              >
                Gom nhóm · Ctrl+G
              </button>
              <button
                role="menuitem"
                onClick={() => {
                  setSubName('');
                  setModal('convert');
                  setMenu(null);
                }}
              >
                Chuyển vùng chọn thành quy trình con
              </button>
              {(
                [
                  ['left', 'Căn trái'],
                  ['top', 'Căn trên'],
                  ['horizontal', 'Giãn đều ngang'],
                  ['vertical', 'Giãn đều dọc'],
                ] as const
              ).map(([mode, label]) => (
                <button
                  key={mode}
                  role="menuitem"
                  disabled={selected.length < (mode === 'left' || mode === 'top' ? 2 : 3)}
                  onClick={() => {
                    apply((b) => alignNodes(graphById(b, graphId), selected, mode));
                    setMenu(null);
                  }}
                >
                  {label}
                </button>
              ))}
              <button
                role="menuitem"
                onClick={() => {
                  openNode(menu.id!);
                  setMenu(null);
                }}
              >
                Mở / cấu hình node
              </button>
              <button
                role="menuitem"
                onClick={() => {
                  apply((b) => {
                    setSelected(duplicateNodes(graphById(b, graphId), selected));
                  });
                  setMenu(null);
                }}
              >
                Nhân bản · Ctrl+D
              </button>
              <button
                role="menuitem"
                onClick={() => {
                  editNode({ breakpoint: !node?.breakpoint });
                  setMenu(null);
                }}
              >
                Bật/tắt breakpoint
              </button>
              <button
                role="menuitem"
                onClick={() => {
                  apply((b) => {
                    const g = graphById(b, graphId);
                    g.edges = g.edges.filter(
                      (e) => !selected.includes(e.source) && !selected.includes(e.target),
                    );
                  });
                  setMenu(null);
                }}
              >
                Ngắt các dây nối
              </button>
              <button
                role="menuitem"
                onClick={() => {
                  apply((b) => removeNodes(graphById(b, graphId), selected));
                  setSelected([]);
                  setMenu(null);
                }}
              >
                Xóa node · Delete
              </button>
            </>
          )}
          {menu.kind === 'edge' && (
            <>
              <button
                role="menuitem"
                onClick={() => {
                  if (menu.world)
                    apply((b) => rerouteEdge(graphById(b, graphId), menu.id!, menu.world!));
                  setMenu(null);
                }}
              >
                Đặt điểm bẻ dây tại đây
              </button>
              <button
                role="menuitem"
                disabled={!graph.edges.find((e) => e.id === menu.id)?.reroute}
                onClick={() => {
                  apply((b) => rerouteEdge(graphById(b, graphId), menu.id!, null));
                  setMenu(null);
                }}
              >
                Xóa điểm bẻ dây
              </button>
              <button
                role="menuitem"
                onClick={() => {
                  setPendingEdge(menu.id!);
                  setPalette(true);
                  setQuery('');
                  setMenu(null);
                }}
              >
                Chèn node trên dây
              </button>
              <button
                role="menuitem"
                onClick={() => {
                  apply((b) => {
                    const g = graphById(b, graphId);
                    g.edges = g.edges.filter((e) => e.id !== menu.id);
                  });
                  setMenu(null);
                }}
              >
                Xóa dây nối
              </button>
            </>
          )}
          {menu.kind === 'canvas' && (
            <>
              <button
                role="menuitem"
                aria-label="Dán node từ clipboard hệ thống"
                onClick={() => {
                  void pasteNodes(menu.world);
                  setMenu(null);
                }}
              >
                Dán · Ctrl+V
              </button>
              <button
                role="menuitem"
                onClick={() => {
                  setPalette(true);
                  setQuery('');
                  setMenu(null);
                }}
              >
                Thêm node · Ctrl+K
              </button>
              <button
                role="menuitem"
                onClick={() => {
                  setSelected(graph.nodes.map((n) => n.id));
                  setMenu(null);
                }}
              >
                Chọn tất cả · Ctrl+A
              </button>
              <button
                role="menuitem"
                onClick={() => {
                  apply((b) => layoutGraph(graphById(b, graphId)));
                  setMenu(null);
                }}
              >
                Sắp xếp ngang
              </button>
              <button
                role="menuitem"
                onClick={() => {
                  apply((b) => layoutGraph(graphById(b, graphId), true));
                  setMenu(null);
                }}
              >
                Sắp xếp dọc
              </button>
            </>
          )}
          <button
            role="menuitem"
            onClick={() => {
              fit.current(true);
              setMenu(null);
            }}
          >
            Căn vừa vùng chọn · Shift+F
          </button>
          <button
            role="menuitem"
            onClick={() => {
              fit.current();
              setMenu(null);
            }}
          >
            Căn vừa toàn bộ · Ctrl+0
          </button>
        </div>
      )}
      {palette && (
        <Dialog
          title={pendingEdge ? 'Chèn node trên dây' : 'Tìm và thêm node'}
          close={() => {
            setPalette(false);
            setPendingEdge(null);
          }}
        >
          <input
            aria-label="Tìm lệnh hoặc node"
            value={query}
            placeholder="Tên node, loại node…"
            onChange={(e) => {
              setQuery(e.target.value);
              setPaletteIndex(0);
            }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setPaletteIndex((i) => Math.min(choices.length - 1, i + 1));
              }
              if (e.key === 'ArrowUp') {
                e.preventDefault();
                setPaletteIndex((i) => Math.max(0, i - 1));
              }
              if (e.key === 'Enter' && choices[paletteIndex]) {
                e.preventDefault();
                add(choices[paletteIndex]!.type);
              }
            }}
          />
          <div className="palette-list">
            {choices.map((d, i) => (
              <button
                key={d.type}
                className={i === paletteIndex ? 'active' : ''}
                onClick={() => add(d.type)}
              >
                <span>◇ {d.label}</span>
                <code>{d.type}</code>
              </button>
            ))}
          </div>
        </Dialog>
      )}
      {modal === 'advanced' && node && (
        <Dialog title={'Cấu hình · ' + node.name} close={() => setModal(null)} wide>
          <p className="muted">
            Chỉ các thuộc tính của node {node.type}:{' '}
            {NODE_DEFINITIONS.find((d) => d.type === node.type)!.configFields.join(', ')}.
          </p>
          <textarea
            aria-label="Cấu hình node JSON"
            className="code-editor"
            value={config}
            onChange={(e) => setConfig(e.target.value)}
          />
          <div className="dialog-actions">
            <button onClick={() => setModal(null)}>Hủy</button>
            <button
              className="primary"
              onClick={() => {
                try {
                  const parsed: unknown = JSON.parse(config);
                  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
                    throw new Error('Cấu hình phải là object.');
                  const copy = history.current.bundle;
                  Object.assign(
                    graphById(copy, graphId).nodes.find((n) => n.id === node.id)!,
                    { config: parsed },
                  );
                  const valid = validateWorkflowShape(copy);
                  if (!valid.ok)
                    throw new Error(valid.issues[0]?.message ?? 'Cấu hình node không hợp lệ.');
                  apply((b) =>
                    Object.assign(
                      graphById(b, graphId).nodes.find((n) => n.id === node.id)!,
                      { config: parsed },
                    ),
                  );
                  setModal(null);
                } catch (e) {
                  props.notify(e instanceof Error ? e.message : 'JSON không hợp lệ.');
                }
              }}
            >
              Áp dụng cấu hình
            </button>
          </div>
        </Dialog>
      )}
      {modal === 'inputs' && (
        <Dialog title="Khai báo dữ liệu đầu vào" close={() => setModal(null)} wide>
          <p className="muted">
            Inputs được lưu cùng toàn bộ workflow. Output là dữ liệu từ kết quả chạy.
          </p>
          <div className="schema-table">
            {fields.map((f, i) => (
              <div key={i} className="schema-row">
                <input
                  aria-label={'Key field ' + (i + 1)}
                  value={f.key}
                  placeholder="caption"
                  onChange={(e) =>
                    setFields((v) =>
                      v.map((old, j) => (j === i ? { ...old, key: e.target.value } : old)),
                    )
                  }
                />
                <select
                  aria-label={'Kiểu field ' + (i + 1)}
                  value={f.type}
                  onChange={(e) =>
                    setFields((v) =>
                      v.map((old, j) =>
                        j === i ? { ...old, type: e.target.value as FieldDefinition['type'] } : old,
                      ),
                    )
                  }
                >
                  {[
                    'text',
                    'number',
                    'boolean',
                    'url',
                    'identity',
                    'datetime',
                    'file',
                    'file[]',
                    'list',
                  ].map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
                <select
                  aria-label={'Scope field ' + (i + 1)}
                  value={f.scope}
                  onChange={(e) =>
                    setFields((v) =>
                      v.map((old, j) =>
                        j === i
                          ? { ...old, scope: e.target.value as FieldDefinition['scope'] }
                          : old,
                      ),
                    )
                  }
                >
                  {['row', 'process', 'output'].map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
                <label>
                  <input
                    type="checkbox"
                    checked={f.required}
                    onChange={(e) =>
                      setFields((v) =>
                        v.map((old, j) => (j === i ? { ...old, required: e.target.checked } : old)),
                      )
                    }
                  />{' '}
                  Bắt buộc
                </label>
                <button
                  aria-label={'Xóa field ' + (i + 1)}
                  onClick={() => setFields((v) => v.filter((_f, j) => j !== i))}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
          <button
            onClick={() =>
              setFields((f) => [
                ...f,
                { key: 'field_' + (f.length + 1), type: 'text', scope: 'row', required: false },
              ])
            }
          >
            ＋ Thêm trường
          </button>
          <div className="dialog-actions">
            <button onClick={() => setModal(null)}>Hủy</button>
            <button
              className="primary"
              onClick={() => {
                if (
                  fields.some((f) => !isSafeKey(f.key)) ||
                  new Set(fields.map((f) => f.key)).size !== fields.length
                ) {
                  props.notify('Key phải hợp lệ, duy nhất và không là reserved key.');
                  return;
                }
                apply((b) => {
                  b.inputs = structuredClone(fields);
                });
                setModal(null);
              }}
            >
              Lưu schema
            </button>
          </div>
        </Dialog>
      )}
      {(modal === 'subflow' || modal === 'convert') && (
        <Dialog
          title={modal === 'convert' ? 'Chuyển vùng chọn thành quy trình con' : 'Tạo quy trình con'}
          close={() => setModal(null)}
        >
          {modal === 'convert' && (
            <p className="muted">
              Chọn vùng độc lập có một điểm vào và một đường ra next. Biến local, loop và giao dịch
              cần mapping riêng nên không được tự chuyển.
            </p>
          )}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              let created: string | undefined;
              if (
                apply((b) => {
                  if (modal === 'convert')
                    created = selectionToSubgraph(b, graphId, selected, subName).nodeId;
                  else created = createSubgraph(b, subName);
                })
              ) {
                if (modal === 'convert') setSelected([created!]);
                else {
                  setStack((s) => [...s, created!]);
                  setSelected([]);
                }
                setModal(null);
              }
            }}
          >
            <label className="field">
              <span>Tên quy trình con</span>
              <input
                required
                maxLength={120}
                value={subName}
                onChange={(e) => setSubName(e.target.value)}
              />
            </label>
            <div className="dialog-actions">
              <button type="button" onClick={() => setModal(null)}>
                Hủy
              </button>
              <button className="primary">
                {modal === 'convert' ? 'Chuyển vùng chọn' : 'Tạo quy trình con'}
              </button>
            </div>
          </form>
        </Dialog>
      )}
      {modal === 'versions' && (
        <Dialog title="Phiên bản workflow" close={() => setModal(null)}>
          <p className="muted">
            Version là snapshot bất biến. Thiết bị/app profile cần test riêng trước chạy lịch.
          </p>
          {versions.length ? (
            versions.map((v) => (
              <div className="version-row" key={v.id}>
                <strong>v{v.number}</strong>
                <span>{new Date(v.createdAt).toLocaleString('vi')}</span>
                <code>{v.hash.slice(0, 12)}</code>
              </div>
            ))
          ) : (
            <Empty title="Chưa có phiên bản">Tạo version sau khi kiểm tra graph.</Empty>
          )}
        </Dialog>
      )}
    </div>
  );
}
