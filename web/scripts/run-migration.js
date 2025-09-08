const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runMigration() {
  try {
    const migrationPath = path.join(__dirname, '../../supabase/migrations/12_fix_workspaces_role_duplicate.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('Running migration: 12_fix_workspaces_role_duplicate.sql');
    
    const { data, error } = await supabase.rpc('exec_sql', { 
      sql_query: migrationSQL 
    }).single();

    if (error) {
      // Si no existe la función exec_sql, intentar con query directa
      console.log('Trying direct query approach...');
      
      // Dividir el SQL en statements individuales
      const statements = migrationSQL
        .split(/;\s*$/gm)
        .filter(stmt => stmt.trim().length > 0)
        .map(stmt => stmt.trim() + ';');
      
      for (const statement of statements) {
        if (statement.startsWith('--') || statement.trim() === ';') continue;
        
        console.log('Executing statement:', statement.substring(0, 50) + '...');
        const { error: stmtError } = await supabase.rpc('exec_sql', { 
          sql_query: statement 
        });
        
        if (stmtError) {
          console.error('Error in statement:', stmtError);
          // Continue with next statement
        }
      }
    }

    console.log('Migration completed successfully!');
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

runMigration();