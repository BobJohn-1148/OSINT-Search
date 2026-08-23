/**
 * Nmap parser tests pin XML mapping because scan reports and topology both read
 * the parsed rows. If stdout parsing drifts, a scan can look successful while
 * hosts and services disappear from reports.
 */
import { parseNmapXml } from "../../src/main/scans/nmap-parser";

const nmapFixture = `<?xml version="1.0"?>
<nmaprun>
  <host>
    <status state="up"/>
    <address addr="192.168.1.10" addrtype="ipv4"/>
    <hostnames><hostname name="workstation.local" type="PTR"/></hostnames>
    <ports>
      <port protocol="tcp" portid="22"><state state="open"/><service name="ssh" product="OpenSSH" version="9.6"/></port>
      <port protocol="tcp" portid="80"><state state="closed"/><service name="http"/></port>
    </ports>
    <trace><hop ttl="1" ipaddr="192.168.1.1"/><hop ttl="2" ipaddr="192.168.1.10"/></trace>
  </host>
</nmaprun>`;

it("parses nmap XML into hosts and ports so scan output becomes structured evidence", () => {
  expect(parseNmapXml(nmapFixture)).toEqual([
    {
      address: "192.168.1.10",
      hostname: "workstation.local",
      status: "up",
      hopDistance: 2,
      ports: [
        { protocol: "tcp", port: 22, state: "open", service: "ssh", product: "OpenSSH", version: "9.6" },
        { protocol: "tcp", port: 80, state: "closed", service: "http", product: "", version: "" }
      ]
    }
  ]);
});
