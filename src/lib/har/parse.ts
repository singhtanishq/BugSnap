import type { HarSummary, HarSummaryEntry } from "@/types/diagnostics";
import { LIMITS } from "@/lib/files/fileValidation";
import { isSensitiveQueryKey } from "@/lib/validation/sanitizeUrl";

/**
 * HAR parsing and summarising. Pure functions — the worker wraps these.
 *
 * The summary deliberately contains hostnames only, never full URLs, and
 * never header or body values. Raw HAR content is treated as sensitive.
 */

export interface HarParseResult {
  ok: boolean;
  message?: string;
  summary?: HarSummary;
  truncated: boolean;
}

interface RawHarEntry {
  startedDateTime?: string;
  time?: number;
  request?: { method?: string; url?: string };
  response?: {
    status?: number;
    statusText?: string;
    content?: { size?: number };
    bodySize?: number;
  };
  _error?: unknown;
  failed?: boolean;
}

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname || "unknown";
  } catch {
    return "unknown";
  }
}

function pathOf(url: string): string {
  try {
    const parsed = new URL(url);
    // Show the path, but redact values of sensitive query parameters so raw
    // tokens never appear in the summary UI.
    const params = new URLSearchParams(parsed.search);
    for (const [name] of params) {
      if (isSensitiveQueryKey(name)) params.set(name, "[REDACTED]");
    }
    const search = params.toString();
    return `${parsed.pathname}${search ? `?${search}` : ""}`;
  } catch {
    return url.slice(0, 60);
  }
}

export function parseHarSummary(harJson: string): HarParseResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(harJson);
  } catch {
    return { ok: false, message: "The file is not valid JSON — is it really a HAR export?", truncated: false };
  }

  const log = (parsed as { log?: { entries?: unknown } }).log;
  const entries = log?.entries;
  if (!Array.isArray(entries)) {
    return {
      ok: false,
      message: "No log.entries array found — this does not look like a HAR file.",
      truncated: false,
    };
  }

  const warnings: string[] = [];
  const rawEntries = entries as RawHarEntry[];
  let truncated = false;
  let usable = rawEntries;
  if (rawEntries.length > LIMITS.harMaxEntries) {
    usable = rawEntries.slice(0, LIMITS.harMaxEntries);
    truncated = true;
    warnings.push(
      `HAR contains ${rawEntries.length} entries; only the first ${LIMITS.harMaxEntries} were analysed.`,
    );
  }

  const summaryEntries: HarSummaryEntry[] = [];
  const methodCounts: Record<string, number> = {};
  const statusCounts: Record<string, number> = {};
  const hostnames = new Set<string>();
  let failedCount = 0;
  let clientErrorCount = 0;
  let serverErrorCount = 0;
  let totalDurationMs = 0;
  let totalResponseBytes = 0;
  let skipped = 0;

  for (const entry of usable) {
    const method = (entry.request?.method ?? "GET").toUpperCase();
    const url = entry.request?.url ?? "";
    const status = typeof entry.response?.status === "number" ? entry.response.status : 0;
    if (!url && status === 0) {
      skipped += 1;
      continue;
    }
    const host = hostnameOf(url);
    const failed = entry.failed === true || status === 0 || status >= 500;
    const time = typeof entry.time === "number" ? entry.time : 0;
    const size = typeof entry.response?.content?.size === "number" ? entry.response.content.size : 0;

    hostnames.add(host);
    methodCounts[method] = (methodCounts[method] ?? 0) + 1;
    const statusKey = status === 0 ? "0 (failed)" : String(status);
    statusCounts[statusKey] = (statusCounts[statusKey] ?? 0) + 1;
    if (status >= 400 && status < 500) clientErrorCount += 1;
    if (status >= 500) serverErrorCount += 1;
    if (failed) failedCount += 1;
    totalDurationMs += time;
    totalResponseBytes += size;

    summaryEntries.push({
      method,
      status,
      statusText: entry.response?.statusText,
      host,
      path: pathOf(url),
      responseSize: size,
      timeMs: Math.round(time),
      failed,
    });
  }

  if (skipped > 0) {
    warnings.push(`${skipped} malformed entries were skipped during summarising.`);
  }

  const observations: string[] = [];
  const longest = [...summaryEntries]
    .filter((e) => typeof e.timeMs === "number")
    .sort((a, b) => (b.timeMs ?? 0) - (a.timeMs ?? 0))[0];
  if (longest && (longest.timeMs ?? 0) > 0) {
    observations.push(
      `Slowest request in this capture: ${longest.method} ${longest.host}${longest.path} at ${longest.timeMs} ms (browser-reported timing).`,
    );
  }
  if (serverErrorCount > 0) {
    observations.push(
      `${serverErrorCount} request(s) returned a 5xx status — the server reported an error, not necessarily the bug's cause.`,
    );
  }
  if (clientErrorCount > 0) {
    observations.push(
      `${clientErrorCount} request(s) returned a 4xx status — often auth or permissions; check what your report expects.`,
    );
  }
  observations.push(
    "Timings and sizes are browser-reported approximations from the capture, not measurements by BugSnap.",
  );

  const summary: HarSummary = {
    entryCount: summaryEntries.length,
    totalDurationMs: Math.round(totalDurationMs),
    totalResponseBytes,
    hostnames: Array.from(hostnames).sort(),
    methodCounts,
    statusCounts,
    failedCount,
    clientErrorCount,
    serverErrorCount,
    entries: summaryEntries,
    observations,
    parseWarnings: warnings,
  };

  return { ok: true, summary, truncated };
}
