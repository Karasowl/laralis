# Sistema de Componentes Reutilizables

## Filosofía

Seguimos el principio **DRY (Don't Repeat Yourself)**. En lugar de duplicar código en cada página, creamos componentes centralizados que:
- Se reutilizan en toda la aplicación
- Mantienen consistencia visual
- Facilitan cambios globales
- Reducen el mantenimiento

## Arquitectura de Componentes

### 1. Componentes Base (Primitivos)
Ubicación: `components/ui/`

- **Button**: Botón con variantes y tamaños
- **Input**: Campo de entrada básico
- **Label**: Etiqueta para campos
- **Select**: Selector desplegable
- **Card**: Contenedor de contenido

### 2. Componentes Compuestos
Ubicación: `components/ui/`

#### FormModal
```tsx
import { FormModal } from '@/components/ui/form-modal';

// Uso básico
<FormModal
  open={isOpen}
  onOpenChange={setIsOpen}
  title="Agregar Paciente"
  description="Complete los datos del nuevo paciente"
  onSubmit={handleSubmit}
  isSubmitting={loading}
  cancelLabel="Cancelar"
  submitLabel="Guardar"
  maxWidth="lg"
>
  {/* Contenido del formulario */}
</FormModal>
```

#### FormField Components
```tsx
import { 
  InputField, 
  SelectField, 
  TextareaField,
  FormGrid,
  FormSection 
} from '@/components/ui/form-field';

// Campo de entrada
<InputField
  label="Nombre"
  value={name}
  onChange={setName}
  error={errors.name}
  required
/>

// Grid responsivo
<FormGrid columns={2}>
  <InputField label="Nombre" value={name} onChange={setName} />
  <InputField label="Email" type="email" value={email} onChange={setEmail} />
</FormGrid>

// Sección de formulario
<FormSection title="Información Personal">
  <FormGrid columns={2}>
    {/* campos */}
  </FormGrid>
</FormSection>
```

### 3. Componentes de Layout
Ubicación: `components/layouts/`

- **AppLayout**: Layout principal con sidebar
- **PageHeader**: Encabezado de página consistente
- **DataTable**: Tabla de datos reutilizable
- **EmptyState**: Estado vacío consistente

### 4. Componentes de Negocio
Ubicación: `components/[modulo]/`

Componentes específicos del dominio que reutilizan los componentes base:
- `components/patients/patient-form.tsx`
- `components/services/service-modal.tsx`
- `components/expenses/expense-dialog.tsx`

## Patrones de Uso

### 1. Modal de Formulario Estándar
```tsx
function MyPage() {
  const [isOpen, setIsOpen] = useState(false);
  const [formData, setFormData] = useState(initialData);
  
  return (
    <FormModal
      open={isOpen}
      onOpenChange={setIsOpen}
      title="Mi Formulario"
      onSubmit={handleSubmit}
      trigger={<Button>Abrir Modal</Button>}
    >
      <FormGrid columns={2}>
        <InputField
          label="Campo 1"
          value={formData.field1}
          onChange={(v) => setFormData({...formData, field1: v})}
        />
        <SelectField
          label="Campo 2"
          value={formData.field2}
          onChange={(v) => setFormData({...formData, field2: v})}
          options={options}
        />
      </FormGrid>
    </FormModal>
  );
}
```

### 2. Página con CRUD Completo
```tsx
function EntityPage() {
  return (
    <AppLayout>
      <div className="p-4 lg:p-8 max-w-[1600px] mx-auto space-y-6">
        <PageHeader
          title={t('entity.title')}
          subtitle={t('entity.subtitle')}
        />
        
        <Card>
          {data.length === 0 ? (
            <EmptyState
              icon={<Icon />}
              title={t('entity.empty')}
              action={<Button onClick={openModal}>Agregar</Button>}
            />
          ) : (
            <DataTable columns={columns} data={data} />
          )}
        </Card>
        
        <FormModal {...modalProps}>
          {/* Formulario */}
        </FormModal>
      </div>
    </AppLayout>
  );
}
```

## Ventajas del Sistema

1. **Mantenimiento Centralizado**: Un cambio en `FormModal` actualiza todos los modales
2. **Consistencia Visual**: Todos los formularios lucen y se comportan igual
3. **Responsive por Defecto**: Los componentes son mobile-first
4. **Accesibilidad Incorporada**: Labels, ARIA, focus management
5. **TypeScript**: Tipos seguros en toda la aplicación
6. **i18n Ready**: Integración con next-intl

## Migración de Código Existente

### Antes (Código Duplicado)
```tsx
// En cada página
<Dialog open={open} onOpenChange={setOpen}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Título</DialogTitle>
    </DialogHeader>
    <form onSubmit={handleSubmit}>
      <div className="space-y-4">
        <div>
          <Label>Campo</Label>
          <Input value={value} onChange={onChange} />
          {error && <p className="text-red-500">{error}</p>}
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline">Cancelar</Button>
        <Button type="submit">Guardar</Button>
      </DialogFooter>
    </form>
  </DialogContent>
</Dialog>
```

### Después (Componente Reutilizable)
```tsx
// Una sola línea importa todo
<FormModal
  open={open}
  onOpenChange={setOpen}
  title="Título"
  onSubmit={handleSubmit}
>
  <InputField label="Campo" value={value} onChange={onChange} error={error} />
</FormModal>
```

## Guías de Estilo

1. **Nombres Descriptivos**: `FormModal` no `Modal2` o `NewModal`
2. **Props Consistentes**: Usar mismos nombres en todos los componentes
3. **Defaults Sensatos**: Valores por defecto que funcionen en la mayoría de casos
4. **Composición sobre Herencia**: Componentes pequeños que se combinan
5. **Mobile First**: Diseñar para móvil, mejorar para desktop

## Próximos Pasos

1. Migrar todos los modales existentes a `FormModal`
2. Crear `TablePage` component para páginas CRUD
3. Implementar `FormProvider` para manejo de estado de formularios
4. Agregar `useForm` hook personalizado
5. Crear Storybook para documentación visual