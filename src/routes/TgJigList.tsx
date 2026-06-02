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
  useToast,
  Link,
  HStack,
  Image,
  Skeleton
} from "@chakra-ui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Helmet } from "react-helmet";
import { getTgJigs, ITgJigListResponse, tgJigLightOn, getTgJigPhotos, IFilePhotos } from "../api";
import SearchInput from "../components/SearchInput";
import { RiFlashlightFill } from "react-icons/ri";
import { Link as RouterLink } from "react-router-dom";
import { FaPlus, FaChevronLeft, FaChevronRight } from "react-icons/fa";
import { useEffect, useState } from "react";
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
  created_at?: string;
  updated_at?: string;
}

function TgJigPhotoCell({ tgJigId }: { tgJigId: string }) {
  const { data: photos, isLoading } = useQuery<IFilePhotos[]>({
    queryKey: ["tgJigPhotos", tgJigId],
    queryFn: () => getTgJigPhotos(tgJigId),
    enabled: !!tgJigId
  });

  /** QR 라벨용 이미지는 썸네일에서 제외 (JigDetail과 동일) */
  const jigPhotosOnly = photos?.filter((p) => p.description !== "QR Code") ?? [];

  if (isLoading) return <Skeleton w="50px" h="50px" borderRadius="md" />;
  if (jigPhotosOnly.length === 0) return <Text color="gray.400">-</Text>;

  return (
    <Link as={RouterLink} to={`/tg-jigs/${tgJigId}`}>
      <Image
        src={jigPhotosOnly[0].file}
        alt="jig photo"
        boxSize="50px"
        objectFit="cover"
        borderRadius="md"
        _hover={{ opacity: 0.8, transform: "scale(1.05)", transition: "all 0.2s" }}
      />
    </Link>
  );
}

