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

**Diagnose:** Identify which process owns the port:

```bash
ss -tlnp | grep 3000
# Example output: users:(("next-server (v1",pid=27591,...))
```

Common culprits: Next.js dev server, React dev server, other Node apps — all default to port 3000.

**Fix:**

```bash
# Option A — use a different port (safe, leaves other service running)
PORT=3001 node server.js

# Option B — kill the process occupying port 3000
kill $(ss -tlnp | grep 3000 | grep -oP 'pid=\K[0-9]+')
node server.js
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

### WHOIS / DNS intel lookup failures

**Symptom:** Intel panel cards show `???` for org, country, ASN, or all fields are blank.

**Causes / fixes:**

1. **WHOIS port blocked** -- Port 43 (TCP) must be open for outbound connections. Corporate firewalls and some VPNs block this. Verify with: `nc -zv whois.iana.org 43`
2. **DNS reverse lookup timeout** -- The 5-second timeout (`LOOKUP_TIMEOUT_MS`) may be too tight on slow networks. Intel lookups are non-blocking; the trace itself still works.
3. **IANA referral to unknown registry** -- If IANA refers to a server not in `ALLOWED_REGISTRIES`, the referral is dropped for SSRF safety. The IANA response is used as fallback, which may contain less detail.
4. **Cache returning stale data** -- Intel is cached by IP for the lifetime of the server process. Restart the server or call `clearCache()` (exported from `src/intel/gatherer.js`) to reset.

### Lossy hops (partial packet loss)

**Symptom:** Some hops show as amber flickering nodes with a dashed link leading to them. The console overlay shows `[LOSS] HOP X — Y% PACKET LOSS`.

**Cause:** A hop is classified as `lossy` when at least one — but not all — of the three traceroute probes for that hop timed out (e.g. output like `192.168.1.1  * 2.345 ms *`). The `lossRate` is computed as `(3 - received) / 3`. Classification priority is: ghost > lossy > hostile > normal.

**Visual indicators:**
- Amber wireframe icosahedron node (`#ffaa00`)
- Dashed amber link (gap width scales with `lossRate` — higher loss = wider gaps)
- Rapid flickering opacity animation (more dropout intervals at higher `lossRate`)
- Amber `[LOSS]` block in the console showing percentage and probe count

**Note:** Lossy hops do receive WHOIS/DNS intel lookups (if an IP was returned) and will appear in the intel side panel with amber styling.

**When to investigate:** Occasional lossy hops on backbone routers are expected and usually indicate ICMP rate-limiting rather than real packet loss. Persistent lossy hops on the same router across multiple traces may indicate congestion or misconfiguration.

### Hops classified as hostile unexpectedly

**Symptom:** Hops shown in red with CRT noise effect when they should be normal.

**Cause:** A hop is classified as `hostile` when its average latency exceeds the previous hop by more than 100 ms (`HOSTILE_DELTA_MS` in `src/tracer/classifier.js`). This can happen on the first hop after a ghost (timed-out) hop since there is no baseline -- in that case the classifier defaults to `normal`.

**Fix:** This is expected behavior for genuine latency spikes. If the threshold is too aggressive for your network, it can be adjusted in `classifier.js`.

### Ghost hops (all `* * *`)

**Symptom:** Some hops show as pale blue ghost nodes with `[???]` labels.

**Cause:** The router at that hop exists but does not respond to traceroute probes (ICMP TTL exceeded suppressed). This is normal -- many ISP and backbone routers are configured this way.

**Note:** Ghost hops do not trigger intel lookups (no IP to query).

---

## Rate Limit and Cache Behavior

### Rate limit map auto-pruning

The per-IP rate limit map (`rateLimitMap` in `server.js`) is pruned every 60 seconds. Entries older than 20 seconds (10x the 2-second cooldown) are removed. This prevents unbounded memory growth from many unique client IPs.

### Intel cache

`gatherIntel()` caches results by IP in a module-level `Map` (max 500 entries, LRU-like eviction). The cache persists for the lifetime of the server process. To clear it:

- Restart the server, or
- Import and call `clearCache()` from `src/intel/gatherer.js`

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
- The server enforces a 2-second per-IP rate limit between traces. The rate limit map is auto-pruned every 60 seconds to prevent memory growth.
- Child processes are automatically killed after 60 seconds or on client disconnect.
- WHOIS lookups use raw TCP (port 43) with no shell involvement, eliminating injection risk.
- WHOIS referrals are restricted to an `ALLOWED_REGISTRIES` allowlist (5 RIRs + select NICs) to prevent SSRF via spoofed IANA responses.
- WHOIS responses are capped at 64 KB to prevent memory DoS.
- IP addresses are validated against a basic pattern before any network call in the intel gatherer.
