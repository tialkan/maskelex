// packages/document-parsers/src/udf/contentXml.ts
// UDF content.xml için: CDATA metnini çıkarma, ofset taşıyan öğeleri tarama ve CERRAHİ yeniden yazım.
// İlke: XML'i ayrıştırıp yeniden serileştirmeyiz. Yalnız CDATA bloğu ile startOffset/length değerleri değişir;
// geri kalan her bayt (bilinmeyen öznitelikler, sıralama, girinti) aynen korunur.
// DOMParser kullanılmaz (Web Worker'da yoktur).

import type { TextEdit } from '@maskelex/core-engine/types';
import { makePointMapper, normalizeEdits, applyEditsToText } from '../ast/remap';

export class UdfFormatError extends Error {}

export interface CdataRegion {
  readonly contentOpenEnd: number;  // "<content>" etiketinin hemen sonrası (ham XML indeksi)
  readonly contentCloseStart: number; // "</content>" başlangıcı
  readonly text: string;              // birleştirilmiş CDATA metni
}

/** <template> içindeki İLK <content> öğesinin metnini bulur. İçerik yalnız CDATA bölümlerinden oluşmalıdır
 *  ("]]>" kaçışı nedeniyle birden çok CDATA bölümü olabilir). Aksi durumda UdfFormatError. */
export function locateCdata(xml: string): CdataRegion {
  const tpl = xml.search(/<template\b/);
  if (tpl < 0) throw new UdfFormatError('template öğesi yok');
  const open = xml.indexOf('<content>', tpl);
  if (open < 0) throw new UdfFormatError('content öğesi yok');
  let i = open + '<content>'.length;
  const contentOpenEnd = i;
  let text = '';
  for (;;) {
    // CDATA dışındaki her karakter (boşluk dahil) XML'e göre metne dahildir; UYAP böyle yazmaz → reddet.
    if (xml.startsWith('<![CDATA[', i)) {
      const endC = xml.indexOf(']]>', i + 9);
      if (endC < 0) throw new UdfFormatError('kapanmamış CDATA');
      text += xml.slice(i + 9, endC);
      i = endC + 3;
      continue;
    }
    if (xml.startsWith('</content>', i)) return { contentOpenEnd, contentCloseStart: i, text };
    throw new UdfFormatError('content içinde CDATA dışı karakter');
  }
}

export interface AttrValueSpan { readonly valueStart: number; readonly valueEnd: number; readonly value: string }
export interface OffsetElement {
  readonly name: string;
  readonly tagStart: number;      // '<' indeksi
  readonly tagEnd: number;        // '>' sonrası indeks
  readonly selfClosing: boolean;
  readonly depth: number;
  readonly startOffset: AttrValueSpan;
  readonly length: AttrValueSpan;
}

interface Tag { kind: 'start' | 'end' | 'empty'; name: string; start: number; end: number; attrs: Map<string, AttrValueSpan> }

/** Tırnak farkındalıklı basit XML etiket tarayıcı (öznitelik değerinde '>' olabilir). */
export function* scanTags(xml: string, from: number): Generator<Tag> {
  let i = from;
  while (i < xml.length) {
    const lt = xml.indexOf('<', i);
    if (lt < 0) return;
    if (xml.startsWith('<!--', lt)) { i = xml.indexOf('-->', lt) + 3; continue; }
    if (xml.startsWith('<![CDATA[', lt)) { i = xml.indexOf(']]>', lt) + 3; continue; }
    if (xml.startsWith('<?', lt) || xml.startsWith('<!', lt)) { i = xml.indexOf('>', lt) + 1; continue; }
    if (xml[lt + 1] === '/') {
      const gt = xml.indexOf('>', lt);
      yield { kind: 'end', name: xml.slice(lt + 2, gt).trim(), start: lt, end: gt + 1, attrs: new Map() };
      i = gt + 1; continue;
    }
    let j = lt + 1;
    while (j < xml.length && /[^\s/>]/.test(xml[j]!)) j++;
    const name = xml.slice(lt + 1, j);
    const attrs = new Map<string, AttrValueSpan>();
    for (;;) {
      while (/\s/.test(xml[j]!)) j++;
      if (xml[j] === '>') { yield { kind: 'start', name, start: lt, end: j + 1, attrs }; i = j + 1; break; }
      if (xml.startsWith('/>', j)) { yield { kind: 'empty', name, start: lt, end: j + 2, attrs }; i = j + 2; break; }
      const eq = xml.indexOf('=', j);
      const an = xml.slice(j, eq).trim();
      let k = eq + 1;
      while (/\s/.test(xml[k]!)) k++;
      const q = xml[k]!;
      if (q !== '"' && q !== "'") throw new UdfFormatError(`tırnaksız öznitelik: ${an}`);
      const close = xml.indexOf(q, k + 1);
      attrs.set(an, { valueStart: k + 1, valueEnd: close, value: xml.slice(k + 1, close) });
      j = close + 1;
    }
  }
}

