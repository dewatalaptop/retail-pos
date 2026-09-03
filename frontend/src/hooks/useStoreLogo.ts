import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";

const MAX_DIMENSION = 320; // logo is only ever shown small (header, receipt) — no need to keep it larger
const JPEG_QUALITY = 0.85;

function storageKey(storeId: number): string {
  return `retailpos:logo:${storeId}`;
}

// The logo is intentionally saved to this device's browser storage only, not
// synced to the backend — a deliberate choice (see the instruction that
// prompted this) so it never bloats the SQLite file that gets uploaded to
// Firebase Storage on every write, and matches the "device-local storage"
// architecture direction requested earlier for this app. The tradeoff is
// explicit in the Pengaturan UI: a logo set on one device/browser doesn't
// appear on another until set there too.
export function useStoreLogo() {
  const { user } = useAuth();
  const storeId = user?.storeId;
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!storeId) {
      setLogoUrl(null);
      return;
    }
    try {
      setLogoUrl(localStorage.getItem(storageKey(storeId)));
    } catch {
      setLogoUrl(null);
    }
  }, [storeId]);

  const setLogo = useCallback(
    (file: File): Promise<void> => {
      if (!storeId) return Promise.reject(new Error("Belum masuk"));
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error("Gagal membaca file"));
        reader.onload = () => {
          const img = new Image();
          img.onerror = () => reject(new Error("File bukan gambar yang valid"));
          img.onload = () => {
            // Downscale on a canvas regardless of source size, so an owner
            // can pick any photo straight from their phone without worrying
            // about file size — this keeps every stored logo small and
            // localStorage usage bounded no matter what they upload.
            const scale = Math.min(1, MAX_DIMENSION / Math.max(img.width, img.height));
            const canvas = document.createElement("canvas");
            canvas.width = Math.round(img.width * scale);
            canvas.height = Math.round(img.height * scale);
            const ctx = canvas.getContext("2d");
            if (!ctx) return reject(new Error("Kanvas tidak didukung"));
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            const dataUrl = canvas.toDataURL("image/jpeg", JPEG_QUALITY);
            try {
              localStorage.setItem(storageKey(storeId), dataUrl);
            } catch {
              return reject(new Error("Penyimpanan perangkat penuh, coba gambar lain"));
            }
            setLogoUrl(dataUrl);
            resolve();
          };
          img.src = reader.result as string;
        };
        reader.readAsDataURL(file);
      });
    },
    [storeId]
  );

  const clearLogo = useCallback(() => {
    if (!storeId) return;
    try {
      localStorage.removeItem(storageKey(storeId));
    } catch {
      // ignore — worst case the stale entry lingers until overwritten
    }
    setLogoUrl(null);
  }, [storeId]);

  return { logoUrl, setLogo, clearLogo };
}
