import {
  Box,
  Heading,
  Text,
  Badge,
  useColorModeValue,
  HStack,
  VStack,
  Divider,
  Button,
  Spinner,
  Center,
  useToast,
  Input,
  Textarea,
  AlertDialog,
  AlertDialogBody,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogContent,
  AlertDialogOverlay,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
  useDisclosure,
  Image,
  Skeleton,
  Link,
  Table,
  TableContainer,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  IconButton,
  Grid,
  ModalFooter,
  Stack,
  RadioGroup,
  Radio,
  Select,
} from "@chakra-ui/react";
import { useRef, useState, useMemo, useEffect } from "react";
import { useParams, useNavigate, Link as RouterLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Helmet } from "react-helmet";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FaArrowLeft, FaEdit, FaPlus, FaTrash } from "react-icons/fa";
import {
  getSjNoDetail,
  getSjStylePhotos,
  getModules,
  getModuleCategories,
  createModule,
  deleteModule,
  IFilePhotos,
  ISjNo,
  IModule,
  IModuleCategory,
} from "../api";
import { displayModuleCategoryName } from "../lib/moduleCategoryDisplay";
import {
  parseCycleTimeSeconds,
  formatCycleTimeForApi,
} from "../lib/vlAssemblyThroughput";
import axios from "axios";
import Cookies from "js-cookie";

const instance = axios.create({
  baseURL:
    process.env.NODE_ENV === "development"
      ? "http://127.0.0.1:8000/api/v1/"
      : "https://backend.sjep.space/api/v1/",
  withCredentials: true,
});

const headers = () => ({ "X-CSRFToken": Cookies.get("csrftoken") || "" });

const editSjNo = (pk: number, data: { sj_no?: string; style_name?: string; memo?: string; cycle_time?: string | null }) =>
  instance.put(`sj-styles/sj-nos/${pk}`, data, { headers: headers() }).then((r) => r.data as ISjNo);

const deleteSjNo = (pk: number) =>
  instance.delete(`sj-styles/sj-nos/${pk}`, { headers: headers() });

