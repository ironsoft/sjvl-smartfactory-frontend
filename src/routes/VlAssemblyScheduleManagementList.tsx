import {
  AlertDialog,
  AlertDialogBody,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogOverlay,
  Badge,
  Box,
  Button,
  Center,
  Checkbox,
  FormControl,
  FormLabel,
  Grid,
  HStack,
  Heading,
  IconButton,
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
  SimpleGrid,
  Spinner,
  Table,
  TableContainer,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tooltip,
  Tr,
  VStack,
  Wrap,
  WrapItem,
  useColorModeValue,
  useDisclosure,
  useToast,
} from "@chakra-ui/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Helmet } from "react-helmet";
import { Link as RouterLink, useNavigate } from "react-router-dom";
import { useMemo, useRef, useState } from "react";
import { FaExternalLinkAlt, FaPlus, FaTimes, FaTrash } from "react-icons/fa";
import { useTranslation } from "react-i18next";
import {
  IVlAssemblySchedule,
  ISjOrderSearchResult,
  IProductionLine,
  IModuleCategory,
  getVlAssemblySchedules,
  createVlAssemblySchedule,
  deleteVlAssemblySchedule,
  searchSjOrders,
  getProductionLines,
  getModuleCategories,
} from "../api";
import { vlKeys } from "../lib/queryKeys";
import { StatusBadge, statusOptionStyle, statusSelectFieldProps } from "../components/StatusBadge";
import LocalizedDateInput from "../components/LocalizedDateInput";
import { formatIsoDateDisplay } from "../lib/dateLocale";
import { displayModuleCategoryName } from "../lib/moduleCategoryDisplay";

// ── helpers ──────────────────────────────────────────────────────────────────

function formatProductionLineOption(line: IProductionLine): string {
  const ko = line.name_ko?.trim();
  return ko ? `${line.name} (${ko})` : line.name;
}

function collectDescendantCategoryIds(
  pk: number,
  childrenByParent: Map<number | null, IModuleCategory[]>
): number[] {
  const ids: number[] = [pk];
  for (const child of childrenByParent.get(pk) ?? []) {
    ids.push(...collectDescendantCategoryIds(child.pk, childrenByParent));
  }
  return ids;
}

function subtreeCheckboxState(
  pk: number,
  childrenByParent: Map<number | null, IModuleCategory[]>,
  selectedIds: number[]
): { checked: boolean; indeterminate: boolean } {
  const subtree = collectDescendantCategoryIds(pk, childrenByParent);
  const n = subtree.filter((id) => selectedIds.includes(id)).length;
  if (n === 0) return { checked: false, indeterminate: false };
  if (n === subtree.length) return { checked: true, indeterminate: false };
  return { checked: false, indeterminate: true };
}

function ModuleCategoryCheckboxTree({
  parentPk,
  depth,
  childrenByParent,
  selectedIds,
  onToggle,
}: {
  parentPk: number | null;
  depth: number;
  childrenByParent: Map<number | null, IModuleCategory[]>;
  selectedIds: number[];
  onToggle: (pk: number) => void;
}) {
  const { i18n } = useTranslation();
  const nodes = childrenByParent.get(parentPk) ?? [];
  if (nodes.length === 0) return null;
  return (
    <VStack align="stretch" spacing={1} pl={depth > 0 ? 4 : 0}>
      {nodes.map((cat) => {
        const { checked, indeterminate } = subtreeCheckboxState(cat.pk, childrenByParent, selectedIds);
        return (
          <Box key={cat.pk}>
            <Checkbox isChecked={checked} isIndeterminate={indeterminate} onChange={() => onToggle(cat.pk)}>
              <Text fontSize="sm">{displayModuleCategoryName(cat, i18n.language)}</Text>
            </Checkbox>
            <ModuleCategoryCheckboxTree
              parentPk={cat.pk}
              depth={depth + 1}
              childrenByParent={childrenByParent}
              selectedIds={selectedIds}
              onToggle={onToggle}
            />
          </Box>
        );
      })}
    </VStack>
  );
}

// ── empty form ────────────────────────────────────────────────────────────────

