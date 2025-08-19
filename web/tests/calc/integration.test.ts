/**
 * Tests de integración para el motor de cálculos completo
 * Verifican que todos los módulos trabajen correctamente juntos
 */
import { describe, it, expect } from 'vitest';
import { calculateTimeCosts } from '@/lib/calc/tiempo';
import { calculateBreakEvenPoint, calculateRequiredServices } from '@/lib/calc/puntoEquilibrio';
import { calculateTariff } from '@/lib/calc/tarifa';
import { calculateVariableCost } from '@/lib/calc/variable';

describe('Motor de Cálculos - Integración Completa', () => {
  const scenario = {
    // Configuración base de una clínica
    workDays: 22,
    hoursPerDay: 8,
    realPct: 75, // 75% de utilización real
    fixedCostsCents: 50_000_00, // $50,000 mensuales
    
    // Un servicio de ejemplo
    service: {
      name: 'Limpieza Dental',
      durationMinutes: 30,
      supplies: [
        { supplyId: '1', name: 'Pasta profiláctica', unitCostCents: 50, quantity: 1 },
        { supplyId: '2', name: 'Guantes', unitCostCents: 25, quantity: 2 },
        { supplyId: '3', name: 'Agua destilada', unitCostCents: 10, quantity: 0.5 }
      ]
    },
    marginPct: 65 // 65% de margen
  };

  it('debe calcular el costo por minuto correctamente', () => {
    const timeSettings = {
      workDaysPerMonth: scenario.workDays,
      hoursPerDay: scenario.hoursPerDay,
      effectiveWorkPercentage: scenario.realPct / 100
    };
    
    const timeCosts = calculateTimeCosts(timeSettings, scenario.fixedCostsCents);

    expect(timeCosts.fixedPerMinuteCents).toBeGreaterThan(0);
    expect(timeCosts.effectiveMinutesPerMonth).toBe(
      scenario.workDays * scenario.hoursPerDay * 60 * (scenario.realPct / 100)
    );
    
    console.log('💰 Costo por minuto:', timeCosts.fixedPerMinuteCents / 100, 'pesos');
  });

  it('debe calcular el costo variable de un servicio', () => {
    const variableCost = calculateVariableCost(scenario.service.supplies);
    
    // Costo esperado: 50 + (25*2) + (10*0.5) = 105 centavos
    expect(variableCost).toBe(105);
    
    console.log('🧪 Costo variable del servicio:', variableCost / 100, 'pesos');
  });

  it('debe calcular el precio final de un servicio con margen', () => {
    const timeSettings = {
      workDaysPerMonth: scenario.workDays,
      hoursPerDay: scenario.hoursPerDay,
      effectiveWorkPercentage: scenario.realPct / 100
    };
    
    const timeCosts = calculateTimeCosts(timeSettings, scenario.fixedCostsCents);
    
    const variableCostCents = calculateVariableCost(scenario.service.supplies);
    
    const tariffResult = calculateTariff({
      durationMinutes: scenario.service.durationMinutes,
      fixedPerMinuteCents: timeCosts.fixedPerMinuteCents,
      variableCostCents,
      marginPercentage: scenario.marginPct / 100 // Convert to decimal
    });

    expect(tariffResult.finalPriceCents).toBeGreaterThan(tariffResult.baseCostCents);
    expect(tariffResult.baseCostCents).toBe(tariffResult.fixedCostCents + tariffResult.variableCostCents);
    
    console.log('📋 Precio final del servicio:', tariffResult.finalPriceCents / 100, 'pesos');
    console.log('📊 Costo base:', tariffResult.baseCostCents / 100, 'pesos');
    console.log('💰 Margen:', tariffResult.marginCents / 100, 'pesos');
  });

  it('debe calcular el punto de equilibrio correctamente', () => {
    const timeSettings = {
      workDaysPerMonth: scenario.workDays,
      hoursPerDay: scenario.hoursPerDay,
      effectiveWorkPercentage: scenario.realPct / 100
    };
    
    const timeCosts = calculateTimeCosts(timeSettings, scenario.fixedCostsCents);
    
    const variableCostCents = calculateVariableCost(scenario.service.supplies);
    
    const tariffResult = calculateTariff({
      durationMinutes: scenario.service.durationMinutes,
      fixedPerMinuteCents: timeCosts.fixedPerMinuteCents,
      variableCostCents,
      marginPercentage: scenario.marginPct / 100
    });

    const contributionPerUnit = tariffResult.finalPriceCents - variableCostCents;
    const variablePercentage = variableCostCents / tariffResult.finalPriceCents;
    
    const breakeven = calculateBreakEvenPoint({
      monthlyFixedCostsCents: scenario.fixedCostsCents,
      averageVariablePercentage: variablePercentage
    });
    
    const unitsToBreakeven = calculateRequiredServices(
      breakeven.breakEvenRevenueCents,
      tariffResult.finalPriceCents
    );

    expect(unitsToBreakeven).toBeGreaterThan(0);
    expect(breakeven.breakEvenRevenueCents).toBeGreaterThan(0);
    
    console.log('🎯 Punto de equilibrio:', unitsToBreakeven, 'servicios/mes');
    console.log('📅 Meta diaria:', Math.ceil(unitsToBreakeven / scenario.workDays), 'servicios/día');
  });

  it('debe mantener consistencia en el flujo completo de cálculos', () => {
    // Simular el flujo completo como en la aplicación real
    
    // 1. Calcular costos de tiempo
    const timeSettings = {
      workDaysPerMonth: scenario.workDays,
      hoursPerDay: scenario.hoursPerDay,
      effectiveWorkPercentage: scenario.realPct / 100
    };
    
    const timeCosts = calculateTimeCosts(timeSettings, scenario.fixedCostsCents);

    // 2. Calcular costo variable
    const variableCostCents = calculateVariableCost(scenario.service.supplies);

    // 3. Calcular precio del servicio
    const tariffResult = calculateTariff({
      durationMinutes: scenario.service.durationMinutes,
      fixedPerMinuteCents: timeCosts.fixedPerMinuteCents,
      variableCostCents,
      marginPercentage: scenario.marginPct / 100
    });

    // 4. Calcular punto de equilibrio
    const variablePercentage = variableCostCents / tariffResult.finalPriceCents;
    
    const breakeven = calculateBreakEvenPoint({
      monthlyFixedCostsCents: scenario.fixedCostsCents,
      averageVariablePercentage: variablePercentage
    });
    
    const unitsToBreakeven = calculateRequiredServices(
      breakeven.breakEvenRevenueCents,
      tariffResult.finalPriceCents
    );

    // Verificaciones de consistencia
    expect(tariffResult.baseCostCents).toBe(tariffResult.fixedCostCents + tariffResult.variableCostCents);
    expect(tariffResult.finalPriceCents).toBe(tariffResult.baseCostCents + tariffResult.marginCents);
    
    // El ingreso del punto de equilibrio debe cubrir exactamente los costos fijos
    const contributionPerUnit = tariffResult.finalPriceCents - variableCostCents;
    const expectedUnits = Math.ceil(scenario.fixedCostsCents / contributionPerUnit);
    expect(unitsToBreakeven).toBe(expectedUnits);

    console.log('\n🔗 FLUJO COMPLETO DE CÁLCULOS:');
    console.log('═══════════════════════════════');
    console.log('💰 Costos fijos mensuales:', scenario.fixedCostsCents / 100, 'pesos');
    console.log('⏱️  Costo por minuto:', timeCosts.fixedPerMinuteCents / 100, 'pesos');
    console.log('🧪 Costo variable:', variableCostCents / 100, 'pesos');
    console.log('🔧 Costo fijo del servicio:', tariffResult.fixedCostCents / 100, 'pesos');
    console.log('💵 Precio final:', tariffResult.finalPriceCents / 100, 'pesos');
    console.log('🎯 Punto de equilibrio:', unitsToBreakeven, 'servicios');
    console.log('📈 Ingreso necesario:', breakeven.breakEvenRevenueCents / 100, 'pesos');
  });
});
