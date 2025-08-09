# CRUD Completo de Insumos - 2025-08-09

**TASK**: TASK-20250809-supplies-crud
**PR**: N/A (implementación directa)

## Contexto
Ya teníamos una página básica de supplies que listaba datos. Necesitábamos completar el CRUD real con crear, editar y eliminar, mejorar la UX con formularios validados, i18n de categorías y soporte multi-tenant completo.

## Problema
- Faltaba funcionalidad de editar y eliminar insumos
- Las categorías se mostraban en inglés sin traducción
- No había validación de formularios con feedback visual
- La búsqueda no tenía debounce
- El formulario no convertía correctamente pesos a centavos

## Solución Implementada

### 1. Tipos y Validación
- Actualizado tipo `Supply` con categorías específicas en español
- Creado `zSupplyForm` para validación del formulario con precio en pesos
- Campo `cost_per_portion_cents` calculado dinámicamente

### 2. API CRUD Completa
**GET /api/supplies**
- Lista por clinic_id (cookie o query)
- Soporte para búsqueda con `?search=`
- Agrega campo calculado `cost_per_portion_cents`

**POST /api/supplies**
- Valida con zSupply
- Convierte price_pesos a price_cents
- Respeta clinic_id del contexto

**PUT /api/supplies/[id]**
- Verifica que el supply pertenece a la clínica
- Actualiza campos incluyendo updated_at
- Retorna con campo calculado

**DELETE /api/supplies/[id]**
- Verifica pertenencia a la clínica
- Elimina con validación multi-tenant

### 3. UI Mejorada
- Formulario con `react-hook-form` y `zodResolver`
- Dialog modal para crear/editar
- Validación en tiempo real con mensajes de error
- Preview en vivo del precio por porción
- Debounce de 300ms en búsqueda
- Estados de carga con spinner
- Confirmación antes de eliminar

### 4. i18n de Categorías
- Helper `getSupplyCategoryLabel()` para traducción dinámica
- Categorías traducidas EN/ES:
  - insumo → Supply/Insumo
  - bioseguridad → Biosafety/Bioseguridad
  - consumibles → Consumables/Consumibles
  - materiales → Materials/Materiales
  - medicamentos → Medicines/Medicamentos
  - equipos → Equipment/Equipos
  - otros → Other/Otros

### 5. Multi-tenant
- Todas las operaciones respetan clinic_id
- Cookie clinicId o primera clínica disponible
- Validación de pertenencia en PUT/DELETE
- Aislamiento completo entre clínicas

## Archivos Modificados
- `lib/types.ts` - Tipo Supply actualizado con categorías
- `lib/zod.ts` - Schemas zSupply y zSupplyForm
- `lib/format.ts` - Helper getSupplyCategoryLabel
- `messages/en.json` - Traducciones EN del formulario
- `messages/es.json` - Traducciones ES del formulario
- `app/api/supplies/[id]/route.ts` - Endpoints PUT y DELETE
- `app/supplies/page.tsx` - UI completa con CRUD

## UX Mejorada
- **Crear**: Botón "Add Supply" abre dialog con formulario
- **Editar**: Icono lápiz carga datos en el mismo dialog
- **Eliminar**: Icono basura con confirmación
- **Búsqueda**: Input con debounce automático
- **Validación**: Mensajes de error inline
- **Preview**: Cálculo en vivo del precio por porción
- **Estados**: Loading spinner durante operaciones

## Pruebas Manuales
```bash
cd web
npm run dev
```
1. Navegar a `/supplies`
2. Crear nuevo insumo con precio en pesos (ej: 850.50)
3. Verificar que se guarda correctamente en centavos
4. Editar y verificar que carga valores correctos
5. Buscar por nombre con debounce
6. Eliminar con confirmación
7. Cambiar de clínica y verificar aislamiento

## Criterios de Aceptación ✅
- [x] CRUD completo funcional
- [x] Categorías traducidas EN/ES
- [x] Precios mostrados con formatCurrency
- [x] price_pesos convertido a centavos
- [x] Multi-tenant respetado
- [x] Sin dependencias nuevas (solo shadcn/dialog)
- [x] TypeScript compila sin errores
- [x] Dev server funciona correctamente

## Riesgos y Rollback
- Riesgo mínimo, cambios aislados en módulo supplies
- Rollback: revertir archivos modificados
- La dependencia dialog es de shadcn/ui (ya usado)

## Siguientes Pasos
- Agregar toast notifications para feedback
- Implementar paginación si hay muchos insumos
- Agregar filtros por categoría
- Exportación a CSV/Excel