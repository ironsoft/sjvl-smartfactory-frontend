import {
  Box,
  Button,
  FormControl,
  FormHelperText,
  FormLabel,
  Heading,
  Input,
  Select,
  Text,
  Textarea,
  VStack,
  useToast
} from "@chakra-ui/react";
import HostOnlyPage from "../components/HostOnlyPage";
import ProtectedPage from "../components/ProtectPage";
import { useForm } from "react-hook-form";
import { useMutation } from "@tanstack/react-query";
import { uploadBlog } from "../api";
import { IArticleForm, IBlogForm } from "../types";
import { useNavigate } from "react-router-dom";

export default function UploadArticle() {
  // useForm을 이용해서 Form Handling 하기.
  // useForm은 form의 state를 관리해주는 hook이다.
  const {
    register, // input ref를 등록해주는 함수
    handleSubmit, // form submit 이벤트를 처리해주는 함수
    formState: { errors } // form의 에러를 처리해주는 함수
  } = useForm<IArticleForm>({
    mode: "onSubmit" // onSubmit 이벤트가 발생했을 때 validation 체크
  });

  const toast = useToast();
  const navigate = useNavigate();
  const mutation = useMutation({
    mutationFn: uploadBlog,
    onSuccess: (data) => {
      console.log(data);
      toast({
        title: "Blog uploaded",
        status: "success",
        duration: 5000,
        isClosable: true
      });
      navigate(`/blog/${data.id}`);
    }
  });

  const onSubmit = (data: IArticleForm) => {
    console.log(data);
    // mutation.mutate(data);
  };

  return (
    <ProtectedPage>
      <HostOnlyPage>
        <Box
          pb={40}
          mt={10}
          px={{
            base: 10,
            md: 80,
            lg: "30%"
          }}
        >
          <Heading>Upload Blog</Heading>
          <VStack
            mt={10}
            spacing={4}
            onSubmit={handleSubmit(onSubmit)}
            as={"form"}
          >
            {/* <Article Form /> */}
            <FormControl>
              <FormLabel>Content</FormLabel>
              <Input
                {...register("content", { required: true })}
                type={"text"}
                required
              />
              <FormHelperText>Article title</FormHelperText>
            </FormControl>
            <FormControl>
              <FormLabel>Category</FormLabel>
              <Select {...register("category", { required: true })} required>
                <option value="root_cause">Root Cause</option>
                <option value="corrective_action">Corrective Action</option>
              </Select>
            </FormControl>
            {mutation.isError ? (
              <Text color={"red.500"}>Something went wrong</Text>
            ) : null}
            <Button
              type={"submit"}
              isLoading={mutation.isPending}
              colorScheme={"red"}
              size="lg"
              w={"100%"}
            >
              Upload Article
            </Button>
          </VStack>
        </Box>
      </HostOnlyPage>
    </ProtectedPage>
  );
}
