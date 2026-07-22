import {
  Badge,
  Box,
  Button,
  Center,
  Divider,
  HStack,
  Heading,
  IconButton,
  Image,
  Input,
  Link,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalOverlay,
  SimpleGrid,
  Spinner,
  Table,
  TableContainer,
  Tbody,
  Td,
  Text,
  Textarea,
  Th,
  Thead,
  Tooltip,
  Tr,
  Wrap,
  WrapItem,
  useColorModeValue,
  useToast
} from "@chakra-ui/react";
import { Fragment, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Helmet } from "react-helmet";
import { Link as RouterLink, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { FaArrowLeft, FaChevronDown, FaChevronRight, FaCompressAlt, FaExpandAlt, FaExternalLinkAlt, FaFilm } from "react-icons/fa";
import {
  getLayoutStyleDetail,
  getLayoutSettings,
  patchLayoutProcess,
  patchLayoutProcessMeasurement,
  createLayoutProcessMeasurement,
  type IFilePhotos,
  type ILayoutProcess,
  type ILayoutProcessMeasurement,
  type IProcessVideo
} from "../api";
import { formatSamCycleSecondsDisplay, formatSamCycleSecondsForApi, parseSamSecondsField, samProcessCycleSecondsFromParts } from "../lib/samProcessCycle";

type RoundStats = { cycleSec: number | null; mp: number | null; upmh: number | null; total: number | null };

const ROUND_COLOR_SCHEME: Record<0 | 1 | 2 | 3, string> = { 0: "gray", 1: "blue", 2: "purple", 3: "orange" };

function pctDiffNode(value: number, original: number | null, higherIsBetter: boolean) {
  if (original == null) return null;
  const diff = value - original;
  const isFlat = Math.abs(diff) < 1e-9;
  if (isFlat) return null;
  const isGood = higherIsBetter ? diff > 0 : diff < 0;
  const pct = original !== 0 ? (diff / Math.abs(original)) * 100 : null;
  if (pct == null) return null;
  return (
    <Text as="span" fontSize="0.65rem" fontWeight="semibold" color={isGood ? "green.500" : "red.500"} ml={1}>
      ({pct > 0 ? "+" : ""}
      {pct.toFixed(1)}%)
    </Text>
  );
}

function metricCell(key: string, value: number | null, original: number | null, higherIsBetter: boolean, format: (n: number) => string, bg?: string) {
  if (value == null) {
    return (
      <Td key={key} isNumeric fontSize="xs" color="gray.400" bg={bg}>
        —
      </Td>
    );
  }
  return (
    <Td key={key} isNumeric fontSize="xs" bg={bg}>
      {format(value)}
      {pctDiffNode(value, original, higherIsBetter)}
    </Td>
  );
}

/** Click-to-edit numeric cell — shared by ORIGINAL and each measurement round for Cycle(s) / Manpower. */
function EditableNumberCell({
  value,
  bg,
  format,
  onSave,
  extra
}: {
  value: number | null;
  bg?: string;
  format: (n: number) => string;
  onSave: (v: number | null) => Promise<void>;
  extra?: React.ReactNode;
}) {
  const toast = useToast();
  const hoverBg = useColorModeValue("blackAlpha.50", "whiteAlpha.100");
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const startEdit = () => {
    setDraft(value != null ? String(value) : "");
    setIsEditing(true);
  };

  const commit = async () => {
    const raw = draft.trim();
    const parsed = raw === "" ? null : Number(raw);
    if (parsed != null && !Number.isFinite(parsed)) {
      toast({ title: "Invalid number", status: "warning", duration: 1500, position: "bottom-right" });
      return;
    }
    if (parsed === value || (parsed == null && value == null)) {
      setIsEditing(false);
      return;
    }
    setIsSaving(true);
    try {
      await onSave(parsed);
      setIsEditing(false);
    } catch {
      toast({ title: "Save failed", status: "error", duration: 2000, position: "bottom-right" });
    } finally {
      setIsSaving(false);
    }
  };

  if (isEditing) {
    return (
      <Td isNumeric fontSize="xs" bg={bg} p={1}>
        <Input
          size="xs"
          w="72px"
          textAlign="right"
          type="number"
          autoFocus
          value={draft}
          isDisabled={isSaving}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => void commit()}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
            if (e.key === "Escape") setIsEditing(false);
          }}
        />
      </Td>
    );
  }

  return (
    <Td isNumeric fontSize="xs" bg={bg} cursor="pointer" _hover={{ bg: hoverBg }} onClick={startEdit}>
      {value != null ? format(value) : <Text as="span" color="gray.400">—</Text>}
      {value != null ? extra : null}
    </Td>
  );
}

