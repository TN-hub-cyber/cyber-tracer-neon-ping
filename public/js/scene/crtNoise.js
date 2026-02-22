/**
 * CRT Noise effect controller.
 *
 * Renders scan-line flicker + random pixel noise onto a full-screen canvas
 * overlay, triggered by hostile hops. The effect lasts ~800ms then fades.
 *
 * Separate from Three.js — pure Canvas 2D so it doesn't interfere with
 * the WebGL bloom pipeline.
 */

const EFFECT_DURATION_MS = 800
const NOISE_DENSITY = 0.004       // fraction of pixels that get noise dots
const SCANLINE_OPACITY_MAX = 0.18

/**
 * Create the CRT noise controller.
 *
 * @param {HTMLCanvasElement} canvas  - Dedicated overlay canvas (z-index above 3D)
 * @returns {{ trigger: () => void }}
 */
export function createCrtNoise(canvas) {
  const ctx = canvas.getContext('2d')

  let startTime = null
  let rafId = null

  function resize() {
    canvas.width  = window.innerWidth
    canvas.height = window.innerHeight
  }

  resize()
  window.addEventListener('resize', resize)

  function drawFrame(now) {
    const elapsed = now - startTime
    if (elapsed >= EFFECT_DURATION_MS) {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      rafId = null
      return
    }

    // Easing: sharp in, fade out
    const progress = elapsed / EFFECT_DURATION_MS
    const intensity = Math.pow(1 - progress, 1.5)

    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // ── Horizontal scan lines ─────────────────────────────
    const scanOpacity = SCANLINE_OPACITY_MAX * intensity
    ctx.fillStyle = `rgba(255, 0, 0, ${scanOpacity})`
    for (let y = 0; y < canvas.height; y += 4) {
      ctx.fillRect(0, y, canvas.width, 1)
    }

    // ── Random noise pixels ───────────────────────────────
    const pixelCount = Math.floor(
      canvas.width * canvas.height * NOISE_DENSITY * intensity
    )

    for (let i = 0; i < pixelCount; i++) {
      const px = Math.random() * canvas.width  | 0
      const py = Math.random() * canvas.height | 0
      const brightness = (155 + Math.random() * 100) | 0
      ctx.fillStyle = `rgba(${brightness}, ${brightness >> 1}, ${brightness >> 1}, ${intensity})`
      ctx.fillRect(px, py, 2, 2)
    }

    // ── Occasional full-width glitch band ─────────────────
    if (Math.random() < 0.25 * intensity) {
      const bandY = Math.random() * canvas.height | 0
      const bandH = (4 + Math.random() * 12) | 0
      const shift = ((Math.random() - 0.5) * 60 * intensity) | 0

      // Copy a band of the canvas shifted horizontally
      const imageData = ctx.getImageData(0, bandY, canvas.width, bandH)
      ctx.clearRect(0, bandY, canvas.width, bandH)
      ctx.putImageData(imageData, shift, bandY)
    }

    rafId = requestAnimationFrame(drawFrame)
  }

  /**
   * Trigger the CRT noise effect.
   * Calling multiple times during an active effect resets the timer.
   */
  function trigger() {
    if (rafId !== null) cancelAnimationFrame(rafId)
    startTime = performance.now()
    rafId = requestAnimationFrame(drawFrame)
  }

  return { trigger }
}
