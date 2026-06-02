import { Box, Grid, Heading, Text } from "@chakra-ui/react";
import { useQuery } from "@tanstack/react-query";
import { Helmet } from "react-helmet";
import { getUserWishlists } from "../api";
import { IRoomList } from "../types";
import RoomSkeleton from "../components/RoomSkeleton";
import Room from "../components/Room";

export default function WishList() {

    // 나의 위시리스트 가져오기
  const { data:myWishlistsData, isLoading, error, refetch } = useQuery({
    queryKey: ["wishList"],
    queryFn: getUserWishlists,
  });
  // 받아온 wishlists 데이터에서 rooms만 가져오기
  const rooms = myWishlistsData?.[0]?.rooms

  return (
    <>
      {/* // Helmet을 이용하여 페이지 제목 변경 */}
      <Helmet>
        <title>My Wish List</title>
      </Helmet>
      <Box
        mx="auto"
        px={{ base: "4", md: "8", lg: "12" }}
        py={{ base: "6", md: "8", lg: "8" }}
      >
        <Heading size={"md"} mb={"5"} ml={{
          base: 5,
          lg: 40
        }}>
          My Wish List
        </Heading>
        <Grid
        mt={"10"}
        px={{
          base: 10,
          lg: 40
        }}
        columnGap={"4"}
        rowGap={"8"}
        templateColumns={{
          sm: "1fr",
          md: "1fr 1fr",
          lg: "repeat(3, 1fr)",
          xl: "repeat(4, 1fr)",
          "2xl": "repeat(5, 1fr)"
        }}
      >
        {isLoading ? (
          <>
            <RoomSkeleton />
            <RoomSkeleton />
            <RoomSkeleton />
            <RoomSkeleton />
            <RoomSkeleton />
            <RoomSkeleton />
          </>
        ) : error ? (
          <Box>Error: {error.message}</Box>
        ) : rooms.length ? (
          rooms?.map((room: IRoomList, index: number) => (
            <Room
              key={index}
              pk={room.pk}
              isOwner={room.is_owner}
              imageUrl={
                room.photos[0]?.file ??
                `https://source.unsplash.com/random/450x450`
              }
              name={room.name}
              rating={room.rating}
              city={room.city}
              country={room.country}
              price={room.price}
              refetch={refetch}
            />
          ))
        ) : (
          <Text>No Wish lists You've added.</Text>
        )}
      </Grid>
      </Box>
    </>
  );
}
