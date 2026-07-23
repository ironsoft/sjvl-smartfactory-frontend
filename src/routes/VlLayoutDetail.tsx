import React from "react";
import {
  Box,
  Flex,
  Grid,
  SimpleGrid,
  Heading,
  Text,
  useColorModeValue,
  Button,
  HStack,
  VStack,
  Input,
  Table,
  TableContainer,
  Tbody,
  Td,
  Th,
  Thead,
  Tr,
  Spinner,
  Center,
  IconButton,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalCloseButton,
  useDisclosure,
  Select,
  FormControl,
  FormLabel,
  Divider,
  Accordion,
  AccordionItem,
  AccordionButton,
  AccordionPanel,
  AccordionIcon,
  Badge,
  Collapse,
  useToast,
  Link,
  Image,
  Tooltip,
  VisuallyHidden,
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverArrow,
  PopoverCloseButton,
  PopoverHeader,
  PopoverBody,
  Portal
} from "@chakra-ui/react";
import { useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { Helmet } from "react-helmet";
import { Link as RouterLink, useParams } from "react-router-dom";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  DndContext,
  DragOverlay,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent
} from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useTranslation } from "react-i18next";
import { FaArrowLeft, FaPlus, FaChevronDown, FaChevronUp, FaImage, FaVideo, FaGripVertical, FaColumns, FaChartBar, FaWineBottle, FaClock, FaTachometerAlt, FaExclamationTriangle, FaStream, FaUserFriends } from "react-icons/fa";
import { SamSortOrderBadge } from "../components/SamSortOrderBadge";
import { samCategoryColorScheme } from "../lib/samCategoryColor";
import {
  compareSamProcessBySortOrder,
  formatSamCycleSecondsDisplay,
  formatSamCycleSecondsForApi,
  parseSamSecondsField,
  sanitizeSamSecondsStringForApi,
  samProcessCycleSecondsFromFormStrings,
  samProcessCycleSecondsFromParts
} from "../lib/samProcessCycle";
import { normalizeSamProcessFk } from "../lib/samProcessFk";
import { openAppPopupWindow } from "../lib/openAppPopupWindow";
import { SamBadge } from "../components/EpBadge";
import PhotoModal from "../components/PhotoModal";
import VideoModal from "../components/VideoModal";
import { resolveMediaUrl } from "../lib/resolveMediaUrl";
import {
  getLayoutStyleDetail,
  createLayoutModule,
  patchLayoutModule,
  createLayoutProcess,
  patchLayoutProcess,
  getModuleCategories,
  getLayoutModuleDetail,
  getLayoutProcessDetail,
  getProcessDetail,
  getModuleDetail,
  getLayoutSettings,
  getLayoutTools,
  createLayoutProcessMeasurement,
  patchLayoutProcessMeasurement,
  getSjStylePhotos,
  type ILayoutStyleDetail,
  type ILayoutModule,
  type ILayoutProcess,
  type ILayoutProcessMeasurement,
  type IModuleCategory
} from "../api";
import { LayoutMeasurementEditableCell, layoutMeasurementPctDiff } from "../components/LayoutMeasurementEditableCell";
import {
  analyzeLayoutProcesses,
  analyzeLayoutProcessesForRound,
  formatAnalysisMetricNumber,
  formatCycleSumForDisplay,
  formatSamModuleCreateError,
  hasMergedProcessVideos,
  mergeUniquePhotoUrls,
  normalizeModuleCategoryPk,
  type LayoutProcessAnalysis
} from "../lib/samStyleModulesHelpers";

const compareLayoutProcessBySortOrder = compareSamProcessBySortOrder as unknown as (a: ILayoutProcess, b: ILayoutProcess) => number;

function AnalysisMetric({
  label,
  value,
  hint
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  const labelColor = useColorModeValue("gray.500", "gray.400");
  const valueColor = useColorModeValue("gray.800", "gray.100");
  return (
    <Box minW={0}>
      <Text fontSize="2xs" color={labelColor} fontWeight="semibold" textTransform="uppercase" letterSpacing="wide" noOfLines={1}>
        {label}
      </Text>
      <Tooltip label={hint || value} hasArrow isDisabled={!hint && value.length < 18}>
        <Text fontSize="sm" fontWeight="bold" color={valueColor} mt={0.5} noOfLines={1}>
          {value}
        </Text>
      </Tooltip>
    </Box>
  );
}

function AnalysisDetailSection({
  icon,
  label,
  accent,
  children
}: {
  icon: React.ReactNode;
  label: string;
  accent: KpiAccent;
  children: React.ReactNode;
}) {
  const accentColor = {
    teal: "teal.400",
    orange: "orange.400",
    blue: "blue.400",
    green: "green.400",
    gray: "gray.400"
  }[accent];
  const labelColor = useColorModeValue("gray.600", "gray.300");
  const sectionBg = useColorModeValue("white", "gray.800");
  const sectionBorder = useColorModeValue("gray.200", "gray.600");
  return (
    <Box
      borderWidth="1px"
      borderColor={sectionBorder}
      borderLeftWidth="3px"
      borderLeftColor={accentColor}
      borderRadius="md"
      bg={sectionBg}
      p={3}
    >
      <HStack spacing={1.5} mb={2} color={accentColor}>
        <Box as="span" fontSize="xs" display="inline-flex">
          {icon}
        </Box>
        <Text fontSize="2xs" fontWeight="bold" color={labelColor} textTransform="uppercase" letterSpacing="wider">
          {label}
        </Text>
      </HStack>
      {children}
    </Box>
  );
}

type KpiAccent = "teal" | "orange" | "blue" | "green" | "gray";

function AnalysisKpiCard({
  label,
  value,
  hint,
  accent,
  compact,
  latest
}: {
  label: string;
  value: string;
  hint?: string;
  accent: KpiAccent;
  compact?: boolean;
  /** 데이터가 있는 가장 마지막 VL 측정 회차 값 — 있으면 원본 값 아래에 작게 이어 붙인다 */
  latest?: React.ReactNode;
}) {
  const accentBorder = {
    teal: "teal.400",
    orange: "orange.400",
    blue: "blue.400",
    green: "green.400",
    gray: "gray.300"
  }[accent];
  const lightBg = {
    teal: "teal.50",
    orange: "orange.50",
    blue: "blue.50",
    green: "green.50",
    gray: "gray.50"
  }[accent];
  const accentBg = useColorModeValue(lightBg, "whiteAlpha.100");
  const cardBorder = useColorModeValue("gray.200", "gray.600");
  const labelColor = useColorModeValue("gray.500", "gray.400");
  const valueColor = useColorModeValue("gray.900", "gray.50");

  return (
    <Tooltip label={hint || `${label}: ${value}`} hasArrow isDisabled={!hint && value.length < 14}>
      <Box
        borderWidth="1px"
        borderColor={cardBorder}
        borderLeftWidth="3px"
        borderLeftColor={accentBorder}
        borderRadius="md"
        bg={accentBg}
        px={compact ? 2 : 2.5}
        py={compact ? 1.5 : 2}
        minW={0}
      >
        <Text fontSize="2xs" color={labelColor} fontWeight="bold" textTransform="uppercase" letterSpacing="wide" noOfLines={1}>
          {label}
        </Text>
        <Text fontSize={compact ? "sm" : "md"} fontWeight="bold" color={valueColor} mt={0.5} lineHeight="short" noOfLines={1}>
          {value}
        </Text>
        {latest}
      </Box>
    </Tooltip>
  );
}

const ROUND_COLOR_SCHEME = { 1: "blue", 2: "purple", 3: "orange" } as const;

/** KPI 카드 하단에 붙는 "가장 최근 VL 측정 회차" 값 + %변화 배지 — 회차 색상은 공정 테이블(blue/purple/orange)과 맞춘다. */
function LatestRoundKpiLine({
  round,
  text,
  diff
}: {
  round: 1 | 2 | 3;
  text: string;
  diff?: React.ReactNode;
}) {
  return (
    <HStack spacing={1} mt={1}>
      <Badge colorScheme={ROUND_COLOR_SCHEME[round]} variant="subtle" fontSize="0.55rem" px={1} py={0} borderRadius="sm">
        VL{round}
      </Badge>
      <Text fontSize="0.65rem" color="gray.500" noOfLines={1}>
        {text}
        {diff}
      </Text>
    </HStack>
  );
}

/** Original 대비 VL 1st/2nd/3rd 회차 요약 지표 비교표 — 공정 테이블의 회차별 색상(blue/purple/orange)과 맞춘다. */
function AnalysisRoundComparisonTable({
  analysis,
  roundAnalyses
}: {
  analysis: LayoutProcessAnalysis;
  roundAnalyses: { round: 1 | 2 | 3; analysis: LayoutProcessAnalysis }[];
}) {
  const { t } = useTranslation();
  const headerBg = useColorModeValue("gray.100", "whiteAlpha.100");
  const roundHeaderBg = {
    1: useColorModeValue("blue.50", "blue.900"),
    2: useColorModeValue("purple.50", "purple.900"),
    3: useColorModeValue("orange.50", "orange.900")
  } as const;
  const labelColor = useColorModeValue("gray.600", "gray.300");

  const sec = (n: number | null) => (n != null ? `${formatCycleSumForDisplay(n)} s` : "—");
  const num = (n: number | null, digits = 1) => formatAnalysisMetricNumber(n, digits);
  const bottleneckLabel = (a: LayoutProcessAnalysis) => (a.bottleneck ? `[${a.bottleneck.code}] ${a.bottleneck.name || "—"}` : "—");

  const rounds = roundAnalyses.filter((r) => r.analysis.processCount - r.analysis.missingCycleCount > 0);
  if (rounds.length === 0) return null;

  type Row = {
    label: string;
    original: string;
    values: (r: LayoutProcessAnalysis) => { text: string; diff?: React.ReactNode };
  };
  const rows: Row[] = [
    {
      label: t("vlLayouts.detail.analysisCycleTotal"),
      original: sec(analysis.cycleSum),
      values: (r) => ({
        text: sec(r.cycleSum),
        diff: r.cycleSum != null && analysis.cycleSum != null ? layoutMeasurementPctDiff(r.cycleSum, analysis.cycleSum, false) : null
      })
    },
    {
      label: t("vlLayouts.detail.analysisUpmhMin"),
      original: num(analysis.upmhMin),
      values: (r) => ({
        text: num(r.upmhMin),
        diff: r.upmhMin != null && analysis.upmhMin != null ? layoutMeasurementPctDiff(r.upmhMin, analysis.upmhMin, true) : null
      })
    },
    {
      label: t("vlLayouts.detail.analysisManpowerTotal"),
      original: num(analysis.manpowerSum, 2),
      values: (r) => ({ text: num(r.manpowerSum, 2) })
    },
    {
      label: t("vlLayouts.detail.analysisTargetMin"),
      original: num(analysis.targetMin),
      values: (r) => ({
        text: num(r.targetMin),
        diff: r.targetMin != null && analysis.targetMin != null ? layoutMeasurementPctDiff(r.targetMin, analysis.targetMin, true) : null
      })
    },
    {
      label: t("vlLayouts.detail.analysisBottleneck"),
      original: bottleneckLabel(analysis),
      values: (r) => ({ text: bottleneckLabel(r) })
    }
  ];

  return (
    <AnalysisDetailSection icon={<FaChartBar />} label={t("vlLayouts.detail.analysisSectionRoundCompare")} accent="teal">
      <TableContainer overflowX="auto">
        <Table size="sm" variant="simple" sx={{ "th, td": { paddingY: "4px", paddingX: "8px", fontSize: "0.7rem" } }}>
          <Thead>
            <Tr bg={headerBg}>
              <Th fontSize="0.65rem">{t("vlLayouts.detail.analysisRoundCompareMetric")}</Th>
              <Th fontSize="0.65rem">{t("vlLayouts.detail.originalStyleBadge")}</Th>
              {rounds.map(({ round }) => (
                <Th key={round} fontSize="0.65rem" bg={roundHeaderBg[round]}>
                  VL · {t(`vlLayouts.processDetail.round${round}`)}
                </Th>
              ))}
            </Tr>
          </Thead>
          <Tbody>
            {rows.map((row) => (
              <Tr key={row.label}>
                <Td fontWeight="semibold" color={labelColor} whiteSpace="nowrap">
                  {row.label}
                </Td>
                <Td whiteSpace="nowrap">{row.original}</Td>
                {rounds.map(({ round, analysis: rAnalysis }) => {
                  const cell = row.values(rAnalysis);
                  return (
                    <Td key={round} bg={roundHeaderBg[round]} whiteSpace="nowrap">
                      {cell.text}
                      {cell.diff}
                    </Td>
                  );
                })}
              </Tr>
            ))}
          </Tbody>
        </Table>
      </TableContainer>
    </AnalysisDetailSection>
  );
}

function LayoutAnalysisSummaryPanel({
  analysis,
  roundAnalyses,
  title,
  countLine,
  compact
}: {
  analysis: LayoutProcessAnalysis;
  roundAnalyses?: { round: 1 | 2 | 3; analysis: LayoutProcessAnalysis }[];
  title: string;
  countLine: React.ReactNode;
  compact?: boolean;
}) {
  const { t } = useTranslation();
  const [detailsOpen, setDetailsOpen] = useState(false);
  const borderColor = useColorModeValue("gray.200", "gray.600");
  const bg = useColorModeValue("white", "gray.800");
  const titleColor = useColorModeValue("gray.700", "gray.200");
  const muted = useColorModeValue("gray.600", "gray.300");
  const detailBg = useColorModeValue("gray.50", "whiteAlpha.50");
  const cols = { base: 2, sm: 3, md: 4 } as const;

  const sec = (n: number | null) => (n != null ? `${formatCycleSumForDisplay(n)} s` : "—");
  const num = (n: number | null, digits = 1) => formatAnalysisMetricNumber(n, digits);
  const bottleneckLabel = analysis.bottleneck
    ? `[${analysis.bottleneck.code}] ${analysis.bottleneck.name || "—"}`
    : "—";
  const bottleneckHint = analysis.bottleneck
    ? t("vlLayouts.detail.analysisBottleneckHint", {
        code: analysis.bottleneck.code,
        name: analysis.bottleneck.name || "—",
        seconds: formatCycleSumForDisplay(analysis.bottleneck.cycleSec)
      })
    : undefined;

  /** 데이터가 있는 회차 중 가장 마지막 것 — KPI 카드에 "최신 VL 측정" 배지로 붙여준다 */
  const latestRound = [...(roundAnalyses ?? [])].reverse().find((r) => r.analysis.processCount - r.analysis.missingCycleCount > 0);
  const latestBottleneckLabel = latestRound?.analysis.bottleneck
    ? `[${latestRound.analysis.bottleneck.code}] ${latestRound.analysis.bottleneck.name || "—"}`
    : null;

  return (
    <Box borderWidth="1px" borderColor={borderColor} borderRadius="md" bg={bg} px={3} py={compact ? 2 : 2.5} mb={compact ? 2 : 0}>
      <HStack justify="space-between" align="flex-start" spacing={2} mb={2} flexWrap="wrap" rowGap={1}>
        <Box minW={0} flex="1">
          <Text fontSize="xs" fontWeight="bold" color={titleColor}>
            {title}
          </Text>
          <Text fontSize="xs" color={muted} mt={0.5}>
            {countLine}
            {analysis.missingCycleCount > 0 && (
              <>
                <Text as="span" color={muted} mx={1}>
                  ·
                </Text>
                <Text as="span" color="orange.500" fontWeight="semibold">
                  {t("vlLayouts.detail.analysisMissingCycle", { count: analysis.missingCycleCount })}
                </Text>
              </>
            )}
          </Text>
        </Box>
        <Button
          size="xs"
          variant="ghost"
          colorScheme="blue"
          rightIcon={detailsOpen ? <FaChevronUp /> : <FaChevronDown />}
          onClick={() => setDetailsOpen((v) => !v)}
          flexShrink={0}
        >
          {detailsOpen ? t("vlLayouts.detail.analysisHideDetails") : t("vlLayouts.detail.analysisShowDetails")}
        </Button>
      </HStack>

      <SimpleGrid columns={{ base: 2, sm: 3, md: compact ? 3 : 5 }} spacing={2}>
        <AnalysisKpiCard
          label={t("vlLayouts.detail.analysisCycleTotal")}
          value={sec(analysis.cycleSum)}
          accent="teal"
          compact={compact}
          latest={
            latestRound && latestRound.analysis.cycleSum != null ? (
              <LatestRoundKpiLine
                round={latestRound.round}
                text={sec(latestRound.analysis.cycleSum)}
                diff={analysis.cycleSum != null ? layoutMeasurementPctDiff(latestRound.analysis.cycleSum, analysis.cycleSum, false) : null}
              />
            ) : undefined
          }
        />
        <AnalysisKpiCard
          label={t("vlLayouts.detail.analysisUpmhMin")}
          value={num(analysis.upmhMin)}
          hint={t("vlLayouts.detail.analysisKpiUpmhMinHint")}
          accent="blue"
          compact={compact}
          latest={
            latestRound && latestRound.analysis.upmhMin != null ? (
              <LatestRoundKpiLine
                round={latestRound.round}
                text={num(latestRound.analysis.upmhMin)}
                diff={analysis.upmhMin != null ? layoutMeasurementPctDiff(latestRound.analysis.upmhMin, analysis.upmhMin, true) : null}
              />
            ) : undefined
          }
        />
        <AnalysisKpiCard
          label={t("vlLayouts.detail.analysisManpowerTotal")}
          value={num(analysis.manpowerSum, 2)}
          accent="green"
          compact={compact}
          latest={
            latestRound && latestRound.analysis.manpowerSum != null ? (
              <LatestRoundKpiLine round={latestRound.round} text={num(latestRound.analysis.manpowerSum, 2)} />
            ) : undefined
          }
        />
        <AnalysisKpiCard
          label={t("vlLayouts.detail.analysisTargetMin")}
          value={num(analysis.targetMin)}
          hint={t("vlLayouts.detail.analysisKpiTargetMinHint")}
          accent="blue"
          compact={compact}
          latest={
            latestRound && latestRound.analysis.targetMin != null ? (
              <LatestRoundKpiLine
                round={latestRound.round}
                text={num(latestRound.analysis.targetMin)}
                diff={analysis.targetMin != null ? layoutMeasurementPctDiff(latestRound.analysis.targetMin, analysis.targetMin, true) : null}
              />
            ) : undefined
          }
        />
        <AnalysisKpiCard
          label={t("vlLayouts.detail.analysisBottleneck")}
          value={bottleneckLabel}
          hint={bottleneckHint}
          accent="orange"
          compact={compact}
          latest={
            latestRound && latestBottleneckLabel ? (
              <LatestRoundKpiLine round={latestRound.round} text={latestBottleneckLabel} />
            ) : undefined
          }
        />
      </SimpleGrid>

      <Collapse in={detailsOpen} animateOpacity>
        <Box mt={3} pt={3} borderTopWidth="1px" borderColor={borderColor} bg={detailBg} mx={-3} px={3} pb={3} borderBottomRadius="md">
          <VStack align="stretch" spacing={2.5}>
            <AnalysisDetailSection icon={<FaClock />} label={t("vlLayouts.detail.analysisSectionCycle")} accent="teal">
              <SimpleGrid columns={cols} spacingX={3} spacingY={2}>
                <AnalysisMetric label={t("vlLayouts.detail.analysisCycleTotal")} value={sec(analysis.cycleSum)} />
                <AnalysisMetric label={t("vlLayouts.detail.analysisProcessCycleSum")} value={sec(analysis.processCycleSum)} hint={t("vlLayouts.detail.analysisProcessCycleSumHint")} />
                <AnalysisMetric label={t("vlLayouts.detail.analysisHelperCycleSum")} value={sec(analysis.helperCycleSum)} hint={t("vlLayouts.detail.analysisHelperCycleSumHint")} />
                <AnalysisMetric label={t("vlLayouts.detail.analysisCycleAvg")} value={sec(analysis.cycleAvg)} />
                <AnalysisMetric label={t("vlLayouts.detail.analysisCycleMax")} value={sec(analysis.cycleMax)} />
                <AnalysisMetric label={t("vlLayouts.detail.analysisCycleMin")} value={sec(analysis.cycleMin)} />
                <AnalysisMetric label={t("vlLayouts.detail.analysisStandardTime")} value={sec(analysis.standardTimeSum)} />
                <AnalysisMetric label={t("vlLayouts.detail.overallAllowanceLabel")} value={sec(analysis.allowanceSum)} />
              </SimpleGrid>
            </AnalysisDetailSection>

            <AnalysisDetailSection icon={<FaTachometerAlt />} label={t("vlLayouts.detail.analysisSectionThroughput")} accent="blue">
              <SimpleGrid columns={cols} spacingX={3} spacingY={2}>
                <AnalysisMetric label={t("vlLayouts.detail.analysisUpmhAvg")} value={num(analysis.upmhAvg)} />
                <AnalysisMetric label={t("vlLayouts.detail.analysisUpmhMin")} value={num(analysis.upmhMin)} />
                <AnalysisMetric label={t("vlLayouts.detail.analysisUpmhMax")} value={num(analysis.upmhMax)} />
                <AnalysisMetric label={t("vlLayouts.detail.analysisManpowerTotal")} value={num(analysis.manpowerSum, 2)} />
                <AnalysisMetric label={t("vlLayouts.detail.analysisProcessManpowerSum")} value={num(analysis.processManpowerSum, 2)} hint={t("vlLayouts.detail.analysisProcessCycleSumHint")} />
                <AnalysisMetric label={t("vlLayouts.detail.analysisHelperManpowerSum")} value={num(analysis.helperManpowerSum, 2)} hint={t("vlLayouts.detail.analysisHelperCycleSumHint")} />
                <AnalysisMetric label={t("vlLayouts.detail.analysisManpowerAvg")} value={num(analysis.manpowerAvg, 2)} />
                <AnalysisMetric label={t("vlLayouts.detail.analysisTargetMin")} value={num(analysis.targetMin)} />
                <AnalysisMetric label={t("vlLayouts.detail.analysisTargetAvg")} value={num(analysis.targetAvg)} />
                <AnalysisMetric label={t("vlLayouts.detail.analysisTargetMax")} value={num(analysis.targetMax)} />
                <AnalysisMetric label={t("vlLayouts.detail.analysisTargetSum")} value={num(analysis.targetSum)} />
              </SimpleGrid>
            </AnalysisDetailSection>

            <AnalysisDetailSection icon={<FaExclamationTriangle />} label={t("vlLayouts.detail.analysisSectionBottleneck")} accent="orange">
              <SimpleGrid columns={cols} spacingX={3} spacingY={2}>
                <AnalysisMetric label={t("vlLayouts.detail.analysisBottleneck")} value={bottleneckLabel} hint={bottleneckHint} />
                <AnalysisMetric
                  label={t("vlLayouts.detail.analysisBottleneckCycle")}
                  value={analysis.bottleneck ? sec(analysis.bottleneck.cycleSec) : "—"}
                />
                <AnalysisMetric label={t("vlLayouts.detail.analysisBottleneckUpmh")} value={num(analysis.bottleneck?.upmh ?? null)} />
                <AnalysisMetric
                  label={t("vlLayouts.detail.analysisBottleneckMp")}
                  value={num(analysis.bottleneck?.manpower ?? null, 2)}
                />
                <AnalysisMetric
                  label={t("vlLayouts.detail.analysisBottleneckTarget")}
                  value={num(analysis.bottleneck?.targetTotal ?? analysis.bottleneck?.upmh ?? null)}
                />
              </SimpleGrid>
            </AnalysisDetailSection>

            {roundAnalyses && roundAnalyses.length > 0 && (
              <AnalysisRoundComparisonTable analysis={analysis} roundAnalyses={roundAnalyses} />
            )}
          </VStack>
        </Box>
      </Collapse>
    </Box>
  );
}

function SortableModuleItem({ id, children }: { id: number; children: (handle: React.ReactNode) => React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: `mod-${id}` });
  const handle = (
    <Box as="span" cursor="grab" color="gray.300" _hover={{ color: "gray.500" }} display="inline-flex" alignItems="center" {...attributes} {...listeners}>
      <FaGripVertical />
    </Box>
  );
  return (
    <Box ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} opacity={isDragging ? 0.4 : 1}>
      {children(handle)}
    </Box>
  );
}

