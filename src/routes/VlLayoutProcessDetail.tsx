import {
  AlertDialog,
  AlertDialogBody,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogOverlay,
  Box,
  Button,
  Center,
  Divider,
  Grid,
  Heading,
  HStack,
  Image,
  Input,
  Link,
  Spinner,
  Text,
  Textarea,
  Badge,
  Select,
  FormControl,
  FormLabel,
  useColorModeValue,
  useDisclosure,
  useToast,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalOverlay,
  VisuallyHidden,
  Tooltip,
  VStack,
  Wrap,
  WrapItem,
  IconButton,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  TableContainer
} from "@chakra-ui/react";
import axios from "axios";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Helmet } from "react-helmet";
import { Link as RouterLink, useParams, useNavigate } from "react-router-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { FaCamera, FaEdit, FaExternalLinkAlt, FaFilm, FaInfoCircle, FaPlus, FaTrash, FaTrashAlt, FaUserFriends, FaVideo } from "react-icons/fa";
import {
  getLayoutProcessDetail,
  getLayoutStyleDetail,
  getLayoutModuleDetail,
  patchLayoutProcess,
  deleteLayoutProcess,
  createLayoutProcessPhoto,
  deleteLayoutProcessPhoto,
  createLayoutProcessVideo,
  deleteLayoutProcessVideo,
  getUploadURL,
  getUploadVideoURL,
  uploadImage,
  uploadVideo,
  getVideoData,
  getProcessDetail,
  getLayoutSettings,
  getLayoutTools,
  createLayoutProcessMeasurement,
  patchLayoutProcessMeasurement,
  deleteLayoutProcessMeasurement,
  createLayoutProcessMeasurementPhoto,
  deleteLayoutProcessMeasurementPhoto,
  createLayoutProcessMeasurementVideo,
  deleteLayoutProcessMeasurementVideo,
  createLayoutProcessHelper,
  patchLayoutProcessHelper,
  deleteLayoutProcessHelper,
  type ILayoutProcess,
  type ILayoutProcessHelper,
  type ILayoutProcessMeasurement,
  type ILayoutStyleDetail,
  type IProcessVideo
} from "../api";
import { getApiErrorMessage } from "../lib/samStyleModulesHelpers";
import { formatIsoDateDisplay, formatIsoDateTimeDisplay } from "../lib/dateLocale";
import { normalizeSamProcessFk, samProcessSjMachineLabel, samProcessSjMachinePk } from "../lib/samProcessFk";
import {
  formatSamCycleSecondsDisplay,
  formatSamCycleSecondsForApi,
  parseSamSecondsField,
  sanitizeSamSecondsStringForApi,
  samProcessCycleSecondsFromFormStrings,
  samProcessCycleSecondsFromParts
} from "../lib/samProcessCycle";
import { openAppPopupWindow } from "../lib/openAppPopupWindow";
import { samCategoryColorScheme } from "../lib/samCategoryColor";
import { SamBadge } from "../components/EpBadge";
import { SamSortOrderBadge } from "../components/SamSortOrderBadge";

/** Normalize previous/next FK and machine FK to plain numbers before caching a patched process. */
function normalizeLayoutProcessForCache(p: ILayoutProcess): ILayoutProcess {
  const raw = p as unknown as Record<string, unknown>;
  const prev = normalizeSamProcessFk(raw.previous_process ?? raw.previous_process_id);
  const next = normalizeSamProcessFk(raw.next_process ?? raw.next_process_id);
  const machinePk = samProcessSjMachinePk(p);
  return {
    ...p,
    previous_process: prev,
    next_process: next,
    previous_process_id: prev,
    next_process_id: next,
    sj_machine: machinePk,
    sj_machine_id: machinePk,
    machine: machinePk,
    machine_pk: machinePk,
    machine_id: machinePk
  };
}

function InfoRow({ label, labelColor, children }: { label: React.ReactNode; labelColor: string; children: React.ReactNode }) {
  return (
    <Box>
      <Text fontSize="xs" color={labelColor} fontWeight="semibold" mb={0.5}>
        {label}
      </Text>
      {children}
    </Box>
  );
}

