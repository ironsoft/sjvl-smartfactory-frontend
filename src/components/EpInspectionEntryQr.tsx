import { Box, Button, Flex, Text, useColorModeValue, useToast } from "@chakra-ui/react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { FaCopy } from "react-icons/fa";
import QRCode from "qrcode";

export type EpInspectionEntryTarget = "ep_process" | "ep_module" | "ep_sj_no";

/**
 * EP Process / Module / SJ No 상세에서 검사 기록 작성 화면으로 가는 QR (EpInspectionForm URL prefill).
 */
export default function EpInspectionEntryQr({
  targetParam,
  pk,
  disabled,
  /** false: 상위 카드 안에만 넣을 때 (구분선 없음) */
  showTopDivider = true,
  /** card: 자체 카드 박스로 감쌈 (Module / SJ No 상세). QR 준비 전에는 아무것도 렌더하지 않음 */
  variant = "inline",
}: {
  targetParam: EpInspectionEntryTarget;
  pk: number;
  disabled?: boolean;
  showTopDivider?: boolean;
  variant?: "inline" | "card";
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const borderColor = useColorModeValue("gray.200", "gray.600");
  const cardBg = useColorModeValue("white", "gray.800");
  const [qrDataUrl, setQrDataUrl] = useState("");

  const inspectionUrl = useMemo(
    () =>
      typeof window !== "undefined" && Number.isFinite(pk) && pk >= 1
        ? `${window.location.origin}/ep-production/inspections/new?${targetParam}=${pk}`
        : "",
    [targetParam, pk]
  );

  useEffect(() => {
    if (disabled || !inspectionUrl) {
      setQrDataUrl("");
      return;
    }
    let cancelled = false;
    QRCode.toDataURL(inspectionUrl, { margin: 1, width: 104 })
      .then((url) => {
        if (!cancelled) setQrDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setQrDataUrl("");
      });
    return () => {
      cancelled = true;
    };
  }, [inspectionUrl, disabled]);

  const copyInspectionLink = async () => {
    try {
      await navigator.clipboard.writeText(inspectionUrl);
      toast({
        title: t("ep.inspectionEntryQr.linkCopied"),
        status: "success",
        duration: 2000,
        position: "bottom-right",
      });
    } catch {
      toast({
        title: t("ep.inspectionEntryQr.linkCopyFailed"),
        status: "error",
        duration: 2000,
        position: "bottom-right",
      });
    }
  };

  if (disabled || !qrDataUrl) return null;

  const body = (
    <>
      <Text fontWeight="semibold" mb={1}>
        {t("ep.inspectionEntryQr.title")}
      </Text>
      <Text fontSize="sm" color="gray.600" mb={3}>
        {t("ep.inspectionEntryQr.hint")}
      </Text>
      <Flex
        align="flex-start"
        direction={{ base: "column", sm: "row" }}
        gap={4}
        flexWrap="wrap"
      >
        <Box
          as="img"
          src={qrDataUrl}
          alt=""
          w={{ base: "96px", md: "104px" }}
          h={{ base: "96px", md: "104px" }}
          flexShrink={0}
          borderRadius="md"
          border="1px solid"
          borderColor={borderColor}
        />
        <Box flex="1" minW={{ base: "0", sm: "200px" }} w="100%">
          <Button
            size="sm"
            leftIcon={<FaCopy />}
            variant="outline"
            w={{ base: "100%", sm: "auto" }}
            onClick={copyInspectionLink}
          >
            {t("ep.inspectionEntryQr.copyLink")}
          </Button>
          <Text fontSize="xs" color="gray.500" mt={2} wordBreak="break-all">
            {inspectionUrl}
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
