import {
  Box,
  Button,
  Heading,
  Text,
  useColorModeValue,
  VStack,
  HStack,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  IconButton,
  useToast,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalCloseButton,
  useDisclosure,
  Input,
  Select,
  FormControl,
  FormLabel,
  Spinner,
  Center,
  Badge,
} from "@chakra-ui/react";
import { useState } from "react";
import { Helmet } from "react-helmet";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { FaEdit, FaPlus, FaTrash } from "react-icons/fa";
import {
  getModuleCategories,
  createModuleCategory,
  updateModuleCategory,
  deleteModuleCategory,
  IModuleCategory,
} from "../api";
import { displayModuleCategoryName } from "../lib/moduleCategoryDisplay";

export default function ModuleCategorySettings() {
  const { t, i18n } = useTranslation();
  const toast = useToast();
  const queryClient = useQueryClient();
  const pageBg = useColorModeValue("gray.50", "gray.900");
  const cardBg = useColorModeValue("white", "gray.800");
  const borderColor = useColorModeValue("gray.200", "gray.600");
  const muted = useColorModeValue("gray.500", "gray.400");

  const { data: categories, isLoading } = useQuery({
    queryKey: ["moduleCategories"],
    queryFn: () => getModuleCategories(),
  });

  const roots = (categories ?? []).filter((c) => c.parent === null).sort((a, b) => a.sort_order - b.sort_order);

  const { isOpen, onOpen, onClose } = useDisclosure();
  const [editingPk, setEditingPk] = useState<number | null>(null);
  const [parentPk, setParentPk] = useState<string>("");
  const [name, setName] = useState("");
  const [nameKo, setNameKo] = useState("");
  const [nameVi, setNameVi] = useState("");
  const [slug, setSlug] = useState("");
  const [appliesTo, setAppliesTo] = useState("any");
  const [sortOrder, setSortOrder] = useState("0");
  const [saving, setSaving] = useState(false);

  const resetForm = () => {
    setEditingPk(null);
    setParentPk("");
    setName("");
    setNameKo("");
    setNameVi("");
    setSlug("");
    setAppliesTo("any");
    setSortOrder("0");
  };

  const openNew = (defaultParent: number | null = null) => {
    resetForm();
    setParentPk(defaultParent != null ? String(defaultParent) : "");
    onOpen();
  };

  const openEdit = (c: IModuleCategory) => {
    setEditingPk(c.pk);
    setParentPk(c.parent == null ? "" : String(c.parent));
    setName(c.name ?? "");
    setNameKo(c.name_ko ?? "");
    setNameVi(c.name_vi ?? "");
    setSlug(c.slug ?? "");
    setAppliesTo(c.applies_to ?? "any");
    setSortOrder(String(c.sort_order ?? 0));
    onOpen();
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSave = async () => {
    const isRoot = parentPk === "";
    if (!editingPk && isRoot && !slug.trim()) {
      toast({ title: t("moduleCategorySettings.toastSlugRequired"), status: "warning", duration: 3000 });
      return;
    }
    if (!name.trim()) {
      toast({ title: t("moduleCategorySettings.toastNameRequired"), status: "warning", duration: 2000 });
      return;
    }
    setSaving(true);
    try {
      if (editingPk != null) {
        await updateModuleCategory(editingPk, {
          parent: parentPk === "" ? null : Number(parentPk),
          name: name.trim(),
          name_ko: nameKo.trim(),
          name_vi: nameVi.trim(),
          slug: isRoot ? slug.trim().toLowerCase().replace(/\s+/g, "-") : slug.trim() || null,
          sort_order: Number(sortOrder) || 0,
          applies_to: appliesTo,
        });
      } else {
        await createModuleCategory({
          parent: parentPk === "" ? null : Number(parentPk),
          name: name.trim(),
          name_ko: nameKo.trim() || undefined,
          name_vi: nameVi.trim() || undefined,
          slug: isRoot ? slug.trim().toLowerCase().replace(/\s+/g, "-") : undefined,
          sort_order: Number(sortOrder) || 0,
          applies_to: appliesTo,
        });
      }
      toast({ title: t("moduleCategorySettings.toastSaved"), status: "success", duration: 2000 });
      queryClient.invalidateQueries({ queryKey: ["moduleCategories"] });
      handleClose();
    } catch (e: unknown) {
      const msg =
        e && typeof e === "object" && "response" in e
          ? JSON.stringify((e as { response?: { data?: unknown } }).response?.data)
          : t("moduleCategorySettings.toastSaveFailed");
      toast({ title: msg, status: "error", duration: 4000 });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (c: IModuleCategory) => {
    if (!window.confirm(t("moduleCategorySettings.confirmDelete", { name: c.name }))) return;
    try {
      await deleteModuleCategory(c.pk);
      toast({ title: t("moduleCategorySettings.toastDeleted"), status: "success", duration: 2000 });
      queryClient.invalidateQueries({ queryKey: ["moduleCategories"] });
    } catch (e: unknown) {
      const detail =
        e && typeof e === "object" && "response" in e
          ? (e as { response?: { data?: { detail?: string } } }).response?.data?.detail
          : null;
      toast({ title: detail || t("moduleCategorySettings.toastDeleteFailed"), status: "error", duration: 4000 });
    }
  };

  const childrenOf = (parentId: number) =>
    (categories ?? [])
      .filter((c) => c.parent === parentId)
      .sort((a, b) => a.sort_order - b.sort_order);

  return (
    <>
      <Helmet>
        <title>{t("moduleCategorySettings.metaTitle")}</title>
      </Helmet>
      <Box bg={pageBg} minH="100vh" px={{ base: 4, md: 8 }} py={8}>
        <Box maxW="4xl" mx="auto">
          <HStack justify="space-between" mb={6}>
            <Heading size="md">{t("moduleCategorySettings.pageTitle")}</Heading>
            <Button leftIcon={<FaPlus />} colorScheme="blue" size="sm" onClick={() => openNew(null)}>
              {t("moduleCategorySettings.addTopLevel")}
            </Button>
          </HStack>
          <Text fontSize="sm" color={muted} mb={6}>
            {t("moduleCategorySettings.intro")}
          </Text>

          {isLoading ? (
            <Center py={12}>
              <Spinner />
            </Center>
          ) : (
            <VStack align="stretch" spacing={6}>
              {roots.map((r) => (
                <Box key={r.pk} bg={cardBg} borderRadius="lg" border="1px solid" borderColor={borderColor} p={4}>
                  <HStack justify="space-between" mb={2} flexWrap="wrap" gap={2}>
                    <HStack>
                      <Text fontWeight="bold">{displayModuleCategoryName(r, i18n.language)}</Text>
                      {r.slug && (
                        <Badge colorScheme="purple" fontSize="xs">
                          {r.slug}
                        </Badge>
                      )}
                    </HStack>
                    <HStack>
                      <IconButton
                        aria-label={t("moduleCategorySettings.edit")}
                        icon={<FaEdit />}
                        size="xs"
                        variant="ghost"
                        onClick={() => openEdit(r)}
                      />
                      <Button size="xs" leftIcon={<FaPlus />} variant="outline" onClick={() => openNew(r.pk)}>
                        {t("moduleCategorySettings.addSub")}
                      </Button>
                    </HStack>
                  </HStack>
                  {childrenOf(r.pk).length === 0 ? (
                    <Text fontSize="sm" color={muted}>
                      {t("moduleCategorySettings.noChildren")}
                    </Text>
                  ) : (
                    <Table size="sm" variant="simple">
                      <Thead>
                        <Tr>
                          <Th>{t("moduleCategorySettings.tableEn")}</Th>
                          <Th>{t("moduleCategorySettings.tableKo")}</Th>
                          <Th>{t("moduleCategorySettings.tableVi")}</Th>
                          <Th>{t("moduleCategorySettings.applies")}</Th>
                          <Th w="100px">{t("moduleCategorySettings.actions")}</Th>
                        </Tr>
                      </Thead>
                      <Tbody>
                        {childrenOf(r.pk).map((ch) => (
                          <Tr key={ch.pk}>
                            <Td>{ch.name}</Td>
                            <Td>{ch.name_ko || "—"}</Td>
                            <Td>{ch.name_vi || "—"}</Td>
                            <Td>
                              <Badge>{ch.applies_to}</Badge>
                            </Td>
                            <Td>
                              <HStack spacing={0}>
                                <IconButton
                                  aria-label={t("moduleCategorySettings.edit")}
                                  icon={<FaEdit />}
                                  size="xs"
                                  variant="ghost"
                                  onClick={() => openEdit(ch)}
                                />
                                <IconButton
                                  aria-label="Delete"
                                  icon={<FaTrash />}
                                  size="xs"
                                  variant="ghost"
                                  colorScheme="red"
                                  onClick={() => handleDelete(ch)}
                                />
                              </HStack>
                            </Td>
                          </Tr>
                        ))}
                      </Tbody>
                    </Table>
                  )}
                </Box>
              ))}
            </VStack>
          )}
        </Box>
      </Box>

      <Modal isOpen={isOpen} onClose={handleClose} isCentered size="lg">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>
            {editingPk != null ? t("moduleCategorySettings.modalEditTitle") : t("moduleCategorySettings.modalAddTitle")}
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack spacing={4} align="stretch">
              <FormControl isDisabled={editingPk != null}>
                <FormLabel>{t("moduleCategorySettings.parent")}</FormLabel>
                <Select value={parentPk} onChange={(e) => setParentPk(e.target.value)}>
                  <option value="">{t("moduleCategorySettings.parentTop")}</option>
                  {roots.map((r) => (
                    <option key={r.pk} value={String(r.pk)}>
                      {displayModuleCategoryName(r, i18n.language)}
                    </option>
                  ))}
                </Select>
              </FormControl>
              {parentPk === "" && (
                <FormControl>
                  <FormLabel>{t("moduleCategorySettings.slug")}</FormLabel>
                  <Input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="preparation" />
                </FormControl>
              )}
              <FormControl>
                <FormLabel>{t("moduleCategorySettings.nameEn")}</FormLabel>
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </FormControl>
              <FormControl>
                <FormLabel>{t("moduleCategorySettings.nameKo")}</FormLabel>
                <Input value={nameKo} onChange={(e) => setNameKo(e.target.value)} />
              </FormControl>
              <FormControl>
                <FormLabel>{t("moduleCategorySettings.nameVi")}</FormLabel>
                <Input value={nameVi} onChange={(e) => setNameVi(e.target.value)} />
              </FormControl>
              <HStack>
                <FormControl>
                  <FormLabel>{t("moduleCategorySettings.sortOrder")}</FormLabel>
                  <Input type="number" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} />
                </FormControl>
                <FormControl>
                  <FormLabel>{t("moduleCategorySettings.appliesTo")}</FormLabel>
                  <Select value={appliesTo} onChange={(e) => setAppliesTo(e.target.value)}>
                    <option value="any">any</option>
                    <option value="general">general</option>
                    <option value="handbag">handbag</option>
                  </Select>
                </FormControl>
              </HStack>
            </VStack>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={handleClose}>
              {t("moduleCategorySettings.cancel")}
            </Button>
            <Button colorScheme="blue" isLoading={saving} onClick={handleSave}>
              {t("moduleCategorySettings.save")}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
}
