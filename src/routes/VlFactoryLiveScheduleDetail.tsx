import {
  Badge,
  Box,
  Collapse,
  Center,
  Flex,
  HStack,
  IconButton,
  Image,
  Link,
  Modal,
  ModalContent,
  ModalOverlay,
  Progress,
  Spinner,
  Table,
  TableContainer,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tooltip,
  Tr,
  VStack,
  useColorModeValue,
  useDisclosure,
} from "@chakra-ui/react";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet";
import {
  FiArrowLeft,
  FiBox,
  FiChevronDown,
  FiChevronUp,
  FiExternalLink,
  FiRefreshCw,
  FiX,
} from "react-icons/fi";
import ScheduleCalendarHeatmap, { DailyOutputBarChart, DailyKpiPanel } from "../components/ScheduleCalendarHeatmap";
import {
  Link as RouterLink,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  getVlFactoryLiveScheduleDetail,
  getVlPlanHolidays,
  getVlAssemblyScheduleProductionDailyOutputs,
  getVlAssemblyModuleProductionDailyOutputs,
  type VlLiveModule,
} from "../api";
import { planHolidayApiRangeForScheduleDates } from "../lib/vlPlanHolidayRange";
import LocalizedDateInput from "../components/LocalizedDateInput";
import VlHourlyBarChart from "../components/VlHourlyBarChart";
import {
  AvgRateBadge,
  KpiCard,
  LiveDot,
  hourlyStats,
  pctColor,
  pctTextColor,
  statusKey,
} from "./VlFactoryLive";

function statusColorScheme(status: string) {
  const map: Record<string, string> = {
    not_started: "gray",
    in_progress: "blue",
    completed: "green",
    outsourced: "purple",
    not_ready: "red",
  };
  return map[status] ?? "gray";
}


