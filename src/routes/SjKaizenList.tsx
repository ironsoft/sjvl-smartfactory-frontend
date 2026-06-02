import {
  Badge,
  Box,
  Button,
  Flex,
  Grid,
  HStack,
  Icon,
  IconButton,
  Image,
  Input,
  InputGroup,
  InputLeftElement,
  Select,
  Skeleton,
  Tag,
  Text,
  useColorModeValue,
  VStack
} from "@chakra-ui/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { FaCalendarAlt, FaPlus, FaSearch, FaTag, FaUser } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { getKaizenPosts } from "../api";
import { ISjKaizenListResponse, ISjKaizenPost, KaizenCategory } from "../types";

const CATEGORY_OPTIONS: { value: KaizenCategory | ""; labelKey: string }[] = [
  { value: "", labelKey: "kaizen.filterAll" },
  { value: "process", labelKey: "kaizen.categoryProcess" },
  { value: "quality", labelKey: "kaizen.categoryQuality" },
  { value: "safety", labelKey: "kaizen.categorySafety" },
  { value: "equipment", labelKey: "kaizen.categoryEquipment" },
  { value: "other", labelKey: "kaizen.categoryOther" }
];

const CATEGORY_COLORS: Record<KaizenCategory | string, string> = {
  process: "blue",
  quality: "green",
  safety: "orange",
  equipment: "purple",
  other: "gray"
};

function KaizenCard({ post }: { post: ISjKaizenPost }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const cardBg = useColorModeValue("white", "gray.800");
  const borderColor = useColorModeValue("gray.100", "gray.700");
  const textMuted = useColorModeValue("gray.500", "gray.400");
  const titleColor = useColorModeValue("gray.800", "gray.100");

  const categoryColor = CATEGORY_COLORS[post.category] || "gray";

  return (
    <Box
      bg={cardBg}
      borderWidth="1px"
      borderColor={borderColor}
      borderRadius="xl"
      overflow="hidden"
      cursor="pointer"
      transition="all 0.2s"
      _hover={{ transform: "translateY(-2px)", shadow: "md", borderColor: "blue.300" }}
      onClick={() => navigate(`/kaizen/${post.id}`)}
    >
      {/* 썸네일: style 사진 우선, 없으면 thumbnail_url, 없으면 기본 아이콘 */}
      <Box h="160px" bg={useColorModeValue("gray.100", "gray.700")} overflow="hidden" position="relative">
        {(post.sj_style_thumbnail || post.thumbnail_url) ? (
          <Image
            src={post.sj_style_thumbnail || post.thumbnail_url}
            alt={post.title}
            w="full"
            h="full"
            objectFit="cover"
          />
        ) : (
          <Flex h="full" align="center" justify="center">
            <Text fontSize="3xl">✏️</Text>
          </Flex>
        )}
        {/* Style 코드 오버레이 배지 */}
        {post.sj_style_code && (
          <Badge
            position="absolute"
            bottom={2}
            left={2}
            colorScheme="teal"
            borderRadius="md"
            px={2}
            fontSize="xs"
            bg="teal.500"
            color="white"
            backdropFilter="blur(4px)"
          >
            {post.sj_style_code}
          </Badge>
        )}
      </Box>

      <VStack align="start" p={4} spacing={2}>
        {/* 카테고리 + 발행 상태 */}
        <HStack spacing={2} flexWrap="wrap">
          <Badge colorScheme={categoryColor} borderRadius="full" px={2} fontSize="xs">
            {t(`kaizen.category${post.category.charAt(0).toUpperCase() + post.category.slice(1)}`)}
          </Badge>
          {!post.is_published && (
            <Badge colorScheme="yellow" borderRadius="full" px={2} fontSize="xs">
              {t("kaizen.draft")}
            </Badge>
          )}
          {post.factory_name && (
            <Badge colorScheme="purple" borderRadius="full" px={2} fontSize="xs">
              {post.factory_name}
            </Badge>
          )}
        </HStack>

        {/* 제목 */}
        <Text
          fontWeight="bold"
          fontSize="sm"
          color={titleColor}
          noOfLines={2}
          lineHeight="1.4"
        >
          {post.title}
        </Text>

        {/* SJ No 태그 */}
        {post.sj_no_value && (
          <Tag size="sm" colorScheme="cyan" borderRadius="full">
            #{post.sj_no_value}
          </Tag>
        )}
        {/* 스타일명 */}
        {post.sj_style_name && (
          <Text fontSize="xs" color={textMuted} noOfLines={1}>{post.sj_style_name}</Text>
        )}

        {/* 메타 */}
        <HStack spacing={3} color={textMuted} fontSize="xs" pt={1}>
          {post.author_name && (
            <HStack spacing={1}>
              <Icon as={FaUser} boxSize={2.5} />
              <Text>{post.author_name}</Text>
            </HStack>
          )}
          <HStack spacing={1}>
            <Icon as={FaCalendarAlt} boxSize={2.5} />
            <Text>{new Date(post.created_at).toLocaleDateString()}</Text>
          </HStack>
        </HStack>
      </VStack>
    </Box>
  );
}

function KaizenCardSkeleton() {
  return (
    <Box borderWidth="1px" borderRadius="xl" overflow="hidden">
      <Skeleton h="160px" />
      <VStack align="start" p={4} spacing={2}>
        <Skeleton h="20px" w="60px" borderRadius="full" />
        <Skeleton h="16px" w="full" />
        <Skeleton h="16px" w="80%" />
        <Skeleton h="20px" w="70px" borderRadius="full" />
      </VStack>
    </Box>
  );
}

