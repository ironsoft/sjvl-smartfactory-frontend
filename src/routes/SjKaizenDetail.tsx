import {
  AspectRatio,
  Badge,
  Box,
  Button,
  Divider,
  Flex,
  Grid,
  HStack,
  Icon,
  IconButton,
  Image,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalOverlay,
  Skeleton,
  Tag,
  Text,
  useColorModeValue,
  useDisclosure,
  useToast,
  VStack
} from "@chakra-ui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  FaArrowLeft,
  FaCalendarAlt,
  FaEdit,
  FaHashtag,
  FaTag,
  FaTrash,
  FaUser,
  FaCheckCircle,
  FaClock
} from "react-icons/fa";
import { Link as RouterLink, useNavigate, useParams } from "react-router-dom";
import { deleteKaizenPost, getKaizenPost } from "../api";
import { IKaizenPhoto, IKaizenVideo, ISjKaizenPost, KaizenCategory } from "../types";
import { useEditorContent } from "./SjKaizenEditorContent";

const CATEGORY_COLORS: Record<KaizenCategory | string, string> = {
  process: "blue",
  quality: "green",
  safety: "orange",
  equipment: "purple",
  other: "gray"
};

function TiptapReadOnly({ content }: { content: Record<string, unknown> }) {
  const { renderContent } = useEditorContent(content);
  const prose = useColorModeValue("gray.800", "gray.100");

  return (
    <Box
      color={prose}
      fontSize="md"
      lineHeight="1.8"
      sx={{
        "h1, h2, h3": { fontWeight: "bold", mt: 6, mb: 2 },
        h1: { fontSize: "2xl" },
        h2: { fontSize: "xl" },
        h3: { fontSize: "lg" },
        p: { mb: 3 },
        ul: { pl: 6, mb: 3, listStyleType: "disc" },
        ol: { pl: 6, mb: 3, listStyleType: "decimal" },
        li: { mb: 1 },
        strong: { fontWeight: "bold" },
        em: { fontStyle: "italic" },
        u: { textDecoration: "underline" },
        a: { color: "blue.400", textDecoration: "underline" },
        img: { borderRadius: "md", my: 4, maxW: "full" }
      }}
      dangerouslySetInnerHTML={{ __html: renderContent }}
    />
  );
}

function MediaGallery({ photos, videos }: { photos: IKaizenPhoto[]; videos: IKaizenVideo[] }) {
  const { t } = useTranslation();
  const { isOpen: isPhotoOpen, onOpen: onPhotoOpen, onClose: onPhotoClose } = useDisclosure();
  const { isOpen: isVideoOpen, onOpen: onVideoOpen, onClose: onVideoClose } = useDisclosure();
  const [selectedPhoto, setSelectedPhoto] = useState<IKaizenPhoto | null>(null);
  const [selectedVideo, setSelectedVideo] = useState<IKaizenVideo | null>(null);
  const bgCard = useColorModeValue("gray.50", "gray.800");
  const borderColor = useColorModeValue("gray.200", "gray.700");
  const captionColor = useColorModeValue("gray.600", "gray.400");
  const videoFallbackBg = useColorModeValue("gray.200", "gray.700");

  if (!photos.length && !videos.length) return null;

  return (
    <Box mt={8}>
      <Text fontWeight="bold" fontSize="lg" mb={4}>
        {t("kaizen.mediaGallery")}
      </Text>

      {/* 사진 그리드 */}
      {photos.length > 0 && (
        <Grid templateColumns={{ base: "1fr 1fr", md: "repeat(3, 1fr)", lg: "repeat(4, 1fr)" }} gap={3} mb={6}>
          {photos.map((p) => (
            <Box
              key={p.pk}
              bg={bgCard}
              borderWidth="1px"
              borderColor={borderColor}
              borderRadius="lg"
              overflow="hidden"
              cursor="pointer"
              transition="all 0.15s"
              _hover={{ shadow: "md", borderColor: "blue.300" }}
              onClick={() => { setSelectedPhoto(p); onPhotoOpen(); }}
            >
              <Image src={p.file} alt={p.description} objectFit="cover" h="120px" w="full" />
              {p.description && (
                <Text fontSize="xs" color={captionColor} px={2} py={1} noOfLines={1}>
                  {p.description}
                </Text>
              )}
            </Box>
          ))}
        </Grid>
      )}

      {/* 비디오 그리드 */}
      {videos.length > 0 && (
        <Grid templateColumns={{ base: "1fr 1fr", md: "repeat(3, 1fr)" }} gap={3}>
          {videos.map((v) => (
            <Box
              key={v.pk}
              bg={bgCard}
              borderWidth="1px"
              borderColor={borderColor}
              borderRadius="lg"
              overflow="hidden"
              cursor="pointer"
              transition="all 0.15s"
              _hover={{ shadow: "md", borderColor: "blue.300" }}
              onClick={() => { setSelectedVideo(v); onVideoOpen(); }}
            >
              <Box h="120px" position="relative">
                {v.ThumbnailFile ? (
                  <Image src={v.ThumbnailFile} objectFit="cover" h="120px" w="full" />
                ) : (
                  <Flex h="120px" align="center" justify="center" bg={videoFallbackBg}>
                    <Text fontSize="2xl">🎬</Text>
                  </Flex>
                )}
                <Box position="absolute" bottom={1} right={1} bg="blackAlpha.700" borderRadius="sm" px={1}>
                  <Text fontSize="xs" color="white">▶</Text>
                </Box>
              </Box>
              {v.description && (
                <Text fontSize="xs" color={captionColor} px={2} py={1} noOfLines={1}>
                  {v.description}
                </Text>
              )}
            </Box>
          ))}
        </Grid>
      )}

      {/* 사진 모달 */}
      <Modal isOpen={isPhotoOpen} onClose={onPhotoClose} size="3xl" isCentered>
        <ModalOverlay />
        <ModalContent>
          <ModalCloseButton />
          <ModalBody p={4}>
            {selectedPhoto && (
              <Image src={selectedPhoto.file} alt={selectedPhoto.description} borderRadius="md" maxH="70vh" mx="auto" />
            )}
            {selectedPhoto?.description && (
              <Text mt={3} textAlign="center" color={captionColor} fontSize="sm">
                {selectedPhoto.description}
              </Text>
            )}
          </ModalBody>
        </ModalContent>
      </Modal>

      {/* 비디오 모달 */}
      <Modal isOpen={isVideoOpen} onClose={onVideoClose} size="3xl" isCentered>
        <ModalOverlay />
        <ModalContent>
          <ModalCloseButton />
          <ModalBody p={4}>
            {selectedVideo?.VideoFile && (
              <AspectRatio ratio={16 / 9}>
                <Box as="iframe" src={selectedVideo.VideoFile} allowFullScreen borderRadius="md" />
              </AspectRatio>
            )}
            {selectedVideo?.description && (
              <Text mt={3} textAlign="center" color={captionColor} fontSize="sm">
                {selectedVideo.description}
              </Text>
            )}
          </ModalBody>
        </ModalContent>
      </Modal>
    </Box>
  );
}

