import {
  Avatar,
  Badge,
  Box,
  Center,
  Divider,
  Grid,
  HStack,
  Heading,
  Link,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalHeader,
  ModalOverlay,
  Spinner,
  Text,
  VStack,
  useColorModeValue,
} from "@chakra-ui/react";
import { useQuery } from "@tanstack/react-query";
import { FaExternalLinkAlt } from "react-icons/fa";
import { getWorkerDetail, getWorkerProductionStats, IWorkerDetail } from "../api";
import { formatIsoDateDisplay } from "../lib/dateLocale";
import { openAppPopupWindow } from "../lib/openAppPopupWindow";

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  const labelColor = useColorModeValue("gray.500", "gray.400");
  return (
    <Box>
      <Text fontSize="xs" color={labelColor} fontWeight="semibold" mb={0.5}>
        {label}
      </Text>
      <Text fontSize="sm">{value || "-"}</Text>
    </Box>
  );
}

export default function WorkerDetailModal({
  workerPk,
  onClose,
}: {
  workerPk: number | null;
  onClose: () => void;
}) {
  const sectionBg = useColorModeValue("gray.50", "gray.700");
  const borderColor = useColorModeValue("gray.200", "gray.600");
  const { data: worker, isLoading } = useQuery<IWorkerDetail>({
    queryKey: ["workerDetail", workerPk],
    queryFn: () => getWorkerDetail(workerPk as number),
    enabled: workerPk != null,
  });
  const { data: productionStats = [] } = useQuery({
    queryKey: ["workerProductionStats", workerPk],
    queryFn: () => getWorkerProductionStats(workerPk as number),
    enabled: workerPk != null,
  });

  return (
    <Modal isOpen={workerPk != null} onClose={onClose} isCentered size="lg" scrollBehavior="inside">
      <ModalOverlay />
      <ModalContent maxH="85vh" display="flex" flexDirection="column">
        <ModalHeader pb={2} flexShrink={0}>Worker Detail</ModalHeader>
        <ModalCloseButton />
        <ModalBody pb={6} overflowY="auto">
          {isLoading || !worker ? (
            <Center py={10}>
              <Spinner size="lg" />
            </Center>
          ) : (
            <VStack align="stretch" spacing={4}>
              <HStack align="flex-start" spacing={4}>
                <Avatar size="xl" name={worker.name} src={worker.avatar ?? undefined} />
                <VStack align="stretch" spacing={2} flex={1}>
                  <Heading size="md">{worker.name}</Heading>
                  {worker.nick_name && <Text color="gray.500">{worker.nick_name}</Text>}
                  <HStack spacing={2} flexWrap="wrap">
                    {worker.department_detail && <Badge colorScheme="purple">{worker.department_detail.name}</Badge>}
                    {worker.section_detail && <Badge colorScheme="cyan">{worker.section_detail.name}</Badge>}
                    {worker.position_detail && <Badge colorScheme="blue">{worker.position_detail.name}</Badge>}
                    {worker.line_detail && <Badge colorScheme="teal">{worker.line_detail.name}</Badge>}
                    {worker.job_duties_detail && <Badge colorScheme="green">{worker.job_duties_detail.name}</Badge>}
                    {worker.is_manager && <Badge colorScheme="purple" variant="solid">Line Leader</Badge>}
                    <Badge colorScheme={worker.is_resigned === "resigned" ? "red" : "green"}>
                      {worker.is_resigned === "resigned" ? "Resigned" : "Active"}
                    </Badge>
                  </HStack>
                </VStack>
              </HStack>

              <Divider />

              <Box bg={sectionBg} borderRadius="lg" p={4}>
                <Text fontSize="sm" fontWeight="bold" mb={3}>Work Info</Text>
                <Grid templateColumns="1fr 1fr" gap={4}>
                  <Field label="FACTORY" value={worker.factory_detail?.nickname || worker.factory_detail?.name} />
                  <Field label="DEPARTMENT" value={worker.department_detail?.name} />
                  <Field label="SECTION" value={worker.section_detail?.name} />
                  <Field label="LINE" value={worker.line_detail?.name} />
                  <Field label="POSITION" value={worker.position_detail?.name} />
                  <Field label="RANK" value={worker.rank_detail?.name} />
                  <Field label="JOB DUTIES" value={worker.job_duties_detail?.name} />
                  <Field label="JOB TITLE" value={worker.job_title} />
                  <Field label="INDIRECT" value={worker.is_indirect} />
                  <Field label="LINE LEADER" value={worker.is_manager ? "Line Leader" : "-"} />
                </Grid>
              </Box>

              <Box bg={sectionBg} borderRadius="lg" p={4}>
                <Text fontSize="sm" fontWeight="bold" mb={3}>Career</Text>
                <Grid templateColumns="1fr 1fr" gap={4}>
                  <Field label="COMPANY ID" value={worker.company_id} />
                  <Field label="JOINED FACTORY" value={formatIsoDateDisplay(worker.joined_at_factory, "ko")} />
                  <Field label="START CAREER DATE" value={formatIsoDateDisplay(worker.start_career_date, "ko")} />
                  <Field label="PREVIOUS COMPANY" value={worker.pervieous_company} />
                </Grid>
              </Box>

              <Box bg={sectionBg} borderRadius="lg" p={4}>
                <Text fontSize="sm" fontWeight="bold" mb={3}>Production History</Text>
                {productionStats.length === 0 ? (
                  <Text fontSize="sm" color="gray.400">배정 이력 중 발생한 생산 실적이 없습니다.</Text>
                ) : (
                  <VStack align="stretch" spacing={2}>
                    {productionStats.map((stat) => (
                      <HStack
                        key={stat.sj_no}
                        justify="space-between"
                        borderWidth="1px"
                        borderColor={borderColor}
                        borderRadius="md"
                        px={3}
                        py={2}
                      >
                        <Text fontSize="sm" fontWeight="semibold">{stat.sj_no}</Text>
                        <HStack spacing={1}>
                          <Text fontSize="sm" fontWeight="bold">{stat.qty.toLocaleString()}</Text>
                          <Text fontSize="xs" color="gray.500">pcs</Text>
                        </HStack>
                      </HStack>
                    ))}
                  </VStack>
                )}
              </Box>

              <Link
                onClick={() => openAppPopupWindow(`/workers/${worker.pk}`)}
                fontSize="sm"
                color="blue.500"
                alignSelf="flex-end"
                display="inline-flex"
                alignItems="center"
                gap={1}
                cursor="pointer"
              >
                전체 페이지에서 보기 <FaExternalLinkAlt size={10} />
              </Link>
            </VStack>
          )}
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}
