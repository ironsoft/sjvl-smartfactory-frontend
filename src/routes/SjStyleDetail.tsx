import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, useNavigate, Link as RouterLink } from "react-router-dom";
import { Helmet } from "react-helmet";
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
  Select,
  Table,
  TableContainer,
  Tbody,
  Td,
  Th,
  Thead,
  Tr,
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
  ModalFooter,
  ModalCloseButton,
  useDisclosure,
  IconButton,
  Image,
  Skeleton
} from "@chakra-ui/react";
import { useRef, useState, useEffect } from "react";
import { FaArrowLeft, FaPlus, FaTrash, FaEdit, FaTimes } from "react-icons/fa";
import {
  getSjStyleDetail,
  getSjStylePhotos,
  createSjStylePhoto,
  getUploadURL,
  uploadImage,
  getBagCategories,
  getBodyMaterials,
  getBuyerBrands,
  getBagTypes,
  IFilePhotos,
  ISjStyleDetail,
  ISjNo,
  ISjBagCategory,
  ISjBodyMaterial,
  ISjBuyerBrand,
  ISjBagType
} from "../api";
import axios from "axios";
import Cookies from "js-cookie";

// ─── inline API helpers (edit / delete / sj-no CRUD) ─────────────────────────

const instance = axios.create({
  baseURL:
    process.env.NODE_ENV === "development"
      ? "http://127.0.0.1:8000/api/v1/"
      : "https://backend.sjep.space/api/v1/",
  withCredentials: true
});

const editSjStyle = (pk: number, data: Partial<ISjStyleDetail>) =>
  instance
    .put(`sj-styles/${pk}`, data, {
      headers: { "X-CSRFToken": Cookies.get("csrftoken") || "" }
    })
    .then((res) => res.data);

const deleteSjStyle = (pk: number) =>
  instance
    .delete(`sj-styles/${pk}`, {
      headers: { "X-CSRFToken": Cookies.get("csrftoken") || "" }
    })
    .then((res) => res.data);

const createSjNo = (stylePk: number, sj_no: string, style_name: string, memo: string) =>
  instance
    .post(
      `sj-styles/${stylePk}/sj-nos`,
      { sj_no, style_name, memo },
      { headers: { "X-CSRFToken": Cookies.get("csrftoken") || "" } }
    )
    .then((res) => res.data);

const editSjNo = (pk: number, data: { sj_no?: string; style_name?: string; memo?: string }) =>
  instance
    .put(`sj-styles/sj-nos/${pk}`, data, {
      headers: { "X-CSRFToken": Cookies.get("csrftoken") || "" }
    })
    .then((res) => res.data);

const deleteSjNo = (pk: number) =>
  instance
    .delete(`sj-styles/sj-nos/${pk}`, {
      headers: { "X-CSRFToken": Cookies.get("csrftoken") || "" }
    })
    .then((res) => res.data);

const deleteSjStylePhoto = (stylePk: number, photoPk: number) =>
  instance
    .delete(`sj-styles/${stylePk}/photos/${photoPk}`, {
      headers: { "X-CSRFToken": Cookies.get("csrftoken") || "" }
    })
    .then((res) => res.data);

// ─── component ────────────────────────────────────────────────────────────────

