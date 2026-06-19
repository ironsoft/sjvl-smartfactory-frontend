import {
  Alert,
  AlertIcon,
  Badge,
  Box,
  Button,
  Divider,
  Flex,
  HStack,
  List,
  ListItem,
  Spinner,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  Table,
  TableContainer,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
  VStack,
  useColorModeValue,
} from "@chakra-ui/react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip as RechartTooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { useMemo, useState } from "react";
import { FaBrain } from "react-icons/fa";
import { useTranslation } from "react-i18next";
import { usePressIoT, PressIoTStatus, PressIoTReading, PressIoTCycle } from "../hooks/usePressIoT";
import { IHotColdPressSetup, IHotColdPressAnalysisResponse, analyzeHotColdPress } from "../api";

function StatusDot({ status }: { status: PressIoTStatus }) {
  const colors: Record<PressIoTStatus, string> = {
    connected: "green.400",
    connecting: "yellow.400",
    disconnected: "gray.400",
    off: "gray.300",
  };
  const labels: Record<PressIoTStatus, string> = {
    connected: "Live",
    connecting: "Connecting…",
    disconnected: "Disconnected",
    off: "Off",
  };
  const schemes: Record<PressIoTStatus, string> = {
    connected: "green",
    connecting: "yellow",
    disconnected: "gray",
    off: "gray",
  };
  return (
    <HStack spacing={2}>
      <Box
        w="10px"
        h="10px"
        borderRadius="full"
        bg={colors[status]}
        boxShadow={
          status === "connected"
            ? "0 0 6px 2px var(--chakra-colors-green-300)"
            : "none"
        }
      />
      <Badge colorScheme={schemes[status]} fontSize="xs">
        {labels[status]}
      </Badge>
    </HStack>
  );
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

function DiffBadge({
  actual, std, unit, tolerance,
}: {
  actual: number; std: number; unit: string; tolerance: number;
}) {
  const diff = +(actual - std).toFixed(1);
  const ok = Math.abs(diff) <= tolerance;
  const sign = diff > 0 ? "+" : "";
  return (
    <Badge colorScheme={ok ? "green" : "red"} fontSize="9px" px={1} borderRadius="sm" mt={1}>
      {sign}{diff}{unit} vs std {std}{unit}
    </Badge>
  );
}

interface Props {
  setup?: IHotColdPressSetup | null;
  tolerance?: number;
  pressIoT?: ReturnType<typeof usePressIoT>;
}

export default function PressIoTLivePanel({ setup, tolerance = 5, pressIoT: pressIoTProp }: Props) {
  const { t, i18n } = useTranslation();
  const internalIoT = usePressIoT(pressIoTProp ? undefined : (setup?.machine_iot_id ?? undefined));
  const { status, enabled, latest, history, cycles, machineIotId, connect, disconnect } =
    pressIoTProp ?? internalIoT;

  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<IHotColdPressAnalysisResponse | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);

  const handleAiAnalysis = async () => {
    if (!latest || !setup) return;
    setAiLoading(true);
    setAiError(null);
    setAiResult(null);
    try {
      const result = await analyzeHotColdPress({
        machine_iot_id: setup.machine_iot_id,
        hot_temp: latest.value_temp_1,
        cold_temp: latest.value_temp_2,
        hot_duration: latest.value_time_hot ?? null,
        cold_duration: latest.value_time_cold ?? null,
        cycle_count: latest.value_time_cycle ?? latest.value_run_ok ?? null,
        std_hot_temp: parseFloat(setup.std_hot_temp_c),
        std_cold_temp: parseFloat(setup.std_cold_temp_c),
        std_hot_duration: parseFloat(setup.std_hot_duration_s),
        std_cold_duration: parseFloat(setup.std_cold_duration_s),
        tolerance_temp: parseFloat(setup.tolerance_temp_c),
        tolerance_duration: parseFloat(setup.tolerance_duration_s),
        language: i18n.language?.startsWith("ko") ? "ko" : i18n.language?.startsWith("vi") ? "vi" : "en",
      });
      setAiResult(result);
    } catch (e: any) {
      setAiError(e?.response?.data?.error ?? "AI 분석 중 오류가 발생했습니다.");
    } finally {
      setAiLoading(false);
    }
  };

  const borderColor = useColorModeValue("gray.200", "gray.600");
  const cardBg = useColorModeValue("white", "gray.800");
  const labelColor = useColorModeValue("gray.500", "gray.400");
  const hotBg = useColorModeValue("orange.50", "rgba(251,146,60,0.1)");
  const coldBg = useColorModeValue("blue.50", "rgba(96,165,250,0.1)");
  const headerBg = useColorModeValue("gray.50", "gray.750");
  const aiOkBg = useColorModeValue("green.50", "rgba(72,187,120,0.1)");
  const aiWarnBg = useColorModeValue("orange.50", "rgba(237,137,54,0.1)");
  const aiCritBg = useColorModeValue("red.50", "rgba(245,101,101,0.1)");

  // Build chart data — sample every 3rd point to reduce clutter
  const chartData = history
    .filter((_, i) => i % 3 === 0 || i === history.length - 1)
    .map((r) => ({
      t: formatTime(r.receivedAt),
      hot: r.value_temp_1,
      cold: r.value_temp_2,
    }));

  // Tolerance-based color logic for live readings (for card display only)
  const hotDiff = latest !== null && setup
    ? Math.abs(latest.value_temp_1 - parseFloat(setup.std_hot_temp_c))
    : null;
  const coldDiff = latest !== null && setup
    ? Math.abs(latest.value_temp_2 - parseFloat(setup.std_cold_temp_c))
    : null;
  const hotOk  = hotDiff  === null ? null : hotDiff  <= tolerance;
  const coldOk = coldDiff === null ? null : coldDiff <= tolerance;

  const hotNumColor  = hotOk  === null ? "orange.500" : hotOk  ? "green.500" : "red.500";
  const coldNumColor = coldOk === null ? "blue.500"   : coldOk ? "green.500" : "red.500";
  const hotBorderColor  = hotOk  === null ? "orange.200" : hotOk  ? "green.300" : "red.300";
  const coldBorderColor = coldOk === null ? "blue.200"   : coldOk ? "green.300" : "red.300";

  const stdHotDur  = setup ? parseFloat(setup.std_hot_duration_s)  : null;
  const stdColdDur = setup ? parseFloat(setup.std_cold_duration_s) : null;
  const durTolerance = setup?.tolerance_duration_s != null
    ? parseFloat(setup.tolerance_duration_s) : 5;
  const hotDurTolerance  = durTolerance;
  const coldDurTolerance = durTolerance;
  const hotDurDiff  = latest?.value_time_hot  != null && stdHotDur  != null
    ? Math.abs(latest.value_time_hot  - stdHotDur)  : null;
  const coldDurDiff = latest?.value_time_cold != null && stdColdDur != null
    ? Math.abs(latest.value_time_cold - stdColdDur) : null;
  const hotDurOk  = hotDurDiff  === null ? null : hotDurDiff  <= hotDurTolerance;
  const coldDurOk = coldDurDiff === null ? null : coldDurDiff <= coldDurTolerance;

  // Signal color for UI display only — physical light is published server-side
  // GREEN = both hot AND cold temps within tolerance, RED = either exceeds tolerance
  const signalColor: "green" | "red" | null = useMemo(() => {
    if (hotOk === null && coldOk === null) return null;
    return (hotOk === true && coldOk === true) ? "green" : "red";
  }, [hotOk, coldOk]);

  return (
    <Box>
      {/* ── Header bar ── */}
      <Flex
        px={4}
        py={2}
        bg={headerBg}
        align="center"
        justify="space-between"
        borderBottom="1px solid"
        borderColor={borderColor}
      >
        <HStack spacing={3}>
          <Text fontSize="sm" fontWeight="bold">
            📡 Live Monitor
          </Text>
          {machineIotId && (
            <Text fontSize="xs" color={labelColor}>
              Machine ID: <b>{machineIotId}</b>
            </Text>
          )}
          {/* 신호등 상태 표시 (display only — physical light driven by backend) */}
          {signalColor && (
            <HStack spacing={1}>
              <Box
                w="10px" h="10px"
                borderRadius="full"
                bg={signalColor === "green" ? "green.400" : "red.400"}
                boxShadow={
                  signalColor === "green"
                    ? "0 0 6px 2px var(--chakra-colors-green-300)"
                    : "0 0 6px 2px var(--chakra-colors-red-300)"
                }
              />
              <Text fontSize="10px" color={signalColor === "green" ? "green.500" : "red.500"} fontWeight="semibold">
                {signalColor === "green" ? t("pressLight.green") : t("pressLight.red")}
              </Text>
            </HStack>
          )}
        </HStack>
        <HStack spacing={3}>
          <StatusDot status={status} />
          {enabled && latest && setup && (
            <Button
              size="xs"
              onClick={handleAiAnalysis}
              isLoading={aiLoading}
              loadingText={t("ep.dashboard.aiLiveAnalysis.loading")}
              leftIcon={<FaBrain size={11} />}
              bgGradient="linear(to-r, purple.500, blue.500)"
              color="white"
              _hover={{ bgGradient: "linear(to-r, purple.600, blue.600)" }}
              _active={{ bgGradient: "linear(to-r, purple.700, blue.700)" }}
              borderRadius="full"
              px={3}
              fontWeight="semibold"
              boxShadow="0 1px 6px rgba(128,90,213,0.3)"
            >
              {t("ep.dashboard.aiLiveAnalysis.button")}
            </Button>
          )}
          <Button
            size="xs"
            colorScheme={enabled ? "red" : "green"}
            variant="outline"
            onClick={enabled ? disconnect : connect}
            isLoading={status === "connecting"}
            loadingText="Connecting…"
            minW="90px"
          >
            {enabled ? t("pressIoT.disconnect") : t("pressIoT.connect")}
          </Button>
        </HStack>
      </Flex>

      {/* ── Stat cards (only when enabled) ── */}
      {enabled && <Flex px={4} py={4} gap={4} wrap="wrap">
        {/* Hot Temp */}
        <Box
          flex={1}
          minW="140px"
          bg={hotBg}
          border="2px solid"
          borderColor={hotBorderColor}
          borderRadius="lg"
          px={4}
          py={3}
          transition="border-color 0.3s"
        >
          <Stat>
            <HStack mb={1}>
              <Text fontSize="sm">🔥</Text>
              <StatLabel fontSize="xs" color="orange.600">
                {t("pressIoT.hotTemp")}
              </StatLabel>
            </HStack>
            <StatNumber fontSize="3xl" color={hotNumColor} transition="color 0.3s">
              {latest !== null ? `${latest.value_temp_1}°C` : "—"}
            </StatNumber>
            <StatHelpText fontSize="xs" color={labelColor} mb={0}>
              {setup
                ? `std: ${parseFloat(setup.std_hot_temp_c).toFixed(1)}°C`
                : "value_temp_1"}
            </StatHelpText>
            {latest !== null && setup && (
              <DiffBadge
                actual={latest.value_temp_1}
                std={parseFloat(setup.std_hot_temp_c)}
                unit="°C"
                tolerance={tolerance}
              />
            )}
          </Stat>
        </Box>

        {/* Cold Temp */}
        <Box
          flex={1}
          minW="140px"
          bg={coldBg}
          border="2px solid"
          borderColor={coldBorderColor}
          borderRadius="lg"
          px={4}
          py={3}
          transition="border-color 0.3s"
        >
          <Stat>
            <HStack mb={1}>
              <Text fontSize="sm">❄️</Text>
              <StatLabel fontSize="xs" color="blue.600">
                {t("pressIoT.coldTemp")}
              </StatLabel>
            </HStack>
            <StatNumber fontSize="3xl" color={coldNumColor} transition="color 0.3s">
              {latest !== null ? `${latest.value_temp_2}°C` : "—"}
            </StatNumber>
            <StatHelpText fontSize="xs" color={labelColor} mb={0}>
              {setup
                ? `std: ${parseFloat(setup.std_cold_temp_c).toFixed(1)}°C`
                : "value_temp_2"}
            </StatHelpText>
            {latest !== null && setup && (
              <DiffBadge
                actual={latest.value_temp_2}
                std={parseFloat(setup.std_cold_temp_c)}
                unit="°C"
                tolerance={tolerance}
              />
            )}
          </Stat>
        </Box>

        {/* Hot Duration */}
        <Box
          flex={1}
          minW="140px"
          bg={hotBg}
          border="2px solid"
          borderColor={hotDurOk === null ? "orange.200" : hotDurOk ? "green.300" : "red.300"}
          borderRadius="lg"
          px={4}
          py={3}
          transition="border-color 0.3s"
        >
          <Stat>
            <HStack mb={1}>
              <Text fontSize="sm">⏱</Text>
              <StatLabel fontSize="xs" color="orange.600">
                {t("pressIoT.hotDuration")}
              </StatLabel>
            </HStack>
            <StatNumber fontSize="3xl" color={hotDurOk === null ? "orange.500" : hotDurOk ? "green.500" : "red.500"} transition="color 0.3s">
              {latest?.value_time_hot != null ? `${latest.value_time_hot}s` : "—"}
            </StatNumber>
            <StatHelpText fontSize="xs" color={labelColor} mb={0}>
              {stdHotDur != null ? `std: ${stdHotDur.toFixed(1)}s` : "value_time_hot"}
            </StatHelpText>
            {latest?.value_time_hot != null && stdHotDur != null && (
              <DiffBadge
                actual={latest.value_time_hot}
                std={stdHotDur}
                unit="s"
                tolerance={hotDurTolerance}
              />
            )}
          </Stat>
        </Box>

        {/* Cold Duration */}
        <Box
          flex={1}
          minW="140px"
          bg={coldBg}
          border="2px solid"
          borderColor={coldDurOk === null ? "blue.200" : coldDurOk ? "green.300" : "red.300"}
          borderRadius="lg"
          px={4}
          py={3}
          transition="border-color 0.3s"
        >
          <Stat>
            <HStack mb={1}>
              <Text fontSize="sm">⏱</Text>
              <StatLabel fontSize="xs" color="blue.600">
                {t("pressIoT.coldDuration")}
              </StatLabel>
            </HStack>
            <StatNumber fontSize="3xl" color={coldDurOk === null ? "blue.500" : coldDurOk ? "green.500" : "red.500"} transition="color 0.3s">
              {latest?.value_time_cold != null ? `${latest.value_time_cold}s` : "—"}
            </StatNumber>
            <StatHelpText fontSize="xs" color={labelColor} mb={0}>
              {stdColdDur != null ? `std: ${stdColdDur.toFixed(1)}s` : "value_time_cold"}
            </StatHelpText>
            {latest?.value_time_cold != null && stdColdDur != null && (
              <DiffBadge
                actual={latest.value_time_cold}
                std={stdColdDur}
                unit="s"
                tolerance={coldDurTolerance}
              />
            )}
          </Stat>
        </Box>

        {/* Cycle count */}
        <Box
          flex={1}
          minW="140px"
          bg={cardBg}
          border="1px solid"
          borderColor={borderColor}
          borderRadius="lg"
          px={4}
          py={3}
        >
          <Stat>
            <HStack mb={1}>
              <Text fontSize="sm">🔄</Text>
              <StatLabel fontSize="xs" color={labelColor}>
                {t("pressIoT.cycleCount")}
              </StatLabel>
            </HStack>
            <StatNumber fontSize="3xl">
              {latest != null
                ? (latest.value_time_cycle ?? latest.value_run_ok)
                : "—"}
            </StatNumber>
            <StatHelpText fontSize="xs" color={labelColor} mb={0}>
              {t("pressIoT.cycleCount")}
            </StatHelpText>
          </Stat>
        </Box>

        {/* Last updated */}
        <Box
          flex={1}
          minW="140px"
          bg={cardBg}
          border="1px solid"
          borderColor={borderColor}
          borderRadius="lg"
          px={4}
          py={3}
        >
          <Stat>
            <HStack mb={1}>
              <Text fontSize="sm">⏱</Text>
              <StatLabel fontSize="xs" color={labelColor}>
                {t("pressIoT.lastUpdate")}
              </StatLabel>
            </HStack>
            <StatNumber fontSize="lg">
              {latest !== null ? formatTime(latest.receivedAt) : "—"}
            </StatNumber>
            <StatHelpText fontSize="xs" color={labelColor} mb={0}>
              {cycles.length > 0
                ? t("pressIoT.cyclesDetected", { count: cycles.length })
                : t("pressIoT.waitingForCycle")}
            </StatHelpText>
          </Stat>
        </Box>
      </Flex>}

      {/* ── Temperature chart ── */}
      {enabled && chartData.length >= 2 && (
        <Box px={4} pb={4}>
          <Text fontSize="xs" fontWeight="semibold" color={labelColor} mb={2}>
            {t("pressIoT.tempHistory")}
          </Text>
          <Box
            border="1px solid"
            borderColor={borderColor}
            borderRadius="lg"
            p={3}
            bg={cardBg}
          >
            <ResponsiveContainer width="100%" height={160}>
              <LineChart data={chartData}>
                <XAxis
                  dataKey="t"
                  tick={{ fontSize: 9 }}
                  interval="preserveStartEnd"
                />
                <YAxis
                  domain={["auto", "auto"]}
                  tick={{ fontSize: 9 }}
                  width={30}
                />
                <RechartTooltip
                  formatter={(val: any, name: any) => [
                    val != null ? `${val}°C` : "—",
                    name === "hot" ? t("pressIoT.hotTemp") : t("pressIoT.coldTemp"),
                  ]}
                  labelStyle={{ fontSize: 10 }}
                  contentStyle={{ fontSize: 11 }}
                />
                <Legend
                  formatter={(value) =>
                    value === "hot" ? "🔥 Hot" : "❄️ Cold"
                  }
                  wrapperStyle={{ fontSize: 11 }}
                />
                <Line
                  type="monotone"
                  dataKey="hot"
                  stroke="#ED8936"
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                />
                <Line
                  type="monotone"
                  dataKey="cold"
                  stroke="#4299E1"
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </Box>
        </Box>
      )}

      {/* ── AI Analysis Result Panel ── */}
      {enabled && (aiLoading || aiResult || aiError) && (
        <Box px={4} pb={4}>
          <Divider mb={3} />
          <Flex align="center" justify="space-between" mb={2}>
            <HStack spacing={2}>
              <Box
                p={1}
                bgGradient="linear(to-br, purple.500, blue.500)"
                borderRadius="md"
                display="flex"
                alignItems="center"
                justifyContent="center"
              >
                <FaBrain size={10} color="white" />
              </Box>
              <Text fontSize="xs" fontWeight="semibold" color={labelColor}>
                {t("ep.dashboard.aiLiveAnalysis.sectionTitle")}
              </Text>
              {aiResult && (
                <Badge
                  colorScheme={
                    aiResult.severity === "ok" ? "green"
                      : aiResult.severity === "critical" ? "red"
                      : "orange"
                  }
                  fontSize="10px"
                >
                  {t(`ep.dashboard.aiLiveAnalysis.severity.${aiResult.severity}`)}
                </Badge>
              )}
            </HStack>
            {aiResult && (
              <Button
                size="xs"
                variant="ghost"
                colorScheme="purple"
                onClick={handleAiAnalysis}
                isLoading={aiLoading}
              >
                {t("ep.dashboard.aiLiveAnalysis.reanalyze")}
              </Button>
            )}
          </Flex>

          {aiLoading && (
            <Flex justify="center" py={6}>
              <VStack spacing={2}>
                <Spinner color="purple.500" size="md" />
                <Text fontSize="xs" color={labelColor}>{t("ep.dashboard.aiLiveAnalysis.analyzing")}</Text>
              </VStack>
            </Flex>
          )}

          {aiError && (
            <Alert status="error" borderRadius="md" fontSize="sm">
              <AlertIcon />
              {aiError}
            </Alert>
          )}

          {aiResult && !aiLoading && (
            <Box
              border="1px solid"
              borderColor={
                aiResult.severity === "ok"
                  ? "green.200"
                  : aiResult.severity === "critical"
                  ? "red.200"
                  : "orange.200"
              }
              borderRadius="lg"
              p={4}
              bg={
                aiResult.severity === "ok"
                  ? aiOkBg
                  : aiResult.severity === "critical"
                  ? aiCritBg
                  : aiWarnBg
              }
            >
              <Text fontSize="sm" fontWeight="semibold" mb={3}>
                {aiResult.summary}
              </Text>

              {aiResult.issues.length > 0 && (
                <Box mb={3}>
                  <Text fontSize="xs" fontWeight="bold" color="red.500" mb={1}>
                    ⚠️ {t("ep.dashboard.aiLiveAnalysis.detectedIssues")}
                  </Text>
                  <List spacing={1}>
                    {aiResult.issues.map((issue, i) => (
                      <ListItem key={i} fontSize="xs" color={labelColor}>
                        • {issue}
                      </ListItem>
                    ))}
                  </List>
                </Box>
              )}

              {aiResult.recommendations.length > 0 && (
                <Box>
                  <Text fontSize="xs" fontWeight="bold" color="blue.500" mb={1}>
                    💡 {t("ep.dashboard.aiLiveAnalysis.recommendations")}
                  </Text>
                  <List spacing={1}>
                    {aiResult.recommendations.map((rec, i) => (
                      <ListItem key={i} fontSize="xs" color={labelColor}>
                        • {rec}
                      </ListItem>
                    ))}
                  </List>
                </Box>
              )}

              {aiResult.severity === "ok" && aiResult.issues.length === 0 && (
                <Text fontSize="xs" color="green.600">
                  ✅ {t("ep.dashboard.aiLiveAnalysis.allNormal")}
                </Text>
              )}
            </Box>
          )}
        </Box>
      )}

      {/* ── Cycle history table ── */}
      {enabled && cycles.length > 0 && (
        <Box px={4} pb={4}>
          <Divider mb={3} />
          <Text fontSize="xs" fontWeight="semibold" color={labelColor} mb={2}>
            {t("pressIoT.cycleHistory")}
          </Text>
          <TableContainer>
            <Table size="sm" variant="simple">
              <Thead bg={headerBg}>
                <Tr>
                  <Th fontSize="10px" px={2} isNumeric>{t("pressIoT.table.cycleNo")}</Th>
                  <Th fontSize="10px" px={2} isNumeric color="orange.500">
                    🔥 {t("pressIoT.hotTemp")}
                    {setup && (
                      <Text fontSize="9px" color={labelColor} fontWeight="normal">
                        std {parseFloat(setup.std_hot_temp_c).toFixed(1)}°C
                      </Text>
                    )}
                  </Th>
                  <Th fontSize="10px" px={2} isNumeric color="blue.500">
                    ❄️ {t("pressIoT.coldTemp")}
                    {setup && (
                      <Text fontSize="9px" color={labelColor} fontWeight="normal">
                        std {parseFloat(setup.std_cold_temp_c).toFixed(1)}°C
                      </Text>
                    )}
                  </Th>
                  <Th fontSize="10px" px={2} isNumeric color="orange.400">
                    ⏱ {t("pressIoT.hotDuration")}
                    {setup && (
                      <Text fontSize="9px" color={labelColor} fontWeight="normal">
                        std {parseFloat(setup.std_hot_duration_s).toFixed(1)}s
                      </Text>
                    )}
                  </Th>
                  <Th fontSize="10px" px={2} isNumeric color="blue.400">
                    ⏱ {t("pressIoT.coldDuration")}
                    {setup && (
                      <Text fontSize="9px" color={labelColor} fontWeight="normal">
                        std {parseFloat(setup.std_cold_duration_s).toFixed(1)}s
                      </Text>
                    )}
                  </Th>
                  <Th fontSize="10px" px={2}>{t("pressIoT.table.completedAt")}</Th>
                </Tr>
              </Thead>
              <Tbody>
                {cycles.map((c) => {
                  const hotTempDiff = setup
                    ? +(c.hotTemp - parseFloat(setup.std_hot_temp_c)).toFixed(1)
                    : null;
                  const coldTempDiff = setup
                    ? +(c.coldTemp - parseFloat(setup.std_cold_temp_c)).toFixed(1)
                    : null;
                  const cStdHotDur  = stdHotDur;
                  const cStdColdDur = stdColdDur;
                  const hotDurDiffC  = c.hotDuration  != null && cStdHotDur  != null
                    ? +(c.hotDuration  - cStdHotDur).toFixed(1)  : null;
                  const coldDurDiffC = c.coldDuration != null && cStdColdDur != null
                    ? +(c.coldDuration - cStdColdDur).toFixed(1) : null;
                  return (
                    <Tr key={c.cycleNo} _hover={{ bg: headerBg }}>
                      <Td px={2} isNumeric>
                        <Text fontSize="sm" fontWeight="bold">#{c.cycleNo}</Text>
                      </Td>
                      <Td px={2} isNumeric>
                        <VStack spacing={0} align="flex-end">
                          <Text fontSize="sm" color="orange.500">{c.hotTemp}°C</Text>
                          {hotTempDiff !== null && (
                            <Badge
                              colorScheme={Math.abs(hotTempDiff) <= tolerance ? "green" : "red"}
                              fontSize="9px" px={1} borderRadius="sm"
                            >
                              {hotTempDiff > 0 ? "+" : ""}{hotTempDiff}°C
                            </Badge>
                          )}
                        </VStack>
                      </Td>
                      <Td px={2} isNumeric>
                        <VStack spacing={0} align="flex-end">
                          <Text fontSize="sm" color="blue.500">{c.coldTemp}°C</Text>
                          {coldTempDiff !== null && (
                            <Badge
                              colorScheme={Math.abs(coldTempDiff) <= tolerance ? "green" : "red"}
                              fontSize="9px" px={1} borderRadius="sm"
                            >
                              {coldTempDiff > 0 ? "+" : ""}{coldTempDiff}°C
                            </Badge>
                          )}
                        </VStack>
                      </Td>
                      <Td px={2} isNumeric>
                        <VStack spacing={0} align="flex-end">
                          <Text fontSize="sm" color="orange.400">
                            {c.hotDuration != null ? `${c.hotDuration}s` : "—"}
                          </Text>
                          {hotDurDiffC !== null && cStdHotDur != null && (
                            <Badge
                              colorScheme={Math.abs(hotDurDiffC) <= hotDurTolerance ? "green" : "red"}
                              fontSize="9px" px={1} borderRadius="sm"
                            >
                              {hotDurDiffC > 0 ? "+" : ""}{hotDurDiffC}s
                            </Badge>
                          )}
                        </VStack>
                      </Td>
                      <Td px={2} isNumeric>
                        <VStack spacing={0} align="flex-end">
                          <Text fontSize="sm" color="blue.400">
                            {c.coldDuration != null ? `${c.coldDuration}s` : "—"}
                          </Text>
                          {coldDurDiffC !== null && cStdColdDur != null && (
                            <Badge
                              colorScheme={Math.abs(coldDurDiffC) <= coldDurTolerance ? "green" : "red"}
                              fontSize="9px" px={1} borderRadius="sm"
                            >
                              {coldDurDiffC > 0 ? "+" : ""}{coldDurDiffC}s
                            </Badge>
                          )}
                        </VStack>
                      </Td>
                      <Td px={2}>
                        <Text fontSize="xs" color={labelColor}>{formatTime(c.completedAt)}</Text>
                      </Td>
                    </Tr>
                  );
                })}
              </Tbody>
            </Table>
          </TableContainer>
        </Box>
      )}

      {/* Off state */}
      {!enabled && (
        <VStack py={10} spacing={3}>
          <Text fontSize="2xl">🔌</Text>
          <Text fontSize="sm" color={labelColor}>
            {t("pressIoT.connectionOff")}
          </Text>
          <Button size="sm" colorScheme="green" onClick={connect}>
            {t("pressIoT.connect")}
          </Button>
        </VStack>
      )}

      {/* Connecting / waiting state */}
      {enabled && status === "connected" && history.length === 0 && (
        <VStack py={6} spacing={1}>
          <Text fontSize="sm" color={labelColor}>
            {t("pressIoT.waitingData")}
          </Text>
          <Text fontSize="xs" color={labelColor}>
            Topic: press_machine/{machineIotId || "—"}
          </Text>
        </VStack>
      )}
    </Box>
  );
}
