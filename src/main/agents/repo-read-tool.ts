/**
 * Repo reads are scoped through one helper because the architect agent needs
 * codebase context without becoming a general filesystem browser. If prompts
 * could pass arbitrary absolute paths, an in-app question could leak local files
 * outside Reacher.
 */
import fs from "node:fs";
import path from "node:path";
import type { RepoCitation } from "../../shared/schemas/architect-agent.js";

const defaultFiles = ["CLAUDE.md", "planning/REACHER_PLAN.md", "planning/codex-instructions/phase-06-architect-agent.md"];

export class RepoReadTool {
  private readonly canonicalRepoRoot: string;

  public constructor(private readonly repoRoot: string) {
    this.canonicalRepoRoot = fs.realpathSync.native(repoRoot);
    const claudePath = path.join(this.canonicalRepoRoot, "CLAUDE.md");
    if (!fs.existsSync(claudePath)) {
      throw new Error("Architect repo root must contain CLAUDE.md");
    }
  }

  public readContext(files: readonly string[]): RepoCitation[] {
    const unique = [...new Set([...defaultFiles, ...files])];
    return unique.map((file) => this.readCitation(file));
  }

  public readText(file: string): string {
    const normalized = this.assertExistingFile(file);
    return fs.readFileSync(path.join(this.repoRoot, normalized), "utf8");
  }

  public assertExistingFile(file: string): string {
    const fullPath = this.resolveScoped(file);
    if (!fs.statSync(fullPath).isFile()) {
      throw new Error(`${file} is not a file in the Reacher repo`);
    }
    return path.relative(this.repoRoot, fullPath).replace(/\\/g, "/");
  }

  private readCitation(file: string): RepoCitation {
    const normalized = this.assertExistingFile(file);
    const text = this.readText(normalized);
    return {
      file: normalized,
      excerpt: text.split(/\r?\n/).filter((line) => line.trim().length > 0).slice(0, 3).join(" ").slice(0, 240)
    };
  }

  private resolveScoped(file: string): string {
    const fullPath = path.resolve(this.repoRoot, file);
    const relative = path.relative(this.repoRoot, fullPath);
    if (relative.startsWith("..") || path.isAbsolute(relative)) {
      throw new Error(`${file} is outside the Reacher repo`);
    }
    const canonicalPath = fs.realpathSync.native(fullPath);
    const canonicalRelative = path.relative(this.canonicalRepoRoot, canonicalPath);
    if (canonicalRelative.startsWith("..") || path.isAbsolute(canonicalRelative)) {
      throw new Error(`${file} resolves outside the Reacher repo`);
    }
    return fullPath;
  }
}
