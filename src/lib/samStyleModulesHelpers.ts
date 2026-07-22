import axios from "axios";
import type { ISamModule, ISamProcess } from "../api";
import { getProcessDetail } from "../api";
import {
  samProcessCycleSecondsFromParts
} from "./samProcessCycle";
import {
  samProcessSjMachineLabel,
  samProcessSjMachinePk
} from "./samProcessFk";
import type { SamSjMachinePick } from "../components/SamSjMachineSearchCombobox";

/** 공정 cycle_time 문자열을 초 단위 숫자로 파싱한다. */
export function parseCycleTimeToNumber(
  raw: string | null | undefined
): number | null {
  if (raw == null) return null;
  const t = String(raw).trim().replace(",", ".");
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/** Layout/SAM 공정에서 분석용 사이클(초) — parts 우선, 없으면 cycle_time */
export function layoutProcessCycleSecondsForAnalysis(p: {
  prep_seconds?: string | null;
  machining_seconds?: string | null;
  finishing_seconds?: string | null;
  cycle_time?: string | null;
}): number | null {
  return (
    samProcessCycleSecondsFromParts({
      prep_seconds: p.prep_seconds ?? null,
      machining_seconds: p.machining_seconds ?? null,
      finishing_seconds: p.finishing_seconds ?? null
    }) ?? parseCycleTimeToNumber(p.cycle_time)
  );
}

/** 모듈 하위 공정 수와 사이클(초) 합계 — 표시용 */
export function summarizeModuleProcesses(processes: ISamProcess[] | undefined): {
  processCount: number;
  cycleSum: number | null;
} {
  const list = processes ?? [];
  const processCount = list.length;
  let sum = 0;
  let nWithCycle = 0;
  for (const p of list) {
    const v = layoutProcessCycleSecondsForAnalysis(p);
    if (v != null) {
      sum += v;
      nWithCycle++;
    }
  }
  return {
    processCount,
    cycleSum: nWithCycle > 0 ? sum : null
  };
}

export type LayoutProcessAnalysis = {
  processCount: number;
  /** 공정 자체 사이클 + Helper 사이클 합계 (모듈/전체 집계용) */
  cycleSum: number | null;
  cycleAvg: number | null;
  cycleMin: number | null;
  cycleMax: number | null;
  /** 공정 자체 사이클 합계만 (Helper 제외) — 상세 지표에서 Helper와 구분해 보여줄 때 사용 */
  processCycleSum: number | null;
  /** Helper 사이클 합계만 */
  helperCycleSum: number | null;
  standardTimeSum: number | null;
  allowanceSum: number | null;
  missingCycleCount: number;
  /** M/P 합계 (공정 자체 + Helper) */
  manpowerSum: number | null;
  /** M/P 평균 */
  manpowerAvg: number | null;
  /** 공정 자체 M/P 합계만 (Helper 제외) */
  processManpowerSum: number | null;
  /** Helper M/P 합계만 */
  helperManpowerSum: number | null;
  /** UPMH 합계 (공정별 UPMH 합) */
  upmhSum: number | null;
  /** UPMH 평균 */
  upmhAvg: number | null;
  /** UPMH 최소 (= 병목, 사이클 최대 공정) */
  upmhMin: number | null;
  /** UPMH 최대 (가장 빠른 공정) */
  upmhMax: number | null;
  /** Target/H 합계 (공정별 UPMH×M/P 합) */
  targetSum: number | null;
  /** Target/H 평균 */
  targetAvg: number | null;
  /** Target/H 최소 (= 라인 병목 처리량) */
  targetMin: number | null;
  /** Target/H 최대 */
  targetMax: number | null;
  bottleneck: {
    pk: number;
    code: string;
    name: string;
    cycleSec: number;
    upmh: number | null;
    manpower: number | null;
    targetTotal: number | null;
  } | null;
};

function fmtAnalysisNum(n: number, digits = 1): string {
  if (Number.isInteger(n)) return String(n);
  const s = n.toFixed(digits);
  return s.replace(/\.?0+$/, "");
}

export function formatAnalysisMetricNumber(n: number | null, digits = 1): string {
  if (n == null) return "—";
  return fmtAnalysisNum(n, digits);
}

/** 공정 목록의 사이클·UPMH·M/P·Target/H·병목 등 분석 요약 */
export function analyzeLayoutProcesses(
  processes:
    | Array<{
        pk: number;
        code: string;
        name?: string | null;
        prep_seconds?: string | null;
        machining_seconds?: string | null;
        finishing_seconds?: string | null;
        cycle_time?: string | null;
        allowance_seconds?: string | null;
        manpower?: number | null;
        /** Helpers add to module/style cycle & manpower TOTALS only — never to this process's own
         * cycle/manpower/UPMH-total/bottleneck math (that stays based on the process's own values). */
        helpers?: Array<{ manpower?: number | null; cycle_time?: string | null }> | null;
      }>
    | undefined,
  upmhDivisorSeconds = 3600
): LayoutProcessAnalysis {
  const list = processes ?? [];
  let cycleSum = 0;
  let processCycleSum = 0;
  let helperCycleSum = 0;
  let nCycle = 0;
  let cycleMin: number | null = null;
  let cycleMax: number | null = null;
  let standardTimeSum = 0;
  let nStandardRows = 0;
  let allowanceSum = 0;
  let nAllowance = 0;
  let manpowerSum = 0;
  let processManpowerSum = 0;
  let helperManpowerSum = 0;
  let nManpower = 0;
  let upmhSum = 0;
  let nUpmh = 0;
  let upmhMin: number | null = null;
  let upmhMax: number | null = null;
  let targetSum = 0;
  let nTarget = 0;
  let targetMin: number | null = null;
  let targetMax: number | null = null;
  let bottleneck: LayoutProcessAnalysis["bottleneck"] = null;

  for (const p of list) {
    const cycleSec = layoutProcessCycleSecondsForAnalysis(p);
    const mp = p.manpower != null && Number.isFinite(p.manpower) ? p.manpower : null;
    const helpers = p.helpers ?? [];
    const helperMp = helpers.reduce((sum, h) => sum + (h.manpower != null && Number.isFinite(h.manpower) ? h.manpower : 0), 0);
    const helperCycleSec = helpers.reduce((sum, h) => sum + (parseCycleTimeToNumber(h.cycle_time) ?? 0), 0);
    if (mp != null || helperMp > 0) {
      manpowerSum += (mp ?? 0) + helperMp;
      processManpowerSum += mp ?? 0;
      helperManpowerSum += helperMp;
      nManpower++;
    }
    if (helperCycleSec > 0) {
      helperCycleSum += helperCycleSec;
      // A helper's cycle time counts toward the module/style total even if the process itself has none set.
      if (cycleSec == null) cycleSum += helperCycleSec;
    }

    if (cycleSec != null) {
      cycleSum += cycleSec + helperCycleSec;
      processCycleSum += cycleSec;
      nCycle++;
      if (cycleMin == null || cycleSec < cycleMin) cycleMin = cycleSec;
      if (cycleMax == null || cycleSec > cycleMax) cycleMax = cycleSec;
      const upmh = cycleSec > 0 ? upmhDivisorSeconds / cycleSec : null;
      const targetTotal = upmh != null && mp != null && mp > 0 ? upmh * mp : null;
      if (upmh != null) {
        upmhSum += upmh;
        nUpmh++;
        if (upmhMin == null || upmh < upmhMin) upmhMin = upmh;
        if (upmhMax == null || upmh > upmhMax) upmhMax = upmh;
      }
      if (targetTotal != null) {
        targetSum += targetTotal;
        nTarget++;
        if (targetMin == null || targetTotal < targetMin) targetMin = targetTotal;
        if (targetMax == null || targetTotal > targetMax) targetMax = targetTotal;
      }
      if (!bottleneck || cycleSec > bottleneck.cycleSec) {
        bottleneck = {
          pk: p.pk,
          code: p.code,
          name: (p.name ?? "").trim(),
          cycleSec,
          upmh,
          manpower: mp,
          targetTotal
        };
      }
    }
    const prep = parseCycleTimeToNumber(p.prep_seconds);
    const mach = parseCycleTimeToNumber(p.machining_seconds);
    const fin = parseCycleTimeToNumber(p.finishing_seconds);
    if (prep != null || mach != null || fin != null) {
      nStandardRows++;
      standardTimeSum += (prep ?? 0) + (mach ?? 0) + (fin ?? 0);
    }
    const allow = parseCycleTimeToNumber(p.allowance_seconds);
    if (allow != null) {
      allowanceSum += allow;
      nAllowance++;
    }
  }

  return {
    processCount: list.length,
    cycleSum: nCycle > 0 || helperCycleSum > 0 ? cycleSum : null,
    cycleAvg: nCycle > 0 ? processCycleSum / nCycle : null,
    cycleMin,
    cycleMax,
    processCycleSum: nCycle > 0 ? processCycleSum : null,
    helperCycleSum: helperCycleSum > 0 ? helperCycleSum : null,
    standardTimeSum: nStandardRows > 0 ? standardTimeSum : null,
    allowanceSum: nAllowance > 0 ? allowanceSum : null,
    missingCycleCount: list.length - nCycle,
    manpowerSum: nManpower > 0 ? manpowerSum : null,
    manpowerAvg: nManpower > 0 ? manpowerSum / nManpower : null,
    processManpowerSum: nManpower > 0 ? processManpowerSum : null,
    helperManpowerSum: helperManpowerSum > 0 ? helperManpowerSum : null,
    upmhSum: nUpmh > 0 ? upmhSum : null,
    upmhAvg: nUpmh > 0 ? upmhSum / nUpmh : null,
    upmhMin,
    upmhMax,
    targetSum: nTarget > 0 ? targetSum : null,
    targetAvg: nTarget > 0 ? targetSum / nTarget : null,
    targetMin,
    targetMax,
    bottleneck
  };
}

/** analyzeLayoutProcesses와 동일한 지표를, 원본 대신 특정 VL 측정 회차(1/2/3차) 값으로 계산한다.
 * 해당 회차 측정이 없는 공정은 사이클 미입력으로 취급되어(missingCycleCount) 요약에서 자연히 제외된다. */
export function analyzeLayoutProcessesForRound(
  processes:
    | Array<{
        pk: number;
        code: string;
        name?: string | null;
        measurements?: Array<{ round: number; cycle_time?: string | null; manpower?: number | null }> | null;
      }>
    | undefined,
  round: 1 | 2 | 3,
  upmhDivisorSeconds = 3600
): LayoutProcessAnalysis {
  const list = processes ?? [];
  const mapped = list.map((p) => {
    const measurement = (p.measurements ?? []).find((m) => m.round === round) ?? null;
    return {
      pk: p.pk,
      code: p.code,
      name: p.name,
      cycle_time: measurement?.cycle_time ?? null,
      prep_seconds: null,
      machining_seconds: null,
      finishing_seconds: null,
      manpower: measurement?.manpower ?? null
    };
  });
  return analyzeLayoutProcesses(mapped, upmhDivisorSeconds);
}

/** 데이터가 있는 가장 마지막(높은) VL 측정 회차의 분석 — 목록/요약 카드에서 "최신 VL 결과" 배지로 사용.
 * 회차는 순차 진행(1→2→3)이 전제이므로, 데이터가 있는 회차 중 가장 큰 번호를 최신으로 본다. */
export function latestRoundLayoutAnalysis(
  processes: Parameters<typeof analyzeLayoutProcessesForRound>[0],
  upmhDivisorSeconds = 3600
): { round: 1 | 2 | 3; analysis: LayoutProcessAnalysis } | null {
  for (const round of [3, 2, 1] as const) {
    const analysis = analyzeLayoutProcessesForRound(processes, round, upmhDivisorSeconds);
    if (analysis.processCount - analysis.missingCycleCount > 0) return { round, analysis };
  }
  return null;
}

/** 한 분류(카테고리) 안의 모든 모듈·공정에 대한 모듈 수·공정 수·사이클(초) 합계 */
export function summarizeCategoryModules(modules: Array<ISamModule | (Omit<ISamModule, "sam_processes"> & { layout_processes?: ISamProcess[] })>): {
  moduleCount: number;
  processCount: number;
  cycleSum: number | null;
  standardTimeSum: number | null;
  allowanceSum: number | null;
} {
  let processCount = 0;
  let cycleSum = 0;
  let nCycleValues = 0;
  let standardTimeSum = 0;
  let nStandardRows = 0;
  let allowanceSum = 0;
  let nAllowanceValues = 0;
  for (const mod of modules) {
    const procs = (mod as ISamModule).sam_processes ?? (mod as { layout_processes?: ISamProcess[] }).layout_processes ?? [];
    processCount += procs.length;
    for (const p of procs) {
      const v = layoutProcessCycleSecondsForAnalysis(p);
      if (v != null) {
        cycleSum += v;
        nCycleValues++;
      }
      const prep = parseCycleTimeToNumber(p.prep_seconds);
      const mach = parseCycleTimeToNumber(p.machining_seconds);
      const fin = parseCycleTimeToNumber(p.finishing_seconds);
      if (prep != null || mach != null || fin != null) {
        nStandardRows++;
        standardTimeSum += (prep ?? 0) + (mach ?? 0) + (fin ?? 0);
      }
      const allow = parseCycleTimeToNumber(p.allowance_seconds);
      if (allow != null) {
        allowanceSum += allow;
        nAllowanceValues++;
      }
    }
  }
  return {
    moduleCount: modules.length,
    processCount,
    cycleSum: nCycleValues > 0 ? cycleSum : null,
    standardTimeSum: nStandardRows > 0 ? standardTimeSum : null,
    allowanceSum: nAllowanceValues > 0 ? allowanceSum : null
  };
}

export function normalizeModuleCategoryPk(raw: unknown): number | null {
  if (raw == null) return null;
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw === "string" && raw.trim() !== "") {
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  }
  if (typeof raw === "object" && raw !== null && "pk" in raw) {
    const n = Number((raw as { pk: unknown }).pk);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export function samProcessMachinePickerInit(p: ISamProcess): SamSjMachinePick | null {
  const mpk = samProcessSjMachinePk(p);
  const label = samProcessSjMachineLabel(p);
  if (mpk != null && label) {
    const [code, ...rest] = label.split(" — ");
    return {
      pk: mpk,
      code: code.trim(),
      name: rest.join(" — ").trim()
    };
  }
  if (mpk != null) {
    return { pk: mpk, code: String(mpk), name: "" };
  }
  return null;
}

export function mergeUniquePhotoUrls(
  photosLists: Array<unknown[] | undefined>
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const photos of photosLists) {
    if (!Array.isArray(photos)) continue;
    for (const x of photos) {
      const r = x as { file?: string; url?: string };
      const u = (r.file ?? r.url ?? "").trim();
      if (u && !seen.has(u)) {
        seen.add(u);
        out.push(u);
      }
    }
  }
  return out;
}

/** Generic "why did this save fail" message for any PATCH/POST — surfaces the backend's actual
 * validation/detail message instead of a blanket "failed" toast, so a save that fails for a real
 * reason (stale session, server-side validation) doesn't look identical to a transient network blip. */
export function getApiErrorMessage(e: unknown, fallback = "Update failed"): string {
  if (!axios.isAxiosError(e)) {
    return e instanceof Error ? e.message : fallback;
  }
  if (!e.response) {
    return e.message || fallback;
  }
  const { status, data } = e.response;
  if (typeof data === "string") {
    if (data.includes("<!DOCTYPE") || data.includes("<html")) {
      return `Server error (${status}).`;
    }
    return data.trim() || `${fallback} (${status}).`;
  }
  if (typeof data === "object" && data !== null && !Array.isArray(data)) {
    const drf = formatDrfErrorPayload(data as Record<string, unknown>);
    if (drf) return drf;
  }
  return `${fallback} (${status}).`;
}

function formatDrfErrorPayload(o: Record<string, unknown>): string | null {
  const d = o.detail;
  if (typeof d === "string" && d.trim()) return d;
  if (Array.isArray(d) && d.length) {
    const msgs = d.filter((x): x is string => typeof x === "string");
    if (msgs.length) return msgs.join(" ");
  }
  const parts: string[] = [];
  for (const [key, val] of Object.entries(o)) {
    if (key === "detail" || key === "error_key") continue;
    if (Array.isArray(val) && val.every((x) => typeof x === "string")) {
      parts.push(`${key}: ${val.join(" ")}`);
    } else if (typeof val === "string") {
      parts.push(`${key}: ${val}`);
    }
  }
  if (parts.length) return parts.join("; ");
  return null;
}

function isSamModuleDuplicateCodeHtml(html: string): boolean {
  return (
    /uniq_sam_module_code_per_sam_style/i.test(html) ||
    (/UNIQUE constraint failed/i.test(html) &&
      /sam_style/i.test(html) &&
      /code/i.test(html) &&
      /sammodule/i.test(html.replace(/_/g, "")))
  );
}

export function formatSamModuleCreateError(
  e: unknown,
  t: (key: string, options?: { status: number }) => string
): string {
  if (!axios.isAxiosError(e) || e.response?.data == null) {
    return e instanceof Error ? e.message : String(e);
  }
  const raw = e.response.data;
  const status = e.response.status;

  if (typeof raw === "object" && raw !== null && !Array.isArray(raw)) {
    const o = raw as Record<string, unknown>;
    if (o.error_key === "sam_module_duplicate") {
      return t("vlLayouts.detail.errorModuleIntegrity");
    }
    if (o.error_key === "sam_process_duplicate") {
      return t("vlLayouts.detail.errorProcessDuplicate");
    }
    if (o.error_key === "integrity_error" && typeof o.detail === "string") {
      return o.detail;
    }
    const drf = formatDrfErrorPayload(o);
    if (drf) return drf;
  }

  if (
    typeof raw === "string" &&
    (raw.includes("<!DOCTYPE") || raw.includes("<html"))
  ) {
    if (isSamModuleDuplicateCodeHtml(raw)) {
      return t("vlLayouts.detail.errorModuleIntegrity");
    }
    return t("vlLayouts.list.errorHtml", { status });
  }

  const s = typeof raw === "string" ? raw : JSON.stringify(raw);
  return s.length > 400 ? `${s.slice(0, 400)}…` : s;
}

export function hasMergedProcessVideos(
  sam: ISamProcess,
  prod: Awaited<ReturnType<typeof getProcessDetail>> | null
): boolean {
  const std = (
    sam.standard_work_video_url ?? prod?.standard_work_video_url
  )?.trim();
  if (std) return true;
  for (const v of [...(sam.videos ?? []), ...(prod?.videos ?? [])]) {
    const raw =
      (v as { VideoFile?: string; video_file?: string }).VideoFile ??
      (v as { video_file?: string }).video_file;
    if (raw?.trim()) return true;
  }
  return false;
}

export function formatCycleSumForDisplay(n: number): string {
  if (Number.isInteger(n)) return String(n);
  const s = n.toFixed(3);
  return s.replace(/\.?0+$/, "");
}
