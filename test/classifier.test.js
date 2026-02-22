import { describe, it, expect } from 'vitest'
import { classifyHop, enrichHop } from '../src/tracer/classifier.js'

// ── Helpers ───────────────────────────────────────────────
const makeHop = (hop, ip, latencies) =>
  Object.freeze({ hop, ip, latencies, timedOut: false })

const makeGhostHop = (hop) =>
  Object.freeze({ hop, ip: null, latencies: [], timedOut: true })

// ── classifyHop ───────────────────────────────────────────
describe('classifyHop', () => {
  describe('ghost classification', () => {
    it('should classify timed-out hop as ghost with null delta', () => {
      const result = classifyHop(makeGhostHop(1), null)
      expect(result.type).toBe('ghost')
      expect(result.latencyDelta).toBeNull()
    })

    it('should classify timed-out hop as ghost even when prev hop exists', () => {
      const prev = makeHop(1, '1.1.1.1', [10, 10, 10])
      const result = classifyHop(makeGhostHop(2), prev)
      expect(result.type).toBe('ghost')
      expect(result.latencyDelta).toBeNull()
    })
  })

  describe('normal classification', () => {
    it('should classify first hop (no prev) as normal', () => {
      const result = classifyHop(makeHop(1, '1.1.1.1', [10, 10, 10]), null)
      expect(result.type).toBe('normal')
      expect(result.latencyDelta).toBeNull()
    })

    it('should classify hop after a ghost hop as normal', () => {
      const ghost = makeGhostHop(2)
      const hop = makeHop(3, '1.1.1.3', [300, 300, 300])
      const result = classifyHop(hop, ghost)
      expect(result.type).toBe('normal')
    })

    it('should classify hop with latency delta exactly 100ms as normal (not strictly greater)', () => {
      const prev = makeHop(1, '1.1.1.1', [20, 20, 20])
      const hop  = makeHop(2, '1.1.1.2', [120, 120, 120]) // +100ms exactly
      const result = classifyHop(hop, prev)
      expect(result.type).toBe('normal')
    })

    it('should classify hop with small latency increase as normal', () => {
      const prev = makeHop(1, '1.1.1.1', [20, 20, 20])
      const hop  = makeHop(2, '1.1.1.2', [50, 50, 50]) // +30ms
      const result = classifyHop(hop, prev)
      expect(result.type).toBe('normal')
    })

    it('should classify hop with latency drop as normal', () => {
      const prev = makeHop(1, '1.1.1.1', [200, 200, 200])
      const hop  = makeHop(2, '1.1.1.2', [50, 50, 50])
      const result = classifyHop(hop, prev)
      expect(result.type).toBe('normal')
    })

    it('should return integer latencyDelta for normal hops', () => {
      const prev = makeHop(1, '1.1.1.1', [20, 20, 20])
      const hop  = makeHop(2, '1.1.1.2', [40, 40, 40])
      const result = classifyHop(hop, prev)
      expect(result.latencyDelta).toBe(20)
    })
  })

  describe('hostile classification', () => {
    it('should classify hop with delta > 100ms as hostile', () => {
      const prev = makeHop(1, '1.1.1.1', [20, 20, 20])
      const hop  = makeHop(2, '1.1.1.2', [150, 150, 150]) // +130ms
      const result = classifyHop(hop, prev)
      expect(result.type).toBe('hostile')
    })

    it('should report correct latencyDelta for hostile hop', () => {
      const prev = makeHop(1, '1.1.1.1', [10, 10, 10])
      const hop  = makeHop(2, '1.1.1.2', [200, 200, 200]) // +190ms
      const result = classifyHop(hop, prev)
      expect(result.latencyDelta).toBe(190)
    })

    it('should classify hop with delta just above 100ms as hostile', () => {
      const prev = makeHop(1, '1.1.1.1', [20, 20, 20])
      const hop  = makeHop(2, '1.1.1.2', [121, 121, 121]) // +101ms → hostile
      const result = classifyHop(hop, prev)
      expect(result.type).toBe('hostile')
    })

    it('should handle mixed latency arrays when classifying', () => {
      // avg of [10, 20, 30] = 20ms, avg of [180, 200, 220] = 200ms → +180ms hostile
      const prev = makeHop(1, '1.1.1.1', [10, 20, 30])
      const hop  = makeHop(2, '1.1.1.2', [180, 200, 220])
      const result = classifyHop(hop, prev)
      expect(result.type).toBe('hostile')
      expect(result.latencyDelta).toBe(180)
    })
  })
})

// ── enrichHop ─────────────────────────────────────────────
describe('enrichHop', () => {
  it('should preserve all original hop fields', () => {
    const hop = makeHop(5, '5.5.5.5', [15, 16, 17])
    const enriched = enrichHop(hop, null)
    expect(enriched.hop).toBe(5)
    expect(enriched.ip).toBe('5.5.5.5')
    expect(enriched.latencies).toEqual([15, 16, 17])
    expect(enriched.timedOut).toBe(false)
  })

  it('should add type and latencyDelta fields', () => {
    const hop = makeHop(1, '1.1.1.1', [10, 10, 10])
    const enriched = enrichHop(hop, null)
    expect(enriched).toHaveProperty('type')
    expect(enriched).toHaveProperty('latencyDelta')
  })

  it('should not mutate the original hop', () => {
    const hop = makeHop(1, '1.1.1.1', [10, 10, 10])
    enrichHop(hop, null)
    expect(hop).not.toHaveProperty('type')
  })

  it('should return a frozen object', () => {
    const hop = makeHop(1, '1.1.1.1', [10, 10, 10])
    const enriched = enrichHop(hop, null)
    expect(Object.isFrozen(enriched)).toBe(true)
  })

  it('should classify ghost hop correctly via enrichHop', () => {
    const hop = makeGhostHop(3)
    const enriched = enrichHop(hop, null)
    expect(enriched.type).toBe('ghost')
  })

  it('should classify hostile hop correctly via enrichHop', () => {
    const prev = makeHop(1, '1.1.1.1', [10, 10, 10])
    const hop  = makeHop(2, '1.1.1.2', [200, 200, 200])
    const enriched = enrichHop(hop, prev)
    expect(enriched.type).toBe('hostile')
    expect(enriched.latencyDelta).toBe(190)
  })
})
