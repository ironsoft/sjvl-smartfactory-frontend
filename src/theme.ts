import { extendTheme, type ThemeConfig } from "@chakra-ui/react";

const config: ThemeConfig = {
  initialColorMode: "dark",
  useSystemColorMode: false // 유저의 컴퓨터 설정
};

const theme = extendTheme({ config });

export default theme;
