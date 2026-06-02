import {
  Avatar,
  Badge,
  Box,
  Button,
  Card,
  CardBody,
  CardFooter,
  CardHeader,
  Flex,
  HStack,
  Heading,
  IconButton,
  Image,
  Link,
  Stack,
  Text,
  VStack,
  useDisclosure
} from "@chakra-ui/react";
import { BsThreeDotsVertical } from "react-icons/bs";
import { IBlog, IUser } from "../types";
import { useQuery } from "@tanstack/react-query";
import { getBlogDetail } from "../api";

interface BlogCardProps {
  id: number;
  title: string;
  description: string;
  created_at: string;
  updated_at: string;
  author: IUser;
}

export default function BlogCard2({
  id,
  title,
  description,
  created_at,
  updated_at,
  author
}: BlogCardProps) {
  // photos 불러오기
  const { data: blogData, isLoading: isBlogDataLoading } = useQuery<IBlog>({
    queryKey: [`blogs`, id],
    queryFn: getBlogDetail
  });
  console.log("blogData", blogData?.photos[0]?.file);

  return (
    <Card
      maxW="md"
      h="560px"
      display="flex"
      flexDirection="column"
      _hover={{
        transform: "scale(1.02)",
        transition: "transform 0.2s"
      }}
    >
      <Link href={`/blog/${id}`} _hover={{ textDecoration: "none" }} display="flex" flexDirection="column" flex="1" overflow="hidden">
        <CardHeader flexShrink={0}>
          <Flex gap="4">
            <Flex flex="1" gap="4" alignItems="center" flexWrap="wrap">
              <Avatar name="Segun Adebayo" src={author.avatar} />
              <Box>
                <Heading noOfLines={2} size="sm">
                  {title}
                </Heading>
                <Text color={"gray.500"}>
                  {new Date(created_at).toLocaleDateString(undefined, {
                    year: "numeric",
                    month: "long",
                    day: "numeric"
                  })}
                </Text>
              </Box>
            </Flex>
            <IconButton
              variant="ghost"
              colorScheme="gray"
              aria-label="See menu"
              icon={<BsThreeDotsVertical />}
            />
          </Flex>
        </CardHeader>
        <CardBody flex="1" overflow="hidden">
          <Text noOfLines={3}>{description}</Text>
          <Box mt={2} w="100%" h="260px" overflow="hidden" flexShrink={0}>
            <Image
              w="100%"
              h="100%"
              objectFit="cover"
              src={
                blogData?.photos[0]?.file ||
                "https://images.unsplash.com/photo-1531403009284-440f080d1e12?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=1770&q=80"
              }
              alt="Chakra UI"
            />
          </Box>
        </CardBody>
      </Link>

      <CardFooter>
        {/* 가방 스타일 정보 */}
        <VStack minW={"100%"}>
          {/* 브랜드 */}
          <Badge
            variant={"outline"}
            fontWeight={"bold"}
            colorScheme={"gray"}
            alignSelf="flex-start"
            w="1/3"
            mt={2}
          >
            COACH
          </Badge>
          <HStack
            alignItems={"flex-start"}
            justifyContent={"space-between"}
            width="100%"
          >
            <VStack alignItems={"flex-start"} spacing={1}>
              <Text mr={1}>Glovetanned Shoulder Bag</Text>
              <Text color={"gray.500"}>COH002321</Text>
            </VStack>
            <Image
              boxSize="50px"
              objectFit="cover"
              src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSIojXk6q6z4WH8YzWlrRdVfUAcca1IBhX4Jw&s"
              alt="Bag Image"
              rounded={"md"}
            />
          </HStack>
        </VStack>
      </CardFooter>
    </Card>
  );
}
