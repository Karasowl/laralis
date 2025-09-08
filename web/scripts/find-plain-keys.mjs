import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve('web');
const includeRoots = ['app','components','hooks','contexts','lib'];
const exclude = new Set(['node_modules','tests','scripts','cypress','.next','dist','coverage']);
const files = [];
function walk(dir){
  for (const e of fs.readdirSync(dir,{withFileTypes:true})){
    if (e.isDirectory()) { if (exclude.has(e.name)) continue; walk(path.join(dir, e.name)); continue; }
    if (!e.name.match(/\.(tsx?|jsx?)$/)) continue;
    files.push(path.join(dir, e.name));
  }
}
for (const r of includeRoots){ const p=path.join(root,r); if (fs.existsSync(p)) walk(p); }

const targets = ['treatments','expenses','settings'];
const results = [];
for (const f of files){
  const src = fs.readFileSync(f,'utf8').split(/\r?\n/);
  for (let i=0;i<src.length;i++){
    const line = src[i];
    for (const key of targets){
      if (line.match(new RegExp(String.raw`\bt\(\s*['\"]${key}['\"]\s*\)`))){
        results.push({ file: f, line: i+1, key, snippet: line.trim().slice(0,200) });
      }
    }
  }
}
console.log(JSON.stringify(results, null, 2));

