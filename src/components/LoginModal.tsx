import {
  Box,
  Button,
  Input,
  InputGroup,
  InputLeftElement,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalHeader,
  ModalOverlay,
  Text,
  useToast,
  VStack
} from "@chakra-ui/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { FaLock, FaUserNinja } from "react-icons/fa";
import {
  IUsernameLoginError,
  IUsernameLoginVariables,
  usernameLogin
} from "../api";
import { IUser } from "../types";
import SocialLogin from "./SocialLogin";

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface IForm {
  username: string;
  password: string;
}

// 로그인 모달 컴포넌트
export default function LoginModal({ isOpen, onClose }: LoginModalProps) {
  const navigate = useNavigate();
  // useForm hook을 사용해서 폼 상태 관리
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset
  } = useForm();
  const toast = useToast();
  // 쿼리 클라이언트 인스턴스
  const queryClient = useQueryClient();
  // 로그인 mutation
  const mutation = useMutation<
    any,
    IUsernameLoginError,
    IUsernameLoginVariables
  >({
    mutationFn: usernameLogin,
    onMutate: (variables) => {
      console.log("mutation start with", variables);
      // 필요한 경우 여기에서 사전 처리 작업 수행
    },
    onSuccess: async (data) => {
      console.log("mutation is successful", data);
      toast({
        title: "Welcome back!",
        description: data.ok,
        status: "success"
      });
      onClose();
      reset();
      await queryClient.refetchQueries({ queryKey: [`me`] });
      const me = queryClient.getQueryData<IUser>([`me`]);
      if (me?.role === "worker") {
        navigate("/worker/me", { replace: true });
      }
    },
    onError: (error) => {
      console.log("mutation has an error", error);
      toast({
        title: "Error",
        description: (error as any).response?.data?.error || "Username or Password are wrong.",
        status: "error"
      });
    }
  });
  // 폼 제출시  mutation 호출
  const onSubmit = ({ username, password }: IForm) => {
    console.log("onSubmit", username, password);
    mutation.mutate({ username, password });
  };
  return (
    <Modal onClose={onClose} isOpen={isOpen}>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Log in</ModalHeader>
        <ModalCloseButton />
        <ModalBody as={"form"} onSubmit={handleSubmit(onSubmit as any)}>
          <VStack mb={"5"}>
            {/* username */}
            <InputGroup>
              <InputLeftElement
                children={
                  <Box color={"gray.500"}>
                    <FaUserNinja />
                  </Box>
                }
              />
              <Input
                isInvalid={Boolean(errors.username?.message)}
                {...register("username", {
                  required: "Please write username"
                })}
                variant={"filled"}
                placeholder={"Username"}
              />
            </InputGroup>
            {/* 패스워드 */}
            <InputGroup>
              <InputLeftElement
                children={
                  <Box color={"gray.500"}>
                    <FaLock />
                  </Box>
                }
              />
              <Input
                isInvalid={Boolean(errors.password?.message)}
                {...register("password", {
                  required: "Please write password"
                })}
                variant={"filled"}
                placeholder={"Password"}
                type={"password"}
              />
            </InputGroup>
            {mutation.isError ? (
              <Text color={"red.500"} textAlign={"center"} fontSize={"small"}>
                Username or Password are wrong.
              </Text>
            ) : null}
          </VStack>
          <Button
            isLoading={mutation.isPending}
            type="submit"
            colorScheme={"red"}
            w={"100%"}
            mb={"5"}
          >
            Log in
          </Button>
          {/* <SocialLogin /> */}
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}