/** startOffset ve length taşıyan tüm öğeler (belge sırasıyla). */
export function scanOffsetElements(xml: string, from: number): OffsetElement[] {
  const out: OffsetElement[] = [];
  let depth = 0;
  for (const t of scanTags(xml, from)) {
    if (t.kind === 'end') { depth--; continue; }
    const so = t.attrs.get('startOffset');
    const ln = t.attrs.get('length');
    if (so && ln) out.push({ name: t.name, tagStart: t.start, tagEnd: t.end, selfClosing: t.kind === 'empty', depth, startOffset: so, length: ln });
    if (t.kind === 'start') depth++;
  }
  return out;
}

/** CDATA içine güvenli yazım: "]]>" bölünür, XML 1.0'da yasak denetim karakterleri atılır. */
export function toCdata(text: string): string {
  const safe = text.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, '');
  return '<![CDATA[' + safe.split(']]>').join(']]]]><![CDATA[>') + ']]>';
}

export interface RewriteReport { readonly removedElements: number; readonly changedElements: number; readonly newText: string }

/** Ofset Yeniden Hesaplama ile cerrahi yeniden yazım. */
export function rewriteContentXml(xml: string, edits: readonly TextEdit[]): { xml: string; report: RewriteReport } {
  const cd = locateCdata(xml);
  const sorted = normalizeEdits(cd.text, edits);
  const newText = applyEditsToText(cd.text, sorted);
  const map = makePointMapper(sorted);
  const elements = scanOffsetElements(xml, cd.contentCloseStart + '</content>'.length);

  type Splice = { start: number; end: number; text: string };
  const splices: Splice[] = [];
  let removed = 0, changed = 0;
  for (const el of elements) {
    const s = Number(el.startOffset.value), len = Number(el.length.value);
    if (!Number.isInteger(s) || !Number.isInteger(len) || s < 0 || len < 0 || s + len > cd.text.length)
      throw new UdfFormatError(`geçersiz ofset: <${el.name} startOffset="${el.startOffset.value}" length="${el.length.value}">`);
    const ns = map(s), ne = map(s + len), nl = ne - ns;
    if (nl === 0 && len > 0) {
      if (!el.selfClosing) throw new UdfFormatError(`alt öğeli <${el.name}> sıfır uzunluğa düştü`);
      splices.push({ start: el.tagStart, end: el.tagEnd, text: '' }); removed++; continue;
    }
    if (ns !== s) { splices.push({ start: el.startOffset.valueStart, end: el.startOffset.valueEnd, text: String(ns) }); }
    if (nl !== len) { splices.push({ start: el.length.valueStart, end: el.length.valueEnd, text: String(nl) }); }
    if (ns !== s || nl !== len) changed++;
  }
  splices.push({ start: cd.contentOpenEnd, end: cd.contentCloseStart, text: toCdata(newText) });
  splices.sort((x, y) => y.start - x.start);  // sondan başa uygula: önceki indeksler bozulmaz
  let out = xml;
  for (const sp of splices) out = out.slice(0, sp.start) + sp.text + out.slice(sp.end);
  return { xml: out, report: { removedElements: removed, changedElements: changed, newText } };
}

export interface UdfIssue { readonly code: string; readonly message: string }
/** Yazım sonrası değişmez denetimleri: aralık sınırları ve kardeş öğelerin çakışmaması. */
export function validateContentXml(xml: string): UdfIssue[] {
  const issues: UdfIssue[] = [];
  const cd = locateCdata(xml);
  const els = scanOffsetElements(xml, cd.contentCloseStart + '</content>'.length);
  const lastEndAtDepth = new Map<number, number>();
  for (const el of els) {
    const s = Number(el.startOffset.value), l = Number(el.length.value);
    if (s < 0 || l < 0 || s + l > cd.text.length) issues.push({ code: 'RANGE', message: `<${el.name}> [${s},${s + l}) metin dışında` });
    const prev = lastEndAtDepth.get(el.depth) ?? 0;
    if (s < prev) issues.push({ code: 'OVERLAP', message: `<${el.name}> ${s} < önceki bitiş ${prev}` });
    lastEndAtDepth.set(el.depth, s + l);
    for (const d of [...lastEndAtDepth.keys()]) if (d > el.depth) lastEndAtDepth.delete(d);
  }
  return issues;
}
