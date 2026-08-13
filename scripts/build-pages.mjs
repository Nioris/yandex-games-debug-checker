import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, '_site');
fs.rmSync(out, {recursive:true, force:true});
fs.mkdirSync(out, {recursive:true});

function copy(src, dst){
  fs.mkdirSync(path.dirname(dst), {recursive:true});
  fs.copyFileSync(src,dst);
}
function withAutoOpen(src, dst){
  let html=fs.readFileSync(src,'utf8');
  const auto=`<script>window.addEventListener('load',()=>setTimeout(()=>window.YGDebugChecker&&YGDebugChecker.open(),700));<\/script>`;
  html=html.replace('</body>',auto+'\n</body>');
  fs.mkdirSync(path.dirname(dst),{recursive:true});
  fs.writeFileSync(dst,html);
}

copy(path.join(root,'site','index.html'), path.join(out,'index.html'));
copy(path.join(root,'debugcheck.js'), path.join(out,'debugcheck.js'));
copy(path.join(root,'examples','orc-castle','mock-sdk.js'), path.join(out,'examples','orc-castle','mock-sdk.js'));
withAutoOpen(path.join(root,'examples','orc-castle','before','index.html'), path.join(out,'examples','orc-castle','before','index.html'));
withAutoOpen(path.join(root,'examples','orc-castle','after','index.mock.html'), path.join(out,'examples','orc-castle','after','index.html'));

console.log('pages-build: PASS —', out);
