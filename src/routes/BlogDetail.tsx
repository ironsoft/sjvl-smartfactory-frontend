"use client";

import {
  Box,
  Container,
  Stack,
  Text,
  Image,
  Flex,
  Heading,
  StackDivider,
  useColorModeValue,
  Badge,
  HStack,
  useToast,
  LinkBox,
  LinkOverlay,
  Avatar,
  useBreakpointValue,
  VStack,
  Skeleton,
  Icon,
  IconButton,
  Button,
  Divider
} from "@chakra-ui/react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { IBlog, ITerm } from "../types";
import { useMutation, useQuery } from "@tanstack/react-query";
import { deleteBagTerm, getBagTermDetail, getBlogDetail } from "../api";
import { useRef, useState } from "react";
import { t } from "i18next";
import PhotoModal from "../components/PhotoModal";
import BagStyleSimpleCard from "../components/BagStyleSimpleCard";
import { FaCamera, FaPlay, FaPlus } from "react-icons/fa";
import VideoModal from "../components/VideoModal";

export default function BlogDetail() {
  // term 삭제 경고창
  const [isAlertOpen, setIsAlertOpen] = useState(false);
  const onCloseAlert = () => setIsAlertOpen(false);
  const cancelRef = useRef<HTMLButtonElement>(null);

  // blogId 가져오기
  const { blogId } = useParams();

  // useQuery를 이용해서 blog detail 가져오기
  const { data: blogData, isLoading: isBlogLoading } = useQuery<IBlog>({
    queryKey: [`blogs`, blogId],
    queryFn: getBlogDetail
  });

  console.log("blogData", blogData);

  const toast = useToast();
  const navigate = useNavigate();

  // 사진 모달창 상태 관리
  const [isTermPhotoModalOpen, setIsTermPhotoModalOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | undefined>("");

  // 사진 onClick시 모달창 열기 닫기 작동 함수
  const openPhotoModal = (image: string) => {
    setIsTermPhotoModalOpen(true);
    setSelectedImage(image);
  };
  const closePhotoModal = () => {
    setIsTermPhotoModalOpen(false);
    setSelectedImage(undefined);
  };

  // 룸 비디오 모달
  const [isRoomVideoModalOpen, setIsRoomVideoModalOpen] = useState(false);
  const [selectedVideo, setSeletedVideo] = useState<string | undefined>();

  // 비디오 onClick시 모달 창 열기 닫기 작동 함수
  const openVideoModal = (video: string) => {
    setSeletedVideo(video);
    setIsRoomVideoModalOpen(true);
  };
  const closeVideoModal = () => setIsRoomVideoModalOpen(false);

  const isBase = useBreakpointValue({ base: true, md: false });

  return (
    <Container maxW={"4xl"}>
      <Box py={{ base: 5, md: 5 }}>
        <Box as={"header"}>
          {/* 스타일 사진, 이름, 코드 */}
          <BagStyleSimpleCard />
          {/* title */}
          <Heading
            lineHeight={1.1}
            fontWeight={600}
            fontSize={{ base: "2xl", sm: "4xl", lg: "5xl" }}
            mt={{ base: 6, md: 16 }}
          >
            {blogData?.title}
          </Heading>
          <HStack justifyContent={"space-between"}>
            <HStack spacing={"2"}>
              <Box display={"flex"} alignItems={"center"}>
                {/* author */}
                <Link to={`/users/${blogData?.author.pk}`}>
                  <Avatar
                    name={blogData?.author.name}
                    size={"sm"}
                    src={blogData?.author.avatar}
                    my={3}
                  />
                </Link>
                {/* 생성일 */}
                <Text color={"gray.500"} ml={"2"}>
                  생성일:{" "}
                  {blogData?.created_at
                    ? new Date(blogData.created_at).toLocaleDateString(
                        undefined,
                        {
                          year: "numeric",
                          month: "long",
                          day: "numeric"
                        }
                      )
                    : "Date not available"}
                </Text>
              </Box>
            </HStack>
            {/* 수정, 삭제 */}
            <HStack>
              <Link to={`/blog/${blogId}/edit`}>
                <Text color={"gray.500"}>Edit </Text>
              </Link>
            </HStack>
          </HStack>
          {/* 블로그 카테고리 */}
          <HStack spacing={"1"} mt={10}>
            <Badge
              variant={"outline"}
              fontWeight={"bold"}
              colorScheme={"gray"}
              alignSelf="flex-end"
              w="1/3"
              mb={"3"}
            >
              {blogData?.category}
            </Badge>
            <Badge
              variant={"outline"}
              fontWeight={"bold"}
              colorScheme={"gray"}
              alignSelf="flex-end"
              w="1/3"
              mb={"3"}
            >
              COACH
            </Badge>
          </HStack>

          {/* description */}
          <Text fontSize={"lg"} textAlign={"left"}>
            {blogData?.description}
          </Text>
        </Box>
      </Box>

      {/* POST 포토 */}
      {blogData?.photos &&
        blogData?.photos.map((photo: any, index) => (
          <VStack mb={10} key={index}>
            <Image
              rounded={"md"}
              alt={"product image"}
              src={photo.file}
              fit={"cover"}
              align={"center"}
              w={"100%"}
              h={{ base: "100%", sm: "400px", lg: "500px" }}
              cursor={"pointer"}
              onClick={() => openPhotoModal({ photo }.photo.file)}
            />
            <Box width="100%">
              <Text textAlign="left" fontSize="large">
                {photo.description}
              </Text>
            </Box>
          </VStack>
        ))}

      {/* POST 비디오 */}
      <Skeleton isLoaded={!isBlogLoading} h={"100%"} w={"100%"}>
        {blogData?.videos && blogData.videos.length > 0
          ? blogData?.videos.map((video, index) => (
              <VStack mb={10} key={index}>
                <Box
                  position="relative"
                  w={"100%"}
                  h={"400px"}
                  onClick={() => openVideoModal(video.VideoFile)}
                  _hover={{
                    filter: "brightness(90%)"
                  }}
                >
                  {video.ThumbnailFile ? (
                    <Image // Thumbnailfile이 이미지 파일이면 Image로 보여주기
                      src={video.ThumbnailFile}
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
                    <Box
                      as="iframe" // Thumbnailfile이 비디오 파일이면 iframe으로 보여주기
                      src={video.VideoFile + "?controls=false"}
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
                  />
                </Box>
                <Box width={"100%"}>
                  <Text textAlign={"left"} fontSize={"large"}>
                    {video.description}
                  </Text>
                </Box>
              </VStack>
            ))
          : null}
      </Skeleton>

      <Stack mt={10} spacing={{ base: 6, md: 10 }}>
        <Stack
          spacing={{ base: 4, sm: 6 }}
          direction={"column"}
          divider={
            <StackDivider
              borderColor={useColorModeValue("gray.200", "gray.600")}
            />
          }
        >
          {/* Root Cause */}
          <Box>
            <HStack justifyContent={"space-between"}>
              <Text
                fontSize={{ base: "16px", lg: "18px" }}
                color={"Highlight"}
                fontWeight={"500"}
                textTransform={"uppercase"}
                mb={"4"}
              >
                Root Cause
              </Text>
              {/* + 버튼 */}
              <IconButton
                aria-label="Add new article"
                icon={<FaPlus />}
                onClick={() => {
                  navigate(`/blog/${blogId}/add-article`);
                }}
              />
            </HStack>
            {/* 사진/영상 */}
            {/* Article Photos */}
            {blogData?.articles && blogData.articles.length > 0 ? (
              blogData.articles
                .filter((article) => article.category === "root_cause")
                .map((article, index) => (
                  <VStack>
                    <Box width={"100%"}>
                      <Text mt={2} fontSize={"lg"} textAlign={"left"}>
                        {article.content}
                      </Text>
                    </Box>
                    {article.photos && article.photos.length > 0
                      ? article.photos.map((photo, index) => (
                          <Box w={"100%"}>
                            <Image
                              mt={5}
                              rounded={"md"}
                              alt={"product image"}
                              src={photo.file}
                              fit={"cover"}
                              align={"center"}
                              w={"100%"}
                              h={{ base: "100%", sm: "400px", lg: "500px" }}
                              cursor={"pointer"}
                              onClick={() => openPhotoModal(photo.file)}
                            />
                            <Box>
                              <Text mt={2} textAlign="left" fontSize="large">
                                {photo.description}
                              </Text>
                            </Box>
                          </Box>
                        ))
                      : null}
                    {/* Article Videos */}
                    {article.videos && article.videos.length > 0
                      ? article.videos.map((video, index) => (
                          <Box w={"100%"}>
                            <Box
                              mt={5}
                              position="relative"
                              w={"100%"}
                              h={"400px"}
                              onClick={() => openVideoModal(video.VideoFile)}
                              _hover={{
                                filter: "brightness(90%)"
                              }}
                            >
                              {video.ThumbnailFile ? (
                                <Image
                                  src={video.ThumbnailFile}
                                  position="absolute"
                                  top="0"
                                  left="0"
                                  height="100%"
                                  width="100%"
                                  rounded={"md"}
                                  objectFit={"cover"}
                                  overflow={"hidden"}
                                />
                              ) : (
                                <Box
                                  as="iframe"
                                  src={video.VideoFile + "?controls=false"}
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
                              />
                            </Box>
                            <Box>
                              <Text mt={2} textAlign="left" fontSize="large">
                                {video.description}
                              </Text>
                            </Box>
                          </Box>
                        ))
                      : null}
                  </VStack>
                ))
            ) : (
              <Text>There is no article</Text>
            )}
          </Box>

          {/* Corrective Action */}
          <Box>
            <Text
              fontSize={{ base: "16px", lg: "18px" }}
              color={useColorModeValue("yellow.500", "yellow.300")}
              fontWeight={"500"}
              textTransform={"uppercase"}
              mb={"4"}
            >
              Corrective Action
            </Text>
            {/* 사진/영상 */}
            {/* Article Photos */}
            {blogData?.articles && blogData.articles.length > 0 ? (
              blogData.articles
                .filter((article) => article.category === "corrective_action")
                .map((article, index) => (
                  <VStack>
                    <Box width={"100%"}>
                      <Text mt={2} fontSize={"lg"} textAlign={"left"}>
                        {article.content}
                      </Text>
                    </Box>
                    {article.photos && article.photos.length > 0
                      ? article.photos.map((photo, index) => (
                          <Box w={"100%"}>
                            <Image
                              mt={5}
                              rounded={"md"}
                              alt={"product image"}
                              src={photo.file}
                              fit={"cover"}
                              align={"center"}
                              w={"100%"}
                              h={{ base: "100%", sm: "400px", lg: "500px" }}
                              cursor={"pointer"}
                              onClick={() => openPhotoModal(photo.file)}
                            />
                            <Box>
                              <Text mt={2} textAlign="left" fontSize="large">
                                {photo.description}
                              </Text>
                            </Box>
                          </Box>
                        ))
                      : null}
                    {/* Article Videos */}
                    {article.videos && article.videos.length > 0
                      ? article.videos.map((video, index) => (
                          <Box w={"100%"}>
                            <Box
                              mt={5}
                              position="relative"
                              w={"100%"}
                              h={"400px"}
                              onClick={() => openVideoModal(video.VideoFile)}
                              _hover={{
                                filter: "brightness(90%)"
                              }}
                            >
                              {video.ThumbnailFile ? (
                                <Image
                                  src={video.ThumbnailFile}
                                  position="absolute"
                                  top="0"
                                  left="0"
                                  height="100%"
                                  width="100%"
                                  rounded={"md"}
                                  objectFit={"cover"}
                                  overflow={"hidden"}
                                />
                              ) : (
                                <Box
                                  as="iframe"
                                  src={video.VideoFile + "?controls=false"}
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
                              />
                            </Box>
                            <Box>
                              <Text mt={2} textAlign="left" fontSize="large">
                                {video.description}
                              </Text>
                            </Box>
                          </Box>
                        ))
                      : null}
                  </VStack>
                ))
            ) : (
              <Text>There is no article</Text>
            )}
          </Box>
        </Stack>
      </Stack>
      {/* 사진 모달창 */}
      <PhotoModal
        isOpen={isTermPhotoModalOpen}
        onClose={closePhotoModal}
        selectedImage={selectedImage}
      />
      {/* 클릭하면 비디오 플레이어 모달창 */}
      <VideoModal
        isOpen={isRoomVideoModalOpen}
        onClose={closeVideoModal}
        selectedVideo={selectedVideo}
      />
    </Container>
  );
}
