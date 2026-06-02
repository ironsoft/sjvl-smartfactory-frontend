import { useQuery } from "@tanstack/react-query";
import { getToolDetail } from "../api";
import { useParams, Link as RouterLink } from "react-router-dom";
import { Helmet } from "react-helmet";
import {
  Box,
  Heading,
  Text,
  Stack,
  Badge,
  Link,
  useColorModeValue,
  Icon,
  HStack,
  Divider,
  Button,
  Spinner,
  Center
} from "@chakra-ui/react";
import { RiFlashlightFill } from "react-icons/ri";

interface ITool {
  id?: number;
  name?: string;
  description?: string;
  category?: string;
  url?: string;
  created_at?: string;

  location?: string;
}
export default function ToolDetail() {
  const { toolId } = useParams();
  console.log("toolId", toolId);
  const {
    data: toolData,
    isLoading: isToolLoading,
    error
  } = useQuery<ITool>({
    queryKey: [`toolDetail`, toolId],
    queryFn: () => {
      if (typeof toolId === "string") {
        return getToolDetail(toolId);
      }
      throw new Error("toolId is not a string");
    }
  });

  const cardBg = useColorModeValue("white", "gray.800");
  const pageBg = useColorModeValue("gray.50", "gray.900");
  const labelColor = useColorModeValue("gray.500", "gray.400");
  console.log("toolData", toolData);

  if (isToolLoading) {
    return (
      <>
        <Helmet>
          <title>Loading... Tool Detail</title>
        </Helmet>
        <Center minH="60vh">
          <Spinner size="lg" />
        </Center>
      </>
    );
  }

  if (error || !toolData) {
    return (
      <>
        <Helmet>
          <title>Tool Not Found</title>
        </Helmet>
        <Center minH="60vh">
          <Box textAlign="center">
            <Heading size="md" mb={2}>
              Tool 정보를 불러올 수 없습니다.
            </Heading>
            <Text color="gray.500" mb={4}>
              잠시 후 다시 시도해 주세요.
            </Text>
            <Button as={RouterLink} to="/tools" colorScheme="blue">
              도구 목록으로 돌아가기
            </Button>
          </Box>
        </Center>
      </>
    );
  }

  return (
    <>
      <Helmet>
        <title>{toolData?.name ?? "Tool Detail"}</title>
      </Helmet>
      <Box bg={pageBg} minH="100vh" py={{ base: 6, md: 10 }}>
        <Box
          maxW={{ base: "3xl", lg: "5xl" }}
          mx="auto"
          px={{ base: 4, md: 8 }}
        >
          <Button as={RouterLink} to="/tools" variant="ghost" size="sm" mb={4}>
            ← Go back to tool list
          </Button>

          <Box
            bg={cardBg}
            borderRadius="xl"
            boxShadow="lg"
            p={{ base: 5, md: 8 }}
          >
            <HStack justify="space-between" align="flex-start" mb={4}>
              <Box>
                <Heading size="lg" mb={2}>
                  {toolData.name ?? "Tool Detail"}
                </Heading>
                <HStack spacing={3}>
                  {toolData.category && (
                    <Badge colorScheme="blue">{toolData.category}</Badge>
                  )}
                  {toolData.location && (
                    <Badge colorScheme="green">위치: {toolData.location}</Badge>
                  )}
                </HStack>
              </Box>
              <Button
                leftIcon={<Icon as={RiFlashlightFill} />}
                colorScheme="yellow"
                variant="outline"
              >
                Light Test
              </Button>
            </HStack>

            <Divider my={4} />

            <Stack spacing={4}>
              <Box>
                <Text fontSize="sm" color={labelColor} mb={1}>
                  설명
                </Text>
                <Text>
                  {toolData.description
                    ? toolData.description
                    : "No description"}
                </Text>
              </Box>

              <Box>
                <Text fontSize="sm" color={labelColor} mb={1}>
                  보관 위치
                </Text>
                <Text>{toolData.location ?? "No location"}</Text>
              </Box>

              <Box>
                <Text fontSize="sm" color={labelColor} mb={1}>
                  도구 URL
                </Text>
                {toolData.url ? (
                  <Link
                    href={toolData.url}
                    color="blue.500"
                    isExternal
                    wordBreak="break-all"
                  >
                    {toolData.url}
                  </Link>
                ) : (
                  <Text>No url</Text>
                )}
              </Box>

              <Box>
                <Text fontSize="sm" color={labelColor} mb={1}>
                  등록 일시
                </Text>
                <Text>{toolData.created_at ?? "No created date"}</Text>
              </Box>
            </Stack>
          </Box>
        </Box>
      </Box>
    </>
  );
}
