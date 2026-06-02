import { Box, Container, Heading } from "@chakra-ui/react";
import UserInformation from "../components/UserInformation";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getUserInformation } from "../api";

export default function UserProfile() {
  const { userId } = useParams();
  console.log(userId);
  const { data: userData } = useQuery({
    queryKey: [`users`, `${userId}`],
    queryFn: getUserInformation
  });
  console.log(userData);
  return (
    <Box
      pb={"40"}
      mt={"10"}
      px={{
        base: 10,
        lg: 80
      }}
    >
      <Container textAlign="center">
        <Heading as="h1" size="lg" mb="10">
          {userData?.name}'s Profile
        </Heading>
        <UserInformation
          username={userData?.username || ""}
          email={userData?.email || ""}
          avatar={userData?.avatar || ""}
        />
      </Container>
    </Box>
  );
}
