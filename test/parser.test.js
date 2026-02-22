import { describe, it, expect } from 'vitest'
import { parseTraceLine } from '../src/tracer/parser.js'

describe('parseTraceLine — Linux (unix)', () => {
  const platform = 'unix'

  it('parses a normal hop with 3 latencies', () => {
    const line = ' 1  203.0.113.1  1.234 ms  1.456 ms  1.789 ms'
    const result = parseTraceLine(line, platform)
    expect(result).toMatchObject({
      hop: 1,
      ip: '203.0.113.1',
      latencies: [1.234, 1.456, 1.789],
      timedOut: false,
    })
  })

  it('parses a full timeout (* * *)', () => {
    const line = ' 2  * * *'
    const result = parseTraceLine(line, platform)
    expect(result).toMatchObject({
      hop: 2,
      ip: null,
      latencies: [],
      timedOut: true,
    })
  })

  it('parses a partial timeout (some * some values)', () => {
    const line = ' 3  192.168.1.1  * 2.345 ms *'
    const result = parseTraceLine(line, platform)
    expect(result).not.toBeNull()
    expect(result.hop).toBe(3)
    expect(result.latencies).toContain(2.345)
  })

  it('returns null for a header line', () => {
    const line = 'traceroute to google.com (8.8.8.8), 30 hops max, 60 byte packets'
    expect(parseTraceLine(line, platform)).toBeNull()
  })

  it('returns null for a blank line', () => {
    expect(parseTraceLine('', platform)).toBeNull()
    expect(parseTraceLine('   ', platform)).toBeNull()
  })

  it('parses hop with large hop number', () => {
    const line = ' 30  10.0.0.1  50.000 ms  51.000 ms  52.000 ms'
    const result = parseTraceLine(line, platform)
    expect(result.hop).toBe(30)
    expect(result.timedOut).toBe(false)
  })

  it('result is immutable (frozen)', () => {
    const line = ' 1  1.1.1.1  1.0 ms  2.0 ms  3.0 ms'
    const result = parseTraceLine(line, platform)
    expect(Object.isFrozen(result)).toBe(true)
  })
})

describe('parseTraceLine — Windows (win32)', () => {
  const platform = 'win32'

  it('parses a normal Windows hop', () => {
    const line = '  1    <1 ms    1 ms    2 ms  203.0.113.1'
    const result = parseTraceLine(line, platform)
    expect(result).not.toBeNull()
    expect(result.hop).toBe(1)
    expect(result.ip).toBe('203.0.113.1')
    expect(result.timedOut).toBe(false)
    expect(result.latencies.length).toBeGreaterThan(0)
  })

  it('parses a Windows timeout (Request timed out.)', () => {
    const line = '  2     *        *        *     Request timed out.'
    const result = parseTraceLine(line, platform)
    expect(result).toMatchObject({
      hop: 2,
      ip: null,
      latencies: [],
      timedOut: true,
    })
  })

  it('returns null for Windows header line', () => {
    const line = 'Tracing route to google.com [8.8.8.8]'
    expect(parseTraceLine(line, platform)).toBeNull()
  })
})
