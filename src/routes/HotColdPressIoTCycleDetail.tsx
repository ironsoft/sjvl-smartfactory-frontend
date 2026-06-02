import {
  AlertDialog,
  AlertDialogBody,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogOverlay,
  Badge,
  Box,
  Button,
  Divider,
  Flex,
  FormControl,
  FormLabel,
  Grid,
  GridItem,
  HStack,
  Heading,
  Input,
  Spinner,
  Text,
  useColorModeValue,
  useDisclosure,
  useToast,
} from "@chakra-ui/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Helmet } from "react-helmet";
import { FaArrowLeft, FaEdit, FaTrash } from "react-icons/fa";
import { Link as RouterLink, useNavigate, useParams } from "react-router-dom";
import {
  deleteHotColdPressCycle,
  getHotColdPressCycleDetail,
  updateHotColdPressCycle,
} from "../api";
import { hotColdPressKeys } from "../lib/queryKeys";

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDatetime(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleString("en-US", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
  } catch {
    return iso;
  }
}

function DiffBadge({
  diff,
  unit,
  tolerance,
}: {
  diff: number | null;
  unit: string;
  tolerance: number;
}) {
  if (diff === null) return <Badge colorScheme="gray" fontSize="10px">no std</Badge>;
  const ok = Math.abs(diff) <= tolerance;
  const sign = diff > 0 ? "+" : "";
  return (
    <Badge colorScheme={ok ? "green" : "red"} fontSize="10px" px={2}>
      {sign}{diff}{unit} vs std
    </Badge>
  );
}

// ── Field components ──────────────────────────────────────────────────────────

