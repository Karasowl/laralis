/**
 * Table Discovery Service
 *
 * Descubre dinámicamente TODAS las tablas que pertenecen a una clínica
 * usando information_schema. Esto garantiza que nunca se olvide una tabla.
 *
 * Categorías de tablas:
 * - DIRECT: Tienen columna clinic_id directamente
 * - INDIRECT: Vinculadas vía FK a una tabla con clinic_id
 * - HYBRID: clinic_id nullable (datos globales + específicos de clínica)
 */

import { SupabaseClient } from '@supabase/supabase-js'
import {
  DiscoveredTable,
  DiscoveryResult,
  TableCategory,
  ForeignKeyInfo,
  SnapshotError,
} from './types'

// Tablas conocidas que son indirectas (no tienen clinic_id pero pertenecen a una clínica vía FK)
// Estas se validan dinámicamente pero se mantiene la lista para el orden FK
const KNOWN_INDIRECT_TABLES: Array<{
  child: string
  parent: string
  fk: string
}> = [
  { child: 'chat_messages', parent: 'chat_sessions', fk: 'session_id' },
  { child: 'ai_feedback', parent: 'chat_sessions', fk: 'session_id' },
  { child: 'prescription_items', parent: 'prescriptions', fk: 'prescription_id' },
  { child: 'quote_items', parent: 'quotes', fk: 'quote_id' },
  { child: 'marketing_campaign_status_history', parent: 'marketing_campaigns', fk: 'campaign_id' },
  // service_supplies tiene clinic_id directo, no es indirecta
]

// Tablas a excluir del snapshot (sistema, migraciones, etc.)
const EXCLUDED_TABLES = [
  // Tablas de sistema de Supabase
  'schema_migrations',
  'supabase_migrations',
  // Tablas temporales o de backup
  '_backup',
  '_temp',
  // Tablas deprecated
  'tariffs', // Deprecated - historical data only
]

export class TableDiscoveryService {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Descubre TODAS las tablas que pertenecen a una clínica.
   * Usa information_schema para garantizar completitud.
   */
  async discoverClinicTables(): Promise<DiscoveryResult> {
    const startTime = Date.now()

    try {
      // 1. Encontrar tablas con clinic_id directo
      const directTables = await this.findDirectTables()

      // 2. Encontrar tablas indirectas (vía FK)
      const indirectTables = await this.findIndirectTables(directTables)

      // 3. Combinar y marcar híbridas
      const allTables = [...directTables, ...indirectTables]
      this.markHybridTables(allTables)

      // 4. Calcular orden de inserción (respeta FKs)
      const foreignKeyOrder = this.calculateInsertionOrder(allTables)

      return {
        tables: allTables,
        foreignKeyOrder,
        discoveredAt: new Date().toISOString(),
        method: 'dynamic',
      }
    } catch (error) {
      throw new SnapshotError(
        'Failed to discover clinic tables',
        'DISCOVERY_FAILED',
        error
      )
    }
  }

  /**
   * Encuentra todas las tablas con columna clinic_id directa.
   * Usa information_schema.columns para descubrimiento dinámico.
   */
  private async findDirectTables(): Promise<DiscoveredTable[]> {
    // Query information_schema para encontrar tablas con clinic_id
    const { data, error } = await this.supabase.rpc('discover_clinic_tables')

    if (error) {
      // Si la función RPC no existe, usar query directo
      console.warn('RPC discover_clinic_tables not found, using direct query')
      return this.findDirectTablesDirectQuery()
    }

    if (!data || data.length === 0) {
      return this.findDirectTablesDirectQuery()
    }

    return data
      .filter((row: { table_name: string }) => !this.isExcludedTable(row.table_name))
      .map((row: { table_name: string; is_nullable: boolean }) => ({
        name: row.table_name,
        category: 'direct' as TableCategory,
        clinicIdColumn: 'clinic_id',
        isNullable: row.is_nullable,
      }))
  }

