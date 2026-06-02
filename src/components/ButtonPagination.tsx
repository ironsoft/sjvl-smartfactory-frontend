import { Flex } from "@chakra-ui/react";
import PaginationButton from "./PaginationButton";

interface ReviewPaginationProps {
  currentPage: number;
  totalPage: number;
  paginate: (pageNumber: number) => void;
}

export default function ButtonPagination({
  currentPage,
  totalPage,
  paginate
}: ReviewPaginationProps) {
  return (
    <Flex
      as="nav"
      aria-label="Pagination"
      w="full"
      justifyContent="center"
      alignItems="center"
      mt={{ base: 3, md: 0 }}
    >
      {/* 이전 버튼 */}
      <PaginationButton
        onClick={() => paginate(Math.max(1, currentPage - 1))} // 클릭하면 이전 페이지로 이동
        isDisabled={currentPage === 1} // 현재 페이지가 첫 페이지면 비활성화
        borderTopLeftRadius="md"
        borderBottomLeftRadius="md"
      >
        이전
      </PaginationButton>
      {/* 중간에 있는 페이지들 */}
      {Number.isInteger(totalPage) && totalPage > 0 // totalPage가 정수이고 0보다 크면
        ? Array.from(
            { length: totalPage },
            (
              _,
              index // totalPage 길이만큼 배열을 만들고 각 요소에 index를 부여합니다.
            ) => (
              <PaginationButton
                key={index + 1}
                onClick={() => paginate(index + 1)} // 클릭하면 해당 페이지로 이동
                isActive={index + 1 === currentPage} // index는 0부터 시작하므로 1을 더해줍니다.
              >
                {index + 1}
              </PaginationButton>
            )
          )
        : null}
      {/* 다음 버튼 */}
      <PaginationButton
        onClick={() => paginate(Math.min(totalPage, currentPage + 1))} // 클락하면 다음페이지로 이동
        isDisabled={currentPage === totalPage} // 현재 페이지가 마지막 페이지면 비활성화
        borderTopRightRadius="md"
        borderBottomRightRadius="md"
      >
        다음
      </PaginationButton>
    </Flex>
  );
}
