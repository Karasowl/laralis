// Script para probar el API de categorías desde Node.js
// Ejecutar con: node scripts/test-api-categories.js

const fetch = require('node-fetch');

async function testCategoriesAPI() {
  try {
    const response = await fetch('http://localhost:3000/api/categories?type=expenses', {
      credentials: 'include'
    });

    const data = await response.json();

    console.log('=== CATEGORÍAS RETORNADAS POR EL API ===');
    console.log(JSON.stringify(data, null, 2));

    console.log('\n=== RESUMEN ===');
    console.log('Total categorías:', data.data?.length || 0);

    const parents = data.data?.filter(c => !c.parent_id) || [];
    const children = data.data?.filter(c => c.parent_id) || [];

    console.log('Categorías padre:', parents.length);
    console.log('Subcategorías:', children.length);

    console.log('\n=== VERIFICAR PARENT_ID ===');
    data.data?.forEach(cat => {
      console.log(`${cat.display_name || cat.name}: parent_id = ${cat.parent_id || 'NULL'}`);
    });

  } catch (error) {
    console.error('Error:', error.message);
  }
}

testCategoriesAPI();
