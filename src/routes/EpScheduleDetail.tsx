import {
  Badge,
  Box,
  Button,
  Center,
  Collapse,
  Divider,
  FormControl,
  FormLabel,
  Grid,
  GridItem,
  HStack,
  Heading,
  IconButton,
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
  Tr,
  VStack,
  AlertDialog,
  AlertDialogOverlay,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogBody,
  AlertDialogFooter,
  useColorModeValue,
  useDisclosure,
  useToast,
} from "@chakra-ui/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Helmet } from "react-helmet";
import { useParams, useNavigate, Link as RouterLink, useSearchParams } from "react-router-dom";
import { useRef, useState } from "react";
import { FaChevronDown, FaChevronRight } from "react-icons/fa";
import LocalizedDateInput from "../components/LocalizedDateInput";
import { StatusBadge, statusOptionStyle } from "../components/StatusBadge";
import {
  formatIsoDateDisplay,
  formatIsoDateTimeDisplay,
} from "../lib/dateLocale";
import {
  getEpScheduleDetail,
  editEpSchedule,
  deleteEpSchedule,
  IEpSchedule,
  IEpSjNoCopy,
  IEpModuleCopy,
  IEpProcessCopy,
} from "../api";
import { useTranslation } from "react-i18next";

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  const labelColor = useColorModeValue("gray.500", "gray.400");
  return (
    <GridItem>
      <Text fontSize="xs" color={labelColor} mb={0.5}>{label}</Text>
      <Text fontSize="sm" fontWeight="medium">{value ?? "-"}</Text>
    </GridItem>
  );
}

// ── Process row ────────────────────────────────────────────────────
function ProcessRow({ p, borderColor }: { p: IEpProcessCopy; borderColor: string }) {
  const balance = p.total_qty != null ? Math.max(0, p.total_qty - (p.output_qty ?? 0)) : null;
  return (
    <Tr>
      <Td pl={10}>
        <HStack spacing={1}>
          <Badge colorScheme="teal" fontSize="2xs" px={1}>P</Badge>
          <Link as={RouterLink} to={`/ep-production/processes/${p.pk}`} color="blue.500" fontWeight="semibold" fontSize="sm">
            {p.code}
          </Link>
        </HStack>
      </Td>
      <Td whiteSpace="nowrap" fontSize="sm">{p.name || p.name_ko || "-"}</Td>
      <Td><StatusBadge status={p.status ?? "not_started"} fontSize="xs">{p.status_display}</StatusBadge></Td>
      <Td isNumeric fontSize="sm">{(p.output_qty ?? 0).toLocaleString()}</Td>
      <Td isNumeric fontSize="sm">{p.total_qty != null ? p.total_qty.toLocaleString() : "—"}</Td>
      <Td isNumeric fontSize="sm">{balance != null ? balance.toLocaleString() : "—"}</Td>
      <Td isNumeric fontSize="sm">{p.cycle_time ?? "—"}</Td>
      <Td isNumeric fontSize="sm">{p.target_qty_per_hour != null ? `${p.target_qty_per_hour}` : "—"}</Td>
    </Tr>
  );
}

// ── Module row (expandable) ────────────────────────────────────────
function ModuleRow({
  mod, borderColor, headerBg,
}: {
  mod: IEpModuleCopy; borderColor: string; headerBg: string;
}) {
  const [open, setOpen] = useState(false);
  const balance = mod.total_qty != null ? Math.max(0, mod.total_qty - (mod.output_qty ?? 0)) : null;
  return (
    <>
      <Tr bgColor={headerBg} cursor={mod.ep_processes.length > 0 ? "pointer" : "default"} onClick={() => mod.ep_processes.length > 0 && setOpen((p) => !p)}>
        <Td pl={6}>
          <HStack spacing={1}>
            {mod.ep_processes.length > 0 ? (
              <IconButton aria-label="toggle" icon={open ? <FaChevronDown /> : <FaChevronRight />}
                size="xs" variant="ghost" onClick={(e) => { e.stopPropagation(); setOpen((p) => !p); }} />
            ) : <Box w="24px" />}
            <Badge colorScheme="blue" fontSize="2xs" px={1}>M</Badge>
            <Link as={RouterLink} to={`/ep-production/modules/${mod.pk}`} color="blue.500" fontWeight="semibold" fontSize="sm"
              onClick={(e) => e.stopPropagation()}>
              {mod.code}
            </Link>
          </HStack>
        </Td>
        <Td whiteSpace="nowrap" fontSize="sm">{mod.name || "-"}</Td>
        <Td><StatusBadge status={mod.status ?? "not_started"} fontSize="xs">{mod.status_display}</StatusBadge></Td>
        <Td isNumeric fontSize="sm">{(mod.output_qty ?? 0).toLocaleString()}</Td>
        <Td isNumeric fontSize="sm">{mod.total_qty != null ? mod.total_qty.toLocaleString() : "—"}</Td>
        <Td isNumeric fontSize="sm">{balance != null ? balance.toLocaleString() : "—"}</Td>
        <Td /><Td />
      </Tr>
      {open && mod.ep_processes.map((p) => (
        <ProcessRow key={p.pk} p={p} borderColor={borderColor} />
      ))}
    </>
  );
}

