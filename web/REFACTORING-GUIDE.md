# 📋 Guía de Refactorización - Laralis

## 🎯 Objetivo
Migrar todo el código a una arquitectura DRY usando componentes reutilizables y hooks genéricos.

## ✅ Trabajo Completado

### 1. Componentes UI Reutilizables
- ✅ **FormModal** - Modal responsive mobile-first
- ✅ **DataTable** - Tabla de datos genérica  
- ✅ **PageHeader** - Header consistente
- ✅ **ConfirmDialog** - Diálogo de confirmación
- ✅ **ActionDropdown** - Menú de acciones
- ✅ **SummaryCards** - Tarjetas de resumen
- ✅ **FormSection/FormGrid** - Layout de formularios

### 2. Hooks Refactorizados
- ✅ **useCrudOperations** - CRUD genérico base
- ✅ **useApi** - Llamadas API simples
- ✅ **useServices** - Ahora usa useCrudOperations
- ✅ **useTreatments** - Ahora usa useCrudOperations  
- ✅ **usePatients** - Ahora usa useCrudOperations
- ✅ **useReports** - Ahora usa useParallelApi
- ✅ **useFixedCosts** - Ahora usa useCrudOperations

### 3. Layout Modularizado
- ✅ **AppLayout** dividido en:
  - Sidebar.tsx
  - UserMenu.tsx
  - MobileHeader.tsx
  - NavigationConfig.tsx

## 🚧 Trabajo Pendiente

### CRÍTICO - Eliminar fetch() directos

#### Hooks que necesitan migración:
```typescript
// ❌ ANTES (MAL)
const fetchSupplies = async () => {
  const response = await fetch('/api/supplies')
  const data = await response.json()
  setSupplies(data)
}

// ✅ DESPUÉS (BIEN)
const crud = useCrudOperations({
  endpoint: '/api/supplies',
  entityName: 'Supply'
})
```

**Archivos a migrar:**
- [ ] hooks/use-supplies.ts
- [ ] hooks/use-expenses.ts  
- [ ] hooks/use-time-settings.ts
- [ ] components/BusinessSwitcher.tsx
- [ ] components/expenses/expense-stats.tsx
- [ ] components/expenses/expense-alerts.tsx

### ALTO - Refactorizar páginas grandes

#### 1. services/page.tsx (525 líneas)
```typescript
// Dividir en:
- ServicesPage.tsx (componente principal)
- ServiceForm.tsx (formulario)
- SuppliesManager.tsx (gestión de supplies)
- useServicesPage.ts (lógica)
```

#### 2. expenses/page.tsx (496 líneas)
```typescript
// Dividir en:
- ExpensesPage.tsx
- ExpenseForm.tsx
- ExpenseStats.tsx
- useExpensesPage.ts
```

#### 3. patients/page.tsx (486 líneas)
```typescript
// Dividir en:
- PatientsPage.tsx
- PatientForm.tsx
- PatientReferrals.tsx
- usePatientsPage.ts
```

### MEDIO - Eliminar Repositories

Los repositories ya no son necesarios. Migrar toda la lógica a hooks:

```typescript
// ❌ ANTES
import { ServicesRepository } from '@/lib/repositories/services'
const data = await ServicesRepository.fetchServices()

// ✅ DESPUÉS
const { services, loading } = useServices()
```

**Repositories a eliminar:**
- [ ] lib/repositories/services.repository.ts
- [ ] lib/repositories/treatments.repository.ts
- [ ] lib/repositories/patients.repository.ts
- [ ] lib/repositories/fixed-costs.repository.ts
- [ ] lib/repositories/reports.repository.ts

## 🔄 Patrón de Migración

### Paso 1: Migrar página a componentes reutilizables

```typescript
// ❌ ANTES
export default function ServicesPage() {
  const [open, setOpen] = useState(false)
  const [services, setServices] = useState([])
  
  const fetchServices = async () => {
    const res = await fetch('/api/services')
    const data = await res.json()
    setServices(data)
  }
  
  return (
    <div>
      <Dialog open={open}>
        {/* Form custom */}
      </Dialog>
      <table>
        {/* Tabla custom */}
      </table>
    </div>
  )
}

// ✅ DESPUÉS
export default function ServicesPage() {
  const { services, loading, createService } = useServices()
  const [modalOpen, setModalOpen] = useState(false)
  
  return (
    <AppLayout>
      <PageHeader 
        title="Services"
        action={<Button onClick={() => setModalOpen(true)}>Add</Button>}
      />
      
      <DataTable
        columns={columns}
        data={services}
        loading={loading}
      />
      
      <FormModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        onSubmit={createService}
      >
        <ServiceForm />
      </FormModal>
    </AppLayout>
  )
}
```

