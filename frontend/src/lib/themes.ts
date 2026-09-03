export interface ThemeOption {
  name: string;
  label: string;
  swatch: string; // a representative hex for the theme picker swatch dot
}

// Keep the `name` list in sync with THEME_NAMES in backend/src/routes/settings.ts
// (the server rejects anything not in that allowlist) and with the CSS
// variable overrides in index.css (each name needs a matching [data-theme="…"] block).
export const THEMES: ThemeOption[] = [
  { name: "indigo", label: "Indigo", swatch: "#4f46e5" },
  { name: "emerald", label: "Hijau", swatch: "#059669" },
  { name: "amber", label: "Oranye", swatch: "#d97706" },
  { name: "rose", label: "Merah", swatch: "#e11d48" },
  { name: "sky", label: "Biru", swatch: "#0284c7" },
  { name: "slate", label: "Gelap", swatch: "#334155" },
];
