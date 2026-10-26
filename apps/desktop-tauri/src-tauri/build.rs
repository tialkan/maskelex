// Uygulamanın yalnız üç komutu bildirilir; izinleri capabilities/default.json'da verilir (MASTER 4.3).
fn main() {
    tauri_build::try_build(
        tauri_build::Attributes::new().app_manifest(
            tauri_build::AppManifest::new().commands(&["kaydet", "pano_yaz", "pano_temizle"]),
        ),
    )
    .expect("tauri build betiği başarısız");
}
