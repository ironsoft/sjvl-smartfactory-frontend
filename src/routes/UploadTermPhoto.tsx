import {
  Box,
  Button,
  Center,
  Container,
  FormControl,
  Grid,
  HStack,
  Heading,
  Image,
  Input,
  Text,
  VStack,
  useToast
} from "@chakra-ui/react";
import { useForm } from "react-hook-form";
import { useNavigate, useParams } from "react-router-dom";
import {
  IFilePhotos,
  createTermPhoto,
  deletePhoto,
  getBagTermDetail,
  getTermPhotos,
  getUploadURL,
  uploadImage
} from "../api";
import { useMutation, useQuery } from "@tanstack/react-query";
import { FaTimes } from "react-icons/fa";

interface IForm {
  photo: FileList;
}

interface IUploadURLResponse {
  id: string;
  uploadURL: string;
}

export default function UploadTermPhoto() {
  const { register, handleSubmit, watch, reset } = useForm<IForm>();
  const { termId } = useParams();

  const toast = useToast();
  const navigate = useNavigate();

  const { data: termData } = useQuery({
    queryKey: ["term", termId],
    queryFn: getBagTermDetail
  });

  console.log("termData", termData);

  // 서버 DB에 이미지 저장
  const createTermPhotoMutation = useMutation({
    mutationFn: createTermPhoto,
    onSuccess: () => {
      toast({
        status: "success",
        isClosable: true,
        description: "Feel free to upload more images",
        onCloseComplete: () => {
          reset();
          window.close();
        }
      });
    }
  });

  // cloudflare에 이미지 업로드
  const uploadImageMutation = useMutation({
    mutationFn: uploadImage,
    onSuccess: ({ result }: any) => {
      if (termData && termId) {
        createTermPhotoMutation.mutate({
          description: termData.description || termData.name,
          file: `https://imagedelivery.net/mzmXhxWLR9jzdX8u9g4BBQ/${result.id}/public`,
          termId
        });
      }
    }
  });

  // cloudflare에 이미지 업로드 URL 요청
  const getUploadURLMutation = useMutation({
    mutationFn: getUploadURL,
    onSuccess: (data: IUploadURLResponse) => {
      uploadImageMutation.mutate({
        file: watch("photo"),
        uploadURL: data.uploadURL
      });
    }
  });
  // 이미지 업로드 폼 제출
  const onSubmit = (data: any) => {
    console.log("onSubmit data", data);
    getUploadURLMutation.mutate();
  };

  // 이미지 목록 가져오기
  const {
    data: fileData,
    isLoading: isFileLoading,
    refetch: refetchFile
  } = useQuery<IFilePhotos[]>({
    queryKey: ["term", termId, "photos"],
    queryFn: getTermPhotos
  });

  // 이미지 삭제 API를 호출하는 mutation
  const deletePhotoMutation = useMutation({
    mutationFn: deletePhoto,
    onSuccess: () => {
      toast({
        status: "success",
        isClosable: true,
        description: "Photo deleted"
      });
      refetchFile();
    }
  });

  return (
    <Box
      pb={40}
      mt={10}
      px={{
        base: 10,
        lg: 40
      }}
    >
      <Container>
        <Heading textAlign={"center"}>Upload Term Photo</Heading>
        {/* 이미지 목록 */}
        <Heading textAlign={"center"}>Photos</Heading>
        <Box py={"10"}>
          {fileData && fileData.length > 0 ? ( // 이미지가 있는 경우
            <HStack spacing={"5"} alignItems={"flex-start"}>
              {fileData.map((file) => (
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
        {/* 이미지 업로드 폼 */}
        <VStack
          spacing={"5"}
          mt={"10"}
          as={"form"}
          onSubmit={handleSubmit(onSubmit)}
        >
          <FormControl>
            <Input {...register("photo")} type={"file"} accept="image/*" />
          </FormControl>
          <Button
            w={"full"}
            colorScheme="red"
            type={"submit"}
            isLoading={
              createTermPhotoMutation.isPending ||
              uploadImageMutation.isPending ||
              getUploadURLMutation.isPending
            }
          >
            Upload Term Photo
          </Button>
        </VStack>
      </Container>
    </Box>
  );
}
