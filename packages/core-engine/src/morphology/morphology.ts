// packages/core-engine/src/morphology/morphology.ts
// Türkçe çekim eki motoru: (1) bir yüzey biçimin ses profili, (2) LLM'in yazdığı eki biçimbirimlere ayrıştırma,
// (3) biçimbirimleri özgün varlığın profiline göre yeniden üretme. Tamamen deterministik.

import { trLower, trUpper, VOWELS, VOICELESS } from '../text/turkish';
import { lastSpokenWord } from '../text/numberWords';
import type { HarmonyVowel, FinalSound, Confidence, PhonSource, PhonProfile, Morpheme, SuffixRealization } from '../types/contracts';

/** Arşifonemik kalıplar. (x): yalnız ünlüden sonra gelen kaynaştırma ünsüzü. I: 4'lü uyum. A: 2'li uyum.
 *  D: d/t. C: c/ç. Diğer harfler sabittir. */
const TEMPLATE: Record<Morpheme, string> = {
  PL: 'lAr', POSS: '(s)I', GEN: '(n)In', ACC: '(y)I', DAT: '(y)A', LOC: 'DA', ABL: 'DAn',
  INS: '(y)lA', EQU: 'CA', KI: 'ki', DIR: 'DIr', DI: '(y)DI', MIS: '(y)mIş', SA: '(y)sA',
  KEN: '(y)ken', LI: 'lI', SIZ: 'sIz',
};
/** 3. tekil iyelikten sonra (veya pronominalN gövdede) durum ekleri: şirketi-nin, -ni, -ne, -nde, -nden, -nce */
const TEMPLATE_N: Partial<Record<Morpheme, string>> = {
  GEN: 'nIn', ACC: 'nI', DAT: 'nA', LOC: 'ndA', ABL: 'ndAn', EQU: 'ncA',
};
const CASES: ReadonlySet<Morpheme> = new Set(['GEN', 'ACC', 'DAT', 'LOC', 'ABL', 'INS', 'EQU']);
const COPULAS: ReadonlySet<Morpheme> = new Set(['DIR', 'DI', 'MIS', 'SA', 'KEN']);

export const harmonyOf = (v: string): HarmonyVowel =>
  'aıâ'.includes(v) ? 'ı' : 'ouû'.includes(v) ? 'u' : 'eiî'.includes(v) ? 'i' : 'ü';
const isBack = (h: HarmonyVowel): boolean => h === 'ı' || h === 'u';

interface PState { harmony: HarmonyVowel; final: FinalSound }

function pushChar(st: PState, ch: string): PState {
  if (VOWELS.includes(ch)) return { harmony: harmonyOf(ch), final: 'VOWEL' };
  return { harmony: st.harmony, final: VOICELESS.includes(ch) ? 'VOICELESS' : 'VOICED' };
}

function realizeTemplate(tpl: string, st0: PState): { text: string; st: PState } {
  let st = st0;
  let out = '';
  for (let i = 0; i < tpl.length; i++) {
    const c = tpl[i]!;
    let emit = '';
    if (c === '(') { const buf = tpl[i + 1]!; i += 2; if (st.final === 'VOWEL') emit = buf; }
    else if (c === 'I') emit = st.harmony;
    else if (c === 'A') emit = isBack(st.harmony) ? 'a' : 'e';
    else if (c === 'D') emit = st.final === 'VOICELESS' ? 't' : 'd';
    else if (c === 'C') emit = st.final === 'VOICELESS' ? 'ç' : 'c';
    else emit = c;
    if (emit) { out += emit; st = pushChar(st, emit); }
  }
  return { text: out, st };
}

/** Biçimbirim dizisini verilen gövde profiline göre yüzeye döker. */
export function realize(morphs: readonly Morpheme[], stem: Pick<PhonProfile, 'harmony' | 'final' | 'pronominalN'>): string {
  let st: PState = { harmony: stem.harmony, final: stem.final };
  let nBuffer = stem.pronominalN;
  let out = '';
  for (const m of morphs) {
    const tpl = (nBuffer && TEMPLATE_N[m]) || TEMPLATE[m];
    const r = realizeTemplate(tpl, st);
    out += r.text; st = r.st;
    nBuffer = m === 'POSS';
  }
  return out;
}

