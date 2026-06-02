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
import { FaArrowLeft, FaExternalLinkAlt, FaSync, FaTrash } from "react-icons/fa";
import {
  getEpModuleDetail, patchEpModule, patchEpProcess,
  deleteEpModule, syncEpModuleFromSource,
  IEpModuleDetail,
} from "../api";
import React, { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import EpInspectionEntryQr from "../components/EpInspectionEntryQr";
import { EpBadge, EpOriginalReferenceBadges } from "../components/EpBadge";
import { statusOptionStyle } from "../components/StatusBadge";
import LocalizedDateInput from "../components/LocalizedDateInput";
import { formatIsoDateDisplay } from "../lib/dateLocale";

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

export default function EpModuleDetail() {
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
  const tableBg = useColorModeValue("gray.50", "gray.800");

  // Module-level editing state
  const [editingModuleField, setEditingModuleField] = useState<{ field: DateField; val: string } | null>(null);
  const [editingModuleQty, setEditingModuleQty] = useState<{ val: string } | null>(null);
  const [editingModuleText, setEditingModuleText] = useState<{ field: string; val: string } | null>(null);
  const [savingModuleStatus, setSavingModuleStatus] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Process-level editing state (one cell at a time)
  const [editingProcDate, setEditingProcDate] = useState<{ pk: number; field: DateField; val: string } | null>(null);
  const [editingProcQty, setEditingProcQty] = useState<{ pk: number; val: string; totalQty?: number | null } | null>(null);
  const [savingProcStatus, setSavingProcStatus] = useState<number | null>(null);

  const { data, isLoading } = useQuery<IEpModuleDetail>({
    queryKey: ["epModuleDetail", pk],
    queryFn: () => getEpModuleDetail(pk),
    enabled: !!pk,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["epModuleDetail", pk] });
    queryClient.invalidateQueries({ queryKey: ["epSchedules"] });
    queryClient.invalidateQueries({ queryKey: ["epProcessDetail"] });
  };

  const saveModuleQty = async (val: string, totalQty?: number | null) => {
    const qty = val === "" ? 0 : parseInt(val, 10);
    if (val !== "" && isNaN(qty)) { setEditingModuleQty(null); return; }
    if (totalQty != null && qty > totalQty) {
      toast({ title: t("ep.common.outputExceedsTotal", { total: totalQty?.toLocaleString() }), status: "warning", duration: 2500, position: "bottom-right" });
      setEditingModuleQty(null);
      return;
    }
    try {
      await patchEpModule(pk, { output_qty: qty });
      invalidate();
    } catch {
      toast({ title: t("ep.common.failedSave"), status: "error", duration: 2000, position: "bottom-right" });
    }
    setEditingModuleQty(null);
  };

  const saveModuleDate = async (field: DateField, val: string) => {
    try {
      await patchEpModule(pk, { [field]: val || null } as any);
      invalidate();
    } catch {
      toast({ title: t("ep.common.failedSave"), status: "error", duration: 2000, position: "bottom-right" });
    }
    setEditingModuleField(null);
  };

  const saveModuleStatus = async (val: string) => {
    setSavingModuleStatus(true);
    try {
      await patchEpModule(pk, { status: val });
      invalidate();
    } catch {
      toast({ title: t("ep.common.failedSave"), status: "error", duration: 2000, position: "bottom-right" });
    }
    setSavingModuleStatus(false);
  };

  const saveModuleText = async (field: string, val: string) => {
    try {
      await patchEpModule(pk, { [field]: val } as any);
      invalidate();
    } catch {
      toast({ title: t("ep.common.failedSave"), status: "error", duration: 2000, position: "bottom-right" });
    }
    setEditingModuleText(null);
  };

  const saveProcDate = async (procPk: number, field: DateField, val: string) => {
    try {
      await patchEpProcess(procPk, { [field]: val || null } as any);
      invalidate();
    } catch {
      toast({ title: t("ep.common.failedSave"), status: "error", duration: 2000, position: "bottom-right" });
    }
    setEditingProcDate(null);
  };

  const saveProcQty = async (procPk: number, val: string, totalQty?: number | null) => {
    const qty = val === "" ? 0 : parseInt(val, 10);
    if (val !== "" && isNaN(qty)) { setEditingProcQty(null); return; }
    if (totalQty != null && qty > totalQty) {
      toast({ title: t("ep.common.outputExceedsTotal", { total: totalQty?.toLocaleString() }), status: "warning", duration: 2500, position: "bottom-right" });
      setEditingProcQty(null);
      return;
    }
    try {
      await patchEpProcess(procPk, { output_qty: qty });
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
    setEditingProcQty(null);
  };

  const saveProcStatus = async (procPk: number, val: string) => {
    setSavingProcStatus(procPk);
    try {
      await patchEpProcess(procPk, { status: val });
      invalidate();
    } catch {
      toast({ title: t("ep.common.failedSave"), status: "error", duration: 2000, position: "bottom-right" });
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
      const res = await syncEpModuleFromSource(pk, resetFields);
      invalidate();
      queryClient.invalidateQueries({ queryKey: ["epSjNoDetail", res.ep_sj_no_pk] });
      const parts: string[] = [];
      if (res.updated_fields.length) {
        parts.push(t("ep.common.syncFields", { fields: res.updated_fields.join(", ") }));
      }
      if (res.processes_sync && (res.processes_sync.created || res.processes_sync.updated || res.processes_sync.deleted || res.processes_sync.reactivated)) {
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
      await deleteEpModule(pk);
      toast({ title: t("ep.common.deleted"), status: "success", duration: 2000, position: "bottom-right" });
      navigate(-1);
    } catch {
      toast({ title: t("ep.common.failedDelete"), status: "error", duration: 2000, position: "bottom-right" });
    }
    setDeleting(false);
    onDeleteClose();
  };

  if (isLoading) return <Center minH="60vh"><Spinner size="xl" /></Center>;
  if (!data) return <Center minH="60vh"><Text color="gray.400">{t("ep.moduleDetail.notFound")}</Text></Center>;

  const overrideFields = data.override_fields ?? [];

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
      <Helmet><title>{`${data.code} — ${t("ep.moduleDetail.pageTitle")}`}</title></Helmet>
      <Box bg={pageBg} minH="100vh" px={{ base: 4, md: 8, lg: 12 }} py={{ base: 6, md: 8 }}>
        <Box maxW="5xl" mx="auto">
          <HStack mb={4} justify={isPopupWindow ? "flex-end" : "space-between"} w="full">
            {!isPopupWindow && (
              <Button leftIcon={<FaArrowLeft />} variant="ghost" size="sm" onClick={() => navigate(-1)}>{t("ep.common.back")}</Button>
            )}
            <HStack spacing={2}>
              {data.source_module_info && (
                <Button leftIcon={<FaSync />} size="sm" variant="outline" colorScheme="teal"
                  isLoading={syncing} onClick={() => openSyncConfirm("full")}>
                  {t("ep.common.syncFromSource")}
                </Button>
              )}
              {!data.is_deleted && (
                <Button leftIcon={<FaTrash />} size="sm" colorScheme="red" variant="outline" onClick={onDeleteOpen}>
                  {t("ep.common.delete")}
                </Button>
              )}
            </HStack>
          </HStack>

          {data.is_deleted && (
            <Box mb={4} p={3} borderRadius="md" bg="red.50" border="1px solid" borderColor="red.200">
              <Text color="red.600" fontSize="sm" fontWeight="semibold">
                {t("ep.common.deletedRecord")} {data.deleted_at ? `(${data.deleted_at.slice(0, 10)})` : ""}
              </Text>
            </Box>
          )}

          {/* 기본 정보 카드 */}
          <Box bg={cardBg} borderRadius="xl" border="1px solid" borderColor={borderColor} p={6} shadow="sm" mb={6}>
            <HStack align="baseline" spacing={3} mb={5} flexWrap="wrap">
              <EpBadge kind="epModule" fontSize="sm" />
              <Heading size="md">{data.code}</Heading>
              {data.name && <Text fontSize="lg" color="gray.500">{data.name}</Text>}
            </HStack>

            <HStack spacing={8} flexWrap="wrap" align="flex-start">
              <InfoRow label={t("ep.moduleDetail.codeName")} labelColor={labelColor}
                fieldName="code" overrideFields={overrideFields} onReset={(f) => openSyncConfirm([f])}>
                <EditableTextField field="code" value={data.code} />
              </InfoRow>
              <InfoRow label={t("ep.moduleDetail.name")} labelColor={labelColor}
                fieldName="name" overrideFields={overrideFields} onReset={(f) => openSyncConfirm([f])}>
                <EditableTextField field="name" value={data.name} />
              </InfoRow>
              <InfoRow label={t("ep.moduleDetail.totalQty")} labelColor={labelColor}>
                <Text fontSize="sm">{data.total_qty != null ? data.total_qty.toLocaleString() : "—"}</Text>
              </InfoRow>
              <InfoRow label={t("ep.moduleDetail.outputQty")} labelColor={labelColor}>
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
              <InfoRow label={t("ep.moduleDetail.balance")} labelColor={labelColor}>
                <Text fontSize="sm">
                  {data.total_qty != null ? Math.max(0, data.total_qty - (data.output_qty ?? 0)).toLocaleString() : "—"}
                </Text>
              </InfoRow>
              <InfoRow label={t("ep.moduleDetail.status")} labelColor={labelColor}>
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
              <InfoRow label={t("ep.moduleDetail.processStart")} labelColor={labelColor}>
                <EditableDateText value={data.process_start_date} field="process_start_date" isModule />
              </InfoRow>
              <InfoRow label={t("ep.moduleDetail.processFinish")} labelColor={labelColor}>
                <EditableDateText value={data.process_finish_date} field="process_finish_date" isModule />
              </InfoRow>
              <InfoRow label={t("ep.moduleDetail.leadTimeDays")} labelColor={labelColor}>
                <Text fontSize="sm">{data.process_lead_time_days != null ? `${data.process_lead_time_days}d` : "—"}</Text>
              </InfoRow>
              <InfoRow label={t("ep.moduleDetail.parentEpSjNo")} labelColor={labelColor}>
                <RouterLink to={`/ep-production/sj-nos/${data.ep_sj_no_pk}`}>
                  <Link as="span" color="blue.500" fontSize="sm">{data.ep_sj_no_sj_no}</Link>
                </RouterLink>
              </InfoRow>
              <InfoRow label={t("ep.moduleDetail.originalModule")} labelColor={labelColor}>
                {data.source_module_info ? (
                  <HStack spacing={2} align="center" flexWrap="wrap">
                    <EpOriginalReferenceBadges category="module" fontSize="xs" />
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

          {/* EP Processes 목록 */}
          <Box bg={cardBg} borderRadius="xl" border="1px solid" borderColor={borderColor} p={6} shadow="sm">
            <Heading size="sm" mb={4}>{t("ep.moduleDetail.epProcesses", { count: data.ep_processes.length })}</Heading>
            <Divider mb={4} />
            {data.ep_processes.length === 0 ? (
              <Text color="gray.400" textAlign="center" py={6}>{t("ep.moduleDetail.noProcesses")}</Text>
            ) : (
              <TableContainer>
                <Table variant="striped" size="sm">
                  <Thead bgColor={tableBg}>
                    <Tr>
                      <Th>#</Th>
                      <Th>{t("ep.moduleDetail.colCode")}</Th>
                      <Th>{t("ep.moduleDetail.colName")}</Th>
                      <Th isNumeric>{t("ep.moduleDetail.colOutputQty")}</Th>
                      <Th isNumeric>{t("ep.moduleDetail.colTotalQty")}</Th>
                      <Th isNumeric>{t("ep.moduleDetail.colCycleTime")}</Th>
                      <Th isNumeric>{t("ep.moduleDetail.colTargetHr")}</Th>
                      <Th whiteSpace="nowrap">{t("ep.moduleDetail.colProcessStart")}</Th>
                      <Th whiteSpace="nowrap">{t("ep.moduleDetail.colProcessFinish")}</Th>
                      <Th isNumeric whiteSpace="nowrap">{t("ep.moduleDetail.colLeadTime")}</Th>
                      <Th>{t("ep.moduleDetail.colStatus")}</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {data.ep_processes.map((proc, idx) => (
                      <Tr key={proc.pk}>
                        <Td>{idx + 1}</Td>
                        <Td fontWeight="semibold" whiteSpace="nowrap">
                          <HStack spacing={2} align="center">
                            <EpBadge kind="epProcess" fontSize="xs" />
                            <RouterLink to={`/ep-production/processes/${proc.pk}`}>
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
                            <Tooltip label={t("ep.common.outputQtyFromDailyReport")} hasArrow placement="top">
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

          {!data.is_deleted && <EpInspectionEntryQr targetParam="ep_module" pk={pk} variant="card" />}
        </Box>
      </Box>

      {/* Delete confirmation dialog */}
      <AlertDialog isOpen={isDeleteOpen} leastDestructiveRef={cancelRef} onClose={onDeleteClose}>
        <AlertDialogOverlay>
          <AlertDialogContent>
            <AlertDialogHeader>{t("ep.common.deleteTitle")}</AlertDialogHeader>
            <AlertDialogBody>{t("ep.common.deleteModuleConfirm")}</AlertDialogBody>
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
            <AlertDialogBody>{t("ep.common.syncFromSourceConfirmBodyModule")}</AlertDialogBody>
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
