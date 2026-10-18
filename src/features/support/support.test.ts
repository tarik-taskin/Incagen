import { afterEach, describe, expect, it, vi } from "vitest";
import { getSupportConfig, sendSupportMessage, supportMailto } from "./support";

const message = { email: "person@example.test", topic: "issue" as const, message: "Açmak istediğim raporda bir sorun var." };
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe("destek teslimatı", () => {
  it("sunucu veya HTTP reddini başarılı gönderim saymaz", async () => {
    const fetch = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ success: false }), { status: 200 })).mockResolvedValueOnce(new Response(JSON.stringify({ success: true }), { status: 429 })).mockResolvedValueOnce(new Response("not json", { status: 502 }));
    vi.stubGlobal("fetch", fetch);
    for (let n = 0; n < 3; n++) await expect(sendSupportMessage(message, "public-form-id", new AbortController().signal)).rejects.toThrow();
  });
  it("yalnız kullanıcının yazdığı alanları doğrulanmış başarıyla iletir", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true }), { status: 200 }));
    vi.stubGlobal("fetch", fetch);
    await sendSupportMessage(message, "public-form-id", new AbortController().signal);
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ access_key: "public-form-id", from_name: "Incagen Support", subject: "Incagen Support — issue", email: message.email, message: message.message });
  });
  it("yapılandırma yokken istek göndermez; e-posta taslağında özel karakterleri korur", async () => {
    vi.stubEnv("VITE_SUPPORT_EMAIL", "bad\r\n@example.test");
    vi.stubEnv("VITE_WEB3FORMS_ACCESS_KEY", "placeholder");
    expect(getSupportConfig()).toEqual({ email: "", accessKey: "" });
    const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
    await expect(sendSupportMessage(message, "", new AbortController().signal)).rejects.toThrow();
    expect(fetch).not.toHaveBeenCalled();
    const href = supportMailto("support@example.test", { ...message, message: "A & B? #Kaynak\nİkinci satır" });
    expect(new URL(href).searchParams.get("body")).toBe("A & B? #Kaynak\nİkinci satır\n\nperson@example.test");
  });
});
