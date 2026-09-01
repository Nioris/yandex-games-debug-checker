import fs from 'node:fs';
import path from 'node:path';

const debugPort = Number(process.argv[2]);
const root = process.argv[3];
const mode = process.argv[4] || 'after';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const deadline = Date.now() + 12000;

let page;
while (Date.now() < deadline) {
  try {
    const res = await fetch(`http://127.0.0.1:${debugPort}/json/list`);
    const list = await res.json();
    page = list.find(t => t.type === 'page');
  } catch {}
  if (page) break;
  await sleep(100);
}
if (!page) throw new Error('CDP target not found');

const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  ws.addEventListener('open', resolve, { once: true });
  ws.addEventListener('error', reject, { once: true });
});

let seq = 0;
const pending = new Map();
const exceptions = [];
ws.addEventListener('message', ev => {
  const msg = JSON.parse(ev.data);
  if (msg.method === 'Runtime.exceptionThrown') exceptions.push(msg.params?.exceptionDetails?.text || 'runtime exception');
  if (msg.id && pending.has(msg.id)) {
    const { resolve } = pending.get(msg.id);
    pending.delete(msg.id);
    resolve(msg);
  }
});
function call(method, params = {}) {
  const id = ++seq;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`CDP timeout: ${method}`)); }, 6000);
    pending.set(id, { resolve: msg => { clearTimeout(timer); resolve(msg); } });
    ws.send(JSON.stringify({ id, method, params }));
  });
}
async function evaluate(expression, awaitPromise = false) {
  const msg = await call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise });
  if (msg.error) throw new Error(JSON.stringify(msg.error));
  if (msg.result?.exceptionDetails) throw new Error(msg.result.exceptionDetails.text || 'Runtime exception');
  const result = msg.result?.result;
  if (result?.subtype === 'error') throw new Error(result.description || 'Evaluation error');
  return result?.value;
}
await call('Runtime.enable');
await call('Page.enable');
await call('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });

const exampleDir = path.join(root, 'examples', 'orc-castle');
const htmlPath = path.join(exampleDir, mode, mode === 'after' ? 'index.mock.html' : 'index.html');
const html = fs.readFileSync(htmlPath, 'utf8');
const checker = fs.readFileSync(path.join(root, 'debugcheck.js'), 'utf8');
const mock = fs.readFileSync(path.join(exampleDir, 'mock-sdk.js'), 'utf8');

// Remove all script elements, install the real DOM/CSS, then evaluate scripts in controlled order.
const inlineScripts = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)].map(m => m[1]);
if (inlineScripts.length !== 1) throw new Error(`expected one game inline script, got ${inlineScripts.length}`);
const domHtml = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
await evaluate(`document.open();document.write(${JSON.stringify(domHtml)});document.close();`);

// Give debugcheck its actual source when it asks for index.html. This keeps static checks honest
// even though this harness deliberately runs from about:blank because localhost/file navigation
// may be blocked in sandboxed CI environments.
await evaluate(`(function(){
  const indexSource=${JSON.stringify(html)};
  const linkedMock=${JSON.stringify(mock)};
  window.XMLHttpRequest=function(){
    this.status=0;this.responseText='';this.open=function(method,url){this.url=String(url)};
    this.send=function(){
      const self=this;setTimeout(function(){
        if(/mock-sdk\\.js/.test(self.url)){self.status=200;self.responseText=linkedMock;if(self.onload)self.onload();return;}
        if(/index\\.html|about:blank/.test(self.url)){self.status=200;self.responseText=indexSource;if(self.onload)self.onload();return;}
        self.status=404;if(self.onload)self.onload();
      },0);
    };
  };
})();`);

// The before fixture intentionally has no platform integration. We still inject a runtime SDK
// so the game can be observed in the same browser environment without contaminating its source.
await evaluate(mock);
await evaluate(checker);
await evaluate(inlineScripts[0]);

