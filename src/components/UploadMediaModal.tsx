import {
  Box,
  Button,
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
  ModalHeader,
  ModalOverlay,
  Tab,
  TabList,
  TabPanel,
  TabPanels,
  Tabs,
  Text,
  Textarea,
  VStack,
  useColorModeValue,
  useToast
} from "@chakra-ui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChangeEvent, DragEvent, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { FaCloudUploadAlt, FaImage, FaVideo } from "react-icons/fa";
import {
  createSjmedia,
  createSjmediaPhoto,
  createSjmediaVideo,
  getSjStyles,
  getUploadURL,
  getUploadVideoURL,
  getVideoData,
  ISjStyle,
  ISjStyleListResponse,
  uploadImage,
  uploadVideo
} from "../api";

interface IPhotoForm {
  photo: FileList;
  title: string;
  sjmediaDescription: string;
  description: string;
}

interface IVideoForm {
  file: FileList;
  title: string;
  sjmediaDescription: string;
  description: string;
}

interface IUploadURLResponse {
  id: string;
  uploadURL: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: "photo" | "video";
}

// 드래그 앤 드롭 존 컴포넌트
function DropZone({
  accept,
  onFile,
  label
}: {
  accept: string;
  onFile: (file: File) => void;
  label: string;
}) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const borderColor = useColorModeValue("gray.300", "gray.600");
  const dragBg = useColorModeValue("blue.50", "blue.900");
  const iconColor = useColorModeValue("gray.400", "gray.500");

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) onFile(file);
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onFile(file);
  };

  return (
    <Box
      w="100%"
      border="2px dashed"
      borderColor={isDragging ? "blue.400" : borderColor}
      bg={isDragging ? dragBg : "transparent"}
      rounded="xl"
      p={6}
      textAlign="center"
      cursor="pointer"
      transition="all 0.2s"
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        style={{ display: "none" }}
        onChange={handleChange}
      />
      <Box
        color={isDragging ? "blue.400" : iconColor}
        mb={2}
        display="flex"
        justifyContent="center"
      >
        <FaCloudUploadAlt size={36} />
      </Box>
      <Text fontWeight="medium" fontSize="sm">
        {label}
      </Text>
      <Text fontSize="xs" color="gray.400" mt={1}>
        or click to select a file
      </Text>
    </Box>
  );
}

