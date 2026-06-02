import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getBlogs } from "../api";
import { IBlog, IBlogListResponse } from "../types";
import BlogCard from "../components/BlogCard";
import { Box, Button, Grid, HStack, Icon, IconButton } from "@chakra-ui/react";
import BlogCard2 from "../components/BlogCard2";
import RoomSkeleton from "../components/RoomSkeleton";
import { useEffect, useState } from "react";
import { use } from "i18next";
import SearchInput from "../components/SearchInput";
import { FaPlus } from "react-icons/fa";
import { useNavigate } from "react-router-dom";

export default function BlogList() {
  const navigate = useNavigate();

  // serach query
  const [searchQuery, setSearchQuery] = useState<string>("");

  // 검색버튼 이용시 검색어
  const [searchInputValue, setSearchInputValue] = useState<string>("");

  // 현재 페이지
  const [currentPage, setCurrentPage] = useState<number>(1);

  // 이전 페이지 blogs 와 현재의 blogs를 합친 배열을 만들어서 화면에 보여주기.
  const [blogs, setBlogs] = useState<IBlog[]>([]);

  // useQuery를 이용해서 blog list 가져오기
  const {
    data: blogListData,
    isLoading: isBlogListLoading,
    refetch: refetchBlogList,
    error: blogListError
  } = useQuery<IBlogListResponse>({
    queryKey: [`bloglist`, currentPage, searchQuery],
    queryFn: getBlogs
  });

  console.log("blogListData", blogListData);

  // blogListData가 변경될 때마다 실행
  useEffect(() => {
    if (blogListData?.blogs) {
      setBlogs((prev) => [...prev, ...blogListData.blogs]);
    }
  }, [blogListData]);

  // blogListData 더 가져오기
  const loadMoreBlogs = () => {
    setCurrentPage((prev) => prev + 1);
    if (currentPage === blogListData?.total_pages) {
      return;
    }
  };

  // 검색시 캐시 제거를 위한 쿼리 클라이언트
  const queryClient = useQueryClient();

  // 검색 쿼리가 변경되면 페이지를 1로 초기화하고 blogs를 초기화한다.
  useEffect(() => {
    setCurrentPage(1);
    setBlogs([]);
    queryClient.removeQueries({ queryKey: [`bloglist`] });
    refetchBlogList();
  }, [searchQuery]);

  return (
    <>
      {/* 검색 */}
      <Box
        mt={"10"}
        px={{ base: 5, lg: 40 }}
        display={"flex"}
        justifyContent={"center"}
      >
        <SearchInput
          // enter 버튼 클릭 검색
          onSearch={(query) => {
            setSearchQuery(query);
            setCurrentPage(1);
          }}
          // 검색 버튼을 클릭했을 때 입력값을 검색어로 설정
          onInputChange={(value) => setSearchInputValue(value)}
        />

        {/* 검색버튼추가 */}
        <Button
          ml={"2"}
          onClick={() => {
            setSearchQuery(searchInputValue);
          }}
        >
          검색
        </Button>

        {/* 블로그 추가 버튼 */}
        <IconButton
          variant={"outline"}
          ml={"3"}
          icon={<Icon as={FaPlus} />}
          aria-label={"add blog"}
          onClick={() => {
            navigate("/blog/upload");
          }}
        />
      </Box>
      <Grid
        mt={"10"}
        px={{
          base: 5,
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
        {isBlogListLoading ? (
          <>
            <RoomSkeleton />
            <RoomSkeleton />
            <RoomSkeleton />
            <RoomSkeleton />
          </>
        ) : (
          <>
            {blogs &&
              blogs &&
              blogs.map((blog) => (
                <div key={blog.id}>
                  <BlogCard2
                    id={blog.id}
                    title={blog.title}
                    description={blog.description}
                    created_at={blog.created_at}
                    updated_at={blog.updated_at}
                    author={blog.author}
                  />
                </div>
              ))}
          </>
        )}
      </Grid>
      {/* 블로그 더보기 파지네이션 */}
      <HStack mt={"10"} justifyContent={"center"} spacing={4}>
        {blogListData && currentPage < blogListData?.total_pages && (
          <Button onClick={loadMoreBlogs} colorScheme={"blue"} size={"lg"}>
            더보기
          </Button>
        )}
      </HStack>
    </>
  );
}
