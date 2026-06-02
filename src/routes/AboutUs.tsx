"use client";

import {
  Container,
  Stack,
  Flex,
  Box,
  Heading,
  Text,
  Button,
  Image,
  Icon,
  createIcon,
  IconProps,
  Avatar
} from "@chakra-ui/react";
import { FaEnvelope, FaPlay } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import VideoModal from "../components/VideoModal";
import { useState } from "react";

export default function AboutUs() {
  const navigate = useNavigate();
  // 룸 비디오 모달
  const [isRoomVideoModalOpen, setIsRoomVideoModalOpen] = useState(false);
  const [selectedVideo, setSeletedVideo] = useState<string | undefined>();

  // 비디오 onClick시 모달 창 열기 닫기 작동 함수
  const openVideoModal = (video: string) => {
    setSeletedVideo(video);
    setIsRoomVideoModalOpen(true);
  };
  const closeVideoModal = () => setIsRoomVideoModalOpen(false);

  return (
    <Container maxW={"90%"}>
      <Stack
        align={"start"}
        spacing={{ base: 8, md: 10 }}
        py={{ base: 5, md: 28 }}
        px={{ base: 5, md: 10 }}
        direction={{ base: "column", md: "row" }}
      >
        {/* 왼쪽 내용 */}
        <Stack flex={1} spacing={{ base: 5, md: 10 }}>
          <Text>Sungjin Innovation Team 2026</Text>
          <Heading
            lineHeight={1.1}
            fontWeight={600}
            fontSize={{ base: "3xl", sm: "4xl", lg: "6xl" }}
          >
            <Text
              as={"span"}
              position={"relative"}
              _after={{
                content: "''",
                width: "full",
                height: "30%",
                position: "absolute",
                bottom: 1,
                left: 0,
                bg: "red.400",
                zIndex: -1
              }}
            >
              We're going to the next level.
            </Text>
          </Heading>
          <Text fontSize={"lg"} color={"gray.500"}>
            The SJ Innovation Team represents a strategic mandate from our
            leadership to elevate Sungjin Inc. to the next level. Our mission is
            to deliver unrivaled service differentiation to our clients while
            maximizing internal efficiency to provide superior benefits to our
            employees—ultimately building a stronger, more resilient partner for
            you.
          </Text>
          <Stack
            spacing={{ base: 4, sm: 6 }}
            direction={{ base: "column", sm: "row" }}
          >
            <Button
              rounded={"full"}
              size={"lg"}
              fontWeight={"normal"}
              px={6}
              colorScheme={"red"}
              bg={"red.400"}
              _hover={{ bg: "red.500" }}
              leftIcon={<FaEnvelope color={"gray.300"} />}
            >
              Contact Me
            </Button>
            <Button
              rounded={"full"}
              size={"lg"}
              fontWeight={"normal"}
              px={6}
              onClick={() => {
                navigate("/aboutus/aboutme");
              }}
              leftIcon={
                <Avatar
                  src="https://imagedelivery.net/mzmXhxWLR9jzdX8u9g4BBQ/538797c2-d1be-4d8f-736d-629daafc4900/public"
                  h={4}
                  w={4}
                  color={"gray.300"}
                />
              }
            >
              About Me
            </Button>
          </Stack>
        </Stack>
        {/* 오른쪽 영상 */}
        <Stack maxW="100%" p={5}>
          <Box
            display={"flex"}
            position="relative"
            alignContent={"center"}
            justifyContent={"center"}
            alignItems={"center"}
            h={{
              base: "600px",
              md: "600px",
              lg: "1000px"
            }}
            onClick={() => {}}
            _hover={{
              filter: "brightness(90%)"
            }}
          >
            <Icon
              as={FaPlay}
              cursor={"pointer"}
              position="absolute"
              top="50%"
              left="50%"
              transform="translate(-50%, -50%)"
              w={"10"}
              h={"10"}
              color="white"
              onClick={() =>
                openVideoModal(
                  "https://customer-u4d1gjshe6uaaa9n.cloudflarestream.com/36b13e81343314384885730aa7bacac2/iframe?loop=true&autoplay=true&poster=https%3A%2F%2Fcustomer-u4d1gjshe6uaaa9n.cloudflarestream.com%2F36b13e81343314384885730aa7bacac2%2Fthumbnails%2Fthumbnail.jpg%3Ftime%3D%26height%3D600"
                )
              }
            />
            <Image
              src={
                "https://imagedelivery.net/mzmXhxWLR9jzdX8u9g4BBQ/aa420500-24d7-4e29-0eed-f886d7905d00/public"
              }
              top="0"
              left="0"
              height="100%"
              width={{
                base: "100%",
                md: "80%"
              }}
              rounded={"md"}
              objectFit={"contain"}
              overflow={"hidden"}
            />

            {/* 사진을 클릭하면 상세보기 처럼 열리는 모달창 */}
            <VideoModal
              isOpen={isRoomVideoModalOpen}
              onClose={closeVideoModal}
              selectedVideo={selectedVideo}
            />
          </Box>
        </Stack>
      </Stack>
    </Container>
  );
}

const PlayIcon = createIcon({
  displayName: "PlayIcon",
  viewBox: "0 0 58 58",
  d: "M28.9999 0.562988C13.3196 0.562988 0.562378 13.3202 0.562378 29.0005C0.562378 44.6808 13.3196 57.438 28.9999 57.438C44.6801 57.438 57.4374 44.6808 57.4374 29.0005C57.4374 13.3202 44.6801 0.562988 28.9999 0.562988ZM39.2223 30.272L23.5749 39.7247C23.3506 39.8591 23.0946 39.9314 22.8332 39.9342C22.5717 39.9369 22.3142 39.8701 22.0871 39.7406C21.86 39.611 21.6715 39.4234 21.5408 39.1969C21.4102 38.9705 21.3421 38.7133 21.3436 38.4519V19.5491C21.3421 19.2877 21.4102 19.0305 21.5408 18.8041C21.6715 18.5776 21.86 18.3899 22.0871 18.2604C22.3142 18.1308 22.5717 18.064 22.8332 18.0668C23.0946 18.0696 23.3506 18.1419 23.5749 18.2763L39.2223 27.729C39.4404 27.8619 39.6207 28.0486 39.7458 28.2713C39.8709 28.494 39.9366 28.7451 39.9366 29.0005C39.9366 29.2559 39.8709 29.507 39.7458 29.7297C39.6207 29.9523 39.4404 30.1391 39.2223 30.272Z"
});

const Blob = (props: IconProps) => {
  return (
    <Icon
      width={"100%"}
      viewBox="0 0 578 440"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M239.184 439.443c-55.13-5.419-110.241-21.365-151.074-58.767C42.307 338.722-7.478 282.729.938 221.217c8.433-61.644 78.896-91.048 126.871-130.712 34.337-28.388 70.198-51.348 112.004-66.78C282.34 8.024 325.382-3.369 370.518.904c54.019 5.115 112.774 10.886 150.881 49.482 39.916 40.427 49.421 100.753 53.385 157.402 4.13 59.015 11.255 128.44-30.444 170.44-41.383 41.683-111.6 19.106-169.213 30.663-46.68 9.364-88.56 35.21-135.943 30.551z"
        fill="currentColor"
      />
    </Icon>
  );
};
