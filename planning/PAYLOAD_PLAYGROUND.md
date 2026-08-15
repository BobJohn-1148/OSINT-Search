# Payload playground — authorized offensive tooling

A surface of pentest helpers modeled on payloadplayground.com / revshells.com.
**Authorized testing and CTF use only.** Every generator that targets a system is
gated by Reacher's target-authorization record (invariant #7), clearly labeled,
and audited. These tools generate or transform standard, publicly-known payloads
and commands — they do not exploit anything themselves; the user runs output only
against systems they own or are authorized to test. Everything is local; nothing
leaves the machine except the OOB services the user explicitly picks.

## Tools
- Reverse shell generator — OS/shell/language + LHOST/LPORT -> standard reverse/
  bind one-liners (revshells-style) + the matching listener command. Templated.
- MSFVenom command builder — payload/platform/format/encoder/LHOST/LPORT -> the
  `msfvenom` command string to run locally.
- Shellcode encoder & formatter — paste raw shellcode (\x / hex / base64) ->
  XOR encode, null-byte elimination, bad-char avoidance; export to 11 language
  formats (C/C++, Python, PowerShell, C#, Ruby, Rust, Go, raw hex, base64, JS,
  NASM); entropy + byte-frequency + pattern analysis. Transforms user input only.
- Encoder / decoder + encoding pipeline — CyberChef-style chained ops
  (base64/hex/url/xor/gzip…), auto-detect magic mode. Shared with the analyzers'
  multi-decoder.
- Hash generator — MD5/SHA-1/256/384/512 + HMAC of text or files.
- Callback catcher helper — out-of-band (OOB) callback payloads for blind vuln
  testing via Burp Collaborator, interactsh, webhook.site, RequestBin, or a custom
  domain; ready-made for DNS/HTTP/XXE/SSRF/XSS/RCE/blind-SQLi; keeps a callback
  history. Authorized testing only.
- Pentest findings documenter — record findings as you go: severity, CVSS,
  affected URLs, HTTP request/response, steps to reproduce, impact, remediation.
  Export Markdown/JSON/CSV; saves to the case; feeds Reports. Local-only.
- Attack chain builder — compose and visualize multi-step chains (recon ->
  exploitation -> post-ex -> exfil), link steps to the generators/tools above, and
  export the documented path into a report.

## Gating
Generators aimed at a target require an authorization record for that target
before the payload is revealed/copied, and the action is audited. Findings
documenter, hash, encoder/decoder, and shellcode formatter (transforms pasted
input) are ungated (no target contact).
