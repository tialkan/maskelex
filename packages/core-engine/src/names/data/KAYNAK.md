# Ad ve soyadı sözlüklerinin kaynağı

- **Kaynak:** `@faker-js/faker` Türkçe yerel verisi (`person.first_name.male/female/generic`, `person.last_name.generic`).
- **Lisans:** MIT. **Sürüm:** dosyaların `meta.version` alanında; `package.json`'da sabit.
- **Üretim:** `node scripts/build-name-lexicon.mjs`. Elle ad eklenmez ya da çıkarılmaz; yalnız 3 harften kısa adlar
  sıradan sözcüklerle çakıştığı için atılır.
- **Bilinen eksik:** Liste sıklık temelli değildir; bazı yaygın adlar yoktur (ör. "Ayşe"). Bu adlar rol ipucu,
  unvan ve kesme kanıtı kurallarıyla, model tabanlı NER bağlandığında da modelle bulunur. Sıklık temelli resmi bir
  kaynak (TÜİK) makine okunur ve lisansı açık biçimde sağlanırsa bu dosyaların yerine geçer.