export default function SjKaizenList() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<KaizenCategory | "">("");
  const [published, setPublished] = useState<"" | "true" | "false">("");
  const [page, setPage] = useState(1);
  const [posts, setPosts] = useState<ISjKaizenPost[]>([]);

  const searchRef = useRef<HTMLInputElement>(null);

  const { data, isLoading, refetch } = useQuery<ISjKaizenListResponse>({
    queryKey: ["kaizenPosts", page, search, category, published],
    queryFn: () =>
      getKaizenPosts({
        page,
        search: search || undefined,
        category: category || undefined,
        published: published === "" ? undefined : published === "true"
      })
  });

  useEffect(() => {
    if (data?.results) {
      setPosts((prev) => (page === 1 ? data.results : [...prev, ...data.results]));
    }
  }, [data, page]);

  const handleSearch = () => {
    setSearch(searchInput);
    setPage(1);
    setPosts([]);
    queryClient.removeQueries({ queryKey: ["kaizenPosts"] });
  };

  const handleFilterChange = (newCategory: KaizenCategory | "", newPublished: "" | "true" | "false") => {
    setCategory(newCategory);
    setPublished(newPublished);
    setPage(1);
    setPosts([]);
    queryClient.removeQueries({ queryKey: ["kaizenPosts"] });
  };

  const bgPage = useColorModeValue("gray.50", "gray.900");
  const headerBg = useColorModeValue("white", "gray.800");
  const borderColor = useColorModeValue("gray.200", "gray.700");
  const textMuted = useColorModeValue("gray.500", "gray.400");

  return (
    <Box bg={bgPage} minH="100vh" pb={16}>
      {/* 헤더 영역 */}
      <Box bg={headerBg} borderBottomWidth="1px" borderColor={borderColor} py={6} px={{ base: 4, lg: 10 }}>
        <Flex justify="space-between" align="center" mb={4}>
          <VStack align="start" spacing={0}>
            <Text fontSize="2xl" fontWeight="extrabold" letterSpacing="tight">
              {t("kaizen.pageTitle")}
            </Text>
            <Text fontSize="sm" color={textMuted}>
              {t("kaizen.pageSubtitle")}
            </Text>
          </VStack>
          <Button
            leftIcon={<Icon as={FaPlus} />}
            colorScheme="blue"
            size="sm"
            onClick={() => navigate("/kaizen/new")}
          >
            {t("kaizen.newPost")}
          </Button>
        </Flex>

        {/* 검색 + 필터 */}
        <Flex gap={3} flexWrap="wrap" align="center">
          <InputGroup maxW="340px" size="sm">
            <InputLeftElement pointerEvents="none">
              <Icon as={FaSearch} color="gray.400" />
            </InputLeftElement>
            <Input
              ref={searchRef}
              placeholder={t("kaizen.search")}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              borderRadius="full"
              bg={useColorModeValue("gray.50", "gray.700")}
            />
          </InputGroup>
          <Button size="sm" onClick={handleSearch} borderRadius="full">
            {t("kaizen.search").replace("...", "")}
          </Button>

          {/* 카테고리 */}
          <Select
            size="sm"
            maxW="160px"
            borderRadius="full"
            value={category}
            onChange={(e) =>
              handleFilterChange(e.target.value as KaizenCategory | "", published)
            }
          >
            {CATEGORY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {t(opt.labelKey)}
              </option>
            ))}
          </Select>

          {/* 발행 상태 */}
          <Select
            size="sm"
            maxW="140px"
            borderRadius="full"
            value={published}
            onChange={(e) =>
              handleFilterChange(category, e.target.value as "" | "true" | "false")
            }
          >
            <option value="">{t("kaizen.allPosts")}</option>
            <option value="true">{t("kaizen.publishedOnly")}</option>
            <option value="false">{t("kaizen.draftOnly")}</option>
          </Select>

          {data && (
            <Text fontSize="xs" color={textMuted} ml="auto">
              총 {data.total_results}건
            </Text>
          )}
        </Flex>
      </Box>

      {/* 카드 그리드 */}
      <Box px={{ base: 4, lg: 10 }} pt={6}>
        <Grid
          templateColumns={{
            base: "1fr",
            sm: "repeat(2, 1fr)",
            lg: "repeat(3, 1fr)",
            xl: "repeat(4, 1fr)"
          }}
          gap={5}
        >
          {isLoading && page === 1
            ? Array.from({ length: 8 }).map((_, i) => <KaizenCardSkeleton key={i} />)
            : posts.map((post) => <KaizenCard key={post.id} post={post} />)}
        </Grid>

        {/* 빈 상태 */}
        {!isLoading && posts.length === 0 && (
          <Flex direction="column" align="center" justify="center" py={20} gap={3}>
            <Text fontSize="4xl">📝</Text>
            <Text color={textMuted}>{t("kaizen.noResults")}</Text>
            <Button
              colorScheme="blue"
              variant="outline"
              size="sm"
              onClick={() => navigate("/kaizen/new")}
            >
              {t("kaizen.newPost")}
            </Button>
          </Flex>
        )}

        {/* 더보기 */}
        {data && page < data.total_pages && (
          <Flex justify="center" mt={8}>
            <Button
              colorScheme="blue"
              variant="outline"
              onClick={() => setPage((p) => p + 1)}
              isLoading={isLoading}
            >
              {t("kaizen.loadMore")}
            </Button>
          </Flex>
        )}
      </Box>
    </Box>
  );
}
