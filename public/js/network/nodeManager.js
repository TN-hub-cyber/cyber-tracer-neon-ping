import * as THREE from 'three'

// Latency thresholds (ms)
const FAST_THRESHOLD   = 50
const MEDIUM_THRESHOLD = 150

const COLOR_FAST    = new THREE.Color(0x00ff41)  // green
const COLOR_MEDIUM  = new THREE.Color(0xffff00)  // yellow
const COLOR_SLOW    = new THREE.Color(0xff0040)  // red
const COLOR_TIMEOUT = new THREE.Color(0x444466)  // dim blue-grey

function latencyColor(latencies, timedOut) {
  if (timedOut || latencies.length === 0) return COLOR_TIMEOUT
  const avg = latencies.reduce((a, b) => a + b, 0) / latencies.length
  if (avg < FAST_THRESHOLD)   return COLOR_FAST
  if (avg < MEDIUM_THRESHOLD) return COLOR_MEDIUM
  return COLOR_SLOW
}

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
    const color = latencyColor(hop.latencies, hop.timedOut)

    const material = new THREE.MeshBasicMaterial({
      color,
      wireframe: true,
    })

    const mesh = new THREE.Mesh(nodeGeometry, material)

    // Spread nodes along X axis with slight organic Y/Z variation
    const x = (hop.hop - 1) * 3.5
    const y = (Math.random() - 0.5) * 2
    const z = (Math.random() - 0.5) * 2
    const position = new THREE.Vector3(x, y, z)
    mesh.position.copy(position)

    // Small point light at each node for local glow
    const light = new THREE.PointLight(color.getHex(), 1.5, 5)
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

  return { addNode, getNodes, getLastNode, clear }
}
