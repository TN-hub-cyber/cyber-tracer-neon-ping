# CyberTracer Runbook

Operational guide for running and troubleshooting CyberTracer (NEON-PING).

---

## Deployment

### Local (default)

```bash
npm install
node server.js
# → http://localhost:3000
```

### Custom port

```bash
PORT=8080 node server.js
# → http://localhost:8080
```

### Keep-alive with pm2 (optional)

```bash
npm install -g pm2
pm2 start server.js --name cyber-tracer
pm2 save
pm2 startup   # follow the printed command to enable auto-restart
```

---

## Monitoring

### Health check

The server exposes the static frontend on `/`. A `200` response confirms the server is up:

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000
# Expected: 200
```

### Active processes

Check for orphaned `traceroute` child processes:

```bash
pgrep -a traceroute
# Should be empty when no trace is running
```

### Socket.IO connections

Socket.IO does not expose a built-in health endpoint. Check server logs or use:

```bash
ss -tnp | grep :3000
```

---

## Common Issues and Fixes

### `traceroute: command not found` (ENOENT)

**Symptom:** Console overlay shows `"traceroute" not found. On WSL/Linux, install it with: sudo apt install traceroute`

**Fix:**

```bash
sudo apt install traceroute       # Debian / Ubuntu / WSL
brew install traceroute           # macOS
```

### `traceroute` requires root / ICMP permissions

**Symptom:** `traceroute` runs but all hops show `* * *`

**Fix:**

```bash
# Linux — grant cap_net_raw capability (no full root needed)
sudo setcap cap_net_raw+ep $(which traceroute)

# Alternatively run as root (not recommended for production)
sudo node server.js
```

### Port already in use

**Symptom:** `Error: listen EADDRINUSE :::3000`

**Fix:**

```bash
# Find and kill the process using port 3000
lsof -ti :3000 | xargs kill
# Or use a different port
PORT=3001 node server.js
```

### WebGL not available

**Symptom:** Black screen, browser console shows `WebGL is not supported`

**Fix:** Enable hardware acceleration in the browser:
- Chrome: `chrome://settings/system` → "Use graphics acceleration when available"
- Firefox: `about:config` → `layers.acceleration.force-enabled = true`

### Socket.IO connection refused

**Symptom:** Console overlay shows `[SYSTEM] Connection lost.`

**Causes / fixes:**
1. Server not running → `node server.js`
2. Accessing from a different hostname than `localhost` → CORS is restricted to `localhost`; open `http://localhost:3000` directly

### Trace hangs indefinitely

**Symptom:** TRACING state never completes

**Cause:** The 60-second hard timeout in `runner.js` will automatically kill the process and emit `trace-complete`. If this does not happen, the child process may have been started before the timeout logic was active (rare).

**Fix:** Click **CANCEL** to manually terminate, then start a new trace.

---

## Rollback Procedures

### Revert to previous commit

```bash
git log --oneline -5        # identify the target commit hash
git revert <hash>           # create a revert commit (safe)
node server.js              # restart
```

### Hard reset (discards uncommitted changes)

```bash
git reset --hard <hash>
node server.js
```

### Restore from GitHub

```bash
git fetch origin
git reset --hard origin/main
npm install
node server.js
```

---

## Security Notes

- The server only accepts connections from `localhost` (CORS restricted).
- All target inputs are validated with a strict allowlist regex before reaching the shell.
- `traceroute` is spawned via `spawn()` with an explicit args array — shell injection is not possible.
- The server enforces a 2-second per-IP rate limit between traces.
- Child processes are automatically killed after 60 seconds or on client disconnect.
