# ADR-0002: Web sürümünde çözülmüş metin panodan otomatik temizlenmez

**Tarih:** 2026-10-26. **Durum:** kabul edildi.

**Çelişki.** MASTER 4.2 `Permissions-Policy: clipboard-read=()` ile sayfanın panoyu okumasını kapatır.
MASTER 4.8 web'de çözülmüş metnin süre dolunca "pano değişmediyse" temizlenmesini ister. Pano okunamadığından
bu koşul web'de denetlenemez (e2e testi okumanın kapalı olduğunu doğrular).

**Seçenekler.** (a) Süre dolunca koşulsuz temizlemek: kullanıcının arada kopyaladığı başka içeriği siler.
(b) Okuma iznini açmak: saldırı yüzeyini büyütür, 4.2'yi gevşetir. (c) Temizlememek, uyarmak.

**Karar.** (c). Çözülmüş metin web'de ilk kopyalandığında 4.8'deki uyarı gösterilir ve dosya indirme önerilir.
Masaüstünde temizleme işletim sisteminin pano sayacıyla koşullu yapılmaya devam eder.
