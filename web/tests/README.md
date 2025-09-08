# 🧪 Sistema de Testing de Laralis

Este directorio contiene toda la suite de testing automatizado para Laralis, diseñada para asegurar que el aislamiento multi-tenant y toda la funcionalidad trabajen correctamente.

## 📋 Estructura de Testing

```
web/tests/
├── setup.ts                     # Configuración global de Vitest
├── calc/                        # Tests de motor de cálculos
│   └── integration.test.ts      # Tests de integración completa
├── api/                         # Tests de APIs
│   └── multitenancy.test.ts     # Tests críticos de multi-tenancy
├── thunder-client/              # Colecciones de Thunder Client
│   └── laralis-api-tests.json   # Tests de API completos
└── README.md                    # Esta documentación

cypress/
├── e2e/                         # Tests End-to-End
│   └── multitenancy.cy.ts       # Tests E2E de aislamiento
├── support/                     # Utilidades de Cypress
│   ├── commands.ts              # Comandos personalizados
│   └── e2e.ts                   # Configuración E2E
└── fixtures/                    # Datos de prueba
```

## 🚀 Comandos de Testing

### Tests Unitarios
```bash
# Tests del motor de cálculos únicamente
npm run test:unit

# Tests de integración del motor
npm run test:integration

# Watching mode para desarrollo
npm run test:watch
```

### Tests de API e Integración
```bash
# Tests de APIs (incluyendo multi-tenancy)
npm run test:api

# Tests específicos de multi-tenancy
npm run test:multitenancy

# Tests con coverage
npm run test:coverage
```

### Tests End-to-End con Cypress
```bash
# Ejecutar todos los tests E2E
npm run test:e2e

# Abrir interfaz interactiva de Cypress
npm run test:e2e:open

# Tests específicos de multi-tenancy E2E
npm run test:e2e:multitenancy
```

### Suite Completa
```bash
# Ejecutar TODOS los tests
npm run test:all
```

## 🔒 Tests de Multi-Tenancy

Los tests de multi-tenancy son **CRÍTICOS** y verifican:

### ✅ Aislamiento de Datos
- Los usuarios solo ven datos de sus clínicas
- Cambio de clínica actualiza los datos mostrados
- Prevención de acceso cruzado via URL manipulation

### ✅ Autenticación y Autorización
- APIs requieren autenticación válida
- Contexto de clínica es obligatorio
- Validación de permisos por workspace

### ✅ Integridad de Datos
- Escrituras incluyen `clinic_id` correcto
- Lecturas filtran por `clinic_id`
- Relaciones respetan aislamiento

## 📊 Motor de Cálculos

Los tests del motor verifican:

### ✅ Cálculos Individuales
- Costo por minuto basado en costos fijos
- Costo variable de servicios
- Precios con márgenes
- Punto de equilibrio

### ✅ Integración Completa
- Flujo completo de cálculos
- Consistencia entre módulos
- Escenarios reales de uso

## 🌩️ Thunder Client

La colección incluye:

### ✅ Tests de Autenticación
- Login de usuarios
- Manejo de tokens
- Contexto de clínicas

### ✅ Tests de APIs
- CRUD de pacientes
- Gestión de servicios
- Marketing platforms/campaigns

### ✅ Tests de Seguridad
- Acceso no autorizado
- Prevención de cross-clinic access
- Validación de permisos

## 🎯 Cypress E2E

Los tests E2E verifican:

### ✅ Flujos Completos de Usuario
- Creación de workspaces
- Cambio entre clínicas
- Gestión de datos

### ✅ Aislamiento Visual
- Datos se ocultan/muestran correctamente
- UI reacciona a cambios de contexto
- Prevención de manipulación de URLs

## 🚀 Configuración de Desarrollo

### 1. Setup Inicial
```bash
cd web
npm install
```

### 2. Variables de Entorno para Testing
```bash
# .env.test.local
NODE_ENV=test
NEXT_PUBLIC_SUPABASE_URL=https://test.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=test-anon-key
SUPABASE_SERVICE_ROLE_KEY=test-service-key
```

### 3. Ejecutar Tests en Desarrollo
```bash
# Modo watch para desarrollo activo
npm run test:watch

# Tests específicos
npm run test:multitenancy
```

## 📈 CI/CD Integration

### GitHub Actions (recomendado)
```yaml
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm run test:unit
      - run: npm run test:integration
      - run: npm run test:api
      - run: npm run test:e2e
```

## 🐛 Debugging Tests

### Vitest
```bash
# Debug con logs detallados
npm run test:watch -- --reporter=verbose

# Tests específicos
npm run test -- multitenancy.test.ts
```

### Cypress
```bash
# Modo interactivo para debugging
npm run test:e2e:open

# Con logs detallados
DEBUG=cypress:* npm run test:e2e
```

## 📝 Escribir Nuevos Tests

### Test Unitario
```typescript
// tests/calc/nueva-funcion.test.ts
import { describe, it, expect } from 'vitest';
import { nuevaFuncion } from '@/lib/calc/nueva-funcion';

describe('Nueva Función', () => {
  it('debe calcular correctamente', () => {
    const resultado = nuevaFuncion(input);
    expect(resultado).toBe(esperado);
  });
});
```

### Test de API
```typescript
// tests/api/nueva-api.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mockSupabaseClient } from '../setup';

describe('Nueva API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  
  it('debe validar multi-tenancy', async () => {
    // Setup mocks
    // Ejecutar API
    // Verificar aislamiento
  });
});
```

### Test E2E
```typescript
// cypress/e2e/nueva-funcionalidad.cy.ts
describe('Nueva Funcionalidad', () => {
  it('debe trabajar end-to-end', () => {
    cy.login('user@test.com', 'password');
    cy.visit('/nueva-pagina');
    cy.get('[data-testid="elemento"]').should('be.visible');
  });
});
```

## 🏆 Best Practices

### ✅ Tests de Multi-Tenancy
- Siempre verificar `clinic_id` en responses
- Probar acceso cruzado entre clínicas
- Validar autenticación en todos los endpoints

### ✅ Tests del Motor de Cálculos
- Usar escenarios reales de clínicas
- Verificar consistencia entre módulos
- Incluir casos edge (cero, negativos)

### ✅ Tests E2E
- Usar `data-testid` para elementos
- Limpiar datos entre tests
- Verificar flujos completos de usuario

### ✅ Mantenimiento
- Actualizar tests con nuevas features
- Revisar coverage regularmente
- Documentar casos especiales

## 🆘 Solución de Problemas

### Tests Fallan Localmente
1. Verificar variables de entorno
2. Limpiar node_modules y reinstalar
3. Revisar versiones de dependencias

### Tests E2E Lentos
1. Usar `cy.intercept()` para mockear APIs
2. Limitar alcance de tests
3. Ejecutar en paralelo si es posible

### Coverage Bajo
1. Identificar funciones sin coverage
2. Agregar tests específicos
3. Revisar ramas condicionales

---

**🎯 Objetivo:** Mantener **100% de confianza** en que el aislamiento multi-tenant funciona correctamente en producción.