export default function TgJigList() {
  const { t } = useTranslation();
  const tableBgColor = useColorModeValue("gray.50", "gray.800");
  const pageBg = useColorModeValue("gray.50", "gray.900");
  const toast = useToast();
  const queryClient = useQueryClient();
  const [timers, setTimers] = useState<Record<string, number>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  const { data, isLoading, isFetching, error } = useQuery<ITgJigListResponse>({
    queryKey: ["tgJigs", searchQuery, currentPage],
    queryFn: () => getTgJigs({ search: searchQuery, page: currentPage })
  });

  const totalPages = data?.total_pages ?? 1;

  // 조명 켜기 뮤테이션
  const tgJigLightOnMutation = useMutation({
    mutationFn: tgJigLightOn,
    onSuccess: (_data, tgJigId) => {
      if (tgJigId) {
        setTimers((prev) => ({
          ...prev,
          [tgJigId]: 30
        }));
      }
      toast({
        title: "Light ON",
        description: "Light is On",
        status: "success",
        duration: 2000,
        isClosable: true,
        position: "bottom-right"
      });
      queryClient.invalidateQueries({ queryKey: ["tgJigs"] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: t("tgJigList.lightError"),
        status: "error",
        duration: 2000,
        isClosable: true,
        position: "bottom-right"
      });
    }
  });

  // 조명 켜기 이벤트 핸들러
  const onJigLightOn = (tgJigId: string) => {
    if (!tgJigId) return;
    tgJigLightOnMutation.mutate(tgJigId);
  };

  // 타이머 갱신 타이머
  useEffect(() => {
    const hasActiveTimer = Object.values(timers).some((value) => value > 0);
    if (!hasActiveTimer) return;

    const intervalId = window.setInterval(() => {
      setTimers((prev) => {
        const next: Record<string, number> = {};
        Object.entries(prev).forEach(([key, value]) => {
          next[key] = value > 0 ? value - 1 : 0;
        });
        return next;
      });
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [timers]);


  const errorMessage = error
    ? error instanceof Error ? error.message : t("tgJigList.fetchError")
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
        maxW={{ base: "3xl", lg: "8xl" }}
        mx="auto"
      >
        {/* 헤딩 */}
        <HStack justify="space-between" align="center" mb={"5"}>
          <Heading size={"md"}>{t("tgJigList.title")}</Heading>
          <SearchInput
            onSearch={(q) => { setSearchQuery(q); setCurrentPage(1); }}
            onInputChange={(v) => { if (v === "") { setSearchQuery(""); setCurrentPage(1); } }}
          />
        </HStack>
        {/* 전체지그수 */}
        <Stat mb={"5"}>
          <StatLabel>{t("tgJigList.totalJig")}</StatLabel>
          <StatNumber>{data?.total_results ?? jigs.length}</StatNumber>
        </Stat>
        {/* 버튼 영역 */}
        <HStack justify="flex-end" mt={6} mb={4} spacing={2}>
          <Button
            as={RouterLink}
            to="/tg-jigs/locations"
            variant="outline"
            size="sm"
          >
            {t("tgJigList.location")}
          </Button>
          <Button
            as={RouterLink}
            to="/tg-jigs/upload"
            leftIcon={<FaPlus />}
            variant="ghost"
            size="sm"
          >
            {t("tgJigList.addJig")}
          </Button>
        </HStack>
        {/* 테이블 */}
        <TableContainer>
          <Table variant="striped">
            <Thead bgColor={tableBgColor}>
              <Tr>
                <Th>{t("tgJigList.colPhoto")}</Th>
                <Th>{t("tgJigList.colName")}</Th>
                <Th>{t("tgJigList.colSerialNumber")}</Th>
                <Th>{t("tgJigList.colBuyer")}</Th>
                <Th>{t("tgJigList.colShape")}</Th>
                <Th>{t("tgJigList.colMaterial")}</Th>
                <Th>{t("tgJigList.colStatus")}</Th>
                <Th>{t("tgJigList.colLocation")}</Th>
                <Th>SJ Style</Th>
                <Th isNumeric>{t("tgJigList.colLight")}</Th>
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
                <Tr key={jig.id ?? index}>
                  <Td>
                    {jig.id ? <TgJigPhotoCell tgJigId={jig.id} /> : <Text color="gray.400">-</Text>}
                  </Td>
                  <Td>
                    {/* 지그 이름 */}
                    <Link
                      as={RouterLink}
                      to={`/tg-jigs/${jig.id ?? index + 1}`}
                      color="blue.500"
                    >
                      {jig.name ?? `Jig ${index + 1}`}
                    </Link>
                  </Td>
                  <Td>
                    {jig.serial_number ? (
                      jig.serial_number
                    ) : (
                      <Text color="gray.400">-</Text>
                    )}
                  </Td>
                  <Td>{jig.buyer || "-"}</Td>
                  <Td>{jig.shape_display ?? jig.shape ?? "-"}</Td>
                  <Td>{jig.material_display ?? jig.material ?? "-"}</Td>
                  {/* 지그 상태 */}
                  <Td>
                    {jig.status_display ? (
                      <Text>{jig.status_display}</Text>
                    ) : (
                      "-"
                    )}
                  </Td>
                  <Td>
                    {/* 지그 위치 */}
                    {(() => {
                      const detail = jig.location_detail;
                      if (!detail) return jig.location ?? "-";
                      return <Text>{detail.code ?? "-"}</Text>;
                    })()}
                  </Td>
                  <Td>
                    {jig.sj_style_detail ? (
                      <Link
                        as={RouterLink}
                        to={`/sjstyles/${jig.sj_style_detail.pk}`}
                        color="blue.500"
                        fontWeight="semibold"
                        fontSize="sm"
                      >
                        {jig.sj_style_detail.code}
                      </Link>
                    ) : (
                      <Text color="gray.400">-</Text>
                    )}
                  </Td>
                  <Td isNumeric>
                    {/* 조명 켜기 버튼 */}
                    {(() => {
                      const key = jig.id?.toString() ?? "";
                      const remaining = key ? (timers[key] ?? 0) : 0;
                      const isCounting = remaining > 0;

                      return (
                        // 조명 켜기 버튼
                        <Button
                          size="sm"
                          leftIcon={<RiFlashlightFill />}
                          colorScheme="yellow"
                          variant="outline"
                          isDisabled={isCounting}
                          onClick={() => onJigLightOn(key)}
                        >
                          {isCounting ? `${remaining}s` : t("tgJigList.lightOn")}
                        </Button>
                      );
                    })()}
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
