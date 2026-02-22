/**
 * Spawns traceroute/tracert as a child process and emits parsed hop events.
 *
 * Security: uses spawn() with an args array — never shell interpolation.
 */

import { spawn } from 'node:child_process'
import { getTraceCommand, getCurrentPlatform } from './platform.js'
import { parseTraceLine } from './parser.js'

const MAX_RUNTIME_MS = 60_000

/**
 * @typedef {Object} RunCallbacks
 * @property {(hop: import('./parser.js').HopResult) => void} onHop
 * @property {(line: string) => void} onRaw
 * @property {(message: string) => void} onError
 * @property {() => void} onComplete
 */

/**
 * Run a traceroute to the given target.
 *
 * @param {string} target - Validated hostname or IP
 * @param {RunCallbacks} callbacks
 * @returns {{ cancel: () => void }}
 */
export function runTrace(target, callbacks) {
  const { cmd, args } = getTraceCommand(target)
  const platform = getCurrentPlatform()

  let child
  try {
    child = spawn(cmd, args, { shell: false })
  } catch (err) {
    callbacks.onError(`Failed to start ${cmd}: ${err.message}`)
    callbacks.onComplete()
    return { cancel: () => {} }
  }

  let lineBuffer = ''
  let cancelled = false
  let completed = false

  // Guard against double-completion (error + close both fire in Node.js)
  function complete() {
    if (completed) return
    completed = true
    callbacks.onComplete()
  }

  const timeout = setTimeout(() => {
    if (!cancelled) {
      cancelled = true
      child.kill()
      callbacks.onError('Trace timed out after 60 seconds')
      complete()
    }
  }, MAX_RUNTIME_MS)

  function processLine(line) {
    if (!line.trim()) return
    callbacks.onRaw(line)

    const hop = parseTraceLine(line, platform)
    if (hop) {
      callbacks.onHop(hop)
    }
  }

  child.stdout.on('data', (chunk) => {
    lineBuffer += chunk.toString()
    const lines = lineBuffer.split('\n')
    lineBuffer = lines.pop() ?? ''
    for (const line of lines) {
      processLine(line)
    }
  })

  child.stderr.on('data', (chunk) => {
    const msg = chunk.toString().trim()
    if (msg) callbacks.onError(msg)
  })

  child.on('error', (err) => {
    clearTimeout(timeout)
    if (err.code === 'ENOENT') {
      callbacks.onError(
        `"${cmd}" not found. On WSL/Linux, install it with: sudo apt install traceroute`
      )
    } else {
      callbacks.onError(`Process error: ${err.message}`)
    }
    complete()
  })

  child.on('close', () => {
    clearTimeout(timeout)
    if (!cancelled) {
      if (lineBuffer.trim()) processLine(lineBuffer)
      lineBuffer = ''
      complete()
    }
  })

  function cancel() {
    if (!cancelled) {
      cancelled = true
      clearTimeout(timeout)
      child.kill()
    }
  }

  return { cancel }
}
