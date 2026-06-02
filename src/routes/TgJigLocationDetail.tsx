import {
  Box,
  Heading,
  Spinner,
  Center,
  Text,
  Badge,
  HStack,
  VStack,
  Button,
  Divider,
  FormControl,
  FormLabel,
  Input,
  Switch,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  useDisclosure,
  useToast,
  AlertDialog,
  AlertDialogBody,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogOverlay,
  useColorModeValue
} from "@chakra-ui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Helmet } from "react-helmet";
import { useNavigate, useParams, Link as RouterLink } from "react-router-dom";
import {
  deleteTgJigStorageLocation,
  editTgJigStorageLocation,
  getTgJigStorageLocation,
  ITgJigStorageLocation
} from "../api";
import { FaArrowLeft, FaEdit, FaTrash } from "react-icons/fa";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  const labelColor = useColorModeValue("gray.500", "gray.400");
  return (
    <HStack align="flex-start" py={3}>
      <Text w="140px" fontSize="sm" color={labelColor} flexShrink={0}>
        {label}
      </Text>
      <Text fontSize="sm" fontWeight="medium">
        {children}
      </Text>
    </HStack>
  );
}

export default function TgJigLocationDetail() {
  const { t } = useTranslation();
  const { locationId } = useParams<{ locationId: string }>();
  const pk = Number(locationId);
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();

  const pageBg = useColorModeValue("gray.50", "gray.900");
  const cardBg = useColorModeValue("white", "gray.800");

  const { isOpen: isEditOpen, onOpen: onEditOpen, onClose: onEditClose } = useDisclosure();
  const { isOpen: isDeleteOpen, onOpen: onDeleteOpen, onClose: onDeleteClose } = useDisclosure();
  const cancelRef = useRef<HTMLButtonElement>(null);

  const { data, isLoading, error } = useQuery<ITgJigStorageLocation>({
    queryKey: ["tg-jig-storage-location", pk],
    queryFn: () => getTgJigStorageLocation(pk)
  });

  const [form, setForm] = useState<Partial<ITgJigStorageLocation>>({});

  const openEdit = () => {
    if (data) {
      setForm({
        code: data.code,
        zone: data.zone,
        shelf: data.shelf,
        slot: data.slot,
        description: data.description,
        is_occupied: data.is_occupied,
        led_on: data.led_on
      });
    }
    onEditOpen();
  };

  const editMutation = useMutation({
    mutationFn: (variables: Partial<ITgJigStorageLocation>) =>
      editTgJigStorageLocation(pk, variables),
    onSuccess: () => {
      toast({
        title: t("tgJigLocationDetail.updated"),
        status: "success",
        duration: 2000,
        isClosable: true,
        position: "bottom-right"
      });
      queryClient.invalidateQueries({ queryKey: ["tg-jig-storage-location", pk] });
      queryClient.invalidateQueries({ queryKey: ["tg-jig-storage-locations"] });
      onEditClose();
    },
    onError: (err: Error) => {
      toast({
        title: t("tgJigLocationDetail.updateFailed"),
        description: err.message,
        status: "error",
        duration: 3000,
        isClosable: true,
        position: "bottom-right"
      });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteTgJigStorageLocation(pk),
    onSuccess: () => {
      toast({
        title: t("tgJigLocationDetail.deleted"),
        status: "success",
        duration: 2000,
        isClosable: true,
        position: "bottom-right"
      });
      queryClient.invalidateQueries({ queryKey: ["tg-jig-storage-locations"] });
      navigate("/tg-jigs/locations");
    },
    onError: (err: Error) => {
      toast({
        title: t("tgJigLocationDetail.deleteFailed"),
        description: err.message,
        status: "error",
        duration: 3000,
        isClosable: true,
        position: "bottom-right"
      });
    }
  });

  if (isLoading) {
    return (
      <>
        <Helmet><title>Loading... Location</title></Helmet>
        <Center py={10}><Spinner size="lg" /></Center>
      </>
    );
  }

  if (error || !data) {
    const message = error instanceof Error ? error.message : "Not found";
    return (
      <Center py={10}>
        <Text color="red.500">{message || t("tgJigLocationDetail.notFound")}</Text>
      </Center>
    );
  }

  return (
    <>
      <Helmet>
        <title>Location {data.code}</title>
      </Helmet>

      <Box
        bg={pageBg}
        minW="100%"
        minH="100%"
        px={{ base: "4", md: "8" }}
        py={{ base: "6", md: "8" }}
      >
      <Box
        maxW={{ base: "xl", lg: "3xl" }}
        mx="auto"
        bg={cardBg}
        borderRadius="lg"
        p={{ base: 4, md: 6 }}
        boxShadow="sm"
      >
        <HStack justify="space-between" align="center" mb={6}>
          <Button
            as={RouterLink}
            to="/tg-jigs/locations"
            leftIcon={<FaArrowLeft />}
            variant="ghost"
            size="sm"
          >
            {t("tgJigLocationDetail.backToList")}
          </Button>
          <HStack spacing={2}>
            <Button
              leftIcon={<FaEdit />}
              size="sm"
              variant="outline"
              onClick={openEdit}
            >
              {t("tgJigLocationDetail.edit")}
            </Button>
            <Button
              leftIcon={<FaTrash />}
              size="sm"
              colorScheme="red"
              variant="outline"
              onClick={onDeleteOpen}
            >
              {t("tgJigLocationDetail.delete")}
            </Button>
          </HStack>
        </HStack>

        <Heading size="md" mb={4}>
          {data.code}
        </Heading>
        <Divider mb={4} />

        <VStack align="stretch" spacing={0} divider={<Divider />}>
          <InfoRow label={t("tgJigLocationDetail.code")}>{data.code}</InfoRow>
          <InfoRow label={t("tgJigLocationDetail.zone")}>{data.zone}</InfoRow>
          <InfoRow label={t("tgJigLocationDetail.shelf")}>{data.shelf}</InfoRow>
          <InfoRow label={t("tgJigLocationDetail.slot")}>{data.slot}</InfoRow>
          <InfoRow label={t("tgJigLocationDetail.description")}>
            {data.description || <Text color="gray.400">-</Text>}
          </InfoRow>
          <InfoRow label={t("tgJigLocationDetail.isOccupied")}>
            <Badge colorScheme={data.is_occupied ? "red" : "green"}>
              {data.is_occupied ? t("tgJigLocationList.occupied") : t("tgJigLocationList.empty")}
            </Badge>
          </InfoRow>
          <InfoRow label={t("tgJigLocationDetail.ledOn")}>
            <Badge colorScheme={data.led_on ? "yellow" : "gray"}>
              {data.led_on ? t("tgJigLocationList.ledOn") : t("tgJigLocationList.ledOff")}
            </Badge>
          </InfoRow>
        </VStack>
      </Box>
      </Box>

      {/* Edit Modal */}
      <Modal isOpen={isEditOpen} onClose={onEditClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>{t("tgJigLocationDetail.edit")} Location</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack spacing={4}>
              <FormControl>
                <FormLabel fontSize="sm">{t("tgJigLocationDetail.code")}</FormLabel>
                <Input
                  size="sm"
                  value={form.code ?? ""}
                  onChange={(e) => setForm((p) => ({ ...p, code: e.target.value }))}
                />
              </FormControl>
              <FormControl>
                <FormLabel fontSize="sm">{t("tgJigLocationDetail.zone")}</FormLabel>
                <Input
                  size="sm"
                  value={form.zone ?? ""}
                  onChange={(e) => setForm((p) => ({ ...p, zone: e.target.value }))}
                />
              </FormControl>
              <FormControl>
                <FormLabel fontSize="sm">{t("tgJigLocationDetail.shelf")}</FormLabel>
                <Input
                  size="sm"
                  value={form.shelf ?? ""}
                  onChange={(e) => setForm((p) => ({ ...p, shelf: e.target.value }))}
                />
              </FormControl>
              <FormControl>
                <FormLabel fontSize="sm">{t("tgJigLocationDetail.slot")}</FormLabel>
                <Input
                  size="sm"
                  type="number"
                  value={form.slot ?? ""}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, slot: Number(e.target.value) }))
                  }
                />
              </FormControl>
              <FormControl>
                <FormLabel fontSize="sm">{t("tgJigLocationDetail.description")}</FormLabel>
                <Input
                  size="sm"
                  value={form.description ?? ""}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, description: e.target.value }))
                  }
                />
              </FormControl>
              <FormControl display="flex" alignItems="center">
                <FormLabel fontSize="sm" mb={0}>
                  {t("tgJigLocationDetail.isOccupied")}
                </FormLabel>
                <Switch
                  isChecked={form.is_occupied ?? false}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, is_occupied: e.target.checked }))
                  }
                />
              </FormControl>
              <FormControl display="flex" alignItems="center">
                <FormLabel fontSize="sm" mb={0}>
                  {t("tgJigLocationDetail.ledOn")}
                </FormLabel>
                <Switch
                  isChecked={form.led_on ?? false}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, led_on: e.target.checked }))
                  }
                />
              </FormControl>
            </VStack>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" size="sm" mr={3} onClick={onEditClose}>
              {t("tgJigLocationDetail.cancel")}
            </Button>
            <Button
              size="sm"
              colorScheme="blue"
              isLoading={editMutation.isPending}
              onClick={() => editMutation.mutate(form)}
            >
              {t("tgJigLocationDetail.save")}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Delete Confirm */}
      <AlertDialog
        isOpen={isDeleteOpen}
        leastDestructiveRef={cancelRef}
        onClose={onDeleteClose}
      >
        <AlertDialogOverlay>
          <AlertDialogContent>
            <AlertDialogHeader fontSize="lg" fontWeight="bold">
              {t("tgJigLocationDetail.deleteTitle")}
            </AlertDialogHeader>
            <AlertDialogBody>
              {t("tgJigLocationDetail.deleteConfirm")}
            </AlertDialogBody>
            <AlertDialogFooter>
              <Button ref={cancelRef} onClick={onDeleteClose} size="sm">
                {t("tgJigLocationDetail.cancel")}
              </Button>
              <Button
                colorScheme="red"
                size="sm"
                ml={3}
                isLoading={deleteMutation.isPending}
                onClick={() => deleteMutation.mutate()}
              >
                {t("tgJigLocationDetail.delete")}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>
    </>
  );
}
