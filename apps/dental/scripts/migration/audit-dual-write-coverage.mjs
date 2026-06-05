import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const appRoot = path.resolve(scriptDir, '..', '..')
const repoRoot = path.resolve(appRoot, '..', '..')
const outputDir = path.join(repoRoot, 'tmp', 'convex-migration-audit')

const SCAN_ROOTS = [
  path.join(appRoot, 'app'),
  path.join(appRoot, 'lib'),
]

const RAW_SUPABASE_CLIENT_IMPORT = /from\s+['"]@supabase\/(?:supabase-js|ssr)['"]/
const MIRRORED_IMPORTS = [
  /from\s+['"]@\/lib\/supabaseAdmin['"]/,
  /from\s+['"]@\/lib\/supabase\/server['"]/,
  /from\s+['"]@\/lib\/convex\/supabase-runtime-mirror['"]/,
  /from\s+['"]\.\/supabaseAdmin['"]/,
]
const WRAPPER_ALLOWLIST = new Set([
  normalizePath(path.join(appRoot, 'lib', 'supabaseAdmin.ts')),
  normalizePath(path.join(appRoot, 'lib', 'supabase', 'server.ts')),
  normalizePath(path.join(appRoot, 'lib', 'supabase', 'client.ts')),
  normalizePath(path.join(appRoot, 'lib', 'convex', 'supabase-runtime-mirror.ts')),
])
const SUPABASE_FROM_CONTEXT = /(?:supabaseAdmin|supabase|db|this\.supabase|query|patientQuery)\s*[\s\S]{0,180}\.from\s*\(/

const AUTH_ONLY_DIRECT_CLIENT_ALLOWLIST = [
  /app\/auth\/callback\/route\.ts$/,
  /app\/auth\/logout\/route\.ts$/,
  /app\/api\/auth\/delete-account\/route\.ts$/,
  /app\/api\/auth\/delete-account\/send-code\/route\.ts$/,
  /middleware\.ts$/,
]

const options = parseArgs(process.argv.slice(2))
const files = SCAN_ROOTS.flatMap((root) => listSourceFiles(root))
const fileResults = files.map(analyzeFile)
const highRisk = fileResults.filter((result) => result.risk === 'high')
const manualReview = fileResults.filter((result) => result.risk === 'manual_review')
const directClientImports = fileResults.filter((result) => result.directClientImport)
const supabaseWrites = fileResults.filter((result) => result.dbWrites.length > 0)
const generatedAt = new Date().toISOString()

const report = {
  ok: highRisk.length === 0,
  generatedAt,
  totals: {
    filesScanned: files.length,
    filesWithSupabaseWrites: supabaseWrites.length,
    filesWithDirectClientImports: directClientImports.length,
    highRisk: highRisk.length,
    manualReview: manualReview.length,
  },
  highRisk,
  manualReview,
  directClientImports,
}

fs.mkdirSync(outputDir, { recursive: true })
const outputPath = path.join(
  outputDir,
  `dual-write-coverage-${generatedAt.replace(/[-:.]/g, '').slice(0, 15)}Z.json`
)
fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`)

console.log(JSON.stringify({
  ok: report.ok,
  outputPath: path.relative(repoRoot, outputPath),
  totals: report.totals,
}, null, 2))

if (!report.ok && options.strict) {
  process.exit(1)
}

function analyzeFile(filePath) {
  const text = fs.readFileSync(filePath, 'utf8')
  const normalizedPath = normalizePath(filePath)
  const relativePath = normalizePath(path.relative(repoRoot, filePath))
  const directClientImport = RAW_SUPABASE_CLIENT_IMPORT.test(text)
  const mirroredImport = MIRRORED_IMPORTS.some((pattern) => pattern.test(text))
  const dbWrites = findSupabaseWrites(text)
  const rawDirectDbWrites = dbWrites.filter((write) =>
    write.context.includes('createServerClient') ||
    write.context.includes('createBrowserClient') ||
    write.context.includes('createClient(')
  )
  const usesHelperInjectedClient = dbWrites.some((write) => write.context.includes('this.supabase'))

  let risk = 'low'
  let reason = null

  if (WRAPPER_ALLOWLIST.has(normalizedPath)) {
    risk = 'low'
    reason = 'Supabase client wrapper file'
  } else if (dbWrites.length > 0 && directClientImport && rawDirectDbWrites.length > 0) {
    risk = 'high'
    reason = 'Database write appears to use a raw Supabase client import'
  } else if (dbWrites.length > 0 && !mirroredImport && usesHelperInjectedClient) {
    risk = 'manual_review'
    reason = 'Database writes use an injected Supabase client; caller must pass mirrored client'
  } else if (dbWrites.length > 0 && !mirroredImport && !AUTH_ONLY_DIRECT_CLIENT_ALLOWLIST.some((pattern) => pattern.test(relativePath))) {
    risk = 'manual_review'
    reason = 'Database writes found without an obvious mirrored client import'
  } else if (directClientImport && !WRAPPER_ALLOWLIST.has(normalizedPath)) {
    risk = 'low'
    reason = 'Direct Supabase client import without detected database writes'
  }

  return {
    file: relativePath,
    risk,
    reason,
    directClientImport,
    mirroredImport,
    dbWrites,
  }
}

function findSupabaseWrites(text) {
  const lines = text.split(/\r?\n/)
  const writes = []

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]
    const match = line.match(/\.(insert|upsert|update|delete)\s*\(/)
    if (!match) continue

    const fromIndex = Math.max(0, index - 12)
    const contextLines = lines.slice(fromIndex, index + 1)
    const context = contextLines.join('\n')
    if (!SUPABASE_FROM_CONTEXT.test(context)) continue

    writes.push({
      line: index + 1,
      operation: match[1],
      context: context
        .split(/\r?\n/)
        .map((entry) => entry.trim())
        .filter(Boolean)
        .join(' ')
        .slice(0, 500),
    })
  }

  return writes
}

function listSourceFiles(root) {
  if (!fs.existsSync(root)) return []

  const entries = fs.readdirSync(root, { withFileTypes: true })
  const files = []

  for (const entry of entries) {
    const fullPath = path.join(root, entry.name)
    if (entry.isDirectory()) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue
      files.push(...listSourceFiles(fullPath))
    } else if (/\.(ts|tsx)$/.test(entry.name) && !/\.(test|spec)\.(ts|tsx)$/.test(entry.name)) {
      files.push(fullPath)
    }
  }

  return files
}

function normalizePath(value) {
  return value.replace(/\\/g, '/')
}

function parseArgs(args) {
  return {
    strict: args.includes('--strict'),
  }
}
