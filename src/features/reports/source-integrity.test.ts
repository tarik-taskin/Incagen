import { describe, expect, it } from "vitest";
import { verifySourceIntegrity } from "./source-integrity";

describe("verifySourceIntegrity - Web Crypto SHA-256 doğrulama", () => {
  it("geçerli SHA-256 hash ile eşleştiğinde true döner", async () => {
    // "hello world" metninin bilinen SHA-256 hash'i:
    // b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9
    const data = new TextEncoder().encode("hello world");
    const validHash = "b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9";

    const result = await verifySourceIntegrity(data, validHash);
    expect(result).toBe(true);

    // Büyük harfle verilen hash'i de kabul etmeli
    const upperResult = await verifySourceIntegrity(data, validHash.toUpperCase());
    expect(upperResult).toBe(true);
  });

  it("eşleşmeyen SHA-256 hash durumunda false döner", async () => {
    const data = new TextEncoder().encode("hello world");
    const invalidHash = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";

    const result = await verifySourceIntegrity(data, invalidHash);
    expect(result).toBe(false);
  });

  it("geçersiz veya boş hash parametresinde güvenle false döner", async () => {
    const data = new TextEncoder().encode("test data");
    expect(await verifySourceIntegrity(data, "")).toBe(false);
    expect(await verifySourceIntegrity(data, null as unknown as string)).toBe(false);
  });

  it("ArrayBuffer ve Uint8Array girdilerinin her ikisini de doğru işler", async () => {
    const uint8 = new TextEncoder().encode("incagen content");
    const hashBuffer = await crypto.subtle.digest("SHA-256", uint8.buffer);
    const expectedHex = Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    expect(await verifySourceIntegrity(uint8, expectedHex)).toBe(true);
    expect(await verifySourceIntegrity(uint8.buffer, expectedHex)).toBe(true);
  });
});
