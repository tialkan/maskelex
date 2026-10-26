// apps/desktop-tauri/src-tauri/src/clipboard.rs (MASTER 4.8)
// Gizli pano: hassas metin pano geçmişine ve bulut eşitlemesine girmez; süre dolunca, pano değişmediyse temizlenir.
// Gerçek cihaz doğrulaması V-06'dır (Windows pano geçmişi Win+V, macOS Evrensel Pano).

#[cfg(windows)]
mod imp {
    use windows_sys::Win32::Foundation::{GlobalFree, HANDLE};
    use windows_sys::Win32::System::DataExchange::{
        CloseClipboard, EmptyClipboard, GetClipboardSequenceNumber, OpenClipboard, RegisterClipboardFormatW, SetClipboardData,
    };
    use windows_sys::Win32::System::Memory::{GlobalAlloc, GlobalLock, GlobalUnlock, GMEM_MOVEABLE};

    const CF_UNICODETEXT: u32 = 13;

    fn wide(s: &str) -> Vec<u16> {
        s.encode_utf16().chain(std::iter::once(0)).collect()
    }

    /// Bayt dizisini taşıyınabilir genel belleğe kopyalar.
    unsafe fn global_bytes(data: &[u8]) -> Result<HANDLE, String> {
        let h = GlobalAlloc(GMEM_MOVEABLE, data.len().max(1));
        if h.is_null() {
            return Err("bellek".into());
        }
        let p = GlobalLock(h) as *mut u8;
        if p.is_null() {
            GlobalFree(h);
            return Err("bellek".into());
        }
        std::ptr::copy_nonoverlapping(data.as_ptr(), p, data.len());
        GlobalUnlock(h);
        Ok(h)
    }

    unsafe fn set(format: u32, data: &[u8]) -> Result<(), String> {
        let h = global_bytes(data)?;
        if SetClipboardData(format, h).is_null() {
            GlobalFree(h);
            return Err("pano".into());
        }
        Ok(())
    }

    struct Acik;
    impl Drop for Acik {
        fn drop(&mut self) {
            unsafe { CloseClipboard() };
        }
    }
    fn ac() -> Result<Acik, String> {
        for _ in 0..10 {
            if unsafe { OpenClipboard(std::ptr::null_mut()) } != 0 {
                return Ok(Acik);
            }
            std::thread::sleep(std::time::Duration::from_millis(20));
        }
        Err("pano meşgul".into())
    }

    pub fn yaz(metin: &str, hassas: bool) -> Result<u64, String> {
        let _k = ac()?;
        unsafe {
            if EmptyClipboard() == 0 {
                return Err("pano".into());
            }
            let w = wide(metin);
            let bytes = std::slice::from_raw_parts(w.as_ptr() as *const u8, w.len() * 2);
            set(CF_UNICODETEXT, bytes)?;
            if hassas {
                let zero = 0u32.to_le_bytes();
                for (ad, veri) in [
                    ("ExcludeClipboardContentFromMonitorProcessing", &zero[..]),
                    ("CanIncludeInClipboardHistory", &zero[..]),
                    ("CanUploadToCloudClipboard", &zero[..]),
                ] {
                    let f = RegisterClipboardFormatW(wide(ad).as_ptr());
                    if f != 0 {
                        set(f, veri)?;
                    }
                }
            }
        }
        drop(_k);
        Ok(unsafe { GetClipboardSequenceNumber() } as u64)
    }

    pub fn degismediyse_temizle(sira: u64) -> Result<bool, String> {
        if unsafe { GetClipboardSequenceNumber() } as u64 != sira {
            return Ok(false);
        }
        let _k = ac()?;
        Ok(unsafe { EmptyClipboard() } != 0)
    }
}

#[cfg(target_os = "macos")]
mod imp {
    use objc2_app_kit::{NSPasteboard, NSPasteboardContentsOptions, NSPasteboardTypeString};
    use objc2_foundation::{NSData, NSString};

    const GIZLI_TURLER: [&str; 2] = ["org.nspasteboard.ConcealedType", "org.nspasteboard.TransientType"];

    pub fn yaz(metin: &str, hassas: bool) -> Result<u64, String> {
        let pb = NSPasteboard::generalPasteboard();
        pb.clearContents();
        if hassas {
            // Evrensel Pano ile diğer cihazlara geçmez.
            pb.prepareForNewContentsWithOptions(NSPasteboardContentsOptions::CurrentHostOnly);
        }
        let tur = unsafe { NSPasteboardTypeString };
        if !pb.setString_forType(&NSString::from_str(metin), tur) {
            return Err("pano".into());
        }
        if hassas {
            // Pano yöneticilerine "kaydetme" sinyali (nspasteboard.org)
            let bos = NSData::new();
            for t in GIZLI_TURLER {
                pb.setData_forType(Some(&bos), &NSString::from_str(t));
            }
        }
        Ok(pb.changeCount() as u64)
    }

    pub fn degismediyse_temizle(sira: u64) -> Result<bool, String> {
        let pb = NSPasteboard::generalPasteboard();
        if pb.changeCount() as u64 != sira {
            return Ok(false);
        }
        pb.clearContents();
        Ok(true)
    }
}

#[cfg(not(any(windows, target_os = "macos")))]
mod imp {
    // Linux masaüstü paketi kapsam dışıdır (MASTER 4.3); arayüz web panosuna düşer.
    pub fn yaz(_metin: &str, _hassas: bool) -> Result<u64, String> {
        Err("desteklenmiyor".into())
    }
    pub fn degismediyse_temizle(_sira: u64) -> Result<bool, String> {
        Err("desteklenmiyor".into())
    }
}

pub use imp::{degismediyse_temizle, yaz};
