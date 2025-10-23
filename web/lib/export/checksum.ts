/**
 * Checksum Generator for Export Bundles
 *
 * Generates SHA-256 checksums for export bundles to ensure data integrity.
 * The checksum is calculated over the stringified data (excluding the checksum field itself).
 */

import type { ExportBundle } from './types';

/**
 * Generates a SHA-256 checksum for an export bundle
 *
 * @param bundle - The export bundle (without checksum in metadata)
 * @returns SHA-256 hash as hex string
 *
 * @example
 * ```typescript
 * const bundle = { metadata: {...}, data: {...}, migrations: {...} };
 * const checksum = await generateChecksum(bundle);
 * console.log(checksum); // "a3b2c1d4e5f6..."
 * ```
 */
export async function generateChecksum(
  bundle: Omit<ExportBundle, 'metadata'> & { metadata: Omit<ExportBundle['metadata'], 'checksum'> }
): Promise<string> {
  // Serialize bundle to JSON with sorted keys for deterministic output
  const bundleString = JSON.stringify(bundle, Object.keys(bundle).sort());

  // Convert string to ArrayBuffer
  const encoder = new TextEncoder();
  const data = encoder.encode(bundleString);

  // Generate SHA-256 hash
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);

  // Convert ArrayBuffer to hex string
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');

  return hashHex;
}

/**
 * Verifies the checksum of an export bundle
 *
 * @param bundle - The complete export bundle with checksum
 * @returns true if checksum is valid, false otherwise
 *
 * @example
 * ```typescript
 * const isValid = await verifyChecksum(bundle);
 * if (!isValid) {
 *   throw new Error('Bundle integrity check failed');
 * }
 * ```
 */
export async function verifyChecksum(bundle: ExportBundle): Promise<boolean> {
  const storedChecksum = bundle.metadata.checksum;

  // Create a copy without the checksum field
  const bundleWithoutChecksum = {
    ...bundle,
    metadata: {
      ...bundle.metadata,
      checksum: undefined,
    },
  };

  // Remove undefined checksum field
  delete bundleWithoutChecksum.metadata.checksum;

  // Recalculate checksum
  const calculatedChecksum = await generateChecksum(bundleWithoutChecksum as any);

  // Compare checksums
  return storedChecksum === calculatedChecksum;
}

/**
 * Adds checksum to an export bundle
 *
 * @param bundle - Export bundle without checksum
 * @returns Complete export bundle with checksum
 *
 * @example
 * ```typescript
 * const bundleWithoutChecksum = { metadata: {...}, data: {...}, migrations: {...} };
 * const completeBundle = await addChecksum(bundleWithoutChecksum);
 * // completeBundle.metadata.checksum is now populated
 * ```
 */
export async function addChecksum(
  bundle: Omit<ExportBundle, 'metadata'> & { metadata: Omit<ExportBundle['metadata'], 'checksum'> }
): Promise<ExportBundle> {
  const checksum = await generateChecksum(bundle);

  return {
    ...bundle,
    metadata: {
      ...bundle.metadata,
      checksum,
    },
  } as ExportBundle;
}

/**
 * Calculates checksum for a subset of data (useful for partial validation)
 *
 * @param data - Any JSON-serializable data
 * @returns SHA-256 hash as hex string
 *
 * @example
 * ```typescript
 * const clinicChecksum = await calculateDataChecksum(clinicData);
 * ```
 */
