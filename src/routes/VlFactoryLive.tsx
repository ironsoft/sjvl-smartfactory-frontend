import {
  Badge,
  Box,
  Center,
  Collapse,
  Flex,
  HStack,
  IconButton,
  Image,
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
} from "@chakra-ui/react";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Helmet } from "react-helmet";
import {
  FiBox,
  FiChevronDown,
  FiChevronUp,
  FiRefreshCw,
  FiTrendingDown,
  FiTrendingUp,
} from "react-icons/fi";
import {
  getVlFactoryLiveSchedules,
  type VlLiveHourly,
  type VlLiveLine,
  type VlLiveModule,
  type VlLiveSchedule,
  type VlLiveSjNo,
} from "../api";
import LocalizedDateInput from "../components/LocalizedDateInput";

// ── 색상 헬퍼 ────────────────────────────────────────────────────────────────
function pctColor(pct: number) {
  if (pct >= 100) return "green";
  if (pct >= 80) return "blue";
  if (pct >= 50) return "yellow";
  return "red";
}

function statusLabel(status: string) {
  const map: Record<string, string> = {
    not_started: "시작 전",
    in_progress: "진행 중",
    completed: "완료",
    outsourced: "외주",
    not_ready: "준비 안됨",
  };
  return map[status] ?? status;
}

// ── LIVE 펄스 애니메이션 ─────────────────────────────────────────────────────
const pulse = keyframes`
  0% { box-shadow: 0 0 0 0 rgba(229, 62, 62, 0.5); }
  70% { box-shadow: 0 0 0 6px rgba(229, 62, 62, 0); }
  100% { box-shadow: 0 0 0 0 rgba(229, 62, 62, 0); }
`;

function LiveDot() {
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
  const sizeLabel = sjNo.sj_no.split("-").pop() ?? sjNo.sj_no;
  return (
    <Tooltip label={sjNo.sj_no} hasArrow placement="top">
      <Flex
        align="center"
        gap={1.5}
        bg="purple.50"
        border="1px solid"
        borderColor="purple.100"
        borderRadius="full"
        px={2.5}
        py={0.5}
        _dark={{ bg: "purple.900", borderColor: "purple.700" }}
        cursor="default"
      >
        <Text fontSize="10px" fontWeight="bold" color="purple.500" _dark={{ color: "purple.300" }}>
          {sizeLabel}
        </Text>
        <Text fontSize="11px" fontWeight="semibold">
          {sjNo.output_qty.toLocaleString()}
        </Text>
      </Flex>
    </Tooltip>
  );
}

// ── ERP 시간대 슬롯 정의 (D1~D8, OT1~OT5) ──────────────────────────────────
const DAY_SLOTS = [
  { label: "D1", h: 7 },
  { label: "D2", h: 8 },
  { label: "D3", h: 9 },
  { label: "D4", h: 10 },
  { label: "D5", h: 11 },
  { label: "D6", h: 13 },
  { label: "D7", h: 14 },
  { label: "D8", h: 15 },
] as const;

const OT_SLOTS = [
  { label: "OT1", h: 16 },
  { label: "OT2", h: 17 },
  { label: "OT3", h: 18 },
  { label: "OT4", h: 19 },
  { label: "OT5", h: 20 },
] as const;

const ALL_SLOTS = [...DAY_SLOTS, ...OT_SLOTS];