/** Small colored chips summarizing how a round's numbers moved vs. the original — a quick "what changed" glance. */
function InsightChips({
  original,
  round,
  t
}: {
  original: RoundStats;
  round: RoundStats;
  t: (k: string, options?: Record<string, unknown>) => string;
}) {
  const chips: Array<{ key: string; label: string; pct: number; isGood: boolean }> = [];
  const push = (key: string, label: string, value: number | null, base: number | null, higherIsBetter: boolean) => {
    if (value == null || base == null || base === 0) return;
    const diff = value - base;
    if (Math.abs(diff) < 1e-9) return;
    chips.push({ key, label, pct: (diff / Math.abs(base)) * 100, isGood: higherIsBetter ? diff > 0 : diff < 0 });
  };
  push("cycle", t("vlLayouts.detail.col.cycle"), round.cycleSec, original.cycleSec, false);
  push("mp", t("vlLayouts.processDetail.manpower"), round.mp, original.mp, false);
  push("total", t("vlLayouts.processDetail.targetQtyPerHour"), round.total, original.total, true);

  if (chips.length === 0) {
    return (
      <Text fontSize="0.7rem" color="gray.400">
        {t("vlLayouts.measurementsReport.noChange")}
      </Text>
    );
  }

  return (
    <Wrap spacing={1}>
      {chips.map((c) => (
        <WrapItem key={c.key}>
          <Badge colorScheme={c.isGood ? "green" : "red"} fontSize="0.6rem" fontWeight="semibold">
            {c.label} {c.pct > 0 ? "+" : ""}
            {c.pct.toFixed(1)}%
          </Badge>
        </WrapItem>
      ))}
    </Wrap>
  );
}

function MediaThumbs({
  photos,
  videos,
  emptyLabel,
  onOpenPhoto,
  onOpenVideo
}: {
  photos: IFilePhotos[];
  videos: IProcessVideo[];
  emptyLabel: string;
  onOpenPhoto: (src: string) => void;
  onOpenVideo: (src: string) => void;
}) {
  if (photos.length === 0 && videos.length === 0) {
    return (
      <Text fontSize="0.7rem" color="gray.400">
        {emptyLabel}
      </Text>
    );
  }
  return (
    <Wrap spacing={2}>
      {photos.map((p) => (
        <WrapItem key={`photo-${p.pk}`}>
          <Image
            src={p.file}
            boxSize="160px"
            objectFit="cover"
            borderRadius="md"
            cursor="pointer"
            _hover={{ opacity: 0.85 }}
            onClick={() => onOpenPhoto(p.file)}
          />
        </WrapItem>
      ))}
      {videos.map((v) => (
        <WrapItem key={`video-${v.pk}`}>
          <Box
            boxSize="160px"
            borderRadius="md"
            bg="blackAlpha.700"
            position="relative"
            overflow="hidden"
            cursor="pointer"
            _hover={{ opacity: 0.85 }}
            onClick={() => onOpenVideo(v.VideoFile)}
          >
            {v.ThumbnailFile ? <Image src={v.ThumbnailFile} w="full" h="full" objectFit="cover" /> : null}
            <Center position="absolute" inset={0} bg="blackAlpha.300">
              <Center boxSize="52px" borderRadius="full" bg="whiteAlpha.900">
                <FaFilm color="#1A202C" size={22} />
              </Center>
            </Center>
          </Box>
        </WrapItem>
      ))}
    </Wrap>
  );
}

