import {
  Badge,
  Box,
  Button,
  Center,
  Collapse,
  Drawer,
  DrawerBody,
  DrawerCloseButton,
  DrawerContent,
  DrawerHeader,
  DrawerOverlay,
  Flex,
  HStack,
  IconButton,
  Image,
  Input,
  InputGroup,
  InputLeftElement,
  InputRightElement,
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
  Tfoot,
  Th,
  Thead,
  Tooltip,
  Tr,
  VStack,
  keyframes,
  useColorModeValue,
  useDisclosure,
} from "@chakra-ui/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Helmet } from "react-helmet";
import {
  FiBox,
  FiChevronDown,
  FiChevronUp,
  FiCpu,
  FiRefreshCw,
  FiSearch,
  FiTrendingDown,
  FiTrendingUp,
  FiX,
} from "react-icons/fi";
import {
  getVlFactoryLiveSchedules,
  getVlFactoryLiveScheduleDetail,
  getVlAssemblyScheduleProductionDailyOutputs,
  getVlAssemblyModuleProductionDailyOutputs,
  getVlFactoryLiveAIAnalysis,
  type VlLiveHourly,
  type VlLiveLine,
  type VlLiveModule,
  type VlLiveSchedule,
  type VlLiveSjNo,
} from "../api";
import LocalizedDateInput from "../components/LocalizedDateInput";
import { useTranslation } from "react-i18next";

// ── 색상 헬퍼 ────────────────────────────────────────────────────────────────
export function pctColor(pct: number) {
  if (pct >= 100) return "green";
  if (pct >= 80) return "blue";
  if (pct >= 50) return "yellow";
  return "red";
}
export function pctTextColor(pct: number) {
  if (pct >= 100) return "green.500";
  if (pct >= 80) return "blue.500";
  if (pct >= 50) return "orange.500";
  return "red.500";
}

export function statusKey(status: string) {
  return `vlFactoryLive.status.${status}`;
}

// ── LIVE 펄스 애니메이션 ─────────────────────────────────────────────────────
const pulse = keyframes`
  0% { box-shadow: 0 0 0 0 rgba(229, 62, 62, 0.5); }
  70% { box-shadow: 0 0 0 6px rgba(229, 62, 62, 0); }
  100% { box-shadow: 0 0 0 0 rgba(229, 62, 62, 0); }
`;

// ── 검색 하이라이트 애니메이션 ───────────────────────────────────────────────
const highlightPulse = keyframes`
  0% { box-shadow: 0 0 0 0 rgba(237, 137, 54, 0.8); }
  50% { box-shadow: 0 0 0 8px rgba(237, 137, 54, 0.3); }
  100% { box-shadow: 0 0 0 4px rgba(237, 137, 54, 0.5); }
`;

// ── 금일 생산중 (isActiveToday) 애니메이션 ──────────────────────────────────
const productionPulse = keyframes`
  0%   { box-shadow: 0 0 0 0   rgba(66, 153, 225, 0.7), 0 0 8px 2px rgba(66, 153, 225, 0.15); }
  50%  { box-shadow: 0 0 0 5px rgba(66, 153, 225, 0.2), 0 0 16px 4px rgba(66, 153, 225, 0.25); }
  100% { box-shadow: 0 0 0 0   rgba(66, 153, 225, 0.0), 0 0 8px 2px rgba(66, 153, 225, 0.15); }
`;

export function LiveDot() {
  return (
    <Box
      w="8px"
      h="8px"
      borderRadius="full"
      bg="red.500"
      animation={`${pulse} 2s infinite`}
      flexShrink={0}
    />
  );
}

// ── SJ No 배지 ───────────────────────────────────────────────────────────────
function SjNoBadge({ sjNo }: { sjNo: VlLiveSjNo }) {
  return (
    <Flex
      align="center"
      gap={1.5}
      bg="purple.50"
      border="1px solid"
      borderColor="purple.100"
      borderRadius="md"
      px={2.5}
      py={1}
      w="100%"
      _dark={{ bg: "purple.900", borderColor: "purple.700" }}
      cursor="default"
    >
      <Text fontSize="10px" fontWeight="bold" color="purple.500" flex={1} _dark={{ color: "purple.300" }}>
        {sjNo.sj_no}
      </Text>
      <Box textAlign="right">
        <Text fontSize="11px" fontWeight="semibold" sx={{ fontVariantNumeric: "tabular-nums" }}>
          {sjNo.output_qty.toLocaleString()}
          {(sjNo.vl_qty ?? sjNo.total_qty) != null && (
            <Text as="span" fontSize="10px" fontWeight="normal" color="gray.500"> / {(sjNo.vl_qty ?? sjNo.total_qty)!.toLocaleString()}</Text>
          )}
        </Text>
        {sjNo.vl_qty != null && sjNo.total_qty != null && sjNo.vl_qty !== sjNo.total_qty && (
          <Text fontSize="2xs" color="gray.400" lineHeight={1}>Total: {sjNo.total_qty.toLocaleString()}</Text>
        )}
      </Box>
    </Flex>
  );
}

// ── ERP 시간대 슬롯 정의 (D1~D8, OT1~OT5) ──────────────────────────────────
export const DAY_SLOTS = [
  { label: "D1", h: 7 },
  { label: "D2", h: 8 },
  { label: "D3", h: 9 },
  { label: "D4", h: 10 },
  { label: "D5", h: 11 },
  { label: "D6", h: 13 },
  { label: "D7", h: 14 },
  { label: "D8", h: 15 },
] as const;

export const OT_SLOTS = [
  { label: "OT1", h: 16 },
  { label: "OT2", h: 17 },
  { label: "OT3", h: 18 },
  { label: "OT4", h: 19 },
  { label: "OT5", h: 20 },
] as const;

export const ALL_SLOTS = [...DAY_SLOTS, ...OT_SLOTS];

// ── 시간당 통계 헬퍼 ─────────────────────────────────────────────────────────
export function hourlyStats(hourly: VlLiveHourly[] | undefined, target: number | null) {
  let total = 0;
  let slots = 0;
  for (const e of hourly ?? []) {
    if (e.qty > 0) {
      total += e.qty;
      slots += 1;
    }
  }
  const avg = slots > 0 ? total / slots : 0;
  const hasTarget = target != null && target > 0;
  const ratePct = hasTarget && slots > 0 ? (avg / target!) * 100 : null;
  return { total, slots, avg, ratePct, meets: ratePct != null ? ratePct >= 100 : null };
}

// ── 시간당 평균 달성 배지 ────────────────────────────────────────────────────
export function AvgRateBadge({
  hourly,
  target,
}: {
  hourly: VlLiveHourly[] | undefined;
  target: number | null;
}) {
  const { t } = useTranslation();
  const { avg, ratePct, meets } = hourlyStats(hourly, target);
  if (ratePct == null) return null;

  return (
    <Tooltip
      label={t("vlFactoryLive.avgRateTooltip", { avg: avg.toFixed(1), target, pct: ratePct.toFixed(0) })}
      hasArrow
      placement="top"
    >
      <Badge
        colorScheme={meets ? "green" : "red"}
        variant={meets ? "subtle" : "solid"}
        fontSize="9px"
        borderRadius="full"
        px={1.5}
        cursor="default"
        display="inline-flex"
        alignItems="center"
        gap="3px"
      >
        {meets ? <FiTrendingUp size={9} /> : <FiTrendingDown size={9} />}
        {Math.round(avg)}/h
      </Badge>
    </Tooltip>
  );
}

