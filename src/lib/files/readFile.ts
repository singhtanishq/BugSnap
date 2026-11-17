/**
 * Read a File/Blob as text, using Blob.text() where available and falling
 * back to FileReader for environments without it. Read failures surface as
 * errors instead of hanging silently.
 */
export async function readFileAsText(file: Blob): Promise<string> {
  if (typeof file.text === "function") {
    return await file.text();
  }
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("The file could not be read."));
    reader.readAsText(file);
  });
}

/** Read a Blob's bytes as Uint8Array with a FileReader fallback. */
export async function readBlobAsBytes(blob: Blob): Promise<Uint8Array> {
  if (typeof blob.arrayBuffer === "function") {
    return new Uint8Array(await blob.arrayBuffer());
  }
  return await new Promise<Uint8Array>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
    reader.onerror = () => reject(new Error("The file could not be read."));
    reader.readAsArrayBuffer(blob);
  });
}
