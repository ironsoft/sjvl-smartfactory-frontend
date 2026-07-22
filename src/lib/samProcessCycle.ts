import type { ISamProcess } from "../api";

export function parseSamSecondsField(
  raw: string | null | undefined
): number | null {
  if (raw == null) return null;
  const t = String(raw).trim().replace(",", ".");
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/** Cycle (s) = prep + machining + finishing. Null if all three are empty. */
export function samProcessCycleSecondsFromParts(
  p: Pick<
    ISamProcess,
    "prep_seconds" | "machining_seconds" | "finishing_seconds"
  >
): number | null {
  const prep = parseSamSecondsField(p.prep_seconds);
  const mach = parseSamSecondsField(p.machining_seconds);
  const fin = parseSamSecondsField(p.finishing_seconds);
  if (prep == null && mach == null && fin == null) return null;
  return (prep ?? 0) + (mach ?? 0) + (fin ?? 0);
}

export function samProcessCycleSecondsFromFormStrings(
  prep: string,
  mach: string,
  fin: string
): number | null {
  return samProcessCycleSecondsFromParts({
    prep_seconds: prep,
    machining_seconds: mach,
    finishing_seconds: fin
  });
}

/** Display — UI에서 초 합계 등 (소수 최대 3자리). */
export function formatSamCycleSecondsDisplay(n: number): string {
  if (Number.isInteger(n)) return String(n);
  const s = n.toFixed(3);
  return s.replace(/\.?0+$/, "");
}

/** SAM 백엔드 DecimalField는 decimal_places=2 — 그 이상이면 DRF 400이 난다. */
const SAM_API_SECONDS_DECIMAL_PLACES = 2;

export function roundSamSecondsForApi(n: number): number {
  const p = 10 ** SAM_API_SECONDS_DECIMAL_PLACES;
  return Math.round(n * p) / p;
}

/** POST/PATCH용 초 문자열 — 소수부 최대 2자리. */
export function formatSamCycleSecondsForApi(n: number): string {
  const r = roundSamSecondsForApi(n);
  if (Number.isInteger(r)) return String(r);
  const s = r.toFixed(SAM_API_SECONDS_DECIMAL_PLACES);
  return s.replace(/\.?0+$/, "");
}

/** 폼 입력 문자열을 파싱한 뒤 API 허용 소수 자릿수로 맞춘다. */
export function sanitizeSamSecondsStringForApi(raw: string): string | null {
  const n = parseSamSecondsField(raw);
  if (n == null) return null;
  return formatSamCycleSecondsForApi(n);
}

const SAM_PROCESS_SORT_FALLBACK = 2147483647;

/** 모듈 내 공정 목록 정렬: sort_order 오름차순, 없으면 뒤로, 동일 시 pk */
export function compareSamProcessBySortOrder(a: ISamProcess, b: ISamProcess): number {
  const ao = a.sort_order;
  const bo = b.sort_order;
  const av =
    ao != null && Number.isFinite(ao) ? ao : SAM_PROCESS_SORT_FALLBACK;
  const bv =
    bo != null && Number.isFinite(bo) ? bo : SAM_PROCESS_SORT_FALLBACK;
  if (av !== bv) return av - bv;
  return a.pk - b.pk;
}

export function formatSamProcessSortOrderDisplay(p: ISamProcess): string {
  if (p.sort_order != null && Number.isFinite(p.sort_order)) {
    return String(p.sort_order);
  }
  return "—";
}
