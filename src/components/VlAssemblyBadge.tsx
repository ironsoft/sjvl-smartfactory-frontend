import { Badge, HStack, type BadgeProps } from "@chakra-ui/react";

const VL_LABELS = {
  vlSj: "VL SJ",
  vlModule: "VL M",
  vlProcess: "VL P",
} as const;

const VL_COLOR_SCHEME: Record<keyof typeof VL_LABELS, string> = {
  vlSj: "purple",
  vlModule: "blue",
  vlProcess: "teal",
};

export type VlAssemblyBadgeKind = keyof typeof VL_LABELS;

export type VlAssemblyBadgeProps = Omit<
  BadgeProps,
  "children" | "variant" | "colorScheme"
> & {
  kind: VlAssemblyBadgeKind;
};

export function VlAssemblyBadge({
  kind,
  fontSize = "xs",
  borderRadius = "md",
  px = 2,
  ...rest
}: VlAssemblyBadgeProps) {
  return (
    <Badge
      variant="solid"
      colorScheme={VL_COLOR_SCHEME[kind]}
      fontSize={fontSize}
      borderRadius={borderRadius}
      px={px}
      flexShrink={0}
      {...rest}
    >
      {VL_LABELS[kind]}
    </Badge>
  );
}

export type VlAssemblyOriginalCategory = "sj" | "module" | "process";

const ORIGINAL_SHORT: Record<VlAssemblyOriginalCategory, string> = {
  sj: "SJ",
  module: "M",
  process: "P",
};

const ORIGINAL_COLOR_SCHEME: Record<VlAssemblyOriginalCategory, string> = {
  sj: "purple",
  module: "blue",
  process: "teal",
};

type VlAssemblyOriginalReferenceBadgesProps = {
  category: VlAssemblyOriginalCategory;
  fontSize?: BadgeProps["fontSize"];
  borderRadius?: BadgeProps["borderRadius"];
  px?: BadgeProps["px"];
};

export function VlAssemblyOriginalReferenceBadges({
  category,
  fontSize = "xs",
  borderRadius = "md",
  px = 2,
}: VlAssemblyOriginalReferenceBadgesProps) {
  return (
    <HStack spacing={1} flexShrink={0} align="center">
      <Badge
        variant="outline"
        colorScheme="gray"
        fontSize={fontSize}
        borderRadius={borderRadius}
        px={px}
      >
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
