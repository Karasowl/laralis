/**
 * Clinic Snapshot System - Type Definitions
 *
 * Sistema de backup/snapshot por clínica con descubrimiento dinámico de tablas.
 * Garantiza completitud usando information_schema en vez de listas hardcodeadas.
 */

// ============================================================================
// Core Types
// ============================================================================

export interface ClinicSnapshot {
  metadata: SnapshotMetadata
  manifest: SnapshotManifest
  data: ClinicData
}

export interface SnapshotMetadata {
  /** UUID del snapshot */
  id: string
  /** ID de la clínica */
  clinicId: string
  /** Nombre de la clínica para referencia */
  clinicName: string
  /** ID del workspace */
  workspaceId: string
  /** Timestamp ISO de creación */
  createdAt: string
  /** Usuario que creó el snapshot */
  createdBy: {
    userId: string
    email: string
  }
  /** Tipo de snapshot */
  type: SnapshotType
  /** Versión del schema de la base de datos */
  schemaVersion: number
  /** Versión de la aplicación */
  appVersion: string
  /** Checksums para verificación de integridad */
  checksums: SnapshotChecksums
  /** Estadísticas del snapshot */
  stats: SnapshotStats
}

export type SnapshotType = 'manual' | 'scheduled' | 'pre-restore'

export interface SnapshotChecksums {
  /** SHA-256 del snapshot completo */
  bundle: string
  /** SHA-256 por tabla */
  perTable: Record<string, string>
}

export interface SnapshotStats {
  /** Total de registros en el snapshot */
  totalRecords: number
  /** Registros por tabla */
  recordsByTable: Record<string, number>
  /** Tamaño comprimido en bytes */
  compressedSizeBytes: number
  /** Tamaño sin comprimir en bytes */
  uncompressedSizeBytes: number
  /** Duración de la exportación en ms */
  exportDurationMs: number
}

// ============================================================================
// Manifest Types
// ============================================================================

export interface SnapshotManifest {
  /** Lista de tablas incluidas */
  tables: TableManifestEntry[]
  /** Orden correcto de inserción (respeta FKs) */
  foreignKeyOrder: string[]
  /** Timestamp de cuando se descubrieron las tablas */
  discoveredAt: string
  /** Método de descubrimiento (siempre 'dynamic') */
  discoveryMethod: 'dynamic'
}

export interface TableManifestEntry {
  /** Nombre de la tabla */
  name: string
  /** Categoría de la tabla */
  category: TableCategory
  /** Tabla padre (para tablas indirectas) */
  parentTable?: string
  /** Columna FK hacia la tabla padre */
  parentColumn?: string
  /** Número de registros */
  recordCount: number
  /** Checksum SHA-256 de los datos */
  checksum: string
  /** Columnas incluidas */
  columns: string[]
}

export type TableCategory = 'direct' | 'indirect' | 'hybrid'

// ============================================================================
// Discovery Types
// ============================================================================

export interface DiscoveredTable {
  /** Nombre de la tabla */
  name: string
  /** Categoría de la tabla */
  category: TableCategory
  /** Nombre de la columna clinic_id (null para indirectas) */
  clinicIdColumn: string | null
  /** Tabla padre para tablas indirectas */
  parentTable?: string
  /** Columna FK hacia la tabla padre */
  parentColumn?: string
  /** Si clinic_id es nullable (para tablas híbridas) */
  isNullable: boolean
}

export interface DiscoveryResult {
  /** Lista de tablas descubiertas */
  tables: DiscoveredTable[]
  /** Orden de inserción calculado */
  foreignKeyOrder: string[]
  /** Timestamp del descubrimiento */
  discoveredAt: string
  /** Método usado */
  method: 'dynamic'
}

export interface TableColumnInfo {
  columnName: string
  dataType: string
  isNullable: boolean
  columnDefault: string | null
}

export interface ForeignKeyInfo {
  constraintName: string
  columnName: string
  foreignTable: string
  foreignColumn: string
}

// ============================================================================
// Data Types
// ============================================================================

/** Datos de la clínica indexados por nombre de tabla */
export type ClinicData = Record<string, unknown[]>

// ============================================================================
// Export Options
// ============================================================================

export interface ExportOptions {
  /** Tipo de snapshot */
  type: SnapshotType
  /** Cifrar el contenido (AES-256) */
  encrypt?: boolean
  /** Comprimir (gzip) - siempre true */
  compress?: boolean
  /** Usuario que realiza la exportación */
  userId: string
  /** Email del usuario */
  userEmail: string
}

