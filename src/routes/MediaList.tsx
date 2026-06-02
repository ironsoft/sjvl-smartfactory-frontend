import {
  Box,
  Button,
  ButtonGroup,
  Flex,
  HStack,
  Icon,
  IconButton,
  Image,
  Skeleton,
  Text,
  useDisclosure
} from "@chakra-ui/react";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { FaChevronLeft, FaChevronRight, FaImage, FaPlay, FaPlus, FaVideo } from "react-icons/fa";
import {
  getSjmediaList,
  IFilePhotos,
  IFileVideos,
  ISjmediaListResponse
} from "../api";
import SearchInput from "../components/SearchInput";
import UploadMediaModal from "../components/UploadMediaModal";

type MediaTab = "photo" | "video";

type MediaItem =
  | { kind: "photo"; data: IFilePhotos }
  | { kind: "video"; data: IFileVideos };

// 화면에 보일 때 자동 재생되는 비디오 카드
function AutoPlayVideoCard({
  video,
  index,
  onClick
}: {
  video: IFileVideos;
  index: number;
  onClick: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [thumbnail, setThumbnail] = useState<string>(video.ThumbnailFile || "");

  const isCloudflare = video.VideoFile?.includes("cloudflarestream.com");

  // 일반 비디오 파일의 썸네일 자동 생성
  useEffect(() => {
    if (video.ThumbnailFile || !video.VideoFile || isCloudflare) return;
    const vid = document.createElement("video");
    vid.src = video.VideoFile;
    vid.crossOrigin = "anonymous";
    vid.muted = true;
    vid.currentTime = 1;
    vid.addEventListener(
      "seeked",
      () => {
        const canvas = document.createElement("canvas");
        canvas.width = vid.videoWidth;
        canvas.height = vid.videoHeight;
        canvas.getContext("2d")?.drawImage(vid, 0, 0);
        setThumbnail(canvas.toDataURL("image/jpeg"));
      },
      { once: true }
    );
    vid.load();
  }, [video.VideoFile, video.ThumbnailFile, isCloudflare]);

  // 일반 비디오 자동 재생 (Intersection Observer)
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.play().then(() => setIsPlaying(true)).catch(() => {});
        } else {
          el.pause();
          setIsPlaying(false);
        }
      },
      { threshold: 0.5 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <Box
      mb={3}
      overflow="hidden"
      rounded="2xl"
      display="inline-block"
      w="100%"
      position="relative"
      _hover={{ transform: "scale(1.02)", transition: "transform 0.3s" }}
    >
      {isCloudflare ? (
        <Box w="100%" sx={{ aspectRatio: "16 / 9" }} position="relative" overflow="hidden">
          <Image
            src={video.ThumbnailFile}
            fallbackSrc={`https://picsum.photos/seed/${video.pk}/400/${260 + (index % 4) * 50}`}
            alt={video.description}
            w="100%"
            h="100%"
            objectFit="cover"
          />
        </Box>
      ) : video.VideoFile ? (
        <video
          ref={videoRef}
          src={video.VideoFile}
          poster={thumbnail || undefined}
          muted
          loop
          playsInline
          style={{ width: "100%", display: "block", objectFit: "cover" }}
        />
      ) : (
        <Image
          src={video.ThumbnailFile}
          fallbackSrc={`https://picsum.photos/seed/${video.pk}/400/${260 + (index % 4) * 50}`}
          alt={video.description}
          w="100%"
          display="block"
          objectFit="cover"
        />
      )}

      {!isPlaying && (
        <Box
          position="absolute"
          top="50%"
          left="50%"
          transform="translate(-50%, -50%)"
          bg="blackAlpha.600"
          rounded="full"
          w="48px"
          h="48px"
          display="flex"
          alignItems="center"
          justifyContent="center"
        >
          <FaPlay color="white" size="18px" />
        </Box>
      )}

      {video.description && (
        <Text
          position="absolute"
          bottom={2}
          left={3}
          color="white"
          fontSize="xs"
          fontWeight="semibold"
          noOfLines={1}
          textShadow="0 1px 3px rgba(0,0,0,0.8)"
        >
          {video.description}
        </Text>
      )}

      <Box position="absolute" inset={0} cursor="pointer" onClick={onClick} />
    </Box>
  );
}

