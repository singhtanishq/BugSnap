import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/**
 * Accessibility audit across every page at desktop and mobile sizes.
 * Violations with serious/critical impact fail the build.
 */

const PAGES = [
  { hash: "#/", name: "overview" },
  { hash: "#/report", name: "report builder" },
  { hash: "#/steps", name: "steps" },
  { hash: "#/evidence", name: "evidence" },
  { hash: "#/environment", name: "environment" },
  { hash: "#/diagnostics", name: "diagnostics" },
  { hash: "#/review", name: "review" },
  { hash: "#/privacy", name: "privacy" },
  { hash: "#/help", name: "help" },
];

async function assertNoAxeViolations(page: Page, label: string) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  const blocking = results.violations.filter((violation) =>
    ["serious", "critical"].includes(violation.impact ?? ""),
  );
  const summary = blocking
    .map((v) => `${v.id} (${v.impact}): ${v.nodes.length} node(s) — ${v.nodes[0]?.target.join(" ")}`)
    .join("\n");
  console.log(`AXE[${label}]:\n${summary || "(clean)"}`);
  expect(blocking, `${label} axe violations:\n${summary}`).toEqual([]);
}

test.describe("accessibility", () => {
  for (const target of PAGES) {
    test(`page ${target.name} passes axe (desktop)`, async ({ page }) => {
      await page.goto(target.hash);
      await page.waitForTimeout(400);
      await assertNoAxeViolations(page, target.name);
    });

    test(`page ${target.name} passes axe (mobile)`, async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 812 });
      await page.goto(target.hash);
      await page.waitForTimeout(400);
      await assertNoAxeViolations(page, `${target.name} @mobile`);
    });
  }

  test("annotation studio passes axe when open", async ({ page }) => {
    await page.goto("#/");
    await page.getByRole("button", { name: "Load sample report" }).click();
    await page.waitForTimeout(1200);
    await page.getByRole("link", { name: "Evidence" }).first().click();
    await page.getByRole("button", { name: /Annotate aurora-settings-sample/ }).click();
    await page.waitForTimeout(500);
    await assertNoAxeViolations(page, "annotation studio");
  });

  test("keyboard navigation reaches primary destinations", async ({ page }) => {
    await page.goto("#/");
    await page.keyboard.press("Tab");
    let tabCount = 0;
    let foundEvidence = false;
    while (tabCount < 40 && !foundEvidence) {
      const active = page.locator(":focus");
      const text = (await active.textContent().catch(() => "")) ?? "";
      if (text.includes("Evidence")) {
        foundEvidence = true;
        break;
      }
      await page.keyboard.press("Tab");
      tabCount += 1;
    }
    expect(foundEvidence, "Evidence link reachable via keyboard Tab").toBe(true);
    await page.keyboard.press("Enter");
    await expect(page.getByRole("heading", { name: "Evidence", level: 1 })).toBeVisible();
  });
});
