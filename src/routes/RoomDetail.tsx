import {
  Avatar,
  Box,
  Button,
  ButtonGroup,
  Container,
  Flex,
  FormControl,
  FormErrorMessage,
  Grid,
  GridItem,
  Heading,
  HStack,
  Icon,
  Image,
  InputGroup,
  InputLeftAddon,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Select,
  Skeleton,
  Text,
  Textarea,
  useBreakpointValue,
  useColorModeValue,
  useDisclosure,
  useToast,
  VStack
} from "@chakra-ui/react";
import { useMutation, useQuery } from "@tanstack/react-query";
import React, { useEffect, useState } from "react";
import "../calendar.css";
import Calendar from "react-calendar";
import "react-calendar/dist/Calendar.css";
import { Helmet } from "react-helmet";
import {
  FaAngleDown,
  FaAngleUp,
  FaEdit,
  FaPen,
  FaPlay,
  FaStar,
  FaTimes,
  FaUserFriends
} from "react-icons/fa";
import { Form, Link, useNavigate, useParams } from "react-router-dom";
import {
  checkBooking,
  createReview,
  deleteReview,
  editReview,
  getRoom,
  getRoomReviews,
  IRoomBookingSuccess,
  IRoomBookingVariables,
  roomBooking
} from "../api";
import { IReview, IReviewResponse, IRoomDetail } from "../types";
import { useForm } from "react-hook-form";
import { formatDate } from "../lib/utils";
import useUser from "../lib/useUser";
import PhotoModal from "../components/PhotoModal";
import RoomInformation from "../components/RoomInformation";
import VideoModal from "../components/VideoModal";

