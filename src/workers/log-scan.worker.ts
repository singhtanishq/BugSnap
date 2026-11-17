/// <reference lib="webworker" />
import { scanLogText, type ScanOptions } from "@/lib/redaction/patterns";

/**
 * Log scanning worker: keeps regex scanning off the main thread so large
 * console logs do not freeze the interface.
 */

export interface LogScanRequest {
  type: "scan";
  id: number;
  text: string;
  options?: ScanOptions;
}

export interface LogScanResponse {
  type: "result";
  id: number;
  findings: ReturnType<typeof scanLogText>["findings"];
  truncated: boolean;
  warnings: string[];
}

self.onmessage = (event: MessageEvent<LogScanRequest>) => {
  const message = event.data;
  if (!message || message.type !== "scan") return;
  const result = scanLogText(message.text, message.options);
  const response: LogScanResponse = {
    type: "result",
    id: message.id,
    findings: result.findings,
    truncated: result.truncated,
    warnings: result.warnings,
  };
  self.postMessage(response);
};
