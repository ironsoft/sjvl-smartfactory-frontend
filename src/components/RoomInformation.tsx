import {
  Avatar,
  HStack,
  Heading,
  Skeleton,
  Text,
  VStack,
  useBreakpointValue
} from "@chakra-ui/react";
import { Link } from "react-router-dom";

export default function RoomInformation({
  data,
  isLoading
}: {
  data: any;
  isLoading: boolean;
}) {

  const stackWidth = useBreakpointValue({ base: "100%", md: "80%", lg: "40%" });

  return (
    <HStack width={stackWidth} justifyContent={"space-between"} mt={"10"}>
      <VStack alignItems={"flex-start"}>
        <Skeleton isLoaded={!isLoading} height={"30px"}>
          <Heading fontSize={"2xl"}>House hosted by {data?.owner.name}</Heading>
        </Skeleton>
        <Skeleton isLoaded={!isLoading} height={"30px"}>
          <HStack justifyContent={"flex-start"} w={"100%"}>
            <Text>
              {data?.toilets} toilets{data?.toilets === 1 ? "" : "s"}
            </Text>
            <Text>•</Text>
            <Text>
              {data?.rooms} room{data?.rooms === 1 ? "" : "s"}
            </Text>
          </HStack>
        </Skeleton>
      </VStack>
      <Link to={`/users/${data?.owner.pk}`}>
        <Avatar name={data?.owner.name} size={"lg"} src={data?.owner.avatar} />
      </Link>
    </HStack>
  );
}
