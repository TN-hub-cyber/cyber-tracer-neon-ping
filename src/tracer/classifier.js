/**
 * Classifies traceroute hops into normal / hostile / ghost types.
 *
 * ghost   — timedOut === true (router exists but doesn't respond)
 * lossy   — partialLoss === true (some probes dropped, others responded)
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
 * Classify a hop as 'normal', 'hostile', 'ghost', or 'lossy'.
 *
 * @param {import('./parser.js').HopResult} hop       Current hop
 * @param {import('./parser.js').HopResult|null} prevHop  Previous hop (null if first)
 * @returns {{ type: 'normal'|'hostile'|'ghost'|'lossy', latencyDelta: number|null, lossRate: number|null }}
 */
export function classifyHop(hop, prevHop) {
  // Ghost: full timeout
  if (hop.timedOut) {
    return { type: 'ghost', latencyDelta: null, lossRate: null }
  }

  // Lossy: partial probe timeout (some * in output)
  if (hop.partialLoss) {
    const lossRate = Math.round(((3 - hop.latencies.length) / 3) * 100) / 100
    return { type: 'lossy', latencyDelta: null, lossRate }
  }

  // First hop or after a ghost: no baseline for comparison
  if (!prevHop || prevHop.timedOut) {
    return { type: 'normal', latencyDelta: null, lossRate: null }
  }

  const currAvg = avgLatency(hop.latencies)
  const prevAvg = avgLatency(prevHop.latencies)

  if (currAvg === null || prevAvg === null) {
    return { type: 'normal', latencyDelta: null, lossRate: null }
  }

  const delta = currAvg - prevAvg
  const roundedDelta = Math.round(delta)

  if (delta > HOSTILE_DELTA_MS) {
    return { type: 'hostile', latencyDelta: roundedDelta, lossRate: null }
  }

  return { type: 'normal', latencyDelta: roundedDelta, lossRate: null }
}

/**
 * Return a new hop object enriched with classification fields.
 * Does not mutate the original hop.
 *
 * @param {import('./parser.js').HopResult} hop
 * @param {import('./parser.js').HopResult|null} prevHop
 * @returns {import('./parser.js').HopResult & { type: string, latencyDelta: number|null, lossRate: number|null }}
 */
export function enrichHop(hop, prevHop) {
  const { type, latencyDelta, lossRate } = classifyHop(hop, prevHop)
  return Object.freeze({ ...hop, type, latencyDelta, lossRate })
}
