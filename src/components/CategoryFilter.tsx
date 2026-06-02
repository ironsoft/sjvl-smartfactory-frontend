import {
  Box,
  HStack,
  Icon,
  Text,
  VStack,
  useBreakpointValue,
  useColorMode
} from "@chakra-ui/react";
import { useEffect, useState } from "react";
import {
  FaBed,
  FaMountain,
  FaSwimmer,
  FaThLarge,
  FaUmbrellaBeach
} from "react-icons/fa";
import { IconType } from "react-icons/lib";

interface CategoryFilterProps {
  onCategorySelect: (category: string) => void;
}

export default function CategoryFilter({
  onCategorySelect
}: CategoryFilterProps) {
  // 아이템 이름 타입 정의
  type ItemName = "전체" | "산" | "해변가" | "섬" | "성층권";

  // color 상태의 타입을 명시적으로 지정
  const [color, setColor] = useState<Record<ItemName, string>>({
    전체: "gray.800", // 전체 아이템은 기본적으로 선택된 상태처럼 보이도록 함
    산: "gray.400",
    해변가: "gray.400",
    섬: "gray.400",
    성층권: "gray.400"
  });

  // 아이콘과 텍스트 요소를 배열로 관리
  const items: { name: ItemName; icon: IconType }[] = [
    { name: "전체", icon: FaThLarge },
    { name: "산", icon: FaMountain },
    { name: "해변가", icon: FaUmbrellaBeach },
    { name: "섬", icon: FaBed },
    { name: "성층권", icon: FaSwimmer }
  ];

  // dark mode 일때 선택된 아이콘의 색상만 변경
  const { colorMode } = useColorMode();

  // 선택된 아이템 상태
  const [selectedItem, setSelectedItem] = useState<ItemName>("전체");

  // 라이트 모드에서 선택된 아이콘 색상은 gray.800이다. 갑자기 다크 모드로 변경되었을 때, 선택된 아이콘의 색상을 자동으로 white 변경하기 위해 useEffect를 사용
  useEffect(() => {
    setColor((prevColor) => ({
      ...prevColor,
      [selectedItem]: colorMode === "dark" ? "white" : "gray.800"
    }));
  }, [colorMode]); // colorMode가 변경될 때마다 실행

  const handleIconClick = (itemName: ItemName) => {
    // 모든 아이콘의 색상을 초기 상태로 설정
    setColor({
      전체: "gray.400",
      산: "gray.400",
      해변가: "gray.400",
      섬: "gray.400",
      성층권: "gray.400"
    });

    // 클릭된 아이콘의 색상만 변경
    setSelectedItem(itemName);

    // 클릭된 아이콘의 색상만 변경
    setColor((prevColor) => ({
      ...prevColor,
      [itemName]: colorMode === "dark" ? "white" : "gray.800"
    }));

    // onCategorySelect 함수 호출
    onCategorySelect(itemName);
  };

  




  return (
    <HStack justifyContent={"center"} spacing={{
      base: "10",
      md: "20"
    }} my={{
      base: "10",
      md: "20"
    }}>
      
      {items.map((item) => (
        <Box
          key={item.name}
          _hover={{
            transform: "scale(1.02)",
            transition: "transform 0.3s"
          }}
          cursor={"pointer"}
          display="flex"
          alignItems="center"
          // 클릭된 아이템만의 색상을 적용
          onMouseDown={() => setColor({ ...color, [item.name]: "gray.800" })}
        >
          <VStack spacing={"1"} onClick={() => handleIconClick(item.name)}>
            <Icon color={color[item.name]} as={item.icon} w={{
              base: "6",
              md: "7"
            }} h={{
              base: "6",
              md: "7"
            }} />
            
            <Text color={color[item.name]} fontSize={"sm"}>
              {item.name}
            </Text>
          </VStack>
        </Box>
      ))}
    </HStack>
  );
}
