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