export default function VlLayoutProcessDetail() {
  const { pk: layoutStyleId, procPk: layoutProcessId } = useParams<{ pk: string; procPk: string }>();
  const stylePk = Number(layoutStyleId);
  const processPk = Number(layoutProcessId);
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const toast = useToast();
  const queryClient = useQueryClient();

  const cardBg = useColorModeValue("white", "gray.800");
  const pageBg = useColorModeValue("gray.50", "gray.900");
  const borderColor = useColorModeValue("gray.200", "gray.600");
  const labelColor = useColorModeValue("gray.500", "gray.400");
  const textareaBg = useColorModeValue("gray.50", "gray.700");
  const photoBorderColor = useColorModeValue("gray.200", "gray.600");
  const videoBg = useColorModeValue("gray.100", "gray.700");

  const { data: process, isLoading } = useQuery<ILayoutProcess>({
    queryKey: ["layoutProcessDetail", processPk],
    queryFn: () => getLayoutProcessDetail(processPk),
    enabled: Number.isFinite(processPk) && processPk > 0
  });

  const { data: layoutSettings } = useQuery({
    queryKey: ["layoutSettings"],
    queryFn: getLayoutSettings,
    staleTime: 5 * 60_000
  });
  const upmhDivisorSeconds = layoutSettings?.upmh_divisor_seconds ?? 3600;

  const { data: layoutStyle } = useQuery({
    queryKey: ["layoutStyle", stylePk],
    queryFn: () => getLayoutStyleDetail(stylePk),
    enabled: Number.isFinite(stylePk) && stylePk > 0
  });

  const invalidateAfterHelperChange = () => {
    queryClient.invalidateQueries({ queryKey: ["layoutProcessDetail", processPk] });
    queryClient.invalidateQueries({ queryKey: ["processDetail", processPk] });
    queryClient.invalidateQueries({ queryKey: ["layoutStyle", stylePk] });
  };

  const [helperForm, setHelperForm] = useState({ name: "", manpower: "", cycle_time: "" });
  const [editingHelper, setEditingHelper] = useState<{ pk: number; name: string; manpower: string; cycle_time: string } | null>(null);
  const [savingHelper, setSavingHelper] = useState(false);

  /** Cycle (s) is optional for a Helper — unlike Manpower, leaving it blank is valid (no time recorded yet). */
  const parseHelperCycleTime = (raw: string): { ok: true; value: number | null } | { ok: false } => {
    const trimmed = raw.trim();
    if (trimmed === "") return { ok: true, value: null };
    const n = Number(trimmed.replace(",", "."));
    if (!Number.isFinite(n) || n < 0) return { ok: false };
    return { ok: true, value: n };
  };

  const addHelper = async () => {
    const mp = Number(helperForm.manpower.trim());
    if (!Number.isFinite(mp) || mp <= 0) {
      toast({ title: t("vlLayouts.processDetail.helperManpowerInvalid"), status: "warning", duration: 2500, position: "bottom-right" });
      return;
    }
    const cycle = parseHelperCycleTime(helperForm.cycle_time);
    if (!cycle.ok) {
      toast({ title: t("vlLayouts.processDetail.helperCycleTimeInvalid"), status: "warning", duration: 2500, position: "bottom-right" });
      return;
    }
    setSavingHelper(true);
    try {
      await createLayoutProcessHelper({ layout_process: processPk, name: helperForm.name.trim(), manpower: Math.round(mp), cycle_time: cycle.value });
      setHelperForm({ name: "", manpower: "", cycle_time: "" });
      invalidateAfterHelperChange();
    } catch (e) {
      toast({ title: getApiErrorMessage(e, t("ep.common.failedSave")), status: "error", duration: 4000, position: "bottom-right" });
    } finally {
      setSavingHelper(false);
    }
  };

  const saveHelperEdit = async () => {
    if (!editingHelper) return;
    const mp = Number(editingHelper.manpower.trim());
    if (!Number.isFinite(mp) || mp <= 0) {
      toast({ title: t("vlLayouts.processDetail.helperManpowerInvalid"), status: "warning", duration: 2500, position: "bottom-right" });
      return;
    }
    const cycle = parseHelperCycleTime(editingHelper.cycle_time);
    if (!cycle.ok) {
      toast({ title: t("vlLayouts.processDetail.helperCycleTimeInvalid"), status: "warning", duration: 2500, position: "bottom-right" });
      return;
    }
    setSavingHelper(true);
    try {
      await patchLayoutProcessHelper(editingHelper.pk, { name: editingHelper.name.trim(), manpower: Math.round(mp), cycle_time: cycle.value });
      setEditingHelper(null);
      invalidateAfterHelperChange();
    } catch (e) {
      toast({ title: getApiErrorMessage(e, t("ep.common.failedSave")), status: "error", duration: 4000, position: "bottom-right" });
    } finally {
      setSavingHelper(false);
    }
  };

  const removeHelper = async (pk: number) => {
    try {
      await deleteLayoutProcessHelper(pk);
      invalidateAfterHelperChange();
    } catch (e) {
      toast({ title: getApiErrorMessage(e, t("ep.common.failedSave")), status: "error", duration: 4000, position: "bottom-right" });
    }
  };

  const { data: parentModule } = useQuery({
    queryKey: ["layoutModuleDetail", process?.layout_module],
    queryFn: () => getLayoutModuleDetail(process!.layout_module),
    enabled: !!process?.layout_module
  });

  const { data: prodProcess } = useQuery({
    queryKey: ["processDetail", processPk],
    queryFn: async () => {
      try {
        return await getProcessDetail(processPk);
      } catch {
        return null;
      }
    },
    enabled: Number.isFinite(processPk) && processPk > 0
  });

  const mergedPhotos = useMemo(() => {
    const a = process?.photos ?? [];
    const b = prodProcess?.photos ?? [];
    const seen = new Set<string>();
    const out: Array<{ pk: string | number; file: string }> = [];
    for (const p of [...a, ...b]) {
      const file = (p as { file: string }).file;
      if (file && !seen.has(file)) {
        seen.add(file);
        out.push(p as { pk: string | number; file: string });
      }
    }
    return out;
  }, [process?.photos, prodProcess?.photos]);

  const mergedVideos = useMemo(() => {
    const a = process?.videos ?? [];
    const b = prodProcess?.videos ?? [];
    const seen = new Set<string>();
    const out: IProcessVideo[] = [];
    for (const v of [...a, ...b]) {
      if (v.VideoFile && !seen.has(v.VideoFile)) {
        seen.add(v.VideoFile);
        out.push(v);
      }
    }
    return out;
  }, [process?.videos, prodProcess?.videos]);

  const processLabelByPk = useMemo(() => {
    const m = new Map<number, string>();
    if (!layoutStyle?.layout_modules) return m;
    for (const mod of layoutStyle.layout_modules) {
      for (const p of mod.layout_processes ?? []) m.set(p.pk, `[${mod.code}] ${p.code} ${p.name || ""}`.trim());
    }
    return m;
  }, [layoutStyle]);

  const otherProcessOptions = useMemo(() => {
    if (!layoutStyle?.layout_modules) return [];
    const out: { pk: number; label: string }[] = [];
    for (const mod of layoutStyle.layout_modules) {
      for (const p of mod.layout_processes ?? []) {
        if (p.pk === processPk) continue;
        out.push({ pk: p.pk, label: `[${mod.code}] ${p.code} ${p.name || ""}`.trim() });
      }
    }
    return out.sort((a, b) => a.label.localeCompare(b.label));
  }, [layoutStyle, processPk]);

  const displayPrevPk = useMemo(() => normalizeSamProcessFk(process?.previous_process ?? process?.previous_process_id), [process]);
  const displayNextPk = useMemo(() => normalizeSamProcessFk(process?.next_process ?? process?.next_process_id), [process]);
  const displayMachinePk = useMemo(() => (process ? samProcessSjMachinePk(process) : null), [process]);

  const { data: layoutTools = [] } = useQuery({
    queryKey: ["layoutTools"],
    queryFn: () => getLayoutTools()
  });

  const [isEditing, setIsEditing] = useState(false);
  const [selectedToolPk, setSelectedToolPk] = useState<number | "">("");
  const [form, setForm] = useState({
    sort_order: "",
    code: "",
    name: "",
    name_ko: "",
    name_en: "",
    cycle_seconds_override: "",
    prep_seconds: "",
    machining_seconds: "",
    finishing_seconds: "",
    manpower: "",
    flow: "",
    description: "",
    standard_work_video_url: "",
    prev_process_pk: "",
    next_process_pk: ""
  });
  const [isSaving, setIsSaving] = useState(false);

  const startEdit = () => {
    if (!process) return;
    const prevPk = normalizeSamProcessFk(process.previous_process ?? process.previous_process_id);
    const nextPk = normalizeSamProcessFk(process.next_process ?? process.next_process_id);
    const storedCycleSec = parseSamSecondsField(process.cycle_time);
    const partsSumSec = samProcessCycleSecondsFromParts(process);
    const cycleIsManual = storedCycleSec != null && storedCycleSec !== partsSumSec;
    setForm({
      sort_order: process.sort_order != null && Number.isFinite(process.sort_order) ? String(process.sort_order) : "",
      code: process.code,
      name: process.name ?? "",
      name_ko: process.name_ko ?? "",
      name_en: process.name_en ?? "",
      cycle_seconds_override: cycleIsManual && storedCycleSec != null ? formatSamCycleSecondsDisplay(storedCycleSec) : "",
      prep_seconds: process.prep_seconds ?? "",
      machining_seconds: process.machining_seconds ?? "",
      finishing_seconds: process.finishing_seconds ?? "",
      manpower: process.manpower != null ? String(process.manpower) : "",
      flow: process.flow ?? "",
      description: process.description ?? "",
      standard_work_video_url: process.standard_work_video_url ?? "",
      prev_process_pk: prevPk != null ? String(prevPk) : "",
      next_process_pk: nextPk != null ? String(nextPk) : ""
    });
    const rawTool = process.layout_tool_id ?? process.layout_tool;
    const toolPk = typeof rawTool === "object" && rawTool != null ? rawTool.pk : rawTool;
    setSelectedToolPk(typeof toolPk === "number" ? toolPk : "");
    setIsEditing(true);
  };

  const handleSave = async () => {
    if (!form.code.trim()) {
      toast({ title: t("vlLayouts.processDetail.codeRequired"), status: "warning", duration: 2000, position: "bottom-right" });
      return;
    }
    const parseOptFk = (s: string): number | null => {
      const tr = s.trim();
      if (tr === "") return null;
      const n = Number(tr);
      return Number.isFinite(n) ? n : null;
    };
    const prevFk = parseOptFk(form.prev_process_pk);
    const nextFk = parseOptFk(form.next_process_pk);
    if ((form.prev_process_pk.trim() !== "" && prevFk === null) || (form.next_process_pk.trim() !== "" && nextFk === null)) {
      toast({ title: t("vlLayouts.processDetail.precedenceInvalid"), status: "warning", duration: 3000, position: "bottom-right" });
      return;
    }
    setIsSaving(true);
    try {
      const cycleOverrideSec = form.cycle_seconds_override.trim() !== "" ? parseSamSecondsField(form.cycle_seconds_override) : null;
      const cycleSec = cycleOverrideSec ?? samProcessCycleSecondsFromFormStrings(form.prep_seconds, form.machining_seconds, form.finishing_seconds);
      const rawSo = form.sort_order.trim();
      let sortOrderPatch: number | null;
      if (rawSo === "") {
        sortOrderPatch = null;
      } else {
        const n = Number(rawSo);
        if (!Number.isInteger(n) || n < 0) {
          toast({ title: t("vlLayouts.detail.processSortOrderInvalid"), status: "warning", duration: 2500, position: "bottom-right" });
          setIsSaving(false);
          return;
        }
        sortOrderPatch = n;
      }
      const rawMp = form.manpower.trim();
      let manpowerPatch: number | null;
      if (rawMp === "") {
        manpowerPatch = null;
      } else {
        const n = Number(rawMp);
        if (!Number.isInteger(n) || n < 0) {
          toast({ title: t("vlLayouts.processDetail.manpowerInvalid"), status: "warning", duration: 2500, position: "bottom-right" });
          setIsSaving(false);
          return;
        }
        manpowerPatch = n;
      }
      const raw = await patchLayoutProcess(processPk, {
        code: form.code.trim(),
        name: form.name.trim(),
        name_ko: form.name_ko.trim(),
        name_en: form.name_en.trim(),
        cycle_time: cycleSec != null ? formatSamCycleSecondsForApi(cycleSec) : null,
        prep_seconds: sanitizeSamSecondsStringForApi(form.prep_seconds),
        machining_seconds: sanitizeSamSecondsStringForApi(form.machining_seconds),
        finishing_seconds: sanitizeSamSecondsStringForApi(form.finishing_seconds),
        flow: form.flow.trim(),
        description: form.description.trim(),
        standard_work_video_url: form.standard_work_video_url.trim() || "",
        previous_process: prevFk,
        next_process: nextFk,
        sort_order: sortOrderPatch,
        manpower: manpowerPatch,
        layout_tool: selectedToolPk === "" ? null : selectedToolPk,
        layout_tool_id: selectedToolPk === "" ? null : selectedToolPk
      });
      const updated = normalizeLayoutProcessForCache(raw);
      queryClient.setQueryData(["layoutProcessDetail", processPk], updated);
      queryClient.setQueryData(["layoutStyle", stylePk], (old: ILayoutStyleDetail | undefined) => {
        if (!old?.layout_modules) return old;
        return {
          ...old,
          layout_modules: old.layout_modules.map((m) => ({
            ...m,
            layout_processes: (m.layout_processes ?? []).map((p) => (p.pk === updated.pk ? { ...p, ...updated } : p))
          }))
        };
      });
      toast({ title: t("vlLayouts.detail.saved"), status: "success", duration: 2000, position: "bottom-right" });
      queryClient.invalidateQueries({ queryKey: ["processDetail", processPk] });
      queryClient.invalidateQueries({ queryKey: ["layoutModuleDetail", process?.layout_module] });
      setIsEditing(false);
    } catch (e: unknown) {
      let msg = t("ep.common.failedSave");
      if (axios.isAxiosError(e) && e.response?.data != null) {
        const raw = e.response.data;
        if (typeof raw === "string") {
          msg = raw.slice(0, 400);
        } else if (typeof raw === "object" && raw !== null && !Array.isArray(raw)) {
          const o = raw as Record<string, unknown>;
          if (typeof o.detail === "string") {
            msg = o.detail;
          } else {
            const parts = Object.entries(o).map(([k, v]) => `${k}: ${typeof v === "string" ? v : JSON.stringify(v)}`);
            if (parts.length) msg = parts.join("; ").slice(0, 400);
          }
        }
      }
      toast({ title: msg, status: "error", duration: 8000, position: "bottom-right" });
    } finally {
      setIsSaving(false);
    }
  };

  const { isOpen: isDeleteOpen, onOpen: onDeleteOpen, onClose: onDeleteClose } = useDisclosure();
  const cancelRef = useRef<HTMLButtonElement>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    const modPk = process?.layout_module;
    setIsDeleting(true);
    try {
      await deleteLayoutProcess(processPk);
      toast({ title: t("vlLayouts.processDetail.deleted"), status: "success", duration: 2000, position: "bottom-right" });
      queryClient.invalidateQueries({ queryKey: ["layoutStyle", stylePk] });
      queryClient.invalidateQueries({ queryKey: ["processDetail", processPk] });
      if (modPk) queryClient.invalidateQueries({ queryKey: ["layoutModuleDetail", modPk] });
      navigate(modPk ? `/vl-layouts/${layoutStyleId}/modules/${modPk}` : `/vl-layouts/${layoutStyleId}`);
    } catch {
      toast({ title: t("ep.common.failedSave"), status: "error", duration: 2000, position: "bottom-right" });
    } finally {
      setIsDeleting(false);
      onDeleteClose();
    }
  };

  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [selectedVideoUrl, setSelectedVideoUrl] = useState<string | null>(null);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [pendingPreviews, setPendingPreviews] = useState<string[]>([]);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [pendingVideoFile, setPendingVideoFile] = useState<File | null>(null);
  const [isUploadingVideo, setIsUploadingVideo] = useState(false);
  const videoInputRef = useRef<HTMLInputElement>(null);

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
    if (!pendingFiles.length || !process) return;
    setIsUploadingPhoto(true);
    try {
      for (const file of pendingFiles) {
        const urlData = await getUploadURL();
        const dt = new DataTransfer();
        dt.items.add(file);
        const cfResult = (await uploadImage({ file: dt.files, uploadURL: urlData.uploadURL })) as { result?: { id?: string }; id?: string } | undefined;
        const id = cfResult?.result?.id ?? cfResult?.id;
        if (!id) throw new Error("upload");
        const cfUrl = `https://imagedelivery.net/mzmXhxWLR9jzdX8u9g4BBQ/${id}/public`;
        await createLayoutProcessPhoto({ file: cfUrl, processPk: process.pk, description: process.code ?? "" });
      }
      queryClient.invalidateQueries({ queryKey: ["layoutProcessDetail", processPk] });
      queryClient.invalidateQueries({ queryKey: ["processDetail", processPk] });
      queryClient.invalidateQueries({ queryKey: ["layoutStyle", stylePk] });
      setPendingFiles([]);
      setPendingPreviews([]);
      toast({ title: t("vlLayouts.moduleDetail.uploadedPhotos"), status: "success", duration: 2000, position: "bottom-right" });
    } catch (e: unknown) {
      const msg = axios.isAxiosError(e) && e.response?.data != null ? (typeof e.response.data === "string" ? e.response.data : JSON.stringify(e.response.data)) : t("ep.common.failedSave");
      toast({ title: msg.slice(0, 280), status: "error", duration: 5000, position: "bottom-right" });
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const handleDeletePhoto = async (photoPk: number | string) => {
    try {
      await deleteLayoutProcessPhoto(processPk, photoPk);
      queryClient.invalidateQueries({ queryKey: ["layoutProcessDetail", processPk] });
      queryClient.invalidateQueries({ queryKey: ["processDetail", processPk] });
      queryClient.invalidateQueries({ queryKey: ["layoutStyle", stylePk] });
      toast({ title: t("vlLayouts.moduleDetail.deletedPhoto"), status: "success", duration: 2000, position: "bottom-right" });
    } catch {
      toast({ title: t("ep.common.failedSave"), status: "error", duration: 2000, position: "bottom-right" });
    }
  };

  const handleVideoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPendingVideoFile(file);
    if (videoInputRef.current) videoInputRef.current.value = "";
  };

  const handleUploadVideo = async () => {
    if (!pendingVideoFile || !process) return;
    setIsUploadingVideo(true);
    try {
      const urlData = await getUploadVideoURL();
      const uid: string = urlData.id;
      const dt = new DataTransfer();
      dt.items.add(pendingVideoFile);
      await uploadVideo({ file: dt.files, uploadURL: urlData.uploadURL });
      const videoData: { uid?: string; thumbnail?: string } = await getVideoData(uid);
      const VideoFile = `https://customer-kc2gx0yn68qxte35.cloudflarestream.com/${videoData.uid}/iframe`;
      const ThumbnailFile = videoData?.thumbnail ?? "";
      await createLayoutProcessVideo({ VideoFile, ThumbnailFile, processPk: process.pk, description: process.code ?? "" });
      queryClient.invalidateQueries({ queryKey: ["layoutProcessDetail", processPk] });
      queryClient.invalidateQueries({ queryKey: ["processDetail", processPk] });
      queryClient.invalidateQueries({ queryKey: ["layoutStyle", stylePk] });
      setPendingVideoFile(null);
      toast({ title: t("vlLayouts.processDetail.uploadedVideo"), status: "success", duration: 2000, position: "bottom-right" });
    } catch {
      toast({ title: t("vlLayouts.processDetail.videoUploadFailed"), status: "error", duration: 3000, position: "bottom-right" });
    } finally {
      setIsUploadingVideo(false);
    }
  };

  const handleDeleteVideo = async (videoPk: number) => {
    try {
      await deleteLayoutProcessVideo(processPk, videoPk);
      queryClient.invalidateQueries({ queryKey: ["layoutProcessDetail", processPk] });
      queryClient.invalidateQueries({ queryKey: ["processDetail", processPk] });
      queryClient.invalidateQueries({ queryKey: ["layoutStyle", stylePk] });
      toast({ title: t("vlLayouts.processDetail.deletedVideo"), status: "success", duration: 2000, position: "bottom-right" });
    } catch {
      toast({ title: t("ep.common.failedSave"), status: "error", duration: 2000, position: "bottom-right" });
    }
  };

  const handleSetStandard = async (videoFile: string) => {
    try {
      await patchLayoutProcess(processPk, { standard_work_video_url: videoFile });
      queryClient.invalidateQueries({ queryKey: ["layoutProcessDetail", processPk] });
      queryClient.invalidateQueries({ queryKey: ["processDetail", processPk] });
      toast({ title: t("vlLayouts.processDetail.standardVideoSet"), status: "success", duration: 2000, position: "bottom-right" });
    } catch {
      toast({ title: t("ep.common.failedSave"), status: "error", duration: 2000, position: "bottom-right" });
    }
  };

  const handleClearStandard = async () => {
    try {
      await patchLayoutProcess(processPk, { standard_work_video_url: "" });
      queryClient.invalidateQueries({ queryKey: ["layoutProcessDetail", processPk] });
      queryClient.invalidateQueries({ queryKey: ["processDetail", processPk] });
      toast({ title: t("vlLayouts.processDetail.standardVideoCleared"), status: "success", duration: 2000, position: "bottom-right" });
    } catch {
      toast({ title: t("ep.common.failedSave"), status: "error", duration: 2000, position: "bottom-right" });
    }
  };

  if (!Number.isFinite(processPk) || processPk <= 0) {
    return (
      <Center minH="40vh">
        <Text>Invalid process.</Text>
      </Center>
    );
  }

  if (isLoading) {
    return (
      <Center minH="60vh">
        <Spinner size="xl" />
      </Center>
    );
  }

  if (!process || !parentModule || parentModule.layout_style !== stylePk) {
    return (
      <Center minH="60vh">
        <Text color="gray.500">{t("vlLayouts.processDetail.notFound")}</Text>
      </Center>
    );
  }

  return (
    <>
      <Helmet>
        <title>
          {process.code} — {t("vlLayouts.processDetail.pageTitle")}
        </title>
      </Helmet>
      <Box bg={pageBg} minH="100vh" px={{ base: 4, md: 8, lg: 12 }} py={{ base: 6, md: 8 }}>
        <Box maxW="4xl" mx="auto">
          <HStack mb={4} justify="flex-end" flexWrap="wrap" gap={2}>
            <HStack spacing={2}>
              {isEditing ? (
                <>
                  <Button size="sm" variant="ghost" onClick={() => setIsEditing(false)}>
                    {t("vlLayouts.common.cancel")}
                  </Button>
                  <Button size="sm" colorScheme="blue" isLoading={isSaving} onClick={handleSave}>
                    {t("vlLayouts.detail.saveMeta")}
                  </Button>
                </>
              ) : (
                <>
                  <Button size="sm" leftIcon={<FaEdit />} variant="ghost" onClick={startEdit}>
                    {t("vlLayouts.processDetail.edit")}
                  </Button>
                  <Button size="sm" leftIcon={<FaTrash />} variant="ghost" colorScheme="red" onClick={onDeleteOpen}>
                    {t("vlLayouts.processDetail.delete")}
                  </Button>
                </>
              )}
            </HStack>
          </HStack>

          <Text fontSize="sm" color={labelColor} mb={4}>
            <RouterLink to={`/vl-layouts/${layoutStyleId}`}>
              <Text as="span" color="blue.500" fontWeight="medium">
                {layoutStyle?.sj_style?.code ?? "LAYOUT"}
              </Text>
            </RouterLink>
            {parentModule.module_category_name ? (
              <>
                {" · "}
                <Text as="span" color="gray.600">
                  {parentModule.module_category_name}
                </Text>
              </>
            ) : null}
            {" · "}
            {t("vlLayouts.processDetail.breadcrumb")}
          </Text>

          <Box position="relative" mb={6}>
            <Box bg={cardBg} borderRadius="xl" border="1px solid" borderColor={borderColor} p={6} shadow="sm">
              <HStack align="baseline" spacing={3} mb={5} flexWrap="wrap">
                {isEditing ? (
                  <>
                    <FormControl w="80px" alignSelf="center">
                      <FormLabel fontSize="xs" mb={0} color="gray.500">
                        <VisuallyHidden>{t("vlLayouts.detail.col.sort_order")}</VisuallyHidden>
                      </FormLabel>
                      <Input
                        type="number"
                        min={0}
                        step={1}
                        size="sm"
                        aria-label={t("vlLayouts.detail.col.sort_order")}
                        value={form.sort_order}
                        onChange={(e) => setForm({ ...form, sort_order: e.target.value })}
                        placeholder="0"
                      />
                    </FormControl>
                    <SamBadge kind="layoutProcess" alignSelf="center" />
                    <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} fontWeight="bold" fontSize="lg" w="200px" />
                    <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} fontSize="md" flex={1} minW="200px" />
                  </>
                ) : (
                  <>
                    <Box alignSelf="center">
                      <SamSortOrderBadge sortOrder={process.sort_order} size="md" />
                    </Box>
                    <SamBadge kind="layoutProcess" alignSelf="center" />
                    <Heading size="md">{process.code}</Heading>
                    {process.name && (
                      <Text fontSize="lg" color="gray.500">
                        {process.name}
                      </Text>
                    )}
                  </>
                )}
                {parentModule.module_category_name ? (
                  <Badge colorScheme={samCategoryColorScheme(parentModule.module_category)} fontSize="0.7rem" alignSelf="center">
                    {parentModule.module_category_name}
                  </Badge>
                ) : null}
              </HStack>

              <HStack spacing={8} flexWrap="wrap" align="flex-start" mb={6}>
                <InfoRow label={t("vlLayouts.moduleDetail.category")} labelColor={labelColor}>
                  <Text fontSize="sm">{parentModule.module_category_name || "—"}</Text>
                </InfoRow>
                <InfoRow label={t("vlLayouts.processDetail.samModule")} labelColor={labelColor}>
                  <RouterLink to={`/vl-layouts/${layoutStyleId}/modules/${parentModule.pk}`}>
                    <Text as="span" color="blue.500" fontSize="sm">
                      [{parentModule.code}] {parentModule.name || "—"}
                    </Text>
                  </RouterLink>
                </InfoRow>
                <InfoRow label={t("vlLayouts.processDetail.updated")} labelColor={labelColor}>
                  <Text fontSize="sm">{formatIsoDateTimeDisplay(process.updated_at, i18n.language)}</Text>
                </InfoRow>
                <InfoRow label={t("vlLayouts.processDetail.layoutTool")} labelColor={labelColor}>
                  {isEditing ? (
                    <Select
                      size="sm"
                      placeholder={t("vlLayouts.processDetail.layoutToolPlaceholder")}
                      value={selectedToolPk}
                      onChange={(e) => setSelectedToolPk(e.target.value ? Number(e.target.value) : "")}
                    >
                      {layoutTools.map((tool) => (
                        <option key={tool.pk} value={tool.pk}>
                          {tool.name?.trim() ? `${tool.code} — ${tool.name}` : tool.code}
                        </option>
                      ))}
                    </Select>
                  ) : process.layout_tool_name ? (
                    <Text fontSize="sm">{process.layout_tool_name}</Text>
                  ) : displayMachinePk != null ? (
                    <Link as={RouterLink} to={`/machines/${displayMachinePk}`} color="blue.500" fontSize="sm">
                      {samProcessSjMachineLabel(process) ?? `#${displayMachinePk}`}
                    </Link>
                  ) : (
                    <Text fontSize="sm" color="gray.400">
                      —
                    </Text>
                  )}
                </InfoRow>
                <InfoRow label={t("vlLayouts.processDetail.draftProcessMotion")} labelColor={labelColor}>
                  {process.sj_motion != null ? (
                    <Link
                      href="#"
                      color="purple.500"
                      fontSize="sm"
                      onClick={(e) => {
                        e.preventDefault();
                        openAppPopupWindow(`/motion-analysis/${process.sj_motion}`);
                      }}
                    >
                      <HStack spacing={1} align="center">
                        <FaFilm size={12} />
                        <Text as="span">#{process.sj_motion}</Text>
                        <FaExternalLinkAlt size={10} />
                      </HStack>
                    </Link>
                  ) : (
                    <Text fontSize="sm" color="gray.400">
                      —
                    </Text>
                  )}
                </InfoRow>
              </HStack>

              <Text fontSize="xs" color={labelColor} fontWeight="semibold" mb={2}>
                {t("vlLayouts.processDetail.precedenceTitle")}
              </Text>
              <Text fontSize="xs" color={labelColor} mb={3}>
                {t("vlLayouts.processDetail.precedenceHint")}
              </Text>
              <Grid templateColumns={{ base: "1fr", md: "1fr 1fr" }} gap={4} mb={6}>
                <InfoRow label={t("vlLayouts.processDetail.previousProcess")} labelColor={labelColor}>
                  {isEditing ? (
                    <Select size="sm" mt={1} value={form.prev_process_pk} onChange={(e) => setForm((f) => ({ ...f, prev_process_pk: e.target.value }))}>
                      <option value="">{t("vlLayouts.moduleDetail.precedenceNone")}</option>
                      {otherProcessOptions.map((o) => (
                        <option key={o.pk} value={String(o.pk)}>
                          {o.label}
                        </option>
                      ))}
                    </Select>
                  ) : (
                    <Text fontSize="sm">
                      {displayPrevPk != null ? (
                        <Link
                          href="#"
                          color="blue.500"
                          onClick={(e) => {
                            e.preventDefault();
                            openAppPopupWindow(`/vl-layouts/${layoutStyleId}/processes/${displayPrevPk}`, { width: 1680, height: 960 });
                          }}
                        >
                          {processLabelByPk.get(displayPrevPk) ?? `#${displayPrevPk}`}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </Text>
                  )}
                </InfoRow>
                <InfoRow label={t("vlLayouts.processDetail.nextProcess")} labelColor={labelColor}>
                  {isEditing ? (
                    <Select size="sm" mt={1} value={form.next_process_pk} onChange={(e) => setForm((f) => ({ ...f, next_process_pk: e.target.value }))}>
                      <option value="">{t("vlLayouts.moduleDetail.precedenceNone")}</option>
                      {otherProcessOptions.map((o) => (
                        <option key={o.pk} value={String(o.pk)}>
                          {o.label}
                        </option>
                      ))}
                    </Select>
                  ) : (
                    <Text fontSize="sm">
                      {displayNextPk != null ? (
                        <Link
                          href="#"
                          color="blue.500"
                          onClick={(e) => {
                            e.preventDefault();
                            openAppPopupWindow(`/vl-layouts/${layoutStyleId}/processes/${displayNextPk}`, { width: 1680, height: 960 });
                          }}
                        >
                          {processLabelByPk.get(displayNextPk) ?? `#${displayNextPk}`}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </Text>
                  )}
                </InfoRow>
              </Grid>

              <SimpleFields isEditing={isEditing} form={form} setForm={setForm} process={process} labelColor={labelColor} t={t} upmhDivisorSeconds={upmhDivisorSeconds} />

              <Divider my={5} />
              <InfoRow label={t("vlLayouts.processDetail.standardVideo")} labelColor={labelColor}>
                {isEditing ? (
                  <Input
                    size="sm"
                    mt={1}
                    value={form.standard_work_video_url}
                    onChange={(e) => setForm({ ...form, standard_work_video_url: e.target.value })}
                    placeholder="https://..."
                  />
                ) : (
                  <StandardVideoDisplay
                    process={process}
                    videos={mergedVideos}
                    photoBorderColor={photoBorderColor}
                    videoBg={videoBg}
                    setSelectedVideoUrl={setSelectedVideoUrl}
                    onClear={handleClearStandard}
                  />
                )}
              </InfoRow>
            </Box>
          </Box>

          <Box bg={cardBg} borderRadius="xl" border="1px solid" borderColor={borderColor} p={6} shadow="sm" mt={6}>
            <Text fontWeight="semibold" mb={1}>
              {t("vlLayouts.processDetail.helpersTitle")}
            </Text>
            <Text fontSize="sm" color={labelColor} mb={4}>
              {t("vlLayouts.processDetail.helpersHint")}
            </Text>

            {(process.helpers ?? []).length === 0 ? (
              <Text fontSize="sm" color={labelColor} mb={4}>
                {t("vlLayouts.processDetail.helpersEmpty")}
              </Text>
            ) : (
              <VStack align="stretch" spacing={2} mb={4}>
                {(process.helpers ?? []).map((h: ILayoutProcessHelper) => {
                  const isEditingThis = editingHelper?.pk === h.pk;
                  return (
                    <HStack key={h.pk} p={2} borderWidth="1px" borderColor={borderColor} borderRadius="md" justify="space-between">
                      {isEditingThis ? (
                        <>
                          <Input
                            size="sm"
                            value={editingHelper.name}
                            onChange={(e) => setEditingHelper((f) => (f ? { ...f, name: e.target.value } : f))}
                            placeholder={t("vlLayouts.processDetail.helperNamePlaceholder")}
                            maxW="200px"
                          />
                          <Input
                            size="sm"
                            type="number"
                            min={0}
                            step="0.01"
                            placeholder={t("vlLayouts.detail.col.cycle")}
                            value={editingHelper.cycle_time}
                            onChange={(e) => setEditingHelper((f) => (f ? { ...f, cycle_time: e.target.value } : f))}
                            maxW="90px"
                          />
                          <Input
                            size="sm"
                            type="number"
                            min={1}
                            value={editingHelper.manpower}
                            onChange={(e) => setEditingHelper((f) => (f ? { ...f, manpower: e.target.value } : f))}
                            maxW="90px"
                          />
                          <HStack spacing={1}>
                            <Button size="xs" colorScheme="blue" onClick={saveHelperEdit} isLoading={savingHelper}>
                              {t("vlLayouts.common.save")}
                            </Button>
                            <Button size="xs" variant="ghost" onClick={() => setEditingHelper(null)}>
                              {t("vlLayouts.common.cancel")}
                            </Button>
                          </HStack>
                        </>
                      ) : (
                        <>
                          <HStack spacing={2}>
                            <Box as="span" color="purple.400" display="inline-flex">
                              <FaUserFriends size={13} />
                            </Box>
                            <Text fontSize="sm">{h.name || t("vlLayouts.detail.helperUnnamed")}</Text>
                          </HStack>
                          <HStack spacing={3}>
                            {h.cycle_time != null && (
                              <Badge colorScheme="teal" fontSize="0.7rem">
                                {formatSamCycleSecondsDisplay(parseSamSecondsField(h.cycle_time) ?? 0)}s
                              </Badge>
                            )}
                            <Badge colorScheme="purple" fontSize="0.7rem">
                              {t("vlLayouts.processDetail.helperManpowerBadge", { count: h.manpower })}
                            </Badge>
                            <IconButton
                              aria-label={t("vlLayouts.common.edit")}
                              icon={<FaEdit />}
                              size="xs"
                              variant="ghost"
                              onClick={() => setEditingHelper({ pk: h.pk, name: h.name, manpower: String(h.manpower), cycle_time: h.cycle_time ?? "" })}
                            />
                            <IconButton
                              aria-label={t("vlLayouts.common.delete")}
                              icon={<FaTrashAlt />}
                              size="xs"
                              variant="ghost"
                              colorScheme="red"
                              onClick={() => void removeHelper(h.pk)}
                            />
                          </HStack>
                        </>
                      )}
                    </HStack>
                  );
                })}
              </VStack>
            )}

            <HStack>
              <Input
                size="sm"
                placeholder={t("vlLayouts.processDetail.helperNamePlaceholder")}
                value={helperForm.name}
                onChange={(e) => setHelperForm((f) => ({ ...f, name: e.target.value }))}
                maxW="220px"
              />
              <Input
                size="sm"
                type="number"
                min={0}
                step="0.01"
                placeholder={t("vlLayouts.detail.col.cycle")}
                value={helperForm.cycle_time}
                onChange={(e) => setHelperForm((f) => ({ ...f, cycle_time: e.target.value }))}
                maxW="100px"
              />
              <Input
                size="sm"
                type="number"
                min={1}
                placeholder={t("vlLayouts.processDetail.manpower")}
                value={helperForm.manpower}
                onChange={(e) => setHelperForm((f) => ({ ...f, manpower: e.target.value }))}
                maxW="100px"
              />
              <Button size="sm" leftIcon={<FaPlus />} onClick={addHelper} isLoading={savingHelper} colorScheme="blue" variant="outline">
                {t("vlLayouts.processDetail.addHelper")}
              </Button>
            </HStack>
          </Box>

          <MeasurementComparisonSection
            process={process}
            originalPhotos={mergedPhotos}
            originalVideos={mergedVideos}
            upmhDivisorSeconds={upmhDivisorSeconds}
            labelColor={labelColor}
            cardBg={cardBg}
            borderColor={borderColor}
            lang={i18n.language}
            isEditing={isEditing}
            setLightboxSrc={setLightboxSrc}
            setSelectedVideoUrl={setSelectedVideoUrl}
            t={t}
          />

          <Box bg={cardBg} borderRadius="xl" border="1px solid" borderColor={borderColor} p={6} shadow="sm" mb={6}>
            <Heading size="sm" mb={3}>
              {t("vlLayouts.processDetail.flow")}
            </Heading>
            <Divider mb={3} />
            {isEditing ? (
              <Textarea value={form.flow} onChange={(e) => setForm({ ...form, flow: e.target.value })} rows={4} fontSize="sm" />
            ) : (
              <Box bg={textareaBg} borderRadius="md" p={4} fontSize="sm" whiteSpace="pre-wrap" minH="60px" color={process.flow ? undefined : "gray.400"}>
                {process.flow || t("vlLayouts.processDetail.emptyFlow")}
              </Box>
            )}
          </Box>

          <Box bg={cardBg} borderRadius="xl" border="1px solid" borderColor={borderColor} p={6} shadow="sm" mb={6}>
            <Heading size="sm" mb={3}>
              {t("vlLayouts.processDetail.description")}
            </Heading>
            <Divider mb={3} />
            {isEditing ? (
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={4} fontSize="sm" />
            ) : (
              <Box bg={textareaBg} borderRadius="md" p={4} fontSize="sm" whiteSpace="pre-wrap" minH="60px" color={process.description ? undefined : "gray.400"}>
                {process.description || t("vlLayouts.processDetail.emptyDescription")}
              </Box>
            )}
          </Box>

          <Box bg={cardBg} borderRadius="xl" border="1px solid" borderColor={borderColor} p={6} shadow="sm" mb={6}>
            <HStack justify="space-between" mb={4}>
              <Heading size="sm">{t("vlLayouts.moduleDetail.photosTitle")}</Heading>
              <Button size="sm" leftIcon={<FaCamera />} variant="outline" onClick={() => photoInputRef.current?.click()}>
                {t("vlLayouts.moduleDetail.addPhotos")}
              </Button>
              <input ref={photoInputRef} type="file" accept="image/*" multiple style={{ display: "none" }} onChange={handlePhotoSelect} />
            </HStack>
            <Divider mb={4} />

            {pendingPreviews.length > 0 && (
              <Box mb={5}>
                <Grid templateColumns="repeat(auto-fill, minmax(120px, 1fr))" gap={3} mb={3}>
                  {pendingPreviews.map((src, idx) => (
                    <Box key={idx} position="relative" borderRadius="md" overflow="hidden" border="2px dashed" borderColor="blue.300">
                      <Image src={src} w="full" h="100px" objectFit="cover" />
                      <Button size="xs" colorScheme="red" position="absolute" top={1} right={1} onClick={() => removePendingPhoto(idx)}>
                        <FaTrashAlt />
                      </Button>
                    </Box>
                  ))}
                </Grid>
                <Button size="sm" colorScheme="blue" isLoading={isUploadingPhoto} onClick={handleUploadPhotos}>
                  {t("vlLayouts.moduleDetail.uploadN", { count: pendingPreviews.length })}
                </Button>
              </Box>
            )}

            {mergedPhotos.length === 0 && pendingPreviews.length === 0 ? (
              <Text color="gray.400" textAlign="center" py={6}>
                {t("vlLayouts.moduleDetail.noPhotos")}
              </Text>
            ) : (
              <Grid templateColumns="repeat(auto-fill, minmax(150px, 1fr))" gap={4}>
                {mergedPhotos.map((photo) => (
                  <Box
                    key={photo.pk}
                    position="relative"
                    borderRadius="md"
                    overflow="hidden"
                    border="1px solid"
                    borderColor={photoBorderColor}
                    cursor="pointer"
                    onClick={() => setLightboxSrc(photo.file)}
                    _hover={{ opacity: 0.85 }}
                  >
                    <Image src={photo.file} w="full" h="130px" objectFit="cover" />
                    <Button
                      size="xs"
                      colorScheme="red"
                      position="absolute"
                      top={1}
                      right={1}
                      onClick={(e) => {
                        e.stopPropagation();
                        void handleDeletePhoto(photo.pk);
                      }}
                    >
                      <FaTrashAlt />
                    </Button>
                  </Box>
                ))}
              </Grid>
            )}
          </Box>

          <Box bg={cardBg} borderRadius="xl" border="1px solid" borderColor={borderColor} p={6} shadow="sm" mb={6}>
            <HStack justify="space-between" mb={4} flexWrap="wrap" gap={2}>
              <Heading size="sm">{t("vlLayouts.processDetail.videosTitle")}</Heading>
              <Button size="sm" leftIcon={<FaVideo />} variant="outline" onClick={() => videoInputRef.current?.click()}>
                {t("vlLayouts.processDetail.addVideo")}
              </Button>
              <input ref={videoInputRef} type="file" accept="video/*" style={{ display: "none" }} onChange={handleVideoSelect} />
            </HStack>
            <Divider mb={4} />

            {pendingVideoFile && (
              <Box mb={4}>
                <Text fontSize="sm" mb={2}>
                  {pendingVideoFile.name}
                </Text>
                <Button size="sm" colorScheme="blue" isLoading={isUploadingVideo} onClick={handleUploadVideo} mr={2}>
                  {t("vlLayouts.processDetail.uploadVideo")}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setPendingVideoFile(null)}>
                  {t("vlLayouts.common.cancel")}
                </Button>
              </Box>
            )}

            {mergedVideos.length === 0 && !pendingVideoFile ? (
              <Text color="gray.400" textAlign="center" py={6}>
                {t("vlLayouts.processDetail.noVideos")}
              </Text>
            ) : (
              <Grid templateColumns="repeat(auto-fill, minmax(180px, 1fr))" gap={4}>
                {mergedVideos.map((v) => (
                  <Box key={v.pk} position="relative" borderRadius="md" overflow="hidden" border="1px solid" borderColor={photoBorderColor}>
                    <Box cursor="pointer" onClick={() => setSelectedVideoUrl(v.VideoFile)} _hover={{ opacity: 0.9 }}>
                      {v.ThumbnailFile ? (
                        <Image src={v.ThumbnailFile} w="full" h="120px" objectFit="cover" />
                      ) : (
                        <Center h="120px" bg={videoBg}>
                          <FaVideo size={28} />
                        </Center>
                      )}
                    </Box>
                    <HStack p={2} spacing={1} flexWrap="wrap">
                      <Button size="xs" variant="outline" onClick={() => handleSetStandard(v.VideoFile)}>
                        {t("vlLayouts.processDetail.setStandard")}
                      </Button>
                      <Button size="xs" colorScheme="red" onClick={() => void handleDeleteVideo(v.pk)}>
                        <FaTrashAlt />
                      </Button>
                    </HStack>
                  </Box>
                ))}
              </Grid>
            )}
          </Box>
        </Box>
      </Box>

      <AlertDialog isOpen={isDeleteOpen} leastDestructiveRef={cancelRef} onClose={onDeleteClose}>
        <AlertDialogOverlay />
        <AlertDialogContent>
          <AlertDialogHeader>{t("vlLayouts.processDetail.deleteTitle")}</AlertDialogHeader>
          <AlertDialogBody>{t("vlLayouts.processDetail.deleteBody")}</AlertDialogBody>
          <AlertDialogFooter>
            <Button ref={cancelRef} onClick={onDeleteClose}>
              {t("vlLayouts.common.cancel")}
            </Button>
            <Button colorScheme="red" onClick={handleDelete} ml={3} isLoading={isDeleting}>
              {t("vlLayouts.processDetail.delete")}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Modal isOpen={!!lightboxSrc} onClose={() => setLightboxSrc(null)} size="xl" isCentered>
        <ModalOverlay />
        <ModalContent bg="transparent" boxShadow="none">
          <ModalCloseButton color="white" zIndex={10} />
          <ModalBody p={0}>{lightboxSrc && <Image src={lightboxSrc} alt="" w="100%" maxH="80vh" objectFit="contain" borderRadius="lg" />}</ModalBody>
        </ModalContent>
      </Modal>

      <Modal isOpen={!!selectedVideoUrl} onClose={() => setSelectedVideoUrl(null)} size="4xl" isCentered>
        <ModalOverlay />
        <ModalContent maxW="900px" bg="black">
          <ModalCloseButton color="white" zIndex={10} />
          <ModalBody p={0}>{selectedVideoUrl && <Box as="iframe" src={selectedVideoUrl} w="100%" h="480px" border="none" title="video" />}</ModalBody>
        </ModalContent>
      </Modal>
    </>
  );
}

function SimpleFields({
  isEditing,
  form,
  setForm,
  process,
  labelColor,
  t,
  upmhDivisorSeconds
}: {
  isEditing: boolean;
  form: { name_ko: string; name_en: string; cycle_seconds_override: string; prep_seconds: string; machining_seconds: string; finishing_seconds: string; manpower: string };
  setForm: React.Dispatch<
    React.SetStateAction<{
      sort_order: string;
      code: string;
      name: string;
      name_ko: string;
      name_en: string;
      cycle_seconds_override: string;
      prep_seconds: string;
      machining_seconds: string;
      finishing_seconds: string;
      manpower: string;
      flow: string;
      description: string;
      standard_work_video_url: string;
      prev_process_pk: string;
      next_process_pk: string;
    }>
  >;
  process: ILayoutProcess;
  labelColor: string;
  t: (k: string, options?: Record<string, unknown>) => string;
  upmhDivisorSeconds: number;
}) {
  const row = (label: string, field: keyof typeof form, editable: boolean) => (
    <InfoRow label={label} labelColor={labelColor}>
      {isEditing && editable ? (
        <Input size="sm" value={form[field]} onChange={(e) => setForm((f) => ({ ...f, [field]: e.target.value }))} />
      ) : (
        <Text fontSize="sm">{(process as unknown as Record<string, string | null>)[field] ?? "—"}</Text>
      )}
    </InfoRow>
  );

  const autoCycleSec = samProcessCycleSecondsFromFormStrings(form.prep_seconds, form.machining_seconds, form.finishing_seconds);
  const cycleOverrideSec = form.cycle_seconds_override.trim() !== "" ? parseSamSecondsField(form.cycle_seconds_override) : null;
  const cycleSec = isEditing ? cycleOverrideSec ?? autoCycleSec : parseSamSecondsField(process.cycle_time);
  const upmh = cycleSec != null && cycleSec > 0 ? upmhDivisorSeconds / cycleSec : null;

  return (
    <Grid templateColumns={{ base: "1fr", md: "1fr 1fr" }} gap={4}>
      {row(t("vlLayouts.processDetail.nameKo"), "name_ko", true)}
      {row(t("vlLayouts.processDetail.nameEn"), "name_en", true)}
      <InfoRow label={t("vlLayouts.detail.col.cycle")} labelColor={labelColor}>
        {isEditing ? (
          <Input
            size="sm"
            value={form.cycle_seconds_override}
            placeholder={autoCycleSec != null ? formatSamCycleSecondsDisplay(autoCycleSec) : t("vlLayouts.processDetail.cyclePlaceholderAuto")}
            onChange={(e) => setForm((f) => ({ ...f, cycle_seconds_override: e.target.value }))}
          />
        ) : (
          <Text fontSize="sm">{cycleSec != null ? formatSamCycleSecondsDisplay(cycleSec) : "—"}</Text>
        )}
      </InfoRow>
      <InfoRow
        label={
          <HStack spacing={1}>
            <Text as="span">{t("vlLayouts.processDetail.upmh")}</Text>
            <Tooltip label={t("vlLayouts.processDetail.upmhTooltip")} hasArrow>
              <span>
                <FaInfoCircle size={11} />
              </span>
            </Tooltip>
          </HStack>
        }
        labelColor={labelColor}
      >
        <Text fontSize="sm">{upmh != null ? t("vlLayouts.processDetail.upmhValue", { value: upmh.toFixed(1) }) : "—"}</Text>
      </InfoRow>
      {row(t("vlLayouts.detail.col.prep"), "prep_seconds", true)}
      {row(t("vlLayouts.detail.col.mach"), "machining_seconds", true)}
      {row(t("vlLayouts.detail.col.fin"), "finishing_seconds", true)}
      <InfoRow label={t("vlLayouts.processDetail.manpower")} labelColor={labelColor}>
        {isEditing ? (
          <Input
            size="sm"
            type="number"
            min={0}
            step={1}
            value={form.manpower}
            onChange={(e) => setForm((f) => ({ ...f, manpower: e.target.value }))}
          />
        ) : (
          <Text fontSize="sm">{process.manpower ?? "—"}</Text>
        )}
      </InfoRow>
      <InfoRow
        label={
          <HStack spacing={1}>
            <Text as="span">{t("vlLayouts.processDetail.targetQtyPerHour")}</Text>
            <Tooltip label={t("vlLayouts.processDetail.targetQtyPerHourTooltip")} hasArrow>
              <span>
                <FaInfoCircle size={11} />
              </span>
            </Tooltip>
          </HStack>
        }
        labelColor={labelColor}
      >
        {(() => {
          const mp = isEditing ? (form.manpower.trim() === "" ? null : Number(form.manpower)) : process.manpower;
          if (upmh == null || mp == null || !Number.isFinite(mp) || mp <= 0) {
            return <Text fontSize="sm">—</Text>;
          }
          return (
            <HStack spacing={1.5} align="baseline">
              <Text fontSize="sm">{(upmh * mp).toFixed(1)}</Text>
              <Text fontSize="xs" color={labelColor}>
                ({upmh.toFixed(1)}pcs × {mp}MP)
              </Text>
            </HStack>
          );
        })()}
      </InfoRow>
    </Grid>
  );
}

function MeasurementStatRow({ label, value, labelColor }: { label: string; value: string; labelColor: string }) {
  return (
    <HStack justify="space-between" fontSize="xs">
      <Text color={labelColor}>{label}</Text>
      <Text fontWeight="semibold">{value}</Text>
    </HStack>
  );
}

function MeasurementRoundCard({
  round,
  processPk,
  measurement,
  upmhDivisorSeconds,
  labelColor,
  borderColor,
  onChanged,
  lang,
  isEditing,
  setLightboxSrc,
  setSelectedVideoUrl,
  t
}: {
  round: 1 | 2 | 3;
  processPk: number;
  measurement: ILayoutProcessMeasurement | null;
  upmhDivisorSeconds: number;
  labelColor: string;
  borderColor: string;
  onChanged: () => void;
  lang: string;
  isEditing: boolean;
  setLightboxSrc: (src: string | null) => void;
  setSelectedVideoUrl: (url: string | null) => void;
  t: (k: string, options?: Record<string, unknown>) => string;
}) {
  const toast = useToast();
  const [cycleInput, setCycleInput] = useState(measurement?.cycle_time ?? "");
  const [mpInput, setMpInput] = useState(measurement?.manpower != null ? String(measurement.manpower) : "");
  const [dateInput, setDateInput] = useState(measurement?.measured_at ?? "");
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setCycleInput(measurement?.cycle_time ?? "");
    setMpInput(measurement?.manpower != null ? String(measurement.manpower) : "");
    setDateInput(measurement?.measured_at ?? "");
  }, [measurement?.pk, measurement?.cycle_time, measurement?.manpower, measurement?.measured_at]);

  const cycleSec = parseSamSecondsField(cycleInput);
  const mp = mpInput.trim() === "" ? null : Number(mpInput);
  const upmh = cycleSec != null && cycleSec > 0 ? upmhDivisorSeconds / cycleSec : null;
  const total = upmh != null && mp != null && Number.isFinite(mp) && mp > 0 ? upmh * mp : null;

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const payload = {
        measured_at: dateInput.trim() === "" ? null : dateInput.trim(),
        cycle_time: cycleInput.trim() === "" ? null : cycleInput.trim(),
        manpower: mpInput.trim() === "" ? null : Number(mpInput)
      };
      if (measurement) {
        await patchLayoutProcessMeasurement(measurement.pk, payload);
      } else {
        await createLayoutProcessMeasurement({ layout_process: processPk, round, ...payload });
      }
      onChanged();
      toast({ title: t("vlLayouts.detail.saveMeta"), status: "success", duration: 1500, position: "bottom-right" });
    } catch {
      toast({ title: t("ep.common.failedSave"), status: "error", duration: 2000, position: "bottom-right" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!measurement) return;
    if (!window.confirm(t("vlLayouts.processDetail.confirmDeleteMeasurement"))) return;
    try {
      await deleteLayoutProcessMeasurement(measurement.pk);
      onChanged();
    } catch {
      toast({ title: t("ep.common.failedSave"), status: "error", duration: 2000, position: "bottom-right" });
    }
  };

  const ensureMeasurement = async (): Promise<ILayoutProcessMeasurement> => {
    if (measurement) return measurement;
    return createLayoutProcessMeasurement({ layout_process: processPk, round });
  };

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (photoInputRef.current) photoInputRef.current.value = "";
    if (!file) return;
    setIsUploading(true);
    try {
      const target = await ensureMeasurement();
      const urlData = await getUploadURL();
      const dt = new DataTransfer();
      dt.items.add(file);
      const cfResult = (await uploadImage({ file: dt.files, uploadURL: urlData.uploadURL })) as { result?: { id?: string }; id?: string } | undefined;
      const id = cfResult?.result?.id ?? cfResult?.id;
      if (!id) throw new Error("upload");
      const cfUrl = `https://imagedelivery.net/mzmXhxWLR9jzdX8u9g4BBQ/${id}/public`;
      await createLayoutProcessMeasurementPhoto({ file: cfUrl, measurementPk: target.pk, description: t(`vlLayouts.processDetail.round${round}`) });
      onChanged();
    } catch {
      toast({ title: t("ep.common.failedSave"), status: "error", duration: 2000, position: "bottom-right" });
    } finally {
      setIsUploading(false);
    }
  };

  const handleVideoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (videoInputRef.current) videoInputRef.current.value = "";
    if (!file) return;
    setIsUploading(true);
    try {
      const target = await ensureMeasurement();
      const urlData = await getUploadVideoURL();
      const uid: string = urlData.id;
      const dt = new DataTransfer();
      dt.items.add(file);
      await uploadVideo({ file: dt.files, uploadURL: urlData.uploadURL });
      const videoData: { uid?: string; thumbnail?: string } = await getVideoData(uid);
      const VideoFile = `https://customer-kc2gx0yn68qxte35.cloudflarestream.com/${videoData.uid}/iframe`;
      const ThumbnailFile = videoData?.thumbnail ?? "";
      await createLayoutProcessMeasurementVideo({ VideoFile, ThumbnailFile, measurementPk: target.pk });
      onChanged();
    } catch {
      toast({ title: t("ep.common.failedSave"), status: "error", duration: 2000, position: "bottom-right" });
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeletePhoto = async (photoPk: number | string) => {
    if (!measurement) return;
    await deleteLayoutProcessMeasurementPhoto(measurement.pk, photoPk);
    onChanged();
  };

  const handleDeleteVideo = async (videoPk: number) => {
    if (!measurement) return;
    await deleteLayoutProcessMeasurementVideo(measurement.pk, videoPk);
    onChanged();
  };

  if (!isEditing) {
    return (
      <Box borderWidth="1px" borderColor={borderColor} borderRadius="lg" p={3}>
        <Badge colorScheme="purple" fontSize="0.65rem" mb={2}>
          {t(`vlLayouts.processDetail.round${round}`)}
        </Badge>
        <VStack align="stretch" spacing={0.5} mb={(measurement?.photos?.length || measurement?.videos?.length) ? 2 : 0}>
          <MeasurementStatRow label={t("vlLayouts.processDetail.measuredAt")} value={measurement?.measured_at ?? "—"} labelColor={labelColor} />
          <MeasurementStatRow label={t("vlLayouts.detail.col.cycle")} value={cycleSec != null ? formatSamCycleSecondsDisplay(cycleSec) : "—"} labelColor={labelColor} />
          <MeasurementStatRow label={t("vlLayouts.processDetail.manpower")} value={mp != null ? String(mp) : "—"} labelColor={labelColor} />
          <MeasurementStatRow label={t("vlLayouts.processDetail.upmh")} value={upmh != null ? upmh.toFixed(1) : "—"} labelColor={labelColor} />
          <MeasurementStatRow label={t("vlLayouts.processDetail.targetQtyPerHour")} value={total != null ? total.toFixed(1) : "—"} labelColor={labelColor} />
        </VStack>
        <Wrap spacing={1}>
          {(measurement?.photos ?? []).map((p) => (
            <WrapItem key={p.pk}>
              <Image
                src={p.file}
                boxSize="36px"
                objectFit="cover"
                borderRadius="sm"
                cursor="pointer"
                _hover={{ opacity: 0.85 }}
                onClick={() => setLightboxSrc(p.file)}
              />
            </WrapItem>
          ))}
          {(measurement?.videos ?? []).map((v) => (
            <WrapItem key={v.pk}>
              <Box
                boxSize="36px"
                borderRadius="sm"
                bg="blackAlpha.700"
                display="flex"
                alignItems="center"
                justifyContent="center"
                cursor="pointer"
                _hover={{ opacity: 0.85 }}
                onClick={() => setSelectedVideoUrl(v.VideoFile)}
              >
                <FaFilm color="white" size={14} />
              </Box>
            </WrapItem>
          ))}
        </Wrap>
      </Box>
    );
  }

  return (
    <Box borderWidth="1px" borderColor={borderColor} borderRadius="lg" p={3}>
      <HStack justify="space-between" mb={2}>
        <Badge colorScheme="purple" fontSize="0.65rem">
          {t(`vlLayouts.processDetail.round${round}`)}
        </Badge>
        {measurement && (
          <IconButton aria-label="delete" icon={<FaTrash />} size="xs" variant="ghost" colorScheme="red" onClick={handleDelete} />
        )}
      </HStack>

      <VStack align="stretch" spacing={1.5} mb={2}>
        <FormControl>
          <FormLabel fontSize="0.65rem" color={labelColor} mb={0.5}>
            {t("vlLayouts.processDetail.measuredAt")}
          </FormLabel>
          <Input size="xs" type="date" lang={lang} value={dateInput} onChange={(e) => setDateInput(e.target.value)} />
        </FormControl>
        <FormControl>
          <FormLabel fontSize="0.65rem" color={labelColor} mb={0.5}>
            {t("vlLayouts.detail.col.cycle")}
          </FormLabel>
          <Input size="xs" value={cycleInput} onChange={(e) => setCycleInput(e.target.value)} placeholder="—" />
        </FormControl>
        <FormControl>
          <FormLabel fontSize="0.65rem" color={labelColor} mb={0.5}>
            {t("vlLayouts.processDetail.manpower")}
          </FormLabel>
          <Input size="xs" type="number" min={0} value={mpInput} onChange={(e) => setMpInput(e.target.value)} placeholder="—" />
        </FormControl>
      </VStack>

      <VStack align="stretch" spacing={0.5} mb={2}>
        <MeasurementStatRow label={t("vlLayouts.processDetail.upmh")} value={upmh != null ? upmh.toFixed(1) : "—"} labelColor={labelColor} />
        <MeasurementStatRow label={t("vlLayouts.processDetail.targetQtyPerHour")} value={total != null ? total.toFixed(1) : "—"} labelColor={labelColor} />
      </VStack>

      <Button size="xs" w="100%" colorScheme="blue" mb={3} isLoading={isSaving} onClick={handleSave}>
        {t("vlLayouts.detail.saveMeta")}
      </Button>

      <Divider mb={2} />

      <Wrap spacing={1} mb={2}>
        {(measurement?.photos ?? []).map((p) => (
          <WrapItem key={p.pk} position="relative">
            <Image
              src={p.file}
              boxSize="36px"
              objectFit="cover"
              borderRadius="sm"
              cursor="pointer"
              _hover={{ opacity: 0.85 }}
              onClick={() => setLightboxSrc(p.file)}
            />
            <IconButton
              aria-label="del"
              icon={<FaTrashAlt />}
              size="2xs"
              position="absolute"
              top="-4px"
              right="-4px"
              borderRadius="full"
              colorScheme="red"
              onClick={() => void handleDeletePhoto(p.pk)}
            />
          </WrapItem>
        ))}
        {(measurement?.videos ?? []).map((v) => (
          <WrapItem key={v.pk} position="relative">
            <Box
              boxSize="36px"
              borderRadius="sm"
              bg="blackAlpha.700"
              display="flex"
              alignItems="center"
              justifyContent="center"
              cursor="pointer"
              _hover={{ opacity: 0.85 }}
              onClick={() => setSelectedVideoUrl(v.VideoFile)}
            >
              <FaFilm color="white" size={14} />
            </Box>
            <IconButton
              aria-label="del"
              icon={<FaTrashAlt />}
              size="2xs"
              position="absolute"
              top="-4px"
              right="-4px"
              borderRadius="full"
              colorScheme="red"
              onClick={() => void handleDeleteVideo(v.pk)}
            />
          </WrapItem>
        ))}
      </Wrap>

      <HStack spacing={1}>
        <input type="file" accept="image/*" ref={photoInputRef} style={{ display: "none" }} onChange={(e) => void handlePhotoSelect(e)} />
        <input type="file" accept="video/*" ref={videoInputRef} style={{ display: "none" }} onChange={(e) => void handleVideoSelect(e)} />
        <IconButton
          aria-label="add photo"
          icon={<FaCamera />}
          size="xs"
          variant="outline"
          isLoading={isUploading}
          onClick={() => photoInputRef.current?.click()}
        />
        <IconButton
          aria-label="add video"
          icon={<FaVideo />}
          size="xs"
          variant="outline"
          isLoading={isUploading}
          onClick={() => videoInputRef.current?.click()}
        />
      </HStack>
    </Box>
  );
}

