import {
  Box,
  Button,
  HStack,
  IconButton,
  Input,
  InputGroup,
  InputRightElement,
  Popover,
  PopoverBody,
  PopoverContent,
  PopoverTrigger,
  Text,
  useColorModeValue,
} from "@chakra-ui/react";
import { useEffect, useRef, useState } from "react";
import Calendar from "react-calendar";
import "react-calendar/dist/Calendar.css";
import { useTranslation } from "react-i18next";
import { FaCalendarAlt } from "react-icons/fa";
import {
  getBcp47Locale,
  isoToLocalDate,
  localDateToIso,
} from "../lib/dateLocale";

// ── date parser ────────────────────────────────────────────────────────────────

const MONTHS_EN = ["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"];
const MONTHS_VI = ["tháng 1","tháng 2","tháng 3","tháng 4","tháng 5","tháng 6","tháng 7","tháng 8","tháng 9","tháng 10","tháng 11","tháng 12"];

function _valid(y: number, m: number, d: number): boolean {
  if (y < 1900 || y > 2200 || m < 1 || m > 12 || d < 1 || d > 31) return false;
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
}

function _iso(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/**
 * Parse many Excel / locale date formats → ISO YYYY-MM-DD or null.
 * lang: "ko" | "vi" | "en" (used to break ties for ambiguous D vs M first).
 */
export function parseAnyDate(raw: string, lang = "en"): string | null {
  const s = raw.trim().replace(/ /g, " "); // NBSP → space
  if (!s) return null;

  // ── ISO: YYYY-MM-DD ───────────────────────────────────────────────────────
  if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(s)) {
    const [y, m, d] = s.split("-").map(Number);
    return _valid(y, m, d) ? _iso(y, m, d) : null;
  }

  // ── YYYY. M. D (Korean with trailing space/period) ────────────────────────
  const koCompact = s.match(/^(\d{4})[.\s]+(\d{1,2})[.\s]+(\d{1,2})\.?$/);
  if (koCompact) {
    const [, y, m, d] = koCompact.map(Number);
    return _valid(y, m, d) ? _iso(y, m, d) : null;
  }

  // ── YYYY/M/D ─────────────────────────────────────────────────────────────
  if (/^\d{4}\/\d{1,2}\/\d{1,2}$/.test(s)) {
    const [y, m, d] = s.split("/").map(Number);
    return _valid(y, m, d) ? _iso(y, m, d) : null;
  }

  // ── Korean: YYYY년 M월 D일 ─────────────────────────────────────────────────
  const koFull = s.match(/^(\d{4})\s*년\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일?$/);
  if (koFull) {
    const [, y, m, d] = koFull.map(Number);
    return _valid(y, m, d) ? _iso(y, m, d) : null;
  }

  // ── Vietnamese: ngày D tháng M năm YYYY ───────────────────────────────────
  const viFull = s.match(/ngày\s*(\d{1,2})\s*tháng\s*(\d{1,2})\s*năm\s*(\d{4})/i);
  if (viFull) {
    const d = Number(viFull[1]), m = Number(viFull[2]), y = Number(viFull[3]);
    return _valid(y, m, d) ? _iso(y, m, d) : null;
  }

  // ── English full: "June 20, 2026" or "20 June 2026" ──────────────────────
  const engMDY = s.match(/^([A-Za-z]+)\.?\s+(\d{1,2}),?\s+(\d{4})$/);
  if (engMDY) {
    const mi = MONTHS_EN.indexOf(engMDY[1].toLowerCase().slice(0, 3));
    if (mi >= 0) {
      const y = Number(engMDY[3]), m = mi + 1, d = Number(engMDY[2]);
      return _valid(y, m, d) ? _iso(y, m, d) : null;
    }
  }
  const engDMY = s.match(/^(\d{1,2})\.?\s+([A-Za-z]+),?\s+(\d{4})$/);
  if (engDMY) {
    const mi = MONTHS_EN.indexOf(engDMY[2].toLowerCase().slice(0, 3));
    if (mi >= 0) {
      const y = Number(engDMY[3]), m = mi + 1, d = Number(engDMY[1]);
      return _valid(y, m, d) ? _iso(y, m, d) : null;
    }
  }

  // ── 3-part numeric: A sep B sep C ────────────────────────────────────────
  // separators: / . - (but not the ISO YYYY-M-D already handled above)
  const three = s.match(/^(\d{1,4})\s*[/.\-]\s*(\d{1,2})\s*[/.\-]\s*(\d{1,4})$/);
  if (three) {
    const a = Number(three[1]), b = Number(three[2]), c = Number(three[3]);
    const aStr = three[1], cStr = three[3];

    // Year-first: A is 4-digit year → YYYY-M-D or YYYY/M/D or YYYY.M.D
    if (aStr.length === 4) {
      return _valid(a, b, c) ? _iso(a, b, c) : null;
    }

    // Year-last: C is 4-digit year
    if (cStr.length === 4) {
      // Unambiguous: if A > 12 → D/M/YYYY; if B > 12 → M/D/YYYY
      if (a > 12) return _valid(c, b, a) ? _iso(c, b, a) : null; // D/M/Y
      if (b > 12) return _valid(c, a, b) ? _iso(c, a, b) : null; // M/D/Y

      // Ambiguous: use language to decide
      if (lang === "vi") {
        // Vietnamese Excel: D/M/YYYY
        if (_valid(c, b, a)) return _iso(c, b, a);
        if (_valid(c, a, b)) return _iso(c, a, b);
      } else if (lang === "ko") {
        // Korean Excel rarely uses M/D/Y; try D/M then M/D
        if (_valid(c, b, a)) return _iso(c, b, a);
        if (_valid(c, a, b)) return _iso(c, a, b);
      } else {
        // English: M/D/YYYY
        if (_valid(c, a, b)) return _iso(c, a, b);
        if (_valid(c, b, a)) return _iso(c, b, a);
      }
      return null;
    }

    // 2-digit year fallback (e.g. 06/20/26)
    if (cStr.length === 2) {
      const y = c < 50 ? 2000 + c : 1900 + c;
      if (a > 12) return _valid(y, b, a) ? _iso(y, b, a) : null;
      if (b > 12) return _valid(y, a, b) ? _iso(y, a, b) : null;
      if (lang === "vi") {
        if (_valid(y, b, a)) return _iso(y, b, a);
        if (_valid(y, a, b)) return _iso(y, a, b);
      } else {
        if (_valid(y, a, b)) return _iso(y, a, b);
        if (_valid(y, b, a)) return _iso(y, b, a);
      }
    }
  }

  return null;
}

