/**
 * Variable cost calculations for services
 */

export interface SupplyUsage {
  supplyId: string;
  name: string;
  quantity: number;
  unitCostCents: number;
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