import {
  Box,
  Button,
  Container,
  Flex,
  FormControl,
  FormLabel,
  Heading,
  Input,
  Table,
  TableContainer,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
  useToast
} from "@chakra-ui/react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Helmet } from "react-helmet";
import { useForm } from "react-hook-form";
import { FaAngleLeft } from "react-icons/fa";
import { Link, useNavigate, useParams } from "react-router-dom";
import { editBooking, getBooking } from "../api";
import HostOnlyPage from "../components/HostOnlyPage";
import ProtectedPage from "../components/ProtectPage";
import { IBookingDetail } from "../types";

export default function BookingEdit() {
  const { bookingId } = useParams();
  const { register, handleSubmit } = useForm<IBookingDetail>();
  const toast = useToast();
  const navigate = useNavigate();

  //  booking 수정을 위한 mutation
  const editBookingMutation = useMutation({
    mutationFn: editBooking,
    onSuccess: (data: IBookingDetail) => {
      toast({
        title: "Booking edit completed.",
        status: "success",
        position: "bottom-right"
      });
    }
  });

  // mutation 작동 버튼 onSubmit
  const onSubmit = (data: IBookingDetail) => {
    if (bookingId) {
      data.pk = Number(bookingId);
      editBookingMutation.mutate(data);
    }
  };

  // booking data 가져오기
  const { data: bookingData, isLoading: isBookingDataLoading } =
    useQuery<IBookingDetail>({
      queryKey: [`bookings`, bookingId],
      queryFn: getBooking
    });

  return (
    <ProtectedPage>
      <HostOnlyPage>
        <Box
          pb={"40"}
          mt={"10"}
          px={{
            base: 10,
            lg: 40
          }}
        >
          <Helmet>
            <title>
              {bookingData
                ? `${bookingData.room.name} 예약 수정`
                : "예약 수정 중..."}
            </title>
          </Helmet>
          <Box mb={"3"}>
            <Link to={`/users/mybookings`}>
              <Flex alignItems={"center"}>
                <FaAngleLeft size={"20"} />
                <Text fontSize={"20"}>Back</Text>
              </Flex>
            </Link>
          </Box>
          <Heading mb={"10"}>Booking Update</Heading>
          <TableContainer>
            <Table
              variant="simple"
              as={"form"}
              onSubmit={handleSubmit(onSubmit)}
            >
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
                  <Td>
                    <FormControl>
                      <Input
                        {...register("check_in", { required: true })}
                        type={"date"}
                        defaultValue={bookingData?.check_in}
                        required
                      />
                    </FormControl>
                  </Td>
                  <Td>
                    <FormControl>
                      <Input
                        {...register("check_out", { required: true })}
                        type={"date"}
                        defaultValue={bookingData?.check_out}
                        required
                      />
                    </FormControl>
                  </Td>
                  <Td>{bookingData?.room.name}</Td>
                  <Td>{bookingData?.room.country}</Td>
                  <Td>{bookingData?.room.city}</Td>
                  <Td>${bookingData?.room.price}</Td>
                  <Td isNumeric>
                    <FormControl>
                      <Input
                        {...(register("guests"), { required: true })}
                        type={"number"}
                        defaultValue={bookingData?.guests}
                        required
                      />
                    </FormControl>
                  </Td>
                </Tr>
              </Tbody>
              <Button
                type="submit"
                isLoading={editBookingMutation.isPending}
                colorScheme={"blue"}
                mt={"10"}
              >
                Update Booking
              </Button>
            </Table>
          </TableContainer>
        </Box>
      </HostOnlyPage>
    </ProtectedPage>
  );
}
