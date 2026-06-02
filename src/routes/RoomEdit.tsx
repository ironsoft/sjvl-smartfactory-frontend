import {
  AlertDialog,
  AlertDialogBody,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogOverlay,
  Box,
  Button,
  Center,
  Checkbox,
  Container,
  Flex,
  FormControl,
  FormHelperText,
  FormLabel,
  Grid,
  Heading,
  HStack,
  Image,
  Input,
  InputGroup,
  InputLeftAddon,
  Select,
  Text,
  Textarea,
  useToast,
  VStack
} from "@chakra-ui/react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Helmet } from "react-helmet";
import { useForm } from "react-hook-form";
import {
  FaAngleRight,
  FaBed,
  FaCamera,
  FaCaretSquareRight,
  FaCaretSquareUp,
  FaMoneyBill,
  FaToilet
} from "react-icons/fa";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  deleteRoom,
  getRoomPhotos,
  IEditRoomVariables,
  IFilePhotos
} from "../api";
import HostOnlyPage from "../components/HostOnlyPage";
import ProtectedPage from "../components/ProtectPage";
import { IAmenity, ICategory, IRoomDetail, IRoomPhotos } from "../types";
import { getRoom, getAmenities, getRoomCategories, editRoom } from "../api";
import { useRef, useState } from "react";

