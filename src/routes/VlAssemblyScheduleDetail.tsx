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
import { useMemo, useRef, useState } from "react";
import { FaChevronDown, FaChevronRight } from "react-icons/fa";
import LocalizedDateInput from "../components/LocalizedDateInput";
import PhotoModal from "../components/PhotoModal";
import { StatusBadge, statusOptionStyle } from "../components/StatusBadge";
import {
  formatIsoDateDisplay,
  formatIsoDateTimeDisplay,
} from "../lib/dateLocale";
import {
  countPlanHolidayDaysNonSundayInInclusiveRange,
  planHolidayApiRangeForScheduleDates,
} from "../lib/vlPlanHolidayRange";
import { getAssemblyDailyPlannedQtyFromTotal } from "../lib/vlAssemblyAssemblyDailyPlan";
import { broadcastVlAssemblyScheduleListCacheBust } from "../lib/vlAssemblyProductionScheduleListCacheBust";
import {
  getVlAssemblyScheduleDetail,
  getVlPlanHolidays,
  editVlAssemblySchedule,
  deleteVlAssemblySchedule,
  getProductionLines,
  IVlAssemblySchedule,
  IVlAssemblySjNoCopy,
  IVlAssemblyModuleCopy,
  IVlAssemblyProcessCopy,
  IProductionLine,
  ISjOrderInfo,
} from "../api";
import { useTranslation } from "react-i18next";

