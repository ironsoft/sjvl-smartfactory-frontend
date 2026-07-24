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
  Spinner,
  Center,
  Text,
  Button,
  HStack,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalCloseButton,
  useDisclosure,
  Input,
  useToast,
  IconButton,
  Image,
  Skeleton,
  Link,
  AlertDialog,
  AlertDialogOverlay,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogBody,
  AlertDialogFooter,
  List,
  ListItem,
  InputGroup,
  InputRightElement,
  Tag,
  Tooltip
} from "@chakra-ui/react";
import { useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { Helmet } from "react-helmet";
import { Link as RouterLink, useNavigate } from "react-router-dom";
import { useState, useRef, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { FaCog, FaPlus, FaTrash, FaFileExcel } from "react-icons/fa";
import SearchInput from "../components/SearchInput";
import { openAppPopupWindow } from "../lib/openAppPopupWindow";
import {
  getLayoutStyles,
  getLayoutStyleDetail,
  createLayoutStyle,
  deleteLayoutStyle,
  getSjStyles,
  getSjStylePhotos,
  getLayoutSettings,
  patchLayoutSettings,
  type ILayoutStyleListItem,
  type ILayoutStyleDetail,
  type ISjStyle,
  type ISjStyleListResponse,
  type IFilePhotos
} from "../api";
import {
  analyzeLayoutProcesses,
  formatAnalysisMetricNumber,
  formatCycleSumForDisplay,
  latestRoundLayoutAnalysis
} from "../lib/samStyleModulesHelpers";
import { layoutMeasurementPctDiff } from "../components/LayoutMeasurementEditableCell";

function formatApiErr(e: unknown, t?: (key: string, opt?: { status: number }) => string): string {
  if (axios.isAxiosError(e) && e.response?.data != null) {
    const raw = e.response.data;
    if (typeof raw === "string" && (raw.includes("<!DOCTYPE") || raw.includes("<html"))) {
      return t ? t("vlLayouts.list.errorHtml", { status: e.response.status }) : `Server error (HTML, ${e.response.status}).`;
    }
    if (typeof raw === "object" && raw !== null && !Array.isArray(raw)) {
      const o = raw as Record<string, unknown>;
      if (typeof o.detail === "string") {
        let msg = o.detail;
        if (typeof o.type === "string") msg += ` [${o.type}]`;
        if (typeof o.traceback === "string" && o.traceback.length > 0) {
          msg += "\n\n" + o.traceback.slice(0, 2000);
        }
        return msg;
      }
      if (o.detail != null) return JSON.stringify(o.detail);
    }
    const d = raw as { detail?: unknown };
    if (typeof d.detail === "string") return d.detail;
    return typeof raw === "string" ? raw : JSON.stringify(raw);
  }
  return e instanceof Error ? e.message : "Error";
}

/** SJ Style representative photo — links the Layout list row to the Layout detail page */
function LayoutStylePhotoCell({
  layoutStylePk,
  sjStylePk,
  thumbnailUrl,
  primaryPhotoPk
}: {
  layoutStylePk: number;
  sjStylePk: number;
  thumbnailUrl?: string | null;
  primaryPhotoPk?: number | null;
}) {
  const { data: photos, isLoading } = useQuery<IFilePhotos[]>({
    queryKey: ["sjStylePhotos", sjStylePk],
    queryFn: () => getSjStylePhotos(sjStylePk),
    enabled: !!sjStylePk && !thumbnailUrl
  });

  const src = useMemo(() => {
    if (thumbnailUrl) return thumbnailUrl;
    if (!photos?.length) return null;
    if (primaryPhotoPk != null) {
      const hit = photos.find((p) => Number(p.pk) === Number(primaryPhotoPk));
      if (hit) return hit.file;
    }
    return photos[0].file;
  }, [thumbnailUrl, photos, primaryPhotoPk]);

  return (
    <Box boxSize="44px" flexShrink={0}>
      {isLoading && !thumbnailUrl ? (
        <Skeleton boxSize="44px" borderRadius="md" />
      ) : src ? (
        <Link as={RouterLink} to={`/vl-layouts/${layoutStylePk}`}>
          <Image
            src={src}
            alt=""
            boxSize="44px"
            objectFit="cover"
            borderRadius="md"
            _hover={{ opacity: 0.8, transform: "scale(1.05)", transition: "all 0.2s" }}
          />
        </Link>
      ) : (
        <Text fontSize="xs" color="gray.400">
          —
        </Text>
      )}
    </Box>
  );
}

const ROUND_COLOR_SCHEME = { 1: "blue", 2: "purple", 3: "orange" } as const;

/** 목록 KPI 셀에서 원본 값 아래에 "가장 최근 VL 측정 회차" 값 + %변화를 작게 붙여준다.
 * 아직 그 스타일에 대한 VL 측정이 하나도 없으면 렌더링하지 않는다. */
function renderLatestRoundBadge(
  round: 1 | 2 | 3 | null,
  originalValue: number | null,
  latestValue: number | null,
  format: (n: number) => string,
  higherIsBetter: boolean
) {
  if (round == null || latestValue == null) return null;
  return (
    <HStack spacing={1} justify="flex-end" mt={0.5}>
      <Tag size="sm" colorScheme={ROUND_COLOR_SCHEME[round]} fontSize="0.6rem" px={1.5} py={0} minH="auto" lineHeight="1.5" borderRadius="sm">
        VL{round}
      </Tag>
      <Text fontSize="0.7rem" color="gray.500" whiteSpace="nowrap">
        {format(latestValue)}
        {originalValue != null && layoutMeasurementPctDiff(latestValue, originalValue, higherIsBetter)}
      </Text>
    </HStack>
  );
}

export default function VlLayouts() {
  const { t } = useTranslation();
  const pageBg = useColorModeValue("gray.50", "gray.900");
  const cardBg = useColorModeValue("white", "gray.800");
  const toast = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { isOpen, onOpen, onClose } = useDisclosure();
  const { isOpen: isSettingsOpen, onOpen: onSettingsOpen, onClose: onSettingsClose } = useDisclosure();
  const [upmhDivisorInput, setUpmhDivisorInput] = useState("");
  const [savingSettings, setSavingSettings] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [styleSearch, setStyleSearch] = useState("");
  const [styleResults, setStyleResults] = useState<ISjStyle[]>([]);
  const [styleSearching, setStyleSearching] = useState(false);
  const [selectedStyle, setSelectedStyle] = useState<ISjStyle | null>(null);
  const [creating, setCreating] = useState(false);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const [deleteTarget, setDeleteTarget] = useState<ILayoutStyleListItem | null>(null);

  const {
    data: items = [],
    isLoading,
    isError,
    error: listError
  } = useQuery({
    queryKey: ["layoutStyles", searchQuery],
    queryFn: () => getLayoutStyles({ search: searchQuery || undefined })
  });

  const { data: layoutSettings } = useQuery({
    queryKey: ["layoutSettings"],
    queryFn: getLayoutSettings
  });
  const upmhDivisorSeconds = layoutSettings?.upmh_divisor_seconds ?? 3600;

  const detailQueries = useQueries({
    queries: items.map((item) => ({
      queryKey: ["layoutStyle", item.pk] as const,
      queryFn: () => getLayoutStyleDetail(item.pk),
      staleTime: 60_000
    }))
  });

  const kpiByPk = useMemo(() => {
    const map = new Map<
      number,
      {
        moduleCount: number;
        processCount: number;
        cycleSum: number | null;
        upmhMin: number | null;
        manpowerSum: number | null;
        targetMin: number | null;
        bottleneckLabel: string | null;
        isLoading: boolean;
        /** 데이터가 있는 가장 마지막 VL 측정 회차 — 있으면 원본 옆에 회차 배지 + %변화로 보여준다 */
        latestRound: 1 | 2 | 3 | null;
        latestCycleSum: number | null;
        latestUpmhMin: number | null;
        latestTargetMin: number | null;
      }
    >();
    items.forEach((item, i) => {
      const q = detailQueries[i];
      const detail = q?.data as ILayoutStyleDetail | undefined;
      if (!detail) {
        map.set(item.pk, {
          moduleCount: 0,
          processCount: 0,
          cycleSum: null,
          upmhMin: null,
          manpowerSum: null,
          targetMin: null,
          bottleneckLabel: null,
          isLoading: !!q?.isLoading || !!q?.isFetching,
          latestRound: null,
          latestCycleSum: null,
          latestUpmhMin: null,
          latestTargetMin: null
        });
        return;
      }
      const procs = detail.layout_modules.flatMap((m) => m.layout_processes ?? []);
      const analysis = analyzeLayoutProcesses(procs, upmhDivisorSeconds);
      const latest = latestRoundLayoutAnalysis(procs, upmhDivisorSeconds);
      map.set(item.pk, {
        moduleCount: detail.layout_modules.length,
        processCount: analysis.processCount,
        cycleSum: analysis.cycleSum,
        upmhMin: analysis.upmhMin,
        manpowerSum: analysis.manpowerSum,
        targetMin: analysis.targetMin,
        bottleneckLabel: analysis.bottleneck
          ? `[${analysis.bottleneck.code}] ${analysis.bottleneck.name || "—"}`
          : null,
        isLoading: false,
        latestRound: latest?.round ?? null,
        latestCycleSum: latest?.analysis.cycleSum ?? null,
        latestUpmhMin: latest?.analysis.upmhMin ?? null,
        latestTargetMin: latest?.analysis.targetMin ?? null
      });
    });
    return map;
  }, [items, detailQueries, upmhDivisorSeconds]);

  const openSettings = () => {
    setUpmhDivisorInput(String(layoutSettings?.upmh_divisor_seconds ?? 3600));
    onSettingsOpen();
  };

  const handleSaveSettings = async () => {
    const n = Number(upmhDivisorInput);
    if (!Number.isFinite(n) || n <= 0) {
      toast({ title: t("vlLayouts.list.settingsInvalid"), status: "warning", duration: 2000, position: "bottom-right" });
      return;
    }
    setSavingSettings(true);
    try {
      await patchLayoutSettings({ upmh_divisor_seconds: Math.round(n) });
      queryClient.invalidateQueries({ queryKey: ["layoutSettings"] });
      toast({ title: t("vlLayouts.list.settingsSaved"), status: "success", duration: 2000, position: "bottom-right" });
      onSettingsClose();
    } catch (e: unknown) {
      toast({ title: formatApiErr(e, t), status: "error", duration: 8000, position: "bottom-right" });
    } finally {
      setSavingSettings(false);
    }
  };

  const { data: allLayoutsForFilter } = useQuery({
    queryKey: ["layoutStyles"],
    queryFn: () => getLayoutStyles(),
    enabled: isOpen
  });

  /** SJ Style PKs that already have a Layout document — excluded from the picker */
  const occupiedSjStyleIds = useMemo(() => new Set(allLayoutsForFilter?.map((x) => x.sj_style.pk) ?? []), [allLayoutsForFilter]);

  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleStyleSearch = (q: string) => {
    setStyleSearch(q);
    setSelectedStyle(null);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!q.trim()) {
      setStyleResults([]);
      return;
    }
    searchTimer.current = setTimeout(async () => {
      setStyleSearching(true);
      try {
        const res = await getSjStyles({ search: q, page: 1 });
        const list: ISjStyle[] = Array.isArray(res) ? res : ((res as ISjStyleListResponse).results ?? []);
        setStyleResults(list.filter((st: ISjStyle) => !occupiedSjStyleIds.has(st.pk)));
      } finally {
        setStyleSearching(false);
      }
    }, 300);
  };

  const openCreate = () => {
    setStyleSearch("");
    setStyleResults([]);
    setSelectedStyle(null);
    queryClient.prefetchQuery({ queryKey: ["layoutStyles"], queryFn: () => getLayoutStyles() });
    onOpen();
  };

  const handleCreate = async () => {
    if (!selectedStyle) {
      toast({ title: t("vlLayouts.list.selectStyle"), status: "warning", duration: 2000, position: "bottom-right" });
      return;
    }
    setCreating(true);
    try {
      const created = await createLayoutStyle({ sj_style: selectedStyle.pk });
      toast({ title: t("vlLayouts.list.created"), status: "success", duration: 2000, position: "bottom-right" });
      queryClient.invalidateQueries({ queryKey: ["layoutStyles"] });
      onClose();
      navigate(`/vl-layouts/${created.pk}`);
    } catch (e: unknown) {
      toast({ title: formatApiErr(e, t), status: "error", duration: 8000, position: "bottom-right" });
    } finally {
      setCreating(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteLayoutStyle(deleteTarget.pk);
      toast({ title: t("vlLayouts.list.deleted"), status: "success", duration: 2000, position: "bottom-right" });
      queryClient.invalidateQueries({ queryKey: ["layoutStyles"] });
    } catch {
      toast({ title: formatApiErr(null, t), status: "error", duration: 2000, position: "bottom-right" });
    } finally {
      setDeleteTarget(null);
    }
  };

  return (
    <>
      <Helmet>
        <title>{t("vlLayouts.list.pageTitle")}</title>
      </Helmet>
      <Box bg={pageBg} minH="100%" px={{ base: 4, md: 8, lg: 12 }} py={{ base: 6, md: 8 }}>
        <Box w="full" maxW="1600px" mx="auto">
          <HStack justify="space-between" mb={6}>
            <Heading size="md">{t("vlLayouts.list.pageTitle")}</Heading>
            <HStack spacing={2}>
              <Button size="sm" variant="outline" onClick={() => openAppPopupWindow("/vl-layouts/tools")}>
                {t("vlLayouts.list.manageTools")}
              </Button>
              <IconButton aria-label={t("vlLayouts.list.settingsTitle")} icon={<FaCog />} size="sm" variant="outline" onClick={openSettings} />
              <Button leftIcon={<FaPlus />} colorScheme="blue" size="sm" onClick={openCreate}>
                {t("vlLayouts.list.newSam")}
              </Button>
            </HStack>
          </HStack>

          <Text fontSize="sm" color="gray.500" mb={4}>
            {t("vlLayouts.list.intro")}
          </Text>

          {isError && (
            <Text fontSize="sm" color="red.500" mb={4} whiteSpace="pre-wrap">
              {formatApiErr(listError, t)}
            </Text>
          )}

          <HStack mb={4}>
            <SearchInput
              onSearch={(q) => setSearchQuery(q)}
              onInputChange={(v) => {
                if (v === "") setSearchQuery("");
              }}
            />
          </HStack>

          <Box bg={cardBg} borderRadius="md" boxShadow="sm" overflow="hidden">
            <TableContainer overflowX="auto">
              <Table size="sm" minW="1100px">
                <Thead>
                  <Tr>
                    <Th w="56px">{t("vlLayouts.list.col.photo")}</Th>
                    <Th minW="90px">{t("vlLayouts.list.col.styleCode")}</Th>
                    <Th minW="100px">{t("vlLayouts.list.col.styleName")}</Th>
                    <Th isNumeric whiteSpace="nowrap">{t("vlLayouts.list.col.modules")}</Th>
                    <Th isNumeric whiteSpace="nowrap">{t("vlLayouts.list.col.processes")}</Th>
                    <Th isNumeric whiteSpace="nowrap">{t("vlLayouts.detail.analysisCycleTotal")}</Th>
                    <Th isNumeric whiteSpace="nowrap">{t("vlLayouts.detail.analysisUpmhMin")}</Th>
                    <Th isNumeric whiteSpace="nowrap">{t("vlLayouts.detail.analysisManpowerTotal")}</Th>
                    <Th isNumeric whiteSpace="nowrap">{t("vlLayouts.detail.analysisTargetMin")}</Th>
                    <Th minW="140px">{t("vlLayouts.detail.analysisBottleneck")}</Th>
                    <Th minW="100px">{t("vlLayouts.list.col.remark")}</Th>
                    <Th w="100px" />
                  </Tr>
                </Thead>
                <Tbody>
                  {isLoading && (
                    <Tr>
                      <Td colSpan={12}>
                        <Center py={8}>
                          <Spinner />
                        </Center>
                      </Td>
                    </Tr>
                  )}
                  {!isLoading && items.length === 0 && (
                    <Tr>
                      <Td colSpan={12}>
                        <Text color="gray.500" textAlign="center" py={8}>
                          {t("vlLayouts.list.empty")}
                        </Text>
                      </Td>
                    </Tr>
                  )}
                  {items.map((row) => {
                    const kpi = kpiByPk.get(row.pk);
                    return (
                      <Tr key={row.pk}>
                        <Td verticalAlign="middle">
                          <LayoutStylePhotoCell
                            layoutStylePk={row.pk}
                            sjStylePk={row.sj_style.pk}
                            thumbnailUrl={row.sj_style.thumbnail}
                            primaryPhotoPk={row.sj_style.primary_photo}
                          />
                        </Td>
                        <Td fontWeight="semibold">
                          <HStack spacing={1.5}>
                            <RouterLink to={`/vl-layouts/${row.pk}`}>{row.sj_style.code}</RouterLink>
                            {row.layout_file_url && (
                              <Tooltip label={row.layout_file_name || t("vlLayouts.list.hasLayoutFile")} hasArrow>
                                <Link href={row.layout_file_url} isExternal onClick={(e) => e.stopPropagation()} color="green.600" display="inline-flex">
                                  <FaFileExcel size={13} />
                                </Link>
                              </Tooltip>
                            )}
                          </HStack>
                        </Td>
                        <Td>
                          <Text noOfLines={1}>{row.sj_style.style_name ?? "—"}</Text>
                        </Td>
                        {kpi?.isLoading ? (
                          <>
                            {[0, 1, 2, 3, 4, 5, 6].map((k) => (
                              <Td key={k} isNumeric>
                                <Skeleton h="14px" w="36px" ml="auto" borderRadius="sm" />
                              </Td>
                            ))}
                          </>
                        ) : (
                          <>
                            <Td isNumeric fontSize="sm" fontWeight="semibold">
                              {kpi?.moduleCount ?? 0}
                            </Td>
                            <Td isNumeric fontSize="sm" fontWeight="semibold">
                              {kpi?.processCount ?? 0}
                            </Td>
                            <Td isNumeric fontSize="sm" whiteSpace="nowrap">
                              {kpi?.cycleSum != null ? `${formatCycleSumForDisplay(kpi.cycleSum)} s` : "—"}
                              {renderLatestRoundBadge(
                                kpi?.latestRound ?? null,
                                kpi?.cycleSum ?? null,
                                kpi?.latestCycleSum ?? null,
                                (n) => `${formatCycleSumForDisplay(n)} s`,
                                false
                              )}
                            </Td>
                            <Td isNumeric fontSize="sm">
                              {formatAnalysisMetricNumber(kpi?.upmhMin ?? null)}
                              {renderLatestRoundBadge(
                                kpi?.latestRound ?? null,
                                kpi?.upmhMin ?? null,
                                kpi?.latestUpmhMin ?? null,
                                (n) => formatAnalysisMetricNumber(n),
                                true
                              )}
                            </Td>
                            <Td isNumeric fontSize="sm">
                              {formatAnalysisMetricNumber(kpi?.manpowerSum ?? null, 2)}
                            </Td>
                            <Td isNumeric fontSize="sm">
                              {formatAnalysisMetricNumber(kpi?.targetMin ?? null)}
                              {renderLatestRoundBadge(
                                kpi?.latestRound ?? null,
                                kpi?.targetMin ?? null,
                                kpi?.latestTargetMin ?? null,
                                (n) => formatAnalysisMetricNumber(n),
                                true
                              )}
                            </Td>
                            <Td fontSize="xs" color="orange.600" maxW="180px">
                              <Text noOfLines={1} title={kpi?.bottleneckLabel ?? undefined}>
                                {kpi?.bottleneckLabel || "—"}
                              </Text>
                            </Td>
                          </>
                        )}
                        <Td>
                          <Text noOfLines={2} fontSize="sm" color="gray.600">
                            {row.remark || "—"}
                          </Text>
                        </Td>
                        <Td>
                          <HStack spacing={1}>
                            <Button as={RouterLink} to={`/vl-layouts/${row.pk}`} size="xs" variant="outline">
                              {t("vlLayouts.list.open")}
                            </Button>
                            <IconButton
                              aria-label="delete"
                              icon={<FaTrash />}
                              size="xs"
                              variant="ghost"
                              colorScheme="red"
                              onClick={() => setDeleteTarget(row)}
                            />
                          </HStack>
                        </Td>
                      </Tr>
                    );
                  })}
                </Tbody>
              </Table>
            </TableContainer>
          </Box>
        </Box>
      </Box>

      <Modal isOpen={isOpen} onClose={onClose} size="lg">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>{t("vlLayouts.list.newSam")}</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Text fontSize="sm" mb={2}>
              {t("vlLayouts.list.pickSjStyle")}
            </Text>
            <Box position="relative">
              <InputGroup>
                <Input
                  placeholder={t("vlLayouts.list.styleSearchPlaceholder")}
                  value={styleSearch}
                  onChange={(e) => handleStyleSearch(e.target.value)}
                />
                {styleSearching && (
                  <InputRightElement>
                    <Spinner size="sm" />
                  </InputRightElement>
                )}
              </InputGroup>
              {styleResults.length > 0 && (
                <List
                  position="absolute"
                  zIndex={10}
                  top="100%"
                  left={0}
                  right={0}
                  mt={1}
                  bg={cardBg}
                  borderWidth="1px"
                  borderRadius="md"
                  maxH="200px"
                  overflowY="auto"
                  boxShadow="md"
                >
                  {styleResults.map((st) => (
                    <ListItem
                      key={st.pk}
                      px={3}
                      py={2}
                      cursor="pointer"
                      _hover={{ bg: "blue.50" }}
                      onClick={() => {
                        setSelectedStyle(st);
                        setStyleSearch(st.code);
                        setStyleResults([]);
                      }}
                    >
                      <Text fontWeight="bold">{st.code}</Text>
                      <Text fontSize="xs" color="gray.600">
                        {st.style_name ?? ""}
                      </Text>
                    </ListItem>
                  ))}
                </List>
              )}
            </Box>
            {selectedStyle && (
              <Text mt={3} fontSize="sm" color="green.600">
                ✓ {selectedStyle.code} — {selectedStyle.style_name ?? ""}
              </Text>
            )}
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={onClose}>
              {t("vlLayouts.common.cancel")}
            </Button>
            <Button colorScheme="blue" isLoading={creating} onClick={handleCreate}>
              {t("vlLayouts.list.create")}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <AlertDialog isOpen={!!deleteTarget} leastDestructiveRef={cancelRef} onClose={() => setDeleteTarget(null)}>
        <AlertDialogOverlay />
        <AlertDialogContent>
          <AlertDialogHeader>{t("vlLayouts.list.deleteTitle")}</AlertDialogHeader>
          <AlertDialogBody>{t("vlLayouts.list.deleteBody")}</AlertDialogBody>
          <AlertDialogFooter>
            <Button ref={cancelRef} onClick={() => setDeleteTarget(null)}>
              {t("vlLayouts.common.cancel")}
            </Button>
            <Button colorScheme="red" onClick={confirmDelete} ml={3}>
              {t("vlLayouts.list.deleteConfirm")}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Modal isOpen={isSettingsOpen} onClose={onSettingsClose} size="sm">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>{t("vlLayouts.list.settingsTitle")}</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Text fontSize="sm" color="gray.500" mb={3}>
              {t("vlLayouts.list.settingsUpmhHint")}
            </Text>
            <Text fontSize="xs" fontWeight="semibold" mb={1}>
              {t("vlLayouts.processDetail.upmh")}
            </Text>
            <Input type="number" min={1} value={upmhDivisorInput} onChange={(e) => setUpmhDivisorInput(e.target.value)} />
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={onSettingsClose}>
              {t("vlLayouts.common.cancel")}
            </Button>
            <Button colorScheme="blue" isLoading={savingSettings} onClick={handleSaveSettings}>
              {t("vlLayouts.detail.saveMeta")}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
}
