import {
  AlertDialog,
  AlertDialogBody,
  AlertDialogCloseButton,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogOverlay,
  Box,
  Button,
  Divider,
  Flex,
  FormControl,
  FormLabel,
  Image,
  Input,
  List,
  ListItem,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Skeleton,
  Text,
  IconButton,
  HStack,
  VStack,
  Badge,
  Tooltip,
  useColorModeValue,
  useDisclosure,
  useToast
} from "@chakra-ui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link as RouterLink, useNavigate, useParams } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import {
  FaArrowLeft,
  FaCopy,
  FaDownload,
  FaEdit,
  FaExpand,
  FaMinus,
  FaPlus,
  FaSearchPlus,
  FaTrash
} from "react-icons/fa";
import QRCode from "qrcode";
import {
  deleteSjmediaPhoto,
  deleteSjmediaVideo,
  editSjmedia,
  editSjmediaPhoto,
  editSjmediaVideo,
  getSjmedia,
  getSjmediaPhotoDetail,
  getSjmediaVideoDetail,
  getSjStyles,
  IFilePhotos,
  IFileVideos,
  ISjmedia,
  ISjStyle,
  ISjStyleListResponse
} from "../api";

function InfoRow({
  label,
  value,
  copyable
}: {
  label: string;
  value?: string;
  copyable?: boolean;
}) {
  const toast = useToast();
  const labelColor = useColorModeValue("gray.400", "gray.400");
  const valueColor = useColorModeValue("gray.700", "gray.100");
  const iconHoverColor = useColorModeValue("gray.700", "white");

  if (!value) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(value).then(() => {
      toast({
        title: "Copied successfully.",
        status: "success",
        duration: 1500,
        isClosable: false,
        position: "top"
      });
    });
  };

  return (
    // 정보 영역
    <Box>
      {/* Description: */}
      <Text fontSize="xs" color={labelColor} fontWeight="semibold" mb={1}>
        {label}
      </Text>
      <Flex alignItems="flex-start" gap={2}>
        <Text fontSize="sm" color={valueColor} wordBreak="break-all" flex={1}>
          {value}
        </Text>
        {copyable && (
          <Tooltip label="Copy URL" fontSize="xs">
            <IconButton
              aria-label="Copy URL"
              icon={<FaCopy />}
              size="xs"
              variant="ghost"
              color="gray.400"
              _hover={{ color: iconHoverColor }}
              flexShrink={0}
              mt="1px"
              onClick={handleCopy}
            />
          </Tooltip>
        )}
      </Flex>
    </Box>
  );
}

function QRCodeSection({
  fileUrl,
  label
}: {
  fileUrl?: string;
  label: string;
}) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const labelColor = useColorModeValue("gray.400", "gray.400");
  const toast = useToast();

  useEffect(() => {
    if (!fileUrl) {
      setQrDataUrl(null);
      return;
    }
    QRCode.toDataURL(fileUrl, { width: 200, margin: 2 })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(null));
  }, [fileUrl]);

  const handleDownload = () => {
    if (!qrDataUrl) return;
    const link = document.createElement("a");
    link.href = qrDataUrl;
    link.download = `qr-code-${label.replace(/\s+/g, "-").toLowerCase()}.png`;
    link.click();
  };

  const handleCopy = async () => {
    if (!qrDataUrl) return;
    try {
      const res = await fetch(qrDataUrl);
      const blob = await res.blob();
      await navigator.clipboard.write([
        new ClipboardItem({ "image/png": blob })
      ]);
      toast({
        title: "Image copied to clipboard.",
        status: "success",
        duration: 1500,
        isClosable: false,
        position: "top"
      });
    } catch {
      toast({
        title: "Failed to copy image.",
        status: "error",
        duration: 2000,
        position: "top"
      });
    }
  };

  if (!fileUrl || !qrDataUrl) return null;

  return (
    // QR Code 영역
    <Box>
      <Text fontSize="xs" color={labelColor} fontWeight="semibold" mb={2}>
        Video QR Code
      </Text>
      <Flex direction="column" align="flex-start" gap={2}>
        <Tooltip label="Click to copy URL" fontSize="xs">
          <Image
            src={qrDataUrl}
            alt="Video QR Code"
            w="140px"
            h="140px"
            bg="white"
            p={2}
            rounded="md"
            cursor="pointer"
            onClick={handleCopy}
            _hover={{ opacity: 0.85 }}
            transition="opacity 0.2s"
          />
        </Tooltip>
        <Button
          leftIcon={<FaDownload />}
          size="sm"
          variant="outline"
          onClick={handleDownload}
        >
          Download Video QR Code
        </Button>
      </Flex>
    </Box>
  );
}

