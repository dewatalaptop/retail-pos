import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { api } from "../api/client";

export type BusinessMode = "toko" | "warung" | "restoran";

export interface StoreSettings {
  storeName: string;
  storeAddress: string;
  storePhone: string;
  receiptFooter: string;
  theme: string;
  defaultTaxRatePercent: number;
  businessMode: BusinessMode;
  defaultServiceChargePercent: number;
  adsenseClientId: string;
  adsenseSlotFooter: string;
  adsenseSlotReports: string;
}

const DEFAULT_SETTINGS: StoreSettings = {
  storeName: "Retail POS",
  storeAddress: "",
  storePhone: "",
  receiptFooter: "Terima kasih telah berbelanja!",
  theme: "indigo",
  defaultTaxRatePercent: 0,
  businessMode: "toko",
  defaultServiceChargePercent: 0,
  adsenseClientId: "",
  adsenseSlotFooter: "",
  adsenseSlotReports: "",
};

interface SettingsContextValue {
  settings: StoreSettings;
  loading: boolean;
  refresh: () => void;
}

const SettingsContext = createContext<SettingsContextValue | undefined>(undefined);

// Mounted inside the authenticated part of the route tree (see App.tsx) —
// with multiple stores now, there's no single store's branding to show on
// the pre-login pages, so this always fetches as the signed-in user.
export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<StoreSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

  function refresh() {
    api<StoreSettings>("/settings")
      .then(setSettings)
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  useEffect(refresh, []);

  // The color theme is a per-store choice (see Pengaturan), applied globally
  // via a data attribute that index.css's [data-theme="…"] blocks key off of
  // — every component reads the resulting CSS variables instead of a
  // hardcoded Tailwind color. Pre-login pages never mount this provider, so
  // they keep the "indigo" default defined on :root.
  useEffect(() => {
    document.documentElement.dataset.theme = settings.theme;
    return () => {
      delete document.documentElement.dataset.theme;
    };
  }, [settings.theme]);

  return (
    <SettingsContext.Provider value={{ settings, loading, refresh }}>{children}</SettingsContext.Provider>
  );
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used within SettingsProvider");
  return ctx;
}