// ── 시간대 뱃지 ──────────────────────────────────────────────────────────────
function HourlyBadge({
  label,
  qty,
  target,
}: {
  label: string;
  qty: number;
  target: number | null;
}) {
  const { t } = useTranslation();
  const zeroBg = useColorModeValue("blackAlpha.50", "whiteAlpha.100");
  const mutedColor = useColorModeValue("gray.400", "gray.500");
  const hasTarget = target !== null && target > 0;
  const meetsTarget = hasTarget && qty >= target!;
  const bg = qty === 0 ? zeroBg : meetsTarget ? "green.400" : "orange.400";
  const labelColor = qty === 0 ? mutedColor : "whiteAlpha.800";
  const qtyColor = qty === 0 ? mutedColor : "white";
  const pct = hasTarget ? Math.min((qty / target!) * 100, 100) : 0;

  const tooltipLabel = hasTarget
    ? t("vlFactoryLive.slotTooltipWithTarget", { label, time: label, qty, target, pct: pct.toFixed(0) })
    : t("vlFactoryLive.slotTooltip", { label, time: label, qty });

  return (
    <Tooltip label={tooltipLabel} hasArrow placement="top">
      <Flex
        direction="column"
        align="center"
        justify="center"
        flexShrink={0}
        w="22px"
        h={hasTarget ? "44px" : "34px"}
        bg={bg}
        borderRadius="4px"
        cursor="default"
        gap={0}
        position="relative"
        overflow="hidden"
        transition="background 0.2s"
      >
        <Text fontSize="6px" color={labelColor} lineHeight={1} letterSpacing="tighter">
          {label}
        </Text>
        <Text fontSize="9px" color={qtyColor} fontWeight="bold" lineHeight={1.3}>
          {qty > 0 ? qty : "·"}
        </Text>
        {hasTarget && (
          <Text fontSize="6px" color={qty > 0 ? "whiteAlpha.900" : mutedColor} lineHeight={1.2} letterSpacing="tighter">
            {qty > 0 ? `${pct.toFixed(0)}%` : "0%"}
          </Text>
        )}

        {/* 타겟 대비 달성률 바 (하단 3px) */}
        {hasTarget && qty > 0 && (
          <Box position="absolute" bottom={0} left={0} right={0} h="3px" bg="blackAlpha.200">
            <Box h="3px" w={`${pct}%`} bg="whiteAlpha.900" transition="width 0.3s" />
          </Box>
        )}
      </Flex>
    </Tooltip>
  );
}

// ── 시간대 히트맵 (D 슬롯 + OT 슬롯 분리) ───────────────────────────────────
function HourlyHeatmap({
  hourly,
  target,
}: {
  hourly: { h: number; qty: number }[] | undefined;
  target: number | null;
}) {
  const otDividerColor = useColorModeValue("gray.300", "gray.500");
  const hourMap: Record<number, number> = {};
  for (const e of hourly ?? []) hourMap[e.h] = e.qty;

  return (
    <Box overflowX="auto">
      <Flex gap="3px" align="stretch" width="max-content">
        {DAY_SLOTS.map((slot) => (
          <HourlyBadge key={slot.label} label={slot.label} qty={hourMap[slot.h] ?? 0} target={target} />
        ))}
        <Box w="1px" bg={otDividerColor} borderRadius="full" my="4px" flexShrink={0} />
        {OT_SLOTS.map((slot) => (
          <HourlyBadge key={slot.label} label={slot.label} qty={hourMap[slot.h] ?? 0} target={target} />
        ))}
      </Flex>
    </Box>
  );
}

// ── 모듈 행 ──────────────────────────────────────────────────────────────────
function ModuleRow({ mod }: { mod: VlLiveModule }) {
  const { t } = useTranslation();
  const labelColor = useColorModeValue("gray.500", "gray.400");
  const missBg = useColorModeValue("red.50", "rgba(229, 62, 62, 0.14)");
  const missBorder = useColorModeValue("red.200", "red.700");
  const pct = mod.total_qty > 0 ? Math.min((mod.output_qty / mod.total_qty) * 100, 100) : 0;
  const color = pctColor(pct);

  // 시간당 목표 미달 여부 (목표가 있고 오늘 실적이 있을 때만 판단)
  const isMissingTarget = hourlyStats(mod.hourly, mod.target_qty_per_hour).meets === false;

  return (
    <Box
      borderRadius="md"
      px={1.5}
      py={1}
      mx={-1.5}
      bg={isMissingTarget ? missBg : "transparent"}
      border="1px solid"
      borderColor={isMissingTarget ? missBorder : "transparent"}
      transition="background 0.2s"
    >
      <Flex justify="space-between" align="center" mb={1}>
        <HStack gap={1.5} minW={0}>
          <Center
            w={5}
            h={5}
            bg="gray.400"
            color="white"
            borderRadius="md"
            fontSize="9px"
            fontWeight="bold"
            flexShrink={0}
          >
            {mod.code}
          </Center>
          <Text fontSize="xs" fontWeight="medium" noOfLines={1}>
            {mod.name || mod.code}
          </Text>
        </HStack>
        <HStack gap={1.5} flexShrink={0}>
          {mod.target_qty_per_hour != null && (
            <Tooltip label={t("vlFactoryLive.hourlyTargetQty")} hasArrow placement="top">
              <Badge colorScheme="purple" fontSize="9px" variant="subtle" cursor="default" borderRadius="full" px={1.5}>
                {mod.target_qty_per_hour}/h
              </Badge>
            </Tooltip>
          )}
          <AvgRateBadge hourly={mod.hourly} target={mod.target_qty_per_hour} />
          <Text fontSize="10px" color={labelColor} sx={{ fontVariantNumeric: "tabular-nums" }}>
            <Text as="span" fontWeight="bold" color="inherit">
              {mod.output_qty.toLocaleString()}
            </Text>
            {mod.total_qty > 0 && <> / {mod.total_qty.toLocaleString()}</>}
          </Text>
        </HStack>
      </Flex>
      <Progress value={pct} colorScheme={color} size="xs" borderRadius="full" mb={1.5} />
      <HourlyHeatmap hourly={mod.hourly} target={mod.target_qty_per_hour} />
      {mod.total_qty > 0 && (
        <Flex justify="flex-end" mt={1}>
          <Text fontSize="9px" color={labelColor}>
            {t("vlFactoryLive.achievementRate")}{" "}
            <Text as="span" fontWeight="bold" color={pctTextColor(pct)}>
              {pct.toFixed(1)}%
            </Text>
          </Text>
        </Flex>
      )}
    </Box>
  );
}

