import { useEffect, useState } from "react";
import {
  Badge,
  Box,
  Center,
  Collapse,
  Flex,
  Grid,
  Heading,
  HStack,
  IconButton,
  Image,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalOverlay,
  Progress,
  Spinner,
  Stat,
  StatHelpText,
  StatLabel,
  StatNumber,
  Table,
  TableContainer,
  Tag,
  TagLabel,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
  useColorModeValue,
  VStack
} from "@chakra-ui/react";
import { Helmet } from "react-helmet";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  FaCamera,
  FaChevronLeft,
  FaChevronRight,
  FaChevronDown,
  FaChevronUp,
  FaClock,
  FaExclamationTriangle,
  FaMicroscope,
  FaSearch,
  FaShieldAlt,
  FaTags,
  FaUser
} from "react-icons/fa";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis
} from "recharts";
import {
  getVlAssemblyDailyInspectionReport,
  IEpDailyInspectionReportDefectCategory,
  IEpDailyInspectionReportStyleRow,
  IEpInspectionPhotoPreview
} from "../api";

// ── Cloudflare Images helper ──────────────────────────────────────────────────
const CF_IMAGE_PUBLIC = (imageId: string) =>
  `https://imagedelivery.net/mzmXhxWLR9jzdX8u9g4BBQ/${imageId}/public`;

// ── Constants ──────────────────────────────────────────────────────────────────

const DEFECT_COLORS = [
  "#FC8181",
  "#F6AD55",
  "#F6E05E",
  "#68D391",
  "#63B3ED",
  "#9F7AEA",
  "#F687B3",
  "#4FD1C5",
  "#FBD38D",
  "#A0AEC0"
];

// ── Helpers ────────────────────────────────────────────────────────────────────

function localDateStr(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function todayStr(): string {
  return localDateStr(new Date());
}

function shiftDay(dateStr: string, delta: number): string {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + delta);
  return localDateStr(d);
}

/** 불량률에 따른 색상 */
function defectRateColor(rate: number): string {
  if (rate === 0) return "green.400";
  if (rate < 2) return "teal.400";
  if (rate < 5) return "orange.400";
  return "red.500";
}

function defectRateColorScheme(rate: number): string {
  if (rate === 0) return "green";
  if (rate < 2) return "teal";
  if (rate < 5) return "orange";
  return "red";
}

// ── Animated counter ──────────────────────────────────────────────────────────

function useCountUp(target: number, duration = 700): number {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (target === 0) {
      setValue(0);
      return;
    }
    setValue(0);
    const steps = 24;
    const interval = duration / steps;
    let step = 0;
    const timer = setInterval(() => {
      step += 1;
      const eased = 1 - Math.pow(1 - step / steps, 3);
      setValue(step >= steps ? target : Math.floor(eased * target));
      if (step >= steps) clearInterval(timer);
    }, interval);
    return () => clearInterval(timer);
  }, [target, duration]);
  return value;
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function KpiCard({
  icon,
  label,
  value,
  subLabel,
  accent,
  animatedValue,
  suffix
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  subLabel?: string;
  accent: string;
  animatedValue?: number;
  suffix?: string;
}) {
  const cardBg = useColorModeValue("white", "gray.800");
  const border = useColorModeValue("gray.100", "gray.700");
  const labelColor = useColorModeValue("gray.500", "gray.400");
  const displayed =
    animatedValue !== undefined
      ? animatedValue.toLocaleString() + (suffix ?? "")
      : value;

  return (
    <Box
      bg={cardBg}
      borderRadius="xl"
      border="1px solid"
      borderColor={border}
      borderLeft="4px solid"
      borderLeftColor={accent}
      p={5}
      shadow="sm"
      position="relative"
      overflow="hidden"
      transition="box-shadow 0.15s"
      _hover={{ shadow: "md" }}
    >
      <Box
        position="absolute"
        bottom={2}
        right={3}
        fontSize="4xl"
        opacity={0.07}
        color={accent}
        pointerEvents="none"
      >
        {icon}
      </Box>
      <Stat>
        <StatLabel
          fontSize="xs"
          color={labelColor}
          fontWeight="semibold"
          textTransform="uppercase"
          letterSpacing="wide"
        >
          {label}
        </StatLabel>
        <StatNumber fontSize="2xl" fontWeight="extrabold" color={accent}>
          {displayed}
        </StatNumber>
        {subLabel && (
          <StatHelpText mb={0} fontSize="xs" noOfLines={1}>
            {subLabel}
          </StatHelpText>
        )}
      </Stat>
    </Box>
  );
}

// ── Photo Lightbox ────────────────────────────────────────────────────────────

interface LightboxState {
  photos: string[];
  index: number;
  categoryName: string;
}

