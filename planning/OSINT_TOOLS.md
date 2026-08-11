# OSINT — quick tools, face search, crypto/geo extras

## Quick network / recon tools
One-shot utilities on the OSINT/Search surface. Each takes an input, returns a
result card, saveable to a case. Passive unless noted; nmap is active (needs an
authorization record).
- Ping — reachability + RTT
- Traceroute — path / hops to a host
- Subnet calculator — CIDR -> range, mask, host count (offline)
- DNS lookup — A/AAAA/MX/TXT/NS/CNAME
- Reverse DNS — IP -> PTR
- Reverse IP — IP -> co-hosted domains
- Whois / RDAP — registration, org, abuse contact
- GeoIP lookup — IP -> geo + map
- ASN lookup — IP/ASN -> org, prefixes, peers
- Nmap scan — port/service scan (ACTIVE; authorization required; also on Network scan)
- HTTP headers — response + security headers
- Get page links — crawl a page, list links/assets (Photon-style)

## Face search
- FaceCheck.id (https://facecheck.id/en/Face-Search/API) — reverse FACE search:
  a face image -> matching profiles/photos across the web. Paid API; key in the
  vault. Add as a face/image source next to general reverse image. Sensitive:
  face search of real people — lawful/authorized use only; results land as cited
  observations with source links.

## Crypto / OSINT extras
- Crypto address analyzer — BTC/ETH address -> balance, tx history, clustering
  (free explorer APIs: mempool.space/Blockstream for BTC, Etherscan key for ETH)
- Geolocation / map analyzer — coordinates or photo GPS -> map pin + reverse
  geocode (Nominatim/OSM, free)
- QR / barcode decoder — image -> decoded payload (pivotable as a new seed)

Wiring: quick tools render as one-shot cards on the OSINT surface; face search and
crypto/geo/QR feed the correlation tree and are saveable to a case. All obey
STABILITY.md.