// ---------- Ayrıştırma ----------
const ALL_STATES: PState[] = (['ı', 'i', 'u', 'ü'] as HarmonyVowel[]).flatMap((h) =>
  (['VOWEL', 'VOICED', 'VOICELESS'] as FinalSound[]).map((f) => ({ harmony: h, final: f })));

/** Her biçimbirimin olası tüm yüzeyleri (tüm bağlamların birleşimi). */
const SURFACES: Map<Morpheme, Set<string>> = (() => {
  const m = new Map<Morpheme, Set<string>>();
  for (const key of Object.keys(TEMPLATE) as Morpheme[]) {
    const set = new Set<string>();
    for (const st of ALL_STATES) {
      set.add(realizeTemplate(TEMPLATE[key], st).text);
      const n = TEMPLATE_N[key];
      if (n) set.add(realizeTemplate(n, st).text);
    }
    m.set(key, set);
  }
  return m;
})();

type Slot = 'START' | 'DERIV' | 'PL' | 'POSS' | 'CASE' | 'KI' | 'PL2' | 'CASE2' | 'COP';
function nextSlot(from: Slot, m: Morpheme, prev: Morpheme | null): Slot | null {
  const isCase = CASES.has(m);
  const isCop = COPULAS.has(m);
  switch (from) {
    case 'START':
      if (m === 'LI' || m === 'SIZ') return 'DERIV';
      if (m === 'PL') return 'PL'; if (m === 'POSS') return 'POSS';
      if (isCase) return 'CASE'; if (isCop) return 'COP'; return null;
    case 'DERIV': case 'PL':
      if (m === 'PL' && from === 'DERIV') return 'PL';
      if (m === 'POSS') return 'POSS'; if (isCase) return 'CASE'; if (isCop) return 'COP'; return null;
    case 'POSS':
      if (isCase) return 'CASE'; if (isCop) return 'COP'; return null;
    case 'CASE':
      if (m === 'KI' && (prev === 'GEN' || prev === 'LOC')) return 'KI';
      if (isCop) return 'COP'; return null;
    case 'KI':
      if (m === 'PL') return 'PL2'; if (isCase) return 'CASE2'; if (isCop) return 'COP'; return null;
    case 'PL2':
      if (isCase) return 'CASE2'; if (isCop) return 'COP'; return null;
    case 'CASE2':
      if (isCop) return 'COP'; return null;
    case 'COP':
      return null;
  }
}

/** Ekin tüm geçerli ayrıştırmaları. "nın" → [[GEN]]; "lerinden" → [[PL,POSS,ABL]] vb. */
export function parseSuffixAll(suffix: string): Morpheme[][] {
  const s = trLower(suffix);
  const results: Morpheme[][] = [];
  const walk = (pos: number, slot: Slot, prev: Morpheme | null, acc: Morpheme[]): void => {
    if (pos === s.length) { if (acc.length) results.push([...acc]); return; }
    if (acc.length >= 5) return;
    for (const [m, surfaces] of SURFACES) {
      const ns = nextSlot(slot, m, prev);
      if (!ns) continue;
      for (const surf of surfaces) {
        if (surf && s.startsWith(surf, pos)) { acc.push(m); walk(pos + surf.length, ns, m, acc); acc.pop(); }
      }
    }
  };
  walk(0, 'START', null, []);
  // Yineleri at
  const seen = new Set<string>();
  return results.filter((r) => { const k = r.join('+'); if (seen.has(k)) return false; seen.add(k); return true; });
}

