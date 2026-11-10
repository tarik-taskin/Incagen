import { afterEach, describe, expect, it, vi } from "vitest";
import { getSupportConfig, sendSupportMessage, supportMailto } from "./support";

const message = { email: "person@example.test", topic: "issue" as const, message: "Açmak istediğim raporda bir sorun var." };
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe("destek teslimatı", () => {
  it.each(["account", "privacy"] as const)("%s konusunu servis ve e-posta taslağında korur", async topic => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true }), { status: 200 }));
    vi.stubGlobal("fetch", fetch);
    await sendSupportMessage({ ...message, topic }, "public-form-id", new AbortController().signal);
    expect(JSON.parse(fetch.mock.calls[0][1].body).subject).toBe(`Incagen Support — ${topic}`);
    expect(new URL(supportMailto("support@example.test", { ...message, topic })).searchParams.get("subject")).toBe(`Incagen Support — ${topic}`);
  });
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


describe("destek sınır ve iptal denetimleri", () => {
  it.each(["invalid", "a@example.test\r\nBcc:other@example.test", "a\u0000@example.test", `${"a".repeat(250)}@example.test`])("geçersiz adresi ağ isteğinden önce reddeder", async email => {
    const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
    await expect(sendSupportMessage({ ...message, email }, "public-form-id", new AbortController().signal)).rejects.toThrow("invalid");
    expect(fetch).not.toHaveBeenCalled();
  });
  it("boş veya uzun mesaj için gönderim denemez", async () => {
    const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
    for (const text of ["   ", "a".repeat(2_001)]) await expect(sendSupportMessage({ ...message, message: text }, "public-form-id", new AbortController().signal)).rejects.toThrow("invalid");
    expect(fetch).not.toHaveBeenCalled();
  });
  it("önceden iptal edilen isteği başlatmaz", async () => {
    const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
    const abort = new AbortController(); abort.abort();
    await expect(sendSupportMessage(message, "public-form-id", abort.signal)).rejects.toMatchObject({ name: "AbortError" });
    expect(fetch).not.toHaveBeenCalled();
  });
  it("iptali yok sayan geç servis yanıtını başarı saymaz ve yeniden denemez", async () => {
    const abort = new AbortController();
    const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => { abort.abort(); return { success: true }; } });
    vi.stubGlobal("fetch", fetch);
    await expect(sendSupportMessage(message, "public-form-id", abort.signal)).rejects.toMatchObject({ name: "AbortError" });
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
