import {
  Badge,
  Box,
  Button,
  Center,
  HStack,
  Heading,
  Input,
  Link,
  Select,
  Spinner,
  Text,
  Textarea,
  Tooltip,
  VStack,
  Flex,
  Wrap,
  WrapItem,
  useColorModeValue,
  useDisclosure,
  useToast,
  AlertDialog,
  AlertDialogBody,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogContent,
  AlertDialogOverlay,
  Alert,
  AlertIcon,
} from "@chakra-ui/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Helmet } from "react-helmet";
import { useParams, useNavigate, Link as RouterLink, useSearchParams } from "react-router-dom";
import { FaArrowLeft, FaCopy, FaExternalLinkAlt, FaVideo, FaSync, FaTrash, FaPrint } from "react-icons/fa";
import {
  getEpProcessDetail, patchEpProcess, deleteEpProcess, syncEpProcessFromSource,
  IEpProcessDetail,
  getEpProcessIoTSetup,
} from "../api";
import React, { useEffect, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";
import { useTranslation } from "react-i18next";
import EpInspectionEntryQr from "../components/EpInspectionEntryQr";
import { EpBadge, EpOriginalReferenceBadges } from "../components/EpBadge";
import { statusOptionStyle } from "../components/StatusBadge";
import LocalizedDateInput from "../components/LocalizedDateInput";
import { formatIsoDateDisplay } from "../lib/dateLocale";
import HotColdPressIoTModal from "../components/HotColdPressIoTModal";
import { usePressIoT } from "../hooks/usePressIoT";
import { hotColdPressKeys } from "../lib/queryKeys";

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

export default function EpProcessDetail() {
  const { processId } = useParams<{ processId: string }>();
  const pk = Number(processId);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const qcScan = searchParams.get("qc") === "1";
  const isPopupWindow = searchParams.get("popup") === "1";
  const autoOpenIoT = searchParams.get("iot") === "1";
  const queryClient = useQueryClient();
  const toast = useToast();
  const { t, i18n } = useTranslation();
  const { isOpen: isDeleteOpen, onOpen: onDeleteOpen, onClose: onDeleteClose } = useDisclosure();
  const { isOpen: isSyncOpen, onOpen: onSyncOpen, onClose: onSyncClose } = useDisclosure();
  const { isOpen: isIoTOpen, onOpen: onIoTOpen, onClose: onIoTClose } = useDisclosure();
  // MQTT connection lives here (not inside modal) so it persists across modal open/close
  const [iotActiveId, setIotActiveId] = useState<string | undefined>(undefined);
  const pressIoT = usePressIoT(iotActiveId);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const syncCancelRef = useRef<HTMLButtonElement>(null);
  const pendingSyncRef = useRef<"full" | string[] | null>(null);

  const STATUS_OPTIONS = [
    { value: "not_started", label: t("ep.status.not_started") },
    { value: "outsourced",  label: t("ep.status.outsourced") },
    { value: "in_progress", label: t("ep.status.in_progress") },
    { value: "completed",   label: t("ep.status.completed") },
    { value: "not_ready",   label: t("ep.status.not_ready") },
  ];

  const cardBg = useColorModeValue("white", "gray.800");
  const pageBg = useColorModeValue("gray.50", "gray.900");
  const borderColor = useColorModeValue("gray.200", "gray.600");
  const labelColor = useColorModeValue("gray.500", "gray.400");

  const [editingDate, setEditingDate] = useState<{ field: DateField; val: string } | null>(null);
  const [editingQty, setEditingQty] = useState<{ val: string } | null>(null);
  const [editingText, setEditingText] = useState<{ field: string; val: string } | null>(null);
  const [savingStatus, setSavingStatus] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [standardWorkVideoQrDataUrl, setStandardWorkVideoQrDataUrl] = useState("");

  const dailyOutputUrl = useMemo(
    () =>
      typeof window !== "undefined"
        ? `${window.location.origin}/ep-production/daily-outputs?ep_process=${pk}`
        : "",
    [pk]
  );

  const { data, isLoading } = useQuery<IEpProcessDetail>({
    queryKey: ["epProcessDetail", pk],
    queryFn: () => getEpProcessDetail(pk),
    enabled: !!pk,
  });

  // IoT 연결 상태 — 10초마다 폴링
  const { data: iotSetup } = useQuery({
    queryKey: hotColdPressKeys.setup(pk),
    queryFn: () => getEpProcessIoTSetup(pk),
    enabled: !!pk,
    refetchInterval: 10_000,
  });
  const iotConnected = iotSetup?.is_connected ?? false;
  const iotConfigured = iotSetup !== null && iotSetup !== undefined;

  useEffect(() => {
    if (autoOpenIoT) onIoTOpen();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoOpenIoT]);

  useEffect(() => {
    if (!pk || isLoading || !data || data.is_deleted || !dailyOutputUrl) {
      setQrDataUrl("");
      return;
    }
    let cancelled = false;
    QRCode.toDataURL(dailyOutputUrl, { margin: 1, width: 104 })
      .then((url) => {
        if (!cancelled) setQrDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setQrDataUrl("");
      });
    return () => {
      cancelled = true;
    };
  }, [pk, dailyOutputUrl, isLoading, data]);

  const standardWorkVideoUrl = (data?.standard_work_video_url ?? "").trim();

  useEffect(() => {
    if (!standardWorkVideoUrl) {
      setStandardWorkVideoQrDataUrl("");
      return;
    }
    let cancelled = false;
    QRCode.toDataURL(standardWorkVideoUrl, { margin: 1, width: 96 })
      .then((url) => {
        if (!cancelled) setStandardWorkVideoQrDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setStandardWorkVideoQrDataUrl("");
      });
    return () => {
      cancelled = true;
    };
  }, [standardWorkVideoUrl]);

  const invalidate = (modulePk?: number) => {
    queryClient.invalidateQueries({ queryKey: ["epProcessDetail", pk] });
    queryClient.invalidateQueries({ queryKey: ["epSchedules"] });
    if (modulePk != null) {
      queryClient.invalidateQueries({ queryKey: ["epModuleDetail", modulePk] });
    }
  };

  const saveDate = async (field: DateField, val: string) => {
    try {
      await patchEpProcess(pk, { [field]: val || null } as any);
      invalidate();
    } catch {
      toast({ title: t("ep.common.failedSave"), status: "error", duration: 2000, position: "bottom-right" });
    }
    setEditingDate(null);
  };

  const saveQty = async (val: string, totalQty?: number | null) => {
    const qty = val === "" ? 0 : parseInt(val, 10);
    if (val !== "" && isNaN(qty)) { setEditingQty(null); return; }
    if (totalQty != null && qty > totalQty) {
      toast({ title: t("ep.common.outputExceedsTotal", { total: totalQty?.toLocaleString() }), status: "warning", duration: 2500, position: "bottom-right" });
      setEditingQty(null); return;
    }
    try {
      await patchEpProcess(pk, { output_qty: qty });
      invalidate();
    } catch (e: unknown) {
      const ax = e as { response?: { data?: { output_qty?: string | string[] } } };
      const raw = ax?.response?.data?.output_qty;
      const msg = Array.isArray(raw) ? raw[0] : raw;
      toast({
        title: msg || t("ep.common.failedSave"),
        status: "error",
        duration: 4000,
        position: "bottom-right",
      });
    }
    setEditingQty(null);
  };

  const saveStatus = async (val: string) => {
    setSavingStatus(true);
    try { await patchEpProcess(pk, { status: val }); invalidate(); }
    catch { toast({ title: t("ep.common.failedSave"), status: "error", duration: 2000, position: "bottom-right" }); }
    setSavingStatus(false);
  };

  const saveText = async (field: string, val: string) => {
    try {
      await patchEpProcess(pk, { [field]: val } as any);
      invalidate();
    } catch {
      toast({ title: t("ep.common.failedSave"), status: "error", duration: 2000, position: "bottom-right" });
    }
    setEditingText(null);
  };

  const openSyncConfirm = (mode: "full" | string[]) => {
    pendingSyncRef.current = mode;
    onSyncOpen();
  };

  const handleSync = async (resetFields?: string[]) => {
    setSyncing(true);
    try {
      const res = await syncEpProcessFromSource(pk, resetFields);
      invalidate(res.ep_module_pk);
      queryClient.invalidateQueries({ queryKey: ["epSjNoDetail", res.ep_sj_no_pk] });
      const parts: string[] = [];
      if (res.updated_fields.length) {
        parts.push(t("ep.common.syncFields", { fields: res.updated_fields.join(", ") }));
      }
      if (res.synced_via_parent_module) {
        parts.push(t("ep.common.syncParentModuleNote"));
      }
      toast({
        title: t("ep.common.syncDone"),
        description: parts.length ? parts.join(" ") : t("ep.common.syncNoChanges"),
        status: "success", duration: 4000, position: "bottom-right",
      });
    } catch {
      toast({ title: t("ep.common.syncFailed"), status: "error", duration: 2000, position: "bottom-right" });
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
      await deleteEpProcess(pk);
      toast({ title: t("ep.common.deleted"), status: "success", duration: 2000, position: "bottom-right" });
      navigate(-1);
    } catch {
      toast({ title: t("ep.common.failedDelete"), status: "error", duration: 2000, position: "bottom-right" });
    }
    setDeleting(false);
    onDeleteClose();
  };

  const copyDailyOutputLink = async () => {
    try {
      await navigator.clipboard.writeText(dailyOutputUrl);
      toast({
        title: t("ep.processDetail.dailyOutputLinkCopied"),
        status: "success",
        duration: 2000,
        position: "bottom-right",
      });
    } catch {
      toast({
        title: t("ep.processDetail.dailyOutputLinkCopyFailed"),
        status: "error",
        duration: 2000,
        position: "bottom-right",
      });
    }
  };

  const copyStandardWorkVideoUrl = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast({
        title: t("ep.processDetail.videoLinkCopied"),
        status: "success",
        duration: 2000,
        position: "bottom-right",
      });
    } catch {
      toast({
        title: t("ep.processDetail.videoLinkCopyFailed"),
        status: "error",
        duration: 2000,
        position: "bottom-right",
      });
    }
  };

  if (isLoading) return <Center minH="60vh"><Spinner size="xl" /></Center>;
  if (!data) return <Center minH="60vh"><Text color="gray.400">{t("ep.processDetail.notFound")}</Text></Center>;

  const overrideFields = data.override_fields ?? [];

  const EditableDateText = ({ value, field }: { value?: string | null; field: DateField }) => {
    const isEditing = editingDate?.field === field;
    if (isEditing) {
      return (
        <LocalizedDateInput
          compact
          size="xs"
          w="140px"
          value={editingDate.val}
          onChange={(v) => setEditingDate({ field, val: v })}
          onCommit={(iso) => saveDate(field, iso)}
          onCancel={() => setEditingDate(null)}
          autoFocus
          allowClear={false}
        />
      );
    }
    return (
      <Text fontSize="sm" cursor="pointer" color={value ? undefined : "gray.400"}
        _hover={{ textDecoration: "underline" }}
        onClick={() => setEditingDate({ field, val: value ?? "" })}>
        {value ? formatIsoDateDisplay(value, i18n.language) : "—"}
      </Text>
    );
  };

  // Inline text field (single-line)
  const EditableTextField = ({ field, value, multiline = false }: { field: string; value?: string | null; multiline?: boolean }) => {
    const isEditing = editingText?.field === field;
    if (isEditing) {
      if (multiline) {
        return (
          <Textarea size="xs" value={editingText.val} autoFocus rows={3}
            onChange={(e) => setEditingText({ field, val: e.target.value })}
            onBlur={() => saveText(field, editingText.val)}
            onKeyDown={(e) => { if (e.key === "Escape") setEditingText(null); }}
          />
        );
      }
      return (
        <Input size="xs" value={editingText.val} autoFocus
          onChange={(e) => setEditingText({ field, val: e.target.value })}
          onBlur={() => saveText(field, editingText.val)}
          onKeyDown={(e) => {
            if (e.key === "Enter") saveText(field, editingText.val);
            if (e.key === "Escape") setEditingText(null);
          }}
        />
      );
    }
    return (
      <Text fontSize="sm" cursor="pointer" color={value ? undefined : "gray.400"}
        _hover={{ textDecoration: "underline" }} whiteSpace="pre-wrap"
        onClick={() => setEditingText({ field, val: value ?? "" })}>
        {value || "—"}
      </Text>
    );
  };

  return (
    <>
      <Helmet><title>{`${data.code} — ${t("ep.processDetail.pageTitle")}`}</title></Helmet>
      <Box bg={pageBg} minH="100vh" px={{ base: 3, md: 8, lg: 12 }} py={{ base: 4, md: 8 }}>
        <Box maxW="3xl" mx="auto">
          <Flex
            mb={4}
            direction={{ base: "column", md: "row" }}
            gap={{ base: 3, md: 0 }}
            align={{ base: "stretch", md: "center" }}
            justify={isPopupWindow ? "flex-end" : "space-between"}
          >
            {!isPopupWindow && (
              <Button
                leftIcon={<FaArrowLeft />}
                variant="ghost"
                size="sm"
                alignSelf={{ base: "flex-start", md: "center" }}
                onClick={() => navigate(-1)}
              >
                {t("ep.common.back")}
              </Button>
            )}
            <Wrap spacing={2} justify={{ base: "flex-start", md: "flex-end" }} w={{ base: "100%", md: "auto" }}>
              {/* IoT 모니터링 버튼 */}
              {!data.is_deleted && (
                <WrapItem>
                  <Tooltip
                    label={
                      !iotConfigured
                        ? "IoT 설정 필요 — 클릭하여 설정"
                        : iotConnected
                        ? "기계 연결됨 — 클릭하여 모니터링"
                        : "기계 연결 안 됨 — 클릭하여 확인"
                    }
                    placement="bottom"
                    hasArrow
                  >
                    <Button
                      size="sm"
                      variant="outline"
                      colorScheme={iotConnected ? "green" : "gray"}
                      w={{ base: "100%", sm: "auto" }}
                      onClick={onIoTOpen}
                      leftIcon={
                        <Box
                          w="8px"
                          h="8px"
                          borderRadius="full"
                          bg={iotConnected ? "green.400" : iotConfigured ? "gray.400" : "orange.300"}
                          flexShrink={0}
                          boxShadow={iotConnected ? "0 0 5px 1px var(--chakra-colors-green-300)" : "none"}
                        />
                      }
                    >
                      Hot/Cold IoT
                    </Button>
                  </Tooltip>
                </WrapItem>
              )}
              {!data.is_deleted && (
                <WrapItem>
                  <Button
                    leftIcon={<FaPrint />}
                    size="sm"
                    variant="solid"
                    colorScheme="blue"
                    w={{ base: "100%", sm: "auto" }}
                    onClick={() => navigate(`/ep-production/processes/${pk}/work-order?popup=1`)}
                  >
                    {t("ep.processDetail.productionWorkOrder")}
                  </Button>
                </WrapItem>
              )}
              {data.source_process_info && (
                <WrapItem>
                  <Button
                    leftIcon={<FaSync />}
                    size="sm"
                    variant="outline"
                    colorScheme="teal"
                    isLoading={syncing}
                    w={{ base: "100%", sm: "auto" }}
                    onClick={() => openSyncConfirm("full")}
                  >
                    {t("ep.common.syncFromSource")}
                  </Button>
                </WrapItem>
              )}
              {!data.is_deleted && (
                <WrapItem>
                  <Button
                    leftIcon={<FaTrash />}
                    size="sm"
                    colorScheme="red"
                    variant="outline"
                    w={{ base: "100%", sm: "auto" }}
                    onClick={onDeleteOpen}
                  >
                    {t("ep.common.delete")}
                  </Button>
                </WrapItem>
              )}
            </Wrap>
          </Flex>

          {qcScan && (
            <Alert
              status="info"
              variant="left-accent"
              borderRadius="md"
              mb={4}
              fontSize="sm"
              borderColor="purple.300"
              bg="purple.50"
              color="purple.900"
            >
              <AlertIcon color="purple.600" />
              {t("ep.processDetail.qcScanBanner")}
            </Alert>
          )}

          {data.is_deleted && (
            <Box mb={4} p={3} borderRadius="md" bg="red.50" border="1px solid" borderColor="red.200">
              <Text color="red.600" fontSize="sm" fontWeight="semibold">
                {t("ep.common.deletedRecord")} {data.deleted_at ? `(${data.deleted_at.slice(0, 10)})` : ""}
              </Text>
            </Box>
          )}

          <Box bg={cardBg} borderRadius="xl" border="1px solid" borderColor={borderColor} p={{ base: 4, md: 6 }} shadow="sm">
            <Flex
              direction={{ base: "column", sm: "row" }}
              align={{ base: "flex-start", sm: "baseline" }}
              gap={{ base: 2, sm: 3 }}
              mb={6}
              flexWrap="wrap"
            >
              <EpBadge kind="epProcess" fontSize="sm" />
              <Heading size="md" wordBreak="break-word">
                {data.code}
              </Heading>
              {data.name && (
                <Text fontSize={{ base: "md", md: "lg" }} color="gray.500" wordBreak="break-word">
                  {data.name}
                </Text>
              )}
            </Flex>

            <Box display="grid" gridTemplateColumns="repeat(auto-fill, minmax(160px, 1fr))" gap={5}>
              <InfoRow label={t("ep.processDetail.totalQty")} labelColor={labelColor}>
                <Text fontSize="sm">{data.total_qty != null ? data.total_qty.toLocaleString() : "—"}</Text>
              </InfoRow>
              <InfoRow label={t("ep.processDetail.outputQty")} labelColor={labelColor}>
                {data.output_qty_locked ? (
                  <Tooltip label={t("ep.common.outputQtyFromDailyReport")} hasArrow placement="top">
                    <Box>
                      <Text fontSize="sm" cursor="default">
                        {(data.output_qty ?? 0).toLocaleString()}
                      </Text>
                    </Box>
                  </Tooltip>
                ) : editingQty ? (
                  <Input size="xs" w="100px" type="number" min={0} max={data.total_qty ?? undefined}
                    value={editingQty.val} autoFocus
                    onChange={(e) => {
                      const raw = e.target.value;
                      if (raw === "") { setEditingQty({ val: "" }); return; }
                      const n = parseInt(raw, 10);
                      if (!isNaN(n) && data.total_qty != null && n > data.total_qty) return;
                      setEditingQty({ val: raw });
                    }}
                    onBlur={() => saveQty(editingQty.val, data.total_qty)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") saveQty(editingQty.val, data.total_qty);
                      if (e.key === "Escape") setEditingQty(null);
                    }}
                  />
                ) : (
                  <Text fontSize="sm" cursor="pointer" _hover={{ textDecoration: "underline" }}
                    onClick={() => setEditingQty({ val: String(data.output_qty ?? "") })}>
                    {(data.output_qty ?? 0).toLocaleString()}
                  </Text>
                )}
              </InfoRow>
              <InfoRow label={t("ep.processDetail.balance")} labelColor={labelColor}>
                <Text fontSize="sm">
                  {data.total_qty != null ? Math.max(0, data.total_qty - (data.output_qty ?? 0)).toLocaleString() : "—"}
                </Text>
              </InfoRow>
              <InfoRow label={t("ep.processDetail.status")} labelColor={labelColor}>
                <Select size="xs" value={data.status ?? "not_started"} w="120px"
                  isDisabled={savingStatus}
                  onChange={(e) => saveStatus(e.target.value)}>
                  {STATUS_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value} style={statusOptionStyle(opt.value)}>
                      {opt.label}
                    </option>
                  ))}
                </Select>
              </InfoRow>
              <InfoRow label={t("ep.processDetail.processStart")} labelColor={labelColor}>
                <EditableDateText value={data.process_start_date} field="process_start_date" />
              </InfoRow>
              <InfoRow label={t("ep.processDetail.processFinish")} labelColor={labelColor}>
                <EditableDateText value={data.process_finish_date} field="process_finish_date" />
              </InfoRow>
              <InfoRow label={t("ep.processDetail.leadTimeDays")} labelColor={labelColor}>
                <Text fontSize="sm">{data.process_lead_time_days != null ? `${data.process_lead_time_days}d` : "—"}</Text>
              </InfoRow>
              <InfoRow label={t("ep.processDetail.cycleTime")} labelColor={labelColor}
                fieldName="cycle_time" overrideFields={overrideFields} onReset={(f) => openSyncConfirm([f])}>
                <EditableTextField field="cycle_time" value={data.cycle_time} />
              </InfoRow>
              <InfoRow label={t("ep.processDetail.targetPerHour")} labelColor={labelColor}>
                <Text fontSize="sm">{data.target_qty_per_hour != null ? `${data.target_qty_per_hour} pcs/h` : "—"}</Text>
              </InfoRow>
              <InfoRow label={t("ep.processDetail.dailyTarget")} labelColor={labelColor}>
                <Text fontSize="sm">{data.daily_target_qty_8h != null ? `${data.daily_target_qty_8h} pcs` : "—"}</Text>
              </InfoRow>
              <InfoRow label={t("ep.processDetail.machine")} labelColor={labelColor}>
                <Text fontSize="sm">{data.machine_name ?? "—"}</Text>
              </InfoRow>
              <InfoRow label={t("ep.processDetail.parentEpModule")} labelColor={labelColor}>
                <RouterLink to={`/ep-production/modules/${data.ep_module_pk}`}>
                  <Link as="span" color="blue.500" fontSize="sm">{data.ep_module_code}</Link>
                </RouterLink>
              </InfoRow>
              <InfoRow label={t("ep.processDetail.originalProcess")} labelColor={labelColor}>
                {data.source_process_info ? (
                  <HStack spacing={2} align="center" flexWrap="wrap">
                    <EpOriginalReferenceBadges category="process" fontSize="xs" />
                    <RouterLink to={`/production-process/processes/${data.source_process_info.pk}`}>
                      <HStack spacing={1} as="span">
                        <Link as="span" color="teal.500" fontSize="sm" fontWeight="semibold">
                          {data.source_process_info.code}
                          {data.source_process_info.name ? ` — ${data.source_process_info.name}` : ""}
                        </Link>
                        <FaExternalLinkAlt size={10} color="teal" />
                      </HStack>
                    </RouterLink>
                  </HStack>
                ) : (
                  <Text fontSize="sm" color="gray.400">—</Text>
                )}
              </InfoRow>
              {data.standard_work_video_url && (
                <InfoRow label={t("ep.processDetail.standardWorkVideo")} labelColor={labelColor}
                  fieldName="standard_work_video_url" overrideFields={overrideFields} onReset={(f) => openSyncConfirm([f])}>
                  <VStack align="stretch" spacing={3}>
                    <Link href={data.standard_work_video_url} isExternal>
                      <HStack spacing={1} color="red.400">
                        <FaVideo size={13} />
                        <Text fontSize="sm">{t("ep.processDetail.watch")}</Text>
                        <FaExternalLinkAlt size={10} />
                      </HStack>
                    </Link>
                    {standardWorkVideoQrDataUrl && (
                      <Box>
                        <Text fontSize="sm" fontWeight="semibold" mb={1}>
                          {t("ep.processDetail.standardWorkVideoQr")}
                        </Text>
                        <Text fontSize="xs" color="gray.600" mb={2}>
                          {t("ep.processDetail.standardWorkVideoQrHint")}
                        </Text>
                        <Flex
                          align="flex-start"
                          direction={{ base: "column", sm: "row" }}
                          gap={3}
                          flexWrap="wrap"
                        >
                          <Box
                            as="img"
                            src={standardWorkVideoQrDataUrl}
                            alt=""
                            w={{ base: "88px", md: "96px" }}
                            h={{ base: "88px", md: "96px" }}
                            flexShrink={0}
                            borderRadius="md"
                            border="1px solid"
                            borderColor={borderColor}
                          />
                          <Box flex="1" minW={{ base: "0", sm: "160px" }} w="100%">
                            <Button
                              size="xs"
                              leftIcon={<FaCopy />}
                              variant="outline"
                              w={{ base: "100%", sm: "auto" }}
                              onClick={() => copyStandardWorkVideoUrl(standardWorkVideoUrl)}
                            >
                              {t("ep.processDetail.copyVideoLink")}
                            </Button>
                            <Text fontSize="xs" color="gray.500" mt={2} wordBreak="break-all">
                              {standardWorkVideoUrl}
                            </Text>
                          </Box>
                        </Flex>
                      </Box>
                    )}
                  </VStack>
                </InfoRow>
              )}
            </Box>

            <Box mt={6} pt={5} borderTop="1px solid" borderColor={borderColor}>
              <Box display="grid" gridTemplateColumns="repeat(auto-fill, minmax(200px, 1fr))" gap={4}>
                <InfoRow label={t("ep.processDetail.nameKo")} labelColor={labelColor}
                  fieldName="name_ko" overrideFields={overrideFields} onReset={(f) => openSyncConfirm([f])}>
                  <EditableTextField field="name_ko" value={data.name_ko} />
                </InfoRow>
                <InfoRow label={t("ep.processDetail.nameEn")} labelColor={labelColor}
                  fieldName="name_en" overrideFields={overrideFields} onReset={(f) => openSyncConfirm([f])}>
                  <EditableTextField field="name_en" value={data.name_en} />
                </InfoRow>
                <InfoRow label={t("ep.processDetail.codeName")} labelColor={labelColor}
                  fieldName="code" overrideFields={overrideFields} onReset={(f) => openSyncConfirm([f])}>
                  <EditableTextField field="code" value={data.code} />
                </InfoRow>
                <InfoRow label={t("ep.processDetail.description")} labelColor={labelColor}
                  fieldName="description" overrideFields={overrideFields} onReset={(f) => openSyncConfirm([f])}>
                  <EditableTextField field="description" value={data.description} multiline />
                </InfoRow>
                <InfoRow label={t("ep.processDetail.flow")} labelColor={labelColor}
                  fieldName="flow" overrideFields={overrideFields} onReset={(f) => openSyncConfirm([f])}>
                  <EditableTextField field="flow" value={data.flow} multiline />
                </InfoRow>
              </Box>
            </Box>

            {!data.is_deleted && qrDataUrl && (
              <Box mt={6} pt={5} borderTop="1px solid" borderColor={borderColor}>
                <Text fontWeight="semibold" mb={1}>
                  {t("ep.processDetail.dailyOutputQr")}
                </Text>
                <Text fontSize="sm" color="gray.600" mb={3}>
                  {t("ep.processDetail.dailyOutputQrHint")}
                </Text>
                <Flex
                  align="flex-start"
                  direction={{ base: "column", sm: "row" }}
                  gap={4}
                  flexWrap="wrap"
                >
                  <Box
                    as="img"
                    src={qrDataUrl}
                    alt=""
                    w={{ base: "96px", md: "104px" }}
                    h={{ base: "96px", md: "104px" }}
                    flexShrink={0}
                    borderRadius="md"
                    border="1px solid"
                    borderColor={borderColor}
                  />
                  <Box flex="1" minW={{ base: "0", sm: "200px" }} w="100%">
                    <Button
                      size="sm"
                      leftIcon={<FaCopy />}
                      variant="outline"
                      w={{ base: "100%", sm: "auto" }}
                      onClick={copyDailyOutputLink}
                    >
                      {t("ep.processDetail.copyDailyOutputLink")}
                    </Button>
                    <Text fontSize="xs" color="gray.500" mt={2} wordBreak="break-all">
                      {dailyOutputUrl}
                    </Text>
                  </Box>
                </Flex>
              </Box>
            )}

            {!data.is_deleted && <EpInspectionEntryQr targetParam="ep_process" pk={pk} />}
          </Box>
        </Box>
      </Box>

      {/* IoT Monitor Modal */}
      <HotColdPressIoTModal
        isOpen={isIoTOpen}
        onClose={onIoTClose}
        processPk={pk}
        processCode={data.code}
        pressIoT={pressIoT}
        activeIotId={iotActiveId}
        onSetActiveIotId={setIotActiveId}
      />

      {/* Delete confirmation dialog */}
      <AlertDialog isOpen={isDeleteOpen} leastDestructiveRef={cancelRef} onClose={onDeleteClose}>
        <AlertDialogOverlay>
          <AlertDialogContent>
            <AlertDialogHeader>{t("ep.common.deleteTitle")}</AlertDialogHeader>
            <AlertDialogBody>{t("ep.common.deleteProcessConfirm")}</AlertDialogBody>
            <AlertDialogFooter>
              <Button ref={cancelRef} onClick={onDeleteClose}>{t("ep.common.cancel")}</Button>
              <Button colorScheme="red" onClick={handleDelete} isLoading={deleting} ml={3}>
                {t("ep.common.delete")}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>

      <AlertDialog isOpen={isSyncOpen} leastDestructiveRef={syncCancelRef} onClose={onSyncClose}>
        <AlertDialogOverlay>
          <AlertDialogContent>
            <AlertDialogHeader>{t("ep.common.syncFromSourceConfirmTitle")}</AlertDialogHeader>
            <AlertDialogBody>{t("ep.common.syncFromSourceConfirmBodyProcess")}</AlertDialogBody>
            <AlertDialogFooter>
              <Button ref={syncCancelRef} onClick={onSyncClose}>{t("ep.common.cancel")}</Button>
              <Button colorScheme="teal" onClick={confirmSync} isLoading={syncing} ml={3}>
                {t("ep.common.syncConfirm")}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>
    </>
  );
}
