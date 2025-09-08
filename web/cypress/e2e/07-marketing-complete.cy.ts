/**
 * TESTS E2E COMPLETOS - MÓDULO DE MARKETING
 * Siguiendo principios TDD con casos reales y selectores semánticos
 */

describe('Marketing Module - Complete TDD Tests', () => {
  beforeEach(() => {
    // Login con usuario real
    cy.login(Cypress.env('TEST_EMAIL'), Cypress.env('TEST_PASSWORD'));
    cy.visit('/marketing');
  });

  describe('1. Dashboard de Marketing', () => {
    it('debe mostrar el dashboard con elementos correctos', () => {
      // Verificar encabezado
      cy.contains('h1', 'Marketing').should('be.visible');
      
      // Verificar tabs principales
      cy.get('button[role="tab"]').contains('Campañas').should('be.visible');
      cy.get('button[role="tab"]').contains('Plataformas').should('be.visible');
      cy.get('button[role="tab"]').contains('Análisis').should('be.visible');
      cy.get('button[role="tab"]').contains('ROI').should('be.visible');
      
      // Verificar métricas generales
      cy.contains('Inversión Total').should('be.visible');
      cy.contains('Pacientes Captados').should('be.visible');
      cy.contains('ROI General').should('be.visible');
      cy.contains('Costo por Paciente').should('be.visible');
    });

    it('debe mostrar gráficos de rendimiento', () => {
      cy.get('canvas#marketing-overview-chart').should('be.visible');
      cy.get('canvas#roi-trend-chart').should('be.visible');
      cy.get('canvas#conversion-funnel').should('be.visible');
    });

    it('debe mostrar período de análisis', () => {
      cy.get('select[name="period"]').should('be.visible');
      cy.get('select[name="period"]').should('contain', 'Este mes');
      cy.get('select[name="period"]').should('contain', 'Últimos 3 meses');
      cy.get('select[name="period"]').should('contain', 'Este año');
    });
  });

  describe('2. Gestión de Plataformas', () => {
    beforeEach(() => {
      cy.get('button[role="tab"]').contains('Plataformas').click();
    });

    it('debe mostrar plataformas predefinidas', () => {
      cy.contains('Facebook').should('be.visible');
      cy.contains('Instagram').should('be.visible');
      cy.contains('Google Ads').should('be.visible');
      cy.contains('TikTok').should('be.visible');
      cy.contains('Referidos').should('be.visible');
    });

    it('debe crear nueva plataforma personalizada', () => {
      cy.get('button').contains('Nueva Plataforma').click();
      
      cy.get('input[name="name"]').type('LinkedIn Ads');
      cy.get('textarea[name="description"]').type('Campañas B2B en LinkedIn');
      cy.get('input[name="color"]').type('#0077B5');
      cy.get('input[name="icon"]').type('linkedin');
      
      cy.get('button[type="submit"]').contains('Guardar').click();
      
      cy.contains('Plataforma creada exitosamente').should('be.visible');
      cy.contains('LinkedIn Ads').should('be.visible');
    });

    it('debe editar configuración de plataforma', () => {
      cy.contains('tr', 'Facebook').find('button[aria-label="Configurar"]').click();
      
      cy.get('input[name="tracking_enabled"]').check();
      cy.get('input[name="pixel_id"]').type('FB_PIXEL_123456');
      cy.get('input[name="api_token"]').type('fb_api_token_secret');
      
      cy.get('button[type="submit"]').contains('Guardar').click();
      
      cy.contains('Configuración actualizada').should('be.visible');
    });

    it('debe activar/desactivar plataforma', () => {
      cy.contains('tr', 'TikTok').find('input[type="checkbox"][name="active"]').uncheck();
      
      cy.contains('Plataforma desactivada').should('be.visible');
      cy.contains('tr', 'TikTok').should('have.class', 'inactive');
    });

    it('debe mostrar estadísticas por plataforma', () => {
      cy.contains('tr', 'Facebook').find('button[aria-label="Ver estadísticas"]').click();
      
      cy.contains('Estadísticas - Facebook').should('be.visible');
      cy.contains('Campañas activas').should('be.visible');
      cy.contains('Inversión total').should('be.visible');
      cy.contains('Pacientes captados').should('be.visible');
      cy.contains('Tasa de conversión').should('be.visible');
    });
  });

  describe('3. Creación de Campañas - Validaciones', () => {
    beforeEach(() => {
      cy.get('button[role="tab"]').contains('Campañas').click();
      cy.get('button').contains('Nueva Campaña').click();
    });

    it('debe validar campos requeridos', () => {
      cy.get('button[type="submit"]').contains('Guardar').click();
      
      cy.contains('El nombre es requerido').should('be.visible');
      cy.contains('La plataforma es requerida').should('be.visible');
      cy.contains('La fecha de inicio es requerida').should('be.visible');
      cy.contains('El presupuesto es requerido').should('be.visible');
    });

    it('debe validar fechas lógicas', () => {
      cy.get('input[name="name"]').type('Test');
      cy.get('select[name="platform_id"]').select('Facebook');
      cy.get('input[name="start_date"]').type('2025-01-20');
      cy.get('input[name="end_date"]').type('2025-01-19'); // Fecha fin antes de inicio
      cy.get('input[name="budget_cents"]').type('10000');
      
      cy.get('button[type="submit"]').contains('Guardar').click();
      
      cy.contains('La fecha de fin debe ser posterior a la de inicio').should('be.visible');
    });

    it('debe validar presupuesto positivo', () => {
      cy.get('input[name="name"]').type('Test');
      cy.get('select[name="platform_id"]').select('Facebook');
      cy.get('input[name="start_date"]').type('2025-01-20');
      cy.get('input[name="budget_cents"]').type('-1000');
      
      cy.get('button[type="submit"]').contains('Guardar').click();
      
      cy.contains('El presupuesto debe ser mayor a 0').should('be.visible');
    });

    it('debe validar objetivo numérico', () => {
      cy.get('input[name="name"]').type('Test');
      cy.get('select[name="platform_id"]').select('Facebook');
      cy.get('input[name="start_date"]').type('2025-01-20');
      cy.get('input[name="budget_cents"]').type('10000');
      cy.get('input[name="target_patients"]').type('-5');
      
      cy.get('button[type="submit"]').contains('Guardar').click();
      
      cy.contains('El objetivo debe ser mayor a 0').should('be.visible');
    });
  });

  describe('4. Creación de Campañas - Casos de Éxito', () => {
    beforeEach(() => {
      cy.get('button[role="tab"]').contains('Campañas').click();
    });

    it('debe crear campaña básica', () => {
      cy.get('button').contains('Nueva Campaña').click();
      
      cy.get('input[name="name"]').type('Campaña Enero 2025');
      cy.get('select[name="platform_id"]').select('Facebook');
      cy.get('input[name="start_date"]').type('2025-01-01');
      cy.get('input[name="end_date"]').type('2025-01-31');
      cy.get('input[name="budget_cents"]').type('50000'); // $500
      cy.get('input[name="target_patients"]').type('10');
      
      cy.get('button[type="submit"]').contains('Guardar').click();
      
      cy.contains('Campaña creada exitosamente').should('be.visible');
      cy.contains('Campaña Enero 2025').should('be.visible');
      cy.contains('$500.00').should('be.visible');
    });

    it('debe crear campaña con segmentación', () => {
      cy.get('button').contains('Nueva Campaña').click();
      
      cy.get('input[name="name"]').type('Campaña Ortodoncia');
      cy.get('select[name="platform_id"]').select('Instagram');
      cy.get('input[name="start_date"]').type('2025-02-01');
      cy.get('input[name="end_date"]').type('2025-02-28');
      cy.get('input[name="budget_cents"]').type('100000');
      
      // Configurar segmentación
      cy.get('button').contains('Configurar segmentación').click();
      cy.get('input[name="age_min"]').type('25');
      cy.get('input[name="age_max"]').type('45');
      cy.get('select[name="gender"]').select('all');
      cy.get('input[name="location"]').type('Ciudad de México');
      cy.get('input[name="interests"]').type('Salud dental{enter}Estética{enter}');
      
      cy.get('button[type="submit"]').contains('Guardar').click();
      
      cy.contains('Campaña creada exitosamente').should('be.visible');
    });

    it('debe crear campaña con creativos', () => {
      cy.get('button').contains('Nueva Campaña').click();
      
      cy.get('input[name="name"]').type('Campaña con Creativos');
      cy.get('select[name="platform_id"]').select('Google Ads');
      cy.get('input[name="start_date"]').type('2025-01-15');
      cy.get('input[name="budget_cents"]').type('75000');
      
      // Agregar creativos
      cy.get('button').contains('Agregar creativo').click();
      cy.get('input[name="creatives[0].name"]').type('Banner principal');
      cy.get('select[name="creatives[0].type"]').select('image');
      cy.get('input[name="creatives[0].url"]').type('https://example.com/banner.jpg');
      cy.get('textarea[name="creatives[0].copy"]').type('Sonrisa perfecta al mejor precio');
      
      cy.get('button[type="submit"]').contains('Guardar').click();
      
      cy.contains('Campaña creada exitosamente').should('be.visible');
    });

    it('debe crear campaña con UTM tracking', () => {
      cy.get('button').contains('Nueva Campaña').click();
      
      cy.get('input[name="name"]').type('Campaña con Tracking');
      cy.get('select[name="platform_id"]').select('Facebook');
      cy.get('input[name="start_date"]').type('2025-01-10');
      cy.get('input[name="budget_cents"]').type('30000');
      
      // Configurar UTM
      cy.get('input[type="checkbox"][name="enable_utm"]').check();
      cy.get('input[name="utm_source"]').should('have.value', 'facebook');
      cy.get('input[name="utm_medium"]').type('cpc');
      cy.get('input[name="utm_campaign"]').type('enero_2025');
      cy.get('input[name="utm_content"]').type('limpieza_dental');
      
      cy.get('button[type="submit"]').contains('Guardar').click();
      
      cy.contains('Campaña creada exitosamente').should('be.visible');
    });

    it('debe crear campaña recurrente', () => {
      cy.get('button').contains('Nueva Campaña').click();
      
      cy.get('input[name="name"]').type('Campaña Mensual');
      cy.get('select[name="platform_id"]').select('Instagram');
      cy.get('input[name="start_date"]').type('2025-01-01');
      cy.get('input[name="budget_cents"]').type('20000');
      
      cy.get('input[type="checkbox"][name="is_recurring"]').check();
      cy.get('select[name="recurrence_type"]').select('monthly');
      cy.get('input[name="recurrence_count"]').type('6'); // 6 meses
      
      cy.get('button[type="submit"]').contains('Guardar').click();
      
      cy.contains('Campaña recurrente creada').should('be.visible');
      cy.contains('Se crearán 6 campañas').should('be.visible');
    });
  });

  describe('5. Seguimiento de Resultados', () => {
    beforeEach(() => {
      // Crear campaña para seguimiento
      cy.get('button[role="tab"]').contains('Campañas').click();
      cy.get('button').contains('Nueva Campaña').click();
      cy.get('input[name="name"]').type('Campaña Test ROI');
      cy.get('select[name="platform_id"]').select('Facebook');
      cy.get('input[name="start_date"]').type('2025-01-01');
      cy.get('input[name="end_date"]').type('2025-01-31');
      cy.get('input[name="budget_cents"]').type('100000');
      cy.get('input[name="target_patients"]').type('20');
      cy.get('button[type="submit"]').contains('Guardar').click();
      cy.wait(1000);
    });

    it('debe registrar resultados de campaña', () => {
      cy.contains('tr', 'Campaña Test ROI').find('button[aria-label="Registrar resultados"]').click();
      
      cy.get('input[name="impressions"]').type('50000');
      cy.get('input[name="clicks"]').type('500');
      cy.get('input[name="conversions"]').type('15');
      cy.get('input[name="actual_spend_cents"]').type('95000');
      
      cy.get('button[type="submit"]').contains('Guardar').click();
      
      cy.contains('Resultados actualizados').should('be.visible');
      cy.contains('CTR: 1%').should('be.visible'); // 500/50000
      cy.contains('Conversión: 3%').should('be.visible'); // 15/500
    });

    it('debe calcular ROI automáticamente', () => {
      // Registrar resultados
      cy.contains('tr', 'Campaña Test ROI').find('button[aria-label="Registrar resultados"]').click();
      cy.get('input[name="conversions"]').type('10');
      cy.get('input[name="actual_spend_cents"]').type('100000');
      cy.get('button[type="submit"]').contains('Guardar').click();
      cy.wait(1000);
      
      // Registrar ingresos de pacientes
      cy.contains('tr', 'Campaña Test ROI').find('button[aria-label="Registrar pacientes"]').click();
      cy.get('input[name="patient_count"]').type('10');
      cy.get('input[name="total_revenue_cents"]').type('500000'); // $5000 en tratamientos
      cy.get('button[type="submit"]').contains('Guardar').click();
      
      // Verificar ROI
      cy.contains('tr', 'Campaña Test ROI').should('contain', 'ROI: 400%'); // (5000-1000)/1000
    });

    it('debe rastrear pacientes por campaña', () => {
      cy.contains('tr', 'Campaña Test ROI').find('button[aria-label="Ver pacientes"]').click();
      
      // Asociar paciente existente
      cy.get('button').contains('Asociar paciente').click();
      cy.get('select[name="patient_id"]').select(1); // Primer paciente
      cy.get('input[name="treatment_value_cents"]').type('50000');
      cy.get('button[type="submit"]').contains('Asociar').click();
      
      cy.contains('Paciente asociado').should('be.visible');
      cy.contains('1 paciente').should('be.visible');
      cy.contains('$500.00 generado').should('be.visible');
    });

    it('debe comparar resultado vs objetivo', () => {
      cy.contains('tr', 'Campaña Test ROI').find('button[aria-label="Registrar resultados"]').click();
      cy.get('input[name="conversions"]').type('25'); // Objetivo era 20
      cy.get('button[type="submit"]').contains('Guardar').click();
      
      cy.contains('125% del objetivo').should('be.visible');
      cy.get('[data-testid="goal-achieved"]').should('have.class', 'success');
    });

    it('debe mostrar costo por adquisición (CPA)', () => {
      cy.contains('tr', 'Campaña Test ROI').find('button[aria-label="Registrar resultados"]').click();
      cy.get('input[name="conversions"]').type('10');
      cy.get('input[name="actual_spend_cents"]').type('100000'); // $1000
      cy.get('button[type="submit"]').contains('Guardar').click();
      
      cy.contains('CPA: $100.00').should('be.visible'); // 1000/10
    });
  });

  describe('6. Análisis y Reportes', () => {
    beforeEach(() => {
      // Crear varias campañas con datos
      const campaigns = [
        { name: 'Facebook Q1', platform: 'Facebook', budget: '100000', conversions: 15 },
        { name: 'Instagram Q1', platform: 'Instagram', budget: '75000', conversions: 10 },
        { name: 'Google Q1', platform: 'Google Ads', budget: '150000', conversions: 25 }
      ];
      
      cy.get('button[role="tab"]').contains('Campañas').click();
      
      campaigns.forEach(campaign => {
        cy.get('button').contains('Nueva Campaña').click();
        cy.get('input[name="name"]').type(campaign.name);
        cy.get('select[name="platform_id"]').select(campaign.platform);
        cy.get('input[name="start_date"]').type('2025-01-01');
        cy.get('input[name="end_date"]').type('2025-03-31');
        cy.get('input[name="budget_cents"]').type(campaign.budget);
        cy.get('button[type="submit"]').contains('Guardar').click();
        cy.wait(500);
      });
      
      cy.get('button[role="tab"]').contains('Análisis').click();
    });

    it('debe mostrar análisis comparativo de campañas', () => {
      cy.contains('Análisis Comparativo').should('be.visible');
      
      // Tabla comparativa
      cy.get('table#comparison-table').should('be.visible');
      cy.contains('Facebook Q1').should('be.visible');
      cy.contains('Instagram Q1').should('be.visible');
      cy.contains('Google Q1').should('be.visible');
    });

    it('debe mostrar distribución de inversión', () => {
      cy.get('canvas#investment-distribution').should('be.visible');
      
      // Verificar leyenda
      cy.contains('Facebook: $1,000').should('be.visible');
      cy.contains('Instagram: $750').should('be.visible');
      cy.contains('Google Ads: $1,500').should('be.visible');
    });

    it('debe generar reporte de período', () => {
      cy.get('button').contains('Generar Reporte').click();
      
      cy.get('input[name="report_from"]').type('2025-01-01');
      cy.get('input[name="report_to"]').type('2025-03-31');
      cy.get('select[name="report_type"]').select('detailed');
      
      cy.get('button').contains('Generar').click();
      
      cy.contains('Reporte de Marketing Q1 2025').should('be.visible');
      cy.contains('Inversión total: $3,250').should('be.visible');
      cy.contains('Pacientes captados total').should('be.visible');
      cy.contains('ROI promedio').should('be.visible');
    });

    it('debe mostrar tendencias de conversión', () => {
      cy.get('button').contains('Tendencias').click();
      
      cy.get('canvas#conversion-trends').should('be.visible');
      cy.get('select[name="trend_metric"]').select('conversion_rate');
      
      // Verificar que se actualiza el gráfico
      cy.contains('Tasa de conversión en el tiempo').should('be.visible');
    });

    it('debe exportar análisis', () => {
      cy.get('button').contains('Exportar Análisis').click();
      
      cy.get('button').contains('Exportar PDF').click();
      cy.readFile('cypress/downloads/analisis-marketing.pdf').should('exist');
      
      cy.get('button').contains('Exportar Excel').click();
      cy.readFile('cypress/downloads/analisis-marketing.xlsx').should('exist');
    });
  });

  describe('7. ROI y Métricas Financieras', () => {
    beforeEach(() => {
      cy.get('button[role="tab"]').contains('ROI').click();
    });

    it('debe mostrar dashboard de ROI', () => {
      cy.contains('ROI Dashboard').should('be.visible');
      
      // Métricas principales
      cy.contains('ROI Global').should('be.visible');
      cy.contains('Mejor Campaña').should('be.visible');
      cy.contains('Peor Campaña').should('be.visible');
      cy.contains('Tendencia ROI').should('be.visible');
    });

    it('debe calcular lifetime value de pacientes', () => {
      cy.get('button').contains('Calcular LTV').click();
      
      cy.get('select[name="campaign_id"]').select(1);
      cy.get('input[name="months_to_calculate"]').type('12');
      
      cy.get('button').contains('Calcular').click();
      
      cy.contains('Lifetime Value Estimado').should('be.visible');
      cy.contains('Basado en historial de pacientes similares').should('be.visible');
    });

    it('debe mostrar matriz de rentabilidad', () => {
      cy.get('button').contains('Matriz de Rentabilidad').click();
      
      cy.get('canvas#profitability-matrix').should('be.visible');
      
      // Cuadrantes
      cy.contains('Alto ROI / Alto Volumen').should('be.visible');
      cy.contains('Alto ROI / Bajo Volumen').should('be.visible');
      cy.contains('Bajo ROI / Alto Volumen').should('be.visible');
      cy.contains('Bajo ROI / Bajo Volumen').should('be.visible');
    });

    it('debe proyectar ROI futuro', () => {
      cy.get('button').contains('Proyección ROI').click();
      
      cy.get('input[name="future_budget_cents"]').type('500000');
      cy.get('select[name="platform_id"]').select('Facebook');
      cy.get('input[name="projection_months"]').type('6');
      
      cy.get('button').contains('Proyectar').click();
      
      cy.contains('Proyección a 6 meses').should('be.visible');
      cy.contains('ROI esperado').should('be.visible');
      cy.contains('Pacientes proyectados').should('be.visible');
      cy.contains('Ingresos proyectados').should('be.visible');
    });

    it('debe recomendar optimizaciones', () => {
      cy.get('button').contains('Obtener Recomendaciones').click();
      
      cy.contains('Recomendaciones de Optimización').should('be.visible');
      cy.contains('Aumentar inversión en').should('be.visible');
      cy.contains('Reducir o pausar').should('be.visible');
      cy.contains('Mejorar creativos en').should('be.visible');
    });
  });

  describe('8. Gestión de Presupuesto', () => {
    beforeEach(() => {
      cy.get('button[role="tab"]').contains('Campañas').click();
    });

    it('debe establecer presupuesto mensual', () => {
      cy.get('button').contains('Configurar Presupuesto').click();
      
      cy.get('input[name="monthly_budget_cents"]').type('500000'); // $5000
      cy.get('input[name="alert_threshold"]').type('80'); // Alertar al 80%
      
      cy.get('button[type="submit"]').contains('Guardar').click();
      
      cy.contains('Presupuesto configurado').should('be.visible');
      cy.contains('Presupuesto mensual: $5,000').should('be.visible');
    });

    it('debe mostrar consumo de presupuesto', () => {
      // Configurar presupuesto
      cy.get('button').contains('Configurar Presupuesto').click();
      cy.get('input[name="monthly_budget_cents"]').type('500000');
      cy.get('button[type="submit"]').contains('Guardar').click();
      cy.wait(1000);
      
      // Crear campaña que consume presupuesto
      cy.get('button').contains('Nueva Campaña').click();
      cy.get('input[name="name"]').type('Campaña Consumo');
      cy.get('select[name="platform_id"]').select('Facebook');
      cy.get('input[name="start_date"]').type('2025-01-01');
      cy.get('input[name="budget_cents"]').type('200000'); // $2000
      cy.get('button[type="submit"]').contains('Guardar').click();
      
      // Verificar indicador de consumo
      cy.contains('40% del presupuesto consumido').should('be.visible');
      cy.get('[data-testid="budget-bar"]').should('have.attr', 'style').and('include', 'width: 40%');
    });

    it('debe alertar cuando se acerca al límite', () => {
      // Configurar presupuesto bajo
      cy.get('button').contains('Configurar Presupuesto').click();
      cy.get('input[name="monthly_budget_cents"]').type('100000'); // $1000
      cy.get('input[name="alert_threshold"]').type('80');
      cy.get('button[type="submit"]').contains('Guardar').click();
      cy.wait(1000);
      
      // Crear campaña que supera el threshold
      cy.get('button').contains('Nueva Campaña').click();
      cy.get('input[name="name"]').type('Campaña Alta');
      cy.get('select[name="platform_id"]').select('Facebook');
      cy.get('input[name="start_date"]').type('2025-01-01');
      cy.get('input[name="budget_cents"]').type('85000'); // $850 (85%)
      cy.get('button[type="submit"]').contains('Guardar').click();
      
      cy.contains('Alerta: 85% del presupuesto consumido').should('be.visible');
      cy.get('[data-testid="budget-alert"]').should('have.class', 'warning');
    });

    it('debe distribuir presupuesto entre plataformas', () => {
      cy.get('button').contains('Distribuir Presupuesto').click();
      
      cy.get('input[name="total_budget_cents"]').type('1000000'); // $10,000
      
      // Configurar distribución
      cy.get('input[name="facebook_percent"]').type('40');
      cy.get('input[name="instagram_percent"]').type('30');
      cy.get('input[name="google_percent"]').type('30');
      
      cy.get('button').contains('Vista previa').click();
      
      cy.contains('Facebook: $4,000').should('be.visible');
      cy.contains('Instagram: $3,000').should('be.visible');
      cy.contains('Google Ads: $3,000').should('be.visible');
      
      cy.get('button').contains('Aplicar Distribución').click();
      
      cy.contains('Presupuesto distribuido').should('be.visible');
    });
  });

  describe('9. Automatizaciones', () => {
    it('debe configurar reglas automáticas', () => {
      cy.get('button').contains('Automatizaciones').click();
      
      cy.get('button').contains('Nueva Regla').click();
      
      cy.get('input[name="rule_name"]').type('Pausar campaña de bajo rendimiento');
      cy.get('select[name="condition_type"]').select('roi');
      cy.get('select[name="condition_operator"]').select('less_than');
      cy.get('input[name="condition_value"]').type('50'); // ROI < 50%
      cy.get('select[name="action"]').select('pause_campaign');
      
      cy.get('button[type="submit"]').contains('Crear Regla').click();
      
      cy.contains('Regla creada').should('be.visible');
    });

    it('debe ejecutar reglas automáticamente', () => {
      // Crear regla
      cy.get('button').contains('Automatizaciones').click();
      cy.get('button').contains('Nueva Regla').click();
      cy.get('input[name="rule_name"]').type('Aumentar presupuesto alto ROI');
      cy.get('select[name="condition_type"]').select('roi');
      cy.get('select[name="condition_operator"]').select('greater_than');
      cy.get('input[name="condition_value"]').type('200');
      cy.get('select[name="action"]').select('increase_budget');
      cy.get('input[name="action_value"]').type('20'); // Aumentar 20%
      cy.get('button[type="submit"]').contains('Crear Regla').click();
      cy.wait(1000);
      
      // Ejecutar reglas manualmente
      cy.get('button').contains('Ejecutar Reglas Ahora').click();
      
      cy.contains('Reglas ejecutadas').should('be.visible');
      cy.contains('Acciones aplicadas').should('be.visible');
    });

    it('debe programar informes automáticos', () => {
      cy.get('button').contains('Automatizaciones').click();
      cy.get('button').contains('Programar Informe').click();
      
      cy.get('input[name="report_name"]').type('Informe Semanal Marketing');
      cy.get('select[name="frequency"]').select('weekly');
      cy.get('select[name="day_of_week"]').select('monday');
      cy.get('input[name="time"]').type('09:00');
      cy.get('input[name="recipients"]').type('marketing@clinica.com');
      
      cy.get('button[type="submit"]').contains('Programar').click();
      
      cy.contains('Informe programado').should('be.visible');
    });
  });

  describe('10. Integraciones', () => {
    it('debe configurar integración con Facebook Ads', () => {
      cy.get('button').contains('Integraciones').click();
      
      cy.contains('tr', 'Facebook Ads').find('button').contains('Configurar').click();
      
      cy.get('input[name="app_id"]').type('FB_APP_123');
      cy.get('input[name="app_secret"]').type('fb_secret_key');
      cy.get('input[name="access_token"]').type('fb_access_token');
      cy.get('input[name="ad_account_id"]').type('act_123456789');
      
      cy.get('button').contains('Probar Conexión').click();
      cy.contains('Conexión exitosa').should('be.visible');
      
      cy.get('button[type="submit"]').contains('Guardar').click();
      
      cy.contains('Integración configurada').should('be.visible');
    });

    it('debe sincronizar datos de campaña', () => {
      cy.get('button').contains('Integraciones').click();
      
      cy.contains('tr', 'Facebook Ads').find('button').contains('Sincronizar').click();
      
      cy.contains('Sincronizando...').should('be.visible');
      cy.contains('Sincronización completada', { timeout: 10000 }).should('be.visible');
      cy.contains('Campañas actualizadas').should('be.visible');
    });

    it('debe configurar webhook para conversiones', () => {
      cy.get('button').contains('Integraciones').click();
      cy.get('button').contains('Webhooks').click();
      
      cy.get('button').contains('Nuevo Webhook').click();
      
      cy.get('input[name="webhook_name"]').type('Conversiones Facebook');
      cy.get('input[name="webhook_url"]').type('https://clinica.com/webhook/conversions');
      cy.get('select[name="event_type"]').select('conversion');
      cy.get('input[name="secret_key"]').type('webhook_secret_123');
      
      cy.get('button[type="submit"]').contains('Crear').click();
      
      cy.contains('Webhook creado').should('be.visible');
      cy.contains('URL para Facebook').should('be.visible');
    });
  });

  describe('11. Segmentación y Audiencias', () => {
    it('debe crear audiencia personalizada', () => {
      cy.get('button').contains('Audiencias').click();
      
      cy.get('button').contains('Nueva Audiencia').click();
      
      cy.get('input[name="audience_name"]').type('Madres 25-35');
      cy.get('textarea[name="description"]').type('Madres con hijos pequeños interesadas en odontopediatría');
      
      // Criterios demográficos
      cy.get('input[name="age_min"]').type('25');
      cy.get('input[name="age_max"]').type('35');
      cy.get('select[name="gender"]').select('female');
      cy.get('input[name="has_children"]').check();
      
      // Intereses
      cy.get('input[name="interests"]').type('Maternidad{enter}Salud infantil{enter}Odontopediatría{enter}');
      
      // Ubicación
      cy.get('input[name="location_radius"]').type('10');
      cy.get('select[name="location_unit"]').select('km');
      
      cy.get('button[type="submit"]').contains('Guardar').click();
      
      cy.contains('Audiencia creada').should('be.visible');
    });

    it('debe estimar tamaño de audiencia', () => {
      cy.get('button').contains('Audiencias').click();
      cy.get('button').contains('Nueva Audiencia').click();
      
      cy.get('input[name="age_min"]').type('20');
      cy.get('input[name="age_max"]').type('40');
      cy.get('select[name="gender"]').select('all');
      
      cy.get('button').contains('Estimar Tamaño').click();
      
      cy.contains('Tamaño estimado').should('be.visible');
      cy.contains('personas').should('be.visible');
    });

    it('debe crear lookalike audience', () => {
      cy.get('button').contains('Audiencias').click();
      cy.get('button').contains('Crear Lookalike').click();
      
      cy.get('select[name="source_type"]').select('best_patients');
      cy.get('input[name="similarity_percent"]').type('95'); // 95% similitud
      cy.get('select[name="platform"]').select('Facebook');
      
      cy.get('button[type="submit"]').contains('Crear').click();
      
      cy.contains('Audiencia lookalike creada').should('be.visible');
    });
  });

  describe('12. A/B Testing', () => {
    it('debe crear test A/B para campaña', () => {
      cy.get('button[role="tab"]').contains('Campañas').click();
      cy.get('button').contains('Crear A/B Test').click();
      
      cy.get('input[name="test_name"]').type('Test Creativos Enero');
      cy.get('select[name="test_type"]').select('creative');
      
      // Variante A
      cy.get('input[name="variant_a_name"]').type('Creativo Familia');
      cy.get('textarea[name="variant_a_copy"]').type('Sonrisas para toda la familia');
      cy.get('input[name="variant_a_budget_cents"]').type('50000');
      
      // Variante B
      cy.get('input[name="variant_b_name"]').type('Creativo Descuento');
      cy.get('textarea[name="variant_b_copy"]').type('20% de descuento en tu primera visita');
      cy.get('input[name="variant_b_budget_cents"]').type('50000');
      
      cy.get('input[name="test_duration_days"]').type('14');
      
      cy.get('button[type="submit"]').contains('Iniciar Test').click();
      
      cy.contains('Test A/B iniciado').should('be.visible');
    });

    it('debe mostrar resultados de test A/B', () => {
      // Asumiendo que hay un test en progreso
      cy.get('button').contains('Tests A/B').click();
      
      cy.contains('tr', 'Test Creativos').find('button').contains('Ver Resultados').click();
      
      cy.contains('Resultados del Test').should('be.visible');
      cy.contains('Variante A').should('be.visible');
      cy.contains('Variante B').should('be.visible');
      cy.contains('Conversiones').should('be.visible');
      cy.contains('Significancia estadística').should('be.visible');
    });

    it('debe declarar ganador de test', () => {
      cy.get('button').contains('Tests A/B').click();
      
      cy.contains('tr', 'Test Completado').find('button').contains('Declarar Ganador').click();
      
      cy.get('input[type="radio"][value="variant_b"]').check();
      cy.get('textarea[name="winner_reason"]').type('Mayor tasa de conversión con 95% de confianza');
      
      cy.get('button').contains('Confirmar Ganador').click();
      
      cy.contains('Ganador declarado').should('be.visible');
      cy.contains('Aplicar a futuras campañas').should('be.visible');
    });
  });

  describe('13. Multi-tenancy y Permisos', () => {
    it('debe mostrar solo campañas de la clínica actual', () => {
      cy.get('input[placeholder*="Buscar"]').type('OtraClinica');
      cy.contains('No se encontraron campañas').should('be.visible');
    });

    it('debe aplicar clinic_id automáticamente', () => {
      cy.get('button[role="tab"]').contains('Campañas').click();
      cy.get('button').contains('Nueva Campaña').click();
      cy.get('input[name="name"]').type('Test Clinic Campaign');
      cy.get('select[name="platform_id"]').select('Facebook');
      cy.get('input[name="start_date"]').type('2025-01-01');
      cy.get('input[name="budget_cents"]').type('10000');
      cy.get('button[type="submit"]').contains('Guardar').click();
      
      cy.contains('Test Clinic Campaign').should('be.visible');
    });
  });

  describe('14. Rendimiento y UX', () => {
    it('debe cargar dashboard rápidamente', () => {
      cy.visit('/marketing', {
        onBeforeLoad: (win) => {
          win.performance.mark('start');
        },
        onLoad: (win) => {
          win.performance.mark('end');
          win.performance.measure('pageLoad', 'start', 'end');
          const measure = win.performance.getEntriesByName('pageLoad')[0];
          expect(measure.duration).to.be.lessThan(3000); // Menos de 3 segundos
        }
      });
    });

    it('debe actualizar métricas en tiempo real', () => {
      // Simular actualización de datos
      cy.window().then((win) => {
        win.postMessage({ type: 'UPDATE_METRICS', data: { roi: 250 } }, '*');
      });
      
      cy.contains('ROI: 250%', { timeout: 1000 }).should('be.visible');
    });

    it('debe tener tooltips informativos', () => {
      cy.get('[data-tooltip="roi"]').trigger('mouseenter');
      cy.contains('Return on Investment').should('be.visible');
      cy.contains('Retorno sobre la inversión publicitaria').should('be.visible');
      
      cy.get('[data-tooltip="cpa"]').trigger('mouseenter');
      cy.contains('Cost Per Acquisition').should('be.visible');
      cy.contains('Costo por cada paciente captado').should('be.visible');
    });

    it('debe soportar atajos de teclado', () => {
      // Ctrl+N para nueva campaña
      cy.get('body').type('{ctrl}n');
      cy.contains('Nueva Campaña').should('be.visible');
      
      // Escape para cerrar
      cy.get('body').type('{esc}');
      cy.contains('Nueva Campaña').should('not.exist');
      
      // Ctrl+R para generar reporte
      cy.get('body').type('{ctrl}r');
      cy.contains('Generar Reporte').should('be.visible');
    });
  });
});

// Comandos personalizados para este módulo
Cypress.Commands.add('createCampaign', (data) => {
  cy.get('button').contains('Nueva Campaña').click();
  cy.get('input[name="name"]').type(data.name);
  cy.get('select[name="platform_id"]').select(data.platform);
  cy.get('input[name="start_date"]').type(data.startDate);
  if (data.endDate) cy.get('input[name="end_date"]').type(data.endDate);
  cy.get('input[name="budget_cents"]').type(data.budget);
  cy.get('button[type="submit"]').contains('Guardar').click();
  cy.wait(500);
});

Cypress.Commands.add('registerCampaignResults', (campaignName, results) => {
  cy.contains('tr', campaignName).find('button[aria-label="Registrar resultados"]').click();
  if (results.impressions) cy.get('input[name="impressions"]').type(results.impressions);
  if (results.clicks) cy.get('input[name="clicks"]').type(results.clicks);
  if (results.conversions) cy.get('input[name="conversions"]').type(results.conversions);
  cy.get('button[type="submit"]').contains('Guardar').click();
});