export type ConvexLegacyRow = Record<string, unknown>

const COMPOSITE_LEGACY_KEYS: Record<string, string[]> = {
  user_settings: ['user_id', 'key'],
  storage_objects: ['bucket', 'path'],
}

export function getLegacyIdForTable(
  table: string,
  row: ConvexLegacyRow | null | undefined,
  explicitLegacyId?: string | number | null
) {
  if (explicitLegacyId !== undefined && explicitLegacyId !== null) {
    return String(explicitLegacyId)
  }

  const directId = row?.legacyId ?? row?.id
  if (directId !== undefined && directId !== null) {
    return String(directId)
  }

  const compositeKeys = COMPOSITE_LEGACY_KEYS[table]
  if (!row || !compositeKeys) return null

  const parts = compositeKeys.map((key) => row[key])
  if (parts.some((part) => part === undefined || part === null || part === '')) return null

  return `${table}:${parts.map((part) => encodeLegacyIdPart(part)).join(':')}`
}

export function prepareConvexRow(row: ConvexLegacyRow, table: string, legacyId?: string | number | null) {
  const encoded = encodeConvexValue(row) as ConvexLegacyRow
  const resolvedLegacyId = getLegacyIdForTable(table, encoded, legacyId ?? undefined)

  if (resolvedLegacyId && encoded.legacyId === undefined) {
    encoded.legacyId = resolvedLegacyId
  }

  if (resolvedLegacyId && encoded.id === undefined) {
    encoded.id = resolvedLegacyId
  }

  encoded.legacyTable = table
  return encoded
}

export function encodeConvexValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((item) => encodeConvexValue(item))

  if (value && typeof value === 'object') {
    const object: ConvexLegacyRow = {}
    for (const [key, child] of Object.entries(value as ConvexLegacyRow)) {
      object[encodeConvexFieldName(key)] = encodeConvexValue(child)
    }
    return object
  }

  return value
}

function encodeConvexFieldName(key: string) {
  let encoded = ''

  for (const char of key) {
    encoded += /[A-Za-z0-9_]/.test(char) ? char : `_u${char.codePointAt(0)?.toString(16)}_`
  }

  if (!encoded) encoded = '_empty'
  if (encoded === '_id' || encoded === '_creationTime') encoded = `legacy${encoded}`
  return encoded
}

function encodeLegacyIdPart(value: unknown) {
  return encodeURIComponent(String(value))
}