function PhotoLightbox({
  state,
  onClose
}: {
  state: LightboxState;
  onClose: () => void;
}) {
  const [idx, setIdx] = useState(state.index);
  const total = state.photos.length;

  useEffect(() => {
    const handle = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") setIdx((i) => (i - 1 + total) % total);
      if (e.key === "ArrowRight") setIdx((i) => (i + 1) % total);
    };
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, [total]);

  const btnStyle = {
    position: "absolute" as const,
    top: "50%",
    transform: "translateY(-50%)",
    zIndex: 10,
    colorScheme: "whiteAlpha",
    borderRadius: "full",
    size: "lg",
  };

  return (
    <Modal isOpen onClose={onClose} size="full" isCentered>
      <ModalOverlay bg="blackAlpha.900" />
      <ModalContent bg="transparent" boxShadow="none" m={0}>
        <ModalCloseButton color="white" size="lg" top={4} right={4} zIndex={20} />
        <ModalBody
          display="flex"
          flexDirection="column"
          alignItems="center"
          justifyContent="center"
          p={{ base: 4, md: 10 }}
        >
          {/* Category badge */}
          {state.categoryName && (
            <Badge colorScheme="red" fontSize="sm" mb={4} px={3} py={1}>
              {state.categoryName}
            </Badge>
          )}

          {/* Main image + nav buttons */}
          <Box position="relative" w="full" maxW="860px">
            <Image
              src={CF_IMAGE_PUBLIC(state.photos[idx])}
              alt=""
              maxH="72vh"
              w="auto"
              maxW="100%"
              mx="auto"
              display="block"
              borderRadius="2xl"
              objectFit="contain"
              shadow="2xl"
            />
            {total > 1 && (
              <>
                <IconButton
                  {...btnStyle}
                  left={{ base: -2, md: -14 }}
                  aria-label="Previous photo"
                  icon={<FaChevronLeft />}
                  onClick={() => setIdx((i) => (i - 1 + total) % total)}
                />
                <IconButton
                  {...btnStyle}
                  right={{ base: -2, md: -14 }}
                  aria-label="Next photo"
                  icon={<FaChevronRight />}
                  onClick={() => setIdx((i) => (i + 1) % total)}
                />
              </>
            )}
          </Box>

          {/* Counter */}
          {total > 1 && (
            <Text color="whiteAlpha.700" fontSize="sm" mt={3}>
              {idx + 1} / {total}
            </Text>
          )}

          {/* Thumbnail strip */}
          {total > 1 && (
            <HStack
              mt={3}
              spacing={2}
              overflowX="auto"
              maxW="90vw"
              pb={2}
              px={1}
              css={{ scrollbarWidth: "thin" }}
            >
              {state.photos.map((pid, i) => (
                <Image
                  key={pid}
                  src={CF_IMAGE_PUBLIC(pid)}
                  alt=""
                  w="56px"
                  h="56px"
                  flexShrink={0}
                  objectFit="cover"
                  borderRadius="lg"
                  cursor="pointer"
                  opacity={i === idx ? 1 : 0.45}
                  border="2px solid"
                  borderColor={i === idx ? "white" : "transparent"}
                  transition="all 0.15s"
                  onClick={() => setIdx(i)}
                />
              ))}
            </HStack>
          )}
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}

// ── Photo preview strip inside StyleRow ──────────────────────────────────────

function PhotoPreviewStrip({
  previews,
  lang
}: {
  previews: IEpInspectionPhotoPreview[];
  lang: string;
}) {
  const [lightbox, setLightbox] = useState<LightboxState | null>(null);
  const labelColor = useColorModeValue("gray.500", "gray.400");
  const thumbBorder = useColorModeValue("gray.200", "gray.600");
  const { t } = useTranslation();

  function catName(p: IEpInspectionPhotoPreview): string {
    const name =
      lang === "ko"
        ? p.defect_category_name_ko
        : lang === "vi"
        ? p.defect_category_name_vi
        : p.defect_category_name_en;
    return name || "";
  }

  if (previews.length === 0) return null;

  return (
    <Box mt={4} pt={3} borderTop="1px dashed" borderColor={thumbBorder}>
      <HStack mb={3} spacing={1}>
        <Box color="gray.400">
          <FaCamera size={11} />
        </Box>
        <Text
          fontSize="xs"
          fontWeight="semibold"
          color={labelColor}
          textTransform="uppercase"
          letterSpacing="wide"
        >
          {t("vlAssemblyDailyInspectionReport.defectPhotos", { count: previews.reduce((acc, p) => acc + p.photo_image_ids.length, 0) })}
        </Text>
      </HStack>

      <VStack align="stretch" spacing={3}>
        {previews.map((preview) => {
          const cn = catName(preview);
          return (
            <Box key={preview.inspection_id}>
              {/* Category + defect count badge */}
              <HStack mb={2} spacing={2}>
                {cn && (
                  <Badge colorScheme="red" fontSize="xs">
                    {cn}
                  </Badge>
                )}
                <Badge colorScheme="orange" variant="subtle" fontSize="xs">
                  {t("vlAssemblyDailyInspectionReport.defectCount", { count: preview.defect_qty })}
                </Badge>
              </HStack>

              {/* Thumbnail grid */}
              <Grid
                templateColumns="repeat(auto-fill, minmax(80px, 1fr))"
                gap={2}
              >
                {preview.photo_image_ids.map((pid, pidx) => (
                  <Box
                    key={pid}
                    position="relative"
                    borderRadius="lg"
                    overflow="hidden"
                    cursor="zoom-in"
                    border="1px solid"
                    borderColor={thumbBorder}
                    onClick={() =>
                      setLightbox({
                        photos: preview.photo_image_ids,
                        index: pidx,
                        categoryName: cn
                      })
                    }
                    transition="transform 0.15s, box-shadow 0.15s"
                    _hover={{ transform: "scale(1.04)", shadow: "md" }}
                  >
                    <Image
                      src={CF_IMAGE_PUBLIC(pid)}
                      alt=""
                      w="full"
                      h="80px"
                      objectFit="cover"
                    />
                    {/* Photo count badge on first thumb when multiple */}
                    {pidx === 0 && preview.photo_image_ids.length > 1 && (
                      <Box
                        position="absolute"
                        bottom={1}
                        right={1}
                        bg="blackAlpha.700"
                        borderRadius="md"
                        px="5px"
                        py="1px"
                      >
                        <Text fontSize="9px" color="white" fontWeight="bold">
                          +{preview.photo_image_ids.length - 1}
                        </Text>
                      </Box>
                    )}
                  </Box>
                ))}
              </Grid>
            </Box>
          );
        })}
      </VStack>

      {lightbox && (
        <PhotoLightbox state={lightbox} onClose={() => setLightbox(null)} />
      )}
    </Box>
  );
}

// ── Style Row ─────────────────────────────────────────────────────────────────

function StyleRow({
  row,
  maxQty,
  rank
}: {
  row: IEpDailyInspectionReportStyleRow;
  maxQty: number;
  rank: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const cardBg = useColorModeValue("white", "gray.800");
  const border = useColorModeValue("gray.100", "gray.700");
  const subBg = useColorModeValue("gray.50", "gray.750");
  const hoverBg = useColorModeValue("gray.50", "gray.700");
  const { t, i18n } = useTranslation();
  const lang = i18n.language?.split("-")[0] ?? "en";

  const rankColor =
    rank === 1
      ? "yellow.400"
      : rank === 2
      ? "gray.400"
      : rank === 3
      ? "orange.400"
      : "gray.300";

  const pct = maxQty > 0 ? (row.inspected_qty / maxQty) * 100 : 0;
  const rateColor = defectRateColor(row.defect_rate);
  const rateScheme = defectRateColorScheme(row.defect_rate);

  function catName(cat: IEpDailyInspectionReportDefectCategory): string {
    if (lang === "ko") return cat.category_name_ko || cat.category_code;
    if (lang === "vi") return cat.category_name_vi || cat.category_code;
    return cat.category_name_en || cat.category_code;
  }

  return (
    <Box
      bg={cardBg}
      border="1px solid"
      borderColor={border}
      borderRadius="xl"
      mb={3}
      overflow="hidden"
      shadow="sm"
      transition="box-shadow 0.15s"
      _hover={{ shadow: "md" }}
    >
      <Flex
        align="center"
        px={4}
        pt={4}
        pb={3}
        gap={3}
        cursor="pointer"
        _hover={{ bg: hoverBg }}
        onClick={() => setExpanded((e) => !e)}
        transition="background 0.1s"
      >
        {/* Rank */}
        <Flex
          w={7}
          h={7}
          borderRadius="full"
          bg={rankColor}
          align="center"
          justify="center"
          flexShrink={0}
        >
          <Text fontSize="xs" fontWeight="bold" color="white">
            {rank}
          </Text>
        </Flex>

        {/* Style info */}
        <Box flex={1} minW={0}>
          <HStack mb={1} flexWrap="wrap" spacing={2}>
            <Text fontWeight="bold" fontSize="sm" noOfLines={1}>
              {row.sj_po_number}
            </Text>
            {row.style_code && (
              <Badge colorScheme="purple" fontSize="xs" flexShrink={0}>
                {row.style_code}
              </Badge>
            )}
            {row.style_name && (
              <Text fontSize="xs" color="gray.500" noOfLines={1}>
                {row.style_name}
              </Text>
            )}
          </HStack>
          <HStack spacing={1} flexWrap="wrap">
            {row.sj_nos.map((s) => (
              <Tag key={s} size="sm" colorScheme="blue" variant="subtle">
                <TagLabel>{s}</TagLabel>
              </Tag>
            ))}
          </HStack>
        </Box>

        {/* Stats */}
        <VStack align="flex-end" spacing={0} flexShrink={0} minW="110px">
          <HStack spacing={2} align="baseline">
            <Text fontWeight="extrabold" fontSize="xl" color="blue.400" lineHeight="1.1">
              {row.inspected_qty.toLocaleString()}
            </Text>
            {row.defect_qty > 0 && (
              <Text fontWeight="bold" fontSize="sm" color="red.400">
                -{row.defect_qty.toLocaleString()}
              </Text>
            )}
          </HStack>
          <Badge colorScheme={rateScheme} fontSize="xs">
            {row.defect_rate.toFixed(1)}% · {row.record_count}{t("vlAssemblyDailyInspectionReport.unitRecord")}
          </Badge>
        </VStack>

        <Box color="gray.400" flexShrink={0}>
          {expanded ? <FaChevronUp size={12} /> : <FaChevronDown size={12} />}
        </Box>
      </Flex>

      {/* Dual progress: inspected (blue) + defect overlay (red) */}
      <Box position="relative">
        <Progress value={pct} size="xs" colorScheme="blue" borderRadius={0} />
        {row.defect_qty > 0 && row.inspected_qty > 0 && (
          <Box
            position="absolute"
            top={0}
            left={0}
            h="100%"
            w={`${(row.defect_qty / row.inspected_qty) * pct}%`}
            bg="red.400"
            opacity={0.7}
          />
        )}
      </Box>

      {/* Expandable */}
      <Collapse in={expanded} animateOpacity>
        <Box bg={subBg} px={4} py={3}>
          {row.inspector_names.length > 0 && (
            <HStack mb={3} spacing={2} flexWrap="wrap">
              <Box color="gray.400" mt="1px">
                <FaUser size={11} />
              </Box>
              {row.inspector_names.map((w) => (
                <Badge key={w} colorScheme="teal" variant="subtle" fontSize="xs">
                  {w}
                </Badge>
              ))}
            </HStack>
          )}

          {row.defect_categories.length > 0 ? (
            <TableContainer>
              <Table size="sm" variant="simple">
                <Thead>
                  <Tr>
                    <Th fontSize="xs">{t("vlAssemblyDailyInspectionReport.colDefectType")}</Th>
                    <Th isNumeric fontSize="xs">{t("vlAssemblyDailyInspectionReport.defectQty")}</Th>
                    <Th fontSize="xs">{t("vlAssemblyDailyInspectionReport.trend")}</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {row.defect_categories.map((cat) => (
                    <Tr key={cat.category_code}>
                      <Td fontSize="xs">{catName(cat)}</Td>
                      <Td isNumeric fontSize="xs" fontWeight="bold" color="red.400">
                        {cat.defect_qty.toLocaleString()}
                      </Td>
                      <Td fontSize="xs">
                        <HStack spacing={2}>
                          <Progress
                            value={
                              row.defect_qty > 0
                                ? (cat.defect_qty / row.defect_qty) * 100
                                : 0
                            }
                            size="xs"
                            colorScheme="red"
                            w="60px"
                            borderRadius="full"
                          />
                          <Text fontSize="xs" color="gray.500">
                            {row.defect_qty > 0
                              ? ((cat.defect_qty / row.defect_qty) * 100).toFixed(0)
                              : 0}
                            %
                          </Text>
                        </HStack>
                      </Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            </TableContainer>
          ) : (
            <Text fontSize="xs" color="green.400" fontWeight="semibold">
              {t("vlAssemblyDailyInspectionReport.noDefects")}
            </Text>
          )}

          {row.photo_previews && row.photo_previews.length > 0 && (
            <Box mt={3}>
              <PhotoPreviewStrip previews={row.photo_previews} lang={lang} />
            </Box>
          )}
        </Box>
      </Collapse>
    </Box>
  );
}

function DefectCategoryPieChart({
  data,
  totalDefect
}: {
  data: IEpDailyInspectionReportDefectCategory[];
  totalDefect: number;
}) {
  const cardBg = useColorModeValue("white", "gray.800");
  const border = useColorModeValue("gray.100", "gray.700");
  const tooltipBg = useColorModeValue("#FFFFFF", "#1A202C");
  const gridLine = useColorModeValue("#E2E8F0", "#2D3748");
  const textColor = useColorModeValue("gray.700", "gray.200");
  const subColor = useColorModeValue("gray.500", "gray.400");
  const { t, i18n } = useTranslation();
  const lang = i18n.language?.split("-")[0] ?? "en";

  function catName(cat: IEpDailyInspectionReportDefectCategory): string {
    if (lang === "ko") return cat.category_name_ko || cat.category_code;
    if (lang === "vi") return cat.category_name_vi || cat.category_code;
    return cat.category_name_en || cat.category_code;
  }

  const top8 = data.slice(0, 8);

  return (
    <Box
      bg={cardBg}
      border="1px solid"
      borderColor={border}
      borderRadius="xl"
      p={5}
      shadow="sm"
    >
      <Text
        fontWeight="semibold"
        fontSize="xs"
        color={subColor}
        textTransform="uppercase"
        letterSpacing="widest"
        mb={4}
      >
        {t("vlAssemblyDailyInspectionReport.defectCategoryTitle")}
      </Text>

      {top8.length === 0 ? (
        <Center h="160px">
          <VStack spacing={2}>
            <Box color="green.400" fontSize="3xl">
              <FaShieldAlt />
            </Box>
            <Text fontSize="sm" color="green.400" fontWeight="semibold">
              {t("vlAssemblyDailyInspectionReport.noDefects")}
            </Text>
          </VStack>
        </Center>
      ) : (
        <>
          <Box position="relative" mb={4}>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie
                  data={top8}
                  cx="50%"
                  cy="50%"
                  innerRadius={52}
                  outerRadius={75}
                  dataKey="defect_qty"
                  paddingAngle={2}
                  startAngle={90}
                  endAngle={-270}
                >
                  {top8.map((_, idx) => (
                    <Cell
                      key={`dc-${idx}`}
                      fill={DEFECT_COLORS[idx % DEFECT_COLORS.length]}
                    />
                  ))}
                </Pie>
                <RechartsTooltip
                  contentStyle={{
                    background: tooltipBg,
                    border: `1px solid ${gridLine}`,
                    borderRadius: "8px",
                    fontSize: "12px"
                  }}
                  formatter={(
                    v: unknown,
                    _n: unknown,
                    entry: { payload?: IEpDailyInspectionReportDefectCategory }
                  ) => [
                    `${(v as number).toLocaleString()} (${
                      totalDefect > 0
                        ? (((v as number) / totalDefect) * 100).toFixed(1)
                        : 0
                    }%)`,
                    entry?.payload ? catName(entry.payload) : ""
                  ]}
                />
              </PieChart>
            </ResponsiveContainer>
            <Box
              position="absolute"
              top="50%"
              left="50%"
              transform="translate(-50%, -50%)"
              textAlign="center"
              pointerEvents="none"
            >
              <Text
                fontSize="lg"
                fontWeight="extrabold"
                color="red.400"
                lineHeight="1"
              >
                {totalDefect.toLocaleString()}
              </Text>
              <Text
                fontSize="9px"
                color={subColor}
                textTransform="uppercase"
                letterSpacing="wide"
              >
                {t("vlAssemblyDailyInspectionReport.totalDefect")}
              </Text>
            </Box>
          </Box>

          <VStack align="stretch" spacing={2}>
            {top8.map((cat, idx) => (
              <Flex key={cat.category_code} align="center" gap={2}>
                <Box
                  w={3}
                  h={3}
                  borderRadius="sm"
                  bg={DEFECT_COLORS[idx % DEFECT_COLORS.length]}
                  flexShrink={0}
                />
                <Text fontSize="xs" flex={1} noOfLines={1} color={textColor}>
                  {catName(cat)}
                </Text>
                <Text
                  fontSize="xs"
                  fontWeight="bold"
                  color="red.400"
                  flexShrink={0}
                >
                  {cat.defect_qty.toLocaleString()}
                </Text>
                <Text
                  fontSize="xs"
                  color={subColor}
                  flexShrink={0}
                  minW="40px"
                  textAlign="right"
                >
                  {cat.defect_rate_of_total.toFixed(1)}%
                </Text>
              </Flex>
            ))}
          </VStack>
        </>
      )}
    </Box>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function VlAssemblyDailyInspectionReport() {
  const today = todayStr();
  const [selectedDate, setSelectedDate] = useState(today);
  const { t } = useTranslation();

  const pageBg = useColorModeValue("gray.50", "gray.900");
  const cardBg = useColorModeValue("white", "gray.800");
  const border = useColorModeValue("gray.100", "gray.700");
  const gridLine = useColorModeValue("#E2E8F0", "#2D3748");
  const tickColor = useColorModeValue("#718096", "#A0AEC0");
  const tooltipBg = useColorModeValue("#FFFFFF", "#1A202C");

  const { data, isLoading } = useQuery({
    queryKey: ["vl-daily-inspection-report", selectedDate],
    queryFn: () => getVlAssemblyDailyInspectionReport(selectedDate)
  });

  // Animated counters
  const animInspected = useCountUp(data?.kpi.total_inspected_qty ?? 0);
  const animDefect = useCountUp(data?.kpi.total_defect_qty ?? 0);
  const animRecords = useCountUp(data?.kpi.record_count ?? 0);
  const animStyles = useCountUp(data?.kpi.active_styles_count ?? 0);
  const animInspectors = useCountUp(data?.kpi.active_inspectors_count ?? 0);

  const maxStyleQty =
    data && data.by_style.length > 0
      ? Math.max(...data.by_style.map((s) => s.inspected_qty))
      : 1;

  const isToday = selectedDate === today;
  const isAtOrAfterToday = selectedDate >= today;
  const defectRateAccent = data ? defectRateColor(data.kpi.defect_rate) : "orange.400";

  return (
    <Box minH="100vh" bg={pageBg} px={{ base: 4, md: 8 }} py={6}>
      <Helmet>
        <title>VL Assembly Daily Inspection Report | Sungjin MES</title>
      </Helmet>

      {/* ── Header ───────────────────────────────────────────────── */}
      <Flex justify="space-between" align="center" mb={6} flexWrap="wrap" gap={4}>
        <Box>
          <Heading size="lg" letterSpacing="tight">
            {t("vlAssemblyDailyInspectionReport.title")}
          </Heading>
          <Text fontSize="sm" color="gray.500" mt={1}>
            {t("vlAssemblyDailyInspectionReport.subtitle")}
          </Text>
        </Box>

        {/* Date Navigator */}
        <HStack
          bg={cardBg}
          border="1px solid"
          borderColor={border}
          borderRadius="xl"
          p={2}
          shadow="sm"
          spacing={1}
        >
          <IconButton
            aria-label="Previous day"
            icon={<FaChevronLeft />}
            size="sm"
            variant="ghost"
            onClick={() => setSelectedDate((d) => shiftDay(d, -1))}
          />
          <VStack spacing={0} minW="120px" textAlign="center" px={2}>
            <Text fontWeight="bold" fontSize="sm">
              {selectedDate}
            </Text>
            {isToday && (
              <Badge colorScheme="green" fontSize="2xs">
                {t("vlAssemblyDailyInspectionReport.today")}
              </Badge>
            )}
          </VStack>
          <IconButton
            aria-label="Next day"
            icon={<FaChevronRight />}
            size="sm"
            variant="ghost"
            isDisabled={isAtOrAfterToday}
            onClick={() => setSelectedDate((d) => shiftDay(d, 1))}
          />
        </HStack>
      </Flex>

      {/* ── Loading / Empty ──────────────────────────────────────── */}
      {isLoading ? (
        <Center minH="40vh">
          <Spinner size="xl" color="red.400" thickness="4px" />
        </Center>
      ) : !data ? (
        <Center minH="40vh">
          <Text color="gray.400">{t("vlAssemblyDailyInspectionReport.noData")}</Text>
        </Center>
      ) : (
        <>
          {/* ── KPI Cards ─────────────────────────────────────────── */}
          <Grid
            templateColumns={{
              base: "repeat(2, 1fr)",
              md: "repeat(4, 1fr)",
              xl: "repeat(8, 1fr)"
            }}
            gap={4}
            mb={8}
          >
            <KpiCard
              icon={<FaSearch />}
              label={t("vlAssemblyDailyInspectionReport.kpi.totalInspected")}
              value={data.kpi.total_inspected_qty.toLocaleString()}
              animatedValue={animInspected}
              subLabel={t("vlAssemblyDailyInspectionReport.kpi.totalInspectedSub")}
              accent="blue.400"
            />
            <KpiCard
              icon={<FaExclamationTriangle />}
              label={t("vlAssemblyDailyInspectionReport.kpi.totalDefect")}
              value={data.kpi.total_defect_qty.toLocaleString()}
              animatedValue={animDefect}
              subLabel={t("vlAssemblyDailyInspectionReport.kpi.totalDefectSub")}
              accent="red.400"
            />
            {/* Defect rate — accent changes with value */}
            <Box
              bg={cardBg}
              borderRadius="xl"
              border="1px solid"
              borderColor={border}
              borderLeft="4px solid"
              borderLeftColor={defectRateAccent}
              p={5}
              shadow="sm"
              position="relative"
              overflow="hidden"
              transition="box-shadow 0.15s"
              _hover={{ shadow: "md" }}
              gridColumn={{ md: "span 2", xl: "span 1" }}
            >
              <Box
                position="absolute"
                bottom={2}
                right={3}
                fontSize="4xl"
                opacity={0.07}
                color={defectRateAccent}
                pointerEvents="none"
              >
                <FaShieldAlt />
              </Box>
              <Stat>
                <StatLabel
                  fontSize="xs"
                  color="gray.500"
                  fontWeight="semibold"
                  textTransform="uppercase"
                  letterSpacing="wide"
                >
                  {t("vlAssemblyDailyInspectionReport.kpi.defectRate")}
                </StatLabel>
                <StatNumber
                  fontSize="2xl"
                  fontWeight="extrabold"
                  color={defectRateAccent}
                >
                  {data.kpi.defect_rate.toFixed(1)}%
                </StatNumber>
                <StatHelpText mb={0} fontSize="xs">
                  {data.kpi.defect_rate === 0
                    ? t("vlAssemblyDailyInspectionReport.kpi.defectRateGood")
                    : data.kpi.defect_rate < 2
                    ? t("vlAssemblyDailyInspectionReport.kpi.defectRateOk")
                    : data.kpi.defect_rate < 5
                    ? t("vlAssemblyDailyInspectionReport.kpi.defectRateWarn")
                    : t("vlAssemblyDailyInspectionReport.kpi.defectRateBad")}
                </StatHelpText>
              </Stat>
            </Box>
            <KpiCard
              icon={<FaMicroscope />}
              label={t("vlAssemblyDailyInspectionReport.kpi.recordCount")}
              value={data.kpi.record_count}
              animatedValue={animRecords}
              subLabel={t("vlAssemblyDailyInspectionReport.kpi.recordCountSub")}
              accent="purple.400"
            />
            <KpiCard
              icon={<FaTags />}
              label={t("vlAssemblyDailyInspectionReport.kpi.activeStyles")}
              value={data.kpi.active_styles_count}
              animatedValue={animStyles}
              subLabel={t("vlAssemblyDailyInspectionReport.kpi.activeStylesSub")}
              accent="teal.400"
            />
            <KpiCard
              icon={<FaUser />}
              label={t("vlAssemblyDailyInspectionReport.kpi.activeInspectors")}
              value={data.kpi.active_inspectors_count}
              animatedValue={animInspectors}
              subLabel={t("vlAssemblyDailyInspectionReport.kpi.activeInspectorsSub")}
              accent="green.400"
            />
            <KpiCard
              icon={<FaClock />}
              label={t("vlAssemblyDailyInspectionReport.kpi.peakHour")}
              value={
                data.kpi.peak_hour != null
                  ? `${String(data.kpi.peak_hour).padStart(2, "0")}:00`
                  : "-"
              }
              subLabel={t("vlAssemblyDailyInspectionReport.kpi.peakHourSub")}
              accent="orange.400"
            />
          </Grid>

          <Box
            bg={cardBg}
            border="1px solid"
            borderColor={border}
            borderRadius="xl"
            p={5}
            shadow="sm"
            mb={8}
          >
            <Text
              fontWeight="semibold"
              fontSize="xs"
              color="gray.500"
              textTransform="uppercase"
              letterSpacing="widest"
              mb={4}
            >
              {t("vlAssemblyDailyInspectionReport.defectScopeTitle")}
            </Text>
            <Grid templateColumns={{ base: "1fr", md: "repeat(3, 1fr)" }} gap={4}>
              <Stat size="sm">
                <StatLabel fontSize="xs">{t("vlAssemblyDailyInspectionReport.kpi.defectSjNo")}</StatLabel>
                <StatNumber fontSize="xl">
                  {(data.kpi.defect_qty_vl_sj_no ?? 0).toLocaleString()}
                </StatNumber>
                <StatHelpText mb={0}>{t("vlAssemblyDailyInspectionReport.kpi.defectSjNoSub")}</StatHelpText>
              </Stat>
              <Stat size="sm">
                <StatLabel fontSize="xs">{t("vlAssemblyDailyInspectionReport.kpi.defectModule")}</StatLabel>
                <StatNumber fontSize="xl">
                  {(data.kpi.defect_qty_vl_module ?? 0).toLocaleString()}
                </StatNumber>
                <StatHelpText mb={0}>{t("vlAssemblyDailyInspectionReport.kpi.defectModuleSub")}</StatHelpText>
              </Stat>
              <Stat size="sm">
                <StatLabel fontSize="xs">{t("vlAssemblyDailyInspectionReport.kpi.defectProcess")}</StatLabel>
                <StatNumber fontSize="xl">
                  {(data.kpi.defect_qty_vl_process ?? 0).toLocaleString()}
                </StatNumber>
                <StatHelpText mb={0}>{t("vlAssemblyDailyInspectionReport.kpi.defectProcessSub")}</StatHelpText>
              </Stat>
            </Grid>
          </Box>

          {/* ── Main Section ──────────────────────────────────────── */}
          <Grid
            templateColumns={{ base: "1fr", lg: "1fr 360px" }}
            gap={6}
            alignItems="flex-start"
          >
            {/* Style list */}
            <Box>
              <Text
                fontWeight="semibold"
                fontSize="xs"
                color="gray.500"
                textTransform="uppercase"
                letterSpacing="widest"
                mb={4}
              >
                {t("vlAssemblyDailyInspectionReport.byStyleTitle")}
              </Text>
              {data.by_style.length === 0 ? (
                <Center
                  p={16}
                  bg={cardBg}
                  borderRadius="xl"
                  border="1px solid"
                  borderColor={border}
                >
                  <Text color="gray.400">
                    {t("vlAssemblyDailyInspectionReport.noData")}
                  </Text>
                </Center>
              ) : (
                data.by_style.map((row, idx) => (
                  <StyleRow
                    key={row.schedule_pk}
                    row={row}
                    maxQty={maxStyleQty}
                    rank={idx + 1}
                  />
                ))
              )}

              {/* Inspector table */}
              {data.by_inspector.length > 0 && (
                <Box
                  bg={cardBg}
                  border="1px solid"
                  borderColor={border}
                  borderRadius="xl"
                  p={5}
                  shadow="sm"
                  mt={6}
                >
                  <Text
                    fontWeight="semibold"
                    fontSize="xs"
                    color="gray.500"
                    textTransform="uppercase"
                    letterSpacing="widest"
                    mb={4}
                  >
                    {t("vlAssemblyDailyInspectionReport.byInspectorTitle")}
                  </Text>
                  <TableContainer>
                    <Table size="sm" variant="simple">
                      <Thead>
                        <Tr>
                          <Th fontSize="xs">
                            {t("vlAssemblyDailyInspectionReport.inspector")}
                          </Th>
                          <Th isNumeric fontSize="xs">
                            {t("vlAssemblyDailyInspectionReport.inspectedQty")}
                          </Th>
                          <Th isNumeric fontSize="xs">
                            {t("vlAssemblyDailyInspectionReport.defectQty")}
                          </Th>
                          <Th isNumeric fontSize="xs">
                            {t("vlAssemblyDailyInspectionReport.defectRate")}
                          </Th>
                          <Th fontSize="xs">
                            {t("vlAssemblyDailyInspectionReport.trend")}
                          </Th>
                        </Tr>
                      </Thead>
                      <Tbody>
                        {data.by_inspector.map((insp) => (
                          <Tr key={insp.inspector_name}>
                            <Td fontSize="xs" fontWeight="semibold">
                              {insp.inspector_name}
                            </Td>
                            <Td isNumeric fontSize="xs">
                              {insp.inspected_qty.toLocaleString()}
                            </Td>
                            <Td
                              isNumeric
                              fontSize="xs"
                              color={
                                insp.defect_qty > 0 ? "red.400" : "green.400"
                              }
                              fontWeight="bold"
                            >
                              {insp.defect_qty.toLocaleString()}
                            </Td>
                            <Td isNumeric fontSize="xs">
                              <Badge
                                colorScheme={defectRateColorScheme(
                                  insp.defect_rate
                                )}
                                fontSize="xs"
                              >
                                {insp.defect_rate.toFixed(1)}%
                              </Badge>
                            </Td>
                            <Td fontSize="xs">
                              <Progress
                                value={
                                  data.kpi.total_inspected_qty > 0
                                    ? (insp.inspected_qty /
                                        data.kpi.total_inspected_qty) *
                                      100
                                    : 0
                                }
                                size="xs"
                                colorScheme="blue"
                                w="80px"
                                borderRadius="full"
                              />
                            </Td>
                          </Tr>
                        ))}
                      </Tbody>
                    </Table>
                  </TableContainer>
                </Box>
              )}
            </Box>

            {/* Right: hourly chart + defect category donut */}
            <VStack
              spacing={5}
              align="stretch"
              position={{ lg: "sticky" }}
              top={{ lg: "80px" }}
            >
              {/* Hourly grouped bar chart */}
              <Box
                bg={cardBg}
                border="1px solid"
                borderColor={border}
                borderRadius="xl"
                p={5}
                shadow="sm"
              >
                <Text
                  fontWeight="semibold"
                  fontSize="xs"
                  color="gray.500"
                  textTransform="uppercase"
                  letterSpacing="widest"
                  mb={5}
                >
                  {t("vlAssemblyDailyInspectionReport.hourlyTitle")}
                </Text>
                {data.hourly_breakdown.length === 0 ? (
                  <Center h="160px">
                    <Text color="gray.400" fontSize="sm">
                      {t("vlAssemblyDailyInspectionReport.noData")}
                    </Text>
                  </Center>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart
                      data={data.hourly_breakdown}
                      margin={{ top: 4, right: 4, left: -16, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke={gridLine} />
                      <XAxis
                        dataKey="hour_label"
                        tick={{ fontSize: 10, fill: tickColor }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fontSize: 10, fill: tickColor }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <RechartsTooltip
                        contentStyle={{
                          background: tooltipBg,
                          border: `1px solid ${gridLine}`,
                          borderRadius: "8px",
                          fontSize: "12px"
                        }}
                      />
                      <Legend
                        wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }}
                      />
                      <Bar
                        dataKey="inspected_qty"
                        name={t("vlAssemblyDailyInspectionReport.inspectedQty")}
                        fill="#4299E1"
                        radius={[3, 3, 0, 0]}
                      />
                      <Bar
                        dataKey="defect_qty"
                        name={t("vlAssemblyDailyInspectionReport.defectQty")}
                        fill="#FC8181"
                        radius={[3, 3, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </Box>

              {/* Defect category donut */}
              <DefectCategoryPieChart
                data={data.by_defect_category}
                totalDefect={data.kpi.total_defect_qty}
              />
            </VStack>
          </Grid>
        </>
      )}
    </Box>
  );
}
