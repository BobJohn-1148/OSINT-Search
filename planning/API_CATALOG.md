# Reacher — data source and tools catalog

Free-first. Every key slots into the Phase 1 vault; paid sources are optional
upgrades. Free tiers change — figures verified around August 2026; re-check before
relying on a limit. Tier = passive (safe, no target contact) or active (touches
the target; needs an authorization record).

## 1. IP and network intel

| Source | Free tier | Key | Notes |
|---|---|---|---|
| Shodan | 100 results/search; `InternetDB` endpoint free, no key, no rate limit | freemium | InternetDB is the free spine for open-port lookups |
| Censys | ~250 queries/mo (100 free credits on new platform) | free acct | host/cert search |
| ipinfo.io | ~50k/mo | free acct | geo, ASN, org |
| ip-api.com | 45 req/min | none | non-commercial free |
| ipwhois.io / RDAP | generous / unlimited | none | ownership, netblock |
| GreyNoise | 50/day no key, 1,000/day registered; Community tier | free acct | internet-noise / scanner reputation |
| AbuseIPDB | 1,000 checks/day | free acct | abuse reports |

## 2. Domain / DNS / WHOIS / certificates

| Source | Free tier | Key | Notes |
|---|---|---|---|
| RDAP / WHOIS | unlimited | none | registration, contacts |
| crt.sh | unlimited | none | certificate transparency → subdomains |
| DNS (DoH) | unlimited | none | A/AAAA/MX/TXT/NS, SPF/DKIM/DMARC |
| SecurityTrails | limited | freemium | historical DNS, subdomains |
| Hunter.io | ~25–50/mo | freemium | domain → emails, patterns |

## 3. Email discovery and validation

| Source | Free tier | Key | Notes |
|---|---|---|---|
| Holehe | unlimited (self-run) | none | email → 120+ sites via reset flows |
| theHarvester | unlimited (self-run) | none | emails/subdomains/hosts from public sources |
| Hunter.io | freemium | key | finder + verifier |
| EmailRep | limited | freemium | reputation/profile |

## 4. Username and social

| Source | Free tier | Key | Notes |
|---|---|---|---|
| Maigret | unlimited (self-run) | none | 3000+ sites, builds dossier |
| Blackbird | unlimited (self-run) | none | username/email account hunt |
| Sherlock | unlimited (self-run) | none | classic username sweep |
| WhatsMyName | unlimited (data set) | none | curated site-detection list |

## 5. Breach / credential monitoring

| Source | Free tier | Key | Notes |
|---|---|---|---|
| XposedOrNot | free API tier | free | breach lookup + alerts — the free spine |
| HIBP | Pwned Passwords free; search API paid (~$4.39/mo; stealer logs $379/mo) | paid | slot key into vault later |
| Holehe | free (self-run) | none | account existence, not passwords |
| LeakCheck / DeHashed / Snusbase | paid | paid | deep breach records, paid slots |
| IntelX | limited | freemium | leaks, pastes, darkweb index |

## 6. Phone

| Source | Free tier | Key | Notes |
|---|---|---|---|
| libphonenumber | unlimited (lib) | none | validate, region, line type |
| NumVerify | ~100–250/mo | freemium | carrier, line type |
| PhoneInfoga | free (self-run) | none | footprint + formatting |
| Twilio Lookup | paid | paid | authoritative carrier/caller-ID |

## 7. Business / company

| Source | Free tier | Key | Notes |
|---|---|---|---|
| OpenCorporates | limited | freemium | global company registry |
| SEC EDGAR | unlimited | none | US filings |
| Companies House | unlimited | free key | UK registry |

## 8. Vulnerability

| Source | Free tier | Key | Notes |
|---|---|---|---|
| NVD CVE API (NIST) | free, no key needed; key raises rate limit | optional | product+version → CVEs (e.g. "Cisco Catalyst 3750-E") |
| CIRCL CVE-Search | free | none | fast CVE/CPE lookup, self-hostable |
| EPSS | free | none | exploit-probability scoring |
| Vulners | limited | freemium | enriched vuln data |

## 9. MAC / hardware

| Source | Free tier | Key | Notes |
|---|---|---|---|
| macvendors.com | 1,000/day, 1 req/s | none | OUI → vendor, the free spine |
| IEEE OUI (local DB) | unlimited | none | bundle for offline lookups |
| maclookup.app | free tier | freemium | v2 API |

## 10. Threat intelligence / reputation

| Source | Free tier | Key | Notes |
|---|---|---|---|
| VirusTotal | 500 lookups/day | free acct | file/URL/IP/domain, 70+ engines |
| AlienVault OTX | no rate limit | free acct | community IOCs/pulses |
| urlscan.io | free tier | free acct | URL detonation/enrichment |
| abuse.ch (ThreatFox, URLhaus) | free | none/key | malware/IOC feeds |

## 11. Reverse image

No free official API. Google Lens / Google Images / Yandex are browser-only, so
Phase 11 drives them through browser automation. Freemium API options if wanted:
OpenWeb Ninja (free tier, Google Lens), Bright Data SERP (~5k/mo free). TinEye and
PimEyes are paid. Gravatar (email → avatar hash) is a free adjacent signal.

## 12. Aggregators / meta

| Source | Notes |
|---|---|
| SpiderFoot | free, self-run; orchestrates 200+ modules — good reference + optional embedded engine |
| recon-ng | free framework, modular recon |
| cipher387/API-s-for-OSINT | curated catalog of OSINT APIs to keep mining for more sources |

---

## Tools (WSL-launched)

Each ships in the Phase 7 catalog with description, install command, official
link, category, and tier. Installs assume a Kali or Ubuntu WSL distro.

| Tool | Tier | Install | Link |
|---|---|---|---|
| reconFTW | active | `git clone https://github.com/six2dez/reconftw && cd reconftw && ./install.sh` | github.com/six2dez/reconftw |
| Argus | passive | `pip install argus-recon` | github.com/jasonxtn/Argus |
| Maigret | passive | `pip install maigret` | github.com/soxoj/maigret |
| Blackbird | passive | `git clone https://github.com/p1ngul1n0/blackbird && cd blackbird && pip install -r requirements.txt` | github.com/p1ngul1n0/blackbird |
| Photon | passive | `sudo apt install photon` (or clone s0md3v/Photon) | kali.org/tools/photon |
| theHarvester | passive | `pipx install theHarvester` | github.com/laramies/theHarvester |
| Sherlock | passive | `pipx install sherlock-project` | github.com/sherlock-project/sherlock |
| PhoneInfoga | passive | `docker run ... sundowndev/phoneinfoga` | github.com/sundowndev/phoneinfoga |
| SpiderFoot | passive/active | `pip install spiderfoot` | github.com/smicallef/spiderfoot |
| nmap | active | `sudo apt install nmap` | nmap.org |
| tshark | passive | `sudo apt install tshark` | wireshark.org |

Active tools (reconFTW, nmap, active SpiderFoot modules) require an authorization
record for the target before launch.
