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

export type LocalizedDateInputProps = {
  value: string;
  onChange: (isoDate: string) => void;
  /** Inline editors: save with the ISO date (picker selection, clear, or backdrop close). */
  onCommit?: (iso: string) => void;
  /** Inline editors: Escape — discard without save. */
  onCancel?: () => void;
  min?: string;
  max?: string;
  size?: "xs" | "sm" | "md" | "lg";
  w?: string;
  isDisabled?: boolean;
  autoFocus?: boolean;
  allowClear?: boolean;
  /** Narrow cells: no calendar icon column (still opens on click). */
  compact?: boolean;
  /** Chakra Input background (e.g. card surface on filters). */
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
  const locale = getBcp47Locale(i18n.language);
  const [open, setOpen] = useState(false);
  const escapeRef = useRef(false);
  const skipCommitDupRef = useRef(false);

  const tileBg = useColorModeValue("white", "gray.800");
  const tileHover = useColorModeValue("gray.100", "gray.700");
  const navBtn = useColorModeValue("gray.600", "gray.300");
  const activeBg = useColorModeValue("blue.500", "blue.400");

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
      ? new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(
          isoToLocalDate(value)!
        )
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

  const minD = min ? isoToLocalDate(min) ?? undefined : undefined;
  const maxD = max ? isoToLocalDate(max) ?? undefined : undefined;
  const calValue = value ? isoToLocalDate(value) : null;

  const inputEl = (
    <Input
      id={id}
      readOnly
      size={size}
      cursor={isDisabled ? "not-allowed" : "pointer"}
      value={displayText}
      placeholder={t("ep.common.selectDate")}
      onClick={() => !isDisabled && setOpen(true)}
      isDisabled={isDisabled}
      aria-label={ariaLabel ?? t("ep.common.selectDateAria")}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          escapeRef.current = true;
          setOpen(false);
          onCancel?.();
        }
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          if (!isDisabled) setOpen(true);
        }
      }}
      bg={bg}
    />
  );

  return (
    <Popover
      isOpen={open}
      onClose={handleClose}
      onOpen={() => setOpen(true)}
      placement="bottom-start"
      closeOnBlur
      closeOnEsc
      matchWidth={false}
    >
      <PopoverTrigger>
        {compact ? (
          <Box w={w}>{inputEl}</Box>
        ) : (
          <InputGroup size={size} w={w}>
            {inputEl}
            <InputRightElement width="2.2rem" pointerEvents="auto">
              <IconButton
                aria-label={t("ep.common.openCalendar")}
                icon={<FaCalendarAlt />}
                size="xs"
                variant="ghost"
                isDisabled={isDisabled}
                onClick={() => !isDisabled && setOpen((o) => !o)}
              />
            </InputRightElement>
          </InputGroup>
        )}
      </PopoverTrigger>
      <PopoverContent w="auto" maxW="100vw">
        <PopoverBody p={2}>
          <Box
            sx={{
              ".react-calendar": {
                width: "100%",
                maxWidth: "320px",
                background: tileBg,
                border: "none",
                fontFamily: "inherit",
              },
              ".react-calendar__navigation": {
                marginBottom: "0.5rem",
              },
              ".react-calendar__navigation button": {
                color: navBtn,
                minWidth: "36px",
              },
              ".react-calendar__month-view__weekdays": {
                fontSize: "0.7rem",
                textTransform: "none",
              },
              ".react-calendar__tile": {
                borderRadius: "md",
              },
              ".react-calendar__tile:enabled:hover, .react-calendar__tile:enabled:focus": {
                background: tileHover,
              },
              ".react-calendar__tile--active": {
                background: `${activeBg} !important`,
                color: "white !important",
              },
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
              formatDay={
                locale === "ko-KR"
                  ? (_calLocale, date) => String(date.getDate())
                  : undefined
              }
              formatLongDate={
                locale === "ko-KR"
                  ? (_calLocale, date) =>
                      new Intl.DateTimeFormat("en-US", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      }).format(date)
                  : undefined
              }
              onChange={(v) => {
                if (v instanceof Date) {
                  const iso = localDateToIso(v);
                  skipCommitDupRef.current = true;
                  onChange(iso);
                  setOpen(false);
                  onCommit?.(iso);
                }
              }}
            />
          </Box>
          {allowClear && (
            <HStack justify="flex-end" mt={2}>
              <Button
                size="xs"
                variant="ghost"
                onClick={() => {
                  skipCommitDupRef.current = true;
                  onChange("");
                  setOpen(false);
                  onCommit?.("");
                }}
              >
                {t("ep.common.clearDate")}
              </Button>
            </HStack>
          )}
        </PopoverBody>
      </PopoverContent>
    </Popover>
  );
}