function ImageZoomModal({
  isOpen,
  onClose,
  src,
  alt,
  fallbackSrc
}: {
  isOpen: boolean;
  onClose: () => void;
  src: string;
  alt: string;
  fallbackSrc: string;
}) {
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });

  const handleClose = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
    onClose();
  };

  const zoomIn = () => setScale((s) => Math.min(s + 0.5, 5));
  const zoomOut = () => {
    setScale((s) => {
      const next = Math.max(s - 0.5, 1);
      if (next === 1) setPosition({ x: 0, y: 0 });
      return next;
    });
  };
  const resetZoom = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

  const onMouseDown = (e: React.MouseEvent) => {
    if (scale <= 1) return;
    isDragging.current = true;
    dragStart.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y
    };
  };
  const onMouseMove = (e: React.MouseEvent) => {
    if (!isDragging.current) return;
    setPosition({
      x: e.clientX - dragStart.current.x,
      y: e.clientY - dragStart.current.y
    });
  };
  const onMouseUp = () => {
    isDragging.current = false;
  };

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    setScale((s) => {
      const next = e.deltaY < 0 ? Math.min(s + 0.2, 5) : Math.max(s - 0.2, 1);
      if (next === 1) setPosition({ x: 0, y: 0 });
      return Math.round(next * 10) / 10;
    });
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} size="full" isCentered>
      <ModalOverlay bg="blackAlpha.900" />
      <ModalContent bg="transparent" boxShadow="none" m={0}>
        <ModalCloseButton color="white" zIndex={20} size="lg" />
        <HStack
          position="fixed"
          bottom={6}
          left="50%"
          transform="translateX(-50%)"
          zIndex={20}
          bg="blackAlpha.700"
          rounded="full"
          px={4}
          py={2}
          spacing={2}
        >
          <IconButton
            aria-label="Zoom out"
            icon={<FaMinus />}
            size="sm"
            variant="ghost"
            color="white"
            _hover={{ bg: "whiteAlpha.200" }}
            onClick={zoomOut}
            isDisabled={scale <= 1}
          />
          <Text color="white" fontSize="sm" minW="44px" textAlign="center">
            {Math.round(scale * 100)}%
          </Text>
          <IconButton
            aria-label="Zoom in"
            icon={<FaPlus />}
            size="sm"
            variant="ghost"
            color="white"
            _hover={{ bg: "whiteAlpha.200" }}
            onClick={zoomIn}
            isDisabled={scale >= 5}
          />
          <Box w="1px" h="20px" bg="whiteAlpha.400" mx={1} />
          <IconButton
            aria-label="Reset zoom"
            icon={<FaExpand />}
            size="sm"
            variant="ghost"
            color="white"
            _hover={{ bg: "whiteAlpha.200" }}
            onClick={resetZoom}
          />
        </HStack>
        <ModalBody
          p={0}
          display="flex"
          justifyContent="center"
          alignItems="center"
          h="100vh"
          overflow="hidden"
          cursor={scale > 1 ? "grab" : "default"}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
          onWheel={onWheel}
        >
          <Image
            src={src}
            fallbackSrc={fallbackSrc}
            alt={alt}
            maxH={scale === 1 ? "95vh" : undefined}
            maxW={scale === 1 ? "95vw" : undefined}
            objectFit="contain"
            draggable={false}
            userSelect="none"
            style={{
              transform: `scale(${scale}) translate(${position.x / scale}px, ${position.y / scale}px)`,
              transition: isDragging.current ? "none" : "transform 0.15s ease",
              transformOrigin: "center center"
            }}
          />
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}

