#!/usr/bin/env node
// Quick duplicate key scanner for JSON files.
// Walks the JSON text and reports duplicate keys within the same object path.

import fs from 'node:fs';

function scanDuplicates(text) {
  const duplicates = new Map(); // path -> key -> positions

  // Precompute line starts for line/col mapping
  const lineStarts = [0];
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '\n') lineStarts.push(i + 1);
  }
  const posToLineCol = (pos) => {
    // binary search lineStarts
    let lo = 0, hi = lineStarts.length - 1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (lineStarts[mid] <= pos) lo = mid + 1; else hi = mid - 1;
    }
    const line = hi + 1; // 1-based
    const col = pos - lineStarts[hi] + 1; // 1-based
    return { line, col };
  };

  const stack = []; // {type: 'object'|'array', path: string[]}
  const currentPath = [];
  let inString = false;
  let escape = false;
  let lastString = null;
  let lastStringEnd = -1;
  let pendingKeyForContainer = null; // when seeing { or [ after a key

  const ensurePathEntry = () => {
    const pathKey = currentPath.join('.') || '$';
    if (!duplicates.has(pathKey)) duplicates.set(pathKey, new Map());
    return duplicates.get(pathKey);
  };

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (inString) {
      if (escape) {
        escape = false;
      } else if (ch === '\\') {
        escape = true;
      } else if (ch === '"') {
        // end of string
        inString = false;
        lastStringEnd = i;
      }
      continue;
    }

    if (ch === '"') {
      // start string
      inString = true;
      // capture string literal
      let j = i + 1, s = '';
      let esc = false;
      while (j < text.length) {
        const cj = text[j++];
        if (esc) { s += cj; esc = false; continue; }
        if (cj === '\\') { esc = true; continue; }
        if (cj === '"') break;
        s += cj;
      }
      lastString = s;
      // Peek ahead to see if this is a key
      let k = j; // position after closing quote
      while (k < text.length && /\s/.test(text[k])) k++;
      if (text[k] === ':') {
        // This is a key in the current object
        const map = ensurePathEntry();
        if (!map.has(lastString)) map.set(lastString, []);
        map.get(lastString).push(posToLineCol(i));
        // Remember for container push if next token is { or [
        pendingKeyForContainer = lastString;
      }
      // advance i to just before k-1; main loop will increment
      i = j - 1;
      continue;
    }

    if (ch === '{') {
      // entering object
      if (pendingKeyForContainer) {
        currentPath.push(pendingKeyForContainer);
        pendingKeyForContainer = null;
      }
      stack.push({ type: 'object' });
      continue;
    }

    if (ch === '}') {
      // exiting object
      const ctx = stack.pop();
      if (ctx && currentPath.length > 0) {
        currentPath.pop();
      }
      pendingKeyForContainer = null;
      continue;
    }

    if (ch === '[') {
      if (pendingKeyForContainer) {
        currentPath.push(pendingKeyForContainer);
        pendingKeyForContainer = null;
      }
      stack.push({ type: 'array' });
      continue;
    }

    if (ch === ']') {
      stack.pop();
      if (currentPath.length > 0) currentPath.pop();
      pendingKeyForContainer = null;
      continue;
    }

    if (ch === ',') {
      // reset pending key between pairs
      pendingKeyForContainer = null;
      continue;
    }
  }

  // Build a flattened report of duplicates (count > 1)
  const report = [];
  for (const [path, keyMap] of duplicates) {
    for (const [key, positions] of keyMap) {
      if (positions.length > 1) {
        report.push({ path, key, count: positions.length, positions });
      }
    }
  }
  return report;
}

function main() {
  const files = process.argv.slice(2);
  if (files.length === 0) {
    console.error('Usage: find-duplicate-keys.mjs <file1.json> [file2.json ...]');
    process.exit(1);
  }
  for (const file of files) {
    const text = fs.readFileSync(file, 'utf8');
    const report = scanDuplicates(text);
    console.log(`# File: ${file}`);
    if (report.length === 0) {
      console.log('No duplicate keys found.');
    } else {
      for (const r of report) {
        const posStr = r.positions.map(p => `${p.line}:${p.col}`).join(', ');
        console.log(`Duplicate key at ${r.path}: "${r.key}" (${r.count}x) [${posStr}]`);
      }
    }
    console.log('');
  }
}

main();

