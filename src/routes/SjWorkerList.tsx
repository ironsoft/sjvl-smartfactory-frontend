import {
  Box,
  Heading,
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
  Avatar,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalCloseButton,
  ModalBody,
  ModalFooter,
  Input,
  FormControl,
  FormLabel,
  VStack,
  Image,
  useDisclosure,
  useToast,
} from "@chakra-ui/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Helmet } from "react-helmet";
import { getWorkers, createWorker, getUploadURL, uploadImage, IWorkerListResponse } from "../api";
import SearchInput from "../components/SearchInput";
import { Link as RouterLink, useNavigate } from "react-router-dom";
import { FaChevronLeft, FaChevronRight, FaPlus } from "react-icons/fa";
import { useRef, useState } from "react";

export default function SjWorkerList() {
  const tableBgColor = useColorModeValue("gray.50", "gray.800");
  const pageBg = useColorModeValue("gray.50", "gray.900");
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();

  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  const { data, isLoading, isFetching, error } = useQuery<IWorkerListResponse>({
    queryKey: ["workers", searchQuery, currentPage],
    queryFn: () => getWorkers({ search: searchQuery, page: currentPage }),
  });

  const totalPages = data?.total_pages ?? 1;
  const totalResults = data?.total_results ?? 0;
  const workers = data?.results ?? [];

  const errorMessage = error
    ? error instanceof Error ? error.message : "데이터를 불러오는 중 오류가 발생했습니다."
    : null;

  const resignedColor = (val: string | null) =>
    val === "resigned" ? "red" : "green";

  // ── 생성 모달 ──
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [newName, setNewName] = useState("");
  const [newCompanyId, setNewCompanyId] = useState("");
  const [newNickName, setNewNickName] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const handleCloseModal = () => {
    setNewName("");
    setNewCompanyId("");
    setNewNickName("");
    setPhotoFile(null);
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoPreview(null);
    if (photoInputRef.current) photoInputRef.current.value = "";
    onClose();
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const handleCreate = async () => {
    if (!newName.trim()) {
      toast({ title: "Name is required", status: "warning", duration: 2000, position: "bottom-right" });
      return;
    }
    setIsCreating(true);
    try {
      let avatarUrl: string | undefined;
      if (photoFile) {
        const urlData = await getUploadURL();
        const dt = new DataTransfer();
        dt.items.add(photoFile);
        const cfResult: any = await uploadImage({ file: dt.files, uploadURL: urlData.uploadURL });
        avatarUrl = `https://imagedelivery.net/mzmXhxWLR9jzdX8u9g4BBQ/${cfResult.result.id}/public`;
      }
      const created = await createWorker({
        name: newName.trim(),
        company_id: newCompanyId.trim() || undefined,
        nick_name: newNickName.trim() || undefined,
        avatar: avatarUrl,
      });
      toast({ title: "Worker created", status: "success", duration: 2000, position: "bottom-right" });
      queryClient.invalidateQueries({ queryKey: ["workers"] });
      handleCloseModal();
      navigate(`/workers/${created.pk}`);
    } catch {
      toast({ title: "Create failed", status: "error", duration: 2000, position: "bottom-right" });
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <>
      <Helmet>
        <title>SJ Workers</title>
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
            <Heading size="md">SJ Workers</Heading>
            <SearchInput
              onSearch={(q) => { setSearchQuery(q); setCurrentPage(1); }}
              onInputChange={(v) => { if (v === "") { setSearchQuery(""); setCurrentPage(1); } }}
            />
          </HStack>

          {/* 전체 수 + 추가 버튼 */}
          <HStack justify="space-between" align="center" mb={4}>
            <HStack spacing={6} align="baseline">
              <Text fontSize="sm" color="gray.500">Total Workers</Text>
              <Text fontSize="xl" fontWeight="bold">{totalResults}</Text>
            </HStack>
            <Button
              size="sm"
              colorScheme="blue"
              leftIcon={<FaPlus />}
              onClick={onOpen}
            >
              New Worker
            </Button>
          </HStack>

          {/* 테이블 */}
          <TableContainer px={4}>
            <Table variant="striped" size="sm">
              <Thead bgColor={tableBgColor}>
                <Tr>
                  <Th>Avatar</Th>
                  <Th>ID</Th>
                  <Th>Name</Th>
                  <Th>Nick Name</Th>
                  <Th>Department</Th>
                  <Th>Section</Th>
                  <Th>Position</Th>
                  <Th>Rank</Th>
                  <Th>Job Duties</Th>
                  <Th>Factory</Th>
                  <Th>Status</Th>
                </Tr>
              </Thead>
              <Tbody>
                {(isLoading || isFetching) && workers.length === 0 && (
                  <Tr><Td colSpan={11}><Center py={6}><Spinner size="md" /></Center></Td></Tr>
                )}
                {errorMessage && (
                  <Tr><Td colSpan={11}><Text color="red.500" textAlign="center">{errorMessage}</Text></Td></Tr>
                )}
                {!isLoading && !isFetching && !errorMessage && workers.length === 0 && (
                  <Tr><Td colSpan={11}><Text color="gray.400" textAlign="center">No results found.</Text></Td></Tr>
                )}
                {workers.map((worker) => (
                  <Tr key={worker.pk}>
                    <Td>
                      <Avatar
                        size="sm"
                        name={worker.name}
                        src={worker.avatar ?? undefined}
                        cursor="pointer"
                        onClick={() => navigate(`/workers/${worker.pk}`)}
                        _hover={{ opacity: 0.8 }}
                      />
                    </Td>
                    <Td whiteSpace="nowrap">
                      {worker.company_id || <Text as="span" color="gray.400">-</Text>}
                    </Td>
                    <Td fontWeight="semibold" whiteSpace="nowrap">
                      <Link as={RouterLink} to={`/workers/${worker.pk}`} color="blue.500">
                        {worker.name}
                      </Link>
                    </Td>
                    <Td whiteSpace="nowrap">
                      {worker.nick_name || <Text as="span" color="gray.400">-</Text>}
                    </Td>
                    <Td whiteSpace="nowrap">
                      {worker.department
                        ? <Badge colorScheme="purple">{worker.department.name}</Badge>
                        : <Text color="gray.400">-</Text>}
                    </Td>
                    <Td whiteSpace="nowrap">
                      {worker.section
                        ? <Badge colorScheme="cyan">{worker.section.name}</Badge>
                        : <Text color="gray.400">-</Text>}
                    </Td>
                    <Td whiteSpace="nowrap">
                      {worker.position
                        ? <Badge colorScheme="blue">{worker.position.name}</Badge>
                        : <Text color="gray.400">-</Text>}
                    </Td>
                    <Td whiteSpace="nowrap">
                      {worker.rank
                        ? <Badge colorScheme="orange">{worker.rank.name}</Badge>
                        : <Text color="gray.400">-</Text>}
                    </Td>
                    <Td whiteSpace="nowrap">
                      {worker.job_duties
                        ? <Badge colorScheme="green">{worker.job_duties.name}</Badge>
                        : <Text color="gray.400">-</Text>}
                    </Td>
                    <Td whiteSpace="nowrap">
                      {worker.factory
                        ? (worker.factory.nickname || worker.factory.name)
                        : <Text color="gray.400">-</Text>}
                    </Td>
                    <Td>
                      <Badge colorScheme={resignedColor(worker.is_resigned)}>
                        {worker.is_resigned === "resigned" ? "Resigned" : "Active"}
                      </Badge>
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
                    <Text key={`ellipsis-${idx}`} px={2} color="gray.400">…</Text>
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

      {/* ── 생성 모달 ── */}
      <Modal isOpen={isOpen} onClose={handleCloseModal} isCentered size="md">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>New Worker</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack spacing={4} align="stretch">

              {/* 사진 업로드 */}
              <FormControl>
                <FormLabel fontSize="sm">Photo</FormLabel>
                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/*"
                  style={{ display: "none" }}
                  onChange={handlePhotoChange}
                />
                <HStack spacing={4} align="center">
                  <Avatar
                    size="xl"
                    name={newName || "New"}
                    src={photoPreview ?? undefined}
                    cursor="pointer"
                    onClick={() => photoInputRef.current?.click()}
                    _hover={{ opacity: 0.8 }}
                  />
                  <VStack align="flex-start" spacing={1}>
                    <Button size="xs" variant="outline" onClick={() => photoInputRef.current?.click()}>
                      {photoPreview ? "Change Photo" : "Upload Photo"}
                    </Button>
                    {photoPreview && (
                      <Button
                        size="xs"
                        variant="ghost"
                        colorScheme="red"
                        onClick={() => {
                          URL.revokeObjectURL(photoPreview!);
                          setPhotoFile(null);
                          setPhotoPreview(null);
                          if (photoInputRef.current) photoInputRef.current.value = "";
                        }}
                      >
                        Remove
                      </Button>
                    )}
                    <Text fontSize="xs" color="gray.400">아바타를 클릭해도 업로드됩니다</Text>
                  </VStack>
                </HStack>
              </FormControl>

              <FormControl isRequired>
                <FormLabel fontSize="sm">Name</FormLabel>
                <Input
                  size="sm"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="이름"
                />
              </FormControl>

              <FormControl>
                <FormLabel fontSize="sm">Company ID</FormLabel>
                <Input
                  size="sm"
                  value={newCompanyId}
                  onChange={(e) => setNewCompanyId(e.target.value)}
                  placeholder="사번"
                />
              </FormControl>

              <FormControl>
                <FormLabel fontSize="sm">Nick Name</FormLabel>
                <Input
                  size="sm"
                  value={newNickName}
                  onChange={(e) => setNewNickName(e.target.value)}
                  placeholder="닉네임"
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
