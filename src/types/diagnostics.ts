export interface HarSummaryEntry {
  method: string;
  status: number;
  statusText?: string;
  host: string;
  path: string;
  /** Approximate response body size in bytes when reported by the HAR. */
  responseSize?: number;
  /** Total time in milliseconds when reported by the HAR. */
  timeMs?: number;
  failed: boolean;
}

export interface HarSummary {
  entryCount: number;
  totalDurationMs?: number;
  totalResponseBytes?: number;
  /** Hostnames only — full URLs are deliberately not included. */
  hostnames: string[];
  methodCounts: Record<string, number>;
  statusCounts: Record<string, number>;
  failedCount: number;
  clientErrorCount: number;
  serverErrorCount: number;
  entries: HarSummaryEntry[];
  /** Descriptive observations, never root-cause conclusions. */
  observations: string[];
  parseWarnings: string[];
}

export interface RedactionCounts {
  headers: number;
  cookies: number;
  queryParams: number;
  bodies: number;
  total: number;
}
