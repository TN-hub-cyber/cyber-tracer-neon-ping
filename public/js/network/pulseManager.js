import * as THREE from 'three'

const PULSE_SPEED  = 0.6   // units per second
const PULSE_RADIUS = 0.08
const PULSES_PER_LINK = 2

const pulseGeometry = new THREE.SphereGeometry(PULSE_RADIUS, 6, 6)

/**
 * Animates data packet particles along links.
 * @param {THREE.Scene} scene
 */
export function createPulseManager(scene) {
  let pulses = []

  /**
   * Add animated pulses along a link.
   * @param {THREE.Vector3} fromPos
   * @param {THREE.Vector3} toPos
   * @param {number} color - Hex color
   */
  function addPulse(fromPos, toPos, color) {
    for (let i = 0; i < PULSES_PER_LINK; i++) {
      const material = new THREE.MeshBasicMaterial({ color })
      const mesh = new THREE.Mesh(pulseGeometry, material)
      // Stagger the starting progress so pulses don't overlap
      const progress = i / PULSES_PER_LINK
      mesh.position.lerpVectors(fromPos, toPos, progress)
      scene.add(mesh)

      pulses = [...pulses, {
        mesh,
        from: fromPos.clone(),
        to: toPos.clone(),
        progress,
      }]
    }
  }

  /**
   * Update all pulse positions. Call every frame.
   * @param {number} delta - Seconds since last frame
   */
  function update(delta) {
    pulses = pulses.map((p) => {
      const nextProgress = (p.progress + delta * PULSE_SPEED) % 1
      p.mesh.position.lerpVectors(p.from, p.to, nextProgress)
      return { ...p, progress: nextProgress }
    })
  }

  function clear() {
    for (const { mesh } of pulses) {
      scene.remove(mesh)
      mesh.material.dispose()
    }
    pulses = []
  }

  return { addPulse, update, clear }
}
