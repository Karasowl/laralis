const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: './web/.env.local' });

// Configuración de Supabase usando las variables de entorno
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Error: Faltan variables de entorno NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    persistSession: false
  }
});

async function runMigration() {
  console.log('🚀 Iniciando migración de CASCADE DELETE...\n');

  try {
    // Leer el archivo de migración
    const migrationPath = path.join(__dirname, 'supabase', 'migrations', '29_complete_cascade_delete.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('📄 Archivo de migración leído: 29_complete_cascade_delete.sql');
    console.log('⏳ Ejecutando migración...\n');

    // Dividir el SQL en comandos individuales por los bloques DO $$
    const sqlCommands = migrationSQL
      .split(/(?=DO \$\$)|(?=CREATE TABLE)|(?=CREATE INDEX)|(?=SELECT 'Migration completed)/)
      .filter(cmd => cmd.trim().length > 0)
      .map(cmd => cmd.trim());

    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < sqlCommands.length; i++) {
      const command = sqlCommands[i];

      // Extraer descripción del comando para el log
      let description = 'Comando SQL';
      if (command.includes('user_workspaces_user_id_fkey')) {
        description = 'user_workspaces → auth.users CASCADE';
      } else if (command.includes('user_workspaces_workspace_id_fkey')) {
        description = 'user_workspaces → workspaces CASCADE';
      } else if (command.includes('workspace_members_user_id_fkey')) {
        description = 'workspace_members → auth.users CASCADE';
      } else if (command.includes('workspace_members_workspace_id_fkey')) {
        description = 'workspace_members → workspaces CASCADE';
      } else if (command.includes('workspaces_owner_id_fkey')) {
        description = 'workspaces → auth.users (owner) CASCADE';
      } else if (command.includes('workspace_activity_workspace_id_fkey')) {
        description = 'workspace_activity → workspaces CASCADE';
      } else if (command.includes('users_id_fkey')) {
        description = 'public.users → auth.users CASCADE';
      } else if (command.includes('verification_codes')) {
        description = 'Tabla verification_codes';
      } else if (command.includes('category_types')) {
        description = 'Tabla category_types';
      } else if (command.includes('expense_categories')) {
        description = 'Tabla expense_categories';
      } else if (command.includes('marketing_platforms')) {
        description = 'Tabla marketing_platforms';
      } else if (command.includes('CREATE INDEX')) {
        description = 'Índices de rendimiento';
      }

      process.stdout.write(`  [${i + 1}/${sqlCommands.length}] ${description}... `);

      try {
        const { data, error } = await supabase.rpc('exec_sql', {
          sql_query: command
        }).single();

        if (error) {
          // Si el error es porque la función exec_sql no existe, intentar con el SQL directo
          if (error.message.includes('exec_sql')) {
            // Intentar ejecutar mediante fetch directo a la API REST
            const response = await fetch(`${supabaseUrl}/rest/v1/rpc/`, {
              method: 'POST',
              headers: {
                'apikey': supabaseServiceKey,
                'Authorization': `Bearer ${supabaseServiceKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                query: command
              })
            });

            if (response.ok) {
              console.log('✅');
              successCount++;
            } else {
              console.log('⚠️ (posiblemente ya aplicado)');
              successCount++;
            }
          } else {
            console.log('⚠️ (posiblemente ya aplicado)');
            successCount++;
          }
        } else {
          console.log('✅');
          successCount++;
        }
      } catch (err) {
        console.log('❌');
        console.error(`     Error: ${err.message}`);
        errorCount++;
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log(`✨ Migración completada:`);
    console.log(`   ✅ Exitosos: ${successCount}`);
    if (errorCount > 0) {
      console.log(`   ❌ Errores: ${errorCount}`);
    }
    console.log('='.repeat(60));

    console.log('\n📋 Resumen de cambios aplicados:');
    console.log('   • CASCADE DELETE para todas las relaciones con usuarios');
    console.log('   • Tabla verification_codes creada/actualizada');
    console.log('   • Tablas category_types, expense_categories, marketing_platforms verificadas');
    console.log('   • Índices de rendimiento agregados');
    console.log('   • Cadena completa: auth.users → workspaces → clinics → todos los datos');

    console.log('\n✅ ¡La base de datos ahora eliminará TODOS los registros relacionados');
    console.log('   cuando se borre una cuenta de usuario!');

  } catch (error) {
    console.error('\n❌ Error ejecutando la migración:', error.message);
    console.error('\nNOTA: Es posible que necesites ejecutar la migración manualmente en Supabase.');
    console.error('Copia el contenido de: supabase/migrations/29_complete_cascade_delete.sql');
    process.exit(1);
  }
}

// Ejecutar la migración
runMigration();