export default function RoomDetail() {
  const { roomPk } = useParams();

  // 방 정보 가져오기
  const { isLoading, data } = useQuery<IRoomDetail>({
    queryKey: [`roomDetail`, roomPk],
    queryFn: getRoom
  });
  console.log(data);

  // pagination 상태관리
  const [currentPage, setCurrentPage] = useState(1);

  // 더보기 버튼을 누르면 리뷰들을 중첩으로 보여주기 위해 상태관리
  const [allReviews, setAllReviews] = useState<IReview[]>([]);

  // 리뷰 가져오기
  const {
    isLoading: isReviewsLoading,
    data: reviewsData,
    refetch: refetchReviews
  } = useQuery<IReviewResponse>({
    queryKey: [`rooms`, roomPk, `reviews`, currentPage],
    queryFn: getRoomReviews
  });

  // 총 페이지 수 계산
  const totalPages = reviewsData?.total_pages;

  // reviewsData가 변경될 때마다 allReviews에 추가하는 useEffect
  useEffect(() => {
    if (reviewsData && reviewsData.reviews) {
      setAllReviews((prev) => [...prev, ...reviewsData.reviews]);
    }
  }, [reviewsData]);

  // 리뷰 더 가져오기
  const loadMoreReviews = () => {
    if (currentPage < (totalPages || 0)) {
      setCurrentPage(currentPage + 1);
    }
  };

  // 예약 날짜 선택
  const [dates, setDates] = useState<Date[] | undefined>(); // Date로 타입지정
  // 날짜 선택시 실행되는 함수
  const handleDateChange = (value: any) => {
    setDates(value);
  };

  // 예약 가능 여부 체크
  const {
    data: checkBookingData,
    isLoading: isCheckingBooking,
    error
  } = useQuery({
    queryKey: [`check`, roomPk, dates],
    queryFn: checkBooking,
    // cacheTime: 0
    enabled: dates !== undefined
  });

  // 예약 form hook
  const { register, handleSubmit } = useForm<IRoomBookingVariables>();
  const toast = useToast();

  // 예약 mutation
  const roomBookingMutation = useMutation({
    mutationFn: roomBooking,
    onSuccess: (data: IRoomBookingSuccess) => {
      toast({
        title: "Booking complete",
        description: `From: ${data.check_in} To: ${data.check_out} Booking Completed`,
        status: "success",
        position: "bottom-right"
      });
    }
  });

  // 예약 생성 OnSubmit시 실행되는 함수
  const createBooking = (data: IRoomBookingVariables) => {
    if (dates && roomPk) {
      const [firstDate, secondDate] = dates;
      const checkIn = formatDate(firstDate);
      const checkOut = formatDate(secondDate);
      data.check_in = checkIn;
      data.check_out = checkOut;
      data.roomPk = roomPk;
      data.kind = "room";
      roomBookingMutation.mutate(data);
    }
  };

  // Chakra UI의 useColorModeValue 훅을 사용하여 라이트/다크 모드일 때 컬러 적용
  const bgColor = useColorModeValue("white", "gray.800");
  const textColor = useColorModeValue("gray.800", "white");
  const calendarLabelTextColor = useColorModeValue("gray.800", "gray.100");
  const calendarLabelBgColor = useColorModeValue("gray.100", "gray.800");

  // 룸 사진 모달
  const [isRoomPhotoModalOpen, setIsRoomPhotoModalOpen] = useState(false);
  const [selectedImage, setSeletedImage] = useState<string | undefined>();

  // 사진 onClick시 모달 창 열기 닫기 작동 함수
  const openPhotoModal = (image: string) => {
    setSeletedImage(image);
    setIsRoomPhotoModalOpen(true);
  };
  const closePhotoModal = () => setIsRoomPhotoModalOpen(false);

  // 룸 비디오 모달
  const [isRoomVideoModalOpen, setIsRoomVideoModalOpen] = useState(false);
  const [selectedVideo, setSeletedVideo] = useState<string | undefined>();

  // 비디오 onClick시 모달 창 열기 닫기 작동 함수
  const openVideoModal = (video: string) => {
    setSeletedVideo(video);
    setIsRoomVideoModalOpen(true);
  };
  const closeVideoModal = () => setIsRoomVideoModalOpen(false);

  // Room Edit
  const navigate = useNavigate();
  const onEditClick = (event: React.SyntheticEvent<HTMLButtonElement>) => {
    event.preventDefault(); // 이벤트 버블링 방지 (클릭이 링크로 전파되는 것을 방지?)
    navigate(`/rooms/${data?.id}/edit`);
  };

  // 리뷰 모달 창 열기 닫기 작동 함수
  const {
    isOpen: isReviewModalOpen,
    onOpen: onReviewModalOpen,
    onClose: onReviewModalClose
  } = useDisclosure();

  // 리뷰 작성 폼
  const {
    register: reviewRegister,
    handleSubmit: reviewHand,
    reset: resetReviewForm,
    formState: { errors }
  } = useForm();

  // 리뷰 작성 mutation
  const reviewMutation = useMutation({
    mutationFn: createReview,
    onSuccess: () => {
      toast({
        title: "Review posted",
        description: "Thank you for your review",
        status: "success",
        position: "bottom-right"
      });

      onReviewModalClose(); // 리뷰 작성 모달을 닫음
      setAllReviews([]); // All리뷰들 배열을 초기화
      refetchReviews(); // 리뷰 작성 후 리뷰를 다시 가져옴
      setCurrentPage(1); // 페이지를 1로 초기화해 다시 보여줌
      resetReviewForm(); // 리뷰 작성 후 리뷰 폼을 리셋
    }
  });
  // 리뷰 작성 OnSubmit시 실행되는 함수
  const onReviewSubmit = (data: any) => {
    if (roomPk) {
      reviewMutation.mutate({
        payload: data.payload,
        rating: data.rating,
        roomPk: roomPk
      });
    }
  };

  // 로그인한 사용자 정보 가져오기 (만들어 놓은 useUser hook 사용, 여기서는 review 작성한 사람이 로그인한 사람인지 판단하여 edit 버튼이 보이도록)
  const { userLoading, isLoggedIn, user } = useUser();

  // 리뷰 편집 모달
  const {
    isOpen: isEditReviewModalOpen,
    onOpen: onEditReviewModalOpen,
    onClose: onEditReviewModalClose
  } = useDisclosure();

  // 리뷰편집 defaultValue 값 상태 관리
  const [editingReview, setEditingReview] = useState<IReview | null>(null);

  // 리뷰 편집 폼
  const {
    register: editReviewRegister,
    handleSubmit: editReviewHandleSubmit,
    reset: resetEditReviewForm,
    formState: { errors: editErrors }
  } = useForm();

  // 리뷰 편집 mutation
  const editReviewMutation = useMutation({
    mutationFn: editReview,
    onSuccess: () => {
      toast({
        title: "Review edited",
        description: "Thank you for your review",
        status: "success",
        position: "bottom-right"
      });
      // 이 순서대로 실행해야 삭제된 review가 바로 화면에서 보이지 않음.
      setAllReviews([]); // All리뷰들 배열을 초기화
      refetchReviews(); // 리뷰 작성 후 리뷰를 다시 가져옴
      setCurrentPage(1); // 페이지를 1로 초기화해 다시 보여줌
      resetReviewForm(); // 리뷰 작성 후 리뷰 폼을 리셋
      onEditReviewModalClose(); // 리뷰 편집 모달을 닫음
    }
  });

  // 리뷰 편집 OnSubmit시 실행되는 함수
  const onEditReviewSubmit = (data: any) => {
    console.log(editingReview?.pk);
    if (roomPk && editingReview?.pk) {
      editReviewMutation.mutate({
        payload: data.payload,
        rating: data.rating,
        reviewId: editingReview?.pk,
        roomPk: roomPk
      });
    }
  };

  // 리뷰 삭제 mutation
  const deleteReviewMutation = useMutation({
    mutationFn: (args: { reviewId: number; roomPk: string }) =>
      deleteReview(args.reviewId, args.roomPk),
    onSuccess: () => {
      toast({
        title: "Review deleted",
        description: "Thank you for your review",
        status: "success",
        position: "bottom-right"
      });

      // 이 순서대로 실행해야 삭제된 review가 바로 화면에서 보이지 않음.
      setAllReviews([]); // All리뷰들 배열을 초기화
      refetchReviews(); // 리뷰 작성 후 리뷰를 다시 가져옴
      setCurrentPage(1); // 페이지를 1로 초기화해 다시 보여줌
      resetReviewForm(); // 리뷰 삭제 후 리뷰 폼을 리셋
      onEditReviewModalClose();
    }
  });

  // 리뷰 삭제 OnSubmit시 실행되는 함수
  const onDeleteReviewSubmit = () => {
    if (roomPk && editingReview?.pk) {
      deleteReviewMutation.mutate({
        reviewId: editingReview?.pk,
        roomPk: roomPk
      });
    }
  };

  // 사진 하단 부분 반응형  
  const templateColumns = useBreakpointValue({ base: "1fr", md: "2fr 1fr" });


  return (
    <Box
      mt={"10"}
      px={{
        base: 10,
        lg: 40
      }}
    >
      <Helmet>
        <title>{data ? data.name : "Loading..."}</title>
      </Helmet>
      {/* 제목 */}
      <Skeleton mb={"5"} height={"43px"} width={"75%"} isLoaded={!isLoading}>
        <HStack>
          <Heading>{data?.name}</Heading>
          {data?.is_owner && (
            // 방 주인이면 수정 버튼 보이도록
            <Button variant={"unstyled"} onClick={onEditClick}>
              {data?.is_owner ? <FaEdit size={"25"} /> : null}
            </Button>
          )}
        </HStack>
      </Skeleton>
      {/* 상단 사진들 */}
      <Box>
        <Heading size={"md"} mb={"2"} textColor={"GrayText"}>사진</Heading>
      <Grid
        gap={"3"}
        height={"50vh"}
        templateRows={"1fr 1fr"}
        templateColumns={["repeat(2, 1fr)", "repeat(3, 1fr)", "repeat(4, 1fr)"]}
      >
        {/* 사진 4장만 보여주기 */}
        {[0, 1, 2, 3, 4].map((index) => (
          <GridItem
            // 첫번째 사진은 사이즈가 크게 나오도록.
            colSpan={index === 0 ? 2 : 1}
            rowSpan={index === 0 ? 2 : 1}
            overflow={"hidden"}
            key={index}
          >
            <Skeleton isLoaded={!isLoading} h={"100%"} w={"100%"}>
              {data?.photos && data.photos.length > 0 ? (
                <Image
                  w={"100%"}
                  h={"100%"}
                  objectFit={"cover"}
                  src={data?.photos[index]?.file}
                  onClick={() => openPhotoModal(data?.photos[index]?.file)}
                  cursor={data?.photos[index]?.file ? "pointer" : "default"}
                  _hover={
                    data?.photos[index]?.file
                      ? {
                          transform: "scale(1.02)", // 마우스 오버 시에 컴포넌트 크기를 5% 증가
                          transition: "transform 0.3s" // 크기 변화에 0.3초 동안의 애니메이션 효과 적용
                        }
                      : {}
                  }
                />
              ) : null}
            </Skeleton>
            {/* 사진을 클릭하면 상세보기 처럼 열리는 모달창 */}
            <PhotoModal
              isOpen={isRoomPhotoModalOpen}
              onClose={closePhotoModal}
              selectedImage={selectedImage}
            />
          </GridItem>
        ))}
      </Grid>
      </Box>
      {/* 비디오 */}
      <Box mt={"5"}>
        <Heading size={"md"} mb={"2"} textColor={"GrayText"}>비디오</Heading>
        <Skeleton isLoaded={!isLoading} h={"100%"} w={"100%"}>
          {data?.videos && data.videos.length > 0 ? (
            <Box position="relative" w={"250px"} h={"250px"} onClick={() => openVideoModal(data?.videos[0].VideoFile)} _hover={{
              filter: "brightness(90%)",
            }}>
              {data?.videos[0].ThumbnailFile ? (
                <Image // Thumbnailfile이 이미지 파일이면 Image로 보여주기
                  src={data?.videos[0].ThumbnailFile}
                  position="absolute"
                  top="0"
                  left="0"
                  height="100%"
                  width="100%"
                  rounded={"md"}
                  objectFit={"cover"} // Set objectFit to "cover"
                  overflow={"hidden"}
                />
              ) : (
                <Box as="iframe" // Thumbnailfile이 비디오 파일이면 iframe으로 보여주기
                  src={data?.videos[0].VideoFile  + '?controls=false'}
                  allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;"
                  border="none"
                  position="absolute"
                  top="0"
                  left="0"
                  height="100%"
                  width="100%"
                  rounded={"md"}
                  overflow={"hidden"}
                />
              )}
            <Icon as={FaPlay} cursor={"pointer"} position="absolute" top="50%" left="50%" transform="translate(-50%, -50%)" w={"10"} h={"10"} color="white" />
            </Box>
          ) : null}
        </Skeleton>
        {/* 클릭하면 비디오 플레이어 모달창 */}
        <VideoModal
          isOpen={isRoomVideoModalOpen}
          onClose={closeVideoModal}
          selectedVideo={selectedVideo}
        />
      </Box>
      {/* 사진 하단 정보 */}
      <Grid
        as={"form"}
        onSubmit={handleSubmit(createBooking)}
        gap={"20"}
        templateColumns={templateColumns}
        mt={"10"}
      >
        {/* 왼쪽 정보 */}
        <Box>
          {/* 호스트 이름, 아바타, 룸 정보 */}
          <RoomInformation isLoading={isLoading} data={data} />
          {/* 리뷰부분 */}
          <Box mt={"10"}>
            <HStack justifyContent={"flex-start"}>
              <Skeleton isLoaded={!isLoading} height={"30px"} w={"50%"}>
                {/* 리뷰 상단 평점/리뷰개수 */}
                <Heading mb={5} fontSize={"2xl"}>
                  <HStack>
                    <FaStar />
                    <Text>{reviewsData?.average_rating}</Text>
                    <Text>•</Text>
                    <Text>
                      {reviewsData?.review_count} review
                      {reviewsData?.review_count === 1 ? "" : "s"}
                    </Text>
                  </HStack>
                </Heading>
              </Skeleton>
              {/* 리뷰 작성 버튼 */}
              <Button
                leftIcon={<Icon as={FaPen} />}
                onClick={onReviewModalOpen}
              >
                Write a Review
              </Button>
              </HStack>
              {/* 리뷰 작성 모달 폼 */}
              <Modal
                size={"2xl"}
                isOpen={isReviewModalOpen}
                onClose={onReviewModalClose}
              >
                <ModalOverlay />
                <ModalContent as={"form"} onSubmit={reviewHand(onReviewSubmit)}>
                  <ModalHeader>Write a Review</ModalHeader>
                  <ModalCloseButton />
                  <ModalBody>
                    <FormControl mb={"4"}>
                      <Textarea
                        {...reviewRegister("payload")}
                        placeholder="Write your review here..."
                        size={"lg"}
                        style={{ height: "150px", width: "100%" }} // Textarea의 크기를 조절
                      />
                    </FormControl>
                    <FormControl isInvalid={!!errors.rating}>
                      {/* !!errors.rating은 errors.rating이 존재하면 true, 없으면 false */}
                      <Select
                        {...reviewRegister("rating", {
                          required: "Rating is required."
                        })} // required: "Rating is required."는 에러 메시지
                        placeholder="Rating"
                      >
                        {[1, 2, 3, 4, 5].map((rating) => (
                          <option key={rating} value={rating}>
                            {rating}
                          </option>
                        ))}
                      </Select>
                      {/* // errors.rating이 존재하면 에러 메시지 출력 */}
                      {errors.rating &&
                        typeof errors.rating.message === "string" && (
                          <FormErrorMessage>
                            {errors.rating.message}
                          </FormErrorMessage>
                        )}
                    </FormControl>
                  </ModalBody>

                  <ModalFooter>
                    <Button
                      colorScheme="blue"
                      mr={3}
                      onClick={onReviewModalClose}
                    >
                      Close
                    </Button>
                    <Button colorScheme="red" type="submit">
                      Post Review
                    </Button>
                  </ModalFooter>
                </ModalContent>
              </Modal>
            
            {/* 리뷰 코멘트 내용 */}
            <Container mt={"16"} mb={"30"} maxW={"container.lg"} marginX="none">
              <Grid gap={"10"} templateColumns={"1fr 1fr"} mb={"10"}>
                {allReviews.map((review, index) => (
                  <VStack alignItems={"flex-start"} key={index}>
                    <HStack>
                      <Link to={`/users/${review.user.pk}`}>
                        <Avatar
                          name={review.user.name}
                          src={review.user.avatar}
                          size={"md"}
                        />
                      </Link>
                      <VStack spacing={"0"} alignItems={"flex-start"}>
                        <Heading fontSize={"medium"}>
                          {review.user.name}
                        </Heading>
                        <HStack spacing={"1"}>
                          <FaStar size={"12px"} />
                          <Text>{review.rating}</Text>
                          {/* // 리뷰 작성자가 로그인한 사용자와 같으면 edit 버튼이 보이도록 */}
                          {review.user.pk === user?.id && (
                            <Button
                              onClick={() => {
                                // edit 버튼을 클릭시 폼에 내용을 초기화 하기
                                resetEditReviewForm({
                                  payload: review.payload,
                                  rating: review.rating
                                });
                                // defaultValue에 입력할 리뷰 데이터를 상태로 관리
                                setEditingReview(review);
                                onEditReviewModalOpen();
                              }}
                              size="xs"
                            >
                              Edit
                            </Button>
                          )}
                        </HStack>
                        {/* // 리뷰 작성 시간 */}
                        <Text fontSize={"sm"} color={"gray.500"}>
                          {new Date(review.created_at).toLocaleDateString(
                            "ko-KR",
                            {
                              year: "numeric",
                              month: "long",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit"
                            }
                          )}
                        </Text>
                      </VStack>
                    </HStack>
                    <Text>{review.payload}</Text>
                    {/* 리뷰 편집 모달 폼 */}
                    <Modal
                      key={editingReview ? editingReview.pk : "new"}
                      size={"2xl"}
                      isOpen={isEditReviewModalOpen}
                      onClose={onEditReviewModalClose}
                    >
                      <ModalOverlay />
                      <ModalContent
                        as={"form"}
                        onSubmit={editReviewHandleSubmit(onEditReviewSubmit)}
                      >
                        <ModalHeader>Edit Review</ModalHeader>
                        <ModalCloseButton />
                        <ModalBody>
                          <FormControl mb={"4"}>
                            <Textarea
                              {...editReviewRegister("payload", {
                                required: "Please write review."
                              })}
                              size={"lg"}
                              style={{ height: "150px", width: "100%" }} // Textarea의 크기를 조절
                              defaultValue={editingReview?.payload}
                            />
                          </FormControl>
                          <FormControl isInvalid={!!errors.rating}>
                            {/* !!errors.rating은 errors.rating이 존재하면 true, 없으면 false */}
                            <Select
                              {...editReviewRegister("rating", {
                                required: "Rating is required."
                              })} // required: "Rating is required."는 에러 메시지
                              defaultValue={editingReview?.rating}
                              placeholder="Rating"
                            >
                              {[1, 2, 3, 4, 5].map((rating) => (
                                <option key={rating} value={rating}>
                                  {rating}
                                </option>
                              ))}
                            </Select>
                            {/* // errors.rating이 존재하면 에러 메시지 출력 */}
                            {errors.rating &&
                              typeof errors.rating.message === "string" && (
                                <FormErrorMessage>
                                  {errors.rating.message}
                                </FormErrorMessage>
                              )}
                          </FormControl>
                        </ModalBody>
                        <ModalFooter justifyContent={"space-between"}>
                          <Button onClick={onDeleteReviewSubmit}>Delete</Button>
                          <ButtonGroup>
                            <Button
                              colorScheme="blue"
                              mr={3}
                              onClick={onEditReviewModalClose}
                            >
                              Close
                            </Button>
                            <Button colorScheme="red" type="submit">
                              Edit Review
                            </Button>
                          </ButtonGroup>
                        </ModalFooter>
                      </ModalContent>
                    </Modal>
                  </VStack>
                ))}
              </Grid>
              {/* 리뷰 더보기 페이지네이션 */}
              {allReviews.length > 0 && // 리뷰가 있을 때만 버튼을 보여줍니다.
                (currentPage < (totalPages || 0) ? ( // 현재 페이지가 전체 페이지보다 작으면 더보기 버튼 보여주기
                  <Button
                    rightIcon={<FaAngleDown />}
                    variant={"unstyled"}
                    onClick={loadMoreReviews}
                  >
                    more
                  </Button>
                ) : (
                  currentPage > 1 && ( // 페이지가 1보다 클 때만 접기 버튼을 보여줍니다.
                    <Button // 더 보여줄 리뷰가 없으면 접기 버튼 보여주기
                      rightIcon={<FaAngleUp />}
                      variant={"unstyled"}
                      onClick={() => {
                        setAllReviews([]); // 리뷰들을 초기화
                        setCurrentPage(1); // 페이지를 1로 초기화
                      }}
                    >
                      접기
                    </Button>
                  )
                ))}
            </Container>
          </Box>
        </Box>
        {/* 오른쪽 캘린더 */}
        <Box
          h={"75vh"}

          sx={{
            ".react-calendar": {
              backgroundColor: bgColor,
              color: textColor
              // 여기에 추가적인 스타일을 적용할 수 있습니다.
            },
            // 여기에 필요한 다른 선택자들을 추가할 수 있습니다.
            ".react-calendar__navigation button:disabled": {
              color: calendarLabelTextColor,
              background: calendarLabelBgColor
            }
          }}
          display={"flex"}
          flexDirection={"column"}
          justifyContent={"center"}
          alignItems={"center"}
        >
          <Text fontWeight={"bold"} fontSize={"xl"} mb={"5"}>
            Select your dates for booking
          </Text>
          <Calendar
            formatDay={(locale, date) =>
              date.toLocaleDateString("en", { day: "numeric" })
            }
            goToRangeStartOnSelect
            onChange={handleDateChange}
            prev2Label={null}
            next2Label={null}
            minDetail={"month"}
            // 과거일 선택 안됨.
            minDate={new Date()}
            // 최대 6개월까지만 선택
            maxDate={new Date(Date.now() + 60 * 60 * 24 * 7 * 4 * 6 * 1000)}
            selectRange
          />
          <HStack mt={"5"} mb={"2"}>
            <Text>Guests</Text>
            <InputGroup>
              <InputLeftAddon children={<FaUserFriends />} />
              <Select
                {...register("guests", { required: true })}
                defaultValue={"1"}
                w={"55%"}
              >
                {[1, 2, 3, 4, 5].map((guest) => (
                  <option key={guest} value={guest}>
                    {guest}
                  </option>
                ))}
              </Select>
            </InputGroup>
          </HStack>
          <Button
            type="submit"
            isDisabled={!checkBookingData?.ok}
            isLoading={isCheckingBooking && dates !== undefined}
            mt={"5"}
            w={"80%"}
            colorScheme={"red"}
          >
            Make booking
          </Button>
          {!isCheckingBooking && !checkBookingData?.ok ? (
            <Text color={"red.500"}>Can't book on those dates, Sorry</Text>
          ) : null}
        </Box>
      </Grid>
    </Box>
  );
}