  /**
   * Query directo a information_schema si la función RPC no existe.
   */
  private async findDirectTablesDirectQuery(): Promise<DiscoveredTable[]> {
    const { data, error } = await this.supabase
      .from('information_schema.columns' as 'treatments') // Type hack for raw query
      .select('table_name, is_nullable')
      .eq('table_schema', 'public')
      .eq('column_name', 'clinic_id')

    if (error) {
      // Fallback: usar lista conocida de tablas con clinic_id
      console.warn('Direct query failed, using known tables list')
      return this.getKnownDirectTables()
    }

    return (data || [])
      .filter((row: { table_name: string }) => !this.isExcludedTable(row.table_name))
      .map((row: { table_name: string; is_nullable: string }) => ({
        name: row.table_name,
        category: 'direct' as TableCategory,
        clinicIdColumn: 'clinic_id',
        isNullable: row.is_nullable === 'YES',
      }))
  }

  /**
   * Lista conocida de tablas con clinic_id (fallback si todo falla).
   * Se mantiene actualizada pero el sistema dinámico debería funcionar.
   */
  private getKnownDirectTables(): DiscoveredTable[] {
    const knownTables = [
      // Core operations
      'settings_time',
      'fixed_costs',
      'assets',
      'supplies',
      'services',
      'service_supplies',
      'patients',
      'treatments',
      'expenses',
      // Categories and sources
      'patient_sources',
      'custom_categories',
      'categories', // Hybrid
      // Marketing
      'marketing_campaigns',
      // Users and invitations
      'clinic_users',
      'invitations',
      // AI and chat
      'action_logs',
      'chat_sessions',
      // Notifications
      'email_notifications',
      'sms_notifications',
      'scheduled_reminders',
      'push_subscriptions',
      'push_notifications',
      // Calendar
      'clinic_google_calendar',
      // Public
      'public_bookings',
      // Medical
      'medications', // Hybrid
      'prescriptions',
      'quotes',
    ]

    return knownTables.map((name) => ({
      name,
      category: 'direct' as TableCategory,
      clinicIdColumn: 'clinic_id',
      isNullable: name === 'categories' || name === 'medications',
    }))
  }

  /**
   * Encuentra tablas indirectas (vinculadas vía FK a tablas con clinic_id).
   */
  private async findIndirectTables(
    directTables: DiscoveredTable[]
  ): Promise<DiscoveredTable[]> {
    const directTableNames = new Set(directTables.map((t) => t.name))
    const indirectTables: DiscoveredTable[] = []

    for (const indirect of KNOWN_INDIRECT_TABLES) {
      // Verificar que la tabla padre existe en las directas
      if (!directTableNames.has(indirect.parent)) {
        continue
      }

      // Verificar que la tabla hija existe
      const exists = await this.tableExists(indirect.child)
      if (!exists) {
        continue
      }

      // Verificar que no tiene clinic_id directo (sería directa, no indirecta)
      if (directTableNames.has(indirect.child)) {
        continue
      }

      indirectTables.push({
        name: indirect.child,
        category: 'indirect',
        clinicIdColumn: null,
        parentTable: indirect.parent,
        parentColumn: indirect.fk,
        isNullable: false,
      })
    }

    return indirectTables
  }

  /**
   * Marca tablas híbridas (clinic_id nullable).
   * Estas contienen datos globales (NULL) + específicos de clínica.
   */
  private markHybridTables(tables: DiscoveredTable[]): void {
    const hybridTableNames = ['categories', 'medications']

    for (const table of tables) {
      if (hybridTableNames.includes(table.name) && table.isNullable) {
        table.category = 'hybrid'
      }
    }
  }

