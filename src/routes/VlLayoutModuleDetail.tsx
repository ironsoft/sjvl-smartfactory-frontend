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
  Flex,
  Grid,
  Heading,
  HStack,
  Image,
  Input,
  Link,
  Spinner,
  Select,
  FormControl,
  FormLabel,
  Table,
  TableContainer,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
  Badge,
  useColorModeValue,
  useDisclosure,
  useToast,
  VisuallyHidden,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalOverlay
} from "@chakra-ui/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Helmet } from "react-helmet";
import { Link as RouterLink, useNavigate, useParams } from "react-router-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { FaCamera, FaEdit, FaExternalLinkAlt, FaTrash, FaTrashAlt } from "react-icons/fa";
import {
  getLayoutModuleDetail,
  getLayoutStyleDetail,
  getModuleDetail,
  getModuleCategories,
  patchLayoutModule,
  deleteLayoutModule,
  createLayoutModulePhoto,
  deleteLayoutModulePhoto,
  getUploadURL,
  uploadImage,
  type ILayoutModule,
  type ILayoutProcess,
  type IModuleCategory
} from "../api";
import { formatIsoDateTimeDisplay } from "../lib/dateLocale";
import { samCategoryColorScheme } from "../lib/samCategoryColor";
import { openAppPopupWindow } from "../lib/openAppPopupWindow";
import { compareSamProcessBySortOrder, formatSamCycleSecondsDisplay, samProcessCycleSecondsFromParts } from "../lib/samProcessCycle";
import { samProcessSjMachineLabel, samProcessSjMachinePk } from "../lib/samProcessFk";
import { SamSortOrderBall } from "../components/SamSortOrderBadge";
import { SamBadge } from "../components/EpBadge";
import { saveModulePrecedenceEdges } from "../lib/samModuleChain";

function InfoRow({ label, labelColor, children }: { label: string; labelColor: string; children: React.ReactNode }) {
  return (
    <Box>
      <Text fontSize="xs" color={labelColor} fontWeight="semibold" mb={0.5}>
        {label}
      </Text>
      {children}
    </Box>
  );
}

function layoutStyleIdFromModule(m: ILayoutModule): number {
  const raw = m.layout_style as unknown;
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (raw && typeof raw === "object" && "pk" in raw) {
    const pk = (raw as { pk: unknown }).pk;
    if (typeof pk === "number" && Number.isFinite(pk)) return pk;
    if (typeof pk === "string") {
      const n = Number(pk);
      if (Number.isFinite(n)) return n;
    }
  }
  return Number(raw);
}

function layoutModuleFkPk(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  if (typeof v === "object" && v !== null && "pk" in v) return layoutModuleFkPk((v as { pk: unknown }).pk);
  return null;
}

