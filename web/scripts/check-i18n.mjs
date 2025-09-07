import fs from 'node:fs';
import path from 'node:path';

const messagesDir = path.resolve(process.cwd(), 'web', 'messages');
const enPath = path.join(messagesDir, 'en.json');
const esPath = path.join(messagesDir, 'es.json');

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

const en = flatten(loadJSON(enPath));
const es = flatten(loadJSON(esPath));

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

