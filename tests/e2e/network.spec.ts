import { test, expect } from "@playwright/test";

/**
 * Local-only network audit: during a full user workflow, every request must
 * stay on the app's own origin. No analytics, no uploads, no third-party
 * calls. This is the directive's privacy enforcement test.
 */

test("no requests leave the app origin during a full workflow", async ({ page }) => {
  const requests: Array<{ url: string; method: string; resourceType: string }> = [];

  page.on("request", (request) => {
    requests.push({
      url: request.url(),
      method: request.method(),
      resourceType: request.resourceType(),
    });
  });

  // Full workflow: sample load, evidence inspection, annotation studio,
  // diagnostics, review, exports.
  await page.goto("#/");
  await page.getByRole("button", { name: "Load sample report" }).click();
  await page.waitForTimeout(1200);

  await page.getByRole("link", { name: "Evidence" }).first().click();
  await page.getByRole("button", { name: /Annotate aurora-settings-sample/ }).click();
  await page.waitForTimeout(400);
  await page.getByRole("button", { name: "Close annotation studio" }).click();

  await page.getByRole("link", { name: "Diagnostics" }).first().click();
  await page.waitForTimeout(300);
  await page.getByRole("link", { name: "Review & Export" }).first().click();
  await page.waitForTimeout(300);
  await page.getByRole("button", { name: "Download Markdown" }).click().catch(() => {});
  await page.waitForTimeout(800);

  const appOrigin = new URL(page.url()).origin;
  const external = requests.filter((request) => {
    const url = new URL(request.url);
    return url.origin !== appOrigin;
  });

  // Data URLs and blob URLs never hit the network; filter them explicitly.
  const networked = external.filter(
    (request) => request.url.startsWith("http") && !request.url.startsWith(appOrigin),
  );

  expect(networked, `External requests: ${networked.map((r) => r.url).join(", ")}`).toEqual([]);
  // Sanity: the workflow actually produced same-origin activity.
  expect(requests.length).toBeGreaterThan(0);
  expect(requests.every((r) => r.url.startsWith(appOrigin) || !r.url.startsWith("http"))).toBe(
    true,
  );
});