// ── SjNo card (expandable) ─────────────────────────────────────────
function SjNoCard({
  sj, cardBg, borderColor, t,
}: {
  sj: IEpSjNoCopy; cardBg: string; borderColor: string; t: (key: string, opts?: Record<string, unknown>) => string;
}) {
  const [open, setOpen] = useState(false);
  const headerBg = useColorModeValue("blue.50", "blue.900");
  const moduleBg = useColorModeValue("gray.50", "gray.750");
  const balance = sj.total_qty != null ? Math.max(0, sj.total_qty - (sj.output_qty ?? 0)) : null;

  return (
    <Box border="1px solid" borderColor={borderColor} borderRadius="md" overflow="hidden" mb={3}>
      {/* SjNo header */}
      <HStack
        px={4} py={3} bg={headerBg} justify="space-between"
        cursor={sj.ep_modules.length > 0 ? "pointer" : "default"}
        onClick={() => sj.ep_modules.length > 0 && setOpen((p) => !p)}
      >
        <HStack spacing={3} flex={1} minW={0}>
          {sj.ep_modules.length > 0 ? (
            <IconButton aria-label="toggle" icon={open ? <FaChevronDown /> : <FaChevronRight />}
              size="xs" variant="ghost" onClick={(e) => { e.stopPropagation(); setOpen((p) => !p); }} />
          ) : <Box w="24px" />}
          <Badge colorScheme="purple" px={1.5}>S</Badge>
          <Link as={RouterLink} to={`/ep-production/sj-nos/${sj.pk}`} color="purple.500" fontWeight="bold" fontSize="md"
            onClick={(e) => e.stopPropagation()}>
            {sj.sj_no}
          </Link>
          <StatusBadge status={sj.status ?? "not_started"} fontSize="xs">
            {sj.status_display}
          </StatusBadge>
        </HStack>
        <HStack spacing={6} fontSize="sm">
          <Box textAlign="right">
            <Text fontSize="xs" color="gray.500">{t("ep.scheduleDetail.output")}</Text>
            <Text fontWeight="semibold">{(sj.output_qty ?? 0).toLocaleString()}</Text>
          </Box>
          <Box textAlign="right">
            <Text fontSize="xs" color="gray.500">{t("ep.scheduleDetail.total")}</Text>
            <Text fontWeight="semibold">{sj.total_qty != null ? sj.total_qty.toLocaleString() : "—"}</Text>
          </Box>
          <Box textAlign="right">
            <Text fontSize="xs" color="gray.500">{t("ep.scheduleDetail.balance")}</Text>
            <Text fontWeight="semibold">{balance != null ? balance.toLocaleString() : "—"}</Text>
          </Box>
          <Badge variant="outline" colorScheme="blue" fontSize="xs">{sj.ep_modules.length} {t("ep.scheduleDetail.modules")}</Badge>
        </HStack>
      </HStack>

      {/* Modules table */}
      <Collapse in={open}>
        <TableContainer>
          <Table size="sm" variant="simple">
            <Thead>
              <Tr>
                <Th>{t("ep.scheduleDetail.colCode")}</Th>
                <Th>{t("ep.scheduleDetail.colName")}</Th>
                <Th>{t("ep.scheduleDetail.colStatus")}</Th>
                <Th isNumeric>{t("ep.scheduleDetail.colOutputQty")}</Th>
                <Th isNumeric>{t("ep.scheduleDetail.colTotalQty")}</Th>
                <Th isNumeric>{t("ep.scheduleDetail.colBalance")}</Th>
                <Th isNumeric>{t("ep.scheduleDetail.colCycle")}</Th>
                <Th isNumeric>{t("ep.scheduleDetail.colTargetHr")}</Th>
              </Tr>
            </Thead>
            <Tbody>
              {sj.ep_modules.map((mod) => (
                <ModuleRow key={mod.pk} mod={mod} borderColor={borderColor} headerBg={moduleBg} />
              ))}
            </Tbody>
          </Table>
        </TableContainer>
      </Collapse>
    </Box>
  );
}

