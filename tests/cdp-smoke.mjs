import fs from 'node:fs';
import path from 'node:path';

const debugPort = Number(process.argv[2]);
const root = process.argv[3];
const sleep = ms => new Promise(r => setTimeout(r, ms));
const targetDeadline = Date.now() + 10000;

let page;
while (Date.now() < targetDeadline) {
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
ws.addEventListener('message', ev => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) {
    const { resolve } = pending.get(msg.id);
    pending.delete(msg.id);
    resolve(msg);
  }
});

function call(method, params = {}) {
  const id = ++seq;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`CDP timeout: ${method}`));
    }, 5000);
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

const html = `<meta name="viewport" content="width=device-width,initial-scale=1,user-scalable=no,viewport-fit=cover">
<style>html,body{margin:0;width:100%;height:100%;overflow:hidden;overscroll-behavior:none;touch-action:none;user-select:none;background:#182030}#game{width:100vw;height:100vh;display:grid;place-items:center;color:white}</style>
<script src="/sdk.js"></script><script src="debugcheck.js"></script><script src="game.js"></script>
<script type="text/plain">YaGames.init(); ysdk.features.LoadingAPI.ready(); const lang=ysdk.environment.i18n.lang;</script>`;
await evaluate(`document.head.innerHTML=${JSON.stringify(html)};document.body.innerHTML='<main id="game">Loading</main>';document.addEventListener('contextmenu',e=>e.preventDefault());`);

const sdk = fs.readFileSync(path.join(root, 'tests/fixtures/sdk.js'), 'utf8');
const checker = fs.readFileSync(path.join(root, 'debugcheck.js'), 'utf8');
await evaluate(sdk);
await evaluate(checker);
await evaluate(`window.XMLHttpRequest=function(){this.open=function(){};this.send=function(){var self=this;setTimeout(function(){if(self.onerror)self.onerror();},0);};};`);

const integration = `(async function(){
 const sdk=await YaGames.init();
 const lang=sdk.environment.i18n.lang;
 document.documentElement.lang=lang;
 document.getElementById('game').textContent='Play';
 sdk.features.LoadingAPI.ready();
 window.__readyCalled=true;
 YGDebugChecker.open();
 return true;
})()`;
await evaluate(integration, true);

const panelDeadline = Date.now() + 10000;
while (Date.now() < panelDeadline) {
  if (await evaluate("!!document.querySelector('.dc-sum')")) break;
  await sleep(100);
}
if (!(await evaluate("!!document.querySelector('.dc-sum')"))) throw new Error('checker panel did not render');

const checks = {
  title: "document.body.innerText.includes('Yandex Games Debug Checker v1.1.0')",
  notice: "document.body.innerText.includes('Unofficial pre-submit checker')",
  'req-label': "document.body.innerText.includes('REQ 1.19.2')",
  'public-api': "window.YGDebugChecker && window.YGDebugChecker.version === '1.1.0'",
  'sdk-ready': "window.__readyCalled === true",
  'runtime-caught-ready': "window.__dbg && window.__dbg.TIMING && window.__dbg.TIMING.gameReady > 0",
  'runtime-i18n': "window.__dbg && window.__dbg.RT && window.__dbg.RT._i18nRead === true",
  'no-lb-tool': "!document.body.innerText.includes('Leaderboard Test')",
};
const failed = [];
for (const [name, expr] of Object.entries(checks)) {
  let ok = false;
  try { ok = Boolean(await evaluate(expr)); } catch {}
  if (!ok) failed.push(name);
}
if (failed.length) throw new Error(`browser assertions failed: ${failed.join(', ')}`);
console.log('cdp-smoke: PASS — real Chromium DOM, SDK interception, panel render, i18n and Game Ready capture');
ws.close();