/** Tek ayrıştırma seçimi: en az biçimbirim; eşitlikte ACC > POSS ve kalıp sırası. */
export function parseSuffix(suffix: string): Morpheme[] | null {
  const all = parseSuffixAll(suffix);
  if (!all.length) return null;
  const penalty = (r: Morpheme[]): number =>
    r.length * 10 + r.filter((m) => m === 'POSS').length * 3 + r.filter((m) => m === 'KI').length;
  return all.sort((a, b) => penalty(a) - penalty(b))[0]!;
}

// ---------- Ses profili ----------
/** Son ünlüsü kalın olduğu hâlde ince ek alan özel adlar (damak l'si). Genişletilebilir sözlük. */
export const FRONT_SUFFIX_EXCEPTIONS: ReadonlySet<string> = new Set([
  'kemal', 'celal', 'cemal', 'bilal', 'hilal', 'nihal', 'meral', 'iclal', 'ikbal', 'hayal', 'lal', 'celâl', 'kemâl', 'cemâl',
]);
/** Okunuşu yazılışından farklı yabancı adlar için sözlük (genişletilebilir). Değer: okunuş. */
export const PRONUNCIATION_OVERRIDES: ReadonlyMap<string, string> = new Map([
  ['george', 'corc'], ['michael', 'maykıl'], ['jacques', 'jak'], ['jean', 'jan'], ['charles', 'çarls'],
  ['steve', 'stiv'], ['mike', 'mayk'], ['james', 'ceyms'], ['john', 'con'],
]);
/** Okunuşta açılan kısaltmalar. Değer: kelime okunuşu. */
export const ABBREVIATION_EXPANSIONS: ReadonlyMap<string, string> = new Map([
  ['şti.', 'şirketi'], ['ltd.', 'limited'], ['koop.', 'kooperatifi'], ['san.', 'sanayi'], ['tic.', 'ticaret'],
  ['inş.', 'inşaat'], ['mah.', 'mahallesi'], ['mh.', 'mahallesi'], ['cad.', 'caddesi'], ['cd.', 'caddesi'],
  ['sok.', 'sokağı'], ['sk.', 'sokağı'], ['blv.', 'bulvarı'], ['bul.', 'bulvarı'], ['apt.', 'apartmanı'],
  ['no.', 'numara'], ['e.', 'esas'], ['k.', 'karar'], ['av.', 'avukat'], ['dr.', 'doktor'],
]);
/** 3. tekil iyelikle biten baş sözcükler: durum ekleri -nin/-ni/-ne/-nde/-nden/-nce alır. */
export const POSSESSIVE_HEADS: ReadonlySet<string> = new Set([
  'şirketi', 'bakanlığı', 'başkanlığı', 'müdürlüğü', 'belediyesi', 'valiliği', 'kaymakamlığı', 'rektörlüğü',
  'üniversitesi', 'bankası', 'vakfı', 'derneği', 'odası', 'kooperatifi', 'birliği', 'kurumu', 'kurulu', 'idaresi',
  'hastanesi', 'fakültesi', 'mahallesi', 'caddesi', 'sokağı', 'bulvarı', 'apartmanı', 'sitesi', 'merkezi', 'grubu',
  'şubesi', 'bürosu', 'noterliği', 'mahkemesi', 'dairesi', 'savcılığı', 'başsavcılığı', 'komisyonu', 'meclisi',
  'enstitüsü', 'okulu', 'lisesi', 'holdingi', 'ortaklığı', 'acentesi', 'fabrikası', 'mağazası', 'eczanesi',
]);
const LETTER_NAMES: Record<string, string> = {
  a: 'a', b: 'be', c: 'ce', ç: 'çe', d: 'de', e: 'e', f: 'fe', g: 'ge', ğ: 'ge', h: 'he', ı: 'ı', i: 'i', j: 'je',
  k: 'ke', l: 'le', m: 'me', n: 'ne', o: 'o', ö: 'ö', p: 'pe', r: 're', s: 'se', ş: 'şe', t: 'te', u: 'u', ü: 'ü',
  v: 've', y: 'ye', z: 'ze', q: 'kü', w: 've', x: 'iks',
};
/** Kelime sonunda Türkçede olağan ünsüz çiftleri (kısaltma/kelime ayrımı için). */
const FINAL_CLUSTERS = new Set(['lt', 'ns', 'nt', 'nk', 'nç', 'rk', 'rt', 'rç', 'rs', 'st', 'şt', 'ks', 'ft', 'lk', 'rp', 'lp', 'rz', 'rd', 'lç', 'rf']);

