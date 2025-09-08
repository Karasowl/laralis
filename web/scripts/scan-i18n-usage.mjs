import fs from 'node:fs';
import path from 'node:path';

// Scans code for i18n translator usage and reports:
// - Namespace misuse: calling t('ns.*') when t = useTranslations('ns')
// - Cross-namespace calls on namespaced translators
// - Missing keys (by comparing against effective EN/ES bundles)

// When running via `npm -C web run ...`, CWD is already `web`.
const root = process.cwd();
const includeRoots = ['app', 'components', 'hooks', 'contexts', 'lib'];
const exclude = new Set(['node_modules', 'tests', 'scripts', 'cypress', '.next', 'dist', 'coverage']);

function walkFiles() {
  const files = [];
  function walk(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.isDirectory()) {
        if (exclude.has(e.name)) continue;
        walk(path.join(dir, e.name));
        continue;
      }
      if (!e.name.match(/\.(tsx?|jsx?)$/)) continue;
      files.push(path.join(dir, e.name));
    }
  }
  for (const r of includeRoots) {
    const p = path.join(root, r);
    if (fs.existsSync(p)) walk(p);
  }
  return files;
}

function loadJSON(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function deepMerge(target, source) {
  for (const k of Object.keys(source)) {
    const v = source[k];
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

// Load messages to determine valid top-level namespaces and to check missing keys
const messagesDir = path.join(root, 'messages');
const enObj = loadJSON(path.join(messagesDir, 'en.json'));
let esObj = loadJSON(path.join(messagesDir, 'es.json'));
const esOverridesPath = path.join(messagesDir, 'es-overrides.json');
if (fs.existsSync(esOverridesPath)) {
  esObj = deepMerge(esObj, loadJSON(esOverridesPath));
}
const enTop = new Set(Object.keys(enObj));
const enFlat = flatten(enObj);
const esFlat = flatten(deepMerge(JSON.parse(JSON.stringify(enObj)), esObj));

// Parse files
const declRegex = /\bconst\s+([a-zA-Z_][\w]*)\s*=\s*(useTranslations|useT)\(\s*(?:['\"]([a-zA-Z0-9_.-]*)['\"])?\s*\)/g;
function buildCallRegex(varName) {
  return new RegExp(String.raw`\b${varName}\(\s*['\"]([a-zA-Z0-9_.-]+)['\"]`, 'g');
}

const files = walkFiles();
const namespaceMisuse = [];
const crossNamespace = [];
const used = new Set();

for (const f of files) {
  const src = fs.readFileSync(f, 'utf8');
  const lines = src.split(/\r?\n/);
  const translators = [];
  let m;
  while ((m = declRegex.exec(src))) {
    const name = m[1];
    const ns = m[3] || '';
    translators.push({ name, ns });
  }
  if (translators.length === 0) continue;

  for (const tr of translators) {
    const callRe = buildCallRegex(tr.name);
    let cm;
    while ((cm = callRe.exec(src))) {
      const raw = cm[1];
      const qualified = tr.ns ? `${tr.ns}.${raw}` : raw;
      used.add(qualified);

      // Determine line number for report
      const before = src.slice(0, cm.index);
      const lineNo = before.split(/\r?\n/).length;
      const line = lines[lineNo - 1]?.trim() || '';

      // Namespace duplication: tNs('ns.*')
      if (tr.ns && (raw === tr.ns || raw.startsWith(`${tr.ns}.`))) {
        namespaceMisuse.push({ file: path.relative(process.cwd(), f), line: lineNo, ns: tr.ns, raw, snippet: line });
      }

      // Cross-namespace usage on a namespaced translator: tX('otherNs.*')
      if (tr.ns && raw.includes('.')) {
        const top = raw.split('.')[0];
        if (top !== tr.ns && enTop.has(top)) {
          crossNamespace.push({ file: path.relative(process.cwd(), f), line: lineNo, ns: tr.ns, raw, snippet: line });
        }
      }
    }
  }
}

// Missing keys report based on used keys
const usedArr = Array.from(used).sort();
const missingEn = usedArr.filter((k) => !(k in enFlat));
const missingEs = usedArr.filter((k) => !(k in esFlat));

const out = {
  summary: {
    usedKeys: usedArr.length,
    namespaceMisuse: namespaceMisuse.length,
    crossNamespace: crossNamespace.length,
    missingEn: missingEn.length,
    missingEs: missingEs.length,
  },
  namespaceMisuse,
  crossNamespace,
  missing: { missingEn, missingEs },
};

console.log(JSON.stringify(out, null, 2));