const emptyForm = {
  sj_order_ids: [] as number[],
  factory: "" as string | number,
  production_line: "" as string | number,
  status: "not_started",
  output_qty: "" as string | number,
  ex_factory_date: "",
  production_assembly_start_date: "",
  production_assembly_finish_date: "",
  process_start_date: "",
  process_finish_date: "",
  remark: "",
  module_category_ids: [] as number[],
};

// ── component ─────────────────────────────────────────────────────────────────

export default function VlAssemblyScheduleManagementList() {
  const { t, i18n } = useTranslation();
  const toast = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const borderColor = useColorModeValue("gray.200", "gray.700");
  const hoverBg = useColorModeValue("gray.50", "gray.700");
  const theadBg = useColorModeValue("gray.50", "gray.800");

  const statusOptions = [
    { value: "not_started", label: t("vlAssembly.status.not_started") },
    { value: "outsourced",  label: t("vlAssembly.status.outsourced") },
    { value: "in_progress", label: t("vlAssembly.status.in_progress") },
    { value: "completed",   label: t("vlAssembly.status.completed") },
    { value: "not_ready",   label: t("vlAssembly.status.not_ready") },
  ];

  // ── filters ──────────────────────────────────────────────────────────────
  const currentYear = new Date().getFullYear();
  const [search, setSearch] = useState("");
  const [year, setYear] = useState<string>(String(currentYear));
  const [month, setMonth] = useState<string>("");

  const { data: rawSchedules = [], isLoading } = useQuery({
    queryKey: vlKeys.list({
      search: search || undefined,
      year: year ? Number(year) : undefined,
      month: month ? Number(month) : undefined,
    }),
    queryFn: () =>
      getVlAssemblySchedules({
        search: search || undefined,
        year: year ? Number(year) : undefined,
        month: month ? Number(month) : undefined,
      }),
  });
  const schedules = useMemo(() => [...rawSchedules].sort((a, b) => b.pk - a.pk), [rawSchedules]);

  // ── production lines & module categories ─────────────────────────────────
  const { data: productionLines = [], isLoading: productionLinesLoading } = useQuery({
    queryKey: ["productionLines"],
    queryFn: getProductionLines,
  });

  const { data: allModuleCategories = [], isLoading: moduleCategoriesLoading } = useQuery({
    queryKey: ["moduleCategories"],
    queryFn: () => getModuleCategories(),
  });

  const moduleCategoryChildrenByParent = useMemo(() => {
    const map = new Map<number | null, IModuleCategory[]>();
    for (const cat of allModuleCategories) {
      const parentPk = cat.parent ?? null;
      if (!map.has(parentPk)) map.set(parentPk, []);
      map.get(parentPk)!.push(cat);
    }
    return map;
  }, [allModuleCategories]);

  const moduleCategoryRootCount = moduleCategoryChildrenByParent.get(null)?.length ?? 0;

  const factoriesFromLines = useMemo(() => {
    const byPk = new Map<number, string>();
    for (const line of productionLines) {
      if (!byPk.has(line.factory)) {
        byPk.set(line.factory, line.factory_name?.trim() || `Factory #${line.factory}`);
      }
    }
    return Array.from(byPk.entries())
      .map(([pk, name]) => ({ pk, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [productionLines]);

  // ── create modal ─────────────────────────────────────────────────────────
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [form, setForm] = useState({ ...emptyForm });
  const [isSaving, setIsSaving] = useState(false);

  const linesForSelectedFactory = useMemo(() => {
    const fk = form.factory === "" ? null : Number(form.factory);
    if (fk == null || Number.isNaN(fk)) return [];
    return productionLines.filter((l) => l.factory === fk).sort((a, b) => a.name.localeCompare(b.name));
  }, [productionLines, form.factory]);

  const [orderQuery, setOrderQuery] = useState("");
  const [orderResults, setOrderResults] = useState<ISjOrderSearchResult[]>([]);
  const [orderSearching, setOrderSearching] = useState(false);
  const [selectedOrders, setSelectedOrders] = useState<ISjOrderSearchResult[]>([]);
  const orderSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleOrderSearch = (q: string) => {
    setOrderQuery(q);
    if (orderSearchTimer.current) clearTimeout(orderSearchTimer.current);
    if (!q.trim()) { setOrderResults([]); return; }
    orderSearchTimer.current = setTimeout(async () => {
      setOrderSearching(true);
      try {
        const results = await searchSjOrders(q);
        setOrderResults(results.filter((r) => !selectedOrders.some((s) => s.pk === r.pk)));
      } finally {
        setOrderSearching(false);
      }
    }, 300);
  };

  const addSelectedOrder = (order: ISjOrderSearchResult) => {
    if (selectedOrders.some((o) => o.pk === order.pk)) return;
    if (selectedOrders.length > 0) {
      const refStyle = selectedOrders[0].sj_style_code;
      if (refStyle != null && order.sj_style_code != null && refStyle !== order.sj_style_code) {
        toast({
          title: t("vlAssembly.list.styleMismatchError", { expected: refStyle, got: order.sj_style_code }),
          status: "warning",
          duration: 4000,
          position: "bottom-right",
        });
        return;
      }
    }
    const nextOrders = [...selectedOrders, order];
    setSelectedOrders(nextOrders);
    setForm((f) => ({ ...f, sj_order_ids: nextOrders.map((o) => o.pk) }));
    setOrderResults([]);
    setOrderQuery("");
  };

  const removeSelectedOrder = (pk: number) => {
    const nextOrders = selectedOrders.filter((o) => o.pk !== pk);
    setSelectedOrders(nextOrders);
    setForm((f) => ({ ...f, sj_order_ids: nextOrders.map((o) => o.pk) }));
  };

  const toggleModuleCategory = (pk: number) => {
    const subtree = collectDescendantCategoryIds(pk, moduleCategoryChildrenByParent);
    setForm((f) => {
      const allIn = subtree.every((id) => f.module_category_ids.includes(id));
      if (allIn) {
        return { ...f, module_category_ids: f.module_category_ids.filter((id) => !subtree.includes(id)) };
      }
      return { ...f, module_category_ids: Array.from(new Set([...f.module_category_ids, ...subtree])) };
    });
  };

  const resetModal = () => {
    setForm({ ...emptyForm });
    setOrderQuery("");
    setOrderResults([]);
    setSelectedOrders([]);
  };

  const handleCreate = async () => {
    if (form.sj_order_ids.length === 0) {
      toast({ title: t("vlAssembly.list.sjOrderRequired"), status: "warning", duration: 2000, position: "bottom-right" });
      return;
    }
    if (form.module_category_ids.length === 0) {
      toast({ title: t("vlAssembly.list.moduleCategoryRequired"), status: "warning", duration: 2000, position: "bottom-right" });
      return;
    }
    setIsSaving(true);
    try {
      const exTrim = String(form.ex_factory_date ?? "").trim();
      const created = await createVlAssemblySchedule({
        sj_order_ids: form.sj_order_ids,
        production_line: form.production_line ? Number(form.production_line) : null,
        status: form.status,
        output_qty: form.output_qty !== "" ? Number(form.output_qty) : null,
        production_assembly_start_date: form.production_assembly_start_date || null,
        production_assembly_finish_date: form.production_assembly_finish_date || null,
        process_start_date: form.process_start_date || null,
        process_finish_date: form.process_finish_date || null,
        remark: form.remark,
        module_category_ids: form.module_category_ids,
        ...(exTrim ? { ex_factory_date: exTrim } : {}),
      });
      toast({ title: t("vlAssembly.list.scheduleCreated"), status: "success", duration: 2000, position: "bottom-right" });
      queryClient.invalidateQueries({ queryKey: vlKeys.all() });
      resetModal();
      onClose();
      navigate(`/vl-assembly-production/${created.pk}`);
    } catch (e: any) {
      const msg = e?.response?.data ? JSON.stringify(e.response.data) : "Failed to create schedule";
      toast({ title: msg, status: "error", duration: 3000, position: "bottom-right" });
    } finally {
      setIsSaving(false);
    }
  };

  // ── delete ────────────────────────────────────────────────────────────────
  const { isOpen: isDeleteOpen, onOpen: onDeleteOpen, onClose: onDeleteClose } = useDisclosure();
  const [deleteTarget, setDeleteTarget] = useState<IVlAssemblySchedule | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const cancelDeleteRef = useRef<HTMLButtonElement>(null);

  const openDeleteDialog = (sched: IVlAssemblySchedule, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDeleteTarget(sched);
    onDeleteOpen();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await deleteVlAssemblySchedule(deleteTarget.pk);
      toast({ title: t("vlAssembly.common.deleted"), status: "success", duration: 2000, position: "bottom-right" });
      queryClient.invalidateQueries({ queryKey: vlKeys.all() });
      onDeleteClose();
      setDeleteTarget(null);
    } catch {
      toast({ title: t("vlAssembly.common.failedDelete"), status: "error", duration: 3000, position: "bottom-right" });
    } finally {
      setIsDeleting(false);
    }
  };

  // ── helpers for display ───────────────────────────────────────────────────
  const fmtDate = (d?: string | null) => formatIsoDateDisplay(d, i18n.language);

  const scheduleLabel = (s: IVlAssemblySchedule) => {
    const o = s.sj_order_info;
    if (o?.sj_po_number) return o.sj_po_number;
    return `#${s.pk}`;
  };

  const ganttUrl = (s: IVlAssemblySchedule) => {
    const dateStr = s.production_assembly_start_date ?? s.process_start_date ?? null;
    const params = new URLSearchParams({ highlight: String(s.pk) });
    if (dateStr) {
      const d = new Date(dateStr);
      params.set("year", String(d.getFullYear()));
      params.set("month", String(d.getMonth() + 1));
    }
    return `/vl-assembly-production?${params.toString()}`;
  };

  return (
    <Box px={{ base: 4, md: 8 }} py={6} maxW="1600px" mx="auto">
      <Helmet>
        <title>{t("vlAssemblyScheduleList.pageTitle")} — SJ VL Assembly</title>
      </Helmet>

      {/* ── header ──────────────────────────────────────────────────────── */}
      <HStack justify="space-between" mb={5} flexWrap="wrap" gap={3}>
        <Heading size="md">{t("vlAssemblyScheduleList.heading")}</Heading>
        <Button leftIcon={<FaPlus />} colorScheme="blue" size="sm" onClick={onOpen}>
          {t("vlAssembly.list.newSchedule")}
        </Button>
      </HStack>

      {/* ── filters ──────────────────────────────────────────────────────── */}
      <HStack mb={4} flexWrap="wrap" gap={3}>
        <Input
          placeholder={t("vlAssemblyScheduleList.searchPlaceholder")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          maxW="280px"
          size="sm"
        />
        <Select
          value={year}
          onChange={(e) => setYear(e.target.value)}
          maxW="120px"
          size="sm"
        >
          <option value="">{t("vlAssemblyScheduleList.allYears")}</option>
          {[currentYear - 1, currentYear, currentYear + 1].map((y) => (
            <option key={y} value={String(y)}>{y}</option>
          ))}
        </Select>
        <Select
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          maxW="120px"
          size="sm"
        >
          <option value="">{t("vlAssemblyScheduleList.allMonths")}</option>
          {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
            <option key={m} value={String(m)}>{m}{t("vlAssemblyScheduleList.monthSuffix")}</option>
          ))}
        </Select>
      </HStack>

      {/* ── count ────────────────────────────────────────────────────────── */}
      <Text fontSize="sm" color="gray.500" mb={3}>
        {isLoading ? "" : t("vlAssemblyScheduleList.count", { count: schedules.length })}
      </Text>

      {/* ── table ────────────────────────────────────────────────────────── */}
      {isLoading ? (
        <Center py={16}><Spinner size="lg" color="blue.400" /></Center>
      ) : schedules.length === 0 ? (
        <Center py={16}>
          <Text color="gray.500">{t("vlAssemblyScheduleList.empty")}</Text>
        </Center>
      ) : (
        <TableContainer borderRadius="md" border="1px solid" borderColor={borderColor} overflowX="auto">
          <Table size="sm" variant="simple">
            <Thead bg={theadBg}>
              <Tr>
                <Th>#</Th>
                <Th>{t("vlAssemblyScheduleList.col.sjOrder")}</Th>
                <Th>{t("vlAssemblyScheduleList.col.status")}</Th>
                <Th>{t("vlAssemblyScheduleList.col.productionLine")}</Th>
                <Th>{t("vlAssemblyScheduleList.col.assemblyStart")}</Th>
                <Th>{t("vlAssemblyScheduleList.col.assemblyFinish")}</Th>
                <Th>{t("vlAssemblyScheduleList.col.processStart")}</Th>
                <Th>{t("vlAssemblyScheduleList.col.processFinish")}</Th>
                <Th isNumeric>{t("vlAssemblyScheduleList.col.outputQty")}</Th>
                <Th>{t("vlAssemblyScheduleList.col.remark")}</Th>
                <Th />
              </Tr>
            </Thead>
            <Tbody>
              {schedules.map((s) => (
                <Tr
                  key={s.pk}
                  cursor="pointer"
                  _hover={{ bg: hoverBg }}
                  onClick={() => navigate(`/vl-assembly-production/${s.pk}`)}
                >
                  <Td>
                    <Text fontSize="xs" color="gray.500">
                      #{s.pk}
                    </Text>
                  </Td>
                  <Td>
                    <Text fontWeight="semibold" fontSize="sm">
                      {scheduleLabel(s)}
                    </Text>
                    {s.sj_order_info?.style_name && (
                      <Text fontSize="xs" color="gray.500">{s.sj_order_info.style_name}</Text>
                    )}
                  </Td>
                  <Td>
                    <StatusBadge status={s.status} />
                  </Td>
                  <Td>
                    <Text fontSize="sm">{s.production_line_name ?? "—"}</Text>
                  </Td>
                  <Td>
                    <Text fontSize="sm">{fmtDate(s.production_assembly_start_date) || "—"}</Text>
                  </Td>
                  <Td>
                    <Text fontSize="sm">{fmtDate(s.production_assembly_finish_date) || "—"}</Text>
                  </Td>
                  <Td>
                    <Text fontSize="sm">{fmtDate(s.process_start_date) || "—"}</Text>
                  </Td>
                  <Td>
                    <Text fontSize="sm">{fmtDate(s.process_finish_date) || "—"}</Text>
                  </Td>
                  <Td isNumeric>
                    <Text fontSize="sm">{s.output_qty != null ? s.output_qty.toLocaleString() : "—"}</Text>
                  </Td>
                  <Td maxW="200px">
                    <Text fontSize="xs" color="gray.500" noOfLines={1}>{s.remark || "—"}</Text>
                  </Td>
                  <Td onClick={(e) => e.stopPropagation()}>
                    <HStack spacing={1}>
                    <Tooltip label={t("vlAssemblyScheduleList.viewInGantt")} placement="top">
                      <IconButton
                        as={RouterLink}
                        to={ganttUrl(s)}
                        aria-label="view in gantt"
                        icon={<FaExternalLinkAlt />}
                        size="xs"
                        variant="ghost"
                        colorScheme="blue"
                      />
                    </Tooltip>
                    <Tooltip label={t("vlAssembly.common.delete")} placement="top">
                      <IconButton
                        aria-label="delete schedule"
                        icon={<FaTrash />}
                        size="xs"
                        variant="ghost"
                        colorScheme="red"
                        onClick={(e) => openDeleteDialog(s, e)}
                      />
                    </Tooltip>
                    </HStack>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </TableContainer>
      )}

      {/* ── create modal ─────────────────────────────────────────────────── */}
      <Modal isOpen={isOpen} onClose={() => { resetModal(); onClose(); }} size="2xl" isCentered scrollBehavior="inside">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>{t("vlAssembly.list.newSchedule")}</ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={2}>
            <Grid templateColumns="1fr 1fr" gap={4}>

              {/* SJ Order 검색 (다중 선택) */}
              <FormControl isRequired gridColumn="1 / -1">
                <FormLabel fontSize="sm">SJ Order</FormLabel>
                <Box position="relative">
                  <InputGroup>
                    <Input
                      value={orderQuery}
                      onChange={(e) => handleOrderSearch(e.target.value)}
                      placeholder="SJ PO# 또는 SJ No 검색"
                      autoComplete="off"
                      borderColor={selectedOrders.length > 0 ? "green.400" : undefined}
                    />
                    {orderSearching ? (
                      <InputRightElement><Spinner size="sm" color="gray.400" /></InputRightElement>
                    ) : selectedOrders.length > 0 ? (
                      <InputRightElement color="green.400" fontSize="lg">✓</InputRightElement>
                    ) : null}
                  </InputGroup>
                  {orderResults.length > 0 && (
                    <List
                      position="absolute"
                      top="100%"
                      left={0}
                      right={0}
                      zIndex={10}
                      bg="white"
                      border="1px solid"
                      borderColor="gray.200"
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
                          onClick={() => addSelectedOrder(order)}
                          borderBottom="1px solid"
                          borderColor="gray.100"
                        >
                          <HStack justify="space-between">
                            <Box>
                              <Text fontSize="sm" fontWeight="bold" color="blue.600">{order.sj_po_number}</Text>
                              <HStack spacing={2} mt={0.5}>
                                {order.sj_no_value && <Text fontSize="xs" color="gray.500">SJ No: {order.sj_no_value}</Text>}
                                {order.style_name && <Text fontSize="xs" color="gray.500">{order.style_name}</Text>}
                              </HStack>
                            </Box>
                            <Box textAlign="right">
                              {order.ex_factory_date && <Text fontSize="xs" color="orange.500">EX: {order.ex_factory_date}</Text>}
                              {order.total_order_qty && <Text fontSize="xs" color="gray.500">{order.total_order_qty.toLocaleString()} pcs</Text>}
                            </Box>
                          </HStack>
                        </ListItem>
                      ))}
                    </List>
                  )}
                </Box>
                {selectedOrders.length > 0 && (
                  <Wrap mt={2} spacing={2}>
                    {selectedOrders.map((order) => (
                      <WrapItem key={order.pk}>
                        <Badge colorScheme="green" px={2} py={1} borderRadius="md" display="flex" alignItems="center" gap={1}>
                          <Box>
                            <Text fontSize="xs" fontWeight="bold">{order.sj_po_number}</Text>
                            <Text fontSize="10px" color="green.700">
                              {[order.sj_no_value, order.style_name].filter(Boolean).join(" · ")}
                            </Text>
                          </Box>
                          <IconButton
                            aria-label="Remove order"
                            icon={<FaTimes />}
                            size="xs"
                            variant="ghost"
                            colorScheme="green"
                            onClick={() => removeSelectedOrder(order.pk)}
                          />
                        </Badge>
                      </WrapItem>
                    ))}
                  </Wrap>
                )}
              </FormControl>

              <FormControl gridColumn="1 / -1">
                <FormLabel fontSize="sm">{t("vlAssembly.scheduleDetail.exFactory")}</FormLabel>
                <LocalizedDateInput
                  value={form.ex_factory_date}
                  onChange={(v) => setForm({ ...form, ex_factory_date: v })}
                  allowClear
                />
              </FormControl>

              <SimpleGrid columns={{ base: 1, md: 2 }} gap={4} gridColumn="1 / -1" w="100%">
                <FormControl>
                  <FormLabel fontSize="sm">{t("vlAssembly.list.factoryField")}</FormLabel>
                  <Select
                    placeholder={t("vlAssembly.list.factoryPlaceholder")}
                    value={form.factory === "" ? "" : String(form.factory)}
                    onChange={(e) => {
                      setForm((f) => ({ ...f, factory: e.target.value, production_line: "" }));
                    }}
                    isDisabled={productionLinesLoading}
                  >
                    <option value="">{t("vlAssembly.list.factoryNone")}</option>
                    {factoriesFromLines.map((fac) => (
                      <option key={fac.pk} value={String(fac.pk)}>{fac.name}</option>
                    ))}
                  </Select>
                </FormControl>
                <FormControl>
                  <FormLabel fontSize="sm">{t("vlAssembly.list.productionLineField")}</FormLabel>
                  <Select
                    placeholder={t("vlAssembly.list.productionLinePlaceholder")}
                    value={form.production_line === "" ? "" : String(form.production_line)}
                    onChange={(e) => setForm({ ...form, production_line: e.target.value })}
                    isDisabled={productionLinesLoading || form.factory === ""}
                  >
                    <option value="">{t("vlAssembly.list.productionLineNone")}</option>
                    {linesForSelectedFactory.map((line) => (
                      <option key={line.pk} value={String(line.pk)}>
                        {formatProductionLineOption(line)}
                      </option>
                    ))}
                  </Select>
                </FormControl>
              </SimpleGrid>

              <FormControl>
                <FormLabel fontSize="sm">Status</FormLabel>
                <Select
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                  {...statusSelectFieldProps(String(form.status || "not_started"))}
                >
                  {statusOptions.map((o) => (
                    <option key={o.value} value={o.value} style={statusOptionStyle(o.value)}>
                      {o.label}
                    </option>
                  ))}
                </Select>
              </FormControl>

              <FormControl>
                <FormLabel fontSize="sm">Output Qty</FormLabel>
                <Input
                  type="number"
                  value={form.output_qty}
                  onChange={(e) => setForm({ ...form, output_qty: e.target.value })}
                />
              </FormControl>

              <FormControl>
                <FormLabel fontSize="sm">Assembly Start Date</FormLabel>
                <LocalizedDateInput
                  value={form.production_assembly_start_date}
                  onChange={(v) => setForm({ ...form, production_assembly_start_date: v })}
                />
              </FormControl>
              <FormControl>
                <FormLabel fontSize="sm">Assembly Finish Date</FormLabel>
                <LocalizedDateInput
                  value={form.production_assembly_finish_date}
                  onChange={(v) => setForm({ ...form, production_assembly_finish_date: v })}
                />
              </FormControl>
              <FormControl>
                <FormLabel fontSize="sm">Process Start Date</FormLabel>
                <LocalizedDateInput
                  value={form.process_start_date}
                  onChange={(v) => setForm({ ...form, process_start_date: v })}
                />
              </FormControl>
              <FormControl>
                <FormLabel fontSize="sm">Process Finish Date</FormLabel>
                <LocalizedDateInput
                  value={form.process_finish_date}
                  onChange={(v) => setForm({ ...form, process_finish_date: v })}
                />
              </FormControl>

              <FormControl isRequired gridColumn="1 / -1">
                <FormLabel fontSize="sm">{t("vlAssembly.list.moduleCategoryLabel")}</FormLabel>
                <Text fontSize="xs" color="gray.500" mb={2}>{t("vlAssembly.list.moduleCategoryHint")}</Text>
                {moduleCategoriesLoading ? (
                  <Spinner size="sm" color="gray.400" />
                ) : moduleCategoryRootCount === 0 ? (
                  <Text fontSize="sm" color="gray.500">{t("vlAssembly.list.moduleCategoryEmpty")}</Text>
                ) : (
                  <Box maxH="280px" overflowY="auto" pr={1}>
                    <ModuleCategoryCheckboxTree
                      parentPk={null}
                      depth={0}
                      childrenByParent={moduleCategoryChildrenByParent}
                      selectedIds={form.module_category_ids}
                      onToggle={toggleModuleCategory}
                    />
                  </Box>
                )}
              </FormControl>

              <FormControl gridColumn="1 / -1">
                <FormLabel fontSize="sm">Remark</FormLabel>
                <Input
                  value={form.remark}
                  onChange={(e) => setForm({ ...form, remark: e.target.value })}
                />
              </FormControl>
            </Grid>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={() => { resetModal(); onClose(); }}>
              {t("vlAssembly.common.cancel")}
            </Button>
            <Button colorScheme="blue" isLoading={isSaving} onClick={handleCreate}>
              Create
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* ── delete confirm ────────────────────────────────────────────────── */}
      <AlertDialog isOpen={isDeleteOpen} leastDestructiveRef={cancelDeleteRef} onClose={onDeleteClose} isCentered>
        <AlertDialogOverlay />
        <AlertDialogContent>
          <AlertDialogHeader fontSize="lg" fontWeight="bold">
            {t("vlAssembly.common.deleteTitle")}
          </AlertDialogHeader>
          <AlertDialogBody>
            {t("vlAssembly.common.deleteConfirm")}
            {deleteTarget && (
              <Text mt={2} fontWeight="semibold">{scheduleLabel(deleteTarget)}</Text>
            )}
          </AlertDialogBody>
          <AlertDialogFooter>
            <Button ref={cancelDeleteRef} onClick={onDeleteClose}>{t("vlAssembly.common.cancel")}</Button>
            <Button colorScheme="red" ml={3} isLoading={isDeleting} onClick={handleDelete}>
              {t("vlAssembly.common.delete")}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Box>
  );
}
