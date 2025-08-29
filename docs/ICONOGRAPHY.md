# Sistema de Iconografía - Laralis

Este documento define el sistema de iconografía estándar para la aplicación Laralis.
Todos los iconos provienen de la librería **lucide-react** para mantener consistencia.

## Principios de Diseño

1. **Consistencia**: Usar siempre el mismo icono para la misma función
2. **Claridad**: Los iconos deben ser intuitivos y fáciles de entender
3. **Tamaño estándar**: 
   - Navegación: `h-5 w-5`
   - Botones pequeños: `h-4 w-4`
   - Headers: `h-6 w-6`
   - Ilustraciones vacías: `h-8 w-8`

## Iconografía por Módulo

### Navegación Principal

| Módulo | Icono | Import | Uso |
|--------|-------|--------|-----|
| Dashboard | `LayoutDashboard` | `from 'lucide-react'` | Vista principal y métricas |
| Pacientes | `Users` | `from 'lucide-react'` | Gestión de pacientes |
| Tratamientos | `Activity` | `from 'lucide-react'` | Registro de tratamientos |
| Gastos | `Receipt` | `from 'lucide-react'` | Control de gastos |
| Reportes | `FileText` | `from 'lucide-react'` | Reportes y análisis |
| Punto de Equilibrio | `ChartBar` | `from 'lucide-react'` | Análisis financiero |
| Insumos | `Package` | `from 'lucide-react'` | Inventario de materiales |
| Servicios | `Briefcase` | `from 'lucide-react'` | Catálogo de servicios |
| Activos | `Wrench` | `from 'lucide-react'` | Gestión de equipos |
| Costos Fijos | `Calculator` | `from 'lucide-react'` | Gastos recurrentes |
| Configuración | `Settings` | `from 'lucide-react'` | Ajustes del sistema |

### Acciones Comunes

| Acción | Icono | Import | Uso |
|--------|-------|--------|-----|
| Agregar | `Plus` | `from 'lucide-react'` | Crear nuevo registro |
| Editar | `Edit` / `Pencil` | `from 'lucide-react'` | Modificar registro |
| Eliminar | `Trash2` | `from 'lucide-react'` | Borrar registro |
| Guardar | `Save` | `from 'lucide-react'` | Guardar cambios |
| Cancelar | `X` | `from 'lucide-react'` | Cancelar acción |
| Buscar | `Search` | `from 'lucide-react'` | Búsqueda |
| Filtrar | `Filter` | `from 'lucide-react'` | Aplicar filtros |
| Descargar | `Download` | `from 'lucide-react'` | Exportar datos |
| Subir | `Upload` | `from 'lucide-react'` | Importar datos |
| Refrescar | `RefreshCw` | `from 'lucide-react'` | Actualizar datos |

### Estados y Notificaciones

| Estado | Icono | Import | Uso |
|--------|-------|--------|-----|
| Éxito | `CheckCircle` | `from 'lucide-react'` | Operación exitosa |
| Error | `XCircle` | `from 'lucide-react'` | Error o fallo |
| Advertencia | `AlertTriangle` | `from 'lucide-react'` | Advertencia |
| Información | `Info` | `from 'lucide-react'` | Información general |
| Cargando | `Loader2` | `from 'lucide-react'` | Estado de carga (con animación) |

### Indicadores de Tendencia

| Indicador | Icono | Import | Uso |
|--------|-------|--------|-----|
| Aumento | `ArrowUp` | `from 'lucide-react'` | Tendencia positiva |
| Disminución | `ArrowDown` | `from 'lucide-react'` | Tendencia negativa |
| Tendencia | `TrendingUp` | `from 'lucide-react'` | Gráfico de tendencia |
| Estable | `Minus` | `from 'lucide-react'` | Sin cambios |

### UI/UX

| Elemento | Icono | Import | Uso |
|--------|-------|--------|-----|
| Menú móvil | `Menu` | `from 'lucide-react'` | Abrir menú móvil |
| Cerrar menú | `X` | `from 'lucide-react'` | Cerrar menú móvil |
| Colapsar izquierda | `ChevronLeft` | `from 'lucide-react'` | Colapsar sidebar |
| Expandir derecha | `ChevronRight` | `from 'lucide-react'` | Expandir sidebar |
| Tema oscuro | `Moon` | `from 'lucide-react'` | Activar modo oscuro |
| Tema claro | `Sun` | `from 'lucide-react'` | Activar modo claro |
| Idioma | `Globe` | `from 'lucide-react'` | Cambiar idioma |
| Usuario | `User` | `from 'lucide-react'` | Perfil de usuario |
| Cerrar sesión | `LogOut` | `from 'lucide-react'` | Salir del sistema |

### Módulos Específicos

#### Marketing
| Función | Icono | Import | Uso |
|--------|-------|--------|-----|
| Campañas | `Megaphone` | `from 'lucide-react'` | Gestión de campañas |
| ROI | `DollarSign` | `from 'lucide-react'` | Retorno de inversión |

#### Clínicas
| Función | Icono | Import | Uso |
|--------|-------|--------|-----|
| Workspace | `Building2` | `from 'lucide-react'` | Espacio de trabajo |
| Clínica | `Building` | `from 'lucide-react'` | Clínica individual |

#### Tiempo
| Función | Icono | Import | Uso |
|--------|-------|--------|-----|
| Horario | `Clock` | `from 'lucide-react'` | Configuración de tiempo |
| Calendario | `Calendar` | `from 'lucide-react'` | Vista de calendario |

## Colores de Iconos

### Por contexto
- **Navegación activa**: `text-primary`
- **Navegación inactiva**: `text-foreground/70`
- **Hover**: `text-foreground`
- **Acciones positivas**: `text-emerald-600`
- **Acciones negativas**: `text-red-600`
- **Neutro/Información**: `text-muted-foreground`

### En cards de métricas
- Usar gradientes para fondos de contenedores de iconos
- Ejemplo: `bg-gradient-to-r from-blue-500 to-blue-600`

## Animaciones

- **Hover en navegación**: `scale-110` con `transition-all duration-200`
- **Loading spinner**: `animate-spin` en `Loader2`
- **Entrada de elementos**: `animate-in fade-in-0 duration-200`

## Ejemplo de Implementación

```tsx
import { 
  Users, 
  Activity, 
  TrendingUp,
  ArrowUp 
} from 'lucide-react';

// Navegación
<Users className="h-5 w-5 text-primary" />

// Indicador de tendencia
<ArrowUp className="h-3 w-3 text-emerald-500" />

// Loading
<Loader2 className="h-4 w-4 animate-spin" />

// Card header
<Activity className="h-6 w-6 text-white" />
```

## Mantenimiento

Este documento debe actualizarse cuando:
1. Se agregue un nuevo módulo
2. Se cambie un icono existente
3. Se agreguen nuevas funcionalidades

Última actualización: 2025-08-22