export interface ExportResult {
  /** ID del snapshot creado */
  snapshotId: string
  /** Ruta en storage */
  storagePath: string
  /** Estadísticas */
  stats: SnapshotStats
}

// ============================================================================
// Restore Options
// ============================================================================

export interface RestoreOptions {
  /** Modo de restauración */
  mode: RestoreMode
  /** Crear backup antes de restaurar (recomendado) */
  createBackupFirst: boolean
  /** Tablas específicas a restaurar (opcional, default: todas) */
  tables?: string[]
  /** Modo simulación (no hace cambios) */
  dryRun?: boolean
}

export type RestoreMode = 'replace' | 'merge'

export interface RestoreResult {
  /** Si la restauración fue exitosa */
  success: boolean
  /** ID del snapshot pre-restore (si se creó backup) */
  preRestoreSnapshotId?: string
  /** Registros restaurados por tabla */
  restoredRecords: Record<string, number>
  /** Registros omitidos por tabla */
  skippedRecords: Record<string, number>
  /** Errores encontrados */
  errors: RestoreError[]
  /** Duración total en ms */
  durationMs: number
}

export interface RestoreError {
  /** Tabla donde ocurrió el error */
  table: string
  /** ID del registro (si aplica) */
  recordId?: string
  /** Mensaje de error */
  message: string
  /** Si el error es fatal */
  fatal: boolean
}

// ============================================================================
// Storage Types
// ============================================================================

export interface StorageManifest {
  /** Lista de snapshots */
  snapshots: SnapshotMetadata[]
  /** Última actualización */
  updatedAt: string
}

export interface StorageConfig {
  /** Nombre del bucket */
  bucketName: string
  /** Límite de tamaño de archivo en bytes */
  fileSizeLimit: number
  /** Tipos MIME permitidos */
  allowedMimeTypes: string[]
  /** Días de retención */
  retentionDays: number
  /** Máximo número de snapshots por clínica */
  maxSnapshotsPerClinic: number
}

export const DEFAULT_STORAGE_CONFIG: StorageConfig = {
  bucketName: 'clinic-snapshots',
  fileSizeLimit: 100 * 1024 * 1024, // 100MB
  allowedMimeTypes: ['application/json', 'application/gzip'],
  retentionDays: 30,
  maxSnapshotsPerClinic: 30,
}

// ============================================================================
// Database Record Types (for clinic_snapshots table)
// ============================================================================

export interface ClinicSnapshotRecord {
  id: string
  clinic_id: string
  created_by: string | null
  created_at: string
  type: SnapshotType
  status: SnapshotStatus
  storage_path: string
  checksum: string
  compressed_size_bytes: number | null
  uncompressed_size_bytes: number | null
  record_counts: Record<string, number>
  schema_version: number
  retention_days: number
  expires_at: string | null
  error_message: string | null
  metadata: Record<string, unknown>
}

export type SnapshotStatus = 'pending' | 'completed' | 'failed'

// ============================================================================
// API Types
// ============================================================================

export interface ListSnapshotsResponse {
  snapshots: SnapshotMetadata[]
  totalCount: number
}

export interface CreateSnapshotRequest {
  type?: SnapshotType
  encrypt?: boolean
}

export interface CreateSnapshotResponse {
  success: boolean
  snapshotId: string
  stats: SnapshotStats
}

export interface RestoreSnapshotRequest {
  mode?: RestoreMode
  createBackupFirst?: boolean
  tables?: string[]
  dryRun?: boolean
}

export interface RestoreSnapshotResponse extends RestoreResult {}

export interface DiscoverTablesResponse extends DiscoveryResult {}

// ============================================================================
// Error Types
// ============================================================================

export class SnapshotError extends Error {
  constructor(
    message: string,
    public code: SnapshotErrorCode,
    public details?: unknown
  ) {
    super(message)
    this.name = 'SnapshotError'
  }
}

export type SnapshotErrorCode =
  | 'DISCOVERY_FAILED'
  | 'EXPORT_FAILED'
  | 'STORAGE_UPLOAD_FAILED'
  | 'STORAGE_DOWNLOAD_FAILED'
  | 'CHECKSUM_MISMATCH'
  | 'RESTORE_FAILED'
  | 'PERMISSION_DENIED'
  | 'SNAPSHOT_NOT_FOUND'
  | 'INVALID_SNAPSHOT'
  | 'QUOTA_EXCEEDED'
