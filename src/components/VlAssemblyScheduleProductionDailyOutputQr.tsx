import { Box, Button, Flex, HStack, Text, useColorModeValue, useToast } from "@chakra-ui/react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link as RouterLink } from "react-router-dom";
import { FaCopy } from "react-icons/fa";
import QRCode from "qrcode";

/**
 * VL Assembly Schedule 단위 Production Daily Output 입력 URL QR.
 * `/schedule-daily-outputs?vl_assembly_schedule=&lt;pk&gt;` — 목록이 모달을 연다.
 */
export default function VlAssemblyScheduleProductionDailyOutputQr({
  vlAssemblySchedulePk,
  disabled,
  showTopDivider = true,
  variant = "card"
}: {
  vlAssemblySchedulePk: number;
  disabled?: boolean;
  showTopDivider?: boolean;
  variant?: "inline" | "card";
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const borderColor = useColorModeValue("gray.200", "gray.600");
  const cardBg = useColorModeValue("white", "gray.800");
  const frameBorder = useColorModeValue("blue.400", "blue.300");
  const [qrDataUrl, setQrDataUrl] = useState("");

  const scheduleQueryPath = useMemo(
    () =>
      Number.isFinite(vlAssemblySchedulePk) && vlAssemblySchedulePk >= 1
        ? `/vl-assembly-production/schedule-daily-outputs?vl_assembly_schedule=${vlAssemblySchedulePk}`
        : "",
    [vlAssemblySchedulePk]
  );

  const url = useMemo(
    () =>
      typeof window !== "undefined" && scheduleQueryPath
        ? `${window.location.origin}${scheduleQueryPath}`
        : "",
    [scheduleQueryPath]
  );

  useEffect(() => {
    if (disabled || !url) {
      setQrDataUrl("");
      return;
    }
    let cancelled = false;
    QRCode.toDataURL(url, { margin: 1, width: 104 })
      .then((u) => {
        if (!cancelled) setQrDataUrl(u);
      })
      .catch(() => {
        if (!cancelled) setQrDataUrl("");
      });
    return () => {
      cancelled = true;
    };
  }, [url, disabled]);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast({
        title: t("ep.inspectionEntryQr.linkCopied"),
        status: "success",
        duration: 2000,
        position: "bottom-right"
      });
    } catch {
      toast({
        title: t("ep.inspectionEntryQr.linkCopyFailed"),
        status: "error",
        duration: 2000,
        position: "bottom-right"
      });
    }
  };

  if (disabled || !qrDataUrl) return null;

  const body = (
    <>
      <Text fontWeight="semibold" mb={1}>
        {t("vlAssembly.scheduleProductionDailyOutput.qrTitle")}
      </Text>
      <Text fontSize="sm" color="gray.600" mb={3}>
        {t("vlAssembly.scheduleProductionDailyOutput.qrHint")}
      </Text>
      <Flex
        align="flex-start"
        direction={{ base: "column", sm: "row" }}
        gap={4}
        flexWrap="wrap"
      >
        <Box flexShrink={0}>
          <Box
            bg="white"
            p={2}
            borderRadius="lg"
            border="2px solid"
            borderColor={frameBorder}
            boxShadow="sm"
            display="inline-block"
          >
            <Box
              as="img"
              src={qrDataUrl}
              alt=""
              w={{ base: "96px", md: "104px" }}
              h={{ base: "96px", md: "104px" }}
              display="block"
              borderRadius="md"
            />
          </Box>
        </Box>
        <Box flex="1" minW={{ base: "0", sm: "200px" }} w="100%">
          <HStack spacing={2} flexWrap="wrap" align="stretch">
            <Button
              size="sm"
              leftIcon={<FaCopy />}
              variant="outline"
              flex={{ base: "1", sm: "0 1 auto" }}
              minW={{ base: "120px", sm: "auto" }}
              onClick={copyLink}
            >
              {t("vlAssembly.scheduleProductionDailyOutput.copyQrLink")}
            </Button>
            <Button
              as={RouterLink}
              to={scheduleQueryPath}
              size="sm"
              colorScheme="blue"
              flex={{ base: "1", sm: "0 1 auto" }}
              minW={{ base: "120px", sm: "auto" }}
            >
              {t("vlAssembly.scheduleProductionDailyOutput.quantityInputButton")}
            </Button>
          </HStack>
          <Text fontSize="xs" color="gray.500" mt={2} wordBreak="break-all">
            {url}
          </Text>
        </Box>
      </Flex>
    </>
  );

  if (variant === "card") {
    return (
      <Box
        bg={cardBg}
        borderRadius="xl"
        border="1px solid"
        borderColor={borderColor}
        p={6}
        shadow="sm"
        mt={6}
      >
        {body}
      </Box>
    );
  }

  return (
    <Box
      mt={showTopDivider ? 6 : 0}
      pt={showTopDivider ? 5 : 0}
      borderTop={showTopDivider ? "1px solid" : undefined}
      borderColor={showTopDivider ? borderColor : undefined}
    >
      {body}
    </Box>
  );
}
