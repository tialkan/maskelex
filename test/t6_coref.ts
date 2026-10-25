import assert from 'node:assert/strict';
import { resolvePersons, type PersonMention, type NameLexicon } from '../packages/core-engine/src/coref/persons';

const GIVEN: Record<string, 'E' | 'K' | 'U'> = { ahmet: 'E', ayse: 'K', mehmet: 'E', yilmaz: 'E', nur: 'K', kaan: 'E', seda: 'K', deniz: 'U', ali: 'E', fatma: 'K' };
const lex: NameLexicon = { givenGender: (f) => GIVEN[f] ?? null };
let n = 0;
const M = (surface: string, extra: Partial<PersonMention> = {}): PersonMention => ({ id: `m${++n}`, start: n * 100, end: n * 100 + surface.length, surface, paragraph: 0, ...extra });

// Senaryo 1: tek kişi, tüm görünümler tek kimliğe bağlanır
{
  const ms = [M('Ahmet Yılmaz', { roleHint: 'DAVACI' }), M('Ahmet', { honorificAfter: 'bey', paragraph: 2 }), M('Yılmaz', { honorificBefore: 'sayın' }),
    M('Yılmaz', { honorificBefore: 'sn.' }), M('A. Yılmaz'), M('AHMET YILMAZ')];
  const { clusters, assignment } = resolvePersons(ms, lex);
  assert.equal(clusters.length, 1);
  for (const m of ms) assert.equal(assignment.get(m.id)!.clusterId, clusters[0]!.id, m.surface);
}
// Senaryo 2: boşanma davası, aynı soyadı
{
  const ahmet = M('Ahmet Yılmaz', { roleHint: 'DAVACI', paragraph: 1 });
  const ayse = M('Ayşe Yılmaz', { roleHint: 'DAVALI', paragraph: 1 });
  const ahmetBey = M('Ahmet', { honorificAfter: 'bey', paragraph: 3 });
  const sayinYilmaz = M('Yılmaz', { honorificBefore: 'sayın', paragraph: 3 });
  const davaliYilmaz = M('Yılmaz', { roleHint: 'DAVALI', paragraph: 4 });
  const yilmazHanim = M('Yılmaz', { honorificAfter: 'hanım', paragraph: 5 });
  const aYilmaz = M('A. Yılmaz', { paragraph: 6 });
  const { clusters, assignment } = resolvePersons([ahmet, ayse, ahmetBey, sayinYilmaz, davaliYilmaz, yilmazHanim, aYilmaz], lex);
  assert.equal(clusters.length, 2);
  const idOf = (m: PersonMention): string | null => assignment.get(m.id)!.clusterId;
  assert.equal(idOf(ahmetBey), idOf(ahmet));
  assert.equal(idOf(sayinYilmaz), null);                                   // tahmin YOK
  assert.equal(assignment.get(sayinYilmaz.id)!.group!.kind, 'SOYAD');
  assert.equal(idOf(davaliYilmaz), idOf(ayse));                           // rol ipucu
  assert.equal(idOf(yilmazHanim), idOf(ayse));                            // cinsiyet ipucu
  assert.equal(idOf(aYilmaz), null);                                      // A. hem Ahmet hem Ayşe
  console.log('boşanma senaryosu: grup etiketine düşenler', [...assignment.values()].filter((a) => a.group).length);
}
// Senaryo 3: evlilik soyadı ve ikinci ad
{
  const a = M('Ayşe Kaya Yılmaz'), b = M('Ayşe Yılmaz'), c = M('Ayşe Nur Demir'), d = M('Ayşe Demir');
  const { clusters, assignment } = resolvePersons([a, b, c, d], lex);
  assert.equal(clusters.length, 2);
  assert.equal(assignment.get(a.id)!.clusterId, assignment.get(b.id)!.clusterId);
  assert.equal(assignment.get(c.id)!.clusterId, assignment.get(d.id)!.clusterId);
}
// Senaryo 4: "Yılmaz" hem ad hem soyadı; "Yılmaz Bey" soyadı olarak bağlanır
{
  const a = M('Mehmet Yılmaz'), b = M('Yılmaz', { honorificAfter: 'bey' });
  const { clusters, assignment } = resolvePersons([a, b], lex);
  assert.equal(clusters.length, 1);
  assert.equal(assignment.get(b.id)!.form, 'SURNAME_ONLY');
}
// Senaryo 5: miras davası, üç Yılmaz; yalnız ad ile anma paragraf yakınlığıyla
{
  const p1 = M('Ali Yılmaz', { paragraph: 1 }), p2 = M('Ali Yılmaz Kaan', { paragraph: 8 }), p3 = M('Fatma Yılmaz', { paragraph: 2 });
  const ali = M('Ali', { paragraph: 1 });
  const { assignment } = resolvePersons([p1, p2, p3, ali], lex);
  assert.equal(assignment.get(ali.id)!.clusterId, assignment.get(p1.id)!.clusterId);
}
console.log('t6 OK');
