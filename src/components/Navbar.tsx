import {
  Badge,
  Box,
  Flex,
  HStack,
  Button,
  Text,
  Link,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  IconButton,
  useDisclosure,
  useColorModeValue,
  useColorMode,
  useToast,
  ToastId,
  LightMode,
  Avatar
} from "@chakra-ui/react";
import useUser from "../lib/useUser";
import {
  FaMoon,
  FaSun,
} from "react-icons/fa";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef } from "react";
import { useLocation, useNavigate, Link as RouterLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { logOut } from "../api";
import LoginModal from "./LoginModal";
import SignUpModal from "./SignUpModal";
import LanguageSwitcher from "./LanguageSwitcher";

export default function Navbar() {
  const { t } = useTranslation();
  const backgroundColor = useColorModeValue("white", "gray.800");
  const borderColor = useColorModeValue("gray.100", "gray.700");

  const { userLoading, isLoggedIn, user } = useUser();
  const isWorker = user?.role === "worker";

  const {
    isOpen: isLoginOpen,
    onClose: onLoginClose,
    onOpen: onLoginOpen
  } = useDisclosure();

  const {
    isOpen: isSignUpOpen,
  } = useDisclosure();

  const { toggleColorMode } = useColorMode();
  const Icon = useColorModeValue(FaMoon, FaSun);
  const toast = useToast();
  const queryClient = useQueryClient();
  const toastId = useRef<ToastId>();
  const navigate = useNavigate();

  const mutation = useMutation({
    mutationFn: logOut,
    onMutate: () => {
      toastId.current = toast({
        title: t("navbar.toastLogoutLoading"),
        description: t("navbar.toastLogoutLoadingDesc"),
        status: "loading",
        position: "bottom-right"
      });
    },
    onSuccess: () => {
      if (toastId.current) {
        queryClient.setQueryData([`me`], null);
        toast.update(toastId.current, {
          status: "success",
          title: t("navbar.toastLogoutDone"),
          description: t("navbar.toastLogoutDoneDesc")
        });
        navigate("/");
      }
    }
  });

  const onLogOut = async () => {
    mutation.mutate();
  };

  const location = useLocation();

  if (
    location.pathname === "/users" ||
    location.pathname === "/terms/termsList" ||
    (location.pathname.startsWith("/terms/upload/") &&
      location.pathname.endsWith("/photo"))
  ) {
    return null;
  }

  return (
    <Box
      py={"5"}
      px={{ base: "5", md: "10" }}
      borderBottomWidth={"1"}
      borderColor={borderColor}
      bg={backgroundColor}
      position="relative"
      zIndex={1000}
    >
      <Flex h={16} alignItems="center" justifyContent={"space-between"} mx="auto">
        {/* 로고 */}
        <Box display={"flex"} justifyContent={"flex-start"} alignItems="center" gap={2}>
          <Link
            as={RouterLink}
            to={isWorker ? "/worker/me" : "/"}
            textDecoration="none"
            _hover={{ textDecoration: "none" }}
          >
            <Box mr="5" gap="5" display="flex" alignItems="center">
              <img
                src="/sungjin_logo.png"
                alt={t("navbar.brandLogoAlt")}
                style={{ height: "34px", width: "auto", objectFit: "contain" }}
              />
              <Box>
                <Text
                  fontWeight="semibold"
                  color="gray.500"
                  _hover={{ textDecoration: "none" }}
                  lineHeight={1.2}
                >
                  VL Factory
                </Text>
                <Badge
                  colorScheme="purple"
                  fontSize="9px"
                  px={1.5}
                  borderRadius="sm"
                  mt="1px"
                >
                  Beta
                </Badge>
              </Box>
            </Box>
          </Link>
        </Box>

        {/* 오른쪽: 다크모드, 언어, 아바타 */}
        <Box>
          <HStack spacing={{ base: "0.5", md: "1.5" }}>
            <IconButton
              onClick={toggleColorMode}
              variant={"ghost"}
              aria-label={t("navbar.ariaDarkMode")}
              icon={<Icon />}
            />
            <LanguageSwitcher />
            {!userLoading ? (
              !isLoggedIn ? (
                <>
                  <Button onClick={onLoginOpen}>{t("navbar.logIn")}</Button>
                  <LightMode />
                </>
              ) : (
                <Menu>
                  <MenuButton>
                    <Avatar name={user?.name} src={user?.avatar} size={"sm"} />
                  </MenuButton>
                  <MenuList>
                    {isWorker ? (
                      <>
                        <MenuItem as={RouterLink} to="/worker/me" textDecoration="none">
                          {t("navbar.myProfile")}
                        </MenuItem>
                        <MenuItem onClick={onLogOut}>{t("navbar.logOut")}</MenuItem>
                      </>
                    ) : (
                      <>
                        <MenuItem as={RouterLink} to="/users/me" textDecoration="none">
                          {t("navbar.myProfile")}
                        </MenuItem>
                        <MenuItem onClick={onLogOut}>{t("navbar.logOut")}</MenuItem>
                      </>
                    )}
                  </MenuList>
                </Menu>
              )
            ) : null}
          </HStack>
          <LoginModal isOpen={isLoginOpen} onClose={onLoginClose} />
          <SignUpModal isOpen={isSignUpOpen} onClose={() => { /* unused */ }} />
        </Box>
      </Flex>
    </Box>
  );
}
