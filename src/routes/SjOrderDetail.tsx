import {
  Box,
  Heading,
  Text,
  Badge,
  useColorModeValue,
  HStack,
  VStack,
  Divider,
  Button,
  Spinner,
  Center,
  useToast,
  Input,
  Select,
  AlertDialog,
  AlertDialogBody,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogContent,
  AlertDialogOverlay,
  useDisclosure,
  Link,
  List,
  ListItem,
} from "@chakra-ui/react";
import { useRef, useState } from "react";
import { useParams, useNavigate, Link as RouterLink } from "react-router-dom";
import { Helmet } from "react-helmet";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FaArrowLeft, FaEdit, FaTrash } from "react-icons/fa";
import {
  getSjOrderDetail,
  editSjOrder,
  deleteSjOrder,
  getBuyerBrands,
  getPOTypes,
  getSjStyles,
  getSjNos,
  ISjOrderDetail,
  ISjOrderWritePayload,
  ISjBuyerBrand,
  IPOType,
  ISjStyleListResponse,
  ISjNoListResponse,
} from "../api";
import { useTranslation } from "react-i18next";
import LocalizedDateInput from "../components/LocalizedDateInput";
import { formatIsoDateDisplay } from "../lib/dateLocale";

export default function SjOrderDetail() {
  const { orderId } = useParams<{ orderId: string }>();
  const pk = Number(orderId);
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { i18n } = useTranslation();
  const fmtDate = (d?: string | null) => formatIsoDateDisplay(d, i18n.language);

  const cardBg = useColorModeValue("white", "gray.800");
  const pageBg = useColorModeValue("gray.50", "gray.900");
  const labelColor = useColorModeValue("gray.500", "gray.400");
  const borderColor = useColorModeValue("gray.200", "gray.600");
  const suggestionBg = useColorModeValue("white", "gray.700");
  const suggestionHoverBg = useColorModeValue("gray.100", "gray.600");
  const suggestionBorderColor = useColorModeValue("gray.200", "gray.600");

  const { data: order, isLoading } = useQuery<ISjOrderDetail>({
    queryKey: ["sjOrderDetail", pk],
    queryFn: () => getSjOrderDetail(pk),
    enabled: !!pk,
  });

  const { data: buyerBrands } = useQuery<ISjBuyerBrand[]>({
    queryKey: ["buyerBrands"],
    queryFn: getBuyerBrands,
  });

  const { data: poTypes } = useQuery<IPOType[]>({
    queryKey: ["poTypes"],
    queryFn: getPOTypes,
  });

  // ── 편집 상태 ──
  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState({
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
    po_type: null as number | null,
  });
  const [isSaving, setIsSaving] = useState(false);

  // SJ No 검색 combobox
  const [sjNoSearch, setSjNoSearch] = useState("");
  const [selectedSjNo, setSelectedSjNo] = useState<{ pk: number; sj_no: string } | null>(null);
  const [showSjNoSuggestions, setShowSjNoSuggestions] = useState(false);
  const sjNoBlurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // SJ Style 검색 combobox
  const [styleSearch, setStyleSearch] = useState("");
  const [selectedStyle, setSelectedStyle] = useState<{ pk: number; code: string; style_name: string } | null>(null);
  const [showStyleSuggestions, setShowStyleSuggestions] = useState(false);
  const styleBlurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: sjNoSuggestions } = useQuery<ISjNoListResponse>({
    queryKey: ["sjNoSuggestions", sjNoSearch],
    queryFn: () => getSjNos({ search: sjNoSearch }),
    enabled: isEditing && sjNoSearch.length > 0,
  });

  const { data: styleSuggestions } = useQuery<ISjStyleListResponse>({
    queryKey: ["styleSuggestions", styleSearch],
    queryFn: () => getSjStyles({ search: styleSearch }),
    enabled: isEditing && styleSearch.length > 0,
  });

  const startEdit = () => {
    if (!order) return;
    setForm({
      sj_po_number: order.sj_po_number,
      order_date: order.order_date,
      destination: order.destination,
      ex_factory_date: order.ex_factory_date ?? "",
      color: order.color,
      size: order.size,
      order_qty: order.order_qty,
      sample_qty: order.sample_qty,
      total_order_qty: order.total_order_qty,
      buyer_name: order.buyer_name?.pk ?? null,
      po_type: order.po_type?.pk ?? null,
    });
    setSelectedSjNo(order.sj_no ? { pk: order.sj_no.pk, sj_no: order.sj_no.sj_no } : null);
    setSjNoSearch(order.sj_no?.sj_no ?? "");
    setSelectedStyle(order.sj_style ? { pk: order.sj_style.pk, code: order.sj_style.code, style_name: order.sj_style.style_name } : null);
    setStyleSearch(order.sj_style?.code ?? "");
    setIsEditing(true);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const payload: ISjOrderWritePayload = {
        ...form,
        sj_no: selectedSjNo?.pk ?? null,
        sj_style: selectedStyle?.pk ?? null,
        ex_factory_date: form.ex_factory_date || undefined,
      };
      await editSjOrder(pk, payload);
      toast({ title: "Updated", status: "success", duration: 2000, position: "bottom-right" });
      queryClient.invalidateQueries({ queryKey: ["sjOrderDetail", pk] });
      queryClient.invalidateQueries({ queryKey: ["sjorders"] });
      setIsEditing(false);
    } catch {
      toast({ title: "Update failed", status: "error", duration: 2000, position: "bottom-right" });
    } finally {
      setIsSaving(false);
    }
  };

  // ── 삭제 ──
  const { isOpen: isDeleteOpen, onOpen: onDeleteOpen, onClose: onDeleteClose } = useDisclosure();
  const cancelRef = useRef<HTMLButtonElement>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await deleteSjOrder(pk);
      toast({ title: "Deleted", status: "success", duration: 2000, position: "bottom-right" });
      queryClient.invalidateQueries({ queryKey: ["sjorders"] });
      navigate("/sjorders");
    } catch {
      toast({ title: "Delete failed", status: "error", duration: 2000, position: "bottom-right" });
      setIsDeleting(false);
    }
  };

  if (isLoading) {
    return (
      <Center minH="60vh">
        <Spinner size="xl" />
      </Center>
    );
  }

  if (!order) {
    return (
      <Center minH="60vh">
        <Text color="gray.400">Order not found.</Text>
      </Center>
    );
  }

  return (
    <>
      <Helmet>
        <title>{order.sj_po_number}</title>
      </Helmet>

      <Box bg={pageBg} minH="100vh" px={{ base: 4, md: 8, lg: 12 }} py={{ base: 6, md: 8 }}>
        <Box maxW="3xl" mx="auto">

          <HStack mb={4}>
            <Button leftIcon={<FaArrowLeft />} variant="ghost" size="sm" onClick={() => navigate(-1)}>
              Back
            </Button>
          </HStack>

          <Box position="relative">
            <HStack position="absolute" top={-10} right={0} spacing={2}>
              {isEditing ? (
                <>
                  <Button size="sm" variant="ghost" onClick={() => setIsEditing(false)}>Cancel</Button>
                  <Button size="sm" colorScheme="blue" isLoading={isSaving} onClick={handleSave}>Save</Button>
                </>
              ) : (
                <>
                  <Button size="sm" leftIcon={<FaEdit />} variant="ghost" onClick={startEdit}>Edit</Button>
                  <Button size="sm" leftIcon={<FaTrash />} variant="ghost" colorScheme="red" onClick={onDeleteOpen}>Delete</Button>
                </>
              )}
            </HStack>

            <Box bg={cardBg} borderRadius="xl" border="1px solid" borderColor={borderColor} p={6} shadow="sm">
              <VStack align="stretch" spacing={4}>

                {/* SJ PO Number */}
                <Box>
                  <Text fontSize="xs" color={labelColor} fontWeight="semibold" mb={1}>SJ PO#</Text>
                  {isEditing ? (
                    <Input
                      value={form.sj_po_number}
                      onChange={(e) => setForm({ ...form, sj_po_number: e.target.value })}
                      fontWeight="bold"
                      fontSize="lg"
                    />
                  ) : (
                    <Heading size="md">{order.sj_po_number}</Heading>
                  )}
                </Box>

                <Divider />

                {/* Order Date & EX-Factory */}
                <HStack spacing={6} align="flex-start" wrap="wrap">
                  <Box flex={1} minW="140px">
                    <Text fontSize="xs" color={labelColor} fontWeight="semibold" mb={1}>ORDER DATE</Text>
                    {isEditing ? (
                      <LocalizedDateInput
                        value={form.order_date}
                        onChange={(v) => setForm({ ...form, order_date: v })}
                      />
                    ) : (
                      <Text>{fmtDate(order.order_date)}</Text>
                    )}
                  </Box>
                  <Box flex={1} minW="140px">
                    <Text fontSize="xs" color={labelColor} fontWeight="semibold" mb={1}>EX-FACTORY</Text>
                    {isEditing ? (
                      <LocalizedDateInput
                        value={form.ex_factory_date}
                        onChange={(v) => setForm({ ...form, ex_factory_date: v })}
                      />
                    ) : (
                      <Text>{fmtDate(order.ex_factory_date)}</Text>
                    )}
                  </Box>
                </HStack>

                {/* Buyer & Destination */}
                <HStack spacing={6} align="flex-start" wrap="wrap">
                  <Box flex={1} minW="140px">
                    <Text fontSize="xs" color={labelColor} fontWeight="semibold" mb={1}>BUYER</Text>
                    {isEditing ? (
                      <Select
                        value={form.buyer_name ?? ""}
                        onChange={(e) => setForm({ ...form, buyer_name: e.target.value ? Number(e.target.value) : null })}
                        placeholder="-- None --"
                      >
                        {buyerBrands?.map((b) => (
                          <option key={b.pk} value={b.pk}>{b.name}</option>
                        ))}
                      </Select>
                    ) : (
                      order.buyer_name ? (
                        <Badge colorScheme="blue" fontSize="sm">{order.buyer_name.name}</Badge>
                      ) : <Text color="gray.400">-</Text>
                    )}
                  </Box>
                  <Box flex={1} minW="140px">
                    <Text fontSize="xs" color={labelColor} fontWeight="semibold" mb={1}>DESTINATION</Text>
                    {isEditing ? (
                      <Input value={form.destination} onChange={(e) => setForm({ ...form, destination: e.target.value })} />
                    ) : (
                      <Text>{order.destination || "-"}</Text>
                    )}
                  </Box>
                </HStack>

                <Divider />

                {/* SJ No */}
                <Box>
                  <Text fontSize="xs" color={labelColor} fontWeight="semibold" mb={1}>SJ NO</Text>
                  {isEditing ? (
                    <Box position="relative">
                      <Input
                        value={sjNoSearch}
                        onChange={(e) => { setSjNoSearch(e.target.value); setSelectedSjNo(null); }}
                        onFocus={() => setShowSjNoSuggestions(true)}
                        onBlur={() => { sjNoBlurTimer.current = setTimeout(() => setShowSjNoSuggestions(false), 150); }}
                        placeholder="Search SJ No..."
                      />
                      {showSjNoSuggestions && sjNoSuggestions && sjNoSuggestions.results.length > 0 && (
                        <List
                          position="absolute"
                          zIndex={10}
                          bg={suggestionBg}
                          border="1px solid"
                          borderColor={suggestionBorderColor}
                          borderRadius="md"
                          w="full"
                          maxH="200px"
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
                                if (sjNoBlurTimer.current) clearTimeout(sjNoBlurTimer.current);
                                setSelectedSjNo({ pk: n.pk, sj_no: n.sj_no });
                                setSjNoSearch(n.sj_no);
                                setShowSjNoSuggestions(false);
                              }}
                            >
                              <Text fontSize="sm">{n.sj_no}</Text>
                            </ListItem>
                          ))}
                        </List>
                      )}
                    </Box>
                  ) : (
                    order.sj_no ? (
                      <Link as={RouterLink} to={`/sjnos/${order.sj_no.pk}`} color="blue.500" fontWeight="semibold">
                        {order.sj_no.sj_no}
                      </Link>
                    ) : <Text color="gray.400">-</Text>
                  )}
                </Box>

                {/* SJ Style */}
                <Box>
                  <Text fontSize="xs" color={labelColor} fontWeight="semibold" mb={1}>SJ STYLE</Text>
                  {isEditing ? (
                    <Box position="relative">
                      <Input
                        value={styleSearch}
                        onChange={(e) => { setStyleSearch(e.target.value); setSelectedStyle(null); }}
                        onFocus={() => setShowStyleSuggestions(true)}
                        onBlur={() => { styleBlurTimer.current = setTimeout(() => setShowStyleSuggestions(false), 150); }}
                        placeholder="Search style code..."
                      />
                      {showStyleSuggestions && styleSuggestions && styleSuggestions.results.length > 0 && (
                        <List
                          position="absolute"
                          zIndex={10}
                          bg={suggestionBg}
                          border="1px solid"
                          borderColor={suggestionBorderColor}
                          borderRadius="md"
                          w="full"
                          maxH="200px"
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
                                if (styleBlurTimer.current) clearTimeout(styleBlurTimer.current);
                                setSelectedStyle({ pk: s.pk, code: s.code, style_name: s.style_name ?? "" });
                                setStyleSearch(s.code);
                                setShowStyleSuggestions(false);
                              }}
                            >
                              <Text fontSize="sm">{s.code} {s.style_name ? `— ${s.style_name}` : ""}</Text>
                            </ListItem>
                          ))}
                        </List>
                      )}
                    </Box>
                  ) : (
                    order.sj_style ? (
                      <HStack>
                        <Link as={RouterLink} to={`/sjstyles/${order.sj_style.pk}`} color="blue.500" fontWeight="semibold">
                          {order.sj_style.code}
                        </Link>
                        {order.sj_style.style_name && (
                          <Text fontSize="sm" color={labelColor}>{order.sj_style.style_name}</Text>
                        )}
                      </HStack>
                    ) : <Text color="gray.400">-</Text>
                  )}
                </Box>

                <Divider />

                {/* Color & Size */}
                <HStack spacing={6} align="flex-start" wrap="wrap">
                  <Box flex={1} minW="100px">
                    <Text fontSize="xs" color={labelColor} fontWeight="semibold" mb={1}>COLOR</Text>
                    {isEditing ? (
                      <Input value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} />
                    ) : (
                      <Text>{order.color || "-"}</Text>
                    )}
                  </Box>
                  <Box flex={1} minW="100px">
                    <Text fontSize="xs" color={labelColor} fontWeight="semibold" mb={1}>SIZE</Text>
                    {isEditing ? (
                      <Input value={form.size} onChange={(e) => setForm({ ...form, size: e.target.value })} />
                    ) : (
                      <Text>{order.size || "-"}</Text>
                    )}
                  </Box>
                </HStack>

                {/* Quantities */}
                <HStack spacing={6} align="flex-start" wrap="wrap">
                  <Box flex={1} minW="100px">
                    <Text fontSize="xs" color={labelColor} fontWeight="semibold" mb={1}>ORDER QTY</Text>
                    {isEditing ? (
                      <Input type="number" value={form.order_qty} onChange={(e) => setForm({ ...form, order_qty: Number(e.target.value) })} />
                    ) : (
                      <Text fontWeight="semibold">{order.order_qty.toLocaleString()}</Text>
                    )}
                  </Box>
                  <Box flex={1} minW="100px">
                    <Text fontSize="xs" color={labelColor} fontWeight="semibold" mb={1}>SAMPLE QTY</Text>
                    {isEditing ? (
                      <Input type="number" value={form.sample_qty} onChange={(e) => setForm({ ...form, sample_qty: Number(e.target.value) })} />
                    ) : (
                      <Text>{order.sample_qty.toLocaleString()}</Text>
                    )}
                  </Box>
                  <Box flex={1} minW="100px">
                    <Text fontSize="xs" color={labelColor} fontWeight="semibold" mb={1}>TOTAL QTY</Text>
                    {isEditing ? (
                      <Input type="number" value={form.total_order_qty} onChange={(e) => setForm({ ...form, total_order_qty: Number(e.target.value) })} />
                    ) : (
                      <Text fontWeight="bold" fontSize="lg">{order.total_order_qty.toLocaleString()}</Text>
                    )}
                  </Box>
                </HStack>

                <Divider />

                {/* PO Type */}
                <Box>
                  <Text fontSize="xs" color={labelColor} fontWeight="semibold" mb={1}>PO TYPE</Text>
                  {isEditing ? (
                    <Select
                      value={form.po_type ?? ""}
                      onChange={(e) => setForm({ ...form, po_type: e.target.value ? Number(e.target.value) : null })}
                      placeholder="-- None --"
                    >
                      {poTypes?.map((t) => (
                        <option key={t.pk} value={t.pk}>{t.name}{t.code ? ` (${t.code})` : ""}</option>
                      ))}
                    </Select>
                  ) : (
                    order.po_type ? (
                      <Badge colorScheme="purple">{order.po_type.name}</Badge>
                    ) : <Text color="gray.400">-</Text>
                  )}
                </Box>

                <Divider />

                {/* Created At */}
                <Box>
                  <Text fontSize="xs" color={labelColor} fontWeight="semibold" mb={1}>CREATED</Text>
                  <Text fontSize="sm">{new Date(order.created_at).toLocaleString()}</Text>
                </Box>
              </VStack>
            </Box>
          </Box>
        </Box>
      </Box>

      {/* 삭제 확인 다이얼로그 */}
      <AlertDialog isOpen={isDeleteOpen} leastDestructiveRef={cancelRef} onClose={onDeleteClose}>
        <AlertDialogOverlay>
          <AlertDialogContent>
            <AlertDialogHeader fontSize="lg" fontWeight="bold">Delete Order</AlertDialogHeader>
            <AlertDialogBody>
              <strong>{order.sj_po_number}</strong>을(를) 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
            </AlertDialogBody>
            <AlertDialogFooter>
              <Button ref={cancelRef} onClick={onDeleteClose}>Cancel</Button>
              <Button colorScheme="red" ml={3} isLoading={isDeleting} onClick={handleDelete}>Delete</Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>
    </>
  );
}
