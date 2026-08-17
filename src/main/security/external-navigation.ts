/**
 * External navigation is centralized so generated OSINT links cannot navigate
 * the privileged Electron window. The renderer may display many URLs from
 * public data; only normal http/https links should leave the app via the OS
 * browser.
 */
export function isAppNavigationUrl(url: string, devServerUrl: string | undefined): boolean {
  if (url.startsWith("file://")) {
    return true;
  }
  return Boolean(devServerUrl && url.startsWith(devServerUrl));
}

export function normalizeExternalHttpUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}
