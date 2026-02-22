import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'

const TRACK_OFFSET = new THREE.Vector3(-4, 3, 8)
const LERP_SPEED = 0.04

/**
 * Manages two camera modes:
 *   - Tracking: smoothly follows each new node
 *   - Cinematic orbit: auto-rotates around the network after completion
 *
 * @param {THREE.PerspectiveCamera} camera
 * @param {HTMLElement} domElement
 * @returns {{ trackNode, startOrbit, update }}
 */
export function createCameraController(camera, domElement) {
  const controls = new OrbitControls(camera, domElement)
  controls.enableDamping = true
  controls.dampingFactor = 0.05
  controls.autoRotate = false
  controls.autoRotateSpeed = 0.6
  controls.enabled = false  // disabled during tracking

  const targetPosition = new THREE.Vector3()
  const targetLookAt = new THREE.Vector3()
  let mode = 'idle'  // 'tracking' | 'orbit' | 'idle'

  /**
   * Smoothly move camera toward a newly added node.
   * @param {THREE.Vector3} nodePosition
   */
  function trackNode(nodePosition) {
    mode = 'tracking'
    controls.enabled = false
    targetPosition.copy(nodePosition).add(TRACK_OFFSET)
    targetLookAt.copy(nodePosition)
  }

  /**
   * Switch to cinematic orbit around the network center.
   * @param {THREE.Vector3} center
   */
  function startOrbit(center) {
    mode = 'orbit'
    controls.target.copy(center)
    controls.enabled = true
    controls.autoRotate = true
  }

  /**
   * Call every frame.
   * @param {number} delta - Time since last frame in seconds
   */
  function update(delta) {
    if (mode === 'tracking') {
      camera.position.lerp(targetPosition, LERP_SPEED + delta * 0.5)
      controls.target.lerp(targetLookAt, LERP_SPEED + delta * 0.5)
    }

    if (controls.enabled) {
      controls.update()
    }
  }

  return { trackNode, startOrbit, update }
}
