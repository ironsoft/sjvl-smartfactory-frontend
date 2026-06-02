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
  List,
  ListItem,
  useToast
} from "@chakra-ui/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Helmet } from "react-helmet";
import {
  getSjNos,
  getSjStyles,
  getSjStylePhotos,
  createSjNo,
  ISjNoListResponse,
  ISjStyleListResponse,
  ISjStyle,
  IFilePhotos
} from "../api";
import SearchInput from "../components/SearchInput";
import { Link as RouterLink } from "react-router-dom";
import { FaChevronLeft, FaChevronRight, FaPlus } from "react-icons/fa";
import { useState, useRef } from "react";

function SjStylePhotoCell({
  stylePk,
  onPhotoClick
}: {
  stylePk: number;
  onPhotoClick: (src: string) => void;
}) {
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
        <Image
          src={photos[0].file}
          alt="style photo"
          boxSize="44px"
          objectFit="cover"
          borderRadius="md"
          cursor="zoom-in"
          _hover={{
            opacity: 0.8,
            transform: "scale(1.05)",
            transition: "all 0.2s"
          }}
          onClick={() => onPhotoClick(photos[0].file)}
        />
      ) : (
        <Box boxSize="44px" />
      )}
    </Box>
  );
}

export default function SjNoList() {
  const tableBgColor = useColorModeValue("gray.50", "gray.800");
  const pageBg = useColorModeValue("gray.50", "gray.900");
  const suggestionBg = useColorModeValue("white", "gray.700");
  const suggestionHoverBg = useColorModeValue("blue.50", "gray.600");
  const borderColor = useColorModeValue("gray.200", "gray.600");

  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const toast = useToast();
  const queryClient = useQueryClient();
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [zoomSrc, setZoomSrc] = useState<string | null>(null);

  // ── 생성 모달 상태 ──
  const [styleSearch, setStyleSearch] = useState("");
  const [selectedStyle, setSelectedStyle] = useState<ISjStyle | null>(null);
  const [sjNoInput, setSjNoInput] = useState("");
  const [styleNameInput, setStyleNameInput] = useState("");
  const [memoInput, setMemoInput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const blurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: styleSearchData } = useQuery<ISjStyleListResponse>({
    queryKey: ["sjStyleSearch", styleSearch],
    queryFn: () => getSjStyles({ search: styleSearch, page: 1 }),
    enabled: styleSearch.length > 0 && !selectedStyle
  });
  const styleSuggestions: ISjStyle[] = styleSearchData?.results ?? [];

  const resetModal = () => {
    setStyleSearch("");
    setSelectedStyle(null);
    setSjNoInput("");
    setStyleNameInput("");
    setMemoInput("");
    setShowSuggestions(false);
  };

  const handleSelectStyle = (style: ISjStyle) => {
    setSelectedStyle(style);
    setStyleSearch(style.code);
    setShowSuggestions(false);
  };

  const handleCreate = async () => {
    if (!selectedStyle || !sjNoInput.trim()) return;
    setIsSubmitting(true);
    try {
      await createSjNo(selectedStyle.pk, {
        sj_no: sjNoInput.trim(),
        style_name: styleNameInput.trim(),
        memo: memoInput.trim()
      });
      toast({
        title: "SJ No created",
        status: "success",
        duration: 2000,
        position: "bottom-right"
      });
      queryClient.invalidateQueries({ queryKey: ["sjnos"] });
      resetModal();
      onClose();
    } catch {
      toast({
        title: "Failed to create",
        status: "error",
        duration: 2000,
        position: "bottom-right"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleModalClose = () => {
    resetModal();
    onClose();
  };

  // ── 리스트 데이터 ──
  const { data, isLoading, isFetching, error } = useQuery<ISjNoListResponse>({
    queryKey: ["sjnos", searchQuery, currentPage],
    queryFn: () => getSjNos({ search: searchQuery, page: currentPage })
  });

  const totalPages = data?.total_pages ?? 1;
  const totalResults = data?.total_results ?? 0;
  const sjNos = data?.results ?? [];

  const errorMessage = error
    ? error instanceof Error
      ? error.message
      : "데이터를 불러오는 중 오류가 발생했습니다."
    : null;

  return (
    <>
      <Helmet>
        <title>SJ No List</title>
      </Helmet>

      <Box
        bg={pageBg}
        minW="100%"
        minH="100%"
        px={{ base: "4", md: "8", lg: "12" }}
        py={{ base: "6", md: "8", lg: "8" }}
      >
        <Box w="full">
          {/* 헤딩 & 검색 */}
          <HStack justify="space-between" align="center" mb={5}>
            <Heading size="md">SJ No List</Heading>
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
            <StatLabel>Total SJ No Count</StatLabel>
            <StatNumber>{totalResults}</StatNumber>
          </Stat>

          {/* 테이블 상단 + 버튼 */}
          <HStack justify="flex-end" mb={2}>
            <IconButton
              aria-label="Add SJ No"
              icon={<FaPlus />}
              size="sm"
              colorScheme="blue"
              variant="ghost"
              onClick={onOpen}
            />
          </HStack>

          {/* 테이블 */}
          <TableContainer>
            <Table variant="striped" size="sm">
              <Thead bgColor={tableBgColor}>
                <Tr>
                  <Th>SJ No</Th>
                  <Th>SJ Style Name</Th>
                  <Th>Photo</Th>
                  <Th>Style Code</Th>
                  <Th>Category</Th>
                  <Th>Brand</Th>
                  <Th>Material</Th>
                  <Th>Bag Type</Th>
                  <Th isNumeric>Modules</Th>
                  <Th>Memo</Th>
                  <Th>Created</Th>
                </Tr>
              </Thead>
              <Tbody>
                {(isLoading || isFetching) && sjNos.length === 0 && (
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
                  sjNos.length === 0 && (
                    <Tr>
                      <Td colSpan={11}>
                        <Text color="gray.400" textAlign="center">
                          No results found.
                        </Text>
                      </Td>
                    </Tr>
                  )}
                {sjNos.map((item) => (
                  <Tr key={item.pk}>
                    <Td fontWeight="semibold" whiteSpace="nowrap">
                      <Link
                        as={RouterLink}
                        to={`/sjnos/${item.pk}`}
                        color="blue.500"
                      >
                        {item.sj_no}
                      </Link>
                    </Td>
                    <Td whiteSpace="nowrap">
                      {item.style_name ? (
                        <Text fontWeight="medium">{item.style_name}</Text>
                      ) : (
                        <Text color="gray.400">-</Text>
                      )}
                    </Td>
                    <Td>
                      <SjStylePhotoCell
                        stylePk={item.sj_style}
                        onPhotoClick={setZoomSrc}
                      />
                    </Td>
                    <Td>
                      {item.sj_style_code ? (
                        <Link
                          as={RouterLink}
                          to={`/sjstyles/${item.sj_style}`}
                          color="blue.500"
                          fontWeight="semibold"
                        >
                          {item.sj_style_code}
                        </Link>
                      ) : (
                        <Text color="gray.400">-</Text>
                      )}
                    </Td>
                    <Td>
                      {item.sj_bag_category ? (
                        <Badge colorScheme="purple" whiteSpace="nowrap">
                          {item.sj_bag_category.name}
                        </Badge>
                      ) : (
                        <Text color="gray.400">-</Text>
                      )}
                    </Td>
                    <Td>
                      {item.sj_buyer_brand ? (
                        <Badge colorScheme="blue" whiteSpace="nowrap">
                          {item.sj_buyer_brand.name}
                        </Badge>
                      ) : (
                        <Text color="gray.400">-</Text>
                      )}
                    </Td>
                    <Td>
                      {item.sj_body_material ? (
                        <Badge colorScheme="green" whiteSpace="nowrap">
                          {item.sj_body_material.name}
                        </Badge>
                      ) : (
                        <Text color="gray.400">-</Text>
                      )}
                    </Td>
                    <Td>
                      {item.sj_bag_type ? (
                        <Badge colorScheme="orange" whiteSpace="nowrap">
                          {item.sj_bag_type.name}
                        </Badge>
                      ) : (
                        <Text color="gray.400">-</Text>
                      )}
                    </Td>
                    <Td isNumeric>{item.module_count ?? 0}</Td>
                    <Td maxW="200px">
                      {item.memo ? (
                        <Text noOfLines={2} fontSize="sm">
                          {item.memo}
                        </Text>
                      ) : (
                        <Text color="gray.400">-</Text>
                      )}
                    </Td>
                    <Td fontSize="xs" color="gray.500" whiteSpace="nowrap">
                      {new Date(item.created_at).toLocaleDateString()}
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

      {/* ── 사진 확대 모달 ── */}
      <Modal
        isOpen={!!zoomSrc}
        onClose={() => setZoomSrc(null)}
        size="xl"
        isCentered
      >
        <ModalOverlay bg="blackAlpha.900" />
        <ModalContent bg="transparent" boxShadow="none">
          <ModalCloseButton color="white" zIndex={10} />
          <ModalBody
            p={0}
            display="flex"
            justifyContent="center"
            alignItems="center"
          >
            {zoomSrc && (
              <Image
                src={zoomSrc}
                alt="style photo"
                maxH="85vh"
                maxW="90vw"
                objectFit="contain"
                borderRadius="lg"
              />
            )}
          </ModalBody>
        </ModalContent>
      </Modal>

      {/* ── SJ No 생성 모달 ── */}
      <Modal isOpen={isOpen} onClose={handleModalClose} size="md">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>New SJ No</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack spacing={4}>
              {/* Style 검색 */}
              <Box w="full">
                <Text fontSize="sm" mb={1} fontWeight="semibold">
                  SJ Style{" "}
                  <Text as="span" color="red.400">
                    *
                  </Text>
                </Text>
                <Box position="relative">
                  <Input
                    placeholder="Style Code 검색..."
                    value={styleSearch}
                    onChange={(e) => {
                      setStyleSearch(e.target.value);
                      setSelectedStyle(null);
                      setShowSuggestions(true);
                    }}
                    onFocus={() => {
                      if (styleSearch && !selectedStyle)
                        setShowSuggestions(true);
                    }}
                    onBlur={() => {
                      blurTimerRef.current = setTimeout(
                        () => setShowSuggestions(false),
                        150
                      );
                    }}
                  />
                  {showSuggestions && styleSuggestions.length > 0 && (
                    <List
                      position="absolute"
                      zIndex={10}
                      w="full"
                      bg={suggestionBg}
                      border="1px solid"
                      borderColor={borderColor}
                      borderRadius="md"
                      boxShadow="md"
                      maxH="200px"
                      overflowY="auto"
                      mt={1}
                    >
                      {styleSuggestions.map((s) => (
                        <ListItem
                          key={s.pk}
                          px={3}
                          py={2}
                          cursor="pointer"
                          _hover={{ bg: suggestionHoverBg }}
                          onMouseDown={() => {
                            if (blurTimerRef.current)
                              clearTimeout(blurTimerRef.current);
                            handleSelectStyle(s);
                          }}
                        >
                          <Text fontSize="sm" fontWeight="semibold">
                            {s.code}
                          </Text>
                          {s.style_name && (
                            <Text fontSize="xs" color="gray.500">
                              {s.style_name}
                            </Text>
                          )}
                        </ListItem>
                      ))}
                    </List>
                  )}
                </Box>
                {selectedStyle && (
                  <Text fontSize="xs" color="blue.500" mt={1}>
                    선택됨: {selectedStyle.code} — {selectedStyle.style_name}
                  </Text>
                )}
              </Box>

              {/* SJ No */}
              <Box w="full">
                <Text fontSize="sm" mb={1} fontWeight="semibold">
                  SJ No{" "}
                  <Text as="span" color="red.400">
                    *
                  </Text>
                </Text>
                <Input
                  placeholder="e.g. SL8669-F26-2-M"
                  value={sjNoInput}
                  onChange={(e) => setSjNoInput(e.target.value)}
                />
              </Box>

              {/* SJ Style Name */}
              <Box w="full">
                <Text fontSize="sm" mb={1} fontWeight="semibold">
                  SJ Style Name
                </Text>
                <Input
                  placeholder="optional"
                  value={styleNameInput}
                  onChange={(e) => setStyleNameInput(e.target.value)}
                />
              </Box>

              {/* Memo */}
              <Box w="full">
                <Text fontSize="sm" mb={1} fontWeight="semibold">
                  Memo
                </Text>
                <Textarea
                  placeholder="optional"
                  value={memoInput}
                  onChange={(e) => setMemoInput(e.target.value)}
                  rows={3}
                />
              </Box>
            </VStack>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={handleModalClose}>
              Cancel
            </Button>
            <Button
              colorScheme="blue"
              isDisabled={!selectedStyle || !sjNoInput.trim()}
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
