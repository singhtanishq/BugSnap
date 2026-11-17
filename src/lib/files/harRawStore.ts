/**
 * In-memory store for raw HAR text, keyed by HAR import id.
 *
 * The raw file is deliberately kept OUT of report state so it can never leak
 * into exports or drafts. It lives only in this module-level map, is used for
 * the optional sanitise step, and is deleted when the HAR is removed or the
 * report resets. Nothing here is written to any storage.
 */

const rawHarStore = new Map<string, string>();

export function setRawHar(id: string, text: string): void {
  rawHarStore.set(id, text);
}

export function getRawHar(id: string): string | undefined {
  return rawHarStore.get(id);
}

export function deleteRawHar(id: string): void {
  rawHarStore.delete(id);
}

export function clearRawHars(): void {
  rawHarStore.clear();
}
