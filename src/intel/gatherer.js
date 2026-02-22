/**
 * Intel gatherer: DNS hostname + WHOIS data for a given IP.
 *
 * WHOIS is queried via raw TCP (port 43) — no exec(), no shell, no injection risk.
 * DNS uses Node.js built-in dns.promises module.
 *
 * Public surface:
 *   parseWhois(text)   — pure parser, easily unit-tested
 *   gatherIntel(ip)    — async network lookup, result cached by IP
 *   clearCache()       — reset cache (for tests / new sessions)
 */

import dns from 'node:dns'
import net from 'node:net'

// ── Constants ─────────────────────────────────────────────

const LOOKUP_TIMEOUT_MS = 5_000

/** Maximum WHOIS response size (64 KB). Prevents memory DoS. */
const MAX_WHOIS_BYTES = 64 * 1024

/** IANA refers IP queries to the appropriate regional registry. */
const IANA_WHOIS = 'whois.iana.org'

/**
 * Allowlisted WHOIS registries. Only these are trusted as IANA referrals.
 * Prevents SSRF attacks via a spoofed IANA refer: field.
 */
const ALLOWED_REGISTRIES = new Set([
  'whois.arin.net',
  'whois.ripe.net',
  'whois.apnic.net',
  'whois.lacnic.net',
  'whois.afrinic.net',
  'whois.nic.ad.jp',
  'whois.jpnic.net',
  'rr.ntt.net',
  'whois.twnic.net',
  'whois.krnic.net',
])

/** Basic IPv4 / IPv6 allowlist (no shell, just sanity check before network calls). */
const IP_PATTERN = /^[\d.]+$|^[0-9a-fA-F:]+$/

/** LRU-like cap: evict oldest entry when cache exceeds this size. */
const MAX_CACHE_SIZE = 500

/** @type {Map<string, object>} Module-level cache keyed by IP */
const cache = new Map()

// ── Utility: timeout helper ───────────────────────────────

/**
 * Race a promise against a timeout, ensuring the timer is always cleared.
 * @template T
 * @param {Promise<T>} promise
 * @param {number} ms
 * @param {string} message
 * @returns {Promise<T>}
 */
function withTimeout(promise, ms, message) {
  let timer
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms)
  })
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer))
}

// ── Pure WHOIS parser ─────────────────────────────────────

/**
 * Try each pattern against each line; return first non-empty match.
 * @param {string[]} lines
 * @param {RegExp[]} patterns
 * @returns {string|null}
 */
function extract(lines, patterns) {
  for (const pattern of patterns) {
    for (const line of lines) {
      const m = pattern.exec(line)
      if (m && m[1].trim()) return m[1].trim()
    }
  }
  return null
}

/**
 * Normalize an ASN string to always have the "AS" prefix.
 * @param {string|null} raw
 * @returns {string|null}
 */
function normalizeAsn(raw) {
  if (!raw) return null
  const trimmed = raw.trim()
  return trimmed.startsWith('AS') ? trimmed : `AS${trimmed}`
}

/**
 * Parse WHOIS response text into structured intel fields.
 * Handles ARIN, RIPE, APNIC, and JPNIC registry formats.
 *
 * @param {string|null} text - Raw WHOIS response
 * @returns {{ org: string|null, country: string|null, asn: string|null, netrange: string|null }}
 */
export function parseWhois(text) {
  const empty = { org: null, country: null, asn: null, netrange: null }
  if (!text || typeof text !== 'string') return empty

  const lines = text.split('\n')

  const org = extract(lines, [
    /^OrgName:\s*(.+)/i,
    /^org-name:\s*(.+)/i,
    /^Organization:\s*(.+)/i,
    /^netname:\s*(.+)/i,
    /^descr:\s*(.+)/i,
  ])

  const country = extract(lines, [
    /^Country:\s*(.+)/i,
    /^country:\s*(.+)/i,
  ])

  const asnRaw = extract(lines, [
    /^OriginAS:\s*((?:AS)?\d+)/i,
    /^origin:\s*((?:AS)?\d+)/i,
  ])
  const asn = normalizeAsn(asnRaw)

  const netrange = extract(lines, [
    /^CIDR:\s*(.+)/i,
    /^NetRange:\s*(.+)/i,
    /^inetnum:\s*(.+)/i,
    /^route:\s*(.+)/i,
  ])

  return { org, country, asn, netrange }
}

