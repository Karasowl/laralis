type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface LogPayload {
  requestId?: string
  [key: string]: unknown
}

function shouldLogDebug() {
  return process.env.NODE_ENV !== 'production'
}

function write(level: LogLevel, event: string, payload?: LogPayload) {
  if (level === 'debug' && !shouldLogDebug()) return

  const message = {
    ts: new Date().toISOString(),
    level,
    event,
    ...payload,
  }
  const output = JSON.stringify(message)

  if (level === 'error') {
    console.error(output)
    return
  }
  if (level === 'warn') {
    console.warn(output)
    return
  }
  console.info(output)
}

export function createRouteLogger(requestId: string) {
  return {
    debug: (event: string, payload?: Omit<LogPayload, 'requestId'>) =>
      write('debug', event, { requestId, ...payload }),
    info: (event: string, payload?: Omit<LogPayload, 'requestId'>) =>
      write('info', event, { requestId, ...payload }),
    warn: (event: string, payload?: Omit<LogPayload, 'requestId'>) =>
      write('warn', event, { requestId, ...payload }),
    error: (event: string, payload?: Omit<LogPayload, 'requestId'>) =>
      write('error', event, { requestId, ...payload }),
  }
}
