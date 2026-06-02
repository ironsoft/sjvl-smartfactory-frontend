import {
  Alert,
  AlertIcon,
  Box,
  Button,
  Center,
  FormControl,
  FormHelperText,
  FormLabel,
  Heading,
  HStack,
  Input,
  Spinner,
  Text,
  Textarea,
  useColorModeValue,
  useToast
} from "@chakra-ui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Helmet } from "react-helmet";
import { Link as RouterLink, useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useEffect, useMemo, useState } from "react";
import {
  getVlAssemblyModuleProductionDailyOutput,
  patchVlAssemblyModuleProductionDailyOutput,
  deleteVlAssemblyModuleProductionDailyOutput,
  IVlAssemblyModuleProductionDailyOutput
} from "../api";
import { FaArrowLeft, FaTrash } from "react-icons/fa";
import useUser from "../lib/useUser";

export default function VlAssemblyModuleProductionDailyOutputDetail() {
  const { outputId } = useParams<{ outputId: string }>();
  const pk = Number(outputId);
  const { t } = useTranslation();
  const toast = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useUser();
  const isWorker = user?.role === "worker";
  const pageBg = useColorModeValue("gray.50", "gray.900");
  const cardBg = useColorModeValue("white", "gray.800");
  const border = useColorModeValue("gray.200", "gray.600");
  const labelColor = useColorModeValue("gray.500", "gray.400");

  const [qty, setQty] = useState("");
  const [recordedAt, setRecordedAt] = useState("");
  const [remark, setRemark] = useState("");
  const [editing, setEditing] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["vlModuleDailyOutputDetail", pk],
    queryFn: () => getVlAssemblyModuleProductionDailyOutput(pk),
    enabled: Number.isFinite(pk)
  });

  const row = data as IVlAssemblyModuleProductionDailyOutput | undefined;

  const totalQty = row?.vl_assembly_module_total_qty ?? null;
  const cumulative = row?.vl_assembly_module_output_qty ?? 0;
  const maxQtyForThisRow = useMemo(() => {
    if (!row || totalQty == null) return undefined;
    return Math.max(0, totalQty - cumulative + row.qty);
  }, [row, totalQty, cumulative]);

  useEffect(() => {
    if (!data) return;
    const d = data as IVlAssemblyModuleProductionDailyOutput;
    setQty(String(d.qty));
    const dt = new Date(d.recorded_at);
    const pad = (n: number) => String(n).padStart(2, "0");
    setRecordedAt(
      `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}`
    );
    setRemark(d.remark || "");
    setEditing(false);
  }, [data]);

  const patchMut = useMutation({
    mutationFn: () => {
      const q = Number(qty);
      if (!Number.isFinite(q) || q < 1) throw new Error("qty");
      let recorded_iso: string | undefined;
      if (recordedAt) {
        const d = new Date(recordedAt);
        if (!Number.isNaN(d.getTime())) recorded_iso = d.toISOString();
      }
      return patchVlAssemblyModuleProductionDailyOutput(pk, {
        qty: q,
        recorded_at: recorded_iso,
        remark: remark.trim()
      });
    },
    onSuccess: (resp) => {
      const r = resp as IVlAssemblyModuleProductionDailyOutput;
      toast({ title: t("vlAssembly.dailyOutput.updated"), status: "success" });
      setEditing(false);
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: ["epModuleDetail", r.vl_assembly_module] }),
        queryClient.invalidateQueries({
          queryKey: ["epSchedule", String(r.vl_assembly_schedule_pk)]
        }),
        queryClient.invalidateQueries({ queryKey: ["vlModuleDailyOutputDetail", pk] }),
        queryClient.invalidateQueries({ queryKey: ["vlModuleDailyOutputs"] }),
      ]);
    },
    onError: (err: unknown) => {
      const ax = err as { response?: { data?: { qty?: string[] } } };
      const msg =
        ax?.response?.data?.qty?.[0] ?? t("vlAssembly.dailyOutput.updateError");
      toast({ title: msg, status: "error" });
    }
  });

  const deleteMut = useMutation({
    mutationFn: () => deleteVlAssemblyModuleProductionDailyOutput(pk),
    onSuccess: () => {
      toast({ title: t("vlAssembly.dailyOutput.deleted"), status: "success" });
      navigate("/vl-assembly-production/module-daily-outputs");
      if (row?.vl_assembly_module != null) {
        void queryClient.invalidateQueries({ queryKey: ["epModuleDetail", row.vl_assembly_module] });
      }
      if (row?.vl_assembly_schedule_pk != null) {
        void queryClient.invalidateQueries({
          queryKey: ["epSchedule", String(row.vl_assembly_schedule_pk)]
        });
      }
      void queryClient.invalidateQueries({ queryKey: ["vlModuleDailyOutputs"] });
    }
  });

  if (!Number.isFinite(pk)) {
    return (
      <Center minH="50vh">
        <Text>Invalid id</Text>
      </Center>
    );
  }

  return (
    <>
      <Helmet>
        <title>{t("vlAssembly.moduleDailyOutput.detailTitle", { id: pk })}</title>
      </Helmet>
      <Box bg={pageBg} minH="100vh" px={{ base: 3, md: 5 }} py={6}>
        <Box maxW="880px" mx="auto">
          <Button
            as={RouterLink}
            to="/vl-assembly-production/module-daily-outputs"
            size="sm"
            variant="ghost"
            leftIcon={<FaArrowLeft />}
            mb={4}
          >
            {t("vlAssembly.dailyOutput.backToList")}
          </Button>

          {isLoading || !row ? (
            <Center py={20}>
              <Spinner />
            </Center>
          ) : (
            <>
              <Heading size="md" mb={4}>
                {t("vlAssembly.moduleDailyOutput.detailTitle", { id: row.pk })}
              </Heading>
              {isWorker && (
                <Alert status="info" borderRadius="md" mb={4} fontSize="sm">
                  <AlertIcon />
                  {t("vlAssembly.dailyOutput.workerReadOnlyDetail")}
                </Alert>
              )}
              <Box
                bg={cardBg}
                borderRadius="md"
                borderWidth="1px"
                borderColor={border}
                p={5}
              >
                <Text fontSize="xs" color={labelColor} mb={1}>
                  {t("vlAssembly.dailyOutput.colPo")}
                </Text>
                <Text mb={3}>{row.sj_po_number}</Text>
                <Text fontSize="xs" color={labelColor} mb={1}>
                  {t("vlAssembly.dailyOutput.colSjNo")} /{" "}
                  {t("vlAssembly.dailyOutput.colModule")}
                </Text>
                <Text mb={3}>
                  {row.vl_assembly_sj_no} / {row.vl_assembly_module_code}
                </Text>
                <Button
                  as={RouterLink}
                  to={`/vl-assembly-production/modules/${row.vl_assembly_module}`}
                  size="sm"
                  variant="link"
                  colorScheme="blue"
                  mb={2}
                >
                  {t("vlAssembly.moduleDailyOutput.linkModule")}
                </Button>
                <Box
                  fontSize="sm"
                  mb={4}
                  p={3}
                  borderRadius="md"
                  bg="gray.50"
                  _dark={{ bg: "gray.700" }}
                >
                  <Text mb={1}>
                    {t("vlAssembly.moduleDailyOutput.modalModuleTotalQty")}:{" "}
                    <Text as="span" fontWeight="bold">
                      {totalQty != null ? totalQty.toLocaleString() : "—"}
                    </Text>
                  </Text>
                  <Text
                    mb={2}
                    mt={2}
                    fontWeight="semibold"
                    fontSize="xs"
                    color="gray.600"
                  >
                    {t("vlAssembly.moduleDailyOutput.moduleCumulativeSection")}
                  </Text>
                  <Text mb={1} pl={2} fontSize="sm">
                    {t("vlAssembly.dailyOutput.cumulativeAtSaveRecord")}:{" "}
                    <Text as="span" fontWeight="bold" color="teal.600">
                      {row.module_cumulative_snapshot != null
                        ? row.module_cumulative_snapshot.toLocaleString()
                        : "—"}
                    </Text>
                  </Text>
                  <Text mb={1} pl={2} fontSize="sm">
                    {t("vlAssembly.dailyOutput.cumulativeActualNow")}:{" "}
                    <Text as="span" fontWeight="bold" color="blue.600">
                      {cumulative.toLocaleString()}
                    </Text>
                  </Text>
                  <Text mt={2} fontSize="sm">
                    {t("vlAssembly.dailyOutput.modalRemainingForThisEntry")}:{" "}
                    <Text as="span" fontWeight="bold" color="green.600">
                      {maxQtyForThisRow !== undefined
                        ? maxQtyForThisRow.toLocaleString()
                        : "—"}
                    </Text>
                  </Text>
                </Box>

                <FormControl
                  mb={3}
                  isInvalid={Boolean(
                    maxQtyForThisRow !== undefined &&
                    qty !== "" &&
                    Number(qty) > maxQtyForThisRow
                  )}
                >
                  <FormLabel fontSize="sm">{t("vlAssembly.dailyOutput.qty")}</FormLabel>
                  <Input
                    type="number"
                    min={maxQtyForThisRow === 0 ? 0 : 1}
                    max={
                      maxQtyForThisRow !== undefined && maxQtyForThisRow > 0
                        ? maxQtyForThisRow
                        : undefined
                    }
                    value={qty}
                    isReadOnly={isWorker}
                    onChange={(e) => {
                      setEditing(true);
                      const raw = e.target.value;
                      if (maxQtyForThisRow === undefined) {
                        setQty(raw);
                        return;
                      }
                      if (raw === "") {
                        setQty("");
                        return;
                      }
                      const n = parseInt(raw, 10);
                      if (Number.isNaN(n)) {
                        setQty(raw);
                        return;
                      }
                      setQty(
                        String(Math.min(Math.max(0, n), maxQtyForThisRow))
                      );
                    }}
                  />
                  <FormHelperText>
                    {totalQty == null
                      ? t("vlAssembly.moduleDailyOutput.noModuleTotal")
                      : maxQtyForThisRow === 0
                        ? t("vlAssembly.dailyOutput.qtyRemainingZeroEdit")
                        : t("vlAssembly.dailyOutput.qtyCapHintEdit", {
                            max: maxQtyForThisRow
                          })}
                  </FormHelperText>
                </FormControl>
                <FormControl mb={3}>
                  <FormLabel fontSize="sm">
                    {t("vlAssembly.dailyOutput.recordedAt")}
                  </FormLabel>
                  <Input
                    type="datetime-local"
                    value={recordedAt}
                    isReadOnly={isWorker}
                    onChange={(e) => {
                      setEditing(true);
                      setRecordedAt(e.target.value);
                    }}
                  />
                </FormControl>
                <FormControl mb={4}>
                  <FormLabel fontSize="sm">
                    {t("vlAssembly.dailyOutput.remark")}
                  </FormLabel>
                  <Textarea
                    value={remark}
                    isReadOnly={isWorker}
                    onChange={(e) => {
                      setEditing(true);
                      setRemark(e.target.value);
                    }}
                    rows={3}
                  />
                </FormControl>

                {!isWorker && (
                  <HStack>
                    <Button
                      colorScheme="blue"
                      size="sm"
                      onClick={() => patchMut.mutate()}
                      isLoading={patchMut.isPending}
                      isDisabled={(() => {
                        if (!editing) return true;
                        const q = Number(qty);
                        if (!Number.isFinite(q) || q < 1) return true;
                        if (
                          maxQtyForThisRow !== undefined &&
                          (maxQtyForThisRow === 0 || q > maxQtyForThisRow)
                        )
                          return true;
                        return false;
                      })()}
                    >
                      {t("vlAssembly.dailyOutput.save")}
                    </Button>
                    <Button
                      colorScheme="red"
                      size="sm"
                      variant="outline"
                      leftIcon={<FaTrash />}
                      onClick={() => {
                        if (window.confirm(t("vlAssembly.dailyOutput.deleteConfirm")))
                          deleteMut.mutate();
                      }}
                      isLoading={deleteMut.isPending}
                    >
                      {t("vlAssembly.dailyOutput.delete")}
                    </Button>
                  </HStack>
                )}

                <Text fontSize="xs" color={labelColor} mt={4}>
                  {t("vlAssembly.dailyOutput.colBy")}: {row.recorded_by_name ?? "—"}
                </Text>
              </Box>
            </>
          )}
        </Box>
      </Box>
    </>
  );
}
