import { Avatar, Box, Text } from "@chakra-ui/react";

export default function UserInformation({
  username,
  email,
  avatar
}: {
  username: string;
  email: string;
  avatar: string;
}) {
  return (
    <Box>
      <Avatar size="2xl" name={username} src={avatar} />
      <Box>
        <Text mt="5" fontSize="xl">
          {username}
        </Text>
        <Text fontSize="md" fontWeight="bold" mb={"5"}>
          {email}
        </Text>
      </Box>
    </Box>
  );
}