// ── 시간당 통계 헬퍼 ─────────────────────────────────────────────────────────
function hourlyStats(hourly: VlLiveHourly[] | undefined, target: number | null) {
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
function AvgRateBadge({
  hourly,
  target,
}: {
  hourly: VlLiveHourly[] | undefined;
  target: number | null;
}) {
  const { avg, ratePct, meets } = hourlyStats(hourly, target);
  if (ratePct == null) return null;

  return (
    <Tooltip
      label={`시간당 평균 ${avg.toFixed(1)} / 목표 ${target} (${ratePct.toFixed(0)}%)`}
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
  const zeroBg = useColorModeValue("blackAlpha.50", "whiteAlpha.100");
  const mutedColor = useColorModeValue("gray.400", "gray.500");
  const hasTarget = target !== null && target > 0;
  const meetsTarget = hasTarget && qty >= target!;
  const bg = qty === 0 ? zeroBg : meetsTarget ? "green.400" : "orange.400";
  const labelColor = qty === 0 ? mutedColor : "whiteAlpha.800";
  const qtyColor = qty === 0 ? mutedColor : "white";
  const pct = hasTarget ? Math.min((qty / target!) * 100, 100) : 0;

  const tooltipLabel = hasTarget
    ? `${label}: ${qty} / 목표 ${target} (${pct.toFixed(0)}%)`
    : `${label}: ${qty}`;

  return (
    <Tooltip label={tooltipLabel} hasArrow placement="top">
      <Flex
        direction="column"
        align="center"
        justify="center"
        flex={1}
        minW="20px"
        h="34px"
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
    <Flex gap="3px" align="stretch">
      {DAY_SLOTS.map((slot) => (
        <HourlyBadge key={slot.label} label={slot.label} qty={hourMap[slot.h] ?? 0} target={target} />
      ))}
      <Box w="1px" bg={otDividerColor} borderRadius="full" my="4px" flexShrink={0} />
      {OT_SLOTS.map((slot) => (
        <HourlyBadge key={slot.label} label={slot.label} qty={hourMap[slot.h] ?? 0} target={target} />
      ))}
    </Flex>
  );
}

// ── 모듈 행 ──────────────────────────────────────────────────────────────────
function ModuleRow({ mod }: { mod: VlLiveModule }) {
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
            bg={isMissingTarget ? "red.400" : `${color}.400`}
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
            <Tooltip label="시간당 목표 수량" hasArrow placement="top">
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
    </Box>
  );
}

// ── 스케줄 카드 ──────────────────────────────────────────────────────────────
function ScheduleCard({ schedule }: { schedule: VlLiveSchedule }) {
  const cardBg = useColorModeValue("white", "gray.700");
  const borderColor = useColorModeValue("gray.200", "gray.600");
  const labelColor = useColorModeValue("gray.500", "gray.400");
  const sectionBg = useColorModeValue("gray.50", "whiteAlpha.50");
  const thumbBg = useColorModeValue("gray.100", "gray.600");
  const stripBg = useColorModeValue("gray.100", "gray.600");

  const pct = schedule.progress_pct;
  const color = pctColor(pct);
  const totalSjOutput = schedule.sj_nos.reduce((s, sj) => s + sj.output_qty, 0);
  const hasSjNos = schedule.sj_nos.length > 0;
  const hasModules = schedule.modules_by_code.length > 0;

  // 오늘 실적이 1건이라도 있으면 진행중으로 판단
  const isActiveToday = (schedule.hourly ?? []).some((e) => e.qty > 0);

  return (
    <Box
      bg={cardBg}
      borderWidth="1px"
      borderColor={isActiveToday ? "blue.300" : borderColor}
      borderRadius="xl"
      overflow="hidden"
      shadow={isActiveToday ? "md" : "xs"}
      opacity={isActiveToday ? 1 : 0.55}
      w="100%"
      flexShrink={0}
      transition="all 0.2s"
      _hover={{ opacity: 1, shadow: "md" }}
      position="relative"
    >
      {/* 상단 진행률 스트립 */}
      <Box h="3px" bg={stripBg}>
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

          <Box flex={1} minW={0}>
            <HStack gap={1.5}>
              {isActiveToday && <LiveDot />}
              <Text fontWeight="bold" fontSize="sm" noOfLines={1}>
                {schedule.po_no || `#${schedule.pk}`}
              </Text>
            </HStack>
            {schedule.style_name && (
              <Text fontSize="10px" color={labelColor} noOfLines={1}>
                {schedule.style_name}
                {schedule.ex_factory_date && ` · ${schedule.ex_factory_date}`}
              </Text>
            )}
          </Box>

          {/* 진행률 */}
          <Box textAlign="right" flexShrink={0}>
            <Text fontSize="lg" fontWeight="bold" lineHeight={1} color={`${color}.500`}>
              {pct.toFixed(0)}
              <Text as="span" fontSize="10px" fontWeight="semibold">
                %
              </Text>
            </Text>
          </Box>
        </Flex>

        {/* 수량 요약 */}
        <Flex justify="space-between" align="center" mb={1.5}>
          <HStack gap={1.5}>
            <Text fontSize="10px" color={labelColor} fontWeight="medium">
              Assembly
            </Text>
            {schedule.assembly_target_qty_per_hour != null && (
              <Tooltip label="시간당 목표 수량 (SJ No 합산)" hasArrow placement="top">
                <Badge colorScheme="purple" fontSize="9px" variant="subtle" cursor="default" borderRadius="full" px={1.5}>
                  {schedule.assembly_target_qty_per_hour}/h
                </Badge>
              </Tooltip>
            )}
            <AvgRateBadge hourly={schedule.hourly} target={schedule.assembly_target_qty_per_hour} />
          </HStack>
          <Text fontSize="11px" sx={{ fontVariantNumeric: "tabular-nums" }}>
            <Text as="span" fontWeight="bold">
              {schedule.assembly_output_qty.toLocaleString()}
            </Text>
            {schedule.total_order_qty > 0 && (
              <Text as="span" color={labelColor}>
                {" "}/ {schedule.total_order_qty.toLocaleString()}
              </Text>
            )}
          </Text>
        </Flex>

        {/* Assembly 시간대별 히트맵 */}
        <HourlyHeatmap hourly={schedule.hourly} target={schedule.assembly_target_qty_per_hour} />
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
                합계 <Text as="span" fontWeight="bold">{totalSjOutput.toLocaleString()}</Text>
              </Text>
            )}
          </Flex>
          <Flex gap={1.5} flexWrap="wrap" align="center">
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
            {statusLabel(schedule.status)}
          </Text>
        </Box>
      )}
    </Box>
  );
}

