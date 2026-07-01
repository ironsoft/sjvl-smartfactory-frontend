import {
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
  Skeleton,
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
  Badge,
  Link,
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverBody,
  PopoverHeader,
  PopoverCloseButton,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  Portal,
  Wrap,
  WrapItem,
  Checkbox,
  SimpleGrid,
  Divider,
  InputGroup,
  InputRightElement,
  List,
  ListItem,
  VStack,
  Icon,
} from "@chakra-ui/react";
import { useQuery, useQueries, useQueryClient } from "@tanstack/react-query";
import { Helmet } from "react-helmet";
import {
  getVlAssemblySchedules,
  createVlAssemblySchedule,
  addSjNoToVlAssemblySchedule,
  moveVlAssemblySjNo,
  editVlAssemblySchedule,
  IVlAssemblySchedule,
  getVlAssemblyColumnPreference,
  saveVlAssemblyColumnPreference,
  searchSjOrders,
  ISjOrderSearchResult,
  patchVlAssemblySjNo,
  patchVlAssemblyModule,
  patchVlAssemblyProcess,
  getProductionLines,
  getModuleCategories,
  getVlAssemblyScheduleProductionDailyOutputs,
  getVlAssemblyModuleProductionDailyOutputs,
  getVlAssemblyProductionDailyOutputs,
  type IProductionLine,
  type IModuleCategory,
  type IVlAssemblyScheduleProductionDailyOutput,
  type IVlAssemblyModuleProductionDailyOutput,
  type IVlAssemblyProductionDailyOutput,
  type IEpModuleCopy,
  type IEpProcessCopy,
  getVlPlanHolidays,
  upsertVlPlanHoliday,
  deleteVlPlanHoliday,
} from "../api";
import { vlKeys, prodKeys } from "../lib/queryKeys";
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
  FaRegFileAlt,
  FaTruck,
  FaCalendarMinus,
  FaInfoCircle,
  FaEyeSlash,
  FaEllipsisV,
  FaTimes,
  FaCalendarAlt,
  FaBoxes,
  FaCheckCircle,
  FaExclamationTriangle,
  FaIndustry,
  FaUsers,
  FaUser,
} from "react-icons/fa";
import React, {
  Fragment,
  useState,
  useEffect,
  useRef,
  useMemo,
  useLayoutEffect,
  useCallback,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";

import VideoModal from "../components/VideoModal";
import { VlAssemblyBadge } from "../components/VlAssemblyBadge";
import { statusOptionStyle, statusSelectFieldProps } from "../components/StatusBadge";
import PhotoModal from "../components/PhotoModal";
import EpFlashQty from "../components/VlAssemblyFlashQty";
import LocalizedDateInput from "../components/LocalizedDateInput";
import { formatIsoDateDisplay } from "../lib/dateLocale";
import {
  displayModuleCategoryName,
  vlModuleCategoryBadgeLabels,
  collapseSjAssemblyLineLetters,
  resolveModuleCategoryLanguage,
  type VlModuleCategoryI18n,
} from "../lib/moduleCategoryDisplay";
import { vlSjThroughputDisplayFields, vlModuleThroughputDisplayFields } from "../lib/vlAssemblyThroughput";
import { findPreparationEpLeafCategoryId } from "../lib/preparationEpCategory";
import { runPreparationEpModuleMigrationOnce } from "../lib/runPreparationEpModuleMigrationOnce";
import {
  VL_ASSEMBLY_SCHEDULE_LIST_CACHE_BUST_KEY,
  broadcastVlAssemblyScheduleListCacheBust,
} from "../lib/vlAssemblyProductionScheduleListCacheBust";

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

/** 생산 라인 그룹 좌측 띠 색 (라인마다 순환) */
const LINE_GROUP_ACCENTS = [
  "blue.400",
  "teal.400",
  "purple.400",
  "orange.400",
  "cyan.400",
  "pink.400",
] as const;

type VlScheduleLineGroup = {
  lineKey: string;
  linePk: number | null;
  schedules: IVlAssemblySchedule[];
};

function buildVlSchedulesGroupedByProductionLine(schedules: IVlAssemblySchedule[]): VlScheduleLineGroup[] {
  const buckets = new Map<string, IVlAssemblySchedule[]>();
  for (const s of schedules) {
    const pk = s.production_line ?? null;
    const key = pk != null ? `L${pk}` : "_none";
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push(s);
  }
  const groups: VlScheduleLineGroup[] = [];
  for (const [lineKey, list] of Array.from(buckets.entries())) {
    if (list.length === 0) continue;
    groups.push({
      lineKey,
      linePk: list[0].production_line ?? null,
      schedules: list,
    });
  }
  groups.sort((a, b) => {
    if (a.linePk == null && b.linePk != null) return 1;
    if (a.linePk != null && b.linePk == null) return -1;
    const an = (a.schedules[0]?.production_line_name ?? "").trim() || "\uffff";
    const bn = (b.schedules[0]?.production_line_name ?? "").trim() || "\uffff";
    return an.localeCompare(bn, undefined, { sensitivity: "base" });
  });
  return groups;
}

function vlLineGroupKpis(schedules: IVlAssemblySchedule[]) {
  let sjCount = 0;
  let totalQty = 0;
  let outputQty = 0;
  let defectQty = 0;
  let assemblyOutSum = 0;
  for (const s of schedules) {
    assemblyOutSum += s.production_assembly_output_qty ?? 0;
    for (const sj of s.ep_sj_nos ?? []) {
      sjCount += 1;
      totalQty += sj.total_qty ?? 0;
      outputQty += sj.output_qty ?? 0;
      defectQty += sj.total_defect_qty ?? 0;
    }
  }
  return {
    scheduleCount: schedules.length,
    sjCount,
    totalQty,
    outputQty,
    defectQty,
    assemblyOutSum,
  };
}

function lineGroupLeftBorderProps(accent: string) {
  const cssColor = `var(--chakra-colors-${accent.replace(".", "-")})`;
  return {
    boxShadow: `inset 4px 0 0 0 ${cssColor}`,
  };
}

const MODULE_CATEGORY_BADGE_SCHEMES = ["teal", "purple", "orange", "pink", "cyan"] as const;

function renderModuleSubCategoryBadges(labels: string[], keyPrefix: string) {
  if (labels.length === 0) return <Text color="gray.300">—</Text>;
  return (
    <Box minW={0} w="100%" overflowX="auto" overflowY="hidden" sx={{ scrollbarWidth: "thin" }}>
      <HStack spacing={1} align="center" w="max-content" py={0.5} sx={{ flexWrap: "nowrap" }}>
        {labels.map((label, i) => (
          <Badge
            key={`${keyPrefix}-${i}-${label}`}
            variant="solid"
            colorScheme={MODULE_CATEGORY_BADGE_SCHEMES[i % MODULE_CATEGORY_BADGE_SCHEMES.length]}
            fontSize="xs"
            px={2}
            py={0.5}
            borderRadius="md"
            fontWeight="semibold"
            textTransform="none"
            flexShrink={0}
            whiteSpace="nowrap"
          >
            {label}
          </Badge>
        ))}
      </HStack>
    </Box>
  );
}

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

/** Output Qty 옆 누적 불량 수량 — 클릭 시 VL Assembly 검사 목록(필터)을 독립창으로 열기 */
function DefectQtyLink({ defectQty, to }: { defectQty: number; to: string }) {
  const { t } = useTranslation();
  return (
    <Tooltip label={t("vlAssembly.list.defectQtyCumulativeTooltip")} hasArrow placement="top">
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
  sj_order_ids: [] as number[],
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
  /** VL Assembly 딥카피에 포함할 ModuleCategory PK (어느 레벨이든 선택 가능) */
  module_category_ids: [] as number[],
};

function formatProductionLineOption(line: IProductionLine): string {
  const ko = line.name_ko?.trim();
  return ko ? `${line.name} (${ko})` : line.name;
}

/** Today Output 셀 내부 – 수량 + (T:타겟 달성% / 계획 달성%) */
function TodayOutputBreakdown({
  todayOut,
  dailyTarget,
  dailyPlan,
}: {
  todayOut: number;
  dailyTarget: number | null | undefined;
  dailyPlan: number | null | undefined;
}) {
  const pctColor = (p: number) =>
    p >= 100 ? "green.500" : p >= 80 ? "blue.500" : p >= 50 ? "orange.400" : "red.400";
  const targetPct =
    dailyTarget != null && dailyTarget > 0
      ? Math.round((todayOut / dailyTarget) * 100)
      : null;
  const planPct =
    dailyPlan != null && dailyPlan > 0
      ? Math.round((todayOut / dailyPlan) * 100)
      : null;
  const hasBreakdown = dailyTarget != null || dailyPlan != null;

  return (
    <Box textAlign="right">
      {todayOut > 0 ? (
        <Text fontWeight="semibold" fontSize="sm">{todayOut.toLocaleString()}</Text>
      ) : (
        <Text color="gray.300">—</Text>
      )}
      {hasBreakdown && (
        <Text fontSize="10px" color="gray.500" lineHeight={1.3} mt="1px" whiteSpace="nowrap">
          {"(T:"}
          <Text as="span" color="gray.600">
            {dailyTarget != null ? dailyTarget.toLocaleString() : "—"}
          </Text>
          {targetPct != null && (
            <Text as="span" color={pctColor(targetPct)} fontWeight="bold">
              {` ${targetPct}%`}
            </Text>
          )}
          {" / "}
          <Text as="span" color="gray.600">
            {"P:"}
            {dailyPlan != null ? dailyPlan.toLocaleString() : "—"}
          </Text>
          {planPct != null && (
            <Text as="span" color={pctColor(planPct)} fontWeight="bold">
              {` ${planPct}%`}
            </Text>
          )}
          {")"}
        </Text>
      )}
    </Box>
  );
}

// ─── Daily Required Qty helpers ────────────────────────────────────────────

type DailyReqStatus =
  | "done"      // balance = 0
  | "d_day"     // 마감일 = 오늘 (오늘 안에 마무리 필요)
  | "ok"        // req ≤ daily_target
  | "warn"      // daily_target < req ≤ daily_target × 1.5
  | "danger"    // req > daily_target × 1.5
  | "overdue"   // 마감일 이미 지남, 잔량 있음
  | "no_target" // 마감일 있지만 일일 타겟 미설정
  | "no_date";  // 마감일 없음

interface DailyReqResult {
  status: DailyReqStatus;
  reqDaily: number | null;
  remainDays: number;   // 내일부터 마감일까지 잔여 근무일
  overdueDays: number;  // 마감 초과 달력일
}

function calcDailyRequired(
  balance: number,
  deadlineIso: string | null | undefined,
  todayYmd: string,
  holidays: ReadonlySet<string>,
  dailyTarget: number | null | undefined
): DailyReqResult {
  if (balance <= 0) return { status: "done", reqDaily: 0, remainDays: 0, overdueDays: 0 };
  if (!deadlineIso) return { status: "no_date", reqDaily: null, remainDays: 0, overdueDays: 0 };

  const todayDate = parseYmdLocal(todayYmd);
  const deadline = parseLocalMidnightFromIso(deadlineIso);
  if (!deadline) return { status: "no_date", reqDaily: null, remainDays: 0, overdueDays: 0 };

  // 마감 초과: 마감일이 어제 이전
  if (deadline.getTime() < todayDate.getTime()) {
    const overdueDays = Math.round((todayDate.getTime() - deadline.getTime()) / 864e5);
    return { status: "overdue", reqDaily: null, remainDays: 0, overdueDays };
  }

  // D-Day: 마감일이 오늘
  if (deadline.getTime() === todayDate.getTime()) {
    const reqDaily = balance; // 오늘 안에 전량 처리
    if (dailyTarget == null) return { status: "d_day", reqDaily, remainDays: 0, overdueDays: 0 };
    return { status: "d_day", reqDaily, remainDays: 0, overdueDays: 0 };
  }

  // 잔여 근무일: 내일부터 마감일(포함)까지
  const tomorrow = new Date(todayDate);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const remainDays = countPlanWorkDays(tomorrow, deadline, holidays);

  // 내일~마감 사이 근무일이 없는 경우(모두 공휴일/일요일) → D-Day처럼 처리
  if (remainDays <= 0) {
    return { status: "d_day", reqDaily: balance, remainDays: 0, overdueDays: 0 };
  }

  const reqDaily = Math.ceil(balance / remainDays);

  if (dailyTarget == null) return { status: "no_target", reqDaily, remainDays, overdueDays: 0 };
  if (reqDaily <= dailyTarget) return { status: "ok", reqDaily, remainDays, overdueDays: 0 };
  if (reqDaily <= Math.ceil(dailyTarget * 1.5)) return { status: "warn", reqDaily, remainDays, overdueDays: 0 };
  return { status: "danger", reqDaily, remainDays, overdueDays: 0 };
}

const DAILY_REQ_PALETTE: Record<
  DailyReqStatus,
  { dot: string; text: string; sub: string; bg: string }
> = {
  done:      { dot: "green.400", text: "green.600", sub: "green.400",  bg: "green.50"  },
  d_day:     { dot: "red.500",   text: "red.600",   sub: "red.400",    bg: "red.50"    },
  ok:        { dot: "green.400", text: "green.700", sub: "gray.500",   bg: "green.50"  },
  warn:      { dot: "orange.400",text: "orange.600",sub: "orange.400", bg: "orange.50" },
  danger:    { dot: "red.500",   text: "red.600",   sub: "red.400",    bg: "red.50"    },
  overdue:   { dot: "red.700",   text: "red.700",   sub: "red.500",    bg: "red.100"   },
  no_target: { dot: "blue.300",  text: "blue.700",  sub: "gray.400",   bg: "blue.50"   },
  no_date:   { dot: "gray.300",  text: "gray.400",  sub: "gray.300",   bg: "transparent" },
};

const DAILY_REQ_ICON: Record<DailyReqStatus, string> = {
  done:      "✓",
  d_day:     "‼",
  ok:        "●",
  warn:      "⚠",
  danger:    "⚠⚠",
  overdue:   "‼",
  no_target: "○",
  no_date:   "—",
};

function DailyReqCell({
  result,
  size = "sm",
}: {
  result: DailyReqResult;
  size?: "sm" | "xs";
}) {
  const { t } = useTranslation();
  const { status, reqDaily, remainDays, overdueDays } = result;
  const pal = DAILY_REQ_PALETTE[status];
  const icon = DAILY_REQ_ICON[status];
  const fontSize = size === "xs" ? "10px" : "xs";

  if (status === "no_date") {
    return <Text color="gray.300">—</Text>;
  }

  return (
    <Box
      display="inline-flex"
      flexDir="column"
      alignItems="flex-end"
      gap="1px"
      borderRadius="md"
      px={1}
      py="1px"
      bg={pal.bg}
    >
      {/* 메인 라인: 아이콘 + 필요 일산량 */}
      <HStack spacing="3px" justify="flex-end">
        <Text as="span" color={pal.dot} fontWeight="bold" fontSize={fontSize} lineHeight={1}>
          {icon}
        </Text>
        {status === "done" ? (
          <Text color={pal.text} fontWeight="bold" fontSize={fontSize} lineHeight={1}>
            {t("vlAssembly.list.dailyReq.statusDone")}
          </Text>
        ) : status === "overdue" ? (
          <Text color={pal.text} fontWeight="bold" fontSize={fontSize} lineHeight={1}>
            {t("vlAssembly.list.dailyReq.statusOverdue", { n: overdueDays })}
          </Text>
        ) : status === "d_day" ? (
          <Text color={pal.text} fontWeight="bold" fontSize={fontSize} lineHeight={1}>
            {t("vlAssembly.list.dailyReq.statusDDay", { qty: reqDaily!.toLocaleString() })}
          </Text>
        ) : (
          <Text color={pal.text} fontWeight="bold" fontSize={fontSize} lineHeight={1}>
            {t("vlAssembly.list.dailyReq.reqPerDay", { qty: reqDaily!.toLocaleString() })}
          </Text>
        )}
      </HStack>
      {/* 보조 라인: 잔여 근무일 (내일부터 마감까지) — done/overdue/d_day 제외 */}
      {status !== "done" && status !== "overdue" && status !== "d_day" && (
        <Text color={pal.sub} fontSize="10px" lineHeight={1} textAlign="right">
          {t("vlAssembly.list.dailyReq.remainDays", { n: remainDays })}
        </Text>
      )}
    </Box>
  );
}

/** 컬럼 헤더 ⓘ 버튼 — 필요 일산량 상태 범례 팝오버 */
function DailyReqLegend() {
  const { t } = useTranslation();

  const entries: { icon: string; color: string; label: string; desc: string }[] = [
    { icon: "✓", color: "green.500",  label: t("vlAssembly.list.dailyReq.legend.done.label"),     desc: t("vlAssembly.list.dailyReq.legend.done.desc") },
    { icon: "‼", color: "red.600",    label: t("vlAssembly.list.dailyReq.legend.dDay.label"),     desc: t("vlAssembly.list.dailyReq.legend.dDay.desc") },
    { icon: "●", color: "green.600",  label: t("vlAssembly.list.dailyReq.legend.ok.label"),       desc: t("vlAssembly.list.dailyReq.legend.ok.desc") },
    { icon: "⚠", color: "orange.500", label: t("vlAssembly.list.dailyReq.legend.warn.label"),     desc: t("vlAssembly.list.dailyReq.legend.warn.desc") },
    { icon: "⚠⚠",color: "red.500",   label: t("vlAssembly.list.dailyReq.legend.danger.label"),   desc: t("vlAssembly.list.dailyReq.legend.danger.desc") },
    { icon: "‼", color: "red.700",    label: t("vlAssembly.list.dailyReq.legend.overdue.label"),  desc: t("vlAssembly.list.dailyReq.legend.overdue.desc") },
    { icon: "○", color: "blue.600",   label: t("vlAssembly.list.dailyReq.legend.noTarget.label"), desc: t("vlAssembly.list.dailyReq.legend.noTarget.desc") },
    { icon: "—", color: "gray.400",   label: t("vlAssembly.list.dailyReq.legend.noDate.label"),   desc: t("vlAssembly.list.dailyReq.legend.noDate.desc") },
  ];

  return (
    <Popover placement="bottom-start" isLazy>
      <PopoverTrigger>
        <Box
          as="button"
          display="inline-flex"
          alignItems="center"
          color="blue.400"
          _hover={{ color: "blue.600" }}
          cursor="pointer"
          ml={1}
          onClick={(e: React.MouseEvent) => e.stopPropagation()}
        >
          <Icon as={FaInfoCircle} boxSize="11px" />
        </Box>
      </PopoverTrigger>
      <PopoverContent minW="320px" maxW="420px" w="max-content" wordBreak="break-word" fontSize="xs" shadow="xl" zIndex={9999}>
        <PopoverHeader fontWeight="semibold" fontSize="sm" pb={1}>
          {t("vlAssembly.list.dailyReq.legend.title")}
        </PopoverHeader>
        <PopoverCloseButton />
        <PopoverBody pt={1} pb={3}>
          <Text fontSize="10px" color="gray.500" mb={2} whiteSpace="pre-wrap">
            {t("vlAssembly.list.dailyReq.legend.formula")}
          </Text>
          <VStack align="stretch" spacing={1}>
            {entries.map((e) => (
              <HStack key={e.label} spacing={2} align="flex-start">
                <Text
                  as="span"
                  minW="20px"
                  textAlign="center"
                  color={e.color}
                  fontWeight="bold"
                  fontSize="11px"
                  lineHeight={1.4}
                  flexShrink={0}
                >
                  {e.icon}
                </Text>
                <Box>
                  <Text fontWeight="semibold" color={e.color} lineHeight={1.3}>
                    {e.label}
                  </Text>
                  <Text color="gray.500" lineHeight={1.3}>
                    {e.desc}
                  </Text>
                </Box>
              </HStack>
            ))}
          </VStack>
        </PopoverBody>
      </PopoverContent>
    </Popover>
  );
}

// ─── EF Buffer & SPI helpers ────────────────────────────────────────────────

/** 오늘 기준으로 N 근무일 후의 YMD 반환 */
function addWorkDays(fromYmd: string, workDays: number, holidays: ReadonlySet<string>): string {
  if (workDays <= 0) return fromYmd;
  const d = parseYmdLocal(fromYmd);
  let remaining = workDays;
  let iter = 0;
  while (remaining > 0 && iter < 2000) {
    d.setDate(d.getDate() + 1);
    iter++;
    if (d.getDay() !== 0 && !holidays.has(ymdFromLocalDate(d))) remaining--;
  }
  return ymdFromLocalDate(d);
}

// ── EF Buffer ──────────────────────────────────────────────────────────────

type EfBufferStatus = "done" | "safe" | "tight" | "danger" | "no_data";
interface EfBufferResult {
  status: EfBufferStatus;
  projectedYmd: string | null;
  /** EX-Factory 기준 버퍼 근무일 (양수=여유, 음수=초과) */
  bufferDays: number;
  pace: "actual" | "target" | null;
}

function calcEfBuffer(
  balance: number,
  outputQty: number,
  assemblyStartIso: string | null | undefined,
  softDeadlineIso: string | null | undefined,
  hardDeadlineIso: string | null | undefined,
  todayYmd: string,
  holidays: ReadonlySet<string>,
  dailyTarget: number | null | undefined
): EfBufferResult {
  const NO_DATA: EfBufferResult = { status: "no_data", projectedYmd: null, bufferDays: 0, pace: null };
  if (balance <= 0) return { status: "done", projectedYmd: null, bufferDays: 0, pace: null };
  const effectiveHard = hardDeadlineIso ?? softDeadlineIso;
  if (!effectiveHard) return NO_DATA;

  // 실제 일산 속도 (조립 시작 후 실적이 있을 때)
  let dailyPace: number | null = null;
  let pace: EfBufferResult["pace"] = null;
  const startDate = assemblyStartIso ? parseLocalMidnightFromIso(assemblyStartIso) : null;
  const todayDate = parseYmdLocal(todayYmd);
  if (startDate && outputQty > 0 && startDate.getTime() <= todayDate.getTime()) {
    const elapsed = countPlanWorkDays(startDate, todayDate, holidays);
    if (elapsed > 0) { dailyPace = outputQty / elapsed; pace = "actual"; }
  }
  if (dailyPace == null && dailyTarget != null && dailyTarget > 0) {
    dailyPace = dailyTarget; pace = "target";
  }
  if (dailyPace == null || dailyPace <= 0) return NO_DATA;

  const remainingWd = Math.ceil(balance / dailyPace);
  const projectedYmd = addWorkDays(todayYmd, remainingWd, holidays);
  const projectedDate = parseYmdLocal(projectedYmd);
  const hardDate = parseLocalMidnightFromIso(effectiveHard)!;

  const bufferDays =
    projectedDate.getTime() <= hardDate.getTime()
      ? countPlanWorkDays(projectedDate, hardDate, holidays)
      : -countPlanWorkDays(hardDate, projectedDate, holidays);

  // 상태: softDeadline(조립종료) 초과 여부로 tight 판정
  const softDate = softDeadlineIso ? parseLocalMidnightFromIso(softDeadlineIso) : null;
  let status: EfBufferStatus;
  if (bufferDays < 0) {
    status = "danger";
  } else if (softDate && projectedDate.getTime() > softDate.getTime()) {
    status = "tight"; // 조립종료 초과, 하지만 EX-Factory 이내
  } else {
    status = bufferDays > 3 ? "safe" : "tight";
  }

  return { status, projectedYmd, bufferDays, pace };
}

const EF_BUFFER_PALETTE: Record<EfBufferStatus, { dot: string; text: string; sub: string; bg: string }> = {
  done:    { dot: "green.400", text: "green.700", sub: "gray.400",   bg: "green.50"  },
  safe:    { dot: "green.400", text: "green.700", sub: "gray.500",   bg: "green.50"  },
  tight:   { dot: "orange.400",text: "orange.600",sub: "orange.400", bg: "orange.50" },
  danger:  { dot: "red.500",   text: "red.600",   sub: "red.400",    bg: "red.50"    },
  no_data: { dot: "gray.300",  text: "gray.400",  sub: "gray.300",   bg: "transparent" },
};

function EfBufferCell({ result, size = "sm" }: { result: EfBufferResult; size?: "sm" | "xs" }) {
  const { t, i18n } = useTranslation();
  const { status, projectedYmd, bufferDays, pace } = result;
  const pal = EF_BUFFER_PALETTE[status];
  const fs = size === "xs" ? "10px" : "xs";
  const icons: Record<EfBufferStatus, string> = { done: "✓", safe: "●", tight: "⚠", danger: "⚠⚠", no_data: "—" };

  if (status === "no_data") return <Text color="gray.300">—</Text>;

  const bufferLabel =
    status === "done"
      ? t("vlAssembly.list.efBuffer.done")
      : bufferDays >= 0
      ? t("vlAssembly.list.efBuffer.bufferPlus",  { n: bufferDays })
      : t("vlAssembly.list.efBuffer.bufferMinus", { n: Math.abs(bufferDays) });

  return (
    <Box display="inline-flex" flexDir="column" alignItems="flex-end" gap="1px" borderRadius="md" px={1} py="1px" bg={pal.bg}>
      <HStack spacing="3px" justify="flex-end">
        <Text as="span" color={pal.dot} fontWeight="bold" fontSize={fs} lineHeight={1}>{icons[status]}</Text>
        <Text color={pal.text} fontWeight="bold" fontSize={fs} lineHeight={1}>{bufferLabel}</Text>
      </HStack>
      {status !== "done" && projectedYmd && (
        <Text color={pal.sub} fontSize="10px" lineHeight={1} textAlign="right">
          {t("vlAssembly.list.efBuffer.projected", { date: formatIsoDateDisplay(projectedYmd, i18n.language) })}
          {pace === "target" && " *"}
        </Text>
      )}
    </Box>
  );
}

function EfBufferLegend() {
  const { t } = useTranslation();
  const entries: { icon: string; color: string; label: string; desc: string }[] = [
    { icon: "✓",  color: "green.600",  label: t("vlAssembly.list.efBuffer.legend.done.label"),    desc: t("vlAssembly.list.efBuffer.legend.done.desc") },
    { icon: "●",  color: "green.600",  label: t("vlAssembly.list.efBuffer.legend.safe.label"),    desc: t("vlAssembly.list.efBuffer.legend.safe.desc") },
    { icon: "⚠",  color: "orange.600", label: t("vlAssembly.list.efBuffer.legend.tight.label"),   desc: t("vlAssembly.list.efBuffer.legend.tight.desc") },
    { icon: "⚠⚠", color: "red.600",    label: t("vlAssembly.list.efBuffer.legend.danger.label"),  desc: t("vlAssembly.list.efBuffer.legend.danger.desc") },
    { icon: "—",  color: "gray.400",   label: t("vlAssembly.list.efBuffer.legend.noData.label"),  desc: t("vlAssembly.list.efBuffer.legend.noData.desc") },
  ];
  return (
    <Popover placement="bottom-start" isLazy>
      <PopoverTrigger>
        <Box as="button" display="inline-flex" alignItems="center" color="blue.400" _hover={{ color: "blue.600" }} cursor="pointer" ml={1} onClick={(e: React.MouseEvent) => e.stopPropagation()}>
          <Icon as={FaInfoCircle} boxSize="11px" />
        </Box>
      </PopoverTrigger>
      <PopoverContent minW="320px" maxW="440px" w="max-content" wordBreak="break-word" fontSize="xs" shadow="xl" zIndex={9999}>
        <PopoverHeader fontWeight="semibold" fontSize="sm" pb={1}>{t("vlAssembly.list.efBuffer.legend.title")}</PopoverHeader>
        <PopoverCloseButton />
        <PopoverBody pt={1} pb={3}>
          <Text fontSize="10px" color="gray.500" mb={2} whiteSpace="pre-wrap">{t("vlAssembly.list.efBuffer.legend.formula")}</Text>
          <Text fontSize="10px" color="blue.500" mb={2} whiteSpace="pre-wrap">{t("vlAssembly.list.efBuffer.legend.paceNote")}</Text>
          <VStack align="stretch" spacing={1}>
            {entries.map((e) => (
              <HStack key={e.label} spacing={2} align="flex-start">
                <Text as="span" minW="20px" flexShrink={0} textAlign="center" color={e.color} fontWeight="bold" fontSize="11px" lineHeight={1.4}>{e.icon}</Text>
                <Box><Text fontWeight="semibold" color={e.color} lineHeight={1.3}>{e.label}</Text><Text color="gray.500" lineHeight={1.3}>{e.desc}</Text></Box>
              </HStack>
            ))}
          </VStack>
        </PopoverBody>
      </PopoverContent>
    </Popover>
  );
}

// ── SPI (Schedule Performance Index) ──────────────────────────────────────

type SpiStatus = "no_data" | "not_started" | "ahead" | "on_track" | "slightly_behind" | "behind";
interface SpiResult {
  status: SpiStatus;
  spi: number | null;
  expectedOutput: number;
  actualOutput: number;
}

function calcSpi(
  totalQty: number,
  outputQty: number,
  startIso: string | null | undefined,
  finishIso: string | null | undefined,
  todayYmd: string,
  holidays: ReadonlySet<string>
): SpiResult {
  const NO_DATA: SpiResult = { status: "no_data", spi: null, expectedOutput: 0, actualOutput: outputQty };
  if (!startIso || !finishIso || totalQty <= 0) return NO_DATA;
  const startDate = parseLocalMidnightFromIso(startIso);
  const finishDate = parseLocalMidnightFromIso(finishIso);
  const todayDate = parseYmdLocal(todayYmd);
  if (!startDate || !finishDate) return NO_DATA;
  if (todayDate.getTime() < startDate.getTime())
    return { status: "not_started", spi: null, expectedOutput: 0, actualOutput: outputQty };

  const totalWd = countPlanWorkDays(startDate, finishDate, holidays);
  if (totalWd <= 0) return NO_DATA;

  const cappedToday = todayDate.getTime() > finishDate.getTime() ? finishDate : todayDate;
  const elapsedWd = countPlanWorkDays(startDate, cappedToday, holidays);
  const expectedOutput = Math.round((totalQty * elapsedWd) / totalWd);
  if (expectedOutput <= 0) return { status: "on_track", spi: null, expectedOutput: 0, actualOutput: outputQty };

  const spi = outputQty / expectedOutput;
  let status: SpiStatus;
  if      (spi >= 1.05) status = "ahead";
  else if (spi >= 0.95) status = "on_track";
  else if (spi >= 0.80) status = "slightly_behind";
  else                  status = "behind";

  return { status, spi, expectedOutput, actualOutput: outputQty };
}

const SPI_PALETTE: Record<SpiStatus, { dot: string; text: string; sub: string; bg: string }> = {
  no_data:         { dot: "gray.300",  text: "gray.400",  sub: "gray.300",   bg: "transparent" },
  not_started:     { dot: "gray.400",  text: "gray.500",  sub: "gray.400",   bg: "gray.50"     },
  ahead:           { dot: "blue.400",  text: "blue.700",  sub: "gray.500",   bg: "blue.50"     },
  on_track:        { dot: "green.400", text: "green.700", sub: "gray.500",   bg: "green.50"    },
  slightly_behind: { dot: "orange.400",text: "orange.600",sub: "orange.400", bg: "orange.50"   },
  behind:          { dot: "red.500",   text: "red.600",   sub: "red.400",    bg: "red.50"      },
};

function SpiCell({ result, size = "sm" }: { result: SpiResult; size?: "sm" | "xs" }) {
  const { t } = useTranslation();
  const { status, spi, expectedOutput, actualOutput } = result;
  const pal = SPI_PALETTE[status];
  const fs = size === "xs" ? "10px" : "xs";
  const icons: Record<SpiStatus, string> = {
    no_data: "—", not_started: "○", ahead: "▲", on_track: "●", slightly_behind: "⚠", behind: "⚠⚠",
  };

  if (status === "no_data") return <Text color="gray.300">—</Text>;
  if (status === "not_started") return <Text color={pal.text} fontSize={fs}>{t("vlAssembly.list.spi.notStarted")}</Text>;

  const spiStr = spi != null ? spi.toFixed(2) : "—";
  const deltaPct = spi != null ? Math.round((spi - 1) * 100) : null;

  return (
    <Box display="inline-flex" flexDir="column" alignItems="flex-end" gap="1px" borderRadius="md" px={1} py="1px" bg={pal.bg}>
      <HStack spacing="3px" justify="flex-end">
        <Text as="span" color={pal.dot} fontWeight="bold" fontSize={fs} lineHeight={1}>{icons[status]}</Text>
        <Text color={pal.text} fontWeight="bold" fontSize={fs} lineHeight={1}>
          {t("vlAssembly.list.spi.value", { value: spiStr })}
        </Text>
      </HStack>
      {deltaPct != null && (
        <Text color={pal.sub} fontSize="10px" lineHeight={1} textAlign="right">
          {deltaPct >= 0
            ? t("vlAssembly.list.spi.aheadPct",  { n: deltaPct })
            : t("vlAssembly.list.spi.behindPct", { n: Math.abs(deltaPct) })}
        </Text>
      )}
      {expectedOutput > 0 && (
        <Text color="gray.400" fontSize="10px" lineHeight={1} textAlign="right">
          {t("vlAssembly.list.spi.vsExpected", { actual: actualOutput.toLocaleString(), expected: expectedOutput.toLocaleString() })}
        </Text>
      )}
    </Box>
  );
}

function SpiLegend() {
  const { t } = useTranslation();
  const entries: { icon: string; color: string; label: string; desc: string }[] = [
    { icon: "▲",  color: "blue.600",   label: t("vlAssembly.list.spi.legend.ahead.label"),          desc: t("vlAssembly.list.spi.legend.ahead.desc") },
    { icon: "●",  color: "green.600",  label: t("vlAssembly.list.spi.legend.onTrack.label"),        desc: t("vlAssembly.list.spi.legend.onTrack.desc") },
    { icon: "⚠",  color: "orange.600", label: t("vlAssembly.list.spi.legend.slightlyBehind.label"), desc: t("vlAssembly.list.spi.legend.slightlyBehind.desc") },
    { icon: "⚠⚠", color: "red.600",    label: t("vlAssembly.list.spi.legend.behind.label"),         desc: t("vlAssembly.list.spi.legend.behind.desc") },
    { icon: "○",  color: "gray.500",   label: t("vlAssembly.list.spi.legend.notStarted.label"),     desc: t("vlAssembly.list.spi.legend.notStarted.desc") },
    { icon: "—",  color: "gray.400",   label: t("vlAssembly.list.spi.legend.noData.label"),         desc: t("vlAssembly.list.spi.legend.noData.desc") },
  ];
  return (
    <Popover placement="bottom-start" isLazy>
      <PopoverTrigger>
        <Box as="button" display="inline-flex" alignItems="center" color="blue.400" _hover={{ color: "blue.600" }} cursor="pointer" ml={1} onClick={(e: React.MouseEvent) => e.stopPropagation()}>
          <Icon as={FaInfoCircle} boxSize="11px" />
        </Box>
      </PopoverTrigger>
      <PopoverContent minW="320px" maxW="440px" w="max-content" wordBreak="break-word" fontSize="xs" shadow="xl" zIndex={9999}>
        <PopoverHeader fontWeight="semibold" fontSize="sm" pb={1}>{t("vlAssembly.list.spi.legend.title")}</PopoverHeader>
        <PopoverCloseButton />
        <PopoverBody pt={1} pb={3}>
          <Text fontSize="10px" color="gray.500" mb={2} whiteSpace="pre-wrap">{t("vlAssembly.list.spi.legend.formula")}</Text>
          <VStack align="stretch" spacing={1}>
            {entries.map((e) => (
              <HStack key={e.label} spacing={2} align="flex-start">
                <Text as="span" minW="20px" flexShrink={0} textAlign="center" color={e.color} fontWeight="bold" fontSize="11px" lineHeight={1.4}>{e.icon}</Text>
                <Box><Text fontWeight="semibold" color={e.color} lineHeight={1.3}>{e.label}</Text><Text color="gray.500" lineHeight={1.3}>{e.desc}</Text></Box>
              </HStack>
            ))}
          </VStack>
          <Text fontSize="10px" color="gray.500" mt={2} whiteSpace="pre-wrap">{t("vlAssembly.list.spi.legend.moduleNote")}</Text>
        </PopoverBody>
      </PopoverContent>
    </Popover>
  );
}

// 토글 가능 컬럼 정의 (ALL_COLUMNS 길이와 동일)
const ALL_COLUMNS = [
  // ── 출고 / 일정 정보 ────────────────────────────────────────────────────
  { key: "production_line",            label: "Production Line" },
  { key: "ex_factory_1st",             label: "Ex Factory (1st)" },         // rename: ex_factory
  { key: "ex_factory_2nd",             label: "Ex Factory (2nd)" },         // NEW
  { key: "ex_country",                 label: "Ex Country" },               // NEW
  { key: "air_or_vessel",              label: "By Air or Vessel" },         // NEW
  { key: "ef_buffer",                  label: "EF Buffer" },
  { key: "schedule_spi",               label: "SPI" },
  { key: "po_date",                    label: "PO Date" },                  // NEW
  { key: "material_due_inbound",       label: "Material Due Inbound" },     // rename: due_inbound
  { key: "expected_inbound",           label: "Expected Inbound" },
  { key: "actual_inbound_qty",         label: "Actual Inbound Qty" },
  { key: "cutting_start_date",         label: "Cutting Start Date" },       // NEW
  { key: "vien_laser",                 label: "Trim + Laser" },             // NEW
  { key: "printing_folding",           label: "Printing/Folding" },         // NEW
  { key: "sub_tg",                     label: "SUB TG" },                   // NEW
  { key: "sub_vl",                     label: "SUB VL" },                   // NEW
  { key: "pre",                        label: "Pre" },                      // NEW
  { key: "scom",                       label: "SCOM" },                     // NEW
  { key: "expected_date_finished",     label: "Expected Date / Finished" }, // NEW
  { key: "ex_fty_from_today",          label: "Days to Ex Fty" },           // calculated NEW
  { key: "progress",                   label: "Progress" },
  { key: "assembly_start",             label: "Assembly Start" },
  { key: "assembly_finish",            label: "Assembly Finish" },
  { key: "daily_required_qty",         label: "Daily Req." },
  { key: "lead_time",                  label: "Lead Time (d)" },
  { key: "sj_po_number",               label: "SJ PO#" },
  // ── 스타일 / 아이템 정보 ─────────────────────────────────────────────────
  { key: "flow_memo",                  label: "Flow Memo" },
  { key: "category",                   label: "Cat." },
  { key: "sub_category",               label: "Sub Cat." },
  { key: "media",                      label: "Media" },
  { key: "work_order",                 label: "Work Order" },
  { key: "sj_no",                      label: "SJ No" },
  { key: "code",                       label: "Code" },
  { key: "style_name",                 label: "Style Name" },               // rename: name
  { key: "color",                      label: "Color" },
  { key: "newness_or_repeat",          label: "New or Repeat" },            // NEW
  { key: "keep",                       label: "KEEP" },                     // NEW
  // ── 수량 / 진행 ─────────────────────────────────────────────────────────
  { key: "total_qty",                  label: "Total Qty" },
  { key: "assembly_output_qty",        label: "Assembly Out Qty" },
  { key: "defect_qty",                 label: "Defect Qty" },
  { key: "balance_qty",                label: "Balance Q'ty" },
  { key: "status",                     label: "Status" },
  { key: "balance_expected_finish_date", label: "Balance Exp. Finish" },    // NEW
  { key: "issue_or_not",               label: "Issue or not" },             // NEW
  { key: "final",                      label: "Final" },                    // NEW
  // ── 생산성 지표 ──────────────────────────────────────────────────────────
  { key: "cycle_time",                 label: "Cycle Time (s)" },
  { key: "target_per_hour",            label: "Target/hr" },
  { key: "daily_target",               label: "Daily Target (8h)" },
  { key: "daily_target_80",            label: "Target Q'ty 80%" },          // calculated NEW
  // ── CMT / FOB ────────────────────────────────────────────────────────────
  { key: "gong_in",                    label: "CMT" },                      // NEW
  { key: "total_cmt",                  label: "Total CMT" },                // NEW
  { key: "actual_cmt",                 label: "Actual CMT" },               // NEW
  { key: "unit_fob",                   label: "FOB" },                      // NEW
  { key: "total_fob",                  label: "Total FOB" },                // NEW
  { key: "actual_fob",                 label: "Actual FOB" },               // NEW
  // ── 오늘 실적 / 공정 ────────────────────────────────────────────────────
  { key: "today_output_qty",           label: "Today Output Qty" },
  { key: "process_start",              label: "Process Start" },
  { key: "process_finish",             label: "Process Finish" },
  { key: "output_qty",                 label: "Output Qty" },
  { key: "remark",                     label: "Remark" },
] as const;

type ColKey = (typeof ALL_COLUMNS)[number]["key"];

/** 헤더/행 컬럼 순서 — sticky left 누적과 동일 */
const COLUMN_STICKY_ORDER: ColKey[] = ALL_COLUMNS.map((c) => c.key);

// 접기 대상 컬럼 그룹 — 컴포넌트 외부 상수 (SJ PO#는 항상 표시)
const INFO_GROUP: ColKey[] = ["production_line", "sj_no", "color", "total_qty", "assembly_output_qty", "ex_factory_1st", "assembly_start", "assembly_finish"];

const COLUMN_WIDTHS: Partial<Record<ColKey, number>> = {
  production_line: 130,
  sj_po_number: 110,
  ex_factory_1st: 100,
  ex_factory_2nd: 100,
  ex_country: 100,
  air_or_vessel: 100,
  ef_buffer: 130,
  schedule_spi: 110,
  po_date: 100,
  material_due_inbound: 130,
  expected_inbound: 130,
  actual_inbound_qty: 100,
  cutting_start_date: 110,
  vien_laser: 100,
  printing_folding: 110,
  sub_tg: 80,
  sub_vl: 80,
  pre: 70,
  scom: 80,
  expected_date_finished: 130,
  ex_fty_from_today: 90,
  progress: 110,
  assembly_start: 110,
  assembly_finish: 115,
  daily_required_qty: 130,
  lead_time: 90,
  flow_memo: 120,
  category: 80,
  sub_category: 220,
  media: 52,
  work_order: 42,
  sj_no: 85,
  code: 110,
  style_name: 140,
  color: 70,
  newness_or_repeat: 100,
  keep: 80,
  total_qty: 85,
  assembly_output_qty: 110,
  defect_qty: 88,
  balance_qty: 85,
  /** Status: 핀 고정 시 sticky 너비와 동일하게 맞춤 (아래 statusColumnWidthProps) */
  status: 160,
  balance_expected_finish_date: 130,
  issue_or_not: 120,
  final: 80,
  cycle_time: 90,
  target_per_hour: 90,
  daily_target: 110,
  daily_target_80: 100,
  gong_in: 80,
  total_cmt: 90,
  actual_cmt: 90,
  unit_fob: 80,
  total_fob: 90,
  actual_fob: 90,
  today_output_qty: 170,
  process_start: 110,
  process_finish: 110,
  output_qty: 85,
  remark: 160,
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

type AssemblyCalendarDayFlag = {
  inPeriod: boolean;
  isRangeStart: boolean;
  isRangeEnd: boolean;
};

function parseLocalMidnightFromIso(iso: string | null | undefined): Date | null {
  if (iso == null || iso === "") return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  d.setHours(0, 0, 0, 0);
  return d;
}

/** 기본: 공휴일 없음(호출부에서 생략 가능). */
const EMPTY_PLAN_HOLIDAY_YMD_SET: ReadonlySet<string> = new Set();

/**
 * Inclusive. 일요일(0) + 등록 공휴일(YYYY-MM-DD) 제외 = 8h/1 day 근무일 (토요일 포함).
 */
function countPlanWorkDays(
  a: Date,
  b: Date,
  excludedHolidayYmds: ReadonlySet<string>
): number {
  const lo = a.getTime() <= b.getTime() ? new Date(a) : new Date(b);
  const hi = a.getTime() <= b.getTime() ? new Date(b) : new Date(a);
  lo.setHours(0, 0, 0, 0);
  hi.setHours(0, 0, 0, 0);
  if (lo.getTime() > hi.getTime()) return 0;
  let n = 0;
  const cur = new Date(lo);
  while (cur.getTime() <= hi.getTime()) {
    const ymd = ymdFromLocalDate(cur);
    if (cur.getDay() !== 0 && !excludedHolidayYmds.has(ymd)) n += 1;
    cur.setDate(cur.getDate() + 1);
  }
  return n;
}

/**
 * 합계 수량 / (기간·일·제 제외 근무일) — 8h/일 1 day 단위.
 * 시작·종료 **둘 다** 있을 때만 계산.
 */
function getDailyPlannedQtyFromRange(
  startIso: string | null | undefined,
  endIso: string | null | undefined,
  totalQty: number,
  excludedHolidayYmds: ReadonlySet<string> = EMPTY_PLAN_HOLIDAY_YMD_SET
): { daily: number; workDays: number } | null {
  if (totalQty <= 0) return null;
  const sDate = parseLocalMidnightFromIso(startIso);
  const eDate = parseLocalMidnightFromIso(endIso);
  if (!sDate || !eDate) return null;
  const lo = sDate.getTime() <= eDate.getTime() ? sDate : eDate;
  const hi = sDate.getTime() <= eDate.getTime() ? eDate : sDate;
  const w = countPlanWorkDays(lo, hi, excludedHolidayYmds);
  if (w < 1) return null;
  return { daily: Math.max(0, Math.round(totalQty / w)), workDays: w };
}

function getAssemblyDailyPlannedQtyFromTotal(
  s: IVlAssemblySchedule,
  totalQty: number,
  excludedHolidayYmds: ReadonlySet<string> = EMPTY_PLAN_HOLIDAY_YMD_SET
): { daily: number; workDays: number } | null {
  return getDailyPlannedQtyFromRange(
    s.production_assembly_start_date,
    s.production_assembly_finish_date,
    totalQty,
    excludedHolidayYmds
  );
}

/**
 * 임의의 시작/종료 ISO(조립·모듈·공정 공정기간)를 겹치는 캘린더 일에 맵핑.
 * 시작만/종료만/둘 다: 기존 schedule 와 동일 규칙(월 기준 클리핑).
 */
function buildDateRangeCalendarDayFlags(
  startIso: string | null | undefined,
  endIso: string | null | undefined,
  y: number,
  m1: number,
  days: number
): AssemblyCalendarDayFlag[] {
  const sDate = parseLocalMidnightFromIso(startIso);
  const eDate = parseLocalMidnightFromIso(endIso);
  if (!sDate && !eDate) {
    return Array.from({ length: days }, () => ({
      inPeriod: false,
      isRangeStart: false,
      isRangeEnd: false,
    }));
  }
  const monthStart = new Date(y, m1 - 1, 1);
  monthStart.setHours(0, 0, 0, 0);
  const monthEnd = new Date(y, m1 - 1, days);
  monthEnd.setHours(0, 0, 0, 0);
  let lo: Date;
  let hi: Date;
  if (sDate && eDate) {
    const a = sDate.getTime();
    const b = eDate.getTime();
    if (a <= b) {
      lo = sDate;
      hi = eDate;
    } else {
      lo = eDate;
      hi = sDate;
    }
  } else if (sDate) {
    lo = sDate;
    hi = monthEnd;
  } else {
    lo = monthStart;
    hi = eDate!;
  }
  if (lo.getTime() < monthStart.getTime()) lo = new Date(monthStart);
  if (hi.getTime() > monthEnd.getTime()) hi = new Date(monthEnd);
  if (lo.getTime() > hi.getTime()) {
    return Array.from({ length: days }, () => ({
      inPeriod: false,
      isRangeStart: false,
      isRangeEnd: false,
    }));
  }
  return Array.from({ length: days }, (_, i) => {
    const day = i + 1;
    const cur = new Date(y, m1 - 1, day);
    cur.setHours(0, 0, 0, 0);
    const t = cur.getTime();
    const inPeriod = t >= lo.getTime() && t <= hi.getTime();
    return {
      inPeriod,
      isRangeStart: !!(sDate && inPeriod && t === sDate.getTime()),
      isRangeEnd: !!(eDate && inPeriod && t === eDate.getTime()),
    };
  });
}

function buildAssemblyCalendarDayFlags(
  s: IVlAssemblySchedule,
  y: number,
  m1: number,
  days: number
): AssemblyCalendarDayFlag[] {
  return buildDateRangeCalendarDayFlags(
    s.production_assembly_start_date,
    s.production_assembly_finish_date,
    y,
    m1,
    days
  );
}

function ymdFromCalendar(y: number, m1: number, day: number): string {
  return `${y}-${String(m1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** 이전 / 선택 / 다음 달(캘린더 가로 스크롤용) */
type CalendarMonthBlock = { year: number; month: number; days: number };

function getAdjacentMonthBlocks(y: number, m1: number): CalendarMonthBlock[] {
  const out: CalendarMonthBlock[] = [];
  for (let delta = -1; delta <= 1; delta++) {
    const dt = new Date(y, m1 - 1 + delta, 1);
    const yy = dt.getFullYear();
    const mm = dt.getMonth() + 1;
    const days = new Date(yy, mm, 0).getDate();
    out.push({ year: yy, month: mm, days });
  }
  return out;
}

function ymdFromLocalDate(d: Date): string {
  return ymdFromCalendar(d.getFullYear(), d.getMonth() + 1, d.getDate());
}

/** 계획 공휴일 기간 등록: 포함 양 끝, 시작·종료 순서 무관하면 자동 정렬 */
function enumerateInclusivePlanHolidayYmds(fromYmd: string, toYmd: string): string[] {
  const a = parseLocalMidnightFromIso(fromYmd);
  const b = parseLocalMidnightFromIso(toYmd);
  if (!a || !b) return [];
  const lo = a.getTime() <= b.getTime() ? a : b;
  const hi = a.getTime() <= b.getTime() ? b : a;
  const out: string[] = [];
  const cur = new Date(lo);
  while (cur.getTime() <= hi.getTime()) {
    out.push(ymdFromLocalDate(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

const PLAN_HOLIDAY_MAX_RANGE_DAYS = 731;

function monthBlockToDateRangeIso(b: CalendarMonthBlock): {
  dateFrom: string;
  dateTo: string;
} {
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    dateFrom: `${b.year}-${pad(b.month)}-01`,
    dateTo: `${b.year}-${pad(b.month)}-${pad(b.days)}`,
  };
}

/** 캘린더 이전·선택·다음 달 통째로 겹침 판정용 (YYYY-MM-DD 비교) */
function calendarAdjacentWindowIsoRange(
  blocks: CalendarMonthBlock[]
): { dateFrom: string; dateTo: string } | null {
  if (blocks.length === 0) return null;
  const first = blocks[0]!;
  const last = blocks[blocks.length - 1]!;
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    dateFrom: `${first.year}-${pad(first.month)}-01`,
    dateTo: `${last.year}-${pad(last.month)}-${pad(last.days)}`,
  };
}

/** 조립 기간이 [from, to] 기간과 맞닿거나 겹치면 true (없는 날짜는 목록에 포함) */
function vlScheduleAssemblyOverlapsWindow(
  s: IVlAssemblySchedule,
  windowFromYmd: string,
  windowToYmd: string
): boolean {
  const start = (s.production_assembly_start_date ?? "").slice(0, 10);
  const end = (s.production_assembly_finish_date ?? "").slice(0, 10);
  if (!start || !end) return true;
  return start <= windowToYmd && end >= windowFromYmd;
}

async function fetchScheduleDailyOutputsForRange(
  dateFrom: string,
  dateTo: string
): Promise<IVlAssemblyScheduleProductionDailyOutput[]> {
  const pageSize = 200;
  let page = 1;
  const all: IVlAssemblyScheduleProductionDailyOutput[] = [];
  for (;;) {
    const res = await getVlAssemblyScheduleProductionDailyOutputs({
      date_from: dateFrom,
      date_to: dateTo,
      page,
      page_size: pageSize,
    });
    all.push(...res.results);
    if (res.results.length < pageSize) break;
    page += 1;
  }
  return all;
}

async function fetchModuleDailyOutputsForRange(
  dateFrom: string,
  dateTo: string
): Promise<IVlAssemblyModuleProductionDailyOutput[]> {
  const pageSize = 200;
  let page = 1;
  const all: IVlAssemblyModuleProductionDailyOutput[] = [];
  for (;;) {
    const res = await getVlAssemblyModuleProductionDailyOutputs({
      date_from: dateFrom,
      date_to: dateTo,
      page,
      page_size: pageSize,
    });
    all.push(...res.results);
    if (res.results.length < pageSize) break;
    page += 1;
  }
  return all;
}

async function fetchProcessDailyOutputsForRange(
  dateFrom: string,
  dateTo: string
): Promise<IVlAssemblyProductionDailyOutput[]> {
  const pageSize = 200;
  let page = 1;
  const all: IVlAssemblyProductionDailyOutput[] = [];
  for (;;) {
    const res = await getVlAssemblyProductionDailyOutputs({
      date_from: dateFrom,
      date_to: dateTo,
      page,
      page_size: pageSize,
    });
    all.push(...res.results);
    if (res.results.length < pageSize) break;
    page += 1;
  }
  return all;
}

function parseYmdLocal(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function addCalendarDaysYmd(ymd: string, days: number): string {
  const t = parseYmdLocal(ymd);
  t.setDate(t.getDate() + days);
  return ymdFromCalendar(t.getFullYear(), t.getMonth() + 1, t.getDate());
}

function dayDiffYmd(a: string, b: string): number {
  return Math.round(
    (parseYmdLocal(b).getTime() - parseYmdLocal(a).getTime()) / 864e5
  );
}

type VlCalRowKind = "schedule" | "module" | "process";

function getCalendarDayUnderPointer(
  clientX: number,
  clientY: number,
  kind: VlCalRowKind,
  entityPk: number
): { year: number; month: number; day: number } | null {
  const els = document.elementsFromPoint(clientX, clientY);
  for (const el of els) {
    const td = el.closest("td[data-vl-cal-day]");
    if (!td) continue;
    if (td.getAttribute("data-vl-cal-scope") !== kind) continue;
    const pk = Number(td.getAttribute("data-vl-cal-entity"));
    if (pk !== entityPk) continue;
    const year = Number(td.getAttribute("data-vl-cal-year"));
    const month = Number(td.getAttribute("data-vl-cal-month"));
    const d = Number(td.getAttribute("data-vl-cal-day"));
    if (
      Number.isFinite(year) &&
      Number.isFinite(month) &&
      Number.isFinite(d)
    ) {
      return { year, month, day: d };
    }
  }
  return null;
}

type VlCalDragContext =
  | { kind: "schedule"; schedule: IVlAssemblySchedule }
  | { kind: "module"; mod: IEpModuleCopy }
  | { kind: "process"; p: IEpProcessCopy };

type VlCalDragRef = {
  mode: "rs" | "re" | "mv";
  kind: VlCalRowKind;
  entityPk: number;
  start0: string;
  end0: string;
  anchorYmd: string;
  moved: boolean;
  pointerId: number;
  lastStart: string;
  lastEnd: string;
};

// ── 컴포넌트 ──────────────────────────────────────────────────────
export default function VlAssemblyScheduleList() {
  const { t, i18n } = useTranslation();
  const [searchParams] = useSearchParams();
  const highlightPk = searchParams.get("highlight") ? Number(searchParams.get("highlight")) : null;
  const isReadOnly = searchParams.get("readOnly") === "1";
  const fmtDate = (d?: string | null) => formatIsoDateDisplay(d, i18n.language);

  const statusOptions = [
    { value: "not_started", label: t("vlAssembly.status.not_started") },
    { value: "outsourced",  label: t("vlAssembly.status.outsourced") },
    { value: "in_progress", label: t("vlAssembly.status.in_progress") },
    { value: "completed",   label: t("vlAssembly.status.completed") },
    { value: "not_ready",   label: t("vlAssembly.status.not_ready") },
  ];

  const todayYmdLabel = ymdFromLocalDate(new Date());
  const colLabels: Record<ColKey, string> = {
    production_line:            t("vlAssembly.list.col.productionLine"),
    ex_factory_1st:             t("vlAssembly.list.col.exFactory1st"),
    ex_factory_2nd:             t("vlAssembly.list.col.exFactory2nd"),
    ex_country:                 t("vlAssembly.list.col.exCountry"),
    air_or_vessel:              t("vlAssembly.list.col.airOrVessel"),
    ef_buffer:                  t("vlAssembly.list.col.efBuffer"),
    schedule_spi:               t("vlAssembly.list.col.scheduleSpi"),
    po_date:                    t("vlAssembly.list.col.poDate"),
    material_due_inbound:       t("vlAssembly.list.col.materialDueInbound"),
    expected_inbound:           t("vlAssembly.list.col.expectedInbound"),
    actual_inbound_qty:         t("vlAssembly.list.col.actualInboundQty"),
    cutting_start_date:         t("vlAssembly.list.col.cuttingStartDate"),
    vien_laser:                 t("vlAssembly.list.col.vienLaser"),
    printing_folding:           t("vlAssembly.list.col.printingFolding"),
    sub_tg:                     t("vlAssembly.list.col.subTg"),
    sub_vl:                     t("vlAssembly.list.col.subVl"),
    pre:                        t("vlAssembly.list.col.pre"),
    scom:                       t("vlAssembly.list.col.scom"),
    expected_date_finished:     t("vlAssembly.list.col.expectedDateFinished"),
    ex_fty_from_today:          t("vlAssembly.list.col.exFtyFromToday"),
    progress:                   t("vlAssembly.list.col.progress"),
    assembly_start:             t("vlAssembly.list.col.assemblyStart"),
    assembly_finish:            t("vlAssembly.list.col.assemblyFinish"),
    daily_required_qty:         t("vlAssembly.list.col.dailyRequiredQty"),
    lead_time:                  t("vlAssembly.list.col.leadTime"),
    sj_po_number:               t("vlAssembly.list.col.sjPo"),
    flow_memo:                  t("vlAssembly.list.col.flowMemo"),
    category:                   t("vlAssembly.list.col.category"),
    sub_category:               t("vlAssembly.list.col.subCategory"),
    media:                      t("vlAssembly.list.col.media"),
    work_order:                 t("vlAssembly.list.col.workOrder"),
    sj_no:                      t("vlAssembly.list.col.sjNo"),
    code:                       t("vlAssembly.list.col.code"),
    style_name:                 t("vlAssembly.list.col.styleName"),
    color:                      t("vlAssembly.list.col.color"),
    newness_or_repeat:          t("vlAssembly.list.col.newnessOrRepeat"),
    keep:                       t("vlAssembly.list.col.keep"),
    total_qty:                  t("vlAssembly.list.col.totalQty"),
    assembly_output_qty:        t("vlAssembly.list.col.assemblyOutQty"),
    defect_qty:                 t("vlAssembly.list.col.defectQty"),
    balance_qty:                t("vlAssembly.list.col.balanceQty"),
    status:                     t("vlAssembly.list.col.status"),
    balance_expected_finish_date: t("vlAssembly.list.col.balanceExpectedFinishDate"),
    issue_or_not:               t("vlAssembly.list.col.issueOrNot"),
    final:                      t("vlAssembly.list.col.final"),
    cycle_time:                 t("vlAssembly.list.col.cycleTime"),
    target_per_hour:            t("vlAssembly.list.col.targetPerHour"),
    daily_target:               t("vlAssembly.list.col.dailyTarget"),
    daily_target_80:            t("vlAssembly.list.col.dailyTarget80"),
    gong_in:                    t("vlAssembly.list.col.gongIn"),
    total_cmt:                  t("vlAssembly.list.col.totalCmt"),
    actual_cmt:                 t("vlAssembly.list.col.actualCmt"),
    unit_fob:                   t("vlAssembly.list.col.unitFob"),
    total_fob:                  t("vlAssembly.list.col.totalFob"),
    actual_fob:                 t("vlAssembly.list.col.actualFob"),
    today_output_qty:           t("vlAssembly.list.col.todayOutputQty", { date: todayYmdLabel }),
    process_start:              t("vlAssembly.list.col.processStart"),
    process_finish:             t("vlAssembly.list.col.processFinish"),
    output_qty:                 t("vlAssembly.list.col.outputQty"),
    remark:                     t("vlAssembly.list.col.remark"),
  };

  const tableBgColor = useColorModeValue("gray.100", "gray.700");
  const pageBg = useColorModeValue("gray.50", "gray.900");
  const scheduleRowBg = useColorModeValue("white", "gray.800");
  const scheduleRowHoverBg = useColorModeValue("blue.50", "blue.900");
  const scheduleRowSelectedBg = useColorModeValue("yellow.50", "yellow.900");
  const sjSubRowBg = useColorModeValue("gray.50", "gray.750");
  const sjSubRowHoverBg = useColorModeValue("gray.100", "gray.700");
  const moduleRowBg = useColorModeValue("blue.50", "blue.900");
  const moduleRowHoverBg = useColorModeValue("blue.100", "blue.800");
  const processRowBg = useColorModeValue("gray.50", "gray.700");
  const lineGroupHeaderBg = useColorModeValue("blue.50", "gray.800");
  /** 일별 스케줄 열: 일요일 / 토요일 배경 */
  const sunDayColBg = useColorModeValue("red.50", "red.950");
  const satDayColBg = useColorModeValue("blue.50", "blue.950");
  /** 등록 계획 공휴일 — 일/토와 구분되는 톤 */
  const planHolidayColBg = useColorModeValue("orange.50", "orange.950");
  const planHolidayHeaderColor = useColorModeValue("orange.900", "orange.200");
  const planHolidayModalTheadBg = useColorModeValue("gray.50", "gray.800");
  const sunDayHeaderColor = useColorModeValue("red.700", "red.200");
  const satDayHeaderColor = useColorModeValue("blue.700", "blue.200");
  const weekdayThNormalColor = useColorModeValue("gray.600", "gray.300");
  const mirrorScrollBorderColor = useColorModeValue("gray.200", "gray.600");
  const scrollbarTrackBg = useColorModeValue("blue.50", "gray.800");
  /** 캘린더: 조립(스케줄) / 모듈 / 공정 기간 오버레이 — 행 유형별 색 구분 */
  // in_progress: sky blue
  const scheduleCalPeriodOverlay = useColorModeValue(
    "rgba(56, 189, 248, 0.28)",
    "rgba(56, 189, 248, 0.33)"
  );
  const scheduleCalEdge = useColorModeValue("blue.400", "blue.200");
  // not_started: light gray
  const scheduleCalPeriodOverlayNotStarted = useColorModeValue(
    "rgba(200, 200, 200, 0.20)",
    "rgba(160, 160, 160, 0.18)"
  );
  const scheduleCalEdgeNotStarted = useColorModeValue("gray.300", "gray.500");
  // completed: green
  const scheduleCalPeriodOverlayCompleted = useColorModeValue(
    "rgba(34, 197, 94, 0.28)",
    "rgba(74, 222, 128, 0.32)"
  );
  const scheduleCalEdgeCompleted = useColorModeValue("green.500", "green.400");
  const scheduleCalPlanText = useColorModeValue("gray.400", "gray.500");
  /** 캘린더 EX-FACTORY 트럭 워터마크 (조립/teal 과 구분되는 남청 ton) */
  const exFactoryTruckIconColor = useColorModeValue("cyan.600", "cyan.400");

  const moduleCalPeriodOverlay = useColorModeValue(
    "rgba(128, 90, 213, 0.28)",
    "rgba(159, 122, 234, 0.36)"
  );
  const moduleCalEdge = useColorModeValue("purple.500", "purple.300");
  /** 목표(일일 계획) 숫자 — 스케줄과 동일 그레이 */
  const moduleCalPlanText = useColorModeValue("gray.400", "gray.500");

  const processCalPeriodOverlay = useColorModeValue(
    "rgba(237, 137, 54, 0.28)",
    "rgba(251, 176, 64, 0.38)"
  );
  const processCalEdge = useColorModeValue("orange.500", "orange.300");
  const processCalPlanText = useColorModeValue("gray.400", "gray.500");

  /** 캘린더 3개월(이전 / 선택 / 다음) 띠 구분 */
  const calMonthBandPrev = useColorModeValue("gray.50", "gray.800");
  const calMonthBandSelected = useColorModeValue("blue.50", "blue.950");
  const calMonthBandNext = useColorModeValue("gray.100", "gray.750");
  const calMonthBoundaryLine = useColorModeValue("gray.300", "gray.600");
  const calMonthLabelColor = useColorModeValue("gray.800", "gray.100");
  /** 15일 월 약어 배지 — 블록(이전/선택/다음)별 색 */
  const day15BadgePrevBg = useColorModeValue("orange.50", "orange.950");
  const day15BadgePrevBorder = useColorModeValue("orange.400", "orange.300");
  const day15BadgePrevText = useColorModeValue("orange.900", "orange.100");
  const day15BadgeSelectedBg = useColorModeValue("blue.50", "blue.900");
  const day15BadgeSelectedBorder = useColorModeValue("blue.500", "blue.300");
  const day15BadgeSelectedText = useColorModeValue("blue.900", "white");
  const day15BadgeNextBg = useColorModeValue("teal.50", "teal.900");
  const day15BadgeNextBorder = useColorModeValue("teal.500", "teal.300");
  const day15BadgeNextText = useColorModeValue("teal.900", "teal.100");
  /** 월 헤더 바 전용 색상 (일자 셀 배경과 분리) */
  const calMonthBarBgPrev = useColorModeValue("gray.300", "gray.600");
  const calMonthBarBgSelected = useColorModeValue("blue.500", "blue.600");
  const calMonthBarBgNext = useColorModeValue("gray.300", "gray.600");
  const calMonthBarTextPrev = useColorModeValue("gray.700", "gray.100");
  const calMonthBarTextSelected = "white";
  const calMonthBarTextNext = useColorModeValue("gray.700", "gray.100");
  const barLabelColorNotStarted = useColorModeValue("gray.700", "gray.100");
  const barLabelColorInProgress = "white";
  const barLabelColorCompleted  = "white";
  const barContainerBgInProgress = useColorModeValue("rgba(56, 189, 248, 0.82)", "rgba(14, 116, 144, 0.85)");
  const barContainerBgNotStarted = useColorModeValue("rgba(180, 180, 180, 0.82)", "rgba(74, 85, 104, 0.85)");
  const barContainerBgCompleted  = useColorModeValue("rgba(34, 197, 94, 0.82)", "rgba(22, 101, 52, 0.85)");

  const today = new Date();
  const calendarTodayYmd = ymdFromLocalDate(today);
  const [flashPk, setFlashPk] = useState<number | null>(null);
  const highlightScrolledRef = useRef(false);
  const [selectedYear, setSelectedYear] = useState(() => {
    const urlYear = searchParams.get("year");
    return urlYear ? Number(urlYear) : getInitialYearMonth().year;
  });
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const urlMonth = searchParams.get("month");
    return urlMonth ? Number(urlMonth) : getInitialYearMonth().month;
  }); // 1-based

  // 5개월 윈도우: 선택 월이 가운데(3번째)에 오도록 초기화 (localStorage 복원 시에도 해당 월이 보이게)
  const [windowStart, setWindowStart] = useState(() => {
    const urlYear = searchParams.get("year");
    const urlMonth = searchParams.get("month");
    const year = urlYear ? Number(urlYear) : getInitialYearMonth().year;
    const month = urlMonth ? Number(urlMonth) : getInitialYearMonth().month;
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
  const [selectedSjPk, setSelectedSjPk] = useState<number | null>(null);
  const toast = useToast();
  const queryClient = useQueryClient();

  /** 조립·모듈·공정 일일 계획 수량: 일요일 + 서버 등록 공휴일 제외 (선택 연도 주변 넓게 조회) */
  const planHolidayQueryRange = useMemo(
    () => ({
      date_from: `${selectedYear - 5}-01-01`,
      date_to: `${selectedYear + 5}-12-31`,
    }),
    [selectedYear]
  );

  const { data: vlPlanHolidayRows = [] } = useQuery({
    queryKey: [
      "vlPlanHolidays",
      planHolidayQueryRange.date_from,
      planHolidayQueryRange.date_to,
    ],
    queryFn: async () => {
      try {
        return await getVlPlanHolidays(planHolidayQueryRange);
      } catch {
        return [];
      }
    },
    staleTime: 60_000,
  });

  const vlPlanHolidayYmdSet = useMemo(() => {
    const s = new Set<string>();
    for (const h of vlPlanHolidayRows) {
      const d = String(h.date ?? "").slice(0, 10);
      if (/^\d{4}-\d{2}-\d{2}$/.test(d)) s.add(d);
    }
    return s;
  }, [vlPlanHolidayRows]);

  const vlPlanHolidayNameByYmd = useMemo(() => {
    const m = new Map<string, string>();
    for (const h of vlPlanHolidayRows) {
      const y = String(h.date ?? "").slice(0, 10);
      if (/^\d{4}-\d{2}-\d{2}$/.test(y)) {
        m.set(y, (h.name ?? "").trim());
      }
    }
    return m;
  }, [vlPlanHolidayRows]);

  /** 캘린더에서 기간(조립 / 모듈·공정 공정기간) 드래그 프리뷰 (리사이즈 / 이동) */
  const [calendarRangeDraft, setCalendarRangeDraft] = useState<{
    kind: VlCalRowKind;
    entityPk: number;
    start: string;
    end: string;
  } | null>(null);
  const calendarCalDragRef = useRef<VlCalDragRef | null>(null);
  const [savingCalendar, setSavingCalendar] = useState<{
    kind: VlCalRowKind;
    pk: number;
  } | null>(null);

  const commitCalendarRange = useCallback(
    async (kind: VlCalRowKind, pk: number, start: string, end: string) => {
      setSavingCalendar({ kind, pk });
      try {
        if (kind === "schedule") {
          await editVlAssemblySchedule(pk, {
            production_assembly_start_date: start,
            production_assembly_finish_date: end,
          });
        } else if (kind === "module") {
          await patchVlAssemblyModule(pk, {
            process_start_date: start,
            process_finish_date: end,
          });
        } else {
          await patchVlAssemblyProcess(pk, {
            process_start_date: start,
            process_finish_date: end,
          });
        }
        await queryClient.invalidateQueries({ queryKey: vlKeys.all() });
        await queryClient.invalidateQueries({ queryKey: vlKeys.scheduleDailyOutputsCalendar() });
        await queryClient.invalidateQueries({ queryKey: vlKeys.moduleDailyOutputsCalendar() });
        await queryClient.invalidateQueries({ queryKey: vlKeys.processDailyOutputsCalendar() });
        broadcastVlAssemblyScheduleListCacheBust();
        toast({
          title: t("vlAssembly.common.saved"),
          status: "success",
          duration: 2000,
          position: "bottom-right",
        });
      } catch {
        toast({
          title: t("vlAssembly.common.failedSave"),
          status: "error",
          duration: 2500,
          position: "bottom-right",
        });
      } finally {
        setSavingCalendar(null);
        setCalendarRangeDraft(null);
      }
    },
    [queryClient, t, toast]
  );

  const startCalendarRangeDrag = useCallback(
    (
      mode: "rs" | "re" | "mv",
      ctx: VlCalDragContext,
      calY: number,
      calM: number,
      day: number,
      e: ReactPointerEvent
    ) => {
      let s0: string;
      let e0: string;
      let kind: VlCalRowKind;
      let entityPk: number;
      if (ctx.kind === "schedule") {
        kind = "schedule";
        entityPk = ctx.schedule.pk;
        s0 = ctx.schedule.production_assembly_start_date || "";
        e0 = ctx.schedule.production_assembly_finish_date || "";
      } else if (ctx.kind === "module") {
        kind = "module";
        entityPk = ctx.mod.pk;
        s0 = ctx.mod.process_start_date || "";
        e0 = ctx.mod.process_finish_date || "";
      } else {
        kind = "process";
        entityPk = ctx.p.pk;
        s0 = ctx.p.process_start_date || "";
        e0 = ctx.p.process_finish_date || "";
      }
      if (!s0 || !e0) return;
      if (savingCalendar != null) return;
      e.preventDefault();
      e.stopPropagation();
      const captureEl = e.currentTarget as HTMLElement;
      const anchorYmd = ymdFromCalendar(calY, calM, day);
      calendarCalDragRef.current = {
        mode,
        kind,
        entityPk,
        start0: s0,
        end0: e0,
        anchorYmd,
        moved: false,
        pointerId: e.pointerId,
        lastStart: s0,
        lastEnd: e0,
      };
      setCalendarRangeDraft({ kind, entityPk, start: s0, end: e0 });
      captureEl.setPointerCapture(e.pointerId);

      const onMove = (ev: PointerEvent) => {
        const d = calendarCalDragRef.current;
        if (!d) return;
        const hit = getCalendarDayUnderPointer(
          ev.clientX,
          ev.clientY,
          d.kind,
          d.entityPk
        );
        if (hit == null) return;
        const ymd = ymdFromCalendar(hit.year, hit.month, hit.day);
        let newS = d.start0;
        let newE = d.end0;
        if (d.mode === "rs") {
          newS = ymd;
          if (newS > newE) newS = newE;
          d.moved = d.moved || newS !== d.start0;
        } else if (d.mode === "re") {
          newE = ymd;
          if (newE < newS) newE = newS;
          d.moved = d.moved || newE !== d.end0;
        } else {
          const delta = dayDiffYmd(d.anchorYmd, ymd);
          newS = addCalendarDaysYmd(d.start0, delta);
          newE = addCalendarDaysYmd(d.end0, delta);
          d.moved = d.moved || delta !== 0;
        }
        d.lastStart = newS;
        d.lastEnd = newE;
        setCalendarRangeDraft({
          kind: d.kind,
          entityPk: d.entityPk,
          start: newS,
          end: newE,
        });
      };

      const onUp = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        const d = calendarCalDragRef.current;
        calendarCalDragRef.current = null;
        if (!d) {
          setCalendarRangeDraft(null);
          return;
        }
        try {
          captureEl.releasePointerCapture(d.pointerId);
        } catch {
          /* already released */
        }
        if (d.mode === "mv" && !d.moved) {
          setCalendarRangeDraft(null);
          if (d.kind === "schedule") {
            openWindow(`/vl-assembly-production/${d.entityPk}`);
          } else if (d.kind === "module") {
            openWindow(`/vl-assembly-production/modules/${d.entityPk}`);
          } else {
            openWindow(`/vl-assembly-production/processes/${d.entityPk}`);
          }
          return;
        }
        if (!d.moved) {
          setCalendarRangeDraft(null);
          return;
        }
        if (d.lastStart === d.start0 && d.lastEnd === d.end0) {
          setCalendarRangeDraft(null);
          return;
        }
        void commitCalendarRange(d.kind, d.entityPk, d.lastStart, d.lastEnd);
      };

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [commitCalendarRange, savingCalendar]
  );

  useEffect(() => {
    void runPreparationEpModuleMigrationOnce(queryClient, toast);
  }, [queryClient, toast]);

  /** 상세가 popup 창에서 저장될 때 다른 창의 React Query와 분리되므로, storage 로 목록 무효화 */
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== VL_ASSEMBLY_SCHEDULE_LIST_CACHE_BUST_KEY) return;
      void queryClient.invalidateQueries({ queryKey: vlKeys.all() });
      void queryClient.invalidateQueries({ queryKey: vlKeys.scheduleDailyOutputsCalendar() });
      void queryClient.invalidateQueries({ queryKey: vlKeys.moduleDailyOutputsCalendar() });
      void queryClient.invalidateQueries({ queryKey: vlKeys.processDailyOutputsCalendar() });
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [queryClient]);

  const { isOpen, onOpen, onClose } = useDisclosure();
  const { isOpen: isColPopoverOpen, onOpen: onColPopoverOpen, onClose: onColPopoverClose } = useDisclosure();
  const {
    isOpen: isPlanHolidayModalOpen,
    onOpen: onPlanHolidayModalOpen,
    onClose: onPlanHolidayModalClose,
  } = useDisclosure();
  /** 공휴일 등록: 종료일 없음 = 시작일 하루만; 둘 다 있으면 달력일 기준 포함 구간 일괄 등록 */
  const [planHolidayDateFrom, setPlanHolidayDateFrom] = useState("");
  const [planHolidayDateTo, setPlanHolidayDateTo] = useState("");
  const [planHolidayFormName, setPlanHolidayFormName] = useState("");
  const [planHolidaySaving, setPlanHolidaySaving] = useState(false);

  const { data: productionLines = [], isLoading: productionLinesLoading } = useQuery({
    queryKey: ["productionLines"],
    queryFn: getProductionLines,
    enabled: isOpen,
    staleTime: 60_000,
  });

  const { data: allModuleCategories = [], isLoading: moduleCategoriesLoading } = useQuery({
    queryKey: ["moduleCategories", "epScheduleModal", "all"],
    queryFn: () => getModuleCategories(),
    /** 모달 밖에서도 Preparation·VL Assembly 기본값·체크박스 트리에 필요 */
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

  const categoryByPk = useMemo(() => {
    const m = new Map<number, IModuleCategory>();
    for (const c of allModuleCategories) m.set(c.pk, c);
    return m;
  }, [allModuleCategories]);

  const lookupParentCategoryName = useCallback((subLabel: string, lang: string): string | null => {
    const l = resolveModuleCategoryLanguage(lang);
    for (const c of allModuleCategories) {
      if (c.parent == null) continue;
      const cName = l === "ko" ? (c.name_ko || c.name) : l === "vi" ? (c.name_vi || c.name_ko || c.name) : c.name;
      if (cName !== subLabel) continue;
      const parent = categoryByPk.get(c.parent);
      if (!parent) continue;
      return l === "ko" ? (parent.name_ko || parent.name) : l === "vi" ? (parent.name_vi || parent.name_ko || parent.name) : parent.name;
    }
    return null;
  }, [allModuleCategories, categoryByPk]);

  const getModuleCategoryLabels = useCallback((mod: VlModuleCategoryI18n): string[] => {
    const labels = vlModuleCategoryBadgeLabels(mod, i18n.language);
    if (!mod.module_category_name && !mod.module_category_name_ko && !mod.module_category_name_vi && labels.length > 0) {
      const parentName = lookupParentCategoryName(labels[0], i18n.language);
      if (parentName && !labels.includes(parentName)) {
        return [parentName, ...labels];
      }
    }
    return labels;
  }, [i18n.language, lookupParentCategoryName]);

  const getAggregateSjCategoryLabels = useCallback((modules: VlModuleCategoryI18n[]): string[] => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const mod of modules) {
      for (const label of getModuleCategoryLabels(mod)) {
        if (!seen.has(label)) {
          seen.add(label);
          out.push(label);
        }
      }
    }
    return collapseSjAssemblyLineLetters(out);
  }, [getModuleCategoryLabels]);

  /** 이 앱(VL Assembly 전용) 기본: Preparation · VL Assembly(일반가방)만 딥카피 대상으로 선택 */
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

  // ── 컬럼 키 rename 마이그레이션 맵 ────────────────────────────────
  const COL_KEY_MIGRATIONS: Record<string, string> = {
    ex_factory:   "ex_factory_1st",
    due_inbound:  "material_due_inbound",
    name:         "style_name",
  };

  // ── 컬럼 가시성: 서버에서 로드 ──────────────────────────────────
  const ALL_KEYS = ALL_COLUMNS.map((c) => c.key);
  const { data: prefData } = useQuery({
    queryKey: ["epColumnPreference"],
    queryFn: getVlAssemblyColumnPreference,
  });

  const [visibleCols, setVisibleCols] = useState<Set<ColKey>>(
    new Set(ALL_KEYS)
  );

  const [columnOrder, setColumnOrder] = useState<ColKey[]>(() => ALL_COLUMNS.map(c => c.key));

  // 서버 데이터 로드 시 초기화 (saved.length > 0 이면 저장된 값 사용, 빈 배열이면 전체 표시)
  // rename된 키는 마이그레이션 맵으로 자동 변환
  useEffect(() => {
    if (!prefData) return;
    const raw = prefData.visible_columns as string[];
    const migrated = raw.map((k) => COL_KEY_MIGRATIONS[k] ?? k);
    const saved = migrated as ColKey[];
    if (saved.length > 0) {
      const merged = new Set(saved.filter((k) => (ALL_KEYS as string[]).includes(k)));
      if (!saved.includes("sub_category")) merged.add("sub_category");
      if (!saved.includes("work_order")) merged.add("work_order");
      if (!saved.includes("defect_qty")) merged.add("defect_qty");
      setVisibleCols(merged);
      // 저장된 순서를 columnOrder에 복원하되, 새 컬럼은 뒤에 추가
      const savedValidKeys = saved.filter((k) => (ALL_KEYS as string[]).includes(k)) as ColKey[];
      const newKeys = ALL_KEYS.filter((k) => !savedValidKeys.includes(k));
      setColumnOrder([...savedValidKeys, ...newKeys]);
    } else {
      setVisibleCols(new Set(ALL_KEYS));
    }
  }, [prefData]);

  const [isSavingPref, setIsSavingPref] = useState(false);

  const savePreference = async (cols: Set<ColKey>) => {
    setIsSavingPref(true);
    try {
      // columnOrder 순서를 반영하여 저장 (visibleCols에 있는 키만, columnOrder 순서대로)
      const orderedCols = columnOrder.filter(k => cols.has(k));
      await saveVlAssemblyColumnPreference(orderedCols);
      await queryClient.invalidateQueries({ queryKey: ["epColumnPreference"] });
      onColPopoverClose();
      toast({ title: t("vlAssembly.list.columnSettingsSaved"), status: "success", duration: 1500, position: "bottom-right" });
    } catch {
      toast({ title: t("vlAssembly.common.failedSave"), status: "error", duration: 2000, position: "bottom-right" });
    } finally {
      setIsSavingPref(false);
    }
  };

  const [dragColKey, setDragColKey] = useState<ColKey | null>(null);
  const [dragOverColKey, setDragOverColKey] = useState<ColKey | null>(null);

  const handleColDragStart = useCallback((key: ColKey) => {
    setDragColKey(key);
  }, []);
  const handleColDragOver = useCallback((e: React.DragEvent, key: ColKey) => {
    e.preventDefault();
    if (key !== dragColKey) setDragOverColKey(key);
  }, [dragColKey]);
  const handleColDrop = useCallback((targetKey: ColKey) => {
    if (!dragColKey || dragColKey === targetKey) {
      setDragColKey(null);
      setDragOverColKey(null);
      return;
    }
    setColumnOrder(prev => {
      const next = [...prev];
      const fromIdx = next.indexOf(dragColKey);
      const toIdx = next.indexOf(targetKey);
      if (fromIdx < 0 || toIdx < 0) return prev;
      next.splice(fromIdx, 1);
      next.splice(toIdx, 0, dragColKey);
      return next;
    });
    setDragColKey(null);
    setDragOverColKey(null);
  }, [dragColKey]);
  const handleColDragEnd = useCallback(() => {
    setDragColKey(null);
    setDragOverColKey(null);
  }, []);

  const [infoCollapsed, setInfoCollapsed] = useState(false);

  const [pinnedCols, setPinnedColsRaw] = useState<Set<ColKey>>(() => {
    try {
      const saved = localStorage.getItem("vlAssembly_pinnedCols");
      if (saved) {
        const parsed = JSON.parse(saved) as string[];
        const allKeys = ALL_COLUMNS.map((c) => c.key) as ColKey[];
        return new Set(parsed.filter((k) => allKeys.includes(k as ColKey)) as ColKey[]);
      }
    } catch {}
    return new Set(["sj_po_number"] as ColKey[]);
  });
  const setPinnedCols = (val: Set<ColKey> | ((prev: Set<ColKey>) => Set<ColKey>)) =>
    setPinnedColsRaw((prev) => {
      const next = typeof val === "function" ? val(prev) : val;
      try { localStorage.setItem("vlAssembly_pinnedCols", JSON.stringify(Array.from(next))); } catch {}
      return next;
    });

  // ── 컬럼 너비 (localStorage 유지) ──────────────────────────────────────
  const [columnWidths, setColumnWidths] = useState<Partial<Record<ColKey, number>>>(() => {
    try {
      const saved = localStorage.getItem("vlAssembly_columnWidths");
      if (saved) {
        const parsed = JSON.parse(saved) as Partial<Record<ColKey, number>>;
        return { ...COLUMN_WIDTHS, ...parsed };
      }
    } catch {}
    return { ...COLUMN_WIDTHS };
  });
  const columnWidthsRef = useRef(columnWidths);
  useEffect(() => { columnWidthsRef.current = columnWidths; }, [columnWidths]);
  const resizeColRef = useRef<{ key: ColKey; startX: number; startW: number; direction: 1 | -1 } | null>(null);

  const startColResize = useCallback((key: ColKey, startX: number, direction: 1 | -1 = 1) => {
    const startW = columnWidthsRef.current[key] ?? 100;
    resizeColRef.current = { key, startX, startW, direction };
    const onMouseMove = (e: MouseEvent) => {
      const ref = resizeColRef.current;
      if (!ref) return;
      const delta = (e.clientX - ref.startX) * ref.direction;
      const newW = Math.max(40, ref.startW + delta);
      setColumnWidths(prev => ({ ...prev, [ref.key]: newW }));
    };
    const onMouseUp = () => {
      resizeColRef.current = null;
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
      setColumnWidths(prev => {
        try { localStorage.setItem("vlAssembly_columnWidths", JSON.stringify(prev)); } catch {}
        return prev;
      });
    };
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  }, []);

  // ── 선택된 컬럼 (클릭 시 하이라이트 + 리사이즈 핸들 표시) ────────────────
  const [selectedColKey, setSelectedColKey] = useState<ColKey | null>(null);
  useEffect(() => {
    if (!selectedColKey) return;
    const onDown = (e: MouseEvent) => {
      if (!(e.target as Element).closest("th")) setSelectedColKey(null);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [selectedColKey]);

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
      left += columnWidths[col] ?? 100;
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
  /** 두 번째 헤더 행의 좌측 고정 열 — 본문보다 위 (세로 스크롤 시 본문이 헤더 라벨을 덮지 않음) */
  const HEADER_ROW2_STICKY_Z_BASE = 12;
  /** EpFlashQty(scale)·Status Select — sticky에서 overflow hidden으로 잘리지 않게 */
  const STICKY_OVERFLOW_VISIBLE: ReadonlySet<ColKey> = new Set<ColKey>(["today_output_qty", "output_qty", "defect_qty", "status", "sub_category"]);

  const colStickyProps = (key: ColKey, bgColor: string, top?: string) => {
    const w = columnWidths[key] ?? 100;
    const allowOverflow = STICKY_OVERFLOW_VISIBLE.has(key);
    const isSelected = selectedColKey === key;

    const widthProps = {
      w: `${w}px`,
      minW: `${w}px`,
      maxW: `${w}px`,
      overflow: allowOverflow ? ("visible" as const) : ("hidden" as const),
    };

    // 헤더 셀 선택 테두리 — Th 안쪽에 inset box-shadow로 "바깥 라인" 효과
    const SELECT_SHADOW =
      "inset 0 3px 0 var(--chakra-colors-blue-400)," +
      "inset 0 -3px 0 var(--chakra-colors-blue-400)," +
      "inset 3px 0 0 var(--chakra-colors-blue-400)," +
      "inset -3px 0 0 var(--chakra-colors-blue-400)";

    if (!isPinned(key)) {
      if (!top) return widthProps;
      return {
        position: "sticky" as const,
        top,
        bg: isSelected ? "blue.50" : bgColor,
        _dark: isSelected ? { bg: "blue.900" } : undefined,
        zIndex: HEADER_ROW2_STICKY_Z_BASE,
        boxShadow: isSelected ? SELECT_SHADOW : undefined,
        ...widthProps,
      };
    }
    const bodyZ = getStickyZIndex(key);
    const headerZ = HEADER_ROW2_STICKY_Z_BASE + getStickyZIndex(key);
    const pinShadow = "2px 0 4px rgba(0,0,0,0.08)";
    return {
      position: "sticky" as const,
      left: `${getStickyLeft(key)}px`,
      top,
      zIndex: top ? headerZ : bodyZ,
      bg: isSelected && top ? "blue.50" : bgColor,
      _dark: isSelected && top ? { bg: "blue.900" } : undefined,
      boxShadow: isSelected && top
        ? `${pinShadow}, ${SELECT_SHADOW}`
        : pinShadow,
      ...widthProps,
    };
  };

  /** Status 열: 핀 여부와 무관하게 항상 columnWidths.status 와 동일 너비 */
  const statusColumnWidthProps = {
    w: `${columnWidths.status ?? 160}px`,
    minW: `${columnWidths.status ?? 160}px`,
    maxW: `${columnWidths.status ?? 160}px`,
  } as const;

  const vis = (key: ColKey) => isReadOnly ? false : visibleCols.has(key);
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

  const toggleColAndSave = (key: ColKey) => {
    setVisibleCols((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      // 서버에 바로 저장 (백그라운드)
      const orderedCols = columnOrder.filter(k => next.has(k));
      saveVlAssemblyColumnPreference(orderedCols).then(() => {
        queryClient.invalidateQueries({ queryKey: ["epColumnPreference"] });
      }).catch(() => {});
      return next;
    });
  };
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
  const [selectedOrders, setSelectedOrders] = useState<ISjOrderSearchResult[]>([]);
  const orderSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [addSjNoSchedulePk, setAddSjNoSchedulePk] = useState<number | null>(null);
  const [addSjNoExistingStyleCode, setAddSjNoExistingStyleCode] = useState<string | null>(null);
  const [addSjNoOrderQuery, setAddSjNoOrderQuery] = useState("");
  const [addSjNoOrderResults, setAddSjNoOrderResults] = useState<ISjOrderSearchResult[]>([]);
  const [addSjNoOrderSearching, setAddSjNoOrderSearching] = useState(false);
  const [addSjNoSelectedOrder, setAddSjNoSelectedOrder] = useState<ISjOrderSearchResult | null>(null);
  const [addSjNoModuleCategoryIds, setAddSjNoModuleCategoryIds] = useState<number[]>([]);
  const addSjNoSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const {
    isOpen: isAddSjNoOpen,
    onOpen: onAddSjNoOpen,
    onClose: onAddSjNoClose,
  } = useDisclosure();

  const [moveSjNoPk, setMoveSjNoPk] = useState<number | null>(null);
  const [moveSourceSchedulePk, setMoveSourceSchedulePk] = useState<number | null>(null);
  const [moveMode, setMoveMode] = useState<"existing" | "new">("existing");
  const [moveTargetSchedulePk, setMoveTargetSchedulePk] = useState<string | number>("");
  const [moveTargetSearch, setMoveTargetSearch] = useState("");
  const {
    isOpen: isMoveSjNoOpen,
    onOpen: onMoveSjNoOpen,
    onClose: onMoveSjNoClose,
  } = useDisclosure();
  const tableContainerRef = useRef<HTMLDivElement>(null);

  // ── 커스텀 가로 스크롤바 상태 ────────────────────────────────────────────
  const [isScrollbarHovered, setIsScrollbarHovered] = useState(false);
  const [tableScrollInfo, setTableScrollInfo] = useState({ scrollLeft: 0, scrollWidth: 0, clientWidth: 0 });

  const CAL_COL_PX = 40;

  // 스크롤 위치 저장 + 커스텀 스크롤바 thumb 위치 추적
  useEffect(() => {
    const el = tableContainerRef.current;
    if (!el) return;
    const onScroll = () => {
      sessionStorage.setItem("ep_scrollY", String(el.scrollTop));
      sessionStorage.setItem("ep_scrollX", String(el.scrollLeft));
      setTableScrollInfo({ scrollLeft: el.scrollLeft, scrollWidth: el.scrollWidth, clientWidth: el.clientWidth });
    };
    const onResize = () => {
      setTableScrollInfo({ scrollLeft: el.scrollLeft, scrollWidth: el.scrollWidth, clientWidth: el.clientWidth });
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    const ro = new ResizeObserver(onResize);
    ro.observe(el);
    onResize();
    return () => { el.removeEventListener("scroll", onScroll); ro.disconnect(); };
  }, []);

  // 커스텀 thumb 드래그
  const startThumbDrag = useCallback((startClientX: number) => {
    const table = tableContainerRef.current;
    if (!table) return;
    const { scrollLeft: startScrollLeft, scrollWidth, clientWidth } = table;
    const thumbW = Math.max(40, (clientWidth / scrollWidth) * clientWidth);
    const trackW = clientWidth - thumbW;
    const scrollRange = scrollWidth - clientWidth;
    const onMove = (e: MouseEvent) => {
      const delta = e.clientX - startClientX;
      table.scrollLeft = Math.max(0, Math.min(scrollRange, startScrollLeft + (delta / trackW) * scrollRange));
    };
    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, []);

  const handleOrderSearch = (q: string) => {
    setOrderQuery(q);
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

  const addSelectedOrder = (order: ISjOrderSearchResult) => {
    if (selectedOrders.some((o) => o.pk === order.pk)) {
      toast({
        title: t("vlAssembly.list.sjOrderAlreadySelected"),
        status: "info",
        duration: 2000,
        position: "bottom-right",
      });
      return;
    }
    if (selectedOrders.length > 0) {
      const refStyle = selectedOrders[0].sj_style_code;
      if (refStyle != null && order.sj_style_code != null && refStyle !== order.sj_style_code) {
        toast({
          title: t("vlAssembly.list.styleMismatchError", { expected: refStyle, got: order.sj_style_code }),
          status: "warning",
          duration: 4000,
          position: "bottom-right",
        });
        return;
      }
    }
    const nextOrders = [...selectedOrders, order];
    setSelectedOrders(nextOrders);
    setOrderQuery("");
    setOrderResults([]);
    const exRaw = order.ex_factory_date;
    const exDate = exRaw && typeof exRaw === "string" ? exRaw.slice(0, 10) : "";
    setForm((f) => ({
      ...f,
      sj_order_ids: nextOrders.map((o) => o.pk),
      ex_factory_date: f.ex_factory_date || exDate,
    }));
  };

  const removeSelectedOrder = (pk: number) => {
    const nextOrders = selectedOrders.filter((o) => o.pk !== pk);
    setSelectedOrders(nextOrders);
    setForm((f) => ({ ...f, sj_order_ids: nextOrders.map((o) => o.pk) }));
  };

  const resetModal = () => {
    setForm({ ...emptyForm });
    setOrderQuery("");
    setOrderResults([]);
    setSelectedOrders([]);
  };

  const resetAddSjNoModal = () => {
    setAddSjNoSchedulePk(null);
    setAddSjNoExistingStyleCode(null);
    setAddSjNoOrderQuery("");
    setAddSjNoOrderResults([]);
    setAddSjNoSelectedOrder(null);
    setAddSjNoModuleCategoryIds([]);
  };

  const openAddSjNoModal = (schedule: IVlAssemblySchedule) => {
    resetAddSjNoModal();
    setAddSjNoSchedulePk(schedule.pk);
    setAddSjNoExistingStyleCode(schedule.sj_order_info?.sj_style?.code ?? null);
    setAddSjNoModuleCategoryIds(schedule.module_category_selection ?? []);
    onAddSjNoOpen();
  };

  const handleAddSjNoOrderSearch = (q: string) => {
    setAddSjNoOrderQuery(q);
    setAddSjNoSelectedOrder(null);
    if (addSjNoSearchTimer.current) clearTimeout(addSjNoSearchTimer.current);
    if (!q.trim()) { setAddSjNoOrderResults([]); return; }
    addSjNoSearchTimer.current = setTimeout(async () => {
      setAddSjNoOrderSearching(true);
      try {
        const results = await searchSjOrders(q);
        setAddSjNoOrderResults(results);
      } finally {
        setAddSjNoOrderSearching(false);
      }
    }, 300);
  };

  const selectAddSjNoOrder = (order: ISjOrderSearchResult) => {
    if (addSjNoExistingStyleCode != null && order.sj_style_code != null && addSjNoExistingStyleCode !== order.sj_style_code) {
      toast({
        title: t("vlAssembly.list.styleMismatchError", { expected: addSjNoExistingStyleCode, got: order.sj_style_code }),
        status: "warning",
        duration: 4000,
        position: "bottom-right",
      });
      return;
    }
    setAddSjNoSelectedOrder(order);
    setAddSjNoOrderQuery(order.sj_po_number);
    setAddSjNoOrderResults([]);
  };

  const toggleAddSjNoModuleCategory = (pk: number) => {
    const subtree = collectDescendantCategoryIds(pk, moduleCategoryChildrenByParent);
    setAddSjNoModuleCategoryIds((prev) => {
      const allOn = subtree.length > 0 && subtree.every((id) => prev.includes(id));
      if (allOn) {
        const remove = new Set(subtree);
        return prev.filter((id) => !remove.has(id));
      }
      return Array.from(new Set([...prev, ...subtree]));
    });
  };

  const handleAddSjNo = async () => {
    if (!addSjNoSchedulePk || !addSjNoSelectedOrder) {
      toast({ title: t("vlAssembly.list.sjOrderRequired"), status: "warning", duration: 2000, position: "bottom-right" });
      return;
    }
    if (addSjNoModuleCategoryIds.length === 0) {
      toast({ title: t("vlAssembly.list.moduleCategoryRequired"), status: "warning", duration: 2000, position: "bottom-right" });
      return;
    }
    setIsSaving(true);
    try {
      await addSjNoToVlAssemblySchedule(addSjNoSchedulePk, {
        sj_order: addSjNoSelectedOrder.pk,
        module_category_ids: addSjNoModuleCategoryIds,
      });
      toast({ title: t("vlAssembly.list.sjNoAdded"), status: "success", duration: 2000, position: "bottom-right" });
      queryClient.invalidateQueries({ queryKey: vlKeys.all() });
      resetAddSjNoModal();
      onAddSjNoClose();
    } catch (e: any) {
      const msg = e?.response?.data?.detail ?? (e?.response?.data ? JSON.stringify(e.response.data) : "Failed to add SJ No");
      toast({ title: String(msg), status: "error", duration: 3000, position: "bottom-right" });
    } finally {
      setIsSaving(false);
    }
  };

  const openMoveSjNoModal = (sjPk: number, schedulePk: number, mode: "existing" | "new") => {
    setMoveSjNoPk(sjPk);
    setMoveSourceSchedulePk(schedulePk);
    setMoveMode(mode);
    setMoveTargetSchedulePk("");
    setMoveTargetSearch("");
    onMoveSjNoOpen();
  };

  const resetMoveSjNoModal = () => {
    setMoveSjNoPk(null);
    setMoveSourceSchedulePk(null);
    setMoveMode("existing");
    setMoveTargetSchedulePk("");
    setMoveTargetSearch("");
  };

  const handleMoveSjNo = async () => {
    if (!moveSjNoPk) return;
    setIsSaving(true);
    try {
      if (moveMode === "existing") {
        if (!moveTargetSchedulePk) {
          toast({ title: t("vlAssembly.list.targetSchedulePlaceholder"), status: "warning", duration: 2000, position: "bottom-right" });
          return;
        }
        await moveVlAssemblySjNo(moveSjNoPk, { target_schedule: Number(moveTargetSchedulePk) });
        toast({ title: t("vlAssembly.list.sjNoMoved"), status: "success", duration: 2000, position: "bottom-right" });
      } else {
        const schedule = schedules.find((s) => s.pk === moveSourceSchedulePk);
        await moveVlAssemblySjNo(moveSjNoPk, {
          create_new_schedule: true,
          production_line: schedule?.production_line ?? null,
          status: schedule?.status ?? "not_started",
        });
        toast({ title: t("vlAssembly.list.sjNoSplit"), status: "success", duration: 2000, position: "bottom-right" });
      }
      queryClient.invalidateQueries({ queryKey: vlKeys.all() });
      resetMoveSjNoModal();
      onMoveSjNoClose();
    } catch (e: any) {
      const msg = e?.response?.data?.detail ?? (e?.response?.data ? JSON.stringify(e.response.data) : "Failed to move SJ No");
      toast({ title: String(msg), status: "error", duration: 3000, position: "bottom-right" });
    } finally {
      setIsSaving(false);
    }
  };
  const [expandedSjNos, setExpandedSjNosRaw] = useState<Set<number>>(() => {
    try { const s = sessionStorage.getItem("ep_expandedSjNos"); return s ? new Set<number>(JSON.parse(s)) : new Set(); } catch { return new Set(); }
  });
  const [expandedModules, setExpandedModulesRaw] = useState<Set<number>>(() => {
    try { const s = sessionStorage.getItem("ep_expandedModules"); return s ? new Set<number>(JSON.parse(s)) : new Set(); } catch { return new Set(); }
  });
  const [expandedSchedules, setExpandedSchedulesRaw] = useState<Set<number>>(() => {
    try { const s = sessionStorage.getItem("ep_expandedSchedules"); return s ? new Set<number>(JSON.parse(s)) : new Set(); } catch { return new Set(); }
  });
  /** 접힌 라인 키 Set — 기본값은 모두 펼침(비어 있음) */
  const [collapsedLines, setCollapsedLinesRaw] = useState<Set<string>>(() => {
    try { const s = sessionStorage.getItem("vl_collapsedLines"); return s ? new Set<string>(JSON.parse(s)) : new Set(); } catch { return new Set(); }
  });
  const setCollapsedLines = (val: Set<string> | ((prev: Set<string>) => Set<string>)) =>
    setCollapsedLinesRaw((prev) => {
      const next = typeof val === "function" ? val(prev) : val;
      try { sessionStorage.setItem("vl_collapsedLines", JSON.stringify(Array.from(next))); } catch {}
      return next;
    });
  const toggleLine = (lineKey: string) =>
    setCollapsedLines((prev) => {
      const next = new Set(prev);
      if (next.has(lineKey)) next.delete(lineKey); else next.add(lineKey);
      return next;
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
  const setExpandedSchedules = (val: Set<number> | ((prev: Set<number>) => Set<number>)) =>
    setExpandedSchedulesRaw((prev) => {
      const next = typeof val === "function" ? val(prev) : val;
      try { sessionStorage.setItem("ep_expandedSchedules", JSON.stringify(Array.from(next))); } catch {}
      return next;
    });
  const [editingModuleQty, setEditingModuleQty] = useState<{pk: number; val: string} | null>(null);
  const [editingProcessQty, setEditingProcessQty] = useState<{pk: number; val: string; totalQty?: number | null} | null>(null);
  const [editingModuleDate, setEditingModuleDate] = useState<{pk: number; field: "process_start_date" | "process_finish_date"; val: string} | null>(null);
  const [editingProcessDate, setEditingProcessDate] = useState<{pk: number; field: "process_start_date" | "process_finish_date"; val: string} | null>(null);
  const [editingAssemblyOutQty, setEditingAssemblyOutQty] = useState<{pk: number; val: string} | null>(null);
  const [editingActualInboundQty, setEditingActualInboundQty] = useState<{pk: number; val: string} | null>(null);
  const [savingStatusPk, setSavingStatusPk] = useState<number | null>(null);
  type SortKey = "ex_factory_1st" | "assembly_start" | "expected_inbound";
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

  const monthBlocks = useMemo(
    () => getAdjacentMonthBlocks(selectedYear, selectedMonth),
    [selectedYear, selectedMonth]
  );

  /** 캘린더 일자 열 위 1행: colSpan=일수로만 실제 경계와 일치 (정보 열 병합 셀과는 픽셀 정렬 불가) */
  const calendarMonthBlockHeaders = useMemo(() => {
    const shortFmt = new Intl.DateTimeFormat(i18n.language, { month: "short" });
    return monthBlocks.map((b, i) => {
      const dt = new Date(b.year, b.month - 1, 1);
      return {
        key: `cal-mh-${b.year}-${b.month}`,
        year: b.year,
        month: b.month,
        days: b.days,
        blockIndex: i,
        labelShort: shortFmt.format(dt).toUpperCase(),
        labelYear: String(b.year),
      };
    });
  }, [monthBlocks, i18n.language]);

  const calendarMonthAbbrByKey = useMemo(() => {
    const m = new Map<string, string>();
    for (const b of calendarMonthBlockHeaders) {
      m.set(`${b.year}-${b.month}`, b.labelShort);
    }
    return m;
  }, [calendarMonthBlockHeaders]);

  const calendarDayColumns = useMemo(() => {
    const cols: {
      y: number;
      m1: number;
      day: number;
      daysInMonth: number;
      key: string;
      /** 0: 이전 달, 1: 선택 달, 2: 다음 달 */
      monthBlockIndex: number;
    }[] = [];
    monthBlocks.forEach((b, monthBlockIndex) => {
      for (let day = 1; day <= b.days; day++) {
        cols.push({
          y: b.year,
          m1: b.month,
          day,
          daysInMonth: b.days,
          key: `cal-${b.year}-${b.month}-${day}`,
          monthBlockIndex,
        });
      }
    });
    return cols;
  }, [monthBlocks]);

  /** 캘린더 3개월 YMD 구간과 조립 기간이 겹치는 행 포함(백엔드 overlap + 월별 응답 병합) */
  const calendarWindowDates = useMemo(
    () => calendarAdjacentWindowIsoRange(monthBlocks),
    [monthBlocks]
  );

  const epSchedulesOverlapQuery = useQuery({
    queryKey: vlKeys.listOverlapWindow({ search: searchQuery, dateFrom: calendarWindowDates?.dateFrom, dateTo: calendarWindowDates?.dateTo }),
    queryFn: () =>
      getVlAssemblySchedules({
        search: searchQuery,
        date_from: calendarWindowDates!.dateFrom,
        date_to: calendarWindowDates!.dateTo,
      }),
    enabled: calendarWindowDates != null,
    staleTime: 30_000,
  });

  const epScheduleMonthQueries = useQueries({
    queries: monthBlocks.map((b) => ({
      queryKey: vlKeys.list({ search: searchQuery, year: b.year, month: b.month }),
      queryFn: () =>
        getVlAssemblySchedules({
          search: searchQuery,
          year: b.year,
          month: b.month,
        }),
      staleTime: 30_000,
    })),
  });

  const data = useMemo(() => {
    if (!calendarWindowDates) return [];
    const { dateFrom, dateTo } = calendarWindowDates;
    const seen = new Map<number, IVlAssemblySchedule>();
    const addRows = (rows: IVlAssemblySchedule[] | undefined) => {
      for (const s of rows ?? []) {
        if (!vlScheduleAssemblyOverlapsWindow(s, dateFrom, dateTo)) continue;
        seen.set(s.pk, s);
      }
    };
    addRows(epSchedulesOverlapQuery.data as IVlAssemblySchedule[] | undefined);
    for (const q of epScheduleMonthQueries) {
      addRows(q.data as IVlAssemblySchedule[] | undefined);
    }
    return Array.from(seen.values());
  }, [
    calendarWindowDates,
    epSchedulesOverlapQuery.data,
    epScheduleMonthQueries,
  ]);

  const isLoading =
    epSchedulesOverlapQuery.isPending ||
    epScheduleMonthQueries.some((q) => q.isPending);
  const isFetching =
    epSchedulesOverlapQuery.isFetching ||
    epScheduleMonthQueries.some((q) => q.isFetching);

  useEffect(() => {
    if (!highlightPk || data.length === 0 || highlightScrolledRef.current) return;
    const found = data.find((s) => s.pk === highlightPk);
    if (!found) return;
    const timer = setTimeout(() => {
      const el = tableContainerRef.current?.querySelector(`[data-schedule-pk="${highlightPk}"]`);
      if (el && tableContainerRef.current) {
        tableContainerRef.current.scrollTop = Math.max(0, (el as HTMLElement).offsetTop - 120);
        highlightScrolledRef.current = true;
        setFlashPk(highlightPk);
        setTimeout(() => setFlashPk(null), 3000);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [data, highlightPk]);

  const calendarDayHeaderMeta = useMemo(() => {
    const fmt = new Intl.DateTimeFormat(i18n.language, { weekday: "short" });
    return calendarDayColumns.map((col) => {
      const d = new Date(col.y, col.m1 - 1, col.day);
      return {
        ...col,
        jsDay: d.getDay(),
        weekdayShort: fmt.format(d),
        dateLabel: ymdFromCalendar(col.y, col.m1, col.day),
      };
    });
  }, [calendarDayColumns, i18n.language]);

  const schedDailyMonthQueries = useQueries({
    queries: monthBlocks.map((b) => {
      const { dateFrom, dateTo } = monthBlockToDateRangeIso(b);
      return {
        queryKey: ["vlScheduleDailyOutputsCalendar", b.year, b.month] as const,
        queryFn: () => fetchScheduleDailyOutputsForRange(dateFrom, dateTo),
        staleTime: 30_000,
      };
    }),
  });

  const scheduleDailyRows = useMemo(
    () => schedDailyMonthQueries.flatMap((q) => q.data ?? []),
    [schedDailyMonthQueries]
  );

  const modDailyMonthQueries = useQueries({
    queries: monthBlocks.map((b) => {
      const { dateFrom, dateTo } = monthBlockToDateRangeIso(b);
      return {
        queryKey: ["vlModuleDailyOutputsCalendar", b.year, b.month] as const,
        queryFn: () => fetchModuleDailyOutputsForRange(dateFrom, dateTo),
        staleTime: 30_000,
      };
    }),
  });

  const moduleDailyRows = useMemo(
    () => modDailyMonthQueries.flatMap((q) => q.data ?? []),
    [modDailyMonthQueries]
  );

  const procDailyMonthQueries = useQueries({
    queries: monthBlocks.map((b) => {
      const { dateFrom, dateTo } = monthBlockToDateRangeIso(b);
      return {
        queryKey: ["vlProcessDailyOutputsCalendar", b.year, b.month] as const,
        queryFn: () => fetchProcessDailyOutputsForRange(dateFrom, dateTo),
        staleTime: 30_000,
      };
    }),
  });

  const processDailyRows = useMemo(
    () => procDailyMonthQueries.flatMap((q) => q.data ?? []),
    [procDailyMonthQueries]
  );

  const dailyQtyBySchedule = useMemo(() => {
    const m = new Map<number, Map<string, number>>();
    for (const row of scheduleDailyRows) {
      const spk = row.vl_assembly_schedule;
      if (spk == null) continue;
      const d = new Date(row.recorded_at);
      const ymd = ymdFromLocalDate(d);
      if (!m.has(spk)) m.set(spk, new Map());
      const inner = m.get(spk)!;
      inner.set(ymd, (inner.get(ymd) ?? 0) + row.qty);
    }
    return m;
  }, [scheduleDailyRows]);

  const dailyQtyBySjNo = useMemo(() => {
    const m = new Map<number, Map<string, number>>();
    for (const row of scheduleDailyRows) {
      const sjPk = row.vl_assembly_sj_no;
      if (sjPk == null) continue;
      const d = new Date(row.recorded_at);
      const ymd = ymdFromLocalDate(d);
      if (!m.has(sjPk)) m.set(sjPk, new Map());
      const inner = m.get(sjPk)!;
      inner.set(ymd, (inner.get(ymd) ?? 0) + row.qty);
    }
    return m;
  }, [scheduleDailyRows]);


  const dailyQtyByModule = useMemo(() => {
    const m = new Map<number, Map<string, number>>();
    for (const row of moduleDailyRows) {
      const mpk = row.vl_assembly_module;
      if (mpk == null) continue;
      const d = new Date(row.recorded_at);
      const ymd = ymdFromLocalDate(d);
      if (!m.has(mpk)) m.set(mpk, new Map());
      const inner = m.get(mpk)!;
      inner.set(ymd, (inner.get(ymd) ?? 0) + row.qty);
    }
    return m;
  }, [moduleDailyRows]);

  const dailyQtyByProcess = useMemo(() => {
    const m = new Map<number, Map<string, number>>();
    for (const row of processDailyRows) {
      const ppk = row.vl_assembly_process ?? row.ep_process;
      if (ppk == null) continue;
      const d = new Date(row.recorded_at);
      const ymd = ymdFromLocalDate(d);
      if (!m.has(ppk)) m.set(ppk, new Map());
      const inner = m.get(ppk)!;
      inner.set(ymd, (inner.get(ymd) ?? 0) + row.qty);
    }
    return m;
  }, [processDailyRows]);

  const scheduleCalendarFlagsByKey = useMemo(() => {
    const map = new Map<string, AssemblyCalendarDayFlag[]>();
    for (const sch of data ?? []) {
      for (const b of monthBlocks) {
        map.set(
          `${sch.pk}-${b.year}-${b.month}`,
          buildAssemblyCalendarDayFlags(sch, b.year, b.month, b.days)
        );
      }
    }
    return map;
  }, [data, monthBlocks]);

  const moduleCalendarFlagsByKey = useMemo(() => {
    const map = new Map<string, AssemblyCalendarDayFlag[]>();
    for (const sch of data ?? []) {
      for (const sj of sch.ep_sj_nos ?? []) {
        for (const mod of sj.ep_modules ?? []) {
          for (const b of monthBlocks) {
            map.set(
              `${mod.pk}-${b.year}-${b.month}`,
              buildDateRangeCalendarDayFlags(
                mod.process_start_date,
                mod.process_finish_date,
                b.year,
                b.month,
                b.days
              )
            );
          }
        }
      }
    }
    return map;
  }, [data, monthBlocks]);

  const processCalendarFlagsByKey = useMemo(() => {
    const map = new Map<string, AssemblyCalendarDayFlag[]>();
    for (const sch of data ?? []) {
      for (const sj of sch.ep_sj_nos ?? []) {
        for (const mod of sj.ep_modules ?? []) {
          for (const p of mod.ep_processes ?? []) {
            for (const b of monthBlocks) {
              map.set(
                `${p.pk}-${b.year}-${b.month}`,
                buildDateRangeCalendarDayFlags(
                  p.process_start_date,
                  p.process_finish_date,
                  b.year,
                  b.month,
                  b.days
                )
              );
            }
          }
        }
      }
    }
    return map;
  }, [data, monthBlocks]);

  const tableColSpanWithDays = visibleCount + calendarDayColumns.length;

  const renderVlCalendarCells = useCallback(
    (
      opts:
        | {
            kind: "schedule";
            schedule: IVlAssemblySchedule;
            rowBg: string;
            showScheduleDailyQty: boolean;
            showSchedulePeriodInCalendar: boolean;
            firstSJTotalQty: number | null;
            overrideByDay?: Map<string, number>;
          }
        | { kind: "module"; mod: IEpModuleCopy; rowBg: string }
        | { kind: "process"; p: IEpProcessCopy; rowBg: string }
    ) => {
      const rowBg = opts.rowBg;
      const kind = opts.kind;
      let entityPk: number;
      let showDailyQty: boolean;
      let showPeriodInCalendar: boolean;
      let effStart: string;
      let effEnd: string;
      let planMeta: { daily: number; workDays: number } | null;
      let byDay: Map<string, number> | undefined;
      let planTotalForTooltip: number;
      let rowDragCtx: VlCalDragContext;
      let barStyleThumb: string | null = null;
      let barStyleName: string | null = null;
      let barOutputQty: number | null = null;
      let barTotalQty: number | null = null;
      let barLabelColor: string = barLabelColorNotStarted;
      let barBg: string = barContainerBgNotStarted;

      if (kind === "schedule") {
        const schedule = opts.schedule;
        entityPk = schedule.pk;
        showDailyQty = opts.showScheduleDailyQty;
        showPeriodInCalendar = opts.showSchedulePeriodInCalendar;
        const firstSJTotalQty = opts.firstSJTotalQty;
        const draft =
          calendarRangeDraft?.kind === "schedule" &&
          calendarRangeDraft.entityPk === entityPk
            ? calendarRangeDraft
            : null;
        effStart = draft?.start ?? schedule.production_assembly_start_date ?? "";
        effEnd = draft?.end ?? schedule.production_assembly_finish_date ?? "";
        const effSchedule: IVlAssemblySchedule = draft
          ? {
              ...schedule,
              production_assembly_start_date: effStart,
              production_assembly_finish_date: effEnd,
            }
          : schedule;
        planMeta =
          firstSJTotalQty != null
            ? getAssemblyDailyPlannedQtyFromTotal(
                effSchedule,
                firstSJTotalQty,
                vlPlanHolidayYmdSet
              )
            : null;
        // SJ No가 있으면 각 SJ No의 daily qty를 합산해서 표시 (SJ No들은 병렬 생산)
        if (showDailyQty) {
          const sjNos = schedule.ep_sj_nos ?? [];
          if (opts.overrideByDay) {
            byDay = opts.overrideByDay;
          } else if (sjNos.length > 0) {
            const merged = new Map<string, number>();
            for (const sj of sjNos) {
              const sjMap = dailyQtyBySjNo.get(sj.pk);
              if (!sjMap) continue;
              Array.from(sjMap.entries()).forEach(([ymd, qty]) => {
                merged.set(ymd, (merged.get(ymd) ?? 0) + qty);
              });
            }
            byDay = merged.size > 0 ? merged : dailyQtyBySchedule.get(entityPk);
          } else {
            byDay = dailyQtyBySchedule.get(entityPk);
          }
        }
        planTotalForTooltip = firstSJTotalQty ?? 0;
        rowDragCtx = { kind: "schedule", schedule: effSchedule };
        barStyleThumb = schedule.sj_order_info?.sj_style?.thumbnail ?? null;
        barStyleName = schedule.sj_order_info?.sj_style?.code ?? null;
        barOutputQty = schedule.production_assembly_output_qty ?? null;
        barTotalQty = firstSJTotalQty ?? schedule.sj_order_info?.total_order_qty ?? null;
        barLabelColor = schedule.status === "completed"
          ? barLabelColorCompleted
          : schedule.status === "in_progress"
            ? barLabelColorInProgress
            : barLabelColorNotStarted;
        barBg = schedule.status === "completed"
          ? barContainerBgCompleted
          : schedule.status === "in_progress"
            ? barContainerBgInProgress
            : barContainerBgNotStarted;
      } else if (kind === "module") {
        const { mod } = opts;
        entityPk = mod.pk;
        showDailyQty = true;
        showPeriodInCalendar = true;
        const draft =
          calendarRangeDraft?.kind === "module" &&
          calendarRangeDraft.entityPk === entityPk
            ? calendarRangeDraft
            : null;
        effStart = draft?.start ?? mod.process_start_date ?? "";
        effEnd = draft?.end ?? mod.process_finish_date ?? "";
        const effMod: IEpModuleCopy = {
          ...mod,
          process_start_date: effStart,
          process_finish_date: effEnd,
        };
        planMeta = getDailyPlannedQtyFromRange(
          effStart,
          effEnd,
          mod.total_qty ?? 0,
          vlPlanHolidayYmdSet
        );
        byDay = dailyQtyByModule.get(entityPk);
        planTotalForTooltip = mod.total_qty ?? 0;
        rowDragCtx = { kind: "module", mod: effMod };
      } else {
        const { p } = opts;
        entityPk = p.pk;
        showDailyQty = true;
        showPeriodInCalendar = true;
        const draft =
          calendarRangeDraft?.kind === "process" &&
          calendarRangeDraft.entityPk === entityPk
            ? calendarRangeDraft
            : null;
        effStart = draft?.start ?? p.process_start_date ?? "";
        effEnd = draft?.end ?? p.process_finish_date ?? "";
        const effProcess: IEpProcessCopy = {
          ...p,
          process_start_date: effStart,
          process_finish_date: effEnd,
        };
        planMeta = getDailyPlannedQtyFromRange(
          effStart,
          effEnd,
          p.total_qty ?? 0,
          vlPlanHolidayYmdSet
        );
        byDay = dailyQtyByProcess.get(entityPk);
        planTotalForTooltip = p.total_qty ?? 0;
        rowDragCtx = { kind: "process", p: effProcess };
      }

      /** SJ 주문 EX-FACTORY (조립 캘린더 드래그와 무관, 실제 날짜 칸에만 표시) */
      let scheduleExFactoryYmd: string | null = null;
      let scheduleExFactoryLabel: string | null = null;
      if (kind === "schedule") {
        const raw = opts.schedule.sj_order_info?.ex_factory_date;
        if (raw) {
          scheduleExFactoryYmd = String(raw).slice(0, 10);
          scheduleExFactoryLabel = fmtDate(raw);
        }
      }

      const savingThis =
        savingCalendar?.kind === kind && savingCalendar.pk === entityPk;
      const hasBothDates = Boolean(effStart && effEnd);
      const openHintKey =
        kind === "schedule"
          ? "vlAssembly.list.calendarOpenScheduleHint"
          : kind === "module"
            ? "vlAssembly.list.calendarOpenModuleHint"
            : "vlAssembly.list.calendarOpenProcessHint";

      const calPeriodOverlay =
        kind === "schedule"
          ? opts.schedule.status === "completed"
            ? scheduleCalPeriodOverlayCompleted
            : opts.schedule.status === "not_started"
              ? scheduleCalPeriodOverlayNotStarted
              : scheduleCalPeriodOverlay
          : kind === "module"
            ? moduleCalPeriodOverlay
            : processCalPeriodOverlay;
      const calEdge =
        kind === "schedule"
          ? opts.schedule.status === "completed"
            ? scheduleCalEdgeCompleted
            : opts.schedule.status === "not_started"
              ? scheduleCalEdgeNotStarted
              : scheduleCalEdge
          : kind === "module"
            ? moduleCalEdge
            : processCalEdge;
      const calPlanText =
        kind === "schedule"
          ? scheduleCalPlanText
          : kind === "module"
            ? moduleCalPlanText
            : processCalPlanText;

      return calendarDayColumns.map((col, colIdx) => {
        const h = calendarDayHeaderMeta[colIdx]!;
        const jsDay = h.jsDay;
        const ymdK = ymdFromCalendar(col.y, col.m1, col.day);
        const isPlanHolidayDay = vlPlanHolidayYmdSet.has(ymdK);
        const cellBg = isPlanHolidayDay
          ? planHolidayColBg
          : jsDay === 0
            ? sunDayColBg
            : jsDay === 6
              ? satDayColBg
              : rowBg;

        const draftActive =
          calendarRangeDraft != null &&
          calendarRangeDraft.kind === kind &&
          calendarRangeDraft.entityPk === entityPk;

        let monthFlags: AssemblyCalendarDayFlag[] | undefined;
        if (showPeriodInCalendar) {
          if (draftActive) {
            if (kind === "schedule" && rowDragCtx.kind === "schedule") {
              monthFlags = buildAssemblyCalendarDayFlags(
                rowDragCtx.schedule,
                col.y,
                col.m1,
                col.daysInMonth
              );
            } else if (kind === "module" && rowDragCtx.kind === "module") {
              monthFlags = buildDateRangeCalendarDayFlags(
                effStart,
                effEnd,
                col.y,
                col.m1,
                col.daysInMonth
              );
            } else if (kind === "process" && rowDragCtx.kind === "process") {
              monthFlags = buildDateRangeCalendarDayFlags(
                effStart,
                effEnd,
                col.y,
                col.m1,
                col.daysInMonth
              );
            }
          } else {
            const fk = `${entityPk}-${col.y}-${col.m1}`;
            if (kind === "schedule") {
              monthFlags = scheduleCalendarFlagsByKey.get(fk);
            } else if (kind === "module") {
              monthFlags = moduleCalendarFlagsByKey.get(fk);
            } else {
              monthFlags = processCalendarFlagsByKey.get(fk);
            }
          }
        }
        const flags = monthFlags?.[col.day - 1];
        const inPeriod = !!flags?.inPeriod;
        const canDrag =
          !isReadOnly &&
          inPeriod &&
          showPeriodInCalendar &&
          hasBothDates &&
          !savingThis;
        const isExFactoryDay =
          kind === "schedule" &&
          scheduleExFactoryYmd != null &&
          ymdK === scheduleExFactoryYmd;
        const q = byDay?.get(ymdK);
        const hasQty = q != null && q > 0;
        const dateStr = h.dateLabel;
        const dayTitle = `${h.weekdayShort} ${dateStr}`;
        const hasPlanRow =
          inPeriod && showPeriodInCalendar && planMeta != null;
        const title = showDailyQty
            ? (() => {
              const p = [dayTitle];
              if (isPlanHolidayDay) {
                const hn = vlPlanHolidayNameByYmd.get(ymdK);
                p.push(
                  hn
                    ? t("vlAssembly.list.calendarPlanHolidayNamedTooltip", {
                        name: hn,
                      })
                    : t("vlAssembly.list.calendarPlanHolidayTooltip")
                );
              }
              if (kind === "schedule" && scheduleExFactoryLabel) {
                p.push(`${colLabels.ex_factory_1st}: ${scheduleExFactoryLabel}`);
              }
              if (inPeriod && showPeriodInCalendar) {
                p.push(
                  t("vlAssembly.list.calendarPeriodTooltip", {
                    start: fmtDate(effStart) || "—",
                    end: fmtDate(effEnd) || "—",
                  })
                );
                if (planMeta) {
                  p.push(
                    t("vlAssembly.list.calendarPlanDetailTooltip", {
                      total: planTotalForTooltip,
                      workDays: planMeta.workDays,
                      daily: planMeta.daily,
                    })
                  );
                }
              }
              if (inPeriod && showPeriodInCalendar) {
                p.push(
                  canDrag
                    ? t("vlAssembly.list.calendarDragHints")
                    : t(openHintKey)
                );
              }
              return p.join(" · ");
            })()
          : undefined;
        const openByClick = inPeriod && showPeriodInCalendar && !canDrag;
        const isRStart = !!flags?.isRangeStart;
        const isREnd = !!flags?.isRangeEnd;
        const cellKey =
          kind === "schedule"
            ? `sched-day-${entityPk}-${col.key}`
            : kind === "module"
              ? `mod-day-${entityPk}-${col.key}`
              : `proc-day-${entityPk}-${col.key}`;

        const openPath = isReadOnly
          ? kind === "schedule"
            ? `/vl-factory-live/schedules/${entityPk}`
            : ""
          : kind === "schedule"
            ? `/vl-assembly-production/${entityPk}`
            : kind === "module"
              ? `/vl-assembly-production/modules/${entityPk}`
              : `/vl-assembly-production/processes/${entityPk}`;

        return (
          <Td
            key={cellKey}
            isNumeric
            fontSize="xs"
            p={0}
            minW={isReadOnly ? "32px" : "40px"}
            minH={isReadOnly ? "36px" : "38px"}
            position="relative"
            zIndex={kind === "schedule" && isRStart && (barStyleThumb || barStyleName) ? 1 : 0}
            overflow={kind === "schedule" && isRStart && (barStyleThumb || barStyleName) ? "visible" : undefined}
            borderLeftWidth={col.day === 1 ? "1px" : undefined}
            borderLeftColor={col.day === 1 ? calMonthBoundaryLine : undefined}
            title={title}
            bg={cellBg}
            data-vl-cal-year={col.y}
            data-vl-cal-month={col.m1}
            data-vl-cal-day={col.day}
            data-vl-cal-scope={kind}
            data-vl-cal-entity={entityPk}
            cursor={openByClick ? "pointer" : undefined}
            onClick={
              openByClick
                ? (e) => {
                    e.stopPropagation();
                    openWindow(openPath);
                  }
                : undefined
            }
          >
            {showPeriodInCalendar && inPeriod && (
              <Box
                position="absolute"
                inset={0}
                bg={calPeriodOverlay}
                zIndex={0}
                pointerEvents="none"
              />
            )}
            {kind === "schedule" && isExFactoryDay && (
              <Box
                aria-hidden
                position="absolute"
                inset={0}
                zIndex={1}
                display="flex"
                alignItems="center"
                justifyContent="center"
                pointerEvents="none"
                opacity={0.28}
              >
                <Icon
                  as={FaTruck}
                  boxSize={{ base: "18px", md: "20px" }}
                  color={exFactoryTruckIconColor}
                  title={
                    scheduleExFactoryLabel
                      ? `${colLabels.ex_factory_1st}: ${scheduleExFactoryLabel}`
                      : colLabels.ex_factory_1st
                  }
                />
              </Box>
            )}
            {showPeriodInCalendar && isRStart && (
              <Box
                position="absolute"
                left={0}
                top={0}
                bottom={0}
                w="2px"
                bg={calEdge}
                zIndex={2}
                pointerEvents="none"
                borderRadius="sm"
              />
            )}
            {kind === "schedule" && showPeriodInCalendar && inPeriod && isRStart && (barStyleThumb || barStyleName) && (
              <Box
                position="absolute"
                left="4px"
                top="50%"
                transform="translateY(-50%)"
                display="flex"
                alignItems="center"
                gap="4px"
                zIndex={4}
                pointerEvents="none"
                whiteSpace="nowrap"
                overflow="visible"
                bg={barBg}
                borderRadius="sm"
                px="4px"
                py={isReadOnly ? "3px" : "8px"}
                boxShadow="0 1px 4px rgba(0,0,0,0.20)"
              >
                {barStyleThumb && (
                  <Box
                    as="img"
                    src={barStyleThumb}
                    w={isReadOnly ? "22px" : "26px"}
                    h={isReadOnly ? "22px" : "26px"}
                    sx={{ objectFit: "cover" }}
                    borderRadius="3px"
                    flexShrink={0}
                    boxShadow="0 1px 3px rgba(0,0,0,0.35)"
                    pointerEvents="auto"
                    cursor="pointer"
                    onClick={(e: React.MouseEvent) => { e.stopPropagation(); openPhoto(barStyleThumb!); }}
                  />
                )}
                <VStack spacing={0} align="flex-start" lineHeight="1.2">
                  {barStyleName && (
                    <Text
                      as="span"
                      fontSize="10px"
                      fontWeight="semibold"
                      color={barLabelColor}
                      lineHeight="1.2"
                    >
                      {barStyleName}
                    </Text>
                  )}
                  {(barOutputQty != null || barTotalQty != null) && (() => {
                    const balanceQty = barTotalQty != null
                      ? Math.max(0, barTotalQty - (barOutputQty ?? 0))
                      : null;
                    return (
                      <VStack spacing={0} align="flex-start">
                        <Text
                          as="span"
                          fontSize="9px"
                          fontWeight="medium"
                          color={barLabelColor}
                          lineHeight="1.2"
                          opacity={0.9}
                        >
                          {barOutputQty?.toLocaleString() ?? "—"}
                          {barTotalQty != null && ` / ${barTotalQty.toLocaleString()}`}
                          {barTotalQty != null && barTotalQty > 0 && barOutputQty != null &&
                            ` (${Math.round((barOutputQty / barTotalQty) * 100)}%)`}
                        </Text>
                        {balanceQty != null && (
                          <Text
                            as="span"
                            fontSize="9px"
                            color={barLabelColor}
                            lineHeight="1.2"
                            opacity={0.75}
                          >
                            {t("vlAssembly.list.balanceInBar", { qty: balanceQty.toLocaleString() })}
                          </Text>
                        )}
                      </VStack>
                    );
                  })()}
                </VStack>
              </Box>
            )}
            {showPeriodInCalendar && isREnd && (
              <Box
                position="absolute"
                right={0}
                top={0}
                bottom={0}
                w="2px"
                bg={calEdge}
                zIndex={2}
                pointerEvents="none"
                borderRadius="sm"
              />
            )}
            <Box
              position="relative"
              zIndex={3}
              px={1}
              py={0.5}
              w="100%"
              pointerEvents={canDrag ? "none" : "auto"}
            >
              <VStack
                align="stretch"
                spacing={1}
                lineHeight="1.1"
                w="100%"
                minH={hasPlanRow && showDailyQty ? "34px" : undefined}
                justify={hasPlanRow && showDailyQty ? "flex-start" : "center"}
              >
                {hasPlanRow && showDailyQty && (
                  <Box
                    w="100%"
                    minH="15px"
                    display="flex"
                    alignItems="center"
                    justifyContent="center"
                    flexShrink={0}
                  >
                    {jsDay !== 0 && !isPlanHolidayDay && planMeta != null && (
                      <Text
                        as="span"
                        fontSize="9px"
                        fontWeight="semibold"
                        color={calPlanText}
                        lineHeight="1.1"
                        textAlign="center"
                        title={t("vlAssembly.list.calendarPlanned8h", {
                          daily: planMeta.daily,
                        })}
                      >
                        {planMeta.daily.toLocaleString()}
                      </Text>
                    )}
                  </Box>
                )}
                {showDailyQty && (
                  <Box
                    w="100%"
                    textAlign="center"
                    lineHeight="1.1"
                    flexShrink={0}
                  >
                    <Text
                      as="span"
                      fontSize="xs"
                      color={hasQty ? undefined : "gray.300"}
                    >
                      {hasQty ? (q as number).toLocaleString() : "—"}
                    </Text>
                  </Box>
                )}
                {!showDailyQty && (
                  <Text
                    as="span"
                    fontSize="xs"
                    color="gray.300"
                    w="100%"
                    textAlign="center"
                  >
                    —
                  </Text>
                )}
              </VStack>
            </Box>
            {canDrag && (
              <HStack
                position="absolute"
                inset={0}
                zIndex={5}
                spacing={0}
                pointerEvents="auto"
                align="stretch"
              >
                {isRStart && (
                  <Box
                    w="10px"
                    flexShrink={0}
                    cursor="ew-resize"
                    title={t("vlAssembly.list.calendarDragResizeStart")}
                    onPointerDown={(e) =>
                      startCalendarRangeDrag("rs", rowDragCtx, col.y, col.m1, col.day, e)
                    }
                    onClick={(e) => e.stopPropagation()}
                  />
                )}
                <Box
                  flex="1"
                  minW={0}
                  cursor="grab"
                  _active={{ cursor: "grabbing" }}
                  title={t("vlAssembly.list.calendarDragMove")}
                  onPointerDown={(e) =>
                    startCalendarRangeDrag("mv", rowDragCtx, col.y, col.m1, col.day, e)
                  }
                  onClick={(e) => e.stopPropagation()}
                />
                {isREnd && (
                  <Box
                    w="10px"
                    flexShrink={0}
                    cursor="ew-resize"
                    title={t("vlAssembly.list.calendarDragResizeEnd")}
                    onPointerDown={(e) =>
                      startCalendarRangeDrag("re", rowDragCtx, col.y, col.m1, col.day, e)
                    }
                    onClick={(e) => e.stopPropagation()}
                  />
                )}
              </HStack>
            )}
          </Td>
        );
      });
    },
    [
      colLabels,
      calendarDayColumns,
      calendarDayHeaderMeta,
      calendarRangeDraft,
      exFactoryTruckIconColor,
      dailyQtyByModule,
      dailyQtyByProcess,
      dailyQtyBySchedule,
      dailyQtyBySjNo,
      fmtDate,
      moduleCalEdge,
      moduleCalPeriodOverlay,
      moduleCalPlanText,
      moduleCalendarFlagsByKey,
      processCalEdge,
      processCalPeriodOverlay,
      processCalPlanText,
      processCalendarFlagsByKey,
      calMonthBoundaryLine,
      satDayColBg,
      scheduleCalEdge,
      scheduleCalPeriodOverlay,
      scheduleCalPlanText,
      scheduleCalendarFlagsByKey,
      savingCalendar,
      startCalendarRangeDrag,
      planHolidayColBg,
      sunDayColBg,
      t,
      vlPlanHolidayNameByYmd,
      vlPlanHolidayYmdSet,
    ]
  );

  /** 선택한 달이 캘린더에서 가운데 월이 되도록 가로 스크롤 초기 위치 (이전 달 너비만큼 스킵) */
  useLayoutEffect(() => {
    const el = tableContainerRef.current;
    if (!el || monthBlocks.length < 2) return;
    const prevW = monthBlocks[0]!.days * CAL_COL_PX;
    el.scrollLeft = prevW;
  }, [selectedYear, selectedMonth, monthBlocks]);

  /** 월 헤더 라벨이 캘린더 영역 왼쪽 가장자리에 sticky 되도록 측정 */
  const firstDayHeaderRef = useRef<HTMLTableCellElement | null>(null);
  const [calLeftOffset, setCalLeftOffset] = useState<number>(40);
  useLayoutEffect(() => {
    const cell = firstDayHeaderRef.current;
    const container = tableContainerRef.current;
    if (!cell || !container) return;
    const update = () => {
      const cellRect = cell.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      const offset = cellRect.left - containerRect.left + container.scrollLeft;
      setCalLeftOffset((prev) => (Math.abs(prev - offset) < 0.5 ? prev : offset));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(cell);
    ro.observe(container);
    return () => ro.disconnect();
  }, [visibleCols, monthBlocks]);

  // 데이터 로드 후 세로/가로 스크롤 복원 (tableContainerRef 기반)
  useEffect(() => {
    if (!data) return;
    const savedY = Number(sessionStorage.getItem("ep_scrollY") ?? 0);
    const savedX = Number(sessionStorage.getItem("ep_scrollX") ?? 0);
    requestAnimationFrame(() => {
      const el = tableContainerRef.current;
      if (!el) return;
      if (savedY > 0) el.scrollTop = savedY;
      if (savedX > 0) el.scrollLeft = savedX;
    });
  }, [!!data]);

  const schedules = [...(data ?? [])].sort((a, b) => {
    if (!sortConfig) return 0;
    const { key, dir } = sortConfig;
    const getVal = (s: IVlAssemblySchedule) => {
      if (key === "ex_factory_1st") return s.sj_order_info?.ex_factory_date ?? "";
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

  const schedulesByLine = useMemo(
    () => buildVlSchedulesGroupedByProductionLine(schedules),
    [schedules]
  );



  const toggleSjNo = (pk: number) =>
    setExpandedSjNos((prev) => {
      const next = new Set(prev);
      if (next.has(pk)) next.delete(pk); else next.add(pk);
      return next;
    });

  const toggleSchedule = (pk: number) =>
    setExpandedSchedules((prev) => {
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
    const allSchedulePks = new Set(
      (data ?? []).filter((s) => (s.ep_sj_nos ?? []).length > 1).map((s) => s.pk)
    );
    setExpandedSjNos(allSjNoPks);
    setExpandedModules(allModulePks);
    setExpandedSchedules(allSchedulePks);
  };

  const collapseAll = () => {
    setExpandedSjNos(new Set());
    setExpandedModules(new Set());
    setExpandedSchedules(new Set());
  };

  const submitPlanHoliday = async () => {
    const fromSlice = planHolidayDateFrom.trim().slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fromSlice)) {
      toast({
        title: t("vlAssembly.list.planHolidayInvalidDate"),
        status: "warning",
        duration: 2500,
        position: "bottom-right",
      });
      return;
    }
    const toTrim = planHolidayDateTo.trim();
    let ymds: string[];
    if (!toTrim) {
      ymds = [fromSlice];
    } else {
      const toSlice = toTrim.slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(toSlice)) {
        toast({
          title: t("vlAssembly.list.planHolidayInvalidDate"),
          status: "warning",
          duration: 2500,
          position: "bottom-right",
        });
        return;
      }
      ymds = enumerateInclusivePlanHolidayYmds(fromSlice, toSlice);
      if (ymds.length === 0) {
        toast({
          title: t("vlAssembly.list.planHolidayInvalidDate"),
          status: "warning",
          duration: 2500,
          position: "bottom-right",
        });
        return;
      }
    }
    if (ymds.length > PLAN_HOLIDAY_MAX_RANGE_DAYS) {
      toast({
        title: t("vlAssembly.list.planHolidayRangeTooLong", {
          max: PLAN_HOLIDAY_MAX_RANGE_DAYS,
        }),
        status: "warning",
        duration: 3500,
        position: "bottom-right",
      });
      return;
    }
    const nameTrim = planHolidayFormName.trim();
    setPlanHolidaySaving(true);
    try {
      const bodyName = nameTrim || undefined;
      for (const d of ymds) {
        await upsertVlPlanHoliday({ date: d, name: bodyName });
      }
      await queryClient.invalidateQueries({ queryKey: vlKeys.planHolidays() });
      setPlanHolidayDateFrom("");
      setPlanHolidayDateTo("");
      setPlanHolidayFormName("");
      toast({
        title:
          ymds.length === 1
            ? t("vlAssembly.list.planHolidaySaved")
            : t("vlAssembly.list.planHolidaySavedMany", {
                count: ymds.length,
              }),
        status: "success",
        duration: ymds.length === 1 ? 2000 : 2800,
        position: "bottom-right",
      });
    } catch {
      toast({
        title: t("vlAssembly.common.failedSave"),
        status: "error",
        duration: 2500,
        position: "bottom-right",
      });
    } finally {
      setPlanHolidaySaving(false);
    }
  };

  const removePlanHoliday = async (pk: number) => {
    try {
      await deleteVlPlanHoliday(pk);
      await queryClient.invalidateQueries({ queryKey: vlKeys.planHolidays() });
      toast({
        title: t("vlAssembly.list.planHolidayDeleted"),
        status: "success",
        duration: 2000,
        position: "bottom-right",
      });
    } catch {
      toast({
        title: t("vlAssembly.common.failedSave"),
        status: "error",
        duration: 2500,
        position: "bottom-right",
      });
    }
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
      await editVlAssemblySchedule(pk, { production_assembly_output_qty: qty });
      queryClient.invalidateQueries({ queryKey: vlKeys.all() });
    } catch { /* ignore */ }
    setEditingAssemblyOutQty(null);
  };

  const saveActualInboundQty = async (pk: number, val: string) => {
    const qty = val === "" ? null : parseInt(val, 10);
    if (val !== "" && isNaN(qty!)) { setEditingActualInboundQty(null); return; }
    try {
      await editVlAssemblySchedule(pk, { actual_inbound_prep_material_qty: qty });
      queryClient.invalidateQueries({ queryKey: vlKeys.all() });
    } catch { /* ignore */ }
    setEditingActualInboundQty(null);
  };

  const saveModuleQty = async (pk: number, val: string, totalQty?: number | null) => {
    const qty = val === "" ? 0 : parseInt(val, 10);
    if (val !== "" && isNaN(qty!)) { setEditingModuleQty(null); return; }
    if (totalQty != null && qty > totalQty) {
      toast({ title: t("vlAssembly.common.outputExceedsTotal", { total: totalQty.toLocaleString() }), status: "warning", duration: 2500, position: "bottom-right" });
      setEditingModuleQty(null);
      return;
    }
    try {
      await patchVlAssemblyModule(pk, { output_qty: qty });
      queryClient.invalidateQueries({ queryKey: vlKeys.all() });
    } catch { /* ignore */ }
    setEditingModuleQty(null);
  };

  const saveProcessQty = async (pk: number, val: string, totalQty?: number | null) => {
    const qty = val === "" ? 0 : parseInt(val, 10);
    if (val !== "" && isNaN(qty!)) { setEditingProcessQty(null); return; }
    if (totalQty != null && qty > totalQty) { setEditingProcessQty(null); return; }
    try {
      await patchVlAssemblyProcess(pk, { output_qty: qty });
      queryClient.invalidateQueries({ queryKey: vlKeys.all() });
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
      await patchVlAssemblyModule(pk, { [field]: val || null } as any);
      await queryClient.invalidateQueries({ queryKey: vlKeys.all() });
      await queryClient.invalidateQueries({ queryKey: vlKeys.moduleDailyOutputsCalendar() });
      broadcastVlAssemblyScheduleListCacheBust();
    } catch { /* ignore */ }
    setEditingModuleDate(null);
  };

  const saveProcessDate = async (pk: number, field: "process_start_date" | "process_finish_date", val: string) => {
    try {
      await patchVlAssemblyProcess(pk, { [field]: val || null } as any);
      await queryClient.invalidateQueries({ queryKey: vlKeys.all() });
      await queryClient.invalidateQueries({ queryKey: vlKeys.processDailyOutputsCalendar() });
      broadcastVlAssemblyScheduleListCacheBust();
    } catch { /* ignore */ }
    setEditingProcessDate(null);
  };

  const saveSjNoStatus = async (pk: number, val: string) => {
    setSavingStatusPk(pk);
    try {
      await patchVlAssemblySjNo(pk, { status: val });
      queryClient.invalidateQueries({ queryKey: vlKeys.all() });
    } catch { /* ignore */ }
    setSavingStatusPk(null);
  };

  const saveModuleStatus = async (pk: number, val: string) => {
    setSavingStatusPk(pk);
    try {
      await patchVlAssemblyModule(pk, { status: val });
      queryClient.invalidateQueries({ queryKey: vlKeys.all() });
    } catch { /* ignore */ }
    setSavingStatusPk(null);
  };

  const saveProcessStatus = async (pk: number, val: string) => {
    setSavingStatusPk(pk);
    try {
      await patchVlAssemblyProcess(pk, { status: val });
      queryClient.invalidateQueries({ queryKey: vlKeys.all() });
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
    if (form.sj_order_ids.length === 0) {
      toast({ title: t("vlAssembly.list.sjOrderRequired"), status: "warning", duration: 2000, position: "bottom-right" });
      return;
    }
    if (form.module_category_ids.length === 0) {
      toast({
        title: t("vlAssembly.list.moduleCategoryRequired"),
        status: "warning",
        duration: 2000,
        position: "bottom-right",
      });
      return;
    }
    setIsSaving(true);
    try {
      const exTrim = String(form.ex_factory_date ?? "").trim();
      await createVlAssemblySchedule({
        sj_order_ids: form.sj_order_ids,
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
      toast({ title: t("vlAssembly.list.scheduleCreated"), status: "success", duration: 2000, position: "bottom-right" });
      queryClient.invalidateQueries({ queryKey: vlKeys.all() });
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
        flexShrink={0}
        cursor="pointer"
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

  const HideColBtn = ({ colKey }: { colKey: ColKey }) => (
    <Tooltip label="Hide column" placement="top">
      <Box
        as="span"
        display="inline-flex"
        flexShrink={0}
        cursor="pointer"
        ml="4px"
        color="gray.300"
        _hover={{ color: "orange.400" }}
        onClick={(e: React.MouseEvent) => { e.stopPropagation(); toggleColAndSave(colKey); }}
        transition="color 0.15s"
      >
        <FaEyeSlash size={10} />
      </Box>
    </Tooltip>
  );

  /**
   * 선택된 컬럼의 좌/우 가장자리에 표시되는 리사이즈 핸들.
   * side="left" → 왼쪽 경계 이동 (direction=-1), side="right" → 오른쪽 경계 이동 (direction=1).
   * 더블클릭 시 기본 너비로 초기화.
   */
  const ResizeHandle = ({ colKey, side }: { colKey: ColKey; side: "left" | "right" }) => {
    const isSelected = selectedColKey === colKey;
    if (!isSelected) return null;
    const direction: 1 | -1 = side === "right" ? 1 : -1;
    return (
      <Box
        as="span"
        position="absolute"
        {...(side === "right" ? { right: 0 } : { left: 0 })}
        top={0}
        bottom={0}
        w="8px"
        cursor="col-resize"
        zIndex={30}
        display="flex"
        alignItems="center"
        justifyContent="center"
        onMouseDown={(e: React.MouseEvent) => {
          e.preventDefault();
          e.stopPropagation();
          startColResize(colKey, e.clientX, direction);
        }}
        onDoubleClick={(e: React.MouseEvent) => {
          e.stopPropagation();
          setColumnWidths(prev => {
            const next = { ...prev, [colKey]: COLUMN_WIDTHS[colKey] ?? 100 };
            try { localStorage.setItem("vlAssembly_columnWidths", JSON.stringify(next)); } catch {}
            return next;
          });
        }}
        sx={{ touchAction: "none" }}
      />
    );
  };

  /**
   * Header cell content wrapper: label truncates with ellipsis when space is tight.
   * 클릭 시 컬럼이 선택되며 양쪽에 리사이즈 핸들이 표시됩니다.
   */
  const ColTh = ({
    colKey,
    extra,
    children,
  }: {
    colKey: ColKey;
    extra?: React.ReactNode;
    children: React.ReactNode;
  }) => {
    return (
      <Box
        display="flex"
        alignItems="center"
        w="100%"
        overflow="visible"
        gap={1}
        px="2px"
        onClick={(e: React.MouseEvent) => {
          e.stopPropagation();
          setSelectedColKey(prev => (prev === colKey ? null : colKey));
        }}
        cursor="default"
      >
        <Box
          flex={1}
          minW={0}
          overflow="hidden"
          textOverflow="ellipsis"
          whiteSpace="nowrap"
          as="span"
          display="inline-flex"
          alignItems="center"
          gap={1}
        >
          {children}
          {extra}
        </Box>
        <PinBtn colKey={colKey} />
        <HideColBtn colKey={colKey} />
        <ResizeHandle colKey={colKey} side="left" />
        <ResizeHandle colKey={colKey} side="right" />
      </Box>
    );
  };

  return (
    <>
      <Helmet><title>VL Assembly Production</title></Helmet>
      <Box bg={pageBg} minW="100%" display="flex" flexDirection="column" px={isReadOnly ? 2 : { base: "4", md: "8", lg: "12" }} pt={isReadOnly ? 2 : { base: "6", md: "8" }} pb={isReadOnly ? 2 : 10}>

          {/* ── 월별 네비게이션 ── */}
          <HStack justify="center" align="center" mb={isReadOnly ? 1 : 5} spacing={1} sx={{ flexWrap: "wrap" }}>
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
          {!isReadOnly ? (
            <HStack justify="space-between" align="center" mb={5}>
              <Heading size="md">{t("vlAssembly.list.pageTitle")}</Heading>
              <SearchInput
                onSearch={(q) => setSearchQuery(q)}
                onInputChange={(v) => { if (v === "") setSearchQuery(""); }}
              />
            </HStack>
          ) : (
            <HStack justify="flex-end" mb={2}>
              <SearchInput
                onSearch={(q) => setSearchQuery(q)}
                onInputChange={(v) => { if (v === "") setSearchQuery(""); }}
              />
            </HStack>
          )}

          <HStack justify="space-between" align="center" mb={isReadOnly ? 1 : 6}>
            {!isReadOnly && <Text fontSize="sm" color="gray.500">
              {t("vlAssembly.list.totalSchedules", { count: schedules.length })}
            </Text>}
            {isReadOnly && <Box />}
            <HStack spacing={2}>
              {/* 앞쪽 정보 컬럼 접기 / 펼치기 */}
              <Tooltip label={infoCollapsed ? t("vlAssembly.list.showInfoCols") : t("vlAssembly.list.hideInfoCols")} placement="top">
                <IconButton
                  aria-label={infoCollapsed ? t("vlAssembly.list.showInfoCols") : t("vlAssembly.list.hideInfoCols")}
                  icon={infoCollapsed ? <FaAngleDoubleRight /> : <FaAngleDoubleLeft />}
                  size="sm"
                  variant={infoCollapsed ? "solid" : "outline"}
                  colorScheme={infoCollapsed ? "blue" : "gray"}
                  onClick={() => setInfoCollapsed((v) => !v)}
                />
              </Tooltip>

              {/* 전체 펼치기 / 접기 */}
              <Tooltip label={isAllExpanded ? t("vlAssembly.list.collapseAll") : t("vlAssembly.list.expandAll")} placement="top">
                <IconButton
                  aria-label={isAllExpanded ? t("vlAssembly.list.collapseAll") : t("vlAssembly.list.expandAll")}
                  icon={isAllExpanded ? <FaCompressAlt /> : <FaExpandAlt />}
                  size="sm"
                  variant="outline"
                  colorScheme="gray"
                  onClick={isAllExpanded ? collapseAll : expandAll}
                />
              </Tooltip>

              {!isReadOnly && (
                <Tooltip label={t("vlAssembly.list.planHolidaysButtonHint")} placement="top">
                  <Button
                    size="sm"
                    variant="outline"
                    colorScheme="gray"
                    leftIcon={<FaCalendarMinus />}
                    onClick={onPlanHolidayModalOpen}
                  >
                    {t("vlAssembly.list.planHolidaysButton")}
                  </Button>
                </Tooltip>
              )}

              {/* 컬럼 가시성 설정 */}
              {!isReadOnly && <Popover placement="bottom-end" isLazy isOpen={isColPopoverOpen} onClose={onColPopoverClose}>
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
                    {t("vlAssembly.list.columnSettings")}
                  </PopoverHeader>
                  <PopoverCloseButton />
                  <PopoverBody pb={4}>
                    <HStack mb={3} spacing={2}>
                      <Button size="xs" variant="outline" onClick={showAll}>{t("vlAssembly.list.showAll")}</Button>
                      <Button size="xs" variant="outline" onClick={hideAll}>{t("vlAssembly.list.hideAll")}</Button>
                    </HStack>
                    <Divider mb={3} />
                    <SimpleGrid columns={2} spacing={2} mb={4}>
                      {ALL_COLUMNS.map((col) => (
                        <HStack key={col.key} spacing={1} align="center">
                          <Checkbox
                            isChecked={vis(col.key)}
                            onChange={() => toggleCol(col.key)}
                            size="sm"
                            opacity={vis(col.key) ? 1 : 0.45}
                            flex={1}
                          >
                            <Text fontSize="xs" textDecoration={vis(col.key) ? undefined : "line-through"}>
                              {colLabels[col.key]}
                            </Text>
                          </Checkbox>
                          <Tooltip label={isPinned(col.key) ? t("vlAssembly.list.unpinColumn") : t("vlAssembly.list.pinColumn")} placement="top">
                            <Box
                              as="span"
                              display="inline-flex"
                              cursor="pointer"
                              color={isPinned(col.key) ? "blue.400" : "gray.200"}
                              _hover={{ color: isPinned(col.key) ? "blue.600" : "gray.400" }}
                              onClick={() => togglePin(col.key)}
                              transform={isPinned(col.key) ? "rotate(0deg)" : "rotate(45deg)"}
                              transition="transform 0.15s, color 0.15s"
                              flexShrink={0}
                            >
                              <FaThumbtack size={10} />
                            </Box>
                          </Tooltip>
                        </HStack>
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
                      {t("vlAssembly.list.saveSettings")}
                    </Button>
                  </PopoverBody>
                </PopoverContent>
              </Popover>}

              {/* 신규 생성 */}
              {!isReadOnly && (
                <IconButton
                  aria-label="Create schedule"
                  icon={<FaPlus />}
                  colorScheme="blue"
                  size="sm"
                  onClick={() => { resetModal(); onOpen(); }}
                />
              )}
            </HStack>
          </HStack>

          {/* 테이블 상단 커스텀 가로 스크롤바 */}
          {(() => {
            const { scrollLeft, scrollWidth, clientWidth } = tableScrollInfo;
            const scrollable = scrollWidth > clientWidth + 1;
            const thumbW = scrollable ? Math.max(40, (clientWidth / scrollWidth) * clientWidth) : 0;
            const thumbL = scrollable
              ? (scrollLeft / (scrollWidth - clientWidth)) * (clientWidth - thumbW)
              : 0;
            return (
              <Box
                flexShrink={0}
                position="sticky"
                top={0}
                zIndex={21}
                h="16px"
                bg={scrollbarTrackBg}
                borderBottom="2px solid"
                borderBottomColor="blue.400"
                overflow="hidden"
                cursor={scrollable ? "pointer" : "default"}
                onMouseEnter={() => setIsScrollbarHovered(true)}
                onMouseLeave={() => setIsScrollbarHovered(false)}
                onClick={(e: React.MouseEvent<HTMLDivElement>) => {
                  const table = tableContainerRef.current;
                  if (!table || !scrollable) return;
                  const rect = e.currentTarget.getBoundingClientRect();
                  const clickX = e.clientX - rect.left - thumbW / 2;
                  table.scrollLeft = Math.max(0, Math.min(scrollWidth - clientWidth, (clickX / (clientWidth - thumbW)) * (scrollWidth - clientWidth)));
                }}
              >
                {scrollable && (
                  <Box
                    position="absolute"
                    top="3px"
                    bottom="3px"
                    left={`${thumbL}px`}
                    w={`${thumbW}px`}
                    bg="blue.400"
                    borderRadius="6px"
                    opacity={isScrollbarHovered ? 0.9 : 0}
                    transition="opacity 0.18s"
                    cursor="grab"
                    _active={{ cursor: "grabbing", bg: "blue.500" }}
                    onMouseDown={(e: React.MouseEvent) => {
                      e.preventDefault();
                      e.stopPropagation();
                      startThumbDrag(e.clientX);
                    }}
                  />
                )}
              </Box>
            );
          })()}

          {/* ── 테이블 ── */}
          <Box
            ref={tableContainerRef}
            position="sticky"
            top="16px"
            h="calc(100vh - 16px)"
            overflowX="auto"
            overflowY="auto"
            sx={{
              whiteSpace: "nowrap",
              "&::-webkit-scrollbar:horizontal": { display: "none" },
            }}
          >
            <Table variant="simple" size="sm">
              <Thead bgColor={tableBgColor} position="sticky" top={0} zIndex={20}>
                <Tr>
                  <Th
                    w="40px"
                    px={1}
                    position="sticky"
                    left={0}
                    top={0}
                    zIndex={60}
                    bgColor={tableBgColor}
                    borderBottomWidth="1px"
                    borderBottomColor="blackAlpha.200"
                    boxShadow={isReadOnly ? undefined : "2px 0 4px rgba(0,0,0,0.08)"}
                  />
                  {!isReadOnly && visibleCount > 1 && (
                    <Th
                      colSpan={visibleCount - 1}
                      position="sticky"
                      left="40px"
                      top={0}
                      zIndex={59}
                      bgColor={tableBgColor}
                      borderBottomWidth="1px"
                      borderBottomColor="blackAlpha.200"
                      py={1.5}
                      boxShadow="2px 0 4px rgba(0,0,0,0.08)"
                    />
                  )}
                  {calendarMonthBlockHeaders.map((h) => {
                    const barBg =
                      h.blockIndex === 0
                        ? calMonthBarBgPrev
                        : h.blockIndex === 1
                          ? calMonthBarBgSelected
                          : calMonthBarBgNext;
                    const barText =
                      h.blockIndex === 0
                        ? calMonthBarTextPrev
                        : h.blockIndex === 1
                          ? calMonthBarTextSelected
                          : calMonthBarTextNext;
                    return (
                      <Th
                        key={`cal-month-band-${h.year}-${h.month}`}
                        colSpan={h.days}
                        textAlign="left"
                        verticalAlign="middle"
                        color={barText}
                        py={1.5}
                        px={0}
                        bgColor={barBg}
                        position="sticky"
                        top={0}
                        zIndex={1}
                        borderBottomWidth="2px"
                        borderBottomColor={h.blockIndex === 1 ? "blue.400" : "gray.400"}
                        borderLeftWidth={h.blockIndex > 0 ? "1px" : undefined}
                        borderLeftColor={h.blockIndex > 0 ? calMonthBoundaryLine : undefined}
                      >
                        <Box
                          position="sticky"
                          left={`${calLeftOffset}px`}
                          display="inline-flex"
                          alignItems="baseline"
                          gap={1.5}
                          px={3}
                        >
                          <Text
                            as="span"
                            fontSize="lg"
                            fontWeight="extrabold"
                            letterSpacing="wider"
                            lineHeight="1.1"
                          >
                            {h.labelShort}
                          </Text>
                          <Text
                            as="span"
                            fontSize="xs"
                            fontWeight="semibold"
                            opacity={0.85}
                            lineHeight="1.1"
                          >
                            {h.labelYear}
                          </Text>
                        </Box>
                      </Th>
                    );
                  })}
                </Tr>
                <Tr>
                  <Th w="40px" px={1} position="sticky" left={0} top="38px" zIndex={55} bgColor={tableBgColor} />
                  {columnOrder.map(key => {
                    const dragProps = {
                      draggable: true as const,
                      onDragStart: () => handleColDragStart(key),
                      onDragOver: (e: React.DragEvent) => handleColDragOver(e, key),
                      onDrop: () => handleColDrop(key),
                      onDragEnd: handleColDragEnd,
                      outline: dragOverColKey === key && dragColKey !== key ? "2px solid var(--chakra-colors-blue-400)" : undefined,
                      cursor: "grab" as const,
                    };
                    switch (key) {
                      case "production_line": return visInfo("production_line") ? (
                        <Th key={key} whiteSpace="nowrap" {...colStickyProps("production_line", tableBgColor, "38px")} {...dragProps}>
                          <ColTh colKey="production_line">{colLabels["production_line"]}</ColTh>
                        </Th>
                      ) : null;
                      case "sj_po_number": return vis("sj_po_number") ? (
                        <Th key={key} whiteSpace="nowrap" {...colStickyProps("sj_po_number", tableBgColor, "38px")} {...dragProps}>
                          <ColTh colKey="sj_po_number">{colLabels["sj_po_number"]}</ColTh>
                        </Th>
                      ) : null;
                      case "sj_no": return visInfo("sj_no") ? (
                        <Th key={key} whiteSpace="nowrap" {...colStickyProps("sj_no", tableBgColor, "38px")} {...dragProps}>
                          <ColTh colKey="sj_no">{colLabels["sj_no"]}</ColTh>
                        </Th>
                      ) : null;
                      case "color": return visInfo("color") ? (
                        <Th key={key} {...colStickyProps("color", tableBgColor, "38px")} {...dragProps}>
                          <ColTh colKey="color">{colLabels["color"]}</ColTh>
                        </Th>
                      ) : null;
                      case "total_qty": return visInfo("total_qty") ? (
                        <Th key={key} isNumeric whiteSpace="nowrap" {...colStickyProps("total_qty", tableBgColor, "38px")} {...dragProps}>
                          <ColTh colKey="total_qty">{colLabels["total_qty"]}</ColTh>
                        </Th>
                      ) : null;
                      case "assembly_output_qty": return visInfo("assembly_output_qty") ? (
                        <Th key={key} isNumeric whiteSpace="nowrap" {...colStickyProps("assembly_output_qty", tableBgColor, "38px")} {...dragProps}>
                          <ColTh colKey="assembly_output_qty">{colLabels["assembly_output_qty"]}</ColTh>
                        </Th>
                      ) : null;
                      case "ex_factory_1st": return visInfo("ex_factory_1st") ? (
                        <Th key={key} whiteSpace="nowrap" userSelect="none" onClick={() => toggleSort("ex_factory_1st")} _hover={{ bg: "gray.200" }} {...colStickyProps("ex_factory_1st", tableBgColor, "38px")} {...dragProps} cursor="pointer">
                          <ColTh colKey="ex_factory_1st" extra={sortIcon("ex_factory_1st")}>{colLabels["ex_factory_1st"]}</ColTh>
                        </Th>
                      ) : null;
                      case "ex_factory_2nd": return vis("ex_factory_2nd") ? (
                        <Th key={key} whiteSpace="nowrap" {...colStickyProps("ex_factory_2nd", tableBgColor, "38px")} {...dragProps}><ColTh colKey="ex_factory_2nd">{colLabels["ex_factory_2nd"]}</ColTh></Th>
                      ) : null;
                      case "ex_country": return vis("ex_country") ? (
                        <Th key={key} whiteSpace="nowrap" {...colStickyProps("ex_country", tableBgColor, "38px")} {...dragProps}><ColTh colKey="ex_country">{colLabels["ex_country"]}</ColTh></Th>
                      ) : null;
                      case "air_or_vessel": return vis("air_or_vessel") ? (
                        <Th key={key} whiteSpace="nowrap" {...colStickyProps("air_or_vessel", tableBgColor, "38px")} {...dragProps}><ColTh colKey="air_or_vessel">{colLabels["air_or_vessel"]}</ColTh></Th>
                      ) : null;
                      case "ef_buffer": return vis("ef_buffer") ? (
                        <Th key={key} whiteSpace="nowrap" {...colStickyProps("ef_buffer", tableBgColor, "38px")} bg="purple.50" _dark={{ bg: "purple.900" }} {...dragProps}>
                          <ColTh colKey="ef_buffer" extra={<EfBufferLegend />}>{colLabels["ef_buffer"]}</ColTh>
                        </Th>
                      ) : null;
                      case "schedule_spi": return vis("schedule_spi") ? (
                        <Th key={key} whiteSpace="nowrap" {...colStickyProps("schedule_spi", tableBgColor, "38px")} bg="purple.50" _dark={{ bg: "purple.900" }} {...dragProps}>
                          <ColTh colKey="schedule_spi" extra={<SpiLegend />}>{colLabels["schedule_spi"]}</ColTh>
                        </Th>
                      ) : null;
                      case "assembly_start": return visInfo("assembly_start") ? (
                        <Th key={key} whiteSpace="nowrap" userSelect="none" onClick={() => toggleSort("assembly_start")} _hover={{ bg: "gray.200" }} {...colStickyProps("assembly_start", tableBgColor, "38px")} {...dragProps} cursor="pointer">
                          <ColTh colKey="assembly_start" extra={sortIcon("assembly_start")}>{colLabels["assembly_start"]}</ColTh>
                        </Th>
                      ) : null;
                      case "assembly_finish": return visInfo("assembly_finish") ? (
                        <Th key={key} whiteSpace="nowrap" {...colStickyProps("assembly_finish", tableBgColor, "38px")} {...dragProps}>
                          <ColTh colKey="assembly_finish">{colLabels["assembly_finish"]}</ColTh>
                        </Th>
                      ) : null;
                      case "flow_memo": return vis("flow_memo") ? (
                        <Th key={key} whiteSpace="nowrap" {...colStickyProps("flow_memo", tableBgColor, "38px")} {...dragProps}><ColTh colKey="flow_memo">{colLabels["flow_memo"]}</ColTh></Th>
                      ) : null;
                      case "category": return vis("category") ? (
                        <Th key={key} whiteSpace="nowrap" {...colStickyProps("category", tableBgColor, "38px")} {...dragProps}><ColTh colKey="category">{colLabels["category"]}</ColTh></Th>
                      ) : null;
                      case "sub_category": return vis("sub_category") ? (
                        <Th key={key} whiteSpace="nowrap" {...colStickyProps("sub_category", tableBgColor, "38px")} {...dragProps}><ColTh colKey="sub_category">{colLabels["sub_category"]}</ColTh></Th>
                      ) : null;
                      case "media": return vis("media") ? (
                        <Th key={key} {...colStickyProps("media", tableBgColor, "38px")} {...dragProps}><ColTh colKey="media">{colLabels["media"]}</ColTh></Th>
                      ) : null;
                      case "work_order": return vis("work_order") ? (
                        <Th key={key} whiteSpace="nowrap" {...colStickyProps("work_order", tableBgColor, "38px")} {...dragProps}><ColTh colKey="work_order">{colLabels["work_order"]}</ColTh></Th>
                      ) : null;
                      case "code": return vis("code") ? (
                        <Th key={key} whiteSpace="nowrap" {...colStickyProps("code", tableBgColor, "38px")} {...dragProps}><ColTh colKey="code">{colLabels["code"]}</ColTh></Th>
                      ) : null;
                      case "style_name": return vis("style_name") ? (
                        <Th key={key} whiteSpace="nowrap" {...colStickyProps("style_name", tableBgColor, "38px")} {...dragProps}><ColTh colKey="style_name">{colLabels["style_name"]}</ColTh></Th>
                      ) : null;
                      case "today_output_qty": return vis("today_output_qty") ? (
                        <Th key={key} isNumeric whiteSpace="nowrap" {...colStickyProps("today_output_qty", tableBgColor, "38px")} bg="teal.50" _dark={{ bg: "teal.900" }} {...dragProps}><ColTh colKey="today_output_qty"><Text as="span" color="teal.700" _dark={{ color: "teal.200" }}>{colLabels["today_output_qty"]}</Text></ColTh></Th>
                      ) : null;
                      case "output_qty": return vis("output_qty") ? (
                        <Th key={key} isNumeric whiteSpace="nowrap" {...colStickyProps("output_qty", tableBgColor, "38px")} {...dragProps}><ColTh colKey="output_qty">{colLabels["output_qty"]}</ColTh></Th>
                      ) : null;
                      case "defect_qty": return vis("defect_qty") ? (
                        <Th key={key} isNumeric whiteSpace="nowrap" {...colStickyProps("defect_qty", tableBgColor, "38px")} {...dragProps}><ColTh colKey="defect_qty">{colLabels["defect_qty"]}</ColTh></Th>
                      ) : null;
                      case "balance_qty": return vis("balance_qty") ? (
                        <Th key={key} isNumeric whiteSpace="nowrap" {...colStickyProps("balance_qty", tableBgColor, "38px")} {...dragProps}><ColTh colKey="balance_qty">{colLabels["balance_qty"]}</ColTh></Th>
                      ) : null;
                      case "daily_required_qty": return vis("daily_required_qty") ? (
                        <Th key={key} whiteSpace="nowrap" {...colStickyProps("daily_required_qty", tableBgColor, "38px")} {...dragProps}><ColTh colKey="daily_required_qty" extra={<DailyReqLegend />}>{colLabels["daily_required_qty"]}</ColTh></Th>
                      ) : null;
                      case "progress": return vis("progress") ? (
                        <Th key={key} {...colStickyProps("progress", tableBgColor, "38px")} {...dragProps}><ColTh colKey="progress">{colLabels["progress"]}</ColTh></Th>
                      ) : null;
                      case "status": return vis("status") ? (
                        <Th key={key} {...colStickyProps("status", tableBgColor, "38px")} {...statusColumnWidthProps} {...dragProps}><ColTh colKey="status">{colLabels["status"]}</ColTh></Th>
                      ) : null;
                      case "cycle_time": return vis("cycle_time") ? (
                        <Th key={key} isNumeric whiteSpace="nowrap" {...colStickyProps("cycle_time", tableBgColor, "38px")} {...dragProps}><ColTh colKey="cycle_time">{colLabels["cycle_time"]}</ColTh></Th>
                      ) : null;
                      case "target_per_hour": return vis("target_per_hour") ? (
                        <Th key={key} isNumeric whiteSpace="nowrap" {...colStickyProps("target_per_hour", tableBgColor, "38px")} {...dragProps}><ColTh colKey="target_per_hour">{colLabels["target_per_hour"]}</ColTh></Th>
                      ) : null;
                      case "daily_target": return vis("daily_target") ? (
                        <Th key={key} isNumeric whiteSpace="nowrap" {...colStickyProps("daily_target", tableBgColor, "38px")} {...dragProps}><ColTh colKey="daily_target">{colLabels["daily_target"]}</ColTh></Th>
                      ) : null;
                      case "process_start": return vis("process_start") ? (
                        <Th key={key} whiteSpace="nowrap" {...colStickyProps("process_start", tableBgColor, "38px")} {...dragProps}><ColTh colKey="process_start">{colLabels["process_start"]}</ColTh></Th>
                      ) : null;
                      case "process_finish": return vis("process_finish") ? (
                        <Th key={key} whiteSpace="nowrap" {...colStickyProps("process_finish", tableBgColor, "38px")} {...dragProps}><ColTh colKey="process_finish">{colLabels["process_finish"]}</ColTh></Th>
                      ) : null;
                      case "lead_time": return vis("lead_time") ? (
                        <Th key={key} isNumeric whiteSpace="nowrap" {...colStickyProps("lead_time", tableBgColor, "38px")} {...dragProps}><ColTh colKey="lead_time">{colLabels["lead_time"]}</ColTh></Th>
                      ) : null;
                      case "po_date": return vis("po_date") ? (
                        <Th key={key} whiteSpace="nowrap" {...colStickyProps("po_date", tableBgColor, "38px")} {...dragProps}><ColTh colKey="po_date">{colLabels["po_date"]}</ColTh></Th>
                      ) : null;
                      case "material_due_inbound": return vis("material_due_inbound") ? (
                        <Th key={key} whiteSpace="nowrap" {...colStickyProps("material_due_inbound", tableBgColor, "38px")} {...dragProps}><ColTh colKey="material_due_inbound">{colLabels["material_due_inbound"]}</ColTh></Th>
                      ) : null;
                      case "expected_inbound": return vis("expected_inbound") ? (
                        <Th key={key} whiteSpace="nowrap" userSelect="none" onClick={() => toggleSort("expected_inbound")} _hover={{ bg: "gray.200" }} {...colStickyProps("expected_inbound", tableBgColor, "38px")} {...dragProps} cursor="pointer"><ColTh colKey="expected_inbound" extra={sortIcon("expected_inbound")}>{colLabels["expected_inbound"]}</ColTh></Th>
                      ) : null;
                      case "actual_inbound_qty": return vis("actual_inbound_qty") ? (
                        <Th key={key} isNumeric whiteSpace="nowrap" {...colStickyProps("actual_inbound_qty", tableBgColor, "38px")} {...dragProps}><ColTh colKey="actual_inbound_qty">{colLabels["actual_inbound_qty"]}</ColTh></Th>
                      ) : null;
                      case "cutting_start_date": return vis("cutting_start_date") ? (
                        <Th key={key} whiteSpace="nowrap" {...colStickyProps("cutting_start_date", tableBgColor, "38px")} {...dragProps}><ColTh colKey="cutting_start_date">{colLabels["cutting_start_date"]}</ColTh></Th>
                      ) : null;
                      case "vien_laser": return vis("vien_laser") ? (
                        <Th key={key} whiteSpace="nowrap" {...colStickyProps("vien_laser", tableBgColor, "38px")} {...dragProps}><ColTh colKey="vien_laser">{colLabels["vien_laser"]}</ColTh></Th>
                      ) : null;
                      case "printing_folding": return vis("printing_folding") ? (
                        <Th key={key} whiteSpace="nowrap" {...colStickyProps("printing_folding", tableBgColor, "38px")} {...dragProps}><ColTh colKey="printing_folding">{colLabels["printing_folding"]}</ColTh></Th>
                      ) : null;
                      case "sub_tg": return vis("sub_tg") ? (
                        <Th key={key} whiteSpace="nowrap" {...colStickyProps("sub_tg", tableBgColor, "38px")} {...dragProps}><ColTh colKey="sub_tg">{colLabels["sub_tg"]}</ColTh></Th>
                      ) : null;
                      case "sub_vl": return vis("sub_vl") ? (
                        <Th key={key} whiteSpace="nowrap" {...colStickyProps("sub_vl", tableBgColor, "38px")} {...dragProps}><ColTh colKey="sub_vl">{colLabels["sub_vl"]}</ColTh></Th>
                      ) : null;
                      case "pre": return vis("pre") ? (
                        <Th key={key} whiteSpace="nowrap" {...colStickyProps("pre", tableBgColor, "38px")} {...dragProps}><ColTh colKey="pre">{colLabels["pre"]}</ColTh></Th>
                      ) : null;
                      case "scom": return vis("scom") ? (
                        <Th key={key} whiteSpace="nowrap" {...colStickyProps("scom", tableBgColor, "38px")} {...dragProps}><ColTh colKey="scom">{colLabels["scom"]}</ColTh></Th>
                      ) : null;
                      case "expected_date_finished": return vis("expected_date_finished") ? (
                        <Th key={key} whiteSpace="nowrap" {...colStickyProps("expected_date_finished", tableBgColor, "38px")} {...dragProps}><ColTh colKey="expected_date_finished">{colLabels["expected_date_finished"]}</ColTh></Th>
                      ) : null;
                      case "ex_fty_from_today": return vis("ex_fty_from_today") ? (
                        <Th key={key} isNumeric whiteSpace="nowrap" {...colStickyProps("ex_fty_from_today", tableBgColor, "38px")} {...dragProps}><ColTh colKey="ex_fty_from_today">{colLabels["ex_fty_from_today"]}</ColTh></Th>
                      ) : null;
                      case "newness_or_repeat": return vis("newness_or_repeat") ? (
                        <Th key={key} whiteSpace="nowrap" {...colStickyProps("newness_or_repeat", tableBgColor, "38px")} {...dragProps}><ColTh colKey="newness_or_repeat">{colLabels["newness_or_repeat"]}</ColTh></Th>
                      ) : null;
                      case "keep": return vis("keep") ? (
                        <Th key={key} whiteSpace="nowrap" {...colStickyProps("keep", tableBgColor, "38px")} {...dragProps}><ColTh colKey="keep">{colLabels["keep"]}</ColTh></Th>
                      ) : null;
                      case "balance_expected_finish_date": return vis("balance_expected_finish_date") ? (
                        <Th key={key} whiteSpace="nowrap" {...colStickyProps("balance_expected_finish_date", tableBgColor, "38px")} {...dragProps}><ColTh colKey="balance_expected_finish_date">{colLabels["balance_expected_finish_date"]}</ColTh></Th>
                      ) : null;
                      case "issue_or_not": return vis("issue_or_not") ? (
                        <Th key={key} whiteSpace="nowrap" {...colStickyProps("issue_or_not", tableBgColor, "38px")} {...dragProps}><ColTh colKey="issue_or_not">{colLabels["issue_or_not"]}</ColTh></Th>
                      ) : null;
                      case "final": return vis("final") ? (
                        <Th key={key} whiteSpace="nowrap" {...colStickyProps("final", tableBgColor, "38px")} {...dragProps}><ColTh colKey="final">{colLabels["final"]}</ColTh></Th>
                      ) : null;
                      case "daily_target_80": return vis("daily_target_80") ? (
                        <Th key={key} isNumeric whiteSpace="nowrap" {...colStickyProps("daily_target_80", tableBgColor, "38px")} {...dragProps}><ColTh colKey="daily_target_80">{colLabels["daily_target_80"]}</ColTh></Th>
                      ) : null;
                      case "gong_in": return vis("gong_in") ? (
                        <Th key={key} whiteSpace="nowrap" {...colStickyProps("gong_in", tableBgColor, "38px")} {...dragProps}><ColTh colKey="gong_in">{colLabels["gong_in"]}</ColTh></Th>
                      ) : null;
                      case "total_cmt": return vis("total_cmt") ? (
                        <Th key={key} isNumeric whiteSpace="nowrap" {...colStickyProps("total_cmt", tableBgColor, "38px")} {...dragProps}><ColTh colKey="total_cmt">{colLabels["total_cmt"]}</ColTh></Th>
                      ) : null;
                      case "actual_cmt": return vis("actual_cmt") ? (
                        <Th key={key} isNumeric whiteSpace="nowrap" {...colStickyProps("actual_cmt", tableBgColor, "38px")} {...dragProps}><ColTh colKey="actual_cmt">{colLabels["actual_cmt"]}</ColTh></Th>
                      ) : null;
                      case "unit_fob": return vis("unit_fob") ? (
                        <Th key={key} whiteSpace="nowrap" {...colStickyProps("unit_fob", tableBgColor, "38px")} {...dragProps}><ColTh colKey="unit_fob">{colLabels["unit_fob"]}</ColTh></Th>
                      ) : null;
                      case "total_fob": return vis("total_fob") ? (
                        <Th key={key} isNumeric whiteSpace="nowrap" {...colStickyProps("total_fob", tableBgColor, "38px")} {...dragProps}><ColTh colKey="total_fob">{colLabels["total_fob"]}</ColTh></Th>
                      ) : null;
                      case "actual_fob": return vis("actual_fob") ? (
                        <Th key={key} isNumeric whiteSpace="nowrap" {...colStickyProps("actual_fob", tableBgColor, "38px")} {...dragProps}><ColTh colKey="actual_fob">{colLabels["actual_fob"]}</ColTh></Th>
                      ) : null;
                      case "remark": return vis("remark") ? (
                        <Th key={key} {...colStickyProps("remark", tableBgColor, "38px")} {...dragProps}><ColTh colKey="remark">{colLabels["remark"]}</ColTh></Th>
                      ) : null;
                      default: return null;
                    }
                  })}
                  {calendarDayHeaderMeta.map((h, dayIdx) => {
                    const d = h.day;
                    const { jsDay, weekdayShort, monthBlockIndex } = h;
                    const ymdHdr = h.dateLabel;
                    const isTodayCol = ymdHdr === calendarTodayYmd;
                    const isPlanHolidayCol = vlPlanHolidayYmdSet.has(ymdHdr);
                    const isSun = jsDay === 0;
                    const isSat = jsDay === 6;
                    const monthBand =
                      monthBlockIndex === 0
                        ? calMonthBandPrev
                        : monthBlockIndex === 1
                          ? calMonthBandSelected
                          : calMonthBandNext;
                    const thBg = isPlanHolidayCol
                      ? planHolidayColBg
                      : isSun
                        ? sunDayColBg
                        : isSat
                          ? satDayColBg
                          : monthBand;
                    const thCol = isPlanHolidayCol
                      ? planHolidayHeaderColor
                      : isSun
                        ? sunDayHeaderColor
                        : isSat
                          ? satDayHeaderColor
                          : weekdayThNormalColor;
                    const day15Abbr = d === 15 ? calendarMonthAbbrByKey.get(`${h.y}-${h.m1}`) : undefined;
                    const day15BadgeSkin =
                      monthBlockIndex === 0
                        ? {
                            bg: day15BadgePrevBg,
                            borderColor: day15BadgePrevBorder,
                            color: day15BadgePrevText,
                          }
                        : monthBlockIndex === 1
                          ? {
                              bg: day15BadgeSelectedBg,
                              borderColor: day15BadgeSelectedBorder,
                              color: day15BadgeSelectedText,
                            }
                          : {
                              bg: day15BadgeNextBg,
                              borderColor: day15BadgeNextBorder,
                              color: day15BadgeNextText,
                            };
                    return (
                      <Th
                        key={`day-h-${h.key}`}
                        ref={dayIdx === 0 ? firstDayHeaderRef : undefined}
                        isNumeric
                        fontSize="xs"
                        px={1}
                        py={1.5}
                        minW={isReadOnly ? "32px" : "40px"}
                        whiteSpace="nowrap"
                        bgColor={thBg}
                        position="sticky"
                        top="38px"
                        zIndex={day15Abbr ? 6 : 1}
                        overflow={day15Abbr ? "visible" : undefined}
                        borderLeftWidth={d === 1 ? "1px" : undefined}
                        borderLeftColor={d === 1 ? calMonthBoundaryLine : undefined}
                        title={(() => {
                          const parts = [
                            `${t("vlAssembly.list.scheduleDailyOutputByDayGroup")} · ${weekdayShort} ${h.dateLabel}`,
                          ];
                          if (isPlanHolidayCol) {
                            const hn = vlPlanHolidayNameByYmd.get(ymdHdr);
                            parts.push(
                              hn != null && hn.length > 0
                                ? t("vlAssembly.list.calendarPlanHolidayNamedTooltip", {
                                    name: hn,
                                  })
                                : t("vlAssembly.list.calendarPlanHolidayTooltip")
                            );
                          }
                          return parts.join(" · ");
                        })()}
                        lineHeight="1.1"
                        verticalAlign="top"
                      >
                        {day15Abbr != null && day15Abbr.length > 0 && !isReadOnly && (
                          <Box
                            position="absolute"
                            top={0}
                            left="50%"
                            zIndex={10}
                            transform="translate(-50%, calc(-50% - 22px))"
                            px={1.5}
                            py="3px"
                            lineHeight="1"
                            fontSize="9px"
                            fontWeight="bold"
                            letterSpacing="0.04em"
                            color={day15BadgeSkin.color}
                            bg={day15BadgeSkin.bg}
                            borderWidth="1px"
                            borderColor={day15BadgeSkin.borderColor}
                            borderRadius="full"
                            boxShadow="sm"
                            whiteSpace="nowrap"
                            pointerEvents="none"
                            title={day15Abbr}
                          >
                            {day15Abbr}
                          </Box>
                        )}
                        <VStack spacing={0} align="center" lineHeight="1.1">
                          <Text
                            as="span"
                            fontSize="9px"
                            fontWeight="bold"
                            color={thCol}
                            lineHeight="1.1"
                          >
                            {weekdayShort}
                          </Text>
                          <Text
                            as="span"
                            fontSize="10px"
                            fontWeight="semibold"
                            color={thCol}
                            lineHeight="1.1"
                            title={h.dateLabel}
                          >
                            {d}
                          </Text>
                          {isTodayCol && (
                            <Badge
                              fontSize="6px"
                              px={1}
                              py="1px"
                              lineHeight="1"
                              colorScheme="teal"
                              variant="solid"
                              borderRadius="sm"
                            >
                              {t("vlAssembly.list.calendarTodayBadge")}
                            </Badge>
                          )}
                        </VStack>
                      </Th>
                    );
                  })}
                </Tr>
              </Thead>
              <Tbody>
                {(isLoading || isFetching) && schedules.length === 0 && (
                  <>
                    {[...Array(6)].map((_, i) => (
                      <Tr key={i}>
                        {[...Array(tableColSpanWithDays + 1)].map((__, j) => (
                          <Td key={j} py={3}>
                            <Skeleton height="16px" borderRadius="sm" />
                          </Td>
                        ))}
                      </Tr>
                    ))}
                  </>
                )}
                {!isLoading && !isFetching && schedules.length === 0 && (
                  <Tr><Td colSpan={tableColSpanWithDays + 1}><Text color="gray.400" textAlign="center">{t("vlAssembly.list.noSchedules")}</Text></Td></Tr>
                )}

                {schedulesByLine.map((group, gIdx) => {
                  const accent = LINE_GROUP_ACCENTS[gIdx % LINE_GROUP_ACCENTS.length];
                  const lgBorder = lineGroupLeftBorderProps(accent);
                  const kpis = vlLineGroupKpis(group.schedules);
                  const lineTitle =
                    (group.schedules[0]?.production_line_name ?? "").trim() ||
                    t("vlAssembly.list.lineGroup.unassignedLine");
                  const isLineCollapsed = collapsedLines.has(group.lineKey);
                  return (
                    <Fragment key={group.lineKey}>
                      <Tr
                        borderTopWidth="3px"
                        borderTopStyle="solid"
                        borderTopColor={accent}
                        cursor="pointer"
                        _hover={{ bg: "blue.100" }}
                        onClick={() => toggleLine(group.lineKey)}
                      >
                        {/* Sticky 40px action column — ensures no gap between the toggle column and the line group header content when scrolling */}
                        <Td
                          w="40px"
                          minW="40px"
                          py={0}
                          px={0}
                          position="sticky"
                          left={0}
                          zIndex={10}
                          bg={lineGroupHeaderBg}
                          verticalAlign="middle"
                          {...lineGroupLeftBorderProps(accent)}
                        />
                        <Td
                          colSpan={tableColSpanWithDays}
                          py={0}
                          px={0}
                          bg={lineGroupHeaderBg}
                          verticalAlign="middle"
                        >
                          <Box
                            position="sticky"
                            left="40px"
                            zIndex={15}
                            display="inline-flex"
                            alignItems="center"
                            w="max-content"
                            maxW="100vw"
                            px={3}
                            py={2}
                          >
                            <HStack align="center" spacing={4} sx={{ flexWrap: "wrap" }}>
                              <HStack spacing={2} align="center">
                                <Icon
                                  as={isLineCollapsed ? FaChevronRight : FaChevronDown}
                                  boxSize="12px"
                                  color={accent}
                                />
                                <Badge colorScheme="blue" fontSize="sm" px={2} py={0.5}>{lineTitle}</Badge>
                              </HStack>
                              {isLineCollapsed ? (
                                <Text fontSize="sm" color="gray.500" fontStyle="italic">
                                  {t("vlAssembly.list.lineGroup.collapsed", { count: kpis.sjCount })}
                                </Text>
                              ) : (
                                <HStack sx={{ flexWrap: "wrap" }} spacing={3} align="center">
                                  <HStack spacing={1} align="center">
                                    <Icon as={FaCalendarAlt} boxSize="11px" color="blue.400" />
                                    <Text as="span" fontSize="sm" fontWeight="semibold">
                                      {t("vlAssembly.list.lineGroup.scheduleCount", { count: kpis.scheduleCount })}
                                      {" · "}
                                      {t("vlAssembly.list.lineGroup.sjCount", { count: kpis.sjCount })}
                                    </Text>
                                  </HStack>
                                  <HStack spacing={2} align="center">
                                    <HStack spacing={1}>
                                      <Icon as={FaBoxes} boxSize="11px" color="gray.400" />
                                      <Text as="span" fontSize="sm" color="gray.600">{t("vlAssembly.list.lineGroup.totalQty", { qty: kpis.totalQty.toLocaleString() })}</Text>
                                    </HStack>
                                    <HStack spacing={1}>
                                      <Icon as={FaCheckCircle} boxSize="11px" color="green.400" />
                                      <Text as="span" fontSize="sm" color="gray.600">{t("vlAssembly.list.lineGroup.outputQty", { qty: kpis.outputQty.toLocaleString() })}</Text>
                                    </HStack>
                                    <HStack spacing={1}>
                                      <Icon as={FaExclamationTriangle} boxSize="11px" color="red.400" />
                                      <Text as="span" fontSize="sm" color="gray.600">{t("vlAssembly.list.lineGroup.defectQty", { qty: kpis.defectQty.toLocaleString() })}</Text>
                                    </HStack>
                                    <HStack spacing={1}>
                                      <Icon as={FaIndustry} boxSize="11px" color="teal.400" />
                                      <Text as="span" fontSize="sm" color="gray.600">{t("vlAssembly.list.lineGroup.assemblyOutputSum", { qty: kpis.assemblyOutSum.toLocaleString() })}</Text>
                                    </HStack>
                                  </HStack>
                                </HStack>
                              )}
                            </HStack>
                          </Box>
                        </Td>
                      </Tr>
                      {!isLineCollapsed && group.schedules.map((s) => {
                  const o = s.sj_order_info;
                  const sjNos = s.ep_sj_nos ?? [];
                  return (
                    <Fragment key={`schedule-${s.pk}`}>
                      {(() => {
                        const isMultiSJ = sjNos.length > 1;
                        const firstSj = sjNos[0];
                        if (!firstSj) return null;

                        const renderSjRows = (isSubRow: boolean) => sjNos.map((sj, sjIdx) => {
                          const isSjExpanded = expandedSjNos.has(sj.pk);
                          const sjTotal = sj.total_qty ?? 0;
                          const sjOut = sj.output_qty ?? 0;
                          const sjBalance = Math.max(0, sjTotal - sjOut);
                          const sjPct = sjTotal > 0 ? Math.min(100, Math.round((sjOut / sjTotal) * 100)) : 0;
                          const sjBarColor = sjPct >= 100 ? "green.400" : sjPct >= 50 ? "blue.400" : "orange.400";
                          const sjTp = vlSjThroughputDisplayFields(sj);
                          const isRowSelected = selectedSjPk === sj.pk;
                          const rowBg = isRowSelected ? scheduleRowSelectedBg : (isSubRow ? sjSubRowBg : scheduleRowBg);
                          const rowHoverBg = isSubRow ? sjSubRowHoverBg : scheduleRowHoverBg;
                          const modPl = isSubRow ? 9 : 5;
                          const procPl = isSubRow ? 13 : 9;

                          return (
                            <Fragment key={`sj-${sj.pk}`}>
                              {/* ── SJ Row ── */}
                              <Tr bgColor={rowBg} _hover={isRowSelected ? undefined : { bgColor: rowHoverBg }}
                                borderTop={isSubRow ? "1px solid" : "2px solid"}
                                borderTopColor={isSubRow ? "gray.200" : (sjIdx === 0 ? "gray.300" : "gray.100")}
                                cursor="pointer"
                                {...(!isSubRow && sjIdx === 0 ? { "data-schedule-pk": String(s.pk) } : {})}
                                sx={!isSubRow && sjIdx === 0 && flashPk === s.pk ? {
                                  animation: "scheduleHighlightRing 3s ease-out forwards",
                                  "@keyframes scheduleHighlightRing": {
                                    "0%, 20%": { boxShadow: "inset 0 0 0 3px var(--chakra-colors-yellow-400)" },
                                    "100%": { boxShadow: "inset 0 0 0 0px transparent" },
                                  },
                                } : undefined}
                                onClick={() => {
                                  setSelectedSjPk((prev) => (prev === sj.pk ? null : sj.pk));
                                  if (sj.ep_modules.length > 0) toggleSjNo(sj.pk);
                                }}>
                                <Td px={1} pl={isSubRow ? 4 : undefined} minW="40px" position="sticky" left={0} zIndex={1} bgColor={rowBg} {...lgBorder} onClick={(e) => e.stopPropagation()}>
                                  <VStack spacing={0} align="center">
                                    {sj.ep_modules.length > 0 ? (
                                      <IconButton aria-label="expand" icon={isSjExpanded ? <FaChevronDown /> : <FaChevronRight />}
                                        size="xs" variant="ghost" onClick={(e) => { e.stopPropagation(); toggleSjNo(sj.pk); }} />
                                    ) : <Box w="24px" />}
                                    <Menu>
                                      <MenuButton
                                        as={IconButton}
                                        aria-label={t("vlAssembly.list.moveSjNo")}
                                        icon={<FaEllipsisV />}
                                        size="xs"
                                        variant="ghost"
                                        onClick={(e) => e.stopPropagation()}
                                      />
                                      <Portal>
                                        <MenuList minW="180px" zIndex={9999}>
                                          <MenuItem onClick={() => openMoveSjNoModal(sj.pk, s.pk, "existing")}>
                                            {t("vlAssembly.list.moveToSchedule")}
                                          </MenuItem>
                                          <MenuItem onClick={() => openMoveSjNoModal(sj.pk, s.pk, "new")}>
                                            {t("vlAssembly.list.splitToNewSchedule")}
                                          </MenuItem>
                                        </MenuList>
                                      </Portal>
                                    </Menu>
                                    {!isReadOnly && !isSubRow && sjIdx === sjNos.length - 1 && (
                                      <Button
                                        size="xs"
                                        variant="link"
                                        colorScheme="blue"
                                        mt={1}
                                        onClick={(e) => { e.stopPropagation(); openAddSjNoModal(s); }}
                                      >
                                        + {t("vlAssembly.list.addSjNo")}
                                      </Button>
                                    )}
                                  </VStack>
                                </Td>
                              {columnOrder.map(key => {
                                switch (key) {
                                  case "production_line": return visInfo("production_line") ? <Td key={key} whiteSpace="nowrap" {...colStickyProps("production_line", rowBg)}>{s.production_line_name || "-"}</Td> : null;
                                  case "sj_po_number": return vis("sj_po_number") ? <Td key={key} whiteSpace="nowrap" {...colStickyProps("sj_po_number", rowBg)} onClick={(e) => e.stopPropagation()}><Link href="#" color="blue.500" fontWeight="semibold" onClick={(e) => { e.preventDefault(); e.stopPropagation(); openWindow(`/vl-assembly-production/${s.pk}`); }}>{o?.sj_po_number ?? s.pk}</Link><Text fontSize="2xs" color="gray.400" lineHeight={1.2}>#{s.pk}</Text></Td> : null;
                                  case "sj_no": return visInfo("sj_no") ? <Td key={key} whiteSpace="nowrap" {...colStickyProps("sj_no", rowBg)}><Text fontWeight="semibold">{sj.sj_no || "-"}</Text></Td> : null;
                                  case "color": return visInfo("color") ? <Td key={key} {...colStickyProps("color", rowBg)}>{o?.color || "-"}</Td> : null;
                                  case "total_qty": return visInfo("total_qty") ? <Td key={key} isNumeric fontWeight="semibold" {...colStickyProps("total_qty", rowBg)}>{sjTotal > 0 ? sjTotal.toLocaleString() : "-"}</Td> : null;
                                  case "assembly_output_qty": return visInfo("assembly_output_qty") ? (
                                    <Td key={key} isNumeric {...colStickyProps("assembly_output_qty", rowBg)} onClick={(e) => e.stopPropagation()}>
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
                                    </Td>
                                  ) : null;
                                  case "ex_factory_1st": return visInfo("ex_factory_1st") ? <Td key={key} whiteSpace="nowrap" {...colStickyProps("ex_factory_1st", rowBg)}>{fmtDate(o?.ex_factory_date)}</Td> : null;
                                  case "ex_factory_2nd": return vis("ex_factory_2nd") ? <Td key={key} whiteSpace="nowrap" {...colStickyProps("ex_factory_2nd", rowBg)}><Text fontSize="xs">{s.ex_factory_2nd ?? "—"}</Text></Td> : null;
                                  case "ex_country": return vis("ex_country") ? <Td key={key} whiteSpace="nowrap" {...colStickyProps("ex_country", rowBg)}><Text fontSize="xs">{o?.ex_country ?? "—"}</Text></Td> : null;
                                  case "air_or_vessel": return vis("air_or_vessel") ? <Td key={key} whiteSpace="nowrap" {...colStickyProps("air_or_vessel", rowBg)}><Text fontSize="xs">{o?.air_or_vessel ?? "—"}</Text></Td> : null;
                                  case "ef_buffer": return vis("ef_buffer") ? (() => {
                                    const efResult = calcEfBuffer(
                                      sjBalance,
                                      sjOut,
                                      s.production_assembly_start_date,
                                      s.production_assembly_finish_date,
                                      o?.ex_factory_date ?? s.production_assembly_finish_date,
                                      calendarTodayYmd,
                                      vlPlanHolidayYmdSet,
                                      sjTp.dailyTarget8h ?? null
                                    );
                                    return <Td key={key} whiteSpace="nowrap" textAlign="right" {...colStickyProps("ef_buffer", rowBg)}><EfBufferCell result={efResult} /></Td>;
                                  })() : null;
                                  case "schedule_spi": return vis("schedule_spi") ? (() => {
                                    const spiResult = calcSpi(
                                      sjTotal,
                                      sjOut,
                                      s.production_assembly_start_date,
                                      s.production_assembly_finish_date,
                                      calendarTodayYmd,
                                      vlPlanHolidayYmdSet
                                    );
                                    return <Td key={key} whiteSpace="nowrap" textAlign="right" {...colStickyProps("schedule_spi", rowBg)}><SpiCell result={spiResult} /></Td>;
                                  })() : null;
                                  case "assembly_start": return visInfo("assembly_start") ? <Td key={key} whiteSpace="nowrap" {...colStickyProps("assembly_start", rowBg)}>{fmtDate(s.production_assembly_start_date)}</Td> : null;
                                  case "assembly_finish": return visInfo("assembly_finish") ? <Td key={key} whiteSpace="nowrap" {...colStickyProps("assembly_finish", rowBg)}>{fmtDate(s.production_assembly_finish_date)}</Td> : null;
                                  case "flow_memo": return vis("flow_memo") ? <Td key={key} {...colStickyProps("flow_memo", rowBg)}><Text color="gray.300">—</Text></Td> : null;
                                  case "category": return vis("category") ? <Td key={key} {...colStickyProps("category", rowBg)}><VlAssemblyBadge kind="vlSj" fontSize="xs" /></Td> : null;
                                  case "sub_category": return vis("sub_category") ? (
                                    <Td key={key} {...colStickyProps("sub_category", rowBg)}>
                                      {renderModuleSubCategoryBadges(
                                        getAggregateSjCategoryLabels(sj.ep_modules ?? []),
                                        `sj-${sj.pk}`
                                      )}
                                    </Td>
                                  ) : null;
                                  case "media": return vis("media") ? (() => {
                                    const thumb = sj.sj_style_thumbnail ?? o?.sj_style?.thumbnail ?? null;
                                    return (
                                      <Td key={key} onClick={(e) => e.stopPropagation()} {...colStickyProps("media", rowBg)}>
                                        {thumb ? (
                                          <Tooltip label="View Style Photo" placement="top">
                                            <Box as="img" src={thumb} alt="style" w="36px" h="36px" objectFit="cover" borderRadius="sm" cursor="pointer" onClick={() => openPhoto(thumb)} />
                                          </Tooltip>
                                        ) : <Text color="gray.300">—</Text>}
                                      </Td>
                                    );
                                  })() : null;
                                  case "work_order": return vis("work_order") ? <Td key={key} {...colStickyProps("work_order", rowBg)}><Text color="gray.300">—</Text></Td> : null;
                                  case "code": return vis("code") ? <Td key={key} whiteSpace="nowrap" onClick={(e) => e.stopPropagation()} {...colStickyProps("code", rowBg)}>{sj.sj_no ? (<Link href="#" title={sj.sj_no} fontWeight="semibold" fontSize="xs" color="blue.600" onClick={(e) => { e.preventDefault(); e.stopPropagation(); openWindow(`/vl-assembly-production/sj-nos/${sj.pk}`); }}>{sj.sj_no}</Link>) : <Text color="gray.300">—</Text>}</Td> : null;
                                  case "style_name": return vis("style_name") ? <Td key={key} whiteSpace="nowrap" {...colStickyProps("style_name", rowBg)}>{o?.style_name || "-"}</Td> : null;
                                  case "today_output_qty": return vis("today_output_qty") ? (() => {
                                    const sjTodayOut = dailyQtyBySjNo.get(sj.pk)?.get(calendarTodayYmd) ?? 0;
                                    const sjDailyPlan = getAssemblyDailyPlannedQtyFromTotal(s, sjTotal, vlPlanHolidayYmdSet)?.daily ?? null;
                                    return (
                                      <Td key={key} isNumeric {...colStickyProps("today_output_qty", rowBg)} bg="teal.50" _dark={{ bg: "teal.900" }} onClick={(e) => e.stopPropagation()}>
                                        <TodayOutputBreakdown
                                          todayOut={sjTodayOut}
                                          dailyTarget={sjTp.dailyTarget8h ?? null}
                                          dailyPlan={sjDailyPlan}
                                        />
                                      </Td>
                                    );
                                  })() : null;
                                  case "output_qty": return vis("output_qty") ? (
                                    <Td key={key} isNumeric {...colStickyProps("output_qty", rowBg)} onClick={(e) => e.stopPropagation()}>
                                      <EpFlashQty value={sjOut}>{sjOut.toLocaleString()}</EpFlashQty>
                                    </Td>
                                  ) : null;
                                  case "defect_qty": return vis("defect_qty") ? (
                                    <Td key={key} isNumeric {...colStickyProps("defect_qty", rowBg)} onClick={(e) => e.stopPropagation()}>
                                      <DefectQtyLink defectQty={sj.total_defect_qty ?? 0} to={`/vl-assembly-production/inspections?vl_assembly_sj_no=${sj.pk}`} />
                                    </Td>
                                  ) : null;
                                  case "balance_qty": return vis("balance_qty") ? <Td key={key} isNumeric fontWeight="semibold" {...colStickyProps("balance_qty", rowBg)}>{sjTotal > 0 ? sjBalance.toLocaleString() : "-"}</Td> : null;
                                  case "daily_required_qty": return vis("daily_required_qty") ? (() => {
                                    const deadline = s.production_assembly_finish_date ?? s.sj_order_info?.ex_factory_date ?? null;
                                    const result = calcDailyRequired(sjBalance, deadline, calendarTodayYmd, vlPlanHolidayYmdSet, sjTp.dailyTarget8h ?? null);
                                    return (
                                      <Td key={key} {...colStickyProps("daily_required_qty", rowBg)}>
                                        <DailyReqCell result={result} />
                                      </Td>
                                    );
                                  })() : null;
                                  case "progress": return vis("progress") ? <Td key={key} {...colStickyProps("progress", rowBg)}>{sjTotal > 0 ? (<Box><Text fontSize="xs" mb={0.5}>{sjPct}%</Text><Box w="80px" h="5px" bg="gray.200" borderRadius="full" overflow="hidden"><Box w={`${sjPct}%`} h="100%" bg={sjBarColor} borderRadius="full" /></Box></Box>) : <Text color="gray.300">—</Text>}</Td> : null;
                                  case "status": return vis("status") ? (
                                    <Td key={key} onClick={(e) => e.stopPropagation()} {...colStickyProps("status", rowBg)} {...statusColumnWidthProps}>
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
                                    </Td>
                                  ) : null;
                                  case "cycle_time": return vis("cycle_time") ? <Td key={key} isNumeric {...colStickyProps("cycle_time", rowBg)}>{sjTp.cycleDisplay ?? <Text color="gray.300">—</Text>}</Td> : null;
                                  case "target_per_hour": return vis("target_per_hour") ? <Td key={key} isNumeric {...colStickyProps("target_per_hour", rowBg)}>{sjTp.targetPerHour != null ? sjTp.targetPerHour.toLocaleString() : <Text color="gray.300">—</Text>}</Td> : null;
                                  case "daily_target": return vis("daily_target") ? <Td key={key} isNumeric {...colStickyProps("daily_target", rowBg)}>{sjTp.dailyTarget8h != null ? sjTp.dailyTarget8h.toLocaleString() : <Text color="gray.300">—</Text>}</Td> : null;
                                  case "process_start": return vis("process_start") ? <Td key={key} whiteSpace="nowrap" {...colStickyProps("process_start", rowBg)}>{fmtDate(s.process_start_date)}</Td> : null;
                                  case "process_finish": return vis("process_finish") ? <Td key={key} whiteSpace="nowrap" {...colStickyProps("process_finish", rowBg)}>{fmtDate(s.process_finish_date)}</Td> : null;
                                  case "lead_time": return vis("lead_time") ? <Td key={key} isNumeric {...colStickyProps("lead_time", rowBg)}>{s.process_lead_time_days != null ? (<Box textAlign="right"><Text as="span" fontWeight="semibold">{s.process_lead_time_days}d</Text>{(s.process_sundays_excluded_count ?? 0) > 0 && (<Text fontSize="10px" color="orange.400" whiteSpace="nowrap">{t("vlAssembly.common.sundayExcluded", { count: s.process_sundays_excluded_count })}</Text>)}</Box>) : <Text color="gray.300">—</Text>}</Td> : null;
                                  case "po_date": return vis("po_date") ? <Td key={key} whiteSpace="nowrap" {...colStickyProps("po_date", rowBg)}><Text fontSize="xs">{o?.po_date ?? "—"}</Text></Td> : null;
                                  case "material_due_inbound": return vis("material_due_inbound") ? <Td key={key} whiteSpace="nowrap" {...colStickyProps("material_due_inbound", rowBg)}>{fmtDate(s.due_inbound_date_prep_material)}</Td> : null;
                                  case "expected_inbound": return vis("expected_inbound") ? <Td key={key} whiteSpace="nowrap" {...colStickyProps("expected_inbound", rowBg)}>{fmtDate(s.expected_prep_material_inbound_date)}</Td> : null;
                                  case "actual_inbound_qty": return vis("actual_inbound_qty") ? (
                                    <Td key={key} isNumeric onClick={(e) => e.stopPropagation()} {...colStickyProps("actual_inbound_qty", rowBg)}>
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
                                  ) : null;
                                  case "cutting_start_date": return vis("cutting_start_date") ? <Td key={key} whiteSpace="nowrap" {...colStickyProps("cutting_start_date", rowBg)}><Text fontSize="xs">{s.cutting_start_date ?? "—"}</Text></Td> : null;
                                  case "vien_laser": return vis("vien_laser") ? <Td key={key} whiteSpace="nowrap" {...colStickyProps("vien_laser", rowBg)}><Text fontSize="xs">{s.vien_laser ?? "—"}</Text></Td> : null;
                                  case "printing_folding": return vis("printing_folding") ? <Td key={key} whiteSpace="nowrap" {...colStickyProps("printing_folding", rowBg)}><Text fontSize="xs">{s.printing_folding ?? "—"}</Text></Td> : null;
                                  case "sub_tg": return vis("sub_tg") ? <Td key={key} whiteSpace="nowrap" {...colStickyProps("sub_tg", rowBg)}><Text fontSize="xs">{s.sub_tg ?? "—"}</Text></Td> : null;
                                  case "sub_vl": return vis("sub_vl") ? <Td key={key} whiteSpace="nowrap" {...colStickyProps("sub_vl", rowBg)}><Text fontSize="xs">{s.sub_vl ?? "—"}</Text></Td> : null;
                                  case "pre": return vis("pre") ? <Td key={key} whiteSpace="nowrap" {...colStickyProps("pre", rowBg)}><Text fontSize="xs">{s.pre ?? "—"}</Text></Td> : null;
                                  case "scom": return vis("scom") ? <Td key={key} whiteSpace="nowrap" {...colStickyProps("scom", rowBg)}><Text fontSize="xs">{s.scom ?? "—"}</Text></Td> : null;
                                  case "expected_date_finished": return vis("expected_date_finished") ? <Td key={key} whiteSpace="nowrap" {...colStickyProps("expected_date_finished", rowBg)}><Text fontSize="xs">{s.expected_date_finished ?? "—"}</Text></Td> : null;
                                  case "ex_fty_from_today": return vis("ex_fty_from_today") ? (() => {
                                    const efDate = o?.ex_factory_date ? parseLocalMidnightFromIso(o.ex_factory_date) : null;
                                    const todayMs = parseYmdLocal(calendarTodayYmd).getTime();
                                    const days = efDate ? Math.ceil((efDate.getTime() - todayMs) / 86400000) : null;
                                    return (
                                      <Td key={key} isNumeric {...colStickyProps("ex_fty_from_today", rowBg)}>
                                        {days != null ? (
                                          <Text fontWeight="semibold" color={days < 0 ? "red.500" : days <= 7 ? "orange.500" : "green.600"} fontSize="xs">{days}d</Text>
                                        ) : <Text color="gray.300">—</Text>}
                                      </Td>
                                    );
                                  })() : null;
                                  case "newness_or_repeat": return vis("newness_or_repeat") ? <Td key={key} whiteSpace="nowrap" {...colStickyProps("newness_or_repeat", rowBg)}><Text fontSize="xs">{o?.newness_or_repeat ?? "—"}</Text></Td> : null;
                                  case "keep": return vis("keep") ? <Td key={key} whiteSpace="nowrap" {...colStickyProps("keep", rowBg)}><Text fontSize="xs">{s.keep ?? "—"}</Text></Td> : null;
                                  case "balance_expected_finish_date": return vis("balance_expected_finish_date") ? <Td key={key} whiteSpace="nowrap" {...colStickyProps("balance_expected_finish_date", rowBg)}><Text fontSize="xs">{s.balance_expected_finish_date ?? "—"}</Text></Td> : null;
                                  case "issue_or_not": return vis("issue_or_not") ? <Td key={key} {...colStickyProps("issue_or_not", rowBg)}><Text fontSize="xs">{s.issue_or_not ?? "—"}</Text></Td> : null;
                                  case "final": return vis("final") ? <Td key={key} whiteSpace="nowrap" {...colStickyProps("final", rowBg)}><Text fontSize="xs">{s.final ?? "—"}</Text></Td> : null;
                                  case "daily_target_80": return vis("daily_target_80") ? <Td key={key} isNumeric {...colStickyProps("daily_target_80", rowBg)}>{sjTp.dailyTarget8h != null ? <Text fontWeight="semibold" fontSize="xs">{Math.round(sjTp.dailyTarget8h * 0.8).toLocaleString()}</Text> : <Text color="gray.300">—</Text>}</Td> : null;
                                  case "gong_in": return vis("gong_in") ? <Td key={key} whiteSpace="nowrap" {...colStickyProps("gong_in", rowBg)}><Text fontSize="xs">{o?.gong_in ?? "—"}</Text></Td> : null;
                                  case "total_cmt": return vis("total_cmt") ? <Td key={key} whiteSpace="nowrap" {...colStickyProps("total_cmt", rowBg)}><Text fontSize="xs">{o?.total_cmt ?? "—"}</Text></Td> : null;
                                  case "actual_cmt": return vis("actual_cmt") ? <Td key={key} whiteSpace="nowrap" {...colStickyProps("actual_cmt", rowBg)}><Text fontSize="xs">{o?.actual_cmt ?? "—"}</Text></Td> : null;
                                  case "unit_fob": return vis("unit_fob") ? <Td key={key} whiteSpace="nowrap" {...colStickyProps("unit_fob", rowBg)}><Text fontSize="xs">{o?.unit_fob ?? "—"}</Text></Td> : null;
                                  case "total_fob": return vis("total_fob") ? <Td key={key} whiteSpace="nowrap" {...colStickyProps("total_fob", rowBg)}><Text fontSize="xs">{o?.total_fob ?? "—"}</Text></Td> : null;
                                  case "actual_fob": return vis("actual_fob") ? <Td key={key} whiteSpace="nowrap" {...colStickyProps("actual_fob", rowBg)}><Text fontSize="xs">{o?.actual_fob ?? "—"}</Text></Td> : null;
                                  case "remark": return vis("remark") ? <Td key={key} {...colStickyProps("remark", rowBg)}>{s.remark ? (<Tooltip label={s.remark} placement="top" hasArrow><Text fontSize="xs" noOfLines={2} cursor="default">{s.remark}</Text></Tooltip>) : <Text color="gray.300">—</Text>}</Td> : null;
                                  default: return null;
                                }
                              })}
                              {renderVlCalendarCells({
                                kind: "schedule",
                                schedule: s,
                                rowBg: rowBg,
                                showScheduleDailyQty: true,
                                showSchedulePeriodInCalendar: !isSubRow && sjIdx === 0,
                                firstSJTotalQty: (!isSubRow && sjIdx === 0)
                                  ? sjNos.reduce((sum, sj_) => sum + (sj_.total_qty ?? 0), 0) || null
                                  : null,
                                overrideByDay: dailyQtyBySjNo.get(sj.pk) ?? new Map<string, number>(),
                              })}
                            </Tr>

                            {/* ── Module Rows (M) ── */}
                            {isSjExpanded && sj.ep_modules.map((mod) => {
                              const isModExpanded = expandedModules.has(mod.pk);
                              const modTp = vlModuleThroughputDisplayFields(mod);
                              return (
                                <Fragment key={`m-${mod.pk}`}>
                                  <Tr bgColor={moduleRowBg}
                                    cursor={mod.ep_processes.length > 0 ? "pointer" : "default"}
                                    _hover={{ bgColor: moduleRowHoverBg }}
                                    onClick={() => { if (mod.ep_processes.length > 0) toggleModule(mod.pk); }}>
                                    <Td px={1} pl={modPl} minW="40px" position="sticky" left={0} zIndex={1} bgColor={moduleRowBg} {...lgBorder}>
                                      {mod.ep_processes.length > 0 ? (
                                        <IconButton aria-label="expand module" icon={isModExpanded ? <FaChevronDown /> : <FaChevronRight />}
                                          size="xs" variant="ghost" onClick={(e) => { e.stopPropagation(); toggleModule(mod.pk); }} />
                                      ) : <Box w="24px" />}
                                    </Td>
                                    {columnOrder.map(key => {
                                      switch (key) {
                                        case "production_line": return visInfo("production_line") ? <Td key={key} whiteSpace="nowrap" {...colStickyProps("production_line", moduleRowBg)}><Text color="gray.400" fontSize="xs">{s.production_line_name || "-"}</Text></Td> : null;
                                        case "sj_po_number": return vis("sj_po_number") ? <Td key={key} whiteSpace="nowrap" {...colStickyProps("sj_po_number", moduleRowBg)}><Text color="gray.400" fontSize="xs">{o?.sj_po_number ?? s.pk}</Text></Td> : null;
                                        case "sj_no": return visInfo("sj_no") ? <Td key={key} whiteSpace="nowrap" {...colStickyProps("sj_no", moduleRowBg)}><Text color="gray.400" fontSize="xs">{sj.sj_no || "-"}</Text></Td> : null;
                                        case "color": return visInfo("color") ? <Td key={key} {...colStickyProps("color", moduleRowBg)}><Text color="gray.400" fontSize="xs">{o?.color || "-"}</Text></Td> : null;
                                        case "total_qty": return visInfo("total_qty") ? (
                                          <Td key={key} isNumeric {...colStickyProps("total_qty", moduleRowBg)}>
                                            <Text color="gray.400" fontSize="xs">{mod.total_qty != null ? mod.total_qty.toLocaleString() : "-"}</Text>
                                          </Td>
                                        ) : null;
                                        case "assembly_output_qty": return visInfo("assembly_output_qty") ? <Td key={key} isNumeric {...colStickyProps("assembly_output_qty", moduleRowBg)}><Text color="gray.400" fontSize="xs">{s.production_assembly_output_qty != null ? s.production_assembly_output_qty.toLocaleString() : "-"}</Text></Td> : null;
                                        case "ex_factory_1st": return visInfo("ex_factory_1st") ? <Td key={key} whiteSpace="nowrap" {...colStickyProps("ex_factory_1st", moduleRowBg)}><Text color="gray.400" fontSize="xs">{fmtDate(o?.ex_factory_date)}</Text></Td> : null;
                                        case "ex_factory_2nd": return vis("ex_factory_2nd") ? <Td key={key} {...colStickyProps("ex_factory_2nd", moduleRowBg)} /> : null;
                                        case "ex_country": return vis("ex_country") ? <Td key={key} {...colStickyProps("ex_country", moduleRowBg)} /> : null;
                                        case "air_or_vessel": return vis("air_or_vessel") ? <Td key={key} {...colStickyProps("air_or_vessel", moduleRowBg)} /> : null;
                                        case "ef_buffer": return vis("ef_buffer") ? (() => {
                                          const modOut = mod.output_qty ?? 0;
                                          const modTotal = mod.total_qty ?? 0;
                                          const modBal = Math.max(0, modTotal - modOut);
                                          const efResult = calcEfBuffer(modBal, modOut, mod.process_start_date, mod.process_finish_date, mod.process_finish_date, calendarTodayYmd, vlPlanHolidayYmdSet, modTp.dailyTarget8h ?? null);
                                          return <Td key={key} whiteSpace="nowrap" textAlign="right" {...colStickyProps("ef_buffer", moduleRowBg)}><EfBufferCell result={efResult} size="xs" /></Td>;
                                        })() : null;
                                        case "schedule_spi": return vis("schedule_spi") ? (() => {
                                          const modOut = mod.output_qty ?? 0;
                                          const modTotal = mod.total_qty ?? 0;
                                          const spiResult = calcSpi(modTotal, modOut, mod.process_start_date, mod.process_finish_date, calendarTodayYmd, vlPlanHolidayYmdSet);
                                          return <Td key={key} whiteSpace="nowrap" textAlign="right" {...colStickyProps("schedule_spi", moduleRowBg)}><SpiCell result={spiResult} size="xs" /></Td>;
                                        })() : null;
                                        case "assembly_start": return visInfo("assembly_start") ? <Td key={key} whiteSpace="nowrap" {...colStickyProps("assembly_start", moduleRowBg)}><Text color="gray.400" fontSize="xs">{fmtDate(s.production_assembly_start_date)}</Text></Td> : null;
                                        case "assembly_finish": return visInfo("assembly_finish") ? <Td key={key} whiteSpace="nowrap" {...colStickyProps("assembly_finish", moduleRowBg)}><Text color="gray.400" fontSize="xs">{fmtDate(s.production_assembly_finish_date)}</Text></Td> : null;
                                        case "flow_memo": return vis("flow_memo") ? <Td key={key} {...colStickyProps("flow_memo", moduleRowBg)}><Text color="gray.300">—</Text></Td> : null;
                                        case "category": return vis("category") ? (
                                          <Td key={key} {...colStickyProps("category", moduleRowBg)}>
                                            <VlAssemblyBadge kind="vlModule" fontSize="xs" />
                                          </Td>
                                        ) : null;
                                        case "sub_category": return vis("sub_category") ? (
                                          <Td key={key} {...colStickyProps("sub_category", moduleRowBg)}>
                                            {renderModuleSubCategoryBadges(
                                              getModuleCategoryLabels(mod),
                                              `mod-${mod.pk}`
                                            )}
                                          </Td>
                                        ) : null;
                                        case "media": return vis("media") ? <Td key={key} {...colStickyProps("media", moduleRowBg)}><Text color="gray.300">—</Text></Td> : null;
                                        case "work_order": return vis("work_order") ? <Td key={key} {...colStickyProps("work_order", moduleRowBg)}><Text color="gray.300">—</Text></Td> : null;
                                        case "code": return vis("code") ? <Td key={key} whiteSpace="nowrap" onClick={(e) => e.stopPropagation()} {...colStickyProps("code", moduleRowBg)}><Link href="#" title={mod.code} fontWeight="semibold" fontSize="xs" color="blue.600" onClick={(e) => { e.preventDefault(); e.stopPropagation(); openWindow(`/vl-assembly-production/modules/${mod.pk}`); }}>{mod.code}</Link></Td> : null;
                                        case "style_name": return vis("style_name") ? <Td key={key} whiteSpace="nowrap" {...colStickyProps("style_name", moduleRowBg)}>{mod.name || "-"}</Td> : null;
                                        case "today_output_qty": return vis("today_output_qty") ? (() => {
                                          const modTodayOut = dailyQtyByModule.get(mod.pk)?.get(calendarTodayYmd) ?? 0;
                                          const modDailyPlan = getDailyPlannedQtyFromRange(mod.process_start_date, mod.process_finish_date, mod.total_qty ?? 0, vlPlanHolidayYmdSet)?.daily ?? null;
                                          return (
                                            <Td key={key} isNumeric {...colStickyProps("today_output_qty", moduleRowBg)} bg="teal.50" _dark={{ bg: "teal.900" }} onClick={(e) => e.stopPropagation()}>
                                              <TodayOutputBreakdown
                                                todayOut={modTodayOut}
                                                dailyTarget={modTp.dailyTarget8h ?? null}
                                                dailyPlan={modDailyPlan}
                                              />
                                            </Td>
                                          );
                                        })() : null;
                                        case "output_qty": return vis("output_qty") ? (
                                          <Td key={key} isNumeric {...colStickyProps("output_qty", moduleRowBg)} onClick={(e) => e.stopPropagation()}>
                                            <EpFlashQty value={mod.output_qty ?? 0}>
                                              {(mod.output_qty ?? 0).toLocaleString()}
                                            </EpFlashQty>
                                          </Td>
                                        ) : null;
                                        case "defect_qty": return vis("defect_qty") ? (
                                          <Td key={key} isNumeric {...colStickyProps("defect_qty", moduleRowBg)} onClick={(e) => e.stopPropagation()}>
                                            <DefectQtyLink defectQty={mod.total_defect_qty ?? 0} to={`/vl-assembly-production/inspections?vl_assembly_module=${mod.pk}`} />
                                          </Td>
                                        ) : null;
                                        case "balance_qty": return vis("balance_qty") ? (
                                          <Td key={key} isNumeric {...colStickyProps("balance_qty", moduleRowBg)}>
                                            {mod.total_qty != null
                                              ? <Text fontSize="xs" fontWeight="semibold">{Math.max(0, mod.total_qty - (mod.output_qty ?? 0)).toLocaleString()}</Text>
                                              : <Text color="gray.300">—</Text>}
                                          </Td>
                                        ) : null;
                                        case "daily_required_qty": return vis("daily_required_qty") ? (() => {
                                          const modBalance = mod.total_qty != null ? Math.max(0, mod.total_qty - (mod.output_qty ?? 0)) : 0;
                                          const result = calcDailyRequired(modBalance, mod.process_finish_date, calendarTodayYmd, vlPlanHolidayYmdSet, modTp.dailyTarget8h ?? null);
                                          return (
                                            <Td key={key} {...colStickyProps("daily_required_qty", moduleRowBg)}>
                                              <DailyReqCell result={result} size="xs" />
                                            </Td>
                                          );
                                        })() : null;
                                        case "progress": return vis("progress") ? (
                                          <Td key={key} {...colStickyProps("progress", moduleRowBg)}>
                                            {mod.total_qty != null && mod.total_qty > 0 ? (() => {
                                              const pct = Math.min(100, Math.round(((mod.output_qty ?? 0) / mod.total_qty) * 100));
                                              const color = pct >= 100 ? "green.400" : pct >= 50 ? "blue.400" : "orange.400";
                                              return <Box><Text fontSize="xs" mb={0.5}>{pct}%</Text><Box w="80px" h="5px" bg="gray.200" borderRadius="full" overflow="hidden"><Box w={`${pct}%`} h="100%" bg={color} borderRadius="full" /></Box></Box>;
                                            })() : <Text color="gray.300">—</Text>}
                                          </Td>
                                        ) : null;
                                        case "status": return vis("status") ? (
                                          <Td key={key} onClick={(e) => e.stopPropagation()} {...colStickyProps("status", moduleRowBg)} {...statusColumnWidthProps}>
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
                                          </Td>
                                        ) : null;
                                        case "cycle_time": return vis("cycle_time") ? <Td key={key} isNumeric {...colStickyProps("cycle_time", moduleRowBg)}>{modTp.cycleDisplay ? <Text fontSize="xs" color="gray.400">{modTp.cycleDisplay}</Text> : <Text color="gray.300">—</Text>}</Td> : null;
                                        case "target_per_hour": return vis("target_per_hour") ? <Td key={key} isNumeric {...colStickyProps("target_per_hour", moduleRowBg)}>{modTp.targetPerHour != null ? <Text fontSize="xs" color="gray.400">{modTp.targetPerHour.toLocaleString()}</Text> : <Text color="gray.300">—</Text>}</Td> : null;
                                        case "daily_target": return vis("daily_target") ? <Td key={key} isNumeric {...colStickyProps("daily_target", moduleRowBg)}>{modTp.dailyTarget8h != null ? <Text fontSize="xs" color="gray.400">{modTp.dailyTarget8h.toLocaleString()}</Text> : <Text color="gray.300">—</Text>}</Td> : null;
                                        case "process_start": return vis("process_start") ? (
                                          <Td key={key} whiteSpace="nowrap" onClick={(e) => e.stopPropagation()} {...colStickyProps("process_start", moduleRowBg)}>
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
                                          </Td>
                                        ) : null;
                                        case "process_finish": return vis("process_finish") ? (
                                          <Td key={key} whiteSpace="nowrap" onClick={(e) => e.stopPropagation()} {...colStickyProps("process_finish", moduleRowBg)}>
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
                                          </Td>
                                        ) : null;
                                        case "lead_time": return vis("lead_time") ? <Td key={key} isNumeric {...colStickyProps("lead_time", moduleRowBg)}>{mod.process_lead_time_days != null ? (<Text fontSize="xs" fontWeight="semibold">{mod.process_lead_time_days}d</Text>) : <Text color="gray.300">—</Text>}</Td> : null;
                                        case "po_date": return vis("po_date") ? <Td key={key} {...colStickyProps("po_date", moduleRowBg)} /> : null;
                                        case "material_due_inbound": return vis("material_due_inbound") ? <Td key={key} {...colStickyProps("material_due_inbound", moduleRowBg)} /> : null;
                                        case "expected_inbound": return vis("expected_inbound") ? <Td key={key} {...colStickyProps("expected_inbound", moduleRowBg)} /> : null;
                                        case "actual_inbound_qty": return vis("actual_inbound_qty") ? <Td key={key} {...colStickyProps("actual_inbound_qty", moduleRowBg)} /> : null;
                                        case "cutting_start_date": return vis("cutting_start_date") ? <Td key={key} {...colStickyProps("cutting_start_date", moduleRowBg)} /> : null;
                                        case "vien_laser": return vis("vien_laser") ? <Td key={key} {...colStickyProps("vien_laser", moduleRowBg)} /> : null;
                                        case "printing_folding": return vis("printing_folding") ? <Td key={key} {...colStickyProps("printing_folding", moduleRowBg)} /> : null;
                                        case "sub_tg": return vis("sub_tg") ? <Td key={key} {...colStickyProps("sub_tg", moduleRowBg)} /> : null;
                                        case "sub_vl": return vis("sub_vl") ? <Td key={key} {...colStickyProps("sub_vl", moduleRowBg)} /> : null;
                                        case "pre": return vis("pre") ? <Td key={key} {...colStickyProps("pre", moduleRowBg)} /> : null;
                                        case "scom": return vis("scom") ? <Td key={key} {...colStickyProps("scom", moduleRowBg)} /> : null;
                                        case "expected_date_finished": return vis("expected_date_finished") ? <Td key={key} {...colStickyProps("expected_date_finished", moduleRowBg)} /> : null;
                                        case "ex_fty_from_today": return vis("ex_fty_from_today") ? <Td key={key} {...colStickyProps("ex_fty_from_today", moduleRowBg)} /> : null;
                                        case "newness_or_repeat": return vis("newness_or_repeat") ? <Td key={key} {...colStickyProps("newness_or_repeat", moduleRowBg)} /> : null;
                                        case "keep": return vis("keep") ? <Td key={key} {...colStickyProps("keep", moduleRowBg)} /> : null;
                                        case "balance_expected_finish_date": return vis("balance_expected_finish_date") ? <Td key={key} {...colStickyProps("balance_expected_finish_date", moduleRowBg)} /> : null;
                                        case "issue_or_not": return vis("issue_or_not") ? <Td key={key} {...colStickyProps("issue_or_not", moduleRowBg)} /> : null;
                                        case "final": return vis("final") ? <Td key={key} {...colStickyProps("final", moduleRowBg)} /> : null;
                                        case "daily_target_80": return vis("daily_target_80") ? <Td key={key} {...colStickyProps("daily_target_80", moduleRowBg)} /> : null;
                                        case "gong_in": return vis("gong_in") ? <Td key={key} {...colStickyProps("gong_in", moduleRowBg)} /> : null;
                                        case "total_cmt": return vis("total_cmt") ? <Td key={key} {...colStickyProps("total_cmt", moduleRowBg)} /> : null;
                                        case "actual_cmt": return vis("actual_cmt") ? <Td key={key} {...colStickyProps("actual_cmt", moduleRowBg)} /> : null;
                                        case "unit_fob": return vis("unit_fob") ? <Td key={key} {...colStickyProps("unit_fob", moduleRowBg)} /> : null;
                                        case "total_fob": return vis("total_fob") ? <Td key={key} {...colStickyProps("total_fob", moduleRowBg)} /> : null;
                                        case "actual_fob": return vis("actual_fob") ? <Td key={key} {...colStickyProps("actual_fob", moduleRowBg)} /> : null;
                                        case "remark": return vis("remark") ? <Td key={key} {...colStickyProps("remark", moduleRowBg)} /> : null;
                                        default: return null;
                                      }
                                    })}
                                    {renderVlCalendarCells({
                                      kind: "module",
                                      mod,
                                      rowBg: moduleRowBg,
                                    })}
                                  </Tr>

                                  {/* ── Process Rows (P) ── */}
                                  {isModExpanded && mod.ep_processes.map((p) => (
                                    <Tr key={`p-${p.pk}`} bgColor={processRowBg}>
                                      <Td px={1} pl={procPl} minW="40px" position="sticky" left={0} zIndex={1} bgColor={processRowBg} {...lgBorder}><Box w="24px" /></Td>
                                      {columnOrder.map(key => {
                                        switch (key) {
                                          case "production_line": return visInfo("production_line") ? <Td key={key} whiteSpace="nowrap" {...colStickyProps("production_line", processRowBg)}><Text color="gray.400" fontSize="xs">{s.production_line_name || "-"}</Text></Td> : null;
                                          case "sj_po_number": return vis("sj_po_number") ? <Td key={key} whiteSpace="nowrap" {...colStickyProps("sj_po_number", processRowBg)}><Text color="gray.400" fontSize="xs">{o?.sj_po_number ?? s.pk}</Text></Td> : null;
                                          case "sj_no": return visInfo("sj_no") ? <Td key={key} whiteSpace="nowrap" {...colStickyProps("sj_no", processRowBg)}><Text color="gray.400" fontSize="xs">{sj.sj_no || "-"}</Text></Td> : null;
                                          case "color": return visInfo("color") ? <Td key={key} {...colStickyProps("color", processRowBg)}><Text color="gray.400" fontSize="xs">{o?.color || "-"}</Text></Td> : null;
                                          case "total_qty": return visInfo("total_qty") ? (
                                            <Td key={key} isNumeric {...colStickyProps("total_qty", processRowBg)}>
                                              <Text color="gray.400" fontSize="xs">{p.total_qty != null ? p.total_qty.toLocaleString() : "-"}</Text>
                                            </Td>
                                          ) : null;
                                          case "assembly_output_qty": return visInfo("assembly_output_qty") ? <Td key={key} isNumeric {...colStickyProps("assembly_output_qty", processRowBg)}><Text color="gray.400" fontSize="xs">{s.production_assembly_output_qty != null ? s.production_assembly_output_qty.toLocaleString() : "-"}</Text></Td> : null;
                                          case "ex_factory_1st": return visInfo("ex_factory_1st") ? <Td key={key} whiteSpace="nowrap" {...colStickyProps("ex_factory_1st", processRowBg)}><Text color="gray.400" fontSize="xs">{fmtDate(o?.ex_factory_date)}</Text></Td> : null;
                                          case "ex_factory_2nd": return vis("ex_factory_2nd") ? <Td key={key} {...colStickyProps("ex_factory_2nd", processRowBg)} /> : null;
                                          case "ex_country": return vis("ex_country") ? <Td key={key} {...colStickyProps("ex_country", processRowBg)} /> : null;
                                          case "air_or_vessel": return vis("air_or_vessel") ? <Td key={key} {...colStickyProps("air_or_vessel", processRowBg)} /> : null;
                                          case "ef_buffer": return vis("ef_buffer") ? (() => {
                                            const procOut = p.output_qty ?? 0;
                                            const procTotal = p.total_qty ?? 0;
                                            const procBal = Math.max(0, procTotal - procOut);
                                            const dailyTgtP = p.daily_target_qty_8h ?? null;
                                            const efResult = calcEfBuffer(procBal, procOut, p.process_start_date, p.process_finish_date, p.process_finish_date, calendarTodayYmd, vlPlanHolidayYmdSet, dailyTgtP);
                                            return <Td key={key} whiteSpace="nowrap" textAlign="right" {...colStickyProps("ef_buffer", processRowBg)}><EfBufferCell result={efResult} size="xs" /></Td>;
                                          })() : null;
                                          case "schedule_spi": return vis("schedule_spi") ? (() => {
                                            const procOut = p.output_qty ?? 0;
                                            const procTotal = p.total_qty ?? 0;
                                            const spiResult = calcSpi(procTotal, procOut, p.process_start_date, p.process_finish_date, calendarTodayYmd, vlPlanHolidayYmdSet);
                                            return <Td key={key} whiteSpace="nowrap" textAlign="right" {...colStickyProps("schedule_spi", processRowBg)}><SpiCell result={spiResult} size="xs" /></Td>;
                                          })() : null;
                                          case "assembly_start": return visInfo("assembly_start") ? <Td key={key} whiteSpace="nowrap" {...colStickyProps("assembly_start", processRowBg)}><Text color="gray.400" fontSize="xs">{fmtDate(s.production_assembly_start_date)}</Text></Td> : null;
                                          case "assembly_finish": return visInfo("assembly_finish") ? <Td key={key} whiteSpace="nowrap" {...colStickyProps("assembly_finish", processRowBg)}><Text color="gray.400" fontSize="xs">{fmtDate(s.production_assembly_finish_date)}</Text></Td> : null;
                                          case "flow_memo": return vis("flow_memo") ? <Td key={key} {...colStickyProps("flow_memo", processRowBg)}>{p.flow ? (<Tooltip label={p.flow} placement="top" hasArrow><Text fontSize="xs" noOfLines={2} cursor="default">{p.flow}</Text></Tooltip>) : <Text color="gray.300">—</Text>}</Td> : null;
                                          case "category": return vis("category") ? <Td key={key} {...colStickyProps("category", processRowBg)}><VlAssemblyBadge kind="vlProcess" fontSize="xs" /></Td> : null;
                                          case "sub_category": return vis("sub_category") ? (
                                            <Td key={key} {...colStickyProps("sub_category", processRowBg)}>
                                              {renderModuleSubCategoryBadges(
                                                getModuleCategoryLabels(mod),
                                                `proc-${p.pk}`
                                              )}
                                            </Td>
                                          ) : null;
                                          case "media": return vis("media") ? <Td key={key} {...colStickyProps("media", processRowBg)}>{p.standard_work_video_url ? (<Tooltip label="View Standard Work Video" placement="top"><IconButton aria-label="View Standard Work Video" icon={<FaVideo />} size="xs" variant="ghost" colorScheme="red" onClick={() => { setSelectedVideo(p.standard_work_video_url!); setIsVideoModalOpen(true); }} /></Tooltip>) : <Text color="gray.300">—</Text>}</Td> : null;
                                          case "work_order": return vis("work_order") ? (
                                            <Td key={key} onClick={(e) => e.stopPropagation()} {...colStickyProps("work_order", processRowBg)}>
                                              {p.is_deleted ? (
                                                <Text color="gray.300">—</Text>
                                              ) : (
                                                <Tooltip label={t("vlAssembly.list.workOrderPrintTooltip")} placement="top" hasArrow>
                                                  <IconButton
                                                    aria-label={t("vlAssembly.list.workOrderPrintAria")}
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
                                                      openWindow(`/vl-assembly-production/processes/${p.pk}/work-order`);
                                                    }}
                                                  />
                                                </Tooltip>
                                              )}
                                            </Td>
                                          ) : null;
                                          case "code": return vis("code") ? <Td key={key} whiteSpace="nowrap" onClick={(e) => e.stopPropagation()} {...colStickyProps("code", processRowBg)}><Link href="#" title={p.code} fontWeight="semibold" fontSize="xs" color="blue.600" onClick={(e) => { e.preventDefault(); e.stopPropagation(); openWindow(`/vl-assembly-production/processes/${p.pk}`); }}>{p.code}</Link></Td> : null;
                                          case "style_name": return vis("style_name") ? <Td key={key} whiteSpace="nowrap" {...colStickyProps("style_name", processRowBg)}>{p.name || p.name_ko || "-"}</Td> : null;
                                          case "today_output_qty": return vis("today_output_qty") ? (() => {
                                            const procTodayOut = dailyQtyByProcess.get(p.pk)?.get(calendarTodayYmd) ?? 0;
                                            const procDailyPlan = getDailyPlannedQtyFromRange(p.process_start_date, p.process_finish_date, p.total_qty ?? 0, vlPlanHolidayYmdSet)?.daily ?? null;
                                            return (
                                              <Td key={key} isNumeric {...colStickyProps("today_output_qty", processRowBg)} bg="teal.50" _dark={{ bg: "teal.900" }} onClick={(e) => e.stopPropagation()}>
                                                <TodayOutputBreakdown
                                                  todayOut={procTodayOut}
                                                  dailyTarget={p.daily_target_qty_8h ?? null}
                                                  dailyPlan={procDailyPlan}
                                                />
                                              </Td>
                                            );
                                          })() : null;
                                          case "output_qty": return vis("output_qty") ? (
                                            <Td key={key} isNumeric {...colStickyProps("output_qty", processRowBg)} onClick={(e) => e.stopPropagation()}>
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
                                                <Tooltip label={t("vlAssembly.common.outputQtyFromDailyReport")} hasArrow placement="top">
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
                                            </Td>
                                          ) : null;
                                          case "defect_qty": return vis("defect_qty") ? (
                                            <Td key={key} isNumeric {...colStickyProps("defect_qty", processRowBg)} onClick={(e) => e.stopPropagation()}>
                                              <DefectQtyLink defectQty={p.total_defect_qty ?? 0} to={`/vl-assembly-production/inspections?vl_assembly_process=${p.pk}`} />
                                            </Td>
                                          ) : null;
                                          case "balance_qty": return vis("balance_qty") ? (
                                            <Td key={key} isNumeric {...colStickyProps("balance_qty", processRowBg)}>
                                              {p.total_qty != null
                                                ? <Text fontSize="xs" fontWeight="semibold">{Math.max(0, p.total_qty - (p.output_qty ?? 0)).toLocaleString()}</Text>
                                                : <Text color="gray.300">—</Text>}
                                            </Td>
                                          ) : null;
                                          case "daily_required_qty": return vis("daily_required_qty") ? (() => {
                                            const procBalance = p.total_qty != null ? Math.max(0, p.total_qty - (p.output_qty ?? 0)) : 0;
                                            const result = calcDailyRequired(procBalance, p.process_finish_date, calendarTodayYmd, vlPlanHolidayYmdSet, p.daily_target_qty_8h ?? null);
                                            return (
                                              <Td key={key} {...colStickyProps("daily_required_qty", processRowBg)}>
                                                <DailyReqCell result={result} size="xs" />
                                              </Td>
                                            );
                                          })() : null;
                                          case "progress": return vis("progress") ? (
                                            <Td key={key} {...colStickyProps("progress", processRowBg)}>
                                              {p.total_qty != null && p.total_qty > 0 ? (() => {
                                                const pct = Math.min(100, Math.round(((p.output_qty ?? 0) / p.total_qty) * 100));
                                                const color = pct >= 100 ? "green.400" : pct >= 50 ? "blue.400" : "orange.400";
                                                return <Box><Text fontSize="xs" mb={0.5}>{pct}%</Text><Box w="80px" h="5px" bg="gray.200" borderRadius="full" overflow="hidden"><Box w={`${pct}%`} h="100%" bg={color} borderRadius="full" /></Box></Box>;
                                              })() : <Text color="gray.300">—</Text>}
                                            </Td>
                                          ) : null;
                                          case "status": return vis("status") ? (
                                            <Td key={key} onClick={(e) => e.stopPropagation()} {...colStickyProps("status", processRowBg)} {...statusColumnWidthProps}>
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
                                            </Td>
                                          ) : null;
                                          case "cycle_time": return vis("cycle_time") ? <Td key={key} isNumeric {...colStickyProps("cycle_time", processRowBg)}>{p.cycle_time ?? <Text color="gray.300">—</Text>}</Td> : null;
                                          case "target_per_hour": return vis("target_per_hour") ? <Td key={key} isNumeric {...colStickyProps("target_per_hour", processRowBg)}>{p.target_qty_per_hour ?? <Text color="gray.300">—</Text>}</Td> : null;
                                          case "daily_target": return vis("daily_target") ? <Td key={key} isNumeric {...colStickyProps("daily_target", processRowBg)}>{p.daily_target_qty_8h ?? <Text color="gray.300">—</Text>}</Td> : null;
                                          case "process_start": return vis("process_start") ? (
                                            <Td key={key} whiteSpace="nowrap" onClick={(e) => e.stopPropagation()} {...colStickyProps("process_start", processRowBg)}>
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
                                            </Td>
                                          ) : null;
                                          case "process_finish": return vis("process_finish") ? (
                                            <Td key={key} whiteSpace="nowrap" onClick={(e) => e.stopPropagation()} {...colStickyProps("process_finish", processRowBg)}>
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
                                            </Td>
                                          ) : null;
                                          case "lead_time": return vis("lead_time") ? <Td key={key} isNumeric {...colStickyProps("lead_time", processRowBg)}>{p.process_lead_time_days != null ? (<Text fontSize="xs" fontWeight="semibold">{p.process_lead_time_days}d</Text>) : <Text color="gray.300">—</Text>}</Td> : null;
                                          case "po_date": return vis("po_date") ? <Td key={key} {...colStickyProps("po_date", processRowBg)} /> : null;
                                          case "material_due_inbound": return vis("material_due_inbound") ? <Td key={key} {...colStickyProps("material_due_inbound", processRowBg)} /> : null;
                                          case "expected_inbound": return vis("expected_inbound") ? <Td key={key} {...colStickyProps("expected_inbound", processRowBg)} /> : null;
                                          case "actual_inbound_qty": return vis("actual_inbound_qty") ? <Td key={key} {...colStickyProps("actual_inbound_qty", processRowBg)} /> : null;
                                          case "cutting_start_date": return vis("cutting_start_date") ? <Td key={key} {...colStickyProps("cutting_start_date", processRowBg)} /> : null;
                                          case "vien_laser": return vis("vien_laser") ? <Td key={key} {...colStickyProps("vien_laser", processRowBg)} /> : null;
                                          case "printing_folding": return vis("printing_folding") ? <Td key={key} {...colStickyProps("printing_folding", processRowBg)} /> : null;
                                          case "sub_tg": return vis("sub_tg") ? <Td key={key} {...colStickyProps("sub_tg", processRowBg)} /> : null;
                                          case "sub_vl": return vis("sub_vl") ? <Td key={key} {...colStickyProps("sub_vl", processRowBg)} /> : null;
                                          case "pre": return vis("pre") ? <Td key={key} {...colStickyProps("pre", processRowBg)} /> : null;
                                          case "scom": return vis("scom") ? <Td key={key} {...colStickyProps("scom", processRowBg)} /> : null;
                                          case "expected_date_finished": return vis("expected_date_finished") ? <Td key={key} {...colStickyProps("expected_date_finished", processRowBg)} /> : null;
                                          case "ex_fty_from_today": return vis("ex_fty_from_today") ? <Td key={key} {...colStickyProps("ex_fty_from_today", processRowBg)} /> : null;
                                          case "newness_or_repeat": return vis("newness_or_repeat") ? <Td key={key} {...colStickyProps("newness_or_repeat", processRowBg)} /> : null;
                                          case "keep": return vis("keep") ? <Td key={key} {...colStickyProps("keep", processRowBg)} /> : null;
                                          case "balance_expected_finish_date": return vis("balance_expected_finish_date") ? <Td key={key} {...colStickyProps("balance_expected_finish_date", processRowBg)} /> : null;
                                          case "issue_or_not": return vis("issue_or_not") ? <Td key={key} {...colStickyProps("issue_or_not", processRowBg)} /> : null;
                                          case "final": return vis("final") ? <Td key={key} {...colStickyProps("final", processRowBg)} /> : null;
                                          case "daily_target_80": return vis("daily_target_80") ? <Td key={key} {...colStickyProps("daily_target_80", processRowBg)} /> : null;
                                          case "gong_in": return vis("gong_in") ? <Td key={key} {...colStickyProps("gong_in", processRowBg)} /> : null;
                                          case "total_cmt": return vis("total_cmt") ? <Td key={key} {...colStickyProps("total_cmt", processRowBg)} /> : null;
                                          case "actual_cmt": return vis("actual_cmt") ? <Td key={key} {...colStickyProps("actual_cmt", processRowBg)} /> : null;
                                          case "unit_fob": return vis("unit_fob") ? <Td key={key} {...colStickyProps("unit_fob", processRowBg)} /> : null;
                                          case "total_fob": return vis("total_fob") ? <Td key={key} {...colStickyProps("total_fob", processRowBg)} /> : null;
                                          case "actual_fob": return vis("actual_fob") ? <Td key={key} {...colStickyProps("actual_fob", processRowBg)} /> : null;
                                          case "remark": return vis("remark") ? <Td key={key} {...colStickyProps("remark", processRowBg)} /> : null;
                                          default: return null;
                                        }
                                      })}
                                      {renderVlCalendarCells({
                                        kind: "process",
                                        p,
                                        rowBg: processRowBg,
                                      })}
                                    </Tr>
                                  ))}
                                </Fragment>
                              );
                            })}
                          </Fragment>
                        );
                        });

                        if (!isMultiSJ) {
                          return renderSjRows(false);
                        }

                        // MULTI-SJ: aggregate schedule header row + SJ sub-rows
                        const scheduleTotal = sjNos.reduce((sum, sj_) => sum + (sj_.total_qty ?? 0), 0);
                        const scheduleOut = sjNos.reduce((sum, sj_) => sum + (sj_.output_qty ?? 0), 0);
                        const scheduleBalance = Math.max(0, scheduleTotal - scheduleOut);
                        const schedulePct = scheduleTotal > 0 ? Math.min(100, Math.round((scheduleOut / scheduleTotal) * 100)) : 0;
                        const scheduleBarColor = schedulePct >= 100 ? "green.400" : schedulePct >= 50 ? "blue.400" : "orange.400";
                        const scheduleDefectQty = sjNos.reduce((sum, sj_) => sum + (sj_.total_defect_qty ?? 0), 0);
                        const isScheduleExpanded = expandedSchedules.has(s.pk);
                        const isAnyRowSelected = sjNos.some(sj_ => selectedSjPk === sj_.pk);
                        const schedRowBg = isAnyRowSelected ? scheduleRowSelectedBg : scheduleRowBg;
                        const schedTp = vlSjThroughputDisplayFields(firstSj);

                        return (
                          <>
                            {/* ── Schedule Header Row (multi-SJ) ── */}
                            <Tr bgColor={schedRowBg} _hover={isAnyRowSelected ? undefined : { bgColor: scheduleRowHoverBg }}
                              borderTop="2px solid" borderTopColor="gray.300"
                              cursor="pointer"
                              data-schedule-pk={String(s.pk)}
                              sx={flashPk === s.pk ? {
                                animation: "scheduleHighlightRing 3s ease-out forwards",
                                "@keyframes scheduleHighlightRing": {
                                  "0%, 20%": { boxShadow: "inset 0 0 0 3px var(--chakra-colors-yellow-400)" },
                                  "100%": { boxShadow: "inset 0 0 0 0px transparent" },
                                },
                              } : undefined}
                              onClick={() => toggleSchedule(s.pk)}>
                              <Td px={1} minW="40px" position="sticky" left={0} zIndex={1} bgColor={schedRowBg} {...lgBorder} onClick={(e) => e.stopPropagation()}>
                                <VStack spacing={0} align="center">
                                  <IconButton aria-label="expand" icon={isScheduleExpanded ? <FaChevronDown /> : <FaChevronRight />}
                                    size="xs" variant="ghost" onClick={(e) => { e.stopPropagation(); toggleSchedule(s.pk); }} />
                                  {!isReadOnly && (
                                    <Button size="xs" variant="link" colorScheme="blue" mt={1}
                                      onClick={(e) => { e.stopPropagation(); openAddSjNoModal(s); }}>
                                      + {t("vlAssembly.list.addSjNo")}
                                    </Button>
                                  )}
                                </VStack>
                              </Td>
                              {columnOrder.map(key => {
                                switch (key) {
                                  case "production_line": return visInfo("production_line") ? <Td key={key} whiteSpace="nowrap" {...colStickyProps("production_line", schedRowBg)}>{s.production_line_name || "-"}</Td> : null;
                                  case "sj_po_number": return vis("sj_po_number") ? <Td key={key} whiteSpace="nowrap" {...colStickyProps("sj_po_number", schedRowBg)} onClick={(e) => e.stopPropagation()}><Link href="#" color="blue.500" fontWeight="semibold" onClick={(e) => { e.preventDefault(); e.stopPropagation(); openWindow(`/vl-assembly-production/${s.pk}`); }}>{o?.sj_po_number ?? s.pk}</Link><Text fontSize="2xs" color="gray.400" lineHeight={1.2}>#{s.pk}</Text></Td> : null;
                                  case "sj_no": return visInfo("sj_no") ? <Td key={key} whiteSpace="nowrap" {...colStickyProps("sj_no", schedRowBg)}><VStack align="flex-start" spacing={0}>{sjNos.map(sj_ => <Text key={sj_.pk} fontWeight="semibold" fontSize="xs">{sj_.sj_no || "-"}</Text>)}</VStack></Td> : null;
                                  case "color": return visInfo("color") ? <Td key={key} {...colStickyProps("color", schedRowBg)}>{o?.color || "-"}</Td> : null;
                                  case "total_qty": return visInfo("total_qty") ? <Td key={key} isNumeric fontWeight="semibold" {...colStickyProps("total_qty", schedRowBg)}>{scheduleTotal > 0 ? scheduleTotal.toLocaleString() : "-"}</Td> : null;
                                  case "assembly_output_qty": return visInfo("assembly_output_qty") ? (
                                    <Td key={key} isNumeric {...colStickyProps("assembly_output_qty", schedRowBg)} onClick={(e) => e.stopPropagation()}>
                                      {editingAssemblyOutQty?.pk === s.pk ? (
                                        <Input size="xs" w="80px" value={editingAssemblyOutQty.val} autoFocus
                                          onChange={(e) => setEditingAssemblyOutQty({pk: s.pk, val: e.target.value})}
                                          onBlur={() => saveAssemblyOutQty(s.pk, editingAssemblyOutQty.val)}
                                          onKeyDown={(e) => { if (e.key === "Enter") saveAssemblyOutQty(s.pk, editingAssemblyOutQty.val); if (e.key === "Escape") setEditingAssemblyOutQty(null); }}
                                        />
                                      ) : (
                                        <Text cursor="pointer" color={s.production_assembly_output_qty != null ? undefined : "gray.300"} _hover={{ textDecoration: "underline" }}
                                          onClick={() => setEditingAssemblyOutQty({pk: s.pk, val: String(s.production_assembly_output_qty ?? "")})}>
                                          {s.production_assembly_output_qty != null ? s.production_assembly_output_qty.toLocaleString() : "—"}
                                        </Text>
                                      )}
                                    </Td>
                                  ) : null;
                                  case "ex_factory_1st": return visInfo("ex_factory_1st") ? <Td key={key} whiteSpace="nowrap" {...colStickyProps("ex_factory_1st", schedRowBg)}>{fmtDate(o?.ex_factory_date)}</Td> : null;
                                  case "ex_factory_2nd": return vis("ex_factory_2nd") ? <Td key={key} whiteSpace="nowrap" {...colStickyProps("ex_factory_2nd", schedRowBg)}><Text fontSize="xs">{s.ex_factory_2nd ?? "—"}</Text></Td> : null;
                                  case "ex_country": return vis("ex_country") ? <Td key={key} whiteSpace="nowrap" {...colStickyProps("ex_country", schedRowBg)}><Text fontSize="xs">{o?.ex_country ?? "—"}</Text></Td> : null;
                                  case "air_or_vessel": return vis("air_or_vessel") ? <Td key={key} whiteSpace="nowrap" {...colStickyProps("air_or_vessel", schedRowBg)}><Text fontSize="xs">{o?.air_or_vessel ?? "—"}</Text></Td> : null;
                                  case "ef_buffer": return vis("ef_buffer") ? (() => {
                                    const efResult = calcEfBuffer(scheduleBalance, scheduleOut, s.production_assembly_start_date, s.production_assembly_finish_date, o?.ex_factory_date ?? s.production_assembly_finish_date, calendarTodayYmd, vlPlanHolidayYmdSet, schedTp.dailyTarget8h ?? null);
                                    return <Td key={key} whiteSpace="nowrap" textAlign="right" {...colStickyProps("ef_buffer", schedRowBg)}><EfBufferCell result={efResult} /></Td>;
                                  })() : null;
                                  case "schedule_spi": return vis("schedule_spi") ? (() => {
                                    const spiResult = calcSpi(scheduleTotal, scheduleOut, s.production_assembly_start_date, s.production_assembly_finish_date, calendarTodayYmd, vlPlanHolidayYmdSet);
                                    return <Td key={key} whiteSpace="nowrap" textAlign="right" {...colStickyProps("schedule_spi", schedRowBg)}><SpiCell result={spiResult} /></Td>;
                                  })() : null;
                                  case "assembly_start": return visInfo("assembly_start") ? <Td key={key} whiteSpace="nowrap" {...colStickyProps("assembly_start", schedRowBg)}>{fmtDate(s.production_assembly_start_date)}</Td> : null;
                                  case "assembly_finish": return visInfo("assembly_finish") ? <Td key={key} whiteSpace="nowrap" {...colStickyProps("assembly_finish", schedRowBg)}>{fmtDate(s.production_assembly_finish_date)}</Td> : null;
                                  case "flow_memo": return vis("flow_memo") ? <Td key={key} {...colStickyProps("flow_memo", schedRowBg)}><Text color="gray.300">—</Text></Td> : null;
                                  case "category": return vis("category") ? <Td key={key} {...colStickyProps("category", schedRowBg)}><VlAssemblyBadge kind="vlSj" fontSize="xs" /></Td> : null;
                                  case "sub_category": return vis("sub_category") ? <Td key={key} {...colStickyProps("sub_category", schedRowBg)}>{renderModuleSubCategoryBadges(getAggregateSjCategoryLabels(sjNos.flatMap(sj_ => sj_.ep_modules ?? [])), `schedule-${s.pk}`)}</Td> : null;
                                  case "media": return vis("media") ? (() => {
                                    const thumb = firstSj.sj_style_thumbnail ?? o?.sj_style?.thumbnail ?? null;
                                    return <Td key={key} onClick={(e) => e.stopPropagation()} {...colStickyProps("media", schedRowBg)}>{thumb ? (<Tooltip label="View Style Photo" placement="top"><Box as="img" src={thumb} alt="style" w="36px" h="36px" objectFit="cover" borderRadius="sm" cursor="pointer" onClick={() => openPhoto(thumb)} /></Tooltip>) : <Text color="gray.300">—</Text>}</Td>;
                                  })() : null;
                                  case "work_order": return vis("work_order") ? <Td key={key} {...colStickyProps("work_order", schedRowBg)}><Text color="gray.300">—</Text></Td> : null;
                                  case "code": return vis("code") ? <Td key={key} whiteSpace="nowrap" onClick={(e) => e.stopPropagation()} {...colStickyProps("code", schedRowBg)}><VStack align="flex-start" spacing={0}>{sjNos.map(sj_ => sj_.sj_no ? <Link key={sj_.pk} href="#" title={sj_.sj_no} fontWeight="semibold" fontSize="xs" color="blue.600" onClick={(e) => { e.preventDefault(); e.stopPropagation(); openWindow(`/vl-assembly-production/sj-nos/${sj_.pk}`); }}>{sj_.sj_no}</Link> : null)}</VStack></Td> : null;
                                  case "style_name": return vis("style_name") ? <Td key={key} whiteSpace="nowrap" {...colStickyProps("style_name", schedRowBg)}>{o?.style_name || "-"}</Td> : null;
                                  case "today_output_qty": return vis("today_output_qty") ? (() => {
                                    const sTodayOut = (() => {
                                      const sjNos = s.ep_sj_nos ?? [];
                                      if (sjNos.length > 0) {
                                        return sjNos.reduce((sum, sj) => sum + (dailyQtyBySjNo.get(sj.pk)?.get(calendarTodayYmd) ?? 0), 0);
                                      }
                                      return dailyQtyBySchedule.get(s.pk)?.get(calendarTodayYmd) ?? 0;
                                    })();
                                    const sDailyPlan = getAssemblyDailyPlannedQtyFromTotal(s, scheduleTotal, vlPlanHolidayYmdSet)?.daily ?? null;
                                    return <Td key={key} isNumeric {...colStickyProps("today_output_qty", schedRowBg)} bg="teal.50" _dark={{ bg: "teal.900" }} onClick={(e) => e.stopPropagation()}><TodayOutputBreakdown todayOut={sTodayOut} dailyTarget={schedTp.dailyTarget8h ?? null} dailyPlan={sDailyPlan} /></Td>;
                                  })() : null;
                                  case "output_qty": return vis("output_qty") ? <Td key={key} isNumeric {...colStickyProps("output_qty", schedRowBg)} onClick={(e) => e.stopPropagation()}><EpFlashQty value={scheduleOut}>{scheduleOut.toLocaleString()}</EpFlashQty></Td> : null;
                                  case "defect_qty": return vis("defect_qty") ? <Td key={key} isNumeric {...colStickyProps("defect_qty", schedRowBg)} onClick={(e) => e.stopPropagation()}><DefectQtyLink defectQty={scheduleDefectQty} to={`/vl-assembly-production/inspections?vl_assembly_schedule=${s.pk}`} /></Td> : null;
                                  case "balance_qty": return vis("balance_qty") ? <Td key={key} isNumeric fontWeight="semibold" {...colStickyProps("balance_qty", schedRowBg)}>{scheduleTotal > 0 ? scheduleBalance.toLocaleString() : "-"}</Td> : null;
                                  case "daily_required_qty": return vis("daily_required_qty") ? (() => {
                                    const deadline = s.production_assembly_finish_date ?? s.sj_order_info?.ex_factory_date ?? null;
                                    const result = calcDailyRequired(scheduleBalance, deadline, calendarTodayYmd, vlPlanHolidayYmdSet, schedTp.dailyTarget8h ?? null);
                                    return <Td key={key} {...colStickyProps("daily_required_qty", schedRowBg)}><DailyReqCell result={result} /></Td>;
                                  })() : null;
                                  case "progress": return vis("progress") ? <Td key={key} {...colStickyProps("progress", schedRowBg)}>{scheduleTotal > 0 ? (<Box><Text fontSize="xs" mb={0.5}>{schedulePct}%</Text><Box w="80px" h="5px" bg="gray.200" borderRadius="full" overflow="hidden"><Box w={`${schedulePct}%`} h="100%" bg={scheduleBarColor} borderRadius="full" /></Box></Box>) : <Text color="gray.300">—</Text>}</Td> : null;
                                  case "status": return vis("status") ? <Td key={key} onClick={(e) => e.stopPropagation()} {...colStickyProps("status", schedRowBg)} {...statusColumnWidthProps}><Text fontSize="xs" color="gray.400">—</Text></Td> : null;
                                  case "cycle_time": return vis("cycle_time") ? <Td key={key} isNumeric {...colStickyProps("cycle_time", schedRowBg)}>{schedTp.cycleDisplay ?? <Text color="gray.300">—</Text>}</Td> : null;
                                  case "target_per_hour": return vis("target_per_hour") ? <Td key={key} isNumeric {...colStickyProps("target_per_hour", schedRowBg)}>{schedTp.targetPerHour != null ? schedTp.targetPerHour.toLocaleString() : <Text color="gray.300">—</Text>}</Td> : null;
                                  case "daily_target": return vis("daily_target") ? <Td key={key} isNumeric {...colStickyProps("daily_target", schedRowBg)}>{schedTp.dailyTarget8h != null ? schedTp.dailyTarget8h.toLocaleString() : <Text color="gray.300">—</Text>}</Td> : null;
                                  case "process_start": return vis("process_start") ? <Td key={key} whiteSpace="nowrap" {...colStickyProps("process_start", schedRowBg)}>{fmtDate(s.process_start_date)}</Td> : null;
                                  case "process_finish": return vis("process_finish") ? <Td key={key} whiteSpace="nowrap" {...colStickyProps("process_finish", schedRowBg)}>{fmtDate(s.process_finish_date)}</Td> : null;
                                  case "lead_time": return vis("lead_time") ? <Td key={key} isNumeric {...colStickyProps("lead_time", schedRowBg)}>{s.process_lead_time_days != null ? (<Box textAlign="right"><Text as="span" fontWeight="semibold">{s.process_lead_time_days}d</Text>{(s.process_sundays_excluded_count ?? 0) > 0 && (<Text fontSize="10px" color="orange.400" whiteSpace="nowrap">{t("vlAssembly.common.sundayExcluded", { count: s.process_sundays_excluded_count })}</Text>)}</Box>) : <Text color="gray.300">—</Text>}</Td> : null;
                                  case "po_date": return vis("po_date") ? <Td key={key} whiteSpace="nowrap" {...colStickyProps("po_date", schedRowBg)}><Text fontSize="xs">{o?.po_date ?? "—"}</Text></Td> : null;
                                  case "material_due_inbound": return vis("material_due_inbound") ? <Td key={key} whiteSpace="nowrap" {...colStickyProps("material_due_inbound", schedRowBg)}>{fmtDate(s.due_inbound_date_prep_material)}</Td> : null;
                                  case "expected_inbound": return vis("expected_inbound") ? <Td key={key} whiteSpace="nowrap" {...colStickyProps("expected_inbound", schedRowBg)}>{fmtDate(s.expected_prep_material_inbound_date)}</Td> : null;
                                  case "actual_inbound_qty": return vis("actual_inbound_qty") ? (
                                    <Td key={key} isNumeric onClick={(e) => e.stopPropagation()} {...colStickyProps("actual_inbound_qty", schedRowBg)}>
                                      {editingActualInboundQty?.pk === s.pk ? (
                                        <Input size="xs" w="80px" type="number" min={0} autoFocus value={editingActualInboundQty.val}
                                          onChange={(e) => setEditingActualInboundQty({ pk: s.pk, val: e.target.value })}
                                          onBlur={() => saveActualInboundQty(s.pk, editingActualInboundQty.val)}
                                          onKeyDown={(e) => { if (e.key === "Enter") saveActualInboundQty(s.pk, editingActualInboundQty.val); if (e.key === "Escape") setEditingActualInboundQty(null); }}
                                        />
                                      ) : (
                                        <Text cursor="pointer" _hover={{ textDecoration: "underline" }} color={s.actual_inbound_prep_material_qty != null ? undefined : "gray.300"}
                                          onClick={() => setEditingActualInboundQty({ pk: s.pk, val: String(s.actual_inbound_prep_material_qty ?? "") })}>
                                          {s.actual_inbound_prep_material_qty != null ? s.actual_inbound_prep_material_qty.toLocaleString() : "—"}
                                        </Text>
                                      )}
                                    </Td>
                                  ) : null;
                                  case "cutting_start_date": return vis("cutting_start_date") ? <Td key={key} whiteSpace="nowrap" {...colStickyProps("cutting_start_date", schedRowBg)}><Text fontSize="xs">{s.cutting_start_date ?? "—"}</Text></Td> : null;
                                  case "vien_laser": return vis("vien_laser") ? <Td key={key} whiteSpace="nowrap" {...colStickyProps("vien_laser", schedRowBg)}><Text fontSize="xs">{s.vien_laser ?? "—"}</Text></Td> : null;
                                  case "printing_folding": return vis("printing_folding") ? <Td key={key} whiteSpace="nowrap" {...colStickyProps("printing_folding", schedRowBg)}><Text fontSize="xs">{s.printing_folding ?? "—"}</Text></Td> : null;
                                  case "sub_tg": return vis("sub_tg") ? <Td key={key} whiteSpace="nowrap" {...colStickyProps("sub_tg", schedRowBg)}><Text fontSize="xs">{s.sub_tg ?? "—"}</Text></Td> : null;
                                  case "sub_vl": return vis("sub_vl") ? <Td key={key} whiteSpace="nowrap" {...colStickyProps("sub_vl", schedRowBg)}><Text fontSize="xs">{s.sub_vl ?? "—"}</Text></Td> : null;
                                  case "pre": return vis("pre") ? <Td key={key} whiteSpace="nowrap" {...colStickyProps("pre", schedRowBg)}><Text fontSize="xs">{s.pre ?? "—"}</Text></Td> : null;
                                  case "scom": return vis("scom") ? <Td key={key} whiteSpace="nowrap" {...colStickyProps("scom", schedRowBg)}><Text fontSize="xs">{s.scom ?? "—"}</Text></Td> : null;
                                  case "expected_date_finished": return vis("expected_date_finished") ? <Td key={key} whiteSpace="nowrap" {...colStickyProps("expected_date_finished", schedRowBg)}><Text fontSize="xs">{s.expected_date_finished ?? "—"}</Text></Td> : null;
                                  case "ex_fty_from_today": return vis("ex_fty_from_today") ? (() => {
                                    const efDate = o?.ex_factory_date ? parseLocalMidnightFromIso(o.ex_factory_date) : null;
                                    const todayMs = parseYmdLocal(calendarTodayYmd).getTime();
                                    const days = efDate ? Math.ceil((efDate.getTime() - todayMs) / 86400000) : null;
                                    return <Td key={key} isNumeric {...colStickyProps("ex_fty_from_today", schedRowBg)}>{days != null ? <Text fontWeight="semibold" color={days < 0 ? "red.500" : days <= 7 ? "orange.500" : "green.600"} fontSize="xs">{days}d</Text> : <Text color="gray.300">—</Text>}</Td>;
                                  })() : null;
                                  case "newness_or_repeat": return vis("newness_or_repeat") ? <Td key={key} whiteSpace="nowrap" {...colStickyProps("newness_or_repeat", schedRowBg)}><Text fontSize="xs">{o?.newness_or_repeat ?? "—"}</Text></Td> : null;
                                  case "keep": return vis("keep") ? <Td key={key} whiteSpace="nowrap" {...colStickyProps("keep", schedRowBg)}><Text fontSize="xs">{s.keep ?? "—"}</Text></Td> : null;
                                  case "balance_expected_finish_date": return vis("balance_expected_finish_date") ? <Td key={key} whiteSpace="nowrap" {...colStickyProps("balance_expected_finish_date", schedRowBg)}><Text fontSize="xs">{s.balance_expected_finish_date ?? "—"}</Text></Td> : null;
                                  case "issue_or_not": return vis("issue_or_not") ? <Td key={key} {...colStickyProps("issue_or_not", schedRowBg)}><Text fontSize="xs">{s.issue_or_not ?? "—"}</Text></Td> : null;
                                  case "final": return vis("final") ? <Td key={key} whiteSpace="nowrap" {...colStickyProps("final", schedRowBg)}><Text fontSize="xs">{s.final ?? "—"}</Text></Td> : null;
                                  case "daily_target_80": return vis("daily_target_80") ? <Td key={key} isNumeric {...colStickyProps("daily_target_80", schedRowBg)}>{schedTp.dailyTarget8h != null ? <Text fontWeight="semibold" fontSize="xs">{Math.round(schedTp.dailyTarget8h * 0.8).toLocaleString()}</Text> : <Text color="gray.300">—</Text>}</Td> : null;
                                  case "gong_in": return vis("gong_in") ? <Td key={key} whiteSpace="nowrap" {...colStickyProps("gong_in", schedRowBg)}><Text fontSize="xs">{o?.gong_in ?? "—"}</Text></Td> : null;
                                  case "total_cmt": return vis("total_cmt") ? <Td key={key} whiteSpace="nowrap" {...colStickyProps("total_cmt", schedRowBg)}><Text fontSize="xs">{o?.total_cmt ?? "—"}</Text></Td> : null;
                                  case "actual_cmt": return vis("actual_cmt") ? <Td key={key} whiteSpace="nowrap" {...colStickyProps("actual_cmt", schedRowBg)}><Text fontSize="xs">{o?.actual_cmt ?? "—"}</Text></Td> : null;
                                  case "unit_fob": return vis("unit_fob") ? <Td key={key} whiteSpace="nowrap" {...colStickyProps("unit_fob", schedRowBg)}><Text fontSize="xs">{o?.unit_fob ?? "—"}</Text></Td> : null;
                                  case "total_fob": return vis("total_fob") ? <Td key={key} whiteSpace="nowrap" {...colStickyProps("total_fob", schedRowBg)}><Text fontSize="xs">{o?.total_fob ?? "—"}</Text></Td> : null;
                                  case "actual_fob": return vis("actual_fob") ? <Td key={key} whiteSpace="nowrap" {...colStickyProps("actual_fob", schedRowBg)}><Text fontSize="xs">{o?.actual_fob ?? "—"}</Text></Td> : null;
                                  case "remark": return vis("remark") ? <Td key={key} {...colStickyProps("remark", schedRowBg)}>{s.remark ? (<Tooltip label={s.remark} placement="top" hasArrow><Text fontSize="xs" noOfLines={2} cursor="default">{s.remark}</Text></Tooltip>) : <Text color="gray.300">—</Text>}</Td> : null;
                                  default: return null;
                                }
                              })}
                              {renderVlCalendarCells({
                                kind: "schedule",
                                schedule: s,
                                rowBg: schedRowBg,
                                showScheduleDailyQty: true,
                                showSchedulePeriodInCalendar: true,
                                firstSJTotalQty: scheduleTotal || null,
                              })}
                            </Tr>

                            {/* ── SJ Sub-rows (multi-SJ, when expanded) ── */}
                            {isScheduleExpanded && renderSjRows(true)}
                          </>
                        );
                      })()}
                    </Fragment>
                  );
                })}
                    </Fragment>
                  );
                })}
              </Tbody>
            </Table>
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

      <Modal
        isOpen={isPlanHolidayModalOpen}
        onClose={onPlanHolidayModalClose}
        size="lg"
        isCentered
        scrollBehavior="inside"
      >
        <ModalOverlay />
        <ModalContent maxH="85vh">
          <ModalHeader>{t("vlAssembly.list.planHolidaysModalTitle")}</ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={3}>
            <Text fontSize="sm" color="gray.600" mb={3}>
              {t("vlAssembly.list.planHolidaysModalLead")}
            </Text>
            <SimpleGrid columns={{ base: 1, sm: 3 }} spacing={3} mb={2} alignItems="flex-end">
              <FormControl>
                <FormLabel fontSize="sm">{t("vlAssembly.list.planHolidayDateFromLabel")}</FormLabel>
                <Input
                  type="date"
                  size="sm"
                  value={planHolidayDateFrom}
                  onChange={(e) => setPlanHolidayDateFrom(e.target.value)}
                />
              </FormControl>
              <FormControl>
                <FormLabel fontSize="sm">{t("vlAssembly.list.planHolidayDateToLabel")}</FormLabel>
                <Input
                  type="date"
                  size="sm"
                  value={planHolidayDateTo}
                  onChange={(e) => setPlanHolidayDateTo(e.target.value)}
                />
              </FormControl>
              <FormControl>
                <FormLabel fontSize="sm">{t("vlAssembly.list.planHolidayNameLabel")}</FormLabel>
                <Input
                  size="sm"
                  placeholder={t("vlAssembly.list.planHolidayNamePlaceholder")}
                  value={planHolidayFormName}
                  onChange={(e) => setPlanHolidayFormName(e.target.value)}
                />
              </FormControl>
            </SimpleGrid>
            <Text fontSize="xs" color="gray.500" mb={4}>
              {t("vlAssembly.list.planHolidayRangeHint", {
                max: PLAN_HOLIDAY_MAX_RANGE_DAYS,
              })}
            </Text>
            <HStack justify="flex-end" mb={4}>
              <Button
                size="sm"
                colorScheme="blue"
                isLoading={planHolidaySaving}
                onClick={() => void submitPlanHoliday()}
              >
                {t("vlAssembly.list.planHolidaySubmit")}
              </Button>
            </HStack>
            {vlPlanHolidayRows.length === 0 ? (
              <Text fontSize="sm" color="gray.500">
                {t("vlAssembly.list.planHolidayEmpty")}
              </Text>
            ) : (
              <TableContainer maxH="40vh" overflowY="auto" borderWidth="1px" borderRadius="md">
                <Table size="sm">
                  <Thead position="sticky" top={0} bg={planHolidayModalTheadBg} zIndex={1}>
                    <Tr>
                      <Th>{t("vlAssembly.list.planHolidayDateLabel")}</Th>
                      <Th>{t("vlAssembly.list.planHolidayNameLabel")}</Th>
                      <Th w="80px">{t("vlAssembly.list.planHolidayRemoveCol")}</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {[...vlPlanHolidayRows]
                      .sort((a, b) => String(a.date).localeCompare(String(b.date)))
                      .map((h) => (
                        <Tr key={h.pk}>
                          <Td whiteSpace="nowrap">{String(h.date).slice(0, 10)}</Td>
                          <Td>{h.name?.trim() ? h.name : "—"}</Td>
                          <Td>
                            <Button
                              size="xs"
                              variant="ghost"
                              colorScheme="red"
                              onClick={() => void removePlanHoliday(h.pk)}
                            >
                              {t("vlAssembly.list.planHolidayRemove")}
                            </Button>
                          </Td>
                        </Tr>
                      ))}
                  </Tbody>
                </Table>
              </TableContainer>
            )}
          </ModalBody>
          <ModalFooter>
            <Button size="sm" variant="outline" onClick={onPlanHolidayModalClose}>
              {t("vlAssembly.list.planHolidayModalClose")}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Create Modal */}
      <Modal isOpen={isOpen} onClose={() => { resetModal(); onClose(); }} size="2xl" isCentered scrollBehavior="inside">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>{t("vlAssembly.list.newSchedule")}</ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={2}>
            <Grid templateColumns="1fr 1fr" gap={4}>

              {/* ── SJ Order 검색 (다중 선택) ── */}
              <FormControl isRequired gridColumn="1 / -1">
                <FormLabel fontSize="sm">SJ Order <Text as="span" color="gray.400" fontWeight="normal">(SJ PO# 또는 SJ No 검색)</Text></FormLabel>
                <Text fontSize="xs" color="gray.500" mb={2}>{t("vlAssembly.list.sjOrderMultiHint")}</Text>
                <Box position="relative">
                  <InputGroup>
                    <Input
                      value={orderQuery}
                      onChange={(e) => handleOrderSearch(e.target.value)}
                      placeholder="예: SJ-2024-001 또는 SJ-NO-123"
                      autoComplete="off"
                      borderColor={selectedOrders.length > 0 ? "green.400" : undefined}
                    />
                    {orderSearching && (
                      <InputRightElement><Spinner size="sm" color="gray.400" /></InputRightElement>
                    )}
                    {selectedOrders.length > 0 && !orderSearching && (
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
                          onClick={() => addSelectedOrder(order)}
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
                {selectedOrders.length > 0 && (
                  <Wrap mt={2} spacing={2}>
                    {selectedOrders.map((order) => (
                      <WrapItem key={order.pk}>
                        <Badge colorScheme="green" px={2} py={1} borderRadius="md" display="flex" alignItems="center" gap={1}>
                          <Box>
                            <Text fontSize="xs" fontWeight="bold">{order.sj_po_number}</Text>
                            <Text fontSize="10px" color="green.700">
                              {[order.sj_no_value, order.style_name].filter(Boolean).join(" · ")}
                            </Text>
                          </Box>
                          <IconButton
                            aria-label="Remove order"
                            icon={<FaTimes />}
                            size="xs"
                            variant="ghost"
                            colorScheme="green"
                            onClick={() => removeSelectedOrder(order.pk)}
                          />
                        </Badge>
                      </WrapItem>
                    ))}
                  </Wrap>
                )}
              </FormControl>

              <FormControl gridColumn="1 / -1">
                <FormLabel fontSize="sm">{t("vlAssembly.scheduleDetail.exFactory")}</FormLabel>
                <LocalizedDateInput
                  value={form.ex_factory_date}
                  onChange={(v) => setForm({ ...form, ex_factory_date: v })}
                  allowClear
                />
                <Text fontSize="xs" color="gray.500" mt={1}>
                  {t("vlAssembly.list.exFactoryHint")}
                </Text>
              </FormControl>

              <SimpleGrid columns={{ base: 1, md: 2 }} gap={4} gridColumn="1 / -1" w="100%">
                <FormControl>
                  <FormLabel fontSize="sm">{t("vlAssembly.list.factoryField")}</FormLabel>
                  <Select
                    placeholder={t("vlAssembly.list.factoryPlaceholder")}
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
                    <option value="">{t("vlAssembly.list.factoryNone")}</option>
                    {factoriesFromLines.map((fac) => (
                      <option key={fac.pk} value={String(fac.pk)}>
                        {fac.name}
                      </option>
                    ))}
                  </Select>
                </FormControl>
                <FormControl>
                  <FormLabel fontSize="sm">{t("vlAssembly.list.productionLineField")}</FormLabel>
                  <Select
                    placeholder={t("vlAssembly.list.productionLinePlaceholder")}
                    value={form.production_line === "" ? "" : String(form.production_line)}
                    onChange={(e) => {
                      const v = e.target.value;
                      setForm({ ...form, production_line: v === "" ? "" : v });
                    }}
                    isDisabled={productionLinesLoading || form.factory === ""}
                  >
                    <option value="">{t("vlAssembly.list.productionLineNone")}</option>
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
                  {t("vlAssembly.list.productionLineHint")}
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
                <FormLabel fontSize="sm">{t("vlAssembly.list.moduleCategoryLabel")}</FormLabel>
                <Text fontSize="xs" color="gray.500" mb={2}>
                  {t("vlAssembly.list.moduleCategoryHint")}
                </Text>
                {moduleCategoriesLoading ? (
                  <Spinner size="sm" color="gray.400" />
                ) : moduleCategoryRootCount === 0 ? (
                  <Text fontSize="sm" color="gray.500">
                    {t("vlAssembly.list.moduleCategoryEmpty")}
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

      {/* Add SJ No Modal */}
      <Modal isOpen={isAddSjNoOpen} onClose={() => { resetAddSjNoModal(); onAddSjNoClose(); }} size="lg" isCentered scrollBehavior="inside">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>{t("vlAssembly.list.addSjNoTitle")}</ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={2}>
            <FormControl isRequired mb={4}>
              <FormLabel fontSize="sm">SJ Order</FormLabel>
              <Box position="relative">
                <InputGroup>
                  <Input
                    value={addSjNoOrderQuery}
                    onChange={(e) => handleAddSjNoOrderSearch(e.target.value)}
                    placeholder="예: SJ-2024-001 또는 SJ-NO-123"
                    autoComplete="off"
                  />
                  {addSjNoOrderSearching && (
                    <InputRightElement><Spinner size="sm" color="gray.400" /></InputRightElement>
                  )}
                </InputGroup>
                {addSjNoOrderResults.length > 0 && (
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
                    maxH="200px"
                    overflowY="auto"
                    mt={1}
                  >
                    {addSjNoOrderResults.map((order) => (
                      <ListItem
                        key={order.pk}
                        px={3}
                        py={2}
                        cursor="pointer"
                        _hover={{ bg: "blue.50" }}
                        onClick={() => selectAddSjNoOrder(order)}
                      >
                        <Text fontSize="sm" fontWeight="bold">{order.sj_po_number}</Text>
                        {order.sj_no_value && <Text fontSize="xs" color="gray.500">SJ No: {order.sj_no_value}</Text>}
                      </ListItem>
                    ))}
                  </List>
                )}
              </Box>
              {addSjNoSelectedOrder && (
                <Badge mt={2} colorScheme="green">{addSjNoSelectedOrder.sj_po_number}</Badge>
              )}
            </FormControl>
            <FormControl isRequired>
              <FormLabel fontSize="sm">{t("vlAssembly.list.moduleCategoryLabel")}</FormLabel>
              {moduleCategoriesLoading ? (
                <Spinner size="sm" color="gray.400" />
              ) : (
                <Box maxH="220px" overflowY="auto" pr={1}>
                  <ModuleCategoryCheckboxTree
                    parentPk={null}
                    depth={0}
                    childrenByParent={moduleCategoryChildrenByParent}
                    selectedIds={addSjNoModuleCategoryIds}
                    onToggle={toggleAddSjNoModuleCategory}
                  />
                </Box>
              )}
            </FormControl>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={() => { resetAddSjNoModal(); onAddSjNoClose(); }}>Cancel</Button>
            <Button colorScheme="blue" isLoading={isSaving} onClick={handleAddSjNo}>Add</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Move / Split SJ No Modal */}
      <Modal
        isOpen={isMoveSjNoOpen}
        onClose={() => { resetMoveSjNoModal(); onMoveSjNoClose(); }}
        size="lg"
        isCentered
      >
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>{t("vlAssembly.list.moveSjNo")}</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            {moveMode === "existing" ? (
              <FormControl isRequired>
                <FormLabel fontSize="sm">{t("vlAssembly.list.targetSchedule")}</FormLabel>
                {/* 검색 인풋 */}
                <InputGroup mb={2} size="sm">
                  <Input
                    placeholder="SJ PO#, Style, SJ No, Line 검색..."
                    value={moveTargetSearch}
                    onChange={(e) => setMoveTargetSearch(e.target.value)}
                    autoFocus
                  />
                  {moveTargetSearch && (
                    <InputRightElement>
                      <IconButton
                        size="xs"
                        variant="ghost"
                        icon={<Icon as={FaTimes} />}
                        aria-label="clear search"
                        onClick={() => setMoveTargetSearch("")}
                      />
                    </InputRightElement>
                  )}
                </InputGroup>
                {/* 스케줄 카드 리스트 */}
                <Box
                  maxH="380px"
                  overflowY="auto"
                  borderWidth="1px"
                  borderRadius="md"
                  borderColor="gray.200"
                  _dark={{ borderColor: "gray.600" }}
                >
                  {(() => {
                    const q = moveTargetSearch.trim().toLowerCase();
                    const filtered = schedules.filter((sch) => {
                      if (sch.pk === moveSourceSchedulePk) return false;
                      if (!q) return true;
                      const sjNos = (sch.ep_sj_nos ?? []).map((sn) => sn.sj_no ?? "").join(" ");
                      const haystack = [
                        sch.sj_order_info?.sj_po_number ?? "",
                        sch.sj_order_info?.style_name ?? "",
                        sch.sj_order_info?.sj_style?.style_name ?? "",
                        sch.production_line_name ?? "",
                        sjNos,
                        `#${sch.pk}`,
                      ].join(" ").toLowerCase();
                      return haystack.includes(q);
                    });
                    if (filtered.length === 0) {
                      return (
                        <Text py={6} textAlign="center" color="gray.400" fontSize="sm">
                          일치하는 스케줄이 없습니다
                        </Text>
                      );
                    }
                    return filtered.map((sch, idx) => {
                      const isSelected = moveTargetSchedulePk === sch.pk;
                      const sjNoLabels = (sch.ep_sj_nos ?? []).map((sn) => sn.sj_no).filter(Boolean);
                      const poNumber = sch.sj_order_info?.sj_po_number;
                      const styleName = sch.sj_order_info?.style_name || sch.sj_order_info?.sj_style?.style_name;
                      const totalQty = (sch.ep_sj_nos ?? []).reduce((s, sn) => s + (sn.total_qty ?? 0), 0);
                      const assemblyOut = sch.production_assembly_output_qty;
                      return (
                        <Box
                          key={sch.pk}
                          px={3}
                          py={2.5}
                          cursor="pointer"
                          bg={isSelected ? "blue.50" : "transparent"}
                          _hover={{ bg: isSelected ? "blue.100" : "gray.50" }}
                          _dark={{ bg: isSelected ? "blue.900" : "transparent", _hover: { bg: isSelected ? "blue.800" : "gray.700" } }}
                          onClick={() => setMoveTargetSchedulePk(sch.pk)}
                          borderBottomWidth={idx < filtered.length - 1 ? "1px" : 0}
                          borderBottomColor="gray.100"
                        >
                          <HStack spacing={2} align="flex-start">
                            <Badge
                              colorScheme={isSelected ? "blue" : "gray"}
                              fontSize="2xs"
                              flexShrink={0}
                              mt={0.5}
                            >
                              #{sch.pk}
                            </Badge>
                            <VStack align="flex-start" spacing={0.5} flex={1} minW={0}>
                              <HStack spacing={2} flexWrap="wrap">
                                <Text fontWeight="semibold" fontSize="sm" color={isSelected ? "blue.700" : undefined}>
                                  {poNumber ?? `Schedule #${sch.pk}`}
                                </Text>
                                {styleName && (
                                  <Text fontSize="xs" color="gray.500">{styleName}</Text>
                                )}
                              </HStack>
                              {sjNoLabels.length > 0 && (
                                <HStack spacing={1} flexWrap="wrap">
                                  {sjNoLabels.map((sn) => (
                                    <Badge key={sn} colorScheme="purple" fontSize="2xs" variant="subtle">{sn}</Badge>
                                  ))}
                                </HStack>
                              )}
                              <HStack spacing={3} flexWrap="wrap" mt={0.5}>
                                {sch.production_line_name && (
                                  <Text fontSize="2xs" color="blue.500" fontWeight="medium">{sch.production_line_name}</Text>
                                )}
                                {sch.production_assembly_start_date && (
                                  <Text fontSize="2xs" color="gray.400">
                                    {sch.production_assembly_start_date}{sch.production_assembly_finish_date ? ` ~ ${sch.production_assembly_finish_date}` : ""}
                                  </Text>
                                )}
                                {totalQty > 0 && (
                                  <Text fontSize="2xs" color="gray.500">
                                    Total {totalQty.toLocaleString()}
                                    {assemblyOut != null ? ` · Asm ${assemblyOut.toLocaleString()}` : ""}
                                  </Text>
                                )}
                                <Badge fontSize="2xs" colorScheme="gray" variant="outline">{sch.status_display}</Badge>
                              </HStack>
                            </VStack>
                          </HStack>
                        </Box>
                      );
                    });
                  })()}
                </Box>
              </FormControl>
            ) : (
              <Text fontSize="sm" color="gray.600">
                {t("vlAssembly.list.splitToNewSchedule")}
              </Text>
            )}
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={() => { resetMoveSjNoModal(); onMoveSjNoClose(); }}>Cancel</Button>
            <Button colorScheme="blue" isLoading={isSaving} onClick={handleMoveSjNo}>
              {moveMode === "existing" ? t("vlAssembly.list.moveToSchedule") : t("vlAssembly.list.splitToNewSchedule")}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
}
