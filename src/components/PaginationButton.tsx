import { Flex, FlexProps, useColorModeValue } from "@chakra-ui/react";

interface PaginationButtonProps extends FlexProps {
  children: React.ReactNode;
  isDisabled?: boolean;
  isActive?: boolean;
  onClick: () => void;
}

export default function PaginationButton({
  children, // 버튼 안에 들어갈 내용, 이전, 1, 2, 3, 다음 등
  isDisabled = false,
  isActive = false,
  onClick, // 클릭했을 때 실행할 함수
  ...flexProps // borderBottonRadius, borderTopRadius 등의 FlexProps를 받습니다.
}: PaginationButtonProps) {
  const activeStyle = {
    bg: useColorModeValue("gray.300", "gray.700")
  };
  return (
    <Flex
      p={3}
      px={4}
      fontSize="md"
      fontWeight="500"
      lineHeight={0.8}
      opacity={isDisabled ? 0.7 : 1}
      _hover={!isDisabled ? activeStyle : {}}
      cursor={isDisabled ? "not-allowed" : "pointer"}
      border="1px solid"
      mr="-1px"
      borderColor={useColorModeValue("gray.300", "gray.700")}
      onClick={onClick}
      {...(isActive ? activeStyle : {})}
      {...flexProps} // 여기에 추가적인 FlexProps를 적용합니다.
    >
      {children}
    </Flex>
  );
}
