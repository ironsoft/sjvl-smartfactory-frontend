import {
  Box,
  Button,
  Collapse,
  HStack,
  IconButton,
  Image,
  Input,
  InputGroup,
  InputLeftElement,
  InputRightElement,
  keyframes,
  Link,
  Modal,
  Skeleton,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalOverlay,
  SimpleGrid,
  Table,
  Tag,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tooltip,
  Tr,
  useColorModeValue,
  useDisclosure,
  VStack
} from "@chakra-ui/react";
import { useQuery } from "@tanstack/react-query";
import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { MouseEvent, ReactNode } from "react";
import { FiChevronDown, FiChevronRight, FiSearch, FiX } from "react-icons/fi";
import { FaThumbtack, FaThLarge, FaProjectDiagram } from "react-icons/fa";
import { Helmet } from "react-helmet";
import { useTranslation } from "react-i18next";
import { Link as RouterLink } from "react-router-dom";
import {
  getLayoutStyles,
  getVlAssemblyModuleProductionDailyOutputs,
  getVlAssemblySchedules,
  getVlAssemblyScheduleProductionDailyOutputs,
  getVlPlanHolidays,
  IEpModuleCopy,
  IEpSjNoCopy,
  IVlAssemblyModuleProductionDailyOutput,
  IVlAssemblySchedule,
  IVlAssemblyScheduleProductionDailyOutput
} from "../api";
import ScheduleCalendarHeatmap from "../components/ScheduleCalendarHeatmap";
import { isoToLocalDate, localDateToIso } from "../lib/dateLocale";
import { openAppPopupWindow } from "../lib/openAppPopupWindow";
import { planHolidayApiRangeForScheduleDates } from "../lib/vlPlanHolidayRange";

const PERIODS: { key: string; start: string }[] = [
  { key: "D1", start: "07:30" },
  { key: "D2", start: "08:25" },
  { key: "D3", start: "09:20" },
  { key: "D4", start: "10:15" },
  { key: "D5", start: "11:10" },
  { key: "D6", start: "13:05" },
  { key: "D7", start: "14:00" },
  { key: "D8", start: "14:55" },
  { key: "OT1", start: "15:50" },
  { key: "OT2", start: "16:45" },
  { key: "OT3", start: "" },
  { key: "OT4", start: "" },
  { key: "OT5", start: "" }
];

/**
 * Elapsed effective work hours since shift start (07:30), excluding the lunch break
 * (12:05–13:05, derived from the D5→D6 period gap), capped at the 8h daily-target basis.
 * Used to pace-adjust today's achievement rate against how much of the shift has actually elapsed.
 */
function elapsedWorkHoursForPacing(now: Date): number {
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const SHIFT_START_MIN = 450; // 07:30
  const LUNCH_START_MIN = 725; // 12:05
  const LUNCH_END_MIN = 785; // 13:05
  const MAX_WORK_MIN = 480; // 8h
  let elapsedMin = 0;
  if (nowMin > SHIFT_START_MIN) elapsedMin += Math.min(nowMin, LUNCH_START_MIN) - SHIFT_START_MIN;
  if (nowMin > LUNCH_END_MIN) elapsedMin += nowMin - LUNCH_END_MIN;
  return Math.max(0, Math.min(elapsedMin, MAX_WORK_MIN)) / 60;
}

const currentPeriodPulse = keyframes`
  0%   { box-shadow: inset 0 0 6px 1px rgba(66, 153, 225, 0.05); }
  50%  { box-shadow: inset 0 0 10px 2px rgba(66, 153, 225, 0.16); }
  100% { box-shadow: inset 0 0 6px 1px rgba(66, 153, 225, 0.05); }
`;

function periodIndexForMinutes(minutesOfDay: number) {
  let activeIdx = -1;
  for (let i = 0; i < PERIODS.length; i++) {
    const { start } = PERIODS[i];
    if (!start) continue;
    const [h, m] = start.split(":").map(Number);
    if (minutesOfDay >= h * 60 + m) activeIdx = i;
    else break;
  }
  return activeIdx;
}

function getCurrentPeriodIndex(now: Date) {
  return periodIndexForMinutes(now.getHours() * 60 + now.getMinutes());
}

/** Buckets a production timestamp into a PERIODS index (D1..OT5), or -1 if it falls before the first period start. */
function periodIndexForTimestamp(recordedAt: string) {
  const d = new Date(recordedAt);
  if (Number.isNaN(d.getTime())) return -1;
  return periodIndexForMinutes(d.getHours() * 60 + d.getMinutes());
}

/** Counts working days (Sundays and registered holidays excluded) from today through the Ex-Fty date, inclusive. */
function countRemainingWorkdays(exftyIso: string, todayIso: string, holidayYmdSet: ReadonlySet<string>): number | null {
  const start = isoToLocalDate(todayIso);
  const end = isoToLocalDate(exftyIso);
  if (!start || !end) return null;
  if (end.getTime() < start.getTime()) return null;
  let n = 0;
  const cur = new Date(start);
  while (cur.getTime() <= end.getTime()) {
    if (cur.getDay() !== 0 && !holidayYmdSet.has(localDateToIso(cur))) n++;
    cur.setDate(cur.getDate() + 1);
  }
  return n;
}

/** Walks backward from endIso, counting working days (Sundays/holidays excluded), until `count` are found. Returns the start date reached. */
function workdaysBeforeInclusive(endIso: string, count: number, holidayYmdSet: ReadonlySet<string>): string {
  const end = isoToLocalDate(endIso);
  if (!end) return endIso;
  let remaining = count;
  const cur = new Date(end);
  while (remaining > 0) {
    const isWorking = cur.getDay() !== 0 && !holidayYmdSet.has(localDateToIso(cur));
    if (isWorking) remaining--;
    if (remaining === 0) break;
    cur.setDate(cur.getDate() - 1);
  }
  return localDateToIso(cur);
}

/** Estimates the assembly-period start date for a row from its remaining balance and daily target rate. Only used as a fallback when the schedule has no real assembly start date. */
function estimateAssemblyStart(row: Row, holidayYmdSet: ReadonlySet<string>): string {
  const balNum = Number(String(row.balQty).replace(/,/g, "")) || 0;
  const requiredDays = Math.max(3, Math.ceil(balNum / Math.max(row.target, 1)));
  return workdaysBeforeInclusive(row.exfty, requiredDays, holidayYmdSet);
}

/** Prefers the schedule's real assembly start date; falls back to the balance/target estimate only when it's missing. */
function resolveAssemblyStart(row: Row, holidayYmdSet: ReadonlySet<string>): string {
  return row.assemblyStart ?? estimateAssemblyStart(row, holidayYmdSet);
}

type Row = {
  line: string;
  group?: string;
  target: number;
  /** real cycle-time-based target/hour; falls back to target/8 when not set */
  targetPerHour?: number;
  po: string;
  schedulePk: number;
  /** buyer/brand name, for the summary bar's brand count */
  brand?: string;
  /** SJ Style pk — used to open the linked Layout document */
  sjStylePk?: number | null;
  style: string;
  /** the SJ No pk, for linking to its detail page */
  sjNoPk: number;
  sjNo: string;
  /** SJ Style product photo URL; falls back to a generated placeholder swatch when absent */
  thumbnail?: string;
  exfty: string;
  /** the schedule's real assembly start date, when set; falls back to an estimate when absent */
  assemblyStart?: string;
  orderQty: string;
  balQty: string;
  today: number;
  periods: number[];
  targetPct: number;
  /** pace-adjusted achievement: today's output vs. (targetPerHour × elapsed work-hours so far). Undefined when not viewing today or target/hour is unknown. */
  hourlyPct?: number;
  /** index into PERIODS of the flagged (attention) cell, if any */
  flagIdx?: number;
  /** achievement % from the "BẢNG THEO DÕI TARGET" sheet, aligned to PERIODS indices 0-3 (D1-D4) */
  pcts?: ({ value: string; tone: Tone } | undefined)[];
  /** extra columns shown when the Target Qty column is expanded */
  extra?: { targetBD?: number; snlBD?: number; targetVL?: number; snlVL?: number; snlThucTeLine?: number };
  /** real per-module breakdown (replaces the row, shown when expanded) */
  modules?: ModuleRow[];
};

type ModuleRow = {
  pk: number;
  code: string;
  name: string;
  orderQty: string;
  balQty: string;
  today: number;
  periods: number[];
  /** the module's own process start/finish dates, when entered; production schedule columns only render for the module when both are set */
  processStart?: string;
  processFinish?: string;
  /** the module's own daily target (8h); when unset, target/targetPct render blank instead of a misleading 0% */
  target?: number;
  targetPerHour?: number;
  targetPct?: number;
  hourlyPct?: number;
  pcts?: ({ value: string; tone: Tone } | undefined)[];
};

/** Sorts by trailing line number (VL — LINE 01 before VL — LINE 07); lines without a trailing number (e.g. "VL — PREPARATION") sort last. */
function compareLineName(a?: string | null, b?: string | null) {
  const an = a ?? "";
  const bn = b ?? "";
  const aNum = an.match(/(\d+)\s*$/);
  const bNum = bn.match(/(\d+)\s*$/);
  const aKey = aNum ? parseInt(aNum[1], 10) : Number.MAX_SAFE_INTEGER;
  const bKey = bNum ? parseInt(bNum[1], 10) : Number.MAX_SAFE_INTEGER;
  if (aKey !== bKey) return aKey - bKey;
  return an.localeCompare(bn, undefined, { sensitivity: "base" });
}

/** A schedule shows up for a given date when that date falls inside its planned assembly window, or when output was actually recorded for it that day. */
function isScheduleActiveOn(schedule: IVlAssemblySchedule, viewDateIso: string, hasOutputOnDate: boolean) {
  const start = schedule.production_assembly_start_date;
  const end = schedule.production_assembly_finish_date;
  const inWindow = start && end ? start <= viewDateIso && viewDateIso <= end : start ? start <= viewDateIso : end ? viewDateIso <= end : false;
  return inWindow || hasOutputOnDate;
}

function formatQty(n: number | null | undefined) {
  return n == null ? "" : n.toLocaleString();
}

async function fetchVlScheduleDailyOutputsForDay(dayIso: string): Promise<IVlAssemblyScheduleProductionDailyOutput[]> {
  const pageSize = 200;
  let page = 1;
  const all: IVlAssemblyScheduleProductionDailyOutput[] = [];
  for (;;) {
    const res = await getVlAssemblyScheduleProductionDailyOutputs({ date_from: dayIso, date_to: dayIso, page, page_size: pageSize });
    all.push(...res.results);
    if (res.results.length < pageSize) break;
    page += 1;
  }
  return all;
}

async function fetchVlModuleDailyOutputsForDay(dayIso: string): Promise<IVlAssemblyModuleProductionDailyOutput[]> {
  const pageSize = 200;
  let page = 1;
  const all: IVlAssemblyModuleProductionDailyOutput[] = [];
  for (;;) {
    const res = await getVlAssemblyModuleProductionDailyOutputs({ date_from: dayIso, date_to: dayIso, page, page_size: pageSize });
    all.push(...res.results);
    if (res.results.length < pageSize) break;
    page += 1;
  }
  return all;
}

