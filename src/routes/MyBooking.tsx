import {
  Box,
  Button,
  Heading,
  Stat,
  StatHelpText,
  StatLabel,
  StatNumber,
  Table,
  TableCaption,
  TableContainer,
  Tbody,
  Text,
  Th,
  Thead,
  Tr,
  useColorModeValue
} from "@chakra-ui/react";
import { useQuery } from "@tanstack/react-query";

import { getUserBookings } from "../api";
import { IBookingList, IUserBookingList } from "../types";
import BookingTableRow from "../components/BookingTableRow";
import { Helmet } from "react-helmet";
import { useState } from "react";
import ButtonPagination from "../components/ButtonPagination";

export default function MyBooking() {
  // 현재 페이지 상태 관리
  const [currentPage, setCurrentPage] = useState(1);

  // booking data 가져오기
  const { data } = useQuery<IBookingList>({
    queryKey: [`mybookings`, currentPage],
    queryFn: getUserBookings
  });

  // 총 페이지 수
  const totalPages = data?.totalPages;

  // 페이지 변경 함수
  const paginate = (pageNumber: number) => setCurrentPage(pageNumber);

  console.log(data);
  // created_at 기준 최근 생성된 것이 가장 위에 나타나도록
  const sortedData = data?.bookings?.sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  // 테이블 행 배경색 다크모드에 맞게 변경
  const bgColor = useColorModeValue("gray.50", "gray.800");

  return (
    <>
      {/* // Helmet을 이용하여 페이지 제목 변경 */}
      <Helmet>
        <title>{data?.bookings ? "" : "Loading..."} 예약건</title>
      </Helmet>
      <Box
        maxW={{ base: "3xl", lg: "8xl" }}
        mx="auto"
        px={{ base: "4", md: "8", lg: "12" }}
        py={{ base: "6", md: "8", lg: "8" }}
      >
        <Heading size={"md"} mb={"5"}>
          My Booking List
        </Heading>
        <Stat mb={"5"}>
          <StatLabel>총 예약 건수</StatLabel>
          <StatNumber>{data?.totalResults}</StatNumber>
          <StatHelpText>Feb 12 - Feb 28</StatHelpText>
        </Stat>
        <TableContainer mb={"10"}>
          <Table variant={"simple"}>
            <TableCaption></TableCaption>
            {/* 테이블 헤더 */}
            <Thead bgColor={bgColor}>
              <Tr my=".8rem" pl="0px" color="gray.600">
                <Th color="gray.600">Photo</Th>
                <Th pl="0px" color="gray.600">
                  Booking No.
                </Th>
                <Th color="gray.600">Room Name</Th>
                <Th color="gray.600">City</Th>
                <Th color="gray.600">Country</Th>
                <Th color="gray.600">Check In</Th>
                <Th color="gray.600">Check Out</Th>
                <Th color="gray.600">Guests</Th>
                <Th color="gray.600">Price</Th>
                <Th color="gray.600">Edit</Th>
                <Th color="gray.600">Delete</Th>
              </Tr>
            </Thead>
            {/* 테이블 바디 */}
            <Tbody>
              {sortedData?.map((bookingRoom) =>
                // bookingRoom.room 데이터가 없을 경우를 명시해 주어야 에러가 발생하지 않음
                bookingRoom.room ? (
                  <BookingTableRow
                    key={bookingRoom.pk}
                    bookingId={bookingRoom.pk}
                    pk={bookingRoom.room.pk}
                    imageUrl={bookingRoom.room.photos[0]?.file}
                    name={bookingRoom.room.name}
                    city={bookingRoom.room.city}
                    country={bookingRoom.room.country}
                    check_in={bookingRoom.check_in}
                    check_out={bookingRoom.check_out}
                    guests={bookingRoom.guests}
                    price={bookingRoom.room.price}
                  />
                ) : null
              )}
            </Tbody>
          </Table>
        </TableContainer>
        {/* 파지네이션 */}
        <ButtonPagination
          currentPage={currentPage}
          totalPage={totalPages || 0} // totalPages가 undefined일 경우를 대비하여 0으로 설정
          paginate={paginate}
        />
      </Box>
    </>
  );
}
