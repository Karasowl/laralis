# Sistema de Diseño - Laralis Dental Manager

## 🎨 Principios de Diseño

### Estilo Visual
- **Inspiración**: Diseño estilo Apple - limpio, minimalista, premium
- **Espaciado**: Generoso (p-6 para cards, space-y-6 para secciones)
- **Bordes**: Radius suave (rounded-lg para cards, rounded-md para botones)
- **Sombras**: Sutiles (shadow-sm por defecto)
- **Colores**: Palette neutral con acentos azules

## 🔘 Botones Estándar

### Acciones en Tablas/Listas

#### Patrón Preferido: Dropdown Menu (Más limpio y escalable)
```tsx
import { MoreHorizontal, Eye, Edit, Trash2 } from 'lucide-react'
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

// En la columna de acciones:
<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <Button variant="ghost" size="sm">
      <MoreHorizontal className="h-4 w-4" />
    </Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent align="end">
    <DropdownMenuItem onClick={() => handleView(item)}>
      <Eye className="h-4 w-4 mr-2" />
      Ver detalles
    </DropdownMenuItem>
    <DropdownMenuItem onClick={() => handleEdit(item)}>
      <Edit className="h-4 w-4 mr-2" />
      Editar
    </DropdownMenuItem>
    <DropdownMenuItem 
      className="text-destructive"
      onClick={() => handleDelete(item.id)}
    >
      <Trash2 className="h-4 w-4 mr-2" />
      Eliminar
    </DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>
```

#### Alternativa: Botones Inline (Para 2 acciones máximo)
```tsx
<div className="flex items-center gap-2">
  <Button 
    variant="ghost" 
    size="sm"
    onClick={() => handleEdit(item)}
  >
    <Edit className="h-4 w-4" />
  </Button>
  <Button 
    variant="ghost" 
    size="sm"
    onClick={() => handleDelete(item.id)}
    className="hover:text-destructive"
  >
    <Trash2 className="h-4 w-4" />
  </Button>
</div>
```

### Variantes de Botón

#### Principal (CTA)
```tsx
<Button>
  <Plus className="h-4 w-4 mr-2" />
  Nuevo Registro
</Button>
```

#### Secundario
```tsx
<Button variant="outline">
  <Filter className="h-4 w-4 mr-2" />
  Filtrar
</Button>
```

#### Destructivo
```tsx
<Button variant="destructive">
  <Trash2 className="h-4 w-4 mr-2" />
  Eliminar
</Button>
```

#### Ghost (Acciones sutiles)
```tsx
<Button variant="ghost" size="sm">
  <Edit className="h-4 w-4" />
</Button>
```

## 🗂️ Iconos Estándar

### CRUD Operations
- **Crear**: `Plus` de lucide-react
- **Ver**: `Eye` de lucide-react
- **Editar**: `Edit` (lápiz) de lucide-react
- **Eliminar**: `Trash2` de lucide-react
- **Más opciones**: `MoreHorizontal` (3 puntos) de lucide-react
- **Más vertical**: `MoreVertical` de lucide-react

### Navegación
- **Volver**: `ChevronLeft` de lucide-react
- **Siguiente**: `ChevronRight` de lucide-react
- **Expandir**: `ChevronDown` de lucide-react
- **Cerrar**: `X` de lucide-react

### Estados
- **Éxito**: `CheckCircle` de lucide-react
- **Error**: `AlertCircle` de lucide-react
- **Advertencia**: `AlertTriangle` de lucide-react
- **Info**: `Info` de lucide-react
- **Cargando**: `Loader2` con clase `animate-spin`

### Módulos Específicos
- **Pacientes**: `Users` de lucide-react
- **Tratamientos**: `Activity` de lucide-react
- **Insumos**: `Package` de lucide-react
- **Servicios**: `Briefcase` de lucide-react
- **Gastos**: `Receipt` de lucide-react
- **Reportes**: `FileText` de lucide-react
- **Configuración**: `Settings` de lucide-react
- **Dashboard**: `LayoutDashboard` de lucide-react

## 📋 Tablas

### Estructura Estándar
```tsx
<Card className="p-6">
  {/* Header con título y acción principal */}
  <div className="flex items-center justify-between mb-6">
    <h2 className="text-lg font-semibold">Título</h2>
    <Button>
      <Plus className="h-4 w-4 mr-2" />
      Nuevo
    </Button>
  </div>

  {/* Filtros */}
  <div className="flex gap-4 mb-6">
    <Input placeholder="Buscar..." />
    <Select>...</Select>
  </div>

  {/* Tabla o Empty State */}
  {data.length === 0 ? (
    <EmptyState
      icon={<IconoModulo className="h-8 w-8" />}
      title="No hay registros"
      description="Descripción helpful"
      action={<Button>Crear primero</Button>}
    />
  ) : (
    <DataTable ... />
  )}
</Card>
```

## 🎯 Estados Hover

### Botones
- **Default**: `hover:bg-accent hover:text-accent-foreground`
- **Ghost**: `hover:bg-accent hover:text-accent-foreground`
- **Destructive en Ghost**: `hover:text-destructive hover:bg-destructive/10`
- **Outline**: `hover:bg-accent hover:text-accent-foreground`

### Filas de Tabla
```tsx
<TableRow className="hover:bg-muted/50 cursor-pointer">
```

### Cards Clickeables
```tsx
<Card className="hover:shadow-md transition-shadow cursor-pointer">
```

## 📐 Espaciado

### Containers
- **Page wrapper**: `className="space-y-6"`
- **Card padding**: `className="p-6"`
- **Section spacing**: `className="space-y-4"`
- **Inline elements**: `className="gap-2"` o `className="gap-4"`

### Grids
- **2 columnas**: `className="grid grid-cols-1 md:grid-cols-2 gap-6"`
- **3 columnas**: `className="grid grid-cols-1 md:grid-cols-3 gap-6"`
- **4 columnas**: `className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"`

## 🌈 Colores Semánticos

### Estados
- **Success**: `text-green-600` o `bg-green-100`
- **Error**: `text-destructive` o `bg-destructive/10`
- **Warning**: `text-amber-600` o `bg-amber-100`
- **Info**: `text-blue-600` o `bg-blue-100`

### Prioridades
- **Alta**: `variant="destructive"`
- **Media**: `variant="default"`
- **Baja**: `variant="secondary"`

## 📱 Responsive

### Breakpoints
- **sm**: 640px
- **md**: 768px
- **lg**: 1024px
- **xl**: 1280px

### Patrones Comunes
```tsx
// Ocultar en móvil
className="hidden md:block"

// Stack en móvil, row en desktop
className="flex flex-col md:flex-row gap-4"

// Grid responsive
className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
```

## ✅ Checklist de Implementación

Al crear o actualizar un módulo:

1. [ ] Usar DropdownMenu para acciones en tablas (>2 acciones)
2. [ ] Iconos consistentes de lucide-react
3. [ ] EmptyState cuando no hay datos
4. [ ] Variantes de botón apropiadas
5. [ ] Hover states correctos
6. [ ] Espaciado consistente (p-6, space-y-6)
7. [ ] Responsive design
8. [ ] Loading states con Skeleton
9. [ ] Mensajes de error/éxito con toast
10. [ ] Confirmación antes de eliminar

## 🚫 Evitar

- Mezclar estilos de botones (outline vs ghost)
- Iconos inconsistentes para la misma acción
- Diferentes patrones de hover
- Espaciado inconsistente
- Acciones sin confirmación
- Tablas sin EmptyState
- Formularios sin validación
- Cards sin padding consistente