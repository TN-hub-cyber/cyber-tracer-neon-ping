/**
 * HUD overlay controller.
 * Updates target IP, average latency, packet loss, hop count, and status.
 */
export function createHUD() {
  const elTarget  = document.getElementById('hud-target')
  const elLatency = document.getElementById('hud-latency')
  const elLoss    = document.getElementById('hud-loss')
  const elHops    = document.getElementById('hud-hops')
  const elStatus  = document.getElementById('hud-status')

  function setFlicker(el) {
    el.classList.remove('updated')
    // Force reflow to restart animation
    void el.offsetWidth
    el.classList.add('updated')
  }

  function setText(el, text) {
    if (el.textContent !== text) {
      el.textContent = text
      setFlicker(el)
    }
  }

  /**
   * @param {{ target?: string, avgLatency?: number|null, packetLoss?: number|null, hopCount?: number, status?: string }} stats
   */
  function update(stats) {
    if (stats.target !== undefined) {
      setText(elTarget, stats.target || '—')
    }
    if (stats.avgLatency !== undefined) {
      const val = stats.avgLatency != null ? `${stats.avgLatency.toFixed(1)} ms` : '—'
      setText(elLatency, val)
    }
    if (stats.packetLoss !== undefined) {
      const val = stats.packetLoss != null ? `${stats.packetLoss.toFixed(0)} %` : '—'
      setText(elLoss, val)
    }
    if (stats.hopCount !== undefined) {
      setText(elHops, String(stats.hopCount))
    }
    if (stats.status !== undefined) {
      elStatus.textContent = stats.status
    }
  }

  function reset() {
    update({ target: '—', avgLatency: null, packetLoss: null, hopCount: 0, status: 'IDLE' })
  }

  return { update, reset }
}
