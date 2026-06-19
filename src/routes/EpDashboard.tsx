import {
  Alert,
  AlertIcon,
  Badge,
  Box,
  Button,
  Divider,
  Flex,
  Heading,
  HStack,
  IconButton,
  List,
  ListItem,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Spinner,
  Text,
  Tooltip,
  VStack,
  useColorModeValue,
  useDisclosure,
  useToast,
} from "@chakra-ui/react";
import { Helmet } from "react-helmet";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { FaChevronRight, FaExpand, FaCompress, FaExternalLinkAlt, FaTrash, FaBrain, FaHistory, FaDesktop } from "react-icons/fa";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { useNavigate } from "react-router-dom";
import {
  getWeldingRoom,
  getMachines,
  addMachinePlacement,
  updateMachinePlacement,
  removeMachinePlacement,
  streamFactoryOverview,
  saveAIAnalysisReport,
  getAIAnalysisReports,
  IMachinePlacement,
  IWeldingRoom,
  IFactoryOverviewAnalysisResponse,
  IAIAnalysisReport,
} from "../api";
import { useAllPressIoT, AllPressIoTMap } from "../hooks/useAllPressIoT";
import { usePressIoT } from "../hooks/usePressIoT";
import WeldingRoomIoTModal from "../components/WeldingRoomIoTModal";

const CANVAS_H = 580;

interface SceneState {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  raycaster: THREE.Raycaster;
  placedMeshes: Map<number, THREE.Object3D>;
  floor: THREE.Mesh;
  animId: number;
}

