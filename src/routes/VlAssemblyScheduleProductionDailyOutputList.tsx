import {
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
import { useEffect, useRef, useState } from "react";
import {
  getVlAssemblyScheduleProductionDailyOutputs,
  createVlAssemblyScheduleProductionDailyOutput,
  getVlAssemblySchedules,
  getVlAssemblyScheduleDetail,
  getVlAssemblySjNoDetail,
  IVlAssemblySchedule,
  searchSjOrders,
  ISjOrderSearchResult
} from "../api";
import { FaPlus, FaChevronLeft, FaChevronRight } from "react-icons/fa";
import LocalizedDateInput from "../components/LocalizedDateInput";
import SearchInput from "../components/SearchInput";
import useUser from "../lib/useUser";
import { broadcastVlAssemblyScheduleListCacheBust } from "../lib/vlAssemblyProductionScheduleListCacheBust";

function formatScheduleLabel(s: IVlAssemblySchedule): string {
  const o = s.sj_order_info;
  const bits = [o?.sj_po_number ?? `#${s.pk}`, o?.style_name, o?.color].filter(
    Boolean
  );
  const line = s.production_line_name ? ` · ${s.production_line_name}` : "";
  return `${bits.join(" · ")}${line} · VL Assembly #${s.pk}`;
}

export default function VlAssemblyScheduleProductionDailyOutputList() {
  const { t } = useTranslation();
  const toast = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useUser();
  const isWorker = user?.role === "worker";
  const { isOpen, onOpen, onClose: closeDisclosure } = useDisclosure();
  const [qrSchedPrefill, setQrSchedPrefill] = useState(false);
  const qtyInputRef = useRef<HTMLInputElement | null>(null);

  const [scheduleFilter, setScheduleFilter] = useState("");
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

  const [modalScheduleId, setModalScheduleId] = useState("");
  const [modalSjNoId, setModalSjNoId] = useState("");
  const [modalQty, setModalQty] = useState("");
  const [modalRecordedAt, setModalRecordedAt] = useState("");
  const [modalRemark, setModalRemark] = useState("");

  const { data: modalSjNoRow } = useQuery({
    queryKey: ["vlSjNo", modalSjNoId],
    queryFn: () => getVlAssemblySjNoDetail(Number(modalSjNoId)),
    enabled: isOpen && !!modalSjNoId && qrSchedPrefill
  });

  useEffect(() => {
    const sp = searchParams.get("vl_assembly_schedule");
    if (!sp) return;
    const sid = Number(sp);
    if (!Number.isFinite(sid) || sid < 1) return;
    let cancelled = false;
    (async () => {
      try {
        await getVlAssemblyScheduleDetail(sid);
        if (cancelled) return;
        const sjNoParam = searchParams.get("vl_assembly_sj_no");
        const sjNoId = sjNoParam ? Number(sjNoParam) : null;
        setQrSchedPrefill(true);
        setModalScheduleId(String(sid));
        setModalSjNoId(sjNoId && Number.isFinite(sjNoId) && sjNoId >= 1 ? String(sjNoId) : "");
        setModalQty("");
        const now = new Date();
        const pad = (n: number) => String(n).padStart(2, "0");
        setModalRecordedAt(
          `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`
        );
        onOpen();
        navigate("/vl-assembly-production/schedule-daily-outputs", {
          replace: true
        });
      } catch {
        if (!cancelled) {
          toast({
            title: t("vlAssembly.scheduleProductionDailyOutput.qrOpenError"),
            status: "error",
            duration: 5000
          });
          navigate("/vl-assembly-production/schedule-daily-outputs", {
            replace: true
          });
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

  const { data: schedules } = useQuery({
    queryKey: ["vlSchedules", "schedule-prod-daily-filter"],
    queryFn: () => getVlAssemblySchedules({})
  });

  const { data: listData, isLoading, isFetching, refetch } = useQuery({
    queryKey: [
      "vlScheduleProductionDailyOutputs",
      schedId,
      dateFrom,
      dateTo,
      searchQuery,
      currentPage
    ],
    queryFn: () =>
      getVlAssemblyScheduleProductionDailyOutputs({
        schedule: schedId,
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
    if (!isOpen || !qrSchedPrefill || !modalScheduleId) return;
    const tmr = window.setTimeout(() => qtyInputRef.current?.focus(), 400);
    return () => window.clearTimeout(tmr);
  }, [isOpen, qrSchedPrefill, modalScheduleId]);

  const { data: modalScheduleRow } = useQuery({
    queryKey: ["epSchedule", modalScheduleId],
    queryFn: () => getVlAssemblyScheduleDetail(Number(modalScheduleId)),
    enabled: isOpen && !!modalScheduleId
  });

  const resetModalForm = () => {
    setModalQty("");
    setModalRemark("");
    setSelectedOrder(null);
    setOrderQuery("");
    setOrderResults([]);
    setModalScheduleId("");
    setModalSjNoId("");
    setQrSchedPrefill(false);
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

  useEffect(() => {
    if (searchParams.get("add") !== "1") return;
    if (!isWorker) {
      openModal();
    }
    navigate("/vl-assembly-production/schedule-daily-outputs", {
      replace: true
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, isWorker, navigate]);

  const handleOrderSearch = (q: string) => {
    setOrderQuery(q);
    setSelectedOrder(null);
    setModalScheduleId("");
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
  };

  const createMut = useMutation({
    mutationFn: createVlAssemblyScheduleProductionDailyOutput,
    onSuccess: (data) => {
      toast({
        title: t("vlAssembly.scheduleProductionDailyOutput.createSuccess"),
        status: "success"
      });
      resetModalForm();
      closeDisclosure();
      void queryClient.invalidateQueries({
        queryKey: ["vlScheduleProductionDailyOutputs"]
      });
      void queryClient.invalidateQueries({
        queryKey: ["vlSjNoScheduleProductionDailyOutputs"]
      });
      void queryClient.invalidateQueries({
        queryKey: ["vlSjNoScheduleProductionDailyOutputChart"]
      });
      void queryClient.invalidateQueries({
        queryKey: ["epSchedule", String(data.vl_assembly_schedule)]
      });
      void queryClient.invalidateQueries({ queryKey: ["vlSchedules"] });
      broadcastVlAssemblyScheduleListCacheBust();
    },
    onError: (err: unknown) => {
      const ax = err as { response?: { data?: { qty?: string[] } } };
      const msg =
        ax?.response?.data?.qty?.[0] ??
        t("vlAssembly.scheduleProductionDailyOutput.createError");
      toast({ title: msg, status: "error" });
    }
  });

  const submitCreate = () => {
    const qty = Number(modalQty);
    if (!modalScheduleId || !Number.isFinite(qty) || qty < 1) return;
    let recordedAt: string | undefined;
    if (!isWorker && modalRecordedAt) {
      const d = new Date(modalRecordedAt);
      if (!Number.isNaN(d.getTime())) recordedAt = d.toISOString();
    }
    const sjNoId = modalSjNoId ? Number(modalSjNoId) : undefined;
    createMut.mutate({
      vl_assembly_schedule: Number(modalScheduleId),
      ...(sjNoId != null && Number.isFinite(sjNoId) ? { vl_assembly_sj_no: sjNoId } : {}),
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
        <title>{t("vlAssembly.scheduleProductionDailyOutput.pageTitle")}</title>
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
            <Heading size="lg">
              {t("vlAssembly.scheduleProductionDailyOutput.heading")}
            </Heading>
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
            {t("vlAssembly.scheduleProductionDailyOutput.subtitle")}
          </Text>

          <HStack flexWrap="wrap" spacing={3} mb={4} align="flex-end">
            <FormControl maxW="min(100%, 420px)" minW="200px">
              <FormLabel fontSize="xs">
                {t("vlAssembly.scheduleProductionDailyOutput.filterSchedule")}
              </FormLabel>
              <Select
                size="sm"
                value={scheduleFilter}
                onChange={(e) => setScheduleFilter(e.target.value)}
                bg={cardBg}
              >
                <option value="">
                  {t("vlAssembly.scheduleProductionDailyOutput.allSchedules")}
                </option>
                {(schedules || []).map((s) => (
                  <option key={s.pk} value={s.pk}>
                    {formatScheduleLabel(s)}
                  </option>
                ))}
              </Select>
            </FormControl>
            <FormControl maxW="200px">
              <FormLabel fontSize="xs">
                {t("vlAssembly.scheduleProductionDailyOutput.dateFrom")}
              </FormLabel>
              <LocalizedDateInput
                size="sm"
                value={dateFrom}
                onChange={setDateFrom}
                bg={cardBg}
              />
            </FormControl>
            <FormControl maxW="200px">
              <FormLabel fontSize="xs">
                {t("vlAssembly.scheduleProductionDailyOutput.dateTo")}
              </FormLabel>
              <LocalizedDateInput
                size="sm"
                value={dateTo}
                onChange={setDateTo}
                bg={cardBg}
              />
            </FormControl>
            <Button size="sm" variant="outline" onClick={() => refetch()}>
              {t("vlAssembly.scheduleProductionDailyOutput.refresh")}
            </Button>
            {!isWorker && (
              <Button
                as={RouterLink}
                to="/vl-assembly-production/schedule-daily-outputs/new"
                size="sm"
                colorScheme="blue"
                leftIcon={<FaPlus />}
              >
                {t("vlAssembly.scheduleProductionDailyOutput.addRecord")}
              </Button>
            )}
          </HStack>

          <Text fontSize="sm" color="gray.600" mb={3}>
            {t("vlAssembly.scheduleProductionDailyOutput.totalCount", {
              count: totalResults
            })}
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
                      <Th>
                        {t("vlAssembly.scheduleProductionDailyOutput.colId")}
                      </Th>
                      <Th>
                        {t("vlAssembly.scheduleProductionDailyOutput.colRecordedAt")}
                      </Th>
                      <Th>
                        {t("vlAssembly.scheduleProductionDailyOutput.colPo")}
                      </Th>
                      <Th>
                        {t("vlAssembly.scheduleProductionDailyOutput.colSchedulePk")}
                      </Th>
                      <Th isNumeric>
                        {t("vlAssembly.scheduleProductionDailyOutput.colQty")}
                      </Th>
                      <Th isNumeric>
                        {t(
                          "vlAssembly.scheduleProductionDailyOutput.colScheduleCumulative"
                        )}
                      </Th>
                      <Th>
                        {t("vlAssembly.scheduleProductionDailyOutput.colBy")}
                      </Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {rows.length === 0 ? (
                      <Tr>
                        <Td colSpan={7}>
                          <Text color="gray.500" py={6} textAlign="center">
                            {searchQuery.trim()
                              ? t(
                                  "vlAssembly.scheduleProductionDailyOutput.noSearchResults"
                                )
                              : t("vlAssembly.scheduleProductionDailyOutput.noRows")}
                          </Text>
                        </Td>
                      </Tr>
                    ) : (
                      rows.map((r) => (
                        <Tr key={r.pk} _hover={{ bg: rowHoverBg }}>
                          <Td whiteSpace="nowrap">
                            <Text
                              as={RouterLink}
                              to={`/vl-assembly-production/schedule-daily-outputs/${r.pk}`}
                              color="blue.500"
                              fontWeight="semibold"
                            >
                              {r.pk}
                            </Text>
                          </Td>
                          <Td whiteSpace="nowrap">
                            <Text
                              as={RouterLink}
                              to={`/vl-assembly-production/schedule-daily-outputs/${r.pk}`}
                              color="blue.500"
                              fontWeight="medium"
                            >
                              {new Date(r.recorded_at).toLocaleString()}
                            </Text>
                          </Td>
                          <Td whiteSpace="nowrap">
                            {r.sj_po_number ?? "—"}
                          </Td>
                          <Td>
                            <Text
                              as={RouterLink}
                              to={`/vl-assembly-production/${r.vl_assembly_schedule}`}
                              color="blue.500"
                              fontSize="sm"
                            >
                              #{r.vl_assembly_schedule}
                            </Text>
                          </Td>
                          <Td isNumeric fontWeight="semibold">
                            {r.qty}
                          </Td>
                          <Td isNumeric fontWeight="semibold" color="teal.600">
                            {r.schedule_cumulative_snapshot != null
                              ? r.schedule_cumulative_snapshot.toLocaleString()
                              : "—"}
                          </Td>
                          <Td fontSize="xs">
                            {r.recorded_by_name ?? "—"}
                          </Td>
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
                aria-label={t(
                  "vlAssembly.scheduleProductionDailyOutput.paginationFirst"
                )}
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
                aria-label={t(
                  "vlAssembly.scheduleProductionDailyOutput.paginationLast"
                )}
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
        size="lg"
        isCentered
        scrollBehavior="inside"
      >
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>
            {t("vlAssembly.scheduleProductionDailyOutput.modalTitle")}
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            {qrSchedPrefill && (
              <Text fontSize="sm" color="gray.600" mb={3}>
                {t("vlAssembly.scheduleProductionDailyOutput.fromSchedLink")}
                {modalScheduleRow && (
                  <Text as="span" display="block" fontWeight="semibold" mt={1}>
                    {formatScheduleLabel(modalScheduleRow as IVlAssemblySchedule)}
                  </Text>
                )}
                {modalSjNoRow && (
                  <Text as="span" display="block" color="purple.600" fontWeight="semibold" mt={0.5}>
                    SJ No: {modalSjNoRow.sj_no}
                  </Text>
                )}
              </Text>
            )}

            {!qrSchedPrefill && (
              <>
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
                            <Text fontSize="sm" fontWeight="bold" color="blue.600">
                              {order.sj_po_number}
                            </Text>
                          </ListItem>
                        ))}
                      </List>
                    )}
                  </Box>
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

                {!selectedOrder && (
                  <FormControl mb={3}>
                    <FormLabel fontSize="sm">
                      {t("vlAssembly.scheduleProductionDailyOutput.selectSchedule")}
                    </FormLabel>
                    <Select
                      value={modalScheduleId}
                      placeholder="—"
                      onChange={(e) => setModalScheduleId(e.target.value)}
                      bg={cardBg}
                    >
                      <option value="">—</option>
                      {(schedules || []).map((s) => (
                        <option key={s.pk} value={s.pk}>
                          {formatScheduleLabel(s)}
                        </option>
                      ))}
                    </Select>
                    <FormHelperText>
                      {t("vlAssembly.scheduleProductionDailyOutput.selectScheduleHint")}
                    </FormHelperText>
                  </FormControl>
                )}
              </>
            )}

            <FormControl mb={3} isInvalid={false}>
              <FormLabel fontSize="sm">
                {t("vlAssembly.dailyOutput.qty")}
              </FormLabel>
              <Input
                ref={qtyInputRef}
                type="number"
                min={1}
                value={modalQty}
                onChange={(e) => setModalQty(e.target.value)}
              />
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
            </FormControl>
            <FormControl>
              <FormLabel fontSize="sm">
                {t("vlAssembly.dailyOutput.remark")}
              </FormLabel>
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
                  !modalScheduleId ||
                  modalQty === "" ||
                  !Number.isFinite(q) ||
                  q < 1
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
