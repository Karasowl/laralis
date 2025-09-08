import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve('web');
const messagesDir = path.join(root, 'messages');

function readJson(p){ return JSON.parse(fs.readFileSync(p,'utf8')); }
function writeJson(p, obj){ fs.writeFileSync(p, JSON.stringify(obj, null, 2)+'\n','utf8'); }

function deepMerge(t,s){ for(const k of Object.keys(s)){ const v=s[k]; if(v && typeof v==='object' && !Array.isArray(v)){ if(!t[k]||typeof t[k]!== 'object') t[k]={}; deepMerge(t[k],v); } else { t[k]=v; } } return t; }
function setPath(obj, keyPath, value){ const parts = keyPath.split('.'); let cur=obj; for(let i=0;i<parts.length-1;i++){ const k=parts[i]; if(!(k in cur) || typeof cur[k] !== 'object') cur[k] = {}; cur = cur[k]; } cur[parts[parts.length-1]] = value; }
function flatten(obj, prefix=''){ const res={}; for(const [k,v] of Object.entries(obj)){ const key = prefix? `${prefix}.${k}`:k; if(v && typeof v==='object' && !Array.isArray(v)){ Object.assign(res, flatten(v,key)); } else { res[key]=v; } } return res; }

// Load base and overrides
const enBase = readJson(path.join(messagesDir,'en.json'));
const esBase = readJson(path.join(messagesDir,'es.json'));
let enOv = fs.existsSync(path.join(messagesDir,'en-overrides.json')) ? readJson(path.join(messagesDir,'en-overrides.json')) : {};
let esOv = fs.existsSync(path.join(messagesDir,'es-overrides.json')) ? readJson(path.join(messagesDir,'es-overrides.json')) : {};

const enEff = deepMerge(JSON.parse(JSON.stringify(enBase)), enOv);
const esEff = deepMerge(deepMerge(JSON.parse(JSON.stringify(enBase)), esBase), esOv);

const used = readJson(path.join(root,'scripts','used-keys.json'));
const enFlat = flatten(enEff);
const esFlat = flatten(esEff);

const missingEn = used.filter(k => !(k in enFlat));
const missingEs = used.filter(k => !(k in esFlat));

function titleCase(s){ return s.replace(/[_-]+/g,' ').replace(/\b\w/g, c=>c.toUpperCase()); }
function wordsFromKey(k){ const last = k.split('.').pop() || k; const w = last.replace(/_/g,' ').replace(/([a-z])([A-Z])/g,'$1 $2'); return w.toLowerCase(); }
function guessEn(k){
  const last = k.split('.').pop() || k;
  if(last.startsWith('select_')){
    const w = last.replace('select_','').replace(/_/g,' ');
    return 'Select ' + titleCase(w);
  }
  const mapping = {
    title:'Title', subtitle:'Subtitle', description:'Description', submit:'Submit', cancel:'Cancel', edit:'Edit', delete:'Delete', save:'Save', retry:'Retry', today:'Today', refresh:'Refresh'
  };
  if(mapping[last]) return mapping[last];
  // generic
  return titleCase(last.replace(/_/g,' '));
}

function guessEs(k, enVal){
  const last = k.split('.').pop() || k;
  if(last.startsWith('select_')){
    const w = last.replace('select_','').replace(/_/g,' ');
    return 'Selecciona ' + w;
  }
  const map = { title:'Título', subtitle:'Subtítulo', description:'Descripción', submit:'Enviar', cancel:'Cancelar', edit:'Editar', delete:'Eliminar', save:'Guardar', retry:'Reintentar', today:'Hoy', refresh:'Actualizar' };
  if(map[last]) return map[last];
  return enVal; // fallback copy
}

// Autofill EN
for(const k of missingEn){
  const val = guessEn(k);
  setPath(enOv, k, val);
}
// Autofill ES for keys missing in ES (ensure Spanish has at least something)
for(const k of missingEs){
  const enVal = k in enFlat ? enFlat[k] : guessEn(k);
  const esVal = guessEs(k, enVal);
  setPath(esOv, k, esVal);
}

writeJson(path.join(messagesDir,'en-overrides.json'), enOv);
writeJson(path.join(messagesDir,'es-overrides.json'), esOv);

console.log('Autofill complete:', { addedEn: missingEn.length, addedEs: missingEs.length });
