// Script para debuggear la creación de campañas

async function testDebugEndpoint() {
  console.log("=== 1. Obteniendo plataformas disponibles ===\n");
  
  // Primero obtener las plataformas disponibles
  const platformsResponse = await fetch('http://localhost:3003/api/debug-campaign', {
    method: 'GET',
    credentials: 'include',
  });
  
  const platformsData = await platformsResponse.json();
  console.log("Plataformas disponibles:");
  console.log(JSON.stringify(platformsData, null, 2));
  
  if (!platformsData.platforms || platformsData.platforms.length === 0) {
    console.log("\n❌ No hay plataformas disponibles. Abortando prueba.");
    return;
  }
  
  // Usar la primera plataforma disponible
  const firstPlatform = platformsData.platforms[0];
  console.log("\n=== 2. Intentando crear campaña con plataforma ===");
  console.log("Plataforma seleccionada:", firstPlatform.display_name || firstPlatform.name);
  console.log("Platform ID:", firstPlatform.id);
  
  const testData = {
    name: "Test Campaign " + new Date().toISOString().slice(0, 16),
    platform_id: firstPlatform.id,
    code: "TEST" + Date.now()
  };
  
  console.log("\n=== 3. Enviando petición POST ===");
  console.log("Data:", JSON.stringify(testData, null, 2));
  
  const createResponse = await fetch('http://localhost:3003/api/debug-campaign', {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify(testData)
  });
  
  const createResult = await createResponse.json();
  
  console.log("\n=== 4. Resultado ===");
  console.log("Status:", createResponse.status, createResponse.statusText);
  console.log("Response:", JSON.stringify(createResult, null, 2));
  
  if (createResponse.ok) {
    console.log("\n✅ Campaña creada exitosamente!");
    console.log("ID de la campaña:", createResult.data?.id);
  } else {
    console.log("\n❌ Error al crear la campaña");
    if (createResult.details) {
      console.log("Detalles del error:", createResult.details);
    }
  }
}

// Ejecutar el test
testDebugEndpoint().catch(console.error);