// 페이지네이션 컴포넌트
function Pagination({
  currentPage,
  totalPages,
  onPageChange
}: {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  if (totalPages <= 1) return null;

  // 현재 페이지 주변 최대 5개 페이지 번호 생성
  const getPageNumbers = () => {
    const pages: number[] = [];
    const delta = 2;
    const left = Math.max(1, currentPage - delta);
    const right = Math.min(totalPages, currentPage + delta);
    for (let i = left; i <= right; i++) pages.push(i);
    // 앞뒤 생략 표시
    if (left > 1) pages.unshift(-1, 1);
    if (right < totalPages) pages.push(-2, totalPages);
    return pages;
  };

  return (
    <Flex justifyContent="center" mt={10} mb={4}>
      <HStack spacing={1}>
        <IconButton
          aria-label="Previous page"
          icon={<FaChevronLeft />}
          size="sm"
          variant="ghost"
          isDisabled={currentPage === 1}
          onClick={() => onPageChange(currentPage - 1)}
        />
        {getPageNumbers().map((page, i) =>
          page < 0 ? (
            <Text key={`ellipsis-${i}`} px={2} color="gray.400">…</Text>
          ) : (
            <Button
              key={page}
              size="sm"
              variant={page === currentPage ? "solid" : "ghost"}
              colorScheme={page === currentPage ? "gray" : undefined}
              bg={page === currentPage ? "gray.800" : undefined}
              color={page === currentPage ? "white" : "gray.600"}
              onClick={() => onPageChange(page)}
              minW="36px"
            >
              {page}
            </Button>
          )
        )}
        <IconButton
          aria-label="Next page"
          icon={<FaChevronRight />}
          size="sm"
          variant="ghost"
          isDisabled={currentPage === totalPages}
          onClick={() => onPageChange(currentPage + 1)}
        />
      </HStack>
    </Flex>
  );
}

// 미디어 리스트 컴포넌트
export default function MediaList() {
  const navigate = useNavigate();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState<MediaTab>("photo");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  // MediaDetail에서 돌아올 때 전달된 탭으로 전환
  useEffect(() => {
    const tab = (location.state as { tab?: MediaTab })?.tab;
    if (tab === "photo" || tab === "video") {
      setActiveTab(tab);
      window.history.replaceState({}, document.title, location.pathname);
    }
  }, [location.state, location.pathname]);

  // 검색어 변경 시 페이지 초기화
  const handleSearch = (query: string) => {
    setSearchQuery(query);
    setCurrentPage(1);
  };

  // 탭 변경 시 페이지 초기화
  const handleTabChange = (tab: MediaTab) => {
    setActiveTab(tab);
    setCurrentPage(1);
  };

  // 업로드 모달
  const {
    isOpen: isUploadOpen,
    onOpen: onUploadOpen,
    onClose: onUploadClose
  } = useDisclosure();

  // 통합 sjmedia 리스트 조회 (search + pagination + type filter)
  const { data, isLoading } = useQuery<ISjmediaListResponse>({
    queryKey: ["sjmedia-list", activeTab, searchQuery, currentPage],
    queryFn: () => getSjmediaList({
      search: searchQuery || undefined,
      page: currentPage,
      type: activeTab === "photo" ? "photo" : "video"
    }),
    retry: false
  });

  // sjmedia 목록에서 photos/videos 추출
  const allPhotos: IFilePhotos[] = (data?.sjmedia ?? []).flatMap((item) => item.photos);
  const allVideos: IFileVideos[] = (data?.sjmedia ?? []).flatMap((item) => item.videos);

  const totalPages = data?.total_pages ?? 1;

  // 아이템 클릭 이벤트
  const onItemClick = (item: MediaItem) => {
    if (item.kind === "photo") {
      navigate(`/media/photos/${item.data.pk}`);
    } else {
      navigate(`/media/videos/${item.data.pk}`);
    }
  };

  return (
    <Box px={{ base: 4, lg: 10 }} mt={10}>
      {/* 검색바 + 업로드 버튼 컨테이너 */}
      <Flex justifyContent="center" alignItems="center" mb={5} position="relative">
        <SearchInput
          onSearch={handleSearch}
          onInputChange={(value) => { if (!value) handleSearch(""); }}
        />
        <IconButton
          position="absolute"
          right={0}
          icon={<Icon as={FaPlus} />}
          aria-label="Upload media"
          variant="outline"
          onClick={onUploadOpen}
        />
      </Flex>

      {/* Photo / Video 탭 버튼 컨테이너 */}
      <Flex justifyContent="center" mb={10}>
        <ButtonGroup isAttached variant="outline" size="md">
          <Button
            leftIcon={<FaImage />}
            onClick={() => handleTabChange("photo")}
            bg={activeTab === "photo" ? "gray.800" : "transparent"}
            color={activeTab === "photo" ? "white" : "gray.600"}
            borderColor="gray.300"
            _hover={{ bg: activeTab === "photo" ? "gray.700" : "gray.100" }}
            px={6}
          >
            Photos
          </Button>
          <Button
            leftIcon={<FaVideo />}
            onClick={() => handleTabChange("video")}
            bg={activeTab === "video" ? "gray.800" : "transparent"}
            color={activeTab === "video" ? "white" : "gray.600"}
            borderColor="gray.300"
            _hover={{ bg: activeTab === "video" ? "gray.700" : "gray.100" }}
            px={6}
          >
            Videos
          </Button>
        </ButtonGroup>
      </Flex>

      {/* 콘텐츠 컨테이너 */}
      {isLoading ? (
        <Box sx={{ columnCount: { base: 2, md: 3, lg: 4 }, columnGap: "12px" }}>
          {Array.from({ length: 12 }).map((_, i) => (
            <Skeleton
              key={i}
              rounded="2xl"
              mb={3}
              height={`${180 + (i % 4) * 60}px`}
              display="inline-block"
              w="100%"
            />
          ))}
        </Box>
      ) : activeTab === "photo" ? (
        <Box sx={{ columnCount: { base: 2, md: 3, lg: 4 }, columnGap: "12px" }}>
          {allPhotos.map((photo, i) => (
            <Box
              key={`photo-${photo.pk}`}
              mb={3}
              overflow="hidden"
              rounded="2xl"
              cursor="pointer"
              display="inline-block"
              w="100%"
              position="relative"
              onClick={() => onItemClick({ kind: "photo", data: photo })}
              _hover={{ transform: "scale(1.02)", transition: "transform 0.3s" }}
            >
              <Box w="100%" sx={{ aspectRatio: "4 / 3" }} position="relative" overflow="hidden">
                <Image
                  src={photo.file}
                  fallbackSrc={`https://picsum.photos/seed/${photo.pk}/400/300`}
                  alt={photo.name}
                  w="100%"
                  h="100%"
                  objectFit="cover"
                  display="block"
                />
              </Box>
            </Box>
          ))}
          {allPhotos.length === 0 && (
            <Flex
              justifyContent="center"
              alignItems="center"
              h="40vh"
              w="100%"
              sx={{ columnSpan: "all" }}
            >
              <Text color="gray.400">No photos found.</Text>
            </Flex>
          )}
        </Box>
      ) : (
        <Box sx={{ columnCount: { base: 2, md: 3, lg: 4 }, columnGap: "12px" }}>
          {allVideos.map((video, i) => (
            <AutoPlayVideoCard
              key={`video-${video.pk}`}
              video={video}
              index={i}
              onClick={() => onItemClick({ kind: "video", data: video })}
            />
          ))}
          {allVideos.length === 0 && (
            <Flex
              justifyContent="center"
              alignItems="center"
              h="40vh"
              w="100%"
              sx={{ columnSpan: "all" }}
            >
              <Text color="gray.400">No videos found.</Text>
            </Flex>
          )}
        </Box>
      )}

      {/* 페이지네이션 */}
      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={setCurrentPage}
      />

      {/* 업로드 모달 컴포넌트 */}
      <UploadMediaModal
        isOpen={isUploadOpen}
        onClose={onUploadClose}
        defaultTab={activeTab}
      />
    </Box>
  );
}
