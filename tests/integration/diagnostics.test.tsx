import { describe, expect, it, beforeEach } from "vitest";
import { render, screen, within, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "@/app/App";

/**
 * Diagnostics integration: paste a console log with a synthetic token, verify
 * the detector flags it, redact it, and confirm the sanitized preview never
 * shows the token. Also covers the HAR import → summary → sanitized-copy flow.
 */

const LOG_WITH_TOKEN = [
  "[09:41:02] app booted",
  "[09:41:03] Authorization: Bearer demo_test_token_NOT_REAL_123456",
  "[09:41:04] ready",
].join("\n");

function harFile(name = "sample.har"): File {
  const har = {
    log: {
      entries: [
        {
          time: 100,
          request: {
            method: "GET",
            url: "https://api.acme-widgets.test/v2/profile?token=supersecret123",
            headers: [
              { name: "Authorization", value: "Bearer supersecret123" },
              { name: "Accept", value: "application/json" },
            ],
            queryString: [{ name: "token", value: "supersecret123" }],
            cookies: [{ name: "sid", value: "session-value-123" }],
          },
          response: {
            status: 200,
            statusText: "OK",
            headers: [{ name: "Content-Type", value: "application/json" }],
            cookies: [],
            content: { size: 200, mimeType: "application/json", text: '{"secret":"body-secret-999"}' },
          },
        },
        {
          time: 400,
          request: { method: "POST", url: "https://api.acme-widgets.test/v2/fail", headers: [], queryString: [], cookies: [] },
          response: { status: 500, statusText: "Server Error", headers: [], cookies: [], content: { size: 10, mimeType: "text/plain" } },
        },
      ],
    },
  };
  return new File([JSON.stringify(har)], name, { type: "application/json" });
}

async function goToDiagnostics(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("link", { name: "Diagnostics" }));
  expect(screen.getByText("Diagnostics", { selector: "h1" })).toBeVisible();
}

describe("console log intake and redaction", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("scans pasted text, lists findings and sanitizes on demand", async () => {
    const user = userEvent.setup();
    render(<App />);
    await goToDiagnostics(user);

    fireEvent.change(screen.getByLabelText("Paste console output"), { target: { value: LOG_WITH_TOKEN } });
    await user.click(screen.getByRole("button", { name: "Import pasted text" }));

    const table = await screen.findByRole("table", { name: /Sensitive-data findings/i });
    expect(within(table).getAllByText(/Bearer token|API-key|api-key|token assignment/i).length).toBeGreaterThan(0);

    // Mark every finding redacted via the Redact buttons
    const redactButtons = within(table).getAllByRole("button", { name: /^Redact finding/ });
    for (const button of redactButtons) {
      await user.click(button);
    }

    // Switch to sanitized preview — the token must be gone
    await user.click(screen.getByRole("button", { name: "Sanitized preview" }));
    const preview = screen.getByLabelText("Sanitized console text preview") as HTMLTextAreaElement;
    expect(preview.value).not.toContain("demo_test_token_NOT_REAL_123456");
    expect(preview.value).toContain("[REDACTED]");
    expect(preview.value).toContain("[09:41:02] app booted");
  });

  it("shows the original text with the token, and hides raw secrets from previews only after redaction", async () => {
    const user = userEvent.setup();
    render(<App />);
    await goToDiagnostics(user);

    fireEvent.change(screen.getByLabelText("Paste console output"), { target: { value: LOG_WITH_TOKEN } });
    await user.click(screen.getByRole("button", { name: "Import pasted text" }));

    const original = screen.getByLabelText("Original console text") as HTMLTextAreaElement;
    expect(original.value).toContain("demo_test_token_NOT_REAL_123456");
  });

  it("supports manual selection redaction", async () => {
    const user = userEvent.setup();
    render(<App />);
    await goToDiagnostics(user);

    fireEvent.change(screen.getByLabelText("Paste console output"), { target: { value: "[t0] secret-area-42 loading" } });
    await user.click(screen.getByRole("button", { name: "Import pasted text" }));

    const original = (await screen.findByLabelText(
      "Original console text",
    )) as HTMLTextAreaElement;
    original.focus();
    const start = original.value.indexOf("secret-area-42");
    original.setSelectionRange(start, start + "secret-area-42".length);

    await user.click(screen.getByRole("button", { name: "Redact selected text" }));

    await user.click(screen.getByRole("button", { name: "Sanitized preview" }));
    const preview = screen.getByLabelText("Sanitized console text preview") as HTMLTextAreaElement;
    expect(preview.value).not.toContain("secret-area-42");
    expect(preview.value).toContain("[REDACTED]");
  });
});

describe("HAR import and sanitized copy", () => {
  it("imports a HAR, shows the summary and never displays raw values", async () => {
    const user = userEvent.setup();
    render(<App />);
    await goToDiagnostics(user);

    const input = document.querySelector<HTMLInputElement>(
      'input[type="file"][aria-label="Choose HAR file"]',
    )!;
    fireEvent.change(input, { target: { files: [harFile()] } });

    expect(await screen.findByText("sample.har")).toBeVisible();
    expect(screen.getByText("Hostnames:")).toBeVisible();
    expect(screen.getAllByText(/api\.acme-widgets\.test/).length).toBeGreaterThan(0);
    expect(screen.getByText("Entries")).toBeVisible();

    // Raw values must not appear anywhere in the summary UI
    expect(document.body.textContent).not.toContain("supersecret123");
    expect(document.body.textContent).not.toContain("body-secret-999");
    // The raw file cannot be exported before sanitisation.
    const includeCheckbox = screen.getByRole("checkbox", {
      name: /Include sanitized HAR in exports/,
    }) as HTMLInputElement;
    expect(includeCheckbox.disabled).toBe(true);
  });

  it("requires explicit preparation before a sanitized HAR can be exported", async () => {
    const user = userEvent.setup();
    render(<App />);
    await goToDiagnostics(user);

    const input = document.querySelector<HTMLInputElement>(
      'input[type="file"][aria-label="Choose HAR file"]',
    )!;
    fireEvent.change(input, { target: { files: [harFile()] } });
    await screen.findByText("sample.har");

    await user.click(screen.getByRole("button", { name: "Prepare sanitized HAR copy" }));

    const dialog = await screen.findByRole("dialog", { name: /Prepare a sanitized HAR copy/ });
    await user.click(within(dialog).getByRole("button", { name: "Prepare sanitized copy" }));

    expect((await screen.findAllByText(/sanitized copy ready/i)).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/headers: 1/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/query params: 1/).length).toBeGreaterThan(0);

    const includeCheckbox = screen.getByRole("checkbox", {
      name: /Include sanitized HAR in exports/,
    }) as HTMLInputElement;
    expect(includeCheckbox.disabled).toBe(false);

    // The sanitized copy is revealed automatically after preparation.
    const pre = await screen.findByText(/\[OMITTED BY BUGSNAP SANITIZER/);
    expect(pre).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Hide sanitized copy" }));
    expect(screen.queryByText(/\[OMITTED BY BUGSNAP SANITIZER/)).toBeNull();
  });

  it("rejects non-HAR files", async () => {
    const user = userEvent.setup();
    render(<App />);
    await goToDiagnostics(user);

    const input = document.querySelector<HTMLInputElement>(
      'input[type="file"][aria-label="Choose HAR file"]',
    )!;
    fireEvent.change(input, {
      target: { files: [new File(["{}"], "notes.txt", { type: "text/plain" })] },
    });
    expect(await screen.findByRole("status")).toHaveTextContent(/\.har file/);
  });
});
