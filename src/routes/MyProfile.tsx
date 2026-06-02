import { useQuery } from "@tanstack/react-query";
import { getMe } from "../api";
import {
  Avatar,
  Box,
  Button,
  Container,
  Heading,
  Skeleton,
  Text
} from "@chakra-ui/react";
import ProtectedPage from "../components/ProtectPage";
import { FaEdit, FaRedRiver, FaRegEdit } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import UserInformation from "../components/UserInformation";

export default function MyProfile() {
  const navigate = useNavigate();

  const { data: meData, isLoading: userLoading } = useQuery({
    queryKey: [`me`],
    queryFn: getMe
  });

  const onEditClick = (event: React.SyntheticEvent<HTMLButtonElement>) => {
    event.preventDefault();
    navigate(`/users/me/edit`);
  };

  return (
    <Skeleton isLoaded={!userLoading}>
      <ProtectedPage>
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
              {meData?.name}'s Profile
            </Heading>
            {/* user information 컨포넌트 */}
            <UserInformation
              username={meData?.username}
              email={meData?.email}
              avatar={meData?.avatar}
            />
            <Button onClick={onEditClick}>
              <Box as={FaEdit} mr="2" />
              Edit Profile
            </Button>
          </Container>
        </Box>
      </ProtectedPage>
    </Skeleton>
  );
}
