import { useMemo } from "react";
import {
  Box,
  Divider,
  Flex,
  Grid,
  Heading,
  HStack,
  Skeleton,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  StatArrow,
  Text,
  useColorModeValue,
  Badge,
  Button
} from "@chakra-ui/react";
import { Helmet } from "react-helmet";
import { Link as RouterLink } from "react-router-dom";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  AreaChart,
  Area
} from "recharts";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { FaBoxOpen, FaClipboardCheck, FaArrowRight } from "react-icons/fa";
import { StatusBadge } from "../components/StatusBadge";
import {
  getEpDailyOutputReport,
  getEpDailyInspectionReport
} from "../api";

// ── Mock Data (values only; labels via i18n in component) ─────────────────────

const MONTH_ROWS = [
  { monthKey: "oct", target: 12000, actual: 11200 },
  { monthKey: "nov", target: 13000, actual: 12800 },
  { monthKey: "dec", target: 11000, actual: 10500 },
  { monthKey: "jan", target: 14000, actual: 13600 },
  { monthKey: "feb", target: 13500, actual: 14100 },
  { monthKey: "mar", target: 15000, actual: 14750 }
];

const STATUS_DIST_ROWS = [
  { status: "completed" as const, value: 42 },
  { status: "in_progress" as const, value: 28 },
  { status: "not_started" as const, value: 18 },
  { status: "outsourced" as const, value: 8 },
  { status: "not_ready" as const, value: 4 }
];
const STATUS_COLORS = ["#48BB78", "#4299E1", "#A0AEC0", "#ED8936", "#FC8181"];

const LEAD_TIME_ROWS = [
  { weekN: 1, assembly: 8, process: 5 },
  { weekN: 2, assembly: 9, process: 6 },
  { weekN: 3, assembly: 7, process: 4 },
  { weekN: 4, assembly: 8, process: 5 },
  { weekN: 5, assembly: 6, process: 4 },
  { weekN: 6, assembly: 7, process: 3 }
];

const LINE_ROWS = [
  { lineN: 1, utilization: 87, target: 90 },
  { lineN: 2, utilization: 92, target: 90 },
  { lineN: 3, utilization: 78, target: 90 },
  { lineN: 4, utilization: 95, target: 90 },
  { lineN: 5, utilization: 83, target: 90 }
];

const DAILY_OUTPUT_TREND = [
  { day: "3/23", qty: 680 },
  { day: "3/24", qty: 720 },
  { day: "3/25", qty: 695 },
  { day: "3/26", qty: 750 },
  { day: "3/27", qty: 710 },
  { day: "3/28", qty: 760 },
  { day: "3/29", qty: 800 }
];

const TOP_SCHEDULES = [
  {
    sjPo: "SJ-2025-0421",
    buyer: "Salomon",
    progress: 94,
    total: 5000,
    output: 4700,
    status: "in_progress"
  },
  {
    sjPo: "SJ-2025-0398",
    buyer: "Arcteryx",
    progress: 100,
    total: 3200,
    output: 3200,
    status: "completed"
  },
  {
    sjPo: "SJ-2025-0412",
    buyer: "Patagonia",
    progress: 72,
    total: 8000,
    output: 5760,
    status: "in_progress"
  },
  {
    sjPo: "SJ-2025-0435",
    buyer: "Columbia",
    progress: 45,
    total: 4500,
    output: 2025,
    status: "in_progress"
  },
  {
    sjPo: "SJ-2025-0440",
    buyer: "Goluck",
    progress: 12,
    total: 6000,
    output: 720,
    status: "not_started"
  }
];

// ── Helpers ────────────────────────────────────────────────────────────────────

