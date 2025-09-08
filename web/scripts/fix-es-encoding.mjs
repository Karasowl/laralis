import fs from 'node:fs';
import path from 'node:path';

// Fix common mojibake/replacement issues in Spanish message files caused by
// wrong encodings (e.g., � instead of á, é, í, ó, ú, ñ, or ¿).
// This script walks all string values and applies targeted replacements.

const messagesDir = fs.existsSync(path.resolve('messages'))
  ? path.resolve('messages')
  : path.resolve('web', 'messages');

const targets = [
  path.join(messagesDir, 'es.json'),
  path.join(messagesDir, 'es-overrides.json'),
].filter((p) => fs.existsSync(p));

if (targets.length === 0) {
  console.error('[i18n:fix-es] No Spanish message files found');
  process.exit(1);
}

// Order matters; run more specific patterns first.
const repl = [
  // Punctuation and leading inverted question mark
  [/^�(?=[A-Za-zÁÉÍÓÚÑáéíóú])/g, '¿'],
  [/([^\w])�(?=[A-Za-zÁÉÍÓÚÑáéíóú])/g, '$1¿'],

  // Very common words/suffixes with ó -> 'ción'
  [/ci�n/gi, 'ción'],
  [/aci�n/gi, 'ación'],
  [/eci�n/gi, 'eción'],
  [/ici�n/gi, 'ición'],
  [/oci�n/gi, 'oción'],
  [/uci�n/gi, 'ución'],

  // Common vocabulary in the app
  [/Configuraci�n/gi, 'Configuración'],
  [/Informaci�n/gi, 'Información'],
  [/acci�n/gi, 'acción'],
  [/opci�n/gi, 'opción'],
  [/secci�n/gi, 'sección'],
  [/descripci�n/gi, 'descripción'],
  [/validaci�n/gi, 'validación'],
  [/educaci�n/gi, 'educación'],
  [/depreciaci�n/gi, 'depreciación'],
  [/categor�a/gi, 'categoría'],
  [/subcategor�a/gi, 'subcategoría'],
  [/n�mero/gi, 'número'],
  [/a�o/gi, 'año'],
  [/d�as/gi, 'días'],
  [/m�s/gi, 'más'],
  [/despu�s/gi, 'después'],
  [/Aqu�/g, 'Aquí'],
  [/por qu�/gi, 'por qué'],
  [/qu�/gi, 'qué'],
  [/c�mo/gi, 'cómo'],
  [/d�nde/gi, 'dónde'],
  [/cu�l/gi, 'cuál'],
  [/g�nero/gi, 'género'],
  [/tel�fono/gi, 'teléfono'],
  [/direcci�n/gi, 'dirección'],
  [/cl�nic/gi, 'clínic'], // clínica, clínicas, clínico, clínicos
  [/p�gina/gi, 'página'],
  [/p�blico/gi, 'público'],
  [/m�nimo/gi, 'mínimo'],
  [/m�ximo/gi, 'máximo'],
  [/b�sic/gi, 'básic'],
  [/b�squeda/gi, 'búsqueda'],
  [/contrase�a/gi, 'contraseña'],
  [/sesi�n/gi, 'sesión'],
  [/per�odo/gi, 'período'],
  [/campa�a/gi, 'campaña'],
  [/inval�do/gi, 'inválido'],
  [/inv�lido/gi, 'inválido'],
  [/v�a/gi, 'vía'],
  [/est�/gi, 'está'],
  [/est�s/gi, 'estás'],
  [/eliminar�s/gi, 'eliminarás'],
  [/eliminaci�n/gi, 'eliminación'],

  // Standalone common words
  [/\bS�\b/g, 'Sí'],
];

function fixString(s) {
  let out = s;
  for (const [re, to] of repl) {
    out = out.replace(re, to);
  }
  return out;
}

function walk(obj) {
  if (Array.isArray(obj)) return obj.map(walk);
  if (obj && typeof obj === 'object') {
    for (const k of Object.keys(obj)) obj[k] = walk(obj[k]);
    return obj;
  }
  if (typeof obj === 'string') return fixString(obj);
  return obj;
}

let totalFixed = 0;
for (const file of targets) {
  let raw = fs.readFileSync(file, 'utf8');
  const data = JSON.parse(raw);
  const before = JSON.stringify(data);
  const fixed = walk(data);
  let after = JSON.stringify(fixed);
  let removed = (before.match(/�/g)?.length || 0) - (after.match(/�/g)?.length || 0);

  // If replacement char still present, do a raw text pass for stubborn tokens
  if ((after.match(/�/g)?.length || 0) > 0) {
    // Work on text to catch tokens our regexes may have missed
    const rawRepl = [
      ['Restauraci�n', 'Restauración'],
      ['v�a', 'vía'],
      ['campa�a', 'campaña'],
      ['categor�a', 'categoría'],
      ['subcategor�a', 'subcategoría'],
      ['g�nero', 'género'],
      ['qui�n', 'quién'],
      ['refiri�', 'refirió'],
      ['per�odo', 'período'],
      ['cl�nicas', 'clínicas'],
      ['cl�nica', 'clínica'],
      ['organizaci�n', 'organización'],
      ['Descripci�n', 'Descripción'],
      ['direcci�n', 'dirección'],
      ['Direcci�n', 'Dirección'],
      ['Tel�fono', 'Teléfono'],
      ['educaci�n', 'educación'],
      ['Configuraci�n', 'Configuración'],
      ['�Est�s', '¿Estás'],
      ['Opci�n', 'Opción'],
      ['Secci�n', 'Sección'],
      ['Informaci�n', 'Información'],
      ['eliminaci�n', 'eliminación'],
      ['resumen de cu�nto', 'resumen de cuánto'],
    ];
    let text = JSON.stringify(fixed, null, 2);
    for (const [from, to] of rawRepl) text = text.split(from).join(to);
    after = text;
  }

  if (before !== after) {
    fs.writeFileSync(file, after + '\n', 'utf8');
    const afterBad = (after.match(/�/g)?.length || 0);
    const beforeBad = (before.match(/�/g)?.length || 0);
    removed = Math.max(0, beforeBad - afterBad);
    totalFixed += removed;
    console.log(`[i18n:fix-es] Updated ${path.relative(process.cwd(), file)} (removed ~${removed} bad chars, remaining ${afterBad})`);
  } else {
    console.log(`[i18n:fix-es] No changes in ${path.relative(process.cwd(), file)}`);
  }
}

console.log(`[i18n:fix-es] Done. Approx replacements: ${totalFixed}`);
