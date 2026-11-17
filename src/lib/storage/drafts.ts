import { openDB, type IDBPDatabase } from "idb";
import type { BugReport } from "@/types/report";
import { readBlobAsBytes } from "@/lib/files/readFile";

/**
 * Opt-in local draft storage (IndexedDB).
 *
 * Nothing is written here unless the user has explicitly enabled local draft
 * saving. Drafts live in the browser profile, are NOT encrypted by BugSnap,
 * and never leave the device. The enabled flag itself is stored in IndexedDB
 * (not localStorage) so all persistence lives in one auditable place.
 *
 * Image bytes are stored as Uint8Array copies (structured-clone safe across
 * environments) and re-wrapped into Blobs on load.
 */

const DB_NAME = "bugsnap";
const DB_VERSION = 1;

interface DraftRecord {
  id: string;
  savedAt: string;
  title: string;
  report: BugReport;
  rawHar?: string;
}

interface DraftBlobRecord {
  key: [string, string];
  bytes: Uint8Array;
  mimeType: string;
}

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDb(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains("settings")) {
          db.createObjectStore("settings");
        }
        if (!db.objectStoreNames.contains("drafts")) {
          db.createObjectStore("drafts", { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains("draft-blobs")) {
          db.createObjectStore("draft-blobs", { keyPath: "key" });
        }
      },
    });
  }
  return dbPromise;
}

export interface DraftSummary {
  id: string;
  savedAt: string;
  title: string;
  evidenceCount: number;
}

/* ---------- settings ---------- */

const SETTING_KEY = "draftSavingEnabled";

export async function isDraftSavingEnabled(): Promise<boolean> {
  try {
    const db = await getDb();
    const value = await db.get("settings", SETTING_KEY);
    return value === true;
  } catch {
    return false;
  }
}

export async function setDraftSavingEnabled(enabled: boolean): Promise<void> {
  const db = await getDb();
  if (enabled) {
    await db.put("settings", true, SETTING_KEY);
  } else {
    // Disabling also removes stored drafts so nothing lingers behind the
    // user's back.
    await deleteAllDrafts();
    await db.delete("settings", SETTING_KEY);
  }
}

/* ---------- drafts ---------- */

export interface SaveDraftExtras {
  /** Raw HAR text, if a HAR is imported — restored into the memory store. */
  rawHar?: string;
}

export async function saveDraft(
  report: BugReport,
  blobs: Map<string, Blob>,
  extras: SaveDraftExtras = {},
): Promise<string> {
  const db = await getDb();
  const id = report.id;
  const record: DraftRecord = {
    id,
    savedAt: new Date().toISOString(),
    title: report.title.trim() || "Untitled draft",
    // Structured clone keeps the whole report (including findings) intact.
    report,
    ...(extras.rawHar ? { rawHar: extras.rawHar } : {}),
  };
  // Convert bytes BEFORE opening the transaction: awaiting mid-transaction
  // would let it auto-commit (TransactionInactiveError).
  const entries: Array<{ evidenceId: string; bytes: Uint8Array; mimeType: string }> = [];
  for (const [evidenceId, blob] of blobs) {
    const bytes = await readBlobAsBytes(blob);
    entries.push({ evidenceId, bytes, mimeType: blob.type || "image/png" });
  }

  const tx = db.transaction(["drafts", "draft-blobs"], "readwrite");
  await tx.objectStore("drafts").put(record);
  const blobStore = tx.objectStore("draft-blobs");
  for (const entry of entries) {
    await blobStore.put({
      key: [id, entry.evidenceId],
      bytes: entry.bytes,
      mimeType: entry.mimeType,
    } satisfies DraftBlobRecord);
  }
  await tx.done;
  return id;
}

export async function listDrafts(): Promise<DraftSummary[]> {
  try {
    const db = await getDb();
    const records = (await db.getAll("drafts")) as DraftRecord[];
    return records
      .map((record) => ({
        id: record.id,
        savedAt: record.savedAt,
        title: record.title,
        evidenceCount: record.report.evidence.length,
      }))
      .sort((a, b) => b.savedAt.localeCompare(a.savedAt));
  } catch {
    return [];
  }
}

export interface LoadedDraft {
  report: BugReport;
  blobs: Map<string, Blob>;
  rawHar?: string;
  savedAt: string;
}

export async function loadDraft(id: string): Promise<LoadedDraft | null> {
  const db = await getDb();
  const record = (await db.get("drafts", id)) as DraftRecord | undefined;
  if (!record) return null;
  const blobs = new Map<string, Blob>();
  let cursor = await db.transaction("draft-blobs").store.openCursor();
  while (cursor) {
    const value = cursor.value as DraftBlobRecord;
    if (value.key[0] === id && value.bytes) {
      blobs.set(value.key[1], new Blob([value.bytes as BlobPart], { type: value.mimeType }));
    }
    cursor = await cursor.continue();
  }
  return {
    report: record.report,
    blobs,
    ...(record.rawHar ? { rawHar: record.rawHar } : {}),
    savedAt: record.savedAt,
  };
}

export async function deleteDraft(id: string): Promise<void> {
  const db = await getDb();
  const tx = db.transaction(["drafts", "draft-blobs"], "readwrite");
  await tx.objectStore("drafts").delete(id);
  let cursor = await tx.objectStore("draft-blobs").openCursor();
  while (cursor) {
    const value = cursor.value as DraftBlobRecord;
    if (value.key[0] === id) {
      await cursor.delete();
    }
    cursor = await cursor.continue();
  }
  await tx.done;
}

export async function deleteAllDrafts(): Promise<number> {
  const db = await getDb();
  const existing = (await db.getAll("drafts")) as DraftRecord[];
  const tx = db.transaction(["drafts", "draft-blobs"], "readwrite");
  await tx.objectStore("drafts").clear();
  await tx.objectStore("draft-blobs").clear();
  await tx.done;
  return existing.length;
}

export async function estimateDraftStorageUsage(): Promise<{ usage: number; quota: number } | null> {
  try {
    if (typeof navigator === "undefined" || !navigator.storage?.estimate) return null;
    const { usage, quota } = await navigator.storage.estimate();
    if (typeof usage !== "number" || typeof quota !== "number") return null;
    return { usage, quota };
  } catch {
    return null;
  }
}
