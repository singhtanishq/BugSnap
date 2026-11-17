import { inflateSync } from "node:zlib";

/**
 * Minimal PNG decoder for test verification only (truecolor RGBA PNGs).
 * Enough to read real pixels out of BugSnap's exported evidence: parse
 * chunks, inflate the image data, and undo scanline filters 0-4.
 */

export interface DecodedPng {
  width: number;
  height: number;
  /** RGBA bytes, row-major, filters already undone. */
  pixels: Uint8Array;
}

interface Chunk {
  type: string;
  data: Buffer;
}

function parseChunks(buffer: Buffer): Chunk[] {
  const chunks: Chunk[] = [];
  let offset = 8; // skip PNG signature
  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.subarray(offset + 4, offset + 8).toString("ascii");
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    chunks.push({ type, data });
    offset += 12 + length;
    if (type === "IEND") break;
  }
  return chunks;
}

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

export function decodePng(buffer: Buffer): DecodedPng {
  const signature = buffer.subarray(0, 8);
  const expected = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (!signature.equals(expected)) {
    throw new Error("Not a PNG file");
  }

  const chunks = parseChunks(buffer);
  const ihdr = chunks.find((c) => c.type === "IHDR");
  if (!ihdr) throw new Error("Missing IHDR chunk");
  const width = ihdr.data.readUInt32BE(0);
  const height = ihdr.data.readUInt32BE(4);
  const bitDepth = ihdr.data.readUInt8(8);
  const colorType = ihdr.data.readUInt8(9);
  if (bitDepth !== 8) throw new Error(`Unsupported bit depth ${bitDepth}`);
  if (colorType !== 6) {
    throw new Error(`Unsupported color type ${colorType} (expected 6 = truecolor+alpha)`);
  }

  const idat = Buffer.concat(chunks.filter((c) => c.type === "IDAT").map((c) => c.data));
  const raw = inflateSync(idat);
  const bytesPerRow = width * 4;
  const pixels = new Uint8Array(width * height * 4);

  let offset = 0;
  for (let y = 0; y < height; y += 1) {
    const filter = raw[offset];
    offset += 1;
    const row = raw.subarray(offset, offset + bytesPerRow);
    offset += bytesPerRow;
    const prevStart = (y - 1) * bytesPerRow;
    for (let x = 0; x < bytesPerRow; x += 1) {
      const left = x >= 4 ? (pixels[y * bytesPerRow + x - 4] ?? 0) : 0;
      const up = y > 0 ? (pixels[prevStart + x] ?? 0) : 0;
      const upLeft = y > 0 && x >= 4 ? (pixels[prevStart + x - 4] ?? 0) : 0;
      let value = row[x] ?? 0;
      switch (filter) {
        case 0:
          break;
        case 1:
          value = (value + left) & 0xff;
          break;
        case 2:
          value = (value + up) & 0xff;
          break;
        case 3:
          value = (value + Math.floor((left + up) / 2)) & 0xff;
          break;
        case 4:
          value = (value + paeth(left, up, upLeft)) & 0xff;
          break;
        default:
          throw new Error(`Unsupported PNG filter ${filter}`);
      }
      pixels[y * bytesPerRow + x] = value;
    }
  }

  return { width, height, pixels };
}

export function pixelAt(png: DecodedPng, x: number, y: number): [number, number, number, number] {
  const index = (y * png.width + x) * 4;
  return [png.pixels[index]!, png.pixels[index + 1]!, png.pixels[index + 2]!, png.pixels[index + 3]!];
}
