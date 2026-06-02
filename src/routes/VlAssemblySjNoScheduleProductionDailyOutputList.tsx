import {
  Box,
  Button,
  Center,
  FormControl,
  FormLabel,
  Heading,
  HStack,
  IconButton,
  Image,
  Skeleton,
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
  useColorModeValue,
  Divider,
} from "@chakra-ui/react";
import { useQuery } from "@tanstack/react-query";
import { Helmet } from "react-helmet";
import { Link as RouterLink, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  getVlAssemblySjNoDetail,
  getVlAssemblyScheduleProductionDailyOutputs,
  getVlAssemblyScheduleDetail,
  getVlPlanHolidays,
  getSjStylePhotos,
} from "../api";
import { FaArrowLeft, FaChevronLeft, FaChevronRight } from "react-icons/fa";
import LocalizedDateInput from "../components/LocalizedDateInput";
import PhotoModal from "../components/PhotoModal";
import SearchInput from "../components/SearchInput";
import {
  enumerateYmdsInclusive,
  formatAchievementPct,
  getAssemblyDailyPlannedQtyFromTotal,
  plannedQtyForCalendarDay,
  plannedQtyPerPlanHour,
  parseLocalMidnightFromIso,
  ymdFromLocalDate,
} from "../lib/vlAssemblyAssemblyDailyPlan";

