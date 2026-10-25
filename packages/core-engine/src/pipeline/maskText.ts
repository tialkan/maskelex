// packages/core-engine/src/pipeline/maskText.ts
// Etiket atama ve maskeli metin üretimi (orkestratörün bileşim katmanı).

import { tokenReadingProfile, profileOf, parseSuffix, realize } from '../morphology/morphology';
import {
  CATEGORY_SPECS, ROLE_TOKEN_LABELS, makeToken,
  type EntityCategory, type LegalRole, type PhonProfile, type TextEdit, type TextSpan,
} from '../types/contracts';

export interface TokenRequest {
  readonly entityId: string;
  readonly category: EntityCategory;
  readonly role: LegalRole;
  /** İlk anmanın belge konumu: numaralar ilk görünüş sırasıyla verilir. */
  readonly firstSeen: number;
  readonly currentToken?: string;
}
/** Kişiler rol gövdesiyle ([DAVACI_1]), diğerleri kategori gövdesiyle ([TCKN_1], [ŞİRKET_A]) numaralanır.
 *  Kasa kilitli değilse tüm etiketler ilk görünüş sırasına göre yeniden üretilir (boşluksuz numara).
 *  Kilitliyse mevcut etiket korunur, yeni gelen sayaçtan devam eder; değişen etiketin eskisi takma ad kalır. */
export function allocateTokens(reqs: readonly TokenRequest[], counters: Record<string, number>, locked: boolean): Map<string, string> {
  const out = new Map<string, string>();
  const labelOf = (r: TokenRequest): string => (r.category === 'KISI' ? ROLE_TOKEN_LABELS[r.role] : CATEGORY_SPECS[r.category].tokenLabel);
  const local: Record<string, number> = locked ? { ...counters } : {};
  for (const r of [...reqs].sort((a, b) => a.firstSeen - b.firstSeen)) {
    const label = labelOf(r);
    if (locked && r.currentToken && r.currentToken.startsWith(`[${label}_`)) { out.set(r.entityId, r.currentToken); continue; }
    const n = (local[label] ?? 0) + 1;
    local[label] = n;
    out.set(r.entityId, makeToken(label, n, CATEGORY_SPECS[r.category].index));
  }
  Object.assign(counters, local);
  return out;
}

export interface MaskMention {
  readonly span: TextSpan;
  readonly replacement: string;   // "[DAVACI_1]" veya "《Kaan Korkmaz》" veya ölçekli tutar
  readonly kind: 'TOKEN' | 'TWIN' | 'FUZZ' | 'GROUP_TOKEN';
  /** Anmadan hemen sonraki kesme işaretli ek */
  readonly suffix?: { readonly span: TextSpan; readonly text: string };
}
/** Maskeli metnin düzenlemeleri. Etiket modunda ek, etiketin kendi okunuşuna göre yeniden çekilir:
 *  "Yılmaz'ın" → "[DAVACI_1]'in" ("bir" okunuşu). Böylece özgün adın ses bilgisi de dışarı sızmaz. */
export function buildMaskEdits(mentions: readonly MaskMention[], normalizeSuffixes: boolean): TextEdit[] {
  const edits: TextEdit[] = [];
  for (const m of mentions) {
    if (m.suffix && normalizeSuffixes && (m.kind === 'TOKEN' || m.kind === 'GROUP_TOKEN')) {
      const morphs = parseSuffix(m.suffix.text);
      const target: PhonProfile = tokenReadingProfile(m.replacement);
      const suf = morphs ? realize(morphs, target) : m.suffix.text;
      edits.push({ span: { start: m.span.start, end: m.suffix.span.end }, replacement: `${m.replacement}'${suf}` });
    } else if (m.suffix && normalizeSuffixes && m.kind === 'TWIN') {
      const morphs = parseSuffix(m.suffix.text);
      const name = m.replacement.replace(/^《|》$/g, '');
      const suf = morphs ? realize(morphs, profileOf(name)) : m.suffix.text;
      edits.push({ span: { start: m.span.start, end: m.suffix.span.end }, replacement: `${m.replacement}'${suf}` });
    } else {
      edits.push({ span: m.span, replacement: m.replacement });
    }
  }
  return edits;
}
