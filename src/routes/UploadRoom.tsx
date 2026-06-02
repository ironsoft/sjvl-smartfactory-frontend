import {
  Box,
  Button,
  Checkbox,
  Container,
  FormControl,
  FormHelperText,
  FormLabel,
  Grid,
  Heading,
  IconButton,
  Input,
  InputGroup,
  InputLeftAddon,
  InputRightAddon,
  Select,
  Text,
  Textarea,
  useToast,
  VStack
} from "@chakra-ui/react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { set, useForm } from "react-hook-form";
import { FaBath, FaBed, FaDollarSign, FaPeopleCarry, FaSearch, FaUserAstronaut } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import {
  getAmenities,
  getRoomCategories,
  IUploadRoomVariables,
  uploadRoom
} from "../api";
import HostOnlyPage from "../components/HostOnlyPage";
import ProtectedPage from "../components/ProtectPage";
import { IAmenity, ICategory, IRoomDetail } from "../types";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

export default function UploadRoom() {
  // i18n
  const {t} = useTranslation();

  // Manager state
  const [manager, setManager] = useState("");
  console.log("manager", manager);

  // Form handling
  const { register, handleSubmit, setValue, formState: {errors} } = useForm<IUploadRoomVariables>({
    mode: "onSubmit"
  });

  const toast = useToast();
  const navigate = useNavigate();

  // Room upload mutation 
  const mutation = useMutation({
    mutationFn: uploadRoom,
    onSuccess: (data: IRoomDetail) => {
      toast({
        status: "success",
        title: "Room created",
        position: "bottom-right"
      });
      navigate(`/rooms/${data?.id}`);
    }
  });
  // Fetching amenities 
  const { data: amenities, isLoading: isAmenitiesLoading } = useQuery<
    IAmenity[]
  >({
    queryKey: ["amenities"],
    queryFn: getAmenities
  });
  // Fetching categories
  const { data: categories, isLoading: isCategoriesLoading } = useQuery<
    ICategory[]
  >({
    queryKey: ["categories"],
    queryFn: getRoomCategories
  });
  
  // Manager 창에서 사용자 정보를 받아오기 위한 이벤트 리스너
  useEffect(() => {
    const messageHandler = (event: MessageEvent) => {
      // 입력을 위해 열린 창인지 도메인 확인 후 아니면 무시
      if (event.origin !== window.location.origin) return;

      // 부모창으로부터 받은 사용자 정보를 상태에 저장
      const userId = event.data.userId;
      // 사용자 정보가 있으면 상태와 폼에 저장
      if (userId) {
          // 사용자 정보를 상태에 저장
          setManager(userId.toString());
          // 폼에도 사용자 정보를 입력
          setValue("manager", userId.toString());
      }
  }
    // 메시지 이벤트 리스너 등록
    window.addEventListener('message', messageHandler);

    return () => {
      // 컴포넌트가 언마운트 될 때 리스너 제거
      window.removeEventListener('message', messageHandler);
    };
  }, [setValue]); // setValue가 변경될 때마다 useEffect가 실행되도록 함

  // 매니저 검색창 열기
  const onSearchManager = () => {
    window.open('/users', '_blank', 'height=600,width=800');
  };

  // Room upload form submit
  const onSubmit = (data: IUploadRoomVariables) => {
    mutation.mutate({ ...data, manager }); // manager 정보도 함께 전송
  };


  return (
    <ProtectedPage>
      <HostOnlyPage>
        <Box
          pb={"40"}
          mt={"10"}
          px={{
            base: 10,
            lg: 80
          }}
        >
          <Container>
            <Heading textAlign={"center"}>{t("uploadRoom.heading")}</Heading>
            <VStack
              spacing={"10"}
              as={"form"}
              mt={"5"}
              onSubmit={handleSubmit(onSubmit)}
            >
              <FormControl>
                <FormLabel>{t("uploadRoom.name")}</FormLabel>
                <Input
                  {...register("name", { required: true })}
                  required
                  type={"text"}
                />
                <FormHelperText>{t("uploadRoom.name_helptext")}</FormHelperText>
              </FormControl>
              <FormControl>
                <FormLabel>{t("uploadRoom.country")}</FormLabel>
                <Input
                  {...register("country", { required: true })}
                  required
                  type={"text"}
                />
              </FormControl>
              <FormControl>
                <FormLabel>{t("uploadRoom.city")}</FormLabel>
                <Input
                  {...register("city", { required: true })}
                  required
                  type={"text"}
                />
              </FormControl>
              <FormControl>
                <FormLabel>{t("uploadRoom.address")}</FormLabel>
                <Input
                  {...register("address", { required: true })}
                  required
                  type={"text"}
                />
              </FormControl>
              <FormControl>
                <FormLabel>{t("uploadRoom.price")}</FormLabel>
                <InputGroup>
                  <InputLeftAddon children={<FaDollarSign />} />
                  <Input
                    {...register("price", { required: true })}
                    required
                    type={"number"}
                    min={"0"}
                  />
                </InputGroup>
              </FormControl>
              <FormControl>
                <FormLabel>{t("uploadRoom.rooms")}</FormLabel>
                <InputGroup>
                  <InputLeftAddon children={<FaBed />} />
                  <Input
                    {...register("rooms", { required: true })}
                    required
                    type={"number"}
                    min={"0"}
                  />
                </InputGroup>
              </FormControl>
              {/* 매니저 입력 */}
              <FormControl>
                <FormLabel>{t("uploadRoom.manager")}</FormLabel>
                <InputGroup>
                  <InputLeftAddon children={<FaUserAstronaut />} />
                  <Input
                    {...register("manager", { required: "This is required." })}
                    required
                    type={"text"}
                    min={"0"}
                    value={manager}
                    readOnly // 사용자가 직접 입력하지 못하도록 함
                  />
                  <IconButton 
                    ml={"3"} 
                    aria-label="Search database"  
                    icon={<FaSearch />} 
                    onClick={onSearchManager}
                  />
                </InputGroup>
                   <FormHelperText>{t("uploadRoom.manager_helptext")}</FormHelperText>

              </FormControl>
              <FormControl>
                <FormLabel>{t("uploadRoom.toilets")}</FormLabel>
                <InputGroup>
                  <InputLeftAddon children={<FaBath />} />
                  <Input
                    {...register("toilets", { required: true })}
                    type={"number"}
                    min={"0"}
                  />
                </InputGroup>
              </FormControl>
              <FormControl>
                <FormLabel>{t("uploadRoom.description")}</FormLabel>
                <Textarea {...register("description", { required: true })} />
              </FormControl>
              <FormControl>
              <Checkbox 
                {...register("pet_friendly", { required: true })}
                type="checkbox"
              >
                {t("uploadRoom.petFriendly")}
              </Checkbox>
              </FormControl>
              <FormControl>
                <FormLabel>{t("uploadRoom.kindOfRoom")}</FormLabel>
                <Select
                  {...register("kind", { required: true })}
                  placeholder="Choose a kind"
                >
                  <option value={"entire_place"}>{t("uploadRoom.entireplace")}</option>
                  <option value={"private_room"}>{t("uploadRoom.privateplace")}</option>
                  <option value={"shared_room"}>{t("uploadRoom.sharedroom")}</option>
                </Select>
                <FormHelperText>
                  What kind of room are you renting?
                </FormHelperText>
              </FormControl>
              <FormControl>
                <FormLabel>{t("uploadRoom.category")}</FormLabel>
                <Select
                  {...register("category", { required: true })}
                  placeholder="Choose a kind"
                >
                  {categories?.map((category) => (
                    <option key={category.pk} value={category.pk}>
                      {category.name}
                    </option>
                  ))}
                </Select>
                <FormHelperText>
                {t("uploadRoom.category_helptext")}
                </FormHelperText>
              </FormControl>
              <FormControl>
                <FormLabel>{t("uploadRoom.amenities")}</FormLabel>
                <Grid templateColumns={"1fr 1fr"} gap={5}>
                  {amenities?.map((amenity) => (
                    <Box key={amenity.pk}>
                      <Checkbox
                        value={amenity.pk}
                        {...register("amenities", { required: true })}
                      >
                        {amenity.name}
                      </Checkbox>
                      <FormHelperText>{amenity.description}</FormHelperText>
                    </Box>
                  ))}
                </Grid>
              </FormControl>
              {mutation.isError ? (
                <Text color={"read.500"}>Something went wrong</Text>
              ) : null}
              <Button
                type="submit"
                isLoading={mutation.isPending}
                colorScheme={"red"}
                size="lg"
                w={"100%"}
              >
                {t("uploadRoom.uploadButton")}
              </Button>
            </VStack>
          </Container>
        </Box>
      </HostOnlyPage>
    </ProtectedPage>
  );
}
