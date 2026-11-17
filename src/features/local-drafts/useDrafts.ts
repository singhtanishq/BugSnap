import { useCallback, useEffect, useState } from "react";
import {
  deleteAllDrafts,
  deleteDraft,
  estimateDraftStorageUsage,
  isDraftSavingEnabled,
  listDrafts,
  loadDraft,
  saveDraft,
  setDraftSavingEnabled,
  type DraftSummary,
} from "@/lib/storage/drafts";
import { clearEvidenceBlobs } from "@/lib/files/evidenceStore";
import { clearRawHars, getRawHar } from "@/lib/files/harRawStore";

export interface DraftStorageUsage {
  usage: number;
  quota: number;
}

/**
 * Draft-saving state and actions. Saving is strictly opt-in: while disabled,
 * no report content is written anywhere.
 */
export function useDrafts() {
  const [enabled, setEnabledState] = useState<boolean | null>(null);
  const [drafts, setDrafts] = useState<DraftSummary[]>([]);
  const [usage, setUsage] = useState<DraftStorageUsage | null>(null);

  const refresh = useCallback(async () => {
    const isEnabled = await isDraftSavingEnabled();
    setEnabledState(isEnabled);
    if (isEnabled) {
      setDrafts(await listDrafts());
      setUsage(await estimateDraftStorageUsage());
    } else {
      setDrafts([]);
      setUsage(null);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const enable = useCallback(async () => {
    await setDraftSavingEnabled(true);
    await refresh();
  }, [refresh]);

  const disable = useCallback(async () => {
    await setDraftSavingEnabled(false);
    await refresh();
  }, [refresh]);

  const save = useCallback(
    async (
      report: Parameters<typeof saveDraft>[0],
      blobs: Map<string, Blob>,
    ): Promise<string | null> => {
      if (!(await isDraftSavingEnabled())) return null;
      const rawHar = report.har ? getRawHar(report.har.id) : undefined;
      const id = await saveDraft(report, blobs, rawHar ? { rawHar } : {});
      await refresh();
      return id;
    },
    [refresh],
  );

  const restore = useCallback(async (id: string) => {
    const loaded = await loadDraft(id);
    if (!loaded) return null;
    // Rebuild the in-memory stores exactly as the session had them.
    clearEvidenceBlobs();
    clearRawHars();
    return loaded;
  }, []);

  const remove = useCallback(
    async (id: string) => {
      await deleteDraft(id);
      await refresh();
    },
    [refresh],
  );

  const removeAll = useCallback(async () => {
    const count = await deleteAllDrafts();
    await refresh();
    return count;
  }, [refresh]);

  return { enabled, drafts, usage, refresh, enable, disable, save, restore, remove, removeAll };
}