export default function RoomEdit() {
  const { roomPk } = useParams();
  const { register, handleSubmit } = useForm<IEditRoomVariables>();
  const toast = useToast();
  const navigate = useNavigate();

  //룸 삭제 경고창
  const [isAlertOpen, setIsAlertOpen] = useState(false);
  const onCloseAlert = () => setIsAlertOpen(false); // 경고창에서 취소 버튼 누리면 작동
  const cancelRef = useRef<HTMLButtonElement>(null);

  // 룸 Edit
  const editRoomMutation = useMutation({
    mutationFn: editRoom,
    onSuccess: (data: IRoomDetail) => {
      toast({
        title: "Room edit completed.",
        status: "success",
        position: "bottom-right"
      });
      navigate(`/rooms/${data.id}`);
    }
  });

  // 룸 삭제 mutation
  const deleteRoomMutation = useMutation({
    mutationFn: () => {
      if (typeof roomPk === "string") {
        return deleteRoom(roomPk);
      }
      throw new Error("Room ID is undefined");
    },
    onSuccess: () => {
      toast({
        title: "Room Deleted.",
        status: "success",
        position: "bottom-right"
      });
      navigate("/");
    },
    onError: (error) => {
      // Log the error or display a message
      console.error("Error deleting room:", error);
      toast({
        title: "Error deleting room.",
        description: "Unable to delete the room.",
        status: "error",
        position: "bottom-right"
      });
    }
  });

  // room 데이터 가져오기
  const { data: editRoomData, isLoading: isEditRoomDataLoading } =
    useQuery<IRoomDetail>({
      queryKey: [`rooms`, roomPk],
      queryFn: getRoom
    });

  let editRoomAmenitesList: number[] = [];
  editRoomData?.amenities.map((chkAmenity) =>
    editRoomAmenitesList.push(chkAmenity.pk)
  );

  // 모든 amenity 가져오기
  const { data: amenitiesData, isLoading: isAmenitiesDataLoading } = useQuery<
    IAmenity[]
  >({
    queryKey: ["amenities"],
    queryFn: getAmenities
  });

  const { data: categoriesData, isLoading: isCategoriesLoading } = useQuery<
    ICategory[]
  >({
    queryKey: ["categories"],
    queryFn: getRoomCategories
  });

  // 룸 수정 Submit
  const onSubmit = (data: IEditRoomVariables) => {
    if (roomPk) {
      data.roomPk = roomPk;
      editRoomMutation.mutate(data);
    }
  };

  // 룸 삭제 동작
  const handleDelete = () => {
    onCloseAlert();
    deleteRoomMutation.mutate();
  };

  const onCameraClick = (event: React.SyntheticEvent<HTMLButtonElement>) => {
    event.preventDefault();
    navigate(`/rooms/${roomPk}/photos`);
  };

  const onVideoClick = (event: React.SyntheticEvent<HTMLButtonElement>) => {
    event.preventDefault();
    navigate(`/rooms/${roomPk}/videos`);
  }

  return (
    <ProtectedPage>
      <HostOnlyPage>
        {/* 룸, 아메니티, 카테고리 데이터가 아직 로딩 중이면 null */}
        {isEditRoomDataLoading ||
        isAmenitiesDataLoading ||
        isCategoriesLoading ? null : (
          <Box
            pb={"40"}
            mt={"10"}
            px={{
              base: 10,
              lg: 40
            }}
          >
            <Helmet>
              <title>{editRoomData ? editRoomData.name : "Loading..."}</title>
            </Helmet>
            <Heading textAlign={"center"}>Update Room</Heading>
            <Center mt={"3"}>
              <HStack>
              {/* 사진 업로드 */}
              <Button
                variant={"unstyled"}
                top={"0"}
                right={"0"}
                onClick={onCameraClick}
              >
                <HStack>
                  <FaCamera size={"20px"} />
                  <Text>Upload Photos</Text>
                  <FaAngleRight size={"20px"} />
                </HStack>
              </Button>
              {/* 비디오 업로드 */}
              <Button
                variant={"unstyled"}
                top={"0"}
                right={"0"}
                onClick={onVideoClick}
              >
                <HStack>
                  <FaCaretSquareRight size={"20px"} />
                  <Text>Upload Videos</Text>
                  <FaAngleRight size={"20px"} />
                </HStack>
              </Button>
              </HStack>

            </Center>

            <Container>
              <VStack
                spacing={"10"}
                as={"form"}
                mt={"5"}
                onSubmit={handleSubmit(onSubmit)}
              >
                <FormControl>
                  <FormLabel>Name</FormLabel>
                  <Input
                    {...register("name", { required: true })}
                    type={"text"}
                    defaultValue={editRoomData?.name}
                    required
                  />
                  <FormHelperText>Write the name of your rooms</FormHelperText>
                </FormControl>
                <FormControl>
                  <FormLabel>Country</FormLabel>
                  <Input
                    {...register("country", { required: true })}
                    type={"text"}
                    defaultValue={editRoomData?.country}
                    required
                  />
                </FormControl>
                <FormControl>
                  <FormLabel>City</FormLabel>
                  <Input
                    {...register("city", { required: true })}
                    type={"text"}
                    defaultValue={editRoomData?.city}
                    required
                  />
                </FormControl>
                <FormControl>
                  <FormLabel>Address</FormLabel>
                  <Input
                    {...register("address", { required: true })}
                    type={"text"}
                    defaultValue={editRoomData?.address}
                    required
                  />
                </FormControl>
                <FormControl>
                  <FormLabel>Price</FormLabel>
                  <InputGroup>
                    <InputLeftAddon children={<FaMoneyBill />} />
                    <Input
                      {...register("price", { required: true })}
                      type={"number"}
                      defaultValue={editRoomData?.price}
                      min={"0"}
                    />
                  </InputGroup>
                </FormControl>
                <FormControl>
                  <FormLabel>Rooms</FormLabel>
                  <InputGroup>
                    <InputLeftAddon children={<FaBed />} />
                    <Input
                      {...register("rooms", { required: true })}
                      type={"number"}
                      defaultValue={editRoomData?.rooms}
                      min={"0"}
                    />
                  </InputGroup>
                </FormControl>
                <FormControl>
                  <FormLabel>Toilets</FormLabel>
                  <InputGroup>
                    <InputLeftAddon children={<FaToilet />} />
                    <Input
                      {...register("toilets", { required: true })}
                      type={"number"}
                      defaultValue={editRoomData?.toilets}
                      min={"0"}
                    />
                  </InputGroup>
                </FormControl>
                <FormControl>
                  <FormLabel>Description</FormLabel>
                  <Textarea
                    {...register("description", { required: true })}
                    defaultValue={editRoomData?.description}
                  />
                </FormControl>
                <FormControl>
                  <Checkbox
                    {...register("pet_friendly")}
                    defaultChecked={editRoomData?.pet_friendly}
                  >
                    Pet Friendly?
                  </Checkbox>
                </FormControl>
                <FormControl>
                  <FormLabel>Kind of room</FormLabel>
                  <Select
                    {...register("kind", { required: true })}
                    placeholder="Choose a kind"
                    defaultValue={editRoomData?.kind}
                  >
                    <option value={"entire_place"}>Entire Place</option>
                    <option value={"private_room"}>Private Room</option>
                    <option value={"shared_room"}>Shared Room</option>
                  </Select>
                  <FormHelperText>
                    What kind of room are you renting?
                  </FormHelperText>
                </FormControl>
                <FormControl>
                  <FormLabel>Category</FormLabel>
                  <Select
                    {...register("category", { required: true })}
                    placeholder="Choose a Category"
                    defaultValue={editRoomData?.category.pk}
                  >
                    {categoriesData?.map((category) => (
                      <option key={category.pk} value={category.pk}>
                        {category.name}
                      </option>
                    ))}
                  </Select>
                  <FormHelperText>
                    What category describes your room?
                  </FormHelperText>
                </FormControl>
                <FormControl>
                  <FormLabel>Amenities</FormLabel>
                  <Grid templateColumns={"1fr 1fr"} gap={"5"}>
                    {amenitiesData?.map((amenity) => (
                      <Box key={amenity.pk}>
                        <Checkbox
                          value={amenity.pk}
                          {...register("amenities", { required: true })}
                          defaultChecked={
                            // 기존에 선택했던 amenity의 pk와 같은 chkAmenity 반환?
                            editRoomAmenitesList.filter(
                              (chkAmenity) => chkAmenity === amenity.pk
                            ).length > 0
                              ? true
                              : false
                          }
                        >
                          {amenity.name}
                        </Checkbox>
                      </Box>
                    ))}
                  </Grid>
                  <FormHelperText>amenity description</FormHelperText>
                </FormControl>
                <Button
                  type="submit"
                  isLoading={editRoomMutation.isPending}
                  colorScheme={"red"}
                  size={"lg"}
                  w={"100%"}
                >
                  Upldate Room
                </Button>
                {/* Delete Button */}
                <Button
                  colorScheme="red"
                  // 삭제 버튼을 클릭하면 setIsAlertOpen(true) 가 작동
                  onClick={() => setIsAlertOpen(true)}
                  mt={4}
                >
                  Delete Room
                </Button>

                <AlertDialog
                  isOpen={isAlertOpen}
                  leastDestructiveRef={cancelRef}
                  onClose={onCloseAlert}
                >
                  <AlertDialogOverlay>
                    <AlertDialogContent>
                      <AlertDialogHeader fontSize={"lg"} fontWeight={"bold"}>
                        Delete Room
                      </AlertDialogHeader>
                      <AlertDialogBody>
                        Are you sure? You can't undo this action afterwards.
                      </AlertDialogBody>
                      <AlertDialogFooter>
                        <Button ref={cancelRef} onClick={onCloseAlert}>
                          Cancel
                        </Button>
                        <Button colorScheme="red" onClick={handleDelete} ml={3}>
                          Delete
                        </Button>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialogOverlay>
                </AlertDialog>
              </VStack>
            </Container>
          </Box>
        )}
      </HostOnlyPage>
    </ProtectedPage>
  );
}
