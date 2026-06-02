import {
  Box,
  Button,
  Grid,
  HStack,
  Image,
  Text,
  useColorModeValue,
  useToast,
  VStack
} from "@chakra-ui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import React, { useEffect, useState } from "react";
import { FaHeart, FaRegHeart, FaStar } from "react-icons/fa";
import { Link } from "react-router-dom";
import { checkWishlist, createWishlist } from "../api";

interface IRoomProps {
  imageUrl: string;
  name: string;
  rating: number;
  city: string;
  country: string;
  price: number;
  pk: number;
  isOwner: boolean;
  refetch: () => void;
}

export default function Room({
  pk,
  imageUrl,
  name,
  rating,
  city,
  country,
  price,
  isOwner,
  refetch
}: IRoomProps) {
  // 텍스트 색상을 light mode와 dark mode에 따라 다르게 설정
  const gray = useColorModeValue("gray.600", "gray.300");

  // 아이콘 클릭시 wishlist에 추가되었다는 것을 하트 아이콘이 빨간색으로 채워지게 하기 위한 상태
  const [isAddedToWishlist, setIsAddedToWishlist] = useState(false);

  // room pk를 이용하여 wishlist에 추가 되어 있는지 확인하는 훅. wishlist에 추가 되어 있다면 isWishlisted에 true를 반환, 아니면 false를 반환.
  const {data:isWishlisted, isLoading} = useQuery({
    queryKey: ['checkWishlist', pk],
    queryFn: () => {
      return checkWishlist(String(pk));
    }
  });
  // 화면이 처음 렌더링 될 때 isLoading이 false가 되면 isWishlisted의 값을 isAddedToWishlist에 설정. isAddedToWishlist의 값이 true이면 하트 아이콘을 빨간색으로 채워진 하트로 표시하게 됨.
  useEffect(() => {
    if(!isLoading){
      setIsAddedToWishlist(isWishlisted);
    }
  }, [isWishlisted, isLoading]);


  const toast = useToast();
  // wishlist refetch를 위해 cache 삭제 queryClient
  const queryClient = useQueryClient();

  // room을 wishlist에 추가하거나 삭제하는 mutation 훅. 만약 wishlist가 존재하지 않는다면 wishlist를 생성하고 room을 추가하거나 삭제한다.
  const mutation = useMutation({
    mutationFn: createWishlist,
    onSuccess: (response) => {
      // response의 status에 따라서 room을 wishlist에 추가하거나 삭제한다.
      const {status ,data} = response;
     
      if (status === 201) {
        setIsAddedToWishlist(true); // wishlist에 추가되었다면 하트 아이콘을 빨간색으로 채워진 하트로 표시
        toast({
          title: `${data.name}'s room added to your wishlist`,
          status: "success",
          position: "top"
        });
        console.log("Room added to your wishlist");
      } else if (status === 204) {
        // wishlist에 추가되었다면 wishlist의 캐쉬를 삭제함으로써 refetch하여 화면에 반영
        // queryClient.invalidateQueries({ queryKey: ['wishList'] }); // 캐쉬를 삭제하지 않고 무력화 시키는 함수
        queryClient.removeQueries({ queryKey: ['wishList'] }); // 캐쉬를 삭제하는 함수
        // 즐겨찾기 refetch 함수 호출 
        refetch();
        
        // wishlist에 추가되어 있다면 삭제하고 하트 아이콘을 빈 하트로 표시
        setIsAddedToWishlist(false);
        toast({
          title: `Room removed from your wishlist`,
          status: "info",
          position: "top"
        });
         
        
        console.log("Room removed from your wishlist");
      }
    },
    onError: () => {
      toast({
        title: "Failed to add to wishlist",
        status: "error",
        position: "bottom-right"
      });

    }
  });

  // 하트 아이콘 클릭 시 실행되는 함수
  const onHeartClick = (event: React.SyntheticEvent<HTMLButtonElement>) => {
    event.preventDefault();
    setIsAddedToWishlist(!isAddedToWishlist);
    onAddToWishlist();
  };

  // 버튼 클릭시 wishlist에 추가하는 mutation 실행 함수
  const onAddToWishlist = () => {
    console.log("room pk", pk)
    mutation.mutate(String(pk));
  };

  return (
    <>
      <Link to={`/rooms/${pk}`}>
        <VStack spacing={"0.5"} alignItems={"flex-start"}>
          <Box
            position={"relative"}
            overflow={"hidden"}
            rounded={"3xl"}
            _hover={{
              transform: "scale(1.02)", // 마우스 오버 시에 컴포넌트 크기를 5% 증가
              transition: "transform 0.3s" // 크기 변화에 0.3초 동안의 애니메이션 효과 적용
            }}
          >
            <Image
              alt={name}
              width={{
                base: "100%",
                lg: "250px"
              }}
              height={{
                base: "100%",
                lg: "250px"
              }}
              objectFit="cover"
              src={imageUrl}
            />
            <Button
              variant={"unstyled"}
              position={"absolute"}
              top={"0"}
              right={"0"}
              color={"white"}
              onClick={onHeartClick}
              isLoading={mutation.isPending}
            > 
            {/* isAddedToWishlist의 상태에 따라 하트 아이콘을 빨간색으로 채워진 하트로 표시하거나 빈 하트로 표시 */}
              {isLoading ? null : isAddedToWishlist ? 
                <FaHeart size={"20px"} color={"red"} />
               : 
                <FaRegHeart size={"20px"} />
              }
            </Button>
          </Box>
          <Box>
            <Grid gap={"2"} templateColumns={"6fr 1fr"}>
              <Text display={"block"} as={"b"} noOfLines={1} fontSize="md">
                {name}
              </Text>
              <HStack
                _hover={{
                  color: "red.100"
                }}
                spacing={"1"}
              >
                <FaStar size={"15"} />
                <Text>{rating}</Text>
              </HStack>
            </Grid>
            <Text fontSize={"sm"} color={gray}>
              {city}, {country}
            </Text>
          </Box>
          <Text fontSize={"sm"} color={gray}>
            <Text as={"b"}>${price}</Text> / night
          </Text>
        </VStack>
      </Link>
    </>
  );
}
