import {
  Box,
  Button,
  Center,
  Flex,
  FormControl,
  FormLabel,
  Heading,
  HStack,
  IconButton,
  Select,
  Spinner,
  Stack,
  Table,
  TableContainer,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
  useBreakpointValue,
  useColorModeValue,
} from "@chakra-ui/react";
import { useQuery } from "@tanstack/react-query";
import { Helmet } from "react-helmet";
import { Link as RouterLink, useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useEffect, useMemo, useState } from "react";
import { FaChevronLeft, FaChevronRight, FaCog, FaPlus } from "react-icons/fa";
import { getEpInspections, getEpSchedules, type IEpSchedule } from "../api";
import SearchInput from "../components/SearchInput";
import LocalizedDateInput from "../components/LocalizedDateInput";

function defectCategoryLabel(
  c: { code: string; name_ko: string; name_en: string; name_vi: string } | null,
  lang: string
): string {
  if (!c) return "—";
  if (lang === "ko") return c.name_ko || c.code;
  if (lang === "vi") return c.name_vi || c.code;
  return c.name_en || c.code;
}

function formatScheduleLabel(s: IEpSchedule): string {
  const o = s.sj_order_info;
  const bits = [o?.sj_po_number ?? `#${s.pk}`, o?.style_name, o?.color].filter(Boolean);
  const line = s.production_line_name ? ` · ${s.production_line_name}` : "";
  return `${bits.join(" · ")}${line} · EP #${s.pk}`;
}

