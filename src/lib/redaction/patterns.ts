import type { Finding, FindingCategory, FindingSeverity, FindingConfidence } from "@/types/redaction";
import { localId } from "@/lib/utils";
import { isSensitiveQueryKey } from "@/lib/validation/sanitizeUrl";

/**
 * Deterministic, explainable sensitive-data detection.
 *
 * These are heuristics: they catch common formats but cannot guarantee that
 * every secret is found. The UI must present them as review aids, never as a
 * privacy guarantee. No content ever leaves the browser for scanning.
 */

export const MAX_FINDINGS = 500;
export const MAX_PATTERN_LENGTH = 200;

interface Detector {
  id: string;
  category: FindingCategory;
  severity: FindingSeverity;
  confidence: FindingConfidence;
  regex: RegExp;
  /** Optional validator to reduce false positives. */
  validate?: (match: string) => boolean;
  /** Short human explanation shown next to findings. */
  note: string;
}

export function luhnValid(digits: string): boolean {
  const cleaned = digits.replace(/[\s-]/g, "");
  if (!/^\d{13,19}$/.test(cleaned)) return false;
  let sum = 0;
  let alt = false;
  for (let i = cleaned.length - 1; i >= 0; i -= 1) {
    const digit = Number.parseInt(cleaned.charAt(i), 10);
    if (Number.isNaN(digit)) return false;
    let n = digit;
    if (alt) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alt = !alt;
  }
  return sum % 10 === 0;
}

function isPlausibleIpv4(match: string): boolean {
  const parts = match.split(".");
  if (parts.length !== 4) return false;
  return parts.every((part) => {
    const n = Number.parseInt(part, 10);
    return String(n) === part && n >= 0 && n <= 255;
  });
}

