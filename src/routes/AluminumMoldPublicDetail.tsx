import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { Helmet } from "react-helmet";
import {
  Box,
  Center,
  Divider,
  Flex,
  HStack,
  Image,
  SimpleGrid,
  Spinner,
  Text,
  VStack,
  Badge,
  useColorModeValue,
} from "@chakra-ui/react";
import {
  getAluminumMoldDetailPublic,
  getAluminumMoldPhotosPublic,
  IFilePhotos,
} from "../api";

export default function AluminumMoldPublicDetail() {
  const { aluminumMoldId } = useParams<{ aluminumMoldId: string }>();

  const cardBg = useColorModeValue("white", "gray.800");
  const pageBg = useColorModeValue("gray.50", "gray.900");
  const labelColor = useColorModeValue("gray.500", "gray.400");
  const borderColor = useColorModeValue("gray.200", "gray.700");
  const footerBg = useColorModeValue("gray.50", "gray.700");

  const { data: item, isLoading, isError } = useQuery({
    queryKey: ["aluminumMoldPublic", aluminumMoldId],
    queryFn: () => getAluminumMoldDetailPublic(aluminumMoldId!),
    enabled: !!aluminumMoldId,
    retry: false,
  });

  const { data: photos = [] } = useQuery<IFilePhotos[]>({
    queryKey: ["aluminumMoldPhotosPublic", aluminumMoldId],
    queryFn: () => getAluminumMoldPhotosPublic(aluminumMoldId!),
    enabled: !!aluminumMoldId,
    retry: false,
  });

  const displayPhotos = photos.filter((p) => p.description !== "QR Code");

  if (isLoading) {
    return (
      <Center minH="100vh" bg={pageBg}>
        <Spinner size="xl" color="teal.400" />
      </Center>
    );
  }

  if (isError || !item) {
    return (
      <Center minH="100vh" bg={pageBg}>
        <Text color="red.400" fontSize="lg">데이터를 불러올 수 없습니다.</Text>
      </Center>
    );
  }

  return (
    <Box bg={pageBg} minH="100vh" px={{ base: 4, md: 8 }} py={8}>
      <Helmet>
        <title>{item.name} — Aluminum Mold</title>
      </Helmet>

      <Box maxW="480px" mx="auto" bg={cardBg} borderRadius="xl" boxShadow="md" overflow="hidden">
        {/* 헤더 */}
        <Box bg="teal.600" px={5} py={4}>
          <Flex align="center" gap={3}>
            <Box>
              <Text fontSize="xs" color="teal.200" fontWeight="medium" mb={0.5}>Aluminum Mold</Text>
              <Text fontSize="xl" fontWeight="bold" color="white">{item.name}</Text>
            </Box>
          </Flex>
        </Box>

        <VStack align="stretch" spacing={0} divider={<Divider borderColor={borderColor} />} px={5} py={4}>
          {/* 시리얼 번호 */}
          <Flex justify="space-between" align="center" py={2.5}>
            <Text fontSize="sm" color={labelColor}>시리얼 번호</Text>
            <Text fontSize="sm" fontWeight="semibold">{item.serial_number || "-"}</Text>
          </Flex>

          {/* 상태 */}
          {item.status_display && (
            <Flex justify="space-between" align="center" py={2.5}>
              <Text fontSize="sm" color={labelColor}>상태</Text>
              <Badge colorScheme="teal">{item.status_display}</Badge>
            </Flex>
          )}

          {/* 보관 위치 */}
          {item.location_detail && (
            <Flex justify="space-between" align="center" py={2.5}>
              <Text fontSize="sm" color={labelColor}>보관 위치</Text>
              <Text fontSize="sm" fontWeight="semibold">{item.location_detail.code}</Text>
            </Flex>
          )}

          {/* SJ Style */}
          {item.sj_style_detail && (
            <Flex justify="space-between" align="center" py={2.5}>
              <Text fontSize="sm" color={labelColor}>SJ Style</Text>
              <Text fontSize="sm" fontWeight="semibold">
                {item.sj_style_detail.code}
                {item.sj_style_detail.style_name && (
                  <Text as="span" fontWeight="normal" color={labelColor} ml={1}>
                    {item.sj_style_detail.style_name}
                  </Text>
                )}
              </Text>
            </Flex>
          )}

          {/* 설명 */}
          {item.description && (
            <Box py={2.5}>
              <Text fontSize="sm" color={labelColor} mb={1}>설명</Text>
              <Text fontSize="sm" whiteSpace="pre-wrap">{item.description}</Text>
            </Box>
          )}
        </VStack>

        {/* 사진 */}
        {displayPhotos.length > 0 && (
          <Box px={5} pb={5}>
            <Text fontSize="sm" color={labelColor} mb={3} fontWeight="medium">사진</Text>
            <SimpleGrid columns={3} spacing={2}>
              {displayPhotos.map((photo) => (
                <Box key={photo.pk} borderRadius="md" overflow="hidden" border="1px solid" borderColor={borderColor}>
                  <Image
                    src={photo.file}
                    alt={photo.description || "photo"}
                    w="full"
                    h="100px"
                    objectFit="cover"
                  />
                </Box>
              ))}
            </SimpleGrid>
          </Box>
        )}

        {/* 푸터 */}
        <Box bg={footerBg} px={5} py={3}>
          <HStack justify="center" spacing={2}>
            <img src="/sungjin_logo.png" alt="SJ" style={{ height: "20px", width: "auto" }} />
            <Text fontSize="xs" color={labelColor}>SJ Smart Factory</Text>
          </HStack>
        </Box>
      </Box>
    </Box>
  );
}
