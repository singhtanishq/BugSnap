import { describe, expect, it, beforeEach, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "@/app/App";
import {
  deleteAllDrafts,
  isDraftSavingEnabled,
  listDrafts,
  loadDraft,
  setDraftSavingEnabled,
} from "@/lib/storage/drafts";

// jsdom cannot draw canvas; the sample screenshot generator gets a stub.
vi.mock("@/lib/demo/syntheticScreenshot", () => ({
  generateSampleScreenshot: vi.fn(async () => ({
    blob: new Blob([new Uint8Array(2048)], { type: "image/png" }),
    width: 1280,
    height: 800,
  })),
  SAMPLE_IMAGE_WIDTH: 1280,
  SAMPLE_IMAGE_HEIGHT: 800,
  canvasToPng: vi.fn(),
}));

/**
 * Local draft integration: nothing persists before opt-in; drafts save and
 * restore fully (including evidence blobs); delete-all really clears IDB.
 */

async function loadSample(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Load sample report" }));
  await screen.findByText(/Synthetic sample report loaded/).catch(() => {});
  await user.click(screen.getAllByRole("link", { name: "Privacy" })[0]!);
  expect(screen.getByText("Privacy", { selector: "h1" })).toBeVisible();
}

describe("local draft storage", () => {
  beforeEach(async () => {
    window.location.hash = "";
    // fake-indexeddb persists across tests in this file — reset fully.
    await setDraftSavingEnabled(false);
    await deleteAllDrafts();
  });

  it("does not persist anything before the user opts in", async () => {
    const user = userEvent.setup();
    render(<App />);
    await loadSample(user);

    expect(await isDraftSavingEnabled()).toBe(false);
    expect(await listDrafts()).toEqual([]);
    expect(
      screen.getByText("Draft saving is OFF — nothing has ever been written to storage."),
    ).toBeVisible();
  });

  it("saves, lists, restores and deletes a draft after opt-in", async () => {
    const user = userEvent.setup();
    render(<App />);
    await loadSample(user);

    await user.click(screen.getByRole("button", { name: "Enable local draft saving" }));
    const dialog = screen.getByRole("dialog", { name: /Enable local draft saving/ });
    await user.click(within(dialog).getByRole("button", { name: "Enable draft saving" }));

    expect(await screen.findByText(/Draft saving is ON/)).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Save draft now" }));
    expect(await screen.findByText("Draft saved to this browser (IndexedDB)")).toBeVisible();

    const drafts = await listDrafts();
    expect(drafts).toHaveLength(1);
    expect(drafts[0]?.title).toContain("Save button remains disabled");
    expect(drafts[0]?.evidenceCount).toBe(1);

    // The stored draft contains the full report with the evidence blob.
    const loaded = await loadDraft(drafts[0]!.id);
    expect(loaded?.report.title).toContain("Save button remains disabled");
    expect(loaded?.blobs.size).toBe(1);
    expect(loaded?.rawHar).toBeTruthy();

    // Delete-all clears the store for real (the button appears twice —
    // drafts panel and clear-data panel).
    await user.click(screen.getAllByRole("button", { name: /Delete all local drafts/ })[0]!);
    const confirmDialog = screen.getAllByRole("dialog", { name: /Delete all local drafts/ })[0]!;
    await user.click(within(confirmDialog).getByRole("button", { name: "Delete all drafts" }));

    expect(await screen.findByText(/No drafts to delete|deleted from IndexedDB/)).toBeVisible();
    expect(await listDrafts()).toEqual([]);
    expect(await loadDraft(drafts[0]!.id)).toBeNull();
  });

  it("disable removes all stored drafts", async () => {
    const user = userEvent.setup();
    render(<App />);
    await loadSample(user);

    await user.click(screen.getByRole("button", { name: "Enable local draft saving" }));
    const dialog = screen.getByRole("dialog", { name: /Enable local draft saving/ });
    await user.click(within(dialog).getByRole("button", { name: "Enable draft saving" }));
    await screen.findByText(/Draft saving is ON/);
    await user.click(screen.getByRole("button", { name: "Save draft now" }));
    await screen.findByText("Draft saved to this browser (IndexedDB)");

    await user.click(screen.getByRole("button", { name: "Disable & delete drafts" }));
    const disableDialog = screen.getByRole("dialog", { name: /Disable local draft saving/ });
    await user.click(within(disableDialog).getByRole("button", { name: "Disable & delete drafts" }));

    expect(await screen.findByText(/disabled and all stored drafts deleted/)).toBeVisible();
    expect(await isDraftSavingEnabled()).toBe(false);
    expect(await listDrafts()).toEqual([]);
  });
});