const BUILTIN_DETECTORS: Detector[] = [
  {
    id: "email",
    category: "email",
    severity: "medium",
    confidence: "high",
    regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+\b/g,
    note: "Email addresses are personal data in most jurisdictions.",
  },
  {
    id: "phone",
    category: "phone",
    severity: "low",
    confidence: "low",
    regex:
      /\b(?:\+?\d{1,3}[\s.-]?)?(?:\(\d{2,4}\)|\d{2,4})[\s.-]?\d{3}[\s.-]?\d{3,4}\b/g,
    note: "Phone-like digit groups. Formats vary by region; verify manually.",
  },
  {
    id: "ipv4",
    category: "ipv4",
    severity: "medium",
    confidence: "high",
    regex: /\b\d{1,3}(?:\.\d{1,3}){3}\b/g,
    validate: isPlausibleIpv4,
    note: "IPv4 addresses can reveal internal network topology.",
  },
  {
    id: "credit-card",
    category: "credit-card",
    severity: "high",
    confidence: "high",
    regex: /\b(?:\d[ -]?){12,18}\d\b/g,
    validate: (match) => luhnValid(match),
    note: "Payment-card-like number that passed a Luhn checksum.",
  },
  {
    id: "jwt",
    category: "jwt",
    severity: "high",
    confidence: "high",
    regex: /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g,
    note: "JWT-shaped token (three base64url segments).",
  },
  {
    id: "bearer",
    category: "bearer",
    severity: "high",
    confidence: "high",
    regex: /\bBearer\s+[A-Za-z0-9._~+/=-]{8,}/gi,
    note: "Bearer authorization token.",
  },
  {
    id: "private-key",
    category: "private-key",
    severity: "high",
    confidence: "high",
    regex: /-----BEGIN [A-Z0-9 ]*PRIVATE KEY( BLOCK)?-----/g,
    note: "Private key material. Treat as fully compromised if shared.",
  },
  {
    id: "aws-access-key",
    category: "cloud-credential",
    severity: "high",
    confidence: "high",
    regex: /\bAKIA[0-9A-Z]{12,}\b/g,
    note: "AWS access key ID pattern.",
  },
  {
    id: "github-pat",
    category: "cloud-credential",
    severity: "high",
    confidence: "high",
    regex: /\b(?:ghp|gho|ghu|ghs)_[A-Za-z0-9]{30,}\b/g,
    note: "GitHub personal access token pattern.",
  },
  {
    id: "slack-token",
    category: "cloud-credential",
    severity: "high",
    confidence: "high",
    regex: /\bxox[abprs]-[A-Za-z0-9-]{10,}\b/g,
    note: "Slack token pattern.",
  },
  {
    id: "api-key-assignment",
    category: "api-key",
    severity: "high",
    confidence: "medium",
    regex:
      /\b(?:api[_-]?key|apikey|client[_-]?secret|access[_-]?token|auth[_-]?token)\b["']?\s*[:=]\s*["']?[A-Za-z0-9._+/=-]{8,}/gi,
    note: "Key/token assignment in configuration or code output.",
  },
  {
    id: "password-assignment",
    category: "password-assignment",
    severity: "high",
    confidence: "medium",
    regex:
      /\b(?:password|passwd|pwd|secret)\b["']?\s*[:=]\s*["']?[^\s"']{6,}/gi,
    note: "Password or secret assignment. Verify the value is not a placeholder.",
  },
  {
    id: "session-cookie-header",
    category: "session-cookie",
    severity: "high",
    confidence: "high",
    regex: /\b(set-cookie)\s*:\s*([^=\s]+)=([^;\s]+)/gi,
    note: "Set-Cookie header with a session value.",
  },
  {
    id: "url-query-secret",
    category: "url-query-secret",
    severity: "high",
    confidence: "medium",
    regex: /[?&]([A-Za-z0-9_-]+)=([^&\s"']{3,})/g,
    validate: (match) => {
      const eq = match.indexOf("=");
      const key = eq === -1 ? "" : match.slice(0, eq).replace(/^[?&]/, "");
      return isSensitiveQueryKey(key);
    },
    note: "URL query parameter whose name looks sensitive (token, key, session…).",
  },
];

export interface ScanOptions {
  /** User-defined regex rules, already validated. */
  customRules?: Array<{ id: string; pattern: string; flags?: string; label?: string }>;
  /** Maximum characters to scan per input. */
  maxLength?: number;
}

export interface ScanResult {
  findings: Finding[];
  truncated: boolean;
  warnings: string[];
}

/** Build a finding from a match, with masking and location. */
function buildFinding(
  category: FindingCategory,
  severity: FindingSeverity,
  confidence: FindingConfidence,
  ruleSource: "builtin" | "custom",
  line: number,
  column: number,
  matchText: string,
): Finding {
  return {
    id: localId("finding"),
    category,
    severity,
    confidence,
    location: { line, column, length: matchText.length },
    maskedPreview: maskValue(matchText),
    replacement: "[REDACTED]",
    ruleSource,
    status: "pending",
    matchText,
  };
}

export function maskValue(value: string): string {
  if (value.length <= 6) return "•".repeat(value.length);
  const head = value.slice(0, 3);
  const tail = value.slice(-3);
  const middle = Math.min(8, value.length - 6);
  return `${head}${"•".repeat(middle)}${tail}`;
}

/**
 * Validate a user-defined regex: length limit, compile check, and a cheap
 * catastrophic-backtracing smoke test against a repeated input. ReDoS-safe
 * execution is additionally bounded by running scans in a worker.
 */
export function validateUserRegex(pattern: string, flags?: string): { ok: boolean; message?: string } {
  if (!pattern.trim()) return { ok: false, message: "Pattern is empty." };
  if (pattern.length > MAX_PATTERN_LENGTH) {
    return { ok: false, message: `Pattern exceeds ${MAX_PATTERN_LENGTH} characters.` };
  }
  const safeFlags = `g${(flags ?? "").replace(/[^gimsuy]/g, "")}`.replace("gg", "g");
  let regex: RegExp;
  try {
    regex = new RegExp(pattern, safeFlags);
  } catch (error) {
    return {
      ok: false,
      message: `Invalid regex: ${error instanceof Error ? error.message : "syntax error"}`,
    };
  }
  const smokeInput = "x".repeat(2000) + "yyyy" + "x".repeat(2000);
  const start = Date.now();
  try {
    regex.test(smokeInput);
  } catch {
    return { ok: false, message: "Pattern failed the safety smoke test." };
  }
  if (Date.now() - start > 200) {
    return { ok: false, message: "Pattern is too slow to run safely (possible backtracking)." };
  }
  return { ok: true };
}

export function scanLogText(text: string, options: ScanOptions = {}): ScanResult {
  const maxLength = options.maxLength ?? 5 * 1024 * 1024;
  const warnings: string[] = [];
  let effective = text;
  let truncated = false;
  if (effective.length > maxLength) {
    effective = effective.slice(0, maxLength);
    truncated = true;
    warnings.push(
      `Input truncated to ${maxLength} characters — trailing content was not scanned.`,
    );
  }

  const lines = effective.split("\n");
  const findings: Finding[] = [];

  const detectors: Detector[] = [...BUILTIN_DETECTORS];
  for (const rule of options.customRules ?? []) {
    const validation = validateUserRegex(rule.pattern, rule.flags);
    if (!validation.ok) {
      warnings.push(`Custom rule "${rule.label ?? rule.pattern}" rejected: ${validation.message}`);
      continue;
    }
    detectors.push({
      id: rule.id,
      category: "custom",
      severity: "medium",
      confidence: "high",
      regex: new RegExp(rule.pattern, `g${(rule.flags ?? "").replace(/[^gimsuy]/g, "")}`.replace("gg", "g")),
      note: rule.label ? `User-defined rule: ${rule.label}` : "User-defined rule.",
    });
  }

  outer: for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex] ?? "";
    for (const detector of detectors) {
      // Reset lastIndex for safety with global regexes.
      detector.regex.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = detector.regex.exec(line)) !== null) {
        const matchText = match[0];
        if (!matchText) break;
        if (detector.validate && !detector.validate(matchText)) {
          if (match.index === detector.regex.lastIndex) detector.regex.lastIndex += 1;
          continue;
        }
        findings.push(
          buildFinding(
            detector.category,
            detector.severity,
            detector.confidence,
            ruleSourceOf(detector.id, options.customRules ?? []),
            lineIndex + 1,
            match.index + 1,
            matchText,
          ),
        );
        if (findings.length >= MAX_FINDINGS) {
          warnings.push(`Stopped at ${MAX_FINDINGS} findings — fix or export what is shown and rescan.`);
          break outer;
        }
        if (match.index === detector.regex.lastIndex) detector.regex.lastIndex += 1;
      }
    }
  }

  return { findings, truncated, warnings };
}

function ruleSourceOf(
  detectorId: string,
  customRules: Array<{ id: string }>,
): "builtin" | "custom" {
  return customRules.some((rule) => rule.id === detectorId) ? "custom" : "builtin";
}