// ── component ─────────────────────────────────────────────────────────────────

export type LocalizedDateInputProps = {
  value: string;
  onChange: (isoDate: string) => void;
  onCommit?: (iso: string) => void;
  onCancel?: () => void;
  min?: string;
  max?: string;
  size?: "xs" | "sm" | "md" | "lg";
  w?: string;
  isDisabled?: boolean;
  autoFocus?: boolean;
  allowClear?: boolean;
  compact?: boolean;
  bg?: string;
  id?: string;
  "aria-label"?: string;
};

export default function LocalizedDateInput({
  value,
  onChange,
  onCommit,
  onCancel,
  min,
  max,
  size = "sm",
  w,
  isDisabled,
  autoFocus,
  allowClear = true,
  compact = false,
  bg,
  id,
  "aria-label": ariaLabel,
}: LocalizedDateInputProps) {
  const { t, i18n } = useTranslation();
  const lang = (i18n.language || "en").split("-")[0].toLowerCase();
  const locale = getBcp47Locale(i18n.language);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<string | null>(null); // null = view mode
  const [parseErr, setParseErr] = useState(false);
  const escapeRef = useRef(false);
  const skipCommitDupRef = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const isEditing = draft !== null;

  useEffect(() => {
    if (autoFocus) setOpen(true);
  }, [autoFocus]);

  useEffect(() => {
    if (open) escapeRef.current = false;
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") escapeRef.current = true;
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open]);

  const displayText =
    value && isoToLocalDate(value)
      ? new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(isoToLocalDate(value)!)
      : "";

  const handleClose = () => {
    setOpen(false);
    if (skipCommitDupRef.current) {
      skipCommitDupRef.current = false;
      return;
    }
    if (escapeRef.current) {
      escapeRef.current = false;
      onCancel?.();
      return;
    }
    onCommit?.(value);
  };

  // ── text input handlers ────────────────────────────────────────────────────

  const enterEdit = () => {
    if (isDisabled) return;
    setDraft(value || ""); // show ISO in edit mode for easy re-editing
    setParseErr(false);
  };

  const commitDraft = (text: string) => {
    if (!text) {
      if (allowClear) { onChange(""); onCommit?.(""); }
      return;
    }
    const parsed = parseAnyDate(text, lang);
    if (parsed) {
      onChange(parsed);
      onCommit?.(parsed);
    }
    // always exit edit mode; revert to previous if unparseable
  };

  const exitEdit = (commit = true) => {
    if (commit && draft !== null) commitDraft(draft);
    setDraft(null);
    setParseErr(false);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setDraft(v);
    if (!v) { setParseErr(false); return; }
    setParseErr(v.length > 3 && parseAnyDate(v, lang) === null);
  };

  const handleBlur = () => {
    if (isEditing) exitEdit(true);
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData("text");
    const parsed = parseAnyDate(pasted.trim(), lang);
    if (parsed) {
      e.preventDefault();
      skipCommitDupRef.current = true;
      onChange(parsed);
      onCommit?.(parsed);
      setDraft(null);
      setParseErr(false);
      setOpen(false);
    }
    // unparseable paste: let it land in the input normally
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      exitEdit(true);
      inputRef.current?.blur();
    } else if (e.key === "Escape") {
      e.stopPropagation();
      escapeRef.current = true;
      setDraft(null);
      setParseErr(false);
      setOpen(false);
      onCancel?.();
    } else if ((e.key === "F2" || e.key === " ") && !isEditing) {
      e.preventDefault();
      setOpen(true);
    }
  };

  const placeholder = isEditing
    ? lang === "ko" ? "2026.6.20 또는 2026-06-20" : lang === "vi" ? "20/06/2026" : "2026.6.20 or 6/20/2026"
    : t("ep.common.selectDate");

  const minD = min ? isoToLocalDate(min) ?? undefined : undefined;
  const maxD = max ? isoToLocalDate(max) ?? undefined : undefined;
  const calValue = value ? isoToLocalDate(value) : null;

  const inputEl = (
    <Input
      ref={inputRef}
      id={id}
      size={size}
      cursor={isDisabled ? "not-allowed" : "text"}
      value={isEditing ? draft! : displayText}
      placeholder={placeholder}
      isDisabled={isDisabled}
      aria-label={ariaLabel ?? t("ep.common.selectDateAria")}
      isReadOnly={false}
      onChange={handleChange}
      onFocus={() => {
        if (!isEditing) enterEdit();
        // close calendar if open so typing is unobstructed
        if (open) setOpen(false);
      }}
      onBlur={handleBlur}
      onPaste={handlePaste}
      onKeyDown={handleKeyDown}
      bg={bg}
      borderColor={parseErr ? "red.400" : undefined}
      _focus={parseErr ? { borderColor: "red.500", boxShadow: "0 0 0 1px var(--chakra-colors-red-500)" } : undefined}
      autoComplete="off"
      spellCheck={false}
    />
  );

  return (
    <Box position="relative" w={w}>
      {/* ── text input (completely separate from Popover) ── */}
      {compact ? (
        <Box>{inputEl}</Box>
      ) : (
        <InputGroup size={size}>
          {inputEl}
          <InputRightElement width="2.2rem" pointerEvents="auto">
            <IconButton
              aria-label={t("ep.common.openCalendar")}
              icon={<FaCalendarAlt />}
              size="xs"
              variant="ghost"
              isDisabled={isDisabled}
              onMouseDown={(e) => {
                e.preventDefault(); // prevent input blur
                if (!isDisabled) {
                  exitEdit(true);
                  setOpen((o) => !o);
                }
              }}
            />
          </InputRightElement>
        </InputGroup>
      )}

      {/* ── calendar popover anchored to bottom of input ── */}
      <Popover
        isOpen={open}
        onClose={handleClose}
        placement="bottom-start"
        closeOnBlur
        closeOnEsc
        matchWidth={false}
      >
        {/* invisible anchor sits at the bottom of the input */}
        <PopoverTrigger>
          <Box position="absolute" bottom={0} left={0} w="100%" h="1px" pointerEvents="none" />
        </PopoverTrigger>
        <PopoverContent w="auto" maxW="100vw">
          <PopoverBody p={2}>
            <Box
              sx={{
                ".react-calendar": { width: "100%", maxWidth: "320px", background: useColorModeValue("white", "gray.800"), border: "none", fontFamily: "inherit" },
                ".react-calendar__navigation": { marginBottom: "0.5rem" },
                ".react-calendar__navigation button": { color: useColorModeValue("gray.600", "gray.300"), minWidth: "36px" },
                ".react-calendar__month-view__weekdays": { fontSize: "0.7rem", textTransform: "none" },
                ".react-calendar__tile": { borderRadius: "md" },
                ".react-calendar__tile:enabled:hover, .react-calendar__tile:enabled:focus": { background: useColorModeValue("gray.100", "gray.700") },
                ".react-calendar__tile--active": { background: `${useColorModeValue("blue.500", "blue.400")} !important`, color: "white !important" },
              }}
            >
              <Calendar
                locale={locale}
                value={calValue}
                minDate={minD}
                maxDate={maxD}
                minDetail="month"
                prev2Label={null}
                next2Label={null}
                formatDay={locale === "ko-KR" ? (_l, date) => String(date.getDate()) : undefined}
                formatLongDate={locale === "ko-KR" ? (_l, date) => new Intl.DateTimeFormat("en-US", { year: "numeric", month: "long", day: "numeric" }).format(date) : undefined}
                onChange={(v) => {
                  if (v instanceof Date) {
                    const iso = localDateToIso(v);
                    skipCommitDupRef.current = true;
                    onChange(iso);
                    setOpen(false);
                    onCommit?.(iso);
                    setDraft(null);
                    setParseErr(false);
                  }
                }}
              />
            </Box>
            {allowClear && (
              <HStack justify="flex-end" mt={2}>
                <Button
                  size="xs"
                  variant="ghost"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    skipCommitDupRef.current = true;
                    onChange("");
                    setOpen(false);
                    onCommit?.("");
                    setDraft(null);
                    setParseErr(false);
                  }}
                >
                  {t("ep.common.clearDate")}
                </Button>
              </HStack>
            )}
          </PopoverBody>
        </PopoverContent>
      </Popover>
      {parseErr && (
        <Text fontSize="2xs" color="red.400" position="absolute" bottom="-1.2em" left={0} whiteSpace="nowrap" pointerEvents="none">
          {lang === "ko" ? "날짜 형식을 인식할 수 없습니다" : lang === "vi" ? "Định dạng ngày không hợp lệ" : "Unrecognized date format"}
        </Text>
      )}
    </Box>
  );
}
