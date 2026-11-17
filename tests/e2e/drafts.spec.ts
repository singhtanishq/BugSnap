import { test, expect } from "@playwright/test";

/**
 * Draft lifecycle in a real browser with real IndexedDB:
 * enable → save → reload → restore → delete all → verify empty.
 * Includes the persistence-opt-out check (Milestone 08 acceptance).
 */

async function enableDrafts(page: import("@playwright/test").Page) {
  await page.getByRole("link", { name: "Privacy" }).first().click();
  await page.getByRole("button", { name: "Enable local draft saving" }).click();
  const dialog = page.getByRole("dialog", { name: /Enable local draft saving/ });
  await dialog.getByRole("button", { name: "Enable draft saving" }).click();
  await expect(page.getByText(/Draft saving is ON/)).toBeVisible();
}

test("drafts persist across reload only after explicit opt-in", async ({ page }) => {
  await page.goto("#/");
  await page.getByRole("button", { name: "Load sample report" }).click();
  await page.waitForTimeout(1200);

  // Default state: nothing written anywhere.
  await page.getByRole("link", { name: "Privacy" }).first().click();
  await expect(page.getByText("Draft saving is OFF — nothing has ever been written to storage.")).toBeVisible();

  // Enable, save.
  await enableDrafts(page);
  await page.getByRole("button", { name: "Save draft now" }).click();
  await expect(page.getByText("Draft saved to this browser (IndexedDB)")).toBeVisible();
  await expect(page.getByText(/Save button remains disabled/).first()).toBeVisible();

  // Reload the page — in-memory state is gone; the draft survives.
  await page.reload();
  await page.getByRole("link", { name: "Privacy" }).first().click();
  await expect(page.getByText(/Saved .* · 1 evidence item\(s\)/)).toBeVisible();

  // Restore.
  await page.getByRole("button", { name: /^Restore draft Save button remains disabled/ }).click();
  await expect(page.getByText(/Draft restored — "Save button remains disabled/)).toBeVisible();
  await page.getByRole("link", { name: "Report" }).first().click();
  await expect(
    page.getByText("Save button remains disabled after editing profile details", { exact: true }),
  ).toBeVisible();

  // Delete all from the privacy center.
  await page.getByRole("link", { name: "Privacy" }).first().click();
  await page.getByRole("button", { name: "Delete all local drafts" }).first().click();
  const dialog = page.getByRole("dialog", { name: /Delete all local drafts/ });
  await dialog.getByRole("button", { name: "Delete all drafts" }).click();
  await expect(page.getByText(/deleted from IndexedDB|No drafts to delete/)).toBeVisible();
  await expect(page.getByText("No saved drafts yet")).toBeVisible();
});

test("disabling draft saving deletes stored drafts", async ({ page }) => {
  await page.goto("#/");
  await page.getByRole("button", { name: "Load sample report" }).click();
  await page.waitForTimeout(1200);
  await enableDrafts(page);
  await page.getByRole("button", { name: "Save draft now" }).click();
  await expect(page.getByText("Draft saved to this browser (IndexedDB)")).toBeVisible();

  await page.getByRole("button", { name: "Disable & delete drafts" }).click();
  const dialog = page.getByRole("dialog", { name: /Disable local draft saving/ });
  await dialog.getByRole("button", { name: "Disable & delete drafts" }).click();
  await expect(
    page.getByText("Local draft saving disabled and all stored drafts deleted"),
  ).toBeVisible();
  await expect(
    page.getByText("Draft saving is OFF — nothing has ever been written to storage."),
  ).toBeVisible();
});
