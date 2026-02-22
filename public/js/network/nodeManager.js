import * as THREE from 'three'
import { resolveColor } from './colors.js'

/**
 * Manages wireframe icosahedron nodes in the 3D scene.
 * Supports three node types: normal, hostile, ghost.
 *
 * @param {THREE.Scene} scene
 */
export function createNodeManager(scene) {
  let nodes = []

  // Geometries owned by this instance (not module singletons) so that
  // dispose() on one manager never breaks another.
  const nodeGeometry      = new THREE.IcosahedronGeometry(0.35, 1)
  const ghostAuraGeometry = new THREE.SphereGeometry(0.55, 8, 8)

  // ── Node builders ───────────────────────────────────────

  function buildNormalNode(color) {
    const material = new THREE.MeshBasicMaterial({ color, wireframe: true })
    return new THREE.Mesh(nodeGeometry, material)
  }

  function buildHostileNode() {
    const material = new THREE.MeshBasicMaterial({ color: 0xff2200, wireframe: true })
    return new THREE.Mesh(nodeGeometry, material)
  }

  function buildGhostNode() {
    const meshMat = new THREE.MeshBasicMaterial({
      color: 0xaaccff,
      wireframe: true,
      transparent: true,
      opacity: 0.25,
      depthWrite: false,
    })
    const mesh = new THREE.Mesh(nodeGeometry, meshMat)

    const auraMat = new THREE.MeshBasicMaterial({
      color: 0x8899dd,
      transparent: true,
      opacity: 0.06,
      depthWrite: false,
      side: THREE.BackSide,
    })
    const auraMesh = new THREE.Mesh(ghostAuraGeometry, auraMat)
    return { mesh, auraMesh }
  }

  // ── Public methods ──────────────────────────────────────

  /**
   * Add a new hop node to the scene.
   *
   * @param {{ hop: number, ip: string|null, latencies: number[], timedOut: boolean, type: string }} hop
   * @returns {{ mesh: THREE.Mesh, light: THREE.PointLight|null, auraMesh: THREE.Mesh|null,
   *             position: THREE.Vector3, hop: object }}
   */
  function addNode(hop) {
    // Spread nodes along X axis with slight organic Y/Z variation
    const x = (hop.hop - 1) * 3.5
    const y = (Math.random() - 0.5) * 2
    const z = (Math.random() - 0.5) * 2
    const position = new THREE.Vector3(x, y, z)

    let mesh, auraMesh, light

    if (hop.type === 'ghost') {
      // Ghost: semi-transparent, floating, no light
      const ghost = buildGhostNode()
      mesh     = ghost.mesh
      auraMesh = ghost.auraMesh

      mesh.position.copy(position)
      auraMesh.position.copy(position)

      scene.add(mesh)
      scene.add(auraMesh)
      light = null

    } else if (hop.type === 'hostile') {
      // Hostile: red, strong pulsing light
      mesh = buildHostileNode()
      mesh.position.copy(position)
      scene.add(mesh)

      light = new THREE.PointLight(0xff2200, 2.5, 8)
      light.position.copy(position)
      scene.add(light)
      auraMesh = null

    } else {
      // Normal: standard color-coded node
      const color = resolveColor(hop.latencies, hop.timedOut)
      mesh = buildNormalNode(color)
      mesh.position.copy(position)
      scene.add(mesh)

      light = new THREE.PointLight(color, 1.5, 5)
      light.position.copy(position)
      scene.add(light)
      auraMesh = null
    }

    const nodeData = Object.freeze({
      mesh,
      light,
      auraMesh,
      position: position.clone(),
      hop,
    })

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
    for (const { mesh, light, auraMesh } of nodes) {
      scene.remove(mesh)
      mesh.material.dispose()

      if (light) scene.remove(light)

      if (auraMesh) {
        scene.remove(auraMesh)
        auraMesh.material.dispose()
      }
    }
    nodes = []
  }

  // Call on final app teardown to free GPU memory
  function destroy() {
    clear()
    nodeGeometry.dispose()
    ghostAuraGeometry.dispose()
  }

  return { addNode, getNodes, getLastNode, clear, destroy }
}
