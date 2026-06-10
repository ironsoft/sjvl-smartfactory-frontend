import {
  Box,
  Flex,
  IconButton,
  Spinner,
  Text,
  Tooltip,
  useColorModeValue,
} from "@chakra-ui/react";
import { useState } from "react";
import { Helmet } from "react-helmet";
import { FiExternalLink, FiRefreshCw } from "react-icons/fi";

const ERP_URL =
  "http://erp.sungjininc.com:8888/sscounter/view/dashboard/dashboard_total-VL2b.asp";

export default function VlErpDashboard() {
  const mutedText = useColorModeValue("gray.500", "gray.400");
  const borderColor = useColorModeValue("gray.200", "gray.600");
  const loadingBg = useColorModeValue("white", "gray.800");

  const [key, setKey] = useState(0);
  const [loading, setLoading] = useState(true);

  const handleRefresh = () => {
    setLoading(true);
    setKey((k) => k + 1);
  };

  return (
    <>
      <Helmet>
        <title>ERP Dashboard</title>
      </Helmet>

      <Box display="flex" flexDirection="column" h="calc(100vh - 100px)" p={3}>
        <Flex align="center" justify="space-between" mb={2} flexShrink={0}>
          <Text fontWeight="semibold" fontSize="md">
            ERP Dashboard
          </Text>
          <Flex gap={1}>
            <Tooltip label="새로고침">
              <IconButton
                aria-label="새로고침"
                icon={<FiRefreshCw />}
                size="sm"
                variant="ghost"
                onClick={handleRefresh}
                isLoading={loading}
              />
            </Tooltip>
            <Tooltip label="새 탭에서 열기">
              <IconButton
                as="a"
                href={ERP_URL}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="새 탭에서 열기"
                icon={<FiExternalLink />}
                size="sm"
                variant="ghost"
              />
            </Tooltip>
          </Flex>
        </Flex>

        <Box
          flex={1}
          position="relative"
          border="1px"
          borderColor={borderColor}
          borderRadius="lg"
          overflow="hidden"
        >
          {loading && (
            <Flex
              position="absolute"
              inset={0}
              align="center"
              justify="center"
              direction="column"
              gap={3}
              zIndex={1}
              bg={loadingBg}
            >
              <Spinner size="xl" color="blue.400" />
              <Text fontSize="sm" color={mutedText}>
                ERP 대시보드 로딩 중...
              </Text>
            </Flex>
          )}
          <iframe
            key={key}
            src={ERP_URL}
            title="ERP Dashboard"
            width="100%"
            height="100%"
            style={{ border: "none", display: "block" }}
            onLoad={() => setLoading(false)}
            onError={() => setLoading(false)}
          />
        </Box>

        <Text fontSize="xs" color={mutedText} mt={1} flexShrink={0}>
          출처: {ERP_URL}
        </Text>
      </Box>
    </>
  );
}
