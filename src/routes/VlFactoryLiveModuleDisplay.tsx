import {
  Badge,
  Box,
  Button,
  Center,
  Divider,
  Flex,
  HStack,
  Image,
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
  SimpleGrid,
  Spinner,
  Text,
  Tooltip,
  VStack,
  useColorModeValue,
  useDisclosure,
  useToast,
} from "@chakra-ui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Helmet } from "react-helmet";
import { FiLock, FiPrinter, FiRefreshCw, FiX, FiZap } from "react-icons/fi";
import { Link as RouterLink, useParams, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import useUser from "../lib/useUser";
import QRCode from "qrcode";
import {
  createVlModuleDailyOutput,
  getVlFactoryLiveScheduleDetail,
  type VlLiveModule,
  type VlLiveModuleInstance,
  type VlLiveSchedule,
} from "../api";
import VlHourlyBarChart from "../components/VlHourlyBarChart";
import { hourlyStats, pctColor, pctTextColor } from "./VlFactoryLive";


// ── 모듈 인스턴스별 QR 카드 (클릭 → 프린트 모달) ─────────────────────────────
function ModuleInstanceQr({
  instance,
  schedule,
  mod,
  lineName,
}: {
  instance: VlLiveModuleInstance;
  schedule: VlLiveSchedule;
  mod: VlLiveModule;
  lineName: string;
}) {
  const [qrDataUrl, setQrDataUrl] = useState("");
  const url = `${window.location.origin}/vl-assembly-production/module-daily-outputs?vl_assembly_module=${instance.pk}`;
  const labelColor = useColorModeValue("gray.600", "gray.300");
  const borderColor = useColorModeValue("gray.200", "gray.600");
  const { isOpen, onOpen, onClose } = useDisclosure();

  useEffect(() => {
    QRCode.toDataURL(url, { margin: 1, width: 120 })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(""));
  }, [url]);

  return (
    <>
      <Box border="1px solid" borderColor={borderColor} borderRadius="xl" p={4} textAlign="center">
        <Text fontSize="xs" fontWeight="bold" color="purple.500" mb={2}>{instance.sj_no}</Text>
        <Tooltip label="클릭하여 프린트 미리보기" placement="top" hasArrow>
          <Box
            bg="white"
            p={2}
            borderRadius="lg"
            display="inline-block"
            mb={2}
            cursor={qrDataUrl ? "pointer" : "default"}
            onClick={qrDataUrl ? onOpen : undefined}
            transition="transform 0.15s, box-shadow 0.15s"
            _hover={qrDataUrl ? { transform: "scale(1.04)", boxShadow: "md" } : undefined}
            role="button"
            aria-label="Open QR print preview"
          >
            {qrDataUrl ? (
              <Box as="img" src={qrDataUrl} alt="QR" w="120px" h="120px" display="block" />
            ) : (
              <Center w="120px" h="120px"><Spinner size="sm" /></Center>
            )}
          </Box>
        </Tooltip>
        <Text fontSize="xs" color={labelColor}>
          {instance.output_qty.toLocaleString()} / {instance.total_qty.toLocaleString()}
        </Text>
      </Box>

      <ModuleQrPrintModal
        isOpen={isOpen}
        onClose={onClose}
        instance={instance}
        schedule={schedule}
        mod={mod}
        lineName={lineName}
      />
    </>
  );
}

