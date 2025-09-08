import fs from "node:fs";
import path from "node:path";

const root = path.resolve("web");
const messagesDir = path.join(root, "messages");

function deepMerge(target, source) {
  for (const k of Object.keys(source)) {
    const v = source[k];
    if (v && typeof v === "object" && !Array.isArray(v)) {
      if (!target[k] || typeof target[k] !== "object") target[k] = {};
      deepMerge(target[k], v);
    } else {
      target[k] = v;
    }
  }
  return target;
}

function flatten(obj, prefix = "") {
  const res = {};
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) {
      Object.assign(res, flatten(v, key));
    } else {
      res[key] = v;
    }
  }
  return res;
}

// Effective EN
let enObj = JSON.parse(fs.readFileSync(path.join(messagesDir, "en.json"), "utf8"));
const enOvPath = path.join(messagesDir, "en-overrides.json");
if (fs.existsSync(enOvPath)) {
  const enov = JSON.parse(fs.readFileSync(enOvPath, "utf8"));
  enObj = deepMerge(enObj, enov);
}

// Effective ES (EN fallback + ES + overrides)
let esObj = JSON.parse(fs.readFileSync(path.join(messagesDir, "es.json"), "utf8"));
let esEffective = JSON.parse(JSON.stringify(enObj));
esEffective = deepMerge(esEffective, esObj);
const esOvPath = path.join(messagesDir, "es-overrides.json");
if (fs.existsSync(esOvPath)) {
  const esov = JSON.parse(fs.readFileSync(esOvPath, "utf8"));
  esEffective = deepMerge(esEffective, esov);
}

const enF = flatten(enObj);
const esF = flatten(esEffective);
const used = JSON.parse(fs.readFileSync(path.join(root, "scripts", "used-keys.json"), "utf8"));
const missingEn = used.filter((k) => !(k in enF));
const missingEs = used.filter((k) => !(k in esF));
console.log(JSON.stringify({ missingEn, missingEs, countEn: missingEn.length, countEs: missingEs.length }, null, 2));
