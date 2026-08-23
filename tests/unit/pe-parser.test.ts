/**
 * The PE parser is the load-bearing part of static triage, so it is pinned
 * against a hand-built binary with a known import table rather than a fixture
 * blob nobody can read. The malformed cases matter as much as the happy path:
 * a hostile or truncated sample must degrade to null or a partial report, never
 * throw and take the analyzer down with it.
 */
import { looksLikePe, parsePe, shannonEntropy } from "../../src/main/analyzers/pe-parser";

/**
 * Build a minimal but real PE32 with one section and one import
 * (kernel32.dll!VirtualAlloc). Section virtualAddress equals rawPointer so
 * RVA==file offset inside the section, which keeps the import-table offsets in
 * this fixture legible.
 */
function buildMinimalPe(): Buffer {
  const buffer = Buffer.alloc(0x2000);
  buffer.writeUInt16LE(0x5a4d, 0); // "MZ"
  buffer.writeUInt32LE(0x80, 0x3c); // e_lfanew -> PE header

  buffer.writeUInt32LE(0x00004550, 0x80); // "PE\0\0"
  // COFF header at 0x84
  buffer.writeUInt16LE(0x014c, 0x84); // machine x86
  buffer.writeUInt16LE(1, 0x86); // one section
  buffer.writeUInt32LE(1_610_000_000, 0x88); // timestamp (2021)
  buffer.writeUInt16LE(0xe0, 0x94); // sizeof optional header
  buffer.writeUInt16LE(0x0102, 0x96); // EXECUTABLE_IMAGE | 32BIT_MACHINE

  // Optional header at 0x98
  const opt = 0x98;
  buffer.writeUInt16LE(0x010b, opt); // PE32 magic
  buffer.writeUInt16LE(3, opt + 0x44); // subsystem = Windows console
  buffer.writeUInt32LE(0x1000, opt + 0x60 + 8); // data directory[1] (import) RVA
  buffer.writeUInt32LE(40, opt + 0x60 + 12); // import directory size

  // Section table at opt + 0xe0 = 0x178
  const sect = opt + 0xe0;
  buffer.write(".text", sect, "latin1");
  buffer.writeUInt32LE(0x1000, sect + 8); // virtualSize
  buffer.writeUInt32LE(0x1000, sect + 12); // virtualAddress
  buffer.writeUInt32LE(0x1000, sect + 16); // rawSize
  buffer.writeUInt32LE(0x1000, sect + 20); // rawPointer

  // Import descriptor at file/RVA 0x1000
  buffer.writeUInt32LE(0x1020, 0x1000); // OriginalFirstThunk -> ILT
  buffer.writeUInt32LE(0x1040, 0x1000 + 12); // Name RVA
  buffer.writeUInt32LE(0x1060, 0x1000 + 16); // FirstThunk
  // Second (null) descriptor at 0x1014 stays zeroed -> terminates the array.

  // Import lookup table at 0x1020: one entry -> hint/name at 0x1050, then null.
  buffer.writeUInt32LE(0x1050, 0x1020);

  buffer.write("kernel32.dll", 0x1040, "latin1"); // DLL name
  buffer.writeUInt16LE(0, 0x1050); // hint
  buffer.write("VirtualAlloc", 0x1052, "latin1"); // imported function

  return buffer;
}

it("recognizes the MZ signature so non-PE input is never walked as a header", () => {
  expect(looksLikePe(buildMinimalPe())).toBe(true);
  expect(looksLikePe(Buffer.from("not an executable"))).toBe(false);
  expect(looksLikePe(Buffer.alloc(0))).toBe(false);
});

it("parses architecture, subsystem, and DLL flag from the COFF header", () => {
  const pe = parsePe(buildMinimalPe());
  expect(pe).not.toBeNull();
  expect(pe?.machine).toBe("x86 (i386)");
  expect(pe?.subsystem).toBe("Windows console");
  expect(pe?.isDll).toBe(false);
  expect(pe?.hasAuthenticode).toBe(false);
  expect(pe?.compileTimestampTs).toBe(new Date(1_610_000_000 * 1000).toISOString());
});

it("resolves the import table and flags capability APIs so behavior is evidenced, not guessed", () => {
  const pe = parsePe(buildMinimalPe());
  const kernel = pe?.imports.find((entry) => entry.dll === "kernel32.dll");
  expect(kernel?.functions).toContain("VirtualAlloc");
  expect(pe?.suspiciousImports).toContain("VirtualAlloc");
});

it("reports the section with its entropy so a packed section can be spotted", () => {
  const pe = parsePe(buildMinimalPe());
  const section = pe?.sections[0];
  expect(section?.name).toBe(".text");
  // The fixture section is mostly zero bytes, so it must read as low-entropy and
  // therefore not be flagged as packed.
  expect(section?.entropy).toBeLessThan(2);
  expect(section?.suspicious).toBe(false);
});

it("returns null for a truncated or non-PE buffer instead of throwing", () => {
  expect(parsePe(Buffer.from("MZ"))).toBeNull(); // Has the signature, nothing else.
  expect(parsePe(Buffer.from("plain text file contents"))).toBeNull();
  const lyingHeader = Buffer.alloc(0x80);
  lyingHeader.writeUInt16LE(0x5a4d, 0);
  lyingHeader.writeUInt32LE(0x400, 0x3c); // e_lfanew points past the buffer
  expect(parsePe(lyingHeader)).toBeNull();
});

it("computes Shannon entropy so a uniform buffer scores high and a constant buffer scores zero", () => {
  expect(shannonEntropy(Buffer.alloc(256))).toBe(0); // All one byte value.
  const uniform = Buffer.alloc(256);
  for (let index = 0; index < 256; index += 1) {
    uniform[index] = index; // Every byte value once -> maximal 8 bits/byte.
  }
  expect(shannonEntropy(uniform)).toBeCloseTo(8, 5);
  expect(shannonEntropy(Buffer.alloc(0))).toBe(0);
});
