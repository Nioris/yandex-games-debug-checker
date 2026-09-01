import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const source = fs.readFileSync(new URL('../debugcheck.js', import.meta.url), 'utf8');
const start = source.indexOf('var CATS=');
const endMarker = '\n];\n\n// Node-only export';
const end = source.indexOf(endMarker, start);
assert.ok(start >= 0 && end > start, 'CATS definition must be extractable');

const catsCode = source.slice(start, end + 3) + '\nthis.__CATS=CATS;';
const sandbox = {
  RT: {}, TIMING: {},
  pat: (s, r) => r.test(s),
  extractBlock: (s, startRegex) => {
    const m = s.match(startRegex);
    return m ? s.slice(m.index, m.index + 800) : null;
  },
  Blob,
  Set,
};
vm.createContext(sandbox);
vm.runInContext(catsCode, sandbox, { filename: 'debugcheck-CATS.js' });
const cats = sandbox.__CATS;

const all = cats.flatMap(cat => cat.checks.map(check => ({ cat, check })));
assert.equal(all.length, 99, 'public release check count');

function get(name, catId) {
  const matches = all.filter(x => x.check.name === name && (!catId || x.cat.id === catId));
  assert.equal(matches.length, 1, `expected one check: ${catId || '*'} / ${name}`);
  return matches[0].check;
}

assert.equal(get('SDK script tag').test('<head><script src="/sdk.js"></script></head>'), true);
assert.equal(get('SDK script tag').test('<head></head>'), false);
assert.equal(get('YaGames.init()').test('YaGames.init().then(() => {})'), true);
assert.equal(get('LoadingAPI.ready()').test('ysdk.features.LoadingAPI.ready()'), true);
assert.equal(get('Sound stops on focus loss (п.1.3)').test("const a=new AudioContext();document.addEventListener('visibilitychange',()=>a.suspend());"), true);
assert.equal(get('Sound stops on focus loss (п.1.3)').test("const a=new AudioContext();playMusic();"), 'warn');
assert.equal(get('No third-party auth markers (п.1.2)').test("firebase.auth().signInWithPopup(provider)"), 'warn');
assert.equal(get('No third-party auth markers (п.1.2)').test("ysdk.auth.openAuthDialog()"), true);
assert.equal(get('Yandex auth starts from user action (п.1.2.1)').test("button.addEventListener('click',()=>ysdk.auth.openAuthDialog())"), true);
assert.equal(get('Yandex auth starts from user action (п.1.2.1)').test("ysdk.auth.openAuthDialog()"), 'warn');
assert.equal(get('Auth benefits explained (п.1.2.1)').test("ysdk.auth.openAuthDialog()").pass, 'not_verified');
assert.equal(get('Guest play available (п.1.2)').test("ysdk.auth.openAuthDialog()").pass, 'not_verified');
assert.equal(get('Keyboard control independent of layout (п.1.6.2.4)').test("addEventListener('keydown',e=>{if(e.key==='w')move()})"), 'warn');
assert.equal(get('Keyboard control independent of layout (п.1.6.2.4)').test("addEventListener('keydown',e=>{if(e.code==='KeyW')move()})"), true);
assert.equal(get('Progress preserved after orientation change (п.1.9)').test("<meta name='viewport'> window.addEventListener('orientationchange',resize)").pass, 'not_verified');
assert.equal(get('Monetization present or explicitly waived (п.1.12)').test("const x=1").pass, 'not_verified');
assert.equal(get('Monetization present or explicitly waived (п.1.12)').test("ysdk.adv.showFullscreenAdv({callbacks:{}})"), true);
assert.equal(get('Game looks finished, not WIP (п.1.15)').test("<div>Play</div>").pass, 'not_verified');
assert.equal(get('environment.i18n.lang').test('const lang = ysdk.environment.i18n.lang;').pass, 'not_verified');
assert.equal(get('No URL-based gating (п.1.18)').test("if (location.host === 'example.com') start();"), false);
assert.equal(get('No YouTube/external video player (п.3.9)').test('<iframe src="https://youtube.com/embed/x"></iframe>'), false);
assert.equal(get('No Yandex S3 URLs').test("fetch('https://bucket.yandex.s3/example')"), false);
assert.equal(get('Yandex lang fallback').test("const RU_LIKE=new Set(['ru','be','kk','uk','uz']); function resolveLanguage(lang){ return RU_LIKE.has(lang)?'ru':'en'; }").pass, true);
assert.equal(get('Yandex lang fallback').test("function resolveLanguage(lang){ return lang; }").pass, 'not_verified');

const iapCurrency = get('No hardcoded ₽/$/€ near numbers (REQ-1.13.2)', 'payments');
const badCurrency = iapCurrency.test('getPayments(); const label = "100₽";');
assert.equal(badCurrency.pass, false);
const noIapCurrency = iapCurrency.test('const label = "100₽";');
assert.equal(noIapCurrency.pass, true, 'currency text alone is not an IAP failure');

for (const id of ['sound','ads_inter','ads_rw','save','payments','leaderboard']) {
  const cat = cats.find(c => c.id === id);
  assert.ok(cat?.optional, `${id} must be optional`);
}

for (const forbidden of ['var _lang (NOT let/const)','setLang() function','All 13 languages','IAP-PERMIT marker present']) {
  assert.equal(all.some(x => x.check.name === forbidden), false, `${forbidden} removed from public rules`);
}

console.log(`static-checks: PASS (${all.length} executable checks)`);
