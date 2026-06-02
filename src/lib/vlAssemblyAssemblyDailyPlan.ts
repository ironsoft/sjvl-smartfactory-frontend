/** VL Assembly 조립 일일 계획 수량 (일요일·계획 공휴일 제외 근무일, 8h/일 1 day 단위) — 목록 캘린더와 동일 규칙 */

export function ymdFromLocalDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function parseLocalMidnightFromIso(
  iso: string | null | undefined
): Date | null {
  if (iso == null || iso === "") return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  d.setHours(0, 0, 0, 0);
  return d;
}

export function parseYmdToLocalDate(ymd: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
  const [y, m, day] = ymd.split("-").map(Number);
  const d = new Date(y, m - 1, day);
  if (Number.isNaN(d.getTime())) return null;
  d.setHours(0, 0, 0, 0);
  return d;
}

export function countPlanWorkDays(
  a: Date,
  b: Date,
  excludedHolidayYmds: ReadonlySet<string>
): number {
  const lo = a.getTime() <= b.getTime() ? new Date(a) : new Date(b);
  const hi = a.getTime() <= b.getTime() ? new Date(b) : new Date(a);
  lo.setHours(0, 0, 0, 0);
  hi.setHours(0, 0, 0, 0);
  if (lo.getTime() > hi.getTime()) return 0;
  let n = 0;
  const cur = new Date(lo);
  while (cur.getTime() <= hi.getTime()) {
    const ymd = ymdFromLocalDate(cur);
    if (cur.getDay() !== 0 && !excludedHolidayYmds.has(ymd)) n += 1;
    cur.setDate(cur.getDate() + 1);
  }
  return n;
}

export function getDailyPlannedQtyFromRange(
  startIso: string | null | undefined,
  endIso: string | null | undefined,
  totalQty: number,
  excludedHolidayYmds: ReadonlySet<string> = new Set()
): { daily: number; workDays: number } | null {
  if (totalQty <= 0) return null;
  const sDate = parseLocalMidnightFromIso(startIso);
  const eDate = parseLocalMidnightFromIso(endIso);
  if (!sDate || !eDate) return null;
  const lo = sDate.getTime() <= eDate.getTime() ? sDate : eDate;
  const hi = sDate.getTime() <= eDate.getTime() ? eDate : sDate;
  const w = countPlanWorkDays(lo, hi, excludedHolidayYmds);
  if (w < 1) return null;
  return { daily: Math.max(0, Math.round(totalQty / w)), workDays: w };
}

export function getAssemblyDailyPlannedQtyFromTotal(
  s: {
    production_assembly_start_date?: string | null;
    production_assembly_finish_date?: string | null;
  },
  totalQty: number,
  excludedHolidayYmds: ReadonlySet<string> = new Set()
): { daily: number; workDays: number } | null {
  return getDailyPlannedQtyFromRange(
    s.production_assembly_start_date,
    s.production_assembly_finish_date,
    totalQty,
    excludedHolidayYmds
  );
}

export function isYmdInAssemblyPeriod(
  ymd: string,
  startIso: string | null | undefined,
  endIso: string | null | undefined
): boolean {
  const d = parseYmdToLocalDate(ymd);
  const s = parseLocalMidnightFromIso(startIso);
  const e = parseLocalMidnightFromIso(endIso);
  if (!d || !s || !e) return false;
  const lo = s.getTime() <= e.getTime() ? s : e;
  const hi = s.getTime() <= e.getTime() ? e : s;
  return d.getTime() >= lo.getTime() && d.getTime() <= hi.getTime();
}

export function isPlanWorkdayYmd(
  ymd: string,
  excludedHolidayYmds: ReadonlySet<string>
): boolean {
  const d = parseYmdToLocalDate(ymd);
  if (!d) return false;
  if (d.getDay() === 0) return false;
  return !excludedHolidayYmds.has(ymd);
}

/** 해당 로컬일: 조립 기간 내 근무(계획)일이면 일당 계획 수량, 아니면 0 */
export function plannedQtyForCalendarDay(
  ymd: string,
  schedule: {
    production_assembly_start_date?: string | null;
    production_assembly_finish_date?: string | null;
  },
  planDaily: number | null | undefined,
  holidaySet: ReadonlySet<string>
): number {
  const pd = planDaily != null ? Number(planDaily) : 0;
  if (pd <= 0) return 0;
  if (
    !isYmdInAssemblyPeriod(
      ymd,
      schedule.production_assembly_start_date,
      schedule.production_assembly_finish_date
    )
  ) {
    return 0;
  }
  if (!isPlanWorkdayYmd(ymd, holidaySet)) return 0;
  return pd;
}

/** 일당 계획을 8시간으로 균등 분배한 시간당 계획(반올림) */
export function plannedQtyPerPlanHour(planDaily: number): number {
  if (planDaily <= 0) return 0;
  return Math.max(0, Math.round(planDaily / 8));
}

export function formatAchievementPct(actual: number, planned: number): string {
  if (planned <= 0) return "—";
  const pct = Math.round((actual / planned) * 100);
  return `${Math.min(9999, pct).toLocaleString()}%`;
}

export function enumerateYmdsInclusive(loYmd: string, hiYmd: string): string[] {
  const a = parseYmdToLocalDate(loYmd);
  const b = parseYmdToLocalDate(hiYmd);
  if (!a || !b) return [];
  const start = a.getTime() <= b.getTime() ? a : b;
  const end = a.getTime() <= b.getTime() ? b : a;
  const out: string[] = [];
  const cur = new Date(start);
  while (cur.getTime() <= end.getTime()) {
    out.push(ymdFromLocalDate(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}
