import {
  Badge,
  Box,
  Center,
  Flex,
  HStack,
  Image,
  Progress,
  Spinner,
  Text,
  VStack,
  useColorModeValue,
  useToast,
  Button,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalCloseButton,
  useDisclosure,
  NumberInput,
  NumberInputField,
  NumberInputStepper,
  NumberIncrementStepper,
  NumberDecrementStepper,
} from "@chakra-ui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Helmet } from "react-helmet";
import { FiLock, FiRefreshCw, FiX, FiZap } from "react-icons/fi";
import { Link as RouterLink, useParams, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import useUser from "../lib/useUser";
import QRCode from "qrcode";
import {
  createVlAssemblyDailyOutput,
  getVlFactoryLiveScheduleDetail,
} from "../api";
import VlHourlyBarChart from "../components/VlHourlyBarChart";
import { hourlyStats, pctColor, pctTextColor } from "./VlFactoryLive";


// ── QR 코드 카드 ─────────────────────────────────────────────────────────────
function AssemblyQrCard({ schedulePk }: { schedulePk: number }) {
  const { t } = useTranslation();
  const [qrDataUrl, setQrDataUrl] = useState("");
  const url = `${window.location.origin}/vl-assembly-production/schedule-daily-outputs?vl_assembly_schedule=${schedulePk}`;

  useEffect(() => {
    QRCode.toDataURL(url, { margin: 1, width: 160 })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(""));
  }, [url]);

  return (
    <VStack spacing={3} align="center">
      {qrDataUrl ? (
        <Box bg="white" p={3} borderRadius="xl" boxShadow="md">
          <Box as="img" src={qrDataUrl} alt="QR" w="160px" h="160px" display="block" />
        </Box>
      ) : (
        <Spinner />
      )}
      <Text fontSize="sm" fontWeight="bold" textAlign="center">
        {t("vlFactoryLive.monitor.qrLabel")}
      </Text>
      <Text fontSize="xs" color="gray.500" textAlign="center">
        {t("vlFactoryLive.monitor.qrScan")}
      </Text>
    </VStack>
  );
}

