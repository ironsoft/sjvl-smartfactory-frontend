import {
  Box,
  Button,
  Container,
  Table,
  TableCaption,
  TableContainer,
  Tbody,
  Th,
  Thead,
  Tr,
  useColorModeValue
} from "@chakra-ui/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Helmet } from "react-helmet";
import { getBagTerms } from "../../api";
import { ITermListResponse } from "../../types";
import TermTableRow from "../../components/TermTableRow";
import { useEffect, useState } from "react";
import ButtonPagination from "../../components/ButtonPagination";
import SearchInput from "../../components/SearchInput";

export default function FindTerm() {
  // 현재 페이지 상태 관리
  const [currentPage, setCurrentPage] = useState(1);

  // Search Query
  const [searchQuery, setSearchQuery] = useState("");

  // 검색버튼 이용시 검색어
  const [searchInputValue, setSearchInputValue] = useState("");

  // Terms 목록 가져오기
  const { data, isLoading, refetch, error } = useQuery<ITermListResponse>({
    queryKey: [`terms`, currentPage, searchQuery],
    queryFn: getBagTerms
  });

  console.log("data", data);

  // 총 페이지 수
  const totalPages = data?.totalPages;

  // 페이지 변경 함수
  const paginate = (page: number) => {
    setCurrentPage(page);
  };

  // 테이블 행 배경색 다크모드에 맞게 변경
  const bgColor = useColorModeValue("gray.50", "gray.800");

  // 검색시 캐시 제거를 위한 쿼리 클라이언트
  const queryClient = useQueryClient();

  // 검색 쿼리가 변경되면 페이지를 1로 초기화하고 bagTerms를 초기화
  useEffect(() => {
    setCurrentPage(1);
    queryClient.removeQueries({ queryKey: [`terms`] });
    refetch();
  }, [searchQuery]);

  // 사용자 선택시 부모창으로 사용자 정보 전달
  const onSelectTerm = (termId: number, languageType: string) => {
    // window.location.origin은 현재 창의 부모창임.
    // postMessage로 부모창에 사용자 정보 전달
    window.opener.postMessage(
      { termId: termId, languageType: languageType },
      window.location.origin
    );
    window.close();
  };

  return (
    <>
      <Helmet>
        <title>Find the term</title>
      </Helmet>
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
          onInputChange={(value) => setSearchInputValue(value)}
        />
        <Button
          ml={"2"}
          onClick={() => {
            setSearchQuery(searchInputValue);
          }}
        >
          Search
        </Button>
      </Box>
      <Box
        maxW={{
          base: "3xl",
          lg: "8xl"
        }}
        mx="auto"
        px={{
          base: "4",
          md: "8",
          lg: "12"
        }}
        py={{
          base: "6",
          md: "8",
          lg: "8"
        }}
      >
        <Container maxW="container.xl">
          <TableContainer mb={"10"}>
            <Table variant={"simple"}>
              <TableCaption></TableCaption>
              {/* 테이블 헤더 */}
              <Thead bgColor={bgColor}>
                <Tr my=".8rem" pl="0px" color="gray.600">
                  <Th color="gray.600">Photo</Th>
                  <Th color="gray.600">Term ID</Th>
                  <Th color="gray.600">Name</Th>
                  <Th color="gray.600">Category</Th>
                  <Th color="gray.600">Representitive</Th>
                </Tr>
              </Thead>
              {/* 테이블 바디 */}
              <Tbody>
                {/* 데이터 로딩중 */}
                {isLoading && (
                  <Tr>
                    <Th>Loading...</Th>
                  </Tr>
                )}
                {/* 데이터 로딩 실패 */}
                {error && (
                  <Tr>
                    <Th>Error occured</Th>
                  </Tr>
                )}
                {/* 데이터 로딩 성공 */}
                {data &&
                  data.bagterms.map((term) => (
                    <TermTableRow
                      key={term.id}
                      id={term.id}
                      name={term.name}
                      photo={term.photo}
                      category={term.category}
                      representitive={term.representitive}
                      language={term.language}
                      onSelectTerm={onSelectTerm}
                    />
                  ))}
              </Tbody>
            </Table>
          </TableContainer>
          <ButtonPagination
            currentPage={currentPage}
            paginate={paginate}
            totalPage={totalPages || 0}
          />
        </Container>
      </Box>
    </>
  );
}
