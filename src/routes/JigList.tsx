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
  Image,
  Skeleton,
  VStack,
  Select
} from "@chakra-ui/react";
import { useQuery } from "@tanstack/react-query";
import { Helmet } from "react-helmet";
import { getJigs, IJigListResponse, getJigPhotos, getSjStylePhotos, IFilePhotos } from "../api";
import SearchInput from "../components/SearchInput";
import { Link as RouterLink } from "react-router-dom";
import { FaPlus, FaChevronLeft, FaChevronRight } from "react-icons/fa";
import { useState } from "react";
import { useTranslation } from "react-i18next";

interface IJigLocation {
  id?: number;
  code?: string;
  zone?: string;
  shelf?: string;
  slot?: number | string;
  description?: string;
}

interface ISjStyleDetail {
  pk: number;
  code: string;
  style_name: string;
}

interface IJig {
  id?: string;
  name?: string;
  serial_number?: string;
  description?: string;
  buyer?: string;
  shape?: string;
  shape_display?: string;
  size?: string;
  material?: string;
  material_display?: string;
  status?: string;
  status_display?: string;
  location?: number | null;
  location_detail?: IJigLocation | null;
  sj_style?: number | null;
  sj_style_detail?: ISjStyleDetail | null;
  manufactured_date?: string | null;
  handed_over_at?: string | null;
  handed_over_by?: string;
  handed_over_dept?: string;
  returned_at?: string | null;
  returned_by?: string;
  returned_dept?: string;
  memo?: string;
  created_at?: string;
  updated_at?: string;
}

function JigPhotoCell({ jigId }: { jigId: string }) {
  const { data: photos, isLoading } = useQuery<IFilePhotos[]>({
    queryKey: ["jigPhotos", jigId],
    queryFn: () => getJigPhotos(jigId),
    enabled: !!jigId
  });

  /** QR 라벨용 이미지는 썸네일에서 제외 (JigDetail과 동일) */
  const jigPhotosOnly = photos?.filter((p) => p.description !== "QR Code") ?? [];

  if (isLoading) return <Skeleton w="36px" h="36px" borderRadius="md" />;
  if (jigPhotosOnly.length === 0) return <Text color="gray.400">-</Text>;

  return (
    <Link as={RouterLink} to={`/jigs/${jigId}`}>
      <Image
        src={jigPhotosOnly[0].file}
        alt="jig photo"
        boxSize="36px"
        objectFit="cover"
        borderRadius="md"
        _hover={{ opacity: 0.8, transform: "scale(1.05)", transition: "all 0.2s" }}
      />
    </Link>
  );
}

function SjStylePhotoCell({ stylePk, styleCode }: { stylePk: number; styleCode: string }) {
  const { data: photos, isLoading } = useQuery<IFilePhotos[]>({
    queryKey: ["sjStylePhotos", stylePk],
    queryFn: () => getSjStylePhotos(stylePk),
    enabled: !!stylePk,
  });
  const thumbnail = photos?.filter((p) => p.description !== "QR Code")[0];
  if (isLoading) return <Skeleton w="32px" h="32px" borderRadius="md" />;
  if (!thumbnail) return null;
  return (
    <Link as={RouterLink} to={`/sjstyles/${stylePk}`}>
      <Image src={thumbnail.file} alt={styleCode} boxSize="32px" objectFit="cover" borderRadius="md"
        _hover={{ opacity: 0.8, transform: "scale(1.05)", transition: "all 0.2s" }} />
    </Link>
  );
}

