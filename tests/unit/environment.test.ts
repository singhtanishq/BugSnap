import { describe, expect, it } from "vitest";
import { captureEnvironmentSnapshot, parseUserAgent } from "@/lib/browser/environment";

describe("user agent parsing", () => {
  it("detects Chrome with version", () => {
    const result = parseUserAgent(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
    );
    expect(result.browserName).toBe("Chrome");
    expect(result.browserVersion).toBe("126.0.0.0");
  });

  it("detects Firefox", () => {
    const result = parseUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:127.0) Gecko/20100101 Firefox/127.0",
    );
    expect(result.browserName).toBe("Firefox");
    expect(result.browserVersion).toBe("127.0");
  });

  it("detects Edge before Chrome", () => {
    const result = parseUserAgent(
      "Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Edg/126.0.0.0",
    );
    expect(result.browserName).toBe("Microsoft Edge");
    expect(result.browserVersion).toBe("126.0.0.0");
  });

  it("detects Safari with Version token", () => {
    const result = parseUserAgent(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15",
    );
    expect(result.browserName).toBe("Safari");
    expect(result.browserVersion).toBe("17.4");
  });

  it("falls back to Unknown for unrecognised agents", () => {
    const result = parseUserAgent("weird-agent/1.0");
    expect(result.browserName).toBe("Unknown browser");
    expect(result.browserVersion).toBe("");
  });
});

describe("environment snapshot", () => {
  it("captures the low-risk fields available in the current runtime", () => {
    const snapshot = captureEnvironmentSnapshot();
    expect(snapshot.capturedAt).toBeTruthy();
    expect(new Date(snapshot.capturedAt).getTime()).not.toBeNaN();
    expect(snapshot.browserName).toBeTruthy();
    expect(snapshot.userAgent).toBeTruthy();
    expect(snapshot.language).toBeTruthy();
    expect(snapshot.timezone).toBeTruthy();
    expect(typeof snapshot.viewportWidth).toBe("number");
    expect(typeof snapshot.devicePixelRatio).toBe("number");
    expect(snapshot.colorScheme).toMatch(/light|dark/);
    expect(typeof snapshot.reducedMotion).toBe("boolean");
    // The app must never populate these — they are not collected at all.
    expect(snapshot).not.toHaveProperty("geolocation");
    expect(snapshot).not.toHaveProperty("deviceSerial");
  });

  it("marks the platform as a browser-reported hint, not an exact OS", () => {
    const snapshot = captureEnvironmentSnapshot();
    expect(snapshot.platform).toMatch(/reported|hint|Unknown/);
  });
});
