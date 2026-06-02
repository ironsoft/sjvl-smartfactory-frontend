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
import { FaAngleDown, FaAngleUp, FaEllipsisH } from "react-icons/fa";
import { IChinese, IIndonesian, IKorean, ITerm, IVietnamese } from "../types";

interface BagTermCardProps {
  id: number;
  name: string;
  language: string;
  category: string;
  material: string;
  description: string;
  representitive: boolean;
  photo: string;
  english_term: ITerm;
  korean_term: ITerm;
  chinese_term: ITerm;
  vietnamese_term: ITerm;
  indonesian_term: ITerm;
  synonym_1: ITerm;
  synonym_2: ITerm;
  synonym_3: ITerm;
  synonym_4: ITerm;
  synonym_5: ITerm;
  synonym_6: ITerm;
  synonym_7: ITerm;
  synonym_8: ITerm;
  synonym_9: ITerm;
  synonym_10: ITerm;
}

export default function BagTermCard({
  id,
  name,
  language,
  category,
  material,
  description,
  representitive,
  photo,
  english_term,
  korean_term,
  chinese_term,
  vietnamese_term,
  indonesian_term,
  synonym_1,
  synonym_2,
  synonym_3,
  synonym_4,
  synonym_5,
  synonym_6,
  synonym_7,
  synonym_8,
  synonym_9,
  synonym_10
}: BagTermCardProps) {
  const { isOpen, onToggle } = useDisclosure();
  console.log("english_term", english_term);
  console.log("english_term", english_term?.name);
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
              photo ||
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
              {category}
            </Badge>
            <Badge
              variant={"outline"}
              fontWeight={"bold"}
              colorScheme={"gray"}
              alignSelf="flex-end"
              w="1/3"
            >
              {material}
            </Badge>
          </HStack>
          <Heading size="md">{name}</Heading>
          <Text width={{ base: "100%", lg: "250px" }}>{description}</Text>
          <HStack mt={"2"} width={{ base: "100%", lg: "250px" }}>
            <Badge colorScheme="gray" textColor={"GrayText"}>
              EN
            </Badge>
            <Text>{english_term?.name}</Text>
          </HStack>
          <HStack width={{ base: "100%", lg: "250px" }}>
            <Badge colorScheme="gray" textColor={"GrayText"}>
              KO
            </Badge>
            <Text isTruncated>{korean_term?.name}</Text>
          </HStack>
          {/* 더보기 */}
          <Stack spacing="2" display={isOpen ? "flex" : "none"}>
            <HStack width={{ base: "100%", lg: "250px" }}>
              <Badge colorScheme="gray" textColor={"GrayText"}>
                CN
              </Badge>
              <Text>{chinese_term?.name}</Text>
            </HStack>
            <HStack width={{ base: "100%", lg: "250px" }}>
              <Badge colorScheme="gray" textColor={"GrayText"}>
                IN
              </Badge>
              <Text>{vietnamese_term?.name}</Text>
            </HStack>
            <HStack width={{ base: "100%", lg: "250px" }}>
              <Badge colorScheme="gray" textColor={"GrayText"}>
                VN
              </Badge>
              <Text>{indonesian_term?.name}</Text>
            </HStack>
          </Stack>
          {/* 더보기 아이콘 */}
          <Box
            onClick={onToggle}
            cursor="pointer"
            alignSelf="flex-end"
            color={"gray.500"}
          >
            {isOpen ? <FaAngleUp /> : <FaAngleDown />}
          </Box>
        </Stack>
      </CardBody>
    </Card>
  );
}
