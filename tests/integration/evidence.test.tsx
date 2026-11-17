import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, within, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "@/app/App";

// jsdom cannot decode images; the page-level flow is what this suite covers.
// Real decoding is exercised by the Playwright browser suite.
vi.mock("@/lib/images/decodeImage", () => ({
  decodeImage: vi.fn(async () => ({ width: 800, height: 600 })),
  createDrawableSource: vi.fn(async () => new Image(800, 600)),
}));

function pngFile(name = "shot.png", sizeBytes = 2048): File {
  return new File([new Uint8Array(sizeBytes)], name, { type: "image/png" });
}

async function goToEvidence(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("link", { name: "Evidence" }));
  expect(screen.getByText("Evidence", { selector: "h1" })).toBeVisible();
}

describe("evidence workspace", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("imports an uploaded file and shows its metadata", async () => {
    const user = userEvent.setup();
    render(<App />);
    await goToEvidence(user);

    const input = document.querySelector<HTMLInputElement>(
      'input[type="file"][aria-label="Choose evidence image files"]',
    )!;
    expect(input).not.toBeNull();

    await user.upload(input, pngFile("console-crash.png"));
    expect(await screen.findByText("console-crash.png")).toBeVisible();
    expect(screen.getByText(/800 × 600 px/)).toBeVisible();
    expect(screen.getByText("Uploaded")).toBeVisible();
  });

  it("rejects an unsupported file type with an actionable message", async () => {
    const user = userEvent.setup();
    render(<App />);
    await goToEvidence(user);

    const input = document.querySelector<HTMLInputElement>(
      'input[type="file"][aria-label="Choose evidence image files"]',
    )!;
    // user-event would filter this against `accept`; the app-level validation
    // is what we are testing, so dispatch the change directly.
    fireEvent.change(input, {
      target: {
        files: [new File([new Uint8Array(64)], "page.gif", { type: "image/gif" })],
      },
    });

    expect(await screen.findByRole("status")).toHaveTextContent(/Unsupported image type/);
    expect(screen.getByText("No evidence yet")).toBeVisible();
  });

  it("rejects oversized files", async () => {
    const user = userEvent.setup();
    render(<App />);
    await goToEvidence(user);

    const input = document.querySelector<HTMLInputElement>(
      'input[type="file"][aria-label="Choose evidence image files"]',
    )!;
    await user.upload(input, pngFile("huge.png", 21 * 1024 * 1024));

    expect(await screen.findByRole("status")).toHaveTextContent(/20 MB limit/);
  });

  it("reorders and removes evidence", async () => {
    const user = userEvent.setup();
    render(<App />);
    await goToEvidence(user);

    const input = document.querySelector<HTMLInputElement>(
      'input[type="file"][aria-label="Choose evidence image files"]',
    )!;
    await user.upload(input, pngFile("first.png"));
    await user.upload(input, pngFile("second.png"));

    expect(await screen.findByText("second.png")).toBeVisible();
    const list = screen.getByRole("list", { name: /Evidence images in export order/ });
    const firstItem = within(list).getByText("first.png").closest("li")!;
    await user.click(
      within(firstItem).getByRole("button", { name: /Move first.png later/ }),
    );

    const names = within(list)
      .getAllByText(/^(first|second)\.png$/)
      .map((el) => el.textContent);
    expect(names).toEqual(["second.png", "first.png"]);

    await user.click(
      within(within(list).getByText("second.png").closest("li")!).getByRole("button", {
        name: /Remove second\.png/,
      }),
    );
    expect(within(list).getAllByText(/^(first|second)\.png$/)).toHaveLength(1);
  });

  it("adds a pasted clipboard image", async () => {
    const user = userEvent.setup();
    render(<App />);
    await goToEvidence(user);

    const file = pngFile("clipboard.png");
    const pasteEvent = new Event("paste", { bubbles: true, cancelable: true });
    Object.defineProperty(pasteEvent, "clipboardData", {
      value: {
        items: [
          {
            type: "image/png",
            getAsFile: () => file,
          },
        ],
      },
    });
    document.dispatchEvent(pasteEvent);

    // Both the evidence entry and the toast mention the generated name.
    const list = await screen.findByRole("list", {
      name: /Evidence images in export order/,
    });
    expect(within(list).getAllByText(/pasted-image-/).length).toBeGreaterThan(0);
    expect(within(list).getByText("Pasted")).toBeVisible();
  });

  it("explains that screen capture is unavailable where unsupported", async () => {
    const user = userEvent.setup();
    render(<App />);
    await goToEvidence(user);

    expect(
      screen.getByText(/does not offer screen capture/),
    ).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Capture screen" }));
    expect(await screen.findByRole("status")).toHaveTextContent(
      /does not support screen capture/,
    );
  });
});
