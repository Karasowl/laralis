# 🚨 EJECUTA EL SCRIPT 15 URGENTEMENTE

## Script: `15-fix-multiplication.sql`

Este script arregla:
1. ✅ **La multiplicación extra en fixed_costs** (divide TODOS entre 100)
2. ✅ **Agrega columna 'active' a services** (que falta y causa error)

## Después de ejecutar:

### 1. Reinicia el servidor
El servidor ya se está reiniciando automáticamente.

### 2. Prueba:

#### **Costos Fijos**
- Crea un costo de $1
- Debe guardarse como $1.00 (no $100)

#### **Servicios**
- Crea un nuevo servicio
- Debe funcionar sin error de columna 'active'
- Para ver el botón de insumos: 
  - Después de crear el servicio
  - En la lista, cada servicio tiene 3 botones
  - El PRIMERO (📦) es para agregar insumos
  - Click en ese botón

#### **Pacientes**
- Ya está arreglado el import de formatDate
- Intenta crear un paciente
- Si sigue sin funcionar, abre F12 > Console y comparte el error

## 📝 Notas importantes:

### Sobre Costos Fijos:
El problema es que el frontend envía correctamente en centavos (1 peso = 100 centavos), pero algo en la base de datos lo está multiplicando otra vez. El script 15 lo corrige dividiendo TODO entre 100.

### Sobre Servicios:
El botón de insumos (📦) aparece en la lista de servicios, NO en el formulario de crear/editar servicio.

### Sobre Pacientes:
Si sigue sin guardar después del reinicio, necesito ver el error exacto de la consola.