// ── Raw TCP WHOIS client ──────────────────────────────────

/**
 * Send a WHOIS query to a given server via TCP port 43.
 * Uses raw net.Socket — no shell, no exec, no injection surface.
 * Response is capped at MAX_WHOIS_BYTES to prevent memory DoS.
 *
 * @param {string} query  IP address to query
 * @param {string} server WHOIS server hostname
 * @returns {Promise<string>}
 */
function tcpWhoisQuery(query, server) {
  return new Promise((resolve, reject) => {
    const client = net.createConnection({ port: 43, host: server })
    let data = ''

    client.setEncoding('utf8')

    client.on('connect', () => {
      client.write(`${query}\r\n`)
    })

    client.on('data', (chunk) => {
      data += chunk
      // HIGH-2: Cap response size to prevent memory DoS
      if (data.length > MAX_WHOIS_BYTES) {
        client.destroy()
        resolve(data.slice(0, MAX_WHOIS_BYTES))
      }
    })

    client.on('end', () => resolve(data))
    client.on('error', reject)
  })
}

/**
 * Extract the referral server from an IANA WHOIS response.
 * Returns null if no refer field is found or if the server is not allowlisted.
 *
 * @param {string} text
 * @returns {string|null}
 */
function extractReferral(text) {
  const m = /^refer:\s*(\S+)/im.exec(text)
  if (!m) return null
  const server = m[1].toLowerCase()
  // HIGH-3: Only follow referrals to known, trusted registries (SSRF prevention)
  return ALLOWED_REGISTRIES.has(server) ? server : null
}

/**
 * Fetch WHOIS text for an IP, following IANA referrals.
 * Returns empty string on any network error.
 * @param {string} ip
 * @returns {Promise<string>}
 */
async function fetchWhoisText(ip) {
  try {
    const ianaResponse = await withTimeout(
      tcpWhoisQuery(ip, IANA_WHOIS),
      LOOKUP_TIMEOUT_MS,
      'IANA WHOIS timeout'
    )

    const referral = extractReferral(ianaResponse)
    if (!referral) return ianaResponse

    return await withTimeout(
      tcpWhoisQuery(ip, referral),
      LOOKUP_TIMEOUT_MS,
      'Registry WHOIS timeout'
    )
  } catch {
    return ''
  }
}

// ── DNS reverse lookup ────────────────────────────────────

/**
 * Resolve the reverse DNS hostname for an IP.
 * Returns null on any error or timeout.
 * @param {string} ip
 * @returns {Promise<string|null>}
 */
async function resolveHostname(ip) {
  try {
    const names = await withTimeout(
      dns.promises.reverse(ip),
      LOOKUP_TIMEOUT_MS,
      'DNS timeout'
    )
    return names[0] ?? null
  } catch {
    return null
  }
}

// ── Cache helpers ─────────────────────────────────────────

/**
 * Store an intel result in the cache with LRU-like eviction.
 * @param {string} ip
 * @param {object} intel
 */
function cacheSet(ip, intel) {
  // HIGH-5: Evict oldest entry when cache exceeds capacity
  if (cache.size >= MAX_CACHE_SIZE) {
    const oldest = cache.keys().next().value
    cache.delete(oldest)
  }
  cache.set(ip, intel)
}

// ── Public API ────────────────────────────────────────────

/**
 * Gather DNS + WHOIS intel for an IP address.
 * Runs DNS and WHOIS lookups concurrently; caches results by IP.
 *
 * @param {string|null} ip
 * @returns {Promise<{
 *   ip: string,
 *   hostname: string|null,
 *   org: string|null,
 *   country: string|null,
 *   asn: string|null,
 *   netrange: string|null,
 * }|null>}  null when ip is null (ghost hop)
 */
export async function gatherIntel(ip) {
  if (!ip) return null
  // MEDIUM-1: Validate IP format before making any network calls
  if (!IP_PATTERN.test(ip)) return null
  if (cache.has(ip)) return cache.get(ip)

  const [hostname, whoisText] = await Promise.all([
    resolveHostname(ip),
    fetchWhoisText(ip),
  ])

  const intel = Object.freeze({
    ip,
    hostname,
    ...parseWhois(whoisText),
  })

  cacheSet(ip, intel)
  return intel
}

/**
 * Clear the intel cache (useful between sessions).
 */
export function clearCache() {
  cache.clear()
}
