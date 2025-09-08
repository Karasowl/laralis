// Script para probar la creación de campañas
const testData = {
  name: "Test Campaign " + new Date().toISOString(),
  platform_id: "550e8400-e29b-41d4-a716-446655440001", // UUID de ejemplo
  code: "TEST123"
};

console.log("Enviando petición POST a /api/marketing/campaigns");
console.log("Data:", JSON.stringify(testData, null, 2));

fetch('http://localhost:3000/api/marketing/campaigns', {
  method: 'POST',
  headers: { 
    'Content-Type': 'application/json',
  },
  credentials: 'include',
  body: JSON.stringify(testData)
})
.then(async response => {
  console.log("\n=== Response Status ===");
  console.log("Status:", response.status, response.statusText);
  console.log("Headers:", Object.fromEntries(response.headers.entries()));
  
  const text = await response.text();
  console.log("\n=== Response Body ===");
  
  try {
    const json = JSON.parse(text);
    console.log(JSON.stringify(json, null, 2));
  } catch {
    console.log("Raw text:", text);
  }
  
  if (!response.ok) {
    console.log("\n❌ Error: La petición falló con status", response.status);
  } else {
    console.log("\n✅ Success: Campaña creada exitosamente");
  }
})
.catch(error => {
  console.error("\n❌ Network error:", error);
});