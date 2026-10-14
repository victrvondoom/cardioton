import { randomUUID } from "node:crypto";
import { fromBuffer } from "pdf2pic";
import { uploadToS3 } from "./s3";

/** Convert every PDF page into a PNG and upload it to S3. */
export async function convertPdfToImagesAndUpload(
  pdfBuffer: Buffer,
  bucketName: string,
  baseS3Folder: string,
): Promise<string[]> {
  const converter = fromBuffer(pdfBuffer, {
    density: 150,
    format: "png",
    width: 1024,
    height: 1024,
  });
  const pages = await converter.bulk(-1, { responseType: "buffer" });
  const imageUrls: string[] = [];

  for (const [index, page] of pages.entries()) {
    if (!page.buffer) {
      throw new Error(`PDF page ${index + 1} could not be converted`);
    }
    const key = `${baseS3Folder}/page-${index + 1}-${randomUUID()}.png`;
    imageUrls.push(await uploadToS3(bucketName, key, page.buffer, "image/png"));
  }

  return imageUrls;
}
