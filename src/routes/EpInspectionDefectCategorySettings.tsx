import {
  Box,
  Button,
  Center,
  FormControl,
  FormLabel,
  Heading,
  HStack,
  IconButton,
  Input,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  NumberInput,
  NumberInputField,
  Spinner,
  Stack,
  Switch,
  Table,
  TableContainer,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
  useColorModeValue,
  useDisclosure,
  useToast,
} from "@chakra-ui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Helmet } from "react-helmet";
import { Link as RouterLink, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useState } from "react";
import { FaEdit, FaPlus, FaTrash } from "react-icons/fa";
import {
  createDefectCategory,
  deleteDefectCategory,
  getDefectCategories,
  IDefectCategory,
  patchDefectCategory,
} from "../api";

const emptyForm = (): {
  code: string;
  name_ko: string;
  name_en: string;
  name_vi: string;
  sort_order: number;
  is_active: boolean;
} => ({
  code: "",
  name_ko: "",
  name_en: "",
  name_vi: "",
  sort_order: 0,
  is_active: true,
});

export default function EpInspectionDefectCategorySettings() {
  const { t } = useTranslation();
  const location = useLocation();
  const isVlAssemblyContext = location.pathname.includes("/vl-assembly-production/");
  const inspectionsListPath = isVlAssemblyContext
    ? "/vl-assembly-production/inspections"
    : "/ep-production/inspections";
  const toast = useToast();
  const queryClient = useQueryClient();
  const pageBg = useColorModeValue("gray.50", "gray.900");
  const cardBg = useColorModeValue("white", "gray.800");
  const border = useColorModeValue("gray.200", "gray.600");
  const rowHoverBg = useColorModeValue("gray.50", "gray.700");

  const { isOpen, onOpen, onClose } = useDisclosure();
  const [editing, setEditing] = useState<IDefectCategory | null>(null);
  const [form, setForm] = useState(emptyForm());

  const { data, isLoading, isError } = useQuery({
    queryKey: ["defectCategories", "all"],
    queryFn: () => getDefectCategories({ include_inactive: true }),
  });

  const createMut = useMutation({
    mutationFn: createDefectCategory,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["defectCategories"] });
      toast({ title: t("epInspection.defectCat.saved"), status: "success" });
      onClose();
      setForm(emptyForm());
    },
    onError: (err: unknown) => {
      const msg =
        err && typeof err === "object" && "response" in err
          ? (err as { response?: { data?: unknown } }).response?.data
          : undefined;
      toast({
        title: t("epInspection.defectCat.saveError"),
        description: typeof msg === "string" ? msg : JSON.stringify(msg),
        status: "error",
      });
    },
  });

  const patchMut = useMutation({
    mutationFn: ({ pk, body }: { pk: number; body: Partial<IDefectCategory> }) =>
      patchDefectCategory(pk, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["defectCategories"] });
      toast({ title: t("epInspection.defectCat.saved"), status: "success" });
      onClose();
      setEditing(null);
    },
    onError: () => toast({ title: t("epInspection.defectCat.saveError"), status: "error" }),
  });

  const delMut = useMutation({
    mutationFn: deleteDefectCategory,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["defectCategories"] });
      toast({ title: t("epInspection.defectCat.deleted"), status: "success" });
    },
    onError: (err: unknown) => {
      const detail =
        err && typeof err === "object" && "response" in err
          ? (err as { response?: { data?: { detail?: string } } }).response?.data?.detail
          : undefined;
      toast({
        title: t("epInspection.defectCat.deleteError"),
        description: detail,
        status: "error",
      });
    },
  });

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm());
    onOpen();
  };

  const openEdit = (row: IDefectCategory) => {
    setEditing(row);
    setForm({
      code: row.code,
      name_ko: row.name_ko,
      name_en: row.name_en,
      name_vi: row.name_vi,
      sort_order: row.sort_order,
      is_active: row.is_active,
    });
    onOpen();
  };

  const onSubmit = () => {
    const code = form.code.trim();
    if (!code) {
      toast({ title: t("epInspection.defectCat.codeRequired"), status: "warning" });
      return;
    }
    if (editing) {
      patchMut.mutate({
        pk: editing.id,
        body: {
          name_ko: form.name_ko,
          name_en: form.name_en,
          name_vi: form.name_vi,
          sort_order: form.sort_order,
          is_active: form.is_active,
        },
      });
    } else {
      createMut.mutate({
        code,
        name_ko: form.name_ko,
        name_en: form.name_en,
        name_vi: form.name_vi,
        sort_order: form.sort_order,
        is_active: form.is_active,
      });
    }
  };

  return (
    <Box minH="100vh" bg={pageBg} py={8} px={{ base: 4, md: 10 }}>
      <Helmet>
        <title>
          {t("epInspection.defectCat.pageTitle")}
          {isVlAssemblyContext ? " — SJ VL Assembly" : " — SJ EP"}
        </title>
      </Helmet>
      <Box maxW="1100px" mx="auto">
        <HStack justify="space-between" mb={6} flexWrap="wrap" gap={3}>
          <Heading size="lg">{t("epInspection.defectCat.pageTitle")}</Heading>
          <HStack>
            <Button as={RouterLink} to={inspectionsListPath} variant="ghost" size="sm">
              {t("epInspection.backToList")}
            </Button>
            <Button colorScheme="blue" leftIcon={<FaPlus />} onClick={openCreate}>
              {t("epInspection.defectCat.add")}
            </Button>
          </HStack>
        </HStack>

        <Box bg={cardBg} borderWidth="1px" borderColor={border} borderRadius="md" overflow="hidden">
          {isLoading ? (
            <Center py={16}>
              <Spinner />
            </Center>
          ) : isError ? (
            <Center py={16}>
              <Text color="red.500">{t("epInspection.loadError")}</Text>
            </Center>
          ) : (
            <TableContainer>
              <Table size="sm">
                <Thead>
                  <Tr>
                    <Th>{t("epInspection.defectCat.colCode")}</Th>
                    <Th>{t("epInspection.defectCat.colKo")}</Th>
                    <Th>{t("epInspection.defectCat.colEn")}</Th>
                    <Th>{t("epInspection.defectCat.colVi")}</Th>
                    <Th isNumeric>{t("epInspection.defectCat.colSort")}</Th>
                    <Th>{t("epInspection.defectCat.colActive")}</Th>
                    <Th />
                  </Tr>
                </Thead>
                <Tbody>
                  {(data ?? []).map((row) => (
                    <Tr key={row.id} _hover={{ bg: rowHoverBg }}>
                      <Td fontWeight="medium">{row.code}</Td>
                      <Td>{row.name_ko}</Td>
                      <Td>{row.name_en}</Td>
                      <Td>{row.name_vi}</Td>
                      <Td isNumeric>{row.sort_order}</Td>
                      <Td>{row.is_active ? "✓" : "—"}</Td>
                      <Td>
                        <HStack spacing={1}>
                          <IconButton
                            aria-label="edit"
                            icon={<FaEdit />}
                            size="sm"
                            variant="ghost"
                            onClick={() => openEdit(row)}
                          />
                          <IconButton
                            aria-label="delete"
                            icon={<FaTrash />}
                            size="sm"
                            variant="ghost"
                            colorScheme="red"
                            onClick={() => {
                              if (window.confirm(t("epInspection.defectCat.deleteConfirm"))) {
                                delMut.mutate(row.id);
                              }
                            }}
                          />
                        </HStack>
                      </Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            </TableContainer>
          )}
        </Box>
      </Box>

      <Modal isOpen={isOpen} onClose={onClose} size="lg">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>
            {editing ? t("epInspection.defectCat.editTitle") : t("epInspection.defectCat.createTitle")}
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Stack spacing={3}>
              <FormControl isRequired>
                <FormLabel>{t("epInspection.defectCat.colCode")}</FormLabel>
                <Input
                  value={form.code}
                  onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                  isReadOnly={!!editing}
                  placeholder="e.g. stitch_skip"
                />
              </FormControl>
              <FormControl>
                <FormLabel>{t("epInspection.defectCat.colKo")}</FormLabel>
                <Input
                  value={form.name_ko}
                  onChange={(e) => setForm((f) => ({ ...f, name_ko: e.target.value }))}
                />
              </FormControl>
              <FormControl>
                <FormLabel>{t("epInspection.defectCat.colEn")}</FormLabel>
                <Input
                  value={form.name_en}
                  onChange={(e) => setForm((f) => ({ ...f, name_en: e.target.value }))}
                />
              </FormControl>
              <FormControl>
                <FormLabel>{t("epInspection.defectCat.colVi")}</FormLabel>
                <Input
                  value={form.name_vi}
                  onChange={(e) => setForm((f) => ({ ...f, name_vi: e.target.value }))}
                />
              </FormControl>
              <FormControl>
                <FormLabel>{t("epInspection.defectCat.colSort")}</FormLabel>
                <NumberInput
                  min={0}
                  value={form.sort_order}
                  onChange={(_, v) => setForm((f) => ({ ...f, sort_order: v }))}
                >
                  <NumberInputField />
                </NumberInput>
              </FormControl>
              <FormControl display="flex" alignItems="center">
                <FormLabel mb={0}>{t("epInspection.defectCat.colActive")}</FormLabel>
                <Switch
                  isChecked={form.is_active}
                  onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
                />
              </FormControl>
            </Stack>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={onClose}>
              {t("epInspection.cancel")}
            </Button>
            <Button
              colorScheme="blue"
              onClick={onSubmit}
              isLoading={createMut.isPending || patchMut.isPending}
            >
              {t("epInspection.save")}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  );
}
