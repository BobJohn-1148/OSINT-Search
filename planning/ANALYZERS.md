# Analyzers — full catalog (expands Phase 9)

Each analyzer: input -> parsed findings -> save to case/report. Free/local; a WSL
tool or local parse; passive unless noted; obeys STABILITY.md.

## Network / web
- Email header analyzer — raw headers -> hops, SPF/DKIM/DMARC, spoofing, origin IP
- TLS/SSL analyzer — host -> cert chain, SANs, weak ciphers, expiry (testssl/sslyze)
- Web tech fingerprint — URL -> stack (whatweb / Wappalyzer)
- Shodan host analyzer — IP -> exposed services, ports, known vulns (Shodan key)
- GeoIP + ASN analyzer — IP -> geo, org, ASN, map

## File / malware triage
- Hash analyzer — hash -> type + reputation (VirusTotal, MalwareBazaar)
- File / PE-ELF analyzer — strings, imports, entropy, packer, YARA scan
- Document analyzer — Office macros + embedded objects + PDF metadata (oletools, pdfid)
- EXIF / metadata analyzer — image/doc metadata incl. GPS (exiftool)
- Steganography detector — hidden-data indicators in images

## DFIR / Windows
- Event log analyzer (.evtx via wevtutil) [Phase 9]
- PCAP analyzer (tshark, file import only) [Phase 9]
- Registry analyzer — hive -> autoruns, USB history, user activity (RegRipper)
- Windows execution artifacts — Prefetch/Amcache/ShimCache/LNK/JumpLists (EZ Tools)
- MFT + USN journal timeline — filesystem activity timeline
- Memory analyzer — RAM dump -> processes, netconns, injected code (Volatility 3)
- Browser artifact analyzer — history, cookies, downloads, logins
- Super-timeline — merge artifacts into one chronological view

## Generators
- Password & wordlist generator — secure passwords/passphrases; wordlists with
  mutations (leetspeak, case, suffixes); password strength + crack-time estimate
- Payload generator — reverse-shell one-liners + msfvenom builder (see
  PAYLOAD_PLAYGROUND.md; authorized/gated)

Dork generator, MAC lookup, and vulnerability lookup are already in Phase 9. Every
analyzer saves findings to a case/report.
