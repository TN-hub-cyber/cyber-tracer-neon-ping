import * as THREE from 'three'
import { createScene }            from './scene/sceneSetup.js'
import { createGrid }             from './scene/grid.js'
import { createGlitchController } from './scene/glitch.js'
import { createCrtNoise }         from './scene/crtNoise.js'
import { createCameraController } from './camera/cameraController.js'
import { createNodeManager }      from './network/nodeManager.js'
import { createLinkManager }      from './network/linkManager.js'
import { createPulseManager }     from './network/pulseManager.js'
import { createNodeLabelManager } from './network/nodeLabel.js'
import { resolveColor }           from './network/colors.js'
import { createHUD }              from './ui/hud.js'
import { createConsole }          from './ui/console.js'
import { createIntelPanel }       from './ui/intelPanel.js'

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
const crtCanvas   = document.getElementById('crt-canvas')
const intelPanel  = document.getElementById('intel-panel')
const intelCards  = document.getElementById('intel-cards')
const nodeLabels  = document.getElementById('node-labels')

// ── Three.js setup ─────────────────────────────────────────
const { scene, camera, renderer, composer } = createScene(canvas)
const { update: updateGrid }                = createGrid(scene)
const glitch                                = createGlitchController(composer)
const crt                                   = createCrtNoise(crtCanvas)
const cam                                   = createCameraController(camera, renderer.domElement)
const nodes                                 = createNodeManager(scene)
const links                                 = createLinkManager(scene)
const pulses                                = createPulseManager(scene)
const nodeLabeler                           = createNodeLabelManager(nodeLabels)
const hud                                   = createHUD()
const consoleUI                             = createConsole()
const intel                                 = createIntelPanel(intelPanel, intelCards)

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

  // Register label (text updated when intel arrives)
  nodeLabeler.registerNode(newNode, hop.type)

  // Camera tracks new node
  cam.trackNode(newNode.position)

  // Glitch on ghost hop
  if (hop.type === 'ghost') glitch.trigger()

  // CRT noise + console warning on hostile hop
  if (hop.type === 'hostile') {
    crt.trigger()
    consoleUI.addWarning(hop)
  }

  // Update stats (immutable)
  const nextStats = {
    totalHops:    traceStats.totalHops + 1,
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

  hud.update({ hopCount: nextStats.totalHops, avgLatency, packetLoss })
})

socket.on('trace-intel', (intelData) => {
  // Show intel card in side panel
  intel.addCard(intelData)

  // Update floating node label above the 3D node
  nodeLabeler.updateIntel(intelData.hop, intelData)

  // Print intel block to retro console
  consoleUI.addIntel(intelData)
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

  // Switch camera to cinematic orbit around center of all nodes
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
  nodeLabeler.clear()
  intel.clear()
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
  const delta   = clock.getDelta()
  const elapsed = clock.getElapsedTime()

  updateGrid(elapsed)
  cam.update(delta)
  pulses.update(delta)

  // MEDIUM-8: Cache getNodes() once per frame — avoids O(n²) with inner find()
  const allNodes = nodes.getNodes()
  for (const { mesh, auraMesh, position, hop } of allNodes) {
    if (hop.type === 'hostile') {
      // Rapid aggressive pulse: faster frequency, larger amplitude
      const s = 1 + Math.sin(elapsed * 8 + mesh.position.x) * 0.25
      mesh.scale.setScalar(s)
    } else if (hop.type === 'ghost') {
      // Gentle floating drift on Y axis around the node's original position
      mesh.position.y = position.y + Math.sin(elapsed * 0.7 + position.x * 2) * 0.15
      if (auraMesh) {
        // Breathing aura: slow opacity pulse
        auraMesh.material.opacity = 0.04 + Math.sin(elapsed * 1.2) * 0.03
        auraMesh.position.y = mesh.position.y
      }
      mesh.scale.setScalar(1 + Math.sin(elapsed * 0.9) * 0.04)
    } else {
      // Standard gentle pulse
      const s = 1 + Math.sin(elapsed * 2 + mesh.position.x) * 0.05
      mesh.scale.setScalar(s)
    }
  }

  // Sync node label positions with 3D world
  nodeLabeler.updatePositions(camera)

  composer.render()
}

animate()