### Paso 2: Migrar hook a useCrudOperations

```typescript
// ❌ ANTES
export function useServices() {
  const [services, setServices] = useState([])
  const [loading, setLoading] = useState(false)
  
  const fetchServices = async () => {
    setLoading(true)
    const res = await fetch('/api/services')
    const data = await res.json()
    setServices(data)
    setLoading(false)
  }
  
  const createService = async (data) => {
    const res = await fetch('/api/services', {
      method: 'POST',
      body: JSON.stringify(data)
    })
    if (res.ok) {
      fetchServices()
    }
  }
  
  return { services, loading, fetchServices, createService }
}

// ✅ DESPUÉS  
export function useServices() {
  const crud = useCrudOperations({
    endpoint: '/api/services',
    entityName: 'Service'
  })
  
  // Solo agregar lógica específica del dominio
  const calculateServiceCost = (service) => {
    // lógica específica
  }
  
  return {
    ...crud,
    services: crud.items,
    createService: crud.handleCreate,
    calculateServiceCost
  }
}
```

### Paso 3: Eliminar repository

```typescript
// Eliminar archivo repository completo
// Toda la lógica ya está en el hook
```

## 📏 Métricas de Éxito

### Antes de la refactorización:
- 📊 53 instancias de fetch() directo
- 📊 7 implementaciones CRUD duplicadas
- 📊 4 páginas > 400 líneas
- 📊 15+ repositories redundantes

### Objetivo después de refactorización:
- ✅ 0 fetch() directos (todo via hooks)
- ✅ 1 implementación CRUD (useCrudOperations)
- ✅ 0 páginas > 300 líneas
- ✅ 0 repositories (todo en hooks)

## 🛠️ Herramientas de Ayuda

### Para encontrar fetch() directos:
```bash
grep -r "fetch(" --include="*.ts" --include="*.tsx" --exclude-dir=node_modules
```

### Para encontrar archivos grandes:
```bash
find . -name "*.tsx" -exec wc -l {} \; | sort -rn | head -20
```

### Para verificar imports de repositories:
```bash
grep -r "from '@/lib/repositories" --include="*.ts" --include="*.tsx"
```

## 🎯 Checklist de Migración por Archivo

### Alta Prioridad
- [ ] Migrar hooks/use-supplies.ts
- [ ] Migrar hooks/use-expenses.ts
- [ ] Refactorizar services/page.tsx
- [ ] Refactorizar expenses/page.tsx
- [ ] Refactorizar patients/page.tsx

### Media Prioridad  
- [ ] Migrar BusinessSwitcher.tsx
- [ ] Migrar expense-stats.tsx
- [ ] Migrar expense-alerts.tsx
- [ ] Eliminar todos los repositories

### Baja Prioridad
- [ ] Optimizar bundle size
- [ ] Añadir más tests
- [ ] Documentar componentes

## 💡 Tips para Desarrolladores

1. **Siempre usar hooks genéricos primero**
   - Intenta usar `useCrudOperations` antes de crear lógica custom
   - Si necesitas algo específico, extiende el hook genérico

2. **No duplicar estado**
   - El estado debe vivir en UN solo lugar
   - Usa Context o props para compartir

3. **Componentes pequeños y enfocados**
   - Si un componente > 200 líneas, divídelo
   - Cada componente = 1 responsabilidad

4. **Lógica en hooks, no en componentes**
   - Componentes = presentación
   - Hooks = lógica de negocio

5. **Mobile-first siempre**
   - Diseña para móvil primero
   - Usa FormModal para todos los modales

## 📞 Soporte

Si tienes dudas durante la migración:
1. Revisa ARCHITECTURE.md
2. Mira ejemplos en hooks ya migrados
3. Consulta los componentes en /components/ui

---

*Última actualización: Agosto 2025*
*Progreso: 60% completado*