function localDateStr(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function defectRateAccent(rate: number): string {
  if (rate === 0) return "green.500";
  if (rate < 2) return "teal.500";
  if (rate < 5) return "orange.500";
  return "red.500";
}

// ── Today KPI mini card ────────────────────────────────────────────────────────

function MiniKpiCard({
  label,
  value,
  accent,
  isLoading
}: {
  label: string;
  value: string;
  accent: string;
  isLoading: boolean;
}) {
  const labelColor = useColorModeValue("gray.500", "gray.400");
  return (
    <Box borderLeft="3px solid" borderLeftColor={accent} pl={3} py={1}>
      <Text
        fontSize="10px"
        color={labelColor}
        fontWeight="semibold"
        textTransform="uppercase"
        letterSpacing="wide"
        noOfLines={1}
      >
        {label}
      </Text>
      {isLoading ? (
        <Skeleton h="22px" w="56px" mt={1} borderRadius="md" />
      ) : (
        <Text fontSize="lg" fontWeight="extrabold" color={accent} lineHeight="1.3">
          {value}
        </Text>
      )}
    </Box>
  );
}

// ── Today Report Section ───────────────────────────────────────────────────────

function TodayReportSection() {
  const { t } = useTranslation();
  const cardBg = useColorModeValue("white", "gray.800");
  const border = useColorModeValue("gray.100", "gray.700");
  const subBg = useColorModeValue("gray.50", "gray.750");
  const dividerColor = useColorModeValue("gray.200", "gray.600");
  const sectionLabelColor = useColorModeValue("gray.600", "gray.300");

  const today = localDateStr();

  const { data: outputData, isLoading: outputLoading } = useQuery({
    queryKey: ["ep-daily-output-report-dashboard", today],
    queryFn: () => getEpDailyOutputReport(today),
    staleTime: 5 * 60 * 1000
  });

  const { data: inspData, isLoading: inspLoading } = useQuery({
    queryKey: ["ep-daily-inspection-report-dashboard", today],
    queryFn: () => getEpDailyInspectionReport(today),
    staleTime: 5 * 60 * 1000
  });

  const okpi = outputData?.kpi;
  const ikpi = inspData?.kpi;
  const defectRate = ikpi?.defect_rate ?? 0;
  const rateAccent = defectRateAccent(defectRate);

  const peakOutputLabel =
    okpi?.peak_hour != null
      ? `${String(okpi.peak_hour).padStart(2, "0")}:00`
      : "—";
  const peakInspLabel =
    ikpi?.peak_hour != null
      ? `${String(ikpi.peak_hour).padStart(2, "0")}:00`
      : "—";

  return (
    <Box
      bg={cardBg}
      border="1px solid"
      borderColor={border}
      borderRadius="xl"
      shadow="sm"
      mb={6}
      overflow="hidden"
    >
      {/* Section header */}
      <Flex
        align="center"
        justify="space-between"
        px={5}
        py={3}
        bg={subBg}
        borderBottom="1px solid"
        borderColor={border}
      >
        <HStack spacing={2}>
          <Text fontSize="sm" fontWeight="bold" color={sectionLabelColor}>
            {t("ep.dashboard.todaySectionTitle")}
          </Text>
          <Badge colorScheme="green" fontSize="9px" px={2} borderRadius="full">
            {today}
          </Badge>
        </HStack>
      </Flex>

      <Grid templateColumns={{ base: "1fr", md: "1fr auto 1fr" }} gap={0}>
        {/* Output block */}
        <Box px={5} py={4}>
          <Flex align="center" justify="space-between" mb={4}>
            <HStack spacing={2}>
              <Box color="teal.400">
                <FaBoxOpen size={13} />
              </Box>
              <Text fontSize="xs" fontWeight="bold" color="teal.500" textTransform="uppercase" letterSpacing="wide">
                {t("ep.dashboard.outputSectionLabel")}
              </Text>
            </HStack>
            <Button
              as={RouterLink}
              to="/ep-production/daily-output-report"
              size="xs"
              variant="ghost"
              colorScheme="teal"
              rightIcon={<FaArrowRight size={9} />}
              fontSize="xs"
            >
              {t("ep.dashboard.viewReport")}
            </Button>
          </Flex>
          <Grid templateColumns="repeat(2, 1fr)" gap={4}>
            <MiniKpiCard
              label={t("epDailyReport.kpi.totalQty")}
              value={(okpi?.total_qty_today ?? 0).toLocaleString()}
              accent="teal.500"
              isLoading={outputLoading}
            />
            <MiniKpiCard
              label={t("epDailyReport.kpi.activeStyles")}
              value={String(okpi?.active_styles_count ?? 0)}
              accent="blue.400"
              isLoading={outputLoading}
            />
            <MiniKpiCard
              label={t("epDailyReport.kpi.activeWorkers")}
              value={String(okpi?.active_workers_count ?? 0)}
              accent="purple.400"
              isLoading={outputLoading}
            />
            <MiniKpiCard
              label={t("epDailyReport.kpi.peakHour")}
              value={peakOutputLabel}
              accent="orange.400"
              isLoading={outputLoading}
            />
          </Grid>
        </Box>

        {/* Divider */}
        <Flex align="stretch" justify="center" py={4}>
          <Divider orientation="vertical" borderColor={dividerColor} />
        </Flex>

        {/* Inspection block */}
        <Box px={5} py={4}>
          <Flex align="center" justify="space-between" mb={4}>
            <HStack spacing={2}>
              <Box color="red.400">
                <FaClipboardCheck size={13} />
              </Box>
              <Text fontSize="xs" fontWeight="bold" color="red.500" textTransform="uppercase" letterSpacing="wide">
                {t("ep.dashboard.inspectionSectionLabel")}
              </Text>
            </HStack>
            <Button
              as={RouterLink}
              to="/ep-production/daily-inspection-report"
              size="xs"
              variant="ghost"
              colorScheme="red"
              rightIcon={<FaArrowRight size={9} />}
              fontSize="xs"
            >
              {t("ep.dashboard.viewReport")}
            </Button>
          </Flex>
          <Grid templateColumns="repeat(2, 1fr)" gap={4}>
            <MiniKpiCard
              label={t("epDailyInspectionReport.kpi.totalInspected")}
              value={(ikpi?.total_inspected_qty ?? 0).toLocaleString()}
              accent="blue.500"
              isLoading={inspLoading}
            />
            <MiniKpiCard
              label={t("epDailyInspectionReport.kpi.totalDefect")}
              value={(ikpi?.total_defect_qty ?? 0).toLocaleString()}
              accent="red.400"
              isLoading={inspLoading}
            />
            <MiniKpiCard
              label={t("epDailyInspectionReport.kpi.defectRate")}
              value={`${(defectRate).toFixed(1)}%`}
              accent={rateAccent}
              isLoading={inspLoading}
            />
            <MiniKpiCard
              label={t("epDailyInspectionReport.kpi.activeInspectors")}
              value={String(ikpi?.active_inspectors_count ?? 0)}
              accent="purple.400"
              isLoading={inspLoading}
            />
            <MiniKpiCard
              label={t("epDailyInspectionReport.kpi.peakHour")}
              value={peakInspLabel}
              accent="orange.400"
              isLoading={inspLoading}
            />
            <MiniKpiCard
              label={t("epDailyInspectionReport.kpi.recordCount")}
              value={String(ikpi?.record_count ?? 0)}
              accent="gray.400"
              isLoading={inspLoading}
            />
          </Grid>
        </Box>
      </Grid>
    </Box>
  );
}

// ── Components ─────────────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  helpText,
  increase,
  accent
}: {
  label: string;
  value: string;
  helpText: string;
  increase?: boolean;
  accent?: string;
}) {
  const cardBg = useColorModeValue("white", "gray.800");
  const border = useColorModeValue("gray.100", "gray.700");
  return (
    <Box
      bg={cardBg}
      borderRadius="xl"
      border="1px solid"
      borderColor={border}
      p={5}
      shadow="sm"
    >
      <Stat>
        <StatLabel
          fontSize="xs"
          color="gray.500"
          fontWeight="semibold"
          textTransform="uppercase"
          letterSpacing="wide"
        >
          {label}
        </StatLabel>
        <StatNumber
          fontSize="2xl"
          fontWeight="bold"
          color={accent ?? undefined}
        >
          {value}
        </StatNumber>
        <StatHelpText mb={0}>
          {increase !== undefined && (
            <StatArrow type={increase ? "increase" : "decrease"} />
          )}
          {helpText}
        </StatHelpText>
      </Stat>
    </Box>
  );
}

