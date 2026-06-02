import {
  Badge,
  Box,
  Button,
  Card,
  CardBody,
  CardFooter,
  Collapse,
  HStack,
  Heading,
  Image,
  Link,
  Stack,
  Text,
  useDisclosure
} from "@chakra-ui/react";
import { FaAngleDown, FaAngleUp } from "react-icons/fa";

interface BlogCardProps {
  id: number;
  title: string;
  description: string;
  created_at: string;
  updated_at: string;
}

export default function BlogCard({
  id,
  title,
  description,
  created_at,
  updated_at
}: BlogCardProps) {
  const { isOpen, onToggle } = useDisclosure();
  return (
    <Card
      maxW="sm"
      _hover={{
        transform: "scale(1.02)", // 마우스 오버 시에 컴포넌트 크기를 5% 증가
        transition: "transform 0.3s" // 크기 변화에 0.3초 동안의 애니메이션 효과 적용
      }}
    >
      <CardBody>
        <Link href={`/terms/${id}`} _hover={{ textDecoration: "none" }}>
          <Image
            src={
              // 이미지가 없을 경우 기본 이미지로 대체
              "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQQ4kemniC91dT47PB1qlCDY8UvnrCzOLpngAhmpz6w1OcPL5Ae6SZ3_IzzGP4L1emVyMs&usqp=CAU"
            }
            alt="Green double couch with wooden legs"
            borderRadius="lg"
            width={{
              base: "100%",
              lg: "250px"
            }}
            height={{
              base: "100%",
              lg: "250px"
            }}
            objectFit="cover"
          />
        </Link>

        <Stack mt="6" spacing="2">
          <HStack justifyContent="flex-end">
            <Badge
              variant={"outline"}
              fontWeight={"bold"}
              colorScheme={"gray"}
              alignSelf="flex-end"
              w="1/3"
            >
              blog
            </Badge>
            <Badge
              variant={"outline"}
              fontWeight={"bold"}
              colorScheme={"gray"}
              alignSelf="flex-end"
              w="1/3"
            >
              blog
            </Badge>
          </HStack>
          <Heading size="md">{title}</Heading>
          <Text width={{ base: "100%", lg: "250px" }}>{description}</Text>
        </Stack>
      </CardBody>
    </Card>
  );
}
