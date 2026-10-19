// The app listens on 127.0.0.1 only, but that does not stop a web page on another site from
// reaching it. A page can point its own name at 127.0.0.1 (DNS rebinding), and the browser then
// sends requests here with that name in the Host header. So the Host header is checked, and only
// the names this computer uses for itself are answered.

const ALLOWED_HOSTNAMES: ReadonlySet<string> = new Set(["127.0.0.1", "localhost"]);

// A hostname made of letters, digits, dots and dashes, then an optional port. Anything else, such
// as a user name before an @, a space, or an IPv6 address in brackets, does not match.
const HOST_PATTERN = /^([a-z0-9.-]+)(?::\d{1,5})?$/;

/** Whether a Host header names this computer, on any port. A missing or odd header does not. */
export function isAllowedHost(host: string | null | undefined): boolean {
  if (!host) return false;
  const match = HOST_PATTERN.exec(host.toLowerCase());
  return match !== null && ALLOWED_HOSTNAMES.has(match[1]);
}
