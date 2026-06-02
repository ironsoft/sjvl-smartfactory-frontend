import {
  Box,
  Heading,
  Stat,
  StatLabel,
  StatNumber,
  Table,
  TableContainer,
  Tbody,
  Td,
  Th,
  Thead,
  Tr,
  useColorModeValue,
  Spinner,
  Center,
  Text,
  Button,
  IconButton,
  Link,
  HStack,
  Badge,
  Image,
  Skeleton,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalCloseButton,
  useDisclosure,
  VStack,
  Input,
  Textarea,
  Select,
  useToast,
  Tabs,
  TabList,
  Tab,
  TabPanels,
  TabPanel,
  Divider,
  AlertDialog,
  AlertDialogOverlay,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogBody,
  AlertDialogFooter,
} from "@chakra-ui/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Helmet } from "react-helmet";
import {
  getSjStyles,
  getSjStylePhotos,
  createSjStyle,
  createSjStylePhoto,
  getUploadURL,
  uploadImage,
  getBagCategories,
  getBodyMaterials,
  getBuyerBrands,
  getBagTypes,
  createBagCategory, updateBagCategory, deleteBagCategory,
  createBodyMaterial, updateBodyMaterial, deleteBodyMaterial,
  createBuyerBrand, updateBuyerBrand, deleteBuyerBrand,
  createBagType, updateBagType, deleteBagType,
  IFilePhotos,
  ISjStyle,
  ISjStyleListResponse,
  ISjStyleCreateForm,
  ISjBagCategory,
  ISjBodyMaterial,
  ISjBuyerBrand,
  ISjBagType
} from "../api";
import SearchInput from "../components/SearchInput";
import { Link as RouterLink } from "react-router-dom";
import { FaChevronLeft, FaChevronRight, FaPlus, FaTimes, FaCog, FaEdit, FaTrash } from "react-icons/fa";
import { useState, useRef, useCallback } from "react";

function SjStylePhotoCell({ stylePk }: { stylePk: number }) {
  const { data: photos, isLoading } = useQuery<IFilePhotos[]>({
    queryKey: ["sjStylePhotos", stylePk],
    queryFn: () => getSjStylePhotos(stylePk),
    enabled: !!stylePk
  });

  return (
    <Box boxSize="44px" flexShrink={0}>
      {isLoading ? (
        <Skeleton boxSize="44px" borderRadius="md" />
      ) : photos && photos.length > 0 ? (
        <Link as={RouterLink} to={`/sjstyles/${stylePk}`}>
          <Image
            src={photos[0].file}
            alt="style photo"
            boxSize="44px"
            objectFit="cover"
            borderRadius="md"
            _hover={{ opacity: 0.8, transform: "scale(1.05)", transition: "all 0.2s" }}
          />
        </Link>
      ) : (
        <Box boxSize="44px" />
      )}
    </Box>
  );
}

const EMPTY_FORM: ISjStyleCreateForm = {
  code: "",
  style_name: "",
  buyer_style_code: "",
  internal_style_code: "",
  pattern_code: "",
  description: "",
  bag_category: null,
  body_material: null,
  buyer_brand: null,
  bag_type: null,
};

// ── Meta item type ──────────────────────────────────────────────────────────
type MetaItem = ISjBagCategory | ISjBodyMaterial | ISjBuyerBrand | ISjBagType;

interface MetaTabConfig {
  label: string;
  queryKey: string;
  fetchFn: () => Promise<MetaItem[]>;
  createFn: (data: { name: string; code: string }) => Promise<MetaItem>;
  updateFn: (pk: number, data: { name: string; code: string }) => Promise<MetaItem>;
  deleteFn: (pk: number) => Promise<any>;
}

