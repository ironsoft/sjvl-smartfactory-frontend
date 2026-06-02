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
  Divider,
  Grid,
  HStack,
  Heading,
  Image,
  Input,
  FormControl,
  FormLabel,
  Link,
  List,
  ListItem,
  IconButton,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Spinner,
  Table,
  TableContainer,
  Tbody,
  Td,
  Text,
  Select,
  Stack,
  RadioGroup,
  Radio,
  Th,
  Thead,
  Tr,
  useColorModeValue,
  useDisclosure,
  useToast,
} from "@chakra-ui/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Helmet } from "react-helmet";
import { useParams, useNavigate, Link as RouterLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useEffect, useMemo, useRef, useState } from "react";
import { FaArrowLeft, FaCamera, FaEdit, FaExternalLinkAlt, FaPlus, FaTrash, FaTrashAlt, FaVideo } from "react-icons/fa";
import {
  getModuleDetail,
  editModule,
  deleteModule,
  getSjNos,
  getModuleCategories,
  createModulePhoto,
  deleteModulePhoto,
  getUploadURL,
  uploadImage,
  createProcess,
  deleteProcess,
  IModule,
  IProcess,
  ISjNoListResponse,
  IModuleCategory,
} from "../api";
import { displayModuleCategoryName } from "../lib/moduleCategoryDisplay";
import {
  parseCycleTimeSeconds,
  formatCycleTimeForApi,
} from "../lib/vlAssemblyThroughput";

function InfoRow({
  label,
  labelColor,
  children,
}: {
  label: string;
  labelColor: string;
  children: React.ReactNode;
}) {
  return (
    <Box>
      <Text fontSize="xs" color={labelColor} fontWeight="semibold" mb={0.5}>
        {label}
      </Text>
      {children}
    </Box>
  );
}

