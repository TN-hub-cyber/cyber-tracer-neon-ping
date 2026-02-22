# Contributing to CyberTracer (NEON-PING)

## Development Workflow

```
1. Fork → clone → install → run → test → commit
```

### Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| Node.js | ≥ 18 | Runtime |
| npm | ≥ 9 | Package manager |
| traceroute | any | Network diagnostics (Linux/macOS) |

**WSL / Linux — install traceroute:**

```bash
sudo apt install traceroute
```

### Setup

```bash
git clone https://github.com/TN-hub-cyber/cyber-tracer-neon-ping.git
cd cyber-tracer-neon-ping
npm install
cp .env.example .env   # optional — defaults work out of the box
```

---

## Available Scripts

| Script | Command | Description |
|--------|---------|-------------|
| `start` | `npm start` | Start the production server (`node server.js`) |
| `test` | `npm test` | Run the full test suite with Vitest (single-run mode) |

---

## Environment Variables

Defined in `.env.example`:

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | TCP port the HTTP/Socket.IO server listens on |

---

## Testing

### Run all tests

```bash
npm test
```

### Run tests in watch mode (development)

```bash
npx vitest
```

### Coverage report

```bash
npx vitest run --coverage
```

### Test files

| File | What it covers |
|------|---------------|
| `test/parser.test.js` | Traceroute output parsing (Linux + Windows formats, timeouts, immutability) |
| `test/validation.test.js` | Input validation, injection prevention, edge cases |
| `test/platform.test.js` | OS detection, command selection |
| `test/runner.test.js` | Child process lifecycle, ENOENT handling, cancel, line buffering |
| `test/classifier.test.js` | Hop classification (normal, hostile, ghost), latency delta, enrichHop immutability |
| `test/gatherer.test.js` | WHOIS text parsing (ARIN, RIPE, APNIC, JPNIC formats), null/empty input handling |

**Total: 76 tests**

### Target coverage

80 % minimum on all backend modules under `src/`.

---

## Project Structure

```
.
├── server.js               # Express + Socket.IO entry point
├── src/
│   ├── validation.js       # Input sanitisation (security-critical)
│   ├── tracer/
│   │   ├── platform.js     # OS detection and command selection
│   │   ├── parser.js       # Traceroute output parser
│   │   ├── runner.js       # Child process management
│   │   └── classifier.js   # Hop classification: normal / hostile / ghost
│   └── intel/
│       └── gatherer.js     # DNS reverse lookup + WHOIS intel (cached, SSRF-safe)
├── public/
│   ├── index.html
│   ├── css/style.css
│   └── js/
│       ├── main.js         # App entry: Socket.IO ↔ Three.js integration
│       ├── scene/          # Three.js renderer, bloom, grid, glitch
│       │   └── crtNoise.js # CRT scan-line + pixel noise on hostile hops
│       ├── network/        # Nodes, links, particles, shared colours
│       │   └── nodeLabel.js# Floating country/ASN badges above 3D nodes
│       ├── camera/         # Tracking + cinematic orbit
│       └── ui/             # HUD, console overlay, intel panel
│           └── intelPanel.js # WHOIS/DNS side panel with typewriter animation
└── test/                   # Vitest unit/integration tests (76 tests)
```

---

## Coding Standards

- **Immutability**: never mutate objects — use `{ ...obj, key: value }` or `[...arr, item]`
- **File size**: 200–400 lines typical, 800 max
- **Function size**: ≤ 50 lines
- **No `console.log`** in committed code
- **Error handling**: always wrap risky operations in try/catch
- **Security**: all user input must pass through `validateTarget()` before reaching the shell
- **SSRF prevention**: WHOIS referral targets must be in the `ALLOWED_REGISTRIES` allowlist (see `src/intel/gatherer.js`)
- **IP validation**: IPs are checked against `IP_PATTERN` before any network call in the intel gatherer
- **Rate limit hygiene**: `rateLimitMap` is auto-pruned every 60 seconds to prevent unbounded growth

---

## Commit Message Format

```
<type>: <description>

<optional body>
```

Types: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `perf`, `ci`
