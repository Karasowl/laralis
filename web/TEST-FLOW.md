# 🧪 FLUJO COMPLETO DE PRUEBAS - LARALIS

## 📌 CREDENCIALES DE PRUEBA
```
Email: isamelguimarais@gmail.com
Password: test123456
```
*Estas credenciales están guardadas en `cypress.env.json`*

## 🔄 FLUJO DE PRUEBAS E2E COMPLETO

### 1️⃣ **FASE 1: ONBOARDING (Primera vez)**
```bash
npm run test:e2e:onboarding
```
- Login con credenciales de prueba
- Crear workspace
- Configurar clínica principal
- Completar configuración inicial
- Verificar redirección al dashboard

### 2️⃣ **FASE 2: PRUEBAS DE MÓDULOS**
```bash
npm run test:e2e:full-app
```
Orden de pruebas:
1. **Configuración inicial**
   - Settings de tiempo
   - Costos fijos
   - Categorías

2. **Datos maestros**
   - Insumos (Supplies)
   - Servicios (Services)
   - Pacientes (Patients)

3. **Operaciones**
   - Tratamientos (Treatments)
   - Cálculos de precios
   - Snapshots históricos

4. **Marketing**
   - Plataformas
   - Campañas
   - Atribución de pacientes

5. **Reportes**
   - Punto de equilibrio
   - Dashboard
   - Exportaciones

6. **Multi-tenancy**
   - Crear segunda clínica
   - Cambiar entre clínicas
   - Verificar aislamiento de datos

### 3️⃣ **FASE 3: LIMPIEZA Y RESET**
```bash
npm run test:e2e:cleanup
```
- Eliminar todos los datos de prueba
- Eliminar workspace completo
- Verificar redirección a onboarding
- Listo para repetir desde Fase 1

## ⚠️ **LO QUE NO SE PUEDE PROBAR AUTOMÁTICAMENTE**
- **Registro de nuevo usuario** (requiere código de verificación de email)
- **Eliminación de cuenta** (requiere confirmación por email)
- **Reset de password** (requiere link de email)

*Estos flujos deben probarse manualmente*

## 🚀 **COMANDOS RÁPIDOS**

```bash
# Prueba completa desde cero
npm run test:from-scratch

# Solo pruebas con usuario existente
npm run test:existing-user

# Pruebas de desarrollo (sin onboarding)
npm run test:dev

# Limpiar todo y empezar de nuevo
npm run test:reset
```

## 📝 **SCRIPTS NPM NECESARIOS**

Agregar a `package.json`:
```json
{
  "scripts": {
    "test:e2e:onboarding": "cypress run --spec 'cypress/e2e/onboarding.cy.ts'",
    "test:e2e:full-app": "cypress run --spec 'cypress/e2e/full-app-flow.cy.ts'",
    "test:e2e:cleanup": "cypress run --spec 'cypress/e2e/cleanup.cy.ts'",
    "test:from-scratch": "npm run test:e2e:onboarding && npm run test:e2e:full-app && npm run test:e2e:cleanup",
    "test:existing-user": "npm run test:e2e:full-app",
    "test:reset": "npm run test:e2e:cleanup && npm run test:e2e:onboarding"
  }
}
```

## 🎯 **VERIFICACIONES CLAVE**

### Durante Onboarding:
- [ ] Login exitoso
- [ ] Formulario de workspace funciona
- [ ] Formulario de clínica funciona
- [ ] Configuración inicial se guarda
- [ ] Redirección correcta al completar

### Durante Uso Normal:
- [ ] Navegación funciona
- [ ] CRUD de cada módulo
- [ ] Cálculos correctos
- [ ] Multi-tenancy aislado
- [ ] Datos persisten
- [ ] Validaciones funcionan

### Durante Cleanup:
- [ ] Eliminación en cascada
- [ ] No quedan datos huérfanos
- [ ] Sesión se limpia
- [ ] Vuelve a onboarding

## 🔧 **DEBUGGING**

Si alguna prueba falla:
1. Verificar que el servidor esté corriendo: `npm run dev`
2. Verificar credenciales en `cypress.env.json`
3. Limpiar manualmente si es necesario:
   - Login en Supabase dashboard
   - Eliminar workspace del usuario de prueba
   - Volver a ejecutar desde onboarding

## 📊 **MÉTRICAS ESPERADAS**

- **Tiempo total**: ~5-7 minutos
- **Tests totales**: ~100+
- **Módulos cubiertos**: 10/10
- **Flujos críticos**: 15/15
- **Tasa de éxito esperada**: 95%+

---
*Última actualización: ${new Date().toISOString()}*