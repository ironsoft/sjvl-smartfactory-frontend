import {
  Box,
  Container,
  Stat,
  StatHelpText,
  StatLabel,
  StatNumber,
  Table,
  TableCaption,
  TableContainer,
  Tbody,
  Th,
  Thead,
  Tr,
  useColorModeValue,
  useToast
} from "@chakra-ui/react";
import ProtectedPage from "../components/ProtectPage";
import HostOnlyPage from "../components/HostOnlyPage";
import SearchInput from "../components/SearchInput";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getUsers } from "../api";
import { Helmet } from "react-helmet";
import UserTableRow from "../components/UserTableRow";
import { IData, IUser } from "../types";
import ButtonPagination from "../components/ButtonPagination";

export default function FindUser() {
  // 현재 페이지 상태 관리
  const [currentPage, setCurrentPage] = useState(1);

  const toast = useToast();

  // search query
  const [searchQuery, setSearchQuery] = useState("");

  // 사용자 목록 가져오기
  const { data, isLoading, error, refetch } = useQuery<IData, Error>({
    queryKey: ["users", currentPage, searchQuery],
    queryFn: getUsers
  });
  console.log(data?.users);

  // 총 페이지 수
  const totalPages = data?.totalPages;
  console.log(currentPage);

  // 페이지 변경 함수
  const paginate = (pageNumber: number) => setCurrentPage(pageNumber);

  // 테이블 행 배경색 다크모드에 맞게 변경
  const bgColor = useColorModeValue("gray.50", "gray.800");

  // 검색시 캐시 제거를 위한 쿼리 클라이언트
  const queryClient = useQueryClient();

  // 검색 쿼리가 변경될 때마다 캐시 제거하고 다시 users 불러오기
  useEffect(() => {
    setCurrentPage(1);
    queryClient.removeQueries({ queryKey: ["users"] });
    refetch();
  }, [searchQuery]);

  // 사용자 선택시 부모창으로 사용자 정보 전달
  const onSelectUser = (userId: number) => {
    // window.location.origin은 현재 창의 부모창임.
    // postMessage로 부모창에 사용자 정보 전달
    window.opener.postMessage({ userId: userId }, window.location.origin); // 수정된 부분

    window.close();
  };

  return (
    <ProtectedPage>
      <HostOnlyPage>
        <Helmet>
          <title>Find users</title>
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
            onInputChange={(value) => setSearchQuery(value)}
          />
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
            {/* 통계 */}
            <Stat mb={"5"}>
              <StatLabel>총 사용자수</StatLabel>
              <StatNumber>{data?.totalResults}</StatNumber>
              <StatHelpText>현재 등록된 사용자수</StatHelpText>
            </Stat>
            <TableContainer mb={"10"}>
              <Table variant={"simple"}>
                <TableCaption></TableCaption>
                {/* 테이블 헤더 */}
                <Thead bgColor={bgColor}>
                  <Tr my=".8rem" pl="0px" color="gray.600">
                    <Th color="gray.600">Avatar</Th>
                    <Th color="gray.600">User ID</Th>
                    <Th color="gray.600">Name</Th>
                    <Th color="gray.600">Username</Th>
                  </Tr>
                </Thead>
                {/* 테이블 바디 */}
                <Tbody>
                  {data &&
                    data.users.map((user: IUser) => (
                      <UserTableRow
                        key={user.pk.toString()}
                        name={user.name}
                        avatarUrl={user.avatar}
                        userId={user.pk}
                        username={user.username}
                        onSelectUser={onSelectUser}
                      />
                    ))}
                </Tbody>
              </Table>
            </TableContainer>
            {/* 파지네이션 */}
            <ButtonPagination
              currentPage={currentPage}
              paginate={paginate}
              totalPage={totalPages || 0}
            />
          </Container>
        </Box>
      </HostOnlyPage>
    </ProtectedPage>
  );
}
