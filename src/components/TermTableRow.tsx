import { Box, Image, Td, Text, Tr, useColorMode } from "@chakra-ui/react";

interface ITermTableRowProps {
  id: number;
  name: string;
  photo: string;
  category: string;
  representitive: boolean;
  language: string;
  onSelectTerm?: (id: number, language: string) => void;
}

export default function TermTableRow({
  id,
  name,
  photo,
  category,
  representitive,
  language,
  onSelectTerm
}: ITermTableRowProps) {
  const { colorMode } = useColorMode();
  const bgColor = { light: "gray.100", dark: "gray.700" };
  return (
    <>
      <Tr
        key={id}
        onClick={() => onSelectTerm && onSelectTerm(id, language)}
        _hover={{
          cursor: "pointer",
          background: bgColor[colorMode],
          transition: "all 0.3s",
          textColor: "blue.400"
        }}
      >
        <Td>
          {photo ? (
            <Image
              boxSize="50px"
              objectFit="cover"
              src={photo}
              alt="Room Image"
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
        <Td>{id}</Td>
        <Td>{name}</Td>
        <Td>{category}</Td>
        <Td>{representitive ? "O" : "X"}</Td>
      </Tr>
    </>
  );
}
