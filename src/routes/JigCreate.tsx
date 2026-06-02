import {
  Box,
  Button,
  FormControl,
  FormErrorMessage,
  FormHelperText,
  FormLabel,
  Heading,
  Image,
  Input,
  Select,
  SimpleGrid,
  Text,
  Textarea,
  VStack,
  List,
  ListItem,
  useToast,
  useColorModeValue
} from "@chakra-ui/react";
import { useForm } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createJig,
  createJigPhoto,
  createJigVideo,
  getStorageLocations,
  getSjStyles,
  getUploadURL,
  getUploadVideoURL,
  uploadImage,
  uploadVideo,
  getVideoData,
  IStorageLocation,
  ISjStyle,
  ISjStyleListResponse,
} from "../api";
import { useNavigate, Link as RouterLink } from "react-router-dom";
import { useRef, useState } from "react";
import { FaArrowLeft } from "react-icons/fa";
import { useTranslation } from "react-i18next";

interface IFormValues {
  name: string;
  serial_number: string;
  description?: string;
  buyer?: string;
  shape?: string;
  size?: string;
  material?: string;
  status?: string;
  location?: string;
}

interface IUploadURLResponse {
  id: string;
  uploadURL: string;
}

export default function JigCreate() {
  const { t } = useTranslation();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors }
  } = useForm<IFormValues>({ mode: "onSubmit" });

  const toast = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // 선택된 사진 파일 목록
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [isUploadingPhotos, setIsUploadingPhotos] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 선택된 비디오 파일 목록
  const [selectedVideoFiles, setSelectedVideoFiles] = useState<File[]>([]);
  const [isUploadingVideos, setIsUploadingVideos] = useState(false);
  const videoFileRef = useRef<HTMLInputElement>(null);

  const { data: locations = [] } = useQuery<IStorageLocation[]>({
    queryKey: ["storage-locations"],
    queryFn: getStorageLocations
  });

  // SjStyle 검색
  const [styleSearch, setStyleSearch] = useState("");
  const [selectedStyle, setSelectedStyle] = useState<ISjStyle | null>(null);
  const [showStyleSuggestions, setShowStyleSuggestions] = useState(false);
  const styleBlurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: styleSearchData } = useQuery<ISjStyleListResponse>({
    queryKey: ["sjStyleSearch", styleSearch],
    queryFn: () => getSjStyles({ search: styleSearch, page: 1 }),
    enabled: styleSearch.length > 0 && !selectedStyle,
  });
  const styleSuggestions: ISjStyle[] = styleSearchData?.results ?? [];

  const handleSelectStyle = (style: ISjStyle) => {
    setSelectedStyle(style);
    setStyleSearch(style.code);
    setShowStyleSuggestions(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    setSelectedFiles((prev) => [...prev, ...files]);
    const newPreviews = files.map((f) => URL.createObjectURL(f));
    setPreviews((prev) => [...prev, ...newPreviews]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
    setPreviews((prev) => {
      URL.revokeObjectURL(prev[index]);
      return prev.filter((_, i) => i !== index);
    });
  };

  const handleVideoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    setSelectedVideoFiles((prev) => [...prev, ...files]);
    if (videoFileRef.current) videoFileRef.current.value = "";
  };

  const removeVideoFile = (index: number) => {
    setSelectedVideoFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const uploadOneVideo = async (file: File, jigId: string) => {
    const urlData: IUploadURLResponse = await getUploadVideoURL();
    const fileList = (() => {
      const dt = new DataTransfer();
      dt.items.add(file);
      return dt.files;
    })();
    await uploadVideo({ file: fileList, uploadURL: urlData.uploadURL });
    const videoData: any = await getVideoData(urlData.id);
    const thumbnailURL = videoData.thumbnail;
    const videoURL = `https://customer-kc2gx0yn68qxte35.cloudflarestream.com/${videoData.uid}/iframe`;
    await createJigVideo({ VideoFile: videoURL, ThumbnailFile: thumbnailURL, jigId });
  };

  const uploadOnePhoto = async (file: File, jigId: string, description: string) => {
    const urlData: IUploadURLResponse = await getUploadURL();
    const fileList = (() => {
      const dt = new DataTransfer();
      dt.items.add(file);
      return dt.files;
    })();
    const cfResult: any = await uploadImage({ file: fileList, uploadURL: urlData.uploadURL });
    const cfUrl = `https://imagedelivery.net/mzmXhxWLR9jzdX8u9g4BBQ/${cfResult.result.id}/public`;
    await createJigPhoto({ file: cfUrl, jigId, description });
  };

  const mutation = useMutation({
    mutationFn: createJig,
    onSuccess: async (data: { id?: string; name?: string }) => {
      queryClient.invalidateQueries({ queryKey: ["jigs"] });
      const jigId = data?.id;

      if (jigId && selectedFiles.length > 0) {
        setIsUploadingPhotos(true);
        try {
          for (const file of selectedFiles) {
            await uploadOnePhoto(file, jigId, data.name ?? "");
          }
          queryClient.invalidateQueries({ queryKey: ["jigPhotos", jigId] });
        } catch {
          toast({
            title: t("jigCreate.photosFailed"),
            status: "warning",
            duration: 3000,
            isClosable: true,
            position: "bottom-right"
          });
        } finally {
          setIsUploadingPhotos(false);
        }
      }

      if (jigId && selectedVideoFiles.length > 0) {
        setIsUploadingVideos(true);
        try {
          for (const file of selectedVideoFiles) {
            await uploadOneVideo(file, jigId);
          }
          queryClient.invalidateQueries({ queryKey: ["jigVideos", jigId] });
        } catch {
          toast({
            title: t("jigCreate.videosFailed"),
            status: "warning",
            duration: 3000,
            isClosable: true,
            position: "bottom-right"
          });
        } finally {
          setIsUploadingVideos(false);
        }
      }

      toast({
        title: t("jigCreate.created"),
        status: "success",
        duration: 2000,
        isClosable: true,
        position: "bottom-right"
      });

      if (jigId) navigate(`/jigs/${jigId}`);
      else navigate("/jigs");
    },
    onError: (error: any) => {
      const data = error?.response?.data;
      // serial_number 중복 에러 처리
      if (data?.serial_number) {
        const msg = Array.isArray(data.serial_number)
          ? data.serial_number[0]
          : data.serial_number;
        setError("serial_number", { message: msg });
        toast({
          title: t("jigCreate.createFailed"),
          description: msg,
          status: "error",
          duration: 4000,
          isClosable: true,
          position: "bottom-right"
        });
        return;
      }
      // 기타 필드 에러
      const firstMsg = data
        ? Object.values(data).flat().join(" / ")
        : t("jigCreate.error");
      toast({
        title: t("jigCreate.createFailed"),
        description: firstMsg,
        status: "error",
        duration: 4000,
        isClosable: true,
        position: "bottom-right"
      });
    }
  });

  const onSubmit = (data: IFormValues) => {
    mutation.mutate({
      name: data.name,
      serial_number: data.serial_number,
      description: data.description || "",
      buyer: data.buyer || "",
      shape: data.shape || "",
      size: data.size || "",
      material: data.material || "",
      status: data.status || "",
      location: data.location ? Number(data.location) : undefined,
      sj_style: selectedStyle ? selectedStyle.pk : null,
    });
  };

  const isLoading = mutation.isPending || isUploadingPhotos || isUploadingVideos;
  const pageBg = useColorModeValue("gray.50", "gray.900");
  const cardBg = useColorModeValue("white", "gray.800");
  const suggestionBg = useColorModeValue("white", "gray.700");
  const suggestionHoverBg = useColorModeValue("blue.50", "gray.600");
  const suggestionBorderColor = useColorModeValue("gray.200", "gray.600");

  return (
    <Box bg={pageBg} minW="100%" minH="100%" px={{ base: 4, md: 8 }} py={{ base: 6, md: 8 }}>
    <Box maxW={{ base: "3xl", lg: "2xl" }} mx="auto" bg={cardBg} borderRadius="lg" p={{ base: 4, md: 6 }} boxShadow="sm">
      <Button as={RouterLink} to="/jigs" leftIcon={<FaArrowLeft />} variant="ghost" size="sm" mb={4}>
        {t("jigCreate.backToList")}
      </Button>

      <Heading size="md" mb={6}>{t("jigCreate.title")}</Heading>

      <VStack as="form" spacing={4} align="stretch" onSubmit={handleSubmit(onSubmit)}>
        <FormControl isInvalid={!!errors.name} isRequired>
          <FormLabel>{t("jigCreate.name")}</FormLabel>
          <Input {...register("name", { required: t("jigCreate.nameRequired") })} placeholder={t("jigCreate.namePlaceholder")} size="sm" />
        </FormControl>

        <FormControl isInvalid={!!errors.serial_number} isRequired>
          <FormLabel>{t("jigCreate.serialNumber")}</FormLabel>
          <Input {...register("serial_number", { required: t("jigCreate.serialRequired") })} placeholder={t("jigCreate.serialPlaceholder")} size="sm" />
          {errors.serial_number ? (
            <FormErrorMessage>{errors.serial_number.message}</FormErrorMessage>
          ) : (
            <FormHelperText>{t("jigCreate.serialHelper")}</FormHelperText>
          )}
        </FormControl>

        <FormControl isRequired>
          <FormLabel>{t("jigCreate.buyer")}</FormLabel>
          <Input {...register("buyer")} placeholder={t("jigCreate.buyerPlaceholder")} size="sm" />
        </FormControl>

        <FormControl isRequired>
          <FormLabel>{t("jigCreate.shape")}</FormLabel>
          <Select {...register("shape")} size="sm">
            <option value="">{t("jigCreate.selectShape")}</option>
            <option value="bar">{t("jigCreate.shapeBar")}</option>
            <option value="square">{t("jigCreate.shapeSquare")}</option>
            <option value="platen">{t("jigCreate.shapePlaten")}</option>
            <option value="other">{t("jigCreate.shapeOther")}</option>
          </Select>
        </FormControl>

        <FormControl isRequired>
          <FormLabel>{t("jigCreate.material")}</FormLabel>
          <Select {...register("material")} size="sm">
            <option value="">{t("jigCreate.selectMaterial")}</option>
            <option value="plastic">{t("jigCreate.materialPlastic")}</option>
            <option value="aluminum">{t("jigCreate.materialAluminum")}</option>
            <option value="Silicon">{t("jigCreate.materialSilicon")}</option>
            <option value="wood">{t("jigCreate.materialWood")}</option>
            <option value="other">{t("jigCreate.materialOther")}</option>
          </Select>
        </FormControl>

        <FormControl isRequired>
          <FormLabel>{t("jigCreate.size")}</FormLabel>
          <Input {...register("size")} placeholder={t("jigCreate.sizePlaceholder")} size="sm" />
        </FormControl>

        <FormControl isRequired>
          <FormLabel>{t("jigCreate.status")}</FormLabel>
          <Select {...register("status")} size="sm">
            <option value="">{t("jigCreate.selectStatus")}</option>
            <option value="in_use">{t("jigCreate.statusInUse")}</option>
            <option value="obsolete">{t("jigCreate.statusObsolete")}</option>
            <option value="removed">{t("jigCreate.statusRemoved")}</option>
            <option value="lost">{t("jigCreate.statusLost")}</option>
          </Select>
        </FormControl>

        <FormControl>
          <FormLabel>{t("jigCreate.description")}</FormLabel>
          <Textarea {...register("description")} placeholder={t("jigCreate.descriptionPlaceholder")} size="sm" rows={3} />
        </FormControl>

        <FormControl>
          <FormLabel>{t("jigCreate.location")}</FormLabel>
          <Select {...register("location")} size="sm">
            <option value="">{t("jigCreate.location")}</option>
            {locations.map((loc) => (
              <option key={loc.id} value={loc.id}>
                {loc.code}{loc.description ? ` — ${loc.description}` : ""}
              </option>
            ))}
          </Select>
        </FormControl>

        {/* SJ Style 검색 */}
        <FormControl>
          <FormLabel>SJ Style</FormLabel>
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
                      handleSelectStyle(s);
                    }}
                  >
                    <Text fontSize="sm" fontWeight="semibold">{s.code}</Text>
                    {s.style_name && <Text fontSize="xs" color="gray.500">{s.style_name}</Text>}
                  </ListItem>
                ))}
              </List>
            )}
          </Box>
          {selectedStyle && (
            <Text fontSize="xs" color="blue.500" mt={1}>
              선택됨: {selectedStyle.code} — {selectedStyle.style_name}
            </Text>
          )}
          {styleSearch && !selectedStyle && (
            <Text fontSize="xs" color="gray.400" mt={1}>
              목록에서 선택해 주세요.
            </Text>
          )}
        </FormControl>

        {/* 사진 업로드 */}
        <FormControl>
          <FormLabel>{t("jigCreate.photos")}</FormLabel>
          <Input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            size="sm"
            onChange={handleFileChange}
          />
          <FormHelperText>{t("jigCreate.photosHelper")}</FormHelperText>
        </FormControl>

        {/* 선택된 사진 미리보기 */}
        {previews.length > 0 && (
          <SimpleGrid columns={4} spacing={2}>
            {previews.map((src, i) => (
              <Box key={i} position="relative">
                <Image
                  src={src}
                  alt={`preview-${i}`}
                  boxSize="70px"
                  objectFit="cover"
                  borderRadius="md"
                />
                <Button
                  size="xs"
                  position="absolute"
                  top="-1"
                  right="-1"
                  borderRadius="full"
                  colorScheme="red"
                  onClick={() => removeFile(i)}
                  minW="18px"
                  h="18px"
                  p={0}
                  fontSize="10px"
                >
                  ✕
                </Button>
              </Box>
            ))}
          </SimpleGrid>
        )}

        {/* 비디오 업로드 */}
        <FormControl>
          <FormLabel>{t("jigCreate.videos")}</FormLabel>
          <Input
            ref={videoFileRef}
            type="file"
            accept="video/*"
            multiple
            size="sm"
            onChange={handleVideoFileChange}
          />
          <FormHelperText>{t("jigCreate.videosHelper")}</FormHelperText>
        </FormControl>

        {/* 선택된 비디오 목록 */}
        {selectedVideoFiles.length > 0 && (
          <Box>
            {selectedVideoFiles.map((file, i) => (
              <Box
                key={i}
                display="flex"
                alignItems="center"
                justifyContent="space-between"
                bg="gray.50"
                _dark={{ bg: "gray.700" }}
                borderRadius="md"
                px={3}
                py={1}
                mb={1}
              >
                <Text fontSize="xs" noOfLines={1} flex={1} mr={2}>
                  {file.name}
                </Text>
                <Button
                  size="xs"
                  colorScheme="red"
                  variant="ghost"
                  onClick={() => removeVideoFile(i)}
                  minW="18px"
                  h="18px"
                  p={0}
                  fontSize="10px"
                >
                  ✕
                </Button>
              </Box>
            ))}
          </Box>
        )}

        {mutation.isError && (
          <Text color="red.500">{t("jigCreate.error")}</Text>
        )}

        <Button
          type="submit"
          colorScheme="blue"
          size="sm"
          isLoading={isLoading}
          loadingText={isUploadingVideos ? t("jigCreate.uploadingVideos") : isUploadingPhotos ? t("jigCreate.uploadingPhotos") : t("jigCreate.creating")}
        >
          {t("jigCreate.createBtn")}
        </Button>
      </VStack>
    </Box>
    </Box>
  );
}
