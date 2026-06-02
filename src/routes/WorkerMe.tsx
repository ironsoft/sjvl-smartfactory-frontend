import {
  Avatar,
  Badge,
  Box,
  Button,
  Center,
  Divider,
  FormControl,
  FormErrorMessage,
  FormLabel,
  Grid,
  HStack,
  Heading,
  Input,
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
  useDisclosure,
  useToast,
} from "@chakra-ui/react";
import { Helmet } from "react-helmet";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { changePassword, getWorkerMe, IWorkerDetail } from "../api";
import WorkerProtectedPage from "../components/WorkerProtectedPage";

const fmt = (d?: string | null) => {
  if (!d) return "-";
  const dt = new Date(d);
  return isNaN(dt.getTime()) ? d : dt.toLocaleDateString("ko-KR");
};

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  const labelColor = useColorModeValue("gray.500", "gray.400");
  return (
    <Box>
      <Text fontSize="xs" color={labelColor} fontWeight="semibold" mb={1}>
        {label}
      </Text>
      <Text fontSize="sm">{value || "-"}</Text>
    </Box>
  );
}

interface IPasswordForm {
  oldPassword: string;
  newPassword: string;
  newPasswordConfirm: string;
}

export default function WorkerMe() {
  const cardBg = useColorModeValue("white", "gray.800");
  const pageBg = useColorModeValue("gray.50", "gray.900");
  const borderColor = useColorModeValue("gray.200", "gray.600");
  const sectionBg = useColorModeValue("gray.50", "gray.700");
  const toast = useToast();
  const {
    isOpen: isPasswordModalOpen,
    onOpen: onPasswordModalOpen,
    onClose: onPasswordModalClose,
  } = useDisclosure();

  const { data: worker, isLoading } = useQuery<IWorkerDetail>({
    queryKey: ["workerMe"],
    queryFn: getWorkerMe,
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<IPasswordForm>();

  const passwordMutation = useMutation({
    mutationFn: changePassword,
    onSuccess: () => {
      toast({
        title: "비밀번호가 변경되었습니다.",
        status: "success",
        duration: 4000,
        isClosable: true,
      });
      reset();
      onPasswordModalClose();
    },
    onError: () => {
      toast({
        title: "비밀번호 변경 실패",
        description: "현재 비밀번호를 확인하거나 잠시 후 다시 시도해 주세요.",
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    },
  });

  const onPasswordSubmit = (data: IPasswordForm) => {
    if (data.newPassword !== data.newPasswordConfirm) {
      toast({
        title: "새 비밀번호가 일치하지 않습니다.",
        status: "warning",
      });
      return;
    }
    passwordMutation.mutate({
      oldPassword: data.oldPassword,
      newPassword: data.newPassword,
    });
  };

  return (
    <WorkerProtectedPage>
      <Helmet>
        <title>{worker?.name ?? "My Profile"}</title>
      </Helmet>

      {isLoading ? (
        <Center minH="60vh">
          <Spinner size="xl" />
        </Center>
      ) : !worker ? (
        <Center minH="60vh">
          <Text color="gray.400">Profile not found.</Text>
        </Center>
      ) : (
        <Box
          bg={pageBg}
          minH="100vh"
          px={{ base: 4, md: 8, lg: 12 }}
          py={{ base: 6, md: 8 }}
        >
          <Box maxW="3xl" mx="auto">
            <Box
              bg={cardBg}
              borderRadius="xl"
              border="1px solid"
              borderColor={borderColor}
              p={6}
              shadow="sm"
            >
              {/* Header */}
              <HStack align="flex-start" spacing={6} mb={6}>
                <Avatar
                  size="2xl"
                  name={worker.name}
                  src={worker.avatar ?? undefined}
                />
                <VStack align="stretch" spacing={2} flex={1}>
                  <Heading size="lg">{worker.name}</Heading>
                  {worker.nick_name && (
                    <Text color="gray.500">{worker.nick_name}</Text>
                  )}
                  <HStack spacing={2} flexWrap="wrap">
                    {worker.department_detail && (
                      <Badge colorScheme="purple">
                        {worker.department_detail.name}
                      </Badge>
                    )}
                    {worker.section_detail && (
                      <Badge colorScheme="cyan">
                        {worker.section_detail.name}
                      </Badge>
                    )}
                    {worker.position_detail && (
                      <Badge colorScheme="blue">
                        {worker.position_detail.name}
                      </Badge>
                    )}
                    {worker.rank_detail && (
                      <Badge colorScheme="orange">
                        {worker.rank_detail.name}
                      </Badge>
                    )}
                    {worker.job_duties_detail && (
                      <Badge colorScheme="green">
                        {worker.job_duties_detail.name}
                      </Badge>
                    )}
                    <Badge
                      colorScheme={
                        worker.is_resigned === "resigned" ? "red" : "green"
                      }
                    >
                      {worker.is_resigned === "resigned" ? "Resigned" : "Active"}
                    </Badge>
                  </HStack>
                </VStack>
              </HStack>

              <Divider mb={5} />

              {/* 계정 비밀번호 (로그인 계정 = User) */}
              <Box bg={sectionBg} borderRadius="lg" p={4} mb={4}>
                <Text fontSize="sm" fontWeight="bold" mb={2}>
                  로그인 계정
                </Text>
                <Text fontSize="xs" color="gray.500" mb={4}>
                  사이트 로그인에 사용하는 비밀번호를 변경할 수 있습니다.
                </Text>
                <Button
                  colorScheme="blue"
                  size="sm"
                  onClick={onPasswordModalOpen}
                >
                  비밀번호 변경
                </Button>
              </Box>

              <Modal
                isOpen={isPasswordModalOpen}
                onClose={() => {
                  reset();
                  onPasswordModalClose();
                }}
                isCentered
                size="md"
              >
                <ModalOverlay />
                <ModalContent>
                  <ModalHeader>비밀번호 변경</ModalHeader>
                  <ModalCloseButton />
                  <ModalBody pb={6}>
                    <Text fontSize="sm" color="gray.500" mb={4}>
                      현재 비밀번호를 입력한 뒤 새 비밀번호를 설정하세요.
                    </Text>
                    <Box
                      as="form"
                      onSubmit={handleSubmit(onPasswordSubmit)}
                    >
                      <VStack spacing={3} align="stretch">
                        <FormControl isInvalid={Boolean(errors.oldPassword)}>
                          <FormLabel fontSize="sm">현재 비밀번호</FormLabel>
                          <Input
                            type="password"
                            autoComplete="current-password"
                            {...register("oldPassword", { required: true })}
                          />
                          <FormErrorMessage>필수입니다.</FormErrorMessage>
                        </FormControl>
                        <FormControl isInvalid={Boolean(errors.newPassword)}>
                          <FormLabel fontSize="sm">새 비밀번호</FormLabel>
                          <Input
                            type="password"
                            autoComplete="new-password"
                            {...register("newPassword", {
                              required: true,
                              minLength: {
                                value: 8,
                                message: "8자 이상 입력하세요.",
                              },
                            })}
                          />
                          <FormErrorMessage>
                            {errors.newPassword?.message}
                          </FormErrorMessage>
                        </FormControl>
                        <FormControl
                          isInvalid={Boolean(errors.newPasswordConfirm)}
                        >
                          <FormLabel fontSize="sm">새 비밀번호 확인</FormLabel>
                          <Input
                            type="password"
                            autoComplete="new-password"
                            {...register("newPasswordConfirm", {
                              required: true,
                            })}
                          />
                          <FormErrorMessage>필수입니다.</FormErrorMessage>
                        </FormControl>
                        <Button
                          type="submit"
                          colorScheme="blue"
                          size="sm"
                          w="full"
                          mt={2}
                          isLoading={passwordMutation.isPending}
                        >
                          변경하기
                        </Button>
                      </VStack>
                    </Box>
                  </ModalBody>
                </ModalContent>
              </Modal>

              {/* Personal Info */}
              <Box bg={sectionBg} borderRadius="lg" p={4} mb={4}>
                <Text fontSize="sm" fontWeight="bold" mb={3}>
                  Personal Info
                </Text>
                <Grid
                  templateColumns={{ base: "1fr", md: "1fr 1fr" }}
                  gap={4}
                >
                  <InfoRow label="COMPANY ID" value={worker.company_id} />
                  <InfoRow label="GENDER" value={worker.gender} />
                  <InfoRow
                    label="BIRTHDATE"
                    value={
                      fmt(worker.birthdate) +
                      (worker.age != null ? ` (${worker.age})` : "")
                    }
                  />
                  <InfoRow
                    label="NATIONALITY"
                    value={worker.nationality_detail?.name}
                  />
                </Grid>
                {worker.bio && (
                  <Box mt={4}>
                    <InfoRow label="BIO" value={worker.bio} />
                  </Box>
                )}
              </Box>

              {/* Career */}
              <Box bg={sectionBg} borderRadius="lg" p={4} mb={4}>
                <Text fontSize="sm" fontWeight="bold" mb={3}>
                  Career
                </Text>
                <Grid
                  templateColumns={{ base: "1fr", md: "1fr 1fr" }}
                  gap={4}
                >
                  <InfoRow
                    label="START CAREER DATE"
                    value={
                      fmt(worker.start_career_date) +
                      (worker.experience_career
                        ? ` (${worker.experience_career})`
                        : "")
                    }
                  />
                  <InfoRow
                    label="PREVIOUS COMPANY"
                    value={worker.pervieous_company}
                  />
                  <InfoRow
                    label="JOINED COMPANY"
                    value={
                      fmt(worker.joined_at_company) +
                      (worker.experience_at_company
                        ? ` (${worker.experience_at_company})`
                        : "")
                    }
                  />
                  <InfoRow
                    label="JOINED FACTORY"
                    value={
                      fmt(worker.joined_at_factory) +
                      (worker.experience_at_factory
                        ? ` (${worker.experience_at_factory})`
                        : "")
                    }
                  />
                </Grid>
              </Box>

              {/* Work Info */}
              <Box bg={sectionBg} borderRadius="lg" p={4} mb={4}>
                <Text fontSize="sm" fontWeight="bold" mb={3}>
                  Work Info
                </Text>
                <Grid
                  templateColumns={{ base: "1fr", md: "1fr 1fr" }}
                  gap={4}
                >
                  <InfoRow
                    label="FACTORY"
                    value={
                      worker.factory_detail?.nickname ||
                      worker.factory_detail?.name
                    }
                  />
                  <InfoRow
                    label="DEPARTMENT"
                    value={worker.department_detail?.name}
                  />
                  <InfoRow
                    label="SECTION"
                    value={worker.section_detail?.name}
                  />
                  <InfoRow label="LINE" value={worker.line_detail?.name} />
                  <InfoRow
                    label="POSITION"
                    value={worker.position_detail?.name}
                  />
                  <InfoRow label="RANK" value={worker.rank_detail?.name} />
                  <InfoRow label="TEAM" value={worker.team_detail?.name} />
                  <InfoRow
                    label="JOB DUTIES"
                    value={worker.job_duties_detail?.name}
                  />
                  <InfoRow label="JOB TITLE" value={worker.job_title} />
                </Grid>
                {worker.job_description && (
                  <Box mt={4}>
                    <InfoRow
                      label="JOB DESCRIPTION"
                      value={worker.job_description}
                    />
                  </Box>
                )}
              </Box>

              {worker.remark && (
                <Box bg={sectionBg} borderRadius="lg" p={4} mb={4}>
                  <InfoRow label="REMARK" value={worker.remark} />
                </Box>
              )}
            </Box>
          </Box>
        </Box>
      )}
    </WorkerProtectedPage>
  );
}
