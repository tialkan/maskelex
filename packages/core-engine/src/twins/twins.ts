// packages/core-engine/src/twins/twins.ts
// Fonetik İkiz: özgün adla AYNI ek davranışını gösteren sentetik ad seçer.
// Ek davranışını belirleyen anahtar = (son ünlünün 4'lü uyum sınıfı, son ses türü, n kaynaştırması).
// Bu üçlü aynıysa LLM'in ikize yazdığı ek, özgün ada da doğrudan uyar. Anahtar tutmazsa ikiz VERİLMEZ (etiket moduna düşülür).

import { foldKey } from '../text/turkish';
import { profileOf } from '../morphology/morphology';
import type { Gender, RandomSource } from '../types/contracts';

export interface TwinLexiconEntry { readonly text: string; readonly kind: 'AD' | 'SOYAD' | 'SIRKET_CEKIRDEK'; readonly gender: Gender }
export interface TwinPersonInput { readonly id: string; readonly given: string; readonly surname: string; readonly gender: Gender }
export interface TwinResult { readonly full: string; readonly given: string; readonly surname: string; readonly display: string }

export const phonKey = (word: string): string => {
  const p = profileOf(word);
  return `${p.harmony}|${p.final}|${p.pronominalN ? 'n' : '-'}`;
};

export function makeTwinPicker(lexicon: readonly TwinLexiconEntry[], rng: RandomSource, reserved: readonly string[]) {
  // Belgedeki gerçek ad ve soyadların HER sözcüğü ayrı ayrı dışlanır: gerçek bir ad asla ikiz olamaz.
  const used = new Set(reserved.flatMap((r) => r.split(/\s+/)).filter(Boolean).map(foldKey));
  const byKey = new Map<string, TwinLexiconEntry[]>();
  for (const e of lexicon) {
    const k = `${e.kind}#${phonKey(e.text)}`;
    (byKey.get(k) ?? byKey.set(k, []).get(k)!).push(e);
  }
  const pick = (kind: TwinLexiconEntry['kind'], original: string, gender: Gender): string | null => {
    const pool = (byKey.get(`${kind}#${phonKey(original)}`) ?? []).filter((e) => !used.has(foldKey(e.text)));
    const sameGender = pool.filter((e) => gender === 'U' || e.gender === 'U' || e.gender === gender);
    const cands = sameGender.length ? sameGender : (kind === 'AD' ? [] : pool);   // ad için cinsiyet gevşetilmez
    if (!cands.length) return null;
    const chosen = cands[rng.nextUint32() % cands.length]!;
    used.add(foldKey(chosen.text));
    return chosen.text;
  };
  const surnameMap = new Map<string, string>();              // aynı özgün soyadı → aynı ikiz soyadı (aile ilişkisi korunur)

  /** Kişi ikizi; uygun aday yoksa null (o varlık etiket modunda kalır). */
  const person = (p: TwinPersonInput): TwinResult | null => {
    const sk = foldKey(p.surname);
    const surname = surnameMap.get(sk) ?? pick('SOYAD', p.surname, 'U');
    if (!surname) return null;
    const given = pick('AD', p.given, p.gender);
    if (!given) return null;
    surnameMap.set(sk, surname);
    const full = `${given} ${surname}`;
    return { full, given, surname, display: `《${full}》` };
  };
  const familySurname = (originalSurname: string): string | undefined => surnameMap.get(foldKey(originalSurname));
  return { person, familySurname, pick };
}
