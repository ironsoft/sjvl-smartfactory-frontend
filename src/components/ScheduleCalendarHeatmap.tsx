import { Box, Flex, Text, Tooltip, VStack, useColorModeValue } from "@chakra-ui/react";
import { useTranslation } from "react-i18next";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip as RechartTooltip,
  XAxis,
  YAxis,
} from "recharts";

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const CELL_W = 30;
const CELL_H = 52;
const DAY_LABELS = [1, 5, 10, 15, 20, 25, 31];

function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function parseDate(s: string | null): Date | null {
  if (!s) return null;
  const [y, m, d] = s.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

function toYMD(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function pctColor(pct: number): string {
  if (pct >= 100) return "green.500";
  if (pct >= 80) return "blue.400";
  if (pct >= 60) return "orange.400";
  return "red.400";
}

// ── 바 차트 ───────────────────────────────────────────────────────────────────
export interface DailyOutputBarChartProps {
  startYMD: string;
  endYMD: string;
  dailyOutputMap: ReadonlyMap<string, number>;
  dailyTargetQty: number | null;
  holidaySet: ReadonlySet<string>;
}

export function DailyOutputBarChart({ startYMD, endYMD, dailyOutputMap, dailyTargetQty, holidaySet }: DailyOutputBarChartProps) {
  const gridColor = useColorModeValue("#E2E8F0", "#2D3748");
  const axisColor = useColorModeValue("#A0AEC0", "#718096");
  const targetColor = useColorModeValue("#FC8181", "#F56565");

  const data: { label: string; ymd: string; qty: number }[] = [];
  const [sy, sm, sd] = startYMD.split("-").map(Number);
  const cur = new Date(sy, sm - 1, sd);
  while (toYMD(cur.getFullYear(), cur.getMonth(), cur.getDate()) <= endYMD) {
    const ymd = toYMD(cur.getFullYear(), cur.getMonth(), cur.getDate());
    if (cur.getDay() !== 0 && !holidaySet.has(ymd)) {
      data.push({ label: `${cur.getMonth() + 1}/${cur.getDate()}`, ymd, qty: dailyOutputMap.get(ymd) ?? 0 });
    }
    cur.setDate(cur.getDate() + 1);
  }

  if (data.length === 0) return null;

  const maxQty = Math.max(...data.map((d) => d.qty), dailyTargetQty ?? 0, 1);
  const yMax = Math.ceil((maxQty * 1.15) / 10) * 10;
  const interval = data.length > 20 ? 2 : data.length > 10 ? 1 : 0;

  return (
    <ResponsiveContainer width="100%" height={120}>
      <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }} barCategoryGap="20%">
        <CartesianGrid vertical={false} stroke={gridColor} strokeDasharray="3 3" />
        <XAxis dataKey="label" tick={{ fontSize: 9, fill: axisColor }} axisLine={false} tickLine={false} interval={interval} />
        <YAxis tick={{ fontSize: 9, fill: axisColor }} axisLine={false} tickLine={false} width={32} domain={[0, yMax]} tickCount={4} />
        <RechartTooltip
          cursor={{ fill: "rgba(0,0,0,0.05)" }}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const row = payload[0].payload as { label: string; qty: number };
            const pct = dailyTargetQty ? Math.round((row.qty / dailyTargetQty) * 100) : null;
            return (
              <Box bg="white" border="1px solid" borderColor="gray.200" borderRadius="md" px={2} py={1.5} shadow="sm">
                <Text fontSize="xs" fontWeight="bold" color="gray.700">{row.label}</Text>
                <Text fontSize="xs" color="gray.600">{row.qty.toLocaleString()}{dailyTargetQty ? ` / ${Math.round(dailyTargetQty).toLocaleString()}` : ""}</Text>
                {pct !== null && (
                  <Text fontSize="xs" fontWeight="bold" color={pct >= 100 ? "green.500" : pct >= 80 ? "blue.400" : pct >= 60 ? "orange.400" : "red.400"}>{pct}%</Text>
                )}
              </Box>
            );
          }}
        />
        {dailyTargetQty != null && <ReferenceLine y={dailyTargetQty} stroke={targetColor} strokeDasharray="4 3" strokeWidth={1.5} />}
        <Bar dataKey="qty" radius={[3, 3, 0, 0]}>
          {data.map((entry) => {
            const pct = dailyTargetQty && dailyTargetQty > 0 ? (entry.qty / dailyTargetQty) * 100 : null;
            const fill = entry.qty === 0 ? "#E2E8F0" : pct === null ? "#68D391" : pct >= 100 ? "#38A169" : pct >= 80 ? "#4299E1" : pct >= 60 ? "#ED8936" : "#FC8181";
            return <Cell key={entry.ymd} fill={fill} />;
          })}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── KPI 패널 ──────────────────────────────────────────────────────────────────