export default function JigList() {
  const { t } = useTranslation();
  const tableBgColor = useColorModeValue("gray.50", "gray.800");
  const pageBg = useColorModeValue("gray.50", "gray.900");
  const cardBg = useColorModeValue("white", "gray.800");
  const borderColor = useColorModeValue("gray.200", "gray.600");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [activeFilter, setActiveFilter] = useState<"" | "handed_over" | "returned" | "not_returned">("");
  const [statusFilter, setStatusFilter] = useState("");
  const [shapeFilter, setShapeFilter] = useState("");
  const [materialFilter, setMaterialFilter] = useState("");

  const { data, isLoading, isFetching, error } = useQuery<IJigListResponse>({
    queryKey: ["jigs", searchQuery, currentPage, activeFilter, statusFilter, shapeFilter, materialFilter],
    queryFn: () => getJigs({ search: searchQuery, page: currentPage, filter: activeFilter, status: statusFilter, shape: shapeFilter, material: materialFilter })
  });

  const totalPages = data?.total_pages ?? 1;



  const errorMessage = error
    ? error instanceof Error ? error.message : t("jigList.fetchError")
    : null;

  // 데이터 형식 변환
  const jigs: IJig[] = (() => {
    if (!data) return [];
    if (Array.isArray(data)) return data;
    if (data && typeof data === "object" && "jigs" in data) {
      const list = (data as { jigs: unknown }).jigs;
      return Array.isArray(list) ? (list as IJig[]) : [];
    }
    if (data && typeof data === "object" && "results" in data) {
      const list = (data as { results: unknown }).results;
      return Array.isArray(list) ? (list as IJig[]) : [];
    }
    return [];
  })();

  return (
    <>
      {/* 헬멧 */}
      <Helmet>
        <title>Jig List</title>
      </Helmet>

      {/* 박스 */}
      <Box
        bg={pageBg}
        minW="100%"
        minH="100%"
        px={{ base: "4", md: "8", lg: "12" }}
        py={{ base: "6", md: "8", lg: "8" }}
      >
      <Box
        w="100%"
        mx="auto"
      >
        {/* 헤딩 */}
        <HStack justify="space-between" align="center" mb={"5"}>
          <Heading size={"md"}>{t("jigList.title")}</Heading>
          <SearchInput
            onSearch={(q) => { setSearchQuery(q); setCurrentPage(1); }}
            onInputChange={(v) => { if (v === "") { setSearchQuery(""); setCurrentPage(1); } }}
          />
        </HStack>
        {/* KPI 카드 */}
        <HStack spacing={4} mb={5} flexWrap="wrap">
          {[
            { label: t("jigList.totalJig"), value: data?.kpi?.total ?? data?.total_results ?? jigs.length, filter: "" as const, colorScheme: "gray" },
            { label: t("jigList.kpiHandedOver"), value: data?.kpi?.handed_over ?? 0, filter: "handed_over" as const, colorScheme: "orange" },
            { label: t("jigList.kpiReturned"), value: data?.kpi?.returned ?? 0, filter: "returned" as const, colorScheme: "green" },
            { label: t("jigList.kpiNotReturned"), value: data?.kpi?.not_returned ?? 0, filter: "not_returned" as const, colorScheme: "red" },
          ].map((kpi) => (
            <Stat
              key={kpi.filter}
              p={3}
              bg={activeFilter === kpi.filter ? `${kpi.colorScheme}.100` : cardBg}
              borderWidth="1px"
              borderColor={activeFilter === kpi.filter ? `${kpi.colorScheme}.400` : borderColor}
              borderRadius="lg"
              cursor="pointer"
              minW="120px"
              onClick={() => { setActiveFilter(activeFilter === kpi.filter ? "" : kpi.filter); setCurrentPage(1); }}
              _hover={{ borderColor: `${kpi.colorScheme}.400` }}
            >
              <StatLabel fontSize="xs">{kpi.label}</StatLabel>
              <StatNumber fontSize="xl" color={activeFilter === kpi.filter ? `${kpi.colorScheme}.600` : undefined}>{kpi.value}</StatNumber>
            </Stat>
          ))}
        </HStack>
        {/* 버튼 영역 */}
        <HStack justify="flex-end" mt={6} mb={4} spacing={2}>
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open("/jigs/locations", "_blank")}
          >
            {t("jigList.location")}
          </Button>
          <Button
            as={RouterLink}
            to="/jigs/upload"
            leftIcon={<FaPlus />}
            variant="ghost"
            size="sm"
          >
            {t("jigList.addJig")}
          </Button>
        </HStack>
        {/* 테이블 */}
        <TableContainer overflowX="auto" w="100%">
          <Table variant="striped" size="sm">
            <Thead bgColor={tableBgColor}>
              <Tr>
                <Th fontSize="xs" px={2} py={2}>{t("jigList.colPhoto")}</Th>
                <Th fontSize="xs" px={2} py={2}>{t("jigList.colName")}</Th>
                <Th fontSize="xs" px={2} py={2}>{t("jigList.colSerialNumber")}</Th>
                <Th fontSize="xs" px={2} py={2}>{t("jigList.colBuyer")}</Th>
                <Th fontSize="xs" px={2} py={2}>
                  <VStack spacing={1} align="start">
                    <Text>{t("jigList.colShape")}</Text>
                    <Select size="xs" value={shapeFilter} onChange={(e) => { setShapeFilter(e.target.value); setCurrentPage(1); }} minW="80px">
                      <option value="">All</option>
                      <option value="bar">Bar</option>
                      <option value="square">Square</option>
                      <option value="platen">Platen</option>
                      <option value="other">Other</option>
                    </Select>
                  </VStack>
                </Th>
                <Th fontSize="xs" px={2} py={2}>
                  <VStack spacing={1} align="start">
                    <Text>{t("jigList.colMaterial")}</Text>
                    <Select size="xs" value={materialFilter} onChange={(e) => { setMaterialFilter(e.target.value); setCurrentPage(1); }} minW="80px">
                      <option value="">All</option>
                      <option value="plastic">Plastic</option>
                      <option value="aluminum">Aluminum</option>
                      <option value="Silicon">Silicon</option>
                      <option value="wood">Wood</option>
                      <option value="other">Other</option>
                    </Select>
                  </VStack>
                </Th>
                <Th fontSize="xs" px={2} py={2}>
                  <VStack spacing={1} align="start">
                    <Text>{t("jigList.colStatus")}</Text>
                    <Select size="xs" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }} minW="80px">
                      <option value="">All</option>
                      <option value="in_use">In Use</option>
                      <option value="obsolete">Obsolete</option>
                      <option value="removed">Removed</option>
                      <option value="lost">Lost</option>
                    </Select>
                  </VStack>
                </Th>
                <Th fontSize="xs" px={2} py={2}>{t("jigList.colLocation")}</Th>
                <Th fontSize="xs" px={2} py={2}>SJ Style</Th>
                <Th fontSize="xs" px={2} py={2}>{t("jigList.colManufacturedDate")}</Th>
                <Th fontSize="xs" px={2} py={2}>{t("jigList.colHandedOverAt")}</Th>
                <Th fontSize="xs" px={2} py={2}>{t("jigList.colHandedOverBy")}</Th>
                <Th fontSize="xs" px={2} py={2}>{t("jigList.colHandedOverDept")}</Th>
                <Th fontSize="xs" px={2} py={2}>{t("jigList.colReturnedAt")}</Th>
                <Th fontSize="xs" px={2} py={2}>{t("jigList.colReturnedBy")}</Th>
                <Th fontSize="xs" px={2} py={2}>{t("jigList.colReturnedDept")}</Th>
                <Th fontSize="xs" px={2} py={2}>{t("jigList.colMemo")}</Th>
              </Tr>
            </Thead>
            <Tbody>
              {/* 로딩 / 에러 / 빈 결과 */}
              {(isLoading || isFetching) && jigs.length === 0 && (
                <Tr><Td colSpan={10}><Center py={6}><Spinner size="md" /></Center></Td></Tr>
              )}
              {errorMessage && (
                <Tr><Td colSpan={10}><Text color="red.500" textAlign="center">{errorMessage}</Text></Td></Tr>
              )}
              {!isLoading && !isFetching && !errorMessage && jigs.length === 0 && (
                <Tr><Td colSpan={10}><Text color="gray.400" textAlign="center">No results found.</Text></Td></Tr>
              )}
              {/* 지그 목록 */}
              {jigs.map((jig, index) => (
                <Tr key={jig.id ?? index} h="44px" sx={{ "& td": { verticalAlign: "middle" } }}>
                  <Td fontSize="xs" px={2} py={1}>
                    {jig.id ? <JigPhotoCell jigId={jig.id} /> : <Text color="gray.400">-</Text>}
                  </Td>
                  <Td fontSize="xs" px={2} py={1}>
                    {/* 지그 이름 */}
                    <Link
                      as={RouterLink}
                      to={`/jigs/${jig.id ?? index + 1}`}
                      color="blue.500"
                    >
                      {jig.name ?? `Jig ${index + 1}`}
                    </Link>
                  </Td>
                  <Td fontSize="xs" px={2} py={1}>
                    {jig.serial_number ? (
                      jig.serial_number
                    ) : (
                      <Text color="gray.400">-</Text>
                    )}
                  </Td>
                  <Td fontSize="xs" px={2} py={1}>{jig.buyer || "-"}</Td>
                  <Td fontSize="xs" px={2} py={1}>{jig.shape_display ?? jig.shape ?? "-"}</Td>
                  <Td fontSize="xs" px={2} py={1}>{jig.material_display ?? jig.material ?? "-"}</Td>
                  {/* 지그 상태 */}
                  <Td fontSize="xs" px={2} py={1}>
                    {jig.status_display ? (
                      <Text>{jig.status_display}</Text>
                    ) : (
                      "-"
                    )}
                  </Td>
                  <Td fontSize="xs" px={2} py={1}>
                    {/* 지그 위치 */}
                    {(() => {
                      const detail = jig.location_detail;
                      if (!detail) return jig.location ?? "-";
                      return <Text>{detail.code ?? "-"}</Text>;
                    })()}
                  </Td>
                  <Td fontSize="xs" px={2} py={1}>
                    {jig.sj_style_detail ? (
                      <HStack spacing={2} align="center">
                        <SjStylePhotoCell stylePk={jig.sj_style_detail.pk} styleCode={jig.sj_style_detail.code} />
                        <Link
                          as={RouterLink}
                          to={`/sjstyles/${jig.sj_style_detail.pk}`}
                          color="blue.500"
                          fontWeight="semibold"
                          fontSize="sm"
                        >
                          {jig.sj_style_detail.code}
                        </Link>
                      </HStack>
                    ) : (
                      <Text color="gray.400">-</Text>
                    )}
                  </Td>
                  <Td fontSize="xs" px={2} py={1}>{jig.manufactured_date ?? "-"}</Td>
                  <Td fontSize="xs" px={2} py={1}>{jig.handed_over_at ?? "-"}</Td>
                  <Td fontSize="xs" px={2} py={1}>{jig.handed_over_by || "-"}</Td>
                  <Td fontSize="xs" px={2} py={1}>{jig.handed_over_dept || "-"}</Td>
                  <Td fontSize="xs" px={2} py={1}>{jig.returned_at ?? "-"}</Td>
                  <Td fontSize="xs" px={2} py={1}>{jig.returned_by || "-"}</Td>
                  <Td fontSize="xs" px={2} py={1}>{jig.returned_dept || "-"}</Td>
                  <Td fontSize="xs" px={2} py={1} maxW="160px" whiteSpace="normal">
                    <Text fontSize="xs" noOfLines={2}>{jig.memo || "-"}</Text>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </TableContainer>

        {/* Pagination */}
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
              .filter((p) =>
                p === 1 ||
                p === totalPages ||
                Math.abs(p - currentPage) <= 2
              )
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
    </>
  );
}
