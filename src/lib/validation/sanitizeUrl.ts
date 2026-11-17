/**
 * URL sanitization for the opt-in affected-page URL.
 *
 * Privacy rules (applied on input, so raw values are never stored):
 * - userinfo credentials (user:pass@) are removed entirely.
 * - the fragment is removed by default.
 * - query parameter values whose names look sensitive are replaced with
 *   [REDACTED]; benign parameters are preserved.
 * - The exact final value is returned so the review screen can display it.
 */

const SENSITIVE_QUERY_KEYS = new Set([
  "token",
  "access_token",
  "id_token",
  "refresh_token",
  "auth",
  "authorization",
  "api_key",
  "apikey",
  "api-key",
  "key",
  "secret",
  "client_secret",
  "password",
  "passwd",
  "pwd",
  "session",
  "sessionid",
  "session_id",
  "sid",
  "jwt",
  "sig",
  "signature",
  "code",
  "private_key",
  "privatekey",
  "credentials",
]);

export interface SanitizedUrlResult {
  sanitized: string;
  removedCredentials: boolean;
  removedFragment: boolean;
  redactedParamNames: string[];
  keptParamNames: string[];
}

export function isSensitiveQueryKey(name: string): boolean {
  return SENSITIVE_QUERY_KEYS.has(name.toLowerCase().trim());
}

export function sanitizeUrl(rawUrl: string): SanitizedUrlResult | null {
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return null;
  }

  const removedCredentials = parsed.username !== "" || parsed.password !== "";
  parsed.username = "";
  parsed.password = "";

  const removedFragment = parsed.hash !== "";
  parsed.hash = "";

  const redactedParamNames: string[] = [];
  const keptParamNames: string[] = [];
  const params = new URLSearchParams(parsed.search);
  for (const [name] of params) {
    if (isSensitiveQueryKey(name)) {
      params.set(name, "[REDACTED]");
      redactedParamNames.push(name);
    } else {
      keptParamNames.push(name);
    }
  }
  const search = params.toString();
  parsed.search = search ? `?${search}` : "";

  return {
    sanitized: parsed.toString(),
    removedCredentials,
    removedFragment,
    redactedParamNames,
    keptParamNames,
  };
}
