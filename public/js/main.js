import * as THREE from 'three'
import { createScene }            from './scene/sceneSetup.js'
import { createGrid }             from './scene/grid.js'
import { createGlitchController } from './scene/glitch.js'
import { createCameraController } from './camera/cameraController.js'
import { createNodeManager }      from './network/nodeManager.js'
import { createLinkManager }      from './network/linkManager.js'
import { createPulseManager }     from './network/pulseManager.js'
import { createHUD }              from './ui/hud.js'
import { createConsole }          from './ui/console.js'

// ── State machine ─────────────────────────────────────────
// States: IDLE | TRACING | COMPLETE
let appState = 'IDLE'

// Accumulated trace stats
let traceStats = { totalHops: 0, timedOutHops: 0, totalLatency: 0, latencyCount: 0 }

// ── DOM elements ───────────────────────────────────────────
const canvas      = document.getElementById('scene-canvas')
const traceBtn    = document.getElementById('trace-btn')
const cancelBtn   = document.getElementById('cancel-btn')
const targetInput = document.getElementById('target-input')

// ── Three.js setup ─────────────────────────────────────────
const { scene, camera, renderer, composer } = createScene(canvas)
const { update: updateGrid }                = createGrid(scene)
const glitch                                = createGlitchController(composer)
const cam                                   = createCameraController(camera, renderer.domElement)
const nodes                                 = createNodeManager(scene)
const links                                 = createLinkManager(scene)
const pulses                                = createPulseManager(scene)
const hud                                   = createHUD()
const consoleUI                             = createConsole()

hud.reset()

// ── Socket.io ──────────────────────────────────────────────
const socket = io()

socket.on('connect', () => {
  consoleUI.appendLine('[SYSTEM] Connection established.')
})

socket.on('disconnect', () => {
  consoleUI.appendLine('[SYSTEM] Connection lost.', 'error')
})

socket.on('trace-hop', (hop) => {
  const prevNode = nodes.getLastNode()
  const newNode  = nodes.addNode(hop)

  if (prevNode) {
    links.addLink(prevNode.position, newNode.position, hop.latencies, hop.timedOut)
    pulses.addPulse(prevNode.position, newNode.position, resolveColor(hop.latencies, hop.timedOut))
  }

  // Camera tracks new node
  cam.trackNode(newNode.position)

  // Glitch on timeout
  if (hop.timedOut) glitch.trigger()

  // Update stats (immutable)
  const nextStats = {
    totalHops: traceStats.totalHops + 1,
    timedOutHops: traceStats.timedOutHops + (hop.timedOut ? 1 : 0),
    totalLatency: traceStats.totalLatency + hop.latencies.reduce((a, b) => a + b, 0),
    latencyCount: traceStats.latencyCount + hop.latencies.length,
  }
  traceStats = nextStats

  const avgLatency = nextStats.latencyCount > 0
    ? nextStats.totalLatency / nextStats.latencyCount
    : null
  const packetLoss = nextStats.totalHops > 0
    ? (nextStats.timedOutHops / nextStats.totalHops) * 100
    : null

  hud.update({
    hopCount: nextStats.totalHops,
    avgLatency,
    packetLoss,
  })
})

socket.on('trace-raw', (line) => {
  consoleUI.appendLine(line)
})

socket.on('trace-error', (message) => {
  consoleUI.appendLine(`[ERROR] ${message}`, 'error')
  glitch.trigger()
  if (appState === 'TRACING') {
    setState('IDLE')
  }
})

socket.on('trace-complete', () => {
  if (appState !== 'TRACING') return
  setState('COMPLETE')
  hud.update({ status: 'COMPLETE' })
  consoleUI.appendLine('[SYSTEM] Trace complete.')

  // Switch camera to cinematic orbit around the center of all nodes
  const allNodes = nodes.getNodes()
  if (allNodes.length > 0) {
    const center = new THREE.Vector3()
    for (const n of allNodes) center.add(n.position)
    center.divideScalar(allNodes.length)
    cam.startOrbit(center)
  }
})

// ── UI event handlers ──────────────────────────────────────
traceBtn.addEventListener('click', startTrace)

targetInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') startTrace()
})

cancelBtn.addEventListener('click', () => {
  socket.emit('cancel-trace')
  setState('IDLE')
  hud.update({ status: 'CANCELLED' })
  consoleUI.appendLine('[SYSTEM] Trace cancelled.')
})

function startTrace() {
  const target = targetInput.value.trim()
  if (!target || appState === 'TRACING') return

  clearScene()
  traceStats = { totalHops: 0, timedOutHops: 0, totalLatency: 0, latencyCount: 0 }

  setState('TRACING')
  hud.update({ target, hopCount: 0, avgLatency: null, packetLoss: null, status: 'TRACING...' })
  consoleUI.appendLine(`[SYSTEM] Starting trace to ${target}`)

  socket.emit('start-trace', { target })
}

function clearScene() {
  nodes.clear()
  links.clear()
  pulses.clear()
  consoleUI.clear()
}

// ── State transitions ──────────────────────────────────────
function setState(next) {
  appState = next
  if (next === 'TRACING') {
    traceBtn.disabled = true
    cancelBtn.hidden  = false
  } else {
    traceBtn.disabled = false
    cancelBtn.hidden  = true
  }
}

// ── Animation loop ─────────────────────────────────────────
const clock = new THREE.Clock()

function animate() {
  requestAnimationFrame(animate)
  const delta = clock.getDelta()
  const elapsed = clock.getElapsedTime()

  updateGrid(elapsed)
  cam.update(delta)
  pulses.update(delta)

  // Gentle node scale pulse
  for (const { mesh } of nodes.getNodes()) {
    const s = 1 + Math.sin(elapsed * 2 + mesh.position.x) * 0.05
    mesh.scale.setScalar(s)
  }

  composer.render()
}

animate()

// ── Helpers ────────────────────────────────────────────────
function resolveColor(latencies, timedOut) {
  if (timedOut || latencies.length === 0) return 0x444466
  const avg = latencies.reduce((a, b) => a + b, 0) / latencies.length
  if (avg < 50)  return 0x00ff41
  if (avg < 150) return 0xffff00
  return 0xff0040
}
