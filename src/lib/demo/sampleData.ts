/**
 * Fully synthetic sample data for BugSnap's demo mode.
 *
 * Every value here is fictional: hosts use reserved `.test` domains, the
 * token is an obviously fake `demo_test_token_NOT_REAL_*` string, and the
 * person names are invented. No real credentials, customers or hostnames.
 */

import type { BugReport, EvidenceItem } from "@/types/report";
import type { Finding } from "@/types/redaction";
import type { HarSummary } from "@/types/diagnostics";
import { localId, nowIso } from "@/lib/utils";
import { createEmptyReport, renumberSteps } from "@/lib/report/reportFactory";
import {
  generateSampleScreenshot,
  SAMPLE_IMAGE_HEIGHT,
  SAMPLE_IMAGE_WIDTH,
} from "./syntheticScreenshot";

export const SAMPLE_TITLE = "Save button remains disabled after editing profile details";

export const SAMPLE_CONSOLE_LOG = `[09:41:02.113] [info] Booting Aurora Notes web client (build 2026.11.04-sample)
[09:41:02.318] [debug] Feature flags loaded: digest_v2=true, save_guard=false
[09:41:02.401] [info] Session established for riley@aurora-notes.test (fictional demo account)
[09:41:02.512] [warn] [DEPS] react-dom version mismatch: expected 19.1.0, got 19.1.1
[09:41:03.004] [log] GET https://api.aurora-notes.test/v2/profile -> 200 (184 ms)
[09:41:03.114] [debug] Authorization: Bearer demo_test_token_NOT_REAL_123456
[09:41:05.731] [info] Profile form mounted (dirty=false)
[09:41:12.940] [warn] [FORM] validation state stale: displayName changed but dirty flag not set
[09:41:12.942] [error] TypeError: Cannot read properties of undefined (reading 'isValid')
    at SaveButton (SettingsProfile.tsx:118:34)
    at renderWithHooks (react-dom-client.js:11404:18)
[09:41:13.102] [error] Save disabled: formState.isValid === undefined
[09:41:20.556] [log] GET https://api.aurora-notes.test/v2/profile/resolve?token=demo_test_token_NOT_REAL_123456 -> 200
[09:41:26.220] [info] api_key=ak_live_demoNOTAREALKEY000000 detected in config export
[09:41:31.018] [warn] [NET] retrying POST https://api.aurora-notes.test/v2/profile (attempt 2/3)
[09:41:36.480] [error] Save still disabled after retry — bug reproduced (sample)`;

export const SAMPLE_HAR_NAME = "aurora-notes-sample.har";

interface HarHeader {
  name: string;
  value: string;
}

interface HarEntry {
  startedDateTime: string;
  time: number;
  request: {
    method: string;
    url: string;
    httpVersion: string;
    headers: HarHeader[];
    queryString: Array<{ name: string; value: string }>;
    cookies: HarHeader[];
    headersSize: number;
    bodySize: number;
  };
  response: {
    status: number;
    statusText: string;
    httpVersion: string;
    headers: HarHeader[];
    cookies: HarHeader[];
    content: { size: number; mimeType: string; text?: string };
    headersSize: number;
    bodySize: number;
    redirectURL: string;
  };
  cache: Record<string, never>;
  timings: { send: number; wait: number; receive: number };
}

function entry(
  method: string,
  url: string,
  status: number,
  statusText: string,
  timeMs: number,
  responseSize: number,
  extraHeaders: HarHeader[] = [],
): HarEntry {
  return {
    startedDateTime: "2026-11-18T09:41:03.000Z",
    time: timeMs,
    request: {
      method,
      url,
      httpVersion: "http/2.0",
      headers: [
        { name: "Accept", value: "application/json" },
        { name: "Authorization", value: "Bearer demo_test_token_NOT_REAL_123456" },
        { name: "Cookie", value: "aurora_session=demo_session_value_NOT_REAL; theme=light" },
        ...extraHeaders,
      ],
      queryString: [],
      cookies: [{ name: "aurora_session", value: "demo_session_value_NOT_REAL" }],
      headersSize: -1,
      bodySize: 0,
    },
    response: {
      status,
      statusText,
      httpVersion: "http/2.0",
      headers: [{ name: "Content-Type", value: "application/json" }],
      cookies: [],
      content: {
        size: responseSize,
        mimeType: "application/json",
        text: '{"sample":true}',
      },
      headersSize: -1,
      bodySize: responseSize,
      redirectURL: "",
    },
    cache: {},
    timings: { send: 2, wait: Math.round(timeMs * 0.8), receive: Math.round(timeMs * 0.15) },
  };
}

