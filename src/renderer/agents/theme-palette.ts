/**
 * Canvas materials read CSS variables at runtime so the 3D office follows the
 * app theme without raw renderer colors. If Three materials used literals, the
 * color-token audit would stop covering the most visible surface.
 */
export interface HqPalette {
  readonly app: string;
  readonly surface: string;
  readonly raised: string;
  readonly text: string;
  readonly muted: string;
  readonly accent: string;
  readonly accentStrong: string;
  readonly border: string;
  readonly positive: string;
  readonly warning: string;
  readonly reference: string;
}

export type HqPaletteKey = keyof HqPalette;

export function readHqPalette(): HqPalette {
  const style = getComputedStyle(document.documentElement);
  const token = (name: string) => style.getPropertyValue(name).trim();
  return {
    app: token("--color-app"),
    surface: token("--color-surface"),
    raised: token("--color-surface-raised"),
    text: token("--color-text"),
    muted: token("--color-text-muted"),
    accent: token("--color-accent"),
    accentStrong: token("--color-accent-strong"),
    border: token("--color-border"),
    positive: token("--color-positive"),
    warning: token("--color-warning"),
    reference: token("--color-reference-strong")
  };
}