// ── 섹션 카드 래퍼 ───────────────────────────────────────────────────────────
function SectionCard({
  title,
  right,
  children,
}: {
  title: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  const bg = useColorModeValue("white", "gray.800");
  const border = useColorModeValue("gray.200", "gray.700");
  const labelColor = useColorModeValue("gray.500", "gray.400");
  return (
    <Box bg={bg} border="1px solid" borderColor={border} borderRadius="xl" px={4} py={3}>
      <Flex justify="space-between" align="center" mb={2.5}>
        <Text
          fontSize="10px"
          color={labelColor}
          fontWeight="bold"
          textTransform="uppercase"
          letterSpacing="wider"
        >
          {title}
        </Text>
        {right}
      </Flex>
      {children}
    </Box>
  );
}

// ── 접기/펼치기 섹션 ─────────────────────────────────────────────────────────
function CollapsibleSection({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const border = useColorModeValue("gray.200", "gray.700");
  const headerBg = useColorModeValue("gray.50", "gray.700");
  const labelColor = useColorModeValue("gray.500", "gray.400");
  return (
    <Box border="1px solid" borderColor={border} borderRadius="lg" overflow="hidden">
      <Flex
        as="button"
        w="100%"
        px={3}
        py={2}
        bg={headerBg}
        align="center"
        justify="space-between"
        onClick={() => setOpen((v) => !v)}
        cursor="pointer"
        _hover={{ bg: useColorModeValue("gray.100", "gray.600") }}
        transition="background 0.15s"
      >
        <Text fontSize="10px" fontWeight="semibold" color={labelColor} textTransform="uppercase" letterSpacing="wider">{title}</Text>
        <Box color={labelColor}>{open ? <FiChevronUp size={13} /> : <FiChevronDown size={13} />}</Box>
      </Flex>
      <Collapse in={open} animateOpacity>
        <Box px={3} py={3}>{children}</Box>
      </Collapse>
    </Box>
  );
}

// ── 모듈 상세 카드 ───────────────────────────────────────────────────────────
interface ModuleDetailCardProps {
  mod: VlLiveModule;
  assemblyStart?: string | null;
  assemblyEnd?: string | null;
  holidaySet?: ReadonlySet<string>;
  dailyOutputMap?: ReadonlyMap<string, number>;
}

function ModuleDetailCard({ mod, assemblyStart, assemblyEnd, holidaySet = new Set(), dailyOutputMap = new Map() }: ModuleDetailCardProps) {
  const { t } = useTranslation();
  const bg = useColorModeValue("white", "gray.800");
  const border = useColorModeValue("gray.200", "gray.700");
  const labelColor = useColorModeValue("gray.500", "gray.400");
  const missBorder = useColorModeValue("red.300", "red.600");

  const pct = mod.total_qty > 0 ? Math.min((mod.output_qty / mod.total_qty) * 100, 100) : 0;
  const color = pctColor(pct);
  const stats = hourlyStats(mod.hourly, mod.target_qty_per_hour);
  const isMissingTarget = stats.meets === false;

  return (
    <Box
      bg={bg}
      border="1px solid"
      borderColor={isMissingTarget ? missBorder : border}
      borderRadius="xl"
      px={4}
      py={3}
    >
      <Flex justify="space-between" align="center" mb={2} gap={2} flexWrap="wrap">
        <HStack gap={2} minW={0}>
          <Center
            w={7}
            h={7}
            bg="gray.500"
            color="white"
            borderRadius="md"
            fontSize="xs"
            fontWeight="bold"
            flexShrink={0}
          >
            {mod.code}
          </Center>
          <Text fontSize="sm" fontWeight="bold" noOfLines={1}>
            {mod.name || mod.code}
          </Text>
          <Badge colorScheme={statusColorScheme(mod.status)} fontSize="9px" borderRadius="full" px={1.5}>
            {t(statusKey(mod.status))}
          </Badge>
        </HStack>
        <HStack gap={2} flexShrink={0}>
          {mod.target_qty_per_hour != null && (
            <Tooltip label={t("vlFactoryLive.hourlyTargetQty")} hasArrow placement="top">
              <Badge colorScheme="purple" fontSize="10px" variant="subtle" cursor="default" borderRadius="full" px={2}>
                {mod.target_qty_per_hour}/h
              </Badge>
            </Tooltip>
          )}
          <AvgRateBadge hourly={mod.hourly} target={mod.target_qty_per_hour} />
          <Text fontSize="sm" sx={{ fontVariantNumeric: "tabular-nums" }}>
            <Text as="span" fontWeight="bold">{mod.output_qty.toLocaleString()}</Text>
            {mod.total_qty > 0 && (
              <Text as="span" color={labelColor}> / {mod.total_qty.toLocaleString()}</Text>
            )}
          </Text>
        </HStack>
      </Flex>

      <Progress value={pct} colorScheme={color} size="sm" borderRadius="full" mb={3} />

      <VlHourlyBarChart hourly={mod.hourly} target={mod.target_qty_per_hour} barAreaH={90} />

      <Flex justify="space-between" mt={2}>
        <Text fontSize="10px" color={labelColor}>
          {stats.slots > 0
            ? t("vlFactoryLive.detail.todaySlotInfo", { total: stats.total.toLocaleString(), slots: stats.slots, avg: Math.round(stats.avg) })
            : t("vlFactoryLive.detail.todaySlotInfoNoAvg", { total: stats.total.toLocaleString(), slots: stats.slots })}
        </Text>
        {mod.total_qty > 0 && (
          <Text fontSize="10px" color={labelColor}>
            {t("vlFactoryLive.achievementRate")}{" "}
            <Text as="span" fontWeight="bold" color={pctTextColor(pct)}>
              {pct.toFixed(1)}%
            </Text>
          </Text>
        )}
      </Flex>

      {/* ── 일별 실적 (접기/펼치기) ── */}
      {assemblyStart && assemblyEnd && (
        <Box mt={3}>
          <CollapsibleSection title={t("vlFactoryLive.detail.scheduleOverview.title")}>
            {(() => {
              const modTarget = mod.target_qty_per_hour != null ? mod.target_qty_per_hour * 8 : null;
              return (
                <Box display="flex" flexDirection="column" gap={4}>
                  <ScheduleCalendarHeatmap
                    assemblyStart={assemblyStart}
                    assemblyEnd={assemblyEnd}
                    exFactoryDate={null}
                    holidaySet={holidaySet}
                    dailyOutputMap={dailyOutputMap}
                    dailyTargetQty={modTarget}
                    showPeriodSummary={false}
                    showChart={false}
                    showKpi={false}
                  />
                  <DailyOutputBarChart
                    startYMD={assemblyStart.slice(0, 10)}
                    endYMD={assemblyEnd.slice(0, 10)}
                    dailyOutputMap={dailyOutputMap}
                    dailyTargetQty={modTarget}
                    holidaySet={holidaySet}
                  />
                  <DailyKpiPanel
                    assemblyStart={assemblyStart}
                    assemblyEnd={assemblyEnd}
                    dailyOutputMap={dailyOutputMap}
                    dailyTargetQty={modTarget}
                    holidaySet={holidaySet}
                  />
                </Box>
              );
            })()}
          </CollapsibleSection>
        </Box>
      )}
    </Box>
  );
}

// ── 메인 페이지 ──────────────────────────────────────────────────────────────
export default function VlFactoryLiveScheduleDetail() {
  const { t } = useTranslation();
  const { schedulePk } = useParams<{ schedulePk: string }>();
  const pk = Number(schedulePk);
  const today = new Date().toISOString().slice(0, 10);

  const [searchParams, setSearchParams] = useSearchParams();
  const date = searchParams.get("date") || today;
  const isPopup = searchParams.get("popup") === "1";
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [calOpen, setCalOpen] = useState(false);
  const { isOpen: isThumbOpen, onOpen: onThumbOpen, onClose: onThumbClose } = useDisclosure();

  const setDate = (v: string) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set("date", v);
        return next;
      },
      { replace: true },
    );
  };

  const bgPage = useColorModeValue("gray.100", "gray.900");
  const headerBg = useColorModeValue("white", "gray.800");
  const headerBorder = useColorModeValue("gray.200", "gray.700");
  const mutedText = useColorModeValue("gray.500", "gray.400");
  const cardBg = useColorModeValue("white", "gray.800");
  const thumbBg = useColorModeValue("gray.100", "gray.600");

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["vl-factory-live-schedule-detail", pk, date],
    queryFn: () => getVlFactoryLiveScheduleDetail(pk, date),
    refetchInterval: 60_000,
    retry: false,
  });

  useEffect(() => {
    if (!isFetching) setLastRefreshed(new Date());
  }, [isFetching]);

  const schedule = data?.schedule ?? null;
  const lineName = data?.line_name ?? null;

  // ── 공휴일 fetch ──────────────────────────────────────────────────────────
  const planHolidayApiRange = useMemo(
    () => planHolidayApiRangeForScheduleDates([schedule?.assembly_start, schedule?.assembly_end, schedule?.ex_factory_date]),
    [schedule?.assembly_start, schedule?.assembly_end, schedule?.ex_factory_date],
  );

  const { data: planHolidayRows = [] } = useQuery({
    queryKey: ["vlPlanHolidays", "factoryLiveDetail", planHolidayApiRange.date_from, planHolidayApiRange.date_to],
    queryFn: async () => {
      try { return await getVlPlanHolidays(planHolidayApiRange); } catch { return []; }
    },
    enabled: !!schedule,
    staleTime: 300_000,
  });

  // ── 일별 생산실적 fetch ───────────────────────────────────────────────────
  // schedule 로드를 기다리지 않고 pk만으로 즉시 시작 (waterfall 제거)
  const { data: dailyOutputData } = useQuery({
    queryKey: ["vlScheduleDailyOutputs", pk],
    queryFn: async () => {
      try {
        return await getVlAssemblyScheduleProductionDailyOutputs({
          schedule: pk,
          page_size: 500,
        });
      } catch { return null; }
    },
    enabled: !!pk,
    staleTime: 60_000,
    refetchInterval: 60_000,
  });

  const dailyOutputMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of dailyOutputData?.results ?? []) {
      const date = String(row.recorded_at ?? "").slice(0, 10);
      if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        map.set(date, (map.get(date) ?? 0) + row.qty);
      }
    }
    return map;
  }, [dailyOutputData]);

  const dailyTargetQty = schedule?.assembly_target_qty_per_hour != null
    ? schedule.assembly_target_qty_per_hour * 8
    : null;

  // ── 모듈 일별 실적 fetch ──────────────────────────────────────────────────
  // schedule 로드를 기다리지 않고 pk만으로 즉시 시작 (waterfall 제거)
  const { data: moduleDailyOutputData } = useQuery({
    queryKey: ["vlModuleDailyOutputs", pk],
    queryFn: async () => {
      try {
        return await getVlAssemblyModuleProductionDailyOutputs({
          schedule: pk,
          page_size: 500,
        });
      } catch { return null; }
    },
    enabled: !!pk,
    staleTime: 60_000,
    refetchInterval: 60_000,
  });

  const moduleOutputsByCode = useMemo(() => {
    const map = new Map<string, Map<string, number>>();
    for (const row of moduleDailyOutputData?.results ?? []) {
      const code = row.vl_assembly_module_code;
      const date = String(row.recorded_at ?? "").slice(0, 10);
      if (!code || !/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
      if (!map.has(code)) map.set(code, new Map());
      const dateMap = map.get(code)!;
      dateMap.set(date, (dateMap.get(date) ?? 0) + row.qty);
    }
    return map;
  }, [moduleDailyOutputData]);

  const { holidaySet, holidayNameMap } = useMemo(() => {
    const set = new Set<string>();
    const nameMap = new Map<string, string>();
    for (const h of planHolidayRows) {
      const d = String(h.date ?? "").slice(0, 10);
      if (/^\d{4}-\d{2}-\d{2}$/.test(d)) {
        set.add(d);
        if (h.name) nameMap.set(d, h.name);
      }
    }
    return { holidaySet: set, holidayNameMap: nameMap };
  }, [planHolidayRows]);

  const stats = hourlyStats(schedule?.hourly, schedule?.assembly_target_qty_per_hour ?? null);
  const isActiveToday = (schedule?.hourly ?? []).some((e) => e.qty > 0);
  const effectiveTotal = schedule ? (schedule.vl_effective_qty || schedule.total_order_qty) : 0;
  const effectivePct = schedule && effectiveTotal > 0
    ? parseFloat((schedule.assembly_output_qty / effectiveTotal * 100).toFixed(1))
    : (schedule?.progress_pct ?? 0);
  const pct = effectivePct;
  const color = pctColor(pct);

  // EF D-Day / 잔량 / 일일 필요수량
  let efInfo: { diffLabel: string; diffColor: string; balance: number; dailyRequired: number | null } | null = null;
  if (schedule?.ex_factory_date) {
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    const ef = new Date(schedule.ex_factory_date);
    ef.setHours(0, 0, 0, 0);
    const diff = Math.round((ef.getTime() - t.getTime()) / 86400000);
    const balance = (effectiveTotal ?? 0) - (schedule.assembly_output_qty ?? 0);
    efInfo = {
      diffLabel: diff === 0 ? "D-Day" : diff > 0 ? `D-${diff}` : `D+${Math.abs(diff)}`,
      diffColor: diff < 0 ? "red.500" : diff <= 7 ? "orange.500" : "gray.500",
      balance,
      dailyRequired: diff > 0 && balance > 0 ? Math.ceil(balance / diff) : null,
    };
  }

  const totalSjOutput = (schedule?.sj_nos ?? []).reduce((s, sj) => s + sj.output_qty, 0);
  const title = schedule
    ? schedule.style_code || schedule.style_name || `#${schedule.pk}`
    : `#${schedulePk}`;

  return (
    <>
      <Helmet>
        <title>{`${title} — VL Factory Live`}</title>
      </Helmet>

      <Box bg={bgPage} minH="100vh" pb={10}>
        {/* 헤더 */}
        <Box bg={headerBg} borderBottom="1px solid" borderColor={headerBorder} px={4} py={2.5}>
          <Flex align="center" justify="space-between" gap={4} flexWrap="wrap">
            <HStack gap={2} minW={0}>
              {isPopup ? (
                <Tooltip label={t("vlFactoryLive.detail.closeWindow")}>
                  <IconButton
                    aria-label={t("vlFactoryLive.detail.closeWindow")}
                    icon={<FiX />}
                    size="sm"
                    variant="ghost"
                    onClick={() => window.close()}
                  />
                </Tooltip>
              ) : (
                <IconButton
                  as={RouterLink}
                  to="/vl-factory-live"
                  aria-label={t("vlFactoryLive.detail.back")}
                  icon={<FiArrowLeft />}
                  size="sm"
                  variant="ghost"
                />
              )}
              {isActiveToday && <LiveDot />}
              <Text fontWeight="bold" fontSize="lg" letterSpacing="tight" noOfLines={1}>
                {title}
              </Text>
              {lineName && (
                <Badge colorScheme="blue" fontSize="10px" borderRadius="full" px={2} flexShrink={0}>
                  {lineName}
                </Badge>
              )}
              {schedule && (
                <Badge
                  colorScheme={statusColorScheme(schedule.status)}
                  fontSize="10px"
                  borderRadius="full"
                  px={2}
                  flexShrink={0}
                >
                  {t(statusKey(schedule.status))}
                </Badge>
              )}
            </HStack>

            <HStack gap={2} flexShrink={0}>
              <LocalizedDateInput value={date} onChange={setDate} size="sm" />
              {lastRefreshed && (
                <Text fontSize="xs" color={mutedText} whiteSpace="nowrap" sx={{ fontVariantNumeric: "tabular-nums" }}>
                  {lastRefreshed.toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  })}
                </Text>
              )}
              <Tooltip label={t("vlFactoryLive.refresh")}>
                <IconButton
                  aria-label={t("vlFactoryLive.refresh")}
                  icon={<FiRefreshCw />}
                  size="sm"
                  variant="ghost"
                  onClick={() => refetch()}
                  isLoading={isFetching}
                />
              </Tooltip>
            </HStack>
          </Flex>
        </Box>

        {/* 컨텐츠 */}
        <Flex direction="column" px={4} py={3} gap={3} maxW="1100px" mx="auto">
          {isLoading ? (
            <Center py={20}>
              <Spinner size="xl" color="blue.400" thickness="3px" />
            </Center>
          ) : isError ? (
            <Center py={20}>
              <Text color="red.400">{t("vlFactoryLive.errorLoading")}</Text>
            </Center>
          ) : !schedule ? (
            <Center py={20}>
              <VStack gap={2}>
                <Box color={mutedText}>
                  <FiBox size={28} />
                </Box>
                <Text color={mutedText} fontSize="sm">
                  {t("vlFactoryLive.detail.notFound", { date, pk: schedulePk })}
                </Text>
                <Link as={RouterLink} to="/vl-factory-live" fontSize="sm" color="blue.400">
                  {t("vlFactoryLive.detail.backToLive")}
                </Link>
              </VStack>
            </Center>
          ) : (
            <>
              {/* ── 기본 정보 ── */}
              <Box bg={cardBg} border="1px solid" borderColor={headerBorder} borderRadius="xl" overflow="hidden">
                <Box h="4px" bg={headerBorder}>
                  <Box h="100%" w={`${Math.min(pct, 100)}%`} bg={`${color}.400`} transition="width 0.4s" />
                </Box>
                <Flex px={4} py={3.5} gap={4} align="flex-start" flexWrap="wrap">
                  {/* 썸네일 */}
                  <Center
                    w="96px"
                    h="96px"
                    borderRadius="lg"
                    overflow="hidden"
                    flexShrink={0}
                    bg={thumbBg}
                    border="1px solid"
                    borderColor={headerBorder}
                    cursor={schedule.thumbnail ? "zoom-in" : "default"}
                    onClick={schedule.thumbnail ? onThumbOpen : undefined}
                  >
                    {schedule.thumbnail ? (
                      <Image
                        src={schedule.thumbnail}
                        alt={schedule.style_name}
                        w="100%"
                        h="100%"
                        objectFit="cover"
                      />
                    ) : (
                      <Box color={mutedText}>
                        <FiBox size={28} />
                      </Box>
                    )}
                  </Center>
                  {schedule.thumbnail && (
                    <Modal isOpen={isThumbOpen} onClose={onThumbClose} isCentered size="xl">
                      <ModalOverlay backdropFilter="blur(4px)" />
                      <ModalContent bg="transparent" boxShadow="none" onClick={onThumbClose} cursor="zoom-out">
                        <Image
                          src={schedule.thumbnail}
                          alt={schedule.style_name}
                          borderRadius="xl"
                          objectFit="contain"
                          maxH="80vh"
                          w="100%"
                        />
                      </ModalContent>
                    </Modal>
                  )}

                  {/* 정보 그리드 */}
                  <Flex flex={1} minW="240px" gap={6} flexWrap="wrap">
                    <VStack align="flex-start" spacing={0.5}>
                      <Text fontSize="10px" color={mutedText} fontWeight="semibold" textTransform="uppercase" letterSpacing="wider">
                        {t("vlFactoryLive.detail.style")}
                      </Text>
                      <Text fontSize="sm" fontWeight="bold">
                        {schedule.style_code || "-"}
                      </Text>
                      {schedule.style_name && (
                        <Text fontSize="xs" color={mutedText}>{schedule.style_name}</Text>
                      )}
                    </VStack>

                    <VStack align="flex-start" spacing={0.5}>
                      <Text fontSize="10px" color={mutedText} fontWeight="semibold" textTransform="uppercase" letterSpacing="wider">
                        PO No
                      </Text>
                      <Text fontSize="sm" fontWeight="medium">{schedule.po_no || "-"}</Text>
                    </VStack>

                    <VStack align="flex-start" spacing={0.5}>
                      <Text fontSize="10px" color={mutedText} fontWeight="semibold" textTransform="uppercase" letterSpacing="wider">
                        Ex-Factory
                      </Text>
                      <HStack spacing={1.5}>
                        <Text fontSize="sm" fontWeight="medium">{schedule.ex_factory_date || "-"}</Text>
                        {efInfo && (
                          <Text fontSize="xs" fontWeight="bold" color={efInfo.diffColor}>
                            {efInfo.diffLabel}
                          </Text>
                        )}
                      </HStack>
                      {efInfo && (
                        <Text fontSize="xs" color={mutedText}>
                          {t("vlFactoryLive.detail.remainingBalance", { balance: efInfo.balance.toLocaleString() })}
                          {efInfo.dailyRequired !== null && (
                            <Text as="span" color={efInfo.diffColor} fontWeight="medium">
                              {" "}{t("vlFactoryLive.detail.dailyRequiredSuffix", { n: efInfo.dailyRequired })}
                            </Text>
                          )}
                        </Text>
                      )}
                    </VStack>

                    <VStack align="flex-start" spacing={0.5}>
                      <Text fontSize="10px" color={mutedText} fontWeight="semibold" textTransform="uppercase" letterSpacing="wider">
                        {t("vlFactoryLive.detail.assemblyPeriod")}
                      </Text>
                      <Text fontSize="sm" fontWeight="medium">
                        {schedule.assembly_start || "-"} ~ {schedule.assembly_end || "-"}
                      </Text>
                    </VStack>

                    <VStack align="flex-start" spacing={0.5}>
                      <Text fontSize="10px" color={mutedText} fontWeight="semibold" textTransform="uppercase" letterSpacing="wider">
                        {t("vlFactoryLive.detail.schedule")}
                      </Text>
                      <Text fontSize="sm" fontWeight="medium">#{schedule.pk}</Text>
                    </VStack>
                  </Flex>

                  {/* 진행률 */}
                  <VStack align="flex-end" spacing={0} flexShrink={0} ml="auto">
                    <Text fontSize="3xl" fontWeight="bold" lineHeight={1} color={`${color}.500`}>
                      {pct.toFixed(0)}
                      <Text as="span" fontSize="md" fontWeight="semibold">%</Text>
                    </Text>
                    <Text fontSize="10px" color={mutedText}>{t("vlFactoryLive.detail.totalAchievement")}</Text>
                  </VStack>
                </Flex>
              </Box>

              {/* ── 일정 캘린더 히트맵 (접기/펼치기) ── */}
              <Box bg={cardBg} border="1px solid" borderColor={headerBorder} borderRadius="xl" overflow="hidden">
                <Flex
                  as="button"
                  w="100%"
                  px={4}
                  py={2.5}
                  align="center"
                  justify="space-between"
                  onClick={() => setCalOpen((v) => !v)}
                  cursor="pointer"
                  _hover={{ bg: headerBorder }}
                  transition="background 0.15s"
                >
                  <Text fontSize="10px" color={mutedText} fontWeight="semibold" textTransform="uppercase" letterSpacing="wider">
                    {t("vlFactoryLive.detail.scheduleOverview.title")}
                  </Text>
                  <Box color={mutedText}>{calOpen ? <FiChevronUp size={13} /> : <FiChevronDown size={13} />}</Box>
                </Flex>
                <Collapse in={calOpen} animateOpacity>
                  <Box px={4} pb={4}>
                    <ScheduleCalendarHeatmap
                      assemblyStart={schedule.assembly_start}
                      assemblyEnd={schedule.assembly_end}
                      exFactoryDate={schedule.ex_factory_date}
                      holidaySet={holidaySet}
                      holidayNameMap={holidayNameMap}
                      dailyOutputMap={dailyOutputMap}
                      dailyTargetQty={dailyTargetQty}
                    />
                  </Box>
                </Collapse>
              </Box>

              {/* ── KPI ── */}
              <Flex gap={2.5} flexWrap="wrap">
                <KpiCard
                  label={t("vlFactoryLive.detail.cumulativeOutput")}
                  value={schedule.assembly_output_qty.toLocaleString()}
                  sub={
                    effectiveTotal > 0
                      ? t("vlFactoryLive.detail.orderQty", { qty: effectiveTotal.toLocaleString() })
                      : undefined
                  }
                  colorScheme={color}
                  pct={pct}
                />
                <KpiCard
                  label={t("vlFactoryLive.detail.todayOutput")}
                  value={stats.total.toLocaleString()}
                  sub={t("vlFactoryLive.kpi.activeSlotsSub", { count: stats.slots })}
                />
                <KpiCard
                  label={t("vlFactoryLive.detail.avgPerHour")}
                  value={stats.slots > 0 ? Math.round(stats.avg).toLocaleString() : "-"}
                  suffix={stats.slots > 0 ? "/h" : undefined}
                  sub={
                    schedule.assembly_target_qty_per_hour != null
                      ? t("vlFactoryLive.detail.targetPerHour", { target: schedule.assembly_target_qty_per_hour })
                      : t("vlFactoryLive.detail.noTarget")
                  }
                />
                <KpiCard
                  label={t("vlFactoryLive.detail.avgAchievePct")}
                  value={stats.ratePct != null ? String(Math.round(stats.ratePct)) : "-"}
                  suffix={stats.ratePct != null ? "%" : undefined}
                  colorScheme={stats.ratePct != null ? pctColor(stats.ratePct) : undefined}
                  pct={stats.ratePct ?? undefined}
                />
                {efInfo && (
                  <KpiCard
                    label={t("vlFactoryLive.detail.remaining")}
                    value={efInfo.balance.toLocaleString()}
                    sub={
                      efInfo.dailyRequired !== null
                        ? t("vlFactoryLive.detail.dailyNeeded", { n: efInfo.dailyRequired.toLocaleString() })
                        : undefined
                    }
                  />
                )}
              </Flex>

              {/* ── Assembly 시간대별 실적 ── */}
              <SectionCard
                title={t("vlFactoryLive.detail.assemblyHourlySection")}
                right={
                  <HStack gap={2}>
                    {schedule.assembly_target_qty_per_hour != null && (
                      <Badge colorScheme="purple" fontSize="10px" variant="subtle" borderRadius="full" px={2}>
                        {t("vlFactoryLive.detail.targetPerHour", { target: schedule.assembly_target_qty_per_hour })}
                      </Badge>
                    )}
                    <AvgRateBadge hourly={schedule.hourly} target={schedule.assembly_target_qty_per_hour} />
                    <Link
                      as={RouterLink}
                      to={`/vl-factory-live/schedules/${pk}/assembly?date=${date}`}
                      target="_blank"
                      fontSize="10px"
                      color="blue.400"
                      display="inline-flex"
                      alignItems="center"
                      gap="3px"
                      _hover={{ color: "blue.600" }}
                    >
                      {t("vlFactoryLive.detail.monitorView")} <FiExternalLink size={10} />
                    </Link>
                  </HStack>
                }
              >
                <VlHourlyBarChart
                  hourly={schedule.hourly}
                  target={schedule.assembly_target_qty_per_hour}
                />
              </SectionCard>

              {/* ── SJ Nos ── */}
              {schedule.sj_nos.length > 0 && (
                <SectionCard
                  title="SJ Nos"
                  right={
                    <Text fontSize="xs" color={mutedText} sx={{ fontVariantNumeric: "tabular-nums" }}>
                      {t("vlFactoryLive.detail.total")} <Text as="span" fontWeight="bold">{totalSjOutput.toLocaleString()}</Text>
                    </Text>
                  }
                >
                  <TableContainer>
                    <Table size="sm" variant="simple">
                      <Thead>
                        <Tr>
                          <Th fontSize="10px">SJ No</Th>
                          <Th fontSize="10px" isNumeric>{t("vlFactoryLive.detail.colOutput")}</Th>
                          <Th fontSize="10px" isNumeric>{t("vlFactoryLive.detail.colOrderQty")}</Th>
                          <Th fontSize="10px" isNumeric>{t("vlFactoryLive.detail.colHourlyTarget")}</Th>
                          <Th fontSize="10px" isNumeric>{t("vlFactoryLive.detail.colAchievement")}</Th>
                        </Tr>
                      </Thead>
                      <Tbody>
                        {schedule.sj_nos.map((sj) => {
                          const sjEffective = sj.vl_qty ?? sj.total_qty;
                          const sjPct =
                            sjEffective != null && sjEffective > 0
                              ? Math.min((sj.output_qty / sjEffective) * 100, 100)
                              : null;
                          return (
                            <Tr key={sj.pk}>
                              <Td fontSize="xs" fontWeight="bold" color="purple.500">
                                <Text as="span">{sj.sj_no}</Text>
                              </Td>
                              <Td fontSize="xs" isNumeric fontWeight="semibold" sx={{ fontVariantNumeric: "tabular-nums" }}>
                                {sj.output_qty.toLocaleString()}
                              </Td>
                              <Td fontSize="xs" isNumeric sx={{ fontVariantNumeric: "tabular-nums" }}>
                                <Box textAlign="right">
                                  <Text color={mutedText}>{sjEffective != null ? sjEffective.toLocaleString() : "-"}</Text>
                                  {sj.vl_qty != null && sj.total_qty != null && sj.vl_qty !== sj.total_qty && (
                                    <Text fontSize="2xs" color="gray.400" lineHeight={1}>Total: {sj.total_qty.toLocaleString()}</Text>
                                  )}
                                  {sj.outsource_factory && (
                                    <Badge colorScheme="orange" fontSize="2xs" mt="1px" display="block" textAlign="right">
                                      {sj.outsource_qty != null ? `${sj.outsource_qty.toLocaleString()} → ` : ""}{sj.outsource_factory}
                                    </Badge>
                                  )}
                                </Box>
                              </Td>
                              <Td fontSize="xs" isNumeric sx={{ fontVariantNumeric: "tabular-nums" }}>
                                {sj.target_qty_per_hour != null ? `${sj.target_qty_per_hour}/h` : "-"}
                              </Td>
                              <Td isNumeric>
                                {sjPct != null ? (
                                  <Flex align="center" justify="flex-end" gap={2}>
                                    <Progress
                                      value={sjPct}
                                      colorScheme={pctColor(sjPct)}
                                      size="xs"
                                      borderRadius="full"
                                      w="56px"
                                      flexShrink={0}
                                    />
                                    <Text fontSize="xs" fontWeight="bold" color={pctTextColor(sjPct)} w="42px" textAlign="right">
                                      {sjPct.toFixed(1)}%
                                    </Text>
                                  </Flex>
                                ) : (
                                  <Text fontSize="xs" color={mutedText}>-</Text>
                                )}
                              </Td>
                            </Tr>
                          );
                        })}
                      </Tbody>
                    </Table>
                  </TableContainer>
                </SectionCard>
              )}

              {/* ── Modules ── */}
              {schedule.modules_by_code.length > 0 && (
                <>
                  <Text
                    fontSize="10px"
                    color={mutedText}
                    fontWeight="bold"
                    textTransform="uppercase"
                    letterSpacing="wider"
                    mt={1}
                  >
                    Modules ({schedule.modules_by_code.length})
                  </Text>
                  {schedule.modules_by_code.map((mod) => (
                    <Box key={mod.code}>
                      <Flex justify="flex-end" mb={1}>
                        <Link
                          as={RouterLink}
                          to={`/vl-factory-live/schedules/${pk}/modules/${mod.code}?date=${date}`}
                          target="_blank"
                          fontSize="10px"
                          color="blue.400"
                          display="inline-flex"
                          alignItems="center"
                          gap="3px"
                          _hover={{ color: "blue.600" }}
                        >
                          {t("vlFactoryLive.detail.moduleMonitorView", { code: mod.code })} <FiExternalLink size={10} />
                        </Link>
                      </Flex>
                      <ModuleDetailCard
                        mod={mod}
                        assemblyStart={schedule.assembly_start}
                        assemblyEnd={schedule.assembly_end}
                        holidaySet={holidaySet}
                        dailyOutputMap={moduleOutputsByCode.get(mod.code)}
                      />
                    </Box>
                  ))}
                </>
              )}
            </>
          )}
        </Flex>
      </Box>
    </>
  );
}
