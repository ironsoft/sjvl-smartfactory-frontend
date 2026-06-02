import { useEffect, useState } from "react";
import {
  Badge,
  Box,
  Center,
  Collapse,
  Flex,
  Grid,
  Heading,
  HStack,
  IconButton,
  Progress,
  Spinner,
  Stat,
  StatHelpText,
  StatLabel,
  StatNumber,
  Table,
  TableContainer,
  Tag,
  TagLabel,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
  useColorModeValue,
  VStack
} from "@chakra-ui/react";
import { Helmet } from "react-helmet";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  FaBoxes,
  FaCalendarDay,
  FaChevronDown,
  FaChevronLeft,
  FaChevronRight,
  FaChevronUp,
  FaClock,
  FaListAlt,
  FaTags,
  FaUser
} from "react-icons/fa";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis
} from "recharts";
import {
  getEpDailyOutputReport,
  IEpDailyOutputReportStyleRow,
  IEpDailyOutputReportWorkerRow
} from "../api";

// ── Constants ──────────────────────────────────────────────────────────────────

const WORKER_COLORS = [
  "#4299E1",
  "#48BB78",
  "#ED8936",
  "#9F7AEA",
  "#F56565",
  "#38B2AC",
  "#ECC94B",
  "#FC8181",
  "#667EEA",
  "#68D391"
];

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Local-date YYYY-MM-DD string (avoids UTC-offset bugs with toISOString) */
function localDateStr(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function todayStr(): string {
  return localDateStr(new Date());
}

function shiftDay(dateStr: string, delta: number): string {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + delta);
  return localDateStr(d);
}

// ── Animated counter hook ──────────────────────────────────────────────────────

function useCountUp(target: number, duration = 700): number {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (target === 0) {
      setValue(0);
      return;
    }
    setValue(0);
    const steps = 24;
    const interval = duration / steps;
    let step = 0;
    const timer = setInterval(() => {
      step += 1;
      const progress = step / steps;
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(step >= steps ? target : Math.floor(eased * target));
      if (step >= steps) clearInterval(timer);
    }, interval);
    return () => clearInterval(timer);
  }, [target, duration]);
  return value;
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function KpiCard({
  icon,
  label,
  value,
  subLabel,
  accent,
  animatedValue
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  subLabel?: string;
  accent: string;
  animatedValue?: number;
}) {
  const cardBg = useColorModeValue("white", "gray.800");
  const border = useColorModeValue("gray.100", "gray.700");
  const labelColor = useColorModeValue("gray.500", "gray.400");
  const displayed =
    animatedValue !== undefined ? animatedValue.toLocaleString() : value;

  return (
    <Box
      bg={cardBg}
      borderRadius="xl"
      border="1px solid"
      borderColor={border}
      borderLeft="4px solid"
      borderLeftColor={accent}
      p={5}
      shadow="sm"
      position="relative"
      overflow="hidden"
      transition="box-shadow 0.15s"
      _hover={{ shadow: "md" }}
    >
      {/* Background icon watermark */}
      <Box
        position="absolute"
        bottom={2}
        right={3}
        fontSize="4xl"
        opacity={0.07}
        color={accent}
        pointerEvents="none"
      >
        {icon}
      </Box>
      <Stat>
        <StatLabel
          fontSize="xs"
          color={labelColor}
          fontWeight="semibold"
          textTransform="uppercase"
          letterSpacing="wide"
        >
          {label}
        </StatLabel>
        <StatNumber fontSize="2xl" fontWeight="extrabold" color={accent}>
          {displayed}
        </StatNumber>
        {subLabel && (
          <StatHelpText mb={0} fontSize="xs" noOfLines={1}>
            {subLabel}
          </StatHelpText>
        )}
      </Stat>
    </Box>
  );
}

