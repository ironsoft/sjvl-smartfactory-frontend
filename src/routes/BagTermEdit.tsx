import {
  Box,
  Button,
  Checkbox,
  FormControl,
  FormHelperText,
  FormLabel,
  HStack,
  Heading,
  IconButton,
  Input,
  InputGroup,
  InputLeftAddon,
  Select,
  Text,
  Textarea,
  VStack,
  useToast
} from "@chakra-ui/react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { FaAngleRight, FaCamera, FaSearch } from "react-icons/fa";
import { useNavigate, useParams } from "react-router-dom";
import { editBagTerm, getBagTermDetail } from "../api";
import { ITerm } from "../types";

export default function BagTermEdit() {
  // params로 받은 termId
  const { termId } = useParams();

  // BagTerm 데이터 가져와서 form에 채워넣기
  const { data: term, isLoading } = useQuery<ITerm>({
    queryKey: [`bagterms`, termId],
    queryFn: getBagTermDetail
  });

  // Terms 상태 관리
  const [englishTerm, setEnglishTerm] = useState("");
  const [chineseTerm, setChineseTerm] = useState("");
  const [koreanTerm, setKoreanTerm] = useState("");
  const [vietnameseTerm, setVietnameseTerm] = useState("");
  const [indonesianTerm, setIndonesianTerm] = useState("");
  const [synonym1, setSynonym1] = useState("");
  const [synonym2, setSynonym2] = useState("");
  const [synonym3, setSynonym3] = useState("");
  const [synonym4, setSynonym4] = useState("");
  const [synonym5, setSynonym5] = useState("");
  const [synonym6, setSynonym6] = useState("");
  const [synonym7, setSynonym7] = useState("");
  const [synonym8, setSynonym8] = useState("");
  const [synonym9, setSynonym9] = useState("");
  const [synonym10, setSynonym10] = useState("");

  // 최초에 외래키로 받아온 데이터를 상태에 저장
  useEffect(() => {
    if (term) {
      setEnglishTerm(term.english_term?.id.toString());
      setChineseTerm(term.chinese_term?.id.toString());
      setKoreanTerm(term.korean_term?.id.toString());
      setVietnameseTerm(term.vietnamese_term?.id.toString());
      setIndonesianTerm(term.indonesian_term?.id.toString());
      setSynonym1(term.synonym_1?.id.toString());
      setSynonym2(term.synonym_2?.id.toString());
      setSynonym3(term.synonym_3?.id.toString());
      setSynonym4(term.synonym_4?.id.toString());
      setSynonym5(term.synonym_5?.id.toString());
      setSynonym6(term.synonym_6?.id.toString());
      setSynonym7(term.synonym_7?.id.toString());
      setSynonym8(term.synonym_8?.id.toString());
      setSynonym9(term.synonym_9?.id.toString());
      setSynonym10(term.synonym_10?.id.toString());
    }
  }, [term]);

  // Form handling
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors }
  } = useForm({
    mode: "onSubmit"
  });

  const toast = useToast();
  const navigate = useNavigate();

  // Term Edit Form mutation
  const mutation = useMutation({
    mutationFn: editBagTerm,
    onSuccess: (data) => {
      toast({
        title: "Term Uploaded",
        description: "Your term has been uploaded successfully.",
        status: "success",
        duration: 9000,
        isClosable: true
      });
      navigate(`/terms/${data.id}`);
    }, // 성공시 알림창
    onError: (error) => {
      toast({
        title: "Error",
        description: "Your term has not been uploaded.",
        status: "error",
        duration: 9000,
        isClosable: true
      });
    } // 실패시 알림창
  });

  // Category가 Material일 경우, Material Category를 선택할 수 있도록 함
  const [category, setCategory] = useState("");

  // 외래키 필드에 독립창인 FindTerm에서 선택한 단어를 받아서 적용
  useEffect(() => {
    const messageHandler = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) {
        return;
      }

      const { termId, languageType } = event.data;

      if (termId) {
        // termsList에서 선택한 언어가 언어타입이 없을 때,
        if (languageType === "") {
          toast({
            title: "Error",
            description:
              "The language you selected doesn't have the language type.",
            status: "error",
            duration: 9000,
            isClosable: true
          });
          // termsList에서 선택한 언어가 영어일 때,
        } else if (languageType === "english") {
          setEnglishTerm(termId);
          setValue("english_term", termId.toString());
          // termsList에서 선택한 언어가 중국어일 때,
        } else if (languageType === "chinese") {
          setChineseTerm(termId);
          setValue("chinese_term", termId.toString());
        } else if (languageType === "korean") {
          setKoreanTerm(termId);
          setValue("korean_term", termId.toString());
        } else if (languageType === "vietnamese") {
          setVietnameseTerm(termId);
          setValue("vietnamese_term", termId.toString());
        } else if (languageType === "indonesian") {
          setIndonesianTerm(termId);
          setValue("indonesian_term", termId.toString());
        } else if (languageType === "synonym1") {
          setSynonym1(termId);
          setValue("synonym_1", termId.toString());
        } else if (languageType === "synonym2") {
          setSynonym2(termId);
          setValue("synonym_2", termId.toString());
        } else if (languageType === "synonym3") {
          setSynonym3(termId);
          setValue("synonym_3", termId.toString());
        } else if (languageType === "synonym4") {
          setSynonym4(termId);
          setValue("synonym_4", termId.toString());
        } else if (languageType === "synonym5") {
          setSynonym5(termId);
          setValue("synonym_5", termId.toString());
        } else if (languageType === "synonym6") {
          setSynonym6(termId);
          setValue("synonym_6", termId.toString());
        } else if (languageType === "synonym7") {
          setSynonym7(termId);
          setValue("synonym_7", termId.toString());
        } else if (languageType === "synonym8") {
          setSynonym8(termId);
          setValue("synonym_8", termId.toString());
        } else if (languageType === "synonym9") {
          setSynonym9(termId);
          setValue("synonym_9", termId.toString());
        } else if (languageType === "synonym10") {
          setSynonym10(termId);
          setValue("synonym_10", termId.toString());
        }
      }
    };

    // 메시지 이벤트 리스너 등록
    window.addEventListener("message", messageHandler);

    return () => {
      // 컴포넌트가 언마운트 될 때 리스너 제거
      window.removeEventListener("message", messageHandler);
    };
  }, [setValue]); // setValue가 변경될 때마다 useEffect가 다시 실행

  // Form Submit
  const onSubmit = (data: any) => {
    data.id = termId; // termId를 data에 추가
    // 외래키로 받아온 데이터를 data에 추가. 추가하지 않으면, 외래키 데이터가 사라짐.
    data.english_term = englishTerm;
    data.chinese_term = chineseTerm;
    data.korean_term = koreanTerm;
    data.vietnamese_term = vietnameseTerm;
    data.indonesian_term = indonesianTerm;
    data.synonym_1 = synonym1;
    data.synonym_2 = synonym2;
    data.synonym_3 = synonym3;
    data.synonym_4 = synonym4;
    data.synonym_5 = synonym5;
    data.synonym_6 = synonym6;
    data.synonym_7 = synonym7;
    data.synonym_8 = synonym8;
    data.synonym_9 = synonym9;
    data.synonym_10 = synonym10;
    mutation.mutate(data);
  };

  // 사진 업로드 클릭시, 사진 업로드 창을 띄움
  const onCameraClick = () => {
    window.open(
      `/terms/upload/${termId}/photo`,
      "_blank",
      "height=600,width=800"
    );
  };

  return (
    <Box
      pb={40}
      mt={10}
      px={{
        base: 10,
        md: 80,
        lg: "30%"
      }}
    >
      <Heading textAlign={"center"}>Edit Bag Terminology</Heading>

      <VStack spacing={10} as="form" mt={5} onSubmit={handleSubmit(onSubmit)}>
        {/* 사진 업로드 */}
        <Button
          variant={"unstyled"}
          top={"0"}
          right={"0"}
          onClick={onCameraClick}
        >
          <HStack>
            <FaCamera size={"20px"} />
            <Text>Upload Photos</Text>
            <FaAngleRight size={"20px"} />
          </HStack>
        </Button>
        {/* 용어명칭 */}
        <FormControl>
          <FormLabel>Name</FormLabel>
          <Input
            {...register("name")}
            required
            type={"text"}
            defaultValue={term?.name}
          />
          <FormHelperText>Write the name of terminology.</FormHelperText>
        </FormControl>
        {/* 설명 */}
        <FormControl>
          <FormLabel>Description</FormLabel>
          <Textarea
            {...register("description")}
            defaultValue={term?.description}
          />
        </FormControl>
        {/* 언어 */}
        <FormControl>
          <FormLabel>Language</FormLabel>
          <Select
            {...register("language")}
            defaultValue={term?.language}
            placeholder="Choose a language"
          >
            <option value="english">English</option>
            <option value="korean">Korean</option>
            <option value="chinese">Chinese</option>
            <option value="vietnamese">Vietnamese</option>
            <option value="indonesian">Indonesian</option>
          </Select>
          <FormHelperText>
            What language does this word belong to?
          </FormHelperText>
        </FormControl>
        {/* 대표 용어 여부 */}
        <FormControl>
          <Checkbox
            {...register("representitive")}
            defaultChecked={term?.representitive}
          >
            Representitive?
          </Checkbox>
        </FormControl>
        {/* 카테고리 */}
        <FormControl>
          <FormLabel>Category</FormLabel>
          <Select
            {...register("category")}
            placeholder="Choose a category"
            // Material일 경우, Material Category를 선택할 수 있도록 함
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            defaultValue={term?.category}
          >
            <option value="part">Placement</option>
            <option value="material">Material</option>
            <option value="tech">Tech</option>
            <option value="machine">Machine</option>
          </Select>
          <FormHelperText>
            What kind of category does this word belongs to?
          </FormHelperText>
        </FormControl>
        {/* 자재 종류 */}
        <FormControl isDisabled={category !== "material"}>
          <FormLabel>Material Categroy</FormLabel>
          <Select
            {...register("material")}
            placeholder="Choose a material category"
            defaultValue={term?.material}
          >
            <option value="leather">Leather</option>
            <option value="fabric">Fabric</option>
            <option value="pvc">PVC</option>
            <option value="hardware">Hardware</option>
            <option value="filler">Filler</option>
            <option value="other">Other</option>
          </Select>
          <FormHelperText>
            카테고리가 자재일 경우, 어떤 자재인지 선택해주세요.
          </FormHelperText>
        </FormControl>
        {/* 영어 */}
        <FormControl>
          <FormLabel>English</FormLabel>
          <InputGroup>
            <InputLeftAddon children="ENG" />
            <Input
              {...register("english_term")}
              type={"text"}
              value={englishTerm}
              readOnly
            />
            <IconButton
              ml={"3"}
              aria-label="Search database"
              icon={<FaSearch />}
              onClick={() =>
                window.open(
                  "/terms/termsList",
                  "_blank",
                  "height=600,width=800"
                )
              }
            />
          </InputGroup>
          <FormHelperText>Write the English term.</FormHelperText>
        </FormControl>
        {/* 중국어 */}
        <FormControl>
          <FormLabel>Chinese</FormLabel>
          <InputGroup>
            <InputLeftAddon children="CHN" />
            <Input
              {...register("chinese_term")}
              type={"text"}
              value={chineseTerm}
              readOnly
            />
            <IconButton
              ml={"3"}
              aria-label="Search database"
              icon={<FaSearch />}
              onClick={() =>
                window.open(
                  "/terms/termsList",
                  "_blank",
                  "height=600,width=800"
                )
              }
            />
          </InputGroup>
          <FormHelperText>Write the Chinese term.</FormHelperText>
        </FormControl>
        {/* 한국어 */}
        <FormControl>
          <FormLabel>Korean</FormLabel>
          <InputGroup>
            <InputLeftAddon children="KOR" />
            <Input
              {...register("korean_term")}
              type={"text"}
              value={koreanTerm}
              readOnly
            />
            <IconButton
              ml={"3"}
              aria-label="Search database"
              icon={<FaSearch />}
              onClick={() =>
                window.open(
                  "/terms/termsList",
                  "_blank",
                  "height=600,width=800"
                )
              }
            />
          </InputGroup>
          <FormHelperText>Write the Korean term.</FormHelperText>
        </FormControl>
        {/* 베트남어 */}
        <FormControl>
          <FormLabel>Vietnamese</FormLabel>
          <InputGroup>
            <InputLeftAddon children="VIE" />
            <Input
              {...register("vietnamese_term")}
              type={"text"}
              value={vietnameseTerm}
              readOnly
            />
            <IconButton
              ml={"3"}
              aria-label="Search database"
              icon={<FaSearch />}
              onClick={() =>
                window.open(
                  "/terms/termsList",
                  "_blank",
                  "height=600,width=800"
                )
              }
            />
          </InputGroup>
          <FormHelperText>Write the Vietnamese term.</FormHelperText>
        </FormControl>
        {/* 인도네시아어 */}
        <FormControl>
          <FormLabel>Indonesian</FormLabel>
          <InputGroup>
            <InputLeftAddon children="IND" />
            <Input
              {...register("indonesian_term")}
              type={"text"}
              value={indonesianTerm}
              readOnly
            />
            <IconButton
              ml={"3"}
              aria-label="Search database"
              icon={<FaSearch />}
              onClick={() =>
                window.open(
                  "/terms/termsList",
                  "_blank",
                  "height=600,width=800"
                )
              }
            />
          </InputGroup>
          <FormHelperText>Write the Indonesian term.</FormHelperText>
        </FormControl>
        {/* Synonym 1 */}
        <FormControl>
          <FormLabel>Synonym 1</FormLabel>
          <InputGroup>
            <InputLeftAddon children="01" />
            <Input
              {...register("synonym_1")}
              type={"text"}
              value={synonym1}
              readOnly
            />
            <IconButton
              ml={"3"}
              aria-label="Search database"
              icon={<FaSearch />}
              onClick={() =>
                window.open(
                  "/terms/termsList/synonym1",
                  "_blank",
                  "height=600,width=800"
                )
              }
            />
          </InputGroup>
          <FormHelperText>Write the synonym term.</FormHelperText>
        </FormControl>
        {/* Synonym 2 */}
        <FormControl>
          <FormLabel>Synonym 2</FormLabel>
          <InputGroup>
            <InputLeftAddon children="02" />
            <Input
              {...register("synonym_2")}
              type={"text"}
              value={synonym2}
              readOnly
            />
            <IconButton
              ml={"3"}
              aria-label="Search database"
              icon={<FaSearch />}
              onClick={() =>
                window.open(
                  "/terms/termsList/synonym2",
                  "_blank",
                  "height=600,width=800"
                )
              }
            />
          </InputGroup>
          <FormHelperText>Write the synonym term.</FormHelperText>
        </FormControl>
        {/* Synonym 3 */}
        <FormControl>
          <FormLabel>Synonym 3</FormLabel>
          <InputGroup>
            <InputLeftAddon children="03" />
            <Input
              {...register("synonym_3")}
              type={"text"}
              value={synonym3}
              readOnly
            />
            <IconButton
              ml={"3"}
              aria-label="Search database"
              icon={<FaSearch />}
              onClick={() =>
                window.open(
                  "/terms/termsList/synonym3",
                  "_blank",
                  "height=600,width=800"
                )
              }
            />
          </InputGroup>
          <FormHelperText>Write the synonym term.</FormHelperText>
        </FormControl>
        {/* Synonym 4 */}
        <FormControl>
          <FormLabel>Synonym 4</FormLabel>
          <InputGroup>
            <InputLeftAddon children="04" />
            <Input
              {...register("synonym_4")}
              type={"text"}
              value={synonym4}
              readOnly
            />
            <IconButton
              ml={"3"}
              aria-label="Search database"
              icon={<FaSearch />}
              onClick={() =>
                window.open(
                  "/terms/termsList/synonym4",
                  "_blank",
                  "height=600,width=800"
                )
              }
            />
          </InputGroup>
          <FormHelperText>Write the synonym term.</FormHelperText>
        </FormControl>
        {/* Synonym 5 */}
        <FormControl>
          <FormLabel>Synonym 5</FormLabel>
          <InputGroup>
            <InputLeftAddon children="05" />
            <Input
              {...register("synonym_5")}
              type={"text"}
              value={synonym5}
              readOnly
            />
            <IconButton
              ml={"3"}
              aria-label="Search database"
              icon={<FaSearch />}
              onClick={() =>
                window.open(
                  "/terms/termsList/synonym5",
                  "_blank",
                  "height=600,width=800"
                )
              }
            />
          </InputGroup>
          <FormHelperText>Write the synonym term.</FormHelperText>
        </FormControl>
        {/* Synonym 6 */}
        <FormControl>
          <FormLabel>Synonym 6</FormLabel>
          <InputGroup>
            <InputLeftAddon children="06" />
            <Input
              {...register("synonym_6")}
              type={"text"}
              value={synonym6}
              readOnly
            />
            <IconButton
              ml={"3"}
              aria-label="Search database"
              icon={<FaSearch />}
              onClick={() =>
                window.open(
                  "/terms/termsList/synonym6",
                  "_blank",
                  "height=600,width=800"
                )
              }
            />
          </InputGroup>
          <FormHelperText>Write the synonym term.</FormHelperText>
        </FormControl>
        {/* Synonym 7 */}
        <FormControl>
          <FormLabel>Synonym 7</FormLabel>
          <InputGroup>
            <InputLeftAddon children="07" />
            <Input
              {...register("synonym_7")}
              type={"text"}
              value={synonym7}
              readOnly
            />
            <IconButton
              ml={"3"}
              aria-label="Search database"
              icon={<FaSearch />}
              onClick={() =>
                window.open(
                  "/terms/termsList/synonym7",
                  "_blank",
                  "height=600,width=800"
                )
              }
            />
          </InputGroup>
          <FormHelperText>Write the synonym term.</FormHelperText>
        </FormControl>
        {/* Synonym 8 */}
        <FormControl>
          <FormLabel>Synonym 8</FormLabel>
          <InputGroup>
            <InputLeftAddon children="08" />
            <Input
              {...register("synonym_8")}
              type={"text"}
              value={synonym8}
              readOnly
            />
            <IconButton
              ml={"3"}
              aria-label="Search database"
              icon={<FaSearch />}
              onClick={() =>
                window.open(
                  "/terms/termsList/synonym8",
                  "_blank",
                  "height=600,width=800"
                )
              }
            />
          </InputGroup>
          <FormHelperText>Write the synonym term.</FormHelperText>
        </FormControl>
        {/* Synonym 9 */}
        <FormControl>
          <FormLabel>Synonym 9</FormLabel>
          <InputGroup>
            <InputLeftAddon children="09" />
            <Input
              {...register("synonym_9")}
              type={"text"}
              value={synonym9}
              readOnly
            />
            <IconButton
              ml={"3"}
              aria-label="Search database"
              icon={<FaSearch />}
              onClick={() =>
                window.open(
                  "/terms/termsList/synonym9",
                  "_blank",
                  "height=600,width=800"
                )
              }
            />
          </InputGroup>
          <FormHelperText>Write the synonym term.</FormHelperText>
        </FormControl>
        {/* Synonym 10 */}
        <FormControl>
          <FormLabel>Synonym 10</FormLabel>
          <InputGroup>
            <InputLeftAddon children="10" />
            <Input
              {...register("synonym_10")}
              type={"text"}
              value={synonym10}
              readOnly
            />
            <IconButton
              ml={"3"}
              aria-label="Search database"
              icon={<FaSearch />}
              onClick={() =>
                window.open(
                  "/terms/termsList/synonym10",
                  "_blank",
                  "height=600,width=800"
                )
              }
            />
          </InputGroup>
          <FormHelperText>Write the synonym term.</FormHelperText>
        </FormControl>
        {/* 제출버튼 */}
        <Button
          isLoading={mutation.isPending}
          type="submit"
          colorScheme={"red"}
          size="lg"
          w={"100%"}
        >
          Upload Terminology
        </Button>
      </VStack>
    </Box>
  );
}
