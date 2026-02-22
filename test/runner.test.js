import { describe, it, expect, vi } from 'vitest'

/**
 * Test the runTrace runner using a mock child process.
 * We mock node:child_process so no real traceroute is needed.
 */

import { EventEmitter } from 'node:events'

// Build a fake child process factory
function makeFakeChild(options = {}) {
  const child = new EventEmitter()
  child.stdout = new EventEmitter()
  child.stderr = new EventEmitter()
  child.kill = vi.fn(() => {
    if (options.onKill) options.onKill(child)
  })
  return child
}

describe('runTrace', () => {
  it('emits hops from stdout lines and calls onComplete on close', async () => {
    const fakeChild = makeFakeChild()

    vi.doMock('node:child_process', () => ({
      spawn: vi.fn(() => fakeChild),
    }))

    const { runTrace } = await import('../src/tracer/runner.js?t1=' + Date.now())

    const hops = []
    const raws = []
    let completed = false

    runTrace('1.1.1.1', {
      onHop: (h) => hops.push(h),
      onRaw: (l) => raws.push(l),
      onError: () => {},
      onComplete: () => { completed = true },
    })

    // Emit a valid Linux traceroute line
    fakeChild.stdout.emit('data', ' 1  1.1.1.1  5.000 ms  6.000 ms  7.000 ms\n')
    fakeChild.emit('close', 0)

    expect(hops).toHaveLength(1)
    expect(hops[0].hop).toBe(1)
    expect(hops[0].ip).toBe('1.1.1.1')
    expect(completed).toBe(true)
    expect(raws).toHaveLength(1)
  })

  it('emits error when process fires an ENOENT error', async () => {
    const fakeChild = makeFakeChild()

    vi.doMock('node:child_process', () => ({
      spawn: vi.fn(() => fakeChild),
    }))

    const { runTrace } = await import('../src/tracer/runner.js?t2=' + Date.now())

    const errors = []
    let completed = false

    runTrace('1.1.1.1', {
      onHop: () => {},
      onRaw: () => {},
      onError: (msg) => errors.push(msg),
      onComplete: () => { completed = true },
    })

    const err = new Error('spawn traceroute ENOENT')
    err.code = 'ENOENT'
    fakeChild.emit('error', err)

    expect(errors).toHaveLength(1)
    expect(errors[0]).toMatch(/not found/)
    expect(errors[0]).toMatch(/sudo apt install traceroute/)
    expect(completed).toBe(true)
  })

  it('cancel() kills the child process', async () => {
    const fakeChild = makeFakeChild()

    vi.doMock('node:child_process', () => ({
      spawn: vi.fn(() => fakeChild),
    }))

    const { runTrace } = await import('../src/tracer/runner.js?t3=' + Date.now())

    const { cancel } = runTrace('1.1.1.1', {
      onHop: () => {},
      onRaw: () => {},
      onError: () => {},
      onComplete: () => {},
    })

    cancel()
    expect(fakeChild.kill).toHaveBeenCalledOnce()
  })

  it('handles multi-line chunks via line buffering', async () => {
    const fakeChild = makeFakeChild()

    vi.doMock('node:child_process', () => ({
      spawn: vi.fn(() => fakeChild),
    }))

    const { runTrace } = await import('../src/tracer/runner.js?t4=' + Date.now())

    const hops = []

    runTrace('1.1.1.1', {
      onHop: (h) => hops.push(h),
      onRaw: () => {},
      onError: () => {},
      onComplete: () => {},
    })

    // Two lines arrive in one chunk
    fakeChild.stdout.emit(
      'data',
      ' 1  10.0.0.1  1.0 ms  2.0 ms  3.0 ms\n 2  10.0.0.2  4.0 ms  5.0 ms  6.0 ms\n'
    )
    fakeChild.emit('close', 0)

    expect(hops).toHaveLength(2)
    expect(hops[0].hop).toBe(1)
    expect(hops[1].hop).toBe(2)
  })

  it('handles a split line across two data chunks', async () => {
    const fakeChild = makeFakeChild()

    vi.doMock('node:child_process', () => ({
      spawn: vi.fn(() => fakeChild),
    }))

    const { runTrace } = await import('../src/tracer/runner.js?t5=' + Date.now())

    const hops = []

    runTrace('1.1.1.1', {
      onHop: (h) => hops.push(h),
      onRaw: () => {},
      onError: () => {},
      onComplete: () => {},
    })

    // Line split across two data events
    fakeChild.stdout.emit('data', ' 1  10.0.0.1  1.0 ms  2.0')
    fakeChild.stdout.emit('data', ' ms  3.0 ms\n')
    fakeChild.emit('close', 0)

    expect(hops).toHaveLength(1)
    expect(hops[0].hop).toBe(1)
  })
})
