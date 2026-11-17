/**
 * In-memory store for evidence image bytes.
 *
 * Binary blobs are deliberately kept OUT of React state: React state holds
 * only metadata, this module holds the bytes and their object URLs. URLs are
 * revoked deterministically when evidence is removed or the report resets.
 */

const store = new Map<string, { blob: Blob; url: string }>();

export function putEvidenceBlob(id: string, blob: Blob): string {
  removeEvidenceBlob(id);
  const url = URL.createObjectURL(blob);
  store.set(id, { blob, url });
  return url;
}

export function hasEvidenceBlob(id: string): boolean {
  return store.has(id);
}

export function getEvidenceUrl(id: string): string | undefined {
  return store.get(id)?.url;
}

export function getEvidenceBlob(id: string): Blob | undefined {
  return store.get(id)?.blob;
}

export function removeEvidenceBlob(id: string): void {
  const entry = store.get(id);
  if (entry) {
    URL.revokeObjectURL(entry.url);
    store.delete(id);
  }
}

export function clearEvidenceBlobs(): void {
  for (const id of Array.from(store.keys())) {
    removeEvidenceBlob(id);
  }
}
