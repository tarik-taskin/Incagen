const providerCalendar = new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", year: "numeric", month: "2-digit", day: "2-digit" });

// Gemini teşhisleri ve analiz denemeleri aynı sağlayıcı takvimini kullanır.
export function geminiQuotaDay(now: number) {
  const parts = Object.fromEntries(providerCalendar.formatToParts(now).map(({ type, value }) => [type, value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

// Pasifik günü iki İstanbul günüyle örtüşür. Geçişte iki eski sayaç da korunur.
export function legacyProviderQuotaDays(day: string) {
  const following = new Date(Date.parse(`${day}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
  return [day, following];
}

// Yerel günün sonraki başlangıcını yaz saati değişimleri dahil milisaniyeye kadar bulur.
export function nextQuotaReset(now: number, dayFor: (time: number) => string) {
  const day = dayFor(now);
  let low = now, high = now + 27 * 60 * 60_000;
  while (high - low > 1) {
    const mid = low + Math.floor((high - low) / 2);
    if (dayFor(mid) === day) low = mid;
    else high = mid;
  }
  return high;
}
