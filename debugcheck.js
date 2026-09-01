/**
 * Yandex Games Debug Checker — public release v1.1.1
 * --------------------------------------------------
 * Unofficial, dependency-free pre-submission checker for Yandex Games.
 * Derived from an internal v2.22 checker and reviewed for public use in Aug 2026.
 *
 * Usage: include AFTER /sdk.js and BEFORE game scripts:
 *   <script src="/sdk.js"><\/script>
 *   <script src="debugcheck.js"><\/script>
 *   <script src="game.js"><\/script>
 *
 * Open: press Ctrl+Shift+2 three times, or call YGDebugChecker.open().
 * Remove debugcheck.js from the production/release build.
 *
 * IMPORTANT: This is not an official Yandex tool. PASS/FAIL/WARN results are
 * pre-submission signals only and do not guarantee moderation approval.
 * Static checks are best-effort and can be affected by minification, bundling,
 * wrappers, engines, WASM, or project-specific architecture.
 */
// === DEBUGCHECK_SELF_START === (do not remove — used by getSource() to strip self from scan)
(function(){
'use strict';

// ── Activation: Ctrl+Shift+2 × 3 ──────────────────────────────
let _seq=0, _timer=null;
document.addEventListener('keydown',function(e){
  if(e.ctrlKey&&e.shiftKey&&(e.key==='2'||e.key==='@')){
    e.preventDefault();
    _seq++;
    clearTimeout(_timer);
    if(_seq>=3){_seq=0;togglePanel();}
    else{_timer=setTimeout(function(){_seq=0;},1500);}
  }
});


let _panel=null, _visible=false;

function togglePanel(){
  if(_panel){_visible=!_visible;_panel.style.display=_visible?'flex':'none';if(_visible)runChecks();return;}
  _visible=true;
  createPanel();
  runChecks();
}

// Public API for automation, smoke tests and custom launch buttons.
window.YGDebugChecker={
  version:'1.1.1',
  open:function(){if(!_panel||!_visible)togglePanel();else runChecks();},
  close:function(){if(_panel){_visible=false;_panel.style.display='none';}},
  refresh:function(){if(!_panel){togglePanel();}else{_visible=true;_panel.style.display='flex';runChecks();}}
};

// ── Runtime SDK tracker ─────────────────────────────────────────
const RT={
  calls:new Set(),
  errors:[],
  warnings:[],
  track:function(name){this.calls.add(name);}
};

// ── Runtime Timing Probes ────────────────────────────────────────
const TIMING={
  domReady:0,firstPaint:0,fontsLoaded:0,sdkInit:0,
  gameReady:0,gameplayStart:0,langDetected:0,
  firstAdShown:0,firstUserClick:0,firstInterstitial:0,
  log:[],
  record:function(event){
    var t=performance.now();
    this[event]=t;
    this.log.push({event:event,time:t,delta:t-(this.domReady||0)});
  }
};
document.addEventListener('DOMContentLoaded',function(){TIMING.record('domReady');});
window.addEventListener('load',function(){TIMING.record('firstPaint');});
if(document.fonts&&document.fonts.ready)document.fonts.ready.then(function(){TIMING.record('fontsLoaded');});
// "First user click" tracking — used by REQ-2.14 check (langDetected must
// happen BEFORE first user interaction). Skip OUR OWN debug-panel hotkey
// (Ctrl+Shift+2) so opening the panel doesn't trick the test into thinking
// the user is interacting with the game.
function _isOwnHotkey(e) {
  return e && e.ctrlKey && e.shiftKey && (e.key === '2' || e.key === '@');
}
['click','touchstart','keydown'].forEach(function(evt){
  document.addEventListener(evt,function handler(e){
    if (_isOwnHotkey(e)) return; // ignore Ctrl+Shift+2 (debug panel hotkey)
    if(!TIMING.firstUserClick)TIMING.record('firstUserClick');
    document.removeEventListener(evt,handler);
  },{once:false}); // can't be once:true — must allow re-firing if first event was our hotkey
});
// v2.4: track EVERY user gesture for ad-context probe (not just the first one).
TIMING.lastUserGesture=0;
TIMING.adCalls=[]; // {type, time, gestureDelta}
['click','touchstart','keydown'].forEach(function(evt){
  document.addEventListener(evt,function(e){
    if (_isOwnHotkey(e)) return;
    TIMING.lastUserGesture=performance.now();
  },{capture:true,passive:true});
});
// Expose read-only runtime state for debugging and automated test harnesses.
window.__dbg = window.__dbg || {};
Object.defineProperty(window.__dbg, 'TIMING', { get: function(){ return TIMING; }, configurable: true });
Object.defineProperty(window.__dbg, 'RT',     { get: function(){ return RT; },     configurable: true });
// Monkey-patch SDK methods to record timing
// Strategy: intercept YaGames.init() to catch ysdk the moment it's created,
// PLUS poll for a globally exposed ysdk as a fallback.

function _patchYSDK(sdk){
  if(!sdk||TIMING._patched)return;
  try{
    // Patch LoadingAPI.ready()
    if(sdk.features&&sdk.features.LoadingAPI&&sdk.features.LoadingAPI.ready){
      var _r=sdk.features.LoadingAPI.ready;
      sdk.features.LoadingAPI.ready=function(){
        TIMING.record('gameReady');
        console.log('[DBG] LoadingAPI.ready() caught at +'+Math.round(TIMING.gameReady-TIMING.domReady)+'ms');
        return _r.apply(this,arguments);
      };
    }
    // Patch GameplayAPI.start()
    if(sdk.features&&sdk.features.GameplayAPI&&sdk.features.GameplayAPI.start){
      var _s=sdk.features.GameplayAPI.start;
      sdk.features.GameplayAPI.start=function(){
        TIMING.record('gameplayStart');
        return _s.apply(this,arguments);
      };
    }
    // Patch showFullscreenAdv. Record both SDK-call timing and, when the game
    // provides callbacks.onOpen, the actual ad-open callback timing.
    if(sdk.adv&&sdk.adv.showFullscreenAdv){
      var _f=sdk.adv.showFullscreenAdv;
      sdk.adv.showFullscreenAdv=function(cfg){
        var now=performance.now();
        var gestureDelta=TIMING.lastUserGesture?(now-TIMING.lastUserGesture):Infinity;
        var rec={type:'interstitial',time:now,gestureDelta:gestureDelta};
        TIMING.adCalls.push(rec);
        if(!TIMING.firstInterstitial)TIMING.record('firstInterstitial');
        try{
          if(cfg&&cfg.callbacks){
            var _onOpen=cfg.callbacks.onOpen;
            cfg.callbacks.onOpen=function(){
              var opened=performance.now();
              rec.openTime=opened;
              rec.openDelayFromCall=opened-now;
              rec.openDelayFromGesture=TIMING.lastUserGesture?(opened-TIMING.lastUserGesture):Infinity;
              if(typeof _onOpen==='function')return _onOpen.apply(this,arguments);
            };
          }
        }catch(_adPatchErr){}
        if(!TIMING.firstUserClick||gestureDelta>330){
          TIMING.log.push({event:'AD_SDK_CALL_CONTEXT_RISK',time:now,gestureDelta:Math.round(gestureDelta),warning:'showFullscreenAdv SDK call was not close to a recent user gesture. This is only a placement-context signal; actual ad-start delay is measured from onOpen when available.'});
          console.warn('[DBG] showFullscreenAdv SDK call is '+Math.round(gestureDelta)+'ms after the last user gesture — review REQ-4.4 placement context; timer ads can be valid in long real-time gameplay');
        }
        return _f.apply(this,arguments);
      };
    }
    // Patch showRewardedVideo (v2.4)
    if(sdk.adv&&sdk.adv.showRewardedVideo){
      var _r2=sdk.adv.showRewardedVideo;
      sdk.adv.showRewardedVideo=function(cfg){
        var now=performance.now();
        var gestureDelta=TIMING.lastUserGesture?(now-TIMING.lastUserGesture):Infinity;
        TIMING.adCalls.push({type:'rewarded',time:now,gestureDelta:gestureDelta});
        if(gestureDelta>330){
          TIMING.log.push({event:'RV_WITHOUT_GESTURE',time:now,gestureDelta:Math.round(gestureDelta),warning:'Rewarded video called >330ms after gesture — must be user-initiated (REQ-4.5)'});
          console.warn('[DBG] showRewardedVideo called '+Math.round(gestureDelta)+'ms after last user gesture — REQ-4.5 risk');
        }
        return _r2.apply(this,arguments);
      };
    }
    // Patch environment.i18n.lang access. IMPORTANT: langDetected means an
    // actual GAME read, not merely "the SDK exposes a lang property". This lets
    // the checker prove REQ-2.14 at runtime instead of asking for manual review.
    if(sdk.environment&&sdk.environment.i18n){
      try{
        var _i18nObj=sdk.environment.i18n;
        var _langDesc=Object.getOwnPropertyDescriptor(_i18nObj,'lang');
        var _origLang=_langDesc&&_langDesc.get?_langDesc.get.call(_i18nObj):_i18nObj.lang;
        RT._i18nRead=false;
        RT._i18nObservation=TIMING.sdkInit?'early':'late';
        Object.defineProperty(_i18nObj,'lang',{
          get:function(){
            RT._i18nRead=true;
            RT._detectedLang=_origLang;
            if(!TIMING.langDetected)TIMING.record('langDetected');
            return _origLang;
          },
          configurable:true,
          enumerable:_langDesc?_langDesc.enumerable:true
        });
      }catch(e){
        // Frozen/non-configurable SDK objects cannot be instrumented reliably.
        // Do NOT turn this into WARN/FAIL: the correct result is NOT VERIFIED.
        RT._i18nRead=null;
        RT._i18nObservation='unavailable';
      }
    }
    TIMING._patched=true;
    TIMING.record('sdkPatched');
    console.log('[DBG] SDK methods patched successfully');
  }catch(e){console.warn('[DBG] Patch error:',e);}
}

// Method 1: Intercept YaGames.init() BEFORE game calls it
if(typeof YaGames!=='undefined'&&YaGames.init){
  var _origInit=YaGames.init;
  YaGames.init=function(){
    TIMING.record('sdkInit');
    return _origInit.apply(this,arguments).then(function(sdk){
      // Catch ysdk the MOMENT it's created — before game code gets it
      _patchYSDK(sdk);
      // _patchYSDK installed the runtime language-read probe before the game
      // receives the SDK object. No second wrapper is needed here: a second
      // wrapper would itself read `.lang` and could create a false PASS.
      return sdk;
    });
  };
  console.log('[DBG] YaGames.init() intercepted');
}

// Method 2: Poll for a globally exposed ysdk every 50ms as fallback
var _pollCount=0;
var _pollTimer=setInterval(function(){
  _pollCount++;
  // Direct ysdk global
  if(window.ysdk&&!TIMING._patched)_patchYSDK(window.ysdk);
  // Stop after 30 seconds (600 × 50ms)
  if(TIMING._patched||_pollCount>600)clearInterval(_pollTimer);
},50);

// Hook console.error/warn for tracking
const _origErr=console.error, _origWarn=console.warn;
console.error=function(){RT.errors.push(Array.from(arguments).join(' '));_origErr.apply(console,arguments);};
console.warn=function(){RT.warnings.push(Array.from(arguments).join(' '));_origWarn.apply(console,arguments);};

// Probe SDK state — runs on background + fresh on each check
function probeRuntime(){
  if(typeof YaGames!=='undefined')RT.track('YaGames global found');
  if(window.ysdk)RT.track('ysdk global found');
}
setTimeout(probeRuntime,1000);
setTimeout(probeRuntime,3000);
setTimeout(probeRuntime,6000);

// ── Auto-report critical issues to console ────────────────────
setTimeout(function(){
  var issues=[];
  if(TIMING.firstUserClick&&TIMING.sdkInit&&TIMING.firstUserClick<TIMING.sdkInit){
    issues.push('⚠️ USER CLICKED BEFORE SDK INIT! (click: '+Math.round(TIMING.firstUserClick)+'ms, sdk: '+Math.round(TIMING.sdkInit)+'ms, gap: '+Math.round(TIMING.sdkInit-TIMING.firstUserClick)+'ms)');
  }
  if(TIMING.langDetected&&TIMING.firstUserClick&&TIMING.langDetected>TIMING.firstUserClick){
    issues.push('⚠️ LANGUAGE DETECTED AFTER USER INTERACTION! (lang: '+Math.round(TIMING.langDetected)+'ms, click: '+Math.round(TIMING.firstUserClick)+'ms)');
  }
  if(TIMING.firstUserClick&&TIMING.gameReady&&TIMING.firstUserClick<TIMING.gameReady){
    issues.push('⚠️ PAGE INPUT BEFORE ready(): input event '+Math.round(TIMING.firstUserClick)+'ms, ready '+Math.round(TIMING.gameReady)+'ms. Document-level input does NOT prove the game accepted it. Verify that gameplay handlers are gated (for example inputEnabled=false until ready()).');
  }
  if(TIMING.gameReady&&TIMING.sdkInit&&TIMING.gameReady<TIMING.sdkInit){
    issues.push('⚠️ GameReady() BEFORE SDK init! (ready: '+Math.round(TIMING.gameReady)+'ms, sdk: '+Math.round(TIMING.sdkInit)+'ms)');
  }
  // REQ-1.19.2: ready() must fire WHEN the game is interactive — not too early (while a
  // progress bar / black screen / throbber is still showing) and not several seconds late.
  // We can't see "interactive" directly, but we approximate:
  //  - too EARLY: ready() before first meaningful content paint (firstPaint/fontsLoaded)
  //  - too LATE: ready() fires noticeably after gameplay already started
  if(TIMING.gameReady&&TIMING.fontsLoaded&&TIMING.gameReady<TIMING.fontsLoaded-50){
    issues.push('⚠️ GameReady() likely TOO EARLY — ready() at '+Math.round(TIMING.gameReady)+'ms but fonts/content not ready until '+Math.round(TIMING.fontsLoaded)+'ms. Yandex 1.19.2: green only when game is interactive (no progress bar/black screen).');
  }
  if(TIMING.gameReady&&TIMING.gameplayStart&&TIMING.gameReady>TIMING.gameplayStart+1000){
    issues.push('⚠️ GameReady() TOO LATE — gameplay started at '+Math.round(TIMING.gameplayStart)+'ms but ready() not until '+Math.round(TIMING.gameReady)+'ms (>1s late). Yandex 1.19.2: green must appear AS the game becomes interactive, not seconds after.');
  }
  if(TIMING.gameReady&&(TIMING.gameReady-TIMING.domReady)>90000){
    issues.push('⚠️ GameReady() after 90s — Yandex marks the game as "ready not implemented" past 90s.');
  }
  if(!TIMING.gameReady){
    issues.push('⚠️ LoadingAPI.ready() NOT CALLED after 8 seconds! (Yandex 1.19.2 — red after 90s = not implemented)');
  }
  if(issues.length>0){
    console.warn('%c[DEBUGCHECK] '+issues.length+' TIMING ISSUES DETECTED:','color:#ff4040;font-weight:bold;font-size:14px');
    issues.forEach(function(i){console.warn('[DEBUGCHECK] '+i);});
    console.warn('[DEBUGCHECK] Open panel: Ctrl+Shift+2 (×3) for full report');
  }
},8000);

// ── Check definitions ───────────────────────────────────────────
function pat(s,r){return r.test(s);}

function extractBlock(s,startRegex){
  var m=s.match(startRegex);
  if(!m)return null;
  return s.slice(m.index,m.index+800);
}

var CATS=[
  {id:'sdk',title:'SDK Integration',icon:'\u{1F4E6}',checks:[
    {name:'SDK script tag',desc:'п.1.1 — /sdk.js in head',
      test:function(s){return pat(s,/<script[^>]*src=["']\/sdk\.js["'][^>]*>/i);}},
    {name:'YaGames.init()',desc:'п.1.19.1 — SDK initialization',
      test:function(s){return pat(s,/YaGames\.init\s*\(/);}},
  ]},
  {id:'lifecycle',title:'Lifecycle API',icon:'\u{1F504}',checks:[
    {name:'LoadingAPI.ready()',desc:'п.1.19.2 — called when the game becomes interactive',
      test:function(s){return pat(s,/LoadingAPI[\s\S]{0,4}ready\s*\(/);}},
  ]},
  {id:'auth',title:'Authorization',icon:'\u{1F510}',checks:[
    {name:'No third-party auth markers (п.1.2)',desc:'п.1.2 — only Yandex ID authorization is allowed; third-party login must not be required',
      test:function(s){
        var bad=pat(s,/firebase\s*\.\s*auth|signInWithPopup|accounts\.google\.com|google(?:apis)?\.com\/oauth|facebook\.com\/[^\s"']*oauth|vk\.com\/[^\s"']*oauth|discord\.com\/[^\s"']*oauth|auth0|loginWith(?:Google|Facebook|VK|Discord)|OAuthProvider/i);
        return bad?'warn':true;
      },warnText:'Possible third-party authorization code was found. REQ 1.2 allows only Yandex ID authorization requested through the Yandex Games SDK. Remove/disable third-party login in the Yandex build or verify this is a false match.'},
    {name:'Yandex auth starts from user action (п.1.2.1)',desc:'п.1.2.1 — ysdk.auth.openAuthDialog() is requested only after a deliberate user action',
      test:function(s){
        if(!pat(s,/\.auth\.openAuthDialog\s*\(/))return true;
        var directHandler=pat(s,/(?:addEventListener\s*\(\s*['"](?:click|pointerup|pointerdown|touchend)|onclick\s*=)[\s\S]{0,1600}\.auth\.openAuthDialog\s*\(/i);
        var namedHandler=pat(s,/function\s+\w*(?:auth|login|signIn)\w*\s*\([^)]*\)\s*\{[\s\S]{0,900}\.auth\.openAuthDialog\s*\(/i);
        return (directHandler||namedHandler)?true:'warn';
      },warnText:'Yandex auth dialog is used, but static analysis could not prove that it is called from a dedicated click/tap action. REQ 1.2.1 forbids automatic authorization prompts on startup. Verify the call is reachable only from an explicit login button.'},
    {name:'Auth benefits explained (п.1.2.1)',desc:'п.1.2.1 — the authorization offer explains what the player gains',
      test:function(s){
        if(!pat(s,/\.auth\.openAuthDialog\s*\(/))return true;
        return {pass:'not_verified',details:'Authorization is present. Static analysis cannot reliably judge whether the visible login offer explains its benefits; verify the copy manually before moderation.'};
      }},
    {name:'Guest play available (п.1.2)',desc:'п.1.2 — the game remains usable without authorization',
      test:function(s){
        if(!pat(s,/\.auth\.openAuthDialog\s*\(/))return true;
        return {pass:'not_verified',details:'Authorization is present. Verify that declining/skipping Yandex ID still leaves a guest entry or a playable game flow.'};
      }},
  ]},
  {id:'sound',title:'Sound Management',optional:true,icon:'\u{1F50A}',checks:[
    {name:'Sound stops on focus loss (п.1.3)',desc:'п.1.3 — sound stops on browser/app focus loss; a delay up to 2 seconds is allowed',
      test:function(s){
        var hasAudio=pat(s,/AudioContext|webkitAudioContext|new\s+Audio\s*\(|<audio\b|Howl\s*\(|sound|music/i);
        if(!hasAudio)return true;
        var hasFocusHook=pat(s,/visibilitychange|pagehide|(?:window|document)\.addEventListener\s*\(\s*['"]blur/i);
        var hasStop=pat(s,/\.suspend\s*\(|\.pause\s*\(|muted\s*=\s*true|volume\s*=\s*0|mute(?:All|Audio|Sound)|pause(?:All|Audio|Sound)|stop(?:All|Audio|Sound)/i);
        return (hasFocusHook&&hasStop)?true:'warn';
      },warnText:'Sound code was found, but static analysis could not prove a focus-loss handler that stops or mutes audio. REQ 1.3 now covers minimizing the browser/app, switching to another tab, and the browser tab switcher; stopping within 2 seconds is allowed. Verify all three cases manually.'},
    {name:'AudioContext suspend/resume',desc:'AC.suspend() + AC.resume()',
      test:function(s){return(pat(s,/\.suspend\s*\(/)||pat(s,/suspendAudio/))&&(pat(s,/\.resume\s*\(/)||pat(s,/resumeAudio/));}},
  ]},
  {id:'ads_inter',title:'Ads \u2014 Interstitial',optional:true,icon:'\u{1F4FA}',checks:[
    {name:'showFullscreenAdv',desc:'Interstitial present',
      test:function(s){return pat(s,/showFullscreenAdv\s*\(/);}},
    {name:'onOpen callback',desc:'Pause+mute on ad',
      test:function(s){var m=extractBlock(s,/showFullscreenAdv\s*\(/);return m&&/onOpen/.test(m);}},
    {name:'onClose callback',desc:'Resume after ad',
      test:function(s){var m=extractBlock(s,/showFullscreenAdv\s*\(/);return m&&/onClose/.test(m);}},
    {name:'onError callback',desc:'Error handling',
      test:function(s){var m=extractBlock(s,/showFullscreenAdv\s*\(/);return m&&/onError/.test(m);}},
  ]},
  {id:'ads_rw',title:'Ads \u2014 Rewarded',optional:true,icon:'\u{1F3AC}',checks:[
    {name:'showRewardedVideo',desc:'Rewarded present',
      test:function(s){return pat(s,/showRewardedVideo\s*\(/);}},
    {name:'onRewarded callback',desc:'Grant reward',
      test:function(s){var m=extractBlock(s,/showRewardedVideo\s*\(/);return m&&/onRewarded/.test(m);}},
    {name:'onOpen callback',desc:'Pause+mute',
      test:function(s){var m=extractBlock(s,/showRewardedVideo\s*\(/);return m&&/onOpen/.test(m);}},
    {name:'onClose callback',desc:'Resume',
      test:function(s){var m=extractBlock(s,/showRewardedVideo\s*\(/);return m&&/onClose/.test(m);}},
  ]},
  {id:'save',title:'Cloud Saves',optional:true,icon:'\u{1F4BE}',checks:[
    {name:'player.setData()',desc:'Cloud save',
      test:function(s){return pat(s,/\.setData\s*\(/);}},
    {name:'player.getData()',desc:'Cloud load',
      test:function(s){return pat(s,/\.getData\s*\(/);}},
  ]},
  {id:'payments',title:'In-App Purchases',icon:'\u{1F4B0}',optional:true,checks:[
    {name:'getPayments()',desc:'Payments init',
      test:function(s){return pat(s,/getPayments\s*\(/);}},
    {name:'consumePurchase()',desc:'Consume after grant',
      test:function(s){return pat(s,/consumePurchase\s*\(/);}},
    {name:'getPurchases()',desc:'Check pending at start',
      test:function(s){return pat(s,/getPurchases\s*\(/);}},
    {name:'getCatalog() called (REQ-1.13.2)',desc:'Catalog provides priceCurrencyCode + getPriceCurrencyImage — required when game has IAP',
      guard:true,
      test:function(s){
        var hasPayments = pat(s,/getPayments\s*\(/);
        if(!hasPayments) return {pass:true,details:'No IAP — n/a'};
        return pat(s,/getCatalog\s*\(/) ? true : {pass:false,details:'getPayments() present but getCatalog() never called. Without catalog you cannot get priceCurrencyImage and prices may be hardcoded — a hardcoded currency pattern was detected in a prior regression case (REQ-1.13.2).'};
      }},
    {name:'No hardcoded ₽/$/€ near numbers (REQ-1.13.2)',desc:'When IAP is present, prices must use SDK currency methods (getPriceCurrencyCode/getPriceCurrencyImage)',
      guard:true,
      test:function(s){
        var hasPayments = pat(s,/getPayments\s*\(/);
        if(!hasPayments) return {pass:true,details:'No IAP — symbols in display text are OK'};
        var re = /(?:^|[^A-Za-z0-9])([+\-]?\d[\d.,]*\s?[₽€¥¢])|([₽€¥¢]\s?\d[\d.,]*)|([+\-]?\d[\d.,]*\s?\$)(?!\{)|(\$\s?\d{2,}(?:[.,]\d+)?)|(\$\s?\d[.,]\d+)/;
        var lines = String(s||'').split('\n');
        for (var i=0;i<lines.length;i++){
          if(/getCurrency|getPriceCurrency|priceCurrencyCode/.test(lines[i])) continue;
          if(re.test(lines[i])){
            var m = lines[i].match(re);
            return {pass:false,details:'Hardcoded currency near number: ' + (m[1]||m[2]||m[3]||m[4]||m[5]).trim() + ' (line ' + (i+1) + ')'};
          }
        }
        return true;
      }},
  ]},
  {id:'i18n',title:'Localization (I18N)',icon:'\u{1F310}',checks:[
    {name:'environment.i18n.lang',desc:'Language from SDK (п.2.14)',rt:true,
      test:function(s){
        // Strongest evidence: the checker intercepted a real game read.
        if(RT._i18nRead===true){
          var detail='Runtime confirmed: environment.i18n.lang read';
          if(RT._detectedLang)detail+=' → '+RT._detectedLang;
          if(TIMING.langDetected)detail+=' at +'+Math.round(TIMING.langDetected-(TIMING.domReady||0))+'ms';
          return {pass:true,details:detail};
        }
        // If we instrumented YaGames.init before the game received the SDK and
        // Game Ready has already fired, absence of a read is actionable evidence.
        if(RT._i18nRead===false&&RT._i18nObservation==='early'&&TIMING.gameReady){
          return {pass:false,details:'Runtime confirmed: game reached LoadingAPI.ready() without reading environment.i18n.lang'};
        }
        // A source reference is useful evidence, but not proof that the branch ran.
        if(pat(s,/environment\s*\.\s*i18n\s*\.\s*lang|i18n\??\.lang/)){
          return {pass:'not_verified',details:'Static reference found, but runtime read has not been observed yet'};
        }
        if(RT._i18nObservation==='unavailable'){
          return {pass:'not_verified',details:'SDK language object could not be instrumented (frozen/non-configurable)'};
        }
        if(RT._i18nObservation==='late'){
          return {pass:'not_verified',details:'Checker attached after SDK initialization; an earlier language read cannot be proven'};
        }
        return {pass:'not_verified',details:'Waiting for SDK initialization/runtime language read'};
      },failText:'Game did not read ysdk.environment.i18n.lang before becoming ready'},
    {name:'Yandex lang fallback',desc:'be/kk/uk/uz → ru (Yandex docs)',
      test:function(s){
        var langs=['be','kk','uk','uz'];
        // Optional explicit checker contract. This is NOT required by the game;
        // it only lets the checker execute a resolver instead of guessing from source.
        try{
          var cfg=(typeof window!=='undefined'&&window.YGDebugCheckerConfig)||null;
          if(cfg&&typeof cfg.resolveLanguage==='function'){
            var bad=[],mapped=[];
            langs.forEach(function(l){
              var got=cfg.resolveLanguage(l);
              mapped.push(l+'→'+got);
              if(got!=='ru')bad.push(l+'→'+got);
            });
            if(bad.length)return {pass:false,details:'Resolver mismatch: '+bad.join(', ')+'; expected be/kk/uk/uz → ru'};
            return {pass:true,details:'Resolver executed: '+mapped.join(', ')};
          }
        }catch(e){
          return {pass:'not_verified',details:'resolveLanguage() could not be executed safely: '+String(e&&e.message||e)};
        }

        // Explicit object/switch mappings: prove every required fallback separately.
        var proven=[];
        langs.forEach(function(l){
          var keyMap=new RegExp("(?:['\"]?"+l+"['\"]?\\s*:\\s*['\"]ru['\"]|case\\s*['\"]"+l+"['\"]\\s*:[\\s\\S]{0,100}?return\\s*['\"]ru['\"])",'i');
          if(keyMap.test(s))proven.push(l);
        });
        if(proven.length===langs.length)return {pass:true,details:'Static mapping confirmed: be/kk/uk/uz → ru'};

        // Common grouped resolver pattern, including the Orc Castle example:
        // const RU_LIKE = new Set(['ru','be','kk','uk','uz']);
        // return RU_LIKE.has(lang) ? 'ru' : ...;
        var groupNames=[];
        var groupRe=/\b([A-Za-z_$][\w$]*(?:RU|RUS|CYR)[A-Za-z0-9_$]*|RU_LIKE|RU_FALLBACK|LANG_FALLBACK)\b/gi,m;
        while((m=groupRe.exec(s))!==null)if(groupNames.indexOf(m[1])<0)groupNames.push(m[1]);
        for(var gi=0;gi<groupNames.length;gi++){
          var gn=groupNames[gi];
          var declRe=new RegExp(gn.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+"\\s*=\\s*(?:new\\s+Set\\s*\\()?\\s*\\[([\\s\\S]{0,220}?)\\]",'i');
          var dm=s.match(declRe);
          if(!dm)continue;
          var body=dm[1];
          if(!langs.every(function(l){return new RegExp("['\"]"+l+"['\"]").test(body)}))continue;
          var useRe=new RegExp(gn.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+"\\s*\\.\\s*(?:has|includes)\\s*\\([^)]*\\)[\\s\\S]{0,80}?(?:\\?\\s*['\"]ru['\"]|return\\s*['\"]ru['\"])",'i');
          if(useRe.test(s))return {pass:true,details:'Grouped fallback confirmed via '+gn+': be/kk/uk/uz → ru'};
        }

        // If source visibly maps one of these languages to a non-RU target, report
        // an actual risk. Otherwise inability to infer is NOT a warning.
        var wrong=[];
        langs.forEach(function(l){
          var wm=s.match(new RegExp("['\"]?"+l+"['\"]?\\s*:\\s*['\"](?!ru['\"])([a-z]{2,3})['\"]",'i'));
          if(wm)wrong.push(l+'→'+wm[1]);
        });
        if(wrong.length)return {pass:false,details:'Suspicious fallback mapping: '+wrong.join(', ')};
        return {pass:'not_verified',details:'No explicit fallback resolver could be proven from source. This is not evidence of a defect.'};
      },warnText:'Fallback mapping looks inconsistent'},
  ]},
  {id:'ux',title:'UX & Mobile',icon:'\u{1F4F1}',checks:[
    {name:'Context menu disabled',desc:'п.1.6.2.7 — right-click prevented',
      test:function(s){return pat(s,/contextmenu/)&&pat(s,/preventDefault/);}},
    {name:'Text selection disabled',desc:'п.1.6.2.7 — user-select or selectstart',
      test:function(s){return pat(s,/user-select\s*:\s*none/)||pat(s,/selectstart/);}},
    {name:'touch-action configured',desc:'touch-action: none/manipulation on game area',
      test:function(s){return pat(s,/touch-action\s*:\s*(none|manipulation)/);}},
    {name:'Viewport meta tag',desc:'Mobile viewport with user-scalable=no',
      test:function(s){return pat(s,/<meta[^>]*viewport[^>]*>/);}},
    {name:'Overflow hidden on body/html',desc:'п.1.10.2 — prevent page scroll',
      test:function(s){return pat(s,/overflow\s*:\s*hidden/);}},
    {name:'overscroll-behavior',desc:'п.1.10.2 — prevent swipe-to-refresh / bounce',
      test:function(s){return pat(s,/overscroll-behavior\s*:\s*(none|contain)/);}},
    {name:'-webkit-touch-callout: none',desc:'Prevent iOS callout menu on long press',
      test:function(s){return pat(s,/touch-callout\s*:\s*none/);}},
  ]},
  {id:'rejections',title:'Common Rejections',icon:'\u{1F6A8}',checks:[
    {name:'Scroll prevention (п.1.10.2)',desc:'No browser scroll during gameplay',
      test:function(s){
        // Must have at least 2 of: overflow:hidden, overscroll-behavior, touchmove preventDefault, touch-action:none
        var score=0;
        if(pat(s,/overflow\s*:\s*hidden/))score++;
        if(pat(s,/overscroll-behavior\s*:\s*(none|contain)/))score++;
        if(pat(s,/touchmove/)&&pat(s,/preventDefault/))score++;
        if(pat(s,/touch-action\s*:\s*none/))score++;
        if(pat(s,/position\s*:\s*fixed/)&&pat(s,/html|body/))score++;
        return score>=2?true:(score===1?'warn':false);
      },warnText:'Only 1 scroll prevention method — add overscroll-behavior:none and overflow:hidden',
      failText:'No scroll prevention! Add: overflow:hidden + overscroll-behavior:none + touchmove preventDefault'},
    {name:'Swipe-to-refresh blocked (iOS/Android)',desc:'п.1.10.2 — overscroll-behavior: none/contain',
      test:function(s){
        if(pat(s,/overscroll-behavior\s*:\s*(none|contain)/))return true;
        // Alternative: touchmove preventDefault at top of page
        if(pat(s,/touchmove/)&&pat(s,/preventDefault/))return 'warn';
        return false;
      },warnText:'touchmove preventDefault found but overscroll-behavior:none is more reliable',
      failText:'Add CSS: html,body{overscroll-behavior:none} to block pull-to-refresh'},
    {name:'GameReady timing (п.1.19)',desc:'LoadingAPI.ready() called AFTER full load, not in SDK init',
      test:function(s){
        if(!pat(s,/LoadingAPI[\s\S]{0,4}ready/))return false;
        // Check: ready() should NOT be called synchronously inside YaGames.init callback
        // It should be after game assets are loaded
        // Look for ready() being called after some async operation (setTimeout, await, .then)
        var readyBlock=extractBlock(s,/LoadingAPI[\s\S]{0,4}ready\s*\(/);
        if(!readyBlock)return false;
        // Warn if ready() is in the same function as YaGames.init()
        var initBlock=extractBlock(s,/YaGames\.init\s*\(/);
        if(initBlock&&initBlock.indexOf('ready')!==-1){
          // Being in the same async bootstrap is fine when readiness is explicitly gated
          // on rendering/assets rather than called immediately after SDK init.
          var hasReadinessGate=pat(initBlock,/document\.fonts\.ready|requestAnimationFrame|twoPaints|nextPaint|waitFor(?:Render|Paint|Assets|Ready)/i);
          return hasReadinessGate?true:'warn';
        }
        return true;
      },warnText:'LoadingAPI.ready() may be called too early — ensure it runs AFTER game is playable'},
    {name:'I18N auto-detection (п.2.14)',desc:'Language from SDK, not hardcoded',
      test:function(s){
        // Must use ysdk.environment.i18n.lang, not just navigator.language
        if(pat(s,/environment[\s\S]{0,5}i18n[\s\S]{0,5}lang/))return true;
        if(pat(s,/getLang\s*\(/)||pat(s,/detectLang/))return 'warn';
        return false;
      },warnText:'detectLang found but verify it reads ysdk.environment.i18n.lang',
      failText:'Must use ysdk.environment.i18n.lang for auto-detection'},
    {name:'Sound paused during ads (п.4.7)',desc:'AudioContext suspend in ad onOpen callback',
      test:function(s){
        // Check interstitial
        var fsBlock=extractBlock(s,/showFullscreenAdv\s*\(/);
        var rwBlock=extractBlock(s,/showRewardedVideo\s*\(/);
        if(!fsBlock&&!rwBlock)return {pass:true,details:'No fullscreen ads detected — n/a'};
        // Look for audio pause/suspend/mute near ad callbacks
        var hasMuteInFs=fsBlock&&(pat(fsBlock,/suspend|mute|pause.*[Aa]udio|[Aa]udio.*pause/));
        var hasMuteInRw=rwBlock&&(pat(rwBlock,/suspend|mute|pause.*[Aa]udio|[Aa]udio.*pause/));
        // Also check if there's a generic pauseAudio/muteAll function called
        var hasGeneric=pat(s,/pauseAppAudio|muteAll|muteSound|suspendAudio|audioSuspend|_muteForAd|muteForAd/);
        if(fsBlock&&!hasMuteInFs&&!hasGeneric)return false;
        if(rwBlock&&!hasMuteInRw&&!hasGeneric)return false;
        return true;
      },failText:'Ad callbacks must suspend AudioContext / mute sound in onOpen!'},
    {name:'Game paused during ads (п.4.7)',desc:'Gameplay stops when ad is shown',
      test:function(s){
        var fsBlock=extractBlock(s,/showFullscreenAdv\s*\(/);
        var rwBlock=extractBlock(s,/showRewardedVideo\s*\(/);
        if(!fsBlock&&!rwBlock)return {pass:true,details:'No fullscreen ads detected — n/a'};
        // Check for pause/stop in ad context (or via a generic helper used by both ad types).
        var blocks=[fsBlock,rwBlock].filter(Boolean).join('\n');
        var hasPause=pat(blocks,/pause|stop|frozen|mute|speed\s*=\s*0|GameplayAPI[\s\S]{0,4}stop/)
          ||pat(s,/pauseAppAudio|pauseGame|gamePause|_paused\s*=\s*true|_muteForAd|muteForAd/);
        return hasPause;
      },warnText:'Fullscreen ad detected — verify gameplay is paused for the full ad lifecycle',
      failText:'Game must pause during fullscreen ad — set paused state in onOpen callback'},
    {name:'Selection/callout in game area (п.1.6.2.7)',desc:'No text selection or context menu on interaction',
      test:function(s){
        var score=0;
        if(pat(s,/user-select\s*:\s*none/))score++;
        if(pat(s,/selectstart/)&&pat(s,/preventDefault/))score++;
        if(pat(s,/contextmenu/)&&pat(s,/preventDefault/))score++;
        if(pat(s,/touch-callout\s*:\s*none/))score++;
        return score>=2?true:(score===1?'warn':false);
      },warnText:'Only partial protection — add user-select:none + selectstart + contextmenu preventDefault',
      failText:'Must disable: user-select, selectstart, contextmenu in game area'},
  ]},
  {id:'danger',title:'Dangerous Patterns',icon:'\u26A0\uFE0F',checks:[
    {name:'No alert()',desc:'alert() forbidden',
      test:function(s){var c=s.replace(/\/\*[\s\S]*?\*\//g,'').replace(/\/\/[^\n]*/g,'');var m=c.match(/\balert\s*\(/g);return!m||m.length===0;},
      failText:'alert() found!'},
    {name:'No confirm()',desc:'confirm() forbidden',
      test:function(s){var c=s.replace(/\/\*[\s\S]*?\*\//g,'').replace(/\/\/[^\n]*/g,'');var m=c.match(/(?<![.\w])confirm\s*\(/g);return!m||m.length===0;},
      failText:'confirm() found!'},
    {name:'No prompt()',desc:'prompt() forbidden',
      test:function(s){var c=s.replace(/\/\*[\s\S]*?\*\//g,'').replace(/\/\/[^\n]*/g,'');var m=c.match(/(?<![.\w])prompt\s*\(/g);return!m||m.length===0;},
      failText:'prompt() found!'},
    {name:'No document.write()',desc:'document.write forbidden',
      test:function(s){return!pat(s,/document\.write\s*\(/);}},
    {name:'No eval()',desc:'eval() dangerous',
      test:function(s){var c=s.replace(/\/\*[\s\S]*?\*\//g,'').replace(/\/\/[^\n]*/g,'');var m=c.match(/(?<![.\w])eval\s*\(/g);return!m||m.length===0;}},
  ]},
  {id:'archive',title:'Archive',icon:'\u{1F4E6}',checks:[
    {name:'No Yandex S3 URLs',desc:'п.1.7 — no absolute URLs to Yandex S3 servers',
      test:function(s){return!pat(s,/https?:\/\/[^"']*yandex.*\.s3/);}},
  ]},
  {id:'quality',title:'Quality',icon:'\u2B50',checks:[
    {name:'No WebGL notice (п.1.6.1.7)',desc:'No "WebGL not supported/enable WebGL" prompt shown to user',
      test:function(s){return!pat(s,/WebGL[^<]{0,40}(not |unavailable|enable|unsupported|включите|не поддерж)/i);}},
    {name:'Video has no system controls (п.1.6.1.6/1.6.2.5)',desc:'<video> must not show the native player UI (use controlsList/no controls attr)',
      test:function(s){
        // Pass if there is no <video> at all, OR every <video> suppresses native controls.
        var vids=s.match(/<video\b[^>]*>/gi);
        if(!vids)return true;
        return vids.every(function(v){
          // bad: has `controls` and does NOT disable them
          if(/\bcontrols\b/i.test(v) && !/controlsList=("|')?nodownload|disablePictureInPicture/i.test(v))return false;
          return true;
        });
      }},
    {name:'Music via Web Audio, not <audio>/new Audio (п.1.6.1.6/1.6.2.5)',desc:'Background music played through HTMLAudioElement (new Audio()/<audio>) surfaces in the OS media player (desktop) and the mobile notification shade. Use Web Audio API (AudioContext + BufferSource) instead.',
      test:function(s){
        // BAD: new Audio(...) used for music, or <audio> with autoplay/loop (i.e. background music
        // not a one-shot). SFX via Web Audio (createBufferSource) is fine and doesn't trip this.
        var hasNewAudio = pat(s,/new\s+Audio\s*\(/);
        var bgAudioTag  = pat(s,/<audio\b[^>]*\b(autoplay|loop)\b/i);
        if(hasNewAudio || bgAudioTag){
          // If MediaSession metadata is also set, it's DEFINITELY showing in the OS player.
          // Either way HTMLAudioElement music is the rejection cause → WARN (manual confirm: is it music?).
          return 'warn';
        }
        // Explicit MediaSession usage always surfaces the OS player.
        if(pat(s,/navigator\.mediaSession/)) return 'warn';
        return true;
      },warnText:'Music appears to use HTMLAudioElement (new Audio()/<audio loop>) or MediaSession — these show a system media player (desktop п.1.6.2.5) and a mobile notification-shade player (п.1.6.1.6). Route music through Web Audio API: fetch→decodeAudioData→AudioBufferSourceNode (loop=true) on your existing AudioContext, and remove any navigator.mediaSession metadata. SFX via Web Audio is unaffected.'},
    {name:'SDK language before URL fallback',desc:'п.2.14 — if a URL language fallback returns before SDK access, environment.i18n.lang becomes dead code.',
      test:function(s){
        var m=s.match(/function\s+detectLang\s*\([^)]*\)\s*\{([\s\S]{0,900}?)\n\}/);
        if(!m)return true; // нет detectLang в таком виде → другие чеки разберутся
        var body=m[1];
        var iUrl=body.search(/get\(\s*("|')lang\1\s*\)/);
        var iSdk=body.search(/environment\s*\.\s*i18n/);
        if(iUrl<0||iSdk<0)return true;
        // URL раньше SDK И после URL есть ранний return → SDK недостижим на платформе
        var afterUrl=body.slice(iUrl, iSdk);
        return (iUrl<iSdk && /return/.test(afterUrl)) ? 'warn' : true;
      },warnText:'detectLang() проверяет ?lang= из URL РАНЬШЕ SDK и возвращается — на Яндексе (&lang= есть всегда) чтение environment.i18n.lang мёртвый код → панель «I18n is not used», риск 2.14. Поменяй порядок: SDK первым, URL-параметр — только dev-fallback без SDK.'},
    {name:'Language detected before the game is interactive (п.2.14/1.19)',desc:'detectLang()/ready() must run as part of startup BEFORE input handlers are bound / the board is built — not in a parallel init().then() while DOMContentLoaded already made the game playable.',
      test:function(s){
        // Heuristic: the game binds canvas/window input or starts a
        // match at DOMContentLoaded, while detectLang()/LoadingAPI.ready() live inside an async
        // init().then() that resolves LATER → Yandex sees lang/ready fire "after game is playable".
        // Only relevant if SDK lang-detection exists at all.
        var usesLang = pat(s,/environment\.i18n\.lang|detectLang\s*\(/);
        if(!usesLang) return true; // no SDK lang detection → handled by other checks
        // Is input bound / a match started synchronously at boot (DOMContentLoaded or top-level)?
        var bootBinds = pat(s,/DOMContentLoaded[\s\S]{0,400}addEventListener\s*\(\s*("|')(click|pointerdown|mousedown|keydown|touchstart)/i)
                     || pat(s,/(CV|canvas|cv)\.addEventListener\s*\(\s*("|')(click|pointerdown|mousedown)/i);
        if(!bootBinds) return true;
        // Are detectLang() AND ready() BOTH only reached via an async init().then()/await chain?
        var langInAsync  = pat(s,/init\s*\(\s*\)\s*\.then\s*\([\s\S]{0,300}detectLang/i) || pat(s,/await[\s\S]{0,200}init[\s\S]{0,300}detectLang/i);
        var readyInAsync = pat(s,/init\s*\(\s*\)\s*\.then\s*\([\s\S]{0,400}(LoadingAPI|\.ready\s*\()/i) || pat(s,/await[\s\S]{0,200}init[\s\S]{0,400}\.ready\s*\(/i);
        // If lang/ready are deferred into init().then() but input is bound at boot → ordering smell.
        return (langInAsync || readyInAsync) ? 'warn' : true;
      },warnText:'Input handlers are bound / the board is built at DOMContentLoaded, but detectLang()/LoadingAPI.ready() only run inside init().then() — so Yandex sees language auto-detection and GameReady fire AFTER the game is already playable (п.2.14 + п.1.19). Gate interactivity: await the SDK (or its language) before binding input / showing the playable board, then call detectLang()→applyLang()→ready() up front. Even in a Russian-only game the CALL ORDER is checked.'},
    {name:'Keyboard auto-shows on input (п.1.6.1.2)',desc:'A text <input> must raise the mobile keyboard on tap (native behavior). Flag only if the keyboard is actively suppressed.',
      test:function(s){
        var tags=s.match(/<input\b[^>]*>/gi);
        if(!tags)return true; // no inputs → N/A
        var textInputs=tags.filter(function(tag){
          var tm=tag.match(/type\s*=\s*("|')?\s*([a-z]+)/i);
          if(!tm)return true;
          var ty=tm[2].toLowerCase();
          return (ty==='text'||ty==='search'||ty==='email'||ty==='tel'||ty==='url'||ty==='password'||ty==='number');
        });
        if(!textInputs.length)return true; // only buttons/checkboxes/range → N/A
        // A normal text input raises the keyboard on tap natively — that satisfies 1.6.1.2.
        // It FAILS only if the keyboard is actively suppressed: inputmode="none", readonly,
        // or disabled on every text input.
        var allSuppressed=textInputs.every(function(tag){
          return /inputmode\s*=\s*("|')?none/i.test(tag) || /\breadonly\b/i.test(tag) || /\bdisabled\b/i.test(tag);
        });
        return allSuppressed ? false : true;
      }},
    {name:'No URL-based gating (п.1.18)',desc:'Game must not restrict itself by location.host/href',
      test:function(s){return!pat(s,/location\.(host|hostname|href)\s*[!=]==?\s*("|')|referrer\s*[!=]==?|top\.location\s*[!=]/);}},
    {name:'Fullscreen on mobile (п.1.6.1.1)',desc:'Game should run fullscreen during play on mobile — viewport-fit=cover + 100vh/100% root, or a requestFullscreen call.',
      test:function(s){
        // WARN only if clearly NOT fullscreen: no viewport-fit=cover, no requestFullscreen, AND a fixed
        // pixel-sized root container (e.g. width:800px) which would letterbox on mobile.
        var hasCover = pat(s,/viewport-fit\s*=\s*cover/i) || pat(s,/requestFullscreen/) || pat(s,/100vh|100vw|height:\s*100%/i);
        if(hasCover) return true;
        var fixedRoot = pat(s,/#(app|game|root|stage|container)\b[^}]*\bwidth:\s*\d{3,4}px/i);
        return fixedRoot ? 'warn' : true;
      },warnText:'No fullscreen hint (viewport-fit=cover / 100vh root / requestFullscreen) and a fixed-pixel root container — on mobile the game may not fill the screen (п.1.6.1.1). Use 100vh/100vw or dvh on the root and viewport-fit=cover.'},
    {name:'Desktop field aspect ≤ 2:1 (п.1.6.2.2)',desc:'On desktop the long side of the active field must not exceed 2× the short side. A canvas locked to an extreme ratio fails. (Runtime Probe F measures the live ratio; this flags a hard-coded extreme.)',
      test:function(s){
        // Look for a canvas/stage with hard-coded width&height where ratio > 2.2 (static smell).
        var m = s.match(/(canvas|#stage|#game)[^{};]{0,80}width:\s*(\d{2,5})px[^{};]{0,40}height:\s*(\d{2,5})px/i);
        if(!m) return true;
        var w=parseInt(m[2],10), h=parseInt(m[3],10); if(!w||!h) return true;
        var r = Math.max(w,h)/Math.min(w,h);
        return r > 2.2 ? 'warn' : true;
      },warnText:'A canvas/stage is hard-coded to an aspect ratio worse than 2:1 — desktop requirement 1.6.2.2 caps the long side at 2× the short side. Let the field scale to the window (Probe F also checks the live ratio).'},
    {name:'Нет debug-инструментов в UI (п.1.15)',desc:'Поля сида, выбор поведения ИИ, скорость хода и панели замеров в релизной сборке могут показывать незавершённость игры.',
      test:function(s){
        var hits = 0;
        if (pat(s,/>\s*(сид|seed)\s*</i)) hits++;
        if (pat(s,/замер механики|debug panel|дебаг|отладк/i)) hits++;
        if (pat(s,/<select[^>]*>[\s\S]{0,200}(стратег|случайн|агрессивн)/i)) hits++;
        if (pat(s,/>\s*(Reset seed|Подсказка: (вкл|выкл))\s*</i)) hits++;
        return hits >= 2 ? 'warn' : true;
      },warnText:'Похоже, в билде остались инструменты разработчика (сид / выбор ИИ / скорость хода / панель замеров). Спрячь под ?debug=1 — иначе модерация видит WIP (п.1.15).'},
    {name:'Ввод закрыт до ready() (REQ-1.19)',desc:'Игра не должна принимать клики/клавиши, пока не вызван LoadingAPI.ready(): модератор кликами проскакивает загрузку → отказ 1.19.',
      test:function(s){
        if(!pat(s,/addEventListener\s*\(\s*['"](?:click|pointerdown|mousedown|keydown|touchstart)/i))return true;
        var gate = pat(s,/inputEnabled|inputLocked|acceptInput|canPlay|isReady|readyFired/i);
        return gate ? true : 'warn';
      },warnText:'Обработчики ввода вешаются без видимого гейта (inputEnabled/isReady и т.п.). Проверь рантайм-строку «ВВОД ПРИНЯТ ДО ready()» в консоли: если клик проходит раньше ready(), это отказ по 1.19.'},
    {name:'Keyboard control independent of layout (п.1.6.2.4)',desc:'п.1.6.2.4 — desktop gameplay controls must not depend on the active keyboard layout; physical letter controls should use KeyboardEvent.code.',
      test:function(s){
        if(!pat(s,/keydown|keyup/i))return true;
        var badKey = pat(s,/\.key\s*(===?|==)\s*['"][wasdqe]['"]/i) || pat(s,/case\s*['"][wasdqe]['"]\s*:/i);
        if(!badKey)return true;
        var hasCode = pat(s,/\.code\s*(===?|==)\s*['"]Key[WASDQE]['"]/);
        return hasCode ? true : 'warn';
      },warnText:'Letter controls appear to rely on KeyboardEvent.key (for example W/A/S/D). REQ 1.6.2.4 now explicitly requires desktop controls to work regardless of keyboard layout. Prefer KeyboardEvent.code (KeyW/KeyA/...) for physical controls and keep Arrow* keys where appropriate.'},
    {name:'No OS-shortcut key handlers (п.1.6.2.6)',desc:'Desktop games must not bind Ctrl/Alt/Meta+key combos that collide with OS/browser shortcuts.',
      test:function(s){
        // WARN if a keydown handler checks ctrlKey/metaKey/altKey together with a letter key (likely an OS combo).
        if(pat(s,/(ctrlKey|metaKey)\s*&&[^;{]{0,60}\bkey(Code)?\s*===?/i) && pat(s,/addEventListener\s*\(\s*("|')keydown/)) return 'warn';
        return true;
      },warnText:'A keydown handler reacts to Ctrl/Meta/Alt+key — these collide with OS/browser shortcuts (п.1.6.2.6). Use plain keys (WASD/arrows/space) or in-game buttons instead.'},
    {name:'No flat-black letterbox void (десктоп, 1.6.2.1)',desc:'Игра-квадрат в плоской черноте на широком экране = непродакшн. Фон должен быть атмосферным (градиент/паттерн/арт), либо ширина занята панелями.',
      test:function(s){
        // Узкая эвристика (без false-positive на полноэкранных играх):
        // фикс-ширина/центрированный stage + body с ЧИСТО чёрным фоном + нигде нет градиента/картинки фона.
        var centered = pat(s,/(#(app|game|root|stage|container)|\.(game|stage|wrap))[^}]{0,120}(max-width|margin:\s*(0\s+)?auto)/i);
        if(!centered) return true; // full-viewport игра → N/A
        var blackBody = pat(s,/body[^}]{0,80}background(-color)?:\s*(#000\b|#000000|black)\s*[;}]/i);
        if(!blackBody) return true;
        var hasAtmo = pat(s,/(body|html|::before|#bg|\.bg)[^}]{0,200}(gradient|background-image|url\()/i);
        return hasAtmo ? true : 'warn';
      },warnText:'Центрированное поле фиксированной ширины + чисто-чёрный body без градиента/паттерна/арта — на широком десктопе игра выглядит «квадратом в пустоте» (1.6.2.1: поле растягивается до края; рантайм-чек Canvas fills screen тоже упадёт). Реши по visual-upgrade Step 0.7: боковые панели на ≥1200px, либо атмосферный фон (radial-gradient палитры + тематический паттерн + виньетка).'},
    {name:'Game looks finished, not WIP (п.1.15)',desc:'Flags obvious development/placeholder UI. A clean static scan cannot prove that all texts, graphics, controls and mechanics are complete.',
      test:function(s){
        if(pat(s,/coming soon|work in progress|under construction|в разработке|скоро здесь|здесь будет|placeholder text|lorem ipsum|тут будет|TODO:.{0,40}<\//i)) return 'warn';
        return {pass:'not_verified',details:'No obvious WIP placeholder text was found, but REQ 1.15 now explicitly requires the whole game to be finished: texts, graphics, controls and gameplay mechanics. Review the complete build manually.'};
      },warnText:'The build shows development/placeholder text ("coming soon / в разработке / lorem ipsum / здесь будет"). REQ 1.15 requires a finished game with complete texts, graphics, controls and mechanics. Remove placeholder copy and stub screens.'},
    {name:'No imitation ad blocks (п.1.16)',desc:'Game must not fake Yandex ad blocks (custom fullscreen "interstitial"/"RV" UI with its own buttons).',
      test:function(s){
        // WARN if there is a custom element literally labelled as an ad block with its own close/skip button,
        // rather than calling the SDK. Heuristic: a class/id named like an ad block + a "skip/close ad" control,
        // WITHOUT the real SDK ad call nearby.
        var fakeUI = pat(s,/(class|id)\s*=\s*("|')[^"']*(interstitial|rewarded|adblock|fake-?ad|custom-?ad)/i);
        var hasSdkAd = pat(s,/showFullscreenAdv|showRewardedVideo|adv\.show/);
        var skipBtn = pat(s,/(skip|close|закрыть|пропустить)[^<]{0,20}(ad|рекл)/i);
        if(fakeUI && skipBtn && !hasSdkAd) return 'warn';
        return true;
      },warnText:'There appears to be a CUSTOM ad-like block (named interstitial/rewarded with its own skip/close button) but no SDK ad call — imitating Yandex ad blocks is forbidden (п.1.16). Show ads only via ysdk.adv.showFullscreenAdv / showRewardedVideo.'},
    {name:'No YouTube/external video player (п.3.9)',desc:'Video must not be embedded via a player that can navigate to external sites (YouTube iframe forbidden).',
      test:function(s){
        if(pat(s,/youtube\.com\/embed|youtube-nocookie\.com|<iframe[^>]+youtu\.?be|player\.vimeo\.com/i)) return false;
        return true;
      },failText:'Video is embedded via YouTube/Vimeo iframe — forbidden by п.3.9 (lets the user navigate to external sites). Self-host the video (e.g. a <video> tag with your own file, no external player UI).'},
    {name:'Ad orientation matches game (п.4.3)',desc:'Declared ad orientation should match the game orientation (no portrait ad in a landscape-only game).',
      test:function(s){
        // Light static heuristic: if orientation is locked via CSS/meta to one mode AND ad calls pass an
        // explicit conflicting orientation. Hard to prove statically → informational WARN only when both present.
        var landscapeLock = pat(s,/orientation:\s*landscape|screen\.orientation\.lock\(\s*("|')landscape/i);
        var portraitAd = pat(s,/orientation\s*:\s*("|')portrait/i);
        if(landscapeLock && portraitAd) return 'warn';
        return true;
      },warnText:'Game orientation looks locked to landscape but an ad/orientation reference says portrait (п.4.3 — ad orientation must match the game). Verify ad blocks use the same orientation as the game.'},
    {name:'Sound toggle present (реком. 6.2)',desc:'Recommended (07.2026): a way to mute/toggle sound. Not moderated, but affects quality/rating (2.13: rating ≤30 for 3 weeks → unpublished).',
      test:function(s){
        if(!pat(s,/new Audio|AudioContext|<audio|Howl|Tone\./i))return true; // no sound at all → N/A
        return pat(s,/(mute|sound|звук|audio)[^>]{0,40}(toggle|btn|button|onclick|checkbox)/i)
            || pat(s,/(toggle|btn|button)[^>]{0,40}(mute|sound|звук)/i)
            || pat(s,/soundToggle|toggleSound|muteBtn|btnSound|soundOn\s*=/i) ? true : 'warn';
      },warnText:'Игра со звуком, но не видно переключателя звука (рекомендация 6.2). Не блокер, но качество влияет на рейтинг, а рейтинг ≤30 три недели = снятие (2.13).'},
    {name:'Pause available (реком. 6.3)',desc:'Recommended (07.2026): a pause. N/A for idle/turn-based without real-time pressure.',
      test:function(s){
        if(!pat(s,/requestAnimationFrame|setInterval\s*\(\s*game|gameLoop|update\s*\(dt/i))return true; // no realtime loop → N/A
        return pat(s,/pauseGame|isPaused|paused\s*=|btnPause|pauseBtn|пауза/i) ? true : 'warn';
      },warnText:'Реалтайм-цикл без видимой паузы (рекомендация 6.3). Не блокер; советует Яндекс.'},
    {name:'Title without the word "игра/game" (реком. 6.5)',desc:'Recommended (07.2026): lakoничное название без слова «игра/game».',
      test:function(s){
        var m=s.match(/<title>([^<]{1,80})<\/title>/i); if(!m)return true;
        return /\b(game|games)\b|игра|игры/i.test(m[1]) ? 'warn' : true;
      },warnText:'В <title> есть слово «игра/game» — рекомендация 6.5 советует лаконичное название без него.'},
    {name:'No useless exit button (реком. 6.7)',desc:'Recommended (07.2026): no non-functional buttons — an "exit/quit" button is meaningless in a web game.',
      test:function(s){
        return pat(s,/(btn|button)[^>]{0,60}>(\s|&nbsp;)*(выход|выйти\s*из\s*игры|exit\s*game|quit\s*game)/i)
            || pat(s,/(выход из игры|exit game|quit game)[^<]{0,20}<\/button/i) ? 'warn' : true;
      },warnText:'Найдена кнопка «выход/exit game» — в веб-игре она бесполезна (рекомендация 6.7). Убери или замени на «в меню».'},
    {name:'No profanity in UI text (п.8.2.4)',desc:'Visible text must not contain profanity in any language.',
      test:function(s){
        // \b word-boundary is ASCII-only in JS, so it never matches before Cyrillic. Split:
        //   English → require word boundaries (avoids Scunthorpe-style false hits);
        //   Russian → match distinctive stems (no \b; these stems don't occur in clean words).
        var en = /\b(fuck|shit|bitch|asshole|cunt|dick|bastard)\w*/i;
        var ru = /(хуй|хуё|хуя|пизд|бляд|еба[лнтя]|ебу|ебё|ебан|сука|суки|залуп|мудак|мудил|пидор|пидар|гандон|гондон|долбоёб|охуе|ахуе|нахуй|похуй)/i;
        // standalone "бля" needs a Cyrillic-aware boundary (\b is ASCII-only and never matches
        // next to Cyrillic — a dead pattern the audit caught). Match "бля" NOT followed/preceded
        // by another Cyrillic letter (so "бляха" stays clean, "ну бля" is caught).
        var ruBlya = /(^|[^а-яё])бля([^а-яё]|$)/i;
        return (en.test(s) || ru.test(s) || ruBlya.test(s)) ? 'warn' : true;
      },warnText:'Possible profanity detected in the source/UI text (п.8.2.4 — no obscene language in any language). Review and replace; if it is a false match (clean homograph), ignore.'},
    {name:'Canvas adapts to resize/orientation (п.1.10)',desc:'п.1.10 — the game must remain correctly displayed after window resize and screen rotation.',
      test:function(s){
        if(!pat(s,/<canvas|getContext\s*\(\s*("|')(webgl|2d)|THREE\.|renderer\.setSize/i))return true;
        var adaptive = pat(s,/addEventListener\s*\(\s*("|')(resize|orientationchange|fullscreenchange)/i)
                    || pat(s,/screen\.orientation|ResizeObserver|visualViewport/i)
                    || pat(s,/canvas[^{}]{0,220}(?:width|height)\s*:\s*(?:100%|100vw|100vh)/i)
                    || pat(s,/renderer\.setSize\s*\(\s*(?:window\.)?innerWidth/i);
        return adaptive ? true : 'warn';
      },warnText:'Canvas/WebGL content was found, but no clear adaptive resize/orientation handling was detected. REQ 1.10 now explicitly covers both window resizing and screen rotation. Verify portrait↔landscape and desktop resize without clipping, overlap, page scroll or broken canvas sizing.'},
    {name:'Progress preserved after orientation change (п.1.9)',desc:'п.1.9 — on mobile, meaningful game progress must not be lost when device orientation changes.',
      test:function(s){
        var mobile=pat(s,/orientationchange|screen\.orientation|visualViewport|touchstart|viewport-fit|user-scalable|maximum-scale/i);
        if(!mobile)return true;
        return {pass:'not_verified',details:'Static analysis cannot prove that the exact in-game state survives portrait↔landscape rotation. Make meaningful progress, rotate the device, and verify that state/progress is preserved.'};
      }},
    {name:'ready() not tuned to pass the checker (integrity)',desc:'No magic delay / debugcheck-targeting right before ready() — ready() must reflect real interactivity, not a tuned timer',
      test:function(s){
        // Anti-gaming: a fixed setTimeout immediately before LoadingAPI.ready(), or a comment
        // admitting the timing exists to pass debugcheck/probe, means the game was tuned to the
        // CHECKER instead of the requirement. WARN (not hard-fail): the un-gameable runtime Probe E
        // is the source of truth for ready-timing; this static signal just flags tuning to clean up.
        if(pat(s,/(pass|fail)[^\n]{0,40}(debugcheck|debug checker|probe|runtime[- ]?test)/i))return 'warn';
        if(pat(s,/debugcheck[^\n]{0,40}(poll|tick|timing|delay)/i))return 'warn';
        if(pat(s,/setTimeout\([^)]*,\s*\d+\s*\)[\s\S]{0,120}?LoadingAPI[\s\S]{0,4}ready\s*\(/))return 'warn';
        return true;
      },warnText:'Timing appears tuned to the checker (a delay/comment referencing debugcheck/probe before ready()). Runtime Probe E verifies the REAL timing — but remove the checker-targeting code: fire ready() when the menu is actually painted (double requestAnimationFrame), not on a magic delay.'},
    {name:'Progress saved before ad (п.4.2)',desc:'player.setData/save called near ad open (progress survives ad reload)',
      test:function(s){
        // Heuristic: if interstitial is used, a save (setData/saveProgress/localStorage write) should exist too.
        if(!pat(s,/showFullscreenAdv/))return true; // no interstitial → N/A
        return pat(s,/setData\s*\(|saveProgress|saveGame|player\.setData/);
      }},
    {name:'Monetization present or explicitly waived (п.1.12)',desc:'п.1.12 — the game has Yandex ads or in-app purchases, unless monetization is intentionally disabled and stated in the Draft developer comment.',
      test:function(s){
        var hasMonetization=pat(s,/showFullscreenAdv|showRewardedVideo|StickyAdv|BannerAdv|getPayments\s*\(|purchase\s*\(|getCatalog\s*\(/i);
        if(hasMonetization)return true;
        return {pass:'not_verified',details:'No ad/IAP markers were found in the scanned game source. This can be valid under REQ 1.12 only when monetization is intentionally disabled and that decision is written in the Draft developer comment.'};
      }},
    {name:'No external ad networks',desc:'п.4.1 — only Yandex SDK ads (checks game source only)',
      test:function(s){
        // Only check INLINE scripts in the game source, not injected platform scripts
        // Extract content between <script> tags (inline only, skip src= tags)
        var inlineScripts='';
        var re=/<script(?![^>]*\bsrc\b)[^>]*>([\s\S]*?)<\/script>/gi;
        var m;
        while((m=re.exec(s))!==null){inlineScripts+=m[1]+'\n';}
        return!pat(inlineScripts,/googletag|doubleclick\.net|adsbygoogle|google_ad_client/);
      }},
  ]},
  {id:'leaderboard',title:'Leaderboard',icon:'\u{1F3C6}',optional:true,checks:[
    {name:'Leaderboard API (current)',desc:'ysdk.leaderboards direct access',
      test:function(s){
        // Current API: ysdk.leaderboards.setScore/getEntries/getPlayerEntry
        if(pat(s,/ysdk\.leaderboards\b/))return true;
        // Wrapper pattern: .leaderboards. access
        if(pat(s,/\.leaderboards\./))return true;
        // Deprecated: ysdk.getLeaderboards() — warn
        if(pat(s,/getLeaderboards\s*\(/))return 'warn';
        return false;
      },failText:'No leaderboard API — use ysdk.leaderboards.setScore(name, score)',
      warnText:'Uses deprecated getLeaderboards() — migrate to ysdk.leaderboards'},
    {name:'setScore() call',desc:'ysdk.leaderboards.setScore(name, score)',
      test:function(s){
        // Current: .setScore( — direct on leaderboards or wrapper
        if(pat(s,/\.setScore\s*\(/))return true;
        // Deprecated: setLeaderboardScore — warn
        if(pat(s,/setLeaderboardScore\s*\(/))return 'warn';
        return false;
      },warnText:'Uses deprecated setLeaderboardScore() — use ysdk.leaderboards.setScore(name, score)'},
    {name:'getEntries() call',desc:'ysdk.leaderboards.getEntries(name, opts)',
      test:function(s){
        if(pat(s,/\.getEntries\s*\(/))return true;
        // Deprecated
        if(pat(s,/getLeaderboardEntries\s*\(/))return 'warn';
        return false;
      },warnText:'Uses deprecated getLeaderboardEntries() — use ysdk.leaderboards.getEntries(name, opts)'},
    {name:'Leaderboard name [a-zA-Z0-9]',desc:'Name without _ or - (e.g. "killsbest")',
      test:function(s){
        // Check ALL setScore('name') and submitScore('name') patterns
        var names=[];
        var re=/(?:\.setScore|submitScore)\s*\(\s*['"]([^'"]+)['"]/g,m;
        while((m=re.exec(s))!==null){
          // Skip console.log strings and isAvailableMethod args
          var ctx=s.substring(Math.max(0,m.index-30),m.index);
          if(ctx.indexOf('console.')>=0||ctx.indexOf('isAvailable')>=0)continue;
          names.push(m[1]);
        }
        if(names.length>0){
          var allValid=names.every(function(n){return/^[a-zA-Z0-9]+$/.test(n);});
          if(allValid)return true;
          return false;
        }
        // Check _name:'xxx' pattern (wrapper)
        var m2=s.match(/_name\s*:\s*['"]([^'"]+)['"]/);
        if(m2){
          if(/^[a-zA-Z0-9]+$/.test(m2[1]))return true;
          return false;
        }
        // setScore with variable arg — can't validate statically
        return pat(s,/\.setScore\s*\(/)?{pass:'not_verified',details:'setScore found but leaderboard name is dynamic; cannot validate the name statically'}:false;
      },failText:'Leaderboard name contains invalid chars — only [a-zA-Z0-9] allowed (no _ or -)',
      warnText:'setScore found but leaderboard name not detected — verify manually'},
  ]},
  // ===== RUNTIME CHECKS (v2.0) =====
  {id:'timing',title:'Timing Verification',icon:'\u23F1\uFE0F',checks:[
    {name:'GameReady after fonts',desc:'\u043F.1.19 \u2014 ready() AFTER fonts loaded',
      test:function(){
        if(!TIMING.gameReady)return {pass:'not_verified',details:'LoadingAPI.ready() has not been observed yet'};
        if(!TIMING.fontsLoaded)return {pass:'not_verified',details:'document.fonts.ready timing is unavailable'};
        return TIMING.gameReady>TIMING.fontsLoaded?true:'warn';
      },warnText:'Not detected yet \u2014 interact with game, re-check',
      failText:'LoadingAPI.ready() fired BEFORE fonts! Move ready() after document.fonts.ready'},
    {name:'GameReady after first paint',desc:'\u043F.1.19 \u2014 ready() AFTER UI visible',
      test:function(){
        if(!TIMING.gameReady||!TIMING.firstPaint)return {pass:'not_verified',details:'Need both first-paint and LoadingAPI.ready() runtime timestamps'};
        var delta = TIMING.gameReady - TIMING.firstPaint;
        // Strict fail: ready() BEFORE first paint event (negative delta).
        if(delta < 0) return 'warn';
        // Soft warn: same-frame timing — fine in single-file games on local
        // server (no network), suspicious when a real game has many assets.
        if(delta < 50) return 'warn';
        return true;
      },warnText:'ready() fires same frame as load — OK for tiny single-file games. Verify on real Yandex Stage that the title screen renders before the loader hides.',
      failText:'ready() fired BEFORE window.load — must wait for the title screen to be visible (REQ-1.19.2-PRECISION)'},
    {name:'GameReady not too late',desc:'\u043F.1.19.2 \u2014 ready() within 90s',
      test:function(){
        if(!TIMING.gameReady)return {pass:'not_verified',details:'LoadingAPI.ready() has not been observed yet'};
        return(TIMING.gameReady-TIMING.domReady)<90000;
      },warnText:'Not detected yet',
      failText:'ready() took >90s \u2014 Game Ready is considered not implemented by the moderation check'},
    {name:'UI not interactive before SDK',desc:'\u043F.2.14 \u2014 no clickable content before SDK init',
      test:function(){
        if(!TIMING.sdkInit)return {pass:'not_verified',details:'SDK initialization timestamp is unavailable'};
        if(!TIMING.firstUserClick)return {pass:'not_verified',details:'No user interaction observed yet; cannot compare ordering'};
        // If user clicked BEFORE SDK was initialized, game showed interactive content too early
        if(TIMING.firstUserClick<TIMING.sdkInit){
          RT._earlyClick={userClick:Math.round(TIMING.firstUserClick),sdkInit:Math.round(TIMING.sdkInit),delta:Math.round(TIMING.sdkInit-TIMING.firstUserClick)+'ms'};
          return 'warn';
        }
        return true;
      },warnText:'User interaction happened before SDK initialization — review startup ordering',
      failText:'User clicked BEFORE SDK initialized! Game shows interactive UI too early. Check RT._earlyClick'},
    {name:'Language detected before UI',desc:'\u043F.2.14 \u2014 detectLang() before interactive content',
      test:function(){
        if(!TIMING.langDetected)return {pass:'not_verified',details:'No confirmed SDK language read timestamp yet'};
        if(TIMING.firstUserClick)return TIMING.langDetected<TIMING.firstUserClick;
        if(TIMING.gameReady)return TIMING.langDetected<=TIMING.gameReady
          ? {pass:true,details:'Language was read before Game Ready; no earlier user interaction was observed'}
          : false;
        return {pass:'not_verified',details:'Language read is known, but neither user interaction nor Game Ready ordering can be compared yet'};
      },warnText:'Not detected yet',
      failText:'Language detected AFTER user interaction! User sees wrong language first'},
  ]},
  {id:'overflow',title:'Visual Overflow (\u043F.1.10.1)',icon:'\u{1F4D0}',checks:[
    {name:'No elements overflow viewport',desc:'\u043F.1.10.1 \u2014 nothing outside screen',
      test:function(){
        var all=document.querySelectorAll('*'),overflowed=[];
        var vw=window.innerWidth,vh=window.innerHeight;
        all.forEach(function(el){
          var r=el.getBoundingClientRect();
          if(r.width===0||r.height===0)return;
          var cs=getComputedStyle(el);
          if(cs.display==='none'||cs.visibility==='hidden'||cs.opacity==='0')return;
          if(el.closest('.dc-overlay'))return;
          // Skip elements with animation/transform (tickers, marquees)
          if(cs.animation&&cs.animation!=='none')return;
          // Skip inside hidden modals
          if(el.closest('.modal.h,.h,[style*="display: none"],[style*="display:none"]'))return;
          // Skip inside overflow:hidden parents (content clipped, not visible)
          var p=el.parentElement;
          while(p&&p!==document.body){var po=getComputedStyle(p).overflow;if(po==='hidden'||po==='clip')return;p=p.parentElement;}
          if(r.right>vw+2||r.bottom>vh+2||r.left<-2||r.top<-2)
            overflowed.push(el.tagName+(el.id?'#'+el.id:'')+(el.className?' .'+String(el.className).split(' ')[0]:''));
        });
        if(overflowed.length===0)return true;
        RT._overflowed=overflowed;
        return overflowed.length<=2?'warn':false;
      },warnText:'Minor overflow detected \u2014 check RT._overflowed',
      failText:'Elements overflow viewport! Check console: RT._overflowed'},
    {name:'Canvas fills screen',desc:'\u043F.1.6.2.1 \u2014 game stretches to edges',
      test:function(){
        var c=document.querySelector('canvas');
        if(!c)return 'warn';
        var cw=c.clientWidth||c.width,ch=c.clientHeight||c.height;
        var vw=window.innerWidth,vh=window.innerHeight;
        // Direct check: canvas covers >=80% of viewport
        if(cw>=vw*0.8&&ch>=vh*0.8)return true;
        // Game with side panel: canvas + panel together fill width
        var gameArea=c.closest('#game,#app,.game,.app,[id*=game]');
        if(gameArea){var gr=gameArea.getBoundingClientRect();if(gr.width>=vw*0.95&&gr.height>=vh*0.8)return true;}
        // Flexible: if canvas covers >=50% AND total game container covers viewport
        var cr=c.getBoundingClientRect();
        if(cr.width>=vw*0.45&&cr.height>=vh*0.7)return 'warn';
        return false;
      },warnText:'Canvas may not fill screen \u2014 verify game area covers viewport',
      failText:'Game area does not fill screen'},
    {name:'Touch targets >= 44px',desc:'\u043F.1.8 \u2014 buttons big enough to tap',
      test:function(){
        var small=[];
        document.querySelectorAll('button,[onclick],[role=button],a,input,.btn').forEach(function(el){
          if(el.closest('.dc-overlay'))return;
          var cs=getComputedStyle(el);
          if(cs.display==='none'||cs.visibility==='hidden'||cs.opacity==='0')return;
          // Skip elements inside hidden panels/modals
          if(el.closest('.modal.h,.h,[style*="display: none"],[style*="display:none"]'))return;
          // Skip elements inside collapsed panels
          if(el.closest('.collapsed,[aria-hidden=true]'))return;
          var r=el.getBoundingClientRect();
          // Skip off-screen or zero-size elements
          if(r.width<=0||r.height<=0||r.bottom<0||r.top>window.innerHeight)return;
          if(r.width<44||r.height<44)
            small.push(el.tagName+(el.id?'#'+el.id:'')+(el.className?' .'+el.className.split(' ')[0]:'')+' '+Math.round(r.width)+'x'+Math.round(r.height));
        });
        if(small.length===0)return true;
        RT._smallButtons=small;
        return 'warn';
      },warnText:'Some buttons may be too small \u2014 check RT._smallButtons',
      failText:'Multiple buttons < 44px! Check RT._smallButtons'},
  ]},
  {id:'lang_runtime',title:'Language Check (Runtime)',icon:'\u{1F30D}',checks:[
    {name:'SDK language read before Game Ready',desc:'п.2.14 — runtime language read must happen during startup, before LoadingAPI.ready()',rt:true,
      test:function(){
        if(RT._i18nRead!==true)return {pass:'not_verified',details:'No confirmed runtime language read yet'};
        if(!TIMING.gameReady)return {pass:'not_verified',details:'Language read confirmed; waiting for LoadingAPI.ready() to verify ordering'};
        if(!TIMING.langDetected)return {pass:'not_verified',details:'Language read confirmed but its timestamp is unavailable'};
        if(TIMING.langDetected<=TIMING.gameReady){
          return {pass:true,details:'Runtime order confirmed: lang +'+Math.round(TIMING.langDetected-(TIMING.domReady||0))+'ms → ready +'+Math.round(TIMING.gameReady-(TIMING.domReady||0))+'ms'};
        }
        return {pass:false,details:'Language was read after LoadingAPI.ready()'};
      },failText:'Read ysdk.environment.i18n.lang during startup before LoadingAPI.ready()'},
    {name:'No untranslated Cyrillic on non-RU',desc:'\u043F.8.2.3 \u2014 no mixed language',
      test:function(){
        var lang=RT._detectedLang;
        if(!lang)return {pass:'not_verified',details:'Active SDK language is unknown; DOM translation scan cannot be interpreted'};
        if(lang==='ru')return true;
        var walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);
        var cyr=[],node;
        function isVisible(el){
          // Walk ancestors — element is hidden if ANY ancestor has display:none
          // or visibility:hidden, or it has zero offsetParent (not in render tree).
          if(!el)return false;
          if(el.offsetParent===null && el.tagName!=='BODY' && el.tagName!=='HTML')return false;
          while(el && el!==document.body){
            var st=getComputedStyle(el);
            if(st.display==='none'||st.visibility==='hidden')return false;
            el=el.parentElement;
          }
          return true;
        }
        while(node=walker.nextNode()){
          var p=node.parentElement;
          if(!p)continue;
          if(p.closest('.dc-overlay'))continue;
          if(!isVisible(p))continue; // skip text in hidden overlays/screens
          var t=node.textContent.trim();
          if(t.length>2&&/[\u0410-\u044f\u0451\u0401]{3,}/.test(t)){
            cyr.push(t.slice(0,40)+' (in <'+p.tagName.toLowerCase()+(p.id?' #'+p.id:'')+'>)');
          }
        }
        if(cyr.length===0)return true;
        RT._untranslated=cyr;
        return false;
      },warnText:'Could not determine active SDK language — verify translations with the Yandex debug panel',
      failText:'Cyrillic on non-RU language! Check RT._untranslated in console'},
    {name:'Canvas text reminder',desc:'Canvas drawText not scannable by DOM',
      test:function(){return document.querySelector('canvas')?{pass:'not_verified',details:'Canvas text is not visible to DOM scanning; verify rendered text for declared languages'}:true;},
      warnText:'Game uses Canvas \u2014 manually verify drawText() translations for each ?lang=xx'},
  ]},
  {id:'scroll_runtime',title:'Scroll/Refresh (Runtime)',icon:'\u{1F4DC}',checks:[
    {name:'No body scroll',desc:'\u043F.1.10.2 \u2014 page should not scroll',
      test:function(){
        var html=getComputedStyle(document.documentElement),body=getComputedStyle(document.body);
        var hOk=html.overflow==='hidden'||html.overflowY==='hidden';
        var bOk=body.overflow==='hidden'||body.overflowY==='hidden';
        var osb=html.overscrollBehavior||body.overscrollBehavior||'';
        var osbOk=osb==='none'||osb==='contain';
        if(hOk&&bOk&&osbOk)return true;
        if(hOk||bOk)return 'warn';
        return false;
      },warnText:'Partial scroll protection \u2014 add overscroll-behavior:none',
      failText:'No scroll protection! Add overflow:hidden + overscroll-behavior:none'},
    {name:'Document not scrollable',desc:'Content fits viewport',
      test:function(){
        return!(document.documentElement.scrollHeight>window.innerHeight+5||document.body.scrollHeight>window.innerHeight+5);
      },failText:'Page taller than viewport \u2014 will scroll on mobile!'},
    {name:'touch-action blocks iOS refresh',desc:'touch-action:none on html/body prevents swipe gestures',
      test:function(){
        var html=getComputedStyle(document.documentElement),body=getComputedStyle(document.body);
        var ta=html.touchAction||'';var tb=body.touchAction||'';
        if(ta==='none'||tb==='none')return true;
        if(ta==='manipulation'||tb==='manipulation')return 'warn';
        return 'warn';
      },warnText:'No strong touch-action protection detected — verify swipe-to-refresh manually',
      failText:'No touch-action set! iOS will allow swipe-to-refresh. Add: html,body{touch-action:none}'},
    {name:'contextmenu actually blocked',desc:'Right-click preventDefault covers entire page',
      test:function(){
        // Dispatch synthetic contextmenu and check if defaultPrevented AFTER dispatch
        var testEvt=new MouseEvent('contextmenu',{bubbles:true,cancelable:true});
        document.body.dispatchEvent(testEvt);
        if(testEvt.defaultPrevented)return true;
        // Try on a fresh element outside game area
        var outer=document.createElement('div');document.body.appendChild(outer);
        var testEvt2=new MouseEvent('contextmenu',{bubbles:true,cancelable:true});
        outer.dispatchEvent(testEvt2);
        document.body.removeChild(outer);
        return testEvt2.defaultPrevented?true:false;
      },failText:'contextmenu NOT blocked on entire page! Handler may only cover game area. Fix: document.addEventListener("contextmenu",e=>e.preventDefault())'},
  ]},

  // ===== v2.4 RUNTIME PROBES =====
  {id:'ad_context_runtime',title:'Ad Context (Runtime)',optional:true,icon:'\u{1F4FA}',checks:[
    {name:'Interstitial start delay (REQ-4.4)',desc:'When callbacks.onOpen is observable, measure the real ad-open callback against the triggering user action; the documented limit is 0.33s.',
      test:function(){
        if(!TIMING.adCalls||TIMING.adCalls.length===0)return {pass:'not_verified',details:'No interstitial observed in this session'};
        var calls=TIMING.adCalls.filter(function(c){return c.type==='interstitial';});
        var measured=calls.filter(function(c){return Number.isFinite(c.openDelayFromGesture);});
        if(measured.length===0)return {pass:'not_verified',details:'Interstitial SDK call observed, but callbacks.onOpen was not observable, so the actual ad-start delay could not be measured.'};
        var bad=measured.filter(function(c){return c.openDelayFromGesture>330;});
        if(bad.length===0)return true;
        RT._adStartDelayRisk=bad;
        return 'warn';
      },warnText:'Observed interstitial onOpen more than 0.33s after the triggering user action in this run. Yandex recommends checking the delay on the usual device, in incognito, and on another device before concluding it is reproducible. Also verify the ad appears only at a valid logical pause.'},
    {name:'All rewarded videos follow user gesture (REQ-4.5)',desc:'showRewardedVideo must be user-initiated',
      test:function(){
        if(!TIMING.adCalls||TIMING.adCalls.length===0)return {pass:'not_verified',details:'No rewarded video observed in this session'};
        var bad=TIMING.adCalls.filter(function(c){return c.type==='rewarded'&&c.gestureDelta>330;});
        if(bad.length===0)return true;
        RT._rvWithoutGesture=bad;
        var noGesture=bad.some(function(c){return !isFinite(c.gestureDelta);});
        return noGesture?false:'warn';
      },warnText:'No rewarded ads shown yet — click an RV button to verify.',
      failText:'Rewarded video called >330ms after last gesture — REQ-4.5 violation (must be user-initiated). Check RT._rvWithoutGesture'}
  ]},
  {id:'runtime',title:'Runtime Detection',icon:'\u{1F3AE}',checks:[
    {name:'SDK loaded',desc:'YaGames or ysdk available at runtime',
      test:function(s){
        // Direct runtime check
        if(typeof YaGames!=='undefined'||window.ysdk)return true;
        if(RT.calls.has('YaGames global found')||RT.calls.has('ysdk global found'))return true;
        // Static fallback: SDK script tag present = will load on platform
        if(pat(s,/<script[^>]*src=["']\/sdk\.js["']/i))return {pass:'not_verified',details:'SDK script tag exists, but SDK is not available in this runtime'};
        return false;
      },warnText:'SDK script present but not loaded (expected locally, OK on Yandex)'},
    {name:'SDK initialized',desc:'YaGames.init() was called (or dev mode)',
      test:function(s){
        // Runtime: check globals
        if(window.ysdk||typeof YaGames!=='undefined')return true;
        // Static fallback: if source has YaGames.init() — trust it
        if(pat(s,/YaGames\.init\s*\(/))return {pass:'not_verified',details:'YaGames.init() exists in source, but runtime initialization was not observed'};
        return false;
      },warnText:'YaGames.init() in source but SDK not detected at runtime (OK if local)'},
    {name:'No console errors',desc:'реком.6.4 / п.1.14 — review console errors',
      test:function(){
        var real=RT.errors.filter(function(e){return!/favicon|debugcheck|404|sdk\.js/.test(e);});
        return real.length===0?true:(real.length<=3?'warn':false);
      },warnText:'Some console errors detected',failText:'Multiple console errors!'},
  ]},
];

// Node-only export so the negative-test harness can run the REAL static checks against fixtures
// (no behavior change in browser — typeof module is 'undefined' there). This guarantees the test
// exercises the exact same check code that ships, not a re-extracted copy.
try { if (typeof module !== 'undefined' && module.exports) { module.exports.__CATS = CATS; } } catch (e) {}

// ── Last report (for copy) ──────────────────────────────────────
var _lastReport='';

// ── Source code fetch (supports multi-file games) ───────────────
function getSource(cb){
  var bust='?_dc='+Date.now();
  var tryPaths=['index.html'+bust,window.location.pathname+bust,window.location.href+(window.location.href.indexOf('?')===-1?bust:('&_dc='+Date.now()))];
  var attempt=0;
  function tryNext(){
    if(attempt>=tryPaths.length){cb(stripSelf(document.documentElement.outerHTML));return;}
    var xhr=new XMLHttpRequest();
    xhr.open('GET',tryPaths[attempt],true);
    xhr.onload=function(){
      if(xhr.status===200&&xhr.responseText.length>100){
        // Got index.html — now also fetch all linked JS files
        fetchLinkedScripts(xhr.responseText,function(src){cb(stripSelf(src));});
      }else{attempt++;tryNext();}
    };
    xhr.onerror=function(){attempt++;tryNext();};
    xhr.send();
  }
  tryNext();
}

// Strip debugcheck.js content from the scanned source so its own regex literals do not self-match.
function stripSelf(src){
  if(!src)return src;
  src = src.replace(/\/\/ === DEBUGCHECK_SELF_START ===[\s\S]*?\/\/ === DEBUGCHECK_SELF_END ===/g, '/* debugcheck stripped */');
  return src;
}

function fetchLinkedScripts(indexSrc,cb){
  // Find all <script src="..."> tags (relative paths only, skip /sdk.js and absolute URLs)
  var re=/<script[^>]+src=["']([^"']+)["'][^>]*>/gi;
  var m,urls=[];
  while((m=re.exec(indexSrc))!==null){
    var u=m[1];
    if(u==='/sdk.js'||/^https?:\/\//.test(u)||/debugcheck/i.test(u))continue; // skip SDK, external, and self
    urls.push(u);
  }
  // Also find <link rel="stylesheet" href="...">
  var cssRe=/<link[^>]+href=["']([^"']+\.css)["'][^>]*>/gi;
  while((m=cssRe.exec(indexSrc))!==null){
    if(!/^https?:\/\//.test(m[1]))urls.push(m[1]);
  }
  if(urls.length===0){cb(indexSrc);return;}

  var allSrc=indexSrc;
  var loaded=0;
  var bust='?_dc='+Date.now();
  urls.forEach(function(url){
    var xhr=new XMLHttpRequest();
    xhr.open('GET',url+bust,true);
    xhr.onload=function(){
      if(xhr.status===200)allSrc+='\n/* === '+url+' === */\n'+xhr.responseText;
      loaded++;
      if(loaded>=urls.length)cb(allSrc);
    };
    xhr.onerror=function(){loaded++;if(loaded>=urls.length)cb(allSrc);};
    xhr.send();
  });
}

// ── Public rule metadata / conservative verdict policy ───────────────
// "REQUIREMENT" means the checker rule is tied to a published Yandex requirement;
// it does NOT mean Yandex authored or endorsed the checker implementation.
var HARD_FAIL_CHECKS=new Set([
  'SDK script tag','YaGames.init()','LoadingAPI.ready()',
  'No URL-based gating (п.1.18)','No YouTube/external video player (п.3.9)',
  'No external ad networks','No Yandex S3 URLs',
  'GameReady not too late','environment.i18n.lang','SDK language read before Game Ready',
  'No body scroll','Document not scrollable','contextmenu actually blocked',
  'SDK loaded','SDK initialized'
]);
function checkMeta(ch){
  var text=[ch.name,ch.desc,ch.warnText,ch.failText].filter(Boolean).join(' ');
  var m=text.match(/(?:REQ-|п\.?\s*|пункт\s+)(\d+(?:\.\d+)+)/i);
  var req=m?m[1]:'';
  var isRec=/реком|recommend/i.test(text)||(req&&req.indexOf('6.')===0);
  return {kind:isRec?'recommendation':(req?'requirement':'heuristic'),requirement:req};
}
function metaBadge(meta){
  if(meta.kind==='recommendation')return {label:'REC'+(meta.requirement?' '+meta.requirement:''),cls:'dc-meta-rec'};
  if(meta.kind==='requirement')return {label:'REQ '+meta.requirement,cls:'dc-meta-req'};
  return {label:'HEURISTIC',cls:'dc-meta-heu'};
}
function buildPublicNotice(){
  return '<div class="dc-notice"><b>Unofficial pre-submit checker.</b> Results are advisory; PASS does not guarantee moderation approval. WARN means a detected risk; NOT VERIFIED means the checker could not prove the result automatically. Review the manual checklist for remaining coverage.</div>';
}

// ── Run Checks ──────────────────────────────────────────────────
function runChecks(){
  probeRuntime(); // fresh probe before each check
  getSource(function(src){
    window._dcSource=src; // Store for LB tools auto-detection
    var pass=0,fail=0,warn=0,notVerified=0;
    var html='';
    var report='YG DEBUG CHECKER REPORT\n';
    report+='Date: '+new Date().toLocaleString()+'\n';
    report+='URL: '+window.location.href+'\n';
    report+='Scanned source: '+Math.round(src.length/1024)+' KB\n';
    report+='================================\n\n';

    CATS.forEach(function(cat){
      // Skip optional categories if none of their checks pass.
      // A check is considered "present" only if it returns true (not 'warn', not
      // {pass:true,details:'No IAP — n/a'} — guard checks that pass when feature
      // is absent must NOT count toward presence detection).
      // Additionally: skip checks tagged with `guard:true` — they only validate
      // that an absent feature stays absent, never proving the feature exists.
      if(cat.optional){
        var anyPresent=false;
        cat.checks.forEach(function(ch){
          if(ch.guard) return;
          try{
            var r=ch.test(src);
            if(r === true) anyPresent = true;
          }catch(e){}
        });
        if(!anyPresent){
          // Show as N/A, don't count as fail
          var skipReport=cat.icon+' '+cat.title+' — N/A (not used)\n';
          report+=skipReport+'\n';
          html+='<div class="dc-sec">'
            +'<div class="dc-sh">'
            +'<span class="dc-arr">\u25B6</span>'
            +'<span class="dc-si">'+cat.icon+'</span>'
            +'<span class="dc-st">'+cat.title+'</span>'
            +'<span class="dc-badge" style="background:#1a1a2e;color:#666">N/A</span>'
            +'<span class="dc-cnt" style="color:#555">not used</span>'
            +'</div>'
            +'<div class="dc-sb"></div>'
            +'</div>';
          return; // skip this category
        }
      }
      var cp=0,cf=0,cw=0,cn=0;
      var rows='';
      var catReport=cat.icon+' '+cat.title+'\n';

      cat.checks.forEach(function(ch){
        var meta=checkMeta(ch), mb=metaBadge(meta);
        var result;
        try{result=ch.test(src);}catch(e){result=false;}

        // Normalize result. Supported shapes:
        //   true                              → PASS
        //   'warn'                            → WARN (use ch.warnText)
        //   false                             → FAIL (use ch.failText)
        //   { pass:true, details:'...' }      → PASS, override "Found" with details
        //   { pass:false, details:'...' }     → FAIL, override failText with details
        //   { pass:'warn', details:'...' }    → WARN, override warnText with details
        //   { pass:'not_verified', details:'...' } → NOT VERIFIED (not a defect signal)
        var status, customDetails = null;
        if (result && typeof result === 'object' && 'pass' in result) {
          status = result.pass === true ? 'pass' : (result.pass === 'warn' ? 'warn' : (result.pass === 'not_verified' ? 'not_verified' : 'fail'));
          customDetails = result.details || null;
        } else if (result === true) status = 'pass';
        else if (result === 'warn') status = 'warn';
        else if (result === 'not_verified') status = 'not_verified';
        else status = 'fail';

        // Public policy: regex/architecture heuristics are advisory. Only a small,
        // audited allow-list may emit a hard FAIL. This prevents implementation-style
        // assumptions from masquerading as platform verdicts.
        if(status==='fail'&&!HARD_FAIL_CHECKS.has(ch.name)) status='warn';

        var icon,cls,detail,reportLine;
        if(status === 'pass'){
          icon='\u2714';cls='dc-pass';cp++;pass++;
          detail='<span class="dc-det dc-ok">'+(customDetails||'Found')+'</span>';
          reportLine='  [PASS]['+mb.label+'] '+ch.name+(customDetails?' — '+customDetails:'');
        }else if(status === 'warn'){
          icon='\u26A0';cls='dc-warn';cw++;warn++;
          var wt = customDetails || ((result===false|| (result&&typeof result==='object'&&result.pass===false))?ch.failText:null) || ch.warnText || 'Detected risk — review this item';
          detail='<span class="dc-det dc-wr">'+wt+'</span>';
          reportLine='  [WARN]['+mb.label+'] '+ch.name+' — '+wt;
        }else if(status === 'not_verified'){
          icon='?';cls='dc-nv';cn++;notVerified++;
          var nt = customDetails || 'Checker could not prove this automatically';
          detail='<span class="dc-det dc-nvdet"><b>NOT VERIFIED</b> — '+nt+'</span>';
          reportLine='  [NOT VERIFIED]['+mb.label+'] '+ch.name+' — '+nt;
        }else{
          icon='\u2718';cls='dc-fail';cf++;fail++;
          var ft = customDetails || ch.failText || 'Not found!';
          detail='<span class="dc-det dc-no">'+ft+'</span>';
          reportLine='  [FAIL]['+mb.label+'] '+ch.name+' — '+ft;
        }

        catReport+=reportLine+'\n';
        rows+='<div class="dc-row"><span class="dc-icon '+cls+'">'+icon+'</span>'
          +'<div class="dc-txt"><div class="dc-name">'+ch.name+' <span class="dc-meta '+mb.cls+'">'+mb.label+'</span></div>'
          +'<div class="dc-desc">'+ch.desc+'</div>'+detail+'</div></div>';
      });

      var badge,bcls;
      if(cf>0){badge=cf+' FAIL';bcls='dc-bfail';}
      else if(cw>0){badge=cw+' WARN';bcls='dc-bwarn';}
      else if(cn>0){badge=cn+' N/V';bcls='dc-bnv';}
      else{badge='OK';bcls='dc-bpass';}

      report+=catReport+'\n';

      var open=cf>0||cw>0||cn>0;
      html+='<div class="dc-sec">'
        +'<div class="dc-sh'+(open?' dc-open':'')+'" onclick="this.classList.toggle(\'dc-open\');this.nextElementSibling.classList.toggle(\'dc-open\')">'
        +'<span class="dc-arr">\u25B6</span>'
        +'<span class="dc-si">'+cat.icon+'</span>'
        +'<span class="dc-st">'+cat.title+'</span>'
        +'<span class="dc-badge '+bcls+'">'+badge+'</span>'
        +'<span class="dc-cnt">'+cp+'/'+cat.checks.length+'</span>'
        +'</div>'
        +'<div class="dc-sb'+(open?' dc-open':'')+'">'+rows+'</div>'
        +'</div>';
    });

    // NOT VERIFIED is excluded from the quality score because it is an
    // observation-coverage state, not a positive or negative verdict.
    var scoredTotal=pass+fail+warn;
    var allTotal=scoredTotal+notVerified;
    var pct=scoredTotal>0?Math.round(pass/scoredTotal*100):0;
    var coverage=allTotal>0?Math.round(scoredTotal/allTotal*100):0;
    var fillCls=pct>=90?'dc-fp':(pct>=70?'dc-fw':'dc-ff');

    report+='================================\n';
    report+='TOTAL: '+pass+' pass, '+fail+' fail, '+warn+' warn, '+notVerified+' not verified ('+pct+'% score; '+coverage+'% automated coverage)\n';
    if(fail===0)report+='NO HARD FAILURES DETECTED — WARN = detected risk; NOT VERIFIED = insufficient automatic evidence\n';
    else report+='HARD FAILURES TO REVIEW: '+fail+'\n';
    _lastReport=report;

    var summary='<div class="dc-sum">'
      +'<div class="dc-sc dc-sg"><div class="dc-sn">'+pass+'</div><div class="dc-sl">PASS</div></div>'
      +'<div class="dc-sc dc-sr"><div class="dc-sn">'+fail+'</div><div class="dc-sl">FAIL</div></div>'
      +'<div class="dc-sc dc-sy"><div class="dc-sn">'+warn+'</div><div class="dc-sl">WARN</div></div>'
      +'<div class="dc-sc dc-su"><div class="dc-sn">'+notVerified+'</div><div class="dc-sl">N/V</div></div>'
      +'<div class="dc-sc dc-sb2"><div class="dc-sn">'+pct+'%</div><div class="dc-sl">SCORE</div></div>'
      +'</div>'
      +'<div class="dc-bar"><div class="dc-fill '+fillCls+'" style="width:'+pct+'%"></div></div>'
      +'<div class="dc-msg">'+(fail===0?'No hard failures. WARN = risk; N/V = not automatically proven. Coverage '+coverage+'%':'\u274C '+fail+' hard failure(s) to review')+'</div>';

    var body=_panel.querySelector('.dc-body');
    body.innerHTML=buildPublicNotice()+summary+html+buildTimingLog();
  });
}

// ── Event Timeline ─────────────────────────────────────────────
function buildTimingLog(){
  var events=TIMING.log.map(function(e){
    var ms=Math.round(e.delta);
    var color=e.warning?'#ed1b35':'#44b85c';
    return '<div style="font-size:10px;color:'+color+';font-family:monospace">+'+ms+'ms '+e.event+(e.warning?' \u26A0\uFE0F '+e.warning:'')+'</div>';
  }).join('');
  // ВЕРДИКТ ПО ПОРЯДКУ (v2.21): панель знала ожидаемый порядок, но не проверяла его.
  var verdicts=[], bad=false;
  function vd(ok,txt){ verdicts.push('<div style="font-size:10px;font-family:monospace;color:'+(ok?'#44b85c':'#ed1b35')+'">'+(ok?'\u2713 ':'\u2717 ')+txt+'</div>'); if(!ok)bad=true; }
  function vw(txt){ verdicts.push('<div style="font-size:10px;font-family:monospace;color:#f5a623">\u26A0 '+txt+'</div>'); }
  if(TIMING.firstUserClick&&TIMING.gameReady){
    if(TIMING.firstUserClick>TIMING.gameReady)vd(true,'page input after ready() (REQ-1.19): input '+Math.round(TIMING.firstUserClick)+'ms, ready '+Math.round(TIMING.gameReady)+'ms');
    else vw('page input observed before ready(): input '+Math.round(TIMING.firstUserClick)+'ms, ready '+Math.round(TIMING.gameReady)+'ms — verify the game ignored/gated it; document input alone is not proof of playability');
  }
  if(TIMING.langDetected&&TIMING.firstUserClick)
    vd(TIMING.langDetected<TIMING.firstUserClick,'язык до первого ввода (REQ-2.14): язык '+Math.round(TIMING.langDetected)+'ms, клик '+Math.round(TIMING.firstUserClick)+'ms');
  if(TIMING.langDetected&&TIMING.gameReady)
    vd(TIMING.langDetected<TIMING.gameReady,'язык до ready(): язык '+Math.round(TIMING.langDetected)+'ms, ready '+Math.round(TIMING.gameReady)+'ms');
  if(TIMING.gameReady&&TIMING.sdkInit)
    vd(TIMING.gameReady>TIMING.sdkInit,'ready() после init SDK');
  var verdictHtml = verdicts.length ? '<div style="margin-top:8px;padding-top:6px;border-top:1px solid #333">'+verdicts.join('')+'</div>' : '';
  return '<div class="dc-sec"><div class="dc-sh" onclick="this.classList.toggle(\'dc-open\');this.nextElementSibling.classList.toggle(\'dc-open\')">'
    +'<span class="dc-arr">\u25B6</span><span class="dc-si">\u{1F4CA}</span>'
    +'<span class="dc-st">Event Timeline</span>'
    +'<span class="dc-badge '+(bad?'dc-bfail':(verdicts.length?'dc-bpass':'dc-bwarn'))+'">'+(bad?'ORDER FAIL':(verdicts.length?'ORDER OK':'LOG'))+'</span></div>'
    +'<div class="dc-sb" style="padding:8px 12px;max-height:200px;overflow-y:auto">'
    +(events||'<div style="color:#666;font-size:11px">No events yet \u2014 interact with game, then re-check</div>')
    +verdictHtml
    +'<div style="margin-top:8px;font-size:10px;color:#666">Expected: domReady \u2192 fontsLoaded \u2192 firstPaint \u2192 langDetected \u2192 gameReady \u2192 firstUserClick \u2192 gameplayStart</div>'
    +'</div></div>';
}

// ── Copy report to clipboard ────────────────────────────────────
function copyReport(){
  if(!_lastReport){return;}
  var copyBtn=_panel.querySelector('.dc-copy');
  if(navigator.clipboard&&navigator.clipboard.writeText){
    navigator.clipboard.writeText(_lastReport).then(function(){
      if(copyBtn){copyBtn.textContent='\u2705';setTimeout(function(){copyBtn.textContent='\u{1F4CB}';},1500);}
    }).catch(function(){fallbackCopy();});
  }else{fallbackCopy();}

  function fallbackCopy(){
    var ta=document.createElement('textarea');
    ta.value=_lastReport;
    ta.style.cssText='position:fixed;left:-9999px;';
    document.body.appendChild(ta);
    ta.select();
    try{document.execCommand('copy');
      if(copyBtn){copyBtn.textContent='\u2705';setTimeout(function(){copyBtn.textContent='\u{1F4CB}';},1500);}
    }catch(e){}
    document.body.removeChild(ta);
  }
}

// ── Create Panel UI ─────────────────────────────────────────────
function createPanel(){
  var style=document.createElement('style');
  style.textContent=`
    .dc-overlay{position:fixed;top:0;left:0;width:100%;height:100%;z-index:999999;display:flex;pointer-events:none;}
    .dc-panel{position:absolute;top:10px;right:10px;width:380px;height:calc(100vh - 20px);background:#0f0f1a;border:2px solid #f5a623;border-radius:12px;overflow:hidden;display:flex;flex-direction:column;pointer-events:auto;font-family:'Segoe UI',system-ui,sans-serif;font-size:13px;color:#e0e0e0;box-shadow:0 8px 32px rgba(0,0,0,.6);resize:vertical;}
    .dc-head{padding:12px 16px;background:linear-gradient(135deg,#1a1a2e,#16213e);border-bottom:2px solid #f5a623;display:flex;align-items:center;gap:10px;cursor:move;user-select:none;}
    .dc-head h2{margin:0;font-size:15px;color:#f5a623;flex:1;}
    .dc-hico{font-size:22px;}
    .dc-close{background:none;border:none;color:#888;font-size:20px;cursor:pointer;padding:0 4px;line-height:1;}
    .dc-close:hover{color:#f55;}
    .dc-hbtn{background:none;border:none;color:#888;font-size:16px;cursor:pointer;padding:0 4px;}
    .dc-hbtn:hover{color:#f5a623;}
    .dc-body{overflow-y:auto;padding:12px;flex:1;}
    .dc-sum{display:flex;gap:8px;margin-bottom:12px;}
    .dc-sc{flex:1;padding:10px 6px;border-radius:8px;text-align:center;}
    .dc-sg{background:#0d2818;border:1px solid #44b85c;}
    .dc-sr{background:#2d0a0a;border:1px solid #ed1b35;}
    .dc-sy{background:#2d2200;border:1px solid #f5a623;}
    .dc-su{background:#151b27;border:1px solid #718096;}
    .dc-sb2{background:#0a1a2d;border:1px solid #3b82f6;}
    .dc-sn{font-size:22px;font-weight:700;}
    .dc-sg .dc-sn{color:#44b85c;}
    .dc-sr .dc-sn{color:#ed1b35;}
    .dc-sy .dc-sn{color:#f5a623;}
    .dc-su .dc-sn{color:#9fb3c8;}
    .dc-sb2 .dc-sn{color:#3b82f6;}
    .dc-sl{font-size:10px;color:#888;margin-top:2px;}
    .dc-bar{width:100%;height:4px;background:#222;border-radius:2px;margin-bottom:6px;overflow:hidden;}
    .dc-fill{height:100%;border-radius:2px;transition:width .5s;}
    .dc-fp{background:#44b85c;}.dc-fw{background:#f5a623;}.dc-ff{background:#ed1b35;}
    .dc-msg{text-align:center;font-size:11px;color:#888;margin-bottom:14px;}
    .dc-sec{margin-bottom:8px;border:1px solid #222;border-radius:8px;overflow:hidden;}
    .dc-sh{padding:10px 12px;background:#16162a;cursor:pointer;display:flex;align-items:center;gap:8px;user-select:none;}
    .dc-sh:hover{background:#1a1a35;}
    .dc-arr{font-size:10px;color:#666;transition:transform .2s;}
    .dc-sh.dc-open .dc-arr{transform:rotate(90deg);}
    .dc-si{font-size:15px;}
    .dc-st{flex:1;font-weight:600;font-size:13px;}
    .dc-badge{padding:2px 8px;border-radius:10px;font-size:10px;font-weight:600;}
    .dc-bpass{background:#143d22;color:#44b85c;}
    .dc-bfail{background:#3d1414;color:#ed1b35;}
    .dc-bwarn{background:#3d3000;color:#f5a623;}
    .dc-bnv{background:#1d2735;color:#9fb3c8;}
    .dc-cnt{color:#555;font-size:11px;}
    .dc-sb{display:none;padding:2px 0;}
    .dc-sb.dc-open{display:block;}
    .dc-row{padding:7px 12px;display:flex;align-items:flex-start;gap:8px;border-top:1px solid #1a1a2e;}
    .dc-row:first-child{border-top:none;}
    .dc-icon{font-size:14px;min-width:18px;text-align:center;padding-top:1px;}
    .dc-icon.dc-pass{color:#44b85c;}
    .dc-icon.dc-fail{color:#ed1b35;}
    .dc-icon.dc-warn{color:#f5a623;}
    .dc-icon.dc-nv{color:#9fb3c8;font-weight:700;}
    .dc-txt{flex:1;}
    .dc-name{font-size:12px;color:#ccc;}
    .dc-desc{font-size:10px;color:#666;margin-top:1px;}
    .dc-det{font-size:10px;display:block;margin-top:2px;font-family:'Cascadia Code','Fira Code',monospace;}
    .dc-ok{color:#44b85c;}
    .dc-no{color:#ed1b35;}
    .dc-wr{color:#f5a623;}
    .dc-nvdet{color:#9fb3c8;}
    .dc-notice{padding:9px 10px;margin-bottom:12px;border:1px solid #34506e;background:#0d1b2a;border-radius:8px;color:#b7c9da;font-size:10px;line-height:1.4;}
    .dc-meta{display:inline-block;margin-left:5px;padding:1px 5px;border-radius:8px;font-size:8px;font-weight:700;vertical-align:1px;}
    .dc-meta-req{background:#102c45;color:#77bdf2}.dc-meta-rec{background:#3d3000;color:#f5cf85}.dc-meta-heu{background:#252535;color:#999}
  `;
  document.head.appendChild(style);

  _panel=document.createElement('div');
  _panel.className='dc-overlay';
  _panel.innerHTML='<div class="dc-panel">'
    +'<div class="dc-head">'
    +'<span class="dc-hico">\u{1F3AE}</span>'
    +'<h2>Yandex Games Debug Checker v1.1.1</h2>'
    +'<button class="dc-hbtn dc-copy" title="Copy report">\u{1F4CB}</button>'
    +'<button class="dc-hbtn dc-refresh" title="Re-check">\u{1F504}</button>'
    +'<button class="dc-close" title="Close">\u2715</button>'
    +'</div>'
    +'<div class="dc-body"><div style="text-align:center;padding:30px;color:#888;">\u{1F50D} Analyzing...</div></div>'
    +'</div>';

  document.body.appendChild(_panel);

  _panel.querySelector('.dc-close').onclick=function(){_visible=false;_panel.style.display='none';};
  _panel.querySelector('.dc-refresh').onclick=function(){runChecks();};
  _panel.querySelector('.dc-copy').onclick=function(){copyReport();};

  // Draggable
  var head=_panel.querySelector('.dc-head');
  var panel=_panel.querySelector('.dc-panel');
  var dx=0,dy=0,dragging=false;
  head.onmousedown=function(e){
    if(e.target.tagName==='BUTTON')return;
    dragging=true;
    dx=e.clientX-panel.offsetLeft;
    dy=e.clientY-panel.offsetTop;
    e.preventDefault();
  };
  document.addEventListener('mousemove',function(e){
    if(!dragging)return;
    panel.style.left=(e.clientX-dx)+'px';
    panel.style.top=(e.clientY-dy)+'px';
    panel.style.right='auto';
  });
  document.addEventListener('mouseup',function(){dragging=false;});
}

})();
// === DEBUGCHECK_SELF_END === (do not remove)