function StatField({
  label,
  value,
  unit,
  editValue,
  onEdit,
  editing,
  diffBadge,
  accent,
}: {
  label: string;
  value: string | null;
  unit: string;
  editValue: string;
  onEdit: (v: string) => void;
  editing: boolean;
  diffBadge?: React.ReactNode;
  accent?: "hot" | "cold";
}) {
  const hotBg = useColorModeValue("orange.50", "rgba(251,146,60,0.08)");
  const coldBg = useColorModeValue("blue.50", "rgba(96,165,250,0.08)");
  const bg = accent === "hot" ? hotBg : accent === "cold" ? coldBg : undefined;
  const borderColor = useColorModeValue("gray.200", "gray.600");

  return (
    <Box
      p={3}
      border="1px solid"
      borderColor={borderColor}
      borderRadius="md"
      bg={bg}
    >
      <Text fontSize="11px" fontWeight="semibold" color="gray.500" mb={1}>
        {label}
      </Text>
      {editing ? (
        <FormControl>
          <Input
            size="sm"
            type="number"
            step="0.1"
            value={editValue}
            onChange={(e) => onEdit(e.target.value)}
            bg="white"
          />
        </FormControl>
      ) : (
        <>
          <Text fontSize="lg" fontWeight="bold">
            {value !== null && value !== undefined
              ? `${parseFloat(value).toFixed(2)} ${unit}`
              : "—"}
          </Text>
          {diffBadge && <Box mt={1}>{diffBadge}</Box>}
        </>
      )}
    </Box>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

interface FormState {
  hot_temp_avg_c: string;
  hot_temp_max_c: string;
  cold_temp_avg_c: string;
  cold_temp_max_c: string;
  hot_duration_s: string;
  cold_duration_s: string;
  duration_s: string;
  temp_max_c: string;
  temp_avg_c: string;
  current_max_a: string;
}

export default function HotColdPressIoTCycleDetail() {
  const { cycleId } = useParams<{ cycleId: string }>();
  const pk = parseInt(cycleId ?? "0", 10);
  const toast = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FormState>({
    hot_temp_avg_c: "",
    hot_temp_max_c: "",
    cold_temp_avg_c: "",
    cold_temp_max_c: "",
    hot_duration_s: "",
    cold_duration_s: "",
    duration_s: "",
    temp_max_c: "",
    temp_avg_c: "",
    current_max_a: "",
  });

  const {
    isOpen: isDeleteOpen,
    onOpen: onDeleteOpen,
    onClose: onDeleteClose,
  } = useDisclosure();
  const cancelRef = useRef<HTMLButtonElement>(null);

  const borderColor = useColorModeValue("gray.200", "gray.600");
  const headerBg = useColorModeValue("gray.50", "gray.750");
  const labelColor = useColorModeValue("gray.500", "gray.400");

  const { data: cycle, isLoading } = useQuery({
    queryKey: hotColdPressKeys.cycleDetail(pk),
    queryFn: () => getHotColdPressCycleDetail(pk),
    enabled: !!pk,
  });

  useEffect(() => {
    if (cycle) {
      setForm({
        hot_temp_avg_c: cycle.hot_temp_avg_c ?? "",
        hot_temp_max_c: cycle.hot_temp_max_c ?? "",
        cold_temp_avg_c: cycle.cold_temp_avg_c ?? "",
        cold_temp_max_c: cycle.cold_temp_max_c ?? "",
        hot_duration_s: cycle.hot_duration_s ?? "",
        cold_duration_s: cycle.cold_duration_s ?? "",
        duration_s: cycle.duration_s ?? "",
        temp_max_c: cycle.temp_max_c ?? "",
        temp_avg_c: cycle.temp_avg_c ?? "",
        current_max_a: cycle.current_max_a ?? "",
      });
    }
  }, [cycle]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const patchData: Partial<FormState> = {};
      for (const key of Object.keys(form) as (keyof FormState)[]) {
        if (form[key] !== "") patchData[key] = form[key];
      }
      await updateHotColdPressCycle(pk, patchData);
      queryClient.invalidateQueries({
        queryKey: hotColdPressKeys.cycleDetail(pk),
      });
      queryClient.invalidateQueries({ queryKey: ["hcPressAllCycles"] });
      setEditing(false);
      toast({
        title: "Saved.",
        status: "success",
        duration: 2000,
        position: "bottom-right",
      });
    } catch {
      toast({
        title: "Failed to save.",
        status: "error",
        duration: 2000,
        position: "bottom-right",
      });
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    try {
      await deleteHotColdPressCycle(pk);
      queryClient.invalidateQueries({ queryKey: ["hcPressAllCycles"] });
      toast({
        title: "Deleted.",
        status: "success",
        duration: 2000,
        position: "bottom-right",
      });
      navigate("/ep-production/iot-press-cycles");
    } catch {
      toast({
        title: "Failed to delete.",
        status: "error",
        duration: 2000,
        position: "bottom-right",
      });
      onDeleteClose();
    }
  };

  const f = (key: keyof FormState) => form[key];
  const setF = (key: keyof FormState) => (v: string) =>
    setForm((prev) => ({ ...prev, [key]: v }));

  if (isLoading) {
    return (
      <Flex justify="center" py={16}>
        <Spinner size="lg" />
      </Flex>
    );
  }

  if (!cycle) {
    return (
      <Box px={8} py={16} textAlign="center">
        <Text color={labelColor}>Cycle data not found.</Text>
        <Button
          as={RouterLink}
          to="/ep-production/iot-press-cycles"
          mt={4}
          size="sm"
          variant="outline"
        >
          Back to list
        </Button>
      </Box>
    );
  }

  const cycleDate = cycle.started_at.slice(0, 10);

  return (
    <Box px={{ base: 4, md: 8 }} py={6} maxW="1000px" mx="auto">
      <Helmet>
        <title>{`HC Press Cycle #${cycle.cycle_no}`}</title>
      </Helmet>

      {/* ── Breadcrumb / Back ── */}
      <HStack mb={4} spacing={2} flexWrap="wrap">
        <Button
          as={RouterLink}
          to={`/ep-production/iot-press-cycles?date=${cycleDate}`}
          size="sm"
          variant="ghost"
          leftIcon={<FaArrowLeft />}
        >
          HC Press IoT Record
        </Button>
        <Text color={labelColor} fontSize="sm">
          /
        </Text>
        <Text fontSize="sm" fontWeight="semibold">
          Cycle #{cycle.cycle_no} — {cycle.machine_iot_id} · {cycle.process_code}
        </Text>
      </HStack>

      {/* ── Title bar ── */}
      <Flex
        align="center"
        justify="space-between"
        mb={5}
        flexWrap="wrap"
        gap={3}
      >
        <Heading size="md">
          🔥❄️ Cycle #{cycle.cycle_no}
        </Heading>
        <HStack spacing={2}>
          {editing ? (
            <>
              <Button
                size="sm"
                colorScheme="teal"
                isLoading={saving}
                onClick={handleSave}
              >
                Save
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setEditing(false)}
              >
                Cancel
              </Button>
            </>
          ) : (
            <>
              <Button
                size="sm"
                leftIcon={<FaEdit />}
                variant="outline"
                onClick={() => setEditing(true)}
              >
                Edit
              </Button>
              <Button
                size="sm"
                leftIcon={<FaTrash />}
                colorScheme="red"
                variant="outline"
                onClick={onDeleteOpen}
              >
                Delete
              </Button>
            </>
          )}
        </HStack>
      </Flex>

      {/* ── Meta info card ── */}
      <Box
        mb={5}
        p={4}
        border="1px solid"
        borderColor={borderColor}
        borderRadius="lg"
        bg={headerBg}
      >
        <Grid
          templateColumns={{ base: "1fr 1fr", md: "repeat(4, 1fr)" }}
          gap={4}
        >
          <GridItem>
            <Text fontSize="11px" color={labelColor} fontWeight="semibold" mb={1}>
              Machine IoT ID
            </Text>
            <Text fontSize="sm" fontWeight="bold">
              {cycle.machine_iot_id}
            </Text>
          </GridItem>
          <GridItem>
            <Text fontSize="11px" color={labelColor} fontWeight="semibold" mb={1}>
              Process
            </Text>
            <Text fontSize="sm" fontWeight="bold">
              {cycle.process_code}
            </Text>
          </GridItem>
          <GridItem>
            <Text fontSize="11px" color={labelColor} fontWeight="semibold" mb={1}>
              Start
            </Text>
            <Text fontSize="sm">{formatDatetime(cycle.started_at)}</Text>
          </GridItem>
          <GridItem>
            <Text fontSize="11px" color={labelColor} fontWeight="semibold" mb={1}>
              End
            </Text>
            <Text fontSize="sm">{formatDatetime(cycle.ended_at)}</Text>
          </GridItem>
        </Grid>
      </Box>

      {/* ── HOT Phase ── */}
      <Box mb={4}>
        <HStack mb={3} spacing={2}>
          <Text fontSize="sm">🔥</Text>
          <Text fontSize="sm" fontWeight="bold" color="orange.500">
            HOT Phase
          </Text>
        </HStack>
        <Grid
          templateColumns={{ base: "1fr 1fr", md: "repeat(3, 1fr)" }}
          gap={3}
        >
          <StatField
            label="Avg Temperature"
            value={cycle.hot_temp_avg_c}
            unit="°C"
            editValue={f("hot_temp_avg_c")}
            onEdit={setF("hot_temp_avg_c")}
            editing={editing}
            diffBadge={
              <DiffBadge
                diff={cycle.hot_temp_avg_diff}
                unit="°C"
                tolerance={5}
              />
            }
            accent="hot"
          />
          <StatField
            label="Max Temperature"
            value={cycle.hot_temp_max_c}
            unit="°C"
            editValue={f("hot_temp_max_c")}
            onEdit={setF("hot_temp_max_c")}
            editing={editing}
            accent="hot"
          />
          <StatField
            label="Press Duration"
            value={cycle.hot_duration_s}
            unit="s"
            editValue={f("hot_duration_s")}
            onEdit={setF("hot_duration_s")}
            editing={editing}
            diffBadge={
              <DiffBadge
                diff={cycle.hot_duration_diff}
                unit="s"
                tolerance={5}
              />
            }
            accent="hot"
          />
        </Grid>
      </Box>

      <Divider mb={4} />

      {/* ── COLD Phase ── */}
      <Box mb={4}>
        <HStack mb={3} spacing={2}>
          <Text fontSize="sm">❄️</Text>
          <Text fontSize="sm" fontWeight="bold" color="blue.500">
            COLD Phase
          </Text>
        </HStack>
        <Grid
          templateColumns={{ base: "1fr 1fr", md: "repeat(3, 1fr)" }}
          gap={3}
        >
          <StatField
            label="Avg Temperature"
            value={cycle.cold_temp_avg_c}
            unit="°C"
            editValue={f("cold_temp_avg_c")}
            onEdit={setF("cold_temp_avg_c")}
            editing={editing}
            diffBadge={
              <DiffBadge
                diff={cycle.cold_temp_avg_diff}
                unit="°C"
                tolerance={5}
              />
            }
            accent="cold"
          />
          <StatField
            label="Max Temperature"
            value={cycle.cold_temp_max_c}
            unit="°C"
            editValue={f("cold_temp_max_c")}
            onEdit={setF("cold_temp_max_c")}
            editing={editing}
            accent="cold"
          />
          <StatField
            label="Press Duration"
            value={cycle.cold_duration_s}
            unit="s"
            editValue={f("cold_duration_s")}
            onEdit={setF("cold_duration_s")}
            editing={editing}
            diffBadge={
              <DiffBadge
                diff={cycle.cold_duration_diff}
                unit="s"
                tolerance={5}
              />
            }
            accent="cold"
          />
        </Grid>
      </Box>

      <Divider mb={4} />

      {/* ── Overall ── */}
      <Box mb={6}>
        <Text fontSize="sm" fontWeight="bold" color="gray.600" mb={3}>
          Overall
        </Text>
        <Grid
          templateColumns={{ base: "1fr 1fr", md: "repeat(4, 1fr)" }}
          gap={3}
        >
          <StatField
            label="Total Cycle Duration"
            value={cycle.duration_s}
            unit="s"
            editValue={f("duration_s")}
            onEdit={setF("duration_s")}
            editing={editing}
            diffBadge={
              <DiffBadge
                diff={cycle.cycle_duration_diff}
                unit="s"
                tolerance={5}
              />
            }
          />
          <StatField
            label="Peak Temperature"
            value={cycle.temp_max_c}
            unit="°C"
            editValue={f("temp_max_c")}
            onEdit={setF("temp_max_c")}
            editing={editing}
          />
          <StatField
            label="Avg Temperature"
            value={cycle.temp_avg_c}
            unit="°C"
            editValue={f("temp_avg_c")}
            onEdit={setF("temp_avg_c")}
            editing={editing}
          />
          <StatField
            label="Max Current"
            value={cycle.current_max_a}
            unit="A"
            editValue={f("current_max_a")}
            onEdit={setF("current_max_a")}
            editing={editing}
          />
        </Grid>
      </Box>

      {/* ── Delete confirmation ── */}
      <AlertDialog
        isOpen={isDeleteOpen}
        leastDestructiveRef={cancelRef}
        onClose={onDeleteClose}
        isCentered
      >
        <AlertDialogOverlay>
          <AlertDialogContent>
            <AlertDialogHeader fontSize="md" fontWeight="bold">
              Delete Cycle
            </AlertDialogHeader>
            <AlertDialogBody>
              Delete Cycle #{cycle.cycle_no} ({cycle.machine_iot_id} · {cycle.process_code})?
              This action cannot be undone.
            </AlertDialogBody>
            <AlertDialogFooter>
              <Button ref={cancelRef} onClick={onDeleteClose} size="sm">
                Cancel
              </Button>
              <Button
                colorScheme="red"
                onClick={handleDelete}
                ml={3}
                size="sm"
              >
                Delete
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>
    </Box>
  );
}
