import {
  AlertDialog,
  AlertDialogBody,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogOverlay,
  AspectRatio,
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
  Link,
  List,
  ListItem,
  Modal,
  ModalContent,
  ModalOverlay,
  Spinner,
  Text,
  Textarea,
  useColorModeValue,
  useDisclosure,
  useToast,
} from "@chakra-ui/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Helmet } from "react-helmet";
import { useParams, useNavigate, Link as RouterLink } from "react-router-dom";
import { useRef, useState } from "react";
import { FaArrowLeft, FaCamera, FaEdit, FaExternalLinkAlt, FaTrash, FaTrashAlt, FaVideo } from "react-icons/fa";
import {
  getProcessDetail,
  editProcess,
  deleteProcess,
  getModules,
  getMachines,
  createProcessPhoto,
  deleteProcessPhoto,
  createProcessVideo,
  deleteProcessVideo,
  getUploadURL,
  getUploadVideoURL,
  uploadImage,
  uploadVideo,
  getVideoData,
  IProcess,
  IModuleListResponse,
  IMachineListResponse,
} from "../api";

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

export default function SjProcessDetail() {
  const { processId } = useParams<{ processId: string }>();
  const pk = Number(processId);
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();

  const cardBg = useColorModeValue("white", "gray.800");
  const pageBg = useColorModeValue("gray.50", "gray.900");
  const borderColor = useColorModeValue("gray.200", "gray.600");
  const labelColor = useColorModeValue("gray.500", "gray.400");
  const textareaBg = useColorModeValue("gray.50", "gray.700");
  const suggestionBg = useColorModeValue("white", "gray.700");
  const suggestionHoverBg = useColorModeValue("gray.100", "gray.600");
  const suggestionBorderColor = useColorModeValue("gray.200", "gray.600");
  const photoBorderColor = useColorModeValue("gray.200", "gray.600");
  const videoBg = useColorModeValue("gray.100", "gray.700");

  const { data: process, isLoading } = useQuery<IProcess>({
    queryKey: ["processDetail", pk],
    queryFn: () => getProcessDetail(pk),
    enabled: !!pk,
  });

  // ── Edit 상태 ──────────────────────────────────────────────
  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState({
    code: "",
    name: "",
    name_ko: "",
    name_en: "",
    cycle_time: "",
    standard_work_video_url: "",
    flow: "",
    description: "",
  });
  const [isSaving, setIsSaving] = useState(false);

  // Module 검색 combobox
  const [moduleSearch, setModuleSearch] = useState("");
  const [selectedModule, setSelectedModule] = useState<{ pk: number; code: string; name: string } | null>(null);
  const [showModuleSuggestions, setShowModuleSuggestions] = useState(false);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: moduleSuggestions } = useQuery<IModuleListResponse>({
    queryKey: ["moduleSuggestions", moduleSearch],
    queryFn: () => getModules({ search: moduleSearch }),
    enabled: isEditing && moduleSearch.length > 0,
  });

  // Machine 검색 combobox
  const [machineSearch, setMachineSearch] = useState("");
  const [selectedMachine, setSelectedMachine] = useState<{ pk: number; code: string; name: string } | null>(null);
  const [showMachineSuggestions, setShowMachineSuggestions] = useState(false);
  const machineBlurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: machineSuggestions } = useQuery<IMachineListResponse>({
    queryKey: ["machineSuggestions", machineSearch],
    queryFn: () => getMachines({ search: machineSearch }),
    enabled: isEditing && machineSearch.length > 0,
  });

  const startEdit = () => {
    if (!process) return;
    const mod = typeof process.module === "object" ? process.module : null;
    setForm({
      code: process.code,
      name: process.name ?? "",
      name_ko: process.name_ko ?? "",
      name_en: process.name_en ?? "",
      cycle_time: process.cycle_time ?? "",
      standard_work_video_url: process.standard_work_video_url ?? "",
      flow: process.flow ?? "",
      description: process.description ?? "",
    });
    setSelectedModule(mod ? { pk: mod.pk, code: mod.code, name: mod.name } : null);
    setModuleSearch(mod ? mod.code : "");
    if (process.machine_pk && process.machine_name) {
      const [code, ...rest] = process.machine_name.split(" — ");
      setSelectedMachine({ pk: process.machine_pk, code: code.trim(), name: rest.join(" — ").trim() });
      setMachineSearch(code.trim());
    } else {
      setSelectedMachine(null);
      setMachineSearch("");
    }
    setIsEditing(true);
  };

  const handleSave = async () => {
    if (!form.code.trim()) {
      toast({ title: "Code is required", status: "warning", duration: 2000, position: "bottom-right" });
      return;
    }
    setIsSaving(true);
    try {
      await editProcess(pk, {
        code: form.code.trim(),
        name: form.name.trim(),
        name_ko: form.name_ko.trim(),
        name_en: form.name_en.trim(),
        cycle_time: form.cycle_time ? Number(form.cycle_time) : null,
        standard_work_video_url: form.standard_work_video_url.trim(),
        flow: form.flow.trim(),
        description: form.description.trim(),
        ...(selectedModule ? { module: selectedModule.pk } : {}),
        machine: selectedMachine ? selectedMachine.pk : null,
      });
      toast({ title: "Updated", status: "success", duration: 2000, position: "bottom-right" });
      queryClient.invalidateQueries({ queryKey: ["processDetail", pk] });
      queryClient.invalidateQueries({ queryKey: ["processes"] });
      setIsEditing(false);
    } catch {
      toast({ title: "Update failed", status: "error", duration: 2000, position: "bottom-right" });
    } finally {
      setIsSaving(false);
    }
  };

  // ── Delete ─────────────────────────────────────────────────
  const { isOpen: isDeleteOpen, onOpen: onDeleteOpen, onClose: onDeleteClose } = useDisclosure();
  const cancelRef = useRef<HTMLButtonElement>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await deleteProcess(pk);
      toast({ title: "Deleted", status: "success", duration: 2000, position: "bottom-right" });
      queryClient.invalidateQueries({ queryKey: ["processes"] });
      navigate("/production-process/processes");
    } catch {
      toast({ title: "Delete failed", status: "error", duration: 2000, position: "bottom-right" });
      setIsDeleting(false);
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

  const removePendingPhoto = (idx: number) => {
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
        await createProcessPhoto({ file: cfUrl, processPk: pk, description: process?.code ?? "" });
      }
      queryClient.invalidateQueries({ queryKey: ["processDetail", pk] });
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
      await deleteProcessPhoto({ processPk: pk, photoPk });
      queryClient.invalidateQueries({ queryKey: ["processDetail", pk] });
      toast({ title: "Photo deleted", status: "success", duration: 2000, position: "bottom-right" });
    } catch {
      toast({ title: "Delete failed", status: "error", duration: 2000, position: "bottom-right" });
    }
  };

  // ── Video Modal ────────────────────────────────────────────
  const [selectedVideoUrl, setSelectedVideoUrl] = useState<string | null>(null);

  // ── Video Upload ───────────────────────────────────────────
  const [pendingVideoFile, setPendingVideoFile] = useState<File | null>(null);
  const [isUploadingVideo, setIsUploadingVideo] = useState(false);
  const videoInputRef = useRef<HTMLInputElement>(null);

  const handleVideoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPendingVideoFile(file);
    if (videoInputRef.current) videoInputRef.current.value = "";
  };

  const handleUploadVideo = async () => {
    if (!pendingVideoFile) return;
    setIsUploadingVideo(true);
    try {
      // 1) Cloudflare 업로드 URL + uid 획득
      const urlData = await getUploadVideoURL();
      const uid: string = urlData.id;
      // 2) Cloudflare에 비디오 업로드
      const dt = new DataTransfer();
      dt.items.add(pendingVideoFile);
      await uploadVideo({ file: dt.files, uploadURL: urlData.uploadURL });
      // 3) 비디오 데이터(thumbnail) 가져오기
      const videoData: any = await getVideoData(uid);
      const VideoFile = `https://customer-kc2gx0yn68qxte35.cloudflarestream.com/${videoData.uid}/iframe`;
      const ThumbnailFile = videoData?.thumbnail ?? "";
      // 4) Django에 저장
      await createProcessVideo({
        VideoFile,
        ThumbnailFile,
        processPk: pk,
        description: process?.code ?? "",
      });
      queryClient.invalidateQueries({ queryKey: ["processDetail", pk] });
      setPendingVideoFile(null);
      toast({ title: "Video uploaded", status: "success", duration: 2000, position: "bottom-right" });
    } catch {
      toast({ title: "Video upload failed", status: "error", duration: 3000, position: "bottom-right" });
    } finally {
      setIsUploadingVideo(false);
    }
  };

  const handleDeleteVideo = async (videoPk: number) => {
    try {
      await deleteProcessVideo({ processPk: pk, videoPk });
      queryClient.invalidateQueries({ queryKey: ["processDetail", pk] });
      toast({ title: "Video deleted", status: "success", duration: 2000, position: "bottom-right" });
    } catch {
      toast({ title: "Delete failed", status: "error", duration: 2000, position: "bottom-right" });
    }
  };

  const handleSetStandard = async (videoFile: string) => {
    try {
      await editProcess(pk, { standard_work_video_url: videoFile });
      queryClient.invalidateQueries({ queryKey: ["processDetail", pk] });
      toast({ title: "Standard Work Video set", status: "success", duration: 2000, position: "bottom-right" });
    } catch {
      toast({ title: "Failed to set standard video", status: "error", duration: 2000, position: "bottom-right" });
    }
  };

  if (isLoading) return <Center minH="60vh"><Spinner size="xl" /></Center>;
  if (!process) return <Center minH="60vh"><Text color="gray.400">Process not found.</Text></Center>;

  const module = typeof process.module === "object" ? process.module : null;
  const photos = process.photos ?? [];
  const videos = process.videos ?? [];

  return (
    <>
      <Helmet>
        <title>{process.code} — Process Detail</title>
      </Helmet>

      <Box bg={pageBg} minH="100vh" px={{ base: 4, md: 8, lg: 12 }} py={{ base: 6, md: 8 }}>
        <Box maxW="4xl" mx="auto">

          <HStack mb={4}>
            <Button leftIcon={<FaArrowLeft />} variant="ghost" size="sm" onClick={() => navigate(-1)}>
              Back
            </Button>
          </HStack>

          {/* 기본 정보 카드 */}
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
              {/* Code & Name */}
              <HStack align="baseline" spacing={3} mb={5}>
                {isEditing ? (
                  <>
                    <Input
                      value={form.code}
                      onChange={(e) => setForm({ ...form, code: e.target.value })}
                      fontWeight="bold"
                      fontSize="lg"
                      w="200px"
                      placeholder="Code"
                    />
                    <Input
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      fontSize="md"
                      placeholder="Name (optional)"
                      flex={1}
                    />
                  </>
                ) : (
                  <>
                    <Heading size="md">{process.code}</Heading>
                    {process.name && <Text fontSize="lg" color="gray.500">{process.name}</Text>}
                  </>
                )}
              </HStack>

              <HStack spacing={8} flexWrap="wrap" align="flex-start" mb={6}>
                {/* Module */}
                <InfoRow label="Module" labelColor={labelColor}>
                  {isEditing ? (
                    <Box position="relative" w="220px">
                      <Input
                        size="sm"
                        value={moduleSearch}
                        onChange={(e) => { setModuleSearch(e.target.value); setSelectedModule(null); }}
                        onFocus={() => setShowModuleSuggestions(true)}
                        onBlur={() => { blurTimer.current = setTimeout(() => setShowModuleSuggestions(false), 150); }}
                        placeholder="Search module..."
                      />
                      {selectedModule && (
                        <Text fontSize="xs" color="blue.400" mt={1}>
                          Selected: {selectedModule.code}{selectedModule.name ? ` — ${selectedModule.name}` : ""}
                        </Text>
                      )}
                      {showModuleSuggestions && moduleSuggestions && moduleSuggestions.results.length > 0 && (
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
                          {moduleSuggestions.results.map((m) => (
                            <ListItem
                              key={m.pk}
                              px={3} py={2}
                              cursor="pointer"
                              fontSize="sm"
                              _hover={{ bg: suggestionHoverBg }}
                              onMouseDown={() => {
                                if (blurTimer.current) clearTimeout(blurTimer.current);
                                setSelectedModule({ pk: m.pk, code: m.code, name: m.name });
                                setModuleSearch(m.code);
                                setShowModuleSuggestions(false);
                              }}
                            >
                              <Text as="span" fontWeight="semibold">{m.code}</Text>
                              {m.name && <Text as="span" color="gray.500"> — {m.name}</Text>}
                            </ListItem>
                          ))}
                        </List>
                      )}
                    </Box>
                  ) : (
                    module ? (
                      <Link
                        as={RouterLink}
                        to={`/production-process/modules/${module.pk}`}
                        color="blue.500"
                        fontSize="sm"
                        fontWeight="semibold"
                      >
                        {module.code}{module.name ? ` — ${module.name}` : ""}
                      </Link>
                    ) : (
                      <Text fontSize="sm" color="gray.400">-</Text>
                    )
                  )}
                </InfoRow>

                {/* SJ No */}
                <InfoRow label="SJ No" labelColor={labelColor}>
                  {process.sj_no_pk ? (
                    <Link
                      as={RouterLink}
                      to={`/sjnos/${process.sj_no_pk}`}
                      color="blue.500"
                      fontSize="sm"
                      fontWeight="semibold"
                    >
                      {process.sj_no_value}
                    </Link>
                  ) : (
                    <Text fontSize="sm" color="gray.400">-</Text>
                  )}
                </InfoRow>

                {/* Machine */}
                <InfoRow label="Machine" labelColor={labelColor}>
                  {isEditing ? (
                    <Box position="relative" w="220px">
                      <Input
                        size="sm"
                        value={machineSearch}
                        onChange={(e) => { setMachineSearch(e.target.value); setSelectedMachine(null); }}
                        onFocus={() => setShowMachineSuggestions(true)}
                        onBlur={() => { machineBlurTimer.current = setTimeout(() => setShowMachineSuggestions(false), 150); }}
                        placeholder="Search machine..."
                      />
                      {selectedMachine && (
                        <Text fontSize="xs" color="blue.400" mt={1}>
                          Selected: {selectedMachine.code}{selectedMachine.name ? ` — ${selectedMachine.name}` : ""}
                        </Text>
                      )}
                      {!selectedMachine && machineSearch && (
                        <Text
                          fontSize="xs"
                          color="orange.400"
                          mt={1}
                          cursor="pointer"
                          onClick={() => { setSelectedMachine(null); setMachineSearch(""); }}
                        >
                          Clear (unset machine)
                        </Text>
                      )}
                      {showMachineSuggestions && machineSuggestions && machineSuggestions.results.length > 0 && (
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
                          {machineSuggestions.results.map((m) => (
                            <ListItem
                              key={m.pk}
                              px={3} py={2}
                              cursor="pointer"
                              fontSize="sm"
                              _hover={{ bg: suggestionHoverBg }}
                              onMouseDown={() => {
                                if (machineBlurTimer.current) clearTimeout(machineBlurTimer.current);
                                setSelectedMachine({ pk: m.pk, code: m.code, name: m.name });
                                setMachineSearch(m.code);
                                setShowMachineSuggestions(false);
                              }}
                            >
                              <Text as="span" fontWeight="semibold">{m.code}</Text>
                              {m.name && <Text as="span" color="gray.500"> — {m.name}</Text>}
                            </ListItem>
                          ))}
                        </List>
                      )}
                    </Box>
                  ) : (
                    process.machine_pk ? (
                      <Link
                        as={RouterLink}
                        to={`/machines/${process.machine_pk}`}
                        color="blue.500"
                        fontSize="sm"
                        fontWeight="semibold"
                      >
                        {process.machine_name}
                      </Link>
                    ) : (
                      <Text fontSize="sm" color="gray.400">-</Text>
                    )
                  )}
                </InfoRow>

                <InfoRow label="Created" labelColor={labelColor}>
                  <Text fontSize="sm">{new Date(process.created_at).toLocaleDateString("ko-KR")}</Text>
                </InfoRow>
              </HStack>

              <Divider mb={5} />

              {/* Name KO / Name EN */}
              <HStack spacing={8} flexWrap="wrap" align="flex-start" mb={6}>
                <InfoRow label="Name (KO)" labelColor={labelColor}>
                  {isEditing ? (
                    <Input
                      size="sm"
                      value={form.name_ko}
                      onChange={(e) => setForm({ ...form, name_ko: e.target.value })}
                      placeholder="한국어 명칭"
                      w="180px"
                    />
                  ) : (
                    <Text fontSize="sm">{process.name_ko || "-"}</Text>
                  )}
                </InfoRow>
                <InfoRow label="Name (EN)" labelColor={labelColor}>
                  {isEditing ? (
                    <Input
                      size="sm"
                      value={form.name_en}
                      onChange={(e) => setForm({ ...form, name_en: e.target.value })}
                      placeholder="English name"
                      w="180px"
                    />
                  ) : (
                    <Text fontSize="sm">{process.name_en || "-"}</Text>
                  )}
                </InfoRow>
              </HStack>

              <Divider mb={5} />

              {/* IE Metrics */}
              <Heading size="xs" color={labelColor} mb={4}>IE Metrics</Heading>
              <HStack spacing={8} flexWrap="wrap" align="flex-start" mb={6}>
                <InfoRow label="Cycle Time (s)" labelColor={labelColor}>
                  {isEditing ? (
                    <Input
                      size="sm"
                      type="number"
                      value={form.cycle_time}
                      onChange={(e) => setForm({ ...form, cycle_time: e.target.value })}
                      placeholder="seconds"
                      w="120px"
                    />
                  ) : (
                    <Text fontSize="sm" fontWeight="semibold">
                      {process.cycle_time ?? "-"}
                    </Text>
                  )}
                </InfoRow>
                <InfoRow label="Target / hour" labelColor={labelColor}>
                  {process.target_qty_per_hour != null ? (
                    <Badge colorScheme="green" fontSize="sm">
                      {process.target_qty_per_hour} pcs/h
                    </Badge>
                  ) : (
                    <Text fontSize="sm" color="gray.400">-</Text>
                  )}
                </InfoRow>
                <InfoRow label="Target / 8h" labelColor={labelColor}>
                  {process.daily_target_qty_8h != null ? (
                    <Badge colorScheme="blue" fontSize="sm">
                      {process.daily_target_qty_8h} pcs
                    </Badge>
                  ) : (
                    <Text fontSize="sm" color="gray.400">-</Text>
                  )}
                </InfoRow>
              </HStack>

              {/* Video URL */}
              <Divider mb={5} />
              <InfoRow label="Standard Work Video" labelColor={labelColor}>
                {isEditing ? (
                  <Input
                    size="sm"
                    mt={1}
                    value={form.standard_work_video_url}
                    onChange={(e) => setForm({ ...form, standard_work_video_url: e.target.value })}
                    placeholder="https://..."
                  />
                ) : (() => {
                  const matched = videos.find((v) => v.VideoFile === process.standard_work_video_url);
                  if (matched) {
                    return (
                      <Box
                        mt={1} w="160px" borderRadius="md" overflow="hidden"
                        border="1px solid" borderColor={photoBorderColor}
                        cursor="pointer" position="relative"
                        onClick={() => setSelectedVideoUrl(matched.VideoFile)}
                        _hover={{ opacity: 0.85 }} transition="opacity 0.15s"
                      >
                        {matched.ThumbnailFile ? (
                          <Image src={matched.ThumbnailFile} w="full" h="90px" objectFit="cover" />
                        ) : (
                          <Center h="90px" bg={videoBg}><FaVideo size={24} color="gray" /></Center>
                        )}
                        <Center position="absolute" inset={0} bg="blackAlpha.300">
                          <Box w={8} h={8} borderRadius="full" bg="whiteAlpha.900"
                            display="flex" alignItems="center" justifyContent="center">
                            <FaVideo size={14} color="black" />
                          </Box>
                        </Center>
                      </Box>
                    );
                  }
                  if (process.standard_work_video_url) {
                    return (
                      <Link href={process.standard_work_video_url} isExternal>
                        <HStack spacing={1} color="blue.400" mt={1}>
                          <FaVideo size={14} />
                          <Text fontSize="sm">Watch Video</Text>
                          <FaExternalLinkAlt size={10} />
                        </HStack>
                      </Link>
                    );
                  }
                  return <Text fontSize="sm" color="gray.400">-</Text>;
                })()}
              </InfoRow>
            </Box>
          </Box>

          {/* Flow */}
          <Box
            bg={cardBg}
            borderRadius="xl"
            border="1px solid"
            borderColor={borderColor}
            p={6}
            shadow="sm"
            mb={6}
          >
            <Heading size="sm" mb={3}>Flow</Heading>
            <Divider mb={3} />
            {isEditing ? (
              <Textarea
                value={form.flow}
                onChange={(e) => setForm({ ...form, flow: e.target.value })}
                placeholder="Process flow memo"
                rows={4}
                fontSize="sm"
              />
            ) : (
              <Box
                bg={textareaBg}
                borderRadius="md"
                p={4}
                fontSize="sm"
                whiteSpace="pre-wrap"
                lineHeight={1.7}
                minH="60px"
                color={process.flow ? undefined : "gray.400"}
              >
                {process.flow || "No flow registered."}
              </Box>
            )}
          </Box>

          {/* Description */}
          <Box
            bg={cardBg}
            borderRadius="xl"
            border="1px solid"
            borderColor={borderColor}
            p={6}
            shadow="sm"
            mb={6}
          >
            <Heading size="sm" mb={3}>Description</Heading>
            <Divider mb={3} />
            {isEditing ? (
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Description"
                rows={4}
                fontSize="sm"
              />
            ) : (
              <Box
                bg={textareaBg}
                borderRadius="md"
                p={4}
                fontSize="sm"
                whiteSpace="pre-wrap"
                lineHeight={1.7}
                minH="60px"
                color={process.description ? undefined : "gray.400"}
              >
                {process.description || "No description registered."}
              </Box>
            )}
          </Box>

          {/* Photos */}
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
              <Button size="sm" leftIcon={<FaCamera />} variant="outline"
                onClick={() => photoInputRef.current?.click()}>
                Add Photos
              </Button>
              <input ref={photoInputRef} type="file" accept="image/*" multiple
                style={{ display: "none" }} onChange={handlePhotoSelect} />
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
                      <Button size="xs" colorScheme="red" position="absolute" top={1} right={1}
                        onClick={() => removePendingPhoto(idx)}>
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
                  <Box key={photo.pk} position="relative" borderRadius="md" overflow="hidden"
                    border="1px solid" borderColor={photoBorderColor}
                    cursor="pointer" onClick={() => setLightboxSrc(photo.file)}
                    _hover={{ opacity: 0.85 }} transition="opacity 0.15s">
                    <Image src={photo.file} w="full" h="130px" objectFit="cover" />
                    <Button size="xs" colorScheme="red" position="absolute" top={1} right={1}
                      onClick={(e) => { e.stopPropagation(); handleDeletePhoto(photo.pk); }}>
                      <FaTrashAlt />
                    </Button>
                  </Box>
                ))}
              </Grid>
            )}
          </Box>

          {/* Videos */}
          <Box
            bg={cardBg}
            borderRadius="xl"
            border="1px solid"
            borderColor={borderColor}
            p={6}
            shadow="sm"
          >
            <HStack justify="space-between" mb={4}>
              <Heading size="sm">Videos</Heading>
              <HStack>
                {pendingVideoFile && (
                  <Text fontSize="xs" color="blue.400" maxW="160px" noOfLines={1}>
                    {pendingVideoFile.name}
                  </Text>
                )}
                <Button size="sm" leftIcon={<FaVideo />} variant="outline"
                  onClick={() => videoInputRef.current?.click()}>
                  Select Video
                </Button>
                {pendingVideoFile && (
                  <Button size="sm" colorScheme="blue" isLoading={isUploadingVideo}
                    loadingText="Uploading..." onClick={handleUploadVideo}>
                    Upload
                  </Button>
                )}
              </HStack>
              <input ref={videoInputRef} type="file" accept="video/*"
                style={{ display: "none" }} onChange={handleVideoSelect} />
            </HStack>
            <Divider mb={4} />

            {videos.length === 0 ? (
              <Text color="gray.400" textAlign="center" py={6}>No videos registered.</Text>
            ) : (
              <Grid templateColumns="repeat(auto-fill, minmax(200px, 1fr))" gap={4}>
                {videos.map((video) => {
                  const isStandard = process.standard_work_video_url === video.VideoFile;
                  return (
                    <Box key={video.pk} borderRadius="md" overflow="hidden"
                      border="2px solid"
                      borderColor={isStandard ? "teal.400" : photoBorderColor}
                      bg={videoBg}>
                      {/* 썸네일 */}
                      <Box
                        position="relative" cursor="pointer"
                        onClick={() => setSelectedVideoUrl(video.VideoFile)}
                        _hover={{ opacity: 0.85 }} transition="opacity 0.15s"
                      >
                        {video.ThumbnailFile ? (
                          <Image src={video.ThumbnailFile} w="full" h="120px" objectFit="cover" />
                        ) : (
                          <Center h="120px" bg={videoBg}>
                            <FaVideo size={32} color="gray" />
                          </Center>
                        )}
                        <Center position="absolute" inset={0} bg="blackAlpha.300">
                          <Box w={10} h={10} borderRadius="full" bg="whiteAlpha.900"
                            display="flex" alignItems="center" justifyContent="center">
                            <FaVideo size={16} color="black" />
                          </Box>
                        </Center>
                        {isStandard && (
                          <Badge position="absolute" top={1} left={1}
                            colorScheme="teal" fontSize="9px">
                            Standard
                          </Badge>
                        )}
                      </Box>
                      <HStack justify="space-between" px={2} py={1}>
                        <Button
                          size="xs"
                          variant={isStandard ? "solid" : "outline"}
                          colorScheme={isStandard ? "gray" : "teal"}
                          onClick={() => handleSetStandard(isStandard ? "" : video.VideoFile)}
                        >
                          {isStandard ? "Unset" : "Set Standard"}
                        </Button>
                        <Button size="xs" colorScheme="red" variant="ghost"
                          onClick={() => handleDeleteVideo(video.pk)}>
                          <FaTrashAlt />
                        </Button>
                      </HStack>
                    </Box>
                  );
                })}
              </Grid>
            )}
          </Box>

        </Box>
      </Box>

      {/* Video 재생 모달 */}
      <Modal isOpen={!!selectedVideoUrl} onClose={() => setSelectedVideoUrl(null)} isCentered size="4xl">
        <ModalOverlay bg="blackAlpha.800" />
        <ModalContent bg="black">
          <AspectRatio ratio={16 / 9}>
            <Box as="iframe"
              src={selectedVideoUrl ?? ""}
              allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;"
              allowFullScreen
              title="video player"
            />
          </AspectRatio>
        </ModalContent>
      </Modal>

      {/* Lightbox */}
      <Modal isOpen={!!lightboxSrc} onClose={() => setLightboxSrc(null)} isCentered size="4xl">
        <ModalOverlay bg="blackAlpha.800" />
        <ModalContent bg="transparent" shadow="none" onClick={() => setLightboxSrc(null)}>
          <Image src={lightboxSrc ?? ""} maxH="90vh" maxW="100%"
            objectFit="contain" borderRadius="lg" mx="auto" />
        </ModalContent>
      </Modal>

      {/* ── Delete 확인 다이얼로그 ── */}
      <AlertDialog isOpen={isDeleteOpen} leastDestructiveRef={cancelRef} onClose={onDeleteClose}>
        <AlertDialogOverlay>
          <AlertDialogContent>
            <AlertDialogHeader fontSize="lg" fontWeight="bold">Delete Process</AlertDialogHeader>
            <AlertDialogBody>
              <strong>{process.code}</strong>을(를) 삭제하시겠습니까?
              이 작업은 되돌릴 수 없습니다.
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