function MachineInfoOverlay({
  placements,
  readings,
  sceneRef,
  canvasRef,
  onCardClick,
  offsetRefs,
}: {
  placements: IMachinePlacement[];
  readings: AllPressIoTMap;
  sceneRef: React.MutableRefObject<SceneState | null>;
  canvasRef: React.MutableRefObject<HTMLCanvasElement | null>;
  onCardClick: (placement: IMachinePlacement) => void;
  offsetRefs: React.MutableRefObject<Map<number, { dx: number; dy: number }>>;
}) {
  const { t } = useTranslation();
  const cardRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const lineRefs = useRef<Map<number, SVGLineElement>>(new Map());
  const rafRef = useRef<number>(0);
  const dragState = useRef<{
    pk: number; startX: number; startY: number; startDx: number; startDy: number;
  } | null>(null);
  const dragMovedRef = useRef<Set<number>>(new Set());

  const CARD_H = 88;

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragState.current) return;
      const { pk, startX, startY, startDx, startDy } = dragState.current;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
        dragMovedRef.current.add(pk);
      }
      offsetRefs.current.set(pk, { dx: startDx + dx, dy: startDy + dy });
    };
    const onUp = () => { dragState.current = null; };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  const handleCardMouseDown = (e: React.MouseEvent, pk: number) => {
    e.stopPropagation();
    dragMovedRef.current.delete(pk);
    const cur = offsetRefs.current.get(pk) ?? { dx: 0, dy: 0 };
    dragState.current = { pk, startX: e.clientX, startY: e.clientY, startDx: cur.dx, startDy: cur.dy };
  };

  const handleCardClick = (e: React.MouseEvent, placement: IMachinePlacement) => {
    e.stopPropagation();
    if (dragMovedRef.current.has(placement.pk)) {
      dragMovedRef.current.delete(placement.pk);
      return;
    }
    onCardClick(placement);
  };

  useEffect(() => {
    const tick = () => {
      const ss = sceneRef.current;
      const canvas = canvasRef.current;
      if (ss && canvas) {
        const w = canvas.clientWidth;
        const h = canvas.clientHeight;
        Array.from(cardRefs.current.entries()).forEach(([pk, cardEl]) => {
          const lineEl = lineRefs.current.get(pk);
          const mesh = ss.placedMeshes.get(pk);
          if (!mesh) {
            cardEl.style.display = "none";
            if (lineEl) lineEl.setAttribute("display", "none");
            return;
          }
          const box = new THREE.Box3().setFromObject(mesh);
          const cx = (box.min.x + box.max.x) / 2;
          const cz = (box.min.z + box.max.z) / 2;

          const cardPos = new THREE.Vector3(cx, box.max.y + 3.5, cz);
          const cardProj = cardPos.clone().project(ss.camera);
          if (cardProj.z > 1) {
            cardEl.style.display = "none";
            if (lineEl) lineEl.setAttribute("display", "none");
            return;
          }
          const offset = offsetRefs.current.get(pk) ?? { dx: 0, dy: 0 };
          const cardX = ((cardProj.x + 1) / 2) * w + offset.dx;
          const cardY = ((-cardProj.y + 1) / 2) * h + offset.dy;

          cardEl.style.display = "block";
          cardEl.style.visibility = "visible";
          cardEl.style.left = `${cardX}px`;
          cardEl.style.top = `${cardY}px`;
          cardEl.style.cursor = dragState.current?.pk === pk ? "grabbing" : "grab";

          const machinePos = new THREE.Vector3(cx, box.max.y + 0.05, cz);
          const machineProj = machinePos.clone().project(ss.camera);
          const machineX = ((machineProj.x + 1) / 2) * w;
          const machineY = ((-machineProj.y + 1) / 2) * h;

          if (lineEl) {
            lineEl.setAttribute("display", "block");
            lineEl.setAttribute("x1", String(cardX));
            lineEl.setAttribute("y1", String(cardY + CARD_H + 4));
            lineEl.setAttribute("x2", String(machineX));
            lineEl.setAttribute("y2", String(machineY));
          }
        });
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [CARD_H]);

  return (
    <>
      <svg
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          pointerEvents: "none",
          overflow: "visible",
        }}
      >
        {placements.map((p) => (
          <line
            key={p.pk}
            ref={(el) => { if (el) lineRefs.current.set(p.pk, el); else lineRefs.current.delete(p.pk); }}
            display="none"
            stroke="rgba(255,255,255,0.55)"
            strokeWidth="1.5"
            strokeDasharray="4 3"
            strokeLinecap="round"
          />
        ))}
      </svg>

      {placements.map((p) => {
        const reading = (p.machine_iot_id && p.ep_process_pk) ? readings.get(p.machine_iot_id) : undefined;
        const isStale = !reading || Date.now() - reading.receivedAt > 30_000;
        const status: "running" | "idle" = isStale ? "idle" : "running";

        const temp1 = reading?.value_temp_1 ?? "--";
        const temp2 = reading?.value_temp_2 ?? "--";

        let signalState: "green" | "red" | "gray";
        if (status === "idle" || !p.machine_iot_id) {
          signalState = "gray";
        } else if (reading && p.iot_std_hot_temp_c != null && p.iot_tolerance_temp_c != null) {
          const tol = p.iot_tolerance_temp_c;
          const hotOk = Math.abs(reading.value_temp_1 - p.iot_std_hot_temp_c) <= tol;
          const coldOk = p.iot_std_cold_temp_c != null
            ? Math.abs(reading.value_temp_2 - p.iot_std_cold_temp_c) <= tol
            : true;
          signalState = (hotOk && coldOk) ? "green" : "red";
        } else {
          signalState = "green";
        }

        const trafficColors = {
          green: { r: "#2d3748", y: "#2d3748", g: "#68d391" },
          red:   { r: "#fc8181", y: "#2d3748", g: "#2d3748" },
          gray:  { r: "#3a4a5c", y: "#3a4a5c", g: "#3a4a5c" },
        }[signalState];

        const trafficGlow = {
          green: { r: undefined as string | undefined, g: "#68d391" as string | undefined },
          red:   { r: "#fc8181" as string | undefined, g: undefined as string | undefined },
          gray:  { r: undefined as string | undefined, g: undefined as string | undefined },
        }[signalState];

        const statusLabel = status === "running" ? t("ep.dashboard.machineCard.running") : t("ep.dashboard.machineCard.stopped");
        const headerBg = { green: "#276749", red: "#742a2a", gray: "#2d3748" }[signalState];
        const barColor = { green: "#48bb78", red: "#fc8181", gray: "#4a5568" }[signalState];
        const statusLabelColor = { green: "#68d391", red: "#fc8181", gray: "#718096" }[signalState];
        const borderColor = { green: "#68d391", red: "#fc8181", gray: "#4a5568" }[signalState];

        const cycleCount = reading?.value_run_ok ?? null;
        const borderGlow = signalState === "green"
          ? "0 0 0 2px #68d391, 0 4px 16px rgba(104,211,145,0.25)"
          : signalState === "red"
          ? "0 0 0 2px #fc8181, 0 4px 16px rgba(252,129,129,0.25)"
          : "0 0 0 1px #4a5568";

        return (
          <div
            key={p.pk}
            ref={(el) => { if (el) cardRefs.current.set(p.pk, el); else cardRefs.current.delete(p.pk); }}
            onMouseDown={(e) => handleCardMouseDown(e, p.pk)}
            onClick={(e) => handleCardClick(e, p)}
            style={{
              position: "absolute",
              transform: "translateX(-50%)",
              pointerEvents: "auto",
              cursor: "pointer",
              visibility: "hidden",
              width: 138,
              borderRadius: 8,
              boxShadow: borderGlow,
              border: `1.5px solid ${borderColor}`,
              overflow: "hidden",
              fontFamily: "sans-serif",
              fontSize: 9,
            }}
          >
            <div style={{ background: headerBg, padding: "5px 7px", display: "flex", alignItems: "center", gap: 5 }}>
              <div style={{
                width: 32, height: 32, borderRadius: 5, flexShrink: 0,
                background: "#1a202c",
                overflow: "hidden",
                border: "1px solid rgba(255,255,255,0.15)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                {(p.thumbnail) ? (
                  <img
                    src={(p.thumbnail)!}
                    alt={p.style_code || p.machine_name}
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                ) : (
                  <span style={{ fontSize: 14 }}>⚙️</span>
                )}
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 2.5, alignItems: "center", background: "#1a202c", borderRadius: 4, padding: "3px 4px" }}>
                {([
                  { color: trafficColors.r, glow: trafficGlow.r },
                  { color: trafficColors.y, glow: undefined },
                  { color: trafficColors.g, glow: trafficGlow.g },
                ] as { color: string; glow?: string }[]).map(({ color, glow }, i) => (
                  <div key={i} style={{
                    width: 6, height: 6, borderRadius: "50%",
                    background: color,
                    boxShadow: glow ? `0 0 5px 2px ${glow}` : "none",
                  }} />
                ))}
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 8, color: "rgba(255,255,255,0.55)", marginBottom: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {p.machine_iot_id ? `IoT: ${p.machine_iot_id}` : p.machine_code}
                </div>
                <div style={{ fontSize: 10, fontWeight: 800, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {p.machine_name || p.machine_code}
                </div>
                <div style={{ fontSize: 8, marginTop: 1.5, fontWeight: 600, color: statusLabelColor }}>
                  ● {statusLabel}
                </div>
              </div>
            </div>

            <div style={{ padding: "6px 7px 7px", background: "#fff" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                <span style={{ color: "#e53e3e", fontWeight: 700, fontSize: 10 }}>
                  🔥 {temp1 !== "--" ? `${temp1}°` : "--"}
                </span>
                <span style={{ color: "#3182ce", fontWeight: 700, fontSize: 10 }}>
                  ❄️ {temp2 !== "--" ? `${temp2}°` : "--"}
                </span>
              </div>
              {cycleCount !== null && (
                <div style={{ fontSize: 8, color: "#718096", marginBottom: 3, textAlign: "center" }}>
                  🔄 {cycleCount.toLocaleString()} cycles
                </div>
              )}
              <div style={{ background: "#e2e8f0", borderRadius: 3, height: 4, overflow: "hidden" }}>
                <div style={{
                  width: status === "running" ? "80%" : "8%",
                  height: "100%",
                  background: barColor,
                  borderRadius: 3,
                  transition: "width 0.5s ease",
                }} />
              </div>
            </div>

            <div style={{
              position: "absolute", bottom: -4, left: "50%", transform: "translateX(-50%)",
              width: 8, height: 8, borderRadius: "50%",
              background: headerBg, border: "1.5px solid #fff",
              boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
            }} />
          </div>
        );
      })}
    </>
  );
}

export default function EpDashboard() {
  const { t, i18n } = useTranslation();
  const toast = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<SceneState | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const cardBg = useColorModeValue("white", "gray.800");
  const borderColor = useColorModeValue("gray.200", "gray.600");
  const labelColor = useColorModeValue("gray.500", "gray.400");
  const itemHoverBg = useColorModeValue("gray.50", "gray.700");
  const pageBg = useColorModeValue("gray.50", "gray.900");

  const liveReadings = useAllPressIoT();

  const cardOffsetRefs = useRef<Map<number, { dx: number; dy: number }>>(new Map());
  const [layoutSaving, setLayoutSaving] = useState(false);

  const [editMode, setEditMode] = useState(false);
  const [selectedPk, setSelectedPk] = useState<number | null>(null);
  const [isDraggingMachine, setIsDraggingMachine] = useState<number | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  const handleToggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  };

  useEffect(() => {
    const ss = sceneRef.current;
    const canvas = canvasRef.current;
    if (!ss || !canvas) return;
    const id = setTimeout(() => {
      const nw = isFullscreen ? window.innerWidth : (canvas.clientWidth || 800);
      const nh = isFullscreen ? window.innerHeight : (canvas.clientHeight || CANVAS_H);
      if (!nw || !nh) return;
      ss.renderer.setSize(nw, nh, false);
      ss.camera.aspect = nw / nh;
      ss.camera.updateProjectionMatrix();
    }, 50);
    return () => clearTimeout(id);
  }, [isFullscreen]);

  const { isOpen: isIoTOpen, onOpen: onIoTOpen, onClose: onIoTClose } = useDisclosure();
  const { isOpen: isAiOpen, onOpen: onAiOpen, onClose: onAiClose } = useDisclosure();
  const [aiLoading, setAiLoading] = useState(false);
  const [aiStreamText, setAiStreamText] = useState("");
  const [aiResult, setAiResult] = useState<IFactoryOverviewAnalysisResponse | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiSaving, setAiSaving] = useState(false);
  const [aiSaved, setAiSaved] = useState(false);
  const [savingMsgIdx, setSavingMsgIdx] = useState(0);

  const handleFactoryAnalysis = async () => {
    if (!room?.placements.length) return;
    setAiLoading(true);
    setAiStreamText("");
    setAiError(null);
    setAiResult(null);
    setAiSaved(false);
    onAiOpen();
    try {
      const machines = room.placements
        .filter((p) => p.machine_iot_id)
        .map((p) => {
          const reading = liveReadings.get(p.machine_iot_id);
          const isConnected = !!reading && Date.now() - reading.receivedAt < 30_000;
          return {
            machine_name: p.machine_name || p.machine_code,
            machine_iot_id: p.machine_iot_id,
            hot_temp: isConnected ? (reading?.value_temp_1 ?? null) : null,
            cold_temp: isConnected ? (reading?.value_temp_2 ?? null) : null,
            std_hot_temp: p.iot_std_hot_temp_c ?? null,
            std_cold_temp: p.iot_std_cold_temp_c ?? null,
            tolerance_temp: p.iot_tolerance_temp_c ?? 5.0,
            is_connected: isConnected,
            hot_duration: isConnected ? (reading?.value_time_hot ?? null) : null,
            cold_duration: isConnected ? (reading?.value_time_cold ?? null) : null,
            cycle_count: isConnected ? (reading?.value_time_cycle ?? reading?.value_run_ok ?? null) : null,
            std_hot_duration: p.iot_std_hot_duration_s ?? null,
            std_cold_duration: p.iot_std_cold_duration_s ?? null,
            tolerance_duration: p.iot_tolerance_duration_s ?? 5.0,
          };
        });
      const lang = i18n.language?.startsWith("ko") ? "ko" : i18n.language?.startsWith("vi") ? "vi" : "en";
      for await (const event of streamFactoryOverview(machines, lang)) {
        if (event.type === "delta") {
          setAiStreamText((prev) => prev + event.text);
        } else if (event.type === "done") {
          setAiResult(event.result);
          setAiLoading(false);
        } else if (event.type === "error") {
          setAiError(event.text);
          setAiLoading(false);
        }
      }
    } catch (e: any) {
      setAiError(e?.message ?? "AI 분석 중 오류가 발생했습니다.");
      setAiLoading(false);
    }
  };

  const SAVING_STEPS = [
    t("ep.dashboard.aiAnalysis.savingStep1"),
    t("ep.dashboard.aiAnalysis.savingStep2"),
    t("ep.dashboard.aiAnalysis.savingStep3"),
    t("ep.dashboard.aiAnalysis.savingStep4"),
    t("ep.dashboard.aiAnalysis.savingStep5"),
  ];

  useEffect(() => {
    if (!aiSaving) { setSavingMsgIdx(0); return; }
    const id = setInterval(() => setSavingMsgIdx((i) => (i + 1) % SAVING_STEPS.length), 2200);
    return () => clearInterval(id);
  }, [aiSaving]);

  const handleSaveReport = async () => {
    if (!aiResult || aiSaved) return;
    const lang = i18n.language?.startsWith("ko") ? "ko" : i18n.language?.startsWith("vi") ? "vi" : "en";
    const machineCount = (room?.placements ?? []).filter((p) => p.machine_iot_id).length;
    setAiSaving(true);
    try {
      await saveAIAnalysisReport({
        source_page: "ep_dashboard",
        overall_severity: aiResult.overall_severity,
        summary: aiResult.summary,
        machine_issues: aiResult.machine_issues,
        recommendations: aiResult.recommendations,
        language: lang,
        machine_count: machineCount,
      });
      setAiSaved(true);
      toast({ title: t("ep.dashboard.aiAnalysis.saveSuccess"), status: "success", duration: 2000, position: "bottom-right" });
    } catch {
      toast({ title: t("ep.dashboard.aiAnalysis.saveError"), status: "error", duration: 3000, position: "bottom-right" });
    } finally {
      setAiSaving(false);
    }
  };

  const [iotPlacement, setIotPlacement] = useState<IMachinePlacement | null>(null);
  const [iotActiveIotId, setIotActiveIotId] = useState<string | undefined>(undefined);
  const iotPressIoT = usePressIoT(iotActiveIotId);

  const handleCardClick = (placement: IMachinePlacement) => {
    if (!placement.machine_iot_id) return;
    setIotPlacement(placement);
    setIotActiveIotId(placement.machine_iot_id);
    onIoTOpen();
  };

  const handleIoTClose = () => {
    onIoTClose();
    queryClient.invalidateQueries({ queryKey: ["weldingRoom"] });
  };

  const { data: room, isLoading: roomLoading } = useQuery<IWeldingRoom>({
    queryKey: ["weldingRoom"],
    queryFn: getWeldingRoom,
  });

  const { data: aiReports } = useQuery<IAIAnalysisReport[]>({
    queryKey: ["aiAnalysisReports"],
    queryFn: getAIAnalysisReports,
  });

  useEffect(() => {
    if (!room) return;
    room.placements.forEach((p) => {
      cardOffsetRefs.current.set(p.pk, {
        dx: p.card_offset_x ?? 0,
        dy: p.card_offset_y ?? 0,
      });
    });
  }, [room?.pk]);

  const handleSaveLayout = async () => {
    if (!room) return;
    setLayoutSaving(true);
    try {
      await Promise.all(
        room.placements.map((p) => {
          const off = cardOffsetRefs.current.get(p.pk) ?? { dx: 0, dy: 0 };
          return updateMachinePlacement(p.pk, {
            card_offset_x: off.dx,
            card_offset_y: off.dy,
          });
        })
      );
      const ss = sceneRef.current;
      if (ss) {
        localStorage.setItem("weldingRoomCamera", JSON.stringify({
          px: ss.camera.position.x,
          py: ss.camera.position.y,
          pz: ss.camera.position.z,
          tx: ss.controls.target.x,
          ty: ss.controls.target.y,
          tz: ss.controls.target.z,
        }));
      }
      toast({ title: t("ep.dashboard.layout.saveSuccess"), status: "success", duration: 1500, position: "bottom-right" });
    } catch {
      toast({ title: t("ep.dashboard.layout.saveFailed"), status: "error", duration: 2000, position: "bottom-right" });
    } finally {
      setLayoutSaving(false);
    }
  };

  const { data: machinesData } = useQuery({
    queryKey: ["machines", "", 1],
    queryFn: () => getMachines({ search: "", page: 1 }),
  });

  const allMachines = machinesData?.results ?? [];
  const placedMachineIds = new Set((room?.placements ?? []).map((p) => p.machine));
  const unplacedMachines = allMachines.filter((m) => !placedMachineIds.has(m.pk));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !room) return;

    const w = canvas.parentElement?.clientWidth || 800;
    const h = CANVAS_H;

    let ss = sceneRef.current;

    if (!ss) {
      const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
      renderer.setSize(w, h, false);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.shadowMap.enabled = true;

      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0xf0f4f8);
      scene.fog = new THREE.Fog(0xf0f4f8, 30, 80);

      const camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 500);

      const savedCam = (() => { try { return JSON.parse(localStorage.getItem("weldingRoomCamera") ?? "null"); } catch { return null; } })();
      if (savedCam) {
        camera.position.set(savedCam.px, savedCam.py, savedCam.pz);
      } else {
        camera.position.set(0, 18, 20);
        camera.lookAt(0, 0, 0);
      }

      scene.add(new THREE.AmbientLight(0xffffff, 0.8));
      const dir = new THREE.DirectionalLight(0xffffff, 1.5);
      dir.position.set(10, 20, 10);
      dir.castShadow = true;
      scene.add(dir);
      scene.add(new THREE.HemisphereLight(0x8888ff, 0x444422, 0.4));

      const controls = new OrbitControls(camera, canvas);
      controls.enableDamping = true;
      controls.maxPolarAngle = Math.PI / 2.1;
      if (savedCam) {
        controls.target.set(savedCam.tx, savedCam.ty, savedCam.tz);
      } else {
        controls.target.set(0, 0, 0);
      }
      controls.update();

      const raycaster = new THREE.Raycaster();

      const floor = new THREE.Mesh(
        new THREE.PlaneGeometry(room.width, room.depth),
        new THREE.MeshStandardMaterial({ color: 0xdde3ea, roughness: 0.9 })
      );
      floor.rotation.x = -Math.PI / 2;
      floor.receiveShadow = true;
      floor.name = "floor";
      scene.add(floor);

      const edges = new THREE.EdgesGeometry(new THREE.BoxGeometry(room.width, 0.05, room.depth));
      const border = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0xa0aec0 }));
      border.position.y = 0.025;
      scene.add(border);

      const grid = new THREE.GridHelper(Math.max(room.width, room.depth), 20, 0xa0aec0, 0xc8d0db);
      scene.add(grid);

      ss = { renderer, scene, camera, controls, raycaster, placedMeshes: new Map(), floor, animId: 0 };
      sceneRef.current = ss;

      const animate = () => {
        ss!.animId = requestAnimationFrame(animate);
        ss!.controls.update();
        ss!.renderer.render(ss!.scene, ss!.camera);
      };
      animate();

      const ro = new ResizeObserver(() => {
        const nw = canvas.parentElement?.clientWidth || w;
        const nh = canvas.clientHeight || h;
        ss!.renderer.setSize(nw, nh, false);
        ss!.camera.aspect = nw / nh;
        ss!.camera.updateProjectionMatrix();
      });
      if (canvas.parentElement) ro.observe(canvas.parentElement);
    }

    const loader = new GLTFLoader();
    for (const p of room.placements) {
      if (ss.placedMeshes.has(p.pk)) continue;
      if (!p.model_3d_url) {
        const box = new THREE.Mesh(
          new THREE.BoxGeometry(1.2, 1.2, 1.2),
          new THREE.MeshStandardMaterial({ color: 0x4299e1 })
        );
        box.position.set(p.pos_x, 0.6, p.pos_z);
        box.rotation.y = (p.rot_y * Math.PI) / 180;
        box.castShadow = true;
        box.userData = { placementPk: p.pk };
        box.name = `placement-${p.pk}`;
        ss.scene.add(box);
        ss.placedMeshes.set(p.pk, box);
      } else {
        loader.load(p.model_3d_url, (gltf) => {
          const model = gltf.scene;
          const b = new THREE.Box3().setFromObject(model);
          const size = b.getSize(new THREE.Vector3());
          const maxDim = Math.max(size.x, size.y, size.z) || 1;
          const s = (1.5 / maxDim) * p.scale;
          const center = b.getCenter(new THREE.Vector3());
          model.scale.setScalar(s);
          model.position.set(p.pos_x - center.x * s, -b.min.y * s, p.pos_z - center.z * s);
          model.rotation.y = (p.rot_y * Math.PI) / 180;
          model.castShadow = true;
          model.traverse((c) => { if ((c as THREE.Mesh).isMesh) (c as THREE.Mesh).castShadow = true; });
          model.userData = { placementPk: p.pk };
          model.name = `placement-${p.pk}`;
          sceneRef.current?.scene.add(model);
          sceneRef.current?.placedMeshes.set(p.pk, model);
        });
      }
    }

    const activePks = new Set(room.placements.map((p) => p.pk));
    const { scene, placedMeshes } = ss;
    Array.from(placedMeshes.entries()).forEach(([pk, mesh]) => {
      if (!activePks.has(pk)) {
        scene.remove(mesh);
        placedMeshes.delete(pk);
      }
    });
  }, [room]);

  const handleCanvasDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  };

  const handleCanvasDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    const machinePk = Number(e.dataTransfer.getData("machinePk"));
    if (!machinePk || !sceneRef.current) return;

    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const ny = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    const ss = sceneRef.current;
    ss.raycaster.setFromCamera(new THREE.Vector2(nx, ny), ss.camera);
    const hits = ss.raycaster.intersectObject(ss.floor);
    const pos = hits[0]?.point ?? new THREE.Vector3(0, 0, 0);

    try {
      await addMachinePlacement({ machine: machinePk, pos_x: pos.x, pos_z: pos.z });
      queryClient.invalidateQueries({ queryKey: ["weldingRoom"] });
      toast({ title: t("ep.dashboard.layout.placedSuccess"), status: "success", duration: 1500, position: "bottom-right" });
    } catch {
      toast({ title: t("ep.dashboard.layout.placeFailed"), status: "warning", duration: 2000, position: "bottom-right" });
    }
    setIsDraggingMachine(null);
  };

  const dragStartPos = useRef<{ x: number; y: number } | null>(null);
  const selectedPlacementRef = useRef<number | null>(null);

  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if (!editMode || !sceneRef.current) return;
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const ny = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    const ss = sceneRef.current;
    ss.raycaster.setFromCamera(new THREE.Vector2(nx, ny), ss.camera);

    const meshes = Array.from(ss.placedMeshes.values());
    const hits = ss.raycaster.intersectObjects(meshes, true);
    if (hits[0]) {
      let obj: THREE.Object3D | null = hits[0].object;
      while (obj && !obj.userData.placementPk) obj = obj.parent;
      if (obj?.userData.placementPk) {
        selectedPlacementRef.current = obj.userData.placementPk;
        setSelectedPk(obj.userData.placementPk);
        dragStartPos.current = { x: e.clientX, y: e.clientY };
        ss.controls.enabled = false;
      }
    } else {
      setSelectedPk(null);
      selectedPlacementRef.current = null;
    }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent) => {
    if (!editMode || !dragStartPos.current || !sceneRef.current) return;
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const ny = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    const ss = sceneRef.current;
    ss.raycaster.setFromCamera(new THREE.Vector2(nx, ny), ss.camera);
    const hits = ss.raycaster.intersectObject(ss.floor);
    if (!hits[0] || !selectedPlacementRef.current) return;
    const pos = hits[0].point;
    const mesh = ss.placedMeshes.get(selectedPlacementRef.current);
    if (mesh) {
      mesh.position.x = pos.x;
      mesh.position.z = pos.z;
    }
  };

  const handleCanvasMouseUp = async () => {
    const ss = sceneRef.current;
    if (!ss) return;
    ss.controls.enabled = true;
    if (!selectedPlacementRef.current || !dragStartPos.current) return;
    dragStartPos.current = null;
    const mesh = ss.placedMeshes.get(selectedPlacementRef.current);
    if (!mesh) return;
    try {
      await updateMachinePlacement(selectedPlacementRef.current, {
        pos_x: mesh.position.x,
        pos_z: mesh.position.z,
      });
      queryClient.invalidateQueries({ queryKey: ["weldingRoom"] });
    } catch {
      toast({ title: t("ep.dashboard.layout.positionFailed"), status: "error", duration: 2000, position: "bottom-right" });
    }
  };

  const handleRemovePlacement = async (pk: number) => {
    try {
      await removeMachinePlacement(pk);
      queryClient.invalidateQueries({ queryKey: ["weldingRoom"] });
      setSelectedPk(null);
      toast({ title: t("ep.dashboard.layout.removedSuccess"), status: "success", duration: 1500, position: "bottom-right" });
    } catch {
      toast({ title: t("ep.dashboard.layout.removeFailed"), status: "error", duration: 2000, position: "bottom-right" });
    }
  };

  const openMachinePopup = (machinePk: number) => {
    const url = `${window.location.origin}/machines/${machinePk}`;
    const width = 1000;
    const height = 760;
    const left = Math.round(window.screenX + (window.outerWidth - width) / 2);
    const top = Math.round(window.screenY + (window.outerHeight - height) / 2);
    window.open(url, `machine-${machinePk}`, `width=${width},height=${height},left=${left},top=${top},menubar=no,toolbar=no,location=no,status=no,resizable=yes,scrollbars=yes`);
  };

  const handleRotate = async (pk: number, delta: number) => {
    const p = room?.placements.find((p) => p.pk === pk);
    if (!p) return;
    const newRot = (p.rot_y + delta + 360) % 360;
    const mesh = sceneRef.current?.placedMeshes.get(pk);
    if (mesh) mesh.rotation.y = (newRot * Math.PI) / 180;
    await updateMachinePlacement(pk, { rot_y: newRot });
    queryClient.invalidateQueries({ queryKey: ["weldingRoom"] });
  };

  const todayStr = useMemo(
    () =>
      new Date().toLocaleDateString(
        i18n.language?.startsWith("ko") ? "ko-KR" : "en-GB",
        { year: "numeric", month: "long", day: "numeric" }
      ),
    [i18n.language]
  );

  const selectedPlacement = room?.placements.find((p) => p.pk === selectedPk);

  return (
    <>
      <Helmet>
        <title>{t("ep.dashboard.pageTitle")}</title>
      </Helmet>
      <Box bg={pageBg} minH="100vh" px={{ base: 4, md: 20 }} py={6}>
        {/* Header */}
        <Flex align="baseline" justify="space-between" mb={6} wrap="wrap" gap={2}>
          <Box>
            <Heading size="lg" fontWeight="bold">
              {t("ep.dashboard.heading")}
            </Heading>
            <Text fontSize="sm" color="gray.500" mt={0.5}>
              {t("ep.dashboard.subtitleRealtime")} — {todayStr}
            </Text>
          </Box>
          <HStack spacing={3}>
            <Button
              size="sm"
              onClick={handleFactoryAnalysis}
              isLoading={aiLoading}
              loadingText={t("ep.dashboard.aiAnalysis.loading")}
              leftIcon={<FaBrain size={13} />}
              isDisabled={!room?.placements.length}
              bgGradient="linear(to-r, purple.500, blue.500)"
              color="white"
              _hover={{ bgGradient: "linear(to-r, purple.600, blue.600)" }}
              _active={{ bgGradient: "linear(to-r, purple.700, blue.700)" }}
              _loading={{ opacity: 0.7 }}
              borderRadius="full"
              px={5}
              fontWeight="semibold"
              letterSpacing="tight"
              boxShadow="0 2px 8px rgba(128,90,213,0.35)"
            >
              {t("ep.dashboard.aiAnalysis.button")}
            </Button>
            <Tooltip label={t("ep.dashboard.aiAnalysis.historyButton")} placement="bottom" hasArrow>
              <IconButton
                aria-label={t("ep.dashboard.aiAnalysis.historyButton")}
                icon={<FaHistory size={13} />}
                size="sm"
                variant="outline"
                colorScheme="purple"
                borderRadius="full"
                onClick={() => navigate("/ai-reports")}
              />
            </Tooltip>
            <Tooltip label={t("ep.dashboard.displayMode")} placement="bottom" hasArrow>
              <IconButton
                aria-label={t("ep.dashboard.displayMode")}
                icon={<FaDesktop size={13} />}
                size="sm"
                variant="outline"
                colorScheme="teal"
                borderRadius="full"
                onClick={() => window.open("/public/factory-display", "_blank")}
              />
            </Tooltip>
            <Badge colorScheme="green" fontSize="xs" px={3} py={1} borderRadius="full">
              {t("ep.dashboard.liveBadge")}
            </Badge>
          </HStack>
        </Flex>

        {/* ── KPI Cards ── */}
        {(!roomLoading && (room?.placements.length ?? 0) > 0) && (() => {
          const placements = room?.placements ?? [];
          const total = placements.length;
          const runningCount = placements.filter((p) => {
            if (!p.machine_iot_id) return false;
            const r = liveReadings.get(p.machine_iot_id);
            return !!r && Date.now() - r.receivedAt <= 30_000;
          }).length;
          const abnormalCount = placements.filter((p) => {
            if (!p.machine_iot_id) return false;
            const r = liveReadings.get(p.machine_iot_id);
            if (!r || Date.now() - r.receivedAt > 30_000) return false;
            if (p.iot_std_hot_temp_c == null || p.iot_tolerance_temp_c == null) return false;
            const tol = p.iot_tolerance_temp_c;
            const hotOk = Math.abs(r.value_temp_1 - p.iot_std_hot_temp_c) <= tol;
            const coldOk = p.iot_std_cold_temp_c != null ? Math.abs(r.value_temp_2 - p.iot_std_cold_temp_c) <= tol : true;
            return !(hotOk && coldOk);
          }).length;
          const recentReport = (aiReports?.length ?? 0) > 0 ? aiReports![0] : null;
          const langKey = i18n.language?.startsWith("ko") ? "ko" : i18n.language?.startsWith("vi") ? "vi" : "en";
          const rContent = recentReport ? (recentReport.content?.[langKey] ?? recentReport.content?.[recentReport.primary_language] ?? Object.values(recentReport.content ?? {})[0]) : null;
          return (
            <HStack spacing={3} mb={5} align="stretch">
              {/* KPI cards */}
              {[
                { label: t("ep.dashboard.machineKpi.totalPlaced"), value: total, color: "blue.600", border: "blue.100" },
                { label: t("ep.dashboard.machineKpi.running"), value: runningCount, color: "green.600", border: "green.100" },
                { label: t("ep.dashboard.machineKpi.abnormal"), value: abnormalCount, color: abnormalCount > 0 ? "red.600" : "gray.400", border: abnormalCount > 0 ? "red.100" : "gray.200" },
              ].map(({ label, value, color, border }) => (
                <Box
                  key={label}
                  flex={1}
                  bg={cardBg}
                  borderRadius="xl"
                  border="1px solid"
                  borderColor={border}
                  px={4}
                  py={3}
                  shadow="sm"
                >
                  <Text fontSize="2xl" fontWeight="800" color={color} lineHeight={1}>{value}</Text>
                  <Text fontSize="xs" color={labelColor} mt={1} fontWeight="medium">{label}</Text>
                </Box>
              ))}

              {/* Most recent AI analysis — same row */}
              {recentReport && (
                <Box
                  flex={2}
                  bg={cardBg}
                  borderRadius="xl"
                  border="1px solid"
                  borderColor={borderColor}
                  px={4}
                  py={3}
                  shadow="sm"
                  cursor="pointer"
                  _hover={{ shadow: "md", borderColor: "purple.300" }}
                  transition="all 0.15s"
                  onClick={() => navigate(`/ai-reports/${recentReport.id}`)}
                >
                  <HStack justify="space-between" mb={1.5}>
                    <Text fontSize="xs" fontWeight="semibold" color={labelColor}>{t("ep.dashboard.recentAi.title")}</Text>
                    <Button size="xs" variant="ghost" colorScheme="purple" rightIcon={<FaChevronRight size={9} />}
                      onClick={(e) => { e.stopPropagation(); navigate("/ai-reports"); }} px={1} h="auto" minH={0} fontSize="10px">
                      {t("ep.dashboard.recentAi.viewAll")}
                    </Button>
                  </HStack>
                  <HStack spacing={2}>
                    <Badge
                      colorScheme={{ ok: "green", warning: "orange", critical: "red" }[recentReport.overall_severity] ?? "gray"}
                      fontSize="9px" flexShrink={0}
                    >
                      {recentReport.overall_severity.toUpperCase()}
                    </Badge>
                    <Text fontSize="xs" color={labelColor} noOfLines={1} flex={1}>{rContent?.summary ?? "—"}</Text>
                    <Text fontSize="9px" color={labelColor} flexShrink={0}>{new Date(recentReport.created_at).toLocaleDateString()}</Text>
                  </HStack>
                </Box>
              )}
            </HStack>
          );
        })()}

        {/* ── Machine Status Summary ── */}
        {(!roomLoading && (room?.placements.length ?? 0) > 0) && (
          <HStack spacing={2} mb={5} overflowX="auto" pb={1} align="stretch">
            {(room?.placements ?? []).map((p) => {
              const reading = p.machine_iot_id ? liveReadings.get(p.machine_iot_id) : undefined;
              const isStale = !reading || Date.now() - reading.receivedAt > 30_000;
              const running = !isStale;
              let signal: "green" | "red" | "gray" = "gray";
              if (running && p.iot_std_hot_temp_c != null && p.iot_tolerance_temp_c != null) {
                const tol = p.iot_tolerance_temp_c;
                const hotOk = Math.abs(reading!.value_temp_1 - p.iot_std_hot_temp_c) <= tol;
                const coldOk = p.iot_std_cold_temp_c != null ? Math.abs(reading!.value_temp_2 - p.iot_std_cold_temp_c) <= tol : true;
                signal = (hotOk && coldOk) ? "green" : "red";
              } else if (running) { signal = "green"; }
              const dotColor = { green: "green.400", red: "red.400", gray: "gray.400" }[signal];
              const badgeScheme = { green: "green", red: "red", gray: "gray" }[signal];
              const thumb = p.thumbnail;
              return (
                <Box
                  key={p.pk}
                  flexShrink={0}
                  bg={cardBg}
                  borderRadius="lg"
                  border="1.5px solid"
                  borderColor={signal === "green" ? "green.200" : signal === "red" ? "red.200" : borderColor}
                  px={3} py={2}
                  shadow="sm"
                  minW="130px"
                >
                  <HStack spacing={2} mb={1}>
                    <Box w="24px" h="24px" flexShrink={0} borderRadius="md" overflow="hidden" border="1px solid" borderColor={borderColor} bg="gray.100" display="flex" alignItems="center" justifyContent="center">
                      {thumb ? <img src={thumb} alt={p.machine_code} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <Text fontSize="12px">⚙️</Text>}
                    </Box>
                    <Text fontSize="xs" fontWeight="bold" noOfLines={1} flex={1}>{p.machine_code}</Text>
                  </HStack>
                  <HStack justify="space-between">
                    <HStack spacing={1}>
                      <Box w="5px" h="5px" borderRadius="full" bg={dotColor} />
                      <Text fontSize="9px" color={dotColor} fontWeight="semibold">
                        {running ? t("ep.dashboard.machineSummary.running") : t("ep.dashboard.machineSummary.stopped")}
                      </Text>
                    </HStack>
                    {p.machine_iot_id ? (
                      <Badge colorScheme={badgeScheme} fontSize="8px" variant="subtle">
                        {signal === "green" ? t("ep.dashboard.machineSummary.normal") : signal === "red" ? t("ep.dashboard.machineSummary.abnormal") : "—"}
                      </Badge>
                    ) : (
                      <Text fontSize="9px" color="gray.400">{t("ep.dashboard.machineSummary.noIot")}</Text>
                    )}
                  </HStack>
                  {running && reading && (
                    <HStack justify="space-between" mt={1} fontSize="9px">
                      <Text color="red.500" fontWeight="600">🔥{reading.value_temp_1.toFixed(1)}°</Text>
                      <Text color="blue.500" fontWeight="600">❄️{reading.value_temp_2.toFixed(1)}°</Text>
                    </HStack>
                  )}
                </Box>
              );
            })}
          </HStack>
        )}

        {/* Welding Room content */}
        {roomLoading ? (
          <Box display="flex" alignItems="center" justifyContent="center" minH="60vh">
            <Spinner size="xl" />
          </Box>
        ) : (
          <>
            <HStack justify="flex-end" mb={5} spacing={2}>
              <Button
                size="sm"
                colorScheme="blue"
                borderRadius="full"
                isLoading={layoutSaving}
                loadingText={t("ep.dashboard.layout.saving")}
                onClick={handleSaveLayout}
              >
                📌 {t("ep.dashboard.layout.saveLayout")}
              </Button>
              <Button
                size="sm"
                colorScheme={editMode ? "orange" : "teal"}
                variant={editMode ? "solid" : "outline"}
                onClick={() => { setEditMode(!editMode); setSelectedPk(null); }}
              >
                {editMode ? t("ep.dashboard.layout.editDone") : t("ep.dashboard.layout.editLayout")}
              </Button>
            </HStack>

            <Flex align="flex-start" gap={4} direction={{ base: "column", lg: "row" }}>
              {editMode && (
                <Box
                  w={{ base: "100%", lg: "220px" }}
                  flexShrink={0}
                  bg={cardBg}
                  borderRadius="xl"
                  border="1px solid"
                  borderColor={borderColor}
                  p={4}
                  shadow="sm"
                >
                  <Text fontSize="xs" fontWeight="semibold" color={labelColor} mb={3}>
                    {t("ep.dashboard.layout.unplacedMachines", { count: unplacedMachines.length })}
                  </Text>
                  <VStack spacing={2} align="stretch">
                    {unplacedMachines.length === 0 && (
                      <Text fontSize="xs" color="gray.400">{t("ep.dashboard.layout.allPlaced")}</Text>
                    )}
                    {unplacedMachines.map((m) => (
                      <Box
                        key={m.pk}
                        p={2}
                        borderRadius="md"
                        border="1px solid"
                        borderColor={borderColor}
                        cursor="grab"
                        fontSize="xs"
                        _hover={{ bg: itemHoverBg, borderColor: "teal.400" }}
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData("machinePk", String(m.pk));
                          setIsDraggingMachine(m.pk);
                        }}
                        onDragEnd={() => setIsDraggingMachine(null)}
                      >
                        <HStack spacing={2} align="center">
                          <Box
                            w="32px" h="32px" flexShrink={0} borderRadius="md" overflow="hidden"
                            border="1px solid" borderColor={borderColor} bg="gray.100"
                            display="flex" alignItems="center" justifyContent="center"
                          >
                            {m.thumbnail
                              ? <img src={m.thumbnail} alt={m.code} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                              : <Text fontSize="14px">⚙️</Text>
                            }
                          </Box>
                          <Box minW={0} flex={1}>
                            <Text fontWeight="semibold" noOfLines={1}>{m.code}</Text>
                            <Text color={labelColor} noOfLines={1}>{m.name}</Text>
                            {m.machine_iot_id && (
                              <Badge colorScheme="teal" fontSize="9px" mt={0.5}>IoT {m.machine_iot_id}</Badge>
                            )}
                          </Box>
                        </HStack>
                      </Box>
                    ))}
                  </VStack>
                </Box>
              )}

              <Box flex={{ base: "none", lg: 1 }} w={{ base: "100%", lg: "auto" }}>
                <Box
                  bg={cardBg}
                  borderRadius="xl"
                  border="2px solid"
                  borderColor={isDraggingMachine !== null ? "teal.400" : borderColor}
                  overflow="hidden"
                  shadow="sm"
                  position="relative"
                  ref={containerRef}
                  transition="border-color 0.15s"
                >
                  <canvas
                    ref={canvasRef}
                    style={{ display: "block", width: "100%", height: isFullscreen ? "100vh" : CANVAS_H }}
                    onDragOver={handleCanvasDragOver}
                    onDrop={handleCanvasDrop}
                    onMouseDown={handleCanvasMouseDown}
                    onMouseMove={handleCanvasMouseMove}
                    onMouseUp={handleCanvasMouseUp}
                  />
                  {room && (
                    <MachineInfoOverlay
                      placements={room.placements}
                      readings={liveReadings}
                      sceneRef={sceneRef}
                      canvasRef={canvasRef}
                      onCardClick={handleCardClick}
                      offsetRefs={cardOffsetRefs}
                    />
                  )}
                  {isDraggingMachine !== null && (
                    <Box
                      position="absolute"
                      inset={0}
                      display="flex"
                      alignItems="center"
                      justifyContent="center"
                      pointerEvents="none"
                    >
                      <Badge colorScheme="teal" fontSize="md" px={4} py={2} borderRadius="lg">
                        {t("ep.dashboard.layout.dropHint")}
                      </Badge>
                    </Box>
                  )}
                  {editMode && (
                    <Badge
                      position="absolute"
                      top={3}
                      left={3}
                      colorScheme="orange"
                      fontSize="xs"
                    >
                      {t("ep.dashboard.layout.editModeBadge")}
                    </Badge>
                  )}
                  <IconButton
                    aria-label={isFullscreen ? "전체화면 종료" : "전체화면"}
                    icon={isFullscreen ? <FaCompress /> : <FaExpand />}
                    size="sm"
                    position="absolute"
                    top={3}
                    right={3}
                    onClick={handleToggleFullscreen}
                    bg="blackAlpha.500"
                    color="white"
                    _hover={{ bg: "blackAlpha.700" }}
                  />
                </Box>

                {editMode && selectedPlacement && (
                  <Box
                    mt={3}
                    bg={cardBg}
                    border="1px solid"
                    borderColor="orange.300"
                    borderRadius="xl"
                    p={4}
                    shadow="sm"
                  >
                    <HStack justify="space-between">
                      <VStack align="flex-start" spacing={0}>
                        <Text fontWeight="semibold" fontSize="sm">{selectedPlacement.machine_code}</Text>
                        <Text fontSize="xs" color={labelColor}>{selectedPlacement.machine_name}</Text>
                      </VStack>
                      <HStack>
                        <Text fontSize="xs" color={labelColor}>{t("ep.dashboard.layout.rotate")}</Text>
                        <Button size="xs" onClick={() => handleRotate(selectedPlacement.pk, -15)}>◀ 15°</Button>
                        <Text fontSize="xs" fontWeight="semibold">{Math.round(selectedPlacement.rot_y)}°</Text>
                        <Button size="xs" onClick={() => handleRotate(selectedPlacement.pk, 15)}>15° ▶</Button>
                        <Divider orientation="vertical" h="20px" />
                        <Button
                          size="xs"
                          colorScheme="red"
                          leftIcon={<FaTrash />}
                          onClick={() => handleRemovePlacement(selectedPlacement.pk)}
                        >
                          {t("ep.dashboard.layout.remove")}
                        </Button>
                      </HStack>
                    </HStack>
                  </Box>
                )}
              </Box>

              <Box
                w={{ base: "100%", lg: "200px" }}
                flexShrink={0}
                bg={cardBg}
                borderRadius="xl"
                border="1px solid"
                borderColor={borderColor}
                p={4}
                shadow="sm"
              >
                <Text fontSize="xs" fontWeight="semibold" color={labelColor} mb={3}>
                  {t("ep.dashboard.layout.placedMachines", { count: room?.placements.length ?? 0 })}
                </Text>
                <VStack spacing={2} align="stretch">
                  {(room?.placements ?? []).map((p) => {
                    const thumb = p.thumbnail;
                    return (
                    <Box
                      key={p.pk}
                      p={2}
                      borderRadius="md"
                      border="1px solid"
                      borderColor={selectedPk === p.pk ? "orange.400" : borderColor}
                      cursor="pointer"
                      fontSize="xs"
                      onClick={() => setSelectedPk(p.pk === selectedPk ? null : p.pk)}
                      _hover={{ borderColor: "orange.300" }}
                    >
                      <HStack spacing={2} align="center">
                        <Box
                          w="36px"
                          h="36px"
                          flexShrink={0}
                          borderRadius="md"
                          overflow="hidden"
                          border="1px solid"
                          borderColor={borderColor}
                          bg="gray.100"
                          display="flex"
                          alignItems="center"
                          justifyContent="center"
                        >
                          {thumb ? (
                            <img
                              src={thumb}
                              alt={p.machine_code}
                              style={{ width: "100%", height: "100%", objectFit: "cover" }}
                            />
                          ) : (
                            <Text fontSize="16px">⚙️</Text>
                          )}
                        </Box>
                        <Box minW={0} flex={1}>
                          <Text fontWeight="semibold" noOfLines={1}>{p.machine_code}</Text>
                          <Text color={labelColor} noOfLines={1}>{p.machine_name}</Text>
                        </Box>
                        <IconButton
                          aria-label={t("ep.dashboard.layout.machineDetails")}
                          icon={<FaExternalLinkAlt size={10} />}
                          size="xs"
                          variant="ghost"
                          color={labelColor}
                          flexShrink={0}
                          onClick={(e) => {
                            e.stopPropagation();
                            openMachinePopup(p.machine_pk);
                          }}
                          _hover={{ color: "blue.400" }}
                        />
                      </HStack>
                    </Box>
                    );
                  })}
                  {!room?.placements.length && (
                    <Text fontSize="xs" color="gray.400">
                      {editMode ? t("ep.dashboard.layout.dragToPlace") : t("ep.dashboard.layout.noPlaced")}
                    </Text>
                  )}
                </VStack>
              </Box>
            </Flex>
          </>
        )}

        {/* AI Factory Overview Analysis Modal */}
        <Modal isOpen={isAiOpen} onClose={onAiClose} size="xl" scrollBehavior="inside">
          <ModalOverlay />
          <ModalContent>
            <ModalHeader>
              <HStack spacing={2}>
                <Box
                  p={1.5}
                  bgGradient="linear(to-br, purple.500, blue.500)"
                  borderRadius="md"
                  display="flex"
                  alignItems="center"
                  justifyContent="center"
                >
                  <FaBrain size={14} color="white" />
                </Box>
                <Text>{t("ep.dashboard.aiAnalysis.modalTitle")}</Text>
                {aiResult && (
                  <Badge
                    colorScheme={
                      aiResult.overall_severity === "ok" ? "green"
                        : aiResult.overall_severity === "critical" ? "red"
                        : "orange"
                    }
                  >
                    {t(`ep.dashboard.aiAnalysis.severity.${aiResult.overall_severity}`)}
                  </Badge>
                )}
              </HStack>
            </ModalHeader>
            <ModalCloseButton />
            <ModalBody>
              {(aiLoading || (aiStreamText && !aiResult)) && (() => {
                const displayText = aiStreamText.split("---JSON---")[0];
                const isFinalizingJson = aiStreamText.includes("---JSON---");
                return (
                  <Box borderRadius="xl" overflow="hidden" border="1px solid" borderColor="purple.400" bg="gray.900" position="relative">
                    {/* Animated gradient header */}
                    <Box
                      px={4}
                      py={3}
                      sx={{
                        background: "linear-gradient(90deg, #44337a, #2c5282, #44337a)",
                        backgroundSize: "200% 100%",
                        "@keyframes gradShift": {
                          "0%": { backgroundPosition: "0% 50%" },
                          "50%": { backgroundPosition: "100% 50%" },
                          "100%": { backgroundPosition: "0% 50%" },
                        },
                        animation: "gradShift 3s ease infinite",
                      }}
                    >
                      <HStack justify="space-between">
                        <HStack spacing={3}>
                          <Box
                            sx={{
                              "@keyframes pulseBrain": {
                                "0%, 100%": { opacity: 1, transform: "scale(1)" },
                                "50%": { opacity: 0.6, transform: "scale(1.15)" },
                              },
                              animation: "pulseBrain 1.4s ease-in-out infinite",
                            }}
                          >
                            <FaBrain size={16} color="white" />
                          </Box>
                          <Text fontSize="sm" fontWeight="bold" color="white" letterSpacing="wide">
                            {isFinalizingJson ? t("ep.dashboard.aiAnalysis.streamFinalizing") : t("ep.dashboard.aiAnalysis.streamTitle")}
                          </Text>
                        </HStack>
                        <HStack spacing={1.5}>
                          {[0, 1, 2].map((i) => (
                            <Box
                              key={i}
                              w="7px" h="7px"
                              borderRadius="full"
                              bg="purple.200"
                              sx={{
                                "@keyframes dotBounce": {
                                  "0%, 100%": { transform: "translateY(0px)", opacity: 0.4 },
                                  "50%": { transform: "translateY(-5px)", opacity: 1 },
                                },
                                animation: `dotBounce 1.2s ease-in-out ${i * 0.2}s infinite`,
                              }}
                            />
                          ))}
                        </HStack>
                      </HStack>
                    </Box>

                    {/* Scanning line */}
                    <Box
                      position="absolute"
                      left={0} right={0}
                      h="1px"
                      bgGradient="linear(to-r, transparent, purple.400, blue.400, transparent)"
                      sx={{
                        "@keyframes scanLine": {
                          "0%": { top: "52px", opacity: 0 },
                          "5%": { opacity: 1 },
                          "95%": { opacity: 1 },
                          "100%": { top: "calc(100% - 3px)", opacity: 0 },
                        },
                        animation: "scanLine 2.5s linear infinite",
                      }}
                    />

                    {/* Status indicator row */}
                    <HStack
                      px={4} py={2}
                      borderBottom="1px solid"
                      borderColor="gray.700"
                      spacing={5}
                    >
                      {[
                        { label: t("ep.dashboard.aiAnalysis.streamStep1"), delay: "0s" },
                        { label: t("ep.dashboard.aiAnalysis.streamStep2"), delay: "0.3s" },
                        { label: t("ep.dashboard.aiAnalysis.streamStep3"), delay: "0.6s" },
                        { label: t("ep.dashboard.aiAnalysis.streamStep4"), delay: "0.9s" },
                      ].map(({ label, delay }) => (
                        <HStack key={label} spacing={1.5}>
                          <Box
                            w="5px" h="5px"
                            borderRadius="full"
                            bg="green.400"
                            sx={{
                              "@keyframes statusBlink": {
                                "0%, 100%": { opacity: 0.25, boxShadow: "none" },
                                "50%": { opacity: 1, boxShadow: "0 0 4px #48bb78" },
                              },
                              animation: `statusBlink 1.1s ${delay} ease-in-out infinite`,
                            }}
                          />
                          <Text fontSize="9px" color="gray.400" fontFamily="mono">{label}</Text>
                        </HStack>
                      ))}
                    </HStack>

                    {/* Terminal text stream */}
                    <Box p={4} minH="180px" maxH="280px" overflowY="auto" fontFamily="mono">
                      <Text
                        fontSize="xs"
                        color="green.300"
                        whiteSpace="pre-wrap"
                        lineHeight="1.9"
                        sx={{
                          "&::after": {
                            content: '"▋"',
                            display: "inline",
                            color: "purple.300",
                            "@keyframes cursorBlink": {
                              "0%, 100%": { opacity: 1 },
                              "50%": { opacity: 0 },
                            },
                            animation: "cursorBlink 0.7s step-end infinite",
                          },
                        }}
                      >
                        {displayText || ""}
                      </Text>
                    </Box>

                    {/* Progress bar */}
                    <Box h="3px" bg="gray.800">
                      <Box
                        h="100%"
                        sx={{
                          background: "linear-gradient(90deg, #805ad5, #4299e1, #805ad5)",
                          backgroundSize: "200% 100%",
                          "@keyframes progressAnim": {
                            "0%": { width: "5%", backgroundPosition: "0% 0%" },
                            "50%": { width: "75%", backgroundPosition: "100% 0%" },
                            "100%": { width: "95%", backgroundPosition: "200% 0%" },
                          },
                          animation: "progressAnim 4s ease-in-out infinite",
                        }}
                      />
                    </Box>
                  </Box>
                );
              })()}

              {aiError && (
                <Alert status="error" borderRadius="md">
                  <AlertIcon />
                  {aiError}
                </Alert>
              )}

              {aiResult && !aiLoading && (
                <VStack align="stretch" spacing={5}>
                  <Box
                    p={4}
                    borderRadius="lg"
                    bg={
                      aiResult.overall_severity === "ok" ? "green.50"
                        : aiResult.overall_severity === "critical" ? "red.50"
                        : "orange.50"
                    }
                    border="1px solid"
                    borderColor={
                      aiResult.overall_severity === "ok" ? "green.200"
                        : aiResult.overall_severity === "critical" ? "red.200"
                        : "orange.200"
                    }
                  >
                    <Text fontSize="sm" fontWeight="semibold" mb={1}>📋 {t("ep.dashboard.aiAnalysis.overallStatus")}</Text>
                    <Text fontSize="sm">{aiResult.summary}</Text>
                  </Box>

                  {aiResult.machine_issues.length > 0 && (
                    <Box>
                      <Text fontSize="sm" fontWeight="bold" mb={3}>
                        ⚠️ {t("ep.dashboard.aiAnalysis.problematicMachines")} ({aiResult.machine_issues.length})
                      </Text>
                      <VStack align="stretch" spacing={3}>
                        {aiResult.machine_issues.map((mi, i) => (
                          <Box
                            key={i}
                            p={3}
                            borderRadius="md"
                            border="1px solid"
                            borderColor={mi.severity === "critical" ? "red.300" : "orange.300"}
                            bg={mi.severity === "critical" ? "red.50" : "orange.50"}
                          >
                            <HStack mb={2} justify="space-between">
                              <Text fontSize="sm" fontWeight="semibold">{mi.machine_name}</Text>
                              <HStack spacing={2}>
                                <Text fontSize="xs" color="gray.500">IoT: {mi.machine_iot_id}</Text>
                                <Badge colorScheme={mi.severity === "critical" ? "red" : "orange"} fontSize="10px">
                                  {t(`ep.dashboard.aiAnalysis.severity.${mi.severity}`)}
                                </Badge>
                              </HStack>
                            </HStack>
                            <List spacing={1}>
                              {mi.issues.map((issue, j) => (
                                <ListItem key={j} fontSize="xs" color="gray.700">• {issue}</ListItem>
                              ))}
                            </List>
                          </Box>
                        ))}
                      </VStack>
                    </Box>
                  )}

                  {aiResult.machine_issues.length === 0 && (
                    <Box p={3} borderRadius="md" bg="green.50" border="1px solid" borderColor="green.200">
                      <Text fontSize="sm" color="green.700">✅ {t("ep.dashboard.aiAnalysis.allNormal")}</Text>
                    </Box>
                  )}

                  {aiResult.recommendations.length > 0 && (
                    <Box>
                      <Text fontSize="sm" fontWeight="bold" mb={2}>💡 {t("ep.dashboard.aiAnalysis.recommendations")}</Text>
                      <List spacing={1}>
                        {aiResult.recommendations.map((rec, i) => (
                          <ListItem key={i} fontSize="sm" color="gray.700">• {rec}</ListItem>
                        ))}
                      </List>
                    </Box>
                  )}
                </VStack>
              )}
            </ModalBody>
            <ModalFooter>
              <HStack spacing={3} w="100%" justify="space-between">
                <HStack spacing={2}>
                  {aiResult && !aiSaving && !aiSaved && (
                    <Button
                      size="sm"
                      colorScheme="purple"
                      onClick={handleSaveReport}
                    >
                      {t("ep.dashboard.aiAnalysis.saveReport")}
                    </Button>
                  )}
                  {aiSaving && (
                    <HStack
                      spacing={2}
                      px={3}
                      py={2}
                      bg="purple.50"
                      borderRadius="lg"
                      border="1px solid"
                      borderColor="purple.200"
                      minW="260px"
                    >
                      <Spinner size="xs" color="purple.500" flexShrink={0} />
                      <Text
                        key={savingMsgIdx}
                        fontSize="xs"
                        color="purple.700"
                        fontWeight="medium"
                        sx={{
                          "@keyframes fadeMsg": {
                            "0%": { opacity: 0, transform: "translateY(4px)" },
                            "15%": { opacity: 1, transform: "translateY(0)" },
                            "85%": { opacity: 1, transform: "translateY(0)" },
                            "100%": { opacity: 0, transform: "translateY(-4px)" },
                          },
                          animation: "fadeMsg 2.2s ease-in-out infinite",
                        }}
                      >
                        {SAVING_STEPS[savingMsgIdx]}
                      </Text>
                    </HStack>
                  )}
                  {aiSaved && (
                    <HStack spacing={2}>
                      <Button size="sm" colorScheme="green" isDisabled>
                        ✓ {t("ep.dashboard.aiAnalysis.alreadySaved")}
                      </Button>
                      <Button size="sm" variant="ghost" colorScheme="purple" onClick={() => navigate("/ai-reports")}>
                        {t("ep.dashboard.aiAnalysis.historyButton")} →
                      </Button>
                    </HStack>
                  )}
                </HStack>
                <HStack spacing={3}>
                  <Button
                    size="sm"
                    colorScheme="purple"
                    variant="outline"
                    onClick={handleFactoryAnalysis}
                    isLoading={aiLoading}
                  >
                    {t("ep.dashboard.aiAnalysis.reanalyze")}
                  </Button>
                  <Button size="sm" onClick={onAiClose}>{t("ep.dashboard.aiAnalysis.close")}</Button>
                </HStack>
              </HStack>
            </ModalFooter>
          </ModalContent>
        </Modal>

        {iotPlacement?.machine_iot_id && (
          <WeldingRoomIoTModal
            isOpen={isIoTOpen}
            onClose={handleIoTClose}
            machineIotId={iotPlacement.machine_iot_id}
            machineName={iotPlacement.machine_name}
            machineCode={iotPlacement.machine_code}
            pressIoT={iotPressIoT}
            activeIotId={iotActiveIotId}
            onSetActiveIotId={setIotActiveIotId}
          />
        )}
      </Box>
    </>
  );
}
