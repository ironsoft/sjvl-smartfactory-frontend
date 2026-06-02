import {
  Alert,
  AlertIcon,
  Box,
  Button,
  Center,
  FormControl,
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
import { useEffect, useState } from "react";
import {
  getVlAssemblyScheduleProductionDailyOutput,
  patchVlAssemblyScheduleProductionDailyOutput,
  deleteVlAssemblyScheduleProductionDailyOutput,
  IVlAssemblyScheduleProductionDailyOutput
} from "../api";
import { FaArrowLeft, FaTrash } from "react-icons/fa";
import useUser from "../lib/useUser";

export default function VlAssemblyScheduleProductionDailyOutputDetail() {
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
    queryKey: ["vlScheduleProductionDailyOutputDetail", pk],
    queryFn: () => getVlAssemblyScheduleProductionDailyOutput(pk),
    enabled: Number.isFinite(pk)
  });

  const row = data as IVlAssemblyScheduleProductionDailyOutput | undefined;

  useEffect(() => {
    if (!data) return;
    const d = data as IVlAssemblyScheduleProductionDailyOutput;
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
      return patchVlAssemblyScheduleProductionDailyOutput(pk, {
        qty: q,
        recorded_at: recorded_iso,
        remark: remark.trim()
      });
    },
    onSuccess: (resp) => {
      const r = resp as IVlAssemblyScheduleProductionDailyOutput;
      toast({
        title: t("vlAssembly.scheduleProductionDailyOutput.updated"),
        status: "success"
      });
      setEditing(false);
      void queryClient.invalidateQueries({
        queryKey: ["vlScheduleProductionDailyOutputDetail", pk]
      });
      void queryClient.invalidateQueries({
        queryKey: ["vlScheduleProductionDailyOutputs"]
      });
      void queryClient.invalidateQueries({
        queryKey: ["vlSjNoScheduleProductionDailyOutputs"]
      });
      void queryClient.invalidateQueries({
        queryKey: ["vlSjNoScheduleProductionDailyOutputChart"]
      });
      void queryClient.invalidateQueries({
        queryKey: ["epSchedule", String(r.vl_assembly_schedule)]
      });
      void queryClient.invalidateQueries({ queryKey: ["vlSchedules"] });
    },
    onError: (err: unknown) => {
      const ax = err as { response?: { data?: { qty?: string[] } } };
      const msg =
        ax?.response?.data?.qty?.[0] ??
        t("vlAssembly.scheduleProductionDailyOutput.updateError");
      toast({ title: msg, status: "error" });
    }
  });

  const deleteMut = useMutation({
    mutationFn: () => deleteVlAssemblyScheduleProductionDailyOutput(pk),
    onSuccess: () => {
      toast({
        title: t("vlAssembly.scheduleProductionDailyOutput.deleted"),
        status: "success"
      });
      navigate("/vl-assembly-production/schedule-daily-outputs");
      if (row?.vl_assembly_schedule != null) {
        void queryClient.invalidateQueries({
          queryKey: ["epSchedule", String(row.vl_assembly_schedule)]
        });
        void queryClient.invalidateQueries({ queryKey: ["vlSchedules"] });
      }
      void queryClient.invalidateQueries({
        queryKey: ["vlScheduleProductionDailyOutputs"]
      });
      void queryClient.invalidateQueries({
        queryKey: ["vlSjNoScheduleProductionDailyOutputs"]
      });
      void queryClient.invalidateQueries({
        queryKey: ["vlSjNoScheduleProductionDailyOutputChart"]
      });
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
        <title>
          {t("vlAssembly.scheduleProductionDailyOutput.detailTitle", { id: pk })}
        </title>
      </Helmet>
      <Box bg={pageBg} minH="100vh" px={{ base: 3, md: 5 }} py={6}>
        <Box maxW="880px" mx="auto">
          <Button
            as={RouterLink}
            to="/vl-assembly-production/schedule-daily-outputs"
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
                {t("vlAssembly.scheduleProductionDailyOutput.detailTitle", {
                  id: row.pk
                })}
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
                <Text mb={3}>{row.sj_po_number ?? "—"}</Text>
                <Text fontSize="xs" color={labelColor} mb={1}>
                  {t("vlAssembly.scheduleProductionDailyOutput.colSchedulePk")}
                </Text>
                <Button
                  as={RouterLink}
                  to={`/vl-assembly-production/${row.vl_assembly_schedule}`}
                  size="sm"
                  variant="link"
                  colorScheme="blue"
                  mb={4}
                >
                  {t("vlAssembly.scheduleProductionDailyOutput.linkSchedule", {
                    pk: row.vl_assembly_schedule
                  })}
                </Button>

                <Text fontSize="xs" color="gray.600" mb={2}>
                  {t("vlAssembly.scheduleProductionDailyOutput.cumulativeHint")}
                </Text>
                <Text fontSize="sm" mb={4} pl={2}>
                  {t("vlAssembly.scheduleProductionDailyOutput.colScheduleCumulative")}:{" "}
                  <Text as="span" fontWeight="bold" color="teal.600">
                    {row.schedule_cumulative_snapshot != null
                      ? row.schedule_cumulative_snapshot.toLocaleString()
                      : "—"}
                  </Text>
                </Text>

                <FormControl mb={3}>
                  <FormLabel fontSize="sm">
                    {t("vlAssembly.dailyOutput.qty")}
                  </FormLabel>
                  <Input
                    type="number"
                    min={1}
                    value={qty}
                    isReadOnly={isWorker}
                    onChange={(e) => {
                      setEditing(true);
                      setQty(e.target.value);
                    }}
                  />
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
                        if (
                          window.confirm(
                            t("vlAssembly.scheduleProductionDailyOutput.deleteConfirm")
                          )
                        )
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