export interface DailyKpiPanelProps {
  assemblyStart: string | null;
  assemblyEnd: string | null;
  dailyOutputMap: ReadonlyMap<string, number>;
  dailyTargetQty: number | null;
  holidaySet: ReadonlySet<string>;
}

export function DailyKpiPanel({ assemblyStart, assemblyEnd, dailyOutputMap, dailyTargetQty, holidaySet }: DailyKpiPanelProps) {
  const { t } = useTranslation();
  const mutedText = useColorModeValue("gray.400", "gray.500");
  const borderColor = useColorModeValue("gray.200", "whiteAlpha.200");
  const kpiBg = useColorModeValue("gray.50", "whiteAlpha.50");
  const dividerColor = useColorModeValue("gray.300", "gray.600");
  const base = "vlFactoryLive.detail.scheduleOverview";
  const daysUnit = t(`${base}.daysUnit`);

  const start = parseDate(assemblyStart);
  const end = parseDate(assemblyEnd);
  if (!start || !end) return null;

  const startYMD = toYMD(start.getFullYear(), start.getMonth(), start.getDate());
  const endYMD = toYMD(end.getFullYear(), end.getMonth(), end.getDate());

  let totalOutput = 0;
  let activeDays = 0;
  const d = new Date(start);
  while (toYMD(d.getFullYear(), d.getMonth(), d.getDate()) <= endYMD) {
    const ymd = toYMD(d.getFullYear(), d.getMonth(), d.getDate());
    if (d.getDay() !== 0 && !holidaySet.has(ymd)) {
      const qty = dailyOutputMap.get(ymd) ?? 0;
      if (qty > 0) { totalOutput += qty; activeDays++; }
    }
    d.setDate(d.getDate() + 1);
  }

  const avgDailyOutput = activeDays > 0 ? Math.round(totalOutput / activeDays) : null;
  const avgDailyTarget = dailyTargetQty ?? null;
  const avgAchievementPct = avgDailyOutput != null && avgDailyTarget != null && avgDailyTarget > 0
    ? Math.round((avgDailyOutput / avgDailyTarget) * 100) : null;

  if (avgDailyOutput == null && avgDailyTarget == null) return null;

  return (
    <Flex gap={3} p={2.5} bg={kpiBg} borderRadius="lg" border="1px solid" borderColor={borderColor} flexWrap="wrap">
      <Box>
        <Text fontSize="9px" color={mutedText} fontWeight="semibold" textTransform="uppercase" letterSpacing="wider">{t(`${base}.kpiAvgOutput`)}</Text>
        <Text fontSize="lg" fontWeight="bold" lineHeight={1.1} sx={{ fontVariantNumeric: "tabular-nums" }}>{avgDailyOutput != null ? avgDailyOutput.toLocaleString() : "—"}</Text>
        {activeDays > 0 && <Text fontSize="9px" color={mutedText}>{t(`${base}.kpiActiveDays`)} {activeDays}{daysUnit}</Text>}
      </Box>
      <Box color={dividerColor} fontSize="lg" alignSelf="center">·</Box>
      <Box>
        <Text fontSize="9px" color={mutedText} fontWeight="semibold" textTransform="uppercase" letterSpacing="wider">{t(`${base}.kpiAvgTarget`)}</Text>
        <Text fontSize="lg" fontWeight="bold" lineHeight={1.1} sx={{ fontVariantNumeric: "tabular-nums" }}>{avgDailyTarget != null ? Math.round(avgDailyTarget).toLocaleString() : "—"}</Text>
        {avgDailyTarget != null && <Text fontSize="9px" color={mutedText}>×8h</Text>}
      </Box>
      <Box color={dividerColor} fontSize="lg" alignSelf="center">·</Box>
      <Box>
        <Text fontSize="9px" color={avgAchievementPct != null ? pctColor(avgAchievementPct) : mutedText} fontWeight="semibold" textTransform="uppercase" letterSpacing="wider">{t(`${base}.kpiAvgAchievement`)}</Text>
        <Text fontSize="lg" fontWeight="bold" lineHeight={1.1} color={avgAchievementPct != null ? pctColor(avgAchievementPct) : undefined} sx={{ fontVariantNumeric: "tabular-nums" }}>
          {avgAchievementPct != null ? `${avgAchievementPct}%` : "—"}
        </Text>
      </Box>
    </Flex>
  );
}

