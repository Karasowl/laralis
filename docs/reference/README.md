# Documentos de Referencia

Este directorio contiene la documentación y archivos de referencia para el proyecto Laralis.

## Estructura

### Archivos de Referencia
- **`Consultorio-PoDent.xlsx`** - Hoja de cálculo original con fórmulas y datos de referencia
- **`csv/`** - Datos anonimizados exportados en formato CSV (cuando sea necesario)

## Uso de la Hoja de Referencia

La hoja `Consultorio-PoDent.xlsx` se utiliza para:

1. **Validar cálculos**: Comparar resultados del motor de cálculo con fórmulas originales
2. **Tests unitarios**: Verificar que los números coincidan con casos de ejemplo
3. **Documentación**: Entender la lógica de negocio original

## ⚠️ Importante - Privacidad

- **Nunca** subir datos personales de pacientes al repositorio
- **Solo** usar datos anonimizados o de ejemplo para testing
- **Exportar a CSV** solo información estructural (categorías, fórmulas, etc.)

## Datos de Ejemplo Usados

Los siguientes datos de la hoja se usan como casos de prueba:

### Depreciación
- **Inversión total**: $67,620 MXN (6,762,000 centavos)
- **Período**: 36 meses
- **Resultado**: $1,878.33 MXN/mes (187,833 centavos/mes)

### Configuración de Tiempo
- **Días laborables**: 20 días/mes
- **Horas por día**: 7 horas
- **Eficiencia**: 80% (0.8)
- **Minutos efectivos**: 6,720 min/mes

### Costos Fijos Mensuales
- **Total estimado**: $18,545.33 MXN (1,854,533 centavos)
- **Costo por minuto**: $2.76 MXN (276 centavos)

### Ejemplo de Servicio (Limpieza)
- **Duración**: 60 minutos  
- **Costo fijo**: $165.60 MXN (16,560 centavos)
- **Costo variable**: $33.18 MXN (3,318 centavos)
- **Margen**: 40%
- **Precio final**: $301.84 MXN (30,184 centavos)

## Acceso a la Hoja

La hoja original está disponible en el directorio del proyecto para el equipo de desarrollo. Para acceder desde el código:

```typescript
// Los valores están codificados en los tests como constantes
const SAMPLE_INVESTMENT_CENTS = 6_762_000;
const SAMPLE_MONTHS = 36;
const SAMPLE_MONTHLY_FIXED_CENTS = 1_854_533;
```

## Actualizaciones

Cuando se actualice la hoja de referencia:

1. Verificar que todos los tests sigan pasando
2. Actualizar constantes en tests si cambio valores de ejemplo  
3. Documentar cambios en el devlog
4. Actualizar este README con nuevos datos de referencia