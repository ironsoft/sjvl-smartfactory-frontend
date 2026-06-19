import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Badge,
  Box,
  Button,
  Divider,
  Flex,
  FormControl,
  FormLabel,
  HStack,
  Input,
  InputGroup,
  InputRightElement,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Spinner,
  Tab,
  TabList,
  TabPanel,
  TabPanels,
  Tabs,
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
  useToast,
} from "@chakra-ui/react";
import { FaChevronLeft, FaChevronRight } from "react-icons/fa";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import PressIoTLivePanel from "./PressIoTLivePanel";
import { usePressIoT } from "../hooks/usePressIoT";
import {
  getActiveWeldingPressJob,
  createWeldingPressJob,
  endWeldingPressJob,
  getHotColdPressCycleList,
  getSjStyles,
  IWeldingPressJob,
  IHotColdPressCycleListItem,
  ISjStyleListResponse,
} from "../api";
import { weldingPressJobKeys, hotColdPressKeys } from "../lib/queryKeys";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  machineIotId: string;
  machineName?: string;
  machineCode?: string;
  pressIoT?: ReturnType<typeof usePressIoT>;
  activeIotId?: string;
  onSetActiveIotId?: (id: string | undefined) => void;
}

function DiffCell({
  actual,
  diff,
  unit,
  tolerance,
  stdLabel,
}: {
  actual: string | null;
  diff: number | null;
  unit: string;
  tolerance: number;
  stdLabel: string;
}) {
  if (actual === null || actual === undefined) {
    return <Text fontSize="xs" color="gray.400">—</Text>;
  }
  const diffOk = diff === null ? null : Math.abs(diff) <= tolerance;
  const sign = diff !== null && diff > 0 ? "+" : "";
  return (
    <VStack spacing={0} align="flex-end">
      <Text fontSize="sm" fontWeight="semibold">
        {parseFloat(actual).toFixed(1)}{unit}
      </Text>
      {diff !== null ? (
        <Badge
          colorScheme={diffOk ? "green" : "red"}
          fontSize="9px"
          px={1}
          borderRadius="sm"
        >
          {sign}{diff}{unit} vs {stdLabel}
        </Badge>
      ) : (
        <Text fontSize="9px" color="gray.400">vs {stdLabel}</Text>
      )}
    </VStack>
  );
}

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function offsetDate(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatTime(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleString("en-US", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
  } catch {
    return iso;
  }
}

function PhaseCard({
  phase,
  tempValue,
  onTempChange,
  durationValue,
  onDurationChange,
  disabled,
}: {
  phase: "hot" | "cold";
  tempValue: string;
  onTempChange: (v: string) => void;
  durationValue: string;
  onDurationChange: (v: string) => void;
  disabled?: boolean;
}) {
  const isHot = phase === "hot";
  const accentBg = useColorModeValue(
    isHot ? "orange.50" : "blue.50",
    isHot ? "orange.900" : "blue.900"
  );
  const borderCol = useColorModeValue(
    isHot ? "orange.200" : "blue.200",
    isHot ? "orange.700" : "blue.700"
  );
  const titleColor = isHot ? "orange.500" : "blue.500";

  return (
    <Box
      flex={1}
      minW="200px"
      bg={accentBg}
      border="1px solid"
      borderColor={borderCol}
      borderRadius="lg"
      p={4}
      opacity={disabled ? 0.5 : 1}
    >
      <HStack mb={3} spacing={1}>
        <Text fontSize="sm">{isHot ? "🔥" : "❄️"}</Text>
        <Text fontSize="sm" fontWeight="bold" color={titleColor}>
          {isHot ? "HOT Phase" : "COLD Phase"}
        </Text>
      </HStack>
      <VStack spacing={3} align="stretch">
        <FormControl>
          <FormLabel fontSize="xs" mb={1}>Standard Temperature (°C)</FormLabel>
          <Input
            size="sm"
            type="number"
            step="0.1"
            bg="white"
            value={tempValue}
            onChange={(e) => onTempChange(e.target.value)}
            isDisabled={disabled}
          />
        </FormControl>
        <FormControl>
          <FormLabel fontSize="xs" mb={1}>Standard Press Duration (s)</FormLabel>
          <Input
            size="sm"
            type="number"
            step="0.1"
            bg="white"
            value={durationValue}
            onChange={(e) => onDurationChange(e.target.value)}
            isDisabled={disabled}
          />
        </FormControl>
      </VStack>
    </Box>
  );
}

export default function WeldingRoomIoTModal({
  isOpen,
  onClose,
  machineIotId,
  machineName,
  machineCode,
  pressIoT: pressIoTProp,
  activeIotId: activeIotIdProp,
  onSetActiveIotId,
}: Props) {
  const toast = useToast();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState(0);
  const [processName, setProcessName] = useState("");
  const [styleNumber, setStyleNumber] = useState("");
  const [stdHotTemp, setStdHotTemp] = useState("145.0");
  const [stdColdTemp, setStdColdTemp] = useState("25.0");
  const [stdHotDuration, setStdHotDuration] = useState("30.0");
  const [stdColdDuration, setStdColdDuration] = useState("30.0");
  const [stdCycleDuration, setStdCycleDuration] = useState("60.0");
  const [toleranceTemp, setToleranceTemp] = useState("5.0");
  const [toleranceDuration, setToleranceDuration] = useState("5.0");
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [starting, setStarting] = useState(false);
  const [ending, setEnding] = useState(false);

  const [styleInputVal, setStyleInputVal] = useState("");
  const [styleQuery, setStyleQuery] = useState("");
  const [styleDropdownOpen, setStyleDropdownOpen] = useState(false);
  const [styleSelected, setStyleSelected] = useState(false);
  const styleContainerRef = useRef<HTMLDivElement>(null);

  const [internalActiveIotId, setInternalActiveIotId] = useState<string | undefined>(undefined);
  const activeIotId = pressIoTProp ? activeIotIdProp : internalActiveIotId;
  const setActiveIotId = onSetActiveIotId ?? setInternalActiveIotId;

  const initializedRef = useRef(false);

  const borderColor = useColorModeValue("gray.200", "gray.600");
  const dropdownBg = useColorModeValue("white", "gray.700");
  const dropdownHoverBg = useColorModeValue("blue.50", "blue.900");
  const headerBg = useColorModeValue("gray.50", "gray.750");
  const labelColor = useColorModeValue("gray.500", "gray.400");
  const connectedColor = useColorModeValue("green.400", "green.300");
  const disconnectedColor = useColorModeValue("gray.300", "gray.600");
  const hotColBg = useColorModeValue("orange.50", "rgba(251,146,60,0.08)");
  const coldColBg = useColorModeValue("blue.50", "rgba(96,165,250,0.08)");
  const hotThBg = useColorModeValue("orange.100", "rgba(251,146,60,0.18)");
  const coldThBg = useColorModeValue("blue.100", "rgba(96,165,250,0.18)");
  const activeJobBg = useColorModeValue("green.50", "green.900");
  const activeJobBorder = useColorModeValue("green.200", "green.700");

  // Active job query
  const { data: activeJob, isLoading: jobLoading } = useQuery<IWeldingPressJob | null>({
    queryKey: weldingPressJobKeys.active(machineIotId),
    queryFn: () => getActiveWeldingPressJob(machineIotId),
    enabled: isOpen && !!machineIotId,
    refetchInterval: isOpen ? 10_000 : false,
  });

  const isToday = selectedDate === todayStr();

  // Cycle history using existing global endpoint filtered by machine_iot_id
  const { data: cycles = [], isLoading: cyclesLoading } = useQuery<IHotColdPressCycleListItem[]>({
    queryKey: hotColdPressKeys.allCycles({ date: selectedDate, machineIotId }),
    queryFn: () => getHotColdPressCycleList({ date: selectedDate, machine_iot_id: machineIotId }),
    enabled: isOpen && !!machineIotId,
    refetchInterval: isOpen && isToday ? 5_000 : false,
  });

  // Debounce style search (skip if a style was just selected from dropdown)
  useEffect(() => {
    if (styleSelected) return;
    if (styleInputVal.length < 2) {
      setStyleQuery("");
      setStyleDropdownOpen(false);
      return;
    }
    const t = setTimeout(() => {
      setStyleQuery(styleInputVal);
      setStyleDropdownOpen(true);
    }, 300);
    return () => clearTimeout(t);
  }, [styleInputVal, styleSelected]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (styleContainerRef.current && !styleContainerRef.current.contains(e.target as Node)) {
        setStyleDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // SJ Style search
  const { data: styleSearchData, isFetching: styleSearching } = useQuery<ISjStyleListResponse>({
    queryKey: ["sjStyleSearch", styleQuery],
    queryFn: () => getSjStyles({ search: styleQuery }),
    enabled: styleQuery.length >= 2,
    staleTime: 30_000,
  });
  const styleOptions = styleSearchData?.results ?? [];

  // Initialize form from active job when modal opens
  useEffect(() => {
    if (!isOpen) {
      initializedRef.current = false;
      setSelectedDate(todayStr());
      setStyleInputVal("");
      setStyleQuery("");
      setStyleDropdownOpen(false);
      setStyleSelected(false);
      return;
    }
    if (!jobLoading && !initializedRef.current) {
      initializedRef.current = true;
      if (activeJob) {
        // Pre-fill form with active job's std values for editing convenience
        setStdHotTemp(activeJob.std_hot_temp_c ?? "145.0");
        setStdColdTemp(activeJob.std_cold_temp_c ?? "25.0");
        setStdHotDuration(activeJob.std_hot_duration_s ?? "30.0");
        setStdColdDuration(activeJob.std_cold_duration_s ?? "30.0");
        setStdCycleDuration(activeJob.std_cycle_duration_s ?? "60.0");
        setToleranceTemp(activeJob.tolerance_temp_c ?? "5.0");
        setToleranceDuration(activeJob.tolerance_duration_s ?? "5.0");
      } else {
        // No active job → jump to settings tab
        setActiveTab(2);
      }
      // Auto-connect MQTT if machineIotId is set
      if (machineIotId && !activeIotId) {
        setActiveIotId(machineIotId);
      }
    }
  }, [activeJob, jobLoading, isOpen, machineIotId]);

  // Derived std labels from active job (for cycle history columns)
  const stdHotTempLabel  = activeJob ? `${parseFloat(activeJob.std_hot_temp_c).toFixed(1)}°C`  : "—";
  const stdColdTempLabel = activeJob ? `${parseFloat(activeJob.std_cold_temp_c).toFixed(1)}°C` : "—";
  const stdHotDurLabel   = activeJob ? `${parseFloat(activeJob.std_hot_duration_s).toFixed(1)}s` : "—";
  const stdColdDurLabel  = activeJob ? `${parseFloat(activeJob.std_cold_duration_s).toFixed(1)}s` : "—";
  const stdCycleDurLabel = activeJob ? `${parseFloat(activeJob.std_cycle_duration_s).toFixed(1)}s` : "—";
  const toleranceVal     = activeJob ? parseFloat(activeJob.tolerance_temp_c)    : 5;
  const toleranceDurVal  = activeJob ? parseFloat(activeJob.tolerance_duration_s) : 5;

  // Daily summary stats
  const dailySummary = useMemo(() => {
    if (!activeJob || cycles.length === 0) return null;
    const TOL_T = toleranceVal;
    const TOL_D = toleranceDurVal;
    let hotTempSum = 0, hotTempCount = 0, hotTempPass = 0;
    let coldTempSum = 0, coldTempCount = 0, coldTempPass = 0;
    let cycleDurSum = 0, cycleDurCount = 0, cycleDurPass = 0;
    let overallPass = 0;

    for (const c of cycles) {
      const htOk = c.hot_temp_avg_diff !== null && Math.abs(c.hot_temp_avg_diff) <= TOL_T;
      const ctOk = c.cold_temp_avg_diff !== null && Math.abs(c.cold_temp_avg_diff) <= TOL_T;
      const cdOk = c.cycle_duration_diff !== null && Math.abs(c.cycle_duration_diff) <= TOL_D;
      if (c.hot_temp_avg_c !== null) { hotTempSum += parseFloat(c.hot_temp_avg_c); hotTempCount++; if (htOk) hotTempPass++; }
      if (c.cold_temp_avg_c !== null) { coldTempSum += parseFloat(c.cold_temp_avg_c); coldTempCount++; if (ctOk) coldTempPass++; }
      if (c.duration_s !== null) { cycleDurSum += parseFloat(c.duration_s); cycleDurCount++; if (cdOk) cycleDurPass++; }
      if (htOk && ctOk && cdOk) overallPass++;
    }

    return {
      total: cycles.length,
      hotTempAvg: hotTempCount ? (hotTempSum / hotTempCount).toFixed(1) : null,
      hotTempPassPct: hotTempCount ? Math.round((hotTempPass / hotTempCount) * 100) : null,
      coldTempAvg: coldTempCount ? (coldTempSum / coldTempCount).toFixed(1) : null,
      coldTempPassPct: coldTempCount ? Math.round((coldTempPass / coldTempCount) * 100) : null,
      cycleDurAvg: cycleDurCount ? (cycleDurSum / cycleDurCount).toFixed(1) : null,
      cycleDurPassPct: cycleDurCount ? Math.round((cycleDurPass / cycleDurCount) * 100) : null,
      overallPassPct: cycles.length ? Math.round((overallPass / cycles.length) * 100) : null,
    };
  }, [cycles, activeJob, toleranceVal, toleranceDurVal]);

  const internalPressIoT = usePressIoT(pressIoTProp ? undefined : internalActiveIotId);
  const pressIoT = pressIoTProp ?? internalPressIoT;

  const handleStartJob = async () => {
    if (!processName.trim()) {
      toast({ title: "Process Name is required.", status: "warning", duration: 2000, position: "bottom-right" });
      return;
    }
    if (!machineIotId) {
      toast({ title: "Machine IoT ID is not set for this machine.", status: "warning", duration: 2000, position: "bottom-right" });
      return;
    }
    setStarting(true);
    try {
      await createWeldingPressJob({
        machine_iot_id: machineIotId,
        process_name: processName.trim(),
        style_number: styleNumber.trim(),
        std_hot_temp_c: stdHotTemp,
        std_cold_temp_c: stdColdTemp,
        std_hot_duration_s: stdHotDuration,
        std_cold_duration_s: stdColdDuration,
        std_cycle_duration_s: stdCycleDuration,
        tolerance_temp_c: toleranceTemp,
        tolerance_duration_s: toleranceDuration,
      });
      // Ensure MQTT is connected
      if (!activeIotId) {
        setActiveIotId(machineIotId);
      }
      queryClient.invalidateQueries({ queryKey: weldingPressJobKeys.active(machineIotId) });
      queryClient.invalidateQueries({ queryKey: weldingPressJobKeys.list(machineIotId) });
      queryClient.invalidateQueries({ queryKey: hotColdPressKeys.allCycles({ date: selectedDate, machineIotId }) });
      setProcessName("");
      setStyleNumber("");
      setStyleInputVal("");
      setStyleSelected(false);
      setActiveTab(0); // Live Monitor 탭으로 이동
      toast({ title: "Job started.", status: "success", duration: 2000, position: "bottom-right" });
    } catch {
      toast({ title: "Failed to start job.", status: "error", duration: 2000, position: "bottom-right" });
    }
    setStarting(false);
  };

  const handleEndJob = async () => {
    if (!activeJob) return;
    setEnding(true);
    try {
      await endWeldingPressJob(activeJob.pk);
      queryClient.invalidateQueries({ queryKey: weldingPressJobKeys.active(machineIotId) });
      queryClient.invalidateQueries({ queryKey: weldingPressJobKeys.list(machineIotId) });
      toast({ title: "Job ended.", status: "success", duration: 2000, position: "bottom-right" });
    } catch {
      toast({ title: "Failed to end job.", status: "error", duration: 2000, position: "bottom-right" });
    }
    setEnding(false);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="6xl" scrollBehavior="inside">
      <ModalOverlay />
      <ModalContent maxH="90vh">

        {/* Header */}
        <ModalHeader pb={2}>
          <HStack spacing={3} align="center">
            <Tooltip
              label={
                pressIoT.status === "connected" ? "Live Monitor connected" :
                pressIoT.status === "connecting" ? "Connecting…" :
                "Live Monitor disconnected"
              }
              placement="top"
              hasArrow
            >
              <Box
                w="12px" h="12px"
                borderRadius="full"
                bg={
                  pressIoT.status === "connected"  ? connectedColor :
                  pressIoT.status === "connecting" ? "yellow.400" :
                  disconnectedColor
                }
                boxShadow={pressIoT.status === "connected" ? "0 0 6px 2px var(--chakra-colors-green-300)" : "none"}
                flexShrink={0}
                transition="background 0.3s"
              />
            </Tooltip>
            <Box>
              <Text fontSize="md" fontWeight="bold" lineHeight={1.2}>
                Hot &amp; Cold Press — IoT Monitor
              </Text>
              <Text fontSize="xs" color={labelColor} fontWeight="normal">
                {machineCode ?? machineIotId}{activeIotId ? ` — ${activeIotId}` : ""}
                {activeJob && (
                  <> · <Text as="span" color="green.500" fontWeight="semibold">{activeJob.process_name}</Text>
                  {activeJob.style_number && <> / {activeJob.style_number}</>}</>
                )}
              </Text>
            </Box>
            <Badge
              colorScheme={
                pressIoT.status === "connected"  ? "green" :
                pressIoT.status === "connecting" ? "yellow" :
                "gray"
              }
              fontSize="xs"
            >
              {pressIoT.status === "connected"  ? "CONNECTED" :
               pressIoT.status === "connecting" ? "Connecting…" :
               "Disconnected"}
            </Badge>
            {jobLoading && <Spinner size="xs" />}
          </HStack>
        </ModalHeader>
        <ModalCloseButton />

        <ModalBody px={0} pt={0}>
          <Tabs variant="enclosed" size="sm" colorScheme="blue" index={activeTab} onChange={setActiveTab}>
            <TabList px={4} pt={2}>
              <Tab>📡 Live Monitor</Tab>
              <Tab>📋 Cycle History</Tab>
              <Tab>⚙️ Job &amp; Settings</Tab>
            </TabList>

            <TabPanels>
              {/* Tab 1: Live Monitor */}
              <TabPanel p={0}>
                <PressIoTLivePanel
                  setup={activeJob ? {
                    id: 0,
                    machine_iot_id: activeJob.machine_iot_id,
                    std_hot_temp_c: activeJob.std_hot_temp_c,
                    std_cold_temp_c: activeJob.std_cold_temp_c,
                    std_hot_duration_s: activeJob.std_hot_duration_s,
                    std_cold_duration_s: activeJob.std_cold_duration_s,
                    std_cycle_duration_s: activeJob.std_cycle_duration_s,
                    tolerance_temp_c: activeJob.tolerance_temp_c,
                    tolerance_duration_s: activeJob.tolerance_duration_s,
                    last_heartbeat_at: null,
                    is_connected: true,
                    created_at: activeJob.started_at,
                    updated_at: activeJob.started_at,
                  } : null}
                  tolerance={toleranceVal}
                  pressIoT={pressIoT}
                />
              </TabPanel>

              {/* Tab 2: Cycle History */}
              <TabPanel px={4} pt={3}>
                {/* Date navigation */}
                <HStack justify="space-between" mb={3}>
                  <Button size="xs" leftIcon={<FaChevronLeft />} variant="ghost"
                    onClick={() => setSelectedDate((d) => offsetDate(d, -1))}>
                    Prev
                  </Button>
                  <Text fontSize="sm" fontWeight="semibold">{selectedDate}</Text>
                  <Button size="xs" rightIcon={<FaChevronRight />} variant="ghost"
                    isDisabled={isToday}
                    onClick={() => setSelectedDate((d) => offsetDate(d, 1))}>
                    Next
                  </Button>
                </HStack>

                {/* Daily summary */}
                {dailySummary && (
                  <>
                    <Flex mb={3} px={3} py={2} borderRadius="md" border="1px solid" borderColor={borderColor} wrap="wrap" gap={0} overflow="hidden">
                      <Flex flex={1} minW="200px" bg={hotColBg} px={3} py={2} gap={4}>
                        <VStack spacing={0} align="center" minW="70px">
                          <Text fontSize="13px" fontWeight="bold">{dailySummary.hotTempAvg !== null ? `${dailySummary.hotTempAvg}°C` : "—"}</Text>
                          <Badge colorScheme={dailySummary.hotTempPassPct !== null && dailySummary.hotTempPassPct >= 80 ? "green" : "red"} fontSize="9px">
                            {dailySummary.hotTempPassPct !== null ? `${dailySummary.hotTempPassPct}% pass` : "—"}
                          </Badge>
                          <Text fontSize="9px" color={labelColor}>HOT Temp</Text>
                        </VStack>
                        <Divider orientation="vertical" h="36px" />
                        <VStack spacing={0} align="center" minW="70px">
                          <Text fontSize="13px" fontWeight="bold">{dailySummary.coldTempAvg !== null ? `${dailySummary.coldTempAvg}°C` : "—"}</Text>
                          <Badge colorScheme={dailySummary.coldTempPassPct !== null && dailySummary.coldTempPassPct >= 80 ? "green" : "red"} fontSize="9px">
                            {dailySummary.coldTempPassPct !== null ? `${dailySummary.coldTempPassPct}% pass` : "—"}
                          </Badge>
                          <Text fontSize="9px" color={labelColor}>COLD Temp</Text>
                        </VStack>
                        <Divider orientation="vertical" h="36px" />
                        <VStack spacing={0} align="center" minW="70px">
                          <Text fontSize="13px" fontWeight="bold">{dailySummary.cycleDurAvg !== null ? `${dailySummary.cycleDurAvg}s` : "—"}</Text>
                          <Badge colorScheme={dailySummary.cycleDurPassPct !== null && dailySummary.cycleDurPassPct >= 80 ? "green" : "red"} fontSize="9px">
                            {dailySummary.cycleDurPassPct !== null ? `${dailySummary.cycleDurPassPct}% pass` : "—"}
                          </Badge>
                          <Text fontSize="9px" color={labelColor}>Cycle Duration</Text>
                        </VStack>
                        <Divider orientation="vertical" h="36px" />
                        <VStack spacing={0} align="center" minW="60px">
                          <Text fontSize="16px" fontWeight="bold"
                            color={dailySummary.overallPassPct === null ? undefined : dailySummary.overallPassPct >= 80 ? "green.500" : dailySummary.overallPassPct >= 60 ? "yellow.500" : "red.500"}>
                            {dailySummary.overallPassPct !== null ? `${dailySummary.overallPassPct}%` : "—"}
                          </Text>
                          <Text fontSize="9px" color={labelColor} textTransform="uppercase">Overall Pass</Text>
                        </VStack>
                      </Flex>
                    </Flex>
                    <Divider mb={3} />
                  </>
                )}

                {/* Cycle table */}
                {!activeJob ? (
                  <Box py={8} textAlign="center">
                    <Text color={labelColor} fontSize="sm">Start a job first to record press cycles.</Text>
                  </Box>
                ) : cyclesLoading ? (
                  <Flex justify="center" py={8}><Spinner /></Flex>
                ) : cycles.length === 0 ? (
                  <Box py={8} textAlign="center">
                    <Text color={labelColor} fontSize="sm">
                      {isToday ? "No cycle data received yet." : `No cycle records for ${selectedDate}.`}
                    </Text>
                    {isToday && (
                      <Text color={labelColor} fontSize="xs" mt={1}>
                        Press cycles will appear here in real-time once the machine is connected.
                      </Text>
                    )}
                  </Box>
                ) : (
                  <TableContainer>
                    <Table size="sm" variant="simple">
                      <Thead>
                        <Tr>
                          <Th px={2} colSpan={2} />
                          <Th px={2} colSpan={2} textAlign="center" bg={hotThBg} color="orange.600" fontSize="10px" borderLeft="2px solid" borderColor="orange.300">🔥 HOT Phase</Th>
                          <Th px={2} colSpan={2} textAlign="center" bg={coldThBg} color="blue.600" fontSize="10px" borderLeft="2px solid" borderColor="blue.300">❄️ COLD Phase</Th>
                          <Th px={2} colSpan={3} />
                        </Tr>
                        <Tr bg={headerBg}>
                          <Th fontSize="10px" px={2} isNumeric>Cycle #</Th>
                          <Th fontSize="10px" px={2}>Start Time</Th>
                          <Th fontSize="10px" px={2} isNumeric bg={hotColBg} borderLeft="2px solid" borderColor="orange.300">
                            Avg Temp<Text fontSize="9px" color={labelColor} fontWeight="normal">std {stdHotTempLabel}</Text>
                          </Th>
                          <Th fontSize="10px" px={2} isNumeric bg={hotColBg}>
                            Duration (s)<Text fontSize="9px" color={labelColor} fontWeight="normal">std {stdHotDurLabel}</Text>
                          </Th>
                          <Th fontSize="10px" px={2} isNumeric bg={coldColBg} borderLeft="2px solid" borderColor="blue.300">
                            Avg Temp<Text fontSize="9px" color={labelColor} fontWeight="normal">std {stdColdTempLabel}</Text>
                          </Th>
                          <Th fontSize="10px" px={2} isNumeric bg={coldColBg}>
                            Duration (s)<Text fontSize="9px" color={labelColor} fontWeight="normal">std {stdColdDurLabel}</Text>
                          </Th>
                          <Th fontSize="10px" px={2} isNumeric>
                            Total (s)<Text fontSize="9px" color={labelColor} fontWeight="normal">std {stdCycleDurLabel}</Text>
                          </Th>
                          <Th fontSize="10px" px={2} isNumeric>Peak Temp</Th>
                          <Th fontSize="10px" px={2} isNumeric>Max Current</Th>
                        </Tr>
                      </Thead>
                      <Tbody>
                        {cycles.map((cycle) => (
                          <Tr key={cycle.id} _hover={{ bg: headerBg }}>
                            <Td px={2} isNumeric><Text fontSize="sm" fontWeight="bold">#{cycle.cycle_no}</Text></Td>
                            <Td px={2}><Text fontSize="xs" whiteSpace="nowrap">{formatTime(cycle.started_at)}</Text></Td>
                            <Td px={2} isNumeric bg={hotColBg} borderLeft="2px solid" borderColor="orange.200">
                              <DiffCell actual={cycle.hot_temp_avg_c} diff={cycle.hot_temp_avg_diff} unit="°C" tolerance={toleranceVal} stdLabel={stdHotTempLabel} />
                            </Td>
                            <Td px={2} isNumeric bg={hotColBg}>
                              <DiffCell actual={cycle.hot_duration_s} diff={cycle.hot_duration_diff} unit="s" tolerance={toleranceDurVal} stdLabel={stdHotDurLabel} />
                            </Td>
                            <Td px={2} isNumeric bg={coldColBg} borderLeft="2px solid" borderColor="blue.200">
                              <DiffCell actual={cycle.cold_temp_avg_c} diff={cycle.cold_temp_avg_diff} unit="°C" tolerance={toleranceVal} stdLabel={stdColdTempLabel} />
                            </Td>
                            <Td px={2} isNumeric bg={coldColBg}>
                              <DiffCell actual={cycle.cold_duration_s} diff={cycle.cold_duration_diff} unit="s" tolerance={toleranceDurVal} stdLabel={stdColdDurLabel} />
                            </Td>
                            <Td px={2} isNumeric>
                              <DiffCell actual={cycle.duration_s} diff={cycle.cycle_duration_diff} unit="s" tolerance={toleranceDurVal} stdLabel={stdCycleDurLabel} />
                            </Td>
                            <Td px={2} isNumeric><Text fontSize="sm">{parseFloat(cycle.temp_max_c).toFixed(1)}°C</Text></Td>
                            <Td px={2} isNumeric><Text fontSize="sm">{parseFloat(cycle.current_max_a).toFixed(2)}A</Text></Td>
                          </Tr>
                        ))}
                      </Tbody>
                    </Table>
                  </TableContainer>
                )}
              </TabPanel>

              {/* Tab 3: Job & Settings */}
              <TabPanel px={4} pt={4}>
                <VStack spacing={5} align="stretch">

                  {/* Current Active Job */}
                  {jobLoading ? (
                    <Flex justify="center" py={4}><Spinner /></Flex>
                  ) : activeJob ? (
                    <Box
                      p={4}
                      borderRadius="lg"
                      border="1px solid"
                      borderColor={activeJobBorder}
                      bg={activeJobBg}
                    >
                      <HStack justify="space-between" mb={2}>
                        <HStack spacing={2}>
                          <Box w="8px" h="8px" borderRadius="full" bg="green.400" />
                          <Text fontSize="sm" fontWeight="bold" color="green.600">Active Job</Text>
                        </HStack>
                        <Button
                          size="xs"
                          colorScheme="red"
                          variant="outline"
                          isLoading={ending}
                          onClick={handleEndJob}
                        >
                          End Job
                        </Button>
                      </HStack>
                      <VStack spacing={1} align="flex-start">
                        <HStack>
                          <Text fontSize="xs" color={labelColor} w="80px">Process:</Text>
                          <Text fontSize="sm" fontWeight="semibold">{activeJob.process_name}</Text>
                        </HStack>
                        {activeJob.style_number && (
                          <HStack>
                            <Text fontSize="xs" color={labelColor} w="80px">Style #:</Text>
                            <Text fontSize="sm">{activeJob.style_number}</Text>
                          </HStack>
                        )}
                        <HStack>
                          <Text fontSize="xs" color={labelColor} w="80px">Started:</Text>
                          <Text fontSize="xs">{formatTime(activeJob.started_at)}</Text>
                        </HStack>
                        <HStack>
                          <Text fontSize="xs" color={labelColor} w="80px">By:</Text>
                          <Text fontSize="xs">{activeJob.created_by_username}</Text>
                        </HStack>
                        <Divider pt={1} />
                        <HStack pt={1} spacing={4} flexWrap="wrap">
                          <Text fontSize="xs" color="orange.500">🔥 HOT: {parseFloat(activeJob.std_hot_temp_c).toFixed(0)}°C / {parseFloat(activeJob.std_hot_duration_s).toFixed(0)}s</Text>
                          <Text fontSize="xs" color="blue.500">❄️ COLD: {parseFloat(activeJob.std_cold_temp_c).toFixed(0)}°C / {parseFloat(activeJob.std_cold_duration_s).toFixed(0)}s</Text>
                          <Text fontSize="xs" color={labelColor}>Tol: ±{parseFloat(activeJob.tolerance_temp_c).toFixed(1)}°C / ±{parseFloat(activeJob.tolerance_duration_s).toFixed(1)}s</Text>
                        </HStack>
                      </VStack>
                    </Box>
                  ) : (
                    <Box p={3} borderRadius="md" border="1px dashed" borderColor={borderColor} textAlign="center">
                      <Text fontSize="sm" color={labelColor}>No active job. Fill in the form below to start one.</Text>
                    </Box>
                  )}

                  <Divider />

                  {/* Start New Job form */}
                  <Text fontSize="sm" fontWeight="semibold" color={labelColor}>
                    {activeJob ? "Start New Job (will end current)" : "Start New Job"}
                  </Text>

                  <HStack spacing={4} align="flex-start">
                    <FormControl flex={1} isRequired>
                      <FormLabel fontSize="xs" mb={1}>Process Name (공정명)</FormLabel>
                      <Input
                        size="sm"
                        placeholder="e.g. 핫프레스 부착, Hot Press Lamination"
                        value={processName}
                        onChange={(e) => setProcessName(e.target.value)}
                      />
                    </FormControl>
                    <FormControl flex={1}>
                      <FormLabel fontSize="xs" mb={1}>Style Number (스타일 번호)</FormLabel>
                      <Box position="relative" ref={styleContainerRef}>
                        <InputGroup size="sm">
                          <Input
                            size="sm"
                            placeholder="Search style code or name…"
                            value={styleInputVal}
                            autoComplete="off"
                            onChange={(e) => {
                              setStyleSelected(false);
                              setStyleInputVal(e.target.value);
                              setStyleNumber(e.target.value);
                            }}
                            onFocus={() => {
                              if (styleInputVal.length >= 2 && styleOptions.length > 0) {
                                setStyleDropdownOpen(true);
                              }
                            }}
                          />
                          {styleSearching && (
                            <InputRightElement pointerEvents="none">
                              <Spinner size="xs" color="gray.400" />
                            </InputRightElement>
                          )}
                          {styleInputVal && !styleSearching && (
                            <InputRightElement>
                              <Button
                                size="xs"
                                variant="ghost"
                                h="auto"
                                minW="auto"
                                p={1}
                                color="gray.400"
                                _hover={{ color: "gray.600" }}
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  setStyleInputVal("");
                                  setStyleNumber("");
                                  setStyleSelected(false);
                                  setStyleDropdownOpen(false);
                                }}
                              >
                                ✕
                              </Button>
                            </InputRightElement>
                          )}
                        </InputGroup>
                        {styleDropdownOpen && styleOptions.length > 0 && (
                          <Box
                            position="absolute"
                            top="100%"
                            left={0}
                            right={0}
                            zIndex={1400}
                            bg={dropdownBg}
                            border="1px solid"
                            borderColor={borderColor}
                            borderRadius="md"
                            boxShadow="md"
                            maxH="200px"
                            overflowY="auto"
                            mt={1}
                          >
                            {styleOptions.map((s) => (
                              <Box
                                key={s.pk}
                                px={3}
                                py={2}
                                cursor="pointer"
                                _hover={{ bg: dropdownHoverBg }}
                                onMouseDown={() => {
                                  setStyleNumber(s.code);
                                  setStyleInputVal(`${s.code} — ${s.style_name}`);
                                  setStyleSelected(true);
                                  setStyleDropdownOpen(false);
                                }}
                              >
                                <Text fontSize="sm" fontWeight="semibold">{s.code}</Text>
                                <Text fontSize="xs" color={labelColor}>{s.style_name}</Text>
                              </Box>
                            ))}
                          </Box>
                        )}
                      </Box>
                    </FormControl>
                  </HStack>

                  {/* Phase cards */}
                  <Flex gap={4} wrap="wrap">
                    <PhaseCard
                      phase="hot"
                      tempValue={stdHotTemp}
                      onTempChange={setStdHotTemp}
                      durationValue={stdHotDuration}
                      onDurationChange={setStdHotDuration}
                    />
                    <PhaseCard
                      phase="cold"
                      tempValue={stdColdTemp}
                      onTempChange={setStdColdTemp}
                      durationValue={stdColdDuration}
                      onDurationChange={setStdColdDuration}
                    />
                  </Flex>

                  {/* Cycle & Tolerance */}
                  <Flex gap={4} wrap="wrap">
                    <FormControl flex={1} minW="140px">
                      <FormLabel fontSize="xs" mb={1}>Std Cycle Duration (s)</FormLabel>
                      <Input size="sm" type="number" step="1" value={stdCycleDuration} onChange={(e) => setStdCycleDuration(e.target.value)} />
                    </FormControl>
                    <FormControl flex={1} minW="140px">
                      <FormLabel fontSize="xs" mb={1}>Temp Tolerance (±°C)</FormLabel>
                      <Input size="sm" type="number" step="0.5" value={toleranceTemp} onChange={(e) => setToleranceTemp(e.target.value)} />
                    </FormControl>
                    <FormControl flex={1} minW="140px">
                      <FormLabel fontSize="xs" mb={1}>Duration Tolerance (±s)</FormLabel>
                      <Input size="sm" type="number" step="0.5" value={toleranceDuration} onChange={(e) => setToleranceDuration(e.target.value)} />
                    </FormControl>
                  </Flex>

                  {/* Machine info */}
                  <Box p={3} borderRadius="md" border="1px solid" borderColor={borderColor} bg={headerBg}>
                    <HStack spacing={2}>
                      <Text fontSize="xs" color={labelColor}>Machine:</Text>
                      <Text fontSize="sm" fontWeight="semibold">{machineName ?? machineCode ?? "—"}</Text>
                      {machineIotId && (
                        <Badge colorScheme="blue" fontSize="xs">IoT: {machineIotId}</Badge>
                      )}
                    </HStack>
                  </Box>

                  <Button
                    colorScheme="teal"
                    size="md"
                    isLoading={starting}
                    loadingText="Starting…"
                    onClick={handleStartJob}
                    isDisabled={!machineIotId}
                  >
                    ▶ Start Job &amp; Connect
                  </Button>
                </VStack>
              </TabPanel>
            </TabPanels>
          </Tabs>
        </ModalBody>

        <ModalFooter>
          <Button onClick={onClose} size="sm">Close</Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
