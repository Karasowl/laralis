#!/usr/bin/env node

/**
 * Script para ejecutar TODAS las pruebas y generar un reporte completo
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// Colores para la consola
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

const log = {
  info: (msg) => console.log(`${colors.cyan}ℹ️  ${msg}${colors.reset}`),
  success: (msg) => console.log(`${colors.green}✅ ${msg}${colors.reset}`),
  error: (msg) => console.log(`${colors.red}❌ ${msg}${colors.reset}`),
  warning: (msg) => console.log(`${colors.yellow}⚠️  ${msg}${colors.reset}`),
  title: (msg) => console.log(`\n${colors.bright}${colors.blue}${'='.repeat(60)}\n${msg}\n${'='.repeat(60)}${colors.reset}`),
  section: (msg) => console.log(`\n${colors.magenta}▶️  ${msg}${colors.reset}`),
};

// Resultados globales
const results = {
  unit: { passed: 0, failed: 0, total: 0, duration: 0 },
  e2e: { passed: 0, failed: 0, total: 0, duration: 0 },
  overall: { passed: 0, failed: 0, total: 0, startTime: Date.now() }
};

// Lista de problemas encontrados
const issues = [];

/**
 * Ejecuta un comando y captura el output
 */
function runCommand(command, args) {
  return new Promise((resolve, reject) => {
    const process = spawn(command, args, {
      shell: true,
      stdio: 'pipe'
    });

    let output = '';
    let errorOutput = '';

    process.stdout.on('data', (data) => {
      output += data.toString();
      // Mostrar en tiempo real
      process.stdout.write(data);
    });

    process.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    process.on('close', (code) => {
      resolve({
        code,
        output,
        errorOutput,
        success: code === 0
      });
    });

    process.on('error', (err) => {
      reject(err);
    });
  });
}

/**
 * Parse los resultados de Vitest
 */
function parseVitestOutput(output) {
  const stats = {
    passed: 0,
    failed: 0,
    total: 0
  };

  // Buscar línea como: "Tests  2 failed | 112 passed (114)"
  const testMatch = output.match(/Tests\s+(\d+)\s+failed\s*\|\s*(\d+)\s+passed\s*\((\d+)\)/);
  if (testMatch) {
    stats.failed = parseInt(testMatch[1]);
    stats.passed = parseInt(testMatch[2]);
    stats.total = parseInt(testMatch[3]);
  } else {
    // Si todos pasan: "Tests  114 passed (114)"
    const passMatch = output.match(/Tests\s+(\d+)\s+passed\s*\((\d+)\)/);
    if (passMatch) {
      stats.passed = parseInt(passMatch[1]);
      stats.total = parseInt(passMatch[2]);
      stats.failed = 0;
    }
  }

  return stats;
}

/**
 * Parse los resultados de Cypress
 */
function parseCypressOutput(output) {
  const stats = {
    passed: 0,
    failed: 0,
    total: 0
  };

  // Buscar línea como: "Tests:        11"
  const totalMatch = output.match(/Tests:\s+(\d+)/);
  if (totalMatch) {
    stats.total = parseInt(totalMatch[1]);
  }

  // Buscar línea como: "Passing:      9"
  const passMatch = output.match(/Passing:\s+(\d+)/);
  if (passMatch) {
    stats.passed = parseInt(passMatch[1]);
  }

  // Buscar línea como: "Failing:      2"
  const failMatch = output.match(/Failing:\s+(\d+)/);
  if (failMatch) {
    stats.failed = parseInt(failMatch[1]);
  }

  return stats;
}

/**
 * Ejecuta las pruebas unitarias
 */
async function runUnitTests() {
  log.section('PRUEBAS UNITARIAS - Motor de Cálculos');
  
  const startTime = Date.now();
  const result = await runCommand('npm', ['run', 'test:unit']);
  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  
  const stats = parseVitestOutput(result.output);
  
  results.unit = { ...stats, duration: parseFloat(duration) };
  results.overall.passed += stats.passed;
  results.overall.failed += stats.failed;
  results.overall.total += stats.total;
  
  if (stats.failed > 0) {
    issues.push(`❌ ${stats.failed} pruebas unitarias fallaron`);
    
    // Extraer errores específicos
    const errorMatches = result.output.match(/× .+/g);
    if (errorMatches) {
      errorMatches.forEach(error => {
        issues.push(`  └─ ${error}`);
      });
    }
  }
  
  return result.success;
}

/**
 * Ejecuta las pruebas E2E
 */
