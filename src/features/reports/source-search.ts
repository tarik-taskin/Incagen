/// <reference lib="es2022.intl" />
export interface SourceMatchRange { start: number; end: number }

// Harf dönüşümü ve kanonik Unicode eşliğini sorgu başına hazırlar; kaynak metin hiçbir zaman değiştirilmez.
export function createSourceSearch(query: string, locale: string) {
  const fold = (text: string) => text.normalize("NFC").toLocaleLowerCase(locale);
  const needle = fold(query.trim());
  const segmenter = typeof Intl.Segmenter === "function" ? new Intl.Segmenter(locale, { granularity: "grapheme" }) : null;
  return {
    includes: (text: string) => !needle || fold(text).includes(needle),
    // Dönüşüm uzunluğu değişse bile vurgu özgün UTF-16/grapheme sınırlarına döner; HTML yorumlanmaz.
    ranges(text: string): SourceMatchRange[] {
      if (!needle || !segmenter) return [];
      const folded = fold(text), result: SourceMatchRange[] = [];
      if (!folded.includes(needle)) return result;
      const positions: SourceMatchRange[] = [];
      // Grapheme API'si yokken filtre çalışır; eksik bir Unicode parçalama taklidiyle yanlış vurgu yapılmaz.
      for (const { segment, index } of segmenter.segment(text)) {
        const range = { start: index, end: index + segment.length };
        for (let n = 0; n < fold(segment).length; n++) positions.push(range);
      }
      let at = folded.indexOf(needle);
      while (at >= 0) {
        const start = positions[at], end = positions[at + needle.length - 1];
        if (start && end) {
          const previous = result[result.length - 1];
          if (previous && start.start <= previous.end) previous.end = Math.max(previous.end, end.end);
          else result.push({ start: start.start, end: end.end });
        }
        at = folded.indexOf(needle, at + needle.length);
      }
      return result;
    },
  };
}
