import fs from 'node:fs';
import assert from 'node:assert/strict';

const js = fs.readFileSync(new URL('../debugcheck.js', import.meta.url), 'utf8');
const csv = fs.readFileSync(new URL('../checks.csv', import.meta.url), 'utf8').trim();

const part = js.slice(js.indexOf('var CATS='), js.indexOf('// Node-only export'));
const jsNames = [...part.matchAll(/\{name:'((?:\\'|[^'])*)'/g)].map(m => m[1].replaceAll("\\'", "'"));
assert.equal(jsNames.length, 93, 'expected 93 executable checks');

function parseCsvLine(line) {
  const out=[]; let cur=''; let quoted=false;
  for(let i=0;i<line.length;i++){
    const c=line[i];
    if(c==='"'){
      if(quoted && line[i+1]==='"'){cur+='"';i++;}
      else quoted=!quoted;
    } else if(c===',' && !quoted){out.push(cur);cur='';}
    else cur+=c;
  }
  out.push(cur); return out;
}
const csvLines=csv.split(/\r?\n/);
const header=parseCsvLine(csvLines[0]);
const checkIdx=header.indexOf('check');
assert.ok(checkIdx>=0,'checks.csv must contain check column');
const csvNames=csvLines.slice(1).map(x=>parseCsvLine(x)[checkIdx]);
assert.equal(csvNames.length,93,'checks.csv row count');

function multiset(a){const m=new Map();for(const x of a)m.set(x,(m.get(x)||0)+1);return m;}
assert.deepEqual([...multiset(jsNames).entries()].sort(), [...multiset(csvNames).entries()].sort(), 'checks.csv must match executable check names');

const forbidden = [
  'BattleFront','Circle 2048','Driftworld','Hexfront','parkour case','app-553975',
  'CLAUDE.md','debugcheck-enhance','game-screenshot-ext','.pre-submit-report.json',
  'buildLBTools','plat._lb.setScore','games-partners@yandex-team.ru'
];
for(const term of forbidden) assert.equal(js.includes(term), false, `public JS contains internal term: ${term}`);

assert.ok(js.includes("window.YGDebugChecker={"), 'public API must exist');
assert.ok(js.includes("version:'1.1.0'"), 'public API version');
assert.ok(js.includes('ready() within 90s'), '90-second Game Ready window must be present');
assert.equal(js.includes('ready() within 10s'), false, 'obsolete 10-second hard rule must be absent');
assert.equal(js.includes('No raw localStorage.setItem'), false, 'blanket localStorage rule must be absent');
assert.equal(js.includes('All 13 languages'), false, 'fixed-language-count rule must be absent');

// No external network upload: source scanner accepts relative scripts and explicitly skips absolute URLs.
assert.equal(/fetch\(\s*['"]https?:\/\//.test(js), false, 'no hardcoded external fetch');
assert.equal(/XMLHttpRequest\(\)[\s\S]{0,250}https?:\/\//.test(js), false, 'no hardcoded external XHR');

console.log('audit: PASS — catalog parity, hygiene, policy and side-effect checks');
