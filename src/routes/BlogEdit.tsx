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
  FormControl,
  FormHelperText,
  FormLabel,
  Grid,
  HStack,
  Heading,
  Icon,
  Image,
  Input,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Select,
  Text,
  Textarea,
  VStack,
  useDisclosure,
  useToast
} from "@chakra-ui/react";
import HostOnlyPage from "../components/HostOnlyPage";
import ProtectedPage from "../components/ProtectPage";
import { set, useForm } from "react-hook-form";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  IFilePhotos,
  IFileVideos,
  deleteBlog,
  deletePhoto,
  deleteVideo,
  editBlog,
  getBlogDetail,
  getPostPhotos,
  getPostVideo,
  uploadBlog
} from "../api";
import { IBlogForm } from "../types";
import { useNavigate, useParams } from "react-router-dom";
import { FaAngleRight, FaCamera, FaVideo } from "react-icons/fa";
import { useEffect, useRef, useState } from "react";
import UploadPostPhoto from "../components/UploadPostPhoto";
import UploadPostVideos from "../components/UploadPostVideos";

export default function BlogEdit() {
  // blog 삭제 경고창
  const [isAlertOpen, setIsAlertOpen] = useState(false);
  const onCloseAlert = () => setIsAlertOpen(false);
  const cancelRef = useRef<HTMLButtonElement>(null);

  // params로 blogId를 받아온다.
  const { blogId } = useParams();
  console.log("blogId", blogId);

  // Blog 데이터를 가져와서 form에 뿌려준다.
  const { data: blog, isLoading } = useQuery<IBlogForm>({
    queryKey: ["blog", blogId],
    queryFn: getBlogDetail
  });
  console.log("blog", blog);

  // useForm을 이용해서 Form Handling 하기.
  // useForm은 form의 state를 관리해주는 hook이다.
  const {
    register, // input ref를 등록해주는 함수
    handleSubmit, // form submit 이벤트를 처리해주는 함수
    setValue, // form의 value를 설정해주는 함수
    formState: { errors } // form의 에러를 처리해주는 함수
  } = useForm<IBlogForm>({
    mode: "onSubmit" // onSubmit 이벤트가 발생했을 때 validation 체크
  });

  const toast = useToast();
  const navigate = useNavigate();
  // blog 수정 mutation
  const mutation = useMutation({
    mutationFn: editBlog,
    onSuccess: (data) => {
      console.log(data);
      toast({
        title: "Blog edited successfully",
        status: "success",
        duration: 5000,
        isClosable: true
      });
      navigate(`/blog/${data.id}`);
    },
    onError: (error) => {
      console.log(error);
      toast({
        title: "Something went wrong",
        status: "error",
        duration: 5000,
        isClosable: true
      });
    }
  });

  useEffect(() => {
    if (blog) {
      setValue("title", blog.title);
      setValue("description", blog.description);
      setValue("category", blog.category);
    }
  }, [blog, setValue]);

  //  blog 삭제 mutation
  const deleteMutation = useMutation({
    mutationFn: () => {
      if (typeof blogId === "string") {
        return deleteBlog(blogId);
      }
      throw new Error("Blog ID is not a string");
    },
    onSuccess: (data) => {
      toast({
        title: "Blog deleted successfully",
        status: "success",
        duration: 5000,
        isClosable: true
      });
      navigate(`/blog`);
    }
  });

  const handleDelete = () => {
    onCloseAlert();
    deleteMutation.mutate();
  };

  const onSubmit = (data: any) => {
    data.id = blogId;
    console.log("data", data);

    mutation.mutate(data);
  };

  // 사진 업로드 클릭시, 사진 업로드 창을 띄움 (모댤창으로 변경하여 더이상 사용하지 않음)
  const onCameraClick = () => {
    window.open(`/blog/${blogId}/photos`, "_blank", "height=600,width=800");
  };

  // 이미지 정보를 가져오는 API 호출
  const {
    data: fetchedPostPhotos,
    isLoading: isFilesLoading,
    refetch: refetchPhotos
  } = useQuery<IFilePhotos[]>({
    queryKey: [`blogs`, `${blogId}`, `photos`],
    queryFn: getPostPhotos
  });
  console.log("fetchedPostPhotos", fetchedPostPhotos);

  // 비디오 정보를 가져오는 API 호출
  const {
    data: fetchedPostVideos,
    isLoading: isVideosLoading,
    refetch: refetchVideos
  } = useQuery<IFileVideos[]>({
    queryKey: [`blogs`, `${blogId}`, `videos`],
    queryFn: getPostVideo
  });
  console.log("fetchedPostVideos", fetchedPostVideos);

  // 이미지 삭제 API를 호출하는 mutation
  const deletePhotoMutation = useMutation({
    mutationFn: deletePhoto,
    onSuccess: () => {
      toast({
        status: "success",
        isClosable: true,
        description: "사진이 삭제되었습니다."
      });
      refetchPhotos(); // 이미지 삭제 후 목록을 다시 불러옵니다.
    }
  });

  // 비디오 삭제 API를 호출하는 mutation
  const deleteVideoMutation = useMutation({
    mutationFn: deleteVideo,
    onSuccess: () => {
      toast({
        status: "success",
        isClosable: true,
        description: "비디오가 삭제되었습니다."
      });
      refetchVideos(); // 비디오 삭제 후 목록을 다시 불러옵니다.
    }
  });

  // 사진 업로드 창을 띄우는 hook
  const {
    isOpen: isPhotoOpen,
    onOpen: onPhotoOpen,
    onClose: onPhotoClose
  } = useDisclosure();

  // 비디오 업로드 창을 띄우는 hook
  const {
    isOpen: isVideoOpen,
    onOpen: onVideoOpen,
    onClose: onVideoClose
  } = useDisclosure();

  // 사진 업로드 성공시, 목록을 다시 고쳐서 새롭게 업로드된 사진을 보여줌
  const onUploadSuccess = () => {
    refetchPhotos(); // 목록을 새로고침
  };

  // 비디오 업로드 성공시, 목록을 다시 고쳐서 새롭게 업로드된 비디오를 보여줌
  const onUploadVideoSuccess = () => {
    refetchVideos(); // 목록을 새로고침
  };

  return (
    <ProtectedPage>
      <HostOnlyPage>
        <Box
          pb={40}
          mt={10}
          px={{
            base: 10,
            md: 80,
            lg: "30%"
          }}
        >
          <Heading>Upload Blog</Heading>
          <VStack
            mt={10}
            spacing={4}
            onSubmit={handleSubmit(onSubmit)}
            as={"form"}
          >
            {/* <BlogForm /> */}
            <FormControl>
              <FormLabel>Title</FormLabel>
              <Input
                {...register("title")}
                type={"text"}
                required
                defaultValue={blog?.title}
              />
              <FormHelperText>Blog title</FormHelperText>
            </FormControl>
            <FormControl>
              <FormLabel>Description</FormLabel>
              <Textarea
                {...register("description")}
                height={"200px"}
                required
                defaultValue={blog?.description}
              />

              <FormHelperText>Blog description</FormHelperText>
            </FormControl>
            <FormControl>
              <FormLabel>Category</FormLabel>
              <Select
                {...register("category")}
                required
                defaultValue={blog?.category}
              >
                <option value="kaizen">Kaizen Activity</option>
                <option value="ecrs">ECRS</option>
                <option value="tapestry_manual">Tapestry Manual</option>
                <option value="mk_manual">MK Manual</option>
                <option value="general_knowledge">Bag Knowledge</option>
                <option value="other">Other</option>
              </Select>
            </FormControl>
            {mutation.isError ? (
              <Text color={"red.500"}>Something went wrong</Text>
            ) : null}

            <HStack spacing={10} mt={5}>
              {/* 사진 업로드 버튼 */}
              <Button
                variant={"unstyled"}
                top={"0"}
                right={"0"}
                onClick={onPhotoOpen}
              >
                <HStack>
                  <FaCamera size={"20px"} />
                  <Text>Upload Photos</Text>
                  <FaAngleRight size={"20px"} />
                </HStack>
              </Button>

              {/* 비디오 업로드 버튼 */}
              <Button
                variant={"unstyled"}
                top={"0"}
                right={"0"}
                onClick={onVideoOpen}
              >
                <HStack>
                  <FaVideo size={"20px"} />
                  <Text>Upload Videos</Text>
                  <FaAngleRight size={"20px"} />
                </HStack>
              </Button>
            </HStack>
            {/* 사진 업로드 모달 */}
            <Modal isOpen={isPhotoOpen} onClose={onPhotoClose}>
              <ModalOverlay />
              <ModalContent
                sx={{
                  maxWidth: "90vw", // 뷰포트의 90% 너비
                  width: "auto", // 자동 너비 조정
                  minHeight: "60vh", // 뷰포트의 60% 높이
                  maxHeight: "90vh" // 최대 높이 설정
                }}
              >
                <ModalHeader>Upload Post Photo</ModalHeader>
                <ModalCloseButton />
                <ModalBody>
                  <UploadPostPhoto
                    onClose={onPhotoClose}
                    onUploadSuccess={onUploadSuccess}
                  />
                </ModalBody>
                {/* <ModalFooter>
                  <Button colorScheme="blue" mr={3} onClick={onPhotoClose}>
                    Close
                  </Button>
                </ModalFooter> */}
              </ModalContent>
            </Modal>

            {/* 비디오 업로드 모달 */}
            <Modal isOpen={isVideoOpen} onClose={onVideoClose}>
              <ModalOverlay />
              <ModalContent
                sx={{
                  maxWidth: "90vw", // 뷰포트의 90% 너비
                  width: "auto", // 자동 너비 조정
                  minHeight: "60vh", // 뷰포트의 60% 높이
                  maxHeight: "90vh" // 최대 높이 설정
                }}
              >
                <ModalHeader>Upload Post Video</ModalHeader>
                <ModalCloseButton />
                <ModalBody>
                  <UploadPostVideos
                    onClose={onVideoClose}
                    onUploadSuccess={onUploadVideoSuccess}
                  />
                </ModalBody>
                {/* <ModalFooter>
                  <Button colorScheme="blue" mr={3} onClick={onVideoClose}>
                    Close
                  </Button>
                </ModalFooter> */}
              </ModalContent>
            </Modal>

            {/* 이미지 목록 */}
            <Box py={"10"}>
              {fetchedPostPhotos && fetchedPostPhotos.length > 0 ? ( // 이미지가 있는 경우
                <Grid templateColumns="repeat(5, 1fr)" gap={4}>
                  {fetchedPostPhotos.map((file) => (
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
                        borderRadius="full" // 완전히 둥근 모서리
                        width="40px" // 너비
                        height="40px" // 높이
                        padding="0" // 패딩 제거
                        backgroundColor="black" // 버튼 배경 색상을 블랙으로 설정
                        color="white" // 텍스트 색상을 화이트로 설정
                        _hover={{ bg: "gray.700" }} // 호버 시 배경 색상 변경
                        right="-3"
                        top="-3"
                        onClick={() => {
                          deletePhotoMutation.mutate(file.pk);
                        }}
                      >
                        X
                      </Button>
                    </Box>
                  ))}
                </Grid>
              ) : (
                // 이미지가 없는 경우
                <Center height="200px">
                  <Text fontSize="2xl">No photos</Text>
                </Center>
              )}
            </Box>

            {/* 비디오 목록 */}
            <Box py={"10"}>
              {fetchedPostVideos && fetchedPostVideos.length > 0 ? (
                <Grid templateColumns="repeat(5, 1fr)" gap={4}>
                  {fetchedPostVideos.map((file) => (
                    <Box key={file.pk} position="relative">
                      <video
                        controls
                        src={file.VideoFile}
                        style={{
                          borderRadius: "10px",
                          width: "200px",
                          height: "200px"
                        }}
                      />
                      <Button
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
                        onClick={() => {
                          deleteVideoMutation.mutate(file.pk);
                        }}
                      >
                        X
                      </Button>
                    </Box>
                  ))}
                </Grid>
              ) : (
                <Center height="200px">
                  <Text fontSize="2xl">No videos</Text>
                </Center>
              )}
            </Box>

            {/* Edit 버튼 */}
            <Button
              type={"submit"}
              isLoading={mutation.isPending}
              colorScheme={"blue"}
              size="lg"
              w={"100%"}
            >
              Edit Blog
            </Button>
            {/* Delete 버튼 */}
            <Button
              onClick={() => setIsAlertOpen(true)}
              colorScheme={"red"}
              size="lg"
              w={"100%"}
              bg={"red.500"}
              _hover={{ bg: "red.600" }}
            >
              Delete Blog
            </Button>
            {/* 삭제 경고창 */}
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
                    <HStack
                      spacing={4}
                      justifyContent="center"
                      alignItems="center"
                    >
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
          </VStack>
        </Box>
      </HostOnlyPage>
    </ProtectedPage>
  );
}
