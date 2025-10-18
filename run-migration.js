#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Read .env.local manually
const envPath = path.join(__dirname, 'web', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const envVars = {};

envContent.split('\n').forEach(line => {
  line = line.trim().replace(/\r/g, '');
  const match = line.match(/^([^=#]+)=(.*)$/);
  if (match) {
    envVars[match[1].trim()] = match[2].trim();
  }
});

const SUPABASE_URL = envVars.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = envVars.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('❌ Missing Supabase credentials in .env.local');
  process.exit(1);
}

// Read migration file
const migrationPath = path.join(__dirname, 'supabase', 'migrations', '28_add_cascade_delete.sql');
const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

console.log('🚀 Running migration: 28_add_cascade_delete.sql');
console.log('📍 Supabase URL:', SUPABASE_URL);
console.log('');

// Execute migration using Supabase REST API
async function runMigration() {
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`
      },
      body: JSON.stringify({ query: migrationSQL })
    });

    if (!response.ok) {
      // Try alternative method: direct SQL execution
      console.log('⚠️  RPC method not available, trying direct execution...');

      // Use the SQL Editor endpoint
      const directResponse = await fetch(`${SUPABASE_URL}/rest/v1/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify({ query: migrationSQL })
      });

      if (!directResponse.ok) {
        const error = await directResponse.text();
        throw new Error(`Migration failed: ${error}`);
      }
    }

    console.log('✅ Migration completed successfully!');
    console.log('');
    console.log('📝 Applied changes:');
    console.log('   • Added CASCADE DELETE from workspaces → clinics');
    console.log('   • Added CASCADE DELETE from clinics → all related tables');
    console.log('   • Updated foreign key constraints for:');
    console.log('     - settings_time, fixed_costs, assets');
    console.log('     - supplies, services, service_supplies');
    console.log('     - patients, treatments, expenses');
    console.log('     - tariffs, marketing_platforms, marketing_campaigns');
    console.log('     - expense_categories');
    console.log('');
    console.log('🎉 Database is now configured with CASCADE DELETE!');

  } catch (error) {
    console.error('❌ Error running migration:', error.message);
    console.log('');
    console.log('💡 Alternative: Run the migration manually in Supabase SQL Editor');
    console.log('   1. Go to: https://supabase.com/dashboard/project/ojlfihowjakbgobbrwjz/sql');
    console.log(`   2. Copy and paste the SQL from: ${migrationPath}`);
    console.log('   3. Click "Run"');
    process.exit(1);
  }
}

runMigration();
