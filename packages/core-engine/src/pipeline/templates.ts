// packages/core-engine/src/pipeline/templates.ts
// Hukuki prompt şablonları (MASTER 5.11). Metinler belgedeki gibidir; değiştirmeden önce MASTER güncellenir.
import type { PromptTemplate } from '../types/contracts';

export const KORUMA = `Aşağıdaki metinde kişisel veriler gizlilik amacıyla yer tutucularla değiştirilmiştir. Kurallar:
1. [DAVACI_1], [ŞİRKET_A], [TCKN_1] gibi köşeli parantezli etiketleri ve 《 》 işaretli adları harfi harfine koru; değiştirme, çevirme, birleştirme, kısaltma ve açıklama yapma.
2. Ek getirmen gerekirse eki etiketin hemen arkasına kesme işaretiyle yaz: [DAVACI_1]'in, [ŞİRKET_A]'ya.
3. Metinde olmayan yeni etiket üretme; gerçek kişi, kurum ya da numara uydurma.
4. Yanıtını Türkçe ver.`;

const BLOK = '--- METİN BAŞI ---\n{{MASKELI_METIN}}\n--- METİN SONU ---';
const t = (id: string, title: string, gorev: string): PromptTemplate =>
  ({ id, title, body: `${KORUMA}\n\n${BLOK}\n\n${gorev}`, builtIn: true });

export const BUILT_IN_TEMPLATES: readonly PromptTemplate[] = [
  t('genel', 'Genel hukuki değerlendirme', 'Görev: Metni bir Türk avukatı gözüyle incele. Hukuki nitelendirmeyi, uygulanabilecek mevzuatı, riskleri ve atılabilecek adımları maddeler halinde açıkla. {{GOREV}}'),
  t('dilekce', 'Dilekçe taslağı ya da iyileştirme', 'Görev: Metni esas alarak Türk usul hukukuna uygun bir dilekçe taslağı hazırla ya da mevcut dilekçeyi iyileştir. Başlık, taraflar, konu, açıklamalar, hukuki nedenler, deliller ve sonuç ve istem bölümlerini kullan. {{GOREV}}'),
  t('cevap', 'Karşı taraf dilekçesine cevap', 'Görev: Metin karşı tarafın dilekçesidir. İddiaları tek tek ele alarak cevap dilekçesi taslağı hazırla; usulden ve esastan itirazları ayır. {{GOREV}}'),
  t('sozlesme', 'Sözleşme incelemesi', 'Görev: Sözleşmeyi incele. Müvekkil aleyhine maddeleri, eksik hükümleri, belirsizlikleri ve önerilen değişiklikleri madde numarasıyla listele. {{GOREV}}'),
  t('ozet', 'Özet ve zaman çizelgesi', 'Görev: Metni özetle; olayları tarih sırasıyla zaman çizelgesi olarak ver; tarafların iddialarını ve dayandıkları delilleri ayrı başlıklarda göster. {{GOREV}}'),
  t('serbest', 'Serbest görev', '{{GOREV}}'),
];

/** Yer tutucuları doldurur. Görev boşsa satır sonundaki boşluk temizlenir. */
export function fillTemplate(tpl: PromptTemplate, masked: string, task = ''): string {
  return tpl.body.replace('{{MASKELI_METIN}}', () => masked).replace('{{GOREV}}', () => task.trim()).replace(/[ \t]+$/gm, '').trimEnd();
}
