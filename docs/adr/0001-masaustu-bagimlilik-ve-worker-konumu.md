# ADR-0001: Masaüstü bağımlılık denetiminin kapsamı ve Engine Worker'ın konumu

**Tarih:** 2026-10-26. **Durum:** kabul edildi.

## 1. cargo deny yalnız masaüstü hedeflerinde

**Bağlam.** MASTER 4.3 `reqwest` ve benzeri HTTP kütüphanelerini yasaklar ve Tauri çekirdeği bunlardan birini
dolaylı çekerse ADR ile gerekçelendirilmesini ister. `tauri 2.12.5` `reqwest`'i yalnız
`cfg(any(target_os = "android", all(target_vendor = "apple", not(target_os = "macos"))))` koşuluyla, yani
Android ve iOS için çeker. Masaüstü derlemelerinde bulunmaz (`cargo tree -i reqwest` Linux, Windows ve macOS'ta boş).

**Karar.** `deny.toml` içinde `[graph] targets` dağıttığımız masaüstü hedefleriyle sınırlandı. Yasak liste değişmedi;
masaüstü hedeflerinden biri yasaklı bir kütüphane çekerse CI kırmızı olur.

**Ek not.** `tauri-plugin-dialog`, `tauri-plugin-fs` crate'ini Rust bağımlılığı olarak çeker. JS tarafına hiçbir
dialog ya da fs izni verilmez (`capabilities/default.json` yalnız uygulamanın üç komutunu içerir); bu yüzden
"fs eklentisi kullanılmaz" kuralı korunur.

## 2. Engine Worker apps/web altında

**Bağlam.** MASTER 1.x dizin ağacı `packages/core-engine/src/worker/engine.worker.ts` öngörür. Worker, belge
codec'lerini (`@maskelex/document-parsers`) motora vermek zorundadır; ancak document-parsers zaten core-engine'e
bağımlıdır. Worker core-engine içinde kalsaydı paketler arasında döngüsel bağımlılık oluşurdu.

**Karar.** Worker `apps/web/src/worker/engine.worker.ts` altına taşındı. Çekirdek motor (`createEngine`) codec'leri
port olarak alır; birleştirme uygulama katmanında yapılır. Masaüstü aynı web derlemesini kullandığından etkilenmez.
