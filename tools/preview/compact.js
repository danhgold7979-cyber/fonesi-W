/* HTML review helpers only: this is NOT the production workflow engine. */
const studioOriginal = {
  action, renderInspector, renderLibrary, renderProcess, renderWorkflows, renderBottom,
  advancedNode, closeModal, workflowMenu, openSub, openWorkflow, getDefinition, newWorkflow, phoneScreen, phonePick,
};
function studioPrefs() {
  state.studio ||= {};
  state.studio.favorites ||= [];
  state.studio.columns ||= {};
  state.studio.graphHistory ||= [];
  state.studio.customApps ||= [];
  return state.studio;
}
function studioButton(label, actionName, icon = 'more') {
  const b = document.createElement('button');
  b.type = 'button'; b.className = 'icon ghost'; b.dataset.action = actionName;
  b.title = label; b.setAttribute('aria-label', label); b.innerHTML = ic(icon);
  return b;
}
phoneScreen = function() {
  if(studioPrefs().customApps.some(a=>a.id===state.app))return '<div class="phone-status"><span>Khung mẫu</span><span>OFFLINE</span></div><div class="fb-header">'+esc(app().name)+'</div><div class="notice" style="margin:16px">Chưa có ảnh chụp hoặc cây UI của ứng dụng này. Cần kết nối Android trong bản desktop.</div>';
  return studioOriginal.phoneScreen();
};
phonePick = function() {
  if(studioPrefs().customApps.some(a=>a.id===state.app))return modal('Cần snapshot từ điện thoại','<div class="notice">App tùy chỉnh cần frame/XML thật để chọn phần tử. Không sử dụng selector Facebook mẫu.</div>');
  return studioOriginal.phonePick();
};
function studioA11y() {
  $$('button[title]').forEach(b => { if (!b.getAttribute('aria-label')) b.setAttribute('aria-label', b.title); });
}
function studioFit(ids = null) {
  const canvas = $('#canvas'); if (!canvas) return;
  const ns = ids ? graph().nodes.filter(n => ids.includes(n.id)) : graph().nodes;
  if (!ns.length) return toast('Chọn node để căn vừa vùng chọn.');
  const minX = Math.min(...ns.map(n => n.x)), minY = Math.min(...ns.map(n => n.y));
  const width = Math.max(...ns.map(n => n.x + (n.w || 190))) - minX;
  const height = Math.max(...ns.map(n => n.y + (n.h || 112))) - minY;
  state.zoom = Math.max(.25, Math.min(1.8, (canvas.clientWidth - 80) / Math.max(width, 1), (canvas.clientHeight - 80) / Math.max(height, 1)));
  state.pan = { x: (canvas.clientWidth - width * state.zoom) / 2 - minX * state.zoom, y: (canvas.clientHeight - height * state.zoom) / 2 - minY * state.zoom };
  renderGraph();
}
fit = () => studioFit();
function studioInitialViewport() {
  studioFit();
  if(state.zoom<.8){state.zoom=.8;state.pan={x:24,y:24};renderGraph();}
}
function studioBottomState() {
  const p=studioPrefs(),mode=p.bottomMode||'auto';
  const collapsed=mode==='collapsed'||(mode==='auto'&&!state.selected.length&&state.bottomTab==='properties');
  $('.inspector')?.classList.toggle('studio-bottom-collapsed',collapsed);
}
renderBottom = function() {studioOriginal.renderBottom();studioBottomState();};
function studioPanel(which) {
  if(state.view!=='inspector')studioNavigate('inspector');
  const p = studioPrefs();
  if (which === 'library') p.libraryHidden = !p.libraryHidden;
  else p.phoneHidden = !p.phoneHidden;
  renderInspector(); save();
}
function studioFavorites(query = '') {
  const host = $('#library-list'); if (!host || state.libraryTab !== 'nodes') return;
  const favorites = studioPrefs().favorites;
  $$('.lib-node[data-add]', host).forEach(item => {
    const type = item.dataset.add;
    const b = document.createElement('button'); b.className = 'studio-pin' + (favorites.includes(type) ? ' pinned' : '');
    b.dataset.action = 'ui-pin'; b.dataset.type = type; b.textContent = favorites.includes(type) ? '★' : '☆';
    b.title = favorites.includes(type) ? 'Bỏ ghim node' : 'Ghim node hay dùng'; b.setAttribute('aria-label', b.title);
    item.append(b);
  });
  if (!query && favorites.length) {
    const group = document.createElement('div'); group.className = 'studio-favorites';
    group.innerHTML = '<div class="group-label">Đã ghim</div>' + favorites.map(type => {
      const c = catalog.find(c => c[0] === type); return c ? `<button class="studio-favorite" data-add="${esc(type)}" draggable="true">${ic(c[2])}${esc(c[1])}</button>` : '';
    }).join('');
    group.querySelectorAll('[draggable]').forEach(b => b.ondragstart = e => e.dataTransfer.setData('text/plain', JSON.stringify({type:b.dataset.add})));
    host.prepend(group);
  }
}
renderLibrary = function(query = '') { studioOriginal.renderLibrary(query); studioFavorites(query); studioA11y(); };
renderInspector = function() {
  studioOriginal.renderInspector();
  const p = studioPrefs(), root = $('.inspector');
  root.classList.toggle('studio-library-hidden', !!p.libraryHidden);
  root.classList.toggle('studio-phone-hidden', !!p.phoneHidden);
  studioBottomState();
  $('.workflow-top [data-action="inputs"]')?.remove();
  const canvas = $('#canvas'); canvas.tabIndex = 0; canvas.setAttribute('aria-label', 'Canvas workflow');
  $('.canvas-tools')?.prepend(studioButton('Ẩn/hiện thư viện · Ctrl+B', 'ui-library', 'layout'));
  $('.phone-heading > .row')?.append(studioButton('Ẩn điện thoại · Ctrl+Alt+P', 'ui-phone', 'close'));
  const nav = $('.phone-controls');
  if (nav) {
    const quick = document.createElement('div'); quick.className = 'studio-quick'; nav.parentNode.insertBefore(quick, nav); quick.append(nav);
    quick.append(studioButton('Ứng dụng và nút nhanh', 'ui-phone-menu', 'more'));
  }
  const top = $('.topbar > .row');
  if (top && !top.querySelector('[data-action="ui-palette"]')) {
    const b = studioButton('Tìm lệnh hoặc node · Ctrl+K', 'ui-palette', 'search'); b.className = 'studio-command-button';
    b.innerHTML += '<span class="studio-command-label">Tìm lệnh</span><span class="kbd">Ctrl K</span>'; top.prepend(b);
  }
  canvas.addEventListener('wheel', e => {
    if (e.shiftKey && !e.ctrlKey && !e.metaKey) { e.preventDefault(); e.stopImmediatePropagation(); state.pan.x -= e.deltaY || e.deltaX; renderGraph(); }
  }, {capture:true, passive:false});
  studioA11y();
};
function studioColumns() {
  const hidden = studioPrefs().columns[state.workflow] || [];
  const heads = $$('#content-table thead th');
  heads.forEach((th, index) => {
    if (!index || index === heads.length - 1) return;
    const hide = hidden.includes(th.textContent.trim());
    $$('#content-table tr').forEach(tr => { if (tr.children[index]) tr.children[index].style.display = hide ? 'none' : ''; });
  });
}
renderProcess = function() {
  studioOriginal.renderProcess(); studioColumns();
  $('.card-head .row:last-child')?.append(studioButton('Ẩn/hiện cột', 'ui-columns', 'table'));
  $$('#content-rows tr[data-row]').forEach(row => row.oncontextmenu = e => {
    e.preventDefault(); const item = state.rows.find(r => r.id === row.dataset.row);
    if (!item.checked) state.rows.forEach(r => r.checked = r.id === item.id);
    $$('#content-rows tr[data-row]').forEach(tr=>{const selected=!!state.rows.find(r=>r.id===tr.dataset.row)?.checked;tr.classList.toggle('studio-selected',selected);const check=tr.querySelector('[data-row-check]');if(check)check.checked=selected;});
    showMenu(e.clientX, e.clientY, [
      ['bulk-edit','edit','Sửa nội dung đã chọn'], ['ui-row-duplicate','copy','Nhân bản · đặt lại lịch'],
      ['ui-copy-caption','text','Sao chép caption'], ['ui-copy-path','folder','Sao chép đường dẫn'],
      ['ui-row-clear','calendar','Xóa lịch chưa đăng'], ['delete-rows','trash','Xóa khỏi danh sách'],
      ['ui-columns','table','Ẩn/hiện cột'],
    ]);
  });
  studioA11y();
};
renderWorkflows = function() {
  const actual = state.app;
  state.app = studioPrefs().libraryFilter || actual;
  try { studioOriginal.renderWorkflows(); } finally { state.app = actual; }
  const toolbar=$('#main .toolbar');
  if(toolbar){
    const custom=studioPrefs().customApps;
    toolbar.querySelectorAll('[data-library-app]').forEach(b=>{if(custom.some(a=>a.id===b.dataset.libraryApp))b.remove();});
    if(custom.length){
      const picker=document.createElement('select');picker.setAttribute('aria-label','Ứng dụng đã thêm');
      const blank=document.createElement('option');blank.value='';blank.textContent='Ứng dụng đã thêm…';picker.append(blank);
      custom.forEach(a=>{const o=document.createElement('option');o.value=a.id;o.textContent=a.name;o.selected=a.id===studioPrefs().libraryFilter;picker.append(o);});
      picker.onchange=()=>{if(picker.value){studioPrefs().libraryFilter=picker.value;renderWorkflows();save();}};
      toolbar.append(picker);
    }
    toolbar.append(studioButton('Thêm ứng dụng theo package','ui-add-app','plus'));
  }
  studioA11y();
};
getDefinition = function(id) {
  const w=state.workflows.find(w=>w.id===id);
  if(w&&studioPrefs().customApps.some(a=>a.id===w.app)&&!state.workflowBundles?.[id]){
    return {graphs:{main:clone(state.graphs['wf:'+id]||{nodes:[node('start','start','Bắt đầu',40,80),node('end','end','Kết thúc',350,80)],edges:[edge('start','end')],groups:[]})},inputs:[{key:'content',type:'text',scope:'row',required:true}]};
  }
  return studioOriginal.getDefinition(id);
};
newWorkflow = function() {
  const actual=state.app;
  state.app=studioPrefs().libraryFilter||actual;
  try{studioOriginal.newWorkflow();}finally{state.app=actual;}
};
workflowMenu = function(id) {
  studioOriginal.workflowMenu(id);
  $('.modal-footer')?.prepend(studioButton('Khai báo đầu vào', 'inputs', 'table'));
  studioA11y();
};
advancedNode = function() {
  studioOriginal.advancedNode(); const n = selectedNode(); if (!n) return;
  const gestures = ['tap','doubletap','hold','drag','swipe','pinch'];
  const controls = {
    'adv-from': ['drag','swipe','pinch'].includes(n.type), 'adv-to': ['drag','swipe','pinch'].includes(n.type),
    'adv-loops': ['loop','scroll'].includes(n.type), 'adv-confidence': ['image','ocr'].includes(n.type),
    'adv-inputmode': ['type','clear'].includes(n.type), 'adv-duration': gestures.includes(n.type),
  };
  for (const [id, visible] of Object.entries(controls)) { const e = $('#'+id); if (e) e.parentElement.hidden = !visible; }
};
closeModal = function() { studioOriginal.closeModal(); window.edgeToInsert = null; };
openSub = function(key) {
  if (key && state.graphs[key]) studioPrefs().graphHistory.push(state.graphKey);
  studioOriginal.openSub(key);
};
openWorkflow = function(id) {
  if (id !== state.workflow) studioPrefs().graphHistory = [];
  studioOriginal.openWorkflow(id);
};
saveContext = function() {
  state.contexts[contextKey()] = {
    rows:clone(state.rows), slots:clone(state.slots), daily:state.daily,
    startDate:state.startDate, weekdays:clone(state.weekdays),
    sourcePolicies:Object.fromEntries(['autoAppend','dedupe','subfolders','watcher'].map(k=>[k,state.settings[k]??(k==='dedupe')])),
  };
};
switchContext = function(changes) {
  saveContext();
  const changingWorkflow=changes.workflow&&changes.workflow!==state.workflow;
  if(changingWorkflow)rememberDefinition();
  const bundle=changingWorkflow?getDefinition(changes.workflow):null;
  Object.assign(state,changes);
  if(bundle){state.graphs=bundle.graphs;state.inputs=bundle.inputs;state.graphKey='main';studioPrefs().graphHistory=[];}
  const stored=state.contexts[contextKey()];
  state.rows=stored?clone(stored.rows):[];
  state.slots=stored?clone(stored.slots):['08:00','12:00','19:00'];
  state.daily=stored?.daily||3;
  state.startDate=stored?.startDate||new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Ho_Chi_Minh'});
  state.weekdays=stored?.weekdays?clone(stored.weekdays):[1,2,3,4,5,6,0];
  Object.assign(state.settings,stored?.sourcePolicies||{autoAppend:false,dedupe:true,subfolders:false,watcher:false});
  render();save();
};
function studioPhoneMenu(anchor) {
  const r = anchor?.getBoundingClientRect() || {left:innerWidth - 280,bottom:150};
  showMenu(r.left, r.bottom, [
    ['ui-hardware-open','external','Mở ứng dụng đang chọn'], ['ui-hardware-gallery','image','Thư viện ảnh'],
    ['ui-hardware-files','folder','Tệp trên điện thoại'], ['ui-hardware-settings','settings','Cài đặt Android'],
    ['ui-hardware-browser','external','Trình duyệt'], ['ui-hardware-shot','image','Chụp màn hình'],
    ['ui-hardware-vpn','network','VPN đang cấu hình'],
    ['ui-hardware-reconnect','refresh','Kết nối lại ADB'], ['ui-hardware-force-stop','stop','Dừng app quản lý'],
    ['ui-tools','settings','Thiết bị · APK · Proxy/VPN'],
  ]);
}
showCanvasMenu = function(x,y,type) {
  const shared = [['ui-palette','search','Tìm lệnh / node','Ctrl+K'],['ui-fit-selection','fit','Vừa vùng chọn','Shift+F']];
  const entries = type === 'edge' ? [
    ['delete-selected','trash','Xóa liên kết','Del'],['insert-edge','plus','Chèn node vào dây'],['reroute-edge','link','Thêm / bỏ điểm bẻ dây'],
  ] : type === 'node' ? [
    ['run-selected','play','Thử node · mô phỏng'],['run-from','step','Thử từ node · mô phỏng'],
    ['advanced-node','settings','Cấu hình nâng cao'],['rename-node','edit','Đổi tên','F2'],
    ['duplicate','copy','Nhân bản','Ctrl+D'],['copy','copy','Sao chép','Ctrl+C'],
    ['ui-detach','link','Ngắt liên kết node chọn'],['breakpoint','flag','Đặt / bỏ breakpoint'],
    ['group','box','Nhóm trực quan'],['convert-sub','workflow','Chuyển thành quy trình con'],['delete-selected','trash','Xóa node','Del'],
  ] : [
    ['add-node','plus','Thêm node'],['paste','copy','Dán node','Ctrl+V'],['select-all','grid','Chọn tất cả','Ctrl+A'],
    ['layout','layout','Sắp xếp ngang'],['layout-vertical','layout','Sắp xếp dọc'],['align','align','Căn node đã chọn'],
    ['fit','fit','Vừa toàn bộ','Ctrl+0'],['ui-library','layout','Ẩn/hiện thư viện','Ctrl+B'],
    ['ui-phone','phone','Ẩn/hiện điện thoại','Ctrl+Alt+P'],['minimap','grid','Ẩn/hiện minimap'],['ui-help','help','Phím tắt và hướng dẫn','F1'],
  ];
  showMenu(x,y,[...shared,null,...entries]); studioA11y();
};
function studioCommands() {
  return [
    ...[['devices','Điện thoại'],['inspector','Inspector'],['process','Tiến trình'],['workflows','Thư viện'],['schedule','Lịch đăng'],['history','Lịch sử']].map(([view,label],i) => ({label:'Mở '+label,key:'Alt+'+(i+1),run:()=>studioNavigate(view)})),
    {label:'Lưu bản nháp / tiến trình',key:'Ctrl+S',run:()=>action(state.view==='process'?'process-save':'save')},
    {label:'Kiểm tra cấu trúc workflow',key:'Ctrl+Enter',run:()=>{studioNavigate('inspector');action('validate');}},
    {label:'Vừa toàn bộ canvas',key:'Ctrl+0',run:()=>{studioNavigate('inspector');fit();}},
    {label:'Vừa vùng chọn',key:'Shift+F',run:()=>{studioNavigate('inspector');studioFit(state.selected);}},
    {label:'Ẩn/hiện thư viện',key:'Ctrl+B',run:()=>studioPanel('library')},
    {label:'Ẩn/hiện điện thoại',key:'Ctrl+Alt+P',run:()=>studioPanel('phone')},
    {label:'Thiết bị · APK · Proxy/VPN',run:()=>studioTools()},
    {label:'Hướng dẫn thao tác và phím tắt',key:'F1',run:()=>studioHelp()},
    ...graph().nodes.map(n=>({label:'Đến node: '+n.name+' · '+n.id,run:()=>{studioNavigate('inspector');state.selected=[n.id];renderGraph();renderBottom();studioFit([n.id]);}})),
  ];
}
function studioPalette() {
  modal('Tìm lệnh và node', '<input id="studio-command-query" style="width:100%" placeholder="Nhập lệnh, tên node hoặc ID…" autocomplete="off"><div id="studio-command-results" class="studio-palette"></div><div id="studio-command-count" class="studio-palette-count"></div>', '<span class="muted tiny">↑ ↓ chọn · Enter thực hiện · Esc đóng</span>');
  const input = $('#studio-command-query');
  const draw = () => {
    const q = input.value.toLocaleLowerCase('vi');
    const items = studioCommands().filter(c=>c.label.toLocaleLowerCase('vi').includes(q));
    const host=$('#studio-command-results');host.replaceChildren();
    items.forEach(c=>{const b=document.createElement('button');b.type='button';b.textContent=c.label;if(c.key){const k=document.createElement('span');k.className='kbd';k.textContent=c.key;b.append(k);}b.onclick=()=>{closeModal();c.run();};host.append(b);});
    $('#studio-command-count').textContent=items.length+' kết quả';
  };
  input.oninput=draw;
  $('.modal').addEventListener('keydown',e=>{
    const buttons=$$('#studio-command-results button');
    if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();const i=buttons.indexOf(document.activeElement);buttons[(i+(e.key==='ArrowDown'?1:-1)+buttons.length)%buttons.length]?.focus();}
    if(e.key==='Enter'&&document.activeElement===input){e.preventDefault();buttons[0]?.click();}
  });
  draw();input.focus();
}
function studioNavigate(view) { stopRun(false);state.view=view;render();save(); }
function studioTools(tab='connection') {
  studioPrefs().toolsTab=tab;
  const note='<div class="notice">Bản HTML chỉ cho xem bố cục. Chưa kết nối Android; các lệnh cài/gỡ, đổi mạng và điều khiển thiết bị đang tắt.</div>';
  const body=tab==='apps' ? '<div class="form-grid two"><div><label>Tệp APK</label><input type="file" accept=".apk" aria-label="Chọn APK để xem cấu hình"></div><div><label>Package</label><input placeholder="com.example.app" aria-label="Package ứng dụng"></div></div><div class="row studio-tool-footer"><button disabled title="Cần backend Android">Cài APK</button><button disabled title="Cần backend Android">Gỡ ứng dụng</button><button disabled title="Cần backend Android">Mở ứng dụng</button></div>' : tab==='network' ? '<div class="form-grid two"><div><label>Chế độ mạng</label><select aria-label="Chế độ mạng"><option>Trực tiếp</option><option>Proxy</option><option>VPN</option></select></div><div><label>Proxy / profile</label><input placeholder="protocol://host:port" aria-label="Cấu hình proxy minh họa"></div></div><div class="row studio-tool-footer"><button disabled title="Cần backend mạng">Kiểm tra routing</button><button disabled title="Cần backend Android">Áp dụng lên máy</button></div><p class="muted tiny" style="margin-top:12px">Proxy và VPN loại trừ nhau; hỗ trợ từng loại được xác nhận bằng kiểm tra thiết bị thật.</p>' : '<div class="form-grid two"><div><label>Thiết bị kiểm thử</label><input readonly value="'+esc(dev().name)+' · mẫu"></div><div><label>Địa chỉ LAN</label><input placeholder="192.168.1.100:5555" aria-label="Địa chỉ LAN minh họa"></div></div><div class="row studio-tool-footer"><button disabled title="Cần backend ADB">Quét USB</button><button disabled title="Cần backend ADB">Kết nối LAN</button><button disabled title="Cần backend ADB">Kết nối lại</button></div>';
  modal('Công cụ thiết bị', '<div class="tabs studio-tools-tabs">'+[['connection','Kết nối'],['apps','Ứng dụng'],['network','Mạng']].map(([key,label])=>`<button data-action="ui-tools-tab" data-tab="${key}" class="${key===tab?'active':''}">${label}</button>`).join('')+'</div>'+note+'<div class="studio-tools-body">'+body+'</div>');
}
function studioHelp() {
  modal('Thao tác nhanh · Studio Compact', '<div class="studio-help-grid"><section><h3>Bàn phím</h3>'+[
    ['Ctrl+K','Tìm lệnh hoặc node'],['Alt+1…6','Đổi màn hình'],['Ctrl+S','Lưu cấu hình đang chỉnh'],['Ctrl+Enter','Kiểm tra graph'],['Ctrl+Z / Shift+Z','Hoàn tác / làm lại'],['Ctrl+C / V / D','Copy / paste / nhân bản node'],['Shift+F / Ctrl+0','Vừa vùng chọn / toàn bộ'],['Mũi tên / Shift+mũi tên','Dịch node 1 / 10 đơn vị'],['Ctrl+B','Ẩn/hiện thư viện'],['Ctrl+Alt+P','Ẩn/hiện điện thoại'],['F2 / Delete','Đổi tên / xóa node'],['Shift+F10','Menu ngữ cảnh canvas'],['F1 / Esc','Hướng dẫn / hủy thao tác'],
  ].map(([key,t])=>`<p><span class="kbd">${key}</span> ${t}</p>`).join('')+'</section><section><h3>Chuột và bố cục</h3><p>Ctrl+lăn: zoom quanh con trỏ.</p><p>Lăn: pan dọc; Shift+lăn: pan ngang.</p><p>Kéo nền / Space+kéo / chuột giữa: pan.</p><p>Shift+bấm hoặc kéo vùng: chọn nhiều node.</p><p>Chuột phải node, dây, nền và dòng nội dung: menu đúng ngữ cảnh.</p><p>Ngôi sao trong thư viện: ghim node hay dùng.</p><p>Panel ít dùng có thể thu gọn; tùy chọn nâng cao chỉ hiện theo loại node.</p><div class="notice" style="margin-top:14px">Phím sửa node chỉ tác động khi canvas có focus. Điện thoại, cây UI và run trong bản này vẫn là minh họa.</div></section></div>',btn('modal-close',null,'Đóng'),true);
}
async function studioCopy(value) {
  try { await navigator.clipboard.writeText(String(value||''));toast('Đã sao chép.'); }
  catch { modal('Sao chép nội dung','<textarea readonly aria-label="Nội dung để sao chép">'+esc(value||'')+'</textarea>'); }
}
action = function(a,el) {
  if(a==='ui-add-app')return modal('Thêm ứng dụng theo package','<div class="notice">Đăng ký cấu hình app cho workflow. Bản HTML không kiểm tra package đã cài trên điện thoại.</div><div class="form-grid two"><div><label>Tên hiển thị</label><input id="studio-app-name" placeholder="Ví dụ: Ứng dụng của tôi"></div><div><label>Android package</label><input id="studio-app-package" placeholder="com.example.app"></div></div>',btn('modal-close',null,'Hủy')+btn('ui-add-app-save','plus','Thêm cấu hình','primary'));
  if(a==='ui-add-app-save'){
    const name=$('#studio-app-name').value.trim(),pkg=$('#studio-app-package').value.trim();
    if(!name||/[<>&"'`]/.test(name)||name.length>80)return toast('Nhập tên app dạng văn bản, tối đa 80 ký tự.');
    if(!/^([A-Za-z_][A-Za-z0-9_]*\.)+[A-Za-z_][A-Za-z0-9_]*$/.test(pkg))return toast('Package Android chưa hợp lệ.');
    if(apps.some(a=>a.pkg===pkg))return toast('Package này đã có trong danh sách.');
    const a={id:uid('app-'),name,pkg,logo:'A',cls:''};apps.push(a);studioPrefs().customApps.push(a);studioPrefs().libraryFilter=a.id;closeModal();renderWorkflows();save();return;
  }
  if(a==='bottom-toggle'){studioPrefs().bottomMode=$('.inspector')?.classList.contains('studio-bottom-collapsed')?'expanded':'collapsed';studioBottomState();save();return;}
  if(a==='ui-palette')return studioPalette();
  if(a==='ui-help'||a==='help')return studioHelp();
  if(a==='ui-library')return studioPanel('library');
  if(a==='ui-phone')return studioPanel('phone');
  if(a==='ui-fit-selection')return studioFit(state.selected);
  if(a==='ui-phone-menu')return studioPhoneMenu(el);
  if(a==='ui-tools'||a==='device-manager')return studioTools();
  if(a==='ui-tools-tab')return studioTools(el.dataset.tab);
  if(a.startsWith('ui-hardware-'))return modal('Thao tác điện thoại','<div class="notice">Cần backend ADB/scrcpy và điện thoại thật để thực hiện. Bản HTML này không gửi lệnh tới Android.</div>');
  if(a==='ui-pin'){
    const list=studioPrefs().favorites,type=el.dataset.type,index=list.indexOf(type);index<0?list.push(type):list.splice(index,1);renderLibrary($('#node-search')?.value||'');save();return;
  }
  if(a==='ui-detach'){
    checkpoint();const ids=new Set(state.selected);graph().edges=graph().edges.filter(e=>!ids.has(e.a)&&!ids.has(e.b));renderGraph();save();return;
  }
  if(a==='ui-columns'){
    const heads=$$('#content-table thead th'),hidden=studioPrefs().columns[state.workflow]||[];
    return modal('Ẩn/hiện cột nội dung','<div class="studio-column-list">'+heads.slice(1,-1).map(h=>{const name=h.textContent.trim();return `<label class="checkbox-label"><input type="checkbox" data-studio-column="${esc(name)}" ${hidden.includes(name)?'':'checked'}>${esc(name)}</label>`;}).join('')+'</div>',btn('modal-close',null,'Đóng')+btn('ui-columns-apply','check','Áp dụng','primary'));
  }
  if(a==='ui-columns-apply'){
    studioPrefs().columns[state.workflow]=$$('[data-studio-column]').filter(e=>!e.checked).map(e=>e.dataset.studioColumn);closeModal();renderProcess();save();return;
  }
  if(a==='ui-row-duplicate'){
    const copies=state.rows.filter(r=>r.checked).map(r=>({...clone(r),id:uid('content-'),scheduled:'',status:'Chưa lên lịch',checked:false}));state.rows.push(...copies);saveContext();save();renderProcess();return;
  }
  if(a==='ui-row-clear'){
    state.rows.filter(r=>r.checked&&!r.status.includes('Đã đăng')).forEach(r=>{r.scheduled='';r.status='Chưa lên lịch';});saveContext();save();renderProcess();return;
  }
  if(a==='ui-copy-caption'||a==='ui-copy-path'){
    const r=state.rows.find(r=>r.checked);return studioCopy(a==='ui-copy-caption'?r?.caption:(r?.path||'')+(r?.file||''));
  }
  if(a==='parent'){
    stopRun(false);state.graphKey=studioPrefs().graphHistory.pop()||'main';state.selected=[];renderInspector();fit();return;
  }
  if(a==='workflow-duplicate'){
    rememberDefinition();const bundle=clone({graphs:Object.fromEntries(Object.entries(state.graphs).filter(([k])=>!k.startsWith('wf:'))),inputs:state.inputs});const w={...clone(wf()),id:uid('w'),name:wf().name+' · Bản sao'};
    state.workflows.push(w);state.workflowBundles ||= {};state.workflowBundles[w.id]=bundle;closeModal();openWorkflow(w.id);save();return;
  }
  studioOriginal.action(a,el);
  if(a==='source-save'){saveContext();save();}
  if(a==='phone-fit'&&$('#phone-zoom-value'))$('#phone-zoom-value').textContent='100%';
  if(a==='save')$('#status-detail').textContent='Bản nháp HTML cục bộ · không chạy Android';
  studioA11y();
};
document.addEventListener('click', e=>{
  const b=e.target.closest('[data-library-app]');
  if(b){e.preventDefault();e.stopImmediatePropagation();studioPrefs().libraryFilter=b.dataset.libraryApp;renderWorkflows();save();}
  const setup=e.target.closest('[data-device-setup]');
  const card=e.target.closest('[data-device-card]');
  if(setup||(card&&!e.target.closest('input,button'))){
    e.preventDefault();e.stopImmediatePropagation();
    const id=setup?setup.dataset.deviceSetup:card.dataset.deviceCard;
    if(setup)state.view='process';switchContext({device:id});
  }
},true);
document.addEventListener('change',e=>{if(e.target.matches('[data-row-check]'))e.target.closest('tr')?.classList.toggle('studio-selected',e.target.checked);});
document.addEventListener('pointerdown',e=>{
  if(e.target.closest('#canvas')&&!e.target.closest('input,textarea,select,button')){
    if(e.button===0||e.button===1)e.preventDefault();
    $('#canvas')?.focus({preventScroll:true});
  }
},true);
let studioNudge=false;
document.addEventListener('keydown',e=>{
  const typing=!!e.target.closest('input,textarea,select,[contenteditable]'),ctrl=e.ctrlKey||e.metaKey,key=e.key.toLowerCase();
  const consume=()=>{e.preventDefault();e.stopImmediatePropagation();};
  if(ctrl&&key==='k'){consume();studioPalette();return;}
  if(e.key==='F1'){consume();studioHelp();return;}
  if(ctrl&&key==='s'){consume();e.target.blur?.();action(state.view==='process'?'process-save':'save');return;}
  if(!typing&&e.altKey&&/^[1-6]$/.test(e.key)){consume();studioNavigate(['devices','inspector','process','workflows','schedule','history'][+e.key-1]);return;}
  if(typing||$('#overlay').children.length)return;
  const canvasFocus=state.view==='inspector'&&!!document.activeElement?.closest('#canvas');
  if(!canvasFocus&&(e.code==='Space'||(ctrl&&['a','c','v','d','z','y','0'].includes(key))||['Delete','Backspace','F2'].includes(e.key))){e.stopImmediatePropagation();return;}
  if(state.view!=='inspector')return;
  if(ctrl&&e.altKey&&key==='p'){consume();studioPanel('phone');return;}
  if(ctrl&&!e.shiftKey&&key==='b'){consume();studioPanel('library');return;}
  if(ctrl&&e.key==='Enter'){consume();action('validate');return;}
  if(canvasFocus&&e.shiftKey&&key==='f'){consume();studioFit(state.selected);return;}
  if(canvasFocus&&e.shiftKey&&e.key==='F10'){consume();const r=$('#canvas').getBoundingClientRect();showCanvasMenu(r.left+50,r.top+50,state.selected.length?'node':'canvas');return;}
  if(canvasFocus&&['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)&&state.selected.length){
    consume();if(!studioNudge){checkpoint();studioNudge=true;}const delta=e.shiftKey?10:1;
    graph().nodes.filter(n=>state.selected.includes(n.id)).forEach(n=>{n.x+=e.key==='ArrowLeft'?-delta:e.key==='ArrowRight'?delta:0;n.y+=e.key==='ArrowUp'?-delta:e.key==='ArrowDown'?delta:0;});renderGraph();
  }
},true);
document.addEventListener('keyup',e=>{if(studioNudge&&e.key.startsWith('Arrow')){studioNudge=false;save();}},true);
document.addEventListener('wheel',e=>{
  if(e.ctrlKey&&e.target.closest('#phone-screen')){const slider=$('#phone-zoom');if(!slider)return;e.preventDefault();e.stopImmediatePropagation();slider.value=String(Math.max(70,Math.min(150,+slider.value+(e.deltaY<0?5:-5))));slider.dispatchEvent(new Event('input',{bubbles:true}));}
},{capture:true,passive:false});
studioPrefs();
studioPrefs().customApps.forEach(a=>{if(!apps.some(x=>x.id===a.id))apps.push({...a,logo:'A',cls:''});});
render();
studioA11y();
document.title='AutoReels Studio · Compact Preview';
$('.statusbar > span:last-child').textContent='HTML xem trước · Compact 2.1';
setTimeout(()=>{if(state.view==='inspector')studioInitialViewport();},120);
