// packages/core-engine/src/validators/checksums.ts
// Sağlama algoritmaları. Girdi: yalnız rakamlardan (IBAN'da TR + rakam) oluşan, boşluksuz dize.

const digitsOf = (s: string): number[] => Array.from(s, (c) => c.charCodeAt(0) - 48);
/** JS'te % negatif sonuç verebilir: (-29 % 10) === -9. Her zaman bunu kullan. */
export const mod = (a: number, n: number): number => ((a % n) + n) % n;

/** TCKN ve YKN (99 ile başlar) için aynı algoritma. */
export function isValidTckn(s: string): boolean {
  if (!/^[1-9][0-9]{10}$/.test(s)) return false;
  const d = digitsOf(s);
  const odd = d[0]! + d[2]! + d[4]! + d[6]! + d[8]!;   // 1., 3., 5., 7., 9. haneler
  const even = d[1]! + d[3]! + d[5]! + d[7]!;          // 2., 4., 6., 8. haneler
  if (mod(odd * 7 - even, 10) !== d[9]) return false;
  const sum10 = d.slice(0, 10).reduce((a, b) => a + b, 0);
  return sum10 % 10 === d[10];
}
export const isYkn = (s: string): boolean => s.startsWith('99') && isValidTckn(s);

/** VKN (10 hane) resmi sağlama. */
export function isValidVkn(s: string): boolean {
  if (!/^[0-9]{10}$/.test(s)) return false;
  const d = digitsOf(s);
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    const tmp = (d[i]! + (9 - i)) % 10;               // 1. hane +9 ... 9. hane +1
    let p = (tmp * 2 ** (9 - i)) % 9;                 // 1. hane 2^9 ... 9. hane 2^1
    if (tmp !== 0 && p === 0) p = 9;
    sum += p;
  }
  return (10 - (sum % 10)) % 10 === d[9];
}

/** MERSİS (16 hane). Tüzel kişi: "0" + VKN(10) + 5 hane. Gerçek kişi: TCKN(11) + 5 hane.
 *  Son 5 hane için kamuya açık bir sağlama yok; gömülü kimlik numarası doğrulanır. */
export function mersisKind(s: string): 'TUZEL' | 'GERCEK' | null {
  if (!/^[0-9]{16}$/.test(s)) return null;
  if (s[0] === '0' && isValidVkn(s.slice(1, 11))) return 'TUZEL';
  if (s[0] !== '0' && isValidTckn(s.slice(0, 11))) return 'GERCEK';
  return null;
}

/** TR IBAN: 26 karakter, ISO 7064 MOD 97-10. Girdi boşluksuz, büyük harf. */
export function isValidTrIban(s: string): boolean {
  if (!/^TR[0-9]{24}$/.test(s)) return false;
  const rearranged = s.slice(4) + s.slice(0, 4);
  let rem = 0;
  for (const ch of rearranged) {
    const v = ch >= 'A' && ch <= 'Z' ? String(ch.charCodeAt(0) - 55) : ch; // A=10 ... T=29, R=27
    for (const c of v) rem = (rem * 10 + (c.charCodeAt(0) - 48)) % 97;
  }
  return rem === 1;
}

/** Luhn (kredi kartı). Girdi 13-19 hane. */
export function isValidLuhn(s: string): boolean {
  if (!/^[0-9]{13,19}$/.test(s)) return false;
  let sum = 0;
  let dbl = false;
  for (let i = s.length - 1; i >= 0; i--) {
    let n = s.charCodeAt(i) - 48;
    if (dbl) { n *= 2; if (n > 9) n -= 9; }
    sum += n;
    dbl = !dbl;
  }
  return sum % 10 === 0;
}

/** Kart ağı ön eki (IIN). Troy (9792) Türkiye'ye özgüdür. */
export function cardNetwork(s: string): 'VISA' | 'MASTERCARD' | 'AMEX' | 'TROY' | 'DIGER' | null {
  if (!isValidLuhn(s)) return null;
  if (/^4/.test(s)) return 'VISA';
  if (/^(5[1-5]|2(2[2-9][1-9]|2[3-9]\d|[3-6]\d\d|7[01]\d|720))/.test(s)) return 'MASTERCARD';
  if (/^3[47]/.test(s)) return 'AMEX';
  if (/^9792/.test(s)) return 'TROY';
  return 'DIGER';
}

// ---- Test verisi üreticileri (yalnız sentetik veri; gerçek kişi numarası test setine GİRMEZ) ----
export function makeTckn(first9: string): string {
  const d = digitsOf(first9);
  const odd = d[0]! + d[2]! + d[4]! + d[6]! + d[8]!;
  const even = d[1]! + d[3]! + d[5]! + d[7]!;
  const d10 = mod(odd * 7 - even, 10);
  const d11 = (d.reduce((a, b) => a + b, 0) + d10) % 10;
  return first9 + d10 + d11;
}
export function makeVkn(first9: string): string {
  for (let c = 0; c <= 9; c++) if (isValidVkn(first9 + c)) return first9 + c;
  throw new Error('unreachable');
}
export function makeTrIban(bank5: string, account16: string): string {
  const bban = bank5 + '0' + account16;
  for (let k = 2; k <= 98; k++) {
    const iban = 'TR' + String(k).padStart(2, '0') + bban;
    if (isValidTrIban(iban)) return iban;
  }
  throw new Error('unreachable');
}
