import { Box, Button, Divider, HStack, Text, VStack } from "@chakra-ui/react";
import { FaComment, FaGithub } from "react-icons/fa";

export default function SocialLogin() {
  const KakaoParams = {
    client_id: "ad1ff4f9072315229ca80d0d997612a7",
    redirect_uri: "http://127.0.0.1:3000/social/kakao",
    response_type: "code"
  };
  const params = new URLSearchParams(KakaoParams).toString();

  return (
    <Box>
      <HStack my={"8"}>
        <Divider />
        <Text
          textTransform={"uppercase"}
          color={"gray.500"}
          fontSize={"xs"}
          as="b"
        >
          Or
        </Text>
        <Divider />
      </HStack>
      <VStack mb={"5"}>
        <Button
          as={"a"}
          href={
            "https://github.com/login/oauth/authorize?client_id=8eba83f4c352122f34b4&scope=read:user,user:email"
          }
          w={"100%"}
          leftIcon={<FaGithub />}
          colorScheme={"telegram"}
        >
          Continue with Github
        </Button>
        <Button
          as={"a"}
          href={`https://kauth.kakao.com/oauth/authorize?${params}`}
          w="100%"
          leftIcon={<FaComment />}
          colorScheme={"yellow"}
        >
          Continue with Kakao
        </Button>
      </VStack>
    </Box>
  );
}
