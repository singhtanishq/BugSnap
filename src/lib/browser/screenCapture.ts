/**
 * User-initiated still-frame screen capture via getDisplayMedia.
 *
 * Privacy and safety contract:
 * - Capture begins only after an explicit user click on a labelled control.
 * - The browser's own chooser (screen / window / tab) decides what is shared;
 *   this code never bypasses it.
 * - Every media track is stopped immediately after the still frame is
 *   extracted, on error, and on cancellation. No stream is retained.
 * - Captured frames stay in memory; nothing is uploaded.
 */

export type ScreenCaptureFailureReason =
  | "unsupported"
  | "insecure-context"
  | "denied"
  | "cancelled"
  | "no-frame"
  | "error";

export type ScreenCaptureOutcome =
  | { ok: true; blob: Blob; width: number; height: number }
  | { ok: false; reason: ScreenCaptureFailureReason; message: string };

export function isScreenCaptureSupported(): boolean {
  return (
    typeof navigator !== "undefined" &&
    typeof navigator.mediaDevices?.getDisplayMedia === "function" &&
    typeof window !== "undefined" &&
    window.isSecureContext === true
  );
}

function failure(
  reason: ScreenCaptureFailureReason,
  message: string,
): ScreenCaptureOutcome {
  return { ok: false, reason, message };
}

/** Extract one still frame from a fresh display stream. */
export async function captureScreenStill(): Promise<ScreenCaptureOutcome> {
  if (!isScreenCaptureSupported()) {
    if (typeof window !== "undefined" && window.isSecureContext === false) {
      return failure(
        "insecure-context",
        "Screen capture requires a secure (HTTPS or localhost) context.",
      );
    }
    return failure(
      "unsupported",
      "This browser does not support screen capture. Upload or paste a screenshot instead.",
    );
  }

  let stream: MediaStream | null = null;
  try {
    stream = await navigator.mediaDevices.getDisplayMedia({
      video: { frameRate: 30 },
      audio: false,
    });

    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;

    const frameReady = await new Promise<boolean>((resolve) => {
      let settled = false;
      const done = (ok: boolean) => {
        if (!settled) {
          settled = true;
          resolve(ok);
        }
      };
      video.onloadeddata = () => done(true);
      video.onerror = () => done(false);
      // Some platforms never fire loadeddata for hidden videos; time out.
      setTimeout(() => done(video.readyState >= 2), 3000);
      video.srcObject = stream;
      video.play().catch(() => done(false));
    });

    if (!frameReady || video.videoWidth === 0 || video.videoHeight === 0) {
      return failure(
        "no-frame",
        "No frame could be read from the selected source. Try again or take a manual screenshot and upload it.",
      );
    }

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return failure("error", "Canvas is unavailable in this browser.");
    }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), "image/png"),
    );
    if (!blob) {
      return failure("error", "The captured frame could not be encoded to PNG.");
    }

    return { ok: true, blob, width: canvas.width, height: canvas.height };
  } catch (error) {
    const name = error instanceof DOMException ? error.name : "";
    if (name === "NotAllowedError") {
      return failure(
        "denied",
        "Capture was denied or dismissed. Nothing was recorded. You can retry — the browser will show its screen/window/tab chooser again.",
      );
    }
    if (name === "NotFoundError") {
      return failure(
        "error",
        "No capture source is available on this device.",
      );
    }
    return failure(
      "error",
      "Screen capture failed. Nothing was recorded or stored.",
    );
  } finally {
    // Stop every track on every path: success, failure, cancellation.
    stream?.getTracks().forEach((track) => track.stop());
    stream = null;
  }
}
