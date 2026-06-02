import {
  AlertDialog,
  AlertDialogBody,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogOverlay,
  AspectRatio,
  Box,
  Button,
  Center,
  Divider,
  FormControl,
  FormLabel,
  Grid,
  Heading,
  HStack,
  IconButton,
  Image,
  Input,
  Modal,
  ModalContent,
  ModalOverlay,
  NumberInput,
  NumberInputField,
  Select,
  SimpleGrid,
  Spinner,
  Stack,
  Table,
  TableContainer,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
  Textarea,
  useColorModeValue,
  useDisclosure,
  useToast
} from "@chakra-ui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Helmet } from "react-helmet";
import { Link as RouterLink, useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { FaCamera, FaEdit, FaTrashAlt, FaVideo } from "react-icons/fa";
import {
  deleteVlAssemblyInspection,
  getDefectCategories,
  getVlAssemblyInspection,
  getUploadURL,
  getUploadVideoURL,
  getVideoData,
  IEpInspectionWritePayload,
  type IEpInspectionListRow,
  patchVlAssemblyInspection,
  uploadImage,
  uploadVideo
} from "../api";

/** EpInspectionForm / SjProcessDetail 과 동일 */
const CF_IMAGE_PUBLIC = (imageId: string) =>
  `https://imagedelivery.net/mzmXhxWLR9jzdX8u9g4BBQ/${imageId}/public`;

const CF_STREAM_BASE = "https://customer-kc2gx0yn68qxte35.cloudflarestream.com";
const streamIframe = (uid: string) => `${CF_STREAM_BASE}/${uid}/iframe`;
const streamThumbnail = (uid: string) =>
  `${CF_STREAM_BASE}/${uid}/thumbnails/thumbnail.jpg`;

function localDateTime(iso: string | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function defectCategoryLabel(
  c: { code: string; name_ko: string; name_en: string; name_vi: string } | null,
  lang: string
): string {
  if (!c) return "—";
  if (lang === "ko") return c.name_ko || c.code;
  if (lang === "vi") return c.name_vi || c.code;
  return c.name_en || c.code;
}

function targetKindLabel(
  kind: IEpInspectionListRow["target_kind"],
  t: (k: string) => string
): string {
  switch (kind) {
    case "process":
    case "ep_process":
    case "vl_process":
      return t("epInspection.targetProcess");
    case "module":
    case "ep_module":
    case "vl_module":
      return t("epInspection.targetModule");
    case "sj_no":
    case "ep_sj_no":
    case "vl_sj_no":
      return t("epInspection.targetSjNo");
    default:
      return String(kind);
  }
}

function StreamVideoThumb({
  uid,
  borderColor,
  videoBg,
  onOpen,
  thumbUrl
}: {
  uid: string;
  borderColor: string;
  videoBg: string;
  onOpen: () => void;
  /** 업로드 직후 API가 준 썸네일 URL (있으면 우선) */
  thumbUrl?: string;
}) {
  const [thumbErr, setThumbErr] = useState(false);
  const src = thumbUrl ?? streamThumbnail(uid);
  useEffect(() => {
    setThumbErr(false);
  }, [uid, thumbUrl]);
  return (
    <Box
      position="relative"
      borderRadius="md"
      overflow="hidden"
      borderWidth="1px"
      borderColor={borderColor}
      cursor="pointer"
      onClick={onOpen}
      _hover={{ opacity: 0.92 }}
      transition="opacity 0.15s"
      role="group"
    >
      {!thumbErr ? (
        <Image
          src={src}
          alt=""
          w="full"
          h="120px"
          objectFit="cover"
          onError={() => setThumbErr(true)}
        />
      ) : (
        <Center h="120px" bg={videoBg}>
          <FaVideo size={32} color="gray" />
        </Center>
      )}
      <Center
        position="absolute"
        inset={0}
        bg="blackAlpha.300"
        pointerEvents="none"
      >
        <Box
          w={10}
          h={10}
          borderRadius="full"
          bg="whiteAlpha.900"
          display="flex"
          alignItems="center"
          justifyContent="center"
        >
          <FaVideo size={16} color="black" />
        </Box>
      </Center>
      <Text
        fontSize="xs"
        fontFamily="mono"
        px={2}
        py={1}
        noOfLines={1}
        title={uid}
      >
        {uid}
      </Text>
    </Box>
  );
}

export default function VlAssemblyInspectionDetail() {
  const { inspectionId } = useParams<{ inspectionId: string }>();
  const pk = Number(inspectionId);
  const { t, i18n } = useTranslation();
  const toast = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const cancelRef = useRef<HTMLButtonElement>(null);
  const {
    isOpen: delOpen,
    onOpen: onDelOpen,
    onClose: onDelClose
  } = useDisclosure();
  const pageBg = useColorModeValue("gray.50", "gray.900");
  const cardBg = useColorModeValue("white", "gray.800");
  const border = useColorModeValue("gray.200", "gray.600");
  const muted = useColorModeValue("gray.600", "gray.400");
  const videoBg = useColorModeValue("gray.100", "gray.700");
  const lang = (i18n.language || "en").split("-")[0];

  const [isEditing, setIsEditing] = useState(false);
  const [lightboxPhoto, setLightboxPhoto] = useState<string | null>(null);
  const [selectedVideoUrl, setSelectedVideoUrl] = useState<string | null>(null);

  const [inspectedQty, setInspectedQty] = useState("");
  const [defectQty, setDefectQty] = useState("");
  const [defectCategoryId, setDefectCategoryId] = useState("");
  const [description, setDescription] = useState("");
  const [editPhotoIds, setEditPhotoIds] = useState<string[]>([]);
  const [editVideoEntries, setEditVideoEntries] = useState<
    { uid: string; thumbnail?: string }[]
  >([]);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [pendingPreviews, setPendingPreviews] = useState<string[]>([]);
  const [pendingVideoFile, setPendingVideoFile] = useState<File | null>(null);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [isUploadingVideo, setIsUploadingVideo] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const [inspectedAt, setInspectedAt] = useState("");

  const { data, isLoading, isError } = useQuery({
    queryKey: ["vlInspection", pk],
    queryFn: () => getVlAssemblyInspection(pk),
    enabled: Number.isFinite(pk) && pk >= 1
  });

  const { data: categories } = useQuery({
    queryKey: ["defectCategories", "active"],
    queryFn: () => getDefectCategories()
  });

  const sortedCategories = useMemo(() => {
    return [...(categories ?? [])].sort(
      (a, b) => a.sort_order - b.sort_order || a.code.localeCompare(b.code)
    );
  }, [categories]);

  const applyDataToForm = useCallback(() => {
    if (!data) return;
    setInspectedQty(String(data.inspected_qty));
    setDefectQty(String(data.defect_qty));
    setDefectCategoryId(
      data.defect_category != null ? String(data.defect_category.id) : ""
    );
    setDescription(data.description ?? "");
    setEditPhotoIds([...(data.photo_image_ids ?? [])]);
    setEditVideoEntries((data.video_stream_uids ?? []).map((uid) => ({ uid })));
    setInspectedAt(localDateTime(data.inspected_at));
  }, [data]);

  const clearPendingPhotosOnly = useCallback(() => {
    setPendingPreviews((prev) => {
      prev.forEach((url) => URL.revokeObjectURL(url));
      return [];
    });
    setPendingFiles([]);
  }, []);

  const clearAllPendingUploads = useCallback(() => {
    setPendingPreviews((prev) => {
      prev.forEach((url) => URL.revokeObjectURL(url));
      return [];
    });
    setPendingFiles([]);
    setPendingVideoFile(null);
  }, []);

  useEffect(() => {
    applyDataToForm();
  }, [applyDataToForm]);

  const patchMut = useMutation({
    mutationFn: (payload: Partial<IEpInspectionWritePayload>) =>
      patchVlAssemblyInspection(pk, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vlInspection", pk] });
      queryClient.invalidateQueries({ queryKey: ["vlInspections"] });
      queryClient.invalidateQueries({ queryKey: ["vlSchedules"] });
      setIsEditing(false);
      toast({ title: t("epInspection.saved"), status: "success" });
    },
    onError: () =>
      toast({ title: t("epInspection.saveError"), status: "error" })
  });

  const delMut = useMutation({
    mutationFn: () => deleteVlAssemblyInspection(pk),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vlInspections"] });
      queryClient.invalidateQueries({ queryKey: ["vlSchedules"] });
      toast({ title: t("epInspection.deleted"), status: "success" });
      navigate("/vl-assembly-production/inspections");
    },
    onError: () =>
      toast({ title: t("epInspection.deleteError"), status: "error" })
  });

  const onSave = () => {
    const iq = Number(inspectedQty);
    const dq = Number(defectQty);
    if (!Number.isFinite(iq) || iq < 1) {
      toast({
        title: t("epInspection.invalidInspectedQty"),
        status: "warning"
      });
      return;
    }
    const payload: Partial<IEpInspectionWritePayload> = {
      inspected_qty: iq,
      defect_qty: Number.isFinite(dq) && dq >= 0 ? dq : 0,
      defect_category: defectCategoryId ? Number(defectCategoryId) : null,
      description,
      photo_image_ids: [...editPhotoIds],
      video_stream_uids: editVideoEntries.map((e) => e.uid),
      inspected_at: new Date(inspectedAt).toISOString()
    };
    patchMut.mutate(payload);
  };

  const startEdit = () => {
    clearAllPendingUploads();
    applyDataToForm();
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    clearAllPendingUploads();
    applyDataToForm();
    setIsEditing(false);
  };

  const handlePhotoSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setPendingFiles((prev) => [...prev, ...files]);
    setPendingPreviews((prev) => [
      ...prev,
      ...files.map((f) => URL.createObjectURL(f))
    ]);
    if (photoInputRef.current) photoInputRef.current.value = "";
  };

  const removePendingPhoto = (idx: number) => {
    setPendingFiles((prev) => prev.filter((_, i) => i !== idx));
    setPendingPreviews((prev) => {
      URL.revokeObjectURL(prev[idx]);
      return prev.filter((_, i) => i !== idx);
    });
  };

  const handleUploadPendingPhotos = async () => {
    if (!pendingFiles.length) return;
    setIsUploadingPhoto(true);
    try {
      const newIds: string[] = [];
      for (const file of pendingFiles) {
        const urlData = await getUploadURL();
        const dt = new DataTransfer();
        dt.items.add(file);
        const cfResult = (await uploadImage({
          file: dt.files,
          uploadURL: urlData.uploadURL
        })) as { result?: { id?: string } };
        const id = cfResult?.result?.id;
        if (id) newIds.push(id);
      }
      setEditPhotoIds((prev) => [...prev, ...newIds]);
      clearPendingPhotosOnly();
      toast({ title: t("epInspection.photosUploaded"), status: "success" });
    } catch {
      toast({ title: t("epInspection.uploadFailed"), status: "error" });
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const removeEditPhotoAt = (index: number) => {
    setEditPhotoIds((prev) => prev.filter((_, i) => i !== index));
  };

  const handleVideoSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 200 * 1024 * 1024) {
      toast({ title: t("epInspection.videoTooLarge"), status: "warning" });
      if (videoInputRef.current) videoInputRef.current.value = "";
      return;
    }
    setPendingVideoFile(file);
    if (videoInputRef.current) videoInputRef.current.value = "";
  };

  const handleUploadEditVideo = async () => {
    if (!pendingVideoFile) return;
    setIsUploadingVideo(true);
    try {
      const urlData = await getUploadVideoURL();
      const uid: string = urlData.id;
      const dt = new DataTransfer();
      dt.items.add(pendingVideoFile);
      await uploadVideo({ file: dt.files, uploadURL: urlData.uploadURL });
      const videoData: { uid?: string; thumbnail?: string } | null =
        (await getVideoData(uid)) ?? null;
      const finalUid = videoData?.uid ?? uid;
      setEditVideoEntries((prev) => [
        ...prev,
        { uid: finalUid, thumbnail: videoData?.thumbnail }
      ]);
      setPendingVideoFile(null);
      toast({ title: t("epInspection.videoUploaded"), status: "success" });
    } catch {
      toast({ title: t("epInspection.uploadFailed"), status: "error" });
    } finally {
      setIsUploadingVideo(false);
    }
  };

  const removeEditVideoAt = (index: number) => {
    setEditVideoEntries((prev) => prev.filter((_, i) => i !== index));
  };

  const mediaUploadPending =
    pendingPreviews.length > 0 || pendingVideoFile != null;

  const inspectedAtDisplay = data?.inspected_at
    ? new Date(data.inspected_at).toLocaleString(i18n.language, {
        dateStyle: "medium",
        timeStyle: "short"
      })
    : "—";

  if (!Number.isFinite(pk) || pk < 1) {
    return (
      <Center minH="60vh">
        <Text>{t("epInspection.invalidId")}</Text>
      </Center>
    );
  }

  return (
    <Box minH="100vh" bg={pageBg} py={8} px={{ base: 4, md: 10 }}>
      <Helmet>
        <title>
          {data
            ? `${t("epInspection.detailTitle")} #${pk}`
            : t("epInspection.detailTitle")}{" "}
          — SJ EP
        </title>
      </Helmet>
      <Box
        maxW={isEditing ? "4xl" : "960px"}
        mx="auto"
        transition="max-width 0.2s ease"
      >
        <HStack mb={6} justify="space-between" flexWrap="wrap" gap={2}>
          <Button
            as={RouterLink}
            to="/vl-assembly-production/inspections"
            variant="ghost"
            size="sm"
          >
            ← {t("epInspection.backToList")}
          </Button>
          <HStack flexWrap="wrap" justify="flex-end">
            {!isEditing && data && (
              <>
                <Button
                  colorScheme="blue"
                  variant="solid"
                  size="sm"
                  leftIcon={<FaEdit />}
                  onClick={startEdit}
                >
                  {t("epInspection.edit")}
                </Button>
                <Button
                  colorScheme="red"
                  variant="outline"
                  size="sm"
                  onClick={onDelOpen}
                >
                  {t("epInspection.delete")}
                </Button>
              </>
            )}
            {isEditing && (
              <>
                <Button variant="ghost" size="sm" onClick={handleCancelEdit}>
                  {t("epInspection.cancelEdit")}
                </Button>
                <Button
                  colorScheme="blue"
                  size="sm"
                  onClick={onSave}
                  isLoading={patchMut.isPending}
                  isDisabled={
                    patchMut.isPending ||
                    isUploadingPhoto ||
                    isUploadingVideo ||
                    mediaUploadPending
                  }
                >
                  {t("epInspection.save")}
                </Button>
              </>
            )}
          </HStack>
        </HStack>

        {isLoading ? (
          <Center py={20}>
            <Spinner />
          </Center>
        ) : isError || !data ? (
          <Center py={20}>
            <Text color="red.500">{t("epInspection.loadError")}</Text>
          </Center>
        ) : !isEditing ? (
          <Stack spacing={6}>
            <Box
              bg={cardBg}
              borderWidth="1px"
              borderColor={border}
              borderRadius="lg"
              p={{ base: 5, md: 8 }}
              shadow="sm"
            >
              <Heading size="md" mb={1}>
                #{data.id}
              </Heading>
              <Text fontSize="sm" color={muted} mb={6}>
                {targetKindLabel(data.target_kind, t)} · {data.target_label}
              </Text>

              <SimpleGrid columns={{ base: 1, sm: 2 }} spacing={4} mb={2}>
                <Box>
                  <Text
                    fontSize="xs"
                    fontWeight="semibold"
                    color={muted}
                    textTransform="uppercase"
                    letterSpacing="wider"
                  >
                    {t("epInspection.fieldInspectedQty")}
                  </Text>
                  <Text fontSize="lg" fontWeight="medium">
                    {data.inspected_qty}
                  </Text>
                </Box>
                <Box>
                  <Text
                    fontSize="xs"
                    fontWeight="semibold"
                    color={muted}
                    textTransform="uppercase"
                    letterSpacing="wider"
                  >
                    {t("epInspection.fieldDefectQty")}
                  </Text>
                  <Text fontSize="lg" fontWeight="medium">
                    {data.defect_qty}
                  </Text>
                </Box>
                <Box>
                  <Text
                    fontSize="xs"
                    fontWeight="semibold"
                    color={muted}
                    textTransform="uppercase"
                    letterSpacing="wider"
                  >
                    {t("epInspection.fieldDefectCategory")}
                  </Text>
                  <Text fontSize="lg" fontWeight="medium">
                    {defectCategoryLabel(data.defect_category, lang)}
                  </Text>
                </Box>
                <Box>
                  <Text
                    fontSize="xs"
                    fontWeight="semibold"
                    color={muted}
                    textTransform="uppercase"
                    letterSpacing="wider"
                  >
                    {t("epInspection.fieldInspectedAt")}
                  </Text>
                  <Text fontSize="lg" fontWeight="medium">
                    {inspectedAtDisplay}
                  </Text>
                </Box>
              </SimpleGrid>

              <SimpleGrid columns={{ base: 1, sm: 2 }} spacing={4} mt={4}>
                <Box>
                  <Text
                    fontSize="xs"
                    fontWeight="semibold"
                    color={muted}
                    textTransform="uppercase"
                    letterSpacing="wider"
                  >
                    {t("epInspection.fieldRegisteredBy")}
                  </Text>
                  <Text fontSize="md" fontWeight="medium">
                    {data.created_by_user?.display_name ?? "—"}
                  </Text>
                  {data.created_by_user?.username && (
                    <Text fontSize="xs" color={muted}>
                      @{data.created_by_user.username}
                    </Text>
                  )}
                </Box>
                <Box>
                  <Text
                    fontSize="xs"
                    fontWeight="semibold"
                    color={muted}
                    textTransform="uppercase"
                    letterSpacing="wider"
                  >
                    {t("epInspection.fieldInspectorWorker")}
                  </Text>
                  <Text fontSize="md" fontWeight="medium">
                    {data.inspector_worker
                      ? [
                          data.inspector_worker.name,
                          data.inspector_worker.nick_name
                        ]
                          .filter(Boolean)
                          .join(" · ")
                      : "—"}
                  </Text>
                </Box>
              </SimpleGrid>

              <Divider my={6} />

              <Box>
                <Text
                  fontSize="xs"
                  fontWeight="semibold"
                  color={muted}
                  textTransform="uppercase"
                  letterSpacing="wider"
                  mb={2}
                >
                  {t("epInspection.fieldDescription")}
                </Text>
                <Text whiteSpace="pre-wrap">
                  {data.description?.trim() ? data.description : "—"}
                </Text>
              </Box>
            </Box>

            {(data.photo_image_ids?.length ?? 0) > 0 && (
              <Box
                bg={cardBg}
                borderWidth="1px"
                borderColor={border}
                borderRadius="lg"
                p={{ base: 5, md: 8 }}
                shadow="sm"
              >
                <Heading size="sm" mb={4}>
                  {t("epInspection.fieldPhotos")}
                </Heading>
                <Grid
                  templateColumns="repeat(auto-fill, minmax(140px, 1fr))"
                  gap={4}
                >
                  {(data.photo_image_ids ?? []).map((pid) => (
                    <Box
                      key={pid}
                      position="relative"
                      borderRadius="md"
                      overflow="hidden"
                      borderWidth="1px"
                      borderColor={border}
                      cursor="pointer"
                      onClick={() => setLightboxPhoto(CF_IMAGE_PUBLIC(pid))}
                      _hover={{ opacity: 0.9 }}
                      transition="opacity 0.15s"
                    >
                      <Image
                        src={CF_IMAGE_PUBLIC(pid)}
                        alt=""
                        w="full"
                        h="130px"
                        objectFit="cover"
                      />
                    </Box>
                  ))}
                </Grid>
              </Box>
            )}

            {(data.video_stream_uids?.length ?? 0) > 0 && (
              <Box
                bg={cardBg}
                borderWidth="1px"
                borderColor={border}
                borderRadius="lg"
                p={{ base: 5, md: 8 }}
                shadow="sm"
              >
                <Heading size="sm" mb={4}>
                  {t("epInspection.fieldVideos")}
                </Heading>
                <Grid
                  templateColumns="repeat(auto-fill, minmax(200px, 1fr))"
                  gap={4}
                >
                  {(data.video_stream_uids ?? []).map((uid) => (
                    <StreamVideoThumb
                      key={uid}
                      uid={uid}
                      borderColor={border}
                      videoBg={videoBg}
                      onOpen={() => setSelectedVideoUrl(streamIframe(uid))}
                    />
                  ))}
                </Grid>
              </Box>
            )}

            {(data.photo_image_ids?.length ?? 0) === 0 &&
              (data.video_stream_uids?.length ?? 0) === 0 && (
                <Text fontSize="sm" color={muted} textAlign="center" py={2}>
                  {t("epInspection.noMedia")}
                </Text>
              )}

            <Box
              bg={cardBg}
              borderWidth="1px"
              borderColor={border}
              borderRadius="lg"
              p={{ base: 5, md: 8 }}
              shadow="sm"
            >
              <Text
                fontSize="xs"
                fontWeight="semibold"
                color={muted}
                textTransform="uppercase"
                letterSpacing="wider"
                mb={3}
              >
                {t("epInspection.fieldProcessOutputWorkers")}
              </Text>
              {(data.process_output_records?.length ?? 0) > 0 ? (
                <>
                  <TableContainer overflowX="auto">
                    <Table size="sm" variant="simple">
                      <Thead>
                        <Tr>
                          <Th whiteSpace="nowrap">
                            {t("epInspection.processOutputColRecordedAt")}
                          </Th>
                          <Th whiteSpace="nowrap">
                            {t("epInspection.processOutputColProcess")}
                          </Th>
                          <Th isNumeric whiteSpace="nowrap">
                            {t("epInspection.processOutputColQty")}
                          </Th>
                          <Th whiteSpace="nowrap">
                            {t("epInspection.processOutputColEnteredBy")}
                          </Th>
                          <Th>{t("epInspection.processOutputColRemark")}</Th>
                        </Tr>
                      </Thead>
                      <Tbody>
                        {data.process_output_records.map((row) => (
                          <Tr key={row.id}>
                            <Td whiteSpace="nowrap" verticalAlign="top">
                              {row.recorded_at
                                ? new Date(row.recorded_at).toLocaleString(
                                    i18n.language,
                                    {
                                      dateStyle: "medium",
                                      timeStyle: "short"
                                    }
                                  )
                                : "—"}
                            </Td>
                            <Td verticalAlign="top">
                              <Text fontWeight="medium">
                                {row.system === "vl"
                                  ? row.vl_assembly_process_code ?? "—"
                                  : row.ep_process_code ?? "—"}
                              </Text>
                              {(row.system === "vl"
                                ? row.vl_assembly_process_name
                                : row.ep_process_name) ? (
                                <Text fontSize="xs" color={muted}>
                                  {row.system === "vl"
                                    ? row.vl_assembly_process_name
                                    : row.ep_process_name}
                                </Text>
                              ) : null}
                            </Td>
                            <Td isNumeric verticalAlign="top">
                              {row.qty}
                            </Td>
                            <Td verticalAlign="top">
                              {row.recorded_by ? (
                                <>
                                  <Text fontSize="sm">
                                    {row.recorded_by.display_name}
                                  </Text>
                                  <Text fontSize="xs" color={muted}>
                                    @{row.recorded_by.username}
                                  </Text>
                                </>
                              ) : (
                                "—"
                              )}
                            </Td>
                            <Td verticalAlign="top" maxW="220px">
                              <Text
                                fontSize="sm"
                                whiteSpace="pre-wrap"
                                noOfLines={4}
                              >
                                {row.remark?.trim() ? row.remark : "—"}
                              </Text>
                            </Td>
                          </Tr>
                        ))}
                      </Tbody>
                    </Table>
                  </TableContainer>
                  {data.process_output_records_truncated ? (
                    <Text fontSize="xs" color={muted} mt={2}>
                      {t("epInspection.processOutputRecordsTruncated")}
                    </Text>
                  ) : null}
                </>
              ) : (
                <Text fontSize="sm">
                  {t("epInspection.processOutputWorkersEmpty")}
                </Text>
              )}
              <Text fontSize="xs" color={muted} mt={2}>
                {t("epInspection.processOutputWorkersHelp")}
              </Text>
            </Box>
          </Stack>
        ) : (
          <Stack spacing={6}>
            <Box
              bg={cardBg}
              borderWidth="1px"
              borderColor={border}
              borderRadius="xl"
              p={{ base: 5, md: 6 }}
              shadow="sm"
            >
              <Heading size="md" mb={2}>
                #{data.id}
              </Heading>
              <Text fontSize="sm" color="gray.500" mb={4}>
                {data.target_kind} · {data.target_label}
              </Text>

              <Stack spacing={4}>
                <FormControl>
                  <FormLabel>{t("epInspection.fieldInspectedQty")}</FormLabel>
                  <NumberInput
                    min={1}
                    value={inspectedQty}
                    onChange={(_, v) => setInspectedQty(String(v))}
                  >
                    <NumberInputField />
                  </NumberInput>
                </FormControl>
                <FormControl>
                  <FormLabel>{t("epInspection.fieldDefectQty")}</FormLabel>
                  <NumberInput
                    min={0}
                    value={defectQty}
                    onChange={(_, v) => setDefectQty(String(v))}
                  >
                    <NumberInputField />
                  </NumberInput>
                </FormControl>
                <FormControl>
                  <FormLabel>{t("epInspection.fieldDefectCategory")}</FormLabel>
                  <Select
                    placeholder={t("epInspection.selectCategory")}
                    value={defectCategoryId}
                    onChange={(e) => setDefectCategoryId(e.target.value)}
                  >
                    {sortedCategories.map((c) => (
                      <option key={c.id} value={c.id} disabled={!c.is_active}>
                        [{c.code}] {c.name_ko || c.name_en || c.name_vi}
                      </option>
                    ))}
                  </Select>
                </FormControl>
                <FormControl>
                  <FormLabel>{t("epInspection.fieldDescription")}</FormLabel>
                  <Textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                  />
                </FormControl>
                <FormControl>
                  <FormLabel>{t("epInspection.fieldInspectedAt")}</FormLabel>
                  <Input
                    type="datetime-local"
                    value={inspectedAt}
                    onChange={(e) => setInspectedAt(e.target.value)}
                  />
                </FormControl>
              </Stack>
            </Box>

            {/* Photos — SJ ProcessDetail 패턴 */}
            <Box
              bg={cardBg}
              borderRadius="xl"
              borderWidth="1px"
              borderColor={border}
              p={{ base: 5, md: 6 }}
              shadow="sm"
            >
              <HStack justify="space-between" mb={4} flexWrap="wrap" gap={2}>
                <Heading size="sm">{t("epInspection.fieldPhotos")}</Heading>
                <Button
                  size="sm"
                  leftIcon={<FaCamera />}
                  variant="outline"
                  onClick={() => photoInputRef.current?.click()}
                  isDisabled={isUploadingPhoto || isUploadingVideo}
                >
                  {t("epInspection.addPhotos")}
                </Button>
                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  hidden
                  onChange={handlePhotoSelect}
                />
              </HStack>
              <Divider mb={4} />

              {pendingPreviews.length > 0 && (
                <Box mb={5}>
                  <Text
                    fontSize="xs"
                    color={muted}
                    fontWeight="semibold"
                    mb={2}
                  >
                    {t("epInspection.pendingUploadLabel", {
                      count: pendingPreviews.length
                    })}
                  </Text>
                  <Grid
                    templateColumns="repeat(auto-fill, minmax(120px, 1fr))"
                    gap={3}
                    mb={3}
                  >
                    {pendingPreviews.map((src, idx) => (
                      <Box
                        key={idx}
                        position="relative"
                        borderRadius="md"
                        overflow="hidden"
                        borderWidth="2px"
                        borderStyle="dashed"
                        borderColor="blue.300"
                      >
                        <Image
                          src={src}
                          w="full"
                          h="100px"
                          objectFit="cover"
                          alt=""
                        />
                        <Button
                          size="xs"
                          colorScheme="red"
                          position="absolute"
                          top={1}
                          right={1}
                          onClick={() => removePendingPhoto(idx)}
                        >
                          <FaTrashAlt />
                        </Button>
                      </Box>
                    ))}
                  </Grid>
                  <Button
                    size="sm"
                    colorScheme="blue"
                    isLoading={isUploadingPhoto}
                    loadingText={t("epInspection.uploading")}
                    onClick={handleUploadPendingPhotos}
                  >
                    {t("epInspection.uploadPendingPhotos", {
                      count: pendingPreviews.length
                    })}
                  </Button>
                </Box>
              )}

              {editPhotoIds.length === 0 && pendingPreviews.length === 0 ? (
                <Text color="gray.400" textAlign="center" py={6}>
                  {t("epInspection.noPhotosRegistered")}
                </Text>
              ) : (
                <Grid
                  templateColumns="repeat(auto-fill, minmax(150px, 1fr))"
                  gap={4}
                >
                  {editPhotoIds.map((pid, idx) => (
                    <Box
                      key={`${pid}-${idx}`}
                      position="relative"
                      borderRadius="md"
                      overflow="hidden"
                      borderWidth="1px"
                      borderColor={border}
                    >
                      <Image
                        src={CF_IMAGE_PUBLIC(pid)}
                        alt=""
                        w="full"
                        h="130px"
                        objectFit="cover"
                        cursor="pointer"
                        onClick={() => setLightboxPhoto(CF_IMAGE_PUBLIC(pid))}
                      />
                      <Button
                        size="xs"
                        colorScheme="red"
                        position="absolute"
                        top={1}
                        right={1}
                        onClick={(e) => {
                          e.stopPropagation();
                          removeEditPhotoAt(idx);
                        }}
                      >
                        <FaTrashAlt />
                      </Button>
                    </Box>
                  ))}
                </Grid>
              )}
            </Box>

            {/* Videos — SJ ProcessDetail 패턴 */}
            <Box
              bg={cardBg}
              borderRadius="xl"
              borderWidth="1px"
              borderColor={border}
              p={{ base: 5, md: 6 }}
              shadow="sm"
            >
              <HStack
                justify="space-between"
                mb={4}
                flexWrap="wrap"
                gap={2}
                align="center"
              >
                <Heading size="sm">{t("epInspection.fieldVideos")}</Heading>
                <HStack flexWrap="wrap">
                  {pendingVideoFile && (
                    <Text
                      fontSize="xs"
                      color="blue.400"
                      maxW="160px"
                      noOfLines={1}
                    >
                      {pendingVideoFile.name}
                    </Text>
                  )}
                  <Button
                    size="sm"
                    leftIcon={<FaVideo />}
                    variant="outline"
                    onClick={() => videoInputRef.current?.click()}
                    isDisabled={isUploadingPhoto || isUploadingVideo}
                  >
                    {t("epInspection.selectVideo")}
                  </Button>
                  {pendingVideoFile && (
                    <Button
                      size="sm"
                      colorScheme="blue"
                      isLoading={isUploadingVideo}
                      loadingText={t("epInspection.uploading")}
                      onClick={handleUploadEditVideo}
                    >
                      {t("epInspection.confirmVideoUpload")}
                    </Button>
                  )}
                </HStack>
                <input
                  ref={videoInputRef}
                  type="file"
                  accept="video/*"
                  hidden
                  onChange={handleVideoSelect}
                />
              </HStack>
              <Divider mb={4} />

              {editVideoEntries.length === 0 ? (
                <Text color="gray.400" textAlign="center" py={6}>
                  {t("epInspection.noVideosRegistered")}
                </Text>
              ) : (
                <Grid
                  templateColumns="repeat(auto-fill, minmax(200px, 1fr))"
                  gap={4}
                >
                  {editVideoEntries.map((entry, idx) => (
                    <Box key={`${entry.uid}-${idx}`} position="relative">
                      <StreamVideoThumb
                        uid={entry.uid}
                        borderColor={border}
                        videoBg={videoBg}
                        thumbUrl={entry.thumbnail}
                        onOpen={() =>
                          setSelectedVideoUrl(streamIframe(entry.uid))
                        }
                      />
                      <IconButton
                        aria-label={t("epInspection.removeMedia")}
                        icon={<FaTrashAlt />}
                        size="xs"
                        colorScheme="red"
                        position="absolute"
                        top={1}
                        right={1}
                        zIndex={2}
                        onClick={(e) => {
                          e.stopPropagation();
                          removeEditVideoAt(idx);
                        }}
                      />
                    </Box>
                  ))}
                </Grid>
              )}
            </Box>
          </Stack>
        )}
      </Box>

      <Modal
        isOpen={!!selectedVideoUrl}
        onClose={() => setSelectedVideoUrl(null)}
        isCentered
        size="4xl"
      >
        <ModalOverlay bg="blackAlpha.800" />
        <ModalContent bg="black">
          <AspectRatio ratio={16 / 9}>
            <Box
              as="iframe"
              src={selectedVideoUrl ?? ""}
              allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;"
              allowFullScreen
              title="video"
            />
          </AspectRatio>
        </ModalContent>
      </Modal>

      <Modal
        isOpen={!!lightboxPhoto}
        onClose={() => setLightboxPhoto(null)}
        isCentered
        size="4xl"
      >
        <ModalOverlay bg="blackAlpha.800" />
        <ModalContent
          bg="transparent"
          shadow="none"
          onClick={() => setLightboxPhoto(null)}
        >
          <Image
            src={lightboxPhoto ?? ""}
            maxH="90vh"
            maxW="100%"
            objectFit="contain"
            borderRadius="lg"
            mx="auto"
            alt=""
          />
        </ModalContent>
      </Modal>

      <AlertDialog
        isOpen={delOpen}
        leastDestructiveRef={cancelRef}
        onClose={onDelClose}
      >
        <AlertDialogOverlay>
          <AlertDialogContent>
            <AlertDialogHeader>
              {t("epInspection.deleteConfirmTitle")}
            </AlertDialogHeader>
            <AlertDialogBody>
              {t("epInspection.deleteConfirmBody")}
            </AlertDialogBody>
            <AlertDialogFooter>
              <Button ref={cancelRef} onClick={onDelClose}>
                {t("epInspection.cancel")}
              </Button>
              <Button
                colorScheme="red"
                onClick={() => delMut.mutate()}
                ml={3}
                isLoading={delMut.isPending}
              >
                {t("epInspection.delete")}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>
    </Box>
  );
}
