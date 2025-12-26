/**
 * Clinic Snapshot Exporter
 *
 * Exporta todos los datos de una clínica a un snapshot comprimido.
 * Usa descubrimiento dinámico para garantizar completitud.
 */

import { SupabaseClient } from '@supabase/supabase-js'
import { gzip } from 'pako'
import { createHash } from 'crypto'
import { TableDiscoveryService } from './discovery'
import { SnapshotStorageService } from './storage'
import {
  ClinicSnapshot,
  SnapshotMetadata,
  SnapshotManifest,
  ClinicData,
  ExportOptions,
  ExportResult,
  DiscoveredTable,
  TableManifestEntry,
  SnapshotError,
  SnapshotType,
} from './types'

const APP_VERSION = '1.0.0'
const SCHEMA_VERSION = 69 // Current migration version

export class ClinicSnapshotExporter {
  private discovery: TableDiscoveryService
  private storage: SnapshotStorageService
  private clinicName: string = ''
  private workspaceId: string = ''

  constructor(
    private supabase: SupabaseClient,
    private clinicId: string,
    private options: ExportOptions
  ) {
    this.discovery = new TableDiscoveryService(supabase)
    this.storage = new SnapshotStorageService(supabase)
  }

  /**
   * Exporta todos los datos de la clínica a un snapshot.
   */
  async export(): Promise<ExportResult> {
    const startTime = Date.now()

    try {
      // 1. Obtener info de la clínica
      await this.loadClinicInfo()

      // 2. Descubrir tablas dinámicamente
      const discoveryResult = await this.discovery.discoverClinicTables()

      // 3. Exportar datos de cada tabla
      const { data, tableManifest } = await this.exportAllTables(
        discoveryResult.tables,
        discoveryResult.foreignKeyOrder
      )

      // 4. Crear manifest
      const manifest: SnapshotManifest = {
        tables: tableManifest,
        foreignKeyOrder: discoveryResult.foreignKeyOrder,
        discoveredAt: discoveryResult.discoveredAt,
        discoveryMethod: 'dynamic',
      }

      // 5. Calcular checksums
      const checksums = this.calculateChecksums(data, tableManifest)

      // 6. Crear metadata
      const snapshotId = crypto.randomUUID()
      const uncompressedJson = JSON.stringify({ manifest, data })
      const uncompressedSize = new TextEncoder().encode(uncompressedJson).length

      const metadata: SnapshotMetadata = {
        id: snapshotId,
        clinicId: this.clinicId,
        clinicName: this.clinicName,
        workspaceId: this.workspaceId,
        createdAt: new Date().toISOString(),
        createdBy: {
          userId: this.options.userId,
          email: this.options.userEmail,
        },
        type: this.options.type,
        schemaVersion: SCHEMA_VERSION,
        appVersion: APP_VERSION,
        checksums,
        stats: {
          totalRecords: Object.values(data).reduce(
            (sum, arr) => sum + arr.length,
            0
          ),
          recordsByTable: Object.fromEntries(
            Object.entries(data).map(([k, v]) => [k, v.length])
          ),
          compressedSizeBytes: 0, // Se actualiza después de comprimir
          uncompressedSizeBytes: uncompressedSize,
          exportDurationMs: 0, // Se actualiza al final
        },
      }

      // 7. Crear snapshot completo
      const snapshot: ClinicSnapshot = {
        metadata,
        manifest,
        data,
      }

      // 8. Comprimir
      const compressed = this.compress(snapshot)
      metadata.stats.compressedSizeBytes = compressed.length

      // 9. Subir a storage
      const storagePath = await this.storage.upload(
        this.clinicId,
        snapshotId,
        compressed
      )

      // 10. Actualizar manifest index
      await this.storage.updateManifestIndex(this.clinicId, metadata)

      // 11. Guardar registro en base de datos
      await this.saveSnapshotRecord(metadata, storagePath)

      // 12. Actualizar duración
      metadata.stats.exportDurationMs = Date.now() - startTime

      return {
        snapshotId,
        storagePath,
        stats: metadata.stats,
      }
    } catch (error) {
      throw new SnapshotError(
        `Export failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'EXPORT_FAILED',
        error
      )
    }
  }

  /**
   * Carga información de la clínica.
   */
  private async loadClinicInfo(): Promise<void> {
    const { data, error } = await this.supabase
      .from('clinics')
      .select('name, workspace_id')
      .eq('id', this.clinicId)
      .single()

    if (error || !data) {
      throw new SnapshotError(
        'Clinic not found',
        'EXPORT_FAILED',
        error
      )
    }

    this.clinicName = data.name
    this.workspaceId = data.workspace_id
  }

  /**
   * Exporta datos de todas las tablas.
   */
  private async exportAllTables(
    tables: DiscoveredTable[],
    order: string[]
  ): Promise<{ data: ClinicData; tableManifest: TableManifestEntry[] }> {
    const data: ClinicData = {}
    const tableManifest: TableManifestEntry[] = []

    // Exportar en orden de FK
    for (const tableName of order) {
      const table = tables.find((t) => t.name === tableName)
      if (!table) continue

      try {
        const records = await this.exportTable(table)
        data[tableName] = records

        // Obtener columnas
        const columns = await this.discovery.getTableColumns(tableName)

        // Calcular checksum de esta tabla
        const checksum = this.hashData(records)

        tableManifest.push({
          name: tableName,
          category: table.category,
          parentTable: table.parentTable,
          parentColumn: table.parentColumn,
          recordCount: records.length,
          checksum,
          columns,
        })
      } catch (error) {
        console.error(`Failed to export table ${tableName}:`, error)
        // Continuar con otras tablas, no fallar todo el export
        data[tableName] = []
        tableManifest.push({
          name: tableName,
          category: table.category,
          recordCount: 0,
          checksum: '',
          columns: [],
        })
      }
    }

    return { data, tableManifest }
  }

  /**
   * Exporta datos de una tabla específica.
   */
  private async exportTable(table: DiscoveredTable): Promise<unknown[]> {
    let query = this.supabase.from(table.name as 'treatments').select('*')

    if (table.category === 'direct' || table.category === 'hybrid') {
      if (table.category === 'hybrid') {
        // Para tablas híbridas, incluir globales (NULL) + específicos de clínica
        query = query.or(
          `clinic_id.eq.${this.clinicId},clinic_id.is.null`
        )
      } else {
        // Para tablas directas, filtrar solo por clinic_id
        query = query.eq('clinic_id', this.clinicId)
      }
    } else if (table.category === 'indirect' && table.parentTable && table.parentColumn) {
      // Para tablas indirectas, necesitamos obtener los IDs del padre primero
      const parentIds = await this.getParentIds(table)
      if (parentIds.length === 0) {
        return []
      }
      query = query.in(table.parentColumn, parentIds)
    }

    const { data, error } = await query

    if (error) {
      throw new SnapshotError(
        `Failed to export ${table.name}: ${error.message}`,
        'EXPORT_FAILED',
        error
      )
    }

    return data || []
  }

  /**
   * Obtiene IDs de la tabla padre para filtrar tablas indirectas.
   */
  private async getParentIds(table: DiscoveredTable): Promise<string[]> {
    if (!table.parentTable) return []

    const { data, error } = await this.supabase
      .from(table.parentTable as 'treatments')
      .select('id')
      .eq('clinic_id', this.clinicId)

    if (error || !data) {
      return []
    }

    return data.map((row: { id: string }) => row.id)
  }

  /**
   * Calcula checksums para el snapshot.
   */
  private calculateChecksums(
    data: ClinicData,
    tableManifest: TableManifestEntry[]
  ): { bundle: string; perTable: Record<string, string> } {
    const perTable: Record<string, string> = {}

    for (const entry of tableManifest) {
      perTable[entry.name] = entry.checksum
    }

    // Checksum del bundle completo
    const bundle = this.hashData(data)

    return { bundle, perTable }
  }

  /**
   * Hash SHA-256 de datos.
   */
  private hashData(data: unknown): string {
    const json = JSON.stringify(data, Object.keys(data as object).sort())
    return createHash('sha256').update(json).digest('hex')
  }

  /**
   * Comprime el snapshot con gzip.
   */
  private compress(snapshot: ClinicSnapshot): Uint8Array {
    const json = JSON.stringify(snapshot)
    return gzip(json, { level: 9 })
  }

  /**
   * Guarda el registro del snapshot en la base de datos.
   */
  private async saveSnapshotRecord(
    metadata: SnapshotMetadata,
    storagePath: string
  ): Promise<void> {
    const { error } = await this.supabase.from('clinic_snapshots').insert({
      id: metadata.id,
      clinic_id: this.clinicId,
      created_by: metadata.createdBy.userId,
      type: metadata.type,
      status: 'completed',
      storage_path: storagePath,
      checksum: metadata.checksums.bundle,
      compressed_size_bytes: metadata.stats.compressedSizeBytes,
      uncompressed_size_bytes: metadata.stats.uncompressedSizeBytes,
      record_counts: metadata.stats.recordsByTable,
      schema_version: metadata.schemaVersion,
      app_version: metadata.appVersion,
      metadata: {
        clinicName: metadata.clinicName,
        workspaceId: metadata.workspaceId,
      },
    })

    if (error) {
      console.error('Failed to save snapshot record:', error)
      // No fallar el export, el snapshot ya está en storage
    }
  }
}

/**
 * Factory function para crear un exporter.
 */
export function createSnapshotExporter(
  supabase: SupabaseClient,
  clinicId: string,
  options: {
    userId: string
    userEmail: string
    type?: SnapshotType
  }
): ClinicSnapshotExporter {
  return new ClinicSnapshotExporter(supabase, clinicId, {
    type: options.type || 'manual',
    compress: true,
    userId: options.userId,
    userEmail: options.userEmail,
  })
}
