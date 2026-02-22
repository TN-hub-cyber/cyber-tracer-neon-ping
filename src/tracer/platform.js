/**
 * OS detection and traceroute command selection.
 * Returns the appropriate command and args for the current platform.
 */

/**
 * @param {string} target - Validated hostname or IP address
 * @param {string} [platformOverride] - Optional platform override for testing
 * @returns {{ cmd: string, args: string[] }}
 */
export function getTraceCommand(target, platformOverride) {
  const platform = platformOverride ?? process.platform

  if (platform === 'win32') {
    return Object.freeze({ cmd: 'tracert', args: [target] })
  }

  // linux, darwin, etc.
  return Object.freeze({ cmd: 'traceroute', args: ['-n', target] })
}

/**
 * @param {string} [platformOverride] - Optional platform override for testing
 * @returns {'unix' | 'win32'}
 */
export function getCurrentPlatform(platformOverride) {
  const platform = platformOverride ?? process.platform
  return platform === 'win32' ? 'win32' : 'unix'
}