function ChartCard({
  title,
  children
}: {
  title: string;
  children: React.ReactNode;
}) {
  const cardBg = useColorModeValue("white", "gray.800");
  const border = useColorModeValue("gray.100", "gray.700");
  const titleColor = useColorModeValue("gray.700", "gray.200");
  return (
    <Box
      bg={cardBg}
      borderRadius="xl"
      border="1px solid"
      borderColor={border}
      p={5}
      shadow="sm"
    >
      <Text fontWeight="semibold" fontSize="sm" color={titleColor} mb={4}>
        {title}
      </Text>
      {children}
    </Box>
  );
}

function dateLocaleForI18n(lang: string | undefined): string {
  const base = lang?.split("-")[0] ?? "en";
  if (base === "ko") return "ko-KR";
  if (base === "vi") return "vi-VN";
  return "en-GB";
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function EpDashboard() {
  const pageBg = useColorModeValue("gray.50", "gray.900");
  const gridLine = useColorModeValue("#E2E8F0", "#2D3748");
  const textColor = useColorModeValue("#4A5568", "#CBD5E0");
  const { t, i18n } = useTranslation();

  const monthlyOutput = useMemo(
    () =>
      MONTH_ROWS.map((m) => ({
        month: t(`ep.dashboard.monthsShort.${m.monthKey}`),
        target: m.target,
        actual: m.actual
      })),
    [t]
  );

  const statusDist = useMemo(
    () =>
      STATUS_DIST_ROWS.map((d) => ({
        name: t(`ep.status.${d.status}`),
        value: d.value
      })),
    [t]
  );

  const leadTimeTrend = useMemo(
    () =>
      LEAD_TIME_ROWS.map((row) => ({
        week: t("ep.dashboard.weekLabel", { n: row.weekN }),
        assembly: row.assembly,
        process: row.process
      })),
    [t]
  );

  const lineUtilization = useMemo(
    () =>
      LINE_ROWS.map((row) => ({
        line: t("ep.dashboard.lineLabel", { n: row.lineN }),
        utilization: row.utilization,
        target: row.target
      })),
    [t]
  );

  const todayStr = useMemo(
    () =>
      new Date().toLocaleDateString(dateLocaleForI18n(i18n.language), {
        year: "numeric",
        month: "long",
        day: "numeric"
      }),
    [i18n.language]
  );

  const chartTarget = t("ep.dashboard.charts.target");
  const chartActual = t("ep.dashboard.charts.actual");
  const chartUtilization = t("ep.dashboard.charts.utilization");

  return (
    <>
      <Helmet>
        <title>{t("ep.dashboard.pageTitle")}</title>
      </Helmet>
      <Box
        bg={pageBg}
        minH="100vh"
        px={{ base: 4, md: 8, lg: 12 }}
        py={{ base: 6, md: 8 }}
      >
        {/* Header */}
        <Flex
          align="baseline"
          justify="space-between"
          mb={6}
          wrap="wrap"
          gap={2}
        >
          <Box>
            <Heading size="lg" fontWeight="bold">
              {t("ep.dashboard.heading")}
            </Heading>
            <Text fontSize="sm" color="gray.500" mt={0.5}>
              {t("ep.dashboard.subtitleRealtime")} — {todayStr}
            </Text>
          </Box>
          <Badge
            colorScheme="green"
            fontSize="xs"
            px={3}
            py={1}
            borderRadius="full"
          >
            {t("ep.dashboard.liveBadge")}
          </Badge>
        </Flex>

        {/* Today's real-data section */}
        <TodayReportSection />

        {/* KPI Cards */}
        <Grid
          templateColumns={{ base: "1fr 1fr", md: "repeat(4, 1fr)" }}
          gap={4}
          mb={6}
        >
          <KpiCard
            label={t("ep.dashboard.kpi.monthlyOutput")}
            value="14,750"
            helpText={t("ep.dashboard.kpi.monthlyOutputHelp")}
            increase={false}
            accent="blue.500"
          />
          <KpiCard
            label={t("ep.dashboard.kpi.achievementRate")}
            value="98.3%"
            helpText={t("ep.dashboard.kpi.achievementHelp")}
            increase={true}
            accent="green.500"
          />
          <KpiCard
            label={t("ep.dashboard.kpi.activeSchedules")}
            value="23"
            helpText={t("ep.dashboard.kpi.activeSchedulesHelp")}
          />
          <KpiCard
            label={t("ep.dashboard.kpi.avgLeadTime")}
            value="7.4 d"
            helpText={t("ep.dashboard.kpi.avgLeadTimeHelp")}
            increase={true}
            accent="teal.500"
          />
        </Grid>

        {/* Row 1: Monthly Output + Status Dist */}
        <Grid templateColumns={{ base: "1fr", lg: "2fr 1fr" }} gap={4} mb={4}>
          <ChartCard title={t("ep.dashboard.charts.monthlyOutputVsTarget")}>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart
                data={monthlyOutput}
                margin={{ top: 0, right: 10, left: -10, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke={gridLine} />
                <XAxis
                  dataKey="month"
                  tick={{ fill: textColor, fontSize: 11 }}
                />
                <YAxis tick={{ fill: textColor, fontSize: 11 }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar
                  dataKey="target"
                  name={chartTarget}
                  fill="#CBD5E0"
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  dataKey="actual"
                  name={chartActual}
                  fill="#4299E1"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title={t("ep.dashboard.charts.statusDistribution")}>
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie
                  data={statusDist}
                  cx="50%"
                  cy="45%"
                  innerRadius={55}
                  outerRadius={85}
                  paddingAngle={3}
                  dataKey="value"
                  nameKey="name"
                >
                  {statusDist.map((_, i) => (
                    <Cell key={i} fill={STATUS_COLORS[i]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(v) =>
                    t("ep.dashboard.charts.tooltipSchedules", {
                      count: Number(v ?? 0)
                    })
                  }
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>
        </Grid>

        {/* Row 2: Daily Output Trend + Line Utilization */}
        <Grid templateColumns={{ base: "1fr", lg: "1fr 1fr" }} gap={4} mb={4}>
          <ChartCard title={t("ep.dashboard.charts.dailyOutputTrend")}>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart
                data={DAILY_OUTPUT_TREND}
                margin={{ top: 0, right: 10, left: -10, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="outputGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#48BB78" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#48BB78" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={gridLine} />
                <XAxis dataKey="day" tick={{ fill: textColor, fontSize: 11 }} />
                <YAxis
                  tick={{ fill: textColor, fontSize: 11 }}
                  domain={[600, 850]}
                />
                <Tooltip />
                <Area
                  type="monotone"
                  dataKey="qty"
                  name={t("ep.dashboard.charts.outputPcs")}
                  stroke="#48BB78"
                  strokeWidth={2}
                  fill="url(#outputGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title={t("ep.dashboard.charts.lineUtilization")}>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart
                data={lineUtilization}
                layout="vertical"
                margin={{ top: 0, right: 20, left: 10, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke={gridLine}
                  horizontal={false}
                />
                <XAxis
                  type="number"
                  domain={[0, 100]}
                  tick={{ fill: textColor, fontSize: 11 }}
                  unit="%"
                />
                <YAxis
                  type="category"
                  dataKey="line"
                  tick={{ fill: textColor, fontSize: 11 }}
                  width={48}
                />
                <Tooltip formatter={(v) => `${v}%`} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar
                  dataKey="target"
                  name={chartTarget}
                  fill="#E2E8F0"
                  radius={[0, 4, 4, 0]}
                />
                <Bar
                  dataKey="utilization"
                  name={chartUtilization}
                  fill="#9F7AEA"
                  radius={[0, 4, 4, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </Grid>

        {/* Row 3: Lead Time Trend + Top Schedules */}
        <Grid templateColumns={{ base: "1fr", lg: "1fr 1fr" }} gap={4}>
          <ChartCard title={t("ep.dashboard.charts.leadTimeTrend")}>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart
                data={leadTimeTrend}
                margin={{ top: 0, right: 10, left: -10, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke={gridLine} />
                <XAxis
                  dataKey="week"
                  tick={{ fill: textColor, fontSize: 11 }}
                />
                <YAxis tick={{ fill: textColor, fontSize: 11 }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line
                  type="monotone"
                  dataKey="assembly"
                  name={t("ep.dashboard.charts.assembly")}
                  stroke="#4299E1"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
                <Line
                  type="monotone"
                  dataKey="process"
                  name={t("ep.dashboard.charts.process")}
                  stroke="#ED8936"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title={t("ep.dashboard.charts.topSchedules")}>
            <Box overflowX="auto">
              <Box as="table" width="100%" fontSize="xs">
                <Box as="thead">
                  <Box as="tr">
                    {[
                      t("ep.dashboard.table.sjPo"),
                      t("ep.dashboard.table.buyer"),
                      t("ep.dashboard.table.output"),
                      t("ep.dashboard.table.total"),
                      t("ep.dashboard.table.progress"),
                      t("ep.dashboard.table.status")
                    ].map((h) => (
                      <Box
                        as="th"
                        key={h}
                        textAlign="left"
                        pb={2}
                        pr={3}
                        color="gray.400"
                        fontWeight="semibold"
                        whiteSpace="nowrap"
                      >
                        {h}
                      </Box>
                    ))}
                  </Box>
                </Box>
                <Box as="tbody">
                  {TOP_SCHEDULES.map((row, i) => (
                    <Box as="tr" key={i}>
                      <Box
                        as="td"
                        pb={2}
                        pr={3}
                        fontWeight="medium"
                        whiteSpace="nowrap"
                      >
                        {row.sjPo}
                      </Box>
                      <Box as="td" pb={2} pr={3} whiteSpace="nowrap">
                        {row.buyer}
                      </Box>
                      <Box as="td" pb={2} pr={3}>
                        {row.output.toLocaleString()}
                      </Box>
                      <Box as="td" pb={2} pr={3}>
                        {row.total.toLocaleString()}
                      </Box>
                      <Box as="td" pb={2} pr={3}>
                        <HStack spacing={1}>
                          <Box
                            w="60px"
                            h="6px"
                            borderRadius="full"
                            bg="gray.200"
                            overflow="hidden"
                          >
                            <Box
                              h="100%"
                              borderRadius="full"
                              w={`${row.progress}%`}
                              bg={
                                row.progress === 100
                                  ? "green.400"
                                  : row.progress >= 70
                                    ? "blue.400"
                                    : "orange.400"
                              }
                            />
                          </Box>
                          <Text>{row.progress}%</Text>
                        </HStack>
                      </Box>
                      <Box as="td" pb={2}>
                        <StatusBadge status={row.status} fontSize="9px">
                          {t(`ep.status.${row.status}`)}
                        </StatusBadge>
                      </Box>
                    </Box>
                  ))}
                </Box>
              </Box>
            </Box>
          </ChartCard>
        </Grid>
      </Box>
    </>
  );
}
