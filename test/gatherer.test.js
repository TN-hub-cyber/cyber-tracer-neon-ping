import { describe, it, expect, vi, beforeEach } from 'vitest'
import { parseWhois } from '../src/intel/gatherer.js'

// Note: gatherIntel makes real network calls (DNS + WHOIS), so we
// only unit-test the pure parseWhois function here.

// ── parseWhois ────────────────────────────────────────────
describe('parseWhois', () => {
  it('should return all nulls for empty input', () => {
    const result = parseWhois('')
    expect(result).toEqual({ org: null, country: null, asn: null, netrange: null })
  })

  it('should return all nulls for null input', () => {
    const result = parseWhois(null)
    expect(result).toEqual({ org: null, country: null, asn: null, netrange: null })
  })

  describe('ARIN format (North America)', () => {
    const arinText = `
#
# ARIN WHOIS data
#

NetRange:       192.0.2.0 - 192.0.2.255
CIDR:           192.0.2.0/24
NetName:        DOCUMENTATION-MNT
Organization:   Documentation Inc (DOC-1)
Country:        US
OriginAS:       AS64496
    `

    it('should extract OrgName from ARIN format', () => {
      const { org } = parseWhois(arinText)
      expect(org).toBe('Documentation Inc (DOC-1)')
    })

    it('should extract country from ARIN format', () => {
      const { country } = parseWhois(arinText)
      expect(country).toBe('US')
    })

    it('should extract ASN from ARIN OriginAS field', () => {
      const { asn } = parseWhois(arinText)
      expect(asn).toBe('AS64496')
    })

    it('should extract NetRange from ARIN format', () => {
      const { netrange } = parseWhois(arinText)
      expect(netrange).toBe('192.0.2.0/24')
    })
  })

  describe('RIPE format (Europe)', () => {
    const ripeText = `
inetnum:        203.0.113.0 - 203.0.113.255
netname:        TEST-NETWORK
descr:          Test Documentation Network
country:        DE
org:            ORG-TNL1-RIPE
origin:         AS64497
route:          203.0.113.0/24
    `

    it('should extract org from RIPE netname when org field available', () => {
      // org-name preferred, then netname, then descr
      const { org } = parseWhois(ripeText)
      // org: field is ORG-TNL1-RIPE but that's an org ID, not name
      // netname: TEST-NETWORK or descr: Test Documentation Network
      expect(org).toBeTruthy()
    })

    it('should extract country from RIPE format', () => {
      const { country } = parseWhois(ripeText)
      expect(country).toBe('DE')
    })

    it('should extract ASN from RIPE origin field', () => {
      const { asn } = parseWhois(ripeText)
      expect(asn).toBe('AS64497')
    })

    it('should extract route as netrange from RIPE format', () => {
      const { netrange } = parseWhois(ripeText)
      // Should prefer inetnum or route
      expect(netrange).toBeTruthy()
    })
  })

  describe('APNIC format (Asia Pacific)', () => {
    const apnicText = `
inetnum:        203.0.114.0 - 203.0.114.255
netname:        SAKURA-INTERNET
descr:          SAKURA Internet Inc.
country:        JP
org-name:       SAKURA Internet Inc.
origin:         AS7506
route:          203.0.114.0/24
    `

    it('should prefer org-name over descr in APNIC format', () => {
      const { org } = parseWhois(apnicText)
      expect(org).toBe('SAKURA Internet Inc.')
    })

    it('should extract country JP from APNIC format', () => {
      const { country } = parseWhois(apnicText)
      expect(country).toBe('JP')
    })

    it('should extract ASN from APNIC origin field', () => {
      const { asn } = parseWhois(apnicText)
      expect(asn).toBe('AS7506')
    })
  })

  describe('edge cases', () => {
    it('should handle missing fields gracefully', () => {
      const partial = 'netname: SOME-NET\ncountry: AU\n'
      const result = parseWhois(partial)
      expect(result.org).toBeTruthy()
      expect(result.country).toBe('AU')
      expect(result.asn).toBeNull()
      expect(result.netrange).toBeNull()
    })

    it('should trim whitespace from extracted values', () => {
      const text = 'OrgName:   Whitespace Corp   \nCountry:   US   \n'
      const result = parseWhois(text)
      expect(result.org).toBe('Whitespace Corp')
      expect(result.country).toBe('US')
    })

    it('should handle ASN without AS prefix and normalize it', () => {
      const text = 'origin: 12345\n'
      const result = parseWhois(text)
      expect(result.asn).toBe('AS12345')
    })

    it('should handle ASN that already has AS prefix', () => {
      const text = 'OriginAS: AS64496\n'
      const result = parseWhois(text)
      expect(result.asn).toBe('AS64496')
    })
  })
})
