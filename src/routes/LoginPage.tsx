import {
  Box,
  Button,
  Container,
  Flex,
  FormControl,
  FormLabel,
  Heading,
  IconButton,
  Input,
  InputGroup,
  InputRightElement,
  Stack,
  useDisclosure,
  useToast
} from "@chakra-ui/react";
import { useNavigate } from "react-router-dom";
import { useRef } from "react";
import useUser from "../lib/useUser";
import { useForm } from "react-hook-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  IUsernameLoginError,
  IUsernameLoginVariables,
  usernameLogin
} from "../api";
import { IUser } from "../types";
import { HiEye, HiEyeOff } from "react-icons/hi";

interface IForm {
  username: string;
  password: string;
}

export default function LoginPage() {
  // 현재 접속한 사용자가 로그인 상태인지 확인
  const { isLoggedIn } = useUser();
  const navigate = useNavigate();

  // 비밀번호 입력 필드 눌깔 아이콘 클릭시 비밀번호 표시
  const { isOpen, onToggle } = useDisclosure();
  // 비밀번호 입력 필드 레퍼런스
  const inputRef = useRef<HTMLInputElement>(null);

  // 비밀번호 눈깔 아이콘 클릭시 비밀번호 표시 여부 토글
  const onClickReveal = () => {
    onToggle();
    if (inputRef.current) {
      inputRef.current.focus({ preventScroll: true });
    }
  };

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
        status: "success"
      });
      const result = await queryClient.refetchQueries({ queryKey: [`me`] });
      const me = queryClient.getQueryData<IUser>([`me`]);
      if (me?.role === "worker") {
        navigate("/worker/me");
      } else if (me?.factory_access === "DEVELOPMENT") {
        navigate("/jigs");
      } else {
        navigate("/home");
      }
      reset();
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
  // 폼 제출시  mutation 호출
  const onSubmit = ({ username, password }: IForm) => {
    mutation.mutate({ username, password });
  };

  return (
    <Container
      maxW="lg"
      py={{ base: "12", md: "24" }}
      px={{ base: "0", sm: "8" }}
    >
      <Stack spacing="8">
        <Stack spacing="6">
          {/* <Logo /> */}
          <Flex justifyContent="center" alignItems="center">
            <img
              src="/sungjin_logo.png"
              alt="Logo"
              style={{ height: "34px", width: "auto" }}
            />
          </Flex>
          <Stack spacing={{ base: "2", md: "3" }} textAlign="center">
            <Heading
              size={{ base: "xs", md: "sm" }}
              fontSize={{ base: "xs", md: "sm" }}
            >
              Welcome to SJ Smart Factory System!
              {/* SJ 웰딩 생산 관리 시스템에 오신 것을 환영합니다! <br /><br />
              Chào mừng bạn đến với Hệ thống quản lý sản xuất SJ EP! */}
            </Heading>
            {/* <Text color="fg.muted">
              Don't have an account? <Link href="#">Sign up</Link>
            </Text> */}
          </Stack>
        </Stack>
        <Box
          py={{ base: "0", sm: "8" }}
          px={{ base: "4", sm: "10" }}
          bg={{ base: "transparent", sm: "bg.surface" }}
          boxShadow={{ base: "none", sm: "md" }}
          borderRadius={{ base: "none", sm: "xl" }}
        >
          <Stack
            spacing="6"
            as={"form"}
            onSubmit={handleSubmit(onSubmit as any)}
          >
            <Stack spacing="5">
              <FormControl>
                <FormLabel htmlFor="username">Username</FormLabel>
                <Input
                  isInvalid={Boolean(errors.username?.message)}
                  {...register("username", {
                    required: "Please write username"
                  })}
                  variant={"filled"}
                  placeholder={"Username"}
                />
              </FormControl>
              <FormControl>
                <FormLabel htmlFor="password">Password</FormLabel>
                <InputGroup>
                  <Input
                    isInvalid={Boolean(errors.password?.message)}
                    {...register("password", {
                      required: "Please write password"
                    })}
                    variant={"filled"}
                    placeholder={"Password"}
                    type={isOpen ? "text" : "password"}
                  />
                  <InputRightElement>
                    <IconButton
                      variant="text"
                      aria-label={isOpen ? "Mask password" : "Reveal password"}
                      icon={isOpen ? <HiEyeOff /> : <HiEye />}
                      onClick={onClickReveal}
                    />
                  </InputRightElement>
                </InputGroup>
              </FormControl>
            </Stack>
            <Stack spacing="6">
              <Button isLoading={mutation.isPending} type="submit">
                Sign in
              </Button>
            </Stack>
          </Stack>
        </Box>
      </Stack>
    </Container>
  );
}