// ── 스케줄 카드 ──────────────────────────────────────────────────────────────
function ScheduleCard({
  schedule,
  date,
  highlighted,
  isFirstMatch,
}: {
  schedule: VlLiveSchedule;
  date: string;
  highlighted?: boolean;
  isFirstMatch?: boolean;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const prefetchedRef = useRef(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (highlighted && isFirstMatch && cardRef.current) {
      cardRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [highlighted, isFirstMatch]);

  function handleMouseEnter() {
    if (prefetchedRef.current) return;
    prefetchedRef.current = true;
    const pk = schedule.pk;
    queryClient.prefetchQuery({
      queryKey: ["vl-factory-live-schedule-detail", pk, date],
      queryFn: () => getVlFactoryLiveScheduleDetail(pk, date),
      staleTime: 60_000,
    });
    queryClient.prefetchQuery({
      queryKey: ["vlScheduleDailyOutputs", pk],
      queryFn: () => getVlAssemblyScheduleProductionDailyOutputs({ schedule: pk, page_size: 500 }),
      staleTime: 60_000,
    });
    queryClient.prefetchQuery({
      queryKey: ["vlModuleDailyOutputs", pk],
      queryFn: () => getVlAssemblyModuleProductionDailyOutputs({ schedule: pk, page_size: 500 }),
      staleTime: 60_000,
    });
  }
  const { t } = useTranslation();
  const cardBg = useColorModeValue("white", "gray.700");
  const borderColor = useColorModeValue("gray.200", "gray.600");
  const labelColor = useColorModeValue("gray.500", "gray.400");
  const { isOpen: isImgOpen, onOpen: onImgOpen, onClose: onImgClose } = useDisclosure();
  const sectionBg = useColorModeValue("gray.50", "whiteAlpha.50");
  const thumbBg = useColorModeValue("gray.100", "gray.600");
  const stripBg = useColorModeValue("gray.100", "gray.600");

  const effectiveTotal = schedule.vl_effective_qty || schedule.total_order_qty;
  const effectivePct = effectiveTotal > 0
    ? parseFloat((schedule.assembly_output_qty / effectiveTotal * 100).toFixed(1))
    : schedule.progress_pct;
  const pct = effectivePct;
  const color = pctColor(pct);
  const totalSjOutput = schedule.sj_nos.reduce((s, sj) => s + sj.output_qty, 0);
  const hasSjNos = schedule.sj_nos.length > 0;
  const hasModules = schedule.modules_by_code.length > 0;
  const outsourceByFactory: Record<string, number> = {};
  for (const sj of schedule.sj_nos) {
    if (sj.outsource_factory) {
      outsourceByFactory[sj.outsource_factory] = (outsourceByFactory[sj.outsource_factory] ?? 0) + (sj.outsource_qty ?? 0);
    }
  }
  const outsourceEntries = Object.entries(outsourceByFactory);

  // 오늘 실적이 1건이라도 있으면 진행중으로 판단
  const isActiveToday = (schedule.hourly ?? []).some((e) => e.qty > 0);

  // assembly_output_qty 기반 실제 상태 (rollup 버그 영향 없음)
  const assemblyOut = schedule.assembly_output_qty ?? 0;
  const effectiveStatus =
    schedule.status === "outsourced" || schedule.status === "not_ready"
      ? schedule.status
      : assemblyOut > 0 && effectiveTotal > 0 && assemblyOut >= effectiveTotal
        ? "completed"
        : assemblyOut > 0
          ? "in_progress"
          : "not_started";

  const statusBorderColor =
    effectiveStatus === "completed" ? "green.400"
    : effectiveStatus === "in_progress" ? "blue.400"
    : effectiveStatus === "outsourced" ? "purple.300"
    : borderColor;

  const statusOpacity =
    effectiveStatus === "completed" || effectiveStatus === "in_progress" ? 1 : 0.65;

  const statusBadgeScheme =
    effectiveStatus === "completed" ? "green"
    : effectiveStatus === "in_progress" ? "blue"
    : effectiveStatus === "outsourced" ? "purple"
    : "gray";

  return (
    <Box
      ref={cardRef}
      bg={cardBg}
      borderWidth={highlighted || isActiveToday ? "2px" : "1px"}
      borderColor={highlighted ? "orange.400" : isActiveToday ? "blue.400" : statusBorderColor}
      borderRadius="xl"
      overflow="hidden"
      shadow={highlighted ? "lg" : isActiveToday || effectiveStatus !== "not_started" ? "md" : "xs"}
      opacity={highlighted ? 1 : statusOpacity}
      w="100%"
      flexShrink={0}
      transition="border-color 0.2s, opacity 0.2s"
      _hover={{ opacity: 1, shadow: "md" }}
      position="relative"
      cursor="pointer"
      role="link"
      onMouseEnter={handleMouseEnter}
      animation={
        highlighted
          ? `${highlightPulse} 1.5s ease-in-out infinite`
          : isActiveToday
            ? `${productionPulse} 2s ease-in-out infinite`
            : undefined
      }
      onClick={() =>
        window.open(
          `/vl-factory-live/schedules/${schedule.pk}?date=${date}&popup=1`,
          `vl-live-schedule-${schedule.pk}`,
          "width=1280,height=920",
        )
      }
    >
      {/* 상단 진행률 스트립 */}
      <Box h="4px" bg={stripBg}>
        <Box h="100%" w={`${Math.min(pct, 100)}%`} bg={`${color}.400`} transition="width 0.4s" />
      </Box>

      {/* ── 헤더 ── */}
      <Box px={3} pt={2.5} pb={2.5}>
        <Flex align="center" gap={2.5} mb={2}>
          {/* 썸네일 */}
          <Center
            w="42px"
            h="42px"
            borderRadius="lg"
            overflow="hidden"
            flexShrink={0}
            bg={thumbBg}
            border="1px solid"
            borderColor={borderColor}
            cursor={schedule.thumbnail ? "zoom-in" : "default"}
            onClick={schedule.thumbnail ? (e) => { e.stopPropagation(); onImgOpen(); } : undefined}
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
              <Box color={labelColor}>
                <FiBox size={18} />
              </Box>
            )}
          </Center>

          {schedule.thumbnail && (
            <Modal isOpen={isImgOpen} onClose={onImgClose} isCentered size="xl">
              <ModalOverlay backdropFilter="blur(4px)" />
              <ModalContent bg="transparent" boxShadow="none" onClick={onImgClose} cursor="zoom-out">
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

          <Box flex={1} minW={0}>
            <HStack gap={1.5}>
              {isActiveToday && <LiveDot />}
              <Text fontWeight="bold" fontSize="sm" noOfLines={1}>
                {schedule.style_code || schedule.style_name || `#${schedule.pk}`}
              </Text>
            </HStack>
            {schedule.po_no && (
              <Text fontSize="10px" color={labelColor} noOfLines={1}>
                {schedule.po_no}
              </Text>
            )}
            {schedule.ex_factory_date && (() => {
              const today = new Date();
              today.setHours(0, 0, 0, 0);
              const ef = new Date(schedule.ex_factory_date);
              ef.setHours(0, 0, 0, 0);
              const diff = Math.round((ef.getTime() - today.getTime()) / 86400000);
              const diffLabel = diff === 0 ? "D-Day" : diff > 0 ? `D-${diff}` : `D+${Math.abs(diff)}`;
              const diffColor = diff < 0 ? "red.500" : diff <= 7 ? "orange.500" : "gray.500";
              const balance = (effectiveTotal ?? 0) - (schedule.assembly_output_qty ?? 0);
              const dailyRequired = diff > 0 && balance > 0 ? Math.ceil(balance / diff) : null;
              return (
                <VStack spacing={0} align="flex-start">
                  <HStack spacing={1.5}>
                    <Text fontSize="10px" color={labelColor} noOfLines={1}>
                      EF: {schedule.ex_factory_date}
                    </Text>
                    <Text fontSize="10px" fontWeight="bold" color={diffColor} flexShrink={0}>
                      {diffLabel}
                    </Text>
                  </HStack>
                  <HStack spacing={1.5}>
                    <Text fontSize="10px" color={labelColor}>
                      {t("vlFactoryLive.balanceText", { balance })}
                    </Text>
                    {dailyRequired !== null && (
                      <Text fontSize="10px" color={diffColor} fontWeight="medium" flexShrink={0}>
                        {t("vlFactoryLive.dailyRequired", { n: dailyRequired })}
                      </Text>
                    )}
                  </HStack>
                </VStack>
              );
            })()}
          </Box>

          {/* 진행률 + 스케줄 코드 */}
          <VStack align="flex-end" spacing={0.5} flexShrink={0}>
            <Text fontSize="9px" color={labelColor} fontWeight="medium" letterSpacing="wide">
              #{schedule.pk}
            </Text>
            <Badge
              colorScheme={statusBadgeScheme}
              fontSize="2xs"
              variant="solid"
              borderRadius="full"
              px={1.5}
              py={0.5}
            >
              {effectiveStatus === "completed"
                ? t("vlFactoryLive.statusCompleted", "완료")
                : effectiveStatus === "in_progress"
                  ? t("vlFactoryLive.statusInProgress", "진행중")
                  : effectiveStatus === "outsourced"
                    ? t("vlFactoryLive.statusOutsourced", "외주")
                    : t("vlFactoryLive.statusNotStarted", "미시작")}
            </Badge>
            <Text fontSize="lg" fontWeight="bold" lineHeight={1} color={`${color}.500`}>
              {pct.toFixed(0)}
              <Text as="span" fontSize="10px" fontWeight="semibold">
                %
              </Text>
            </Text>
            {outsourceEntries.length > 0 && (
              <HStack spacing={1} flexWrap="wrap" justify="flex-end">
                {outsourceEntries.map(([factory, qty]) => (
                  <Badge key={factory} colorScheme="orange" fontSize="2xs" variant="subtle">
                    {qty > 0 ? `${qty.toLocaleString()} → ` : ""}{factory}
                  </Badge>
                ))}
              </HStack>
            )}
          </VStack>
        </Flex>

        {/* 수량 요약 */}
        <Flex justify="space-between" align="center" mb={1.5}>
          <HStack gap={1.5}>
            <Center
              w={5}
              h={5}
              bg="gray.400"
              color="white"
              borderRadius="md"
              fontSize="9px"
              fontWeight="bold"
              flexShrink={0}
            >
              A
            </Center>
            <Text fontSize="10px" color={labelColor} fontWeight="medium">
              Assembly
            </Text>
            {schedule.assembly_target_qty_per_hour != null && (
              <Tooltip label={t("vlFactoryLive.hourlyTargetQtyAssembly")} hasArrow placement="top">
                <Badge colorScheme="purple" fontSize="9px" variant="subtle" cursor="default" borderRadius="full" px={1.5}>
                  {schedule.assembly_target_qty_per_hour}/h
                </Badge>
              </Tooltip>
            )}
            <AvgRateBadge hourly={schedule.hourly} target={schedule.assembly_target_qty_per_hour} />
          </HStack>
          <Box textAlign="right">
            <Text fontSize="11px" sx={{ fontVariantNumeric: "tabular-nums" }}>
              <Text as="span" fontWeight="bold">
                {schedule.assembly_output_qty.toLocaleString()}
              </Text>
              {effectiveTotal > 0 && (
                <Text as="span" color={labelColor}>
                  {" "}/ {effectiveTotal.toLocaleString()}
                </Text>
              )}
            </Text>
            {(() => {
              const rawTotal = schedule.sj_nos.reduce((s, sj) => s + (sj.total_qty ?? 0), 0);
              return rawTotal > effectiveTotal ? (
                <Text fontSize="2xs" color="gray.400" lineHeight={1}>Total: {rawTotal.toLocaleString()}</Text>
              ) : null;
            })()}
          </Box>
        </Flex>

        {/* Assembly 시간대별 히트맵 */}
        <HourlyHeatmap hourly={schedule.hourly} target={schedule.assembly_target_qty_per_hour} />
        {effectiveTotal > 0 && (
          <Flex justify="flex-end" mt={1}>
            <Text fontSize="9px" color={labelColor}>
              {t("vlFactoryLive.achievementRate")}{" "}
              <Text as="span" fontWeight="bold" color={pctTextColor(effectivePct)}>
                {effectivePct.toFixed(1)}%
              </Text>
            </Text>
          </Flex>
        )}
      </Box>

      {/* ── SJ No 섹션 ── */}
      {hasSjNos && (
        <Box px={3} py={2} bg={sectionBg} borderTop="1px solid" borderColor={borderColor}>
          <Flex justify="space-between" align="center" mb={1.5}>
            <Text fontSize="9px" color={labelColor} fontWeight="bold" textTransform="uppercase" letterSpacing="wider">
              SJ Nos
            </Text>
            {schedule.sj_nos.length > 1 && (
              <Text fontSize="10px" color={labelColor} sx={{ fontVariantNumeric: "tabular-nums" }}>
                {t("vlFactoryLive.totalLabel")} <Text as="span" fontWeight="bold">{totalSjOutput.toLocaleString()}</Text>
              </Text>
            )}
          </Flex>
          <Flex direction="column" gap={1}>
            {schedule.sj_nos.map((sj) => (
              <SjNoBadge key={sj.pk} sjNo={sj} />
            ))}
          </Flex>
        </Box>
      )}

      {/* ── 모듈 섹션 ── */}
      {hasModules && (
        <Box px={3} py={2} bg={sectionBg} borderTop="1px solid" borderColor={borderColor}>
          <Text fontSize="9px" color={labelColor} fontWeight="bold" mb={1.5} textTransform="uppercase" letterSpacing="wider">
            Modules
          </Text>
          <VStack gap={2.5} align="stretch">
            {schedule.modules_by_code.map((mod) => (
              <ModuleRow key={mod.code} mod={mod} />
            ))}
          </VStack>
        </Box>
      )}

      {/* 모듈도 SJ No도 없을 때 */}
      {!hasSjNos && !hasModules && (
        <Box px={3} py={2} bg={sectionBg} borderTop="1px solid" borderColor={borderColor}>
          <Text fontSize="11px" color={labelColor}>
            {t(statusKey(schedule.status))}
          </Text>
        </Box>
      )}
    </Box>
  );
}

// ── 라인 컬럼 ────────────────────────────────────────────────────────────────
function LineColumn({ line, date, highlightedPks, firstMatchPk }: { line: VlLiveLine; date: string; highlightedPks: Set<number>; firstMatchPk: number | null }) {
  const { t } = useTranslation();
  const colBg = useColorModeValue("blackAlpha.50", "blackAlpha.300");
  const borderColor = useColorModeValue("gray.200", "gray.600");
  const headerBg = useColorModeValue("gray.800", "gray.900");

  const totalOutput = line.schedules.reduce((s, sc) => s + sc.assembly_output_qty, 0);
  const totalOrder = line.schedules.reduce((s, sc) => s + (sc.vl_effective_qty || sc.total_order_qty), 0);
  const overallPct = totalOrder > 0 ? Math.round((totalOutput / totalOrder) * 100) : 0;
  const color = pctColor(overallPct);
  const activeCount = line.schedules.filter((sc) => (sc.hourly ?? []).some((e) => e.qty > 0)).length;

  return (
    <Flex
      direction="column"
      bg={colBg}
      border="1px solid"
      borderColor={borderColor}
      borderRadius="xl"
      overflow="hidden"
      w="280px"
      flexShrink={0}
    >
      {/* 라인 헤더 */}
      <Box bg={headerBg} px={3.5} py={2.5} flexShrink={0}>
        <Flex justify="space-between" align="center" mb={1.5}>
          <HStack gap={2} minW={0}>
            <Text color="white" fontWeight="bold" fontSize="sm" letterSpacing="wide" noOfLines={1}>
              {line.line_name}
            </Text>
            {activeCount > 0 && (
              <HStack gap={1} flexShrink={0}>
                <LiveDot />
                <Text color="red.300" fontSize="10px" fontWeight="bold">
                  {activeCount}
                </Text>
              </HStack>
            )}
          </HStack>
          <Text color={`${color}.300`} fontWeight="bold" fontSize="sm" flexShrink={0}>
            {overallPct}%
          </Text>
        </Flex>

        <Progress value={overallPct} colorScheme={color} size="xs" borderRadius="full" bg="whiteAlpha.200" mb={1.5} />

        <Flex justify="space-between">
          <Text color="gray.400" fontSize="10px">
            {t("vlFactoryLive.scheduleCount", { count: line.schedules.length })}
          </Text>
          <Text color="gray.300" fontSize="10px" sx={{ fontVariantNumeric: "tabular-nums" }}>
            {totalOutput.toLocaleString()} / {totalOrder.toLocaleString()}
          </Text>
        </Flex>
      </Box>

      {/* 스케줄 카드 목록 */}
      <VStack gap={2.5} p={2.5} pb={4} align="stretch">
        {line.schedules.length === 0 ? (
          <Center py={10}>
            <VStack gap={1}>
              <Box color="gray.400">
                <FiBox size={20} />
              </Box>
              <Text fontSize="xs" color="gray.400">
                {t("vlFactoryLive.noWork")}
              </Text>
            </VStack>
          </Center>
        ) : (
          line.schedules.map((sc) => (
            <ScheduleCard
              key={sc.pk}
              schedule={sc}
              date={date}
              highlighted={highlightedPks.has(sc.pk)}
              isFirstMatch={sc.pk === firstMatchPk}
            />
          ))
        )}
      </VStack>
    </Flex>
  );
}

// ── 라인별 요약 표 ───────────────────────────────────────────────────────────
function lineSummary(line: VlLiveLine) {
  const output = line.schedules.reduce((s, sc) => s + sc.assembly_output_qty, 0);
  const order = line.schedules.reduce((s, sc) => s + (sc.vl_effective_qty || sc.total_order_qty), 0);
  const slotTotals: Record<number, number> = {};
  for (const sc of line.schedules) {
    for (const e of sc.hourly ?? []) slotTotals[e.h] = (slotTotals[e.h] ?? 0) + e.qty;
  }
  const todayOutput = Object.values(slotTotals).reduce((s, q) => s + q, 0);
  const activeSlots = Object.values(slotTotals).filter((q) => q > 0).length;
  const avgPerHour = activeSlots > 0 ? todayOutput / activeSlots : 0;
  const activeCount = line.schedules.filter((sc) =>
    (sc.hourly ?? []).some((e) => e.qty > 0),
  ).length;
  const pct = order > 0 ? Math.round((output / order) * 100) : 0;
  return { output, order, todayOutput, avgPerHour, activeCount, pct };
}

function PctCell({ pct }: { pct: number }) {
  const color = pctColor(pct);
  return (
    <Flex align="center" justify="flex-end" gap={2}>
      <Progress
        value={Math.min(pct, 100)}
        colorScheme={color}
        size="xs"
        borderRadius="full"
        w="56px"
        flexShrink={0}
      />
      <Text fontSize="xs" fontWeight="bold" color={`${color}.500`} w="34px" textAlign="right">
        {pct}%
      </Text>
    </Flex>
  );
}

function calcLineModuleAvg(line: VlLiveLine, code: string) {
  const mods = line.schedules.flatMap((sc) => sc.modules_by_code.filter((m) => m.code === code));
  const slotMap: Record<number, number> = {};
  for (const mod of mods) {
    for (const e of mod.hourly ?? []) slotMap[e.h] = (slotMap[e.h] ?? 0) + e.qty;
  }
  const activeSlots = Object.values(slotMap).filter((q) => q > 0).length;
  const avg = activeSlots > 0 ? Object.values(slotMap).reduce((s, q) => s + q, 0) / activeSlots : 0;
  const targetSum = mods
    .filter((m) => (m.hourly ?? []).some((e) => e.qty > 0))
    .reduce((s, m) => s + (m.target_qty_per_hour ?? 0), 0);
  const ratePct = targetSum > 0 && activeSlots > 0 ? (avg / targetSum) * 100 : null;
  return { avg, activeSlots, ratePct };
}

function calcLineAssemblyRatePct(line: VlLiveLine): number | null {
  const slotMap: Record<number, number> = {};
  for (const sc of line.schedules) {
    for (const e of sc.hourly ?? []) slotMap[e.h] = (slotMap[e.h] ?? 0) + e.qty;
  }
  const activeSlots = Object.values(slotMap).filter((q) => q > 0).length;
  if (activeSlots === 0) return null;
  const avg = Object.values(slotMap).reduce((s, q) => s + q, 0) / activeSlots;
  const targetSum = line.schedules
    .filter((sc) => (sc.hourly ?? []).some((e) => e.qty > 0))
    .reduce((s, sc) => s + (sc.assembly_target_qty_per_hour ?? 0), 0);
  return targetSum > 0 ? (avg / targetSum) * 100 : null;
}

function LineSummaryTable({ lines }: { lines: VlLiveLine[] }) {
  const { t } = useTranslation();
  const tableBg = useColorModeValue("white", "gray.800");
  const borderColor = useColorModeValue("gray.200", "gray.700");
  const headColor = useColorModeValue("gray.500", "gray.400");
  const mutedText = useColorModeValue("gray.500", "gray.400");
  const footBg = useColorModeValue("gray.50", "whiteAlpha.50");

  const rows = lines.map((line) => ({ line, ...lineSummary(line) }));
  const total = rows.reduce(
    (acc, r) => ({
      schedules: acc.schedules + r.line.schedules.length,
      active: acc.active + r.activeCount,
      todayOutput: acc.todayOutput + r.todayOutput,
      output: acc.output + r.output,
      order: acc.order + r.order,
    }),
    { schedules: 0, active: 0, todayOutput: 0, output: 0, order: 0 },
  );
  const totalPct = total.order > 0 ? Math.round((total.output / total.order) * 100) : 0;

  // 전 라인 합산 Assembly 시간당 평균
  const unionSlotTotals: Record<number, number> = {};
  for (const line of lines) {
    for (const sc of line.schedules) {
      for (const e of sc.hourly ?? []) unionSlotTotals[e.h] = (unionSlotTotals[e.h] ?? 0) + e.qty;
    }
  }
  const unionActiveSlots = Object.values(unionSlotTotals).filter((q) => q > 0).length;
  const totalAvgPerHour = unionActiveSlots > 0 ? total.todayOutput / unionActiveSlots : 0;
  const totalAssemblyTargetSum = lines
    .flatMap((l) => l.schedules)
    .filter((sc) => (sc.hourly ?? []).some((e) => e.qty > 0))
    .reduce((s, sc) => s + (sc.assembly_target_qty_per_hour ?? 0), 0);
  const totalAssemblyRatePct =
    totalAssemblyTargetSum > 0 && unionActiveSlots > 0
      ? (totalAvgPerHour / totalAssemblyTargetSum) * 100
      : null;

  // 상위 2개 모듈 코드 수집
  const seenCodes: string[] = [];
  for (const line of lines) {
    for (const sc of line.schedules) {
      for (const mod of sc.modules_by_code) {
        if (!seenCodes.includes(mod.code)) seenCodes.push(mod.code);
      }
    }
  }
  const topCodes = seenCodes.slice(0, 2);

  // 전체 합산 모듈 평균 (footer용)
  const totalModuleAvg = topCodes.map((code) => {
    const allMods = lines.flatMap((l) =>
      l.schedules.flatMap((sc) => sc.modules_by_code.filter((m) => m.code === code)),
    );
    const slotMap: Record<number, number> = {};
    for (const mod of allMods) {
      for (const e of mod.hourly ?? []) slotMap[e.h] = (slotMap[e.h] ?? 0) + e.qty;
    }
    const activeSlots = Object.values(slotMap).filter((q) => q > 0).length;
    const avg = activeSlots > 0 ? Object.values(slotMap).reduce((s, q) => s + q, 0) / activeSlots : 0;
    const targetSum = allMods
      .filter((m) => (m.hourly ?? []).some((e) => e.qty > 0))
      .reduce((s, m) => s + (m.target_qty_per_hour ?? 0), 0);
    const ratePct = targetSum > 0 && activeSlots > 0 ? (avg / targetSum) * 100 : null;
    return { code, avg, activeSlots, ratePct };
  });

  const numericTd = {
    isNumeric: true,
    fontSize: "xs",
    sx: { fontVariantNumeric: "tabular-nums" },
  } as const;

  const renderAvgCell = (avg: number, activeSlots: number, ratePct: number | null, bold = false) => (
    <Flex align="center" justify="flex-end" gap={1} flexWrap="nowrap">
      <Text as="span" fontSize="xs" fontWeight={bold ? "bold" : undefined} sx={{ fontVariantNumeric: "tabular-nums" }}>
        {activeSlots > 0 ? `${Math.round(avg)}/h` : "-"}
      </Text>
      {ratePct != null && activeSlots > 0 && (
        <Text as="span" fontSize="10px" fontWeight="bold" color={pctTextColor(ratePct)} flexShrink={0}>
          ({ratePct.toFixed(0)}%)
        </Text>
      )}
    </Flex>
  );

  return (
    <TableContainer
      bg={tableBg}
      border="1px solid"
      borderColor={borderColor}
      borderRadius="xl"
      flexShrink={0}
    >
      <Table size="sm" variant="simple">
        <Thead>
          <Tr>
            <Th fontSize="10px" color={headColor}>{t("vlFactoryLive.table.line")}</Th>
            <Th fontSize="10px" color={headColor} isNumeric>{t("vlFactoryLive.table.schedule")}</Th>
            <Th fontSize="10px" color={headColor} isNumeric>{t("vlFactoryLive.table.active")}</Th>
            <Th fontSize="10px" color={headColor} isNumeric>{t("vlFactoryLive.table.todayOutput")}</Th>
            <Th fontSize="10px" color={headColor} isNumeric>{t("vlFactoryLive.table.assemblyAvg")}</Th>
            {topCodes.map((code, idx) => (
              <Th key={code} fontSize="10px" color={headColor} isNumeric>{t("vlFactoryLive.table.moduleAvg", { letter: ["B", "C"][idx] })}</Th>
            ))}
            <Th fontSize="10px" color={headColor} isNumeric>{t("vlFactoryLive.table.cumulativeOutput")}</Th>
            <Th fontSize="10px" color={headColor} isNumeric>{t("vlFactoryLive.table.achievement")}</Th>
          </Tr>
        </Thead>
        <Tbody>
          {rows.map(({ line, output, order, todayOutput, avgPerHour, activeCount, pct }) => {
            const assemblyRatePct = calcLineAssemblyRatePct(line);
            return (
              <Tr key={line.line_name}>
                <Td fontSize="xs" fontWeight="bold">
                  <HStack gap={1.5}>
                    {activeCount > 0 && <LiveDot />}
                    <Text>{line.line_name}</Text>
                  </HStack>
                </Td>
                <Td {...numericTd}>{line.schedules.length}</Td>
                <Td {...numericTd}>
                  {activeCount > 0 ? (
                    <Text as="span" color="red.400" fontWeight="bold">{activeCount}</Text>
                  ) : (
                    <Text as="span" color={mutedText}>-</Text>
                  )}
                </Td>
                <Td {...numericTd} fontWeight="semibold">
                  {todayOutput > 0 ? todayOutput.toLocaleString() : <Text as="span" color={mutedText}>-</Text>}
                </Td>
                <Td isNumeric>{renderAvgCell(avgPerHour, activeCount, assemblyRatePct)}</Td>
                {topCodes.map((code) => {
                  const ms = calcLineModuleAvg(line, code);
                  return <Td key={code} isNumeric>{renderAvgCell(ms.avg, ms.activeSlots, ms.ratePct)}</Td>;
                })}
                <Td {...numericTd}>
                  <Text as="span" fontWeight="semibold">{output.toLocaleString()}</Text>
                  <Text as="span" color={mutedText}> / {order.toLocaleString()}</Text>
                </Td>
                <Td isNumeric>
                  <PctCell pct={pct} />
                </Td>
              </Tr>
            );
          })}
        </Tbody>
        {rows.length > 1 && (
          <Tfoot bg={footBg}>
            <Tr>
              <Td fontSize="xs" fontWeight="bold">{t("vlFactoryLive.table.total")}</Td>
              <Td {...numericTd} fontWeight="bold">{total.schedules}</Td>
              <Td {...numericTd} fontWeight="bold" color={total.active > 0 ? "red.400" : undefined}>
                {total.active > 0 ? total.active : "-"}
              </Td>
              <Td {...numericTd} fontWeight="bold">{total.todayOutput.toLocaleString()}</Td>
              <Td isNumeric>{renderAvgCell(totalAvgPerHour, unionActiveSlots, totalAssemblyRatePct, true)}</Td>
              {totalModuleAvg.map(({ code, avg, activeSlots, ratePct }) => (
                <Td key={code} isNumeric>{renderAvgCell(avg, activeSlots, ratePct, true)}</Td>
              ))}
              <Td {...numericTd}>
                <Text as="span" fontWeight="bold">{total.output.toLocaleString()}</Text>
                <Text as="span" color={mutedText}> / {total.order.toLocaleString()}</Text>
              </Td>
              <Td isNumeric>
                <PctCell pct={totalPct} />
              </Td>
            </Tr>
          </Tfoot>
        )}
      </Table>
    </TableContainer>
  );
}

// ── 상단 KPI 카드 ────────────────────────────────────────────────────────────
export function KpiCard({
  label,
  value,
  suffix,
  sub,
  colorScheme,
  pct,
  ratePct,
}: {
  label: string;
  value: string;
  suffix?: string;
  sub?: string;
  colorScheme?: string;
  pct?: number;
  ratePct?: number | null;
}) {
  const bg = useColorModeValue("white", "gray.800");
  const border = useColorModeValue("gray.200", "gray.700");
  const labelColor = useColorModeValue("gray.500", "gray.400");

  return (
    <Box
      bg={bg}
      border="1px solid"
      borderColor={border}
      borderRadius="xl"
      px={3.5}
      py={2.5}
      flex={1}
      minW="150px"
    >
      <Text
        fontSize="9px"
        color={labelColor}
        fontWeight="semibold"
        textTransform="uppercase"
        letterSpacing="wider"
        mb={0.5}
        noOfLines={1}
      >
        {label}
      </Text>
      <HStack spacing={1.5} align="baseline" flexWrap="wrap">
        <Text
          fontSize="xl"
          fontWeight="bold"
          lineHeight={1.2}
          color={colorScheme ? `${colorScheme}.500` : undefined}
          sx={{ fontVariantNumeric: "tabular-nums" }}
        >
          {value}
          {suffix && (
            <Text as="span" fontSize="11px" fontWeight="semibold" color={labelColor}>
              {" "}{suffix}
            </Text>
          )}
        </Text>
        {ratePct != null && (
          <Text fontSize="sm" fontWeight="bold" color={pctTextColor(ratePct)} flexShrink={0} lineHeight={1}>
            ({ratePct.toFixed(0)}%)
          </Text>
        )}
      </HStack>
      {pct != null && (
        <Progress
          value={Math.min(pct, 100)}
          colorScheme={colorScheme}
          size="xs"
          borderRadius="full"
          mt={1.5}
        />
      )}
      {sub && (
        <Text fontSize="10px" color={labelColor} mt={pct != null ? 1 : 0.5} noOfLines={1} sx={{ fontVariantNumeric: "tabular-nums" }}>
          {sub}
        </Text>
      )}
    </Box>
  );
}

// ── AI 분석 결과 렌더러 ───────────────────────────────────────────────────────

// 인라인 **bold** 파싱
function InlineText({ children }: { children: string }) {
  const parts = children.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith("**") && p.endsWith("**")
          ? <Text as="span" key={i} fontWeight="bold">{p.slice(2, -2)}</Text>
          : <Text as="span" key={i}>{p}</Text>
      )}
    </>
  );
}

