import { useMutation, useQuery } from "@tanstack/react-query";
import {
  changePassword,
  editProfile,
  getMe,
  getUploadURL,
  logOut,
  uploadImage
} from "../api";
import ProtectedPage from "../components/ProtectPage";
import {
  Avatar,
  Box,
  Button,
  Container,
  FormControl,
  FormErrorMessage,
  FormHelperText,
  FormLabel,
  Heading,
  Icon,
  IconButton,
  Input,
  InputGroup,
  InputLeftElement,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Skeleton,
  Text,
  VStack,
  useDisclosure,
  useToast
} from "@chakra-ui/react";
import { Helmet } from "react-helmet";
import { Form, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { FaCamera, FaCameraRetro, FaLock, FaUserEdit } from "react-icons/fa";
import { useEffect, useRef } from "react";

export default function EditMyProfile() {
  // useQuery를 사용하여 현재 로그인한 사용자의 정보를 가져옵니다.
  const {
    data: meData,
    isLoading: isMeLoading,
    refetch
  } = useQuery({
    queryKey: [`me`],
    queryFn: getMe
  });

  const { register, handleSubmit, watch, setValue } = useForm();
  const toast = useToast();
  const navigate = useNavigate();
  // 프로필 수정 useMutation을 정의합니다.
  const mutation = useMutation({
    mutationFn: editProfile,
    onSuccess: () => {
      toast({
        title: "Profile Updated",
        description: "Your profile has been updated",
        status: "success",
        position: "bottom-right"
      });
      refetch();
    },
    onError: () => {
      toast({
        title: "Profile Update Failed",
        description: "Your profile has not been updated",
        status: "error",
        position: "bottom-right"
      });
    }
  });

  // 프로필 수정 onSubmit 함수를 정의합니다.
  const onSubmit = (data: any) => {
    mutation.mutate(data);
  };

  // 카메라 버튼을 클릭 했을 때, input file을 클릭하는 것과 같은 효과를 내기 위해 useRef를 사용합니다.
  const inputFile = useRef<HTMLInputElement>(null);

  // 실제 DB에 아바타 url을 업로드하는 useMutation을 정의합니다.
  const uploadAvatarMutation = useMutation({
    mutationFn: uploadImage,
    onSuccess: ({ result }: any) => {
      mutation.mutate({
        name: meData?.name,
        email: meData?.email,
        password: meData?.password,
        username: meData?.username,
        avatar: `https://imagedelivery.net/mzmXhxWLR9jzdX8u9g4BBQ/${result.id}/public`
      });
    }
  });

  // 파일 업로드를 위한 URL을 클라우드플레어로부터 받아온 데이터 타입을 정의합니다.
  interface IUploadURLResponse {
    id: string;
    uploadURL: string;
  }
  // 파일 업로드를 위한 URL을 받아오는 useMutation을 정의합니다.
  const uploadAvatarURLMutation = useMutation({
    mutationFn: getUploadURL,
    onSuccess: (data: IUploadURLResponse) => {
      uploadAvatarMutation.mutate({
        uploadURL: data.uploadURL,
        file: watch("avatar")
      });
    }
  });

  // 아바타 업로드 onSubmit 함수를 정의합니다.
  const onAvatarSubmit = (data: any) => {
    uploadAvatarURLMutation.mutate();
  };

  // 패스워드 변경 모달을 위한 useDisclosure을 정의합니다.
  const {
    isOpen: isPasswordModalOpen,
    onOpen: onPasswordModalOpen,
    onClose: onPasswordModalClose
  } = useDisclosure();

  // 패스워드 변경 타입을 정의합니다.
  interface IChangePasswordForm {
    password: string;
    newPassword: string;
    newPasswordConfirm: string;
  }
  // 패스워드 변경 useForm을 정의합니다.
  const {
    register: passwordRegister,
    handleSubmit: passwordHandleSubmit,
    watch: passwordWatch,
    formState: { errors },
    setError: passwordSetError
  } = useForm<IChangePasswordForm>();

  // newPassword와 newPasswordConfirm 값을 실시간으로 확인합니다.
  const newPassword = passwordWatch("newPassword");
  const newPasswordConfirm = passwordWatch("newPasswordConfirm");

  // 두 값이 일치하지 않을 경우 에러 메시지를 설정합니다.
  useEffect(() => {
    if (newPassword !== newPasswordConfirm) {
      passwordSetError("newPasswordConfirm", {
        type: "manual",
        message: "Your passwords do not match"
      });
    }
  }, [newPassword, newPasswordConfirm, passwordSetError]);

  // 패스워드 변경 useMutation을 정의합니다.
  const changePasswordMutation = useMutation({
    mutationFn: changePassword,
    onSuccess: () => {
      toast({
        title: "Password Changed",
        description: "Your password has been changed",
        status: "success",
        position: "bottom-right"
      });
      onPasswordModalClose();
    },
    onError: () => {
      toast({
        title: "Password Change Failed",
        description: "Your password has not been changed",
        status: "error",
        position: "bottom-right"
      });
    }
  });
  // 패스워드 변경 onSubmit 함수를 정의합니다.
  const onPasswordSubmit = (data: IChangePasswordForm) => {
    if (data.newPassword !== data.newPasswordConfirm) {
      toast({
        title: "Password Change Failed",
        description: "Your password has not been matched",
        status: "error",
        position: "bottom-right"
      });
      return;
    }
    changePasswordMutation.mutate({
      oldPassword: data.password,
      newPassword: data.newPassword
    });
  };

  return (
    <ProtectedPage>
      <Skeleton isLoaded={!isMeLoading}>
        <Box mt={"10"} px={{ base: 10, lg: 80 }}>
          <Helmet>
            <title>{meData?.name || "Default Title"}</title>
          </Helmet>

          <Container textAlign="center">
            <Heading as="h1" size="lg" mb="4">
              {meData?.name}'s Profile
            </Heading>
            <VStack mb={"5"}>
              {/* 카메라 버튼을 클릭하면 파일 업로드 창이 나타나도록 합니다. */}
              <Box
                as={"form"}
                onSubmit={handleSubmit(onAvatarSubmit)}
                position="relative" // 상대 위치 지정
                bottom="20px" // 아래로부터 40px 위에 위치
                right="-60px" // 오른쪽으로부터 40px 왼쪽에 위치
                width="1.5em"
                height="1.5em"
              >
                <Input
                  {...register("avatar")}
                  accept="image/*"
                  ref={inputFile} // 생성한 참조를 Input에 연결합니다.
                  id="fileInput"
                  type="file"
                  opacity="0"
                  cursor="pointer"
                  onChange={(event) => {
                    setValue("avatar", event.target.files);
                    onAvatarSubmit(event.target.files);
                  }} // 파일을 선택하면 watch("avatar")의 값이 변경됩니다.
                />
                <IconButton
                  type="submit"
                  icon={<FaCamera size="1.5em" />} // 아이콘의 크기를 크게 설정
                  color="black"
                  aria-label="Edit profile"
                  bg="transparent"
                  cursor={"pointer"}
                  onClick={() => inputFile.current && inputFile.current.click()} // inputFile.current가 null이 아닐 때만 클릭 이벤트를 트리거합니다.
                />
              </Box>
              <Avatar
                size="2xl"
                name={meData?.firstName + " " + meData?.lastName}
                src={meData?.avatar}
              />
            </VStack>

            <Button
              mb={"10"}
              variant="outline"
              size="sm"
              leftIcon={<FaLock />}
              onClick={onPasswordModalOpen}
            >
              Change Password
            </Button>
            {/*  패스워드 변경 모달을 정의합니다. */}
            <Modal isOpen={isPasswordModalOpen} onClose={onPasswordModalClose}>
              <ModalOverlay />
              <ModalContent>
                <ModalHeader>Change Password</ModalHeader>
                <ModalCloseButton />
                <form onSubmit={passwordHandleSubmit(onPasswordSubmit)}>
                  <ModalBody>
                    <VStack spacing="5">
                      <InputGroup>
                        <InputLeftElement
                          children={<FaLock color="gray.500" />}
                        />
                        <Input
                          {...passwordRegister("password", { required: true })}
                          type="password"
                          placeholder="Current Password"
                          variant="filled"
                          isInvalid={Boolean(errors.password?.message)}
                        />
                      </InputGroup>
                      <InputGroup>
                        <InputLeftElement
                          children={<FaLock color="gray.500" />}
                        />
                        <Input
                          {...passwordRegister("newPassword", {
                            required: true
                          })}
                          type="password"
                          placeholder="New Password"
                          variant="filled"
                          isInvalid={Boolean(errors.newPassword?.message)}
                        />
                      </InputGroup>
                      <InputGroup>
                        <InputLeftElement
                          children={<FaLock color="gray.500" />}
                        />
                        <Input
                          {...passwordRegister("newPasswordConfirm", {
                            required: true
                          })}
                          type="password"
                          placeholder="Confirm New Password"
                          variant="filled"
                          isInvalid={Boolean(
                            errors.newPasswordConfirm?.message
                          )}
                        />
                      </InputGroup>
                      {/* 비밀번호 불일치 오류 메시지를 표시 */}
                      {errors.newPasswordConfirm && (
                        <Text color="red.500" fontSize="sm">
                          Your passwords do not match
                        </Text>
                      )}
                    </VStack>
                  </ModalBody>
                  <ModalFooter>
                    <Button type="submit" colorScheme="blue" mr={3}>
                      Save
                    </Button>
                    <Button variant="ghost" onClick={onPasswordModalClose}>
                      Cancel
                    </Button>
                  </ModalFooter>
                </form>
              </ModalContent>
            </Modal>

            <VStack spacing="5" as={"form"} onSubmit={handleSubmit(onSubmit)}>
              <FormControl>
                <FormLabel>Name</FormLabel>
                <Input
                  {...register("name")}
                  placeholder="Name"
                  type="text"
                  defaultValue={meData?.name}
                />
              </FormControl>
              <FormControl>
                <FormLabel>Username</FormLabel>
                <Input
                  {...(register("username"), { required: true })}
                  placeholder="Username"
                  type="text"
                  defaultValue={meData?.username}
                  required
                />
              </FormControl>
              <FormControl>
                <FormLabel>Email</FormLabel>
                <Input
                  {...register("email")}
                  placeholder="Email"
                  type="text"
                  defaultValue={meData?.email}
                />
              </FormControl>
              <Button mt={"2"} colorScheme="blue" type="submit">
                Edit Profile
              </Button>
            </VStack>
          </Container>
        </Box>
      </Skeleton>
    </ProtectedPage>
  );
}
