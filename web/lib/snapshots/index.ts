/**
 * Clinic Snapshot System
 *
 * Sistema de backup/snapshot por clínica con descubrimiento dinámico de tablas.
 *
 * @example
 * // Crear un snapshot
 * import { createSnapshotExporter } from '@/lib/snapshots'
 *
 * const exporter = createSnapshotExporter(supabase, clinicId, {
 *   userId: 'user-id',
 *   userEmail: 'user@example.com',
 *   type: 'manual',
 * })
 * const result = await exporter.export()
 *
 * @example
 * // Listar snapshots
 * import { SnapshotStorageService } from '@/lib/snapshots'
 *
 * const storage = new SnapshotStorageService(supabase)
 * const snapshots = await storage.listSnapshots(clinicId)
 *
 * @example
 * // Descubrir tablas
 * import { TableDiscoveryService } from '@/lib/snapshots'
 *
 * const discovery = new TableDiscoveryService(supabase)
 * const result = await discovery.discoverClinicTables()
 * console.log(`Found ${result.tables.length} tables`)
 */

// Types
export * from './types'

// Services
export { TableDiscoveryService } from './discovery'
export { SnapshotStorageService } from './storage'
export { ClinicSnapshotExporter, createSnapshotExporter } from './exporter'
export { ClinicSnapshotImporter, createSnapshotImporter } from './importer'
