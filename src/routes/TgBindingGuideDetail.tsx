import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  deleteTgBindingGuide,
  deleteTgBindingGuidePhoto,
  editTgBindingGuide,
  getTgBindingGuideDetail,
  getTgBindingGuidePhotos,
  getTgBindingGuideVideos,
  getTgStorageLocations,
  getSjStyles,
  getSjStylePhotos,
  getUploadURL,
  getUploadVideoURL,
  uploadImage,
  uploadVideo,
  getVideoData,
  createTgBindingGuidePhoto,
  createTgBindingGuideVideo,
  deleteTgBindingGuideVideo,
  tgBindingGuideLightOn,
  IFilePhotos,
  IFileVideos,
  ITgStorageLocation,
  ISjStyle,
  ISjStyleListResponse,
} from "../api";
import {
  useParams,
  Link as RouterLink,
  useNavigate
} from "react-router-dom";
import { Helmet } from "react-helmet";
import {
  Box,
  Heading,
  Text,
  Stack,
  Badge,
  useColorModeValue,
  HStack,
  Divider,
  Button,
  Spinner,
  Center,
  useToast,
  Input,
  Textarea,
  Select,
  AlertDialog,
  AlertDialogBody,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogContent,
  AlertDialogOverlay,
  Image,
  SimpleGrid,
  Skeleton,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalCloseButton,
  ModalHeader,
  ModalFooter,
  ModalBody,
  List,
  ListItem,
  Link,
} from "@chakra-ui/react";
import { useEffect, useRef, useState } from "react";
import { AiOutlineQrcode } from "react-icons/ai";
import { RiFlashlightFill } from "react-icons/ri";
import { useTranslation } from "react-i18next";
import QRCode from "qrcode";
import { FaArrowLeft } from "react-icons/fa";
import VideoModal from "../components/VideoModal";

interface IUploadURLResponse {
  id: string;
  uploadURL: string;
}

interface ITgBindingGuideLocation {
  id?: number;
  code?: string;
  zone?: string;
  shelf?: string;
  slot?: number | string;
  description?: string;
}

interface ITgBindingGuideDetail {
  id?: string;
  name?: string;
  serial_number?: string;
  description?: string;
  status?: string;
  status_display?: string;
  location?: number | null;
  location_detail?: ITgBindingGuideLocation | null;
  sj_style?: number | null;
  sj_style_detail?: { pk: number; code: string; style_name: string } | null;
  created_at?: string;
  updated_at?: string;
}

const STATUS_OPTIONS = [
  { value: "in_use", label: "In Use" },
  { value: "obsolete", label: "Obsolete" },
  { value: "removed", label: "Removed" },
  { value: "lost", label: "Lost" }
];

function SjStyleThumbnailRow({ stylePk, code, styleName }: { stylePk: number; code: string; styleName?: string | null }) {
  const { data: photos, isLoading } = useQuery<IFilePhotos[]>({
    queryKey: ["sjStylePhotos", stylePk],
    queryFn: () => getSjStylePhotos(stylePk),
    enabled: !!stylePk,
  });

  const thumbnail = photos?.filter((p) => p.description !== "QR Code")[0];

  return (
    <HStack spacing={3} align="center">
      {isLoading ? (
        <Skeleton boxSize="60px" borderRadius="md" />
      ) : thumbnail ? (
        <Link as={RouterLink} to={`/sjstyles/${stylePk}`}>
          <Image
            src={thumbnail.file}
            alt={code}
            boxSize="60px"
            objectFit="cover"
            borderRadius="md"
            _hover={{ opacity: 0.8, transform: "scale(1.05)", transition: "all 0.2s" }}
          />
        </Link>
      ) : null}
      <Link as={RouterLink} to={`/sjstyles/${stylePk}`} color="blue.500" fontWeight="semibold">
        {code}
        {styleName && (
          <Text as="span" fontWeight="normal" color="gray.500" ml={2} fontSize="sm">{styleName}</Text>
        )}
      </Link>
    </HStack>
  );
}