export async function calculateDataChecksum(data: any): Promise<string> {
  const dataString = JSON.stringify(data, Object.keys(data).sort());
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(dataString);
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Validates that all money fields are integers (not floats)
 * This is critical for our money-in-cents architecture
 *
 * @param bundle - Export bundle to validate
 * @returns Array of validation errors (empty if valid)
 *
 * @example
 * ```typescript
 * const errors = validateMoneyFields(bundle);
 * if (errors.length > 0) {
 *   console.error('Money validation failed:', errors);
 * }
 * ```
 */
export function validateMoneyFields(bundle: ExportBundle): string[] {
  const errors: string[] = [];

  // Helper to check if a value is an integer
  const isInteger = (value: any): boolean => {
    return typeof value === 'number' && Number.isInteger(value);
  };

  // Check all money fields in the bundle
  bundle.data.clinics.forEach((clinic, clinicIndex) => {
    // Assets
    clinic.assets.forEach((asset, assetIndex) => {
      if (!isInteger(asset.purchase_price_cents)) {
        errors.push(
          `Clinic ${clinicIndex}, Asset ${assetIndex}: purchase_price_cents must be integer, got ${typeof asset.purchase_price_cents}`
        );
      }
      if (asset.disposal_value_cents !== null && !isInteger(asset.disposal_value_cents)) {
        errors.push(
          `Clinic ${clinicIndex}, Asset ${assetIndex}: disposal_value_cents must be integer, got ${typeof asset.disposal_value_cents}`
        );
      }
    });

    // Supplies
    clinic.supplies.forEach((supply, supplyIndex) => {
      if (!isInteger(supply.price_cents)) {
        errors.push(
          `Clinic ${clinicIndex}, Supply ${supplyIndex}: price_cents must be integer, got ${typeof supply.price_cents}`
        );
      }
    });

    // Fixed Costs
    clinic.fixedCosts.forEach((cost, costIndex) => {
      if (!isInteger(cost.amount_cents)) {
        errors.push(
          `Clinic ${clinicIndex}, FixedCost ${costIndex}: amount_cents must be integer, got ${typeof cost.amount_cents}`
        );
      }
    });

    // Services
    clinic.services.forEach((service, serviceIndex) => {
      if (!isInteger(service.price_cents)) {
        errors.push(
          `Clinic ${clinicIndex}, Service ${serviceIndex}: price_cents must be integer, got ${typeof service.price_cents}`
        );
      }
      if (!isInteger(service.fixed_cost_per_minute_cents)) {
        errors.push(
          `Clinic ${clinicIndex}, Service ${serviceIndex}: fixed_cost_per_minute_cents must be integer, got ${typeof service.fixed_cost_per_minute_cents}`
        );
      }
      if (!isInteger(service.variable_cost_cents)) {
        errors.push(
          `Clinic ${clinicIndex}, Service ${serviceIndex}: variable_cost_cents must be integer, got ${typeof service.variable_cost_cents}`
        );
      }
    });

    // Treatments
    clinic.treatments.forEach((treatment, treatmentIndex) => {
      if (!isInteger(treatment.price_cents)) {
        errors.push(
          `Clinic ${clinicIndex}, Treatment ${treatmentIndex}: price_cents must be integer, got ${typeof treatment.price_cents}`
        );
      }
      if (!isInteger(treatment.fixed_cost_per_minute_cents)) {
        errors.push(
          `Clinic ${clinicIndex}, Treatment ${treatmentIndex}: fixed_cost_per_minute_cents must be integer, got ${typeof treatment.fixed_cost_per_minute_cents}`
        );
      }
      if (!isInteger(treatment.variable_cost_cents)) {
        errors.push(
          `Clinic ${clinicIndex}, Treatment ${treatmentIndex}: variable_cost_cents must be integer, got ${typeof treatment.variable_cost_cents}`
        );
      }
    });

    // Expenses
    clinic.expenses.forEach((expense, expenseIndex) => {
      if (!isInteger(expense.amount_cents)) {
        errors.push(
          `Clinic ${clinicIndex}, Expense ${expenseIndex}: amount_cents must be integer, got ${typeof expense.amount_cents}`
        );
      }
    });

    // Tariffs
    clinic.tariffs.forEach((tariff, tariffIndex) => {
      if (!isInteger(tariff.price_cents)) {
        errors.push(
          `Clinic ${clinicIndex}, Tariff ${tariffIndex}: price_cents must be integer, got ${typeof tariff.price_cents}`
        );
      }
      if (!isInteger(tariff.rounded_price_cents)) {
        errors.push(
          `Clinic ${clinicIndex}, Tariff ${tariffIndex}: rounded_price_cents must be integer, got ${typeof tariff.rounded_price_cents}`
        );
      }
    });
  });

  return errors;
}
