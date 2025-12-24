// public/locale.js
// Detect best-effort locale from browser settings.
// We support English and Spanish first, with regional variants:
//  - en-US (default), en-GB
//  - es-ES, es-419 (LatAm default)

export function detectLocale() {
  const langs = (navigator.languages && navigator.languages.length
    ? navigator.languages
    : [navigator.language]
  ).filter(Boolean);

  const first = (langs[0] || "en-US").toLowerCase();
  const [langRaw, regionRaw] = first.split("-");
  const lang = (langRaw || "en").toLowerCase();
  const region = (regionRaw || "").toUpperCase();

  if (lang === "es") {
    return { lang: "es", variant: region === "ES" ? "es-ES" : "es-419" };
  }

  if (lang === "en") {
    return { lang: "en", variant: region === "GB" ? "en-GB" : "en-US" };
  }

  return { lang: "en", variant: "en-US" };
}
