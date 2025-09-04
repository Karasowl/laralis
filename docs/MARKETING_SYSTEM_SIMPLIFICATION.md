# 🎯 Simplificación del Sistema de Marketing - Guía de Implementación

## 📋 Resumen del Cambio

Hemos simplificado el sistema de origen de pacientes para eliminar duplicaciones y confusión entre vías de llegada, plataformas y campañas.

### Antes (Confuso)
- **Vía de llegada**: Mezclaba conceptos (Campaña, Facebook, Google, Referido, etc.)
- **Plataforma**: Separada pero redundante con vías
- **Campaña**: Requería plataforma pero competía con vías

### Después (Simplificado)
Solo 4 vías principales con campos condicionales:

1. **📢 Campaña Publicitaria** → Seleccionar campaña (que ya tiene plataforma)
2. **👥 Referido por Paciente** → Seleccionar paciente que refirió
3. **🌐 Orgánico** → Seleccionar plataforma (Facebook, Instagram, Google, etc.)
4. **🚶 Directo** → Visita directa o llamada (sin campos adicionales)

## 🚀 Pasos de Implementación

### Paso 1: Ejecutar Script SQL en Supabase

1. Abre el panel de Supabase
2. Ve a **SQL Editor**
3. Copia y ejecuta el contenido de: `scripts/32-simplify-marketing-system.sql`

Este script:
- ✅ Hace backup de datos actuales
- ✅ Actualiza las vías de llegada a solo 4 opciones
- ✅ Agrega campo `platform_id` a patients para casos orgánicos
- ✅ Migra datos existentes automáticamente
- ✅ Crea validaciones para mantener consistencia

### Paso 2: Actualizar el Frontend

Los archivos ya están actualizados:
- `app/patients/components/PatientFormNew.tsx` - Nuevo componente con flujo condicional
- `messages/es.json` y `messages/en.json` - Traducciones actualizadas

Para activar el nuevo formulario, necesitas:

1. Importar el nuevo componente en `PatientForm.tsx`
2. Reemplazar la sección de marketing con el nuevo componente

### Paso 3: Verificar la Migración

Después de ejecutar el script SQL, verifica:

```sql
-- Ver las nuevas vías de llegada
SELECT * FROM categories 
WHERE entity_type = 'patient_source' 
AND is_system = true
ORDER BY display_order;

-- Verificar que los pacientes existentes se migraron correctamente
SELECT 
    p.first_name,
    p.last_name,
    src.display_name as via_llegada,
    mc.name as campaña,
    ref.first_name || ' ' || ref.last_name as referido_por,
    plat.display_name as plataforma
FROM patients p
LEFT JOIN categories src ON p.source_id = src.id
LEFT JOIN marketing_campaigns mc ON p.campaign_id = mc.id
LEFT JOIN patients ref ON p.referred_by_patient_id = ref.id
LEFT JOIN categories plat ON p.platform_id = plat.id
LIMIT 10;
```

## 📊 Beneficios del Nuevo Sistema

1. **Claridad**: No más confusión entre conceptos
2. **Flexibilidad**: Campos condicionales según la vía
3. **Reportes Mejorados**: Vista `patient_acquisition_report` para análisis
4. **Validación Automática**: Trigger que asegura consistencia de datos
5. **Migración Segura**: Datos existentes preservados y mapeados

## 🔍 Flujo de Usuario

### Al registrar un nuevo paciente:

1. **Selecciona "¿Cómo conoció la clínica?"**
   - Solo 4 opciones claras

2. **Según la selección, aparecen campos específicos:**
   - **Campaña** → Lista de campañas activas
   - **Referido** → Lista de pacientes existentes
   - **Orgánico** → Lista de plataformas (Facebook, Instagram, etc.)
   - **Directo** → Sin campos adicionales

3. **Resumen visual** que confirma la selección

## ⚠️ Notas Importantes

- Los datos existentes NO se pierden, se migran automáticamente
- El trigger de validación asegura que los campos correctos se llenen según la vía
- La vista `patient_acquisition_report` facilita los reportes de marketing

## 🐛 Troubleshooting

Si hay errores al ejecutar el SQL:
1. Verifica que tengas permisos de admin en Supabase
2. Ejecuta el script por secciones si es necesario
3. El backup está en `_backup_patient_sources` por si necesitas revertir

## 📈 Reportes

Usa la nueva vista para reportes:

```sql
-- Pacientes por vía de llegada
SELECT 
    source_type,
    COUNT(*) as total,
    COUNT(*) * 100.0 / SUM(COUNT(*)) OVER() as porcentaje
FROM patient_acquisition_report
GROUP BY source_type
ORDER BY total DESC;

-- Campañas más efectivas
SELECT 
    campaign_name,
    platform_name,
    COUNT(*) as pacientes_generados
FROM patient_acquisition_report
WHERE source_key = 'campaign'
GROUP BY campaign_name, platform_name
ORDER BY pacientes_generados DESC;
```

---

**Fecha de implementación**: 2025-08-31
**Versión**: 1.0.0
**Autor**: Sistema Laralis