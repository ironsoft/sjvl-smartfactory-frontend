import {
  Badge,
  Box,
  Button,
  Center,
  Divider,
  Flex,
  HStack,
  Heading,
  Input,
  Link,
  Select,
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
import { FaArrowLeft, FaCopy, FaExternalLinkAlt, FaSync, FaTrash } from "react-icons/fa";
import {
  getVlAssemblyModuleDetail, patchVlAssemblyModule, patchVlAssemblyProcess,
  deleteVlAssemblyModule, syncVlAssemblyModuleFromSource,
  IVlAssemblyModuleDetail,
} from "../api";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import QRCode from "qrcode";
import EpInspectionEntryQr from "../components/VlAssemblyInspectionEntryQr";
import { VlAssemblyBadge, VlAssemblyOriginalReferenceBadges } from "../components/VlAssemblyBadge";
import { statusOptionStyle } from "../components/StatusBadge";
import LocalizedDateInput from "../components/LocalizedDateInput";
import { formatIsoDateDisplay } from "../lib/dateLocale";
import { broadcastVlAssemblyScheduleListCacheBust } from "../lib/vlAssemblyProductionScheduleListCacheBust";
import {
  bottleneckThroughputFromProcesses,
  parseCycleTimeSeconds,
  formatCycleTimeForApi,
  targetQtyPerHourFromCycleSeconds,
  dailyTargetQty8hFromTargetPerHour,
} from "../lib/vlAssemblyThroughput";
import { displayModuleCategoryTriple } from "../lib/moduleCategoryDisplay";

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

type DateField = "process_start_date" | "process_finish_date";

export default function VlAssemblyModuleDetail() {
  const { moduleId } = useParams<{ moduleId: string }>();
  const pk = Number(moduleId);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isPopupWindow = searchParams.get("popup") === "1";
  const queryClient = useQueryClient();
  const toast = useToast();
  const { t, i18n } = useTranslation();
  const { isOpen: isDeleteOpen, onOpen: onDeleteOpen, onClose: onDeleteClose } = useDisclosure();
  const { isOpen: isSyncOpen, onOpen: onSyncOpen, onClose: onSyncClose } = useDisclosure();
  const cancelRef = useRef<HTMLButtonElement>(null);
  const syncCancelRef = useRef<HTMLButtonElement>(null);
  const pendingSyncRef = useRef<"full" | string[] | null>(null);

  const STATUS_OPTIONS = [
    { value: "not_started", label: t("vlAssembly.status.not_started") },
    { value: "outsourced",  label: t("vlAssembly.status.outsourced") },
    { value: "in_progress", label: t("vlAssembly.status.in_progress") },
    { value: "completed",   label: t("vlAssembly.status.completed") },
    { value: "not_ready",   label: t("vlAssembly.status.not_ready") },
  ];

  const cardBg = useColorModeValue("white", "gray.800");
  const pageBg = useColorModeValue("gray.50", "gray.900");
  const borderColor = useColorModeValue("gray.200", "gray.600");
  const dailyOutputQrFrameBorder = useColorModeValue("blue.400", "blue.300");
  const labelColor = useColorModeValue("gray.500", "gray.400");
  const tableBg = useColorModeValue("gray.50", "gray.800");

  // Module-level editing state
  const [editingModuleField, setEditingModuleField] = useState<{ field: DateField; val: string } | null>(null);
  const [editingModuleQty, setEditingModuleQty] = useState<{ val: string } | null>(null);
  const [editingModuleText, setEditingModuleText] = useState<{ field: string; val: string } | null>(null);
  const [editingModuleTargetHr, setEditingModuleTargetHr] = useState<string | null>(null);
  const [savingModuleStatus, setSavingModuleStatus] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Process-level editing state (one cell at a time)
  const [editingProcDate, setEditingProcDate] = useState<{ pk: number; field: DateField; val: string } | null>(null);
  const [editingProcQty, setEditingProcQty] = useState<{ pk: number; val: string; totalQty?: number | null } | null>(null);
  const [savingProcStatus, setSavingProcStatus] = useState<number | null>(null);
  const [dailyOutputQrDataUrl, setDailyOutputQrDataUrl] = useState("");

  const moduleDailyOutputPath = pk ? `/vl-assembly-production/module-daily-outputs?vl_assembly_module=${pk}` : "";

  const moduleDailyOutputUrl = useMemo(
    () =>
      typeof window !== "undefined" && moduleDailyOutputPath
        ? `${window.location.origin}${moduleDailyOutputPath}`
        : "",
    [moduleDailyOutputPath]
  );

  const { data, isLoading } = useQuery<IVlAssemblyModuleDetail>({
    queryKey: ["epModuleDetail", pk],
    queryFn: () => getVlAssemblyModuleDetail(pk),
    enabled: !!pk,
  });

  const moduleThroughputRollup = useMemo(() => {
    if (!data?.ep_processes?.length) return null;
    return bottleneckThroughputFromProcesses(data.ep_processes);
  }, [data?.ep_processes]);

  useEffect(() => {
    if (!pk || isLoading || !data || data.is_deleted || !moduleDailyOutputUrl) {
      setDailyOutputQrDataUrl("");
      return;
    }
    let cancelled = false;
    QRCode.toDataURL(moduleDailyOutputUrl, { margin: 1, width: 104 })
      .then((url) => {
        if (!cancelled) setDailyOutputQrDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setDailyOutputQrDataUrl("");
      });
    return () => {
      cancelled = true;
    };
  }, [pk, isLoading, data, moduleDailyOutputUrl]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["epModuleDetail", pk] });
    queryClient.invalidateQueries({ queryKey: ["vlSchedules"] });
    queryClient.invalidateQueries({ queryKey: ["epProcessDetail"] });
    broadcastVlAssemblyScheduleListCacheBust();
  };

  const saveModuleQty = async (val: string, totalQty?: number | null) => {
    const qty = val === "" ? 0 : parseInt(val, 10);
    if (val !== "" && isNaN(qty)) { setEditingModuleQty(null); return; }
    if (totalQty != null && qty > totalQty) {
      toast({ title: t("vlAssembly.common.outputExceedsTotal", { total: totalQty?.toLocaleString() }), status: "warning", duration: 2500, position: "bottom-right" });
      setEditingModuleQty(null);
      return;
    }
    try {
      await patchVlAssemblyModule(pk, { output_qty: qty });
      invalidate();
    } catch {
      toast({ title: t("vlAssembly.common.failedSave"), status: "error", duration: 2000, position: "bottom-right" });
    }
    setEditingModuleQty(null);
  };

  const saveModuleDate = async (field: DateField, val: string) => {
    try {
      await patchVlAssemblyModule(pk, { [field]: val || null } as any);
      invalidate();
    } catch {
      toast({ title: t("vlAssembly.common.failedSave"), status: "error", duration: 2000, position: "bottom-right" });
    }
    setEditingModuleField(null);
  };

  const saveModuleStatus = async (val: string) => {
    setSavingModuleStatus(true);
    try {
      await patchVlAssemblyModule(pk, { status: val });
      invalidate();
    } catch {
      toast({ title: t("vlAssembly.common.failedSave"), status: "error", duration: 2000, position: "bottom-right" });
    }
    setSavingModuleStatus(false);
  };

  const saveModuleThroughputFromCycle = async (raw: string) => {
    const secs = parseCycleTimeSeconds(raw);
    if (!secs) {
      toast({ title: t("vlAssembly.processDetail.invalidCycleTime"), status: "warning", duration: 2500, position: "bottom-right" });
      setEditingModuleText(null);
      return;
    }
    const tph = targetQtyPerHourFromCycleSeconds(secs);
    const daily = dailyTargetQty8hFromTargetPerHour(tph);
    try {
      await patchVlAssemblyModule(pk, { cycle_time: formatCycleTimeForApi(secs), target_qty_per_hour: tph, daily_target_qty_8h: daily } as any);
      invalidate();
    } catch {
      toast({ title: t("vlAssembly.common.failedSave"), status: "error", duration: 2000, position: "bottom-right" });
    }
    setEditingModuleText(null);
  };

  const saveModuleThroughputFromTargetHr = async (raw: string) => {
    const n = Number.parseFloat(raw.trim().replace(",", "."));
    if (!Number.isFinite(n) || n <= 0) {
      toast({ title: t("vlAssembly.processDetail.invalidTargetPerHour"), status: "warning", duration: 2500, position: "bottom-right" });
      setEditingModuleTargetHr(null);
      return;
    }
    const secs = 3600 / n;
    const daily = dailyTargetQty8hFromTargetPerHour(n);
    try {
      await patchVlAssemblyModule(pk, { cycle_time: formatCycleTimeForApi(secs), target_qty_per_hour: Math.round(n), daily_target_qty_8h: daily } as any);
      invalidate();
    } catch {
      toast({ title: t("vlAssembly.common.failedSave"), status: "error", duration: 2000, position: "bottom-right" });
    }
    setEditingModuleTargetHr(null);
  };

  const saveModuleText = async (field: string, val: string) => {
    if (field === "cycle_time") { await saveModuleThroughputFromCycle(val); return; }
    try {
      await patchVlAssemblyModule(pk, { [field]: val } as any);
      invalidate();
    } catch {
      toast({ title: t("vlAssembly.common.failedSave"), status: "error", duration: 2000, position: "bottom-right" });
    }
    setEditingModuleText(null);
  };

  const saveProcDate = async (procPk: number, field: DateField, val: string) => {
    try {
      await patchVlAssemblyProcess(procPk, { [field]: val || null } as any);
      invalidate();
    } catch {
      toast({ title: t("vlAssembly.common.failedSave"), status: "error", duration: 2000, position: "bottom-right" });
    }
    setEditingProcDate(null);
  };

  const saveProcQty = async (procPk: number, val: string, totalQty?: number | null) => {
    const qty = val === "" ? 0 : parseInt(val, 10);
    if (val !== "" && isNaN(qty)) { setEditingProcQty(null); return; }
    if (totalQty != null && qty > totalQty) {
      toast({ title: t("vlAssembly.common.outputExceedsTotal", { total: totalQty?.toLocaleString() }), status: "warning", duration: 2500, position: "bottom-right" });
      setEditingProcQty(null);
      return;
    }
    try {
      await patchVlAssemblyProcess(procPk, { output_qty: qty });
      invalidate();
    } catch (e: unknown) {
      const ax = e as { response?: { data?: { output_qty?: string | string[] } } };
      const raw = ax?.response?.data?.output_qty;
      const msg = Array.isArray(raw) ? raw[0] : raw;
      toast({
        title: msg || t("vlAssembly.common.failedSave"),
        status: "error",
        duration: 4000,
        position: "bottom-right",
      });
    }
    setEditingProcQty(null);
  };

  const saveProcStatus = async (procPk: number, val: string) => {
    setSavingProcStatus(procPk);
    try {
      await patchVlAssemblyProcess(procPk, { status: val });
      invalidate();
    } catch {
      toast({ title: t("vlAssembly.common.failedSave"), status: "error", duration: 2000, position: "bottom-right" });
    }
    setSavingProcStatus(null);
  };

  const openSyncConfirm = (mode: "full" | string[]) => {
    pendingSyncRef.current = mode;
    onSyncOpen();
  };

  const handleSync = async (resetFields?: string[]) => {
    setSyncing(true);
    try {
      const res = await syncVlAssemblyModuleFromSource(pk, resetFields);
      invalidate();
      queryClient.invalidateQueries({ queryKey: ["epSjNoDetail", res.ep_sj_no_pk] });
      const parts: string[] = [];
      if (res.updated_fields.length) {
        parts.push(t("vlAssembly.common.syncFields", { fields: res.updated_fields.join(", ") }));
      }
      if (res.processes_sync && (res.processes_sync.created || res.processes_sync.updated || res.processes_sync.deleted || res.processes_sync.reactivated)) {
        parts.push(t("vlAssembly.common.syncParentModuleNote"));
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
      await deleteVlAssemblyModule(pk);
      broadcastVlAssemblyScheduleListCacheBust();
      toast({ title: t("vlAssembly.common.deleted"), status: "success", duration: 2000, position: "bottom-right" });
      navigate(-1);
    } catch {
      toast({ title: t("vlAssembly.common.failedDelete"), status: "error", duration: 2000, position: "bottom-right" });
    }
    setDeleting(false);
    onDeleteClose();
  };

  const copyModuleDailyOutputLink = async () => {
    try {
      await navigator.clipboard.writeText(moduleDailyOutputUrl);
      toast({
        title: t("vlAssembly.processDetail.dailyOutputLinkCopied"),
        status: "success",
        duration: 2000,
        position: "bottom-right",
      });
    } catch {
      toast({
        title: t("vlAssembly.processDetail.dailyOutputLinkCopyFailed"),
        status: "error",
        duration: 2000,
        position: "bottom-right",
      });
    }
  };

  if (isLoading) return <Center minH="60vh"><Spinner size="xl" /></Center>;
  if (!data) return <Center minH="60vh"><Text color="gray.400">{t("vlAssembly.moduleDetail.notFound")}</Text></Center>;

  const overrideFields = data.override_fields ?? [];
  const moduleCycleTrimmed = data.cycle_time?.trim() || "";
  const moduleCycleDisplay =
    moduleCycleTrimmed ||
    moduleThroughputRollup?.cycleTimeDisplay ||
    null;
  const moduleTph =
    data.target_qty_per_hour ?? moduleThroughputRollup?.targetPerHour ?? null;
  const moduleDaily =
    data.daily_target_qty_8h ?? moduleThroughputRollup?.dailyTarget ?? null;

  const EditableDateText = ({
    value, field, isModule, procPk,
  }: { value?: string | null; field: DateField; isModule?: boolean; procPk?: number }) => {
    const isEditing = isModule
      ? editingModuleField?.field === field
      : editingProcDate != null && editingProcDate.pk === procPk && editingProcDate.field === field;
    const editVal = isModule ? editingModuleField?.val ?? "" : editingProcDate?.val ?? "";

    if (isEditing) {
      return (
        <LocalizedDateInput
          compact
          size="xs"
          w="120px"
          value={editVal}
          onChange={(v) => (isModule
            ? setEditingModuleField({ field, val: v })
            : setEditingProcDate({ pk: procPk!, field, val: v }))}
          onCommit={(iso) => (isModule ? saveModuleDate(field, iso) : saveProcDate(procPk!, field, iso))}
          onCancel={() => (isModule ? setEditingModuleField(null) : setEditingProcDate(null))}
          autoFocus
          allowClear={false}
        />
      );
    }
    return (
      <Text fontSize="sm" cursor="pointer" color={value ? undefined : "gray.400"}
        _hover={{ textDecoration: "underline" }}
        onClick={() => isModule
          ? setEditingModuleField({ field, val: value ?? "" })
          : setEditingProcDate({ pk: procPk!, field, val: value ?? "" })}>
        {value ? formatIsoDateDisplay(value, i18n.language) : "—"}
      </Text>
    );
  };

  const EditableTextField = ({ field, value }: { field: string; value?: string | null }) => {
    const isEditing = editingModuleText?.field === field;
    if (isEditing) {
      return (
        <Input size="xs" value={editingModuleText.val} autoFocus
          onChange={(e) => setEditingModuleText({ field, val: e.target.value })}
          onBlur={() => saveModuleText(field, editingModuleText.val)}
          onKeyDown={(e) => {
            if (e.key === "Enter") saveModuleText(field, editingModuleText.val);
            if (e.key === "Escape") setEditingModuleText(null);
          }}
        />
      );
    }
    return (
      <Text fontSize="sm" cursor="pointer" color={value ? undefined : "gray.400"}
        _hover={{ textDecoration: "underline" }}
        onClick={() => setEditingModuleText({ field, val: value ?? "" })}>
        {value || "—"}
      </Text>
    );
  };

  return (
    <>
      <Helmet><title>{`${data.code} — ${t("vlAssembly.moduleDetail.pageTitle")}`}</title></Helmet>
      <Box bg={pageBg} minH="100vh" px={{ base: 4, md: 8, lg: 12 }} py={{ base: 6, md: 8 }}>
        <Box maxW="5xl" mx="auto">
          <HStack mb={4} justify={isPopupWindow ? "flex-end" : "space-between"} w="full">
            {!isPopupWindow && (
              <Button leftIcon={<FaArrowLeft />} variant="ghost" size="sm" onClick={() => navigate(-1)}>{t("vlAssembly.common.back")}</Button>
            )}
            <HStack spacing={2}>
              {data.source_module_info && (
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
            <HStack align="baseline" spacing={3} mb={5} flexWrap="wrap">
              <VlAssemblyBadge kind="vlModule" fontSize="sm" />
              <Heading size="md">{data.code}</Heading>
              {data.name && <Text fontSize="lg" color="gray.500">{data.name}</Text>}
            </HStack>

            <HStack spacing={8} flexWrap="wrap" align="flex-start">
              <InfoRow label={t("vlAssembly.moduleDetail.codeName")} labelColor={labelColor}
                fieldName="code" overrideFields={overrideFields} onReset={(f) => openSyncConfirm([f])}>
                <EditableTextField field="code" value={data.code} />
              </InfoRow>
              <InfoRow label={t("vlAssembly.moduleDetail.name")} labelColor={labelColor}
                fieldName="name" overrideFields={overrideFields} onReset={(f) => openSyncConfirm([f])}>
                <EditableTextField field="name" value={data.name} />
              </InfoRow>
              <InfoRow label={t("vlAssembly.moduleDetail.moduleMajorCategory")} labelColor={labelColor}>
                <Text fontSize="sm" color={(data.module_category_name ?? data.module_category_name_ko ?? data.module_category_name_vi) ? undefined : "gray.400"}>
                  {displayModuleCategoryTriple(
                    data.module_category_name,
                    data.module_category_name_ko,
                    data.module_category_name_vi,
                    i18n.language
                  ) || "—"}
                </Text>
              </InfoRow>
              <InfoRow label={t("vlAssembly.moduleDetail.moduleSubCategory")} labelColor={labelColor}>
                <Text fontSize="sm" color={(data.module_sub_category_name ?? data.module_sub_category_name_ko ?? data.module_sub_category_name_vi) ? undefined : "gray.400"}>
                  {displayModuleCategoryTriple(
                    data.module_sub_category_name,
                    data.module_sub_category_name_ko,
                    data.module_sub_category_name_vi,
                    i18n.language
                  ) || "—"}
                </Text>
              </InfoRow>
              <InfoRow label={t("vlAssembly.moduleDetail.totalQty")} labelColor={labelColor}>
                <Text fontSize="sm">{data.total_qty != null ? data.total_qty.toLocaleString() : "—"}</Text>
              </InfoRow>
              <InfoRow label={t("vlAssembly.moduleDetail.outputQty")} labelColor={labelColor}>
                {editingModuleQty ? (
                  <Input size="xs" w="100px" type="number" min={0} max={data.total_qty ?? undefined}
                    value={editingModuleQty.val} autoFocus
                    onChange={(e) => {
                      const raw = e.target.value;
                      if (raw === "") { setEditingModuleQty({ val: "" }); return; }
                      const n = parseInt(raw, 10);
                      if (!isNaN(n) && data.total_qty != null && n > data.total_qty) return;
                      setEditingModuleQty({ val: raw });
                    }}
                    onBlur={() => saveModuleQty(editingModuleQty.val, data.total_qty)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") saveModuleQty(editingModuleQty.val, data.total_qty);
                      if (e.key === "Escape") setEditingModuleQty(null);
                    }}
                  />
                ) : (
                  <Text fontSize="sm" cursor="pointer" _hover={{ textDecoration: "underline" }}
                    onClick={() => setEditingModuleQty({ val: String(data.output_qty ?? "") })}>
                    {(data.output_qty ?? 0).toLocaleString()}
                  </Text>
                )}
              </InfoRow>
              <InfoRow label={t("vlAssembly.moduleDetail.balance")} labelColor={labelColor}>
                <Text fontSize="sm">
                  {data.total_qty != null ? Math.max(0, data.total_qty - (data.output_qty ?? 0)).toLocaleString() : "—"}
                </Text>
              </InfoRow>
              <InfoRow label={t("vlAssembly.moduleDetail.status")} labelColor={labelColor}>
                <Select size="xs" value={data.status ?? "not_started"} w="120px"
                  isDisabled={savingModuleStatus}
                  onChange={(e) => saveModuleStatus(e.target.value)}>
                  {STATUS_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value} style={statusOptionStyle(opt.value)}>
                      {opt.label}
                    </option>
                  ))}
                </Select>
              </InfoRow>
              <InfoRow label={t("vlAssembly.moduleDetail.processStart")} labelColor={labelColor}>
                <EditableDateText value={data.process_start_date} field="process_start_date" isModule />
              </InfoRow>
              <InfoRow label={t("vlAssembly.moduleDetail.processFinish")} labelColor={labelColor}>
                <EditableDateText value={data.process_finish_date} field="process_finish_date" isModule />
              </InfoRow>
              <InfoRow label={t("vlAssembly.moduleDetail.leadTimeDays")} labelColor={labelColor}>
                <Text fontSize="sm">{data.process_lead_time_days != null ? `${data.process_lead_time_days}d` : "—"}</Text>
              </InfoRow>
              <Box w="100%" />
              <InfoRow label={t("vlAssembly.processDetail.cycleTime")} labelColor={labelColor}
                fieldName="cycle_time" overrideFields={overrideFields} onReset={(f) => openSyncConfirm([f])}>
                <Tooltip label={t("vlAssembly.processDetail.throughputLinkedHint")} placement="top" hasArrow>
                  <EditableTextField field="cycle_time" value={data.cycle_time} />
                </Tooltip>
                {!data.cycle_time && moduleThroughputRollup && (
                  <Text fontSize="xs" color="gray.400">
                    {t("vlAssembly.moduleDetail.throughputRollupHint")} ({moduleCycleDisplay})
                  </Text>
                )}
              </InfoRow>
              <InfoRow label={t("vlAssembly.processDetail.targetPerHour")} labelColor={labelColor}>
                <Tooltip label={t("vlAssembly.processDetail.throughputLinkedHint")} placement="top" hasArrow>
                  {editingModuleTargetHr !== null ? (
                    <Input
                      size="xs" w="100px" autoFocus
                      value={editingModuleTargetHr}
                      onChange={(e) => setEditingModuleTargetHr(e.target.value)}
                      onBlur={() => saveModuleThroughputFromTargetHr(editingModuleTargetHr)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") saveModuleThroughputFromTargetHr(editingModuleTargetHr);
                        if (e.key === "Escape") setEditingModuleTargetHr(null);
                      }}
                    />
                  ) : (
                    <Text fontSize="sm" cursor="pointer" color={moduleTph != null ? undefined : "gray.400"}
                      _hover={{ textDecoration: "underline" }}
                      onClick={() => setEditingModuleTargetHr(String(moduleTph ?? ""))}>
                      {moduleTph != null ? `${moduleTph} pcs/h` : "—"}
                    </Text>
                  )}
                </Tooltip>
              </InfoRow>
              <InfoRow label={t("vlAssembly.processDetail.dailyTarget")} labelColor={labelColor}>
                <Text fontSize="sm">
                  {moduleDaily != null ? `${moduleDaily} pcs` : "—"}
                </Text>
              </InfoRow>
              <InfoRow label={t("vlAssembly.moduleDetail.parentEpSjNo")} labelColor={labelColor}>
                <RouterLink to={`/vl-assembly-production/sj-nos/${data.ep_sj_no_pk}`}>
                  <Link as="span" color="blue.500" fontSize="sm">{data.ep_sj_no_sj_no}</Link>
                </RouterLink>
              </InfoRow>
              <InfoRow label={t("vlAssembly.moduleDetail.originalModule")} labelColor={labelColor}>
                {data.source_module_info ? (
                  <HStack spacing={2} align="center" flexWrap="wrap">
                    <VlAssemblyOriginalReferenceBadges category="module" fontSize="xs" />
                    <RouterLink to={`/production-process/modules/${data.source_module_info.pk}`}>
                      <HStack spacing={1} as="span">
                        <Link as="span" color="teal.500" fontSize="sm" fontWeight="semibold">
                          {data.source_module_info.code}
                          {data.source_module_info.name ? ` — ${data.source_module_info.name}` : ""}
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

          {/* VL Assembly Processes 목록 */}
          <Box bg={cardBg} borderRadius="xl" border="1px solid" borderColor={borderColor} p={6} shadow="sm">
            <Heading size="sm" mb={4}>{t("vlAssembly.moduleDetail.epProcesses", { count: data.ep_processes.length })}</Heading>
            <Divider mb={4} />
            {data.ep_processes.length === 0 ? (
              <Text color="gray.400" textAlign="center" py={6}>{t("vlAssembly.moduleDetail.noProcesses")}</Text>
            ) : (
              <TableContainer>
                <Table variant="striped" size="sm">
                  <Thead bgColor={tableBg}>
                    <Tr>
                      <Th>#</Th>
                      <Th>{t("vlAssembly.moduleDetail.colCode")}</Th>
                      <Th>{t("vlAssembly.moduleDetail.colName")}</Th>
                      <Th isNumeric>{t("vlAssembly.moduleDetail.colOutputQty")}</Th>
                      <Th isNumeric>{t("vlAssembly.moduleDetail.colTotalQty")}</Th>
                      <Th isNumeric>{t("vlAssembly.moduleDetail.colCycleTime")}</Th>
                      <Th isNumeric>{t("vlAssembly.moduleDetail.colTargetHr")}</Th>
                      <Th isNumeric>{t("vlAssembly.moduleDetail.colDailyTarget8h")}</Th>
                      <Th whiteSpace="nowrap">{t("vlAssembly.moduleDetail.colProcessStart")}</Th>
                      <Th whiteSpace="nowrap">{t("vlAssembly.moduleDetail.colProcessFinish")}</Th>
                      <Th isNumeric whiteSpace="nowrap">{t("vlAssembly.moduleDetail.colLeadTime")}</Th>
                      <Th>{t("vlAssembly.moduleDetail.colStatus")}</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {data.ep_processes.map((proc, idx) => (
                      <Tr key={proc.pk}>
                        <Td>{idx + 1}</Td>
                        <Td fontWeight="semibold" whiteSpace="nowrap">
                          <HStack spacing={2} align="center">
                            <VlAssemblyBadge kind="vlProcess" fontSize="xs" />
                            <RouterLink to={`/vl-assembly-production/processes/${proc.pk}`}>
                              <Link as="span" color="blue.500">{proc.code}</Link>
                            </RouterLink>
                          </HStack>
                        </Td>
                        <Td whiteSpace="nowrap">{proc.name || proc.name_ko || <Text as="span" color="gray.400">-</Text>}</Td>
                        <Td isNumeric>
                          {editingProcQty?.pk === proc.pk && !proc.output_qty_locked ? (
                            <Input size="xs" w="70px" type="number" min={0} max={proc.total_qty ?? undefined}
                              value={editingProcQty.val} autoFocus
                              onChange={(e) => {
                                const raw = e.target.value;
                                if (raw === "") { setEditingProcQty({ pk: proc.pk, val: "", totalQty: proc.total_qty }); return; }
                                const n = parseInt(raw, 10);
                                if (!isNaN(n) && proc.total_qty != null && n > proc.total_qty) return;
                                setEditingProcQty({ pk: proc.pk, val: raw, totalQty: proc.total_qty });
                              }}
                              onBlur={() => saveProcQty(proc.pk, editingProcQty.val, proc.total_qty)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") saveProcQty(proc.pk, editingProcQty.val, proc.total_qty);
                                if (e.key === "Escape") setEditingProcQty(null);
                              }}
                            />
                          ) : proc.output_qty_locked ? (
                            <Tooltip label={t("vlAssembly.common.outputQtyFromDailyReport")} hasArrow placement="top">
                              <Text as="span" cursor="default">
                                {(proc.output_qty ?? 0).toLocaleString()}
                              </Text>
                            </Tooltip>
                          ) : (
                            <Text cursor="pointer" _hover={{ textDecoration: "underline" }}
                              onClick={() => setEditingProcQty({ pk: proc.pk, val: String(proc.output_qty ?? ""), totalQty: proc.total_qty })}>
                              {(proc.output_qty ?? 0).toLocaleString()}
                            </Text>
                          )}
                        </Td>
                        <Td isNumeric>{proc.total_qty != null ? proc.total_qty.toLocaleString() : "—"}</Td>
                        <Td isNumeric>{proc.cycle_time ?? <Text as="span" color="gray.400">-</Text>}</Td>
                        <Td isNumeric>
                          {proc.target_qty_per_hour != null ? `${proc.target_qty_per_hour} pcs/h` : <Text as="span" color="gray.400">-</Text>}
                        </Td>
                        <Td isNumeric>
                          {proc.daily_target_qty_8h != null
                            ? `${proc.daily_target_qty_8h} pcs`
                            : <Text as="span" color="gray.400">-</Text>}
                        </Td>
                        <Td whiteSpace="nowrap">
                          <EditableDateText value={proc.process_start_date} field="process_start_date" procPk={proc.pk} />
                        </Td>
                        <Td whiteSpace="nowrap">
                          <EditableDateText value={proc.process_finish_date} field="process_finish_date" procPk={proc.pk} />
                        </Td>
                        <Td isNumeric>{proc.process_lead_time_days != null ? `${proc.process_lead_time_days}d` : <Text as="span" color="gray.400">—</Text>}</Td>
                        <Td>
                          <Select size="xs" value={proc.status ?? "not_started"} w="110px"
                            isDisabled={savingProcStatus === proc.pk}
                            onChange={(e) => saveProcStatus(proc.pk, e.target.value)}>
                            {STATUS_OPTIONS.map((opt) => (
                              <option key={opt.value} value={opt.value} style={statusOptionStyle(opt.value)}>
                                {opt.label}
                              </option>
                            ))}
                          </Select>
                        </Td>
                      </Tr>
                    ))}
                  </Tbody>
                </Table>
              </TableContainer>
            )}
          </Box>

          {!data.is_deleted && dailyOutputQrDataUrl && (
            <Box
              bg={cardBg}
              borderRadius="xl"
              border="1px solid"
              borderColor={borderColor}
              p={6}
              shadow="sm"
              mt={6}
            >
              <Text fontWeight="semibold" mb={1}>
                {t("vlAssembly.processDetail.dailyOutputQr")}
              </Text>
              <Text fontSize="sm" color="gray.600" mb={3}>
                {t("vlAssembly.processDetail.dailyOutputQrHint")}
              </Text>
              <Flex
                align="flex-start"
                direction={{ base: "column", sm: "row" }}
                gap={4}
                flexWrap="wrap"
              >
                <Box
                  flexShrink={0}
                  bg="white"
                  p={2}
                  borderRadius="lg"
                  border="2px solid"
                  borderColor={dailyOutputQrFrameBorder}
                  boxShadow="sm"
                >
                  <Box
                    as="img"
                    src={dailyOutputQrDataUrl}
                    alt=""
                    w={{ base: "96px", md: "104px" }}
                    h={{ base: "96px", md: "104px" }}
                    display="block"
                    borderRadius="md"
                  />
                </Box>
                <Box flex="1" minW={{ base: "0", sm: "200px" }} w="100%">
                  <HStack spacing={2} flexWrap="wrap" align="stretch">
                    <Button
                      size="sm"
                      leftIcon={<FaCopy />}
                      variant="outline"
                      flex={{ base: "1", sm: "0 1 auto" }}
                      minW={{ base: "120px", sm: "auto" }}
                      onClick={copyModuleDailyOutputLink}
                    >
                      {t("vlAssembly.processDetail.copyDailyOutputLink")}
                    </Button>
                    <Button
                      as={RouterLink}
                      to={moduleDailyOutputPath}
                      size="sm"
                      colorScheme="blue"
                      flex={{ base: "1", sm: "0 1 auto" }}
                      minW={{ base: "120px", sm: "auto" }}
                    >
                      {t("vlAssembly.processDetail.enterQuantityButton")}
                    </Button>
                  </HStack>
                  <Text fontSize="xs" color="gray.500" mt={2} wordBreak="break-all">
                    {moduleDailyOutputUrl}
                  </Text>
                </Box>
              </Flex>
            </Box>
          )}

          {!data.is_deleted && <EpInspectionEntryQr targetParam="vl_assembly_module" pk={pk} variant="card" />}
        </Box>
      </Box>

      {/* Delete confirmation dialog */}
      <AlertDialog isOpen={isDeleteOpen} leastDestructiveRef={cancelRef} onClose={onDeleteClose}>
        <AlertDialogOverlay>
          <AlertDialogContent>
            <AlertDialogHeader>{t("vlAssembly.common.deleteTitle")}</AlertDialogHeader>
            <AlertDialogBody>{t("vlAssembly.common.deleteModuleConfirm")}</AlertDialogBody>
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
            <AlertDialogBody>{t("vlAssembly.common.syncFromSourceConfirmBodyModule")}</AlertDialogBody>
            <AlertDialogFooter>
              <Button ref={syncCancelRef} onClick={onSyncClose}>{t("vlAssembly.common.cancel")}</Button>
              <Button colorScheme="teal" onClick={confirmSync} isLoading={syncing} ml={3}>
                {t("vlAssembly.common.syncConfirm")}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>
    </>
  );
}