// ── 직접 입력 모달 ────────────────────────────────────────────────────────────
function DirectInputModal({
  isOpen,
  onClose,
  schedulePk,
  onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  schedulePk: number;
  onSuccess: () => void;
}) {
  const { t } = useTranslation();
  const [qty, setQty] = useState(0);
  const toast = useToast();
  const mutation = useMutation({
    mutationFn: (q: number) => createVlAssemblyDailyOutput({ vl_assembly_schedule: schedulePk, qty: q }),
    onSuccess: () => {
      toast({ title: t("vlFactoryLive.monitor.registerSuccess"), status: "success", duration: 2000, position: "top" });
      setQty(0);
      onClose();
      onSuccess();
    },
    onError: () => {
      toast({ title: t("vlFactoryLive.monitor.registerFailed"), status: "error", duration: 3000, position: "top" });
    },
  });

  return (
    <Modal isOpen={isOpen} onClose={onClose} isCentered size="sm">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>{t("vlFactoryLive.monitor.modalTitleAssembly")}</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <Text mb={2} fontSize="sm" color="gray.600">{t("vlFactoryLive.monitor.enterQty")}</Text>
          <NumberInput value={qty} min={1} onChange={(_, v) => setQty(isNaN(v) ? 0 : v)}>
            <NumberInputField autoFocus fontSize="xl" />
            <NumberInputStepper>
              <NumberIncrementStepper />
              <NumberDecrementStepper />
            </NumberInputStepper>
          </NumberInput>
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" mr={3} onClick={onClose}>{t("vlFactoryLive.monitor.cancel")}</Button>
          <Button
            colorScheme="blue"
            isLoading={mutation.isPending}
            isDisabled={qty < 1}
            onClick={() => mutation.mutate(qty)}
          >
            {t("vlFactoryLive.monitor.register")}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

// ── 메인 페이지 ──────────────────────────────────────────────────────────────
export default function VlFactoryLiveAssemblyDisplay() {
  const { t } = useTranslation();
  const { schedulePk } = useParams<{ schedulePk: string }>();
  const pk = Number(schedulePk);
  const today = new Date().toISOString().slice(0, 10);
  const [searchParams] = useSearchParams();
  const date = searchParams.get("date") || today;
  const queryClient = useQueryClient();
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const { isLoggedIn } = useUser();

  const bgPage = useColorModeValue("gray.50", "gray.900");
  const cardBg = useColorModeValue("white", "gray.800");
  const borderColor = useColorModeValue("gray.200", "gray.700");
  const labelColor = useColorModeValue("gray.500", "gray.400");
  const mutedText = useColorModeValue("gray.400", "gray.500");
  const sjNoBg = useColorModeValue("purple.50", "purple.900");

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["vl-factory-live-schedule-detail", pk, date],
    queryFn: () => getVlFactoryLiveScheduleDetail(pk, date),
    refetchInterval: 30_000,
    retry: false,
  });

  useEffect(() => {
    if (!isFetching) setLastRefreshed(new Date());
  }, [isFetching]);

  const schedule = data?.schedule ?? null;
  const stats = hourlyStats(schedule?.hourly, schedule?.assembly_target_qty_per_hour ?? null);
  const pct = schedule?.progress_pct ?? 0;
  const color = pctColor(pct);
  const target = schedule?.assembly_target_qty_per_hour ?? null;

  // EF D-Day
  let dday: { label: string; color: string } | null = null;
  if (schedule?.ex_factory_date) {
    const today_ = new Date(); today_.setHours(0, 0, 0, 0);
    const ef = new Date(schedule.ex_factory_date); ef.setHours(0, 0, 0, 0);
    const diff = Math.round((ef.getTime() - today_.getTime()) / 86400000);
    dday = {
      label: diff === 0 ? "D-Day" : diff > 0 ? `D-${diff}` : `D+${Math.abs(diff)}`,
      color: diff < 0 ? "red.500" : diff <= 7 ? "orange.500" : "gray.500",
    };
  }

  const handleSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ["vl-factory-live-schedule-detail", pk, date] });
  };

  if (isLoading) {
    return (
      <Center minH="100vh" bg={bgPage}>
        <Spinner size="xl" />
      </Center>
    );
  }

  if (!schedule) {
    return (
      <Center minH="100vh" bg={bgPage}>
        <Text color="gray.500">{t("vlFactoryLive.monitor.notFound")}</Text>
      </Center>
    );
  }

  return (
    <Box minH="100vh" bg={bgPage}>
      <Helmet>
        <title>{schedule.style_code || schedule.style_name} — Assembly 현황</title>
      </Helmet>

      {/* ── 헤더 ── */}
      <Flex
        px={6} py={3}
        bg={cardBg}
        borderBottom="1px solid"
        borderColor={borderColor}
        align="center"
        justify="space-between"
        gap={4}
        position="sticky"
        top={0}
        zIndex={10}
        boxShadow="sm"
      >
        <HStack spacing={3}>
          <Box
            as={RouterLink}
            to={`/vl-factory-live/schedules/${pk}?date=${date}`}
            color={labelColor}
            _hover={{ color: "blue.500" }}
          >
            <FiX size={20} />
          </Box>
          {schedule.thumbnail && (
            <Image src={schedule.thumbnail} alt="" boxSize="36px" borderRadius="md" objectFit="cover" />
          )}
          <Box>
            <Text fontWeight="bold" fontSize="lg" lineHeight={1.2}>
              {schedule.style_code || schedule.style_name}
            </Text>
            <Text fontSize="sm" color={labelColor}>{schedule.po_no}</Text>
          </Box>
          <Badge colorScheme="blue" fontSize="sm" px={2} py={0.5}>ASSEMBLY</Badge>
          {dday && (
            <Text fontWeight="bold" color={dday.color} fontSize="sm">{dday.label}</Text>
          )}
        </HStack>
        <HStack spacing={3}>
          {lastRefreshed && (
            <Text fontSize="xs" color={mutedText}>
              {lastRefreshed.toLocaleTimeString()} {t("vlFactoryLive.monitor.basis")}
            </Text>
          )}
          <Box
            as="button"
            onClick={() => refetch()}
            color={isFetching ? "blue.500" : labelColor}
            _hover={{ color: "blue.500" }}
          >
            <FiRefreshCw size={16} style={{ animation: isFetching ? "spin 1s linear infinite" : "none" }} />
          </Box>
        </HStack>
      </Flex>

      {/* ── 본문 ── */}
      <Flex direction={{ base: "column", lg: "row" }} gap={6} p={6} maxW="1400px" mx="auto">

        {/* ── 왼쪽: 주요 KPI ── */}
        <VStack spacing={4} flex={1} minW={0} align="stretch">

          {/* 진행률 대형 카드 */}
          <Box bg={cardBg} borderRadius="2xl" p={8} border="1px solid" borderColor={borderColor} boxShadow="sm">
            <Flex justify="space-between" align="flex-start" mb={4}>
              <Box>
                <Text fontSize="sm" color={labelColor} fontWeight="medium" mb={1}>{t("vlFactoryLive.monitor.cumulativeOutput")}</Text>
                <HStack align="baseline" spacing={2}>
                  <Text fontSize="5xl" fontWeight="black" color={`${color}.500`} lineHeight={1}>
                    {schedule.assembly_output_qty.toLocaleString()}
                  </Text>
                  <Text fontSize="2xl" color={labelColor}>/ {schedule.total_order_qty.toLocaleString()}</Text>
                </HStack>
              </Box>
              <Box textAlign="right">
                <Text fontSize="xs" color={labelColor} mb={1}>{t("vlFactoryLive.monitor.totalAchievement")}</Text>
                <Text fontSize="5xl" fontWeight="black" color={pctTextColor(pct)} lineHeight={1}>
                  {pct.toFixed(1)}%
                </Text>
              </Box>
            </Flex>
            <Progress value={pct} colorScheme={color} size="lg" borderRadius="full" />
          </Box>

          {/* KPI 그리드 */}
          <Flex gap={4} wrap="wrap">
            {[
              {
                label: t("vlFactoryLive.monitor.avgPerHour"),
                value: stats.slots > 0 ? `${Math.round(stats.avg)}/h` : "-",
                sub: target != null ? t("vlFactoryLive.monitor.avgTarget", { target }) : undefined,
                color: stats.ratePct != null ? pctTextColor(stats.ratePct) : undefined,
              },
              {
                label: t("vlFactoryLive.monitor.avgAchievePct"),
                value: stats.ratePct != null ? `${stats.ratePct.toFixed(0)}%` : "-",
                sub: stats.slots > 0 ? t("vlFactoryLive.monitor.activeSlots", { count: stats.slots }) : undefined,
                color: stats.ratePct != null ? pctTextColor(stats.ratePct) : undefined,
              },
              {
                label: t("vlFactoryLive.monitor.remaining"),
                value: (schedule.total_order_qty - schedule.assembly_output_qty).toLocaleString(),
                sub: dday && (schedule.total_order_qty - schedule.assembly_output_qty) > 0 && dday.label !== "D-Day"
                  ? `EF: ${schedule.ex_factory_date}`
                  : undefined,
                color: undefined,
              },
            ].map((kpi) => (
              <Box
                key={kpi.label}
                flex="1"
                minW="140px"
                bg={cardBg}
                borderRadius="xl"
                p={5}
                border="1px solid"
                borderColor={borderColor}
                boxShadow="sm"
              >
                <Text fontSize="sm" color={labelColor} mb={1}>{kpi.label}</Text>
                <Text fontSize="3xl" fontWeight="black" color={kpi.color} lineHeight={1.1}>
                  {kpi.value}
                </Text>
                {kpi.sub && <Text fontSize="xs" color={labelColor} mt={1}>{kpi.sub}</Text>}
              </Box>
            ))}
          </Flex>

          {/* 시간대 차트 */}
          <Box bg={cardBg} borderRadius="2xl" p={6} border="1px solid" borderColor={borderColor} boxShadow="sm">
            <Flex justify="space-between" align="center" mb={4}>
              <Text fontSize="sm" fontWeight="bold" color={labelColor} textTransform="uppercase" letterSpacing="wider">
                {t("vlFactoryLive.monitor.hourlyOutput")}
              </Text>
              {target != null && (
                <HStack spacing={2}>
                  <Box w={3} h={0.5} bg="red.400" style={{ borderTop: "2px dashed" }} />
                  <Text fontSize="xs" color="red.400">{t("vlFactoryLive.monitor.avgTarget", { target })}</Text>
                </HStack>
              )}
            </Flex>
            <VlHourlyBarChart hourly={schedule.hourly} target={target} barAreaH={200} />
          </Box>
        </VStack>

        {/* ── 오른쪽: QR + 직접 입력 ── */}
        <VStack spacing={4} w={{ base: "100%", lg: "280px" }} flexShrink={0}>
          <Box
            bg={cardBg}
            borderRadius="2xl"
            p={6}
            border="1px solid"
            borderColor={borderColor}
            boxShadow="sm"
            w="100%"
          >
            <Text fontWeight="bold" fontSize="md" mb={4} textAlign="center">{t("vlFactoryLive.monitor.registerOutput")}</Text>
            <AssemblyQrCard schedulePk={pk} />
            <Box mt={4} pt={4} borderTop="1px solid" borderColor={borderColor}>
              {isLoggedIn ? (
                <Button
                  w="100%"
                  colorScheme="blue"
                  leftIcon={<FiZap />}
                  onClick={onOpen}
                  size="lg"
                >
                  {t("vlFactoryLive.monitor.directInput")}
                </Button>
              ) : (
                <Button
                  as={RouterLink}
                  to="/"
                  w="100%"
                  variant="outline"
                  leftIcon={<FiLock size={14} />}
                  size="lg"
                >
                  {t("vlFactoryLive.monitor.loginRequired")}
                </Button>
              )}
            </Box>
          </Box>

          {/* SJ NOS */}
          {(schedule.sj_nos?.length ?? 0) > 0 && (
            <Box
              bg={cardBg}
              borderRadius="2xl"
              p={5}
              border="1px solid"
              borderColor={borderColor}
              boxShadow="sm"
              w="100%"
            >
              <Text fontSize="sm" fontWeight="bold" color={labelColor} mb={3} textTransform="uppercase" letterSpacing="wider">
                SJ Nos
              </Text>
              <VStack spacing={2} align="stretch">
                {schedule.sj_nos.map((sj) => (
                  <Flex
                    key={sj.pk}
                    justify="space-between"
                    align="center"
                    bg={sjNoBg}
                    borderRadius="md"
                    px={3}
                    py={2}
                  >
                    <Text fontSize="xs" fontWeight="bold" color="purple.500">{sj.sj_no}</Text>
                    <Text fontSize="sm" fontWeight="semibold">
                      {sj.output_qty.toLocaleString()}
                      {sj.total_qty != null && (
                        <Text as="span" fontSize="xs" color={labelColor}> / {sj.total_qty.toLocaleString()}</Text>
                      )}
                    </Text>
                  </Flex>
                ))}
              </VStack>
            </Box>
          )}
        </VStack>
      </Flex>

      <DirectInputModal
        isOpen={isOpen}
        onClose={onClose}
        schedulePk={pk}
        onSuccess={handleSuccess}
      />
    </Box>
  );
}
