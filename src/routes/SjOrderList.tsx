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
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
  ModalFooter,
  useDisclosure,
  FormControl,
  FormLabel,
  Input,
  Select,
  Grid,
  List,
  ListItem,
  useToast
} from "@chakra-ui/react";
import LocalizedDateInput from "../components/LocalizedDateInput";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Helmet } from "react-helmet";
import {
  getSjOrders,
  createSjOrder,
  getBuyerBrands,
  getPOTypes,
  getSjStyles,
  getSjNos,
  ISjOrderListResponse,
  ISjBuyerBrand,
  IPOType,
  ISjStyleListResponse,
  ISjNoListResponse
} from "../api";
import SearchInput from "../components/SearchInput";
import { Link as RouterLink } from "react-router-dom";
import { FaChevronLeft, FaChevronRight, FaPlus } from "react-icons/fa";
import { useRef, useState } from "react";

const emptyForm = {
  sj_po_number: "",
  order_date: "",
  destination: "",
  ex_factory_date: "",
  color: "",
  size: "",
  order_qty: 0,
  sample_qty: 0,
  total_order_qty: 0,
  buyer_name: null as number | null,
  po_type: null as number | null
};

export default function SjOrderList() {
  const tableBgColor = useColorModeValue("gray.50", "gray.800");
  const pageBg = useColorModeValue("gray.50", "gray.900");
  const suggestionBg = useColorModeValue("white", "gray.700");
  const suggestionHoverBg = useColorModeValue("gray.100", "gray.600");
  const suggestionBorderColor = useColorModeValue("gray.200", "gray.600");

  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  const toast = useToast();
  const queryClient = useQueryClient();
  const { isOpen, onOpen, onClose } = useDisclosure();

  const [form, setForm] = useState({ ...emptyForm });
  const [isSaving, setIsSaving] = useState(false);

  // SJ No combobox
  const [sjNoSearch, setSjNoSearch] = useState("");
  const [selectedSjNo, setSelectedSjNo] = useState<{
    pk: number;
    sj_no: string;
  } | null>(null);
  const [showSjNoSugg, setShowSjNoSugg] = useState(false);
  const sjNoBlurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // SJ Style combobox
  const [styleSearch, setStyleSearch] = useState("");
  const [selectedStyle, setSelectedStyle] = useState<{
    pk: number;
    code: string;
  } | null>(null);
  const [showStyleSugg, setShowStyleSugg] = useState(false);
  const styleBlurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data, isLoading, isFetching, error } = useQuery<ISjOrderListResponse>(
    {
      queryKey: ["sjorders", searchQuery, currentPage],
      queryFn: () => getSjOrders({ search: searchQuery, page: currentPage })
    }
  );

  const { data: buyerBrands } = useQuery<ISjBuyerBrand[]>({
    queryKey: ["buyerBrands"],
    queryFn: getBuyerBrands,
    enabled: isOpen
  });

  const { data: poTypes } = useQuery<IPOType[]>({
    queryKey: ["poTypes"],
    queryFn: getPOTypes,
    enabled: isOpen
  });

  const { data: sjNoSuggestions } = useQuery<ISjNoListResponse>({
    queryKey: ["sjNoSugg", sjNoSearch],
    queryFn: () => getSjNos({ search: sjNoSearch }),
    enabled: isOpen && sjNoSearch.length > 0
  });

  const { data: styleSuggestions } = useQuery<ISjStyleListResponse>({
    queryKey: ["styleSugg", styleSearch],
    queryFn: () => getSjStyles({ search: styleSearch }),
    enabled: isOpen && styleSearch.length > 0
  });

  const totalPages = data?.total_pages ?? 1;
  const totalResults = data?.total_results ?? 0;
  const totalQtySum = data?.total_qty_sum ?? 0;
  const orders = data?.results ?? [];

  const errorMessage = error
    ? error instanceof Error
      ? error.message
      : "데이터를 불러오는 중 오류가 발생했습니다."
    : null;

  const fmt = (d?: string | null) => {
    if (!d) return "-";
    const dt = new Date(d);
    return isNaN(dt.getTime()) ? d : dt.toLocaleDateString("ko-KR");
  };

  const resetModal = () => {
    setForm({ ...emptyForm });
    setSjNoSearch("");
    setSelectedSjNo(null);
    setStyleSearch("");
    setSelectedStyle(null);
  };

  const handleCreate = async () => {
    if (!form.sj_po_number || !form.order_date) {
      toast({
        title: "SJ PO# and Order Date are required",
        status: "warning",
        duration: 2000,
        position: "bottom-right"
      });
      return;
    }
    setIsSaving(true);
    try {
      await createSjOrder({
        ...form,
        sj_no: selectedSjNo?.pk ?? null,
        sj_style: selectedStyle?.pk ?? null,
        ex_factory_date: form.ex_factory_date || undefined
      });
      toast({
        title: "Order created",
        status: "success",
        duration: 2000,
        position: "bottom-right"
      });
      queryClient.invalidateQueries({ queryKey: ["sjorders"] });
      resetModal();
      onClose();
    } catch (e: any) {
      const msg = e?.response?.data
        ? JSON.stringify(e.response.data)
        : "Failed to create order";
      toast({
        title: msg,
        status: "error",
        duration: 3000,
        position: "bottom-right"
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <Helmet>
        <title>SJ Orders</title>
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
            <Heading size="md">SJ Orders</Heading>
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

          {/* 전체 수 & + 버튼 */}
          <HStack justify="space-between" align="center" mb={10}>
            <HStack spacing={6} align="baseline">
              <Text fontSize="sm" color="gray.500">
                Total Orders
              </Text>
              <Text fontSize="xl" fontWeight="bold">
                {totalResults}
              </Text>
              <Text fontSize="sm" color="gray.500">
                Total Qty
              </Text>
              <Text fontSize="xl" fontWeight="bold">
                {totalQtySum.toLocaleString()}
              </Text>
            </HStack>
            <IconButton
              aria-label="Create order"
              icon={<FaPlus />}
              colorScheme="blue"
              size="sm"
              onClick={() => {
                resetModal();
                onOpen();
              }}
            />
          </HStack>

          {/* 테이블 */}
          <TableContainer px={4}>
            <Table variant="striped" size="sm">
              <Thead bgColor={tableBgColor}>
                <Tr>
                  <Th isNumeric>No</Th>
                  <Th>SJ PO#</Th>
                  <Th>EX-Factory</Th>
                  <Th>SJ No</Th>
                  <Th>Style Name</Th>
                  <Th isNumeric>Total Qty</Th>
                  <Th>Buyer</Th>
                  <Th>Destination</Th>
                  <Th>Color</Th>
                  <Th>Size</Th>
                  <Th>PO Type</Th>
                </Tr>
              </Thead>
              <Tbody>
                {(isLoading || isFetching) && orders.length === 0 && (
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
                  orders.length === 0 && (
                    <Tr>
                      <Td colSpan={11}>
                        <Text color="gray.400" textAlign="center">
                          No results found.
                        </Text>
                      </Td>
                    </Tr>
                  )}
                {orders.map((order) => (
                  <Tr key={order.pk}>
                    <Td isNumeric fontWeight="semibold">
                      <Link
                        as={RouterLink}
                        to={`/sjorders/${order.pk}`}
                        color="blue.500"
                      >
                        {order.pk}
                      </Link>
                    </Td>
                    <Td whiteSpace="nowrap">{order.sj_po_number}</Td>
                    <Td whiteSpace="nowrap">{fmt(order.ex_factory_date)}</Td>
                    <Td whiteSpace="nowrap">
                      {order.sj_no_value ? (
                        <Link
                          as={RouterLink}
                          to={`/sjnos/${order.sj_no}`}
                          color="blue.500"
                        >
                          {order.sj_no_value}
                        </Link>
                      ) : (
                        <Text color="gray.400">-</Text>
                      )}
                    </Td>
                    <Td whiteSpace="nowrap">{order.style_name || "-"}</Td>
                    <Td isNumeric fontWeight="semibold">
                      {order.total_order_qty.toLocaleString()}
                    </Td>
                    <Td whiteSpace="nowrap">
                      {order.buyer_name ? (
                        <Badge colorScheme="blue">
                          {order.buyer_name.name}
                        </Badge>
                      ) : (
                        <Text color="gray.400">-</Text>
                      )}
                    </Td>
                    <Td whiteSpace="nowrap">{order.destination || "-"}</Td>
                    <Td>{order.color || "-"}</Td>
                    <Td>{order.size || "-"}</Td>
                    <Td>
                      {order.po_type ? (
                        <Badge colorScheme="purple">{order.po_type.name}</Badge>
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

      {/* Create Order Modal */}
      <Modal
        isOpen={isOpen}
        onClose={() => {
          resetModal();
          onClose();
        }}
        size="2xl"
        isCentered
        scrollBehavior="inside"
      >
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>New SJ Order</ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={2}>
            <Grid templateColumns="1fr 1fr" gap={4}>
              {/* SJ PO# */}
              <FormControl isRequired gridColumn="1 / -1">
                <FormLabel fontSize="sm">SJ PO#</FormLabel>
                <Input
                  value={form.sj_po_number}
                  onChange={(e) =>
                    setForm({ ...form, sj_po_number: e.target.value })
                  }
                  placeholder="예: SJ2024-001"
                />
              </FormControl>

              {/* Order Date */}
              <FormControl isRequired>
                <FormLabel fontSize="sm">Order Date</FormLabel>
                <LocalizedDateInput
                  value={form.order_date}
                  onChange={(v) => setForm({ ...form, order_date: v })}
                />
              </FormControl>

              {/* EX-Factory */}
              <FormControl>
                <FormLabel fontSize="sm">EX-Factory Date</FormLabel>
                <LocalizedDateInput
                  value={form.ex_factory_date}
                  onChange={(v) => setForm({ ...form, ex_factory_date: v })}
                />
              </FormControl>

              {/* Buyer */}
              <FormControl>
                <FormLabel fontSize="sm">Buyer</FormLabel>
                <Select
                  value={form.buyer_name ?? ""}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      buyer_name: e.target.value ? Number(e.target.value) : null
                    })
                  }
                  placeholder="-- None --"
                >
                  {buyerBrands?.map((b) => (
                    <option key={b.pk} value={b.pk}>
                      {b.name}
                    </option>
                  ))}
                </Select>
              </FormControl>

              {/* Destination */}
              <FormControl>
                <FormLabel fontSize="sm">Destination</FormLabel>
                <Input
                  value={form.destination}
                  onChange={(e) =>
                    setForm({ ...form, destination: e.target.value })
                  }
                  placeholder="예: USA"
                />
              </FormControl>

              {/* SJ No combobox */}
              <FormControl gridColumn="1 / -1">
                <FormLabel fontSize="sm">SJ No</FormLabel>
                <Box position="relative">
                  <Input
                    value={sjNoSearch}
                    onChange={(e) => {
                      setSjNoSearch(e.target.value);
                      setSelectedSjNo(null);
                    }}
                    onFocus={() => setShowSjNoSugg(true)}
                    onBlur={() => {
                      sjNoBlurTimer.current = setTimeout(
                        () => setShowSjNoSugg(false),
                        150
                      );
                    }}
                    placeholder="SJ No 검색..."
                  />
                  {showSjNoSugg &&
                    sjNoSuggestions &&
                    sjNoSuggestions.results.length > 0 && (
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
                            _hover={{ bg: suggestionHoverBg }}
                            onMouseDown={() => {
                              if (sjNoBlurTimer.current)
                                clearTimeout(sjNoBlurTimer.current);
                              setSelectedSjNo({ pk: n.pk, sj_no: n.sj_no });
                              setSjNoSearch(n.sj_no);
                              setShowSjNoSugg(false);
                            }}
                          >
                            <Text fontSize="sm">{n.sj_no}</Text>
                          </ListItem>
                        ))}
                      </List>
                    )}
                </Box>
              </FormControl>

              {/* SJ Style combobox */}
              <FormControl gridColumn="1 / -1">
                <FormLabel fontSize="sm">SJ Style</FormLabel>
                <Box position="relative">
                  <Input
                    value={styleSearch}
                    onChange={(e) => {
                      setStyleSearch(e.target.value);
                      setSelectedStyle(null);
                    }}
                    onFocus={() => setShowStyleSugg(true)}
                    onBlur={() => {
                      styleBlurTimer.current = setTimeout(
                        () => setShowStyleSugg(false),
                        150
                      );
                    }}
                    placeholder="Style code 검색..."
                  />
                  {showStyleSugg &&
                    styleSuggestions &&
                    styleSuggestions.results.length > 0 && (
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
                        {styleSuggestions.results.map((s) => (
                          <ListItem
                            key={s.pk}
                            px={3}
                            py={2}
                            cursor="pointer"
                            _hover={{ bg: suggestionHoverBg }}
                            onMouseDown={() => {
                              if (styleBlurTimer.current)
                                clearTimeout(styleBlurTimer.current);
                              setSelectedStyle({ pk: s.pk, code: s.code });
                              setStyleSearch(
                                s.code +
                                  (s.style_name ? ` — ${s.style_name}` : "")
                              );
                              setShowStyleSugg(false);
                            }}
                          >
                            <Text fontSize="sm">
                              {s.code}
                              {s.style_name ? ` — ${s.style_name}` : ""}
                            </Text>
                          </ListItem>
                        ))}
                      </List>
                    )}
                </Box>
              </FormControl>

              {/* Color & Size */}
              <FormControl>
                <FormLabel fontSize="sm">Color</FormLabel>
                <Input
                  value={form.color}
                  onChange={(e) => setForm({ ...form, color: e.target.value })}
                  placeholder="예: Black"
                />
              </FormControl>
              <FormControl>
                <FormLabel fontSize="sm">Size</FormLabel>
                <Input
                  value={form.size}
                  onChange={(e) => setForm({ ...form, size: e.target.value })}
                  placeholder="예: OS"
                />
              </FormControl>

              {/* Quantities */}
              <FormControl>
                <FormLabel fontSize="sm">Order Qty</FormLabel>
                <Input
                  type="number"
                  value={form.order_qty}
                  onChange={(e) =>
                    setForm({ ...form, order_qty: Number(e.target.value) })
                  }
                />
              </FormControl>
              <FormControl>
                <FormLabel fontSize="sm">Sample Qty</FormLabel>
                <Input
                  type="number"
                  value={form.sample_qty}
                  onChange={(e) =>
                    setForm({ ...form, sample_qty: Number(e.target.value) })
                  }
                />
              </FormControl>
              <FormControl>
                <FormLabel fontSize="sm">Total Qty</FormLabel>
                <Input
                  type="number"
                  value={form.total_order_qty}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      total_order_qty: Number(e.target.value)
                    })
                  }
                />
              </FormControl>

              {/* PO Type */}
              <FormControl>
                <FormLabel fontSize="sm">PO Type</FormLabel>
                <Select
                  value={form.po_type ?? ""}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      po_type: e.target.value ? Number(e.target.value) : null
                    })
                  }
                  placeholder="-- None --"
                >
                  {poTypes?.map((t) => (
                    <option key={t.pk} value={t.pk}>
                      {t.name}
                      {t.code ? ` (${t.code})` : ""}
                    </option>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          </ModalBody>
          <ModalFooter>
            <Button
              variant="ghost"
              mr={3}
              onClick={() => {
                resetModal();
                onClose();
              }}
            >
              Cancel
            </Button>
            <Button
              colorScheme="blue"
              isLoading={isSaving}
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
