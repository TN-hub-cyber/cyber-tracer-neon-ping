/**
 * Intel Panel — right-side sliding overlay showing WHOIS/DNS data per hop.
 *
 * Cards appear as intel arrives (typewriter reveal), newest at top.
 * Each card is color-coded by hop type: normal=cyan, hostile=red, ghost=blue, lossy=amber.
 */

const MAX_CARDS = 12
const TYPEWRITER_CHAR_MS = 18  // ms per character

/**
 * Build formatted intel text lines for a card.
 * @param {object} intel
 * @returns {string}
 */
function formatIntelLines(intel) {
  const pad = (label, value) =>
    `  ${label.padEnd(8, ' ')}: ${value ?? '???'}`

  const lines = [
    pad('IP', intel.ip),
    pad('HOST', intel.hostname ?? '—'),
    pad('ORG', intel.org ?? '—'),
    pad('COUNTRY', intel.country ?? '—'),
    pad('ASN', intel.asn ?? '—'),
    pad('RANGE', intel.netrange ?? '—'),
  ]
  return lines.join('\n')
}

/**
 * Build the card header string based on hop type.
 * @param {{ hop: number, type: string }} intel
 * @returns {string}
 */
function cardHeader(intel) {
  const prefix = {
    hostile: `[!] HOSTILE >> HOP ${intel.hop}`,
    ghost:   `[?] GHOST >> HOP ${intel.hop}`,
    lossy:   `[~] LOSSY >> HOP ${intel.hop}`,
  }[intel.type] ?? `[+] INTEL >> HOP ${intel.hop}`
  return `${prefix} ${'═'.repeat(Math.max(0, 28 - prefix.length))}`
}

/**
 * Animate text into a pre element one character at a time (typewriter).
 * @param {HTMLPreElement} pre
 * @param {string} fullText
 * @param {number} charMs
 */
function typewriterReveal(pre, fullText, charMs) {
  let index = 0
  function step() {
    if (index >= fullText.length) return
    // Reveal one character, or skip control chars instantly
    index++
    pre.textContent = fullText.slice(0, index)
    setTimeout(step, charMs)
  }
  step()
}

/** Allowlisted hop types for safe CSS class interpolation. */
const ALLOWED_TYPES = new Set(['normal', 'hostile', 'ghost', 'lossy'])

/**
 * Create the intel panel controller.
 *
 * @param {HTMLElement} panelEl   - #intel-panel container
 * @param {HTMLElement} cardsEl  - #intel-cards inner container
 * @returns {{ addCard: (intel: object) => void, clear: () => void }}
 */
export function createIntelPanel(panelEl, cardsEl) {
  /**
   * Add an intel card to the top of the panel.
   * @param {object} intel - { hop, type, ip, hostname, org, country, asn, netrange }
   */
  function addCard(intel) {
    // MEDIUM-4: Allowlist type before CSS class interpolation
    const safeType = ALLOWED_TYPES.has(intel.type) ? intel.type : 'normal'
    const card = document.createElement('div')
    card.className = `intel-card intel-card--${safeType}`

    const header = document.createElement('div')
    header.className = 'intel-card__header'
    header.textContent = cardHeader({ ...intel, type: safeType })

    const body = document.createElement('pre')
    body.className = 'intel-card__body'
    body.textContent = ''  // filled by typewriter

    card.appendChild(header)
    card.appendChild(body)

    // Insert at top (newest first)
    cardsEl.insertBefore(card, cardsEl.firstChild)

    // Trim oldest cards
    while (cardsEl.childElementCount > MAX_CARDS) {
      cardsEl.removeChild(cardsEl.lastChild)
    }

    typewriterReveal(body, formatIntelLines(intel), TYPEWRITER_CHAR_MS)
  }

  function clear() {
    cardsEl.replaceChildren()
  }

  return { addCard, clear }
}
