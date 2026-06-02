import {
  Avatar,
  Box,
  Button,
  HStack,
  IconButton,
  LightMode,
  Menu,
  MenuButton,
  MenuItem,
  MenuList,
  ToastId,
  useColorMode,
  useColorModeValue,
  useDisclosure,
  useToast
} from "@chakra-ui/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef } from "react";
import { FaAirbnb, FaMoon, FaSun } from "react-icons/fa";
import { Link } from "react-router-dom";
import { logOut } from "../api";
import useUser from "../lib/useUser";
import LoginModal from "./LoginModal";
import SignUpModal from "./SignUpModal";

export default function Header() {
  // 로그인 여부에 따라서 로그인 버튼과 아바타가 나타나도록
  const { userLoading, isLoggedIn, user } = useUser();

  // 로그인 모달
  const {
    isOpen: isLoginOpen,
    onClose: onLoginClose,
    onOpen: onLoginOpen
  } = useDisclosure();

  // 회원가입 모달
  const {
    isOpen: isSignUpOpen,
    onClose: onSignUpClose,
    onOpen: onSignUpOpen
  } = useDisclosure();

  // 다크모드 토글
  const { toggleColorMode } = useColorMode();
  const logoColor = useColorModeValue("red.500", "red.200");
  const Icon = useColorModeValue(FaMoon, FaSun);
  const toast = useToast();
  const queryClient = useQueryClient();
  const toastId = useRef<ToastId>();

  // 로그아웃 mutation
  const mutation = useMutation({
    mutationFn: logOut,
    onMutate: () => {
      toastId.current = toast({
        title: "Login out...",
        description: "Sad to see you go...",
        status: "loading",
        position: "bottom-right"
      });
    },
    onSuccess: () => {
      if (toastId.current) {
        queryClient.setQueryData([`me`], null);
        toast.update(toastId.current, {
          status: "success",
          title: "Done!",
          description: "See you later!"
        });
      }
    }
  });

  // 로그아웃 버튼 클릭시
  const onLogOut = async () => {
    mutation.mutate();
  };
  return (
    <HStack
      justifyContent={"space-between"}
      py={"5"}
      px={"10"}
      borderBottomWidth={"1"}
    >
      <Link to={"/"}>
        <Box color={logoColor}>
          <FaAirbnb size={"48"} />
        </Box>
      </Link>
      <HStack spacing={"2"}>
        <IconButton
          onClick={toggleColorMode}
          variant={"ghost"}
          aria-label="Toggle dark mode"
          icon={<Icon />}
        ></IconButton>
        {/* 로그인 안되면 버튼이 나타나고 로그인시에만 아바타가 나타나도록 */}
        {!userLoading ? (
          !isLoggedIn ? (
            <>
              <Button onClick={onLoginOpen}>Log in</Button>
              <LightMode>
                <Button onClick={onSignUpOpen} colorScheme={"red"}>
                  Sign up
                </Button>
              </LightMode>
            </>
          ) : (
            <Menu>
              <MenuButton>
                <Avatar name={user?.name} src={user?.avatar} size={"sm"} />
              </MenuButton>
              <MenuList>
                <Link to={"/users/me"}>
                  <MenuItem>My Profile</MenuItem>
                </Link>
                {user?.is_host ? (
                  <Link to={"/rooms/upload"}>
                    <MenuItem>Upload room</MenuItem>
                  </Link>
                ) : null}
                <Link to={"/users/mybookings"}>
                  <MenuItem>My Bookings</MenuItem>
                </Link>
                <Link to={"/users/wishlist"}>
                  <MenuItem>Wishlist</MenuItem>
                </Link>
                <MenuItem onClick={onLogOut}>Log out</MenuItem>
              </MenuList>
            </Menu>
          )
        ) : null}
      </HStack>
      <LoginModal isOpen={isLoginOpen} onClose={onLoginClose} />
      <SignUpModal isOpen={isSignUpOpen} onClose={onSignUpClose} />
    </HStack>
  );
}
