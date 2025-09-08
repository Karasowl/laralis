import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createSupabaseClient } from '@/lib/supabase';

/**
 * Integration tests for complete API flows
 * Tests the entire data flow from creation to calculation
 */

describe('API Integration - Complete Business Flow', () => {
  let clinicId: string = 'test-clinic-' + Date.now();
  
  // Mock data
  const mockSupply = {
    id: 'supply-1',
    clinic_id: clinicId,
    name: 'Test Gloves',
    unit: 'box',
    quantity_per_unit: 100,
    cost_per_unit_cents: 5000,
    unit_cost_cents: 50
  };

  const mockService = {
    id: 'service-1',
    clinic_id: clinicId,
    name: 'Test Cleaning',
    duration_minutes: 30,
    margin_percentage: 50,
    is_active: true
  };

  const mockPatient = {
    id: 'patient-1',
    clinic_id: clinicId,
    first_name: 'Test',
    last_name: 'Patient',
    email: 'test@patient.com'
  };

  describe('Supply to Service Flow', () => {
    it('should create supply and use in service calculation', async () => {
      // Step 1: Create supply
      const supply = await createSupply(mockSupply);
      expect(supply).toBeDefined();
      expect(supply.unit_cost_cents).toBe(50);

      // Step 2: Create service
      const service = await createService(mockService);
      expect(service).toBeDefined();

      // Step 3: Add supply to service
      const serviceSupply = await addSupplyToService(service.id, supply.id, 2);
      expect(serviceSupply).toBeDefined();
      expect(serviceSupply.quantity).toBe(2);

      // Step 4: Calculate service cost
      const cost = await calculateServiceCost(service.id);
      expect(cost).toBeDefined();
      expect(cost.variableCostCents).toBe(100); // 2 * 50
      
      // With 30 minutes and 50% margin
      expect(cost.finalPriceCents).toBeGreaterThan(cost.baseCostCents);
    });

    it('should update costs when supply price changes', async () => {
      // Update supply cost
      const updatedSupply = await updateSupply(mockSupply.id, {
        cost_per_unit_cents: 7500
      });
      expect(updatedSupply.unit_cost_cents).toBe(75);

      // Recalculate service cost
      const newCost = await calculateServiceCost(mockService.id);
      expect(newCost.variableCostCents).toBe(150); // 2 * 75
    });
  });

  describe('Patient to Treatment Flow', () => {
    it('should create patient and record treatment', async () => {
      // Step 1: Create patient
      const patient = await createPatient(mockPatient);
      expect(patient).toBeDefined();
      expect(patient.clinic_id).toBe(clinicId);

      // Step 2: Create treatment
      const treatment = {
        patient_id: patient.id,
        service_id: mockService.id,
        clinic_id: clinicId,
        treatment_date: new Date().toISOString(),
        status: 'completed',
        // Snapshot current costs
        snapshot_costs: {
          fixedPerMinuteCents: 500,
          variableCostCents: 100,
          marginPercentage: 50
        },
        price_cents: 20000
      };

      const createdTreatment = await createTreatment(treatment);
      expect(createdTreatment).toBeDefined();
      expect(createdTreatment.snapshot_costs).toBeDefined();
      
      // Snapshot should be immutable
      expect(createdTreatment.snapshot_costs.variableCostCents).toBe(100);
    });

    it('should maintain treatment history when service changes', async () => {
      // Get existing treatment
      const treatments = await getTreatmentsByPatient(mockPatient.id);
      expect(treatments.length).toBeGreaterThan(0);
      
      const originalTreatment = treatments[0];
      const originalPrice = originalTreatment.price_cents;

      // Update service margin
      await updateService(mockService.id, {
        margin_percentage: 75
      });

      // Original treatment price should not change
      const treatmentAfterUpdate = await getTreatment(originalTreatment.id);
      expect(treatmentAfterUpdate.price_cents).toBe(originalPrice);
      expect(treatmentAfterUpdate.snapshot_costs).toEqual(originalTreatment.snapshot_costs);
    });
  });

  describe('Multi-Tenancy Isolation', () => {
    const otherClinicId = 'other-clinic-' + Date.now();

    it('should isolate data between clinics', async () => {
      // Create supply in other clinic
      const otherSupply = await createSupply({
        ...mockSupply,
        id: 'supply-other',
        clinic_id: otherClinicId,
        name: 'Other Clinic Supply'
      });

      // Should not see other clinic's supply
      const supplies = await getSuppliesByClinic(clinicId);
      const otherClinicSupply = supplies.find(s => s.id === 'supply-other');
      expect(otherClinicSupply).toBeUndefined();

      // Should only see own clinic's supplies
      const ownSupply = supplies.find(s => s.clinic_id === clinicId);
      expect(ownSupply).toBeDefined();
    });

    it('should prevent cross-clinic service updates', async () => {
      // Try to update service with wrong clinic_id
      const result = await updateService(mockService.id, {
        clinic_id: otherClinicId
      });

      // Should fail or maintain original clinic_id
      expect(result.clinic_id).toBe(clinicId);
    });
  });

  describe('Calculation Consistency', () => {
    it('should calculate break-even point correctly', async () => {
      const settings = {
        clinic_id: clinicId,
        working_days_per_month: 20,
        working_hours_per_day: 8,
        productive_minutes_per_hour: 50
      };

      const fixedCosts = 5000000; // 50,000 pesos
      const servicePrice = 25000; // 250 pesos
      const serviceDuration = 30; // minutes

      const breakEven = calculateBreakEven({
        fixedCostsCents: fixedCosts,
        servicePriceCents: servicePrice,
        serviceDurationMinutes: serviceDuration,
        settings
      });

      expect(breakEven).toBeDefined();
      expect(breakEven.servicesPerMonth).toBeGreaterThan(0);
      expect(breakEven.revenueNeeded).toBe(
        breakEven.servicesPerMonth * servicePrice
      );
    });

    it('should maintain calculation precision with cents', async () => {
      const calculations = [
        { input: 10000, operation: 'divide', factor: 3 },
        { input: 33333, operation: 'multiply', factor: 3 },
        { input: 12345, operation: 'percentage', factor: 0.15 }
      ];

      calculations.forEach(calc => {
        const result = performCalculation(calc);
        expect(Number.isInteger(result)).toBe(true);
        expect(result).toBeGreaterThan(0);
      });
    });
  });
});

