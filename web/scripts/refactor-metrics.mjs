#!/usr/bin/env node

import { execSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'

const rootDir = process.cwd()
const projectRoot = dirname(rootDir)

function run(command) {
  try {
    return execSync(command, {
      cwd: projectRoot,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim()
  } catch (error) {
    if (error && typeof error === 'object' && 'status' in error && error.status === 1) {
      return ''
    }
    throw error
  }
}

function splitLines(raw) {
  if (!raw) return []
  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
}

function toPosixPath(pathValue) {
  return pathValue.replace(/\\/g, '/')
}

function listFiles(baseDir, exts) {
  const output = run(`rg --files ${baseDir}`)
  return splitLines(output).filter((file) => exts.some((ext) => file.endsWith(ext)))
}

function countLines(filePath) {
  const content = readFileSync(join(projectRoot, filePath), 'utf8')
  if (content.length === 0) return 0
  return content.split(/\r?\n/).length
}

function uniqueFilesFromRg(rgOutput) {
  const files = new Set()
  for (const line of splitLines(rgOutput)) {
    const firstColon = line.indexOf(':')
    if (firstColon === -1) continue
    files.add(line.slice(0, firstColon))
  }
  return Array.from(files)
}

const timestamp = new Date().toISOString()

const fetchMatches = run(
  String.raw`rg -n "fetch\(" web --glob "*.ts" --glob "*.tsx" --glob "!**/*.test.*" --glob "!**/node_modules/**"`
)
const fetchMatchLines = splitLines(fetchMatches)
const filesWithFetch = uniqueFilesFromRg(fetchMatches)

const anyMatches = run(
  String.raw`rg -n "\bany\b" web --glob "*.ts" --glob "*.tsx" --glob "!**/*.test.*" --glob "!**/node_modules/**"`
)
const anyMatchLines = splitLines(anyMatches)
const filesWithAny = uniqueFilesFromRg(anyMatches)

const apiRouteFiles = splitLines(run(String.raw`rg --files web/app/api --glob "**/route.ts"`))
const apiRoutesWithConsoleLog = splitLines(
  run(String.raw`rg -l "console\.log\(" web/app/api --glob "**/route.ts"`)
)
const apiRoutesWithValidation = splitLines(
  run(
    String.raw`rg -l "readJson\(|safeParse\(|validateSchema\(|validateRequest\(" web/app/api --glob "**/route.ts"`
  )
)
const apiRoutesWithoutValidation = apiRouteFiles.filter((file) => !apiRoutesWithValidation.includes(file))

const sourceFiles = listFiles('web', ['.ts', '.tsx'])
const filesOver400 = sourceFiles
  .map((file) => ({ file, lines: countLines(file) }))
  .filter((item) => item.lines >= 400)
  .sort((a, b) => b.lines - a.lines)

const metrics = {
  generatedAt: timestamp,
  scope: 'web',
  totals: {
    fetchOccurrences: fetchMatchLines.length,
    filesWithFetch: filesWithFetch.length,
    anyOccurrences: anyMatchLines.length,
    filesWithAny: filesWithAny.length,
    apiRoutes: apiRouteFiles.length,
    apiRoutesWithConsoleLog: apiRoutesWithConsoleLog.length,
    apiRoutesWithValidationSignals: apiRoutesWithValidation.length,
    apiRoutesWithoutValidationSignals: apiRoutesWithoutValidation.length,
    filesOver400Lines: filesOver400.length,
  },
  details: {
    filesWithFetch: filesWithFetch.map(toPosixPath).sort(),
    filesWithAny: filesWithAny.map(toPosixPath).sort(),
    apiRoutesWithConsoleLog: apiRoutesWithConsoleLog.map(toPosixPath).sort(),
    apiRoutesWithoutValidationSignals: apiRoutesWithoutValidation.map(toPosixPath).sort(),
    topLargeFiles: filesOver400.slice(0, 50).map((item) => ({
      file: toPosixPath(item.file),
      lines: item.lines,
    })),
  },
}

const outputDir = join(projectRoot, 'docs', 'refactor')
mkdirSync(outputDir, { recursive: true })

const jsonPath = join(outputDir, 'metrics-baseline.json')
writeFileSync(jsonPath, `${JSON.stringify(metrics, null, 2)}\n`, 'utf8')

const markdown = [
  '# Refactor Baseline Metrics',
  '',
  `Generated at: ${timestamp}`,
  '',
  '## Totals',
  '',
  `- fetch occurrences: ${metrics.totals.fetchOccurrences}`,
  `- files with fetch: ${metrics.totals.filesWithFetch}`,
  `- any occurrences: ${metrics.totals.anyOccurrences}`,
  `- files with any: ${metrics.totals.filesWithAny}`,
  `- api routes: ${metrics.totals.apiRoutes}`,
  `- api routes with console.log: ${metrics.totals.apiRoutesWithConsoleLog}`,
  `- api routes with validation signals: ${metrics.totals.apiRoutesWithValidationSignals}`,
  `- api routes without validation signals: ${metrics.totals.apiRoutesWithoutValidationSignals}`,
  `- files >= 400 lines: ${metrics.totals.filesOver400Lines}`,
  '',
  '## Top Large Files',
  '',
  ...metrics.details.topLargeFiles.slice(0, 20).map((item) => `- ${item.file}: ${item.lines}`),
  '',
  '## API Routes Without Validation Signals',
  '',
  ...metrics.details.apiRoutesWithoutValidationSignals.slice(0, 50).map((file) => `- ${file}`),
  '',
]

const mdPath = join(outputDir, 'metrics-baseline.md')
writeFileSync(mdPath, markdown.join('\n'), 'utf8')

const relativeJsonPath = toPosixPath(relative(projectRoot, jsonPath))
const relativeMdPath = toPosixPath(relative(projectRoot, mdPath))
console.info(`[refactor:metrics] wrote ${relativeJsonPath}`)
console.info(`[refactor:metrics] wrote ${relativeMdPath}`)