export default function MediaDetail() {
  const { type, pk } = useParams<{ type: string; pk: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useToast();
  const cancelRef = useRef<HTMLButtonElement>(null);

  const infoBg = useColorModeValue("gray.50", "gray.700");
  const infoBorder = useColorModeValue("gray.200", "gray.600");
  const titleColor = useColorModeValue("gray.800", "white");
  const suggestionBg = useColorModeValue("white", "gray.700");
  const suggestionHoverBg = useColorModeValue("gray.100", "gray.600");
  const suggestionBorderColor = useColorModeValue("gray.200", "gray.600");

  // SjStyle 검색 (편집 모달용)
  const [styleSearch, setStyleSearch] = useState("");
  const [selectedStyle, setSelectedStyle] = useState<ISjStyle | null>(null);
  const [showStyleSuggestions, setShowStyleSuggestions] = useState(false);
  const styleBlurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: styleSearchData } = useQuery<ISjStyleListResponse>({
    queryKey: ["sjStylesForMedia", styleSearch],
    queryFn: () => getSjStyles({ search: styleSearch, page: 1 }),
    enabled: styleSearch.length > 0 && !selectedStyle
  });

  const {
    isOpen: isZoomOpen,
    onOpen: onZoomOpen,
    onClose: onZoomClose
  } = useDisclosure();
  const {
    isOpen: isEditOpen,
    onOpen: onEditOpen,
    onClose: onEditClose
  } = useDisclosure();
  const {
    isOpen: isDeleteOpen,
    onOpen: onDeleteOpen,
    onClose: onDeleteClose
  } = useDisclosure();

  const isPhoto = type === "photos";
  const isVideo = type === "videos";

  const { data: photoData, isLoading: photoLoading } = useQuery<IFilePhotos>({
    queryKey: ["sjmedia", "photos", pk],
    queryFn: () => getSjmediaPhotoDetail(pk!),
    enabled: isPhoto && !!pk,
    retry: false
  });

  const { data: videoData, isLoading: videoLoading } = useQuery<IFileVideos>({
    queryKey: ["sjmedia", "videos", pk],
    queryFn: () => getSjmediaVideoDetail(pk!),
    enabled: isVideo && !!pk,
    retry: false
  });

  const sjmediaPk = isPhoto ? photoData?.sjmedia : videoData?.sjmedia;
  const { data: sjmediaData } = useQuery<ISjmedia>({
    queryKey: ["sjmedia", sjmediaPk],
    queryFn: () => getSjmedia(sjmediaPk!),
    enabled: !!sjmediaPk,
    retry: false
  });

  // 편집 폼 state
  const [editPhotoForm, setEditPhotoForm] = useState({
    name: "",
    description: ""
  });
  const [editVideoForm, setEditVideoForm] = useState({ description: "" });
  const [editSjmediaForm, setEditSjmediaForm] = useState<ISjmedia>({
    pk: 0,
    title: "",
    description: ""
  });

  const openEditModal = async () => {
    // SjStyle 초기화
    setStyleSearch("");
    setSelectedStyle(null);

    if (isPhoto && photoData) {
      setEditPhotoForm({
        name: photoData.name,
        description: photoData.description ?? ""
      });
      if (photoData.sjmedia) {
        const loaded = await getSjmedia(photoData.sjmedia);
        setEditSjmediaForm(loaded);
        if (loaded.sj_style_detail) {
          setSelectedStyle({
            pk: loaded.sj_style_detail.pk,
            code: loaded.sj_style_detail.code,
            style_name: loaded.sj_style_detail.style_name,
          } as ISjStyle);
        }
      }
    } else if (isVideo && videoData) {
      setEditVideoForm({ description: videoData.description ?? "" });
      if (videoData.sjmedia) {
        const loaded = await getSjmedia(videoData.sjmedia);
        setEditSjmediaForm(loaded);
        if (loaded.sj_style_detail) {
          setSelectedStyle({
            pk: loaded.sj_style_detail.pk,
            code: loaded.sj_style_detail.code,
            style_name: loaded.sj_style_detail.style_name,
          } as ISjStyle);
        }
      }
    }
    onEditOpen();
  };

  // 편집 mutation
  const editPhotoMutation = useMutation({
    mutationFn: async () => {
      await editSjmediaPhoto(pk!, editPhotoForm);
      if (editSjmediaForm.pk) {
        await editSjmedia(editSjmediaForm.pk, {
          title: editSjmediaForm.title,
          description: editSjmediaForm.description,
          sj_style: selectedStyle ? selectedStyle.pk : null
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sjmedia", "photos", pk] });
      queryClient.invalidateQueries({ queryKey: ["sjmedia", sjmediaPk] });
      toast({
        title: "Modified successfully.",
        status: "success",
        duration: 1500,
        position: "top"
      });
      onEditClose();
    },
    onError: () => {
      toast({
        title: "Modification failed.",
        status: "error",
        duration: 2000,
        position: "top"
      });
    }
  });

  // Video Edit
  const editVideoMutation = useMutation({
    mutationFn: async () => {
      await editSjmediaVideo(pk!, editVideoForm);
      if (editSjmediaForm.pk) {
        await editSjmedia(editSjmediaForm.pk, {
          title: editSjmediaForm.title,
          description: editSjmediaForm.description,
          sj_style: selectedStyle ? selectedStyle.pk : null
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sjmedia", "videos", pk] });
      queryClient.invalidateQueries({ queryKey: ["sjmedia", sjmediaPk] });
      toast({
        title: "Modified successfully.",
        status: "success",
        duration: 1500,
        position: "top"
      });
      onEditClose();
    },
    onError: () => {
      toast({
        title: "Modification failed.",
        status: "error",
        duration: 2000,
        position: "top"
      });
    }
  });

  // 삭제 mutation
  // Photo Delete
  const deletePhotoMutation = useMutation({
    mutationFn: () => deleteSjmediaPhoto(pk!),
    onSuccess: () => {
      toast({
        title: "Deleted successfully.",
        status: "success",
        duration: 1500,
        position: "top"
      });
      navigate("/media", { state: { tab: "photo" } });
    },
    onError: () => {
      toast({
        title: "Deletion failed.",
        status: "error",
        duration: 2000,
        position: "top"
      });
    }
  });

  // Video Delete
  const deleteVideoMutation = useMutation({
    mutationFn: () => deleteSjmediaVideo(pk!),
    onSuccess: () => {
      toast({
        title: "Deleted successfully.",
        status: "success",
        duration: 1500,
        position: "top"
      });
      navigate("/media", { state: { tab: "video" } });
    },
    onError: () => {
      toast({
        title: "Deletion failed.",
        status: "error",
        duration: 2000,
        position: "top"
      });
    }
  });

  // Loading
  const isLoading = photoLoading || videoLoading;

  // Edit Loading
  const isEditLoading =
    editPhotoMutation.isPending || editVideoMutation.isPending;

  // Delete Loading
  const isDeleteLoading =
    deletePhotoMutation.isPending || deleteVideoMutation.isPending;

  // Edit
  const handleEdit = () => {
    if (isPhoto) editPhotoMutation.mutate();
    else editVideoMutation.mutate();
  };

  // Delete
  const handleDelete = () => {
    if (isPhoto) deletePhotoMutation.mutate();
    else deleteVideoMutation.mutate();
  };

  // 공통 정보 박스 액션 버튼
  const ActionButtons = () => (
    <HStack spacing={2} mt={4}>
      <Button
        leftIcon={<FaEdit />}
        size="sm"
        variant="outline"
        colorScheme="blue"
        onClick={openEditModal}
        flex={1}
      >
        Edit
      </Button>
      <Button
        leftIcon={<FaTrash />}
        size="sm"
        variant="outline"
        colorScheme="red"
        onClick={onDeleteOpen}
        flex={1}
      >
        Delete
      </Button>
    </HStack>
  );

  return (
    <Box px={{ base: 4, lg: 10 }} mt={6} pb={12}>
      {/* 뒤로가기 버튼 */}
      <HStack mb={6}>
        <IconButton
          aria-label="Back to Media List"
          icon={<FaArrowLeft />}
          variant="ghost"
          onClick={() =>
            navigate("/media", {
              state: { tab: isPhoto ? "photo" : "video" }
            })
          }
        />
        <Text fontSize="sm" color="gray.500">
          Back to Media List
        </Text>
      </HStack>

      {isLoading ? (
        <Flex
          direction={{ base: "column", md: "row" }}
          gap={6}
          align={{ base: "stretch", md: "flex-start" }}
        >
          <Skeleton flex={2} height="70vh" rounded="2xl" />
          <VStack flex={1} spacing={3} align="stretch">
            <Skeleton height="20px" width="100px" />
            <Skeleton height="28px" width="180px" />
            <Skeleton height="1px" />
            <Skeleton height="16px" width="60px" />
            <Skeleton height="16px" width="240px" />
            <Skeleton height="16px" width="60px" />
            <Skeleton height="16px" width="220px" />
          </VStack>
        </Flex>
      ) : isPhoto && photoData ? (
        <Flex
          direction={{ base: "column", md: "row" }}
          gap={6}
          align={{ base: "stretch", md: "flex-start" }}
        >
          {/* 정보 영역 */}
          <Box
            order={{ base: 2, md: 2 }}
            flex={{ base: "none", md: "0 0 300px" }}
            bg={infoBg}
            rounded="xl"
            px={6}
            py={5}
            borderWidth="1px"
            borderColor={infoBorder}
            alignSelf="flex-start"
          >
            <Flex alignItems="center" gap={2} mb={4}>
              <Badge colorScheme="blue" fontSize="xs">
                Photos
              </Badge>
              <Text fontWeight="bold" fontSize="xl" color={titleColor}>
                {photoData.name}
              </Text>
            </Flex>
            <Divider mb={4} />
            <VStack spacing={4} align="stretch">
              <InfoRow
                label="Title"
                value={sjmediaData?.title ?? photoData.name}
              />
              <InfoRow label="Description" value={sjmediaData?.description} />
              {sjmediaData?.sj_style_detail && (
                <Box>
                  <Text fontSize="xs" color="gray.400" fontWeight="semibold" mb={1}>SJ Style</Text>
                  <RouterLink to={`/sjstyles/${sjmediaData.sj_style_detail.pk}`}>
                    <Badge colorScheme="teal" cursor="pointer" _hover={{ opacity: 0.8 }}>
                      {sjmediaData.sj_style_detail.code} — {sjmediaData.sj_style_detail.style_name}
                    </Badge>
                  </RouterLink>
                </Box>
              )}
              <InfoRow label="Meta Data" value={photoData.description} />
              <InfoRow label="File" value={photoData.file} copyable />
              <InfoRow label="Type" value={photoData.type} />
            </VStack>
            <ActionButtons />
          </Box>

          {/* 이미지 */}
          <Box
            order={{ base: 1, md: 1 }}
            flex={2}
            display="flex"
            justifyContent="center"
            alignItems="center"
          >
            <Box position="relative" display="inline-block">
              <Image
                src={photoData.file}
                fallbackSrc={`https://picsum.photos/seed/${photoData.pk}/800/600`}
                alt={photoData.name}
                maxH="80vh"
                maxW="100%"
                objectFit="contain"
                cursor="zoom-in"
                onClick={onZoomOpen}
                _hover={{ opacity: 0.92 }}
                title="Click to zoom in"
                display="block"
              />
              <Box
                position="absolute"
                bottom={3}
                right={3}
                bg="blackAlpha.600"
                rounded="full"
                w="32px"
                h="32px"
                display="flex"
                alignItems="center"
                justifyContent="center"
                pointerEvents="none"
              >
                <FaSearchPlus color="white" size="13px" />
              </Box>
            </Box>
          </Box>

          <ImageZoomModal
            isOpen={isZoomOpen}
            onClose={onZoomClose}
            src={photoData.file}
            alt={photoData.name}
            fallbackSrc={`https://picsum.photos/seed/${photoData.pk}/800/600`}
          />
        </Flex>
      ) : isVideo && videoData ? (
        <Flex
          direction={{ base: "column", md: "row" }}
          gap={6}
          align={{ base: "stretch", md: "flex-start" }}
        >
          {/* 정보 영역 */}
          <Box
            order={{ base: 2, md: 2 }}
            flex={{ base: "none", md: "0 0 300px" }}
            bg={infoBg}
            rounded="xl"
            px={6}
            py={5}
            borderWidth="1px"
            borderColor={infoBorder}
            alignSelf="flex-start"
          >
            <Flex alignItems="center" gap={2} mb={4}>
              <Badge colorScheme="purple" fontSize="xs">
                Videos
              </Badge>
            </Flex>
            <Divider mb={4} />
            <VStack spacing={4} align="stretch">
              <InfoRow label="Title" value={sjmediaData?.title} />
              <InfoRow label="Description" value={sjmediaData?.description} />
              {sjmediaData?.sj_style_detail && (
                <Box>
                  <Text fontSize="xs" color="gray.400" fontWeight="semibold" mb={1}>SJ Style</Text>
                  <RouterLink to={`/sjstyles/${sjmediaData.sj_style_detail.pk}`}>
                    <Badge colorScheme="teal" cursor="pointer" _hover={{ opacity: 0.8 }}>
                      {sjmediaData.sj_style_detail.code} — {sjmediaData.sj_style_detail.style_name}
                    </Badge>
                  </RouterLink>
                </Box>
              )}
              <InfoRow label="Meta Data" value={videoData.description} />
              <InfoRow label="File" value={videoData.VideoFile} copyable />
              <QRCodeSection
                fileUrl={videoData.VideoFile}
                label={videoData.description || "video"}
              />
            </VStack>
            <ActionButtons />
          </Box>

          {/* 영상 */}
          <Box
            order={{ base: 1, md: 1 }}
            flex={2}
            display="flex"
            justifyContent="center"
            alignItems="flex-start"
          >
            <Box
              maxH="60vh"
              maxW={{ base: "100%", md: "60vw" }}
              w="100%"
              rounded="2xl"
              overflow="hidden"
              bg="black"
            >
              {videoData.VideoFile?.includes("cloudflarestream.com") ? (
                // Cloudflare Stream: 바로 iframe 재생
                <Box
                  w="100%"
                  sx={{ aspectRatio: "16 / 9" }}
                  position="relative"
                >
                  <iframe
                    title="Video player"
                    src={videoData.VideoFile}
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: "100%",
                      height: "100%",
                      border: "none"
                    }}
                    allow="autoplay; fullscreen; picture-in-picture"
                    allowFullScreen
                  />
                </Box>
              ) : videoData.VideoFile ? (
                // 일반 비디오 파일
                <video
                  src={videoData.VideoFile}
                  poster={videoData.ThumbnailFile || undefined}
                  controls
                  autoPlay
                  style={{ width: "100%", maxHeight: "80vh" }}
                />
              ) : (
                // 비디오 파일 없음 - 썸네일만
                <Image
                  src={videoData.ThumbnailFile}
                  fallbackSrc={`https://picsum.photos/seed/${videoData.pk}/800/600`}
                  alt={videoData.description}
                  w="100%"
                  maxH="80vh"
                  objectFit="contain"
                />
              )}
            </Box>
          </Box>
        </Flex>
      ) : (
        <Flex justifyContent="center" alignItems="center" h="50vh">
          <Text color="gray.400">Media not found</Text>
        </Flex>
      )}

      {/* 편집 모달 */}
      <Modal isOpen={isEditOpen} onClose={onEditClose} isCentered>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>{isPhoto ? "Photos Edit" : "Videos Edit"}</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack spacing={4}>
              {/* 공통: sjmedia Title, Related Style or Buyer */}
              <FormControl>
                <FormLabel fontSize="sm">Title</FormLabel>
                <Input
                  value={editSjmediaForm.title}
                  onChange={(e) =>
                    setEditSjmediaForm((f) => ({ ...f, title: e.target.value }))
                  }
                />
              </FormControl>
              <FormControl>
                <FormLabel fontSize="sm">SJ Style</FormLabel>
                <Box position="relative">
                  <Input
                    fontSize="sm"
                    value={selectedStyle
                      ? `${selectedStyle.code} — ${selectedStyle.style_name}`
                      : styleSearch}
                    onChange={(e) => {
                      setStyleSearch(e.target.value);
                      setSelectedStyle(null);
                      setShowStyleSuggestions(true);
                    }}
                    onFocus={() => setShowStyleSuggestions(true)}
                    onBlur={() => {
                      styleBlurTimer.current = setTimeout(
                        () => setShowStyleSuggestions(false),
                        150
                      );
                    }}
                    placeholder="Search SJ Style..."
                    autoComplete="off"
                  />
                  {showStyleSuggestions && styleSearch.length > 0 && !selectedStyle && (styleSearchData?.results ?? []).length > 0 && (
                    <List
                      position="absolute"
                      zIndex={20}
                      bg={suggestionBg}
                      border="1px solid"
                      borderColor={suggestionBorderColor}
                      borderRadius="md"
                      w="100%"
                      maxH="160px"
                      overflowY="auto"
                      boxShadow="md"
                      mt={1}
                    >
                      {(styleSearchData?.results ?? []).map((style) => (
                        <ListItem
                          key={style.pk}
                          px={3}
                          py={2}
                          cursor="pointer"
                          fontSize="sm"
                          _hover={{ bg: suggestionHoverBg }}
                          onMouseDown={() => {
                            if (styleBlurTimer.current) clearTimeout(styleBlurTimer.current);
                            setSelectedStyle(style);
                            setStyleSearch("");
                            setShowStyleSuggestions(false);
                          }}
                        >
                          <Text fontWeight="semibold" display="inline">{style.code}</Text>
                          <Text display="inline" color="gray.500"> — {style.style_name}</Text>
                        </ListItem>
                      ))}
                    </List>
                  )}
                </Box>
                {selectedStyle && (
                  <Button
                    size="xs"
                    mt={1}
                    variant="ghost"
                    colorScheme="gray"
                    onClick={() => {
                      setSelectedStyle(null);
                      setStyleSearch("");
                    }}
                  >
                    ✕ Clear
                  </Button>
                )}
              </FormControl>
              <FormControl>
                <FormLabel fontSize="sm">Related Style or Buyer</FormLabel>
                <Input
                  value={editSjmediaForm.description ?? ""}
                  onChange={(e) =>
                    setEditSjmediaForm((f) => ({
                      ...f,
                      description: e.target.value
                    }))
                  }
                />
              </FormControl>
              {/* Photo/Video 각각의 Meta Data */}
              {isPhoto ? (
                <FormControl>
                  <FormLabel fontSize="sm">Meta Data</FormLabel>
                  <Input
                    value={editPhotoForm.description}
                    onChange={(e) =>
                      setEditPhotoForm((f) => ({
                        ...f,
                        description: e.target.value
                      }))
                    }
                  />
                </FormControl>
              ) : (
                <FormControl>
                  <FormLabel fontSize="sm">Meta Data</FormLabel>
                  <Input
                    value={editVideoForm.description}
                    onChange={(e) =>
                      setEditVideoForm({ description: e.target.value })
                    }
                  />
                </FormControl>
              )}
            </VStack>
          </ModalBody>
          <ModalFooter gap={2}>
            <Button variant="ghost" onClick={onEditClose}>
              Cancel
            </Button>
            <Button
              colorScheme="blue"
              onClick={handleEdit}
              isLoading={isEditLoading}
            >
              Save
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* 삭제 확인 다이얼로그 */}
      <AlertDialog
        isOpen={isDeleteOpen}
        leastDestructiveRef={cancelRef}
        onClose={onDeleteClose}
        isCentered
      >
        <AlertDialogOverlay />
        <AlertDialogContent>
          <AlertDialogHeader fontSize="lg" fontWeight="bold">
            {isPhoto ? "Photos Delete" : "Videos Delete"}
          </AlertDialogHeader>
          <AlertDialogCloseButton />
          <AlertDialogBody>
            Are you sure? You can't undo this action afterwards.
          </AlertDialogBody>
          <AlertDialogFooter gap={2}>
            <Button ref={cancelRef} variant="ghost" onClick={onDeleteClose}>
              Cancel
            </Button>
            <Button
              colorScheme="red"
              onClick={handleDelete}
              isLoading={isDeleteLoading}
            >
              Delete
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Box>
  );
}
