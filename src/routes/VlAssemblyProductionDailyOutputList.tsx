import {
  Alert,
  AlertIcon,
  Box,
  Button,
  Center,
  FormControl,
  FormHelperText,
  FormLabel,
  Heading,
  HStack,
  Input,
  InputGroup,
  InputRightElement,
  List,
  ListItem,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Select,
  Spinner,
  IconButton,
  Table,
  TableContainer,
  Tbody,
  Td,
  Text,
  Textarea,
  Th,
  Thead,
  Tr,
  useColorModeValue,
  useDisclosure,
  useToast
} from "@chakra-ui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Helmet } from "react-helmet";
import {
  Link as RouterLink,
  useSearchParams,
  useNavigate
} from "react-router-dom";
import { useTranslation } from "react-i18next";
import LocalizedDateInput from "../components/LocalizedDateInput";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  getVlAssemblyProductionDailyOutputs,
  createVlAssemblyProductionDailyOutput,
  getVlAssemblySchedules,
  getVlAssemblyScheduleDetail,
  getVlAssemblyProcessDetail,
  getVlAssemblyModuleDetail,
  getVlAssemblySjNoDetail,
  IVlAssemblySchedule,
  searchSjOrders,
  ISjOrderSearchResult
} from "../api";
import { FaPlus, FaChevronLeft, FaChevronRight } from "react-icons/fa";
import { refreshEpProductionCaches } from "../lib/refreshEpProductionCaches";
import SearchInput from "../components/SearchInput";
import useUser from "../lib/useUser";

/** 목록·모달에서 동일 PO 구분용 */
function formatScheduleLabel(s: IVlAssemblySchedule): string {
  const o = s.sj_order_info;
  const bits = [o?.sj_po_number ?? `#${s.pk}`, o?.style_name, o?.color].filter(
    Boolean
  );
  const line = s.production_line_name ? ` · ${s.production_line_name}` : "";
  return `${bits.join(" · ")}${line} · VL Assembly #${s.pk}`;
}