// ── Main Component ─────────────────────────────────────────────────
export default function EpScheduleDetail() {
  const { scheduleId } = useParams<{ scheduleId: string }>();
  const pk = Number(scheduleId);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isPopupWindow = searchParams.get("popup") === "1";
  const toast = useToast();
  const queryClient = useQueryClient();
  const { t, i18n } = useTranslation();
  const fmtDate = (d?: string | null) => formatIsoDateDisplay(d, i18n.language);
  const fmtDateTime = (d?: string | null) => formatIsoDateTimeDisplay(d, i18n.language);

  const STATUS_OPTIONS = [
    { value: "not_started", label: t("ep.status.not_started") },
    { value: "outsourced", label: t("ep.status.outsourced") },
    { value: "in_progress", label: t("ep.status.in_progress") },
    { value: "completed", label: t("ep.status.completed") },
    { value: "not_ready", label: t("ep.status.not_ready") },
  ];

  const cardBg = useColorModeValue("white", "gray.800");
  const pageBg = useColorModeValue("gray.50", "gray.900");
  const borderColor = useColorModeValue("gray.200", "gray.700");

  const [isEdit, setIsEdit] = useState(false);
  const [form, setForm] = useState<Partial<IEpSchedule>>({});
  const [isSaving, setIsSaving] = useState(false);

  const { isOpen: isDeleteOpen, onOpen: onDeleteOpen, onClose: onDeleteClose } = useDisclosure();
  const cancelRef = useRef<HTMLButtonElement>(null);

  const { data, isLoading } = useQuery<IEpSchedule>({
    queryKey: ["epSchedule", pk],
    queryFn: () => getEpScheduleDetail(pk),
    enabled: !!pk,
  });

  if (isLoading || !data) {
    return <Center minH="50vh"><Spinner size="xl" /></Center>;
  }

  const startEdit = () => {
    setForm({
      sj_order: data.sj_order,
      production_line: data.production_line ?? undefined,
      status: data.status,
      production_assembly_start_date: data.production_assembly_start_date ?? "",
      production_assembly_finish_date: data.production_assembly_finish_date ?? "",
      process_start_date: data.process_start_date ?? "",
      process_finish_date: data.process_finish_date ?? "",
      due_inbound_date_prep_material: data.due_inbound_date_prep_material ?? "",
      expected_prep_material_inbound_date: data.expected_prep_material_inbound_date ?? "",
      actual_inbound_prep_material_qty: data.actual_inbound_prep_material_qty ?? undefined,
      remark: data.remark ?? "",
    });
    setIsEdit(true);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await editEpSchedule(pk, {
        ...form,
        production_line: form.production_line ? Number(form.production_line) : null,
        actual_inbound_prep_material_qty:
          form.actual_inbound_prep_material_qty !== undefined && form.actual_inbound_prep_material_qty !== ("" as any)
            ? Number(form.actual_inbound_prep_material_qty) : null,
        production_assembly_start_date: (form.production_assembly_start_date as string) || null,
        production_assembly_finish_date: (form.production_assembly_finish_date as string) || null,
        process_start_date: (form.process_start_date as string) || null,
        process_finish_date: (form.process_finish_date as string) || null,
        due_inbound_date_prep_material: (form.due_inbound_date_prep_material as string) || null,
        expected_prep_material_inbound_date: (form.expected_prep_material_inbound_date as string) || null,
      });
      toast({ title: t("ep.common.saved"), status: "success", duration: 2000, position: "bottom-right" });
      queryClient.invalidateQueries({ queryKey: ["epSchedule", pk] });
      queryClient.invalidateQueries({ queryKey: ["epSchedules"] });
      setIsEdit(false);
    } catch (e: any) {
      const msg = e?.response?.data ? JSON.stringify(e.response.data) : t("ep.common.failedSave");
      toast({ title: msg, status: "error", duration: 3000, position: "bottom-right" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      await deleteEpSchedule(pk);
      toast({ title: t("ep.common.deleted"), status: "info", duration: 2000, position: "bottom-right" });
      navigate("/ep-production");
    } catch {
      toast({ title: t("ep.common.failedDelete"), status: "error", duration: 2000, position: "bottom-right" });
    }
  };

  const epSjNos = data.ep_sj_nos ?? [];

  return (
    <>
      <Helmet><title>{`EP Schedule — ${data.sj_order_info?.sj_po_number ?? pk}`}</title></Helmet>

      <Box bg={pageBg} minH="100vh" px={{ base: "4", md: "8", lg: "12" }} py={{ base: "6", md: "8" }}>
        {!isPopupWindow && (
          <Button size="sm" variant="ghost" onClick={() => navigate(-1)} mb={3} ml={-2}>← {t("ep.common.back")}</Button>
        )}

        {/* Header */}
        <HStack justify="space-between" align="center" mb={6}>
          <HStack spacing={3} flexWrap="wrap" flex={1} minW={0}>
            <Heading size="md" noOfLines={1}>
              {data.sj_order_info?.sj_po_number ?? `EP Schedule #${pk}`}
            </Heading>
            <StatusBadge status={data.status ?? "not_started"} fontSize="sm" px={2} py={0.5}>
              {data.status_display}
            </StatusBadge>
          </HStack>
          {!isEdit && (
            <HStack spacing={2}>
              <Button size="sm" onClick={startEdit}>{t("ep.common.edit")}</Button>
              <Button size="sm" colorScheme="red" variant="outline" onClick={onDeleteOpen}>{t("ep.common.delete")}</Button>
            </HStack>
          )}
          {isEdit && (
            <HStack spacing={2}>
              <Button size="sm" variant="ghost" onClick={() => setIsEdit(false)}>{t("ep.common.cancel")}</Button>
              <Button size="sm" colorScheme="blue" isLoading={isSaving} onClick={handleSave}>{t("ep.common.save")}</Button>
            </HStack>
          )}
        </HStack>

        <VStack spacing={5} align="stretch">
          {/* ── Basic Information ── */}
          <Box bg={cardBg} borderRadius="lg" border="1px solid" borderColor={borderColor} p={6}>
            <Text fontWeight="semibold" mb={4}>{t("ep.scheduleDetail.basicInfo")}</Text>
            {!isEdit ? (
              <Grid templateColumns={{ base: "1fr", md: "repeat(3, 1fr)" }} gap={5}>
                <InfoRow label={t("ep.scheduleDetail.sjPo")} value={data.sj_order_info?.sj_po_number} />
                <InfoRow label={t("ep.scheduleDetail.buyer")} value={data.sj_order_info?.buyer_name ? (
                  <Badge colorScheme="blue">{data.sj_order_info.buyer_name.name}</Badge>
                ) : undefined} />
                <InfoRow label={t("ep.scheduleDetail.sjNo")} value={data.sj_order_info?.sj_no ? (
                  <Link as={RouterLink} to={`/sjnos/${data.sj_order_info.sj_no.pk}`} color="blue.500" fontSize="sm" fontWeight="semibold">
                    {data.sj_order_info.sj_no.sj_no}
                  </Link>
                ) : undefined} />
                <InfoRow label={t("ep.scheduleDetail.styleName")} value={data.sj_order_info?.style_name} />
                <InfoRow label={t("ep.scheduleDetail.color")} value={data.sj_order_info?.color} />
                <InfoRow label={t("ep.scheduleDetail.size")} value={data.sj_order_info?.size} />
                <InfoRow label={t("ep.scheduleDetail.totalQty")} value={data.sj_order_info?.total_order_qty?.toLocaleString()} />
                <InfoRow label={t("ep.scheduleDetail.exFactory")} value={fmtDate(data.sj_order_info?.ex_factory_date)} />
                <InfoRow label={t("ep.scheduleDetail.poType")} value={data.sj_order_info?.po_type ? (
                  <Badge colorScheme="purple">{data.sj_order_info.po_type.name}</Badge>
                ) : undefined} />
                <InfoRow label={t("ep.scheduleDetail.productionLine")} value={data.production_line_name} />
                <InfoRow label={t("ep.scheduleDetail.outputQtyAuto")} value={data.output_qty != null ? data.output_qty.toLocaleString() : "-"} />
                <InfoRow label={t("ep.scheduleDetail.assemblyOutputQty")} value={data.production_assembly_output_qty != null ? data.production_assembly_output_qty.toLocaleString() : "-"} />
                <InfoRow label={t("ep.scheduleDetail.assemblyStartDate")} value={fmtDate(data.production_assembly_start_date)} />
                <InfoRow label={t("ep.scheduleDetail.assemblyFinishDate")} value={fmtDate(data.production_assembly_finish_date)} />
                <InfoRow label={t("ep.scheduleDetail.assemblyLeadTime")} value={data.production_assembly_lead_time != null ? (
                  <Box>
                    <Text as="span" fontSize="sm" fontWeight="semibold">{data.production_assembly_lead_time}d</Text>
                    {(data.production_assembly_sundays_excluded_count ?? 0) > 0 && (
                      <Text fontSize="xs" color="orange.400" mt={0.5}>{t("ep.common.sundayExcluded", { count: data.production_assembly_sundays_excluded_count })}</Text>
                    )}
                  </Box>
                ) : undefined} />
              </Grid>
            ) : (
              <Grid templateColumns={{ base: "1fr", md: "repeat(2, 1fr)" }} gap={4}>
                <FormControl>
                  <FormLabel fontSize="sm">{t("ep.scheduleDetail.colStatus")}</FormLabel>
                  <Select value={form.status ?? ""} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                    {STATUS_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value} style={statusOptionStyle(o.value)}>
                        {o.label}
                      </option>
                    ))}
                  </Select>
                </FormControl>
                <FormControl>
                  <FormLabel fontSize="sm">{t("ep.scheduleDetail.productionLinePk")}</FormLabel>
                  <Input type="number" value={form.production_line ?? ""} placeholder="비워두면 미설정"
                    onChange={(e) => setForm({ ...form, production_line: e.target.value ? Number(e.target.value) : undefined })} />
                </FormControl>
                <FormControl>
                  <FormLabel fontSize="sm">{t("ep.scheduleDetail.assemblyStartDate")}</FormLabel>
                  <LocalizedDateInput
                    value={(form.production_assembly_start_date as string) ?? ""}
                    onChange={(v) => setForm({ ...form, production_assembly_start_date: v })}
                  />
                </FormControl>
                <FormControl>
                  <FormLabel fontSize="sm">{t("ep.scheduleDetail.assemblyFinishDate")}</FormLabel>
                  <LocalizedDateInput
                    value={(form.production_assembly_finish_date as string) ?? ""}
                    onChange={(v) => setForm({ ...form, production_assembly_finish_date: v })}
                  />
                </FormControl>
              </Grid>
            )}
          </Box>

          {/* ── Process Schedule ── */}
          <Box bg={cardBg} borderRadius="lg" border="1px solid" borderColor={borderColor} p={6}>
            <Text fontWeight="semibold" mb={4}>{t("ep.scheduleDetail.processSchedule")}</Text>
            {!isEdit ? (
              <Grid templateColumns={{ base: "1fr", md: "repeat(3, 1fr)" }} gap={5}>
                <InfoRow label={t("ep.scheduleDetail.processStartDate")} value={fmtDate(data.process_start_date)} />
                <InfoRow label={t("ep.scheduleDetail.processFinishDate")} value={fmtDate(data.process_finish_date)} />
                <InfoRow label={t("ep.scheduleDetail.leadTimeDays")} value={data.process_lead_time_days != null ? (
                  <Box>
                    <Text as="span" fontSize="sm" fontWeight="semibold">{data.process_lead_time_days.toFixed(1)}d</Text>
                    {(data.process_sundays_excluded_count ?? 0) > 0 && (
                      <Text fontSize="xs" color="orange.400" mt={0.5}>{t("ep.common.sundayExcluded", { count: data.process_sundays_excluded_count })}</Text>
                    )}
                  </Box>
                ) : undefined} />
              </Grid>
            ) : (
              <Grid templateColumns={{ base: "1fr", md: "repeat(3, 1fr)" }} gap={4}>
                <FormControl>
                  <FormLabel fontSize="sm">{t("ep.scheduleDetail.processStartDate")}</FormLabel>
                  <LocalizedDateInput
                    value={(form.process_start_date as string) ?? ""}
                    onChange={(v) => setForm({ ...form, process_start_date: v })}
                  />
                </FormControl>
                <FormControl>
                  <FormLabel fontSize="sm">{t("ep.scheduleDetail.processFinishDate")}</FormLabel>
                  <LocalizedDateInput
                    value={(form.process_finish_date as string) ?? ""}
                    onChange={(v) => setForm({ ...form, process_finish_date: v })}
                  />
                </FormControl>
                <Box>
                  <Text fontSize="xs" color="gray.500" mb={1}>{t("ep.scheduleDetail.leadTimeDays")}</Text>
                  <Text fontSize="sm" color="gray.400" fontStyle="italic">{t("ep.common.autoCalcAfterSave")}</Text>
                </Box>
              </Grid>
            )}
          </Box>

          {/* ── Prep Material ── */}
          <Box bg={cardBg} borderRadius="lg" border="1px solid" borderColor={borderColor} p={6}>
            <Text fontWeight="semibold" mb={4}>{t("ep.scheduleDetail.prepMaterial")}</Text>
            {!isEdit ? (
              <Grid templateColumns={{ base: "1fr", md: "repeat(3, 1fr)" }} gap={5}>
                <InfoRow label={t("ep.scheduleDetail.dueInbound")} value={fmtDate(data.due_inbound_date_prep_material)} />
                <InfoRow label={t("ep.scheduleDetail.expectedInbound")} value={fmtDate(data.expected_prep_material_inbound_date)} />
                <InfoRow label={t("ep.scheduleDetail.actualInboundQty")} value={data.actual_inbound_prep_material_qty} />
              </Grid>
            ) : (
              <Grid templateColumns={{ base: "1fr", md: "repeat(3, 1fr)" }} gap={4}>
                <FormControl>
                  <FormLabel fontSize="sm">Due Inbound Date</FormLabel>
                  <LocalizedDateInput
                    value={(form.due_inbound_date_prep_material as string) ?? ""}
                    onChange={(v) => setForm({ ...form, due_inbound_date_prep_material: v })}
                  />
                </FormControl>
                <FormControl>
                  <FormLabel fontSize="sm">Expected Inbound Date</FormLabel>
                  <LocalizedDateInput
                    value={(form.expected_prep_material_inbound_date as string) ?? ""}
                    onChange={(v) => setForm({ ...form, expected_prep_material_inbound_date: v })}
                  />
                </FormControl>
                <FormControl>
                  <FormLabel fontSize="sm">Actual Inbound Qty</FormLabel>
                  <Input type="number" value={form.actual_inbound_prep_material_qty ?? ""}
                    onChange={(e) => setForm({ ...form, actual_inbound_prep_material_qty: e.target.value ? Number(e.target.value) : undefined })} />
                </FormControl>
              </Grid>
            )}
          </Box>

          {/* ── EP SjNo / Module / Process ── */}
          <Box bg={cardBg} borderRadius="lg" border="1px solid" borderColor={borderColor} p={6}>
            <HStack mb={4} spacing={2}>
              <Text fontWeight="semibold">{t("ep.scheduleDetail.epSjNos")}</Text>
              <Badge colorScheme="purple">{epSjNos.length}</Badge>
            </HStack>
            {epSjNos.length === 0 ? (
              <Text fontSize="sm" color="gray.400">No EP SJ Nos found.</Text>
            ) : (
              epSjNos.map((sj) => (
                <SjNoCard key={sj.pk} sj={sj} cardBg={cardBg} borderColor={borderColor} t={t} />
              ))
            )}
          </Box>

          {/* ── Remark ── */}
          <Box bg={cardBg} borderRadius="lg" border="1px solid" borderColor={borderColor} p={6}>
            <Text fontWeight="semibold" mb={4}>{t("ep.scheduleDetail.remark")}</Text>
            {!isEdit ? (
              <Text fontSize="sm" whiteSpace="pre-wrap">
                {data.remark || <Text as="span" color="gray.400">-</Text>}
              </Text>
            ) : (
              <Textarea value={(form.remark as string) ?? ""} onChange={(e) => setForm({ ...form, remark: e.target.value })} rows={3} />
            )}
          </Box>

          <Divider />
          <HStack spacing={8} px={1}>
            <Text fontSize="xs" color="gray.400">Created: {fmtDateTime(data.created_at)}</Text>
            <Text fontSize="xs" color="gray.400">Updated: {fmtDateTime(data.updated_at)}</Text>
          </HStack>
        </VStack>
      </Box>

      <AlertDialog isOpen={isDeleteOpen} leastDestructiveRef={cancelRef} onClose={onDeleteClose} isCentered>
        <AlertDialogOverlay />
        <AlertDialogContent>
          <AlertDialogHeader>Delete Schedule</AlertDialogHeader>
          <AlertDialogBody>EP Schedule ({data.sj_order_info?.sj_po_number})을 삭제하시겠습니까?</AlertDialogBody>
          <AlertDialogFooter>
            <Button ref={cancelRef} onClick={onDeleteClose}>{t("ep.common.cancel")}</Button>
            <Button colorScheme="red" ml={3} onClick={handleDelete}>{t("ep.common.delete")}</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
