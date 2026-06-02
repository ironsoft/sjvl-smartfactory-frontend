import {
  Badge,
  HStack,
  Image,
  Text,
  VStack,
  useColorModeValue
} from "@chakra-ui/react";

export default function BagStyleSimpleCard() {
  const textColor = useColorModeValue("gray.600", "gray.400");
  return (
    <>
      <HStack
        _hover={{
          transform: "scale(1.02)",
          transition: "transform 0.2s"
        }}
        mt={2}
        justifyContent={"flex-end"}
      >
        <VStack spacing={1}>
          {/* 스타일 코드 */}
          <Badge
            variant={"outline"}
            fontWeight={"bold"}
            colorScheme={"gray"}
            alignSelf="flex-end"
            w="1/3"
          >
            CH-002
          </Badge>
          {/* 스타일 이름 */}
          <Text color={textColor}>Globetanned Shoulder Bag</Text>
        </VStack>
        {/* 스타일 사진 */}
        <Image
          boxSize="50px"
          objectFit="cover"
          src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSIojXk6q6z4WH8YzWlrRdVfUAcca1IBhX4Jw&s"
          alt="Bag Image"
          rounded={"md"}
        />
      </HStack>
    </>
  );
}
