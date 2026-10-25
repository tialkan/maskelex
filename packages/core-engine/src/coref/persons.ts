// packages/core-engine/src/coref/persons.ts (başvuru uygulaması)
// Kişi anmalarını kümeler. Kural: soyadı çakışmasında YALNIZ soyadı ile anma asla tahminle bağlanmaz;
// rol veya cinsiyet ipucu tek adaya indirmiyorsa "grup etiketi" ([SOYAD_n]) ile maskelenir ve incelemeye düşer.

import { foldKey } from '../text/turkish';
import type { Gender, Confidence as Conf, MentionForm as AnyForm, EntityMatch } from '../types/contracts';

export type MentionForm = Exclude<AnyForm, 'VALUE'>;

export interface NameLexicon {
  /** Katlanmış ad → cinsiyet (yoksa null). Aynı sözcük hem ad hem soyadı olabilir ("Yılmaz", "Kaya"). */
  givenGender(folded: string): Gender | null;
}
export interface PersonMention {
  readonly id: string;
  readonly start: number;
  readonly end: number;
  /** Ad kısmı: unvan ve kesme sonrası ek HARİÇ ("Ahmet Yılmaz", "Yılmaz", "A. Yılmaz") */
  readonly surface: string;
  readonly honorificBefore?: EntityMatch['honorificBefore'];
  readonly honorificAfter?: EntityMatch['honorificAfter'];
  readonly roleHint?: string;
  readonly paragraph: number;
}
export interface Cluster {
  readonly id: string;
  given: string[];          // katlanmış
  surnames: string[];       // katlanmış; sonuncusu birincil soyadı
  gender: Gender;
  readonly roleVotes: Map<string, number>;
  readonly mentionIds: string[];
  readonly paragraphs: Set<number>;
}
export interface Assignment {
  readonly form: MentionForm;
  readonly clusterId: string | null;
  readonly group?: { readonly kind: 'SOYAD' | 'AD'; readonly value: string; readonly candidateIds: string[] };
  readonly confidence: Conf;
}

interface Parsed { m: PersonMention; form: MentionForm; given: string[]; surnames: string[]; token: string; initial: string }

function parse(m: PersonMention, lex: NameLexicon): Parsed {
  const tokens = m.surface.split(/\s+/).filter(Boolean);
  const base = { m, given: [] as string[], surnames: [] as string[], token: '', initial: '' };
  if (tokens.length >= 2) {
    if (/^\p{Lu}\.$/u.test(tokens[0]!)) return { ...base, form: 'INITIAL_SURNAME', initial: foldKey(tokens[0]![0]!), surnames: [foldKey(tokens.at(-1)!)] };
    let i = 0;
    while (i < tokens.length - 1 && lex.givenGender(foldKey(tokens[i]!)) !== null) i++;
    if (i === 0) i = 1;   // sözlükte olmasa da ilk sözcük addır
    return { ...base, form: 'FULL', given: tokens.slice(0, i).map(foldKey), surnames: tokens.slice(i).map(foldKey) };
  }
  const t = foldKey(tokens[0] ?? '');
  if (m.honorificBefore === 'sayın' || m.honorificBefore === 'sn.') return { ...base, form: 'SURNAME_ONLY', token: t };
  return { ...base, form: lex.givenGender(t) !== null ? 'GIVEN_ONLY' : 'SURNAME_ONLY', token: t };
}

const subsetOf = (a: string[], b: string[]): boolean => a.every((x) => b.includes(x));
const genderCue = (m: PersonMention): Gender | null =>
  m.honorificAfter === 'bey' || m.honorificAfter === 'beyefendi' || m.honorificBefore === 'bay' ? 'E'
    : m.honorificAfter === 'hanım' || m.honorificAfter === 'hanımefendi' || m.honorificBefore === 'bayan' ? 'K' : null;
const topRole = (c: Cluster): string | null => {
  let best: string | null = null, n = 0;
  for (const [r, v] of c.roleVotes) if (v > n) { best = r; n = v; }
  return best;
};

