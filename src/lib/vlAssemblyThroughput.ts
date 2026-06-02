/** VL / EP 공정 처리량: Cycle time(초/ea) ↔ 시간당 목표(개/h) ↔ 8시간 목표 */

export function parseCycleTimeSeconds(
  raw: string | null | undefined
): number | null {
  if (raw == null || String(raw).trim() === "") return null;
  const n = Number.parseFloat(String(raw).trim().replace(",", "."));
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

export function formatCycleTimeForApi(seconds: number): string {
  const r = Math.round(seconds * 1000) / 1000;
  if (Math.abs(r - Math.round(r)) < 1e-9) return String(Math.round(r));
  return String(r);
}

export function targetQtyPerHourFromCycleSeconds(seconds: number): number {
  return Math.max(1, Math.round(3600 / seconds));
}

export function dailyTargetQty8hFromTargetPerHour(tph: number): number {
  return Math.round(tph * 8);
}

export type ThroughputProcessLike = {
  cycle_time?: string | null;
  target_qty_per_hour?: number | null;
  daily_target_qty_8h?: number | null;
};

/** 공정들 중 병목: 가장 긴 유효 사이클(초). cycle 미입력이면 target/h로 역산해 비교. */
export function bottleneckThroughputFromProcesses(
  processes: ThroughputProcessLike[]
): {
  cycleTimeDisplay: string;
  targetPerHour: number;
  dailyTarget: number;
} | null {
  let best: { sec: number; cycleLabel: string } | null = null;
  for (const p of processes) {
    const fromCycle = parseCycleTimeSeconds(p.cycle_time);
    const fromTph =
      p.target_qty_per_hour != null && p.target_qty_per_hour > 0
        ? 3600 / p.target_qty_per_hour
        : null;
    const sec = fromCycle != null ? fromCycle : fromTph;
    if (sec == null || !Number.isFinite(sec) || sec <= 0) continue;
    if (!best || sec > best.sec) {
      best = {
        sec,
        cycleLabel:
          fromCycle != null
            ? String(p.cycle_time).trim()
            : formatCycleTimeForApi(sec),
      };
    }
  }
  if (!best) return null;
  const tph = targetQtyPerHourFromCycleSeconds(best.sec);
  const daily = dailyTargetQty8hFromTargetPerHour(tph);
  return {
    cycleTimeDisplay: best.cycleLabel,
    targetPerHour: tph,
    dailyTarget: daily,
  };
}

/** SJ 상세와 동일: SJ 필드 우선, 없으면 하위 공정 병목 롤업 */
export type VlSjThroughputListLike = {
  cycle_time?: string | null;
  target_qty_per_hour?: number | null;
  daily_target_qty_8h?: number | null;
  ep_modules?: { ep_processes?: ThroughputProcessLike[] }[] | null;
};

export function vlSjThroughputDisplayFields(sj: VlSjThroughputListLike): {
  cycleDisplay: string | null;
  targetPerHour: number | null;
  dailyTarget8h: number | null;
} {
  const rollup =
    sj.ep_modules?.length ?
      bottleneckThroughputFromProcesses(sj.ep_modules.flatMap((m) => m.ep_processes ?? []))
    : null;
  const cycleDisplay =
    (sj.cycle_time?.trim() || "") || rollup?.cycleTimeDisplay || null;
  return {
    cycleDisplay,
    targetPerHour: sj.target_qty_per_hour ?? rollup?.targetPerHour ?? null,
    dailyTarget8h: sj.daily_target_qty_8h ?? rollup?.dailyTarget ?? null,
  };
}

/** 모듈 상세와 동일: 모듈 필드 우선, 없으면 해당 모듈 공정 병목 롤업 */
export type VlModuleThroughputListLike = ThroughputProcessLike & {
  ep_processes?: ThroughputProcessLike[] | null;
};

export function vlModuleThroughputDisplayFields(mod: VlModuleThroughputListLike): {
  cycleDisplay: string | null;
  targetPerHour: number | null;
  dailyTarget8h: number | null;
} {
  const rollup =
    mod.ep_processes?.length ? bottleneckThroughputFromProcesses(mod.ep_processes) : null;
  const cycleDisplay =
    (mod.cycle_time?.trim() || "") || rollup?.cycleTimeDisplay || null;
  return {
    cycleDisplay,
    targetPerHour: mod.target_qty_per_hour ?? rollup?.targetPerHour ?? null,
    dailyTarget8h: mod.daily_target_qty_8h ?? rollup?.dailyTarget ?? null,
  };
}
