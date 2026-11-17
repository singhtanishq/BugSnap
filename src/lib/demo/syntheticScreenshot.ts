/**
 * Synthetic screenshot generator for the BugSnap sample report.
 *
 * Draws a fictional "Aurora Notes" settings screen (no real product, no real
 * person, no real hostname) on a canvas and returns PNG bytes. The drawn
 * defect — a disabled Save button plus a misaligned toggle — matches the
 * sample bug report narrative.
 */

export const SAMPLE_IMAGE_WIDTH = 1280;
export const SAMPLE_IMAGE_HEIGHT = 800;

const INK = "#101a2e";
const MUTED = "#5d6d88";
const BORDER = "#d4dae3";
const ACCENT = "#0d9488";
const RED = "#dc2626";

export interface SynthScreenshotResult {
  blob: Blob;
  width: number;
  height: number;
}

export async function generateSampleScreenshot(): Promise<SynthScreenshotResult> {
  const canvas = document.createElement("canvas");
  canvas.width = SAMPLE_IMAGE_WIDTH;
  canvas.height = SAMPLE_IMAGE_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Canvas 2D context unavailable for sample screenshot generation");
  }

  // Page background
  ctx.fillStyle = "#f6f8fa";
  ctx.fillRect(0, 0, SAMPLE_IMAGE_WIDTH, SAMPLE_IMAGE_HEIGHT);

  // App sidebar
  ctx.fillStyle = "#101a2e";
  ctx.fillRect(0, 0, 240, SAMPLE_IMAGE_HEIGHT);
  ctx.fillStyle = "#ffffff";
  ctx.font = "600 20px system-ui, sans-serif";
  ctx.fillText("Aurora Notes", 24, 40);
  const navItems = ["Notes", "Shared", "Archive", "Settings"];
  ctx.font = "14px system-ui, sans-serif";
  navItems.forEach((item, index) => {
    const isActive = item === "Settings";
    ctx.fillStyle = isActive ? "#14b8a6" : "#8593a8";
    if (isActive) {
      ctx.fillStyle = "#0f766e";
      ctx.fillRect(16, 72 + index * 40, 208, 32);
      ctx.fillStyle = "#ccfbf1";
    } else {
      ctx.fillStyle = "#8593a8";
    }
    ctx.fillText(item, 32, 94 + index * 40);
  });

  // Main content panel
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(240, 0, SAMPLE_IMAGE_WIDTH - 240, SAMPLE_IMAGE_HEIGHT);
  ctx.fillStyle = INK;
  ctx.font = "600 24px system-ui, sans-serif";
  ctx.fillText("Profile settings", 288, 64);
  ctx.fillStyle = MUTED;
  ctx.font = "14px system-ui, sans-serif";
  ctx.fillText("Manage how your profile appears to teammates.", 288, 92);

  // Form fields
  drawField(ctx, 288, 140, "Display name", "Riley Park");
  drawField(ctx, 288, 230, "Email", "riley@aurora-notes.test");
  drawField(ctx, 288, 320, "Team", "Platform Infrastructure");

  // Toggle row with the deliberately misaligned switch (the visual defect)
  ctx.fillStyle = INK;
  ctx.font = "600 15px system-ui, sans-serif";
  ctx.fillText("Weekly digest email", 288, 425);
  ctx.fillStyle = MUTED;
  ctx.font = "13px system-ui, sans-serif";
  ctx.fillText("Receive a summary of shared notes every Monday.", 288, 447);
  // Track
  ctx.fillStyle = ACCENT;
  roundRect(ctx, 900, 408, 44, 24, 12);
  ctx.fill();
  // Knob drawn off-center — intentionally broken alignment
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(908, 421, 9, 0, Math.PI * 2);
  ctx.fill();

  // Error banner (the functional defect context)
  ctx.fillStyle = "#fef2f2";
  roundRect(ctx, 288, 500, 560, 56, 10);
  ctx.fill();
  ctx.strokeStyle = "#fecaca";
  ctx.stroke();
  ctx.fillStyle = RED;
  ctx.font = "600 14px system-ui, sans-serif";
  ctx.fillText("Changes could not be saved. Save is unavailable.", 308, 533);

  // Disabled Save button
  ctx.fillStyle = "#e9edf2";
  roundRect(ctx, 288, 600, 120, 40, 8);
  ctx.fill();
  ctx.fillStyle = "#8593a8";
  ctx.font = "600 14px system-ui, sans-serif";
  ctx.fillText("Save", 330, 625);

  ctx.fillStyle = MUTED;
  ctx.font = "12px system-ui, sans-serif";
  ctx.fillText("aurora-notes.test/settings/profile — fictional sample application", 288, 760);

  return await canvasToPng(canvas);
}

function drawField(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  label: string,
  value: string,
) {
  ctx.fillStyle = INK;
  ctx.font = "600 14px system-ui, sans-serif";
  ctx.fillText(label, x, y);
  ctx.fillStyle = "#ffffff";
  roundRect(ctx, x, y + 12, 560, 40, 8);
  ctx.fill();
  ctx.strokeStyle = BORDER;
  ctx.stroke();
  ctx.fillStyle = INK;
  ctx.font = "14px system-ui, sans-serif";
  ctx.fillText(value, x + 14, y + 37);
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export async function canvasToPng(canvas: HTMLCanvasElement): Promise<{
  blob: Blob;
  width: number;
  height: number;
}> {
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((b) => resolve(b), "image/png"),
  );
  if (!blob) throw new Error("Failed to encode sample screenshot to PNG");
  return { blob, width: canvas.width, height: canvas.height };
}
