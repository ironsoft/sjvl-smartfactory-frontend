import {
  Box,
  Button,
  Center,
  Divider,
  FormControl,
  FormHelperText,
  FormLabel,
  Heading,
  HStack,
  IconButton,
  Image,
  Input,
  InputGroup,
  InputRightElement,
  List,
  ListItem,
  NumberInput,
  NumberInputField,
  Radio,
  RadioGroup,
  Select,
  Spinner,
  Stack,
  Text,
  Textarea,
  Wrap,
  WrapItem,
  useColorModeValue,
  useToast,
} from "@chakra-ui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Helmet } from "react-helmet";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import {
  createVlAssemblyInspection,
  getDefectCategories,
  getVlAssemblyModuleDetail,
  getVlAssemblyProcessDetail,
  getVlAssemblyScheduleDetail,
  getVlAssemblySchedules,
  getVlAssemblySjNoDetail,
  getUploadURL,
  getUploadVideoURL,
  getVideoData,
  IEpInspectionDetail,
  IEpInspectionWritePayload,
  IVlAssemblySchedule,
  ISjOrderSearchResult,
  searchSjOrders,
  uploadImage,
  uploadVideo,
} from "../api";
import { FaImage, FaTimes, FaVideo } from "react-icons/fa";

/** Cloudflare Images — SjProcessDetail과 동일 delivery hash */
const CF_IMAGE_PUBLIC = (imageId: string) =>
  `https://imagedelivery.net/mzmXhxWLR9jzdX8u9g4BBQ/${imageId}/public`;

type TargetKind = "process" | "module" | "sj_no";

function formatScheduleLabel(s: IVlAssemblySchedule): string {
  const o = s.sj_order_info;
  const bits = [o?.sj_po_number ?? `#${s.pk}`, o?.style_name, o?.color].filter(Boolean);
  const line = s.production_line_name ? ` · ${s.production_line_name}` : "";
  return `${bits.join(" · ")}${line} · VL Assembly #${s.pk}`;
}

function scheduleToSelectedOrder(sched: IVlAssemblySchedule): ISjOrderSearchResult {
  const o = sched.sj_order_info;
  return {
    pk: sched.sj_order ?? sched.sj_order_info?.pk ?? 0,
    sj_po_number: o?.sj_po_number ?? "",
    sj_no_value: o?.sj_no?.sj_no ?? null,
    style_name: o?.style_name ?? o?.sj_style?.style_name ?? null,
    color: o?.color ?? null,
    total_order_qty: o?.total_order_qty ?? null,
    ex_factory_date: o?.ex_factory_date ?? null,
    buyer_name: o?.buyer_name ?? null,
  };
}

