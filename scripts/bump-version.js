#!/usr/bin/env node

/**
 * Script para incrementar la versión de la aplicación
 *
 * Uso:
 *   node scripts/bump-version.js patch   # 0.2.0 → 0.2.1
 *   node scripts/bump-version.js minor   # 0.2.0 → 0.3.0
 *   node scripts/bump-version.js major   # 0.2.0 → 1.0.0
 *
 * Actualiza:
 * - web/package.json
 * - Muestra recordatorio para actualizar CHANGELOG.md y archivos de traducción
 */

const fs = require('fs');
const path = require('path');

// Argumentos de línea de comandos
const args = process.argv.slice(2);
const bumpType = args[0]; // patch, minor, major

if (!['patch', 'minor', 'major'].includes(bumpType)) {
  console.error('❌ Error: Tipo de bump inválido');
  console.log('');
  console.log('Uso:');
  console.log('  node scripts/bump-version.js patch   # Bug fixes');
  console.log('  node scripts/bump-version.js minor   # New features');
  console.log('  node scripts/bump-version.js major   # Breaking changes');
  process.exit(1);
}

// Rutas de archivos
const webDir = path.join(__dirname, '..', 'web');
const packageJsonPath = path.join(webDir, 'package.json');

// Leer package.json
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const currentVersion = packageJson.version;

// Calcular nueva versión
const [major, minor, patch] = currentVersion.split('.').map(Number);
let newVersion;

switch (bumpType) {
  case 'major':
    newVersion = `${major + 1}.0.0`;
    break;
  case 'minor':
    newVersion = `${major}.${minor + 1}.0`;
    break;
  case 'patch':
    newVersion = `${major}.${minor}.${patch + 1}`;
    break;
}

// Actualizar package.json
packageJson.version = newVersion;
fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');

// Generar mensaje de éxito
console.log('');
console.log('✅ Versión actualizada exitosamente!');
console.log('');
console.log(`   ${currentVersion} → ${newVersion}`);
console.log('');
console.log('📝 Archivos actualizados:');
console.log(`   ✓ web/package.json`);
console.log('');
console.log('⚠️  RECORDATORIO - Actualiza manualmente:');
console.log('');
console.log('   1. web/.env.local');
console.log(`      NEXT_PUBLIC_APP_VERSION=${newVersion}`);
console.log('');
console.log('   2. CHANGELOG.md');
console.log(`      ## [${newVersion}] - ${new Date().toISOString().split('T')[0]}`);
console.log('');
console.log('   3. web/messages/version.es.json');
console.log(`      "v${newVersion.replace(/\./g, '_')}": { ... }`);
console.log('');
console.log('   4. web/messages/version.en.json');
console.log(`      "v${newVersion.replace(/\./g, '_')}": { ... }`);
console.log('');
console.log('   5. web/components/ui/VersionBadge.tsx');
console.log(`      const releases = ['v${newVersion.replace(/\./g, '_')}', ...]`);
console.log(`      const releaseVersions = ['${newVersion}', ...]`);
console.log('');
console.log('📚 Ver guía completa: docs/VERSIONING-AND-RELEASE-NOTES.md');
console.log('');
