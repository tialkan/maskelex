# MASTER.md · MaskeLex Faz-1 Mimari, Kontrat ve Görev Dağılım Belgesi

| Alan | Değer |
|---|---|
| Ürün | MaskeLex (maskelex.com): avukatlar için tamamen cihaz içinde çalışan maskeleme ve geri çözme uygulaması |
| Faz | Faz-1: bağımsız web uygulaması (PWA) ve Tauri v2 masaüstü uygulaması (Windows, macOS). Harici LLM API entegrasyonu YOKTUR. |
| Belge sürümü | 1.0.0 · 25.10.2026 |
| Kontrat sürümü | `CONTRACT_VERSION = '1.0.0'` (Bölüm 2) |
| Hazırlayan | Baş Yazılım Mimarı ve Çoklu Ajan Orkestratörü |
| Durum | Ajanlara dağıtıma hazır. Bölüm 0.5'teki sorular sahibin onayını bekler; hiçbiri ajanların başlamasını engellemez. |

> **Doğrulama notu.** Bu belgedeki tüm TypeScript kodu (contracts.ts dahil) yazım sırasında katı ayarlarla (`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax`; tarayıcı modülleri ayrıca DOM kitaplığıyla) derlendi ve Ek C'deki 10 test dosyasıyla çalıştırıldı; tamamı yeşildir. "SÖZDE KOD" ya da "TASLAK" diye başlayan bloklar derlenmez ve öyle işaretlidir; diğer bütün kod blokları belgeden çıkarılıp boş bir klasörde derlenerek doğrulandı. "Başvuru uygulaması" etiketli kod, ilgili ajanın teslim edeceği modülün çekirdeğidir. Ajandan beklenen kodu yeniden icat etmesi değil; dosyaya alması, kontrat portuna bağlaması, eksik kısımlarını (adres motoru, NER çalıştırıcısı, belge okuyucu ve yazıcıları, arayüz, masaüstü kabuğu) yazması ve testleri genişletmesidir.

## İçindekiler

0. Belge yönetimi, kararlar ve varsayımlar
1. Sistem mimarisi ve monorepo klasör ağacı
2. Veri kontratları ve arayüzler (`contracts.ts`)
3. Çekirdek algoritma spesifikasyonları
4. Güvenlik ve sıfır sunucu garantileri
5. UI/UX bileşen spesifikasyonu
6. Alt ajan görev dağılımı ve çalıştırma promptları
- Ek A: Altın test seti şeması
- Ek B: Kaynaklar
- Ek C: Kabul testleri (çalıştırılmış)

---

## 0. Belge yönetimi, kararlar ve varsayımlar

### 0.1 Okuma sırası

| Okuyucu | Sıra |
|---|---|
| Her ajan | 0 → 1 → 2 → kendi bölümü (6.x) → 3'teki ilgili alt bölümler → 4 (güvenlik kuralları herkesi bağlar) → Ek C |
| AGENT-4 ayrıca | 5'in tamamı |
| AGENT-5 ayrıca | 4'ün tamamı, Ek A |
| Orkestratör | Tamamı |

Bu belge tek doğruluk kaynağıdır. Belge ile kod çelişirse belge geçerlidir; çelişki `docs/contract-requests/` altına yazılarak bildirilir.

### 0.2 Kararlar

Durum sütunu: **İSTEK** = ürün tarifinde açıkça istenmiş; **ÖNERİ** = mimarın önerisi, sahip itiraz edebilir (itiraz edilene kadar bağlayıcıdır). Karar değişirse eski satır silinmez, altına tarihli değişiklik notu eklenir (surec.md 1.2).

| No | Karar | Durum |
|---|---|---|
| K-01 | Faz-1'de harici LLM API'si yoktur. Akış: Maskele → Kopyala → Geri Çöz. | İSTEK |
| K-02 | Tek kod tabanı: pnpm monorepo. Web (PWA) ve Tauri v2 masaüstü aynı arayüz kodundan derlenir. | İSTEK |
| K-03 | Belge, metin ve eşleşme kasası hiçbir koşulda sunucuya gitmez. Sunucu yalnız statik dosya sunar. | İSTEK |
| K-04 | Web çatısı Vite + React + TypeScript'tir, Next.js değildir. Gerekçe 0.3'te. | ÖNERİ |
| K-05 | NER, Web Worker içinde ONNX Runtime Web ile çalışır. Model dosyaları web'de aynı kökenden (maskelex.com) iner, masaüstünde uygulamaya gömülür. İlk aday `akdeniz27/bert-base-turkish-cased-ner`; kesin seçim AGENT-2'nin ölçümüne bağlıdır (3.3.1). | ÖNERİ |
| K-06 | İçtihat koruması kapatılamaz. Yüksek mahkeme künyesi asla otomatik maskelenmez. Pencerede "kendi dosyanız olabilir" işareti varsa künye yine maskelenmez, yalnız İNCELE rozeti alır. | İSTEK + ek |
| K-07 | Şüphede maskele: hiçbir mahkeme işareti bulunamayan dosya numarası MASKELE (ORTA güven) sayılır. Gerekçe: emsalin yanlışlıkla maskelenmesinin bedeli küçük, müvekkil dosya numarasının sızmasının bedeli büyüktür. | ÖNERİ |
| K-08 | Soyadı çakışmasında tek başına geçen soyadı tahminle bağlanmaz. Rol veya cinsiyet ipucu tek adaya indirmiyorsa `[SOYAD_n]` grup etiketi verilir ve kullanıcıya sorulur. Geri çözmede grup etiketi ortak soyadına döner (kayıpsız). | İSTEK + ek |
| K-09 | Tutar Şaşırtma tek bir gizli `k` katsayısıyla oran korumalı ölçeklemedir. Geri çözmede yalnız birebir eşleşen ölçekli tutar geri alınır; türetilmiş tutar için yalnız öneri gösterilir, otomatik bölme yapılmaz. | ÖNERİ |
| K-10 | Etiket modunda maskeli metindeki ek, etiketin kendi okunuşuna göre yeniden çekilir (`Yılmaz'ın` → `[DAVACI_1]'in`). Böylece özgün adın ses bilgisi de dışarı çıkmaz. | ÖNERİ |
| K-11 | İlk kopyalamadan sonra kasa kilitlenir. Verilen etiket geri alınmaz ve yeniden numaralanmaz; rol değişirse eski etiket takma ad olarak çözülmeye devam eder. | ÖNERİ |
| K-12 | Kopyalamadan önce sızıntı denetimi zorunludur. Maskeli metinde maskelenmiş bir varlığın herhangi bir yüzeyi ya da YÜKSEK güvenli bir Katman 1 bulgusu kalırsa kopyalama, kullanıcı tek tek onaylamadıkça engellenir. | ÖNERİ |
| K-13 | Masaüstünde otomatik güncelleme yoktur. macOS derlemesi ağ yetkisi verilmemiş App Sandbox ile imzalanır. | ÖNERİ |
| K-14 | Hata izleme (GlitchTip/Sentry) ve analitik yoktur. | ÖNERİ |
| K-15 | Maskeli belge dışa aktarımı: UDF yerinde cerrahi yeniden yazımla, imza (`sign.sgn`) ve UYAP üst verisi (`documentproperties.xml`) düşürülerek; DOCX özgün paketten değil, AST'den temiz üretimle. Çıktı dosya adı daima nötrdür (`maskeli-7f3a.udf`). | ÖNERİ |
| K-16 | Kasa yalnız bellektedir. İsteğe bağlı, parolalı şifreli dışa aktarım (AES-256-GCM, PBKDF2-SHA256, 600.000 tur) vardır. | ÖNERİ |
| K-17 | Desteklenen alt sınır: Chromium 109+ (Edge ve WebView2 dahil), Firefox 115 ESR+, Safari/WebKit 16.4+, macOS 13.3+, Windows 10 22H2 ve Windows 11. | ÖNERİ |
| K-18 | Tarihler maskelenmez (doğum tarihi hariç). Gerekçe: süreler, zamanaşımı ve adli tatil hesabı gerçek takvime bağlıdır; tarih kaydırma hukuki yanıtı bozar. | ÖNERİ |
| K-19 | Kamu kurumları (Bakanlık, Belediye, SGK) tespit edilir ama varsayılan olarak maskelenmez; mahkeme adları hiç maskelenmez. | ÖNERİ |

### 0.3 surec.md uyarlaması

surec.md'nin kendi kuralı gereği ("körü körüne uygulama") her madde bu projeye göre değerlendirildi.

| surec.md maddesi | Durum | Uyarlama ve gerekçe |
|---|---|---|
| 0. Değişmez kurallar 1-8 | Aynen | Sırlar, sahip onayı, push'u sahibin yapması, yazım (uzun tire yok), uydurma yok, veri minimizasyonu aynen geçerlidir. Kural 6 (AI en az): Faz-1'de üretken AI çağrısı yoktur; yerel NER, kural katmanının yedeğidir, tek başına zorunlu değildir. |
| 1.2 plan.md ve Kararlar | Aynen | Bölüm 0.2 tablosu `plan.md`'ye aynen taşınır; sahip onayları orada işaretlenir. |
| 1.4 Marka | Aynen | Yerel barındırılan yazı tipleri, sahibin logosu; asistan logo üretmez. Değerler S-02 ile gelir. |
| 1.5 Repo düzeni | Uyarlandı | Veritabanı ve veri hattı yoktur (`db/`, `pipeline/` yok). `docs/adr`, `docs/sources`, `DEVIR.md`, `DEVIR-PROMPTU.md` aynen vardır. |
| 2. Teknoloji yığını | Uyarlandı | Next.js yerine Vite. Gerekçe: (1) Tauri statik dosya ister, sunucu tarafı işlemenin faydası yoktur; (2) Next.js statik çıktısı satır içi betikler üretir, bu da sıkı CSP'yi her sayfa için hash yönetimine bağlar; Vite çıktısında satır içi betik yoktur ve `script-src 'self'` yeterlidir; (3) Vite'ın Web Worker ve WASM desteği yerleşiktir; (4) Tauri'nin resmi şablonları Vite iledir. PostgreSQL, dbmate, OpenRouter, ORCID, Resend, GlitchTip bu fazda yoktur (sıfır sunucu). |
| 3.1 GitHub ve CI | Uyarlandı | Özel repo, `main` dalı. CI: typecheck, lint, birim testleri, altın test seti, `vite build`, Playwright, `check:copy`, `cargo deny`. Migration adımları yoktur. |
| 3.2-3.4 Hetzner, Coolify, Docker | Uyarlandı | Uygulama statiktir. Öneri: mevcut Hetzner + Coolify üzerinde nginx statik kapsayıcı. Sağlık denetimi `/surum.json` (commit kimliği). `start.sh`, migration ve 503 şema denetimi uygulanmaz. Alternatif Cloudflare Pages (S-01). |
| 3.5 Cloudflare | Aynen + ek | Cache Rule ve her deploy sonrası temizlik aynen. Ek: E-posta Adresi Gizleme, Rocket Loader, Web Analytics otomatik ekleme ve Zaraz KAPALI olmalıdır; bunlar sayfaya satır içi betik enjekte eder, CSP'yi bozar ve üçüncü taraf kod getirir. HSTS aşamalı. |
| 4. Deploy akışı | Aynen | Push'u sahip yapar. Göç adımı yoktur. Masaüstü sürümü etiketle (`v1.0.0`) tetiklenen ayrı iş akışıyla imzalanır. |
| 5. Veritabanı güvenliği | Uygulanmaz | Veritabanı yoktur. |
| 6. Web güvenliği | Sıkılaştırıldı | Satır içi betik olmadığından nonce ve hash gerekmez. POST, oturum ve çerez yoktur. Ayrıntı 4.2. |
| 7. Ürün kalıpları | Uygulanmaz | Hesap, yönetici paneli ve kullanıcı içeriği yoktur. |
| 8. SEO | Kısmen | Yalnız tanıtım sayfalarına uygulanır. `/uygulama/` `noindex` olur. |
| 9. Test ve doğrulama | Aynen + ek | Ek: "dış istek sıfır" testi, maskele/geri çöz tam tur testi, altın test seti eşikleri, gerçek UYAP Doküman Editörü ile elle kabul (V-02). |
| 10. Çalışma yöntemi | Aynen | Her ajan kendi dalında; her alt görev sonunda commit; paket sonunda 3-5 satır özet; büyük paket sonrası bağımsız denetim. |

### 0.4 Doğrulanmış bilgiler ve doğrulanacak varsayımlar

**Doğrulanmış (kaynakları Ek B'de):**

- **D-01 UDF yapısı.** UDF bir ZIP arşividir; `content.xml` (UYAP XML biçimi 1.8), `documentproperties.xml` (doğrulama kodu, seri numarası gibi UYAP üst verisi) ve imzalı belgelerde `sign.sgn` (PKCS#7 imza) içerir. Belge metni tek bir CDATA bloğundadır; paragraf, tablo ve stil öğeleri metne `startOffset` ve `length` ile başvurur. `Alignment` 0 sol, 1 orta, 2 sağ, 3 iki yana; renkler imzalı 32 bit ARGB tamsayıdır (siyah -16777216); görseller `imageData` özniteliğinde base64 olarak durur ve metinde `￼` yer tutucusu kaplar; boş paragraf `​` ile temsil edilir.
- **D-02 Tauri v2.** Varsayılan CSP yoktur (`null`). IPC için `connect-src` içinde `ipc: http://ipc.localhost` bulunmalıdır. COOP/COEP gibi başlıklar `app.security.headers` ile verilir ve yalnız üretim derlemesinde uygulanır. Windows'ta HTML5 sürükle-bırak için pencere ayarında `dragDropEnabled: false` gerekir.
- **D-03 Transformers.js.** `env.allowRemoteModels = false`, `env.localModelPath` ve `env.backends.onnx.wasm.wasmPaths` ayarlanmazsa WASM dosyaları varsayılan olarak CDN'den yüklenir; bu projede üçü de zorunludur. Güncel kararlı hat 4.x'tir.
- **D-04 İlk NER adayı.** `akdeniz27/bert-base-turkish-cased-ner`: BERTurk tabanlı, yaklaşık 110M parametre, etiketler `O, B/I-PER, B/I-ORG, B/I-LOC`; depoda fp32 ONNX dosyası (yaklaşık 440 MB) vardır; dinamik INT8 dışa aktarımı yaklaşık 106 MB olarak yayımlanmıştır. İkincil kaynaklar lisansı MIT bildirir (V-04).
- **D-05 MERSİS.** 16 hanedir; tüzel kişide vergi numarası, gerçek kişide T.C. kimlik numarası kullanılarak oluşturulur; anonim ve limited şirketlerde 0 ile başlar. Bu nedenle MERSİS doğrulaması gömülü VKN/TCKN sağlamasıyla yapılır.

**Doğrulanacak (sahip örnek dosyaları ve gerçek cihazlarla):**

| No | Varsayım | Nasıl doğrulanır | Sorumlu |
|---|---|---|---|
| V-01 | UDF ofset birimi UTF-16 kod birimidir (Java `String`). Türkçe karakterlerde kod noktasıyla aynıdır; yalnız 4 baytlık karakterlerde (emoji) ayrışır. | Okuyucu iki yorumu da dener; öğe aralıkları metin uzunluğuyla tutarlı olanı seçer. İkisi de tutarsızsa salt okunur moda düşer ve `OFFSET_UNIT_CODEPOINT` / `READ_ONLY_FALLBACK` uyarısı verir. | AGENT-3 |
| V-02 | UYAP Doküman Editörü, `documentproperties.xml` ve `sign.sgn` olmadan, yeniden yazılmış `content.xml` ile UDF'yi sorunsuz açar. | Sahip 10 gerçek UDF'yi maskeler, maskeli ve geri çözülmüş çıktıları editörde açar; ekran görüntüsüyle `docs/sources/udf-format.md`'ye işlenir. | Sahip + AGENT-3 |
| V-03 | Sıfırdan üretilen UDF'de boş paragraf için `​` zorunludur. | V-02 ile aynı oturumda iki varyant denenir. | Sahip + AGENT-3 |
| V-04 | Seçilen NER modelinin lisansı ticari kullanıma izin verir. | Model kartındaki lisans etiketi ve eğitim verisi lisansı `docs/sources/ner-model.md`'ye işlenir. Lisans belirsizse model kullanılmaz. | AGENT-2 |
| V-05 | Ad, soyadı ve ikiz sözlükleri için lisansı uygun bir kaynak vardır. | Kaynak ve lisans `docs/sources/lexicons.md`'ye işlenir. Uydurma liste kabul edilmez. | AGENT-2 |
| V-06 | Windows pano biçim bayrakları ve macOS `currentHostOnly` seçeneği, çözülmüş metnin pano geçmişine ve diğer cihazlara geçmesini engeller. | Gerçek Windows 11 (Pano geçmişi açık) ve iki Apple cihazıyla (Evrensel Pano açık) elle test. | AGENT-5 |
| V-07 | WebKit (Tauri macOS) sıkı CSP altında `'wasm-unsafe-eval'` ile ONNX WASM'ını derler. | macOS 13.3+ cihazda NER yükleme testi. | AGENT-5 |

### 0.5 Açık sorular (sahibe, tek tur)

| No | Soru | Seçenekler | Varsayılan (cevap gelene kadar) |
|---|---|---|---|
| S-01 | Barındırma | (a) Mevcut Hetzner + Coolify, nginx statik kapsayıcı (öneri) (b) Cloudflare Pages | (a) |
| S-02 | Marka | Ana renk, yazı tipleri, logo dosyası | Nötr lacivert yer tutucu `#1F3A5F`; Lato (arayüz) ve Crimson Pro (belge önizleme), yerel barındırılır |
| S-03 | Kod imzalama | Apple Developer Programı ve Windows kod imzalama sertifikası alınacak mı (ücretli, geri alınamaz satın alma) | Alınana kadar imzasız iç test derlemesi |
| S-04 | Masaüstü kurulum boyutu | Model gömülü (kurulum yaklaşık 110-130 MB büyür) kabul mü, yoksa modelsiz hafif sürüm mü | Model gömülü |
| S-05 | Dil | Yalnız Türkçe mi | Yalnız Türkçe |
| S-06 | Hesap ve ücret | Faz-1 hesapsız ve ücretsiz mi | Hesapsız, ücretsiz |
| S-07 | Kurulum türü | Yönetici hakkı gerektirmeyen kullanıcı düzeyi kurulum mu | Kullanıcı düzeyi (Windows NSIS per-user) |

### 0.6 Ürün iddiaları ve hukuki dil

1. **Maskeleme takma adlandırmadır.** Kasa avukatta durduğu sürece yeniden tanımlama mümkündür. Arayüz ve tanıtım metinleri "anonimleştirme garantisi", "KVKK'ya tam uyum", "ihlali engeller" gibi ifadeler KULLANMAZ. Kullanılacak dil: "kişisel verileri cihazınızda maskeler", "belgeniz cihazınızdan çıkmaz", "riski azaltır".
2. **Bağlam riski.** Adlar maskelense de olayın kendine özgü ayrıntıları kişiyi belirleyebilir. Maskeli metin panelinde kalıcı kısa not bulunur: "Maskeleme, kişiyi belirleyebilecek olay ayrıntılarını kaldırmaz. Göndermeden önce metni gözden geçirin."
3. **Sorumluluk.** Neyin gönderileceğine avukat karar verir; uygulama bir araçtır.
4. **KVKK aydınlatma metni ürünle birebir tutarlı olur:** belge içeriği işlenmez ve iletilmez; çerez yoktur; barındırma sağlayıcısında yalnız erişim kaydı (IP, zaman, istenen yol) tutulur, saklama süresi S-01 ile netleşir.

---

## 1. Sistem mimarisi ve monorepo klasör ağacı

### 1.1 Mimari ilkeler

1. **Yerel önce.** Tüm tespit, maskeleme, geri çözme ve belge işleme kullanıcının cihazında, Web Worker içinde yapılır.
2. **Kural önce, model sonra.** Katman 1-2 (kural ve sağlama) anında sonuç verir. NER ek bir katmandır; yüklenmemiş ya da kapalıyken uygulama çalışmaya devam eder.
3. **Şüphede maskele, içtihatta koru.** Belirsiz dosya numarası maskelenir; yüksek mahkeme künyesi hiçbir koşulda otomatik maskelenmez.
4. **Kontrat önce.** Ajanlar birbirinin koduna değil, yalnız `contracts.ts` portlarına bağlıdır.
5. **Kayıpsız tam tur.** Maskele ve aynı etiketlerle geri çöz işlemi özgün metni birebir verir (Ek C, t9).
6. **Sunucuya güvenme, kanıt göster.** Sunucu yalnız statik dosya sunar. Ağ Denetçisi ve sızıntı denetimi, kullanıcıya verinin çıkmadığını gösterir.
7. **Gizlilik kodda.** Kullanıcı metni log'a yazılmaz, `Math.random` kullanılmaz, kasa ana iş parçacığına gönderilmez (1.8).

### 1.2 Çalışma zamanı topolojisi

```
+------------------------- Tarayıcı sekmesi  /  Tauri WebView ---------------------------+
|                                                                                         |
|  ANA İŞ PARÇACIĞI (arayüz)                                                              |
|   React + Zustand | NetworkMonitor | Trusted Types varsayılan politikası | Platform     |
|   (Kasa BURADA YOK. Yalnız AnalysisResult / UnmaskResult görüntülenir.)                |
|          |  Comlink (postMessage)                                                       |
|          v                                                                              |
|  ENGINE WORKER  (packages/core-engine + packages/document-parsers)                      |
|   Kasa (MaskingSessionVault) | Katman 1-2 dedektörleri | birleştirme | coref           |
|   etiket atama | fonetik ikiz | maskeli metin | sızıntı denetimi | geri çözme            |
|   UDF / DOCX okuma ve yazma                                                             |
|          |  MessageChannel (ana iş parçacığı kurar, portu iki worker'a aktarır)          |
|          v                                                                              |
|  NER WORKER                                                                             |
|   Transformers.js + ONNX Runtime Web (WASM; doğrulanmışsa WebGPU)                       |
|   Model ve WASM dosyaları yalnız aynı kökenden: /models/..., /ort/...                   |
+-----------------------------------------------------------------------------------------+
  Web:       Service Worker uygulama kabuğunu ve modeli önbellekte tutar (ilk ziyaretten sonra çevrimdışı).
  Masaüstü:  Service Worker yok. Dosyalar Tauri özel protokolünden gelir. Rust tarafı yalnız
             "gizli pano" ve "dosya kaydet" komutlarını sunar; ağ kütüphanesi içermez.
```

### 1.3 Veri akışı (3 adım)

```
ADIM 1  Girdi ve maskeleme
  Kullanıcı metni yapıştırır / .udf .docx .txt sürükler
  UI -> engine.loadDocument(input)            codec.sniff + codec.read -> DocumentAST -> text
  UI -> engine.analyze(docId, onUpdate)
        a) AGENT-1 detect (senkron)  + AGENT-2 ad kuralları   -> onUpdate(phase = DETERMINISTIC)
        b) NER worker parça parça                              -> onUpdate(phase = NER_PARTIAL) ...
        c) birleştirme -> coref -> etiket -> (ikiz) -> ses profili -> onUpdate(phase = COMPLETE)
  Kullanıcı düzeltir: engine.command(SET_ROLE | SET_STATUS | ADD_MANUAL | RESOLVE_GROUP ...)

ADIM 2  Kopyalama
  UI -> engine.buildMasked(docId, templateId, task) -> MaskedOutput (+ sızıntı bulguları)
  Bulgu yoksa: platform.copyText(text, 'MASKED')  ->  engine.markIssued(docId)  (kasa kilitlenir)

ADIM 3  Geri çözme ve çıktı
  Kullanıcı LLM yanıtını sağ panele yapıştırır
  UI -> engine.unmask(response) -> UnmaskResult (metin + değişiklikler + sorunlar)
  Kullanıcı sorunları çözer -> platform.copyText(text, 'SENSITIVE')  veya
                               engine.exportFile({ source: 'UNMASKED', format: 'udf' | 'docx' })
```

### 1.4 Teknoloji yığını

| Katman | Seçim | Not |
|---|---|---|
| Paket yöneticisi | pnpm workspace, Node LTS | `pnpm-lock.yaml` commit'lenir. Bağımlılıkların kurulum betikleri varsayılan kapalı, yalnız izin listesindekiler (`onlyBuiltDependencies`, ör. esbuild) çalışır. |
| Dil | TypeScript | `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax` |
| Arayüz | React + Vite | Çok sayfalı derleme: `/` tanıtım (statik HTML), `/uygulama/` uygulama |
| Durum | Zustand | Yalnız arayüz durumu; kasa yok |
| Worker RPC | Comlink | Geri çağrılar `Comlink.proxy` ile |
| NER | `@huggingface/transformers` (4.x hattı) + `onnxruntime-web` | WASM yolu ve modeller aynı kökenden |
| ZIP | fflate | Worker uyumlu |
| XML | UDF: kendi tırnak farkındalıklı tarayıcımız (3.5.3). DOCX okuma: `saxes`. | `DOMParser` Web Worker'da yoktur; KULLANILMAZ |
| DOCX yazma | Kendi küçük yazıcımız (öneri) ya da `docx` paketi | AGENT-3 seçer, ADR yazar. Çıktı üst veri (yazar, şirket) içermez. |
| PWA | vite-plugin-pwa (Workbox), `injectRegister: null` ile elle kayıt | Satır içi betik üretmez |
| Masaüstü | Tauri v2; eklentiler: dialog (kaydet), fs (yalnız seçilen yola yazma) | updater, shell, http, opener eklentileri YOK |
| Test | Vitest, fast-check (özellik testleri), Playwright | |
| Lint ve biçim | ESLint (typescript-eslint) + 1.8 kuralları, Prettier | |

Sürümler ilk kurulumda en güncel kararlı sürüme **tam olarak** sabitlenir (`^` ve `~` yok). Sürüm yükseltmesi ayrı commit ve CI yeşili ister.

### 1.5 Monorepo klasör ağacı

Sahip sütunu: **O** orkestratör (Faz-0'da kurar), **A1-A5** ajanlar. Sahibi olmayan ajan dosyayı yalnız okur.

```
maskelex/
  MASTER.md                                    O   Bu belge
  plan.md                                      O   Kararlar (0.2) ve açık soruların sahip onaylı kaydı
  DEVIR.md                                     O   Teslim notları, en yeni en üstte
  DEVIR-PROMPTU.md                             O   Başka bir modele devir metni (surec.md 10)
  package.json                                 O   Kök betikler: typecheck, lint, test, test:golden, build, e2e, check:copy
  pnpm-workspace.yaml                          O   packages/*, apps/*
  tsconfig.base.json                           O   Ortak katı TypeScript ayarları
  eslint.config.js                             O   1.8 kuralları
  .prettierrc  .editorconfig  .nvmrc  .npmrc   O
  .gitignore                                   O   node_modules, dist, target, .env*, apps/web/public/models/**, *.onnx
  .github/workflows/ci.yml                     A5  typecheck, lint, test, test:golden, build, e2e, check:copy, cargo deny
  .github/workflows/release-desktop.yml        A5  Etiketle tetiklenen imzalı Windows/macOS derlemesi
  scripts/check-copy.mjs                       A5  Uzun tire (U+2014) ve kısa tire (U+2013) denetimi; i18n ve md dosyaları
  scripts/fetch-model.mjs                      A2  Modeli geliştirici/CI makinesinde indirir, SHA-256 doğrular, public/models'e koyar
  scripts/build-lexicons.mjs                   A2  Ad, soyadı, ikiz sözlüklerini kaynaktan JSON'a derler; ses anahtarlarını önceden hesaplar
  docs/adr/0001-vite-nextjs-yerine.md          O
  docs/adr/0002-udf-cerrahi-yazim.md           A3
  docs/adr/0003-ner-model-secimi.md            A2
  docs/adr/0004-docx-yazici.md                 A3
  docs/sources/ner-model.md                    A2  Model kartı, lisans, dosya SHA-256'ları
  docs/sources/lexicons.md                     A2  Sözlük kaynakları ve lisansları
  docs/sources/udf-format.md                   A3  Gerçek örneklerden gözlenen UDF yapısı (V-01..V-03)
  docs/contract-requests/                      tümü Kontrat değişiklik istekleri (yalnız ekleme)

  packages/core-engine/
    package.json                               O   exports: "." -> src/index.ts, "./types" -> src/types/contracts.ts, "./testing" -> src/testing/index.ts
    src/index.ts                               O   Kamuya açık dışa aktarımlar
    src/types/contracts.ts                     O   DONDURULMUŞ kontratlar (Bölüm 2)
    src/text/turkish.ts                        O   Türkçe harf işlemleri, lowerView, sınır denetimleri (3.1.2)
    src/text/numberWords.ts                    A1  Sayı -> Türkçe yazı (3.1.2)
    src/text/random.ts                         A5  Kriptografik RandomSource + tohumlu test kaynağı
    src/validators/checksums.ts                A1  TCKN/YKN, VKN, MERSİS, TR IBAN, Luhn, test üreticileri (3.1.3)
    src/detectors/deterministic/reference.ts   A1  Başvuru uygulaması (3.1.4); zamanla aşağıdaki modüllere bölünür
    src/detectors/deterministic/index.ts       A1  DeterministicDetectorPort uygulaması
    src/detectors/deterministic/ids.ts         A1  TCKN, YKN, VKN, MERSİS, IBAN, kart, pasaport
    src/detectors/deterministic/contact.ts     A1  Telefon, e-posta, KEP
    src/detectors/deterministic/plate.ts       A1  Plaka ve negatif bağlam filtresi
    src/detectors/deterministic/address.ts     A1  Adres kural motoru (3.1.5)
    src/detectors/deterministic/dates.ts       A1  Doğum tarihi
    src/detectors/deterministic/longNumber.ts  A1  Düşük güvenli uzun numara ipucu
    src/legal/citation.ts                      A1  İçtihat Koruma Filtresi (3.2.2)
    src/legal/lawRefs.ts                       A1  Kanun atıfları (korunan aralık)
    src/legal/landAndNotary.ts                 A1  Tapu ve yevmiye
    src/fuzz/amount.ts                         A1  Tutar tespiti ve oran korumalı ölçekleme (3.2.3)
    src/ner/client.ts                          A2  NerPort istemcisi (Engine Worker tarafı)
    src/ner/ner.worker.ts                      A2  NER Worker girişi (3.3.2)
    src/ner/pretokenize.ts                     A2  BERT uyumlu ön belirteçleme, kelime ofsetleri
    src/ner/windows.ts                         A2  Pencereleme ve örtüşme birleştirme
    src/ner/bio.ts                             A2  BIO birleştirme, etiket eşleme
    src/ner/modelConfig.ts                     A2  Model kimliği, dosya adları, SHA-256, etiket haritası
    src/names/ruleDetector.ts                  A2  NameRuleDetectorPort: rol ipucu, unvan, sözlük, şirket tür eki (3.3.4)
    src/names/lexicon.ts                       A2  Sözlük yükleme ve sorgu
    src/names/data/given-names.json            A2  ad -> cinsiyet
    src/names/data/surnames.json               A2
    src/names/data/twin-lexicon.json           A2  İkiz adayları ve ses anahtarları
    src/names/data/org-terms.json              A2  Şirket tür ekleri, sektör kısaltmaları, kamu kurumu başları, mahkeme başları
    src/coref/persons.ts                       A2  Kişi kümeleme (3.3.5)
    src/coref/orgs.ts                          A2  Şirket ve kurum kanonikleştirme
    src/coref/index.ts                         A2  CorefPort
    src/morphology/morphology.ts               A2  Çekim eki motoru (3.4.3)
    src/twins/twins.ts                         A2  Fonetik İkiz (3.4.5)
    src/unmask/rehydrate.ts                    A2  Geri çözme (3.4.4)
    src/pipeline/engine.ts                     O   MaskingEngineApi bileşimi (3.0.1)
    src/pipeline/merge.ts                      O   Bulgu birleştirme (3.0.2)
    src/pipeline/maskText.ts                   O   Etiket atama ve maskeli metin (3.0.3)
    src/pipeline/leakAudit.ts                  O   Sızıntı denetimi (3.0.4)
    src/pipeline/templates.ts                  A4  Hukuki prompt şablonları (5.11)
    src/vault/store.ts                         A5  VaultStorePort
    src/vault/crypto.ts                        A5  Şifreli dışa/içe aktarım (4.7)
    src/worker/engine.worker.ts                O   Comlink ile MaskingEngineApi'yi açar
    src/testing/index.ts                       O   MockEngine, sahte NER, tohumlu RandomSource
    test/a1/ test/a2/ test/o/ test/a5/         ilgili sahip

  packages/document-parsers/
    package.json                               O   exports: "." -> src/index.ts
    src/index.ts                               A3  Codec kaydı ve biçim tanıma
    src/ast/remap.ts                           A3  Ofset eşleyici (3.5.2)
    src/ast/plaintext.ts                       A3  txt/md -> AST
    src/ast/markdown.ts                        A3  MarkdownToAst (3.5.9)
    src/xml/scan.ts                            A3  Tırnak farkındalıklı XML etiket tarayıcı
    src/udf/zip.ts                             A3  ZIP okuma/yazma ve girdi politikası (3.5.6)
    src/udf/contentXml.ts                      A3  CDATA, ofsetli öğe tarama, cerrahi yazım (3.5.3)
    src/udf/reader.ts                          A3  content.xml -> AST (3.5.4)
    src/udf/writer.ts                          A3  AST -> yeni UDF (3.5.5)
    src/udf/codec.ts                           A3  DocumentCodec
    src/docx/reader.ts                         A3  DOCX -> AST (3.5.7)
    src/docx/writer.ts                         A3  AST -> temiz DOCX (3.5.8)
    src/docx/codec.ts                          A3  DocumentCodec
    test/fixtures/                             A3+A5  Yalnız sentetik .udf/.docx (gerçek kişi verisi YOK)

  packages/test-corpus/                        A5  Altın test seti (Ek A)
    src/generators/ids.ts                      A5  Sağlaması geçerli sentetik numaralar
    src/generators/names.ts                    A5  Sözlükten tohumlu ad üretimi
    src/generators/documents.ts                A5  Dilekçe, ihtarname, sözleşme, bilirkişi raporu şablonları
    golden/*.jsonl                             A5  Etiketlenmiş vakalar
    src/runner.ts  src/metrics.ts              A5  Çalıştırıcı ve ölçütler

  apps/web/
    index.html                                 A4  Tanıtım sayfası (statik, SEO)
    uygulama/index.html                        A4  Uygulama girişi (noindex)
    guvenlik/index.html kvkk/index.html sss/index.html indir/index.html   A4
    vite.config.ts                             A4  Çok sayfa, worker, PWA; --mode desktop
    src/main.tsx                               A4  Önce güvenlik kurulumu (4.4, 4.5), sonra uygulama
    src/app/App.tsx                            A4  İskelet, adım çubuğu
    src/app/store.ts                           A4  Arayüz durumu (5.2)
    src/app/engineClient.ts                    A4  Worker'ları kurar, MessageChannel'ı bağlar, Comlink sarmalayıcı
    src/components/**                          A4  5.3'teki bileşenler
    src/security/networkMonitor.ts             A4  Ağ Denetçisi (4.5)
    src/security/trustedTypes.ts               A4  Varsayılan Trusted Types politikası (4.4)
    src/security/inputHardening.ts             A4  Yazım denetimi, çeviri ve eklenti sertleştirmesi (4.6)
    src/platform/webAdapter.ts                 A4  PlatformAdapter (web)
    src/platform/index.ts                      A4  '@platform' takma adı: web veya masaüstü bağdaştırıcısı
    src/sw/registerSW.ts                       A4  Service Worker'ın elle kaydı
    src/styles/tokens.css src/styles/app.css   A4
    src/i18n/tr.ts                             A4  Tüm arayüz metinleri
    public/fonts/ public/ort/ public/icons/    A4  Yerel yazı tipleri, ORT WASM dosyaları
    public/manifest.webmanifest robots.txt sitemap.xml llms.txt .well-known/security.txt   A4
    deploy/Dockerfile deploy/nginx.conf deploy/security-headers.conf   A5

  apps/desktop-tauri/
    package.json                               A5  tauri dev/build; ön yüz = apps/web --mode desktop
    src/platform/tauriAdapter.ts               A5  PlatformAdapter (masaüstü)
    src-tauri/Cargo.toml build.rs              A5
    src-tauri/tauri.conf.json                  A5  CSP, başlıklar, pencere, paketleme (4.3)
    src-tauri/capabilities/default.json        A5  İzinler (4.3)
    src-tauri/src/main.rs src/lib.rs           A5
    src-tauri/src/clipboard.rs                 A5  Gizli pano komutları (4.8)
    src-tauri/entitlements.plist               A5  macOS sandbox, ağ yetkisi yok
    src-tauri/deny.toml                        A5  cargo-deny: ağ istemci kütüphaneleri yasak

  e2e/                                         A5  Playwright senaryoları (4.11, 6.5)
  test/                                        O   Ek C kabul testleri (t1-t10); pnpm test:acceptance
```

### 1.6 Bağımlılık politikası

- Yeni çalışma zamanı bağımlılığı yalnız ADR ile eklenir. ADR şunları içerir: lisans (MIT, Apache-2.0, BSD, ISC kabul; GPL/AGPL/SSPL ret), boyut etkisi, çalışma zamanında ağ isteği yapmadığının kod incelemesiyle doğrulanması, bakım durumu.
- İzinli çalışma zamanı paketleri (başlangıç listesi): react, react-dom, zustand, comlink, fflate, saxes, @huggingface/transformers, onnxruntime-web, @tauri-apps/api, @tauri-apps/plugin-dialog, @tauri-apps/plugin-fs. Geliştirme: typescript, vite, @vitejs/plugin-react, vite-plugin-pwa, vitest, fast-check, @playwright/test, eslint, typescript-eslint, prettier.
- CI'da `pnpm audit --prod` ve Rust tarafında `cargo deny check` zorunludur.
- CDN'den hiçbir dosya yüklenmez (yazı tipi, WASM, model dahil).

### 1.7 Derleme hedefleri

| Hedef | Komut | Özellikler |
|---|---|---|
| Web | `pnpm --filter web build` | Çok sayfa; Service Worker; `/models/` ve `/ort/` kopyalanır; `surum.json` (commit, tarih) üretilir; COOP/COEP/CSP başlıkları sunucuda (4.2) |
| Masaüstü ön yüzü | `pnpm --filter web build --mode desktop` | Yalnız uygulama sayfası `index.html` olarak; Service Worker YOK; `@platform` takma adı `tauriAdapter`'a çözülür; modeller `dist/models` içinde |
| Masaüstü paket | `pnpm --filter desktop-tauri tauri build` | Windows NSIS (kullanıcı düzeyi) + MSI; macOS evrensel ikili (.dmg), sandbox, imza ve noter onayı (S-03) |

### 1.8 Kodlama kuralları (zorunlu, ESLint ile denetlenir)

| No | Kural | Denetim |
|---|---|---|
| R-01 | Kullanıcı metni hiçbir log'a, hata iletisine, `console`'a, `Error.message`'a yazılmaz. Yalnız `log.event(kod, {sayısal alanlar})`. | `no-console: error`; `MaskelexError.message` sabit metindir |
| R-02 | Regex'te lookbehind (`(?<=`, `(?<!`) yasaktır (WebKit 16.4 öncesinde sözdizimi hatası). Sınırlar `leftBoundary` / `rightBoundary` ile denetlenir. | ESLint `no-restricted-syntax` (regex literal) + CI'da tüm `new RegExp` dizgelerini tarayan test |
| R-03 | Türkçe büyük/küçük harf duyarsız arama `/i` bayrağıyla yapılmaz: JS'in `/i` bayrağı "İ" (U+0130) harfini "i" ile eşlemez. Bağlam desenleri küçük harfle yazılır ve `lowerView()` üzerinde çalışır. ASCII dışı harf içermeyen desenlerde `/i` serbesttir. | Kod incelemesi + `ASLİYE`, `MERSİS`, `DOĞUM TARİHİ` içeren büyük harf testleri |
| R-04 | `Math.random` yasaktır; `RandomSource` kullanılır. | `no-restricted-properties` |
| R-05 | `innerHTML`, `outerHTML`, `insertAdjacentHTML`, `dangerouslySetInnerHTML`, `eval`, `new Function`, `document.write`, string ile `setTimeout` yasaktır. | `no-restricted-properties`, `react/no-danger`, `no-implied-eval` |
| R-06 | `fetch`, `XMLHttpRequest`, `WebSocket`, `EventSource`, `navigator.sendBeacon`, `RTCPeerConnection` yalnız `src/ner/**` (aynı köken model yükleme) ve `src/sw/**` içinde kullanılabilir. | `no-restricted-globals` (dosya bazlı istisna) |
| R-07 | Metin indeksleri UTF-16 kod birimidir. Ofset hesabında `Array.from(str)` veya `[...str]` uzunluğu kullanılmaz. | Kod incelemesi + emoji içeren testler |
| R-08 | Pano, dosya ve pencere yan etkileri yalnız `PlatformAdapter` üzerinden yapılır. | Kod incelemesi |
| R-09 | `MaskingSessionVault` nesnesi Engine Worker dışına çıkmaz. | Comlink API imzaları kasa tipi döndürmez |
| R-10 | Arayüz metinleri yalnız `i18n/tr.ts` içindedir; uzun tire içermez. | `check:copy` |
| R-11 | Worker'a özgü kod ince bir kabuktadır; çekirdek mantık saf fonksiyondur ve Node'da test edilir. | Kod incelemesi |

---

## 2. Veri kontratları ve arayüzler

### 2.1 Kontrat kuralları

1. `packages/core-engine/src/types/contracts.ts` Faz-0'da orkestratör tarafından aşağıdaki haliyle repoya konur ve **dondurulur**.
2. Ajanlar bu dosyayı değiştirmez. Eksik ya da hatalı bir tip görürse kodu değiştirmeden `docs/contract-requests/AGENT-<n>-<konu>.md` dosyası yazar (ne, neden, önerilen tip) ve orkestratöre bildirir. Orkestratör değişikliği `CONTRACT_VERSION` artırarak tek commit'te yapar ve tüm ajanlara duyurur.
3. Ajanlar kendi modüllerinde iç tipler tanımlayabilir; ancak port imzaları (Bölüm 8 başlığı altındaki arayüzler) birebir uygulanır.
4. Paylaşılan tipler `@maskelex/core-engine/types` yolundan içe aktarılır.

### 2.2 `packages/core-engine/src/types/contracts.ts` (tam kod)

```ts
// packages/core-engine/src/types/contracts.ts
// MaskeLex Faz-1 VERİ KONTRATLARI · sürüm 1.0.0
// DONDURULMUŞTUR. Yalnız orkestratör değiştirir. Değişiklik isteği: docs/contract-requests/AGENT-<n>-<konu>.md
// Bu dosya çalışma zamanı bağımlılığı içermez: yalnız tipler, sabitler ve saf yardımcılar.
// Tüm metin indeksleri UTF-16 kod birimidir (JS string indeksi), aralıklar [start, end) yarı açıktır.

export const CONTRACT_VERSION = '1.0.0' as const;

/* ═════════════════════════ 0. TEMEL TİPLER ═════════════════════════ */

export interface TextSpan { readonly start: number; readonly end: number }
/** Oturum içinde benzersiz kimlikler. Biçimler: "E-0001", "M-000001", "D-01", "G-01". */
export type EntityId = string;
export type MentionId = string;
export type DocumentId = string;
export type GroupId = string;
/** 128 bit kriptografik rastgele, 32 karakter hex. */
export type SessionId = string;
export type Confidence = 'HIGH' | 'MEDIUM' | 'LOW';
export const CONFIDENCE_RANK: Readonly<Record<Confidence, number>> = { HIGH: 3, MEDIUM: 2, LOW: 1 };

/** Kriptografik rastgele kaynak. Üretimde crypto.getRandomValues; testte tohumlu sahte. Math.random YASAK. */
export interface RandomSource {
  nextUint32(): number;
  /** [0, 1) */
  nextFloat(): number;
}

/* ═════════════════════════ 1. KATEGORİLER VE ROLLER ═════════════════════════ */

export const ENTITY_CATEGORIES = [
  'KISI', 'SIRKET', 'KURUM', 'ADRES',
  'TCKN', 'YKN', 'VKN', 'MERSIS', 'PASAPORT',
  'IBAN', 'KART', 'TUTAR',
  'TELEFON', 'EPOSTA',
  'PLAKA', 'DOSYA_NO', 'TAPU', 'YEVMIYE',
  'DOGUM_TARIHI', 'OZEL',
] as const;
export type EntityCategory = (typeof ENTITY_CATEGORIES)[number];

export type CategoryGroup = 'KISI_KURUM' | 'KIMLIK' | 'FINANS' | 'ILETISIM' | 'ADRES' | 'DOSYA' | 'ARAC' | 'TARIH' | 'DIGER';
export type AgentId = 'AGENT-1' | 'AGENT-2' | 'AGENT-3' | 'AGENT-4' | 'AGENT-5';

export interface CategorySpec {
  /** Etiket gövdesi: [KİŞİ_1], [ŞİRKET_A], [TCKN_1] */
  readonly tokenLabel: string;
  readonly displayName: string;
  readonly group: CategoryGroup;
  /** apps/web/src/styles/tokens.css içindeki renk değişkeni */
  readonly colorVar: string;
  /** Tespit edildiğinde varsayılan olarak maskelenir mi */
  readonly defaultMasked: boolean;
  readonly index: 'NUMERIC' | 'ALPHA';
  /** Fonetik İkiz modunda sentetik ad alabilir mi */
  readonly twinCapable: boolean;
  /** Tespitinden sorumlu ajan */
  readonly detectorOwner: AgentId;
}

export const CATEGORY_SPECS: Readonly<Record<EntityCategory, CategorySpec>> = {
  KISI:         { tokenLabel: 'KİŞİ',         displayName: 'Kişi',              group: 'KISI_KURUM', colorVar: '--mlx-c-kisi',     defaultMasked: true,  index: 'NUMERIC', twinCapable: true,  detectorOwner: 'AGENT-2' },
  SIRKET:       { tokenLabel: 'ŞİRKET',       displayName: 'Şirket',            group: 'KISI_KURUM', colorVar: '--mlx-c-sirket',   defaultMasked: true,  index: 'ALPHA',   twinCapable: true,  detectorOwner: 'AGENT-2' },
  KURUM:        { tokenLabel: 'KURUM',        displayName: 'Kamu kurumu',       group: 'KISI_KURUM', colorVar: '--mlx-c-kurum',    defaultMasked: false, index: 'NUMERIC', twinCapable: false, detectorOwner: 'AGENT-2' },
  ADRES:        { tokenLabel: 'ADRES',        displayName: 'Adres',             group: 'ADRES',      colorVar: '--mlx-c-adres',    defaultMasked: true,  index: 'NUMERIC', twinCapable: false, detectorOwner: 'AGENT-1' },
  TCKN:         { tokenLabel: 'TCKN',         displayName: 'T.C. kimlik no',    group: 'KIMLIK',     colorVar: '--mlx-c-kimlik',   defaultMasked: true,  index: 'NUMERIC', twinCapable: false, detectorOwner: 'AGENT-1' },
  YKN:          { tokenLabel: 'YKN',          displayName: 'Yabancı kimlik no', group: 'KIMLIK',     colorVar: '--mlx-c-kimlik',   defaultMasked: true,  index: 'NUMERIC', twinCapable: false, detectorOwner: 'AGENT-1' },
  VKN:          { tokenLabel: 'VKN',          displayName: 'Vergi kimlik no',   group: 'KIMLIK',     colorVar: '--mlx-c-kimlik',   defaultMasked: true,  index: 'NUMERIC', twinCapable: false, detectorOwner: 'AGENT-1' },
  MERSIS:       { tokenLabel: 'MERSİS',       displayName: 'MERSİS no',         group: 'KIMLIK',     colorVar: '--mlx-c-kimlik',   defaultMasked: true,  index: 'NUMERIC', twinCapable: false, detectorOwner: 'AGENT-1' },
  PASAPORT:     { tokenLabel: 'PASAPORT',     displayName: 'Pasaport no',       group: 'KIMLIK',     colorVar: '--mlx-c-kimlik',   defaultMasked: true,  index: 'NUMERIC', twinCapable: false, detectorOwner: 'AGENT-1' },
  IBAN:         { tokenLabel: 'IBAN',         displayName: 'IBAN',              group: 'FINANS',     colorVar: '--mlx-c-finans',   defaultMasked: true,  index: 'NUMERIC', twinCapable: false, detectorOwner: 'AGENT-1' },
  KART:         { tokenLabel: 'KART',         displayName: 'Kart no',           group: 'FINANS',     colorVar: '--mlx-c-finans',   defaultMasked: true,  index: 'NUMERIC', twinCapable: false, detectorOwner: 'AGENT-1' },
  TUTAR:        { tokenLabel: 'TUTAR',        displayName: 'Tutar',             group: 'FINANS',     colorVar: '--mlx-c-finans',   defaultMasked: false, index: 'NUMERIC', twinCapable: false, detectorOwner: 'AGENT-1' },
  TELEFON:      { tokenLabel: 'TELEFON',      displayName: 'Telefon',           group: 'ILETISIM',   colorVar: '--mlx-c-iletisim', defaultMasked: true,  index: 'NUMERIC', twinCapable: false, detectorOwner: 'AGENT-1' },
  EPOSTA:       { tokenLabel: 'EPOSTA',       displayName: 'E-posta / KEP',     group: 'ILETISIM',   colorVar: '--mlx-c-iletisim', defaultMasked: true,  index: 'NUMERIC', twinCapable: false, detectorOwner: 'AGENT-1' },
  PLAKA:        { tokenLabel: 'PLAKA',        displayName: 'Araç plakası',      group: 'ARAC',       colorVar: '--mlx-c-plaka',    defaultMasked: true,  index: 'NUMERIC', twinCapable: false, detectorOwner: 'AGENT-1' },
  DOSYA_NO:     { tokenLabel: 'DOSYA_NO',     displayName: 'Dosya no',          group: 'DOSYA',      colorVar: '--mlx-c-dosya',    defaultMasked: true,  index: 'NUMERIC', twinCapable: false, detectorOwner: 'AGENT-1' },
  TAPU:         { tokenLabel: 'TAPU',         displayName: 'Tapu kaydı',        group: 'DOSYA',      colorVar: '--mlx-c-dosya',    defaultMasked: true,  index: 'NUMERIC', twinCapable: false, detectorOwner: 'AGENT-1' },
  YEVMIYE:      { tokenLabel: 'YEVMİYE',      displayName: 'Noter yevmiye no',  group: 'DOSYA',      colorVar: '--mlx-c-dosya',    defaultMasked: true,  index: 'NUMERIC', twinCapable: false, detectorOwner: 'AGENT-1' },
  DOGUM_TARIHI: { tokenLabel: 'DOĞUM_TARİHİ', displayName: 'Doğum tarihi',      group: 'TARIH',      colorVar: '--mlx-c-tarih',    defaultMasked: true,  index: 'NUMERIC', twinCapable: false, detectorOwner: 'AGENT-1' },
  OZEL:         { tokenLabel: 'GİZLİ',        displayName: 'Diğer / elle',      group: 'DIGER',      colorVar: '--mlx-c-ozel',     defaultMasked: true,  index: 'NUMERIC', twinCapable: false, detectorOwner: 'AGENT-1' },
};

export const LEGAL_ROLES = [
  'DAVACI', 'DAVALI', 'SANIK', 'SUPHELI', 'MUSTEKI', 'MAGDUR', 'KATILAN', 'TANIK', 'BILIRKISI',
  'ALACAKLI', 'BORCLU', 'MUVEKKIL', 'VEKIL', 'MIRASBIRAKAN', 'MIRASCI', 'KIRAYA_VEREN', 'KIRACI',
  'ISVEREN', 'ISCI', 'KEFIL', 'UCUNCU_KISI', 'BASVURUCU', 'MUDAHIL', 'HAKIM', 'SAVCI', 'ARABULUCU',
  'NOTER', 'BELIRSIZ',
] as const;
export type LegalRole = (typeof LEGAL_ROLES)[number];

/** Kişi etiketlerinin gövdesi. BELIRSIZ → [KİŞİ_n]. Rol değişince yeni etiket verilir, eskisi takma ad olarak kalır. */
export const ROLE_TOKEN_LABELS: Readonly<Record<LegalRole, string>> = {
  DAVACI: 'DAVACI', DAVALI: 'DAVALI', SANIK: 'SANIK', SUPHELI: 'ŞÜPHELİ', MUSTEKI: 'MÜŞTEKİ', MAGDUR: 'MAĞDUR',
  KATILAN: 'KATILAN', TANIK: 'TANIK', BILIRKISI: 'BİLİRKİŞİ', ALACAKLI: 'ALACAKLI', BORCLU: 'BORÇLU',
  MUVEKKIL: 'MÜVEKKİL', VEKIL: 'VEKİL', MIRASBIRAKAN: 'MİRASBIRAKAN', MIRASCI: 'MİRASÇI', KIRAYA_VEREN: 'KİRAYA_VEREN',
  KIRACI: 'KİRACI', ISVEREN: 'İŞVEREN', ISCI: 'İŞÇİ', KEFIL: 'KEFİL', UCUNCU_KISI: 'ÜÇÜNCÜ_KİŞİ',
  BASVURUCU: 'BAŞVURUCU', MUDAHIL: 'MÜDAHİL', HAKIM: 'HAKİM', SAVCI: 'SAVCI', ARABULUCU: 'ARABULUCU',
  NOTER: 'NOTER', BELIRSIZ: 'KİŞİ',
};

/** Rol ipuçları (küçük harf, lowerView üzerinde aranır). Uzun olan önce denenir. */
export const ROLE_CUES: ReadonlyArray<readonly [string, LegalRole]> = [
  ['davacı-karşı davalı', 'DAVACI'], ['davalı-karşı davacı', 'DAVALI'], ['suçtan zarar gören', 'MAGDUR'],
  ['kiraya veren', 'KIRAYA_VEREN'], ['üçüncü kişi', 'UCUNCU_KISI'], ['fer\'i müdahil', 'MUDAHIL'],
  ['davacı', 'DAVACI'], ['davalı', 'DAVALI'], ['sanık', 'SANIK'], ['şüpheli', 'SUPHELI'], ['müşteki', 'MUSTEKI'],
  ['mağdur', 'MAGDUR'], ['katılan', 'KATILAN'], ['tanık', 'TANIK'], ['bilirkişi', 'BILIRKISI'], ['alacaklı', 'ALACAKLI'],
  ['borçlu', 'BORCLU'], ['müvekkil', 'MUVEKKIL'], ['vekili', 'VEKIL'], ['vekil', 'VEKIL'], ['av.', 'VEKIL'],
  ['murisi', 'MIRASBIRAKAN'], ['mirasbırakan', 'MIRASBIRAKAN'], ['muris', 'MIRASBIRAKAN'], ['mirasçı', 'MIRASCI'],
  ['kiracı', 'KIRACI'], ['işveren', 'ISVEREN'], ['işçi', 'ISCI'], ['kefil', 'KEFIL'], ['başvurucu', 'BASVURUCU'],
  ['başvuran', 'BASVURUCU'], ['müdahil', 'MUDAHIL'], ['hakim', 'HAKIM'], ['hâkim', 'HAKIM'], ['savcı', 'SAVCI'],
  ['arabulucu', 'ARABULUCU'], ['noter', 'NOTER'],
];

/* ═════════════════════════ 2. TESPİT ═════════════════════════ */

export type DetectionLayer = 'L1_CHECKSUM' | 'L2_LEGAL' | 'L3_NER' | 'L3_RULE' | 'MANUAL';
/** Çakışmada yüksek olan kazanır; eşitlikte uzun aralık, sonra yüksek skor. */
export const LAYER_PRIORITY: Readonly<Record<DetectionLayer, number>> = { MANUAL: 100, L1_CHECKSUM: 90, L2_LEGAL: 80, L3_RULE: 60, L3_NER: 50 };

export type MatchFlag =
  | 'NEEDS_REVIEW' | 'OWN_CASE_SUSPECT' | 'AMBIGUOUS_SURNAME' | 'AMBIGUOUS_GIVEN_NAME' | 'UPPERCASE_CONTEXT'
  | 'SENTENCE_INITIAL' | 'CHECKSUM_FAILED' | 'NO_CONTEXT' | 'FOREIGN_NAME' | 'LEAK_AUDIT';

/** Bir dedektörün ham bulgusu (kümelemeden önce). Aralık EKİ İÇERMEZ: "Yılmaz'ın" → "Yılmaz". */
export interface EntityMatch {
  readonly id: MentionId;
  readonly docId: DocumentId;
  readonly span: TextSpan;
  readonly text: string;
  readonly category: EntityCategory;
  readonly layer: DetectionLayer;
  readonly confidence: Confidence;
  /** 0..1, NER için model skoru; kurallarda sabit (HIGH 0.95, MEDIUM 0.7, LOW 0.4). */
  readonly score: number;
  /** Kural kimliği: "L1.TCKN", "L2.DOSYA", "L3.NER.PER", "L3.RULE.ROL_IPUCU" */
  readonly ruleId: string;
  readonly roleHint?: LegalRole;
  /** Değer karşılaştırması için normal biçim: kimlik/IBAN/kart/telefon rakamları, plaka "34 ABC 123" */
  readonly normalized?: string;
  readonly honorificBefore?: 'sayın' | 'sn.' | 'bay' | 'bayan' | 'av.' | 'dr.' | 'prof.' | 'doç.';
  readonly honorificAfter?: 'bey' | 'hanım' | 'beyefendi' | 'hanımefendi';
  readonly flags: readonly MatchFlag[];
}

export type ProtectedReason = 'ICTIHAT_KUNYESI' | 'KANUN_ATFI' | 'KULLANICI';
/** Asla otomatik maskelenmeyen aralık. ownCaseSuspect=true ise arayüz "kendi dosyanız olabilir" uyarısı gösterir. */
export interface ProtectedSpan {
  readonly docId: DocumentId;
  readonly span: TextSpan;
  readonly reason: ProtectedReason;
  readonly ruleId: string;
  readonly ownCaseSuspect: boolean;
}

export interface DetectContext {
  readonly docId: DocumentId;
  readonly currentYear: number;
  readonly options: MaskingOptions;
}
export interface DetectorOutput {
  readonly matches: readonly EntityMatch[];
  readonly protectedSpans: readonly ProtectedSpan[];
}

/* ═════════════════════════ 3. SES BİLGİSİ VE BİÇİMBİLİM ═════════════════════════ */

/** Son ünlünün 4'lü uyum sınıfı: a/ı → 'ı', o/u → 'u', e/i → 'i', ö/ü → 'ü'. */
export type HarmonyVowel = 'ı' | 'i' | 'u' | 'ü';
/** Son ses: ünlü / yumuşak ünsüz / sert ünsüz (f s t k ç ş h p). */
export type FinalSound = 'VOWEL' | 'VOICED' | 'VOICELESS';
export type PhonSource = 'EVIDENCE' | 'LEXICON' | 'WORD' | 'ABBREVIATION' | 'NUMBER' | 'DEFAULT';
export interface PhonProfile {
  readonly harmony: HarmonyVowel;
  readonly final: FinalSound;
  /** 3. tekil iyelikle biten ad (Şirketi, Bakanlığı): durum ekleri n kaynaştırmalı (-nin, -ne, -nde, -nden, -nce). */
  readonly pronominalN: boolean;
  readonly source: PhonSource;
  readonly confidence: Confidence;
}
export type Morpheme =
  | 'PL' | 'POSS' | 'GEN' | 'ACC' | 'DAT' | 'LOC' | 'ABL' | 'INS' | 'EQU'
  | 'KI' | 'DIR' | 'DI' | 'MIS' | 'SA' | 'KEN' | 'LI' | 'SIZ';
export interface SuffixRealization {
  readonly suffixOut: string;
  readonly morphemes: readonly Morpheme[] | null;
  readonly changed: boolean;
  readonly confidence: Confidence;
}

/* ═════════════════════════ 4. VARLIKLAR VE KASA (VAULT) ═════════════════════════ */

export type EntityStatus = 'MASK' | 'KEEP' | 'REVIEW';
export type MentionForm = 'FULL' | 'GIVEN_ONLY' | 'SURNAME_ONLY' | 'INITIAL_SURNAME' | 'VALUE';
export type Gender = 'E' | 'K' | 'U';
export interface PersonNameParts { readonly given: readonly string[]; readonly surnames: readonly string[] }
export interface TwinName {
  /** "Kaan Korkmaz" */
  readonly full: string;
  readonly given?: string;
  readonly surname?: string;
  /** Maskeli metne yazılan biçim: "《Kaan Korkmaz》" */
  readonly display: string;
}

export interface EntityCluster {
  readonly id: EntityId;
  readonly category: EntityCategory;
  /** Kişi dışı kategorilerde 'BELIRSIZ'. */
  readonly role: LegalRole;
  readonly roleSource: 'CUE' | 'USER' | 'DEFAULT';
  /** Güncel etiket: "[DAVACI_1]" */
  readonly token: string;
  /** Panoya çıkmış tüm etiketler (takma adlar). Geri çözmede hepsi tanınır, asla silinmez. */
  readonly issuedTokens: readonly string[];
  /** Geri çözmede yazılacak biçim ("Ahmet Yılmaz"). Kullanıcı değiştirebilir. */
  readonly canonical: string;
  readonly surfaces: readonly string[];
  readonly normalizedValue?: string;
  readonly mentionIds: readonly MentionId[];
  readonly status: EntityStatus;
  readonly confidence: Confidence;
  readonly gender?: Gender;
  readonly nameParts?: PersonNameParts;
  readonly phon: PhonProfile;
  /** Yalnız adla anmalar ("Ahmet Bey") için */
  readonly givenCanonical?: string;
  readonly phonGiven?: PhonProfile;
  /** Kaynak belgede bu varlığa eklenmiş görülen ekler ("ın", "ne"); profil kanıtı. */
  readonly observedSuffixes: readonly string[];
  readonly twin?: TwinName;
}

export interface ResolvedMention {
  readonly id: MentionId;
  readonly docId: DocumentId;
  /** null ise grup etiketine bağlıdır (groupId dolu). */
  readonly entityId: EntityId | null;
  readonly groupId?: GroupId;
  readonly span: TextSpan;
  readonly surface: string;
  /** Kesme işaretli ek: "Yılmaz'ın" için { apostrophe: "'", text: "ın" } */
  readonly suffix?: { readonly span: TextSpan; readonly apostrophe: string; readonly text: string };
  readonly form: MentionForm;
  readonly match: EntityMatch;
}

/** Soyadı çakışmasında tek başına geçen ve kişiye bağlanamayan anma: [SOYAD_n] (veya ad için [AD_n]). */
export interface GroupToken {
  readonly id: GroupId;
  readonly token: string;
  readonly kind: 'SOYAD' | 'AD';
  readonly value: string;
  readonly phon: PhonProfile;
  readonly candidateIds: readonly EntityId[];
  /** İkiz modunda ailenin ortak ikiz soyadı */
  readonly twinValue?: string;
}

export interface AmountScaleRecord {
  /** Gizli ölçek. [0.95, 1.05] aralığı dışında. */
  readonly k: number;
  readonly pairs: ReadonlyArray<{ readonly entityId: EntityId; readonly fuzzed: string; readonly original: string }>;
}

export type DocumentFormat = 'udf' | 'docx' | 'txt' | 'md';

export interface VaultDocument {
  readonly id: DocumentId;
  readonly format: DocumentFormat;
  /** Özgün dosya adı kişisel veri içerebilir: yalnız arayüzde gösterilir, hiçbir çıktıya yazılmaz. */
  readonly displayName: string;
  readonly charCount: number;
}

/** Eşleşme kasası. Yalnız Engine Worker belleğinde yaşar; sunucuya, diske (şifresiz) ve loga ASLA gitmez. */
export interface MaskingSessionVault {
  readonly sessionId: SessionId;
  readonly createdAt: number;
  readonly expiresAt: number;
  readonly options: MaskingOptions;
  readonly documents: readonly VaultDocument[];
  readonly entities: ReadonlyMap<EntityId, EntityCluster>;
  readonly mentions: ReadonlyMap<MentionId, ResolvedMention>;
  readonly groups: ReadonlyMap<GroupId, GroupToken>;
  /** tokenKey(etiket) → varlık. Takma adlar dahil. */
  readonly tokenIndex: ReadonlyMap<string, EntityId>;
  /** foldKey(ikiz yüzeyi) → hedef */
  readonly twinIndex: ReadonlyMap<string, { readonly entityId?: EntityId; readonly groupId?: GroupId; readonly part: 'FULL' | 'GIVEN' | 'SURNAME' }>;
  /** Etiket gövdesi → son kullanılan indeks ("DAVACI" → 2) */
  readonly counters: Readonly<Record<string, number>>;
  readonly amountScale?: AmountScaleRecord;
  /** İlk kopyalamadan sonra true. Kilitliyken verilmiş etiket geri alınmaz, yeniden numaralanmaz. */
  readonly locked: boolean;
}

/* ═════════════════════════ 5. SEÇENEKLER ═════════════════════════ */

export type MaskingMode = 'TOKEN' | 'TWIN';
export type AmountMode = 'OFF' | 'TOKEN' | 'SCALE';
export interface MaskingOptions {
  readonly mode: MaskingMode;
  readonly maskedCategories: Readonly<Record<EntityCategory, boolean>>;
  readonly amountMode: AmountMode;
  readonly scaleRange: readonly [number, number];
  /** Bu güven ve üstündeki bulgular otomatik seçili gelir. */
  readonly autoSelectMinConfidence: Confidence;
  readonly reviewOwnCaseCitations: boolean;
  /** Maskeli metinde etiketten sonraki eki etiketin kendi okunuşuna göre yeniden çek ("[DAVACI_1]'in"). */
  readonly normalizeSuffixesInMaskedText: boolean;
  readonly includeHeadersFooters: boolean;
  readonly includeComments: boolean;
  readonly includeFootnotes: boolean;
  readonly nerEnabled: boolean;
  readonly sessionTimeoutMinutes: number;
  /** Hassas (çözülmüş) metin kopyalandıktan sonra pano temizleme süresi; 0 = kapalı */
  readonly clipboardClearSeconds: number;
}

const ALL_CATEGORIES_DEFAULT = Object.fromEntries(
  ENTITY_CATEGORIES.map((c) => [c, CATEGORY_SPECS[c].defaultMasked]),
) as Record<EntityCategory, boolean>;

export const DEFAULT_MASKING_OPTIONS: MaskingOptions = {
  mode: 'TOKEN',
  maskedCategories: ALL_CATEGORIES_DEFAULT,
  amountMode: 'OFF',
  scaleRange: [0.8, 1.25],
  autoSelectMinConfidence: 'MEDIUM',
  reviewOwnCaseCitations: true,
  normalizeSuffixesInMaskedText: true,
  includeHeadersFooters: false,
  includeComments: false,
  includeFootnotes: true,
  nerEnabled: true,
  sessionTimeoutMinutes: 60,
  clipboardClearSeconds: 60,
};

/* ═════════════════════════ 6. GERİ ÇÖZME (UN-MASK) ═════════════════════════ */

export type TokenVariant = 'EXACT' | 'NORMALIZED' | 'BARE' | 'TWIN' | 'TWIN_BARE' | 'TWIN_PART';
export interface UnmaskReplacement {
  /** LLM yanıtındaki aralık (ek dahil) */
  readonly inSpan: TextSpan;
  /** Çözülmüş metindeki aralık */
  readonly outSpan: TextSpan;
  readonly entityId: EntityId | null;
  readonly groupId?: GroupId;
  readonly matched: string;
  readonly restored: string;
  readonly suffixIn?: string;
  readonly suffixOut?: string;
  readonly suffixCorrected: boolean;
  readonly variant: TokenVariant;
  readonly confidence: Confidence;
}
export type UnmaskIssueKind =
  | 'UNKNOWN_TOKEN' | 'SUFFIX_UNPARSED' | 'LOW_PHON_CONFIDENCE' | 'AMOUNT_DERIVED' | 'GROUP_TOKEN'
  | 'LEFTOVER_MARKER' | 'VAULT_EXPIRED';
export interface UnmaskIssue {
  readonly kind: UnmaskIssueKind;
  readonly outSpan: TextSpan;
  readonly message: string;
  readonly suggestion?: string;
  readonly entityId?: EntityId;
}
export interface UnmaskResult {
  readonly text: string;
  readonly replacements: readonly UnmaskReplacement[];
  readonly issues: readonly UnmaskIssue[];
  readonly stats: {
    readonly tokensFound: number;
    readonly tokensResolved: number;
    readonly twinsFound: number;
    readonly suffixCorrections: number;
    readonly unknownTokens: number;
    readonly amountSuggestions: number;
  };
}

/* ═════════════════════════ 7. BELGE MODELİ (DocumentAST) ═════════════════════════ */

export type Alignment = 'left' | 'center' | 'right' | 'justify';
export interface RunStyle {
  readonly family?: string;
  readonly sizePt?: number;
  readonly bold?: boolean;
  readonly italic?: boolean;
  readonly underline?: boolean;
  /** İmzalı 32 bit ARGB (UDF biçimi: siyah -16777216) */
  readonly color?: number;
  readonly background?: number;
}
export interface ParagraphStyle {
  readonly align: Alignment;
  readonly leftIndentPt?: number;
  readonly rightIndentPt?: number;
  readonly firstLineIndentPt?: number;
  readonly spaceBeforePt?: number;
  readonly spaceAfterPt?: number;
  readonly lineSpacing?: number;
  readonly heading?: 1 | 2 | 3 | 4 | 5 | 6;
  readonly list?: { readonly kind: 'bullet' | 'number'; readonly level: number };
}
export interface ParagraphBlock { readonly kind: 'paragraph'; readonly span: TextSpan; readonly style: ParagraphStyle }
export interface TableCell { readonly blocks: readonly Block[]; readonly colspan: number }
export interface TableRow { readonly cells: readonly TableCell[] }
export interface TableBlock { readonly kind: 'table'; readonly span: TextSpan; readonly rows: readonly TableRow[]; readonly columnWidthsPt?: readonly number[] }
export type Block = ParagraphBlock | TableBlock;
export interface InlineMark { readonly span: TextSpan; readonly style: RunStyle }
/** Metinde tek karakter yer kaplayan metin dışı nesne. Düzenlemeler bu karakterlere dokunamaz. */
export interface Placeholder { readonly offset: number; readonly char: '￼' | '​'; readonly kind: 'IMAGE' | 'EMPTY_PARAGRAPH' | 'OBJECT' }
export interface PageFormat {
  readonly widthPt?: number;
  readonly heightPt?: number;
  readonly marginsPt: { readonly top: number; readonly right: number; readonly bottom: number; readonly left: number };
  readonly landscape: boolean;
}
export type DocWarningCode =
  | 'SIGNATURE_PRESENT' | 'UYAP_METADATA_PRESENT' | 'TRACKED_CHANGES' | 'COMMENTS_PRESENT' | 'HEADER_FOOTER_TEXT'
  | 'IMAGES_PRESENT' | 'EMBEDDED_OBJECTS' | 'UNKNOWN_ELEMENTS' | 'OFFSET_UNIT_CODEPOINT' | 'READ_ONLY_FALLBACK' | 'MACROS_PRESENT';
export interface DocWarning { readonly code: DocWarningCode; readonly message: string }
/** Codec'e özel ham parçalar (UDF: content.xml dizgesi ve diğer ZIP girdileri). Yalnız aynı codec okur. */
export interface SourceHandle { readonly codec: DocumentFormat; readonly opaque: unknown }

/** Biçimden bağımsız belge modeli. Paragraflar text içinde '\n' ile ayrılır; tüm stiller text üzerindeki aralıklardır. */
export interface DocumentAST {
  readonly format: DocumentFormat;
  readonly text: string;
  readonly blocks: readonly Block[];
  readonly marks: readonly InlineMark[];
  readonly placeholders: readonly Placeholder[];
  readonly page?: PageFormat;
  readonly source?: SourceHandle;
  readonly warnings: readonly DocWarning[];
}

/** Ön koşullar: boş olmayan aralık, çakışma yok, '\n' / '\r' / yer tutucu içermez. İhlal: E_EDIT_INVALID. */
export interface TextEdit { readonly span: TextSpan; readonly replacement: string }

export interface WriteOptions {
  /** MASKED_EXPORT: kaynak biçim korunur, imza ve UYAP üst verisi düşürülür. UNMASKED_OUTPUT: yeni belge üretilir. */
  readonly purpose: 'MASKED_EXPORT' | 'UNMASKED_OUTPUT';
  /** Çıktı dosya adı daima nötrdür ("maskeli-7f3a.udf"); özgün ad kullanılmaz. */
  readonly fileName: string;
}

/* ═════════════════════════ 8. PORTLAR (AJAN SINIRLARI) ═════════════════════════ */

/** AGENT-1: Katman 1 + Katman 2 + adres kuralları. Senkron ve saf. */
export interface DeterministicDetectorPort {
  detect(text: string, ctx: DetectContext): DetectorOutput;
}

export interface AmountStyle { readonly thousands: '.' | ''; readonly decimals: 0 | 1 | 2 }
export interface AmountHit {
  readonly span: TextSpan;
  readonly value: number;
  readonly style: AmountStyle;
  readonly currency: string;
  /** Hemen ardından gelen yazıyla tutar: "(yüzyirmibeşbin Türk Lirası)" içindeki sayı sözcükleri */
  readonly words?: { readonly span: TextSpan; readonly text: string };
}
/** AGENT-1 */
export interface AmountFuzzerPort {
  findAmounts(text: string): readonly AmountHit[];
  pickScale(rng: RandomSource, range: readonly [number, number]): number;
  scale(text: string, hits: readonly AmountHit[], k: number): readonly TextEdit[];
}

export type NerState = 'NOT_LOADED' | 'DOWNLOADING' | 'READY' | 'FAILED' | 'DISABLED';
export interface NerStatus { readonly state: NerState; readonly progress: number; readonly modelId?: string; readonly backend?: 'wasm' | 'webgpu'; readonly error?: string }
export interface NerChunkEvent { readonly docId: DocumentId; readonly done: number; readonly total: number; readonly matches: readonly EntityMatch[] }
/** AGENT-2: NER Web Worker istemcisi. Ağ isteği yalnız aynı kökenden model dosyaları içindir. */
export interface NerPort {
  status(): NerStatus;
  load(onProgress: (s: NerStatus) => void): Promise<NerStatus>;
  detect(text: string, docId: DocumentId, onChunk: (e: NerChunkEvent) => void, signal?: AbortSignal): Promise<readonly EntityMatch[]>;
  dispose(): Promise<void>;
}
/** AGENT-2: model dışı ad/şirket kuralları (rol ipucu, ad sözlüğü, şirket tür ekleri). */
export interface NameRuleDetectorPort {
  detect(text: string, ctx: DetectContext): readonly EntityMatch[];
}

export interface CorefInput {
  readonly docs: ReadonlyArray<{ readonly docId: DocumentId; readonly text: string }>;
  /** KISI/SIRKET/KURUM bulguları, birleştirme (merge) sonrası, çakışmasız */
  readonly matches: readonly EntityMatch[];
  readonly existing: readonly EntityCluster[];
}
export interface CorefOutput {
  readonly clusters: ReadonlyArray<{
    readonly key: string;
    readonly category: EntityCategory;
    readonly role: LegalRole;
    readonly roleSource: 'CUE' | 'DEFAULT';
    readonly canonical: string;
    readonly givenCanonical?: string;
    readonly gender: Gender;
    readonly nameParts?: PersonNameParts;
    readonly mentionIds: readonly MentionId[];
    readonly confidence: Confidence;
    readonly existingEntityId?: EntityId;
  }>;
  readonly groups: ReadonlyArray<{ readonly kind: 'SOYAD' | 'AD'; readonly value: string; readonly mentionIds: readonly MentionId[]; readonly candidateKeys: readonly string[] }>;
  readonly forms: ReadonlyMap<MentionId, MentionForm>;
}
/** AGENT-2 */
export interface CorefPort { resolve(input: CorefInput): CorefOutput }

/** AGENT-2 */
export interface MorphologyPort {
  profileOf(surface: string): PhonProfile;
  refineWithEvidence(computed: PhonProfile, observedSuffixes: readonly string[]): PhonProfile;
  tokenReadingProfile(token: string): PhonProfile;
  parseSuffix(suffix: string): readonly Morpheme[] | null;
  realize(morphemes: readonly Morpheme[], stem: Pick<PhonProfile, 'harmony' | 'final' | 'pronominalN'>): string;
  rehydrateSuffix(llmSuffix: string, target: PhonProfile): SuffixRealization;
}
/** AGENT-2 */
export interface TwinPort {
  assign(entities: readonly EntityCluster[], groups: readonly GroupToken[], rng: RandomSource): {
    readonly twins: ReadonlyMap<EntityId, TwinName>;
    readonly groupTwins: ReadonlyMap<GroupId, string>;
  };
}
/** AGENT-2 */
export interface RehydratorPort { unmask(response: string, vault: MaskingSessionVault): UnmaskResult }

/** AGENT-3 */
export interface DocumentCodec {
  readonly format: DocumentFormat;
  sniff(bytes: Uint8Array, fileName: string): boolean;
  read(bytes: Uint8Array): Promise<DocumentAST>;
  /** Metni düzenler ve TÜM aralıkları (blok, işaret, yer tutucu, kaynak ofsetleri) yeniden eşler. */
  applyEdits(ast: DocumentAST, edits: readonly TextEdit[]): DocumentAST;
  write(ast: DocumentAST, opts: WriteOptions): Promise<Uint8Array>;
}
/** AGENT-3: LLM yanıtındaki yalın Markdown'ı (#, **, *, listeler, tablolar) AST'ye çevirir. */
export type MarkdownToAst = (markdown: string) => DocumentAST;

/** AGENT-5: Kasa deposu. Yalnız Engine Worker içinde örneklenir. */
export interface VaultStorePort {
  create(options: MaskingOptions, rng: RandomSource): MaskingSessionVault;
  get(): MaskingSessionVault | null;
  update(mutator: (v: MaskingSessionVault) => MaskingSessionVault): MaskingSessionVault;
  /** En iyi çaba sıfırlama: tipli dizileri sıfırla, Map'leri boşalt, referansları bırak. */
  wipe(reason: WipeReason): void;
  exportEncrypted(passphrase: string): Promise<Uint8Array>;
  importEncrypted(bytes: Uint8Array, passphrase: string): Promise<MaskingSessionVault>;
}
export type WipeReason = 'USER' | 'TIMEOUT' | 'PAGEHIDE' | 'NEW_SESSION' | 'PANIC';

/** Şifreli kasa dosyası (.mlxkasa) biçimi. Düz metin alan içermez. */
export interface EncryptedVaultFile {
  readonly v: 1;
  readonly kdf: 'PBKDF2-SHA256';
  readonly iterations: number;     // en az 600000
  readonly salt: string;           // base64, 16 bayt
  readonly iv: string;             // base64, 12 bayt
  readonly ciphertext: string;     // base64, AES-256-GCM (etiket dahil)
}

/** AGENT-4 (web) ve AGENT-5 (masaüstü) */
export type Sensitivity = 'MASKED' | 'SENSITIVE';
export interface PlatformAdapter {
  readonly kind: 'web' | 'desktop';
  readonly capabilities: {
    /** Pano geçmişi / bulut eşitlemesi dışında tutulabiliyor mu */
    readonly concealedClipboard: boolean;
    /** İşletim sistemi düzeyinde ağ yasağı (macOS sandbox) */
    readonly osNetworkSandbox: boolean;
  };
  copyText(text: string, sensitivity: Sensitivity): Promise<{ readonly ok: boolean; readonly fingerprint: string }>;
  /** Pano hâlâ aynı içeriği taşıyorsa temizler. */
  clearClipboardIfUnchanged(fingerprint: string): Promise<boolean>;
  saveFile(file: { readonly name: string; readonly mime: string; readonly bytes: Uint8Array }): Promise<{ readonly ok: boolean }>;
  setCloseGuard(enabled: boolean): void;
  /** Web: sayfayı yeniden yükler. Masaüstü: webview'i yeniden oluşturur. */
  hardReset(): Promise<void>;
}

export type NetworkRealm = 'main' | 'engine-worker' | 'ner-worker' | 'service-worker';
export type NetworkKind = 'fetch' | 'xhr' | 'websocket' | 'eventsource' | 'beacon' | 'resource' | 'csp-violation' | 'webrtc';
export interface NetworkEvent {
  readonly at: number;
  readonly realm: NetworkRealm;
  readonly kind: NetworkKind;
  readonly url: string;
  readonly sameOrigin: boolean;
  readonly blocked: boolean;
  readonly bytes?: number;
}
/** AGENT-4 */
export interface NetworkMonitorPort {
  install(realm: NetworkRealm): void;
  events(): readonly NetworkEvent[];
  subscribe(cb: (e: NetworkEvent) => void): () => void;
  externalAttempts(): number;
}

/* ═════════════════════════ 9. MOTOR API'Sİ (Engine Worker RPC, Comlink) ═════════════════════════ */

export type DocumentInput =
  | { readonly kind: 'text'; readonly text: string }
  | { readonly kind: 'file'; readonly fileName: string; readonly bytes: Uint8Array };

export interface ReviewItem {
  readonly id: string;
  readonly kind: 'LOW_CONFIDENCE' | 'OWN_CASE_CITATION' | 'GROUP_TOKEN' | 'LEAK_AUDIT' | 'FOREIGN_NAME' | 'DOC_WARNING';
  readonly docId: DocumentId;
  readonly span?: TextSpan;
  readonly entityId?: EntityId;
  readonly groupId?: GroupId;
  readonly message: string;
}

export interface AnalysisResult {
  readonly docId: DocumentId;
  readonly text: string;
  readonly entities: readonly EntityCluster[];
  readonly mentions: readonly ResolvedMention[];
  readonly groups: readonly GroupToken[];
  readonly protectedSpans: readonly ProtectedSpan[];
  readonly reviewQueue: readonly ReviewItem[];
  readonly ner: NerStatus;
  readonly phase: 'DETERMINISTIC' | 'NER_PARTIAL' | 'COMPLETE';
  readonly timingsMs: Readonly<Record<string, number>>;
}

export type EntityCommand =
  | { readonly type: 'SET_STATUS'; readonly entityId: EntityId; readonly status: EntityStatus }
  | { readonly type: 'SET_ROLE'; readonly entityId: EntityId; readonly role: LegalRole }
  | { readonly type: 'SET_CATEGORY'; readonly entityId: EntityId; readonly category: EntityCategory }
  | { readonly type: 'SET_CANONICAL'; readonly entityId: EntityId; readonly canonical: string }
  | { readonly type: 'MERGE'; readonly sourceId: EntityId; readonly targetId: EntityId }
  | { readonly type: 'DETACH_MENTION'; readonly mentionId: MentionId }
  | { readonly type: 'ASSIGN_MENTION'; readonly mentionId: MentionId; readonly entityId: EntityId }
  | { readonly type: 'RESOLVE_GROUP'; readonly groupId: GroupId; readonly mentionId: MentionId; readonly entityId: EntityId }
  | { readonly type: 'ADD_MANUAL'; readonly docId: DocumentId; readonly span: TextSpan; readonly category: EntityCategory; readonly role?: LegalRole; readonly applyToAll: boolean }
  | { readonly type: 'REMOVE_MENTION'; readonly mentionId: MentionId }
  | { readonly type: 'UNPROTECT'; readonly docId: DocumentId; readonly span: TextSpan }
  | { readonly type: 'SET_OPTIONS'; readonly patch: Partial<MaskingOptions> };

export interface PromptTemplate {
  readonly id: string;
  readonly title: string;
  /** {{GOREV}} ve {{MASKELI_METIN}} yer tutucularını içerir. */
  readonly body: string;
  readonly builtIn: boolean;
}

export interface MaskedOutput {
  readonly docId: DocumentId;
  readonly text: string;
  readonly withTemplate?: string;
  readonly tokenCount: number;
  /** Sızıntı denetimi sonucu: boş değilse kopyalama engellenir (kullanıcı açıkça onaylamadıkça). */
  readonly leakFindings: readonly ReviewItem[];
}

export interface SessionInfo {
  readonly sessionId: SessionId;
  readonly createdAt: number;
  readonly expiresAt: number;
  readonly locked: boolean;
  readonly documents: readonly VaultDocument[];
}

export interface ExportRequest {
  readonly source: 'MASKED' | 'UNMASKED';
  readonly docId?: DocumentId;
  /** UNMASKED için çözülmüş metin (Markdown olabilir) */
  readonly text?: string;
  readonly format: 'udf' | 'docx' | 'txt';
}

/** Ana iş parçacığının çağırdığı tek yüzey. Tüm yöntemler Engine Worker'da çalışır. */
export interface MaskingEngineApi {
  createSession(options?: Partial<MaskingOptions>): Promise<SessionInfo>;
  loadDocument(input: DocumentInput): Promise<{ readonly docId: DocumentId; readonly text: string; readonly warnings: readonly DocWarning[] }>;
  analyze(docId: DocumentId, onUpdate: (r: AnalysisResult) => void): Promise<AnalysisResult>;
  command(cmd: EntityCommand): Promise<AnalysisResult>;
  buildMasked(docId: DocumentId, templateId?: string, task?: string): Promise<MaskedOutput>;
  /** Kopyalama yapıldığında çağrılır: kasayı kilitler (etiketler kalıcılaşır). */
  markIssued(docId: DocumentId): Promise<SessionInfo>;
  unmask(response: string): Promise<UnmaskResult>;
  exportFile(req: ExportRequest): Promise<{ readonly fileName: string; readonly mime: string; readonly bytes: Uint8Array }>;
  exportVault(passphrase: string): Promise<Uint8Array>;
  importVault(bytes: Uint8Array, passphrase: string): Promise<SessionInfo>;
  extendSession(): Promise<SessionInfo>;
  wipe(reason: WipeReason): Promise<void>;
  nerStatus(): Promise<NerStatus>;
}

/* ═════════════════════════ 10. HATALAR ═════════════════════════ */

export type ErrorCode =
  | 'E_UNSUPPORTED_FORMAT' | 'E_UDF_FORMAT' | 'E_DOCX_FORMAT' | 'E_EDIT_INVALID' | 'E_VAULT_EXPIRED'
  | 'E_VAULT_LOCKED' | 'E_NO_SESSION' | 'E_NER_UNAVAILABLE' | 'E_LEAK_DETECTED' | 'E_CRYPTO' | 'E_PLATFORM';
/** İleti kullanıcı metni İÇERMEZ (log politikası). */
export interface MaskelexError { readonly code: ErrorCode; readonly message: string }
export const isMaskelexError = (x: unknown): x is MaskelexError =>
  typeof x === 'object' && x !== null && typeof (x as { code?: unknown }).code === 'string' && (x as { code: string }).code.startsWith('E_');

/* ═════════════════════════ 11. ALTIN TEST SETİ (AGENT-5 üretir, herkes kullanır) ═════════════════════════ */

export interface GoldenEntity {
  readonly span: TextSpan;
  readonly category: EntityCategory;
  readonly role?: LegalRole;
  /** Aynı kişiye ait anmalar aynı anahtarı taşır ("P1") */
  readonly clusterKey?: string;
}
export interface GoldenUnmaskCase {
  /** Maskeli metinde etiketler deterministik atanır (tohum 42). Beklenen çıktı birebir karşılaştırılır. */
  readonly llmOutput: string;
  readonly expected: string;
}
export interface GoldenCase {
  readonly id: string;
  readonly title: string;
  readonly tags: readonly string[];
  readonly input: { readonly text: string } | { readonly fixture: string };
  readonly entities: readonly GoldenEntity[];
  /** Kesinlikle maskelenmemesi gereken aralıklar (içtihat, kanun atfı) */
  readonly mustKeep: readonly TextSpan[];
  readonly unmask?: readonly GoldenUnmaskCase[];
}

/* ═════════════════════════ 12. SAF YARDIMCILAR ═════════════════════════ */

/** Etiketi kasa anahtarına çevirir: "[Davacı_1]", "DAVACI 1", "\[DAVACI\_1\]", "[ŞIRKET_A]" → "DAVACI_1" / "SIRKET_A". */
export function tokenKey(raw: string): string {
  const s = raw.replace(/\\/g, '').replace(/^\[|\]$/g, '').trim().toLocaleLowerCase('tr-TR');
  const folded = s.replace(/[ıİ]/g, 'i').replace(/ğ/g, 'g').replace(/[üû]/g, 'u').replace(/ş/g, 's').replace(/ö/g, 'o')
    .replace(/ç/g, 'c').replace(/â/g, 'a').replace(/î/g, 'i').normalize('NFD').replace(/̇/g, '').normalize('NFC');
  return folded.toUpperCase().replace(/[\s.\-]+/g, '_').replace(/_+/g, '_');
}

/** Alfabetik indeks: 1 → A, 26 → Z, 27 → AA */
export function alphaIndex(n: number): string {
  let s = '';
  for (let x = n; x > 0; x = Math.floor((x - 1) / 26)) s = String.fromCharCode(65 + ((x - 1) % 26)) + s;
  return s;
}

export function makeToken(label: string, index: number, style: 'NUMERIC' | 'ALPHA'): string {
  return `[${label}_${style === 'ALPHA' ? alphaIndex(index) : String(index)}]`;
}

export const spansOverlap = (a: TextSpan, b: TextSpan): boolean => a.start < b.end && b.start < a.end;
```

### 2.3 Kimlik biçimleri ve etiket dil bilgisi

| Kimlik | Biçim | Örnek | Kural |
|---|---|---|---|
| `EntityId` | `E-` + 4 hane | `E-0007` | Oturum sayacı; asla yeniden kullanılmaz |
| `MentionId` | `M-` + 6 hane | `M-000123` | Oturum sayacı |
| `DocumentId` | `D-` + 2 hane | `D-01` | Oturum sayacı |
| `GroupId` | `G-` + 2 hane | `G-01` | Oturum sayacı |
| `SessionId` | 32 hex | `9f2c...` | `crypto.getRandomValues` ile 16 bayt |

**Etiket dil bilgisi:**

```
ETİKET  := "[" GÖVDE "_" İNDEKS "]"
GÖVDE   := CATEGORY_SPECS[*].tokenLabel | ROLE_TOKEN_LABELS[*] | "SOYAD" | "AD" | kullanıcı gövdesi
İNDEKS  := [1-9][0-9]*            (index = 'NUMERIC')
         | [A-Z]+                 (index = 'ALPHA': A..Z, AA, AB, ...)
İKİZ    := "《" Ad " " Soyad "》"   (U+300A, U+300B)
```

- Kullanıcı bir varlığın gövdesini yeniden adlandırabilir (`[DAVACI_1]` yerine `[KİRAYA_VEREN_1]`). Kural: `^[A-ZÇĞİÖŞÜ]+(_[A-ZÇĞİÖŞÜ]+)*$`, en çok 24 karakter ve `tokenKey` ile mevcut hiçbir gövdeye katlanmaz (Ek C, t8 bu benzersizliği tüm yerleşik gövdeler için doğrular).
- Kasa anahtarı `tokenKey(etiket)`'tir: Türkçe küçük harfe çevirme, ASCII katlama, büyük harf, boşluk/nokta/tire yerine alt çizgi. LLM'in bozduğu biçimler (`[Davacı_1]`, `DAVACI 1`, `\[DAVACI\_1\]`, `[ŞIRKET_A]`) aynı anahtara düşer.

---

## 3. Çekirdek algoritma spesifikasyonları

### 3.0 İşlem hattı (orkestratörün bileşim katmanı)

#### 3.0.1 Analiz akışı

`packages/core-engine/src/pipeline/engine.ts` bütün portları bir araya getirir. Bağımlılıklar yapıcıya verilir (bağımlılık enjeksiyonu); böylece her ajan kendi portunu sahte diğerleriyle test edebilir.

```ts
// Sözde kod (TypeScript biçiminde). Gerçek imzalar contracts.ts'dedir.
async function analyze(docId, onUpdate): Promise<AnalysisResult> {
  const doc = vault.documents[docId];
  const text = docText(docId);
  const ctx: DetectContext = { docId, currentYear: new Date().getFullYear(), options: vault.options };

  // a) Kurallar: senkron, hedef < 300 ms / 100.000 karakter
  const det = deterministic.detect(text, ctx);                 // AGENT-1
  const rules = nameRules.detect(text, ctx);                   // AGENT-2
  let merged = merge([...det.matches, ...rules], det.protectedSpans);
  onUpdate(build('DETERMINISTIC', merged, det.protectedSpans));

  // b) NER: parça parça, iptal edilebilir
  if (vault.options.nerEnabled && ner.status().state === 'READY') {
    await ner.detect(text, docId, (chunk) => {
      merged = merge([...merged, ...chunk.matches], det.protectedSpans);
      onUpdate(build('NER_PARTIAL', merged, det.protectedSpans));
    }, abortSignal);
  }

  // c) Kümeleme, etiket, ikiz, ses profili
  const names = merged.filter((m) => m.category === 'KISI' || m.category === 'SIRKET' || m.category === 'KURUM');
  const coref = corefPort.resolve({ docs: allDocs(), matches: names, existing: [...vault.entities.values()] });
  const values = groupByNormalized(merged.filter((m) => !names.includes(m)));   // aynı TCKN iki kez -> tek varlık
  upsertEntities(vault, coref, values);                        // mevcut EntityId'ler korunur (kararlılık)
  for (const e of vault.entities.values()) {
    e.canonical ??= chooseCanonical(e);                        // 3.0.5
    e.phon = morph.refineWithEvidence(morph.profileOf(e.canonical), e.observedSuffixes);
    if (e.givenCanonical) e.phonGiven = morph.profileOf(e.givenCanonical);
    e.status ??= initialStatus(e, vault.options);              // 3.0.6
  }
  assignTokens(vault);                                          // 3.0.3 allocateTokens
  if (vault.options.mode === 'TWIN') assignTwins(vault, twinPort, rng);
  return publish(build('COMPLETE', merged, det.protectedSpans));
}
```

`observedSuffixes`: Bir anmanın hemen ardından kesme işaretiyle gelen ek (`Yılmaz'ın` için `ın`) ilgili varlığa kanıt olarak eklenir. Bu kanıt, yabancı adlar ve `A.Ş.'ne` gibi yazım tercihleri için ses profilini düzeltir (3.4.1).

#### 3.0.2 Bulgu birleştirme (merge)

Kurallar sırasıyla uygulanır:

1. **Korunan aralık önceliklidir.** Bir `ProtectedSpan` ile örtüşen her bulgu atılır. Tek istisna `MANUAL` bulgudur: kullanıcı korunan bir aralığı elle maskelerse önce `UNPROTECT` komutu çalışır, korunan aralık listeden çıkar.
2. **NER ve kural bulguları normalleştirilir:** aralığın başındaki unvan (`Av.`, `Dr.`, `Sayın`, `Sn.`) ve sonundaki kesme işaretli ek aralık dışına alınır; unvan `honorificBefore/After` alanına, ek kanıt listesine yazılır. Baştaki ve sondaki noktalama atılır. Aralık satır sonu içeriyorsa satır sonundan bölünür.
3. **Öncelik sırası:** `LAYER_PRIORITY` (yüksek önce), sonra `CONFIDENCE_RANK`, sonra aralık uzunluğu (uzun önce), sonra `score`. Açgözlü seçimle örtüşen düşük öncelikli bulgu elenir.
4. **NER `LOC` etiketi tek başına bulgu üretmez** (şehir ve ilçe adları maskelenmez). Bir `ADRES` kural aralığına bitişik `LOC`, adres aralığını genişletme ipucudur.
5. **Mahkeme adları hiç bulgu olmaz.** `ORG` aralığı `Mahkemesi`, `Dairesi`, `Başsavcılığı`, `Hakimliği` ile bitiyorsa atılır.

Başvuru uygulaması (test edildi: Ek C t10):

```ts
// packages/core-engine/src/pipeline/merge.ts
// Bulgu birleştirme: korunan aralık önceliği, sonra katman, güven, uzunluk ve skor sırasıyla açgözlü seçim.

import { CONFIDENCE_RANK, LAYER_PRIORITY, spansOverlap, type EntityMatch, type ProtectedSpan } from '../types/contracts';

export function merge(matches: readonly EntityMatch[], prot: readonly ProtectedSpan[]): EntityMatch[] {
  const live = matches.filter((m) => m.layer === 'MANUAL'
    || !prot.some((p) => p.docId === m.docId && spansOverlap(p.span, m.span)));
  const len = (m: EntityMatch): number => m.span.end - m.span.start;
  const ordered = [...live].sort((a, b) => LAYER_PRIORITY[b.layer] - LAYER_PRIORITY[a.layer]
    || CONFIDENCE_RANK[b.confidence] - CONFIDENCE_RANK[a.confidence]
    || len(b) - len(a) || b.score - a.score || a.span.start - b.span.start);
  const kept: EntityMatch[] = [];
  for (const m of ordered)
    if (!kept.some((k) => k.docId === m.docId && spansOverlap(k.span, m.span))) kept.push(m);
  return kept.sort((a, b) => a.span.start - b.span.start);
}
```

#### 3.0.3 Etiket atama ve maskeli metin üretimi (başvuru uygulaması, test edildi: Ek C t9)

- Kişiler rol gövdesiyle (`[DAVACI_1]`, rol bilinmiyorsa `[KİŞİ_1]`), diğer kategoriler kategori gövdesiyle numaralanır; şirketler harfle (`[ŞİRKET_A]`).
- Numara, belgede **ilk görünüş sırasına** göre verilir. Kasa kilitli değilse her analizde boşluksuz yeniden numaralanır.
- Kasa kilitliyse (ilk kopyalamadan sonra) mevcut etiket korunur; rol değişen varlık sayaçtan devam eden yeni etiket alır ve eski etiket `issuedTokens` içinde takma ad olarak kalır.
- Etiket modunda anmanın ardındaki ek, etiketin kendi okunuşuna göre yeniden çekilir (K-10). `[DAVACI_1]` "bir" diye okunur (ince, ünsüzle biter), `[ŞİRKET_A]` "a" diye okunur (kalın, ünlüyle biter).

```ts
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
```

#### 3.0.4 Sızıntı denetimi (zorunlu, K-12)

Kopyalama düğmesi etkinleşmeden önce `buildMasked` şu denetimi çalıştırır. Bulgu varsa `MaskedOutput.leakFindings` doludur ve arayüz kopyalamayı engeller; kullanıcı her bulgu için "Maskele" ya da "Sorun değil, bunu onaylıyorum" seçer.

```ts
// SÖZDE KOD (orkestratör Faz-0'da gerçek koda çevirir) -> packages/core-engine/src/pipeline/leakAudit.ts
function leakAudit(masked: string, vault: MaskingSessionVault, tokenSpans: TextSpan[]): ReviewItem[] {
  const view = lowerView(masked);
  const inToken = (s: TextSpan) => tokenSpans.some((t) => spansOverlap(t, s));
  const findings: ReviewItem[] = [];
  for (const e of vault.entities.values()) {
    if (e.status !== 'MASK') continue;
    // 1) Tam yüzeyler: büyük/küçük harf duyarsız, sözcük sınırlı
    for (const s of new Set([e.canonical, ...e.surfaces]))
      for (const hit of findWordBounded(view, trLower(s))) if (!inToken(hit)) findings.push(leak(e, hit));
    // 2) Ad ve soyadı parçaları (en az 3 harf): yalnız büyük harfle başlayan geçişler (ortak sözcük gürültüsünü önler)
    for (const part of [...(e.nameParts?.given ?? []), ...(e.nameParts?.surnames ?? [])].filter((p) => p.length >= 3))
      for (const hit of findCapitalized(masked, part)) if (!inToken(hit)) findings.push(leak(e, hit));
  }
  // 3) Maskeli metinde Katman 1'i yeniden çalıştır: YÜKSEK güvenli kimlik/iletişim bulgusu kalmamalı
  for (const m of deterministic.detect(masked, ctx).matches)
    if (m.confidence === 'HIGH' && !inToken(m.span)) findings.push(leakFromMatch(m));
  return dedupe(findings);
}
```

#### 3.0.5 Kanonik biçim seçimi

- Kişi: en uzun `FULL` yüzey; yalnız büyük harfli biçimler varsa Türkçeye duyarlı başlık biçimine çevrilir (`AHMET YILMAZ` → `Ahmet Yılmaz`: her sözcük `trLower`, ilk harf `trUpper`). Unvan ve ek içermez. `givenCanonical` = ilk ad.
- Şirket: en uzun yüzey (tam unvan). Kurum: en uzun yüzey.
- Değer kategorileri: belgede ilk görülen yüzey (biçim korunur: `TR33 0006 ...` boşluklu kalır).
- Kullanıcı `SET_CANONICAL` ile değiştirebilir.

#### 3.0.6 Başlangıç durumu

```
status = REVIEW  eğer confidence = LOW
       | REVIEW  eğer bayraklarda AMBIGUOUS_* veya FOREIGN_NAME varsa
       | MASK    eğer options.maskedCategories[category] = true ve confidence >= autoSelectMinConfidence
       | KEEP    diğer
```

### 3.1 Katman 1: deterministik ve sağlamalı desenler

#### 3.1.1 Kurallar

- Yalnız rakam sayısına bakan desen YASAKTIR. Her kimlik kategorisi ya algoritmik sağlamadan ya da açık bağlam anahtar sözcüğünden geçer.
- Sınırlar lookbehind yerine `leftBoundary`/`rightBoundary` ile denetlenir (R-02).
- Bağlam pencereleri `trLower` ile küçültülür, desenler küçük harfle yazılır (R-03).
- Aralık eki içermez: `12345678950'dir` için aralık yalnız rakamlardır.
- Kategori kataloğu, desenler, doğrulama ve güven kuralları aşağıdaki başvuru uygulamasındaki fonksiyonlardır (her biri tek bir kategoriden sorumludur). Özet:

| Kategori | Doğrulama | Bağlam ve güven |
|---|---|---|
| IBAN | `TR` + 24 rakam (4'lü gruplu yazılabilir), ISO 7064 mod 97 = 1 | Sağlama geçerse YÜKSEK. Geçmezse yalnız solda "iban" varsa ORTA + inceleme |
| TCKN / YKN | 11 hane, ilk hane 0 değil, 10. ve 11. hane sağlaması; `99` ile başlarsa YKN | YÜKSEK. Boşluklu yazım (`100 000 001 46`) yalnız "kimlik / t.c. / tckn" bağlamıyla |
| VKN | 10 hane, resmi mod-10 sağlaması | "vergi / vkn / v.d." bağlamı YÜKSEK; bağlamsız ORTA; bağlamsız ve `5` ile başlıyorsa telefon dedektörüne bırakılır |
| MERSİS | 16 hane; `0` + geçerli VKN + 5 hane (tüzel) ya da geçerli TCKN + 5 hane (gerçek kişi) | "mersis" bağlamı YÜKSEK, yoksa ORTA |
| Kart | 13-19 hane (boşluk/tire gruplu), Luhn; IIN: Visa, Mastercard, Amex, Troy (9792) | Bilinen IIN YÜKSEK; bilinmeyen IIN yalnız "kart" bağlamıyla ORTA |
| Telefon | `+90`/`0090`/`0` önekli 10 hane; alan kodu 2xx-5xx | Öneksiz 10 hane yalnız "tel / gsm / cep / telefon / faks" bağlamıyla. `0850` ve `444` kurumsal hatlar maskelenmez |
| E-posta, KEP | Standart e-posta deseni; `.kep.tr` ayrı kural kimliği | YÜKSEK |
| Plaka | İl kodu 01-81, 1-3 harf (Q, W, X ve Türkçe harf yok), harf sayısına göre 2-5 rakam | Harf grubu kanun kısaltmasıysa (`TBK`, `TCK`, `HMK` ...) veya solda "sayılı / S.K. / kanun / m. / md. / madde / fıkra / bent" varsa reddedilir. "plaka / araç / otomobil" bağlamı YÜKSEK, yoksa ORTA |
| Doğum tarihi | "doğum tarihi / doğ. tar. / D.T." etiketinden sonra tarih; "1985 doğumlu" | YÜKSEK. Diğer tarihler maskelenmez (K-18) |
| Pasaport | `[A-Z][0-9]{8}` veya `[A-Z]{1,2}[0-9]{6,8}` | Yalnız solda 30 karakter içinde "pasaport" varsa YÜKSEK |
| Uzun numara (OZEL) | 8+ hane, başka bulguyla örtüşmez, korunan aralıkta değil, tutar değil | "abone / poliçe / hesap / sicil / müşteri no" bağlamı ORTA, yoksa DÜŞÜK (otomatik seçilmez) |

#### 3.1.2 Türkçe metin yardımcıları (Faz-0, orkestratör; tüm ajanlar okur)

```ts
// packages/core-engine/src/text/turkish.ts
// Türkçeye duyarlı büyük/küçük harf, katlama ve ses sınıfları. Saf fonksiyonlar, bağımlılık yok.

export const VOWELS = 'aeıioöuüâîû';
export const BACK_VOWELS = 'aıouâû';
export const ROUNDED_VOWELS = 'oöuüû';
/** Sert (ötümsüz) ünsüzler: "fıstıkçı şahap" */
export const VOICELESS = 'fstkçşhp';

export const trLower = (s: string): string => s.toLocaleLowerCase('tr-TR');
export const trUpper = (s: string): string => s.toLocaleUpperCase('tr-TR');

/** Eşleştirme anahtarı: Türkçe küçük harf + şapka kaldırma + ASCII katlama.
 *  "İSMAİL", "Ismail", "ISMAIL", "İsmail" hepsi "ismail" olur. */
export function foldKey(s: string): string {
  const lowered = trLower(s);
  let out = '';
  for (const ch of lowered) {
    switch (ch) {
      case 'ı': out += 'i'; break;
      case 'ğ': out += 'g'; break;
      case 'ü': case 'û': out += 'u'; break;
      case 'ş': out += 's'; break;
      case 'ö': out += 'o'; break;
      case 'ç': out += 'c'; break;
      case 'â': out += 'a'; break;
      case 'î': out += 'i'; break;
      default: out += ch;
    }
  }
  // "I" yanlışlıkla 'tr' dışı küçültülmüşse ("i̇" birleşik nokta) temizle
  return out.normalize('NFD').replace(/̇/g, '').normalize('NFC');
}

/** Uzunluk koruyan Türkçe küçük harf görünümü. İndeksler özgün metinle birebir aynı kalır.
 *  JS'in /i bayrağı "İ" (U+0130) harfini "i" ile eşlemez; bağlam desenleri HER ZAMAN bu görünümde,
 *  küçük harfli ve /i bayraksız yazılır. */
export function lowerView(text: string): string {
  let out = '';
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    const l = c.toLocaleLowerCase('tr-TR');
    out += l.length === 1 ? l : c;
  }
  return out;
}

export const isVowel = (ch: string): boolean => VOWELS.includes(ch);
export const isLetter = (ch: string | undefined): boolean => !!ch && /\p{L}/u.test(ch);
export const isDigit = (ch: string | undefined): boolean => !!ch && ch >= '0' && ch <= '9';
export const isAlnum = (ch: string | undefined): boolean => isLetter(ch) || isDigit(ch);

/** Lookbehind kullanmadan sınır denetimi (eski WebKit uyumu için regex'te (?<=) YASAK). */
export function leftBoundary(text: string, start: number, forbid: (ch: string) => boolean = isAlnum): boolean {
  return start === 0 || !forbid(text[start - 1]!);
}
export function rightBoundary(text: string, end: number, forbid: (ch: string) => boolean = isAlnum): boolean {
  return end >= text.length || !forbid(text[end]!);
}

/** Satırın (token'lar hariç) tamamen büyük harf olup olmadığı. Un-mask'ta büyük harf bağlamı için. */
export function isUppercaseContext(line: string): boolean {
  const letters = line.replace(/\[[^\]]*\]|《[^》]*》/g, '').match(/\p{L}/gu);
  if (!letters || letters.length < 4) return false;
  return letters.every((c) => c === trUpper(c));
}
```

```ts
// packages/core-engine/src/text/numberWords.ts
// Türkçe sayı → yazı. Tutar yazısı ("yüzyirmibeşbin") ve sayıların okunuşundan ses profili için.

const ONES = ['', 'bir', 'iki', 'üç', 'dört', 'beş', 'altı', 'yedi', 'sekiz', 'dokuz'];
const TENS = ['', 'on', 'yirmi', 'otuz', 'kırk', 'elli', 'altmış', 'yetmiş', 'seksen', 'doksan'];
const SCALES = ['', 'bin', 'milyon', 'milyar', 'trilyon', 'katrilyon'];

function threeDigits(n: number): string[] {
  const out: string[] = [];
  const h = Math.floor(n / 100), t = Math.floor((n % 100) / 10), o = n % 10;
  if (h > 0) { if (h > 1) out.push(ONES[h]!); out.push('yüz'); }
  if (t > 0) out.push(TENS[t]!);
  if (o > 0) out.push(ONES[o]!);
  return out;
}

/** Tam sayıyı kelimelere böler. 1000 → ["bin"] (Türkçede "bir bin" denmez). */
export function numberToWordList(n: bigint | number): string[] {
  let v = BigInt(n);
  if (v === 0n) return ['sıfır'];
  const neg = v < 0n; if (neg) v = -v;
  const groups: number[] = [];
  while (v > 0n) { groups.push(Number(v % 1000n)); v /= 1000n; }
  const words: string[] = [];
  for (let i = groups.length - 1; i >= 0; i--) {
    const g = groups[i]!;
    if (g === 0) continue;
    if (i === 1 && g === 1) { words.push('bin'); continue; }
    words.push(...threeDigits(g));
    if (i > 0) words.push(SCALES[i]!);
  }
  return neg ? ['eksi', ...words] : words;
}

/** Hukuk metinlerindeki bitişik yazım: 125000 → "yüzyirmibeşbin" */
export const numberToWordsJoined = (n: bigint | number): string => numberToWordList(n).join('');

/** Bir rakam dizisinin okunuşunun SON kelimesi (ses profili için). "2024/892" → "iki" */
export function lastSpokenWord(digits: string): string {
  const clean = digits.replace(/[^0-9]/g, '');
  if (clean === '') return '';
  const trimmed = clean.replace(/^0+(?=\d)/, '');
  const list = numberToWordList(BigInt(trimmed));
  return list[list.length - 1]!;
}
```

#### 3.1.3 Sağlama algoritmaları (AGENT-1, başvuru uygulaması)

Dikkat: JS'te `%` işleci negatif sonuç verebilir (`-29 % 10 === -9`). TCKN'nin 10. hane formülünde `mod()` kullanılması zorunludur; aksi halde geçerli numaraların bir kısmı reddedilir.

```ts
// packages/core-engine/src/validators/checksums.ts
// Sağlama algoritmaları. Girdi: yalnız rakamlardan (IBAN'da TR + rakam) oluşan, boşluksuz dize.

const digitsOf = (s: string): number[] => Array.from(s, (c) => c.charCodeAt(0) - 48);
/** JS'te % negatif sonuç verebilir: (-29 % 10) === -9. Her zaman bunu kullan. */
export const mod = (a: number, n: number): number => ((a % n) + n) % n;

/** TCKN ve YKN (99 ile başlar) için aynı algoritma. */
export function isValidTckn(s: string): boolean {
  if (!/^[1-9][0-9]{10}$/.test(s)) return false;
  const d = digitsOf(s);
  const odd = d[0]! + d[2]! + d[4]! + d[6]! + d[8]!;   // 1., 3., 5., 7., 9. haneler
  const even = d[1]! + d[3]! + d[5]! + d[7]!;          // 2., 4., 6., 8. haneler
  if (mod(odd * 7 - even, 10) !== d[9]) return false;
  const sum10 = d.slice(0, 10).reduce((a, b) => a + b, 0);
  return sum10 % 10 === d[10];
}
export const isYkn = (s: string): boolean => s.startsWith('99') && isValidTckn(s);

/** VKN (10 hane) resmi sağlama. */
export function isValidVkn(s: string): boolean {
  if (!/^[0-9]{10}$/.test(s)) return false;
  const d = digitsOf(s);
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    const tmp = (d[i]! + (9 - i)) % 10;               // 1. hane +9 ... 9. hane +1
    let p = (tmp * 2 ** (9 - i)) % 9;                 // 1. hane 2^9 ... 9. hane 2^1
    if (tmp !== 0 && p === 0) p = 9;
    sum += p;
  }
  return (10 - (sum % 10)) % 10 === d[9];
}

/** MERSİS (16 hane). Tüzel kişi: "0" + VKN(10) + 5 hane. Gerçek kişi: TCKN(11) + 5 hane.
 *  Son 5 hane için kamuya açık bir sağlama yok; gömülü kimlik numarası doğrulanır. */
export function mersisKind(s: string): 'TUZEL' | 'GERCEK' | null {
  if (!/^[0-9]{16}$/.test(s)) return null;
  if (s[0] === '0' && isValidVkn(s.slice(1, 11))) return 'TUZEL';
  if (s[0] !== '0' && isValidTckn(s.slice(0, 11))) return 'GERCEK';
  return null;
}

/** TR IBAN: 26 karakter, ISO 7064 MOD 97-10. Girdi boşluksuz, büyük harf. */
export function isValidTrIban(s: string): boolean {
  if (!/^TR[0-9]{24}$/.test(s)) return false;
  const rearranged = s.slice(4) + s.slice(0, 4);
  let rem = 0;
  for (const ch of rearranged) {
    const v = ch >= 'A' && ch <= 'Z' ? String(ch.charCodeAt(0) - 55) : ch; // A=10 ... T=29, R=27
    for (const c of v) rem = (rem * 10 + (c.charCodeAt(0) - 48)) % 97;
  }
  return rem === 1;
}

/** Luhn (kredi kartı). Girdi 13-19 hane. */
export function isValidLuhn(s: string): boolean {
  if (!/^[0-9]{13,19}$/.test(s)) return false;
  let sum = 0;
  let dbl = false;
  for (let i = s.length - 1; i >= 0; i--) {
    let n = s.charCodeAt(i) - 48;
    if (dbl) { n *= 2; if (n > 9) n -= 9; }
    sum += n;
    dbl = !dbl;
  }
  return sum % 10 === 0;
}

/** Kart ağı ön eki (IIN). Troy (9792) Türkiye'ye özgüdür. */
export function cardNetwork(s: string): 'VISA' | 'MASTERCARD' | 'AMEX' | 'TROY' | 'DIGER' | null {
  if (!isValidLuhn(s)) return null;
  if (/^4/.test(s)) return 'VISA';
  if (/^(5[1-5]|2(2[2-9][1-9]|2[3-9]\d|[3-6]\d\d|7[01]\d|720))/.test(s)) return 'MASTERCARD';
  if (/^3[47]/.test(s)) return 'AMEX';
  if (/^9792/.test(s)) return 'TROY';
  return 'DIGER';
}

// ---- Test verisi üreticileri (yalnız sentetik veri; gerçek kişi numarası test setine GİRMEZ) ----
export function makeTckn(first9: string): string {
  const d = digitsOf(first9);
  const odd = d[0]! + d[2]! + d[4]! + d[6]! + d[8]!;
  const even = d[1]! + d[3]! + d[5]! + d[7]!;
  const d10 = mod(odd * 7 - even, 10);
  const d11 = (d.reduce((a, b) => a + b, 0) + d10) % 10;
  return first9 + d10 + d11;
}
export function makeVkn(first9: string): string {
  for (let c = 0; c <= 9; c++) if (isValidVkn(first9 + c)) return first9 + c;
  throw new Error('unreachable');
}
export function makeTrIban(bank5: string, account16: string): string {
  const bban = bank5 + '0' + account16;
  for (let k = 2; k <= 98; k++) {
    const iban = 'TR' + String(k).padStart(2, '0') + bban;
    if (isValidTrIban(iban)) return iban;
  }
  throw new Error('unreachable');
}
```

**Test vektörleri (Ek C t1 bunları doğrular):**

| Değer | Beklenen |
|---|---|
| `10000000146` | Geçerli TCKN |
| `10000000145` | Geçersiz (11. hane) |
| `00000000146` | Geçersiz (ilk hane 0) |
| `99123456740` | Geçerli YKN |
| `1234567890` | Geçerli VKN |
| `1234567891` | Geçersiz VKN |
| `TR330006100519786457841326` | Geçerli TR IBAN |
| `TR330006100519786457841327` | Geçersiz (mod 97) |
| `4111111111111111` | Geçerli Luhn (Visa) |
| `0` + `makeVkn(...)` + `00015` | Tüzel MERSİS |
| `makeTckn(...)` + `00015` | Gerçek kişi MERSİS |

Ek C t1 ayrıca 2.000 rastgele numara üretip tek hane bozulmasının TCKN ve VKN'de her zaman yakalandığını doğrular.

#### 3.1.4 Deterministik dedektör (AGENT-1, başvuru uygulaması)

Bu dosya Katman 1 ile Katman 2'nin numara tarafını (dosya numarası, tapu, yevmiye, kanun atfı) tek yerde toplar ve kontrat tiplerine çeviren `toContract` bağdaştırıcısını içerir. AGENT-1 bu dosyayı önce olduğu gibi alır, testleri yeşil gösterir, sonra 1.5'teki modüllere böler ve adres, pasaport, uzun numara dedektörlerini ekler.

```ts
// packages/core-engine/src/detectors/deterministic/reference.ts (başvuru uygulaması)
// Katman 1 (sağlamalı kimlikler, iletişim, plaka) ve Katman 2'nin numara tarafı (dosya no, tapu, yevmiye).
// Lookbehind YOK: sınırlar leftBoundary/rightBoundary ile denetlenir.

import { isValidTckn, isValidVkn, mersisKind, isValidTrIban, cardNetwork } from '../../validators/checksums';
import { leftBoundary, rightBoundary, isAlnum, isDigit, lowerView, trLower } from '../../text/turkish';
import { findDockets, classifyDockets } from '../../legal/citation';
import type { DocumentId, EntityCategory, EntityMatch, MentionId, ProtectedSpan } from '../../types/contracts';

export type Cat = 'TCKN' | 'YKN' | 'VKN' | 'MERSIS' | 'IBAN' | 'KART' | 'TELEFON' | 'EPOSTA' | 'PLAKA'
  | 'DOSYA_NO' | 'TAPU' | 'YEVMIYE' | 'DOGUM_TARIHI' | 'PASAPORT' | 'TUTAR' | 'OZEL';
export interface Raw {
  start: number; end: number; category: Cat; ruleId: string;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW'; normalized?: string; flags?: string[];
}
export interface Protected { start: number; end: number; reason: 'ICTIHAT_KUNYESI' | 'KANUN_ATFI'; ruleId: string; ownCaseSuspect: boolean }

// Bağlam pencereleri HER ZAMAN Türkçe küçük harfe çevrilir; desenler küçük harfli ve /i bayraksızdır.
const ctxLeft = (t: string, s: number, n = 40): string => trLower(t.slice(Math.max(0, s - n), s));
const ctxRight = (t: string, e: number, n = 40): string => trLower(t.slice(e, e + n));
const digitsOnly = (s: string): string => s.replace(/[^0-9]/g, '');

// ---------- Kanun atıfları (KORUNAN; plaka ve tutar yanlış pozitiflerini keser) ----------
export const LAW_ABBR = ['TBK', 'TMK', 'TCK', 'HMK', 'CMK', 'TTK', 'İİK', 'IIK', 'VUK', 'GVK', 'KVK', 'KVKK', 'AY', 'AYM', 'İYUK', 'IYUK',
  'BK', 'MK', 'SGK', 'KHK', 'AAÜT', 'AAUT', 'TKHK', 'FSEK', 'SMK', 'KMK', 'DMK', 'ÖTV', 'KDV', 'HD', 'CD', 'HGK', 'CGK', 'BAM', 'BİM'];
const LAW_REF_RE = new RegExp(
  '([0-9]{3,4})\\s+sayılı(?:\\s+[\\p{Lu}][\\p{L}\\.]*){0,5}' +                       // 6098 sayılı Türk Borçlar Kanunu
  '|(?:' + LAW_ABBR.join('|') + ')(?:\\s*(?:m\\.|md\\.|madde|maddesi|\'?nin|\'?nın|\'?un|\'?ün)\\s*[0-9]+(?:\\/[0-9]+)?(?:\\.\\s?(?:madde|maddesi|fıkra|bent))?)?' +
  '|[0-9]{3,4}\\s*S\\.\\s?K\\.', 'gu');

export function findLawRefs(text: string): Protected[] {
  const out: Protected[] = [];
  for (const m of text.matchAll(LAW_REF_RE)) {
    const s = m.index!, e = s + m[0].length;
    if (!leftBoundary(text, s) || !rightBoundary(text, e, isDigit)) continue;
    if (/^[\p{Lu}]+$/u.test(m[0]) && !LAW_ABBR.includes(m[0])) continue;
    out.push({ start: s, end: e, reason: 'KANUN_ATFI', ruleId: 'L2.KANUN', ownCaseSuspect: false });
  }
  return out;
}

// ---------- Katman 1 ----------
export function detectIban(text: string): Raw[] {
  const out: Raw[] = [];
  const re = /TR\s?[0-9]{2}(?:\s?[0-9]{4}){5}\s?[0-9]{2}/gi;
  for (const m of text.matchAll(re)) {
    const s = m.index!, e = s + m[0].length;
    if (!leftBoundary(text, s) || !rightBoundary(text, e)) continue;
    const norm = m[0].replace(/\s/g, '').toUpperCase();
    if (isValidTrIban(norm)) out.push({ start: s, end: e, category: 'IBAN', ruleId: 'L1.IBAN', confidence: 'HIGH', normalized: norm });
    else if (/iban/.test(ctxLeft(text, s, 30))) out.push({ start: s, end: e, category: 'IBAN', ruleId: 'L1.IBAN.SAGLAMASIZ', confidence: 'MEDIUM', normalized: norm, flags: ['NEEDS_REVIEW'] });
  }
  return out;
}

export function detectTcknYkn(text: string): Raw[] {
  const out: Raw[] = [];
  for (const m of text.matchAll(/[0-9]{11}/g)) {
    const s = m.index!, e = s + 11;
    if (!leftBoundary(text, s) || !rightBoundary(text, e, isDigit)) continue;
    if (!isValidTckn(m[0])) continue;
    out.push({ start: s, end: e, category: m[0].startsWith('99') ? 'YKN' : 'TCKN', ruleId: 'L1.TCKN', confidence: 'HIGH', normalized: m[0] });
  }
  // Boşluklu yazım yalnız bağlamla: "T.C. Kimlik No: 100 000 001 46"
  for (const m of text.matchAll(/[0-9]{3}\s[0-9]{3}\s[0-9]{3}\s[0-9]{2}/g)) {
    const s = m.index!, e = s + m[0].length, d = digitsOnly(m[0]);
    if (!leftBoundary(text, s) || !rightBoundary(text, e, isDigit)) continue;
    if (isValidTckn(d) && /kimlik|t\.?\s?c\.?|tckn/.test(ctxLeft(text, s, 30)))
      out.push({ start: s, end: e, category: d.startsWith('99') ? 'YKN' : 'TCKN', ruleId: 'L1.TCKN.BOSLUKLU', confidence: 'HIGH', normalized: d });
  }
  return out;
}

const VKN_CTX = /vergi|v\.?\s?k\.?\s?n|v\.\s?d\.|vd\s*[:.]/;
export function detectVkn(text: string): Raw[] {
  const out: Raw[] = [];
  for (const m of text.matchAll(/[0-9]{10}/g)) {
    const s = m.index!, e = s + 10;
    if (!leftBoundary(text, s) || !rightBoundary(text, e, isDigit)) continue;
    if (!isValidVkn(m[0])) continue;
    const ctx = VKN_CTX.test(ctxLeft(text, s));
    if (!ctx && /^5[0-9]/.test(m[0])) continue;                    // bağlamsız 5xx… → telefon dedektörüne bırak
    out.push({ start: s, end: e, category: 'VKN', ruleId: ctx ? 'L1.VKN' : 'L1.VKN.BAGLAMSIZ', confidence: ctx ? 'HIGH' : 'MEDIUM', normalized: m[0] });
  }
  return out;
}

/** 13-19 haneli, 4'lü gruplu olabilen sayılar: MERSİS (16) önce, sonra Luhn ile kart. */
export function detectMersisAndCards(text: string): Raw[] {
  const out: Raw[] = [];
  for (const m of text.matchAll(/[0-9](?:[ -]?[0-9]){12,18}/g)) {
    const s = m.index!, e = s + m[0].length, d = digitsOnly(m[0]);
    if (!leftBoundary(text, s) || !rightBoundary(text, e, isDigit)) continue;
    if (/[0-9] [0-9]{2} [0-9]{2}$/.test(m[0]) && /^0?5/.test(d)) continue;  // telefon biçimi
    const mk = d.length === 16 ? mersisKind(d) : null;
    if (mk) {
      const ctx = /mersis/.test(ctxLeft(text, s));
      out.push({ start: s, end: e, category: 'MERSIS', ruleId: `L1.MERSIS.${mk}`, confidence: ctx ? 'HIGH' : 'MEDIUM', normalized: d });
      continue;
    }
    const net = cardNetwork(d);
    if (net && (net !== 'DIGER' || /kart/.test(ctxLeft(text, s))))
      out.push({ start: s, end: e, category: 'KART', ruleId: `L1.KART.${net}`, confidence: net === 'DIGER' ? 'MEDIUM' : 'HIGH', normalized: d });
  }
  return out;
}

export function detectPhones(text: string): Raw[] {
  const out: Raw[] = [];
  const re = /(?:(?:\+|00)90[\s.-]?)?\(?0?[\s.-]?\(?([2-5][0-9]{2})\)?[\s.-]?([0-9]{3})[\s.-]?([0-9]{2})[\s.-]?([0-9]{2})/g;
  for (const m of text.matchAll(re)) {
    let s = m.index!; const e = s + m[0].length;
    while (text[s] === ' ' || text[s] === '(') s++;
    const raw = text.slice(s, e);
    if (!leftBoundary(text, s, (c) => isAlnum(c) || c === '+' || c === '/') || !rightBoundary(text, e, isDigit)) continue;
    const prefixed = /^(?:\+|00)90|^0/.test(raw);
    const area = m[1]!;
    const ctx = /tel|gsm|cep|telefon|faks|fax/.test(ctxLeft(text, s, 25));
    if (!prefixed && !ctx) continue;                         // çıplak 10 hane yalnız bağlamla
    if (!/^[2345]/.test(area)) continue;
    out.push({ start: s, end: e, category: 'TELEFON', ruleId: area.startsWith('5') ? 'L1.TEL.GSM' : 'L1.TEL.SABIT', confidence: 'HIGH', normalized: '0' + area + m[2] + m[3] + m[4] });
  }
  return out;
}

export function detectEmails(text: string): Raw[] {
  const out: Raw[] = [];
  for (const m of text.matchAll(/[\p{L}\p{N}._%+-]+@[\p{L}\p{N}-]+(?:\.[\p{L}\p{N}-]+)*\.[A-Za-z]{2,}/gu)) {
    const s = m.index!, e = s + m[0].length;
    out.push({ start: s, end: e, category: 'EPOSTA', ruleId: /\.kep\.tr$/i.test(m[0]) ? 'L1.KEP' : 'L1.EPOSTA', confidence: 'HIGH' });
  }
  return out;
}

const PLATE_LAW_BLOCK = new Set(LAW_ABBR.filter((x) => /^[A-PR-VYZ]+$/.test(x)).concat(['E', 'K', 'S', 'T', 'MD', 'NO', 'SK']));
export function detectPlates(text: string): Raw[] {
  const out: Raw[] = [];
  const re = /(0[1-9]|[1-7][0-9]|8[01]) ?([A-PR-VYZ]{1,3}) ?([0-9]{2,5})/g;
  for (const m of text.matchAll(re)) {
    const s = m.index!, e = s + m[0].length;
    if (!leftBoundary(text, s) || !rightBoundary(text, e)) continue;
    const L = m[2]!.length, D = m[3]!.length;
    const ok = (L === 1 && D >= 4 && D <= 5) || (L === 2 && D >= 3 && D <= 4) || (L === 3 && D >= 2 && D <= 3);
    if (!ok || PLATE_LAW_BLOCK.has(m[2]!)) continue;
    const left = ctxLeft(text, s, 25), right = ctxRight(text, e, 15);
    if (/(sayılı|s\.\s?k\.|kanun\p{L}*|m\.|md\.|madde\p{L}*|fıkra\p{L}*|bent\p{L}*)\s*$/u.test(left)) continue;
    if (/^\s*(\.|sayılı|s\.\s?k|md\.|m\.|madde)/u.test(right)) continue;
    const pos = /plaka|araç|aracın|aracı|otomobil|kamyon|motosiklet|taşıt/.test(ctxLeft(text, s, 40) + ctxRight(text, e, 40));
    out.push({ start: s, end: e, category: 'PLAKA', ruleId: 'L1.PLAKA', confidence: pos ? 'HIGH' : 'MEDIUM', normalized: m[1] + ' ' + m[2] + ' ' + m[3] });
  }
  return out;
}

export function detectBirthDates(text: string): Raw[] {
  const out: Raw[] = [];
  const view = lowerView(text);
  const re = /(?:doğum\s+tarihi|doğ\.\s?tar\.?|d\.\s?t\.)\s*[:]?\s*([0-3]?[0-9][./-][01]?[0-9][./-](?:19|20)[0-9]{2})/gu;
  for (const m of view.matchAll(re)) {
    const s = m.index! + m[0].lastIndexOf(m[1]!), e = s + m[1]!.length;
    out.push({ start: s, end: e, category: 'DOGUM_TARIHI', ruleId: 'L1.DOGUM', confidence: 'HIGH' });
  }
  for (const m of view.matchAll(/((?:19|20)[0-9]{2})\s+doğumlu/gu)) {
    out.push({ start: m.index!, end: m.index! + 4, category: 'DOGUM_TARIHI', ruleId: 'L1.DOGUM.YIL', confidence: 'HIGH' });
  }
  return out;
}

// ---------- Katman 2: numara tarafı ----------
export function detectDocketsAndCitations(text: string, currentYear: number): { raws: Raw[]; protectedSpans: Protected[] } {
  const raws: Raw[] = [], protectedSpans: Protected[] = [];
  for (const d of classifyDockets(text, findDockets(text, currentYear))) {
    const { start, end } = d.match;
    if (d.verdict === 'MASK') raws.push({ start, end, category: 'DOSYA_NO', ruleId: 'L2.DOSYA', confidence: d.confidence });
    else protectedSpans.push({ start, end, reason: 'ICTIHAT_KUNYESI', ruleId: 'L2.ICTIHAT', ownCaseSuspect: d.verdict === 'REVIEW' });
  }
  return { raws, protectedSpans };
}

export function detectLandRecords(text: string): Raw[] {
  const out: Raw[] = [];
  const view = lowerView(text);
  const res = [
    /[0-9]{1,6}\s*ada\s*,?\s*(?:ve\s+)?[0-9]{1,5}\s*parsel(?:\s*(?:sayılı|numaralı|nolu))?/gu,
    /ada\s*(?:no|numarası)?\s*[:.]?\s*[0-9]{1,6}\s*,?\s*(?:ve\s+)?parsel\s*(?:no|numarası)?\s*[:.]?\s*[0-9]{1,5}/gu,
  ];
  for (const re of res) for (const m of view.matchAll(re)) {
    const s = m.index!, e = s + m[0].length;
    if (out.some((o) => s < o.end && o.start < e)) continue;
    out.push({ start: s, end: e, category: 'TAPU', ruleId: 'L2.TAPU', confidence: 'HIGH' });
  }
  return out;
}

export function detectNotaryJournal(text: string): Raw[] {
  const out: Raw[] = [];
  const view = lowerView(text);
  for (const m of view.matchAll(/yevmiye\s*(?:no|numarası|numaralı|nolu|sayılı)?\s*[:.]?\s*([0-9]{1,7})/gu)) {
    const s = m.index! + m[0].lastIndexOf(m[1]!); out.push({ start: s, end: s + m[1]!.length, category: 'YEVMIYE', ruleId: 'L2.YEVMIYE', confidence: 'HIGH' });
  }
  for (const m of view.matchAll(/([0-9]{1,7})\s+yevmiye\s*(?:no|numaralı|nolu|sayılı)/gu)) {
    out.push({ start: m.index!, end: m.index! + m[1]!.length, category: 'YEVMIYE', ruleId: 'L2.YEVMIYE', confidence: 'HIGH' });
  }
  return out;
}

/** Hepsini çalıştır; korunan aralıkla örtüşen bulguları at; çakışmaları öncelik/uzunlukla çöz. */
export function detectAll(text: string, currentYear = new Date().getFullYear()): { raws: Raw[]; protectedSpans: Protected[] } {
  const laws = findLawRefs(text);
  const dc = detectDocketsAndCitations(text, currentYear);
  const protectedSpans = [...laws, ...dc.protectedSpans];
  const order: Cat[] = ['IBAN', 'TCKN', 'YKN', 'MERSIS', 'KART', 'VKN', 'TELEFON', 'EPOSTA', 'TAPU', 'YEVMIYE', 'DOSYA_NO', 'DOGUM_TARIHI', 'PLAKA'];
  const all = [...detectIban(text), ...detectTcknYkn(text), ...detectMersisAndCards(text), ...detectVkn(text), ...detectPhones(text),
    ...detectEmails(text), ...detectLandRecords(text), ...detectNotaryJournal(text), ...dc.raws, ...detectBirthDates(text), ...detectPlates(text)];
  const conf = { HIGH: 3, MEDIUM: 2, LOW: 1 } as const;
  all.sort((a, b) => conf[b.confidence] - conf[a.confidence] || order.indexOf(a.category) - order.indexOf(b.category) || (b.end - b.start) - (a.end - a.start));
  const kept: Raw[] = [];
  for (const r of all) {
    if (protectedSpans.some((p) => r.start < p.end && p.start < r.end)) continue;
    if (kept.some((k) => r.start < k.end && k.start < r.end)) continue;
    kept.push(r);
  }
  return { raws: kept.sort((a, b) => a.start - b.start), protectedSpans };
}

/** Başvuru çıktısını kontrat tiplerine çevirir. Puan: HIGH 0.95, MEDIUM 0.7, LOW 0.4. */
export function toContract(text: string, docId: DocumentId, out: { raws: Raw[]; protectedSpans: Protected[] }, nextId: () => MentionId):
  { matches: EntityMatch[]; protectedSpans: ProtectedSpan[] } {
  const score = { HIGH: 0.95, MEDIUM: 0.7, LOW: 0.4 } as const;
  const matches: EntityMatch[] = out.raws.map((r) => ({
    id: nextId(), docId, span: { start: r.start, end: r.end }, text: text.slice(r.start, r.end),
    category: r.category as EntityCategory, layer: r.ruleId.startsWith('L2') ? 'L2_LEGAL' as const : 'L1_CHECKSUM' as const,
    confidence: r.confidence, score: score[r.confidence], ruleId: r.ruleId,
    ...(r.normalized !== undefined ? { normalized: r.normalized } : {}),
    flags: (r.flags ?? []).filter((f): f is EntityMatch['flags'][number] => f === 'NEEDS_REVIEW'),
  }));
  const protectedSpans: ProtectedSpan[] = out.protectedSpans.map((p) => ({
    docId, span: { start: p.start, end: p.end }, reason: p.reason, ruleId: p.ruleId, ownCaseSuspect: p.ownCaseSuspect,
  }));
  return { matches, protectedSpans };
}
```

#### 3.1.5 Adres kural motoru (AGENT-1, yazılacak)

NER modellerinin çoğu adres değil yalnız yer adı (LOC) verir; adres bu nedenle kural motoruyla bulunur.

```
ÇAPA sözcükleri (lowerView üzerinde, sözcük sınırlı):
  mahallesi | mah. | mh. | caddesi | cad. | cd. | sokağı | sokak | sok. | sk. | bulvarı | blv. | bul.
  apartmanı | apt. | sitesi | blok | no: | no. | kat: | daire: | d: | köyü | mevkii | osb | organize sanayi
ETİKET sözcükleri: "adres", "adresi", "ikametgah", "ikametgâhı", "yerleşim yeri", "tebligat adresi"
İL listesi: 81 il (büyük/küçük harf duyarsız); İLÇE listesi: isteğe bağlı, lisanslı kaynaktan (V-05)

1. Çapaları bul. Aynı satırda aralarında en çok 40 karakter olan çapaları tek adaya birleştir.
2. Sola genişlet: en çok 4 belirteç; büyük harfle başlayan sözcük, sayı, sıra sayısı ("1."), "ve".
   Durdurucular: ":", ",", "(", satır başı, rol sözcüğü (davacı, davalı ...), ETİKET sözcüğü (etiket dışarıda kalır).
3. Sağa genişlet: sayı, "No:12", "/", "Kat", "Daire", "D:", büyük harfli sözcük, "İlçe/İL" kalıbı
   (\p{Lu}\p{Ll}+\s*/\s*\p{Lu}{3,}  örn. Çankaya/ANKARA), "İlçe - İl", posta kodu (5 rakam, il kodu 01-81 ile başlar).
   Durdurucular: satır sonu, ";", ". " + büyük harf, 160 karakter sınırı.
4. Geçerlilik: en az 2 çapa VEYA 1 çapa + (il/ilçe adı VEYA No:). Aksi halde DÜŞÜK.
5. Güven: sonda il adı varsa YÜKSEK, yoksa ORTA.
6. ETİKET sözcüğünden sonra ":" ile başlayan ve satır sonuna kadar süren metin, çapa olmasa da ADRES (ORTA).
7. Aralık, il adı dahil bütündür: "Kızılay Mah. Atatürk Bulvarı No:12 Çankaya/ANKARA" -> [ADRES_1].
```

Kabul: Ek A'daki adres vakalarında duyarlılık (recall) en az 0,95, kesinlik (precision) en az 0,90.

---

### 3.2 Katman 2: hukuki bağlam kuralları ve İçtihat Koruma Filtresi

#### 3.2.1 Maskelenen hukuki numaralar

| Tür | Tanıma | Maskelenen aralık | Etiket |
|---|---|---|---|
| Yerel mahkeme / icra / savcılık / noter dosya numarası | `YYYY/N` (yıl 1950 ile içinde bulunulan yıl + 1 arası; tarih parçası değil) ve İçtihat Koruma Filtresi kararı MASKELE | Yalnız `2024/892`. `E.`, `K.`, `Esas`, `Karar` sözcükleri metinde kalır; böylece LLM esas ile karar numarasını ayırt etmeye devam eder ve ek uyumu sayının okunuşuna göre yapılır (`2024/892'de`) | `[DOSYA_NO_n]` |
| Tapu kaydı | `123 ada 45 parsel`, `Ada No: 123, Parsel No: 45` (büyük/küçük harf duyarsız) | Ada ve parsel ifadesinin tamamı | `[TAPU_n]` |
| Noter yevmiye numarası | `yevmiye no: 05123`, `05123 yevmiye numaralı` | Yalnız sayı | `[YEVMİYE_n]` |
| Kanun atfı | `6098 sayılı ...`, `TBK m. 49`, `5237 S.K.` | Maskelenmez; KORUNAN aralık olur ve plaka/tutar yanlış pozitiflerini keser | yok |

Tarih ayıklama kuralları (Ek C t4): `12/03/2024` ve `2024/03/12` dosya numarası değildir. Sayı içinden eşleşme (`12024/5`) reddedilir.

#### 3.2.2 İçtihat Koruma Filtresi

**Amaç:** Yargıtay, Danıştay, AYM, AİHM, HGK, CGK, BAM ve BİM emsal künyeleri hiçbir koşulda otomatik maskelenmez; yerel dosya numaraları maskelenir.

**Algoritma:**

1. Metindeki tüm `YYYY/N` adaylarını bul (tarih parçaları elenir).
2. **Künye zinciri:** Ardışık iki aday arasında en çok 30 karakter varsa ve aradaki metin yalnız ayraç, etiket ya da tarih ise (`E.`, `K.`, `Esas`, `Karar`, `E:`, `K:`, `sayılı`, `ve`, `,`, `;`, `-`, `T.`, `tarih`, `tarihli`, `dd.mm.yyyy`) adaylar aynı gruba girer. Grup tek karar alır. Böylece `Yargıtay Hukuk Genel Kurulu'nun 12.05.2021 tarih ve 2017/2154 E., 2021/612 K.` künyesinde karar numarası, yüksek mahkeme adından 60 karakterden uzak düşse bile korunur.
3. **Pencere:** Grubun ilk adayının solundaki 60 karakter ve son adayının sağındaki 60 karakter, `lowerView` üzerinde taranır.
4. **İşaretler:** `HIGH_COURT_RE` (yüksek mahkeme) ve `LOCAL_COURT_RE` (yerel mahkeme, icra, savcılık, noter). Yüksek mahkeme işaretiyle örtüşen yerel işaret atılır (`Bölge İdare Mahkemesi` içindeki `İdare Mahkemesi`). Kısa kısaltmalarda (`bam`, `aym`, `hgk`) sağ sözcük sınırı aranır (`bamya` eşleşmez); uzun işaretlerde aranmaz, çünkü Türkçe ek bitişik gelir (`Mahkemesinin`).
5. **Karar tablosu:**

| Durum | Karar | Güven |
|---|---|---|
| Soldaki en yakın işaret yüksek mahkeme | KORU | YÜKSEK |
| Soldaki en yakın işaret yerel | MASKELE | YÜKSEK |
| Solda işaret yok, sağdaki en yakın işaret yüksek mahkeme | KORU | ORTA |
| Solda işaret yok, sağdaki en yakın işaret yerel | MASKELE | ORTA |
| Hiç işaret yok | MASKELE (K-07) | ORTA |
| KORU kararı ve pencerede "kendi dosyası" işareti var, emsal işareti yok | İNCELE: maskelenmez, `OWN_CASE_SUSPECT` bayrağı ve arayüzde turuncu rozet | YÜKSEK |

"Kendi dosyası" işaretleri: `dosyamız`, `davamız`, `müvekkil`, `tarafımız`, `temyiz eden/edilen/incelemesi/başvurusu`, `istinaf eden/edilen/incelemesi/başvurusu`, `ilamı ile onan.../bozul...`, `onanarak`, `bozularak`, `gönderilen/gönderilmiş`, `incelemededir`, `derdest`. Emsal işaretleri: `emsal`, `içtihat`, `aynı yönde`, `benzer`, `bkz.`, `kararında belirtildiği`, `sayılı kararı`, `uyarınca`.

Neden İNCELE: Müvekkilin kendi temyiz dosyasının Yargıtay esas numarası da kişiyi tanımlayabilir. Kural ihlal edilmez (künye otomatik maskelenmez); ama avukat uyarılır ve tek tıkla maskeleyebilir.

**Başvuru uygulaması (test edildi: Ek C t4, 23 vaka):**

```ts
// packages/core-engine/src/legal/citation.ts
// Esas/Karar numaralarını "yüksek mahkeme künyesi (KORU)" / "yerel dosya (MASKELE)" / "kendi dosyası olabilir (İNCELE)"
// olarak sınıflandırır. Pencere: eşleşmenin (veya künye zincirinin) solunda ve sağında 60 karakter.
// Tüm işaret desenleri küçük harfli yazılır ve lowerView() üzerinde çalışır (Türkçe İ/ı sorunu).
// Lookbehind YASAK (eski WebKit). Sınır ve örtüşme denetimleri kodla yapılır.

import { lowerView, isAlnum, isDigit, isLetter } from '../text/turkish';

export type CitationVerdict = 'PROTECT' | 'MASK' | 'REVIEW';
export interface DocketMatch { readonly start: number; readonly end: number; readonly year: number; readonly no: number }
export interface DocketDecision {
  readonly match: DocketMatch;
  readonly verdict: CitationVerdict;
  readonly confidence: 'HIGH' | 'MEDIUM';
  readonly reason: string;
  readonly groupId: number;
}

export const WINDOW = 60;

/** Yüksek mahkeme / emsal işaretleri (bulunursa KORU). */
export const HIGH_COURT_RE = new RegExp([
  'yargıtay', 'yarg\\.', 'y\\.\\s?\\d{1,2}\\.\\s?(?:hd|cd|h\\.d\\.|c\\.d\\.)',
  '\\d{1,2}\\.\\s?(?:hd|cd|h\\.d\\.|c\\.d\\.)', '\\d{1,2}\\.\\s?(?:hukuk|ceza)\\s+dairesi',
  'hgk', 'h\\.g\\.k\\.', 'hukuk\\s+genel\\s+kurulu', 'cgk', 'c\\.g\\.k\\.', 'ceza\\s+genel\\s+kurulu',
  'y?ibk', 'içtihad[ıi]\\s+birleştirme', 'danıştay', 'dan\\.', '\\d{1,2}\\.\\s?d\\.(?=\\s|,)', 'iddk', 'vddk',
  'idari\\s+dava\\s+daireleri', 'vergi\\s+dava\\s+daireleri', 'anayasa\\s+mahkemesi', 'aym', 'aihm',
  'avrupa\\s+insan\\s+hakları\\s+mahkemesi', 'uyuşmazlık\\s+mahkemesi', 'bölge\\s+adliye\\s+mahkemesi', 'bam',
  'bölge\\s+idare\\s+mahkemesi', 'bim', '\\d{1,2}\\.\\s?idd', 'b\\.\\s?no', 'başvuru\\s+no',
].join('|'), 'gu');
/** Yerel mahkeme / icra / savcılık / noter işaretleri (bulunursa MASKELE). */
export const LOCAL_COURT_RE = new RegExp([
  'asliye', 'sulh', 'ağır\\s+ceza', 'aile\\s+mahkemesi', 'iş\\s+mahkemesi', 'tüketici\\s+mahkemesi',
  'kadastro\\s+mahkemesi', 'fikri\\s+ve\\s+sınai', 'icra\\s+(?:dairesi|müdürlüğü|hukuk|ceza)', 'icra',
  'çocuk\\s+mahkemesi', 'idare\\s+mahkemesi', 'vergi\\s+mahkemesi', 'başsavcılığı', 'savcılığı',
  'noterliği', 'arabuluculuk', 'hakimliği', 'hâkimliği', 'talimat', 'muhabere',
].join('|'), 'gu');
/** Avukatın kendi dosyasına işaret eden ifadeler (yüksek mahkemede olsa bile İNCELE). */
export const OWN_CASE_RE = /dosyamız|davamız|müvekkil|tarafımız|temyiz\s+(?:eden|edilen|incelemesi|başvurusu)|istinaf\s+(?:eden|edilen|incelemesi|başvurusu)|ilamı\s+ile\s+(?:onan|bozul)|onanarak|bozularak|gönderil(?:en|miş)|incelemededir|derdest/u;
/** Emsal göstergesi: kendi-dosya şüphesini geçersiz kılar. */
export const PRECEDENT_RE = /emsal|içtihat|aynı\s+yönde|benzer|bkz\.|kararında(?:\s+de)?\s+belirtildiği|sayılı\s+kararı(?:nda)?|uyarınca/u;

const YEAR_MIN = 1950;
/** "2024/892", "2024 / 892". Tarih parçaları elenir. */
export function findDockets(text: string, currentYear = new Date().getFullYear()): DocketMatch[] {
  const out: DocketMatch[] = [];
  const re = /([12][0-9]{3})\s?\/\s?([0-9]{1,7})/g;
  for (const m of text.matchAll(re)) {
    const start = m.index!, end = start + m[0].length;
    const year = Number(m[1]), no = Number(m[2]);
    if (year < YEAR_MIN || year > currentYear + 1 || no === 0) continue;
    const before = text.slice(Math.max(0, start - 3), start);
    const after = text.slice(end, end + 3);
    if (/[0-9]$/.test(before) || /^[0-9]/.test(after)) continue;   // sayı içinde
    if (/[0-9]{1,2}[./]\s?$/.test(before)) continue;               // 12/2024/... veya 12.2024/...
    if (/^\s?[./-]\s?[0-9]/.test(after)) continue;                 // 2024/03/12 tarih
    out.push({ start, end, year, no });
  }
  return out;
}

interface Hit { start: number; end: number }
/** view üzerinde [from, to) aralığında işaret arar; sol sınır zorunlu, kısa kısaltmalarda sağ sınır da. */
function hits(re: RegExp, view: string, from: number, to: number): Hit[] {
  const out: Hit[] = [];
  re.lastIndex = 0;
  for (const m of view.slice(from, to).matchAll(re)) {
    const s = from + m.index!, e = s + m[0].length;
    const startsWithDigit = /^[0-9]/.test(m[0]);
    if (s > 0 && (startsWithDigit ? isDigit(view[s - 1]) : isAlnum(view[s - 1]))) continue;
    if (/^\p{L}{2,4}$/u.test(m[0]) && e < view.length && isLetter(view[e])) continue;   // "bam" ≠ "bamya"
    out.push({ start: s, end: e });
  }
  return out;
}

/** Künye zinciri: aralarında yalnız ayraç/etiket/tarih bulunan ardışık numaralar tek grup olur. */
const CHAIN_GAP = /^\s*(?:e\.|k\.|esas|karar|e:|k:|no|sayılı|ve|,|;|-|t\.|tarih(?:li)?|[0-9]{1,2}[./][0-9]{1,2}[./][0-9]{4}|\s)*\s*$/u;

export function classifyDockets(text: string, dockets: readonly DocketMatch[]): DocketDecision[] {
  const view = lowerView(text);
  const groups: DocketMatch[][] = [];
  for (const d of dockets) {
    const g = groups[groups.length - 1];
    const last = g?.[g.length - 1];
    if (g && last && d.start - last.end <= 30 && CHAIN_GAP.test(view.slice(last.end, d.start))) g.push(d);
    else groups.push([d]);
  }
  const out: DocketDecision[] = [];
  groups.forEach((g, gi) => {
    const first = g[0]!, last = g[g.length - 1]!;
    const lStart = Math.max(0, first.start - WINDOW);
    const rEnd = Math.min(text.length, last.end + WINDOW);
    // Yüksek mahkeme işaretiyle örtüşen yerel işaret atılır ("Bölge İdare Mahkemesi" içindeki "İdare Mahkemesi").
    const outside = (xs: Hit[], hs: Hit[]): Hit[] => xs.filter((x) => !hs.some((h) => x.start < h.end && h.start < x.end));
    const hl = hits(HIGH_COURT_RE, view, lStart, first.start), ll = outside(hits(LOCAL_COURT_RE, view, lStart, first.start), hl);
    const hr = hits(HIGH_COURT_RE, view, last.end, rEnd), lr = outside(hits(LOCAL_COURT_RE, view, last.end, rEnd), hr);
    const nearestLeft = (xs: Hit[]): number => (xs.length ? first.start - Math.max(...xs.map((h) => h.end)) : Infinity);
    const nearestRight = (xs: Hit[]): number => (xs.length ? Math.min(...xs.map((h) => h.start)) - last.end : Infinity);
    const dHigh = nearestLeft(hl), dLocal = nearestLeft(ll);
    let verdict: CitationVerdict, confidence: 'HIGH' | 'MEDIUM', reason: string;
    if (dHigh < dLocal) { verdict = 'PROTECT'; confidence = 'HIGH'; reason = 'solda yüksek mahkeme işareti'; }
    else if (dLocal < Infinity) { verdict = 'MASK'; confidence = 'HIGH'; reason = 'solda yerel mahkeme işareti'; }
    else if (nearestRight(hr) < nearestRight(lr)) { verdict = 'PROTECT'; confidence = 'MEDIUM'; reason = 'sağda yüksek mahkeme işareti'; }
    else if (nearestRight(lr) < Infinity) { verdict = 'MASK'; confidence = 'MEDIUM'; reason = 'sağda yerel işaret'; }
    else { verdict = 'MASK'; confidence = 'MEDIUM'; reason = 'işaret yok: gizlilik yönünde varsayılan'; }
    if (verdict === 'PROTECT') {
      const ctx = view.slice(lStart, rEnd);
      if (OWN_CASE_RE.test(ctx) && !PRECEDENT_RE.test(ctx)) { verdict = 'REVIEW'; reason += '; kendi dosyası olabilir'; }
    }
    for (const d of g) out.push({ match: d, verdict, confidence, reason, groupId: gi });
  });
  return out;
}
```

**Örnek kararlar (t4'ten):**

| Metin | Karar |
|---|---|
| `Yargıtay 9. HD 2022/4110 E., 2023/1902 K. sayılı kararında` | İkisi de KORU |
| `Ankara 4. Asliye Ticaret Mahkemesi 2024/892 E.` | MASKELE |
| `ANKARA 4. ASLİYE TİCARET MAHKEMESİ 2024/892 E.` | MASKELE (büyük harf) |
| `İst. 12. İcra Dairesi 2025/114 E.` | MASKELE |
| `Ankara BAM 23. HD'nin 2023/456 E. 2024/12 K. sayılı kararı` | İkisi de KORU |
| `Müvekkilimizin dosyası Yargıtay 3. HD'ye gönderilmiş olup 2024/5555 E.` | İNCELE |
| `...Mahkemesinin 2024/892 E. ... Yargıtay 11. HD'nin 2025/100 E. sayılı ilamı ile onanan` | 2024/892 MASKELE, 2025/100 İNCELE |
| `Ankara Bölge İdare Mahkemesi 2. İDD 2022/10 E.` | KORU |
| `İstanbul 3. İdare Mahkemesi 2022/10 E.` | MASKELE |
| `AYM, B. No: 2018/12345` | KORU |
| `dosya no 2024/892 E.` (işaret yok) | MASKELE (ORTA) |
| `Yargıtay` + 70 karakter + `2020/1 E.` | MASKELE (pencere dışı) |

**Künye içindeki adlar:** AİHM ve AYM bireysel başvuru kararları başvurucunun adıyla anılır (`X/Türkiye`, `Mehmet ... Başvurusu`). KORU kararı alan bir künyenin 60 karakterlik penceresindeki `.../Türkiye` ve `... Başvurusu` kalıpları da korunan aralığa eklenir; içlerindeki adlar maskelenmez (kamuya açık karar adıdır).

#### 3.2.3 Tutar Şaşırtma (Fuzzing)

**Kipler** (`MaskingOptions.amountMode`):

| Kip | Davranış | Ne zaman |
|---|---|---|
| `OFF` (varsayılan) | Tutarlar olduğu gibi kalır | LLM'den hesap isteniyorsa ve tutar tek başına kimlik belirlemiyorsa |
| `TOKEN` | Her tutar `[TUTAR_n]` olur | Hesap istenmiyorsa, en güçlü gizlilik |
| `SCALE` | Belgedeki TÜM tutarlar aynı gizli `k` ile çarpılır; yazıyla tutar yeni değere göre yeniden yazılır | Hesap isteniyor ama gerçek tutar gizlenmek isteniyorsa |

**SCALE kuralları:**

1. `k`, `scaleRange` içinde (varsayılan 0,80-1,25) `RandomSource` ile seçilir; [0,95, 1,05] aralığı dışlanır. `k` dört ondalığa yuvarlanır ve yalnız kasada durur.
2. Oranlar korunur: `%9 faiz`, `1/4 pay`, `%20 vekalet ücreti` gibi doğrusal hesaplar ölçekli tutarlarla yapılır ve sonuç da aynı `k` ile ölçeklidir.
3. Biçim korunur: binlik ayracı, ondalık hane sayısı, para birimi konumu (`125.000,00 TL`, `₺125.000`, `1.250.000.-TL`).
4. Yazıyla tutar: tutarın hemen ardından gelen parantez içindeki bitişik sayı sözcükleri (`(yüzyirmibeşbin Türk Lirası)`) yeni değerin yazısıyla değiştirilir; aksi halde gerçek tutar yazıdan okunurdu.
5. **Geri çözme:** LLM yanıtındaki tutar, kasadaki ölçekli tutarlardan biriyle birebir aynıysa özgün tutara döner. Diğer tutarlar (LLM'in hesapladığı faiz gibi) DEĞİŞMEZ; arayüz `AMOUNT_DERIVED` sorunu olarak `değer / k` önerisini gösterir ve kullanıcı tek tek uygular. Neden otomatik değil: LLM ölçeklenmemiş sabitler de yazar (maktu harç, tarifedeki maktu ücret); bunları `k` ile bölmek yanlış sonuç üretir.
6. **Kalıcı uyarı (SCALE açıkken):** "Parasal sınırlar (istinaf ve temyiz kesinlik sınırları, harç ve vekalet ücreti tarifesi dilimleri) ölçeklenmiş tutara göre değerlendirilir. Bu konulardaki yanıtları gerçek tutarla yeniden kontrol edin."

**Başvuru uygulaması (test edildi: Ek C t7):**

```ts
// packages/core-engine/src/fuzz/amount.ts
// Tutar tespiti, Türkçe biçimli sayı ayrıştırma/biçimleme ve oran korumalı ölçekleme (Tutar Şaşırtma).
// İlke: belgedeki TÜM tutarlar aynı gizli k ile çarpılır; böylece faiz, yüzde ve pay hesapları LLM'de
// orantılı kalır. Geri çözmede yalnız birebir eşleşen ölçekli değer geri alınır; türetilmiş tutar için
// k ile bölünmüş değer yalnız ÖNERİLİR (maktu harç gibi ölçeklenmemiş sabitler bozulmasın diye).

import { numberToWordsJoined } from '../text/numberWords';
import type { AmountHit, AmountStyle, RandomSource, TextEdit } from '../types/contracts';

const CUR = '(?:TL|TRY|₺|Türk\\s+Lirası|USD|ABD\\s+Doları|Dolar|EUR|Euro|Avro|GBP|Sterlin)';
const NUM = '((?:[0-9]{1,3}(?:\\.[0-9]{3})+|[0-9]+)(?:,[0-9]{1,2})?)';
const AFTER_RE = new RegExp(NUM + '(?:\\s?(?:,-|\\.-|-))?\\s?(' + CUR + ')', 'gu');   // 125.000,00 TL · 1.250.000.-TL
const BEFORE_RE = new RegExp('(₺|\\$|€|£|USD|EUR|TL)\\s?' + NUM, 'gu');             // ₺125.000 · USD 5.000
const NUMBER_WORDS = ['sıfır', 'bir', 'iki', 'üç', 'dört', 'beş', 'altı', 'yedi', 'sekiz', 'dokuz', 'on', 'yirmi', 'otuz', 'kırk',
  'elli', 'altmış', 'yetmiş', 'seksen', 'doksan', 'yüz', 'bin', 'milyon', 'milyar', 'trilyon'];
/** Tutarın hemen ardındaki "(yüzyirmibeşbin Türk Lirası)" içindeki bitişik sayı sözcükleri */
const WORDS_RE = new RegExp('^\\s?\\(((?:' + NUMBER_WORDS.join('|') + ')+)', 'u');

export function parseTrNumber(s: string): { value: number; style: AmountStyle } {
  const [intPart = '', dec = ''] = s.split(',');
  const thousands = intPart.includes('.') ? '.' : '';
  const value = Number(intPart.replace(/\./g, '') + (dec ? '.' + dec : ''));
  return { value, style: { thousands, decimals: dec.length as 0 | 1 | 2 } };
}

export function formatTrNumber(value: number, style: AmountStyle): string {
  const fixed = value.toFixed(style.decimals);
  const [i = '', d] = fixed.split('.');
  const grouped = style.thousands ? i.replace(/\B(?=(\d{3})+(?!\d))/g, '.') : i;
  return d ? `${grouped},${d}` : grouped;
}

export function findAmounts(text: string): AmountHit[] {
  const out: AmountHit[] = [];
  const push = (start: number, numText: string, currency: string, tailEnd: number): void => {
    const end = start + numText.length;
    if (out.some((o) => start < o.span.end && o.span.start < end)) return;
    const { value, style } = parseTrNumber(numText);
    const wm = text.slice(tailEnd).match(WORDS_RE);
    const hit: AmountHit = wm
      ? { span: { start, end }, value, style, currency,
          words: { span: { start: tailEnd + wm[0].indexOf(wm[1]!), end: tailEnd + wm[0].indexOf(wm[1]!) + wm[1]!.length }, text: wm[1]! } }
      : { span: { start, end }, value, style, currency };
    out.push(hit);
  };
  for (const m of text.matchAll(AFTER_RE)) push(m.index!, m[1]!, m[2]!, m.index! + m[0].length);
  for (const m of text.matchAll(BEFORE_RE)) push(m.index! + m[0].length - m[2]!.length, m[2]!, m[1]!, m.index! + m[0].length);
  return out.sort((a, b) => a.span.start - b.span.start);
}

/** k ∈ [lo, hi]; [0.95, 1.05] dışlanır (fark edilmeyecek kadar küçük ölçek anlamsızdır). */
export function pickScale(rng: RandomSource, range: readonly [number, number] = [0.8, 1.25]): number {
  const [lo, hi] = range;
  for (;;) {
    const k = Math.round((lo + rng.nextFloat() * (hi - lo)) * 10000) / 10000;
    if (k < 0.95 || k > 1.05) return k;
  }
}

/** Tüm tutarları aynı k ile ölçekler; yazıyla tutar da yeni değere göre yeniden yazılır. */
export function scaleAmounts(hits: readonly AmountHit[], k: number): TextEdit[] {
  const edits: TextEdit[] = [];
  for (const h of hits) {
    const v = h.value * k;
    edits.push({ span: h.span, replacement: formatTrNumber(v, h.style) });
    if (h.words) edits.push({ span: h.words.span, replacement: numberToWordsJoined(Math.round(v)) });
  }
  return edits;
}
```

---

### 3.3 Katman 3: istemci içi NER ve varlık tekilleştirme

#### 3.3.1 Model seçimi ve kabul ölçütleri (AGENT-2)

| Aday | Not |
|---|---|
| `akdeniz27/bert-base-turkish-cased-ner` | İlk aday (D-04). PER/ORG/LOC. INT8 yaklaşık 106 MB. |
| `savasy/bert-base-turkish-ner-cased` | WikiANN ile eğitilmiş; lisans doğrulanmadan kullanılmaz. |
| Çok dilli GLiNER (PII odaklı türevler dahil) | Sıfır atış etiketleme esnekliği; boyutu ve Türkçe hukuk metnindeki başarımı ölçülmeden seçilmez. |

Seçim ölçütleri (hepsi sağlanmalı; ölçüm `docs/adr/0003-ner-model-secimi.md`'ye yazılır):

1. Lisans ticari kullanıma izin verir (V-04).
2. INT8 ONNX dosyası en çok 130 MB.
3. Altın test setinin hukuk vakalarında (Ek A) KİŞİ F1 en az 0,90; ŞİRKET F1 en az 0,80 (kural katmanıyla birlikte ölçülür).
4. Başvuru makinesinde (Apple M1 veya Intel i5 8. nesil, tek iş parçacığı WASM) 20 sayfalık dilekçe (yaklaşık 10.000 sözcük) en çok 20 saniyede biter.
5. Model ve tokenizer dosyalarının SHA-256 değerleri `modelConfig.ts`'ye ve `docs/sources/ner-model.md`'ye yazılır.

#### 3.3.2 NER Worker protokolü

Ana iş parçacığı iki worker'ı başlatır ve `MessageChannel` kurar: `port1` Engine Worker'a, `port2` NER Worker'a aktarılır. Engine Worker içindeki `NerPort` istemcisi bu port üzerinden konuşur. NER Worker hiçbir kasa verisi görmez; yalnız metin parçası alır, etiketli aralık döndürür.

```ts
// İletiler (packages/core-engine/src/ner/client.ts <-> ner.worker.ts)
type ToNer =
  | { t: 'load' }
  | { t: 'detect'; id: number; docId: string; text: string }
  | { t: 'abort'; id: number }
  | { t: 'dispose' };
type FromNer =
  | { t: 'status'; status: NerStatus }
  | { t: 'chunk'; id: number; done: number; total: number; spans: Array<{ start: number; end: number; label: 'PER' | 'ORG' | 'LOC'; score: number }> }
  | { t: 'done'; id: number }
  | { t: 'error'; id: number; code: 'E_NER_UNAVAILABLE' };
```

```ts
// TASLAK (kurulu Transformers.js sürümüne göre AGENT-2 doğrular) -> packages/core-engine/src/ner/ner.worker.ts
import { env, AutoTokenizer, AutoModelForTokenClassification } from '@huggingface/transformers';
import { MODEL } from './modelConfig';

env.allowRemoteModels = false;                                           // Hugging Face Hub'a ASLA gitme
env.allowLocalModels = true;
env.localModelPath = new URL('/models/', self.location.origin).href;     // aynı köken
env.backends.onnx.wasm.wasmPaths = new URL('/ort/', self.location.origin).href;   // CDN değil
env.backends.onnx.wasm.proxy = false;
env.backends.onnx.wasm.numThreads = self.crossOriginIsolated
  ? Math.max(1, Math.min(4, (navigator.hardwareConcurrency ?? 2) - 1))  // COOP/COEP varsa çok iş parçacığı
  : 1;
// Arka uç: varsayılan 'wasm'. 'webgpu' yalnız navigator.gpu varsa ve golden set sonuçları wasm ile aynıysa.
const tokenizer = await AutoTokenizer.from_pretrained(MODEL.id);
const model = await AutoModelForTokenClassification.from_pretrained(MODEL.id, { dtype: 'q8', device: 'wasm', progress_callback });
```

Model dosyaları web'de `/models/<model-id>/` altında (`config.json`, `tokenizer.json`, `tokenizer_config.json`, `onnx/model_quantized.onnx`), masaüstünde uygulama paketinin içinde aynı yoldadır. Uygulama çalışma zamanında modeli başka hiçbir yerden indirmez; `scripts/fetch-model.mjs` yalnız geliştirici makinesinde ve CI'da çalışır.

#### 3.3.3 Ön belirteçleme, pencereleme ve BIO birleştirme

Karakter ofsetlerini kaybetmemek için kütüphanenin ofset desteğine güvenilmez; ofsetler kelime düzeyinde bizde tutulur:

1. **Ön belirteçleme** (BERT BasicTokenizer ile uyumlu): `/[\p{L}\p{M}\p{N}]+|[^\s\p{L}\p{M}\p{N}]/gu`. Her eşleşme bir "kelime"dir ve `[start, end)` ofsetini taşır. Kesme işareti ve noktalama ayrı kelimedir.
2. **Alt belirteç sayımı:** Her kelime `tokenizer.encode(word, { add_special_tokens: false })` ile ayrı ayrı belirteçlenir. WordPiece, BasicTokenizer bölmesinden sonra çalıştığı için bu, metnin tamamını belirteçlemeyle aynı sonucu verir. Sonuç önbelleğe alınır (aynı kelime tekrar belirteçlenmez).
3. **Pencereler:** Kelimeler sırayla en çok 510 alt belirteçlik pencerelere doldurulur; ardışık pencereler 128 alt belirteç örtüşür. Pencere sınırı mümkünse paragraf sonuna çekilir.
4. **Etiket:** Her kelimenin etiketi ilk alt belirtecinin etiketidir. Örtüşen bölgede kelime için, pencerenin kenarına en uzak olduğu penceredeki tahmin kullanılır. Skor, softmax olasılığıdır.
5. **BIO birleştirme:** `B-X` yeni varlık başlatır. `I-X`, önceki kelime aynı türdeyse ve araya satır sonu girmiyorsa devam ettirir; değilse `B-X` gibi davranır. Varlık skoru kelime skorlarının ortalamasıdır.
6. **Temizlik:** Baştaki ve sondaki noktalama atılır. Varlık içinde kesme işareti + küçük harf dizisi varsa (`Yılmaz ' ın`), varlık kesme işaretinden önce biter ve ek kanıt olarak kaydedilir. Unvan sözcükleri (`Av.`, `Dr.`, `Sayın`) aralıktan çıkarılır.
7. **Etiket eşleme:** `PER` → `KISI`. `ORG` → son sözcük kamu kurumu başıysa (`Bakanlığı`, `Belediyesi`, `Müdürlüğü`, `Başkanlığı`, `Valiliği`, `Kaymakamlığı`, `Kurumu`, `Hazinesi`, `Rektörlüğü`) `KURUM`; mahkeme başıysa (`Mahkemesi`, `Dairesi`, `Başsavcılığı`, `Hakimliği`) atılır; diğerleri `SIRKET`. `LOC` → bulgu üretmez (3.0.2 madde 4).
8. **Güven:** skor 0,90 ve üstü YÜKSEK, 0,70-0,90 ORTA, altı DÜŞÜK. Cümle başındaki tek sözcüklü `PER` bulgusu, sözlükte yoksa bir kademe düşürülür.

#### 3.3.4 Kural tabanlı ad ve şirket dedektörü (AGENT-2, `NameRuleDetectorPort`)

Model yüklenmeden de kişi ve şirketlerin büyük kısmını bulur; NER'in yedeğidir.

```
AD_BELİRTECİ   := \p{Lu}\p{Ll}+ | \p{Lu}{2,}            (Türkçe harfler dahil)
AD_DİZİSİ      := AD_BELİRTECİ ( \s+ AD_BELİRTECİ ){1,3}
ROL_İPUCU      := ROLE_CUES (contracts.ts), lowerView üzerinde, sözcük sınırlı
ŞİRKET_TÜRÜ    := A.Ş. | AŞ | Anonim Şirketi | Ltd. Şti. | Limited Şirketi | Şti. | Koll. Şti. | Kollektif Şirketi
                  | Kom. Şti. | Komandit Şirketi | Kooperatifi | Koop. | Holding | Vakfı | Derneği | Adi Ortaklığı
SEKTÖR_KISALT  := San. | Tic. | İnş. | Paz. | İth. | İhr. | Taah. | Turz. | Ltd. | ve | &

K1 (rol ipucu):    ROL_İPUCU  [:]?  (Av.|Dr.)?  AD_DİZİSİ          -> KISI, roleHint, YÜKSEK
                   Ad dizisinin ardından ŞİRKET_TÜRÜ geliyorsa       -> SIRKET
K2 (unvan önde):   (Sayın|Sn.|Bay|Bayan)  AD_BELİRTECİ{1,3}        -> KISI, honorificBefore, ORTA
K3 (unvan arkada): AD_BELİRTECİ{1,3}  (Bey|Hanım|Beyefendi|Hanımefendi)  -> KISI, honorificAfter, ORTA
K4 (sözlük):       sözlükteki ad + 1-2 AD_BELİRTECİ (cümle başı değilse ya da ardından büyük harfli sözcük geliyorsa)  -> KISI, ORTA
K5 (baş harf):     \p{Lu}\. \s? \p{Lu}\p{Ll}+   ("A. Yılmaz")      -> KISI, form INITIAL_SURNAME, ORTA
K6 (şirket):       ( \p{Lu}[\p{L}\p{N}&.-]* | SEKTÖR_KISALT ){1,10}  ŞİRKET_TÜRÜ   -> SIRKET, YÜKSEK
                   Sola genişleme rol sözcüğünde, küçük harfli sözcükte (ve hariç), ":" "," ";" "(" işaretlerinde durur.
K7 (kurum):        AD_BELİRTECİ{1,5} + kamu kurumu başı                -> KURUM, YÜKSEK (varsayılan maskelenmez)
K8 (kesme kanıtı): Cümle ortasında büyük harfli sözcük + kesme + ek; sözcük soyadı sözlüğündeyse  -> KISI, DÜŞÜK

Dışlamalar: mahkeme ve daire adları, 81 il ve ilçe adları, ay ve gün adları, kanun adları ("Türk Borçlar Kanunu"),
"Türkiye Cumhuriyeti", "T.C.", başlık sözcükleri ("DAVACI", "DAVALI", "KONU", "AÇIKLAMALAR", "SONUÇ VE İSTEM").
Büyük harfli başlık satırında (dilekçe başı) "DAVACI : AHMET YILMAZ" kalıbı K1 ile yakalanır; rol sözcüğü büyük harfli de olsa lowerView ile eşleşir.
```

#### 3.3.5 Varlık tekilleştirme (coreference)

**Amaç:** `Davacı Ahmet Yılmaz`, `Ahmet Bey`, `Sayın Yılmaz`, `Sn. Yılmaz`, `A. Yılmaz`, `AHMET YILMAZ` aynı varlığa (`[DAVACI_1]`) bağlanır. Aynı soyadlı birden çok kişi varsa tek başına soyadı tahminle bağlanmaz.

**Algoritma:**

1. **Ayrıştırma.** Her kişi anması unvan ve ek dışında `FULL` (en az iki sözcük), `INITIAL_SURNAME` (`A. Yılmaz`), `GIVEN_ONLY` ya da `SURNAME_ONLY` biçimine ayrılır. Tek sözcükte: önünde `Sayın`/`Sn.` varsa soyadı; sözlükte ad olarak geçiyorsa ad; değilse soyadı. Çok sözcüklü adda baştan sözlükteki adlar ad, kalanı soyadıdır (`Ayşe Nur Kaya` → ad [Ayşe, Nur], soyadı [Kaya]; `Ayşe Kaya Yılmaz` → ad [Ayşe], soyadları [Kaya, Yılmaz]).
2. **Tohumlar.** Tam adlar belge sırasıyla kümelere girer. Birincil soyadı (son soyadı) aynı ve ad listelerinden biri diğerinin alt kümesiyse aynı kümedir (`Ayşe Nur Kaya` ~ `Ayşe Kaya`, `Ayşe Kaya Yılmaz` ~ `Ayşe Yılmaz`). Karşılaştırma `foldKey` ile yapılır (`AHMET YILMAZ` = `Ahmet Yılmaz`).
3. **Kısmi anmalar** belge sırasıyla:
   - `INITIAL_SURNAME`: soyadı tutan ve adı o harfle başlayan kümeler. Tek aday → bağla. Birden çok (`A.` hem Ahmet hem Ayşe) → grup etiketi.
   - `SURNAME_ONLY`: soyadı tutan kümeler. Hiç yoksa ad olarak dene (`Yılmaz Bey` adı Yılmaz olan biri de olabilir), o da yoksa yeni küme. Tek aday → bağla (YÜKSEK). Birden çok aday → önce rol ipucu (`davalı Yılmaz`), sonra cinsiyet ipucu (`Yılmaz Hanım`, `Bay Yılmaz`) tek adaya indiriyorsa bağla (ORTA); indirmiyorsa **grup etiketi** `[SOYAD_n]`. Soyadında yakınlık (aynı paragraf) KULLANILMAZ.
   - `GIVEN_ONLY`: adı tutan kümeler. Birden çok aday → rol, cinsiyet, sonra aynı paragrafta tam adı geçen tek aday kuralı; hâlâ çoksa `[AD_n]`.
4. **Rol:** Kümenin anmalarındaki `roleHint` oylarının çoğunluğu; eşitlikte ilk anma. Hiç yoksa `BELIRSIZ` (`[KİŞİ_n]`).
5. **Cinsiyet:** Ad sözlüğünden; yoksa `Bey`/`Hanım` ipucundan; yoksa `U`.
6. **Grup etiketi** (`GroupToken`): değeri ortak soyadıdır (`Yılmaz`). Maskeli metinde `Sayın [SOYAD_1]` olur; LLM yanıtında `[SOYAD_1]'e` → `Yılmaz'a` döner (kayıpsız). Arayüz her grup anmasını inceleme kuyruğuna koyar; kullanıcı `RESOLVE_GROUP` ile doğru kişiye bağlarsa anma kişinin etiketini alır.

**Başvuru uygulaması (test edildi: Ek C t6; boşanma, miras, evlilik soyadı senaryoları):**

```ts
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
```

**Şirket ve kurum kanonikleştirme (`coref/orgs.ts`, AGENT-2 yazar):**

```
canonOrg(s):
  1. lowerView; kısaltmaları aç: san.->sanayi, tic.->ticaret, inş.->inşaat, paz.->pazarlama, ith.->ithalat,
     ihr.->ihracat, ltd.->limited, şti.->şirketi, a.ş.->anonim şirketi, koop.->kooperatifi
  2. noktalama ve "ve", "&" at; boşlukları teke indir
  3. çekirdek = ilk sektör veya tür sözcüğünden ÖNCEKİ sözcükler
     ("abc yapı sanayi ve ticaret anonim şirketi" -> çekirdek "abc")
     sektör sözcükleri org-terms.json'dadır: yapı, inşaat, sanayi, ticaret, gıda, tekstil, lojistik, otomotiv,
     turizm, enerji, sağlık, yazılım, danışmanlık, emlak, madencilik, tarım, nakliyat, eğitim, medya, finans
  4. anahtar = foldKey(çekirdek)
Bağlama: anahtarlar eşitse ya da biri diğerinin sözcük önekiyse (en az 1 ayırt edici sözcük) aynı küme.
"şirket", "davalı şirket", "müvekkil şirket" gibi cins adlar varlık değildir, maskelenmez.
```

---

### 3.4 Katman 4: Türkçe çekim eki ve ses uyumu motoru

#### 3.4.1 Sorun ve çözüm

LLM, etiketi bir kelime gibi okuyup ek getirir: `[DAVACI_1]'in` ("bir" okunuşu: ince ünlü, ünsüzle biter) ya da `[DAVACI_1]'nın` ("davacı" okunuşu). Etiket yerine `Ayşe Kaya` konduğunda ek `Kaya`ya göre yeniden çekilmelidir: `Ayşe Kaya'nın`. Motor üç adımda çalışır:

1. **Ayrıştır:** LLM'in yazdığı eki biçimbirimlere ayır (`in` → [İLGİ], `lerinden` → [ÇOĞUL, İYELİK, AYRILMA]). Ayrıştırıcı, her biçimbirimin tüm olası yüzeylerini (tüm ünlü uyumu ve ünsüz bağlamlarının birleşimi) bilir; böylece LLM hangi okunuşu varsaymış olursa olsun ek tanınır.
2. **Profil çıkar:** Özgün varlığın ek davranışını belirleyen üçlü: (a) son ünlünün 4'lü uyum sınıfı (a/ı → ı, o/u → u, e/i → i, ö/ü → ü), (b) son ses (ünlü / yumuşak ünsüz / sert ünsüz f s t k ç ş h p), (c) 3. tekil iyelikle bitip bitmediği (Şirketi, Bakanlığı: durum ekleri `n` kaynaştırmalı).
3. **Yeniden üret:** Biçimbirimleri arşifonem kalıplarından (`(n)In`, `(y)A`, `DA`, `DAn`, `CA` ...) profile göre tek tek döker; her harften sonra durum (son ünlü, son ses) güncellenir, böylece ek zincirleri de doğru çıkar (`Yılmaz'ların`, `Kaya'nınki`).

**Ses profili kuralları (sırayla):**

| Sıra | Yüzeyin son sözcüğü | Okunuş | Örnek |
|---|---|---|---|
| 1 | Rakamla biter | Sayının Türkçe okunuşunun son sözcüğü | `2024/892` → "iki" → `'de`; `06 ABC 123` → "üç" → `'te`; `...01` → "bir" → `'in` |
| 2 | Açılımı olan kısaltma | Açılımı | `Şti.` → "şirketi" (n kaynaştırmalı) → `'ne`, `'nde`; `Mah.` → "mahallesi" |
| 3 | Noktalı harf kısaltması | Son harfin adı | `A.Ş.` → "şe" → `'nin`, `'ye` |
| 4 | Büyük harfli, en çok 4 harf, okunamaz | Son harfin adı (TDK: K = "ke") | `THY` → `'nin`; `SGK` → `'ye`; `ABD` → `'ye` |
| 4b | Büyük harfli ama okunabilir | Kelime gibi | `ODTÜ` → `'nün`; `TÜİK` → `'in`; `ASELSAN` → `'ın`; `AHMET YILMAZ` → `'ın` |
| 5 | Okunuş sözlüğünde | Sözlükteki okunuş | `George` → "corc" → `'un` |
| 6 | Olağan sözcük | Yazılış; damak `l`'si istisnaları ince ek alır | `Kemal` → `'in`; `Sunal` → `'ın` |
| 7 | Yabancı görünüm (`q w x`, `th`, `ch`, `sh`, `ph`, `ou`, `ae`, `ee`, `oo`, sonda `y`) | Yazılış, güven DÜŞÜK, inceleme | `Sheldon` |

**Kaynak belgeden kanıt (`refineWithEvidence`):** Kaynak metinde varlığın ardından görülen ekler (`Yılmaz'ın`, `A.Ş.'ne`, `Michel'ın`) olası 24 profil (4 uyum × 3 son ses × n var/yok) içinde hangilerinin bu ekleri ürettiğini belirler. Hesaplanan profil tutarlıysa korunur; değilse kanıtla tutarlı ve hesaplanana en yakın profil seçilir. Böylece avukatın kendi yazım tercihi (`A.Ş.'ne` gibi) ve yabancı adların okunuşu kendiliğinden öğrenilir.

#### 3.4.2 Dönüşüm matrisi (motorun kendisiyle üretildi)

Satırlar biçimbirimler, sütunlar temsilî gövdelerdir. Hücre, o gövdeye gelen ektir. Tablo belge derlenirken `realize()` çalıştırılarak üretilmiştir; elle yazılmamıştır.

| Biçimbirim | Kaya (ı, ünlü) | Yılmaz (ı, yumuşak) | Toprak (ı, sert) | Mutlu (u, ünlü) | Onur (u, yumuşak) | Bulut (u, sert) | Ayşe (i, ünlü) | Emir (i, yumuşak) | Ahmet (i, sert) | Öykü (ü, ünlü) | Gönül (ü, yumuşak) | Öztürk (ü, sert) | Ltd. Şti. (i, n) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| İLGİ | 'nın | 'ın | 'ın | 'nun | 'un | 'un | 'nin | 'in | 'in | 'nün | 'ün | 'ün | 'nin |
| BELİRTME | 'yı | 'ı | 'ı | 'yu | 'u | 'u | 'yi | 'i | 'i | 'yü | 'ü | 'ü | 'ni |
| YÖNELME | 'ya | 'a | 'a | 'ya | 'a | 'a | 'ye | 'e | 'e | 'ye | 'e | 'e | 'ne |
| BULUNMA | 'da | 'da | 'ta | 'da | 'da | 'ta | 'de | 'de | 'te | 'de | 'de | 'te | 'nde |
| AYRILMA | 'dan | 'dan | 'tan | 'dan | 'dan | 'tan | 'den | 'den | 'ten | 'den | 'den | 'ten | 'nden |
| VASITA | 'yla | 'la | 'la | 'yla | 'la | 'la | 'yle | 'le | 'le | 'yle | 'le | 'le | 'yle |
| EŞİTLİK | 'ca | 'ca | 'ça | 'ca | 'ca | 'ça | 'ce | 'ce | 'çe | 'ce | 'ce | 'çe | 'nce |
| ÇOĞUL | 'lar | 'lar | 'lar | 'lar | 'lar | 'lar | 'ler | 'ler | 'ler | 'ler | 'ler | 'ler | - |
| ÇOĞUL + İLGİ | 'ların | 'ların | 'ların | 'ların | 'ların | 'ların | 'lerin | 'lerin | 'lerin | 'lerin | 'lerin | 'lerin | - |
| İYELİK | 'sı | 'ı | 'ı | 'su | 'u | 'u | 'si | 'i | 'i | 'sü | 'ü | 'ü | - |
| İLGİ + KI | 'nınki | 'ınki | 'ınki | 'nunki | 'unki | 'unki | 'ninki | 'inki | 'inki | 'nünki | 'ünki | 'ünki | 'ninki |
| BULUNMA + KI | 'daki | 'daki | 'taki | 'daki | 'daki | 'taki | 'deki | 'deki | 'teki | 'deki | 'deki | 'teki | 'ndeki |
| DIR | 'dır | 'dır | 'tır | 'dur | 'dur | 'tur | 'dir | 'dir | 'tir | 'dür | 'dür | 'tür | 'dir |
| DI | 'ydı | 'dı | 'tı | 'ydu | 'du | 'tu | 'ydi | 'di | 'ti | 'ydü | 'dü | 'tü | 'ydi |
| MIŞ | 'ymış | 'mış | 'mış | 'ymuş | 'muş | 'muş | 'ymiş | 'miş | 'miş | 'ymüş | 'müş | 'müş | 'ymiş |
| SA | 'ysa | 'sa | 'sa | 'ysa | 'sa | 'sa | 'yse | 'se | 'se | 'yse | 'se | 'se | 'yse |
| KEN | 'yken | 'ken | 'ken | 'yken | 'ken | 'ken | 'yken | 'ken | 'ken | 'yken | 'ken | 'ken | 'yken |
| LI | 'lı | 'lı | 'lı | 'lu | 'lu | 'lu | 'li | 'li | 'li | 'lü | 'lü | 'lü | - |
| SIZ | 'sız | 'sız | 'sız | 'suz | 'suz | 'suz | 'siz | 'siz | 'siz | 'süz | 'süz | 'süz | - |

Kısaltmalar: İLGİ (GEN, -ın), BELİRTME (ACC, -ı), YÖNELME (DAT, -a), BULUNMA (LOC, -da), AYRILMA (ABL, -dan), VASITA (INS, -la), EŞİTLİK (EQU, -ca), ÇOĞUL (PL), İYELİK (POSS, 3. tekil), KI (-ki), Ek-fiil: DIR (-dır), DI (-dı), MIŞ (-mış), SA (-sa), KEN (-ken); türetme: LI (-lı), SIZ (-sız).

#### 3.4.3 Biçimbirim motoru (AGENT-2, başvuru uygulaması, test edildi: Ek C t2, 242 vakalık idempotans dahil)

```ts
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
  let last = parts[parts.length - 1]!.replace(/["“”)\],;:]+$/u, '');
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
```

#### 3.4.4 Geri çözme (un-masking) algoritması

**Girdi:** LLM yanıtı ve kasa izdüşümü (`toUnmaskView`). **Çıktı:** `UnmaskResult`.

1. **Aday toplama** (öncelik sırasıyla; örtüşen sonraki aday atlanır):
   1. İkiz işaretli: `《...》` içi tam ad, yalnız ad ya da soyadı.
   2. Köşeli etiket: `[...]`. İçerik `tokenKey` ile katlanır; Markdown kaçışları (`\[`, `\_`), büyük/küçük harf farkı (`[Davacı_1]`), boşluk (`[DAVACI 1]`) ve İ/I karışıklığı (`[ŞIRKET_A]`) tolere edilir. Kasada olmayan ama bilinen bir gövde taşıyan etiket (`[DAVACI_3]`) `UNKNOWN_TOKEN` sorunudur. Bilinen gövde taşımayan köşeli parantez (`[bkz. ek 1]`) sıradan metindir, dokunulmaz.
   3. Çıplak etiket: köşeli işaretleri düşmüş `DAVACI_1` (Türkçe metinde alt çizgi doğal olmadığı için güvenlidir; yalnız kasadaki anahtarlar kabul edilir).
   4. İşaretsiz ikiz: LLM `《》` işaretlerini düşürdüyse ikiz tam adı, sonra ikiz adı ve ikiz soyadı sözcük sınırlı aranır. Aynı ikiz soyadını paylaşan aile üyelerinde yalnız soyadı geçişi grup değerine (ortak gerçek soyadına) döner.
   5. Tutar (yalnız `SCALE` kipinde): kasadaki ölçekli değerle birebir eşleşen tutar geri alınır; diğerine öneri.
2. **Ek yakalama:** Adayın hemen ardından `'`, `’`, `` ` `` ya da `´` ve harfler geliyorsa ek odur. Kesme işareti yoksa harfler yalnız biçimbirim olarak ayrıştırılabiliyorsa ek sayılır (`[DAVACI_1]ın`). Çıktıda LLM'in kullandığı kesme işareti korunur.
3. **Değer:** Varlığın `canonical` biçimi; yalnız ad anması (ikiz adı) için `givenCanonical`. Satır (etiketler dışında) tamamen büyük harfse değer de Türkçe büyük harfe çevrilir (`DAVACI : AYŞE KAYA`).
4. **Ek düzeltme:** `rehydrateSuffix(ek, varlık.phon)`; büyük harfli ek büyük harfli döner.
5. **Sorunlar:** `UNKNOWN_TOKEN`, `SUFFIX_UNPARSED` (ek ayrıştırılamadı, olduğu gibi bırakıldı), `LOW_PHON_CONFIDENCE` (yabancı ad), `GROUP_TOKEN` (grup değeri birden çok kişiyi gösterebilir), `AMOUNT_DERIVED` (öneri), `LEFTOVER_MARKER` (çözülmemiş `[GÖVDE_n]` ya da `《`).
6. **Değişmez:** Her değişikliğin `outSpan`'ı çıktı metninde tam olarak `restored` dizgesini gösterir (Ek C t7 bunu tüm değişiklikler için doğrular).

```ts
// packages/core-engine/src/unmask/rehydrate.ts
// Geri çözme: LLM yanıtındaki etiketleri ve ikiz adları bulur, özgün değerle değiştirir ve ekleri özgün
// varlığın ses profiline göre yeniden çeker. Kasanın tamamını değil, yalnız gerekli izdüşümü (UnmaskView) okur.

import { foldKey, trUpper, isLetter, isUppercaseContext } from '../text/turkish';
import { rehydrateSuffix, parseSuffix } from '../morphology/morphology';
import { findAmounts, formatTrNumber } from '../fuzz/amount';
import {
  tokenKey, CATEGORY_SPECS, ROLE_TOKEN_LABELS,
  type AmountStyle, type Confidence, type EntityId, type GroupId, type MaskingSessionVault, type PhonProfile, type TokenVariant,
  type UnmaskIssue, type UnmaskReplacement, type UnmaskResult,
} from '../types/contracts';

export interface UnmaskEntity {
  readonly id: EntityId;
  readonly tokens: readonly string[];
  readonly canonical: string;
  readonly phon: PhonProfile;
  readonly givenCanonical?: string;
  readonly phonGiven?: PhonProfile;
  readonly twin?: { readonly full: string; readonly given?: string; readonly surname?: string };
}
export interface UnmaskGroup { readonly id: GroupId; readonly token: string; readonly value: string; readonly phon: PhonProfile; readonly twinValue?: string }
export interface UnmaskView {
  readonly entities: readonly UnmaskEntity[];
  readonly groups: readonly UnmaskGroup[];
  readonly amounts?: { readonly k: number; readonly pairs: ReadonlyArray<{ readonly fuzzed: string; readonly original: string }> };
}

/** Kasadan geri çözme izdüşümü. Yalnız MASK durumundaki varlıklar ve verilmiş etiketler dahil edilir. */
export function toUnmaskView(v: MaskingSessionVault): UnmaskView {
  const entities: UnmaskEntity[] = [];
  for (const e of v.entities.values()) {
    if (e.status !== 'MASK' && e.issuedTokens.length === 0) continue;
    entities.push({
      id: e.id, tokens: [...new Set([e.token, ...e.issuedTokens])], canonical: e.canonical, phon: e.phon,
      ...(e.givenCanonical !== undefined ? { givenCanonical: e.givenCanonical } : {}),
      ...(e.phonGiven !== undefined ? { phonGiven: e.phonGiven } : {}),
      ...(e.twin !== undefined ? { twin: { full: e.twin.full, ...(e.twin.given ? { given: e.twin.given } : {}), ...(e.twin.surname ? { surname: e.twin.surname } : {}) } } : {}),
    });
  }
  const groups: UnmaskGroup[] = [...v.groups.values()].map((g) => ({
    id: g.id, token: g.token, value: g.value, phon: g.phon, ...(g.twinValue !== undefined ? { twinValue: g.twinValue } : {}),
  }));
  return v.amountScale ? { entities, groups, amounts: { k: v.amountScale.k, pairs: v.amountScale.pairs } } : { entities, groups };
}

type Target =
  | { kind: 'E'; e: UnmaskEntity; part: 'FULL' | 'GIVEN' }
  | { kind: 'G'; g: UnmaskGroup }
  | { kind: 'A'; value: number; style: AmountStyle }
  | null;
interface Hit { start: number; end: number; matched: string; variant: TokenVariant; target: Target }

const BRACKET_RE = /\\?\[\s*([\p{L}\p{N}_ .\\-]{2,48}?)\s*\\?\]/gu;   // [DAVACI_1], [Davacı 1], \[DAVACI\_1\]
const BARE_RE = /\p{L}+(?:\\?_[\p{L}\p{N}]+)+/gu;                      // DAVACI_1 (köşeli işaret düşmüş)
const TWIN_RE = /《\s*([^》\n]{1,80}?)\s*》/gu;                          // 《Kaan Korkmaz》
const LEFTOVER_RE = /\[[A-ZÇĞİÖŞÜ]+(?:_[A-ZÇĞİÖŞÜ0-9]+)+\]|《|》/gu;
/** Bilinen etiket gövdeleri (katlanmış). Kasada olmayan ama bu gövdeyi taşıyan etiket = LLM'in uydurduğu etiket. */
const KNOWN_LABELS: ReadonlySet<string> = new Set(
  [...Object.values(CATEGORY_SPECS).map((c) => c.tokenLabel), ...Object.values(ROLE_TOKEN_LABELS), 'SOYAD', 'AD'].map((l) => tokenKey(l)));
const looksLikeOurToken = (key: string): boolean => {
  const m = key.match(/^(.+)_([0-9]+|[A-Z]{1,2})$/);
  return !!m && KNOWN_LABELS.has(m[1]!);
};

export function unmask(input: string, view: UnmaskView): UnmaskResult {
  const text = input.replace(/\r\n?/g, '\n');
  const byToken = new Map<string, UnmaskEntity>();
  for (const e of view.entities) for (const t of e.tokens) byToken.set(tokenKey(t), e);
  const byGroup = new Map(view.groups.map((g) => [tokenKey(g.token), g] as const));
  const twinFull = new Map<string, UnmaskEntity>(), twinGiven = new Map<string, UnmaskEntity>();
  const twinSurname = new Map<string, UnmaskGroup | UnmaskEntity>();
  for (const e of view.entities) if (e.twin) {
    twinFull.set(foldKey(e.twin.full), e);
    if (e.twin.given) twinGiven.set(foldKey(e.twin.given), e);
  }
  for (const e of view.entities) if (e.twin?.surname) {
    const k = foldKey(e.twin.surname);
    const shared = view.groups.find((g) => g.twinValue !== undefined && foldKey(g.twinValue) === k);
    twinSurname.set(k, shared ?? e);   // aynı ikiz soyadını paylaşan aile → grup (özgün ortak soyadı)
  }
  const fromKey = (k: string): Target => {
    const e = byToken.get(k); if (e) return { kind: 'E', e, part: 'FULL' };
    const g = byGroup.get(k); if (g) return { kind: 'G', g };
    return null;
  };
  const fromSurname = (k: string): Target => {
    const s = twinSurname.get(k);
    if (!s) return null;
    return 'token' in s ? { kind: 'G', g: s } : { kind: 'E', e: s, part: 'FULL' };
  };

  // 1) Adayları topla (öncelik: ikiz işaretli > köşeli etiket > çıplak etiket > işaretsiz ikiz)
  const hits: Hit[] = [];
  const free = (s: number, e: number): boolean => !hits.some((h) => s < h.end && h.start < e);
  for (const m of text.matchAll(TWIN_RE)) {
    const k = foldKey(m[1]!);
    const e = twinFull.get(k) ?? twinGiven.get(k);
    const target: Target = e ? { kind: 'E', e, part: twinFull.has(k) ? 'FULL' : 'GIVEN' } : fromSurname(k);
    hits.push({ start: m.index!, end: m.index! + m[0].length, matched: m[0], variant: 'TWIN', target });
  }
  for (const m of text.matchAll(BRACKET_RE)) {
    const s = m.index!, e = s + m[0].length;
    if (!free(s, e)) continue;
    const key = tokenKey(m[1]!);
    const known = byToken.has(key) || byGroup.has(key);
    if (!known && !looksLikeOurToken(key)) continue;   // sıradan köşeli parantez ("[bkz. ek 1]") dokunulmaz
    const exact = known && (byToken.get(key)?.tokens.includes(m[0]) || byGroup.get(key)?.token === m[0]);
    hits.push({ start: s, end: e, matched: m[0], variant: exact ? 'EXACT' : 'NORMALIZED', target: fromKey(key) });
  }
  for (const m of text.matchAll(BARE_RE)) {
    const s = m.index!, e = s + m[0].length;
    const key = tokenKey(m[0]);
    if (!free(s, e) || (!byToken.has(key) && !byGroup.has(key))) continue;
    hits.push({ start: s, end: e, matched: m[0], variant: 'BARE', target: fromKey(key) });
  }
  const wordAt = (s: number, e: number): boolean => !isLetter(text[s - 1]) && !isLetter(text[e]);
  const scanPlain = (needle: string, variant: TokenVariant, target: Target): void => {
    for (let i = text.indexOf(needle); needle && i >= 0; i = text.indexOf(needle, i + 1)) {
      const e = i + needle.length;
      if (wordAt(i, e) && free(i, e)) hits.push({ start: i, end: e, matched: needle, variant, target });
    }
  };
  for (const e of view.entities) if (e.twin) scanPlain(e.twin.full, 'TWIN_BARE', { kind: 'E', e, part: 'FULL' });
  for (const e of view.entities) if (e.twin?.given) scanPlain(e.twin.given, 'TWIN_PART', { kind: 'E', e, part: 'GIVEN' });
  for (const e of view.entities) if (e.twin?.surname) scanPlain(e.twin.surname, 'TWIN_PART', fromSurname(foldKey(e.twin.surname)));
  if (view.amounts) for (const a of findAmounts(text)) {
    if (free(a.span.start, a.span.end))
      hits.push({ start: a.span.start, end: a.span.end, matched: text.slice(a.span.start, a.span.end), variant: 'EXACT', target: { kind: 'A', value: a.value, style: a.style } });
  }
  hits.sort((a, b) => a.start - b.start);
  const pairs = new Map((view.amounts?.pairs ?? []).map((p) => [p.fuzzed, p.original] as const));

  // 2) Çıktıyı kur
  let out = '', cursor = 0, twins = 0, unknown = 0, corrections = 0, amountSuggestions = 0, amountHits = 0;
  const replacements: UnmaskReplacement[] = [], issues: UnmaskIssue[] = [];
  for (const h of hits) {
    out += text.slice(cursor, h.start);
    if (h.target?.kind === 'A') {   // Tutar: birebir eşleşen ölçekli değer geri alınır, diğerine yalnız öneri
      amountHits++;
      const orig = pairs.get(h.matched);
      const outStart = out.length;
      out += orig ?? h.matched;
      if (orig === undefined) {
        amountSuggestions++;
        issues.push({ kind: 'AMOUNT_DERIVED', outSpan: { start: outStart, end: out.length },
          message: 'Bu tutar ölçeklenmiş değerlerden türetilmiş olabilir.', suggestion: formatTrNumber(h.target.value / view.amounts!.k, h.target.style) });
      }
      cursor = h.end; continue;
    }
    let suffixIn: string | undefined, apo = "'", end = h.end;
    const after = text.slice(h.end).match(/^(['’`´]?)(\p{L}+)/u);
    if (after && (after[1] || parseSuffix(after[2]!))) { suffixIn = after[2]!; apo = after[1] || "'"; end = h.end + after[0].length; }
    const outStart = out.length;
    if (h.variant.startsWith('TWIN')) twins++;
    if (!h.target) {
      unknown++;
      out += text.slice(h.start, end);
      issues.push({ kind: 'UNKNOWN_TOKEN', outSpan: { start: outStart, end: out.length }, message: `Kasada karşılığı olmayan etiket: ${h.matched}` });
      replacements.push({ inSpan: { start: h.start, end }, outSpan: { start: outStart, end: out.length }, entityId: null,
        matched: h.matched, restored: text.slice(h.start, end), suffixCorrected: false, variant: h.variant, confidence: 'LOW' });
      cursor = end; continue;
    }
    let base: string, phon: PhonProfile;
    if (h.target.kind === 'E') {
      const useGiven = h.target.part === 'GIVEN' && h.target.e.givenCanonical !== undefined;
      base = useGiven ? h.target.e.givenCanonical! : h.target.e.canonical;
      phon = useGiven && h.target.e.phonGiven ? h.target.e.phonGiven : h.target.e.phon;
    } else {
      base = h.target.g.value; phon = h.target.g.phon;
    }
    const ls = text.lastIndexOf('\n', h.start) + 1, le = text.indexOf('\n', h.end);
    if (isUppercaseContext(text.slice(ls, le < 0 ? text.length : le))) base = trUpper(base);
    let suffixOut: string | undefined, corrected = false, conf: Confidence = h.variant === 'TWIN_PART' ? 'MEDIUM' : 'HIGH';
    if (suffixIn !== undefined) {
      const r = rehydrateSuffix(suffixIn, phon);
      suffixOut = r.suffixOut; corrected = r.changed; if (corrected) corrections++;
      const span = { start: outStart, end: outStart + base.length + apo.length + suffixOut.length };
      if (!r.morphemes) { conf = 'LOW'; issues.push({ kind: 'SUFFIX_UNPARSED', outSpan: span, message: `"${suffixIn}" eki çözümlenemedi; elle denetleyin.` }); }
      else if (phon.confidence === 'LOW') { conf = 'LOW'; issues.push({ kind: 'LOW_PHON_CONFIDENCE', outSpan: span, message: 'Ad yabancı kökenli olabilir; ek uyumunu denetleyin.' }); }
    }
    const restored = suffixOut !== undefined ? base + apo + suffixOut : base;
    out += restored;
    const ids = h.target.kind === 'E' ? { entityId: h.target.e.id } : { entityId: null, groupId: h.target.g.id };
    if (h.target.kind === 'G') issues.push({ kind: 'GROUP_TOKEN', outSpan: { start: outStart, end: out.length }, message: `"${base}" birden çok kişiyi gösterebilir; doğru kişiyi seçin.` });
    replacements.push({ inSpan: { start: h.start, end }, outSpan: { start: outStart, end: out.length }, ...ids, matched: h.matched, restored,
      ...(suffixIn !== undefined ? { suffixIn } : {}), ...(suffixOut !== undefined ? { suffixOut } : {}),
      suffixCorrected: corrected, variant: h.variant, confidence: conf });
    cursor = end;
  }
  out += text.slice(cursor);

  for (const m of out.matchAll(LEFTOVER_RE))
    if (!replacements.some((r) => m.index! >= r.outSpan.start && m.index! < r.outSpan.end))
      issues.push({ kind: 'LEFTOVER_MARKER', outSpan: { start: m.index!, end: m.index! + m[0].length }, message: 'Çözülmemiş işaret kaldı.' });
  return {
    text: out, replacements, issues,
    stats: { tokensFound: hits.length - amountHits, tokensResolved: hits.length - amountHits - unknown, twinsFound: twins, suffixCorrections: corrections, unknownTokens: unknown, amountSuggestions },
  };
}
```

**Örnekler (motorun kendisiyle üretildi):**

| LLM yanıtında | Kasadaki değer | Çıktı | Not |
|---|---|---|---|
| `[DAVACI_1]'in talebi` | Ayşe Kaya | `Ayşe Kaya'nın talebi` | ek: in → nın |
| `[VEKİL_1]'e bildirildi` | Ahmet Yılmaz | `Ahmet Yılmaz'a bildirildi` | ek: e → a |
| `[DAVALI_1]'nın beyanı` | Mehmet Öztürk | `Mehmet Öztürk'ün beyanı` | ek: nın → ün |
| `[DAVALI_1]'de kalan` | Mehmet Öztürk | `Mehmet Öztürk'te kalan` | ek: de → te |
| `[ŞİRKET_A]'ya ödeme` | XYZ İnşaat Ltd. Şti. | `XYZ İnşaat Ltd. Şti.'ne ödeme` | ek: ya → ne |
| `[ŞİRKET_A]'dan alınan` | XYZ İnşaat Ltd. Şti. | `XYZ İnşaat Ltd. Şti.'nden alınan` | ek: dan → nden |
| `[ŞİRKET_B]'nın hissesi` | ABC Yapı A.Ş. | `ABC Yapı A.Ş.'nin hissesi` | ek: nın → nin |
| `[KURUM_1]'ca verilen` | Ankara Büyükşehir Belediyesi | `Ankara Büyükşehir Belediyesi'nce verilen` | ek: ca → nce |
| `[TCKN_1]'dir` | 12345678950 | `12345678950'dir` | ek zaten uyumlu |
| `[DOSYA_NO_1]'de görülen` | 2024/892 | `2024/892'de görülen` | ek zaten uyumlu |
| `[PLAKA_1]'nin sürücüsü` | 06 ABC 123 | `06 ABC 123'ün sürücüsü` | ek: nin → ün |
| `[ADRES_1]'de oturan` | Kızılay Mah. ... Çankaya/ANKARA | `Kızılay Mah. Atatürk Bulvarı No:12 Çankaya/ANKARA'da oturan` | ek: de → da |
| `[VEKİL_1]'lerin` | Ahmet Yılmaz | `Ahmet Yılmaz'ların` | ek: lerin → ların |
| `[DAVACI_1]'inki` | Ayşe Kaya | `Ayşe Kaya'nınki` | ek: inki → nınki |
| `[TANIK_1]'nın ifadesi` | Mustafa Kemal | `Mustafa Kemal'in ifadesi` | ek: nın → in |
| `[KİŞİ_1]'e` | George Smith | `George Smith'e` | LOW_PHON_CONFIDENCE |
| `DAVACI [DAVACI_1]'İN VEKİLİ` | Ayşe Kaya | `DAVACI AYŞE KAYA'NIN VEKİLİ` | ek: İN → NIN |
| `《Seda Tuna》'nın` | Ayşe Kaya (ikiz) | `Ayşe Kaya'nın` | ek zaten uyumlu |
| `Seda Hanım` | Ayşe Kaya (ikiz, yalnız ad) | `Ayşe Hanım` | ek zaten uyumlu |
| `Sayın [SOYAD_1]'e` | Yılmaz (grup) | `Sayın Yılmaz'a` | ek: e → a; GROUP_TOKEN |
| `**[Davacı_1]**` | Ayşe Kaya | `**Ayşe Kaya**` | ek zaten uyumlu |
| `\[DAVALI\_1\]'ın` | Mehmet Öztürk | `Mehmet Öztürk'ün` | ek: ın → ün |
| `DAVACI_1'in` | Ayşe Kaya | `Ayşe Kaya'nın` | ek: in → nın |
| `[DAVACI_3]'ün` | (kasada yok) | `[DAVACI_3]'ün` | UNKNOWN_TOKEN |

#### 3.4.5 Fonetik İkiz modu

**Amaç:** LLM'e `[DAVACI_1]` yerine gerçekçi bir ad vermek; LLM doğal Türkçe yazar ve ikize getirdiği ek özgün ada da doğrudan uyar.

**Kurallar:**

1. **Ses anahtarı:** `phonKey(sözcük) = uyum sınıfı | son ses | n kaynaştırması`. İkiz adı özgün adla, ikiz soyadı özgün soyadıyla aynı anahtarı taşımak ZORUNDADIR. (İstekteki "aynı son ünlü ve aynı son harf tipi" koşulu, sert/yumuşak ünsüz ayrımı ve yuvarlaklık eklenerek kesinleştirildi: `-da/-ta` ve `-ın/-un` doğruluğu bunlara bağlıdır.)
2. **Cinsiyet:** İkiz adı özgün adın cinsiyetini taşır (`Bey`/`Hanım` ve zamir tutarlılığı). Cinsiyet bilinmiyorsa (`U`) her iki cinsiyetten seçilebilir.
3. **Aile tutarlılığı:** Aynı gerçek soyadı her zaman aynı ikiz soyadını alır. Miras ve aile hukuku metinlerinde akrabalık ilişkisi LLM'e korunur. Grup etiketinin (`[SOYAD_n]`) ikiz karşılığı da bu ortak ikiz soyadıdır.
4. **Çakışmazlık:** Belgede geçen gerçek ad ve soyadlarının her sözcüğü ikiz adayı olamaz; bir ikiz sözcüğü oturumda yalnız bir kez kullanılır (aile soyadı hariç).
5. **Rastgelelik:** Seçim `RandomSource` ile yapılır; özgün addan türetilmez (sözlük saldırısıyla geri çevrilemesin diye).
6. **Aday yoksa ikiz VERİLMEZ:** Varlık etiket modunda kalır ve arayüz bunu gösterir. Anahtarı tutmayan bir ikiz asla kullanılmaz.
7. **Şirket ikizi:** Yalnız çekirdek ad değiştirilir; sektör sözcükleri ve tür eki korunur (`Yılmazlar Yapı İnşaat Ltd. Şti.` → `《Ardıç Yapı İnşaat Ltd. Şti.》`). Son sözcük değişmediği için ek davranışı kendiliğinden korunur. Çekirdek adaylar `SIRKET_CEKIRDEK` türündeki sözlük kayıtlarıdır.
8. **Biçim:** `《Ad Soyad》`. Maskeli metinde ikize gelen ek, ikizin profiline göre çekilir (zaten özgünle aynıdır).
9. **Sözlük biçimi** (`src/names/data/twin-lexicon.json`): `[{ "text": "Ferit", "kind": "AD", "gender": "E" }, ...]`. Ses anahtarları derleme betiğinde `phonKey` ile önceden hesaplanır. CI, kişi adları için 12 anahtar sınıfının (4 uyum × 3 son ses) her cinsiyetteki aday sayısını raporlar; 5'in altındaki sınıflar uyarıdır (o sınıftaki özgün adlar gerekirse etiket modunda kalır), sıfır aday ise yalnız doğal dilde o sınıfta ad yoksa kabul edilir. Ortak sözcük olan adlar (`Deniz`, `Umut`, `Barış`, `Bahar`) ikiz sözlüğüne alınmaz.

**Başvuru uygulaması (test edildi: Ek C t9; `Ahmet Yılmaz` ve `Ayşe Yılmaz` aynı ikiz soyadını alır):**

```ts
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
```

---

### 3.5 Katman 5: yerel `.udf` (UYAP) ve `.docx` belge motoru

#### 3.5.1 UDF biçimi (gözlenen yapı, D-01)

```
belge.udf (ZIP)
  content.xml               UYAP XML biçimi 1.8: metin + öğeler + stiller
  documentproperties.xml    UYAP üst verisi: doğrulama kodu, seri numarası (VARSA)
  sign.sgn                  PKCS#7 elektronik imza (İMZALIYSA)
```

```xml
<?xml version="1.0" encoding="UTF-8" ?>
<template format_id="1.8">
  <content><![CDATA[Belgenin tüm metni burada; paragraflar \n ile ayrılır]]></content>
  <properties>
    <pageFormat mediaSizeName="1" leftMargin="42.52" rightMargin="28.35" topMargin="14.17" bottomMargin="14.17" paperOrientation="1" />
  </properties>
  <elements resolver="hvl-default">
    <paragraph Alignment="3">
      <content startOffset="0" length="9" family="Times New Roman" size="12" bold="true" />
      <content startOffset="9" length="24" family="Times New Roman" size="12" />
    </paragraph>
    <table tableName="Sabit" columnCount="2" columnSpans="150,150" border="borderCell">
      <row rowName="row1" rowType="dataRow" border="borderCell">
        <cell colspan="1" align="top" fillColor="16777215" border="borderCell" borderSpec="15">
          <paragraph>...</paragraph>
        </cell>
      </row>
    </table>
  </elements>
  <styles>
    <style name="hvl-default" family="Times New Roman" size="12" description="Gövde" />
  </styles>
</template>
```

Öznitelik adları açık kaynak dönüştürücülerden ve gözlemden gelir; tam şema yayımlanmamıştır. Bu yüzden motor **bilinmeyen her öğeyi ve özniteliği bayt bayt korur** ve yalnız iki şeyi değiştirir: CDATA metni ile `startOffset`/`length` değerleri.

#### 3.5.2 Ofset yeniden hesaplama: çapa kuralı

Metinde düzenleme (maskeleme ya da geri çözme) yapıldığında her öğe aralığı yeniden eşlenmelidir; aksi halde UYAP Doküman Editörü dosyayı bozuk açar. Tek bir nokta eşleyici tüm aralıklara uygulanır:

- Düzenlemeler sıralı, çakışmasız, boş olmayan aralıklardır; satır sonu ve yer tutucu (`￼`, `​`) içeremez (bir varlık paragraf sınırını asla aşmaz).
- `D_i` = i'den önceki düzenlemelerin toplam uzunluk farkı. Düzenleme `i`'nin yeni başı `a_i' = a_i + D_i`, yeni sonu `b_i' = a_i' + |yeni metin|`.
- **Nokta eşleme:** `p` bir düzenlemenin İÇİNDEYSE (`a_i < p < b_i`) → `b_i'`; değilse `p + (p'den önce biten düzenlemelerin farkı)`.
- **Çapa kuralı:** Düzenlemenin yeni metnini, düzenlemenin ilk karakterini içeren öğe sahiplenir. Sonuçları:
  - Düzenlemeyi tamamen kapsayan öğe büyür ya da küçülür.
  - Düzenleme içinde başlayan öğe değişen kısmı kaybeder.
  - Tamamen içeride kalan öğenin uzunluğu 0 olur ve silinir (yalnız alt öğesi olmayan öğeler; alt öğeli öğe 0'a düşerse bu bir hatadır).
- Eşleyici monotondur (`p ≤ q` ⇒ `map(p) ≤ map(q)`); kardeş öğeler bitişik kalır, paragraf toplamı yeni metin uzunluğunu verir. Ek C t3 bunu 3.000 rastgele düzenleme/bölümleme ile doğrular.

**Çalışılmış örnek:**

```
Metin:   "DAVACI : Ahmet Yılmaz (TC: 10000000146)\n"
Öğeler:  [0,9) kalın "DAVACI : " | [9,15) normal "Ahmet " | [15,21) kalın "Yılmaz" | [21,40) normal " (TC: ...)\n"
Düzenlemeler: [9,21) -> "[DAVACI_1]" (fark -2) ; [27,38) -> "[TCKN_1]" (fark -3)
Sonuç:   [0,9) kalın | [9,19) normal "[DAVACI_1]" (çapa: "Ahmet " öğesi) | "Yılmaz" öğesi 0 uzunluk -> silindi
         | [19,35) normal " (TC: [TCKN_1])\n"
Geri çözme sonrası: metin birebir özgün; "Ahmet Yılmaz" tek normal öğede (iki stile yayılan varlıkta
biçim birleşmesi bilinen sınırlamadır; tek stil içindeki varlıklarda ofsetler özgünle birebir aynıdır).
```

```ts
// packages/document-parsers/src/ast/remap.ts
// Metin düzenlemelerinden sonra [start, end) aralıklarını yeniden eşleyen tek kaynak.
// UDF startOffset/length, DOCX run sınırları ve arayüz vurguları hep bu işlevle güncellenir.

import type { TextEdit } from '@maskelex/core-engine/types';

export class EditError extends Error {}

/** Ön koşullar: boş olmayan aralık, çakışma yok, satır sonu ve yer tutucu (￼, ​) içermez. */
export function normalizeEdits(text: string, edits: readonly TextEdit[]): TextEdit[] {
  const sorted = [...edits].sort((a, b) => a.span.start - b.span.start);
  let prevEnd = -1;
  for (const e of sorted) {
    const { start, end } = e.span;
    if (!(Number.isInteger(start) && Number.isInteger(end) && start >= 0 && end <= text.length && start < end))
      throw new EditError(`Geçersiz aralık [${start},${end})`);
    if (start < prevEnd) throw new EditError(`Çakışan düzenleme [${start},${end})`);
    const slice = text.slice(start, end);
    if (/[\n\r￼​]/.test(slice) || /[\n\r]/.test(e.replacement))
      throw new EditError(`Düzenleme paragraf sınırını veya yer tutucuyu aşıyor [${start},${end})`);
    prevEnd = end;
  }
  return sorted;
}

export function applyEditsToText(text: string, edits: readonly TextEdit[]): string {
  const sorted = normalizeEdits(text, edits);
  let out = '';
  let cursor = 0;
  for (const e of sorted) { out += text.slice(cursor, e.span.start) + e.replacement; cursor = e.span.end; }
  return out + text.slice(cursor);
}

/** Konum eşleyici. Kural (çapa kuralı): bir düzenlemenin yeni metnini, düzenlemenin İLK karakterini içeren
 *  öğe sahiplenir. Düzenleme içine düşen her nokta, düzenlemenin yeni bitişine (b') eşlenir. Böylece:
 *  - düzenlemeyi tamamen kapsayan öğe büyür/küçülür,
 *  - düzenleme içinde başlayan öğe, değişen kısmı kaybeder,
 *  - tamamen içeride kalan öğenin uzunluğu 0 olur (silinir).
 *  İşlev monotondur: p ≤ q ⇒ map(p) ≤ map(q). Kardeş öğeler bitişik kalır. */
export function makePointMapper(edits: readonly TextEdit[]): (p: number) => number {
  const n = edits.length;
  const a = edits.map((e) => e.span.start);
  const b = edits.map((e) => e.span.end);
  const cum: number[] = new Array(n + 1).fill(0);  // cum[i]: ilk i düzenlemenin toplam uzunluk farkı
  for (let i = 0; i < n; i++) cum[i + 1] = cum[i]! + edits[i]!.replacement.length - (b[i]! - a[i]!);
  return (p: number): number => {
    // b[i] > p olan ilk i (ikili arama)
    let lo = 0, hi = n;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (b[mid]! > p) hi = mid; else lo = mid + 1; }
    const i = lo;
    if (i < n && a[i]! < p) return a[i]! + cum[i]! + edits[i]!.replacement.length; // düzenleme içi → b'
    return p + cum[i]!;
  };
}

export interface RangeRef { start: number; length: number }
/** Bir aralığı eşler; uzunluk 0 olursa null döner (öğe silinmeli). */
export function remapRange(map: (p: number) => number, r: RangeRef): RangeRef | null {
  const s = map(r.start);
  const e = map(r.start + r.length);
  return e - s > 0 ? { start: s, length: e - s } : null;
}
```

#### 3.5.3 Cerrahi yeniden yazım (AGENT-3, başvuru uygulaması, test edildi: Ek C t3)

İlke: XML ayrıştırılıp yeniden serileştirilmez. `content.xml` ham dizge olarak işlenir; yalnız CDATA bloğu ve `startOffset`/`length` öznitelik değerleri sondan başa doğru eklenip çıkarılır. Böylece girinti, öznitelik sırası ve bilinmeyen alanlar korunur.

- CDATA içinde `]]>` geçerse `]]]]><![CDATA[>` ile bölünür; XML 1.0'da yasak denetim karakterleri atılır.
- `<content>` içinde CDATA dışı karakter (boşluk dahil) varsa dosya reddedilir (`E_UDF_FORMAT`): XML'e göre o karakterler de metne dahildir ve ofsetleri belirsizleştirir.
- Etiket tarayıcısı tırnak farkındalıklıdır (öznitelik değerinde `>` olabilir). `DOMParser` kullanılmaz.

```ts
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
```

#### 3.5.4 UDF okuma → DocumentAST (AGENT-3)

```
readUdf(bytes):
  zip <- fflate.unzipSync(bytes)                      // boyut sınırı: sıkıştırılmamış toplam <= 50 MB, girdi sayısı <= 64 (zip bombası koruması)
  xmlRaw <- UTF-8 çöz(zip['content.xml'])             // BOM varsa koru
  cd <- locateCdata(xmlRaw)                            // E_UDF_FORMAT
  els <- scanOffsetElements(xmlRaw, cd sonrası)
  birim <- ofsetBirimi(cd.text, els)                   // V-01: önce UTF-16; tutarsızsa kod noktası dene
       tutarlılık: tüm öğeler [0, len] içinde ve aynı derinlikteki kardeşler çakışmaz
       ikisi de tutarsız -> READ_ONLY_FALLBACK: yalnız metin çıkarılır, maskeli UDF dışa aktarımı kapatılır
  blocks <- paragraph/table öğelerinden; paragraf aralığı = alt öğelerin [min start, max end)
  marks  <- content öğelerinden: family, size, bold, italic, underline, foreground, background
  placeholders <- metindeki ￼ (IMAGE) ve ​ (EMPTY_PARAGRAPH) konumları
  page <- pageFormat (pt cinsinden kenar boşlukları; paperOrientation)
  warnings: sign.sgn varsa SIGNATURE_PRESENT; documentproperties.xml varsa UYAP_METADATA_PRESENT;
            imageData varsa IMAGES_PRESENT; tanınmayan öğe adı varsa UNKNOWN_ELEMENTS
  source <- { codec: 'udf', opaque: { xmlRaw, unit: birim, otherEntries: zip'in content.xml dışındaki girdileri } }
  return DocumentAST
```

Algılama metni (`ast.text`) CDATA metninin kendisidir; yer tutucu karakterler metinde kalır, dedektörler onları sözcük karakteri saymaz.

#### 3.5.5 UDF üretimi (AGENT-3)

**a) Maskeli dışa aktarım (kaynak biçim korunur):**

```
writeUdfMasked(ast, edits):
  xml2 <- rewriteContentXml(ast.source.xmlRaw, edits)   // birim kod noktasıysa aralıklar önce dönüştürülür
  validateContentXml(xml2) boş olmalı
  zip girdileri: content.xml = xml2
                 documentproperties.xml -> DÜŞÜR (doğrulama kodu belgeyi UYAP'taki dosyaya bağlar)
                 sign.sgn -> DÜŞÜR (imza zaten geçersiz olur)
                 diğer girdiler -> olduğu gibi kopyala
  ZIP zaman damgaları sabit (1980-01-01): aynı girdi aynı çıktıyı verir
  dosya adı: "maskeli-" + 4 hex + ".udf"
```

**b) Çözülmüş çıktı (yeni belge, imzaya hazır):** LLM yanıtı Markdown'dan AST'ye çevrilir (3.5.9) ve sıfırdan UDF üretilir:

```
writeUdfNew(ast):
  text <- paragraflar '\n' ile; boş paragraf "​\n" (V-03)
  her paragraf için <paragraph Alignment="0|1|2|3" [LeftIndent, FirstLineIndent ...]>
     paragraf içindeki her biçim parçası için <content startOffset length family size [bold italic underline]/>
     paragrafın son parçası '\n' karakterini içerir
  tablolar: <table tableName="Sabit" columnCount columnSpans border="borderCell"> / <row> / <cell> / <paragraph>
  <properties><pageFormat ...> kaynak belgeden (varsa), yoksa A4 dikey, varsayılan kenar boşlukları
  <styles><style name="hvl-default" family="Times New Roman" size="12" description="Gövde"/></styles>
  doğrulama: validateContentXml boş + her paragrafın alt öğeleri bitişik + toplam = metin uzunluğu
  zip: yalnız content.xml
  dosya adı: "cozulmus-" + 4 hex + ".udf"
```

Kabul (V-02): sahip, 10 farklı gerçek UDF için maskeli ve çözülmüş çıktıları UYAP Doküman Editörü'nde açar; hiçbirinde bozukluk uyarısı çıkmaz ve imzalama adımına geçilebilir.

#### 3.5.6 ZIP girdi politikası

| Girdi | Maskeli dışa aktarım | Çözülmüş çıktı |
|---|---|---|
| `content.xml` | Cerrahi yeniden yazım | Sıfırdan üretim |
| `documentproperties.xml` | Düşür (uyarı) | Üretilmez |
| `sign.sgn` | Düşür (uyarı) | Üretilmez |
| Diğer | Kopyala | Üretilmez |

#### 3.5.7 DOCX okuma → DocumentAST (AGENT-3)

```
readDocx(bytes):
  zip <- fflate (aynı boyut sınırları); word/document.xml zorunlu
  saxes ile akış halinde oku:
    <w:p> -> paragraf; <w:pPr>/<w:jc> hizalama; <w:pStyle> başlık düzeyi (Heading1..6); <w:numPr> liste
    <w:r> -> biçim parçası; <w:rPr>: <w:b>, <w:i>, <w:u>, <w:rFonts>, <w:sz> (yarım punto)
    <w:t> -> metin (xml:space="preserve" dikkate alınır); <w:tab/> -> "\t"; <w:noBreakHyphen/> -> "-"
    <w:br/> -> "\u2028" (paragraf içi satır kırma; paragrafı bölmez, düzenleme sınırı sayılmaz; düz metne kopyalarken "\n",
           DOCX yazıcı geri <w:br/> üretir)
    <w:ins> içindeki metin dahil; <w:del>/<w:delText> HARİÇ (silinmiş metin LLM'e gitmez); TRACKED_CHANGES uyarısı
    <w:instrText> (alan kodu) HARİÇ; alan sonucu dahil
    <w:tbl>/<w:tr>/<w:tc> -> TableBlock
    <w:drawing>, <w:pict> -> "￼" + IMAGES_PRESENT
  isteğe bağlı parçalar (MaskingOptions): footnotes.xml / endnotes.xml (includeFootnotes, varsayılan açık) metnin sonuna
    "[Dipnot n]" başlığıyla; header*.xml / footer*.xml (includeHeadersFooters, varsayılan kapalı); comments.xml
    (includeComments, varsayılan kapalı)
  docProps/core.xml, app.xml, custom.xml OKUNMAZ ve hiçbir çıktıya taşınmaz
  .docm ya da vbaProject.bin -> MACROS_PRESENT uyarısı, makro yok sayılır
  source <- { codec: 'docx', opaque: { paragraf -> run eşlemesi } }   // yalnız tanılama için
```

#### 3.5.8 DOCX yazma (temiz üretim, AGENT-3)

Özgün paket ASLA kopyalanmaz (üst veri, yorum, izlenen değişiklik ve gömülü nesne sızıntısını yapısal olarak önler). AST'den asgari paket üretilir:

```
[Content_Types].xml
_rels/.rels
word/document.xml          paragraflar, biçim parçaları (b, i, u, rFonts, sz), hizalama, tablo, basit liste
word/styles.xml            Normal (Times New Roman 12, iki yana yaslı), Heading1-3
word/settings.xml          asgari
word/_rels/document.xml.rels
docProps/core.xml          yalnız <dc:title>Belge</dc:title>; creator, lastModifiedBy, tarih YOK
docProps/app.xml           Application="MaskeLex"; Company YOK
Sayfa: A4, kaynak UDF/DOCX'ten kenar boşlukları (varsa)
ZIP zaman damgaları sabit; dosya adı nötr
```

Görseller Faz-1'de yazılmaz; yerlerine `[GÖRSEL]` paragrafı konur ve kullanıcı uyarılır.

#### 3.5.9 Markdown → AST (LLM yanıtı için, AGENT-3)

| Markdown | AST |
|---|---|
| `# ` / `## ` / `### ` | Başlık 1-3; `# ` ortalı ve kalın |
| `**x**` / `__x__` | kalın |
| `*x*` / `_x_` | italik (alt çizgi yalnız sözcük sınırında; `DAVACI_1` gibi kalıntılar italik sayılmaz) |
| `- ` / `* ` / `1. ` | Liste paragrafı; işaret metinde kalır, asılı girinti |
| Tablo (dikey çizgiyle ayrılmış satırlar ve ayraç satırı) | TableBlock |
| Boş satır | Paragraf sonu |
| `> ` | Sol girintili paragraf |
| Kod blokları, bağlantılar | Düz metin (bağlantı adresi parantez içinde) |

Varsayılan paragraf hizası iki yana yaslıdır (dilekçe geleneği); başlıklar ortalıdır.

### 3.6 Performans bütçeleri

| İşlem | Bütçe (başvuru makinesi: Apple M1 / Intel i5 8. nesil) |
|---|---|
| Katman 1-2 + ad kuralları, 100.000 karakter | 300 ms |
| İlk vurgulama (DETERMINISTIC sonucu) | 500 ms |
| NER, 10.000 sözcük, WASM tek iş parçacığı | 20 s (ilerleme çubuğuyla; arayüz donmaz) |
| Model ilk yükleme (önbellekten) | 3 s |
| Geri çözme, 20.000 karakter yanıt | 100 ms |
| UDF okuma + yazma, 50 sayfa | 1 s |
| Vurgulu görünüm kaydırma | 60 fps; 1.000+ paragrafta sanallaştırma |
| Engine Worker bellek | 300 MB altı (model hariç) |

---

## 4. Güvenlik ve sıfır sunucu (zero-knowledge) garantileri

### 4.1 Tehdit modeli

| Tehdit | Önlem | Kalan risk (kullanıcıya açıkça söylenir) |
|---|---|---|
| Uygulama kodunun veriyi sunucuya göndermesi | Sunucu tarafı kod yok; CSP `connect-src 'self'`; R-06 ağ API yasağı; Ağ Denetçisi; "dış istek sıfır" e2e testi; masaüstünde macOS sandbox ağ yetkisiz | Web sürümünde sunucu ele geçirilip değiştirilmiş kod sunulabilir. Önlem: masaüstü imzalı sürüm, yayımlanan sürüm özetleri (`/surum.json`, `/indir`) |
| Üçüncü taraf betik / CDN | Hiçbir CDN yok; yazı tipi, WASM, model aynı kökten; Cloudflare betik enjeksiyonları kapalı (4.10) | Yok |
| XSS | Kullanıcı metni yalnız metin düğümü olarak işlenir (R-05); Trusted Types varsayılan politikası (Chromium); `script-src 'self'` | Chromium dışı tarayıcıda Trusted Types yok; ESLint kuralları ve CSP yine geçerli |
| Tarayıcı eklentileri (ör. Grammarly, LanguageTool) metni okuyup buluta gönderir | Girdi sertleştirme (4.6) yaygın eklentileri devre dışı bırakır | Sayfa içeriğini okuyabilen her eklenti metni görebilir. Arayüz uyarır: "Hassas belgeler için eklentisiz bir tarayıcı profili ya da masaüstü uygulaması kullanın." |
| Tarayıcının yazım denetimi / çeviri hizmeti | `spellcheck=false`, `translate="no"`, `notranslate` | Yok |
| Pano geçmişi ve bulut pano eşitlemesi | Masaüstü: gizli pano biçimleri (4.8); süreli temizleme | Web sürümünde denetlenemez; uyarı + dosya indirme önerisi |
| Kasanın bellekte kalması | Zaman aşımı, el ile silme, panik tuşu, `pagehide` silmesi, worker sonlandırma, sayfa/webview yeniden yükleme (4.7) | JS dizeleri değiştirilemez ve çöp toplama zamanlaması denetlenemez; bellek sıfırlama "en iyi çaba"dır |
| Maskelemenin bir geçişi kaçırması | Sızıntı denetimi (3.0.4) kopyalamayı engeller; inceleme kuyruğu | Bağlamsal tanımlama (olay ayrıntıları) maskelenmez (0.6) |
| Kötü amaçlı belge (ZIP bombası, dev XML) | Boyut ve girdi sayısı sınırları (3.5.4), akış halinde ayrıştırma, Worker'da çalıştırma | Yok |
| Tedarik zinciri | Tam sabit sürümler, kilit dosyası, kurulum betikleri kapalı, `pnpm audit`, `cargo deny`, model SHA-256 (4.9) | Yok |

### 4.2 Web: HTTP güvenlik başlıkları ve CSP

Başlıklar sunucu tarafında verilir (meta etiketiyle `frame-ancestors` verilemez). nginx'te `add_header` alt `location` bloklarında üst bloktakileri ezdiği için başlıklar ortak bir dosyada tutulur ve her `location` içinde `include` edilir.

```nginx
# apps/web/deploy/security-headers.conf  (AGENT-5)
add_header Content-Security-Policy "default-src 'none'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; worker-src 'self'; manifest-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'; object-src 'none'; require-trusted-types-for 'script'; trusted-types default; upgrade-insecure-requests" always;
add_header Cross-Origin-Opener-Policy "same-origin" always;
add_header Cross-Origin-Embedder-Policy "require-corp" always;
add_header Cross-Origin-Resource-Policy "same-origin" always;
add_header Referrer-Policy "no-referrer" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-Frame-Options "DENY" always;
add_header Permissions-Policy "camera=(), microphone=(), geolocation=(), usb=(), serial=(), hid=(), bluetooth=(), payment=(), clipboard-read=(), clipboard-write=(self), browsing-topics=()" always;
```

```nginx
# apps/web/deploy/nginx.conf (özet)
server {
  listen 8080;
  root /usr/share/nginx/html;
  location /assets/  { include security-headers.conf; add_header Cache-Control "public, max-age=31536000, immutable"; }
  location /models/  { include security-headers.conf; add_header Cache-Control "public, max-age=31536000, immutable"; }   # yol sürümlü: /models/<id>@<sha8>/
  location /ort/     { include security-headers.conf; add_header Cache-Control "public, max-age=31536000, immutable"; types { application/wasm wasm; } }
  location = /sw.js  { include security-headers.conf; add_header Cache-Control "no-cache"; }
  location = /surum.json { include security-headers.conf; add_header Cache-Control "no-store"; }
  location /         { include security-headers.conf; add_header Cache-Control "no-cache"; try_files $uri $uri/index.html =404; }
}
```

- `'wasm-unsafe-eval'`: ONNX Runtime WASM derlemesi için zorunludur; `'unsafe-eval'` VERİLMEZ.
- `connect-src 'self'`: yalnız aynı kökten model ve WASM indirme izni; başka hiçbir yere bağlantı yok.
- COOP + COEP: `crossOriginIsolated` sağlar (ORT çok iş parçacığı için `SharedArrayBuffer`) ve sekmeyi diğer kökenlerden yalıtır.
- `worker-src 'self'`: Vite worker'ları aynı kökten URL ile açılır. ONNX Runtime'ın çok iş parçacıklı derlemesi `blob:` worker isterse AGENT-2 bunu ölçer; ADR ile yalnız `worker-src 'self' blob:` eklenir (Trusted Types politikası yalnız aynı kökenin `blob:` adreslerine izin verir). Eklenene kadar `numThreads = 1` kalır.
- `/uygulama/` sayfası ek olarak `<meta name="robots" content="noindex">` taşır.

### 4.3 Masaüstü: Tauri v2 güvenlik kilidi

```json
// apps/desktop-tauri/src-tauri/tauri.conf.json (güvenlikle ilgili kısım, AGENT-5)
{
  "productName": "MaskeLex",
  "identifier": "com.maskelex.app",
  "build": {
    "frontendDist": "../../web/dist-desktop",
    "devUrl": "http://localhost:5173/uygulama/",
    "beforeBuildCommand": "pnpm --filter web build --mode desktop"
  },
  "app": {
    "withGlobalTauri": false,
    "windows": [{ "label": "main", "title": "MaskeLex", "width": 1440, "height": 900, "minWidth": 1024, "minHeight": 640, "dragDropEnabled": false }],
    "security": {
      "freezePrototype": true,
      "csp": {
        "default-src": "'none'",
        "script-src": "'self' 'wasm-unsafe-eval'",
        "style-src": "'self'",
        "img-src": "'self' data: blob:",
        "font-src": "'self'",
        "connect-src": "'self' ipc: http://ipc.localhost",
        "worker-src": "'self'",
        "manifest-src": "'self'",
        "base-uri": "'none'",
        "form-action": "'none'",
        "frame-src": "'none'",
        "object-src": "'none'"
      },
      "headers": {
        "Cross-Origin-Opener-Policy": "same-origin",
        "Cross-Origin-Embedder-Policy": "require-corp",
        "X-Content-Type-Options": "nosniff",
        "Permissions-Policy": "camera=(), microphone=(), geolocation=()"
      }
    }
  },
  "bundle": {
    "active": true,
    "macOS": { "minimumSystemVersion": "13.3", "hardenedRuntime": true, "entitlements": "./entitlements.plist" },
    "windows": { "nsis": { "installMode": "currentUser" } }
  }
}
```

- `dragDropEnabled: false`: Windows'ta HTML5 sürükle-bırakın çalışması için gerekir; böylece web ve masaüstü aynı `File` API kodunu kullanır.
- `withGlobalTauri: false`, `freezePrototype: true`.
- **Eklenti yok kuralı:** `updater`, `http`, `shell`, `opener`, `fs` eklentileri KULLANILMAZ. Dosya kaydetme ve gizli pano, uygulamanın kendi üç Rust komutuyla yapılır; JavaScript keyfi bir yola yazamaz:

```rust
// apps/desktop-tauri/src-tauri/src/lib.rs (iskelet, AGENT-5)
#[tauri::command]
async fn kaydet(app: tauri::AppHandle, dosya_adi: String, veri: Vec<u8>) -> Result<bool, String> {
    // Yerel "Farklı kaydet" penceresi Rust tarafında açılır; yol JS'e hiç dönmez.
    use tauri_plugin_dialog::DialogExt;
    let secim = app.dialog().file().set_file_name(&dosya_adi).blocking_save_file();
    match secim { Some(yol) => std::fs::write(yol.into_path().map_err(|_| "yol")?, veri).map(|_| true).map_err(|_| "yazma".into()), None => Ok(false) }
}
#[tauri::command] fn pano_yaz(metin: String, hassas: bool) -> Result<u64, String> { clipboard::yaz(&metin, hassas) }   // dönen değer: pano sıra numarası
#[tauri::command] fn pano_temizle(sira: u64) -> Result<bool, String> { clipboard::degismediyse_temizle(sira) }
```

```json
// apps/desktop-tauri/src-tauri/capabilities/default.json
{
  "identifier": "default",
  "description": "MaskeLex ana pencere: yalnız uygulamanın kendi üç komutu",
  "windows": ["main"],
  "permissions": ["core:default", "allow-kaydet", "allow-pano-yaz", "allow-pano-temizle"]
}
```

Komutlar `build.rs` içinde uygulama bildirimine (app manifest) eklenir ve izinleri yukarıdaki kimliklerle tanımlanır; listede olmayan komut çağrılamaz. `tauri_plugin_dialog` yalnız Rust tarafından kullanılır; JS izni verilmez. (Ayrıntılı izin adları kurulu Tauri sürümüne göre AGENT-5 tarafından doğrulanır.)

```xml
<!-- apps/desktop-tauri/src-tauri/entitlements.plist : macOS App Sandbox, AĞ YETKİSİ YOK -->
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>com.apple.security.app-sandbox</key><true/>
  <key>com.apple.security.files.user-selected.read-write</key><true/>
  <!-- com.apple.security.network.client BİLEREK YOK: işletim sistemi dış bağlantıyı reddeder -->
</dict>
</plist>
```

```toml
# apps/desktop-tauri/src-tauri/deny.toml
[bans]
deny = [
  { name = "reqwest" }, { name = "ureq" }, { name = "curl" }, { name = "isahc" }, { name = "attohttpc" }, { name = "surf" },
  { name = "tauri-plugin-http" }, { name = "tauri-plugin-updater" }, { name = "tauri-plugin-shell" }, { name = "tauri-plugin-opener" },
]
[licenses]
allow = ["MIT", "Apache-2.0", "Apache-2.0 WITH LLVM-exception", "BSD-2-Clause", "BSD-3-Clause", "ISC", "Zlib", "Unicode-3.0", "MPL-2.0"]
```

`cargo deny check` CI'da zorunludur. Tauri çekirdeği yasak listeden bir kütüphaneyi dolaylı çekiyorsa ADR ile gerekçelendirilir ve kodda kullanılmadığı gösterilir. Windows'ta işletim sistemi düzeyinde ağ yasağı yoktur; `/indir` sayfası isteyen kurumlar için Windows Güvenlik Duvarı giden bağlantı engelleme kuralını adım adım anlatır.

### 4.4 Trusted Types varsayılan politikası (web, Chromium)

Uygulama kodundan ÖNCE çalışmalıdır (`main.tsx`'in ilk satırı). Kütüphanelerin `new Worker(url)` gibi çağrıları aynı kökenden olduğu sürece şeffaf çalışır; HTML ve dinamik betik enjeksiyonu her yerde reddedilir.

```ts
// apps/web/src/security/trustedTypes.ts
// Varsayılan Trusted Types politikası (Chromium). main.tsx'in İLK işi olarak çağrılır.
interface TrustedTypePolicyFactoryLike { createPolicy(name: string, rules: Record<string, (s: string) => string>): unknown }

export function installTrustedTypes(): void {
  const tt = (globalThis as { trustedTypes?: TrustedTypePolicyFactoryLike }).trustedTypes;
  if (!tt) return;   // Chromium dışı: CSP yönergesi yok sayılır; R-05 ESLint kuralı yine geçerli
  tt.createPolicy('default', {
    createHTML: () => { throw new TypeError('HTML enjeksiyonu yasak'); },
    createScript: () => { throw new TypeError('Dinamik betik yasak'); },
    createScriptURL: (url: string) => {
      const u = new URL(url, location.href);
      const sameOrigin = u.origin === location.origin || (u.protocol === 'blob:' && url.startsWith(`blob:${location.origin}/`));
      if (!sameOrigin) throw new TypeError('Yalnız aynı kökenden betik');
      return u.href;
    },
  });
}
```

Masaüstünde Trusted Types, Tauri'nin enjekte ettiği IPC betikleriyle uyumluluğu AGENT-5 tarafından doğrulandıktan sonra CSP'ye eklenir; doğrulanana kadar kapalıdır.

### 4.5 Canlı Ağ Denetçisi (Outbound Traffic Monitor)

**Amaç:** Kullanıcıya oturum boyunca uygulamanın kendi kökeni dışına hiçbir istek yapmadığını canlı olarak göstermek ve olası bir girişimi hem engellemek hem görünür kılmak.

**Kurulum:** Ana iş parçacığında `main.tsx`'te Trusted Types'tan hemen sonra; her worker'ın ilk satırında (`installNetworkGuard('engine-worker', ...)`). Worker'lar olayları `postMessage` ile ana iş parçacığına iletir.

```ts
// apps/web/src/security/networkMonitor.ts
// Canlı Ağ Denetçisi: ana iş parçacığında ve her worker'ın ilk satırında kurulur.
// Aynı köken dışındaki her isteği ENGELLER ve bildirir; aynı köken isteklerini yalnız yol olarak kaydeder.
import type { NetworkEvent, NetworkKind, NetworkRealm } from '@maskelex/core-engine/types';

type AnyGlobal = Record<string, any>;

export function installNetworkGuard(realm: NetworkRealm, report: (e: NetworkEvent) => void): void {
  const g = globalThis as unknown as AnyGlobal;
  const origin: string = g.location.origin;
  const same = (u: string): boolean => { try { return new URL(u, g.location.href).origin === origin; } catch { return false; } };
  const shown = (u: string): string => (same(u) ? new URL(u, g.location.href).pathname : u);
  const guard = (kind: NetworkKind, url: string): void => {
    const ok = same(url);
    report({ at: Date.now(), realm, kind, url: shown(url), sameOrigin: ok, blocked: !ok });
    if (!ok) throw new DOMException('Dış bağlantı engellendi', 'SecurityError');
  };

  const origFetch = (g.fetch as typeof fetch).bind(g);
  g.fetch = (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    guard('fetch', typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
    return origFetch(input, init);
  };
  if (g.XMLHttpRequest) {
    const open = g.XMLHttpRequest.prototype.open as (...a: unknown[]) => void;
    g.XMLHttpRequest.prototype.open = function (this: XMLHttpRequest, method: string, url: string | URL, ...rest: unknown[]) {
      guard('xhr', String(url));
      return open.call(this, method, url, ...rest);
    };
  }
  for (const [name, kind] of [['WebSocket', 'websocket'], ['EventSource', 'eventsource']] as const) {
    if (g[name]) g[name] = new Proxy(g[name], { construct(t, args) { guard(kind, String(args[0])); return Reflect.construct(t, args); } });
  }
  if (g.navigator?.sendBeacon) g.navigator.sendBeacon = (u: string): boolean => { guard('beacon', u); return false; };
  for (const name of ['RTCPeerConnection', 'webkitRTCPeerConnection']) {   // WebRTC, CSP connect-src kapsamında değildir
    if (g[name]) g[name] = function () {
      report({ at: Date.now(), realm, kind: 'webrtc', url: 'webrtc:', sameOrigin: false, blocked: true });
      throw new DOMException('WebRTC devre dışı', 'SecurityError');
    };
  }
  if (typeof PerformanceObserver !== 'undefined') {
    new PerformanceObserver((list) => {
      for (const e of list.getEntries() as PerformanceResourceTiming[])
        report({ at: Date.now(), realm, kind: 'resource', url: shown(e.name), sameOrigin: same(e.name), blocked: false, bytes: e.transferSize });
    }).observe({ type: 'resource', buffered: true });
  }
  g.addEventListener?.('securitypolicyviolation', (ev: SecurityPolicyViolationEvent) =>
    report({ at: Date.now(), realm, kind: 'csp-violation', url: ev.blockedURI, sameOrigin: false, blocked: true }));
}
```

**Arayüz:** Üst çubukta rozet: yeşil "Dış bağlantı yok". Herhangi bir dış girişimde rozet kırmızı olur, kalıcı bir uyarı açılır ("Dış bağlantı girişimi engellendi: <adres>. Veri gönderilmedi.") ve olay listesi çekmecesi (zaman, tür, yol, boyut, iş parçacığı) açılabilir. Olaylar yalnız bellektedir, hiçbir yere yazılmaz. Çekmecede "Çevrimdışı deneyin" ipucu bulunur: ilk yüklemeden sonra internet kesilse de uygulama tam çalışır.

**Sınır (dürüstçe yazılır):** Denetçi sayfa ve worker düzeyindeki API'leri görür; tarayıcı eklentilerini ve işletim sistemini göremez.

### 4.6 Girdi sertleştirme

Metin girilen ve metin gösterilen her alan (`textarea`, inceleme görünümü, maskeli ve çözülmüş paneller) şu öznitelikleri taşır:

```ts
// apps/web/src/security/inputHardening.ts
// Metin girilen ve gösterilen her alana uygulanır: yazım denetimi, çeviri ve yaygın yazım eklentileri kapalı.
export const SENSITIVE_FIELD_ATTRS = {
  spellCheck: false, autoComplete: 'off', autoCorrect: 'off', autoCapitalize: 'off', translate: 'no',
  'data-gramm': 'false', 'data-gramm_editor': 'false', 'data-enable-grammarly': 'false',
  'data-lt-active': 'false', 'data-ms-editor': 'false',
} as const;
```

Ayrıca `<html lang="tr" translate="no" class="notranslate">` ve `<meta name="google" content="notranslate">`. Gerekçe: tarayıcıların gelişmiş yazım denetimi ve sayfa çevirisi metni üçüncü taraf sunuculara gönderir.

### 4.7 Kasa yaşam döngüsü ve sıfırlama (Vault Zeroization)

```
YOK --createSession--> AKTİF --markIssued (ilk kopya)--> KİLİTLİ
AKTİF / KİLİTLİ --(zaman aşımı | Sil | Panik | pagehide | yeni oturum)--> SİLİNDİ --> YOK
```

| Tetik | Davranış |
|---|---|
| Hareketsizlik `sessionTimeoutMinutes` (varsayılan 60) | 5 dakika kala geri sayım ve "Uzat" düğmesi; süre bitince silme |
| "Oturumu sil" düğmesi | Onay penceresi, sonra silme |
| Panik kısayolu (5.10) | Onaysız anında silme + `hardReset` |
| `pagehide` (`persisted` false) | Silme (en iyi çaba) |
| Kapatma girişimi, kasa doluyken | `setCloseGuard(true)`: tarayıcı/pencere onay ister |
| Sekme arka plana geçerse | Silme YOK (avukat LLM sekmesine geçecektir); süre işlemeye devam eder |

```
wipe(reason):                                   // Engine Worker içinde (AGENT-5 vault/store.ts)
  NER worker'a 'dispose' gönder
  kasa Map'lerini boşalt (entities, mentions, groups, tokenIndex, twinIndex); counters = {}
  belge AST ve ham baytlarının referanslarını bırak; amountScale = undefined
  şifreleme için kullanılan geçici Uint8Array'leri fill(0)
  ana iş parçacığına 'wiped' bildir; ardından self.close()
UI:
  Engine ve NER worker'larını terminate() et, yenilerini oluştur
  store.reset(); tüm textarea değerlerini '' yap; geri al (undo) geçmişini temizle
  son hassas kopyanın parmak izi varsa platform.clearClipboardIfUnchanged(parmakİzi)
  PANIC ise platform.hardReset() (web: location.reload; masaüstü: webview yeniden oluşturulur)
```

Dürüst not (arayüzde "Güvenlik" sayfasında yazılır): JavaScript dizeleri değiştirilemez ve çöp toplayıcının belleği ne zaman bırakacağı denetlenemez. Silme; referansları bırakmak, worker'ları sonlandırmak ve sayfayı yeniden yüklemekle yapılır ve en iyi çabadır.

**Şifreli kasa dışa aktarımı (isteğe bağlı, K-16):** Avukat LLM yanıtını beklerken sekmeyi kapatabilir; kasa kaybolursa yanıt çözülemez. Kasa `.mlxkasa` dosyasına parolayla şifrelenip indirilebilir.

Başvuru uygulaması (test edildi: Ek C t10; tam tur, yanlış parola, kurcalanmış dosya, düşük tur sayısı):

```ts
// packages/core-engine/src/vault/crypto.ts
// Kasanın parolalı şifreli dışa/içe aktarımı: PBKDF2-SHA256 (600.000 tur) + AES-256-GCM, ek doğrulanmış veri ile.
// Yalnız Web Crypto kullanılır; anahtar dışa aktarılamaz (extractable=false).

import type { EncryptedVaultFile, MaskelexError } from '../types/contracts';

const AAD = new TextEncoder().encode('maskelex-kasa-v1');
const MIN_ITERATIONS = 600_000;
const err = (message: string): MaskelexError => ({ code: 'E_CRYPTO', message });

const toB64 = (u: Uint8Array): string => { let s = ''; for (const b of u) s += String.fromCharCode(b); return btoa(s); };
const fromB64 = (s: string): Uint8Array<ArrayBuffer> => { const bin = atob(s); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u; };

async function deriveKey(passphrase: string, salt: Uint8Array<ArrayBuffer>, iterations: number, usage: 'encrypt' | 'decrypt'): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(passphrase.normalize('NFC')), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, base, { name: 'AES-GCM', length: 256 }, false, [usage]);
}

/** serialized: kasanın JSON baytları. Çağrıdan sonra sıfırlanır. */
export async function encryptVault(serialized: Uint8Array<ArrayBuffer>, passphrase: string): Promise<EncryptedVaultFile> {
  if (passphrase.length < 12) throw err('Parola en az 12 karakter olmalı.');
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(passphrase, salt, MIN_ITERATIONS, 'encrypt');
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: AAD }, key, serialized));
  serialized.fill(0);
  return { v: 1, kdf: 'PBKDF2-SHA256', iterations: MIN_ITERATIONS, salt: toB64(salt), iv: toB64(iv), ciphertext: toB64(ct) };
}

export async function decryptVault(file: EncryptedVaultFile, passphrase: string): Promise<Uint8Array> {
  if (file.v !== 1 || file.kdf !== 'PBKDF2-SHA256') throw err('Desteklenmeyen kasa dosyası.');
  if (!Number.isInteger(file.iterations) || file.iterations < MIN_ITERATIONS) throw err('Kasa dosyası güvenlik koşullarını sağlamıyor.');
  const key = await deriveKey(passphrase, fromB64(file.salt), file.iterations, 'decrypt');
  try {
    return new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(file.iv), additionalData: AAD }, key, fromB64(file.ciphertext)));
  } catch {
    throw err('Parola hatalı ya da dosya bozuk.');
  }
}
```

Serileştirme: `Map`'ler `[anahtar, değer]` dizilerine çevrilir; `options`, `counters`, `locked`, `amountScale` dahildir. İçe aktarmada sürüm, KDF ve tur sayısı denetlenir; GCM doğrulaması başarısızsa "Parola hatalı ya da dosya bozuk" iletisi verilir.

### 4.8 Pano güvenliği

| Metin türü | Web | Masaüstü |
|---|---|---|
| Maskeli metin (`MASKED`) | `navigator.clipboard.writeText` | `pano_yaz(metin, hassas=false)` |
| Çözülmüş metin (`SENSITIVE`) | İlk kullanımda uyarı: "Web sürümünde pano geçmişi ve cihazlar arası pano eşitlemesi denetlenemez. Çözülmüş metni dosya olarak indirmeniz önerilir." Kopyalama sonrası `clipboardClearSeconds` (varsayılan 60) dolunca, sekme odaktaysa ve pano değişmediyse boş dizeyle üzerine yazılır | `pano_yaz(metin, hassas=true)` ve süre dolunca `pano_temizle(sıra)` |

Masaüstü gizli pano (AGENT-5, `clipboard.rs`; V-06 ile gerçek cihazda doğrulanır):

- **Windows:** `OpenClipboard`, `EmptyClipboard`, `SetClipboardData(CF_UNICODETEXT)`; ayrıca kayıtlı biçimler: `ExcludeClipboardContentFromMonitorProcessing` (herhangi bir veri), `CanIncludeInClipboardHistory` (DWORD 0), `CanUploadToCloudClipboard` (DWORD 0). Temizlemeden önce `GetClipboardSequenceNumber` karşılaştırılır; kullanıcı arada başka bir şey kopyaladıysa dokunulmaz.
- **macOS:** `NSPasteboard.general`: `clearContents`, `prepareForNewContents(with: .currentHostOnly)` (Evrensel Pano ile diğer cihazlara geçmez), `setString(_, forType: .string)`; pano yöneticilerine sinyal için `org.nspasteboard.ConcealedType` ve `org.nspasteboard.TransientType` türleri boş veriyle eklenir. Temizlemeden önce `changeCount` karşılaştırılır.

### 4.9 Tedarik zinciri

- Tüm sürümler tam sabit; `pnpm-lock.yaml` ve `Cargo.lock` commit'lenir.
- pnpm kurulum betikleri varsayılan kapalı; `onlyBuiltDependencies` yalnız zorunlu olanları (ör. esbuild) içerir.
- Haftalık bağımlılık güncelleme PR'ları (otomatik birleştirme YOK); her biri CI ve altın seti geçer.
- Model ve tokenizer dosyalarının SHA-256 değerleri `modelConfig.ts`'de sabittir; `fetch-model.mjs` uyuşmazlıkta derlemeyi durdurur. Web'de model yolu sürümlüdür (`/models/<id>@<sha8>/`).
- Masaüstü sürümleri imzalanır (S-03); `/indir` sayfasında her dosyanın SHA-256 değeri yayımlanır.
- `dist/` çıktısı CI'da taranır: `https://` ile başlayan ve `maskelex.com` dışındaki her köken derlemeyi başarısız kılar (yalnız tanıtım sayfalarındaki kaynak bağlantıları için izin listesi).

### 4.10 Altyapı (surec.md 3 uyarlaması)

- **Barındırma (S-01 a):** Çok aşamalı Dockerfile: Node ile `pnpm build`, ardından `nginx:alpine` (ARM64 uyumlu) üzerinde `dist` + 4.2 başlıkları, port 8080. Coolify sağlık denetimi: `GET /surum.json` 200 ve gövdede beklenen commit.
- **Cloudflare:** DNS proxy açık, SSL/TLS Full (strict), `www` → kök 301. Cache Rule surec.md'deki gibi (her şey önbelleğe uygun; Edge TTL kaynak başlığına uyar). Her yayın sonrası önbellek temizliği. KAPATILACAKLAR: E-posta Adresi Gizleme (Scrape Shield), Rocket Loader, Web Analytics otomatik ekleme, Zaraz, Bot Fight Mode JavaScript tespitleri. Bunlar HTML'e betik ekler; CSP'yi bozar ve üçüncü taraf kod getirir. HSTS önce kısa süreli, sonra 2 yıl + includeSubDomains + preload (en son).
- **`.well-known/security.txt`:** iletişim adresi (sahip verir), tercih edilen dil `tr, en`, son geçerlilik tarihi.

### 4.11 Güvenlik kabul testleri (AGENT-5 yazar, CI'da koşar)

1. **Dış istek sıfır (Playwright):** Tam akış (yükle, model hazırla, tara, maskele, kopyala, geri çöz, UDF ve DOCX indir) boyunca `page.on('request')` ile görülen her isteğin kökeni uygulama kökenidir. Model önbellekteyken ikinci akışta model isteği de olmaz.
2. **Çevrimdışı:** İlk yüklemeden sonra `context.setOffline(true)`; tam akış çalışır.
3. **CSP ihlali sıfır:** Akış boyunca konsolda `securitypolicyviolation` ve CSP hatası yoktur.
4. **Sızıntı:** Altın setteki her vakada maskeli çıktı, altın kişisel veri dizelerinin hiçbirini içermez (YÜKSEK kategoriler için kesin; KİŞİ için eşik Ek A).
5. **Derleme taraması:** `dist/` içinde izinsiz dış köken yok (4.9).
6. **Tauri yapılandırma anlık görüntüsü:** `tauri.conf.json` CSP'si, başlıklar ve `capabilities/default.json` bu bölümdekiyle birebir aynı (snapshot testi); `cargo deny check` yeşil.
7. **Kasa silme:** Silmeden sonra `unmask` çağrısı `E_NO_SESSION` döner; arayüz alanları boştur; worker'lar yeniden oluşturulmuştur.
8. **Ağ Denetçisi:** Test sayfasında `fetch('https://example.com')` denemesi `SecurityError` fırlatır, olay `blocked: true` kaydedilir ve rozet kırmızıya döner.
9. **Elle (her sürümde):** V-06 pano testleri; macOS'ta sandbox altında NER ve dosya kaydetmenin çalışması (V-07).

---

## 5. UI/UX bileşen spesifikasyonu

### 5.1 Ekran düzeni

**Masaüstü ve geniş ekran (1024 px ve üstü): bölünmüş ekran**

```
+------------------------------------------------------------------------------------------------+
| MaskeLex  [1 Maskele] > [2 Kopyala] > [3 Geri çöz]          Kip: (Etiket | Fonetik İkiz)          |
|           Tutar: (Kapalı | Etiketle | Orantılı ölçekle)     (o) Dış bağlantı yok   54:12  [Sil]   |
+-----------------------------------------------+------------------------------------------------+
| SOL PANEL: Ham metin                          | SAĞ PANEL   Sekmeler: [Maskeli metin] [Geri çöz] |
|  (Düzenle | İncele)                           |                                                |
|                                               |  Maskeli metin (salt okunur, etiketler renkli)  |
|  ...Davacı [Ahmet Yılmaz ·KİŞİ·DAVACI] ile... |                                                |
|  ...[2024/892 ·DOSYA] E. ...                  |  Şablon: [Genel hukuki değerlendirme v]         |
|  ...Yargıtay 9. HD [2022/4110 ·korunuyor]...  |  Görev:  [............................]         |
|                                               |  Sızıntı denetimi: temiz      [ Kopyala ]       |
|-----------------------------------------------|  Not: Maskeleme olay ayrıntılarını kaldırmaz.   |
|  Kenar: [Varlıklar 12] [İnceleme 3] [Kasa]    |                                                |
+-----------------------------------------------+------------------------------------------------+
| NER: hazır (WASM) | 3 inceleme bekliyor | Son işlem 0,21 sn                                      |
+------------------------------------------------------------------------------------------------+
```

- Paneller arası ayraç sürüklenebilir (en az %30 / %70).
- "Geri çöz" sekmesinde sağ panel ikiye bölünür: üstte yapıştırma alanı (LLM yanıtı), altta çözülmüş görünüm ve sorun listesi.

**Dar ekran (768 px altı):** Üç sekme: Girdi, Maskeli, Geri çöz. Varlık listesi ve inceleme kuyruğu alttan açılan sayfa (bottom sheet) olur. 375 px'te yatay taşma yoktur (surec.md 9).

### 5.2 Arayüz durum makinesi

| Durum | Açıklama | Olaylar → hedef |
|---|---|---|
| `BOS` | Oturum yok ya da yeni | `METIN_GIRDI` / `DOSYA_BIRAKILDI` → `DUZENLEME` |
| `DUZENLEME` | Ham metin düzenlenebilir | `TARA` (Ctrl/Cmd+Enter) → `ANALIZ` |
| `ANALIZ` | `DETERMINISTIC` sonucu gelince vurgular görünür; NER sürerken ilerleme | `ANALIZ_BITTI` → `INCELEME`; `IPTAL` → `DUZENLEME` |
| `INCELEME` | Varlıklar etkileşimli; ham metin salt okunur ("Düzenle"ye dönülebilir, analiz yenilenir) | `KOMUT` → `INCELEME`; `MASKELE` → `MASKELI_HAZIR` |
| `MASKELI_HAZIR` | Maskeli metin ve sızıntı denetimi görünür | `KOPYALA` (bulgu yoksa) → `KOPYALANDI`; `KOMUT` → `INCELEME` |
| `KOPYALANDI` | Kasa kilitli; ham metin düzenlenemez (etiketler sabit). Aynı oturuma yeni belge eklenebilir | `YANIT_YAPISTIR` → `YANIT_GIRISI` |
| `YANIT_GIRISI` | LLM yanıtı yapıştırıldı | `COZ` (Ctrl/Cmd+Enter) → `COZULMUS_INCELEME` |
| `COZULMUS_INCELEME` | Çözülmüş metin, değişiklikler ve sorunlar | `SORUN_COZ` → aynı; `DISA_AKTAR` / `KOPYALA_HASSAS` → aynı; `YENI_YANIT` → `YANIT_GIRISI` |
| `SILINDI` | Kısa bilgi ekranı | 2 sn sonra → `BOS` |

Her durumdan `SURE_DOLDU`, `SIL`, `PANIK` → `SILINDI`.

```ts
// TASLAK, AGENT-4 iç tipi (kontrat değildir) -> apps/web/src/app/store.ts
interface UiState {
  phase: 'BOS' | 'DUZENLEME' | 'ANALIZ' | 'INCELEME' | 'MASKELI_HAZIR' | 'KOPYALANDI' | 'YANIT_GIRISI' | 'COZULMUS_INCELEME' | 'SILINDI';
  session?: SessionInfo;
  activeDocId?: DocumentId;
  rawDraft: string;
  analysis?: AnalysisResult;
  masked?: MaskedOutput;
  unmaskInput: string;
  unmask?: UnmaskResult;
  focus?: { entityId?: EntityId; mentionId?: MentionId };
  rightTab: 'MASKELI' | 'COZ';
  templateId: string;
  task: string;
  network: { externalAttempts: number; events: number };
  ner: NerStatus;
  acknowledgedLeaks: string[];      // kullanıcının "sorun değil" dediği bulgu kimlikleri
  toasts: Array<{ id: string; kind: 'bilgi' | 'uyari' | 'hata'; text: string }>;
}
```

### 5.3 Bileşen ağacı ve sorumluluklar (`apps/web/src/components`)

| Bileşen | Sorumluluk |
|---|---|
| `StepBar` | Üç adım, etkin adım, kısayol ipuçları |
| `ModeToggle` | Etiket / Fonetik İkiz (`SET_OPTIONS`); ikiz kipine geçişte kilitli kasada uyarı |
| `AmountFuzzToggle` | Tutar şalteri (5.7) |
| `NetworkBadge`, `NetworkDrawer` | 4.5 |
| `SessionTimer` | Geri sayım, "Uzat", "Sil", "Şifreli kaydet", "Kasayı yükle" |
| `InputPanel` | Yapıştırma `textarea`'sı (4.6 öznitelikleri), sürükle-bırak alanı, dosya seçici; `.udf .docx .txt .md` kabul eder; belge uyarılarını gösterir |
| `ReviewView` | Salt okunur vurgulu görünüm; paragraf bazlı sanallaştırma (1.000+ paragraf); her anma bir `EntityChip`; metin seçimi ile elle ekleme |
| `EntityChip` | Renk + rozet + durum biçimi (5.4); `button` öğesi; `aria-label` "Ahmet Yılmaz, Kişi, Davacı, maskelenecek" |
| `EntityPopover` | Durum, kategori, rol değiştirici (5.6), etiket ve kanonik biçim düzenleme, "Bu anma başka kişi" (`DETACH_MENTION`), "Şununla birleştir" (`MERGE`), geçiş sayısı |
| `SelectionToolbar` | Seçili metin için: Kişi / Şirket / Adres / Diğer + "Tüm geçişlere uygula" (varsayılan açık) → `ADD_MANUAL` |
| `GroupResolver` | "Bu 'Yılmaz' kimi kastediyor?" adaylar + "Belirsiz kalsın" → `RESOLVE_GROUP` |
| `CitationBadge` | Korunan künye (gri, kalkan simgesi "korunuyor"); İNCELE künyesi (turuncu) ve "Maskele / Emsal, koru" seçimi |
| `EntityList` | Kenar çubuğu: kategoriye göre gruplu varlık tablosu, sayılar, toplu "tümünü maskele / bırak" |
| `ReviewQueue` | `reviewQueue` öğeleri; J/K ile gezinme |
| `VaultView` | Etiket ↔ özgün değer tablosu; varsayılan gizli, "Göster" ile açılır (omuz üstü bakışa karşı) |
| `MaskedPanel` | Maskeli metin, şablon seçici, görev alanı, karakter ve etiket sayısı, sızıntı bulguları, Kopyala |
| `LeakFindings` | Bulgu listesi; her bulgu için "Maskele" (`ADD_MANUAL`) ya da "Sorun değil" |
| `UnmaskPanel` | Yanıt alanı, Çöz düğmesi, çözülmüş görünüm (değişen ekler vurgulu), sorun listesi, Kopyala (hassas), İndir (.udf / .docx / .txt) |
| `IssueList` | `UnmaskIssue` türüne göre eylemler: grup → kişi seç; tutar → öneriyi uygula; bilinmeyen etiket → olduğu gibi bırak ya da elle değiştir |
| `ShortcutHelp` | `?` ile açılan kısayol listesi |
| `Toasts`, `ConfirmDialog` | Bildirimler ve onaylar; `aria-live="polite"` |

### 5.4 Vurgulama ve renk sistemi

```css
/* apps/web/src/styles/tokens.css (AGENT-4). Arka planlar hazır rgba: color-mix() Chromium 111 öncesinde yok. */
:root {
  --mlx-c-kisi: #1d4ed8;     --mlx-c-kisi-bg: rgba(29, 78, 216, 0.12);
  --mlx-c-sirket: #6d28d9;   --mlx-c-sirket-bg: rgba(109, 40, 217, 0.12);
  --mlx-c-kurum: #475569;    --mlx-c-kurum-bg: rgba(71, 85, 105, 0.12);
  --mlx-c-adres: #0f766e;    --mlx-c-adres-bg: rgba(15, 118, 110, 0.12);
  --mlx-c-kimlik: #b91c1c;   --mlx-c-kimlik-bg: rgba(185, 28, 28, 0.12);
  --mlx-c-finans: #c2410c;   --mlx-c-finans-bg: rgba(194, 65, 12, 0.12);
  --mlx-c-iletisim: #15803d; --mlx-c-iletisim-bg: rgba(21, 128, 61, 0.12);
  --mlx-c-plaka: #4338ca;    --mlx-c-plaka-bg: rgba(67, 56, 202, 0.12);
  --mlx-c-dosya: #a16207;    --mlx-c-dosya-bg: rgba(161, 98, 7, 0.14);
  --mlx-c-tarih: #be185d;    --mlx-c-tarih-bg: rgba(190, 24, 93, 0.12);
  --mlx-c-ozel: #334155;     --mlx-c-ozel-bg: rgba(51, 65, 85, 0.12);
  --mlx-review: #b45309;     --mlx-protected: #64748b;
}
@media (prefers-color-scheme: dark) { :root { /* aynı adlar, açık tonlar; metin kontrastı en az 4.5:1 */ } }
```

| Durum | Görünüm |
|---|---|
| `MASK` | Kategori arka planı + 2 px düz alt çizgi + kısa rozet (Kİ, Şİ, KU, AD, TC, YK, VK, ME, PS, IB, KA, TU, TE, EP, PL, DO, TA, YE, DT, GZ) |
| `KEEP` | Arka plan yok, kesikli alt çizgi, soluk rozet |
| `REVIEW` | Kehribar noktalı çerçeve + "?" rozeti |
| Korunan künye | Gri kesikli kutu + kalkan simgesi + "korunuyor" |
| İNCELE künyesi | Turuncu kalkan + "incele" |
| Grup etiketi | Kategori rengi + "?" + "kim?" ipucu |

Renk tek başına anlam taşımaz: her vurgu rozet metni ve biçim (düz/kesikli/noktalı) farkı da taşır.

### 5.5 Etkileşimler

- **Tıklama / Enter** (vurgu üzerinde): `EntityPopover` açılır. Değişiklik o varlığın tüm anmalarına uygulanır; tek anmaya uygulamak için "Yalnız bu geçiş".
- **Metin seçimi** (İncele kipinde): `SelectionToolbar`. Seçim DOM aralığından metin ofsetine `data-start` öznitelikleri ile çevrilir; seçim satır sonunu aşamaz (aşarsa ilk satıra kırpılır ve bildirilir).
- **Grup etiketi:** İnceleme kuyruğunun başına gelir; `GroupResolver` adayları ad, rol ve ilk geçtiği cümleyle gösterir.
- **Kendi dosyası künyesi:** "Bu künye sizin dosyanıza ait olabilir. Maskelensin mi?" [Maskele] [Emsal, koru].
- **Kilitli kasada** düzenleme: rol veya kategori değişikliği yeni etiket üretir; popover bunu bildirir: "Yeni etiket verilecek. Önceki etiket, yanıtlarda tanınmaya devam eder."
- **Fonetik İkiz kipinde** ikizi bulunamayan varlık, etiket kipinde kalır; popover "Bu ad için uygun ikiz bulunamadı, etiket kullanılıyor" der.

### 5.6 Hukuki Rol Değiştirici

- Yalnız `KISI` kategorisinde etkindir. `[KİŞİ_1]` → `[DAVACI_1]`: `SET_ROLE` komutu.
- Hızlı rol listesi (sırasıyla 1-9 tuşları): Davacı, Davalı, Müvekkil, Vekil, Tanık, Sanık, Müşteki, Bilirkişi, Kişi (belirsiz). "Diğer roller" araması `LEGAL_ROLES`'un tamamını listeler.
- Kasa kilitli değilse etiketler ilk görünüş sırasına göre yeniden numaralanır (boşluksuz). Kilitliyse yeni etiket sayaçtan devam eder, eskisi takma ad kalır (K-11).
- Aynı rolden birden çok kişi numarayla ayrılır: `[DAVALI_1]`, `[DAVALI_2]`.

### 5.7 Tutar Şaşırtma şalteri

| Konum | Davranış | Ekrandaki açıklama |
|---|---|---|
| Kapalı (varsayılan) | Tutarlar aynen kalır | "Tutarlar olduğu gibi gönderilir." |
| Etiketle | `[TUTAR_n]` | "Tutarlar etiketlenir; yapay zekâ hesap yapamaz." |
| Orantılı ölçekle | Tek gizli katsayı (3.2.3) | "Tutarlar gizli bir katsayıyla ölçeklenir; oranlar korunur." + 3.2.3 madde 6'daki kalıcı uyarı |

Kasa kilitliyken şalter değiştirilemez (önceden gönderilen tutarlar geri çözülemez hale gelirdi); denemede açıklama gösterilir.

### 5.8 Geri çöz paneli

- Yapıştırılan yanıt, `UnmaskResult` geldiğinde iki sütunlu farkla gösterilir: solda LLM yanıtı (etiketler vurgulu), sağda çözülmüş metin (geri konan değerler vurgulu; düzeltilen ekler ayrıca altı çizili ve ipucunda "in → nın").
- Sorun listesi türe göre sıralı: önce `GROUP_TOKEN` ve `UNKNOWN_TOKEN`, sonra `SUFFIX_UNPARSED`, `LOW_PHON_CONFIDENCE`, `AMOUNT_DERIVED`, `LEFTOVER_MARKER`.
- Çıktı düğmeleri: "Kopyala (hassas)" (4.8), "UDF indir" (imzaya hazır, 3.5.5), "DOCX indir", "TXT indir". Dosya adları nötrdür.
- Kasa süresi dolduysa: "Bu yanıtın etiketleri silinmiş bir oturuma ait. Şifreli kasa dosyanız varsa yükleyin."

### 5.9 Kip seçici: Etiket / Fonetik İkiz

- Etiket kipi varsayılandır.
- İkiz kipinde maskeli metindeki adlar `《Ad Soyad》` biçimindedir; açıklama: "Adlar gerçekçi takma adlarla değiştirilir; yapay zekâ daha doğal yazar. Takma adlar gerçek kişilerle ilgili değildir."
- Kip, kasa kilitlenene kadar değiştirilebilir.

### 5.10 Klavye kısayolları

Tarayıcıya ait kısayollarla çakışmayacak biçimde seçilmiştir (Ctrl+Shift+C, Ctrl+Shift+K, Ctrl+Shift+Delete kullanılmaz).

| Kısayol | İşlev | Bağlam |
|---|---|---|
| Ctrl/Cmd + Enter | Tara ve maskele (sol panel) / Çöz (Geri çöz sekmesi) | Her yerde |
| Ctrl/Cmd + Shift + Enter | Maskeli metni şablonla kopyala | Sızıntı bulgusu yoksa |
| Ctrl/Cmd + S | Çözülmüş belgeyi indir (son seçilen biçim) | Adım 3 |
| F6 / Shift + F6 | Paneller arasında odak geçişi | Her yerde |
| Tab / Shift + Tab | Sonraki / önceki vurgu | İncele görünümü |
| J / K | Sonraki / önceki inceleme bekleyen öğe | İncele görünümü |
| Boşluk | Maskele / maskeleme | Vurgu odaktayken |
| Enter | Ayrıntı penceresi | Vurgu odaktayken |
| R, ardından 1-9 | Rol değiştirici ve hızlı rol | Kişi vurgusu odaktayken |
| C | Kategori değiştir | Vurgu odaktayken |
| A | Seçili metni elle maskele | Metin seçiliyken |
| Delete / Backspace | Bu anmayı kaldır | Vurgu odaktayken |
| Esc | Pencereyi kapat / seçimi bırak | Her yerde |
| ? | Kısayol yardımı | Metin alanı dışında |
| Ctrl/Cmd + Shift + Alt + P | Panik: oturumu onaysız sil ve yeniden yükle | Her yerde |

Tek harfli kısayollar odak bir metin alanındayken çalışmaz.

### 5.11 Hukuki prompt şablonları (`packages/core-engine/src/pipeline/templates.ts`, AGENT-4)

Her şablon şu ortak koruma yönergesiyle başlar (`{{KORUMA}}`):

```text
Aşağıdaki metinde kişisel veriler gizlilik amacıyla yer tutucularla değiştirilmiştir. Kurallar:
1. [DAVACI_1], [ŞİRKET_A], [TCKN_1] gibi köşeli parantezli etiketleri ve 《 》 işaretli adları harfi harfine koru; değiştirme, çevirme, birleştirme, kısaltma ve açıklama yapma.
2. Ek getirmen gerekirse eki etiketin hemen arkasına kesme işaretiyle yaz: [DAVACI_1]'in, [ŞİRKET_A]'ya.
3. Metinde olmayan yeni etiket üretme; gerçek kişi, kurum ya da numara uydurma.
4. Yanıtını Türkçe ver.
```

| Kimlik | Başlık | Gövde (`{{KORUMA}}` ve metin bloğundan sonra) |
|---|---|---|
| `genel` | Genel hukuki değerlendirme | "Görev: Metni bir Türk avukatı gözüyle incele. Hukuki nitelendirmeyi, uygulanabilecek mevzuatı, riskleri ve atılabilecek adımları maddeler halinde açıkla. {{GOREV}}" |
| `dilekce` | Dilekçe taslağı ya da iyileştirme | "Görev: Metni esas alarak Türk usul hukukuna uygun bir dilekçe taslağı hazırla ya da mevcut dilekçeyi iyileştir. Başlık, taraflar, konu, açıklamalar, hukuki nedenler, deliller ve sonuç ve istem bölümlerini kullan. {{GOREV}}" |
| `cevap` | Karşı taraf dilekçesine cevap | "Görev: Metin karşı tarafın dilekçesidir. İddiaları tek tek ele alarak cevap dilekçesi taslağı hazırla; usulden ve esastan itirazları ayır. {{GOREV}}" |
| `sozlesme` | Sözleşme incelemesi | "Görev: Sözleşmeyi incele. Müvekkil aleyhine maddeleri, eksik hükümleri, belirsizlikleri ve önerilen değişiklikleri madde numarasıyla listele. {{GOREV}}" |
| `ozet` | Özet ve zaman çizelgesi | "Görev: Metni özetle; olayları tarih sırasıyla zaman çizelgesi olarak ver; tarafların iddialarını ve dayandıkları delilleri ayrı başlıklarda göster. {{GOREV}}" |
| `serbest` | Serbest görev | "{{GOREV}}" |

Metin bloğu biçimi: `--- METİN BAŞI ---` satırı, maskeli metin, `--- METİN SONU ---` satırı. Kullanıcı şablonları yalnız `localStorage`'da tutulur (içerikleri kişisel veri olmamalıdır; ekranda bu belirtilir).

### 5.12 Temel arayüz metinleri (`i18n/tr.ts`)

| Anahtar | Metin |
|---|---|
| `adim.1` / `adim.2` / `adim.3` | Maskele / Kopyala / Geri çöz |
| `girdi.bos` | Metni yapıştırın ya da .udf, .docx, .txt dosyasını bu alana bırakın. |
| `ner.hazirlaniyor` | Ad tanıma modeli hazırlanıyor (%{p}). Bu sırada kurallar çalışıyor. |
| `ner.kapali` | Ad tanıma modeli kapalı. Kişi ve şirket adlarını gözden geçirin. |
| `sizinti.var` | Maskelenmemiş {n} geçiş bulundu. Kopyalamadan önce inceleyin. |
| `kopyalandi` | Maskeli metin panoya kopyalandı. |
| `kilit` | Etiketler sabitlendi. Yanıt bu etiketlerle çözülecek. |
| `coz.bos` | Yapay zekâ yanıtını buraya yapıştırın. |
| `coz.sorun` | {n} noktayı kontrol edin. |
| `grup.soru` | Bu "{deger}" kimi kastediyor? |
| `ictihat.korunuyor` | Emsal karar künyesi korunuyor. |
| `ictihat.incele` | Bu künye sizin dosyanıza ait olabilir. |
| `pano.web` | Web sürümünde pano geçmişi denetlenemez. Çözülmüş metni dosya olarak indirmeniz önerilir. |
| `oturum.sure` | Oturum {dk} dakika sonra silinecek. |
| `oturum.silindi` | Oturum silindi. |
| `ag.temiz` | Dış bağlantı yok |
| `ag.engellendi` | Dış bağlantı girişimi engellendi: {adres}. Veri gönderilmedi. |
| `not.baglam` | Maskeleme, kişiyi belirleyebilecek olay ayrıntılarını kaldırmaz. Göndermeden önce metni gözden geçirin. |
| `eklenti.uyari` | Tarayıcı eklentileri sayfadaki metni okuyabilir. Hassas belgeler için eklentisiz bir profil ya da masaüstü uygulamasını kullanın. |

Metinler kısa, resmi ve tekrarsızdır; uzun tire içermez (`check:copy`).

### 5.13 Erişilebilirlik

- WCAG 2.1 AA: metin kontrastı en az 4.5:1; odak halkası her zaman görünür; tüm işlevler klavyeyle yapılabilir.
- Vurgular `button` öğesidir; `aria-pressed` maskeleme durumunu, `aria-label` kategori, rol ve durumu söyler.
- Analiz ilerlemesi ve kopyalama sonucu `aria-live="polite"` bölgesinde duyurulur.
- `prefers-reduced-motion` desteklenir.
- Ekran okuyucu ile maskeli metin okunurken etiketler "davacı bir" gibi değil, tam etiket olarak okunur (`aria-label="Davacı 1 etiketi"`).

### 5.14 PWA, çevrimdışı ve güncelleme

- `manifest.webmanifest`: ad MaskeLex, `start_url: /uygulama/`, `display: standalone`, yerel simgeler.
- Service Worker: uygulama kabuğu, yazı tipleri ve ORT WASM dosyaları önbelleğe alınır; model dosyaları ilk kullanımda `CacheFirst` ile alınır (yol sürümlü).
- Yeni sürüm hazır olduğunda arayüz "Yeni sürüm hazır" der; **oturum doluyken otomatik yenileme yapılmaz** (kasa silinirdi). Kullanıcı onaylarsa önce kasa silme uyarısı gösterilir.
- Çevrimdışı kipte üst çubukta "Çevrimdışı çalışıyor" bilgisi gösterilir; işlevler değişmez.

---

## 6. Alt ajan görev dağılımı ve çalıştırma promptları

### 6.0 Fazlar, bağımlılıklar ve çalışma kuralları

```
F0  Orkestratör (ajanlar başlamadan önce, tek dal: main)
    - 1.5'teki monorepo iskeleti; boş ama derlenen modüller
    - contracts.ts ve text/turkish.ts (bu belgedeki haliyle)
    - Bu belgedeki tüm başvuru kodlarının 1.5'teki dosyalara konması (sahibi F1'de devralır)
    - Ek C testlerinin kök test/ klasörüne konması (pnpm test:acceptance); hepsi yeşil
    - testing/index.ts: MockEngine (başvuru modülleri + sahte NER ile çalışan MaskingEngineApi), tohumlu RandomSource
    - worker/engine.worker.ts iskeleti (Comlink expose), pipeline/ iskeleti
    - ESLint (1.8), CI temel (typecheck, lint, test), plan.md, DEVIR.md, DEVIR-PROMPTU.md

F1  Paralel (her ajan kendi dalında)
    AGENT-1  agent/1-core-regex-legal        bağımlılık: yok
    AGENT-2  agent/2-nlp-coref-morph         bağımlılık: yok (NER için sahte model ile başlar)
    AGENT-3  agent/3-document-io             bağımlılık: yok
    AGENT-4  agent/4-ui-web                  bağımlılık: MockEngine (F0)
    AGENT-5  agent/5-security-qa-desktop     bağımlılık: yok (masaüstü kabuğu MockEngine'li web derlemesiyle başlar)

F2  Entegrasyon (orkestratör)
    - pipeline/engine.ts gerçek portlara bağlanır; AGENT-4 MockEngine'den gerçeğe geçer
    - AGENT-5 altın seti ve e2e'yi gerçek motorla koşar; eşik raporu
    - Eşik altı kalan alanlar ilgili ajana geri döner

F3  Denetim ve yayın
    - Bağımsız denetim (6.6): kodu yazmamış ayrı bir ajan yalnız engelleyici riskleri arar
    - Sahibin elle kabulü: V-02, V-03 (UYAP Doküman Editörü), V-06, V-07
    - Web yayını (sahip push eder) ve imzalı masaüstü sürümü (S-03)
```

**Ortak kurallar (her ajan):**

1. Yalnız kendi yazma kapsamındaki dosyaları değiştirir. Kapsam dışı bir değişiklik gerekiyorsa `docs/contract-requests/AGENT-<n>-<konu>.md` yazar ve orkestratöre bildirir.
2. Her alt görev bitince commit atar (küçük, Türkçe, açıklayıcı ileti). İşi sona yığmaz (surec.md 10).
3. Push'u sahip yapar; ajan push gerektiğinde tek satırlık komutu ve neyi getireceğini yazar.
4. Sırlar (imza sertifikası, Apple kimlikleri) asla repoya, sohbete, loga yazılmaz; yalnız GitHub Secrets'ta durur ve sahip girer.
5. Test verisinde gerçek kişi verisi yoktur. Kimlik numaraları üreticilerle, adlar sözlükten tohumlu üretilir.
6. Uzun tire (U+2014) ve kısa tire (U+2013) kullanılmaz; Türkçe karakterler korunur.
7. Paket sonu raporu 3-5 satırdır: **Bitti**, **Testler** (komut ve sonuç), **Açık riskler**, **Sahibin yapacakları**.
8. Kontrat değişikliği gerekirse kod yazmayı durdurur, istek dosyasını yazar, bekler.

### 6.1 AGENT-1 (Core-Regex-Legal)

**Görev:** Katman 1 (sağlamalı kimlikler, iletişim, plaka, doğum tarihi, pasaport, uzun numara), Katman 2'nin numara tarafı (dosya no, tapu, yevmiye, kanun atfı), İçtihat Koruma Filtresi, adres kural motoru ve Tutar Şaşırtma.

**Yazma kapsamı:**
`packages/core-engine/src/validators/**`, `src/detectors/deterministic/**`, `src/legal/**`, `src/fuzz/**`, `src/text/numberWords.ts`, `packages/core-engine/test/a1/**`, kendi ADR'leri.

**Salt okunur:** Diğer her şey; özellikle `src/types/contracts.ts`, `src/text/turkish.ts`, `src/pipeline/**`.

**Girdi / çıktı kontratı:**
- `DeterministicDetectorPort.detect(text, ctx): DetectorOutput`: senkron, saf, yan etkisiz. `matches` aralıkları ek içermez; `layer` `L1_CHECKSUM` ya da `L2_LEGAL`; `docId` bağlamdan.
- `ProtectedSpan`: içtihat künyeleri (`ICTIHAT_KUNYESI`, gerekirse `ownCaseSuspect`), kanun atıfları (`KANUN_ATFI`), künyedeki başvurucu adı kalıpları (3.2.2).
- `AmountFuzzerPort`: `findAmounts`, `pickScale(rng, range)`, `scale(text, hits, k): TextEdit[]`.

**Teslimatlar:**
1. Başvuru uygulamasını (3.1.4) devral, Ek C t1/t4/t5 ve t7'nin tutar kısmını yeşil göster.
2. 1.5'teki modüllere böl; `index.ts` portu uygular; `reference.ts` silinmez, testlerin karşılaştırma kaynağı olarak kalır.
3. Adres kural motoru (3.1.5), pasaport ve uzun numara dedektörleri.
4. AİHM/AYM künye içi başvurucu adı koruması (3.2.2 son paragraf).
5. Tutar Şaşırtma'nın üretim hali (3.2.3), yazıyla tutar dahil.
6. Performans ölçüm betiği ve ReDoS denetimi.

**Kabul kriterleri (Definition of Done):**
- Ek C t1, t4, t5, t7 (tutar) yeşil.
- Yeni birim testleri: adres en az 40, plaka (olumlu ve negatif bağlam) en az 30, telefon biçimleri en az 30, dosya/tapu/yevmiye varyantları en az 30, tutar biçimleri en az 25 (`1.250.000.-TL`, `₺125.000`, `USD 5.000`, yazıyla tutar), büyük harfli başlık varyantları en az 15.
- Özellik testleri (fast-check): üretilen geçerli TCKN/VKN/IBAN her zaman bulunur; tek hane bozulmuş numara aynı kategoride bulunmaz; rastgele 11 hane yalnız sağlaması geçerliyse TCKN olur.
- Altın set (Ek A) eşikleri: L1 kategorilerinde duyarlılık 1,00 ve kesinlik en az 0,99; `mustKeep` aralıklarında yanlış maskeleme 0; plaka duyarlılık en az 0,98 ve kesinlik en az 0,95; adres duyarlılık en az 0,95 ve kesinlik en az 0,90.
- Performans: 100.000 karakterlik sentetik belgede `detect` en çok 300 ms (CI makinesinde ölçüm, rapora yazılır).
- ReDoS: her desen 50.000 karakterlik kötü niyetli girdide (uzun rakam dizileri, tekrarlayan boşluk ve nokta) 50 ms altında biter.
- Kaynakta lookbehind yok; Türkçe harf içeren desende `/i` yok (CI testi).

**Başlangıç promptu:**

```text
Sen MaskeLex projesinde AGENT-1 (Core-Regex-Legal) olarak çalışan kıdemli bir TypeScript geliştiricisisin.

BAĞLAM
MaskeLex, Türk avukatlarının belgelerindeki kişisel verileri tamamen cihaz içinde maskeleyen ve LLM yanıtını geri
çözen bir uygulamadır. Tek doğruluk kaynağı repodaki MASTER.md'dir. Başlamadan önce şu bölümleri oku:
0 (kararlar), 1.8 (kodlama kuralları), 2 (contracts.ts), 3.0, 3.1, 3.2, 4.1, 6.0, 6.1, Ek A ve Ek C (t1, t4, t5, t7).

GÖREVİN
Katman 1 (sağlamalı kimlik, iletişim, plaka, doğum tarihi, pasaport, uzun numara), Katman 2'nin numara tarafı
(dosya no, tapu, yevmiye, kanun atfı), İçtihat Koruma Filtresi, adres kural motoru ve Tutar Şaşırtma modüllerini
üretim kalitesinde teslim etmek. MASTER.md'deki başvuru kodları test edilmiştir; onları devral, sertleştir, eksikleri yaz.

YAZABİLECEĞİN YERLER (yalnız bunlar)
packages/core-engine/src/validators/**, src/detectors/deterministic/**, src/legal/**, src/fuzz/**,
src/text/numberWords.ts, packages/core-engine/test/a1/**, docs/adr/ altında kendi ADR'lerin.
Diğer her dosya salt okunurdur. contracts.ts değişikliği gerekiyorsa kodu değiştirme;
docs/contract-requests/AGENT-1-<konu>.md yaz ve bekle.

ADIMLAR
1. Dal: agent/1-core-regex-legal. Ek C testlerinin (t1, t4, t5, t7) yeşil olduğunu göster, commit at.
2. reference.ts'yi 1.5'teki modüllere böl; index.ts DeterministicDetectorPort'u uygulasın; toContract ile EntityMatch üret.
3. Adres motoru (MASTER 3.1.5), pasaport, uzun numara; AİHM/AYM başvurucu adı koruması (3.2.2).
4. Tutar Şaşırtma üretim hali (3.2.3); AmountFuzzerPort.
5. Testler ve ölçümler (6.1 kabul kriterleri); performans ve ReDoS betiği.
Her adımın sonunda commit at.

KESİN KURALLAR
- Lookbehind (?<= (?<! YASAK; sınırlar leftBoundary/rightBoundary ile.
- Türkçe harf içeren büyük/küçük harf duyarsız arama /i ile YAPILMAZ; lowerView() + küçük harfli desen.
- Math.random YASAK; RandomSource kullan.
- Kullanıcı metni hiçbir log'a, hata iletisine yazılmaz.
- Şüphede maskele (K-07), içtihatta koru (K-06): yüksek mahkeme künyesi hiçbir koşulda MASKELE kararı almaz.
- Test verisinde gerçek kişi verisi yok; numaraları checksums.ts üreticileriyle üret.
- Uzun tire kullanma.

TESLİM VE RAPOR
Her paket sonunda 3-5 satır: Bitti / Testler (komut ve sonuç) / Açık riskler / Sahibin yapacakları.
Bitti sayılması için MASTER.md 6.1'deki tüm kabul kriterleri CI'da yeşil olmalı.
```

### 6.2 AGENT-2 (NLP-Coref-Morphology)

**Görev:** NER Web Worker entegrasyonu, kural tabanlı ad/şirket dedektörü, varlık tekilleştirme (coreference), Türkçe çekim eki motoru, Fonetik İkiz, geri çözme; ad ve ikiz sözlükleri.

**Yazma kapsamı:**
`packages/core-engine/src/ner/**`, `src/names/**`, `src/coref/**`, `src/morphology/**`, `src/twins/**`, `src/unmask/**`, `packages/core-engine/test/a2/**`, `scripts/fetch-model.mjs`, `scripts/build-lexicons.mjs`, `docs/sources/ner-model.md`, `docs/sources/lexicons.md`, `docs/adr/0003-ner-model-secimi.md`.

**Salt okunur:** Diğer her şey; özellikle `contracts.ts`, `text/turkish.ts`, `text/numberWords.ts`, `pipeline/**`, `fuzz/**`.

**Girdi / çıktı kontratı:**
- `NerPort` (worker istemcisi; 3.3.2 iletileri), `NameRuleDetectorPort`, `CorefPort`, `MorphologyPort`, `TwinPort`, `RehydratorPort` (`toUnmaskView` ile).
- NER worker hiçbir kasa verisi görmez; yalnız metin alır, `PER/ORG/LOC` aralıkları döndürür.

**Teslimatlar:**
1. Başvuru kodlarını devral (3.3.5 persons.ts, 3.4.3 morphology.ts, 3.4.4 rehydrate.ts, 3.4.5 twins.ts); Ek C t2, t6, t7, t9 yeşil.
2. Model seçimi: 3.3.1 ölçütleriyle en az iki adayı ölç; ADR ve lisans kaydı (V-04); `fetch-model.mjs` (SHA-256 doğrulamalı).
3. NER worker: ön belirteçleme, pencereleme, BIO birleştirme, etiket eşleme (3.3.3); iptal ve ilerleme olayları.
4. Kural tabanlı dedektör K1-K8 ve dışlamalar (3.3.4).
5. `coref/orgs.ts` ve `coref/index.ts` (CorefPort; rol oylaması, cinsiyet, grup etiketleri).
6. Sözlükler: lisanslı kaynaktan ad (cinsiyetli), soyadı, ikiz adayları, şirket terimleri (V-05); `build-lexicons.mjs`; sınıf kapsama raporu.
7. Morfoloji sözlükleri: damak l'si istisnaları, okunuş sözlüğü, açılımlı kısaltmalar, iyelikli baş sözcükler genişletilir (kaynaklı).

**Kabul kriterleri:**
- Ek C t2, t6, t7, t9 yeşil.
- Morfoloji: en az 300 ek vakası (her biçimbirim, her uyum sınıfı, sayı, kısaltma, n kaynaştırmalı gövde); idempotans özellik testi (`rehydrate(rehydrate(x)) = rehydrate(x)`).
- Ek ayrıştırma: LLM'in yazabileceği tüm tek ve ikili biçimbirim zincirleri (üretilerek) doğru ayrıştırılır.
- Coref: en az 20 senaryo; soyadı çakışmasında yanlış otomatik bağlama 0; altın sette kişi kümeleme B³ F1 en az 0,95.
- NER hizalama: sahte modelle (deterministik etiketler) kesme işaretli, büyük harfli, noktalama bitişik Türkçe metinde karakter ofsetleri birebir doğru; pencere sınırında bölünen varlık birleşir.
- Gerçek modelle (gece CI işi) altın sette KİŞİ F1 en az 0,90, ŞİRKET F1 en az 0,80 (kural katmanıyla birlikte).
- İkiz: atanan her ikiz için `phonKey(ikiz adı) = phonKey(özgün ad)` ve `phonKey(ikiz soyadı) = phonKey(özgün soyadı)` (özellik testi); aile soyadı tutarlılığı; belgedeki gerçek adlar asla ikiz olmaz.
- Geri çözme: Ek A'daki tüm `unmask` vakaları birebir; bozulmuş etiket varyantları en az 25 vaka; 20.000 karakterlik yanıt en çok 100 ms.
- Ağ: `src/ner/**` dışındaki hiçbir dosya ağ API'si kullanmaz; worker yalnız `/models/` ve `/ort/` ister (test).

**Başlangıç promptu:**

```text
Sen MaskeLex projesinde AGENT-2 (NLP-Coref-Morphology) olarak çalışan, Türkçe biçimbilim ve tarayıcı içi makine
öğrenmesi konusunda deneyimli kıdemli bir TypeScript geliştiricisisin.

BAĞLAM
MaskeLex, avukat belgelerindeki kişisel verileri cihaz içinde maskeler ve LLM yanıtını Türkçe ek uyumuyla geri çözer.
Tek doğruluk kaynağı MASTER.md'dir. Önce oku: 0, 1.2, 1.8, 2, 3.0, 3.3, 3.4, 4.1, 4.5, 6.0, 6.2, Ek A, Ek C (t2, t6, t7, t9).

GÖREVİN
NER Web Worker'ı, kural tabanlı ad/şirket dedektörünü, varlık tekilleştirmeyi, çekim eki motorunu, Fonetik İkiz'i
ve geri çözmeyi üretim kalitesinde teslim etmek. MASTER.md'deki başvuru kodları (persons.ts, morphology.ts,
rehydrate.ts, twins.ts) derlenmiş ve test edilmiştir; onları devral, portlara bağla, eksikleri yaz.

YAZABİLECEĞİN YERLER (yalnız bunlar)
packages/core-engine/src/ner/**, src/names/**, src/coref/**, src/morphology/**, src/twins/**, src/unmask/**,
packages/core-engine/test/a2/**, scripts/fetch-model.mjs, scripts/build-lexicons.mjs,
docs/sources/ner-model.md, docs/sources/lexicons.md, docs/adr/0003-ner-model-secimi.md.
Diğer her dosya salt okunurdur. Kontrat değişikliği için docs/contract-requests/AGENT-2-<konu>.md yaz ve bekle.

ADIMLAR
1. Dal: agent/2-nlp-coref-morph. Ek C t2, t6, t7, t9'u yeşil göster; commit.
2. MorphologyPort, CorefPort (persons + orgs), TwinPort, RehydratorPort; MASTER 3.3.5, 3.4.
3. NameRuleDetectorPort: K1-K8 ve dışlamalar (3.3.4).
4. NER: model adaylarını 3.3.1 ölçütleriyle ölç, ADR yaz; worker, ön belirteçleme, pencereleme, BIO (3.3.2-3.3.3).
   Önce sahte modelle hizalama testleri; gerçek model gece CI işinde.
5. Sözlükler: lisansı doğrulanmış kaynaklar (uydurma liste YOK); build-lexicons.mjs; kapsama raporu.
Her adımın sonunda commit at.

KESİN KURALLAR
- Soyadı çakışmasında yalnız soyadı ile anma ASLA tahminle bağlanmaz; rol/cinsiyet tek adaya indirmiyorsa grup etiketi.
- İkiz, ses anahtarı tutmuyorsa VERİLMEZ (etiket kipinde kalır). İkiz seçimi RandomSource ile, özgün addan türetilmez.
- Transformers.js: allowRemoteModels=false, localModelPath ve wasmPaths aynı köken. Hiçbir CDN yok.
- NER worker kasa verisi görmez. Kullanıcı metni log'a yazılmaz. Math.random yasak. Lookbehind yasak.
- Türkçe büyük/küçük harf işlemleri trLower/trUpper/lowerView/foldKey ile.
- Model ve sözlük lisansı doğrulanmadan kullanılmaz; kaynak ve lisans docs/sources'a yazılır.
- Uzun tire kullanma.

TESLİM VE RAPOR
Her paket sonunda 3-5 satır: Bitti / Testler / Açık riskler / Sahibin yapacakları.
Bitti sayılması için MASTER.md 6.2'deki tüm kabul kriterleri CI'da yeşil olmalı.
```

### 6.3 AGENT-3 (Document-IO)

**Görev:** `.udf` (UYAP XML + ofset yeniden hesaplama) ve `.docx` okuyucu/yazıcı, düz metin ve Markdown → AST.

**Yazma kapsamı:** `packages/document-parsers/**` (tamamı), `docs/sources/udf-format.md`, `docs/adr/0002-udf-cerrahi-yazim.md`, `docs/adr/0004-docx-yazici.md`.

**Salt okunur:** Diğer her şey; özellikle `contracts.ts`.

**Girdi / çıktı kontratı:** `DocumentCodec` (udf, docx, txt, md), `MarkdownToAst`, `TextEdit` ön koşulları (3.5.2). Hiçbir DOM API'si kullanılmaz (Web Worker'da çalışır).

**Teslimatlar:**
1. Başvuru kodlarını devral (3.5.2 remap.ts, 3.5.3 contentXml.ts); Ek C t3 yeşil.
2. UDF: zip.ts (sınırlar, girdi politikası 3.5.6), reader.ts (3.5.4, ofset birimi tespiti V-01), writer.ts (3.5.5 a ve b), codec.ts.
3. DOCX: reader.ts (3.5.7: izlenen değişiklik, alan kodu, dipnot, üst/alt bilgi, yorum seçenekleri), writer.ts (3.5.8 temiz üretim), codec.ts.
4. plaintext.ts ve markdown.ts (3.5.9).
5. Sentetik fikstürler ve sahibin gerçek UDF örnekleriyle elle kabul tutanağı (V-02, V-03).

**Kabul kriterleri:**
- Ek C t3 yeşil.
- UDF fikstürleri en az 15 (tablo, görsel, boş paragraf, çoklu CDATA, iki stile yayılan ad, büyük harfli başlık, imzalı paket, `documentproperties.xml`'li paket).
- Tam tur özellik testi: rastgele düzenleme kümeleriyle `geriÇöz(maskele(udf))` metni özgünle aynı ve `validateContentXml` boş.
- Markdown'dan üretilen UDF ve DOCX kendi okuyucumuzla geri okunduğunda metin aynı.
- DOCX: silinmiş metin (`w:delText`) çıkarılan metinde YOK; yorumlar varsayılan YOK; `docProps/core.xml` çıktısında `creator`, `lastModifiedBy`, tarih YOK (test).
- Maskeli UDF dışa aktarımında `sign.sgn` ve `documentproperties.xml` YOK; dosya adı nötr (test).
- ZIP bombası ve 50 MB üstü girdi reddi (test).
- 50 sayfalık UDF okuma + yazma en çok 1 s.
- Sahibin elle kabulü: 10 gerçek UDF'nin maskeli ve çözülmüş çıktıları UYAP Doküman Editörü'nde sorunsuz açılır (V-02); sonuç `docs/sources/udf-format.md`'de.

**Başlangıç promptu:**

```text
Sen MaskeLex projesinde AGENT-3 (Document-IO) olarak çalışan, dosya biçimleri ve XML konusunda deneyimli kıdemli
bir TypeScript geliştiricisisin.

BAĞLAM
MaskeLex, UYAP .udf ve Word .docx belgelerini cihaz içinde okuyup maskeler; LLM yanıtından imzaya hazır .udf/.docx
üretir. Tek doğruluk kaynağı MASTER.md'dir. Önce oku: 0 (özellikle D-01, V-01..V-03), 1.8, 2 (DocumentAST,
DocumentCodec, TextEdit), 3.5 (tamamı), 4.1, 6.0, 6.3, Ek C (t3).

GÖREVİN
packages/document-parsers paketini üretim kalitesinde teslim etmek: UDF okuma, ofset yeniden hesaplamalı cerrahi
yazım, sıfırdan UDF üretimi, DOCX okuma ve temiz DOCX üretimi, Markdown ve düz metin → AST.
MASTER.md'deki remap.ts ve contentXml.ts derlenmiş ve test edilmiştir; devral ve genişlet.

YAZABİLECEĞİN YERLER (yalnız bunlar)
packages/document-parsers/** (tamamı), docs/sources/udf-format.md, docs/adr/0002-udf-cerrahi-yazim.md,
docs/adr/0004-docx-yazici.md. Diğer her dosya salt okunurdur.
Kontrat değişikliği için docs/contract-requests/AGENT-3-<konu>.md yaz ve bekle.

ADIMLAR
1. Dal: agent/3-document-io. Ek C t3'ü yeşil göster; commit.
2. UDF: zip.ts, reader.ts (ofset birimi tespiti dahil), writer.ts (maskeli dışa aktarım ve sıfırdan üretim), codec.ts.
3. DOCX: reader.ts, writer.ts, codec.ts. 4. plaintext.ts, markdown.ts.
5. Fikstürler, özellik testleri, performans; sahibe V-02/V-03 için adım adım elle test yönergesi hazırla.
Her adımın sonunda commit at.

KESİN KURALLAR
- XML'i ayrıştırıp yeniden serileştirme YOK: UDF'de yalnız CDATA ve startOffset/length değerleri değişir,
  bilinmeyen öğe ve öznitelikler bayt bayt korunur.
- DOMParser ve hiçbir DOM API'si yok (Web Worker). XML okuma için kendi tarayıcın ya da saxes.
- Düzenlemeler satır sonu ve yer tutucu içeremez; ihlalde E_EDIT_INVALID.
- Maskeli dışa aktarımda sign.sgn ve documentproperties.xml düşürülür; DOCX özgün paketten kopyalanmaz.
- Çıktı dosya adı daima nötr; özgün dosya adı hiçbir çıktıya yazılmaz.
- Fikstürlerde gerçek kişi verisi YOK. Uydurma biçim bilgisi yok: emin olmadığın UDF alanını koru, değiştirme.
- Uzun tire kullanma.

TESLİM VE RAPOR
Her paket sonunda 3-5 satır: Bitti / Testler / Açık riskler / Sahibin yapacakları.
Bitti sayılması için MASTER.md 6.3'teki tüm kabul kriterleri yeşil ve sahibin V-02 kabulü kayıtlı olmalı.
```

### 6.4 AGENT-4 (UI-UX-Web)

**Görev:** Bölünmüş ekran etkileşimli düzenleyici, renkli vurgulama, rol değiştirici, tutar şalteri, geri çöz paneli, Ağ Denetçisi, Trusted Types ve girdi sertleştirme, PWA, web platform bağdaştırıcısı, tanıtım sayfaları, prompt şablonları, i18n.

**Yazma kapsamı:** `apps/web/**` (deploy/ hariç), `packages/core-engine/src/pipeline/templates.ts`.

**Salt okunur:** Diğer her şey; özellikle `contracts.ts`, `testing/**` (MockEngine), `apps/web/deploy/**`.

**Girdi / çıktı kontratı:** Arayüz motorla yalnız `MaskingEngineApi` üzerinden (Comlink) konuşur; kasa nesnesi asla ana iş parçacığına gelmez. Yan etkiler `PlatformAdapter` ile. Ağ olayları `NetworkEvent`.

**Teslimatlar:**
1. `engineClient.ts`: iki worker'ı başlatır, `MessageChannel` ile NER ve Engine worker'larını bağlar, Comlink sarmalayıcı; F1'de MockEngine, F2'de gerçek motor.
2. 5.1-5.10'daki tüm bileşenler, durum makinesi, kısayollar.
3. 4.4 Trusted Types, 4.5 Ağ Denetçisi (ana iş parçacığı ve worker kurulumu), 4.6 girdi sertleştirme.
4. `webAdapter.ts` (pano, dosya indirme, kapatma koruması, hardReset).
5. PWA (5.14): elle kayıt, önbellek stratejisi, oturum doluyken yenilememe.
6. Şablonlar (5.11), i18n (5.12), tanıtım sayfaları ve SEO (surec.md 8; `/uygulama/` noindex), KVKK ve Güvenlik sayfaları (0.6 diliyle).
7. `vite.config.ts`: çok sayfa, worker, `--mode desktop` (Service Worker yok, `@platform` takma adı).

**Kabul kriterleri:**
- Playwright (AGENT-5 ile): 375 px ve 1440 px'te tüm akış; yalnız klavyeyle tüm akış; yatay taşma yok.
- axe-core taramasında ciddi (serious/critical) erişilebilirlik ihlali 0.
- Derleme çıktısında satır içi betik yok (`<script>` öğelerinin hepsi `src` taşır; test).
- Akış boyunca CSP ihlali 0; Ağ Denetçisi testleri (4.11 madde 8) yeşil.
- 1.000 paragraflık belgede kaydırma akıcı (60 fps hedefi), ilk vurgulama 500 ms içinde.
- Sızıntı bulgusu varken Kopyala düğmesi devre dışı; bulgular tek tek onaylanınca etkin (test).
- Kasa kilitliyken tutar şalteri ve ham metin düzenlemesi kapalı (test).
- `check:copy` yeşil (i18n'de uzun tire yok).

**Başlangıç promptu:**

```text
Sen MaskeLex projesinde AGENT-4 (UI-UX-Web) olarak çalışan, React, erişilebilirlik ve tarayıcı güvenliği konusunda
deneyimli kıdemli bir ön yüz geliştiricisisin.

BAĞLAM
MaskeLex, avukat belgelerindeki kişisel verileri cihaz içinde maskeleyen bir web (PWA) ve masaüstü uygulamasıdır.
Tek doğruluk kaynağı MASTER.md'dir. Önce oku: 0 (özellikle 0.6 ürün dili), 1 (tamamı), 2, 3.0, 3.2.3, 4 (tamamı),
5 (tamamı), 6.0, 6.4.

GÖREVİN
apps/web uygulamasını teslim etmek: bölünmüş ekran etkileşimli düzenleyici, renkli vurgulama, Hukuki Rol Değiştirici,
Tutar Şaşırtma şalteri, Fonetik İkiz kip seçici, geri çöz paneli, Canlı Ağ Denetçisi, Trusted Types, girdi
sertleştirme, PWA, web platform bağdaştırıcısı, prompt şablonları, tanıtım sayfaları.
F1'de MockEngine (packages/core-engine/src/testing) ile çalış; F2'de gerçek motora geç.

YAZABİLECEĞİN YERLER (yalnız bunlar)
apps/web/** (apps/web/deploy/ hariç) ve packages/core-engine/src/pipeline/templates.ts.
Diğer her dosya salt okunurdur. Kontrat değişikliği için docs/contract-requests/AGENT-4-<konu>.md yaz ve bekle.

ADIMLAR
1. Dal: agent/4-ui-web. vite.config.ts (çok sayfa, worker, desktop modu), main.tsx'te önce trustedTypes ve
   networkMonitor kurulumu; engineClient.ts ile MockEngine'e bağlan; commit.
2. Durum makinesi ve iskelet (5.1, 5.2); InputPanel, ReviewView (sanallaştırma), EntityChip, EntityPopover.
3. MaskedPanel + sızıntı bulguları + şablonlar; UnmaskPanel + IssueList; kısayollar (5.10).
4. Ağ Denetçisi arayüzü, oturum zamanlayıcısı, kasa görünümü, şifreli kasa yükle/kaydet akışı.
5. PWA, tanıtım sayfaları, KVKK ve Güvenlik sayfaları, i18n; erişilebilirlik ve Playwright testleri.
Her adımın sonunda commit at.

KESİN KURALLAR
- Kasa nesnesi ana iş parçacığına gelmez; yalnız AnalysisResult, MaskedOutput, UnmaskResult görüntülenir.
- innerHTML, dangerouslySetInnerHTML, eval, new Function, satır içi betik YASAK. Kullanıcı metni yalnız metin düğümü.
- fetch/XHR/WebSocket/sendBeacon kullanma (ağ yasağı R-06). Pano ve dosya yalnız PlatformAdapter ile.
- Sızıntı bulgusu varken kopyalama engellenir. Oturum doluyken otomatik sayfa yenileme yok.
- Tüm metin alanlarında 4.6 öznitelikleri. Renk tek başına anlam taşımaz.
- Ürün dili: "anonimleştirme garantisi", "KVKK'ya tam uyum" gibi ifadeler YASAK (MASTER 0.6).
- Arayüz metinleri yalnız i18n/tr.ts'de; kısa, resmi; uzun tire yok. Asistan logo üretmez (sahibin logosu, S-02).

TESLİM VE RAPOR
Her paket sonunda 3-5 satır: Bitti / Testler / Açık riskler / Sahibin yapacakları.
Bitti sayılması için MASTER.md 6.4'teki tüm kabul kriterleri yeşil olmalı.
```

### 6.5 AGENT-5 (Security-QA-Desktop)

**Görev:** Tauri v2 masaüstü sarmalayıcısı ve güvenlik kilidi, web sunucu başlıkları ve dağıtım dosyaları, kasa deposu ve şifreleme, kriptografik rastgelelik, uçtan uca Türkçe hukuki metin test seti (Golden Test Suite), e2e güvenlik testleri, CI ve sürüm iş akışları.

**Yazma kapsamı:** `apps/desktop-tauri/**`, `apps/web/deploy/**`, `packages/test-corpus/**`, `packages/core-engine/src/vault/**`, `packages/core-engine/src/text/random.ts`, `packages/core-engine/test/a5/**`, `e2e/**`, `.github/workflows/**`, `scripts/check-copy.mjs`.

**Salt okunur:** Diğer her şey.

**Girdi / çıktı kontratı:** `VaultStorePort`, `EncryptedVaultFile`, `RandomSource`, `PlatformAdapter` (masaüstü), `GoldenCase`. Altın set tüm ajanların testlerinde kullanılır.

**Teslimatlar:**
1. Tauri v2 projesi (4.3): `tauri.conf.json`, capabilities, üç Rust komutu (`kaydet`, `pano_yaz`, `pano_temizle`), `clipboard.rs` (4.8), `entitlements.plist`, `deny.toml`, `tauriAdapter.ts`.
2. Web dağıtımı: Dockerfile, nginx.conf, security-headers.conf (4.2), `surum.json` üretimi.
3. `vault/store.ts` (yaşam döngüsü ve silme 4.7), `vault/crypto.ts` (şifreli dışa/içe aktarım), `text/random.ts`.
4. Altın test seti (Ek A): üreticiler, en az 12 belge türü, F1 sonunda en az 120 vaka, F2 sonunda en az 300 vaka; çalıştırıcı ve ölçüt raporu (CI çıktısı).
5. e2e: 4.11'deki 1-8; Playwright 375 px ve 1440 px akışları (AGENT-4 ile).
6. CI (`ci.yml`) ve sürüm (`release-desktop.yml`, imza sırları GitHub Secrets'ta, sahip girer); `check-copy.mjs`.
7. Elle doğrulamalar: V-06, V-07 ve macOS sandbox altında ağ isteğinin işletim sistemince reddedildiğinin gösterilmesi; tutanaklar `DEVIR.md`'ye.

**Kabul kriterleri:**
- Windows ve macOS CI derlemesi yeşil; `cargo deny check` yeşil; Tauri yapılandırma anlık görüntü testleri yeşil.
- Masaüstünde web ile aynı akış çalışır: sürükle-bırak (`dragDropEnabled: false`), kaydetme penceresi, gizli pano, NER (gömülü model).
- Kasa: Ek C t10 yeşil (şifrele/çöz tam turu; yanlış parola ve değiştirilmiş dosya reddi; tur sayısı 600.000'in altındaki dosya reddi); silme sonrası `E_NO_SESSION`.
- `RandomSource`: `crypto.getRandomValues` ile; tohumlu test kaynağı yalnız `testing` ve test klasörlerinden içe aktarılabilir (ESLint).
- 4.11 testleri 1-8 CI'da yeşil.
- Altın set raporu her CI koşusunda üretilir; Ek A eşikleri F2 sonunda sağlanır.
- `check:copy` tüm `md`, `i18n` ve HTML dosyalarında uzun ve kısa tireyi yakalar.

**Başlangıç promptu:**

```text
Sen MaskeLex projesinde AGENT-5 (Security-QA-Desktop) olarak çalışan, uygulama güvenliği, Tauri/Rust ve test
otomasyonu konusunda deneyimli kıdemli bir mühendissin.

BAĞLAM
MaskeLex, avukat belgelerindeki kişisel verileri cihaz içinde maskeleyen bir web (PWA) ve Tauri v2 masaüstü
uygulamasıdır. Sıfır sunucu (zero-knowledge) iddiasının teknik güvencesi senin işindir. Tek doğruluk kaynağı
MASTER.md'dir. Önce oku: 0 (özellikle K-13, K-16, V-06, V-07), 1, 2, 3.0.4, 4 (tamamı), 6.0, 6.5, Ek A, Ek C.

GÖREVİN
Tauri v2 masaüstü sarmalayıcısını ve güvenlik kilidini (CSP, başlıklar, izinler, macOS sandbox, cargo-deny,
gizli pano), web sunucu başlıklarını ve dağıtım dosyalarını, kasa deposunu ve şifrelemeyi, kriptografik
rastgeleliği, Türkçe hukuki metin altın test setini, e2e güvenlik testlerini ve CI/sürüm iş akışlarını teslim etmek.

YAZABİLECEĞİN YERLER (yalnız bunlar)
apps/desktop-tauri/**, apps/web/deploy/**, packages/test-corpus/**, packages/core-engine/src/vault/**,
packages/core-engine/src/text/random.ts, packages/core-engine/test/a5/**, e2e/**, .github/workflows/**,
scripts/check-copy.mjs. Diğer her dosya salt okunurdur.
Kontrat değişikliği için docs/contract-requests/AGENT-5-<konu>.md yaz ve bekle.

ADIMLAR
1. Dal: agent/5-security-qa-desktop. random.ts, vault/store.ts, vault/crypto.ts ve testleri; commit.
2. Altın set üreticileri ve ilk 120 vaka (Ek A); çalıştırıcı ve ölçüt raporu; CI'a bağla.
3. Tauri projesi: MASTER 4.3'teki yapılandırma birebir; üç Rust komutu; tauriAdapter.ts; anlık görüntü testleri.
4. Web dağıtımı (4.2, 4.10) ve check-copy.mjs; ci.yml ve release-desktop.yml.
5. e2e güvenlik testleri (4.11); elle doğrulamalar (V-06, V-07, sandbox) ve tutanaklar.
Her adımın sonunda commit at.

KESİN KURALLAR
- updater, http, shell, opener, fs eklentileri YOK. JS keyfi yola yazamaz; kaydetme penceresi Rust tarafında açılır.
- macOS entitlements'ta network.client YOK. CSP'de 'unsafe-eval' ve 'unsafe-inline' YOK.
- Sırlar (imza sertifikası, Apple kimlikleri) asla repoya, loga, sohbete yazılmaz; yalnız GitHub Secrets, sahip girer.
  Satın alma gerektiren adımlar (S-03) sahibin açık onayıyla.
- Test verisinde gerçek kişi verisi YOK; tüm numaralar üreticilerle, adlar sözlükten tohumlu.
- Bellek silme "en iyi çaba"dır; arayüzde ve belgede bundan fazlası vaat edilmez.
- Uzun tire kullanma.

TESLİM VE RAPOR
Her paket sonunda 3-5 satır: Bitti / Testler / Açık riskler / Sahibin yapacakları (push komutu, Secrets, satın almalar).
Bitti sayılması için MASTER.md 6.5'teki tüm kabul kriterleri yeşil olmalı.
```

### 6.6 Entegrasyon ve bağımsız denetim

**Orkestratörün F2 kontrol listesi:**

1. `pipeline/engine.ts` gerçek portlarla kurulur; MockEngine yalnız testlerde kalır.
2. Tam tur: altın setteki her belge için `geriÇöz(maskele(x))`, LLM yanıtı yerine maskeli metnin kendisi verildiğinde özgün metni birebir verir.
3. Altın set eşikleri (Ek A) sağlanır; sağlanmayan alan ilgili ajana iş olarak döner.
4. 4.11 testleri yeşil; Playwright 375/1440 yeşil.
5. `DEVIR.md` ve `DEVIR-PROMPTU.md` güncellenir; sahibe push öncesi yapılacaklar listesi verilir (S-01 barındırma, Cloudflare ayarları 4.10, imza sırları).

**Bağımsız denetim promptu (F3; kodu yazmamış yeni bir ajan):**

```text
Sen MaskeLex kodunu yazmamış bağımsız bir uygulama güvenliği denetçisisin. Repodaki MASTER.md'yi (özellikle 0.6,
1.8, 3.0.4, 4) ve kodu oku. Yalnız ENGELLEYİCİ riskleri ara; üslup ve küçük iyileştirmeleri raporlama.

Denetlenecekler:
1. Kullanıcı metninin, kasanın ya da türevinin cihaz dışına çıkabileceği her yol (ağ API'leri, WebRTC, form,
   yönlendirme, Service Worker, Rust komutları, loglar, hata iletileri, dosya adları, pano).
2. CSP, Trusted Types ve başlıkların MASTER 4.2/4.3 ile birebir aynılığı; satır içi betik; CDN kalıntısı.
3. Sızıntı denetiminin (3.0.4) atlatılabildiği durumlar; kopyalama engelinin arayüzden aşılması.
4. İçtihat Koruma Filtresi'nin yüksek mahkeme künyesini maskeleyebildiği bir girdi; yerel dosya numarasını
   korumaya alabildiği bir girdi.
5. Soyadı çakışmasında yanlış kişiye otomatik bağlama.
6. Geri çözmede yanlış kişiye ya da yanlış değere dönüş (etiket karışması, ikiz parçası çakışması).
7. Kasa yaşam döngüsü: silme sonrası kalan veri, otomatik yenilemede veri kaybı.
8. Düzenli ifadelerde ReDoS; ZIP/XML ile hizmet engelleme.
9. Tauri izinleri, sandbox, cargo-deny; yasak eklenti.

Her bulgu için: önem (ENGELLEYİCİ / YÜKSEK), dosya ve satır, yeniden üretme adımı, önerilen düzeltme.
Kodu değiştirme. Görmediğin şeyi görmüş gibi yazma; doğrulayamadığını "doğrulanamadı" diye belirt.
```

### 6.7 Ortak "Bitti" tanımı

- `pnpm typecheck && pnpm lint && pnpm test && pnpm build` yeşil; ajanın kendi çekirdek modüllerinde satır kapsamı en az %90.
- 1.8 kurallarının hiçbiri ihlal edilmemiş (ESLint ve CI testleri).
- Kendi kabul kriterleri (6.1-6.5) yeşil ve paket sonu raporu yazılmış.
- `DEVIR.md`'ye en üste tarihli kısa not eklenmiş (orkestratörle birleştirilirken).
- Kontrat değişikliği yapılmamış (yalnız istek dosyası).

---

## Ek A: Altın test seti (Golden Test Suite) şeması

**Dosya biçimi:** `packages/test-corpus/golden/*.jsonl`; her satır bir `GoldenCase` (contracts.ts bölüm 11). Aşağıdaki örnek okunabilirlik için çok satırlı gösterilmiştir; dosyada tek satırdır. Örnekteki aralıklar ve beklenen geri çözme çıktısı belge derlenirken motorun kendisiyle hesaplanmıştır.

```json
{
  "id": "alacak-0001",
  "title": "Kısa alacak dilekçesi, tek davacı, emsal künye",
  "tags": [
    "dilekce",
    "ictihat",
    "tckn",
    "coref"
  ],
  "input": {
    "text": "Davacı Ahmet Yılmaz (T.C. Kimlik No: 12345678950) vekili Av. Mehmet Demir, Ankara 4. Asliye Ticaret Mahkemesi 2024/892 E. sayılı dosyada Yargıtay 9. HD 2022/4110 E., 2023/1902 K. sayılı emsal karara dayanmıştır. Sayın Yılmaz'ın talebi kabul edilmelidir."
  },
  "entities": [
    {
      "span": {
        "start": 7,
        "end": 19
      },
      "category": "KISI",
      "role": "DAVACI",
      "clusterKey": "P1"
    },
    {
      "span": {
        "start": 37,
        "end": 48
      },
      "category": "TCKN"
    },
    {
      "span": {
        "start": 61,
        "end": 73
      },
      "category": "KISI",
      "role": "VEKIL",
      "clusterKey": "P2"
    },
    {
      "span": {
        "start": 110,
        "end": 118
      },
      "category": "DOSYA_NO"
    },
    {
      "span": {
        "start": 218,
        "end": 224
      },
      "category": "KISI",
      "role": "DAVACI",
      "clusterKey": "P1"
    }
  ],
  "mustKeep": [
    {
      "start": 152,
      "end": 161
    },
    {
      "start": 166,
      "end": 175
    }
  ],
  "unmask": [
    {
      "llmOutput": "[DAVACI_1]'in vekili [VEKİL_1], [DOSYA_NO_1]'de görülen davada emsal karara dayanmıştır. Sayın [DAVACI_1]'e bilgi verildi.",
      "expected": "Ahmet Yılmaz'ın vekili Mehmet Demir, 2024/892'de görülen davada emsal karara dayanmıştır. Sayın Ahmet Yılmaz'a bilgi verildi."
    }
  ]
}
```

**Belirlenimcilik:** Üreticiler ve etiket atama tohum 42 ile çalışır; aynı tohum aynı belgeyi, aynı etiketleri ve aynı ikizleri üretir.

**Belge türleri (en az, F2 sonunda her biri için en az 15 vaka):**

| No | Tür | Sınadığı |
|---|---|---|
| 1 | Alacak davası dilekçesi | Davacı/davalı şirket, IBAN, tutar, yerel dosya no |
| 2 | Cevap dilekçesi | Karşı taraf, çok sayıda emsal künye |
| 3 | Boşanma dilekçesi | Aynı soyadlı eşler, çocuklar, adres, doğum tarihi |
| 4 | Ortaklığın giderilmesi / miras | Mirasbırakan, 3+ aynı soyadlı mirasçı, tapu |
| 5 | İcra takip talebi | Alacaklı, borçlu, VKN, MERSİS, icra dosya no |
| 6 | Noter ihtarnamesi | Yevmiye, kira bedeli, adres |
| 7 | Kira sözleşmesi | Kiraya veren, kiracı, kefil, TCKN, IBAN |
| 8 | İşe iade / alacak | İşçi, işveren, SGK (kurum), ücret |
| 9 | Ceza şikâyet dilekçesi | Şüpheli, müşteki, plaka, telefon |
| 10 | Bilirkişi raporu | Tapu, plaka, tutar, tablo |
| 11 | İstinaf / temyiz dilekçesi | Kendi BAM/Yargıtay dosyası (İNCELE) |
| 12 | Hukuki mütalaa | Yargıtay, Danıştay, AYM, AİHM künyeleri (KORU), AİHM başvurucu adı |
| 13 | UDF fikstürü | Büyük harfli başlık, iki stile yayılan ad, tablo, görsel |
| 14 | DOCX fikstürü | İzlenen değişiklik (silinmiş metin dışarıda), yorum, üst bilgi, dipnot |

**Zorlayıcı vakalar (her türün içine serpiştirilir):** sağlaması tutmayan 10 ve 11 haneli sayılar; kanun numaraları ve kanun kısaltmalı plaka benzeri dizgeler (`49 TBK 72`); tarihler (`12/03/2024`, `2024/03/12`); tutarlar; ad olan ortak sözcükler (`Barış görüşmeleri`, `Deniz yolu`); yabancı adlar; büyük harfli başlıklar; LLM'in bozduğu etiketler (`[Davacı_1]`, `\[DAVACI\_1\]`, `DAVACI_1`, `[DAVACI 1]`, `[DAVACI_3]`).

**Ölçütler ve eşikler (F2 sonunda zorunlu):**

| Ölçüt | Eşik |
|---|---|
| L1 kategorileri (TCKN, YKN, VKN, MERSİS, IBAN, KART, TELEFON, EPOSTA) duyarlılık | 1,00 |
| L1 kategorileri kesinlik | en az 0,99 |
| DOSYA_NO duyarlılık | 1,00 |
| `mustKeep` aralıklarında yanlış maskeleme | 0 |
| PLAKA duyarlılık / kesinlik | en az 0,98 / en az 0,95 |
| ADRES duyarlılık / kesinlik | en az 0,95 / en az 0,90 |
| KİŞİ F1 (NER + kurallar) | en az 0,90 (duyarlılık hedefi 0,97) |
| KİŞİ duyarlılık (NER kapalı, yalnız kurallar) | en az 0,85 |
| ŞİRKET F1 | en az 0,80 |
| Kişi kümeleme B³ F1 | en az 0,95 |
| Soyadı çakışmasında yanlış otomatik bağlama | 0 |
| `unmask` vakaları birebir doğru | %100 |
| Tam tur (maskele, maskeli metni geri çöz) birebir | %100 |
| Sızıntı denetiminden sonra YÜKSEK kategori sızıntısı | 0 |

**Eşleşme kuralı:** Kimlik ve numaralarda aralık birebir; ad, şirket ve adreslerde başlangıç ve bitişte en çok 2 karakter sapma. Rapor (`metrics.ts`) kategori bazında TP/FP/FN, yanlış vakaların kimlikleri ve bir önceki koşuya göre fark içerir; CI çıktısı olarak saklanır.

---

## Ek B: Kaynaklar

Bu belgede doğrulanmış bilgi olarak kullanılanlar (0.4):

- udfpdf README (UDF içeriği: `content.xml` biçim 1.8, `documentproperties.xml`, `sign.sgn`): https://cdn.jsdelivr.net/npm/udfpdf@2.0.0/README.md
- udf-cli README (UDF XML şeması, `Alignment`, ARGB renkler, `￼`, `​`): https://socket.dev/npm/package/udf-cli
- udf-tools (UDF'nin ZIP + CDATA + startOffset/length yapısı): https://pypi.org/project/udf-tools/
- UDF-Toolkit: https://github.com/ataetgi/UDF-Toolkit
- Tauri v2 HTTP başlıkları ve CSP örneği (`ipc: http://ipc.localhost`): https://v2.tauri.app/security/http-headers/
- Tauri v2 `dragDropEnabled`: https://v2.tauri.app/fr/reference/javascript/api/namespacewebview
- Transformers.js özel model ve yerel WASM ayarları: https://huggingface.co/docs/transformers.js/custom_usage
- Transformers.js 4.x hattı (ikincil kaynak): https://wavect.io/de/blog/transformers-js-browser-ai-guide/
- `akdeniz27/bert-base-turkish-cased-ner` dosyaları ve model kartı: https://huggingface.co/akdeniz27/bert-base-turkish-cased-ner/tree/main
- Aynı modelin INT8 ONNX dışa aktarımı (boyut, etiketler): https://huggingface.co/freyavoice/pii-ner-model
- MERSİS numarasının oluşturulması (Ticaret Bakanlığı SSS): https://ticaret.gov.tr/ic-ticaret/sikca-sorulan-sorular/ticaret-sicili
- MERSİS biçimi (anonim ve limited şirketlerde 0 + vergi numarası): https://www.isbank.com.tr/blog/mersis-numarasi-nedir

Kod lisansı notu: udfpdf (Apache-2.0) ve udf-cli yalnız biçim referansıdır; kodlarından alıntı yapılmaz.

---

## Ek C: Kabul testleri (çalıştırılmış)

Bu testler belge yazılırken çalıştırıldı ve yeşildir. Faz-0'da repo kökündeki `test/` klasörüne aynen konur (içe aktarma yolları bu konuma göredir) ve `pnpm test:acceptance` ile koşar:

```bash
# package.json (kök):  "test:acceptance": "for f in test/t*.ts; do tsx --tsconfig tsconfig.json \"$f\" || exit 1; done"
# Tarayıcı modülleri (apps/web/src/security) ayrıca DOM kitaplığıyla derlenir: lib ["ES2022", "DOM", "DOM.Iterable"]
# tsconfig.json (kök) paths: { "@maskelex/core-engine/types": ["./packages/core-engine/src/types/contracts.ts"] }
```

| Dosya | Kapsam | Sahibi |
|---|---|---|
| t1_validators.ts | TCKN/YKN/VKN/MERSİS/IBAN/Luhn, tek hane bozulması, sayı yazısı, Türkçe katlama | AGENT-1 |
| t2_morph.ts | Ek motoru: istenen örnekler, damak l'si, şirket ve kısaltma, sayılar, adres, yabancı ad, kanıt, 242 vakalık idempotans | AGENT-2 |
| t3_udf.ts | Cerrahi yazım, `]]>` kaçışı, iki stile yayılan ad, tam tur, 3.000 rastgele özellik vakası | AGENT-3 |
| t4_citation.ts | İçtihat Koruma Filtresi, 23 vaka (büyük harf ve ekli biçimler dahil) | AGENT-1 |
| t5_detect.ts | Örnek dilekçede tüm L1/L2 kategorileri ve yanlış pozitif yokluğu | AGENT-1 |
| t6_coref.ts | Tek kişi, boşanma (aynı soyadı), evlilik soyadı, ad/soyadı belirsizliği, miras | AGENT-2 |
| t7_unmask.ts | Geri çözme, bozulmuş etiketler, ikiz kipi, tutar şaşırtma, çıktı aralığı değişmezi | AGENT-2 + AGENT-1 |
| t8_contracts.ts | `tokenKey` eşdeğerliği, etiket gövdelerinin benzersizliği, varsayılanlar | Orkestratör |
| t9_twins_tokens.ts | Fonetik ikiz anahtarı ve aile tutarlılığı, etiket atama ve kilit, maskeli metinde ek normalleştirme, tam tur | AGENT-2 + Orkestratör |
| t10_merge_crypto.ts | Bulgu birleştirme öncelikleri; kasa şifreleme tam turu, yanlış parola, kurcalanmış dosya, düşük tur sayısı | Orkestratör + AGENT-5 |

### test/t1_validators.ts

```ts
// test/t1_validators.ts
import assert from 'node:assert/strict';
import { isValidTckn, isYkn, isValidVkn, mersisKind, isValidTrIban, isValidLuhn, cardNetwork, makeTckn, makeVkn, makeTrIban, mod } from '../packages/core-engine/src/validators/checksums';
import { numberToWordList, numberToWordsJoined, lastSpokenWord } from '../packages/core-engine/src/text/numberWords';
import { foldKey, trLower, trUpper, isUppercaseContext } from '../packages/core-engine/src/text/turkish';

// TCKN
assert.equal(isValidTckn('10000000146'), true);
assert.equal(isValidTckn('10000000145'), false);
assert.equal(isValidTckn('00000000146'), false);
assert.equal(isValidTckn('1000000014'), false);
assert.equal(mod(-29, 10), 1);
// rastgele üretim tutarlılığı
for (let i = 0; i < 2000; i++) {
  const f9 = String(100000000 + Math.floor(Math.random() * 899999999));
  const t = makeTckn(f9);
  assert.equal(isValidTckn(t), true, t);
  // tek hane bozulması yakalanmalı
  const pos = Math.floor(Math.random() * 11);
  const bad = t.slice(0, pos) + String((Number(t[pos]) + 1 + Math.floor(Math.random() * 8)) % 10) + t.slice(pos + 1);
  if (bad[0] !== '0') assert.equal(isValidTckn(bad), false, 'tek hane hatası: ' + t + ' → ' + bad);
}
const ykn = makeTckn('991234567');
assert.equal(isYkn(ykn), true);
console.log('YKN örnek', ykn);

// VKN
assert.equal(isValidVkn('1234567890'), true);
assert.equal(isValidVkn('1234567891'), false);
assert.equal(isValidVkn('0000000019'), true);
for (let i = 0; i < 2000; i++) {
  const f9 = String(Math.floor(Math.random() * 1e9)).padStart(9, '0');
  assert.equal(isValidVkn(makeVkn(f9)), true);
}
// VKN tek hane hatası tespit oranı
let caught = 0, total = 0;
for (let i = 0; i < 5000; i++) {
  const v = makeVkn(String(Math.floor(Math.random() * 1e9)).padStart(9, '0'));
  const pos = Math.floor(Math.random() * 10);
  const nd = (Number(v[pos]) + 1 + Math.floor(Math.random() * 9)) % 10;
  const bad = v.slice(0, pos) + nd + v.slice(pos + 1);
  if (bad === v) continue;
  total++; if (!isValidVkn(bad)) caught++;
}
console.log('VKN tek hane hata yakalama oranı', (caught / total).toFixed(3));

// MERSİS
const vkn = makeVkn('313055729');
assert.equal(mersisKind('0' + vkn + '00015'), 'TUZEL');
const tc = makeTckn('123456789');
assert.equal(mersisKind(tc + '00015'), 'GERCEK');
assert.equal(mersisKind('0000000000000000'), null);

// IBAN
assert.equal(isValidTrIban('TR330006100519786457841326'), true);
assert.equal(isValidTrIban('TR330006100519786457841327'), false);
assert.equal(isValidTrIban('TR320006100519786457841326'), false);
const gen = makeTrIban('00012', '1234567890123456');
assert.equal(isValidTrIban(gen), true);
console.log('Üretilen IBAN', gen);

// Luhn
assert.equal(isValidLuhn('4111111111111111'), true);
assert.equal(isValidLuhn('4111111111111112'), false);
assert.equal(cardNetwork('4111111111111111'), 'VISA');
assert.equal(cardNetwork('5555555555554444'), 'MASTERCARD');
assert.equal(cardNetwork('378282246310005'), 'AMEX');

// Sayı yazısı
assert.deepEqual(numberToWordList(125000), ['yüz', 'yirmi', 'beş', 'bin']);
assert.equal(numberToWordsJoined(125000), 'yüzyirmibeşbin');
assert.equal(numberToWordsJoined(1000), 'bin');
assert.equal(numberToWordsJoined(1001), 'binbir');
assert.equal(numberToWordsJoined(2000), 'ikibin');
assert.equal(numberToWordsJoined(100), 'yüz');
assert.equal(numberToWordsJoined(1250000), 'birmilyonikiyüzellibin');
assert.equal(numberToWordsJoined(1000000), 'birmilyon');
assert.equal(numberToWordsJoined(0), 'sıfır');
assert.equal(lastSpokenWord('2024/892'), 'iki');
assert.equal(lastSpokenWord('10'), 'on');
assert.equal(lastSpokenWord('40'), 'kırk');
assert.equal(lastSpokenWord('1000'), 'bin');
assert.equal(lastSpokenWord('12345678901'), 'bir');
assert.equal(lastSpokenWord('0123'), 'üç');

// Türkçe metin
assert.equal(foldKey('İSMAİL'), 'ismail');
assert.equal(foldKey('ISMAIL'), 'ismail');
assert.equal(foldKey('Işık'), 'isik');
assert.equal(foldKey('ŞÜKRÜ Öğüt'), 'sukru ogut');
assert.equal(trLower('YILMAZ'), 'yılmaz');
assert.equal(trUpper('ayşe kaya'), 'AYŞE KAYA');
assert.equal(isUppercaseContext('DAVACI : [DAVACI_1]'), true);
assert.equal(isUppercaseContext('Davacı [DAVACI_1] vekili'), false);
console.log('t1 OK');
```

### test/t2_morph.ts

```ts
// test/t2_morph.ts
import assert from 'node:assert/strict';
import { profileOf, realize, parseSuffix, parseSuffixAll, rehydrateSuffix, refineWithEvidence, tokenReadingProfile, isLetterByLetter } from '../packages/core-engine/src/morphology/morphology';

const fix = (llm: string, entity: string): string => rehydrateSuffix(llm, profileOf(entity)).suffixOut;

// İstenen örnekler
assert.equal(fix('in', 'Ayşe Kaya'), 'nın');        // [DAVACI_1]'in + Ayşe Kaya → Kaya'nın
assert.equal(fix('e', 'Ahmet Yılmaz'), 'a');        // Yılmaz'a
assert.equal(fix('in', 'Ahmet Yılmaz'), 'ın');
assert.equal(fix('nın', 'Ahmet Yılmaz'), 'ın');
assert.equal(fix('i', 'Ayşe Kaya'), 'yı');          // belirtme (ACC)
assert.equal(fix('si', 'Ayşe Kaya'), 'sı');         // iyelik açıkça
assert.equal(fix('de', 'Ahmet Yılmaz'), 'da');
assert.equal(fix('de', 'Mehmet Öztürk'), 'te');     // sert ünsüz
assert.equal(fix('den', 'Mehmet Öztürk'), 'ten');
assert.equal(fix('dir', 'Mehmet Öztürk'), 'tür');
assert.equal(fix('ye', 'Duru Mutlu'), 'ya');
assert.equal(fix('nin', 'Duru Mutlu'), 'nun');
assert.equal(fix('in', 'Gönül Özgür'), 'ün');
assert.equal(fix('e', 'Gönül Özgür'), 'e');
assert.equal(fix('le', 'Ahmet Yılmaz'), 'la');
assert.equal(fix('yle', 'Ayşe Kaya'), 'yla');
assert.equal(fix('ce', 'Ahmet Yılmaz'), 'ca');
assert.equal(fix('ce', 'Burak Toprak'), 'ça');
assert.equal(fix('lerin', 'Ahmet Yılmaz'), 'ların');
assert.equal(fix('inki', 'Ayşe Kaya'), 'nınki');
assert.equal(fix('teki', 'Ayşe Kaya'), 'daki');
assert.equal(fix('dır', 'Ayşe Kaya'), 'dır');
assert.equal(fix('ydi', 'Ahmet Yılmaz'), 'dı');
assert.equal(fix('ken', 'Ahmet Yılmaz'), 'ken');
assert.equal(fix('yken', 'Ahmet Yılmaz'), 'ken');
assert.equal(fix('siz', 'Ayşe Kaya'), 'sız');
// Damak l'si istisnası
assert.equal(fix('ın', 'Kemal Sunal'), 'ın');       // Sunal → kalın
assert.equal(fix('ın', 'Mustafa Kemal'), 'in');     // Kemal → ince
// Şirketler
assert.equal(fix('nin', 'ABC Yapı A.Ş.'), 'nin');  // A.Ş. → "şe"
assert.equal(fix('a', 'ABC Yapı A.Ş.'), 'ye');
assert.equal(fix('e', 'XYZ İnşaat Ltd. Şti.'), 'ne');   // Şti. → şirketi → -ne
assert.equal(fix('de', 'XYZ İnşaat Ltd. Şti.'), 'nde');
assert.equal(fix('den', 'XYZ İnşaat Ltd. Şti.'), 'nden');
assert.equal(fix('ce', 'Ankara Büyükşehir Belediyesi'), 'nce');  // Belediyesince
assert.equal(fix('yle', 'XYZ İnşaat Ltd. Şti.'), 'yle');
assert.equal(fix('ın', 'Türk Hava Yolları THY'), 'nin');  // THY → "ye"
assert.equal(fix('a', 'SGK'), 'ye');                      // SGK → "ke" (TDK okunuşu)
assert.equal(fix('ın', 'ODTÜ'), 'nün');                   // kelime gibi okunur
assert.equal(fix('ın', 'TÜİK'), 'in');
assert.equal(fix('ın', 'ASELSAN'), 'ın');
assert.equal(fix('e', 'ABD'), 'ye');
assert.equal(isLetterByLetter('ALİ'), false);
assert.equal(isLetterByLetter('ABD'), true);
assert.equal(isLetterByLetter('AYM'), true);
assert.equal(isLetterByLetter('İTÜ'), false);
assert.equal(isLetterByLetter('ÖSYM'), true);
assert.equal(isLetterByLetter('TRT'), true);
assert.equal(isLetterByLetter('NATO'), false);
// Büyük harfli tam ad (dilekçe başlığı)
assert.equal(fix('ın', 'AHMET YILMAZ'), 'ın');
assert.equal(fix('e', 'AYŞE KAYA'), 'ya');
// Sayılar
assert.equal(fix('nin', '12345678901'), 'in');            // ...01 → "bir"
assert.equal(fix('de', '2024/892'), 'de');                // "iki"
assert.equal(fix('e', '2024/890'), 'a');                  // "doksan"
assert.equal(fix('e', '06 ABC 123'), 'e');                // "üç" → üç'e
assert.equal(fix('de', '06 ABC 123'), 'te');
assert.equal(fix('ın', '06 ABC 40'), 'ın');               // "kırk"
assert.equal(fix('a', 'TR33 0006 1005 1978 6457 8413 26'), 'ya'); // "altı"
// Adres
assert.equal(fix('de', 'Kızılay Mah. Atatürk Bulvarı No:12 Çankaya/ANKARA'), 'da');
assert.equal(fix('e', 'Bahçe Sokağı'), 'na');
// Yabancı ad sözlüğü
assert.equal(fix('in', 'George Smith'), 'in');            // Smith: son ünlü i
assert.equal(fix('in', 'George'), 'un');                  // corc
assert.equal(profileOf('Michael').confidence, 'HIGH');
assert.equal(profileOf('Sheldon').confidence, 'LOW');     // yabancı görünümlü → inceleme

// Büyük harfli ek
assert.equal(rehydrateSuffix('İN', profileOf('AYŞE KAYA')).suffixOut, 'NIN');

// Ayrıştırma
assert.deepEqual(parseSuffix('nın'), ['GEN']);
assert.deepEqual(parseSuffix('lerinden'), ['PL', 'POSS', 'ABL']);
assert.deepEqual(parseSuffix('i'), ['ACC']);
assert.deepEqual(parseSuffix('si'), ['POSS']);
assert.deepEqual(parseSuffix('inkiler'), ['GEN', 'KI', 'PL']);
assert.deepEqual(parseSuffix('tekilerin'), ['LOC', 'KI', 'PL', 'GEN']);
assert.deepEqual(parseSuffix('ndan'), ['ABL']);
assert.equal(parseSuffix('xyz'), null);
assert.equal(parseSuffix('ve'), null);
console.log('ayrıştırma örnekleri', parseSuffixAll('ın'), parseSuffixAll('ne'));

// Etiket okunuşu
assert.equal(realize(['GEN'], tokenReadingProfile('[DAVACI_1]')), 'in');
assert.equal(realize(['GEN'], tokenReadingProfile('[DAVACI_2]')), 'nin');
assert.equal(realize(['DAT'], tokenReadingProfile('[ŞİRKET_A]')), 'ya');
assert.equal(realize(['DAT'], tokenReadingProfile('[ŞİRKET_B]')), 'ye');
assert.equal(realize(['LOC'], tokenReadingProfile('[DOSYA_NO_3]')), 'te');
assert.equal(realize(['GEN'], tokenReadingProfile('[TCKN_10]')), 'un');

// Kanıt: kaynak belgede "A.Ş.'ne" yazılmışsa n'li çekime geç
const asProfile = refineWithEvidence(profileOf('ABC Yapı A.Ş.'), ['ne']);
assert.equal(asProfile.pronominalN, true);
assert.equal(realize(['LOC'], asProfile), 'nde');
// Kanıt hesaplananla tutarlıysa değişmez
const yp = refineWithEvidence(profileOf('Ahmet Yılmaz'), ['ın', 'a']);
assert.equal(yp.source, 'WORD');
// Yabancı ad, kanıtla düzelir: "Michel'ın"
const mp = refineWithEvidence(profileOf('Michel'), ['ın']);
assert.equal(realize(['DAT'], mp), 'a');

// Kapsamlı tutarlılık: her gövde ve ek için realize∘parse sabit
const stems = ['Ayşe Kaya', 'Ahmet Yılmaz', 'Mehmet Öztürk', 'Duru Mutlu', 'Gönül Özgür', 'Burak Toprak', 'XYZ Ltd. Şti.', 'ABC A.Ş.', '2024/892', 'Ufuk Bulut', 'Öykü Ünlü'];
const sufs = ['in', 'nın', 'e', 'ya', 'i', 'yi', 'de', 'ta', 'den', 'tan', 'le', 'yla', 'ce', 'lar', 'ların', 'inki', 'deki', 'dir', 'ydi', 'ken', 'siz', 'li'];
let n = 0;
for (const st of stems) for (const s of sufs) {
  const p = profileOf(st);
  const r1 = rehydrateSuffix(s, p).suffixOut;
  const r2 = rehydrateSuffix(r1, p).suffixOut;
  assert.equal(r2, r1, `idempotent değil: ${st} + ${s} → ${r1} → ${r2}`);
  n++;
}
console.log('idempotans denetimi', n, 'vaka');
console.log('t2 OK');
```

### test/t3_udf.ts

```ts
// test/t3_udf.ts
import assert from 'node:assert/strict';
import type { TextEdit } from '@maskelex/core-engine/types';
import { makePointMapper, applyEditsToText, remapRange, normalizeEdits, EditError } from '../packages/document-parsers/src/ast/remap';
import { locateCdata, rewriteContentXml, validateContentXml, scanOffsetElements, toCdata, UdfFormatError } from '../packages/document-parsers/src/udf/contentXml';

// ---- Sentetik UDF (alan adları udf-cli README örneğindeki gibi; gerçek dosyalarla ayrıca doğrulanacak) ----
const para = (runs: Array<[string, string]>, start: number): { xml: string; text: string } => {
  let off = start, xml = '<paragraph Alignment="3">', text = '';
  for (const [t, extra] of runs) {
    xml += `<content startOffset="${off}" length="${t.length}" family="Times New Roman" size="12"${extra} />`;
    off += t.length; text += t;
  }
  return { xml: xml + '</paragraph>', text };
};
const p1 = para([['DAVACI : ', ' bold="true"'], ['Ahmet ', ''], ['Yılmaz', ' bold="true"'], [' (TC: 10000000146)\n', '']], 0);
const p2 = para([["Davacı Ahmet Yılmaz'ın talebi, Ankara 4. Asliye Ticaret Mahkemesi 2024/892 E. sayılı dosyada görülmüştür.\n", '']], p1.text.length);
const p3 = para([['Yargıtay 9. HD 2022/4110 E., 2023/1902 K. emsal kararı ]]> özel karakter testi.\n', '']], p1.text.length + p2.text.length);
const fullText = p1.text + p2.text + p3.text;
const xml = `<?xml version="1.0" encoding="UTF-8" ?>\n<template format_id="1.8">\n<content>${toCdata(fullText)}</content>\n<properties><pageFormat mediaSizeName="1" leftMargin="42.52" rightMargin="28.35" topMargin="14.17" bottomMargin="14.17" paperOrientation="1" /></properties>\n<elements resolver="hvl-default">\n${p1.xml}\n${p2.xml}\n${p3.xml}\n</elements>\n<styles><style name="hvl-default" family="Times New Roman" size="12" description="Gövde" /></styles>\n</template>`;

// CDATA okuma ("]]>" kaçışlı)
const cd = locateCdata(xml);
assert.equal(cd.text, fullText);
assert.equal(validateContentXml(xml).length, 0);
assert.equal(scanOffsetElements(xml, cd.contentCloseStart + 10).length, 6);

// Maskeleme düzenlemeleri
const find = (needle: string, from = 0): { start: number; end: number } => {
  const s = fullText.indexOf(needle, from); assert.ok(s >= 0, needle); return { start: s, end: s + needle.length };
};
const nameSpan1 = find('Ahmet Yılmaz');                        // iki run'a yayılıyor (normal + kalın)
const tcSpan = find('10000000146');
const nameSpan2 = find('Ahmet Yılmaz', nameSpan1.end);
const dosya = find('2024/892');
const maskEdits: TextEdit[] = [
  { span: nameSpan1, replacement: '[DAVACI_1]' },
  { span: tcSpan, replacement: '[TCKN_1]' },
  { span: nameSpan2, replacement: '[DAVACI_1]' },
  { span: dosya, replacement: '[DOSYA_NO_1]' },
];
const masked = rewriteContentXml(xml, maskEdits);
assert.equal(validateContentXml(masked.xml).length, 0, JSON.stringify(validateContentXml(masked.xml)));
const mText = locateCdata(masked.xml).text;
assert.ok(mText.includes('DAVACI : [DAVACI_1] (TC: [TCKN_1])'));
assert.ok(mText.includes('2022/4110 E., 2023/1902 K.'));          // içtihat dokunulmadı
assert.ok(mText.includes(']]> özel'));                              // kaçış korundu
assert.equal(masked.report.removedElements, 1);                    // "Yılmaz" kalın run'ı 0'a düştü ve silindi
// Paragraf içi bitişiklik ve toplam uzunluk
const els = scanOffsetElements(masked.xml, locateCdata(masked.xml).contentCloseStart + 10);
let expect = 0;
for (const e of els) { assert.equal(Number(e.startOffset.value), expect); expect += Number(e.length.value); }
assert.equal(expect, mText.length);
// Değişmeyen bayt alanları korunur
assert.ok(masked.xml.includes('<styles><style name="hvl-default" family="Times New Roman" size="12" description="Gövde" /></styles>'));
assert.ok(masked.xml.startsWith('<?xml version="1.0" encoding="UTF-8" ?>\n<template format_id="1.8">'));

// Geri çözme: maskeli metindeki etiketleri özgün metinle değiştir → metin birebir geri gelmeli
const unmaskEdits: TextEdit[] = [];
const re = /\[(DAVACI_1|TCKN_1|DOSYA_NO_1)\]/g;
const back: Record<string, string> = { DAVACI_1: 'Ahmet Yılmaz', TCKN_1: '10000000146', DOSYA_NO_1: '2024/892' };
for (const m of mText.matchAll(re)) unmaskEdits.push({ span: { start: m.index!, end: m.index! + m[0].length }, replacement: back[m[1]!]! });
const restored = rewriteContentXml(masked.xml, unmaskEdits);
assert.equal(locateCdata(restored.xml).text, fullText);
assert.equal(validateContentXml(restored.xml).length, 0);
// Tek run içindeki varlıklarda ofsetler özgünle birebir aynı; iki run'a yayılan varlıkta biçim birleşir (bilinen sınırlama)
const origEls = scanOffsetElements(xml, cd.contentCloseStart + 10).map((e) => [e.startOffset.value, e.length.value].join(':'));
const restEls = scanOffsetElements(restored.xml, locateCdata(restored.xml).contentCloseStart + 10).map((e) => [e.startOffset.value, e.length.value].join(':'));
console.log('özgün  ', origEls.join(' '));
console.log('geri   ', restEls.join(' '));
assert.deepEqual(restEls.slice(2), origEls.slice(3));

// Eşleyici özellik testi (rastgele)
for (let iter = 0; iter < 3000; iter++) {
  const len = 30 + Math.floor(Math.random() * 60);
  const text = 'x'.repeat(len);
  const edits: TextEdit[] = [];
  let pos = Math.floor(Math.random() * 4);
  while (pos < len - 2 && edits.length < 6) {
    const l = 1 + Math.floor(Math.random() * 6);
    if (pos + l > len) break;
    edits.push({ span: { start: pos, end: pos + l }, replacement: 'y'.repeat(Math.floor(Math.random() * 12)) });
    pos += l + Math.floor(Math.random() * 8);
  }
  const map = makePointMapper(normalizeEdits(text, edits));
  // rastgele bitişik bölümleme: kapsama ve bitişiklik korunmalı
  const cuts = [0, ...Array.from({ length: 5 }, () => Math.floor(Math.random() * len)).sort((a, b) => a - b), len];
  const newLen = applyEditsToText(text, edits).length;
  let cursor = 0, prevEnd = 0;
  for (let k = 0; k + 1 < cuts.length; k++) {
    const r = remapRange(map, { start: cuts[k]!, length: cuts[k + 1]! - cuts[k]! });
    if (!r) continue;
    assert.equal(r.start, prevEnd, 'bitişiklik');
    prevEnd = r.start + r.length; cursor = prevEnd;
  }
  assert.equal(cursor, newLen, 'kapsama');
  for (let p = 0; p < len; p++) assert.ok(map(p) <= map(p + 1), 'monotonluk');
}

// Ön koşul ihlalleri
assert.throws(() => normalizeEdits('abc\ndef', [{ span: { start: 2, end: 5 }, replacement: 'z' }]), EditError);
assert.throws(() => normalizeEdits('abcdef', [{ span: { start: 1, end: 3 }, replacement: 'z' }, { span: { start: 2, end: 4 }, replacement: 'q' }]), EditError);
assert.throws(() => locateCdata('<template><content> <![CDATA[x]]></content></template>'), UdfFormatError);
console.log('t3 OK');
```

### test/t4_citation.ts

```ts
// test/t4_citation.ts
import assert from 'node:assert/strict';
import { findDockets, classifyDockets, type CitationVerdict } from '../packages/core-engine/src/legal/citation';

const verdicts = (t: string): Array<[string, CitationVerdict]> =>
  classifyDockets(t, findDockets(t, 2026)).map((d) => [t.slice(d.match.start, d.match.end), d.verdict]);

assert.deepEqual(verdicts('Yargıtay 9. HD 2022/4110 E., 2023/1902 K. sayılı kararında da belirtildiği üzere'),
  [['2022/4110', 'PROTECT'], ['2023/1902', 'PROTECT']]);
assert.deepEqual(verdicts('Ankara 4. Asliye Ticaret Mahkemesi 2024/892 E. sayılı dosyası'), [['2024/892', 'MASK']]);
assert.deepEqual(verdicts('İst. 12. İcra Dairesi 2025/114 E. sayılı takip'), [['2025/114', 'MASK']]);
assert.deepEqual(verdicts("Yargıtay Hukuk Genel Kurulu'nun 12.05.2021 tarih ve 2017/2154 E., 2021/612 K. sayılı kararı emsal niteliktedir."),
  [['2017/2154', 'PROTECT'], ['2021/612', 'PROTECT']]);
assert.deepEqual(verdicts("Ankara BAM 23. HD'nin 2023/456 E. 2024/12 K. sayılı kararı"), [['2023/456', 'PROTECT'], ['2024/12', 'PROTECT']]);
assert.deepEqual(verdicts("Müvekkilimizin dosyası Yargıtay 3. HD'ye gönderilmiş olup 2024/5555 E. sayılı dosya incelemededir."),
  [['2024/5555', 'REVIEW']]);
assert.deepEqual(verdicts("Ankara 4. Asliye Ticaret Mahkemesinin 2024/892 E. sayılı dosyasında verilen ve Yargıtay 11. HD'nin 2025/100 E. sayılı ilamı ile onanan karar"),
  [['2024/892', 'MASK'], ['2025/100', 'REVIEW']]);
assert.deepEqual(verdicts('Danıştay 10. D. 2019/1234 E., 2021/77 K.'), [['2019/1234', 'PROTECT'], ['2021/77', 'PROTECT']]);
assert.deepEqual(verdicts('AYM, B. No: 2018/12345, 12/1/2021'), [['2018/12345', 'PROTECT']]);
assert.deepEqual(verdicts('12/03/2024 tarihli dilekçe ve 2024/03/12 tarihli tutanak'), []);
assert.deepEqual(verdicts("Bakırköy 5. İş Mahkemesi'nin 2023/77 Esas sayılı dosyası"), [['2023/77', 'MASK']]);
assert.deepEqual(verdicts('Ankara Bölge İdare Mahkemesi 2. İDD 2022/10 E.'), [['2022/10', 'PROTECT']]);
assert.deepEqual(verdicts('İstanbul 3. İdare Mahkemesi 2022/10 E.'), [['2022/10', 'MASK']]);
assert.deepEqual(verdicts('dosya no 2024/892 E. olarak kayıtlıdır'), [['2024/892', 'MASK']]);
assert.deepEqual(verdicts('5237 sayılı TCK ve 2024/1 sayılı genelge'), [['2024/1', 'MASK']]);
assert.deepEqual(verdicts('Ankara Batı Cumhuriyet Başsavcılığının 2024/12345 soruşturma sayılı dosyası'), [['2024/12345', 'MASK']]);
assert.deepEqual(verdicts('Ankara 2. Noterliği 2024/55'), [['2024/55', 'MASK']]);
// 60 karakterden uzak işaret dikkate alınmaz
assert.deepEqual(verdicts('Yargıtay ' + 'x'.repeat(70) + ' 2020/1 E.'), [['2020/1', 'MASK']]);
// Büyük harfli başlıklar ve ekli biçimler (JS /i bayrağı İ'yi eşlemez; lowerView ile çözülür)
assert.deepEqual(verdicts('YARGITAY 9. HUKUK DAİRESİ 2022/4110 E., 2023/1902 K.'), [['2022/4110', 'PROTECT'], ['2023/1902', 'PROTECT']]);
assert.deepEqual(verdicts('ANKARA 4. ASLİYE TİCARET MAHKEMESİ 2024/892 E.'), [['2024/892', 'MASK']]);
assert.deepEqual(verdicts("İstanbul Bölge Adliye Mahkemesinin 2023/1 E. sayılı kararı emsaldir"), [['2023/1', 'PROTECT']]);
assert.deepEqual(verdicts('AİHM büyük dairesinin 2019/5 sayılı kararı'), [['2019/5', 'PROTECT']]);
assert.deepEqual(verdicts('bamya 2020/3 E.'), [['2020/3', 'MASK']]);
console.log('t4 OK');
```

### test/t5_detect.ts

```ts
// test/t5_detect.ts
import assert from 'node:assert/strict';
import { detectAll } from '../packages/core-engine/src/detectors/deterministic/reference';
import { makeTckn, makeVkn, makeTrIban } from '../packages/core-engine/src/validators/checksums';

const tc = makeTckn('123456789');           // sentetik
const vkn = makeVkn('987654321');
const iban = makeTrIban('00062', '0000123456789012');
const spacedIban = iban.replace(/^(.{4})(.{4})(.{4})(.{4})(.{4})(.{4})(.{2})$/, '$1 $2 $3 $4 $5 $6 $7');
const mersis = '0' + vkn + '00015';
const sample = `ANKARA 4. ASLİYE TİCARET MAHKEMESİ'NE
DOSYA NO : 2024/892 E.
DAVACI : Ahmet Yılmaz (T.C. Kimlik No: ${tc}) Kızılay Mah. Atatürk Bulvarı No:12 Çankaya/ANKARA
VEKİLİ : Av. Mehmet Demir, Tel: 0532 123 45 67, e-posta mehmet.demir@ornekhukuk.av.tr, KEP: mdemir@hs01.kep.tr
DAVALI : XYZ İnşaat Ltd. Şti. (VKN: ${vkn}, MERSİS No: ${mersis})
IBAN: ${spacedIban}
Kart: 4111 1111 1111 1111
AÇIKLAMALAR: 34 ABC 123 plakalı araç ile 06 B 1234 plakalı araç çarpışmıştır. Davacı 1985 doğumlu olup DOĞUM TARİHİ: 12.03.1985'tir.
6098 sayılı TBK m. 49 ve 5237 S.K. ile TBK 72 uyarınca; Yargıtay 9. HD 2022/4110 E., 2023/1902 K. sayılı emsal kararında da belirtildiği üzere.
Taşınmaz 123 ada 45 parsel sayılı yerdedir. Beyoğlu 12. Noterliği'nin 05123 yevmiye numaralı ihtarnamesi.
Dava değeri 125.000,00 TL (yüzyirmibeşbin Türk Lirası). Sicil 12345678901 değil, 12345678900 ve 1234567890 sayıları.
Bilgi için 444 1 444 ve 0850 123 45 67 numaraları.`;

const { raws, protectedSpans } = detectAll(sample, 2026);
const got = raws.map((r) => `${r.category}:${sample.slice(r.start, r.end)}:${r.confidence}`);
console.log(got.join('\n'));
console.log('KORUNAN:', protectedSpans.map((p) => sample.slice(p.start, p.end)).join(' | '));

const has = (cat: string, txt: string): boolean => raws.some((r) => r.category === cat && sample.slice(r.start, r.end) === txt);
assert.ok(raws.some((r) => r.category === 'DOSYA_NO' && sample.slice(r.start, r.end) === '2024/892' && r.confidence === 'HIGH'));
assert.ok(raws.some((r) => r.category === 'MERSIS' && r.confidence === 'HIGH'));
assert.ok(has('TCKN', tc));
assert.ok(has('TELEFON', '0532 123 45 67'));
assert.ok(has('EPOSTA', 'mehmet.demir@ornekhukuk.av.tr'));
assert.ok(has('EPOSTA', 'mdemir@hs01.kep.tr'));
assert.ok(has('VKN', vkn));
assert.ok(has('MERSIS', mersis));
assert.ok(has('IBAN', spacedIban));
assert.ok(has('KART', '4111 1111 1111 1111'));
assert.ok(has('PLAKA', '34 ABC 123'));
assert.ok(has('PLAKA', '06 B 1234'));
assert.ok(has('DOGUM_TARIHI', '12.03.1985'));
assert.ok(has('DOGUM_TARIHI', '1985'));
assert.ok(has('TAPU', '123 ada 45 parsel sayılı'));
assert.ok(has('YEVMIYE', '05123'));
// Yanlış pozitif olmamalı
assert.ok(!raws.some((r) => sample.slice(r.start, r.end).includes('2022/4110')));     // içtihat
assert.ok(!raws.some((r) => sample.slice(r.start, r.end).includes('TBK')));           // kanun
assert.ok(!raws.some((r) => r.category === 'TCKN' && sample.slice(r.start, r.end) === '12345678901'));   // sağlamasız 11 hane (ilk 10'u geçerli olsa da)
assert.ok(!raws.some((r) => sample.slice(r.start, r.end).startsWith('0850')));        // kurumsal hat
assert.ok(protectedSpans.some((p) => sample.slice(p.start, p.end) === '2022/4110'));
assert.ok(protectedSpans.some((p) => sample.slice(p.start, p.end).startsWith('6098 sayılı')));
console.log('t5 OK');
```

### test/t6_coref.ts

```ts
// test/t6_coref.ts
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
```

### test/t7_unmask.ts

```ts
// test/t7_unmask.ts
import assert from 'node:assert/strict';
import { unmask, type UnmaskView } from '../packages/core-engine/src/unmask/rehydrate';
import { profileOf } from '../packages/core-engine/src/morphology/morphology';
import { findAmounts, scaleAmounts, pickScale, parseTrNumber, formatTrNumber } from '../packages/core-engine/src/fuzz/amount';
import { tokenKey, type RandomSource } from '../packages/core-engine/src/types/contracts';
import { applyEditsToText } from '../packages/document-parsers/src/ast/remap';

assert.equal(tokenKey('[Davacı_1]'), 'DAVACI_1');
assert.equal(tokenKey('\\[DAVACI\\_1\\]'), 'DAVACI_1');
assert.equal(tokenKey('[ŞIRKET_A]'), 'SIRKET_A');

const view: UnmaskView = {
  entities: [
    { id: 'E-0001', tokens: ['[DAVACI_1]', '[KİŞİ_1]'], canonical: 'Ayşe Kaya', phon: profileOf('Ayşe Kaya'), givenCanonical: 'Ayşe', phonGiven: profileOf('Ayşe'), twin: { full: 'Seda Tuna', given: 'Seda', surname: 'Tuna' } },
    { id: 'E-0002', tokens: ['[DAVALI_1]'], canonical: 'Ahmet Yılmaz', phon: profileOf('Ahmet Yılmaz'), givenCanonical: 'Ahmet', phonGiven: profileOf('Ahmet'), twin: { full: 'Kaan Korkmaz', given: 'Kaan', surname: 'Korkmaz' } },
    { id: 'E-0003', tokens: ['[ŞİRKET_A]'], canonical: 'XYZ İnşaat Ltd. Şti.', phon: profileOf('XYZ İnşaat Ltd. Şti.') },
    { id: 'E-0004', tokens: ['[TCKN_1]'], canonical: '10000000146', phon: profileOf('10000000146') },
    { id: 'E-0005', tokens: ['[DOSYA_NO_1]'], canonical: '2024/892', phon: profileOf('2024/892') },
  ],
  groups: [{ id: 'G-01', token: '[SOYAD_1]', value: 'Yılmaz', phon: profileOf('Yılmaz') }],
};

const llm = `Davacı [DAVACI_1]'in talebi yerindedir. [DAVALI_1]'e ihtarname gönderilmiş, [ŞİRKET_A]'ya ödeme yapılmamıştır.
[DAVACI_1]’nın TC kimlik numarası [TCKN_1]'dir. Dosya [DOSYA_NO_1]'de görülmektedir.
**[Davacı_1]** ile \\[DAVALI\\_1\\] arasında; DAVACI_1 ise beyanda bulunmuştur. [DAVACI_3] belirsizdir. Sayın [SOYAD_1]'e bildirildi. [bkz. ek 1]
DAVACI : [DAVACI_1]`;
const r = unmask(llm, view);
console.log(r.text);
assert.ok(r.text.includes("Davacı Ayşe Kaya'nın talebi"));
assert.ok(r.text.includes("Ahmet Yılmaz'a ihtarname"));
assert.ok(r.text.includes("XYZ İnşaat Ltd. Şti.'ne ödeme"));
assert.ok(r.text.includes("Ayşe Kaya’nın TC kimlik numarası 10000000146'dır"));
assert.ok(r.text.includes("2024/892'de görülmektedir"));
assert.ok(r.text.includes('**Ayşe Kaya** ile Ahmet Yılmaz arasında; Ayşe Kaya ise'));
assert.ok(r.text.includes("Sayın Yılmaz'a bildirildi. [bkz. ek 1]"));     // sıradan köşeli parantez dokunulmaz
assert.ok(r.text.endsWith('DAVACI : AYŞE KAYA'));
assert.equal(r.issues.filter((i) => i.kind === 'UNKNOWN_TOKEN').length, 1);
assert.ok(r.issues.some((i) => i.kind === 'GROUP_TOKEN'));
assert.equal(r.stats.suffixCorrections, 5);
// Çıktı aralıkları çıktı metniyle tutarlı olmalı
for (const rep of r.replacements) assert.equal(r.text.slice(rep.outSpan.start, rep.outSpan.end), rep.restored);

// Fonetik İkiz modu
const r2 = unmask(`《Seda Tuna》'nın talebi; 《Kaan Korkmaz》'a karşı. Seda Hanım ve Kaan Bey uzlaşamamıştır. Korkmaz'ın beyanı.`, view);
assert.equal(r2.text, "Ayşe Kaya'nın talebi; Ahmet Yılmaz'a karşı. Ayşe Hanım ve Ahmet Bey uzlaşamamıştır. Ahmet Yılmaz'ın beyanı.");
assert.equal(r2.stats.twinsFound, 5);

// Tutar şaşırtma: oran korunur, birebir eşleşen geri alınır, türetilmiş olan yalnız önerilir
const src = 'Asıl alacak 125.000,00 TL (yüzyirmibeşbin Türk Lirası) ve 10.000 TL vekalet ücreti.';
const hits = findAmounts(src);
assert.equal(hits.length, 2);
assert.equal(hits[0]!.words?.text, 'yüzyirmibeşbin');
const k = 1.2;
const edits = scaleAmounts(hits, k);
assert.deepEqual(edits.map((e) => e.replacement), ['150.000,00', 'yüzellibin', '12.000']);
assert.equal(applyEditsToText(src, edits), 'Asıl alacak 150.000,00 TL (yüzellibin Türk Lirası) ve 12.000 TL vekalet ücreti.');
const pairs = edits.filter((e) => /\d/.test(e.replacement)).map((e) => ({ fuzzed: e.replacement, original: src.slice(e.span.start, e.span.end) }));
const r3 = unmask('Asıl alacak 150.000,00 TL; %9 faizi 13.500,00 TL eder. Harç 615,40 TL. Davacı [DAVACI_1]', { ...view, amounts: { k, pairs } });
assert.equal(r3.text, 'Asıl alacak 125.000,00 TL; %9 faizi 13.500,00 TL eder. Harç 615,40 TL. Davacı Ayşe Kaya');   // otomatik bölme YOK
assert.deepEqual(r3.issues.filter((i) => i.kind === 'AMOUNT_DERIVED').map((i) => i.suggestion), ['11.250,00', '512,83']);
for (const rep of r3.replacements) assert.equal(r3.text.slice(rep.outSpan.start, rep.outSpan.end), rep.restored);
assert.equal(formatTrNumber(parseTrNumber('1.250.000').value, parseTrNumber('1.250.000').style), '1.250.000');
const rng: RandomSource = { nextUint32: () => 0, nextFloat: () => Math.random() };
for (let i = 0; i < 1000; i++) { const s = pickScale(rng); assert.ok(s >= 0.8 && s <= 1.25 && (s < 0.95 || s > 1.05)); }
console.log('t7 OK');
```

### test/t8_contracts.ts

```ts
// test/t8_contracts.ts
import assert from 'node:assert/strict';
import { tokenKey as tk1, alphaIndex, makeToken, DEFAULT_MASKING_OPTIONS, CATEGORY_SPECS, ENTITY_CATEGORIES, ROLE_TOKEN_LABELS } from '../packages/core-engine/src/types/contracts';
import { tokenKey as tk2 } from '../packages/core-engine/src/types/contracts';
for (const s of ['[Davacı_1]', '\\[DAVACI\\_1\\]', '[ŞIRKET_A]', '[ŞİRKET_A]', 'DAVACI 1', '[MÜŞTEKİ_2]', '[DOĞUM_TARİHİ_1]', '[YEVMİYE_3]', '[İŞÇİ_1]'])
  assert.equal(tk1(s), tk2(s), s);
assert.equal(alphaIndex(1), 'A'); assert.equal(alphaIndex(26), 'Z'); assert.equal(alphaIndex(27), 'AA'); assert.equal(alphaIndex(52), 'AZ'); assert.equal(alphaIndex(53), 'BA');
assert.equal(makeToken('ŞİRKET', 2, 'ALPHA'), '[ŞİRKET_B]');
assert.equal(makeToken(ROLE_TOKEN_LABELS.BELIRSIZ, 1, 'NUMERIC'), '[KİŞİ_1]');
assert.equal(DEFAULT_MASKING_OPTIONS.maskedCategories.KURUM, false);
assert.equal(DEFAULT_MASKING_OPTIONS.maskedCategories.TCKN, true);
assert.equal(Object.keys(CATEGORY_SPECS).length, ENTITY_CATEGORIES.length);
// Tüm etiket gövdeleri birbirinden farklı anahtara katlanmalı (çakışma = geri çözmede karışıklık)
const keys = new Map<string, string>();
for (const c of ENTITY_CATEGORIES) { const k = tk1(`[${CATEGORY_SPECS[c].tokenLabel}_1]`); assert.ok(!keys.has(k), `çakışma ${k}`); keys.set(k, c); }
for (const [r, l] of Object.entries(ROLE_TOKEN_LABELS)) { if (r === 'BELIRSIZ') continue; const k = tk1(`[${l}_1]`); assert.ok(!keys.has(k), `rol/kategori çakışması ${k}`); keys.set(k, r); }
console.log('etiket anahtarları benzersiz:', keys.size);
console.log('t8 OK');
```

### test/t9_twins_tokens.ts

```ts
// test/t9_twins_tokens.ts
import assert from 'node:assert/strict';
import { makeTwinPicker, phonKey, type TwinLexiconEntry } from '../packages/core-engine/src/twins/twins';
import { allocateTokens, buildMaskEdits } from '../packages/core-engine/src/pipeline/maskText';
import { unmask } from '../packages/core-engine/src/unmask/rehydrate';
import { profileOf } from '../packages/core-engine/src/morphology/morphology';
import { applyEditsToText } from '../packages/document-parsers/src/ast/remap';
import type { RandomSource } from '../packages/core-engine/src/types/contracts';

// Örnek (gerçek liste lisanslı kaynaktan AGENT-2 tarafından derlenir)
const LEX: TwinLexiconEntry[] = [
  ...['Kaan', 'Hakan', 'Okan', 'Burak', 'Tarık', 'Mehmet', 'Ahmet', 'Ferit', 'Fikret', 'Emre', 'Can', 'Selim'].map((t) => ({ text: t, kind: 'AD' as const, gender: 'E' as const })),
  ...['Seda', 'Ayla', 'Derya', 'Esra', 'Elif', 'Gamze', 'Neşe', 'Melike', 'Beste'].map((t) => ({ text: t, kind: 'AD' as const, gender: 'K' as const })),
  ...['Korkmaz', 'Arslan', 'Tuna', 'Kara', 'Çelik', 'Kurt', 'Bulut', 'Erdem', 'Keskin', 'Duman', 'Sezer', 'Toprak', 'Eren'].map((t) => ({ text: t, kind: 'SOYAD' as const, gender: 'U' as const })),
];
let seed = 7;
const rng: RandomSource = { nextUint32: () => (seed = (seed * 1103515245 + 12345) >>> 0), nextFloat: () => Math.random() };
const picker = makeTwinPicker(LEX, rng, ['Ahmet Yılmaz', 'Ayşe Yılmaz', 'Mehmet Demir']);

const ahmet = picker.person({ id: 'E-1', given: 'Ahmet', surname: 'Yılmaz', gender: 'E' })!;
const ayse = picker.person({ id: 'E-2', given: 'Ayşe', surname: 'Yılmaz', gender: 'K' })!;
const mehmet = picker.person({ id: 'E-3', given: 'Mehmet', surname: 'Demir', gender: 'E' })!;
console.log(ahmet.full, '|', ayse.full, '|', mehmet.full);
assert.equal(ahmet.surname, ayse.surname);                        // aile soyadı tutarlı
assert.notEqual(mehmet.surname, ahmet.surname);
assert.equal(phonKey(ahmet.given), phonKey('Ahmet'));
assert.equal(phonKey(ahmet.surname), phonKey('Yılmaz'));
assert.equal(phonKey(ayse.given), phonKey('Ayşe'));
assert.ok(!['Mehmet', 'Ahmet'].includes(mehmet.given) && !['Mehmet', 'Ahmet'].includes(ahmet.given));   // belgedeki gerçek ad ikiz olamaz
assert.equal(phonKey(mehmet.given), phonKey('Mehmet'));
assert.equal(picker.familySurname('YILMAZ'), ahmet.surname);
// Uygun anahtar yoksa ikiz verilmez (etiket moduna düşülür)
assert.equal(picker.person({ id: 'E-4', given: 'Gönül', surname: 'Öztürk', gender: 'K' }), null);

// Etiket atama: ilk görünüş sırası, rol gövdesi, şirketler harfli
const counters: Record<string, number> = {};
const t1 = allocateTokens([
  { entityId: 'A', category: 'KISI', role: 'DAVALI', firstSeen: 50 },
  { entityId: 'B', category: 'KISI', role: 'DAVACI', firstSeen: 10 },
  { entityId: 'C', category: 'KISI', role: 'DAVACI', firstSeen: 30 },
  { entityId: 'D', category: 'SIRKET', role: 'BELIRSIZ', firstSeen: 5 },
  { entityId: 'E', category: 'SIRKET', role: 'BELIRSIZ', firstSeen: 70 },
  { entityId: 'F', category: 'KISI', role: 'BELIRSIZ', firstSeen: 90 },
  { entityId: 'G', category: 'TCKN', role: 'BELIRSIZ', firstSeen: 12 },
], counters, false);
assert.deepEqual(Object.fromEntries(t1), { D: '[ŞİRKET_A]', B: '[DAVACI_1]', G: '[TCKN_1]', C: '[DAVACI_2]', A: '[DAVALI_1]', E: '[ŞİRKET_B]', F: '[KİŞİ_1]' });
// Kilitli kasada F'nin rolü TANIK olursa yeni etiket verilir; diğerleri değişmez
const t2 = allocateTokens([
  { entityId: 'B', category: 'KISI', role: 'DAVACI', firstSeen: 10, currentToken: '[DAVACI_1]' },
  { entityId: 'F', category: 'KISI', role: 'TANIK', firstSeen: 90, currentToken: '[KİŞİ_1]' },
], counters, true);
assert.equal(t2.get('B'), '[DAVACI_1]');
assert.equal(t2.get('F'), '[TANIK_1]');

// Maskeli metinde ek normalleştirme ve tam tur
const text = "Davacı Ahmet Yılmaz'ın vekili, davalı Ayşe Kaya'ya ihtar çekmiş; Kaya'nın cevabı gelmemiştir.";
const s = (needle: string, from = 0): { start: number; end: number } => { const i = text.indexOf(needle, from); return { start: i, end: i + needle.length }; };
const ay = s('Ahmet Yılmaz'), ak = s('Ayşe Kaya'), k2 = s("Kaya'nın");
const masked = applyEditsToText(text, buildMaskEdits([
  { span: ay, replacement: '[DAVACI_1]', kind: 'TOKEN', suffix: { span: { start: ay.end + 1, end: ay.end + 3 }, text: 'ın' } },
  { span: ak, replacement: '[DAVALI_1]', kind: 'TOKEN', suffix: { span: { start: ak.end + 1, end: ak.end + 3 }, text: 'ya' } },
  { span: { start: k2.start, end: k2.start + 4 }, replacement: '[DAVALI_1]', kind: 'TOKEN', suffix: { span: { start: k2.start + 5, end: k2.start + 8 }, text: 'nın' } },
], true));
assert.equal(masked, "Davacı [DAVACI_1]'in vekili, davalı [DAVALI_1]'e ihtar çekmiş; [DAVALI_1]'in cevabı gelmemiştir.");
const back = unmask(masked, { groups: [], entities: [
  { id: 'E-1', tokens: ['[DAVACI_1]'], canonical: 'Ahmet Yılmaz', phon: profileOf('Ahmet Yılmaz') },
  { id: 'E-2', tokens: ['[DAVALI_1]'], canonical: 'Ayşe Kaya', phon: profileOf('Ayşe Kaya') },
] });
assert.equal(back.text, "Davacı Ahmet Yılmaz'ın vekili, davalı Ayşe Kaya'ya ihtar çekmiş; Ayşe Kaya'nın cevabı gelmemiştir.");
console.log('t9 OK');
```

### test/t10_merge_crypto.ts

```ts
// test/t10_merge_crypto.ts
import assert from 'node:assert/strict';
import { merge } from '../packages/core-engine/src/pipeline/merge';
import { encryptVault, decryptVault } from '../packages/core-engine/src/vault/crypto';
import type { EntityMatch, ProtectedSpan } from '../packages/core-engine/src/types/contracts';

// Birleştirme: korunan aralık > katman > güven > uzunluk
const m = (id: string, start: number, end: number, layer: EntityMatch['layer'], confidence: EntityMatch['confidence'] = 'HIGH'): EntityMatch =>
  ({ id, docId: 'D-01', span: { start, end }, text: 'x', category: 'KISI', layer, confidence, score: 0.9, ruleId: 'test', flags: [] });
const prot: ProtectedSpan[] = [{ docId: 'D-01', span: { start: 100, end: 110 }, reason: 'ICTIHAT_KUNYESI', ruleId: 'L2.ICTIHAT', ownCaseSuspect: false }];
const out = merge([
  m('ner-uzun', 0, 20, 'L3_NER'), m('kural', 5, 12, 'L3_RULE'), m('tckn', 30, 41, 'L1_CHECKSUM'), m('ner-tckn', 28, 45, 'L3_NER'),
  m('korunan', 102, 108, 'L2_LEGAL'), m('elle', 101, 109, 'MANUAL'), m('d2', 0, 20, 'L3_NER'),
], prot);
assert.deepEqual(out.map((x) => x.id), ['kural', 'tckn', 'elle']);
// Aynı katmanda yüksek güven, sonra uzun aralık kazanır
assert.deepEqual(merge([m('a', 0, 5, 'L3_NER', 'MEDIUM'), m('b', 2, 4, 'L3_NER', 'HIGH')], []).map((x) => x.id), ['b']);
assert.deepEqual(merge([m('a', 0, 5, 'L3_NER'), m('b', 2, 4, 'L3_NER')], []).map((x) => x.id), ['a']);

// Kasa şifreleme: tam tur, yanlış parola, değiştirilmiş dosya, düşük tur sayısı
async function main(): Promise<void> {
const plain = new TextEncoder().encode(JSON.stringify({ entities: [['E-0001', { canonical: 'Ahmet Yılmaz' }]] }));
const copy = plain.slice();
const file = await encryptVault(plain, 'uzun-ve-guclu-parola');
assert.ok(plain.every((b) => b === 0));                                   // girdi sıfırlandı
assert.ok(!JSON.stringify(file).includes('Yılmaz'));
assert.deepEqual(await decryptVault(file, 'uzun-ve-guclu-parola'), copy);
await assert.rejects(decryptVault(file, 'yanlis-parola-123'), (e: { code: string }) => e.code === 'E_CRYPTO');
const tampered = { ...file, ciphertext: file.ciphertext.slice(0, -4) + (file.ciphertext.endsWith('AAAA') ? 'BBBB' : 'AAAA') };
await assert.rejects(decryptVault(tampered, 'uzun-ve-guclu-parola'), (e: { code: string }) => e.code === 'E_CRYPTO');
await assert.rejects(decryptVault({ ...file, iterations: 1000 }, 'uzun-ve-guclu-parola'), (e: { code: string }) => e.code === 'E_CRYPTO');
await assert.rejects(encryptVault(new Uint8Array(4), 'kisa'), (e: { code: string }) => e.code === 'E_CRYPTO');
console.log('t10 OK');
}
main().catch((e) => { console.error(e); process.exit(1); });
```