function withQuery(entryObj: HarEntry, params: Array<{ name: string; value: string }>): HarEntry {
  return { ...entryObj, request: { ...entryObj.request, queryString: params } };
}

export function buildSampleHarJson(): string {
  const entries: HarEntry[] = [
    entry("GET", "https://api.aurora-notes.test/v2/profile", 200, "OK", 184, 1284),
    withQuery(
      entry("GET", "https://api.aurora-notes.test/v2/profile/resolve", 200, "OK", 96, 342),
      [{ name: "token", value: "demo_test_token_NOT_REAL_123456" }],
    ),
    entry(
      "POST",
      "https://api.aurora-notes.test/v2/profile",
      500,
      "Internal Server Error",
      912,
      214,
      [{ name: "X-Api-Key", value: "ak_live_demoNOTAREALKEY000000" }],
    ),
    entry("GET", "https://cdn.aurora-notes.test/assets/app-2026.11.js", 200, "OK", 61, 482113),
    entry("GET", "https://api.aurora-notes.test/v2/flags", 403, "Forbidden", 45, 89),
    entry("POST", "https://telemetry.aurora-notes.test/v1/batch", 200, "OK", 130, 32),
  ];

  return JSON.stringify(
    {
      log: {
        version: "1.2",
        creator: { name: "BugSnap synthetic fixture", version: "1.0" },
        pages: [],
        entries,
      },
    },
    null,
    2,
  );
}

/** Summary matching the synthetic HAR above (kept in sync for the sample). */
export function buildSampleHarSummary(): HarSummary {
  return {
    entryCount: 6,
    totalDurationMs: 1428,
    totalResponseBytes: 484074,
    hostnames: ["api.aurora-notes.test", "cdn.aurora-notes.test", "telemetry.aurora-notes.test"],
    methodCounts: { GET: 4, POST: 2 },
    statusCounts: { "200": 4, "403": 1, "500": 1 },
    failedCount: 0,
    clientErrorCount: 1,
    serverErrorCount: 1,
    entries: [
      { method: "GET", status: 200, host: "api.aurora-notes.test", path: "/v2/profile", responseSize: 1284, timeMs: 184, failed: false },
      { method: "GET", status: 200, host: "api.aurora-notes.test", path: "/v2/profile/resolve?token=…", responseSize: 342, timeMs: 96, failed: false },
      { method: "POST", status: 500, host: "api.aurora-notes.test", path: "/v2/profile", responseSize: 214, timeMs: 912, failed: true },
      { method: "GET", status: 200, host: "cdn.aurora-notes.test", path: "/assets/app-2026.11.js", responseSize: 482113, timeMs: 61, failed: false },
      { method: "GET", status: 403, host: "api.aurora-notes.test", path: "/v2/flags", responseSize: 89, timeMs: 45, failed: false },
      { method: "POST", status: 200, host: "telemetry.aurora-notes.test", path: "/v1/batch", responseSize: 32, timeMs: 130, failed: false },
    ],
    observations: [
      "One server error (500) on POST /v2/profile with a 912 ms duration — the longest request in this sample capture.",
      "One client error (403) on GET /v2/flags; the sample request lacked a valid demo credential.",
      "Response sizes are browser-reported approximations from the sample HAR.",
    ],
    parseWarnings: [],
  };
}

export function buildSampleConsoleFindings(): Finding[] {
  const mk = (
    line: number,
    column: number,
    length: number,
    matchText: string,
    category: Finding["category"],
    severity: Finding["severity"],
  ): Finding => ({
    id: localId("finding"),
    category,
    severity,
    confidence: "high",
    location: { line, column, length },
    maskedPreview: maskValue(matchText),
    replacement: "[REDACTED]",
    ruleSource: "builtin",
    status: "pending",
    matchText,
  });

  return [
    mk(3, 36, 26, "riley@aurora-notes.test", "email", "medium"),
    mk(6, 22, 31, "demo_test_token_NOT_REAL_123456", "bearer", "high"),
    mk(10, 74, 31, "demo_test_token_NOT_REAL_123456", "url-query-secret", "high"),
    mk(11, 17, 27, "ak_live_demoNOTAREALKEY000000", "api-key", "high"),
  ];
}

export function maskValue(value: string): string {
  if (value.length <= 8) return "•".repeat(value.length);
  const head = value.slice(0, 4);
  const tail = value.slice(-4);
  return `${head}${"•".repeat(Math.min(10, value.length - 8))}${tail}`;
}

