import {
  Box,
  Button,
  Textarea,
  VStack,
  Heading,
  useToast,
  Grid,
  IconButton,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  useColorModeValue,
  Text,
  Divider,
  Progress,
  Card,
  Image,
  Stack,
  CardBody,
  CardFooter,
  HStack,
  Badge
} from "@chakra-ui/react";
import { useEffect, useRef, useState } from "react";
import { FaAngleDown, FaBook, FaRegClone, FaTimes } from "react-icons/fa";
import { useMutation } from "@tanstack/react-query";
import { getBagTermInText, translate } from "../api";
import { ITerm, ITranslateVariables } from "../types";
import TermCardForTranslationSkeleton from "../components/TermCardForTranslationSkeleton";

export default function Translation() {
  // 번역할 텍스트 상태
  const [text, setText] = useState("");
  // 번역된 텍스트 상태
  const [translatedText, setTranslatedText] = useState("");

  // 입력된 텍스트와 매치되는 가방 용어 상태
  const [textBagTerms, setTextBagTerms] = useState<ITerm[]>([]);

  // 입력창 포커스 상태
  const [isInputFocused, setIsInputFocused] = useState(false);
  // 번역된 텍스트 포커스 상태
  const [isTranslatedFocused, setIsTranslatedFocused] = useState(false);
  const toast = useToast();
  // 출발 언어 상태관리
  const [selectedStartLanguage, setSelectedStartLanguage] =
    useState("출발 언어 선택");
  // 도착 언어 상태관리
  const [selectedEndLanguage, setSelectedEndLanguage] =
    useState("도착 언어 선택");
  // 라이트, 다크 코드에 따른 배경색
  const bgColor = useColorModeValue("white", "gray.900");
  // 라이트, 다크 코드에 따른 테두리 색
  const borderColor = useColorModeValue("black", "gray.400");

  // 사전 나타나기 상태 관리
  const [showDictionary, setShowDictionary] = useState(false);

  // text에 해당하는 bagterm 용어를 가져오는 mutation
  const termsInTextMutation = useMutation({
    mutationFn: getBagTermInText,
    onSuccess: (data) => {
      setTextBagTerms(data);
      console.log("data", data);
      if (data === "No matching bagterm found.") {
        toast({
          title: "No matching terms found in the dictionary",
          status: "info",
          duration: 2000,
          isClosable: true
        });
      }
    },
    onError: (error) => {
      console.error(error);
      toast({
        title: "Failed to search terms",
        status: "error",
        duration: 2000,
        isClosable: true
      });
    }
  });

  // 번역 요청 mutation
  const translateMutation = useMutation({
    mutationFn: translate,
    onSuccess: (data) => {
      setTranslatedText(data.translations[0]); // 번역된 텍스트 상태 업데이트
    }
  });

  // 번역할 텍스트 초기화
  const clearText = () => {
    setText("");
    setTranslatedText("");
    setTextBagTerms([]);
    setShowDictionary(false);
  };

  // 입력창 포커스 이벤트 핸들러
  const handleInputFocus = () => {
    setIsInputFocused(true);
  };

  // 입력창 포커스 아웃 이벤트 핸들러
  const handleInputBlur = () => {
    setIsInputFocused(false);
  };

  // 출력창 포커스 이벤트 핸들러
  const handleTranslatedFocus = () => {
    setIsTranslatedFocused(true);
  };

  // 출력창 포커스 아웃 이벤트 핸들러
  const handleTranslatedBlur = () => {
    setIsTranslatedFocused(false);
  };

  // 출력창에서 translatedText가 변경될 때 포커스 이벤트 핸들러를 위한 상태 관리 useRef
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 출력창에서 translatedText가 있을 때나 변경될 때 포커스 이벤트 핸들러
  useEffect(() => {
    if (translatedText && textareaRef.current) {
      textareaRef.current.focus();
      setIsTranslatedFocused(true);
    } else if (!translatedText && textareaRef.current) {
      textareaRef.current.blur();
      setIsTranslatedFocused(false);
    }
  }, [translatedText]);

  // 번역할 때 입력창에 텍스트를 백스페이스로 삭제하면 사전도 같이 삭제
  useEffect(() => {
    if (text === "") {
      setTranslatedText("");
      setTextBagTerms([]);
      setShowDictionary(false);
    }
  }, [text]);

  // 번역 요청 onClick 함수
  const translation = (data: ITranslateVariables) => {
    if (!data.text) {
      toast({
        title: "No text to translate!",
        status: "info",
        duration: 2000,
        isClosable: true
      });
    } else {
      translateMutation.mutate({
        text: data.text,
        source: "ko",
        target: "en"
      });
    }
  };

  const onClickDictionary = () => {
    setShowDictionary(true); // 아이콘을 클릭하면 상태를 토글합니다.
    if (text) {
      termsInTextMutation.mutate(text);
    } else {
      setShowDictionary(false);
      toast({
        title: "No text to search",
        status: "info",
        duration: 2000,
        isClosable: true
      });
    }
  };

  // 클립보드에 복사하는 함수
  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(translatedText);
      toast({
        title: "Copied to clipboard",
        status: "success",
        duration: 2000,
        isClosable: true
      });
    } catch (err) {
      console.error("Failed to copy text: ", err);
    }
  };

  return (
    <Box mt={{ base: "5", md: "10" }} p={5}>
      <Grid
        px={{
          base: 0,
          lg: 40
        }}
        columnGap={"4"}
        rowGap={"8"}
        templateColumns={{
          sm: "1fr",
          md: "1fr 1fr"
        }}
      >
        {/* 입력창 */}
        <VStack spacing={4} align={"flex-start"}>
          {/* 출발언어 선택 */}
          <Menu>
            <MenuButton as={Button} rightIcon={<FaAngleDown />}>
              {selectedStartLanguage}
            </MenuButton>
            <MenuList>
              <MenuItem onClick={() => setSelectedStartLanguage("Korean")}>
                Korean
              </MenuItem>
              <MenuItem onClick={() => setSelectedStartLanguage("English")}>
                English
              </MenuItem>
              <MenuItem onClick={() => setSelectedStartLanguage("Chinese")}>
                Chinese
              </MenuItem>
              <MenuItem onClick={() => setSelectedStartLanguage("Indonesian")}>
                Indonesian
              </MenuItem>
              <MenuItem onClick={() => setSelectedStartLanguage("Vietnamese")}>
                Vietnamese
              </MenuItem>
            </MenuList>
          </Menu>
          <Box
            position={"relative"}
            w="100%"
            border={"1px"}
            borderColor={isInputFocused ? borderColor : "gray.200"} // 조건부 스타일 적용
            borderRadius={"md"}
            p={4}
            backgroundColor={bgColor}
          >
            {/* 입력 textarea */}
            <Textarea
              placeholder="Enter text to translate"
              onFocus={handleInputFocus}
              onBlur={handleInputBlur}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  translation({
                    text: text,
                    source: "ko",
                    target: "en"
                  });
                }
              }}
              fontSize={{
                base: "xl",
                md: "2xl"
              }}
              resize={"none"}
              border={"none"}
              _focus={{
                borderColor: "transparent",
                boxShadow: "none",
                outline: "none"
              }}
              w={"90%"}
              height={{
                base: "200px",
                md: "300px"
              }}
            />
            {/* 입력창에 텍스트가 있을 때만 clear 버튼 보이도록 */}
            {text && (
              <IconButton
                icon={<FaTimes />}
                color={"gray.500"}
                onClick={clearText}
                aria-label="Clear"
                position={"absolute"}
                right={2}
                top={2}
                background={"none"}
              />
            )}
            {/* 번역하기 버튼 */}
            <Box display={"flex"} justifyContent={"space-between"}>
              <IconButton
                icon={<FaBook />}
                size={"lg"}
                color={"gray.500"}
                onClick={onClickDictionary}
                aria-label="dictionary"
                background={"none"}
              />
              <Button
                colorScheme={text ? "blue" : "gray"}
                onClick={() => {
                  translation({
                    text: text,
                    source: "ko",
                    target: "en"
                  });
                }}
              >
                Translate
              </Button>
            </Box>
          </Box>
        </VStack>
        {/* 출력창 */}
        <VStack spacing={4} align={"flex-start"}>
          {/* 도착언어 선택 */}
          <Menu>
            <MenuButton as={Button} rightIcon={<FaAngleDown />}>
              {selectedEndLanguage}
            </MenuButton>
            <MenuList>
              <MenuItem onClick={() => setSelectedEndLanguage("Korean")}>
                Korean
              </MenuItem>
              <MenuItem onClick={() => setSelectedEndLanguage("English")}>
                English
              </MenuItem>
              <MenuItem onClick={() => setSelectedEndLanguage("Chinese")}>
                Chinese
              </MenuItem>
              <MenuItem onClick={() => setSelectedEndLanguage("Indonesian")}>
                Indonesian
              </MenuItem>
              <MenuItem onClick={() => setSelectedEndLanguage("Vietnamese")}>
                Vietnamese
              </MenuItem>
            </MenuList>
          </Menu>

          <Box
            position={"relative"}
            w="100%"
            border={"1px"}
            borderColor={isTranslatedFocused ? borderColor : "gray.200"} // 조건부 스타일 적용
            borderRadius={"md"}
            p={4}
            backgroundColor={bgColor}
          >
            {/* mutation이 진행 중일 때만 Progress 컴포넌트 표시 */}
            {translateMutation.isPending && (
              <Progress size="xs" isIndeterminate />
            )}
            {/* 출력 textarea */}
            <Textarea
              ref={textareaRef}
              isReadOnly
              placeholder="Translated text will appear here"
              value={translatedText}
              fontSize={{
                base: "xl",
                md: "2xl"
              }}
              resize={"none"}
              border={"none"}
              onFocus={handleTranslatedFocus}
              onBlur={handleTranslatedBlur}
              _focus={{
                borderColor: "transparent",
                boxShadow: "none",
                outline: "none"
              }}
              w={"90%"}
              height={{
                base: "200px",
                md: "300px"
              }}
            />
            {/* 복사 버튼 */}
            <Box display={"flex"} justifyContent={"flex-end"}>
              <IconButton
                icon={<FaRegClone />}
                size={"lg"}
                color={"gray.500"}
                onClick={copyToClipboard}
                aria-label="Copy"
                background={"none"}
              />
            </Box>
          </Box>
        </VStack>
      </Grid>
      {/* 하단 용어 사전 */}
      {textBagTerms && Array.isArray(textBagTerms) && (
        <Grid
          px={{
            base: 5,
            lg: 40
          }}
          columnGap={"4"}
          rowGap={"8"}
          templateColumns={{
            sm: "1fr",
            md: "1fr"
          }}
        >
          {/* 사전 */}
          {showDictionary && (
            <Box
              w="100%"
              mt={"5"}
              p={4}
              border={"1px"}
              borderColor={"gray.200"} // 조건부 스타일 적용
              borderRadius={"md"}
              backgroundColor={bgColor}
              minH={"200px"}
            >
              <Heading size={"sm"}>Dictionary</Heading>
              <Divider my={2} />
              {termsInTextMutation.isPending && (
                <>
                  <TermCardForTranslationSkeleton />
                  <TermCardForTranslationSkeleton />
                  <TermCardForTranslationSkeleton />
                </>
              )}
              {textBagTerms?.length > 0 ? (
                textBagTerms.map((term, index) => (
                  <Card
                    key={index}
                    direction={{ base: "column", sm: "row" }}
                    overflow="hidden"
                    variant="outline"
                    mb={2}
                  >
                    <Image
                      _hover={{
                        transform: "scale(1.02)", // 마우스 오버 시에 컴포넌트 크기를 5% 증가
                        transition: "transform 0.3s" // 크기 변화에 0.3초 동안의 애니메이션 효과 적용
                      }}
                      objectFit="cover"
                      maxW={{ base: "100%", sm: "200px" }}
                      src="https://images.unsplash.com/photo-1667489022797-ab608913feeb?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxlZGl0b3JpYWwtZmVlZHw5fHx8ZW58MHx8fHw%3D&auto=format&fit=crop&w=800&q=60"
                      alt="Caffe Latte"
                    />

                    <Stack>
                      <CardBody>
                        {/* 상단 카테고리 */}
                        <HStack mb={"2"} justifyContent="flex-start">
                          <Badge
                            variant={"outline"}
                            fontWeight={"bold"}
                            colorScheme={"gray"}
                            w="1/3"
                          >
                            {term.category}
                          </Badge>
                          <Badge
                            variant={"outline"}
                            fontWeight={"bold"}
                            colorScheme={"gray"}
                            w="1/3"
                          >
                            {term.material}
                          </Badge>
                        </HStack>
                        <Heading size="md">{term.name}</Heading>
                        <Text py="2">
                          Caffè latte is a coffee beverage of Italian origin
                          made with espresso and steamed milk.
                        </Text>
                        <HStack mt={"2"} width={"100%"}>
                          <Badge colorScheme="gray" textColor={"GrayText"}>
                            EN
                          </Badge>
                          <Text>
                            {term.english_term?.name}
                            {term.english_term?.synonym_1?.name
                              ? `, ${term.english_term?.synonym_1?.name}`
                              : ""}
                            {term.english_term?.synonym_2?.name
                              ? `, ${term.english_term?.synonym_2?.name}`
                              : ""}
                            {term.english_term?.synonym_3?.name
                              ? `, ${term.english_term?.synonym_3?.name}`
                              : ""}
                          </Text>
                        </HStack>
                      </CardBody>
                      <CardFooter></CardFooter>
                    </Stack>
                  </Card>
                ))
              ) : (
                <Text>No Terms Found</Text>
              )}
            </Box>
          )}
        </Grid>
      )}
    </Box>
  );
}
