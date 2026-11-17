import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "@/app/App";

/**
 * Integration: the guided builder retains user input while navigating
 * between sections — state must not be lost on route change.
 */
describe("report builder state retention", () => {
  it("keeps typed values when moving between report and steps", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("link", { name: "New Report" }));
    const title = screen.getByLabelText(/^Title/);
    await user.type(title, "Discarded draft eats edits");

    const expected = screen.getByLabelText(/^Expected result/);
    await user.type(expected, "Draft persists across navigation");

    await user.click(
      screen.getAllByRole("link", { name: /Next: Reproduction steps/ })[0]!,
    );
    expect(screen.getByText("Reproduction steps", { selector: "h1" })).toBeVisible();

    await user.click(screen.getByRole("link", { name: "← Back to description" }));
    expect(screen.getByLabelText(/^Title/)).toHaveValue("Discarded draft eats edits");
    expect(screen.getByLabelText(/^Expected result/)).toHaveValue(
      "Draft persists across navigation",
    );
  });

  it("adds a step via the template and numbers it", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("link", { name: "Steps" }));
    await user.click(screen.getByRole("button", { name: /Insert quick template/ }));

    expect(screen.getByText("Step 1 action")).toBeVisible();
    expect(screen.getByText("Step 4 action")).toBeVisible();
    expect(screen.getByRole("button", { name: /Insert quick template/ })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "+ Add step" }));
    expect(screen.getByText("Step 5 action")).toBeVisible();
  });

  it("deletes and duplicates steps with renumbering", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("link", { name: "Steps" }));
    await user.click(screen.getByRole("button", { name: /Insert quick template/ }));

    await user.click(screen.getByRole("button", { name: "Duplicate step 2" }));
    expect(screen.getByText("Step 3 action")).toBeVisible();
    expect(screen.getAllByDisplayValue("Sign in or navigate to the relevant section (credentials omitted).")).toHaveLength(2);

    await user.click(screen.getByRole("button", { name: "Delete step 2" }));
    expect(screen.getByText("Step 2 action")).toBeVisible();
    // The duplicate (formerly step 3) remains, renumbered to step 2.
    expect(
      screen.getAllByDisplayValue(
        "Sign in or navigate to the relevant section (credentials omitted).",
      ),
    ).toHaveLength(1);
  });

  it("clears all steps after confirmation", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("link", { name: "Steps" }));
    await user.click(screen.getByRole("button", { name: "+ Add step" }));
    await user.click(screen.getByRole("button", { name: "Clear all steps" }));

    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeVisible();
    await user.click(
      within(dialog).getByRole("button", { name: "Clear all steps" }),
    );
    expect(screen.getByText("No reproduction steps yet")).toBeVisible();
  });
});
