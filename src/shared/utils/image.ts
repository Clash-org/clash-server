import sharp from "sharp";

export async function convertToWebP(buffer: ArrayBuffer): Promise<Buffer> {
  return sharp(Buffer.from(buffer))
    .webp({ quality: 85, effort: 4 })
    .toBuffer();
}