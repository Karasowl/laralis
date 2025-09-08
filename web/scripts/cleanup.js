#!/usr/bin/env node

const { execSync } = require('child_process');

function cleanup() {
  console.log('\n🧹 Limpiando procesos de Node.js...');
  try {
    if (process.platform === 'win32') {
      execSync('taskkill /F /IM node.exe', { stdio: 'ignore' });
    } else {
      execSync('pkill -f node', { stdio: 'ignore' });
    }
    console.log('✅ Procesos de Node.js terminados');
  } catch (error) {
    // Ignorar errores si no hay procesos para matar
    console.log('ℹ️  No hay procesos de Node.js activos');
  }
  process.exit(0);
}

// Escuchar señales de terminación
process.on('SIGINT', cleanup);  // Ctrl+C
process.on('SIGTERM', cleanup); // Terminación
process.on('beforeExit', cleanup);

console.log('🎯 Cleanup handler registrado. Presiona Ctrl+C para limpiar procesos Node.js');