import { GlitchPass } from 'three/addons/postprocessing/GlitchPass.js'

const GLITCH_DURATION_MS = 500

/**
 * Manage a brief glitch effect on timeout hops.
 * @param {import('three/addons/postprocessing/EffectComposer.js').EffectComposer} composer
 * @returns {{ trigger: () => void }}
 */
export function createGlitchController(composer) {
  const glitchPass = new GlitchPass()
  glitchPass.enabled = false
  composer.addPass(glitchPass)

  let timeoutId = null

  function trigger() {
    if (timeoutId) clearTimeout(timeoutId)
    glitchPass.enabled = true
    timeoutId = setTimeout(() => {
      glitchPass.enabled = false
      timeoutId = null
    }, GLITCH_DURATION_MS)
  }

  return { trigger }
}