/** Builds a Row per SJ No (flattened across every active schedule), with today's output bucketed into PERIODS from raw daily-output timestamps. */
function buildRows(
  schedules: IVlAssemblySchedule[],
  scheduleDailyRows: IVlAssemblyScheduleProductionDailyOutput[],
  moduleDailyRows: IVlAssemblyModuleProductionDailyOutput[]
): Row[] {
  const periodsBySjNo = new Map<number, number[]>();
  const totalBySjNo = new Map<number, number>();
  for (const r of scheduleDailyRows) {
    if (r.vl_assembly_sj_no == null) continue;
    const idx = periodIndexForTimestamp(r.recorded_at);
    if (!periodsBySjNo.has(r.vl_assembly_sj_no)) periodsBySjNo.set(r.vl_assembly_sj_no, new Array(PERIODS.length).fill(0));
    if (idx >= 0) periodsBySjNo.get(r.vl_assembly_sj_no)![idx] += r.qty;
    totalBySjNo.set(r.vl_assembly_sj_no, (totalBySjNo.get(r.vl_assembly_sj_no) ?? 0) + r.qty);
  }
  const periodsByModule = new Map<number, number[]>();
  const totalByModule = new Map<number, number>();
  for (const r of moduleDailyRows) {
    const idx = periodIndexForTimestamp(r.recorded_at);
    if (!periodsByModule.has(r.vl_assembly_module)) periodsByModule.set(r.vl_assembly_module, new Array(PERIODS.length).fill(0));
    if (idx >= 0) periodsByModule.get(r.vl_assembly_module)![idx] += r.qty;
    totalByModule.set(r.vl_assembly_module, (totalByModule.get(r.vl_assembly_module) ?? 0) + r.qty);
  }

  const rows: Row[] = [];
  for (const schedule of schedules) {
    const sjNos: IEpSjNoCopy[] = schedule.ep_sj_nos ?? schedule.vl_assembly_sj_nos ?? [];
    const exfty = schedule.production_assembly_finish_date ?? schedule.sj_order_info?.ex_factory_date ?? "";
    const assemblyStart = schedule.production_assembly_start_date ?? undefined;
    const po = schedule.sj_order_info?.sj_po_number ?? "";
    const brand = schedule.sj_order_info?.buyer_name?.name ?? schedule.sj_order_info?.buyer_name?.code ?? undefined;
    for (const sj of sjNos) {
      const style = sj.sj_style_name ?? schedule.sj_order_info?.sj_style?.style_name ?? schedule.sj_order_info?.style_name ?? sj.sj_no;
      const sjStylePk = schedule.sj_order_info?.sj_style?.pk ?? null;
      const thumbnail = sj.sj_style_thumbnail ?? schedule.sj_order_info?.sj_style?.thumbnail ?? undefined;
      const target = sj.daily_target_qty_8h ?? 0;
      const targetPerHour = sj.target_qty_per_hour ?? (target > 0 ? Math.round(target / 8) : undefined);
      const today = totalBySjNo.get(sj.pk) ?? 0;
      const periods = periodsBySjNo.get(sj.pk) ?? new Array(PERIODS.length).fill(0);
      const orderQtyNum = sj.total_qty ?? sj.vl_qty ?? undefined;
      const balQtyNum = orderQtyNum != null ? Math.max(orderQtyNum - (sj.output_qty ?? 0), 0) : undefined;
      const modules: ModuleRow[] = (sj.ep_modules ?? []).map((mod: IEpModuleCopy) => {
        const modToday = totalByModule.get(mod.pk) ?? 0;
        const modTarget = mod.daily_target_qty_8h ?? undefined;
        const modTargetPerHour = mod.target_qty_per_hour ?? (modTarget != null && modTarget > 0 ? Math.round(modTarget / 8) : undefined);
        return {
          pk: mod.pk,
          code: mod.code,
          name: mod.name,
          orderQty: formatQty(mod.total_qty),
          balQty: mod.total_qty != null ? formatQty(Math.max(mod.total_qty - (mod.output_qty ?? 0), 0)) : "",
          today: modToday,
          periods: periodsByModule.get(mod.pk) ?? new Array(PERIODS.length).fill(0),
          processStart: mod.process_start_date ?? undefined,
          processFinish: mod.process_finish_date ?? undefined,
          target: modTarget,
          targetPerHour: modTargetPerHour,
          targetPct: modTarget != null && modTarget > 0 ? (modToday / modTarget) * 100 : undefined
        };
      });
      rows.push({
        line: schedule.production_line_name ?? "",
        po,
        brand,
        schedulePk: schedule.pk,
        sjStylePk,
        style,
        sjNoPk: sj.pk,
        sjNo: sj.sj_no,
        thumbnail: thumbnail ?? undefined,
        exfty,
        assemblyStart,
        orderQty: formatQty(orderQtyNum),
        balQty: formatQty(balQtyNum),
        today,
        periods,
        target,
        targetPerHour,
        targetPct: target > 0 ? (today / target) * 100 : 0,
        modules,
        extra: {
          targetBD: sj.source_target_qty_per_hour ?? undefined,
          snlBD: sj.source_daily_target_qty_8h ?? undefined,
        }
      });
    }
  }
  return rows;
}

const LEADING_COLUMNS = ["line", "group", "po", "thumbnail", "style", "layout", "exfty", "orderQty", "balQty", "today"];

/** Canonical left-to-right order of every column that can be individually pinned, and a fallback
 * display width used only until its real rendered width has been measured — used to compute each
 * pinned column's cumulative sticky `left` offset (only the widths of columns that are ALSO pinned
 * are summed, so any subset/combination works). */
const PINNABLE_COL_ORDER = [
  "line", "group", "po", "thumbnail", "style", "layout", "exfty",
  "orderQty", "balQty", "today", "targetPct", "targetPctHourly", "targetPerHour", "target"
];
const PINNABLE_COL_FALLBACK_WIDTH: Record<string, number> = {
  line: 100, group: 74, po: 90, thumbnail: 64, style: 140, layout: 88, exfty: 100,
  orderQty: 90, balQty: 90, today: 70, targetPct: 90, targetPctHourly: 100, targetPerHour: 90, target: 80
};
const PINNED_COLS_STORAGE_KEY = "vlErpDashboard_pinnedCols";
/** LINE# is always pinned — it's excluded from DEFAULT_PINNED_COLS handling below and can't be unpinned. */
const ALWAYS_PINNED_COL = "line";
const DEFAULT_PINNED_COLS = [ALWAYS_PINNED_COL];

/** Breaks a header label at a semantic boundary (after "/" if present, else at the first space) instead of
 * letting the browser wrap mid-word — e.g. "Target/Hour" → "Target/" \n "Hour", "Hourly Avg" → "Hourly" \n "Avg". */
function twoLineHeaderLabel(label: string) {
  const slashIdx = label.indexOf("/");
  if (slashIdx !== -1) {
    return (
      <>
        {label.slice(0, slashIdx + 1)}
        <br />
        {label.slice(slashIdx + 1)}
      </>
    );
  }
  const spaceIdx = label.indexOf(" ");
  if (spaceIdx !== -1) {
    return (
      <>
        {label.slice(0, spaceIdx)}
        <br />
        {label.slice(spaceIdx + 1)}
      </>
    );
  }
  return label;
}

/** Renders a header as a bold primary label with a smaller, muted secondary label underneath —
 * e.g. main "TARGET QTY" + sub "VL · Day(8H)" — instead of one long run-on string. */
function twoTierHeaderLabel(main: string, sub: string, mutedColor: string) {
  return (
    <VStack spacing={0} align="center" lineHeight={1.1}>
      <Text as="span">{main}</Text>
      <Text as="span" fontSize="9px" fontWeight="normal" letterSpacing="normal" textTransform="none" color={mutedColor}>
        {sub}
      </Text>
    </VStack>
  );
}

const THUMB_COLORS = ["#4299E1", "#48BB78", "#ED8936", "#9F7AEA", "#ED64A6", "#38B2AC", "#ECC94B", "#F56565"];

function hashSeed(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash << 5) - hash + seed.charCodeAt(i);
  return Math.abs(hash);
}

