import fs from 'node:fs';
import path from 'node:path';

// Support running from repo root or from web folder
let messagesDir = path.resolve(process.cwd(), 'messages');
if (!fs.existsSync(messagesDir)) {
  messagesDir = path.resolve(process.cwd(), 'web', 'messages');
}
const enPath = path.join(messagesDir, 'en.json');
const enOverridesPath = path.join(messagesDir, 'en-overrides.json');
const esPath = path.join(messagesDir, 'es.json');
const esOverridesPath = path.join(messagesDir, 'es-overrides.json');

const loadJSON = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const saveJSON = (p, obj) => fs.writeFileSync(p, JSON.stringify(obj, null, 2) + '\n');

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

function setByPath(obj, dotted, value) {
  const parts = dotted.split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i];
    if (!cur[p] || typeof cur[p] !== 'object' || Array.isArray(cur[p])) cur[p] = {};
    cur = cur[p];
  }
  cur[parts[parts.length - 1]] = value;
}

// Compose effective EN
let enBase = loadJSON(enPath);
let enOverrides = fs.existsSync(enOverridesPath) ? loadJSON(enOverridesPath) : {};
const enEffective = deepMerge(JSON.parse(JSON.stringify(enBase)), enOverrides);

// Compose effective ES (fallback to EN then merge ES + overrides to mirror runtime)
let esBase = loadJSON(esPath);
let esOverrides = fs.existsSync(esOverridesPath) ? loadJSON(esOverridesPath) : {};
const esEffective = deepMerge(deepMerge(JSON.parse(JSON.stringify(enBase)), esBase), esOverrides);

const enFlat = flatten(enEffective);
const esFlat = flatten(esEffective);

const missingInEn = Object.keys(esFlat).filter((k) => !(k in enFlat));

if (!missingInEn.length) {
  console.log('No missing keys in EN. Nothing to do.');
  process.exit(0);
}

let added = 0;
for (const key of missingInEn) {
  const val = esFlat[key];
  // Only add primitive values. If undefined/null, skip.
  if (val === undefined) continue;
  setByPath(enOverrides, key, val);
  added++;
}

saveJSON(enOverridesPath, enOverrides);
console.log(`Added ${added} missing keys to en-overrides.json`);
