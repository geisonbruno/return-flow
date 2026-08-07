/**
 * Guards against an open redirect: the only acceptable "remembered
 * destination" is an internal application path. `location.state.from` is
 * attacker-influenceable in principle (a crafted link can set history
 * state before the app reads it), so it must never be trusted as an
 * absolute or protocol-relative URL.
 */
export function sanitizeRedirectTarget(target: unknown, fallback = '/dashboard'): string {
  if (typeof target !== 'string' || target.length === 0) {
    return fallback;
  }
  if (!target.startsWith('/')) {
    return fallback;
  }
  // "//evil.example.com" is parsed by browsers as protocol-relative — same
  // host-escape risk as a full "https://evil.example.com" target.
  if (target.startsWith('//')) {
    return fallback;
  }
  if (target.includes('\\')) {
    return fallback;
  }
  return target;
}
