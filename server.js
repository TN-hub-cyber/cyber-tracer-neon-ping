import express from 'express'
import { createServer } from 'node:http'
import { Server } from 'socket.io'
import { fileURLToPath } from 'node:url'
import { join, dirname } from 'node:path'
import { validateTarget } from './src/validation.js'
import { runTrace } from './src/tracer/runner.js'
import { enrichHop } from './src/tracer/classifier.js'
import { gatherIntel } from './src/intel/gatherer.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PORT = process.env.PORT ?? 3000

const app = express()
const httpServer = createServer(app)

// Restrict CORS to same origin only (prevents CSWSH attacks)
const io = new Server(httpServer, {
  cors: {
    origin: `http://localhost:${PORT}`,
    methods: ['GET', 'POST'],
  },
})

// Per-IP rate limiting (prevents bypass via multiple connections)
const rateLimitMap = new Map()
const COOLDOWN_MS = 2000

// HIGH-4: Prune stale rate-limit entries to prevent unbounded Map growth.
// Entries older than 10x the cooldown window are no longer needed.
setInterval(() => {
  const cutoff = Date.now() - COOLDOWN_MS * 10
  for (const [ip, timestamp] of rateLimitMap) {
    if (timestamp < cutoff) rateLimitMap.delete(ip)
  }
}, 60_000)

app.use(express.static(join(__dirname, 'public')))

io.on('connection', (socket) => {
  let activeCancelFn = null
  const clientIp = socket.handshake.address

  // Per-connection state for hop classification
  let prevHop = null

  socket.on('start-trace', ({ target } = {}) => {
    // Rate limit by IP address
    const now = Date.now()
    const lastTraceAt = rateLimitMap.get(clientIp) ?? 0
    if (now - lastTraceAt < COOLDOWN_MS) {
      socket.emit('trace-error', 'Please wait before starting another trace.')
      return
    }

    // Validate input
    const validation = validateTarget(target)
    if (!validation.valid) {
      socket.emit('trace-error', validation.error)
      return
    }

    // Cancel any running trace for this socket
    if (activeCancelFn) {
      activeCancelFn()
      activeCancelFn = null
    }

    rateLimitMap.set(clientIp, now)
    prevHop = null  // Reset classifier state for new trace

    const { cancel } = runTrace(validation.target, {
      onHop(rawHop) {
        // Enrich hop with classification type (normal/hostile/ghost)
        const hop = enrichHop(rawHop, prevHop)
        prevHop = hop

        socket.emit('trace-hop', hop)

        // Async intel lookup — does NOT block hop emission
        if (hop.ip) {
          gatherIntel(hop.ip).then((intel) => {
            if (intel) {
              socket.emit('trace-intel', { hop: hop.hop, ...intel })
            }
          }).catch(() => {
            // Silent: intel is enhancement, not critical path
          })
        }
      },
      onRaw(line) {
        socket.emit('trace-raw', line)
      },
      onError(message) {
        socket.emit('trace-error', message)
      },
      onComplete() {
        activeCancelFn = null
        socket.emit('trace-complete')
      },
    })

    activeCancelFn = cancel
  })

  socket.on('cancel-trace', () => {
    if (activeCancelFn) {
      activeCancelFn()
      activeCancelFn = null
      socket.emit('trace-raw', '[Trace cancelled by user]')
      socket.emit('trace-complete')
    }
  })

  socket.on('disconnect', () => {
    if (activeCancelFn) {
      activeCancelFn()
      activeCancelFn = null
    }
  })
})

httpServer.listen(PORT, () => {
  process.stdout.write(`CyberTracer running at http://localhost:${PORT}\n`)
})