export default function TgBindingGuideDetail() {
  const { t } = useTranslation();
  const { tgBindingGuideId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();
  const cancelRef = useRef<HTMLButtonElement>(null);
  const qrCancelRef = useRef<HTMLButtonElement>(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isQRConfirmOpen, setIsQRConfirmOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState({
    name: "",
    description: "",
    status: "",
    location: "" as string,
    sj_style: null as number | null,
  });

  const [styleSearch, setStyleSearch] = useState("");
  const [selectedStyle, setSelectedStyle] = useState<ISjStyle | null>(null);
  const [showStyleSuggestions, setShowStyleSuggestions] = useState(false);
  const styleBlurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [selectedPhoto, setSelectedPhoto] = useState<IFilePhotos | null>(null);
  const [selectedVideo, setSelectedVideo] = useState<string | null>(null);
  const [lightTimer, setLightTimer] = useState(0);
  const [pendingVideoFile, setPendingVideoFile] = useState<FileList | null>(null);
  const [videoUid, setVideoUid] = useState<string>("");
  const [isUploadingVideo, setIsUploadingVideo] = useState(false);
  const videoInputRef = useRef<HTMLInputElement>(null);

  const [newFiles, setNewFiles] = useState<File[]>([]);
  const [newPreviews, setNewPreviews] = useState<string[]>([]);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const { data: photos = [], isLoading: photosLoading } = useQuery<IFilePhotos[]>({
    queryKey: ["tgBindingGuidePhotos", tgBindingGuideId],
    queryFn: () => getTgBindingGuidePhotos(tgBindingGuideId!),
    enabled: !!tgBindingGuideId
  });

  const { data: videos = [], isLoading: videosLoading } = useQuery<IFileVideos[]>({
    queryKey: ["tgBindingGuideVideos", tgBindingGuideId],
    queryFn: () => getTgBindingGuideVideos(tgBindingGuideId!),
    enabled: !!tgBindingGuideId
  });

  const { data: locations = [] } = useQuery<ITgStorageLocation[]>({
    queryKey: ["tg-storage-locations"],
    queryFn: getTgStorageLocations
  });

  const { data: styleSearchData } = useQuery<ISjStyleListResponse>({
    queryKey: ["sjStyleSearch", styleSearch],
    queryFn: () => getSjStyles({ search: styleSearch, page: 1 }),
    enabled: styleSearch.length > 0 && !selectedStyle,
  });
  const styleSuggestions: ISjStyle[] = styleSearchData?.results ?? [];

  const {
    data: item,
    isLoading,
    error
  } = useQuery<ITgBindingGuideDetail>({
    queryKey: ["tgBindingGuideDetail", tgBindingGuideId],
    queryFn: () => {
      if (typeof tgBindingGuideId === "string") return getTgBindingGuideDetail(tgBindingGuideId);
      throw new Error("tgBindingGuideId is not a string");
    }
  });

  const cardBg = useColorModeValue("white", "gray.800");
  const pageBg = useColorModeValue("gray.50", "gray.900");
  const labelColor = useColorModeValue("gray.500", "gray.400");
  const suggestionBg = useColorModeValue("white", "gray.700");
  const suggestionHoverBg = useColorModeValue("blue.50", "gray.600");
  const suggestionBorderColor = useColorModeValue("gray.200", "gray.600");

  const lightOnMutation = useMutation({
    mutationFn: tgBindingGuideLightOn,
    onSuccess: () => {
      setLightTimer(30);
      toast({
        title: "Light ON",
        description: "Light is On",
        status: "success",
        duration: 2000,
        isClosable: true,
        position: "bottom-right"
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: t("tgBindingGuideList.lightError"),
        status: "error",
        duration: 2000,
        isClosable: true,
        position: "bottom-right"
      });
    }
  });

  useEffect(() => {
    if (lightTimer <= 0) return;
    const id = window.setInterval(() => {
      setLightTimer((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => window.clearInterval(id);
  }, [lightTimer]);

  const formatDate = (value?: string) => {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "2-digit" });
  };

  useEffect(() => {
    if (item) {
      setForm({
        name: item.name ?? "",
        description: item.description ?? "",
        status: item.status ?? "",
        location: item.location != null ? String(item.location) : "",
        sj_style: item.sj_style ?? null,
      });
      if (item.sj_style_detail) {
        setSelectedStyle({ pk: item.sj_style_detail.pk, code: item.sj_style_detail.code, style_name: item.sj_style_detail.style_name } as ISjStyle);
        setStyleSearch(item.sj_style_detail.code);
      } else {
        setSelectedStyle(null);
        setStyleSearch("");
      }
    }
  }, [item]);

  const editMutation = useMutation({
    mutationFn: editTgBindingGuide,
    onSuccess: () => {
      toast({
        title: t("tgBindingGuideDetail.updated"),
        status: "success",
        duration: 2000,
        isClosable: true,
        position: "bottom-right"
      });
      if (tgBindingGuideId)
        queryClient.invalidateQueries({ queryKey: ["tgBindingGuideDetail", tgBindingGuideId] });
      setIsEditing(false);
    },
    onError: () => {
      toast({
        title: t("tgBindingGuideDetail.updateFailed"),
        status: "error",
        duration: 2000,
        isClosable: true,
        position: "bottom-right"
      });
    }
  });

  const onSave = () => {
    if (!item?.id) return;
    editMutation.mutate({
      id: item.id,
      name: form.name,
      description: form.description,
      status: form.status,
      location: form.location ? Number(form.location) : null,
      sj_style: selectedStyle ? selectedStyle.pk : null,
    });
  };

  const deleteMutation = useMutation({
    mutationFn: deleteTgBindingGuide,
    onSuccess: () => {
      toast({
        title: t("tgBindingGuideDetail.deleted"),
        status: "success",
        duration: 2000,
        isClosable: true,
        position: "bottom-right"
      });
      queryClient.invalidateQueries({ queryKey: ["tgBindingGuides"] });
      navigate("/tg-binding-guides");
    },
    onError: () => {
      toast({
        title: t("tgBindingGuideDetail.deleteFailed"),
        status: "error",
        duration: 2000,
        isClosable: true,
        position: "bottom-right"
      });
    }
  });

  const deletePhotoMutation = useMutation({
    mutationFn: ({ photoPk }: { photoPk: string }) =>
      deleteTgBindingGuidePhoto({ tgBindingGuideId: tgBindingGuideId!, photoPk }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tgBindingGuidePhotos", tgBindingGuideId] });
      queryClient.invalidateQueries({ queryKey: ["tgBindingGuidePhotos"] });
      toast({
        title: t("tgBindingGuideDetail.photoDeleted"),
        status: "success",
        duration: 2000,
        isClosable: true,
        position: "bottom-right"
      });
    },
    onError: () => {
      toast({
        title: t("tgBindingGuideDetail.photoDeleteFailed"),
        status: "error",
        duration: 2000,
        isClosable: true,
        position: "bottom-right"
      });
    }
  });

  const deleteVideoMutation = useMutation({
    mutationFn: ({ videoPk }: { videoPk: string }) =>
      deleteTgBindingGuideVideo({ tgBindingGuideId: tgBindingGuideId!, videoPk }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tgBindingGuideVideos", tgBindingGuideId] });
      toast({ title: "Video deleted", status: "success", duration: 2000, isClosable: true, position: "bottom-right" });
    },
    onError: () => {
      toast({ title: "Video delete failed", status: "error", duration: 2000, isClosable: true, position: "bottom-right" });
    }
  });

  const createTgBindingGuideVideoMutation = useMutation({
    mutationFn: createTgBindingGuideVideo,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tgBindingGuideVideos", tgBindingGuideId] });
      setIsUploadingVideo(false);
      setPendingVideoFile(null);
      if (videoInputRef.current) videoInputRef.current.value = "";
      toast({ title: "Video uploaded", status: "success", duration: 2000, isClosable: true, position: "bottom-right" });
    },
    onError: () => {
      setIsUploadingVideo(false);
      toast({ title: "Video upload failed", status: "error", duration: 2000, isClosable: true, position: "bottom-right" });
    }
  });

  const getVideoDataMutation = useMutation({
    mutationFn: getVideoData,
    onSuccess: (data: any) => {
      const thumbnailURL = data.thumbnail;
      const videoURL = `https://customer-kc2gx0yn68qxte35.cloudflarestream.com/${data.uid}/iframe`;
      createTgBindingGuideVideoMutation.mutate({ VideoFile: videoURL, ThumbnailFile: thumbnailURL, tgBindingGuideId: tgBindingGuideId! });
    }
  });

  const uploadVideoMutation = useMutation({
    mutationFn: uploadVideo,
    onSuccess: () => { getVideoDataMutation.mutate(videoUid); }
  });

  const uploadVideoURLMutation = useMutation({
    mutationFn: getUploadVideoURL,
    onSuccess: (data: any) => {
      setVideoUid(data.id);
      uploadVideoMutation.mutate({ file: pendingVideoFile!, uploadURL: data.uploadURL });
    }
  });

  const handleVideoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setPendingVideoFile(files);
  };

  const handleUploadVideo = () => {
    if (!pendingVideoFile) return;
    setIsUploadingVideo(true);
    uploadVideoURLMutation.mutate();
  };

  const [isPrintLabelOpen, setIsPrintLabelOpen] = useState(false);

  const handlePrintLabel = () => {
    const qrPhoto = photos.find((p) => p.description === "QR Code");
    if (!qrPhoto) return;
    const printWindow = window.open("", "_blank", "width=200,height=200");
    if (!printWindow) return;
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${item?.name ?? "TG Binding Guide Label"}</title>
          <style>
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body { background: white; }
            .label { width: 1cm; height: 1cm; overflow: hidden; }
            .label img { width: 1cm; height: 1cm; display: block; }
            @media print {
              @page { size: 1cm 1cm; margin: 0; }
              body { width: 1cm; height: 1cm; }
            }
          </style>
        </head>
        <body>
          <div class="label">
            <img src="${qrPhoto.file}" alt="QR" />
          </div>
          <script>
            window.onload = function() { window.print(); window.onafterprint = function() { window.close(); }; };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const [isGeneratingQR, setIsGeneratingQR] = useState(false);

  const handleQRButtonClick = () => {
    const hasQR = photos.some((p) => p.description === "QR Code");
    if (hasQR) {
      setIsQRConfirmOpen(true);
    } else {
      handleGenerateQR();
    }
  };

  const handleGenerateQR = async () => {
    if (!tgBindingGuideId) return;
    setIsGeneratingQR(true);
    try {
      const existingQRPhotos = photos.filter((p) => p.description === "QR Code");
      for (const qrPhoto of existingQRPhotos) {
        await deleteTgBindingGuidePhoto({ tgBindingGuideId, photoPk: qrPhoto.pk });
      }
      // 공개 페이지 URL로 QR 코드 생성 (로그인 없이 스캔 가능)
      const publicUrl = `${window.location.origin}/public/tg-binding-guides/${tgBindingGuideId}`;
      const dataUrl: string = await QRCode.toDataURL(publicUrl, { width: 400, margin: 2 });
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      const qrFile = new File([blob], `tg-binding-guide-qr-${tgBindingGuideId}.png`, { type: "image/png" });
      const urlData: IUploadURLResponse = await getUploadURL();
      const dt = new DataTransfer();
      dt.items.add(qrFile);
      const cfResult: any = await uploadImage({ file: dt.files, uploadURL: urlData.uploadURL });
      const cfUrl = `https://imagedelivery.net/mzmXhxWLR9jzdX8u9g4BBQ/${cfResult.result.id}/public`;
      await createTgBindingGuidePhoto({ file: cfUrl, tgBindingGuideId, description: "QR Code" });
      queryClient.invalidateQueries({ queryKey: ["tgBindingGuidePhotos", tgBindingGuideId] });
      queryClient.invalidateQueries({ queryKey: ["tgBindingGuidePhotos"] });
      toast({ title: "QR Code generated", status: "success", duration: 2000, isClosable: true, position: "bottom-right" });
    } catch (e) {
      toast({ title: "QR Code generation failed", status: "error", duration: 3000, isClosable: true, position: "bottom-right" });
    } finally {
      setIsGeneratingQR(false);
    }
  };

  const handlePhotoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setNewFiles((prev) => [...prev, ...files]);
    setNewPreviews((prev) => [...prev, ...files.map((f) => URL.createObjectURL(f))]);
    if (photoInputRef.current) photoInputRef.current.value = "";
  };

  const removeNewFile = (index: number) => {
    setNewFiles((prev) => prev.filter((_, i) => i !== index));
    setNewPreviews((prev) => {
      URL.revokeObjectURL(prev[index]);
      return prev.filter((_, i) => i !== index);
    });
  };

  const uploadOnePhoto = async (file: File) => {
    const urlData: IUploadURLResponse = await getUploadURL();
    const dt = new DataTransfer();
    dt.items.add(file);
    const cfResult: any = await uploadImage({ file: dt.files, uploadURL: urlData.uploadURL });
    const cfUrl = `https://imagedelivery.net/mzmXhxWLR9jzdX8u9g4BBQ/${cfResult.result.id}/public`;
    await createTgBindingGuidePhoto({ file: cfUrl, tgBindingGuideId: tgBindingGuideId!, description: item?.name ?? "" });
  };

  const handleUploadNewPhotos = async () => {
    if (!newFiles.length) return;
    setIsUploadingPhoto(true);
    try {
      for (const file of newFiles) {
        await uploadOnePhoto(file);
      }
      queryClient.invalidateQueries({ queryKey: ["tgBindingGuidePhotos", tgBindingGuideId] });
      queryClient.invalidateQueries({ queryKey: ["tgBindingGuidePhotos"] });
      setNewFiles([]);
      setNewPreviews([]);
      toast({ title: t("tgBindingGuideDetail.photosUploaded"), status: "success", duration: 2000, isClosable: true, position: "bottom-right" });
    } catch {
      toast({ title: t("tgBindingGuideDetail.photosUploadFailed"), status: "warning", duration: 3000, isClosable: true, position: "bottom-right" });
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  if (isLoading) {
    return (
      <>
        <Helmet><title>Loading... TG TG Binding Guide Detail</title></Helmet>
        <Center minH="60vh"><Spinner size="lg" /></Center>
      </>
    );
  }

  if (error || !item) {
    return (
      <>
        <Helmet><title>TG Binding Guide Not Found</title></Helmet>
        <Center minH="60vh">
          <Box textAlign="center">
            <Heading size="md" mb={2}>{t("tgBindingGuideDetail.notFound")}</Heading>
            <Text color="gray.500" mb={4}>{t("tgBindingGuideDetail.notFoundDesc")}</Text>
            <HStack display={"flex"} alignItems={"center"} gap={2}>
              <Button leftIcon={<FaArrowLeft />} variant="ghost" size="sm" onClick={() => navigate("/tg-binding-guides")}>
                {t("tgBindingGuideDetail.backToListBtn")}
              </Button>
            </HStack>
          </Box>
        </Center>
      </>
    );
  }

  const locationDetail = item.location_detail;

  return (
    <>
      <Helmet>
        <title>{item.name ?? "TG Binding Guide Detail"}</title>
      </Helmet>
      <Box bg={pageBg} flex="1" minH="calc(100vh - 120px)" py={{ base: 6, md: 10 }}>
        <Box maxW={{ base: "3xl", lg: "5xl" }} mx="auto" px={{ base: 4, md: 8 }}>
          <HStack justify="space-between" align="flex-start" mb={4}>
            <Button as={RouterLink} to="/tg-binding-guides" variant="ghost" size="sm" leftIcon={<FaArrowLeft />}>
              {t("tgBindingGuideDetail.backToList")}
            </Button>
            <Button
              size="sm"
              colorScheme="teal"
              variant="outline"
              isLoading={isGeneratingQR}
              loadingText="QR..."
              onClick={handleQRButtonClick}
              leftIcon={<AiOutlineQrcode />}
            >
              QR Code
            </Button>
          </HStack>

          <AlertDialog isOpen={isDeleteOpen} leastDestructiveRef={cancelRef} onClose={() => setIsDeleteOpen(false)}>
            <AlertDialogOverlay>
              <AlertDialogContent>
                <AlertDialogHeader fontSize="lg" fontWeight="bold">{t("tgBindingGuideDetail.deleteTitle")}</AlertDialogHeader>
                <AlertDialogBody>{t("tgBindingGuideDetail.deleteConfirm")}</AlertDialogBody>
                <AlertDialogFooter>
                  <Button ref={cancelRef} onClick={() => setIsDeleteOpen(false)}>{t("tgBindingGuideDetail.cancel")}</Button>
                  <Button colorScheme="red" ml={3} isLoading={deleteMutation.status === "pending"} onClick={() => { deleteMutation.mutate(tgBindingGuideId!); setIsDeleteOpen(false); }}>
                    {t("tgBindingGuideDetail.delete")}
                  </Button>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialogOverlay>
          </AlertDialog>

          <AlertDialog isOpen={isQRConfirmOpen} leastDestructiveRef={qrCancelRef} onClose={() => setIsQRConfirmOpen(false)} isCentered>
            <AlertDialogOverlay>
              <AlertDialogContent>
                <AlertDialogHeader fontSize="lg" fontWeight="bold">{t("tgBindingGuideDetail.qrExistsTitle")}</AlertDialogHeader>
                <AlertDialogBody>{t("tgBindingGuideDetail.qrExistsConfirm")}</AlertDialogBody>
                <AlertDialogFooter>
                  <Button ref={qrCancelRef} onClick={() => setIsQRConfirmOpen(false)}>{t("tgBindingGuideDetail.cancel")}</Button>
                  <Button colorScheme="teal" ml={3} onClick={() => { setIsQRConfirmOpen(false); handleGenerateQR(); }}>
                    {t("tgBindingGuideDetail.qrExistsConfirmBtn")}
                  </Button>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialogOverlay>
          </AlertDialog>

          <Box bg={cardBg} borderRadius="xl" boxShadow="lg" p={{ base: 5, md: 8 }}>
            <Box mb={4} position="relative">
              {(() => {
                const qrPhoto = photos.find((p) => p.description === "QR Code");
                if (!qrPhoto) return null;
                return (
                  <Box position="absolute" top={0} right={0} w={{ base: "50px", md: "100px" }} h={{ base: "50px", md: "100px" }} rounded="md" overflow="hidden" border="1px solid" borderColor="teal.300" cursor="pointer" onClick={() => setIsPrintLabelOpen(true)} _hover={{ opacity: 0.8, transform: "scale(1.05)", transition: "all 0.2s" }}>
                    <Image src={qrPhoto.file} alt="QR Code" w="100%" h="100%" objectFit="contain" />
                  </Box>
                );
              })()}
              <Heading size="lg" mb={2}>{item.name ?? "TG Binding Guide Detail"}</Heading>
              <HStack spacing={3} flexWrap="wrap">
                {item.status_display && <Badge colorScheme="blue">{item.status_display}</Badge>}
                {locationDetail?.code && <Badge colorScheme="green">위치: {locationDetail.code}</Badge>}
                {item.sj_style_detail && (
                  <Link as={RouterLink} to={`/sjstyles/${item.sj_style_detail.pk}`}>
                    <Badge colorScheme="teal" cursor="pointer" _hover={{ opacity: 0.8 }}>{item.sj_style_detail.code}</Badge>
                  </Link>
                )}
              </HStack>
            </Box>

            {/* 사진 영역 */}
            <Box mb={4}>
              {photosLoading ? (
                <SimpleGrid columns={2} spacing={2}>
                  {[0, 1].map((i) => <Skeleton key={i} w="100px" h="100px" rounded="md" />)}
                </SimpleGrid>
              ) : (
                <Box>
                  <SimpleGrid columns={{ base: 3, md: 5 }} spacing={2}>
                    {photos.filter((p) => p.description !== "QR Code").map((photo) => (
                      <Box key={photo.pk} position="relative">
                        <Box rounded="md" overflow="hidden" border="1px solid" borderColor="gray.200" w="120px" h="120px" cursor={isEditing ? "default" : "pointer"} onClick={() => !isEditing && setSelectedPhoto(photo)} _hover={!isEditing ? { opacity: 0.8, transform: "scale(1.03)", transition: "all 0.2s" } : {}}>
                          <Image src={photo.file} alt={photo.description ?? "tg binding guide photo"} w="100%" h="100%" objectFit="cover" />
                        </Box>
                        {isEditing && (
                          <Button size="xs" position="absolute" top="-1" right="-1" borderRadius="full" colorScheme="red" minW="18px" h="18px" p={0} fontSize="10px" isLoading={deletePhotoMutation.isPending} onClick={() => deletePhotoMutation.mutate({ photoPk: photo.pk })}>✕</Button>
                        )}
                      </Box>
                    ))}
                    {isEditing && newPreviews.map((src, i) => (
                      <Box key={`new-${i}`} position="relative">
                        <Box rounded="md" overflow="hidden" border="2px dashed" borderColor="blue.300" w="100px" h="100px">
                          <Image src={src} alt={`new-${i}`} w="100%" h="100%" objectFit="cover" />
                        </Box>
                        <Button size="xs" position="absolute" top="-1" right="-1" borderRadius="full" colorScheme="gray" minW="18px" h="18px" p={0} fontSize="10px" onClick={() => removeNewFile(i)}>✕</Button>
                      </Box>
                    ))}
                  </SimpleGrid>

                  {photos.filter((p) => p.description !== "QR Code").length === 0 && newPreviews.length === 0 && !isEditing && (
                    <Box w="100px" h="100px" rounded="md" border="1px dashed" borderColor="gray.300" display="flex" alignItems="center" justifyContent="center">
                      <Text fontSize="xs" color="gray.400" textAlign="center">{t("tgBindingGuideDetail.noPhotos")}</Text>
                    </Box>
                  )}

                  {isEditing && (
                    <HStack mt={2} spacing={2}>
                      <Input ref={photoInputRef} type="file" accept="image/*" multiple size="xs" onChange={handlePhotoFileChange} maxW="180px" />
                      {newFiles.length > 0 && (
                        <Button size="xs" colorScheme="blue" isLoading={isUploadingPhoto} loadingText="Uploading..." onClick={handleUploadNewPhotos}>
                          {t("tgBindingGuideDetail.uploadPhotos")} ({newFiles.length})
                        </Button>
                      )}
                    </HStack>
                  )}
                </Box>
              )}
            </Box>

            {/* 비디오 영역 */}
            <Box mb={4}>
              {videosLoading ? (
                <SimpleGrid columns={2} spacing={2}>
                  {[0, 1].map((i) => <Skeleton key={i} w="120px" h="80px" rounded="md" />)}
                </SimpleGrid>
              ) : (
                <Box>
                  <SimpleGrid columns={{ base: 2, md: 4 }} spacing={2}>
                    {videos.map((video) => (
                      <Box key={video.pk} position="relative">
                        <Box rounded="md" overflow="hidden" border="1px solid" borderColor="gray.200" w="120px" h="80px" cursor="pointer" position="relative" onClick={() => !isEditing && setSelectedVideo(video.VideoFile)} _hover={!isEditing ? { opacity: 0.8, transform: "scale(1.03)", transition: "all 0.2s" } : {}}>
                          {video.ThumbnailFile ? (
                            <Image src={video.ThumbnailFile} alt={video.description ?? "TG binding guide video"} w="100%" h="100%" objectFit="cover" />
                          ) : (
                            <Box w="100%" h="100%" bg="gray.200" display="flex" alignItems="center" justifyContent="center">
                              <Text fontSize="xs" color="gray.500">Video</Text>
                            </Box>
                          )}
                          <Box position="absolute" inset={0} display="flex" alignItems="center" justifyContent="center" bg="blackAlpha.300">
                            <Text fontSize="2xl" color="white">▶</Text>
                          </Box>
                        </Box>
                        {isEditing && (
                          <Button size="xs" position="absolute" top="-1" right="-1" borderRadius="full" colorScheme="red" minW="18px" h="18px" p={0} fontSize="10px" isLoading={deleteVideoMutation.isPending} onClick={() => deleteVideoMutation.mutate({ videoPk: video.pk })}>✕</Button>
                        )}
                      </Box>
                    ))}
                  </SimpleGrid>

                  {videos.length === 0 && !isEditing && (
                    <Box w="120px" h="80px" rounded="md" border="1px dashed" borderColor="gray.300" display="flex" alignItems="center" justifyContent="center">
                      <Text fontSize="xs" color="gray.400" textAlign="center">No videos</Text>
                    </Box>
                  )}

                  {isEditing && (
                    <HStack mt={2} spacing={2}>
                      <Input ref={videoInputRef} type="file" accept="video/*" size="xs" onChange={handleVideoFileChange} maxW="180px" />
                      {pendingVideoFile && (
                        <Button size="xs" colorScheme="teal" isLoading={isUploadingVideo || uploadVideoURLMutation.isPending || uploadVideoMutation.isPending || getVideoDataMutation.isPending || createTgBindingGuideVideoMutation.isPending} loadingText="Uploading..." onClick={handleUploadVideo}>
                          Upload Video
                        </Button>
                      )}
                    </HStack>
                  )}
                </Box>
              )}
            </Box>

            <Divider my={4} />

            <Stack spacing={4}>
              <Box>
                <Text fontSize="sm" color={labelColor} mb={1}>{t("tgBindingGuideDetail.name")}</Text>
                {isEditing ? (
                  <Input size="sm" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
                ) : (
                  <Text>{item.name ?? "-"}</Text>
                )}
              </Box>

              <Box>
                <Text fontSize="sm" color={labelColor} mb={1}>{t("tgBindingGuideDetail.serialNumber")}</Text>
                <Text>{item.serial_number ?? "-"}</Text>
              </Box>

              <Box>
                <Text fontSize="sm" color={labelColor} mb={1}>{t("tgBindingGuideDetail.status")}</Text>
                {isEditing ? (
                  <Select size="sm" value={form.status} onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}>
                    <option value="">{t("tgBindingGuideDetail.selectStatus")}</option>
                    {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </Select>
                ) : (
                  <Text>{item.status_display ?? STATUS_OPTIONS.find((o) => o.value === item.status)?.label ?? "-"}</Text>
                )}
              </Box>

              <Box>
                <Text fontSize="sm" color={labelColor} mb={1}>{t("tgBindingGuideDetail.description")}</Text>
                {isEditing ? (
                  <Textarea size="sm" value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} />
                ) : (
                  <Text whiteSpace="pre-wrap">{item.description || "-"}</Text>
                )}
              </Box>

              <Box>
                <Text fontSize="sm" color={labelColor} mb={1}>{t("tgBindingGuideDetail.location")}</Text>
                {isEditing ? (
                  <>
                    <Select size="sm" value={form.location} onChange={(e) => setForm((p) => ({ ...p, location: e.target.value }))}>
                      <option value="">{t("tgBindingGuideDetail.noLocation")}</option>
                      {locations.map((loc) => (
                        <option key={loc.id} value={loc.id}>
                          {loc.code}{loc.description ? ` — ${loc.description}` : ""}
                        </option>
                      ))}
                    </Select>
                    <Text fontSize="xs" color="gray.500" mt={1}>
                      {t("tgBindingGuideCreate.locationTgOnlyHint")}{" "}
                      <Link as={RouterLink} to="/tg-binding-guides/locations" color="blue.500" textDecoration="underline">
                        {t("tgBindingGuideCreate.manageTgLocations")}
                      </Link>
                    </Text>
                  </>
                ) : locationDetail ? (
                  <HStack spacing={2} align="center">
                    <Text>
                      {locationDetail.code ?? "-"} ({t("tgBindingGuideDetail.locationZone")}{" "}
                      {locationDetail.zone ?? "-"} · {t("tgBindingGuideDetail.locationShelf")} {locationDetail.shelf ?? "-"}{" "}
                      · {t("tgBindingGuideDetail.locationSlot")} {locationDetail.slot ?? "-"})
                    </Text>
                    <Button size="xs" leftIcon={<RiFlashlightFill />} colorScheme="yellow" variant="outline" isDisabled={lightTimer > 0} isLoading={lightOnMutation.isPending} onClick={() => tgBindingGuideId && lightOnMutation.mutate(tgBindingGuideId)}>
                      {lightTimer > 0 ? `${lightTimer}s` : t("tgBindingGuideList.lightOn")}
                    </Button>
                  </HStack>
                ) : (
                  <Text>{item.location ?? "-"}</Text>
                )}
              </Box>

              <Box>
                <Text fontSize="sm" color={labelColor} mb={1}>SJ Style</Text>
                {isEditing ? (
                  <Box position="relative">
                    <Input size="sm" placeholder="Style Code 검색... (optional)" value={styleSearch}
                      onChange={(e) => { setStyleSearch(e.target.value); setSelectedStyle(null); setShowStyleSuggestions(true); }}
                      onFocus={() => { if (styleSearch && !selectedStyle) setShowStyleSuggestions(true); }}
                      onBlur={() => { styleBlurTimer.current = setTimeout(() => setShowStyleSuggestions(false), 150); }}
                    />
                    {showStyleSuggestions && styleSuggestions.length > 0 && (
                      <List position="absolute" zIndex={10} w="full" bg={suggestionBg} border="1px solid" borderColor={suggestionBorderColor} borderRadius="md" boxShadow="md" maxH="180px" overflowY="auto" mt={1}>
                        {styleSuggestions.map((s) => (
                          <ListItem key={s.pk} px={3} py={2} cursor="pointer" _hover={{ bg: suggestionHoverBg }}
                            onMouseDown={() => { if (styleBlurTimer.current) clearTimeout(styleBlurTimer.current); setSelectedStyle(s); setStyleSearch(s.code); setShowStyleSuggestions(false); }}>
                            <Text fontSize="sm" fontWeight="semibold">{s.code}</Text>
                            {s.style_name && <Text fontSize="xs" color="gray.500">{s.style_name}</Text>}
                          </ListItem>
                        ))}
                      </List>
                    )}
                    {selectedStyle && <Text fontSize="xs" color="blue.500" mt={1}>선택됨: {selectedStyle.code} — {selectedStyle.style_name}</Text>}
                    {styleSearch && !selectedStyle && <Text fontSize="xs" color="gray.400" mt={1}>목록에서 선택해 주세요.</Text>}
                  </Box>
                ) : item.sj_style_detail ? (
                  <SjStyleThumbnailRow stylePk={item.sj_style_detail.pk} code={item.sj_style_detail.code} styleName={item.sj_style_detail.style_name} />
                ) : (
                  <Text color="gray.400">-</Text>
                )}
              </Box>

              <Box>
                <Text fontSize="sm" color={labelColor} mb={1}>{t("tgBindingGuideDetail.createdAt")}</Text>
                <Text>{formatDate(item.created_at)}</Text>
              </Box>
              <Box>
                <Text fontSize="sm" color={labelColor} mb={1}>{t("tgBindingGuideDetail.updatedAt")}</Text>
                <Text>{formatDate(item.updated_at)}</Text>
              </Box>

              {isEditing && (
                <HStack justify="flex-end" pt={2}>
                  <Button size="sm" variant="ghost" onClick={() => setIsEditing(false)}>{t("tgBindingGuideDetail.cancel")}</Button>
                  <Button size="sm" colorScheme="blue" onClick={onSave} isLoading={editMutation.status === "pending"}>{t("tgBindingGuideDetail.save")}</Button>
                </HStack>
              )}
            </Stack>
          </Box>
        </Box>

        <HStack justify="center" spacing={4} mt={6}>
          <Button size="sm" variant="outline" onClick={() => setIsEditing((p) => !p)}>
            {isEditing ? t("tgBindingGuideDetail.cancel") : t("tgBindingGuideDetail.edit")}
          </Button>
          <Button size="sm" colorScheme="red" variant="outline" onClick={() => setIsDeleteOpen(true)}>
            {t("tgBindingGuideDetail.delete")}
          </Button>
        </HStack>
      </Box>

      {/* QR 라벨 프린트 미리보기 모달 */}
      {(() => {
        const qrPhoto = photos.find((p) => p.description === "QR Code");
        return (
          <Modal isOpen={isPrintLabelOpen} onClose={() => setIsPrintLabelOpen(false)} isCentered size="sm">
            <ModalOverlay />
            <ModalContent>
              <ModalHeader fontSize="md">Print Label Preview</ModalHeader>
              <ModalCloseButton />
              <ModalBody pb={4}>
                <Box border="1px solid" borderColor="gray.300" p={3} display="flex" alignItems="center" gap={3} maxW="85mm" mx="auto" rounded="sm">
                  {qrPhoto && <Image src={qrPhoto.file} w="22mm" h="22mm" objectFit="contain" flexShrink={0} />}
                  <Box>
                    <Text fontWeight="bold" fontSize="sm" mb={1}>{item.name ?? "-"}</Text>
                    <Text fontSize="xs" color="gray.500">S/N: {item.serial_number ?? "-"}</Text>
                    <Text fontSize="xs" color="gray.500">Created: {formatDate(item.created_at)}</Text>
                  </Box>
                </Box>
              </ModalBody>
              <ModalFooter pt={0}>
                <Button variant="ghost" mr={2} onClick={() => setIsPrintLabelOpen(false)}>Cancel</Button>
                <Button colorScheme="teal" onClick={handlePrintLabel} isDisabled={!qrPhoto}>Print</Button>
              </ModalFooter>
            </ModalContent>
          </Modal>
        );
      })()}

      <Modal isOpen={!!selectedPhoto} onClose={() => setSelectedPhoto(null)} size="xl" isCentered>
        <ModalOverlay />
        <ModalContent bg="transparent" boxShadow="none">
          <ModalCloseButton color="white" zIndex={10} />
          <ModalBody p={0}>
            {selectedPhoto && (
              <Image src={selectedPhoto.file} alt={selectedPhoto.description ?? "tg binding guide photo"} w="100%" maxH="80vh" objectFit="contain" rounded="md" />
            )}
            {selectedPhoto?.description && (
              <Text textAlign="center" color="white" mt={2} fontSize="sm">{selectedPhoto.description}</Text>
            )}
          </ModalBody>
        </ModalContent>
      </Modal>

      <VideoModal isOpen={!!selectedVideo} onClose={() => setSelectedVideo(null)} selectedVideo={selectedVideo} />
    </>
  );
}
