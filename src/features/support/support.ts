export const supportTopics = ["question", "issue", "feedback"] as const;
export type SupportTopic = typeof supportTopics[number];
export interface SupportMessage { email: string; topic: SupportTopic; message: string }

// Yalnız herkese açık form kimliğini ve iletişim adresini okur; Gmail parolası veya sunucu sırrı kullanmaz.
export function getSupportConfig() {
  const address = (import.meta.env.VITE_SUPPORT_EMAIL ?? "").trim();
  const accessKey = (import.meta.env.VITE_WEB3FORMS_ACCESS_KEY ?? "").trim();
  return { email: /^[^\s@<>\r\n]+@[^\s@<>\r\n]+\.[^\s@<>\r\n]+$/.test(address) ? address : "", accessKey: /^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i.test(accessKey) ? accessKey : "" };
}

// E-posta uygulamasına yalnız kullanıcının yazdığı mesajı taşır; gönderilmiş gibi başarı üretmez.
export function supportMailto(address: string, message?: SupportMessage) {
  const params = new URLSearchParams({ subject: "Incagen Support", ...(message ? { body: `${message.message}\n\n${message.email}` } : {}) });
  return `mailto:${address}?${params.toString().replace(/\+/g, "%20")}`;
}

// Başarıyı hem HTTP hem servis yanıtından doğrular; belirsiz ağ sonucunu başarılı gönderim saymaz.
export async function sendSupportMessage(message: SupportMessage, accessKey: string, signal: AbortSignal) {
  if (!message.email.trim() || !message.message.trim() || message.message.length > 2_000 || !supportTopics.includes(message.topic) || !accessKey) throw new Error("invalid");
  const response = await fetch("https://api.web3forms.com/submit", { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, signal, body: JSON.stringify({ access_key: accessKey, from_name: "Incagen Support", subject: `Incagen Support — ${message.topic}`, email: message.email.trim(), message: message.message.trim() }) });
  const result: unknown = await response.json();
  if (!response.ok || typeof result !== "object" || result === null || !("success" in result) || result.success !== true) throw new Error(response.status === 429 ? "rate-limit" : "delivery");
}
