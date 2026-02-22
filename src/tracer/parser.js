/**
 * Parses traceroute/tracert output lines into structured hop objects.
 *
 * Supported formats:
 *   Linux traceroute -n:
 *     " 1  203.0.113.1  1.234 ms  1.456 ms  1.789 ms"
 *     " 2  * * *"
 *     " 3  192.168.1.1  * 2.345 ms *"   (partial timeout)
 *
 *   Windows tracert:
 *     "  1    <1 ms    1 ms    2 ms  203.0.113.1"
 *     "  2     *        *        *     Request timed out."
 */

// Linux: " 1  1.2.3.4  1.234 ms  1.456 ms  1.789 ms"
const LINUX_HOP_FULL = /^\s*(\d+)\s+([\d.]+)\s+([\d.]+)\s+ms\s+([\d.]+)\s+ms\s+([\d.]+)\s+ms\s*$/

// Linux: hop number at start, then anything
const LINUX_HOP_START = /^\s*(\d+)\s+(.*)/

// Windows: "  2     *        *        *     Request timed out."
const WIN_TIMEOUT = /^\s*(\d+)\s+\*\s+\*\s+\*\s+Request timed out\./i

/**
 * @typedef {{ hop: number, ip: string | null, latencies: number[], timedOut: boolean, partialLoss: boolean }} HopResult
 */

/**
 * Parse a single line of traceroute/tracert output.
 *
 * @param {string} line - Raw stdout line
 * @param {'unix' | 'win32'} platform
 * @returns {HopResult | null} Parsed hop or null if line is not a hop line
 */
export function parseTraceLine(line, platform) {
  if (platform === 'win32') {
    return parseWindowsLine(line)
  }
  return parseLinuxLine(line)
}

function parseLinuxLine(line) {
  // Try full match (all 3 RTTs present)
  const fullMatch = LINUX_HOP_FULL.exec(line)
  if (fullMatch) {
    return Object.freeze({
      hop: parseInt(fullMatch[1], 10),
      ip: fullMatch[2],
      latencies: [
        parseFloat(fullMatch[3]),
        parseFloat(fullMatch[4]),
        parseFloat(fullMatch[5]),
      ],
      timedOut: false,
      partialLoss: false,
    })
  }

  // Try mixed/partial line
  const mixedMatch = LINUX_HOP_START.exec(line)
  if (!mixedMatch) return null

  const hopNum = parseInt(mixedMatch[1], 10)
  if (isNaN(hopNum)) return null

  const rest = mixedMatch[2].trim()

  // All stars = full timeout
  if (/^\*\s*\*\s*\*$/.test(rest)) {
    return Object.freeze({ hop: hopNum, ip: null, latencies: [], timedOut: true, partialLoss: false })
  }

  // Extract IP (first token that looks like an IP)
  const ipMatch = /^([\d.]+)/.exec(rest)
  const ip = ipMatch ? ipMatch[1] : null

  // Extract latency values
  const latencies = []
  const latencyPattern = /([\d.]+)\s*ms/g
  let m
  while ((m = latencyPattern.exec(rest)) !== null) {
    latencies.push(parseFloat(m[1]))
  }

  const hasStars = rest.includes('*')
  const timedOut = hasStars && latencies.length === 0

  return Object.freeze({ hop: hopNum, ip, latencies, timedOut, partialLoss: hasStars && latencies.length > 0 })
}

function parseWindowsLine(line) {
  // Full timeout
  const timeoutMatch = WIN_TIMEOUT.exec(line)
  if (timeoutMatch) {
    return Object.freeze({
      hop: parseInt(timeoutMatch[1], 10),
      ip: null,
      latencies: [],
      timedOut: true,
      partialLoss: false,
    })
  }

  // Normal hop: extract hop number, IP at end, then latencies
  const hopNumMatch = /^\s*(\d+)\s+/.exec(line)
  if (!hopNumMatch) return null

  const hopNum = parseInt(hopNumMatch[1], 10)

  // IP is the last token on the line
  const ipMatch = /([\d.]+)\s*$/.exec(line)
  if (!ipMatch) return null

  // Extract latencies (numbers followed by ms, or <N ms)
  const latencies = []
  const latencyPattern = /(?:<)?(\d+)\s*ms/g
  let m
  while ((m = latencyPattern.exec(line)) !== null) {
    latencies.push(parseFloat(m[1]))
  }

  if (latencies.length === 0) return null

  return Object.freeze({
    hop: hopNum,
    ip: ipMatch[1],
    latencies,
    timedOut: false,
    partialLoss: false,
  })
}
