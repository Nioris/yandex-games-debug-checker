#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

function parseArgs(argv){
  const out={
    source:path.resolve('debugcheck-v1.2.7-test.js'),
    output:path.resolve('debugcheck-v1.2.8-test.js'),
    selfTest:false
  };
  for(let i=0;i<argv.length;i++){
    const a=argv[i];
    const next=()=>{
      if(i+1>=argv.length) throw new Error(`Missing value after ${a}`);
      return argv[++i];
    };
    if(a==='--source') out.source=path.resolve(next());
    else if(a==='--out') out.output=path.resolve(next());
    else if(a==='--self-test') out.selfTest=true;
    else if(a==='--help'||a==='-h'){
      console.log('Upgrade debugcheck v1.2.7-test -> v1.2.8-test: never claim SDK → ready → gameplay unless GameplayAPI.start is actually observed.');
      process.exit(0);
    } else throw new Error(`Unknown argument: ${a}`);
  }
  return out;
}

function patchSource(input){
  let s=String(input||'');
  const applied=[];

  function one(oldText,newText,name){
    const count=s.split(oldText).length-1;
    if(count!==1){
      throw new Error(`Patch anchor "${name}" expected once, found ${count}. Refusing to guess.`);
    }
    s=s.replace(oldText,newText);
    applied.push(name);
  }

  if(!/version:'1\.2\.7-test'/.test(s)){
    throw new Error('Input is not the expected v1.2.7-test candidate.');
  }

  one(
    'Yandex Games Debug Checker — experimental candidate v1.2.7-test',
    'Yandex Games Debug Checker — experimental candidate v1.2.8-test',
    'header-version'
  );
  one("version:'1.2.7-test'","version:'1.2.8-test'",'api-version');
  one(
    '<h2>Yandex Games Debug Checker v1.2.7-test</h2>',
    '<h2>Yandex Games Debug Checker v1.2.8-test</h2>',
    'panel-version'
  );

  // The old implementation returned PASS as soon as ready() existed and the
  // obvious early/late errors were absent. That produced the false statement
  // "SDK init → ready() → gameplay" even when gameplayStart === 0.
  one(
`    {name:'GameReady timing (п.1.19)',desc:'LoadingAPI.ready() called AFTER full load, not in SDK init',
      test:function(s){
        if(TIMING.gameReady){
          if(TIMING.sdkInit&&TIMING.gameReady<TIMING.sdkInit)return {pass:false,details:'Runtime: ready() happened before SDK init'};
          if(TIMING.fontsLoaded&&TIMING.gameReady<TIMING.fontsLoaded-50)return {pass:'warn',details:'Runtime: ready() occurred before fonts/content finished'};
          if(TIMING.gameplayStart&&TIMING.gameReady>TIMING.gameplayStart+1000)return {pass:'warn',details:'Runtime: ready() occurred >1s after gameplay start'};
          return {pass:true,details:'Runtime order confirmed: SDK init → ready() → gameplay'};
        }
        if(!pat(s,/LoadingAPI[\\s\\S]{0,4}ready/))return {pass:'not_verified',details:'Static ready() call not visible; waiting for runtime evidence'};`,
`    {name:'GameReady timing (п.1.19)',desc:'LoadingAPI.ready() called AFTER full load, not in SDK init',
      test:function(s){
        if(TIMING.gameReady){
          if(TIMING.sdkInit&&TIMING.gameReady<TIMING.sdkInit){
            return {pass:false,details:'Runtime: ready() happened before SDK init'};
          }
          if(TIMING.fontsLoaded&&TIMING.gameReady<TIMING.fontsLoaded-50){
            return {pass:'warn',details:'Runtime: ready() occurred before fonts/content finished'};
          }

          if(TIMING.gameplayStart){
            if(TIMING.gameReady>TIMING.gameplayStart+1000){
              return {pass:'warn',details:'Runtime: ready() occurred >1s after GameplayAPI.start()'};
            }
            if(TIMING.gameReady>TIMING.gameplayStart){
              return {pass:false,details:'Runtime: GameplayAPI.start() happened BEFORE LoadingAPI.ready()'};
            }
            return {pass:true,details:'Runtime order confirmed: SDK init → ready() → GameplayAPI.start()'};
          }

          // Important: stop-only evidence is NOT proof that start() happened.
          // Platform-generated stop events may appear because of ads/visibility.
          if(TIMING.gameplayStop){
            return {
              pass:'not_verified',
              details:'LoadingAPI.ready() is confirmed, but GameplayAPI.start() was NOT observed. GameplayAPI.stop() was observed without start; do not claim the full SDK → ready → gameplay order.'
            };
          }

          return {
            pass:'not_verified',
            details:'LoadingAPI.ready() is confirmed, but GameplayAPI.start() has not been observed in this session. Full lifecycle order is not verified.'
          };
        }
        if(!pat(s,/LoadingAPI[\\s\\S]{0,4}ready/))return {pass:'not_verified',details:'Static ready() call not visible; waiting for runtime evidence'};`,
    'game-ready-requires-gameplay-start'
  );

  one(
    "window.YGDebugChecker.build='experimental-v1.2.7-git-candidate';",
    "window.YGDebugChecker.build='experimental-v1.2.8-lifecycle-evidence';",
    'build-marker'
  );

  return {source:s,applied};
}

