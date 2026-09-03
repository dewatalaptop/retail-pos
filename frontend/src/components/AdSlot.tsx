import { useEffect, useRef } from "react";

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

// The AdSense loader script is the same for every slot on the page, so it's
// only ever requested once per client id, however many <AdSlot>s render.
const loadedClients = new Set<string>();
function loadAdsenseScript(clientId: string): void {
  if (loadedClients.has(clientId) || document.querySelector(`script[data-adsense-client="${clientId}"]`)) return;
  loadedClients.add(clientId);
  const script = document.createElement("script");
  script.async = true;
  script.crossOrigin = "anonymous";
  script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${clientId}`;
  script.dataset.adsenseClient = clientId;
  document.head.appendChild(script);
}

/**
 * One Google AdSense placement. Renders a labeled placeholder box (same
 * footprint as a real ad, so layout doesn't jump once one is configured)
 * until the platform operator sets ADSENSE_CLIENT_ID/ADSENSE_SLOT_* env vars
 * (see backend/src/routes/settings.ts) — this is platform-level monetization,
 * not a per-store setting, so the placeholder must never tell a store owner
 * to go configure it themselves in Pengaturan (that field doesn't exist
 * there anymore — see the theme's AdSense-removal history for why).
 */
export default function AdSlot({
  clientId,
  slotId,
  className = "",
}: {
  clientId?: string;
  slotId?: string;
  className?: string;
}) {
  const pushedRef = useRef(false);

  useEffect(() => {
    if (!clientId || !slotId) return;
    loadAdsenseScript(clientId);
    // The script loads async and may not have defined window.adsbygoogle
    // yet — pushing to the array is safe either way since AdSense itself
    // initializes it as `[]` before processing the queue.
    try {
      pushedRef.current = true;
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {
      // Ad blockers routinely throw here — the placeholder styling below
      // already gives the slot a sane empty footprint, so there's nothing
      // further to degrade to.
    }
  }, [clientId, slotId]);

  if (!clientId || !slotId) {
    return (
      <div
        className={`flex min-h-[90px] items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 text-xs text-slate-400 ${className}`}
      >
        Ruang iklan
      </div>
    );
  }

  return (
    <ins
      key={slotId}
      className={`adsbygoogle block ${className}`}
      style={{ display: "block", minHeight: pushedRef.current ? undefined : 90 }}
      data-ad-client={clientId}
      data-ad-slot={slotId}
      data-ad-format="auto"
      data-full-width-responsive="true"
    />
  );
}
