import {
  Box,
  Button,
  Center,
  FormControl,
  FormLabel,
  Grid,
  HStack,
  Heading,
  IconButton,
  Image,
  Input,
  InputGroup,
  InputLeftElement,
  InputRightElement,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Spinner,
  Table,
  TableContainer,
  Tbody,
  Td,
  Text,
  Textarea,
  Th,
  Thead,
  Tr,
  VStack,
  useColorModeValue,
  useDisclosure,
  useToast,
} from "@chakra-ui/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Helmet } from "react-helmet";
import { useNavigate } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import {
  FaCamera,
  FaChevronLeft,
  FaChevronRight,
  FaPlus,
  FaSearch,
  FaTimes,
  FaTrashAlt,
} from "react-icons/fa";
import {
  getMachines,
  createMachine,
  createMachinePhoto,
  getUploadURL,
  uploadImage,
  IMachineListResponse,
} from "../api";
import LocalizedDateInput from "../components/LocalizedDateInput";

export default function SjMachineList() {
  const pageBg = useColorModeValue("gray.50", "gray.900");
  const tableBg = useColorModeValue("gray.50", "gray.800");
  const rowHoverBg = useColorModeValue("blue.50", "gray.700");
  const suggestionBg = useColorModeValue("white", "gray.700");

  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();

  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchQuery(searchInput);
      setCurrentPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const { data, isLoading, isFetching } = useQuery<IMachineListResponse>({
    queryKey: ["machines", searchQuery, currentPage],
    queryFn: () => getMachines({ search: searchQuery, page: currentPage }),
  });

  const machines = data?.results ?? [];
  const totalPages = data?.total_pages ?? 1;
  const totalResults = data?.total_results ?? 0;

  // ── Create 모달 ──────────────────────────────────────────────
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [form, setForm] = useState({
    code: "", name: "", machine_type: "", category: "",
    manufacturer: "", supplier: "", model_number: "",
    serial_number: "", location: "", purchase_date: "", description: "",
  });
  const [isCreating, setIsCreating] = useState(false);

  // 사진 업로드 상태
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [pendingPreviews, setPendingPreviews] = useState<string[]>([]);
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

  const uploadOnePhoto = async (file: File, machinePk: number, machineName: string) => {
    const urlData = await getUploadURL();
    const dt = new DataTransfer();
    dt.items.add(file);
    const cfResult: any = await uploadImage({ file: dt.files, uploadURL: urlData.uploadURL });
    const cfUrl = `https://imagedelivery.net/mzmXhxWLR9jzdX8u9g4BBQ/${cfResult.result.id}/public`;
    await createMachinePhoto({ file: cfUrl, machinePk, description: machineName });
  };

  const handleCloseModal = () => {
    setForm({
      code: "", name: "", machine_type: "", category: "",
      manufacturer: "", supplier: "", model_number: "",
      serial_number: "", location: "", purchase_date: "", description: "",
    });
    pendingPreviews.forEach((url) => URL.revokeObjectURL(url));
    setPendingFiles([]);
    setPendingPreviews([]);
    onClose();
  };

  const handleCreate = async () => {
    if (!form.code.trim()) {
      toast({ title: "Code is required", status: "warning", duration: 2000, position: "bottom-right" });
      return;
    }
    if (!form.name.trim()) {
      toast({ title: "Name is required", status: "warning", duration: 2000, position: "bottom-right" });
      return;
    }
    setIsCreating(true);
    try {
      const created = await createMachine({
        code: form.code.trim(),
        name: form.name.trim(),
        machine_type: form.machine_type.trim() || undefined,
        category: form.category.trim() || undefined,
        manufacturer: form.manufacturer.trim() || undefined,
        supplier: form.supplier.trim() || undefined,
        model_number: form.model_number.trim() || undefined,
        serial_number: form.serial_number.trim() || undefined,
        location: form.location.trim() || undefined,
        purchase_date: form.purchase_date || null,
        description: form.description.trim() || undefined,
      });

      // 사진 업로드
      for (const file of pendingFiles) {
        await uploadOnePhoto(file, created.pk, created.name);
      }

      toast({ title: "Machine created", status: "success", duration: 2000, position: "bottom-right" });
      queryClient.invalidateQueries({ queryKey: ["machines"] });
      handleCloseModal();
      navigate(`/machines/${created.pk}`);
    } catch {
      toast({ title: "Create failed", status: "error", duration: 2000, position: "bottom-right" });
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <>
      <Helmet><title>SJ Machines</title></Helmet>

      <Box bg={pageBg} minH="100%" px={{ base: 4, md: 8, lg: 12 }} py={{ base: 6, md: 8 }}>
        <Box w="full">

          {/* 헤딩 & 검색 */}
          <HStack justify="space-between" align="center" mb={5}>
            <Heading size="md">SJ Machines</Heading>
            <Box w={{ base: "60%", lg: "30%" }}>
              <InputGroup>
                <InputLeftElement children={<FaSearch />} />
                <Input
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  borderColor="gray.300" borderRadius="30" variant="outline" placeholder="Search..."
                />
                {searchInput && (
                  <InputRightElement>
                    <Button variant="unstyled" onClick={() => setSearchInput("")}><FaTimes /></Button>
                  </InputRightElement>
                )}
              </InputGroup>
            </Box>
          </HStack>

          {/* 총 수 + New 버튼 */}
          <HStack justify="space-between" align="center" mb={4}>
            <HStack spacing={4} align="baseline">
              <Text fontSize="sm" color="gray.500">Total Machines</Text>
              <Text fontSize="xl" fontWeight="bold">{totalResults}</Text>
            </HStack>
            <Button size="sm" colorScheme="blue" leftIcon={<FaPlus />} onClick={onOpen}>
              New Machine
            </Button>
          </HStack>

          {/* 테이블 */}
          <TableContainer>
            <Table variant="striped" size="sm">
              <Thead bgColor={tableBg}>
                <Tr>
                  <Th>#</Th>
                  <Th>Photo</Th>
                  <Th>Code</Th>
                  <Th>Name</Th>
                  <Th>Type</Th>
                  <Th>Category</Th>
                  <Th>Manufacturer</Th>
                  <Th>Location</Th>
                  <Th>Purchase Date</Th>
                  <Th>Created</Th>
                </Tr>
              </Thead>
              <Tbody>
                {(isLoading || isFetching) && machines.length === 0 && (
                  <Tr><Td colSpan={10}><Center py={6}><Spinner size="md" /></Center></Td></Tr>
                )}
                {!isLoading && !isFetching && machines.length === 0 && (
                  <Tr><Td colSpan={10}><Text textAlign="center" color="gray.400">No machines found.</Text></Td></Tr>
                )}
                {machines.map((m, idx) => (
                  <Tr
                    key={m.pk}
                    cursor="pointer"
                    onClick={() => navigate(`/machines/${m.pk}`)}
                    _hover={{ bg: rowHoverBg }}
                  >
                    <Td>{(currentPage - 1) * 30 + idx + 1}</Td>
                    <Td>
                      {m.thumbnail ? (
                        <Image
                          src={m.thumbnail}
                          boxSize="48px"
                          objectFit="cover"
                          borderRadius="md"
                          border="1px solid"
                          borderColor="gray.200"
                        />
                      ) : (
                        <Box
                          boxSize="48px"
                          borderRadius="md"
                          border="1px dashed"
                          borderColor="gray.300"
                          display="flex"
                          alignItems="center"
                          justifyContent="center"
                        >
                          <FaCamera color="gray" size={14} />
                        </Box>
                      )}
                    </Td>
                    <Td fontWeight="semibold" whiteSpace="nowrap" color="blue.500">{m.code}</Td>
                    <Td whiteSpace="nowrap">{m.name}</Td>
                    <Td whiteSpace="nowrap">{m.machine_type || <Text as="span" color="gray.400">-</Text>}</Td>
                    <Td whiteSpace="nowrap">{m.category || <Text as="span" color="gray.400">-</Text>}</Td>
                    <Td whiteSpace="nowrap">{m.manufacturer || <Text as="span" color="gray.400">-</Text>}</Td>
                    <Td whiteSpace="nowrap">{m.location || <Text as="span" color="gray.400">-</Text>}</Td>
                    <Td whiteSpace="nowrap">{m.purchase_date || <Text as="span" color="gray.400">-</Text>}</Td>
                    <Td whiteSpace="nowrap" color="gray.500">
                      {new Date(m.created_at).toLocaleDateString("ko-KR")}
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </TableContainer>

          {/* 페이지네이션 */}
          {totalPages > 1 && (
            <HStack justify="center" mt={6} spacing={1}>
              <IconButton aria-label="First" icon={<FaChevronLeft />} size="sm" variant="ghost"
                isDisabled={currentPage <= 1 || isFetching} onClick={() => setCurrentPage(1)} />
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter((p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 2)
                .reduce<(number | "...")[]>((acc, p, idx, arr) => {
                  if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push("...");
                  acc.push(p); return acc;
                }, [])
                .map((item, idx) =>
                  item === "..." ? (
                    <Text key={`e-${idx}`} px={2} color="gray.400">…</Text>
                  ) : (
                    <Button key={item} size="sm"
                      variant={currentPage === item ? "solid" : "ghost"}
                      colorScheme={currentPage === item ? "blue" : "gray"}
                      isDisabled={isFetching} onClick={() => setCurrentPage(item as number)} minW="32px">
                      {item}
                    </Button>
                  )
                )}
              <IconButton aria-label="Last" icon={<FaChevronRight />} size="sm" variant="ghost"
                isDisabled={currentPage >= totalPages || isFetching} onClick={() => setCurrentPage(totalPages)} />
            </HStack>
          )}
        </Box>
      </Box>

      {/* ── Create 모달 ── */}
      <Modal isOpen={isOpen} onClose={handleCloseModal} isCentered size="lg" scrollBehavior="inside">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>New Machine</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack spacing={4} align="stretch">
              <HStack spacing={3}>
                <FormControl isRequired>
                  <FormLabel fontSize="sm">Code</FormLabel>
                  <Input size="sm" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="Machine code" />
                </FormControl>
                <FormControl isRequired>
                  <FormLabel fontSize="sm">Name</FormLabel>
                  <Input size="sm" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Machine name" />
                </FormControl>
              </HStack>
              <HStack spacing={3}>
                <FormControl>
                  <FormLabel fontSize="sm">Type</FormLabel>
                  <Input size="sm" value={form.machine_type} onChange={(e) => setForm({ ...form, machine_type: e.target.value })} placeholder="e.g. Sewing, Press…" />
                </FormControl>
                <FormControl>
                  <FormLabel fontSize="sm">Category</FormLabel>
                  <Input size="sm" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="e.g. Automatic…" />
                </FormControl>
              </HStack>
              <HStack spacing={3}>
                <FormControl>
                  <FormLabel fontSize="sm">Model No.</FormLabel>
                  <Input size="sm" value={form.model_number} onChange={(e) => setForm({ ...form, model_number: e.target.value })} placeholder="Model number" />
                </FormControl>
                <FormControl>
                  <FormLabel fontSize="sm">Serial No.</FormLabel>
                  <Input size="sm" value={form.serial_number} onChange={(e) => setForm({ ...form, serial_number: e.target.value })} placeholder="Serial number" />
                </FormControl>
              </HStack>
              <HStack spacing={3}>
                <FormControl>
                  <FormLabel fontSize="sm">Manufacturer</FormLabel>
                  <Input size="sm" value={form.manufacturer} onChange={(e) => setForm({ ...form, manufacturer: e.target.value })} placeholder="Manufacturer" />
                </FormControl>
                <FormControl>
                  <FormLabel fontSize="sm">Supplier</FormLabel>
                  <Input size="sm" value={form.supplier} onChange={(e) => setForm({ ...form, supplier: e.target.value })} placeholder="Supplier" />
                </FormControl>
              </HStack>
              <HStack spacing={3}>
                <FormControl>
                  <FormLabel fontSize="sm">Location</FormLabel>
                  <Input size="sm" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Installation location" />
                </FormControl>
                <FormControl>
                  <FormLabel fontSize="sm">Purchase Date</FormLabel>
                  <LocalizedDateInput
                    size="sm"
                    value={form.purchase_date}
                    onChange={(v) => setForm({ ...form, purchase_date: v })}
                  />
                </FormControl>
              </HStack>
              <FormControl>
                <FormLabel fontSize="sm">Description</FormLabel>
                <Textarea size="sm" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Notes (optional)" rows={2} />
              </FormControl>

              {/* 사진 업로드 */}
              <FormControl>
                <FormLabel fontSize="sm">Photos (optional)</FormLabel>
                <Button
                  size="sm" variant="outline" leftIcon={<FaCamera />}
                  onClick={() => photoInputRef.current?.click()}
                >
                  Select Photos
                </Button>
                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  style={{ display: "none" }}
                  onChange={handlePhotoSelect}
                />
                {pendingPreviews.length > 0 && (
                  <Grid templateColumns="repeat(auto-fill, minmax(80px, 1fr))" gap={2} mt={2}>
                    {pendingPreviews.map((src, idx) => (
                      <Box key={idx} position="relative" borderRadius="md" overflow="hidden"
                        border="2px dashed" borderColor="blue.300">
                        <Image src={src} w="full" h="70px" objectFit="cover" />
                        <Button
                          size="xs" colorScheme="red" position="absolute" top={0.5} right={0.5}
                          onClick={() => removePending(idx)}
                          minW="auto" px={1}
                        >
                          <FaTrashAlt size={10} />
                        </Button>
                      </Box>
                    ))}
                  </Grid>
                )}
              </FormControl>
            </VStack>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={handleCloseModal}>Cancel</Button>
            <Button
              colorScheme="blue"
              isLoading={isCreating}
              loadingText={pendingFiles.length > 0 ? "Uploading…" : "Creating…"}
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
