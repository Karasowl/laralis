export type DataBackend = 'supabase' | 'convex' | 'dual_read' | 'dual_write'
export type DataReadBackend = 'supabase' | 'convex'
export type DataWriteMode = 'supabase' | 'convex' | 'dual'

const DEFAULT_BACKEND: DataBackend = 'supabase'

function normalizeDomain(domain?: string) {
  return domain ? domain.toUpperCase().replace(/[^A-Z0-9]+/g, '_') : null
}

export function getDataBackend(domain?: string): DataBackend {
  const normalizedDomain = normalizeDomain(domain)
  const domainKey = normalizedDomain ? `DATA_BACKEND_${normalizedDomain}` : null
  const raw = (domainKey ? process.env[domainKey] : null) ?? process.env.DATA_BACKEND ?? DEFAULT_BACKEND

  if (raw === 'supabase' || raw === 'convex' || raw === 'dual_read' || raw === 'dual_write') {
    return raw
  }

  return DEFAULT_BACKEND
}

export function getDataReadBackend(domain?: string): DataReadBackend {
  const normalizedDomain = normalizeDomain(domain)
  const domainKey = normalizedDomain ? `DATA_READ_BACKEND_${normalizedDomain}` : null
  const raw = (domainKey ? process.env[domainKey] : null) ?? process.env.DATA_READ_BACKEND

  if (raw === 'supabase' || raw === 'convex') return raw
  return getDataBackend(domain) === 'convex' ? 'convex' : 'supabase'
}

export function getDataWriteMode(domain?: string): DataWriteMode {
  const normalizedDomain = normalizeDomain(domain)
  const domainKey = normalizedDomain ? `DATA_WRITE_MODE_${normalizedDomain}` : null
  const raw = (domainKey ? process.env[domainKey] : null) ?? process.env.DATA_WRITE_MODE

  if (raw === 'supabase' || raw === 'convex' || raw === 'dual') return raw

  const backend = getDataBackend(domain)
  if (backend === 'dual_write') return 'dual'
  if (backend === 'convex') return 'dual'
  return 'supabase'
}

export function shouldReturnConvexData(domain?: string) {
  return getDataReadBackend(domain) === 'convex'
}

export function shouldCompareConvexData(domain?: string) {
  const backend = getDataBackend(domain)
  return backend === 'dual_read' || backend === 'dual_write' || process.env.DATA_COMPARE_CONVEX === '1'
}

export function shouldWriteConvexData(domain?: string) {
  const mode = getDataWriteMode(domain)
  return mode === 'convex' || mode === 'dual'
}

export function shouldWriteSupabaseData(domain?: string) {
  const mode = getDataWriteMode(domain)
  return mode === 'supabase' || mode === 'dual'
}

export function shouldUseConvexOnlyWritePath(domain?: string) {
  return getDataWriteMode(domain) === 'convex'
}