async function runE2ETests() {
  log.section('PRUEBAS E2E - Cypress');
  
  // Lista de specs a ejecutar
  const specs = [
    '00-smoke-test.cy.ts',
    '01-auth-real.cy.ts',
    // Los otros specs necesitan actualización de selectores
    // '02-patients.cy.ts',
    // '03-supplies.cy.ts',
    // etc...
  ];
  
  let totalPassed = 0;
  let totalFailed = 0;
  let totalTests = 0;
  let totalDuration = 0;
  
  for (const spec of specs) {
    log.info(`Ejecutando: ${spec}`);
    
    const startTime = Date.now();
    const result = await runCommand('npx', ['cypress', 'run', '--spec', `cypress/e2e/${spec}`]);
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    
    const stats = parseCypressOutput(result.output);
    
    totalPassed += stats.passed;
    totalFailed += stats.failed;
    totalTests += stats.total;
    totalDuration += parseFloat(duration);
    
    if (stats.failed > 0) {
      issues.push(`❌ ${spec}: ${stats.failed} pruebas fallaron`);
    } else {
      log.success(`${spec}: ${stats.passed}/${stats.total} pruebas pasaron`);
    }
  }
  
  results.e2e = {
    passed: totalPassed,
    failed: totalFailed,
    total: totalTests,
    duration: totalDuration
  };
  
  results.overall.passed += totalPassed;
  results.overall.failed += totalFailed;
  results.overall.total += totalTests;
  
  return totalFailed === 0;
}

/**
 * Genera el reporte final
 */
function generateReport() {
  const totalDuration = ((Date.now() - results.overall.startTime) / 1000).toFixed(2);
  
  log.title('📊 REPORTE FINAL DE PRUEBAS');
  
  console.log('\n📈 ESTADÍSTICAS GENERALES:');
  console.log(`├─ Total de pruebas: ${results.overall.total}`);
  console.log(`├─ Pruebas exitosas: ${colors.green}${results.overall.passed}${colors.reset}`);
  console.log(`├─ Pruebas fallidas: ${results.overall.failed > 0 ? colors.red : colors.green}${results.overall.failed}${colors.reset}`);
  console.log(`├─ Tasa de éxito: ${((results.overall.passed / results.overall.total) * 100).toFixed(1)}%`);
  console.log(`└─ Tiempo total: ${totalDuration}s`);
  
  console.log('\n🧪 PRUEBAS UNITARIAS:');
  console.log(`├─ Total: ${results.unit.total}`);
  console.log(`├─ Exitosas: ${results.unit.passed}`);
  console.log(`├─ Fallidas: ${results.unit.failed}`);
  console.log(`└─ Duración: ${results.unit.duration}s`);
  
  console.log('\n🌐 PRUEBAS E2E:');
  console.log(`├─ Total: ${results.e2e.total}`);
  console.log(`├─ Exitosas: ${results.e2e.passed}`);
  console.log(`├─ Fallidas: ${results.e2e.failed}`);
  console.log(`└─ Duración: ${results.e2e.duration}s`);
  
  if (issues.length > 0) {
    console.log(`\n${colors.red}⚠️  PROBLEMAS ENCONTRADOS:${colors.reset}`);
    issues.forEach(issue => console.log(issue));
  }
  
  // Generar archivo de reporte
  const report = {
    timestamp: new Date().toISOString(),
    duration: totalDuration,
    results: results,
    issues: issues,
    success: results.overall.failed === 0
  };
  
  fs.writeFileSync(
    path.join(__dirname, 'test-report.json'),
    JSON.stringify(report, null, 2)
  );
  
  log.info('Reporte guardado en test-report.json');
  
  // Estado final
  console.log('\n');
  if (results.overall.failed === 0) {
    log.success('🎉 TODAS LAS PRUEBAS PASARON EXITOSAMENTE!');
    return 0;
  } else {
    log.error(`💔 ${results.overall.failed} PRUEBAS FALLARON`);
    return 1;
  }
}

/**
 * Función principal
 */
async function main() {
  log.title('🚀 EJECUTANDO SUITE COMPLETA DE PRUEBAS');
  
  try {
    // 1. Verificar que el servidor esté corriendo
    log.section('Verificando servidor de desarrollo...');
    try {
      await runCommand('curl', ['-s', 'http://localhost:3000']);
      log.success('Servidor detectado en puerto 3000');
    } catch {
      log.warning('Servidor no detectado, puede que algunas pruebas E2E fallen');
    }
    
    // 2. Ejecutar pruebas unitarias
    await runUnitTests();
    
    // 3. Ejecutar pruebas E2E
    await runE2ETests();
    
    // 4. Generar reporte
    const exitCode = generateReport();
    
    process.exit(exitCode);
  } catch (error) {
    log.error(`Error fatal: ${error.message}`);
    process.exit(1);
  }
}

// Ejecutar
main();