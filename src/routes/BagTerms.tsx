import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getBagTerms } from "../api";
import {
  Box,
  Button,
  Grid,
  HStack,
  Icon,
  IconButton,
  useColorMode
} from "@chakra-ui/react";
import BagTermCard from "../components/BagTermCard";
import RoomSkeleton from "../components/RoomSkeleton";
import { useEffect, useState } from "react";
import SearchInput from "../components/SearchInput";
import { ITerm, ITermListResponse } from "../types";
import { FaPlus } from "react-icons/fa";
import { useNavigate } from "react-router-dom";

export default function BagTerms() {
  const navigate = useNavigate();

  // search query
  const [searchQuery, setSearchQuery] = useState("");

  // 검색버튼 이용시 검색어
  const [searchInputValue, setSearchInputValue] = useState("");

  // 현재 페이지
  const [currentPage, setCurrentPage] = useState(1);

  // 이전 페이지 bagterms와 현재 페이지 bagterms를 합친 배열을 만들어서 화면에 보여주기
  const [bagTerms, setBagTerms] = useState<ITerm[]>([]);

  // bagterms 목록 가져오기
  const {
    data: bagTermsData,
    isLoading: isBagTermLoading,
    refetch,
    error
  } = useQuery<ITermListResponse>({
    queryKey: [`bagterms`, currentPage, searchQuery],
    queryFn: getBagTerms
  });

  console.log("bagTermsData", bagTermsData);

  // bagTermsData가 변경될 때마다 bagTerms에 추가하기
  useEffect(() => {
    //
    if (bagTermsData) {
      setBagTerms((prev) => [...prev, ...bagTermsData.bagterms]);
    }
  }, [bagTermsData]);
  console.log("bagTerms", bagTerms);

  // bagTerms 더 가져오기
  const loadMoreBagTerms = () => {
    setCurrentPage((prev) => prev + 1);
  };

  // 검색시 캐시 제거를 위한 쿼리 클라이언트
  const queryClient = useQueryClient();

  // 검색 쿼리가 변경되면 페이지를 1로 초기화하고 bagTerms를 초기화
  useEffect(() => {
    setCurrentPage(1);
    setBagTerms([]);
    queryClient.removeQueries({ queryKey: [`bagterms`] });
    refetch();
  }, [searchQuery]);

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
          // enter 버튼 클릭 검색
          onSearch={(query) => {
            setSearchQuery(query);
            setCurrentPage(1); // 검색할 때마다 페이지 초기화
          }}
          // 검색버튼을 클릭했을 때 입력값을 검색어로 설정
          onInputChange={(value) => {
            setSearchInputValue(value);
          }}
        />

        {/* 검색 버튼 추가 */}
        <Button
          ml={"2"}
          onClick={() => {
            setSearchQuery(searchInputValue);
          }}
        >
          검색
        </Button>

        {/* 용어 추가 버튼 */}
        <IconButton
          variant={"outline"}
          ml={"3"}
          icon={<Icon as={FaPlus} />}
          aria-label="Add Terminology"
          onClick={() => {
            navigate("/terms/upload");
          }}
        />
      </Box>

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
        {isBagTermLoading ? (
          <>
            <RoomSkeleton />
            <RoomSkeleton />
            <RoomSkeleton />
            <RoomSkeleton />
          </>
        ) : (
          <>
            {bagTerms?.map((term: ITerm) => (
              <div key={term.id}>
                <BagTermCard
                  id={term.id}
                  name={term.name}
                  language={term.language}
                  category={term.category}
                  material={term.material}
                  description={term.description}
                  representitive={term.representitive}
                  photo={term.photos[0]?.file}
                  english_term={term.english_term}
                  korean_term={term.korean_term}
                  chinese_term={term.chinese_term}
                  vietnamese_term={term.vietnamese_term}
                  indonesian_term={term.indonesian_term}
                  synonym_1={term.synonym_1}
                  synonym_2={term.synonym_2}
                  synonym_3={term.synonym_3}
                  synonym_4={term.synonym_4}
                  synonym_5={term.synonym_5}
                  synonym_6={term.synonym_6}
                  synonym_7={term.synonym_7}
                  synonym_8={term.synonym_8}
                  synonym_9={term.synonym_9}
                  synonym_10={term.synonym_10}
                />
              </div>
            ))}
          </>
        )}
      </Grid>
      {/* 용어 더보기 Pagination */}
      <HStack mt={10} spacing={4} justifyContent={"center"}>
        {bagTermsData && currentPage < bagTermsData?.totalPages && (
          <Button onClick={loadMoreBagTerms}>더보기</Button>
        )}
      </HStack>
    </>
  );
}