function SortableProcessTr({
  id,
  children,
  reversed = false,
  connectCell,
  isBottleneck = false
}: {
  id: number;
  children: React.ReactNode;
  reversed?: boolean;
  connectCell?: React.ReactNode;
  isBottleneck?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: `proc-${id}` });
  const bottleneckBg = useColorModeValue("orange.50", "orange.900");
  const dragHandle = (
    <Td key="drag" px={1} w="20px">
      <Box as="span" cursor="grab" color="gray.300" _hover={{ color: "gray.500" }} display="inline-flex" alignItems="center" {...attributes} {...listeners}>
        <FaGripVertical size={12} />
      </Box>
    </Td>
  );
  return (
    <Tr
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      opacity={isDragging ? 0.4 : 1}
      bg={isBottleneck ? bottleneckBg : undefined}
      boxShadow={isBottleneck ? "inset 3px 0 0 var(--chakra-colors-orange-400)" : undefined}
    >
      {reversed ? (
        <>
          {children}
          {dragHandle}
          {connectCell}
        </>
      ) : (
        <>
          {connectCell}
          {dragHandle}
          {children}
        </>
      )}
    </Tr>
  );
}

export default function VlLayoutDetail() {
  const { pk: pkParam } = useParams<{ pk: string }>();
  const pk = Number(pkParam);
  const { t } = useTranslation();
  const pageBg = useColorModeValue("gray.50", "gray.900");
  const cardBg = useColorModeValue("white", "gray.800");
  const accordionHeaderBg = useColorModeValue("gray.50", "gray.700");
  const panelBg = useColorModeValue("white", "gray.900");
  const outlineCardDivider = useColorModeValue("gray.200", "gray.600");
  const mediaIconMutedColor = useColorModeValue("gray.400", "gray.500");
  const subtleTextColor = useColorModeValue("gray.600", "gray.300");
  const fainterTextColor = useColorModeValue("gray.400", "gray.500");
  const lineTrackBg = useColorModeValue("gray.50", "whiteAlpha.100");
  const lineBorderColor = useColorModeValue("gray.300", "gray.500");
  const lineArrowColor = useColorModeValue("gray.300", "gray.500");
  const overviewBottleneckBg = useColorModeValue("orange.50", "orange.900");
  const measOriginalBg = useColorModeValue("gray.50", "whiteAlpha.100");
  const measVl1Bg = useColorModeValue("blue.50", "blue.900");
  const measVl2Bg = useColorModeValue("purple.50", "purple.900");
  const measVl3Bg = useColorModeValue("orange.50", "orange.900");
  const measGroupHeaderBg = {
    0: useColorModeValue("gray.100", "whiteAlpha.200"),
    1: useColorModeValue("blue.100", "blue.800"),
    2: useColorModeValue("purple.100", "purple.800"),
    3: useColorModeValue("orange.100", "orange.800")
  } as const;
  const measCellBg = { 0: measOriginalBg, 1: measVl1Bg, 2: measVl2Bg, 3: measVl3Bg } as const;
  const toast = useToast();
  const queryClient = useQueryClient();

  const invalidateLayoutStyleAndMediaHints = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["layoutStyle", pk] });
    queryClient.invalidateQueries({ queryKey: ["layoutModuleMediaHint"] });
    queryClient.invalidateQueries({ queryKey: ["layoutProcessMediaHint"] });
  }, [queryClient, pk]);

  const { data, isLoading } = useQuery({
    queryKey: ["layoutStyle", pk],
    queryFn: () => getLayoutStyleDetail(pk),
    enabled: Number.isFinite(pk)
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["moduleCategories"],
    queryFn: () => getModuleCategories()
  });

  const { data: layoutTools = [] } = useQuery({
    queryKey: ["layoutTools"],
    queryFn: () => getLayoutTools()
  });

  const { data: layoutSettings } = useQuery({
    queryKey: ["layoutSettings"],
    queryFn: getLayoutSettings,
    staleTime: 5 * 60_000
  });
  const upmhDivisorSeconds = layoutSettings?.upmh_divisor_seconds ?? 3600;

  /** Latest-round actual measurement vs the original Target Qty/Hour — for the row-level comparison indicator. */
  const getLatestMeasurementSummary = useCallback(
    (p: ILayoutProcess) => {
      const list = p.measurements ?? [];
      if (list.length === 0) return null;
      const latest = [...list].sort((a, b) => b.round - a.round)[0];
      const cycleSec = parseSamSecondsField(latest.cycle_time);
      const mp = latest.manpower;
      const upmh = cycleSec != null && cycleSec > 0 ? upmhDivisorSeconds / cycleSec : null;
      const total = upmh != null && mp != null && mp > 0 ? upmh * mp : null;
      const originalTotal = p.target_qty_per_hour_total ?? null;
      const pct = total != null && originalTotal != null && originalTotal !== 0 ? ((total - originalTotal) / Math.abs(originalTotal)) * 100 : null;
      return { round: latest.round, total, pct };
    },
    [upmhDivisorSeconds]
  );

  const renderMeasurementIndicator = (p: ILayoutProcess) => {
    const summary = getLatestMeasurementSummary(p);
    if (!summary || summary.total == null) return null;
    const good = summary.pct == null ? null : summary.pct > 0;
    const arrow = good == null ? "•" : good ? "▲" : "▼";
    const color = good == null ? "gray.400" : good ? "green.500" : "red.500";
    const label = t("vlLayouts.detail.measurementIndicatorTooltip", {
      round: t(`vlLayouts.processDetail.round${summary.round}`),
      total: summary.total.toFixed(1),
      pct: summary.pct != null ? `${summary.pct > 0 ? "+" : ""}${summary.pct.toFixed(1)}%` : "—"
    });
    return (
      <Tooltip label={label} hasArrow>
        <Text as="span" fontSize="0.6rem" color={color} ml={0.5} cursor="default">
          {arrow}
        </Text>
      </Tooltip>
    );
  };

  /** Small badge marking a process as having Helper(s) — their manpower doesn't count toward this
   * process's own M/P, only toward module/style totals. Click it to expand the breakdown (name + manpower
   * per helper) in a popover, since a real accordion row would misalign the split left/right tables. */
  const renderHelperIndicator = (p: ILayoutProcess) => {
    const helpers = p.helpers ?? [];
    if (helpers.length === 0) return null;
    const totalMp = helpers.reduce((sum, h) => sum + (h.manpower ?? 0), 0);
    const totalCycleSec = helpers.reduce((sum, h) => sum + (parseSamSecondsField(h.cycle_time) ?? 0), 0);
    return (
      <Popover placement="bottom" isLazy>
        <PopoverTrigger>
          <Badge
            variant="subtle"
            colorScheme="purple"
            fontSize="0.55rem"
            px={1}
            py={0}
            borderRadius="sm"
            ml={1}
            display="inline-flex"
            alignItems="center"
            gap={0.5}
            cursor="pointer"
            onClick={(e) => e.stopPropagation()}
          >
            <FaUserFriends size={8} />
            {totalMp}
          </Badge>
        </PopoverTrigger>
        <Portal>
          <PopoverContent w="260px" fontWeight="normal" onClick={(e) => e.stopPropagation()}>
            <PopoverArrow />
            <PopoverCloseButton />
            <PopoverHeader fontSize="xs" fontWeight="bold">
              {t("vlLayouts.detail.helperTooltipPrefix")}
            </PopoverHeader>
            <PopoverBody>
              <VStack align="stretch" spacing={1.5}>
                {helpers.map((h) => {
                  const hCycleSec = parseSamSecondsField(h.cycle_time);
                  return (
                    <HStack key={h.pk} justify="space-between" fontSize="xs">
                      <Text isTruncated maxW="100px">
                        {h.name || t("vlLayouts.detail.helperUnnamed")}
                      </Text>
                      <HStack spacing={1}>
                        {hCycleSec != null && (
                          <Badge colorScheme="teal" fontSize="0.65rem">
                            {formatSamCycleSecondsDisplay(hCycleSec)}s
                          </Badge>
                        )}
                        <Badge colorScheme="purple" fontSize="0.65rem">
                          {h.manpower}
                        </Badge>
                      </HStack>
                    </HStack>
                  );
                })}
                {(helpers.length > 1) && (
                  <HStack justify="space-between" fontSize="xs" pt={1} borderTopWidth="1px" borderColor={outlineCardDivider} fontWeight="semibold">
                    <Text>{t("vlLayouts.detail.helperTotalLabel")}</Text>
                    <HStack spacing={1}>
                      {totalCycleSec > 0 && (
                        <Badge colorScheme="teal" fontSize="0.65rem">
                          {formatSamCycleSecondsDisplay(totalCycleSec)}s
                        </Badge>
                      )}
                      <Badge colorScheme="purple" fontSize="0.65rem">
                        {totalMp}
                      </Badge>
                    </HStack>
                  </HStack>
                )}
              </VStack>
            </PopoverBody>
          </PopoverContent>
        </Portal>
      </Popover>
    );
  };

  const detail = data as ILayoutStyleDetail | undefined;

  /** sj_style.thumbnail is frequently unset — same fallback as the Layouts list page: fetch the style's
   * photos and use the primary one (or the first) so the thumbnail still shows. */
  const { data: stylePhotosFallback } = useQuery({
    queryKey: ["sjStylePhotos", detail?.sj_style.pk],
    queryFn: () => getSjStylePhotos(detail!.sj_style.pk),
    enabled: !!detail?.sj_style?.pk && !detail.sj_style.thumbnail
  });

  const stylePhotoSrc = useMemo(() => {
    if (!detail) return null;
    if (detail.sj_style.thumbnail) return resolveMediaUrl(detail.sj_style.thumbnail) ?? null;
    if (!stylePhotosFallback?.length) return null;
    const primaryPk = detail.sj_style.primary_photo;
    const hit = primaryPk != null ? stylePhotosFallback.find((p) => Number(p.pk) === Number(primaryPk)) : undefined;
    return resolveMediaUrl((hit ?? stylePhotosFallback[0]).file) ?? null;
  }, [detail, stylePhotosFallback]);

  const groups = useMemo(() => {
    if (!detail?.layout_modules?.length) return [] as { catId: number; catName: string; modules: ILayoutModule[] }[];
    const m = new Map<number, { catName: string; modules: ILayoutModule[] }>();
    for (const mod of detail.layout_modules) {
      const id = normalizeModuleCategoryPk(mod.module_category);
      const key = id ?? -1;
      if (!m.has(key)) m.set(key, { catName: mod.module_category_name || "—", modules: [] });
      m.get(key)!.modules.push(mod);
    }
    return Array.from(m.entries()).map(([catId, v]) => ({
      catId,
      catName: v.catName,
      modules: v.modules.sort((a, b) => a.sort_order - b.sort_order || a.code.localeCompare(b.code))
    }));
  }, [detail]);

  const allProcs = useMemo(() => detail?.layout_modules?.flatMap((m) => m.layout_processes ?? []) ?? [], [detail]);
  const pageAnalysis = useMemo(() => analyzeLayoutProcesses(allProcs, upmhDivisorSeconds), [allProcs, upmhDivisorSeconds]);
  const pageRoundAnalyses = useMemo(
    () => ([1, 2, 3] as const).map((round) => ({ round, analysis: analyzeLayoutProcessesForRound(allProcs, round, upmhDivisorSeconds) })),
    [allProcs, upmhDivisorSeconds]
  );
  /** Every process across every module, in the same category/module/process order shown in the accordions —
   * the flat list the full-overview split view renders so it reads as one continuous line, not per-module. */
  const overviewProcs = useMemo(() => {
    const list: { p: ILayoutProcess; moduleCode: string }[] = [];
    for (const g of groups) {
      for (const mod of g.modules) {
        const sorted = [...(mod.layout_processes ?? [])].sort(compareLayoutProcessBySortOrder);
        for (const p of sorted) list.push({ p, moduleCode: mod.code });
      }
    }
    return list;
  }, [groups]);
  const [showFullOverview, setShowFullOverview] = useState(false);

  const processByPk = useMemo(() => {
    const map = new Map<number, ILayoutProcess>();
    for (const mod of detail?.layout_modules ?? []) {
      for (const p of mod.layout_processes ?? []) map.set(p.pk, p);
    }
    return map;
  }, [detail]);

  const getNextProcess = useCallback(
    (p: ILayoutProcess) => {
      const nextPk = normalizeSamProcessFk(p.next_process ?? p.next_process_id);
      return nextPk != null ? processByPk.get(nextPk) ?? null : null;
    },
    [processByPk]
  );

  const flowAreaRef = useRef<HTMLDivElement>(null);
  const dotRefs = useRef<Map<number, HTMLElement>>(new Map());
  const lineBoxRefs = useRef<Map<number, HTMLElement>>(new Map());
  const dragStateRef = useRef<{ fromPk: number; x0: number; y0: number } | null>(null);
  const [dragLine, setDragLine] = useState<{ x0: number; y0: number; x: number; y: number } | null>(null);
  const [connectLinesByModule, setConnectLinesByModule] = useState<
    Map<number, { key: string; x1: number; y1: number; x2: number; y2: number }[]>
  >(new Map());

  const processModulePk = useMemo(() => {
    const map = new Map<number, number>();
    for (const mod of detail?.layout_modules ?? []) {
      for (const p of mod.layout_processes ?? []) map.set(p.pk, mod.pk);
    }
    return map;
  }, [detail]);

  const connectedPks = useMemo(() => {
    const set = new Set<number>();
    processByPk.forEach((p) => {
      const target = getNextProcess(p);
      if (target) {
        set.add(p.pk);
        set.add(target.pk);
      }
    });
    return set;
  }, [processByPk, getNextProcess]);

  const registerFlowDot = useCallback((pk: number, el: HTMLElement | null) => {
    if (el) dotRefs.current.set(pk, el);
    else dotRefs.current.delete(pk);
  }, []);

  const registerLineBox = useCallback((modPk: number, el: HTMLElement | null) => {
    if (el) lineBoxRefs.current.set(modPk, el);
    else lineBoxRefs.current.delete(modPk);
  }, []);

  /** Split-column tables start wider than their grid column, so the browser can land the initial horizontal
   * scroll mid-content (e.g. showing the code near the connector instead of the first column). Force it back
   * to the left edge right after mount, including once after layout settles, without fighting later user scroll. */
  const resetSplitTableScroll = useCallback((el: HTMLDivElement | null) => {
    if (!el) return;
    el.scrollLeft = 0;
    requestAnimationFrame(() => {
      el.scrollLeft = 0;
    });
  }, []);

  const recomputeConnectLines = useCallback(() => {
    const byModule = new Map<number, { key: string; x1: number; y1: number; x2: number; y2: number }[]>();
    processByPk.forEach((p) => {
      const target = getNextProcess(p);
      if (!target) return;
      const modPk = processModulePk.get(p.pk);
      if (modPk == null || processModulePk.get(target.pk) !== modPk) return;
      const boxEl = lineBoxRefs.current.get(modPk);
      const fromEl = dotRefs.current.get(p.pk);
      const toEl = dotRefs.current.get(target.pk);
      if (!boxEl || !fromEl || !toEl) return;
      const boxRect = boxEl.getBoundingClientRect();
      const fromRect = fromEl.getBoundingClientRect();
      const toRect = toEl.getBoundingClientRect();
      const list = byModule.get(modPk) ?? [];
      list.push({
        key: `${p.pk}->${target.pk}`,
        x1: fromRect.left + fromRect.width / 2 - boxRect.left,
        y1: fromRect.top + fromRect.height / 2 - boxRect.top,
        x2: toRect.left + toRect.width / 2 - boxRect.left,
        y2: toRect.top + toRect.height / 2 - boxRect.top
      });
      byModule.set(modPk, list);
    });
    setConnectLinesByModule(byModule);
  }, [processByPk, getNextProcess, processModulePk]);

  useEffect(() => {
    const raf = requestAnimationFrame(recomputeConnectLines);
    window.addEventListener("resize", recomputeConnectLines);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", recomputeConnectLines);
    };
  });

  const setProcessNextLink = useCallback(
    async (fromPk: number, toPk: number) => {
      try {
        await Promise.all([patchLayoutProcess(fromPk, { next_process: toPk }), patchLayoutProcess(toPk, { previous_process: fromPk })]);
        invalidateLayoutStyleAndMediaHints();
      } catch {
        toast({ title: t("ep.common.failedSave"), status: "error", duration: 2000, position: "bottom-right" });
      }
    },
    [invalidateLayoutStyleAndMediaHints, toast, t]
  );

  const removeProcessNextLink = useCallback(
    async (fromPk: number, toPk: number) => {
      try {
        await Promise.all([patchLayoutProcess(fromPk, { next_process: null }), patchLayoutProcess(toPk, { previous_process: null })]);
        invalidateLayoutStyleAndMediaHints();
      } catch {
        toast({ title: t("ep.common.failedSave"), status: "error", duration: 2000, position: "bottom-right" });
      }
    },
    [invalidateLayoutStyleAndMediaHints, toast, t]
  );

  const handleDotMouseDown = useCallback(
    (pk: number, e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const container = flowAreaRef.current;
      if (!container) return;
      const containerRect = container.getBoundingClientRect();
      const x0 = e.clientX - containerRect.left;
      const y0 = e.clientY - containerRect.top;
      dragStateRef.current = { fromPk: pk, x0, y0 };
      setDragLine({ x0, y0, x: x0, y: y0 });

      const handleMove = (ev: MouseEvent) => {
        const rect = flowAreaRef.current?.getBoundingClientRect();
        if (!rect) return;
        setDragLine((prev) => (prev ? { ...prev, x: ev.clientX - rect.left, y: ev.clientY - rect.top } : prev));
      };
      const handleUp = (ev: MouseEvent) => {
        window.removeEventListener("mousemove", handleMove);
        window.removeEventListener("mouseup", handleUp);
        setDragLine(null);
        const from = dragStateRef.current;
        dragStateRef.current = null;
        if (!from) return;
        const el = document.elementFromPoint(ev.clientX, ev.clientY);
        const dotEl = el instanceof Element ? el.closest("[data-flow-dot-pk]") : null;
        const toPk = dotEl ? Number(dotEl.getAttribute("data-flow-dot-pk")) : null;
        if (toPk != null && Number.isFinite(toPk) && toPk !== from.fromPk) {
          void setProcessNextLink(from.fromPk, toPk);
        }
      };
      window.addEventListener("mousemove", handleMove);
      window.addEventListener("mouseup", handleUp);
    },
    [setProcessNextLink]
  );

  const renderFlowDot = (pk: number) => {
    const p = processByPk.get(pk);
    const next = p ? getNextProcess(p) : null;
    const label = next ? t("vlLayouts.detail.nextProcessTooltip", { code: next.code }) : t("vlLayouts.detail.flowDotHint");
    return (
      <Tooltip label={label} hasArrow openDelay={300}>
        <Box
          as="span"
          data-flow-dot-pk={pk}
          ref={(el: HTMLElement | null) => registerFlowDot(pk, el)}
          onMouseDown={(e: React.MouseEvent) => handleDotMouseDown(pk, e)}
          display="inline-block"
          w="8px"
          h="8px"
          borderRadius="full"
          bg={connectedPks.has(pk) ? "teal.400" : "white"}
          border="2px solid"
          borderColor="teal.400"
          cursor="crosshair"
          _hover={{ bg: "teal.400", transform: "scale(1.3)" }}
          transition="transform 0.1s"
        />
      </Tooltip>
    );
  };

  /** 단일 열로 둔 모듈 — 없으면 Split columns가 기본 */
  const [singleColumnModulePks, setSingleColumnModulePks] = useState<Set<number>>(new Set());
  const [leftColumnCounts, setLeftColumnCounts] = useState<Map<number, number>>(new Map());
  const getLeftColumnCount = useCallback(
    (modPk: number, total: number) => {
      const stored = leftColumnCounts.get(modPk) ?? Math.ceil(total / 2);
      return Math.min(Math.max(stored, 1), Math.max(total - 1, 1));
    },
    [leftColumnCounts]
  );

  const dndSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const layoutCollisionDetection: CollisionDetection = useCallback((args) => {
    const activeId = String(args.active.id);
    const prefix = activeId.startsWith("proc-") ? "proc-" : activeId.startsWith("mod-") ? "mod-" : null;
    const droppableContainers = prefix
      ? args.droppableContainers.filter((c) => String(c.id).startsWith(prefix))
      : args.droppableContainers;
    return closestCenter({ ...args, droppableContainers });
  }, []);

  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveDragId(String(event.active.id));
  }, []);

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      setActiveDragId(null);
      const { active, over } = event;
      if (!over) return;
      const activeId = String(active.id);
      const overId = String(over.id);

      if (activeId.startsWith("mod-") && overId.startsWith("mod-")) {
        const activePk = parseInt(activeId.slice("mod-".length));
        const overPk = parseInt(overId.slice("mod-".length));
        if (activePk === overPk) return;
        const group = groups.find((g) => g.modules.some((m) => m.pk === activePk) && g.modules.some((m) => m.pk === overPk));
        if (!group) return;
        const oldIdx = group.modules.findIndex((m) => m.pk === activePk);
        const newIdx = group.modules.findIndex((m) => m.pk === overPk);
        if (oldIdx === -1 || newIdx === -1) return;
        const reordered = arrayMove(group.modules, oldIdx, newIdx);
        queryClient.setQueryData(["layoutStyle", pk], (old: ILayoutStyleDetail | undefined) => {
          if (!old) return old;
          const newMods = old.layout_modules.map((m) => {
            const idx = reordered.findIndex((r) => r.pk === m.pk);
            return idx !== -1 ? { ...m, sort_order: idx } : m;
          });
          return { ...old, layout_modules: newMods };
        });
        await Promise.all(reordered.map((m, i) => patchLayoutModule(m.pk, { sort_order: i })));
        return;
      }

      if (activeId.startsWith("proc-") && overId.startsWith("proc-")) {
        const activePk = parseInt(activeId.slice("proc-".length));
        const overPk = parseInt(overId.slice("proc-".length));
        if (activePk === overPk) return;
        let targetModPk: number | null = null;
        let sortedProcs: ILayoutProcess[] = [];
        for (const mod of detail?.layout_modules ?? []) {
          const procs = mod.layout_processes ?? [];
          if (procs.some((p) => p.pk === activePk) && procs.some((p) => p.pk === overPk)) {
            targetModPk = mod.pk;
            sortedProcs = [...procs].sort(compareLayoutProcessBySortOrder);
            break;
          }
        }
        if (targetModPk == null || sortedProcs.length === 0) return;
        const oldIdx = sortedProcs.findIndex((p) => p.pk === activePk);
        const newIdx = sortedProcs.findIndex((p) => p.pk === overPk);
        if (oldIdx === -1 || newIdx === -1) return;

        if (!singleColumnModulePks.has(targetModPk) && sortedProcs.length > 1) {
          const half = getLeftColumnCount(targetModPk, sortedProcs.length);
          const activeInLeft = oldIdx < half;
          const overInLeft = newIdx < half;
          if (activeInLeft !== overInLeft) {
            const newHalf = activeInLeft ? half - 1 : half + 1;
            const clamped = Math.min(Math.max(newHalf, 1), sortedProcs.length - 1);
            setLeftColumnCounts((prev) => new Map(prev).set(targetModPk!, clamped));
          }
        }

        const reordered = arrayMove(sortedProcs, oldIdx, newIdx);
        queryClient.setQueryData(["layoutStyle", pk], (old: ILayoutStyleDetail | undefined) => {
          if (!old) return old;
          const newMods = old.layout_modules.map((m) => {
            if (m.pk !== targetModPk) return m;
            const newProcs = m.layout_processes.map((p) => {
              const idx = reordered.findIndex((r) => r.pk === p.pk);
              return idx !== -1 ? { ...p, sort_order: idx } : p;
            });
            return { ...m, layout_processes: newProcs };
          });
          return { ...old, layout_modules: newMods };
        });
        await Promise.all(reordered.map((p, i) => patchLayoutProcess(p.pk, { sort_order: i })));
      }
    },
    [detail, groups, pk, queryClient, singleColumnModulePks, getLeftColumnCount]
  );

  const layoutCategoryAccordionKey = useMemo(
    () =>
      groups
        .map((g) => g.catId)
        .sort((a, b) => a - b)
        .join(","),
    [groups]
  );
  const [layoutAccordionIndex, setLayoutAccordionIndex] = useState<number[]>([]);

  useLayoutEffect(() => {
    setLayoutAccordionIndex(groups.map((_, i) => i));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layoutCategoryAccordionKey]);

  const layoutAccordionExpandAll = useCallback(() => setLayoutAccordionIndex(groups.map((_, i) => i)), [groups]);
  const layoutAccordionCollapseAll = useCallback(() => setLayoutAccordionIndex([]), []);
  const layoutAccordionAllExpanded = useMemo(() => {
    if (groups.length === 0) return false;
    const expected = groups.map((_, i) => i);
    if (layoutAccordionIndex.length !== expected.length) return false;
    const sorted = [...layoutAccordionIndex].sort((a, b) => a - b);
    return sorted.every((v, i) => v === expected[i]);
  }, [groups, layoutAccordionIndex]);

  const modPks = useMemo(() => {
    if (!detail?.layout_modules?.length) return [];
    return detail.layout_modules.map((m) => m.pk).filter((id) => typeof id === "number" && Number.isFinite(id) && id > 0);
  }, [detail?.layout_modules]);

  const procPks = useMemo(() => {
    if (!detail?.layout_modules?.length) return [];
    const out: number[] = [];
    for (const m of detail.layout_modules) {
      for (const p of m.layout_processes ?? []) {
        if (typeof p.pk === "number" && Number.isFinite(p.pk) && p.pk > 0) out.push(p.pk);
      }
    }
    return out;
  }, [detail?.layout_modules]);

  const moduleMediaHints = useQueries({
    queries: modPks.map((modPk) => ({
      queryKey: ["layoutModuleMediaHint", modPk] as const,
      queryFn: async () => {
        const [layout, prod] = await Promise.all([getLayoutModuleDetail(modPk), getModuleDetail(modPk).catch(() => null)]);
        const photos = mergeUniquePhotoUrls([layout?.photos, prod?.photos]);
        const thumbUrl = photos.length > 0 ? resolveMediaUrl(photos[0]) ?? "" : "";
        return { hasPhotos: photos.length > 0, thumbUrl };
      },
      enabled: Number.isFinite(pk) && pk > 0 && modPk > 0,
      staleTime: 60_000
    }))
  });

  const processMediaHints = useQueries({
    queries: procPks.map((procPk) => ({
      queryKey: ["layoutProcessMediaHint", procPk] as const,
      queryFn: async () => {
        const [layout, prod] = await Promise.all([getLayoutProcessDetail(procPk), getProcessDetail(procPk).catch(() => null)]);
        return {
          hasPhotos: mergeUniquePhotoUrls([layout?.photos, prod?.photos]).length > 0,
          hasVideos: hasMergedProcessVideos(layout as unknown as Parameters<typeof hasMergedProcessVideos>[0], prod as unknown as Parameters<typeof hasMergedProcessVideos>[1])
        };
      },
      enabled: Number.isFinite(pk) && pk > 0 && procPk > 0,
      staleTime: 60_000
    }))
  });

  const moduleThumbnailByPk = useMemo(() => {
    const map = new Map<number, string>();
    modPks.forEach((id, i) => {
      const url = moduleMediaHints[i]?.data?.thumbUrl ?? "";
      if (url) map.set(id, url);
    });
    return map;
  }, [modPks, moduleMediaHints]);

  const processPhotoMuted = useMemo(() => {
    const map = new Map<number, boolean>();
    procPks.forEach((id, i) => {
      const r = processMediaHints[i];
      if (r?.data !== undefined) map.set(id, !r.data.hasPhotos);
    });
    return map;
  }, [procPks, processMediaHints]);

  const processVideoMuted = useMemo(() => {
    const map = new Map<number, boolean>();
    procPks.forEach((id, i) => {
      const r = processMediaHints[i];
      if (r?.data !== undefined) map.set(id, !r.data.hasVideos);
    });
    return map;
  }, [procPks, processMediaHints]);

  const toggleModuleSplit = useCallback((modPk: number) => {
    setSingleColumnModulePks((prev) => {
      const next = new Set(prev);
      if (next.has(modPk)) next.delete(modPk);
      else next.add(modPk);
      return next;
    });
  }, []);

  const modModal = useDisclosure();
  const [modForm, setModForm] = useState({ module_category: "" as string | number, code: "", name: "", sort_order: "0" });
  const [procModal, setProcModal] = useState<{ layout_module: number } | null>(null);
  const [procForm, setProcForm] = useState({ sort_order: "", code: "", name: "", prep_seconds: "", machining_seconds: "", finishing_seconds: "", manpower: "" });
  const [procAddSelectedTool, setProcAddSelectedTool] = useState<number | "">("");

  const [stylePhotoModalOpen, setStylePhotoModalOpen] = useState(false);
  const [layoutMediaPhotoModal, setLayoutMediaPhotoModal] = useState<{ open: boolean; images: string[] }>({ open: false, images: [] });
  const [layoutMediaVideoModal, setLayoutMediaVideoModal] = useState<{ open: boolean; url: string | undefined }>({ open: false, url: undefined });
  const [layoutMediaBusyKey, setLayoutMediaBusyKey] = useState<string | null>(null);

  const runLayoutMedia = async (key: string, fn: () => Promise<void>) => {
    setLayoutMediaBusyKey(key);
    try {
      await fn();
    } catch {
      toast({ title: t("ep.common.failedSave"), status: "error", duration: 2000, position: "bottom-right" });
    } finally {
      setLayoutMediaBusyKey(null);
    }
  };

  const previewModulePhotos = (modPk: number) =>
    runLayoutMedia(`m-${modPk}-img`, async () => {
      const [layout, prod] = await Promise.all([getLayoutModuleDetail(modPk), getModuleDetail(modPk).catch(() => null)]);
      const images = mergeUniquePhotoUrls([layout?.photos, prod?.photos]);
      if (images.length === 0) {
        toast({ title: t("vlLayouts.detail.noPhotosToPreview"), status: "info", duration: 2000, position: "bottom-right" });
        return;
      }
      setLayoutMediaPhotoModal({ open: true, images });
    });

  const previewProcessPhotos = (procPk: number) =>
    runLayoutMedia(`p-${procPk}-img`, async () => {
      const [layout, prod] = await Promise.all([getLayoutProcessDetail(procPk), getProcessDetail(procPk).catch(() => null)]);
      const images = mergeUniquePhotoUrls([layout?.photos, prod?.photos]);
      if (images.length === 0) {
        toast({ title: t("vlLayouts.detail.noPhotosToPreview"), status: "info", duration: 2000, position: "bottom-right" });
        return;
      }
      setLayoutMediaPhotoModal({ open: true, images });
    });

  const previewProcessVideos = (procPk: number) =>
    runLayoutMedia(`p-${procPk}-vid`, async () => {
      const [layout, prod] = await Promise.all([getLayoutProcessDetail(procPk), getProcessDetail(procPk).catch(() => null)]);
      const urls: string[] = [];
      const std = (layout.standard_work_video_url ?? prod?.standard_work_video_url)?.trim();
      if (std) urls.push(std);
      for (const v of [...(layout.videos ?? []), ...(prod?.videos ?? [])]) {
        const raw = (v as { VideoFile?: string; video_file?: string }).VideoFile ?? (v as { video_file?: string }).video_file;
        const vf = raw?.trim();
        if (vf && !urls.includes(vf)) urls.push(vf);
      }
      if (urls.length === 0) {
        toast({ title: t("vlLayouts.detail.noVideosToPreview"), status: "info", duration: 2000, position: "bottom-right" });
        return;
      }
      setLayoutMediaVideoModal({ open: true, url: urls[0] });
    });

  const sortedCats = useMemo(() => [...categories].sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name)), [categories]);

  const openAddModule = (defaultCategoryId?: number) => {
    const preset = defaultCategoryId !== undefined && defaultCategoryId !== null ? normalizeModuleCategoryPk(defaultCategoryId) : null;
    setModForm({ module_category: preset != null && preset > 0 ? preset : ("" as string | number), code: "", name: "", sort_order: "0" });
    modModal.onOpen();
  };

  const submitModule = async () => {
    const catPk = normalizeModuleCategoryPk(modForm.module_category);
    const codeTrim = String(modForm.code).trim();
    if (catPk == null || catPk <= 0 || !codeTrim) {
      toast({ title: t("vlLayouts.detail.moduleRequired"), status: "warning", duration: 2000, position: "bottom-right" });
      return;
    }
    const nameTrim = modForm.name.trim();
    const codeUpper = codeTrim.toUpperCase();
    const codeDup = detail?.layout_modules?.some((m) => String(m.code ?? "").trim().toUpperCase() === codeUpper);
    if (codeDup) {
      toast({ title: t("vlLayouts.detail.moduleCodeDuplicate"), status: "warning", duration: 4000, position: "bottom-right" });
      return;
    }
    try {
      await createLayoutModule({
        layout_style: pk,
        module_category: catPk,
        code: codeTrim,
        ...(nameTrim ? { name: nameTrim } : {}),
        sort_order: Number(modForm.sort_order) || 0
      });
      toast({ title: t("vlLayouts.detail.moduleAdded"), status: "success", duration: 2000, position: "bottom-right" });
      invalidateLayoutStyleAndMediaHints();
      modModal.onClose();
    } catch (e: unknown) {
      toast({ title: formatSamModuleCreateError(e, t), status: "error", duration: 8000, position: "bottom-right" });
    }
  };

  const openAddProcess = (layout_module: number) => {
    setProcModal({ layout_module });
    setProcForm({ sort_order: "", code: "", name: "", prep_seconds: "", machining_seconds: "", finishing_seconds: "", manpower: "" });
    setProcAddSelectedTool("");
  };

  const closeProcModal = () => {
    setProcModal(null);
    setProcAddSelectedTool("");
  };

  const submitProcess = async () => {
    if (!procModal || !procForm.code.trim()) {
      toast({ title: t("vlLayouts.detail.processCodeRequired"), status: "warning", duration: 2000, position: "bottom-right" });
      return;
    }
    try {
      const cycleSec = samProcessCycleSecondsFromFormStrings(procForm.prep_seconds, procForm.machining_seconds, procForm.finishing_seconds);
      const rawSo = procForm.sort_order.trim();
      let sortOrderNum: number | undefined;
      if (rawSo !== "") {
        const n = Number(rawSo);
        if (!Number.isInteger(n) || n < 0) {
          toast({ title: t("vlLayouts.detail.processSortOrderInvalid"), status: "warning", duration: 2500, position: "bottom-right" });
          return;
        }
        sortOrderNum = n;
      }
      const rawMp = procForm.manpower.trim();
      let manpowerNum: number | undefined;
      if (rawMp !== "") {
        const n = Number(rawMp);
        if (!Number.isFinite(n) || n < 0) {
          toast({ title: t("vlLayouts.detail.processManpowerInvalid"), status: "warning", duration: 2500, position: "bottom-right" });
          return;
        }
        manpowerNum = Math.round(n * 100) / 100;
      }
      await createLayoutProcess({
        layout_module: procModal.layout_module,
        code: procForm.code.trim(),
        ...(procForm.name.trim() ? { name: procForm.name.trim() } : {}),
        cycle_time: cycleSec != null ? formatSamCycleSecondsForApi(cycleSec) : null,
        prep_seconds: sanitizeSamSecondsStringForApi(procForm.prep_seconds),
        machining_seconds: sanitizeSamSecondsStringForApi(procForm.machining_seconds),
        finishing_seconds: sanitizeSamSecondsStringForApi(procForm.finishing_seconds),
        ...(sortOrderNum !== undefined ? { sort_order: sortOrderNum } : {}),
        ...(manpowerNum !== undefined ? { manpower: manpowerNum } : {}),
        ...(procAddSelectedTool !== "" ? { layout_tool: procAddSelectedTool } : {})
      });
      toast({ title: t("vlLayouts.detail.processAdded"), status: "success", duration: 2000, position: "bottom-right" });
      invalidateLayoutStyleAndMediaHints();
      closeProcModal();
    } catch (e: unknown) {
      toast({ title: formatSamModuleCreateError(e, t), status: "error", duration: 8000, position: "bottom-right" });
    }
  };

  const renderLineConnector = (modPk: number) => (
    <Flex
      ref={(el: HTMLDivElement | null) => registerLineBox(modPk, el)}
      alignSelf="stretch"
      w="110px"
      minH="60px"
      borderRadius="md"
      bg={lineTrackBg}
      border="1px solid"
      borderColor={lineBorderColor}
      align="center"
      justify="center"
      position="relative"
      overflow="visible"
      zIndex={3}
      title={t("vlLayouts.detail.productionLine")}
    >
      <VStack spacing={0} position="absolute" inset={0} justify="space-evenly" color={lineArrowColor} py={2}>
        {Array.from({ length: 5 }).map((_, i) => (
          <FaChevronUp key={i} size={10} />
        ))}
      </VStack>
      <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", overflow: "visible", pointerEvents: "none", zIndex: 1 }}>
        <defs>
          <marker id={`flowArrowhead-${modPk}`} markerWidth="14" markerHeight="14" refX="10" refY="5" orient="auto" markerUnits="userSpaceOnUse">
            <path d="M0,0 L10,5 L0,10 Z" fill="var(--chakra-colors-teal-400)" />
          </marker>
        </defs>
        {(connectLinesByModule.get(modPk) ?? []).map((l) => {
          const [fromPkStr, toPkStr] = l.key.split("->");
          const fromPk = Number(fromPkStr);
          const toPk = Number(toPkStr);
          return (
            <g key={l.key}>
              <line x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} stroke="var(--chakra-colors-teal-400)" strokeWidth={2} markerEnd={`url(#flowArrowhead-${modPk})`} />
              <line
                x1={l.x1}
                y1={l.y1}
                x2={l.x2}
                y2={l.y2}
                stroke="transparent"
                strokeWidth={10}
                style={{ pointerEvents: "stroke", cursor: "pointer" }}
                onClick={() => void removeProcessNextLink(fromPk, toPk)}
              >
                <title>{t("vlLayouts.detail.flowLineRemoveHint")}</title>
              </line>
            </g>
          );
        })}
      </svg>
      <Text
        position="relative"
        fontSize="xs"
        fontWeight="bold"
        color={lineBorderColor}
        letterSpacing="wide"
        textAlign="center"
        px={1}
        zIndex={2}
        pointerEvents="none"
      >
        {t("vlLayouts.detail.productionLine")}
      </Text>
    </Flex>
  );

  const metricSubHeads = (bg: string) => (
    <>
      <Th isNumeric w="72px" px={1} fontSize="xs" bg={bg} whiteSpace="nowrap">
        {t("vlLayouts.detail.col.cycle")}
      </Th>
      <Th isNumeric w="56px" px={1} fontSize="xs" bg={bg} color="gray.500" whiteSpace="nowrap">
        {t("vlLayouts.detail.col.upmh")}
      </Th>
      <Th isNumeric w="48px" px={1} fontSize="xs" bg={bg} color="gray.500" whiteSpace="nowrap">
        {t("vlLayouts.detail.col.manpower")}
      </Th>
      <Th isNumeric w="68px" px={1} fontSize="xs" bg={bg} color="gray.500" whiteSpace="nowrap">
        {t("vlLayouts.detail.col.targetQtyPerHour")}
      </Th>
    </>
  );

  const processTableHead = () => (
    <Thead>
      <Tr>
        <Th w="20px" px={1} rowSpan={2} />
        <Th isNumeric w="44px" px={1} rowSpan={2}>
          <VisuallyHidden>{t("vlLayouts.detail.col.sort_order")}</VisuallyHidden>
        </Th>
        <Th w="140px" rowSpan={2}>
          {t("vlLayouts.detail.col.code")}
        </Th>
        <Th w="64px" px={1} textAlign="center" fontSize="xs" color="gray.500" rowSpan={2}>
          {t("vlLayouts.detail.col.media")}
        </Th>
        <Th minW="100px" rowSpan={2}>
          {t("vlLayouts.detail.col.name")}
        </Th>
        <Th colSpan={4} textAlign="center" bg={measGroupHeaderBg[0]} borderBottomWidth={0} py={1}>
          <Badge colorScheme="gray" fontSize="0.65rem">
            {t("vlLayouts.processDetail.original")}
          </Badge>
        </Th>
        <Th colSpan={4} textAlign="center" bg={measGroupHeaderBg[1]} borderBottomWidth={0} py={1}>
          <Badge colorScheme="blue" fontSize="0.65rem">
            VL · {t("vlLayouts.processDetail.round1")}
          </Badge>
        </Th>
        <Th colSpan={4} textAlign="center" bg={measGroupHeaderBg[2]} borderBottomWidth={0} py={1}>
          <Badge colorScheme="purple" fontSize="0.65rem">
            VL · {t("vlLayouts.processDetail.round2")}
          </Badge>
        </Th>
        <Th colSpan={4} textAlign="center" bg={measGroupHeaderBg[3]} borderBottomWidth={0} py={1}>
          <Badge colorScheme="orange" fontSize="0.65rem">
            VL · {t("vlLayouts.processDetail.round3")}
          </Badge>
        </Th>
      </Tr>
      <Tr>
        {metricSubHeads(measGroupHeaderBg[0])}
        {metricSubHeads(measGroupHeaderBg[1])}
        {metricSubHeads(measGroupHeaderBg[2])}
        {metricSubHeads(measGroupHeaderBg[3])}
      </Tr>
    </Thead>
  );

  const invalidateStyleAfterMeasurement = () => {
    queryClient.invalidateQueries({ queryKey: ["layoutStyle", pk] });
  };

  const saveOriginalCycle = async (processPk: number, v: number | null) => {
    await patchLayoutProcess(processPk, { cycle_time: v != null ? formatSamCycleSecondsForApi(v) : null });
    invalidateStyleAfterMeasurement();
  };
  const saveOriginalManpower = async (processPk: number, v: number | null) => {
    await patchLayoutProcess(processPk, { manpower: v != null ? Math.round(v * 100) / 100 : null });
    invalidateStyleAfterMeasurement();
  };
  const saveRoundCycle = async (processPk: number, round: 1 | 2 | 3, measurement: ILayoutProcessMeasurement | null, v: number | null) => {
    const cycle_time = v != null ? formatSamCycleSecondsForApi(v) : null;
    if (measurement) await patchLayoutProcessMeasurement(measurement.pk, { cycle_time });
    else await createLayoutProcessMeasurement({ layout_process: processPk, round, cycle_time });
    invalidateStyleAfterMeasurement();
  };
  const saveRoundManpower = async (processPk: number, round: 1 | 2 | 3, measurement: ILayoutProcessMeasurement | null, v: number | null) => {
    const manpower = v != null ? Math.round(v) : null;
    if (measurement) await patchLayoutProcessMeasurement(measurement.pk, { manpower });
    else await createLayoutProcessMeasurement({ layout_process: processPk, round, manpower });
    invalidateStyleAfterMeasurement();
  };

  const roundStatsFor = (p: ILayoutProcess, round: 1 | 2 | 3) => {
    const measurement = (p.measurements ?? []).find((m) => m.round === round) ?? null;
    const cycleSec = measurement ? parseSamSecondsField(measurement.cycle_time) : null;
    const mp = measurement?.manpower ?? null;
    const upmh = cycleSec != null && cycleSec > 0 ? upmhDivisorSeconds / cycleSec : null;
    const total = upmh != null && mp != null && mp > 0 ? upmh * mp : null;
    return { measurement, cycleSec, mp, upmh, total };
  };

  /** Reserve a fixed slot so LAYOUT P / code stay column-aligned whether or not a tool is set. */
  const renderToolBadge = (p: ILayoutProcess, align: "start" | "end" = "start") => {
    const label = p.layout_tool_name?.trim();
    return (
      <Box
        w="40px"
        minW="40px"
        flexShrink={0}
        display="flex"
        justifyContent={align === "end" ? "flex-end" : "flex-start"}
        alignItems="center"
      >
        {label ? (
          <Tooltip label={label} hasArrow>
            <Badge
              variant="outline"
              colorScheme="orange"
              fontSize="0.6rem"
              px={1}
              borderRadius="sm"
              maxW="100%"
              overflow="hidden"
              textOverflow="ellipsis"
              whiteSpace="nowrap"
            >
              {label.split(" — ")[0]}
            </Badge>
          </Tooltip>
        ) : null}
      </Box>
    );
  };

  const renderProcessRow = (p: ILayoutProcess, bottleneckPk: number | null = null) => {
    const isBottleneck = bottleneckPk != null && p.pk === bottleneckPk;
    return (
    <SortableProcessTr key={p.pk} id={p.pk} isBottleneck={isBottleneck}>
      <Td isNumeric px={1}>
        <Flex justify="center" w="100%">
          <SamSortOrderBadge sortOrder={p.sort_order} size="xs" />
        </Flex>
      </Td>
      <Td overflow="hidden">
        <Box
          display="grid"
          gridTemplateColumns={isBottleneck ? "40px auto minmax(0, 1fr) 14px" : "40px auto minmax(0, 1fr)"}
          columnGap={1.5}
          alignItems="center"
          minW={0}
        >
          {renderToolBadge(p)}
          <SamBadge kind="layoutProcess" fontSize="0.65rem" px={1.5} borderRadius="sm" />
          <Link
            href="#"
            color="blue.500"
            fontWeight="medium"
            display="block"
            minW={0}
            whiteSpace="nowrap"
            overflow="hidden"
            textOverflow="ellipsis"
            onClick={(e) => {
              e.preventDefault();
              openAppPopupWindow(`/vl-layouts/${pkParam}/processes/${p.pk}`, { width: 1680, height: 960 });
            }}
          >
            {p.code}
          </Link>
          {isBottleneck && (
            <Tooltip label={t("vlLayouts.detail.bottleneckBadge")} hasArrow>
              <Box as="span" color="orange.500" display="inline-flex" flexShrink={0} aria-label={t("vlLayouts.detail.bottleneckBadge")}>
                <FaWineBottle size={11} />
              </Box>
            </Tooltip>
          )}
        </Box>
      </Td>
      <Td px={1}>
        <HStack spacing={0} justify="center">
          <Tooltip label={t("vlLayouts.detail.tooltipProcessPhotos")} hasArrow>
            <IconButton
              aria-label={t("vlLayouts.detail.tooltipProcessPhotos")}
              icon={<FaImage />}
              size="xs"
              variant="ghost"
              colorScheme={processPhotoMuted.get(p.pk) === true ? undefined : "blue"}
              color={processPhotoMuted.get(p.pk) === true ? mediaIconMutedColor : undefined}
              isLoading={layoutMediaBusyKey === `p-${p.pk}-img`}
              onClick={() => void previewProcessPhotos(p.pk)}
            />
          </Tooltip>
          <Tooltip label={t("vlLayouts.detail.tooltipProcessVideos")} hasArrow>
            <IconButton
              aria-label={t("vlLayouts.detail.tooltipProcessVideos")}
              icon={<FaVideo />}
              size="xs"
              variant="ghost"
              colorScheme={processVideoMuted.get(p.pk) === true ? undefined : "purple"}
              color={processVideoMuted.get(p.pk) === true ? mediaIconMutedColor : undefined}
              isLoading={layoutMediaBusyKey === `p-${p.pk}-vid`}
              onClick={() => void previewProcessVideos(p.pk)}
            />
          </Tooltip>
        </HStack>
      </Td>
      <Td fontSize="sm" maxW="140px" isTruncated>
        {p.name || "—"}
      </Td>
      {(() => {
        const originalCycleSec = parseSamSecondsField(p.cycle_time) ?? samProcessCycleSecondsFromParts(p);
        const originalUpmh = p.target_qty_per_hour ?? (originalCycleSec != null && originalCycleSec > 0 ? upmhDivisorSeconds / originalCycleSec : null);
        const originalMp = p.manpower ?? null;
        const originalTotal =
          p.target_qty_per_hour_total ??
          (originalUpmh != null && originalMp != null && originalMp > 0 ? originalUpmh * originalMp : null);
        const rounds = ([1, 2, 3] as const).map((round) => ({ round, ...roundStatsFor(p, round) }));
        return (
          <>
            <LayoutMeasurementEditableCell
              value={originalCycleSec}
              bg={measCellBg[0]}
              format={formatSamCycleSecondsDisplay}
              onSave={(v) => saveOriginalCycle(p.pk, v)}
            />
            <Td isNumeric fontSize="xs" bg={measCellBg[0]} color="gray.500">
              {originalUpmh != null ? originalUpmh.toFixed(1) : "—"}
            </Td>
            <LayoutMeasurementEditableCell
              value={originalMp}
              bg={measCellBg[0]}
              format={(n) => String(n)}
              onSave={(v) => saveOriginalManpower(p.pk, v)}
              extra={renderHelperIndicator(p)}
            />
            <Td isNumeric fontSize="xs" bg={measCellBg[0]} color="gray.500">
              {originalTotal != null ? originalTotal.toFixed(1) : "—"}
            </Td>
            {rounds.map(({ round, measurement, cycleSec, mp, upmh, total }) => (
              <React.Fragment key={round}>
                <LayoutMeasurementEditableCell
                  value={cycleSec}
                  bg={measCellBg[round]}
                  format={formatSamCycleSecondsDisplay}
                  onSave={(v) => saveRoundCycle(p.pk, round, measurement, v)}
                  extra={cycleSec != null ? layoutMeasurementPctDiff(cycleSec, originalCycleSec, false) : null}
                />
                <Td isNumeric fontSize="xs" bg={measCellBg[round]} color="gray.600">
                  {upmh != null ? (
                    <>
                      {upmh.toFixed(1)}
                      {layoutMeasurementPctDiff(upmh, originalUpmh, true)}
                    </>
                  ) : (
                    <Text as="span" color="gray.400">
                      —
                    </Text>
                  )}
                </Td>
                <LayoutMeasurementEditableCell
                  value={mp}
                  bg={measCellBg[round]}
                  format={(n) => String(n)}
                  onSave={(v) => saveRoundManpower(p.pk, round, measurement, v)}
                  extra={mp != null ? layoutMeasurementPctDiff(mp, originalMp, false) : null}
                />
                <Td isNumeric fontSize="xs" bg={measCellBg[round]} color="gray.600">
                  {total != null ? (
                    <>
                      {total.toFixed(1)}
                      {layoutMeasurementPctDiff(total, originalTotal, true)}
                    </>
                  ) : (
                    <Text as="span" color="gray.400">
                      —
                    </Text>
                  )}
                </Td>
              </React.Fragment>
            ))}
          </>
        );
      })()}
    </SortableProcessTr>
    );
  };

  const compactProcessTableHead = (reversed = false) => {
    const cols = [
      <Th key="code" w="140px" textAlign={reversed ? "right" : "left"}>
        {t("vlLayouts.detail.col.code")}
      </Th>,
      <Th key="media" w="64px" px={1} textAlign="center" fontSize="xs" color="gray.500">
        {t("vlLayouts.detail.col.media")}
      </Th>,
      <Th key="name" textAlign={reversed ? "right" : "left"}>
        {t("vlLayouts.detail.col.name")}
      </Th>,
      <Th key="cycle" isNumeric w="76px" px={1} whiteSpace="nowrap" overflow="hidden" textOverflow="ellipsis">
        {t("vlLayouts.detail.col.cycle")}
      </Th>,
      <Th key="upmh" isNumeric w="48px" px={1} fontSize="xs" color="gray.500" whiteSpace="nowrap" overflow="hidden">
        {t("vlLayouts.detail.col.upmh")}
      </Th>,
      <Th key="manpower" isNumeric w="40px" px={1} fontSize="xs" color="gray.500" whiteSpace="nowrap" overflow="hidden">
        {t("vlLayouts.detail.col.manpower")}
      </Th>,
      <Th key="targetQtyPerHour" isNumeric w="60px" px={1} fontSize="xs" color="gray.500" whiteSpace="nowrap" overflow="hidden">
        {t("vlLayouts.detail.col.targetQtyPerHour")}
      </Th>
    ];
    const dragCol = <Th key="drag" w="20px" px={1} />;
    const connectCol = <Th key="connect" w="34px" px={0} />;
    return (
      <Thead>
        <Tr>{reversed ? [...[...cols].reverse(), dragCol, connectCol] : [connectCol, dragCol, ...cols]}</Tr>
      </Thead>
    );
  };

  const renderCompactProcessRow = (p: ILayoutProcess, reversed = false, bottleneckPk: number | null = null) => {
    const isBottleneck = bottleneckPk != null && p.pk === bottleneckPk;
    const bottleneckIcon = isBottleneck ? (
      <Tooltip key="bn" label={t("vlLayouts.detail.bottleneckBadge")} hasArrow>
        <Box as="span" color="orange.500" display="inline-flex" flexShrink={0} aria-label={t("vlLayouts.detail.bottleneckBadge")}>
          <FaWineBottle size={11} />
        </Box>
      </Tooltip>
    ) : null;
    const cells = [
      <Td key="code">
        <Box
          display="grid"
          gridTemplateColumns={
            reversed
              ? isBottleneck
                ? "14px minmax(0, 1fr) auto 40px"
                : "minmax(0, 1fr) auto 40px"
              : isBottleneck
                ? "40px auto minmax(0, 1fr) 14px"
                : "40px auto minmax(0, 1fr)"
          }
          columnGap={1.5}
          alignItems="center"
          w="100%"
          minW={0}
        >
          {reversed ? (
            <>
              {bottleneckIcon}
              <Box minW={0} textAlign="right" overflow="hidden">
                <Link
                  href="#"
                  color="blue.500"
                  fontWeight="medium"
                  fontSize="sm"
                  display="block"
                  whiteSpace="nowrap"
                  overflow="hidden"
                  textOverflow="ellipsis"
                  onClick={(e) => {
                    e.preventDefault();
                    openAppPopupWindow(`/vl-layouts/${pkParam}/processes/${p.pk}`, { width: 1680, height: 960 });
                  }}
                >
                  {p.code}
                </Link>
              </Box>
              <Badge variant="solid" colorScheme="teal" fontSize="0.6rem" px={1} borderRadius="sm">
                P
              </Badge>
              {renderToolBadge(p, "end")}
            </>
          ) : (
            <>
              {renderToolBadge(p)}
              <Badge variant="solid" colorScheme="teal" fontSize="0.6rem" px={1} borderRadius="sm">
                P
              </Badge>
              <Box minW={0} overflow="hidden">
                <Link
                  href="#"
                  color="blue.500"
                  fontWeight="medium"
                  fontSize="sm"
                  display="block"
                  whiteSpace="nowrap"
                  overflow="hidden"
                  textOverflow="ellipsis"
                  onClick={(e) => {
                    e.preventDefault();
                    openAppPopupWindow(`/vl-layouts/${pkParam}/processes/${p.pk}`, { width: 1680, height: 960 });
                  }}
                >
                  {p.code}
                </Link>
              </Box>
              {bottleneckIcon}
            </>
          )}
        </Box>
      </Td>,
      <Td key="media" px={1}>
        <HStack spacing={0} justify="center">
          <Tooltip label={t("vlLayouts.detail.tooltipProcessPhotos")} hasArrow>
            <IconButton
              aria-label={t("vlLayouts.detail.tooltipProcessPhotos")}
              icon={<FaImage />}
              size="xs"
              variant="ghost"
              colorScheme={processPhotoMuted.get(p.pk) === true ? undefined : "blue"}
              color={processPhotoMuted.get(p.pk) === true ? mediaIconMutedColor : undefined}
              isLoading={layoutMediaBusyKey === `p-${p.pk}-img`}
              onClick={() => void previewProcessPhotos(p.pk)}
            />
          </Tooltip>
          <Tooltip label={t("vlLayouts.detail.tooltipProcessVideos")} hasArrow>
            <IconButton
              aria-label={t("vlLayouts.detail.tooltipProcessVideos")}
              icon={<FaVideo />}
              size="xs"
              variant="ghost"
              colorScheme={processVideoMuted.get(p.pk) === true ? undefined : "purple"}
              color={processVideoMuted.get(p.pk) === true ? mediaIconMutedColor : undefined}
              isLoading={layoutMediaBusyKey === `p-${p.pk}-vid`}
              onClick={() => void previewProcessVideos(p.pk)}
            />
          </Tooltip>
        </HStack>
      </Td>,
      <Td key="name" fontSize="sm" maxW="120px" isTruncated textAlign={reversed ? "right" : "left"}>
        {p.name || "—"}
      </Td>,
      <Td key="cycle" isNumeric fontSize="sm">
        {(() => {
          const v = samProcessCycleSecondsFromParts(p);
          return v != null ? formatSamCycleSecondsDisplay(v) : "—";
        })()}
      </Td>,
      ...(() => {
        const cycleSec = samProcessCycleSecondsFromParts(p);
        const upmh = cycleSec != null && cycleSec > 0 ? upmhDivisorSeconds / cycleSec : null;
        const mp = p.manpower;
        const total = upmh != null && mp != null && mp > 0 ? upmh * mp : null;
        return [
          <Td key="upmh" isNumeric fontSize="xs" color="gray.500">
            {upmh != null ? upmh.toFixed(1) : "—"}
          </Td>,
          <Td key="manpower" isNumeric fontSize="xs" color="gray.500">
            {mp ?? "—"}
            {renderHelperIndicator(p)}
          </Td>,
          <Td key="targetQtyPerHour" isNumeric fontSize="xs" color="gray.500">
            {total != null ? total.toFixed(1) : "—"}
            {renderMeasurementIndicator(p)}
          </Td>
        ];
      })()
    ];
    const connectDot = renderFlowDot(p.pk);
    const connectSort = <SamSortOrderBadge sortOrder={p.sort_order} size="xs" />;
    const connectCell = (
      <Td key="connect" px={0}>
        <HStack spacing={1} justify={reversed ? "flex-end" : "flex-start"} w="100%">
          {reversed ? (
            <>
              {connectSort}
              {connectDot}
            </>
          ) : (
            <>
              {connectDot}
              {connectSort}
            </>
          )}
        </HStack>
      </Td>
    );
    return (
      <SortableProcessTr key={p.pk} id={p.pk} reversed={reversed} connectCell={connectCell} isBottleneck={isBottleneck}>
        {reversed ? [...cells].reverse() : cells}
      </SortableProcessTr>
    );
  };

  /** Read-only counterpart of compactProcessTableHead/renderCompactProcessRow for the whole-layout overview —
   * no drag handles or flow dots, since those are keyed by process pk and already registered by the per-module tables. */
  const overviewProcessTableHead = (reversed = false) => {
    const cols = [
      <Th key="code" w="150px" textAlign={reversed ? "right" : "left"}>
        {t("vlLayouts.detail.col.code")}
      </Th>,
      <Th key="name" textAlign={reversed ? "right" : "left"}>
        {t("vlLayouts.detail.col.name")}
      </Th>,
      <Th key="cycle" isNumeric w="76px" px={1} whiteSpace="nowrap">
        {t("vlLayouts.detail.col.cycle")}
      </Th>,
      <Th key="upmh" isNumeric w="48px" px={1} fontSize="xs" color="gray.500" whiteSpace="nowrap">
        {t("vlLayouts.detail.col.upmh")}
      </Th>,
      <Th key="manpower" isNumeric w="40px" px={1} fontSize="xs" color="gray.500" whiteSpace="nowrap">
        {t("vlLayouts.detail.col.manpower")}
      </Th>,
      <Th key="targetQtyPerHour" isNumeric w="60px" px={1} fontSize="xs" color="gray.500" whiteSpace="nowrap">
        {t("vlLayouts.detail.col.targetQtyPerHour")}
      </Th>
    ];
    return (
      <Thead>
        <Tr>{reversed ? [...cols].reverse() : cols}</Tr>
      </Thead>
    );
  };

  const renderOverviewProcessRow = (p: ILayoutProcess, moduleCode: string, reversed = false, bottleneckPk: number | null = null) => {
    const isBottleneck = bottleneckPk != null && p.pk === bottleneckPk;
    const cycleSec = samProcessCycleSecondsFromParts(p);
    const upmh = cycleSec != null && cycleSec > 0 ? upmhDivisorSeconds / cycleSec : null;
    const mp = p.manpower;
    const total = upmh != null && mp != null && mp > 0 ? upmh * mp : null;
    const moduleBadge = (
      <Badge key="mod" variant="outline" colorScheme="blue" fontSize="0.6rem" px={1} borderRadius="sm" flexShrink={0}>
        {moduleCode}
      </Badge>
    );
    const bottleneckIcon = isBottleneck ? (
      <Tooltip key="bn" label={t("vlLayouts.detail.bottleneckBadge")} hasArrow>
        <Box as="span" color="orange.500" display="inline-flex" flexShrink={0}>
          <FaWineBottle size={11} />
        </Box>
      </Tooltip>
    ) : null;
    const codeCell = (
      <Td key="code">
        <HStack spacing={1.5} justify={reversed ? "flex-end" : "flex-start"} minW={0}>
          {reversed ? (
            <>
              {bottleneckIcon}
              <Box minW={0} textAlign="right" overflow="hidden">
                <Link
                  href="#"
                  color="blue.500"
                  fontWeight="medium"
                  fontSize="sm"
                  display="block"
                  whiteSpace="nowrap"
                  overflow="hidden"
                  textOverflow="ellipsis"
                  onClick={(e) => {
                    e.preventDefault();
                    openAppPopupWindow(`/vl-layouts/${pkParam}/processes/${p.pk}`, { width: 1680, height: 960 });
                  }}
                >
                  {p.code}
                </Link>
              </Box>
              {moduleBadge}
            </>
          ) : (
            <>
              {moduleBadge}
              <Box minW={0} overflow="hidden">
                <Link
                  href="#"
                  color="blue.500"
                  fontWeight="medium"
                  fontSize="sm"
                  display="block"
                  whiteSpace="nowrap"
                  overflow="hidden"
                  textOverflow="ellipsis"
                  onClick={(e) => {
                    e.preventDefault();
                    openAppPopupWindow(`/vl-layouts/${pkParam}/processes/${p.pk}`, { width: 1680, height: 960 });
                  }}
                >
                  {p.code}
                </Link>
              </Box>
              {bottleneckIcon}
            </>
          )}
        </HStack>
      </Td>
    );
    const cells = [
      codeCell,
      <Td key="name" fontSize="sm" maxW="120px" isTruncated textAlign={reversed ? "right" : "left"}>
        {p.name || "—"}
      </Td>,
      <Td key="cycle" isNumeric fontSize="sm">
        {cycleSec != null ? formatSamCycleSecondsDisplay(cycleSec) : "—"}
      </Td>,
      <Td key="upmh" isNumeric fontSize="xs" color="gray.500">
        {upmh != null ? upmh.toFixed(1) : "—"}
      </Td>,
      <Td key="manpower" isNumeric fontSize="xs" color="gray.500">
        {mp ?? "—"}
        {renderHelperIndicator(p)}
      </Td>,
      <Td key="targetQtyPerHour" isNumeric fontSize="xs" color="gray.500">
        {total != null ? total.toFixed(1) : "—"}
      </Td>
    ];
    return (
      <Tr
        key={p.pk}
        bg={isBottleneck ? overviewBottleneckBg : undefined}
        boxShadow={isBottleneck ? "inset 3px 0 0 var(--chakra-colors-orange-400)" : undefined}
      >
        {reversed ? [...cells].reverse() : cells}
      </Tr>
    );
  };

  if (!Number.isFinite(pk)) {
    return (
      <Box p={8}>
        <Text>Invalid id</Text>
      </Box>
    );
  }

  if (isLoading || !detail) {
    return (
      <Center minH="200px">
        <Spinner />
      </Center>
    );
  }

  const activeDragPreview = (() => {
    if (!activeDragId) return null;
    if (activeDragId.startsWith("mod-")) {
      const modPk = parseInt(activeDragId.slice("mod-".length));
      const mod = detail.layout_modules.find((m) => m.pk === modPk);
      if (!mod) return null;
      return { kind: "layoutModule" as const, code: mod.code, name: mod.name };
    }
    if (activeDragId.startsWith("proc-")) {
      const procPk = parseInt(activeDragId.slice("proc-".length));
      for (const mod of detail.layout_modules) {
        const p = (mod.layout_processes ?? []).find((pp) => pp.pk === procPk);
        if (p) return { kind: "layoutProcess" as const, code: p.code, name: p.name };
      }
    }
    return null;
  })();

  return (
    <>
      <Helmet>
        <title>
          {detail.sj_style.code} — {t("vlLayouts.detail.modulesProcessesPageTitle")}
        </title>
      </Helmet>
      <Box bg={pageBg} minH="100%" px={{ base: 2, md: 4, lg: 6 }} py={{ base: 6, md: 8 }}>
        <DndContext
          sensors={dndSensors}
          collisionDetection={layoutCollisionDetection}
          onDragStart={handleDragStart}
          onDragEnd={(e) => void handleDragEnd(e)}
          onDragCancel={() => setActiveDragId(null)}
        >
          <Box maxW="1500px" mx="auto">
            <HStack mb={4} spacing={3} flexWrap="wrap">
              <Button as={RouterLink} to="/vl-layouts" leftIcon={<FaArrowLeft />} variant="ghost" size="sm">
                {t("vlLayouts.detail.backToSamStyleOverview")}
              </Button>
            </HStack>

            <HStack align="flex-start" spacing={3} mb={4}>
              {stylePhotoSrc && (
                <Image
                  src={stylePhotoSrc}
                  alt={detail.sj_style.code}
                  boxSize="56px"
                  objectFit="cover"
                  borderRadius="md"
                  borderWidth="1px"
                  borderColor={outlineCardDivider}
                  flexShrink={0}
                  cursor="zoom-in"
                  title={t("vlLayouts.detail.tooltipStylePhoto")}
                  onClick={() => setStylePhotoModalOpen(true)}
                />
              )}
              <Box>
                <Heading size="md" mb={1}>
                  {t("vlLayouts.detail.modulesTitle")}
                </Heading>
                <Text color={subtleTextColor} fontSize="sm">
                  {detail.sj_style.code}
                  {detail.sj_style.style_name ? ` · ${detail.sj_style.style_name}` : ""}
                </Text>
              </Box>
            </HStack>

            {(() => {
              const moduleCount = detail.layout_modules.length;
              return (
                <Box mb={4}>
                  <LayoutAnalysisSummaryPanel
                    analysis={pageAnalysis}
                    roundAnalyses={pageRoundAnalyses}
                    title={t("vlLayouts.detail.overallStatsTitle")}
                    countLine={
                      <>
                        {t("vlLayouts.detail.overallStatsCategories", { count: groups.length })}
                        <Text as="span" color={fainterTextColor} mx={1}>
                          ·
                        </Text>
                        {t("vlLayouts.detail.overallStatsModules", { count: moduleCount })}
                        <Text as="span" color={fainterTextColor} mx={1}>
                          ·
                        </Text>
                        {t("vlLayouts.detail.overallStatsProcesses", { count: pageAnalysis.processCount })}
                      </>
                    }
                  />
                </Box>
              );
            })()}

            <HStack justify="flex-end" mb={3} flexWrap="wrap" rowGap={2}>
              <HStack spacing={2} flexWrap="wrap">
                {groups.length > 0 && (
                  <Tooltip label={layoutAccordionAllExpanded ? t("vlLayouts.detail.collapseAll") : t("vlLayouts.detail.expandAll")} hasArrow>
                    <IconButton
                      aria-label={layoutAccordionAllExpanded ? t("vlLayouts.detail.collapseAll") : t("vlLayouts.detail.expandAll")}
                      icon={layoutAccordionAllExpanded ? <FaChevronUp /> : <FaChevronDown />}
                      size="xs"
                      variant="outline"
                      onClick={layoutAccordionAllExpanded ? layoutAccordionCollapseAll : layoutAccordionExpandAll}
                    />
                  </Tooltip>
                )}
                <Button as={RouterLink} to={`/vl-layouts/${pk}/measurements`} size="sm" leftIcon={<FaChartBar />} variant="outline">
                  {t("vlLayouts.measurementsReport.linkLabel")}
                </Button>
                {overviewProcs.length > 0 && (
                  <Button
                    size="sm"
                    leftIcon={<FaStream />}
                    variant={showFullOverview ? "solid" : "outline"}
                    colorScheme={showFullOverview ? "teal" : "gray"}
                    onClick={() => setShowFullOverview((v) => !v)}
                  >
                    {t("vlLayouts.detail.fullOverviewToggle")}
                  </Button>
                )}
                <Button size="sm" leftIcon={<FaPlus />} onClick={() => openAddModule()}>
                  {t("vlLayouts.detail.addModule")}
                </Button>
              </HStack>
            </HStack>
            {groups.length === 0 && (
              <Text color="gray.500" fontSize="sm" mb={4}>
                {t("vlLayouts.detail.noModules")}
              </Text>
            )}
            <Modal isOpen={showFullOverview} onClose={() => setShowFullOverview(false)} size="6xl" scrollBehavior="inside">
              <ModalOverlay />
              <ModalContent bg={cardBg}>
                <ModalHeader>
                  <Text fontSize="md" fontWeight="bold">
                    {t("vlLayouts.detail.fullOverviewTitle")}
                  </Text>
                  <Text fontSize="xs" fontWeight="normal" color={subtleTextColor} mt={0.5}>
                    {t("vlLayouts.detail.fullOverviewHint")}
                  </Text>
                </ModalHeader>
                <ModalCloseButton />
                <ModalBody pb={6}>
                  {overviewProcs.length === 0 ? (
                    <Text color="gray.500" fontSize="sm">
                      {t("vlLayouts.detail.noModules")}
                    </Text>
                  ) : (
                    (() => {
                      const half = Math.ceil(overviewProcs.length / 2);
                      const leftProcs = overviewProcs.slice(0, half);
                      const rightProcs = overviewProcs.slice(half);
                      const bottleneckPk = pageAnalysis.bottleneck?.pk ?? null;
                      return (
                        <Grid templateColumns="1fr auto 1fr" gap={2} alignItems="stretch">
                          <TableContainer overflowX="auto" ref={resetSplitTableScroll}>
                            <Table size="sm" variant="simple" minW="560px" sx={{ tableLayout: "fixed", width: "100%", "th, td": { paddingY: "4px", fontSize: "xs" } }}>
                              {overviewProcessTableHead(true)}
                              <Tbody>{leftProcs.map(({ p, moduleCode }) => renderOverviewProcessRow(p, moduleCode, true, bottleneckPk))}</Tbody>
                            </Table>
                          </TableContainer>
                          <Flex
                            alignSelf="stretch"
                            w="100px"
                            minH="60px"
                            borderRadius="md"
                            bg={lineTrackBg}
                            border="1px solid"
                            borderColor={lineBorderColor}
                            align="center"
                            justify="center"
                            position="relative"
                            overflow="visible"
                          >
                            <VStack spacing={0} position="absolute" inset={0} justify="space-evenly" color={lineArrowColor} py={2}>
                              {Array.from({ length: 5 }).map((_, i) => (
                                <FaChevronUp key={i} size={10} />
                              ))}
                            </VStack>
                            <Text position="relative" fontSize="xs" fontWeight="bold" color={lineBorderColor} letterSpacing="wide" textAlign="center" px={1}>
                              {t("vlLayouts.detail.productionLine")}
                            </Text>
                          </Flex>
                          <TableContainer overflowX="auto" ref={resetSplitTableScroll}>
                            <Table size="sm" variant="simple" minW="560px" sx={{ tableLayout: "fixed", width: "100%", "th, td": { paddingY: "4px", fontSize: "xs" } }}>
                              {overviewProcessTableHead()}
                              <Tbody>{rightProcs.map(({ p, moduleCode }) => renderOverviewProcessRow(p, moduleCode, false, bottleneckPk))}</Tbody>
                            </Table>
                          </TableContainer>
                        </Grid>
                      );
                    })()
                  )}
                </ModalBody>
              </ModalContent>
            </Modal>
            <Box position="relative" ref={flowAreaRef}>
              {dragLine && (
                <svg
                  style={{
                    position: "absolute",
                    inset: 0,
                    width: "100%",
                    height: "100%",
                    pointerEvents: "none",
                    overflow: "visible",
                    zIndex: 10
                  }}
                >
                  <line x1={dragLine.x0} y1={dragLine.y0} x2={dragLine.x} y2={dragLine.y} stroke="var(--chakra-colors-teal-500)" strokeWidth={1.5} strokeDasharray="4 3" />
                </svg>
              )}
              <Accordion
                allowMultiple
                index={layoutAccordionIndex}
                onChange={(expanded) => {
                  if (Array.isArray(expanded)) setLayoutAccordionIndex(expanded);
                  else if (typeof expanded === "number") setLayoutAccordionIndex(expanded < 0 ? [] : [expanded]);
                  else setLayoutAccordionIndex([]);
                }}
            >
              {groups.map((g) => {
                const catScheme = samCategoryColorScheme(g.catId);
                const catProcs = g.modules.flatMap((m) => m.layout_processes ?? []);
                const catAnalysis = analyzeLayoutProcesses(catProcs, upmhDivisorSeconds);
                const sep = (
                  <Text as="span" color={fainterTextColor} mx={1}>
                    ·
                  </Text>
                );
                return (
                  <AccordionItem
                    key={g.catId}
                    borderWidth="1px"
                    borderColor={outlineCardDivider}
                    borderRadius="md"
                    mb={2}
                    overflow="hidden"
                  >
                    <h2>
                      <AccordionButton bg={accordionHeaderBg}>
                        <Box flex="1" textAlign="left" fontWeight="semibold">
                          <HStack spacing={2} align="center" flexWrap="wrap" rowGap={1}>
                            <Badge colorScheme={catScheme} variant="solid" fontSize="0.65rem" px={2} py={0.5} borderRadius="sm" verticalAlign="middle">
                              {g.catName}
                            </Badge>
                            <Text as="span" fontSize="xs" color={subtleTextColor} fontWeight="normal">
                              {t("vlLayouts.detail.categoryStatsModules", { count: g.modules.length })}
                              {sep}
                              {t("vlLayouts.detail.categoryStatsProcesses", { count: catAnalysis.processCount })}
                              {sep}
                              {catAnalysis.cycleSum != null
                                ? t("vlLayouts.detail.moduleStatsCycleSum", {
                                    seconds: formatCycleSumForDisplay(catAnalysis.cycleSum)
                                  })
                                : t("vlLayouts.detail.moduleStatsCycleSumMissing")}
                              {sep}
                              {t("vlLayouts.detail.analysisHeaderUpmhMin", {
                                value: formatAnalysisMetricNumber(catAnalysis.upmhMin)
                              })}
                              {sep}
                              {t("vlLayouts.detail.analysisHeaderMpTotal", {
                                value: formatAnalysisMetricNumber(catAnalysis.manpowerSum, 2)
                              })}
                              {sep}
                              {t("vlLayouts.detail.analysisHeaderTargetMin", {
                                value: formatAnalysisMetricNumber(catAnalysis.targetMin)
                              })}
                            </Text>
                          </HStack>
                        </Box>
                        <AccordionIcon />
                      </AccordionButton>
                    </h2>
                    <AccordionPanel pb={4} bg={panelBg}>
                      <HStack justify="flex-end" w="100%" mb={3}>
                        <Button size="xs" leftIcon={<FaPlus />} onClick={() => openAddModule(g.catId)}>
                          {t("vlLayouts.detail.addModuleHere")}
                        </Button>
                      </HStack>
                      <SortableContext items={g.modules.map((m) => `mod-${m.pk}`)} strategy={verticalListSortingStrategy}>
                        <VStack align="stretch" spacing={4}>
                          {g.modules.map((mod) => (
                            <SortableModuleItem key={mod.pk} id={mod.pk}>
                              {(dragHandle) => (
                                <Box borderWidth="1px" borderColor={outlineCardDivider} borderRadius="md" p={3} bg={cardBg}>
                                  <HStack mb={2} align="flex-start">
                                    <HStack spacing={2} align="center" flex="1" minW={0}>
                                      {dragHandle}
                                      <SamBadge kind="layoutModule" />
                                      {moduleThumbnailByPk.get(mod.pk) && (
                                        <Image
                                          src={moduleThumbnailByPk.get(mod.pk)}
                                          boxSize="36px"
                                          objectFit="cover"
                                          borderRadius="sm"
                                          flexShrink={0}
                                          cursor="pointer"
                                          onClick={() => void previewModulePhotos(mod.pk)}
                                          title={t("vlLayouts.detail.tooltipModulePhotos")}
                                        />
                                      )}
                                      <Link
                                        href="#"
                                        fontWeight="bold"
                                        color="blue.500"
                                        _hover={{ textDecoration: "underline" }}
                                        onClick={(e) => {
                                          e.preventDefault();
                                          openAppPopupWindow(`/vl-layouts/${pkParam}/modules/${mod.pk}`, { width: 1680, height: 960 });
                                        }}
                                      >
                                        [{mod.code}] {mod.name || "—"}
                                      </Link>
                                    </HStack>
                                  </HStack>
                                  {(() => {
                                    const modAnalysis = analyzeLayoutProcesses(mod.layout_processes, upmhDivisorSeconds);
                                    const modRoundAnalyses = ([1, 2, 3] as const).map((round) => ({
                                      round,
                                      analysis: analyzeLayoutProcessesForRound(mod.layout_processes, round, upmhDivisorSeconds)
                                    }));
                                    return (
                                      <LayoutAnalysisSummaryPanel
                                        analysis={modAnalysis}
                                        roundAnalyses={modRoundAnalyses}
                                        compact
                                        title={t("vlLayouts.detail.moduleAnalysisTitle")}
                                        countLine={t("vlLayouts.detail.moduleStatsProcesses", {
                                          count: modAnalysis.processCount
                                        })}
                                      />
                                    );
                                  })()}
                                  <HStack justify="flex-end" w="100%" mb={2} spacing={2}>
                                    <Button
                                      size="xs"
                                      leftIcon={<FaColumns />}
                                      variant={!singleColumnModulePks.has(mod.pk) && (mod.layout_processes ?? []).length > 1 ? "solid" : "outline"}
                                      colorScheme={!singleColumnModulePks.has(mod.pk) && (mod.layout_processes ?? []).length > 1 ? "teal" : "gray"}
                                      onClick={() => toggleModuleSplit(mod.pk)}
                                    >
                                      {t("vlLayouts.detail.splitColumns")}
                                    </Button>
                                    <Button size="xs" leftIcon={<FaPlus />} onClick={() => openAddProcess(mod.pk)}>
                                      {t("vlLayouts.detail.addProcess")}
                                    </Button>
                                  </HStack>
                                  {(() => {
                                    const sortedProcs = [...(mod.layout_processes ?? [])].sort(compareLayoutProcessBySortOrder);
                                    const bottleneckPk = analyzeLayoutProcesses(sortedProcs, upmhDivisorSeconds).bottleneck?.pk ?? null;
                                    const isSplit = !singleColumnModulePks.has(mod.pk) && sortedProcs.length > 1;
                                    const half = isSplit ? getLeftColumnCount(mod.pk, sortedProcs.length) : sortedProcs.length;
                                    const leftProcs = isSplit ? sortedProcs.slice(0, half) : sortedProcs;
                                    const rightProcs = isSplit ? sortedProcs.slice(half) : [];
                                    return isSplit ? (
                                      <Grid templateColumns="1fr auto 1fr" gap={2} alignItems="stretch">
                                        <TableContainer overflowX="auto" ref={resetSplitTableScroll}>
                                          <Table size="sm" variant="simple" minW="520px" sx={{ tableLayout: "fixed", width: "100%", "th, td": { paddingY: "4px", fontSize: "xs" } }}>
                                            {compactProcessTableHead(true)}
                                            <SortableContext items={leftProcs.map((p) => `proc-${p.pk}`)} strategy={verticalListSortingStrategy}>
                                              <Tbody>{leftProcs.map((p) => renderCompactProcessRow(p, true, bottleneckPk))}</Tbody>
                                            </SortableContext>
                                          </Table>
                                        </TableContainer>
                                        {renderLineConnector(mod.pk)}
                                        <TableContainer overflowX="auto" ref={resetSplitTableScroll}>
                                          <Table size="sm" variant="simple" minW="520px" sx={{ tableLayout: "fixed", width: "100%", "th, td": { paddingY: "4px", fontSize: "xs" } }}>
                                            {compactProcessTableHead()}
                                            <SortableContext items={rightProcs.map((p) => `proc-${p.pk}`)} strategy={verticalListSortingStrategy}>
                                              <Tbody>{rightProcs.map((p) => renderCompactProcessRow(p, false, bottleneckPk))}</Tbody>
                                            </SortableContext>
                                          </Table>
                                        </TableContainer>
                                      </Grid>
                                    ) : (
                                      <Box>
                                        <Text fontSize="xs" color="gray.500" mb={2}>
                                          {t("vlLayouts.detail.measurementInlineHint")}
                                        </Text>
                                        <TableContainer overflowX="auto">
                                          <Table size="sm" variant="simple" minW="1280px" sx={{ "th, td": { paddingY: "4px" } }}>
                                            {processTableHead()}
                                            <SortableContext items={leftProcs.map((p) => `proc-${p.pk}`)} strategy={verticalListSortingStrategy}>
                                              <Tbody>{leftProcs.map((p) => renderProcessRow(p, bottleneckPk))}</Tbody>
                                            </SortableContext>
                                          </Table>
                                        </TableContainer>
                                      </Box>
                                    );
                                  })()}
                                </Box>
                              )}
                            </SortableModuleItem>
                          ))}
                        </VStack>
                      </SortableContext>
                    </AccordionPanel>
                  </AccordionItem>
                );
              })}
              </Accordion>
            </Box>

            <Divider my={8} />
            <Text fontSize="xs" color="gray.500">
              {t("vlLayouts.detail.footerNote")}
            </Text>
          </Box>
          <DragOverlay>
            {activeDragPreview ? (
              <Box bg={cardBg} borderWidth="2px" borderColor="teal.400" borderRadius="md" px={3} py={2} boxShadow="lg" display="inline-flex" alignItems="center" gap={2}>
                <SamBadge kind={activeDragPreview.kind} />
                <Text fontWeight="bold" fontSize="sm">
                  [{activeDragPreview.code}] {activeDragPreview.name || ""}
                </Text>
              </Box>
            ) : null}
          </DragOverlay>
        </DndContext>
      </Box>

      <Modal isOpen={modModal.isOpen} onClose={modModal.onClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>{t("vlLayouts.detail.addModule")}</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <FormControl mb={3} isRequired>
              <FormLabel fontSize="sm">{t("vlLayouts.detail.category")}</FormLabel>
              <Select
                placeholder={t("vlLayouts.detail.categoryPlaceholder")}
                value={modForm.module_category === "" ? "" : String(modForm.module_category)}
                onChange={(e) => setModForm((f) => ({ ...f, module_category: e.target.value ? Number(e.target.value) : "" }))}
              >
                {sortedCats.map((c: IModuleCategory) => (
                  <option key={c.pk} value={c.pk}>
                    {c.parent_name ? `${c.parent_name} › ${c.name}` : c.name}
                  </option>
                ))}
              </Select>
            </FormControl>
            <FormControl mb={3} isRequired>
              <FormLabel fontSize="sm">{t("vlLayouts.detail.moduleCode")}</FormLabel>
              <Input value={modForm.code} onChange={(e) => setModForm((f) => ({ ...f, code: e.target.value }))} />
            </FormControl>
            <FormControl mb={3}>
              <FormLabel fontSize="sm">{t("vlLayouts.detail.moduleName")}</FormLabel>
              <Input value={modForm.name} onChange={(e) => setModForm((f) => ({ ...f, name: e.target.value }))} />
            </FormControl>
            <FormControl>
              <FormLabel fontSize="sm">{t("vlLayouts.detail.sortOrder")}</FormLabel>
              <Input type="number" value={modForm.sort_order} onChange={(e) => setModForm((f) => ({ ...f, sort_order: e.target.value }))} />
            </FormControl>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={modModal.onClose}>
              {t("vlLayouts.common.cancel")}
            </Button>
            <Button colorScheme="blue" onClick={submitModule}>
              {t("vlLayouts.detail.add")}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <Modal isOpen={!!procModal} onClose={closeProcModal}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>{t("vlLayouts.detail.addProcess")}</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack spacing={3} align="stretch">
              <FormControl>
                <FormLabel fontSize="sm">
                  <VisuallyHidden>{t("vlLayouts.detail.col.sort_order")}</VisuallyHidden>
                </FormLabel>
                <Input
                  type="number"
                  min={0}
                  step={1}
                  aria-label={t("vlLayouts.detail.col.sort_order")}
                  placeholder={t("vlLayouts.detail.processSortOrderPlaceholder")}
                  value={procForm.sort_order}
                  onChange={(e) => setProcForm((f) => ({ ...f, sort_order: e.target.value }))}
                />
              </FormControl>
              <FormControl isRequired>
                <FormLabel fontSize="sm">{t("vlLayouts.detail.col.code")}</FormLabel>
                <Input value={procForm.code} onChange={(e) => setProcForm((f) => ({ ...f, code: e.target.value }))} />
              </FormControl>
              <FormControl>
                <FormLabel fontSize="sm">{t("vlLayouts.detail.col.name")}</FormLabel>
                <Input value={procForm.name} onChange={(e) => setProcForm((f) => ({ ...f, name: e.target.value }))} />
              </FormControl>
              <FormControl>
                <FormLabel fontSize="sm">{t("vlLayouts.processDetail.layoutTool")}</FormLabel>
                <Select
                  size="sm"
                  placeholder={t("vlLayouts.processDetail.layoutToolPlaceholder")}
                  value={procAddSelectedTool}
                  onChange={(e) => setProcAddSelectedTool(e.target.value ? Number(e.target.value) : "")}
                >
                  {layoutTools.map((tool) => (
                    <option key={tool.pk} value={tool.pk}>
                      {tool.name?.trim() ? `${tool.code} — ${tool.name}` : tool.code}
                    </option>
                  ))}
                </Select>
                <Text fontSize="2xs" color={subtleTextColor} mt={1}>
                  <Link color="blue.500" onClick={() => openAppPopupWindow("/vl-layouts/tools")}>
                    {t("vlLayouts.processDetail.manageTools")}
                  </Link>
                </Text>
              </FormControl>
              <HStack>
                <FormControl>
                  <FormLabel fontSize="sm">{t("vlLayouts.detail.col.prep")}</FormLabel>
                  <Input value={procForm.prep_seconds} onChange={(e) => setProcForm((f) => ({ ...f, prep_seconds: e.target.value }))} />
                </FormControl>
                <FormControl>
                  <FormLabel fontSize="sm">{t("vlLayouts.detail.col.mach")}</FormLabel>
                  <Input value={procForm.machining_seconds} onChange={(e) => setProcForm((f) => ({ ...f, machining_seconds: e.target.value }))} />
                </FormControl>
              </HStack>
              <HStack>
                <FormControl>
                  <FormLabel fontSize="sm">{t("vlLayouts.detail.col.fin")}</FormLabel>
                  <Input value={procForm.finishing_seconds} onChange={(e) => setProcForm((f) => ({ ...f, finishing_seconds: e.target.value }))} />
                </FormControl>
                <FormControl>
                  <FormLabel fontSize="sm">{t("vlLayouts.detail.col.manpower")}</FormLabel>
                  <Input
                    type="number"
                    min={0}
                    step={0.25}
                    value={procForm.manpower}
                    onChange={(e) => setProcForm((f) => ({ ...f, manpower: e.target.value }))}
                  />
                </FormControl>
              </HStack>
              <FormControl>
                <FormLabel fontSize="sm">{t("vlLayouts.detail.col.cycle")}</FormLabel>
                <Text fontSize="sm" color={subtleTextColor}>
                  {(() => {
                    const v = samProcessCycleSecondsFromFormStrings(procForm.prep_seconds, procForm.machining_seconds, procForm.finishing_seconds);
                    return v != null ? formatSamCycleSecondsDisplay(v) : "—";
                  })()}
                </Text>
              </FormControl>
            </VStack>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={closeProcModal}>
              {t("vlLayouts.common.cancel")}
            </Button>
            <Button colorScheme="blue" onClick={submitProcess}>
              {t("vlLayouts.detail.add")}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <PhotoModal isOpen={layoutMediaPhotoModal.open} onClose={() => setLayoutMediaPhotoModal({ open: false, images: [] })} images={layoutMediaPhotoModal.images} />
      <PhotoModal
        isOpen={stylePhotoModalOpen}
        onClose={() => setStylePhotoModalOpen(false)}
        sjStylePk={detail.sj_style.pk}
        selectedImage={detail.sj_style.thumbnail ?? undefined}
      />
      <VideoModal isOpen={layoutMediaVideoModal.open} onClose={() => setLayoutMediaVideoModal({ open: false, url: undefined })} selectedVideo={layoutMediaVideoModal.url} />
    </>
  );
}
