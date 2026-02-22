/**
 * Input validation for traceroute targets.
 * Security-critical: prevents command injection.
 *
 * Uses spawn() with args array (not exec), but belt-and-suspenders
 * allowlist validation is mandatory.
 */

const MAX_TARGET_LENGTH = 253
const ALLOWED_PATTERN = /^[a-zA-Z0-9.\-:]+$/

/**
 * @param {string} input - Raw user input
 * @returns {{ valid: true, target: string } | { valid: false, error: string }}
 */
export function validateTarget(input) {
  if (typeof input !== 'string') {
    return { valid: false, error: 'Target must be a string' }
  }

  const trimmed = input.trim()

  if (trimmed.length === 0) {
    return { valid: false, error: 'Target cannot be empty' }
  }

  if (trimmed.length > MAX_TARGET_LENGTH) {
    return { valid: false, error: `Target exceeds maximum length of ${MAX_TARGET_LENGTH} characters` }
  }

  if (!ALLOWED_PATTERN.test(trimmed)) {
    return { valid: false, error: 'Target contains invalid characters. Only alphanumeric, dots, hyphens, and colons are allowed.' }
  }

  return { valid: true, target: trimmed }
}