function StyleRow({
  row,
  maxQty,
  rank
}: {
  row: IEpDailyOutputReportStyleRow;
  maxQty: number;
  rank: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const cardBg = useColorModeValue("white", "gray.800");
  const border = useColorModeValue("gray.100", "gray.700");
  const subBg = useColorModeValue("gray.50", "gray.750");
  const hoverBg = useColorModeValue("gray.50", "gray.700");
  const { t } = useTranslation();

  const rankColor =
    rank === 1
      ? "yellow.400"
      : rank === 2
      ? "gray.400"
      : rank === 3
      ? "orange.400"
      : "gray.300";
  const progressScheme =
    rank === 1 ? "yellow" : rank === 2 ? "gray" : rank === 3 ? "orange" : "teal";
  const pct = maxQty > 0 ? (row.qty_today / maxQty) * 100 : 0;

  return (
    <Box
      bg={cardBg}
      border="1px solid"
      borderColor={border}
      borderRadius="xl"
      mb={3}
      overflow="hidden"
      shadow="sm"
      transition="box-shadow 0.15s"
      _hover={{ shadow: "md" }}
    >
      {/* Clickable header */}
      <Flex
        align="center"
        px={4}
        pt={4}
        pb={3}
        gap={3}
        cursor="pointer"
        _hover={{ bg: hoverBg }}
        onClick={() => setExpanded((e) => !e)}
        transition="background 0.1s"
      >
        {/* Rank badge */}
        <Flex
          w={7}
          h={7}
          borderRadius="full"
          bg={rankColor}
          align="center"
          justify="center"
          flexShrink={0}
        >
          <Text fontSize="xs" fontWeight="bold" color="white">
            {rank}
          </Text>
        </Flex>

        {/* Style info */}
        <Box flex={1} minW={0}>
          <HStack mb={1} flexWrap="wrap" spacing={2}>
            <Text fontWeight="bold" fontSize="sm" noOfLines={1}>
              {row.sj_po_number}
            </Text>
            {row.style_code && (
              <Badge colorScheme="purple" fontSize="xs" flexShrink={0}>
                {row.style_code}
              </Badge>
            )}
            {row.style_name && (
              <Text fontSize="xs" color="gray.500" noOfLines={1}>
                {row.style_name}
              </Text>
            )}
          </HStack>
          <HStack spacing={1} flexWrap="wrap">
            {row.sj_nos.map((s) => (
              <Tag key={s} size="sm" colorScheme="blue" variant="subtle">
                <TagLabel>{s}</TagLabel>
              </Tag>
            ))}
          </HStack>
        </Box>

        {/* Qty + pct */}
        <VStack align="flex-end" spacing={0} flexShrink={0} minW="80px">
          <Text fontWeight="extrabold" fontSize="xl" color="teal.400" lineHeight="1.1">
            {row.qty_today.toLocaleString()}
          </Text>
          <Text fontSize="xs" color="gray.400">
            {pct.toFixed(0)}% · {row.record_count}{t("epDailyReport.unitRecord")}
          </Text>
        </VStack>

        {/* Expand chevron */}
        <Box color="gray.400" flexShrink={0}>
          {expanded ? <FaChevronUp size={12} /> : <FaChevronDown size={12} />}
        </Box>
      </Flex>

      {/* Progress bar */}
      <Progress
        value={pct}
        size="xs"
        colorScheme={progressScheme}
        borderRadius={0}
      />

      {/* Expandable detail */}
      <Collapse in={expanded} animateOpacity>
        <Box bg={subBg} px={4} py={3}>
          {row.worker_names.length > 0 && (
            <HStack mb={3} spacing={2} flexWrap="wrap">
              <Box color="gray.400" mt="1px">
                <FaUser size={11} />
              </Box>
              {row.worker_names.map((w) => (
                <Badge key={w} colorScheme="green" variant="subtle" fontSize="xs">
                  {w}
                </Badge>
              ))}
            </HStack>
          )}
          <TableContainer>
            <Table size="sm" variant="simple">
              <Thead>
                <Tr>
                  <Th fontSize="xs">{t("epDailyReport.colProcessCode")}</Th>
                  <Th fontSize="xs">{t("epDailyReport.colProcessName")}</Th>
                  <Th isNumeric fontSize="xs">{t("epDailyReport.qty")}</Th>
                </Tr>
              </Thead>
              <Tbody>
                {row.processes.map((p) => (
                  <Tr key={p.process_code}>
                    <Td fontSize="xs">{p.process_code}</Td>
                    <Td fontSize="xs">{p.process_name}</Td>
                    <Td isNumeric fontSize="xs" fontWeight="bold">
                      {p.qty_today.toLocaleString()}
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </TableContainer>
        </Box>
      </Collapse>
    </Box>
  );
}

// Custom donut center label rendered as overlay
function WorkerDonutChart({
  data,
  totalQty
}: {
  data: IEpDailyOutputReportWorkerRow[];
  totalQty: number;
}) {
  const cardBg = useColorModeValue("white", "gray.800");
  const border = useColorModeValue("gray.100", "gray.700");
  const tooltipBg = useColorModeValue("#FFFFFF", "#1A202C");
  const gridLine = useColorModeValue("#E2E8F0", "#2D3748");
  const textColor = useColorModeValue("gray.700", "gray.200");
  const subTextColor = useColorModeValue("gray.500", "gray.400");

  const { t } = useTranslation();
  const top8 = data.slice(0, 8);

  return (
    <Box
      bg={cardBg}
      border="1px solid"
      borderColor={border}
      borderRadius="xl"
      p={5}
      shadow="sm"
    >
      <Text
        fontWeight="semibold"
        fontSize="xs"
        color={subTextColor}
        textTransform="uppercase"
        letterSpacing="widest"
        mb={4}
      >
        {t("epDailyReport.workerTitle")}
      </Text>

      {top8.length === 0 ? (
        <Center h="160px">
          <Text fontSize="sm" color="gray.400">
            {t("epDailyReport.noData")}
          </Text>
        </Center>
      ) : (
        <>
          {/* Donut chart */}
          <Box position="relative" mb={4}>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie
                  data={top8}
                  cx="50%"
                  cy="50%"
                  innerRadius={52}
                  outerRadius={75}
                  dataKey="qty"
                  paddingAngle={2}
                  startAngle={90}
                  endAngle={-270}
                >
                  {top8.map((_, idx) => (
                    <Cell
                      key={`w-${idx}`}
                      fill={WORKER_COLORS[idx % WORKER_COLORS.length]}
                    />
                  ))}
                </Pie>
                <RechartsTooltip
                  contentStyle={{
                    background: tooltipBg,
                    border: `1px solid ${gridLine}`,
                    borderRadius: "8px",
                    fontSize: "12px"
                  }}
                  formatter={(v: unknown, _name: unknown, entry: { payload?: { worker_name?: string } }) => [
                    `${(v as number).toLocaleString()} (${totalQty > 0 ? ((v as number / totalQty) * 100).toFixed(1) : 0}%)`,
                    entry?.payload?.worker_name ?? ""
                  ]}
                />
              </PieChart>
            </ResponsiveContainer>
            {/* Center overlay */}
            <Box
              position="absolute"
              top="50%"
              left="50%"
              transform="translate(-50%, -50%)"
              textAlign="center"
              pointerEvents="none"
            >
              <Text fontSize="lg" fontWeight="extrabold" color={textColor} lineHeight="1">
                {totalQty.toLocaleString()}
              </Text>
              <Text fontSize="9px" color={subTextColor} textTransform="uppercase" letterSpacing="wide">
                {t("epDailyReport.qty")}
              </Text>
            </Box>
          </Box>

          {/* Legend */}
          <VStack align="stretch" spacing={2}>
            {top8.map((w, idx) => (
              <Flex key={w.worker_name} align="center" gap={2}>
                <Box
                  w={3}
                  h={3}
                  borderRadius="sm"
                  bg={WORKER_COLORS[idx % WORKER_COLORS.length]}
                  flexShrink={0}
                />
                <Text fontSize="xs" flex={1} noOfLines={1} color={textColor}>
                  {w.worker_name}
                </Text>
                <Text fontSize="xs" fontWeight="bold" color={textColor} flexShrink={0}>
                  {w.qty.toLocaleString()}
                </Text>
                <Text fontSize="xs" color={subTextColor} flexShrink={0} minW="36px" textAlign="right">
                  {totalQty > 0 ? ((w.qty / totalQty) * 100).toFixed(1) : 0}%
                </Text>
              </Flex>
            ))}
          </VStack>
        </>
      )}
    </Box>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function EpDailyOutputReport() {
  const today = todayStr();
  const [selectedDate, setSelectedDate] = useState(today);
  const { t } = useTranslation();

  const pageBg = useColorModeValue("gray.50", "gray.900");
  const cardBg = useColorModeValue("white", "gray.800");
  const border = useColorModeValue("gray.100", "gray.700");
  const gridLine = useColorModeValue("#E2E8F0", "#2D3748");
  const tickColor = useColorModeValue("#718096", "#A0AEC0");
  const tooltipBg = useColorModeValue("#FFFFFF", "#1A202C");

  const { data, isLoading } = useQuery({
    queryKey: ["ep-daily-output-report", selectedDate],
    queryFn: () => getEpDailyOutputReport(selectedDate)
  });

  // Animated counters (reset when data changes)
  const animTotalQty = useCountUp(data?.kpi.total_qty_today ?? 0);
  const animRecordCount = useCountUp(data?.kpi.record_count ?? 0);
  const animStyles = useCountUp(data?.kpi.active_styles_count ?? 0);
  const animSchedules = useCountUp(data?.kpi.active_schedules_count ?? 0);
  const animWorkers = useCountUp(data?.kpi.active_workers_count ?? 0);

  const maxStyleQty =
    data && data.by_style.length > 0
      ? Math.max(...data.by_style.map((s) => s.qty_today))
      : 1;

  const isToday = selectedDate === today;
  // Prevent navigating into the future
  const isAtOrAfterToday = selectedDate >= today;

  return (
    <Box minH="100vh" bg={pageBg} px={{ base: 4, md: 8 }} py={6}>
      <Helmet>
        <title>EP Daily Output Report | Sungjin MES</title>
      </Helmet>

      {/* ── Page Header ──────────────────────────────────────────── */}
      <Flex justify="space-between" align="center" mb={6} flexWrap="wrap" gap={4}>
        <Box>
          <Heading size="lg" letterSpacing="tight">
            {t("epDailyReport.title")}
          </Heading>
          <Text fontSize="sm" color="gray.500" mt={1}>
            {t("epDailyReport.subtitle")}
          </Text>
        </Box>

        {/* Date Navigator */}
        <HStack
          bg={cardBg}
          border="1px solid"
          borderColor={border}
          borderRadius="xl"
          p={2}
          shadow="sm"
          spacing={1}
        >
          <IconButton
            aria-label="Previous day"
            icon={<FaChevronLeft />}
            size="sm"
            variant="ghost"
            onClick={() => setSelectedDate((d) => shiftDay(d, -1))}
          />
          <VStack spacing={0} minW="120px" textAlign="center" px={2}>
            <Text fontWeight="bold" fontSize="sm">
              {selectedDate}
            </Text>
            {isToday && (
              <Badge colorScheme="green" fontSize="2xs">
                {t("epDailyReport.today")}
              </Badge>
            )}
          </VStack>
          <IconButton
            aria-label="Next day"
            icon={<FaChevronRight />}
            size="sm"
            variant="ghost"
            isDisabled={isAtOrAfterToday}
            onClick={() => setSelectedDate((d) => shiftDay(d, 1))}
          />
        </HStack>
      </Flex>

      {/* ── Loading / Empty ──────────────────────────────────────── */}
      {isLoading ? (
        <Center minH="40vh">
          <Spinner size="xl" color="teal.400" thickness="4px" />
        </Center>
      ) : !data ? (
        <Center minH="40vh">
          <Text color="gray.400">{t("epDailyReport.noData")}</Text>
        </Center>
      ) : (
        <>
          {/* ── KPI Cards ─────────────────────────────────────────── */}
          <Grid
            templateColumns={{
              base: "repeat(2, 1fr)",
              md: "repeat(3, 1fr)",
              xl: "repeat(6, 1fr)"
            }}
            gap={4}
            mb={8}
          >
            <KpiCard
              icon={<FaBoxes />}
              label={t("epDailyReport.kpi.totalQty")}
              value={data.kpi.total_qty_today.toLocaleString()}
              animatedValue={animTotalQty}
              subLabel={t("epDailyReport.kpi.totalQtySub")}
              accent="teal.400"
            />
            <KpiCard
              icon={<FaListAlt />}
              label={t("epDailyReport.kpi.recordCount")}
              value={data.kpi.record_count}
              animatedValue={animRecordCount}
              subLabel={t("epDailyReport.kpi.recordCountSub")}
              accent="blue.400"
            />
            <KpiCard
              icon={<FaTags />}
              label={t("epDailyReport.kpi.activeStyles")}
              value={data.kpi.active_styles_count}
              animatedValue={animStyles}
              subLabel={t("epDailyReport.kpi.activeStylesSub")}
              accent="purple.400"
            />
            <KpiCard
              icon={<FaCalendarDay />}
              label={t("epDailyReport.kpi.activeSchedules")}
              value={data.kpi.active_schedules_count}
              animatedValue={animSchedules}
              subLabel={t("epDailyReport.kpi.activeSchedulesSub")}
              accent="orange.400"
            />
            <KpiCard
              icon={<FaUser />}
              label={t("epDailyReport.kpi.activeWorkers")}
              value={data.kpi.active_workers_count}
              animatedValue={animWorkers}
              subLabel={data.kpi.top_worker_name ?? "-"}
              accent="green.400"
            />
            <KpiCard
              icon={<FaClock />}
              label={t("epDailyReport.kpi.peakHour")}
              value={
                data.kpi.peak_hour != null
                  ? `${String(data.kpi.peak_hour).padStart(2, "0")}:00`
                  : "-"
              }
              subLabel={t("epDailyReport.kpi.peakHourSub")}
              accent="red.400"
            />
          </Grid>

          {/* ── Main Section ──────────────────────────────────────── */}
          <Grid
            templateColumns={{ base: "1fr", lg: "1fr 360px" }}
            gap={6}
            alignItems="flex-start"
          >
            {/* ── Left: Style Summary ───────────────────────────── */}
            <Box>
              <Text
                fontWeight="semibold"
                fontSize="xs"
                color="gray.500"
                textTransform="uppercase"
                letterSpacing="widest"
                mb={4}
              >
                {t("epDailyReport.byStyleTitle")}
              </Text>
              {data.by_style.length === 0 ? (
                <Center
                  p={16}
                  bg={cardBg}
                  borderRadius="xl"
                  border="1px solid"
                  borderColor={border}
                >
                  <Text color="gray.400">{t("epDailyReport.noData")}</Text>
                </Center>
              ) : (
                data.by_style.map((row, idx) => (
                  <StyleRow
                    key={row.schedule_pk}
                    row={row}
                    maxQty={maxStyleQty}
                    rank={idx + 1}
                  />
                ))
              )}
            </Box>

            {/* ── Right: Hourly + Worker charts (sticky) ─────────── */}
            <VStack
              spacing={5}
              align="stretch"
              position={{ lg: "sticky" }}
              top={{ lg: "80px" }}
            >
              {/* Hourly bar chart */}
              <Box
                bg={cardBg}
                border="1px solid"
                borderColor={border}
                borderRadius="xl"
                p={5}
                shadow="sm"
              >
                <Text
                  fontWeight="semibold"
                  fontSize="xs"
                  color="gray.500"
                  textTransform="uppercase"
                  letterSpacing="widest"
                  mb={5}
                >
                  {t("epDailyReport.hourlyTitle")}
                </Text>
                {data.hourly_breakdown.length === 0 ? (
                  <Center h="160px">
                    <Text color="gray.400" fontSize="sm">
                      {t("epDailyReport.noData")}
                    </Text>
                  </Center>
                ) : (
                  <>
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart
                        data={data.hourly_breakdown}
                        margin={{ top: 4, right: 4, left: -16, bottom: 0 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke={gridLine} />
                        <XAxis
                          dataKey="hour_label"
                          tick={{ fontSize: 10, fill: tickColor }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <YAxis
                          tick={{ fontSize: 10, fill: tickColor }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <RechartsTooltip
                          contentStyle={{
                            background: tooltipBg,
                            border: `1px solid ${gridLine}`,
                            borderRadius: "8px",
                            fontSize: "12px"
                          }}
                          formatter={(v: unknown) => [
                            (v as number).toLocaleString(),
                            t("epDailyReport.qty")
                          ]}
                        />
                        <Bar dataKey="qty" radius={[4, 4, 0, 0]}>
                          {data.hourly_breakdown.map((entry, idx) => (
                            <Cell
                              key={`cell-${idx}`}
                              fill={
                                entry.hour === data.kpi.peak_hour
                                  ? "#38B2AC"
                                  : "#4299E1"
                              }
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                    {data.kpi.peak_hour != null && (
                      <HStack mt={2} spacing={4} justify="center">
                        <HStack spacing={1}>
                          <Box w={3} h={3} borderRadius="sm" bg="teal.400" />
                          <Text fontSize="xs" color="gray.500">
                            {t("epDailyReport.peak")}
                          </Text>
                        </HStack>
                        <HStack spacing={1}>
                          <Box w={3} h={3} borderRadius="sm" bg="blue.400" />
                          <Text fontSize="xs" color="gray.500">
                            {t("epDailyReport.other")}
                          </Text>
                        </HStack>
                      </HStack>
                    )}
                  </>
                )}
              </Box>

              {/* Worker donut chart */}
              <WorkerDonutChart
                data={data.by_worker}
                totalQty={data.kpi.total_qty_today}
              />
            </VStack>
          </Grid>
        </>
      )}
    </Box>
  );
}
