/**
 * Personas are one table because an agent's identity has to read the same in the
 * 3D den, the roster card, and the workbench header. If the scene picked outfits
 * while the list invented its own labels, the same agent would look like two
 * different characters depending on whether the GPU came up.
 *
 * Outfit colors are palette *keys*, never literals, so the character models stay
 * inside the theme-token audit that covers the rest of the renderer.
 */
import type { AgentStatusLine } from "./agent-status";
import type { HqPaletteKey } from "./theme-palette";

export type HatShape = "top-hat" | "hard-hat" | "headset" | "hood" | "visor";

export type AccessoryShape = "monocle" | "clipboard" | "antenna" | "lockpick" | "none";

export interface AgentOutfit {
  readonly body: HqPaletteKey;
  readonly head: HqPaletteKey;
  readonly hat: HqPaletteKey;
  readonly hatShape: HatShape;
  readonly accessory: AccessoryShape;
}

export interface AgentPersona {
  readonly callsign: string;
  readonly role: string;
  readonly tagline: string;
  readonly accent: HqPaletteKey;
  readonly outfit: AgentOutfit;
  readonly quirks: readonly AgentStatusLine[];
}

/**
 * Keyed by substring rather than exact id so a renamed or user-added agent
 * ("osint-agent-2", "recon-scout") still inherits the right character instead of
 * silently dropping to the default operative.
 */
const personaTable: readonly (readonly [string, AgentPersona])[] = [
  [
    "architect",
    {
      callsign: "The Foreman",
      role: "Reads the repo, proposes the plan",
      tagline: "Measure twice. Ship once. Blame the spec.",
      accent: "warning",
      outfit: { body: "warning", head: "text", hat: "border", hatShape: "hard-hat", accessory: "clipboard" },
      quirks: [
        { text: "arguing with the linter", nsfw: false },
        { text: "drawing boxes and arrows", nsfw: false },
        { text: "estimating in dog years", nsfw: false },
        { text: "rejecting its own pull request", nsfw: false },
        { text: "muttering about tech debt", nsfw: false }
      ]
    }
  ],
  [
    "scout",
    {
      callsign: "Scout",
      role: "Perimeter and infrastructure recon",
      tagline: "First one over the wall, every time.",
      accent: "positive",
      outfit: { body: "positive", head: "text", hat: "app", hatShape: "headset", accessory: "antenna" },
      quirks: [
        { text: "counting open ports like sheep", nsfw: false },
        { text: "pinging things that asked not to be pinged", nsfw: false },
        { text: "mapping the coffee machine subnet", nsfw: false },
        { text: "traceroute to nowhere", nsfw: false }
      ]
    }
  ],
  [
    "ripper",
    {
      callsign: "Ripper",
      role: "Credential and hash work",
      tagline: "Every password is temporary.",
      accent: "warning",
      outfit: { body: "app", head: "text", hat: "raised", hatShape: "hood", accessory: "lockpick" },
      quirks: [
        { text: "chewing through a wordlist", nsfw: false },
        { text: "salting something for fun", nsfw: false },
        { text: "judging your password policy", nsfw: false },
        { text: "rainbow tables, old school", nsfw: false }
      ]
    }
  ],
  [
    "malware",
    {
      callsign: "The Coroner",
      role: "Static malware triage — look, never run",
      tagline: "I read the body. I never wake it up.",
      accent: "warning",
      outfit: { body: "app", head: "text", hat: "surface", hatShape: "visor", accessory: "monocle" },
      quirks: [
        { text: "reading a binary like an autopsy", nsfw: false },
        { text: "measuring entropy of everything", nsfw: false },
        { text: "un-packing something suspicious", nsfw: false },
        { text: "quarantining, never detonating", nsfw: false },
        { text: "arguing that the timestamp is faked", nsfw: false }
      ]
    }
  ],
  [
    "analyst",
    {
      callsign: "The Analyst",
      role: "Log, packet, and artifact analysis",
      tagline: "The answer is in the timestamps.",
      accent: "reference",
      outfit: { body: "reference", head: "text", hat: "surface", hatShape: "visor", accessory: "monocle" },
      quirks: [
        { text: "staring at a pcap until it confesses", nsfw: false },
        { text: "correlating timestamps by hand", nsfw: false },
        { text: "colour-coding a spreadsheet", nsfw: false },
        { text: "found an anomaly, it was the clock", nsfw: false }
      ]
    }
  ],
  [
    "osint",
    {
      callsign: "The Gentleman",
      role: "Passive collection and correlation",
      tagline: "Never states a thing he cannot cite.",
      accent: "accent",
      outfit: { body: "raised", head: "text", hat: "app", hatShape: "top-hat", accessory: "monocle" },
      quirks: [
        { text: "reading the footnotes", nsfw: false },
        { text: "cross-referencing out of spite", nsfw: false },
        { text: "polishing the top hat", nsfw: false },
        { text: "declining to speculate", nsfw: false },
        { text: "asked WHOIS, got attitude", nsfw: false }
      ]
    }
  ]
];

const defaultPersona: AgentPersona = {
  callsign: "Operative",
  role: "General investigation",
  tagline: "Point it at something.",
  accent: "accent",
  outfit: { body: "raised", head: "text", hat: "app", hatShape: "hood", accessory: "none" },
  quirks: [
    { text: "awaiting orders", nsfw: false },
    { text: "reading the room", nsfw: false }
  ]
};

export function resolveAgentPersona(agentId: string): AgentPersona {
  const normalized = agentId.toLowerCase();
  const match = personaTable.find(([key]) => normalized.includes(key));
  return match ? match[1] : defaultPersona;
}