// 텍스트를 블록 단위로 파싱 (테이블 블록 감지)
type Block =
  | { type: "h2"; text: string }
  | { type: "h3"; text: string }
  | { type: "h1"; text: string }
  | { type: "hr" }
  | { type: "bullet"; text: string }
  | { type: "ordered"; n: string; text: string }
  | { type: "blank" }
  | { type: "bold_line"; text: string }
  | { type: "text"; text: string }
  | { type: "table"; rows: string[][] };

function parseBlocks(text: string): Block[] {
  const lines = text.split("\n");
  const blocks: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    // 테이블 블록: 연속된 | 로 시작하는 줄들
    if (line.trimStart().startsWith("|")) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].trimStart().startsWith("|")) {
        tableLines.push(lines[i]);
        i++;
      }
      // separator 행(|---|) 제외하고 파싱
      const rows = tableLines
        .filter((l) => !/^\s*\|[\s\-|:]+\|\s*$/.test(l))
        .map((l) =>
          l.replace(/^\s*\|/, "").replace(/\|\s*$/, "").split("|").map((c) => c.trim())
        );
      if (rows.length > 0) blocks.push({ type: "table", rows });
      continue;
    }
    if (line.startsWith("## ")) { blocks.push({ type: "h2", text: line.slice(3) }); i++; continue; }
    if (line.startsWith("### ")) { blocks.push({ type: "h3", text: line.slice(4) }); i++; continue; }
    if (line.startsWith("# ")) { blocks.push({ type: "h1", text: line.slice(2) }); i++; continue; }
    if (/^-{3,}$/.test(line.trim())) { blocks.push({ type: "hr" }); i++; continue; }
    if (line.startsWith("- ") || line.startsWith("* ")) { blocks.push({ type: "bullet", text: line.slice(2) }); i++; continue; }
    if (/^\d+\.\s/.test(line)) {
      const m = line.match(/^(\d+)\.\s(.*)/);
      blocks.push({ type: "ordered", n: m?.[1] ?? "", text: m?.[2] ?? "" });
      i++; continue;
    }
    if (line.trim() === "") { blocks.push({ type: "blank" }); i++; continue; }
    if (/^\*\*[^*].*[^*]\*\*$/.test(line.trim())) { blocks.push({ type: "bold_line", text: line.trim().slice(2, -2) }); i++; continue; }
    blocks.push({ type: "text", text: line });
    i++;
  }
  return blocks;
}