// 업로드 모달 컴포넌트
export default function UploadMediaModal({
  isOpen,
  onClose,
  defaultTab = "photo"
}: Props) {
  const { t } = useTranslation();
  const toast = useToast();
  const queryClient = useQueryClient();
  const suggestionBg = useColorModeValue("white", "gray.700");
  const suggestionHoverBg = useColorModeValue("gray.100", "gray.600");
  const suggestionBorderColor = useColorModeValue("gray.200", "gray.600");

  // ── SjStyle 검색 (Photo) ───────────────────────────────────
  const [photoStyleSearch, setPhotoStyleSearch] = useState("");
  const [selectedPhotoStyle, setSelectedPhotoStyle] = useState<ISjStyle | null>(null);
  const [showPhotoStyleSuggestions, setShowPhotoStyleSuggestions] = useState(false);
  const photoStyleBlurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: photoStyleData } = useQuery<ISjStyleListResponse>({
    queryKey: ["sjStylesForUpload", "photo", photoStyleSearch],
    queryFn: () => getSjStyles({ search: photoStyleSearch, page: 1 }),
    enabled: photoStyleSearch.length > 0 && !selectedPhotoStyle
  });

  // ── SjStyle 검색 (Video) ───────────────────────────────────
  const [videoStyleSearch, setVideoStyleSearch] = useState("");
  const [selectedVideoStyle, setSelectedVideoStyle] = useState<ISjStyle | null>(null);
  const [showVideoStyleSuggestions, setShowVideoStyleSuggestions] = useState(false);
  const videoStyleBlurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: videoStyleData } = useQuery<ISjStyleListResponse>({
    queryKey: ["sjStylesForUpload", "video", videoStyleSearch],
    queryFn: () => getSjStyles({ search: videoStyleSearch, page: 1 }),
    enabled: videoStyleSearch.length > 0 && !selectedVideoStyle
  });

  // Photo 상태
  const {
    register: regPhoto,
    handleSubmit: handlePhoto,
    watch: watchPhoto,
    reset: resetPhoto,
    setValue: setPhotoValue
  } = useForm<IPhotoForm>();
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [, setPhotoFile] = useState<File | null>(null);
  // Cloudflare 업로드 후 임시 저장
  const [uploadedFileUrl, setUploadedFileUrl] = useState("");

  // Photo File 선택
  const handlePhotoFile = (file: File) => {
    setPhotoFile(file);
    setPreviewImage(URL.createObjectURL(file));
    const dt = new DataTransfer();
    dt.items.add(file);
    setPhotoValue("photo", dt.files);
  };

  const resetPhotoState = () => {
    resetPhoto();
    setPreviewImage(null);
    setPhotoFile(null);
    setUploadedFileUrl("");
    setPhotoStyleSearch("");
    setSelectedPhotoStyle(null);
  };

  // 3단계: Sjmedia에 Photo 등록
  const createSjmediaPhotoMutation = useMutation({
    mutationFn: ({
      sjmediaPk,
      fileUrl,
      title,
      description
    }: {
      sjmediaPk: string;
      fileUrl: string;
      title: string;
      description: string;
    }) =>
      createSjmediaPhoto(sjmediaPk, {
        file: fileUrl,
        name: title,
        description
      }),
    onSuccess: () => {
      toast({
        status: "success",
        description: t("uploadMedia.photoSuccess"),
        isClosable: true
      });
      queryClient.invalidateQueries({ queryKey: ["photos"] });
      resetPhotoState();
      onClose();
    }
  });

  // 2단계: Sjmedia 생성 (title + sjmediaDescription → description)
  const createSjmediaMutation = useMutation({
    mutationFn: ({
      title,
      description,
      sj_style
    }: {
      title: string;
      description: string;
      sj_style?: number | null;
    }) => createSjmedia({ title, description, sj_style }),
    onSuccess: (data: any) => {
      createSjmediaPhotoMutation.mutate({
        sjmediaPk: String(data.pk),
        fileUrl: uploadedFileUrl,
        title: watchPhoto("title") || "Untitled",
        description: watchPhoto("description") || ""
      });
    }
  });

  // 1단계: Cloudflare에 이미지 업로드
  const uploadImageMutation = useMutation({
    mutationFn: uploadImage,
    onSuccess: ({ result }: any) => {
      const fileUrl = `https://imagedelivery.net/mzmXhxWLR9jzdX8u9g4BBQ/${result.id}/public`;
      setUploadedFileUrl(fileUrl);
      createSjmediaMutation.mutate({
        title: watchPhoto("title") || "Untitled",
        description: watchPhoto("sjmediaDescription") || "",
        sj_style: selectedPhotoStyle ? selectedPhotoStyle.pk : null
      });
    }
  });

  // 0단계: 업로드 URL 취득
  const getUploadURLMutation = useMutation({
    mutationFn: getUploadURL,
    onSuccess: (data: IUploadURLResponse) => {
      uploadImageMutation.mutate({
        file: watchPhoto("photo"),
        uploadURL: data.uploadURL
      });
    }
  });

  // Photo 업로드 제출
  const onPhotoSubmit = () => getUploadURLMutation.mutate();

  // Video 상태
  const {
    register: regVideo,
    handleSubmit: handleVideo,
    watch: watchVideo,
    reset: resetVideo,
    setValue: setVideoValue
  } = useForm<IVideoForm>();
  const [previewVideo, setPreviewVideo] = useState<string | null>(null);
  const [videoUid, setVideoUid] = useState("");
  const [uploadedVideoData, setUploadedVideoData] = useState<{
    VideoFile: string;
    ThumbnailFile: string;
  } | null>(null);

  // Video File 선택
  const handleVideoFile = (file: File) => {
    if (file.size > 200 * 1024 * 1024) {
      toast({
        title: "File too large.",
        description: "Video files must be 200MB or less.",
        status: "error",
        duration: 3000,
        position: "top"
      });
      return;
    }
    setPreviewVideo(URL.createObjectURL(file));
    const dt = new DataTransfer();
    dt.items.add(file);
    setVideoValue("file", dt.files);
  };

  const resetVideoState = () => {
    resetVideo();
    setPreviewVideo(null);
    setUploadedVideoData(null);
    setVideoStyleSearch("");
    setSelectedVideoStyle(null);
  };

  // 5단계: Sjmedia에 Video 등록
  const createSjmediaVideoMutation = useMutation({
    mutationFn: ({
      sjmediaPk,
      VideoFile,
      ThumbnailFile,
      description
    }: {
      sjmediaPk: string;
      VideoFile: string;
      ThumbnailFile: string;
      description: string;
    }) =>
      createSjmediaVideo(sjmediaPk, { VideoFile, ThumbnailFile, description }),
    onSuccess: () => {
      toast({
        status: "success",
        description: t("uploadMedia.videoSuccess"),
        isClosable: true
      });
      queryClient.invalidateQueries({ queryKey: ["videos"] });
      resetVideoState();
      onClose();
    }
  });

  // 4단계: Sjmedia 생성 (video용)
  const createSjmediaForVideoMutation = useMutation({
    mutationFn: ({
      title,
      description,
      sj_style
    }: {
      title: string;
      description: string;
      sj_style?: number | null;
    }) => createSjmedia({ title, description, sj_style }),
    onSuccess: (data: any) => {
      if (uploadedVideoData) {
        createSjmediaVideoMutation.mutate({
          sjmediaPk: String(data.pk),
          VideoFile: uploadedVideoData.VideoFile,
          ThumbnailFile: uploadedVideoData.ThumbnailFile,
          description: watchVideo("description") || ""
        });
      }
    }
  });

  // 3단계: Video 데이터 가져오기
  const getVideoDataMutation = useMutation({
    mutationFn: getVideoData,
    onSuccess: (data: any) => {
      const VideoFile = `https://customer-kc2gx0yn68qxte35.cloudflarestream.com/${data.uid}/iframe`;
      const ThumbnailFile = data.thumbnail;
      setUploadedVideoData({ VideoFile, ThumbnailFile });
      createSjmediaForVideoMutation.mutate({
        title: watchVideo("title") || "Untitled",
        description: watchVideo("sjmediaDescription") || "",
        sj_style: selectedVideoStyle ? selectedVideoStyle.pk : null
      });
      console.log("video data uploaded", data);
    }
  });

  // 2단계: Video 업로드
  const uploadVideoMutation = useMutation({
    mutationFn: uploadVideo,
    onSuccess: () => getVideoDataMutation.mutate(videoUid)
  });

  // 1단계: Video 업로드 URL 가져오기
  const getUploadVideoURLMutation = useMutation({
    mutationFn: getUploadVideoURL,
    onSuccess: (data: IUploadURLResponse) => {
      setVideoUid(data.id);
      uploadVideoMutation.mutate({
        file: watchVideo("file"),
        uploadURL: data.uploadURL
      });
      console.log("data.uploadURL", data.uploadURL);
    }
  });

  // Video 업로드 제출
  const onVideoSubmit = () => getUploadVideoURLMutation.mutate();

  // Photo 로딩 상태
  const isPhotoLoading =
    getUploadURLMutation.isPending ||
    uploadImageMutation.isPending ||
    createSjmediaMutation.isPending ||
    createSjmediaPhotoMutation.isPending;

  // Video 로딩 상태
  const isVideoLoading =
    getUploadVideoURLMutation.isPending ||
    uploadVideoMutation.isPending ||
    getVideoDataMutation.isPending ||
    createSjmediaForVideoMutation.isPending ||
    createSjmediaVideoMutation.isPending;

  return (
    // 업로드 모달 컴포넌트
    <Modal isOpen={isOpen} onClose={onClose} size="lg" isCentered>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>{t("uploadMedia.title")}</ModalHeader>
        <ModalCloseButton />
        <ModalBody pb={6}>
          <Tabs
            isFitted
            variant="enclosed"
            defaultIndex={defaultTab === "video" ? 1 : 0}
          >
            <TabList mb={4}>
              <Tab gap={2}>
                <FaImage />
                {t("uploadMedia.tabPhoto")}
              </Tab>
              <Tab gap={2}>
                <FaVideo />
                {t("uploadMedia.tabVideo")}
              </Tab>
            </TabList>
            <TabPanels>
              {/* ── 사진 탭 ── */}
              <TabPanel px={0}>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handlePhoto(onPhotoSubmit)(e);
                  }}
                >
                  <VStack spacing={4}>
                    {previewImage ? (
                      <Box position="relative" display="inline-block" w="100%">
                        <Image
                          src={previewImage}
                          rounded="xl"
                          w="100%"
                          maxH="220px"
                          objectFit="cover"
                        />
                        <Button
                          size="xs"
                          position="absolute"
                          top="-2"
                          right="-2"
                          rounded="full"
                          bg="blackAlpha.700"
                          color="white"
                          _hover={{ bg: "blackAlpha.900" }}
                          onClick={() => {
                            setPreviewImage(null);
                            setPhotoFile(null);
                            resetPhoto();
                          }}
                        >
                          ✕
                        </Button>
                      </Box>
                    ) : (
                      <DropZone
                        accept="image/*"
                        onFile={handlePhotoFile}
                        label={t("uploadMedia.dragPhoto")}
                      />
                    )}
                    {/* hidden input for react-hook-form */}
                    <Input
                      {...regPhoto("photo")}
                      type="file"
                      accept="image/*"
                      display="none"
                    />
                    <FormControl isRequired>
                      <FormLabel>Title</FormLabel>
                      <Input {...regPhoto("title")} placeholder="Photo title" />
                    </FormControl>
                    <FormControl>
                      <FormLabel>SJ Style</FormLabel>
                      <Box position="relative">
                        <Input
                          value={selectedPhotoStyle
                            ? `${selectedPhotoStyle.code} — ${selectedPhotoStyle.style_name}`
                            : photoStyleSearch}
                          onChange={(e) => {
                            setPhotoStyleSearch(e.target.value);
                            setSelectedPhotoStyle(null);
                            setShowPhotoStyleSuggestions(true);
                          }}
                          onFocus={() => setShowPhotoStyleSuggestions(true)}
                          onBlur={() => {
                            photoStyleBlurTimer.current = setTimeout(
                              () => setShowPhotoStyleSuggestions(false),
                              150
                            );
                          }}
                          placeholder="Search SJ Style..."
                          autoComplete="off"
                        />
                        {showPhotoStyleSuggestions && photoStyleSearch.length > 0 && !selectedPhotoStyle && (photoStyleData?.results ?? []).length > 0 && (
                          <List
                            position="absolute"
                            zIndex={20}
                            bg={suggestionBg}
                            border="1px solid"
                            borderColor={suggestionBorderColor}
                            borderRadius="md"
                            w="100%"
                            maxH="180px"
                            overflowY="auto"
                            boxShadow="md"
                            mt={1}
                          >
                            {(photoStyleData?.results ?? []).map((style) => (
                              <ListItem
                                key={style.pk}
                                px={3}
                                py={2}
                                cursor="pointer"
                                fontSize="sm"
                                _hover={{ bg: suggestionHoverBg }}
                                onMouseDown={() => {
                                  if (photoStyleBlurTimer.current) clearTimeout(photoStyleBlurTimer.current);
                                  setSelectedPhotoStyle(style);
                                  setPhotoStyleSearch("");
                                  setShowPhotoStyleSuggestions(false);
                                }}
                              >
                                <Text fontWeight="semibold" display="inline">{style.code}</Text>
                                <Text display="inline" color="gray.500"> — {style.style_name}</Text>
                              </ListItem>
                            ))}
                          </List>
                        )}
                      </Box>
                      {selectedPhotoStyle && (
                        <Button
                          size="xs"
                          mt={1}
                          variant="ghost"
                          colorScheme="gray"
                          onClick={() => {
                            setSelectedPhotoStyle(null);
                            setPhotoStyleSearch("");
                          }}
                        >
                          ✕ Clear
                        </Button>
                      )}
                    </FormControl>
                    <FormControl isRequired>
                      <FormLabel>
                        {t("uploadMedia.relatedStyleOrBuyer")}
                      </FormLabel>
                      <Input
                        {...regPhoto("sjmediaDescription")}
                        placeholder={t(
                          "uploadMedia.relatedStyleOrBuyerPlaceholder"
                        )}
                      />
                    </FormControl>
                    <FormControl isRequired>
                      <FormLabel>{t("uploadMedia.metaData")}</FormLabel>
                      <Textarea
                        {...regPhoto("description")}
                        placeholder={t("uploadMedia.metaDataPlaceholder")}
                        rows={3}
                      />
                    </FormControl>
                    <Button
                      type="submit"
                      colorScheme="blue"
                      w="full"
                      isLoading={isPhotoLoading}
                      isDisabled={
                        !previewImage ||
                        !watchPhoto("title") ||
                        !watchPhoto("sjmediaDescription") ||
                        !watchPhoto("description")
                      }
                    >
                      {t("uploadMedia.uploadButton")}
                    </Button>
                  </VStack>
                </form>
              </TabPanel>

              {/* ── 비디오 탭 ── */}
              <TabPanel px={0}>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleVideo(onVideoSubmit)(e);
                  }}
                >
                  <VStack spacing={4}>
                    {previewVideo ? (
                      <Box position="relative" display="inline-block" w="100%">
                        <video
                          src={previewVideo}
                          controls
                          style={{
                            width: "100%",
                            borderRadius: "12px",
                            maxHeight: "220px"
                          }}
                        />
                        <Button
                          size="xs"
                          position="absolute"
                          top="-2"
                          right="-2"
                          rounded="full"
                          bg="blackAlpha.700"
                          color="white"
                          _hover={{ bg: "blackAlpha.900" }}
                          onClick={() => {
                            setPreviewVideo(null);
                            resetVideo();
                          }}
                        >
                          ✕
                        </Button>
                      </Box>
                    ) : (
                      <DropZone
                        accept="video/*"
                        onFile={handleVideoFile}
                        label={t("uploadMedia.dragVideo")}
                      />
                    )}
                    <Text fontSize="xs" color="red.400" alignSelf="flex-start">
                      * Video files must be 200MB or less.
                    </Text>
                    <Input
                      {...regVideo("file")}
                      type="file"
                      accept="video/*"
                      display="none"
                    />
                    <FormControl isRequired>
                      <FormLabel>Title</FormLabel>
                      <Input {...regVideo("title")} placeholder="Video title" />
                    </FormControl>
                    <FormControl>
                      <FormLabel>SJ Style</FormLabel>
                      <Box position="relative">
                        <Input
                          value={selectedVideoStyle
                            ? `${selectedVideoStyle.code} — ${selectedVideoStyle.style_name}`
                            : videoStyleSearch}
                          onChange={(e) => {
                            setVideoStyleSearch(e.target.value);
                            setSelectedVideoStyle(null);
                            setShowVideoStyleSuggestions(true);
                          }}
                          onFocus={() => setShowVideoStyleSuggestions(true)}
                          onBlur={() => {
                            videoStyleBlurTimer.current = setTimeout(
                              () => setShowVideoStyleSuggestions(false),
                              150
                            );
                          }}
                          placeholder="Search SJ Style..."
                          autoComplete="off"
                        />
                        {showVideoStyleSuggestions && videoStyleSearch.length > 0 && !selectedVideoStyle && (videoStyleData?.results ?? []).length > 0 && (
                          <List
                            position="absolute"
                            zIndex={20}
                            bg={suggestionBg}
                            border="1px solid"
                            borderColor={suggestionBorderColor}
                            borderRadius="md"
                            w="100%"
                            maxH="180px"
                            overflowY="auto"
                            boxShadow="md"
                            mt={1}
                          >
                            {(videoStyleData?.results ?? []).map((style) => (
                              <ListItem
                                key={style.pk}
                                px={3}
                                py={2}
                                cursor="pointer"
                                fontSize="sm"
                                _hover={{ bg: suggestionHoverBg }}
                                onMouseDown={() => {
                                  if (videoStyleBlurTimer.current) clearTimeout(videoStyleBlurTimer.current);
                                  setSelectedVideoStyle(style);
                                  setVideoStyleSearch("");
                                  setShowVideoStyleSuggestions(false);
                                }}
                              >
                                <Text fontWeight="semibold" display="inline">{style.code}</Text>
                                <Text display="inline" color="gray.500"> — {style.style_name}</Text>
                              </ListItem>
                            ))}
                          </List>
                        )}
                      </Box>
                      {selectedVideoStyle && (
                        <Button
                          size="xs"
                          mt={1}
                          variant="ghost"
                          colorScheme="gray"
                          onClick={() => {
                            setSelectedVideoStyle(null);
                            setVideoStyleSearch("");
                          }}
                        >
                          ✕ Clear
                        </Button>
                      )}
                    </FormControl>
                    <FormControl isRequired>
                      <FormLabel>
                        {t("uploadMedia.relatedStyleOrBuyer")}
                      </FormLabel>
                      <Input
                        {...regVideo("sjmediaDescription")}
                        placeholder={t(
                          "uploadMedia.relatedStyleOrBuyerPlaceholder"
                        )}
                      />
                    </FormControl>
                    <FormControl isRequired>
                      <FormLabel>{t("uploadMedia.metaData")}</FormLabel>
                      <Textarea
                        {...regVideo("description")}
                        placeholder={t("uploadMedia.metaDataPlaceholder")}
                        rows={3}
                      />
                    </FormControl>
                    <Button
                      type="submit"
                      colorScheme="teal"
                      w="full"
                      isLoading={isVideoLoading}
                      isDisabled={
                        !previewVideo ||
                        !watchVideo("title") ||
                        !watchVideo("sjmediaDescription") ||
                        !watchVideo("description")
                      }
                    >
                      {t("uploadMedia.uploadButton")}
                    </Button>
                  </VStack>
                </form>
              </TabPanel>
            </TabPanels>
          </Tabs>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}
