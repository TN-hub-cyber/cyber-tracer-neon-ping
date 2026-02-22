/**
 * Classifies traceroute hops into normal / hostile / ghost types.
 *
 * ghost   — timedOut === true (router exists but doesn't respond)
 * hostile — latency spikes abruptly vs previous hop
 * normal  — everything else
 */

/** Absolute ms threshold for hostile classification */
const HOSTILE_DELTA_MS = 100


/**
 * Calculate average latency from a latencies array.
 * @param {number[]} latencies
 * @returns {number|null} Average in ms, or null if empty
 */
function avgLatency(latencies) {
  if (!latencies || latencies.length === 0) return null
  return latencies.reduce((a, b) => a + b, 0) / latencies.length
}

/**
 * Classify a hop as 'normal', 'hostile', or 'ghost'.
 *
 * @param {import('./parser.js').HopResult} hop       Current hop
 * @param {import('./parser.js').HopResult|null} prevHop  Previous hop (null if first)
 * @returns {{ type: 'normal'|'hostile'|'ghost', latencyDelta: number|null }}
 */
export function classifyHop(hop, prevHop) {
  // Ghost: timed-out hop — router exists but won't respond
  if (hop.timedOut) {
    return { type: 'ghost', latencyDelta: null }
  }

  // First hop or after a ghost: no baseline for comparison
  if (!prevHop || prevHop.timedOut) {
    return { type: 'normal', latencyDelta: null }
  }

  const currAvg = avgLatency(hop.latencies)
  const prevAvg = avgLatency(prevHop.latencies)

  if (currAvg === null || prevAvg === null) {
    return { type: 'normal', latencyDelta: null }
  }

  const delta = currAvg - prevAvg
  const roundedDelta = Math.round(delta)

  const isHostile = delta > HOSTILE_DELTA_MS

  if (isHostile) {
    return { type: 'hostile', latencyDelta: roundedDelta }
  }

  return { type: 'normal', latencyDelta: roundedDelta }
}

/**
 * Return a new hop object enriched with classification fields.
 * Does not mutate the original hop.
 *
 * @param {import('./parser.js').HopResult} hop
 * @param {import('./parser.js').HopResult|null} prevHop
 * @returns {import('./parser.js').HopResult & { type: string, latencyDelta: number|null }}
 */
export function enrichHop(hop, prevHop) {
  const { type, latencyDelta } = classifyHop(hop, prevHop)
  return Object.freeze({ ...hop, type, latencyDelta })
}
