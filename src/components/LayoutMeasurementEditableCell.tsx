import { Input, Td, Text, useColorModeValue, useToast } from "@chakra-ui/react";
import { useState } from "react";

/** % change chip next to a measured value vs original (green = better). */
export function layoutMeasurementPctDiff(value: number, original: number | null, higherIsBetter: boolean) {
  if (original == null) return null;
  const diff = value - original;
  if (Math.abs(diff) < 1e-9) return null;
  const isGood = higherIsBetter ? diff > 0 : diff < 0;
  const pct = original !== 0 ? (diff / Math.abs(original)) * 100 : null;
  if (pct == null) return null;
  return (
    <Text as="span" fontSize="0.65rem" fontWeight="semibold" color={isGood ? "green.500" : "red.500"} ml={1}>
      ({pct > 0 ? "+" : ""}
      {pct.toFixed(1)}%)
    </Text>
  );
}

/** Click-to-edit numeric cell for Original / VL measurement Cycle & Manpower. */
export function LayoutMeasurementEditableCell({
  value,
  bg,
  format,
  onSave,
  extra
}: {
  value: number | null;
  bg?: string;
  format: (n: number) => string;
  onSave: (v: number | null) => Promise<void>;
  extra?: React.ReactNode;
}) {
  const toast = useToast();
  const hoverBg = useColorModeValue("blackAlpha.50", "whiteAlpha.100");
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const startEdit = () => {
    setDraft(value != null ? String(value) : "");
    setIsEditing(true);
  };

  const commit = async () => {
    const raw = draft.trim();
    const parsed = raw === "" ? null : Number(raw);
    if (parsed != null && !Number.isFinite(parsed)) {
      toast({ title: "Invalid number", status: "warning", duration: 1500, position: "bottom-right" });
      return;
    }
    if (parsed === value || (parsed == null && value == null)) {
      setIsEditing(false);
      return;
    }
    setIsSaving(true);
    try {
      await onSave(parsed);
      setIsEditing(false);
    } catch {
      toast({ title: "Save failed", status: "error", duration: 2000, position: "bottom-right" });
    } finally {
      setIsSaving(false);
    }
  };

  if (isEditing) {
    return (
      <Td isNumeric fontSize="xs" bg={bg} p={1}>
        <Input
          size="xs"
          w="72px"
          textAlign="right"
          type="number"
          autoFocus
          value={draft}
          isDisabled={isSaving}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => void commit()}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
            if (e.key === "Escape") setIsEditing(false);
          }}
        />
      </Td>
    );
  }

  return (
    <Td isNumeric fontSize="xs" bg={bg} cursor="pointer" _hover={{ bg: hoverBg }} onClick={startEdit}>
      {value != null ? format(value) : <Text as="span" color="gray.400">—</Text>}
      {value != null ? extra : null}
    </Td>
  );
}
