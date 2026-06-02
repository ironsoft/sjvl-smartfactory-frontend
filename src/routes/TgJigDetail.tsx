import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  deleteTgJig,
  deleteTgJigPhoto,
  editTgJig,
  getTgJigDetail,
  getTgJigPhotos,
  getTgJigVideos,
  getTgJigStorageLocations,
  getSjStyles,
  getUploadURL,
  getUploadVideoURL,
  uploadImage,
  uploadVideo,
  getVideoData,
  createTgJigPhoto,
  createTgJigVideo,
  deleteTgJigVideo,
  tgJigLightOn,
  IFilePhotos,
  IFileVideos,
  ITgJigStorageLocation,
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

interface IJigLocation {
  id?: number;
  code?: string;
  zone?: string;
  shelf?: string;
  slot?: number | string;
  description?: string;
}

interface IJigDetail {
  id?: string;
  name?: string;
  serial_number?: string;
  description?: string;
  buyer?: string;
  shape?: string;
  shape_display?: string;
  size?: string;
  material?: string;
  material_display?: string;
  status?: string;
  status_display?: string;
  location?: number | null;
  location_detail?: IJigLocation | null;
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

const SHAPE_OPTIONS = [
  { value: "bar", label: "Bar" },
  { value: "square", label: "Square" },
  { value: "platen", label: "Platen" },
  { value: "other", label: "Other" }
];

const MATERIAL_OPTIONS = [
  { value: "plastic", label: "Plastic" },
  { value: "aluminum", label: "Aluminum" },
  { value: "Silicon", label: "Silicon" },
  { value: "wood", label: "Wood" },
  { value: "other", label: "Other" }
];

export default function TgJigDetail() {
  const { t } = useTranslation();
  const { tgJigId } = useParams();
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
    buyer: "",
    shape: "",
    size: "",
    material: "",
    status: "",
    location: "" as string,
    sj_style: null as number | null,
  });

  // SjStyle 검색 (편집 모드)
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

  // 사진 편집용 상태
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const [newPreviews, setNewPreviews] = useState<string[]>([]);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const { data: photos = [], isLoading: photosLoading } = useQuery<
    IFilePhotos[]
  >({
    queryKey: ["tgJigPhotos", tgJigId],
    queryFn: () => getTgJigPhotos(tgJigId!),
    enabled: !!tgJigId
  });

  const { data: videos = [], isLoading: videosLoading } = useQuery<IFileVideos[]>({
    queryKey: ["tgJigVideos", tgJigId],
    queryFn: () => getTgJigVideos(tgJigId!),
    enabled: !!tgJigId
  });

  const { data: locations = [] } = useQuery<ITgJigStorageLocation[]>({
    queryKey: ["tg-jig-storage-locations"],
    queryFn: getTgJigStorageLocations
  });

  const { data: styleSearchData } = useQuery<ISjStyleListResponse>({
    queryKey: ["sjStyleSearch", styleSearch],
    queryFn: () => getSjStyles({ search: styleSearch, page: 1 }),
    enabled: styleSearch.length > 0 && !selectedStyle,
  });
  const styleSuggestions: ISjStyle[] = styleSearchData?.results ?? [];

  const {
    data: jig,
    isLoading,
    error
  } = useQuery<IJigDetail>({
    queryKey: ["tgJigDetail", tgJigId],
    queryFn: () => {
      if (typeof tgJigId === "string") return getTgJigDetail(tgJigId);
      throw new Error("tgJigId is not a string");
    }
  });

  const cardBg = useColorModeValue("white", "gray.800");
  const pageBg = useColorModeValue("gray.50", "gray.900");
  const labelColor = useColorModeValue("gray.500", "gray.400");
  const suggestionBg = useColorModeValue("white", "gray.700");
  const suggestionHoverBg = useColorModeValue("blue.50", "gray.600");
  const suggestionBorderColor = useColorModeValue("gray.200", "gray.600");

  // 조명 켜기 mutation
  const tgJigLightOnMutation = useMutation({
    mutationFn: tgJigLightOn,
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
        description: t("tgJigList.lightError"),
        status: "error",
        duration: 2000,
        isClosable: true,
        position: "bottom-right"
      });
    }
  });

  // 타이머 카운트다운
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
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "2-digit"
    });
  };

  useEffect(() => {
    if (jig) {
      setForm({
        name: jig.name ?? "",
        description: jig.description ?? "",
        buyer: jig.buyer ?? "",
        shape: jig.shape ?? "",
        size: jig.size ?? "",
        material: jig.material ?? "",
        status: jig.status ?? "",
        location: jig.location != null ? String(jig.location) : "",
        sj_style: jig.sj_style ?? null,
      });
      if (jig.sj_style_detail) {
        setSelectedStyle({ pk: jig.sj_style_detail.pk, code: jig.sj_style_detail.code, style_name: jig.sj_style_detail.style_name } as ISjStyle);
        setStyleSearch(jig.sj_style_detail.code);
      } else {
        setSelectedStyle(null);
        setStyleSearch("");
      }
    }
  }, [jig]);

  const editMutation = useMutation({
    mutationFn: editTgJig,
    onSuccess: () => {
      toast({
        title: t("tgJigDetail.updated"),
        status: "success",
        duration: 2000,
        isClosable: true,
        position: "bottom-right"
      });
      if (tgJigId)
        queryClient.invalidateQueries({ queryKey: ["tgJigDetail", tgJigId] });
      setIsEditing(false);
    },
    onError: () => {
      toast({
        title: t("tgJigDetail.updateFailed"),
        status: "error",
        duration: 2000,
        isClosable: true,
        position: "bottom-right"
      });
    }
  });

  const onSave = () => {
    if (!jig?.id) return;
    editMutation.mutate({
      id: jig.id,
      name: form.name,
      description: form.description,
      buyer: form.buyer,
      shape: form.shape,
      size: form.size,
      material: form.material,
      status: form.status,
      location: form.location ? Number(form.location) : null,
      sj_style: selectedStyle ? selectedStyle.pk : null,
    });
  };

  const deleteMutation = useMutation({
    mutationFn: deleteTgJig,
    onSuccess: () => {
      toast({
        title: t("tgJigDetail.deleted"),
        status: "success",
        duration: 2000,
        isClosable: true,
        position: "bottom-right"
      });
      queryClient.invalidateQueries({ queryKey: ["tgJigs"] });
      navigate("/tg-jigs");
    },
    onError: () => {
      toast({
        title: t("tgJigDetail.deleteFailed"),
        status: "error",
        duration: 2000,
        isClosable: true,
        position: "bottom-right"
      });
    }
  });

  // 기존 사진 삭제
  const deletePhotoMutation = useMutation({
    mutationFn: ({ photoPk }: { photoPk: string }) =>
      deleteTgJigPhoto({ tgJigId: tgJigId!, photoPk }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tgJigPhotos", tgJigId] });
      queryClient.invalidateQueries({ queryKey: ["tgJigPhotos"] });
      toast({
        title: t("tgJigDetail.photoDeleted"),
        status: "success",
        duration: 2000,
        isClosable: true,
        position: "bottom-right"
      });
    },
    onError: () => {
      toast({
        title: t("tgJigDetail.photoDeleteFailed"),
        status: "error",
        duration: 2000,
        isClosable: true,
        position: "bottom-right"
      });
    }
  });

  // 비디오 삭제
  const deleteVideoMutation = useMutation({
    mutationFn: ({ videoPk }: { videoPk: string }) =>
      deleteTgJigVideo({ tgJigId: tgJigId!, videoPk }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tgJigVideos", tgJigId] });
      toast({
        title: "Video deleted",
        status: "success",
        duration: 2000,
        isClosable: true,
        position: "bottom-right"
      });
    },
    onError: () => {
      toast({
        title: "Video delete failed",
        status: "error",
        duration: 2000,
        isClosable: true,
        position: "bottom-right"
      });
    }
  });

  // 비디오 생성 (Django 저장)
  const createTgJigVideoMutation = useMutation({
    mutationFn: createTgJigVideo,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tgJigVideos", tgJigId] });
      setIsUploadingVideo(false);
      setPendingVideoFile(null);
      if (videoInputRef.current) videoInputRef.current.value = "";
      toast({
        title: "Video uploaded",
        status: "success",
        duration: 2000,
        isClosable: true,
        position: "bottom-right"
      });
    },
    onError: () => {
      setIsUploadingVideo(false);
      toast({
        title: "Video upload failed",
        status: "error",
        duration: 2000,
        isClosable: true,
        position: "bottom-right"
      });
    }
  });

  // Cloudflare 비디오 데이터 가져오기
  const getVideoDataMutation = useMutation({
    mutationFn: getVideoData,
    onSuccess: (data: any) => {
      const thumbnailURL = data.thumbnail;
      const videoURL = `https://customer-kc2gx0yn68qxte35.cloudflarestream.com/${data.uid}/iframe`;
      createTgJigVideoMutation.mutate({
        VideoFile: videoURL,
        ThumbnailFile: thumbnailURL,
        tgJigId: tgJigId!
      });
    }
  });

  // Cloudflare에 비디오 업로드
  const uploadVideoMutation = useMutation({
    mutationFn: uploadVideo,
    onSuccess: () => {
      getVideoDataMutation.mutate(videoUid);
    }
  });

  // Cloudflare 비디오 업로드 URL 획득
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

  // QR 라벨 프린트 모달
  const [isPrintLabelOpen, setIsPrintLabelOpen] = useState(false);

  const handlePrintLabel = () => {
    const qrPhoto = photos.find((p) => p.description === "QR Code");
    if (!qrPhoto) return;
    const printWindow = window.open("", "_blank", "width=500,height=400");
    if (!printWindow) return;
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${jig?.name ?? "Jig Label"}</title>
          <style>
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body { font-family: Arial, sans-serif; background: white; }
            .label {
              width: 85mm;
              padding: 5mm;
              display: flex;
              align-items: center;
              gap: 4mm;
              border: 0.3mm solid #ccc;
            }
            .qr img { width: 22mm; height: 22mm; display: block; }
            .info { flex: 1; }
            .name { font-size: 10pt; font-weight: bold; margin-bottom: 1.5mm; }
            .detail { font-size: 7.5pt; color: #555; margin-bottom: 1mm; }
            @media print {
              @page { size: 85mm 36mm; margin: 0; }
              body { width: 85mm; }
            }
          </style>
        </head>
        <body>
          <div class="label">
            <div class="qr"><img src="${qrPhoto.file}" alt="QR" /></div>
            <div class="info">
              <div class="name">${jig?.name ?? "-"}</div>
              <div class="detail">S/N: ${jig?.serial_number ?? "-"}</div>
              <div class="detail">Created: ${formatDate(jig?.created_at)}</div>
            </div>
          </div>
          <script>
            window.onload = function() {
              window.print();
              window.onafterprint = function() { window.close(); };
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  // QR 코드 생성 및 업로드
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
    if (!tgJigId) return;
    setIsGeneratingQR(true);
    try {
      // 1) 기존 QR 코드 사진이 있으면 먼저 삭제
      const existingQRPhotos = photos.filter(
        (p) => p.description === "QR Code"
      );
      for (const qrPhoto of existingQRPhotos) {
        await deleteTgJigPhoto({ tgJigId, photoPk: qrPhoto.pk });
      }

      // 2) 공개 페이지 URL로 QR 코드 생성 (로그인 없이 스캔 가능)
      const publicUrl = `${window.location.origin}/public/tg-jigs/${tgJigId}`;
      const dataUrl: string = await QRCode.toDataURL(publicUrl, {
        width: 400,
        margin: 2
      });

      // 3) data URL → Blob → File
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      const qrFile = new File([blob], `jig-qr-${tgJigId}.png`, {
        type: "image/png"
      });

      // 4) Cloudflare 업로드 URL 획득
      const urlData: IUploadURLResponse = await getUploadURL();

      // 5) Cloudflare에 업로드
      const dt = new DataTransfer();
      dt.items.add(qrFile);
      const cfResult: any = await uploadImage({
        file: dt.files,
        uploadURL: urlData.uploadURL
      });
      const cfUrl = `https://imagedelivery.net/mzmXhxWLR9jzdX8u9g4BBQ/${cfResult.result.id}/public`;

      // 6) Django에 저장
      await createTgJigPhoto({ file: cfUrl, tgJigId, description: "QR Code" });

      queryClient.invalidateQueries({ queryKey: ["tgJigPhotos", tgJigId] });
      queryClient.invalidateQueries({ queryKey: ["tgJigPhotos"] });
      toast({
        title: "QR Code generated",
        status: "success",
        duration: 2000,
        isClosable: true,
        position: "bottom-right"
      });
    } catch (e) {
      toast({
        title: "QR Code generation failed",
        status: "error",
        duration: 3000,
        isClosable: true,
        position: "bottom-right"
      });
    } finally {
      setIsGeneratingQR(false);
    }
  };

  // 새 사진 파일 선택
  const handlePhotoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setNewFiles((prev) => [...prev, ...files]);
    setNewPreviews((prev) => [
      ...prev,
      ...files.map((f) => URL.createObjectURL(f))
    ]);
    if (photoInputRef.current) photoInputRef.current.value = "";
  };

  const removeNewFile = (index: number) => {
    setNewFiles((prev) => prev.filter((_, i) => i !== index));
    setNewPreviews((prev) => {
      URL.revokeObjectURL(prev[index]);
      return prev.filter((_, i) => i !== index);
    });
  };

  // 새 사진 업로드 (Cloudflare → Django)
  const uploadOnePhoto = async (file: File) => {
    const urlData: IUploadURLResponse = await getUploadURL();
    const dt = new DataTransfer();
    dt.items.add(file);
    const cfResult: any = await uploadImage({
      file: dt.files,
      uploadURL: urlData.uploadURL
    });
    const cfUrl = `https://imagedelivery.net/mzmXhxWLR9jzdX8u9g4BBQ/${cfResult.result.id}/public`;
    await createTgJigPhoto({
      file: cfUrl,
      tgJigId: tgJigId!,
      description: jig?.name ?? ""
    });
  };

  const handleUploadNewPhotos = async () => {
    if (!newFiles.length) return;
    setIsUploadingPhoto(true);
    try {
      for (const file of newFiles) {
        await uploadOnePhoto(file);
      }
      queryClient.invalidateQueries({ queryKey: ["tgJigPhotos", tgJigId] });
      queryClient.invalidateQueries({ queryKey: ["tgJigPhotos"] });
      setNewFiles([]);
      setNewPreviews([]);
      toast({
        title: t("tgJigDetail.photosUploaded"),
        status: "success",
        duration: 2000,
        isClosable: true,
        position: "bottom-right"
      });
    } catch {
      toast({
        title: t("tgJigDetail.photosUploadFailed"),
        status: "warning",
        duration: 3000,
        isClosable: true,
        position: "bottom-right"
      });
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  if (isLoading) {
    return (
      <>
        <Helmet>
          <title>Loading... Jig Detail</title>
        </Helmet>
        <Center minH="60vh">
          <Spinner size="lg" />
        </Center>
      </>
    );
  }

  if (error || !jig) {
    return (
      <>
        <Helmet>
          <title>Jig Not Found</title>
        </Helmet>
        <Center minH="60vh">
          <Box textAlign="center">
            <Heading size="md" mb={2}>
              {t("tgJigDetail.notFound")}
            </Heading>
            <Text color="gray.500" mb={4}>
              {t("tgJigDetail.notFoundDesc")}
            </Text>
            <HStack display={"flex"} alignItems={"center"} gap={2}>
              <Button
                leftIcon={<FaArrowLeft />}
                variant="ghost"
                size="sm"
                onClick={() => navigate("/tg-jigs")}
              >
                {t("tgJigDetail.backToListBtn")}
              </Button>
            </HStack>
          </Box>
        </Center>
      </>
    );
  }

  const locationDetail = jig.location_detail;

  return (
    <>
      <Helmet>
        <title>{jig.name ?? "Jig Detail"}</title>
      </Helmet>
      <Box
        bg={pageBg}
        flex="1"
        minH="calc(100vh - 120px)"
        py={{ base: 6, md: 10 }}
      >
        <Box
          maxW={{ base: "3xl", lg: "5xl" }}
          mx="auto"
          px={{ base: 4, md: 8 }}
        >
          <HStack justify="space-between" align="flex-start" mb={4}>
            <Button
              as={RouterLink}
              to="/tg-jigs"
              variant="ghost"
              size="sm"
              leftIcon={<FaArrowLeft />}
            >
              {t("tgJigDetail.backToList")}
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

          <AlertDialog
            isOpen={isDeleteOpen}
            leastDestructiveRef={cancelRef}
            onClose={() => setIsDeleteOpen(false)}
          >
            <AlertDialogOverlay>
              <AlertDialogContent>
                <AlertDialogHeader fontSize="lg" fontWeight="bold">
                  {t("tgJigDetail.deleteTitle")}
                </AlertDialogHeader>
                <AlertDialogBody>
                  {t("tgJigDetail.deleteConfirm")}
                </AlertDialogBody>
                <AlertDialogFooter>
                  <Button
                    ref={cancelRef}
                    onClick={() => setIsDeleteOpen(false)}
                  >
                    {t("tgJigDetail.cancel")}
                  </Button>
                  <Button
                    colorScheme="red"
                    ml={3}
                    isLoading={deleteMutation.status === "pending"}
                    onClick={() => {
                      deleteMutation.mutate(tgJigId!);
                      setIsDeleteOpen(false);
                    }}
                  >
                    {t("tgJigDetail.delete")}
                  </Button>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialogOverlay>
          </AlertDialog>

          {/* QR 코드 재생성 확인 다이얼로그 */}
          <AlertDialog
            isOpen={isQRConfirmOpen}
            leastDestructiveRef={qrCancelRef}
            onClose={() => setIsQRConfirmOpen(false)}
            isCentered
          >
            <AlertDialogOverlay>
              <AlertDialogContent>
                <AlertDialogHeader fontSize="lg" fontWeight="bold">
                  {t("tgJigDetail.qrExistsTitle")}
                </AlertDialogHeader>
                <AlertDialogBody>
                  {t("tgJigDetail.qrExistsConfirm")}
                </AlertDialogBody>
                <AlertDialogFooter>
                  <Button
                    ref={qrCancelRef}
                    onClick={() => setIsQRConfirmOpen(false)}
                  >
                    {t("tgJigDetail.cancel")}
                  </Button>
                  <Button
                    colorScheme="teal"
                    ml={3}
                    onClick={() => {
                      setIsQRConfirmOpen(false);
                      handleGenerateQR();
                    }}
                  >
                    {t("tgJigDetail.qrExistsConfirmBtn")}
                  </Button>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialogOverlay>
          </AlertDialog>

          <Box
            bg={cardBg}
            borderRadius="xl"
            boxShadow="lg"
            p={{ base: 5, md: 8 }}
          >
            <Box mb={4} position="relative">
              {/* QR 코드 이미지 - 오른쪽 상단 */}
              {(() => {
                const qrPhoto = photos.find((p) => p.description === "QR Code");
                if (!qrPhoto) return null;
                return (
                  <Box
                    position="absolute"
                    top={0}
                    right={0}
                    w={{ base: "50px", md: "100px" }}
                    h={{ base: "50px", md: "100px" }}
                    rounded="md"
                    overflow="hidden"
                    border="1px solid"
                    borderColor="teal.300"
                    cursor="pointer"
                    onClick={() => setIsPrintLabelOpen(true)}
                    _hover={{
                      opacity: 0.8,
                      transform: "scale(1.05)",
                      transition: "all 0.2s"
                    }}
                  >
                    <Image
                      src={qrPhoto.file}
                      alt="QR Code"
                      w="100%"
                      h="100%"
                      objectFit="contain"
                    />
                  </Box>
                );
              })()}
              <Heading size="lg" mb={2}>
                {jig.name ?? "Jig Detail"}
              </Heading>
              <HStack spacing={3} flexWrap="wrap">
                {jig.shape_display && (
                  <Badge colorScheme="purple">{jig.shape_display}</Badge>
                )}
                {jig.material_display && (
                  <Badge colorScheme="orange">{jig.material_display}</Badge>
                )}
                {jig.status_display && (
                  <Badge colorScheme="blue">{jig.status_display}</Badge>
                )}
                {locationDetail?.code && (
                  <Badge colorScheme="green">위치: {locationDetail.code}</Badge>
                )}
                {jig.sj_style_detail && (
                  <Link as={RouterLink} to={`/sjstyles/${jig.sj_style_detail.pk}`}>
                    <Badge colorScheme="teal" cursor="pointer" _hover={{ opacity: 0.8 }}>
                      {jig.sj_style_detail.code}
                    </Badge>
                  </Link>
                )}
              </HStack>
            </Box>

            {/* 사진 영역 */}
            <Box mb={4}>
              {photosLoading ? (
                <SimpleGrid columns={2} spacing={2}>
                  {[0, 1].map((i) => (
                    <Skeleton key={i} w="100px" h="100px" rounded="md" />
                  ))}
                </SimpleGrid>
              ) : (
                <Box>
                  <SimpleGrid columns={{ base: 3, md: 5 }} spacing={2}>
                    {photos
                      .filter((p) => p.description !== "QR Code")
                      .map((photo) => (
                        <Box key={photo.pk} position="relative">
                          <Box
                            rounded="md"
                            overflow="hidden"
                            border="1px solid"
                            borderColor="gray.200"
                            w="120px"
                            h="120px"
                            cursor={isEditing ? "default" : "pointer"}
                            onClick={() =>
                              !isEditing && setSelectedPhoto(photo)
                            }
                            _hover={
                              !isEditing
                                ? {
                                    opacity: 0.8,
                                    transform: "scale(1.03)",
                                    transition: "all 0.2s"
                                  }
                                : {}
                            }
                          >
                            <Image
                              src={photo.file}
                              alt={photo.description ?? "jig photo"}
                              w="100%"
                              h="100%"
                              objectFit="cover"
                            />
                          </Box>
                          {isEditing && (
                            <Button
                              size="xs"
                              position="absolute"
                              top="-1"
                              right="-1"
                              borderRadius="full"
                              colorScheme="red"
                              minW="18px"
                              h="18px"
                              p={0}
                              fontSize="10px"
                              isLoading={deletePhotoMutation.isPending}
                              onClick={() =>
                                deletePhotoMutation.mutate({
                                  photoPk: photo.pk
                                })
                              }
                            >
                              ✕
                            </Button>
                          )}
                        </Box>
                      ))}
                    {isEditing &&
                      newPreviews.map((src, i) => (
                        <Box key={`new-${i}`} position="relative">
                          <Box
                            rounded="md"
                            overflow="hidden"
                            border="2px dashed"
                            borderColor="blue.300"
                            w="100px"
                            h="100px"
                          >
                            <Image
                              src={src}
                              alt={`new-${i}`}
                              w="100%"
                              h="100%"
                              objectFit="cover"
                            />
                          </Box>
                          <Button
                            size="xs"
                            position="absolute"
                            top="-1"
                            right="-1"
                            borderRadius="full"
                            colorScheme="gray"
                            minW="18px"
                            h="18px"
                            p={0}
                            fontSize="10px"
                            onClick={() => removeNewFile(i)}
                          >
                            ✕
                          </Button>
                        </Box>
                      ))}
                  </SimpleGrid>

                  {photos.filter((p) => p.description !== "QR Code").length ===
                    0 &&
                    newPreviews.length === 0 &&
                    !isEditing && (
                      <Box
                        w="100px"
                        h="100px"
                        rounded="md"
                        border="1px dashed"
                        borderColor="gray.300"
                        display="flex"
                        alignItems="center"
                        justifyContent="center"
                      >
                        <Text fontSize="xs" color="gray.400" textAlign="center">
                          {t("tgJigDetail.noPhotos")}
                        </Text>
                      </Box>
                    )}

                  {isEditing && (
                    <HStack mt={2} spacing={2}>
                      <Input
                        ref={photoInputRef}
                        type="file"
                        accept="image/*"
                        multiple
                        size="xs"
                        onChange={handlePhotoFileChange}
                        maxW="180px"
                      />
                      {newFiles.length > 0 && (
                        <Button
                          size="xs"
                          colorScheme="blue"
                          isLoading={isUploadingPhoto}
                          loadingText="Uploading..."
                          onClick={handleUploadNewPhotos}
                        >
                          {t("tgJigDetail.uploadPhotos")} ({newFiles.length})
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
                  {[0, 1].map((i) => (
                    <Skeleton key={i} w="120px" h="80px" rounded="md" />
                  ))}
                </SimpleGrid>
              ) : (
                <Box>
                  <SimpleGrid columns={{ base: 2, md: 4 }} spacing={2}>
                    {videos.map((video) => (
                      <Box key={video.pk} position="relative">
                        <Box
                          rounded="md"
                          overflow="hidden"
                          border="1px solid"
                          borderColor="gray.200"
                          w="120px"
                          h="80px"
                          cursor="pointer"
                          position="relative"
                          onClick={() => !isEditing && setSelectedVideo(video.VideoFile)}
                          _hover={!isEditing ? { opacity: 0.8, transform: "scale(1.03)", transition: "all 0.2s" } : {}}
                        >
                          {video.ThumbnailFile ? (
                            <Image
                              src={video.ThumbnailFile}
                              alt={video.description ?? "jig video"}
                              w="100%"
                              h="100%"
                              objectFit="cover"
                            />
                          ) : (
                            <Box w="100%" h="100%" bg="gray.200" display="flex" alignItems="center" justifyContent="center">
                              <Text fontSize="xs" color="gray.500">Video</Text>
                            </Box>
                          )}
                          {/* 재생 아이콘 오버레이 */}
                          <Box
                            position="absolute"
                            inset={0}
                            display="flex"
                            alignItems="center"
                            justifyContent="center"
                            bg="blackAlpha.300"
                          >
                            <Text fontSize="2xl" color="white">▶</Text>
                          </Box>
                        </Box>
                        {isEditing && (
                          <Button
                            size="xs"
                            position="absolute"
                            top="-1"
                            right="-1"
                            borderRadius="full"
                            colorScheme="red"
                            minW="18px"
                            h="18px"
                            p={0}
                            fontSize="10px"
                            isLoading={deleteVideoMutation.isPending}
                            onClick={() => deleteVideoMutation.mutate({ videoPk: video.pk })}
                          >
                            ✕
                          </Button>
                        )}
                      </Box>
                    ))}
                  </SimpleGrid>

                  {videos.length === 0 && !isEditing && (
                    <Box
                      w="120px"
                      h="80px"
                      rounded="md"
                      border="1px dashed"
                      borderColor="gray.300"
                      display="flex"
                      alignItems="center"
                      justifyContent="center"
                    >
                      <Text fontSize="xs" color="gray.400" textAlign="center">
                        No videos
                      </Text>
                    </Box>
                  )}

                  {isEditing && (
                    <HStack mt={2} spacing={2}>
                      <Input
                        ref={videoInputRef}
                        type="file"
                        accept="video/*"
                        size="xs"
                        onChange={handleVideoFileChange}
                        maxW="180px"
                      />
                      {pendingVideoFile && (
                        <Button
                          size="xs"
                          colorScheme="teal"
                          isLoading={isUploadingVideo || uploadVideoURLMutation.isPending || uploadVideoMutation.isPending || getVideoDataMutation.isPending || createTgJigVideoMutation.isPending}
                          loadingText="Uploading..."
                          onClick={handleUploadVideo}
                        >
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
              {/* Name */}
              <Box>
                <Text fontSize="sm" color={labelColor} mb={1}>
                  {t("tgJigDetail.name")}
                </Text>
                {isEditing ? (
                  <Input
                    size="sm"
                    value={form.name}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, name: e.target.value }))
                    }
                  />
                ) : (
                  <Text>{jig.name ?? "-"}</Text>
                )}
              </Box>

              {/* Serial Number (read-only) */}
              <Box>
                <Text fontSize="sm" color={labelColor} mb={1}>
                  {t("tgJigDetail.serialNumber")}
                </Text>
                <Text>{jig.serial_number ?? "-"}</Text>
              </Box>

              {/* Buyer */}
              <Box>
                <Text fontSize="sm" color={labelColor} mb={1}>
                  {t("tgJigDetail.buyer")}
                </Text>
                {isEditing ? (
                  <Input
                    size="sm"
                    value={form.buyer}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, buyer: e.target.value }))
                    }
                  />
                ) : (
                  <Text>{jig.buyer || "-"}</Text>
                )}
              </Box>

              {/* Shape */}
              <Box>
                <Text fontSize="sm" color={labelColor} mb={1}>
                  {t("tgJigDetail.shape")}
                </Text>
                {isEditing ? (
                  <Select
                    size="sm"
                    value={form.shape}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, shape: e.target.value }))
                    }
                  >
                    <option value="">{t("tgJigDetail.selectShape")}</option>
                    {SHAPE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </Select>
                ) : (
                  <Text>
                    {jig.shape_display ??
                      SHAPE_OPTIONS.find((o) => o.value === jig.shape)?.label ??
                      "-"}
                  </Text>
                )}
              </Box>

              {/* Material */}
              <Box>
                <Text fontSize="sm" color={labelColor} mb={1}>
                  {t("tgJigDetail.material")}
                </Text>
                {isEditing ? (
                  <Select
                    size="sm"
                    value={form.material}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, material: e.target.value }))
                    }
                  >
                    <option value="">{t("tgJigDetail.selectMaterial")}</option>
                    {MATERIAL_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </Select>
                ) : (
                  <Text>
                    {jig.material_display ??
                      MATERIAL_OPTIONS.find((o) => o.value === jig.material)
                        ?.label ??
                      "-"}
                  </Text>
                )}
              </Box>

              {/* Size */}
              <Box>
                <Text fontSize="sm" color={labelColor} mb={1}>
                  {t("tgJigDetail.size")}
                </Text>
                {isEditing ? (
                  <Input
                    size="sm"
                    value={form.size}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, size: e.target.value }))
                    }
                  />
                ) : (
                  <Text>{jig.size || "-"}</Text>
                )}
              </Box>

              {/* Status */}
              <Box>
                <Text fontSize="sm" color={labelColor} mb={1}>
                  {t("tgJigDetail.status")}
                </Text>
                {isEditing ? (
                  <Select
                    size="sm"
                    value={form.status}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, status: e.target.value }))
                    }
                  >
                    <option value="">{t("tgJigDetail.selectStatus")}</option>
                    {STATUS_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </Select>
                ) : (
                  <Text>
                    {jig.status_display ??
                      STATUS_OPTIONS.find((o) => o.value === jig.status)
                        ?.label ??
                      "-"}
                  </Text>
                )}
              </Box>

              {/* Description */}
              <Box>
                <Text fontSize="sm" color={labelColor} mb={1}>
                  {t("tgJigDetail.description")}
                </Text>
                {isEditing ? (
                  <Textarea
                    size="sm"
                    value={form.description}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, description: e.target.value }))
                    }
                  />
                ) : (
                  <Text whiteSpace="pre-wrap">{jig.description || "-"}</Text>
                )}
              </Box>

              {/* Location */}
              <Box>
                <Text fontSize="sm" color={labelColor} mb={1}>
                  {t("tgJigDetail.location")}
                </Text>
                {isEditing ? (
                  <>
                    <Select
                      size="sm"
                      value={form.location}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, location: e.target.value }))
                      }
                    >
                      <option value="">{t("tgJigDetail.noLocation")}</option>
                      {locations.map((loc) => (
                        <option key={loc.id} value={loc.id}>
                          {loc.code}
                          {loc.description ? ` — ${loc.description}` : ""}
                        </option>
                      ))}
                    </Select>
                    <Text fontSize="xs" color="gray.500" mt={1}>
                      {t("tgJigCreate.locationTgOnlyHint")}{" "}
                      <Link as={RouterLink} to="/tg-jigs/locations" color="blue.500" textDecoration="underline">
                        {t("tgJigCreate.manageTgLocations")}
                      </Link>
                    </Text>
                  </>
                ) : locationDetail ? (
                  <HStack spacing={2} align="center">
                    <Text>
                      {locationDetail.code ?? "-"} ({t("tgJigDetail.locationZone")}{" "}
                      {locationDetail.zone ?? "-"} ·{" "}
                      {t("tgJigDetail.locationShelf")} {locationDetail.shelf ?? "-"}{" "}
                      · {t("tgJigDetail.locationSlot")} {locationDetail.slot ?? "-"}
                      )
                    </Text>
                    <Button
                      size="xs"
                      leftIcon={<RiFlashlightFill />}
                      colorScheme="yellow"
                      variant="outline"
                      isDisabled={lightTimer > 0}
                      isLoading={tgJigLightOnMutation.isPending}
                      onClick={() => tgJigId && tgJigLightOnMutation.mutate(tgJigId)}
                    >
                      {lightTimer > 0 ? `${lightTimer}s` : t("tgJigList.lightOn")}
                    </Button>
                  </HStack>
                ) : (
                  <Text>{jig.location ?? "-"}</Text>
                )}
              </Box>

              {/* SJ Style */}
              <Box>
                <Text fontSize="sm" color={labelColor} mb={1}>SJ Style</Text>
                {isEditing ? (
                  <Box position="relative">
                    <Input
                      size="sm"
                      placeholder="Style Code 검색... (optional)"
                      value={styleSearch}
                      onChange={(e) => {
                        setStyleSearch(e.target.value);
                        setSelectedStyle(null);
                        setShowStyleSuggestions(true);
                      }}
                      onFocus={() => { if (styleSearch && !selectedStyle) setShowStyleSuggestions(true); }}
                      onBlur={() => {
                        styleBlurTimer.current = setTimeout(() => setShowStyleSuggestions(false), 150);
                      }}
                    />
                    {showStyleSuggestions && styleSuggestions.length > 0 && (
                      <List
                        position="absolute"
                        zIndex={10}
                        w="full"
                        bg={suggestionBg}
                        border="1px solid"
                        borderColor={suggestionBorderColor}
                        borderRadius="md"
                        boxShadow="md"
                        maxH="180px"
                        overflowY="auto"
                        mt={1}
                      >
                        {styleSuggestions.map((s) => (
                          <ListItem
                            key={s.pk}
                            px={3}
                            py={2}
                            cursor="pointer"
                            _hover={{ bg: suggestionHoverBg }}
                            onMouseDown={() => {
                              if (styleBlurTimer.current) clearTimeout(styleBlurTimer.current);
                              setSelectedStyle(s);
                              setStyleSearch(s.code);
                              setShowStyleSuggestions(false);
                            }}
                          >
                            <Text fontSize="sm" fontWeight="semibold">{s.code}</Text>
                            {s.style_name && <Text fontSize="xs" color="gray.500">{s.style_name}</Text>}
                          </ListItem>
                        ))}
                      </List>
                    )}
                    {selectedStyle && (
                      <Text fontSize="xs" color="blue.500" mt={1}>
                        선택됨: {selectedStyle.code} — {selectedStyle.style_name}
                      </Text>
                    )}
                    {styleSearch && !selectedStyle && (
                      <Text fontSize="xs" color="gray.400" mt={1}>목록에서 선택해 주세요.</Text>
                    )}
                  </Box>
                ) : jig.sj_style_detail ? (
                  <Link as={RouterLink} to={`/sjstyles/${jig.sj_style_detail.pk}`} color="blue.500" fontWeight="semibold">
                    {jig.sj_style_detail.code}
                    {jig.sj_style_detail.style_name && (
                      <Text as="span" fontWeight="normal" color={labelColor} ml={2} fontSize="sm">
                        {jig.sj_style_detail.style_name}
                      </Text>
                    )}
                  </Link>
                ) : (
                  <Text color="gray.400">-</Text>
                )}
              </Box>

              {/* Dates */}
              <Box>
                <Text fontSize="sm" color={labelColor} mb={1}>
                  {t("tgJigDetail.createdAt")}
                </Text>
                <Text>{formatDate(jig.created_at)}</Text>
              </Box>
              <Box>
                <Text fontSize="sm" color={labelColor} mb={1}>
                  {t("tgJigDetail.updatedAt")}
                </Text>
                <Text>{formatDate(jig.updated_at)}</Text>
              </Box>

              {isEditing && (
                <HStack justify="flex-end" pt={2}>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setIsEditing(false)}
                  >
                    {t("tgJigDetail.cancel")}
                  </Button>
                  <Button
                    size="sm"
                    colorScheme="blue"
                    onClick={onSave}
                    isLoading={editMutation.status === "pending"}
                  >
                    {t("tgJigDetail.save")}
                  </Button>
                </HStack>
              )}
            </Stack>
          </Box>
        </Box>

        {/* Edit / Delete 버튼 - 하단 중앙 */}
        <HStack justify="center" spacing={4} mt={6}>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setIsEditing((p) => !p)}
          >
            {isEditing ? t("tgJigDetail.cancel") : t("tgJigDetail.edit")}
          </Button>
          <Button
            size="sm"
            colorScheme="red"
            variant="outline"
            onClick={() => setIsDeleteOpen(true)}
          >
            {t("tgJigDetail.delete")}
          </Button>
        </HStack>
      </Box>

      {/* QR 라벨 프린트 미리보기 모달 */}
      {(() => {
        const qrPhoto = photos.find((p) => p.description === "QR Code");
        return (
          <Modal
            isOpen={isPrintLabelOpen}
            onClose={() => setIsPrintLabelOpen(false)}
            isCentered
            size="sm"
          >
            <ModalOverlay />
            <ModalContent>
              <ModalHeader fontSize="md">Print Label Preview</ModalHeader>
              <ModalCloseButton />
              <ModalBody pb={4}>
                {/* 라벨 미리보기 */}
                <Box
                  border="1px solid"
                  borderColor="gray.300"
                  p={3}
                  display="flex"
                  alignItems="center"
                  gap={3}
                  maxW="85mm"
                  mx="auto"
                  rounded="sm"
                >
                  {qrPhoto && (
                    <Image
                      src={qrPhoto.file}
                      w="22mm"
                      h="22mm"
                      objectFit="contain"
                      flexShrink={0}
                    />
                  )}
                  <Box>
                    <Text fontWeight="bold" fontSize="sm" mb={1}>
                      {jig.name ?? "-"}
                    </Text>
                    <Text fontSize="xs" color="gray.500">
                      S/N: {jig.serial_number ?? "-"}
                    </Text>
                    <Text fontSize="xs" color="gray.500">
                      Created: {formatDate(jig.created_at)}
                    </Text>
                  </Box>
                </Box>
              </ModalBody>
              <ModalFooter pt={0}>
                <Button
                  variant="ghost"
                  mr={2}
                  onClick={() => setIsPrintLabelOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  colorScheme="teal"
                  onClick={handlePrintLabel}
                  isDisabled={!qrPhoto}
                >
                  Print
                </Button>
              </ModalFooter>
            </ModalContent>
          </Modal>
        );
      })()}

      {/* 사진 확대 모달 */}
      <Modal
        isOpen={!!selectedPhoto}
        onClose={() => setSelectedPhoto(null)}
        size="xl"
        isCentered
      >
        <ModalOverlay />
        <ModalContent bg="transparent" boxShadow="none">
          <ModalCloseButton color="white" zIndex={10} />
          <ModalBody p={0}>
            {selectedPhoto && (
              <Image
                src={selectedPhoto.file}
                alt={selectedPhoto.description ?? "jig photo"}
                w="100%"
                maxH="80vh"
                objectFit="contain"
                rounded="md"
              />
            )}
            {selectedPhoto?.description && (
              <Text textAlign="center" color="white" mt={2} fontSize="sm">
                {selectedPhoto.description}
              </Text>
            )}
          </ModalBody>
        </ModalContent>
      </Modal>

      {/* 비디오 재생 모달 */}
      <VideoModal
        isOpen={!!selectedVideo}
        onClose={() => setSelectedVideo(null)}
        selectedVideo={selectedVideo}
      />
    </>
  );
}
