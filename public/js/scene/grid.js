import * as THREE from 'three'

/**
 * Create a cyberpunk digital grid floor.
 * @param {THREE.Scene} scene
 * @returns {{ grid: THREE.GridHelper, update: (time: number) => void }}
 */
export function createGrid(scene) {
  const grid = new THREE.GridHelper(300, 80, 0x00ffff, 0x003333)

  // Make the grid semi-transparent
  grid.material.opacity = 0.25
  grid.material.transparent = true
  grid.position.y = -2.5

  scene.add(grid)

  // Slow pulse animation
  function update(time) {
    const pulse = 0.18 + Math.sin(time * 0.5) * 0.05
    grid.material.opacity = pulse
  }

  return { grid, update }
}
