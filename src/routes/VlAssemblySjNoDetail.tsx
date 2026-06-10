import {
  Badge,
  Box,
  Button,
  Center,
  Divider,
  HStack,
  Heading,
  Input,
  Link,
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
  useColorModeValue,
  useDisclosure,
  useToast,
  AlertDialog,
  AlertDialogBody,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogContent,
  AlertDialogOverlay,
} from "@chakra-ui/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Helmet } from "react-helmet";
import { useParams, useNavigate, Link as RouterLink, useSearchParams } from "react-router-dom";
import { FaArrowLeft, FaClipboardList, FaExternalLinkAlt, FaSync, FaTrash } from "react-icons/fa";
import {
  getVlAssemblySjNoDetail, patchVlAssemblySjNo, deleteVlAssemblySjNo, syncVlAssemblySjNoFromSource,
  IVlAssemblySjNoDetail, getVlAssemblyScheduleDetail, IVlAssemblySchedule,
} from "../api";
import React, { useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import EpInspectionEntryQr from "../components/VlAssemblyInspectionEntryQr";
import PhotoModal from "../components/PhotoModal";
import VlAssemblyScheduleProductionDailyOutputQr from "../components/VlAssemblyScheduleProductionDailyOutputQr";
import { VlAssemblyBadge, VlAssemblyOriginalReferenceBadges } from "../components/VlAssemblyBadge";
import { StatusBadge } from "../components/StatusBadge";
import { broadcastVlAssemblyScheduleListCacheBust } from "../lib/vlAssemblyProductionScheduleListCacheBust";
import {
  bottleneckThroughputFromProcesses,
  parseCycleTimeSeconds,
  formatCycleTimeForApi,
  targetQtyPerHourFromCycleSeconds,
  dailyTargetQty8hFromTargetPerHour,
} from "../lib/vlAssemblyThroughput";

function InfoRow({
  label, labelColor, children, fieldName, overrideFields, onReset,
}: {
  label: string; labelColor: string; children: React.ReactNode;
  fieldName?: string; overrideFields?: string[]; onReset?: (field: string) => void;
}) {
  const isOverridden = fieldName && overrideFields?.includes(fieldName);
  return (
    <Box>
      <HStack spacing={1} mb={0.5}>
        <Text fontSize="xs" color={labelColor} fontWeight="semibold">{label}</Text>
        {isOverridden && (
          <Tooltip label="Overridden from original. Click to reset." placement="top">
            <Badge
              colorScheme="orange" fontSize="9px" px={1} cursor="pointer"
              onClick={() => fieldName && onReset?.(fieldName)}
            >
              custom
            </Badge>
          </Tooltip>
        )}
      </HStack>
      {children}
    </Box>
  );
}

export default function VlAssemblySjNoDetail() {
  const { sjNoId } = useParams<{ sjNoId: string }>();
  const pk = Number(sjNoId);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isPopupWindow = searchParams.get("popup") === "1";
  const queryClient = useQueryClient();
  const toast = useToast();
  const { t } = useTranslation();
  const { isOpen: isDeleteOpen, onOpen: onDeleteOpen, onClose: onDeleteClose } = useDisclosure();
  const { isOpen: isSyncOpen, onOpen: onSyncOpen, onClose: onSyncClose } = useDisclosure();
  const cancelRef = useRef<HTMLButtonElement>(null);
  const syncCancelRef = useRef<HTMLButtonElement>(null);
  const pendingSyncRef = useRef<"full" | string[] | null>(null);

  const cardBg = useColorModeValue("white", "gray.800");
  const pageBg = useColorModeValue("gray.50", "gray.900");
  const borderColor = useColorModeValue("gray.200", "gray.600");
  const labelColor = useColorModeValue("gray.500", "gray.400");
  const tableBg = useColorModeValue("gray.50", "gray.800");

  const [editingSjNo, setEditingSjNo] = useState<{ val: string } | null>(null);
  const [editingCycleTime, setEditingCycleTime] = useState<string | null>(null);
  const [editingTargetHr, setEditingTargetHr] = useState<string | null>(null);
  const [photoModalUrl, setPhotoModalUrl] = useState<string | undefined>();
  const [syncing, setSyncing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const { data, isLoading } = useQuery<IVlAssemblySjNoDetail>({
    queryKey: ["epSjNoDetail", pk],
    queryFn: () => getVlAssemblySjNoDetail(pk),
    enabled: !!pk,
  });

  const sjThroughputRollup = useMemo(() => {
    if (!data?.ep_modules?.length) return null;
    const procs = data.ep_modules.flatMap((m) => m.ep_processes ?? []);
    return bottleneckThroughputFromProcesses(procs);
  }, [data]);

  const { data: scheduleData } = useQuery<IVlAssemblySchedule>({
    queryKey: ["epSchedule", data?.ep_schedule_pk],
    queryFn: () => getVlAssemblyScheduleDetail(data!.ep_schedule_pk),
    enabled: !!data?.ep_schedule_pk,
  });

  const styleThumbnail = scheduleData?.sj_order_info?.sj_style?.thumbnail ?? null;
  const styleName = scheduleData?.sj_order_info?.sj_style?.style_name ?? scheduleData?.sj_order_info?.style_name ?? null;

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["epSjNoDetail", pk] });
    queryClient.invalidateQueries({ queryKey: ["vlSchedules"] });
    queryClient.invalidateQueries({ queryKey: ["epModuleDetail"] });
    queryClient.invalidateQueries({ queryKey: ["epProcessDetail"] });
    broadcastVlAssemblyScheduleListCacheBust();
  };

  const saveSjNo = async (val: string) => {
    try {
      await patchVlAssemblySjNo(pk, { sj_no: val } as any);
      invalidate();
    } catch {
      toast({ title: t("vlAssembly.common.failedSave"), status: "error", duration: 2000, position: "bottom-right" });
    }
    setEditingSjNo(null);
  };

  const saveThroughputFromCycle = async (raw: string) => {
    const secs = parseCycleTimeSeconds(raw);
    if (!secs) {
      toast({ title: t("vlAssembly.processDetail.invalidCycleTime"), status: "warning", duration: 2500, position: "bottom-right" });
      setEditingCycleTime(null);
      return;
    }
    const tph = targetQtyPerHourFromCycleSeconds(secs);
    const daily = dailyTargetQty8hFromTargetPerHour(tph);
    try {
      await patchVlAssemblySjNo(pk, { cycle_time: formatCycleTimeForApi(secs), target_qty_per_hour: tph, daily_target_qty_8h: daily } as any);
      invalidate();
    } catch {
      toast({ title: t("vlAssembly.common.failedSave"), status: "error", duration: 2000, position: "bottom-right" });
    }
    setEditingCycleTime(null);
  };

  const saveThroughputFromTargetHr = async (raw: string) => {
    const n = Number.parseFloat(raw.trim().replace(",", "."));
    if (!Number.isFinite(n) || n <= 0) {
      toast({ title: t("vlAssembly.processDetail.invalidTargetPerHour"), status: "warning", duration: 2500, position: "bottom-right" });
      setEditingTargetHr(null);
      return;
    }
    const secs = 3600 / n;
    const daily = dailyTargetQty8hFromTargetPerHour(n);
    try {
      await patchVlAssemblySjNo(pk, { cycle_time: formatCycleTimeForApi(secs), target_qty_per_hour: Math.round(n), daily_target_qty_8h: daily } as any);
      invalidate();
    } catch {
      toast({ title: t("vlAssembly.common.failedSave"), status: "error", duration: 2000, position: "bottom-right" });
    }
    setEditingTargetHr(null);
  };

  const openSyncConfirm = (mode: "full" | string[]) => {
    pendingSyncRef.current = mode;
    onSyncOpen();
  };

  const handleSync = async (resetFields?: string[]) => {
    setSyncing(true);
    try {
      const res = await syncVlAssemblySjNoFromSource(pk, resetFields);
      invalidate();
      const parts: string[] = [];
      if (res.updated_fields.length) {
        parts.push(t("vlAssembly.common.syncFields", { fields: res.updated_fields.join(", ") }));
      }
      if (res.modules_sync?.length) {
        parts.push(t("vlAssembly.common.syncSjNoCascadeNote"));
      }
      toast({
        title: t("vlAssembly.common.syncDone"),
        description: parts.length ? parts.join(" ") : t("vlAssembly.common.syncNoChanges"),
        status: "success", duration: 4000, position: "bottom-right",
      });
    } catch {
      toast({ title: t("vlAssembly.common.syncFailed"), status: "error", duration: 2000, position: "bottom-right" });
    }
    setSyncing(false);
  };

  const confirmSync = async () => {
    const mode = pendingSyncRef.current;
    onSyncClose();
    pendingSyncRef.current = null;
    if (mode == null) return;
    await handleSync(mode === "full" ? undefined : mode);
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteVlAssemblySjNo(pk);
      toast({ title: t("vlAssembly.common.deleted"), status: "success", duration: 2000, position: "bottom-right" });
      navigate(-1);
    } catch {
      toast({ title: t("vlAssembly.common.failedDelete"), status: "error", duration: 2000, position: "bottom-right" });
    }
    setDeleting(false);
    onDeleteClose();
  };

  if (isLoading) return <Center minH="60vh"><Spinner size="xl" /></Center>;
  if (!data) return <Center minH="60vh"><Text color="gray.400">{t("vlAssembly.sjNoDetail.notFound")}</Text></Center>;

  const overrideFields = data.override_fields ?? [];
  const sjCycleTrimmed = data.cycle_time?.trim() || "";
  const sjCycleDisplay =
    sjCycleTrimmed ||
    sjThroughputRollup?.cycleTimeDisplay ||
    null;
  const sjTph =
    data.target_qty_per_hour ?? sjThroughputRollup?.targetPerHour ?? null;
  const sjDaily =
    data.daily_target_qty_8h ?? sjThroughputRollup?.dailyTarget ?? null;

  return (
    <>
      <Helmet><title>{`${data.sj_no} — ${t("vlAssembly.sjNoDetail.pageTitle")}`}</title></Helmet>
      <Box bg={pageBg} minH="100vh" px={{ base: 4, md: 8, lg: 12 }} py={{ base: 6, md: 8 }}>
        <Box maxW="5xl" mx="auto">
          <HStack mb={4} justify={isPopupWindow ? "flex-end" : "space-between"} w="full">
            {!isPopupWindow && (
              <Button leftIcon={<FaArrowLeft />} variant="ghost" size="sm" onClick={() => navigate(-1)}>{t("vlAssembly.common.back")}</Button>
            )}
            <HStack spacing={2}>
              {data.source_sj_no_info && (
                <Button leftIcon={<FaSync />} size="sm" variant="outline" colorScheme="teal"
                  isLoading={syncing} onClick={() => openSyncConfirm("full")}>
                  {t("vlAssembly.common.syncFromSource")}
                </Button>
              )}
              {!data.is_deleted && (
                <Button leftIcon={<FaTrash />} size="sm" colorScheme="red" variant="outline" onClick={onDeleteOpen}>
                  {t("vlAssembly.common.delete")}
                </Button>
              )}
            </HStack>
          </HStack>

          {data.is_deleted && (
            <Box mb={4} p={3} borderRadius="md" bg="red.50" border="1px solid" borderColor="red.200">
              <Text color="red.600" fontSize="sm" fontWeight="semibold">
                {t("vlAssembly.common.deletedRecord")} {data.deleted_at ? `(${data.deleted_at.slice(0, 10)})` : ""}
              </Text>
            </Box>
          )}

          {/* 기본 정보 카드 */}
          <Box bg={cardBg} borderRadius="xl" border="1px solid" borderColor={borderColor} p={6} shadow="sm" mb={6}>
            <HStack align="flex-start" spacing={4} mb={5} flexWrap="wrap">
              {styleThumbnail && (
                <Box
                  as="img"
                  src={styleThumbnail}
                  alt={styleName ?? "style"}
                  w="72px"
                  h="72px"
                  sx={{ objectFit: "cover" }}
                  borderRadius="lg"
                  flexShrink={0}
                  boxShadow="sm"
                  border="1px solid"
                  borderColor={borderColor}
                  cursor="pointer"
                  onClick={() => setPhotoModalUrl(styleThumbnail)}
                />
              )}
              <Box>
                <HStack align="baseline" spacing={3} mb={1} flexWrap="wrap">
                  <VlAssemblyBadge kind="vlSj" fontSize="sm" />
                  <Heading size="md">{data.sj_no}</Heading>
                  <StatusBadge status={data.status ?? "not_started"} fontSize="sm">
                    {data.status_display}
                  </StatusBadge>
                </HStack>
                {styleName && (
                  <Text fontSize="sm" color={labelColor}>{styleName}</Text>
                )}
              </Box>
            </HStack>

            <HStack spacing={8} flexWrap="wrap" align="flex-start">
              <InfoRow label={t("vlAssembly.sjNoDetail.sjNoField")} labelColor={labelColor}
                fieldName="sj_no" overrideFields={overrideFields} onReset={(f) => openSyncConfirm([f])}>
                {editingSjNo ? (
                  <Input size="xs" w="160px" value={editingSjNo.val} autoFocus
                    onChange={(e) => setEditingSjNo({ val: e.target.value })}
                    onBlur={() => saveSjNo(editingSjNo.val)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") saveSjNo(editingSjNo.val);
                      if (e.key === "Escape") setEditingSjNo(null);
                    }}
                  />
                ) : (
                  <Text fontSize="sm" cursor="pointer" color={data.sj_no ? undefined : "gray.400"}
                    _hover={{ textDecoration: "underline" }}
                    onClick={() => setEditingSjNo({ val: data.sj_no ?? "" })}>
                    {data.sj_no || "—"}
                  </Text>
                )}
              </InfoRow>
              <InfoRow label={t("vlAssembly.sjNoDetail.totalQty")} labelColor={labelColor}>
                <Text fontSize="sm">{data.total_qty != null ? data.total_qty.toLocaleString() : "—"}</Text>
              </InfoRow>
              <InfoRow label={t("vlAssembly.sjNoDetail.outputQty")} labelColor={labelColor}>
                <Text fontSize="sm">{(data.output_qty ?? 0).toLocaleString()}</Text>
              </InfoRow>
              <InfoRow label={t("vlAssembly.sjNoDetail.balance")} labelColor={labelColor}>
                <Text fontSize="sm">
                  {data.total_qty != null ? Math.max(0, data.total_qty - (data.output_qty ?? 0)).toLocaleString() : "—"}
                </Text>
              </InfoRow>
              <InfoRow label={t("vlAssembly.sjNoDetail.epSchedule")} labelColor={labelColor}>
                <RouterLink to={`/vl-assembly-production/${data.ep_schedule_pk}`}>
                  <Link as="span" color="blue.500" fontSize="sm">{t("vlAssembly.sjNoDetail.scheduleNo", { pk: data.ep_schedule_pk })}</Link>
                </RouterLink>
              </InfoRow>
              <Box w="100%" />
              <InfoRow label={t("vlAssembly.processDetail.cycleTime")} labelColor={labelColor}
                fieldName="cycle_time" overrideFields={overrideFields} onReset={(f) => openSyncConfirm([f])}>
                <Tooltip label={t("vlAssembly.processDetail.throughputLinkedHint")} placement="top" hasArrow>
                  {editingCycleTime !== null ? (
                    <Input size="xs" w="100px" autoFocus
                      value={editingCycleTime}
                      onChange={(e) => setEditingCycleTime(e.target.value)}
                      onBlur={() => saveThroughputFromCycle(editingCycleTime)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") saveThroughputFromCycle(editingCycleTime);
                        if (e.key === "Escape") setEditingCycleTime(null);
                      }}
                    />
                  ) : (
                    <Text fontSize="sm" cursor="pointer" color={sjCycleDisplay ? undefined : "gray.400"}
                      _hover={{ textDecoration: "underline" }}
                      onClick={() => setEditingCycleTime(data.cycle_time ?? "")}>
                      {sjCycleDisplay ?? "—"}
                    </Text>
                  )}
                </Tooltip>
                {!data.cycle_time && sjThroughputRollup && (
                  <Text fontSize="xs" color="gray.400">{t("vlAssembly.sjNoDetail.throughputRollupHint")}</Text>
                )}
              </InfoRow>
              <InfoRow label={t("vlAssembly.processDetail.targetPerHour")} labelColor={labelColor}>
                <Tooltip label={t("vlAssembly.processDetail.throughputLinkedHint")} placement="top" hasArrow>
                  {editingTargetHr !== null ? (
                    <Input size="xs" w="100px" autoFocus
                      value={editingTargetHr}
                      onChange={(e) => setEditingTargetHr(e.target.value)}
                      onBlur={() => saveThroughputFromTargetHr(editingTargetHr)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") saveThroughputFromTargetHr(editingTargetHr);
                        if (e.key === "Escape") setEditingTargetHr(null);
                      }}
                    />
                  ) : (
                    <Text fontSize="sm" cursor="pointer" color={sjTph != null ? undefined : "gray.400"}
                      _hover={{ textDecoration: "underline" }}
                      onClick={() => setEditingTargetHr(String(sjTph ?? ""))}>
                      {sjTph != null ? `${sjTph} pcs/h` : "—"}
                    </Text>
                  )}
                </Tooltip>
              </InfoRow>
              <InfoRow label={t("vlAssembly.processDetail.dailyTarget")} labelColor={labelColor}>
                <Text fontSize="sm">{sjDaily != null ? `${sjDaily} pcs` : "—"}</Text>
              </InfoRow>
              <InfoRow label={t("vlAssembly.sjNoDetail.originalSjNo")} labelColor={labelColor}>
                {data.source_sj_no_info ? (
                  <HStack spacing={2} align="center" flexWrap="wrap">
                    <VlAssemblyOriginalReferenceBadges category="sj" fontSize="xs" />
                    <RouterLink to={`/sjnos/${data.source_sj_no_info.pk}`}>
                      <HStack spacing={1} as="span">
                        <Link as="span" color="teal.500" fontSize="sm" fontWeight="semibold">
                          {data.source_sj_no_info.sj_no}
                        </Link>
                        <FaExternalLinkAlt size={10} color="teal" />
                      </HStack>
                    </RouterLink>
                  </HStack>
                ) : (
                  <Text fontSize="sm" color="gray.400">—</Text>
                )}
              </InfoRow>
            </HStack>
          </Box>

          {/* VL Assembly Modules 목록 */}
          <Box bg={cardBg} borderRadius="xl" border="1px solid" borderColor={borderColor} p={6} shadow="sm">
            <Heading size="sm" mb={4}>{t("vlAssembly.sjNoDetail.epModules", { count: data.ep_modules.length })}</Heading>
            <Divider mb={4} />
            {data.ep_modules.length === 0 ? (
              <Text color="gray.400" textAlign="center" py={6}>{t("vlAssembly.sjNoDetail.noModules")}</Text>
            ) : (
              <TableContainer>
                <Table variant="striped" size="sm">
                  <Thead bgColor={tableBg}>
                    <Tr>
                      <Th>#</Th>
                      <Th>{t("vlAssembly.sjNoDetail.colCode")}</Th>
                      <Th>{t("vlAssembly.sjNoDetail.colName")}</Th>
                      <Th isNumeric>{t("vlAssembly.sjNoDetail.colOutputQty")}</Th>
                      <Th isNumeric>{t("vlAssembly.sjNoDetail.colTotalQty")}</Th>
                      <Th isNumeric>{t("vlAssembly.sjNoDetail.colProcessCount")}</Th>
                      <Th>{t("vlAssembly.sjNoDetail.colStatus")}</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {data.ep_modules.map((mod, idx) => (
                      <Tr key={mod.pk}>
                        <Td>{idx + 1}</Td>
                        <Td fontWeight="semibold" whiteSpace="nowrap">
                          <HStack spacing={2} align="center">
                            <VlAssemblyBadge kind="vlModule" fontSize="xs" />
                            <RouterLink to={`/vl-assembly-production/modules/${mod.pk}`}>
                              <Link as="span" color="blue.500">{mod.code}</Link>
                            </RouterLink>
                          </HStack>
                        </Td>
                        <Td whiteSpace="nowrap">{mod.name || <Text as="span" color="gray.400">-</Text>}</Td>
                        <Td isNumeric>{(mod.output_qty ?? 0).toLocaleString()}</Td>
                        <Td isNumeric>{mod.total_qty != null ? mod.total_qty.toLocaleString() : "—"}</Td>
                        <Td isNumeric>{(mod.ep_processes?.length ?? 0).toLocaleString()}</Td>
                        <Td>
                          <StatusBadge status={mod.status ?? "not_started"} fontSize="xs">
                            {mod.status_display}
                          </StatusBadge>
                        </Td>
                      </Tr>
                    ))}
                  </Tbody>
                </Table>
              </TableContainer>
            )}
          </Box>

          {!data.is_deleted && data.ep_schedule_pk != null && (
            <Box mt={6}>
              <HStack justify="flex-end" mb={3}>
                <Button
                  as={RouterLink}
                  to={`/vl-assembly-production/sj-nos/${pk}/schedule-daily-outputs`}
                  size="sm"
                  colorScheme="blue"
                  variant="outline"
                  leftIcon={<FaClipboardList />}
                >
                  {t("vlAssembly.sjNoDetail.viewScheduleDailyOutputs")}
                </Button>
              </HStack>
              <VlAssemblyScheduleProductionDailyOutputQr
                vlAssemblySchedulePk={data.ep_schedule_pk}
                vlAssemblySjNoPk={pk}
                variant="card"
              />
            </Box>
          )}

          {!data.is_deleted && <EpInspectionEntryQr targetParam="vl_assembly_sj_no" pk={pk} variant="card" />}
        </Box>
      </Box>

      {/* Delete confirmation dialog */}
      <AlertDialog isOpen={isDeleteOpen} leastDestructiveRef={cancelRef} onClose={onDeleteClose}>
        <AlertDialogOverlay>
          <AlertDialogContent>
            <AlertDialogHeader>{t("vlAssembly.common.deleteTitle")}</AlertDialogHeader>
            <AlertDialogBody>{t("vlAssembly.common.deleteSjNoConfirm")}</AlertDialogBody>
            <AlertDialogFooter>
              <Button ref={cancelRef} onClick={onDeleteClose}>{t("vlAssembly.common.cancel")}</Button>
              <Button colorScheme="red" onClick={handleDelete} isLoading={deleting} ml={3}>
                {t("vlAssembly.common.delete")}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>

      <AlertDialog isOpen={isSyncOpen} leastDestructiveRef={syncCancelRef} onClose={onSyncClose}>
        <AlertDialogOverlay>
          <AlertDialogContent>
            <AlertDialogHeader>{t("vlAssembly.common.syncFromSourceConfirmTitle")}</AlertDialogHeader>
            <AlertDialogBody>{t("vlAssembly.common.syncFromSourceConfirmBodySjNo")}</AlertDialogBody>
            <AlertDialogFooter>
              <Button ref={syncCancelRef} onClick={onSyncClose}>{t("vlAssembly.common.cancel")}</Button>
              <Button colorScheme="teal" onClick={confirmSync} isLoading={syncing} ml={3}>
                {t("vlAssembly.common.syncConfirm")}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>

      <PhotoModal
        isOpen={!!photoModalUrl}
        onClose={() => setPhotoModalUrl(undefined)}
        selectedImage={photoModalUrl}
      />
    </>
  );
}
