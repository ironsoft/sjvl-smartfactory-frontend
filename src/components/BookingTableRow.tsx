import {
  AlertDialog,
  AlertDialogBody,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogOverlay,
  Box,
  Button,
  HStack,
  Icon,
  Image,
  TagLeftIcon,
  Td,
  Text,
  Tr,
  useToast
} from "@chakra-ui/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import {
  FaDollarSign,
  FaDolly,
  FaPen,
  FaTrash,
  FaWonSign
} from "react-icons/fa";
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
  price: number;
}

export default function BookingTableRow({
  bookingId,
  pk,
  imageUrl,
  name,
  city,
  country,
  check_in,
  check_out,
  guests,
  price
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

  //Booking Edit
  const onEditBooking = (event: React.SyntheticEvent<HTMLButtonElement>) => {
    event.preventDefault();
    navigate(`/bookings/${bookingId}/edit`);
  };

  return (
    <>
      <Tr>
        <Td>
          <Link to={`/bookings/${bookingId}`}>
            {/* 이미지가 없을 경우 대체 이미지를 보여주기 */}
            {imageUrl ? (
              <Image
                boxSize="50px"
                objectFit="cover"
                src={imageUrl}
                alt="Room Image"
                rounded={"md"}
              />
            ) : (
              // 대체 이미지
              <Box
                boxSize={"50px"}
                display="flex" // flex 하면 align-items, justify-content 사용 가능
                alignItems="center"
                justifyContent="center"
              >
                <Text fontSize={"sm"} color={"gray.400"}>
                  No Image
                </Text>
              </Box>
            )}
          </Link>
        </Td>
        <Td>
          <Text>{bookingId}</Text>
        </Td>
        <Td>
          <Text>{name}</Text>
        </Td>
        <Td>
          <Text>{city}</Text>
        </Td>
        <Td>
          <Text>{country}</Text>
        </Td>
        <Td>
          <Text>{check_in}</Text>
        </Td>
        <Td>
          <Text>{check_out}</Text>
        </Td>
        <Td isNumeric>
          <Text>{guests}</Text>
        </Td>
        <Td isNumeric>
          <HStack spacing="1">
            <FaDollarSign />
            <Text>{price}</Text>
          </HStack>
        </Td>
        <Td>
          {/* 편집 버튼 */}
          <Button
            display={"flex"}
            alignContent={"center"}
            variant={"unstyled"}
            color={"gray.300"}
            onClick={onEditBooking}
          >
            <FaPen size={"20px"} />
          </Button>
        </Td>
        <Td>
          {/* 삭제 버튼 */}
          <Button
            display={"flex"}
            alignContent={"center"}
            variant={"unstyled"}
            color={"gray.300"}
            onClick={onOpenBookingRemoveAlert}
          >
            <FaTrash size={"20px"} />
          </Button>
        </Td>
      </Tr>
      {/* booking 삭제 경고창 */}
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
              <Button onClick={onConfirmRemove} ml={"3"} colorScheme={"red"}>
                Delete
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>
    </>
  );
}
