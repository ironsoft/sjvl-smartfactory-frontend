import {
  Accordion,
  AccordionButton,
  AccordionIcon,
  AccordionItem,
  AccordionPanel,
  Badge,
  Box,
  Button,
  Divider,
  Flex,
  HStack,
  Heading,
  IconButton,
  SimpleGrid,
  Spinner,
  Stat,
  StatHelpText,
  StatLabel,
  StatNumber,
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
} from "@chakra-ui/react";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import { Helmet } from "react-helmet";
import {
  FaChevronLeft,
  FaChevronRight,
  FaExternalLinkAlt,
} from "react-icons/fa";
import {
  getHotColdPressCycleList,
  IHotColdPressCycleListItem,
} from "../api";
import { hotColdPressKeys } from "../lib/queryKeys";

// ── Helpers ───────────────────────────────────────────────────────────────────

function toLocalDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function todayStr(): string {
  return toLocalDateStr(new Date());
}

function offsetDate(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + days);
  return toLocalDateStr(d);
}

function formatTime(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
  } catch {
    return iso;
  }
}

function numAvg(nums: number[]): number | null {
  if (!nums.length) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function passRate(cycles: IHotColdPressCycleListItem[]): string {
  if (!cycles.length) return "—";
  const passed = cycles.filter(
    (c) =>
      (c.hot_temp_avg_diff === null || Math.abs(c.hot_temp_avg_diff) <= 5) &&
      (c.cold_temp_avg_diff === null || Math.abs(c.cold_temp_avg_diff) <= 5) &&
      (c.hot_duration_diff === null || Math.abs(c.hot_duration_diff) <= 5) &&
      (c.cold_duration_diff === null || Math.abs(c.cold_duration_diff) <= 5) &&
      (c.cycle_duration_diff === null || Math.abs(c.cycle_duration_diff) <= 5)
  ).length;
  return `${Math.round((passed / cycles.length) * 100)}%`;
}

// ── DiffBadge ─────────────────────────────────────────────────────────────────

function DiffBadge({
  diff,
  unit,
  tolerance,
}: {
  diff: number | null;
  unit: string;
  tolerance: number;
}) {
  if (diff === null) return null;
  const ok = Math.abs(diff) <= tolerance;
  const sign = diff > 0 ? "+" : "";
  return (
    <Badge
      colorScheme={ok ? "green" : "red"}
      fontSize="9px"
      px={1}
      borderRadius="sm"
    >
      {sign}{diff}{unit}
    </Badge>
  );
}

// ── Grouping ──────────────────────────────────────────────────────────────────

interface ProcessGroup {
  processPk: number;
  processCode: string;
  cycles: IHotColdPressCycleListItem[];
}

interface MachineGroup {
  machineIotId: string;
  processes: ProcessGroup[];
  totalCycles: number;
}

function groupCycles(cycles: IHotColdPressCycleListItem[]): MachineGroup[] {
  const machineMap = new Map<string, Map<string, ProcessGroup>>();
  for (const cycle of cycles) {
    if (!machineMap.has(cycle.machine_iot_id)) {
      machineMap.set(cycle.machine_iot_id, new Map());
    }
    const processMap = machineMap.get(cycle.machine_iot_id)!;
    const key = String(cycle.process_pk);
    if (!processMap.has(key)) {
      processMap.set(key, {
        processPk: cycle.process_pk,
        processCode: cycle.process_code,
        cycles: [],
      });
    }
    processMap.get(key)!.cycles.push(cycle);
  }
  return Array.from(machineMap.entries()).map(([machineIotId, processMap]) => {
    const processes = Array.from(processMap.values());
    return {
      machineIotId,
      processes,
      totalCycles: processes.reduce((sum, p) => sum + p.cycles.length, 0),
    };
  });
}

// ── ProcessSection ────────────────────────────────────────────────────────────

function ProcessSection({
  proc,
  borderColor,
  headerBg,
  hotColBg,
  coldColBg,
  hotThBg,
  coldThBg,
  labelColor,
}: {
  proc: ProcessGroup;
  borderColor: string;
  headerBg: string;
  hotColBg: string;
  coldColBg: string;
  hotThBg: string;
  coldThBg: string;
  labelColor: string;
}) {
  const [expanded, setExpanded] = useState(false);

  const avgHot = numAvg(
    proc.cycles
      .filter((c) => c.hot_temp_avg_c !== null)
      .map((c) => parseFloat(c.hot_temp_avg_c!))
  );
  const avgCold = numAvg(
    proc.cycles
      .filter((c) => c.cold_temp_avg_c !== null)
      .map((c) => parseFloat(c.cold_temp_avg_c!))
  );

  return (
    <Box borderTop="1px solid" borderColor={borderColor}>
      {/* Process header row */}
      <Flex
        px={4}
        py={2}
        bg={headerBg}
        align="center"
        justify="space-between"
        cursor="pointer"
        onClick={() => setExpanded((e) => !e)}
        _hover={{ opacity: 0.85 }}
      >
        <HStack spacing={3} flexWrap="wrap">
          <Text fontSize="sm" fontWeight="semibold" color="blue.500">
            {proc.processCode}
          </Text>
          <Badge colorScheme="gray" fontSize="xs">
            {proc.cycles.length} {proc.cycles.length === 1 ? "cycle" : "cycles"}
          </Badge>
          {avgHot !== null && (
            <Text fontSize="xs" color={labelColor}>
              🔥 avg {avgHot.toFixed(1)}°C
            </Text>
          )}
          {avgCold !== null && (
            <Text fontSize="xs" color={labelColor}>
              ❄️ avg {avgCold.toFixed(1)}°C
            </Text>
          )}
          <Badge colorScheme="green" fontSize="xs">
            Pass {passRate(proc.cycles)}
          </Badge>
        </HStack>
        <Text fontSize="xs" color={labelColor}>
          {expanded ? "▲" : "▼"}
        </Text>
      </Flex>

      {/* Cycle table */}
      {expanded && (
        <TableContainer>
          <Table size="sm" variant="simple">
            <Thead>
              <Tr>
                <Th px={2} colSpan={2} />
                <Th
                  px={2}
                  colSpan={2}
                  textAlign="center"
                  bg={hotThBg}
                  color="orange.600"
                  fontSize="10px"
                  borderLeft="2px solid"
                  borderColor="orange.300"
                >
                  🔥 HOT Phase
                </Th>
                <Th
                  px={2}
                  colSpan={2}
                  textAlign="center"
                  bg={coldThBg}
                  color="blue.600"
                  fontSize="10px"
                  borderLeft="2px solid"
                  borderColor="blue.300"
                >
                  ❄️ COLD Phase
                </Th>
                <Th px={2} colSpan={3} />
              </Tr>
              <Tr bg={headerBg}>
                <Th fontSize="10px" px={2} isNumeric>
                  Cycle #
                </Th>
                <Th fontSize="10px" px={2}>
                  Start Time
                </Th>
                <Th
                  fontSize="10px"
                  px={2}
                  isNumeric
                  bg={hotColBg}
                  borderLeft="2px solid"
                  borderColor="orange.300"
                >
                  Avg Temp
                </Th>
                <Th fontSize="10px" px={2} isNumeric bg={hotColBg}>
                  Duration (s)
                </Th>
                <Th
                  fontSize="10px"
                  px={2}
                  isNumeric
                  bg={coldColBg}
                  borderLeft="2px solid"
                  borderColor="blue.300"
                >
                  Avg Temp
                </Th>
                <Th fontSize="10px" px={2} isNumeric bg={coldColBg}>
                  Duration (s)
                </Th>
                <Th fontSize="10px" px={2} isNumeric>
                  Total (s)
                </Th>
                <Th fontSize="10px" px={2} isNumeric>
                  Peak Temp
                </Th>
                <Th fontSize="10px" px={2} />
              </Tr>
            </Thead>
            <Tbody>
              {proc.cycles.map((cycle) => (
                <Tr key={cycle.id} _hover={{ bg: headerBg }}>
                  <Td px={2} isNumeric>
                    <Text fontSize="xs" fontWeight="bold">
                      #{cycle.cycle_no}
                    </Text>
                  </Td>
                  <Td px={2}>
                    <Text fontSize="xs" whiteSpace="nowrap">
                      {formatTime(cycle.started_at)}
                    </Text>
                  </Td>

                  {/* HOT Avg Temp */}
                  <Td
                    px={2}
                    isNumeric
                    bg={hotColBg}
                    borderLeft="2px solid"
                    borderColor="orange.200"
                  >
                    <VStack spacing={0} align="flex-end">
                      {cycle.hot_temp_avg_c ? (
                        <>
                          <Text fontSize="xs">
                            {parseFloat(cycle.hot_temp_avg_c).toFixed(1)}°C
                          </Text>
                          <DiffBadge
                            diff={cycle.hot_temp_avg_diff}
                            unit="°C"
                            tolerance={5}
                          />
                        </>
                      ) : (
                        <Text fontSize="xs" color="gray.400">
                          —
                        </Text>
                      )}
                    </VStack>
                  </Td>

                  {/* HOT Duration */}
                  <Td px={2} isNumeric bg={hotColBg}>
                    <VStack spacing={0} align="flex-end">
                      {cycle.hot_duration_s ? (
                        <>
                          <Text fontSize="xs">
                            {parseFloat(cycle.hot_duration_s).toFixed(1)}s
                          </Text>
                          <DiffBadge
                            diff={cycle.hot_duration_diff}
                            unit="s"
                            tolerance={5}
                          />
                        </>
                      ) : (
                        <Text fontSize="xs" color="gray.400">
                          —
                        </Text>
                      )}
                    </VStack>
                  </Td>

                  {/* COLD Avg Temp */}
                  <Td
                    px={2}
                    isNumeric
                    bg={coldColBg}
                    borderLeft="2px solid"
                    borderColor="blue.200"
                  >
                    <VStack spacing={0} align="flex-end">
                      {cycle.cold_temp_avg_c ? (
                        <>
                          <Text fontSize="xs">
                            {parseFloat(cycle.cold_temp_avg_c).toFixed(1)}°C
                          </Text>
                          <DiffBadge
                            diff={cycle.cold_temp_avg_diff}
                            unit="°C"
                            tolerance={5}
                          />
                        </>
                      ) : (
                        <Text fontSize="xs" color="gray.400">
                          —
                        </Text>
                      )}
                    </VStack>
                  </Td>

                  {/* COLD Duration */}
                  <Td px={2} isNumeric bg={coldColBg}>
                    <VStack spacing={0} align="flex-end">
                      {cycle.cold_duration_s ? (
                        <>
                          <Text fontSize="xs">
                            {parseFloat(cycle.cold_duration_s).toFixed(1)}s
                          </Text>
                          <DiffBadge
                            diff={cycle.cold_duration_diff}
                            unit="s"
                            tolerance={5}
                          />
                        </>
                      ) : (
                        <Text fontSize="xs" color="gray.400">
                          —
                        </Text>
                      )}
                    </VStack>
                  </Td>

                  {/* Total */}
                  <Td px={2} isNumeric>
                    <VStack spacing={0} align="flex-end">
                      <Text fontSize="xs">
                        {parseFloat(cycle.duration_s).toFixed(1)}s
                      </Text>
                      <DiffBadge
                        diff={cycle.cycle_duration_diff}
                        unit="s"
                        tolerance={5}
                      />
                    </VStack>
                  </Td>

                  {/* Peak Temp */}
                  <Td px={2} isNumeric>
                    <Text fontSize="xs">
                      {parseFloat(cycle.temp_max_c).toFixed(1)}°C
                    </Text>
                  </Td>

                  {/* Detail link */}
                  <Td px={2}>
                    <Tooltip label="View detail">
                      <IconButton
                        as={RouterLink}
                        to={`/ep-production/iot-press-cycles/${cycle.id}`}
                        aria-label="View detail"
                        icon={<FaExternalLinkAlt size={11} />}
                        size="xs"
                        variant="ghost"
                        colorScheme="blue"
                      />
                    </Tooltip>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function HotColdPressIoTList() {
  const [date, setDate] = useState(todayStr());

  const borderColor = useColorModeValue("gray.200", "gray.600");
  const headerBg = useColorModeValue("gray.50", "gray.750");
  const hotColBg = useColorModeValue("orange.50", "rgba(251,146,60,0.08)");
  const coldColBg = useColorModeValue("blue.50", "rgba(96,165,250,0.08)");
  const hotThBg = useColorModeValue("orange.100", "rgba(251,146,60,0.18)");
  const coldThBg = useColorModeValue("blue.100", "rgba(96,165,250,0.18)");
  const labelColor = useColorModeValue("gray.500", "gray.400");
  const machineBg = useColorModeValue("gray.100", "gray.700");
  const connectedColor = useColorModeValue("green.400", "green.300");

  const { data: cycles = [], isLoading } = useQuery<IHotColdPressCycleListItem[]>({
    queryKey: hotColdPressKeys.allCycles({ date }),
    queryFn: () => getHotColdPressCycleList({ date }),
  });

  const groups = useMemo(() => groupCycles(cycles), [cycles]);
  const totalProcesses = groups.reduce((s, g) => s + g.processes.length, 0);

  const dailySummary = useMemo(() => {
    if (!cycles.length) return null;
    const TOL = 5;
    let hotTempSum = 0, hotTempN = 0, hotTempPass = 0;
    let coldTempSum = 0, coldTempN = 0, coldTempPass = 0;
    let cycleDurSum = 0, cycleDurN = 0, cycleDurPass = 0;
    let overallPass = 0;
    for (const c of cycles) {
      const htOk = c.hot_temp_avg_diff !== null && Math.abs(c.hot_temp_avg_diff) <= TOL;
      const ctOk = c.cold_temp_avg_diff !== null && Math.abs(c.cold_temp_avg_diff) <= TOL;
      const cdOk = c.cycle_duration_diff !== null && Math.abs(c.cycle_duration_diff) <= TOL;
      if (c.hot_temp_avg_c !== null) { hotTempSum += parseFloat(c.hot_temp_avg_c); hotTempN++; if (htOk) hotTempPass++; }
      if (c.cold_temp_avg_c !== null) { coldTempSum += parseFloat(c.cold_temp_avg_c); coldTempN++; if (ctOk) coldTempPass++; }
      if (c.duration_s !== null) { cycleDurSum += parseFloat(c.duration_s); cycleDurN++; if (cdOk) cycleDurPass++; }
      if (htOk && ctOk && cdOk) overallPass++;
    }
    const pct = (n: number, total: number) => total ? Math.round((n / total) * 100) : null;
    return {
      machines: groups.length,
      processes: totalProcesses,
      total: cycles.length,
      hotTempAvg: hotTempN ? (hotTempSum / hotTempN).toFixed(1) : null,
      hotTempPass: pct(hotTempPass, hotTempN),
      coldTempAvg: coldTempN ? (coldTempSum / coldTempN).toFixed(1) : null,
      coldTempPass: pct(coldTempPass, coldTempN),
      cycleDurAvg: cycleDurN ? (cycleDurSum / cycleDurN).toFixed(1) : null,
      cycleDurPass: pct(cycleDurPass, cycleDurN),
      overallPass: pct(overallPass, cycles.length),
    };
  }, [cycles, groups, totalProcesses]);

  return (
    <Box px={{ base: 4, md: 8 }} py={6} maxW="1400px" mx="auto">
      <Helmet>
        <title>HC Press IoT Record</title>
      </Helmet>

      {/* ── Header ── */}
      <Flex
        align="center"
        justify="space-between"
        mb={5}
        flexWrap="wrap"
        gap={3}
      >
        <Heading size="md">🔥❄️ Hot &amp; Cold Press — IoT Daily Record</Heading>
        <HStack spacing={2}>
          <IconButton
            aria-label="Previous day"
            icon={<FaChevronLeft />}
            size="sm"
            variant="outline"
            onClick={() => setDate((d) => offsetDate(d, -1))}
          />
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            style={{
              padding: "4px 8px",
              borderRadius: "6px",
              border: "1px solid #CBD5E0",
              fontSize: "14px",
            }}
          />
          <IconButton
            aria-label="Next day"
            icon={<FaChevronRight />}
            size="sm"
            variant="outline"
            isDisabled={date >= todayStr()}
            onClick={() => setDate((d) => offsetDate(d, 1))}
          />
          <Button
            size="sm"
            variant="outline"
            onClick={() => setDate(todayStr())}
          >
            Today
          </Button>
        </HStack>
      </Flex>

      {/* ── Daily Summary Card ── */}
      {!isLoading && dailySummary && (
        <Box
          mb={5}
          border="1px solid"
          borderColor={borderColor}
          borderRadius="lg"
          overflow="hidden"
        >
          {/* top strip */}
          <Flex px={4} py={2} bg={headerBg} align="center" justify="space-between">
            <Text fontSize="xs" fontWeight="semibold" color={labelColor} textTransform="uppercase" letterSpacing="wide">
              Daily Summary
            </Text>
            <HStack spacing={2}>
              <Badge colorScheme="purple" fontSize="xs">{dailySummary.machines} {dailySummary.machines === 1 ? "Machine" : "Machines"}</Badge>
              <Badge colorScheme="blue" fontSize="xs">{dailySummary.processes} {dailySummary.processes === 1 ? "Process" : "Processes"}</Badge>
            </HStack>
          </Flex>
          <Divider />
          <SimpleGrid columns={{ base: 2, sm: 3, md: 5 }} spacing={0}>
            {/* Total Cycles */}
            <Flex direction="column" align="center" justify="center" px={4} py={4} borderRight="1px solid" borderColor={borderColor}>
              <Stat textAlign="center">
                <StatNumber fontSize="2xl">{dailySummary.total}</StatNumber>
                <StatLabel fontSize="xs" color={labelColor}>Total Cycles</StatLabel>
              </Stat>
            </Flex>

            {/* HOT Temp */}
            <Flex direction="column" align="center" justify="center" px={4} py={4} bg={hotColBg} borderRight="1px solid" borderColor={borderColor}>
              <Stat textAlign="center">
                <HStack justify="center" spacing={1} mb={1}>
                  <Text fontSize="sm">🔥</Text>
                  <StatNumber fontSize="xl" color="orange.500">
                    {dailySummary.hotTempAvg !== null ? `${dailySummary.hotTempAvg}°C` : "—"}
                  </StatNumber>
                </HStack>
                <StatLabel fontSize="xs" color={labelColor}>HOT Avg Temp</StatLabel>
                <StatHelpText mb={0}>
                  <Badge
                    colorScheme={dailySummary.hotTempPass !== null && dailySummary.hotTempPass >= 80 ? "green" : "red"}
                    fontSize="xs"
                  >
                    {dailySummary.hotTempPass !== null ? `${dailySummary.hotTempPass}% pass` : "—"}
                  </Badge>
                </StatHelpText>
              </Stat>
            </Flex>

            {/* COLD Temp */}
            <Flex direction="column" align="center" justify="center" px={4} py={4} bg={coldColBg} borderRight="1px solid" borderColor={borderColor}>
              <Stat textAlign="center">
                <HStack justify="center" spacing={1} mb={1}>
                  <Text fontSize="sm">❄️</Text>
                  <StatNumber fontSize="xl" color="blue.500">
                    {dailySummary.coldTempAvg !== null ? `${dailySummary.coldTempAvg}°C` : "—"}
                  </StatNumber>
                </HStack>
                <StatLabel fontSize="xs" color={labelColor}>COLD Avg Temp</StatLabel>
                <StatHelpText mb={0}>
                  <Badge
                    colorScheme={dailySummary.coldTempPass !== null && dailySummary.coldTempPass >= 80 ? "green" : "red"}
                    fontSize="xs"
                  >
                    {dailySummary.coldTempPass !== null ? `${dailySummary.coldTempPass}% pass` : "—"}
                  </Badge>
                </StatHelpText>
              </Stat>
            </Flex>

            {/* Cycle Duration */}
            <Flex direction="column" align="center" justify="center" px={4} py={4} borderRight="1px solid" borderColor={borderColor}>
              <Stat textAlign="center">
                <StatNumber fontSize="xl">
                  {dailySummary.cycleDurAvg !== null ? `${dailySummary.cycleDurAvg}s` : "—"}
                </StatNumber>
                <StatLabel fontSize="xs" color={labelColor}>Avg Cycle Duration</StatLabel>
                <StatHelpText mb={0}>
                  <Badge
                    colorScheme={dailySummary.cycleDurPass !== null && dailySummary.cycleDurPass >= 80 ? "green" : "red"}
                    fontSize="xs"
                  >
                    {dailySummary.cycleDurPass !== null ? `${dailySummary.cycleDurPass}% pass` : "—"}
                  </Badge>
                </StatHelpText>
              </Stat>
            </Flex>

            {/* Overall Pass */}
            <Flex direction="column" align="center" justify="center" px={4} py={4}>
              <Stat textAlign="center">
                <StatNumber
                  fontSize="2xl"
                  color={
                    dailySummary.overallPass === null ? undefined
                    : dailySummary.overallPass >= 80 ? "green.500"
                    : dailySummary.overallPass >= 60 ? "yellow.500"
                    : "red.500"
                  }
                >
                  {dailySummary.overallPass !== null ? `${dailySummary.overallPass}%` : "—"}
                </StatNumber>
                <StatLabel fontSize="xs" color={labelColor}>Overall Pass Rate</StatLabel>
              </Stat>
            </Flex>
          </SimpleGrid>
        </Box>
      )}

      {/* ── Body ── */}
      {isLoading ? (
        <Flex justify="center" py={16}>
          <Spinner size="lg" />
        </Flex>
      ) : cycles.length === 0 ? (
        <Box py={16} textAlign="center">
          <Text color={labelColor} fontSize="md">
            No cycles recorded on {date}.
          </Text>
          <Text color={labelColor} fontSize="sm" mt={1}>
            Try a different date or check the device connection status.
          </Text>
        </Box>
      ) : (
        <Accordion
          allowMultiple
          defaultIndex={groups.map((_, i) => i)}
        >
          {groups.map((machine) => (
            <AccordionItem
              key={machine.machineIotId}
              border="1px solid"
              borderColor={borderColor}
              borderRadius="lg"
              mb={4}
              overflow="hidden"
            >
              {/* Machine header */}
              <AccordionButton
                bg={machineBg}
                _hover={{ opacity: 0.85 }}
                px={4}
                py={3}
              >
                <HStack flex={1} spacing={3} flexWrap="wrap">
                  <Box
                    w="10px"
                    h="10px"
                    borderRadius="full"
                    bg={connectedColor}
                    flexShrink={0}
                    boxShadow="0 0 5px 1px var(--chakra-colors-green-300)"
                  />
                  <Text fontWeight="bold" fontSize="md">
                    {machine.machineIotId}
                  </Text>
                  <Badge colorScheme="blue" fontSize="xs">
                    {machine.processes.length} {machine.processes.length === 1 ? "Process" : "Processes"}
                  </Badge>
                  <Badge colorScheme="teal" fontSize="xs">
                    {machine.totalCycles} {machine.totalCycles === 1 ? "Cycle" : "Cycles"}
                  </Badge>
                </HStack>
                <AccordionIcon />
              </AccordionButton>

              {/* Process sections */}
              <AccordionPanel p={0}>
                {machine.processes.map((proc) => (
                  <ProcessSection
                    key={proc.processPk}
                    proc={proc}
                    borderColor={borderColor}
                    headerBg={headerBg}
                    hotColBg={hotColBg}
                    coldColBg={coldColBg}
                    hotThBg={hotThBg}
                    coldThBg={coldThBg}
                    labelColor={labelColor}
                  />
                ))}
              </AccordionPanel>
            </AccordionItem>
          ))}
        </Accordion>
      )}
    </Box>
  );
}