function MeasurementComparisonSection({
  process,
  originalPhotos,
  originalVideos,
  upmhDivisorSeconds,
  labelColor,
  cardBg,
  borderColor,
  lang,
  isEditing,
  setLightboxSrc,
  setSelectedVideoUrl,
  t
}: {
  process: ILayoutProcess;
  originalPhotos: Array<{ pk: string | number; file: string }>;
  originalVideos: IProcessVideo[];
  upmhDivisorSeconds: number;
  labelColor: string;
  cardBg: string;
  borderColor: string;
  lang: string;
  isEditing: boolean;
  setLightboxSrc: (src: string | null) => void;
  setSelectedVideoUrl: (url: string | null) => void;
  t: (k: string, options?: Record<string, unknown>) => string;
}) {
  const queryClient = useQueryClient();
  const processPk = process.pk;

  const measurementsByRound = useMemo(() => {
    const map = new Map<number, ILayoutProcessMeasurement>();
    (process.measurements ?? []).forEach((m) => map.set(m.round, m));
    return map;
  }, [process.measurements]);

  const handleChanged = () => {
    queryClient.invalidateQueries({ queryKey: ["layoutProcessDetail", processPk] });
    queryClient.invalidateQueries({ queryKey: ["layoutStyle"] });
  };

  const originalCycleSec = parseSamSecondsField(process.cycle_time);

  const roundStats = ([1, 2, 3] as const).map((round) => {
    const m = measurementsByRound.get(round);
    const cycleSec = m ? parseSamSecondsField(m.cycle_time) : null;
    const mp = m?.manpower ?? null;
    const upmh = cycleSec != null && cycleSec > 0 ? upmhDivisorSeconds / cycleSec : null;
    const total = upmh != null && mp != null && mp > 0 ? upmh * mp : null;
    return { round, cycleSec, mp, upmh, total };
  });

  const hasAnyMeasurement = roundStats.some((r) => r.cycleSec != null || r.mp != null);

  /**
   * Shows both the literal change (value - original, real sign) and its % — colored green/red based on
   * whether that literal direction is actually good for this metric (higherIsBetter).
   */
  const renderDelta = (original: number | null, value: number | null, higherIsBetter: boolean, formatDiff: (absDiff: number) => string) => {
    if (original == null || value == null) return null;
    const diff = value - original;
    if (Math.abs(diff) < 1e-9) {
      return (
        <Text as="span" fontSize="xs" fontWeight="semibold" color={labelColor} ml={1}>
          (±0)
        </Text>
      );
    }
    const isGood = higherIsBetter ? diff > 0 : diff < 0;
    const pct = original !== 0 ? (diff / Math.abs(original)) * 100 : null;
    const sign = diff > 0 ? "+" : "-";
    return (
      <Text as="span" fontSize="xs" fontWeight="semibold" color={isGood ? "green.500" : "red.500"} ml={1}>
        ({sign}
        {formatDiff(Math.abs(diff))}
        {pct != null ? `, ${sign}${Math.abs(pct).toFixed(1)}%` : ""})
      </Text>
    );
  };

  return (
    <Box bg={cardBg} borderRadius="xl" border="1px solid" borderColor={borderColor} p={6} shadow="sm" mb={6}>
      <Heading size="sm" mb={1}>
        {t("vlLayouts.processDetail.measurementComparison")}
      </Heading>
      <Text fontSize="xs" color={labelColor} mb={3}>
        {t("vlLayouts.processDetail.measurementComparisonHint")}
      </Text>
      <Divider mb={4} />
      <Grid templateColumns={{ base: "1fr", md: "repeat(4, 1fr)" }} gap={4}>
        <Box borderWidth="1px" borderColor={borderColor} borderRadius="lg" p={3} bg="blackAlpha.50">
          <Badge colorScheme="gray" fontSize="0.65rem" mb={2}>
            {t("vlLayouts.processDetail.original")}
          </Badge>
          <VStack align="stretch" spacing={0.5}>
            <MeasurementStatRow label={t("vlLayouts.processDetail.createdAt")} value={formatIsoDateDisplay(process.created_at, lang)} labelColor={labelColor} />
            <MeasurementStatRow label={t("vlLayouts.detail.col.cycle")} value={originalCycleSec != null ? formatSamCycleSecondsDisplay(originalCycleSec) : "—"} labelColor={labelColor} />
            <MeasurementStatRow label={t("vlLayouts.processDetail.manpower")} value={process.manpower != null ? String(process.manpower) : "—"} labelColor={labelColor} />
            <MeasurementStatRow label={t("vlLayouts.processDetail.upmh")} value={process.target_qty_per_hour != null ? process.target_qty_per_hour.toFixed(1) : "—"} labelColor={labelColor} />
            <MeasurementStatRow
              label={t("vlLayouts.processDetail.targetQtyPerHour")}
              value={process.target_qty_per_hour_total != null ? process.target_qty_per_hour_total.toFixed(1) : "—"}
              labelColor={labelColor}
            />
          </VStack>
          {(originalPhotos.length > 0 || originalVideos.length > 0) && (
            <Wrap spacing={1} mt={2}>
              {originalPhotos.map((p) => (
                <WrapItem key={p.pk}>
                  <Image
                    src={p.file}
                    boxSize="36px"
                    objectFit="cover"
                    borderRadius="sm"
                    cursor="pointer"
                    _hover={{ opacity: 0.85 }}
                    onClick={() => setLightboxSrc(p.file)}
                  />
                </WrapItem>
              ))}
              {originalVideos.map((v) => (
                <WrapItem key={v.pk}>
                  <Box
                    boxSize="36px"
                    borderRadius="sm"
                    bg="blackAlpha.700"
                    display="flex"
                    alignItems="center"
                    justifyContent="center"
                    cursor="pointer"
                    _hover={{ opacity: 0.85 }}
                    onClick={() => setSelectedVideoUrl(v.VideoFile)}
                  >
                    <FaFilm color="white" size={14} />
                  </Box>
                </WrapItem>
              ))}
            </Wrap>
          )}
        </Box>
        {([1, 2, 3] as const).map((round) => (
          <MeasurementRoundCard
            key={round}
            round={round}
            processPk={processPk}
            measurement={measurementsByRound.get(round) ?? null}
            upmhDivisorSeconds={upmhDivisorSeconds}
            labelColor={labelColor}
            borderColor={borderColor}
            onChanged={handleChanged}
            lang={lang}
            isEditing={isEditing}
            setLightboxSrc={setLightboxSrc}
            setSelectedVideoUrl={setSelectedVideoUrl}
            t={t}
          />
        ))}
      </Grid>

      {hasAnyMeasurement && (
        <Box mt={5}>
          <Divider mb={3} />
          <Heading size="xs" mb={3}>
            {t("vlLayouts.processDetail.improvement")}
          </Heading>
          <TableContainer>
            <Table size="sm" variant="simple">
              <Thead>
                <Tr>
                  <Th />
                  <Th>{t("vlLayouts.processDetail.original")}</Th>
                  {roundStats.map(({ round }) => (
                    <Th key={round}>{t(`vlLayouts.processDetail.round${round}`)}</Th>
                  ))}
                </Tr>
              </Thead>
              <Tbody>
                <Tr>
                  <Td fontWeight="semibold">{t("vlLayouts.detail.col.cycle")}</Td>
                  <Td>{originalCycleSec != null ? formatSamCycleSecondsDisplay(originalCycleSec) : "—"}</Td>
                  {roundStats.map(({ round, cycleSec }) => (
                    <Td key={round}>
                      {cycleSec != null ? formatSamCycleSecondsDisplay(cycleSec) : "—"}
                      {renderDelta(originalCycleSec, cycleSec, false, (d) => formatSamCycleSecondsDisplay(d))}
                    </Td>
                  ))}
                </Tr>
                <Tr>
                  <Td fontWeight="semibold">{t("vlLayouts.processDetail.manpower")}</Td>
                  <Td>{process.manpower ?? "—"}</Td>
                  {roundStats.map(({ round, mp }) => (
                    <Td key={round}>
                      {mp ?? "—"}
                      {renderDelta(process.manpower ?? null, mp, false, (d) => String(d))}
                    </Td>
                  ))}
                </Tr>
                <Tr>
                  <Td fontWeight="semibold">{t("vlLayouts.processDetail.upmh")}</Td>
                  <Td>{process.target_qty_per_hour != null ? process.target_qty_per_hour.toFixed(1) : "—"}</Td>
                  {roundStats.map(({ round, upmh }) => (
                    <Td key={round}>
                      {upmh != null ? upmh.toFixed(1) : "—"}
                      {renderDelta(process.target_qty_per_hour, upmh, true, (d) => d.toFixed(1))}
                    </Td>
                  ))}
                </Tr>
                <Tr>
                  <Td fontWeight="semibold">{t("vlLayouts.processDetail.targetQtyPerHour")}</Td>
                  <Td>{process.target_qty_per_hour_total != null ? process.target_qty_per_hour_total.toFixed(1) : "—"}</Td>
                  {roundStats.map(({ round, total }) => (
                    <Td key={round}>
                      {total != null ? total.toFixed(1) : "—"}
                      {renderDelta(process.target_qty_per_hour_total ?? null, total, true, (d) => d.toFixed(1))}
                    </Td>
                  ))}
                </Tr>
              </Tbody>
            </Table>
          </TableContainer>
        </Box>
      )}
    </Box>
  );
}

