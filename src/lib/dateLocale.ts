/**
 * i18next language code → BCP 47 locale for Intl / react-calendar.
 */
export function getBcp47Locale(i18nLanguage: string): string {
  const base = (i18nLanguage || "en").split("-")[0].toLowerCase();
  const map: Record<string, string> = {
    en: "en-US",
    ko: "ko-KR",
    vi: "vi-VN",
  };
  return map[base] ?? "en-US";
}

/** Parse YYYY-MM-DD as local calendar date (avoids UTC shift). */
export function isoToLocalDate(iso: string): Date | null {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso.trim())) return null;
  const [y, m, d] = iso.trim().split("-").map(Number);
  if (!y || m < 1 || m > 12 || d < 1 || d > 31) return null;
  const dt = new Date(y, m - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) return null;
  return dt;
}

export function localDateToIso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Display ISO date (YYYY-MM-DD or API string) using the active UI language. */
export function formatIsoDateDisplay(
  iso: string | null | undefined,
  i18nLanguage: string
): string {
  if (!iso) return "-";
  const trimmed = String(iso).trim();
  const ymd = trimmed.slice(0, 10);
  const d = /^\d{4}-\d{2}-\d{2}$/.test(ymd) ? isoToLocalDate(ymd) : new Date(trimmed);
  if (!d || isNaN(d.getTime())) return trimmed;
  try {
    return new Intl.DateTimeFormat(getBcp47Locale(i18nLanguage), {
      dateStyle: "medium",
    }).format(d);
  } catch {
    return trimmed;
  }
}

/** ISO datetime string — date + short time in the active UI language. */
export function formatIsoDateTimeDisplay(
  iso: string | null | undefined,
  i18nLanguage: string
): string {
  if (!iso) return "-";
  const trimmed = String(iso).trim();
  const d = new Date(trimmed);
  if (isNaN(d.getTime())) return trimmed;
  try {
    return new Intl.DateTimeFormat(getBcp47Locale(i18nLanguage), {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(d);
  } catch {
    return trimmed;
  }
}
