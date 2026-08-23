/**
 * Provider marks give each agent a recognizable AI-vendor identity on its card
 * without shipping trademarked artwork: they are simple geometric glyphs tinted
 * by a theme token (via currentColor on a `.provider-<id>` class), so they pass
 * the no-raw-color renderer audit and follow the app theme.
 */
import type { ReactElement } from "react";

export function ProviderLogo({ provider, size = 20 }: { readonly provider: string; readonly size?: number }) {
  return (
    <span className={`provider-logo provider-${provider}`} aria-hidden="true">
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        {glyph(provider)}
      </svg>
    </span>
  );
}

function glyph(provider: string): ReactElement {
  switch (provider) {
    case "anthropic":
      // Radiating spark.
      return (
        <g stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M12 3v18M3 12h18M5.6 5.6l12.8 12.8M18.4 5.6L5.6 18.4" />
        </g>
      );
    case "openai":
      // Six-petal rosette approximation.
      return (
        <g stroke="currentColor" strokeWidth="1.6" fill="none">
          <circle cx="12" cy="12" r="4" />
          <circle cx="12" cy="5.5" r="2.4" />
          <circle cx="12" cy="18.5" r="2.4" />
          <circle cx="6.2" cy="8.6" r="2.4" />
          <circle cx="17.8" cy="8.6" r="2.4" />
          <circle cx="6.2" cy="15.4" r="2.4" />
          <circle cx="17.8" cy="15.4" r="2.4" />
        </g>
      );
    case "xai":
      // Bold X.
      return (
        <g stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
          <path d="M6 6l12 12M18 6L6 18" />
        </g>
      );
    case "ollama":
      // Friendly rounded mascot with ears.
      return (
        <g fill="currentColor">
          <rect x="7" y="9" width="10" height="11" rx="4" />
          <rect x="6.5" y="3.5" width="3" height="6" rx="1.5" />
          <rect x="14.5" y="3.5" width="3" height="6" rx="1.5" />
          <circle cx="10" cy="13" r="1.1" fill="var(--color-app)" />
          <circle cx="14" cy="13" r="1.1" fill="var(--color-app)" />
        </g>
      );
    default:
      // lm-studio and any future local runtime: stacked studio bars.
      return (
        <g fill="currentColor">
          <rect x="4" y="14" width="4" height="6" rx="1" />
          <rect x="10" y="9" width="4" height="11" rx="1" />
          <rect x="16" y="5" width="4" height="15" rx="1" />
        </g>
      );
  }
}