function profileFromWord(word: string, source: PhonSource, conf: Confidence): PhonProfile | null {
  const w = trLower(word).replace(/[^\p{L}]/gu, '');
  if (!w) return null;
  let lastV = '';
  for (let i = w.length - 1; i >= 0; i--) if (VOWELS.includes(w[i]!)) { lastV = w[i]!; break; }
  if (!lastV) return null;
  const last = w[w.length - 1]!;
  let harmony = harmonyOf(lastV);
  if (FRONT_SUFFIX_EXCEPTIONS.has(w)) harmony = 'i';
  const final: FinalSound = VOWELS.includes(last) ? 'VOWEL' : VOICELESS.includes(last) ? 'VOICELESS' : 'VOICED';
  return { harmony, final, pronominalN: POSSESSIVE_HEADS.has(w), source, confidence: conf };
}

/** Tamamı büyük harf, noktasız kısa dizi harf harf mi okunur? (THY, ABD, SGK → evet; ALİ, TÜİK, ODTÜ → hayır) */
export function isLetterByLetter(token: string): boolean {
  const t = trLower(token);
  if (t.length > 4) return false;
  const vowelIdx = [...t].map((c, i) => (VOWELS.includes(c) ? i : -1)).filter((i) => i >= 0);
  if (!vowelIdx.length) return true;
  const tail = t.slice(vowelIdx[vowelIdx.length - 1]! + 1);
  if (tail.length >= 3) return true;
  if (tail.length === 2 && !FINAL_CLUSTERS.has(tail)) return true;
  if (/^[^aeıioöuü]{2}/.test(t)) return true; // Türkçe kelime iki ünsüzle başlamaz
  return false;
}

const looksForeign = (w: string): boolean => /[qwx]|th|ch|sh|ph|ou|ae|ee|oo|y$/.test(trLower(w).replace(/[^\p{L}]/gu, ''));

