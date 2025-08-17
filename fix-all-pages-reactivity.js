#!/usr/bin/env node

/**
 * Script para hacer todas las páginas principales reactivas a cambios de clínica
 * Ejecutar: node fix-all-pages-reactivity.js
 */

const fs = require('fs');
const path = require('path');

const pagesToFix = [
  'web/app/supplies/page.tsx',
  'web/app/services/page.tsx', 
  'web/app/assets/page.tsx',
  'web/app/fixed-costs/page.tsx',
  'web/app/tariffs/page.tsx',
  'web/app/reports/page.tsx'
];

const fixes = {
  // 1. Agregar import de useWorkspace
  addWorkspaceImport: (content) => {
    if (content.includes('useWorkspace')) return content;
    
    const importPattern = /import { useTranslations } from 'next-intl';/;
    if (importPattern.test(content)) {
      return content.replace(
        importPattern,
        `import { useTranslations } from 'next-intl';\nimport { useWorkspace } from '@/contexts/workspace-context';`
      );
    }
    return content;
  },

  // 2. Agregar useWorkspace en el componente
  addWorkspaceHook: (content) => {
    if (content.includes('const { currentClinic } = useWorkspace()')) return content;
    
    const hookPattern = /const t = useTranslations\(\);/;
    if (hookPattern.test(content)) {
      return content.replace(
        hookPattern,
        `const t = useTranslations();\n  const { currentClinic } = useWorkspace(); // ✅ Obtener clínica actual`
      );
    }
    return content;
  },

  // 3. Hacer useEffect reactivo a cambios de clínica
  fixUseEffect: (content) => {
    // Buscar useEffect que carga datos
    const useEffectPattern = /useEffect\(\(\) => \{\s*load[A-Za-z]*\(\);\s*\}, \[\]\);/;
    if (useEffectPattern.test(content)) {
      return content.replace(
        useEffectPattern,
        `// ✅ Recargar cuando cambie la clínica\n  useEffect(() => {\n    if (currentClinic?.id) {\n      loadData();\n    }\n  }, [currentClinic?.id]);`
      );
    }

    // Variante con loadData
    const loadDataPattern = /useEffect\(\(\) => \{\s*loadData\(\);\s*\}, \[\]\);/;
    if (loadDataPattern.test(content)) {
      return content.replace(
        loadDataPattern,
        `// ✅ Recargar cuando cambie la clínica\n  useEffect(() => {\n    if (currentClinic?.id) {\n      loadData();\n    }\n  }, [currentClinic?.id]);`
      );
    }

    return content;
  },

  // 4. Agregar checks de clínica en funciones load
  addClinicChecks: (content) => {
    // Buscar funciones que hacen fetch sin clinicId
    const fetchPattern = /const loadData = async \(\) => \{\s*try \{/;
    if (fetchPattern.test(content)) {
      return content.replace(
        fetchPattern,
        `const loadData = async () => {\n    if (!currentClinic?.id) return; // ✅ No cargar sin clínica\n    \n    try {`
      );
    }

    // Variante con setLoading
    const loadingPattern = /const loadData = async \(\) => \{\s*setLoading\(true\);\s*try \{/;
    if (loadingPattern.test(content)) {
      return content.replace(
        loadingPattern,
        `const loadData = async () => {\n    if (!currentClinic?.id) return; // ✅ No cargar sin clínica\n    \n    setLoading(true);\n    try {`
      );
    }

    return content;
  },

  // 5. Agregar clinicId a URLs de fetch
  addClinicIdToFetch: (content) => {
    // Reemplazar fetch sin clinicId por fetch con clinicId
    const patterns = [
      { old: /fetch\('\/api\/supplies'\)/, new: `fetch(\`/api/supplies?clinicId=\${currentClinic.id}\`)` },
      { old: /fetch\('\/api\/services'\)/, new: `fetch(\`/api/services?clinicId=\${currentClinic.id}\`)` },
      { old: /fetch\('\/api\/assets'\)/, new: `fetch(\`/api/assets?clinicId=\${currentClinic.id}\`)` },
      { old: /fetch\('\/api\/fixed-costs'\)/, new: `fetch(\`/api/fixed-costs?clinicId=\${currentClinic.id}\`)` },
      { old: /fetch\('\/api\/categories'\)/, new: `fetch(\`/api/categories?clinicId=\${currentClinic.id}\`)` },
      { old: /fetch\('\/api\/tariffs'\)/, new: `fetch(\`/api/tariffs?clinicId=\${currentClinic.id}\`)` },
    ];

    let result = content;
    patterns.forEach(pattern => {
      result = result.replace(pattern.old, pattern.new);
    });

    return result;
  }
};

// Aplicar todas las correcciones
pagesToFix.forEach(filePath => {
  if (!fs.existsSync(filePath)) {
    console.log(`⚠️ Archivo no encontrado: ${filePath}`);
    return;
  }

  console.log(`🔧 Corrigiendo: ${filePath}`);
  
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Aplicar todas las correcciones en secuencia
  content = fixes.addWorkspaceImport(content);
  content = fixes.addWorkspaceHook(content);
  content = fixes.fixUseEffect(content);
  content = fixes.addClinicChecks(content);
  content = fixes.addClinicIdToFetch(content);
  
  // Escribir archivo corregido
  fs.writeFileSync(filePath, content);
  console.log(`✅ Corregido: ${filePath}`);
});

console.log('\n🎉 Todas las páginas han sido corregidas para ser reactivas a cambios de clínica');
console.log('\n📝 Cambios realizados:');
console.log('   ✅ Agregado useWorkspace import');
console.log('   ✅ Agregado currentClinic hook');
console.log('   ✅ useEffect reactivo a currentClinic?.id');
console.log('   ✅ Checks de clínica en funciones load');
console.log('   ✅ clinicId agregado a URLs de fetch');
