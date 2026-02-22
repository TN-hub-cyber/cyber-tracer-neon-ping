import * as THREE from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'

/**
 * Initialize the Three.js scene, camera, renderer, and bloom composer.
 * @param {HTMLCanvasElement} canvas
 * @returns {{ scene, camera, renderer, composer }}
 */
export function createScene(canvas) {
  // Renderer
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false })
  renderer.setSize(window.innerWidth, window.innerHeight)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.toneMapping = THREE.ReinhardToneMapping
  renderer.toneMappingExposure = 1.2

  // Scene
  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0x050508)
  scene.fog = new THREE.FogExp2(0x050508, 0.012)

  // Camera
  const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000)
  camera.position.set(0, 4, 12)
  camera.lookAt(0, 0, 0)

  // Lights
  const ambientLight = new THREE.AmbientLight(0x111133, 2)
  scene.add(ambientLight)

  // Post-processing: bloom
  const composer = new EffectComposer(renderer)
  composer.addPass(new RenderPass(scene, camera))

  const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    1.4,   // strength
    0.5,   // radius
    0.1    // threshold
  )
  composer.addPass(bloomPass)

  // Handle resize
  window.addEventListener('resize', () => {
    const w = window.innerWidth
    const h = window.innerHeight
    camera.aspect = w / h
    camera.updateProjectionMatrix()
    renderer.setSize(w, h)
    composer.setSize(w, h)
    bloomPass.resolution.set(w, h)
  })

  return Object.freeze({ scene, camera, renderer, composer })
}
