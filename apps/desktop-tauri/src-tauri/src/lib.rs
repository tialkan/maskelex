// apps/desktop-tauri/src-tauri/src/lib.rs (MASTER 4.3)
// Eklenti yok kuralı: updater, http, shell, opener, fs kullanılmaz. JS keyfi bir yola yazamaz; dosya kaydetme
// penceresi Rust tarafında açılır ve seçilen yol JS'e hiç dönmez. tauri_plugin_dialog yalnız Rust'tan kullanılır.
mod clipboard;

#[tauri::command]
async fn kaydet(app: tauri::AppHandle, dosya_adi: String, veri: Vec<u8>) -> Result<bool, String> {
    use tauri_plugin_dialog::DialogExt;
    // Dosya adı nötr olmalı (maskeli-xxxx.udf); yol ayırıcı içeren ad reddedilir.
    if dosya_adi.contains(['/', '\\']) || dosya_adi.contains("..") {
        return Err("geçersiz dosya adı".into());
    }
    let secim = app.dialog().file().set_file_name(&dosya_adi).blocking_save_file();
    match secim {
        Some(yol) => {
            let yol = yol.into_path().map_err(|_| "yol".to_string())?;
            std::fs::write(yol, veri).map(|_| true).map_err(|_| "yazma".to_string())
        }
        None => Ok(false),
    }
}

/// Dönen değer: pano sıra numarası (temizlemede karşılaştırılır).
#[tauri::command]
fn pano_yaz(metin: String, hassas: bool) -> Result<u64, String> {
    clipboard::yaz(&metin, hassas)
}

#[tauri::command]
fn pano_temizle(sira: u64) -> Result<bool, String> {
    clipboard::degismediyse_temizle(sira)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![kaydet, pano_yaz, pano_temizle])
        .run(tauri::generate_context!())
        .expect("MaskeLex başlatılamadı");
}