if (mode === 'after') {
  while (Date.now() < deadline) {
    if (await evaluate("window.__orcDemoPlatform && window.__orcDemoPlatform.ready === true")) break;
    await sleep(50);
  }
  if (!(await evaluate("window.__orcDemoPlatform && window.__orcDemoPlatform.ready === true"))) throw new Error('platform bootstrap did not complete');
  const assertions = {
    'checker-api': "window.YGDebugChecker && window.YGDebugChecker.version === '1.1.1'",
    'start-enabled': "document.getElementById('bstart').disabled === false",
    'sdk-init': "window.__mockYandexEvents.some(e=>e.name==='YaGames.init')",
    'game-ready': "window.__mockYandexEvents.some(e=>e.name==='LoadingAPI.ready')",
    'runtime-ready-captured': "window.__dbg && window.__dbg.TIMING.gameReady > 0",
    'runtime-lang-captured': "window.__dbg && window.__dbg.RT._i18nRead === true",
    'contextmenu-blocked': `(()=>{const e=new MouseEvent('contextmenu',{bubbles:true,cancelable:true});document.body.dispatchEvent(e);return e.defaultPrevented})()`,
    'canvas-sized': "document.getElementById('c').width > 0 && document.getElementById('c').height > 0",
  };
  const failed=[];
  for (const [name, expr] of Object.entries(assertions)) if (!await evaluate(expr)) failed.push(name);
  if (failed.length) throw new Error(`after assertions failed: ${failed.join(', ')}`);

  // Start/pause/resume demonstrate the optional GameplayAPI lifecycle without changing game rules.
  await evaluate(`document.getElementById('bstart').click()`);
  await sleep(80);
  if (!(await evaluate("state==='play' && window.__mockYandexEvents.some(e=>e.name==='GameplayAPI.start')"))) throw new Error('gameplay start not marked');
  await evaluate('togglePause()');
  if (!(await evaluate("paused===true && window.__mockYandexEvents.some(e=>e.name==='GameplayAPI.stop')"))) throw new Error('gameplay stop not marked on pause');
  await evaluate('togglePause()');
  if (!(await evaluate("paused===false && window.__mockYandexEvents.filter(e=>e.name==='GameplayAPI.start').length>=2"))) throw new Error('gameplay resume not marked');
}

// Render checker and capture a machine-readable report snapshot.
await evaluate('YGDebugChecker.open()');
while (Date.now() < deadline) {
  if (await evaluate("document.querySelectorAll('.dc-sum .dc-sn').length===5")) break;
  await sleep(50);
}
if (!(await evaluate("document.querySelectorAll('.dc-sum .dc-sn').length===5"))) throw new Error('checker summary did not render');
const nums = await evaluate("Array.from(document.querySelectorAll('.dc-sum .dc-sn')).map(x=>x.textContent)");
const summary = { pass:Number(nums[0]), fail:Number(nums[1]), warn:Number(nums[2]), notVerified:Number(nums[3]), score:nums[4] };
if (mode === 'after') {
  const localizationProof = await evaluate(`(()=>{
    const rows=Array.from(document.querySelectorAll('.dc-row'));
    const pass=(name)=>rows.some(r=>(r.querySelector('.dc-name')?.textContent||'').includes(name)&&!!r.querySelector('.dc-pass'));
    return pass('environment.i18n.lang') && pass('Yandex lang fallback') && pass('SDK language read before Game Ready');
  })()`);
  if(!localizationProof) throw new Error('after example must automatically PASS runtime language read, fallback, and read-before-ready ordering');
}
if (mode === 'after' && summary.fail !== 0) {
  const failures = await evaluate("Array.from(document.querySelectorAll('.dc-row')).filter(r=>r.querySelector('.dc-fail')).map(r=>r.innerText).join('\\n')");
  throw new Error(`after example still has hard FAILs: ${JSON.stringify(summary)}\n${failures}`);
}
if (mode === 'before' && summary.fail < 2) throw new Error(`before fixture should demonstrate failures, got ${JSON.stringify(summary)}`);

const warningRows = await evaluate("Array.from(document.querySelectorAll('.dc-row')).filter(r=>r.querySelector('.dc-warn')).map(r=>({name:r.querySelector('.dc-name')?.textContent.trim()||'',detail:r.querySelector('.dc-det')?.textContent.trim()||''}))");
const failureRows = await evaluate("Array.from(document.querySelectorAll('.dc-row')).filter(r=>r.querySelector('.dc-fail')).map(r=>({name:r.querySelector('.dc-name')?.textContent.trim()||'',detail:r.querySelector('.dc-det')?.textContent.trim()||''}))");
const notVerifiedRows = await evaluate("Array.from(document.querySelectorAll('.dc-row')).filter(r=>r.querySelector('.dc-nv')).map(r=>({name:r.querySelector('.dc-name')?.textContent.trim()||'',detail:r.querySelector('.dc-det')?.textContent.trim()||''}))");
if (exceptions.length) throw new Error(`runtime exceptions: ${exceptions.join(' | ')}`);
console.log(`orc-castle-${mode}: PASS — ${summary.pass} pass / ${summary.fail} fail / ${summary.warn} warn / ${summary.notVerified} not verified`);
console.log(JSON.stringify({mode,summary,warnings:warningRows,notVerified:notVerifiedRows,failures:failureRows}));
ws.close();