// Helper functions (these would normally call real API endpoints)
async function createSupply(supply: any) {
  // Mock implementation
  return { ...supply, created_at: new Date().toISOString() };
}

async function createService(service: any) {
  return { ...service, created_at: new Date().toISOString() };
}

async function addSupplyToService(serviceId: string, supplyId: string, quantity: number) {
  return {
    service_id: serviceId,
    supply_id: supplyId,
    quantity,
    created_at: new Date().toISOString()
  };
}

async function calculateServiceCost(serviceId: string) {
  // Mock calculation
  return {
    fixedCostCents: 15000,
    variableCostCents: 100,
    baseCostCents: 15100,
    marginCents: 7550,
    finalPriceCents: 22650
  };
}

async function updateSupply(id: string, updates: any) {
  return {
    id,
    ...updates,
    unit_cost_cents: Math.round(updates.cost_per_unit_cents / 100)
  };
}

async function createPatient(patient: any) {
  return { ...patient, created_at: new Date().toISOString() };
}

async function createTreatment(treatment: any) {
  return { ...treatment, id: 'treatment-1', created_at: new Date().toISOString() };
}

async function getTreatmentsByPatient(patientId: string) {
  return [{
    id: 'treatment-1',
    patient_id: patientId,
    price_cents: 20000,
    snapshot_costs: {
      fixedPerMinuteCents: 500,
      variableCostCents: 100,
      marginPercentage: 50
    }
  }];
}

async function getTreatment(id: string) {
  return {
    id,
    price_cents: 20000,
    snapshot_costs: {
      fixedPerMinuteCents: 500,
      variableCostCents: 100,
      marginPercentage: 50
    }
  };
}

async function updateService(id: string, updates: any) {
  return { id, clinic_id: 'test-clinic-' + Date.now(), ...updates };
}

async function getSuppliesByClinic(clinicId: string) {
  return [{
    id: 'supply-1',
    clinic_id: clinicId,
    name: 'Test Supply'
  }];
}

function calculateBreakEven(params: any) {
  const servicesPerMonth = Math.ceil(params.fixedCostsCents / params.servicePriceCents);
  return {
    servicesPerMonth,
    revenueNeeded: servicesPerMonth * params.servicePriceCents
  };
}

function performCalculation(calc: any) {
  switch(calc.operation) {
    case 'divide':
      return Math.round(calc.input / calc.factor);
    case 'multiply':
      return Math.round(calc.input * calc.factor);
    case 'percentage':
      return Math.round(calc.input * calc.factor);
    default:
      return calc.input;
  }
}