import type { CSSProperties } from "react";
import { Badge, type BadgeProps } from "@chakra-ui/react";

/** EP Status — 메뉴/ API 값(not_started …) 기준 색 (solid 배지 + 텍스트) */
export const STATUS_CONFIG: Record<string, { bg: string; color: string }> = {
  not_started: { bg: "gray.500", color: "white" },
  outsourced: { bg: "purple.500", color: "white" },
  in_progress: { bg: "blue.500", color: "white" },
  completed: { bg: "green.500", color: "white" },
  not_ready: { bg: "red.500", color: "white" },
};

function chakraColorVar(token: string): string {
  return `var(--chakra-colors-${token.replace(".", "-")})`;
}

/** native `<option>` 용 — 드롭다운 선택지 색 */
export function statusOptionStyle(status: string): CSSProperties {
  const c = STATUS_CONFIG[status] ?? STATUS_CONFIG.not_started;
  return {
    backgroundColor: chakraColorVar(c.bg),
    color: chakraColorVar(c.color),
  };
}

/** EpScheduleList 등 — Chakra `Select` 닫힌 상태에서도 상태색이 보이도록 (option 스타일만으로는 브라우저가 무시하는 경우가 많음) */
export function statusSelectFieldProps(status: string) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.not_started;
  return {
    bg: cfg.bg,
    color: cfg.color,
    iconColor: cfg.color,
    borderColor: "transparent",
    fontWeight: "semibold" as const,
    borderRadius: "md",
    cursor: "pointer" as const,
  };
}

type StatusBadgeProps = {
  status: string;
  children?: React.ReactNode;
} & Omit<BadgeProps, "children">;

export function StatusBadge({ status, children, fontSize = "xs", ...rest }: StatusBadgeProps) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.not_started;
  return (
    <Badge variant="solid" bg={cfg.bg} color={cfg.color} fontSize={fontSize} px={2} borderRadius="md" {...rest}>
      {children}
    </Badge>
  );
}