export default function SjModuleDetail() {
  const { i18n } = useTranslation();
  const { moduleId } = useParams<{ moduleId: string }>();
  const pk = Number(moduleId);
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();

  const cardBg = useColorModeValue("white", "gray.800");
  const pageBg = useColorModeValue("gray.50", "gray.900");
  const borderColor = useColorModeValue("gray.200", "gray.600");
  const tableBg = useColorModeValue("gray.50", "gray.800");
  const labelColor = useColorModeValue("gray.500", "gray.400");
  const suggestionBg = useColorModeValue("white", "gray.700");
  const suggestionHoverBg = useColorModeValue("gray.100", "gray.600");
  const suggestionBorderColor = useColorModeValue("gray.200", "gray.600");
  const photoBorderColor = useColorModeValue("gray.200", "gray.600");

  const { data: module, isLoading } = useQuery<IModule>({
    queryKey: ["moduleDetail", pk],
    queryFn: () => getModuleDetail(pk),
    enabled: !!pk,
  });

  // ── Edit 상태 ─────────────────────────────────────────────
  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState({ code: "", name: "" });
  const [isSaving, setIsSaving] = useState(false);

  // ── IE Metrics 인라인 편집 ─────────────────────────────────
  const [editingCycleTime, setEditingCycleTime] = useState<string | null>(null);
  const [editingTargetHr, setEditingTargetHr] = useState<string | null>(null);

  // SJ No 검색 combobox
  const [sjNoSearch, setSjNoSearch] = useState("");
  const [selectedSjNo, setSelectedSjNo] = useState<{ pk: number; sj_no: string } | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: sjNoSuggestions } = useQuery<ISjNoListResponse>({
    queryKey: ["sjNoSuggestions", sjNoSearch],
    queryFn: () => getSjNos({ search: sjNoSearch }),
    enabled: isEditing && sjNoSearch.length > 0,
  });

  const { data: allModuleCategories } = useQuery<IModuleCategory[]>({
    queryKey: ["moduleCategories"],
    queryFn: () => getModuleCategories(),
    enabled: isEditing,
  });

  const categoryRoots = useMemo(
    () =>
      (allModuleCategories ?? [])
        .filter((c) => c.parent === null)
        .sort((a, b) => a.sort_order - b.sort_order),
    [allModuleCategories]
  );

  const [topCategoryPk, setTopCategoryPk] = useState<number | "">("");
  const [leafCategoryPk, setLeafCategoryPk] = useState<number | "">("");
  const [prepAppliesTo, setPrepAppliesTo] = useState<"general" | "handbag">("general");

  const selectedTop = useMemo(
    () => categoryRoots.find((r) => r.pk === topCategoryPk),
    [categoryRoots, topCategoryPk]
  );

  const { data: childCategories } = useQuery<IModuleCategory[]>({
    queryKey: ["moduleCategories", "children", topCategoryPk, prepAppliesTo],
    queryFn: () => {
      if (!topCategoryPk) return Promise.resolve([]);
      if (selectedTop?.slug === "preparation") {
        return getModuleCategories({
          parent: topCategoryPk,
          applies_to: prepAppliesTo,
        });
      }
      return getModuleCategories({ parent: topCategoryPk });
    },
    enabled: isEditing && !!topCategoryPk,
  });

  useEffect(() => {
    setLeafCategoryPk("");
  }, [topCategoryPk, prepAppliesTo]);

  const saveCycleTime = async (raw: string) => {
    const secs = parseCycleTimeSeconds(raw);
    if (!secs) {
      toast({ title: "Cycle time must be a positive number (seconds per unit)", status: "warning", duration: 2500, position: "bottom-right" });
      setEditingCycleTime(null);
      return;
    }
    try {
      await editModule(pk, { cycle_time: formatCycleTimeForApi(secs) });
      queryClient.invalidateQueries({ queryKey: ["moduleDetail", pk] });
    } catch {
      toast({ title: "Update failed", status: "error", duration: 2000, position: "bottom-right" });
    }
    setEditingCycleTime(null);
  };

  const saveTargetHr = async (raw: string) => {
    const n = Number.parseFloat(raw.trim().replace(",", "."));
    if (!Number.isFinite(n) || n <= 0) {
      toast({ title: "Target per hour must be a positive number", status: "warning", duration: 2500, position: "bottom-right" });
      setEditingTargetHr(null);
      return;
    }
    const secs = 3600 / n;
    try {
      await editModule(pk, { cycle_time: formatCycleTimeForApi(secs) });
      queryClient.invalidateQueries({ queryKey: ["moduleDetail", pk] });
    } catch {
      toast({ title: "Update failed", status: "error", duration: 2000, position: "bottom-right" });
    }
    setEditingTargetHr(null);
  };

  const clearCycleTime = async () => {
    try {
      await editModule(pk, { cycle_time: null });
      queryClient.invalidateQueries({ queryKey: ["moduleDetail", pk] });
    } catch {
      toast({ title: "Update failed", status: "error", duration: 2000, position: "bottom-right" });
    }
  };

  const startEdit = () => {
    if (!module) return;
    setForm({
      code: module.code,
      name: module.name ?? "",
    });
    const sj_no = typeof module.sj_no === "object" ? module.sj_no : null;
    setSelectedSjNo(sj_no ? { pk: sj_no.pk, sj_no: sj_no.sj_no } : null);
    setSjNoSearch(module.sj_no_value ?? "");
    const detail = module.category_detail;
    if (detail?.parent?.pk) {
      setTopCategoryPk(detail.parent.pk);
      setLeafCategoryPk(detail.pk);
      setPrepAppliesTo(detail.applies_to === "handbag" ? "handbag" : "general");
    } else if (detail?.pk) {
      setTopCategoryPk(detail.pk);
      setLeafCategoryPk("");
      setPrepAppliesTo("general");
    } else {
      setTopCategoryPk("");
      setLeafCategoryPk("");
      setPrepAppliesTo("general");
    }
    setIsEditing(true);
  };

  const handleSave = async () => {
    if (!form.code.trim()) {
      toast({ title: "Code is required", status: "warning", duration: 2000, position: "bottom-right" });
      return;
    }
    if (!topCategoryPk) {
      toast({ title: "대분류를 선택하세요", status: "warning", duration: 2000, position: "bottom-right" });
      return;
    }
    const subs = childCategories ?? [];
    const finalCategoryPk = subs.length === 0 ? topCategoryPk : leafCategoryPk;
    if (!finalCategoryPk) {
      toast({
        title: subs.length ? "소분류를 선택하세요" : "분류를 확인할 수 없습니다",
        status: "warning",
        duration: 2500,
        position: "bottom-right",
      });
      return;
    }
    setIsSaving(true);
    try {
      await editModule(pk, {
        code: form.code.trim(),
        name: form.name.trim(),
        sj_no: selectedSjNo?.pk ?? null,
        module_category: Number(finalCategoryPk),
      });
      toast({ title: "Updated", status: "success", duration: 2000, position: "bottom-right" });
      queryClient.invalidateQueries({ queryKey: ["moduleDetail", pk] });
      queryClient.invalidateQueries({ queryKey: ["modules"] });
      setIsEditing(false);
    } catch {
      toast({ title: "Update failed", status: "error", duration: 2000, position: "bottom-right" });
    } finally {
      setIsSaving(false);
    }
  };

  // ── Delete ────────────────────────────────────────────────
  const { isOpen: isDeleteOpen, onOpen: onDeleteOpen, onClose: onDeleteClose } = useDisclosure();
  const cancelRef = useRef<HTMLButtonElement>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await deleteModule(pk);
      toast({ title: "Deleted", status: "success", duration: 2000, position: "bottom-right" });
      queryClient.invalidateQueries({ queryKey: ["modules"] });
      navigate("/production-process/modules");
    } catch {
      toast({ title: "Delete failed", status: "error", duration: 2000, position: "bottom-right" });
      setIsDeleting(false);
    }
  };

  // ── 하위 Process 추가 / 삭제 ─────────────────────────────────
  const {
    isOpen: isAddProcessOpen,
    onOpen: onAddProcessOpen,
    onClose: onAddProcessClose,
  } = useDisclosure();
  const [newProcessForm, setNewProcessForm] = useState({
    code: "",
    name: "",
    name_ko: "",
    cycleTime: "",
  });
  const [isCreatingProcess, setIsCreatingProcess] = useState(false);

  const [processToDelete, setProcessToDelete] = useState<{ pk: number; code: string } | null>(null);
  const [isDeletingProcess, setIsDeletingProcess] = useState(false);
  const processDeleteCancelRef = useRef<HTMLButtonElement>(null);

  const openAddProcess = () => {
    setNewProcessForm({ code: "", name: "", name_ko: "", cycleTime: "" });
    onAddProcessOpen();
  };

  const handleCreateProcess = async () => {
    const code = newProcessForm.code.trim();
    if (!code) {
      toast({ title: "Process code is required", status: "warning", duration: 2000, position: "bottom-right" });
      return;
    }
    const cycleRaw = newProcessForm.cycleTime.trim();
    let cycle_time: number | null = null;
    if (cycleRaw !== "") {
      const n = Number.parseFloat(cycleRaw.replace(",", "."));
      if (!Number.isFinite(n) || n <= 0) {
        toast({
          title: "Cycle time must be a positive number (seconds per unit)",
          status: "warning",
          duration: 2500,
          position: "bottom-right",
        });
        return;
      }
      cycle_time = n;
    }
    setIsCreatingProcess(true);
    try {
      await createProcess({
        module: pk,
        code,
        name: newProcessForm.name.trim(),
        name_ko: newProcessForm.name_ko.trim(),
        cycle_time,
      });
      toast({ title: "Process created", status: "success", duration: 2000, position: "bottom-right" });
      queryClient.invalidateQueries({ queryKey: ["moduleDetail", pk] });
      queryClient.invalidateQueries({ queryKey: ["processes"] });
      onAddProcessClose();
    } catch (e: unknown) {
      const msg = e && typeof e === "object" && "response" in e
        ? JSON.stringify((e as { response?: { data?: unknown } }).response?.data)
        : "Failed to create process";
      toast({ title: msg, status: "error", duration: 4000, position: "bottom-right" });
    } finally {
      setIsCreatingProcess(false);
    }
  };

  const confirmDeleteProcess = async () => {
    if (!processToDelete) return;
    setIsDeletingProcess(true);
    try {
      await deleteProcess(processToDelete.pk);
      toast({ title: "Process deleted", status: "success", duration: 2000, position: "bottom-right" });
      queryClient.invalidateQueries({ queryKey: ["moduleDetail", pk] });
      queryClient.invalidateQueries({ queryKey: ["processes"] });
      setProcessToDelete(null);
    } catch {
      toast({ title: "Delete failed", status: "error", duration: 2000, position: "bottom-right" });
    } finally {
      setIsDeletingProcess(false);
    }
  };

  // ── Lightbox ───────────────────────────────────────────────
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  // ── Photo Upload ───────────────────────────────────────────
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [pendingPreviews, setPendingPreviews] = useState<string[]>([]);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setPendingFiles((prev) => [...prev, ...files]);
    setPendingPreviews((prev) => [...prev, ...files.map((f) => URL.createObjectURL(f))]);
    if (photoInputRef.current) photoInputRef.current.value = "";
  };

  const removePending = (idx: number) => {
    setPendingFiles((prev) => prev.filter((_, i) => i !== idx));
    setPendingPreviews((prev) => {
      URL.revokeObjectURL(prev[idx]);
      return prev.filter((_, i) => i !== idx);
    });
  };

  const handleUploadPhotos = async () => {
    if (!pendingFiles.length) return;
    setIsUploadingPhoto(true);
    try {
      for (const file of pendingFiles) {
        const urlData = await getUploadURL();
        const dt = new DataTransfer();
        dt.items.add(file);
        const cfResult: any = await uploadImage({ file: dt.files, uploadURL: urlData.uploadURL });
        const cfUrl = `https://imagedelivery.net/mzmXhxWLR9jzdX8u9g4BBQ/${cfResult.result.id}/public`;
        await createModulePhoto({ file: cfUrl, modulePk: pk, description: module?.name ?? "" });
      }
      queryClient.invalidateQueries({ queryKey: ["moduleDetail", pk] });
      queryClient.invalidateQueries({ queryKey: ["modules"] });
      setPendingFiles([]);
      setPendingPreviews([]);
      toast({ title: "Photos uploaded", status: "success", duration: 2000, position: "bottom-right" });
    } catch {
      toast({ title: "Upload failed", status: "error", duration: 2000, position: "bottom-right" });
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const handleDeletePhoto = async (photoPk: number) => {
    try {
      await deleteModulePhoto({ modulePk: pk, photoPk });
      queryClient.invalidateQueries({ queryKey: ["moduleDetail", pk] });
      queryClient.invalidateQueries({ queryKey: ["modules"] });
      toast({ title: "Photo deleted", status: "success", duration: 2000, position: "bottom-right" });
    } catch {
      toast({ title: "Delete failed", status: "error", duration: 2000, position: "bottom-right" });
    }
  };

  if (isLoading) return <Center minH="60vh"><Spinner size="xl" /></Center>;
  if (!module) return <Center minH="60vh"><Text color="gray.400">Module not found.</Text></Center>;

  const processes: IProcess[] = module.processes ?? [];
  const photos = module.photos ?? [];

  const sjNoPk =
    typeof module.sj_no === "object" && module.sj_no !== null
      ? module.sj_no.pk
      : typeof module.sj_no === "number"
        ? module.sj_no
        : module.sj_no_pk ?? null;

  return (
    <>
      <Helmet>
        <title>{module.code} — Module Detail</title>
      </Helmet>

      <Box bg={pageBg} minH="100vh" px={{ base: 4, md: 8, lg: 12 }} py={{ base: 6, md: 8 }}>
        <Box maxW="5xl" mx="auto">

          <HStack mb={4}>
            <Button leftIcon={<FaArrowLeft />} variant="ghost" size="sm" onClick={() => navigate(-1)}>
              Back
            </Button>
          </HStack>

          {/* Module 기본 정보 카드 */}
          <Box position="relative">
            {/* Edit / Delete / Save / Cancel 버튼 */}
            <HStack position="absolute" top={-10} right={0} spacing={2}>
              {isEditing ? (
                <>
                  <Button size="sm" variant="ghost" onClick={() => setIsEditing(false)}>Cancel</Button>
                  <Button size="sm" colorScheme="blue" isLoading={isSaving} onClick={handleSave}>Save</Button>
                </>
              ) : (
                <>
                  <Button size="sm" leftIcon={<FaEdit />} variant="ghost" onClick={startEdit}>Edit</Button>
                  <Button size="sm" leftIcon={<FaTrash />} variant="ghost" colorScheme="red" onClick={onDeleteOpen}>Delete</Button>
                </>
              )}
            </HStack>

            <Box
              bg={cardBg}
              borderRadius="xl"
              border="1px solid"
              borderColor={borderColor}
              p={6}
              shadow="sm"
              mb={6}
            >
              <HStack align="baseline" spacing={3} mb={5}>
                {isEditing ? (
                  <Input
                    value={form.code}
                    onChange={(e) => setForm({ ...form, code: e.target.value })}
                    fontWeight="bold"
                    fontSize="lg"
                    w="200px"
                    placeholder="Code"
                  />
                ) : (
                  <Heading size="md">{module.code}</Heading>
                )}
                {isEditing ? (
                  <Input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    fontSize="md"
                    placeholder="Name (optional)"
                    flex={1}
                  />
                ) : (
                  module.name && <Text fontSize="lg" color="gray.500">{module.name}</Text>
                )}
              </HStack>

              <HStack spacing={8} flexWrap="wrap" align="flex-start">
                <InfoRow label="Category" labelColor={labelColor}>
                  {isEditing ? (
                    <Box minW="240px">
                      <FormControl isRequired mb={2}>
                        <FormLabel fontSize="sm" mb={1}>대분류</FormLabel>
                        <Select
                          size="sm"
                          placeholder="Select category"
                          value={topCategoryPk === "" ? "" : String(topCategoryPk)}
                          onChange={(e) => setTopCategoryPk(e.target.value ? Number(e.target.value) : "")}
                        >
                          {categoryRoots.map((r) => (
                            <option key={r.pk} value={String(r.pk)}>
                              {displayModuleCategoryName(r, i18n.language)}
                            </option>
                          ))}
                        </Select>
                      </FormControl>

                      {selectedTop?.slug === "preparation" && (
                        <FormControl mb={2}>
                          <FormLabel fontSize="sm" mb={1}>Preparation — bag line</FormLabel>
                          <RadioGroup
                            value={prepAppliesTo}
                            onChange={(v) => setPrepAppliesTo(v as "general" | "handbag")}
                          >
                            <Stack direction="row" spacing={4}>
                              <Radio value="general">General bag</Radio>
                              <Radio value="handbag">Handbag</Radio>
                            </Stack>
                          </RadioGroup>
                        </FormControl>
                      )}

                      {(childCategories?.length ?? 0) > 0 && (
                        <FormControl isRequired>
                          <FormLabel fontSize="sm" mb={1}>소분류</FormLabel>
                          <Select
                            size="sm"
                            placeholder="Select sub-category"
                            value={leafCategoryPk === "" ? "" : String(leafCategoryPk)}
                            onChange={(e) => setLeafCategoryPk(e.target.value ? Number(e.target.value) : "")}
                          >
                            {(childCategories ?? []).map((c) => (
                              <option key={c.pk} value={String(c.pk)}>
                                {displayModuleCategoryName(c, i18n.language)}
                              </option>
                            ))}
                          </Select>
                        </FormControl>
                      )}
                    </Box>
                  ) : (
                    <Text fontSize="sm">
                      {module.category_detail
                        ? module.category_detail.parent
                          ? `${displayModuleCategoryName(module.category_detail.parent, i18n.language)} › ${displayModuleCategoryName(module.category_detail, i18n.language)}`
                          : displayModuleCategoryName(module.category_detail, i18n.language)
                        : "-"}
                    </Text>
                  )}
                </InfoRow>

                {/* SJ No */}
                <InfoRow label="SJ No" labelColor={labelColor}>
                  {isEditing ? (
                    <Box position="relative" w="220px">
                      <Input
                        size="sm"
                        value={sjNoSearch}
                        onChange={(e) => { setSjNoSearch(e.target.value); setSelectedSjNo(null); }}
                        onFocus={() => setShowSuggestions(true)}
                        onBlur={() => { blurTimer.current = setTimeout(() => setShowSuggestions(false), 150); }}
                        placeholder="Search SJ No..."
                      />
                      {selectedSjNo && (
                        <Text fontSize="xs" color="blue.400" mt={1}>Selected: {selectedSjNo.sj_no}</Text>
                      )}
                      {showSuggestions && sjNoSuggestions && sjNoSuggestions.results.length > 0 && (
                        <List
                          position="absolute"
                          zIndex={10}
                          bg={suggestionBg}
                          border="1px solid"
                          borderColor={suggestionBorderColor}
                          borderRadius="md"
                          w="full"
                          maxH="180px"
                          overflowY="auto"
                          shadow="md"
                        >
                          {sjNoSuggestions.results.map((n) => (
                            <ListItem
                              key={n.pk}
                              px={3} py={2}
                              cursor="pointer"
                              fontSize="sm"
                              _hover={{ bg: suggestionHoverBg }}
                              onMouseDown={() => {
                                if (blurTimer.current) clearTimeout(blurTimer.current);
                                setSelectedSjNo({ pk: n.pk, sj_no: n.sj_no });
                                setSjNoSearch(n.sj_no);
                                setShowSuggestions(false);
                              }}
                            >
                              {n.sj_no}
                            </ListItem>
                          ))}
                        </List>
                      )}
                    </Box>
                  ) : module.sj_no_value ? (
                    sjNoPk != null ? (
                      <RouterLink to={`/sjnos/${sjNoPk}`}>
                        <Link as="span" color="teal.500" fontSize="sm" fontWeight="semibold">
                          {module.sj_no_value}
                        </Link>
                      </RouterLink>
                    ) : (
                      <Text fontSize="sm">{module.sj_no_value}</Text>
                    )
                  ) : (
                    <Text fontSize="sm">-</Text>
                  )}
                </InfoRow>

                <InfoRow label="Created" labelColor={labelColor}>
                  <Text fontSize="sm">{new Date(module.created_at).toLocaleDateString("ko-KR")}</Text>
                </InfoRow>

                <InfoRow label="Processes" labelColor={labelColor}>
                  <Badge colorScheme="blue">{processes.length}</Badge>
                </InfoRow>

                {/* IE Metrics */}
                <InfoRow label="Cycle Time (s)" labelColor={labelColor}>
                  {editingCycleTime !== null ? (
                    <HStack>
                      <Input size="xs" w="100px" autoFocus
                        value={editingCycleTime}
                        onChange={(e) => setEditingCycleTime(e.target.value)}
                        onBlur={() => saveCycleTime(editingCycleTime)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") saveCycleTime(editingCycleTime);
                          if (e.key === "Escape") setEditingCycleTime(null);
                        }}
                      />
                    </HStack>
                  ) : (
                    <HStack spacing={2}>
                      <Text fontSize="sm" cursor="pointer" color={module.cycle_time ? undefined : "gray.400"}
                        _hover={{ textDecoration: "underline" }}
                        onClick={() => setEditingCycleTime(module.cycle_time ?? "")}>
                        {module.cycle_time || "—"}
                      </Text>
                      {module.cycle_time && (
                        <Button size="xs" variant="ghost" colorScheme="red" px={1} onClick={clearCycleTime}>×</Button>
                      )}
                    </HStack>
                  )}
                  <Text fontSize="xs" color="gray.400">Target/h & 8h auto-calculated from this</Text>
                </InfoRow>
                <InfoRow label="Target / h" labelColor={labelColor}>
                  {editingTargetHr !== null ? (
                    <Input size="xs" w="100px" autoFocus
                      value={editingTargetHr}
                      onChange={(e) => setEditingTargetHr(e.target.value)}
                      onBlur={() => saveTargetHr(editingTargetHr)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") saveTargetHr(editingTargetHr);
                        if (e.key === "Escape") setEditingTargetHr(null);
                      }}
                    />
                  ) : (
                    <Text fontSize="sm" cursor="pointer" color={module.target_qty_per_hour != null ? undefined : "gray.400"}
                      _hover={{ textDecoration: "underline" }}
                      onClick={() => setEditingTargetHr(String(module.target_qty_per_hour ?? ""))}>
                      {module.target_qty_per_hour != null ? `${module.target_qty_per_hour} pcs/h` : "—"}
                    </Text>
                  )}
                </InfoRow>
                <InfoRow label="Daily Target (8h)" labelColor={labelColor}>
                  <Text fontSize="sm" color={module.daily_target_qty_8h != null ? undefined : "gray.400"}>
                    {module.daily_target_qty_8h != null ? `${module.daily_target_qty_8h} pcs` : "—"}
                  </Text>
                </InfoRow>
              </HStack>
            </Box>
          </Box>

          {/* Photos 섹션 */}
          <Box
            bg={cardBg}
            borderRadius="xl"
            border="1px solid"
            borderColor={borderColor}
            p={6}
            shadow="sm"
            mb={6}
          >
            <HStack justify="space-between" mb={4}>
              <Heading size="sm">Photos</Heading>
              <Button
                size="sm"
                leftIcon={<FaCamera />}
                variant="outline"
                onClick={() => photoInputRef.current?.click()}
              >
                Add Photos
              </Button>
              <input
                ref={photoInputRef}
                type="file"
                accept="image/*"
                multiple
                style={{ display: "none" }}
                onChange={handlePhotoSelect}
              />
            </HStack>
            <Divider mb={4} />

            {/* 업로드 대기 중 */}
            {pendingPreviews.length > 0 && (
              <Box mb={5}>
                <Text fontSize="xs" color={labelColor} fontWeight="semibold" mb={2}>
                  Pending upload ({pendingPreviews.length})
                </Text>
                <Grid templateColumns="repeat(auto-fill, minmax(120px, 1fr))" gap={3} mb={3}>
                  {pendingPreviews.map((src, idx) => (
                    <Box key={idx} position="relative" borderRadius="md" overflow="hidden"
                      border="2px dashed" borderColor="blue.300">
                      <Image src={src} w="full" h="100px" objectFit="cover" />
                      <Button
                        size="xs" colorScheme="red" position="absolute" top={1} right={1}
                        onClick={() => removePending(idx)}
                      >
                        <FaTrashAlt />
                      </Button>
                    </Box>
                  ))}
                </Grid>
                <Button size="sm" colorScheme="blue" isLoading={isUploadingPhoto}
                  loadingText="Uploading..." onClick={handleUploadPhotos}>
                  Upload {pendingPreviews.length} photo{pendingPreviews.length > 1 ? "s" : ""}
                </Button>
              </Box>
            )}

            {/* 저장된 사진 */}
            {photos.length === 0 && pendingPreviews.length === 0 ? (
              <Text color="gray.400" textAlign="center" py={6}>No photos registered.</Text>
            ) : (
              <Grid templateColumns="repeat(auto-fill, minmax(150px, 1fr))" gap={4}>
                {photos.map((photo) => (
                  <Box
                    key={photo.pk}
                    position="relative"
                    borderRadius="md"
                    overflow="hidden"
                    border="1px solid"
                    borderColor={photoBorderColor}
                    cursor="pointer"
                    onClick={() => setLightboxSrc(photo.file)}
                    _hover={{ opacity: 0.85 }}
                    transition="opacity 0.15s"
                  >
                    <Image src={photo.file} w="full" h="130px" objectFit="cover" />
                    <Button
                      size="xs" colorScheme="red" position="absolute" top={1} right={1}
                      onClick={(e) => { e.stopPropagation(); handleDeletePhoto(photo.pk); }}
                    >
                      <FaTrashAlt />
                    </Button>
                  </Box>
                ))}
              </Grid>
            )}
          </Box>

          {/* Process 목록 — 생성·삭제·상세 */}
          <Box
            bg={cardBg}
            borderRadius="xl"
            border="1px solid"
            borderColor={borderColor}
            p={6}
            shadow="sm"
          >
            <HStack justify="space-between" align="center" mb={4} flexWrap="wrap" gap={2}>
              <Heading size="sm">Processes</Heading>
              <Button size="sm" leftIcon={<FaPlus />} colorScheme="blue" onClick={openAddProcess}>
                Add Process
              </Button>
            </HStack>
            <Divider mb={4} />

            {processes.length === 0 ? (
              <Box py={6} textAlign="center">
                <Text color="gray.400" mb={3}>
                  No processes yet. Use &quot;Add Process&quot; to create one under this module.
                </Text>
                <Button size="sm" leftIcon={<FaPlus />} colorScheme="blue" variant="outline" onClick={openAddProcess}>
                  Add Process
                </Button>
              </Box>
            ) : (
              <TableContainer>
                <Table variant="striped" size="sm">
                  <Thead bgColor={tableBg}>
                    <Tr>
                      <Th>#</Th>
                      <Th>Code</Th>
                      <Th>Name</Th>
                      <Th>Name (KO)</Th>
                      <Th>Flow</Th>
                      <Th isNumeric>Cycle Time (s)</Th>
                      <Th isNumeric>Target/h</Th>
                      <Th isNumeric>Target/8h</Th>
                      <Th>Video</Th>
                      <Th w="120px">Actions</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {processes.map((proc, idx) => (
                      <Tr key={proc.pk}>
                        <Td>{idx + 1}</Td>
                        <Td fontWeight="semibold" whiteSpace="nowrap">
                          <RouterLink to={`/production-process/processes/${proc.pk}`}>
                            <Link as="span" color="blue.500">{proc.code}</Link>
                          </RouterLink>
                        </Td>
                        <Td whiteSpace="nowrap">
                          {proc.name || <Text as="span" color="gray.400">-</Text>}
                        </Td>
                        <Td whiteSpace="nowrap">
                          {proc.name_ko || <Text as="span" color="gray.400">-</Text>}
                        </Td>
                        <Td maxW="200px">
                          <Text fontSize="xs" noOfLines={2} title={proc.flow}>
                            {proc.flow || <Text as="span" color="gray.400">-</Text>}
                          </Text>
                        </Td>
                        <Td isNumeric>
                          {proc.cycle_time ?? <Text as="span" color="gray.400">-</Text>}
                        </Td>
                        <Td isNumeric>
                          {proc.target_qty_per_hour != null
                            ? `${proc.target_qty_per_hour} pcs/h`
                            : <Text as="span" color="gray.400">-</Text>}
                        </Td>
                        <Td isNumeric>
                          {proc.daily_target_qty_8h != null
                            ? `${proc.daily_target_qty_8h} pcs`
                            : <Text as="span" color="gray.400">-</Text>}
                        </Td>
                        <Td>
                          {proc.standard_work_video_url ? (
                            <Link href={proc.standard_work_video_url} isExternal>
                              <HStack spacing={1} color="blue.400">
                                <FaVideo size={12} />
                                <FaExternalLinkAlt size={10} />
                              </HStack>
                            </Link>
                          ) : (
                            <Text color="gray.300">-</Text>
                          )}
                        </Td>
                        <Td>
                          <HStack spacing={1}>
                            <Button
                              as={RouterLink}
                              to={`/production-process/processes/${proc.pk}`}
                              size="xs"
                              colorScheme="blue"
                              variant="outline"
                            >
                              Edit
                            </Button>
                            <IconButton
                              aria-label={`Delete process ${proc.code}`}
                              icon={<FaTrash />}
                              size="xs"
                              variant="ghost"
                              colorScheme="red"
                              onClick={() => setProcessToDelete({ pk: proc.pk, code: proc.code })}
                            />
                          </HStack>
                        </Td>
                      </Tr>
                    ))}
                  </Tbody>
                </Table>
              </TableContainer>
            )}
          </Box>

          {/* Add Process 모달 */}
          <Modal isOpen={isAddProcessOpen} onClose={onAddProcessClose} isCentered>
            <ModalOverlay />
            <ModalContent>
              <ModalHeader>Add process</ModalHeader>
              <ModalCloseButton />
              <ModalBody>
                <Text fontSize="sm" color="gray.600" mb={4}>
                  New process under module <strong>{module.code}</strong>. Cycle time is optional; you can also set video and other fields on the process detail page.
                </Text>
                <Grid templateColumns="1fr" gap={4}>
                  <Box>
                    <Text fontSize="xs" fontWeight="semibold" color={labelColor} mb={1}>Code *</Text>
                    <Input
                      value={newProcessForm.code}
                      onChange={(e) => setNewProcessForm((f) => ({ ...f, code: e.target.value }))}
                      placeholder="e.g. P01"
                    />
                  </Box>
                  <Box>
                    <Text fontSize="xs" fontWeight="semibold" color={labelColor} mb={1}>
                      Cycle Time (s)
                    </Text>
                    <Input
                      type="number"
                      inputMode="decimal"
                      min={0}
                      step="any"
                      value={newProcessForm.cycleTime}
                      onChange={(e) => setNewProcessForm((f) => ({ ...f, cycleTime: e.target.value }))}
                      placeholder="Seconds per unit (optional)"
                    />
                    <Text fontSize="xs" color={labelColor} mt={1}>
                      Leave empty to set later. Hourly / 8h targets are derived from this value.
                    </Text>
                  </Box>
                  <Box>
                    <Text fontSize="xs" fontWeight="semibold" color={labelColor} mb={1}>Name</Text>
                    <Input
                      value={newProcessForm.name}
                      onChange={(e) => setNewProcessForm((f) => ({ ...f, name: e.target.value }))}
                      placeholder="Optional"
                    />
                  </Box>
                  <Box>
                    <Text fontSize="xs" fontWeight="semibold" color={labelColor} mb={1}>Name (KO)</Text>
                    <Input
                      value={newProcessForm.name_ko}
                      onChange={(e) => setNewProcessForm((f) => ({ ...f, name_ko: e.target.value }))}
                      placeholder="Optional"
                    />
                  </Box>
                </Grid>
              </ModalBody>
              <ModalFooter>
                <Button variant="ghost" mr={3} onClick={onAddProcessClose}>Cancel</Button>
                <Button colorScheme="blue" isLoading={isCreatingProcess} onClick={handleCreateProcess}>
                  Create
                </Button>
              </ModalFooter>
            </ModalContent>
          </Modal>
        </Box>
      </Box>

      {/* Lightbox */}
      <Modal isOpen={!!lightboxSrc} onClose={() => setLightboxSrc(null)} isCentered size="4xl">
        <ModalOverlay bg="blackAlpha.800" />
        <ModalContent bg="transparent" shadow="none" onClick={() => setLightboxSrc(null)}>
          <Image
            src={lightboxSrc ?? ""}
            maxH="90vh"
            maxW="100%"
            objectFit="contain"
            borderRadius="lg"
            mx="auto"
          />
        </ModalContent>
      </Modal>

      {/* Delete Process 확인 */}
      <AlertDialog
        isOpen={!!processToDelete}
        leastDestructiveRef={processDeleteCancelRef}
        onClose={() => setProcessToDelete(null)}
      >
        <AlertDialogOverlay>
          <AlertDialogContent>
            <AlertDialogHeader fontSize="lg" fontWeight="bold">
              Delete Process
            </AlertDialogHeader>
            <AlertDialogBody>
              Delete process <strong>{processToDelete?.code}</strong>? This cannot be undone.
            </AlertDialogBody>
            <AlertDialogFooter>
              <Button ref={processDeleteCancelRef} onClick={() => setProcessToDelete(null)}>
                Cancel
              </Button>
              <Button
                colorScheme="red"
                ml={3}
                isLoading={isDeletingProcess}
                onClick={confirmDeleteProcess}
              >
                Delete
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>

      {/* ── Delete 확인 다이얼로그 ── */}
      <AlertDialog isOpen={isDeleteOpen} leastDestructiveRef={cancelRef} onClose={onDeleteClose}>
        <AlertDialogOverlay>
          <AlertDialogContent>
            <AlertDialogHeader fontSize="lg" fontWeight="bold">Delete Module</AlertDialogHeader>
            <AlertDialogBody>
              <strong>{module.code}</strong>을(를) 삭제하시겠습니까?
              하위 Process도 모두 삭제됩니다. 이 작업은 되돌릴 수 없습니다.
            </AlertDialogBody>
            <AlertDialogFooter>
              <Button ref={cancelRef} onClick={onDeleteClose}>Cancel</Button>
              <Button colorScheme="red" ml={3} isLoading={isDeleting} onClick={handleDelete}>
                Delete
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>
    </>
  );
}
