/**
 * Architect apply writes are isolated so approval produces a concrete, audited
 * repo change without letting model output edit arbitrary files. If the service
 * wrote ad hoc paths, a confirmed plan could escape the project or hide changed
 * files from audit review.
 */
import fs from "node:fs";
import path from "node:path";
import type { ArchitectProposal } from "../../shared/schemas/architect-agent.js";

export interface ArchitectApplyExecutor {
  plan(proposal: ArchitectProposal): readonly string[];
  apply(proposal: ArchitectProposal): readonly string[];
}

export class PlanArtifactApplyExecutor implements ArchitectApplyExecutor {
  private readonly canonicalRepoRoot: string;

  public constructor(private readonly repoRoot: string) {
    this.canonicalRepoRoot = fs.realpathSync.native(repoRoot);
  }

  public plan(proposal: ArchitectProposal): readonly string[] {
    return [this.relativeArtifactPath(proposal).replace(/\\/g, "/")];
  }

  public apply(proposal: ArchitectProposal): readonly string[] {
    const relativePath = this.relativeArtifactPath(proposal);
    const fullPath = this.resolveWritePath(relativePath);
    const parent = path.dirname(fullPath);
    this.assertNearestExistingAncestorInside(parent, relativePath);
    fs.mkdirSync(parent, { recursive: true });
    this.assertCanonicalParentInside(parent, relativePath);
    fs.writeFileSync(fullPath, renderProposal(proposal), { encoding: "utf8", flag: "wx" });
    return [relativePath.replace(/\\/g, "/")];
  }

  private relativeArtifactPath(proposal: ArchitectProposal): string {
    return path.join("planning", "architect-applied", `${proposal.id}.md`);
  }

  private resolveWritePath(relativePath: string): string {
    const fullPath = path.resolve(this.repoRoot, relativePath);
    const relative = path.relative(this.canonicalRepoRoot, path.dirname(fullPath));
    if (relative.startsWith("..") || path.isAbsolute(relative)) {
      throw new Error(`${relativePath} resolves outside the Reacher repo`);
    }
    return fullPath;
  }

  private assertCanonicalParentInside(parent: string, relativePath: string): void {
    const canonicalParent = fs.realpathSync.native(parent);
    const canonicalRelative = path.relative(this.canonicalRepoRoot, canonicalParent);
    if (canonicalRelative.startsWith("..") || path.isAbsolute(canonicalRelative)) {
      throw new Error(`${relativePath} resolves outside the Reacher repo`);
    }
  }

  private assertNearestExistingAncestorInside(parent: string, relativePath: string): void {
    let candidate = parent;
    while (!fs.existsSync(candidate)) {
      const next = path.dirname(candidate);
      if (next === candidate) {
        throw new Error(`${relativePath} has no existing repo ancestor`);
      }
      candidate = next;
    }
    const canonicalAncestor = fs.realpathSync.native(candidate);
    const canonicalRelative = path.relative(this.canonicalRepoRoot, canonicalAncestor);
    if (canonicalRelative.startsWith("..") || path.isAbsolute(canonicalRelative)) {
      throw new Error(`${relativePath} resolves outside the Reacher repo`);
    }
  }
}

function renderProposal(proposal: ArchitectProposal): string {
  const steps = proposal.steps.map((step, index) => `${index + 1}. ${step.title}\n   Files: ${step.files.join(", ")}\n   Reason: ${step.reason}`).join("\n");
  return [
    `# ${proposal.summary}`,
    "",
    `Request: ${proposal.request}`,
    `Provider: ${proposal.provider}`,
    `Model: ${proposal.model}`,
    "",
    "## Cited files",
    ...proposal.citations.map((citation) => `- ${citation.file}`),
    "",
    "## Plan",
    steps,
    ""
  ].join("\n");
}
