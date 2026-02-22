const MAX_LINES = 100

/**
 * Retro green console overlay controller.
 */
export function createConsole() {
  const container = document.getElementById('console-lines')

  /**
   * Append a line of text to the console overlay.
   * @param {string} text
   * @param {'normal'|'error'|'intel'|'warning'} type
   */
  function appendLine(text, type = 'normal') {
    const line = document.createElement('div')
    const typeClass = type === 'normal' ? '' : ` ${type}`
    line.className = `console-line${typeClass}`
    line.textContent = text
    container.appendChild(line)

    // Trim oldest lines
    while (container.childElementCount > MAX_LINES) {
      container.removeChild(container.firstChild)
    }

    // Auto-scroll to bottom
    container.scrollTop = container.scrollHeight
  }

  /**
   * Append a dramatic intel block for a discovered hop.
   * @param {{ hop: number, ip: string, hostname: string|null,
   *           org: string|null, country: string|null,
   *           asn: string|null, netrange: string|null }} intel
   */
  function addIntel(intel) {
    appendLine(`[INTEL >> HOP ${intel.hop}] ════════════════`, 'intel')
    if (intel.hostname) appendLine(`  HOST    : ${intel.hostname}`, 'intel')
    if (intel.org)      appendLine(`  ORG     : ${intel.org}`,      'intel')
    if (intel.country)  appendLine(`  COUNTRY : ${intel.country}`,  'intel')
    if (intel.asn)      appendLine(`  ASN     : ${intel.asn}`,      'intel')
    if (intel.netrange) appendLine(`  RANGE   : ${intel.netrange}`, 'intel')
  }

  /**
   * Append a warning block for a hostile hop.
   * @param {{ hop: number, latencyDelta: number|null }} hop
   */
  function addWarning(hop) {
    appendLine(`[WARNING >> HOP ${hop.hop}] ▲ LATENCY SPIKE`, 'warning')
    if (hop.latencyDelta != null) {
      appendLine(`  DELTA   : +${hop.latencyDelta}ms`, 'warning')
    }
    appendLine('  STATUS  : ANOMALOUS ROUTING', 'warning')
  }

  /**
   * Append an amber warning block for a lossy (partial packet loss) hop.
   * @param {{ hop: number, lossRate: number }} hop
   */
  function addLossWarning(hop) {
    const pct = Math.round((hop.lossRate ?? 0) * 100)
    const dropped = Math.round((hop.lossRate ?? 0) * 3)
    appendLine(`[LOSS] HOP ${hop.hop} — ${pct}% PACKET LOSS`, 'loss')
    appendLine(`  PROBES  : ${dropped}/3 dropped`, 'loss')
    appendLine('  STATUS  : DEGRADED SIGNAL', 'loss')
  }

  function clear() {
    container.replaceChildren()
  }

  return { appendLine, addIntel, addWarning, addLossWarning, clear }
}
