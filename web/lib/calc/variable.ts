/**
 * Variable cost calculations for services
 */

export interface SupplyUsage {
  supplyId: string;
  name: string;
  quantity: number;
  unitCostCents: number;
}

export interface SupplyWithPortions {
  price_cents: number;
  portions: number;
}

/**
 * Calculates total variable cost for a service
 */
export function calculateVariableCost(supplies: SupplyUsage[]): number {
  return supplies.reduce((total, supply) => {
    if (supply.quantity < 0) {
      throw new Error(`Quantity cannot be negative for ${supply.name}`);
    }
    if (supply.unitCostCents < 0) {
      throw new Error(`Unit cost cannot be negative for ${supply.name}`);
    }
    return total + Math.round(supply.quantity * supply.unitCostCents);
  }, 0);
}

/**
 * Calculates variable cost as percentage of total cost
 */
export function calculateVariableCostPercentage(
  variableCostCents: number,
  totalCostCents: number
): number {
  if (totalCostCents <= 0) {
    return 0;
  }
  return variableCostCents / totalCostCents;
}

/**
 * Groups supplies by category and calculates totals
 */
export function groupSuppliesByCategory(
  supplies: (SupplyUsage & { category: string })[]
): Record<string, {
  supplies: SupplyUsage[];
  totalCostCents: number;
}> {
  const grouped: Record<string, {
    supplies: SupplyUsage[];
    totalCostCents: number;
  }> = {};
  
  for (const supply of supplies) {
    if (!grouped[supply.category]) {
      grouped[supply.category] = {
        supplies: [],
        totalCostCents: 0,
      };
    }
    
    const costCents = Math.round(supply.quantity * supply.unitCostCents);
    grouped[supply.category].supplies.push(supply);
    grouped[supply.category].totalCostCents += costCents;
  }
  
  return grouped;
}

/**
 * Calculates average variable cost percentage across multiple services
 */
export function calculateAverageVariableCostPercentage(
  services: Array<{
    variableCostCents: number;
    totalCostCents: number;
    weight?: number; // Optional weight for weighted average
  }>
): number {
  if (services.length === 0) {
    return 0;
  }
  
  let totalWeight = 0;
  let weightedSum = 0;
  
  for (const service of services) {
    const weight = service.weight ?? 1;
    const percentage = calculateVariableCostPercentage(
      service.variableCostCents,
      service.totalCostCents
    );
    
    weightedSum += percentage * weight;
    totalWeight += weight;
  }
  
  return totalWeight > 0 ? weightedSum / totalWeight : 0;
}

/**
 * Calculates cost per portion for a supply
 * @param supply Supply with price and portions
 * @returns Cost per portion in cents (rounded to integer)
 */
export function costPerPortion(supply: SupplyWithPortions): number {
  if (supply.portions <= 0) {
    throw new Error('Portions must be greater than 0');
  }
  return Math.round(supply.price_cents / supply.portions);
}

/**
 * Calculates variable cost for a service recipe
 * @param recipe Array of supplies with quantities
 * @returns Total variable cost in cents
 */
export function variableCostForService(
  recipe: Array<{
    qty: number;
    supply: SupplyWithPortions;
  }>
): number {
  return recipe.reduce((total, item) => {
    const costPerUnit = costPerPortion(item.supply);
    return total + Math.round(item.qty * costPerUnit);
  }, 0);
}

/**
 * Calculates total treatment cost including fixed and variable costs
 * @param estMinutes Service duration in minutes
 * @param fixedPerMinuteCents Fixed cost per minute in cents
 * @param variableCostCents Variable cost in cents
 * @returns Object with cost breakdown
 */
export function calculateTreatmentCost(
  estMinutes: number,
  fixedPerMinuteCents: number,
  variableCostCents: number
): {
  fixedCostCents: number;
  variableCostCents: number;
  baseCostCents: number;
} {
  const fixedCostCents = Math.round(estMinutes * fixedPerMinuteCents);
  const baseCostCents = fixedCostCents + variableCostCents;
  
  return {
    fixedCostCents,
    variableCostCents,
    baseCostCents
  };
}

/**
 * Legacy function name for compatibility
 * Calculates variable cost for a service
 */
export function calcularCostoVariable(
  recipe: Array<{
    qty: number;
    supply: SupplyWithPortions;
  }>
): number {
  return variableCostForService(recipe);
}