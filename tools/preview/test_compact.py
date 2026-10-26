"""Exercise the interactive review HTML, not Android/production acceptance."""
import functools
import hashlib
import json
import threading
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'docs/previews/evidence'
OUT.mkdir(exist_ok=True)
class Quiet(SimpleHTTPRequestHandler):
    def log_message(self,*args):pass
server=ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(ROOT/'docs/previews')))
threading.Thread(target=server.serve_forever,daemon=True).start()
checks=[];errors=[]
def passed(name):checks.append({'name':name,'status':'PASS'})

try:
 with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':1600,'height':1000},timezone_id='Asia/Ho_Chi_Minh')
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto(f'http://127.0.0.1:{server.server_port}/AutoReels-Studio-Compact.html')
    page.wait_for_timeout(180)
    assert page.locator('#canvas').is_visible();assert page.locator('.workflow-top button').count()==4
    passed('Full inspector loads with four primary toolbar controls')
    page.keyboard.press('Control+k');page.locator('#studio-command-query').fill('Mở Lịch đăng');page.keyboard.press('Enter')
    assert page.evaluate('state.view')=='schedule';passed('Command palette search and Enter navigate')
    page.keyboard.press('Alt+2');assert page.locator('#canvas').is_visible();passed('Alt route shortcut')
    page.locator('[data-node="n2"] .node-name').click()
    before=page.evaluate('({x:selectedNode().x,y:selectedNode().y})')
    page.keyboard.press('ArrowRight');page.keyboard.press('Shift+ArrowDown')
    after=page.evaluate('({x:selectedNode().x,y:selectedNode().y})')
    assert after['x']==before['x']+1 and after['y']==before['y']+10;passed('Nudge is one or ten world units')
    count=page.evaluate('graph().nodes.length')
    name=page.locator('[data-prop="name"]');name.fill('Đang gõ');name.press('Control+a');name.press('Delete')
    assert page.evaluate('graph().nodes.length')==count;name.fill('Chuyển đúng video');name.blur();passed('Input editing does not delete selected nodes')
    page.evaluate('document.querySelector("#canvas").focus()');page.keyboard.press('Shift+f')
    assert page.evaluate('state.zoom')>0;passed('Fit selection works')
    pin=page.locator('[data-action="ui-pin"][data-type="tap"]');pin.scroll_into_view_if_needed();pin.click()
    assert page.evaluate('state.studio.favorites.includes("tap")');assert page.evaluate('graph().nodes.length')==count
    passed('Pin favorite without adding an unwanted node')
    page.evaluate('document.querySelector("#canvas").focus()');page.keyboard.press('Control+b')
    assert not page.locator('.node-library').is_visible();page.keyboard.press('Control+b');assert page.locator('.node-library').is_visible()
    passed('Library can collapse and restore')
    page.evaluate('fit();document.querySelector("#canvas").focus()')
    r=page.locator('#canvas').bounding_box();page.mouse.move(r['x']+r['width']/2,r['y']+20)
    old=page.evaluate('state.pan.x');page.keyboard.down('Shift');page.mouse.wheel(0,120);page.keyboard.up('Shift');page.wait_for_timeout(70)
    assert page.evaluate('state.pan.x')==old-120;passed('Shift wheel pans horizontally exactly once')
    page.evaluate('fit()');page.locator('[data-action="ui-phone-menu"]').click();page.locator('[data-action="ui-tools"]').click()
    page.locator('[data-action="ui-tools-tab"][data-tab="apps"]').click();assert page.get_by_role('button',name='Cài APK',exact=True).is_disabled()
    page.locator('[data-action="ui-tools-tab"][data-tab="network"]').click();assert page.get_by_role('button',name='Áp dụng lên máy',exact=True).is_disabled()
    page.keyboard.press('Escape');passed('Device tool tabs expose no fake working hardware actions')
    page.locator('#phone-zoom').evaluate("el=>{el.value='130';el.dispatchEvent(new Event('input',{bubbles:true}))}");page.locator('[data-action="phone-fit"]').click()
    assert page.locator('#phone-zoom-value').inner_text()=='100%';passed('Phone fit synchronizes zoom label')
    page.keyboard.press('Alt+3');page.locator('[data-action="ui-columns"]').click()
    page.locator('[data-studio-column="Hashtag"]').uncheck();page.locator('[data-action="ui-columns-apply"]').click()
    assert page.locator('#content-table thead th').filter(has_text='Hashtag').is_hidden();passed('Hide table column and retain configuration')
    old_count=page.evaluate('state.rows.length');page.locator('#content-rows tr[data-row]').first.click(button='right')
    page.locator('[data-action="ui-row-duplicate"]').click();assert page.evaluate('state.rows.length')==old_count+1
    assert page.evaluate('new Set(state.rows.map(r=>r.id)).size===state.rows.length');passed('Row context duplicate uses a new stable ID')
    page.evaluate('state.rows[0].caption="ONLY_D1";saveContext()');page.keyboard.press('Alt+1')
    page.locator('[data-device-setup="d2"]').click();assert page.evaluate('state.device')=='d2';assert page.evaluate('state.rows.length')==0
    page.locator('[data-setup-device="d1"]').click();assert page.evaluate('state.rows[0].caption')=='ONLY_D1';passed('Device navigation preserves isolated row data')
    page.keyboard.press('Alt+4');original_app=page.evaluate('state.app');page.locator('[data-library-app="tt"]').click()
    assert page.evaluate('state.app')==original_app;passed('Library filtering does not change the editor app')
    page.locator('[data-action="ui-add-app"]').click();page.locator('#studio-app-name').fill('Ứng dụng riêng');page.locator('#studio-app-package').fill('com.example.custom')
    page.locator('[data-action="ui-add-app-save"]').click();assert page.evaluate('apps.some(a=>a.pkg==="com.example.custom")')
    page.locator('[data-action="new-workflow"]').first.click();assert page.locator('#new-wf-app').input_value()==page.evaluate('state.studio.libraryFilter')
    page.locator('#new-wf-name').fill('Workflow tùy chỉnh');page.locator('[data-action="new-workflow-confirm"]').click()
    assert page.evaluate('Object.keys(state.graphs).join(",")')=='main';assert page.evaluate('state.inputs[0].key')=='content'
    passed('Custom app registration uses a generic workflow without Facebook subflows')
    page.evaluate('openWorkflow("w1")')
    page.keyboard.press('Alt+2');page.evaluate('state.inputs.push({key:"customTest",type:"text",scope:"row",required:false})')
    page.evaluate('action("workflow-duplicate")');assert page.evaluate('state.inputs.some(f=>f.key==="customTest")');passed('Workflow duplication retains custom input schema')
    page.evaluate('state.selected=["n2"];renderGraph();renderBottom();fit()');page.locator('[data-node="n2"] .node-name').click(button='right')
    assert page.locator('[data-action="ui-detach"]').is_visible();page.mouse.click(80,70);passed('Node context menu has relevant editing actions')
    page.keyboard.press('F1');assert page.get_by_role('dialog').get_attribute('aria-label').startswith('Thao tác nhanh');page.keyboard.press('Escape');passed('Shortcut help can open and close')
    # Capture a fresh default state, without edits from this test, at representative sizes.
    fresh=browser.new_context(viewport={'width':1920,'height':1080},timezone_id='Asia/Ho_Chi_Minh')
    screen=fresh.new_page();screen.on('pageerror',lambda e:errors.append(str(e)));screen.goto(f'http://127.0.0.1:{server.server_port}/AutoReels-Studio-Compact.html');screen.wait_for_timeout(150)
    screen.screenshot(path=str(OUT/'compact-inspector-1920.png'))
    for width,height in [(1600,1000),(1366,768)]:
      screen.set_viewport_size({'width':width,'height':height});screen.evaluate('renderInspector();studioInitialViewport()');screen.screenshot(path=str(OUT/f'compact-inspector-{width}.png'))
      assert screen.evaluate('document.documentElement.scrollWidth')<=width
    for view in ['devices','process','workflows','schedule','history']:
      screen.evaluate('v=>studioNavigate(v)',view);screen.screenshot(path=str(OUT/f'compact-{view}.png'))
    passed('All six routes render and desktop viewports avoid document overflow')
    browser.close()
finally:
 server.shutdown()
assert not errors,errors
source=ROOT/'docs/reference/studio-workspace/AutoReels-Workspace.html'
assert hashlib.sha256(source.read_bytes()).hexdigest()=='3afb29c567a58b654de2b555b19ed60e8e074c604b2d1d4621e77d21d44cdf54'
report={'scope':'COMPACT_HTML_PREVIEW_ONLY_NOT_ANDROID_OR_PRODUCTION_APP','status':'PASS','checks':checks,'uncaughtErrors':errors,'referenceUnchanged':True}
(OUT/'compact-preview-check.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'status':'PASS','checksPassed':len(checks),'scope':report['scope'],'uncaughtErrors':errors},ensure_ascii=False))
