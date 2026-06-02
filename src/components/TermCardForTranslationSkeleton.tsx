import { Box, Flex, HStack, Skeleton, VStack } from "@chakra-ui/react";

export default function TermCardForTranslationSkeleton() {
  return (
    <Box>
      <HStack spacing={5} mb={7}>
        <Skeleton rounded="xl" height={"140px"} width={"200px"} />
        <VStack spacing={5} align="flex-start">
          <Skeleton rounded="lg" width="100px" height={5} />
          <Skeleton rounded="lg" width="150px" height={5} mb={1} />
          <Skeleton rounded="lg" width="150px" height={5} mb={1} />
        </VStack>
      </HStack>
    </Box>
  );
}
