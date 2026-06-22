import { Box, HStack, Text, Badge, Spinner, IconButton, VStack } from "@chakra-ui/react";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { FaExpand, FaCompress } from "react-icons/fa";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { getWeldingRoom, getAIAnalysisReports, IMachinePlacement, IWeldingRoom, IAIAnalysisReport } from "../api";
import { useAllPressIoT, AllPressIoTMap } from "../hooks/useAllPressIoT";

const CANVAS_H = "calc(100vh - 200px)";

interface SceneState {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  placedMeshes: Map<number, THREE.Object3D>;
  floor: THREE.Mesh;
  animId: number;
}

function MachineOverlay({
  placements,
  readings,
  sceneRef,
  canvasRef,
}: {
  placements: IMachinePlacement[];
  readings: AllPressIoTMap;
  sceneRef: React.MutableRefObject<SceneState | null>;
  canvasRef: React.MutableRefObject<HTMLCanvasElement | null>;
}) {
  const cardRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const lineRefs = useRef<Map<number, SVGLineElement>>(new Map());
  const rafRef = useRef<number>(0);
  const offsetRefs = useRef<Map<number, { dx: number; dy: number }>>(new Map());
  const CARD_H = 88;

  useEffect(() => {
    if (!placements.length) return;
    placements.forEach((p) => {
      if (!offsetRefs.current.has(p.pk)) {
        offsetRefs.current.set(p.pk, { dx: p.card_offset_x ?? 0, dy: p.card_offset_y ?? 0 });
      }
    });
  }, [placements]);

  useEffect(() => {
    const tick = () => {
      const ss = sceneRef.current;
      const canvas = canvasRef.current;
      if (ss && canvas) {
        const w = canvas.clientWidth;
        const h = canvas.clientHeight;
        cardRefs.current.forEach((cardEl, pk) => {
          const lineEl = lineRefs.current.get(pk);
          const mesh = ss.placedMeshes.get(pk);
          if (!mesh) { cardEl.style.display = "none"; if (lineEl) lineEl.setAttribute("display", "none"); return; }
          const box = new THREE.Box3().setFromObject(mesh);
          const cx = (box.min.x + box.max.x) / 2;
          const cz = (box.min.z + box.max.z) / 2;
          const cardPos = new THREE.Vector3(cx, box.max.y + 3.5, cz);
          const cardProj = cardPos.clone().project(ss.camera);
          if (cardProj.z > 1) { cardEl.style.display = "none"; if (lineEl) lineEl.setAttribute("display", "none"); return; }
          const offset = offsetRefs.current.get(pk) ?? { dx: 0, dy: 0 };
          const cardX = ((cardProj.x + 1) / 2) * w + offset.dx;
          const cardY = ((-cardProj.y + 1) / 2) * h + offset.dy;
          cardEl.style.display = "block";
          cardEl.style.visibility = "visible";
          cardEl.style.left = `${cardX}px`;
          cardEl.style.top = `${cardY}px`;
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
  }, []);

  return (
    <>
      <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", overflow: "visible" }}>
        {placements.map((p) => (
          <line key={p.pk}
            ref={(el) => { if (el) lineRefs.current.set(p.pk, el); else lineRefs.current.delete(p.pk); }}
            display="none" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" strokeDasharray="4 3" strokeLinecap="round"
          />
        ))}
      </svg>
      {placements.map((p) => {
        const reading = p.machine_iot_id ? readings.get(p.machine_iot_id) : undefined;
        const isStale = !reading || Date.now() - reading.receivedAt > 30_000;
        const running = !isStale;
        let signal: "green" | "red" | "gray" = "gray";
        if (running && p.iot_std_hot_temp_c != null && p.iot_tolerance_temp_c != null) {
          const tol = p.iot_tolerance_temp_c;
          const hotOk = Math.abs(reading!.value_temp_1 - p.iot_std_hot_temp_c) <= tol;
          const coldOk = p.iot_std_cold_temp_c != null ? Math.abs(reading!.value_temp_2 - p.iot_std_cold_temp_c) <= tol : true;
          signal = (hotOk && coldOk) ? "green" : "red";
        } else if (running) { signal = "green"; }

        const headerBg = { green: "#276749", red: "#742a2a", gray: "#2d3748" }[signal];
        const borderColor = { green: "#68d391", red: "#fc8181", gray: "#4a5568" }[signal];
        const statusLabelColor = { green: "#68d391", red: "#fc8181", gray: "#718096" }[signal];
        const barColor = { green: "#48bb78", red: "#fc8181", gray: "#4a5568" }[signal];
        const borderGlow = signal === "green"
          ? "0 0 0 2px #68d391, 0 4px 16px rgba(104,211,145,0.25)"
          : signal === "red"
          ? "0 0 0 2px #fc8181, 0 4px 16px rgba(252,129,129,0.25)"
          : "0 0 0 1px #4a5568";
        const trafficColors = { green: { r: "#2d3748", g: "#68d391" }, red: { r: "#fc8181", g: "#2d3748" }, gray: { r: "#3a4a5c", g: "#3a4a5c" } }[signal];
        const thumb = p.style_thumbnail || p.thumbnail;

        return (
          <div key={p.pk}
            ref={(el) => { if (el) cardRefs.current.set(p.pk, el); else cardRefs.current.delete(p.pk); }}
            style={{ position: "absolute", transform: "translateX(-50%)", visibility: "hidden", width: 138, borderRadius: 8, boxShadow: borderGlow, border: `1.5px solid ${borderColor}`, overflow: "hidden", fontFamily: "sans-serif", fontSize: 9 }}
          >
            <div style={{ background: headerBg, padding: "5px 7px", display: "flex", alignItems: "center", gap: 5 }}>
              <div style={{ width: 32, height: 32, borderRadius: 5, flexShrink: 0, background: "#1a202c", overflow: "hidden", border: "1px solid rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                {thumb ? <img src={thumb} alt={p.machine_code} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ fontSize: 14 }}>⚙️</span>}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 2.5, alignItems: "center", background: "#1a202c", borderRadius: 4, padding: "3px 4px" }}>
                {[trafficColors.r, "#2d3748", trafficColors.g].map((color, i) => (
                  <div key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: color }} />
                ))}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 8, color: "rgba(255,255,255,0.55)", marginBottom: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {p.machine_iot_id ? `IoT: ${p.machine_iot_id}` : p.machine_code}
                </div>
                <div style={{ fontSize: 10, fontWeight: 800, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.machine_name || p.machine_code}</div>
                <div style={{ fontSize: 8, marginTop: 1.5, fontWeight: 600, color: statusLabelColor }}>● {running ? "가동 중" : "정지"}</div>
              </div>
            </div>
            <div style={{ padding: "6px 7px 7px", background: "#fff" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                <span style={{ color: "#e53e3e", fontWeight: 700, fontSize: 10 }}>🔥 {running && reading ? `${reading.value_temp_1}°` : "--"}</span>
                <span style={{ color: "#3182ce", fontWeight: 700, fontSize: 10 }}>❄️ {running && reading ? `${reading.value_temp_2}°` : "--"}</span>
              </div>
              <div style={{ background: "#e2e8f0", borderRadius: 3, height: 4, overflow: "hidden" }}>
                <div style={{ width: running ? "80%" : "8%", height: "100%", background: barColor, borderRadius: 3, transition: "width 0.5s ease" }} />
              </div>
            </div>
            <div style={{ position: "absolute", bottom: -4, left: "50%", transform: "translateX(-50%)", width: 8, height: 8, borderRadius: "50%", background: headerBg, border: "1.5px solid #fff", boxShadow: "0 1px 3px rgba(0,0,0,0.3)" }} />
          </div>
        );
      })}
    </>
  );
}

export default function FactoryDisplay() {
  const { t, i18n } = useTranslation();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<SceneState | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [clock, setClock] = useState(new Date());

  const liveReadings = useAllPressIoT();

  const { data: room, isLoading } = useQuery<IWeldingRoom>({
    queryKey: ["weldingRoom"],
    queryFn: getWeldingRoom,
    refetchInterval: 30_000,
  });

  const { data: aiReports } = useQuery<IAIAnalysisReport[]>({
    queryKey: ["aiAnalysisReports"],
    queryFn: getAIAnalysisReports,
    refetchInterval: 60_000,
  });

  // Clock
  useEffect(() => {
    const id = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // Fullscreen
  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  const handleToggleFullscreen = () => {
    if (!document.fullscreenElement) containerRef.current?.requestFullscreen();
    else document.exitFullscreen();
  };

  // Fix aspect on fullscreen change
  useEffect(() => {
    const ss = sceneRef.current;
    const canvas = canvasRef.current;
    if (!ss || !canvas) return;
    const id = setTimeout(() => {
      const nw = isFullscreen ? window.innerWidth : (canvas.clientWidth || 800);
      const nh = isFullscreen ? window.innerHeight : (canvas.clientHeight || 600);
      if (!nw || !nh) return;
      ss.renderer.setSize(nw, nh, false);
      ss.camera.aspect = nw / nh;
      ss.camera.updateProjectionMatrix();
    }, 50);
    return () => clearTimeout(id);
  }, [isFullscreen]);

  // Three.js scene
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !room) return;
    const w = canvas.parentElement?.clientWidth || 800;
    const h = canvas.clientHeight || 600;
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
      if (savedCam) { controls.target.set(savedCam.tx, savedCam.ty, savedCam.tz); }
      else { controls.target.set(0, 0, 0); }
      controls.update();

      const floor = new THREE.Mesh(
        new THREE.PlaneGeometry(room.width, room.depth),
        new THREE.MeshStandardMaterial({ color: 0xdde3ea, roughness: 0.9 })
      );
      floor.rotation.x = -Math.PI / 2;
      floor.receiveShadow = true;
      scene.add(floor);

      const edges = new THREE.EdgesGeometry(new THREE.BoxGeometry(room.width, 0.05, room.depth));
      const border = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0xa0aec0 }));
      border.position.y = 0.025;
      scene.add(border);
      scene.add(new THREE.GridHelper(Math.max(room.width, room.depth), 20, 0xa0aec0, 0xc8d0db));

      ss = { renderer, scene, camera, controls, placedMeshes: new Map(), floor, animId: 0 };
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
        const box = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.2, 1.2), new THREE.MeshStandardMaterial({ color: 0x4299e1 }));
        box.position.set(p.pos_x, 0.6, p.pos_z);
        box.rotation.y = (p.rot_y * Math.PI) / 180;
        box.castShadow = true;
        box.userData = { placementPk: p.pk };
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
          sceneRef.current?.scene.add(model);
          sceneRef.current?.placedMeshes.set(p.pk, model);
        });
      }
    }
    const activePks = new Set(room.placements.map((p) => p.pk));
    ss.placedMeshes.forEach((mesh, pk) => {
      if (!activePks.has(pk)) { ss!.scene.remove(mesh); ss!.placedMeshes.delete(pk); }
    });
  }, [room]);

  // KPI
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

  const dateStr = clock.toLocaleDateString(i18n.language?.startsWith("ko") ? "ko-KR" : "en-GB", { year: "numeric", month: "long", day: "numeric" });
  const timeStr = clock.toLocaleTimeString(i18n.language?.startsWith("ko") ? "ko-KR" : "en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

  const recentReport = (aiReports?.length ?? 0) > 0 ? aiReports![0] : null;
  const langKey = i18n.language?.startsWith("ko") ? "ko" : i18n.language?.startsWith("vi") ? "vi" : "en";
  const reportContent = recentReport
    ? (recentReport.content?.[langKey] ?? recentReport.content?.[recentReport.primary_language] ?? Object.values(recentReport.content ?? {})[0])
    : null;
  const severityColor: Record<string, string> = { ok: "green", warning: "yellow", critical: "red" };
  const reportDateStr = recentReport
    ? new Date(recentReport.created_at).toLocaleDateString(i18n.language?.startsWith("ko") ? "ko-KR" : "en-GB", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
    : "";

  return (
    <Box minH="100vh" bg="gray.50" ref={containerRef}>
      {/* Header */}
      <Box bg="white" borderBottom="1px solid" borderColor="gray.200" px={6} py={3} shadow="sm">
        <HStack justify="space-between" align="center">
          <Box>
            <Text fontSize="lg" fontWeight="800" color="gray.800" lineHeight={1.2}>
              {t("ep.dashboard.heading")}
            </Text>
            <Text fontSize="xs" color="gray.500" mt={0.5}>{t("ep.dashboard.subtitleRealtime")} — {dateStr}</Text>
          </Box>
          <HStack spacing={4} align="center">
            <Text fontSize="xl" fontWeight="700" color="gray.700" fontFamily="mono">{timeStr}</Text>
            <Badge colorScheme="green" fontSize="xs" px={3} py={1} borderRadius="full">
              {t("ep.dashboard.liveBadge")}
            </Badge>
            <IconButton
              aria-label="fullscreen"
              icon={isFullscreen ? <FaCompress /> : <FaExpand />}
              size="sm"
              variant="ghost"
              onClick={handleToggleFullscreen}
            />
          </HStack>
        </HStack>
      </Box>

      {/* KPI Row */}
      <HStack spacing={3} px={6} pt={4} pb={2}>
        {[
          { label: t("ep.dashboard.machineKpi.totalPlaced"), value: total, color: "blue.600", border: "blue.100" },
          { label: t("ep.dashboard.machineKpi.running"), value: runningCount, color: "green.600", border: "green.100" },
          { label: t("ep.dashboard.machineKpi.abnormal"), value: abnormalCount, color: abnormalCount > 0 ? "red.600" : "gray.400", border: abnormalCount > 0 ? "red.100" : "gray.200" },
        ].map(({ label, value, color, border }) => (
          <Box key={label} flex={1} bg="white" borderRadius="xl" border="1px solid" borderColor={border} px={4} py={3} shadow="sm">
            <Text fontSize="2xl" fontWeight="800" color={color} lineHeight={1}>{value}</Text>
            <Text fontSize="xs" color="gray.500" mt={1} fontWeight="medium">{label}</Text>
          </Box>
        ))}
      </HStack>

      {/* AI Summary */}
      {recentReport && reportContent && (
        <Box px={6} pb={2}>
          <Box bg="white" borderRadius="xl" border="1px solid" borderColor="gray.200" px={4} py={3} shadow="sm">
            <HStack justify="space-between" align="flex-start" spacing={3}>
              <VStack align="flex-start" spacing={1} flex={1} minW={0}>
                <HStack spacing={2}>
                  <Text fontSize="xs" fontWeight="700" color="gray.500" textTransform="uppercase" letterSpacing="wider">
                    {t("ep.dashboard.recentAi.title")}
                  </Text>
                  <Badge colorScheme={severityColor[recentReport.overall_severity] ?? "gray"} fontSize="10px" px={2} borderRadius="full">
                    {recentReport.overall_severity.toUpperCase()}
                  </Badge>
                </HStack>
                <Text fontSize="sm" color="gray.700" noOfLines={2} lineHeight={1.5}>
                  {reportContent.summary}
                </Text>
              </VStack>
              <Text fontSize="10px" color="gray.400" flexShrink={0} mt={1}>{reportDateStr}</Text>
            </HStack>
          </Box>
        </Box>
      )}

      {/* 3D Canvas */}
      {isLoading ? (
        <Box display="flex" alignItems="center" justifyContent="center" h="60vh">
          <Spinner size="xl" />
        </Box>
      ) : (
        <Box px={6} pb={4}>
          <Box bg="white" borderRadius="xl" border="1px solid" borderColor="gray.200" overflow="hidden" shadow="sm" position="relative">
            <canvas
              ref={canvasRef}
              style={{ display: "block", width: "100%", height: isFullscreen ? "100vh" : CANVAS_H }}
            />
            {room && (
              <MachineOverlay
                placements={room.placements}
                readings={liveReadings}
                sceneRef={sceneRef}
                canvasRef={canvasRef}
              />
            )}
          </Box>
        </Box>
      )}
    </Box>
  );
}
