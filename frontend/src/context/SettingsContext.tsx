import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { api } from "../api/client";

export interface StoreSettings {
  storeName: string;
  receiptFooter: string;
  adsenseClientId: string;
  adsenseSlotFooter: string;
  adsenseSlotReports: string;
}

const DEFAULT_SETTINGS: StoreSettings = {
  storeName: "Retail POS",
  receiptFooter: "Terima kasih telah berbelanja!",
  adsenseClientId: "",
  adsenseSlotFooter: "",
  adsenseSlotReports: "",
};

interface SettingsContextValue {
  settings: StoreSettings;
  refresh: () => void;
}

const SettingsContext = createContext<SettingsContextValue | undefined>(undefined);

// Mounted inside the authenticated part of the route tree (see App.tsx) —
// with multiple stores now, there's no single store's branding to show on
// the pre-login pages, so this always fetches as the signed-in user.
export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<StoreSettings>(DEFAULT_SETTINGS);

  function refresh() {
    api<StoreSettings>("/settings")
      .then(setSettings)
      .catch(() => {});
  }

  useEffect(refresh, []);

  return <SettingsContext.Provider value={{ settings, refresh }}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used within SettingsProvider");
  return ctx;
}
