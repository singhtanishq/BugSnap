import type { EnvironmentSnapshot } from "@/types/report";

/**
 * Local, low-risk environment feature detection.
 *
 * Everything here is read from standard browser APIs. Values the browser
 * does not expose reliably are left undefined and the UI labels remaining
 * values as "browser-reported". Nothing network-dependent, no geolocation,
 * no account identifiers, no history.
 */

interface UaData {
  browserName: string;
  browserVersion: string;
  platform: string;
}

interface NavigatorUAData {
  brands?: Array<{ brand: string; version: string }>;
  platform?: string;
}

export function parseUserAgent(ua: string): UaData {
  // Order matters: Edges and OPers report Chrome engines too.
  const rules: Array<[RegExp, string]> = [
    [/Edg\/([\d.]+)/, "Microsoft Edge"],
    [/OPR\/([\d.]+)/, "Opera"],
    [/Firefox\/([\d.]+)/, "Firefox"],
    [/FxiOS\/([\d.]+)/, "Firefox iOS"],
    [/Chrome\/([\d.]+)/, "Chrome"],
    [/Version\/([\d.]+).*Safari/, "Safari"],
    [/Safari\/([\d.]+)/, "Safari"],
  ];
  for (const [re, name] of rules) {
    const match = ua.match(re);
    if (match) {
      return { browserName: name, browserVersion: match[1] ?? "", platform: "" };
    }
  }
  return { browserName: "Unknown browser", browserVersion: "", platform: "" };
}

function detectPlatformHint(ua: string, nav: Navigator): string {
  const navData = (nav as Navigator & { userAgentData?: NavigatorUAData }).userAgentData;
  if (navData?.platform) return `${navData.platform} (browser-reported)`;
  const table: Array<[RegExp, string]> = [
    [/Macintosh|Mac OS X/, "macOS (user-agent hint)"],
    [/Windows/, "Windows (user-agent hint)"],
    [/CrOS/, "ChromeOS (user-agent hint)"],
    [/Android/, "Android (user-agent hint)"],
    [/iPhone|iPad|iPod/, "iOS/iPadOS (user-agent hint)"],
    [/Linux/, "Linux (user-agent hint)"],
  ];
  for (const [re, label] of table) {
    if (re.test(ua)) return label;
  }
  return "Unknown platform";
}

export function captureEnvironmentSnapshot(): EnvironmentSnapshot {
  const nav = typeof navigator !== "undefined" ? navigator : undefined;
  const win = typeof window !== "undefined" ? window : undefined;

  const userAgent = nav?.userAgent ?? "";
  const uaInfo = parseUserAgent(userAgent);
  const prefersReducedMotion = win
    ? win.matchMedia("(prefers-reduced-motion: reduce)").matches
    : false;
  const colorScheme = win?.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : win
      ? "light"
      : undefined;

  return {
    capturedAt: new Date().toISOString(),
    browserName: uaInfo.browserName,
    browserVersion: uaInfo.browserVersion || undefined,
    userAgent: userAgent || undefined,
    platform: detectPlatformHint(userAgent, nav ?? ({} as Navigator)),
    viewportWidth: win?.innerWidth,
    viewportHeight: win?.innerHeight,
    screenWidth: nav ? (win?.screen?.width ?? undefined) : undefined,
    screenHeight: nav ? (win?.screen?.height ?? undefined) : undefined,
    devicePixelRatio: win?.devicePixelRatio,
    language: nav?.language,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    online: nav?.onLine,
    colorScheme,
    reducedMotion: prefersReducedMotion,
    touchPoints: nav?.maxTouchPoints,
  };
}
