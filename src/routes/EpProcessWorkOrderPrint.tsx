import { Box, Button, Center, HStack, Spinner, Text } from "@chakra-ui/react";
import { useQuery } from "@tanstack/react-query";
import { Helmet } from "react-helmet";
import JsBarcode from "jsbarcode";
import QRCode from "qrcode";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { FaArrowLeft, FaPrint } from "react-icons/fa";
import {
  getEpProcessDetail,
  getEpScheduleDetail,
  IEpProcessDetail,
  IEpSchedule,
} from "../api";

const SHEET_W = "100mm";
const SHEET_H = "150mm";

function fmtDate(v?: string | null) {
  if (!v) return "—";
  return v.length >= 10 ? v.slice(0, 10) : v;
}

export default function EpProcessWorkOrderPrint() {
  const { processId } = useParams<{ processId: string }>();
  const pk = Number(processId);
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const popup = searchParams.get("popup") === "1";

  const [qtyQrDataUrl, setQtyQrDataUrl] = useState("");
  const [videoQrDataUrl, setVideoQrDataUrl] = useState("");
  const [qcQrDataUrl, setQcQrDataUrl] = useState("");
  const barcodeSvgRef = useRef<SVGSVGElement | null>(null);

  const { data: proc, isLoading, isError } = useQuery<IEpProcessDetail>({
    queryKey: ["epProcessDetail", pk],
    queryFn: () => getEpProcessDetail(pk),
    enabled: !!pk && Number.isFinite(pk),
  });

  const { data: sched } = useQuery<IEpSchedule>({
    queryKey: ["epScheduleDetail", proc?.ep_schedule_pk],
    queryFn: () => getEpScheduleDetail(proc!.ep_schedule_pk),
    enabled: !!proc?.ep_schedule_pk,
  });

  const dailyOutputUrl = useMemo(
    () =>
      typeof window !== "undefined"
        ? `${window.location.origin}/ep-production/daily-outputs?ep_process=${pk}`
        : "",
    [pk]
  );

  /** EpInspectionForm prefill — Daily output QR과 동일한 origin, 검사 리포트 작성 화면으로 연결 */
  const qcInspectionUrl = useMemo(
    () =>
      typeof window !== "undefined"
        ? `${window.location.origin}/ep-production/inspections/new?ep_process=${pk}`
        : "",
    [pk]
  );

  const sjNoLabel = useMemo(() => {
    if (!sched || !proc) return "—";
    const row = sched.ep_sj_nos?.find((s) => s.pk === proc.ep_sj_no_pk);
    return row?.sj_no || `SJ #${proc.ep_sj_no_pk}`;
  }, [sched, proc]);

  const videoUrl = (proc?.standard_work_video_url ?? "").trim();

  useEffect(() => {
    if (!dailyOutputUrl) {
      setQtyQrDataUrl("");
      return;
    }
    let c = false;
    QRCode.toDataURL(dailyOutputUrl, { margin: 1, width: 200 })
      .then((u) => {
        if (!c) setQtyQrDataUrl(u);
      })
      .catch(() => {
        if (!c) setQtyQrDataUrl("");
      });
    return () => {
      c = true;
    };
  }, [dailyOutputUrl]);

  useEffect(() => {
    if (!videoUrl) {
      setVideoQrDataUrl("");
      return;
    }
    let c = false;
    QRCode.toDataURL(videoUrl, { margin: 1, width: 200 })
      .then((u) => {
        if (!c) setVideoQrDataUrl(u);
      })
      .catch(() => {
        if (!c) setVideoQrDataUrl("");
      });
    return () => {
      c = true;
    };
  }, [videoUrl]);

  useEffect(() => {
    if (!qcInspectionUrl) {
      setQcQrDataUrl("");
      return;
    }
    let c = false;
    QRCode.toDataURL(qcInspectionUrl, { margin: 1, width: 200 })
      .then((u) => {
        if (!c) setQcQrDataUrl(u);
      })
      .catch(() => {
        if (!c) setQcQrDataUrl("");
      });
    return () => {
      c = true;
    };
  }, [qcInspectionUrl]);

  useEffect(() => {
    const el = barcodeSvgRef.current;
    if (!el || !pk || !proc) return;
    const code = `EP${String(pk).padStart(8, "0")}`;
    try {
      while (el.firstChild) el.removeChild(el.firstChild);
      JsBarcode(el, code, {
        format: "CODE128",
        width: 1.15,
        height: 32,
        fontSize: 8,
        margin: 2,
        displayValue: true,
      });
    } catch {
      /* ignore */
    }
  }, [pk, proc]);

  const printedAt = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  }, []);

  const handlePrint = () => window.print();

  if (!pk || !Number.isFinite(pk)) {
    return (
      <Center minH="40vh">
        <Text color="gray.500">{t("ep.workOrder.loadError")}</Text>
      </Center>
    );
  }

  if (isLoading) {
    return (
      <Center minH="60vh">
        <Spinner size="xl" />
      </Center>
    );
  }

  if (isError || !proc) {
    return (
      <Center minH="40vh">
        <Text color="gray.500">{t("ep.workOrder.loadError")}</Text>
      </Center>
    );
  }

  if (proc.is_deleted) {
    return (
      <Center minH="40vh">
        <Text color="red.500">{t("ep.workOrder.deleted")}</Text>
      </Center>
    );
  }

  const po = sched?.sj_order_info?.sj_po_number ?? "—";
  const line = sched?.production_line_name ?? "—";
  const statusLabel = proc.status_display ?? proc.status ?? "—";

  return (
    <>
      <Helmet>
        <title>{`${t("ep.workOrder.docTitle")} ${proc.code}`}</title>
        <style type="text/css">{`
          @media print {
            @page { size: 100mm 150mm; margin: 0; }
            html, body { background: #fff !important; }
            .no-print { display: none !important; }
            .work-order-root { margin: 0 !important; padding: 0 !important; }
            .work-order-sheet {
              box-shadow: none !important;
              margin: 0 auto !important;
            }
          }
          @media screen {
            .work-order-sheet {
              box-shadow: 0 2px 12px rgba(0,0,0,0.12);
            }
          }
        `}</style>
      </Helmet>

      <Box className="no-print" px={4} py={3} bg="gray.100">
        <HStack spacing={3} flexWrap="wrap">
          <Button leftIcon={<FaArrowLeft />} size="sm" variant="outline" onClick={() => navigate(-1)}>
            {t("ep.workOrder.back")}
          </Button>
          <Button leftIcon={<FaPrint />} size="sm" colorScheme="blue" onClick={handlePrint}>
            {t("ep.workOrder.print")}
          </Button>
          <Text fontSize="sm" color="gray.600">
            {t("ep.workOrder.printHint")}
          </Text>
        </HStack>
      </Box>

      <Box
        className="work-order-root"
        bg={popup ? "white" : "gray.200"}
        py={popup ? 0 : 6}
        px={popup ? 0 : 4}
        display="flex"
        justifyContent="center"
      >
        <Box
          className="work-order-sheet"
          width={SHEET_W}
          minH={SHEET_H}
          maxW="100%"
          bg="white"
          color="#111"
          border="1.2pt solid #000"
          boxSizing="border-box"
          fontFamily="'Malgun Gothic','Apple SD Gothic Neo',sans-serif"
          fontSize="8.5pt"
          lineHeight={1.25}
          display="flex"
          flexDirection="column"
        >
          {/* Header */}
          <Box borderBottom="1pt solid #000" display="grid" gridTemplateColumns="1fr 2fr 1fr" minH="9mm">
            <Box borderRight="1pt solid #000" p="1.5mm" display="flex" alignItems="center" justifyContent="center">
              <Text fontWeight="800" fontSize="9pt">
                EP
              </Text>
            </Box>
            <Box borderRight="1pt solid #000" p="1.5mm" display="flex" alignItems="center" justifyContent="center" textAlign="center">
              <Text fontWeight="800" fontSize="11pt" letterSpacing="0.02em">
                {t("ep.workOrder.title")}
              </Text>
            </Box>
            <Box p="1.5mm" display="flex" alignItems="center" justifyContent="center">
              <Text fontWeight="700" fontSize="8pt" color="blue.700">
                {statusLabel}
              </Text>
            </Box>
          </Box>

          {/* Barcode + hero code */}
          <Box borderBottom="1pt solid #000" p="2mm" textAlign="center">
            <svg ref={barcodeSvgRef} style={{ maxWidth: "92mm", height: "auto" }} />
            <Text fontWeight="900" fontSize="16pt" mt="1mm" letterSpacing="-0.02em">
              {proc.code}
            </Text>
            <Text fontSize="9pt" fontWeight="600" mt="0.5mm">
              {[proc.name_ko || proc.name, proc.name_en].filter(Boolean).join(" · ") || "—"}
            </Text>
          </Box>

          {/* Main: left info | right QR */}
          <Box display="flex" flexDirection="row" alignItems="stretch" flex="1" minH="0">
            <Box
              flex="1"
              borderRight="1pt solid #000"
              p="2mm"
              minW="0"
              sx={{
                "& .wo-row": { display: "grid", gridTemplateColumns: "22mm 1fr", gap: "0.5mm 1mm", marginBottom: "1.2mm" },
                "& .wo-l": { fontWeight: 700, fontSize: "7px", color: "#333" },
                "& .wo-v": { fontSize: "8px", wordBreak: "break-word" },
              }}
            >
              <div className="wo-row">
                <span className="wo-l">{t("ep.workOrder.lblEpProcessPk")}</span>
                <span className="wo-v">{proc.pk}</span>
              </div>
              <div className="wo-row">
                <span className="wo-l">{t("ep.workOrder.lblSchedule")}</span>
                <span className="wo-v">EP #{sched?.pk ?? proc.ep_schedule_pk}</span>
              </div>
              <div className="wo-row">
                <span className="wo-l">{t("ep.workOrder.lblPo")}</span>
                <span className="wo-v">{po}</span>
              </div>
              <div className="wo-row">
                <span className="wo-l">{t("ep.workOrder.lblSjNo")}</span>
                <span className="wo-v">{sjNoLabel}</span>
              </div>
              <div className="wo-row">
                <span className="wo-l">{t("ep.workOrder.lblModule")}</span>
                <span className="wo-v">{proc.ep_module_code}</span>
              </div>
              <div className="wo-row">
                <span className="wo-l">{t("ep.workOrder.lblLine")}</span>
                <span className="wo-v">{line}</span>
              </div>
              <div className="wo-row">
                <span className="wo-l">{t("ep.workOrder.lblMachine")}</span>
                <span className="wo-v">{proc.machine_name ?? "—"}</span>
              </div>
              <div className="wo-row">
                <span className="wo-l">{t("ep.workOrder.lblQty")}</span>
                <span className="wo-v">
                  {t("ep.workOrder.qtyLine", {
                    total: proc.total_qty != null ? proc.total_qty.toLocaleString() : "—",
                    out: (proc.output_qty ?? 0).toLocaleString(),
                    bal:
                      proc.total_qty != null
                        ? Math.max(0, proc.total_qty - (proc.output_qty ?? 0)).toLocaleString()
                        : "—",
                  })}
                </span>
              </div>
              <div className="wo-row">
                <span className="wo-l">{t("ep.workOrder.lblCycle")}</span>
                <span className="wo-v">{proc.cycle_time ?? "—"}</span>
              </div>
              <div className="wo-row">
                <span className="wo-l">{t("ep.workOrder.lblTarget")}</span>
                <span className="wo-v">
                  {proc.target_qty_per_hour != null ? `${proc.target_qty_per_hour} pcs/h` : "—"} ·{" "}
                  {proc.daily_target_qty_8h != null ? `${proc.daily_target_qty_8h} / 8h` : "—"}
                </span>
              </div>
              <div className="wo-row">
                <span className="wo-l">{t("ep.workOrder.lblDates")}</span>
                <span className="wo-v">
                  {fmtDate(proc.process_start_date)} ~ {fmtDate(proc.process_finish_date)}
                  {proc.process_lead_time_days != null ? ` (${proc.process_lead_time_days}d)` : ""}
                </span>
              </div>
              {proc.source_process_info && (
                <div className="wo-row">
                  <span className="wo-l">{t("ep.workOrder.lblSource")}</span>
                  <span className="wo-v">
                    {proc.source_process_info.code}
                    {proc.source_process_info.name ? ` — ${proc.source_process_info.name}` : ""}
                  </span>
                </div>
              )}
              {(proc.description || proc.flow) && (
                <Box mt="1mm" pt="1mm" borderTop="0.5pt dashed #999">
                  {proc.description ? (
                    <Text fontSize="7px" fontWeight="700" mb="0.5mm">
                      {t("ep.processDetail.description")}
                    </Text>
                  ) : null}
                  {proc.description ? (
                    <Text fontSize="7.5px" whiteSpace="pre-wrap" mb={proc.flow ? "1mm" : 0}>
                      {proc.description}
                    </Text>
                  ) : null}
                  {proc.flow ? (
                    <Text fontSize="7px" fontWeight="700" mb="0.5mm">
                      {t("ep.processDetail.flow")}
                    </Text>
                  ) : null}
                  {proc.flow ? (
                    <Text fontSize="7.5px" whiteSpace="pre-wrap">
                      {proc.flow}
                    </Text>
                  ) : null}
                </Box>
              )}
            </Box>

            <Box
              width="35mm"
              flexShrink={0}
              p="1mm"
              display="flex"
              flexDirection="column"
              gap="1mm"
              bg="#fafafa"
            >
              {/* A · 작업입력 (수량) — 파란 실선 */}
              <Box
                border="2px solid #2563eb"
                borderRadius="3px"
                overflow="hidden"
                bg="white"
                boxShadow="sm"
              >
                <HStack
                  align="stretch"
                  spacing={0}
                  bg="#dbeafe"
                  borderBottom="1px solid #2563eb"
                  px="1.2mm"
                  py="0.8mm"
                >
                  <Center
                  w="5.5mm"
                  h="5.5mm"
                  borderRadius="2px"
                    bg="#2563eb"
                    color="white"
                    fontWeight="900"
                    fontSize="10px"
                    flexShrink={0}
                  >
                    A
                  </Center>
                  <Box pl="1.5mm" minW={0}>
                    <Text fontWeight="900" fontSize="8px" color="#1e3a8a" lineHeight={1.15}>
                      {t("ep.workOrder.qtyBoxTitle")}
                    </Text>
                    <Text fontSize="6px" color="#1e40af" mt="0.3mm">
                      {t("ep.workOrder.qtyBoxSub")}
                    </Text>
                  </Box>
                </HStack>
                <Box p="1mm" textAlign="center">
                  {qtyQrDataUrl ? (
                    <Box as="img" src={qtyQrDataUrl} alt="" width="20mm" height="20mm" mx="auto" display="block" />
                  ) : (
                    <Box h="20mm" />
                  )}
                  <Text fontSize="5px" color="#1e40af" mt="0.5mm" fontWeight="600">
                    {t("ep.workOrder.qtyQrFoot")}
                  </Text>
                </Box>
              </Box>

              {/* B · 표준 영상 — 빨간 실선 */}
              <Box
                border="2px solid #b91c1c"
                borderRadius="3px"
                overflow="hidden"
                bg="white"
                boxShadow="sm"
              >
                <HStack
                  align="stretch"
                  spacing={0}
                  bg="#fee2e2"
                  borderBottom="1px solid #b91c1c"
                  px="1.2mm"
                  py="0.8mm"
                >
                  <Center
                  w="5.5mm"
                  h="5.5mm"
                  borderRadius="2px"
                    bg="#b91c1c"
                    color="white"
                    fontWeight="900"
                    fontSize="10px"
                    flexShrink={0}
                  >
                    B
                  </Center>
                  <Box pl="1.5mm" minW={0}>
                    <Text fontWeight="900" fontSize="8px" color="#7f1d1d" lineHeight={1.15}>
                      {t("ep.workOrder.videoBoxTitle")}
                    </Text>
                    <Text fontSize="6px" color="#991b1b" mt="0.3mm">
                      {t("ep.workOrder.videoBoxSub")}
                    </Text>
                  </Box>
                </HStack>
                <Box p="1mm" textAlign="center">
                  {videoUrl ? (
                    videoQrDataUrl ? (
                      <Box
                        as="img"
                        src={videoQrDataUrl}
                        alt=""
                        width="20mm"
                        height="20mm"
                        mx="auto"
                        display="block"
                      />
                    ) : (
                      <Box h="20mm" display="flex" alignItems="center" justifyContent="center">
                        <Spinner size="sm" color="red.500" />
                      </Box>
                    )
                  ) : (
                    <Box py="2mm">
                      <Text fontSize="6px" color="#991b1b" fontWeight="600">
                        {t("ep.workOrder.noVideo")}
                      </Text>
                    </Box>
                  )}
                  <Text fontSize="5px" color="#991b1b" mt="0.5mm" fontWeight="600">
                    {t("ep.workOrder.videoQrFoot")}
                  </Text>
                </Box>
              </Box>

              {/* C · QC 검사 — 보라 점선 */}
              <Box
                border="2px dashed #6d28d9"
                borderRadius="3px"
                overflow="hidden"
                bg="white"
                boxShadow="sm"
              >
                <HStack
                  align="stretch"
                  spacing={0}
                  bg="#ede9fe"
                  borderBottom="1px dashed #6d28d9"
                  px="1.2mm"
                  py="0.8mm"
                >
                  <Center
                  w="5.5mm"
                  h="5.5mm"
                  borderRadius="2px"
                    bg="#6d28d9"
                    color="white"
                    fontWeight="900"
                    fontSize="10px"
                    flexShrink={0}
                  >
                    C
                  </Center>
                  <Box pl="1.5mm" minW={0}>
                    <Text fontWeight="900" fontSize="8px" color="#4c1d95" lineHeight={1.15}>
                      {t("ep.workOrder.qcBoxTitle")}
                    </Text>
                    <Text fontSize="6px" color="#5b21b6" mt="0.3mm">
                      {t("ep.workOrder.qcBoxSub")}
                    </Text>
                  </Box>
                </HStack>
                <Box p="1mm" textAlign="center">
                  {qcQrDataUrl ? (
                    <Box as="img" src={qcQrDataUrl} alt="" width="20mm" height="20mm" mx="auto" display="block" />
                  ) : (
                    <Box h="20mm" />
                  )}
                  <Text fontSize="5px" color="#5b21b6" mt="0.5mm" fontWeight="600">
                    {t("ep.workOrder.qcQrFoot")}
                  </Text>
                </Box>
              </Box>
            </Box>
          </Box>

          {/* Footer */}
          <Box borderTop="1pt solid #000" mt="auto" p="2mm" minH="16mm" flexShrink={0}>
            <Text fontSize="7px" color="gray.700" mb="2mm">
              {t("ep.workOrder.printedAt")}: {printedAt}
            </Text>
            <Box display="grid" gridTemplateColumns="1fr 1fr" gap="2mm">
              <Box borderBottom="0.5pt solid #000" minH="8mm">
                <Text fontSize="6px" color="gray.600">
                  {t("ep.workOrder.remark")}
                </Text>
              </Box>
              <Box borderBottom="0.5pt solid #000" minH="8mm" textAlign="right">
                <Text fontSize="6px" color="gray.600">
                  {t("ep.workOrder.signature")}
                </Text>
              </Box>
            </Box>
          </Box>
        </Box>
      </Box>
    </>
  );
}
