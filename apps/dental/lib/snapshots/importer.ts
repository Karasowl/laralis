/**
 * Clinic Snapshot Importer
 *
 * Restaura datos de una clínica desde un snapshot.
 * Crea backup automático antes de restaurar.
 */

import { SupabaseClient } from '@supabase/supabase-js'
import { ungzip } from 'pako'
import { createHash } from 'crypto'
import { TableDiscoveryService } from './discovery'
import { SnapshotStorageService } from './storage'
import { createSnapshotExporter } from './exporter'
import {
  ClinicSnapshot,
  RestoreOptions,
  RestoreResult,
  RestoreError,
  SnapshotError,
  DiscoveredTable,
} from './types'

export class ClinicSnapshotImporter {
  private discovery: TableDiscoveryService
  private storage: SnapshotStorageService
  private errors: RestoreError[] = []

  constructor(
    private supabase: SupabaseClient,
    private clinicId: string,
    private options: RestoreOptions
  ) {
    this.discovery = new TableDiscoveryService(supabase)
    this.storage = new SnapshotStorageService(supabase)
  }

  /**
   * Restaura datos desde un snapshot comprimido.
   */
  async restore(
    compressedData: Uint8Array,
    userId: string,
    userEmail: string
  ): Promise<RestoreResult> {
    const startTime = Date.now()
    let preRestoreSnapshotId: string | undefined

    try {
      // 1. Descomprimir y parsear
      const snapshot = this.decompress(compressedData)

      // 2. Validar checksum
      this.validateChecksum(snapshot)

      // 3. Crear backup antes de restaurar (si está habilitado)
      if (this.options.createBackupFirst && !this.options.dryRun) {
        const exporter = createSnapshotExporter(this.supabase, this.clinicId, {
          userId,
          userEmail,
          type: 'pre-restore',
        })
        const backup = await exporter.export()
        preRestoreSnapshotId = backup.snapshotId
      }

      // 4. Si es dry run, solo simular
      if (this.options.dryRun) {
        return this.simulateRestore(snapshot)
      }

      // 5. Restaurar datos
      const restoredRecords: Record<string, number> = {}
      const skippedRecords: Record<string, number> = {}

      // Obtener tablas actuales
      const discovery = await this.discovery.discoverClinicTables()
      const tableMap = new Map(discovery.tables.map((t) => [t.name, t]))

      // Restaurar en orden de FK
      for (const tableName of snapshot.manifest.foreignKeyOrder) {
        // Filtrar si se especificaron tablas específicas
        if (
          this.options.tables &&
          this.options.tables.length > 0 &&
          !this.options.tables.includes(tableName)
        ) {
          continue
        }

        const tableData = snapshot.data[tableName]
        if (!tableData || tableData.length === 0) {
          skippedRecords[tableName] = 0
          continue
        }

        const tableInfo = tableMap.get(tableName)
        if (!tableInfo) {
          this.errors.push({
            table: tableName,
            message: 'Table not found in current schema',
            fatal: false,
          })
          skippedRecords[tableName] = tableData.length
          continue
        }

        try {
          const restored = await this.restoreTable(
            tableName,
            tableData,
            tableInfo
          )
          restoredRecords[tableName] = restored
        } catch (error) {
          this.errors.push({
            table: tableName,
            message: error instanceof Error ? error.message : 'Unknown error',
            fatal: false,
          })
          skippedRecords[tableName] = tableData.length
        }
      }

      return {
        success: this.errors.filter((e) => e.fatal).length === 0,
        preRestoreSnapshotId,
        restoredRecords,
        skippedRecords,
        errors: this.errors,
        durationMs: Date.now() - startTime,
      }
    } catch (error) {
      return {
        success: false,
        preRestoreSnapshotId,
        restoredRecords: {},
        skippedRecords: {},
        errors: [
          {
            table: '',
            message: error instanceof Error ? error.message : 'Restore failed',
            fatal: true,
          },
        ],
        durationMs: Date.now() - startTime,
      }
    }
  }

  /**
   * Descomprime el snapshot.
   */
  private decompress(data: Uint8Array): ClinicSnapshot {
    try {
      const decompressed = ungzip(data)
      const json = new TextDecoder().decode(decompressed)
      return JSON.parse(json)
    } catch (error) {
      throw new SnapshotError(
        'Failed to decompress snapshot',
        'INVALID_SNAPSHOT',
        error
      )
    }
  }

