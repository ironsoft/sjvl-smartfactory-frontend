import {
  Badge,
  Box,
  Heading,
  Table,
  TableContainer,
  Tbody,
  Td,
  Th,
  Thead,
  Tr,
  useColorModeValue,
  useBreakpointValue,
  Spinner,
  Center,
  Text,
  Button,
  IconButton,
  HStack,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
  ModalFooter,
  useDisclosure,
  FormControl,
  FormLabel,
  Input,
  Select,
  Grid,
  useToast,
  Tooltip,
  Link,
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverBody,
  PopoverHeader,
  PopoverCloseButton,
  Checkbox,
  SimpleGrid,
  Divider,
  InputGroup,
  InputRightElement,
  List,
  ListItem,
  VStack,
} from "@chakra-ui/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Helmet } from "react-helmet";
import {
  getEpSchedules,
  createEpSchedule,
  editEpSchedule,
  IEpSchedule,
  getEpColumnPreference,
  saveEpColumnPreference,
  searchSjOrders,
  ISjOrderSearchResult,
  patchEpSjNo,
  patchEpModule,
  patchEpProcess,
  getProductionLines,
  getModuleCategories,
  type IProductionLine,
  type IModuleCategory,
  getHotColdPressIoTBulkStatus,
  type IIotProcessStatus,
} from "../api";
import { epKeys, prodKeys, hotColdPressKeys } from "../lib/queryKeys";
import SearchInput from "../components/SearchInput";
import {
  FaPlus,
  FaChevronRight,
  FaChevronDown,
  FaVideo,
  FaSlidersH,
  FaChevronLeft,
  FaSort,
  FaSortUp,
  FaSortDown,
  FaExpandAlt,
  FaCompressAlt,
  FaAngleDoubleLeft,
  FaAngleDoubleRight,
  FaThumbtack,
  FaRegFileAlt
} from "react-icons/fa";
import React, { Fragment, useState, useEffect, useRef, useMemo } from "react";
import { useTranslation } from "react-i18next";

import VideoModal from "../components/VideoModal";
import HotColdPressIoTModal from "../components/HotColdPressIoTModal";
import { useAllPressIoT } from "../hooks/useAllPressIoT";
import { PressIoTReading } from "../hooks/usePressIoT";
import { EpBadge } from "../components/EpBadge";
import { statusOptionStyle, statusSelectFieldProps } from "../components/StatusBadge";
import PhotoModal from "../components/PhotoModal";
import EpFlashQty from "../components/EpFlashQty";
import LocalizedDateInput from "../components/LocalizedDateInput";
import { formatIsoDateDisplay } from "../lib/dateLocale";
import { displayModuleCategoryName } from "../lib/moduleCategoryDisplay";
import { findPreparationEpLeafCategoryId } from "../lib/preparationEpCategory";
import { runPreparationEpModuleMigrationOnce } from "../lib/runPreparationEpModuleMigrationOnce";

const openWindow = (path: string) => {
  const w = 1200, h = 900;
  const left = Math.round((window.screen.width - w) / 2);
  const top = Math.round((window.screen.height - h) / 2);
  const sep = path.includes("?") ? "&" : "?";
  window.open(
    `${window.location.origin}${path}${sep}popup=1`,
    "_blank",
    `width=${w},height=${h},left=${left},top=${top},resizable=yes,scrollbars=yes`
  );
};

/** Node pk and all descendant pks (depth-first). */
function collectDescendantCategoryIds(
  pk: number,
  childrenByParent: Map<number | null, IModuleCategory[]>
): number[] {
  const ids: number[] = [pk];
  for (const child of childrenByParent.get(pk) ?? []) {
    ids.push(...collectDescendantCategoryIds(child.pk, childrenByParent));
  }
  return ids;
}

function subtreeCheckboxState(
  pk: number,
  childrenByParent: Map<number | null, IModuleCategory[]>,
  selectedIds: number[]
): { checked: boolean; indeterminate: boolean } {
  const subtree = collectDescendantCategoryIds(pk, childrenByParent);
  const inSel = (id: number) => selectedIds.includes(id);
  const n = subtree.filter(inSel).length;
  if (n === 0) return { checked: false, indeterminate: false };
  if (n === subtree.length) return { checked: true, indeterminate: false };
  return { checked: false, indeterminate: true };
}

/** Module categories — nested checkboxes (any depth). */
function ModuleCategoryCheckboxTree({
  parentPk,
  depth,
  childrenByParent,
  selectedIds,
  onToggle,
}: {
  parentPk: number | null;
  depth: number;
  childrenByParent: Map<number | null, IModuleCategory[]>;
  selectedIds: number[];
  onToggle: (pk: number) => void;
}) {
  const { i18n } = useTranslation();
  const nodes = childrenByParent.get(parentPk) ?? [];
  if (nodes.length === 0) return null;
  return (
    <VStack align="stretch" spacing={1} pl={depth > 0 ? 4 : 0}>
      {nodes.map((cat) => {
        const { checked, indeterminate } = subtreeCheckboxState(cat.pk, childrenByParent, selectedIds);
        return (
          <Box key={cat.pk}>
            <Checkbox
              isChecked={checked}
              isIndeterminate={indeterminate}
              onChange={() => onToggle(cat.pk)}
            >
              <Text fontSize="sm">{displayModuleCategoryName(cat, i18n.language)}</Text>
            </Checkbox>
            <ModuleCategoryCheckboxTree
              parentPk={cat.pk}
              depth={depth + 1}
              childrenByParent={childrenByParent}
              selectedIds={selectedIds}
              onToggle={onToggle}
            />
          </Box>
        );
      })}
    </VStack>
  );
}

/** Output Qty 옆 누적 불량 수량 — 클릭 시 EP 검사 목록(필터)을 독립창으로 열기 */
function DefectQtyLink({ defectQty, to }: { defectQty: number; to: string }) {
  const { t } = useTranslation();
  return (
    <Tooltip label={t("ep.list.defectQtyCumulativeTooltip")} hasArrow placement="top">
      <Link
        href="#"
        color="orange.500"
        fontWeight="semibold"
        fontSize="sm"
        _hover={{ color: "orange.600" }}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          openWindow(to);
        }}
      >
        <EpFlashQty value={defectQty}>{defectQty.toLocaleString()}</EpFlashQty>
      </Link>
    </Tooltip>
  );
}

// ── 상수 ──────────────────────────────────────────────────────────
const emptyForm = {
  sj_order: "" as string | number,
  /** 생산 라인 선택 전 공장(Factory) PK */
  factory: "" as string | number,
  production_line: "" as string | number,
  status: "not_started",
  output_qty: "" as string | number,
  /** SJ Order 선적 예정일 — 생성 시 연결 오더에 저장 */
  ex_factory_date: "",
  production_assembly_start_date: "",
  production_assembly_finish_date: "",
  process_start_date: "",
  process_finish_date: "",
  remark: "",
  /** EP 딥카피에 포함할 ModuleCategory PK (어느 레벨이든 선택 가능) */
  module_category_ids: [] as number[],
};

function formatProductionLineOption(line: IProductionLine): string {
  const ko = line.name_ko?.trim();
  return ko ? `${line.name} (${ko})` : line.name;
}

// 토글 가능 컬럼 정의 (ALL_COLUMNS 길이와 동일)
const ALL_COLUMNS = [
  { key: "production_line",    label: "Production Line" },
  { key: "sj_po_number",       label: "SJ PO#" },
  { key: "sj_no",              label: "SJ No" },
  { key: "color",              label: "Color" },
  { key: "total_qty",              label: "Total Qty" },
  { key: "assembly_output_qty",    label: "Assembly Out Qty" },
  { key: "ex_factory",             label: "EX-Factory" },
  { key: "assembly_start",     label: "Assembly Start" },
  { key: "assembly_finish",    label: "Assembly Finish" },
  { key: "flow_memo",          label: "Flow Memo" },
  { key: "category",           label: "Cat." },
  { key: "media",              label: "Media" },
  { key: "work_order",         label: "Work Order" },
  { key: "code",               label: "Code" },
  { key: "name",               label: "Name" },
  { key: "iot",                label: "IoT" },
  { key: "output_qty",         label: "Output Qty" },
  { key: "defect_qty",         label: "Defect QTY" },
  { key: "balance_qty",        label: "Balance Q'ty" },
  { key: "progress",           label: "Progress" },
  { key: "status",             label: "Status" },
  { key: "cycle_time",         label: "Cycle Time (s)" },
  { key: "target_per_hour",    label: "Target/hr" },
  { key: "daily_target",       label: "Daily Target (8h)" },
  { key: "process_start",      label: "Process Start" },
  { key: "process_finish",     label: "Process Finish" },
  { key: "lead_time",          label: "Lead Time (d)" },
  { key: "due_inbound",        label: "Due Inbound Date" },
  { key: "expected_inbound",   label: "Expected Inbound Date" },
  { key: "actual_inbound_qty", label: "Actual Inbound Qty" },
  { key: "remark",             label: "Remark" },
] as const;

type ColKey = (typeof ALL_COLUMNS)[number]["key"];

/** 헤더/행 컬럼 순서 — sticky left 누적과 동일 */
const COLUMN_STICKY_ORDER: ColKey[] = ALL_COLUMNS.map((c) => c.key);

// 접기 대상 컬럼 그룹 — 컴포넌트 외부 상수 (SJ PO#는 항상 표시)
const INFO_GROUP: ColKey[] = ["production_line", "sj_no", "color", "total_qty", "assembly_output_qty", "ex_factory", "assembly_start", "assembly_finish"];

const COLUMN_WIDTHS: Partial<Record<ColKey, number>> = {
  production_line: 130,
  sj_po_number: 110,
  category: 80,
  sj_no: 85,
  color: 70,
  total_qty: 85,
  assembly_output_qty: 110,
  ex_factory: 100,
  assembly_start: 110,
  assembly_finish: 115,
  flow_memo: 120,
  media: 52,
  work_order: 42,
  code: 110,
  name: 140,
  output_qty: 85,
  defect_qty: 88,
  balance_qty: 85,
  progress: 110,
  /** Status: 핀 고정 시 sticky 너비와 동일하게 맞춤 (아래 statusColumnWidthProps) */
  status: 160,
  cycle_time: 90,
  target_per_hour: 90,
  daily_target: 110,
  process_start: 110,
  process_finish: 110,
  lead_time: 90,
  due_inbound: 110,
  expected_inbound: 130,
  actual_inbound_qty: 100,
  remark: 160,
  iot: 170,
};

const EP_SCHEDULE_LIST_MONTH_LS_KEY = "epScheduleList_selectedMonth";

function parseSavedYyyyMm(saved: string | null): { year: number; month: number } | null {
  if (!saved || !/^\d{4}-\d{2}$/.test(saved)) return null;
  const [y, m] = saved.split("-").map(Number);
  if (!Number.isFinite(y) || m < 1 || m > 12) return null;
  return { year: y, month: m };
}

function getInitialYearMonth(): { year: number; month: number } {
  if (typeof window === "undefined") {
    const t = new Date();
    return { year: t.getFullYear(), month: t.getMonth() + 1 };
  }
  const parsed = parseSavedYyyyMm(localStorage.getItem(EP_SCHEDULE_LIST_MONTH_LS_KEY));
  if (parsed) return parsed;
  const t = new Date();
  return { year: t.getFullYear(), month: t.getMonth() + 1 };
}

function persistEpScheduleListMonth(year: number, month: number) {
  if (typeof window === "undefined") return;
  const mm = String(month).padStart(2, "0");
  localStorage.setItem(EP_SCHEDULE_LIST_MONTH_LS_KEY, `${year}-${mm}`);
}

// ── IoT Status Cell ───────────────────────────────────────────────
function fmtCycleTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString("en-US", {
      hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
    });
  } catch {
    return iso;
  }
}

