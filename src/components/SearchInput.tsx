import {
  Box,
  Button,
  Input,
  InputGroup,
  InputLeftElement,
  InputRightElement
} from "@chakra-ui/react";
import { useState } from "react";
import { FaSearch, FaTimes } from "react-icons/fa";

// onSearch 매개 변수 타입 정의
interface ISearchInputProps {
  onSearch: (query: string) => void;
  onInputChange: (value: string) => void;
  placeholder?: string;
  /** true면 한 열로 쌓일 때 검색창을 가로로 꽉 채움(최대 maxW). false면 SJ Machines처럼 60%/30% 비율 */
  fullWidth?: boolean;
}

// 검색창 컴포넌트
export default function SearchInput({
  onSearch,
  onInputChange,
  placeholder = "Search...",
  fullWidth = false,
}: ISearchInputProps) {
  // 검색어 입력값
  const [inputValue, setInputValue] = useState("");

  // 검색어 입력시 입력값 변경
  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = event.target.value;
    setInputValue(newValue);
    onInputChange(newValue);
  };

  // 키보드 엔터키를 누르면 검색 실행
  const handleKeyPress = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      onSearch(inputValue);
    }
  };

  // x 버튼 클릭시 검색어 초기화
  const handleClearInput = () => {
    setInputValue("");
    onSearch(""); // 빈문자로 검색 실행
    onInputChange(""); // 빈문자로 검색어 입력값 변경
  };
  // SJ Machines 목록과 동일: 비율 + maxW로 과도한 넓이 방지
  return (
    <Box
      w={fullWidth ? "100%" : { base: "60%", lg: "30%" }}
      maxW="420px"
      minW={0}
    >
      <InputGroup>
        <InputLeftElement children={<FaSearch />} />
        <Input
          value={inputValue}
          onChange={handleInputChange}
          onKeyPress={handleKeyPress}
          borderColor={"gray.300"}
          borderRadius={"30"}
          type="text"
          variant={"outline"}
          placeholder={placeholder}
          aria-label="Search"
        />
        {/* 검색어가 있을 때 X 버튼 표시 */}
        {inputValue && (
          <InputRightElement>
            <Button variant={"unstyled"} onClick={handleClearInput}>
              <FaTimes />
            </Button>
          </InputRightElement>
        )}
      </InputGroup>
    </Box>
  );
}
