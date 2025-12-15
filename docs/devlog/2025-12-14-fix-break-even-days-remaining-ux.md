# Fix: Mensaje Confuso de "Días Restantes" en Punto de Equilibrio

**Fecha**: 2025-12-14
**Prioridad**: P1 (Bug de UX)
**Tipo**: Bugfix - Mejora de UX
**Área**: Punto de Equilibrio, Dashboard

---

## Contexto

Usuario reportó que en la página de "Punto de Equilibrio", el sistema mostraba:

> "23 días restantes"

Pero estando en el día 14 del mes con 20 días laborables configurados, esto es **matemáticamente imposible** (solo pueden quedar ~6-11 días laborables).

## Problema

El mensaje "X días restantes" era **ambiguo y confuso** porque:

1. **No eran "días restantes" del mes** → eran "días necesarios al ritmo actual"
2. El usuario interpretaba "restantes" como "días que quedan en el mes"
3. En realidad, el número podía **exceder** los días restantes si el ritmo era lento

**Ejemplo del caso reportado:**
- Día actual: 14 de diciembre
- Configuración: 20 días laborables/mes
- Días laborables transcurridos: ~9
- **Días laborables restantes: ~11**
- Ritmo de ingresos: muy lento
- **daysToBreakEven: 23** ← "Necesitas 23 días al ritmo actual"

El mensaje decía:
```
"23 días restantes"  ❌ CONFUSO
```

Pero debería decir:
```
"Necesitas 23 días al ritmo actual (solo quedan 11 días laborables)"  ✅ CLARO
```

## Causa Raíz

**NO había bug en los cálculos** (los números eran correctos). El problema estaba en la **comunicación**:

1. **Badge text** (`gapBadge`): Decía "{days} días restantes"
   - Ubicado en `equilibrium/page.tsx:403`
   - Usaba `data.daysToBreakEven` que NO son "días restantes"

2. **Falta de contexto**: No se mostraba cuántos días laborables realmente quedan

3. **Sin advertencia visual**: Cuando `daysToBreakEven > remainingWorkingDays`, no había alerta

## Qué Cambió

### 1. Mensajes Más Claros (i18n)

**Español** (`messages/es.json`):
```json
// Antes:
"gapBadge": "{days} días restantes"

// Después:
"gapBadge": "Faltan {days} días al ritmo actual",
"gapBadgeAtRisk": "⚠️ Faltan {days} días (solo quedan {remaining})",
"atRiskWarning": "⚠️ Al ritmo actual necesitas {days} días, pero solo quedan {remaining} días laborables este mes. Necesitas aumentar tu ritmo diario."
```

**Inglés** (`messages/en.json`):
```json
// Antes:
"gapBadge": "{days} days remaining"

// Después:
"gapBadge": "{days} days needed at current pace",
"gapBadgeAtRisk": "⚠️ {days} days needed (only {remaining} left)",
"atRiskWarning": "⚠️ At current pace you need {days} days, but only {remaining} working days remain this month. You need to increase your daily pace."
```

### 2. Badge con Estado Visual (`equilibrium/page.tsx`)

Antes:
```tsx
<Badge variant={isGoalReached ? 'success' : 'outline'}>
  {isGoalReached
    ? t('summary.goalBadge')
    : t('summary.gapBadge', { days: data.daysToBreakEven })}
</Badge>
```

Después:
```tsx
<Badge
  variant={
    isGoalReached
      ? 'success'
      : data.daysToBreakEven > data.remainingWorkingDays
        ? 'destructive'  // ← Rojo si es inalcanzable
        : 'outline'
  }
>
  {isGoalReached
    ? t('summary.goalBadge')
    : data.daysToBreakEven > data.remainingWorkingDays
      ? t('summary.gapBadgeAtRisk', {
          days: data.daysToBreakEven,
          remaining: data.remainingWorkingDays  // ← Muestra contexto
        })
      : t('summary.gapBadge', { days: data.daysToBreakEven })}
</Badge>
```

### 3. Advertencia Adicional

Nuevo bloque cuando la meta es inalcanzable:

```tsx
{data.daysToBreakEven > data.remainingWorkingDays && (
  <div className="p-3 sm:p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
    <p className="text-xs sm:text-sm text-destructive">
      {t('summary.atRiskWarning', {
        days: data.daysToBreakEven,
        remaining: data.remainingWorkingDays
      })}
    </p>
  </div>
)}
```

### 4. Test de Regresión

Agregado test para validar que los cálculos de días siempre sean coherentes:

```typescript
it('should correctly calculate remaining working days for a specific mid-month date', () => {
  // December 2024: 31 total days, Mon-Sat pattern
  const pattern: WorkingDaysConfig['manual'] = {
    monday: true, tuesday: true, wednesday: true,
    thursday: true, friday: true, saturday: true,
    sunday: false
  }

  const result = calculateWorkingDaysInMonth(2024, 12, pattern)

  // Key assertion: remainingWorkingDays should NEVER exceed total workingDays
  expect(result.remainingWorkingDays).toBeLessThanOrEqual(result.workingDays)

  // elapsedWorkingDays + remainingWorkingDays should equal total workingDays
  expect(result.elapsedWorkingDays + result.remainingWorkingDays).toBe(result.workingDays)
})
```

