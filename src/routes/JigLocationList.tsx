import {
  Box,
  Heading,
  Spinner,
  Center,
  Text,
  Table,
  TableContainer,
  Tbody,
  Td,
  Th,
  Thead,
  Tr,
  Badge,
  HStack,
  Button,
  Link,
  IconButton,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  FormControl,
  FormLabel,
  Input,
  Switch,
  VStack,
  useDisclosure,
  useToast,
  useColorModeValue
} from "@chakra-ui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Helmet } from "react-helmet";
import {
  createStorageLocation,
  getStorageLocations,
  IStorageLocation
} from "../api";
import { Link as RouterLink } from "react-router-dom";
import { FaArrowLeft, FaPlus } from "react-icons/fa";
import { useState } from "react";
import { useTranslation } from "react-i18next";

const emptyForm = {
  code: "",
  zone: "",
  shelf: "",
  slot: 0,
  description: "",
  is_occupied: false,
  led_on: false
};

export default function JigLocationList() {
  const { t } = useTranslation();
  // 테이블 배경색
  const tableBgColor = useColorModeValue("gray.50", "gray.800");
  const pageBg = useColorModeValue("gray.50", "gray.900");
  // 토스트
  const toast = useToast();
  // 쿼리클라이언트
  const queryClient = useQueryClient();
  // 모달 오픈, 클로즈
  const { isOpen, onOpen, onClose } = useDisclosure();
  // 폼
  const [form, setForm] = useState<Omit<IStorageLocation, "id">>(emptyForm);

  // 스토리지 위치 조회
  const { data, isLoading, error } = useQuery<IStorageLocation[]>({
    queryKey: ["storage-locations"],
    queryFn: getStorageLocations
  });

  const createMutation = useMutation({
    mutationFn: createStorageLocation,
    onSuccess: () => {
      toast({
        title: t("jigLocationList.createSuccess"),
        status: "success",
        duration: 2000,
        isClosable: true,
        position: "bottom-right"
      });
      queryClient.invalidateQueries({ queryKey: ["storage-locations"] });
      setForm(emptyForm);
      onClose();
    },
    onError: (err: Error) => {
      toast({
        title: t("jigLocationList.createError"),
        description: err.message,
        status: "error",
        duration: 3000,
        isClosable: true,
        position: "bottom-right"
      });
    }
  });

  // 폼 제출 핸들러
  const handleSubmit = () => {
    if (!form.code || !form.zone || !form.shelf) return;
    createMutation.mutate(form);
  };

  // 로딩 상태
  if (isLoading) {
    return (
      <>
        <Helmet>
          <title>Loading... Location 목록</title>
        </Helmet>
        <Center py={10}>
          <Spinner size="lg" />
        </Center>
      </>
    );
  }

  // 에러 상태
  if (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch locations";
    return (
      <Center py={10}>
        <Text color="red.500">{message}</Text>
      </Center>
    );
  }

  const locations = data ?? [];

  return (
    <>
      <Helmet>
        <title>{t("jigLocationList.title")}</title>
      </Helmet>

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
        <HStack justify="space-between" align="center" mb={5}>
          <Heading size="md">{t("jigLocationList.title")}</Heading>
        </HStack>

        <HStack justify="space-between" align="center" mb={3}>
          <Text color="gray.500" fontSize="sm">
            {t("jigLocationList.total")}: {locations.length}
          </Text>
          <HStack spacing={2}>
            <Button
              as={RouterLink}
              to="/jigs"
              leftIcon={<FaArrowLeft />}
              variant="ghost"
              size="sm"
            >
              {t("jigLocationList.backToJigList")}
            </Button>
            <IconButton
              aria-label="Add location"
              icon={<FaPlus />}
              size="sm"
              variant="outline"
              onClick={onOpen}
            />
          </HStack>
        </HStack>

        <TableContainer>
          <Table variant="striped">
            <Thead bgColor={tableBgColor}>
              <Tr>
                <Th>{t("jigLocationList.colCode")}</Th>
                <Th>{t("jigLocationList.colZone")}</Th>
                <Th>{t("jigLocationList.colShelf")}</Th>
                <Th>{t("jigLocationList.colSlot")}</Th>
                <Th>{t("jigLocationList.colDescription")}</Th>
                <Th>{t("jigLocationList.colOccupied")}</Th>
                <Th>{t("jigLocationList.colLed")}</Th>
              </Tr>
            </Thead>
            <Tbody>
              {locations.map((loc) => (
                <Tr key={loc.id}>
                  <Td>
                    <Link
                      as={RouterLink}
                      to={`/jigs/locations/${loc.id}`}
                      color="blue.500"
                      fontWeight="semibold"
                    >
                      {loc.code}
                    </Link>
                  </Td>
                  <Td>{loc.zone}</Td>
                  <Td>{loc.shelf}</Td>
                  <Td>{loc.slot}</Td>
                  <Td>{loc.description || <Text color="gray.400">-</Text>}</Td>
                  <Td>
                    <Badge colorScheme={loc.is_occupied ? "red" : "green"}>
                      {loc.is_occupied ? t("jigLocationList.occupied") : t("jigLocationList.empty")}
                    </Badge>
                  </Td>
                  <Td>
                    <Badge colorScheme={loc.led_on ? "yellow" : "gray"}>
                      {loc.led_on ? t("jigLocationList.ledOn") : t("jigLocationList.ledOff")}
                    </Badge>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </TableContainer>
      </Box>
      </Box>

      {/* Create Modal */}
      <Modal isOpen={isOpen} onClose={onClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>{t("jigLocationList.createTitle")}</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack spacing={4}>
              <FormControl isRequired>
                <FormLabel fontSize="sm">{t("jigLocationList.code")}</FormLabel>
                <Input
                  size="sm"
                  placeholder={t("jigLocationList.codePlaceholder")}
                  value={form.code}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, code: e.target.value }))
                  }
                />
              </FormControl>
              <FormControl isRequired>
                <FormLabel fontSize="sm">{t("jigLocationList.zone")}</FormLabel>
                <Input
                  size="sm"
                  placeholder={t("jigLocationList.zonePlaceholder")}
                  value={form.zone}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, zone: e.target.value }))
                  }
                />
              </FormControl>
              <FormControl isRequired>
                <FormLabel fontSize="sm">{t("jigLocationList.shelf")}</FormLabel>
                <Input
                  size="sm"
                  placeholder={t("jigLocationList.shelfPlaceholder")}
                  value={form.shelf}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, shelf: e.target.value }))
                  }
                />
              </FormControl>
              <FormControl isRequired>
                <FormLabel fontSize="sm">{t("jigLocationList.slot")}</FormLabel>
                <Input
                  size="sm"
                  type="number"
                  placeholder={t("jigLocationList.slotPlaceholder")}
                  value={form.slot || ""}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, slot: Number(e.target.value) }))
                  }
                />
              </FormControl>
              <FormControl>
                <FormLabel fontSize="sm">{t("jigLocationList.description")}</FormLabel>
                <Input
                  size="sm"
                  value={form.description}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, description: e.target.value }))
                  }
                />
              </FormControl>
              <FormControl display="flex" alignItems="center">
                <FormLabel fontSize="sm" mb={0}>
                  {t("jigLocationList.isOccupied")}
                </FormLabel>
                <Switch
                  isChecked={form.is_occupied}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, is_occupied: e.target.checked }))
                  }
                />
              </FormControl>
              <FormControl display="flex" alignItems="center">
                <FormLabel fontSize="sm" mb={0}>
                  {t("jigLocationList.ledOnLabel")}
                </FormLabel>
                <Switch
                  isChecked={form.led_on}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, led_on: e.target.checked }))
                  }
                />
              </FormControl>
            </VStack>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" size="sm" mr={3} onClick={onClose}>
              {t("jigLocationList.cancelBtn")}
            </Button>
            <Button
              size="sm"
              colorScheme="blue"
              isLoading={createMutation.isPending}
              isDisabled={!form.code || !form.zone || !form.shelf}
              onClick={handleSubmit}
            >
              {t("jigLocationList.createBtn")}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
}
