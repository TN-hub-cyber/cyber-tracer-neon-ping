/**
 * Node labels — floating DOM badges above each 3D node.
 *
 * Uses Three.js camera projection to convert world coordinates to
 * screen coordinates, then positions absolutely-placed <div> elements.
 *
 * Labels fade in when intel arrives. Types:
 *   normal  → [JP] AS7506   (cyan)
 *   hostile → [!] AS7506    (red, blink)
 *   ghost   → [???] UNKNOWN (pale blue, dim)
 */

/**
 * Build the label text for a node label badge.
 * @param {{ type: string, country: string|null, asn: string|null }} intel
 * @returns {string}
 */
function buildLabelText(nodeType, intel) {
  if (nodeType === 'ghost') return '[???]'

  const tag   = intel?.country ?? '??'
  const asnId = intel?.asn     ?? ''
  const prefix = nodeType === 'hostile' ? '[!]' : `[${tag}]`
  return asnId ? `${prefix} ${asnId}` : prefix
}

/**
 * Project a Three.js world position to CSS pixel coordinates.
 * @param {THREE.Vector3} worldPos
 * @param {THREE.Camera} camera
 * @returns {{ x: number, y: number, visible: boolean }}
 */
function projectToScreen(worldPos, camera) {
  const v = worldPos.clone().project(camera)
  const x = (v.x *  0.5 + 0.5) * window.innerWidth
  const y = (v.y * -0.5 + 0.5) * window.innerHeight
  return { x, y, visible: v.z < 1 }
}

/** Allowlisted hop types for safe CSS class interpolation. */
const ALLOWED_TYPES = new Set(['normal', 'hostile', 'ghost', 'lossy'])

/**
 * Create the node label manager.
 *
 * @param {HTMLElement} container - #node-labels div (position: fixed, z-index above canvas)
 * @returns {{
 *   registerNode: (nodeData: object, hopType: string) => void,
 *   updateIntel: (hopNum: number, intel: object) => void,
 *   updatePositions: (camera: THREE.Camera) => void,
 *   clear: () => void,
 * }}
 */
export function createNodeLabelManager(container) {
  /** @type {Array<{ el: HTMLElement, position: THREE.Vector3, hopNum: number, type: string }>} */
  let labels = []

  /**
   * Create a DOM label element and register it for position updates.
   * @param {{ position: THREE.Vector3, hop: object }} nodeData
   * @param {string} hopType - 'normal' | 'hostile' | 'ghost'
   */
  function registerNode(nodeData, hopType) {
    // MEDIUM-4: Allowlist type before CSS class interpolation
    const safeType = ALLOWED_TYPES.has(hopType) ? hopType : 'normal'
    const el = document.createElement('div')
    el.className = `node-label node-label--${safeType}`
    el.textContent = safeType === 'ghost' ? '[???]' : '...'
    el.dataset.hop = String(nodeData.hop.hop)
    container.appendChild(el)

    // Offset position slightly above the node
    const abovePos = nodeData.position.clone()
    abovePos.y += 0.7

    labels = [...labels, {
      el,
      position: abovePos,
      hopNum: nodeData.hop.hop,
      type: safeType,
    }]
  }

  /**
   * Update label text when intel data arrives for a hop.
   * @param {number} hopNum
   * @param {object} intel - { country, asn, ... }
   */
  function updateIntel(hopNum, intel) {
    const label = labels.find((l) => l.hopNum === hopNum)
    if (!label) return
    label.el.textContent = buildLabelText(label.type, intel)
    label.el.classList.add('node-label--revealed')
  }

  /**
   * Sync DOM label positions with current 3D projection.
   * Call every animation frame.
   * @param {THREE.Camera} camera
   */
  function updatePositions(camera) {
    for (const { el, position } of labels) {
      const { x, y, visible } = projectToScreen(position, camera)
      el.style.transform = `translate(${x | 0}px, ${y | 0}px)`
      el.style.display = visible ? 'block' : 'none'
    }
  }

  function clear() {
    container.replaceChildren()
    labels = []
  }

  return { registerNode, updateIntel, updatePositions, clear }
}
