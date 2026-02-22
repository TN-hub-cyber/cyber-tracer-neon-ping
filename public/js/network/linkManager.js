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
   * @returns {{ line: THREE.Line, fromPos: THREE.Vector3, toPos: THREE.Vector3 }}
   */
  function addLink(fromPos, toPos, latencies, timedOut) {
    const color = resolveColor(latencies, timedOut)

    const points = [fromPos.clone(), toPos.clone()]
    const geometry = new THREE.BufferGeometry().setFromPoints(points)
    const material = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.8 })
    const line = new THREE.Line(geometry, material)

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
