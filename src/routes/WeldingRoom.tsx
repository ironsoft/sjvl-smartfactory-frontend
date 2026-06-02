import {
  Badge,
  Box,
  Button,
  Divider,
  HStack,
  Heading,
  Spinner,
  Text,
  VStack,
  useColorModeValue,
  useDisclosure,
  useToast,
} from "@chakra-ui/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { FaTrash } from "react-icons/fa";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import {
  getWeldingRoom,
  getMachines,
  addMachinePlacement,
  updateMachinePlacement,
  removeMachinePlacement,
  IMachinePlacement,
  IWeldingRoom,
} from "../api";
import { useAllPressIoT, AllPressIoTMap } from "../hooks/useAllPressIoT";
import { usePressIoT } from "../hooks/usePressIoT";
import HotColdPressIoTModal from "../components/HotColdPressIoTModal";

const CANVAS_H = 780;

// ── Three.js scene state (lives outside React) ─────────────────
interface SceneState {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  raycaster: THREE.Raycaster;
  placedMeshes: Map<number, THREE.Object3D>; // placementPk → mesh
  floor: THREE.Mesh;
  animId: number;
}

// ── Machine Info Overlay ──────────────────────────────────────────
// rAF 루프로 3D → 2D 투영 위치를 매 프레임 갱신. React re-render 없음.
function MachineInfoOverlay({
  placements,
  readings,
  sceneRef,
  canvasRef,
  onCardClick,
}: {
  placements: IMachinePlacement[];
  readings: AllPressIoTMap;
  sceneRef: React.MutableRefObject<SceneState | null>;
  canvasRef: React.MutableRefObject<HTMLCanvasElement | null>;
  onCardClick: (placement: IMachinePlacement) => void;
}) {
  const cardRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const lineRefs = useRef<Map<number, SVGLineElement>>(new Map());
  const rafRef = useRef<number>(0);
  // 카드별 드래그 오프셋 (px)
  const offsetRefs = useRef<Map<number, { dx: number; dy: number }>>(new Map());
  const dragState = useRef<{
    pk: number; startX: number; startY: number; startDx: number; startDy: number;
  } | null>(null);
  // 드래그 여부 추적 — 5px 미만 이동은 클릭으로 간주
  const dragMovedRef = useRef<Set<number>>(new Set());

  // 카드 고정 높이 (헤더 ~40px + 바디 ~44px + 하단 점 4px)
  const CARD_H = 88;

  // 전역 mousemove / mouseup (드래그가 카드 밖으로 나가도 추적)
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
    e.stopPropagation(); // OrbitControls / canvas 이벤트 차단
    dragMovedRef.current.delete(pk); // 이전 드래그 기록 초기화
    const cur = offsetRefs.current.get(pk) ?? { dx: 0, dy: 0 };
    dragState.current = { pk, startX: e.clientX, startY: e.clientY, startDx: cur.dx, startDy: cur.dy };
  };

  const handleCardClick = (e: React.MouseEvent, placement: IMachinePlacement) => {
    e.stopPropagation();
    if (dragMovedRef.current.has(placement.pk)) {
      dragMovedRef.current.delete(placement.pk);
      return; // 드래그였으면 모달 열지 않음
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

          // 카드 기본 앵커 (기계 위 공중)
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
          // 드래그 중 cursor 표시
          cardEl.style.cursor = dragState.current?.pk === pk ? "grabbing" : "grab";

          // 실 끝점: 기계 꼭대기
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
      {/* 풍선 실 SVG 레이어 */}
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
        // Only use MQTT reading when an active IoT setup exists (ep_process_pk is set).
        // After Disconnect, ep_process_pk becomes null even though machine_iot_id remains on the Machine model.
        const reading = (p.machine_iot_id && p.ep_process_pk) ? readings.get(p.machine_iot_id) : undefined;
        const isStale = !reading || Date.now() - reading.receivedAt > 30_000;
        // value_run_ok is a cycle counter (not a binary flag) — fresh data = running, no data = idle
        const status: "running" | "idle" = isStale ? "idle" : "running";

        const temp1 = reading?.value_temp_1 ?? "--";
        const temp2 = reading?.value_temp_2 ?? "--";

        // 3-state signal:
        //   "green" = running + both temps within tolerance (OK)
        //   "red"   = running + either temp exceeds tolerance (out of standard)
        //   "gray"  = stopped / no active IoT setup
        let signalState: "green" | "red" | "gray";
        if (status === "idle" || !p.ep_process_pk) {
          signalState = "gray";
        } else if (reading && p.iot_std_hot_temp_c != null && p.iot_tolerance_temp_c != null) {
          const tol = p.iot_tolerance_temp_c;
          const hotOk = Math.abs(reading.value_temp_1 - p.iot_std_hot_temp_c) <= tol;
          const coldOk = p.iot_std_cold_temp_c != null
            ? Math.abs(reading.value_temp_2 - p.iot_std_cold_temp_c) <= tol
            : true;
          signalState = (hotOk && coldOk) ? "green" : "red";
        } else {
          signalState = "green"; // running but no std data yet
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

        const statusLabel = status === "running" ? "가동 중" : "정지";
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
            {/* ── 헤더: 썸네일 + 신호등 + 기계명 + 상태 ── */}
            <div style={{ background: headerBg, padding: "5px 7px", display: "flex", alignItems: "center", gap: 5 }}>
              {/* SJ Style 사진 (없으면 기계 사진, 없으면 기본 아이콘) */}
              <div style={{
                width: 32, height: 32, borderRadius: 5, flexShrink: 0,
                background: "#1a202c",
                overflow: "hidden",
                border: "1px solid rgba(255,255,255,0.15)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                {(p.style_thumbnail || p.thumbnail) ? (
                  <img
                    src={(p.style_thumbnail || p.thumbnail)!}
                    alt={p.style_code || p.machine_name}
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                ) : (
                  <span style={{ fontSize: 14 }}>⚙️</span>
                )}
              </div>

              {/* 신호등 */}
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

              {/* 기계 정보 */}
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

            {/* ── 바디: 온도 + 사이클 + 진행 바 ── */}
            <div style={{ padding: "6px 7px 7px", background: "#fff" }}>
              {/* 온도 행 */}
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                <span style={{ color: "#e53e3e", fontWeight: 700, fontSize: 10 }}>
                  🔥 {temp1 !== "--" ? `${temp1}°` : "--"}
                </span>
                <span style={{ color: "#3182ce", fontWeight: 700, fontSize: 10 }}>
                  ❄️ {temp2 !== "--" ? `${temp2}°` : "--"}
                </span>
              </div>
              {/* 사이클 카운트 */}
              {cycleCount !== null && (
                <div style={{ fontSize: 8, color: "#718096", marginBottom: 3, textAlign: "center" }}>
                  🔄 {cycleCount.toLocaleString()} cycles
                </div>
              )}
              {/* 진행 바 */}
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

            {/* ── 연결 점 ── */}
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

// ── Main page ──────────────────────────────────────────────────
export default function WeldingRoomPage() {
  const toast = useToast();
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

  const [editMode, setEditMode] = useState(false);
  const [selectedPk, setSelectedPk] = useState<number | null>(null);
  const [isDraggingMachine, setIsDraggingMachine] = useState<number | null>(null);

  // IoT Modal state
  const { isOpen: isIoTOpen, onOpen: onIoTOpen, onClose: onIoTClose } = useDisclosure();
  const [iotPlacement, setIotPlacement] = useState<IMachinePlacement | null>(null);
  // MQTT connection lives in parent (same pattern as EpProcessDetail) so it persists across open/close
  const [iotActiveIotId, setIotActiveIotId] = useState<string | undefined>(undefined);
  const iotPressIoT = usePressIoT(iotActiveIotId);

  const handleCardClick = (placement: IMachinePlacement) => {
    if (!placement.ep_process_pk) return;
    setIotPlacement(placement);
    // Pre-establish MQTT connection with this machine's IoT ID
    if (placement.machine_iot_id) {
      setIotActiveIotId(placement.machine_iot_id);
    }
    onIoTOpen();
  };

  const handleIoTClose = () => {
    onIoTClose();
    // Disconnect 시 welding room 카드 상태 즉시 반영
    queryClient.invalidateQueries({ queryKey: ["weldingRoom"] });
  };

  const { data: room, isLoading: roomLoading } = useQuery<IWeldingRoom>({
    queryKey: ["weldingRoom"],
    queryFn: getWeldingRoom,
  });

  const { data: machinesData } = useQuery({
    queryKey: ["machines", "", 1],
    queryFn: () => getMachines({ search: "", page: 1 }),
  });

  const allMachines = machinesData?.results ?? [];
  const placedMachineIds = new Set((room?.placements ?? []).map((p) => p.machine));
  const unplacedMachines = allMachines.filter((m) => !placedMachineIds.has(m.pk));

  // ── Build / update Three.js scene when room data changes ─────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !room) return;

    const w = canvas.parentElement?.clientWidth || 800;
    const h = CANVAS_H;

    let ss = sceneRef.current;

    if (!ss) {
      // First init
      const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
      renderer.setSize(w, h, false);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.shadowMap.enabled = true;

      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0xf0f4f8);
      scene.fog = new THREE.Fog(0xf0f4f8, 30, 80);

      const camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 500);
      camera.position.set(0, 18, 20);
      camera.lookAt(0, 0, 0);

      scene.add(new THREE.AmbientLight(0xffffff, 0.8));
      const dir = new THREE.DirectionalLight(0xffffff, 1.5);
      dir.position.set(10, 20, 10);
      dir.castShadow = true;
      scene.add(dir);
      scene.add(new THREE.HemisphereLight(0x8888ff, 0x444422, 0.4));

      const controls = new OrbitControls(camera, canvas);
      controls.enableDamping = true;
      controls.maxPolarAngle = Math.PI / 2.1;
      controls.target.set(0, 0, 0);

      const raycaster = new THREE.Raycaster();

      const floor = new THREE.Mesh(
        new THREE.PlaneGeometry(room.width, room.depth),
        new THREE.MeshStandardMaterial({ color: 0xdde3ea, roughness: 0.9 })
      );
      floor.rotation.x = -Math.PI / 2;
      floor.receiveShadow = true;
      floor.name = "floor";
      scene.add(floor);

      // room border
      const edges = new THREE.EdgesGeometry(new THREE.BoxGeometry(room.width, 0.05, room.depth));
      const border = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0xa0aec0 }));
      border.position.y = 0.025;
      scene.add(border);

      // grid
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

      // resize
      const ro = new ResizeObserver(() => {
        const nw = canvas.parentElement?.clientWidth || w;
        ss!.renderer.setSize(nw, h, false);
        ss!.camera.aspect = nw / h;
        ss!.camera.updateProjectionMatrix();
      });
      if (canvas.parentElement) ro.observe(canvas.parentElement);
    }

    // Sync placements: load GLB for each placed machine
    const loader = new GLTFLoader();
    for (const p of room.placements) {
      if (ss.placedMeshes.has(p.pk)) continue; // already loaded
      if (!p.model_3d_url) {
        // fallback box
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
          model.scale.setScalar(s);
          const center = b.getCenter(new THREE.Vector3());
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

    // Remove meshes for deleted placements
    const activePks = new Set(room.placements.map((p) => p.pk));
    const { scene, placedMeshes } = ss;
    Array.from(placedMeshes.entries()).forEach(([pk, mesh]) => {
      if (!activePks.has(pk)) {
        scene.remove(mesh);
        placedMeshes.delete(pk);
      }
    });
  }, [room]);

  // ── Drag from sidebar: drop onto canvas ──────────────────────
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
      toast({ title: "기계가 배치되었습니다.", status: "success", duration: 1500, position: "bottom-right" });
    } catch {
      toast({ title: "배치 실패 (이미 배치된 기계)", status: "warning", duration: 2000, position: "bottom-right" });
    }
    setIsDraggingMachine(null);
  };

  // ── Click to select / drag to reposition ────────────────────
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
      toast({ title: "위치 저장 실패", status: "error", duration: 2000, position: "bottom-right" });
    }
  };

  const handleRemovePlacement = async (pk: number) => {
    try {
      await removeMachinePlacement(pk);
      queryClient.invalidateQueries({ queryKey: ["weldingRoom"] });
      setSelectedPk(null);
      toast({ title: "기계가 제거되었습니다.", status: "success", duration: 1500, position: "bottom-right" });
    } catch {
      toast({ title: "제거 실패", status: "error", duration: 2000, position: "bottom-right" });
    }
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

  if (roomLoading) return (
    <Box display="flex" alignItems="center" justifyContent="center" minH="60vh">
      <Spinner size="xl" />
    </Box>
  );

  const selectedPlacement = room?.placements.find((p) => p.pk === selectedPk);

  return (
    <Box px={{ base: 4, md: 8 }} py={6} minH="100vh" bg={pageBg}>
      {/* Header */}
      <HStack justify="space-between" mb={5}>
        <Heading size="md">Welding Room</Heading>
        <HStack>
          <Button
            size="sm"
            colorScheme={editMode ? "orange" : "teal"}
            variant={editMode ? "solid" : "outline"}
            onClick={() => { setEditMode(!editMode); setSelectedPk(null); }}
          >
            {editMode ? "편집 완료" : "배치 편집"}
          </Button>
        </HStack>
      </HStack>

      <HStack align="flex-start" spacing={4}>
        {/* ── Left sidebar: unplaced machines ── */}
        {editMode && (
          <Box
            w="220px"
            flexShrink={0}
            bg={cardBg}
            borderRadius="xl"
            border="1px solid"
            borderColor={borderColor}
            p={4}
            shadow="sm"
          >
            <Text fontSize="xs" fontWeight="semibold" color={labelColor} mb={3}>
              미배치 기계 ({unplacedMachines.length})
            </Text>
            <VStack spacing={2} align="stretch">
              {unplacedMachines.length === 0 && (
                <Text fontSize="xs" color="gray.400">모든 기계가 배치되었습니다.</Text>
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
                  <Text fontWeight="semibold" noOfLines={1}>{m.code}</Text>
                  <Text color={labelColor} noOfLines={1}>{m.name}</Text>
                  {m.machine_iot_id && (
                    <Badge colorScheme="teal" fontSize="9px" mt={1}>IoT {m.machine_iot_id}</Badge>
                  )}
                </Box>
              ))}
            </VStack>
          </Box>
        )}

        {/* ── 3D Canvas ── */}
        <Box flex={1}>
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
              style={{ display: "block", width: "100%", height: CANVAS_H }}
              onDragOver={handleCanvasDragOver}
              onDrop={handleCanvasDrop}
              onMouseDown={handleCanvasMouseDown}
              onMouseMove={handleCanvasMouseMove}
              onMouseUp={handleCanvasMouseUp}
            />
            {/* IoT 오버레이 */}
            {room && (
              <MachineInfoOverlay
                placements={room.placements}
                readings={liveReadings}
                sceneRef={sceneRef}
                canvasRef={canvasRef}
                onCardClick={handleCardClick}
              />
            )}
            {/* Drag hint */}
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
                  여기에 놓아서 배치
                </Badge>
              </Box>
            )}
            {/* Edit mode label */}
            {editMode && (
              <Badge
                position="absolute"
                top={3}
                left={3}
                colorScheme="orange"
                fontSize="xs"
              >
                편집 모드 — 기계를 드래그하여 이동
              </Badge>
            )}
          </Box>

          {/* Selected machine controls */}
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
                  <Text fontSize="xs" color={labelColor}>회전:</Text>
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
                    제거
                  </Button>
                </HStack>
              </HStack>
            </Box>
          )}
        </Box>

        {/* ── Right sidebar: placed machines list ── */}
        <Box
          w="200px"
          flexShrink={0}
          bg={cardBg}
          borderRadius="xl"
          border="1px solid"
          borderColor={borderColor}
          p={4}
          shadow="sm"
        >
          <Text fontSize="xs" fontWeight="semibold" color={labelColor} mb={3}>
            배치된 기계 ({room?.placements.length ?? 0})
          </Text>
          <VStack spacing={2} align="stretch">
            {(room?.placements ?? []).map((p) => (
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
                <Text fontWeight="semibold" noOfLines={1}>{p.machine_code}</Text>
                <Text color={labelColor} noOfLines={1}>{p.machine_name}</Text>
              </Box>
            ))}
            {!room?.placements.length && (
              <Text fontSize="xs" color="gray.400">
                {editMode ? "왼쪽에서 기계를 드래그하세요." : "배치된 기계가 없습니다."}
              </Text>
            )}
          </VStack>
        </Box>
      </HStack>

      {/* IoT Monitor 팝업 모달 */}
      {iotPlacement?.ep_process_pk && (
        <HotColdPressIoTModal
          isOpen={isIoTOpen}
          onClose={handleIoTClose}
          processPk={iotPlacement.ep_process_pk}
          processCode={iotPlacement.ep_process_code ?? iotPlacement.machine_code}
          pressIoT={iotPressIoT}
          activeIotId={iotActiveIotId}
          onSetActiveIotId={setIotActiveIotId}
        />
      )}
    </Box>
  );
}
