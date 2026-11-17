/**
 * Sensitive-data finding model.
 *
 * `matchText` is the actual matched secret. It stays in application memory
 * only and must never be serialized into exports, JSON reports, or console
 * logs. Exports receive replacements; previews are masked.
 */

export type FindingCategory =
  | "email"
  | "phone"
  | "ipv4"
  | "ipv6"
  | "credit-card"
  | "api-key"
  | "jwt"
  | "bearer"
  | "password-assignment"
  | "private-key"
  | "cloud-credential"
  | "session-cookie"
  | "url-query-secret"
  | "custom";

export type FindingSeverity = "high" | "medium" | "low";
export type FindingConfidence = "high" | "medium" | "low";
export type FindingStatus = "pending" | "redacted" | "ignored";

export interface FindingLocation {
  /** 1-based line number for text findings. */
  line: number;
  /** 1-based column of the match start within the line. */
  column: number;
  length: number;
}

export interface Finding {
  id: string;
  category: FindingCategory;
  severity: FindingSeverity;
  confidence: FindingConfidence;
  location: FindingLocation;
  /** Masked preview, never the full value. */
  maskedPreview: string;
  /** Proposed replacement applied on export, e.g. "[REDACTED]". */
  replacement: string;
  ruleSource: "builtin" | "custom";
  /** True when the user redacted the selection manually rather than via a rule. */
  manual?: boolean;
  status: FindingStatus;
  /** The matched value. In-memory only — excluded from every serialization. */
  matchText: string;
}

export const FINDING_CATEGORY_LABELS: Record<FindingCategory, string> = {
  email: "Email address",
  phone: "Phone-like number",
  ipv4: "IPv4 address",
  ipv6: "IPv6 address",
  "credit-card": "Credit-card-like number",
  "api-key": "API-key-like token",
  jwt: "JWT-shaped token",
  bearer: "Bearer token",
  "password-assignment": "Password/secret assignment",
  "private-key": "Private key marker",
  "cloud-credential": "Cloud credential pattern",
  "session-cookie": "Session cookie",
  "url-query-secret": "Sensitive URL query parameter",
  custom: "Custom rule",
};
