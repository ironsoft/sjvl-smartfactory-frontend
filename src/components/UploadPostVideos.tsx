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
import HostOnlyPage from "./HostOnlyPage";
import ProtectedPage from "./ProtectPage";
import { useForm } from "react-hook-form";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import {
  createPostVideo,
  createVideo,
  getUploadVideoURL,
  getVideoData,
  uploadVideo
} from "../api";
import { ChangeEvent, useEffect, useState } from "react";

interface IForm {
  file: FileList;
  description: string;
}

interface IUploadVideoURLResponse {
  id: string;
  uploadURL: string;
}
interface UploadPostVideoProps {
  onClose: () => void;
  onUploadSuccess: () => void;
}
const UploadPostVideos: React.FC<UploadPostVideoProps> = ({
  onClose,
  onUploadSuccess
}) => {
  const { blogId } = useParams();
  const { register, handleSubmit, watch, reset } = useForm<IForm>();

  const navigate = useNavigate();

  // 업로드한 비디오 UID 저장
  const [videoUid, setVideoUid] = useState<string>("");

  const toast = useToast();

  // 비디오를 서버 DB에 저장하기 위한 Mutation
  const createVideoMutation = useMutation({
    mutationFn: createPostVideo,
    onSuccess: () => {
      toast({
        status: "success",
        isClosable: true,
        description: "비디오가 성공적으로 업로드 되었습니다."
      });
      // 모달창 닫기
      onClose();
      // 업로드 성공 시 콜백 함수 호출
      onUploadSuccess();
      // blog edit 페이지로 이동
      navigate(`/blog/${blogId}/edit`);
    }
  });

  // 비디오 데이터를 받아옵니다.
  const getVideoDataMutation = useMutation({
    mutationFn: getVideoData,
    onSuccess: (data: any) => {
      console.log("업로드된 비디오 데이터", data);
      const thumbnailURL = data.thumbnail;
      const videoURL = `https://customer-u4d1gjshe6uaaa9n.cloudflarestream.com/${data.uid}/iframe?muted=true&preload=true&loop=true&autoplay=true&poster=https%3A%2F%2Fcustomer-u4d1gjshe6uaaa9n.cloudflarestream.com%2F${data.uid}%2Fthumbnails%2Fthumbnail.jpg%3Ftime%3D%26height%3D600`;
      console.log("비디오 URL", videoURL);
      if (blogId) {
        // Check if blogId is not undefined
        createVideoMutation.mutate({
          blogId: blogId,
          VideoFile: videoURL,
          ThumbnailFile: thumbnailURL,
          description: watch("description")
        });
      }
    }
  });

  // 받아온 URL을 비디오 File과 함께 Cloudflare로 보내면 Cloudflare가 비디오를 저장합니다.
  const uploadVideoMutation = useMutation({
    mutationFn: uploadVideo,
    onSuccess: (data: any) => {
      console.log("cloudflare에 업로드 되었습니다");
      // 업로드한 비디오 데이터를 받아옵니다.
      console.log("비디오 UID", videoUid);
      getVideoDataMutation.mutate(videoUid);
    }
  });

  // Cloudflare로 부터 비디오를 업로드할 수 있는 URL을 받아옵니다.
  const uploadURLmutation = useMutation({
    mutationFn: getUploadVideoURL,
    onSuccess: (data: IUploadVideoURLResponse) => {
      // 받아온 URL을 이용하여 비디오를 클라우드플레어에 업로드합니다.
      uploadVideoMutation.mutate({
        file: watch("file"),
        uploadURL: data.uploadURL
      });
      // 비디오 UID를 videoUid로 저장
      console.log("클라우드플레어에 업로드할 url 받아온 후에 data", data.id);
      setVideoUid(data.id);
      console.log(
        "클라우드플레어에 업로드할 url 받아온 후에 data.id를 videoUid에 저장한 비디오 UID",
        videoUid
      );
    }
  });

  // 비디오 파일 상태관리
  const [selectedVideo, setSelectedVideo] = useState<string | null>(null);
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

  // 비디오 선택 시 미리보기 생성 및 상태 업데이트 (이벤트 타입 명시)
  const handleVideoChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      // 모바일이 아닌 경우에만 미리보기 작동하기
      if (!isMobile) {
        const previewUrl = URL.createObjectURL(file);
        setSelectedVideo(previewUrl);
      }
    }
  };

  // 비디오 삭제 함수
  const removeSelectedVideo = () => {
    setSelectedVideo(null);
    reset(); // 이미지 삭제 시 input 초기화
  };

  const onSubmit = (data: IForm) => {
    uploadURLmutation.mutate();
  };
  // blog edit 폼과 이벤트 버블링을 막기 위한 함수
  // React.FormEvent<HTMLFormElement>는
  const handleFormSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); // 기본 이벤트를 막는다.
    event.stopPropagation(); // 이벤트 버블링을 막는다.
    handleSubmit(onSubmit)(event); // event를 같이 넘겨준다.
  };

  return (
    <ProtectedPage>
      <HostOnlyPage>
        <Box
          pb={40}
          mt={10}
          px={{
            base: 10,
            lg: 40
          }}
        >
          <Container>
            <Heading>Upload a Video</Heading>
            {/* VStack이 아닌 form 요소를 통해서 onSubmit을 해야지 이벤트 버블링을 막을 수 있습니다. */}
            <form onSubmit={handleFormSubmit}>
              <VStack spacing={4} mt={10}>
                {/* 비디오 미리보기 추가 */}
                {selectedVideo && (
                  <Box position={"relative"} display={"inline-block"}>
                    <video
                      controls
                      src={selectedVideo}
                      style={{
                        borderRadius: "10px",
                        width: "200px",
                        height: "200px"
                      }}
                    />
                    <Button
                      onClick={removeSelectedVideo}
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
                    {...register("file")}
                    type="file"
                    accept="video/*"
                    onChange={handleVideoChange}
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
                  isLoading={
                    uploadURLmutation.isPending ||
                    uploadVideoMutation.isPending ||
                    getVideoDataMutation.isPending ||
                    createVideoMutation.isPending
                  }
                  type="submit"
                  w={"full"}
                  colorScheme="teal"
                >
                  Upload
                </Button>
              </VStack>
            </form>
          </Container>
        </Box>
      </HostOnlyPage>
    </ProtectedPage>
  );
};

export default UploadPostVideos;
