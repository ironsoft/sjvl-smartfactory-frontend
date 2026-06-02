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
import { FaEnvelope, FaLock, FaUserNinja, FaUserSecret } from "react-icons/fa";
import { IUserSignupError, IUserSignupVariables, userSignup } from "../api";
import SocialLogin from "./SocialLogin";

interface SignUpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface IForm {
  username: string;
  email: string;
  name: string;
  password: string;
  password2: string;
}

export default function SignUpModal({ isOpen, onClose }: SignUpModalProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset
  } = useForm();
  const toast = useToast();
  const queryClient = useQueryClient();
  const mutation = useMutation<any, IUserSignupError, IUserSignupVariables>({
    mutationFn: userSignup,
    onMutate: (variables) => {
      console.log("mutation start with", variables);
      // 필요한 경우 여기에서 사전 처리 작업 수행
    },
    onSuccess: (data) => {
      console.log("mutation is successful", data);
      toast({
        title: "Welcome!",
        description: data.ok, // 성공 응답 데이터 사용
        status: "success"
      });
      onClose();
      reset();
      queryClient.refetchQueries({ queryKey: [`me`] });
    },
    onError: (error) => {
      console.log("mutation has an error", error);
      toast({
        title: "Error",
        description: error.error, // 에러 응답 데이터 사용
        status: "error"
      });
    }
  });

  const onSubmit = ({ username, name, email, password, password2 }: IForm) => {
    mutation.mutate({ username, name, email, password, password2 });
  };

  return (
    <Modal onClose={onClose} isOpen={isOpen}>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Sign up</ModalHeader>
        <ModalCloseButton />
        <ModalBody as={"form"} onSubmit={handleSubmit(onSubmit as any)}>
          <VStack mb={"5"}>
            <InputGroup>
              <InputLeftElement
                children={
                  <Box color={"gray.500"}>
                    <FaUserSecret />
                  </Box>
                }
              />
              <Input
                isInvalid={Boolean(errors.name?.message)}
                {...register("name", {
                  required: "Please write name"
                })}
                variant={"filled"}
                placeholder="Name"
              />
            </InputGroup>
            <InputGroup>
              <InputLeftElement
                children={
                  <Box color={"gray.500"}>
                    <FaEnvelope />
                  </Box>
                }
              />
              <Input
                isInvalid={Boolean(errors.email?.message)}
                {...register("email", {
                  required: "Please write email"
                })}
                type="email"
                variant={"filled"}
                placeholder={"Email"}
              />
            </InputGroup>
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
                type="password"
                placeholder={"Password"}
              />
            </InputGroup>
            <InputGroup>
              <InputLeftElement
                children={
                  <Box color={"gray.500"}>
                    <FaLock />
                  </Box>
                }
              />
              <Input
                isInvalid={Boolean(errors.password2?.message)}
                {...register("password2", {
                  required: "Please write password"
                })}
                variant={"filled"}
                type="password"
                placeholder={"Password Confirm"}
              />
            </InputGroup>
            {mutation.isError ? (
              <Text color={"red.500"} textAlign={"center"} fontSize={"small"}>
                Passwords must match.
              </Text>
            ) : null}
          </VStack>
          <Button type="submit" colorScheme={"red"} w={"100%"}>
            Sign up
          </Button>
          <SocialLogin />
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}
