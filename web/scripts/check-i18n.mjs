import fs from 'node:fs';
import path from 'node:path';

// When running via `npm -C web run ...`, process.cwd() is already the `web` folder.
// So resolve messages relative to CWD without prefixing another `web`.
const messagesDir = path.resolve(process.cwd(), 'messages');
const enPath = path.join(messagesDir, 'en.json');
const esPath = path.join(messagesDir, 'es.json');
const esOverridesPath = path.join(messagesDir, 'es-overrides.json');

function loadJSON(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function flatten(obj, prefix = '') {
  const res = {};
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      Object.assign(res, flatten(v, key));
    } else {
      res[key] = v;
    }
  }
  return res;
}

function diffKeys(base, other) {
  const missing = [];
  for (const key of Object.keys(base)) {
    if (!(key in other)) missing.push(key);
  }
  return missing.sort();
}

function deepMerge(target, source) {
  for (const [k, v] of Object.entries(source)) {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      if (!target[k] || typeof target[k] !== 'object') target[k] = {};
      deepMerge(target[k], v);
    } else {
      target[k] = v;
    }
  }
  return target;
}

let enObj = loadJSON(enPath);
const enOverridesPath = path.join(messagesDir, 'en-overrides.json');
if (fs.existsSync(enOverridesPath)) {
  try {
    const enOverrides = loadJSON(enOverridesPath);
    enObj = deepMerge(enObj, enOverrides);
  } catch {}
}
const en = flatten(enObj);
let esObj = loadJSON(esPath);
// Merge overrides for ES to match runtime behavior
if (fs.existsSync(esOverridesPath)) {
  try {
    const esOverrides = loadJSON(esOverridesPath);
    esObj = deepMerge(esObj, esOverrides);
  } catch {}
}
// Effective ES is EN fallback merged with ES + overrides
const esEffective = deepMerge(JSON.parse(JSON.stringify(enObj)), esObj);
const es = flatten(esEffective);

const missingInEn = diffKeys(es, en);
const missingInEs = diffKeys(en, es);

console.log('--- i18n check ---');
console.log(`en.json keys: ${Object.keys(en).length}`);
console.log(`es.json keys: ${Object.keys(es).length}`);
console.log('Missing in en.json:', missingInEn.length);
if (missingInEn.length) console.log(missingInEn.join('\n'));
console.log('Missing in es.json:', missingInEs.length);
if (missingInEs.length) console.log(missingInEs.join('\n'));
console.log('Done.');