function StandardVideoDisplay({
  process,
  videos,
  photoBorderColor,
  videoBg,
  setSelectedVideoUrl,
  onClear
}: {
  process: ILayoutProcess;
  videos: IProcessVideo[];
  photoBorderColor: string;
  videoBg: string;
  setSelectedVideoUrl: (u: string | null) => void;
  onClear: () => void;
}) {
  const matched = videos.find((v) => v.VideoFile === process.standard_work_video_url);
  if (matched) {
    return (
      <Box mt={1} w="160px" position="relative">
        <Box
          borderRadius="md"
          overflow="hidden"
          border="1px solid"
          borderColor={photoBorderColor}
          cursor="pointer"
          onClick={() => setSelectedVideoUrl(matched.VideoFile)}
          _hover={{ opacity: 0.85 }}
        >
          {matched.ThumbnailFile ? (
            <Image src={matched.ThumbnailFile} w="full" h="90px" objectFit="cover" />
          ) : (
            <Center h="90px" bg={videoBg}>
              <FaVideo size={24} />
            </Center>
          )}
        </Box>
        <IconButton
          aria-label="clear standard video"
          icon={<FaTrashAlt />}
          size="2xs"
          position="absolute"
          top="-6px"
          right="-6px"
          borderRadius="full"
          colorScheme="red"
          onClick={onClear}
        />
      </Box>
    );
  }
  if (process.standard_work_video_url) {
    return (
      <HStack spacing={2} mt={1}>
        <Link href={process.standard_work_video_url} isExternal>
          <HStack spacing={1} color="blue.400">
            <FaVideo size={14} />
            <Text fontSize="sm">Video</Text>
            <FaExternalLinkAlt size={10} />
          </HStack>
        </Link>
        <IconButton aria-label="clear standard video" icon={<FaTrashAlt />} size="2xs" variant="ghost" colorScheme="red" onClick={onClear} />
      </HStack>
    );
  }
  return (
    <Text fontSize="sm" color="gray.400">
      —
    </Text>
  );
}
