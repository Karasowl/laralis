import fs from 'node:fs';
import path from 'node:path';

// Collect all i18n keys used across the web app by detecting variables
// assigned from useTranslations()/useT() and tracking their calls.
// Writes the deduplicated, sorted list to scripts/used-keys.json.

// When running via `npm -C web run ...`, CWD is already `web`.
const root = process.cwd();
const includeRoots = ['app', 'components', 'hooks', 'contexts', 'lib'];
const excludeDirs = new Set(['node_modules', 'tests', 'scripts', 'cypress', '.next', 'dist', 'coverage']);

const files = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (excludeDirs.has(entry.name)) continue;
      walk(path.join(dir, entry.name));
      continue;
    }
    if (!entry.name.match(/\.(tsx?|jsx?)$/)) continue;
    files.push(path.join(dir, entry.name));
  }
}
for (const r of includeRoots) {
  const p = path.join(root, r);
  if (fs.existsSync(p)) walk(p);
}

// Regexes:
// - translator declarations: const <name> = useTranslations('ns?') | useT('ns?')
const declRegex = /\bconst\s+([a-zA-Z_][\w]*)\s*=\s*(useTranslations|useT)\(\s*(?:['\"]([a-zA-Z0-9_.-]*)['\"])?\s*\)/g;
// - subsequent calls: <name>('key')
function buildCallRegex(varName) {
  // Use a dynamic RegExp per variable, matching string literal keys only
  return new RegExp(String.raw`\b${varName}\(\s*['\"]([a-zA-Z0-9_.-]+)['\"]`, 'g');
}

const keys = new Set();

for (const f of files) {
  const src = fs.readFileSync(f, 'utf8');

  // Gather translator variables declared in this file
  const translators = []; // { name, ns }
  let m;
  while ((m = declRegex.exec(src))) {
    const name = m[1];
    const ns = m[3] || '';
    translators.push({ name, ns });
  }

  if (translators.length === 0) {
    continue;
  }

  // For each translator variable, collect calls
  for (const tr of translators) {
    const callRe = buildCallRegex(tr.name);
    let cm;
    while ((cm = callRe.exec(src))) {
      const raw = cm[1];
      const qualified = tr.ns ? `${tr.ns}.${raw}` : raw;
      keys.add(qualified);
    }
  }
}

const out = Array.from(keys).sort();
const outPath = path.join(root, 'scripts', 'used-keys.json');
try {
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2) + '\n', 'utf8');
  console.log(`[i18n] Collected ${out.length} keys -> ${path.relative(process.cwd(), outPath)}`);
} catch (err) {
  console.log(JSON.stringify(out, null, 2));
}
