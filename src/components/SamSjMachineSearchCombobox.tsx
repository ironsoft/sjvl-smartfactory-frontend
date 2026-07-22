import {
  Box,
  Center,
  Input,
  List,
  ListItem,
  Spinner,
  Text,
  useColorModeValue
} from "@chakra-ui/react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { getMachines, type IMachine } from "../api";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

export type SamSjMachinePick = {
  pk: number;
  code: string;
  name: string;
};

const SEARCH_DEBOUNCE_MS = 280;

function machineSecondaryLine(m: IMachine): string | null {
  const loc = (m.location ?? "").trim();
  const cat = (m.category ?? "").trim();
  const parts = [cat, loc].filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
}

type SamSjMachineSearchComboboxProps = {
  value: SamSjMachinePick | null;
  onChange: (v: SamSjMachinePick | null) => void;
  /** false 이면 검색 API를 호출하지 않음 (모달 닫힘·읽기 전용 등) */
  isActive: boolean;
};

/**
 * 등록된 SJ Machine 목록을 `machines/machines/` 로 검색해 선택한다.
 * 포커스 시 빈 검색으로 첫 페이지를 불러 오며, 입력은 디바운스 후 검색한다.
 */
export function SamSjMachineSearchCombobox({
  value,
  onChange,
  isActive
}: SamSjMachineSearchComboboxProps) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [panelOpen, setPanelOpen] = useState(false);
  /** 브라우저는 number, Node 타입 정의와 충돌 시 number로 통일 */
  const blurTimer = useRef<number | null>(null);

  const suggestionBg = useColorModeValue("white", "gray.700");
  const suggestionHoverBg = useColorModeValue("gray.100", "gray.600");
  const suggestionBorderColor = useColorModeValue("gray.200", "gray.600");
  const mutedColor = useColorModeValue("gray.500", "gray.400");

  useLayoutEffect(() => {
    if (value) {
      setDraft(
        value.name?.trim()
          ? `${value.code} — ${value.name}`
          : value.code
      );
    }
  }, [value?.pk, value?.code, value?.name]);

  useEffect(() => {
    const id = window.setTimeout(() => {
      setDebouncedSearch(draft.trim());
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(id);
  }, [draft]);

  const { data, isFetching, isError } = useQuery({
    queryKey: ["sjMachinesSamPick", debouncedSearch],
    queryFn: () => getMachines({ search: debouncedSearch, page: 1 }),
    enabled: isActive && panelOpen,
    placeholderData: keepPreviousData,
    staleTime: 20_000
  });

  const results = data?.results ?? [];

  return (
    <Box position="relative" w="100%" maxW="420px">
      <Input
        size="sm"
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value);
          onChange(null);
        }}
        onFocus={() => setPanelOpen(true)}
        onBlur={() => {
          blurTimer.current = window.setTimeout(
            () => setPanelOpen(false),
            160
          ) as unknown as number;
        }}
        placeholder={t("vlLayouts.processDetail.machineSearchPlaceholder")}
        aria-autocomplete="list"
        aria-expanded={panelOpen}
      />
      <Text fontSize="2xs" color={mutedColor} mt={1}>
        {t("vlLayouts.processDetail.machineSearchHint")}
      </Text>
      {value && (
        <Text fontSize="xs" color="blue.400" mt={1}>
          {t("vlLayouts.processDetail.machineSelectedLabel", {
            code: value.code,
            suffix: value.name?.trim() ? ` — ${value.name}` : ""
          })}
        </Text>
      )}
      {!value && draft.trim() && (
        <Text
          fontSize="xs"
          color="orange.400"
          mt={1}
          cursor="pointer"
          onClick={() => {
            setDraft("");
            onChange(null);
          }}
        >
          {t("vlLayouts.processDetail.machineClear")}
        </Text>
      )}
      {panelOpen && isActive && (
        <List
          position="absolute"
          zIndex={20}
          left={0}
          right={0}
          top="100%"
          mt={1}
          bg={suggestionBg}
          border="1px solid"
          borderColor={suggestionBorderColor}
          borderRadius="md"
          maxH="min(52vh, 280px)"
          overflowY="auto"
          shadow="lg"
        >
          {isFetching && results.length === 0 && (
            <ListItem px={3} py={4}>
              <Center>
                <Spinner size="sm" />
                <Text as="span" ml={2} fontSize="sm" color={mutedColor}>
                  {t("vlLayouts.processDetail.machineSearchLoading")}
                </Text>
              </Center>
            </ListItem>
          )}
          {!isFetching && !isError && results.length === 0 && (
            <ListItem px={3} py={3}>
              <Text fontSize="sm" color={mutedColor}>
                {t("vlLayouts.processDetail.machineSearchEmpty")}
              </Text>
            </ListItem>
          )}
          {isError && (
            <ListItem px={3} py={3}>
              <Text fontSize="sm" color="red.400">
                {t("vlLayouts.processDetail.machineSearchError")}
              </Text>
            </ListItem>
          )}
          {results.map((m) => {
            const sub = machineSecondaryLine(m);
            return (
              <ListItem
                key={m.pk}
                px={3}
                py={2}
                cursor="pointer"
                fontSize="sm"
                _hover={{ bg: suggestionHoverBg }}
                onMouseDown={(e) => {
                  e.preventDefault();
                  if (blurTimer.current != null)
                    window.clearTimeout(blurTimer.current);
                  onChange({
                    pk: m.pk,
                    code: m.code,
                    name: m.name ?? ""
                  });
                  setDraft(m.name?.trim() ? `${m.code} — ${m.name}` : m.code);
                  setPanelOpen(false);
                }}
              >
                <Text as="span" fontWeight="semibold">
                  {m.code}
                </Text>
                {m.name?.trim() ? (
                  <Text as="span" color="gray.500">
                    {" "}
                    — {m.name}
                  </Text>
                ) : null}
                {sub ? (
                  <Text fontSize="2xs" color={mutedColor} display="block" mt={0.5}>
                    {sub}
                  </Text>
                ) : null}
              </ListItem>
            );
          })}
        </List>
      )}
    </Box>
  );
}
