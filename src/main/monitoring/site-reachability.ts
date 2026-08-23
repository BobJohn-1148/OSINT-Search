/**
 * Reachability is checked live, not scheduled or persisted, because the
 * watchlist card only needs "is this up right now" for a status light and a
 * "view in browser" link -- historical uptime tracking, alerting, and DNS/TLS
 * detail are a different feature with their own storage shape. A HEAD request
 * with a short timeout answers the question the UI actually asks; any
 * response at all (even an error status) proves the site is reachable, since
 * only a network-level failure -- DNS, refused connection, timeout -- means
 * the light should read red.
 */
const DEFAULT_TIMEOUT_MS = 4000;

export async function checkSiteReachable(domain: string, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<boolean> {
  const url = /^https?:\/\//i.test(domain) ? domain : `https://${domain}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    await fetch(url, { method: "HEAD", redirect: "follow", signal: controller.signal });
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}
