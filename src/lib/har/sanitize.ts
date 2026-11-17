import type { RedactionCounts } from "@/types/diagnostics";
import { isSensitiveQueryKey } from "@/lib/validation/sanitizeUrl";

/**
 * HAR sanitisation. Produces a structurally valid copy of the HAR with
 * sensitive values replaced — the original file stays in memory only.
 *
 * Strategy (fail closed):
 * - Authorization / Proxy-Authorization / Cookie / Set-Cookie headers and
 *   any API-key-like header: value replaced with "[REDACTED]".
 * - Cookie arrays: every value replaced, names kept.
 * - Sensitive query parameters: value replaced, name kept.
 * - Request and response bodies: replaced with an explicit placeholder —
 *   bodies may contain anything and are not scanned field by field.
 */

export const REDACTED = "[REDACTED]";
const BODY_PLACEHOLDER = "[OMITTED BY BUGSNAP SANITIZER — review before sharing]";

const REDACTED_HEADER_NAMES = new Set([
  "authorization",
  "proxy-authorization",
  "cookie",
  "set-cookie",
]);

const API_KEY_HEADER_PATTERN =
  /(?:api[-_]?key|x-api-key|x-auth|x-csrf-token|csrf|private-token|secret-token|client-secret)/i;

export interface HarSanitizeResult {
  ok: boolean;
  message?: string;
  sanitizedHarJson?: string;
  counts?: RedactionCounts;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sanitizeHeaders(headers: unknown, counts: RedactionCounts): unknown {
  if (!Array.isArray(headers)) return headers;
  return headers.map((header) => {
    if (!isRecord(header) || typeof header.name !== "string") return header;
    const name = header.name.toLowerCase();
    const sensitive =
      REDACTED_HEADER_NAMES.has(name) || API_KEY_HEADER_PATTERN.test(header.name);
    if (sensitive && typeof header.value === "string" && header.value !== REDACTED) {
      counts.headers += 1;
      return { ...header, value: REDACTED };
    }
    return header;
  });
}

function sanitizeCookieArray(cookies: unknown, counts: RedactionCounts): unknown {
  if (!Array.isArray(cookies)) return cookies;
  return cookies.map((cookie) => {
    if (!isRecord(cookie)) return cookie;
    if (typeof cookie.value === "string" && cookie.value !== REDACTED) {
      counts.cookies += 1;
      return { ...cookie, value: REDACTED };
    }
    return cookie;
  });
}

function sanitizeQueryString(query: unknown, counts: RedactionCounts): unknown {
  if (!Array.isArray(query)) return query;
  return query.map((param) => {
    if (!isRecord(param) || typeof param.name !== "string") return param;
    if (isSensitiveQueryKey(param.name) && typeof param.value === "string" && param.value !== REDACTED) {
      counts.queryParams += 1;
      return { ...param, value: REDACTED };
    }
    return param;
  });
}

function sanitizeBody(content: unknown, counts: RedactionCounts, isBody: boolean): unknown {
  if (!isRecord(content)) return content;
  if (typeof content.text === "string" && content.text.length > 0) {
    counts.bodies += 1;
    return { ...content, text: BODY_PLACEHOLDER };
  }
  if (isBody && content.bodySize !== undefined && content.bodySize !== -1 && content.bodySize !== 0) {
    counts.bodies += 1;
  }
  return content;
}

export function sanitizeHar(harJson: string): HarSanitizeResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(harJson);
  } catch {
    return { ok: false, message: "Cannot sanitise — the HAR content is not valid JSON." };
  }

  const log = isRecord(parsed) ? parsed.log : undefined;
  const entries = isRecord(log) ? log.entries : undefined;
  if (!Array.isArray(entries)) {
    return { ok: false, message: "No log.entries array found — not a HAR file." };
  }

  const counts: RedactionCounts = { headers: 0, cookies: 0, queryParams: 0, bodies: 0, total: 0 };

  const sanitizedEntries = entries.map((entry) => {
    if (!isRecord(entry)) return entry;
    const request = isRecord(entry.request) ? entry.request : undefined;
    const response = isRecord(entry.response) ? entry.response : undefined;
    const next: Record<string, unknown> = { ...entry };

    if (request) {
      const nextRequest: Record<string, unknown> = { ...request };
      nextRequest.headers = sanitizeHeaders(request.headers, counts);
      nextRequest.cookies = sanitizeCookieArray(request.cookies, counts);
      nextRequest.queryString = sanitizeQueryString(request.queryString, counts);
      nextRequest.postData = sanitizeBody(request.postData, counts, true);
      next.request = nextRequest;
    }
    if (response) {
      const nextResponse: Record<string, unknown> = { ...response };
      nextResponse.headers = sanitizeHeaders(response.headers, counts);
      nextResponse.cookies = sanitizeCookieArray(response.cookies, counts);
      nextResponse.content = sanitizeBody(response.content, counts, true);
      next.response = nextResponse;
    }
    return next;
  });

  counts.total = counts.headers + counts.cookies + counts.queryParams + counts.bodies;

  const sanitized = {
    ...(isRecord(parsed) ? parsed : {}),
    log: {
      ...(isRecord(log) ? log : {}),
      entries: sanitizedEntries,
    },
  };

  return { ok: true, sanitizedHarJson: JSON.stringify(sanitized, null, 2), counts };
}
