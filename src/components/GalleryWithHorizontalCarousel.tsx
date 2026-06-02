import React, { useRef } from "react";
import { Flex, Box, IconButton, useBreakpointValue } from "@chakra-ui/react";
import { FaAngleLeft, FaAngleRight } from "react-icons/fa";

interface GalleryWithHorizontalCarouselProps {
  images: string[];
}

const GalleryWithHorizontalCarousel: React.FC<
  GalleryWithHorizontalCarouselProps
> = ({ images }) => {
  const scrollContainer = useRef<HTMLDivElement | null>(null);

  const scrollAmount = useBreakpointValue({ base: 200, md: 400, lg: 600 });

  const scroll = (direction: "left" | "right") => {
    const { current } = scrollContainer;
    if (current) {
      const safeScrollAmount = scrollAmount || 0;
      const scrollValue =
        direction === "left" ? -safeScrollAmount : safeScrollAmount;
      current.scrollBy({ left: scrollValue, behavior: "smooth" });
    }
  };

  return (
    <Flex
      alignItems="center"
      justifyContent="center"
      overflow="hidden"
      position="relative"
    >
      <IconButton
        aria-label="Scroll left"
        icon={<FaAngleLeft />}
        position="absolute"
        left="0"
        zIndex="2"
        onClick={() => scroll("left")}
      />
      <Flex
        ref={scrollContainer}
        overflowX="scroll"
        scrollSnapType="x mandatory"
        gap="2"
        p="4"
      >
        {images.map((image, index) => (
          <Box
            key={index}
            flex="0 0 auto"
            width={{ base: "100%", md: "md", lg: "lg" }}
            scrollSnapAlign="start"
            backgroundImage={`url(${image})`}
            backgroundSize="cover"
            backgroundPosition="center"
            height="450px"
            borderRadius="md"
          />
        ))}
      </Flex>
      <IconButton
        aria-label="Scroll right"
        icon={<FaAngleRight />}
        position="absolute"
        right="0"
        zIndex="2"
        onClick={() => scroll("right")}
      />
    </Flex>
  );
};

export default GalleryWithHorizontalCarousel;