export default function EpInspectionList() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState("");
  const [scheduleFilter, setScheduleFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const pageBg = useColorModeValue("gray.50", "gray.900");
  const cardBg = useColorModeValue("white", "gray.800");
  const border = useColorModeValue("gray.200", "gray.600");
  const rowHoverBg = useColorModeValue("gray.50", "gray.700");
  const lang = (i18n.language || "en").split("-")[0];

  const epProcess = searchParams.get("ep_process");
  const epModule = searchParams.get("ep_module");
  const epSjNo = searchParams.get("ep_sj_no");

  const epProcessNum =
    epProcess != null && epProcess !== "" ? Number(epProcess) : undefined;
  const epModuleNum =
    epModule != null && epModule !== "" ? Number(epModule) : undefined;
  const epSjNoNum = epSjNo != null && epSjNo !== "" ? Number(epSjNo) : undefined;

  const schedId = scheduleFilter ? Number(scheduleFilter) : undefined;

  const { data: schedules } = useQuery({
    queryKey: ["epSchedules", "inspection-filter"],
    queryFn: () => getEpSchedules({}),
  });

  useEffect(() => {
    setPage(1);
  }, [scheduleFilter, dateFrom, dateTo]);

  const queryKey = useMemo(
    () =>
      [
        "epInspections",
        epProcessNum,
        epModuleNum,
        epSjNoNum,
        schedId,
        dateFrom,
        dateTo,
        searchQuery,
        page,
      ] as const,
    [epProcessNum, epModuleNum, epSjNoNum, schedId, dateFrom, dateTo, searchQuery, page]
  );

  const { data, isLoading, isError, isFetching, refetch } = useQuery({
    queryKey,
    queryFn: () =>
      getEpInspections({
        ep_process: epProcessNum,
        ep_module: epModuleNum,
        ep_sj_no: epSjNoNum,
        schedule: Number.isFinite(schedId) && (schedId as number) >= 1 ? schedId : undefined,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
        search: searchQuery.trim() || undefined,
        page,
        page_size: 20,
      }),
  });

  const totalPages = data?.total_pages ?? 1;
  const totalResults = data?.total_results ?? 0;
  const rows = data?.results ?? [];

  const searchFullWidth = useBreakpointValue({ base: true, md: false });

  return (
    <Box minH="100vh" bg={pageBg} py={8} px={{ base: 4, md: 10 }}>
      <Helmet>
        <title>{t("epInspection.listTitle")} — SJ EP</title>
      </Helmet>
      <Box maxW="1280px" mx="auto">
        <Flex
          direction={{ base: "column", md: "row" }}
          align={{ base: "stretch", md: "center" }}
          justify={{ base: "flex-start", md: "space-between" }}
          gap={{ base: 4, md: 3 }}
          mb={5}
          w="100%"
        >
          <Heading size="lg" flexShrink={0}>
            {t("epInspection.listTitle")}
          </Heading>
          <SearchInput
            fullWidth={searchFullWidth ?? true}
            placeholder={t("epInspection.searchPlaceholder")}
            onSearch={(q) => {
              setSearchQuery(q);
              setPage(1);
            }}
            onInputChange={(v) => {
              if (v === "") {
                setSearchQuery("");
                setPage(1);
              }
            }}
          />
        </Flex>

        <Flex
          direction={{ base: "column", sm: "row" }}
          flexWrap="wrap"
          gap={2}
          mb={4}
          justify={{ base: "stretch", sm: "flex-end" }}
          align={{ base: "stretch", sm: "center" }}
          w="100%"
        >
          <Button
            as={RouterLink}
            to="/ep-production/inspection-defect-categories"
            variant="outline"
            leftIcon={<FaCog />}
            w={{ base: "100%", sm: "auto" }}
          >
            {t("epInspection.defectCategorySettingsButton")}
          </Button>
          <Button
            as={RouterLink}
            to={`/ep-production/inspections/new${searchParams.toString() ? `?${searchParams.toString()}` : ""}`}
            colorScheme="blue"
            leftIcon={<FaPlus />}
            w={{ base: "100%", sm: "auto" }}
          >
            {t("epInspection.addResult")}
          </Button>
        </Flex>

        <Stack
          direction={{ base: "column", md: "row" }}
          spacing={3}
          mb={4}
          align={{ base: "stretch", md: "flex-end" }}
          flexWrap="wrap"
        >
          <FormControl
            w={{ base: "100%", md: "auto" }}
            maxW={{ base: "100%", md: "min(100%, 420px)" }}
            minW={{ base: "100%", md: "200px" }}
            flex={{ md: "1" }}
          >
            <FormLabel fontSize="xs">{t("ep.dailyOutput.filterSchedule")}</FormLabel>
            <Select
              size="sm"
              value={scheduleFilter}
              onChange={(e) => setScheduleFilter(e.target.value)}
              bg={cardBg}
            >
              <option value="">{t("ep.dailyOutput.allSchedules")}</option>
              {(schedules || []).map((s) => (
                <option key={s.pk} value={s.pk}>
                  {formatScheduleLabel(s)}
                </option>
              ))}
            </Select>
          </FormControl>
          <FormControl w={{ base: "100%", md: "auto" }} maxW={{ base: "100%", md: "200px" }} flexShrink={0}>
            <FormLabel fontSize="xs">{t("ep.dailyOutput.dateFrom")}</FormLabel>
            <LocalizedDateInput
              size="sm"
              value={dateFrom}
              onChange={setDateFrom}
              bg={cardBg}
            />
          </FormControl>
          <FormControl w={{ base: "100%", md: "auto" }} maxW={{ base: "100%", md: "200px" }} flexShrink={0}>
            <FormLabel fontSize="xs">{t("ep.dailyOutput.dateTo")}</FormLabel>
            <LocalizedDateInput
              size="sm"
              value={dateTo}
              onChange={setDateTo}
              bg={cardBg}
            />
          </FormControl>
          <Button
            size="sm"
            variant="outline"
            onClick={() => refetch()}
            isDisabled={isFetching}
            alignSelf={{ base: "stretch", md: "auto" }}
            w={{ base: "100%", md: "auto" }}
          >
            {t("ep.dailyOutput.refresh")}
          </Button>
        </Stack>

        <Text fontSize="sm" color="gray.600" mb={3}>
          {t("epInspection.totalCount", { count: totalResults })}
        </Text>

        <Box bg={cardBg} borderWidth="1px" borderColor={border} borderRadius="md" overflow="hidden">
          {isLoading ? (
            <Center py={16}>
              <Spinner />
            </Center>
          ) : isError ? (
            <Center py={16}>
              <Text color="red.500">{t("epInspection.loadError")}</Text>
            </Center>
          ) : (
            <TableContainer>
              <Table size="sm" variant="simple">
                <Thead>
                  <Tr>
                    <Th>{t("epInspection.colId")}</Th>
                    <Th>{t("epInspection.colTarget")}</Th>
                    <Th>{t("epInspection.colDefectCategory")}</Th>
                    <Th isNumeric>{t("epInspection.colInspectedQty")}</Th>
                    <Th isNumeric>{t("epInspection.colDefectQty")}</Th>
                    <Th>{t("epInspection.colInspectedAt")}</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {rows.length === 0 ? (
                    <Tr>
                      <Td colSpan={6}>
                        <Text color="gray.500" py={6} textAlign="center">
                          {searchQuery.trim()
                            ? t("epInspection.noSearchResults")
                            : t("epInspection.noRows")}
                        </Text>
                      </Td>
                    </Tr>
                  ) : (
                    rows.map((row) => (
                      <Tr
                        key={row.id}
                        _hover={{ bg: rowHoverBg }}
                        cursor="pointer"
                        onClick={() => navigate(`/ep-production/inspections/${row.id}`)}
                      >
                        <Td>
                          <RouterLink to={`/ep-production/inspections/${row.id}`}>
                            <Text color="blue.500" fontWeight="medium">
                              #{row.id}
                            </Text>
                          </RouterLink>
                        </Td>
                        <Td>
                          <Text fontSize="sm">
                            <Text as="span" color="gray.500" mr={1}>
                              {row.target_kind}
                            </Text>
                            {row.target_label}
                          </Text>
                        </Td>
                        <Td fontSize="sm">{defectCategoryLabel(row.defect_category, lang)}</Td>
                        <Td isNumeric>{row.inspected_qty}</Td>
                        <Td isNumeric>{row.defect_qty}</Td>
                        <Td fontSize="sm" whiteSpace="nowrap">
                          {row.inspected_at?.replace("T", " ").slice(0, 19) ?? "—"}
                        </Td>
                      </Tr>
                    ))
                  )}
                </Tbody>
              </Table>
            </TableContainer>
          )}
        </Box>

        {totalPages > 1 && (
          <HStack justify="center" mt={6} spacing={1} flexWrap="wrap">
            <IconButton
              aria-label={t("ep.dailyOutput.paginationFirst")}
              icon={<FaChevronLeft />}
              size="sm"
              variant="ghost"
              isDisabled={page <= 1 || isFetching}
              onClick={() => setPage(1)}
            />
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter(
                (p) =>
                  p === 1 ||
                  p === totalPages ||
                  Math.abs(p - page) <= 2
              )
              .reduce<(number | "...")[]>((acc, p, idx, arr) => {
                if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push("...");
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
                    variant={page === item ? "solid" : "ghost"}
                    colorScheme={page === item ? "blue" : "gray"}
                    isDisabled={isFetching}
                    onClick={() => setPage(item as number)}
                    minW="32px"
                  >
                    {item}
                  </Button>
                )
              )}
            <IconButton
              aria-label={t("ep.dailyOutput.paginationLast")}
              icon={<FaChevronRight />}
              size="sm"
              variant="ghost"
              isDisabled={page >= totalPages || isFetching}
              onClick={() => setPage(totalPages)}
            />
          </HStack>
        )}
      </Box>
    </Box>
  );
}
