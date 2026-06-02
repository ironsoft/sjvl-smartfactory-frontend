import { isoToLocalDate, localDateToIso } from "./dateLocale";

/** 스케줄의 조립·공정 날짜들로부터 plan-holidays API 조회 범위 계산 */
export function planHolidayApiRangeForScheduleDates(
  dates: (string | null | undefined)[]
): { date_from: string; date_to: string } {
  const years: number[] = [];
  for (const raw of dates) {
    const d = isoToLocalDate(String(raw ?? "").slice(0, 10));
    if (d) years.push(d.getFullYear());
  }
  if (years.length === 0) {
    const y = new Date().getFullYear();
    return {
      date_from: `${y - 5}-01-01`,
      date_to: `${y + 5}-12-31`,
    };
  }
  const yMin = Math.min(...years);
  const yMax = Math.max(...years);
  return {
    date_from: `${yMin - 1}-01-01`,
    date_to: `${yMax + 1}-12-31`,
  };
}

/**
 * 조립/공정 기간 안에서 **등록 공휴일**으로 잡힌 날 중, 일요일이 아닌 날만 센다.
 * (일요일은 `sundayExcluded` 안내와 중복되지 않게 하기 위함.)
 */
export function countPlanHolidayDaysNonSundayInInclusiveRange(
  startIso: string | null | undefined,
  endIso: string | null | undefined,
  holidayYmdSet: ReadonlySet<string>
): number {
  const lo = isoToLocalDate(String(startIso ?? "").slice(0, 10));
  const hi = isoToLocalDate(String(endIso ?? "").slice(0, 10));
  if (!lo || !hi) return 0;
  const start = lo.getTime() <= hi.getTime() ? lo : hi;
  const end = lo.getTime() <= hi.getTime() ? hi : lo;
  const cur = new Date(start);
  let n = 0;
  while (cur.getTime() <= end.getTime()) {
    if (cur.getDay() !== 0) {
      const ymd = localDateToIso(cur);
      if (holidayYmdSet.has(ymd)) n += 1;
    }
    cur.setDate(cur.getDate() + 1);
  }
  return n;
}
