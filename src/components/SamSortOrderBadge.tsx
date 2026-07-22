import { Badge, Text } from "@chakra-ui/react";

/** 공정 sort_order — 짧은 칩형 배지 */
export function SamSortOrderBadge({
  sortOrder,
  size = "sm"
}: {
  sortOrder: number | null | undefined;
  /** 테이블: sm, 상세 헤더: md, 아주 작게(다른 번호와 헷갈리지 않아야 할 때): xs */
  size?: "xs" | "sm" | "md";
}) {
  if (sortOrder == null || !Number.isFinite(sortOrder)) {
    return (
      <Text as="span" color="gray.400" fontSize="xs">
        —
      </Text>
    );
  }
  const n = Math.max(0, Math.floor(sortOrder));
  const label = String(n);

  if (size === "xs") {
    return (
      <Text as="span" fontSize="0.55rem" color="gray.400" lineHeight={1}>
        {label}
      </Text>
    );
  }

  return (
    <Badge
      borderRadius="full"
      px={2}
      py={0.5}
      fontSize={size === "md" ? "sm" : "xs"}
      fontWeight="semibold"
      colorScheme="gray"
      variant="subtle"
    >
      {label}
    </Badge>
  );
}

/** 이전 이름 호환 — `SamSortOrderBall` 참조가 남은 파일용 */
export const SamSortOrderBall = SamSortOrderBadge;
