import { Badge, HStack, type BadgeProps } from "@chakra-ui/react";

const EP_LABELS = {
  epSj: "EP SJ",
  epModule: "EP M",
  epProcess: "EP P",
} as const;

/** EP 복사본 — SJ / Module / Process 서로 다른 solid 색 */
const EP_COLOR_SCHEME: Record<keyof typeof EP_LABELS, string> = {
  epSj: "purple",
  epModule: "blue",
  epProcess: "teal",
};

export type EpBadgeKind = keyof typeof EP_LABELS;

export type EpBadgeProps = Omit<BadgeProps, "children" | "variant" | "colorScheme"> & {
  kind: EpBadgeKind;
};

export function EpBadge({
  kind,
  fontSize = "xs",
  borderRadius = "md",
  px = 2,
  ...rest
}: EpBadgeProps) {
  return (
    <Badge
      variant="solid"
      colorScheme={EP_COLOR_SCHEME[kind]}
      fontSize={fontSize}
      borderRadius={borderRadius}
      px={px}
      flexShrink={0}
      {...rest}
    >
      {EP_LABELS[kind]}
    </Badge>
  );
}

export type EpOriginalCategory = "sj" | "module" | "process";

const ORIGINAL_SHORT: Record<EpOriginalCategory, string> = {
  sj: "SJ",
  module: "M",
  process: "P",
};

const ORIGINAL_COLOR_SCHEME: Record<EpOriginalCategory, string> = {
  sj: "purple",
  module: "blue",
  process: "teal",
};

type EpOriginalReferenceBadgesProps = {
  category: EpOriginalCategory;
  fontSize?: BadgeProps["fontSize"];
  borderRadius?: BadgeProps["borderRadius"];
  px?: BadgeProps["px"];
};

/** 원본 참조: `Original`(회색 outline) + 유형(SJ/M/P, 해당 색 outline) */
export function EpOriginalReferenceBadges({
  category,
  fontSize = "xs",
  borderRadius = "md",
  px = 2,
}: EpOriginalReferenceBadgesProps) {
  return (
    <HStack spacing={1} flexShrink={0} align="center">
      <Badge variant="outline" colorScheme="gray" fontSize={fontSize} borderRadius={borderRadius} px={px}>
        Original
      </Badge>
      <Badge
        variant="outline"
        colorScheme={ORIGINAL_COLOR_SCHEME[category]}
        fontSize={fontSize}
        borderRadius={borderRadius}
        px={px}
      >
        {ORIGINAL_SHORT[category]}
      </Badge>
    </HStack>
  );
}