  /**
   * Valida el checksum del snapshot.
   */
  private validateChecksum(snapshot: ClinicSnapshot): void {
    const dataJson = JSON.stringify(
      snapshot.data,
      Object.keys(snapshot.data).sort()
    )
    const calculated = createHash('sha256').update(dataJson).digest('hex')

    if (calculated !== snapshot.metadata.checksums.bundle) {
      throw new SnapshotError(
        'Snapshot checksum mismatch - data may be corrupted',
        'CHECKSUM_MISMATCH',
        { expected: snapshot.metadata.checksums.bundle, calculated }
      )
    }
  }

  /**
   * Simula la restauración sin hacer cambios.
   */
  private simulateRestore(snapshot: ClinicSnapshot): RestoreResult {
    const restoredRecords: Record<string, number> = {}
    const skippedRecords: Record<string, number> = {}

    for (const tableName of snapshot.manifest.foreignKeyOrder) {
      if (
        this.options.tables &&
        this.options.tables.length > 0 &&
        !this.options.tables.includes(tableName)
      ) {
        continue
      }

      const tableData = snapshot.data[tableName]
      if (tableData && tableData.length > 0) {
        restoredRecords[tableName] = tableData.length
      } else {
        skippedRecords[tableName] = 0
      }
    }

    return {
      success: true,
      restoredRecords,
      skippedRecords,
      errors: [],
      durationMs: 0,
    }
  }

  /**
   * Restaura una tabla específica.
   */
  private async restoreTable(
    tableName: string,
    data: unknown[],
    tableInfo: DiscoveredTable
  ): Promise<number> {
    if (this.options.mode === 'replace') {
      // Borrar datos existentes primero
      await this.deleteTableData(tableName, tableInfo)
    }

    // Insertar datos
    let restored = 0

    // Insertar en batches para evitar límites
    const batchSize = 100
    for (let i = 0; i < data.length; i += batchSize) {
      const batch = data.slice(i, i + batchSize)

      // Limpiar datos para inserción
      const cleanedBatch = batch.map((row) => this.cleanRowForInsert(row as Record<string, unknown>))

      const { error } = await this.supabase
        .from(tableName as 'treatments')
        .upsert(cleanedBatch, {
          onConflict: 'id',
          ignoreDuplicates: this.options.mode === 'merge',
        })

      if (error) {
        throw new Error(`Insert failed: ${error.message}`)
      }

      restored += batch.length
    }

    return restored
  }

  /**
   * Elimina datos de una tabla para la clínica.
   */
  private async deleteTableData(
    tableName: string,
    tableInfo: DiscoveredTable
  ): Promise<void> {
    if (tableInfo.category === 'direct' || tableInfo.category === 'hybrid') {
      const { error } = await this.supabase
        .from(tableName as 'treatments')
        .delete()
        .eq('clinic_id', this.clinicId)

      if (error) {
        throw new Error(`Delete failed: ${error.message}`)
      }
    } else if (tableInfo.category === 'indirect' && tableInfo.parentTable && tableInfo.parentColumn) {
      // Para tablas indirectas, necesitamos obtener los IDs del padre
      const { data: parentIds } = await this.supabase
        .from(tableInfo.parentTable as 'treatments')
        .select('id')
        .eq('clinic_id', this.clinicId)

      if (parentIds && parentIds.length > 0) {
        const ids = parentIds.map((p: { id: string }) => p.id)
        const { error } = await this.supabase
          .from(tableName as 'treatments')
          .delete()
          .in(tableInfo.parentColumn, ids)

        if (error) {
          throw new Error(`Delete indirect failed: ${error.message}`)
        }
      }
    }
  }

  /**
   * Limpia una fila para inserción.
   */
  private cleanRowForInsert(row: Record<string, unknown>): Record<string, unknown> {
    const cleaned: Record<string, unknown> = {}

    for (const [key, value] of Object.entries(row)) {
      // Excluir campos generados automáticamente
      if (key === 'created_at' || key === 'updated_at') {
        // Mantener timestamps originales si existen
        if (value) {
          cleaned[key] = value
        }
        continue
      }

      // Manejar null y undefined
      if (value === undefined) {
        continue
      }

      cleaned[key] = value
    }

    return cleaned
  }
}

/**
 * Factory function para crear un importer.
 */
export function createSnapshotImporter(
  supabase: SupabaseClient,
  clinicId: string,
  options?: Partial<RestoreOptions>
): ClinicSnapshotImporter {
  return new ClinicSnapshotImporter(supabase, clinicId, {
    mode: options?.mode || 'replace',
    createBackupFirst: options?.createBackupFirst ?? true,
    tables: options?.tables,
    dryRun: options?.dryRun ?? false,
  })
}
