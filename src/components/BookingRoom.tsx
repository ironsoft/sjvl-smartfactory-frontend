import {
  AlertDialog,
  AlertDialogBody,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogOverlay,
  Box,
  Button,
  Grid,
  Image,
  Text,
  useToast
} from "@chakra-ui/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import React, { useRef, useState } from "react";
import { FaRemoveFormat, FaTrash } from "react-icons/fa";
import { Link, useNavigate } from "react-router-dom";
import { removeBooking } from "../api";

interface BookingRoomProps {
  bookingId: number;
  pk: number;
  imageUrl: string;
  name: string;
  city: string;
  country: string;
  check_in: string;
  check_out: string;
  guests: number;
}

export default function BookingRoom({
  bookingId,
  imageUrl,
  name,
  city,
  country,
  check_in,
  check_out,
  guests
}: BookingRoomProps) {
  // booking 삭제 경고창 상태관리
  const [isBookingRemoveAlert, setIsBookingRemoveAlert] = useState(false);
  // 경고창 열기 함수 (이벤트 버블링 방지)
  const onOpenBookingRemoveAlert = (
    event: React.MouseEvent<HTMLButtonElement, MouseEvent>
  ) => {
    // 이벤트 버블링 방지. 버튼 고유의 동작 중단.
    event.preventDefault();
    // 부모 요소 링크로 이벤트 버블링 되는 것 방지.
    event.stopPropagation();
    setIsBookingRemoveAlert(true);
  };
  // 경고창 닫기 함수 (인자 없음)
  const onCloseBookingRemoveAlert = () => {
    setIsBookingRemoveAlert(false);
  };
  const cancelRef = useRef<HTMLButtonElement>(null);

  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();

  // booking 삭제 mutation
  const deleteBookingMutation = useMutation({
    mutationFn: () => {
      if (typeof bookingId === "number") {
        return removeBooking(bookingId);
      }
      throw new Error("Booking ID is undefined");
    },
    onSuccess: () => {
      toast({
        title: "Booking deleted",
        status: "success",
        position: "bottom"
      });
      // queryClient 통해 booking 제거 후 바로 화면에 반영
      queryClient.invalidateQueries({ queryKey: [`mybookings`] });
    },
    onError: (error) => {
      console.log("Error deleting booking", error);
      toast({
        title: "Error deleting booking",
        description: "Unable to delete the booking",
        status: "error",
        position: "bottom"
      });
    }
  });

  // 실제 삭제 처리 함수
  const onConfirmRemove = () => {
    onCloseBookingRemoveAlert();
    deleteBookingMutation.mutate();
  };

  return (
    <Grid gap={"5"} templateColumns={"1fr 1fr"}>
      <Link to={`/bookings/${bookingId}`}>
        <Box key={bookingId} px={"10"}>
          <Box
            h={"300px"}
            w={"600px"}
            position={"relative"}
            overflow={"hidden"}
            mb={"3"}
            rounded={"2xl"}
          >
            {imageUrl ? <Image src={imageUrl} /> : <Box bg="gray.400" />}
            <Button
              variant={"unstyled"}
              position={"absolute"}
              top={"0"}
              right={"-1"}
              color={"gray.400"}
              onClick={onOpenBookingRemoveAlert}
            >
              <FaTrash size={"20px"} />
            </Button>
            {/* booking 삭제전 경고창 */}
            <AlertDialog
              isOpen={isBookingRemoveAlert}
              leastDestructiveRef={cancelRef}
              onClose={onCloseBookingRemoveAlert}
            >
              <AlertDialogOverlay>
                <AlertDialogContent>
                  <AlertDialogHeader fontSize={"lg"} fontWeight={"bold"}>
                    Delete Booking
                  </AlertDialogHeader>
                  <AlertDialogBody>
                    Are you suer? You can't undo this action afterwards.
                  </AlertDialogBody>
                  <AlertDialogFooter>
                    <Button ref={cancelRef} onClick={onCloseBookingRemoveAlert}>
                      Cancel
                    </Button>
                    <Button
                      onClick={onConfirmRemove}
                      ml={"3"}
                      colorScheme={"red"}
                    >
                      Delete
                    </Button>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialogOverlay>
            </AlertDialog>
          </Box>
          <Box>
            <Text display={"block"} as="b" noOfLines={1} fontSize="md">
              {name} _ {city}, {country}
            </Text>
          </Box>
          <Box>
            <Text as={"b"} noOfLines={1} fontSize="md">
              Booking: From {check_in} to {check_out}
            </Text>
            <Text display={"block"} as="b" noOfLines={1} fontSize="md">
              Guests: {guests}
            </Text>
          </Box>
        </Box>
      </Link>
    </Grid>
  );
}