function AiAnalysisRenderer({ text }: { text: string }) {
  const headingColor = useColorModeValue("gray.800", "gray.100");
  const mutedColor = useColorModeValue("gray.500", "gray.400");
  const dividerColor = useColorModeValue("gray.200", "gray.600");
  const tableBorder = useColorModeValue("gray.200", "gray.600");
  const tableHeaderBg = useColorModeValue("gray.50", "gray.700");
  const tableRowHover = useColorModeValue("purple.50", "purple.900");
  const codeBg = useColorModeValue("purple.50", "purple.900");

  const blocks = parseBlocks(text);

  return (
    <VStack align="stretch" gap={1} fontSize="sm">
      {blocks.map((block, i) => {
        switch (block.type) {
          case "h1":
            return <Text key={i} fontWeight="bold" fontSize="lg" color={headingColor} mt={i > 0 ? 4 : 0}><InlineText>{block.text}</InlineText></Text>;
          case "h2":
            return <Text key={i} fontWeight="bold" fontSize="md" color={headingColor} mt={i > 0 ? 5 : 0} borderBottomWidth="2px" borderColor="purple.300" pb={1}><InlineText>{block.text}</InlineText></Text>;
          case "h3":
            return <Text key={i} fontWeight="semibold" color={headingColor} mt={3}><InlineText>{block.text}</InlineText></Text>;
          case "hr":
            return <Box key={i} borderTopWidth="1px" borderColor={dividerColor} my={3} />;
          case "bullet":
            return (
              <HStack key={i} align="flex-start" gap={1.5} pl={3}>
                <Text color={mutedColor} flexShrink={0} mt="2px">•</Text>
                <Text lineHeight="1.7"><InlineText>{block.text}</InlineText></Text>
              </HStack>
            );
          case "ordered":
            return (
              <HStack key={i} align="flex-start" gap={1.5} pl={3}>
                <Text color="purple.500" fontWeight="semibold" flexShrink={0} minW="18px">{block.n}.</Text>
                <Text lineHeight="1.7"><InlineText>{block.text}</InlineText></Text>
              </HStack>
            );
          case "blank":
            return <Box key={i} h={2} />;
          case "bold_line":
            return <Text key={i} fontWeight="semibold" bg={codeBg} px={2} py={1} borderRadius="md"><InlineText>{block.text}</InlineText></Text>;
          case "text":
            return <Text key={i} lineHeight="1.7"><InlineText>{block.text}</InlineText></Text>;
          case "table": {
            const [headerRow, ...dataRows] = block.rows;
            return (
              <Box key={i} overflowX="auto" my={2} borderWidth="1px" borderColor={tableBorder} borderRadius="md">
                <Table size="sm" variant="simple">
                  <Thead bg={tableHeaderBg}>
                    <Tr>
                      {headerRow.map((cell, ci) => (
                        <Th key={ci} fontSize="11px" py={2} px={3} borderColor={tableBorder} whiteSpace="nowrap">
                          <InlineText>{cell}</InlineText>
                        </Th>
                      ))}
                    </Tr>
                  </Thead>
                  <Tbody>
                    {dataRows.map((row, ri) => (
                      <Tr key={ri} _hover={{ bg: tableRowHover }}>
                        {row.map((cell, ci) => (
                          <Td key={ci} py={1.5} px={3} borderColor={tableBorder} fontSize="xs">
                            <InlineText>{cell}</InlineText>
                          </Td>
                        ))}
                      </Tr>
                    ))}
                  </Tbody>
                </Table>
              </Box>
            );
          }
        }
      })}
    </VStack>
  );
}

