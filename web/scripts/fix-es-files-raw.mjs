import fs from 'node:fs';
import path from 'node:path';

const messagesDir = fs.existsSync(path.resolve('messages'))
  ? path.resolve('messages')
  : path.resolve('web', 'messages');

const files = [
  path.join(messagesDir, 'es.json'),
  path.join(messagesDir, 'es-overrides.json'),
].filter((p) => fs.existsSync(p));

const pairs = [
  // Capitalized first (to preserve case)
  ['Configuraci�n', 'Configuración'],
  ['Descripci�n', 'Descripción'],
  ['Informaci�n', 'Información'],
  ['Educaci�n', 'Educación'],
  ['Depreciaci�n', 'Depreciación'],
  ['Categor�a', 'Categoría'],
  ['Subcategor�a', 'Subcategoría'],
  ['Cl�nica', 'Clínica'],
  ['Cl�nicas', 'Clínicas'],
  ['Opci�n', 'Opción'],
  ['Acci�n', 'Acción'],
  ['Tel�fono', 'Teléfono'],
  ['Direcci�n', 'Dirección'],
  ['G�nero', 'Género'],
  ['Per�odo', 'Período'],
  ['Restauraci�n', 'Restauración'],
  ['Secci�n', 'Sección'],
  ['Aqu�', 'Aquí'],
  ['�Est�s', '¿Estás'],
  ['�Seguro', '¿Seguro'],
  ['�Deseas', '¿Deseas'],
  ['Qui�n', 'Quién'],

  // Lowercase
  ['configuraci�n', 'configuración'],
  ['descripci�n', 'descripción'],
  ['informaci�n', 'información'],
  ['educaci�n', 'educación'],
  ['depreciaci�n', 'depreciación'],
  ['categor�a', 'categoría'],
  ['subcategor�a', 'subcategoría'],
  ['cl�nica', 'clínica'],
  ['cl�nicas', 'clínicas'],
  ['opci�n', 'opción'],
  ['acci�n', 'acción'],
  ['tel�fono', 'teléfono'],
  ['direcci�n', 'dirección'],
  ['g�nero', 'género'],
  ['per�odo', 'período'],
  ['restauraci�n', 'restauración'],
  ['secci�n', 'sección'],
  ['aqu�', 'aquí'],
  ['�Est�s', '¿Estás'],
  ['�est�s', '¿estás'],
  ['qui�n', 'quién'],
  ['refiri�', 'refirió'],
  ['cu�nto', 'cuánto'],
  ['v�a', 'vía'],
  ['campa�a', 'campaña'],
  ['n�mero', 'número'],
  ['m�s', 'más'],
  ['despu�s', 'después'],
  ['eliminaci�n', 'eliminación'],
];

for (const file of files) {
  let txt = fs.readFileSync(file, 'utf8');
  const before = txt;
  for (const [from, to] of pairs) {
    txt = txt.split(from).join(to);
  }
  if (txt !== before) {
    fs.writeFileSync(file, txt, 'utf8');
    console.log(`[i18n:fix-es-raw] Updated ${path.relative(process.cwd(), file)}`);
  } else {
    console.log(`[i18n:fix-es-raw] No changes in ${path.relative(process.cwd(), file)}`);
  }
}

