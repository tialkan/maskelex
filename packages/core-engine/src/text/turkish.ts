// packages/core-engine/src/text/turkish.ts
// Türkçeye duyarlı büyük/küçük harf, katlama ve ses sınıfları. Saf fonksiyonlar, bağımlılık yok.

export const VOWELS = 'aeıioöuüâîû';
export const BACK_VOWELS = 'aıouâû';
export const ROUNDED_VOWELS = 'oöuüû';
/** Sert (ötümsüz) ünsüzler: "fıstıkçı şahap" */
export const VOICELESS = 'fstkçşhp';

export const trLower = (s: string): string => s.toLocaleLowerCase('tr-TR');
export const trUpper = (s: string): string => s.toLocaleUpperCase('tr-TR');

/** Eşleştirme anahtarı: Türkçe küçük harf + şapka kaldırma + ASCII katlama.
 *  "İSMAİL", "Ismail", "ISMAIL", "İsmail" hepsi "ismail" olur. */
export function foldKey(s: string): string {
  const lowered = trLower(s);
  let out = '';
  for (const ch of lowered) {
    switch (ch) {
      case 'ı': out += 'i'; break;
      case 'ğ': out += 'g'; break;
      case 'ü': case 'û': out += 'u'; break;
      case 'ş': out += 's'; break;
      case 'ö': out += 'o'; break;
      case 'ç': out += 'c'; break;
      case 'â': out += 'a'; break;
      case 'î': out += 'i'; break;
      default: out += ch;
    }
  }
  // "I" yanlışlıkla 'tr' dışı küçültülmüşse ("i̇" birleşik nokta) temizle
  return out.normalize('NFD').replace(/̇/g, '').normalize('NFC');
}

/** Uzunluk koruyan Türkçe küçük harf görünümü. İndeksler özgün metinle birebir aynı kalır.
 *  JS'in /i bayrağı "İ" (U+0130) harfini "i" ile eşlemez; bağlam desenleri HER ZAMAN bu görünümde,
 *  küçük harfli ve /i bayraksız yazılır. */
export function lowerView(text: string): string {
  let out = '';
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    const l = c.toLocaleLowerCase('tr-TR');
    out += l.length === 1 ? l : c;
  }
  return out;
}

export const isVowel = (ch: string): boolean => VOWELS.includes(ch);
export const isLetter = (ch: string | undefined): boolean => !!ch && /\p{L}/u.test(ch);
export const isDigit = (ch: string | undefined): boolean => !!ch && ch >= '0' && ch <= '9';
export const isAlnum = (ch: string | undefined): boolean => isLetter(ch) || isDigit(ch);

/** Lookbehind kullanmadan sınır denetimi (eski WebKit uyumu için regex'te (?<=) YASAK). */
export function leftBoundary(text: string, start: number, forbid: (ch: string) => boolean = isAlnum): boolean {
  return start === 0 || !forbid(text[start - 1]!);
}
export function rightBoundary(text: string, end: number, forbid: (ch: string) => boolean = isAlnum): boolean {
  return end >= text.length || !forbid(text[end]!);
}

/** Satırın (token'lar hariç) tamamen büyük harf olup olmadığı. Un-mask'ta büyük harf bağlamı için. */
export function isUppercaseContext(line: string): boolean {
  const letters = line.replace(/\[[^\]]*\]|《[^》]*》/g, '').match(/\p{L}/gu);
  if (!letters || letters.length < 4) return false;
  return letters.every((c) => c === trUpper(c));
}
