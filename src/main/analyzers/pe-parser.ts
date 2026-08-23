/**
 * A minimal PE parser lives in-process because the whole malware feature's
 * promise is "inspect statically, never execute." Shelling out to an external
 * tool to read a header would reintroduce the exact process surface the triage
 * design is trying to avoid, so the header walk is done here over a Buffer with
 * bounds checks at every read. It parses enough to answer the triage questions —
 * architecture, timestamp, packing (section entropy), capability (imports),
 * signed-or-not — and deliberately stops short of anything that would need to
 * resolve or run code.
 *
 * Every offset read is guarded: a hostile or truncated file must yield a partial
 * report, never an out-of-bounds throw that takes down the analyzer.
 */
import type { PeImport, PeInfo, PeSection } from "../../shared/schemas/analyzers.js";

const DOS_SIGNATURE = 0x5a4d; // "MZ"
const PE_SIGNATURE = 0x00004550; // "PE\0\0"
const SUSPICIOUS_IMPORTS = new Set(
  [
    "VirtualAlloc",
    "VirtualAllocEx",
    "VirtualProtect",
    "WriteProcessMemory",
    "CreateRemoteThread",
    "CreateRemoteThreadEx",
    "NtUnmapViewOfSection",
    "SetWindowsHookExA",
    "SetWindowsHookExW",
    "WinExec",
    "ShellExecuteA",
    "ShellExecuteW",
    "ShellExecuteExW",
    "CreateProcessA",
    "CreateProcessW",
    "LoadLibraryA",
    "LoadLibraryW",
    "GetProcAddress",
    "InternetOpenA",
    "InternetOpenW",
    "InternetOpenUrlA",
    "InternetReadFile",
    "URLDownloadToFileA",
    "URLDownloadToFileW",
    "WSAStartup",
    "connect",
    "send",
    "recv",
    "RegSetValueExA",
    "RegSetValueExW",
    "RegCreateKeyExA",
    "CryptEncrypt",
    "CryptDecrypt",
    "IsDebuggerPresent",
    "CheckRemoteDebuggerPresent",
    "NtQueryInformationProcess",
    "AdjustTokenPrivileges"
  ].map((name) => name.toLowerCase())
);

const MACHINE_TYPES = new Map<number, string>([
  [0x014c, "x86 (i386)"],
  [0x8664, "x64 (AMD64)"],
  [0x01c0, "ARM"],
  [0xaa64, "ARM64"],
  [0x0200, "Itanium"]
]);

const SUBSYSTEMS = new Map<number, string>([
  [1, "native"],
  [2, "Windows GUI"],
  [3, "Windows console"],
  [5, "OS/2 console"],
  [7, "POSIX console"],
  [9, "Windows CE GUI"],
  [10, "EFI application"],
  [16, "boot application"]
]);

export function looksLikePe(buffer: Buffer): boolean {
  return buffer.length >= 2 && buffer.readUInt16LE(0) === DOS_SIGNATURE;
}

export function parsePe(buffer: Buffer): PeInfo | null {
  if (!looksLikePe(buffer) || buffer.length < 0x40) {
    return null;
  }
  const peHeaderOffset = buffer.readUInt32LE(0x3c);
  if (peHeaderOffset <= 0 || peHeaderOffset + 24 > buffer.length) {
    return null;
  }
  if (buffer.readUInt32LE(peHeaderOffset) !== PE_SIGNATURE) {
    return null;
  }

  const coffOffset = peHeaderOffset + 4;
  const machine = buffer.readUInt16LE(coffOffset);
  const sectionCount = buffer.readUInt16LE(coffOffset + 2);
  const timestamp = buffer.readUInt32LE(coffOffset + 4);
  const optionalHeaderSize = buffer.readUInt16LE(coffOffset + 16);
  const characteristics = buffer.readUInt16LE(coffOffset + 18);
  const isDll = (characteristics & 0x2000) !== 0;

  const optionalOffset = coffOffset + 20;
  const optional = readOptionalHeader(buffer, optionalOffset, optionalHeaderSize);

  const sectionTableOffset = optionalOffset + optionalHeaderSize;
  const parsedSections = readSections(buffer, sectionTableOffset, sectionCount);
  const imports = optional
    ? readImports(buffer, parsedSections, optional.importRva, optional.magic === 0x20b)
    : [];
  const suspiciousImports = collectSuspiciousImports(imports);

  return {
    machine: MACHINE_TYPES.get(machine) ?? `unknown (0x${machine.toString(16)})`,
    isDll,
    subsystem: optional ? SUBSYSTEMS.get(optional.subsystem) ?? `unknown (${optional.subsystem})` : "unknown",
    compileTimestampTs: timestampToIso(timestamp),
    hasAuthenticode: optional ? optional.certificateSize > 0 : false,
    sections: parsedSections.map((section) => section.display),
    imports,
    suspiciousImports
  };
}