export default function SjNoDetail() {
  const { i18n } = useTranslation();
  const { sjNoId } = useParams<{ sjNoId: string }>();
  const pk = Number(sjNoId);
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();

  const cardBg = useColorModeValue("white", "gray.800");
  const pageBg = useColorModeValue("gray.50", "gray.900");
  const labelColor = useColorModeValue("gray.500", "gray.400");
  const borderColor = useColorModeValue("gray.200", "gray.600");
  const noPhotoBg = useColorModeValue("gray.100", "gray.700");
  const rowHoverBg = useColorModeValue("gray.50", "gray.700");

  const { data: sjNo, isLoading } = useQuery<ISjNo>({
    queryKey: ["sjNoDetail", pk],
    queryFn: () => getSjNoDetail(pk),
    enabled: !!pk,
  });

  const { data: photos, isLoading: photosLoading } = useQuery<IFilePhotos[]>({
    queryKey: ["sjStylePhotos", sjNo?.sj_style],
    queryFn: () => getSjStylePhotos(sjNo!.sj_style),
    enabled: !!sjNo?.sj_style,
  });

  const { data: modulesData, isLoading: modulesLoading } = useQuery({
    queryKey: ["modulesBySjNo", pk],
    queryFn: () => getModules({ sj_no: pk, page: 1 }),
    enabled: !!pk,
  });

  const { data: allModuleCategories } = useQuery({
    queryKey: ["moduleCategories"],
    queryFn: () => getModuleCategories(),
  });

  const categoryRoots = useMemo(
    () =>
      (allModuleCategories ?? [])
        .filter((c: IModuleCategory) => c.parent === null)
        .sort((a, b) => a.sort_order - b.sort_order),
    [allModuleCategories]
  );

  // ── 편집 상태 ──
  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState({ sj_no: "", style_name: "", memo: "" });
  const [isSaving, setIsSaving] = useState(false);

  // ── IE Metrics 인라인 편집 ──
  const [editingCycleTime, setEditingCycleTime] = useState<string | null>(null);
  const [editingTargetHr, setEditingTargetHr] = useState<string | null>(null);

  const startEdit = () => {
    if (!sjNo) return;
    setForm({ sj_no: sjNo.sj_no, style_name: sjNo.style_name ?? "", memo: sjNo.memo ?? "" });
    setIsEditing(true);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await editSjNo(pk, form);
      toast({ title: "Updated", status: "success", duration: 2000, position: "bottom-right" });
      queryClient.invalidateQueries({ queryKey: ["sjNoDetail", pk] });
      queryClient.invalidateQueries({ queryKey: ["sjnos"] });
      setIsEditing(false);
    } catch {
      toast({ title: "Update failed", status: "error", duration: 2000, position: "bottom-right" });
    } finally {
      setIsSaving(false);
    }
  };

  const saveSjNoCycleTime = async (raw: string) => {
    const secs = parseCycleTimeSeconds(raw);
    if (!secs) {
      toast({ title: "Cycle time must be a positive number (seconds per unit)", status: "warning", duration: 2500, position: "bottom-right" });
      setEditingCycleTime(null);
      return;
    }
    try {
      await editSjNo(pk, { cycle_time: formatCycleTimeForApi(secs) } as any);
      queryClient.invalidateQueries({ queryKey: ["sjNoDetail", pk] });
    } catch {
      toast({ title: "Update failed", status: "error", duration: 2000, position: "bottom-right" });
    }
    setEditingCycleTime(null);
  };

  const saveSjNoTargetHr = async (raw: string) => {
    const n = Number.parseFloat(raw.trim().replace(",", "."));
    if (!Number.isFinite(n) || n <= 0) {
      toast({ title: "Target per hour must be a positive number", status: "warning", duration: 2500, position: "bottom-right" });
      setEditingTargetHr(null);
      return;
    }
    const secs = 3600 / n;
    try {
      await editSjNo(pk, { cycle_time: formatCycleTimeForApi(secs) } as any);
      queryClient.invalidateQueries({ queryKey: ["sjNoDetail", pk] });
    } catch {
      toast({ title: "Update failed", status: "error", duration: 2000, position: "bottom-right" });
    }
    setEditingTargetHr(null);
  };

  const clearSjNoCycleTime = async () => {
    try {
      await editSjNo(pk, { cycle_time: null } as any);
      queryClient.invalidateQueries({ queryKey: ["sjNoDetail", pk] });
    } catch {
      toast({ title: "Update failed", status: "error", duration: 2000, position: "bottom-right" });
    }
  };

  // ── 삭제 ──
  const { isOpen: isDeleteOpen, onOpen: onDeleteOpen, onClose: onDeleteClose } = useDisclosure();
  const cancelRef = useRef<HTMLButtonElement>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await deleteSjNo(pk);
      toast({ title: "Deleted", status: "success", duration: 2000, position: "bottom-right" });
      queryClient.invalidateQueries({ queryKey: ["sjnos"] });
      navigate("/sjnos");
    } catch {
      toast({ title: "Delete failed", status: "error", duration: 2000, position: "bottom-right" });
      setIsDeleting(false);
    }
  };

  // ── 하위 Module 추가 / 삭제 (SjModuleDetail의 Process 패턴과 동일) ──
  const {
    isOpen: isAddModuleOpen,
    onOpen: onAddModuleOpen,
    onClose: onAddModuleClose,
  } = useDisclosure();
  const [newModuleForm, setNewModuleForm] = useState({
    code: "",
    name: "",
    topCategoryPk: "" as number | "",
    leafCategoryPk: "" as number | "",
    prepAppliesTo: "general" as "general" | "handbag",
  });
  const [isCreatingModule, setIsCreatingModule] = useState(false);
  const [moduleToDelete, setModuleToDelete] = useState<{ pk: number; code: string } | null>(null);
  const [isDeletingModule, setIsDeletingModule] = useState(false);
  const moduleDeleteCancelRef = useRef<HTMLButtonElement>(null);

  const topPk = newModuleForm.topCategoryPk;
  const selectedTop = useMemo(
    () => categoryRoots.find((r) => r.pk === topPk),
    [categoryRoots, topPk]
  );

  const { data: childCategories } = useQuery({
    queryKey: ["moduleCategories", "children", topPk, newModuleForm.prepAppliesTo],
    queryFn: () => {
      if (!topPk) return Promise.resolve([] as IModuleCategory[]);
      if (selectedTop?.slug === "preparation") {
        return getModuleCategories({
          parent: topPk,
          applies_to: newModuleForm.prepAppliesTo,
        });
      }
      return getModuleCategories({ parent: topPk });
    },
    enabled: !!topPk,
  });

  const prepAppliesToVal = newModuleForm.prepAppliesTo;

  useEffect(() => {
    setNewModuleForm((f) => ({ ...f, leafCategoryPk: "" }));
  }, [topPk, prepAppliesToVal]);


  const moduleGroups = useMemo(() => {
    const list = modulesData?.results ?? [];
    const map = new Map<string, IModule[]>();
    for (const mod of list) {
      const p = mod.category_detail?.parent;
      const key = p
        ? `${displayModuleCategoryName(p, i18n.language)}${p.slug ? ` · ${p.slug}` : ""}`
        : mod.category_detail
          ? `— ${displayModuleCategoryName(mod.category_detail, i18n.language)}`
          : "Uncategorized";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(mod);
    }
    return Array.from(map.entries());
  }, [modulesData, i18n.language]);

  const openAddModule = () => {
    setNewModuleForm({
      code: "",
      name: "",
      topCategoryPk: "",
      leafCategoryPk: "",
      prepAppliesTo: "general",
    });
    onAddModuleOpen();
  };

  const handleCreateModule = async () => {
    const code = newModuleForm.code.trim();
    if (!code) {
      toast({ title: "Module code is required", status: "warning", duration: 2000, position: "bottom-right" });
      return;
    }
    if (!newModuleForm.topCategoryPk) {
      toast({ title: "대분류를 선택하세요", status: "warning", duration: 2000, position: "bottom-right" });
      return;
    }
    const subs = childCategories ?? [];
    const finalCategoryPk =
      subs.length === 0 ? newModuleForm.topCategoryPk : newModuleForm.leafCategoryPk;
    if (!finalCategoryPk) {
      toast({
        title: subs.length ? "소분류를 선택하세요" : "분류를 확인할 수 없습니다",
        status: "warning",
        duration: 2500,
        position: "bottom-right",
      });
      return;
    }
    setIsCreatingModule(true);
    try {
      await createModule({
        code,
        name: newModuleForm.name.trim() || undefined,
        sj_no: pk,
        module_category: Number(finalCategoryPk),
      });
      toast({ title: "Module created", status: "success", duration: 2000, position: "bottom-right" });
      queryClient.invalidateQueries({ queryKey: ["modulesBySjNo", pk] });
      queryClient.invalidateQueries({ queryKey: ["modules"] });
      onAddModuleClose();
    } catch (e: unknown) {
      const msg =
        e && typeof e === "object" && "response" in e
          ? JSON.stringify((e as { response?: { data?: unknown } }).response?.data)
          : "Failed to create module";
      toast({ title: msg, status: "error", duration: 4000, position: "bottom-right" });
    } finally {
      setIsCreatingModule(false);
    }
  };

  const confirmDeleteModule = async () => {
    if (!moduleToDelete) return;
    setIsDeletingModule(true);
    try {
      await deleteModule(moduleToDelete.pk);
      toast({ title: "Module deleted", status: "success", duration: 2000, position: "bottom-right" });
      queryClient.invalidateQueries({ queryKey: ["modulesBySjNo", pk] });
      queryClient.invalidateQueries({ queryKey: ["modules"] });
      setModuleToDelete(null);
    } catch {
      toast({ title: "Delete failed", status: "error", duration: 2000, position: "bottom-right" });
    } finally {
      setIsDeletingModule(false);
    }
  };

  // ── 사진 zoom 모달 ──
  const { isOpen: isPhotoOpen, onOpen: onPhotoOpen, onClose: onPhotoClose } = useDisclosure();
  const photo = photos && photos.length > 0 ? photos[0] : null;

  if (isLoading) {
    return (
      <Center minH="60vh">
        <Spinner size="xl" />
      </Center>
    );
  }

  if (!sjNo) {
    return (
      <Center minH="60vh">
        <Text color="gray.400">SJ No not found.</Text>
      </Center>
    );
  }

  return (
    <>
      <Helmet>
        <title>{sjNo.sj_no}</title>
      </Helmet>

      <Box bg={pageBg} minH="100vh" px={{ base: 4, md: 8, lg: 12 }} py={{ base: 6, md: 8 }}>
        <Box maxW="5xl" mx="auto">

          {/* 상단 네비게이션 */}
          <HStack mb={4}>
            <Button
              leftIcon={<FaArrowLeft />}
              variant="ghost"
              size="sm"
              onClick={() => navigate(-1)}
            >
              Back
            </Button>
          </HStack>

          {/* ── 메인 카드 + 버튼 ── */}
          <Box position="relative">
            {/* Edit / Delete 버튼 (카드 오른쪽 상단 바깥) */}
            <HStack position="absolute" top={-10} right={0} spacing={2}>
              {isEditing ? (
                <>
                  <Button size="sm" variant="ghost" onClick={() => setIsEditing(false)}>
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    colorScheme="blue"
                    isLoading={isSaving}
                    onClick={handleSave}
                  >
                    Save
                  </Button>
                </>
              ) : (
                <>
                  <Button size="sm" leftIcon={<FaEdit />} variant="ghost" onClick={startEdit}>
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    leftIcon={<FaTrash />}
                    variant="ghost"
                    colorScheme="red"
                    onClick={onDeleteOpen}
                  >
                    Delete
                  </Button>
                </>
              )}
            </HStack>

            {/* 메인 카드 */}
            <Box
              bg={cardBg}
              borderRadius="xl"
              border="1px solid"
              borderColor={borderColor}
              p={6}
              shadow="sm"
            >
              <HStack align="flex-start" spacing={6}>

                {/* 왼쪽: 정보 */}
                <VStack align="stretch" spacing={4} flex={1}>
                  {/* SJ No */}
                  <Box>
                    <Text fontSize="xs" color={labelColor} fontWeight="semibold" mb={1}>SJ NO</Text>
                    {isEditing ? (
                      <Input
                        value={form.sj_no}
                        onChange={(e) => setForm({ ...form, sj_no: e.target.value })}
                        fontWeight="bold"
                        fontSize="lg"
                      />
                    ) : (
                      <Heading size="md">{sjNo.sj_no}</Heading>
                    )}
                  </Box>

                  {/* SJ Style Name */}
                  <Box>
                    <Text fontSize="xs" color={labelColor} fontWeight="semibold" mb={1}>SJ STYLE NAME</Text>
                    {isEditing ? (
                      <Input
                        value={form.style_name}
                        onChange={(e) => setForm({ ...form, style_name: e.target.value })}
                        placeholder="optional"
                      />
                    ) : (
                      <Text fontSize="md">{sjNo.style_name || "-"}</Text>
                    )}
                  </Box>

                  <Divider />

                  {/* Style 정보 */}
                  <Box>
                    <Text fontSize="xs" color={labelColor} fontWeight="semibold" mb={2}>STYLE</Text>
                    <HStack spacing={3} align="center">
                      <Link
                        as={RouterLink}
                        to={`/sjstyles/${sjNo.sj_style}`}
                        color="blue.500"
                        fontWeight="bold"
                        fontSize="md"
                      >
                        {sjNo.sj_style_code ?? "-"}
                      </Link>
                      {sjNo.sj_style_name && (
                        <Text fontSize="sm" color={labelColor}>{sjNo.sj_style_name}</Text>
                      )}
                    </HStack>
                  </Box>

                  {/* FK 배지 */}
                  <HStack spacing={2} flexWrap="wrap">
                    {sjNo.sj_bag_category && (
                      <Badge colorScheme="purple">{sjNo.sj_bag_category.name}</Badge>
                    )}
                    {sjNo.sj_buyer_brand && (
                      <Badge colorScheme="blue">{sjNo.sj_buyer_brand.name}</Badge>
                    )}
                    {sjNo.sj_body_material && (
                      <Badge colorScheme="green">{sjNo.sj_body_material.name}</Badge>
                    )}
                    {sjNo.sj_bag_type && (
                      <Badge colorScheme="orange">{sjNo.sj_bag_type.name}</Badge>
                    )}
                  </HStack>

                  <Divider />

                  {/* Memo */}
                  <Box>
                    <Text fontSize="xs" color={labelColor} fontWeight="semibold" mb={1}>MEMO</Text>
                    {isEditing ? (
                      <Textarea
                        value={form.memo}
                        onChange={(e) => setForm({ ...form, memo: e.target.value })}
                        rows={4}
                        placeholder="optional"
                      />
                    ) : (
                      <Text fontSize="sm" whiteSpace="pre-wrap">
                        {sjNo.memo || <Text as="span" color="gray.400">-</Text>}
                      </Text>
                    )}
                  </Box>

                  <Divider />

                  {/* IE Metrics */}
                  <Box>
                    <Text fontSize="xs" color={labelColor} fontWeight="semibold" mb={2}>IE METRICS</Text>
                    <HStack spacing={6} flexWrap="wrap" align="flex-start">
                      <Box>
                        <Text fontSize="xs" color={labelColor} mb={0.5}>Cycle Time (s)</Text>
                        {editingCycleTime !== null ? (
                          <HStack>
                            <Input size="xs" w="100px" autoFocus
                              value={editingCycleTime}
                              onChange={(e) => setEditingCycleTime(e.target.value)}
                              onBlur={() => saveSjNoCycleTime(editingCycleTime)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") saveSjNoCycleTime(editingCycleTime);
                                if (e.key === "Escape") setEditingCycleTime(null);
                              }}
                            />
                          </HStack>
                        ) : (
                          <HStack spacing={2}>
                            <Text fontSize="sm" cursor="pointer" color={sjNo.cycle_time ? undefined : "gray.400"}
                              _hover={{ textDecoration: "underline" }}
                              onClick={() => setEditingCycleTime(sjNo.cycle_time ?? "")}>
                              {sjNo.cycle_time || "—"}
                            </Text>
                            {sjNo.cycle_time && (
                              <Button size="xs" variant="ghost" colorScheme="red" px={1} onClick={clearSjNoCycleTime}>×</Button>
                            )}
                          </HStack>
                        )}
                      </Box>
                      <Box>
                        <Text fontSize="xs" color={labelColor} mb={0.5}>Target / h</Text>
                        {editingTargetHr !== null ? (
                          <Input size="xs" w="100px" autoFocus
                            value={editingTargetHr}
                            onChange={(e) => setEditingTargetHr(e.target.value)}
                            onBlur={() => saveSjNoTargetHr(editingTargetHr)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") saveSjNoTargetHr(editingTargetHr);
                              if (e.key === "Escape") setEditingTargetHr(null);
                            }}
                          />
                        ) : (
                          <Text fontSize="sm" cursor="pointer" color={sjNo.target_qty_per_hour != null ? undefined : "gray.400"}
                            _hover={{ textDecoration: "underline" }}
                            onClick={() => setEditingTargetHr(String(sjNo.target_qty_per_hour ?? ""))}>
                            {sjNo.target_qty_per_hour != null ? `${sjNo.target_qty_per_hour} pcs/h` : "—"}
                          </Text>
                        )}
                      </Box>
                      <Box>
                        <Text fontSize="xs" color={labelColor} mb={0.5}>Daily Target (8h)</Text>
                        <Text fontSize="sm" color={sjNo.daily_target_qty_8h != null ? undefined : "gray.400"}>
                          {sjNo.daily_target_qty_8h != null ? `${sjNo.daily_target_qty_8h} pcs` : "—"}
                        </Text>
                      </Box>
                    </HStack>
                    <Text fontSize="xs" color="gray.400" mt={1}>
                      Cycle Time and Target/h are linked. Setting one auto-calculates the other.
                    </Text>
                  </Box>

                  <Divider />

                  {/* Created At */}
                  <Box>
                    <Text fontSize="xs" color={labelColor} fontWeight="semibold" mb={1}>CREATED</Text>
                    <Text fontSize="sm">{new Date(sjNo.created_at).toLocaleString()}</Text>
                  </Box>
                </VStack>

                {/* 오른쪽: 스타일 사진 */}
                <Box flexShrink={0} w="160px">
                  {photosLoading ? (
                    <Skeleton w="160px" h="160px" borderRadius="lg" />
                  ) : photo ? (
                    <Image
                      src={photo.file}
                      alt="style photo"
                      w="160px"
                      h="160px"
                      objectFit="cover"
                      borderRadius="lg"
                      cursor="pointer"
                      _hover={{ opacity: 0.85, transform: "scale(1.02)", transition: "all 0.2s" }}
                      onClick={onPhotoOpen}
                    />
                  ) : (
                    <Box
                      w="160px"
                      h="160px"
                      borderRadius="lg"
                      bg={noPhotoBg}
                      display="flex"
                      alignItems="center"
                      justifyContent="center"
                    >
                      <Text fontSize="xs" color="gray.400">No photo</Text>
                    </Box>
                  )}
                </Box>
              </HStack>
            </Box>
          </Box>

          {/* ── Module 목록 — 생성·삭제·편집(SjModuleDetail의 Process와 동일 패턴) ── */}
          <Box
            bg={cardBg}
            borderRadius="xl"
            border="1px solid"
            borderColor={borderColor}
            p={6}
            shadow="sm"
            mt={6}
          >
            <HStack justify="space-between" align="center" mb={4} flexWrap="wrap" gap={2}>
              <Heading size="sm">Modules</Heading>
              <HStack>
                <Button
                  as={RouterLink}
                  to="/production-process/module-categories"
                  size="sm"
                  variant="outline"
                >
                  Categories
                </Button>
                <Button size="sm" leftIcon={<FaPlus />} colorScheme="blue" onClick={openAddModule}>
                  Add Module
                </Button>
              </HStack>
            </HStack>
            <Divider mb={4} />
            {modulesLoading ? (
              <Center py={6}><Spinner /></Center>
            ) : !modulesData?.results?.length ? (
              <Box py={6} textAlign="center">
                <Text color="gray.400" mb={3} fontSize="sm">
                  No modules linked to this SJ No. Use &quot;Add Module&quot; to create one.
                </Text>
                <Button size="sm" leftIcon={<FaPlus />} colorScheme="blue" variant="outline" onClick={openAddModule}>
                  Add Module
                </Button>
              </Box>
            ) : (
              <VStack align="stretch" spacing={6}>
                {moduleGroups.map(([groupTitle, rows]) => (
                  <Box key={groupTitle}>
                    <Text fontSize="xs" fontWeight="bold" color={labelColor} textTransform="uppercase" mb={2}>
                      {groupTitle}
                    </Text>
                    <TableContainer overflowX="auto">
                      <Table size="sm" variant="simple">
                        <Thead>
                          <Tr>
                            <Th>#</Th>
                            <Th>Category</Th>
                            <Th>Code</Th>
                            <Th>Name</Th>
                            <Th isNumeric>Processes</Th>
                            <Th>Created</Th>
                            <Th w="140px">Actions</Th>
                          </Tr>
                        </Thead>
                        <Tbody>
                          {rows.map((module: IModule, idx: number) => (
                            <Tr key={module.pk} _hover={{ bg: rowHoverBg }}>
                              <Td>{idx + 1}</Td>
                              <Td fontSize="sm" whiteSpace="nowrap">
                                {module.category_detail
                                  ? displayModuleCategoryName(module.category_detail, i18n.language)
                                  : "—"}
                              </Td>
                              <Td fontWeight="semibold" whiteSpace="nowrap">
                                <RouterLink to={`/production-process/modules/${module.pk}`}>
                                  <Link as="span" color="blue.500">{module.code}</Link>
                                </RouterLink>
                              </Td>
                              <Td whiteSpace="nowrap">{module.name || "-"}</Td>
                              <Td isNumeric>{module.process_count ?? 0}</Td>
                              <Td whiteSpace="nowrap">{new Date(module.created_at).toLocaleDateString("ko-KR")}</Td>
                              <Td>
                                <HStack spacing={1}>
                                  <Button
                                    as={RouterLink}
                                    to={`/production-process/modules/${module.pk}`}
                                    size="xs"
                                    colorScheme="blue"
                                    variant="outline"
                                  >
                                    Edit
                                  </Button>
                                  <IconButton
                                    aria-label={`Delete module ${module.code}`}
                                    icon={<FaTrash />}
                                    size="xs"
                                    variant="ghost"
                                    colorScheme="red"
                                    onClick={() => setModuleToDelete({ pk: module.pk, code: module.code })}
                                  />
                                </HStack>
                              </Td>
                            </Tr>
                          ))}
                        </Tbody>
                      </Table>
                    </TableContainer>
                  </Box>
                ))}
              </VStack>
            )}
          </Box>

          {/* Add Module 모달 */}
          <Modal isOpen={isAddModuleOpen} onClose={onAddModuleClose} isCentered>
            <ModalOverlay />
            <ModalContent>
              <ModalHeader>Add module</ModalHeader>
              <ModalCloseButton />
              <ModalBody>
                <Text fontSize="sm" color="gray.600" mb={4}>
                  New module under SJ No <strong>{sjNo.sj_no}</strong>. Select production category, then code/name.
                  Processes are added on the module detail page.
                </Text>
                <Grid templateColumns="1fr" gap={4}>
                  <Box>
                    <Text fontSize="xs" fontWeight="semibold" color={labelColor} mb={1}>
                      대분류 *
                    </Text>
                    <Select
                      placeholder="Select category"
                      value={newModuleForm.topCategoryPk === "" ? "" : String(newModuleForm.topCategoryPk)}
                      onChange={(e) =>
                        setNewModuleForm((f) => ({
                          ...f,
                          topCategoryPk: e.target.value ? Number(e.target.value) : "",
                        }))
                      }
                    >
                      {categoryRoots.map((r) => (
                        <option key={r.pk} value={String(r.pk)}>
                          {displayModuleCategoryName(r, i18n.language)}
                        </option>
                      ))}
                    </Select>
                  </Box>
                  {selectedTop?.slug === "preparation" && (
                    <Box>
                      <Text fontSize="xs" fontWeight="semibold" color={labelColor} mb={2}>
                        Preparation — bag line
                      </Text>
                      <RadioGroup
                        value={newModuleForm.prepAppliesTo}
                        onChange={(v: "general" | "handbag") =>
                          setNewModuleForm((f) => ({ ...f, prepAppliesTo: v }))
                        }
                      >
                        <Stack direction="row" spacing={4}>
                          <Radio value="general">General bag (일반가방)</Radio>
                          <Radio value="handbag">Handbag (핸드백)</Radio>
                        </Stack>
                      </RadioGroup>
                    </Box>
                  )}
                  {(childCategories?.length ?? 0) > 0 && (
                    <Box>
                      <Text fontSize="xs" fontWeight="semibold" color={labelColor} mb={1}>
                        소분류 *
                      </Text>
                      <Select
                        placeholder="Select sub-category"
                        value={
                          newModuleForm.leafCategoryPk === ""
                            ? ""
                            : String(newModuleForm.leafCategoryPk)
                        }
                        onChange={(e) =>
                          setNewModuleForm((f) => ({
                            ...f,
                            leafCategoryPk: e.target.value ? Number(e.target.value) : "",
                          }))
                        }
                      >
                        {(childCategories ?? []).map((c) => (
                          <option key={c.pk} value={String(c.pk)}>
                            {displayModuleCategoryName(c, i18n.language)}
                          </option>
                        ))}
                      </Select>
                    </Box>
                  )}
                  <Box>
                    <Text fontSize="xs" fontWeight="semibold" color={labelColor} mb={1}>Code *</Text>
                    <Input
                      value={newModuleForm.code}
                      onChange={(e) => setNewModuleForm((f) => ({ ...f, code: e.target.value }))}
                      placeholder="e.g. M01"
                    />
                  </Box>
                  <Box>
                    <Text fontSize="xs" fontWeight="semibold" color={labelColor} mb={1}>Name</Text>
                    <Input
                      value={newModuleForm.name}
                      onChange={(e) => setNewModuleForm((f) => ({ ...f, name: e.target.value }))}
                      placeholder="Optional"
                    />
                  </Box>
                </Grid>
              </ModalBody>
              <ModalFooter>
                <Button variant="ghost" mr={3} onClick={onAddModuleClose}>Cancel</Button>
                <Button colorScheme="blue" isLoading={isCreatingModule} onClick={handleCreateModule}>
                  Create
                </Button>
              </ModalFooter>
            </ModalContent>
          </Modal>

        </Box>
      </Box>

      {/* 삭제 확인 다이얼로그 */}
      <AlertDialog isOpen={isDeleteOpen} leastDestructiveRef={cancelRef} onClose={onDeleteClose}>
        <AlertDialogOverlay>
          <AlertDialogContent>
            <AlertDialogHeader fontSize="lg" fontWeight="bold">Delete SJ No</AlertDialogHeader>
            <AlertDialogBody>
              <strong>{sjNo.sj_no}</strong>을(를) 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
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

      {/* Delete Module 확인 */}
      <AlertDialog
        isOpen={!!moduleToDelete}
        leastDestructiveRef={moduleDeleteCancelRef}
        onClose={() => setModuleToDelete(null)}
      >
        <AlertDialogOverlay>
          <AlertDialogContent>
            <AlertDialogHeader fontSize="lg" fontWeight="bold">
              Delete Module
            </AlertDialogHeader>
            <AlertDialogBody>
              Delete module <strong>{moduleToDelete?.code}</strong>? Child processes will also be removed. This cannot be undone.
            </AlertDialogBody>
            <AlertDialogFooter>
              <Button ref={moduleDeleteCancelRef} onClick={() => setModuleToDelete(null)}>
                Cancel
              </Button>
              <Button
                colorScheme="red"
                ml={3}
                isLoading={isDeletingModule}
                onClick={confirmDeleteModule}
              >
                Delete
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>

      {/* 사진 zoom 모달 */}
      {photo && (
        <Modal isOpen={isPhotoOpen} onClose={onPhotoClose} size="2xl" isCentered>
          <ModalOverlay />
          <ModalContent>
            <ModalHeader>{sjNo.sj_style_code} — Photo</ModalHeader>
            <ModalCloseButton />
            <ModalBody pb={6}>
              <Image src={photo.file} alt="style photo" w="full" borderRadius="md" />
            </ModalBody>
          </ModalContent>
        </Modal>
      )}
    </>
  );
}
