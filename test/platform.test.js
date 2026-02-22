import { describe, it, expect } from 'vitest'
import { getTraceCommand, getCurrentPlatform } from '../src/tracer/platform.js'

describe('getTraceCommand', () => {
  it('returns traceroute -n on linux', () => {
    const result = getTraceCommand('1.1.1.1', 'linux')
    expect(result.cmd).toBe('traceroute')
    expect(result.args).toEqual(['-n', '1.1.1.1'])
  })

  it('returns traceroute -n on darwin', () => {
    const result = getTraceCommand('8.8.8.8', 'darwin')
    expect(result.cmd).toBe('traceroute')
    expect(result.args).toContain('-n')
    expect(result.args).toContain('8.8.8.8')
  })

  it('returns tracert on win32', () => {
    const result = getTraceCommand('example.com', 'win32')
    expect(result.cmd).toBe('tracert')
    expect(result.args).toEqual(['example.com'])
  })

  it('result object is frozen (immutable)', () => {
    const result = getTraceCommand('1.1.1.1', 'linux')
    expect(Object.isFrozen(result)).toBe(true)
  })

  it('includes the target in args', () => {
    const result = getTraceCommand('google.com', 'linux')
    expect(result.args).toContain('google.com')
  })
})

describe('getCurrentPlatform', () => {
  it('returns unix on linux', () => {
    expect(getCurrentPlatform('linux')).toBe('unix')
  })

  it('returns unix on darwin', () => {
    expect(getCurrentPlatform('darwin')).toBe('unix')
  })

  it('returns win32 on win32', () => {
    expect(getCurrentPlatform('win32')).toBe('win32')
  })
})
