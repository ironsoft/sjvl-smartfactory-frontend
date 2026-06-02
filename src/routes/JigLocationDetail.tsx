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
  deleteStorageLocation,
  editStorageLocation,
  getStorageLocation,
  IStorageLocation
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

export default function JigLocationDetail() {
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

  const { data, isLoading, error } = useQuery<IStorageLocation>({
    queryKey: ["storage-location", pk],
    queryFn: () => getStorageLocation(pk)
  });

  const [form, setForm] = useState<Partial<IStorageLocation>>({});

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
    mutationFn: (variables: Partial<IStorageLocation>) =>
      editStorageLocation(pk, variables),
    onSuccess: () => {
      toast({
        title: t("jigLocationDetail.updated"),
        status: "success",
        duration: 2000,
        isClosable: true,
        position: "bottom-right"
      });
      queryClient.invalidateQueries({ queryKey: ["storage-location", pk] });
      queryClient.invalidateQueries({ queryKey: ["storage-locations"] });
      onEditClose();
    },
    onError: (err: Error) => {
      toast({
        title: t("jigLocationDetail.updateFailed"),
        description: err.message,
        status: "error",
        duration: 3000,
        isClosable: true,
        position: "bottom-right"
      });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteStorageLocation(pk),
    onSuccess: () => {
      toast({
        title: t("jigLocationDetail.deleted"),
        status: "success",
        duration: 2000,
        isClosable: true,
        position: "bottom-right"
      });
      queryClient.invalidateQueries({ queryKey: ["storage-locations"] });
      navigate("/jigs/locations");
    },
    onError: (err: Error) => {
      toast({
        title: t("jigLocationDetail.deleteFailed"),
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
        <Text color="red.500">{message || t("jigLocationDetail.notFound")}</Text>
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
            to="/jigs/locations"
            leftIcon={<FaArrowLeft />}
            variant="ghost"
            size="sm"
          >
            {t("jigLocationDetail.backToList")}
          </Button>
          <HStack spacing={2}>
            <Button
              leftIcon={<FaEdit />}
              size="sm"
              variant="outline"
              onClick={openEdit}
            >
              {t("jigLocationDetail.edit")}
            </Button>
            <Button
              leftIcon={<FaTrash />}
              size="sm"
              colorScheme="red"
              variant="outline"
              onClick={onDeleteOpen}
            >
              {t("jigLocationDetail.delete")}
            </Button>
          </HStack>
        </HStack>

        <Heading size="md" mb={4}>
          {data.code}
        </Heading>
        <Divider mb={4} />

        <VStack align="stretch" spacing={0} divider={<Divider />}>
          <InfoRow label={t("jigLocationDetail.code")}>{data.code}</InfoRow>
          <InfoRow label={t("jigLocationDetail.zone")}>{data.zone}</InfoRow>
          <InfoRow label={t("jigLocationDetail.shelf")}>{data.shelf}</InfoRow>
          <InfoRow label={t("jigLocationDetail.slot")}>{data.slot}</InfoRow>
          <InfoRow label={t("jigLocationDetail.description")}>
            {data.description || <Text color="gray.400">-</Text>}
          </InfoRow>
          <InfoRow label={t("jigLocationDetail.isOccupied")}>
            <Badge colorScheme={data.is_occupied ? "red" : "green"}>
              {data.is_occupied ? t("jigLocationList.occupied") : t("jigLocationList.empty")}
            </Badge>
          </InfoRow>
          <InfoRow label={t("jigLocationDetail.ledOn")}>
            <Badge colorScheme={data.led_on ? "yellow" : "gray"}>
              {data.led_on ? t("jigLocationList.ledOn") : t("jigLocationList.ledOff")}
            </Badge>
          </InfoRow>
        </VStack>
      </Box>
      </Box>

      {/* Edit Modal */}
      <Modal isOpen={isEditOpen} onClose={onEditClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>{t("jigLocationDetail.edit")} Location</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack spacing={4}>
              <FormControl>
                <FormLabel fontSize="sm">{t("jigLocationDetail.code")}</FormLabel>
                <Input
                  size="sm"
                  value={form.code ?? ""}
                  onChange={(e) => setForm((p) => ({ ...p, code: e.target.value }))}
                />
              </FormControl>
              <FormControl>
                <FormLabel fontSize="sm">{t("jigLocationDetail.zone")}</FormLabel>
                <Input
                  size="sm"
                  value={form.zone ?? ""}
                  onChange={(e) => setForm((p) => ({ ...p, zone: e.target.value }))}
                />
              </FormControl>
              <FormControl>
                <FormLabel fontSize="sm">{t("jigLocationDetail.shelf")}</FormLabel>
                <Input
                  size="sm"
                  value={form.shelf ?? ""}
                  onChange={(e) => setForm((p) => ({ ...p, shelf: e.target.value }))}
                />
              </FormControl>
              <FormControl>
                <FormLabel fontSize="sm">{t("jigLocationDetail.slot")}</FormLabel>
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
                <FormLabel fontSize="sm">{t("jigLocationDetail.description")}</FormLabel>
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
                  {t("jigLocationDetail.isOccupied")}
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
                  {t("jigLocationDetail.ledOn")}
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
              {t("jigLocationDetail.cancel")}
            </Button>
            <Button
              size="sm"
              colorScheme="blue"
              isLoading={editMutation.isPending}
              onClick={() => editMutation.mutate(form)}
            >
              {t("jigLocationDetail.save")}
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
              {t("jigLocationDetail.deleteTitle")}
            </AlertDialogHeader>
            <AlertDialogBody>
              {t("jigLocationDetail.deleteConfirm")}
            </AlertDialogBody>
            <AlertDialogFooter>
              <Button ref={cancelRef} onClick={onDeleteClose} size="sm">
                {t("jigLocationDetail.cancel")}
              </Button>
              <Button
                colorScheme="red"
                size="sm"
                ml={3}
                isLoading={deleteMutation.isPending}
                onClick={() => deleteMutation.mutate()}
              >
                {t("jigLocationDetail.delete")}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>
    </>
  );
}
