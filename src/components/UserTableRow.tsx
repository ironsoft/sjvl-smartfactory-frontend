import {
  Avatar,
  Box,
  Td,
  Text,
  Tr,
  useColorMode,
  useToast
} from "@chakra-ui/react";

interface UserTableRowProps {
  name: string;
  avatarUrl: string;
  userId: number;
  username: string;
  onSelectUser: (userId: number) => void;
}

export default function UserTableRow({
  name, avatarUrl, userId, username, onSelectUser
}: UserTableRowProps) {

  const { colorMode } = useColorMode();
  const bgColor = { light: "gray.100", dark: "gray.600" };

  return (
    <>
      <Tr 
        onClick={() => onSelectUser(userId)}
        _hover={{
          background: bgColor[colorMode],
          cursor: "pointer",
          transition: "all 0.3s",
          textColor: "skyblue"
        }}>
        <Td>
            {/* 이미지가 없을 경우 대체 이미지를 보여주기 */}
            {avatarUrl ? (
              <Avatar
                boxSize="50px"
                objectFit="cover"
                src={avatarUrl}
                rounded={"md"}
              />
            ) : (
              // 대체 이미지
              <Box
                boxSize={"50px"}
                display="flex" // flex 하면 align-items, justify-content 사용 가능
                alignItems="center"
                justifyContent="center"
              >
                <Text fontSize={"sm"} color={"gray.400"}>
                  No Image
                </Text>
              </Box>
            )}
        </Td>
        <Td>
          <Text>{userId}</Text>
        </Td>
        <Td>
          <Text>{name}</Text>
        </Td>
        <Td>
          <Text>{username}</Text>
        </Td>
      </Tr>
    </>
  );
}
