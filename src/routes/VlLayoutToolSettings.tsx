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
  Textarea,
  Th,
  Thead,
  Tr,
  useColorModeValue,
  useDisclosure,
  useToast,
} from "@chakra-ui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Helmet } from "react-helmet";
import { Link as RouterLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useState } from "react";
import { FaEdit, FaPlus, FaTrash } from "react-icons/fa";
import { createLayoutTool, deleteLayoutTool, getLayoutTools, ILayoutTool, patchLayoutTool } from "../api";

const emptyForm = (): {
  code: string;
  name: string;
  description: string;
  sort_order: number;
  is_active: boolean;
} => ({
  code: "",
  name: "",
  description: "",
  sort_order: 0,
  is_active: true,
});

export default function VlLayoutToolSettings() {
  const { t } = useTranslation();
  const toast = useToast();
  const queryClient = useQueryClient();
  const pageBg = useColorModeValue("gray.50", "gray.900");
  const cardBg = useColorModeValue("white", "gray.800");
  const border = useColorModeValue("gray.200", "gray.600");
  const rowHoverBg = useColorModeValue("gray.50", "gray.700");

  const { isOpen, onOpen, onClose } = useDisclosure();
  const [editing, setEditing] = useState<ILayoutTool | null>(null);
  const [form, setForm] = useState(emptyForm());

  const { data, isLoading, isError } = useQuery({
    queryKey: ["layoutTools", "all"],
    queryFn: () => getLayoutTools({ include_inactive: true }),
  });

  const createMut = useMutation({
    mutationFn: createLayoutTool,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["layoutTools"] });
      toast({ title: t("vlLayouts.toolSettings.saved"), status: "success" });
      onClose();
      setForm(emptyForm());
    },
    onError: (err: unknown) => {
      const msg =
        err && typeof err === "object" && "response" in err
          ? (err as { response?: { data?: unknown } }).response?.data
          : undefined;
      toast({
        title: t("vlLayouts.toolSettings.saveError"),
        description: typeof msg === "string" ? msg : JSON.stringify(msg),
        status: "error",
      });
    },
  });

  const patchMut = useMutation({
    mutationFn: ({ pk, body }: { pk: number; body: Partial<ILayoutTool> }) => patchLayoutTool(pk, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["layoutTools"] });
      toast({ title: t("vlLayouts.toolSettings.saved"), status: "success" });
      onClose();
      setEditing(null);
    },
    onError: () => toast({ title: t("vlLayouts.toolSettings.saveError"), status: "error" }),
  });

  const delMut = useMutation({
    mutationFn: deleteLayoutTool,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["layoutTools"] });
      toast({ title: t("vlLayouts.toolSettings.deleted"), status: "success" });
    },
    onError: (err: unknown) => {
      const detail =
        err && typeof err === "object" && "response" in err
          ? (err as { response?: { data?: { detail?: string } } }).response?.data?.detail
          : undefined;
      toast({
        title: t("vlLayouts.toolSettings.deleteError"),
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

  const openEdit = (row: ILayoutTool) => {
    setEditing(row);
    setForm({
      code: row.code,
      name: row.name,
      description: row.description,
      sort_order: row.sort_order,
      is_active: row.is_active,
    });
    onOpen();
  };

  const onSubmit = () => {
    const code = form.code.trim();
    if (!code) {
      toast({ title: t("vlLayouts.toolSettings.codeRequired"), status: "warning" });
      return;
    }
    if (editing) {
      patchMut.mutate({
        pk: editing.pk,
        body: {
          name: form.name,
          description: form.description,
          sort_order: form.sort_order,
          is_active: form.is_active,
        },
      });
    } else {
      createMut.mutate({
        code,
        name: form.name,
        description: form.description,
        sort_order: form.sort_order,
        is_active: form.is_active,
      });
    }
  };

  return (
    <Box minH="100vh" bg={pageBg} py={8} px={{ base: 4, md: 10 }}>
      <Helmet>
        <title>{t("vlLayouts.toolSettings.pageTitle")} — SJ VL Factory</title>
      </Helmet>
      <Box maxW="1100px" mx="auto">
        <HStack justify="space-between" mb={6} flexWrap="wrap" gap={3}>
          <Heading size="lg">{t("vlLayouts.toolSettings.pageTitle")}</Heading>
          <HStack>
            <Button as={RouterLink} to="/vl-layouts" variant="ghost" size="sm">
              {t("vlLayouts.toolSettings.backToList")}
            </Button>
            <Button colorScheme="blue" leftIcon={<FaPlus />} onClick={openCreate}>
              {t("vlLayouts.toolSettings.add")}
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
              <Text color="red.500">{t("vlLayouts.toolSettings.loadError")}</Text>
            </Center>
          ) : (
            <TableContainer>
              <Table size="sm">
                <Thead>
                  <Tr>
                    <Th>{t("vlLayouts.toolSettings.colCode")}</Th>
                    <Th>{t("vlLayouts.toolSettings.colName")}</Th>
                    <Th>{t("vlLayouts.toolSettings.colDescription")}</Th>
                    <Th isNumeric>{t("vlLayouts.toolSettings.colSort")}</Th>
                    <Th>{t("vlLayouts.toolSettings.colActive")}</Th>
                    <Th />
                  </Tr>
                </Thead>
                <Tbody>
                  {(data ?? []).map((row) => (
                    <Tr key={row.pk} _hover={{ bg: rowHoverBg }}>
                      <Td fontWeight="medium">{row.code}</Td>
                      <Td>{row.name}</Td>
                      <Td>{row.description}</Td>
                      <Td isNumeric>{row.sort_order}</Td>
                      <Td>{row.is_active ? "✓" : "—"}</Td>
                      <Td>
                        <HStack spacing={1}>
                          <IconButton aria-label="edit" icon={<FaEdit />} size="sm" variant="ghost" onClick={() => openEdit(row)} />
                          <IconButton
                            aria-label="delete"
                            icon={<FaTrash />}
                            size="sm"
                            variant="ghost"
                            colorScheme="red"
                            onClick={() => {
                              if (window.confirm(t("vlLayouts.toolSettings.deleteConfirm"))) {
                                delMut.mutate(row.pk);
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
          <ModalHeader>{editing ? t("vlLayouts.toolSettings.editTitle") : t("vlLayouts.toolSettings.createTitle")}</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Stack spacing={3}>
              <FormControl isRequired>
                <FormLabel>{t("vlLayouts.toolSettings.colCode")}</FormLabel>
                <Input
                  value={form.code}
                  onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                  isReadOnly={!!editing}
                  placeholder="e.g. drill_01"
                />
              </FormControl>
              <FormControl>
                <FormLabel>{t("vlLayouts.toolSettings.colName")}</FormLabel>
                <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
              </FormControl>
              <FormControl>
                <FormLabel>{t("vlLayouts.toolSettings.colDescription")}</FormLabel>
                <Textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
              </FormControl>
              <FormControl>
                <FormLabel>{t("vlLayouts.toolSettings.colSort")}</FormLabel>
                <NumberInput min={0} value={form.sort_order} onChange={(_, v) => setForm((f) => ({ ...f, sort_order: v }))}>
                  <NumberInputField />
                </NumberInput>
              </FormControl>
              <FormControl display="flex" alignItems="center">
                <FormLabel mb={0}>{t("vlLayouts.toolSettings.colActive")}</FormLabel>
                <Switch isChecked={form.is_active} onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))} />
              </FormControl>
            </Stack>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={onClose}>
              {t("vlLayouts.common.cancel")}
            </Button>
            <Button colorScheme="blue" onClick={onSubmit} isLoading={createMut.isPending || patchMut.isPending}>
              {t("vlLayouts.toolSettings.save")}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  );
}
