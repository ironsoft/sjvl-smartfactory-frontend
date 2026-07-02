import {
  Box,
  Button,
  Center,
  FormControl,
  FormLabel,
  HStack,
  Heading,
  IconButton,
  Image,
  Input,
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
  Th,
  Thead,
  Tr,
  VStack,
  useColorModeValue,
  useDisclosure,
  useToast,
  Select,
  Stack,
  RadioGroup,
  Radio,
} from "@chakra-ui/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Helmet } from "react-helmet";
import { Link as RouterLink, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useRef, useState, useMemo, useEffect } from "react";
import { FaCamera, FaChevronLeft, FaChevronRight, FaPlus } from "react-icons/fa";
import {
  getModules,
  getModuleCategories,
  createModule,
  getSjNos,
  IModuleListResponse,
  ISjNoListResponse,
  IModuleCategory,
} from "../api";
import SearchInput from "../components/SearchInput";
import { displayModuleCategoryName } from "../lib/moduleCategoryDisplay";

export default function SjModuleList() {
  const { i18n } = useTranslation();
  const pageBg = useColorModeValue("gray.50", "gray.900");
  const tableBg = useColorModeValue("gray.50", "gray.800");
  const suggestionBg = useColorModeValue("white", "gray.700");
  const suggestionHoverBg = useColorModeValue("gray.100", "gray.600");
  const suggestionBorderColor = useColorModeValue("gray.200", "gray.600");

  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();

  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  const { data, isLoading, isFetching } = useQuery<IModuleListResponse>({
    queryKey: ["modules", searchQuery, currentPage],
    queryFn: () => getModules({ search: searchQuery, page: currentPage }),
  });

  const modules = data?.results ?? [];
  const totalPages = data?.total_pages ?? 1;
  const totalResults = data?.total_results ?? 0;

  // ── Create 모달 ────────────────────────────────────────────
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [newCode, setNewCode] = useState("");
  const [newName, setNewName] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  // SJ No 검색 combobox
  const [sjNoSearch, setSjNoSearch] = useState("");
  const [selectedSjNo, setSelectedSjNo] = useState<{ pk: number; sj_no: string } | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: sjNoSuggestions } = useQuery<ISjNoListResponse>({
    queryKey: ["sjNoSuggestions", sjNoSearch],
    queryFn: () => getSjNos({ search: sjNoSearch }),
    enabled: isOpen && sjNoSearch.length > 0,
  });

  const { data: allModuleCategories } = useQuery({
    queryKey: ["moduleCategories"],
    queryFn: () => getModuleCategories(),
    enabled: isOpen,
  });

  const categoryRoots = useMemo(
    () =>
      (allModuleCategories ?? [])
        .filter((c: IModuleCategory) => c.parent === null)
        .sort((a, b) => a.sort_order - b.sort_order),
    [allModuleCategories]
  );

  const [topCategoryPk, setTopCategoryPk] = useState<number | "">("");
  const [leafCategoryPk, setLeafCategoryPk] = useState<number | "">("");
  const [prepAppliesTo, setPrepAppliesTo] = useState<"general" | "handbag">("general");

  const selectedTop = useMemo(
    () => categoryRoots.find((r) => r.pk === topCategoryPk),
    [categoryRoots, topCategoryPk]
  );

  const { data: childCategories } = useQuery({
    queryKey: ["moduleCategories", "children", topCategoryPk, prepAppliesTo],
    queryFn: () => {
      if (!topCategoryPk) return Promise.resolve([] as IModuleCategory[]);
      if (selectedTop?.slug === "preparation") {
        return getModuleCategories({
          parent: topCategoryPk,
          applies_to: prepAppliesTo,
        });
      }
      return getModuleCategories({ parent: topCategoryPk });
    },
    enabled: isOpen && !!topCategoryPk,
  });

  useEffect(() => {
    setLeafCategoryPk("");
  }, [topCategoryPk, prepAppliesTo]);

  /** 모달 열 때 카테고리 비우기 — 사용자가 명시적으로 선택 */
  useEffect(() => {
    if (!isOpen) return;
    setTopCategoryPk("");
    setPrepAppliesTo("general");
    setLeafCategoryPk("");
  }, [isOpen]);

  const handleCloseModal = () => {
    setNewCode("");
    setNewName("");
    setSjNoSearch("");
    setSelectedSjNo(null);
    setShowSuggestions(false);
    setTopCategoryPk("");
    setLeafCategoryPk("");
    setPrepAppliesTo("general");
    onClose();
  };

  const handleCreate = async () => {
    if (!newCode.trim()) {
      toast({ title: "Code is required", status: "warning", duration: 2000, position: "bottom-right" });
      return;
    }
    if (!topCategoryPk) {
      toast({ title: "대분류를 선택하세요", status: "warning", duration: 2000, position: "bottom-right" });
      return;
    }
    const subs = childCategories ?? [];
    const finalCategoryPk =
      subs.length === 0 ? topCategoryPk : leafCategoryPk;
    if (!finalCategoryPk) {
      toast({
        title: subs.length ? "소분류를 선택하세요" : "분류를 확인할 수 없습니다",
        status: "warning",
        duration: 2500,
        position: "bottom-right",
      });
      return;
    }
    setIsCreating(true);
    try {
      const created = await createModule({
        code: newCode.trim(),
        name: newName.trim() || undefined,
        sj_no: selectedSjNo?.pk ?? null,
        module_category: Number(finalCategoryPk),
      });
      toast({ title: "Module created", status: "success", duration: 2000, position: "bottom-right" });
      queryClient.invalidateQueries({ queryKey: ["modules"] });
      handleCloseModal();
      navigate(`/production-process/modules/${created.pk}`);
    } catch {
      toast({ title: "Create failed", status: "error", duration: 2000, position: "bottom-right" });
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <>
      <Helmet>
        <title>SJ Production Process — Modules</title>
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
            <Heading size="md">SJ Production Process — Modules</Heading>
            <SearchInput
              onSearch={(q) => { setSearchQuery(q); setCurrentPage(1); }}
              onInputChange={(v) => { if (v === "") { setSearchQuery(""); setCurrentPage(1); } }}
            />
          </HStack>

          {/* 총 수 + New 버튼 */}
          <HStack justify="space-between" align="center" mb={4}>
            <HStack spacing={4} align="baseline">
              <Text fontSize="sm" color="gray.500">Total Modules</Text>
              <Text fontSize="xl" fontWeight="bold">{totalResults}</Text>
            </HStack>
            <Button size="sm" colorScheme="blue" leftIcon={<FaPlus />} onClick={onOpen}>
              New Module
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
                  <Th>SJ No</Th>
                  <Th isNumeric>Processes</Th>
                  <Th>Created</Th>
                </Tr>
              </Thead>
              <Tbody>
                {(isLoading || isFetching) && modules.length === 0 && (
                  <Tr>
                    <Td colSpan={7}><Center py={6}><Spinner size="md" /></Center></Td>
                  </Tr>
                )}
                {!isLoading && !isFetching && modules.length === 0 && (
                  <Tr>
                    <Td colSpan={7}>
                      <Text textAlign="center" color="gray.400">No modules found.</Text>
                    </Td>
                  </Tr>
                )}
                {modules.map((module, idx) => (
                  <Tr key={module.pk}>
                    <Td>{(currentPage - 1) * 30 + idx + 1}</Td>
                    <Td>
                      {module.thumbnail ? (
                        <Image
                          src={module.thumbnail}
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
                    <Td fontWeight="semibold" whiteSpace="nowrap">
                      <Link
                        as={RouterLink}
                        to={`/production-process/modules/${module.pk}`}
                        color="blue.500"
                      >
                        {module.code}
                      </Link>
                    </Td>
                    <Td whiteSpace="nowrap">
                      {module.name || <Text as="span" color="gray.400">-</Text>}
                    </Td>
                    <Td whiteSpace="nowrap">
                      {module.sj_no_pk ? (
                        <Link
                          as={RouterLink}
                          to={`/sjnos/${module.sj_no_pk}`}
                          color="blue.400"
                        >
                          {module.sj_no_value}
                        </Link>
                      ) : (
                        <Text as="span" color="gray.400">-</Text>
                      )}
                    </Td>
                    <Td isNumeric>{module.process_count ?? 0}</Td>
                    <Td whiteSpace="nowrap" color="gray.500">
                      {new Date(module.created_at).toLocaleDateString("ko-KR")}
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
      <Modal isOpen={isOpen} onClose={handleCloseModal} isCentered size="lg">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>New Module</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack spacing={4} align="stretch">
              <FormControl isRequired>
                <FormLabel fontSize="sm">대분류</FormLabel>
                <Select
                  size="sm"
                  placeholder="Select category"
                  value={topCategoryPk === "" ? "" : String(topCategoryPk)}
                  onChange={(e) =>
                    setTopCategoryPk(e.target.value ? Number(e.target.value) : "")
                  }
                >
                      {categoryRoots.map((r) => (
                        <option key={r.pk} value={String(r.pk)}>
                          {displayModuleCategoryName(r, i18n.language)}
                        </option>
                      ))}
                </Select>
              </FormControl>

              {selectedTop?.slug === "preparation" && (
                <FormControl>
                  <FormLabel fontSize="sm">Preparation — bag line</FormLabel>
                  <RadioGroup
                    value={prepAppliesTo}
                    onChange={(v) => setPrepAppliesTo(v as "general" | "handbag")}
                  >
                    <Stack direction="row" spacing={4}>
                      <Radio value="general">General bag</Radio>
                      <Radio value="handbag">Handbag</Radio>
                    </Stack>
                  </RadioGroup>
                </FormControl>
              )}

              {(childCategories?.length ?? 0) > 0 && (
                <FormControl isRequired>
                  <FormLabel fontSize="sm">소분류</FormLabel>
                  <Select
                    size="sm"
                    placeholder="Select sub-category"
                    value={leafCategoryPk === "" ? "" : String(leafCategoryPk)}
                    onChange={(e) =>
                      setLeafCategoryPk(e.target.value ? Number(e.target.value) : "")
                    }
                  >
                        {(childCategories ?? []).map((c) => (
                          <option key={c.pk} value={String(c.pk)}>
                            {displayModuleCategoryName(c, i18n.language)}
                          </option>
                        ))}
                  </Select>
                </FormControl>
              )}

              <FormControl isRequired>
                <FormLabel fontSize="sm">Code</FormLabel>
                <Input
                  size="sm"
                  value={newCode}
                  onChange={(e) => setNewCode(e.target.value)}
                  placeholder="Module code"
                />
              </FormControl>

              <FormControl>
                <FormLabel fontSize="sm">Name</FormLabel>
                <Input
                  size="sm"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Module name (optional)"
                />
              </FormControl>

              <FormControl>
                <FormLabel fontSize="sm">SJ No</FormLabel>
                <Box position="relative">
                  <Input
                    size="sm"
                    value={sjNoSearch}
                    onChange={(e) => {
                      setSjNoSearch(e.target.value);
                      setSelectedSjNo(null);
                    }}
                    onFocus={() => setShowSuggestions(true)}
                    onBlur={() => {
                      blurTimer.current = setTimeout(() => setShowSuggestions(false), 150);
                    }}
                    placeholder="Search SJ No..."
                  />
                  {selectedSjNo && (
                    <Text fontSize="xs" color="blue.400" mt={1}>
                      Selected: {selectedSjNo.sj_no}
                    </Text>
                  )}
                  {showSuggestions && sjNoSuggestions && sjNoSuggestions.results.length > 0 && (
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
                      {sjNoSuggestions.results.map((n) => (
                        <ListItem
                          key={n.pk}
                          px={3}
                          py={2}
                          cursor="pointer"
                          fontSize="sm"
                          _hover={{ bg: suggestionHoverBg }}
                          onMouseDown={() => {
                            if (blurTimer.current) clearTimeout(blurTimer.current);
                            setSelectedSjNo({ pk: n.pk, sj_no: n.sj_no });
                            setSjNoSearch(n.sj_no);
                            setShowSuggestions(false);
                          }}
                        >
                          {n.sj_no}
                        </ListItem>
                      ))}
                    </List>
                  )}
                </Box>
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