export default function VlAssemblyProductionDailyOutputList() {
  const { t } = useTranslation();
  const toast = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useUser();
  const isWorker = user?.role === "worker";
  const { isOpen, onOpen, onClose: closeDisclosure } = useDisclosure();
  const [qrScanPrefill, setQrScanPrefill] = useState(false);
  const qtyInputRef = useRef<HTMLInputElement | null>(null);

  const [scheduleFilter, setScheduleFilter] = useState<string>("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  const [selectedOrder, setSelectedOrder] =
    useState<ISjOrderSearchResult | null>(null);
  const [orderQuery, setOrderQuery] = useState("");
  const [orderResults, setOrderResults] = useState<ISjOrderSearchResult[]>([]);
  const [orderSearching, setOrderSearching] = useState(false);
  const orderSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [modalScheduleId, setModalScheduleId] = useState<string>("");
  const [modalSjNoPk, setModalSjNoPk] = useState<string>("");
  const [modalModulePk, setModalModulePk] = useState<string>("");
  const [modalProcessPk, setModalProcessPk] = useState<string>("");
  const [modalQty, setModalQty] = useState("");
  const [modalRecordedAt, setModalRecordedAt] = useState("");
  const [modalRemark, setModalRemark] = useState("");

  useEffect(() => {
    const procParam =
      searchParams.get("vl_assembly_process") ?? searchParams.get("ep_process");
    const moduleParam =
      searchParams.get("vl_assembly_module") ?? searchParams.get("ep_module");

    if (!procParam && !moduleParam) return;

    let cancelled = false;
    (async () => {
      try {
        if (procParam) {
          const pid = Number(procParam);
          if (!Number.isFinite(pid) || pid < 1) return;

          const proc = await getVlAssemblyProcessDetail(pid);
          if (cancelled) return;
          const sched = await getVlAssemblyScheduleDetail(proc.ep_schedule_pk);
          if (cancelled) return;
          const o = sched.sj_order_info;
          const sjRow = sched.ep_sj_nos?.find((s) => s.pk === proc.ep_sj_no_pk);
          const selected: ISjOrderSearchResult = {
            pk: sched.sj_order != null ? sched.sj_order : (sched.sj_order_info?.pk ?? 0),
            sj_po_number: o?.sj_po_number ?? "",
            sj_no_value: sjRow?.sj_no ?? null,
            style_name: o?.style_name ?? null,
            color: o?.color ?? null,
            total_order_qty: o?.total_order_qty ?? null,
            ex_factory_date: o?.ex_factory_date ?? null,
            buyer_name: o?.buyer_name ?? null
          };
          setQrScanPrefill(true);
          setSelectedOrder(selected);
          setOrderQuery(selected.sj_po_number);
          setOrderResults([]);
          setModalScheduleId(String(sched.pk));
          setModalSjNoPk(String(proc.ep_sj_no_pk));
          setModalModulePk(String(proc.ep_module_pk));
          setModalProcessPk(String(proc.pk));
          setModalQty("");
        } else if (moduleParam) {
          const mid = Number(moduleParam);
          if (!Number.isFinite(mid) || mid < 1) return;

          const mod = await getVlAssemblyModuleDetail(mid);
          if (cancelled) return;
          if (!mod.ep_sj_no_pk) throw new Error("missing sj no");
          const sj = await getVlAssemblySjNoDetail(mod.ep_sj_no_pk);
          if (cancelled) return;
          if (!sj.ep_schedule_pk) throw new Error("missing schedule");
          const sched = await getVlAssemblyScheduleDetail(sj.ep_schedule_pk);
          if (cancelled) return;

          const o = sched.sj_order_info;
          const sjRow = sched.ep_sj_nos?.find((s) => s.pk === mod.ep_sj_no_pk);
          const selected: ISjOrderSearchResult = {
            pk: sched.sj_order != null ? sched.sj_order : (sched.sj_order_info?.pk ?? 0),
            sj_po_number: o?.sj_po_number ?? "",
            sj_no_value: sjRow?.sj_no ?? null,
            style_name: o?.style_name ?? null,
            color: o?.color ?? null,
            total_order_qty: o?.total_order_qty ?? null,
            ex_factory_date: o?.ex_factory_date ?? null,
            buyer_name: o?.buyer_name ?? null
          };
          setQrScanPrefill(true);
          setSelectedOrder(selected);
          setOrderQuery(selected.sj_po_number);
          setOrderResults([]);
          setModalScheduleId(String(sched.pk));
          setModalSjNoPk(String(mod.ep_sj_no_pk));
          setModalModulePk(String(mod.pk));
          setModalProcessPk("");
          setModalQty("");
        }

        const now = new Date();
        const pad = (n: number) => String(n).padStart(2, "0");
        setModalRecordedAt(
          `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`
        );
        onOpen();
        navigate("/vl-assembly-production/daily-outputs", { replace: true });
      } catch {
        if (!cancelled) {
          toast({
            title: t("vlAssembly.dailyOutput.qrOpenError"),
            status: "error",
            duration: 5000
          });
          navigate("/vl-assembly-production/daily-outputs", { replace: true });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [searchParams, navigate, toast, t, onOpen]);

  useEffect(() => {
    setCurrentPage(1);
  }, [scheduleFilter, dateFrom, dateTo]);

  const pageBg = useColorModeValue("gray.50", "gray.900");
  const cardBg = useColorModeValue("white", "gray.800");
  const border = useColorModeValue("gray.200", "gray.600");
  const rowHoverBg = useColorModeValue("gray.50", "gray.700");
  const dropdownBg = useColorModeValue("white", "gray.800");
  const dropdownBorder = useColorModeValue("gray.200", "gray.600");

  const schedId = scheduleFilter ? Number(scheduleFilter) : undefined;

  const epProcessFromUrl =
    searchParams.get("vl_assembly_process") ?? searchParams.get("ep_process");
  const epProcessFilter =
    epProcessFromUrl != null && epProcessFromUrl !== ""
      ? Number(epProcessFromUrl)
      : undefined;
  const epProcessForApi =
    Number.isFinite(epProcessFilter) && (epProcessFilter as number) >= 1
      ? (epProcessFilter as number)
      : undefined;

  const { data: schedules } = useQuery({
    queryKey: ["vlSchedules", "daily-output-filter"],
    queryFn: () => getVlAssemblySchedules({})
  });

  const {
    data: listData,
    isLoading,
    isFetching,
    refetch
  } = useQuery({
    queryKey: [
      "epDailyOutputs",
      schedId,
      dateFrom,
      dateTo,
      searchQuery,
      currentPage,
      epProcessForApi
    ],
    queryFn: () =>
      getVlAssemblyProductionDailyOutputs({
        schedule: schedId,
        ep_process: epProcessForApi,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
        search: searchQuery.trim() || undefined,
        page: currentPage,
        page_size: 20
      })
  });

  const rows = listData?.results ?? [];
  const totalPages = listData?.total_pages ?? 1;
  const totalResults = listData?.total_results ?? 0;

  const { data: schedulesForOrder, isLoading: schedulesForOrderLoading } =
    useQuery({
      queryKey: ["vlSchedules", "sjOrder", selectedOrder?.pk],
      queryFn: () => getVlAssemblySchedules({ sj_order: selectedOrder!.pk }),
      enabled: isOpen && !!selectedOrder
    });

  useEffect(() => {
    if (!isOpen || !selectedOrder || !schedulesForOrder?.length) return;
    if (schedulesForOrder.length === 1) {
      setModalScheduleId(String(schedulesForOrder[0].pk));
    }
  }, [isOpen, selectedOrder, schedulesForOrder]);

  useEffect(() => {
    if (qrScanPrefill) return;
    setModalSjNoPk("");
    setModalModulePk("");
    setModalProcessPk("");
  }, [modalScheduleId, qrScanPrefill]);

  const { data: modalScheduleDetail, isLoading: modalSchedLoading } = useQuery({
    queryKey: ["epSchedule", modalScheduleId],
    queryFn: () => getVlAssemblyScheduleDetail(Number(modalScheduleId)),
    enabled: isOpen && !!modalScheduleId
  });

  const sjNos = useMemo(() => {
    if (!modalScheduleDetail?.ep_sj_nos) return [];
    return modalScheduleDetail.ep_sj_nos.filter((sj) => !sj.is_deleted);
  }, [modalScheduleDetail]);

  const modulesForSj = useMemo(() => {
    if (!modalSjNoPk) return [];
    const sj = sjNos.find((x) => String(x.pk) === modalSjNoPk);
    return (sj?.ep_modules || []).filter((m) => !m.is_deleted);
  }, [sjNos, modalSjNoPk]);

  const processesForMod = useMemo(() => {
    if (!modalModulePk) return [];
    const mod = modulesForSj.find((m) => String(m.pk) === modalModulePk);
    return (mod?.ep_processes || []).filter((p) => !p.is_deleted);
  }, [modulesForSj, modalModulePk]);

  const qrProcessSummaryLine = useMemo(() => {
    if (!modalSjNoPk || !modalModulePk || !modalProcessPk) return "";
    const sj = sjNos.find((x) => String(x.pk) === modalSjNoPk);
    const mod = modulesForSj.find((m) => String(m.pk) === modalModulePk);
    const p = processesForMod.find((x) => String(x.pk) === modalProcessPk);
    if (!sj || !mod || !p) return "";
    return `${sj.sj_no || "—"} / ${mod.code} / ${p.code} — ${p.name || p.name_ko || ""}`;
  }, [
    sjNos,
    modulesForSj,
    processesForMod,
    modalSjNoPk,
    modalModulePk,
    modalProcessPk
  ]);

  const { data: selectedProcessDetail } = useQuery({
    queryKey: ["epProcessDetail", modalProcessPk],
    queryFn: () => getVlAssemblyProcessDetail(Number(modalProcessPk)),
    enabled: isOpen && !!modalProcessPk
  });

  const totalQty = selectedProcessDetail?.total_qty ?? null;
  const cumulative = selectedProcessDetail?.output_qty ?? 0;
  const maxQtyForNew =
    totalQty != null ? Math.max(0, totalQty - cumulative) : undefined;
  const previewQty = Number(modalQty);
  const expectedTotalAfterSave =
    modalQty !== "" && Number.isFinite(previewQty) && previewQty >= 0
      ? cumulative + previewQty
      : null;

  useEffect(() => {
    if (!isOpen || !qrScanPrefill || !modalProcessPk) return;
    const tmr = window.setTimeout(() => qtyInputRef.current?.focus(), 400);
    return () => window.clearTimeout(tmr);
  }, [isOpen, qrScanPrefill, modalProcessPk]);

  const handleOrderSearch = (q: string) => {
    setOrderQuery(q);
    setSelectedOrder(null);
    setModalScheduleId("");
    setModalSjNoPk("");
    setModalModulePk("");
    setModalProcessPk("");
    if (orderSearchTimer.current) clearTimeout(orderSearchTimer.current);
    if (!q.trim()) {
      setOrderResults([]);
      return;
    }
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

  const selectOrder = (order: ISjOrderSearchResult) => {
    setSelectedOrder(order);
    setOrderQuery(order.sj_po_number);
    setOrderResults([]);
    setModalScheduleId("");
    setModalSjNoPk("");
    setModalModulePk("");
    setModalProcessPk("");
  };

  const createMut = useMutation({
    mutationFn: createVlAssemblyProductionDailyOutput,
    onSuccess: (data) => {
      toast({ title: t("vlAssembly.dailyOutput.createSuccess"), status: "success" });
      resetModalForm();
      closeDisclosure();
      void Promise.all([
        refreshEpProductionCaches(queryClient, {
          ep_schedule_pk: data.ep_schedule_pk,
          ep_process: data.ep_process
        }),
        queryClient.invalidateQueries({ queryKey: ["epDailyOutputs"] })
      ]);
    },
    onError: (err: unknown) => {
      const ax = err as { response?: { data?: { qty?: string[] } } };
      const msg =
        ax?.response?.data?.qty?.[0] ?? t("vlAssembly.dailyOutput.createError");
      toast({ title: msg, status: "error" });
    }
  });

  const resetModalForm = () => {
    setModalQty("");
    setModalRemark("");
    setSelectedOrder(null);
    setOrderQuery("");
    setOrderResults([]);
    setModalScheduleId("");
    setModalSjNoPk("");
    setModalModulePk("");
    setModalProcessPk("");
    setQrScanPrefill(false);
  };

  const handleCloseModal = () => {
    resetModalForm();
    closeDisclosure();
  };

  const openModal = () => {
    resetModalForm();
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    setModalRecordedAt(
      `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`
    );
    onOpen();
  };

  /** `/daily-outputs/new` 또는 `?add=1` — Process Production Daily Output 추가(admin)와 유사하게 모달 오픈 */
  useEffect(() => {
    if (searchParams.get("add") !== "1") return;
    if (!isWorker) {
      openModal();
    }
    navigate("/vl-assembly-production/daily-outputs", { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 의도: add=1 진입 시 1회만 모달 오픈
  }, [searchParams, isWorker, navigate]);

  const submitCreate = () => {
    const qty = Number(modalQty);
    if (!modalProcessPk || !Number.isFinite(qty) || qty < 1) return;
    if (maxQtyForNew !== undefined && qty > maxQtyForNew) return;
    let recordedAt: string | undefined;
    if (!isWorker && modalRecordedAt) {
      const d = new Date(modalRecordedAt);
      if (!Number.isNaN(d.getTime())) recordedAt = d.toISOString();
    }
    createMut.mutate({
      ep_process: Number(modalProcessPk),
      qty,
      ...(recordedAt !== undefined ? { recorded_at: recordedAt } : {}),
      remark: modalRemark.trim()
    });
  };

  const hasScheduleForOrder =
    selectedOrder && schedulesForOrder && schedulesForOrder.length > 0;
  const schedulePickNeeded =
    selectedOrder &&
    schedulesForOrder &&
    schedulesForOrder.length > 1 &&
    !schedulesForOrderLoading;

  return (
    <>
      <Helmet>
        <title>{t("vlAssembly.dailyOutput.pageTitle")}</title>
      </Helmet>
      <Box bg={pageBg} minH="100vh" px={{ base: 3, md: 5 }} py={6}>
        <Box maxW="1280px" mx="auto">
          <HStack
            justify="space-between"
            align="center"
            mb={1}
            flexWrap="wrap"
            gap={3}
          >
            <Heading size="lg">{t("vlAssembly.dailyOutput.heading")}</Heading>
            <SearchInput
              onSearch={(q) => {
                setSearchQuery(q);
                setCurrentPage(1);
              }}
              onInputChange={(v) => {
                if (v === "") {
                  setSearchQuery("");
                  setCurrentPage(1);
                }
              }}
            />
          </HStack>
          <Text fontSize="sm" color="gray.500" mb={6}>
            {t("vlAssembly.dailyOutput.subtitle")}
          </Text>

          <HStack flexWrap="wrap" spacing={3} mb={4} align="flex-end">
            <FormControl maxW="min(100%, 420px)" minW="200px">
              <FormLabel fontSize="xs">
                {t("vlAssembly.dailyOutput.filterSchedule")}
              </FormLabel>
              <Select
                size="sm"
                value={scheduleFilter}
                onChange={(e) => setScheduleFilter(e.target.value)}
                bg={cardBg}
              >
                <option value="">{t("vlAssembly.dailyOutput.allSchedules")}</option>
                {(schedules || []).map((s) => (
                  <option key={s.pk} value={s.pk}>
                    {formatScheduleLabel(s)}
                  </option>
                ))}
              </Select>
            </FormControl>
            <FormControl maxW="200px">
              <FormLabel fontSize="xs">
                {t("vlAssembly.dailyOutput.dateFrom")}
              </FormLabel>
              <LocalizedDateInput
                size="sm"
                value={dateFrom}
                onChange={setDateFrom}
                bg={cardBg}
              />
            </FormControl>
            <FormControl maxW="200px">
              <FormLabel fontSize="xs">{t("vlAssembly.dailyOutput.dateTo")}</FormLabel>
              <LocalizedDateInput
                size="sm"
                value={dateTo}
                onChange={setDateTo}
                bg={cardBg}
              />
            </FormControl>
            <Button size="sm" variant="outline" onClick={() => refetch()}>
              {t("vlAssembly.dailyOutput.refresh")}
            </Button>
            {!isWorker && (
              <Button
                as={RouterLink}
                to="/vl-assembly-production/daily-outputs/new"
                size="sm"
                colorScheme="blue"
                leftIcon={<FaPlus />}
              >
                {t("vlAssembly.dailyOutput.addRecord")}
              </Button>
            )}
          </HStack>

          <Text fontSize="sm" color="gray.600" mb={3}>
            {t("vlAssembly.dailyOutput.totalCount", { count: totalResults })}
          </Text>

          <Box
            bg={cardBg}
            borderRadius="md"
            borderWidth="1px"
            borderColor={border}
            overflow="hidden"
          >
            {isLoading ? (
              <Center py={16}>
                <Spinner />
              </Center>
            ) : (
              <TableContainer>
                <Table size="sm">
                  <Thead>
                    <Tr>
                      <Th>{t("vlAssembly.dailyOutput.colId")}</Th>
                      <Th>{t("vlAssembly.dailyOutput.colRecordedAt")}</Th>
                      <Th>{t("vlAssembly.dailyOutput.colPo")}</Th>
                      <Th>{t("vlAssembly.dailyOutput.colSjNo")}</Th>
                      <Th>{t("vlAssembly.dailyOutput.colModule")}</Th>
                      <Th>{t("vlAssembly.dailyOutput.colProcess")}</Th>
                      <Th isNumeric>{t("vlAssembly.dailyOutput.colQty")}</Th>
                      <Th isNumeric>
                        {t("vlAssembly.dailyOutput.colCumulativeAtSave")}
                      </Th>
                      <Th isNumeric>
                        {t("vlAssembly.dailyOutput.colCumulativeActual")}
                      </Th>
                      <Th>{t("vlAssembly.dailyOutput.colBy")}</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {rows.length === 0 ? (
                      <Tr>
                        <Td colSpan={10}>
                          <Text color="gray.500" py={6} textAlign="center">
                            {searchQuery.trim()
                              ? t("vlAssembly.dailyOutput.noSearchResults")
                              : t("vlAssembly.dailyOutput.noRows")}
                          </Text>
                        </Td>
                      </Tr>
                    ) : (
                      rows.map((r) => (
                        <Tr key={r.pk} _hover={{ bg: rowHoverBg }}>
                          <Td whiteSpace="nowrap">
                            <Text
                              as={RouterLink}
                              to={`/vl-assembly-production/daily-outputs/${r.pk}`}
                              color="blue.500"
                              fontWeight="semibold"
                            >
                              {r.pk}
                            </Text>
                          </Td>
                          <Td whiteSpace="nowrap">
                            <Text
                              as={RouterLink}
                              to={`/vl-assembly-production/daily-outputs/${r.pk}`}
                              color="blue.500"
                              fontWeight="medium"
                            >
                              {new Date(r.recorded_at).toLocaleString()}
                            </Text>
                          </Td>
                          <Td whiteSpace="nowrap">{r.sj_po_number}</Td>
                          <Td>{r.ep_sj_no}</Td>
                          <Td>{r.ep_module_code}</Td>
                          <Td>{r.ep_process_code}</Td>
                          <Td isNumeric fontWeight="semibold">
                            {r.qty}
                          </Td>
                          <Td isNumeric fontWeight="semibold" color="teal.600">
                            {r.process_cumulative_snapshot != null
                              ? r.process_cumulative_snapshot.toLocaleString()
                              : "—"}
                          </Td>
                          <Td isNumeric fontWeight="bold" color="blue.600">
                            {r.ep_process_output_qty ?? "—"}
                          </Td>
                          <Td fontSize="xs">{r.recorded_by_name ?? "—"}</Td>
                        </Tr>
                      ))
                    )}
                  </Tbody>
                </Table>
              </TableContainer>
            )}
          </Box>

          {totalPages > 1 && (
            <HStack justify="center" mt={6} spacing={1} flexWrap="wrap">
              <IconButton
                aria-label={t("vlAssembly.dailyOutput.paginationFirst")}
                icon={<FaChevronLeft />}
                size="sm"
                variant="ghost"
                isDisabled={currentPage <= 1 || isFetching}
                onClick={() => setCurrentPage(1)}
              />
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter(
                  (p) =>
                    p === 1 ||
                    p === totalPages ||
                    Math.abs(p - currentPage) <= 2
                )
                .reduce<(number | "...")[]>((acc, p, idx, arr) => {
                  if (idx > 0 && p - (arr[idx - 1] as number) > 1)
                    acc.push("...");
                  acc.push(p);
                  return acc;
                }, [])
                .map((item, idx) =>
                  item === "..." ? (
                    <Text key={`ellipsis-${idx}`} px={2} color="gray.400">
                      …
                    </Text>
                  ) : (
                    <Button
                      key={item}
                      size="sm"
                      variant={currentPage === item ? "solid" : "ghost"}
                      colorScheme={currentPage === item ? "blue" : "gray"}
                      isDisabled={isFetching}
                      onClick={() => setCurrentPage(item as number)}
                      minW="32px"
                    >
                      {item}
                    </Button>
                  )
                )}
              <IconButton
                aria-label={t("vlAssembly.dailyOutput.paginationLast")}
                icon={<FaChevronRight />}
                size="sm"
                variant="ghost"
                isDisabled={currentPage >= totalPages || isFetching}
                onClick={() => setCurrentPage(totalPages)}
              />
            </HStack>
          )}
        </Box>
      </Box>

      <Modal
        isOpen={isOpen}
        onClose={handleCloseModal}
        size="2xl"
        isCentered
        scrollBehavior="inside"
      >
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>{t("vlAssembly.dailyOutput.modalTitle")}</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            {qrScanPrefill && (
              <>
                <Alert status="info" borderRadius="md" mb={3} fontSize="sm">
                  <AlertIcon />
                  {t("vlAssembly.dailyOutput.fromQrScan")}
                </Alert>
                {selectedOrder && (
                  <Box
                    mb={3}
                    p={2}
                    bg="green.50"
                    borderRadius="md"
                    border="1px solid"
                    borderColor="green.200"
                    _dark={{ bg: "green.900", borderColor: "green.700" }}
                  >
                    <HStack justify="space-between" align="flex-start">
                      <Box>
                        <Text
                          fontSize="xs"
                          color="green.700"
                          fontWeight="bold"
                          _dark={{ color: "green.200" }}
                        >
                          {selectedOrder.sj_po_number}
                        </Text>
                        <Text fontSize="xs" color="gray.600">
                          {[
                            selectedOrder.sj_no_value,
                            selectedOrder.style_name,
                            selectedOrder.color
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </Text>
                      </Box>
                      <Text fontSize="xs" color="gray.500">
                        SJ Order #{selectedOrder.pk}
                      </Text>
                    </HStack>
                  </Box>
                )}
                {modalSchedLoading ? (
                  <Center py={2} mb={3}>
                    <Spinner size="sm" />
                  </Center>
                ) : (
                  <Text fontSize="sm" fontWeight="semibold" mb={3}>
                    {qrProcessSummaryLine || "—"}
                  </Text>
                )}
              </>
            )}
            {!qrScanPrefill && (
              <>
                {/* SJ Order 검색 — New VL Assembly Schedule과 동일 패턴 */}
                <FormControl mb={3} isRequired>
                  <FormLabel fontSize="sm">
                    {t("vlAssembly.dailyOutput.sjOrderSearchLabel")}
                  </FormLabel>
                  <Box position="relative">
                    <InputGroup>
                      <Input
                        value={orderQuery}
                        onChange={(e) => handleOrderSearch(e.target.value)}
                        placeholder={t(
                          "ep.dailyOutput.sjOrderSearchPlaceholder"
                        )}
                        autoComplete="off"
                        borderColor={selectedOrder ? "green.400" : undefined}
                      />
                      {orderSearching && (
                        <InputRightElement>
                          <Spinner size="sm" color="gray.400" />
                        </InputRightElement>
                      )}
                      {selectedOrder && !orderSearching && (
                        <InputRightElement color="green.400" fontSize="lg">
                          ✓
                        </InputRightElement>
                      )}
                    </InputGroup>
                    {orderResults.length > 0 && (
                      <List
                        position="absolute"
                        top="100%"
                        left={0}
                        right={0}
                        zIndex={10}
                        bg={dropdownBg}
                        border="1px solid"
                        borderColor={dropdownBorder}
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
                            _dark={{ _hover: { bg: "blue.900" } }}
                            onClick={() => selectOrder(order)}
                            borderBottom="1px solid"
                            borderColor={dropdownBorder}
                          >
                            <HStack justify="space-between" align="flex-start">
                              <Box>
                                <Text
                                  fontSize="sm"
                                  fontWeight="bold"
                                  color="blue.600"
                                >
                                  {order.sj_po_number}
                                </Text>
                                <HStack spacing={2} mt={0.5} flexWrap="wrap">
                                  {order.sj_no_value && (
                                    <Text fontSize="xs" color="gray.500">
                                      SJ No: {order.sj_no_value}
                                    </Text>
                                  )}
                                  {order.style_name && (
                                    <Text fontSize="xs" color="gray.500">
                                      {order.style_name}
                                    </Text>
                                  )}
                                  {order.color && (
                                    <Text fontSize="xs" color="gray.500">
                                      {order.color}
                                    </Text>
                                  )}
                                </HStack>
                              </Box>
                              <Box textAlign="right">
                                {order.ex_factory_date && (
                                  <Text fontSize="xs" color="orange.500">
                                    EX: {order.ex_factory_date}
                                  </Text>
                                )}
                                {order.total_order_qty != null && (
                                  <Text fontSize="xs" color="gray.500">
                                    {order.total_order_qty.toLocaleString()} pcs
                                  </Text>
                                )}
                                <Text fontSize="xs" color="gray.400">
                                  Order #{order.pk}
                                </Text>
                              </Box>
                            </HStack>
                          </ListItem>
                        ))}
                      </List>
                    )}
                  </Box>
                  {selectedOrder && (
                    <Box
                      mt={2}
                      p={2}
                      bg="green.50"
                      borderRadius="md"
                      border="1px solid"
                      borderColor="green.200"
                      _dark={{ bg: "green.900", borderColor: "green.700" }}
                    >
                      <HStack justify="space-between" align="flex-start">
                        <Box>
                          <Text
                            fontSize="xs"
                            color="green.700"
                            fontWeight="bold"
                            _dark={{ color: "green.200" }}
                          >
                            {selectedOrder.sj_po_number}
                          </Text>
                          <Text fontSize="xs" color="gray.600">
                            {[
                              selectedOrder.sj_no_value,
                              selectedOrder.style_name,
                              selectedOrder.color
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </Text>
                        </Box>
                        <Text fontSize="xs" color="gray.500">
                          SJ Order #{selectedOrder.pk}
                        </Text>
                      </HStack>
                    </Box>
                  )}
                </FormControl>

                {selectedOrder && schedulesForOrderLoading && (
                  <Center py={4}>
                    <Spinner size="sm" />
                  </Center>
                )}

                {selectedOrder &&
                  !schedulesForOrderLoading &&
                  schedulesForOrder?.length === 0 && (
                    <Text fontSize="sm" color="orange.600" mb={3}>
                      {t("vlAssembly.dailyOutput.noScheduleForOrder")}
                    </Text>
                  )}

                {schedulePickNeeded && (
                  <FormControl mb={3} isRequired>
                    <FormLabel fontSize="sm">
                      {t("vlAssembly.dailyOutput.pickEpSchedule")}
                    </FormLabel>
                    <Select
                      value={modalScheduleId}
                      placeholder="—"
                      onChange={(e) => setModalScheduleId(e.target.value)}
                    >
                      {schedulesForOrder!.map((s) => (
                        <option key={s.pk} value={s.pk}>
                          {formatScheduleLabel(s)}
                        </option>
                      ))}
                    </Select>
                    <FormHelperText>
                      {t("vlAssembly.dailyOutput.pickEpScheduleHint")}
                    </FormHelperText>
                  </FormControl>
                )}

                {hasScheduleForOrder &&
                  schedulesForOrder!.length === 1 &&
                  modalScheduleId && (
                    <Text fontSize="xs" color="gray.500" mb={3}>
                      {t("vlAssembly.dailyOutput.epScheduleLinked")}:{" "}
                      {formatScheduleLabel(schedulesForOrder![0])}
                    </Text>
                  )}

                <FormControl
                  mb={3}
                  isDisabled={!modalScheduleId || modalSchedLoading}
                >
                  <FormLabel fontSize="sm">
                    {t("vlAssembly.dailyOutput.selectSjNo")}
                  </FormLabel>
                  {modalSchedLoading ? (
                    <Spinner size="sm" />
                  ) : (
                    <Select
                      value={modalSjNoPk}
                      placeholder="—"
                      onChange={(e) => {
                        setModalSjNoPk(e.target.value);
                        setModalModulePk("");
                        setModalProcessPk("");
                      }}
                    >
                      {sjNos.map((sj) => (
                        <option key={sj.pk} value={sj.pk}>
                          {sj.sj_no || `SJ #${sj.pk}`}
                        </option>
                      ))}
                    </Select>
                  )}
                </FormControl>

                <FormControl
                  mb={3}
                  isDisabled={!modalSjNoPk || modalSchedLoading}
                >
                  <FormLabel fontSize="sm">
                    {t("vlAssembly.dailyOutput.selectModule")}
                  </FormLabel>
                  <Select
                    value={modalModulePk}
                    placeholder="—"
                    onChange={(e) => {
                      setModalModulePk(e.target.value);
                      setModalProcessPk("");
                    }}
                  >
                    {modulesForSj.map((m) => (
                      <option key={m.pk} value={m.pk}>
                        {m.code} — {m.name || ""}
                      </option>
                    ))}
                  </Select>
                </FormControl>

                <FormControl
                  mb={3}
                  isDisabled={!modalModulePk || modalSchedLoading}
                >
                  <FormLabel fontSize="sm">
                    {t("vlAssembly.dailyOutput.selectProcess")}
                  </FormLabel>
                  <Select
                    value={modalProcessPk}
                    placeholder="—"
                    onChange={(e) => setModalProcessPk(e.target.value)}
                  >
                    {processesForMod.map((p) => (
                      <option key={p.pk} value={p.pk}>
                        {p.code} — {p.name || p.name_ko || ""}
                      </option>
                    ))}
                  </Select>
                </FormControl>
              </>
            )}
            {modalProcessPk && selectedProcessDetail && (
              <Box
                mb={3}
                p={2}
                borderRadius="md"
                bg="gray.50"
                _dark={{ bg: "gray.700" }}
              >
                <Text fontSize="xs" color="gray.600" mt={0}>
                  {t("vlAssembly.dailyOutput.modalTotalQty")}:{" "}
                  <Text as="span" fontWeight="bold">
                    {totalQty != null ? totalQty.toLocaleString() : "—"}
                  </Text>
                </Text>
                <Text
                  fontSize="xs"
                  color="gray.600"
                  mt={2}
                  fontWeight="semibold"
                >
                  {t("vlAssembly.dailyOutput.processCumulativeSection")}
                </Text>
                <Text fontSize="xs" color="gray.600" mt={1} pl={2}>
                  {t("vlAssembly.dailyOutput.modalCumulativeBeforeSave")}:{" "}
                  <Text as="span" fontWeight="bold" color="teal.600">
                    {cumulative.toLocaleString()}
                  </Text>
                </Text>
                <Text fontSize="xs" color="gray.600" mt={1} pl={2}>
                  {t("vlAssembly.dailyOutput.modalCumulativeAfterSavePreview")}:{" "}
                  <Text as="span" fontWeight="bold" color="blue.600">
                    {expectedTotalAfterSave != null
                      ? expectedTotalAfterSave.toLocaleString()
                      : "—"}
                  </Text>
                </Text>
                <Text fontSize="xs" color="gray.600" mt={2}>
                  {t("vlAssembly.dailyOutput.modalRemainingQty")}:{" "}
                  <Text as="span" fontWeight="bold" color="green.600">
                    {maxQtyForNew !== undefined
                      ? maxQtyForNew.toLocaleString()
                      : "—"}
                  </Text>
                </Text>
                <Text fontSize="xs" color="gray.500" mt={2}>
                  {t("vlAssembly.dailyOutput.modalCumulativeHint")}
                </Text>
              </Box>
            )}
            <FormControl
              mb={3}
              isInvalid={Boolean(
                modalProcessPk &&
                maxQtyForNew !== undefined &&
                modalQty !== "" &&
                Number(modalQty) > maxQtyForNew
              )}
            >
              <FormLabel fontSize="sm">{t("vlAssembly.dailyOutput.qty")}</FormLabel>
              <Input
                ref={qtyInputRef}
                type="number"
                min={maxQtyForNew !== undefined && maxQtyForNew === 0 ? 0 : 1}
                max={
                  maxQtyForNew !== undefined && maxQtyForNew > 0
                    ? maxQtyForNew
                    : undefined
                }
                value={modalQty}
                onChange={(e) => {
                  const raw = e.target.value;
                  if (maxQtyForNew === undefined) {
                    setModalQty(raw);
                    return;
                  }
                  if (raw === "") {
                    setModalQty("");
                    return;
                  }
                  const n = parseInt(raw, 10);
                  if (Number.isNaN(n)) {
                    setModalQty(raw);
                    return;
                  }
                  setModalQty(String(Math.min(Math.max(0, n), maxQtyForNew)));
                }}
              />
              <FormHelperText>
                {totalQty == null
                  ? t("vlAssembly.dailyOutput.noProcessTotal")
                  : maxQtyForNew === 0
                    ? t("vlAssembly.dailyOutput.qtyRemainingZero")
                    : t("vlAssembly.dailyOutput.qtyCapHint", { max: maxQtyForNew })}
              </FormHelperText>
            </FormControl>
            <FormControl mb={3}>
              <FormLabel fontSize="sm">
                {t("vlAssembly.dailyOutput.recordedAt")}
              </FormLabel>
              <Input
                type="datetime-local"
                value={modalRecordedAt}
                isReadOnly={isWorker}
                onChange={(e) => setModalRecordedAt(e.target.value)}
              />
              {isWorker && (
                <FormHelperText>
                  {t("vlAssembly.dailyOutput.recordedAtWorkerLocked")}
                </FormHelperText>
              )}
            </FormControl>
            <FormControl>
              <FormLabel fontSize="sm">{t("vlAssembly.dailyOutput.remark")}</FormLabel>
              <Textarea
                value={modalRemark}
                onChange={(e) => setModalRemark(e.target.value)}
                rows={2}
              />
            </FormControl>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={handleCloseModal}>
              {t("vlAssembly.dailyOutput.cancel")}
            </Button>
            <Button
              colorScheme="blue"
              onClick={submitCreate}
              isLoading={createMut.isPending}
              isDisabled={(() => {
                const q = Number(modalQty);
                if (
                  !modalProcessPk ||
                  !modalScheduleId ||
                  !selectedOrder ||
                  modalQty === "" ||
                  !Number.isFinite(q) ||
                  q < 1
                )
                  return true;
                if (
                  maxQtyForNew !== undefined &&
                  (maxQtyForNew === 0 || q > maxQtyForNew)
                )
                  return true;
                return false;
              })()}
            >
              {t("vlAssembly.dailyOutput.save")}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
}
