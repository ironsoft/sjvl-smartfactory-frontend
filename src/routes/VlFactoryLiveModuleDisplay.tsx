import {
  Badge,
  Box,
  Button,
  Center,
  Flex,
  HStack,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  NumberDecrementStepper,
  NumberIncrementStepper,
  NumberInput,
  NumberInputField,
  NumberInputStepper,
  Progress,
  Spinner,
  Text,
  VStack,
  useColorModeValue,
  useDisclosure,
  useToast,
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
  createVlModuleDailyOutput,
  getVlFactoryLiveScheduleDetail,
  type VlLiveModuleInstance,
} from "../api";
import VlHourlyBarChart from "../components/VlHourlyBarChart";
import { hourlyStats, pctColor, pctTextColor } from "./VlFactoryLive";


// ── 모듈 인스턴스별 QR 카드 ──────────────────────────────────────────────────
function ModuleInstanceQr({ instance }: { instance: VlLiveModuleInstance }) {
  const [qrDataUrl, setQrDataUrl] = useState("");
  const url = `${window.location.origin}/vl-assembly-production/module-daily-outputs?vl_assembly_module=${instance.pk}`;
  const labelColor = useColorModeValue("gray.600", "gray.300");
  const borderColor = useColorModeValue("gray.200", "gray.600");

  useEffect(() => {
    QRCode.toDataURL(url, { margin: 1, width: 120 })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(""));
  }, [url]);

  return (
    <Box border="1px solid" borderColor={borderColor} borderRadius="xl" p={4} textAlign="center">
      <Text fontSize="xs" fontWeight="bold" color="purple.500" mb={2}>{instance.sj_no}</Text>
      {qrDataUrl ? (
        <Box bg="white" p={2} borderRadius="lg" display="inline-block" mb={2}>
          <Box as="img" src={qrDataUrl} alt="QR" w="120px" h="120px" display="block" />
        </Box>
      ) : (
        <Spinner size="sm" />
      )}
      <Text fontSize="xs" color={labelColor}>
        {instance.output_qty.toLocaleString()} / {instance.total_qty.toLocaleString()}
      </Text>
    </Box>
  );
}

// ── 직접 입력 모달 ────────────────────────────────────────────────────────────
function DirectInputModal({
  isOpen,
  onClose,
  instances,
  onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  instances: VlLiveModuleInstance[];
  onSuccess: () => void;
}) {
  const { t } = useTranslation();
  const [selectedPk, setSelectedPk] = useState<number | null>(instances[0]?.pk ?? null);
  const [qty, setQty] = useState(0);
  const toast = useToast();

  useEffect(() => {
    if (instances.length > 0 && selectedPk === null) setSelectedPk(instances[0].pk);
  }, [instances, selectedPk]);

  const mutation = useMutation({
    mutationFn: (q: number) =>
      createVlModuleDailyOutput({ vl_assembly_module: selectedPk!, qty: q }),
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
        <ModalHeader>{t("vlFactoryLive.monitor.modalTitleModule")}</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          {instances.length > 1 && (
            <Box mb={4}>
              <Text fontSize="sm" mb={2} fontWeight="medium">{t("vlFactoryLive.monitor.selectSjNo")}</Text>
              <Flex gap={2} wrap="wrap">
                {instances.map((inst) => (
                  <Button
                    key={inst.pk}
                    size="sm"
                    colorScheme={selectedPk === inst.pk ? "blue" : "gray"}
                    variant={selectedPk === inst.pk ? "solid" : "outline"}
                    onClick={() => setSelectedPk(inst.pk)}
                  >
                    {inst.sj_no}
                  </Button>
                ))}
              </Flex>
            </Box>
          )}
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
            isDisabled={qty < 1 || selectedPk === null}
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
export default function VlFactoryLiveModuleDisplay() {
  const { t } = useTranslation();
  const { schedulePk, moduleCode } = useParams<{ schedulePk: string; moduleCode: string }>();
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
  const mod = schedule?.modules_by_code.find((m) => m.code === moduleCode) ?? null;

  const stats = hourlyStats(mod?.hourly, mod?.target_qty_per_hour ?? null);
  const pct = mod && mod.total_qty > 0 ? Math.min((mod.output_qty / mod.total_qty) * 100, 100) : 0;
  const color = pctColor(pct);
  const target = mod?.target_qty_per_hour ?? null;

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

  if (!schedule || !mod) {
    return (
      <Center minH="100vh" bg={bgPage}>
        <Text color="gray.500">{t("vlFactoryLive.monitor.moduleNotFound")}</Text>
      </Center>
    );
  }

  return (
    <Box minH="100vh" bg={bgPage}>
      <Helmet>
        <title>
          {schedule.style_code || schedule.style_name} — Module {moduleCode} 현황
        </title>
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
          <Box>
            <Text fontWeight="bold" fontSize="lg" lineHeight={1.2}>
              {schedule.style_code || schedule.style_name}
            </Text>
            <Text fontSize="sm" color={labelColor}>{schedule.po_no}</Text>
          </Box>
          <Badge colorScheme="orange" fontSize="sm" px={2} py={0.5}>
            MODULE {moduleCode}
          </Badge>
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
                <Text fontSize="sm" color={labelColor} fontWeight="medium" mb={1}>{t("vlFactoryLive.monitor.cumulativeModule")}</Text>
                <HStack align="baseline" spacing={2}>
                  <Text fontSize="5xl" fontWeight="black" color={`${color}.500`} lineHeight={1}>
                    {mod.output_qty.toLocaleString()}
                  </Text>
                  <Text fontSize="2xl" color={labelColor}>/ {mod.total_qty.toLocaleString()}</Text>
                </HStack>
              </Box>
              <Box textAlign="right">
                <Text fontSize="xs" color={labelColor} mb={1}>{t("vlFactoryLive.monitor.achievement")}</Text>
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
                value: (mod.total_qty - mod.output_qty).toLocaleString(),
                sub: undefined,
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
                  <Box w={3} h={0.5} bg="red.400" />
                  <Text fontSize="xs" color="red.400">{t("vlFactoryLive.monitor.avgTarget", { target })}</Text>
                </HStack>
              )}
            </Flex>
            <VlHourlyBarChart hourly={mod.hourly} target={target} barAreaH={200} />
          </Box>
        </VStack>

        {/* ── 오른쪽: QR + 직접 입력 ── */}
        <VStack spacing={4} w={{ base: "100%", lg: "300px" }} flexShrink={0}>
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
            {mod.instances.length === 0 ? (
              <Text fontSize="sm" color={labelColor} textAlign="center">{t("vlFactoryLive.monitor.noModuleInstance")}</Text>
            ) : mod.instances.length === 1 ? (
              <ModuleInstanceQr instance={mod.instances[0]} />
            ) : (
              <VStack spacing={3}>
                {mod.instances.map((inst) => (
                  <ModuleInstanceQr key={inst.pk} instance={inst} />
                ))}
              </VStack>
            )}
            <Box mt={4} pt={4} borderTop="1px solid" borderColor={borderColor}>
              {isLoggedIn ? (
                <Button
                  w="100%"
                  colorScheme="orange"
                  leftIcon={<FiZap />}
                  onClick={onOpen}
                  size="lg"
                  isDisabled={mod.instances.length === 0}
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
        </VStack>
      </Flex>

      <DirectInputModal
        isOpen={isOpen}
        onClose={onClose}
        instances={mod.instances}
        onSuccess={handleSuccess}
      />
    </Box>
  );
}
