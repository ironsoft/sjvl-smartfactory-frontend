import {
  Badge,
  Box,
  Button,
  Divider,
  Flex,
  HStack,
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
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { usePressIoT, PressIoTStatus, PressIoTReading, PressIoTCycle } from "../hooks/usePressIoT";
import { IHotColdPressSetup } from "../api";

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
  const { t } = useTranslation();
  // When pressIoTProp is provided (from HotColdPressIoTModal), don't create a separate auto-connection
  const internalIoT = usePressIoT(pressIoTProp ? undefined : (setup?.machine_iot_id ?? undefined));
  const { status, enabled, latest, history, cycles, machineIotId, connect, disconnect } =
    pressIoTProp ?? internalIoT;

  const borderColor = useColorModeValue("gray.200", "gray.600");
  const cardBg = useColorModeValue("white", "gray.800");
  const labelColor = useColorModeValue("gray.500", "gray.400");
  const hotBg = useColorModeValue("orange.50", "rgba(251,146,60,0.1)");
  const coldBg = useColorModeValue("blue.50", "rgba(96,165,250,0.1)");
  const headerBg = useColorModeValue("gray.50", "gray.750");

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
          <Button
            size="xs"
            colorScheme={enabled ? "red" : "green"}
            variant="outline"
            onClick={enabled ? disconnect : connect}
            isLoading={status === "connecting"}
            loadingText="Connecting…"
            minW="90px"
          >
            {enabled ? "Disconnect" : "Connect"}
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
                Hot Temp
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
                Cold Temp
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
                Cycle Count
              </StatLabel>
            </HStack>
            <StatNumber fontSize="3xl">
              {latest !== null ? latest.value_run_ok : "—"}
            </StatNumber>
            <StatHelpText fontSize="xs" color={labelColor} mb={0}>
              value_run_ok
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
                Last Update
              </StatLabel>
            </HStack>
            <StatNumber fontSize="lg">
              {latest !== null ? formatTime(latest.receivedAt) : "—"}
            </StatNumber>
            <StatHelpText fontSize="xs" color={labelColor} mb={0}>
              {cycles.length > 0
                ? `${cycles.length} cycle${cycles.length > 1 ? "s" : ""} detected`
                : "Waiting for cycle…"}
            </StatHelpText>
          </Stat>
        </Box>
      </Flex>}

      {/* ── Temperature chart ── */}
      {enabled && chartData.length >= 2 && (
        <Box px={4} pb={4}>
          <Text fontSize="xs" fontWeight="semibold" color={labelColor} mb={2}>
            Temperature History
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
                    name === "hot" ? "Hot Temp" : "Cold Temp",
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

      {/* ── Cycle history table ── */}
      {enabled && cycles.length > 0 && (
        <Box px={4} pb={4}>
          <Divider mb={3} />
          <Text fontSize="xs" fontWeight="semibold" color={labelColor} mb={2}>
            Cycle History (this session)
          </Text>
          <TableContainer>
            <Table size="sm" variant="simple">
              <Thead bg={headerBg}>
                <Tr>
                  <Th fontSize="10px" px={2} isNumeric>Cycle #</Th>
                  <Th fontSize="10px" px={2} isNumeric color="orange.500">
                    🔥 Hot Temp
                    {setup && (
                      <Text fontSize="9px" color={labelColor} fontWeight="normal">
                        std {parseFloat(setup.std_hot_temp_c).toFixed(1)}°C
                      </Text>
                    )}
                  </Th>
                  <Th fontSize="10px" px={2} isNumeric color="blue.500">
                    ❄️ Cold Temp
                    {setup && (
                      <Text fontSize="9px" color={labelColor} fontWeight="normal">
                        std {parseFloat(setup.std_cold_temp_c).toFixed(1)}°C
                      </Text>
                    )}
                  </Th>
                  <Th fontSize="10px" px={2}>Completed At</Th>
                </Tr>
              </Thead>
              <Tbody>
                {cycles.map((c) => {
                  const hotDiff = setup
                    ? +(c.hotTemp - parseFloat(setup.std_hot_temp_c)).toFixed(1)
                    : null;
                  const coldDiff = setup
                    ? +(c.coldTemp - parseFloat(setup.std_cold_temp_c)).toFixed(1)
                    : null;
                  return (
                    <Tr key={c.cycleNo} _hover={{ bg: headerBg }}>
                      <Td px={2} isNumeric>
                        <Text fontSize="sm" fontWeight="bold">#{c.cycleNo}</Text>
                      </Td>
                      <Td px={2} isNumeric>
                        <VStack spacing={0} align="flex-end">
                          <Text fontSize="sm" color="orange.500">{c.hotTemp}°C</Text>
                          {hotDiff !== null && (
                            <Badge
                              colorScheme={Math.abs(hotDiff) <= tolerance ? "green" : "red"}
                              fontSize="9px" px={1} borderRadius="sm"
                            >
                              {hotDiff > 0 ? "+" : ""}{hotDiff}°C
                            </Badge>
                          )}
                        </VStack>
                      </Td>
                      <Td px={2} isNumeric>
                        <VStack spacing={0} align="flex-end">
                          <Text fontSize="sm" color="blue.500">{c.coldTemp}°C</Text>
                          {coldDiff !== null && (
                            <Badge
                              colorScheme={Math.abs(coldDiff) <= tolerance ? "green" : "red"}
                              fontSize="9px" px={1} borderRadius="sm"
                            >
                              {coldDiff > 0 ? "+" : ""}{coldDiff}°C
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
            Connection is off.
          </Text>
          <Button size="sm" colorScheme="green" onClick={connect}>
            Connect
          </Button>
        </VStack>
      )}

      {/* Connecting / waiting state */}
      {enabled && status === "connected" && history.length === 0 && (
        <VStack py={6} spacing={1}>
          <Text fontSize="sm" color={labelColor}>
            Connected — waiting for data…
          </Text>
          <Text fontSize="xs" color={labelColor}>
            Topic: press_machine/{machineIotId || "—"}
          </Text>
        </VStack>
      )}
    </Box>
  );
}
