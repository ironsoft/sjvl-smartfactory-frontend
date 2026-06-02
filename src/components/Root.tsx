import { Box, useColorModeValue } from "@chakra-ui/react";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import Footer from "./Footer";
import Navbar from "./Navbar";
import { useEffect } from "react";
import useUser from "../lib/useUser";
import { isWorkerAllowedPath } from "../lib/workerAllowedRoutes";

export default function Root() {
  const { user, userLoading } = useUser();
  const navigate = useNavigate();
  const location = useLocation();
  const isPopup = new URLSearchParams(location.search).get("popup") === "1";

  // worker 계정: 프로필 + EP QR로 열리는 실적 입력·공정(영상/QC/작업지시)만 허용
  useEffect(() => {
    if (!userLoading && user?.role === "worker") {
      if (!isWorkerAllowedPath(location.pathname)) {
        navigate("/worker/me", { replace: true });
      }
    }
  }, [userLoading, user, location.pathname, navigate]);

  // 페이지가 로드될 때, favicon을 sungjin_logo로 설정
  useEffect(() => {
    const faviconUrl = `${process.env.PUBLIC_URL || ""}/sungjin_logo.png`;
    let link = document.querySelector("link[rel*='icon']") as HTMLLinkElement;
    if (!link) {
      link = document.createElement("link");
      link.rel = "icon";
      document.getElementsByTagName("head")[0].appendChild(link);
    }
    link.href = faviconUrl;
  }, []);

  const bgColor = useColorModeValue("white", "gray.900");
  const contentBg = useColorModeValue("gray.50", "gray.900");

  return (
    <Box backgroundColor={bgColor} minH="100vh" display="flex" flexDirection="column">
      {!isPopup && <Navbar />}
      <Box flex="1" display="flex" flexDirection="column" minH={isPopup ? "100vh" : "calc(100vh - 120px)"} backgroundColor={contentBg}>
        <Outlet />
      </Box>
      {!isPopup && <Footer />}
      <ReactQueryDevtools />
    </Box>
  );
}
