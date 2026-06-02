import {
  Badge,
  Box,
  Button,
  Center,
  Divider,
  HStack,
  Heading,
  Input,
  Link,
  Spinner,
  Table,
  TableContainer,
  Tbody,
  Td,
  Text,
  Textarea,
  Th,
  Thead,
  Tooltip,
  Tr,
  useColorModeValue,
  useDisclosure,
  useToast,
  AlertDialog,
  AlertDialogBody,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogContent,
  AlertDialogOverlay,
} from "@chakra-ui/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Helmet } from "react-helmet";
import { useParams, useNavigate, Link as RouterLink, useSearchParams } from "react-router-dom";
import { FaArrowLeft, FaExternalLinkAlt, FaSync, FaTrash } from "react-icons/fa";
import {
  getEpSjNoDetail, patchEpSjNo, deleteEpSjNo, syncEpSjNoFromSource,
  IEpSjNoDetail,
} from "../api";
import React, { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import EpInspectionEntryQr from "../components/EpInspectionEntryQr";
import { EpBadge, EpOriginalReferenceBadges } from "../components/EpBadge";
import { StatusBadge } from "../components/StatusBadge";

function InfoRow({
  label, labelColor, children, fieldName, overrideFields, onReset,
}: {
  label: string; labelColor: string; children: React.ReactNode;
  fieldName?: string; overrideFields?: string[]; onReset?: (field: string) => void;
}) {
  const isOverridden = fieldName && overrideFields?.includes(fieldName);
  return (
    <Box>
      <HStack spacing={1} mb={0.5}>
        <Text fontSize="xs" color={labelColor} fontWeight="semibold">{label}</Text>
        {isOverridden && (
          <Tooltip label="Overridden from original. Click to reset." placement="top">
            <Badge
              colorScheme="orange" fontSize="9px" px={1} cursor="pointer"
              onClick={() => fieldName && onReset?.(fieldName)}
            >
              custom
            </Badge>
          </Tooltip>
        )}
      </HStack>
      {children}
    </Box>
  );
}

export default function EpSjNoDetail() {
  const { sjNoId } = useParams<{ sjNoId: string }>();
  const pk = Number(sjNoId);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isPopupWindow = searchParams.get("popup") === "1";
  const queryClient = useQueryClient();
  const toast = useToast();
  const { t } = useTranslation();
  const { isOpen: isDeleteOpen, onOpen: onDeleteOpen, onClose: onDeleteClose } = useDisclosure();
  const { isOpen: isSyncOpen, onOpen: onSyncOpen, onClose: onSyncClose } = useDisclosure();
  const cancelRef = useRef<HTMLButtonElement>(null);
  const syncCancelRef = useRef<HTMLButtonElement>(null);
  const pendingSyncRef = useRef<"full" | string[] | null>(null);

  const cardBg = useColorModeValue("white", "gray.800");
  const pageBg = useColorModeValue("gray.50", "gray.900");
  const borderColor = useColorModeValue("gray.200", "gray.600");
  const labelColor = useColorModeValue("gray.500", "gray.400");
  const tableBg = useColorModeValue("gray.50", "gray.800");

  const [editingSjNo, setEditingSjNo] = useState<{ val: string } | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const { data, isLoading } = useQuery<IEpSjNoDetail>({
    queryKey: ["epSjNoDetail", pk],
    queryFn: () => getEpSjNoDetail(pk),
    enabled: !!pk,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["epSjNoDetail", pk] });
    queryClient.invalidateQueries({ queryKey: ["epSchedules"] });
    queryClient.invalidateQueries({ queryKey: ["epModuleDetail"] });
    queryClient.invalidateQueries({ queryKey: ["epProcessDetail"] });
  };

  const saveSjNo = async (val: string) => {
    try {
      await patchEpSjNo(pk, { sj_no: val } as any);
      invalidate();
    } catch {
      toast({ title: t("ep.common.failedSave"), status: "error", duration: 2000, position: "bottom-right" });
    }
    setEditingSjNo(null);
  };

  const openSyncConfirm = (mode: "full" | string[]) => {
    pendingSyncRef.current = mode;
    onSyncOpen();
  };

  const handleSync = async (resetFields?: string[]) => {
    setSyncing(true);
    try {
      const res = await syncEpSjNoFromSource(pk, resetFields);
      invalidate();
      const parts: string[] = [];
      if (res.updated_fields.length) {
        parts.push(t("ep.common.syncFields", { fields: res.updated_fields.join(", ") }));
      }
      if (res.modules_sync?.length) {
        parts.push(t("ep.common.syncSjNoCascadeNote"));
      }
      toast({
        title: t("ep.common.syncDone"),
        description: parts.length ? parts.join(" ") : t("ep.common.syncNoChanges"),
        status: "success", duration: 4000, position: "bottom-right",
      });
    } catch {
      toast({ title: t("ep.common.syncFailed"), status: "error", duration: 2000, position: "bottom-right" });
    }
    setSyncing(false);
  };

  const confirmSync = async () => {
    const mode = pendingSyncRef.current;
    onSyncClose();
    pendingSyncRef.current = null;
    if (mode == null) return;
    await handleSync(mode === "full" ? undefined : mode);
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteEpSjNo(pk);
      toast({ title: t("ep.common.deleted"), status: "success", duration: 2000, position: "bottom-right" });
      navigate(-1);
    } catch {
      toast({ title: t("ep.common.failedDelete"), status: "error", duration: 2000, position: "bottom-right" });
    }
    setDeleting(false);
    onDeleteClose();
  };

  if (isLoading) return <Center minH="60vh"><Spinner size="xl" /></Center>;
  if (!data) return <Center minH="60vh"><Text color="gray.400">{t("ep.sjNoDetail.notFound")}</Text></Center>;

  const overrideFields = data.override_fields ?? [];

  return (
    <>
      <Helmet><title>{`${data.sj_no} — ${t("ep.sjNoDetail.pageTitle")}`}</title></Helmet>
      <Box bg={pageBg} minH="100vh" px={{ base: 4, md: 8, lg: 12 }} py={{ base: 6, md: 8 }}>
        <Box maxW="5xl" mx="auto">
          <HStack mb={4} justify={isPopupWindow ? "flex-end" : "space-between"} w="full">
            {!isPopupWindow && (
              <Button leftIcon={<FaArrowLeft />} variant="ghost" size="sm" onClick={() => navigate(-1)}>{t("ep.common.back")}</Button>
            )}
            <HStack spacing={2}>
              {data.source_sj_no_info && (
                <Button leftIcon={<FaSync />} size="sm" variant="outline" colorScheme="teal"
                  isLoading={syncing} onClick={() => openSyncConfirm("full")}>
                  {t("ep.common.syncFromSource")}
                </Button>
              )}
              {!data.is_deleted && (
                <Button leftIcon={<FaTrash />} size="sm" colorScheme="red" variant="outline" onClick={onDeleteOpen}>
                  {t("ep.common.delete")}
                </Button>
              )}
            </HStack>
          </HStack>

          {data.is_deleted && (
            <Box mb={4} p={3} borderRadius="md" bg="red.50" border="1px solid" borderColor="red.200">
              <Text color="red.600" fontSize="sm" fontWeight="semibold">
                {t("ep.common.deletedRecord")} {data.deleted_at ? `(${data.deleted_at.slice(0, 10)})` : ""}
              </Text>
            </Box>
          )}

          {/* 기본 정보 카드 */}
          <Box bg={cardBg} borderRadius="xl" border="1px solid" borderColor={borderColor} p={6} shadow="sm" mb={6}>
            <HStack align="baseline" spacing={3} mb={5} flexWrap="wrap">
              <EpBadge kind="epSj" fontSize="sm" />
              <Heading size="md">{data.sj_no}</Heading>
              <StatusBadge status={data.status ?? "not_started"} fontSize="sm">
                {data.status_display}
              </StatusBadge>
            </HStack>

            <HStack spacing={8} flexWrap="wrap" align="flex-start">
              <InfoRow label={t("ep.sjNoDetail.sjNoField")} labelColor={labelColor}
                fieldName="sj_no" overrideFields={overrideFields} onReset={(f) => openSyncConfirm([f])}>
                {editingSjNo ? (
                  <Input size="xs" w="160px" value={editingSjNo.val} autoFocus
                    onChange={(e) => setEditingSjNo({ val: e.target.value })}
                    onBlur={() => saveSjNo(editingSjNo.val)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") saveSjNo(editingSjNo.val);
                      if (e.key === "Escape") setEditingSjNo(null);
                    }}
                  />
                ) : (
                  <Text fontSize="sm" cursor="pointer" color={data.sj_no ? undefined : "gray.400"}
                    _hover={{ textDecoration: "underline" }}
                    onClick={() => setEditingSjNo({ val: data.sj_no ?? "" })}>
                    {data.sj_no || "—"}
                  </Text>
                )}
              </InfoRow>
              <InfoRow label={t("ep.sjNoDetail.totalQty")} labelColor={labelColor}>
                <Text fontSize="sm">{data.total_qty != null ? data.total_qty.toLocaleString() : "—"}</Text>
              </InfoRow>
              <InfoRow label={t("ep.sjNoDetail.outputQty")} labelColor={labelColor}>
                <Text fontSize="sm">{(data.output_qty ?? 0).toLocaleString()}</Text>
              </InfoRow>
              <InfoRow label={t("ep.sjNoDetail.balance")} labelColor={labelColor}>
                <Text fontSize="sm">
                  {data.total_qty != null ? Math.max(0, data.total_qty - (data.output_qty ?? 0)).toLocaleString() : "—"}
                </Text>
              </InfoRow>
              <InfoRow label={t("ep.sjNoDetail.epSchedule")} labelColor={labelColor}>
                <RouterLink to={`/ep-production/${data.ep_schedule_pk}`}>
                  <Link as="span" color="blue.500" fontSize="sm">{t("ep.sjNoDetail.scheduleNo", { pk: data.ep_schedule_pk })}</Link>
                </RouterLink>
              </InfoRow>
              <InfoRow label={t("ep.sjNoDetail.originalSjNo")} labelColor={labelColor}>
                {data.source_sj_no_info ? (
                  <HStack spacing={2} align="center" flexWrap="wrap">
                    <EpOriginalReferenceBadges category="sj" fontSize="xs" />
                    <RouterLink to={`/sjnos/${data.source_sj_no_info.pk}`}>
                      <HStack spacing={1} as="span">
                        <Link as="span" color="teal.500" fontSize="sm" fontWeight="semibold">
                          {data.source_sj_no_info.sj_no}
                        </Link>
                        <FaExternalLinkAlt size={10} color="teal" />
                      </HStack>
                    </RouterLink>
                  </HStack>
                ) : (
                  <Text fontSize="sm" color="gray.400">—</Text>
                )}
              </InfoRow>
            </HStack>
          </Box>

          {/* EP Modules 목록 */}
          <Box bg={cardBg} borderRadius="xl" border="1px solid" borderColor={borderColor} p={6} shadow="sm">
            <Heading size="sm" mb={4}>{t("ep.sjNoDetail.epModules", { count: data.ep_modules.length })}</Heading>
            <Divider mb={4} />
            {data.ep_modules.length === 0 ? (
              <Text color="gray.400" textAlign="center" py={6}>{t("ep.sjNoDetail.noModules")}</Text>
            ) : (
              <TableContainer>
                <Table variant="striped" size="sm">
                  <Thead bgColor={tableBg}>
                    <Tr>
                      <Th>#</Th>
                      <Th>{t("ep.sjNoDetail.colCode")}</Th>
                      <Th>{t("ep.sjNoDetail.colName")}</Th>
                      <Th isNumeric>{t("ep.sjNoDetail.colOutputQty")}</Th>
                      <Th isNumeric>{t("ep.sjNoDetail.colTotalQty")}</Th>
                      <Th isNumeric>{t("ep.sjNoDetail.colProcessCount")}</Th>
                      <Th>{t("ep.sjNoDetail.colStatus")}</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {data.ep_modules.map((mod, idx) => (
                      <Tr key={mod.pk}>
                        <Td>{idx + 1}</Td>
                        <Td fontWeight="semibold" whiteSpace="nowrap">
                          <HStack spacing={2} align="center">
                            <EpBadge kind="epModule" fontSize="xs" />
                            <RouterLink to={`/ep-production/modules/${mod.pk}`}>
                              <Link as="span" color="blue.500">{mod.code}</Link>
                            </RouterLink>
                          </HStack>
                        </Td>
                        <Td whiteSpace="nowrap">{mod.name || <Text as="span" color="gray.400">-</Text>}</Td>
                        <Td isNumeric>{(mod.output_qty ?? 0).toLocaleString()}</Td>
                        <Td isNumeric>{mod.total_qty != null ? mod.total_qty.toLocaleString() : "—"}</Td>
                        <Td isNumeric>{(mod.ep_processes?.length ?? 0).toLocaleString()}</Td>
                        <Td>
                          <StatusBadge status={mod.status ?? "not_started"} fontSize="xs">
                            {mod.status_display}
                          </StatusBadge>
                        </Td>
                      </Tr>
                    ))}
                  </Tbody>
                </Table>
              </TableContainer>
            )}
          </Box>

          {!data.is_deleted && <EpInspectionEntryQr targetParam="ep_sj_no" pk={pk} variant="card" />}
        </Box>
      </Box>

      {/* Delete confirmation dialog */}
      <AlertDialog isOpen={isDeleteOpen} leastDestructiveRef={cancelRef} onClose={onDeleteClose}>
        <AlertDialogOverlay>
          <AlertDialogContent>
            <AlertDialogHeader>{t("ep.common.deleteTitle")}</AlertDialogHeader>
            <AlertDialogBody>{t("ep.common.deleteSjNoConfirm")}</AlertDialogBody>
            <AlertDialogFooter>
              <Button ref={cancelRef} onClick={onDeleteClose}>{t("ep.common.cancel")}</Button>
              <Button colorScheme="red" onClick={handleDelete} isLoading={deleting} ml={3}>
                {t("ep.common.delete")}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>

      <AlertDialog isOpen={isSyncOpen} leastDestructiveRef={syncCancelRef} onClose={onSyncClose}>
        <AlertDialogOverlay>
          <AlertDialogContent>
            <AlertDialogHeader>{t("ep.common.syncFromSourceConfirmTitle")}</AlertDialogHeader>
            <AlertDialogBody>{t("ep.common.syncFromSourceConfirmBodySjNo")}</AlertDialogBody>
            <AlertDialogFooter>
              <Button ref={syncCancelRef} onClick={onSyncClose}>{t("ep.common.cancel")}</Button>
              <Button colorScheme="teal" onClick={confirmSync} isLoading={syncing} ml={3}>
                {t("ep.common.syncConfirm")}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>
    </>
  );
}