/** Bir yüzey biçimin (tam ad, şirket unvanı, adres, numara) ek alırken kullanılan ses profili. */
export function profileOf(surface: string): PhonProfile {
  const fallback: PhonProfile = { harmony: 'i', final: 'VOICED', pronominalN: false, source: 'DEFAULT', confidence: 'LOW' };
  const parts = surface.trim().split(/[\s/]+/).filter(Boolean);
  if (!parts.length) return fallback;
  const last = parts[parts.length - 1]!.replace(/["“”)\],;:]+$/u, '');
  const lower = trLower(last);
  // 1) Sayı ile biten (plaka, dosya no, kimlik no)
  if (/[0-9]$/.test(last)) {
    const p = profileFromWord(lastSpokenWord(last.match(/[0-9]+$/)![0]), 'NUMBER', 'HIGH');
    if (p) return p;
  }
  // 2) Açılımı olan kısaltma (Şti., Mah., E.)
  const exp = ABBREVIATION_EXPANSIONS.get(lower);
  if (exp) return profileFromWord(exp, 'ABBREVIATION', 'HIGH') ?? fallback;
  // 3) Noktalı harf kısaltması (A.Ş., T.C.) → son harfin adı
  if (/^(\p{L}\.){1,4}$/u.test(last) || /^\p{L}\.\p{L}\.?$/u.test(last)) {
    const letters = lower.replace(/\./g, '');
    return profileFromWord(LETTER_NAMES[letters[letters.length - 1]!] ?? 'e', 'ABBREVIATION', 'MEDIUM') ?? fallback;
  }
  // 4) Büyük harfli kısa kısaltma (THY, SGK)
  if (last === trUpper(last) && /\p{L}/u.test(last) && isLetterByLetter(last)) {
    const letters = lower.replace(/[^\p{L}]/gu, '');
    return profileFromWord(LETTER_NAMES[letters[letters.length - 1]!] ?? 'e', 'ABBREVIATION', 'MEDIUM') ?? fallback;
  }
  // 5) Okunuş sözlüğü (yabancı adlar)
  const ov = PRONUNCIATION_OVERRIDES.get(lower.replace(/[^\p{L}]/gu, ''));
  if (ov) return profileFromWord(ov, 'LEXICON', 'HIGH') ?? fallback;
  // 6) Olağan kelime
  return profileFromWord(last, 'WORD', looksForeign(last) ? 'LOW' : 'HIGH') ?? fallback;
}

/** Etiketin kendi okunuşu (maskeli metinde ek normalleştirme için): "[DAVACI_1]" → "bir", "[ŞİRKET_B]" → "be". */
export function tokenReadingProfile(token: string): PhonProfile {
  const inner = token.replace(/^[\[《]|[\]》]$/g, '');
  const idx = inner.match(/_([0-9]+|[A-ZÇĞİÖŞÜ]{1,2})$/u)?.[1];
  if (idx && /^[0-9]+$/.test(idx)) return profileOf(idx);
  if (idx) return profileFromWord(LETTER_NAMES[trLower(idx).slice(-1)] ?? 'e', 'ABBREVIATION', 'HIGH')!;
  return profileOf(inner.replace(/_/g, ' '));
}

// ---------- Kanıttan profil çıkarımı ----------
const PROFILE_SPACE: Array<Pick<PhonProfile, 'harmony' | 'final' | 'pronominalN'>> = ALL_STATES.flatMap((s) =>
  [false, true].map((n) => ({ harmony: s.harmony, final: s.final, pronominalN: n })));

/** Kaynak belgede bu varlıkla görülen ekler ("Yılmaz'ın", "A.Ş.'ne") hesaplanan profille çelişiyorsa kanıta uy. */
export function refineWithEvidence(computed: PhonProfile, observedSuffixes: readonly string[]): PhonProfile {
  const obs = observedSuffixes.map((s) => trLower(s)).filter((s) => parseSuffixAll(s).length > 0);
  if (!obs.length) return computed;
  const consistent = PROFILE_SPACE.filter((p) =>
    obs.every((s) => parseSuffixAll(s).some((morphs) => realize(morphs, p) === s)));
  const same = (p: Pick<PhonProfile, 'harmony' | 'final' | 'pronominalN'>): boolean =>
    p.harmony === computed.harmony && p.final === computed.final && p.pronominalN === computed.pronominalN;
  if (consistent.some(same)) return { ...computed, confidence: computed.confidence === 'LOW' ? 'MEDIUM' : computed.confidence };
  if (!consistent.length) return { ...computed, confidence: 'LOW' };
  const score = (p: Pick<PhonProfile, 'harmony' | 'final' | 'pronominalN'>): number =>
    (p.harmony === computed.harmony ? 4 : 0) + (p.final === computed.final ? 2 : 0) + (p.pronominalN === computed.pronominalN ? 1 : 0);
  const best = [...consistent].sort((a, b) => score(b) - score(a))[0]!;
  return { ...best, source: 'EVIDENCE', confidence: consistent.length <= 2 ? 'HIGH' : 'MEDIUM' };
}

// ---------- Ana işlev: ek düzeltme ----------
/** LLM'in etiketin ardına yazdığı eki (kesme işaretinden sonraki harfler) özgün varlığa uyarlar. */
export function rehydrateSuffix(llmSuffix: string, target: PhonProfile): SuffixRealization {
  const morphs = parseSuffix(llmSuffix);
  if (!morphs) return { suffixOut: llmSuffix, morphemes: null, changed: false, confidence: 'LOW' };
  let out = realize(morphs, target);
  if (llmSuffix === trUpper(llmSuffix) && llmSuffix !== trLower(llmSuffix)) out = trUpper(out);
  return { suffixOut: out, morphemes: morphs, changed: out !== llmSuffix, confidence: target.confidence };
}
