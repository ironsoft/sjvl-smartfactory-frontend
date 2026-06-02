import * as React from "react";
import {
  Container,
  chakra,
  Stack,
  Text,
  Button,
  Box,
  Avatar
} from "@chakra-ui/react";
// Here we have used react-icons package for the icons
import {
  FaCode,
  FaCreativeCommonsNcEu,
  FaCross,
  FaGithub,
  FaKeyboard,
  FaMobile,
  FaRobot,
  FaShoppingBag
} from "react-icons/fa";

const AboutMe = () => {
  return (
    <>
      <Container p={{ base: 8, sm: 8 }}>
        <Stack direction="column" spacing={6} alignItems="center">
          <Box
            py={2}
            px={3}
            bg="teal"
            w="max-content"
            color="white"
            rounded="md"
            fontSize="sm"
          >
            <Stack direction={{ base: "column", sm: "row" }}>
              <Text fontWeight="bold">About Me 🚀</Text>
            </Stack>
          </Box>
          <Avatar
            src="https://imagedelivery.net/mzmXhxWLR9jzdX8u9g4BBQ/538797c2-d1be-4d8f-736d-629daafc4900/public"
            h={20}
            w={20}
            color={"gray.300"}
          />
          <chakra.h1
            fontSize={{ base: "4xl", sm: "5xl" }}
            fontWeight="bold"
            textAlign="center"
            maxW="600px"
          >
            정확한 AI 예측 모델은 해당 산업에 대한{" "}
            <chakra.span
              color="teal"
              bg="linear-gradient(transparent 50%, #83e9e7 50%)"
            >
              깊은 이해에서 탄생할 수 있다고 생각합니다.
            </chakra.span>
          </chakra.h1>
          <Text maxW="550px" fontSize="xl" textAlign="center" color="gray.500">
            저는 핸드백 해외영업으로 커리어를 시작하였지만 10년 이상을 해외
            생산현장에서 근무하면서 생산 시스템을 연구하였습니다. 그리고 IT
            업계에서는 5년 정도의 PM 및 개발 경력을 가지고 있습니다.
          </Text>
          <Stack
            direction={{ base: "column", sm: "row" }}
            w={{ base: "100%", sm: "auto" }}
            spacing={5}
          >
            <Button
              leftIcon={<FaGithub />}
              colorScheme="gray"
              variant="outline"
              rounded="md"
              size="lg"
              height="3.5rem"
              fontSize="1.2rem"
            >
              My Github
            </Button>
          </Stack>
        </Stack>
      </Container>
      {/* 내 경력 */}
      <Container p={{ base: 8, sm: 8 }}>
        <Stack direction="column" spacing={6} alignItems="center">
          <Box py={2} px={3} textAlign="center">
            <FaShoppingBag size={"40"} />
            <Text mt={"2"} color={"gray.600"}>
              산업 경력
            </Text>
          </Box>
          <chakra.h1
            fontSize={{ base: "2xl", sm: "2xl" }}
            fontWeight="bold"
            textAlign="center"
            maxW="600px"
          >
            핸드백 제조기업 근무 해외영업(5년),
            <br />
            QA 및 생산혁신(6년)
          </chakra.h1>
          <Text maxW="550px" fontSize="xl" textAlign="center" color="gray.500">
            저는 핸드백 해외영업으로 커리어를 시작하였지만 10년 이상을 해외
            생산현장에서 근무하면서 생산 시스템을 연구하였습니다. 그리고 IT
            업계에서는 5년 정도의 PM 및 개발 경력을 가지고 있습니다.
          </Text>
          <Text mt={"2"} color={"gray.600"}>
            담당 고객사
          </Text>
          <Text maxW="550px" fontSize="xl" textAlign="center" color="gray.500">
            Coach, Kate Spade, Jack Spade, Michael Kors, Ralph Lauren, Tori
            Burch, Burberry, Calvin Klein, etc
          </Text>
          <Box py={2} px={3} textAlign="center">
            <FaKeyboard size={"40"} />
            <Text mt={"2"} color={"gray.600"}>
              IT 경력
            </Text>
          </Box>
          <Text maxW="550px" fontSize="xl" textAlign="center" color="gray.500">
            생산시스템 개발 경험 (5년) MES, MRP, ERP
          </Text>
        </Stack>
      </Container>
      {/* 내 기술스택 */}
      <Container p={{ base: 8, sm: 8 }}>
        <Stack direction="column" spacing={6} alignItems="center">
          <Box py={2} px={3} textAlign="center">
            <FaCode size={"40"} />
            <Text mt={"2"} color={"gray.600"}>
              보유한 IT 기술스택
            </Text>
          </Box>

          <Text mt={"2"} color={"gray.600"}>
            웹 프로그래밍
          </Text>
          <Text maxW="550px" fontSize="xl" textAlign="center" color="gray.500">
            Python, Django, DRF, FastAPI Javascript, NodeJS, Express PostgreSQL,
            MySQL React, jQuery, HTML, CSS
          </Text>
          <Box py={2} px={3} textAlign="center">
            <Text mt={"2"} color={"gray.600"}>
              AI 딥러닝 프레임워크
            </Text>
          </Box>
          <Text maxW="550px" fontSize="xl" textAlign="center" color="gray.500">
            Scikit-learn, Tensorflow Keras, Pytorch
          </Text>
          <Box py={2} px={3} textAlign="center">
            <Text mt={"2"} color={"gray.600"}>
              데이터 분석 시각화 라이브러리
            </Text>
          </Box>
          <Text maxW="550px" fontSize="xl" textAlign="center" color="gray.500">
            Pandas, Numpy, Plotly, Matplotlib, Seaborn
          </Text>
          <Box py={2} px={3} textAlign="center">
            <Text mt={"2"} color={"gray.600"}>
              디자인 툴
            </Text>
          </Box>
          <Text maxW="550px" fontSize="xl" textAlign="center" color="gray.500">
            Adobe XD, Photoshop, Illustrator
          </Text>
          <Text maxW="550px" fontSize="xl" textAlign="center" color="gray.500">
            알고리즘은 몇 줄의 코드일 뿐이지만, 이 코드 속에는 저를 포함해
            수많은 사람의 경험과 시행착오가 모두 녹아 들어가 있습니다.
          </Text>
        </Stack>
      </Container>
    </>
  );
};

export default AboutMe;