function IotStatusCell({
  status,
  liveReading,
  onClick,
}: {
  status: IIotProcessStatus | undefined;
  liveReading?: PressIoTReading;
  onClick: () => void;
}) {
  const timeColor = useColorModeValue("gray.400", "gray.500");

  if (!status || status.machine_iot_id === null) {
    return <Text fontSize="xs" color="gray.300">—</Text>;
  }

  const { machine_iot_id, is_connected, last_cycle } = status;

  // ── 연결 배지 ────────────────────────────────────────────────
  const connBadge = is_connected || liveReading ? (
    <Badge colorScheme="green" fontSize="8px" px="4px" py="1px" borderRadius="sm">
      CONNECTED
    </Badge>
  ) : (
    <Badge colorScheme="gray" fontSize="8px" px="4px" py="1px" borderRadius="sm">
      OFFLINE
    </Badge>
  );

  // ── Live MQTT 실시간 데이터 ───────────────────────────────────
  if (liveReading) {
    const liveTime = new Date(liveReading.receivedAt).toLocaleTimeString("en-US", {
      hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
    });
    // 신호등: last_cycle pass 여부 참고 (live에서는 스탠다드 없으므로 DB 마지막 사이클 기준)
    const signalOk = last_cycle?.is_pass ?? null;
    return (
      <VStack spacing="2px" align="flex-start" cursor="pointer" onClick={onClick} _hover={{ opacity: 0.75 }}>
        <HStack spacing={1}>
          {connBadge}
          {signalOk !== null && (
            <Box
              w="8px" h="8px" borderRadius="full"
              bg={signalOk ? "green.400" : "red.400"}
              boxShadow={signalOk ? "0 0 5px 1px var(--chakra-colors-green-300)" : "0 0 5px 1px var(--chakra-colors-red-300)"}
            />
          )}
        </HStack>
        <HStack spacing={1}>
          <Badge colorScheme="orange" fontSize="9px" px={1}>
            🔥{liveReading.value_temp_1}°
          </Badge>
          <Badge colorScheme="blue" fontSize="9px" px={1}>
            ❄{liveReading.value_temp_2}°
          </Badge>
          <Badge colorScheme="gray" fontSize="9px" px={1}>
            🔄{liveReading.value_run_ok}
          </Badge>
        </HStack>
        <Text fontSize="9px" color={timeColor}>{liveTime}</Text>
      </VStack>
    );
  }

  // ── DB 마지막 사이클 데이터 ──────────────────────────────────
  if (!last_cycle) {
    return (
      <VStack spacing="2px" align="flex-start" cursor="pointer" onClick={onClick} _hover={{ opacity: 0.75 }}>
        {connBadge}
        <Text fontSize="9px" color={timeColor}>{machine_iot_id}</Text>
      </VStack>
    );
  }

  const TOL = 5;
  const hotOk = last_cycle.hot_temp_avg_diff === null || Math.abs(last_cycle.hot_temp_avg_diff) <= TOL;
  const coldOk = last_cycle.cold_temp_avg_diff === null || Math.abs(last_cycle.cold_temp_avg_diff) <= TOL;
  const durOk = last_cycle.cycle_duration_diff === null || Math.abs(last_cycle.cycle_duration_diff) <= TOL;
  const allOk = hotOk && coldOk && durOk;

  const diffStr = (diff: number | null, unit: string) => {
    if (diff === null) return null;
    return `${diff > 0 ? "+" : ""}${diff}${unit}`;
  };

  const cycleTime = fmtCycleTime(last_cycle.started_at);

  const tooltipContent = [
    `Machine: ${machine_iot_id}`,
    `Cycle #${last_cycle.cycle_no}  ${cycleTime}`,
    last_cycle.hot_temp_avg_c ? `🔥 ${parseFloat(last_cycle.hot_temp_avg_c).toFixed(1)}°C (${diffStr(last_cycle.hot_temp_avg_diff, "°C") ?? "—"}) ${hotOk ? "✓" : "✗"}` : null,
    last_cycle.cold_temp_avg_c ? `❄️ ${parseFloat(last_cycle.cold_temp_avg_c).toFixed(1)}°C (${diffStr(last_cycle.cold_temp_avg_diff, "°C") ?? "—"}) ${coldOk ? "✓" : "✗"}` : null,
    last_cycle.duration_s ? `⏱ ${parseFloat(last_cycle.duration_s).toFixed(1)}s (${diffStr(last_cycle.cycle_duration_diff, "s") ?? "—"}) ${durOk ? "✓" : "✗"}` : null,
    !is_connected ? "⚠ Machine disconnected" : null,
  ].filter(Boolean).join("\n");

  return (
    <Tooltip label={<Box whiteSpace="pre-line" fontSize="xs">{tooltipContent}</Box>} placement="left" hasArrow>
      <VStack spacing="2px" align="flex-start" cursor="pointer" onClick={onClick} _hover={{ opacity: 0.75 }}>
        {/* Row 1: 연결 배지 + 신호등 */}
        <HStack spacing={1}>
          {connBadge}
          <Box
            w="8px" h="8px" borderRadius="full"
            bg={allOk ? "green.400" : "red.400"}
            boxShadow={allOk ? "0 0 5px 1px var(--chakra-colors-green-300)" : "0 0 5px 1px var(--chakra-colors-red-300)"}
          />
        </HStack>
        {/* Row 2: 온도 배지 */}
        <HStack spacing={1}>
            {last_cycle.hot_temp_avg_c && (
              <Badge colorScheme="orange" fontSize="9px" px={1}>
                🔥{parseFloat(last_cycle.hot_temp_avg_c).toFixed(0)}°
                {!hotOk && last_cycle.hot_temp_avg_diff !== null && (
                  <Box as="span" ml="2px">
                    {last_cycle.hot_temp_avg_diff > 0 ? "+" : ""}{last_cycle.hot_temp_avg_diff}
                  </Box>
                )}
              </Badge>
            )}
            {last_cycle.cold_temp_avg_c && (
              <Badge colorScheme="blue" fontSize="9px" px={1}>
                ❄{parseFloat(last_cycle.cold_temp_avg_c).toFixed(0)}°
                {!coldOk && last_cycle.cold_temp_avg_diff !== null && (
                  <Box as="span" ml="2px">
                    {last_cycle.cold_temp_avg_diff > 0 ? "+" : ""}{last_cycle.cold_temp_avg_diff}
                  </Box>
                )}
              </Badge>
            )}
            {!durOk && last_cycle.cycle_duration_diff !== null && (
              <Badge colorScheme="red" fontSize="9px" px={1}>
                ⏱{last_cycle.cycle_duration_diff > 0 ? "+" : ""}{last_cycle.cycle_duration_diff}s
              </Badge>
            )}
          </HStack>
        {/* Row 3: 시간 */}
        <Text fontSize="9px" color={timeColor}>{cycleTime}</Text>
      </VStack>
    </Tooltip>
  );
}

