/** Crop a uniform inset (0–0.25 of each side) from a photo before OCR. */
export async function cropInset(blob: Blob, inset: number): Promise<Blob> {
  const amount = Math.min(0.25, Math.max(0, inset));
  if (amount === 0) return blob;

  const bitmap = await createImageBitmap(blob);
  const x = Math.round(bitmap.width * amount);
  const y = Math.round(bitmap.height * amount);
  const width = Math.max(1, Math.round(bitmap.width * (1 - amount * 2)));
  const height = Math.max(1, Math.round(bitmap.height * (1 - amount * 2)));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) return blob;
  context.drawImage(bitmap, x, y, width, height, 0, 0, width, height);

  const cropped = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((next) => resolve(next), "image/jpeg", 0.92);
  });
  return cropped ?? blob;
}