export default function VlAssemblyInspectionForm() {
  const { t } = useTranslation();
  const toast = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const pageBg = useColorModeValue("gray.50", "gray.900");
  const cardBg = useColorModeValue("white", "gray.800");
  const border = useColorModeValue("gray.200", "gray.600");
  const dropdownBg = useColorModeValue("white", "gray.800");
  const dropdownBorder = useColorModeValue("gray.200", "gray.600");

  const orderSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<ISjOrderSearchResult | null>(null);
  const [orderQuery, setOrderQuery] = useState("");
  const [orderResults, setOrderResults] = useState<ISjOrderSearchResult[]>([]);
  const [orderSearching, setOrderSearching] = useState(false);

  const [modalScheduleId, setModalScheduleId] = useState("");
  const [modalSjNoPk, setModalSjNoPk] = useState("");
  const [modalModulePk, setModalModulePk] = useState("");
  const [modalProcessPk, setModalProcessPk] = useState("");

  const [targetKind, setTargetKind] = useState<TargetKind>("process");
  const [inspectedQty, setInspectedQty] = useState("1");
  const [defectQty, setDefectQty] = useState("0");
  const [defectCategoryId, setDefectCategoryId] = useState<string>("");
  const [description, setDescription] = useState("");
  const [photoImageIds, setPhotoImageIds] = useState<string[]>([]);
  /** Process(SjProcessDetail)와 동일: Stream uid + 썸네일(표시용) */
  const [videoEntries, setVideoEntries] = useState<
    { uid: string; thumbnail?: string }[]
  >([]);
  const [pendingVideoFile, setPendingVideoFile] = useState<File | null>(null);
  const [isUploadingPhotos, setIsUploadingPhotos] = useState(false);
  const [isUploadingVideos, setIsUploadingVideos] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const [inspectedAt, setInspectedAt] = useState(() => {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  });

  const { data: schedulesForOrder, isLoading: schedulesForOrderLoading } = useQuery({
    queryKey: ["vlSchedules", "sjOrder", selectedOrder?.pk],
    queryFn: () => getVlAssemblySchedules({ sj_order: selectedOrder!.pk }),
    enabled: !!selectedOrder,
  });

  useEffect(() => {
    if (!selectedOrder || !schedulesForOrder?.length) return;
    if (schedulesForOrder.length === 1) {
      setModalScheduleId(String(schedulesForOrder[0].pk));
    }
  }, [selectedOrder, schedulesForOrder]);

  const { data: modalScheduleDetail, isLoading: modalSchedLoading } = useQuery({
    queryKey: ["epSchedule", modalScheduleId],
    queryFn: () => getVlAssemblyScheduleDetail(Number(modalScheduleId)),
    enabled: !!modalScheduleId,
  });

  const sjNos = useMemo(() => {
    if (!modalScheduleDetail?.ep_sj_nos) return [];
    return modalScheduleDetail.ep_sj_nos.filter((sj) => !sj.is_deleted);
  }, [modalScheduleDetail]);

  const modulesForSj = useMemo(() => {
    if (!modalSjNoPk) return [];
    const sj = sjNos.find((x) => String(x.pk) === modalSjNoPk);
    return (sj?.ep_modules || []).filter((m) => !m.is_deleted);
  }, [sjNos, modalSjNoPk]);

  const processesForMod = useMemo(() => {
    if (!modalModulePk) return [];
    const mod = modulesForSj.find((m) => String(m.pk) === modalModulePk);
    return (mod?.ep_processes || []).filter((p) => !p.is_deleted);
  }, [modulesForSj, modalModulePk]);

  const summaryLine = useMemo(() => {
    if (!modalSjNoPk) return "";
    const sj = sjNos.find((x) => String(x.pk) === modalSjNoPk);
    if (!sj) return "";
    if (targetKind === "sj_no") return `${sj.sj_no || "—"} (${t("epInspection.targetSjNo")})`;
    if (targetKind === "module") {
      const mod = modulesForSj.find((m) => String(m.pk) === modalModulePk);
      if (!mod) return sj.sj_no || "";
      return `${sj.sj_no} / ${mod.code} (${t("epInspection.targetModule")})`;
    }
    const mod = modulesForSj.find((m) => String(m.pk) === modalModulePk);
    const p = processesForMod.find((x) => String(x.pk) === modalProcessPk);
    if (!sj || !mod || !p) return "";
    return `${sj.sj_no} / ${mod.code} / ${p.code} — ${p.name || p.name_ko || ""}`;
  }, [
    sjNos,
    modulesForSj,
    processesForMod,
    modalSjNoPk,
    modalModulePk,
    modalProcessPk,
    targetKind,
    t,
  ]);

  const prefillKey = searchParams.toString();
  useEffect(() => {
    const ep =
      searchParams.get("vl_assembly_process") ?? searchParams.get("ep_process");
    const mod =
      searchParams.get("vl_assembly_module") ?? searchParams.get("ep_module");
    const sj =
      searchParams.get("vl_assembly_sj_no") ?? searchParams.get("ep_sj_no");
    if (!ep && !mod && !sj) return;

    let cancelled = false;
    (async () => {
      try {
        if (ep) {
          const proc = await getVlAssemblyProcessDetail(Number(ep));
          if (cancelled) return;
          const sched = await getVlAssemblyScheduleDetail(proc.ep_schedule_pk);
          if (cancelled) return;
          setSelectedOrder(scheduleToSelectedOrder(sched));
          setOrderQuery(sched.sj_order_info?.sj_po_number ?? "");
          setModalScheduleId(String(sched.pk));
          setModalSjNoPk(String(proc.ep_sj_no_pk));
          setModalModulePk(String(proc.ep_module_pk));
          setModalProcessPk(String(proc.pk));
          setTargetKind("process");
        } else if (mod) {
          const m = await getVlAssemblyModuleDetail(Number(mod));
          if (cancelled) return;
          const sjD = await getVlAssemblySjNoDetail(m.ep_sj_no_pk);
          if (cancelled) return;
          const sched = await getVlAssemblyScheduleDetail(sjD.ep_schedule_pk);
          if (cancelled) return;
          setSelectedOrder(scheduleToSelectedOrder(sched));
          setOrderQuery(sched.sj_order_info?.sj_po_number ?? "");
          setModalScheduleId(String(sched.pk));
          setModalSjNoPk(String(m.ep_sj_no_pk));
          setModalModulePk(String(m.pk));
          setModalProcessPk("");
          setTargetKind("module");
        } else if (sj) {
          const sjD = await getVlAssemblySjNoDetail(Number(sj));
          if (cancelled) return;
          const sched = await getVlAssemblyScheduleDetail(sjD.ep_schedule_pk);
          if (cancelled) return;
          setSelectedOrder(scheduleToSelectedOrder(sched));
          setOrderQuery(sched.sj_order_info?.sj_po_number ?? "");
          setModalScheduleId(String(sched.pk));
          setModalSjNoPk(String(sjD.pk));
          setModalModulePk("");
          setModalProcessPk("");
          setTargetKind("sj_no");
        }
      } catch {
        if (!cancelled) {
          toast({ title: t("epInspection.prefillError"), status: "warning" });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- URL prefill once per query string
  }, [prefillKey]);

  const handleOrderSearch = (q: string) => {
    setOrderQuery(q);
    setSelectedOrder(null);
    setModalScheduleId("");
    setModalSjNoPk("");
    setModalModulePk("");
    setModalProcessPk("");
    if (orderSearchTimer.current) clearTimeout(orderSearchTimer.current);
    if (!q.trim()) {
      setOrderResults([]);
      return;
    }
    orderSearchTimer.current = setTimeout(async () => {
      setOrderSearching(true);
      try {
        const results = await searchSjOrders(q);
        setOrderResults(results);
      } finally {
        setOrderSearching(false);
      }
    }, 300);
  };

  const selectOrder = (order: ISjOrderSearchResult) => {
    setSelectedOrder(order);
    setOrderQuery(order.sj_po_number);
    setOrderResults([]);
    setModalScheduleId("");
    setModalSjNoPk("");
    setModalModulePk("");
    setModalProcessPk("");
  };

  const hasScheduleForOrder =
    selectedOrder && schedulesForOrder && schedulesForOrder.length > 0;
  const schedulePickNeeded =
    selectedOrder &&
    schedulesForOrder &&
    schedulesForOrder.length > 1 &&
    !schedulesForOrderLoading;

  const handlePhotoFiles = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setIsUploadingPhotos(true);
    try {
      for (const file of files) {
        const urlData = await getUploadURL();
        const dt = new DataTransfer();
        dt.items.add(file);
        const cfResult = (await uploadImage({
          file: dt.files,
          uploadURL: urlData.uploadURL,
        })) as { result?: { id?: string } };
        const id = cfResult?.result?.id;
        if (id) setPhotoImageIds((prev) => [...prev, id]);
      }
    } catch {
      toast({ title: t("epInspection.uploadFailed"), status: "error" });
    } finally {
      setIsUploadingPhotos(false);
      if (photoInputRef.current) photoInputRef.current.value = "";
    }
  };

  const removePhotoAt = (index: number) => {
    setPhotoImageIds((prev) => prev.filter((_, i) => i !== index));
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

  /** SjProcessDetail.handleUploadVideo 와 동일 흐름 */
  const handleUploadVideo = async () => {
    if (!pendingVideoFile) return;
    setIsUploadingVideos(true);
    try {
      const urlData = await getUploadVideoURL();
      const uid: string = urlData.id;
      const dt = new DataTransfer();
      dt.items.add(pendingVideoFile);
      await uploadVideo({ file: dt.files, uploadURL: urlData.uploadURL });
      const videoData: { uid?: string; thumbnail?: string } | null =
        (await getVideoData(uid)) ?? null;
      const finalUid = videoData?.uid ?? uid;
      setVideoEntries((prev) => [
        ...prev,
        { uid: finalUid, thumbnail: videoData?.thumbnail },
      ]);
      setPendingVideoFile(null);
      toast({ title: t("epInspection.videoUploaded"), status: "success" });
    } catch {
      toast({ title: t("epInspection.uploadFailed"), status: "error" });
    } finally {
      setIsUploadingVideos(false);
    }
  };

  const removeVideoAt = (index: number) => {
    setVideoEntries((prev) => prev.filter((_, i) => i !== index));
  };

  const { data: categories } = useQuery({
    queryKey: ["defectCategories", "active"],
    queryFn: () => getDefectCategories(),
  });

  const sortedCategories = useMemo(() => {
    return [...(categories ?? [])].sort(
      (a, b) => a.sort_order - b.sort_order || a.code.localeCompare(b.code)
    );
  }, [categories]);

  const mutation = useMutation({
    mutationFn: createVlAssemblyInspection,
    onSuccess: (data: IEpInspectionDetail) => {
      queryClient.invalidateQueries({ queryKey: ["vlInspections"] });
      queryClient.invalidateQueries({ queryKey: ["vlSchedules"] });
      toast({ title: t("epInspection.saved"), status: "success" });
      navigate(`/vl-assembly-production/inspections/${data.id}`);
    },
    onError: () => {
      toast({ title: t("epInspection.saveError"), status: "error" });
    },
  });

  const onSubmit = () => {
    const iq = Number(inspectedQty);
    const dq = Number(defectQty);
    if (!Number.isFinite(iq) || iq < 1) {
      toast({ title: t("epInspection.invalidInspectedQty"), status: "warning" });
      return;
    }
    if (!Number.isFinite(dq) || dq < 0) {
      toast({ title: t("epInspection.invalidDefectQty"), status: "warning" });
      return;
    }
    if (dq > iq) {
      toast({ title: t("epInspection.defectExceedsInspected"), status: "warning" });
      return;
    }

    const payload: IEpInspectionWritePayload = {
      inspected_qty: iq,
      defect_qty: dq,
      defect_category: defectCategoryId ? Number(defectCategoryId) : null,
      description,
      photo_image_ids: [...photoImageIds],
      video_stream_uids: videoEntries.map((e) => e.uid),
      inspected_at: new Date(inspectedAt).toISOString(),
    };

    if (targetKind === "process") {
      if (!modalProcessPk) {
        toast({ title: t("epInspection.selectProcessRequired"), status: "warning" });
        return;
      }
      payload.vl_assembly_process = Number(modalProcessPk);
    } else if (targetKind === "module") {
      if (!modalModulePk) {
        toast({ title: t("epInspection.selectModuleRequired"), status: "warning" });
        return;
      }
      payload.vl_assembly_module = Number(modalModulePk);
    } else {
      if (!modalSjNoPk) {
        toast({ title: t("epInspection.selectSjNoRequired"), status: "warning" });
        return;
      }
      payload.vl_assembly_sj_no = Number(modalSjNoPk);
    }

    mutation.mutate(payload);
  };

  return (
    <Box minH="100vh" bg={pageBg} py={8} px={{ base: 4, md: 10 }}>
      <Helmet>
        <title>{t("vlInspection.newTitle")} — SJ VL Assembly</title>
      </Helmet>
      <Box maxW="720px" mx="auto" bg={cardBg} borderWidth="1px" borderColor={border} borderRadius="md" p={6}>
        <Heading size="md" mb={6}>
          {t("vlInspection.newTitle")}
        </Heading>
        <Stack spacing={4}>
          {/* SJ Order — same pattern as EP daily output modal */}
          <FormControl isRequired>
            <FormLabel fontSize="sm">{t("ep.dailyOutput.sjOrderSearchLabel")}</FormLabel>
            <Box position="relative">
              <InputGroup>
                <Input
                  value={orderQuery}
                  onChange={(e) => handleOrderSearch(e.target.value)}
                  placeholder={t("ep.dailyOutput.sjOrderSearchPlaceholder")}
                  autoComplete="off"
                  borderColor={selectedOrder ? "green.400" : undefined}
                />
                {orderSearching && (
                  <InputRightElement>
                    <Spinner size="sm" color="gray.400" />
                  </InputRightElement>
                )}
                {selectedOrder && !orderSearching && (
                  <InputRightElement color="green.400" fontSize="lg">
                    ✓
                  </InputRightElement>
                )}
              </InputGroup>
              {orderResults.length > 0 && (
                <List
                  position="absolute"
                  top="100%"
                  left={0}
                  right={0}
                  zIndex={10}
                  bg={dropdownBg}
                  border="1px solid"
                  borderColor={dropdownBorder}
                  borderRadius="md"
                  boxShadow="lg"
                  maxH="240px"
                  overflowY="auto"
                  mt={1}
                >
                  {orderResults.map((order) => (
                    <ListItem
                      key={order.pk}
                      px={3}
                      py={2}
                      cursor="pointer"
                      _hover={{ bg: "blue.50" }}
                      _dark={{ _hover: { bg: "blue.900" } }}
                      onClick={() => selectOrder(order)}
                      borderBottom="1px solid"
                      borderColor={dropdownBorder}
                    >
                      <HStack justify="space-between" align="flex-start">
                        <Box>
                          <Text fontSize="sm" fontWeight="bold" color="blue.600">
                            {order.sj_po_number}
                          </Text>
                          <HStack spacing={2} mt={0.5} flexWrap="wrap">
                            {order.sj_no_value && (
                              <Text fontSize="xs" color="gray.500">
                                SJ No: {order.sj_no_value}
                              </Text>
                            )}
                            {order.style_name && (
                              <Text fontSize="xs" color="gray.500">
                                {order.style_name}
                              </Text>
                            )}
                            {order.color && (
                              <Text fontSize="xs" color="gray.500">
                                {order.color}
                              </Text>
                            )}
                          </HStack>
                        </Box>
                        <Box textAlign="right">
                          {order.ex_factory_date && (
                            <Text fontSize="xs" color="orange.500">
                              EX: {order.ex_factory_date}
                            </Text>
                          )}
                          {order.total_order_qty != null && (
                            <Text fontSize="xs" color="gray.500">
                              {order.total_order_qty.toLocaleString()} pcs
                            </Text>
                          )}
                          <Text fontSize="xs" color="gray.400">
                            Order #{order.pk}
                          </Text>
                        </Box>
                      </HStack>
                    </ListItem>
                  ))}
                </List>
              )}
            </Box>
            {selectedOrder && (
              <Box
                mt={2}
                p={2}
                bg="green.50"
                borderRadius="md"
                border="1px solid"
                borderColor="green.200"
                _dark={{ bg: "green.900", borderColor: "green.700" }}
              >
                <HStack justify="space-between" align="flex-start">
                  <Box>
                    <Text fontSize="xs" color="green.700" fontWeight="bold" _dark={{ color: "green.200" }}>
                      {selectedOrder.sj_po_number}
                    </Text>
                    <Text fontSize="xs" color="gray.600">
                      {[selectedOrder.sj_no_value, selectedOrder.style_name, selectedOrder.color]
                        .filter(Boolean)
                        .join(" · ")}
                    </Text>
                  </Box>
                  <Text fontSize="xs" color="gray.500">
                    SJ Order #{selectedOrder.pk}
                  </Text>
                </HStack>
              </Box>
            )}
          </FormControl>

          {selectedOrder && schedulesForOrderLoading && (
            <Center py={2}>
              <Spinner size="sm" />
            </Center>
          )}

          {selectedOrder && !schedulesForOrderLoading && schedulesForOrder?.length === 0 && (
            <Text fontSize="sm" color="orange.600">
              {t("ep.dailyOutput.noScheduleForOrder")}
            </Text>
          )}

          {schedulePickNeeded && (
            <FormControl isRequired>
              <FormLabel fontSize="sm">{t("ep.dailyOutput.pickEpSchedule")}</FormLabel>
              <Select
                value={modalScheduleId}
                placeholder="—"
                onChange={(e) => {
                  setModalScheduleId(e.target.value);
                  setModalSjNoPk("");
                  setModalModulePk("");
                  setModalProcessPk("");
                }}
              >
                {schedulesForOrder!.map((s) => (
                  <option key={s.pk} value={s.pk}>
                    {formatScheduleLabel(s)}
                  </option>
                ))}
              </Select>
              <FormHelperText>{t("ep.dailyOutput.pickEpScheduleHint")}</FormHelperText>
            </FormControl>
          )}

          {hasScheduleForOrder && schedulesForOrder!.length === 1 && modalScheduleId && (
            <Text fontSize="xs" color="gray.500">
              {t("ep.dailyOutput.epScheduleLinked")}: {formatScheduleLabel(schedulesForOrder![0])}
            </Text>
          )}

          <FormControl isDisabled={!modalScheduleId || modalSchedLoading}>
            <FormLabel fontSize="sm">{t("ep.dailyOutput.selectSjNo")}</FormLabel>
            {modalSchedLoading ? (
              <Spinner size="sm" />
            ) : (
              <Select
                value={modalSjNoPk}
                placeholder="—"
                onChange={(e) => {
                  setModalSjNoPk(e.target.value);
                  setModalModulePk("");
                  setModalProcessPk("");
                }}
              >
                {sjNos.map((sj) => (
                  <option key={sj.pk} value={sj.pk}>
                    {sj.sj_no || `SJ #${sj.pk}`}
                  </option>
                ))}
              </Select>
            )}
          </FormControl>

          <FormControl>
            <FormLabel>{t("epInspection.fieldTarget")}</FormLabel>
            <RadioGroup
              value={targetKind}
              onChange={(v) => {
                const k = v as TargetKind;
                setTargetKind(k);
                if (k === "sj_no") {
                  setModalModulePk("");
                  setModalProcessPk("");
                } else if (k === "module") {
                  setModalProcessPk("");
                }
              }}
            >
              <Stack spacing={2}>
                <Radio value="process" isDisabled={!modalSjNoPk}>
                  {t("epInspection.targetProcessRadio")}
                </Radio>
                <Radio value="module" isDisabled={!modalSjNoPk}>
                  {t("epInspection.targetModuleRadio")}
                </Radio>
                <Radio value="sj_no" isDisabled={!modalSjNoPk}>
                  {t("epInspection.targetSjNoRadio")}
                </Radio>
              </Stack>
            </RadioGroup>
            {summaryLine && (
              <Text fontSize="sm" color="gray.600" mt={2}>
                {summaryLine}
              </Text>
            )}
          </FormControl>

          {(targetKind === "process" || targetKind === "module") && (
            <FormControl isDisabled={!modalSjNoPk || modalSchedLoading}>
              <FormLabel fontSize="sm">{t("ep.dailyOutput.selectModule")}</FormLabel>
              <Select
                value={modalModulePk}
                placeholder="—"
                onChange={(e) => {
                  setModalModulePk(e.target.value);
                  setModalProcessPk("");
                }}
              >
                {modulesForSj.map((m) => (
                  <option key={m.pk} value={m.pk}>
                    {m.code} — {m.name || ""}
                  </option>
                ))}
              </Select>
            </FormControl>
          )}

          {targetKind === "process" && (
            <FormControl isDisabled={!modalModulePk || modalSchedLoading}>
              <FormLabel fontSize="sm">{t("ep.dailyOutput.selectProcess")}</FormLabel>
              <Select
                value={modalProcessPk}
                placeholder="—"
                onChange={(e) => setModalProcessPk(e.target.value)}
              >
                {processesForMod.map((p) => (
                  <option key={p.pk} value={p.pk}>
                    {p.code} — {p.name || p.name_ko || ""}
                  </option>
                ))}
              </Select>
            </FormControl>
          )}

          {targetKind === "sj_no" && modalSjNoPk && (
            <Text fontSize="xs" color="gray.500">
              {t("epInspection.skipModuleProcessHint")}
            </Text>
          )}

          <HStack flexWrap="wrap" gap={4}>
            <FormControl maxW="200px">
              <FormLabel>{t("epInspection.fieldInspectedQty")}</FormLabel>
              <NumberInput
                min={1}
                value={inspectedQty}
                onChange={(_, v) => setInspectedQty(String(v))}
              >
                <NumberInputField />
              </NumberInput>
            </FormControl>
            <FormControl maxW="200px">
              <FormLabel>{t("epInspection.fieldDefectQty")}</FormLabel>
              <NumberInput
                min={0}
                value={defectQty}
                onChange={(_, v) => setDefectQty(String(v))}
              >
                <NumberInputField />
              </NumberInput>
            </FormControl>
          </HStack>

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
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          </FormControl>

          <FormControl>
            <FormLabel>{t("epInspection.fieldPhotos")}</FormLabel>
            <HStack flexWrap="wrap" spacing={2} mb={2}>
              <input
                ref={photoInputRef}
                type="file"
                accept="image/*"
                multiple
                hidden
                onChange={handlePhotoFiles}
              />
              <Button
                type="button"
                size="sm"
                leftIcon={<FaImage />}
                variant="outline"
                onClick={() => photoInputRef.current?.click()}
                isLoading={isUploadingPhotos}
                isDisabled={isUploadingPhotos || isUploadingVideos}
              >
                {t("epInspection.uploadPhotos")}
              </Button>
              {isUploadingPhotos && (
                <Text fontSize="sm" color="gray.500">
                  {t("epInspection.uploading")}
                </Text>
              )}
            </HStack>
            {photoImageIds.length > 0 && (
              <Wrap spacing={2}>
                {photoImageIds.map((pid, idx) => (
                  <WrapItem key={`${pid}-${idx}`}>
                    <Box position="relative" w="100px" h="100px" borderRadius="md" overflow="hidden" borderWidth="1px" borderColor={border}>
                      <Image src={CF_IMAGE_PUBLIC(pid)} alt="" objectFit="cover" w="100%" h="100%" />
                      <IconButton
                        aria-label={t("epInspection.removeMedia")}
                        icon={<FaTimes />}
                        size="xs"
                        position="absolute"
                        top={1}
                        right={1}
                        colorScheme="red"
                        onClick={() => removePhotoAt(idx)}
                      />
                    </Box>
                  </WrapItem>
                ))}
              </Wrap>
            )}
            <FormHelperText>{t("epInspection.photosHelp")}</FormHelperText>
          </FormControl>

          <FormControl>
            <FormLabel>{t("epInspection.fieldVideos")}</FormLabel>
            <HStack flexWrap="wrap" spacing={2} mb={2} align="center">
              {pendingVideoFile && (
                <Text fontSize="xs" color="blue.400" maxW="200px" noOfLines={1}>
                  {pendingVideoFile.name}
                </Text>
              )}
              <input
                ref={videoInputRef}
                type="file"
                accept="video/*"
                hidden
                onChange={handleVideoSelect}
              />
              <Button
                type="button"
                size="sm"
                leftIcon={<FaVideo />}
                variant="outline"
                onClick={() => videoInputRef.current?.click()}
                isDisabled={isUploadingPhotos || isUploadingVideos}
              >
                {t("epInspection.selectVideo")}
              </Button>
              {pendingVideoFile && (
                <Button
                  type="button"
                  size="sm"
                  colorScheme="blue"
                  isLoading={isUploadingVideos}
                  loadingText={t("epInspection.uploading")}
                  onClick={handleUploadVideo}
                >
                  {t("epInspection.confirmVideoUpload")}
                </Button>
              )}
            </HStack>
            {videoEntries.length > 0 && (
              <>
                <Divider my={3} />
                <Wrap spacing={3}>
                  {videoEntries.map((entry, idx) => (
                    <WrapItem key={`${entry.uid}-${idx}`}>
                      <Box
                        position="relative"
                        w="200px"
                        borderRadius="md"
                        overflow="hidden"
                        borderWidth="1px"
                        borderColor={border}
                      >
                        {entry.thumbnail ? (
                          <Image
                            src={entry.thumbnail}
                            alt=""
                            w="full"
                            h="120px"
                            objectFit="cover"
                          />
                        ) : (
                          <Center h="120px" bg="gray.100" _dark={{ bg: "gray.700" }}>
                            <FaVideo size={32} color="gray" />
                          </Center>
                        )}
                        <Center position="absolute" inset={0} bg="blackAlpha.300" pointerEvents="none">
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
                        <IconButton
                          aria-label={t("epInspection.removeMedia")}
                          icon={<FaTimes />}
                          size="xs"
                          position="absolute"
                          top={1}
                          right={1}
                          colorScheme="red"
                          onClick={() => removeVideoAt(idx)}
                        />
                        <Text
                          fontSize="xs"
                          fontFamily="mono"
                          px={2}
                          py={1}
                          noOfLines={1}
                          title={entry.uid}
                        >
                          {entry.uid}
                        </Text>
                      </Box>
                    </WrapItem>
                  ))}
                </Wrap>
              </>
            )}
            <FormHelperText mt={2}>{t("epInspection.videosHelp")}</FormHelperText>
          </FormControl>

          <FormControl>
            <FormLabel>{t("epInspection.fieldInspectedAt")}</FormLabel>
            <Input
              type="datetime-local"
              value={inspectedAt}
              onChange={(e) => setInspectedAt(e.target.value)}
            />
          </FormControl>

          <HStack justify="flex-end" pt={2}>
            <Button variant="ghost" onClick={() => navigate("/vl-assembly-production/inspections")}>
              {t("epInspection.cancel")}
            </Button>
            <Button
              colorScheme="blue"
              onClick={onSubmit}
              isLoading={mutation.isPending}
              isDisabled={isUploadingPhotos || isUploadingVideos}
            >
              {t("epInspection.save")}
            </Button>
          </HStack>
        </Stack>
      </Box>
    </Box>
  );
}
