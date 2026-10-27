// packages/core-engine/src/pipeline/leakAudit.ts
// Sızıntı denetimi (MASTER 3.0.4, K-12). Kopyalama düğmesi bu denetim temiz dönmeden etkinleşmez.

import { judgeSignatures } from '../names/judgeSignatures';
import { detectAll } from '../detectors/deterministic/reference';
import { lowerView, trLower, isAlnum, leftBoundary, rightBoundary } from '../text/turkish';
import type { DocumentId, EntityCluster, MaskingSessionVault, ReviewItem, TextSpan } from '../types/contracts';

const overlaps = (a: TextSpan, b: TextSpan): boolean => a.start < b.end && b.start < a.end;

/** Sözcük sınırlı tüm geçişler. haystack ve needle aynı görünümde (küçük harf) verilir. */
function findWordBounded(haystack: string, needle: string): TextSpan[] {
  const out: TextSpan[] = [];
  if (needle.length === 0) return out;
  let i = haystack.indexOf(needle);
  while (i >= 0) {
    const end = i + needle.length;
    if (leftBoundary(haystack, i, isAlnum) && rightBoundary(haystack, end, isAlnum)) out.push({ start: i, end });
    i = haystack.indexOf(needle, i + 1);
  }
  return out;
}

/** Yalnız büyük harfle başlayan geçişler: "Kaya" bulunur, "kaya" (ortak ad) bulunmaz. */
function findCapitalized(text: string, view: string, part: string): TextSpan[] {
  return findWordBounded(view, trLower(part)).filter((s) => {
    const c = text[s.start]!;
    return c !== c.toLocaleLowerCase('tr-TR');
  });
}

export interface LeakAuditInput {
  readonly docId: DocumentId;
  readonly masked: string;
  readonly vault: MaskingSessionVault;
  /** Maskeli metinde etiketlerin ve ikiz adların kapladığı aralıklar */
  readonly tokenSpans: readonly TextSpan[];
  readonly currentYear: number;
}

export function leakAudit(input: LeakAuditInput): ReviewItem[] {
  const { docId, masked, vault, tokenSpans } = input;
  const view = lowerView(masked);
  const inToken = (s: TextSpan): boolean => tokenSpans.some((t) => overlaps(t, s));
  const findings: ReviewItem[] = [];
  // Aynı aralığı (ya da tam yüzeyin içindeki ad parçasını) bir kez bildir.
  const push = (span: TextSpan, message: string, entityId?: string): void => {
    if (findings.some((f) => overlaps(f.span!, span))) return;
    findings.push({ id: `LEAK-${findings.length + 1}`, kind: 'LEAK_AUDIT', docId, span, message, ...(entityId ? { entityId } : {}) });
  };
  const label = (e: EntityCluster): string => e.token;

  for (const e of vault.entities.values()) {
    if (e.status !== 'MASK') continue;
    // 1) Tam yüzeyler: büyük/küçük harf duyarsız, sözcük sınırlı
    for (const s of new Set([e.canonical, ...e.surfaces])) {
      for (const hit of findWordBounded(view, trLower(s))) if (!inToken(hit)) push(hit, `${label(e)} için maskelenmemiş geçiş kaldı.`, e.id);
    }
    // 2) Ad ve soyadı parçaları (en az 3 harf), yalnız büyük harfle başlayanlar
    const parts = [...(e.nameParts?.given ?? []), ...(e.nameParts?.surnames ?? [])].filter((p) => p.length >= 3);
    for (const p of parts) {
      for (const hit of findCapitalized(masked, view, p)) if (!inToken(hit)) push(hit, `${label(e)} adının bir parçası metinde kaldı.`, e.id);
    }
  }
  // İmza bloğu, ilk tespitte atlanmış olsa bile yeniden denetlenir.
  for (const signature of judgeSignatures(masked)) {
    if (signature.name && !inToken(signature.name)) push(signature.name, 'Maskelenmemiş hâkim adı kaldı.');
    if (signature.number && !inToken(signature.number)) push(signature.number, 'Maskelenmemiş hâkim sicil numarası kaldı.');
  }
  // 3) Katman 1 yeniden: maskeli metinde YÜKSEK güvenli kimlik/iletişim bulgusu kalmamalı
  for (const r of detectAll(masked, input.currentYear).raws) {
    const span = { start: r.start, end: r.end };
    if (r.confidence === 'HIGH' && !inToken(span)) push(span, `Maskelenmemiş ${r.category} bulgusu kaldı.`);
  }
  return findings.sort((a, b) => a.span!.start - b.span!.start);
}
