#!/usr/bin/env node

/**
 * Test Runner para Laralis Dental Manager
 * Ejecuta todas las pruebas del sistema de forma organizada
 */

const { spawn } = require('child_process');
const chalk = require('chalk');

// Si chalk no está instalado, usar console.log simple
const log = {
  info: (msg) => console.log(`ℹ️  ${msg}`),
  success: (msg) => console.log(`✅ ${msg}`),
  error: (msg) => console.log(`❌ ${msg}`),
  warning: (msg) => console.log(`⚠️  ${msg}`),
  title: (msg) => console.log(`\n${'='.repeat(60)}\n${msg}\n${'='.repeat(60)}`)
};

// Configuración de pruebas
const TEST_SUITES = {
  unit: {
    name: 'Pruebas Unitarias',
    command: 'npm',
    args: ['run', 'test:unit'],
    description: 'Motor de cálculos y lógica de negocio'
  },
  integration: {
    name: 'Pruebas de Integración',
    command: 'npm',
    args: ['test', 'integration-motor'],
    description: 'Flujo completo del motor de cálculos'
  },
  api: {
    name: 'Pruebas de API',
    command: 'npm',
    args: ['run', 'test:api'],
    description: 'Endpoints REST y manejo de datos'
  },
  e2e: {
    name: 'Pruebas E2E (Cypress)',
    command: 'npx',
    args: ['cypress', 'run'],
    description: 'Flujos completos de usuario'
  },
  multitenancy: {
    name: 'Pruebas de Multi-Tenancy',
    command: 'npx',
    args: ['cypress', 'run', '--spec', 'cypress/e2e/multi-tenancy.cy.ts'],
    description: 'Aislamiento de datos entre clínicas'
  }
};

// Función para ejecutar un comando
function runCommand(command, args, name) {
  return new Promise((resolve, reject) => {
    log.info(`Ejecutando: ${name}`);
    
    const process = spawn(command, args, {
      stdio: 'inherit',
      shell: true
    });

    process.on('close', (code) => {
      if (code === 0) {
        log.success(`${name} - Completado`);
        resolve();
      } else {
        log.error(`${name} - Falló con código ${code}`);
        reject(new Error(`${name} failed`));
      }
    });

    process.on('error', (err) => {
      log.error(`Error ejecutando ${name}: ${err.message}`);
      reject(err);
    });
  });
}

// Función para ejecutar todas las pruebas
async function runAllTests() {
  log.title('🧪 EJECUTANDO TODAS LAS PRUEBAS DE LARALIS');
  
  const results = {
    passed: [],
    failed: [],
    skipped: []
  };
  
  const startTime = Date.now();

  // 1. Verificar que el servidor está corriendo
  log.info('Verificando servidor de desarrollo...');
  try {
    const response = await fetch('http://localhost:3000');
    if (!response.ok) {
      log.warning('El servidor no está respondiendo correctamente');
      log.info('Iniciando servidor de desarrollo...');
      spawn('npm', ['run', 'dev'], {
        detached: true,
        stdio: 'ignore'
      });
      // Esperar a que el servidor esté listo
      await new Promise(resolve => setTimeout(resolve, 10000));
    }
  } catch (error) {
    log.warning('Servidor no encontrado. Iniciando...');
    const devServer = spawn('npm', ['run', 'dev'], {
      detached: true,
      stdio: 'ignore'
    });
    devServer.unref();
    log.info('Esperando a que el servidor esté listo...');
    await new Promise(resolve => setTimeout(resolve, 15000));
  }

  // 2. Ejecutar pruebas en orden
  for (const [key, suite] of Object.entries(TEST_SUITES)) {
    log.title(`📋 ${suite.name}`);
    log.info(suite.description);
    
    try {
      await runCommand(suite.command, suite.args, suite.name);
      results.passed.push(suite.name);
    } catch (error) {
      results.failed.push(suite.name);
      
      // Continuar con las siguientes pruebas a menos que sea crítico
      if (key === 'unit') {
        log.error('Las pruebas unitarias son críticas. Abortando...');
        break;
      }
    }
  }

  // 3. Resumen de resultados
  const endTime = Date.now();
  const duration = ((endTime - startTime) / 1000).toFixed(2);
  
  log.title('📊 RESUMEN DE PRUEBAS');
  
  log.info(`Duración total: ${duration} segundos`);
  log.info(`Pruebas exitosas: ${results.passed.length}`);
  log.info(`Pruebas fallidas: ${results.failed.length}`);
  
  if (results.passed.length > 0) {
    log.success('Pruebas exitosas:');
    results.passed.forEach(test => log.success(`  - ${test}`));
  }
  
  if (results.failed.length > 0) {
    log.error('Pruebas fallidas:');
    results.failed.forEach(test => log.error(`  - ${test}`));
  }
  
  // Retornar código de salida apropiado
  process.exit(results.failed.length > 0 ? 1 : 0);
}

// Función para ejecutar pruebas específicas
async function runSpecificTests(suiteKey) {
  const suite = TEST_SUITES[suiteKey];
  
  if (!suite) {
    log.error(`Suite de pruebas '${suiteKey}' no encontrada`);
    log.info('Suites disponibles:');
    Object.keys(TEST_SUITES).forEach(key => {
      log.info(`  - ${key}: ${TEST_SUITES[key].description}`);
    });
    process.exit(1);
  }
  
  log.title(`🧪 EJECUTANDO: ${suite.name}`);
  log.info(suite.description);
  
  try {
    await runCommand(suite.command, suite.args, suite.name);
    log.success('Pruebas completadas exitosamente');
    process.exit(0);
  } catch (error) {
    log.error('Las pruebas fallaron');
    process.exit(1);
  }
}

// Función para mostrar ayuda
function showHelp() {
  log.title('🔧 LARALIS TEST RUNNER');
  
  console.log('\nUso:');
  console.log('  node test-runner.js [opción]');
  console.log('\nOpciones:');
  console.log('  all         - Ejecutar todas las pruebas');
  console.log('  unit        - Solo pruebas unitarias');
  console.log('  integration - Solo pruebas de integración');
  console.log('  api         - Solo pruebas de API');
  console.log('  e2e         - Solo pruebas E2E');
  console.log('  multitenancy - Solo pruebas de multi-tenancy');
  console.log('  help        - Mostrar esta ayuda');
  console.log('\nEjemplos:');
  console.log('  node test-runner.js all');
  console.log('  node test-runner.js unit');
  console.log('  npm run test:all');
}

// Función principal
async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'help';
  
  switch (command) {
    case 'all':
      await runAllTests();
      break;
    case 'help':
    case '--help':
    case '-h':
      showHelp();
      break;
    default:
      await runSpecificTests(command);
  }
}

// Manejo de errores no capturados
process.on('unhandledRejection', (error) => {
  log.error(`Error no manejado: ${error.message}`);
  process.exit(1);
});

process.on('SIGINT', () => {
  log.warning('\nPruebas interrumpidas por el usuario');
  process.exit(130);
});

// Ejecutar
main().catch(error => {
  log.error(`Error fatal: ${error.message}`);
  process.exit(1);
});