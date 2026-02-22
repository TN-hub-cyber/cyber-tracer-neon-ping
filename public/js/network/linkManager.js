import * as THREE from 'three'
import { resolveColor } from './colors.js'

/**
 * Manages colored lines connecting hop nodes.
 * @param {THREE.Scene} scene
 */
export function createLinkManager(scene) {
  let links = []

  /**
   * Draw a line between two node positions, colored by latency.
   * @param {THREE.Vector3} fromPos
   * @param {THREE.Vector3} toPos
   * @param {number[]} latencies
   * @param {boolean} timedOut
   * @param {string} [hopType]
   * @param {number} [lossRate]
   * @returns {{ line: THREE.Line, fromPos: THREE.Vector3, toPos: THREE.Vector3 }}
   */
  function addLink(fromPos, toPos, latencies, timedOut, hopType, lossRate) {
    const points = [fromPos.clone(), toPos.clone()]
    const geometry = new THREE.BufferGeometry().setFromPoints(points)

    let material, line

    if (hopType === 'lossy') {
      // Dashed amber line — gap size reflects lossRate (higher loss = wider gap)
      const gapSize = 0.2 + (lossRate ?? 0.33) * 0.4
      material = new THREE.LineDashedMaterial({
        color: 0xffaa00,
        transparent: true,
        opacity: 0.75,
        dashSize: 0.3,
        gapSize,
      })
      line = new THREE.Line(geometry, material)
      // Required for LineDashedMaterial to render dashes
      line.computeLineDistances()
    } else {
      const color = resolveColor(latencies, timedOut)
      material = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.8 })
      line = new THREE.Line(geometry, material)
    }

    scene.add(line)

    const linkData = Object.freeze({ line, fromPos: fromPos.clone(), toPos: toPos.clone() })
    links = [...links, linkData]
    return linkData
  }

  function clear() {
    for (const { line } of links) {
      scene.remove(line)
      line.geometry.dispose()
      line.material.dispose()
    }
    links = []
  }

  function getLinks() {
    return [...links]
  }

  return { addLink, getLinks, clear }
}
