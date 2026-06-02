"use client";

import {
  Box,
  Container,
  Stack,
  Text,
  Image,
  Flex,
  VStack,
  Button,
  Heading,
  SimpleGrid,
  StackDivider,
  useColorModeValue,
  List,
  ListItem,
  Badge,
  HStack,
  AlertDialog,
  AlertDialogOverlay,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogBody,
  AlertDialogFooter,
  useToast
} from "@chakra-ui/react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ITerm } from "../types";
import { useMutation, useQuery } from "@tanstack/react-query";
import { deleteBagTerm, getBagTermDetail } from "../api";
import { useRef, useState } from "react";
import { t } from "i18next";
import PhotoModal from "../components/PhotoModal";

export default function BagTermDetail() {
  // term 삭제 경고창
  const [isAlertOpen, setIsAlertOpen] = useState(false);
  const onCloseAlert = () => setIsAlertOpen(false);
  const cancelRef = useRef<HTMLButtonElement>(null);

  // termId 가져오기
  const { termId } = useParams();
  const { data: termData, isLoading: isTermLoading } = useQuery<ITerm>({
    queryKey: [`bagterms`, termId],
    queryFn: getBagTermDetail
  });
  console.log("termData photos", termData?.photos[0]?.file);

  const toast = useToast();
  const naviagte = useNavigate();

  // term 삭제 mutation
  const deleteTerm = useMutation({
    mutationFn: () => {
      if (typeof termId === "string") {
        return deleteBagTerm(termId);
      }
      throw new Error("termId is not a string");
    },
    onSuccess: () => {
      toast({
        title: t("termDeleted"),
        status: "success",
        duration: 5000,
        isClosable: true
      });
      naviagte("/terms");
    }
  });
  // term 삭제 버튼 클릭시
  const handleDelete = () => {
    onCloseAlert();
    deleteTerm.mutate();
  };

  // term 사진 모달창 상태 관리
  const [isTermPhotoModalOpen, setIsTermPhotoModalOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | undefined>("");

  // term 사진 onClick시 모달창 열기 닫기 작동 함수
  const openPhotoModal = (image: string) => {
    setIsTermPhotoModalOpen(true);
    setSelectedImage(image);
  };
  const closePhotoModal = () => {
    setIsTermPhotoModalOpen(false);
    setSelectedImage(undefined);
  };

  return (
    <Container maxW={"7xl"}>
      <SimpleGrid
        columns={{ base: 1, lg: 2 }}
        spacing={{ base: 8, md: 10 }}
        py={{ base: 18, md: 24 }}
      >
        {/* 사진/영상 */}
        <Flex>
          <Image
            rounded={"md"}
            alt={"product image"}
            src={
              termData?.photos[0]?.file
                ? termData?.photos[0]?.file
                : "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQQ4kemniC91dT47PB1qlCDY8UvnrCzOLpngAhmpz6w1OcPL5Ae6SZ3_IzzGP4L1emVyMs&usqp=CAU"
            }
            fit={"cover"}
            align={"center"}
            w={"100%"}
            h={{ base: "100%", sm: "400px", lg: "500px" }}
            cursor={"pointer"}
            onClick={() => openPhotoModal(termData?.photos[0]?.file || "")}
          />
        </Flex>
        {/* 사진 모달창 */}
        <PhotoModal
          isOpen={isTermPhotoModalOpen}
          onClose={closePhotoModal}
          selectedImage={selectedImage}
        />

        <Stack spacing={{ base: 6, md: 10 }}>
          {/* 상단 제목, 카테고리, 설명 */}
          <Box as={"header"}>
            <HStack spacing={"2"}>
              <Badge
                variant={"outline"}
                fontWeight={"bold"}
                colorScheme={"gray"}
                alignSelf="flex-end"
                w="1/3"
                mb={"3"}
              >
                {termData?.category}
              </Badge>
              <Badge
                variant={"outline"}
                fontWeight={"bold"}
                colorScheme={"gray"}
                alignSelf="flex-end"
                w="1/3"
                mb={"3"}
              >
                {termData?.material}
              </Badge>
            </HStack>
            <Heading
              lineHeight={1.1}
              fontWeight={600}
              fontSize={{ base: "2xl", sm: "4xl", lg: "5xl" }}
            >
              {termData?.name}
            </Heading>
          </Box>
          <Stack
            spacing={{ base: 4, sm: 6 }}
            direction={"column"}
            divider={
              <StackDivider
                borderColor={useColorModeValue("gray.200", "gray.600")}
              />
            }
          >
            <Text fontSize={"lg"} textAlign={"left"}>
              {termData?.description}
            </Text>
            {/* 동의어 */}
            <Box>
              <Text
                fontSize={{ base: "16px", lg: "18px" }}
                color={useColorModeValue("yellow.500", "yellow.300")}
                fontWeight={"500"}
                textTransform={"uppercase"}
                mb={"4"}
              >
                동의어
              </Text>
              <SimpleGrid columns={{ base: 1, md: 2 }} spacing={10}>
                <List spacing={2}>
                  <ListItem>
                    <Link to={`/terms/${termData?.synonym_1?.id}`}>
                      {termData?.synonym_1?.name}
                    </Link>
                  </ListItem>
                  <ListItem>
                    <Link to={`/terms/${termData?.synonym_3?.id}`}>
                      {termData?.synonym_3?.name}
                    </Link>
                  </ListItem>
                  <ListItem>
                    <Link to={`/terms/${termData?.synonym_5?.id}`}>
                      {termData?.synonym_5?.name}
                    </Link>
                  </ListItem>
                  <ListItem>
                    <Link to={`/terms/${termData?.synonym_7?.id}`}>
                      {termData?.synonym_7?.name}
                    </Link>
                  </ListItem>
                  <ListItem>
                    <Link to={`/terms/${termData?.synonym_9?.id}`}>
                      {termData?.synonym_9?.name}
                    </Link>
                  </ListItem>
                </List>
                <List spacing={2}>
                  <ListItem>
                    <Link to={`/terms/${termData?.synonym_2?.id}`}>
                      {termData?.synonym_2?.name}
                    </Link>
                  </ListItem>
                  lorem
                  <ListItem>
                    <Link to={`/terms/${termData?.synonym_4?.id}`}>
                      {termData?.synonym_4?.name}
                    </Link>
                  </ListItem>
                  <ListItem>
                    <Link to={`/terms/${termData?.synonym_6?.id}`}>
                      {termData?.synonym_6?.name}
                    </Link>
                  </ListItem>
                  <ListItem>
                    <Link to={`/terms/${termData?.synonym_8?.id}`}>
                      {termData?.synonym_8?.name}
                    </Link>
                  </ListItem>
                  <ListItem>
                    <Link to={`/terms/${termData?.synonym_10?.id}`}>
                      {termData?.synonym_10?.name}
                    </Link>
                  </ListItem>
                </List>
              </SimpleGrid>
            </Box>
            {/* 외국어 */}
            <Box>
              <Text
                fontSize={{ base: "16px", lg: "18px" }}
                color={useColorModeValue("yellow.500", "yellow.300")}
                fontWeight={"500"}
                textTransform={"uppercase"}
                mb={"4"}
              >
                외국어
              </Text>
              <List spacing={2}>
                {termData?.english_term?.id !== termData?.id && (
                  <ListItem>
                    <Badge
                      variant={"outline"}
                      fontWeight={"bold"}
                      colorScheme={"gray"}
                      alignSelf="flex-end"
                      w="1/3"
                      mr={"3"}
                    >
                      EN
                    </Badge>
                    <Link to={`/terms/${termData?.english_term?.id}`}>
                      {termData?.english_term?.name}
                    </Link>
                  </ListItem>
                )}
                {termData?.korean_term?.id !== termData?.id && (
                  <ListItem>
                    <Badge
                      variant={"outline"}
                      fontWeight={"bold"}
                      colorScheme={"gray"}
                      alignSelf="flex-end"
                      w="1/3"
                      mr={"3"}
                    >
                      KO
                    </Badge>
                    <Link to={`/terms/${termData?.korean_term?.id}`}>
                      {termData?.korean_term?.name}
                    </Link>
                  </ListItem>
                )}
                {termData?.chinese_term?.id !== termData?.id && (
                  <ListItem>
                    <Badge
                      variant={"outline"}
                      fontWeight={"bold"}
                      colorScheme={"gray"}
                      alignSelf="flex-end"
                      w="1/3"
                      mr={"3"}
                    >
                      CN
                    </Badge>
                    <Link to={`/terms/${termData?.chinese_term?.id}`}>
                      {termData?.chinese_term?.name}
                    </Link>
                  </ListItem>
                )}
                {termData?.vietnamese_term?.id !== termData?.id && (
                  <ListItem>
                    <Badge
                      variant={"outline"}
                      fontWeight={"bold"}
                      colorScheme={"gray"}
                      alignSelf="flex-end"
                      w="1/3"
                      mr={"3"}
                    >
                      VN
                    </Badge>
                    <Link to={`/terms/${termData?.vietnamese_term?.id}`}>
                      {termData?.vietnamese_term?.name}
                    </Link>
                  </ListItem>
                )}
                {termData?.indonesian_term?.id !== termData?.id && (
                  <ListItem>
                    <Badge
                      variant={"outline"}
                      fontWeight={"bold"}
                      colorScheme={"gray"}
                      alignSelf="flex-end"
                      w="1/3"
                      mr={"3"}
                    >
                      IN
                    </Badge>
                    <Link to={`/terms/${termData?.indonesian_term?.id}`}>
                      {termData?.indonesian_term?.name}
                    </Link>
                  </ListItem>
                )}
                {/* Add more languages as needed */}
              </List>
            </Box>
          </Stack>
        </Stack>
      </SimpleGrid>
      <HStack spacing={4} justifyContent="center" alignItems="center">
        {/* 삭제 버튼 */}
        <Button
          onClick={() => setIsAlertOpen(true)}
          size={"lg"}
          colorScheme={"red"}
          bg={"red.400"}
          _hover={{ bg: "red.500" }}
        >
          Delete
        </Button>
        <AlertDialog
          isOpen={isAlertOpen}
          leastDestructiveRef={cancelRef}
          onClose={onCloseAlert}
        >
          <AlertDialogOverlay>
            <AlertDialogContent>
              <AlertDialogHeader fontSize="lg" fontWeight="bold">
                Delete Term
              </AlertDialogHeader>
              <AlertDialogBody>
                Are you sure? You can't undo this action afterwards.
              </AlertDialogBody>
              <AlertDialogFooter>
                <HStack spacing={4} justifyContent="center" alignItems="center">
                  <Button ref={cancelRef} onClick={onCloseAlert}>
                    Cancel
                  </Button>
                  <Button colorScheme="red" onClick={handleDelete} ml={3}>
                    Delete
                  </Button>
                </HStack>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialogOverlay>
        </AlertDialog>
        {/* 수정 버튼 */}
        <Button
          as={Link}
          to={`/terms/${termData?.id}/edit`}
          size={"lg"}
          colorScheme={"yellow"}
          bg={"yellow.400"}
          _hover={{ bg: "yellow.500" }}
        >
          Edit
        </Button>
      </HStack>
    </Container>
  );
}