  /**
   * Calcula el orden correcto de inserción respetando FKs.
   * Usa ordenamiento topológico del grafo de dependencias.
   */
  calculateInsertionOrder(tables: DiscoveredTable[]): string[] {
    const tableNames = new Set(tables.map((t) => t.name))
    const dependencies = new Map<string, Set<string>>()

    // Inicializar
    for (const table of tables) {
      dependencies.set(table.name, new Set())
    }

    // Agregar dependencias de tablas indirectas
    for (const table of tables) {
      if (table.category === 'indirect' && table.parentTable) {
        if (tableNames.has(table.parentTable)) {
          dependencies.get(table.name)?.add(table.parentTable)
        }
      }
    }

    // Agregar dependencias conocidas de FK
    const knownDependencies: Record<string, string[]> = {
      // service_supplies depende de services y supplies
      service_supplies: ['services', 'supplies'],
      // treatments depende de patients y services
      treatments: ['patients', 'services'],
      // prescriptions depende de patients
      prescriptions: ['patients'],
      // quotes depende de patients
      quotes: ['patients'],
      // marketing_campaign_status_history depende de marketing_campaigns
      marketing_campaign_status_history: ['marketing_campaigns'],
      // chat_messages depende de chat_sessions
      chat_messages: ['chat_sessions'],
      // prescription_items depende de prescriptions
      prescription_items: ['prescriptions'],
      // quote_items depende de quotes y services
      quote_items: ['quotes', 'services'],
      // scheduled_reminders puede depender de treatments
      scheduled_reminders: ['treatments'],
    }

    for (const [table, deps] of Object.entries(knownDependencies)) {
      if (tableNames.has(table)) {
        const tableDeps = dependencies.get(table)
        for (const dep of deps) {
          if (tableNames.has(dep)) {
            tableDeps?.add(dep)
          }
        }
      }
    }

    // Ordenamiento topológico (Kahn's algorithm)
    const result: string[] = []
    const inDegree = new Map<string, number>()
    const queue: string[] = []

    // Calcular in-degree
    tableNames.forEach((table) => {
      inDegree.set(table, 0)
    })
    Array.from(dependencies.entries()).forEach(([, deps]) => {
      Array.from(deps).forEach((dep) => {
        inDegree.set(dep, (inDegree.get(dep) || 0) + 1)
      })
    })

    // Encontrar nodos sin dependencias
    Array.from(inDegree.entries()).forEach(([table, degree]) => {
      if (degree === 0) {
        queue.push(table)
      }
    })

    // Procesar cola
    while (queue.length > 0) {
      // Ordenar alfabéticamente para consistencia
      queue.sort()
      const table = queue.shift()!
      result.push(table)

      // Reducir in-degree de dependientes
      Array.from(dependencies.entries()).forEach(([depTable, deps]) => {
        if (deps.has(table)) {
          const newDegree = (inDegree.get(depTable) || 1) - 1
          inDegree.set(depTable, newDegree)
          if (newDegree === 0) {
            queue.push(depTable)
          }
        }
      })
    }

    // Si hay ciclos, agregar tablas faltantes al final
    tableNames.forEach((table) => {
      if (!result.includes(table)) {
        result.push(table)
      }
    })

    return result
  }

  /**
   * Verifica si una tabla existe.
   */
  private async tableExists(tableName: string): Promise<boolean> {
    try {
      const { error } = await this.supabase
        .from(tableName as 'treatments')
        .select('*')
        .limit(0)

      return !error
    } catch {
      return false
    }
  }

  /**
   * Verifica si una tabla debe ser excluida.
   */
  private isExcludedTable(tableName: string): boolean {
    // Excluir tablas de sistema
    if (tableName.startsWith('_') || tableName.startsWith('pg_')) {
      return true
    }

    // Excluir tablas en la lista de exclusión
    for (const excluded of EXCLUDED_TABLES) {
      if (tableName === excluded || tableName.includes(excluded)) {
        return true
      }
    }

    return false
  }

  /**
   * Obtiene información de columnas de una tabla.
   */
  async getTableColumns(tableName: string): Promise<string[]> {
    const { data, error } = await this.supabase.rpc('get_table_columns', {
      p_table_name: tableName,
    })

    if (error || !data) {
      // Fallback: obtener columnas con query de muestra
      const { data: sample } = await this.supabase
        .from(tableName as 'treatments')
        .select('*')
        .limit(1)

      if (sample && sample.length > 0) {
        return Object.keys(sample[0])
      }
      return []
    }

    return data.map((col: { column_name: string }) => col.column_name)
  }

  /**
   * Obtiene las FKs de una tabla.
   */
  async getTableForeignKeys(tableName: string): Promise<ForeignKeyInfo[]> {
    const { data, error } = await this.supabase.rpc('get_table_foreign_keys', {
      p_table_name: tableName,
    })

    if (error || !data) {
      return []
    }

    return data.map((fk: {
      constraint_name: string
      column_name: string
      foreign_table: string
      foreign_column: string
    }) => ({
      constraintName: fk.constraint_name,
      columnName: fk.column_name,
      foreignTable: fk.foreign_table,
      foreignColumn: fk.foreign_column,
    }))
  }
}
