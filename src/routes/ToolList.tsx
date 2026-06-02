import {
  Box,
  Heading,
  Stat,
  StatLabel,
  StatNumber,
  Table,
  TableContainer,
  Tbody,
  Td,
  Th,
  Thead,
  Tr,
  useColorModeValue,
  Spinner,
  Center,
  Text,
  Button,
  useToast,
  Link
} from "@chakra-ui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Helmet } from "react-helmet";
import { getTools, toolLightOn } from "../api";
import { RiFlashlightFill } from "react-icons/ri";
import { Link as RouterLink } from "react-router-dom";

interface ITool {
  id?: number;
  name?: string;
  description?: string;
  category?: string;
  url?: string;
  created_at?: string;
  location?: string;
}

export default function ToolList() {
  const { data, isLoading, error } = useQuery<ITool[] | { tools: ITool[] }>({
    queryKey: ["tools"],
    queryFn: getTools
  });
  console.log("data", data);

  const tableBgColor = useColorModeValue("gray.50", "gray.800");
  const toast = useToast();
  const queryClient = useQueryClient();
  const toolLightOnMutation = useMutation({
    mutationFn: toolLightOn,
    onSuccess: () => {
      toast({
        title: "Light ON",
        description: "Light is On"
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Error"
      });
    }
  });

  const onToolLightOn = (toolId: string) => {
    toolLightOnMutation.mutate(toolId);
    toast({
      title: "Light ON",
      description: "Light is On",
      status: "success",
      duration: 2000,
      isClosable: true,
      position: "bottom-right"
    });
    queryClient.invalidateQueries({ queryKey: ["tools"] });
  };

  if (isLoading) {
    return (
      <>
        <Helmet>
          <title>Loading... 도구 목록</title>
        </Helmet>
        <Center py={10}>
          <Spinner size="lg" />
        </Center>
      </>
    );
  }

  if (error) {
    return (
      <Center py={10}>
        <Text color="red.500">
          도구 목록을 불러오는 중 오류가 발생했습니다.
        </Text>
      </Center>
    );
  }

  const tools: ITool[] = Array.isArray(data)
    ? data
    : data && "tools" in data
      ? (data.tools as ITool[])
      : [];

  const totalTools = tools.length;

  return (
    <>
      <Helmet>
        <title>{totalTools ? "" : "Loading..."} 도구 목록</title>
      </Helmet>
      <Box
        maxW={{ base: "3xl", lg: "8xl" }}
        mx="auto"
        px={{ base: "4", md: "8", lg: "12" }}
        py={{ base: "6", md: "8", lg: "8" }}
      >
        <Heading size={"md"} mb={"5"}>
          Tool List
        </Heading>
        <Stat mb={"5"}>
          <StatLabel>총 도구 개수</StatLabel>
          <StatNumber>{totalTools}</StatNumber>
        </Stat>

        <TableContainer>
          <Table variant="simple">
            <Thead bgColor={tableBgColor}>
              <Tr>
                <Th>Name</Th>
                <Th>Description</Th>
                <Th>Category</Th>
                <Th>URL</Th>
                <Th>Location</Th>
                <Th isNumeric>Light</Th>
              </Tr>
            </Thead>
            <Tbody>
              {tools.map((tool, index) => (
                <Tr key={tool.id ?? index}>
                  <Td>
                    <Link
                      as={RouterLink}
                      to={`/tools/${tool.id ?? index + 1}`}
                      color="blue.500"
                    >
                      {tool.name ?? `Tool ${index + 1}`}
                    </Link>
                  </Td>
                  <Td>
                    {tool.description ? (
                      tool.description
                    ) : (
                      <Text color="gray.400">No description</Text>
                    )}
                  </Td>
                  <Td>{tool.category ?? "-"}</Td>
                  <Td>
                    {tool.url ? (
                      <a
                        href={tool.url}
                        target="_blank"
                        rel="noreferrer"
                        style={{ color: "#3182ce" }}
                      >
                        Link
                      </a>
                    ) : (
                      "-"
                    )}
                  </Td>
                  <Td>{tool.location ?? "-"}</Td>
                  <Td isNumeric>
                    <Button
                      size="sm"
                      leftIcon={<RiFlashlightFill />}
                      colorScheme="yellow"
                      variant="outline"
                      onClick={() => onToolLightOn(tool.id?.toString() ?? "")}
                    >
                      Light
                    </Button>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </TableContainer>
      </Box>
    </>
  );
}
