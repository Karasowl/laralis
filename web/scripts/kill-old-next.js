#!/usr/bin/env node

const { execSync } = require('child_process');
const path = require('path');

function killOldNextProcesses() {
  try {
    if (process.platform === 'win32') {
      // En Windows, buscar y matar solo procesos de Next.js
      console.log('🔍 Buscando procesos de Next.js anteriores...');
      
      // Buscar procesos que escuchen en puertos típicos de Next.js
      const ports = ['3000', '3001', '3002', '3003', '3004', '3005', '3006', '3007', '3008', '3009', '3010'];
      
      for (const port of ports) {
        try {
          const result = execSync(`netstat -ano | findstr :${port}`, { encoding: 'utf8' });
          const lines = result.split('\n').filter(line => line.includes('LISTENING'));
          
          for (const line of lines) {
            const parts = line.trim().split(/\s+/);
            const pid = parts[parts.length - 1];
            
            if (pid && pid !== '0') {
              try {
                // Verificar que es un proceso de Node antes de matarlo
                const processInfo = execSync(`wmic process where ProcessId=${pid} get CommandLine`, { encoding: 'utf8' });
                if (processInfo.includes('node') && (processInfo.includes('next') || processInfo.includes('.next'))) {
                  console.log(`🎯 Terminando proceso Next.js antiguo (PID: ${pid}) en puerto ${port}`);
                  execSync(`taskkill /PID ${pid} /F`, { stdio: 'ignore' });
                }
              } catch (e) {
                // Proceso ya no existe o no tenemos permisos
              }
            }
          }
        } catch (e) {
          // No hay procesos en este puerto
        }
      }
      
      console.log('✅ Limpieza completada');
    } else {
      // En Linux/Mac, usar lsof
      const ports = '3000,3001,3002,3003,3004,3005,3006,3007,3008,3009,3010';
      try {
        execSync(`lsof -ti:${ports} | xargs kill -9`, { stdio: 'ignore' });
        console.log('✅ Procesos de Next.js anteriores terminados');
      } catch (e) {
        console.log('ℹ️  No hay procesos de Next.js activos');
      }
    }
  } catch (error) {
    console.log('ℹ️  No se encontraron procesos de Next.js para limpiar');
  }
}

// Ejecutar la limpieza
killOldNextProcesses();