// ── 컴포넌트 ──────────────────────────────────────────────────────
export default function EpScheduleList() {
  const { t, i18n } = useTranslation();
  const fmtDate = (d?: string | null) => formatIsoDateDisplay(d, i18n.language);

  const statusOptions = [
    { value: "not_started", label: t("ep.status.not_started") },
    { value: "outsourced",  label: t("ep.status.outsourced") },
    { value: "in_progress", label: t("ep.status.in_progress") },
    { value: "completed",   label: t("ep.status.completed") },
    { value: "not_ready",   label: t("ep.status.not_ready") },
  ];

  const colLabels: Record<ColKey, string> = {
    production_line: t("ep.list.col.productionLine"),
    sj_po_number: t("ep.list.col.sjPo"),
    sj_no: t("ep.list.col.sjNo"),
    color: t("ep.list.col.color"),
    total_qty: t("ep.list.col.totalQty"),
    assembly_output_qty: t("ep.list.col.assemblyOutQty"),
    ex_factory: t("ep.list.col.exFactory"),
    assembly_start: t("ep.list.col.assemblyStart"),
    assembly_finish: t("ep.list.col.assemblyFinish"),
    flow_memo: t("ep.list.col.flowMemo"),
    category: t("ep.list.col.category"),
    media: t("ep.list.col.media"),
    work_order: t("ep.list.col.workOrder"),
    code: t("ep.list.col.code"),
    name: t("ep.list.col.name"),
    output_qty: t("ep.list.col.outputQty"),
    defect_qty: t("ep.list.col.defectQty"),
    balance_qty: t("ep.list.col.balanceQty"),
    progress: t("ep.list.col.progress"),
    status: t("ep.list.col.status"),
    cycle_time: t("ep.list.col.cycleTime"),
    target_per_hour: t("ep.list.col.targetPerHour"),
    daily_target: t("ep.list.col.dailyTarget"),
    process_start: t("ep.list.col.processStart"),
    process_finish: t("ep.list.col.processFinish"),
    lead_time: t("ep.list.col.leadTime"),
    due_inbound: t("ep.list.col.dueInbound"),
    expected_inbound: t("ep.list.col.expectedInbound"),
    actual_inbound_qty: t("ep.list.col.actualInboundQty"),
    remark: t("ep.list.col.remark"),
    iot: "IoT",
  };

  const tableBgColor = useColorModeValue("gray.100", "gray.700");
  const pageBg = useColorModeValue("gray.50", "gray.900");
  const scheduleRowBg = useColorModeValue("white", "gray.800");
  const scheduleRowHoverBg = useColorModeValue("blue.50", "blue.900");
  const moduleRowBg = useColorModeValue("blue.50", "blue.900");
  const moduleRowHoverBg = useColorModeValue("blue.100", "blue.800");
  const processRowBg = useColorModeValue("gray.50", "gray.700");

  const today = new Date();
  const [selectedYear, setSelectedYear] = useState(() => getInitialYearMonth().year);
  const [selectedMonth, setSelectedMonth] = useState(() => getInitialYearMonth().month); // 1-based

  // 5개월 윈도우: 선택 월이 가운데(3번째)에 오도록 초기화 (localStorage 복원 시에도 해당 월이 보이게)
  const [windowStart, setWindowStart] = useState(() => {
    const { year, month } = getInitialYearMonth();
    const d = new Date(year, month - 1 - 2, 1);
    return { year: d.getFullYear(), month: d.getMonth() + 1 };
  });

  const WINDOW_SIZE = useBreakpointValue({ base: 1, md: 5 }) ?? 5;
  const monthButtons = Array.from({ length: WINDOW_SIZE }, (_, i) => {
    const d = new Date(windowStart.year, windowStart.month - 1 + i, 1);
    return { year: d.getFullYear(), month: d.getMonth() + 1 };
  });

  const shiftWindow = (delta: number) => {
    const d = new Date(windowStart.year, windowStart.month - 1 + delta, 1);
    setWindowStart({ year: d.getFullYear(), month: d.getMonth() + 1 });
  };

  const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

  const [searchQuery, setSearchQuery] = useState("");
  const toast = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    void runPreparationEpModuleMigrationOnce(queryClient, toast);
  }, [queryClient, toast]);

  const { isOpen, onOpen, onClose } = useDisclosure();
  const { isOpen: isColPopoverOpen, onOpen: onColPopoverOpen, onClose: onColPopoverClose } = useDisclosure();

  const { data: productionLines = [], isLoading: productionLinesLoading } = useQuery({
    queryKey: prodKeys.lines(),
    queryFn: getProductionLines,
    enabled: isOpen,
    staleTime: 60_000,
  });

  const { data: allModuleCategories = [], isLoading: moduleCategoriesLoading } = useQuery({
    queryKey: ["moduleCategories", "epScheduleModal", "all"],
    queryFn: () => getModuleCategories(),
    /** 모달 밖에서도 Preparation·EP 기본값·체크박스 트리에 필요 */
    staleTime: 60_000,
  });

  const moduleCategoryChildrenByParent = useMemo(() => {
    const m = new Map<number | null, IModuleCategory[]>();
    for (const c of allModuleCategories) {
      const p = c.parent;
      if (!m.has(p)) m.set(p, []);
      m.get(p)!.push(c);
    }
    Array.from(m.values()).forEach((arr) => {
      arr.sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));
    });
    return m;
  }, [allModuleCategories]);

  const moduleCategoryRootCount = moduleCategoryChildrenByParent.get(null)?.length ?? 0;

  /** 이 앱(EP 전용) 기본: Preparation · EP(일반가방)만 딥카피 대상으로 선택 */
  const preparationEpCategoryId = useMemo(
    () => findPreparationEpLeafCategoryId(allModuleCategories),
    [allModuleCategories]
  );

  useEffect(() => {
    if (!isOpen || preparationEpCategoryId == null) return;
    setForm((f) => {
      if (f.module_category_ids.length > 0) return f;
      return { ...f, module_category_ids: [preparationEpCategoryId] };
    });
  }, [isOpen, preparationEpCategoryId]);

  // ── 컬럼 가시성: 서버에서 로드 ──────────────────────────────────
  const ALL_KEYS = ALL_COLUMNS.map((c) => c.key);
  const { data: prefData } = useQuery({
    queryKey: ["epColumnPreference"],
    queryFn: getEpColumnPreference,
  });

  const [visibleCols, setVisibleCols] = useState<Set<ColKey>>(
    new Set(ALL_KEYS)
  );

  // 서버 데이터 로드 시 초기화 (saved.length > 0 이면 저장된 값 사용, 빈 배열이면 전체 표시)
  useEffect(() => {
    if (!prefData) return;
    const saved = prefData.visible_columns as ColKey[];
    if (saved.length > 0) {
      const merged = new Set(saved.filter((k) => (ALL_KEYS as string[]).includes(k)));
      if (!saved.includes("work_order")) merged.add("work_order");
      if (!saved.includes("defect_qty")) merged.add("defect_qty");
      setVisibleCols(merged);
    } else {
      setVisibleCols(new Set(ALL_KEYS));
    }
  }, [prefData]);

  const [isSavingPref, setIsSavingPref] = useState(false);

  const savePreference = async (cols: Set<ColKey>) => {
    setIsSavingPref(true);
    try {
      await saveEpColumnPreference(Array.from(cols));
      await queryClient.invalidateQueries({ queryKey: ["epColumnPreference"] });
      onColPopoverClose();
      toast({ title: t("ep.list.columnSettingsSaved"), status: "success", duration: 1500, position: "bottom-right" });
    } catch {
      toast({ title: t("ep.common.failedSave"), status: "error", duration: 2000, position: "bottom-right" });
    } finally {
      setIsSavingPref(false);
    }
  };

  const [infoCollapsed, setInfoCollapsed] = useState(false);

  const [pinnedCols, setPinnedCols] = useState<Set<ColKey>>(new Set(["sj_po_number", "code"] as ColKey[]));
  const togglePin = (key: ColKey) =>
    setPinnedCols((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  const isPinned = (key: ColKey) => pinnedCols.has(key);
  const getStickyLeft = (key: ColKey): number => {
    const TOGGLE_WIDTH = 40;
    let left = TOGGLE_WIDTH;
    for (const col of COLUMN_STICKY_ORDER) {
      if (col === key) break;
      if (!visInfo(col)) continue;
      if (!pinnedCols.has(col)) continue;
      left += COLUMN_WIDTHS[col] ?? 100;
    }
    return left;
  };
  /** 오른쪽에 있는 고정 열이 왼쪽 고정 열 위에 겹치도록 */
  const getStickyZIndex = (key: ColKey): number => {
    let n = 0;
    for (const col of COLUMN_STICKY_ORDER) {
      if (col === key) break;
      if (!visInfo(col)) continue;
      if (pinnedCols.has(col)) n += 1;
    }
    return 3 + n;
  };
  /** EpFlashQty(scale)·Status Select — sticky에서 overflow hidden으로 잘리지 않게 */
  const STICKY_OVERFLOW_VISIBLE: ReadonlySet<ColKey> = new Set<ColKey>(["output_qty", "defect_qty", "status"]);

  const colStickyProps = (key: ColKey, bgColor: string) => {
    if (!isPinned(key)) return {};
    const w = COLUMN_WIDTHS[key] ?? 100;
    const allowOverflow = STICKY_OVERFLOW_VISIBLE.has(key);
    return {
      position: "sticky" as const,
      left: `${getStickyLeft(key)}px`,
      zIndex: getStickyZIndex(key),
      bgColor,
      boxShadow: "2px 0 4px rgba(0,0,0,0.08)",
      w: `${w}px`,
      minW: `${w}px`,
      maxW: `${w}px`,
      overflow: allowOverflow ? ("visible" as const) : ("hidden" as const),
    };
  };

  /** Status 열: 핀 여부와 무관하게 항상 COLUMN_WIDTHS.status 와 동일 너비 */
  const statusColumnWidthProps = {
    w: `${COLUMN_WIDTHS.status ?? 160}px`,
    minW: `${COLUMN_WIDTHS.status ?? 160}px`,
    maxW: `${COLUMN_WIDTHS.status ?? 160}px`,
  } as const;

  const vis = (key: ColKey) => visibleCols.has(key);
  // infoCollapsed 상태를 고려한 vis
  const visInfo = (key: ColKey) => {
    if (infoCollapsed && (INFO_GROUP as string[]).includes(key)) return false;
    return vis(key);
  };
  const toggleCol = (key: ColKey) =>
    setVisibleCols((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  const showAll = () => setVisibleCols(new Set(ALL_KEYS));
  const hideAll = () => setVisibleCols(new Set<ColKey>());
  // 항상 toggle + 보이는 컬럼 수 = colSpan (infoCollapsed 반영)
  const visibleCount = 1 + ALL_COLUMNS.filter((c) => {
    if (!visibleCols.has(c.key)) return false;
    if (infoCollapsed && (INFO_GROUP as string[]).includes(c.key)) return false;
    return true;
  }).length;

  const [isVideoModalOpen, setIsVideoModalOpen] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState<string | undefined>();
  const [isPhotoModalOpen, setIsPhotoModalOpen] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<string | undefined>();
  const openPhoto = (url: string) => { setSelectedPhoto(url); setIsPhotoModalOpen(true); };

  const [form, setForm] = useState({ ...emptyForm });
  const [isSaving, setIsSaving] = useState(false);

  const factoriesFromLines = useMemo(() => {
    const byPk = new Map<number, string>();
    for (const line of productionLines) {
      if (!byPk.has(line.factory)) {
        byPk.set(line.factory, line.factory_name?.trim() || `Factory #${line.factory}`);
      }
    }
    return Array.from(byPk.entries())
      .map(([pk, name]) => ({ pk, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [productionLines]);

  const linesForSelectedFactory = useMemo(() => {
    const fk = form.factory === "" ? null : Number(form.factory);
    if (fk == null || Number.isNaN(fk)) return [];
    return productionLines
      .filter((l) => l.factory === fk)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [productionLines, form.factory]);

  const [orderQuery, setOrderQuery] = useState("");
  const [orderResults, setOrderResults] = useState<ISjOrderSearchResult[]>([]);
  const [orderSearching, setOrderSearching] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<ISjOrderSearchResult | null>(null);
  const orderSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tableContainerRef = useRef<HTMLDivElement>(null);

  // 스크롤 위치 저장 (window 세로 + TableContainer 가로)
  useEffect(() => {
    const onWinScroll = () => {
      sessionStorage.setItem("ep_scrollY", String(window.scrollY));
    };
    window.addEventListener("scroll", onWinScroll, { passive: true });
    return () => window.removeEventListener("scroll", onWinScroll);
  }, []);

  useEffect(() => {
    const el = tableContainerRef.current;
    if (!el) return;
    const onHScroll = () => {
      sessionStorage.setItem("ep_scrollX", String(el.scrollLeft));
    };
    el.addEventListener("scroll", onHScroll, { passive: true });
    return () => el.removeEventListener("scroll", onHScroll);
  }, [/* data 로드 후 ref가 붙으므로 data 의존 불필요 — ref 자체는 stable */]);

  const handleOrderSearch = (q: string) => {
    setOrderQuery(q);
    setSelectedOrder(null);
    setForm((f) => ({ ...f, sj_order: "", ex_factory_date: "" }));
    if (orderSearchTimer.current) clearTimeout(orderSearchTimer.current);
    if (!q.trim()) { setOrderResults([]); return; }
    orderSearchTimer.current = setTimeout(async () => {
      setOrderSearching(true);
      try {
        const results = await searchSjOrders(q);
        setOrderResults(results);
      } finally {
        setOrderSearching(false);
      }
    }, 300);
  };

  const selectOrder = (order: ISjOrderSearchResult) => {
    setSelectedOrder(order);
    setOrderQuery(order.sj_po_number);
    setOrderResults([]);
    const exRaw = order.ex_factory_date;
    const exDate =
      exRaw && typeof exRaw === "string" ? exRaw.slice(0, 10) : "";
    setForm((f) => ({ ...f, sj_order: order.pk, ex_factory_date: exDate }));
  };

  const resetModal = () => {
    setForm({ ...emptyForm });
    setOrderQuery("");
    setOrderResults([]);
    setSelectedOrder(null);
  };
  const [expandedSjNos, setExpandedSjNosRaw] = useState<Set<number>>(() => {
    try { const s = sessionStorage.getItem("ep_expandedSjNos"); return s ? new Set<number>(JSON.parse(s)) : new Set(); } catch { return new Set(); }
  });
  const [expandedModules, setExpandedModulesRaw] = useState<Set<number>>(() => {
    try { const s = sessionStorage.getItem("ep_expandedModules"); return s ? new Set<number>(JSON.parse(s)) : new Set(); } catch { return new Set(); }
  });
  const setExpandedSjNos = (val: Set<number> | ((prev: Set<number>) => Set<number>)) =>
    setExpandedSjNosRaw((prev) => {
      const next = typeof val === "function" ? val(prev) : val;
      try { sessionStorage.setItem("ep_expandedSjNos", JSON.stringify(Array.from(next))); } catch {}
      return next;
    });
  const setExpandedModules = (val: Set<number> | ((prev: Set<number>) => Set<number>)) =>
    setExpandedModulesRaw((prev) => {
      const next = typeof val === "function" ? val(prev) : val;
      try { sessionStorage.setItem("ep_expandedModules", JSON.stringify(Array.from(next))); } catch {}
      return next;
    });
  const [editingModuleQty, setEditingModuleQty] = useState<{pk: number; val: string} | null>(null);
  const [editingProcessQty, setEditingProcessQty] = useState<{pk: number; val: string; totalQty?: number | null} | null>(null);
  const [editingModuleDate, setEditingModuleDate] = useState<{pk: number; field: "process_start_date" | "process_finish_date"; val: string} | null>(null);
  const [editingProcessDate, setEditingProcessDate] = useState<{pk: number; field: "process_start_date" | "process_finish_date"; val: string} | null>(null);
  const [editingAssemblyOutQty, setEditingAssemblyOutQty] = useState<{pk: number; val: string} | null>(null);
  const [editingActualInboundQty, setEditingActualInboundQty] = useState<{pk: number; val: string} | null>(null);
  const [savingStatusPk, setSavingStatusPk] = useState<number | null>(null);
  type SortKey = "ex_factory" | "assembly_start" | "expected_inbound";
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; dir: "asc" | "desc" } | null>(null);

  const toggleSort = (key: SortKey) =>
    setSortConfig((prev) => {
      if (!prev || prev.key !== key) return { key, dir: "asc" };
      if (prev.dir === "asc") return { key, dir: "desc" };
      return null;
    });

  const sortIcon = (key: SortKey) => {
    if (!sortConfig || sortConfig.key !== key) return <FaSort color="gray" />;
    return sortConfig.dir === "asc" ? <FaSortUp /> : <FaSortDown />;
  };

  const { data, isLoading, isFetching } = useQuery<IEpSchedule[]>({
    queryKey: epKeys.list({ search: searchQuery, year: selectedYear, month: selectedMonth }),
    queryFn: () => getEpSchedules({ search: searchQuery, year: selectedYear, month: selectedMonth })
  });

  // 데이터 로드 완료 후 스크롤 위치 복원
  useEffect(() => {
    if (!data) return;
    const savedY = Number(sessionStorage.getItem("ep_scrollY") ?? 0);
    const savedX = Number(sessionStorage.getItem("ep_scrollX") ?? 0);
    requestAnimationFrame(() => {
      window.scrollTo({ top: savedY, behavior: "instant" as ScrollBehavior });
      if (tableContainerRef.current) {
        tableContainerRef.current.scrollLeft = savedX;
      }
    });
  }, [!!data]);

  const schedules = [...(data ?? [])].sort((a, b) => {
    if (!sortConfig) return 0;
    const { key, dir } = sortConfig;
    const getVal = (s: IEpSchedule) => {
      if (key === "ex_factory") return s.sj_order_info?.ex_factory_date ?? "";
      if (key === "assembly_start") return s.production_assembly_start_date ?? "";
      if (key === "expected_inbound") return s.expected_prep_material_inbound_date ?? "";
      return "";
    };
    const da = getVal(a);
    const db = getVal(b);
    if (!da && !db) return 0;
    if (!da) return 1;
    if (!db) return -1;
    return dir === "asc" ? da.localeCompare(db) : db.localeCompare(da);
  });


  // Collect all process PKs visible in the current schedules for IoT status
  const allProcessPks = useMemo(() => {
    const pks: number[] = [];
    for (const s of data ?? []) {
      for (const sj of s.ep_sj_nos ?? []) {
        for (const mod of sj.ep_modules) {
          for (const p of mod.ep_processes) pks.push(p.pk);
        }
      }
    }
    return pks;
  }, [data]);

  const { data: iotStatuses = [] } = useQuery<IIotProcessStatus[]>({
    queryKey: hotColdPressKeys.bulkStatus(allProcessPks),
    queryFn: () => getHotColdPressIoTBulkStatus(allProcessPks),
    enabled: vis("iot") && allProcessPks.length > 0,
    refetchInterval: vis("iot") ? 10_000 : false,
    staleTime: 8_000,
  });

  const iotByProcessPk = useMemo(
    () => new Map(iotStatuses.map((s) => [s.process_pk, s])),
    [iotStatuses]
  );

  // Live MQTT readings for all machines (wildcard subscription)
  const liveReadings = useAllPressIoT();

  // Map: processPk → live reading (via machine_iot_id)
  const liveByProcessPk = useMemo(() => {
    const m = new Map<number, import("../hooks/usePressIoT").PressIoTReading>();
    for (const s of iotStatuses) {
      if (s.machine_iot_id) {
        const reading = liveReadings.get(s.machine_iot_id);
        if (reading) m.set(s.process_pk, reading);
      }
    }
    return m;
  }, [iotStatuses, liveReadings]);

  const toggleSjNo = (pk: number) =>
    setExpandedSjNos((prev) => {
      const next = new Set(prev);
      if (next.has(pk)) next.delete(pk); else next.add(pk);
      return next;
    });

  const toggleModule = (pk: number) =>
    setExpandedModules((prev) => {
      const next = new Set(prev);
      if (next.has(pk)) next.delete(pk); else next.add(pk);
      return next;
    });

  const expandAll = () => {
    const allSjNoPks = new Set(
      (data ?? []).flatMap((s) => (s.ep_sj_nos ?? []).map((sj) => sj.pk))
    );
    const allModulePks = new Set(
      (data ?? []).flatMap((s) => (s.ep_sj_nos ?? []).flatMap((sj) => sj.ep_modules.map((m) => m.pk)))
    );
    setExpandedSjNos(allSjNoPks);
    setExpandedModules(allModulePks);
  };

  const collapseAll = () => {
    setExpandedSjNos(new Set());
    setExpandedModules(new Set());
  };

  const allSjNos = schedules.flatMap((s) => s.ep_sj_nos ?? []);
  const isAllExpanded =
    allSjNos.length > 0 &&
    allSjNos.every((sj) => expandedSjNos.has(sj.pk)) &&
    allSjNos.flatMap((sj) => sj.ep_modules).every((m) => expandedModules.has(m.pk));

  const saveAssemblyOutQty = async (pk: number, val: string) => {
    const qty = val === "" ? null : parseInt(val, 10);
    if (val !== "" && isNaN(qty!)) { setEditingAssemblyOutQty(null); return; }
    try {
      await editEpSchedule(pk, { production_assembly_output_qty: qty });
      queryClient.invalidateQueries({ queryKey: epKeys.all() });
    } catch { /* ignore */ }
    setEditingAssemblyOutQty(null);
  };

  const saveActualInboundQty = async (pk: number, val: string) => {
    const qty = val === "" ? null : parseInt(val, 10);
    if (val !== "" && isNaN(qty!)) { setEditingActualInboundQty(null); return; }
    try {
      await editEpSchedule(pk, { actual_inbound_prep_material_qty: qty });
      queryClient.invalidateQueries({ queryKey: epKeys.all() });
    } catch { /* ignore */ }
    setEditingActualInboundQty(null);
  };

  const saveModuleQty = async (pk: number, val: string, totalQty?: number | null) => {
    const qty = val === "" ? 0 : parseInt(val, 10);
    if (val !== "" && isNaN(qty!)) { setEditingModuleQty(null); return; }
    if (totalQty != null && qty > totalQty) {
      toast({ title: t("ep.common.outputExceedsTotal", { total: totalQty.toLocaleString() }), status: "warning", duration: 2500, position: "bottom-right" });
      setEditingModuleQty(null);
      return;
    }
    try {
      await patchEpModule(pk, { output_qty: qty });
      queryClient.invalidateQueries({ queryKey: epKeys.all() });
    } catch { /* ignore */ }
    setEditingModuleQty(null);
  };

  const saveProcessQty = async (pk: number, val: string, totalQty?: number | null) => {
    const qty = val === "" ? 0 : parseInt(val, 10);
    if (val !== "" && isNaN(qty!)) { setEditingProcessQty(null); return; }
    if (totalQty != null && qty > totalQty) { setEditingProcessQty(null); return; }
    try {
      await patchEpProcess(pk, { output_qty: qty });
      queryClient.invalidateQueries({ queryKey: epKeys.all() });
    } catch (e: unknown) {
      const ax = e as { response?: { data?: { output_qty?: string | string[] } } };
      const raw = ax?.response?.data?.output_qty;
      const msg = Array.isArray(raw) ? raw[0] : raw;
      if (msg) {
        toast({ title: msg, status: "error", duration: 4000, position: "bottom-right" });
      }
    }
    setEditingProcessQty(null);
  };

  const saveModuleDate = async (pk: number, field: "process_start_date" | "process_finish_date", val: string) => {
    try {
      await patchEpModule(pk, { [field]: val || null } as any);
      queryClient.invalidateQueries({ queryKey: epKeys.all() });
    } catch { /* ignore */ }
    setEditingModuleDate(null);
  };

  const saveProcessDate = async (pk: number, field: "process_start_date" | "process_finish_date", val: string) => {
    try {
      await patchEpProcess(pk, { [field]: val || null } as any);
      queryClient.invalidateQueries({ queryKey: epKeys.all() });
    } catch { /* ignore */ }
    setEditingProcessDate(null);
  };

  const saveSjNoStatus = async (pk: number, val: string) => {
    setSavingStatusPk(pk);
    try {
      await patchEpSjNo(pk, { status: val });
      queryClient.invalidateQueries({ queryKey: epKeys.all() });
    } catch { /* ignore */ }
    setSavingStatusPk(null);
  };

  const saveModuleStatus = async (pk: number, val: string) => {
    setSavingStatusPk(pk);
    try {
      await patchEpModule(pk, { status: val });
      queryClient.invalidateQueries({ queryKey: epKeys.all() });
    } catch { /* ignore */ }
    setSavingStatusPk(null);
  };

  const saveProcessStatus = async (pk: number, val: string) => {
    setSavingStatusPk(pk);
    try {
      await patchEpProcess(pk, { status: val });
      queryClient.invalidateQueries({ queryKey: epKeys.all() });
    } catch { /* ignore */ }
    setSavingStatusPk(null);
  };

  const toggleModuleCategory = (pk: number) => {
    setForm((f) => {
      const subtree = collectDescendantCategoryIds(pk, moduleCategoryChildrenByParent);
      const allOn =
        subtree.length > 0 && subtree.every((id) => f.module_category_ids.includes(id));
      if (allOn) {
        const remove = new Set(subtree);
        return {
          ...f,
          module_category_ids: f.module_category_ids.filter((id) => !remove.has(id)),
        };
      }
      return {
        ...f,
        module_category_ids: Array.from(new Set([...f.module_category_ids, ...subtree])),
      };
    });
  };

  const handleCreate = async () => {
    if (!form.sj_order) {
      toast({ title: t("ep.list.sjOrderRequired"), status: "warning", duration: 2000, position: "bottom-right" });
      return;
    }
    if (form.module_category_ids.length === 0) {
      toast({
        title: t("ep.list.moduleCategoryRequired"),
        status: "warning",
        duration: 2000,
        position: "bottom-right",
      });
      return;
    }
    setIsSaving(true);
    try {
      const exTrim = String(form.ex_factory_date ?? "").trim();
      await createEpSchedule({
        sj_order: Number(form.sj_order),
        production_line: form.production_line ? Number(form.production_line) : null,
        status: form.status,
        output_qty: form.output_qty !== "" ? Number(form.output_qty) : null,
        production_assembly_start_date: form.production_assembly_start_date || null,
        production_assembly_finish_date: form.production_assembly_finish_date || null,
        process_start_date: form.process_start_date || null,
        process_finish_date: form.process_finish_date || null,
        remark: form.remark,
        module_category_ids: form.module_category_ids,
        ...(exTrim ? { ex_factory_date: exTrim } : {}),
      });
      toast({ title: t("ep.list.scheduleCreated"), status: "success", duration: 2000, position: "bottom-right" });
      queryClient.invalidateQueries({ queryKey: epKeys.all() });
      resetModal();
      onClose();
    } catch (e: any) {
      const msg = e?.response?.data ? JSON.stringify(e.response.data) : "Failed to create schedule";
      toast({ title: msg, status: "error", duration: 3000, position: "bottom-right" });
    } finally {
      setIsSaving(false);
    }
  };

  const PinBtn = ({ colKey }: { colKey: ColKey }) => (
    <Tooltip label={isPinned(colKey) ? "Unpin column" : "Pin column"} placement="top">
      <Box
        as="span"
        display="inline-flex"
        cursor="pointer"
        ml={1}
        color={isPinned(colKey) ? "blue.400" : "gray.300"}
        _hover={{ color: isPinned(colKey) ? "blue.600" : "gray.500" }}
        onClick={(e: React.MouseEvent) => { e.stopPropagation(); togglePin(colKey); }}
        transform={isPinned(colKey) ? "rotate(0deg)" : "rotate(45deg)"}
        transition="transform 0.15s"
      >
        <FaThumbtack size={10} />
      </Box>
    </Tooltip>
  );

  return (
    <>
      <Helmet><title>Welding Real-time Production</title></Helmet>
      <Box bg={pageBg} minW="100%" minH="100%" px={{ base: "4", md: "8", lg: "12" }} py={{ base: "6", md: "8" }}>
        <Box w="full">

          {/* ── 월별 네비게이션 ── */}
          <HStack justify="center" align="center" mb={5} spacing={1} flexWrap="wrap">
            <IconButton
              aria-label="Previous months"
              icon={<FaChevronLeft />}
              size="sm"
              variant="ghost"
              onClick={() => shiftWindow(-1)}
            />
            {monthButtons.map(({ year, month }) => {
              const isSelected = year === selectedYear && month === selectedMonth;
              const isCurrent = year === today.getFullYear() && month === today.getMonth() + 1;
              return (
                <Button
                  key={`${year}-${month}`}
                  size="sm"
                  variant={isSelected ? "solid" : "ghost"}
                  colorScheme={isSelected ? "blue" : isCurrent ? "teal" : "gray"}
                  fontWeight={isSelected || isCurrent ? "bold" : "normal"}
                  onClick={() => {
                    setSelectedYear(year);
                    setSelectedMonth(month);
                    persistEpScheduleListMonth(year, month);
                  }}
                  minW="64px"
                  position="relative"
                >
                  {MONTH_NAMES[month - 1]} {year}
                  {isCurrent && !isSelected && (
                    <Box position="absolute" bottom="2px" left="50%" transform="translateX(-50%)" w="4px" h="4px" borderRadius="full" bg="teal.400" />
                  )}
                </Button>
              );
            })}
            <IconButton
              aria-label="Next months"
              icon={<FaChevronRight />}
              size="sm"
              variant="ghost"
              onClick={() => shiftWindow(1)}
            />
          </HStack>

          {/* ── 헤더 영역 ── */}
          <HStack justify="space-between" align="flex-start" mb={5}>
            <Box>
              <Heading size="md">{t("ep.list.pageTitle")}</Heading>
              <Text fontSize="xs" color="gray.500" mt={0.5}>{t("ep.list.pageSubtitle")}</Text>
            </Box>
            <SearchInput
              onSearch={(q) => setSearchQuery(q)}
              onInputChange={(v) => { if (v === "") setSearchQuery(""); }}
            />
          </HStack>

          <HStack justify="space-between" align="center" mb={6}>
            <Text fontSize="sm" color="gray.500">
              {t("ep.list.totalSchedules", { count: schedules.length })}
            </Text>
            <HStack spacing={2}>
              {/* 앞쪽 정보 컬럼 접기 / 펼치기 */}
              <Tooltip label={infoCollapsed ? t("ep.list.showInfoCols") : t("ep.list.hideInfoCols")} placement="top">
                <IconButton
                  aria-label={infoCollapsed ? t("ep.list.showInfoCols") : t("ep.list.hideInfoCols")}
                  icon={infoCollapsed ? <FaAngleDoubleRight /> : <FaAngleDoubleLeft />}
                  size="sm"
                  variant={infoCollapsed ? "solid" : "outline"}
                  colorScheme={infoCollapsed ? "blue" : "gray"}
                  onClick={() => setInfoCollapsed((v) => !v)}
                />
              </Tooltip>

              {/* 전체 펼치기 / 접기 */}
              <Tooltip label={isAllExpanded ? t("ep.list.collapseAll") : t("ep.list.expandAll")} placement="top">
                <IconButton
                  aria-label={isAllExpanded ? t("ep.list.collapseAll") : t("ep.list.expandAll")}
                  icon={isAllExpanded ? <FaCompressAlt /> : <FaExpandAlt />}
                  size="sm"
                  variant="outline"
                  colorScheme="gray"
                  onClick={isAllExpanded ? collapseAll : expandAll}
                />
              </Tooltip>

              {/* 컬럼 가시성 설정 */}
              <Popover placement="bottom-end" isLazy isOpen={isColPopoverOpen} onClose={onColPopoverClose}>
                <PopoverTrigger>
                  <IconButton
                    aria-label="Column visibility"
                    icon={<FaSlidersH />}
                    size="sm"
                    variant="outline"
                    colorScheme="gray"
                    onClick={onColPopoverOpen}
                  />
                </PopoverTrigger>
                <PopoverContent w="360px" shadow="lg">
                  <PopoverHeader fontWeight="semibold" fontSize="sm">
                    {t("ep.list.columnSettings")}
                  </PopoverHeader>
                  <PopoverCloseButton />
                  <PopoverBody pb={4}>
                    <HStack mb={3} spacing={2}>
                      <Button size="xs" variant="outline" onClick={showAll}>{t("ep.list.showAll")}</Button>
                      <Button size="xs" variant="outline" onClick={hideAll}>{t("ep.list.hideAll")}</Button>
                    </HStack>
                    <Divider mb={3} />
                    <SimpleGrid columns={2} spacing={2} mb={4}>
                      {ALL_COLUMNS.map((col) => (
                        <Checkbox
                          key={col.key}
                          isChecked={vis(col.key)}
                          onChange={() => toggleCol(col.key)}
                          size="sm"
                        >
                          <Text fontSize="xs">{colLabels[col.key]}</Text>
                        </Checkbox>
                      ))}
                    </SimpleGrid>
                    <Divider mb={3} />
                    <Button
                      size="sm"
                      colorScheme="blue"
                      w="full"
                      isLoading={isSavingPref}
                      onClick={() => savePreference(visibleCols)}
                    >
                      {t("ep.list.saveSettings")}
                    </Button>
                  </PopoverBody>
                </PopoverContent>
              </Popover>

              {/* 신규 생성 */}
              <IconButton
                aria-label="Create schedule"
                icon={<FaPlus />}
                colorScheme="blue"
                size="sm"
                onClick={() => { resetModal(); onOpen(); }}
              />
            </HStack>
          </HStack>

          {/* ── 테이블 ── */}
          <TableContainer ref={tableContainerRef}>
            <Table variant="simple" size="sm">
              <Thead bgColor={tableBgColor}>
                <Tr>
                  <Th w="40px" px={1} position="sticky" left={0} zIndex={2} bgColor={tableBgColor} />
                  {visInfo("production_line") && (
                    <Th whiteSpace="nowrap" {...colStickyProps("production_line", tableBgColor)}>
                      <HStack spacing={0} align="center">
                        <Text as="span">{colLabels["production_line"]}</Text>
                        <PinBtn colKey="production_line" />
                      </HStack>
                    </Th>
                  )}
                  {vis("sj_po_number") && (
                    <Th whiteSpace="nowrap" {...colStickyProps("sj_po_number", tableBgColor)}>
                      <HStack spacing={0} align="center">
                        <Text as="span">{colLabels["sj_po_number"]}</Text>
                        <PinBtn colKey="sj_po_number" />
                      </HStack>
                    </Th>
                  )}
                  {visInfo("sj_no") && (
                    <Th whiteSpace="nowrap" {...colStickyProps("sj_no", tableBgColor)}>
                      <HStack spacing={0} align="center">
                        <Text as="span">{colLabels["sj_no"]}</Text>
                        <PinBtn colKey="sj_no" />
                      </HStack>
                    </Th>
                  )}
                  {visInfo("color") && (
                    <Th {...colStickyProps("color", tableBgColor)}>
                      <HStack spacing={0} align="center">
                        <Text as="span">{colLabels["color"]}</Text>
                        <PinBtn colKey="color" />
                      </HStack>
                    </Th>
                  )}
                  {visInfo("total_qty") && (
                    <Th isNumeric whiteSpace="nowrap" {...colStickyProps("total_qty", tableBgColor)}>
                      <HStack spacing={0} align="center">
                        <Text as="span">{colLabels["total_qty"]}</Text>
                        <PinBtn colKey="total_qty" />
                      </HStack>
                    </Th>
                  )}
                  {visInfo("assembly_output_qty") && (
                    <Th isNumeric whiteSpace="nowrap" {...colStickyProps("assembly_output_qty", tableBgColor)}>
                      <HStack spacing={0} align="center">
                        <Text as="span">{colLabels["assembly_output_qty"]}</Text>
                        <PinBtn colKey="assembly_output_qty" />
                      </HStack>
                    </Th>
                  )}
                  {visInfo("ex_factory") && (
                    <Th whiteSpace="nowrap" cursor="pointer" userSelect="none" onClick={() => toggleSort("ex_factory")} _hover={{ bg: "gray.200" }} {...colStickyProps("ex_factory", tableBgColor)}>
                      <HStack spacing={1}><Text as="span">{colLabels["ex_factory"]}</Text>{sortIcon("ex_factory")}<PinBtn colKey="ex_factory" /></HStack>
                    </Th>
                  )}
                  {visInfo("assembly_start") && (
                    <Th whiteSpace="nowrap" cursor="pointer" userSelect="none" onClick={() => toggleSort("assembly_start")} _hover={{ bg: "gray.200" }} {...colStickyProps("assembly_start", tableBgColor)}>
                      <HStack spacing={1}><Text as="span">{colLabels["assembly_start"]}</Text>{sortIcon("assembly_start")}<PinBtn colKey="assembly_start" /></HStack>
                    </Th>
                  )}
                  {visInfo("assembly_finish") && (
                    <Th whiteSpace="nowrap" {...colStickyProps("assembly_finish", tableBgColor)}>
                      <HStack spacing={0} align="center">
                        <Text as="span">{colLabels["assembly_finish"]}</Text>
                        <PinBtn colKey="assembly_finish" />
                      </HStack>
                    </Th>
                  )}
                  {vis("flow_memo")          && <Th whiteSpace="nowrap" {...colStickyProps("flow_memo", tableBgColor)}><HStack spacing={0} align="center"><Text as="span">{colLabels["flow_memo"]}</Text><PinBtn colKey="flow_memo" /></HStack></Th>}
                  {vis("category")           && <Th whiteSpace="nowrap" {...colStickyProps("category", tableBgColor)}><HStack spacing={0} align="center"><Text as="span">{colLabels["category"]}</Text><PinBtn colKey="category" /></HStack></Th>}
                  {vis("media")              && <Th {...colStickyProps("media", tableBgColor)}><HStack spacing={0} align="center"><Text as="span">{colLabels["media"]}</Text><PinBtn colKey="media" /></HStack></Th>}
                  {vis("work_order")         && <Th whiteSpace="nowrap" {...colStickyProps("work_order", tableBgColor)}><HStack spacing={0} align="center"><Text as="span">{colLabels["work_order"]}</Text><PinBtn colKey="work_order" /></HStack></Th>}
                  {vis("code")               && <Th whiteSpace="nowrap" {...colStickyProps("code", tableBgColor)}><HStack spacing={0} align="center"><Text as="span">{colLabels["code"]}</Text><PinBtn colKey="code" /></HStack></Th>}
                  {vis("name")               && <Th whiteSpace="nowrap" {...colStickyProps("name", tableBgColor)}><HStack spacing={0} align="center"><Text as="span">{colLabels["name"]}</Text><PinBtn colKey="name" /></HStack></Th>}
                  {vis("iot")                && <Th whiteSpace="nowrap" {...colStickyProps("iot", tableBgColor)}><HStack spacing={0} align="center"><Text as="span">{colLabels["iot"]}</Text><PinBtn colKey="iot" /></HStack></Th>}
                  {vis("output_qty")         && <Th isNumeric whiteSpace="nowrap" {...colStickyProps("output_qty", tableBgColor)}><HStack spacing={0} align="center" justify="flex-end"><Text as="span">{colLabels["output_qty"]}</Text><PinBtn colKey="output_qty" /></HStack></Th>}
                  {vis("defect_qty")         && <Th isNumeric whiteSpace="nowrap" {...colStickyProps("defect_qty", tableBgColor)}><HStack spacing={0} align="center" justify="flex-end"><Text as="span">{colLabels["defect_qty"]}</Text><PinBtn colKey="defect_qty" /></HStack></Th>}
                  {vis("balance_qty")        && <Th isNumeric whiteSpace="nowrap" {...colStickyProps("balance_qty", tableBgColor)}><HStack spacing={0} align="center" justify="flex-end"><Text as="span">{colLabels["balance_qty"]}</Text><PinBtn colKey="balance_qty" /></HStack></Th>}
                  {vis("progress")           && <Th minW="110px" {...colStickyProps("progress", tableBgColor)}><HStack spacing={0} align="center"><Text as="span">{colLabels["progress"]}</Text><PinBtn colKey="progress" /></HStack></Th>}
                  {vis("status")             && <Th {...colStickyProps("status", tableBgColor)} {...statusColumnWidthProps}><HStack spacing={0} align="center"><Text as="span">{colLabels["status"]}</Text><PinBtn colKey="status" /></HStack></Th>}
                  {vis("cycle_time")         && <Th isNumeric whiteSpace="nowrap" {...colStickyProps("cycle_time", tableBgColor)}><HStack spacing={0} align="center" justify="flex-end"><Text as="span">{colLabels["cycle_time"]}</Text><PinBtn colKey="cycle_time" /></HStack></Th>}
                  {vis("target_per_hour")    && <Th isNumeric whiteSpace="nowrap" {...colStickyProps("target_per_hour", tableBgColor)}><HStack spacing={0} align="center" justify="flex-end"><Text as="span">{colLabels["target_per_hour"]}</Text><PinBtn colKey="target_per_hour" /></HStack></Th>}
                  {vis("daily_target")       && <Th isNumeric whiteSpace="nowrap" {...colStickyProps("daily_target", tableBgColor)}><HStack spacing={0} align="center" justify="flex-end"><Text as="span">{colLabels["daily_target"]}</Text><PinBtn colKey="daily_target" /></HStack></Th>}
                  {vis("process_start")      && <Th whiteSpace="nowrap" {...colStickyProps("process_start", tableBgColor)}><HStack spacing={0} align="center"><Text as="span">{colLabels["process_start"]}</Text><PinBtn colKey="process_start" /></HStack></Th>}
                  {vis("process_finish")     && <Th whiteSpace="nowrap" {...colStickyProps("process_finish", tableBgColor)}><HStack spacing={0} align="center"><Text as="span">{colLabels["process_finish"]}</Text><PinBtn colKey="process_finish" /></HStack></Th>}
                  {vis("lead_time")          && <Th isNumeric whiteSpace="nowrap" {...colStickyProps("lead_time", tableBgColor)}><HStack spacing={0} align="center" justify="flex-end"><Text as="span">{colLabels["lead_time"]}</Text><PinBtn colKey="lead_time" /></HStack></Th>}
                  {vis("due_inbound")        && <Th whiteSpace="nowrap" {...colStickyProps("due_inbound", tableBgColor)}><HStack spacing={0} align="center"><Text as="span">{colLabels["due_inbound"]}</Text><PinBtn colKey="due_inbound" /></HStack></Th>}
                  {vis("expected_inbound")   && (
                    <Th whiteSpace="nowrap" cursor="pointer" userSelect="none" onClick={() => toggleSort("expected_inbound")} _hover={{ bg: "gray.200" }} {...colStickyProps("expected_inbound", tableBgColor)}>
                      <HStack spacing={1}><Text as="span">{colLabels["expected_inbound"]}</Text>{sortIcon("expected_inbound")}<PinBtn colKey="expected_inbound" /></HStack>
                    </Th>
                  )}
                  {vis("actual_inbound_qty") && <Th isNumeric whiteSpace="nowrap" {...colStickyProps("actual_inbound_qty", tableBgColor)}><HStack spacing={0} align="center" justify="flex-end"><Text as="span">{colLabels["actual_inbound_qty"]}</Text><PinBtn colKey="actual_inbound_qty" /></HStack></Th>}
                  {vis("remark")             && <Th {...colStickyProps("remark", tableBgColor)}><HStack spacing={0} align="center"><Text as="span">{colLabels["remark"]}</Text><PinBtn colKey="remark" /></HStack></Th>}
                </Tr>
              </Thead>
              <Tbody>
                {(isLoading || isFetching) && schedules.length === 0 && (
                  <Tr><Td colSpan={visibleCount}><Center py={6}><Spinner size="md" /></Center></Td></Tr>
                )}
                {!isLoading && !isFetching && schedules.length === 0 && (
                  <Tr><Td colSpan={visibleCount}><Text color="gray.400" textAlign="center">{t("ep.list.noSchedules")}</Text></Td></Tr>
                )}

                {schedules.map((s) => {
                  const o = s.sj_order_info;
                  const sjNos = s.ep_sj_nos ?? [];
                  return (
                    <Fragment key={`schedule-${s.pk}`}>
                      {sjNos.map((sj, sjIdx) => {
                        const isSjExpanded = expandedSjNos.has(sj.pk);
                        const sjTotal = sj.total_qty ?? 0;
                        const sjOut = sj.output_qty ?? 0;
                        const sjBalance = Math.max(0, sjTotal - sjOut);
                        const sjPct = sjTotal > 0 ? Math.min(100, Math.round((sjOut / sjTotal) * 100)) : 0;
                        const sjBarColor = sjPct >= 100 ? "green.400" : sjPct >= 50 ? "blue.400" : "orange.400";

                        return (
                          <Fragment key={`sj-${sj.pk}`}>
                            {/* ── SJ No Row (S) ── */}
                            <Tr bgColor={scheduleRowBg} _hover={{ bgColor: scheduleRowHoverBg }}
                              borderTop="2px solid" borderTopColor={sjIdx === 0 ? "gray.300" : "gray.100"}
                              cursor={sj.ep_modules.length > 0 ? "pointer" : "default"}
                              onClick={() => { if (sj.ep_modules.length > 0) toggleSjNo(sj.pk); }}>
                              <Td px={1} minW="40px" position="sticky" left={0} zIndex={2} bgColor={scheduleRowBg}>
                                {sj.ep_modules.length > 0 ? (
                                  <IconButton aria-label="expand" icon={isSjExpanded ? <FaChevronDown /> : <FaChevronRight />}
                                    size="xs" variant="ghost" onClick={(e) => { e.stopPropagation(); toggleSjNo(sj.pk); }} />
                                ) : <Box w="24px" />}
                              </Td>
                              {visInfo("production_line") && <Td whiteSpace="nowrap" {...colStickyProps("production_line", scheduleRowBg)}>{s.production_line_name || "-"}</Td>}
                              {vis("sj_po_number") && <Td whiteSpace="nowrap" {...colStickyProps("sj_po_number", scheduleRowBg)} onClick={(e) => e.stopPropagation()}><Link href="#" color="blue.500" fontWeight="semibold" onClick={(e) => { e.preventDefault(); e.stopPropagation(); openWindow(`/ep-production/${s.pk}`); }}>{o?.sj_po_number ?? s.pk}</Link></Td>}
                              {visInfo("sj_no") && <Td whiteSpace="nowrap" {...colStickyProps("sj_no", scheduleRowBg)}><Text fontWeight="semibold">{sj.sj_no || "-"}</Text></Td>}
                              {visInfo("color") && <Td {...colStickyProps("color", scheduleRowBg)}>{o?.color || "-"}</Td>}
                              {visInfo("total_qty") && <Td isNumeric fontWeight="semibold" {...colStickyProps("total_qty", scheduleRowBg)}>{sjTotal > 0 ? sjTotal.toLocaleString() : "-"}</Td>}
                              {visInfo("assembly_output_qty") && <Td isNumeric {...colStickyProps("assembly_output_qty", scheduleRowBg)} onClick={(e) => e.stopPropagation()}>
                                {editingAssemblyOutQty?.pk === s.pk ? (
                                  <Input size="xs" w="80px" value={editingAssemblyOutQty.val} autoFocus
                                    onChange={(e) => setEditingAssemblyOutQty({pk: s.pk, val: e.target.value})}
                                    onBlur={() => saveAssemblyOutQty(s.pk, editingAssemblyOutQty.val)}
                                    onKeyDown={(e) => { if (e.key === "Enter") saveAssemblyOutQty(s.pk, editingAssemblyOutQty.val); if (e.key === "Escape") setEditingAssemblyOutQty(null); }}
                                  />
                                ) : (
                                  <Text cursor="pointer" color={s.production_assembly_output_qty != null ? undefined : "gray.300"}
                                    _hover={{ textDecoration: "underline" }}
                                    onClick={() => setEditingAssemblyOutQty({pk: s.pk, val: String(s.production_assembly_output_qty ?? "")})}>
                                    {s.production_assembly_output_qty != null ? s.production_assembly_output_qty.toLocaleString() : "—"}
                                  </Text>
                                )}
                              </Td>}
                              {visInfo("ex_factory") && <Td whiteSpace="nowrap" {...colStickyProps("ex_factory", scheduleRowBg)}>{fmtDate(o?.ex_factory_date)}</Td>}
                              {visInfo("assembly_start") && <Td whiteSpace="nowrap" {...colStickyProps("assembly_start", scheduleRowBg)}>{fmtDate(s.production_assembly_start_date)}</Td>}
                              {visInfo("assembly_finish") && <Td whiteSpace="nowrap" {...colStickyProps("assembly_finish", scheduleRowBg)}>{fmtDate(s.production_assembly_finish_date)}</Td>}
                              {vis("flow_memo")          && <Td {...colStickyProps("flow_memo", scheduleRowBg)}><Text color="gray.300">—</Text></Td>}
                              {vis("category")           && <Td {...colStickyProps("category", scheduleRowBg)}><EpBadge kind="epSj" fontSize="xs" /></Td>}
                              {vis("media")              && <Td onClick={(e) => e.stopPropagation()} {...colStickyProps("media", scheduleRowBg)}>{o?.sj_style?.thumbnail ? (<Tooltip label="View Style Photo" placement="top"><Box as="img" src={o.sj_style.thumbnail} alt="style" w="36px" h="36px" objectFit="cover" borderRadius="sm" cursor="pointer" onClick={() => openPhoto(o!.sj_style!.thumbnail!)} /></Tooltip>) : <Text color="gray.300">—</Text>}</Td>}
                              {vis("work_order")         && <Td {...colStickyProps("work_order", scheduleRowBg)}><Text color="gray.300">—</Text></Td>}
                              {vis("code")               && <Td whiteSpace="nowrap" onClick={(e) => e.stopPropagation()} {...colStickyProps("code", scheduleRowBg)}>{sj.sj_no ? (<Link href="#" title={sj.sj_no} fontWeight="semibold" fontSize="xs" color="blue.600" onClick={(e) => { e.preventDefault(); e.stopPropagation(); openWindow(`/ep-production/sj-nos/${sj.pk}`); }}>{sj.sj_no}</Link>) : <Text color="gray.300">—</Text>}</Td>}
                              {vis("name")               && <Td whiteSpace="nowrap" {...colStickyProps("name", scheduleRowBg)}>{o?.style_name || "-"}</Td>}
                              {vis("iot")                && <Td {...colStickyProps("iot", scheduleRowBg)} />}
                              {vis("output_qty")         && (
                                <Td isNumeric {...colStickyProps("output_qty", scheduleRowBg)} onClick={(e) => e.stopPropagation()}>
                                  <EpFlashQty value={sjOut}>{sjOut.toLocaleString()}</EpFlashQty>
                                </Td>
                              )}
                              {vis("defect_qty")         && (
                                <Td isNumeric {...colStickyProps("defect_qty", scheduleRowBg)} onClick={(e) => e.stopPropagation()}>
                                  <DefectQtyLink defectQty={sj.total_defect_qty ?? 0} to={`/ep-production/inspections?ep_sj_no=${sj.pk}`} />
                                </Td>
                              )}
                              {vis("balance_qty")        && <Td isNumeric fontWeight="semibold" {...colStickyProps("balance_qty", scheduleRowBg)}>{sjTotal > 0 ? sjBalance.toLocaleString() : "-"}</Td>}
                              {vis("progress")           && <Td {...colStickyProps("progress", scheduleRowBg)}>{sjTotal > 0 ? (<Box><Text fontSize="xs" mb={0.5}>{sjPct}%</Text><Box w="80px" h="5px" bg="gray.200" borderRadius="full" overflow="hidden"><Box w={`${sjPct}%`} h="100%" bg={sjBarColor} borderRadius="full" /></Box></Box>) : <Text color="gray.300">—</Text>}</Td>}
                              {vis("status")             && <Td onClick={(e) => e.stopPropagation()} {...colStickyProps("status", scheduleRowBg)} {...statusColumnWidthProps}>
                                <Select
                                  size="xs"
                                  value={sj.status ?? "not_started"}
                                  w="100%"
                                  isDisabled={savingStatusPk === sj.pk}
                                  onChange={(e) => saveSjNoStatus(sj.pk, e.target.value)}
                                  {...statusSelectFieldProps(sj.status ?? "not_started")}
                                >
                                  {statusOptions.map((opt) => (
                                    <option key={opt.value} value={opt.value} style={statusOptionStyle(opt.value)}>
                                      {opt.label}
                                    </option>
                                  ))}
                                </Select>
                              </Td>}
                              {vis("cycle_time")         && <Td {...colStickyProps("cycle_time", scheduleRowBg)} />}
                              {vis("target_per_hour")    && <Td {...colStickyProps("target_per_hour", scheduleRowBg)} />}
                              {vis("daily_target")       && <Td {...colStickyProps("daily_target", scheduleRowBg)} />}
                              {vis("process_start")      && <Td whiteSpace="nowrap" {...colStickyProps("process_start", scheduleRowBg)}>{fmtDate(s.process_start_date)}</Td>}
                              {vis("process_finish")     && <Td whiteSpace="nowrap" {...colStickyProps("process_finish", scheduleRowBg)}>{fmtDate(s.process_finish_date)}</Td>}
                              {vis("lead_time")          && <Td isNumeric {...colStickyProps("lead_time", scheduleRowBg)}>{s.process_lead_time_days != null ? (<Box textAlign="right"><Text as="span" fontWeight="semibold">{s.process_lead_time_days}d</Text>{(s.process_sundays_excluded_count ?? 0) > 0 && (<Text fontSize="10px" color="orange.400" whiteSpace="nowrap">{t("ep.common.sundayExcluded", { count: s.process_sundays_excluded_count })}</Text>)}</Box>) : <Text color="gray.300">—</Text>}</Td>}
                              {vis("due_inbound")        && <Td whiteSpace="nowrap" {...colStickyProps("due_inbound", scheduleRowBg)}>{fmtDate(s.due_inbound_date_prep_material)}</Td>}
                              {vis("expected_inbound")   && <Td whiteSpace="nowrap" {...colStickyProps("expected_inbound", scheduleRowBg)}>{fmtDate(s.expected_prep_material_inbound_date)}</Td>}
                              {vis("actual_inbound_qty") && (
                                <Td isNumeric onClick={(e) => e.stopPropagation()} {...colStickyProps("actual_inbound_qty", scheduleRowBg)}>
                                  {editingActualInboundQty?.pk === s.pk ? (
                                    <Input
                                      size="xs" w="80px" type="number" min={0} autoFocus
                                      value={editingActualInboundQty.val}
                                      onChange={(e) => setEditingActualInboundQty({ pk: s.pk, val: e.target.value })}
                                      onBlur={() => saveActualInboundQty(s.pk, editingActualInboundQty.val)}
                                      onKeyDown={(e) => {
                                        if (e.key === "Enter") saveActualInboundQty(s.pk, editingActualInboundQty.val);
                                        if (e.key === "Escape") setEditingActualInboundQty(null);
                                      }}
                                    />
                                  ) : (
                                    <Text
                                      cursor="pointer" _hover={{ textDecoration: "underline" }}
                                      color={s.actual_inbound_prep_material_qty != null ? undefined : "gray.300"}
                                      onClick={() => setEditingActualInboundQty({ pk: s.pk, val: String(s.actual_inbound_prep_material_qty ?? "") })}
                                    >
                                      {s.actual_inbound_prep_material_qty != null ? s.actual_inbound_prep_material_qty.toLocaleString() : "—"}
                                    </Text>
                                  )}
                                </Td>
                              )}
                              {vis("remark")             && <Td maxW="160px" {...colStickyProps("remark", scheduleRowBg)}>{s.remark ? (<Tooltip label={s.remark} placement="top" hasArrow><Text fontSize="xs" noOfLines={2} cursor="default">{s.remark}</Text></Tooltip>) : <Text color="gray.300">—</Text>}</Td>}
                            </Tr>

                            {/* ── Module Rows (M) ── */}
                            {isSjExpanded && sj.ep_modules.map((mod) => {
                              const isModExpanded = expandedModules.has(mod.pk);
                              return (
                                <Fragment key={`m-${mod.pk}`}>
                                  <Tr bgColor={moduleRowBg}
                                    cursor={mod.ep_processes.length > 0 ? "pointer" : "default"}
                                    _hover={{ bgColor: moduleRowHoverBg }}
                                    onClick={() => { if (mod.ep_processes.length > 0) toggleModule(mod.pk); }}>
                                    <Td px={1} pl={5} minW="40px" position="sticky" left={0} zIndex={2} bgColor={moduleRowBg}>
                                      {mod.ep_processes.length > 0 ? (
                                        <IconButton aria-label="expand module" icon={isModExpanded ? <FaChevronDown /> : <FaChevronRight />}
                                          size="xs" variant="ghost" onClick={(e) => { e.stopPropagation(); toggleModule(mod.pk); }} />
                                      ) : <Box w="24px" />}
                                    </Td>
                                    {visInfo("production_line") && <Td whiteSpace="nowrap" {...colStickyProps("production_line", moduleRowBg)}><Text color="gray.400" fontSize="xs">{s.production_line_name || "-"}</Text></Td>}
                                    {vis("sj_po_number") && <Td whiteSpace="nowrap" {...colStickyProps("sj_po_number", moduleRowBg)}><Text color="gray.400" fontSize="xs">{o?.sj_po_number ?? s.pk}</Text></Td>}
                                    {visInfo("sj_no") && <Td whiteSpace="nowrap" {...colStickyProps("sj_no", moduleRowBg)}><Text color="gray.400" fontSize="xs">{sj.sj_no || "-"}</Text></Td>}
                                    {visInfo("color") && <Td {...colStickyProps("color", moduleRowBg)}><Text color="gray.400" fontSize="xs">{o?.color || "-"}</Text></Td>}
                                    {visInfo("total_qty") && <Td isNumeric {...colStickyProps("total_qty", moduleRowBg)}>
                                      <Text color="gray.400" fontSize="xs">{mod.total_qty != null ? mod.total_qty.toLocaleString() : "-"}</Text>
                                    </Td>}
                                    {visInfo("assembly_output_qty") && <Td isNumeric {...colStickyProps("assembly_output_qty", moduleRowBg)}><Text color="gray.400" fontSize="xs">{s.production_assembly_output_qty != null ? s.production_assembly_output_qty.toLocaleString() : "-"}</Text></Td>}
                                    {visInfo("ex_factory") && <Td whiteSpace="nowrap" {...colStickyProps("ex_factory", moduleRowBg)}><Text color="gray.400" fontSize="xs">{fmtDate(o?.ex_factory_date)}</Text></Td>}
                                    {visInfo("assembly_start") && <Td whiteSpace="nowrap" {...colStickyProps("assembly_start", moduleRowBg)}><Text color="gray.400" fontSize="xs">{fmtDate(s.production_assembly_start_date)}</Text></Td>}
                                    {visInfo("assembly_finish") && <Td whiteSpace="nowrap" {...colStickyProps("assembly_finish", moduleRowBg)}><Text color="gray.400" fontSize="xs">{fmtDate(s.production_assembly_finish_date)}</Text></Td>}
                                    {vis("flow_memo")          && <Td {...colStickyProps("flow_memo", moduleRowBg)}><Text color="gray.300">—</Text></Td>}
                                    {vis("category")           && <Td {...colStickyProps("category", moduleRowBg)}><EpBadge kind="epModule" fontSize="xs" /></Td>}
                                    {vis("media")              && <Td {...colStickyProps("media", moduleRowBg)}><Text color="gray.300">—</Text></Td>}
                                    {vis("work_order")         && <Td {...colStickyProps("work_order", moduleRowBg)}><Text color="gray.300">—</Text></Td>}
                                    {vis("code")               && <Td whiteSpace="nowrap" onClick={(e) => e.stopPropagation()} {...colStickyProps("code", moduleRowBg)}><Link href="#" title={mod.code} fontWeight="semibold" fontSize="xs" color="blue.600" onClick={(e) => { e.preventDefault(); e.stopPropagation(); openWindow(`/ep-production/modules/${mod.pk}`); }}>{mod.code}</Link></Td>}
                                    {vis("name")               && <Td whiteSpace="nowrap" {...colStickyProps("name", moduleRowBg)}>{mod.name || "-"}</Td>}
                                    {vis("iot")                && <Td {...colStickyProps("iot", moduleRowBg)} />}
                                    {vis("output_qty")         && (
                                      <Td isNumeric {...colStickyProps("output_qty", moduleRowBg)} onClick={(e) => e.stopPropagation()}>
                                        <EpFlashQty value={mod.output_qty ?? 0}>
                                          {(mod.output_qty ?? 0).toLocaleString()}
                                        </EpFlashQty>
                                      </Td>
                                    )}
                                    {vis("defect_qty")         && (
                                      <Td isNumeric {...colStickyProps("defect_qty", moduleRowBg)} onClick={(e) => e.stopPropagation()}>
                                        <DefectQtyLink defectQty={mod.total_defect_qty ?? 0} to={`/ep-production/inspections?ep_module=${mod.pk}`} />
                                      </Td>
                                    )}
                                    {vis("balance_qty")        && <Td isNumeric {...colStickyProps("balance_qty", moduleRowBg)}>
                                      {mod.total_qty != null
                                        ? <Text fontSize="xs" fontWeight="semibold">{Math.max(0, mod.total_qty - (mod.output_qty ?? 0)).toLocaleString()}</Text>
                                        : <Text color="gray.300">—</Text>}
                                    </Td>}
                                    {vis("progress")           && <Td {...colStickyProps("progress", moduleRowBg)}>
                                      {mod.total_qty != null && mod.total_qty > 0 ? (() => {
                                        const pct = Math.min(100, Math.round(((mod.output_qty ?? 0) / mod.total_qty) * 100));
                                        const color = pct >= 100 ? "green.400" : pct >= 50 ? "blue.400" : "orange.400";
                                        return <Box><Text fontSize="xs" mb={0.5}>{pct}%</Text><Box w="80px" h="5px" bg="gray.200" borderRadius="full" overflow="hidden"><Box w={`${pct}%`} h="100%" bg={color} borderRadius="full" /></Box></Box>;
                                      })() : <Text color="gray.300">—</Text>}
                                    </Td>}
                                    {vis("status")             && <Td onClick={(e) => e.stopPropagation()} {...colStickyProps("status", moduleRowBg)} {...statusColumnWidthProps}>
                                      <Select
                                        size="xs"
                                        value={mod.status ?? "not_started"}
                                        w="100%"
                                        isDisabled={savingStatusPk === mod.pk}
                                        onChange={(e) => saveModuleStatus(mod.pk, e.target.value)}
                                        {...statusSelectFieldProps(mod.status ?? "not_started")}
                                      >
                                        {statusOptions.map((opt) => (
                                          <option key={opt.value} value={opt.value} style={statusOptionStyle(opt.value)}>
                                            {opt.label}
                                          </option>
                                        ))}
                                      </Select>
                                    </Td>}
                                    {vis("cycle_time")         && <Td {...colStickyProps("cycle_time", moduleRowBg)} />}
                                    {vis("target_per_hour")    && <Td {...colStickyProps("target_per_hour", moduleRowBg)} />}
                                    {vis("daily_target")       && <Td {...colStickyProps("daily_target", moduleRowBg)} />}
                                    {vis("process_start")      && <Td whiteSpace="nowrap" onClick={(e) => e.stopPropagation()} {...colStickyProps("process_start", moduleRowBg)}>
                                      {editingModuleDate?.pk === mod.pk && editingModuleDate.field === "process_start_date" ? (
                                        <LocalizedDateInput
                                          compact
                                          size="xs"
                                          w="120px"
                                          value={editingModuleDate.val}
                                          onChange={(v) => setEditingModuleDate({ pk: mod.pk, field: "process_start_date", val: v })}
                                          onCommit={(iso) => saveModuleDate(mod.pk, "process_start_date", iso)}
                                          onCancel={() => setEditingModuleDate(null)}
                                          autoFocus
                                          allowClear={false}
                                        />
                                      ) : (
                                        <Text fontSize="xs" cursor="pointer" color={mod.process_start_date ? undefined : "gray.300"}
                                          _hover={{ textDecoration: "underline" }}
                                          onClick={() => setEditingModuleDate({pk: mod.pk, field: "process_start_date", val: mod.process_start_date ?? ""})}>
                                          {fmtDate(mod.process_start_date)}
                                        </Text>
                                      )}
                                    </Td>}
                                    {vis("process_finish")     && <Td whiteSpace="nowrap" onClick={(e) => e.stopPropagation()} {...colStickyProps("process_finish", moduleRowBg)}>
                                      {editingModuleDate?.pk === mod.pk && editingModuleDate.field === "process_finish_date" ? (
                                        <LocalizedDateInput
                                          compact
                                          size="xs"
                                          w="120px"
                                          value={editingModuleDate.val}
                                          onChange={(v) => setEditingModuleDate({ pk: mod.pk, field: "process_finish_date", val: v })}
                                          onCommit={(iso) => saveModuleDate(mod.pk, "process_finish_date", iso)}
                                          onCancel={() => setEditingModuleDate(null)}
                                          autoFocus
                                          allowClear={false}
                                        />
                                      ) : (
                                        <Text fontSize="xs" cursor="pointer" color={mod.process_finish_date ? undefined : "gray.300"}
                                          _hover={{ textDecoration: "underline" }}
                                          onClick={() => setEditingModuleDate({pk: mod.pk, field: "process_finish_date", val: mod.process_finish_date ?? ""})}>
                                          {fmtDate(mod.process_finish_date)}
                                        </Text>
                                      )}
                                    </Td>}
                                    {vis("lead_time")          && <Td isNumeric {...colStickyProps("lead_time", moduleRowBg)}>{mod.process_lead_time_days != null ? (<Text fontSize="xs" fontWeight="semibold">{mod.process_lead_time_days}d</Text>) : <Text color="gray.300">—</Text>}</Td>}
                                    {vis("due_inbound")        && <Td {...colStickyProps("due_inbound", moduleRowBg)} />}
                                    {vis("expected_inbound")   && <Td {...colStickyProps("expected_inbound", moduleRowBg)} />}
                                    {vis("actual_inbound_qty") && <Td {...colStickyProps("actual_inbound_qty", moduleRowBg)} />}
                                    {vis("remark")             && <Td {...colStickyProps("remark", moduleRowBg)} />}
                                  </Tr>

                                  {/* ── Process Rows (P) ── */}
                                  {isModExpanded && mod.ep_processes.map((p) => (
                                    <Tr key={`p-${p.pk}`} bgColor={processRowBg}>
                                      <Td px={1} pl={9} minW="40px" position="sticky" left={0} zIndex={2} bgColor={processRowBg}><Box w="24px" /></Td>
                                      {visInfo("production_line") && <Td whiteSpace="nowrap" {...colStickyProps("production_line", processRowBg)}><Text color="gray.400" fontSize="xs">{s.production_line_name || "-"}</Text></Td>}
                                      {vis("sj_po_number") && <Td whiteSpace="nowrap" {...colStickyProps("sj_po_number", processRowBg)}><Text color="gray.400" fontSize="xs">{o?.sj_po_number ?? s.pk}</Text></Td>}
                                      {visInfo("sj_no") && <Td whiteSpace="nowrap" {...colStickyProps("sj_no", processRowBg)}><Text color="gray.400" fontSize="xs">{sj.sj_no || "-"}</Text></Td>}
                                      {visInfo("color") && <Td {...colStickyProps("color", processRowBg)}><Text color="gray.400" fontSize="xs">{o?.color || "-"}</Text></Td>}
                                      {visInfo("total_qty") && <Td isNumeric {...colStickyProps("total_qty", processRowBg)}>
                                        <Text color="gray.400" fontSize="xs">{p.total_qty != null ? p.total_qty.toLocaleString() : "-"}</Text>
                                      </Td>}
                                      {visInfo("assembly_output_qty") && <Td isNumeric {...colStickyProps("assembly_output_qty", processRowBg)}><Text color="gray.400" fontSize="xs">{s.production_assembly_output_qty != null ? s.production_assembly_output_qty.toLocaleString() : "-"}</Text></Td>}
                                      {visInfo("ex_factory") && <Td whiteSpace="nowrap" {...colStickyProps("ex_factory", processRowBg)}><Text color="gray.400" fontSize="xs">{fmtDate(o?.ex_factory_date)}</Text></Td>}
                                      {visInfo("assembly_start") && <Td whiteSpace="nowrap" {...colStickyProps("assembly_start", processRowBg)}><Text color="gray.400" fontSize="xs">{fmtDate(s.production_assembly_start_date)}</Text></Td>}
                                      {visInfo("assembly_finish") && <Td whiteSpace="nowrap" {...colStickyProps("assembly_finish", processRowBg)}><Text color="gray.400" fontSize="xs">{fmtDate(s.production_assembly_finish_date)}</Text></Td>}
                                      {vis("flow_memo")          && <Td maxW="160px" {...colStickyProps("flow_memo", processRowBg)}>{p.flow ? (<Tooltip label={p.flow} placement="top" hasArrow><Text fontSize="xs" noOfLines={2} cursor="default">{p.flow}</Text></Tooltip>) : <Text color="gray.300">—</Text>}</Td>}
                                      {vis("category")           && <Td {...colStickyProps("category", processRowBg)}><EpBadge kind="epProcess" fontSize="xs" /></Td>}
                                      {vis("media")              && <Td {...colStickyProps("media", processRowBg)}>{p.standard_work_video_url ? (<Tooltip label="View Standard Work Video" placement="top"><IconButton aria-label="View Standard Work Video" icon={<FaVideo />} size="xs" variant="ghost" colorScheme="red" onClick={() => { setSelectedVideo(p.standard_work_video_url!); setIsVideoModalOpen(true); }} /></Tooltip>) : <Text color="gray.300">—</Text>}</Td>}
                                      {vis("work_order")         && (
                                        <Td onClick={(e) => e.stopPropagation()} {...colStickyProps("work_order", processRowBg)}>
                                          {p.is_deleted ? (
                                            <Text color="gray.300">—</Text>
                                          ) : (
                                            <Tooltip label={t("ep.list.workOrderPrintTooltip")} placement="top" hasArrow>
                                              <IconButton
                                                aria-label={t("ep.list.workOrderPrintAria")}
                                                icon={<FaRegFileAlt />}
                                                size="xs"
                                                minW="32px"
                                                h="32px"
                                                variant="ghost"
                                                colorScheme="gray"
                                                sx={{
                                                  "& svg": { width: "17px", height: "17px" },
                                                  color: "gray.500",
                                                  _hover: { color: "gray.700", bg: "blackAlpha.50" },
                                                }}
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  openWindow(`/ep-production/processes/${p.pk}/work-order`);
                                                }}
                                              />
                                            </Tooltip>
                                          )}
                                        </Td>
                                      )}
                                      {vis("code")               && <Td whiteSpace="nowrap" onClick={(e) => e.stopPropagation()} {...colStickyProps("code", processRowBg)}><Link href="#" title={p.code} fontWeight="semibold" fontSize="xs" color="blue.600" onClick={(e) => { e.preventDefault(); e.stopPropagation(); openWindow(`/ep-production/processes/${p.pk}`); }}>{p.code}</Link></Td>}
                                      {vis("name")               && <Td whiteSpace="nowrap" {...colStickyProps("name", processRowBg)}>{p.name || p.name_ko || "-"}</Td>}
                                      {vis("iot")                && (
                                        <Td onClick={(e) => e.stopPropagation()} {...colStickyProps("iot", processRowBg)}>
                                          <IotStatusCell
                                            status={iotByProcessPk.get(p.pk)}
                                            liveReading={liveByProcessPk.get(p.pk)}
                                            onClick={() => openWindow(`/ep-production/processes/${p.pk}?iot=1`)}
                                          />
                                        </Td>
                                      )}
                                      {vis("output_qty")         && <Td isNumeric {...colStickyProps("output_qty", processRowBg)} onClick={(e) => e.stopPropagation()}>
                                        {editingProcessQty?.pk === p.pk && !p.output_qty_locked ? (
                                          <Input size="xs" w="70px" value={editingProcessQty.val} autoFocus
                                            type="number" min={0} max={p.total_qty ?? undefined}
                                            onChange={(e) => {
                                              const raw = e.target.value;
                                              if (raw === "") { setEditingProcessQty({pk: p.pk, val: "", totalQty: p.total_qty}); return; }
                                              const n = parseInt(raw, 10);
                                              if (!isNaN(n) && p.total_qty != null && n > p.total_qty) return;
                                              setEditingProcessQty({pk: p.pk, val: raw, totalQty: p.total_qty});
                                            }}
                                            onBlur={() => saveProcessQty(p.pk, editingProcessQty.val, p.total_qty)}
                                            onKeyDown={(e) => { if (e.key === "Enter") saveProcessQty(p.pk, editingProcessQty.val, p.total_qty); if (e.key === "Escape") setEditingProcessQty(null); }}
                                          />
                                        ) : p.output_qty_locked ? (
                                          <Tooltip label={t("ep.common.outputQtyFromDailyReport")} hasArrow placement="top">
                                            <Box as="span" display="inline-block">
                                              <EpFlashQty value={p.output_qty ?? 0} cursor="default">
                                                {(p.output_qty ?? 0).toLocaleString()}
                                              </EpFlashQty>
                                            </Box>
                                          </Tooltip>
                                        ) : (
                                          <EpFlashQty
                                            value={p.output_qty ?? 0}
                                            cursor="pointer"
                                            _hover={{ textDecoration: "underline" }}
                                            onClick={() => setEditingProcessQty({pk: p.pk, val: String(p.output_qty ?? ""), totalQty: p.total_qty})}
                                          >
                                            {(p.output_qty ?? 0).toLocaleString()}
                                          </EpFlashQty>
                                        )}
                                      </Td>}
                                      {vis("defect_qty")         && (
                                        <Td isNumeric {...colStickyProps("defect_qty", processRowBg)} onClick={(e) => e.stopPropagation()}>
                                          <DefectQtyLink defectQty={p.total_defect_qty ?? 0} to={`/ep-production/inspections?ep_process=${p.pk}`} />
                                        </Td>
                                      )}
                                      {vis("balance_qty")        && <Td isNumeric {...colStickyProps("balance_qty", processRowBg)}>
                                        {p.total_qty != null
                                          ? <Text fontSize="xs" fontWeight="semibold">{Math.max(0, p.total_qty - (p.output_qty ?? 0)).toLocaleString()}</Text>
                                          : <Text color="gray.300">—</Text>}
                                      </Td>}
                                      {vis("progress")           && <Td {...colStickyProps("progress", processRowBg)}>
                                        {p.total_qty != null && p.total_qty > 0 ? (() => {
                                          const pct = Math.min(100, Math.round(((p.output_qty ?? 0) / p.total_qty) * 100));
                                          const color = pct >= 100 ? "green.400" : pct >= 50 ? "blue.400" : "orange.400";
                                          return <Box><Text fontSize="xs" mb={0.5}>{pct}%</Text><Box w="80px" h="5px" bg="gray.200" borderRadius="full" overflow="hidden"><Box w={`${pct}%`} h="100%" bg={color} borderRadius="full" /></Box></Box>;
                                        })() : <Text color="gray.300">—</Text>}
                                      </Td>}
                                      {vis("status")             && <Td onClick={(e) => e.stopPropagation()} {...colStickyProps("status", processRowBg)} {...statusColumnWidthProps}>
                                        <Select
                                          size="xs"
                                          value={p.status ?? "not_started"}
                                          w="100%"
                                          isDisabled={savingStatusPk === p.pk}
                                          onChange={(e) => saveProcessStatus(p.pk, e.target.value)}
                                          {...statusSelectFieldProps(p.status ?? "not_started")}
                                        >
                                          {statusOptions.map((opt) => (
                                            <option key={opt.value} value={opt.value} style={statusOptionStyle(opt.value)}>
                                              {opt.label}
                                            </option>
                                          ))}
                                        </Select>
                                      </Td>}
                                      {vis("cycle_time")         && <Td isNumeric {...colStickyProps("cycle_time", processRowBg)}>{p.cycle_time ?? <Text color="gray.300">—</Text>}</Td>}
                                      {vis("target_per_hour")    && <Td isNumeric {...colStickyProps("target_per_hour", processRowBg)}>{p.target_qty_per_hour ?? <Text color="gray.300">—</Text>}</Td>}
                                      {vis("daily_target")       && <Td isNumeric {...colStickyProps("daily_target", processRowBg)}>{p.daily_target_qty_8h ?? <Text color="gray.300">—</Text>}</Td>}
                                      {vis("process_start")      && <Td whiteSpace="nowrap" onClick={(e) => e.stopPropagation()} {...colStickyProps("process_start", processRowBg)}>
                                        {editingProcessDate?.pk === p.pk && editingProcessDate.field === "process_start_date" ? (
                                          <LocalizedDateInput
                                            compact
                                            size="xs"
                                            w="120px"
                                            value={editingProcessDate.val}
                                            onChange={(v) => setEditingProcessDate({ pk: p.pk, field: "process_start_date", val: v })}
                                            onCommit={(iso) => saveProcessDate(p.pk, "process_start_date", iso)}
                                            onCancel={() => setEditingProcessDate(null)}
                                            autoFocus
                                            allowClear={false}
                                          />
                                        ) : (
                                          <Text fontSize="xs" cursor="pointer" color={p.process_start_date ? undefined : "gray.300"}
                                            _hover={{ textDecoration: "underline" }}
                                            onClick={() => setEditingProcessDate({pk: p.pk, field: "process_start_date", val: p.process_start_date ?? ""})}>
                                            {fmtDate(p.process_start_date)}
                                          </Text>
                                        )}
                                      </Td>}
                                      {vis("process_finish")     && <Td whiteSpace="nowrap" onClick={(e) => e.stopPropagation()} {...colStickyProps("process_finish", processRowBg)}>
                                        {editingProcessDate?.pk === p.pk && editingProcessDate.field === "process_finish_date" ? (
                                          <LocalizedDateInput
                                            compact
                                            size="xs"
                                            w="120px"
                                            value={editingProcessDate.val}
                                            onChange={(v) => setEditingProcessDate({ pk: p.pk, field: "process_finish_date", val: v })}
                                            onCommit={(iso) => saveProcessDate(p.pk, "process_finish_date", iso)}
                                            onCancel={() => setEditingProcessDate(null)}
                                            autoFocus
                                            allowClear={false}
                                          />
                                        ) : (
                                          <Text fontSize="xs" cursor="pointer" color={p.process_finish_date ? undefined : "gray.300"}
                                            _hover={{ textDecoration: "underline" }}
                                            onClick={() => setEditingProcessDate({pk: p.pk, field: "process_finish_date", val: p.process_finish_date ?? ""})}>
                                            {fmtDate(p.process_finish_date)}
                                          </Text>
                                        )}
                                      </Td>}
                                      {vis("lead_time")          && <Td isNumeric {...colStickyProps("lead_time", processRowBg)}>{p.process_lead_time_days != null ? (<Text fontSize="xs" fontWeight="semibold">{p.process_lead_time_days}d</Text>) : <Text color="gray.300">—</Text>}</Td>}
                                      {vis("due_inbound")        && <Td {...colStickyProps("due_inbound", processRowBg)} />}
                                      {vis("expected_inbound")   && <Td {...colStickyProps("expected_inbound", processRowBg)} />}
                                      {vis("actual_inbound_qty") && <Td {...colStickyProps("actual_inbound_qty", processRowBg)} />}
                                      {vis("remark")             && <Td {...colStickyProps("remark", processRowBg)} />}
                                    </Tr>
                                  ))}
                                </Fragment>
                              );
                            })}
                          </Fragment>
                        );
                      })}
                    </Fragment>
                  );
                })}
              </Tbody>
            </Table>
          </TableContainer>
        </Box>
      </Box>

      {/* Video Modal */}
      <VideoModal
        isOpen={isVideoModalOpen}
        onClose={() => { setIsVideoModalOpen(false); setSelectedVideo(undefined); }}
        selectedVideo={selectedVideo}
      />

      {/* Photo Modal */}
      <PhotoModal
        isOpen={isPhotoModalOpen}
        onClose={() => { setIsPhotoModalOpen(false); setSelectedPhoto(undefined); }}
        selectedImage={selectedPhoto}
      />

      {/* Create Modal */}
      <Modal isOpen={isOpen} onClose={() => { resetModal(); onClose(); }} size="2xl" isCentered scrollBehavior="inside">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>{t("ep.list.newSchedule")}</ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={2}>
            <Grid templateColumns="1fr 1fr" gap={4}>

              {/* ── SJ Order 검색 ── */}
              <FormControl isRequired gridColumn="1 / -1">
                <FormLabel fontSize="sm">SJ Order <Text as="span" color="gray.400" fontWeight="normal">(SJ PO# 또는 SJ No 검색)</Text></FormLabel>
                <Box position="relative">
                  <InputGroup>
                    <Input
                      value={orderQuery}
                      onChange={(e) => handleOrderSearch(e.target.value)}
                      placeholder="예: SJ-2024-001 또는 SJ-NO-123"
                      autoComplete="off"
                      borderColor={selectedOrder ? "green.400" : undefined}
                    />
                    {orderSearching && (
                      <InputRightElement><Spinner size="sm" color="gray.400" /></InputRightElement>
                    )}
                    {selectedOrder && !orderSearching && (
                      <InputRightElement color="green.400" fontSize="lg">✓</InputRightElement>
                    )}
                  </InputGroup>
                  {/* 검색 결과 드롭다운 */}
                  {orderResults.length > 0 && (
                    <List
                      position="absolute"
                      top="100%"
                      left={0}
                      right={0}
                      zIndex={10}
                      bg="white"
                      border="1px solid"
                      borderColor="gray.200"
                      borderRadius="md"
                      boxShadow="lg"
                      maxH="240px"
                      overflowY="auto"
                      mt={1}
                    >
                      {orderResults.map((order) => (
                        <ListItem
                          key={order.pk}
                          px={3}
                          py={2}
                          cursor="pointer"
                          _hover={{ bg: "blue.50" }}
                          onClick={() => selectOrder(order)}
                          borderBottom="1px solid"
                          borderColor="gray.100"
                        >
                          <HStack justify="space-between">
                            <Box>
                              <Text fontSize="sm" fontWeight="bold" color="blue.600">{order.sj_po_number}</Text>
                              <HStack spacing={2} mt={0.5}>
                                {order.sj_no_value && <Text fontSize="xs" color="gray.500">SJ No: {order.sj_no_value}</Text>}
                                {order.style_name && <Text fontSize="xs" color="gray.500">{order.style_name}</Text>}
                                {order.color && <Text fontSize="xs" color="gray.500">{order.color}</Text>}
                              </HStack>
                            </Box>
                            <Box textAlign="right">
                              {order.ex_factory_date && <Text fontSize="xs" color="orange.500">EX: {order.ex_factory_date}</Text>}
                              {order.total_order_qty && <Text fontSize="xs" color="gray.500">{order.total_order_qty.toLocaleString()} pcs</Text>}
                            </Box>
                          </HStack>
                        </ListItem>
                      ))}
                    </List>
                  )}
                </Box>
                {/* 선택된 오더 요약 */}
                {selectedOrder && (
                  <Box mt={2} p={2} bg="green.50" borderRadius="md" border="1px solid" borderColor="green.200">
                    <HStack justify="space-between">
                      <Box>
                        <Text fontSize="xs" color="green.700" fontWeight="bold">{selectedOrder.sj_po_number}</Text>
                        <Text fontSize="xs" color="gray.600">
                          {[selectedOrder.sj_no_value, selectedOrder.style_name, selectedOrder.color].filter(Boolean).join(" · ")}
                        </Text>
                      </Box>
                      <Text fontSize="xs" color="gray.500">PK: {selectedOrder.pk}</Text>
                    </HStack>
                  </Box>
                )}
              </FormControl>

              <FormControl gridColumn="1 / -1">
                <FormLabel fontSize="sm">{t("ep.scheduleDetail.exFactory")}</FormLabel>
                <LocalizedDateInput
                  value={form.ex_factory_date}
                  onChange={(v) => setForm({ ...form, ex_factory_date: v })}
                  allowClear
                />
                <Text fontSize="xs" color="gray.500" mt={1}>
                  {t("ep.list.exFactoryHint")}
                </Text>
              </FormControl>

              <SimpleGrid columns={{ base: 1, md: 2 }} gap={4} gridColumn="1 / -1" w="100%">
                <FormControl>
                  <FormLabel fontSize="sm">{t("ep.list.factoryField")}</FormLabel>
                  <Select
                    placeholder={t("ep.list.factoryPlaceholder")}
                    value={form.factory === "" ? "" : String(form.factory)}
                    onChange={(e) => {
                      const v = e.target.value;
                      setForm((f) => ({
                        ...f,
                        factory: v === "" ? "" : v,
                        production_line: "",
                      }));
                    }}
                    isDisabled={productionLinesLoading}
                  >
                    <option value="">{t("ep.list.factoryNone")}</option>
                    {factoriesFromLines.map((fac) => (
                      <option key={fac.pk} value={String(fac.pk)}>
                        {fac.name}
                      </option>
                    ))}
                  </Select>
                </FormControl>
                <FormControl>
                  <FormLabel fontSize="sm">{t("ep.list.productionLineField")}</FormLabel>
                  <Select
                    placeholder={t("ep.list.productionLinePlaceholder")}
                    value={form.production_line === "" ? "" : String(form.production_line)}
                    onChange={(e) => {
                      const v = e.target.value;
                      setForm({ ...form, production_line: v === "" ? "" : v });
                    }}
                    isDisabled={productionLinesLoading || form.factory === ""}
                  >
                    <option value="">{t("ep.list.productionLineNone")}</option>
                    {linesForSelectedFactory.map((line) => (
                      <option key={line.pk} value={String(line.pk)}>
                        {formatProductionLineOption(line)}
                      </option>
                    ))}
                  </Select>
                </FormControl>
              </SimpleGrid>
              <Box gridColumn="1 / -1">
                <Text fontSize="xs" color="gray.600">
                  {t("ep.list.productionLineHint")}
                </Text>
              </Box>
              <FormControl>
                <FormLabel fontSize="sm">Status</FormLabel>
                <Select
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                  {...statusSelectFieldProps(String(form.status || "not_started"))}
                >
                  {statusOptions.map((o) => (
                    <option key={o.value} value={o.value} style={statusOptionStyle(o.value)}>
                      {o.label}
                    </option>
                  ))}
                </Select>
              </FormControl>
              <FormControl>
                <FormLabel fontSize="sm">Output Qty</FormLabel>
                <Input type="number" value={form.output_qty} onChange={(e) => setForm({ ...form, output_qty: e.target.value })} />
              </FormControl>
              <FormControl>
                <FormLabel fontSize="sm">Assembly Start Date</FormLabel>
                <LocalizedDateInput
                  value={form.production_assembly_start_date}
                  onChange={(v) => setForm({ ...form, production_assembly_start_date: v })}
                />
              </FormControl>
              <FormControl>
                <FormLabel fontSize="sm">Assembly Finish Date</FormLabel>
                <LocalizedDateInput
                  value={form.production_assembly_finish_date}
                  onChange={(v) => setForm({ ...form, production_assembly_finish_date: v })}
                />
              </FormControl>
              <FormControl>
                <FormLabel fontSize="sm">Process Start Date</FormLabel>
                <LocalizedDateInput
                  value={form.process_start_date}
                  onChange={(v) => setForm({ ...form, process_start_date: v })}
                />
              </FormControl>
              <FormControl>
                <FormLabel fontSize="sm">Process Finish Date</FormLabel>
                <LocalizedDateInput
                  value={form.process_finish_date}
                  onChange={(v) => setForm({ ...form, process_finish_date: v })}
                />
              </FormControl>
              <FormControl isRequired gridColumn="1 / -1">
                <FormLabel fontSize="sm">{t("ep.list.moduleCategoryLabel")}</FormLabel>
                <Text fontSize="xs" color="gray.500" mb={2}>
                  {t("ep.list.moduleCategoryHint")}
                </Text>
                {moduleCategoriesLoading ? (
                  <Spinner size="sm" color="gray.400" />
                ) : moduleCategoryRootCount === 0 ? (
                  <Text fontSize="sm" color="gray.500">
                    {t("ep.list.moduleCategoryEmpty")}
                  </Text>
                ) : (
                  <Box maxH="280px" overflowY="auto" pr={1}>
                    <ModuleCategoryCheckboxTree
                      parentPk={null}
                      depth={0}
                      childrenByParent={moduleCategoryChildrenByParent}
                      selectedIds={form.module_category_ids}
                      onToggle={toggleModuleCategory}
                    />
                  </Box>
                )}
              </FormControl>
              <FormControl gridColumn="1 / -1">
                <FormLabel fontSize="sm">Remark</FormLabel>
                <Input value={form.remark} onChange={(e) => setForm({ ...form, remark: e.target.value })} />
              </FormControl>
            </Grid>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={() => { resetModal(); onClose(); }}>Cancel</Button>
            <Button colorScheme="blue" isLoading={isSaving} onClick={handleCreate}>Create</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
}
