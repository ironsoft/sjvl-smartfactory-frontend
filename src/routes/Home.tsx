import { Box, CircularProgress, Grid, Text } from "@chakra-ui/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getRooms } from "../api";
import Room from "../components/Room";
import RoomSkeleton from "../components/RoomSkeleton";
import { IRoomList } from "../types";
import { useEffect, useState } from "react";
import SearchInput from "../components/SearchInput";
import CategoryFilter from "../components/CategoryFilter";

export default function Home() {
  // 페이지 로딩 중
  const [isPageLoading, setIsPageLoading] = useState(false);

  // 현재 페이지
  const [currentPage, setCurrentPage] = useState(1);

  // 이전 페이지의 rooms와 현재 페이지의 rooms를 합친 배열을 만들어서 화면에 보여주어야 하기 때문에.
  const [rooms, setRooms] = useState<IRoomList[]>([]);

  // 더 이상 가져올 rooms가 없을 때
  const [hasMore, setHasMore] = useState(true);

  // search query
  const [searchQuery, setSearchQuery] = useState("");

  // 현재 선택된 카테고리
  const [selectedCategory, setSelectedCategory] = useState("");

  // 쿼리 훅, rooms 목록 가져오기
  const { isLoading, data, refetch, error } = useQuery<IRoomList[]>({
    queryKey: ["rooms", currentPage, searchQuery, selectedCategory],
    queryFn: getRooms,
    enabled: false // 페이지가 변경되면 쿼리 요청
  });

  // 무한 스크롤
  useEffect(() => {
    function handleScroll() {
      if (!hasMore || isPageLoading || searchQuery) {
        return; // If there are no more rooms, stop here
      }
      const scrollTop = document.documentElement.scrollTop;
      const windowHeight = window.innerHeight;
      const fullHeight = document.documentElement.offsetHeight;
      if (
        // 스크롤이 페이지 바닥 근처에 도달했는지 확인 (여유분 추가)
        scrollTop + windowHeight >
        fullHeight - 100
      ) {
        // 로딩 아이콘 표시
        setIsPageLoading(true);
        // 0.3초 후에 쿼리 요청
        setTimeout(() => {
          setCurrentPage((prevPage) => prevPage + 1); // 페이지 증가
          setIsPageLoading(false); // 로딩 아이콘 숨기기
        }, 300);
      }
    }
    // 스크롤 이벤트 리스너 등록
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [hasMore, isPageLoading, searchQuery]);

  // refetchCount 상태 추가
  const [refetchCount, setRefetchCount] = useState(0);

  // 쿼리 데이터가 변경되면 rooms 상태에 추가
  useEffect(() => {
    if (data) {
      // 이전 페이지의 rooms와 현재 페이지의 rooms를 합친 배열을 만들어서 화면에 보여주어야 하기 때문에.
      setRooms((prevRooms) => [...prevRooms, ...data]);
    }
    // 쿼리 데이터가 없으면 더 이상 가져올 rooms가 없다는 것이기 때문에 hasMore를 false로 설정
    if (data && data.length === 0) {
      setHasMore(false);
      // 데이터가 없으면 다시 쿼리 요청
      if (refetchCount < 5) {
        // 재요청 횟수 제한
        refetch();
        setRefetchCount(refetchCount + 1); // 재요청 횟수 증가
      }
    }
  }, [data, refetch]);

  // 페이지가 변경되면 쿼리 재요청
  useEffect(() => {
    if (hasMore) {
      refetch();
    }
  }, [currentPage, refetch, hasMore]);

  // 검색시 캐시 제거를 위한 쿼리 클라이언트
  const queryClient = useQueryClient();

  // 검색 쿼리가 변경되면 페이지를 1로 재설정하고 새로운 데이터 요청
  useEffect(() => {
    setCurrentPage(1);
    setRooms([]);
    setHasMore(true); // 검색을 취소해도 다시 무한 스크롤이 가능하도록 hasMore를 true로 설정
    // 이전 검색 결과의 캐시를 모두 제거 (캐시가 남아 있으면 X 버튼을 눌러도 작동하지 않음)
    queryClient.removeQueries({ queryKey: ["rooms"] });
    refetch();
  }, [searchQuery, refetch, selectedCategory]);

  // 카테고리 선택 핸들러
  const handleCategorySelect = (category: string) => {
    setSelectedCategory(category);
    // 전체 아이콘 선택시 필터 검색어 초기화
    if (category === "전체") {
      setSelectedCategory(""); // 카테고리 선택 해제
      setRooms([]); // rooms 상태 초기화
      setHasMore(true); // 검색을 취소해도 다시 무한 스크롤이 가능하도록 hasMore를 true로 설정
      // 이전 검색 결과의 캐시를 모두 제거 (캐시가 남아 있으면 X 버튼을 눌러도 작동하지 않음)
      queryClient.removeQueries({ queryKey: ["rooms"] });
      refetch();
      setCurrentPage(1);
    }
  };

  return (
    <>
      {/* 검색창 */}
      <Box
        mt={{
          base: "5",
          md: "10"
        }}
        display={"flex"}
        justifyContent={"center"}
      >
        <SearchInput
          onSearch={(query) => setSearchQuery(query)}
          onInputChange={(value) => setSearchQuery(value)}
        />
      </Box>

      {/* 카테고리 필터 */}
      <CategoryFilter onCategorySelect={handleCategorySelect} />

      <Grid
        mt={"10"}
        px={{
          base: 10,
          lg: 40
        }}
        columnGap={"4"}
        rowGap={"8"}
        templateColumns={{
          sm: "1fr",
          md: "1fr 1fr",
          lg: "repeat(3, 1fr)",
          xl: "repeat(4, 1fr)",
          "2xl": "repeat(5, 1fr)"
        }}
      >
        {isLoading ? (
          <>
            <RoomSkeleton />
            <RoomSkeleton />
            <RoomSkeleton />
            <RoomSkeleton />
            <RoomSkeleton />
            <RoomSkeleton />
          </>
        ) : error ? (
          <Box>Error: {error.message}</Box>
        ) : rooms.length ? (
          rooms?.map((room, index) => (
            <Room
              key={index}
              pk={room.pk}
              isOwner={room.is_owner}
              imageUrl={
                room.photos[0]?.file ??
                `https://source.unsplash.com/random/450x450`
              }
              name={room.name}
              rating={room.rating}
              city={room.city}
              country={room.country}
              price={room.price}
              refetch={refetch}
            />
          ))
        ) : (
          <Text>검색 결과가 없습니다.</Text>
        )}
        {/* 스크롤 다운시 다음 페이지 로딩 중 스피너 표시 */}
        {isPageLoading && (
          <Box
            display={"flex"}
            justifyContent={"center"}
            alignItems={"center"}
            position={"fixed"}
            top={"80%"}
            left={"50%"}
            transform={"translate(-50%, -50%)"}
            width={"100vw"}
            height={"100vh"}
            zIndex={-1} // Ensure the loading icon is below other elements
          >
            <CircularProgress value={100} isIndeterminate />
          </Box>
        )}
      </Grid>
    </>
  );
}
