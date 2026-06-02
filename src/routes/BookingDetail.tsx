import {
  Box,
  Button,
  Flex,
  Heading,
  HStack,
  Image,
  Skeleton,
  Spacer,
  Table,
  TableCaption,
  TableContainer,
  Tbody,
  Td,
  Text,
  Tfoot,
  Th,
  Thead,
  Tr
} from "@chakra-ui/react";
import { useQuery } from "@tanstack/react-query";
import React from "react";
import Calendar from "react-calendar";
import { Helmet } from "react-helmet";
import {
  FaAngleLeft,
  FaAngleRight,
  FaArrowRight,
  FaEdit
} from "react-icons/fa";
import { Link, useNavigate, useParams } from "react-router-dom";
import { getBooking } from "../api";
import { IBookingDetail } from "../types";

export default function BookingDetail() {
  const { bookingId } = useParams();
  const { isLoading: isBookingLoading, data: bookingData } =
    useQuery<IBookingDetail>({
      queryKey: [`booking`, bookingId],
      queryFn: getBooking
    });
  console.log(bookingData);

  //Booking Edit
  const navigate = useNavigate();
  const onEditBooking = (event: React.SyntheticEvent<HTMLButtonElement>) => {
    event.preventDefault();
    navigate(`/bookings/${bookingId}/edit`);
  };

  return (
    <Box
      mt={"10"}
      px={{
        base: 10,
        lg: 40
      }}
    >
      <Helmet>
        <title>
          {bookingData ? bookingData.room.name : "Loading..."} 예약건
        </title>
      </Helmet>

      <Box mb={"3"}>
        <Link to={"/users/mybookings/"}>
          <Flex alignItems={"center"}>
            <FaAngleLeft size={"20"} />
            <Text fontSize={"20"}>My Booking List</Text>
          </Flex>
        </Link>
      </Box>

      <Flex mb={"10"} alignItems={"center"}>
        <Heading>Booking Detail</Heading>
        <Button onClick={onEditBooking} variant={"unstyled"} ml={"5"}>
          <HStack>
            <Text>Edit</Text>
            <FaAngleRight />
          </HStack>
        </Button>
      </Flex>

      {bookingData?.room.photos && bookingData.room.photos.length > 0 ? (
        <Image
          mb={"10"}
          width={"15%"}
          h={"15%"}
          objectFit={"cover"}
          src={bookingData?.room.photos[0]?.file}
          rounded={"xl"}
        />
      ) : null}
      <Skeleton height={"243px"} width={"75%"} isLoaded={!isBookingLoading}>
        <TableContainer>
          <Table variant="simple">
            <Thead bgColor={"gray.100"}>
              <Tr>
                <Th>Check In</Th>
                <Th>Check Out</Th>
                <Th>Room Name</Th>
                <Th>Country</Th>
                <Th>City</Th>
                <Th>Price</Th>
                <Th isNumeric>Guests</Th>
              </Tr>
            </Thead>
            <Tbody>
              <Tr>
                <Td>{bookingData?.check_in}</Td>
                <Td>{bookingData?.check_out}</Td>
                <Td>{bookingData?.room.name}</Td>
                <Td>{bookingData?.room.country}</Td>
                <Td>{bookingData?.room.city}</Td>
                <Td>${bookingData?.room.price}</Td>
                <Td isNumeric>{bookingData?.guests}</Td>
              </Tr>
            </Tbody>
          </Table>
        </TableContainer>
      </Skeleton>
    </Box>
  );
}
