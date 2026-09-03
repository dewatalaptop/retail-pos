import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { api } from "../api/client";

export interface PublicSettings {
  storeName: string;
  receiptFooter: string;
  adsenseClientId: string;
  adsenseSlotFooter: string;
  adsenseSlotLogin: string;
  adsenseSlotReports: string;
}

const DEFAULT_SETTINGS: PublicSettings = {
  storeName: "Retail POS",
  receiptFooter: "Terima kasih telah berbelanja!",
  adsenseClientId: "",
  adsenseSlotFooter: "",
  adsenseSlotLogin: "",
  adsenseSlotReports: "",
};

interface SettingsContextValue {
  settings: PublicSettings;
  refresh: () => void;
}

const SettingsContext = createContext<SettingsContextValue | undefined>(undefined);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<PublicSettings>(DEFAULT_SETTINGS);

  function refresh() {
    // Public and unauthenticated on purpose (see backend/src/routes/settings.ts)
    // — the login page needs the store name and ad config before any token
    // exists. If it fails (e.g. backend briefly unreachable), keep whatever
    // defaults/previous values are already showing rather than blanking them.
    api<PublicSettings>("/settings/public")
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