export default function VlLayoutModuleDetail() {
  const { pk: layoutStyleId, modPk: layoutModuleId } = useParams<{ pk: string; modPk: string }>();
  const stylePk = Number(layoutStyleId);
  const modulePk = Number(layoutModuleId);
  const { t, i18n } = useTranslation();
  const toast = useToast();
  const queryClient = useQueryClient();

  const cardBg = useColorModeValue("white", "gray.800");
  const pageBg = useColorModeValue("gray.50", "gray.900");
  const borderColor = useColorModeValue("gray.200", "gray.600");
  const labelColor = useColorModeValue("gray.500", "gray.400");
  const photoBorderColor = useColorModeValue("gray.200", "gray.600");
  const tableBg = useColorModeValue("gray.50", "gray.800");

  const { data: layoutStyle } = useQuery({
    queryKey: ["layoutStyle", stylePk],
    queryFn: () => getLayoutStyleDetail(stylePk),
    enabled: Number.isFinite(stylePk) && stylePk > 0
  });

  const { data: module, isLoading } = useQuery<ILayoutModule>({
    queryKey: ["layoutModuleDetail", modulePk],
    queryFn: () => getLayoutModuleDetail(modulePk),
    enabled: Number.isFinite(modulePk) && modulePk > 0
  });

  const { data: prodModule } = useQuery({
    queryKey: ["moduleDetail", modulePk],
    queryFn: async () => {
      try {
        return await getModuleDetail(modulePk);
      } catch {
        return null;
      }
    },
    enabled: Number.isFinite(modulePk) && modulePk > 0
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["moduleCategories"],
    queryFn: () => getModuleCategories()
  });

  const sortedCats = useMemo(() => [...categories].sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name)), [categories]);

  const navigate = useNavigate();
  const { isOpen: isDeleteOpen, onOpen: onDeleteOpen, onClose: onDeleteClose } = useDisclosure();
  const cancelDeleteRef = useRef<HTMLButtonElement>(null);

  const [isEditing, setIsEditing] = useState(false);
  const [metaCode, setMetaCode] = useState("");
  const [metaName, setMetaName] = useState("");
  const [metaSortOrder, setMetaSortOrder] = useState("");
  const [metaCategoryId, setMetaCategoryId] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [deletingModule, setDeletingModule] = useState(false);

  const [prevModuleId, setPrevModuleId] = useState("");
  const [nextModuleId, setNextModuleId] = useState("");

  const otherModulesForPrecedence = useMemo(() => {
    if (!layoutStyle?.layout_modules?.length) return [];
    return layoutStyle.layout_modules
      .filter((m) => m.pk !== modulePk)
      .map((m) => ({ pk: m.pk, label: `[${m.code}] ${m.name || "—"}`.trim() }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [layoutStyle?.layout_modules, modulePk]);

  const moduleLabelByPk = useMemo(() => {
    const m = new Map<number, string>();
    for (const mod of layoutStyle?.layout_modules ?? []) m.set(mod.pk, `[${mod.code}] ${mod.name || "—"}`.trim());
    return m;
  }, [layoutStyle?.layout_modules]);

  const moduleByPkForChain = useMemo(() => {
    const m = new Map<number, ILayoutModule>();
    for (const mod of layoutStyle?.layout_modules ?? []) m.set(mod.pk, mod);
    if (module) m.set(module.pk, module);
    return m;
  }, [layoutStyle?.layout_modules, module]);

  useEffect(() => {
    if (!module || isEditing) return;
    setMetaCode(module.code ?? "");
    setMetaName(module.name ?? "");
    setMetaSortOrder(String(module.sort_order ?? ""));
    setMetaCategoryId(String(module.module_category ?? ""));
    const prevPk = layoutModuleFkPk(module.previous_module);
    const nextPk = layoutModuleFkPk(module.next_module);
    setPrevModuleId(prevPk != null ? String(prevPk) : "");
    setNextModuleId(nextPk != null ? String(nextPk) : "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditing, module?.pk, module?.code, module?.name, module?.sort_order, module?.module_category, module?.previous_module, module?.next_module]);

  const mergedPhotos = useMemo(() => {
    const a = module?.photos ?? [];
    const b = prodModule?.photos ?? [];
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
  }, [module?.photos, prodModule?.photos]);

  const processes = useMemo(() => {
    if (!module || layoutStyleIdFromModule(module) !== stylePk) return [];
    const compare = compareSamProcessBySortOrder as unknown as (a: ILayoutProcess, b: ILayoutProcess) => number;
    return [...(module.layout_processes ?? [])].sort(compare);
  }, [module, stylePk]);

  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
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

  const removePending = (idx: number) => {
    setPendingFiles((prev) => prev.filter((_, i) => i !== idx));
    setPendingPreviews((prev) => {
      URL.revokeObjectURL(prev[idx]);
      return prev.filter((_, i) => i !== idx);
    });
  };

  const handleUploadPhotos = async () => {
    if (!pendingFiles.length || !module) return;
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
        await createLayoutModulePhoto({ file: cfUrl, modulePk: module.pk, description: module.name ?? "" });
      }
      queryClient.invalidateQueries({ queryKey: ["layoutModuleDetail", modulePk] });
      queryClient.invalidateQueries({ queryKey: ["moduleDetail", modulePk] });
      queryClient.invalidateQueries({ queryKey: ["layoutStyle", stylePk] });
      setPendingFiles([]);
      setPendingPreviews([]);
      toast({ title: t("vlLayouts.moduleDetail.uploadedPhotos"), status: "success", duration: 2000, position: "bottom-right" });
    } catch {
      toast({ title: t("ep.common.failedSave"), status: "error", duration: 2000, position: "bottom-right" });
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const handleDeletePhoto = async (photoPk: number | string) => {
    try {
      await deleteLayoutModulePhoto(modulePk, photoPk);
      queryClient.invalidateQueries({ queryKey: ["layoutModuleDetail", modulePk] });
      queryClient.invalidateQueries({ queryKey: ["moduleDetail", modulePk] });
      queryClient.invalidateQueries({ queryKey: ["layoutStyle", stylePk] });
      toast({ title: t("vlLayouts.moduleDetail.deletedPhoto"), status: "success", duration: 2000, position: "bottom-right" });
    } catch {
      toast({ title: t("ep.common.failedSave"), status: "error", duration: 2000, position: "bottom-right" });
    }
  };

  if (!Number.isFinite(modulePk) || modulePk <= 0) {
    return (
      <Center minH="40vh">
        <Text>Invalid module.</Text>
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

  if (!module || layoutStyleIdFromModule(module) !== stylePk) {
    return (
      <Center minH="60vh">
        <Text color="gray.500">{t("vlLayouts.moduleDetail.notFound")}</Text>
      </Center>
    );
  }

  const prevLinkPk = layoutModuleFkPk(module.previous_module);
  const nextLinkPk = layoutModuleFkPk(module.next_module);

  const startEdit = () => {
    if (!module) return;
    setMetaCode(module.code ?? "");
    setMetaName(module.name ?? "");
    setMetaSortOrder(String(module.sort_order ?? ""));
    setMetaCategoryId(String(module.module_category ?? ""));
    setPrevModuleId(prevLinkPk != null ? String(prevLinkPk) : "");
    setNextModuleId(nextLinkPk != null ? String(nextLinkPk) : "");
    setIsEditing(true);
  };

  const cancelEdit = () => {
    if (!module) return;
    setMetaCode(module.code ?? "");
    setMetaName(module.name ?? "");
    setMetaSortOrder(String(module.sort_order ?? ""));
    setMetaCategoryId(String(module.module_category ?? ""));
    setPrevModuleId(prevLinkPk != null ? String(prevLinkPk) : "");
    setNextModuleId(nextLinkPk != null ? String(nextLinkPk) : "");
    setIsEditing(false);
  };

  const handleSave = async () => {
    const code = metaCode.trim();
    if (!code) {
      toast({ title: t("vlLayouts.moduleDetail.codeRequired"), status: "warning", duration: 2500, position: "bottom-right" });
      return;
    }
    const rawSo = metaSortOrder.trim();
    let sortOrderPatch: number;
    if (rawSo === "") {
      sortOrderPatch = 0;
    } else {
      const n = Number(rawSo);
      if (!Number.isInteger(n) || n < 0) {
        toast({ title: t("vlLayouts.detail.processSortOrderInvalid"), status: "warning", duration: 2500, position: "bottom-right" });
        return;
      }
      sortOrderPatch = n;
    }
    const catPk = metaCategoryId === "" ? NaN : Number(metaCategoryId);
    if (!Number.isFinite(catPk) || catPk <= 0) {
      toast({ title: t("vlLayouts.moduleDetail.categoryRequired"), status: "warning", duration: 2500, position: "bottom-right" });
      return;
    }
    setIsSaving(true);
    try {
      const prevP = prevModuleId === "" ? null : Number(prevModuleId);
      const nextN = nextModuleId === "" ? null : Number(nextModuleId);

      if (moduleByPkForChain.has(modulePk)) {
        await saveModulePrecedenceEdges(modulePk, prevP, nextN, moduleByPkForChain, patchLayoutModule);
      }

      await patchLayoutModule(modulePk, {
        code,
        name: metaName.trim(),
        sort_order: sortOrderPatch,
        module_category: catPk,
        previous_module: prevP,
        previous_module_id: prevP,
        next_module: nextN,
        next_module_id: nextN
      });
      queryClient.invalidateQueries({ queryKey: ["layoutModuleDetail", modulePk] });
      queryClient.invalidateQueries({ queryKey: ["moduleDetail", modulePk] });
      queryClient.invalidateQueries({ queryKey: ["layoutStyle", stylePk] });
      toast({ title: t("vlLayouts.detail.saved"), status: "success", duration: 2000, position: "bottom-right" });
      setIsEditing(false);
    } catch {
      toast({ title: t("ep.common.failedSave"), status: "error", duration: 2500, position: "bottom-right" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteModule = async () => {
    setDeletingModule(true);
    try {
      await deleteLayoutModule(modulePk);
      queryClient.invalidateQueries({ queryKey: ["layoutStyle", stylePk] });
      toast({ title: t("vlLayouts.moduleDetail.deleted"), status: "success", duration: 2000, position: "bottom-right" });
      onDeleteClose();
      navigate(`/vl-layouts/${layoutStyleId}`);
    } catch {
      toast({ title: t("ep.common.failedSave"), status: "error", duration: 2500, position: "bottom-right" });
    } finally {
      setDeletingModule(false);
    }
  };

  return (
    <>
      <Helmet>
        <title>
          {module.code} — {t("vlLayouts.moduleDetail.pageTitle")}
        </title>
      </Helmet>
      <Box bg={pageBg} minH="100vh" px={{ base: 4, md: 8, lg: 12 }} py={{ base: 6, md: 8 }}>
        <Box maxW="5xl" mx="auto">
          <HStack mb={4} justify="flex-end" flexWrap="wrap" gap={2}>
            <HStack spacing={2}>
              {isEditing ? (
                <>
                  <Button size="sm" variant="ghost" onClick={cancelEdit}>
                    {t("vlLayouts.common.cancel")}
                  </Button>
                  <Button size="sm" colorScheme="blue" isLoading={isSaving} onClick={() => void handleSave()}>
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
            {module.module_category_name ? (
              <>
                {" · "}
                <Text as="span" color="gray.600">
                  {module.module_category_name}
                </Text>
              </>
            ) : null}
            {" · "}
            {t("vlLayouts.moduleDetail.breadcrumb")}
          </Text>

          <Box bg={cardBg} borderRadius="xl" border="1px solid" borderColor={borderColor} p={6} shadow="sm" mb={6}>
            <HStack align="flex-start" flexWrap="wrap" spacing={3} mb={4}>
              <SamBadge kind="layoutModule" mt={1} />
              <Heading size="md">
                [{module.code}] {module.name || "—"}
              </Heading>
              {module.module_category_name ? (
                <Badge colorScheme={samCategoryColorScheme(module.module_category)} fontSize="0.7rem" mt={1}>
                  {module.module_category_name}
                </Badge>
              ) : null}
            </HStack>
            {isEditing ? (
              <Grid templateColumns={{ base: "1fr", md: "1fr 1fr" }} gap={4} mb={4}>
                <FormControl isRequired>
                  <FormLabel fontSize="sm">{t("vlLayouts.detail.moduleCode")}</FormLabel>
                  <Input size="sm" value={metaCode} onChange={(e) => setMetaCode(e.target.value)} />
                </FormControl>
                <FormControl>
                  <FormLabel fontSize="sm">{t("vlLayouts.detail.moduleName")}</FormLabel>
                  <Input size="sm" value={metaName} onChange={(e) => setMetaName(e.target.value)} />
                </FormControl>
                <FormControl isRequired>
                  <FormLabel fontSize="sm">{t("vlLayouts.detail.category")}</FormLabel>
                  <Select size="sm" value={metaCategoryId} onChange={(e) => setMetaCategoryId(e.target.value)} placeholder={t("vlLayouts.detail.categoryPlaceholder")}>
                    {sortedCats.map((c: IModuleCategory) => (
                      <option key={c.pk} value={c.pk}>
                        {c.parent_name ? `${c.parent_name} › ${c.name}` : c.name}
                      </option>
                    ))}
                  </Select>
                </FormControl>
                <FormControl>
                  <FormLabel fontSize="sm">{t("vlLayouts.detail.sortOrder")}</FormLabel>
                  <Input size="sm" type="number" min={0} step={1} value={metaSortOrder} onChange={(e) => setMetaSortOrder(e.target.value)} />
                </FormControl>
              </Grid>
            ) : (
              <Grid templateColumns={{ base: "1fr", md: "1fr 1fr" }} gap={4} mb={4}>
                <InfoRow label={t("vlLayouts.detail.moduleCode")} labelColor={labelColor}>
                  <Text fontSize="sm">{module.code}</Text>
                </InfoRow>
                <InfoRow label={t("vlLayouts.detail.moduleName")} labelColor={labelColor}>
                  <Text fontSize="sm">{module.name || "—"}</Text>
                </InfoRow>
                <InfoRow label={t("vlLayouts.moduleDetail.category")} labelColor={labelColor}>
                  <Text fontSize="sm">{module.module_category_name || "—"}</Text>
                </InfoRow>
                <InfoRow label={t("vlLayouts.moduleDetail.sortOrder")} labelColor={labelColor}>
                  <Text fontSize="sm">{module.sort_order}</Text>
                </InfoRow>
              </Grid>
            )}
            <HStack spacing={8} flexWrap="wrap" align="flex-start" mb={2}>
              <InfoRow label={t("vlLayouts.moduleDetail.created")} labelColor={labelColor}>
                <Text fontSize="sm">{formatIsoDateTimeDisplay(module.created_at, i18n.language)}</Text>
              </InfoRow>
              <InfoRow label={t("vlLayouts.moduleDetail.processCount")} labelColor={labelColor}>
                <Text fontSize="sm">{processes.length}</Text>
              </InfoRow>
            </HStack>
          </Box>

          <Box bg={cardBg} borderRadius="xl" border="1px solid" borderColor={borderColor} p={6} shadow="sm" mb={6}>
            <Heading size="sm" mb={3}>
              {t("vlLayouts.moduleDetail.precedenceTitle")}
            </Heading>
            <Text fontSize="xs" color={labelColor} mb={4}>
              {t("vlLayouts.moduleDetail.precedenceHint")}
            </Text>
            <Grid templateColumns={{ base: "1fr", md: "1fr 1fr" }} gap={4} mb={4}>
              <InfoRow label={t("vlLayouts.moduleDetail.previousModule")} labelColor={labelColor}>
                {isEditing ? (
                  <Select size="sm" mt={1} value={prevModuleId} onChange={(e) => setPrevModuleId(e.target.value)}>
                    <option value="">{t("vlLayouts.moduleDetail.precedenceNone")}</option>
                    {otherModulesForPrecedence.map((m) => (
                      <option key={m.pk} value={String(m.pk)}>
                        {m.label}
                      </option>
                    ))}
                  </Select>
                ) : (
                  <Text fontSize="sm">
                    {prevLinkPk != null ? (
                      <Link
                        href="#"
                        color="blue.500"
                        onClick={(e) => {
                          e.preventDefault();
                          openAppPopupWindow(`/vl-layouts/${layoutStyleId}/modules/${prevLinkPk}`, { width: 1680, height: 960 });
                        }}
                      >
                        {moduleLabelByPk.get(prevLinkPk) ?? `#${prevLinkPk}`}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </Text>
                )}
              </InfoRow>
              <InfoRow label={t("vlLayouts.moduleDetail.nextModule")} labelColor={labelColor}>
                {isEditing ? (
                  <Select size="sm" mt={1} value={nextModuleId} onChange={(e) => setNextModuleId(e.target.value)}>
                    <option value="">{t("vlLayouts.moduleDetail.precedenceNone")}</option>
                    {otherModulesForPrecedence.map((m) => (
                      <option key={m.pk} value={String(m.pk)}>
                        {m.label}
                      </option>
                    ))}
                  </Select>
                ) : (
                  <Text fontSize="sm">
                    {nextLinkPk != null ? (
                      <Link
                        href="#"
                        color="blue.500"
                        onClick={(e) => {
                          e.preventDefault();
                          openAppPopupWindow(`/vl-layouts/${layoutStyleId}/modules/${nextLinkPk}`, { width: 1680, height: 960 });
                        }}
                      >
                        {moduleLabelByPk.get(nextLinkPk) ?? `#${nextLinkPk}`}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </Text>
                )}
              </InfoRow>
            </Grid>
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
                <Text fontSize="xs" color={labelColor} fontWeight="semibold" mb={2}>
                  {t("vlLayouts.moduleDetail.pendingUpload", { count: pendingPreviews.length })}
                </Text>
                <Grid templateColumns="repeat(auto-fill, minmax(120px, 1fr))" gap={3} mb={3}>
                  {pendingPreviews.map((src, idx) => (
                    <Box key={idx} position="relative" borderRadius="md" overflow="hidden" border="2px dashed" borderColor="blue.300">
                      <Image src={src} w="full" h="100px" objectFit="cover" />
                      <Button size="xs" colorScheme="red" position="absolute" top={1} right={1} onClick={() => removePending(idx)}>
                        <FaTrashAlt />
                      </Button>
                    </Box>
                  ))}
                </Grid>
                <Button size="sm" colorScheme="blue" isLoading={isUploadingPhoto} loadingText="…" onClick={handleUploadPhotos}>
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
                    transition="opacity 0.15s"
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

          <Box bg={cardBg} borderRadius="xl" border="1px solid" borderColor={borderColor} p={6} shadow="sm">
            <Heading size="sm" mb={4}>
              {t(processes.length === 1 ? "vlLayouts.moduleDetail.processTitle" : "vlLayouts.moduleDetail.processesTitle")}
            </Heading>
            <Divider mb={4} />
            {processes.length === 0 ? (
              <Text color="gray.400" textAlign="center" py={6}>
                {t("vlLayouts.moduleDetail.noProcesses")}
              </Text>
            ) : (
              <TableContainer>
                <Table variant="striped" size="sm">
                  <Thead bgColor={tableBg}>
                    <Tr>
                      <Th isNumeric w="44px" px={1}>
                        <VisuallyHidden>{t("vlLayouts.detail.col.sort_order")}</VisuallyHidden>
                      </Th>
                      <Th>{t("vlLayouts.detail.col.code")}</Th>
                      <Th>{t("vlLayouts.detail.col.name")}</Th>
                      <Th fontSize="xs" color="gray.500">
                        {t("vlLayouts.detail.col.machine")}
                      </Th>
                      <Th isNumeric>{t("vlLayouts.detail.col.cycle")}</Th>
                      <Th w="100px" />
                    </Tr>
                  </Thead>
                  <Tbody>
                    {processes.map((proc) => (
                      <Tr key={proc.pk}>
                        <Td isNumeric px={1}>
                          <Flex justify="center" w="100%">
                            <SamSortOrderBall sortOrder={proc.sort_order} />
                          </Flex>
                        </Td>
                        <Td fontWeight="semibold" whiteSpace="nowrap">
                          <Link
                            href="#"
                            color="blue.500"
                            onClick={(e) => {
                              e.preventDefault();
                              openAppPopupWindow(`/vl-layouts/${layoutStyleId}/processes/${proc.pk}`, { width: 1680, height: 960 });
                            }}
                          >
                            {proc.code}
                          </Link>
                        </Td>
                        <Td>{proc.name || "—"}</Td>
                        <Td fontSize="xs" maxW="160px">
                          {(() => {
                            const toolLabel = proc.layout_tool_name?.trim();
                            if (toolLabel) return <Text noOfLines={2}>{toolLabel}</Text>;
                            const mpk = samProcessSjMachinePk(proc);
                            if (mpk == null) return "—";
                            const label = samProcessSjMachineLabel(proc) ?? `#${mpk}`;
                            return (
                              <Link as={RouterLink} to={`/machines/${mpk}`} color="blue.500" noOfLines={2}>
                                {label}
                              </Link>
                            );
                          })()}
                        </Td>
                        <Td isNumeric>
                          {(() => {
                            const v = samProcessCycleSecondsFromParts(proc);
                            return v != null ? formatSamCycleSecondsDisplay(v) : "—";
                          })()}
                        </Td>
                        <Td>
                          <Link
                            href="#"
                            onClick={(e) => {
                              e.preventDefault();
                              openAppPopupWindow(`/vl-layouts/${layoutStyleId}/processes/${proc.pk}`, { width: 1680, height: 960 });
                            }}
                          >
                            <HStack spacing={1} color="blue.400" fontSize="xs">
                              <FaExternalLinkAlt />
                              <Text>{t("vlLayouts.moduleDetail.openDetail")}</Text>
                            </HStack>
                          </Link>
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

      <AlertDialog isOpen={isDeleteOpen} leastDestructiveRef={cancelDeleteRef} onClose={onDeleteClose}>
        <AlertDialogOverlay />
        <AlertDialogContent>
          <AlertDialogHeader>{t("vlLayouts.moduleDetail.deleteTitle")}</AlertDialogHeader>
          <AlertDialogBody>{t("vlLayouts.moduleDetail.deleteBody")}</AlertDialogBody>
          <AlertDialogFooter>
            <Button ref={cancelDeleteRef} onClick={onDeleteClose}>
              {t("vlLayouts.common.cancel")}
            </Button>
            <Button colorScheme="red" ml={3} isLoading={deletingModule} onClick={() => void handleDeleteModule()}>
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
    </>
  );
}
