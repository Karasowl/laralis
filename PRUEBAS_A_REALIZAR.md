# ✅ PRUEBAS A REALIZAR

El script SQL se ejecutó correctamente. Ahora verifica que todo funcione:

## 1. 🕐 PRUEBA: Configuración de Tiempo
**URL:** http://localhost:3000/time

**Qué hacer:**
1. Ve a la página de Tiempo
2. Cambia los valores (ej: 26 días laborables)
3. Guarda
4. Recarga la página
5. **VERIFICAR:** Los valores deben persistir (no volver a 20)

**Resultado esperado:** ✅ Los cambios se guardan correctamente

---

## 2. 💰 PRUEBA: Costos Fijos
**URL:** http://localhost:3000/fixed-costs

**Qué hacer:**
1. Ve a la página de Costos Fijos
2. **VERIFICAR:** Los montos deben mostrar valores razonables
   - Ejemplo: $20.00 (no $2,000.00)
   - Renta: ~$100-200
   - Servicios: ~$20-50

**Resultado esperado:** ✅ Montos correctos en pesos

---

## 3. 👥 PRUEBA: Pacientes
**URL:** http://localhost:3000/patients

**Qué hacer:**
1. Ve a la página de Pacientes
2. Click en "Agregar Paciente"
3. Llena el formulario:
   - Nombre: Juan
   - Apellido: Pérez
   - Email: juan@example.com
   - Teléfono: 555-1234
4. Guarda
5. **VERIFICAR:** El paciente aparece en la lista
6. Usa la búsqueda para buscar "Juan"
7. **VERIFICAR:** El filtro funciona
8. Edita el paciente
9. **VERIFICAR:** Los cambios se guardan

**Resultado esperado:** ✅ CRUD completo funcionando

---

## 4. 🦷 PRUEBA: Servicios con Insumos
**URL:** http://localhost:3000/services

**Qué hacer:**
1. Ve a la página de Servicios
2. Edita un servicio existente o crea uno nuevo
3. En la sección de insumos, click en "Agregar Insumo"
4. Selecciona un insumo de la lista
5. Ingresa cantidad
6. **VERIFICAR:** El insumo se agrega al servicio
7. **VERIFICAR:** El costo variable se calcula automáticamente

**Resultado esperado:** ✅ Los servicios pueden tener insumos asociados

---

## 5. 🏠 PRUEBA: Dashboard
**URL:** http://localhost:3000

**Qué hacer:**
1. Ve al Dashboard principal
2. **VERIFICAR:** Las métricas se muestran:
   - Pacientes del mes
   - Tratamientos del mes
   - Ingresos
   - Ocupación

**Resultado esperado:** ✅ Dashboard muestra métricas (pueden ser 0 si no hay datos)

---

## 6. 🗂️ PRUEBA: Navegación
**Qué hacer:**
1. Verifica que el menú tiene las secciones:
   - **Operaciones:** Pacientes, Tratamientos, Reportes
   - **Configuración:** Activos, Costos, Servicios, Tarifario, Tiempo
   - **Ajustes:** Espacios, Clínicas

**Resultado esperado:** ✅ Navegación organizada y funcional

---

## 🎯 Si todo funciona:
¡La aplicación está lista para uso básico! 

## ⚠️ Si algo falla:
Reporta cuál prueba falló y qué error específico ves para poder arreglarlo.

## 📝 Pendientes después de las pruebas:
- Implementar módulo de Tratamientos
- Implementar Reportes con datos reales
- Arreglar campo MXN en Activos