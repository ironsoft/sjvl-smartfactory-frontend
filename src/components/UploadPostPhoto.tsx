import {
  Box,
  Button,
  Container,
  FormControl,
  Heading,
  Image,
  Input,
  Textarea,
  VStack,
  useToast
} from "@chakra-ui/react";
import { useForm } from "react-hook-form";
import { useNavigate, useParams } from "react-router-dom";
import {
  IFilePhotos,
  createPostPhoto,
  createTermPhoto,
  getBagTermDetail,
  getBlogDetail,
  getPostPhotos,
  getUploadURL,
  uploadImage
} from "../api";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ChangeEvent, useEffect, useState } from "react";

interface IForm {
  photo: FileList;
  description: string;
}

interface IUploadURLResponse {
  id: string;
  uploadURL: string;
}

interface UploadPostPhotoProps {
  onClose: () => void;
  onUploadSuccess: () => void; // 추가
}

const UploadPostPhoto: React.FC<UploadPostPhotoProps> = ({
  onClose,
  onUploadSuccess
}) => {
  const { register, handleSubmit, watch, reset } = useForm<IForm>();
  const { blogId } = useParams();
  console.log("blogId", blogId);
  const toast = useToast();

  const { data: blogData } = useQuery({
    queryKey: ["blog", blogId],
    queryFn: getBlogDetail
  });

  console.log("blogData", blogData);
  const navigate = useNavigate();

  // 장고 서버에 이미지 업로드
  const createPostPhotoMutation = useMutation({
    mutationFn: createPostPhoto,
    onSuccess: () => {
      toast({
        status: "success",
        isClosable: true,
        description: "Feel free to upload more images"
      });
      // 모달창 닫기
      onClose();
      onUploadSuccess(); // 추가
      // blog edit 페이지 이동해서 업데이트 된 이미지 확인 하려면?
      navigate(`/blog/${blogId}/edit`);
    }
  });

  // cloudflare에 이미지 업로드
  const uploadImageMutation = useMutation({
    mutationFn: uploadImage,
    onSuccess: ({ result }: any) => {
      // 장고 서버에 이미지 업로드 요청
      if (blogData && blogId) {
        createPostPhotoMutation.mutate({
          description: watch("description") || "",
          file: `https://imagedelivery.net/mzmXhxWLR9jzdX8u9g4BBQ/${result.id}/public`,
          blogId
        });
      }
    }
  });

  // cloudflare에 이미지 업로드 URL 요청
  const getUploadURLMutation = useMutation({
    mutationFn: getUploadURL,
    onSuccess: (data: IUploadURLResponse) => {
      // cloudflare에 이미지 업로드 요청
      uploadImageMutation.mutate({
        file: watch("photo"),
        uploadURL: data.uploadURL
      });
      console.log("data_uploadURL", data);
    }
  });

  // 이미지 파일 상태관리
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState<boolean>(false);

  // 모바일 환경 체크
  useEffect(() => {
    const userAgent =
      navigator.userAgent || navigator.vendor || (window as any).opera;
    if (
      /android/i.test(userAgent) ||
      (/iPad|iPhone|iPod/.test(userAgent) && !(window as any).MSStream)
    ) {
      setIsMobile(true);
    }
  }, []);

  // 이미지 선택 시 미리보기 생성 및 상태 업데이트 (이벤트 타입 명시)
  const handleImageChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      // 모바일일 경우 미리보기 작동하지 않음
      if (!isMobile) {
        const previewUrl = URL.createObjectURL(file);
        setSelectedImage(previewUrl);
      }
    }
  };

  // 이미지 삭제 함수
  const removeSelectedImage = () => {
    setSelectedImage(null);
    reset(); // 이미지 삭제 시 input 초기화
  };

  const onSubmit = (data: any) => {
    console.log("onSubmit data", data);
    getUploadURLMutation.mutate();
  };

  // blog edit 폼과 이벤트 버블링을 막기 위한 함수
  // React.FormEvent<HTMLFormElement>는
  const handleFormSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); // 기본 이벤트를 막는다.
    event.stopPropagation(); // 이벤트 버블링을 막는다.
    handleSubmit(onSubmit)(event); // event를 같이 넘겨준다.
  };

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
        <Heading textAlign={"center"}>Upload Post Photo</Heading>
        <form onSubmit={handleFormSubmit}>
          <VStack spacing={"5"} mt={"10"}>
            {/* 이미지 미리보기 추가 */}
            {selectedImage && (
              <Box position={"relative"} display={"inline-block"}>
                <Image
                  rounded={"2xl"}
                  boxSize={"200px"}
                  overflow={"hidden"}
                  src={selectedImage}
                  alt="Preview"
                />
                <Button
                  onClick={removeSelectedImage}
                  position="absolute"
                  borderRadius="full" // 완전히 둥근 모서리
                  width="40px" // 너비
                  height="40px" // 높이
                  padding="0" // 패딩 제거
                  backgroundColor="black" // 버튼 배경 색상을 블랙으로 설정
                  color="white" // 텍스트 색상을 화이트로 설정
                  _hover={{ bg: "gray.700" }} // 호버 시 배경 색상 변경
                  right="-3"
                  top="-3"
                >
                  X
                </Button>
              </Box>
            )}
            <FormControl>
              <Input
                {...register("photo")}
                type={"file"}
                accept="image/*"
                onChange={handleImageChange}
              />
            </FormControl>
            <FormControl>
              <Textarea
                {...register("description")}
                placeholder={"Description"}
                rows={5}
              />
            </FormControl>
            <Button
              w={"full"}
              colorScheme="red"
              type={"submit"}
              isLoading={
                createPostPhotoMutation.isPending ||
                uploadImageMutation.isPending ||
                getUploadURLMutation.isPending
              }
            >
              Upload Post Photo
            </Button>
          </VStack>
        </form>
      </Container>
    </Box>
  );
};

export default UploadPostPhoto;