// ── 메인 히트맵 ───────────────────────────────────────────────────────────────
interface Props {
  assemblyStart: string | null;
  assemblyEnd: string | null;
  exFactoryDate: string | null;
  holidaySet?: ReadonlySet<string>;
  holidayNameMap?: ReadonlyMap<string, string>;
  dailyOutputMap?: ReadonlyMap<string, number>;
  dailyTargetQty?: number | null;
  showPeriodSummary?: boolean;
  showChart?: boolean;
  showKpi?: boolean;
}

export default function ScheduleCalendarHeatmap({
  assemblyStart,
  assemblyEnd,
  exFactoryDate,
  holidaySet = new Set(),
  holidayNameMap = new Map(),
  dailyOutputMap = new Map(),
  dailyTargetQty = null,
  showPeriodSummary = true,
  showChart = true,
  showKpi = true,
}: Props) {
  const { t } = useTranslation();
  const cellBg = useColorModeValue("gray.100", "whiteAlpha.100");
  const borderColor = useColorModeValue("gray.200", "whiteAlpha.200");
  const mutedText = useColorModeValue("gray.400", "gray.500");
  const labelColor = useColorModeValue("gray.500", "gray.400");
  const dividerColor = useColorModeValue("gray.300", "gray.600");
  const kpiBg = useColorModeValue("gray.50", "whiteAlpha.50");
  const cellTextMuted = useColorModeValue("gray.400", "gray.500");

  const start = parseDate(assemblyStart);
  const end = parseDate(assemblyEnd);
  const ef = parseDate(exFactoryDate);

  const startYMD = start ? toYMD(start.getFullYear(), start.getMonth(), start.getDate()) : null;
  const endYMD = end ? toYMD(end.getFullYear(), end.getMonth(), end.getDate()) : null;
  const efYMD = ef ? toYMD(ef.getFullYear(), ef.getMonth(), ef.getDate()) : null;

  const dates = [start, end, ef].filter(Boolean) as Date[];
  if (dates.length === 0) return null;

  const minDate = dates.reduce((a, b) => (a < b ? a : b));
  const maxDate = dates.reduce((a, b) => (a > b ? a : b));

  const monthSet: { year: number; month: number }[] = [];
  let cur = new Date(minDate.getFullYear(), minDate.getMonth(), 1);
  const maxYM = maxDate.getFullYear() * 12 + maxDate.getMonth();
  while (cur.getFullYear() * 12 + cur.getMonth() <= maxYM) {
    monthSet.push({ year: cur.getFullYear(), month: cur.getMonth() });
    cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
  }
  const hasMultiYear = new Set(monthSet.map((m) => m.year)).size > 1;

  let workingDays = 0, totalDaysInPeriod = 0;
  if (start && end && startYMD && endYMD) {
    const d = new Date(start);
    while (toYMD(d.getFullYear(), d.getMonth(), d.getDate()) <= endYMD) {
      const ymd = toYMD(d.getFullYear(), d.getMonth(), d.getDate());
      totalDaysInPeriod++;
      if (d.getDay() !== 0 && !holidaySet.has(ymd)) workingDays++;
      d.setDate(d.getDate() + 1);
    }
  }
  const nonWorkingDays = totalDaysInPeriod - workingDays;

  // KPI (only when showKpi)
  let totalOutput = 0, activeDays = 0;
  if (showKpi && startYMD && endYMD) {
    const d = new Date(start!);
    while (toYMD(d.getFullYear(), d.getMonth(), d.getDate()) <= endYMD) {
      const ymd = toYMD(d.getFullYear(), d.getMonth(), d.getDate());
      if (d.getDay() !== 0 && !holidaySet.has(ymd)) {
        const qty = dailyOutputMap.get(ymd) ?? 0;
        if (qty > 0) { totalOutput += qty; activeDays++; }
      }
      d.setDate(d.getDate() + 1);
    }
  }
  const avgDailyOutput = activeDays > 0 ? Math.round(totalOutput / activeDays) : null;
  const avgDailyTarget = dailyTargetQty ?? null;
  const avgAchievementPct = avgDailyOutput != null && avgDailyTarget != null && avgDailyTarget > 0
    ? Math.round((avgDailyOutput / avgDailyTarget) * 100) : null;

  const base = "vlFactoryLive.detail.scheduleOverview";
  const daysUnit = t(`${base}.daysUnit`);

  return (
    <Flex gap={5} align="flex-start" flexWrap="wrap">
      {/* Left: 기간 요약 */}
      {showPeriodSummary && totalDaysInPeriod > 0 && (
        <VStack align="flex-start" spacing={0} flexShrink={0} minW="120px">
          <Box>
            <Text fontSize="9px" color={mutedText} fontWeight="semibold" textTransform="uppercase" letterSpacing="wider" mb="2px">{t(`${base}.assemblyPeriod`)}</Text>
            <Text fontSize="xl" fontWeight="bold" lineHeight={1}>{totalDaysInPeriod}<Text as="span" fontSize="sm" fontWeight="medium" ml="2px">{daysUnit}</Text></Text>
          </Box>
          <Text color={dividerColor} fontSize="lg" lineHeight={1} py={1}>−</Text>
          <Box>
            <Text fontSize="9px" color="red.400" fontWeight="semibold" textTransform="uppercase" letterSpacing="wider" mb="2px">{t(`${base}.sundayHoliday`)}</Text>
            <Text fontSize="xl" fontWeight="bold" color="red.400" lineHeight={1}>{nonWorkingDays}<Text as="span" fontSize="sm" fontWeight="medium" ml="2px">{daysUnit}</Text></Text>
          </Box>
          <Text color={dividerColor} fontSize="lg" lineHeight={1} py={1}>=</Text>
          <Box>
            <Text fontSize="9px" color="green.500" fontWeight="semibold" textTransform="uppercase" letterSpacing="wider" mb="2px">{t(`${base}.workingDays`)}</Text>
            <Text fontSize="xl" fontWeight="bold" color="green.500" lineHeight={1}>{workingDays}<Text as="span" fontSize="sm" fontWeight="medium" ml="2px">{daysUnit}</Text></Text>
          </Box>
        </VStack>
      )}

      {/* Right: 캘린더 */}
      <Box overflowX="auto" flex={1}>
        {/* Header */}
        <Flex align="center" mb="3px" ml="44px" gap="2px">
          {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
            <Box key={d} w={`${CELL_W}px`} flexShrink={0} textAlign="center">
              {DAY_LABELS.includes(d) && <Text fontSize="8px" color={mutedText} lineHeight={1}>{d}</Text>}
            </Box>
          ))}
        </Flex>

        {/* Month rows */}
        {monthSet.map(({ year, month }) => {
          const totalDays = daysInMonth(year, month);
          const yearSuffix = hasMultiYear ? ` '${String(year).slice(2)}` : "";
          return (
            <Flex key={`${year}-${month}`} align="center" mb="3px" gap="2px">
              <Text w="40px" fontSize="10px" fontWeight="semibold" color={labelColor} flexShrink={0} textAlign="right" pr="4px" lineHeight={`${CELL_H}px`}>
                {MONTH_NAMES[month]}{yearSuffix}
              </Text>
              {Array.from({ length: 31 }, (_, dayIdx) => {
                const day = dayIdx + 1;
                if (day > totalDays) return <Box key={dayIdx} w={`${CELL_W}px`} h={`${CELL_H}px`} flexShrink={0} />;

                const ymd = toYMD(year, month, day);
                const isSun = new Date(year, month, day).getDay() === 0;
                const isHoliday = holidaySet.has(ymd);
                const isEf = ymd === efYMD;
                const isAssembly = !!(startYMD && endYMD && ymd >= startYMD && ymd <= endYMD);
                const isNonWorking = isSun || isHoliday;
                const isWorkingAssembly = isAssembly && !isNonWorking;
                const outputQty = dailyOutputMap.get(ymd) ?? 0;
                const hasOutput = outputQty > 0;
                const pct = dailyTargetQty && dailyTargetQty > 0 ? Math.round((outputQty / dailyTargetQty) * 100) : null;

                const parts: string[] = [ymd];
                if (isSun) parts.push(`(${t(`${base}.tooltipSunday`)})`);
                if (isHoliday) parts.push(`(${holidayNameMap.get(ymd) || t(`${base}.tooltipHoliday`)})`);
                if (hasOutput) parts.push(`▶ ${outputQty.toLocaleString()}`);
                if (pct !== null) parts.push(`${pct}%`);

                let bg = cellBg, cellBorderColor = borderColor;
                if (isEf) {
                  bg = "orange.400"; cellBorderColor = "orange.500";
                  parts.push(`— ${t(`${base}.tooltipExFactory`)}`);
                } else if (isAssembly && isNonWorking) {
                  bg = isHoliday && !isSun ? "red.300" : "red.200"; cellBorderColor = "red.400";
                } else if (isWorkingAssembly) {
                  bg = "green.50"; cellBorderColor = "green.300";
                } else if (isNonWorking) {
                  bg = "red.100"; cellBorderColor = "red.200";
                }

                return (
                  <Tooltip key={dayIdx} label={parts.join(" ")} fontSize="xs" hasArrow openDelay={150} placement="top">
                    <Box w={`${CELL_W}px`} h={`${CELL_H}px`} borderRadius="4px" bg={bg} border="1px solid" borderColor={cellBorderColor} flexShrink={0} overflow="hidden" transition="transform 0.1s" _hover={{ transform: "scale(1.08)", zIndex: 10, position: "relative" }} display="flex" flexDirection="column" alignItems="center" justifyContent="center" gap="1px" px="1px">
                      <Text fontSize="8px" color={isWorkingAssembly ? "green.700" : cellTextMuted} lineHeight={1} fontWeight="semibold">{day}</Text>
                      {isWorkingAssembly && (
                        <>
                          <Text fontSize="9px" fontWeight="bold" lineHeight={1} color={hasOutput ? (pct !== null ? pctColor(pct) : "gray.700") : "gray.300"} sx={{ fontVariantNumeric: "tabular-nums" }}>
                            {hasOutput ? outputQty.toLocaleString() : "—"}
                          </Text>
                          {dailyTargetQty != null && (
                            <Text fontSize="8px" lineHeight={1} color={cellTextMuted} sx={{ fontVariantNumeric: "tabular-nums" }}>/{Math.round(dailyTargetQty).toLocaleString()}</Text>
                          )}
                          {pct !== null && hasOutput && (
                            <Text fontSize="8px" fontWeight="bold" lineHeight={1} color={pctColor(pct)} sx={{ fontVariantNumeric: "tabular-nums" }}>{pct}%</Text>
                          )}
                        </>
                      )}
                      {isEf && <Text fontSize="8px" color="white" fontWeight="bold" lineHeight={1}>EF</Text>}
                    </Box>
                  </Tooltip>
                );
              })}
            </Flex>
          );
        })}

        {/* Legend */}
        <Flex mt={2} ml="44px" gap={4} align="center" flexWrap="wrap">
          {[
            { bg: "green.50", border: "green.300", label: t(`${base}.legendAssembly`) },
            { bg: "orange.400", border: "orange.500", label: t(`${base}.legendExFactory`) },
            { bg: "red.200", border: "red.400", label: t(`${base}.legendSunday`) },
            { bg: "red.300", border: "red.400", label: t(`${base}.legendHoliday`) },
          ].map(({ bg, border, label }) => (
            <Flex key={label} align="center" gap="5px">
              <Box w="10px" h="10px" borderRadius="2px" bg={bg} border="1px solid" borderColor={border} />
              <Text fontSize="10px" color={labelColor}>{label}</Text>
            </Flex>
          ))}
        </Flex>

        {/* KPI */}
        {showKpi && (avgDailyOutput != null || avgDailyTarget != null) && (
          <Flex mt={3} ml="44px" gap={3} p={2.5} bg={kpiBg} borderRadius="lg" border="1px solid" borderColor={borderColor} flexWrap="wrap">
            <Box>
              <Text fontSize="9px" color={mutedText} fontWeight="semibold" textTransform="uppercase" letterSpacing="wider">{t(`${base}.kpiAvgOutput`)}</Text>
              <Text fontSize="lg" fontWeight="bold" lineHeight={1.1} sx={{ fontVariantNumeric: "tabular-nums" }}>{avgDailyOutput != null ? avgDailyOutput.toLocaleString() : "—"}</Text>
              {activeDays > 0 && <Text fontSize="9px" color={mutedText}>{t(`${base}.kpiActiveDays`)} {activeDays}{daysUnit}</Text>}
            </Box>
            <Box color={dividerColor} fontSize="lg" alignSelf="center">·</Box>
            <Box>
              <Text fontSize="9px" color={mutedText} fontWeight="semibold" textTransform="uppercase" letterSpacing="wider">{t(`${base}.kpiAvgTarget`)}</Text>
              <Text fontSize="lg" fontWeight="bold" lineHeight={1.1} sx={{ fontVariantNumeric: "tabular-nums" }}>{avgDailyTarget != null ? Math.round(avgDailyTarget).toLocaleString() : "—"}</Text>
              {avgDailyTarget != null && <Text fontSize="9px" color={mutedText}>×8h</Text>}
            </Box>
            <Box color={dividerColor} fontSize="lg" alignSelf="center">·</Box>
            <Box>
              <Text fontSize="9px" color={avgAchievementPct != null ? pctColor(avgAchievementPct) : mutedText} fontWeight="semibold" textTransform="uppercase" letterSpacing="wider">{t(`${base}.kpiAvgAchievement`)}</Text>
              <Text fontSize="lg" fontWeight="bold" lineHeight={1.1} color={avgAchievementPct != null ? pctColor(avgAchievementPct) : undefined} sx={{ fontVariantNumeric: "tabular-nums" }}>
                {avgAchievementPct != null ? `${avgAchievementPct}%` : "—"}
              </Text>
            </Box>
          </Flex>
        )}

        {/* Bar chart */}
        {showChart && startYMD && endYMD && (
          <Box mt={3} ml="44px">
            <DailyOutputBarChart startYMD={startYMD} endYMD={endYMD} dailyOutputMap={dailyOutputMap} dailyTargetQty={dailyTargetQty} holidaySet={holidaySet} />
          </Box>
        )}
      </Box>
    </Flex>
  );
}