export default function VlAssemblySjNoScheduleProductionDailyOutputList() {
  const { sjNoId } = useParams<{ sjNoId: string }>();
  const sjPk = Number(sjNoId);
  const { t } = useTranslation();
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [photoModalUrl, setPhotoModalUrl] = useState<string | undefined>();

  const pageBg = useColorModeValue("gray.50", "gray.900");
  const cardBg = useColorModeValue("white", "gray.800");
  const border = useColorModeValue("gray.200", "gray.600");
  const rowHoverBg = useColorModeValue("gray.50", "gray.700");
  const analyticsSubColor = useColorModeValue("gray.500", "gray.400");
  const chartGridStroke = useColorModeValue("#e2e8f0", "#4a5568");
  const chartTooltipBg = useColorModeValue("#ffffff", "#2d3748");
  const chartBarFill = useColorModeValue("#3182CE", "#63B3ED");
  const chartLineStroke = useColorModeValue("#2F855A", "#68D391");

  const { data: sj, isLoading: sjLoading } = useQuery({
    queryKey: ["epSjNoDetail", sjPk],
    queryFn: () => getVlAssemblySjNoDetail(sjPk),
    enabled: Number.isFinite(sjPk) && sjPk > 0,
  });

  const schedulePk = sj?.ep_schedule_pk ?? undefined;

  const { data: schedule } = useQuery({
    queryKey: ["epSchedule", schedulePk],
    queryFn: () => getVlAssemblyScheduleDetail(schedulePk!),
    enabled: schedulePk != null && schedulePk > 0,
  });

  const stylePk = schedule?.sj_order_info?.sj_style?.pk;
  const styleThumb =
    schedule?.sj_order_info?.sj_style?.thumbnail ?? null;
  const styleLabel =
    schedule?.sj_order_info?.sj_style?.style_name ??
    schedule?.sj_order_info?.style_name ??
    null;

  const { data: stylePhotos = [], isLoading: stylePhotosLoading } = useQuery({
    queryKey: ["sjStylePhotos", stylePk],
    queryFn: () => getSjStylePhotos(stylePk!),
    enabled: typeof stylePk === "number" && stylePk > 0,
    staleTime: 60_000,
  });

  const stylePhotoSrc = useMemo(() => {
    if (stylePhotos.length > 0) return stylePhotos[0]!.file;
    return styleThumb;
  }, [stylePhotos, styleThumb]);

  const showStylePhotoBlock =
    (typeof stylePk === "number" && stylePk > 0) || !!styleThumb;

  const planHolidayRange = useMemo(() => {
    if (
      !schedule?.production_assembly_start_date ||
      !schedule.production_assembly_finish_date
    ) {
      return null;
    }
    const s = parseLocalMidnightFromIso(
      schedule.production_assembly_start_date
    );
    const e = parseLocalMidnightFromIso(
      schedule.production_assembly_finish_date
    );
    if (!s || !e) return null;
    const widenStart = new Date(s);
    widenStart.setMonth(widenStart.getMonth() - 3);
    const widenEnd = new Date(e);
    widenEnd.setMonth(widenEnd.getMonth() + 3);
    return {
      date_from: ymdFromLocalDate(widenStart),
      date_to: ymdFromLocalDate(widenEnd),
    };
  }, [schedule]);

  const { data: vlPlanHolidayRows = [] } = useQuery({
    queryKey: [
      "vlPlanHolidays",
      planHolidayRange?.date_from,
      planHolidayRange?.date_to,
    ],
    queryFn: () => getVlPlanHolidays(planHolidayRange!),
    enabled: planHolidayRange != null,
    staleTime: 60_000,
  });

  const holidaySet = useMemo(() => {
    const s = new Set<string>();
    for (const h of vlPlanHolidayRows) {
      const d = String(h.date ?? "").slice(0, 10);
      if (/^\d{4}-\d{2}-\d{2}$/.test(d)) s.add(d);
    }
    return s;
  }, [vlPlanHolidayRows]);

  const planMeta = useMemo(() => {
    if (!schedule || sj == null) return null;
    const tq = sj.total_qty != null ? Number(sj.total_qty) : 0;
    return getAssemblyDailyPlannedQtyFromTotal(schedule, tq, holidaySet);
  }, [schedule, sj, holidaySet]);

  const planDaily = planMeta?.daily ?? null;

  const { data: listData, isLoading, isFetching, refetch } = useQuery({
    queryKey: [
      "vlSjNoScheduleProductionDailyOutputs",
      sjPk,
      schedulePk,
      dateFrom,
      dateTo,
      searchQuery,
      currentPage,
    ],
    queryFn: () =>
      getVlAssemblyScheduleProductionDailyOutputs({
        schedule: schedulePk,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
        search: searchQuery.trim() || undefined,
        page: currentPage,
        page_size: 20,
      }),
    enabled: schedulePk != null && schedulePk > 0,
  });

  /** 차트용: 동일 스케줄·날짜 범위에서 최대 500건(시간 순) */
  const { data: chartListData, isLoading: chartLoading, refetch: refetchChart } = useQuery({
    queryKey: [
      "vlSjNoScheduleProductionDailyOutputChart",
      sjPk,
      schedulePk,
      dateFrom,
      dateTo,
    ],
    queryFn: () =>
      getVlAssemblyScheduleProductionDailyOutputs({
        schedule: schedulePk,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
        page: 1,
        page_size: 500,
      }),
    enabled: schedulePk != null && schedulePk > 0,
  });

  const chartRows = chartListData?.results ?? [];

  const byDay = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of chartRows) {
      const d = new Date(r.recorded_at);
      const ymd = ymdFromLocalDate(d);
      m.set(ymd, (m.get(ymd) ?? 0) + (Number(r.qty) || 0));
    }
    return m;
  }, [chartRows]);

  const byDayHour = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of chartRows) {
      const d = new Date(r.recorded_at);
      const ymd = ymdFromLocalDate(d);
      const h = d.getHours();
      const key = `${ymd}|${h}`;
      m.set(key, (m.get(key) ?? 0) + (Number(r.qty) || 0));
    }
    return m;
  }, [chartRows]);

  const dayTableYmds = useMemo(() => {
    const df = dateFrom.trim();
    const dt = dateTo.trim();
    if (df && dt) return enumerateYmdsInclusive(df, dt);
    const keys = Array.from(byDay.keys()).sort();
    if (keys.length >= 2)
      return enumerateYmdsInclusive(keys[0]!, keys[keys.length - 1]!);
    if (keys.length === 1) return [keys[0]!];
    return [];
  }, [dateFrom, dateTo, byDay]);

  const hourTableRows = useMemo(() => {
    if (!schedule) return [];
    const rows: {
      ymd: string;
      hour: number;
      actual: number;
      planned: number;
      achievement: string;
    }[] = [];
    for (const key of Array.from(byDayHour.keys()).sort((a, b) => {
      const [ya, ha] = a.split("|");
      const [yb, hb] = b.split("|");
      return ya.localeCompare(yb) || Number(ha) - Number(hb);
    })) {
      const actual = byDayHour.get(key) ?? 0;
      if (actual <= 0) continue;
      const [ymd, hStr] = key.split("|");
      const hour = Number(hStr);
      const dayPlanned = plannedQtyForCalendarDay(
        ymd,
        schedule,
        planDaily,
        holidaySet
      );
      const ph = plannedQtyPerPlanHour(dayPlanned);
      rows.push({
        ymd,
        hour,
        actual,
        planned: ph,
        achievement: formatAchievementPct(actual, ph),
      });
    }
    return rows;
  }, [byDayHour, schedule, planDaily, holidaySet]);

  const chartPoints = useMemo(() => {
    return [...chartRows]
      .sort(
        (a, b) =>
          new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime()
      )
      .map((r) => ({
        key: r.pk,
        label: new Date(r.recorded_at).toLocaleString(undefined, {
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }),
        qty: r.qty,
        cumulative: r.schedule_cumulative_snapshot ?? 0,
      }));
  }, [chartRows]);

  useEffect(() => {
    setCurrentPage(1);
  }, [schedulePk, dateFrom, dateTo]);

  const rows = listData?.results ?? [];
  const totalPages = listData?.total_pages ?? 1;
  const totalResults = listData?.total_results ?? 0;

  if (!Number.isFinite(sjPk) || sjPk < 1) {
    return (
      <Center minH="60vh">
        <Text color="gray.400">{t("vlAssembly.sjNoDetail.notFound")}</Text>
      </Center>
    );
  }

  if (sjLoading) {
    return (
      <Center minH="60vh">
        <Spinner size="xl" />
      </Center>
    );
  }

  if (!sj) {
    return (
      <Center minH="60vh">
        <Text color="gray.400">{t("vlAssembly.sjNoDetail.notFound")}</Text>
      </Center>
    );
  }

  if (schedulePk == null) {
    return (
      <Box bg={pageBg} minH="100vh" px={{ base: 3, md: 5 }} py={6}>
        <Box maxW="1280px" mx="auto">
          <Button
            as={RouterLink}
            to={`/vl-assembly-production/sj-nos/${sjPk}`}
            leftIcon={<FaArrowLeft />}
            variant="ghost"
            size="sm"
            mb={4}
          >
            {t("vlAssembly.sjNoScheduleProductionDailyOutput.backToSjNo")}
          </Button>
          <Text color="gray.500">{t("vlAssembly.sjNoScheduleProductionDailyOutput.noSchedule")}</Text>
        </Box>
      </Box>
    );
  }

  return (
    <>
      <Helmet>
        <title>
          {t("vlAssembly.sjNoScheduleProductionDailyOutput.pageTitle", {
            sjNo: sj.sj_no ?? sjPk,
          })}
        </title>
      </Helmet>
      <Box bg={pageBg} minH="100vh" px={{ base: 3, md: 5 }} py={6}>
        <Box maxW="1280px" mx="auto">
          <Button
            as={RouterLink}
            to={`/vl-assembly-production/sj-nos/${sjPk}`}
            leftIcon={<FaArrowLeft />}
            variant="ghost"
            size="sm"
            mb={4}
          >
            {t("vlAssembly.sjNoScheduleProductionDailyOutput.backToSjNo")}
          </Button>

          <HStack align="flex-start" spacing={4} mb={1} flexWrap="wrap" w="full">
            {showStylePhotoBlock ? (
              <Box flexShrink={0}>
                {stylePhotosLoading && !stylePhotoSrc ? (
                  <Skeleton
                    w="72px"
                    h="72px"
                    borderRadius="lg"
                    flexShrink={0}
                  />
                ) : stylePhotoSrc ? (
                  <Tooltip
                    label={t(
                      "vlAssembly.sjNoScheduleProductionDailyOutput.stylePhotoZoom"
                    )}
                    placement="top"
                  >
                    <Image
                      src={stylePhotoSrc}
                      alt={
                        styleLabel ??
                        t(
                          "vlAssembly.sjNoScheduleProductionDailyOutput.stylePhotoAlt"
                        )
                      }
                      w="72px"
                      h="72px"
                      objectFit="cover"
                      borderRadius="lg"
                      cursor="pointer"
                      flexShrink={0}
                      boxShadow="sm"
                      borderWidth="1px"
                      borderColor={border}
                      onClick={() => setPhotoModalUrl(stylePhotoSrc)}
                      _hover={{ opacity: 0.92 }}
                    />
                  </Tooltip>
                ) : null}
              </Box>
            ) : null}
            <Box flex="1" minW={0}>
              <HStack
                justify="space-between"
                align="center"
                flexWrap="wrap"
                gap={3}
              >
                <Heading size="lg">
                  {t("vlAssembly.sjNoScheduleProductionDailyOutput.heading", {
                    sjNo: sj.sj_no ?? "—",
                    schedulePk,
                  })}
                </Heading>
                <SearchInput
                  onSearch={(q) => {
                    setSearchQuery(q);
                    setCurrentPage(1);
                  }}
                  onInputChange={(v) => {
                    if (v === "") {
                      setSearchQuery("");
                      setCurrentPage(1);
                    }
                  }}
                />
              </HStack>
              {styleLabel ? (
                <Text fontSize="sm" color="gray.500" mt={1}>
                  {styleLabel}
                </Text>
              ) : null}
            </Box>
          </HStack>
          <Text fontSize="sm" color="gray.500" mb={4}>
            {t("vlAssembly.sjNoScheduleProductionDailyOutput.subtitle")}
          </Text>

          <HStack flexWrap="wrap" spacing={3} mb={5} align="flex-end">
            <FormControl maxW="200px">
              <FormLabel fontSize="xs">
                {t("vlAssembly.scheduleProductionDailyOutput.dateFrom")}
              </FormLabel>
              <LocalizedDateInput
                size="sm"
                value={dateFrom}
                onChange={setDateFrom}
                bg={cardBg}
              />
            </FormControl>
            <FormControl maxW="200px">
              <FormLabel fontSize="xs">
                {t("vlAssembly.scheduleProductionDailyOutput.dateTo")}
              </FormLabel>
              <LocalizedDateInput
                size="sm"
                value={dateTo}
                onChange={setDateTo}
                bg={cardBg}
              />
            </FormControl>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                void refetch();
                void refetchChart();
              }}
            >
              {t("vlAssembly.scheduleProductionDailyOutput.refresh")}
            </Button>
            <Button
              as={RouterLink}
              to={`/vl-assembly-production/schedule-daily-outputs?vl_assembly_schedule=${schedulePk}`}
              size="sm"
              colorScheme="blue"
              variant="solid"
            >
              {t("vlAssembly.sjNoScheduleProductionDailyOutput.openQtyInput")}
            </Button>
            <Button as={RouterLink} to="/vl-assembly-production/schedule-daily-outputs" size="sm" variant="outline">
              {t("vlAssembly.sjNoScheduleProductionDailyOutput.allSchedulesLink")}
            </Button>
          </HStack>

          <Box
            id="vl-sj-no-assembly-daily-output-analytics"
            bg={cardBg}
            borderRadius="xl"
            borderWidth="1px"
            borderColor={border}
            p={{ base: 4, md: 5 }}
            mb={6}
            shadow="sm"
            role="region"
            aria-label={t(
              "vlAssembly.sjNoScheduleProductionDailyOutput.analyticsSectionTitle"
            )}
          >
            <Text fontWeight="semibold" fontSize="sm" mb={1}>
              {t("vlAssembly.sjNoScheduleProductionDailyOutput.analyticsSectionTitle")}
            </Text>
            <Text fontSize="xs" color={analyticsSubColor} mb={4}>
              {t("vlAssembly.sjNoScheduleProductionDailyOutput.analyticsSectionHint")}
            </Text>
            {chartLoading ? (
              <Center minH="240px">
                <Spinner />
              </Center>
            ) : chartPoints.length === 0 ? (
              <Center minH="200px">
                <Text fontSize="sm" color={analyticsSubColor}>
                  {t("vlAssembly.sjNoScheduleProductionDailyOutput.analyticsEmpty")}
                </Text>
              </Center>
            ) : (
              <Box w="100%" minH={{ base: "260px", md: "300px" }}>
                <ResponsiveContainer width="100%" height={300}>
                  <ComposedChart
                    data={chartPoints}
                    margin={{ top: 8, right: 12, left: 0, bottom: 16 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke={chartGridStroke}
                    />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 10 }}
                      interval="preserveStartEnd"
                      angle={-32}
                      textAnchor="end"
                      height={72}
                    />
                    <YAxis
                      yAxisId="cum"
                      tick={{ fontSize: 10 }}
                      width={44}
                    />
                    <YAxis
                      yAxisId="qty"
                      orientation="right"
                      tick={{ fontSize: 10 }}
                      width={40}
                    />
                    <RechartsTooltip
                      contentStyle={{
                        background: chartTooltipBg,
                        border: `1px solid ${chartGridStroke}`,
                        borderRadius: "8px",
                        fontSize: "12px",
                      }}
                      formatter={(value: unknown) =>
                        typeof value === "number"
                          ? value.toLocaleString()
                          : String(value ?? "—")
                      }
                    />
                    <Legend wrapperStyle={{ fontSize: "12px" }} />
                    <Bar
                      yAxisId="qty"
                      dataKey="qty"
                      name={t(
                        "vlAssembly.sjNoScheduleProductionDailyOutput.analyticsChartQty"
                      )}
                      fill={chartBarFill}
                      radius={[4, 4, 0, 0]}
                      maxBarSize={48}
                    />
                    <Line
                      yAxisId="cum"
                      type="monotone"
                      dataKey="cumulative"
                      name={t(
                        "vlAssembly.sjNoScheduleProductionDailyOutput.analyticsChartCumulative"
                      )}
                      stroke={chartLineStroke}
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      activeDot={{ r: 5 }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </Box>
            )}
            <Divider my={5} />
            <Text fontWeight="semibold" fontSize="sm" mb={1}>
              {t(
                "vlAssembly.sjNoScheduleProductionDailyOutput.planActualTablesTitle"
              )}
            </Text>
            <Text fontSize="xs" color={analyticsSubColor} mb={4}>
              {t(
                "vlAssembly.sjNoScheduleProductionDailyOutput.planActualTablesHint",
                { totalQty: sj.total_qty != null ? Number(sj.total_qty) : 0 }
              )}
            </Text>
            {chartLoading ? (
              <Center minH="120px">
                <Spinner />
              </Center>
            ) : dayTableYmds.length === 0 && hourTableRows.length === 0 ? (
              <Text fontSize="sm" color={analyticsSubColor}>
                {t(
                  "vlAssembly.sjNoScheduleProductionDailyOutput.planTablesEmpty"
                )}
              </Text>
            ) : (
              <Box display="flex" flexDirection="column" gap={8}>
                <Box>
                  <Text fontSize="sm" fontWeight="medium" mb={2}>
                    {t(
                      "vlAssembly.sjNoScheduleProductionDailyOutput.dayTableTitle"
                    )}
                  </Text>
                  {schedule == null || dayTableYmds.length === 0 ? (
                    <Text fontSize="sm" color={analyticsSubColor}>
                      {t(
                        "vlAssembly.sjNoScheduleProductionDailyOutput.dayTableNoRange"
                      )}
                    </Text>
                  ) : (
                    <TableContainer
                      maxH="360px"
                      overflowY="auto"
                      borderWidth="1px"
                      borderColor={border}
                      borderRadius="md"
                    >
                      <Table size="sm" variant="simple">
                        <Thead position="sticky" top={0} bg={cardBg} zIndex={1}>
                          <Tr>
                            <Th>
                              {t(
                                "vlAssembly.sjNoScheduleProductionDailyOutput.colDate"
                              )}
                            </Th>
                            <Th isNumeric>
                              {t(
                                "vlAssembly.sjNoScheduleProductionDailyOutput.colPlannedQty"
                              )}
                            </Th>
                            <Th isNumeric>
                              {t(
                                "vlAssembly.sjNoScheduleProductionDailyOutput.colActualQty"
                              )}
                            </Th>
                            <Th isNumeric>
                              {t(
                                "vlAssembly.sjNoScheduleProductionDailyOutput.colAchievement"
                              )}
                            </Th>
                          </Tr>
                        </Thead>
                        <Tbody>
                          {dayTableYmds.map((ymd) => {
                            const planned = plannedQtyForCalendarDay(
                              ymd,
                              schedule,
                              planDaily,
                              holidaySet
                            );
                            const actual = byDay.get(ymd) ?? 0;
                            return (
                              <Tr key={ymd}>
                                <Td whiteSpace="nowrap">{ymd}</Td>
                                <Td isNumeric>{planned.toLocaleString()}</Td>
                                <Td isNumeric fontWeight="medium">
                                  {actual.toLocaleString()}
                                </Td>
                                <Td isNumeric>
                                  {formatAchievementPct(actual, planned)}
                                </Td>
                              </Tr>
                            );
                          })}
                        </Tbody>
                      </Table>
                    </TableContainer>
                  )}
                </Box>
                <Box>
                  <Text fontSize="sm" fontWeight="medium" mb={2}>
                    {t(
                      "vlAssembly.sjNoScheduleProductionDailyOutput.hourTableTitle"
                    )}
                  </Text>
                  <Text fontSize="xs" color={analyticsSubColor} mb={2}>
                    {t(
                      "vlAssembly.sjNoScheduleProductionDailyOutput.hourTableHint"
                    )}
                  </Text>
                  {schedule == null || hourTableRows.length === 0 ? (
                    <Text fontSize="sm" color={analyticsSubColor}>
                      {t(
                        "vlAssembly.sjNoScheduleProductionDailyOutput.hourTableNoRows"
                      )}
                    </Text>
                  ) : (
                    <TableContainer
                      maxH="360px"
                      overflowY="auto"
                      borderWidth="1px"
                      borderColor={border}
                      borderRadius="md"
                    >
                      <Table size="sm" variant="simple">
                        <Thead position="sticky" top={0} bg={cardBg} zIndex={1}>
                          <Tr>
                            <Th>
                              {t(
                                "vlAssembly.sjNoScheduleProductionDailyOutput.colDate"
                              )}
                            </Th>
                            <Th isNumeric>
                              {t(
                                "vlAssembly.sjNoScheduleProductionDailyOutput.colHour"
                              )}
                            </Th>
                            <Th isNumeric>
                              {t(
                                "vlAssembly.sjNoScheduleProductionDailyOutput.colPlannedQtyHour"
                              )}
                            </Th>
                            <Th isNumeric>
                              {t(
                                "vlAssembly.sjNoScheduleProductionDailyOutput.colActualQty"
                              )}
                            </Th>
                            <Th isNumeric>
                              {t(
                                "vlAssembly.sjNoScheduleProductionDailyOutput.colAchievement"
                              )}
                            </Th>
                          </Tr>
                        </Thead>
                        <Tbody>
                          {hourTableRows.map((row) => (
                            <Tr key={`${row.ymd}|${row.hour}`}>
                              <Td whiteSpace="nowrap">{row.ymd}</Td>
                              <Td isNumeric>{row.hour}</Td>
                              <Td isNumeric>
                                {row.planned.toLocaleString()}
                              </Td>
                              <Td isNumeric fontWeight="medium">
                                {row.actual.toLocaleString()}
                              </Td>
                              <Td isNumeric>{row.achievement}</Td>
                            </Tr>
                          ))}
                        </Tbody>
                      </Table>
                    </TableContainer>
                  )}
                </Box>
              </Box>
            )}
          </Box>

          <Text fontSize="sm" color="gray.600" mb={3}>
            {t("vlAssembly.scheduleProductionDailyOutput.totalCount", {
              count: totalResults,
            })}
          </Text>

          <Box bg={cardBg} borderRadius="md" borderWidth="1px" borderColor={border} overflow="hidden">
            {isLoading ? (
              <Center py={16}>
                <Spinner />
              </Center>
            ) : (
              <TableContainer>
                <Table size="sm">
                  <Thead>
                    <Tr>
                      <Th>{t("vlAssembly.scheduleProductionDailyOutput.colId")}</Th>
                      <Th>{t("vlAssembly.scheduleProductionDailyOutput.colRecordedAt")}</Th>
                      <Th>{t("vlAssembly.scheduleProductionDailyOutput.colPo")}</Th>
                      <Th>{t("vlAssembly.scheduleProductionDailyOutput.colSchedulePk")}</Th>
                      <Th isNumeric>{t("vlAssembly.scheduleProductionDailyOutput.colQty")}</Th>
                      <Th isNumeric>
                        {t("vlAssembly.scheduleProductionDailyOutput.colScheduleCumulative")}
                      </Th>
                      <Th>{t("vlAssembly.scheduleProductionDailyOutput.colBy")}</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {rows.length === 0 ? (
                      <Tr>
                        <Td colSpan={7}>
                          <Text color="gray.500" py={6} textAlign="center">
                            {searchQuery.trim()
                              ? t("vlAssembly.scheduleProductionDailyOutput.noSearchResults")
                              : t("vlAssembly.scheduleProductionDailyOutput.noRows")}
                          </Text>
                        </Td>
                      </Tr>
                    ) : (
                      rows.map((r) => (
                        <Tr key={r.pk} _hover={{ bg: rowHoverBg }}>
                          <Td whiteSpace="nowrap">
                            <Text
                              as={RouterLink}
                              to={`/vl-assembly-production/schedule-daily-outputs/${r.pk}`}
                              color="blue.500"
                              fontWeight="semibold"
                            >
                              {r.pk}
                            </Text>
                          </Td>
                          <Td whiteSpace="nowrap">
                            <Text
                              as={RouterLink}
                              to={`/vl-assembly-production/schedule-daily-outputs/${r.pk}`}
                              color="blue.500"
                              fontWeight="medium"
                            >
                              {new Date(r.recorded_at).toLocaleString()}
                            </Text>
                          </Td>
                          <Td whiteSpace="nowrap">{r.sj_po_number ?? "—"}</Td>
                          <Td>
                            <Text
                              as={RouterLink}
                              to={`/vl-assembly-production/${r.vl_assembly_schedule}`}
                              color="blue.500"
                              fontSize="sm"
                            >
                              #{r.vl_assembly_schedule}
                            </Text>
                          </Td>
                          <Td isNumeric fontWeight="semibold">
                            {r.qty}
                          </Td>
                          <Td isNumeric fontWeight="semibold" color="teal.600">
                            {r.schedule_cumulative_snapshot != null
                              ? r.schedule_cumulative_snapshot.toLocaleString()
                              : "—"}
                          </Td>
                          <Td fontSize="xs">{r.recorded_by_name ?? "—"}</Td>
                        </Tr>
                      ))
                    )}
                  </Tbody>
                </Table>
              </TableContainer>
            )}
          </Box>

          {totalPages > 1 && (
            <HStack justify="center" mt={6} spacing={1} flexWrap="wrap">
              <IconButton
                aria-label={t("vlAssembly.scheduleProductionDailyOutput.paginationFirst")}
                icon={<FaChevronLeft />}
                size="sm"
                variant="ghost"
                isDisabled={currentPage <= 1 || isFetching}
                onClick={() => setCurrentPage(1)}
              />
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter(
                  (p) =>
                    p === 1 || p === totalPages || Math.abs(p - currentPage) <= 2
                )
                .reduce<(number | "...")[]>((acc, p, idx, arr) => {
                  if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push("...");
                  acc.push(p);
                  return acc;
                }, [])
                .map((item, idx) =>
                  item === "..." ? (
                    <Text key={`ellipsis-${idx}`} px={2} color="gray.400">
                      …
                    </Text>
                  ) : (
                    <Button
                      key={item}
                      size="sm"
                      variant={currentPage === item ? "solid" : "ghost"}
                      colorScheme={currentPage === item ? "blue" : "gray"}
                      isDisabled={isFetching}
                      onClick={() => setCurrentPage(item as number)}
                      minW="32px"
                    >
                      {item}
                    </Button>
                  )
                )}
              <IconButton
                aria-label={t("vlAssembly.scheduleProductionDailyOutput.paginationLast")}
                icon={<FaChevronRight />}
                size="sm"
                variant="ghost"
                isDisabled={currentPage >= totalPages || isFetching}
                onClick={() => setCurrentPage(totalPages)}
              />
            </HStack>
          )}
        </Box>
      </Box>
      <PhotoModal
        isOpen={!!photoModalUrl}
        onClose={() => setPhotoModalUrl(undefined)}
        selectedImage={photoModalUrl}
      />
    </>
  );
}