/** Generates a deterministic placeholder swatch for styles that have no real product photo yet. */
function makePlaceholderThumbnail(seed: string) {
  const hash = hashSeed(seed);
  const color = THUMB_COLORS[hash % THUMB_COLORS.length];
  const initials = seed.replace(/[^A-Za-z0-9]/g, "").slice(0, 2).toUpperCase() || "SJ";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect width="200" height="200" fill="${color}"/><text x="100" y="112" font-family="sans-serif" font-size="72" font-weight="700" fill="white" text-anchor="middle">${initials}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

const EXTRA_COLUMNS = ["targetBD", "snlBD"];
/** group id per EXTRA_COLUMNS index, used to visually cluster related columns */
const EXTRA_COLUMN_GROUP = [0, 0];

type Tone = "danger" | "success" | "neutral";

function pctTone(pct: number): Tone {
  if (pct >= 90) return "success";
  if (pct < 60) return "danger";
  return "neutral";
}

/** Per-period (D1..OT5) achievement vs. the real target/hour — shown as small text under each period's output. */
function computePeriodPcts(periods: number[], targetPerHour: number | undefined) {
  if (targetPerHour == null || targetPerHour <= 0) return undefined;
  return periods.map((v) => {
    if (v <= 0) return undefined;
    const pct = (v / targetPerHour) * 100;
    return { value: `${Math.round(pct)}%`, tone: pctTone(pct) };
  });
}

const MINI_MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MINI_CELL = 15;

function daysInMonthMini(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

/** Compact month-row calendar: one row per month, each day rendered as a small square showing its date number. */
function MiniScheduleStrip({
  startIso,
  endIso,
  efIso,
  holidaySet,
  onClick
}: {
  startIso: string;
  endIso: string;
  efIso: string;
  holidaySet: ReadonlySet<string>;
  onClick?: () => void;
}) {
  const { t } = useTranslation();
  const offBg = useColorModeValue("red.200", "red.700");
  const offColor = useColorModeValue("red.700", "red.100");
  const workingBg = useColorModeValue("green.100", "green.700");
  const workingColor = useColorModeValue("green.700", "green.100");
  const outsideColor = useColorModeValue("gray.300", "gray.600");
  const monthLabelColor = useColorModeValue("gray.400", "gray.500");

  const start = isoToLocalDate(startIso);
  const end = isoToLocalDate(endIso);
  if (!start || !end) return null;

  const monthRows: { year: number; month: number }[] = [];
  let cur = new Date(start.getFullYear(), start.getMonth(), 1);
  const maxYM = end.getFullYear() * 12 + end.getMonth();
  while (cur.getFullYear() * 12 + cur.getMonth() <= maxYM) {
    monthRows.push({ year: cur.getFullYear(), month: cur.getMonth() });
    cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
  }

  return (
    <VStack spacing="2px" align="flex-start" cursor={onClick ? "zoom-in" : undefined} onClick={onClick}>
      {monthRows.map(({ year, month }) => (
        <HStack key={`${year}-${month}`} spacing="1px">
          <Text fontSize="8px" color={monthLabelColor} w="20px" flexShrink={0} textAlign="right" pr="2px">
            {MINI_MONTH_ABBR[month]}
          </Text>
          {Array.from({ length: daysInMonthMini(year, month) }, (_, i) => i + 1).map((day) => {
            const ymd = localDateToIso(new Date(year, month, day));
            const isEf = ymd === efIso;
            const inRange = ymd >= startIso && ymd <= endIso;
            const isOff = new Date(year, month, day).getDay() === 0 || holidaySet.has(ymd);
            let bg = "transparent";
            let color = outsideColor;
            if (isEf) {
              bg = "orange.400";
              color = "white";
            } else if (inRange && isOff) {
              bg = offBg;
              color = offColor;
            } else if (inRange) {
              bg = workingBg;
              color = workingColor;
            }
            const label = `${ymd}${isEf ? ` — ${t("kchDashboard.scheduleExFactory")}` : inRange && isOff ? ` (${t("kchDashboard.scheduleOff")})` : ""}`;
            return (
              <Tooltip key={ymd} label={label} fontSize="xs" hasArrow openDelay={150}>
                <Box
                  w={`${MINI_CELL}px`}
                  h={`${MINI_CELL}px`}
                  borderRadius="2px"
                  bg={bg}
                  display="flex"
                  alignItems="center"
                  justifyContent="center"
                  flexShrink={0}
                >
                  <Text fontSize="7px" fontWeight={isEf ? "bold" : "normal"} color={color} lineHeight={1}>
                    {day}
                  </Text>
                </Box>
              </Tooltip>
            );
          })}
        </HStack>
      ))}
    </VStack>
  );
}

/** Shows a target value alongside its delta vs. a baseline (e.g. BD's own target vs. VL's), so a
 * mismatch between the two is visible at a glance instead of requiring a manual side-by-side read. */
function TargetDiffCell({ value, baseline }: { value?: number; baseline?: number }) {
  const upColor = useColorModeValue("green.600", "green.300");
  const downColor = useColorModeValue("red.600", "red.300");
  const neutralColor = useColorModeValue("gray.400", "gray.500");
  const valueColor = useColorModeValue("gray.800", "gray.100");
  if (value == null) return <Text fontSize="sm" color={neutralColor} textAlign="center">–</Text>;
  const diff = baseline != null ? value - baseline : undefined;
  const diffPct = diff != null && baseline ? (diff / baseline) * 100 : undefined;
  const diffColor = !diff ? neutralColor : diff > 0 ? upColor : downColor;
  return (
    <VStack spacing={0} align="center">
      <Text fontSize="sm" fontWeight="semibold" color={valueColor}>{value}</Text>
      {!!diff && (
        <Text fontSize="9px" fontWeight="semibold" color={diffColor} lineHeight={1.2}>
          {diff > 0 ? "▲" : "▼"} {Math.abs(diff)}
          {diffPct != null ? ` (${diff > 0 ? "+" : "-"}${Math.abs(diffPct).toFixed(0)}%)` : ""}
        </Text>
      )}
    </VStack>
  );
}

function TargetPctTag({ value }: { value: number }) {
  const scheme = value >= 90 ? "green" : value >= 60 ? "yellow" : "red";
  return (
    <Tag size="sm" borderRadius="full" colorScheme={scheme} fontWeight="semibold" px={2.5}>
      {value.toFixed(2)}%
    </Tag>
  );
}

function PeriodCell({
  value,
  target,
  flagged,
  pct,
  layoutHeadcount,
  actualHeadcount,
  showHeadcounts
}: {
  value: number;
  target: number;
  flagged?: boolean;
  pct?: { value: string; tone: Tone };
  layoutHeadcount?: number;
  actualHeadcount?: number;
  showHeadcounts?: boolean;
}) {
  const { t } = useTranslation();
  const zeroColor = useColorModeValue("gray.300", "gray.600");
  const pctDangerColor = useColorModeValue("red.600", "red.300");
  const pctSuccessColor = useColorModeValue("green.600", "green.300");
  const pctNeutralColor = useColorModeValue("gray.400", "gray.500");
  const layoutColor = useColorModeValue("blue.500", "blue.300");
  const actualColor = useColorModeValue("teal.600", "teal.300");

  if (value === 0) {
    return (
      <Text fontSize="sm" color={zeroColor} textAlign="center">
        –
      </Text>
    );
  }
  const scheme = flagged ? "purple" : value < target ? "orange" : "green";
  const pctColor =
    pct?.tone === "danger" ? pctDangerColor : pct?.tone === "success" ? pctSuccessColor : pctNeutralColor;

  if (showHeadcounts) {
    const hasBoth = layoutHeadcount != null && actualHeadcount != null;
    const diff = hasBoth ? actualHeadcount - layoutHeadcount : undefined;
    const diffPct = hasBoth && layoutHeadcount !== 0 ? (actualHeadcount / layoutHeadcount) * 100 : undefined;
    const diffColor = diff == null ? actualColor : diff < 0 ? pctDangerColor : pctSuccessColor;
    const diffTitle =
      diff != null
        ? `${t("kchDashboard.headcountDiff")}: ${diff > 0 ? "+" : ""}${diff}${diffPct != null ? ` (${diffPct.toFixed(0)}%)` : ""}`
        : t("kchDashboard.actualHeadcount");
    return (
      <VStack spacing={0.5}>
        <Tooltip label={t("kchDashboard.layoutHeadcount")} hasArrow placement="top" openDelay={200}>
          <Text fontSize="xs" fontWeight="semibold" color={layoutColor} lineHeight={1.3} cursor="help">
            L {layoutHeadcount ?? "–"}
          </Text>
        </Tooltip>
        <Tooltip label={diffTitle} hasArrow placement="bottom" openDelay={200}>
          <Text fontSize="xs" fontWeight="semibold" color={diffColor} lineHeight={1.3} cursor="help">
            A {actualHeadcount ?? "–"}
          </Text>
        </Tooltip>
      </VStack>
    );
  }

  return (
    <VStack spacing={0.5}>
      <Tooltip label={t("kchDashboard.output")} hasArrow placement="top" openDelay={200}>
        <Tag size="sm" borderRadius="md" colorScheme={scheme} fontWeight="semibold" minW="9" justifyContent="center" cursor="help">
          {value}
        </Tag>
      </Tooltip>
      {pct && (
        <Text fontSize="10px" fontWeight="bold" color={pctColor} lineHeight={1}>
          {pct.value}
        </Text>
      )}
    </VStack>
  );
}

export default function VlErpDashboard() {
  const { t } = useTranslation();
  const pageBg = useColorModeValue("gray.50", "gray.900");
  const cardBg = useColorModeValue("white", "gray.800");
  const cardBorder = useColorModeValue("gray.200", "gray.700");
  const headerBg = useColorModeValue("gray.50", "gray.750");
  const headerText = useColorModeValue("gray.500", "gray.400");
  const rowBorder = useColorModeValue("gray.100", "whiteAlpha.100");
  const rowHoverBg = useColorModeValue("gray.50", "whiteAlpha.50");
  const rowStripeBg = useColorModeValue("gray.50", "whiteAlpha.50");
  const cellText = useColorModeValue("gray.700", "gray.200");
  const mutedText = useColorModeValue("gray.500", "gray.400");
  const lineBadgeBg = useColorModeValue("gray.100", "whiteAlpha.200");
  const linkColor = useColorModeValue("blue.600", "blue.300");
  const periodStartColor = useColorModeValue("gray.400", "gray.500");
  const [showExtra, setShowExtra] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);
  const [pinnedCols, setPinnedColsRaw] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem(PINNED_COLS_STORAGE_KEY);
      if (saved) {
        const restored = new Set((JSON.parse(saved) as string[]).filter((k) => PINNABLE_COL_ORDER.includes(k)));
        restored.add(ALWAYS_PINNED_COL);
        return restored;
      }
    } catch {
      // ignore malformed/unavailable storage
    }
    return new Set(DEFAULT_PINNED_COLS);
  });
  const setPinnedCols = (val: Set<string> | ((prev: Set<string>) => Set<string>)) =>
    setPinnedColsRaw((prev) => {
      const next = typeof val === "function" ? val(prev) : val;
      next.add(ALWAYS_PINNED_COL);
      try {
        localStorage.setItem(PINNED_COLS_STORAGE_KEY, JSON.stringify(Array.from(next)));
      } catch {
        // ignore unavailable storage
      }
      return next;
    });
  const isPinned = (key: string) => pinnedCols.has(key);
  const togglePin = (key: string) => {
    if (key === ALWAYS_PINNED_COL) return;
    setPinnedCols((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };
  /** Real rendered width of each pinnable column, measured from its header cell (an auto-layout table
   * sizes every cell in a column identically, so measuring the header alone is sufficient). Falls back to
   * PINNABLE_COL_FALLBACK_WIDTH until the first measurement lands, to avoid a layout jump. Columns are left
   * at their natural content width (never clipped) so long values can't be cut off; sticky offsets simply
   * track whatever that natural width turns out to be. */
  const [colWidths, setColWidths] = useState<Record<string, number>>(() => ({ ...PINNABLE_COL_FALLBACK_WIDTH }));
  const colHeaderRefs = useRef<Record<string, HTMLTableCellElement | null>>({});
  const setColHeaderRef = (key: string) => (el: HTMLTableCellElement | null) => {
    colHeaderRefs.current[key] = el;
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally re-measures every render; the changed-check below prevents an update loop
  useLayoutEffect(() => {
    setColWidths((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const key of PINNABLE_COL_ORDER) {
        const el = colHeaderRefs.current[key];
        if (!el) continue;
        const w = Math.ceil(el.getBoundingClientRect().width);
        if (w > 0 && next[key] !== w) {
          next[key] = w;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  });
  /** Cumulative left offset for a pinned column — sums the widths of every column BEFORE it (in canonical order) that is also pinned, so any pinned subset/combination lines up contiguously at the left edge. */
  const getStickyLeft = (key: string) => {
    let left = 0;
    for (const col of PINNABLE_COL_ORDER) {
      if (col === key) break;
      if (pinnedCols.has(col)) left += colWidths[col] ?? PINNABLE_COL_FALLBACK_WIDTH[col] ?? 0;
    }
    return left;
  };
  const getStickyZIndex = (key: string) => {
    let n = 0;
    for (const col of PINNABLE_COL_ORDER) {
      if (col === key) break;
      if (pinnedCols.has(col)) n += 1;
    }
    return 3 + n;
  };
  /** Sticky-positioning props for a column; returns {} when that specific column isn't pinned.
   * No width/minW/maxW/overflow is forced — the cell keeps its natural content width (matching
   * unpinned columns) so text is never truncated; only its position is pinned. */
  const colStickyProps = (key: string, bg: string, top?: number) => {
    if (!isPinned(key)) return {};
    return {
      position: "sticky" as const,
      left: `${getStickyLeft(key)}px`,
      top,
      zIndex: getStickyZIndex(key) + (top != null ? 10 : 0),
      bg,
      boxShadow: "2px 0 4px rgba(0,0,0,0.08)"
    };
  };
  const PinBtn = ({ colKey }: { colKey: string }) => {
    const locked = colKey === ALWAYS_PINNED_COL;
    return (
      <Tooltip
        label={locked ? "Always pinned" : isPinned(colKey) ? "Unpin column" : "Pin column"}
        placement="top"
        hasArrow
        openDelay={200}
      >
        <Box
          as="span"
          display="inline-flex"
          flexShrink={0}
          cursor={locked ? "default" : "pointer"}
          color={isPinned(colKey) ? "blue.400" : "gray.300"}
          _hover={locked ? undefined : { color: isPinned(colKey) ? "blue.600" : "gray.500" }}
          onClick={(e: MouseEvent) => {
            e.stopPropagation();
            togglePin(colKey);
          }}
          transform={isPinned(colKey) ? "rotate(0deg)" : "rotate(45deg)"}
          transition="transform 0.15s"
        >
          <FaThumbtack size={10} />
        </Box>
      </Tooltip>
    );
  };
  const [showHeadcounts, setShowHeadcounts] = useState(false);
  const [expandedSchedulePks, setExpandedSchedulePks] = useState<Set<number>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [showKpiBreakdown, setShowKpiBreakdown] = useState(false);
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(id);
  }, []);
  const todayIso = useMemo(() => localDateToIso(now), [now]);
  const [viewDateIso, setViewDateIso] = useState(todayIso);
  const isViewingToday = viewDateIso === todayIso;
  const currentPeriodIdx = useMemo(() => (isViewingToday ? getCurrentPeriodIndex(now) : -1), [now, isViewingToday]);
  const currentPeriodBg = useColorModeValue("rgba(66, 153, 225, 0.06)", "whiteAlpha.50");
  const shiftViewDate = (deltaDays: number) => {
    setViewDateIso((iso) => {
      const d = isoToLocalDate(iso);
      if (!d) return iso;
      d.setDate(d.getDate() + deltaDays);
      return localDateToIso(d);
    });
  };
  const {
    data: schedules = [],
    isLoading: isSchedulesLoading,
    isFetching: isSchedulesFetching
  } = useQuery({
    queryKey: ["vlErpDashboardSchedules"],
    queryFn: () => getVlAssemblySchedules({}),
    staleTime: 30_000,
    refetchInterval: 60_000
  });
  const { data: scheduleDailyRows = [] } = useQuery({
    queryKey: ["vlErpDashboardScheduleDailyOutputs", viewDateIso],
    queryFn: () => fetchVlScheduleDailyOutputsForDay(viewDateIso),
    staleTime: 15_000,
    refetchInterval: 15_000
  });
  const { data: moduleDailyRows = [] } = useQuery({
    queryKey: ["vlErpDashboardModuleDailyOutputs", viewDateIso],
    queryFn: () => fetchVlModuleDailyOutputsForDay(viewDateIso),
    staleTime: 15_000,
    refetchInterval: 15_000
  });
  const { data: layoutStyles = [] } = useQuery({
    queryKey: ["layoutStyles"],
    queryFn: () => getLayoutStyles(),
    staleTime: 60_000
  });
  const layoutPkBySjStylePk = useMemo(() => {
    const map = new Map<number, number>();
    for (const ls of layoutStyles) {
      if (ls.sj_style?.pk != null) map.set(ls.sj_style.pk, ls.pk);
    }
    return map;
  }, [layoutStyles]);
  const schedulePksWithOutput = useMemo(
    () => new Set(scheduleDailyRows.map((r) => r.vl_assembly_schedule).filter((pk): pk is number => pk != null)),
    [scheduleDailyRows]
  );
  const activeSchedules = useMemo(
    () =>
      schedules
        .filter((s) => isScheduleActiveOn(s, viewDateIso, schedulePksWithOutput.has(s.pk)))
        .sort((a, b) => compareLineName(a.production_line_name, b.production_line_name)),
    [schedules, viewDateIso, schedulePksWithOutput]
  );
  const ROWS = useMemo(() => {
    const base = buildRows(activeSchedules, scheduleDailyRows, moduleDailyRows);
    const elapsedHours = isViewingToday ? elapsedWorkHoursForPacing(now) : 0;
    const withHourlyPct = (today: number, targetPerHour: number | undefined) =>
      elapsedHours > 0 && targetPerHour != null && targetPerHour > 0 ? (today / (targetPerHour * elapsedHours)) * 100 : undefined;
    return base.map((r) => ({
      ...r,
      hourlyPct: withHourlyPct(r.today, r.targetPerHour),
      pcts: computePeriodPcts(r.periods, r.targetPerHour),
      modules: r.modules?.map((m) => ({ ...m, hourlyPct: withHourlyPct(m.today, m.targetPerHour), pcts: computePeriodPcts(m.periods, m.targetPerHour) }))
    }));
  }, [activeSchedules, scheduleDailyRows, moduleDailyRows, isViewingToday, now]);
  const filteredRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return ROWS;
    return ROWS.filter((r) => {
      const haystack = [
        r.line,
        r.group,
        r.po,
        r.style,
        r.sjNo,
        r.brand,
        r.exfty,
        ...(r.modules?.flatMap((m) => [m.code, m.name]) ?? [])
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [ROWS, searchQuery]);

  const expandableSchedulePks = useMemo(
    () => filteredRows.filter((r) => r.modules?.length).map((r) => r.schedulePk),
    [filteredRows]
  );
  const areAllModulesExpanded =
    expandableSchedulePks.length > 0 && expandableSchedulePks.every((pk) => expandedSchedulePks.has(pk));
  const toggleAllModules = () =>
    setExpandedSchedulePks(areAllModulesExpanded ? new Set() : new Set(expandableSchedulePks));
  const summaryStats = useMemo(() => {
    const lines = new Set<string>();
    const activeLines = new Set<string>();
    const brands = new Set<string>();
    const sjNos = new Set<string>();
    for (const r of filteredRows) {
      if (r.line) lines.add(r.line);
      if (r.line && r.today > 0) activeLines.add(r.line);
      if (r.brand) brands.add(r.brand);
      if (r.sjNo) sjNos.add(r.sjNo);
    }
    return { lineCount: lines.size, activeLineCount: activeLines.size, brandCount: brands.size, styleCount: sjNos.size };
  }, [filteredRows]);
  /** brand → set of active (today > 0) lines, for the Buyer stat's hover breakdown */
  const activeLinesByBrand = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const r of filteredRows) {
      if (!r.brand || !r.line || r.today <= 0) continue;
      if (!map.has(r.brand)) map.set(r.brand, new Set());
      map.get(r.brand)!.add(r.line);
    }
    return Array.from(map.entries())
      .map(([brand, lineSet]) => ({ brand, count: lineSet.size }))
      .sort((a, b) => b.count - a.count);
  }, [filteredRows]);
  /** per-period (D1..OT5) sum across every visible row, plus the average per scheduled line — shown in the footer summary row */
  const periodTotals = useMemo(() => {
    const sums = new Array(PERIODS.length).fill(0);
    for (const r of filteredRows) {
      r.periods.forEach((v, i) => {
        sums[i] += v;
      });
    }
    const lineCount = summaryStats.lineCount || 1;
    return sums.map((sum) => ({ sum, avg: sum / lineCount }));
  }, [filteredRows, summaryStats.lineCount]);
  const todayTotal = useMemo(() => filteredRows.reduce((acc, r) => acc + r.today, 0), [filteredRows]);
  const orderQtyTotal = useMemo(
    () => filteredRows.reduce((acc, r) => acc + (Number(String(r.orderQty).replace(/,/g, "")) || 0), 0),
    [filteredRows]
  );
  const balQtyTotal = useMemo(
    () => filteredRows.reduce((acc, r) => acc + (Number(String(r.balQty).replace(/,/g, "")) || 0), 0),
    [filteredRows]
  );
  const targetTotal = useMemo(() => filteredRows.reduce((acc, r) => acc + r.target, 0), [filteredRows]);
  const targetPerHourTotal = useMemo(
    () => filteredRows.reduce((acc, r) => acc + (r.targetPerHour ?? 0), 0),
    [filteredRows]
  );
  const factoryKpis = useMemo(() => {
    const lineCount = summaryStats.lineCount || 1;
    const dayAchvPct = targetTotal > 0 ? (todayTotal / targetTotal) * 100 : null;
    const elapsedHours = isViewingToday ? elapsedWorkHoursForPacing(now) : 0;
    const expectedByNow = elapsedHours > 0 && targetPerHourTotal > 0 ? targetPerHourTotal * elapsedHours : null;
    const paceAchvPct = expectedByNow != null && expectedByNow > 0 ? (todayTotal / expectedByNow) * 100 : null;
    return {
      dayAchvPct,
      paceAchvPct,
      avgTarget: targetTotal / lineCount,
      avgToday: todayTotal / lineCount,
      avgTargetPerHour: targetPerHourTotal / lineCount,
      avgBalQty: balQtyTotal / lineCount
    };
  }, [summaryStats.lineCount, targetTotal, todayTotal, targetPerHourTotal, balQtyTotal, isViewingToday, now]);
  const lineBreakdown = useMemo(() => {
    type Agg = {
      line: string;
      styles: number;
      brands: Set<string>;
      orderQty: number;
      balQty: number;
      today: number;
      target: number;
      targetPerHour: number;
    };
    const map = new Map<string, Agg>();
    for (const r of filteredRows) {
      const key = r.line || "—";
      let agg = map.get(key);
      if (!agg) {
        agg = { line: key, styles: 0, brands: new Set(), orderQty: 0, balQty: 0, today: 0, target: 0, targetPerHour: 0 };
        map.set(key, agg);
      }
      agg.styles += 1;
      if (r.brand) agg.brands.add(r.brand);
      agg.orderQty += Number(String(r.orderQty).replace(/,/g, "")) || 0;
      agg.balQty += Number(String(r.balQty).replace(/,/g, "")) || 0;
      agg.today += r.today;
      agg.target += r.target;
      agg.targetPerHour += r.targetPerHour ?? 0;
    }
    const elapsedHours = isViewingToday ? elapsedWorkHoursForPacing(now) : 0;
    return Array.from(map.values())
      .map((a) => {
        const dayAchvPct = a.target > 0 ? (a.today / a.target) * 100 : null;
        const expectedByNow = elapsedHours > 0 && a.targetPerHour > 0 ? a.targetPerHour * elapsedHours : null;
        const paceAchvPct = expectedByNow != null && expectedByNow > 0 ? (a.today / expectedByNow) * 100 : null;
        return {
          line: a.line,
          styles: a.styles,
          brandCount: a.brands.size,
          orderQty: a.orderQty,
          balQty: a.balQty,
          today: a.today,
          target: a.target,
          targetPerHour: a.targetPerHour,
          dayAchvPct,
          paceAchvPct
        };
      })
      .sort((a, b) => compareLineName(a.line, b.line));
  }, [filteredRows, isViewingToday, now]);
  const buyerBreakdown = useMemo(() => {
    type Agg = {
      brand: string;
      lines: Set<string>;
      styles: number;
      orderQty: number;
      balQty: number;
      today: number;
      target: number;
    };
    const map = new Map<string, Agg>();
    for (const r of filteredRows) {
      const key = r.brand || "—";
      let agg = map.get(key);
      if (!agg) {
        agg = { brand: key, lines: new Set(), styles: 0, orderQty: 0, balQty: 0, today: 0, target: 0 };
        map.set(key, agg);
      }
      if (r.line) agg.lines.add(r.line);
      agg.styles += 1;
      agg.orderQty += Number(String(r.orderQty).replace(/,/g, "")) || 0;
      agg.balQty += Number(String(r.balQty).replace(/,/g, "")) || 0;
      agg.today += r.today;
      agg.target += r.target;
    }
    return Array.from(map.values())
      .map((a) => ({
        brand: a.brand,
        lineCount: a.lines.size,
        styles: a.styles,
        orderQty: a.orderQty,
        balQty: a.balQty,
        today: a.today,
        target: a.target,
        dayAchvPct: a.target > 0 ? (a.today / a.target) * 100 : null
      }))
      .sort((a, b) => b.today - a.today || b.orderQty - a.orderQty);
  }, [filteredRows]);
  const totalColCount = useMemo(
    () =>
      LEADING_COLUMNS.length +
      (showSchedule ? 2 : 0) +
      4 /* targetPct, targetPctHourly, targetPerHour, target */ +
      (showExtra ? EXTRA_COLUMNS.length : 0) +
      PERIODS.length,
    [showSchedule, showExtra]
  );
  const isInitialLoading = (isSchedulesLoading || isSchedulesFetching) && ROWS.length === 0;
  const planHolidayRange = useMemo(() => planHolidayApiRangeForScheduleDates(ROWS.map((r) => r.exfty)), [ROWS]);
  const { data: planHolidays = [] } = useQuery({
    queryKey: ["kchDashboardPlanHolidays", planHolidayRange.date_from, planHolidayRange.date_to],
    queryFn: async () => {
      try {
        return await getVlPlanHolidays(planHolidayRange);
      } catch {
        return [];
      }
    },
    staleTime: 60_000
  });
  const holidayYmdSet = useMemo(() => new Set(planHolidays.map((h) => h.date)), [planHolidays]);
  const summaryInsights = useMemo(() => {
    const behindPace = lineBreakdown.filter((l) => l.paceAchvPct != null && l.paceAchvPct < 90);
    const urgentStyles = filteredRows.filter((r) => {
      const d = countRemainingWorkdays(r.exfty, todayIso, holidayYmdSet);
      return d != null && d <= 3;
    });
    const topBalance = [...lineBreakdown].sort((a, b) => b.balQty - a.balQty).slice(0, 3).filter((l) => l.balQty > 0);
    return { behindPace, urgentStyles, topBalance };
  }, [lineBreakdown, filteredRows, todayIso, holidayYmdSet]);
  const workdaysColor = useColorModeValue("gray.400", "gray.500");
  const workdaysUrgentColor = useColorModeValue("red.500", "red.300");
  const workdaysSoonColor = useColorModeValue("orange.500", "orange.300");
  const { isOpen: isThumbOpen, onOpen: onThumbOpen, onClose: onThumbClose } = useDisclosure();
  const [activeThumb, setActiveThumb] = useState<{ url: string; label: string } | null>(null);
  const openThumb = (row: Row) => {
    setActiveThumb({ url: row.thumbnail ?? makePlaceholderThumbnail(row.style), label: row.style });
    onThumbOpen();
  };
  const { isOpen: isScheduleOpen, onOpen: onScheduleOpen, onClose: onScheduleClose } = useDisclosure();
  const [activeSchedule, setActiveSchedule] = useState<{ start: string; end: string; ef: string; label: string; target: number; row: Row } | null>(null);
  const openSchedule = (row: Row) => {
    setActiveSchedule({ start: resolveAssemblyStart(row, holidayYmdSet), end: row.exfty, ef: row.exfty, label: row.style, target: row.target, row });
    onScheduleOpen();
  };
  /** Cumulative/pace stats for the schedule detail modal: how much has shipped so far, the average
   * daily pace that implies, how many working days remain before ex-factory, and the daily rate
   * required over those remaining days to clear the balance in time. */
  const scheduleStats = useMemo(() => {
    if (!activeSchedule) return null;
    const orderQtyNum = Number(String(activeSchedule.row.orderQty).replace(/,/g, "")) || 0;
    const balQtyNum = Number(String(activeSchedule.row.balQty).replace(/,/g, "")) || 0;
    const cumulativeQty = Math.max(orderQtyNum - balQtyNum, 0);
    const elapsedWorkdays = countRemainingWorkdays(todayIso, activeSchedule.start, holidayYmdSet) ?? 1;
    const avgDailyQty = elapsedWorkdays > 0 ? Math.round(cumulativeQty / elapsedWorkdays) : 0;
    const remainingWorkdays = countRemainingWorkdays(activeSchedule.ef, todayIso, holidayYmdSet);
    const requiredDailyQty =
      remainingWorkdays != null && remainingWorkdays > 0 ? Math.ceil(balQtyNum / remainingWorkdays) : balQtyNum;
    const paceDelta = requiredDailyQty > 0 ? avgDailyQty - requiredDailyQty : 0;
    const paceStatus: "ahead" | "onTrack" | "behind" =
      requiredDailyQty <= 0 ? "onTrack" : paceDelta >= requiredDailyQty * 0.05 ? "ahead" : paceDelta <= -requiredDailyQty * 0.05 ? "behind" : "onTrack";
    return { cumulativeQty, avgDailyQty, remainingWorkdays, requiredDailyQty, balQtyNum, paceStatus };
  }, [activeSchedule, todayIso, holidayYmdSet]);
  /** Multiple rows (POs/styles) can share the same physical LINE# — expanding one should expand every
   * row on that line together, not just the row that was clicked. */
  const schedulePksByLine = useMemo(() => {
    const map = new Map<string, number[]>();
    for (const r of filteredRows) {
      if (!r.line || !r.modules?.length) continue;
      if (!map.has(r.line)) map.set(r.line, []);
      map.get(r.line)!.push(r.schedulePk);
    }
    return map;
  }, [filteredRows]);
  const toggleLine = (line: string, schedulePk: number) => {
    const pks = schedulePksByLine.get(line) ?? [schedulePk];
    setExpandedSchedulePks((prev) => {
      const shouldExpand = !prev.has(schedulePk);
      const next = new Set(prev);
      for (const p of pks) {
        if (shouldExpand) next.add(p);
        else next.delete(p);
      }
      return next;
    });
  };
  const subRowBgB = useColorModeValue("teal.50", "rgba(129, 230, 217, 0.06)");
  const subRowBgC = useColorModeValue("purple.50", "rgba(214, 188, 250, 0.06)");
  const extraGroupBgA = useColorModeValue("blue.50", "whiteAlpha.100");
  const extraGroupBg = [extraGroupBgA];
  /** Thicker rule drawn above the first row of each new LINE# so line groups read as distinct blocks without relying on color. */
  const lineGroupDivider = useColorModeValue("gray.300", "whiteAlpha.400");
  const kpiTileBg = useColorModeValue("gray.50", "whiteAlpha.50");
  const kpiTileBorder = useColorModeValue("gray.200", "whiteAlpha.200");
  return (
    <>
      <Helmet>
        <title>{t("navbar.vlErpDashboard")}</title>
      </Helmet>

      <Box bg={pageBg} minH="calc(100vh - 100px)" p={{ base: 3, md: 6 }}>
        <HStack justify="space-between" mb={3} flexWrap="wrap" gap={3}>
          <Text fontSize="xl" fontWeight="bold" color={cellText}>
            {t("navbar.vlErpDashboard")}
          </Text>
          <HStack spacing={3} flexWrap="wrap" justify="flex-end">
            <IconButton
              as={RouterLink}
              to="/vl-factory-live"
              aria-label={t("navbar.vlFactoryLive")}
              icon={<FaThLarge />}
              size="sm"
              variant="outline"
            />
            <IconButton
              as={RouterLink}
              to="/vl-layouts"
              aria-label={t("navbar.vlLayouts")}
              icon={<FaProjectDiagram />}
              size="sm"
              variant="outline"
            />
            <InputGroup size="sm" w={{ base: "100%", sm: "220px" }} maxW="280px">
              <InputLeftElement pointerEvents="none" color="gray.400">
                <FiSearch size={14} />
              </InputLeftElement>
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t("kchDashboard.searchPlaceholder")}
                pl={9}
                pr={searchQuery ? 8 : undefined}
              />
              {searchQuery ? (
                <InputRightElement>
                  <IconButton
                    aria-label={t("kchDashboard.clearSearch")}
                    icon={<FiX />}
                    size="xs"
                    variant="ghost"
                    onClick={() => setSearchQuery("")}
                  />
                </InputRightElement>
              ) : null}
            </InputGroup>
            <HStack spacing={1}>
              <IconButton
                aria-label="Previous day"
                icon={<FiChevronRight style={{ transform: "rotate(180deg)" }} />}
                size="sm"
                variant="outline"
                onClick={() => shiftViewDate(-1)}
              />
              <Input
                type="date"
                size="sm"
                width="150px"
                value={viewDateIso}
                onChange={(e) => e.target.value && setViewDateIso(e.target.value)}
              />
              <IconButton
                aria-label="Next day"
                icon={<FiChevronRight />}
                size="sm"
                variant="outline"
                onClick={() => shiftViewDate(1)}
              />
              {!isViewingToday && (
                <Button size="sm" variant="ghost" onClick={() => setViewDateIso(todayIso)}>
                  {t("kchDashboard.today")}
                </Button>
              )}
            </HStack>
            {expandableSchedulePks.length > 0 && (
              <Button
                size="sm"
                variant="outline"
                leftIcon={<FiChevronRight style={{ transform: areAllModulesExpanded ? "rotate(90deg)" : undefined, transition: "transform 0.15s" }} />}
                onClick={toggleAllModules}
              >
                {areAllModulesExpanded ? t("kchDashboard.collapseAllModules") : t("kchDashboard.expandAllModules")}
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              leftIcon={<FiChevronRight style={{ transform: showHeadcounts ? "rotate(90deg)" : undefined, transition: "transform 0.15s" }} />}
              onClick={() => setShowHeadcounts((v) => !v)}
            >
              {showHeadcounts ? t("kchDashboard.showOutputs") : t("kchDashboard.showHeadcounts")}
            </Button>
          </HStack>
        </HStack>

        <Box
          bg={cardBg}
          border="1px solid"
          borderColor={cardBorder}
          borderRadius="xl"
          boxShadow="sm"
          mb={4}
          overflow="hidden"
        >
          <Box px={{ base: 3, md: 4 }} pt={3} pb={showKpiBreakdown ? 2 : 3}>
            <HStack justify="space-between" align="flex-start" mb={3} flexWrap="wrap" gap={2}>
              <HStack spacing={3} fontSize="sm" color={mutedText} flexWrap="wrap">
                <Text>
                  {t("kchDashboard.lineSummary")}{" "}
                  <Text as="span" fontWeight="bold" color={cellText}>{summaryStats.lineCount}</Text>
                </Text>
                <Text>·</Text>
                <Text>
                  {t("kchDashboard.activeLineSummary")}{" "}
                  <Text as="span" fontWeight="bold" color="green.500">{summaryStats.activeLineCount}</Text>
                </Text>
                <Text>·</Text>
                <Tooltip
                  hasArrow
                  placement="bottom"
                  openDelay={150}
                  label={
                    activeLinesByBrand.length > 0 ? (
                      <VStack align="flex-start" spacing={0.5} py={0.5}>
                        {activeLinesByBrand.map(({ brand, count }) => (
                          <Text key={brand} fontSize="xs">
                            {brand}: {count}{t("kchDashboard.activeLineUnit")}
                          </Text>
                        ))}
                      </VStack>
                    ) : (
                      t("kchDashboard.noActiveBrands")
                    )
                  }
                >
                  <Text cursor="help">
                    {t("kchDashboard.brandSummary")}{" "}
                    <Text as="span" fontWeight="bold" color={cellText}>{summaryStats.brandCount}</Text>
                  </Text>
                </Tooltip>
                <Text>·</Text>
                <Text>
                  {t("kchDashboard.styleSummary")}{" "}
                  <Text as="span" fontWeight="bold" color={cellText}>{summaryStats.styleCount}</Text>
                </Text>
              </HStack>
              <Button
                size="xs"
                variant="ghost"
                rightIcon={<FiChevronDown style={{ transform: showKpiBreakdown ? "rotate(180deg)" : undefined, transition: "transform 0.15s" }} />}
                onClick={() => setShowKpiBreakdown((v) => !v)}
              >
                {showKpiBreakdown ? t("kchDashboard.kpiHideDetail") : t("kchDashboard.kpiShowDetail")}
              </Button>
            </HStack>

            <SimpleGrid columns={{ base: 2, sm: 3, md: 4, lg: 8 }} spacing={2}>
              {([
                { label: t("kchDashboard.columns.orderQty"), value: orderQtyTotal.toLocaleString(), hint: t("kchDashboard.kpiHintOrder") },
                { label: t("kchDashboard.columns.balQty"), value: balQtyTotal.toLocaleString(), hint: t("kchDashboard.kpiHintBal") },
                { label: t("kchDashboard.columns.today"), value: todayTotal.toLocaleString(), hint: t("kchDashboard.kpiHintToday") },
                { label: t("kchDashboard.columns.targetQtySub"), value: targetTotal.toLocaleString(), hint: t("kchDashboard.kpiHintTarget") },
                { label: t("kchDashboard.columns.targetPerHourSub"), value: targetPerHourTotal.toLocaleString(), hint: t("kchDashboard.kpiHintTargetHour") },
                {
                  label: t("kchDashboard.kpiAvgTarget"),
                  value: Math.round(factoryKpis.avgTarget).toLocaleString(),
                  hint: t("kchDashboard.kpiHintAvgTarget")
                },
                {
                  label: t("kchDashboard.columns.targetPctMain"),
                  valueNode: factoryKpis.dayAchvPct != null ? <TargetPctTag value={factoryKpis.dayAchvPct} /> : "–",
                  hint: t("kchDashboard.columns.targetPctHint")
                },
                {
                  label: t("kchDashboard.columns.targetPctHourlyMain"),
                  valueNode: factoryKpis.paceAchvPct != null ? <TargetPctTag value={factoryKpis.paceAchvPct} /> : "–",
                  hint: t("kchDashboard.columns.targetPctHourlyHint")
                }
              ] as { label: string; value?: string; valueNode?: ReactNode; hint: string }[]).map((tile) => (
                <Tooltip key={tile.label} label={tile.hint} hasArrow openDelay={200}>
                  <Box
                    bg={kpiTileBg}
                    border="1px solid"
                    borderColor={kpiTileBorder}
                    borderRadius="lg"
                    px={3}
                    py={2}
                    minH="64px"
                  >
                    <Text fontSize="10px" color={mutedText} fontWeight="semibold" textTransform="uppercase" letterSpacing="wide" mb={1}>
                      {tile.label}
                    </Text>
                    {tile.valueNode != null ? (
                      <Box>{tile.valueNode}</Box>
                    ) : (
                      <Text fontSize="lg" fontWeight="bold" color={cellText} lineHeight={1.2}>
                        {tile.value}
                      </Text>
                    )}
                  </Box>
                </Tooltip>
              ))}
            </SimpleGrid>
          </Box>

          <Collapse in={showKpiBreakdown} animateOpacity>
            <Box px={{ base: 3, md: 4 }} pb={4} borderTop="1px solid" borderColor={cardBorder} pt={3}>
              {(summaryInsights.behindPace.length > 0 ||
                summaryInsights.urgentStyles.length > 0 ||
                summaryInsights.topBalance.length > 0) && (
                <HStack spacing={2} mb={3} flexWrap="wrap">
                  {summaryInsights.behindPace.length > 0 && (
                    <Tag size="sm" colorScheme="red" borderRadius="md">
                      {t("kchDashboard.kpiInsightBehindPace", { count: summaryInsights.behindPace.length })}
                    </Tag>
                  )}
                  {summaryInsights.urgentStyles.length > 0 && (
                    <Tag size="sm" colorScheme="orange" borderRadius="md">
                      {t("kchDashboard.kpiInsightUrgent", { count: summaryInsights.urgentStyles.length })}
                    </Tag>
                  )}
                  {summaryInsights.topBalance.slice(0, 1).map((l) => (
                    <Tag key={l.line} size="sm" colorScheme="blue" borderRadius="md">
                      {t("kchDashboard.kpiInsightTopBal", { line: l.line, qty: l.balQty.toLocaleString() })}
                    </Tag>
                  ))}
                </HStack>
              )}

              <SimpleGrid columns={{ base: 1, lg: 2 }} spacing={4}>
                <Box overflowX="auto">
                  <Text fontSize="xs" fontWeight="bold" color={mutedText} mb={2} textTransform="uppercase" letterSpacing="wide">
                    {t("kchDashboard.kpiByLine")}
                  </Text>
                  <Table size="sm" variant="simple">
                    <Thead>
                      <Tr>
                        <Th px={2}>{t("kchDashboard.columns.line")}</Th>
                        <Th px={2} isNumeric>{t("kchDashboard.columns.today")}</Th>
                        <Th px={2} isNumeric>{t("kchDashboard.columns.targetQtySub")}</Th>
                        <Th px={2} isNumeric>{t("kchDashboard.columns.targetPerHourSub")}</Th>
                        <Th px={2} isNumeric>{t("kchDashboard.columns.balQty")}</Th>
                        <Th px={2}>{t("kchDashboard.columns.targetPctMain")}</Th>
                        <Th px={2}>{t("kchDashboard.columns.targetPctHourlyMain")}</Th>
                      </Tr>
                    </Thead>
                    <Tbody>
                      {lineBreakdown.map((l) => (
                        <Tr key={l.line}>
                          <Td px={2} py={1.5} fontWeight="semibold" whiteSpace="nowrap">{l.line}</Td>
                          <Td px={2} py={1.5} isNumeric>{l.today.toLocaleString()}</Td>
                          <Td px={2} py={1.5} isNumeric>{l.target.toLocaleString()}</Td>
                          <Td px={2} py={1.5} isNumeric>{l.targetPerHour.toLocaleString()}</Td>
                          <Td px={2} py={1.5} isNumeric>{l.balQty.toLocaleString()}</Td>
                          <Td px={2} py={1.5}>{l.dayAchvPct != null ? <TargetPctTag value={l.dayAchvPct} /> : "–"}</Td>
                          <Td px={2} py={1.5}>{l.paceAchvPct != null ? <TargetPctTag value={l.paceAchvPct} /> : "–"}</Td>
                        </Tr>
                      ))}
                      {lineBreakdown.length === 0 && (
                        <Tr>
                          <Td colSpan={7} py={4} textAlign="center" color={mutedText}>{t("kchDashboard.noRows")}</Td>
                        </Tr>
                      )}
                    </Tbody>
                  </Table>
                </Box>

                <Box overflowX="auto">
                  <Text fontSize="xs" fontWeight="bold" color={mutedText} mb={2} textTransform="uppercase" letterSpacing="wide">
                    {t("kchDashboard.kpiByBuyer")}
                  </Text>
                  <Table size="sm" variant="simple">
                    <Thead>
                      <Tr>
                        <Th px={2}>{t("kchDashboard.brandSummary")}</Th>
                        <Th px={2} isNumeric>{t("kchDashboard.lineSummary")}</Th>
                        <Th px={2} isNumeric>{t("kchDashboard.styleSummary")}</Th>
                        <Th px={2} isNumeric>{t("kchDashboard.columns.orderQty")}</Th>
                        <Th px={2} isNumeric>{t("kchDashboard.columns.balQty")}</Th>
                        <Th px={2} isNumeric>{t("kchDashboard.columns.today")}</Th>
                        <Th px={2}>{t("kchDashboard.columns.targetPctMain")}</Th>
                      </Tr>
                    </Thead>
                    <Tbody>
                      {buyerBreakdown.map((b) => (
                        <Tr key={b.brand}>
                          <Td px={2} py={1.5} fontWeight="semibold" whiteSpace="nowrap">{b.brand}</Td>
                          <Td px={2} py={1.5} isNumeric>{b.lineCount}</Td>
                          <Td px={2} py={1.5} isNumeric>{b.styles}</Td>
                          <Td px={2} py={1.5} isNumeric>{b.orderQty.toLocaleString()}</Td>
                          <Td px={2} py={1.5} isNumeric>{b.balQty.toLocaleString()}</Td>
                          <Td px={2} py={1.5} isNumeric>{b.today.toLocaleString()}</Td>
                          <Td px={2} py={1.5}>{b.dayAchvPct != null ? <TargetPctTag value={b.dayAchvPct} /> : "–"}</Td>
                        </Tr>
                      ))}
                      {buyerBreakdown.length === 0 && (
                        <Tr>
                          <Td colSpan={7} py={4} textAlign="center" color={mutedText}>{t("kchDashboard.noRows")}</Td>
                        </Tr>
                      )}
                    </Tbody>
                  </Table>
                </Box>
              </SimpleGrid>
            </Box>
          </Collapse>
        </Box>

        <Box
          bg={cardBg}
          border="1px solid"
          borderColor={cardBorder}
          borderRadius="xl"
          overflow="hidden"
          boxShadow="sm"
        >
          <Box overflowX="auto">
            <Table variant="unstyled" size="sm" minW="1500px" sx={{ borderCollapse: "collapse" }}>
              <Thead>
                <Tr>
                  {LEADING_COLUMNS.map((h) => {
                    const isExfty = h === "exfty";
                    const isStyle = h === "style";
                    return (
                      <Fragment key={h}>
                        <Th
                          bg={headerBg}
                          color={headerText}
                          fontSize="xs"
                          fontWeight="semibold"
                          textTransform="uppercase"
                          letterSpacing="wide"
                          whiteSpace={isStyle ? "nowrap" : "normal"}
                          wordBreak="normal"
                          overflowWrap="normal"
                          textAlign="center"
                          lineHeight={1.25}
                          px={2}
                          py={2.5}
                          borderBottom="1px solid"
                          borderBottomColor={cardBorder}
                          position="sticky"
                          top={0}
                          ref={setColHeaderRef(h)}
                          {...colStickyProps(h, headerBg, 0)}
                        >
                          {isExfty ? (
                            <HStack spacing={1} justify="center">
                              <Text as="span">{twoLineHeaderLabel(t(`kchDashboard.columns.${h}`))}</Text>
                              <IconButton
                                aria-label={showSchedule ? "Collapse production schedule" : "Expand production schedule"}
                                icon={<FiChevronRight />}
                                size="2xs"
                                variant="ghost"
                                minW="4"
                                h="4"
                                transform={showSchedule ? "rotate(90deg)" : undefined}
                                transition="transform 0.15s"
                                onClick={() => setShowSchedule((v) => !v)}
                              />
                              <PinBtn colKey={h} />
                            </HStack>
                          ) : (
                            <HStack spacing={1} justify="center">
                              <Text as="span">{isStyle ? t(`kchDashboard.columns.${h}`) : twoLineHeaderLabel(t(`kchDashboard.columns.${h}`))}</Text>
                              <PinBtn colKey={h} />
                            </HStack>
                          )}
                        </Th>
                        {isExfty && showSchedule && (
                          <Th
                            bg={headerBg}
                            color={headerText}
                            fontSize="xs"
                            fontWeight="semibold"
                            textTransform="uppercase"
                            letterSpacing="wide"
                            whiteSpace="nowrap"
                            px={3}
                            py={2.5}
                            borderBottom="1px solid"
                            borderBottomColor={cardBorder}
                            position="sticky"
                            top={0}
                          >
                            {t("kchDashboard.columns.productionPeriod")}
                          </Th>
                        )}
                        {isExfty && showSchedule && (
                          <Th
                            bg={headerBg}
                            color={headerText}
                            fontSize="xs"
                            fontWeight="semibold"
                            textTransform="uppercase"
                            letterSpacing="wide"
                            whiteSpace="nowrap"
                            px={3}
                            py={2.5}
                            borderBottom="1px solid"
                            borderBottomColor={cardBorder}
                            position="sticky"
                            top={0}
                          >
                            {t("kchDashboard.columns.productionSchedule")}
                          </Th>
                        )}
                      </Fragment>
                    );
                  })}
                  <Th
                    color={headerText}
                    fontSize="xs"
                    fontWeight="semibold"
                    textTransform="uppercase"
                    letterSpacing="wide"
                    whiteSpace="normal"
                    wordBreak="normal"
                    overflowWrap="normal"
                    textAlign="center"
                    lineHeight={1.25}
                    px={2}
                    py={2.5}
                    borderBottom="1px solid"
                    borderColor={cardBorder}
                    position="sticky"
                    top={0}
                    ref={setColHeaderRef("targetPct")}
                    {...colStickyProps("targetPct", headerBg, 0)}
                  >
                    <Tooltip label={t("kchDashboard.columns.targetPctHint")} hasArrow openDelay={200}>
                      <HStack spacing={1} justify="center">
                        {twoTierHeaderLabel(t("kchDashboard.columns.targetPctMain"), t("kchDashboard.columns.targetPctSub"), mutedText)}
                        <PinBtn colKey="targetPct" />
                      </HStack>
                    </Tooltip>
                  </Th>
                  <Th
                    color={headerText}
                    fontSize="xs"
                    fontWeight="semibold"
                    textTransform="uppercase"
                    letterSpacing="wide"
                    whiteSpace="normal"
                    wordBreak="normal"
                    overflowWrap="normal"
                    textAlign="center"
                    lineHeight={1.25}
                    px={2}
                    py={2.5}
                    borderBottom="1px solid"
                    borderColor={cardBorder}
                    position="sticky"
                    top={0}
                    ref={setColHeaderRef("targetPctHourly")}
                    {...colStickyProps("targetPctHourly", headerBg, 0)}
                  >
                    <Tooltip label={t("kchDashboard.columns.targetPctHourlyHint")} hasArrow openDelay={200}>
                      <HStack spacing={1} justify="center">
                        {twoTierHeaderLabel(t("kchDashboard.columns.targetPctHourlyMain"), t("kchDashboard.columns.targetPctHourlySub"), mutedText)}
                        <PinBtn colKey="targetPctHourly" />
                      </HStack>
                    </Tooltip>
                  </Th>
                  <Th
                    color={headerText}
                    fontSize="xs"
                    fontWeight="semibold"
                    textTransform="uppercase"
                    letterSpacing="wide"
                    whiteSpace="normal"
                    wordBreak="normal"
                    overflowWrap="normal"
                    textAlign="center"
                    lineHeight={1.25}
                    px={2}
                    py={2.5}
                    borderBottom="1px solid"
                    borderColor={cardBorder}
                    position="sticky"
                    top={0}
                    ref={setColHeaderRef("targetPerHour")}
                    {...colStickyProps("targetPerHour", headerBg, 0)}
                  >
                    <HStack spacing={1} justify="center">
                      {twoTierHeaderLabel(t("kchDashboard.columns.targetPerHourMain"), t("kchDashboard.columns.targetPerHourSub"), mutedText)}
                      <PinBtn colKey="targetPerHour" />
                    </HStack>
                  </Th>
                  <Th
                    color={headerText}
                    fontSize="xs"
                    fontWeight="semibold"
                    textTransform="uppercase"
                    letterSpacing="wide"
                    whiteSpace="nowrap"
                    textAlign="center"
                    lineHeight={1.25}
                    px={2}
                    py={2.5}
                    borderBottom="1px solid"
                    borderBottomColor={cardBorder}
                    position="sticky"
                    top={0}
                    ref={setColHeaderRef("target")}
                    {...colStickyProps("target", headerBg, 0)}
                  >
                    <HStack spacing={1} justify="center">
                      {twoTierHeaderLabel(t("kchDashboard.columns.targetQtyMain"), t("kchDashboard.columns.targetQtySub"), mutedText)}
                      <IconButton
                        aria-label={showExtra ? "Collapse target detail columns" : "Expand target detail columns"}
                        icon={<FiChevronRight />}
                        size="2xs"
                        variant="ghost"
                        minW="4"
                        h="4"
                        transform={showExtra ? "rotate(90deg)" : undefined}
                        transition="transform 0.15s"
                        onClick={() => setShowExtra((v) => !v)}
                      />
                      <PinBtn colKey="target" />
                    </HStack>
                  </Th>
                  {showExtra &&
                    EXTRA_COLUMNS.map((eh, ei) => {
                      const groupId = EXTRA_COLUMN_GROUP[ei];
                      return (
                        <Th
                          key={eh}
                          bg={extraGroupBg[groupId]}
                          color={headerText}
                          fontSize="xs"
                          fontWeight="semibold"
                          textTransform="uppercase"
                          letterSpacing="wide"
                          whiteSpace="nowrap"
                          textAlign="center"
                          px={3}
                          py={2.5}
                          borderBottom="1px solid"
                          borderBottomColor={cardBorder}
                          position="sticky"
                          top={0}
                        >
                          {twoTierHeaderLabel(t(`kchDashboard.columns.${eh}Main`), t(`kchDashboard.columns.${eh}Sub`), mutedText)}
                        </Th>
                      );
                    })}
                  {PERIODS.map((p, pIdx) => (
                    <Th
                      key={p.key}
                      bg={pIdx === currentPeriodIdx ? currentPeriodBg : headerBg}
                      color={pIdx === currentPeriodIdx ? "blue.500" : headerText}
                      fontSize="xs"
                      fontWeight="semibold"
                      textAlign="center"
                      whiteSpace="nowrap"
                      px={2}
                      py={2}
                      borderBottom="1px solid"
                      borderColor={cardBorder}
                      position="sticky"
                      top={0}
                      animation={pIdx === currentPeriodIdx ? `${currentPeriodPulse} 4s ease-in-out infinite` : undefined}
                    >
                      <Text as="span" textTransform="uppercase" letterSpacing="wide">
                        {p.key}
                      </Text>
                      <Text fontSize="10px" fontWeight="normal" color={pIdx === currentPeriodIdx ? "blue.400" : periodStartColor} mt={0.5}>
                        {p.start || " "}
                      </Text>
                    </Th>
                  ))}
                </Tr>
              </Thead>
              <Tbody>
                {isInitialLoading &&
                  [...Array(6)].map((_, i) => (
                    <Tr key={`skeleton-${i}`}>
                      {[...Array(totalColCount)].map((__, j) => (
                        <Td key={j} px={3} py={2}>
                          <Skeleton height="16px" borderRadius="sm" />
                        </Td>
                      ))}
                    </Tr>
                  ))}
                {!isInitialLoading &&
                  filteredRows.map((row, i) => {
                  const rowBg = i % 2 === 1 ? rowStripeBg : cardBg;
                  const isNewLineGroup = i > 0 && row.line !== filteredRows[i - 1].line;
                  const isExpanded = expandedSchedulePks.has(row.schedulePk);
                  return (
                  <Fragment key={row.schedulePk}>
                  <Tr
                    bg={rowBg}
                    _hover={{ bg: rowHoverBg }}
                    transition="background 0.1s"
                    borderTop={isNewLineGroup ? "2px solid" : undefined}
                    borderTopColor={isNewLineGroup ? lineGroupDivider : undefined}
                  >
                    <Td
                      px={3}
                      py={2}
                      borderBottom="1px solid"
                      borderRight="1px solid"
                      borderColor={rowBorder}
                      whiteSpace="nowrap"
                      {...colStickyProps("line", rowBg)}
                    >
                      <Tag size="sm" borderRadius="md" bg={lineBadgeBg} color={cellText} fontWeight="semibold">
                        {row.line}
                      </Tag>
                    </Td>
                    <Td px={3} py={2} borderBottom="1px solid" borderColor={rowBorder} whiteSpace="nowrap" {...colStickyProps("group", rowBg)}>
                      <HStack spacing={1}>
                        <Tag size="sm" borderRadius="full" colorScheme="blue" fontWeight="bold">
                          A
                        </Tag>
                        {!!row.modules?.length && (
                          <IconButton
                            aria-label={isExpanded ? "Collapse modules" : "Expand modules"}
                            icon={<FiChevronRight />}
                            size="2xs"
                            variant="ghost"
                            minW="4"
                            h="4"
                            transform={isExpanded ? "rotate(90deg)" : undefined}
                            transition="transform 0.15s"
                            onClick={() => toggleLine(row.line, row.schedulePk)}
                          />
                        )}
                      </HStack>
                    </Td>
                    <Td px={3} py={2} borderBottom="1px solid" borderColor={rowBorder} fontSize="sm" fontFamily="mono" whiteSpace="nowrap" {...colStickyProps("po", rowBg)}>
                      <Link
                        color={linkColor}
                        onClick={() => openAppPopupWindow(`/vl-assembly-production/${row.schedulePk}`)}
                      >
                        {row.po}
                      </Link>
                    </Td>
                    <Td px={2} py={2} borderBottom="1px solid" borderColor={rowBorder} {...colStickyProps("thumbnail", rowBg)}>
                      <Image
                        src={row.thumbnail ?? makePlaceholderThumbnail(row.style)}
                        alt={row.style}
                        boxSize="36px"
                        borderRadius="md"
                        objectFit="cover"
                        cursor="zoom-in"
                        transition="transform 0.15s"
                        _hover={{ transform: "scale(1.1)" }}
                        onClick={() => openThumb(row)}
                      />
                    </Td>
                    <Td px={3} py={2} borderBottom="1px solid" borderColor={rowBorder} fontSize="sm" whiteSpace="nowrap" {...colStickyProps("style", rowBg)}>
                      <Link
                        color={linkColor}
                        fontWeight="semibold"
                        onClick={() => openAppPopupWindow(`/vl-assembly-production/sj-nos/${row.sjNoPk}`)}
                      >
                        {row.sjNo}
                      </Link>
                    </Td>
                    <Td px={2} py={2} borderBottom="1px solid" borderColor={rowBorder} textAlign="center" {...colStickyProps("layout", rowBg)}>
                      {(() => {
                        const layoutPk = row.sjStylePk != null ? layoutPkBySjStylePk.get(row.sjStylePk) : undefined;
                        if (layoutPk == null) {
                          return <Text color={mutedText} fontSize="sm">–</Text>;
                        }
                        return (
                          <Button
                            size="xs"
                            variant="outline"
                            colorScheme="blue"
                            onClick={() => openAppPopupWindow(`/vl-layouts/${layoutPk}`, { width: 1680, height: 960 })}
                          >
                            {t("kchDashboard.columns.layout")}
                          </Button>
                        );
                      })()}
                    </Td>
                    <Td px={3} py={2} borderBottom="1px solid" borderColor={rowBorder} color={mutedText} fontSize="sm" whiteSpace="nowrap" {...colStickyProps("exfty", rowBg)}>
                      {row.exfty}
                      {(() => {
                        const workdays = countRemainingWorkdays(row.exfty, todayIso, holidayYmdSet);
                        if (workdays == null) return null;
                        const color = workdays <= 3 ? workdaysUrgentColor : workdays <= 7 ? workdaysSoonColor : workdaysColor;
                        return (
                          <Text fontSize="10px" fontWeight="bold" color={color} mt={0.5}>
                            D-{workdays}
                          </Text>
                        );
                      })()}
                    </Td>
                    {showSchedule &&
                      (() => {
                        const periodStart = resolveAssemblyStart(row, holidayYmdSet);
                        const periodDays = countRemainingWorkdays(row.exfty, periodStart, holidayYmdSet);
                        const orderQtyNum = Number(String(row.orderQty).replace(/,/g, "")) || 0;
                        const dailyPlanQty = periodDays != null && periodDays > 0 ? Math.round(orderQtyNum / periodDays) : row.target;
                        return (
                          <Td px={3} py={2} borderBottom="1px solid" borderColor={rowBorder} whiteSpace="nowrap">
                            <VStack align="flex-start" spacing={0}>
                              <Text fontSize="xs" fontWeight="semibold" color={cellText}>
                                {periodStart} ~ {row.exfty}
                              </Text>
                              <Text fontSize="10px" color={mutedText}>
                                {periodDays ?? "–"} {t("kchDashboard.workdaysUnit")} · {dailyPlanQty}{t("kchDashboard.perDayShort")}
                              </Text>
                            </VStack>
                          </Td>
                        );
                      })()}
                    {showSchedule && (
                      <Td px={3} py={2} borderBottom="1px solid" borderColor={rowBorder}>
                        <MiniScheduleStrip
                          startIso={resolveAssemblyStart(row, holidayYmdSet)}
                          endIso={row.exfty}
                          efIso={row.exfty}
                          holidaySet={holidayYmdSet}
                          onClick={() => openSchedule(row)}
                        />
                      </Td>
                    )}
                    <Td px={3} py={2} borderBottom="1px solid" borderColor={rowBorder} color={cellText} fontSize="sm" textAlign="right" {...colStickyProps("orderQty", rowBg)}>
                      {row.orderQty}
                    </Td>
                    <Td px={3} py={2} borderBottom="1px solid" borderColor={rowBorder} color={cellText} fontSize="sm" textAlign="right" {...colStickyProps("balQty", rowBg)}>
                      {row.balQty}
                    </Td>
                    <Td px={3} py={2} borderBottom="1px solid" borderColor={rowBorder} color={cellText} fontSize="sm" textAlign="right" fontWeight="semibold" {...colStickyProps("today", rowBg)}>
                      {row.today}
                    </Td>
                    <Td px={3} py={2} borderBottom="1px solid" borderColor={rowBorder} textAlign="right" {...colStickyProps("targetPct", rowBg)}>
                      <TargetPctTag value={row.targetPct} />
                    </Td>
                    <Td px={3} py={2} borderBottom="1px solid" borderColor={rowBorder} textAlign="right" {...colStickyProps("targetPctHourly", rowBg)}>
                      {row.hourlyPct != null ? <TargetPctTag value={row.hourlyPct} /> : <Text color={mutedText} fontSize="sm">–</Text>}
                    </Td>
                    <Td px={3} py={2} borderBottom="1px solid" borderColor={rowBorder} color={mutedText} fontSize="sm" textAlign="center" {...colStickyProps("targetPerHour", rowBg)}>
                      {row.targetPerHour ?? "–"}
                    </Td>
                    <Td px={3} py={2} borderBottom="1px solid" borderColor={rowBorder} color={cellText} fontSize="sm" fontWeight="semibold" textAlign="center" {...colStickyProps("target", rowBg)}>
                      {row.target}
                    </Td>
                    {showExtra && (
                      <>
                        <Td px={3} py={2} borderBottom="1px solid" borderColor={rowBorder} bg={extraGroupBg[0]} textAlign="center">
                          <TargetDiffCell value={row.extra?.targetBD} baseline={row.targetPerHour} />
                        </Td>
                        <Td px={3} py={2} borderBottom="1px solid" borderColor={rowBorder} bg={extraGroupBg[0]} textAlign="center">
                          <TargetDiffCell value={row.extra?.snlBD} baseline={row.target} />
                        </Td>
                      </>
                    )}
                    {row.periods.map((v, idx) => (
                      <Td
                        key={idx}
                        px={2}
                        py={2}
                        borderBottom="1px solid"
                        borderColor={rowBorder}
                        bg={idx === currentPeriodIdx ? currentPeriodBg : undefined}
                        animation={idx === currentPeriodIdx ? `${currentPeriodPulse} 4s ease-in-out infinite` : undefined}
                      >
                        <PeriodCell
                          value={v}
                          target={row.target}
                          flagged={row.flagIdx === idx}
                          pct={row.pcts?.[idx]}
                          layoutHeadcount={row.extra?.targetVL}
                          actualHeadcount={row.extra?.snlVL}
                          showHeadcounts={showHeadcounts}
                        />
                      </Td>
                    ))}
                  </Tr>
                  {isExpanded &&
                    (row.modules ?? []).map((mod, modIdx) => {
                      const letterBg = modIdx % 2 === 0 ? subRowBgB : subRowBgC;
                      return (
                      <Tr key={mod.pk} bg={letterBg}>
                        <Td
                          px={3}
                          py={2}
                          borderBottom="1px solid"
                          borderRight="1px solid"
                          borderColor={rowBorder}
                          {...colStickyProps("line", letterBg)}
                        />
                        <Td px={3} py={2} borderBottom="1px solid" borderColor={rowBorder} whiteSpace="nowrap" {...colStickyProps("group", letterBg)}>
                          <Tag size="sm" borderRadius="full" colorScheme={modIdx % 2 === 0 ? "teal" : "purple"} fontWeight="bold">
                            {mod.code}
                          </Tag>
                        </Td>
                        <Td px={3} py={2} borderBottom="1px solid" borderColor={rowBorder} {...colStickyProps("po", letterBg)} />
                        <Td px={2} py={2} borderBottom="1px solid" borderColor={rowBorder} {...colStickyProps("thumbnail", letterBg)} />
                        <Td px={3} py={2} borderBottom="1px solid" borderColor={rowBorder} fontSize="sm" whiteSpace="nowrap" {...colStickyProps("style", letterBg)}>
                          <Link
                            color={linkColor}
                            fontWeight="semibold"
                            onClick={() => openAppPopupWindow(`/vl-assembly-production/modules/${mod.pk}`)}
                          >
                            {mod.code}
                          </Link>
                        </Td>
                        <Td px={2} py={2} borderBottom="1px solid" borderColor={rowBorder} {...colStickyProps("layout", letterBg)} />
                        <Td px={3} py={2} borderBottom="1px solid" borderColor={rowBorder} {...colStickyProps("exfty", letterBg)} />
                        {showSchedule &&
                          (mod.processStart && mod.processFinish ? (
                            (() => {
                              const periodDays = countRemainingWorkdays(mod.processFinish!, mod.processStart!, holidayYmdSet);
                              return (
                                <Td px={3} py={2} borderBottom="1px solid" borderColor={rowBorder} whiteSpace="nowrap">
                                  <VStack align="flex-start" spacing={0}>
                                    <Text fontSize="xs" fontWeight="semibold" color={cellText}>
                                      {mod.processStart} ~ {mod.processFinish}
                                    </Text>
                                    <Text fontSize="10px" color={mutedText}>
                                      {periodDays ?? "–"} {t("kchDashboard.workdaysUnit")}
                                    </Text>
                                  </VStack>
                                </Td>
                              );
                            })()
                          ) : (
                            <Td px={3} py={2} borderBottom="1px solid" borderColor={rowBorder} />
                          ))}
                        {showSchedule && (
                          <Td px={3} py={2} borderBottom="1px solid" borderColor={rowBorder}>
                            {mod.processStart && mod.processFinish && (
                              <MiniScheduleStrip
                                startIso={mod.processStart}
                                endIso={mod.processFinish}
                                efIso={mod.processFinish}
                                holidaySet={holidayYmdSet}
                              />
                            )}
                          </Td>
                        )}
                        <Td px={3} py={2} borderBottom="1px solid" borderColor={rowBorder} color={cellText} fontSize="sm" textAlign="right" {...colStickyProps("orderQty", letterBg)}>
                          {mod.orderQty || "–"}
                        </Td>
                        <Td px={3} py={2} borderBottom="1px solid" borderColor={rowBorder} color={cellText} fontSize="sm" textAlign="right" {...colStickyProps("balQty", letterBg)}>
                          {mod.balQty || "–"}
                        </Td>
                        <Td px={3} py={2} borderBottom="1px solid" borderColor={rowBorder} color={cellText} fontSize="sm" fontWeight="semibold" textAlign="right" {...colStickyProps("today", letterBg)}>
                          {mod.today}
                        </Td>
                        <Td px={3} py={2} borderBottom="1px solid" borderColor={rowBorder} textAlign="right" {...colStickyProps("targetPct", letterBg)}>
                          {mod.targetPct != null ? <TargetPctTag value={mod.targetPct} /> : <Text color={mutedText} fontSize="sm">–</Text>}
                        </Td>
                        <Td px={3} py={2} borderBottom="1px solid" borderColor={rowBorder} textAlign="right" {...colStickyProps("targetPctHourly", letterBg)}>
                          {mod.hourlyPct != null ? <TargetPctTag value={mod.hourlyPct} /> : <Text color={mutedText} fontSize="sm">–</Text>}
                        </Td>
                        <Td px={3} py={2} borderBottom="1px solid" borderColor={rowBorder} color={mutedText} fontSize="sm" textAlign="center" {...colStickyProps("targetPerHour", letterBg)}>
                          {mod.targetPerHour ?? "–"}
                        </Td>
                        <Td px={3} py={2} borderBottom="1px solid" borderColor={rowBorder} color={cellText} fontSize="sm" fontWeight="semibold" textAlign="center" {...colStickyProps("target", letterBg)}>
                          {mod.target ?? "–"}
                        </Td>
                        {showExtra &&
                          EXTRA_COLUMNS.map((eh, ei) => (
                            <Td key={eh} px={3} py={2} borderBottom="1px solid" borderColor={rowBorder} bg={extraGroupBg[EXTRA_COLUMN_GROUP[ei]]} color={mutedText} fontSize="sm" textAlign="right">
                              –
                            </Td>
                          ))}
                        {mod.periods.map((v, idx) => (
                          <Td
                            key={PERIODS[idx].key}
                            px={2}
                            py={2}
                            borderBottom="1px solid"
                            borderColor={rowBorder}
                            bg={idx === currentPeriodIdx ? currentPeriodBg : undefined}
                            animation={idx === currentPeriodIdx ? `${currentPeriodPulse} 4s ease-in-out infinite` : undefined}
                          >
                            <PeriodCell value={v} target={mod.target ?? 0} pct={mod.pcts?.[idx]} showHeadcounts={showHeadcounts} />
                          </Td>
                        ))}
                      </Tr>
                      );
                    })}
                  </Fragment>
                  );
                })}
                {!isInitialLoading && filteredRows.length === 0 && (
                  <Tr>
                    <Td colSpan={totalColCount} px={3} py={8} textAlign="center">
                      <Text color={mutedText} fontSize="sm">
                        {searchQuery.trim() ? t("kchDashboard.noSearchResults") : t("kchDashboard.noRows")}
                      </Text>
                    </Td>
                  </Tr>
                )}
                {!isInitialLoading && filteredRows.length > 0 && (
                  <Tr bg={headerBg} fontWeight="bold">
                    <Td
                      colSpan={LEADING_COLUMNS.indexOf("orderQty") + (showSchedule ? 2 : 0)}
                      px={3}
                      py={2}
                      borderTop="2px solid"
                      borderColor={cardBorder}
                      color={cellText}
                      fontSize="sm"
                      position="sticky"
                      left={0}
                      zIndex={3}
                      bg={headerBg}
                      {...(getStickyLeft("orderQty") > 0 ? { width: `${getStickyLeft("orderQty")}px`, minW: `${getStickyLeft("orderQty")}px` } : {})}
                    >
                      {t("kchDashboard.periodTotalLabel")}
                    </Td>
                    <Td borderTop="2px solid" borderColor={cardBorder} color={cellText} fontSize="sm" textAlign="right" {...colStickyProps("orderQty", headerBg)}>
                      {orderQtyTotal.toLocaleString()}
                    </Td>
                    <Td borderTop="2px solid" borderColor={cardBorder} color={cellText} fontSize="sm" textAlign="right" {...colStickyProps("balQty", headerBg)}>
                      {balQtyTotal.toLocaleString()}
                    </Td>
                    <Td borderTop="2px solid" borderColor={cardBorder} color={cellText} fontSize="sm" textAlign="right" {...colStickyProps("today", headerBg)}>
                      {todayTotal.toLocaleString()}
                    </Td>
                    <Td borderTop="2px solid" borderColor={cardBorder} {...colStickyProps("targetPct", headerBg)} />
                    <Td borderTop="2px solid" borderColor={cardBorder} {...colStickyProps("targetPctHourly", headerBg)} />
                    <Td borderTop="2px solid" borderColor={cardBorder} {...colStickyProps("targetPerHour", headerBg)} />
                    <Td borderTop="2px solid" borderColor={cardBorder} color={cellText} fontSize="sm" textAlign="center" {...colStickyProps("target", headerBg)}>
                      {targetTotal.toLocaleString()}
                    </Td>
                    {showExtra && (
                      <Td colSpan={EXTRA_COLUMNS.length} borderTop="2px solid" borderColor={cardBorder} />
                    )}
                    {periodTotals.map((pt, idx) => (
                      <Td
                        key={PERIODS[idx].key}
                        px={2}
                        py={2}
                        borderTop="2px solid"
                        borderColor={cardBorder}
                        textAlign="center"
                        bg={idx === currentPeriodIdx ? currentPeriodBg : headerBg}
                      >
                        <Text fontSize="sm" fontWeight="bold" color={cellText} lineHeight={1.2}>
                          {pt.sum > 0 ? pt.sum.toLocaleString() : "–"}
                        </Text>
                        {pt.sum > 0 && (
                          <Text fontSize="9px" color={mutedText} lineHeight={1.2}>
                            avg {pt.avg.toFixed(1)}
                          </Text>
                        )}
                      </Td>
                    ))}
                  </Tr>
                )}
              </Tbody>
            </Table>
          </Box>
        </Box>
      </Box>

      <Modal isOpen={isThumbOpen} onClose={onThumbClose} isCentered size="md">
        <ModalOverlay />
        <ModalContent bg="transparent" boxShadow="none">
          <ModalCloseButton color="white" bg="blackAlpha.600" borderRadius="full" />
          <ModalBody display="flex" flexDirection="column" alignItems="center" gap={3} p={0}>
            {activeThumb && (
              <>
                <Image src={activeThumb.url} alt={activeThumb.label} maxH="70vh" maxW="100%" borderRadius="lg" boxShadow="dark-lg" />
                <Text color="white" fontWeight="semibold" fontSize="sm" textShadow="0 1px 3px rgba(0,0,0,0.7)">
                  {activeThumb.label}
                </Text>
              </>
            )}
          </ModalBody>
        </ModalContent>
      </Modal>

      <Modal isOpen={isScheduleOpen} onClose={onScheduleClose} isCentered size="3xl">
        <ModalOverlay />
        <ModalContent bg={cardBg}>
          <ModalCloseButton top={4} right={4} />
          <ModalBody py={6}>
            {activeSchedule && (
              <>
                <HStack spacing={4} align="flex-start" mb={4}>
                  <Image
                    src={activeSchedule.row.thumbnail ?? makePlaceholderThumbnail(activeSchedule.row.style)}
                    alt={activeSchedule.label}
                    boxSize="64px"
                    borderRadius="md"
                    objectFit="cover"
                    cursor="zoom-in"
                    flexShrink={0}
                    onClick={() => openThumb(activeSchedule.row)}
                  />
                  <Box flex={1}>
                    <HStack justify="space-between" align="flex-start">
                      <Text fontWeight="bold" fontSize="md" color={cellText}>
                        {activeSchedule.label}
                      </Text>
                      <Link
                        color={linkColor}
                        fontSize="sm"
                        fontWeight="semibold"
                        onClick={() => openAppPopupWindow(`/vl-assembly-production/${activeSchedule.row.schedulePk}`)}
                      >
                        {t("kchDashboard.viewScheduleDetail")}
                      </Link>
                    </HStack>
                  </Box>
                </HStack>

                <VStack align="stretch" spacing={3} mb={4}>
                  {/* Plan: capacity & today's achievement */}
                  <Box>
                    <Text fontSize="10px" fontWeight="bold" color={mutedText} textTransform="uppercase" letterSpacing="wider" mb={1.5}>
                      {t("kchDashboard.kpiGroupPlan")}
                    </Text>
                    <SimpleGrid columns={{ base: 3 }} spacing={2}>
                      <Box borderWidth="1px" borderColor={cardBorder} borderRadius="md" px={3} py={2} borderTopWidth="3px" borderTopColor="blue.400">
                        <Text fontSize="10px" color={mutedText} fontWeight="semibold" textTransform="uppercase" letterSpacing="wider" noOfLines={1}>
                          {t("kchDashboard.targetPerHour")}
                        </Text>
                        <Text fontSize="lg" fontWeight="bold" color={cellText} mt={0.5}>
                          {Math.round(activeSchedule.target / 8)}
                        </Text>
                      </Box>
                      <Box borderWidth="1px" borderColor={cardBorder} borderRadius="md" px={3} py={2} borderTopWidth="3px" borderTopColor="teal.400">
                        <Text fontSize="10px" color={mutedText} fontWeight="semibold" textTransform="uppercase" letterSpacing="wider" noOfLines={1}>
                          {t("kchDashboard.columns.target")}
                        </Text>
                        <Text fontSize="lg" fontWeight="bold" color={cellText} mt={0.5}>
                          {activeSchedule.target}
                        </Text>
                      </Box>
                      <Box borderWidth="1px" borderColor={cardBorder} borderRadius="md" px={3} py={2} borderTopWidth="3px" borderTopColor="purple.400">
                        <Text fontSize="10px" color={mutedText} fontWeight="semibold" textTransform="uppercase" letterSpacing="wider" noOfLines={1}>
                          {t("kchDashboard.columns.targetPct")}
                        </Text>
                        <Box mt={1}>
                          <TargetPctTag value={activeSchedule.row.targetPct} />
                        </Box>
                      </Box>
                    </SimpleGrid>
                  </Box>

                  {scheduleStats && (
                    <>
                      {/* Progress: done vs remaining */}
                      <Box>
                        <Text fontSize="10px" fontWeight="bold" color={mutedText} textTransform="uppercase" letterSpacing="wider" mb={1.5}>
                          {t("kchDashboard.kpiGroupProgress")}
                        </Text>
                        <SimpleGrid columns={{ base: 2 }} spacing={2}>
                          <Box borderWidth="1px" borderColor={cardBorder} borderRadius="md" px={3} py={2} borderTopWidth="3px" borderTopColor="green.400">
                            <Text fontSize="10px" color={mutedText} fontWeight="semibold" textTransform="uppercase" letterSpacing="wider" noOfLines={1}>
                              {t("kchDashboard.cumulativeQty")}
                            </Text>
                            <Text fontSize="lg" fontWeight="bold" color={cellText} mt={0.5}>
                              {scheduleStats.cumulativeQty.toLocaleString()}
                            </Text>
                          </Box>
                          <Box borderWidth="1px" borderColor={cardBorder} borderRadius="md" px={3} py={2} borderTopWidth="3px" borderTopColor="orange.400">
                            <Text fontSize="10px" color={mutedText} fontWeight="semibold" textTransform="uppercase" letterSpacing="wider" noOfLines={1}>
                              {t("kchDashboard.columns.balQty")}
                            </Text>
                            <Text fontSize="lg" fontWeight="bold" color={cellText} mt={0.5}>
                              {scheduleStats.balQtyNum.toLocaleString()}
                            </Text>
                          </Box>
                        </SimpleGrid>
                      </Box>

                      {/* Pace: can we finish by Ex-Fty? */}
                      <Box>
                        <HStack justify="space-between" mb={1.5} flexWrap="wrap" rowGap={1}>
                          <Text fontSize="10px" fontWeight="bold" color={mutedText} textTransform="uppercase" letterSpacing="wider">
                            {t("kchDashboard.kpiGroupPace")}
                          </Text>
                          <Text
                            fontSize="10px"
                            fontWeight="semibold"
                            color={
                              scheduleStats.paceStatus === "behind"
                                ? workdaysUrgentColor
                                : scheduleStats.paceStatus === "ahead"
                                  ? "green.500"
                                  : mutedText
                            }
                          >
                            {scheduleStats.paceStatus === "behind"
                              ? t("kchDashboard.kpiPaceBehind")
                              : scheduleStats.paceStatus === "ahead"
                                ? t("kchDashboard.kpiPaceAhead")
                                : t("kchDashboard.kpiPaceOnTrack")}
                          </Text>
                        </HStack>
                        <SimpleGrid columns={{ base: 3 }} spacing={2}>
                          <Box borderWidth="1px" borderColor={cardBorder} borderRadius="md" px={3} py={2}>
                            <Text fontSize="10px" color={mutedText} fontWeight="semibold" textTransform="uppercase" letterSpacing="wider" noOfLines={1}>
                              {t("kchDashboard.remainingWorkdays")}
                            </Text>
                            <Text fontSize="lg" fontWeight="bold" color={cellText} mt={0.5}>
                              {scheduleStats.remainingWorkdays ?? "–"}
                            </Text>
                          </Box>
                          <Box borderWidth="1px" borderColor={cardBorder} borderRadius="md" px={3} py={2}>
                            <Text fontSize="10px" color={mutedText} fontWeight="semibold" textTransform="uppercase" letterSpacing="wider" noOfLines={1}>
                              {t("kchDashboard.avgDailyQty")}
                            </Text>
                            <Text fontSize="lg" fontWeight="bold" color={cellText} mt={0.5}>
                              {scheduleStats.avgDailyQty.toLocaleString()}
                            </Text>
                          </Box>
                          <Box
                            borderWidth="1px"
                            borderColor={scheduleStats.paceStatus === "behind" ? "red.300" : cardBorder}
                            borderRadius="md"
                            px={3}
                            py={2}
                            borderTopWidth="3px"
                            borderTopColor={scheduleStats.paceStatus === "behind" ? "red.400" : "red.300"}
                            bg={scheduleStats.paceStatus === "behind" ? "red.50" : undefined}
                            _dark={{ bg: scheduleStats.paceStatus === "behind" ? "red.900" : undefined }}
                          >
                            <Text fontSize="10px" color={mutedText} fontWeight="semibold" textTransform="uppercase" letterSpacing="wider" noOfLines={1}>
                              {t("kchDashboard.requiredDailyQty")}
                            </Text>
                            <Text fontSize="lg" fontWeight="bold" color={workdaysUrgentColor} mt={0.5}>
                              {scheduleStats.requiredDailyQty.toLocaleString()}
                            </Text>
                          </Box>
                        </SimpleGrid>
                      </Box>
                    </>
                  )}
                </VStack>

                <ScheduleCalendarHeatmap
                  assemblyStart={activeSchedule.start}
                  assemblyEnd={activeSchedule.end}
                  exFactoryDate={activeSchedule.ef}
                  holidaySet={holidayYmdSet}
                  dailyTargetQty={activeSchedule.target}
                  showChart={false}
                  showKpi={false}
                />
              </>
            )}
          </ModalBody>
        </ModalContent>
      </Modal>
    </>
  );
}