function RoundPanel({
  colorScheme,
  label,
  original,
  round,
  measurement,
  onOpenPhoto,
  onOpenVideo,
  onRemarkSaved,
  t
}: {
  colorScheme: string;
  label: string;
  original: RoundStats;
  round: RoundStats;
  measurement: ILayoutProcessMeasurement | null;
  onOpenPhoto: (src: string) => void;
  onOpenVideo: (src: string) => void;
  onRemarkSaved: () => void;
  t: (k: string, options?: Record<string, unknown>) => string;
}) {
  const toast = useToast();
  const cardBorder = useColorModeValue("gray.200", "gray.600");
  const [remark, setRemark] = useState(measurement?.remark ?? "");
  const [isSaving, setIsSaving] = useState(false);
  const wasMeasured = round.cycleSec != null || round.mp != null;

  const handleBlur = async () => {
    if (!measurement || remark === (measurement.remark ?? "")) return;
    setIsSaving(true);
    try {
      await patchLayoutProcessMeasurement(measurement.pk, { remark });
      onRemarkSaved();
      toast({ title: t("vlLayouts.measurementsReport.remarkSaved"), status: "success", duration: 1500, position: "bottom-right" });
    } catch {
      toast({ title: t("vlLayouts.measurementsReport.remarkSaveFailed"), status: "error", duration: 2500, position: "bottom-right" });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Box borderWidth="1px" borderColor={cardBorder} borderRadius="lg" p={3}>
      <Badge colorScheme={colorScheme} fontSize="0.65rem" mb={2}>
        {label}
      </Badge>

      {!wasMeasured ? (
        <Text fontSize="0.75rem" color="gray.400" mb={2}>
          {t("vlLayouts.measurementsReport.notMeasuredYet")}
        </Text>
      ) : (
        <Box mb={2}>
          <InsightChips original={original} round={round} t={t} />
        </Box>
      )}

      <MediaThumbs
        photos={measurement?.photos ?? []}
        videos={measurement?.videos ?? []}
        emptyLabel={t("vlLayouts.measurementsReport.noMedia")}
        onOpenPhoto={onOpenPhoto}
        onOpenVideo={onOpenVideo}
      />

      <Divider my={2} />
      <Text fontSize="0.65rem" fontWeight="semibold" color="gray.500" mb={1}>
        {t("vlLayouts.measurementsReport.notesTitle")}
      </Text>
      <Textarea
        size="sm"
        fontSize="xs"
        rows={2}
        isDisabled={!measurement || isSaving}
        placeholder={t("vlLayouts.measurementsReport.remarkPlaceholder")}
        value={remark}
        onChange={(e) => setRemark(e.target.value)}
        onBlur={() => void handleBlur()}
      />
    </Box>
  );
}

function OriginalPanel({ process, onOpenPhoto, onOpenVideo, t }: { process: ILayoutProcess; onOpenPhoto: (src: string) => void; onOpenVideo: (src: string) => void; t: (k: string) => string }) {
  const cardBorder = useColorModeValue("gray.200", "gray.600");
  return (
    <Box borderWidth="1px" borderColor={cardBorder} borderRadius="lg" p={3}>
      <Badge colorScheme={ROUND_COLOR_SCHEME[0]} fontSize="0.65rem" mb={2}>
        {t("vlLayouts.processDetail.original")}
      </Badge>
      <MediaThumbs
        photos={process.photos ?? []}
        videos={process.videos ?? []}
        emptyLabel={t("vlLayouts.measurementsReport.noMedia")}
        onOpenPhoto={onOpenPhoto}
        onOpenVideo={onOpenVideo}
      />
    </Box>
  );
}

export default function VlLayoutMeasurementsReport() {
  const { pk: layoutStyleId } = useParams<{ pk: string }>();
  const stylePk = Number(layoutStyleId);
  const { t } = useTranslation();
  const pageBg = useColorModeValue("gray.50", "gray.900");
  const cardBg = useColorModeValue("white", "gray.800");
  const borderColor = useColorModeValue("gray.200", "gray.600");

  const originalHeaderBg = useColorModeValue("gray.200", "gray.600");
  const round1HeaderBg = useColorModeValue("blue.100", "blue.800");
  const round2HeaderBg = useColorModeValue("purple.100", "purple.800");
  const round3HeaderBg = useColorModeValue("orange.100", "orange.800");
  const groupHeaderBg: Record<0 | 1 | 2 | 3, string> = { 0: originalHeaderBg, 1: round1HeaderBg, 2: round2HeaderBg, 3: round3HeaderBg };

  // Whole-column background tints (not thin borders) mark each round group — a filled area can't render as a
  // "broken line" the way a 1-2px border can when many stacked table rows hit subpixel/zoom rounding.
  const originalCellBg = useColorModeValue("gray.50", "whiteAlpha.100");
  const round1CellBg = useColorModeValue("blue.50", "blue.900");
  const round2CellBg = useColorModeValue("purple.50", "purple.900");
  const round3CellBg = useColorModeValue("orange.50", "orange.900");
  const groupCellBg: Record<0 | 1 | 2 | 3, string> = { 0: originalCellBg, 1: round1CellBg, 2: round2CellBg, 3: round3CellBg };
  const expandedPanelBg = useColorModeValue("gray.50", "gray.900");

  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [selectedVideoUrl, setSelectedVideoUrl] = useState<string | null>(null);
  const [expandedPks, setExpandedPks] = useState<Set<number>>(new Set());

  const { data: detail, isLoading } = useQuery({
    queryKey: ["layoutStyle", stylePk],
    queryFn: () => getLayoutStyleDetail(stylePk),
    enabled: Number.isFinite(stylePk) && stylePk > 0
  });
  const queryClient = useQueryClient();

  const { data: layoutSettings } = useQuery({
    queryKey: ["layoutSettings"],
    queryFn: getLayoutSettings,
    staleTime: 5 * 60_000
  });
  const upmhDivisorSeconds = layoutSettings?.upmh_divisor_seconds ?? 3600;

  const rows = (detail?.layout_modules ?? []).flatMap((mod) =>
    (mod.layout_processes ?? []).map((p) => ({ moduleCode: mod.code, moduleName: mod.name, categoryName: mod.module_category_name, process: p }))
  );

  const roundStatsFor = (p: ILayoutProcess, round: 1 | 2 | 3): RoundStats & { measurement: ILayoutProcessMeasurement | null } => {
    const m: ILayoutProcessMeasurement | undefined = (p.measurements ?? []).find((x) => x.round === round);
    const cycleSec = m ? parseSamSecondsField(m.cycle_time) : null;
    const mp = m?.manpower ?? null;
    const upmh = cycleSec != null && cycleSec > 0 ? upmhDivisorSeconds / cycleSec : null;
    const total = upmh != null && mp != null && mp > 0 ? upmh * mp : null;
    return { cycleSec, mp, upmh, total, measurement: m ?? null };
  };

  const toggleExpanded = (pk: number) => {
    setExpandedPks((prev) => {
      const next = new Set(prev);
      if (next.has(pk)) next.delete(pk);
      else next.add(pk);
      return next;
    });
  };

  const allExpanded = rows.length > 0 && rows.every(({ process }) => expandedPks.has(process.pk));
  const toggleAll = () => {
    if (allExpanded) setExpandedPks(new Set());
    else setExpandedPks(new Set(rows.map(({ process }) => process.pk)));
  };

  const handleRemarkSaved = () => {
    queryClient.invalidateQueries({ queryKey: ["layoutStyle", stylePk] });
  };

  const openProcessWindow = (e: React.MouseEvent, processPk: number) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    const url = `/vl-layouts/${stylePk}/processes/${processPk}`;
    window.open(url, `vl-process-${processPk}`, "noopener,noreferrer,width=1280,height=900,left=80,top=80");
  };

  const groupHeaders = [
    { label: t("vlLayouts.processDetail.original") },
    { label: t("vlLayouts.processDetail.round1") },
    { label: t("vlLayouts.processDetail.round2") },
    { label: t("vlLayouts.processDetail.round3") }
  ] as const;

  return (
    <>
      <Helmet>
        <title>{t("vlLayouts.measurementsReport.pageTitle")}</title>
      </Helmet>
      <Box bg={pageBg} minH="100%" px={{ base: 2, md: 4, lg: 6 }} py={{ base: 6, md: 8 }}>
        <Box maxW="1600px" mx="auto">
          <HStack mb={4} spacing={3} flexWrap="wrap">
            <Button as={RouterLink} to={`/vl-layouts/${stylePk}`} leftIcon={<FaArrowLeft />} variant="ghost" size="sm">
              {t("vlLayouts.detail.back")}
            </Button>
          </HStack>

          <HStack justify="space-between" align="flex-start" flexWrap="wrap" mb={1} gap={2}>
            <Box>
              <Heading size="md" mb={1}>
                {t("vlLayouts.measurementsReport.title")}
              </Heading>
              <Text fontSize="sm" color="gray.500">
                {detail?.sj_style?.code}
                {detail?.sj_style?.style_name ? ` · ${detail.sj_style.style_name}` : ""}
              </Text>
            </Box>
            {rows.length > 0 && (
              <Button size="sm" variant="outline" leftIcon={allExpanded ? <FaCompressAlt /> : <FaExpandAlt />} onClick={toggleAll}>
                {allExpanded ? t("vlLayouts.measurementsReport.collapseAll") : t("vlLayouts.measurementsReport.expandAll")}
              </Button>
            )}
          </HStack>
          <Text fontSize="xs" color="gray.500" mb={4}>
            {t("vlLayouts.measurementsReport.hint")}
          </Text>

          {isLoading && (
            <Center py={16}>
              <Spinner />
            </Center>
          )}

          {!isLoading && (
            <Box bg={cardBg} borderRadius="xl" border="1px solid" borderColor={borderColor} shadow="sm" overflow="hidden">
              <TableContainer>
                <Table size="sm" variant="simple">
                  <Thead>
                    <Tr>
                      <Th rowSpan={2} verticalAlign="bottom" w="32px" />
                      <Th rowSpan={2} verticalAlign="bottom">
                        {t("vlLayouts.detail.col.code")}
                      </Th>
                      <Th rowSpan={2} verticalAlign="bottom">
                        {t("vlLayouts.detail.col.name")}
                      </Th>
                      {groupHeaders.map((g, i) => (
                        <Th key={g.label} colSpan={4} textAlign="center" bg={groupHeaderBg[i as 0 | 1 | 2 | 3]}>
                          <Badge colorScheme={ROUND_COLOR_SCHEME[i as 0 | 1 | 2 | 3]} fontSize="0.65rem">
                            {g.label}
                          </Badge>
                        </Th>
                      ))}
                    </Tr>
                    <Tr>
                      {[0, 1, 2, 3].map((i) => (
                        <Fragment key={i}>
                          <Th isNumeric fontSize="0.65rem" bg={groupHeaderBg[i as 0 | 1 | 2 | 3]}>
                            {t("vlLayouts.detail.col.cycle")}
                          </Th>
                          <Th isNumeric fontSize="0.65rem" bg={groupHeaderBg[i as 0 | 1 | 2 | 3]}>
                            {t("vlLayouts.processDetail.upmh")}
                          </Th>
                          <Th isNumeric fontSize="0.65rem" bg={groupHeaderBg[i as 0 | 1 | 2 | 3]}>
                            {t("vlLayouts.processDetail.manpower")}
                          </Th>
                          <Th isNumeric fontSize="0.65rem" bg={groupHeaderBg[i as 0 | 1 | 2 | 3]}>
                            {t("vlLayouts.processDetail.targetQtyPerHour")}
                          </Th>
                        </Fragment>
                      ))}
                    </Tr>
                  </Thead>
                  <Tbody>
                    {rows.length === 0 && (
                      <Tr>
                        <Td colSpan={19}>
                          <Text color="gray.500" textAlign="center" py={8} fontSize="sm">
                            {t("vlLayouts.measurementsReport.empty")}
                          </Text>
                        </Td>
                      </Tr>
                    )}
                    {rows.map(({ moduleCode, categoryName, process: p }) => {
                      const originalCycleSec = parseSamSecondsField(p.cycle_time) ?? samProcessCycleSecondsFromParts(p);
                      const originalUpmh = p.target_qty_per_hour ?? null;
                      const originalMp = p.manpower ?? null;
                      const originalTotal = p.target_qty_per_hour_total ?? null;
                      const originalStats: RoundStats = { cycleSec: originalCycleSec, mp: originalMp, upmh: originalUpmh, total: originalTotal };
                      const isExpanded = expandedPks.has(p.pk);
                      const roundResults = ([1, 2, 3] as const).map((round) => ({ round, ...roundStatsFor(p, round) }));

                      const saveOriginalCycle = async (v: number | null) => {
                        await patchLayoutProcess(p.pk, { cycle_time: v != null ? formatSamCycleSecondsForApi(v) : null });
                        queryClient.invalidateQueries({ queryKey: ["layoutStyle", stylePk] });
                      };
                      const saveOriginalManpower = async (v: number | null) => {
                        await patchLayoutProcess(p.pk, { manpower: v != null ? Math.round(v) : null });
                        queryClient.invalidateQueries({ queryKey: ["layoutStyle", stylePk] });
                      };
                      const saveRoundCycle = async (round: 1 | 2 | 3, measurement: ILayoutProcessMeasurement | null, v: number | null) => {
                        const cycle_time = v != null ? formatSamCycleSecondsForApi(v) : null;
                        if (measurement) await patchLayoutProcessMeasurement(measurement.pk, { cycle_time });
                        else await createLayoutProcessMeasurement({ layout_process: p.pk, round, cycle_time });
                        queryClient.invalidateQueries({ queryKey: ["layoutStyle", stylePk] });
                      };
                      const saveRoundManpower = async (round: 1 | 2 | 3, measurement: ILayoutProcessMeasurement | null, v: number | null) => {
                        const manpower = v != null ? Math.round(v) : null;
                        if (measurement) await patchLayoutProcessMeasurement(measurement.pk, { manpower });
                        else await createLayoutProcessMeasurement({ layout_process: p.pk, round, manpower });
                        queryClient.invalidateQueries({ queryKey: ["layoutStyle", stylePk] });
                      };
                      return (
                        <Fragment key={p.pk}>
                          <Tr>
                            <Td>
                              <IconButton
                                aria-label="toggle"
                                icon={isExpanded ? <FaChevronDown /> : <FaChevronRight />}
                                size="xs"
                                variant="ghost"
                                onClick={() => toggleExpanded(p.pk)}
                              />
                            </Td>
                            <Td fontSize="xs">
                              <HStack spacing={1.5}>
                                <Badge colorScheme="blue" fontSize="0.6rem">
                                  {moduleCode}
                                </Badge>
                                <Tooltip label={t("vlLayouts.measurementsReport.openProcess")}>
                                  <Link
                                    href={`/vl-layouts/${stylePk}/processes/${p.pk}`}
                                    onClick={(e) => openProcessWindow(e, p.pk)}
                                    fontSize="xs"
                                    fontWeight="semibold"
                                    color="blue.500"
                                  >
                                    <HStack spacing={1}>
                                      <Text as="span">{p.code}</Text>
                                      <FaExternalLinkAlt size={9} />
                                    </HStack>
                                  </Link>
                                </Tooltip>
                              </HStack>
                              <Text fontSize="0.65rem" color="gray.500">
                                {categoryName}
                              </Text>
                            </Td>
                            <Td fontSize="xs" maxW="160px" isTruncated>
                              {p.name || "—"}
                            </Td>
                            <EditableNumberCell
                              value={originalCycleSec}
                              bg={groupCellBg[0]}
                              format={formatSamCycleSecondsDisplay}
                              onSave={saveOriginalCycle}
                            />
                            <Td isNumeric fontSize="xs" bg={groupCellBg[0]}>
                              {originalUpmh != null ? originalUpmh.toFixed(1) : "—"}
                            </Td>
                            <EditableNumberCell
                              value={originalMp}
                              bg={groupCellBg[0]}
                              format={(n) => String(n)}
                              onSave={saveOriginalManpower}
                            />
                            <Td isNumeric fontSize="xs" bg={groupCellBg[0]}>
                              {originalTotal != null ? originalTotal.toFixed(1) : "—"}
                            </Td>
                            {roundResults.map(({ round, measurement, ...rs }) => (
                              <Fragment key={round}>
                                <EditableNumberCell
                                  value={rs.cycleSec}
                                  bg={groupCellBg[round as 1 | 2 | 3]}
                                  format={formatSamCycleSecondsDisplay}
                                  onSave={(v) => saveRoundCycle(round, measurement, v)}
                                />
                                {metricCell(`${round}-upmh`, rs.upmh, originalUpmh, true, (n) => n.toFixed(1), groupCellBg[round as 1 | 2 | 3])}
                                <EditableNumberCell
                                  value={rs.mp}
                                  bg={groupCellBg[round as 1 | 2 | 3]}
                                  format={(n) => String(n)}
                                  onSave={(v) => saveRoundManpower(round, measurement, v)}
                                  extra={rs.mp != null ? pctDiffNode(rs.mp, originalMp, false) : null}
                                />
                                {metricCell(`${round}-total`, rs.total, originalTotal, true, (n) => n.toFixed(1), groupCellBg[round as 1 | 2 | 3])}
                              </Fragment>
                            ))}
                          </Tr>
                          {isExpanded && (
                            <Tr>
                              <Td colSpan={19} p={0} borderBottomWidth="1px" borderColor={borderColor}>
                                <Box p={4} bg={expandedPanelBg}>
                                  <Text fontSize="0.65rem" fontWeight="semibold" color="gray.500" mb={2}>
                                    {t("vlLayouts.measurementsReport.insightTitle")}
                                  </Text>
                                  <SimpleGrid columns={{ base: 1, lg: 2, xl: 4 }} spacing={3}>
                                    <OriginalPanel process={p} onOpenPhoto={setLightboxSrc} onOpenVideo={setSelectedVideoUrl} t={t} />
                                    {roundResults.map(({ round, measurement, ...rs }) => (
                                      <RoundPanel
                                        key={round}
                                        colorScheme={ROUND_COLOR_SCHEME[round as 1 | 2 | 3]}
                                        label={t(`vlLayouts.processDetail.round${round}`)}
                                        original={originalStats}
                                        round={rs}
                                        measurement={measurement}
                                        onOpenPhoto={setLightboxSrc}
                                        onOpenVideo={setSelectedVideoUrl}
                                        onRemarkSaved={handleRemarkSaved}
                                        t={t}
                                      />
                                    ))}
                                  </SimpleGrid>
                                </Box>
                              </Td>
                            </Tr>
                          )}
                        </Fragment>
                      );
                    })}
                  </Tbody>
                </Table>
              </TableContainer>
            </Box>
          )}

          <Divider my={8} />
          <Text fontSize="xs" color="gray.500">
            {t("vlLayouts.detail.footerNote")}
          </Text>
        </Box>
      </Box>

      <Modal isOpen={!!lightboxSrc} onClose={() => setLightboxSrc(null)} size="xl" isCentered>
        <ModalOverlay />
        <ModalContent bg="transparent" boxShadow="none">
          <ModalCloseButton color="white" />
          <ModalBody p={0}>{lightboxSrc && <Image src={lightboxSrc} alt="" w="100%" maxH="80vh" objectFit="contain" borderRadius="lg" />}</ModalBody>
        </ModalContent>
      </Modal>

      <Modal isOpen={!!selectedVideoUrl} onClose={() => setSelectedVideoUrl(null)} size="4xl" isCentered>
        <ModalOverlay />
        <ModalContent bg="black">
          <ModalCloseButton color="white" />
          <ModalBody p={0}>{selectedVideoUrl && <Box as="iframe" src={selectedVideoUrl} w="100%" h="480px" border="none" title="video" />}</ModalBody>
        </ModalContent>
      </Modal>
    </>
  );
}
