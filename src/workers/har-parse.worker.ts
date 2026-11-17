/// <reference lib="webworker" />
import { parseHarSummary } from "@/lib/har/parse";
import { sanitizeHar } from "@/lib/har/sanitize";

/**
 * HAR parsing/sanitising worker: large captures are parsed off the main
 * thread; only summaries and sanitized copies cross back.
 */

export interface HarParseRequest {
  type: "parse" | "sanitize";
  id: number;
  harJson: string;
}

export interface HarParseResponse {
  type: "result";
  id: number;
  op: "parse" | "sanitize";
  parse?: Awaited<ReturnType<typeof parseHarSummary>>;
  sanitize?: ReturnType<typeof sanitizeHar>;
}

self.onmessage = (event: MessageEvent<HarParseRequest>) => {
  const message = event.data;
  if (!message || (message.type !== "parse" && message.type !== "sanitize")) return;
  const response: HarParseResponse = {
    type: "result",
    id: message.id,
    op: message.type,
  };
  if (message.type === "parse") {
    response.parse = parseHarSummary(message.harJson);
  } else {
    response.sanitize = sanitizeHar(message.harJson);
  }
  self.postMessage(response);
};
