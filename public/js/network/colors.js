/**
 * Shared latency color constants and resolver.
 * Used by nodeManager, linkManager, and main.js.
 */

export const FAST_THRESHOLD   = 50
export const MEDIUM_THRESHOLD = 150

export const COLOR_FAST    = 0x00ff41
export const COLOR_MEDIUM  = 0xffff00
export const COLOR_SLOW    = 0xff0040
export const COLOR_TIMEOUT = 0x444466

/**
 * @param {number[]} latencies
 * @param {boolean} timedOut
 * @returns {number} Hex color
 */
export function resolveColor(latencies, timedOut) {
  if (timedOut || latencies.length === 0) return COLOR_TIMEOUT
  const avg = latencies.reduce((a, b) => a + b, 0) / latencies.length
  if (avg < FAST_THRESHOLD)   return COLOR_FAST
  if (avg < MEDIUM_THRESHOLD) return COLOR_MEDIUM
  return COLOR_SLOW
}
