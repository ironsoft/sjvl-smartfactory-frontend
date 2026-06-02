import React, { useEffect, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";
import { Link as RouterLink } from "react-router-dom";
import {
  Badge,
  Box,
  Button,
  Divider,
  Flex,
  FormControl,
  FormLabel,
  HStack,
  IconButton,
  Input,
  Link,
  List,
  ListItem,
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
  getEpProcessIoTSetup,
  getEpProcessIoTCycles,
  saveEpProcessIoTSetup,
  disconnectIoTSetup,
  checkIotConnection,
  getMachines,
  IHotColdPressSetup,
  IHotColdPressCycle,
  IIotConnectionCheckResult,
  IMachineListResponse,
} from "../api";
import { hotColdPressKeys } from "../lib/queryKeys";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  processPk: number;
  processCode?: string;
  // Optional: when provided, MQTT connection lives in parent (persists across modal close/open)
  pressIoT?: ReturnType<typeof usePressIoT>;
  activeIotId?: string;
  onSetActiveIotId?: (id: string | undefined) => void;
}

// Diff badge — green if within tolerance, red if outside
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

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
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

// Phase section card used inside the settings panel
function PhaseCard({
  phase,
  tempValue,
  onTempChange,
  durationValue,
  onDurationChange,
}: {
  phase: "hot" | "cold";
  tempValue: string;
  onTempChange: (v: string) => void;
  durationValue: string;
  onDurationChange: (v: string) => void;
}) {
  const isHot = phase === "hot";
  const accentBg  = useColorModeValue(
    isHot ? "orange.50"  : "blue.50",
    isHot ? "orange.900" : "blue.900"
  );
  const borderCol = useColorModeValue(
    isHot ? "orange.200" : "blue.200",
    isHot ? "orange.700" : "blue.700"
  );
  const titleColor = isHot ? "orange.500" : "blue.500";
  const icon = isHot ? "🔥" : "❄️";

  return (
    <Box
      flex={1}
      minW="200px"
      bg={accentBg}
      border="1px solid"
      borderColor={borderCol}
      borderRadius="lg"
      p={4}
    >
      <HStack mb={3} spacing={1}>
        <Text fontSize="sm">{icon}</Text>
        <Text fontSize="sm" fontWeight="bold" color={titleColor}>
          {isHot ? "HOT Phase" : "COLD Phase"}
        </Text>
      </HStack>
      <VStack spacing={3} align="stretch">
        <FormControl>
          <FormLabel fontSize="xs" mb={1}>
            Standard Temperature (°C)
          </FormLabel>
          <Input
            size="sm"
            type="number"
            step="0.1"
            bg="white"
            value={tempValue}
            onChange={(e) => onTempChange(e.target.value)}
          />
        </FormControl>
        <FormControl>
          <FormLabel fontSize="xs" mb={1}>
            Standard Press Duration (s)
          </FormLabel>
          <Input
            size="sm"
            type="number"
            step="0.1"
            bg="white"
            value={durationValue}
            onChange={(e) => onDurationChange(e.target.value)}
          />
        </FormControl>
      </VStack>
    </Box>
  );
}

