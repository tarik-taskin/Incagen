import { PARSING_LIMITS, type DocumentChunk } from "../contracts";
import { createParsedDocument, DocumentParseError, type ParserInput } from "./common";

interface ImageInfo { mime: string; width: number; height: number }

// PNG başlığından boyutları okur ve temel imzayı doğrular.
function readPng(data: Buffer): ImageInfo | null {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (data.length < 45 || !data.subarray(0, 8).equals(signature) || data.readUInt32BE(8) !== 13 || data.subarray(12, 16).toString("ascii") !== "IHDR" || !data.includes(Buffer.from("IEND"))) return null;
  return { mime: "image/png", width: data.readUInt32BE(16), height: data.readUInt32BE(20) };
}

// JPEG segmentlerini yalnız boyut veren SOF kaydına kadar güvenli sınırlarla tarar.
function readJpeg(data: Buffer): ImageInfo | null {
  if (data.length < 4 || data[0] !== 0xff || data[1] !== 0xd8 || data[data.length - 2] !== 0xff || data[data.length - 1] !== 0xd9) return null;
  const sof = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);
  let offset = 2;
  while (offset + 4 <= data.length) {
    if (data[offset] !== 0xff) { offset += 1; continue; }
    while (data[offset] === 0xff) offset += 1;
    const marker = data[offset++];
    if (marker === 0xd9 || marker === 0xda) break;
    if (offset + 2 > data.length) break;
    const length = data.readUInt16BE(offset);
    if (length < 2 || offset + length > data.length) break;
    if (sof.has(marker) && length >= 7) return { mime: "image/jpeg", height: data.readUInt16BE(offset + 3), width: data.readUInt16BE(offset + 5) };
    offset += length;
  }
  return null;
}

// WebP VP8/VP8L/VP8X başlıklarından tuval boyutlarını çıkarır.
function readWebp(data: Buffer): ImageInfo | null {
  if (data.length < 30 || data.subarray(0, 4).toString("ascii") !== "RIFF" || data.readUInt32LE(4) + 8 > data.length || data.subarray(8, 12).toString("ascii") !== "WEBP") return null;
  const kind = data.subarray(12, 16).toString("ascii");
  if (kind === "VP8X") {
    const width = 1 + data.readUIntLE(24, 3);
    const height = 1 + data.readUIntLE(27, 3);
    return { mime: "image/webp", width, height };
  }
  if (kind === "VP8L" && data[20] === 0x2f) {
    const width = 1 + (data[21] | ((data[22] & 0x3f) << 8));
    const height = 1 + ((data[22] >> 6) | (data[23] << 2) | ((data[24] & 0x0f) << 10));
    return { mime: "image/webp", width, height };
  }
  if (kind === "VP8 " && data.subarray(23, 26).equals(Buffer.from([0x9d, 0x01, 0x2a]))) {
    return { mime: "image/webp", width: data.readUInt16LE(26) & 0x3fff, height: data.readUInt16LE(28) & 0x3fff };
  }
  return null;
}

// Görsel imzasını ve boyutlarını doğrular; içerik açıklamasını sonraki AI aşamasına bırakır.
export function parseImageDocument(input: ParserInput) {
  const info = readPng(input.data) ?? readJpeg(input.data) ?? readWebp(input.data);
  if (!info || info.width <= 0 || info.height <= 0) throw new DocumentParseError("Görsel başlığı bozuk veya uzantıyla uyumlu değil.");
  const expected = input.extension === "png" ? "image/png" : input.extension === "webp" ? "image/webp" : "image/jpeg";
  if (info.mime !== expected) throw new DocumentParseError("Görsel içeriği dosya uzantısıyla eşleşmiyor.");
  if (info.width * info.height > PARSING_LIMITS.imagePixels) throw new DocumentParseError("Görsel piksel sınırını aşıyor.");
  const chunks: DocumentChunk[] = [{ id: `${input.sourceId}:image:0001`, kind: "image", locator: { section: "tam-görsel" } }];
  return createParsedDocument(input, info.mime, chunks, { width: info.width, height: info.height }, ["Görsel metni ve görsel anlamı sonraki AI/OCR aşamasında çıkarılacak."]);
}