/** 조립 리드타임 / 공정 리드타임 아래: 일요일 제외 + 등록 공휴일(일요일 제외) 안내 */
function LeadTimeExcludedHints({
  sundayCount,
  planHolidayCount,
  t,
}: {
  sundayCount?: number;
  planHolidayCount: number;
  t: (key: string, opts?: Record<string, unknown>) => string;
}) {
  const showSun = (sundayCount ?? 0) > 0;
  const showHol = planHolidayCount > 0;
  if (!showSun && !showHol) return null;
  return (
    <VStack align="stretch" spacing={0.5} mt={0.5}>
      {showSun && (
        <Text fontSize="xs" color="orange.400">
          {t("vlAssembly.common.sundayExcluded", { count: sundayCount })}
        </Text>
      )}
      {showHol && (
        <Text fontSize="xs" color="orange.400">
          {t("vlAssembly.common.planHolidayExcluded", { count: planHolidayCount })}
        </Text>
      )}
    </VStack>
  );
}

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
function ProcessRow({ p, borderColor }: { p: IVlAssemblyProcessCopy; borderColor: string }) {
  const balance = p.total_qty != null ? Math.max(0, p.total_qty - (p.output_qty ?? 0)) : null;
  return (
    <Tr>
      <Td pl={10}>
        <HStack spacing={1}>
          <Badge colorScheme="teal" fontSize="2xs" px={1}>P</Badge>
          <Link as={RouterLink} to={`/vl-assembly-production/processes/${p.pk}`} color="blue.500" fontWeight="semibold" fontSize="sm">
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
  mod: IVlAssemblyModuleCopy; borderColor: string; headerBg: string;
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
            <Link as={RouterLink} to={`/vl-assembly-production/modules/${mod.pk}`} color="blue.500" fontWeight="semibold" fontSize="sm"
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
  sj, cardBg, borderColor, t, onPhotoClick,
}: {
  sj: IVlAssemblySjNoCopy; cardBg: string; borderColor: string;
  t: (key: string, opts?: Record<string, unknown>) => string;
  onPhotoClick?: (url: string) => void;
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
          {sj.sj_style_thumbnail ? (
            <Box
              as="img"
              src={sj.sj_style_thumbnail}
              alt={sj.sj_style_name ?? "style"}
              w="32px"
              h="32px"
              sx={{ objectFit: "cover" }}
              borderRadius="sm"
              flexShrink={0}
              boxShadow="sm"
              border="1px solid"
              borderColor={borderColor}
              cursor="pointer"
              onClick={(e: React.MouseEvent) => {
                e.stopPropagation();
                onPhotoClick?.(sj.sj_style_thumbnail!);
              }}
            />
          ) : null}
          <Badge colorScheme="purple" px={1.5}>S</Badge>
          <Link as={RouterLink} to={`/vl-assembly-production/sj-nos/${sj.pk}`} color="purple.500" fontWeight="bold" fontSize="md"
            onClick={(e) => e.stopPropagation()}>
            {sj.sj_no}
          </Link>
          <StatusBadge status={sj.status ?? "not_started"} fontSize="xs">
            {sj.status_display}
          </StatusBadge>
        </HStack>
        <HStack spacing={6} fontSize="sm">
          <Box textAlign="right">
            <Text fontSize="xs" color="gray.500">{t("vlAssembly.scheduleDetail.output")}</Text>
            <Text fontWeight="semibold">{(sj.output_qty ?? 0).toLocaleString()}</Text>
          </Box>
          <Box textAlign="right">
            <Text fontSize="xs" color="gray.500">{t("vlAssembly.scheduleDetail.total")}</Text>
            <Text fontWeight="semibold">{sj.total_qty != null ? sj.total_qty.toLocaleString() : "—"}</Text>
          </Box>
          <Box textAlign="right">
            <Text fontSize="xs" color="gray.500">{t("vlAssembly.scheduleDetail.balance")}</Text>
            <Text fontWeight="semibold">{balance != null ? balance.toLocaleString() : "—"}</Text>
          </Box>
          <Badge variant="outline" colorScheme="blue" fontSize="xs">{sj.ep_modules.length} {t("vlAssembly.scheduleDetail.modules")}</Badge>
        </HStack>
      </HStack>

      {/* Modules table */}
      <Collapse in={open}>
        <TableContainer>
          <Table size="sm" variant="simple">
            <Thead>
              <Tr>
                <Th>{t("vlAssembly.scheduleDetail.colCode")}</Th>
                <Th>{t("vlAssembly.scheduleDetail.colName")}</Th>
                <Th>{t("vlAssembly.scheduleDetail.colStatus")}</Th>
                <Th isNumeric>{t("vlAssembly.scheduleDetail.colOutputQty")}</Th>
                <Th isNumeric>{t("vlAssembly.scheduleDetail.colTotalQty")}</Th>
                <Th isNumeric>{t("vlAssembly.scheduleDetail.colBalance")}</Th>
                <Th isNumeric>{t("vlAssembly.scheduleDetail.colCycle")}</Th>
                <Th isNumeric>{t("vlAssembly.scheduleDetail.colTargetHr")}</Th>
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
export default function VlAssemblyScheduleDetail() {
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
    { value: "not_started", label: t("vlAssembly.status.not_started") },
    { value: "outsourced", label: t("vlAssembly.status.outsourced") },
    { value: "in_progress", label: t("vlAssembly.status.in_progress") },
    { value: "completed", label: t("vlAssembly.status.completed") },
    { value: "not_ready", label: t("vlAssembly.status.not_ready") },
  ];

  const cardBg = useColorModeValue("white", "gray.800");
  const pageBg = useColorModeValue("gray.50", "gray.900");
  const borderColor = useColorModeValue("gray.200", "gray.700");
  const labelColor = useColorModeValue("gray.500", "gray.400");

  const [photoModalUrl, setPhotoModalUrl] = useState<string | undefined>();

  const [isEdit, setIsEdit] = useState(false);
  const [form, setForm] = useState<Partial<IVlAssemblySchedule> & Partial<ISjOrderInfo>>({});
  const [isSaving, setIsSaving] = useState(false);

  const { isOpen: isDeleteOpen, onOpen: onDeleteOpen, onClose: onDeleteClose } = useDisclosure();
  const cancelRef = useRef<HTMLButtonElement>(null);

  const { data, isLoading } = useQuery<IVlAssemblySchedule>({
    queryKey: ["epSchedule", pk],
    queryFn: () => getVlAssemblyScheduleDetail(pk),
    enabled: !!pk,
  });

  const planHolidayApiRange = useMemo(
    () =>
      planHolidayApiRangeForScheduleDates([
        data?.production_assembly_start_date,
        data?.production_assembly_finish_date,
        data?.process_start_date,
        data?.process_finish_date,
      ]),
    [
      data?.production_assembly_start_date,
      data?.production_assembly_finish_date,
      data?.process_start_date,
      data?.process_finish_date,
    ]
  );

  const { data: planHolidayRows = [] } = useQuery({
    queryKey: [
      "vlPlanHolidays",
      "scheduleDetail",
      pk,
      planHolidayApiRange.date_from,
      planHolidayApiRange.date_to,
    ],
    queryFn: async () => {
      try {
        return await getVlPlanHolidays(planHolidayApiRange);
      } catch {
        return [];
      }
    },
    enabled: !!pk && !!data,
    staleTime: 60_000,
  });

  const { data: productionLines = [] } = useQuery<IProductionLine[]>({
    queryKey: ["productionLines"],
    queryFn: getProductionLines,
    staleTime: 300_000,
  });

  const vlPlanHolidayYmdDetailSet = useMemo(() => {
    const s = new Set<string>();
    for (const h of planHolidayRows) {
      const d = String(h.date ?? "").slice(0, 10);
      if (/^\d{4}-\d{2}-\d{2}$/.test(d)) s.add(d);
    }
    return s;
  }, [planHolidayRows]);

  const assemblyPlanHolidayExcludedCount = useMemo(
    () =>
      countPlanHolidayDaysNonSundayInInclusiveRange(
        data?.production_assembly_start_date,
        data?.production_assembly_finish_date,
        vlPlanHolidayYmdDetailSet
      ),
    [
      data?.production_assembly_start_date,
      data?.production_assembly_finish_date,
      vlPlanHolidayYmdDetailSet,
    ]
  );

  const assemblyPlanMeta = useMemo(
    () =>
      data && (data.sj_order_info?.total_order_qty ?? 0) > 0
        ? getAssemblyDailyPlannedQtyFromTotal(
            data,
            data.sj_order_info!.total_order_qty!,
            vlPlanHolidayYmdDetailSet
          )
        : null,
    [data, vlPlanHolidayYmdDetailSet]
  );

  const processPlanHolidayExcludedCount = useMemo(
    () =>
      countPlanHolidayDaysNonSundayInInclusiveRange(
        data?.process_start_date,
        data?.process_finish_date,
        vlPlanHolidayYmdDetailSet
      ),
    [data?.process_start_date, data?.process_finish_date, vlPlanHolidayYmdDetailSet]
  );

  const assemblyHolidayHintCount =
    data?.production_assembly_plan_holidays_excluded_count ?? assemblyPlanHolidayExcludedCount;
  const processHolidayHintCount =
    data?.process_plan_holidays_excluded_count ?? processPlanHolidayExcludedCount;

  if (isLoading || !data) {
    return <Center minH="50vh"><Spinner size="xl" /></Center>;
  }

  const startEdit = () => {
    const o = data.sj_order_info;
    setForm({
      sj_order: data.sj_order,
      production_line: data.production_line ?? undefined,
      status: data.status,
      production_assembly_start_date: data.production_assembly_start_date ?? "",
      production_assembly_finish_date: data.production_assembly_finish_date ?? "",
      production_assembly_output_qty: data.production_assembly_output_qty ?? undefined,
      process_start_date: data.process_start_date ?? "",
      process_finish_date: data.process_finish_date ?? "",
      due_inbound_date_prep_material: data.due_inbound_date_prep_material ?? "",
      expected_prep_material_inbound_date: data.expected_prep_material_inbound_date ?? "",
      actual_inbound_prep_material_qty: data.actual_inbound_prep_material_qty ?? undefined,
      remark: data.remark ?? "",
      ex_factory_date: o?.ex_factory_date ?? "",
      ex_factory_2nd: data.ex_factory_2nd ?? "",
      cutting_start_date: data.cutting_start_date ?? "",
      vien_laser: data.vien_laser ?? "",
      printing_folding: data.printing_folding ?? "",
      sub_tg: data.sub_tg ?? "",
      sub_vl: data.sub_vl ?? "",
      pre: data.pre ?? "",
      scom: data.scom ?? "",
      expected_date_finished: data.expected_date_finished ?? "",
      keep: data.keep ?? "",
      issue_or_not: data.issue_or_not ?? "",
      final: data.final ?? "",
      balance_expected_finish_date: data.balance_expected_finish_date ?? "",
      ex_country: o?.ex_country ?? "",
      air_or_vessel: o?.air_or_vessel ?? "",
      po_date: o?.po_date ?? "",
      newness_or_repeat: o?.newness_or_repeat ?? "",
      gong_in: o?.gong_in ?? "",
      total_cmt: o?.total_cmt ?? "",
      actual_cmt: o?.actual_cmt ?? "",
      unit_fob: o?.unit_fob ?? "",
      total_fob: o?.total_fob ?? "",
      actual_fob: o?.actual_fob ?? "",
    });
    setIsEdit(true);
  };

  const handleSave = async () => {
    const cap = data.sj_order_info?.total_order_qty;
    const asmOut = form.production_assembly_output_qty;
    if (cap != null && cap > 0 && asmOut != null && Number(asmOut) > cap) {
      toast({
        title: t("vlAssembly.scheduleDetail.assemblyOutputExceedsTotal", { cap: cap.toLocaleString() }),
        status: "error",
        duration: 4000,
        position: "bottom-right",
      });
      return;
    }
    setIsSaving(true);
    try {
      await editVlAssemblySchedule(pk, {
        production_line: form.production_line ? Number(form.production_line) : null,
        status: form.status,
        actual_inbound_prep_material_qty:
          form.actual_inbound_prep_material_qty !== undefined && form.actual_inbound_prep_material_qty !== ("" as any)
            ? Number(form.actual_inbound_prep_material_qty) : null,
        production_assembly_start_date: (form.production_assembly_start_date as string) || null,
        production_assembly_finish_date: (form.production_assembly_finish_date as string) || null,
        production_assembly_output_qty:
          form.production_assembly_output_qty === undefined || form.production_assembly_output_qty === null
            ? null
            : Number(form.production_assembly_output_qty),
        process_start_date: (form.process_start_date as string) || null,
        process_finish_date: (form.process_finish_date as string) || null,
        due_inbound_date_prep_material: (form.due_inbound_date_prep_material as string) || null,
        expected_prep_material_inbound_date: (form.expected_prep_material_inbound_date as string) || null,
        remark: (form.remark as string) || "",
        ex_factory_date: (form.ex_factory_date as string) || null,
        ex_factory_2nd: (form.ex_factory_2nd as string)?.trim() ?? "",
        cutting_start_date: (form.cutting_start_date as string)?.trim() ?? "",
        vien_laser: (form.vien_laser as string)?.trim() ?? "",
        printing_folding: (form.printing_folding as string)?.trim() ?? "",
        sub_tg: (form.sub_tg as string)?.trim() ?? "",
        sub_vl: (form.sub_vl as string)?.trim() ?? "",
        pre: (form.pre as string)?.trim() ?? "",
        scom: (form.scom as string)?.trim() ?? "",
        expected_date_finished: (form.expected_date_finished as string)?.trim() ?? "",
        keep: (form.keep as string)?.trim() ?? "",
        issue_or_not: (form.issue_or_not as string)?.trim() ?? "",
        final: (form.final as string)?.trim() ?? "",
        balance_expected_finish_date: (form.balance_expected_finish_date as string)?.trim() ?? "",
        ex_country: (form.ex_country as string)?.trim() ?? "",
        air_or_vessel: (form.air_or_vessel as string)?.trim() ?? "",
        po_date: (form.po_date as string)?.trim() ?? "",
        newness_or_repeat: (form.newness_or_repeat as string)?.trim() ?? "",
        gong_in: (form.gong_in as string)?.trim() ?? "",
        total_cmt: (form.total_cmt as string)?.trim() ?? "",
        actual_cmt: (form.actual_cmt as string)?.trim() ?? "",
        unit_fob: (form.unit_fob as string)?.trim() ?? "",
        total_fob: (form.total_fob as string)?.trim() ?? "",
        actual_fob: (form.actual_fob as string)?.trim() ?? "",
      });
      toast({ title: t("vlAssembly.common.saved"), status: "success", duration: 2000, position: "bottom-right" });
      queryClient.invalidateQueries({ queryKey: ["epSchedule", pk] });
      queryClient.invalidateQueries({ queryKey: ["vlSchedules"] });
      broadcastVlAssemblyScheduleListCacheBust();
      setIsEdit(false);
    } catch (e: any) {
      const msg = e?.response?.data ? JSON.stringify(e.response.data) : t("vlAssembly.common.failedSave");
      toast({ title: msg, status: "error", duration: 3000, position: "bottom-right" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      await deleteVlAssemblySchedule(pk);
      toast({ title: t("vlAssembly.common.deleted"), status: "info", duration: 2000, position: "bottom-right" });
      queryClient.invalidateQueries({ queryKey: ["vlSchedules"] });
      broadcastVlAssemblyScheduleListCacheBust();
      navigate("/vl-assembly-production");
    } catch {
      toast({ title: t("vlAssembly.common.failedDelete"), status: "error", duration: 2000, position: "bottom-right" });
    }
  };

  const epSjNos = data.ep_sj_nos ?? [];

  return (
    <>
      <Helmet><title>{`VL Assembly Schedule — ${data.sj_order_info?.sj_po_number ?? pk}`}</title></Helmet>

      <Box bg={pageBg} minH="100vh" px={{ base: "4", md: "8", lg: "12" }} py={{ base: "6", md: "8" }}>
        {!isPopupWindow && (
          <Button size="sm" variant="ghost" onClick={() => navigate(-1)} mb={3} ml={-2}>← {t("vlAssembly.common.back")}</Button>
        )}

        {/* Header */}
        <HStack justify="space-between" align="flex-start" mb={6}>
          <HStack spacing={4} flex={1} minW={0} align="flex-start">
            {data.sj_order_info?.sj_style?.thumbnail && (
              <Box
                as="img"
                src={data.sj_order_info.sj_style.thumbnail}
                alt={data.sj_order_info.sj_style.style_name ?? "style"}
                w="72px"
                h="72px"
                sx={{ objectFit: "cover" }}
                borderRadius="lg"
                flexShrink={0}
                boxShadow="sm"
                border="1px solid"
                borderColor={borderColor}
                cursor="pointer"
                onClick={() => setPhotoModalUrl(data.sj_order_info!.sj_style!.thumbnail!)}
              />
            )}
            <Box>
              <HStack spacing={3} flexWrap="wrap" mb={1}>
                <Heading size="md" noOfLines={1}>
                  {data.sj_order_info?.sj_po_number ?? `VL Assembly Schedule #${pk}`}
                </Heading>
                <StatusBadge status={data.status ?? "not_started"} fontSize="sm" px={2} py={0.5}>
                  {data.status_display}
                </StatusBadge>
              </HStack>
              {data.sj_order_info?.sj_style?.style_name && (
                <Text fontSize="sm" color={labelColor}>
                  {data.sj_order_info.sj_style.style_name}
                </Text>
              )}
            </Box>
          </HStack>
          {!isEdit && (
            <HStack spacing={2}>
              <Button size="sm" onClick={startEdit}>{t("vlAssembly.common.edit")}</Button>
              <Button size="sm" colorScheme="red" variant="outline" onClick={onDeleteOpen}>{t("vlAssembly.common.delete")}</Button>
            </HStack>
          )}
          {isEdit && (
            <HStack spacing={2}>
              <Button size="sm" variant="ghost" onClick={() => setIsEdit(false)}>{t("vlAssembly.common.cancel")}</Button>
              <Button size="sm" colorScheme="blue" isLoading={isSaving} onClick={handleSave}>{t("vlAssembly.common.save")}</Button>
            </HStack>
          )}
        </HStack>

        <VStack spacing={5} align="stretch">
          {/* ── Basic Information ── */}
          <Box bg={cardBg} borderRadius="lg" border="1px solid" borderColor={borderColor} p={6}>
            <Text fontWeight="semibold" mb={4}>{t("vlAssembly.scheduleDetail.basicInfo")}</Text>
            {!isEdit ? (
              <Grid templateColumns={{ base: "1fr", md: "repeat(3, 1fr)" }} gap={5}>
                <InfoRow label={t("vlAssembly.scheduleDetail.sjPo")} value={data.sj_order_info?.sj_po_number} />
                <InfoRow label={t("vlAssembly.scheduleDetail.buyer")} value={data.sj_order_info?.buyer_name ? (
                  <Badge colorScheme="blue">{data.sj_order_info.buyer_name.name}</Badge>
                ) : undefined} />
                <InfoRow label={t("vlAssembly.scheduleDetail.sjNo")} value={data.sj_order_info?.sj_no ? (
                  <Link as={RouterLink} to={`/sjnos/${data.sj_order_info.sj_no.pk}`} color="blue.500" fontSize="sm" fontWeight="semibold">
                    {data.sj_order_info.sj_no.sj_no}
                  </Link>
                ) : undefined} />
                <InfoRow label={t("vlAssembly.scheduleDetail.styleName")} value={data.sj_order_info?.style_name} />
                <InfoRow label={t("vlAssembly.scheduleDetail.color")} value={data.sj_order_info?.color} />
                <InfoRow label={t("vlAssembly.scheduleDetail.size")} value={data.sj_order_info?.size} />
                <InfoRow label={t("vlAssembly.scheduleDetail.totalQty")} value={data.sj_order_info?.total_order_qty?.toLocaleString()} />
                <InfoRow label={t("vlAssembly.scheduleDetail.exFactory")} value={fmtDate(data.sj_order_info?.ex_factory_date)} />
                <InfoRow label={t("vlAssembly.scheduleDetail.poType")} value={data.sj_order_info?.po_type ? (
                  <Badge colorScheme="purple">{data.sj_order_info.po_type.name}</Badge>
                ) : undefined} />
                <GridItem colSpan={{ base: 1, md: 3 }}>
                  <Text fontSize="sm" fontWeight="semibold" mt={2} color={labelColor}>
                    {t("vlAssembly.scheduleDetail.orderExtraFields")}
                  </Text>
                </GridItem>
                <InfoRow label={t("vlAssembly.list.col.exCountry")} value={data.sj_order_info?.ex_country || "-"} />
                <InfoRow label={t("vlAssembly.list.col.airOrVessel")} value={data.sj_order_info?.air_or_vessel || "-"} />
                <InfoRow label={t("vlAssembly.list.col.poDate")} value={data.sj_order_info?.po_date || "-"} />
                <InfoRow label={t("vlAssembly.list.col.newnessOrRepeat")} value={data.sj_order_info?.newness_or_repeat || "-"} />
                <InfoRow label={t("vlAssembly.list.col.gongIn")} value={data.sj_order_info?.gong_in || "-"} />
                <InfoRow label={t("vlAssembly.list.col.totalCmt")} value={data.sj_order_info?.total_cmt || "-"} />
                <InfoRow label={t("vlAssembly.list.col.actualCmt")} value={data.sj_order_info?.actual_cmt || "-"} />
                <InfoRow label={t("vlAssembly.list.col.unitFob")} value={data.sj_order_info?.unit_fob || "-"} />
                <InfoRow label={t("vlAssembly.list.col.totalFob")} value={data.sj_order_info?.total_fob || "-"} />
                <InfoRow label={t("vlAssembly.list.col.actualFob")} value={data.sj_order_info?.actual_fob || "-"} />
                <InfoRow label={t("vlAssembly.scheduleDetail.productionLine")} value={data.production_line_name} />
                <InfoRow label={t("vlAssembly.scheduleDetail.outputQtyAuto")} value={data.output_qty != null ? data.output_qty.toLocaleString() : "-"} />
                <InfoRow label={t("vlAssembly.scheduleDetail.assemblyOutputQty")} value={data.production_assembly_output_qty != null ? data.production_assembly_output_qty.toLocaleString() : "-"} />
                <InfoRow label={t("vlAssembly.scheduleDetail.assemblyStartDate")} value={fmtDate(data.production_assembly_start_date)} />
                <InfoRow label={t("vlAssembly.scheduleDetail.assemblyFinishDate")} value={fmtDate(data.production_assembly_finish_date)} />
                <InfoRow label={t("vlAssembly.scheduleDetail.assemblyLeadTime")} value={data.production_assembly_lead_time != null ? (
                  <Box>
                    <Text as="span" fontSize="sm" fontWeight="semibold">{data.production_assembly_lead_time}d</Text>
                    <LeadTimeExcludedHints
                      t={t}
                      sundayCount={data.production_assembly_sundays_excluded_count}
                      planHolidayCount={assemblyHolidayHintCount}
                    />
                    {assemblyPlanMeta && (
                      <Text fontSize="xs" color={labelColor} mt={0.5}>
                        {t("vlAssembly.scheduleDetail.dailyPlanQty", {
                          daily: assemblyPlanMeta.daily.toLocaleString(),
                          workDays: assemblyPlanMeta.workDays,
                        })}
                      </Text>
                    )}
                  </Box>
                ) : undefined} />
              </Grid>
            ) : (
              <Grid templateColumns={{ base: "1fr", md: "repeat(2, 1fr)" }} gap={4}>
                <FormControl>
                  <FormLabel fontSize="sm">{t("vlAssembly.scheduleDetail.colStatus")}</FormLabel>
                  <Select value={form.status ?? ""} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                    {STATUS_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value} style={statusOptionStyle(o.value)}>
                        {o.label}
                      </option>
                    ))}
                  </Select>
                </FormControl>
                <FormControl>
                  <FormLabel fontSize="sm">{t("vlAssembly.scheduleDetail.productionLine")}</FormLabel>
                  <Select
                    value={form.production_line ?? ""}
                    onChange={(e) => setForm({ ...form, production_line: e.target.value ? Number(e.target.value) : undefined })}
                  >
                    <option value="">{t("vlAssembly.scheduleDetail.productionLineNone")}</option>
                    {productionLines.map((line) => (
                      <option key={line.pk} value={line.pk}>
                        {line.name}{line.factory_name ? ` (${line.factory_name})` : ""}
                      </option>
                    ))}
                  </Select>
                </FormControl>
                <FormControl>
                  <FormLabel fontSize="sm">{t("vlAssembly.scheduleDetail.assemblyStartDate")}</FormLabel>
                  <LocalizedDateInput
                    value={(form.production_assembly_start_date as string) ?? ""}
                    onChange={(v) => setForm({ ...form, production_assembly_start_date: v })}
                  />
                </FormControl>
                <FormControl>
                  <FormLabel fontSize="sm">{t("vlAssembly.scheduleDetail.assemblyFinishDate")}</FormLabel>
                  <LocalizedDateInput
                    value={(form.production_assembly_finish_date as string) ?? ""}
                    onChange={(v) => setForm({ ...form, production_assembly_finish_date: v })}
                  />
                </FormControl>
                <FormControl>
                  <FormLabel fontSize="sm">{t("vlAssembly.scheduleDetail.exFactory")}</FormLabel>
                  <LocalizedDateInput
                    value={(form.ex_factory_date as string) ?? ""}
                    onChange={(v) => setForm({ ...form, ex_factory_date: v })}
                  />
                </FormControl>
                <FormControl>
                  <FormLabel fontSize="sm">{t("vlAssembly.scheduleDetail.assemblyOutputQty")}</FormLabel>
                  <Input
                    type="number"
                    min={0}
                    max={data.sj_order_info?.total_order_qty != null && data.sj_order_info.total_order_qty > 0
                      ? data.sj_order_info.total_order_qty
                      : undefined}
                    value={form.production_assembly_output_qty ?? ""}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        production_assembly_output_qty: e.target.value === "" ? undefined : Number(e.target.value),
                      })
                    }
                  />
                  {data.sj_order_info?.total_order_qty != null && data.sj_order_info.total_order_qty > 0 && (
                    <Text fontSize="xs" color="gray.500" mt={1}>
                      {t("vlAssembly.scheduleDetail.assemblyOutputMaxHint", {
                        cap: data.sj_order_info.total_order_qty.toLocaleString(),
                      })}
                    </Text>
                  )}
                </FormControl>
                <GridItem colSpan={{ base: 1, md: 2 }}>
                  <Text fontSize="sm" fontWeight="semibold" mb={2} color={labelColor}>
                    {t("vlAssembly.scheduleDetail.orderExtraFields")}
                  </Text>
                  <Grid templateColumns={{ base: "1fr", md: "repeat(2, 1fr)" }} gap={3}>
                    <FormControl>
                      <FormLabel fontSize="sm">{t("vlAssembly.list.col.exCountry")}</FormLabel>
                      <Input value={(form.ex_country as string) ?? ""} onChange={(e) => setForm({ ...form, ex_country: e.target.value })} />
                    </FormControl>
                    <FormControl>
                      <FormLabel fontSize="sm">{t("vlAssembly.list.col.airOrVessel")}</FormLabel>
                      <Input value={(form.air_or_vessel as string) ?? ""} onChange={(e) => setForm({ ...form, air_or_vessel: e.target.value })} />
                    </FormControl>
                    <FormControl>
                      <FormLabel fontSize="sm">{t("vlAssembly.list.col.poDate")}</FormLabel>
                      <Input value={(form.po_date as string) ?? ""} onChange={(e) => setForm({ ...form, po_date: e.target.value })} />
                    </FormControl>
                    <FormControl>
                      <FormLabel fontSize="sm">{t("vlAssembly.list.col.newnessOrRepeat")}</FormLabel>
                      <Input value={(form.newness_or_repeat as string) ?? ""} onChange={(e) => setForm({ ...form, newness_or_repeat: e.target.value })} />
                    </FormControl>
                    <FormControl>
                      <FormLabel fontSize="sm">{t("vlAssembly.list.col.gongIn")}</FormLabel>
                      <Input value={(form.gong_in as string) ?? ""} onChange={(e) => setForm({ ...form, gong_in: e.target.value })} />
                    </FormControl>
                    <FormControl>
                      <FormLabel fontSize="sm">{t("vlAssembly.list.col.totalCmt")}</FormLabel>
                      <Input value={(form.total_cmt as string) ?? ""} onChange={(e) => setForm({ ...form, total_cmt: e.target.value })} />
                    </FormControl>
                    <FormControl>
                      <FormLabel fontSize="sm">{t("vlAssembly.list.col.actualCmt")}</FormLabel>
                      <Input value={(form.actual_cmt as string) ?? ""} onChange={(e) => setForm({ ...form, actual_cmt: e.target.value })} />
                    </FormControl>
                    <FormControl>
                      <FormLabel fontSize="sm">{t("vlAssembly.list.col.unitFob")}</FormLabel>
                      <Input value={(form.unit_fob as string) ?? ""} onChange={(e) => setForm({ ...form, unit_fob: e.target.value })} />
                    </FormControl>
                    <FormControl>
                      <FormLabel fontSize="sm">{t("vlAssembly.list.col.totalFob")}</FormLabel>
                      <Input value={(form.total_fob as string) ?? ""} onChange={(e) => setForm({ ...form, total_fob: e.target.value })} />
                    </FormControl>
                    <FormControl>
                      <FormLabel fontSize="sm">{t("vlAssembly.list.col.actualFob")}</FormLabel>
                      <Input value={(form.actual_fob as string) ?? ""} onChange={(e) => setForm({ ...form, actual_fob: e.target.value })} />
                    </FormControl>
                  </Grid>
                </GridItem>
              </Grid>
            )}
          </Box>

          {/* ── Process Schedule ── */}
          <Box bg={cardBg} borderRadius="lg" border="1px solid" borderColor={borderColor} p={6}>
            <Text fontWeight="semibold" mb={4}>{t("vlAssembly.scheduleDetail.processSchedule")}</Text>
            {!isEdit ? (
              <Grid templateColumns={{ base: "1fr", md: "repeat(3, 1fr)" }} gap={5}>
                <InfoRow label={t("vlAssembly.scheduleDetail.processStartDate")} value={fmtDate(data.process_start_date)} />
                <InfoRow label={t("vlAssembly.scheduleDetail.processFinishDate")} value={fmtDate(data.process_finish_date)} />
                <InfoRow label={t("vlAssembly.scheduleDetail.leadTimeDays")} value={data.process_lead_time_days != null ? (
                  <Box>
                    <Text as="span" fontSize="sm" fontWeight="semibold">{data.process_lead_time_days.toFixed(1)}d</Text>
                    <LeadTimeExcludedHints
                      t={t}
                      sundayCount={data.process_sundays_excluded_count}
                      planHolidayCount={processHolidayHintCount}
                    />
                  </Box>
                ) : undefined} />
              </Grid>
            ) : (
              <Grid templateColumns={{ base: "1fr", md: "repeat(3, 1fr)" }} gap={4}>
                <FormControl>
                  <FormLabel fontSize="sm">{t("vlAssembly.scheduleDetail.processStartDate")}</FormLabel>
                  <LocalizedDateInput
                    value={(form.process_start_date as string) ?? ""}
                    onChange={(v) => setForm({ ...form, process_start_date: v })}
                  />
                </FormControl>
                <FormControl>
                  <FormLabel fontSize="sm">{t("vlAssembly.scheduleDetail.processFinishDate")}</FormLabel>
                  <LocalizedDateInput
                    value={(form.process_finish_date as string) ?? ""}
                    onChange={(v) => setForm({ ...form, process_finish_date: v })}
                  />
                </FormControl>
                <Box>
                  <Text fontSize="xs" color="gray.500" mb={1}>{t("vlAssembly.scheduleDetail.leadTimeDays")}</Text>
                  <Text fontSize="sm" color="gray.400" fontStyle="italic">{t("vlAssembly.common.autoCalcAfterSave")}</Text>
                </Box>
              </Grid>
            )}
          </Box>

          {/* ── Prep Material ── */}
          <Box bg={cardBg} borderRadius="lg" border="1px solid" borderColor={borderColor} p={6}>
            <Text fontWeight="semibold" mb={4}>{t("vlAssembly.scheduleDetail.prepMaterial")}</Text>
            {!isEdit ? (
              <Grid templateColumns={{ base: "1fr", md: "repeat(3, 1fr)" }} gap={5}>
                <InfoRow label={t("vlAssembly.scheduleDetail.dueInbound")} value={fmtDate(data.due_inbound_date_prep_material)} />
                <InfoRow label={t("vlAssembly.scheduleDetail.expectedInbound")} value={fmtDate(data.expected_prep_material_inbound_date)} />
                <InfoRow label={t("vlAssembly.scheduleDetail.actualInboundQty")} value={data.actual_inbound_prep_material_qty} />
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

          {/* ── Extended schedule / milestones (VL column mapping) ── */}
          <Box bg={cardBg} borderRadius="lg" border="1px solid" borderColor={borderColor} p={6}>
            <Text fontWeight="semibold" mb={4}>{t("vlAssembly.scheduleDetail.extendedFields")}</Text>
            {!isEdit ? (
              <Grid templateColumns={{ base: "1fr", md: "repeat(3, 1fr)" }} gap={5}>
                <InfoRow label={t("vlAssembly.list.col.exFactory2nd")} value={data.ex_factory_2nd || "-"} />
                <InfoRow label={t("vlAssembly.list.col.cuttingStartDate")} value={data.cutting_start_date || "-"} />
                <InfoRow label={t("vlAssembly.list.col.vienLaser")} value={data.vien_laser || "-"} />
                <InfoRow label={t("vlAssembly.list.col.printingFolding")} value={data.printing_folding || "-"} />
                <InfoRow label={t("vlAssembly.list.col.subTg")} value={data.sub_tg || "-"} />
                <InfoRow label={t("vlAssembly.list.col.subVl")} value={data.sub_vl || "-"} />
                <InfoRow label={t("vlAssembly.list.col.pre")} value={data.pre || "-"} />
                <InfoRow label={t("vlAssembly.list.col.scom")} value={data.scom || "-"} />
                <InfoRow label={t("vlAssembly.list.col.expectedDateFinished")} value={data.expected_date_finished || "-"} />
                <InfoRow label={t("vlAssembly.list.col.keep")} value={data.keep || "-"} />
                <InfoRow label={t("vlAssembly.list.col.issueOrNot")} value={data.issue_or_not || "-"} />
                <InfoRow label={t("vlAssembly.list.col.final")} value={data.final || "-"} />
                <InfoRow label={t("vlAssembly.list.col.balanceExpectedFinishDate")} value={data.balance_expected_finish_date || "-"} />
              </Grid>
            ) : (
              <Grid templateColumns={{ base: "1fr", md: "repeat(2, 1fr)" }} gap={4}>
                <FormControl>
                  <FormLabel fontSize="sm">{t("vlAssembly.list.col.exFactory2nd")}</FormLabel>
                  <Input value={(form.ex_factory_2nd as string) ?? ""} onChange={(e) => setForm({ ...form, ex_factory_2nd: e.target.value })} />
                </FormControl>
                <FormControl>
                  <FormLabel fontSize="sm">{t("vlAssembly.list.col.cuttingStartDate")}</FormLabel>
                  <Input value={(form.cutting_start_date as string) ?? ""} onChange={(e) => setForm({ ...form, cutting_start_date: e.target.value })} />
                </FormControl>
                <FormControl>
                  <FormLabel fontSize="sm">{t("vlAssembly.list.col.vienLaser")}</FormLabel>
                  <Input value={(form.vien_laser as string) ?? ""} onChange={(e) => setForm({ ...form, vien_laser: e.target.value })} />
                </FormControl>
                <FormControl>
                  <FormLabel fontSize="sm">{t("vlAssembly.list.col.printingFolding")}</FormLabel>
                  <Input value={(form.printing_folding as string) ?? ""} onChange={(e) => setForm({ ...form, printing_folding: e.target.value })} />
                </FormControl>
                <FormControl>
                  <FormLabel fontSize="sm">{t("vlAssembly.list.col.subTg")}</FormLabel>
                  <Input value={(form.sub_tg as string) ?? ""} onChange={(e) => setForm({ ...form, sub_tg: e.target.value })} />
                </FormControl>
                <FormControl>
                  <FormLabel fontSize="sm">{t("vlAssembly.list.col.subVl")}</FormLabel>
                  <Input value={(form.sub_vl as string) ?? ""} onChange={(e) => setForm({ ...form, sub_vl: e.target.value })} />
                </FormControl>
                <FormControl>
                  <FormLabel fontSize="sm">{t("vlAssembly.list.col.pre")}</FormLabel>
                  <Input value={(form.pre as string) ?? ""} onChange={(e) => setForm({ ...form, pre: e.target.value })} />
                </FormControl>
                <FormControl>
                  <FormLabel fontSize="sm">{t("vlAssembly.list.col.scom")}</FormLabel>
                  <Input value={(form.scom as string) ?? ""} onChange={(e) => setForm({ ...form, scom: e.target.value })} />
                </FormControl>
                <GridItem colSpan={{ base: 1, md: 2 }}>
                  <FormControl>
                    <FormLabel fontSize="sm">{t("vlAssembly.list.col.expectedDateFinished")}</FormLabel>
                    <Input value={(form.expected_date_finished as string) ?? ""} onChange={(e) => setForm({ ...form, expected_date_finished: e.target.value })} />
                  </FormControl>
                </GridItem>
                <FormControl>
                  <FormLabel fontSize="sm">{t("vlAssembly.list.col.keep")}</FormLabel>
                  <Input value={(form.keep as string) ?? ""} onChange={(e) => setForm({ ...form, keep: e.target.value })} />
                </FormControl>
                <FormControl>
                  <FormLabel fontSize="sm">{t("vlAssembly.list.col.issueOrNot")}</FormLabel>
                  <Textarea size="sm" rows={2} value={(form.issue_or_not as string) ?? ""} onChange={(e) => setForm({ ...form, issue_or_not: e.target.value })} />
                </FormControl>
                <FormControl>
                  <FormLabel fontSize="sm">{t("vlAssembly.list.col.final")}</FormLabel>
                  <Input value={(form.final as string) ?? ""} onChange={(e) => setForm({ ...form, final: e.target.value })} />
                </FormControl>
                <FormControl>
                  <FormLabel fontSize="sm">{t("vlAssembly.list.col.balanceExpectedFinishDate")}</FormLabel>
                  <Input value={(form.balance_expected_finish_date as string) ?? ""} onChange={(e) => setForm({ ...form, balance_expected_finish_date: e.target.value })} />
                </FormControl>
              </Grid>
            )}
          </Box>

          {/* ── VL Assembly SjNo / Module / Process ── */}
          <Box bg={cardBg} borderRadius="lg" border="1px solid" borderColor={borderColor} p={6}>
            <HStack mb={4} spacing={2}>
              <Text fontWeight="semibold">{t("vlAssembly.scheduleDetail.epSjNos")}</Text>
              <Badge colorScheme="purple">{epSjNos.length}</Badge>
            </HStack>
            {epSjNos.length === 0 ? (
              <Text fontSize="sm" color="gray.400">No VL Assembly SJ Nos found.</Text>
            ) : (
              epSjNos.map((sj) => (
                <SjNoCard key={sj.pk} sj={sj} cardBg={cardBg} borderColor={borderColor} t={t} onPhotoClick={setPhotoModalUrl} />
              ))
            )}
          </Box>

          {/* ── Remark ── */}
          <Box bg={cardBg} borderRadius="lg" border="1px solid" borderColor={borderColor} p={6}>
            <Text fontWeight="semibold" mb={4}>{t("vlAssembly.scheduleDetail.remark")}</Text>
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
          <AlertDialogBody>VL Assembly Schedule ({data.sj_order_info?.sj_po_number})을 삭제하시겠습니까?</AlertDialogBody>
          <AlertDialogFooter>
            <Button ref={cancelRef} onClick={onDeleteClose}>{t("vlAssembly.common.cancel")}</Button>
            <Button colorScheme="red" ml={3} onClick={handleDelete}>{t("vlAssembly.common.delete")}</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <PhotoModal
        isOpen={!!photoModalUrl}
        onClose={() => setPhotoModalUrl(undefined)}
        selectedImage={photoModalUrl}
      />
    </>
  );
}