// ── 모듈 QR 프린트 모달 ──────────────────────────────────────────────────────
function ModuleQrPrintModal({
  isOpen,
  onClose,
  instance,
  schedule,
  mod,
  lineName,
}: {
  isOpen: boolean;
  onClose: () => void;
  instance: VlLiveModuleInstance;
  schedule: VlLiveSchedule;
  mod: VlLiveModule;
  lineName: string;
}) {
  const [qrDataUrl, setQrDataUrl] = useState("");
  const url = `${window.location.origin}/vl-assembly-production/module-daily-outputs?vl_assembly_module=${instance.pk}`;

  useEffect(() => {
    if (!isOpen) return;
    QRCode.toDataURL(url, { margin: 1, width: 640 })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(""));
  }, [url, isOpen]);

  const handlePrint = () => window.print();
  const formatDate = (s?: string | null) => (s ? s.replaceAll("-", ".") : "-");

  const instBalance = Math.max(instance.total_qty - instance.output_qty, 0);
  const instPct = instance.total_qty > 0 ? Math.min((instance.output_qty / instance.total_qty) * 100, 100) : 0;
  const modPct = mod.total_qty > 0 ? Math.min((mod.output_qty / mod.total_qty) * 100, 100) : 0;

  const printBody = (
    <Box className="qr-print-area" p={{ base: 4, md: 8 }} bg="white">
      {/* ── 헤더 ── */}
      <Flex justify="space-between" align="flex-start" mb={6} pb={4} borderBottomWidth="2px" borderColor="gray.800">
        <Box>
          <Text fontSize="xs" color="gray.500" fontWeight="bold" letterSpacing="wider" mb={1}>
            VL FACTORY — MODULE PRODUCTION
          </Text>
          <Text fontSize="3xl" fontWeight="black" lineHeight={1.1} mb={1}>
            {schedule.style_code || schedule.style_name}
          </Text>
          <Text fontSize="md" color="gray.700">
            {schedule.style_name}
          </Text>
        </Box>
        <VStack spacing={1} align="flex-end">
          <HStack>
            <Badge colorScheme="orange" fontSize="md" px={3} py={1}>MODULE {mod.code}</Badge>
            <Badge colorScheme="purple" fontSize="md" px={3} py={1}>{instance.sj_no}</Badge>
          </HStack>
          <Text fontSize="sm" fontWeight="bold" color="gray.700">
            {lineName}
          </Text>
          <Text fontSize="xs" color="gray.500">
            Schedule #{schedule.pk} · PO: {schedule.po_no}
          </Text>
        </VStack>
      </Flex>

      {/* ── QR + 사진 + 요약 ── */}
      <Flex gap={5} mb={6} align="stretch" flexWrap={{ base: "wrap", md: "nowrap" }}>
        {/* QR 코드 */}
        <VStack
          spacing={3}
          p={5}
          borderWidth="2px"
          borderColor="gray.800"
          borderRadius="lg"
          bg="white"
          className="qr-print-highlight"
          minW="320px"
          align="center"
          justify="center"
        >
          {qrDataUrl ? (
            <Box as="img" src={qrDataUrl} alt="QR Code" w="280px" h="280px" display="block" />
          ) : (
            <Center w="280px" h="280px"><Spinner /></Center>
          )}
          <Text fontSize="lg" fontWeight="black" textAlign="center">
            SCAN TO REGISTER OUTPUT
          </Text>
          <Text fontSize="xs" color="gray.600" textAlign="center">
            휴대폰 카메라로 스캔하여 모듈 생산 수량을 입력하세요
          </Text>
          <Text fontSize="2xs" color="gray.500" textAlign="center" mt={1}>
            Module {mod.code} · {instance.sj_no}
          </Text>
        </VStack>

        {/* 사진 + 진행률 */}
        <VStack spacing={4} flex={1} minW={0} align="stretch">
          <HStack spacing={4} align="stretch">
            {schedule.thumbnail && (
              <Box
                w="160px"
                h="160px"
                borderWidth="1px"
                borderColor="gray.300"
                borderRadius="lg"
                overflow="hidden"
                bg="white"
                flexShrink={0}
              >
                <Image
                  src={schedule.thumbnail}
                  alt={schedule.style_name}
                  w="100%"
                  h="100%"
                  objectFit="cover"
                />
              </Box>
            )}
            <VStack align="stretch" spacing={1} flex={1} minW={0} justify="center">
              <Text fontSize="xs" color="gray.500" fontWeight="bold" textTransform="uppercase">
                Ex-Factory
              </Text>
              <Text fontSize="xl" fontWeight="black" lineHeight={1}>
                {formatDate(schedule.ex_factory_date)}
              </Text>
              <Text fontSize="xs" color="gray.500" mt={2}>
                Assembly Period
              </Text>
              <Text fontSize="sm" fontWeight="bold">
                {formatDate(schedule.assembly_start)} ~ {formatDate(schedule.assembly_end)}
              </Text>
            </VStack>
          </HStack>

          {/* 인스턴스 (SJ No 단위) 진행률 */}
          <Box borderWidth="1px" borderColor="gray.300" borderRadius="lg" p={4}>
            <Flex justify="space-between" align="baseline" mb={2}>
              <Text fontSize="xs" color="gray.600" fontWeight="bold" textTransform="uppercase">
                {instance.sj_no} · Output
              </Text>
              <Text fontSize="sm" color="gray.500">
                Target {instance.total_qty.toLocaleString()}
              </Text>
            </Flex>
            <HStack align="baseline" spacing={2} mb={2}>
              <Text fontSize="4xl" fontWeight="black" lineHeight={1}>
                {instance.output_qty.toLocaleString()}
              </Text>
              <Text fontSize="lg" color="gray.500">/ {instance.total_qty.toLocaleString()}</Text>
              <Text ml="auto" fontSize="3xl" fontWeight="black">
                {instPct.toFixed(1)}%
              </Text>
            </HStack>
            <Progress
              value={instPct}
              size="md"
              borderRadius="full"
              colorScheme={instPct >= 100 ? "green" : instPct >= 80 ? "blue" : "orange"}
            />
            <Text fontSize="xs" color="gray.600" mt={2}>
              Balance: <strong>{instBalance.toLocaleString()}</strong>
            </Text>
          </Box>
        </VStack>
      </Flex>

      {/* ── 상세 정보 그리드 ── */}
      <SimpleGrid columns={{ base: 2, md: 4 }} spacing={3} mb={6}>
        {[
          { label: "PO No.", value: schedule.po_no || "-" },
          { label: "Style Code", value: schedule.style_code || "-" },
          { label: "Module Code", value: mod.code || "-" },
          { label: "Module Name", value: mod.name || "-" },
          { label: "SJ No", value: instance.sj_no },
          { label: "Line", value: lineName || "-" },
          { label: "Target / Hour", value: mod.target_qty_per_hour != null ? `${mod.target_qty_per_hour.toLocaleString()}/h` : "-" },
          {
            label: "Module Total",
            value: `${mod.output_qty.toLocaleString()} / ${mod.total_qty.toLocaleString()} (${modPct.toFixed(1)}%)`,
          },
        ].map((item) => (
          <Box
            key={item.label}
            borderWidth="1px"
            borderColor="gray.300"
            borderRadius="md"
            px={3}
            py={2}
          >
            <Text fontSize="2xs" color="gray.600" fontWeight="bold" textTransform="uppercase" letterSpacing="wide">
              {item.label}
            </Text>
            <Text fontSize="md" fontWeight="bold" color="gray.900" mt={0.5}>
              {item.value}
            </Text>
          </Box>
        ))}
      </SimpleGrid>

      <Divider mb={3} />
      <Flex justify="space-between" fontSize="2xs" color="gray.500">
        <Text>Printed: {new Date().toLocaleString()}</Text>
        <Text>SJ INNO SYSTEM · VL FACTORY · MODULE {mod.code}</Text>
      </Flex>
    </Box>
  );

  return (
    <>
      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 10mm; }
          html, body {
            background: white !important;
            height: auto !important;
            overflow: visible !important;
          }
          body * { visibility: hidden !important; }
          .qr-print-only-root,
          .qr-print-only-root * { visibility: visible !important; }
          .qr-print-only-root {
            display: block !important;
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            background: white !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .qr-print-only-root .qr-print-highlight {
            background: #f5f5f5 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
        @media screen {
          .qr-print-only-root { display: none !important; }
        }
      `}</style>

      <Modal isOpen={isOpen} onClose={onClose} size="4xl" scrollBehavior="inside">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader borderBottomWidth="1px">QR 프린트 미리보기 · Module {mod.code} · {instance.sj_no}</ModalHeader>
          <ModalCloseButton />
          <ModalBody p={0}>{printBody}</ModalBody>
          <ModalFooter borderTopWidth="1px">
            <Button variant="ghost" mr={3} onClick={onClose}>
              닫기
            </Button>
            <Button colorScheme="blue" leftIcon={<FiPrinter />} onClick={handlePrint}>
              프린트
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {isOpen && (
        <Box className="qr-print-only-root">
          {printBody}
        </Box>
      )}
    </>
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
              <ModuleInstanceQr instance={mod.instances[0]} schedule={schedule} mod={mod} lineName={data?.line_name ?? ""} />
            ) : (
              <VStack spacing={3}>
                {mod.instances.map((inst) => (
                  <ModuleInstanceQr key={inst.pk} instance={inst} schedule={schedule} mod={mod} lineName={data?.line_name ?? ""} />
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