function syntaxCheck(file){
  const r=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});
  if(r.status!==0) throw new Error(`node --check failed:\n${r.stdout||''}\n${r.stderr||''}`);
}

function selfTest(){
  const sample=`Yandex Games Debug Checker — experimental candidate v1.2.7-test
window.YGDebugChecker={version:'1.2.7-test'};
<h2>Yandex Games Debug Checker v1.2.7-test</h2>
    {name:'GameReady timing (п.1.19)',desc:'LoadingAPI.ready() called AFTER full load, not in SDK init',
      test:function(s){
        if(TIMING.gameReady){
          if(TIMING.sdkInit&&TIMING.gameReady<TIMING.sdkInit)return {pass:false,details:'Runtime: ready() happened before SDK init'};
          if(TIMING.fontsLoaded&&TIMING.gameReady<TIMING.fontsLoaded-50)return {pass:'warn',details:'Runtime: ready() occurred before fonts/content finished'};
          if(TIMING.gameplayStart&&TIMING.gameReady>TIMING.gameplayStart+1000)return {pass:'warn',details:'Runtime: ready() occurred >1s after gameplay start'};
          return {pass:true,details:'Runtime order confirmed: SDK init → ready() → gameplay'};
        }
        if(!pat(s,/LoadingAPI[\\s\\S]{0,4}ready/))return {pass:'not_verified',details:'Static ready() call not visible; waiting for runtime evidence'};
window.YGDebugChecker.build='experimental-v1.2.7-git-candidate';`;

  const r=patchSource(sample);

  const must=[
    "version:'1.2.8-test'",
    "if(TIMING.gameplayStart){",
    "GameplayAPI.start() was NOT observed",
    "GameplayAPI.stop() was observed without start",
    "Full lifecycle order is not verified",
    "Runtime order confirmed: SDK init → ready() → GameplayAPI.start()",
    "build='experimental-v1.2.8-lifecycle-evidence'"
  ];
  must.forEach(x=>{
    if(!r.source.includes(x)) throw new Error('self-test missing '+x);
  });

  // Guard against the exact false-positive string we are fixing.
  if(r.source.includes("return {pass:true,details:'Runtime order confirmed: SDK init → ready() → gameplay'}")){
    throw new Error('old unconditional lifecycle PASS is still present');
  }

  console.log('[upgrader-1.2.8] self-test: PASS');
}

async function main(){
  const opts=parseArgs(process.argv.slice(2));
  if(opts.selfTest)return selfTest();

  const input=await fs.readFile(opts.source,'utf8');
  const r=patchSource(input);
  await fs.writeFile(opts.output,r.source,'utf8');
  syntaxCheck(opts.output);

  await fs.writeFile(opts.output+'.meta.json',JSON.stringify({
    from:'1.2.7-test',
    to:'1.2.8-test',
    source:opts.source,
    output:opts.output,
    patches:r.applied
  },null,2),'utf8');

  console.log(`[upgrader-1.2.8] output: ${opts.output}`);
  console.log(`[upgrader-1.2.8] patches: ${r.applied.join(', ')}`);
  console.log('[upgrader-1.2.8] node --check: PASS');
  console.log('[upgrader-1.2.8] UPGRADE OK');
}

main().catch(e=>{
  console.error(`\n[upgrader-1.2.8] ERROR: ${e.message}`);
  process.exitCode=1;
});
