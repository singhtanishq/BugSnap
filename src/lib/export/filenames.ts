/**
 * Export filename helpers: sanitized, stable, collision-free names.
 * Filenames never contain raw report content — only an index and a
 * cleaned-up base name.
 */

export function sanitizeFilename(name: string, fallback = "evidence"): string {
  const base = name
    .replace(/\.[a-z0-9]+$/i, "")
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return base || fallback;
}

/** Zero-padded index names: screenshot-01.png, screenshot-02.png… */
export function indexedName(index: number, suffix: string): string {
  return `screenshot-${String(index).padStart(2, "0")}.${suffix}`;
}

export function reportFolderName(date = new Date()): string {
  const iso = date.toISOString().slice(0, 10);
  return `bugsnap-report-${iso}`;
}

export function uniqueName(name: string, taken: Set<string>): string {
  if (!taken.has(name)) {
    taken.add(name);
    return name;
  }
  const dot = name.lastIndexOf(".");
  const base = dot === -1 ? name : name.slice(0, dot);
  const ext = dot === -1 ? "" : name.slice(dot);
  let counter = 2;
  let candidate = `${base}-${counter}${ext}`;
  while (taken.has(candidate)) {
    counter += 1;
    candidate = `${base}-${counter}${ext}`;
  }
  taken.add(candidate);
  return candidate;
}