export interface SampleDataResult {
  report: BugReport;
  imageBlob: Blob;
  evidenceId: string;
}

/**
 * Build the complete synthetic sample report. The screenshot is generated
 * on a canvas, so this must run in a browser context.
 */
export async function buildSampleReport(): Promise<SampleDataResult> {
  const { blob, width, height } = await generateSampleScreenshot();
  const createdAt = nowIso();
  const report = createEmptyReport();

  const evidenceId = localId("ev");
  const evidenceItem: EvidenceItem = {
    id: evidenceId,
    kind: "image",
    name: "aurora-settings-sample.png",
    mimeType: "image/png",
    sizeBytes: blob.size,
    width,
    height,
    createdAt,
    source: "sample",
    includedInExport: true,
    exportVariant: "annotated",
    annotations: [
      {
        id: localId("ann"),
        tool: "arrow",
        color: "#dc2626",
        strokeWidth: 4,
        x1: 1000,
        y1: 500,
        x2: 880,
        y2: 430,
      },
      {
        id: localId("ann"),
        tool: "rect",
        color: "#0d9488",
        strokeWidth: 3,
        x: 288,
        y: 580,
        w: 620,
        h: 80,
      },
      {
        id: localId("ann"),
        tool: "marker",
        color: "#dc2626",
        strokeWidth: 2,
        x: 640,
        y: 300,
        number: 1,
      },
    ],
  };

  report.title = SAMPLE_TITLE;
  report.evidence = [evidenceItem];
  report.description =
    "On the fictional Aurora Notes profile settings page, the Save button never becomes enabled after a valid edit to the display name. The change is lost on refresh. Reproduced consistently on the sample build; captured console output shows a stale form-validation flag. All data in this report is synthetic demo content.";
  report.type = "functional";
  report.severity = "high";
  report.priority = "high";
  report.status = "open";
  report.affectedArea = "Profile settings form";
  report.frequency = "always";
  report.isRegression = "no";
  report.labels = ["sample-data", "forms", "settings"];
  report.steps = renumberSteps([
    {
      id: localId("step"),
      order: 0,
      action: "Open the fictional profile settings page at aurora-notes.test/settings/profile.",
      observedResult: "Form loads with the current profile values.",
      isPrecondition: false,
      evidenceIds: [],
    },
    {
      id: localId("step"),
      order: 0,
      action: "Edit the Display name field to a new valid value (e.g. add a middle initial).",
      observedResult: "Field text updates; no validation errors appear.",
      isPrecondition: false,
      evidenceIds: [evidenceId],
    },
    {
      id: localId("step"),
      order: 0,
      action: "Observe the Save button state.",
      observedResult: "Save remains disabled although the form is valid.",
      isPrecondition: false,
      evidenceIds: [],
    },
    {
      id: localId("step"),
      order: 0,
      action: "Refresh the page.",
      observedResult: "The edited display name was not persisted.",
      isPrecondition: false,
      evidenceIds: [],
    },
  ]);
  report.expectedResult =
    "Save becomes enabled after a valid field change, and the updated display name persists after refresh.";
  report.actualResult =
    "Save remains disabled even after a valid field change; the edited value is lost on refresh. Console shows formState.isValid resolving to undefined.";
  report.workaround = "None found in the sample build.";
  report.environment = {
    capturedAt: createdAt,
    browserName: "Chromium (sample)",
    browserVersion: "143.0 (sample)",
    platform: "macOS (sample)",
    viewportWidth: 1440,
    viewportHeight: 900,
    devicePixelRatio: 2,
    language: "en-US (sample)",
    timezone: "Asia/Kolkata (sample)",
    online: true,
  };
  report.consoleLog = {
    id: localId("console"),
    name: "console-sample.log",
    rawText: SAMPLE_CONSOLE_LOG,
    byteSize: new TextEncoder().encode(SAMPLE_CONSOLE_LOG).length,
    importedAt: createdAt,
    truncated: false,
    findings: buildSampleConsoleFindings(),
    replacement: "[REDACTED]",
    includedInExport: true,
  };
  report.har = {
    id: localId("har"),
    name: SAMPLE_HAR_NAME,
    importedAt: createdAt,
    entryCount: 6,
    truncated: false,
    summary: buildSampleHarSummary(),
    sanitizedReady: false,
    sanitizedHarJson: null,
    redactionCounts: null,
    includedInExport: false,
  };

  return { report, imageBlob: blob, evidenceId };
}

export { SAMPLE_IMAGE_WIDTH, SAMPLE_IMAGE_HEIGHT };
