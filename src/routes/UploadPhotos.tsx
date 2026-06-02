import {
  Box,
  Button,
  Center,
  Container,
  FormControl,
  Grid,
  Heading,
  HStack,
  Image,
  Input,
  Text,
  useToast,
  VStack
} from "@chakra-ui/react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ChangeEvent, useState } from "react";
import { useForm } from "react-hook-form";
import { useParams } from "react-router-dom";
import {
  createPhoto,
  deletePhoto,
  getRoomPhotos,
  getUploadURL,
  IFilePhotos,
  uploadImage
} from "../api";
import ProtectedPage from "../components/ProtectPage";
import { FaTimes } from "react-icons/fa";

interface IForm {
  file: FileList;
}

interface IUploadURLResponse {
  id: string;
  uploadURL: string;
}

export default function UploadPhotos() {
  // 사진 업로드 폼
  const { register, handleSubmit, watch, reset } = useForm<IForm>();
  // 방 pk
  const { roomPk } = useParams();
  // 토스트
  const toast = useToast();
  // 실제 장고 DB에 사진 저장
  const createPhotoMutation = useMutation({
    mutationFn: createPhoto,
    onSuccess: () => {
      toast({
        status: "success",
        isClosable: true,
        description: "Feel free to upload more images"
      });
      reset();
    }
  });

  // 클라우드플레어에 사진 업로드
  const uploadImageMutation = useMutation({
    mutationFn: uploadImage,
    onSuccess: ({ result }: any) => {
      if (roomPk) {
        createPhotoMutation.mutate({
          description: "I love react",
          file: `https://imagedelivery.net/mzmXhxWLR9jzdX8u9g4BBQ/${result.id}/public`,
          roomPk
        });
      }
    }
  });

  // 클라우드플레어로 부터 업로드 URL 가져오기
  const uploadURLMutation = useMutation({
    mutationFn: getUploadURL,
    onSuccess: (data: IUploadURLResponse) => {
      uploadImageMutation.mutate({
        uploadURL: data.uploadURL,
        file: watch("file")
      });
    }
  });

  // 사진 업로드 폼 제출
  const onSubmit = (data: any) => {
    uploadURLMutation.mutate();
  };

  // 방 사진 가져오기
  const {
    data: filesData,
    isLoading: isFileLoading,
    refetch
  } = useQuery<IFilePhotos[]>({
    queryKey: ["room", roomPk, "photos"],
    queryFn: getRoomPhotos
  });

  // 이미지 삭제 API를 호출하는 mutation
  const deletePhotoMutation = useMutation({
    mutationFn: deletePhoto,
    onSuccess: () => {
      toast({
        status: "success",
        isClosable: true,
        description: "Image deleted successfully"
      });
      refetch();
    }
  });

  return (
    <ProtectedPage>
      <Box
        pb={40}
        mt={10}
        px={{
          base: 10,
          lg: 40
        }}
      >
        {/* 이미지 목록 */}
        <Heading textAlign={"center"}>Photos</Heading>
        <Box py={"10"}>
          {filesData && filesData.length > 0 ? ( // 이미지가 있는 경우
            <HStack spacing={"5"} alignItems={"flex-start"}>
              {filesData.map((file) => (
                <Box key={file.pk} position="relative">
                  <Image
                    src={file.file}
                    alt={file?.name}
                    w={"200px"}
                    h={"200px"}
                    objectFit={"cover"}
                    rounded={"xl"}
                  />
                  <Button
                    position="absolute"
                    size={"xs"}
                    borderRadius="full"
                    width="30px"
                    height="30px"
                    padding="0"
                    backgroundColor="black"
                    color="white"
                    _hover={{ bg: "gray.700" }}
                    right="-2"
                    top="-3"
                    onClick={() => {
                      deletePhotoMutation.mutate(file.pk);
                    }}
                  >
                    <FaTimes />
                  </Button>
                </Box>
              ))}
            </HStack>
          ) : (
            // 이미지가 없는 경우
            <Center height="200px">
              <Text fontSize="2xl">No photos</Text>
            </Center>
          )}
        </Box>
        <Container>
          <Heading textAlign={"center"}>Upload a Photo</Heading>
          <VStack
            as={"form"}
            onSubmit={handleSubmit(onSubmit)}
            spacing={5}
            mt={10}
          >
            <FormControl>
              <Input {...register("file")} type={"file"} accept="image/*" />
            </FormControl>
            <Button
              isLoading={
                createPhotoMutation.isPending ||
                uploadImageMutation.isPending ||
                uploadURLMutation.isPending
              }
              type={"submit"}
              w={"full"}
              colorScheme={"red"}
            >
              Upload photos
            </Button>
          </VStack>
        </Container>
      </Box>
    </ProtectedPage>
  );
}