export function resolvePersons(mentions: readonly PersonMention[], lex: NameLexicon): { clusters: Cluster[]; assignment: Map<string, Assignment> } {
  const parsed = [...mentions].sort((a, b) => a.start - b.start).map((m) => parse(m, lex));
  const clusters: Cluster[] = [];
  const assignment = new Map<string, Assignment>();
  const add = (c: Cluster, p: Parsed, conf: Conf): void => {
    c.mentionIds.push(p.m.id); c.paragraphs.add(p.m.paragraph);
    if (p.m.roleHint) c.roleVotes.set(p.m.roleHint, (c.roleVotes.get(p.m.roleHint) ?? 0) + 1);
    assignment.set(p.m.id, { form: p.form, clusterId: c.id, confidence: conf });
  };

  // 1. Tam adlarla küme tohumları. "Ayşe Nur Kaya" ~ "Ayşe Kaya"; "Ayşe Kaya Yılmaz" ~ "Ayşe Yılmaz".
  for (const p of parsed.filter((x) => x.form === 'FULL')) {
    const primary = p.surnames.at(-1)!;
    let c = clusters.find((k) => k.surnames.at(-1) === primary && (subsetOf(p.given, k.given) || subsetOf(k.given, p.given)));
    if (!c) {
      const g = lex.givenGender(p.given[0]!) ?? 'U';
      c = { id: `K${clusters.length + 1}`, given: [...p.given], surnames: [...p.surnames], gender: g, roleVotes: new Map(), mentionIds: [], paragraphs: new Set() };
      clusters.push(c);
    } else {
      if (p.given.length > c.given.length) c.given = [...p.given];
      if (p.surnames.length > c.surnames.length) c.surnames = [...p.surnames];
    }
    add(c, p, 'HIGH');
  }

  const narrow = (cands: Cluster[], p: Parsed): Cluster[] => {
    if (cands.length <= 1) return cands;
    if (p.m.roleHint) { const r = cands.filter((c) => topRole(c) === p.m.roleHint); if (r.length === 1) return r; }
    const g = genderCue(p.m);
    if (g) { const r = cands.filter((c) => c.gender === g); if (r.length === 1) return r; }
    return cands;
  };

  // 2. Kısmi anmalar, belge sırasıyla
  for (const p of parsed.filter((x) => x.form !== 'FULL')) {
    if (p.form === 'INITIAL_SURNAME') {
      const cands = narrow(clusters.filter((c) => c.surnames.includes(p.surnames[0]!) && c.given.some((g) => g.startsWith(p.initial))), p);
      if (cands.length === 1) add(cands[0]!, p, 'HIGH');
      else assignment.set(p.m.id, { form: p.form, clusterId: null, confidence: 'LOW', group: { kind: 'SOYAD', value: p.surnames[0]!, candidateIds: cands.map((c) => c.id) } });
      continue;
    }
    const bySurname = clusters.filter((c) => c.surnames.includes(p.token));
    const byGiven = clusters.filter((c) => c.given.includes(p.token));
    let form: MentionForm = p.form;
    let cands = form === 'SURNAME_ONLY' ? bySurname : byGiven;
    if (!cands.length) { cands = form === 'SURNAME_ONLY' ? byGiven : bySurname; if (cands.length) form = form === 'SURNAME_ONLY' ? 'GIVEN_ONLY' : 'SURNAME_ONLY'; }
    if (!cands.length) {   // yalnız bu biçimle bilinen yeni kişi ("Tanık Demir")
      const c: Cluster = { id: `K${clusters.length + 1}`, given: form === 'GIVEN_ONLY' ? [p.token] : [], surnames: form === 'SURNAME_ONLY' ? [p.token] : [],
        gender: genderCue(p.m) ?? 'U', roleVotes: new Map(), mentionIds: [], paragraphs: new Set() };
      clusters.push(c); add(c, { ...p, form }, 'MEDIUM'); continue;
    }
    let chosen = narrow(cands, p);
    // Yalnız AD ile anmada (soyadında DEĞİL) aynı paragraf yakınlığı kullanılabilir.
    if (chosen.length > 1 && form === 'GIVEN_ONLY') {
      const near = chosen.filter((c) => c.paragraphs.has(p.m.paragraph));
      if (near.length === 1) chosen = near;
    }
    if (chosen.length === 1) add(chosen[0]!, { ...p, form }, cands.length === 1 ? 'HIGH' : 'MEDIUM');
    else assignment.set(p.m.id, { form, clusterId: null, confidence: 'LOW', group: { kind: form === 'SURNAME_ONLY' ? 'SOYAD' : 'AD', value: p.token, candidateIds: chosen.map((c) => c.id) } });
  }
  return { clusters, assignment };
}