export default function SjKaizenDetail() {
  const { t } = useTranslation();
  const { kaizenId } = useParams<{ kaizenId: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();

  const { data: post, isLoading } = useQuery<ISjKaizenPost>({
    queryKey: ["kaizenPost", kaizenId],
    queryFn: () => getKaizenPost(Number(kaizenId)),
    enabled: !!kaizenId
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteKaizenPost(Number(kaizenId)),
    onSuccess: () => {
      toast({ title: "포스트가 삭제되었습니다.", status: "success", duration: 2000 });
      queryClient.invalidateQueries({ queryKey: ["kaizenPosts"] });
      navigate("/kaizen");
    }
  });

  const bgPage = useColorModeValue("gray.50", "gray.900");
  const bgCard = useColorModeValue("white", "gray.800");
  const borderColor = useColorModeValue("gray.200", "gray.700");
  const textMuted = useColorModeValue("gray.500", "gray.400");
  const headerBg = useColorModeValue("white", "gray.800");

  if (isLoading) {
    return (
      <Box bg={bgPage} minH="100vh" p={{ base: 4, lg: 10 }}>
        <Skeleton h="40px" w="200px" mb={4} />
        <Skeleton h="300px" borderRadius="xl" />
      </Box>
    );
  }

  if (!post) return null;

  const categoryColor = CATEGORY_COLORS[post.category] || "gray";

  const handleDelete = () => {
    if (window.confirm(t("kaizen.deleteConfirm"))) {
      deleteMutation.mutate();
    }
  };

  return (
    <Box bg={bgPage} minH="100vh" pb={16}>
      {/* 상단 네비게이션 바 */}
      <Box bg={headerBg} borderBottomWidth="1px" borderColor={borderColor} py={3} px={{ base: 4, lg: 10 }}>
        <Flex justify="space-between" align="center">
          <Button
            variant="ghost"
            size="sm"
            leftIcon={<Icon as={FaArrowLeft} />}
            onClick={() => navigate("/kaizen")}
          >
            {t("kaizen.back")}
          </Button>
          <HStack spacing={2}>
            <IconButton
              icon={<Icon as={FaEdit} />}
              aria-label="edit"
              size="sm"
              variant="outline"
              colorScheme="blue"
              onClick={() => navigate(`/kaizen/${kaizenId}/edit`)}
            />
            <IconButton
              icon={<Icon as={FaTrash} />}
              aria-label="delete"
              size="sm"
              variant="outline"
              colorScheme="red"
              isLoading={deleteMutation.isPending}
              onClick={handleDelete}
            />
          </HStack>
        </Flex>
      </Box>

      <Box px={{ base: 4, lg: 10 }} pt={6} maxW="860px" mx="auto">
        {/* 헤더 카드 */}
        <Box bg={bgCard} borderWidth="1px" borderColor={borderColor} borderRadius="xl" p={6} mb={6}>
          {/* 카테고리 + 발행 상태 */}
          <HStack mb={3} spacing={2}>
            <Badge colorScheme={categoryColor} borderRadius="full" px={3} py={0.5}>
              {t(`kaizen.category${post.category.charAt(0).toUpperCase() + post.category.slice(1)}`)}
            </Badge>
            <Badge
              colorScheme={post.is_published ? "green" : "yellow"}
              borderRadius="full"
              px={3}
              py={0.5}
            >
              <HStack spacing={1}>
                <Icon as={post.is_published ? FaCheckCircle : FaClock} boxSize={3} />
                <Text>{post.is_published ? t("kaizen.published") : t("kaizen.draft")}</Text>
              </HStack>
            </Badge>
          </HStack>

          {/* 제목 */}
          <Text fontSize="2xl" fontWeight="extrabold" lineHeight="1.3" mb={4}>
            {post.title}
          </Text>

          {/* 메타 정보 */}
          <HStack spacing={4} color={textMuted} fontSize="sm" flexWrap="wrap">
            {post.author_name && (
              <HStack spacing={1}>
                <Icon as={FaUser} boxSize={3.5} />
                <Text>{post.author_name}</Text>
              </HStack>
            )}
            <HStack spacing={1}>
              <Icon as={FaCalendarAlt} boxSize={3.5} />
              <Text>{new Date(post.created_at).toLocaleDateString("ko-KR")}</Text>
            </HStack>
            {post.updated_at !== post.created_at && (
              <Text fontSize="xs" color={textMuted}>
                수정: {new Date(post.updated_at).toLocaleDateString("ko-KR")}
              </Text>
            )}
          </HStack>

          {/* 연결 태그 */}
          {(post.sj_style_code || post.sj_no_value || post.factory_name || post.module_info || post.process_info) && (
            <>
              <Divider my={4} />
              <HStack spacing={2} flexWrap="wrap">
                {post.sj_style_code && (
                  <Tag size="md" colorScheme="teal" borderRadius="full" cursor="pointer"
                    onClick={() => navigate(`/sjstyles/${post.sj_style}`)}>
                    <Icon as={FaTag} mr={1} boxSize={3} />
                    {post.sj_style_code}{post.sj_style_name && ` (${post.sj_style_name})`}
                  </Tag>
                )}
                {post.sj_no_value && (
                  <Tag size="md" colorScheme="cyan" borderRadius="full" cursor="pointer"
                    onClick={() => navigate(`/sjnos/${post.sj_no}`)}>
                    <Icon as={FaHashtag} mr={1} boxSize={3} />
                    {post.sj_no_value}
                  </Tag>
                )}
                {post.factory_name && (
                  <Tag size="md" colorScheme="purple" borderRadius="full">
                    🏭 {post.factory_name}{post.production_line_name && ` / ${post.production_line_name}`}
                  </Tag>
                )}
                {post.module_info && (
                  <Tag size="md" colorScheme="orange" borderRadius="full">
                    📦 {post.module_info.code}{post.module_info.name && ` — ${post.module_info.name}`}
                  </Tag>
                )}
                {post.process_info && (
                  <Tag size="md" colorScheme="blue" borderRadius="full">
                    ⚙️ {post.process_info.code}{post.process_info.name && ` — ${post.process_info.name}`}
                  </Tag>
                )}
              </HStack>
            </>
          )}
        </Box>

        {/* 본문 */}
        <Box bg={bgCard} borderWidth="1px" borderColor={borderColor} borderRadius="xl" p={6} mb={6}>
          {post.content && Object.keys(post.content).length > 0 ? (
            <TiptapReadOnly content={post.content} />
          ) : (
            <Text color={textMuted} fontSize="sm" textAlign="center" py={8}>
              내용이 없습니다.
            </Text>
          )}
        </Box>

        {/* 미디어 갤러리 */}
        {((post.photos?.length ?? 0) > 0 || (post.videos?.length ?? 0) > 0) && (
          <Box bg={bgCard} borderWidth="1px" borderColor={borderColor} borderRadius="xl" p={6}>
            <MediaGallery photos={post.photos ?? []} videos={post.videos ?? []} />
          </Box>
        )}
      </Box>
    </Box>
  );
}