function MetaTab({ config }: { config: MetaTabConfig }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const { data: items = [] } = useQuery<MetaItem[]>({
    queryKey: [config.queryKey],
    queryFn: config.fetchFn,
  });

  const [newName, setNewName] = useState("");
  const [newCode, setNewCode] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  const [editingPk, setEditingPk] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editCode, setEditCode] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const [deletePk, setDeletePk] = useState<number | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const cancelRef = useRef<HTMLButtonElement>(null);

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: [config.queryKey] });
    queryClient.invalidateQueries({ queryKey: ["bagCategories"] });
    queryClient.invalidateQueries({ queryKey: ["bodyMaterials"] });
    queryClient.invalidateQueries({ queryKey: ["buyerBrands"] });
    queryClient.invalidateQueries({ queryKey: ["bagTypes"] });
  }, [queryClient, config.queryKey]);

  const handleAdd = async () => {
    if (!newName.trim()) return;
    setIsAdding(true);
    try {
      await config.createFn({ name: newName.trim(), code: newCode.trim() });
      setNewName("");
      setNewCode("");
      invalidate();
      toast({ title: "Created", status: "success", duration: 1500, position: "bottom-right" });
    } catch {
      toast({ title: "Failed to create", status: "error", duration: 2000, position: "bottom-right" });
    } finally {
      setIsAdding(false);
    }
  };

  const startEdit = (item: MetaItem) => {
    setEditingPk(item.pk);
    setEditName(item.name);
    setEditCode(item.code ?? "");
  };

  const handleSave = async () => {
    if (editingPk == null || !editName.trim()) return;
    setIsSaving(true);
    try {
      await config.updateFn(editingPk, { name: editName.trim(), code: editCode.trim() });
      setEditingPk(null);
      invalidate();
      toast({ title: "Updated", status: "success", duration: 1500, position: "bottom-right" });
    } catch {
      toast({ title: "Failed to update", status: "error", duration: 2000, position: "bottom-right" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (deletePk == null) return;
    setIsDeleting(true);
    try {
      await config.deleteFn(deletePk);
      setDeletePk(null);
      invalidate();
      toast({ title: "Deleted", status: "success", duration: 1500, position: "bottom-right" });
    } catch {
      toast({ title: "Failed to delete", status: "error", duration: 2000, position: "bottom-right" });
    } finally {
      setIsDeleting(false);
    }
  };

  const rowBg = useColorModeValue("gray.50", "gray.700");

  return (
    <Box>
      {/* Add new row */}
      <HStack mb={3} spacing={2}>
        <Input
          size="sm"
          placeholder="Name *"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          flex={2}
        />
        <Input
          size="sm"
          placeholder="Code (optional)"
          value={newCode}
          onChange={(e) => setNewCode(e.target.value)}
          flex={1}
        />
        <IconButton
          aria-label="Add"
          icon={<FaPlus />}
          size="sm"
          colorScheme="blue"
          isDisabled={!newName.trim()}
          isLoading={isAdding}
          onClick={handleAdd}
        />
      </HStack>
      <Divider mb={3} />

      {/* List */}
      <VStack spacing={2} align="stretch" maxH="320px" overflowY="auto">
        {items.length === 0 && (
          <Text fontSize="sm" color="gray.400" textAlign="center" py={4}>No items yet.</Text>
        )}
        {items.map((item) =>
          editingPk === item.pk ? (
            <HStack key={item.pk} spacing={2} p={2} bg={rowBg} borderRadius="md">
              <Input
                size="sm"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                flex={2}
                autoFocus
              />
              <Input
                size="sm"
                value={editCode}
                onChange={(e) => setEditCode(e.target.value)}
                flex={1}
                placeholder="Code"
              />
              <Button size="sm" colorScheme="blue" isLoading={isSaving} onClick={handleSave}>Save</Button>
              <Button size="sm" variant="ghost" onClick={() => setEditingPk(null)}>Cancel</Button>
            </HStack>
          ) : (
            <HStack key={item.pk} spacing={2} p={2} bg={rowBg} borderRadius="md" justify="space-between">
              <HStack spacing={2}>
                <Text fontSize="sm" fontWeight="semibold">{item.name}</Text>
                {item.code && <Badge fontSize="xs" colorScheme="gray">{item.code}</Badge>}
              </HStack>
              <HStack spacing={1}>
                <IconButton aria-label="Edit" icon={<FaEdit />} size="xs" variant="ghost" onClick={() => startEdit(item)} />
                <IconButton aria-label="Delete" icon={<FaTrash />} size="xs" variant="ghost" colorScheme="red" onClick={() => setDeletePk(item.pk)} />
              </HStack>
            </HStack>
          )
        )}
      </VStack>

      {/* Delete confirm dialog */}
      <AlertDialog isOpen={deletePk !== null} leastDestructiveRef={cancelRef} onClose={() => setDeletePk(null)}>
        <AlertDialogOverlay>
          <AlertDialogContent>
            <AlertDialogHeader fontSize="lg" fontWeight="bold">Delete Item</AlertDialogHeader>
            <AlertDialogBody>Are you sure? Styles using this item will lose the reference.</AlertDialogBody>
            <AlertDialogFooter>
              <Button ref={cancelRef} onClick={() => setDeletePk(null)}>Cancel</Button>
              <Button colorScheme="red" ml={3} isLoading={isDeleting} onClick={handleDelete}>Delete</Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>
    </Box>
  );
}

export default function SjStyleList() {
  const tableBgColor = useColorModeValue("gray.50", "gray.800");
  const pageBg = useColorModeValue("gray.50", "gray.900");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const toast = useToast();
  const queryClient = useQueryClient();
  const { isOpen, onOpen, onClose } = useDisclosure();
  const { isOpen: isMetaOpen, onOpen: onMetaOpen, onClose: onMetaClose } = useDisclosure();
  const [form, setForm] = useState<ISjStyleCreateForm>(EMPTY_FORM);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const { data: bagCategories = [] } = useQuery<ISjBagCategory[]>({ queryKey: ["bagCategories"], queryFn: getBagCategories });
  const { data: bodyMaterials = [] } = useQuery<ISjBodyMaterial[]>({ queryKey: ["bodyMaterials"], queryFn: getBodyMaterials });
  const { data: buyerBrands = [] } = useQuery<ISjBuyerBrand[]>({ queryKey: ["buyerBrands"], queryFn: getBuyerBrands });
  const { data: bagTypes = [] } = useQuery<ISjBagType[]>({ queryKey: ["bagTypes"], queryFn: getBagTypes });

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const clearPhoto = () => {
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoFile(null);
    setPhotoPreview(null);
    if (photoInputRef.current) photoInputRef.current.value = "";
  };

  const handleCreate = async () => {
    if (!form.code.trim() || !form.style_name.trim()) return;
    setIsSubmitting(true);
    try {
      const created = await createSjStyle(form);
      const stylePk: number = created.pk;
      if (photoFile) {
        const urlData = await getUploadURL();
        const dt = new DataTransfer();
        dt.items.add(photoFile);
        const cfResult: any = await uploadImage({ file: dt.files, uploadURL: urlData.uploadURL });
        const cfUrl = `https://imagedelivery.net/mzmXhxWLR9jzdX8u9g4BBQ/${cfResult.result.id}/public`;
        await createSjStylePhoto(stylePk, cfUrl, form.style_name);
      }
      toast({ title: "Style created", status: "success", duration: 2000, position: "bottom-right" });
      queryClient.invalidateQueries({ queryKey: ["sjstyles"] });
      queryClient.invalidateQueries({ queryKey: ["sjStylePhotos", stylePk] });
      setForm(EMPTY_FORM);
      clearPhoto();
      onClose();
    } catch {
      toast({ title: "Failed to create style", status: "error", duration: 2000, position: "bottom-right" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const { data, isLoading, isFetching, error } = useQuery<ISjStyleListResponse>(
    {
      queryKey: ["sjstyles", searchQuery, currentPage],
      queryFn: () => getSjStyles({ search: searchQuery, page: currentPage })
    }
  );

  const totalPages = data?.total_pages ?? 1;

  const styles: ISjStyle[] = (() => {
    if (!data) return [];
    if (Array.isArray(data)) return data;
    if ("results" in data && Array.isArray(data.results)) return data.results;
    return [];
  })();

  const totalResults = data?.total_results ?? data?.count ?? styles.length;

  const errorMessage = error
    ? error instanceof Error
      ? error.message
      : "데이터를 불러오는 중 오류가 발생했습니다."
    : null;

  return (
    <>
      <Helmet>
        <title>SJ Style List</title>
      </Helmet>

      <Box
        bg={pageBg}
        minW="100%"
        minH="100%"
        px={{ base: "4", md: "8", lg: "12" }}
        py={{ base: "6", md: "8", lg: "8" }}
      >
        <Box maxW={{ base: "3xl", lg: "8xl" }} mx="auto">
          {/* 헤딩 & 검색 */}
          <HStack justify="space-between" align="center" mb={5}>
            <Heading size="md">SJ Style List</Heading>
            <SearchInput
              onSearch={(q) => {
                setSearchQuery(q);
                setCurrentPage(1);
              }}
              onInputChange={(v) => {
                if (v === "") {
                  setSearchQuery("");
                  setCurrentPage(1);
                }
              }}
            />
          </HStack>

          {/* 전체 수 */}
          <Stat mb={5}>
            <StatLabel>Total Style Count</StatLabel>
            <StatNumber>{totalResults}</StatNumber>
          </Stat>

          {/* 테이블 상단 오른쪽 버튼 */}
          <HStack justify="flex-end" mb={2}>
            <IconButton
              aria-label="Meta Settings"
              icon={<FaCog />}
              size="sm"
              variant="ghost"
              colorScheme="gray"
              onClick={onMetaOpen}
            />
            <IconButton
              aria-label="Add SJ Style"
              icon={<FaPlus />}
              size="sm"
              colorScheme="blue"
              variant="ghost"
              onClick={onOpen}
            />
          </HStack>

          {/* 테이블 */}
          <TableContainer>
            <Table variant="striped">
              <Thead bgColor={tableBgColor}>
                <Tr>
                  <Th>Style Code</Th>
                  <Th>Photo</Th>
                  <Th>Style Name</Th>
                  <Th isNumeric>SJ No Count</Th>
                  <Th>Buyer Style Code</Th>
                  <Th>Internal Style Code</Th>
                  <Th>Pattern Code</Th>
                  <Th>Category</Th>
                  <Th>Material</Th>
                  <Th>Brand</Th>
                  <Th>Bag Type</Th>
                </Tr>
              </Thead>
              <Tbody>
                {(isLoading || isFetching) && styles.length === 0 && (
                  <Tr>
                    <Td colSpan={11}>
                      <Center py={6}>
                        <Spinner size="md" />
                      </Center>
                    </Td>
                  </Tr>
                )}
                {errorMessage && (
                  <Tr>
                    <Td colSpan={11}>
                      <Text color="red.500" textAlign="center">
                        {errorMessage}
                      </Text>
                    </Td>
                  </Tr>
                )}
                {!isLoading &&
                  !isFetching &&
                  !errorMessage &&
                  styles.length === 0 && (
                    <Tr>
                      <Td colSpan={11}>
                        <Text color="gray.400" textAlign="center">
                          No search results found.
                        </Text>
                      </Td>
                    </Tr>
                  )}
                {styles.map((style, index) => (
                  <Tr key={style.pk ?? index}>
                    <Td>
                      <Link
                        as={RouterLink}
                        to={`/sjstyles/${style.pk}`}
                        color="blue.500"
                        fontWeight="semibold"
                      >
                        {style.code}
                      </Link>
                    </Td>
                    <Td>
                      <SjStylePhotoCell stylePk={style.pk} />
                    </Td>
                    <Td>{style.style_name || "-"}</Td>
                    <Td isNumeric>
                      {style.sj_nos_count ? (
                        <Link
                          as={RouterLink}
                          to={`/sjstyles/${style.pk}#sj-no-list`}
                          color="blue.500"
                          fontWeight="semibold"
                        >
                          {style.sj_nos_count}
                        </Link>
                      ) : "-"}
                    </Td>
                    <Td>
                      {style.buyer_style_code ? (
                        style.buyer_style_code
                      ) : (
                        <Text color="gray.400">-</Text>
                      )}
                    </Td>
                    <Td>
                      {style.internal_style_code ? (
                        style.internal_style_code
                      ) : (
                        <Text color="gray.400">-</Text>
                      )}
                    </Td>
                    <Td>
                      {style.pattern_code ? (
                        style.pattern_code
                      ) : (
                        <Text color="gray.400">-</Text>
                      )}
                    </Td>
                    <Td>
                      {style.bag_category ? (
                        <Badge colorScheme="purple">
                          {style.bag_category.name}
                        </Badge>
                      ) : (
                        <Text color="gray.400">-</Text>
                      )}
                    </Td>
                    <Td>
                      {style.body_material ? (
                        <Badge colorScheme="green">
                          {style.body_material.name}
                        </Badge>
                      ) : (
                        <Text color="gray.400">-</Text>
                      )}
                    </Td>
                    <Td>
                      {style.buyer_brand ? (
                        <Badge colorScheme="blue">
                          {style.buyer_brand.name}
                        </Badge>
                      ) : (
                        <Text color="gray.400">-</Text>
                      )}
                    </Td>
                    <Td>
                      {style.bag_type ? (
                        <Badge colorScheme="orange">
                          {style.bag_type.name}
                        </Badge>
                      ) : (
                        <Text color="gray.400">-</Text>
                      )}
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </TableContainer>

          {/* 페이지네이션 */}
          {totalPages > 1 && (
            <HStack justify="center" mt={6} spacing={1}>
              <IconButton
                aria-label="First page"
                icon={<FaChevronLeft />}
                size="sm"
                variant="ghost"
                isDisabled={currentPage <= 1 || isFetching}
                onClick={() => setCurrentPage(1)}
              />
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter(
                  (p) =>
                    p === 1 ||
                    p === totalPages ||
                    Math.abs(p - currentPage) <= 2
                )
                .reduce<(number | "...")[]>((acc, p, idx, arr) => {
                  if (idx > 0 && p - (arr[idx - 1] as number) > 1)
                    acc.push("...");
                  acc.push(p);
                  return acc;
                }, [])
                .map((item, idx) =>
                  item === "..." ? (
                    <Text key={`ellipsis-${idx}`} px={2} color="gray.400">
                      …
                    </Text>
                  ) : (
                    <Button
                      key={item}
                      size="sm"
                      variant={currentPage === item ? "solid" : "ghost"}
                      colorScheme={currentPage === item ? "blue" : "gray"}
                      isDisabled={isFetching}
                      onClick={() => setCurrentPage(item as number)}
                      minW="32px"
                    >
                      {item}
                    </Button>
                  )
                )}
              <IconButton
                aria-label="Last page"
                icon={<FaChevronRight />}
                size="sm"
                variant="ghost"
                isDisabled={currentPage >= totalPages || isFetching}
                onClick={() => setCurrentPage(totalPages)}
              />
            </HStack>
          )}
        </Box>
      </Box>

      {/* ── Meta Settings 모달 ── */}
      <Modal isOpen={isMetaOpen} onClose={onMetaClose} size="md">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Meta Settings</ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={6}>
            <Tabs variant="enclosed" size="sm">
              <TabList>
                <Tab>Category</Tab>
                <Tab>Material</Tab>
                <Tab>Brand</Tab>
                <Tab>Bag Type</Tab>
              </TabList>
              <TabPanels>
                <TabPanel>
                  <MetaTab config={{
                    label: "Category",
                    queryKey: "bagCategories",
                    fetchFn: getBagCategories,
                    createFn: createBagCategory,
                    updateFn: updateBagCategory,
                    deleteFn: deleteBagCategory,
                  }} />
                </TabPanel>
                <TabPanel>
                  <MetaTab config={{
                    label: "Material",
                    queryKey: "bodyMaterials",
                    fetchFn: getBodyMaterials,
                    createFn: createBodyMaterial,
                    updateFn: updateBodyMaterial,
                    deleteFn: deleteBodyMaterial,
                  }} />
                </TabPanel>
                <TabPanel>
                  <MetaTab config={{
                    label: "Brand",
                    queryKey: "buyerBrands",
                    fetchFn: getBuyerBrands,
                    createFn: createBuyerBrand,
                    updateFn: updateBuyerBrand,
                    deleteFn: deleteBuyerBrand,
                  }} />
                </TabPanel>
                <TabPanel>
                  <MetaTab config={{
                    label: "Bag Type",
                    queryKey: "bagTypes",
                    fetchFn: getBagTypes,
                    createFn: createBagType,
                    updateFn: updateBagType,
                    deleteFn: deleteBagType,
                  }} />
                </TabPanel>
              </TabPanels>
            </Tabs>
          </ModalBody>
        </ModalContent>
      </Modal>

      {/* ── SJ Style 생성 모달 ── */}
      <Modal isOpen={isOpen} onClose={onClose} size="lg">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>New SJ Style</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack spacing={4}>
              <HStack w="full" spacing={4}>
                <Box flex={1}>
                  <Text fontSize="sm" mb={1} fontWeight="semibold">
                    Style Code <Text as="span" color="red.400">*</Text>
                  </Text>
                  <Input
                    value={form.code}
                    onChange={(e) => setForm({ ...form, code: e.target.value })}
                    placeholder="e.g. SL8669"
                  />
                </Box>
                <Box flex={1}>
                  <Text fontSize="sm" mb={1} fontWeight="semibold">
                    Style Name <Text as="span" color="red.400">*</Text>
                  </Text>
                  <Input
                    value={form.style_name}
                    onChange={(e) => setForm({ ...form, style_name: e.target.value })}
                    placeholder="Style name"
                  />
                </Box>
              </HStack>

              <HStack w="full" spacing={4}>
                <Box flex={1}>
                  <Text fontSize="sm" mb={1} fontWeight="semibold">Buyer Style Code</Text>
                  <Input
                    value={form.buyer_style_code ?? ""}
                    onChange={(e) => setForm({ ...form, buyer_style_code: e.target.value })}
                    placeholder="optional"
                  />
                </Box>
                <Box flex={1}>
                  <Text fontSize="sm" mb={1} fontWeight="semibold">Internal Style Code</Text>
                  <Input
                    value={form.internal_style_code ?? ""}
                    onChange={(e) => setForm({ ...form, internal_style_code: e.target.value })}
                    placeholder="optional"
                  />
                </Box>
              </HStack>

              <Box w="full">
                <Text fontSize="sm" mb={1} fontWeight="semibold">Pattern Code</Text>
                <Input
                  value={form.pattern_code ?? ""}
                  onChange={(e) => setForm({ ...form, pattern_code: e.target.value })}
                  placeholder="optional"
                />
              </Box>

              <HStack w="full" spacing={4}>
                <Box flex={1}>
                  <Text fontSize="sm" mb={1} fontWeight="semibold">Category</Text>
                  <Select
                    placeholder="— select —"
                    value={form.bag_category ?? ""}
                    onChange={(e) => setForm({ ...form, bag_category: e.target.value ? Number(e.target.value) : null })}
                  >
                    {bagCategories.map((c) => (
                      <option key={c.pk} value={c.pk}>{c.name}{c.code ? ` (${c.code})` : ""}</option>
                    ))}
                  </Select>
                </Box>
                <Box flex={1}>
                  <Text fontSize="sm" mb={1} fontWeight="semibold">Body Material</Text>
                  <Select
                    placeholder="— select —"
                    value={form.body_material ?? ""}
                    onChange={(e) => setForm({ ...form, body_material: e.target.value ? Number(e.target.value) : null })}
                  >
                    {bodyMaterials.map((m) => (
                      <option key={m.pk} value={m.pk}>{m.name}{m.code ? ` (${m.code})` : ""}</option>
                    ))}
                  </Select>
                </Box>
              </HStack>

              <HStack w="full" spacing={4}>
                <Box flex={1}>
                  <Text fontSize="sm" mb={1} fontWeight="semibold">Buyer Brand</Text>
                  <Select
                    placeholder="— select —"
                    value={form.buyer_brand ?? ""}
                    onChange={(e) => setForm({ ...form, buyer_brand: e.target.value ? Number(e.target.value) : null })}
                  >
                    {buyerBrands.map((b) => (
                      <option key={b.pk} value={b.pk}>{b.name}{b.code ? ` (${b.code})` : ""}</option>
                    ))}
                  </Select>
                </Box>
                <Box flex={1}>
                  <Text fontSize="sm" mb={1} fontWeight="semibold">Bag Type</Text>
                  <Select
                    placeholder="— select —"
                    value={form.bag_type ?? ""}
                    onChange={(e) => setForm({ ...form, bag_type: e.target.value ? Number(e.target.value) : null })}
                  >
                    {bagTypes.map((t) => (
                      <option key={t.pk} value={t.pk}>{t.name}{t.code ? ` (${t.code})` : ""}</option>
                    ))}
                  </Select>
                </Box>
              </HStack>

              <Box w="full">
                <Text fontSize="sm" mb={1} fontWeight="semibold">Description</Text>
                <Textarea
                  value={form.description ?? ""}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="optional"
                  rows={3}
                />
              </Box>

              {/* 사진 업로드 */}
              <Box w="full">
                <Text fontSize="sm" mb={1} fontWeight="semibold">Photo (optional)</Text>
                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/*"
                  style={{ display: "none" }}
                  onChange={handlePhotoChange}
                />
                {photoPreview ? (
                  <HStack spacing={3} align="center">
                    <Image
                      src={photoPreview}
                      alt="preview"
                      boxSize="72px"
                      objectFit="cover"
                      borderRadius="md"
                    />
                    <Button
                      size="xs"
                      leftIcon={<FaTimes />}
                      variant="ghost"
                      colorScheme="red"
                      onClick={clearPhoto}
                    >
                      Remove
                    </Button>
                  </HStack>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => photoInputRef.current?.click()}
                  >
                    Select Photo
                  </Button>
                )}
              </Box>
            </VStack>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={onClose}>Cancel</Button>
            <Button
              colorScheme="blue"
              isDisabled={!form.code.trim() || !form.style_name.trim()}
              isLoading={isSubmitting}
              onClick={handleCreate}
            >
              Create
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
}