// ── 라인 컬럼 ────────────────────────────────────────────────────────────────
function LineColumn({ line }: { line: VlLiveLine }) {
  const colBg = useColorModeValue("blackAlpha.50", "blackAlpha.300");
  const borderColor = useColorModeValue("gray.200", "gray.600");
  const headerBg = useColorModeValue("gray.800", "gray.900");

  const totalOutput = line.schedules.reduce((s, sc) => s + sc.assembly_output_qty, 0);
  const totalOrder = line.schedules.reduce((s, sc) => s + sc.total_order_qty, 0);
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
      maxH="100%"
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
            스케줄 {line.schedules.length}건
          </Text>
          <Text color="gray.300" fontSize="10px" sx={{ fontVariantNumeric: "tabular-nums" }}>
            {totalOutput.toLocaleString()} / {totalOrder.toLocaleString()}
          </Text>
        </Flex>
      </Box>

      {/* 스케줄 카드 목록 */}
      <VStack gap={2.5} p={2.5} align="stretch" overflowY="auto" flex={1}>
        {line.schedules.length === 0 ? (
          <Center py={10}>
            <VStack gap={1}>
              <Box color="gray.400">
                <FiBox size={20} />
              </Box>
              <Text fontSize="xs" color="gray.400">
                작업 없음
              </Text>
            </VStack>
          </Center>
        ) : (
          line.schedules.map((sc) => <ScheduleCard key={sc.pk} schedule={sc} />)
        )}
      </VStack>
    </Flex>
  );
}