export default function SjStyleDetail() {
  const { styleId } = useParams<{ styleId: string }>();
  const pk = Number(styleId);
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();
  const cancelRef = useRef<HTMLButtonElement>(null);

  // ── 조회 ──
  const { data: style, isLoading, error } = useQuery<ISjStyleDetail>({
    queryKey: ["sjStyleDetail", pk],
    queryFn: () => getSjStyleDetail(pk),
    enabled: !!pk
  });

  const { data: photos = [], isLoading: photosLoading } = useQuery<IFilePhotos[]>({
    queryKey: ["sjStylePhotos", pk],
    queryFn: () => getSjStylePhotos(pk),
    enabled: !!pk
  });

  // ── 색상 ──
  const pageBg = useColorModeValue("gray.50", "gray.900");
  const cardBg = useColorModeValue("white", "gray.800");
  const labelColor = useColorModeValue("gray.500", "gray.400");
  const tableBg = useColorModeValue("gray.50", "gray.700");
  const noPhotoBg = useColorModeValue("gray.100", "gray.700");

  // ── FK 선택지 ──
  const { data: bagCategories = [] } = useQuery<ISjBagCategory[]>({ queryKey: ["bagCategories"], queryFn: getBagCategories });
  const { data: bodyMaterials = [] } = useQuery<ISjBodyMaterial[]>({ queryKey: ["bodyMaterials"], queryFn: getBodyMaterials });
  const { data: buyerBrands = [] } = useQuery<ISjBuyerBrand[]>({ queryKey: ["buyerBrands"], queryFn: getBuyerBrands });
  const { data: bagTypes = [] } = useQuery<ISjBagType[]>({ queryKey: ["bagTypes"], queryFn: getBagTypes });

  // ── 편집 상태 ──
  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState({
    code: "",
    style_name: "",
    buyer_style_code: "",
    internal_style_code: "",
    pattern_code: "",
    description: "",
    bag_category: null as number | null,
    body_material: null as number | null,
    buyer_brand: null as number | null,
    bag_type: null as number | null,
  });

  // ── 사진 편집 상태 ──
  const [newPhotoFile, setNewPhotoFile] = useState<File | null>(null);
  const [newPhotoPreview, setNewPhotoPreview] = useState<string | null>(null);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (style) {
      setForm({
        code: style.code ?? "",
        style_name: style.style_name ?? "",
        buyer_style_code: style.buyer_style_code ?? "",
        internal_style_code: style.internal_style_code ?? "",
        pattern_code: style.pattern_code ?? "",
        description: style.description ?? "",
        bag_category: style.bag_category?.pk ?? null,
        body_material: style.body_material?.pk ?? null,
        buyer_brand: style.buyer_brand?.pk ?? null,
        bag_type: style.bag_type?.pk ?? null,
      });
    }
  }, [style]);

  const clearNewPhoto = () => {
    if (newPhotoPreview) URL.revokeObjectURL(newPhotoPreview);
    setNewPhotoFile(null);
    setNewPhotoPreview(null);
    if (photoInputRef.current) photoInputRef.current.value = "";
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    clearNewPhoto();
  };

  // ── Style 삭제 다이얼로그 ──
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  // ── SjNo 추가 모달 ──
  const {
    isOpen: isAddNoOpen,
    onOpen: onAddNoOpen,
    onClose: onAddNoClose
  } = useDisclosure();
  const [newSjNo, setNewSjNo] = useState("");
  const [newStyleName, setNewStyleName] = useState("");
  const [newMemo, setNewMemo] = useState("");

  // ── SjNo 편집 모달 ──
  const {
    isOpen: isEditNoOpen,
    onOpen: onEditNoOpen,
    onClose: onEditNoClose
  } = useDisclosure();
  const [editingNo, setEditingNo] = useState<ISjNo | null>(null);
  const [editNoForm, setEditNoForm] = useState({ sj_no: "", style_name: "", memo: "" });

  // ── SjNo 삭제 다이얼로그 ──
  const [deletingNoPk, setDeletingNoPk] = useState<number | null>(null);
  const [photoModalSrc, setPhotoModalSrc] = useState<string | null>(null);

  const formatDate = (value?: string) => {
    if (!value) return "-";
    const d = new Date(value);
    if (isNaN(d.getTime())) return value;
    return d.toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    });
  };

  // ── Mutations ──
  const handleSave = async () => {
    setIsUploadingPhoto(true);
    try {
      await editSjStyle(pk, form as any);
      if (newPhotoFile) {
        const urlData = await getUploadURL();
        const dt = new DataTransfer();
        dt.items.add(newPhotoFile);
        const cfResult: any = await uploadImage({ file: dt.files, uploadURL: urlData.uploadURL });
        const cfUrl = `https://imagedelivery.net/mzmXhxWLR9jzdX8u9g4BBQ/${cfResult.result.id}/public`;
        await createSjStylePhoto(pk, cfUrl, form.style_name);
      }
      toast({ title: "Updated", status: "success", duration: 2000, position: "bottom-right" });
      queryClient.invalidateQueries({ queryKey: ["sjStyleDetail", pk] });
      queryClient.invalidateQueries({ queryKey: ["sjstyles"] });
      queryClient.invalidateQueries({ queryKey: ["sjStylePhotos", pk] });
      setIsEditing(false);
      clearNewPhoto();
    } catch {
      toast({ title: "Update failed", status: "error", duration: 2000, position: "bottom-right" });
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const deleteMutation = useMutation({
    mutationFn: () => deleteSjStyle(pk),
    onSuccess: () => {
      toast({ title: "Deleted", status: "success", duration: 2000, position: "bottom-right" });
      queryClient.invalidateQueries({ queryKey: ["sjstyles"] });
      navigate("/sjstyles");
    },
    onError: () => {
      toast({ title: "Delete failed", status: "error", duration: 2000, position: "bottom-right" });
    }
  });

  const addNoMutation = useMutation({
    mutationFn: () => createSjNo(pk, newSjNo.trim(), newStyleName.trim(), newMemo.trim()),
    onSuccess: () => {
      toast({ title: "SJ No added", status: "success", duration: 2000, position: "bottom-right" });
      queryClient.invalidateQueries({ queryKey: ["sjStyleDetail", pk] });
      setNewSjNo("");
      setNewStyleName("");
      setNewMemo("");
      onAddNoClose();
    },
    onError: () => {
      toast({ title: "Failed to add SJ No", status: "error", duration: 2000, position: "bottom-right" });
    }
  });

  const editNoMutation = useMutation({
    mutationFn: () => editSjNo(editingNo!.pk, editNoForm),
    onSuccess: () => {
      toast({ title: "SJ No updated", status: "success", duration: 2000, position: "bottom-right" });
      queryClient.invalidateQueries({ queryKey: ["sjStyleDetail", pk] });
      onEditNoClose();
    },
    onError: () => {
      toast({ title: "Failed to update SJ No", status: "error", duration: 2000, position: "bottom-right" });
    }
  });

  const deleteNoMutation = useMutation({
    mutationFn: (noPk: number) => deleteSjNo(noPk),
    onSuccess: () => {
      toast({ title: "SJ No deleted", status: "success", duration: 2000, position: "bottom-right" });
      queryClient.invalidateQueries({ queryKey: ["sjStyleDetail", pk] });
      setDeletingNoPk(null);
    },
    onError: () => {
      toast({ title: "Failed to delete SJ No", status: "error", duration: 2000, position: "bottom-right" });
      setDeletingNoPk(null);
    }
  });

  if (isLoading) return <Center minH="60vh"><Spinner size="lg" /></Center>;
  if (error || !style)
    return (
      <Center minH="60vh">
        <Text color="red.400">Failed to load data.</Text>
      </Center>
    );

  const fkLabel = (obj: ISjBagCategory | ISjBodyMaterial | ISjBuyerBrand | ISjBagType | null) =>
    obj ? `${obj.name}${obj.code ? ` (${obj.code})` : ""}` : "-";

  return (
    <>
      <Helmet>
        <title>{style.code} — SJ Style</title>
      </Helmet>

      <Box bg={pageBg} minH="100vh" px={{ base: 4, md: 8, lg: 12 }} py={{ base: 6, md: 10 }}>
        <Box maxW={{ base: "3xl", lg: "5xl" }} mx="auto">

          {/* 뒤로 가기 + Edit/Delete 버튼 */}
          <HStack justify="space-between" mb={6}>
            <Button
              leftIcon={<FaArrowLeft />}
              variant="ghost"
              size="sm"
              onClick={() => navigate(-1)}
            >
              Back
            </Button>
            <HStack spacing={2}>
              {isEditing ? (
                <>
                  <Button
                    size="sm"
                    colorScheme="blue"
                    isLoading={isUploadingPhoto}
                    onClick={handleSave}
                  >
                    Save
                  </Button>
                  <Button size="sm" variant="ghost" onClick={handleCancelEdit}>
                    Cancel
                  </Button>
                </>
              ) : (
                <>
                  <Button size="sm" leftIcon={<FaEdit />} variant="outline" onClick={() => setIsEditing(true)}>
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    colorScheme="red"
                    variant="outline"
                    leftIcon={<FaTrash />}
                    onClick={() => setIsDeleteOpen(true)}
                  >
                    Delete
                  </Button>
                </>
              )}
            </HStack>
          </HStack>

          {/* ── 상단 카드 ── */}
          <Box bg={cardBg} borderRadius="xl" shadow="sm" p={{ base: 5, md: 8 }} mb={6}>
            <HStack justify="space-between" align="flex-start" mb={4}>
              {/* Style Code/Name */}
              <VStack align="flex-start" spacing={1}>
                {isEditing ? (
                  <Input
                    value={form.code}
                    onChange={(e) => setForm({ ...form, code: e.target.value })}
                    fontWeight="bold"
                    fontSize="2xl"
                    variant="flushed"
                    placeholder="Style Code"
                  />
                ) : (
                  <Heading size="lg">{style.code}</Heading>
                )}
                {isEditing ? (
                  <Input
                    value={form.style_name}
                    onChange={(e) => setForm({ ...form, style_name: e.target.value })}
                    variant="flushed"
                    placeholder="Style Name"
                    color={labelColor}
                  />
                ) : (
                  <Text color={labelColor} fontSize="md">{style.style_name}</Text>
                )}
              </VStack>

              {/* 대표 사진 (오른쪽 끝) */}
              <VStack spacing={2} align="center" flexShrink={0}>
                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/*"
                  style={{ display: "none" }}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setNewPhotoFile(file);
                    setNewPhotoPreview(URL.createObjectURL(file));
                  }}
                />
                {photosLoading ? (
                  <Skeleton boxSize="80px" borderRadius="lg" />
                ) : newPhotoPreview ? (
                  <Image
                    src={newPhotoPreview}
                    alt="new photo"
                    boxSize="80px"
                    objectFit="cover"
                    borderRadius="lg"
                  />
                ) : photos.length > 0 ? (
                  <Image
                    src={photos[0].file}
                    alt={style.code}
                    boxSize="80px"
                    objectFit="cover"
                    borderRadius="lg"
                    cursor={isEditing ? "default" : "pointer"}
                    _hover={!isEditing ? { opacity: 0.85, transform: "scale(1.03)", transition: "all 0.2s" } : {}}
                    onClick={() => { if (!isEditing) setPhotoModalSrc(photos[0].file); }}
                  />
                ) : (
                  <Box
                    boxSize="80px"
                    borderRadius="lg"
                    bg={noPhotoBg}
                    display="flex"
                    alignItems="center"
                    justifyContent="center"
                  >
                    <Text fontSize="xs" color={labelColor}>No Photo</Text>
                  </Box>
                )}
                {isEditing && (
                  <VStack spacing={1}>
                    <Button
                      size="xs"
                      variant="outline"
                      onClick={() => photoInputRef.current?.click()}
                    >
                      {newPhotoPreview ? "Change" : photos.length > 0 ? "Replace" : "Upload"}
                    </Button>
                    {newPhotoPreview && (
                      <Button size="xs" variant="ghost" colorScheme="red" leftIcon={<FaTimes />} onClick={clearNewPhoto}>
                        Remove
                      </Button>
                    )}
                    {!newPhotoPreview && photos.length > 0 && (
                      <Button
                        size="xs"
                        variant="ghost"
                        colorScheme="red"
                        leftIcon={<FaTrash />}
                        onClick={async () => {
                          await deleteSjStylePhoto(pk, Number(photos[0].pk));
                          queryClient.invalidateQueries({ queryKey: ["sjStylePhotos", pk] });
                        }}
                      >
                        Delete
                      </Button>
                    )}
                  </VStack>
                )}
              </VStack>
            </HStack>

            <Divider mb={5} />

            {/* ── 필드 그리드 ── */}
            <Box
              display="grid"
              gridTemplateColumns={{ base: "1fr", md: "1fr 1fr" }}
              gap={5}
            >
              {/* Buyer Style Code */}
              <VStack align="flex-start" spacing={1}>
                <Text fontSize="xs" fontWeight="semibold" color={labelColor} textTransform="uppercase">
                  Buyer Style Code
                </Text>
                {isEditing ? (
                  <Input
                    size="sm"
                    value={form.buyer_style_code}
                    onChange={(e) => setForm({ ...form, buyer_style_code: e.target.value })}
                    placeholder="-"
                  />
                ) : (
                  <Text>{style.buyer_style_code || "-"}</Text>
                )}
              </VStack>

              {/* Internal Style Code */}
              <VStack align="flex-start" spacing={1}>
                <Text fontSize="xs" fontWeight="semibold" color={labelColor} textTransform="uppercase">
                  Internal Style Code
                </Text>
                {isEditing ? (
                  <Input
                    size="sm"
                    value={form.internal_style_code}
                    onChange={(e) => setForm({ ...form, internal_style_code: e.target.value })}
                    placeholder="-"
                  />
                ) : (
                  <Text>{style.internal_style_code || "-"}</Text>
                )}
              </VStack>

              {/* Pattern Code */}
              <VStack align="flex-start" spacing={1}>
                <Text fontSize="xs" fontWeight="semibold" color={labelColor} textTransform="uppercase">
                  Pattern Code
                </Text>
                {isEditing ? (
                  <Input
                    size="sm"
                    value={form.pattern_code}
                    onChange={(e) => setForm({ ...form, pattern_code: e.target.value })}
                    placeholder="-"
                  />
                ) : (
                  <Text>{style.pattern_code || "-"}</Text>
                )}
              </VStack>

              {/* Created At */}
              <VStack align="flex-start" spacing={1}>
                <Text fontSize="xs" fontWeight="semibold" color={labelColor} textTransform="uppercase">
                  Created At
                </Text>
                <Text>{formatDate(style.created_at)}</Text>
              </VStack>

              {/* Category */}
              <VStack align="flex-start" spacing={1}>
                <Text fontSize="xs" fontWeight="semibold" color={labelColor} textTransform="uppercase">
                  Category
                </Text>
                {isEditing ? (
                  <Select size="sm" value={form.bag_category ?? ""} onChange={(e) => setForm({ ...form, bag_category: e.target.value ? Number(e.target.value) : null })}>
                    <option value="">— none —</option>
                    {bagCategories.map((c) => <option key={c.pk} value={c.pk}>{c.name}{c.code ? ` (${c.code})` : ""}</option>)}
                  </Select>
                ) : style.bag_category ? (
                  <Badge colorScheme="purple">{fkLabel(style.bag_category)}</Badge>
                ) : (
                  <Text color={labelColor}>-</Text>
                )}
              </VStack>

              {/* Body Material */}
              <VStack align="flex-start" spacing={1}>
                <Text fontSize="xs" fontWeight="semibold" color={labelColor} textTransform="uppercase">
                  Body Material
                </Text>
                {isEditing ? (
                  <Select size="sm" value={form.body_material ?? ""} onChange={(e) => setForm({ ...form, body_material: e.target.value ? Number(e.target.value) : null })}>
                    <option value="">— none —</option>
                    {bodyMaterials.map((m) => <option key={m.pk} value={m.pk}>{m.name}{m.code ? ` (${m.code})` : ""}</option>)}
                  </Select>
                ) : style.body_material ? (
                  <Badge colorScheme="green">{fkLabel(style.body_material)}</Badge>
                ) : (
                  <Text color={labelColor}>-</Text>
                )}
              </VStack>

              {/* Buyer Brand */}
              <VStack align="flex-start" spacing={1}>
                <Text fontSize="xs" fontWeight="semibold" color={labelColor} textTransform="uppercase">
                  Buyer Brand
                </Text>
                {isEditing ? (
                  <Select size="sm" value={form.buyer_brand ?? ""} onChange={(e) => setForm({ ...form, buyer_brand: e.target.value ? Number(e.target.value) : null })}>
                    <option value="">— none —</option>
                    {buyerBrands.map((b) => <option key={b.pk} value={b.pk}>{b.name}{b.code ? ` (${b.code})` : ""}</option>)}
                  </Select>
                ) : style.buyer_brand ? (
                  <Badge colorScheme="blue">{fkLabel(style.buyer_brand)}</Badge>
                ) : (
                  <Text color={labelColor}>-</Text>
                )}
              </VStack>

              {/* Bag Type */}
              <VStack align="flex-start" spacing={1}>
                <Text fontSize="xs" fontWeight="semibold" color={labelColor} textTransform="uppercase">
                  Bag Type
                </Text>
                {isEditing ? (
                  <Select size="sm" value={form.bag_type ?? ""} onChange={(e) => setForm({ ...form, bag_type: e.target.value ? Number(e.target.value) : null })}>
                    <option value="">— none —</option>
                    {bagTypes.map((t) => <option key={t.pk} value={t.pk}>{t.name}{t.code ? ` (${t.code})` : ""}</option>)}
                  </Select>
                ) : style.bag_type ? (
                  <Badge colorScheme="orange">{fkLabel(style.bag_type)}</Badge>
                ) : (
                  <Text color={labelColor}>-</Text>
                )}
              </VStack>
            </Box>

            {/* Description */}
            <VStack align="flex-start" spacing={1} mt={5}>
              <Text fontSize="xs" fontWeight="semibold" color={labelColor} textTransform="uppercase">
                Description
              </Text>
              {isEditing ? (
                <Textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Enter description"
                  rows={3}
                />
              ) : (
                <Text whiteSpace="pre-wrap">{style.description || "-"}</Text>
              )}
            </VStack>
          </Box>

          {/* ── SJ No 목록 카드 ── */}
          <Box id="sj-no-list" bg={cardBg} borderRadius="xl" shadow="sm" p={{ base: 5, md: 8 }}>
            <HStack justify="space-between" mb={4}>
              <Heading size="sm">
                SJ No List{" "}
                <Badge ml={1} colorScheme="gray">
                  {style.sj_nos.length}
                </Badge>
              </Heading>
              <Button
                size="sm"
                leftIcon={<FaPlus />}
                colorScheme="blue"
                variant="outline"
                onClick={onAddNoOpen}
              >
                Add
              </Button>
            </HStack>

            {style.sj_nos.length === 0 ? (
              <Text color={labelColor} textAlign="center" py={4}>
                No SJ No registered.
              </Text>
            ) : (
              <TableContainer>
                <Table size="sm" variant="striped">
                  <Thead bgColor={tableBg}>
                    <Tr>
                      <Th>SJ No</Th>
                      <Th>SJ Style Name</Th>
                      <Th>Memo</Th>
                      <Th>Created At</Th>
                      <Th />
                    </Tr>
                  </Thead>
                  <Tbody>
                    {style.sj_nos.map((no) => (
                      <Tr key={no.pk}>
                        <Td fontWeight="semibold">
                          <RouterLink to={`/sjnos/${no.pk}`}>
                            <Text
                              color="blue.500"
                              _hover={{ textDecoration: "underline" }}
                              cursor="pointer"
                              display="inline"
                            >
                              {no.sj_no}
                            </Text>
                          </RouterLink>
                        </Td>
                        <Td color={labelColor}>{(no as any).style_name || "-"}</Td>
                        <Td color={labelColor}>{no.memo || "-"}</Td>
                        <Td color={labelColor}>{formatDate(no.created_at)}</Td>
                        <Td>
                          <HStack spacing={1} justify="flex-end">
                            <IconButton
                              aria-label="Edit"
                              icon={<FaEdit />}
                              size="xs"
                              variant="ghost"
                              onClick={() => {
                                setEditingNo(no);
                                setEditNoForm({ sj_no: no.sj_no, style_name: (no as any).style_name ?? "", memo: no.memo });
                                onEditNoOpen();
                              }}
                            />
                            <IconButton
                              aria-label="Delete"
                              icon={<FaTrash />}
                              size="xs"
                              variant="ghost"
                              colorScheme="red"
                              onClick={() => setDeletingNoPk(no.pk)}
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
        </Box>
      </Box>

      {/* ── Style 삭제 확인 다이얼로그 ── */}
      <AlertDialog
        isOpen={isDeleteOpen}
        leastDestructiveRef={cancelRef}
        onClose={() => setIsDeleteOpen(false)}
      >
        <AlertDialogOverlay>
          <AlertDialogContent>
            <AlertDialogHeader>Delete Style</AlertDialogHeader>
            <AlertDialogBody>
              Deleting <strong>{style.code}</strong> will also remove all associated SJ Nos. Continue?
            </AlertDialogBody>
            <AlertDialogFooter>
              <Button ref={cancelRef} onClick={() => setIsDeleteOpen(false)}>
                Cancel
              </Button>
              <Button
                colorScheme="red"
                ml={3}
                isLoading={deleteMutation.isPending}
                onClick={() => deleteMutation.mutate()}
              >
                Delete
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>

      {/* ── SjNo 추가 모달 ── */}
      <Modal isOpen={isAddNoOpen} onClose={onAddNoClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Add SJ No</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack spacing={4}>
              <Box w="full">
                <Text fontSize="sm" mb={1} fontWeight="semibold">
                  SJ No <Text as="span" color="red.400">*</Text>
                </Text>
                <Input
                  value={newSjNo}
                  onChange={(e) => setNewSjNo(e.target.value)}
                  placeholder="예: SL8669-F26-2-M"
                />
              </Box>
              <Box w="full">
                <Text fontSize="sm" mb={1} fontWeight="semibold">SJ Style Name</Text>
                <Input
                  value={newStyleName}
                  onChange={(e) => setNewStyleName(e.target.value)}
                  placeholder="optional"
                />
              </Box>
              <Box w="full">
                <Text fontSize="sm" mb={1} fontWeight="semibold">Memo</Text>
                <Textarea
                  value={newMemo}
                  onChange={(e) => setNewMemo(e.target.value)}
                  placeholder="Memo (optional)"
                  rows={2}
                />
              </Box>
            </VStack>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={onAddNoClose}>
              Cancel
            </Button>
            <Button
              colorScheme="blue"
              isDisabled={!newSjNo.trim()}
              isLoading={addNoMutation.isPending}
              onClick={() => addNoMutation.mutate()}
            >
              Add
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* ── SjNo 편집 모달 ── */}
      <Modal isOpen={isEditNoOpen} onClose={onEditNoClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Edit SJ No</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack spacing={4}>
              <Box w="full">
                <Text fontSize="sm" mb={1} fontWeight="semibold">SJ No</Text>
                <Input
                  value={editNoForm.sj_no}
                  onChange={(e) => setEditNoForm({ ...editNoForm, sj_no: e.target.value })}
                />
              </Box>
              <Box w="full">
                <Text fontSize="sm" mb={1} fontWeight="semibold">SJ Style Name</Text>
                <Input
                  value={editNoForm.style_name}
                  onChange={(e) => setEditNoForm({ ...editNoForm, style_name: e.target.value })}
                  placeholder="optional"
                />
              </Box>
              <Box w="full">
                <Text fontSize="sm" mb={1} fontWeight="semibold">Memo</Text>
                <Textarea
                  value={editNoForm.memo}
                  onChange={(e) => setEditNoForm({ ...editNoForm, memo: e.target.value })}
                  rows={2}
                />
              </Box>
            </VStack>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={onEditNoClose}>
              Cancel
            </Button>
            <Button
              colorScheme="blue"
              isLoading={editNoMutation.isPending}
              onClick={() => editNoMutation.mutate()}
            >
              Save
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* ── SjNo 삭제 확인 다이얼로그 ── */}
      <AlertDialog
        isOpen={deletingNoPk !== null}
        leastDestructiveRef={cancelRef}
        onClose={() => setDeletingNoPk(null)}
      >
        <AlertDialogOverlay>
          <AlertDialogContent>
            <AlertDialogHeader>Delete SJ No</AlertDialogHeader>
            <AlertDialogBody>Are you sure you want to delete this SJ No?</AlertDialogBody>
            <AlertDialogFooter>
              <Button ref={cancelRef} onClick={() => setDeletingNoPk(null)}>
                Cancel
              </Button>
              <Button
                colorScheme="red"
                ml={3}
                isLoading={deleteNoMutation.isPending}
                onClick={() => {
                  if (deletingNoPk !== null) deleteNoMutation.mutate(deletingNoPk);
                }}
              >
                Delete
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>

      {/* ── 사진 확대 모달 ── */}
      <Modal isOpen={!!photoModalSrc} onClose={() => setPhotoModalSrc(null)} size="xl" isCentered>
        <ModalOverlay />
        <ModalContent bg="transparent" boxShadow="none">
          <ModalCloseButton color="white" zIndex={10} />
          <ModalBody p={0}>
            {photoModalSrc && (
              <Image
                src={photoModalSrc}
                alt="Style photo"
                w="100%"
                maxH="80vh"
                objectFit="contain"
                borderRadius="lg"
              />
            )}
          </ModalBody>
        </ModalContent>
      </Modal>
    </>
  );
}