interface OptionalHeaderSummary {
  readonly magic: number;
  readonly subsystem: number;
  readonly importRva: number;
  readonly certificateSize: number;
}

function readOptionalHeader(buffer: Buffer, offset: number, size: number): OptionalHeaderSummary | null {
  if (size < 2 || offset + 2 > buffer.length) {
    return null;
  }
  const magic = buffer.readUInt16LE(offset);
  const isPlus = magic === 0x20b;
  // Subsystem lands at 0x44 in both PE32 and PE32+: PE32+ grows ImageBase by 4
  // bytes but drops BaseOfData (also 4), so offsets from SectionAlignment on are
  // identical. The data-directory array does move — PE32+ widens the four
  // SizeOf{Stack,Heap} fields to 8 bytes each.
  const subsystemOffset = offset + 0x44;
  const directoryOffset = offset + (isPlus ? 0x70 : 0x60);
  if (directoryOffset + 8 * 8 > buffer.length || subsystemOffset + 2 > buffer.length) {
    return { magic, subsystem: 0, importRva: 0, certificateSize: 0 };
  }
  const subsystem = buffer.readUInt16LE(subsystemOffset);
  // Directory[1] = import table, directory[4] = certificate table.
  const importRva = buffer.readUInt32LE(directoryOffset + 1 * 8);
  const certificateSize = buffer.readUInt32LE(directoryOffset + 4 * 8 + 4);
  return { magic, subsystem, importRva, certificateSize };
}

/**
 * One section entry carries both what the report shows (`display`) and what
 * import resolution needs (the RVA and file pointer). Parsing the section table
 * exactly once and keeping both views on one object is what lets RVA→offset
 * translation work without re-reading the header.
 */
interface ParsedSection {
  readonly display: PeSection;
  readonly virtualAddress: number;
  readonly virtualSize: number;
  readonly rawPointer: number;
  readonly rawSize: number;
}

function readSections(buffer: Buffer, tableOffset: number, count: number): ParsedSection[] {
  const sections: ParsedSection[] = [];
  const safeCount = Math.min(count, 96); // PE spec caps sections at 96.
  for (let index = 0; index < safeCount; index += 1) {
    const entry = tableOffset + index * 40;
    if (entry + 40 > buffer.length) {
      break;
    }
    const name = buffer.subarray(entry, entry + 8).toString("latin1").replace(/\0+$/, "").trim() || `sect${index}`;
    const virtualSize = buffer.readUInt32LE(entry + 8);
    const virtualAddress = buffer.readUInt32LE(entry + 12);
    const rawSize = buffer.readUInt32LE(entry + 16);
    const rawPointer = buffer.readUInt32LE(entry + 20);
    const entropy = sectionEntropy(buffer, rawPointer, rawSize);
    sections.push({
      display: {
        name,
        virtualSize,
        rawSize,
        entropy: roundTo(entropy, 2),
        suspicious: entropy > 7.2 && rawSize > 0
      },
      virtualAddress,
      virtualSize,
      rawPointer,
      rawSize
    });
  }
  return sections;
}

function sectionEntropy(buffer: Buffer, pointer: number, size: number): number {
  if (size <= 0 || pointer <= 0 || pointer >= buffer.length) {
    return 0;
  }
  const end = Math.min(pointer + size, buffer.length);
  return shannonEntropy(buffer.subarray(pointer, end));
}

/**
 * Import parsing walks the import directory by translating each RVA back to a
 * file offset through the section table. It samples a bounded number of names
 * per DLL — capability detection needs presence, not an exhaustive dump, and an
 * unbounded walk over a crafted file is a denial-of-service vector.
 */