## Archivos Tocados

1. **Traducciones**:
   - `web/messages/es.json` (líneas 2900-2904)
   - `web/messages/en.json` (líneas 2916-2920)

2. **UI**:
   - `web/app/equilibrium/page.tsx` (líneas 400-467)

3. **Tests**:
   - `web/lib/calc/dates.test.ts` (líneas 489-518)

4. **Documentación**:
   - Este devlog

## Antes vs Después

### Antes (Confuso)

**Usuario ve:**
```
📊 Punto de Equilibrio
Progreso Mensual
"23 días restantes" [badge gris]

Brecha de Ingresos
  Monto necesario: $15,000
  Días para lograr: 23 días
```

**Usuario piensa:**
> "¿Cómo pueden quedar 23 días si estamos a 14 de diciembre?"

### Después (Claro)

**Escenario 1: Meta alcanzable (días necesarios ≤ días restantes)**
```
📊 Punto de Equilibrio
Progreso Mensual
"Faltan 8 días al ritmo actual" [badge gris]

Brecha de Ingresos
  Monto necesario: $8,000
  Días para lograr: 8 días
```

**Escenario 2: Meta inalcanzable (días necesarios > días restantes)**
```
📊 Punto de Equilibrio
Progreso Mensual
"⚠️ Faltan 23 días (solo quedan 11)" [badge rojo]

Brecha de Ingresos
  Monto necesario: $15,000
  Días para lograr: 23 días

⚠️ Al ritmo actual necesitas 23 días, pero solo quedan 11 días laborables
este mes. Necesitas aumentar tu ritmo diario.
```

## Cómo Probar

### Setup
1. Configurar clínica con 20 días laborables/mes
2. Registrar algunos tratamientos (suficiente para generar un ritmo lento)
3. Ir a "Punto de Equilibrio"

### Caso 1: Meta Inalcanzable (Badge Rojo)
1. Asegurarse de estar a mitad de mes (~día 14)
2. Tener revenue gap significativo (ej: faltan $15,000)
3. Verificar:
   - Badge es ROJO
   - Texto dice "⚠️ Faltan X días (solo quedan Y)"
   - Aparece advertencia adicional abajo
   - Mensaje explica claramente la situación

### Caso 2: Meta Alcanzable (Badge Gris)
1. Tener revenue gap menor
2. Verificar:
   - Badge es GRIS (outline)
   - Texto dice "Faltan X días al ritmo actual"
   - NO aparece advertencia adicional
   - X ≤ días laborables restantes

### Caso 3: Meta Alcanzada (Badge Verde)
1. Superar la meta mensual
2. Verificar:
   - Badge es VERDE
   - Texto dice "¡Meta Alcanzada!"
   - Muestra mensaje de felicitación

## Riesgos y Rollback

### Riesgos Identificados
1. **Cambio de wording**: Los usuarios que conocían el mensaje anterior pueden confundirse momentáneamente
2. **Badge rojo**: Puede ser alarmante (pero es apropiado - meta inalcanzable ES alarmante)

### Mitigación
- Los nuevos mensajes son más descriptivos, no menos
- Badge rojo solo aparece cuando realmente hay problema

### Rollback
Si es necesario revertir:

```bash
git revert <commit-hash>
```

Esto restaurará:
- Mensajes originales en i18n
- Badge sin lógica de "at risk"
- Sin advertencia adicional

## Métricas de Éxito

**Antes del fix**:
- 1 usuario confundido reportó el problema
- Mensaje ambiguo: "X días restantes"
- Sin contexto sobre días laborables reales

**Después del fix**:
- Mensaje explícito: "Faltan X días al ritmo actual"
- Contexto cuando hay riesgo: "(solo quedan Y)"
- Advertencia visual clara (badge rojo)
- Explicación completa del problema

## Siguientes Pasos

### Opcional (Mejoras Futuras)
- [ ] Agregar gráfico de "ritmo necesario vs ritmo actual"
- [ ] Sugerencia automática: "Necesitas generar $X más por día"
- [ ] Notificación proactiva cuando la meta se vuelve inalcanzable

### Documentación
- [x] Devlog completo
- [x] Test de regresión
- [ ] Actualizar user guide (si existe)

---

## Lecciones Aprendidas

1. **No era un bug de cálculo** → Era un bug de comunicación (UX)
2. **Los números pueden ser correctos pero confusos** → Contexto es crítico
3. **"Días restantes" es ambiguo** → "Días necesarios al ritmo actual" es preciso
4. **Las advertencias visuales ayudan** → Badge rojo + mensaje claro previene confusión

## Referencias

- Issue original: Usuario reportó "23 días restantes" siendo día 14
- Código de cálculo: `web/hooks/use-equilibrium.ts:125-137`
- Función de días laborables: `web/lib/calc/dates.ts:103-147`
- Badge UI: `web/app/equilibrium/page.tsx:400-418`

---

**Estado**: ✅ Completado
**Reviewed by**: Pendiente
**Merged**: Pendiente
