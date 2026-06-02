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
import { getAluminumMolds, IAluminumMoldListResponse, aluminumMoldLightOn, getAluminumMoldPhotos, getSjStylePhotos, IFilePhotos } from "../api";
import SearchInput from "../components/SearchInput";
import { RiFlashlightFill } from "react-icons/ri";
import { Link as RouterLink } from "react-router-dom";
import { FaPlus, FaChevronLeft, FaChevronRight } from "react-icons/fa";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

interface IAluminumMoldLocation {
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

interface IAluminumMold {
  id?: string;
  name?: string;
  serial_number?: string;
  description?: string;
  status?: string;
  status_display?: string;
  location?: number | null;
  location_detail?: IAluminumMoldLocation | null;
  sj_style?: number | null;
  sj_style_detail?: ISjStyleDetail | null;
  created_at?: string;
  updated_at?: string;
}

function SjStylePhotoCell({ stylePk, styleCode }: { stylePk: number; styleCode: string }) {
  const { data: photos, isLoading } = useQuery<IFilePhotos[]>({
    queryKey: ["sjStylePhotos", stylePk],
    queryFn: () => getSjStylePhotos(stylePk),
    enabled: !!stylePk,
  });

  const thumbnail = photos?.filter((p) => p.description !== "QR Code")[0];

  if (isLoading) return <Skeleton w="40px" h="40px" borderRadius="md" />;
  if (!thumbnail) return null;

  return (
    <Link as={RouterLink} to={`/sjstyles/${stylePk}`}>
      <Image
        src={thumbnail.file}
        alt={styleCode}
        boxSize="40px"
        objectFit="cover"
        borderRadius="md"
        _hover={{ opacity: 0.8, transform: "scale(1.05)", transition: "all 0.2s" }}
      />
    </Link>
  );
}

function AluminumMoldPhotoCell({ aluminumMoldId }: { aluminumMoldId: string }) {
  const { data: photos, isLoading } = useQuery<IFilePhotos[]>({
    queryKey: ["aluminumMoldPhotos", aluminumMoldId],
    queryFn: () => getAluminumMoldPhotos(aluminumMoldId),
    enabled: !!aluminumMoldId
  });

  const photosOnly = photos?.filter((p) => p.description !== "QR Code") ?? [];

  if (isLoading) return <Skeleton w="50px" h="50px" borderRadius="md" />;
  if (photosOnly.length === 0) return <Text color="gray.400">-</Text>;

  return (
    <Link as={RouterLink} to={`/aluminum-molds/${aluminumMoldId}`}>
      <Image
        src={photosOnly[0].file}
        alt="aluminum mold photo"
        boxSize="50px"
        objectFit="cover"
        borderRadius="md"
        _hover={{ opacity: 0.8, transform: "scale(1.05)", transition: "all 0.2s" }}
      />
    </Link>
  );
}

export default function AluminumMoldList() {
  const { t } = useTranslation();
  const tableBgColor = useColorModeValue("gray.50", "gray.800");
  const pageBg = useColorModeValue("gray.50", "gray.900");
  const toast = useToast();
  const queryClient = useQueryClient();
  const [timers, setTimers] = useState<Record<string, number>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  const { data, isLoading, isFetching, error } = useQuery<IAluminumMoldListResponse>({
    queryKey: ["aluminumMolds", searchQuery, currentPage],
    queryFn: () => getAluminumMolds({ search: searchQuery, page: currentPage })
  });

  const totalPages = data?.total_pages ?? 1;

  const lightOnMutation = useMutation({
    mutationFn: aluminumMoldLightOn,
    onSuccess: (_data, id) => {
      if (id) {
        setTimers((prev) => ({ ...prev, [id]: 30 }));
      }
      toast({
        title: "Light ON",
        description: "Light is On",
        status: "success",
        duration: 2000,
        isClosable: true,
        position: "bottom-right"
      });
      queryClient.invalidateQueries({ queryKey: ["aluminumMolds"] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: t("aluminumMoldList.lightError"),
        status: "error",
        duration: 2000,
        isClosable: true,
        position: "bottom-right"
      });
    }
  });

  const onLightOn = (id: string) => {
    if (!id) return;
    lightOnMutation.mutate(id);
  };

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
    ? error instanceof Error ? error.message : t("aluminumMoldList.fetchError")
    : null;

  const items: IAluminumMold[] = (() => {
    if (!data) return [];
    if (Array.isArray(data)) return data;
    if (data && typeof data === "object" && "jigs" in data) {
      const list = (data as { jigs: unknown }).jigs;
      return Array.isArray(list) ? (list as IAluminumMold[]) : [];
    }
    if (data && typeof data === "object" && "results" in data) {
      const list = (data as { results: unknown }).results;
      return Array.isArray(list) ? (list as IAluminumMold[]) : [];
    }
    return [];
  })();

  return (
    <>
      <Helmet>
        <title>Aluminum Mold List</title>
      </Helmet>

      <Box
        bg={pageBg}
        minW="100%"
        minH="100%"
        px={{ base: "4", md: "8", lg: "12" }}
        py={{ base: "6", md: "8", lg: "8" }}
      >
      <Box maxW={{ base: "3xl", lg: "8xl" }} mx="auto">
        <HStack justify="space-between" align="center" mb={"5"}>
          <Heading size={"md"}>{t("aluminumMoldList.title")}</Heading>
          <SearchInput
            onSearch={(q) => { setSearchQuery(q); setCurrentPage(1); }}
            onInputChange={(v) => { if (v === "") { setSearchQuery(""); setCurrentPage(1); } }}
          />
        </HStack>
        <Stat mb={"5"}>
          <StatLabel>{t("aluminumMoldList.total")}</StatLabel>
          <StatNumber>{data?.total_results ?? items.length}</StatNumber>
        </Stat>
        <HStack justify="flex-end" mt={6} mb={4} spacing={2}>
          <Button
            as={RouterLink}
            to="/aluminum-molds/locations"
            variant="outline"
            size="sm"
          >
            {t("aluminumMoldList.location")}
          </Button>
          <Button
            as={RouterLink}
            to="/aluminum-molds/upload"
            leftIcon={<FaPlus />}
            variant="ghost"
            size="sm"
          >
            {t("aluminumMoldList.addItem")}
          </Button>
        </HStack>
        <TableContainer>
          <Table variant="striped">
            <Thead bgColor={tableBgColor}>
              <Tr>
                <Th>{t("aluminumMoldList.colPhoto")}</Th>
                <Th>{t("aluminumMoldList.colName")}</Th>
                <Th>{t("aluminumMoldList.colSerialNumber")}</Th>
                <Th>{t("aluminumMoldList.colStatus")}</Th>
                <Th>{t("aluminumMoldList.colLocation")}</Th>
                <Th>SJ Style</Th>
                <Th isNumeric>{t("aluminumMoldList.colLight")}</Th>
              </Tr>
            </Thead>
            <Tbody>
              {(isLoading || isFetching) && items.length === 0 && (
                <Tr><Td colSpan={7}><Center py={6}><Spinner size="md" /></Center></Td></Tr>
              )}
              {errorMessage && (
                <Tr><Td colSpan={7}><Text color="red.500" textAlign="center">{errorMessage}</Text></Td></Tr>
              )}
              {!isLoading && !isFetching && !errorMessage && items.length === 0 && (
                <Tr><Td colSpan={7}><Text color="gray.400" textAlign="center">No results found.</Text></Td></Tr>
              )}
              {items.map((item, index) => (
                <Tr key={item.id ?? index}>
                  <Td>
                    {item.id ? <AluminumMoldPhotoCell aluminumMoldId={item.id} /> : <Text color="gray.400">-</Text>}
                  </Td>
                  <Td>
                    <Link
                      as={RouterLink}
                      to={`/aluminum-molds/${item.id ?? index + 1}`}
                      color="blue.500"
                    >
                      {item.name ?? `Aluminum Mold ${index + 1}`}
                    </Link>
                  </Td>
                  <Td>
                    {item.serial_number ? item.serial_number : <Text color="gray.400">-</Text>}
                  </Td>
                  <Td>
                    {item.status_display ? <Text>{item.status_display}</Text> : "-"}
                  </Td>
                  <Td>
                    {(() => {
                      const detail = item.location_detail;
                      if (!detail) return item.location ?? "-";
                      return <Text>{detail.code ?? "-"}</Text>;
                    })()}
                  </Td>
                  <Td>
                    {item.sj_style_detail ? (
                      <HStack spacing={2} align="center">
                        <SjStylePhotoCell
                          stylePk={item.sj_style_detail.pk}
                          styleCode={item.sj_style_detail.code}
                        />
                        <Link
                          as={RouterLink}
                          to={`/sjstyles/${item.sj_style_detail.pk}`}
                          color="blue.500"
                          fontWeight="semibold"
                          fontSize="sm"
                        >
                          {item.sj_style_detail.code}
                        </Link>
                      </HStack>
                    ) : (
                      <Text color="gray.400">-</Text>
                    )}
                  </Td>
                  <Td isNumeric>
                    {(() => {
                      const key = item.id?.toString() ?? "";
                      const remaining = key ? (timers[key] ?? 0) : 0;
                      const isCounting = remaining > 0;
                      return (
                        <Button
                          size="sm"
                          leftIcon={<RiFlashlightFill />}
                          colorScheme="yellow"
                          variant="outline"
                          isDisabled={isCounting}
                          onClick={() => onLightOn(key)}
                        >
                          {isCounting ? `${remaining}s` : t("aluminumMoldList.lightOn")}
                        </Button>
                      );
                    })()}
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </TableContainer>

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
    </>
  );
}
