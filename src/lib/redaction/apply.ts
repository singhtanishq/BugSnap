import type { Finding } from "@/types/redaction";

export interface ApplyResult {
  sanitized: string;
  /** Number of findings actually replaced in the output. */
  appliedCount: number;
}

/**
 * Apply *redacted* findings to the text. Ignored and pending findings are
 * left untouched. Replacements happen on the raw line content so the output
 * genuinely differs from the input — hiding text in the UI is never enough.
 */
export function applyFindings(text: string, findings: Finding[]): ApplyResult {
  const lines = text.split("\n");
  let appliedCount = 0;

  const byLine = new Map<number, Finding[]>();
  for (const finding of findings) {
    if (finding.status !== "redacted") continue;
    const list = byLine.get(finding.location.line) ?? [];
    list.push(finding);
    byLine.set(finding.location.line, list);
  }

  for (const [lineNumber, lineFindings] of byLine) {
    const line = lines[lineNumber - 1];
    if (line === undefined) continue;
    // Replace from the end of the line backwards so earlier columns stay valid.
    const sorted = [...lineFindings].sort((a, b) => b.location.column - a.location.column);
    let result = line;
    for (const finding of sorted) {
      const start = finding.location.column - 1;
      const end = start + finding.location.length;
      if (start < 0 || end > result.length) continue;
      // Verify the stored match still matches the text at this position.
      if (result.slice(start, end) !== finding.matchText) continue;
      result = result.slice(0, start) + finding.replacement + result.slice(end);
      appliedCount += 1;
    }
    lines[lineNumber - 1] = result;
  }

  return { sanitized: lines.join("\n"), appliedCount };
}
