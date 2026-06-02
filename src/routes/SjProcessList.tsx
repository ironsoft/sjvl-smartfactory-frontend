import {
  Box,
  Button,
  Center,
  FormControl,
  FormLabel,
  HStack,
  Heading,
  IconButton,
  Input,
  InputGroup,
  InputLeftElement,
  InputRightElement,
  Link,
  List,
  ListItem,
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
import { Link as RouterLink, useNavigate } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { FaChevronLeft, FaChevronRight, FaExternalLinkAlt, FaPlus, FaSearch, FaTimes, FaVideo } from "react-icons/fa";
import {
  getProcesses,
  createProcess,
  getModules,
  IProcessListResponse,
  IModuleListResponse,
} from "../api";

export default function SjProcessList() {
  const pageBg = useColorModeValue("gray.50", "gray.900");
  const tableBg = useColorModeValue("gray.50", "gray.800");
  const suggestionBg = useColorModeValue("white", "gray.700");
  const suggestionHoverBg = useColorModeValue("gray.100", "gray.600");
  const suggestionBorderColor = useColorModeValue("gray.200", "gray.600");

  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();

  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  // 입력 즉시 debounce 검색 (400ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchQuery(searchInput);
      setCurrentPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const { data, isLoading, isFetching } = useQuery<IProcessListResponse>({
    queryKey: ["processes", searchQuery, currentPage],
    queryFn: () => getProcesses({ search: searchQuery, page: currentPage }),
  });

  const processes = data?.results ?? [];
  const totalPages = data?.total_pages ?? 1;
  const totalResults = data?.total_results ?? 0;

  // ── Create 모달 ──────────────────────────────────────────────
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [form, setForm] = useState({
    code: "",
    name: "",
    name_ko: "",
    name_en: "",
    description: "",
    flow: "",
    standard_work_video_url: "",
    cycle_time: "",
  });
  const [isCreating, setIsCreating] = useState(false);

  // Module 검색 combobox
  const [moduleSearch, setModuleSearch] = useState("");
  const [selectedModule, setSelectedModule] = useState<{ pk: number; code: string; name: string } | null>(null);
  const [showModuleSuggestions, setShowModuleSuggestions] = useState(false);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: moduleSuggestions } = useQuery<IModuleListResponse>({
    queryKey: ["moduleSuggestions", moduleSearch],
    queryFn: () => getModules({ search: moduleSearch }),
    enabled: isOpen && moduleSearch.length > 0,
  });

  const handleCloseModal = () => {
    setForm({ code: "", name: "", name_ko: "", name_en: "", description: "", flow: "", standard_work_video_url: "", cycle_time: "" });
    setModuleSearch("");
    setSelectedModule(null);
    setShowModuleSuggestions(false);
    onClose();
  };

  const handleCreate = async () => {
    if (!form.code.trim()) {
      toast({ title: "Code is required", status: "warning", duration: 2000, position: "bottom-right" });
      return;
    }
    if (!selectedModule) {
      toast({ title: "Module is required", status: "warning", duration: 2000, position: "bottom-right" });
      return;
    }
    setIsCreating(true);
    try {
      const created = await createProcess({
        module: selectedModule.pk,
        code: form.code.trim(),
        name: form.name.trim() || undefined,
        name_ko: form.name_ko.trim() || undefined,
        name_en: form.name_en.trim() || undefined,
        description: form.description.trim() || undefined,
        flow: form.flow.trim() || undefined,
        standard_work_video_url: form.standard_work_video_url.trim() || undefined,
        cycle_time: form.cycle_time ? Number(form.cycle_time) : null,
      });
      toast({ title: "Process created", status: "success", duration: 2000, position: "bottom-right" });
      queryClient.invalidateQueries({ queryKey: ["processes"] });
      handleCloseModal();
      navigate(`/production-process/processes/${created.pk}`);
    } catch {
      toast({ title: "Create failed", status: "error", duration: 2000, position: "bottom-right" });
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <>
      <Helmet>
        <title>SJ Production Process — Processes</title>
      </Helmet>

      <Box
        bg={pageBg}
        minH="100%"
        px={{ base: 4, md: 8, lg: 12 }}
        py={{ base: 6, md: 8 }}
      >
        <Box w="full">
          {/* 헤딩 & 검색 */}
          <HStack justify="space-between" align="center" mb={5}>
            <Heading size="md">SJ Production Process — Processes</Heading>
            <Box w={{ base: "60%", lg: "30%" }}>
              <InputGroup>
                <InputLeftElement children={<FaSearch />} />
                <Input
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  borderColor="gray.300"
                  borderRadius="30"
                  type="text"
                  variant="outline"
                  placeholder="Search..."
                  aria-label="Search"
                />
                {searchInput && (
                  <InputRightElement>
                    <Button variant="unstyled" onClick={() => setSearchInput("")}>
                      <FaTimes />
                    </Button>
                  </InputRightElement>
                )}
              </InputGroup>
            </Box>
          </HStack>

          {/* 총 수 + New 버튼 */}
          <HStack justify="space-between" align="center" mb={4}>
            <HStack spacing={4} align="baseline">
              <Text fontSize="sm" color="gray.500">Total Processes</Text>
              <Text fontSize="xl" fontWeight="bold">{totalResults}</Text>
            </HStack>
            <Button size="sm" colorScheme="blue" leftIcon={<FaPlus />} onClick={onOpen}>
              New Process
            </Button>
          </HStack>

          {/* 테이블 */}
          <TableContainer>
            <Table variant="striped" size="sm">
              <Thead bgColor={tableBg}>
                <Tr>
                  <Th>#</Th>
                  <Th>Code</Th>
                  <Th>Name</Th>
                  <Th>Name (KO)</Th>
                  <Th>Module</Th>
                  <Th>SJ No</Th>
                  <Th isNumeric>Cycle Time (s)</Th>
                  <Th isNumeric>Target/h</Th>
                  <Th isNumeric>Target/8h</Th>
                  <Th>Video</Th>
                  <Th>Created</Th>
                </Tr>
              </Thead>
              <Tbody>
                {(isLoading || isFetching) && processes.length === 0 && (
                  <Tr>
                    <Td colSpan={11}><Center py={6}><Spinner size="md" /></Center></Td>
                  </Tr>
                )}
                {!isLoading && !isFetching && processes.length === 0 && (
                  <Tr>
                    <Td colSpan={11}>
                      <Text textAlign="center" color="gray.400">No processes found.</Text>
                    </Td>
                  </Tr>
                )}
                {processes.map((proc, idx) => {
                  const modulePk = typeof proc.module === "object" ? proc.module.pk : proc.module;
                  return (
                    <Tr key={proc.pk}>
                      <Td>{(currentPage - 1) * 30 + idx + 1}</Td>
                      <Td fontWeight="semibold" whiteSpace="nowrap">
                        <Link
                          as={RouterLink}
                          to={`/production-process/processes/${proc.pk}`}
                          color="blue.500"
                        >
                          {proc.code}
                        </Link>
                      </Td>
                      <Td whiteSpace="nowrap">
                        {proc.name || <Text as="span" color="gray.400">-</Text>}
                      </Td>
                      <Td whiteSpace="nowrap">
                        {proc.name_ko || <Text as="span" color="gray.400">-</Text>}
                      </Td>
                      <Td whiteSpace="nowrap">
                        {modulePk ? (
                          <Link
                            as={RouterLink}
                            to={`/production-process/modules/${modulePk}`}
                            color="blue.400"
                          >
                            {proc.module_code || String(modulePk)}
                          </Link>
                        ) : (
                          <Text as="span" color="gray.400">-</Text>
                        )}
                      </Td>
                      <Td whiteSpace="nowrap">
                        {proc.sj_no_pk ? (
                          <Link
                            as={RouterLink}
                            to={`/sjnos/${proc.sj_no_pk}`}
                            color="blue.400"
                          >
                            {proc.sj_no_value}
                          </Link>
                        ) : (
                          <Text as="span" color="gray.400">-</Text>
                        )}
                      </Td>
                      <Td isNumeric>
                        {proc.cycle_time ?? <Text as="span" color="gray.400">-</Text>}
                      </Td>
                      <Td isNumeric>
                        {proc.target_qty_per_hour != null
                          ? `${proc.target_qty_per_hour} pcs/h`
                          : <Text as="span" color="gray.400">-</Text>}
                      </Td>
                      <Td isNumeric>
                        {proc.daily_target_qty_8h != null
                          ? `${proc.daily_target_qty_8h} pcs`
                          : <Text as="span" color="gray.400">-</Text>}
                      </Td>
                      <Td>
                        {proc.standard_work_video_url ? (
                          <Link href={proc.standard_work_video_url} isExternal>
                            <HStack spacing={1} color="blue.400">
                              <FaVideo size={12} />
                              <FaExternalLinkAlt size={10} />
                            </HStack>
                          </Link>
                        ) : (
                          <Text color="gray.300">-</Text>
                        )}
                      </Td>
                      <Td whiteSpace="nowrap" color="gray.500">
                        {new Date(proc.created_at).toLocaleDateString("ko-KR")}
                      </Td>
                    </Tr>
                  );
                })}
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
                .filter((p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 2)
                .reduce<(number | "...")[]>((acc, p, idx, arr) => {
                  if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push("...");
                  acc.push(p);
                  return acc;
                }, [])
                .map((item, idx) =>
                  item === "..." ? (
                    <Text key={`e-${idx}`} px={2} color="gray.400">…</Text>
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

      {/* ── Create 모달 ── */}
      <Modal isOpen={isOpen} onClose={handleCloseModal} isCentered size="lg" scrollBehavior="inside">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>New Process</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack spacing={4} align="stretch">
              {/* Module combobox */}
              <FormControl isRequired>
                <FormLabel fontSize="sm">Module</FormLabel>
                <Box position="relative">
                  <Input
                    size="sm"
                    value={moduleSearch}
                    onChange={(e) => { setModuleSearch(e.target.value); setSelectedModule(null); }}
                    onFocus={() => setShowModuleSuggestions(true)}
                    onBlur={() => { blurTimer.current = setTimeout(() => setShowModuleSuggestions(false), 150); }}
                    placeholder="Search module code..."
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
              </FormControl>

              <FormControl isRequired>
                <FormLabel fontSize="sm">Code</FormLabel>
                <Input
                  size="sm"
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value })}
                  placeholder="Process code"
                />
              </FormControl>

              <FormControl>
                <FormLabel fontSize="sm">Name</FormLabel>
                <Input
                  size="sm"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Name (optional)"
                />
              </FormControl>

              <HStack spacing={3} align="flex-start">
                <FormControl>
                  <FormLabel fontSize="sm">Name (KO)</FormLabel>
                  <Input
                    size="sm"
                    value={form.name_ko}
                    onChange={(e) => setForm({ ...form, name_ko: e.target.value })}
                    placeholder="한국어 명칭 (optional)"
                  />
                </FormControl>
                <FormControl>
                  <FormLabel fontSize="sm">Name (EN)</FormLabel>
                  <Input
                    size="sm"
                    value={form.name_en}
                    onChange={(e) => setForm({ ...form, name_en: e.target.value })}
                    placeholder="English name (optional)"
                  />
                </FormControl>
              </HStack>

              <FormControl>
                <FormLabel fontSize="sm">Cycle Time (s)</FormLabel>
                <Input
                  size="sm"
                  type="number"
                  value={form.cycle_time}
                  onChange={(e) => setForm({ ...form, cycle_time: e.target.value })}
                  placeholder="Cycle time in seconds (optional)"
                />
              </FormControl>

              <FormControl>
                <FormLabel fontSize="sm">Standard Work Video URL</FormLabel>
                <Input
                  size="sm"
                  value={form.standard_work_video_url}
                  onChange={(e) => setForm({ ...form, standard_work_video_url: e.target.value })}
                  placeholder="https://... (optional)"
                />
              </FormControl>

              <FormControl>
                <FormLabel fontSize="sm">Flow</FormLabel>
                <Textarea
                  size="sm"
                  value={form.flow}
                  onChange={(e) => setForm({ ...form, flow: e.target.value })}
                  placeholder="Process flow memo (optional)"
                  rows={3}
                />
              </FormControl>

              <FormControl>
                <FormLabel fontSize="sm">Description</FormLabel>
                <Textarea
                  size="sm"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Description (optional)"
                  rows={3}
                />
              </FormControl>
            </VStack>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={handleCloseModal}>Cancel</Button>
            <Button
              colorScheme="blue"
              isLoading={isCreating}
              loadingText="Creating..."
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
