import express from 'express'
import { createServer } from 'node:http'
import { Server } from 'socket.io'
import { fileURLToPath } from 'node:url'
import { join, dirname } from 'node:path'
import { validateTarget } from './src/validation.js'
import { runTrace } from './src/tracer/runner.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PORT = process.env.PORT ?? 3000

const app = express()
const httpServer = createServer(app)
const io = new Server(httpServer)

app.use(express.static(join(__dirname, 'public')))

io.on('connection', (socket) => {
  let activeCancelFn = null
  let lastTraceAt = 0
  const COOLDOWN_MS = 2000

  socket.on('start-trace', ({ target } = {}) => {
    // Rate limit: 2 second cooldown between traces
    const now = Date.now()
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

    // Cancel any running trace
    if (activeCancelFn) {
      activeCancelFn()
      activeCancelFn = null
    }

    lastTraceAt = now

    const { cancel } = runTrace(validation.target, {
      onHop(hop) {
        socket.emit('trace-hop', hop)
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
  console.log(`CyberTracer running at http://localhost:${PORT}`)
})
