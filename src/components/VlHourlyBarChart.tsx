import { Box, Flex, Text, Tooltip, useColorModeValue } from "@chakra-ui/react";
import { useTranslation } from "react-i18next";
import { DAY_SLOTS, OT_SLOTS } from "../routes/VlFactoryLive";
import type { VlLiveHourly } from "../api";

const H_TO_TIME: Record<number, string> = {
  7: "07:00", 8: "08:00", 9: "09:00", 10: "10:00", 11: "11:00",
  13: "13:00", 14: "14:00", 15: "15:00",
  16: "16:00", 17: "17:00", 18: "18:00", 19: "19:00", 20: "20:00",
};

interface VlHourlyBarChartProps {
  hourly: VlLiveHourly[] | undefined;
  target: number | null;
  /** 막대 영역 높이 (px), 기본 160 */
  barAreaH?: number;
  /** 라벨 폰트 크기, 기본 "xs" */
  labelSize?: string;
}

export default function VlHourlyBarChart({
  hourly,
  target,
  barAreaH = 160,
  labelSize = "xs",
}: VlHourlyBarChartProps) {
  const { t } = useTranslation();
  const labelColor = useColorModeValue("gray.500", "gray.400");
  const dividerColor = useColorModeValue("gray.300", "gray.500");
  const targetTrackBg = useColorModeValue("gray.100", "gray.700");
  const emptyBarBg = useColorModeValue("gray.200", "gray.600");

  const hourMap: Record<number, number> = {};
  for (const e of hourly ?? []) hourMap[e.h] = e.qty;

  const allSlots = [...DAY_SLOTS, ...OT_SLOTS];
  const hasTarget = target != null && target > 0;
  const maxQty = Math.max(...allSlots.map((s) => hourMap[s.h] ?? 0), target ?? 0, 1);

  const renderSlot = (label: string, h: number) => {
    const qty = hourMap[h] ?? 0;
    const pct = hasTarget ? Math.min((qty / target!) * 100, 999) : null;
    const meets = pct != null && pct >= 100;
    const barH = qty > 0 ? Math.max((qty / maxQty) * barAreaH, 4) : 0;
    const targetH = hasTarget ? (target! / maxQty) * barAreaH : 0;
    const tooltipLabel = hasTarget
      ? t("vlFactoryLive.slotTooltipWithTarget", { label, time: H_TO_TIME[h], qty: qty.toLocaleString(), target, pct: (pct ?? 0).toFixed(0) })
      : t("vlFactoryLive.slotTooltip", { label, time: H_TO_TIME[h], qty: qty.toLocaleString() });

    const barColor = qty === 0
      ? emptyBarBg
      : meets || !hasTarget
        ? "green.400"
        : "orange.400";

    return (
      <Tooltip key={label} label={tooltipLabel} hasArrow placement="top">
        <Flex direction="column" align="center" flex={1} minW={0} cursor="default" gap={0}>
          {/* 수량 레이블 */}
          <Text
            fontSize={labelSize === "xs" ? "10px" : "xs"}
            fontWeight="bold"
            color={qty > 0 ? (meets || !hasTarget ? "green.500" : "orange.500") : labelColor}
            lineHeight={1}
            mb="2px"
            minH="14px"
            sx={{ fontVariantNumeric: "tabular-nums" }}
          >
            {qty > 0 ? qty.toLocaleString() : ""}
          </Text>

          {/* 막대 영역 */}
          <Box position="relative" w="100%" h={`${barAreaH}px`} flexShrink={0}>
            {/* 목표 높이 배경 트랙 */}
            {hasTarget && (
              <Box
                position="absolute"
                bottom={0}
                left="10%"
                right="10%"
                h={`${targetH}px`}
                bg={targetTrackBg}
                borderTopRadius="sm"
              />
            )}
            {/* 실제 막대 */}
            <Box
              position="absolute"
              bottom={0}
              left="10%"
              right="10%"
              h={qty > 0 ? `${barH}px` : "3px"}
              bg={barColor}
              borderTopRadius="md"
              transition="height 0.3s"
            />
            {/* 목표선 */}
            {hasTarget && (
              <Box
                position="absolute"
                bottom={`${targetH}px`}
                left={0}
                right={0}
                h="2px"
                bg="red.400"
                opacity={0.7}
              />
            )}
            {/* 달성률 텍스트 (막대 내부 또는 하단) */}
            {hasTarget && qty > 0 && (
              <Text
                position="absolute"
                bottom={barH > 20 ? "4px" : `${barH + 2}px`}
                left={0}
                right={0}
                textAlign="center"
                fontSize="9px"
                fontWeight="bold"
                color={barH > 20 ? "white" : (meets ? "green.500" : "orange.500")}
                lineHeight={1}
                sx={{ fontVariantNumeric: "tabular-nums" }}
              >
                {(pct ?? 0).toFixed(0)}%
              </Text>
            )}
          </Box>

          {/* 슬롯명 + 시간 */}
          <Text fontSize={labelSize} fontWeight="bold" color={labelColor} lineHeight={1} mt="4px">
            {label}
          </Text>
          <Text fontSize="9px" color={labelColor} lineHeight={1} mt="1px" opacity={0.8}>
            {H_TO_TIME[h]}
          </Text>
        </Flex>
      </Tooltip>
    );
  };

  return (
    <Box w="100%">
      {/* 목표선 레이블 (상단) */}
      {hasTarget && (
        <Flex justify="flex-end" mb={1}>
          <Text fontSize="9px" color="red.400" fontWeight="bold">
            {t("vlFactoryLive.targetPerHour", { target })}
          </Text>
        </Flex>
      )}
      <Flex align="flex-end" gap={1} w="100%">
        {DAY_SLOTS.map((s) => renderSlot(s.label, s.h))}
        {/* D / OT 구분선 */}
        <Box w="2px" bg={dividerColor} h={`${barAreaH + 30}px`} borderRadius="full" flexShrink={0} alignSelf="flex-end" mb="22px" />
        {OT_SLOTS.map((s) => renderSlot(s.label, s.h))}
      </Flex>
    </Box>
  );
}