// ── 라인별 요약 표 ───────────────────────────────────────────────────────────
function lineSummary(line: VlLiveLine) {
  const output = line.schedules.reduce((s, sc) => s + sc.assembly_output_qty, 0);
  const order = line.schedules.reduce((s, sc) => s + sc.total_order_qty, 0);
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

function LineSummaryTable({ lines }: { lines: VlLiveLine[] }) {
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

  // 전 라인 합산 시간당 평균 (시간대별 합산 후 가동 시간대 수로 나눔)
  const unionSlotTotals: Record<number, number> = {};
  for (const line of lines) {
    for (const sc of line.schedules) {
      for (const e of sc.hourly ?? []) unionSlotTotals[e.h] = (unionSlotTotals[e.h] ?? 0) + e.qty;
    }
  }
  const unionActiveSlots = Object.values(unionSlotTotals).filter((q) => q > 0).length;
  const totalAvgPerHour = unionActiveSlots > 0 ? total.todayOutput / unionActiveSlots : 0;

  const numericTd = {
    isNumeric: true,
    fontSize: "xs",
    sx: { fontVariantNumeric: "tabular-nums" },
  } as const;

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
            <Th fontSize="10px" color={headColor}>라인</Th>
            <Th fontSize="10px" color={headColor} isNumeric>스케줄</Th>
            <Th fontSize="10px" color={headColor} isNumeric>가동</Th>
            <Th fontSize="10px" color={headColor} isNumeric>금일 실적</Th>
            <Th fontSize="10px" color={headColor} isNumeric>시간당 평균</Th>
            <Th fontSize="10px" color={headColor} isNumeric>누적 실적 / 주문</Th>
            <Th fontSize="10px" color={headColor} isNumeric>달성률</Th>
          </Tr>
        </Thead>
        <Tbody>
          {rows.map(({ line, output, order, todayOutput, avgPerHour, activeCount, pct }) => (
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
                  <Text as="span" color="red.400" fontWeight="bold">
                    {activeCount}
                  </Text>
                ) : (
                  <Text as="span" color={mutedText}>-</Text>
                )}
              </Td>
              <Td {...numericTd} fontWeight="semibold">
                {todayOutput > 0 ? todayOutput.toLocaleString() : <Text as="span" color={mutedText}>-</Text>}
              </Td>
              <Td {...numericTd}>
                {avgPerHour > 0 ? (
                  `${Math.round(avgPerHour).toLocaleString()}/h`
                ) : (
                  <Text as="span" color={mutedText}>-</Text>
                )}
              </Td>
              <Td {...numericTd}>
                <Text as="span" fontWeight="semibold">{output.toLocaleString()}</Text>
                <Text as="span" color={mutedText}> / {order.toLocaleString()}</Text>
              </Td>
              <Td isNumeric>
                <PctCell pct={pct} />
              </Td>
            </Tr>
          ))}
        </Tbody>
        {rows.length > 1 && (
          <Tfoot bg={footBg}>
            <Tr>
              <Td fontSize="xs" fontWeight="bold">합계</Td>
              <Td {...numericTd} fontWeight="bold">{total.schedules}</Td>
              <Td {...numericTd} fontWeight="bold" color={total.active > 0 ? "red.400" : undefined}>
                {total.active > 0 ? total.active : "-"}
              </Td>
              <Td {...numericTd} fontWeight="bold">{total.todayOutput.toLocaleString()}</Td>
              <Td {...numericTd} fontWeight="bold">
                {totalAvgPerHour > 0 ? `${Math.round(totalAvgPerHour).toLocaleString()}/h` : "-"}
              </Td>
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
function KpiCard({
  label,
  value,
  suffix,
  sub,
  colorScheme,
  pct,
}: {
  label: string;
  value: string;
  suffix?: string;
  sub?: string;
  colorScheme?: string;
  pct?: number;
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

// ── 메인 페이지 ──────────────────────────────────────────────────────────────
export default function VlFactoryLive() {
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [showLineSummary, setShowLineSummary] = useState(false);

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
  const totalOutput = allSchedules.reduce((s, sc) => s + sc.assembly_output_qty, 0);
  const totalOrder = allSchedules.reduce((s, sc) => s + sc.total_order_qty, 0);
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
        height="max(calc(100vh - 105px), 760px)"
        overflow="hidden"
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

            <HStack gap={2} flexShrink={0}>
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
              <Tooltip label="새로고침">
                <IconButton
                  aria-label="새로고침"
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
        <Flex direction="column" flex={1} overflow="hidden" px={4} py={3} gap={3}>
          {isLoading ? (
            <Center h="100%">
              <Spinner size="xl" color="blue.400" thickness="3px" />
            </Center>
          ) : isError ? (
            <Center h="100%">
              <Text color="red.400">데이터를 불러올 수 없습니다.</Text>
            </Center>
          ) : lines.length === 0 ? (
            <Center h="100%">
              <VStack gap={2}>
                <Box color={mutedText}>
                  <FiBox size={28} />
                </Box>
                <Text color={mutedText} fontSize="sm">
                  해당 날짜의 진행 중인 스케줄이 없습니다.
                </Text>
              </VStack>
            </Center>
          ) : (
            <>
              {/* 총 요약 KPI */}
              <Flex gap={2.5} flexWrap="wrap" flexShrink={0}>
                <KpiCard
                  label="금일 생산수량 (전 라인)"
                  value={todayTotal.toLocaleString()}
                  sub={`누적 ${totalOutput.toLocaleString()} / 주문 ${totalOrder.toLocaleString()}`}
                />
                <KpiCard
                  label="시간당 총수량"
                  value={currentSlot ? (slotTotals[currentSlot.h] ?? 0).toLocaleString() : "-"}
                  sub={
                    currentSlot
                      ? `${isToday ? "현재 시간대" : "마지막 가동"} ${currentSlot.label}`
                      : "가동 시간대 없음"
                  }
                />
                <KpiCard
                  label="시간당 평균수량"
                  value={activeSlotCount > 0 ? Math.round(avgPerHour).toLocaleString() : "-"}
                  sub={`가동 시간대 ${activeSlotCount}개`}
                />
                <KpiCard
                  label="시간당 평균 달성률"
                  value={avgAchievePct != null ? String(Math.round(avgAchievePct)) : "-"}
                  suffix={avgAchievePct != null ? "%" : undefined}
                  colorScheme={avgAchievePct != null ? pctColor(avgAchievePct) : undefined}
                  pct={avgAchievePct ?? undefined}
                  sub={`시간당 목표 합계 ${totalTargetPerHour.toLocaleString()}/h`}
                />
                <KpiCard
                  label="전체 달성률 (누적)"
                  value={String(overallPct)}
                  suffix="%"
                  colorScheme={pctColor(overallPct)}
                  pct={overallPct}
                  sub={`라인 ${lines.length} · 스케줄 ${allSchedules.length}건 · 가동 ${activeScheduleCount}건`}
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
                    라인별 요약 {showLineSummary ? "접기" : "펼치기"}
                  </Text>
                </Flex>
                <Collapse in={showLineSummary} animateOpacity>
                  <Box pt={2}>
                    <LineSummaryTable lines={lines} />
                  </Box>
                </Collapse>
              </Box>

              {/* 라인 컬럼 */}
              <Box flex={1} overflowX="auto" overflowY="hidden" minH={0}>
                <Flex gap={3} align="stretch" width="max-content" h="100%">
                  {lines.map((line) => (
                    <LineColumn key={line.line_name} line={line} />
                  ))}
                </Flex>
              </Box>
            </>
          )}
        </Flex>
      </Box>
    </>
  );
}
