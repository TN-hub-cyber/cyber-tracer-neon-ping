import * as THREE from 'three'
import { resolveColor } from './colors.js'

/**
 * Manages wireframe icosahedron nodes in the 3D scene.
 * @param {THREE.Scene} scene
 */
export function createNodeManager(scene) {
  let nodes = []

  const nodeGeometry = new THREE.IcosahedronGeometry(0.35, 1)

  /**
   * Add a new hop node to the scene.
   * @param {{ hop: number, ip: string|null, latencies: number[], timedOut: boolean }} hop
   * @returns {{ mesh: THREE.Mesh, light: THREE.PointLight, position: THREE.Vector3, hop: object }}
   */
  function addNode(hop) {
    const color = resolveColor(hop.latencies, hop.timedOut)

    const material = new THREE.MeshBasicMaterial({ color, wireframe: true })
    const mesh = new THREE.Mesh(nodeGeometry, material)

    // Spread nodes along X axis with slight organic Y/Z variation
    const x = (hop.hop - 1) * 3.5
    const y = (Math.random() - 0.5) * 2
    const z = (Math.random() - 0.5) * 2
    const position = new THREE.Vector3(x, y, z)
    mesh.position.copy(position)

    // Small point light at each node for local glow
    const light = new THREE.PointLight(color, 1.5, 5)
    light.position.copy(position)

    scene.add(mesh)
    scene.add(light)

    const nodeData = Object.freeze({ mesh, light, position: position.clone(), hop })
    nodes = [...nodes, nodeData]
    return nodeData
  }

  function getNodes() {
    return [...nodes]
  }

  function getLastNode() {
    return nodes[nodes.length - 1] ?? null
  }

  function clear() {
    for (const { mesh, light } of nodes) {
      scene.remove(mesh)
      scene.remove(light)
      mesh.material.dispose()
    }
    nodes = []
  }

  // Call on final app teardown to free GPU memory
  function destroy() {
    clear()
    nodeGeometry.dispose()
  }

  return { addNode, getNodes, getLastNode, clear, destroy }
}
