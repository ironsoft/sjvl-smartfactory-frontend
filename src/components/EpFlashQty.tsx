import { Text, TextProps, useColorModeValue } from "@chakra-ui/react";
import { useEffect, useRef, useState } from "react";

type EpFlashQtyProps = {
  /** 비교용 숫자 — 바뀌면 한 번만 플래시 */
  value: number;
} & TextProps;

/**
 * EP Real-time Production 등에서 output_qty가 갱신될 때
 * 배경·살짝 확대로 변화를 눈에 띄게 합니다.
 */
export default function EpFlashQty({ value, children, ...rest }: EpFlashQtyProps) {
  const prev = useRef<number | null>(null);
  const [flash, setFlash] = useState(false);
  const flashBg = useColorModeValue("green.100", "green.900");
  const flashColor = useColorModeValue("green.800", "green.100");

  useEffect(() => {
    if (prev.current !== null && prev.current !== value) {
      setFlash(true);
      const t = window.setTimeout(() => setFlash(false), 750);
      prev.current = value;
      return () => window.clearTimeout(t);
    }
    prev.current = value;
  }, [value]);

  return (
    <Text
      as="span"
      display="inline-block"
      position="relative"
      zIndex={1}
      px={1}
      py={0.5}
      borderRadius="md"
      transition="background 0.4s ease, transform 0.35s ease, color 0.35s ease"
      transform={flash ? "scale(1.07)" : undefined}
      bg={flash ? flashBg : "transparent"}
      color={flash ? flashColor : undefined}
      fontWeight={flash ? "semibold" : undefined}
      {...rest}
    >
      {children}
    </Text>
  );
}