export default function HotColdPressIoTModal({
  isOpen,
  onClose,
  processPk,
  processCode,
  pressIoT: pressIoTProp,
  activeIotId: activeIotIdProp,
  onSetActiveIotId,
}: Props) {
  const toast = useToast();
  const queryClient = useQueryClient();

  const [showSettings, setShowSettings] = useState(false);
  const [machineIoTId, setMachineIoTId] = useState("");
  const [stdHotTemp, setStdHotTemp] = useState("145.0");
  const [stdColdTemp, setStdColdTemp] = useState("25.0");
  const [stdHotDuration, setStdHotDuration] = useState("30.0");
  const [stdColdDuration, setStdColdDuration] = useState("30.0");
  const [stdCycleDuration, setStdCycleDuration] = useState("60.0");
  const [toleranceTemp, setToleranceTemp] = useState("5.0");
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [saving, setSaving] = useState(false);
  const [checking, setChecking] = useState(false);
  const [checkResult, setCheckResult] = useState<IIotConnectionCheckResult | null>(null);
  const [showQr, setShowQr] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState("");

  // Machine picker state
  const [iotMachineSearch, setIotMachineSearch] = useState("");
  const [iotSelectedMachine, setIotSelectedMachine] = useState<{ pk: number; code: string; name: string; machine_iot_id: string } | null>(null);
  const [showIotMachineSuggestions, setShowIotMachineSuggestions] = useState(false);
  const iotMachineBlurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Internal state used when parent doesn't provide pressIoT (e.g. EpScheduleList)
  const [internalActiveIotId, setInternalActiveIotId] = useState<string | undefined>(undefined);
  // Use parent-provided values when available (persists across modal close), otherwise use internal
  const activeIotId    = pressIoTProp ? activeIotIdProp : internalActiveIotId;
  const setActiveIotId = onSetActiveIotId ?? setInternalActiveIotId;

  const initializedRef = useRef(false);

  const borderColor     = useColorModeValue("gray.200", "gray.600");
  const headerBg        = useColorModeValue("gray.50",  "gray.750");
  const settingsHoverBg = useColorModeValue("gray.100", "gray.700");
  const labelColor      = useColorModeValue("gray.500", "gray.400");
  const connectedColor  = useColorModeValue("green.400", "green.300");
  const disconnectedColor = useColorModeValue("gray.300", "gray.600");

  const suggestionBg        = useColorModeValue("white",    "gray.700");
  const suggestionBorderColor = useColorModeValue("gray.200", "gray.600");
  const suggestionHoverBg   = useColorModeValue("gray.50",  "gray.600");

  // Machine search query for IoT ID picker
  const { data: iotMachineSuggestions } = useQuery<IMachineListResponse>({
    queryKey: ["iotMachineSuggestions", iotMachineSearch],
    queryFn: () => getMachines({ search: iotMachineSearch }),
    enabled: showSettings && iotMachineSearch.length > 0,
  });

  // Reverse-lookup: find machine by activeIotId when iotSelectedMachine is not set
  const { data: connectedMachineLookup } = useQuery<IMachineListResponse>({
    queryKey: ["machineByIotId", activeIotId],
    queryFn: () => getMachines({ search: activeIotId! }),
    enabled: !!activeIotId && !iotSelectedMachine,
  });

  // Use lookup result if picker hasn't set iotSelectedMachine
  const connectedMachine = iotSelectedMachine ?? (
    connectedMachineLookup?.results.find((m) => m.machine_iot_id === activeIotId) ?? null
  );

  // Hot / Cold column tints for the table
  const hotColBg  = useColorModeValue("orange.50",  "rgba(251,146,60,0.08)");
  const coldColBg = useColorModeValue("blue.50",    "rgba(96,165,250,0.08)");
  const hotThBg   = useColorModeValue("orange.100", "rgba(251,146,60,0.18)");
  const coldThBg  = useColorModeValue("blue.100",   "rgba(96,165,250,0.18)");

  // ── Queries ──────────────────────────────────────────────────────────────

  const { data: setup, isLoading: setupLoading } = useQuery<IHotColdPressSetup | null>({
    queryKey: hotColdPressKeys.setup(processPk),
    queryFn: () => getEpProcessIoTSetup(processPk),
    enabled: isOpen,
    refetchInterval: isOpen ? 10_000 : false,
  });

  const isToday = selectedDate === todayStr();

  const { data: cycles = [], isLoading: cyclesLoading } = useQuery<IHotColdPressCycle[]>({
    queryKey: hotColdPressKeys.cycles(processPk, selectedDate),
    queryFn: () => getEpProcessIoTCycles(processPk, { date: selectedDate }),
    enabled: isOpen && !!setup,
    refetchInterval: isOpen && isToday ? 5_000 : false,
  });

  // Initialize form from fetched setup — once per open
  useEffect(() => {
    if (!isOpen) {
      initializedRef.current = false;
      setCheckResult(null);
      setSelectedDate(todayStr());
      setIotMachineSearch("");
      setIotSelectedMachine(null);
      // pressIoTProp 사용 시: 부모가 관리하므로 건드리지 않음 (연결 유지)
      // internal 사용 시: 모달 닫아도 유지 (Disconnect 버튼으로만 해제)
      return;
    }
    if (!setupLoading && !initializedRef.current) {
      initializedRef.current = true;
      if (setup) {
        setStdHotTemp(setup.std_hot_temp_c ?? "145.0");
        setStdColdTemp(setup.std_cold_temp_c ?? "25.0");
        setStdHotDuration(setup.std_hot_duration_s ?? "30.0");
        setStdColdDuration(setup.std_cold_duration_s ?? "30.0");
        setStdCycleDuration(setup.std_cycle_duration_s ?? "60.0");
        setToleranceTemp(setup.tolerance_temp_c ?? "5.0");
        setShowSettings(false);
        // 저장된 machine_iot_id가 있으면 자동 연결 (아직 연결 안 된 경우에만)
        if (setup.machine_iot_id && !activeIotId) {
          setMachineIoTId(setup.machine_iot_id);
          setActiveIotId(setup.machine_iot_id);
        } else if (activeIotId) {
          // 이미 연결 중 — 필드에 현재 IoT ID 표시
          setMachineIoTId(activeIotId);
        }
      } else {
        setShowSettings(true);
      }
    }
  }, [setup, setupLoading, isOpen]);

  // QR 코드 생성 — processPk가 확정되면 한 번만 생성
  useEffect(() => {
    if (!processPk) return;
    const url = `${window.location.origin}/public/iot-setup/${processPk}`;
    QRCode.toDataURL(url, { margin: 1, width: 160 }).then(setQrDataUrl).catch(() => {});
  }, [processPk]);

  // ── Handlers ─────────────────────────────────────────────────────────────

  // QR 상세 페이지를 모바일 사이즈의 독립 팝업창으로 연다
  const openIoTSetupWindow = () => {
    if (!processPk) return;
    const url = `${window.location.origin}/public/iot-setup/${processPk}`;
    const width = 390; // iPhone 14 기준 논리 너비
    const height = 844;
    const left = Math.max(0, Math.round(window.screenX + (window.outerWidth - width) / 2));
    const top = Math.max(0, Math.round(window.screenY + (window.outerHeight - height) / 2));
    const features = [
      `width=${width}`,
      `height=${height}`,
      `left=${left}`,
      `top=${top}`,
      "menubar=no",
      "toolbar=no",
      "location=no",
      "status=no",
      "resizable=yes",
      "scrollbars=yes",
    ].join(",");
    window.open(url, `iot-setup-${processPk}`, features);
  };

  const handlePrintQr = () => {
    if (!qrDataUrl) return;
    const printWindow = window.open("", "_blank", "width=200,height=200");
    if (!printWindow) return;
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>IoT QR — ${processCode ?? processPk}</title>
          <style>
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body { background: white; }
            .label {
              width: 25mm;
              height: 25mm;
              display: flex;
              align-items: center;
              justify-content: center;
            }
            .label img { width: 25mm; height: 25mm; display: block; }
            @media print {
              @page { size: 25mm 25mm; margin: 0; }
              body { width: 25mm; height: 25mm; }
            }
          </style>
        </head>
        <body>
          <div class="label">
            <img src="${qrDataUrl}" alt="QR" />
          </div>
          <script>
            window.onload = function() {
              window.print();
              window.onafterprint = function() { window.close(); };
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleCheckConnection = async () => {
    if (!machineIoTId.trim()) {
      toast({ title: "Enter a Machine IoT ID first.", status: "warning", duration: 2000, position: "bottom-right" });
      return;
    }
    setChecking(true);
    setCheckResult(null);
    try {
      // Save machine_iot_id first
      await saveEpProcessIoTSetup(processPk, {
        machine_iot_id: machineIoTId.trim(),
        std_hot_temp_c: stdHotTemp,
        std_cold_temp_c: stdColdTemp,
        std_hot_duration_s: stdHotDuration,
        std_cold_duration_s: stdColdDuration,
        std_cycle_duration_s: stdCycleDuration,
        tolerance_temp_c: toleranceTemp,
      });
      queryClient.invalidateQueries({ queryKey: hotColdPressKeys.setup(processPk) });
      // Establish MQTT connection explicitly
      const newId = machineIoTId.trim();
      if (activeIotId === newId) {
        // Same ID but possibly disconnected — briefly clear to force hook cleanup+reconnect
        setActiveIotId(undefined);
        await new Promise((res) => setTimeout(res, 50));
      }
      setActiveIotId(newId);
      const [result] = await Promise.all([
        checkIotConnection(newId),
        new Promise((res) => setTimeout(res, 800)),
      ]);
      setCheckResult(result as IIotConnectionCheckResult);
    } catch {
      toast({ title: "Connection check failed.", status: "error", duration: 2000, position: "bottom-right" });
    }
    setChecking(false);
  };

  const handleSave = async () => {
    if (!machineIoTId.trim()) {
      toast({ title: "Machine IoT ID is required.", status: "warning", duration: 2000, position: "bottom-right" });
      return;
    }
    setSaving(true);
    try {
      await saveEpProcessIoTSetup(processPk, {
        machine_iot_id: machineIoTId.trim(),
        std_hot_temp_c: stdHotTemp,
        std_cold_temp_c: stdColdTemp,
        std_hot_duration_s: stdHotDuration,
        std_cold_duration_s: stdColdDuration,
        std_cycle_duration_s: stdCycleDuration,
        tolerance_temp_c: toleranceTemp,
      });
      queryClient.invalidateQueries({ queryKey: hotColdPressKeys.setup(processPk) });
      queryClient.invalidateQueries({ queryKey: hotColdPressKeys.cycles(processPk) });
      setShowSettings(false);
      toast({ title: "IoT settings saved.", status: "success", duration: 2000, position: "bottom-right" });
    } catch {
      toast({ title: "Failed to save settings.", status: "error", duration: 2000, position: "bottom-right" });
    }
    setSaving(false);
  };

  // ── Derived ──────────────────────────────────────────────────────────────

  // Internal hook — only active when parent doesn't supply pressIoT
  const internalPressIoT = usePressIoT(pressIoTProp ? undefined : internalActiveIotId);
  const pressIoT = pressIoTProp ?? internalPressIoT;
  const mqttConnected = pressIoT.status === "connected";
  const isConnected   = mqttConnected;
  const toleranceVal = setup ? parseFloat(setup.tolerance_temp_c) : 5;
  const stdHotTempLabel = setup ? `${parseFloat(setup.std_hot_temp_c).toFixed(1)}°C` : "—";
  const stdColdTempLabel= setup ? `${parseFloat(setup.std_cold_temp_c).toFixed(1)}°C` : "—";
  const stdHotDurLabel  = setup ? `${parseFloat(setup.std_hot_duration_s).toFixed(1)}s` : "—";
  const stdColdDurLabel = setup ? `${parseFloat(setup.std_cold_duration_s).toFixed(1)}s` : "—";
  const stdCycleDurLabel= setup ? `${parseFloat(setup.std_cycle_duration_s).toFixed(1)}s` : "—";

  // ── Daily summary stats ───────────────────────────────────────────────────
  const dailySummary = useMemo(() => {
    if (cycles.length === 0) return null;
    const TOL = toleranceVal;

    let hotTempSum = 0, hotTempCount = 0, hotTempPass = 0;
    let coldTempSum = 0, coldTempCount = 0, coldTempPass = 0;
    let cycleDurSum = 0, cycleDurCount = 0, cycleDurPass = 0;
    let overallPass = 0;

    for (const c of cycles) {
      const htOk = c.hot_temp_avg_diff !== null && Math.abs(c.hot_temp_avg_diff) <= TOL;
      const ctOk = c.cold_temp_avg_diff !== null && Math.abs(c.cold_temp_avg_diff) <= TOL;
      const cdOk = c.cycle_duration_diff !== null && Math.abs(c.cycle_duration_diff) <= TOL;

      if (c.hot_temp_avg_c !== null) {
        hotTempSum += parseFloat(c.hot_temp_avg_c);
        hotTempCount++;
        if (htOk) hotTempPass++;
      }
      if (c.cold_temp_avg_c !== null) {
        coldTempSum += parseFloat(c.cold_temp_avg_c);
        coldTempCount++;
        if (ctOk) coldTempPass++;
      }
      if (c.duration_s !== null) {
        cycleDurSum += parseFloat(c.duration_s);
        cycleDurCount++;
        if (cdOk) cycleDurPass++;
      }
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
  }, [cycles, toleranceVal]);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="6xl" scrollBehavior="inside">
      <ModalOverlay />
      <ModalContent maxH="90vh">

        {/* ── Header ── */}
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
                  pressIoT.status === "connected"   ? connectedColor :
                  pressIoT.status === "connecting"  ? "yellow.400" :
                  disconnectedColor
                }
                boxShadow={
                  pressIoT.status === "connected"
                    ? "0 0 6px 2px var(--chakra-colors-green-300)"
                    : "none"
                }
                flexShrink={0}
                transition="background 0.3s"
              />
            </Tooltip>
            <Box>
              <Text fontSize="md" fontWeight="bold" lineHeight={1.2}>
                Hot &amp; Cold Press — IoT Monitor
              </Text>
              {processCode && (
                <Text fontSize="xs" color={labelColor} fontWeight="normal">
                  {processCode}{activeIotId ? ` — ${activeIotId}` : ""}
                </Text>
              )}
            </Box>
            <Badge
              colorScheme={
                pressIoT.status === "connected"  ? "green" :
                pressIoT.status === "connecting" ? "yellow" :
                "gray"
              }
              fontSize="xs"
            >
              {pressIoT.status === "connected"  ? "Connected" :
               pressIoT.status === "connecting" ? "Connecting…" :
               "Disconnected"}
            </Badge>
            {setupLoading && <Spinner size="xs" />}
          </HStack>
        </ModalHeader>
        <ModalCloseButton />

        <ModalBody px={0} pt={0}>
          <Tabs variant="enclosed" size="sm" colorScheme="blue">
            <TabList px={4} pt={2}>
              <Tab>📡 Live Monitor</Tab>
              <Tab>📋 Cycle History</Tab>
            </TabList>

            <TabPanels>
              {/* ── Tab 1: Live Monitor ── */}
              <TabPanel p={0}>
                <PressIoTLivePanel setup={setup} tolerance={toleranceVal} pressIoT={pressIoT} />
              </TabPanel>

              {/* ── Tab 2: Cycle History (existing content) ── */}
              <TabPanel px={4} pt={3}>

          {/* ── Settings Panel ── */}
          <Box mb={4} border="1px solid" borderColor={borderColor} borderRadius="lg" overflow="hidden">
            <Flex
              px={4} py={2}
              bg={headerBg}
              align="center"
              justify="space-between"
              cursor="pointer"
              onClick={() => setShowSettings((s) => !s)}
              _hover={{ bg: settingsHoverBg }}
            >
              <HStack spacing={2}>
                <Text fontSize="sm" fontWeight="semibold">
                  ⚙️ Standard Settings {setup ? "(Edit)" : "(Setup Required)"}
                </Text>
                {!setup && <Badge colorScheme="orange" fontSize="9px">Not Configured</Badge>}
              </HStack>
              <Text fontSize="xs" color={labelColor}>{showSettings ? "▲" : "▼"}</Text>
            </Flex>

            {showSettings && (
              <Box px={4} py={4}>
                {/* Machine picker — connected 상태면 기계 정보+링크, 아니면 검색창 */}
                <FormControl mb={2}>
                  <FormLabel fontSize="xs" mb={1}>SJ Machine</FormLabel>
                  {activeIotId && connectedMachine ? (
                    <Box maxW="420px" p={2} borderRadius="md" border="1px solid" borderColor={suggestionBorderColor} bg={suggestionBg}>
                      <HStack spacing={2}>
                        <Box w="8px" h="8px" borderRadius="full" bg="green.400" flexShrink={0} />
                        <Link
                          as={RouterLink}
                          to={`/machines/${connectedMachine.pk}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          color="blue.500"
                          fontWeight="semibold"
                          fontSize="sm"
                          _hover={{ textDecoration: "underline" }}
                        >
                          {connectedMachine.code}
                        </Link>
                        {connectedMachine.name && (
                          <Text fontSize="sm" color={labelColor}>— {connectedMachine.name}</Text>
                        )}
                        <Badge colorScheme="blue" fontSize="xs">IoT: {connectedMachine.machine_iot_id}</Badge>
                      </HStack>
                    </Box>
                  ) : (
                  <Box position="relative" maxW="420px">
                    <Input
                      size="sm"
                      placeholder="코드 / 이름으로 검색…"
                      value={iotMachineSearch}
                      onChange={(e) => {
                        setIotMachineSearch(e.target.value);
                        setIotSelectedMachine(null);
                        setMachineIoTId("");
                        setCheckResult(null);
                      }}
                      onFocus={() => setShowIotMachineSuggestions(true)}
                      onBlur={() => {
                        iotMachineBlurTimer.current = setTimeout(() => setShowIotMachineSuggestions(false), 150);
                      }}
                    />
                    {iotSelectedMachine && (
                      <Text fontSize="xs" color="blue.400" mt={1}>
                        {iotSelectedMachine.code}{iotSelectedMachine.name ? ` — ${iotSelectedMachine.name}` : ""}
                        {" · IoT ID: "}<Text as="span" fontWeight="bold">{iotSelectedMachine.machine_iot_id || "(없음)"}</Text>
                      </Text>
                    )}
                    {showIotMachineSuggestions && iotMachineSuggestions && iotMachineSuggestions.results.length > 0 && (
                      <List
                        position="absolute"
                        zIndex={20}
                        bg={suggestionBg}
                        border="1px solid"
                        borderColor={suggestionBorderColor}
                        borderRadius="md"
                        w="full"
                        maxH="180px"
                        overflowY="auto"
                        shadow="md"
                      >
                        {iotMachineSuggestions.results.map((m) => (
                          <ListItem
                            key={m.pk}
                            px={3} py={2}
                            cursor="pointer"
                            fontSize="sm"
                            _hover={{ bg: suggestionHoverBg }}
                            onMouseDown={() => {
                              if (iotMachineBlurTimer.current) clearTimeout(iotMachineBlurTimer.current);
                              setIotSelectedMachine({ pk: m.pk, code: m.code, name: m.name, machine_iot_id: m.machine_iot_id });
                              setIotMachineSearch(m.code);
                              setShowIotMachineSuggestions(false);
                              setMachineIoTId(m.machine_iot_id);
                              setCheckResult(null);
                            }}
                          >
                            <Text as="span" fontWeight="semibold">{m.code}</Text>
                            {m.name && <Text as="span" color="gray.500"> — {m.name}</Text>}
                            {m.machine_iot_id && (
                              <Text as="span" color="blue.400" ml={2} fontSize="xs">IoT: {m.machine_iot_id}</Text>
                            )}
                          </ListItem>
                        ))}
                      </List>
                    )}
                  </Box>
                  )}
                </FormControl>

                {/* Machine IoT ID row + Connect button */}
                <FormControl mb={activeIotId ? 2 : 4}>
                  <FormLabel fontSize="xs" mb={1}>Machine IoT ID</FormLabel>
                  <HStack spacing={2} maxW="420px">
                    <Input
                      size="sm"
                      placeholder="SJ Machine 검색 후 자동 입력됩니다"
                      value={machineIoTId}
                      isReadOnly={!!iotSelectedMachine || !!activeIotId}
                      onChange={(e) => {
                        if (!activeIotId) {
                          setMachineIoTId(e.target.value);
                          setCheckResult(null);
                        }
                      }}
                      onKeyDown={(e) => { if (e.key === "Enter" && !activeIotId) handleCheckConnection(); }}
                    />
                    {activeIotId ? (
                      <Button
                        size="sm"
                        colorScheme="red"
                        variant="outline"
                        flexShrink={0}
                        onClick={async () => {
                          // 1. MQTT 연결 해제
                          pressIoT.disconnect();
                          // 2. 백엔드 machine_iot_id 클리어 (완전 Disconnect)
                          try {
                            await disconnectIoTSetup(processPk);
                          } catch {
                            // 실패해도 로컬 상태는 초기화
                          }
                          // 3. 로컬 상태 초기화
                          setActiveIotId(undefined);
                          setMachineIoTId("");
                          setIotMachineSearch("");
                          setIotSelectedMachine(null);
                          setCheckResult(null);
                          // 4. 관련 쿼리 invalidate (Welding Room 카드도 즉시 반영)
                          queryClient.invalidateQueries({ queryKey: hotColdPressKeys.setup(processPk) });
                          queryClient.invalidateQueries({ queryKey: ["weldingRoom"] });
                        }}
                      >
                        Disconnect
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        colorScheme="blue"
                        isLoading={checking}
                        loadingText="Connecting…"
                        isDisabled={!machineIoTId.trim()}
                        onClick={handleCheckConnection}
                        flexShrink={0}
                      >
                        Connect
                      </Button>
                    )}
                  </HStack>
                </FormControl>

                {/* MQTT connection status — shown after Connect is clicked */}
                {activeIotId && (
                  <Box
                    mb={4}
                    maxW="420px"
                    px={3}
                    py={2}
                    borderRadius="md"
                    border="1px solid"
                    borderColor={
                      pressIoT.status === "connected"  ? "green.300" :
                      pressIoT.status === "connecting" ? "yellow.300" : "gray.300"
                    }
                    bg={
                      pressIoT.status === "connected"  ? "green.50" :
                      pressIoT.status === "connecting" ? "yellow.50" : "gray.50"
                    }
                  >
                    <HStack spacing={2}>
                      <Box
                        w="8px" h="8px"
                        borderRadius="full"
                        bg={
                          pressIoT.status === "connected"  ? "green.400" :
                          pressIoT.status === "connecting" ? "yellow.400" : "gray.400"
                        }
                        boxShadow={pressIoT.status === "connected" ? "0 0 5px 1px var(--chakra-colors-green-300)" : "none"}
                      />
                      <Text fontSize="xs" fontWeight="semibold">
                        {pressIoT.status === "connected"
                          ? `MQTT 연결됨 — IoT ID: ${activeIotId}`
                          : pressIoT.status === "connecting"
                          ? "MQTT 연결 중…"
                          : "MQTT 연결 끊김"}
                      </Text>
                    </HStack>
                    {checkResult?.last_heartbeat_at && (
                      <Text fontSize="10px" color="gray.500" mt={1} pl={4}>
                        Last heartbeat: {formatTime(checkResult.last_heartbeat_at)}
                      </Text>
                    )}
                  </Box>
                )}

                {/* Hot / Cold side-by-side cards */}
                <Flex gap={4} wrap="wrap" mb={4}>
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

                {/* Cycle total + Tolerance */}
                <Flex gap={4} wrap="wrap" mb={4}>
                  <FormControl maxW="260px">
                    <FormLabel fontSize="xs" mb={1}>Standard Total Cycle Duration (s)</FormLabel>
                    <Input
                      size="sm"
                      type="number"
                      step="0.1"
                      value={stdCycleDuration}
                      onChange={(e) => setStdCycleDuration(e.target.value)}
                    />
                  </FormControl>
                  <FormControl maxW="200px">
                    <FormLabel fontSize="xs" mb={1}>
                      Tolerance — Temperature (°C)
                    </FormLabel>
                    <Input
                      size="sm"
                      type="number"
                      step="0.1"
                      min="0"
                      value={toleranceTemp}
                      onChange={(e) => setToleranceTemp(e.target.value)}
                    />
                  </FormControl>
                </Flex>

                <HStack spacing={2} wrap="wrap">
                  <Button size="sm" colorScheme="teal" isLoading={saving} onClick={handleSave}>
                    Save
                  </Button>
                  {setup && (
                    <Button size="sm" variant="ghost" onClick={() => setShowSettings(false)}>
                      Cancel
                    </Button>
                  )}
                  {qrDataUrl && (
                    <Button
                      size="sm"
                      variant="outline"
                      colorScheme="purple"
                      onClick={() => setShowQr((v) => !v)}
                    >
                      📱 {showQr ? "Close QR" : "Mobile QR"}
                    </Button>
                  )}
                  {processPk && (
                    <Button
                      size="sm"
                      variant="outline"
                      colorScheme="blue"
                      onClick={openIoTSetupWindow}
                    >
                      🔗 상세 페이지 열기
                    </Button>
                  )}
                </HStack>

                {/* QR 코드 팝업 */}
                {showQr && qrDataUrl && (
                  <Box
                    mt={3}
                    p={4}
                    borderRadius="lg"
                    border="2px solid"
                    borderColor="purple.200"
                    bg="purple.50"
                    maxW="240px"
                    textAlign="center"
                    cursor="pointer"
                    role="button"
                    aria-label="클릭하여 QR 프린트"
                    onClick={handlePrintQr}
                    _hover={{ bg: "purple.100", borderColor: "purple.400" }}
                    transition="all 0.15s"
                    title="클릭하여 프린트"
                  >
                    <Text fontSize="xs" fontWeight="semibold" color="purple.700" mb={1}>
                      📱 Scan with mobile to set standards
                    </Text>
                    <Text fontSize="9px" color="purple.400" mb={2}>
                      🖨️ Click to print
                    </Text>
                    <Box
                      display="inline-block"
                      p={2}
                      bg="white"
                      borderRadius="md"
                      boxShadow="sm"
                      mb={2}
                    >
                      <img src={qrDataUrl} alt="IoT Setup QR" style={{ width: 160, height: 160, display: "block" }} />
                    </Box>
                    <Text fontSize="9px" color="purple.500" wordBreak="break-all">
                      {window.location.origin}/public/iot-setup/{processPk}
                    </Text>
                  </Box>
                )}
              </Box>
            )}
          </Box>

          {/* ── Standard Reference Bar ── */}
          {setup && !showSettings && (
            <Flex
              mb={3} px={3} py={2}
              borderRadius="md"
              border="1px solid"
              borderColor={borderColor}
              wrap="wrap"
              gap={0}
              overflow="hidden"
            >
              {/* Hot side */}
              <Flex
                flex={1} minW="200px"
                bg={hotColBg}
                px={3} py={2}
                gap={4}
                align="center"
                wrap="wrap"
                borderRight="1px solid"
                borderColor={borderColor}
              >
                <HStack spacing={1}>
                  <Text fontSize="xs">🔥</Text>
                  <Text fontSize="xs" fontWeight="bold" color="orange.500">HOT</Text>
                </HStack>
                <Text fontSize="xs" color={labelColor}>
                  Temp: <Box as="b" color="orange.600">{stdHotTempLabel}</Box>
                </Text>
                <Text fontSize="xs" color={labelColor}>
                  Duration: <Box as="b" color="orange.600">{stdHotDurLabel}</Box>
                </Text>
              </Flex>
              {/* Cold side */}
              <Flex
                flex={1} minW="200px"
                bg={coldColBg}
                px={3} py={2}
                gap={4}
                align="center"
                wrap="wrap"
                borderRight="1px solid"
                borderColor={borderColor}
              >
                <HStack spacing={1}>
                  <Text fontSize="xs">❄️</Text>
                  <Text fontSize="xs" fontWeight="bold" color="blue.500">COLD</Text>
                </HStack>
                <Text fontSize="xs" color={labelColor}>
                  Temp: <Box as="b" color="blue.600">{stdColdTempLabel}</Box>
                </Text>
                <Text fontSize="xs" color={labelColor}>
                  Duration: <Box as="b" color="blue.600">{stdColdDurLabel}</Box>
                </Text>
              </Flex>
              {/* Cycle total */}
              <Flex
                minW="160px"
                px={3} py={2}
                gap={4}
                align="center"
                wrap="wrap"
                borderRight="1px solid"
                borderColor={borderColor}
              >
                <HStack spacing={1}>
                  <Text fontSize="xs">⏱</Text>
                  <Text fontSize="xs" fontWeight="bold" color="gray.500">CYCLE</Text>
                </HStack>
                <Text fontSize="xs" color={labelColor}>
                  Total: <Box as="b">{stdCycleDurLabel}</Box>
                </Text>
              </Flex>
              {/* Tolerance */}
              <Flex
                minW="120px"
                px={3} py={2}
                gap={2}
                align="center"
                wrap="wrap"
              >
                <HStack spacing={1}>
                  <Text fontSize="xs">±</Text>
                  <Text fontSize="xs" fontWeight="bold" color="purple.500">TOL</Text>
                </HStack>
                <Text fontSize="xs" color={labelColor}>
                  Temp: <Box as="b" color="purple.600">±{toleranceVal}°C</Box>
                </Text>
              </Flex>
            </Flex>
          )}

          {/* ── Date Navigation ── */}
          {setup && (
            <Flex align="center" justify="space-between" mb={dailySummary ? 2 : 3}>
              <HStack spacing={1}>
                <IconButton
                  aria-label="Previous day"
                  icon={<FaChevronLeft />}
                  size="xs"
                  variant="ghost"
                  onClick={() => setSelectedDate((d) => offsetDate(d, -1))}
                />
                <Text fontSize="sm" fontWeight="semibold" minW="200px" textAlign="center">
                  {formatDate(selectedDate)}
                </Text>
                <IconButton
                  aria-label="Next day"
                  icon={<FaChevronRight />}
                  size="xs"
                  variant="ghost"
                  isDisabled={isToday}
                  onClick={() => setSelectedDate((d) => offsetDate(d, 1))}
                />
              </HStack>
              {!isToday && (
                <Button size="xs" variant="outline" colorScheme="blue" onClick={() => setSelectedDate(todayStr())}>
                  Today
                </Button>
              )}
            </Flex>
          )}

          {/* ── Daily Summary Bar ── */}
          {setup && dailySummary && (
            <>
              <Flex
                mb={3} px={3} py={2}
                borderRadius="md"
                border="1px solid"
                borderColor={borderColor}
                bg={headerBg}
                wrap="wrap"
                gap={4}
                align="center"
              >
                <VStack spacing={0} align="center" minW="50px">
                  <Text fontSize="16px" fontWeight="bold">{dailySummary.total}</Text>
                  <Text fontSize="9px" color={labelColor} textTransform="uppercase">Cycles</Text>
                </VStack>

                <Divider orientation="vertical" h="36px" />

                <VStack spacing={0} align="center" minW="70px">
                  <HStack spacing={1}>
                    <Text fontSize="10px">🔥</Text>
                    <Text fontSize="13px" fontWeight="bold" color="orange.500">
                      {dailySummary.hotTempAvg !== null ? `${dailySummary.hotTempAvg}°C` : "—"}
                    </Text>
                  </HStack>
                  <Badge
                    colorScheme={dailySummary.hotTempPassPct !== null && dailySummary.hotTempPassPct >= 80 ? "green" : "red"}
                    fontSize="9px"
                  >
                    {dailySummary.hotTempPassPct !== null ? `${dailySummary.hotTempPassPct}% pass` : "—"}
                  </Badge>
                  <Text fontSize="9px" color={labelColor}>HOT Temp</Text>
                </VStack>

                <VStack spacing={0} align="center" minW="70px">
                  <HStack spacing={1}>
                    <Text fontSize="10px">❄️</Text>
                    <Text fontSize="13px" fontWeight="bold" color="blue.500">
                      {dailySummary.coldTempAvg !== null ? `${dailySummary.coldTempAvg}°C` : "—"}
                    </Text>
                  </HStack>
                  <Badge
                    colorScheme={dailySummary.coldTempPassPct !== null && dailySummary.coldTempPassPct >= 80 ? "green" : "red"}
                    fontSize="9px"
                  >
                    {dailySummary.coldTempPassPct !== null ? `${dailySummary.coldTempPassPct}% pass` : "—"}
                  </Badge>
                  <Text fontSize="9px" color={labelColor}>COLD Temp</Text>
                </VStack>

                <Divider orientation="vertical" h="36px" />

                <VStack spacing={0} align="center" minW="70px">
                  <Text fontSize="13px" fontWeight="bold">
                    {dailySummary.cycleDurAvg !== null ? `${dailySummary.cycleDurAvg}s` : "—"}
                  </Text>
                  <Badge
                    colorScheme={dailySummary.cycleDurPassPct !== null && dailySummary.cycleDurPassPct >= 80 ? "green" : "red"}
                    fontSize="9px"
                  >
                    {dailySummary.cycleDurPassPct !== null ? `${dailySummary.cycleDurPassPct}% pass` : "—"}
                  </Badge>
                  <Text fontSize="9px" color={labelColor}>Cycle Duration</Text>
                </VStack>

                <Divider orientation="vertical" h="36px" />

                <VStack spacing={0} align="center" minW="60px">
                  <Text
                    fontSize="16px"
                    fontWeight="bold"
                    color={
                      dailySummary.overallPassPct === null ? undefined
                      : dailySummary.overallPassPct >= 80 ? "green.500"
                      : dailySummary.overallPassPct >= 60 ? "yellow.500"
                      : "red.500"
                    }
                  >
                    {dailySummary.overallPassPct !== null ? `${dailySummary.overallPassPct}%` : "—"}
                  </Text>
                  <Text fontSize="9px" color={labelColor} textTransform="uppercase">Overall Pass</Text>
                </VStack>
              </Flex>
              <Divider mb={3} />
            </>
          )}

          {/* ── Cycle Table ── */}
          {!setup ? (
            <Box py={8} textAlign="center">
              <Text color={labelColor} fontSize="sm">
                Complete the IoT setup above to start recording press cycles here.
              </Text>
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
                  {/* Phase group header row */}
                  <Tr>
                    <Th px={2} colSpan={2} />
                    <Th
                      px={2} colSpan={2}
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
                      px={2} colSpan={2}
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
                  {/* Column header row */}
                  <Tr bg={headerBg}>
                    <Th fontSize="10px" px={2} isNumeric>Cycle #</Th>
                    <Th fontSize="10px" px={2}>Start Time</Th>

                    {/* Hot columns */}
                    <Th fontSize="10px" px={2} isNumeric bg={hotColBg} borderLeft="2px solid" borderColor="orange.300">
                      Avg Temp
                      <Text fontSize="9px" color={labelColor} fontWeight="normal">std {stdHotTempLabel}</Text>
                    </Th>
                    <Th fontSize="10px" px={2} isNumeric bg={hotColBg}>
                      Duration (s)
                      <Text fontSize="9px" color={labelColor} fontWeight="normal">std {stdHotDurLabel}</Text>
                    </Th>

                    {/* Cold columns */}
                    <Th fontSize="10px" px={2} isNumeric bg={coldColBg} borderLeft="2px solid" borderColor="blue.300">
                      Avg Temp
                      <Text fontSize="9px" color={labelColor} fontWeight="normal">std {stdColdTempLabel}</Text>
                    </Th>
                    <Th fontSize="10px" px={2} isNumeric bg={coldColBg}>
                      Duration (s)
                      <Text fontSize="9px" color={labelColor} fontWeight="normal">std {stdColdDurLabel}</Text>
                    </Th>

                    {/* General columns */}
                    <Th fontSize="10px" px={2} isNumeric>
                      Total (s)
                      <Text fontSize="9px" color={labelColor} fontWeight="normal">std {stdCycleDurLabel}</Text>
                    </Th>
                    <Th fontSize="10px" px={2} isNumeric>Peak Temp</Th>
                    <Th fontSize="10px" px={2} isNumeric>Max Current</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {cycles.map((cycle) => (
                    <Tr key={cycle.id} _hover={{ bg: headerBg }}>
                      <Td px={2} isNumeric>
                        <Text fontSize="sm" fontWeight="bold">#{cycle.cycle_no}</Text>
                      </Td>
                      <Td px={2}>
                        <Text fontSize="xs" whiteSpace="nowrap">{formatTime(cycle.started_at)}</Text>
                      </Td>

                      {/* Hot cells */}
                      <Td px={2} isNumeric bg={hotColBg} borderLeft="2px solid" borderColor="orange.200">
                        <DiffCell
                          actual={cycle.hot_temp_avg_c}
                          diff={cycle.hot_temp_avg_diff}
                          unit="°C"
                          tolerance={toleranceVal}
                          stdLabel={stdHotTempLabel}
                        />
                      </Td>
                      <Td px={2} isNumeric bg={hotColBg}>
                        <DiffCell
                          actual={cycle.hot_duration_s}
                          diff={cycle.hot_duration_diff}
                          unit="s"
                          tolerance={toleranceVal}
                          stdLabel={stdHotDurLabel}
                        />
                      </Td>

                      {/* Cold cells */}
                      <Td px={2} isNumeric bg={coldColBg} borderLeft="2px solid" borderColor="blue.200">
                        <DiffCell
                          actual={cycle.cold_temp_avg_c}
                          diff={cycle.cold_temp_avg_diff}
                          unit="°C"
                          tolerance={toleranceVal}
                          stdLabel={stdColdTempLabel}
                        />
                      </Td>
                      <Td px={2} isNumeric bg={coldColBg}>
                        <DiffCell
                          actual={cycle.cold_duration_s}
                          diff={cycle.cold_duration_diff}
                          unit="s"
                          tolerance={toleranceVal}
                          stdLabel={stdColdDurLabel}
                        />
                      </Td>

                      {/* General cells */}
                      <Td px={2} isNumeric>
                        <DiffCell
                          actual={cycle.duration_s}
                          diff={cycle.cycle_duration_diff}
                          unit="s"
                          tolerance={toleranceVal}
                          stdLabel={stdCycleDurLabel}
                        />
                      </Td>
                      <Td px={2} isNumeric>
                        <Text fontSize="sm">{parseFloat(cycle.temp_max_c).toFixed(1)}°C</Text>
                      </Td>
                      <Td px={2} isNumeric>
                        <Text fontSize="sm">{parseFloat(cycle.current_max_a).toFixed(2)}A</Text>
                      </Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            </TableContainer>
          )}

              </TabPanel>
            </TabPanels>
          </Tabs>
        </ModalBody>

        <ModalFooter pt={2}>
          <HStack spacing={2} w="100%" justify="space-between">
            <Text fontSize="xs" color={labelColor}>
              {cycles.length > 0
                ? isToday
                  ? `${cycles.length} cycle${cycles.length > 1 ? "s" : ""} today · auto-refresh every 5s`
                  : `${cycles.length} cycle${cycles.length > 1 ? "s" : ""} on ${selectedDate}`
                : ""}
            </Text>
            <Button size="sm" variant="ghost" onClick={onClose}>Close</Button>
          </HStack>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
