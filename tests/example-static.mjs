import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const base=path.join(root,'examples','orc-castle');
const before=fs.readFileSync(path.join(base,'before','index.html'),'utf8');
const after=fs.readFileSync(path.join(base,'after','index.html'),'utf8');
const afterMock=fs.readFileSync(path.join(base,'after','index.mock.html'),'utf8');
const mock=fs.readFileSync(path.join(base,'mock-sdk.js'),'utf8');

for (const [name,html] of [['before',before],['after',after]]) {
  assert.ok(html.includes('<script src="/sdk.js"></script>'), `${name}: official SDK tag`);
  assert.ok(html.includes('<script src="../../../debugcheck.js"></script>'), `${name}: checker tag`);
  assert.ok(html.indexOf('/sdk.js') < html.indexOf('../../../debugcheck.js'), `${name}: SDK before checker`);
  assert.ok(html.indexOf('../../../debugcheck.js') < html.indexOf('<script>\n"use strict";'), `${name}: checker before game script`);
}
assert.equal(before.includes('YaGames.init()'), false, 'before intentionally lacks SDK init');
assert.equal(before.includes('LoadingAPI?.ready()'), false, 'before intentionally lacks Game Ready');
assert.ok(after.includes('ysdk=await YaGames.init()'), 'after initializes SDK');
assert.ok(after.includes('ysdk.environment.i18n.lang'), 'after reads SDK language at startup');
assert.ok(after.includes('window.YGDebugCheckerConfig') && after.includes('resolveLanguage:resolveGameLanguage'), 'after exposes optional checker resolver contract');
assert.ok(after.includes('LoadingAPI?.ready()'), 'after calls Game Ready');
assert.ok(after.includes('inputEnabled=false'), 'after gates input before ready');
assert.ok(after.includes("document.addEventListener('contextmenu',e=>e.preventDefault())"), 'after blocks context menu');
assert.ok(after.includes('overscroll-behavior:none'), 'after blocks overscroll');
assert.ok(after.includes("addEventListener('orientationchange',resize)"), 'after handles rotation');
assert.ok(after.includes("document.addEventListener('visibilitychange'"), 'after handles visibility audio/lifecycle');
assert.ok(after.includes('GameplayAPI?.start?.()') && after.includes('GameplayAPI?.stop?.()'), 'after demonstrates optional gameplay markers');
assert.ok(after.includes('soundOn=true') && after.includes('id="bsound"'), 'after provides sound toggle recommendation');
assert.equal(after.includes('mock-sdk.js'), false, 'production after example must not include mock SDK');
assert.ok(afterMock.includes('../mock-sdk.js'), 'Pages/browser fixture includes mock SDK');
assert.equal(afterMock.replace('<script src="../mock-sdk.js"></script>\n',''), after, 'mock fixture differs only by mock SDK tag');
assert.ok(mock.includes('YaGames') && mock.includes('LoadingAPI') && mock.includes('GameplayAPI'), 'mock SDK covers demo lifecycle');
const beforeReport=JSON.parse(fs.readFileSync(path.join(base,'reports','before.json'),'utf8'));
const afterReport=JSON.parse(fs.readFileSync(path.join(base,'reports','after.json'),'utf8'));
assert.deepEqual(beforeReport.summary,{pass:45,fail:3,warn:12,notVerified:10,score:'75%'},'before report snapshot');
assert.deepEqual(afterReport.summary,{pass:70,fail:0,warn:0,notVerified:2,score:'100%'},'after report snapshot');

console.log('example-static: PASS — Orc Castle before/after structure and production/mock separation');