function readImports(buffer: Buffer, sections: readonly ParsedSection[], importRva: number, isPlus: boolean): PeImport[] {
  if (importRva <= 0) {
    return [];
  }
  const importOffset = rvaToOffset(sections, importRva);
  if (importOffset === null) {
    return [];
  }
  const imports: PeImport[] = [];
  const maxDescriptors = 128;
  for (let index = 0; index < maxDescriptors; index += 1) {
    const descriptor = importOffset + index * 20;
    if (descriptor + 20 > buffer.length) {
      break;
    }
    const originalFirstThunk = buffer.readUInt32LE(descriptor);
    const nameRva = buffer.readUInt32LE(descriptor + 12);
    const firstThunk = buffer.readUInt32LE(descriptor + 16);
    if (originalFirstThunk === 0 && nameRva === 0 && firstThunk === 0) {
      break; // Null descriptor terminates the array.
    }
    const dllName = readAsciiZ(buffer, rvaToOffset(sections, nameRva));
    if (!dllName) {
      continue;
    }
    const thunkRva = originalFirstThunk || firstThunk;
    const functions = readThunkNames(buffer, sections, thunkRva, isPlus);
    imports.push({ dll: dllName, functions });
  }
  return imports;
}

function readThunkNames(
  buffer: Buffer,
  sections: readonly ParsedSection[],
  thunkRva: number,
  isPlus: boolean
): string[] {
  const names: string[] = [];
  const entrySize = isPlus ? 8 : 4;
  const ordinalFlag = isPlus ? 0x8000000000000000n : 0x80000000n;
  const thunkOffset = rvaToOffset(sections, thunkRva);
  if (thunkOffset === null) {
    return names;
  }
  const maxFunctions = 256;
  for (let index = 0; index < maxFunctions; index += 1) {
    const cursor = thunkOffset + index * entrySize;
    if (cursor + entrySize > buffer.length) {
      break;
    }
    const value = isPlus ? buffer.readBigUInt64LE(cursor) : BigInt(buffer.readUInt32LE(cursor));
    if (value === 0n) {
      break;
    }
    if ((value & ordinalFlag) !== 0n) {
      names.push(`#${(value & 0xffffn).toString()}`); // Import by ordinal.
      continue;
    }
    // Otherwise the low 31 bits are an RVA to a hint/name entry; name follows a
    // 2-byte hint.
    const hintNameOffset = rvaToOffset(sections, Number(value & 0x7fffffffn));
    if (hintNameOffset === null) {
      continue;
    }
    const name = readAsciiZ(buffer, hintNameOffset + 2);
    if (name) {
      names.push(name);
    }
  }
  return names;
}

function rvaToOffset(sections: readonly ParsedSection[], rva: number): number | null {
  for (const section of sections) {
    const size = Math.max(section.virtualSize, section.rawSize);
    if (rva >= section.virtualAddress && rva < section.virtualAddress + size) {
      return section.rawPointer + (rva - section.virtualAddress);
    }
  }
  return null;
}

function readAsciiZ(buffer: Buffer, offset: number | null, max = 256): string {
  if (offset === null || offset < 0 || offset >= buffer.length) {
    return "";
  }
  const end = Math.min(offset + max, buffer.length);
  let text = "";
  for (let cursor = offset; cursor < end; cursor += 1) {
    const byte = buffer[cursor];
    if (byte === 0) {
      break;
    }
    if (byte < 0x20 || byte > 0x7e) {
      return text; // Stop at the first non-printable byte.
    }
    text += String.fromCharCode(byte);
  }
  return text;
}

function collectSuspiciousImports(imports: readonly PeImport[]): string[] {
  const hits = new Set<string>();
  for (const entry of imports) {
    for (const fn of entry.functions) {
      if (SUSPICIOUS_IMPORTS.has(fn.toLowerCase())) {
        hits.add(fn);
      }
    }
  }
  return [...hits].sort();
}

function timestampToIso(timestamp: number): string | null {
  if (timestamp <= 0 || timestamp >= 0xffffffff) {
    return null;
  }
  const date = new Date(timestamp * 1000);
  // PE timestamps are frequently zeroed or faked; reject anything outside a sane
  // window rather than surfacing a 1970 or year-2100 artifact as fact.
  const year = date.getUTCFullYear();
  if (year < 1990 || year > 2100) {
    return null;
  }
  return date.toISOString();
}

/** Shannon entropy in bits/byte (0..8). Exported so triage and tests share it. */
export function shannonEntropy(bytes: Buffer | Uint8Array): number {
  if (bytes.length === 0) {
    return 0;
  }
  const counts = new Array<number>(256).fill(0);
  for (const byte of bytes) {
    counts[byte] += 1;
  }
  let entropy = 0;
  for (const count of counts) {
    if (count === 0) {
      continue;
    }
    const probability = count / bytes.length;
    entropy -= probability * Math.log2(probability);
  }
  return entropy;
}

function roundTo(value: number, places: number): number {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}
