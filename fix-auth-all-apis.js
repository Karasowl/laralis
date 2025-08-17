#!/usr/bin/env node

/**
 * Script para agregar autenticación a todas las APIs que la necesiten
 */

const fs = require('fs');

const apisToFix = [
  'web/app/api/fixed-costs/route.ts',
  'web/app/api/supplies/route.ts', 
  'web/app/api/services/route.ts',
  'web/app/api/settings/time/route.ts',
  'web/app/api/treatments/[id]/route.ts'
];

const authImport = `import { createSupabaseClient } from '@/lib/supabase';`;

const authCheck = `    const cookieStore = cookies();
    const supabase = createSupabaseClient(cookieStore);
    
    // ✅ Validar usuario autenticado
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }`;

apisToFix.forEach(filePath => {
  if (!fs.existsSync(filePath)) {
    console.log(`⚠️ No encontrado: ${filePath}`);
    return;
  }

  console.log(`🔧 Corrigiendo: ${filePath}`);
  
  let content = fs.readFileSync(filePath, 'utf8');
  
  // 1. Agregar import si no existe
  if (!content.includes('createSupabaseClient')) {
    content = content.replace(
      /import { getClinicIdOrDefault } from '@\/lib\/clinic';/,
      `import { getClinicIdOrDefault } from '@/lib/clinic';\n${authImport}`
    );
  }
  
  // 2. Agregar auth check en GET functions que no la tengan
  content = content.replace(
    /(export async function GET\([^)]*\)[^{]*\{[^}]*try[^}]*\{)\s*(const cookieStore = cookies\(\);)/g,
    `$1\n${authCheck}\n\n    $2`
  );
  
  // 3. Agregar auth check en POST functions que no la tengan  
  content = content.replace(
    /(export async function POST\([^)]*\)[^{]*\{[^}]*try[^}]*\{[^}]*const body[^}]*\;)\s*(const cookieStore = cookies\(\);)/g,
    `$1\n\n${authCheck}\n\n    $2`
  );
  
  // 4. Agregar auth check en PUT functions que no la tengan
  content = content.replace(
    /(export async function PUT\([^)]*\)[{]*\{[^}]*try[^}]*\{[^}]*const body[^}]*\;)\s*(const cookieStore = cookies\(\);)/g,
    `$1\n\n${authCheck}\n\n    $2`
  );
  
  fs.writeFileSync(filePath, content);
  console.log(`✅ Corregido: ${filePath}`);
});

console.log('\n🎉 Todas las APIs han sido corregidas con autenticación');
