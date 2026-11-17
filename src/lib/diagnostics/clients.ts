import { scanLogText, type ScanOptions, type ScanResult } from "@/lib/redaction/patterns";
import { parseHarSummary, type HarParseResult } from "@/lib/har/parse";
import { sanitizeHar, type HarSanitizeResult } from "@/lib/har/sanitize";
import type { LogScanResponse } from "@/workers/log-scan.worker";
import type { HarParseResponse } from "@/workers/har-parse.worker";

/**
 * Worker clients with graceful fallback.
 *
 * When Web Workers are unavailable (old browsers, test environments), the
 * same pure functions run synchronously on the main thread — identical
 * behaviour, identical results. Callers handle stale results by comparing
 * request tokens.
 */

let logScanSeq = 0;
let harSeq = 0;

export function scanTextWithWorker(text: string, options?: ScanOptions): Promise<ScanResult> {
  if (typeof Worker === "undefined") {
    return Promise.resolve(scanLogText(text, options));
  }
  return new Promise((resolve) => {
    const id = ++logScanSeq;
    let worker: Worker;
    try {
      worker = new Worker(new URL("@/workers/log-scan.worker.ts", import.meta.url), {
        type: "module",
      });
    } catch {
      resolve(scanLogText(text, options));
      return;
    }
    const timeout = setTimeout(() => {
      worker.terminate();
      // Timeout fallback: run synchronously rather than fail.
      resolve(scanLogText(text, options));
    }, 10_000);
    worker.onmessage = (event: MessageEvent<LogScanResponse>) => {
      const message = event.data;
      if (!message || message.type !== "result" || message.id !== id) return;
      clearTimeout(timeout);
      worker.terminate();
      resolve({
        findings: message.findings,
        truncated: message.truncated,
        warnings: message.warnings,
      });
    };
    worker.onerror = (event) => {
      clearTimeout(timeout);
      worker.terminate();
      // Do not leak raw log content into error messages.
      event.preventDefault();
      resolve(scanLogText(text, options));
    };
    worker.postMessage({ type: "scan", id, text, options } satisfies {
      type: "scan";
      id: number;
      text: string;
      options?: ScanOptions;
    });
  });
}

export function parseHarWithWorker(harJson: string): Promise<HarParseResult> {
  if (typeof Worker === "undefined") {
    return Promise.resolve(parseHarSummary(harJson));
  }
  return new Promise((resolve) => {
    const id = ++harSeq;
    let worker: Worker;
    try {
      worker = new Worker(new URL("@/workers/har-parse.worker.ts", import.meta.url), {
        type: "module",
      });
    } catch {
      resolve(parseHarSummary(harJson));
      return;
    }
    const timeout = setTimeout(() => {
      worker.terminate();
      resolve(parseHarSummary(harJson));
    }, 15_000);
    worker.onmessage = (event: MessageEvent<HarParseResponse>) => {
      const message = event.data;
      if (!message || message.type !== "result" || message.id !== id || message.op !== "parse") {
        return;
      }
      clearTimeout(timeout);
      worker.terminate();
      resolve(message.parse ?? { ok: false, message: "Worker returned no summary.", truncated: false });
    };
    worker.onerror = (event) => {
      clearTimeout(timeout);
      worker.terminate();
      event.preventDefault();
      resolve(parseHarSummary(harJson));
    };
    worker.postMessage({ type: "parse", id, harJson } satisfies {
      type: "parse";
      id: number;
      harJson: string;
    });
  });
}

export function sanitizeHarWithWorker(harJson: string): Promise<HarSanitizeResult> {
  if (typeof Worker === "undefined") {
    return Promise.resolve(sanitizeHar(harJson));
  }
  return new Promise((resolve) => {
    const id = ++harSeq;
    let worker: Worker;
    try {
      worker = new Worker(new URL("@/workers/har-parse.worker.ts", import.meta.url), {
        type: "module",
      });
    } catch {
      resolve(sanitizeHar(harJson));
      return;
    }
    const timeout = setTimeout(() => {
      worker.terminate();
      resolve(sanitizeHar(harJson));
    }, 15_000);
    worker.onmessage = (event: MessageEvent<HarParseResponse>) => {
      const message = event.data;
      if (!message || message.type !== "result" || message.id !== id || message.op !== "sanitize") {
        return;
      }
      clearTimeout(timeout);
      worker.terminate();
      resolve(message.sanitize ?? { ok: false, message: "Worker returned no sanitized copy." });
    };
    worker.onerror = (event) => {
      clearTimeout(timeout);
      worker.terminate();
      event.preventDefault();
      resolve(sanitizeHar(harJson));
    };
    worker.postMessage({ type: "sanitize", id, harJson } satisfies {
      type: "sanitize";
      id: number;
      harJson: string;
    });
  });
}