// ── 메인 페이지 ──────────────────────────────────────────────────────────────
export default function VlFactoryLive() {
  const { t } = useTranslation();
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [showLineSummary, setShowLineSummary] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const { isOpen: isAiOpen, onOpen: onAiOpen, onClose: onAiClose } = useDisclosure();

  const bgPage = useColorModeValue("gray.100", "gray.900");
  const headerBg = useColorModeValue("white", "gray.800");
  const headerBorder = useColorModeValue("gray.200", "gray.700");
  const mutedText = useColorModeValue("gray.500", "gray.400");
  const toggleHover = useColorModeValue("gray.700", "gray.200");

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["vl-factory-live-schedules", date],
    queryFn: () => getVlFactoryLiveSchedules(date),
    refetchInterval: 60_000,
    retry: false,
  });

  useEffect(() => {
    if (!isFetching) setLastRefreshed(new Date());
  }, [isFetching]);

  const lines = data?.lines ?? [];

  const allSchedules = lines.flatMap((l) => l.schedules);

  // ── 검색 일치 계산 ──
  const trimmedSearch = searchQuery.trim().toLowerCase();
  const highlightedPks = new Set<number>();
  let firstMatchPk: number | null = null;
  if (trimmedSearch) {
    for (const line of lines) {
      for (const sc of line.schedules) {
        const matches =
          sc.style_code?.toLowerCase().includes(trimmedSearch) ||
          sc.style_name?.toLowerCase().includes(trimmedSearch) ||
          sc.po_no?.toLowerCase().includes(trimmedSearch) ||
          sc.sj_nos.some((sj) => sj.sj_no.toLowerCase().includes(trimmedSearch)) ||
          String(sc.pk) === trimmedSearch;
        if (matches) {
          highlightedPks.add(sc.pk);
          if (firstMatchPk === null) firstMatchPk = sc.pk;
        }
      }
    }
  }
  const totalOutput = allSchedules.reduce((s, sc) => s + sc.assembly_output_qty, 0);
  const totalOrder = allSchedules.reduce((s, sc) => s + (sc.vl_effective_qty || sc.total_order_qty), 0);
  const overallPct = totalOrder > 0 ? Math.round((totalOutput / totalOrder) * 100) : 0;
  const activeScheduleCount = allSchedules.filter((sc) =>
    (sc.hourly ?? []).some((e) => e.qty > 0),
  ).length;

  // ── 시간당 KPI 계산 ──
  // 시간대별 전 라인 합산
  const slotTotals: Record<number, number> = {};
  for (const sc of allSchedules) {
    for (const e of sc.hourly ?? []) slotTotals[e.h] = (slotTotals[e.h] ?? 0) + e.qty;
  }
  const todayTotal = Object.values(slotTotals).reduce((s, q) => s + q, 0);
  const activeSlotCount = Object.values(slotTotals).filter((q) => q > 0).length;
  const avgPerHour = activeSlotCount > 0 ? todayTotal / activeSlotCount : 0;

  // 가동 중인 스케줄의 시간당 목표 합계 → 평균 달성률
  const totalTargetPerHour = allSchedules
    .filter((sc) => (sc.hourly ?? []).some((e) => e.qty > 0))
    .reduce((s, sc) => s + (sc.assembly_target_qty_per_hour ?? 0), 0);
  const avgAchievePct =
    totalTargetPerHour > 0 && activeSlotCount > 0 ? (avgPerHour / totalTargetPerHour) * 100 : null;

  // ── 상위 2개 모듈 코드별 통계 ──
  const seenModuleCodes: string[] = [];
  const modulesByCode = new Map<string, VlLiveModule[]>();
  for (const sc of allSchedules) {
    for (const mod of sc.modules_by_code) {
      if (!modulesByCode.has(mod.code)) {
        modulesByCode.set(mod.code, []);
        seenModuleCodes.push(mod.code);
      }
      modulesByCode.get(mod.code)!.push(mod);
    }
  }
  const topModuleKpis = seenModuleCodes.slice(0, 2).map((code) => {
    const mods = modulesByCode.get(code)!;
    const slotMap: Record<number, number> = {};
    for (const mod of mods) {
      for (const e of mod.hourly ?? []) slotMap[e.h] = (slotMap[e.h] ?? 0) + e.qty;
    }
    const activeSlots = Object.values(slotMap).filter((q) => q > 0).length;
    const avg = activeSlots > 0 ? Object.values(slotMap).reduce((s, q) => s + q, 0) / activeSlots : 0;
    const targetSum = mods
      .filter((m) => (m.hourly ?? []).some((e) => e.qty > 0))
      .reduce((s, m) => s + (m.target_qty_per_hour ?? 0), 0);
    const ratePct = targetSum > 0 && activeSlots > 0 ? (avg / targetSum) * 100 : null;
    return { code, avg, activeSlots, targetSum, ratePct };
  });

  // ── EF 임박 스케줄 수 (D-7 이내 또는 지남) ──
  const todayMs = new Date(); todayMs.setHours(0, 0, 0, 0);
  const urgentCount = allSchedules.filter((sc) => {
    if (!sc.ex_factory_date) return false;
    const ef = new Date(sc.ex_factory_date); ef.setHours(0, 0, 0, 0);
    return Math.round((ef.getTime() - todayMs.getTime()) / 86400000) <= 7;
  }).length;

  // 현재(또는 마지막 가동) 시간대
  const isToday = date === today;
  const nowH = new Date().getHours();
  const lastActiveSlot = [...ALL_SLOTS].reverse().find((s) => (slotTotals[s.h] ?? 0) > 0);
  const currentSlot = isToday
    ? [...ALL_SLOTS].filter((s) => s.h <= nowH).pop() ?? null
    : lastActiveSlot ?? null;

  return (
    <>
      <Helmet>
        <title>VL Factory Live</title>
      </Helmet>

      <Box
        bg={bgPage}
        display="flex"
        flexDirection="column"
        pb={10}
      >
        {/* 헤더 */}
        <Box
          bg={headerBg}
          borderBottom="1px solid"
          borderColor={headerBorder}
          px={4}
          py={2.5}
          flexShrink={0}
        >
          <Flex align="center" justify="space-between" gap={4} flexWrap="wrap">
            <HStack gap={2.5} flexShrink={0}>
              <LiveDot />
              <Text fontWeight="bold" fontSize="lg" letterSpacing="tight">
                VL Factory Live
              </Text>
            </HStack>

            <HStack gap={2} flexShrink={0} flexWrap="wrap">
              <Button
                size="sm"
                leftIcon={<FiCpu size={14} />}
                colorScheme="purple"
                variant="outline"
                flexShrink={0}
                isLoading={aiLoading}
                loadingText="AI 분석 중..."
                onClick={async () => {
                  onAiOpen();
                  if (aiAnalysis) return;
                  setAiLoading(true);
                  try {
                    const res = await getVlFactoryLiveAIAnalysis(date);
                    setAiAnalysis(res.analysis);
                  } catch {
                    setAiAnalysis("분석 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.");
                  } finally {
                    setAiLoading(false);
                  }
                }}
              >
                AI 분석
              </Button>
              <InputGroup size="sm" w="200px" flexShrink={0}>
                <InputLeftElement pointerEvents="none">
                  <Box color={trimmedSearch && highlightedPks.size === 0 ? "red.400" : trimmedSearch ? "orange.400" : mutedText}>
                    <FiSearch size={13} />
                  </Box>
                </InputLeftElement>
                <Input
                  placeholder={t("vlFactoryLive.searchPlaceholder", "오더 검색...")}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  borderRadius="md"
                  pr="28px"
                  borderColor={trimmedSearch && highlightedPks.size === 0 ? "red.400" : trimmedSearch ? "orange.400" : undefined}
                  _focus={{ borderColor: "orange.400", boxShadow: "0 0 0 1px var(--chakra-colors-orange-400)" }}
                />
                {searchQuery && (
                  <InputRightElement>
                    <IconButton
                      aria-label="clear search"
                      icon={<FiX size={12} />}
                      size="xs"
                      variant="ghost"
                      onClick={() => setSearchQuery("")}
                    />
                  </InputRightElement>
                )}
              </InputGroup>
              {trimmedSearch && (
                <Text fontSize="xs" color={highlightedPks.size > 0 ? "orange.500" : "red.400"} whiteSpace="nowrap" flexShrink={0}>
                  {highlightedPks.size > 0
                    ? t("vlFactoryLive.searchFound", { count: highlightedPks.size })
                    : t("vlFactoryLive.searchNotFound", "없음")}
                </Text>
              )}
              <LocalizedDateInput value={date} onChange={(v) => setDate(v)} size="sm" />
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
        <Flex direction="column" px={4} py={3} gap={3}>
          {isLoading ? (
            <Center h="100%">
              <Spinner size="xl" color="blue.400" thickness="3px" />
            </Center>
          ) : isError ? (
            <Center h="100%">
              <Text color="red.400">{t("vlFactoryLive.errorLoading")}</Text>
            </Center>
          ) : lines.length === 0 ? (
            <Center h="100%">
              <VStack gap={2}>
                <Box color={mutedText}>
                  <FiBox size={28} />
                </Box>
                <Text color={mutedText} fontSize="sm">
                  {t("vlFactoryLive.noSchedules")}
                </Text>
              </VStack>
            </Center>
          ) : (
            <>
              {/* 총 요약 KPI */}
              <Flex gap={2.5} flexWrap="wrap" flexShrink={0}>
                {/* 금일 생산수량 */}
                <KpiCard
                  label={t("vlFactoryLive.kpi.todayAllLines")}
                  value={todayTotal.toLocaleString()}
                  sub={t("vlFactoryLive.kpi.todayAllLinesSub", { output: totalOutput.toLocaleString(), order: totalOrder.toLocaleString() })}
                />
                {/* 현재 시간대 */}
                <KpiCard
                  label={t("vlFactoryLive.kpi.currentSlot")}
                  value={currentSlot ? (slotTotals[currentSlot.h] ?? 0).toLocaleString() : "-"}
                  sub={
                    currentSlot
                      ? t(isToday ? "vlFactoryLive.kpi.currentSlotNow" : "vlFactoryLive.kpi.currentSlotLast", { slot: currentSlot.label })
                      : t("vlFactoryLive.kpi.noActiveSlot")
                  }
                />
                {/* Assembly (A) 시간당 평균 + 달성률 */}
                <KpiCard
                  label={t("vlFactoryLive.kpi.assemblyAvg")}
                  value={activeSlotCount > 0 ? Math.round(avgPerHour).toLocaleString() : "-"}
                  suffix={activeSlotCount > 0 ? "/h" : undefined}
                  colorScheme={avgAchievePct != null ? pctColor(avgAchievePct) : undefined}
                  ratePct={avgAchievePct}
                  sub={
                    totalTargetPerHour > 0
                      ? t("vlFactoryLive.detail.targetPerHour", { target: totalTargetPerHour })
                      : t("vlFactoryLive.kpi.activeSlotsSub", { count: activeSlotCount })
                  }
                />
                {/* 상위 2개 모듈 시간당 평균 */}
                {topModuleKpis.map(({ code, avg, activeSlots, targetSum, ratePct: mRatePct }, idx) => (
                  <KpiCard
                    key={code}
                    label={t("vlFactoryLive.kpi.moduleAvg", { letter: ["B", "C"][idx] })}
                    value={activeSlots > 0 ? Math.round(avg).toLocaleString() : "-"}
                    suffix={activeSlots > 0 ? "/h" : undefined}
                    colorScheme={mRatePct != null ? pctColor(mRatePct) : undefined}
                    ratePct={mRatePct}
                    sub={targetSum > 0 ? t("vlFactoryLive.detail.targetPerHour", { target: targetSum }) : undefined}
                  />
                ))}
                {/* 가동 스케줄 현황 */}
                <KpiCard
                  label={t("vlFactoryLive.kpi.activeSchedules")}
                  value={String(activeScheduleCount)}
                  suffix={t("vlFactoryLive.kpi.countSuffix") || undefined}
                  sub={t("vlFactoryLive.kpi.activeSchedulesSub", { total: allSchedules.length })}
                  colorScheme={activeScheduleCount > 0 ? "blue" : undefined}
                />
                {/* EF 임박 */}
                <KpiCard
                  label={t("vlFactoryLive.kpi.urgentEf")}
                  value={urgentCount > 0 ? String(urgentCount) : t("vlFactoryLive.kpi.urgentEfNone")}
                  suffix={urgentCount > 0 ? (t("vlFactoryLive.kpi.countSuffix") || undefined) : undefined}
                  sub={urgentCount > 0 ? t("vlFactoryLive.kpi.urgentEfSub") : undefined}
                  colorScheme={urgentCount > 0 ? "orange" : undefined}
                />
                {/* 전체 달성률 (누적) */}
                <KpiCard
                  label={t("vlFactoryLive.kpi.totalAchievement")}
                  value={String(overallPct)}
                  suffix="%"
                  colorScheme={pctColor(overallPct)}
                  pct={overallPct}
                  sub={t("vlFactoryLive.kpi.totalAchievementSub", { lines: lines.length, schedules: allSchedules.length, active: activeScheduleCount })}
                />
              </Flex>

              {/* 라인별 요약 (펼치기/접기) */}
              <Box flexShrink={0}>
                <Flex
                  as="button"
                  onClick={() => setShowLineSummary((v) => !v)}
                  align="center"
                  gap={1}
                  color={mutedText}
                  _hover={{ color: toggleHover }}
                  transition="color 0.15s"
                >
                  {showLineSummary ? <FiChevronUp size={14} /> : <FiChevronDown size={14} />}
                  <Text fontSize="xs" fontWeight="semibold">
                    {t("vlFactoryLive.lineSummaryToggle")} {showLineSummary ? t("vlFactoryLive.collapse") : t("vlFactoryLive.expand")}
                  </Text>
                </Flex>
                <Collapse in={showLineSummary} animateOpacity>
                  <Box pt={2}>
                    <LineSummaryTable lines={lines} />
                  </Box>
                </Collapse>
              </Box>

              {/* 라인 컬럼 */}
              <Box overflowX="auto">
                <Flex gap={3} align="flex-start" width="max-content">
                  {lines.map((line) => (
                    <LineColumn key={line.line_name} line={line} date={date} highlightedPks={highlightedPks} firstMatchPk={firstMatchPk} />
                  ))}
                </Flex>
              </Box>
            </>
          )}
        </Flex>
      </Box>

      {/* AI 분석 Drawer */}
      <Drawer isOpen={isAiOpen} placement="right" onClose={onAiClose} size="lg">
        <DrawerOverlay />
        <DrawerContent>
          <DrawerCloseButton />
          <DrawerHeader borderBottomWidth="1px">
            <HStack gap={2}>
              <Box color="purple.500"><FiCpu size={18} /></Box>
              <Text>AI 생산 현황 분석</Text>
            </HStack>
          </DrawerHeader>
          <DrawerBody py={4}>
            {aiLoading ? (
              <Center h="200px">
                <VStack gap={3}>
                  <Spinner size="lg" color="purple.500" />
                  <Text fontSize="sm" color="gray.500">스케줄 데이터를 분석하는 중...</Text>
                </VStack>
              </Center>
            ) : aiAnalysis ? (
              <Box>
                <AiAnalysisRenderer text={aiAnalysis} />
                <Button
                  mt={6}
                  size="sm"
                  variant="outline"
                  colorScheme="purple"
                  leftIcon={<FiRefreshCw size={13} />}
                  isLoading={aiLoading}
                  onClick={async () => {
                    setAiAnalysis(null);
                    setAiLoading(true);
                    try {
                      const res = await getVlFactoryLiveAIAnalysis(date);
                      setAiAnalysis(res.analysis);
                    } catch {
                      setAiAnalysis("분석 중 오류가 발생했습니다.");
                    } finally {
                      setAiLoading(false);
                    }
                  }}
                >
                  다시 분석
                </Button>
              </Box>
            ) : null}
          </DrawerBody>
        </DrawerContent>
      </Drawer>
    </>
  );
}
