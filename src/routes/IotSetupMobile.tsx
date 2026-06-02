import {
  Box,
  Button,
  Divider,
  FormControl,
  FormLabel,
  HStack,
  Heading,
  Input,
  Spinner,
  Text,
  VStack,
  useToast,
} from "@chakra-ui/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import {
  getEpProcessIoTSetup,
  saveEpProcessIoTSetup,
  IHotColdPressSetup,
} from "../api";

export default function IotSetupMobile() {
  const { processPk } = useParams<{ processPk: string }>();
  const pk = Number(processPk);
  const toast = useToast();
  const queryClient = useQueryClient();

  const [stdHotTemp, setStdHotTemp] = useState("145.0");
  const [stdColdTemp, setStdColdTemp] = useState("25.0");
  const [stdHotDuration, setStdHotDuration] = useState("30.0");
  const [stdColdDuration, setStdColdDuration] = useState("30.0");
  const [stdCycleDuration, setStdCycleDuration] = useState("60.0");
  const [toleranceTemp, setToleranceTemp] = useState("5.0");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const { data: setup, isLoading } = useQuery<IHotColdPressSetup | null>({
    queryKey: ["iotSetupMobile", pk],
    queryFn: () => getEpProcessIoTSetup(pk),
    enabled: !!pk,
  });

  useEffect(() => {
    if (setup) {
      setStdHotTemp(setup.std_hot_temp_c ?? "145.0");
      setStdColdTemp(setup.std_cold_temp_c ?? "25.0");
      setStdHotDuration(setup.std_hot_duration_s ?? "30.0");
      setStdColdDuration(setup.std_cold_duration_s ?? "30.0");
      setStdCycleDuration(setup.std_cycle_duration_s ?? "60.0");
      setToleranceTemp(setup.tolerance_temp_c ?? "5.0");
    }
  }, [setup]);

  const handleSave = async () => {
    if (!setup?.machine_iot_id) {
      toast({ title: "Machine IoT ID is not configured.", status: "warning", duration: 2000 });
      return;
    }
    setSaving(true);
    setSaved(false);
    try {
      await saveEpProcessIoTSetup(pk, {
        machine_iot_id: setup.machine_iot_id,
        std_hot_temp_c: stdHotTemp,
        std_cold_temp_c: stdColdTemp,
        std_hot_duration_s: stdHotDuration,
        std_cold_duration_s: stdColdDuration,
        std_cycle_duration_s: stdCycleDuration,
        tolerance_temp_c: toleranceTemp,
      });
      queryClient.invalidateQueries({ queryKey: ["iotSetupMobile", pk] });
      setSaved(true);
      toast({ title: "✅ Saved successfully", status: "success", duration: 2000, position: "top" });
    } catch {
      toast({ title: "Failed to save", status: "error", duration: 2000, position: "top" });
    }
    setSaving(false);
  };

  if (isLoading) {
    return (
      <Box minH="100vh" display="flex" alignItems="center" justifyContent="center" bg="gray.50">
        <VStack spacing={3}>
          <Spinner size="xl" color="teal.500" />
          <Text color="gray.500">Loading settings…</Text>
        </VStack>
      </Box>
    );
  }

  if (!setup) {
    return (
      <Box minH="100vh" display="flex" alignItems="center" justifyContent="center" bg="gray.50" px={6}>
        <VStack spacing={3} textAlign="center">
          <Text fontSize="3xl">⚙️</Text>
          <Heading size="md" color="gray.600">No setup found</Heading>
          <Text fontSize="sm" color="gray.400">Please connect an IoT machine from the PC first.</Text>
        </VStack>
      </Box>
    );
  }

  return (
    <Box minH="100vh" bg="gray.50" pb={10} style={{ colorScheme: "light" }}>
      {/* Header */}
      <Box bg="teal.600" px={5} pt={10} pb={6} color="white">
        <Text fontSize="xs" opacity={0.75} mb={1}>Hot &amp; Cold Press IoT</Text>
        <Heading size="lg" fontWeight="bold">Standard Settings</Heading>
        <HStack mt={2} spacing={2}>
          <Box w="8px" h="8px" borderRadius="full" bg={setup.is_connected ? "green.300" : "gray.400"} />
          <Text fontSize="sm" opacity={0.9}>
            Machine IoT ID: <b>{setup.machine_iot_id}</b>
            {" — "}{setup.is_connected ? "Connected" : "Not connected"}
          </Text>
        </HStack>
      </Box>

      <VStack spacing={5} px={5} pt={6} align="stretch">
        {/* HOT Phase */}
        <Box bg="orange.50" border="2px solid" borderColor="orange.200" borderRadius="xl" p={5}>
          <HStack mb={4} spacing={2}>
            <Text fontSize="lg">🔥</Text>
            <Text fontWeight="bold" color="orange.600" fontSize="md">HOT Phase</Text>
          </HStack>
          <VStack spacing={4}>
            <FormControl>
              <FormLabel fontSize="sm" color="orange.700" fontWeight="semibold">
                Standard Temperature (°C)
              </FormLabel>
              <Input
                type="number"
                step="0.1"
                size="lg"
                bg="white"
                color="gray.800"
                fontSize="xl"
                textAlign="center"
                value={stdHotTemp}
                onChange={(e) => { setStdHotTemp(e.target.value); setSaved(false); }}
                borderColor="orange.300"
                _focus={{ borderColor: "orange.500", boxShadow: "0 0 0 2px var(--chakra-colors-orange-200)" }}
              />
            </FormControl>
            <FormControl>
              <FormLabel fontSize="sm" color="orange.700" fontWeight="semibold">
                Standard Press Duration (s)
              </FormLabel>
              <Input
                type="number"
                step="0.1"
                size="lg"
                bg="white"
                color="gray.800"
                fontSize="xl"
                textAlign="center"
                value={stdHotDuration}
                onChange={(e) => { setStdHotDuration(e.target.value); setSaved(false); }}
                borderColor="orange.300"
                _focus={{ borderColor: "orange.500", boxShadow: "0 0 0 2px var(--chakra-colors-orange-200)" }}
              />
            </FormControl>
          </VStack>
        </Box>

        {/* COLD Phase */}
        <Box bg="blue.50" border="2px solid" borderColor="blue.200" borderRadius="xl" p={5}>
          <HStack mb={4} spacing={2}>
            <Text fontSize="lg">❄️</Text>
            <Text fontWeight="bold" color="blue.600" fontSize="md">COLD Phase</Text>
          </HStack>
          <VStack spacing={4}>
            <FormControl>
              <FormLabel fontSize="sm" color="blue.700" fontWeight="semibold">
                Standard Temperature (°C)
              </FormLabel>
              <Input
                type="number"
                step="0.1"
                size="lg"
                bg="white"
                color="gray.800"
                fontSize="xl"
                textAlign="center"
                value={stdColdTemp}
                onChange={(e) => { setStdColdTemp(e.target.value); setSaved(false); }}
                borderColor="blue.300"
                _focus={{ borderColor: "blue.500", boxShadow: "0 0 0 2px var(--chakra-colors-blue-200)" }}
              />
            </FormControl>
            <FormControl>
              <FormLabel fontSize="sm" color="blue.700" fontWeight="semibold">
                Standard Press Duration (s)
              </FormLabel>
              <Input
                type="number"
                step="0.1"
                size="lg"
                bg="white"
                color="gray.800"
                fontSize="xl"
                textAlign="center"
                value={stdColdDuration}
                onChange={(e) => { setStdColdDuration(e.target.value); setSaved(false); }}
                borderColor="blue.300"
                _focus={{ borderColor: "blue.500", boxShadow: "0 0 0 2px var(--chakra-colors-blue-200)" }}
              />
            </FormControl>
          </VStack>
        </Box>

        <Divider />

        {/* Cycle / Tolerance */}
        <Box bg="white" border="1px solid" borderColor="gray.200" borderRadius="xl" p={5}>
          <Text fontWeight="semibold" mb={4} color="gray.700">🔄 Cycle &amp; Tolerance</Text>
          <VStack spacing={4}>
            <FormControl>
              <FormLabel fontSize="sm" fontWeight="semibold" color="gray.600">
                Standard Total Cycle Duration (s)
              </FormLabel>
              <Input
                type="number"
                step="0.1"
                size="lg"
                bg="gray.50"
                color="gray.800"
                fontSize="xl"
                textAlign="center"
                value={stdCycleDuration}
                onChange={(e) => { setStdCycleDuration(e.target.value); setSaved(false); }}
              />
            </FormControl>
            <FormControl>
              <FormLabel fontSize="sm" fontWeight="semibold" color="gray.600">
                Temperature Tolerance (°C)
              </FormLabel>
              <Input
                type="number"
                step="0.1"
                size="lg"
                bg="gray.50"
                color="gray.800"
                fontSize="xl"
                textAlign="center"
                value={toleranceTemp}
                onChange={(e) => { setToleranceTemp(e.target.value); setSaved(false); }}
              />
            </FormControl>
          </VStack>
        </Box>

        {/* Save button */}
        <Button
          size="lg"
          colorScheme={saved ? "green" : "teal"}
          isLoading={saving}
          loadingText="Saving…"
          onClick={handleSave}
          h="56px"
          fontSize="lg"
          borderRadius="xl"
          boxShadow="md"
        >
          {saved ? "✅ Saved" : "💾 Save"}
        </Button>

        <Text fontSize="xs" color="gray.400" textAlign="center">
          Changes will be applied to the connected IoT device immediately.
        </Text>
      </VStack>
    </Box>
  );
}
