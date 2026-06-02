import {
  AlertDialog,
  AlertDialogBody,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogOverlay,
  Badge,
  Box,
  Button,
  Center,
  Divider,
  Grid,
  HStack,
  Heading,
  Image,
  Input,
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
  Textarea,
  VStack,
  useColorModeValue,
  useDisclosure,
  useToast,
} from "@chakra-ui/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Helmet } from "react-helmet";
import { useParams, useNavigate } from "react-router-dom";
import { useRef, useState, useEffect } from "react";
import { FaArrowLeft, FaEdit, FaTrash, FaCamera, FaTrashAlt, FaCube } from "react-icons/fa";
import { AiOutlineQrcode } from "react-icons/ai";
import QRCode from "qrcode";
import { useTranslation } from "react-i18next";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import LocalizedDateInput from "../components/LocalizedDateInput";
import { formatIsoDateDisplay, formatIsoDateTimeDisplay } from "../lib/dateLocale";
import {
  getMachineDetail,
  getMachines,
  editMachine,
  deleteMachine,
  createMachinePhoto,
  deleteMachinePhoto,
  getUploadURL,
  uploadImage,
  uploadMachine3DModel,
  deleteMachine3DModel,
  IMachine,
  IMachineListResponse,
} from "../api";
import { usePressIoT } from "../hooks/usePressIoT";

const MODEL_VIEWER_H = 360;

function Model3DViewer({ url }: { url: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");

  useEffect(() => {
    setStatus("loading");
    const canvas = canvasRef.current;
    if (!canvas) return;

    const w = canvas.parentElement?.clientWidth || 800;
    const h = MODEL_VIEWER_H;

    // — renderer directly on the <canvas> element —
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setSize(w, h, false); // false = don't touch canvas CSS
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1e2433);

    const camera = new THREE.PerspectiveCamera(45, w / h, 0.001, 2000);
    camera.position.set(3, 2, 5);
    camera.lookAt(0, 0, 0);

    scene.add(new THREE.AmbientLight(0xffffff, 1.2));
    const dir = new THREE.DirectionalLight(0xffffff, 2.0);
    dir.position.set(5, 10, 5);
    scene.add(dir);
    scene.add(new THREE.HemisphereLight(0x8888ff, 0x444422, 0.5));

    const grid = new THREE.GridHelper(10, 20, 0x888888, 0x555555);
    scene.add(grid);

    // test cube to confirm rendering
    const testMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.3, 0.3, 0.3),
      new THREE.MeshStandardMaterial({ color: 0x4488ff })
    );
    testMesh.position.y = 0.15;
    scene.add(testMesh);

    const controls = new OrbitControls(camera, canvas);
    controls.enableDamping = true;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 1.0;

    let animId: number;
    let running = true;
    const animate = () => {
      if (!running) return;
      animId = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // load real model
    const loader = new GLTFLoader();
    loader.load(
      url,
      (gltf) => {
        scene.remove(testMesh);
        const model = gltf.scene;
        const box = new THREE.Box3().setFromObject(model);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z) || 1;
        const s = 2.5 / maxDim;
        model.scale.setScalar(s);
        model.position.set(-center.x * s, -box.min.y * s, -center.z * s);
        scene.add(model);

        const nb = new THREE.Box3().setFromObject(model);
        const ns = nb.getSize(new THREE.Vector3());
        const dist = Math.max(ns.x, ns.y, ns.z) * 2.2;
        camera.position.set(dist, dist * 0.7, dist);
        controls.target.set(0, ns.y / 2, 0);
        controls.update();
        setStatus("ok");
      },
      undefined,
      (err) => {
        console.error("[3DViewer] load error:", err, "url:", url);
        setStatus("error");
      }
    );

    // resize
    const ro = new ResizeObserver(() => {
      const nw = canvas.parentElement?.clientWidth || w;
      renderer.setSize(nw, h, false);
      camera.aspect = nw / h;
      camera.updateProjectionMatrix();
    });
    if (canvas.parentElement) ro.observe(canvas.parentElement);

    return () => {
      running = false;
      cancelAnimationFrame(animId);
      ro.disconnect();
      controls.dispose();
      renderer.dispose();
    };
  }, [url]);

  return (
    <div style={{ position: "relative", width: "100%", height: MODEL_VIEWER_H }}>
      <canvas
        ref={canvasRef}
        style={{ display: "block", width: "100%", height: MODEL_VIEWER_H }}
      />
      {status === "loading" && (
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "#a0aec0", fontSize: 13, pointerEvents: "none" }}>
          Loading…
        </div>
      )}
      {status === "error" && (
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, color: "#fc8181", fontSize: 13 }}>
          <span>3D 파일을 불러올 수 없습니다.</span>
          <span style={{ fontSize: 11, color: "#718096" }}>(브라우저 콘솔에서 오류 확인)</span>
        </div>
      )}
    </div>
  );
}

function InfoRow({
  label,
  labelColor,
  children,
}: {
  label: string;
  labelColor: string;
  children: React.ReactNode;
}) {
  return (
    <Box>
      <Text fontSize="xs" color={labelColor} fontWeight="semibold" mb={0.5}>{label}</Text>
      {children}
    </Box>
  );
}

export default function SjMachineDetail() {
  const { machineId } = useParams<{ machineId: string }>();
  const pk = Number(machineId);
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { i18n } = useTranslation();
  const fmtDate = (d?: string | null) => formatIsoDateDisplay(d, i18n.language);
  const fmtDateTime = (d?: string | null) => formatIsoDateTimeDisplay(d, i18n.language);

  const cardBg = useColorModeValue("white", "gray.800");
  const pageBg = useColorModeValue("gray.50", "gray.900");
  const borderColor = useColorModeValue("gray.200", "gray.600");
  const labelColor = useColorModeValue("gray.500", "gray.400");
  const textareaBg = useColorModeValue("gray.50", "gray.700");
  const photoBorderColor = useColorModeValue("gray.200", "gray.600");
  const suggestionBg = useColorModeValue("white", "gray.700");
  const suggestionBorderColor = useColorModeValue("gray.200", "gray.600");
  const suggestionHoverBg = useColorModeValue("gray.50", "gray.600");

  const { data: machine, isLoading } = useQuery<IMachine>({
    queryKey: ["machineDetail", pk],
    queryFn: () => getMachineDetail(pk),
    enabled: !!pk,
  });

  // ── Edit 상태 ──────────────────────────────────────────────
  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState({
    code: "", name: "", machine_type: "", category: "",
    manufacturer: "", supplier: "", model_number: "",
    serial_number: "", location: "", purchase_date: "", description: "",
    machine_iot_id: "",
  });
  const [isSaving, setIsSaving] = useState(false);

  const startEdit = () => {
    if (!machine) return;
    setForm({
      code: machine.code,
      name: machine.name,
      machine_type: machine.machine_type ?? "",
      category: machine.category ?? "",
      manufacturer: machine.manufacturer ?? "",
      supplier: machine.supplier ?? "",
      model_number: machine.model_number ?? "",
      serial_number: machine.serial_number ?? "",
      location: machine.location ?? "",
      purchase_date: machine.purchase_date ?? "",
      description: machine.description ?? "",
      machine_iot_id: machine.machine_iot_id ?? "",
    });
    setIsEditing(true);
  };

  const handleSave = async () => {
    if (!form.code.trim() || !form.name.trim()) {
      toast({ title: "Code and Name are required", status: "warning", duration: 2000, position: "bottom-right" });
      return;
    }
    setIsSaving(true);
    try {
      await editMachine(pk, {
        code: form.code.trim(),
        name: form.name.trim(),
        machine_type: form.machine_type.trim(),
        category: form.category.trim(),
        manufacturer: form.manufacturer.trim(),
        supplier: form.supplier.trim(),
        model_number: form.model_number.trim(),
        serial_number: form.serial_number.trim(),
        location: form.location.trim(),
        purchase_date: form.purchase_date || null,
        description: form.description.trim(),
        machine_iot_id: form.machine_iot_id.trim(),
      });
      toast({ title: "Updated", status: "success", duration: 2000, position: "bottom-right" });
      queryClient.invalidateQueries({ queryKey: ["machineDetail", pk] });
      queryClient.invalidateQueries({ queryKey: ["machines"] });
      setIsEditing(false);
      setConnectedIotId(undefined);
      setIotMachineSearch("");
      setIotSelectedMachine(null);
    } catch {
      toast({ title: "Update failed", status: "error", duration: 2000, position: "bottom-right" });
    } finally {
      setIsSaving(false);
    }
  };

  // ── Delete ─────────────────────────────────────────────────
  const { isOpen: isDeleteOpen, onOpen: onDeleteOpen, onClose: onDeleteClose } = useDisclosure();
  const cancelRef = useRef<HTMLButtonElement>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await deleteMachine(pk);
      toast({ title: "Deleted", status: "success", duration: 2000, position: "bottom-right" });
      queryClient.invalidateQueries({ queryKey: ["machines"] });
      navigate("/machines");
    } catch {
      toast({ title: "Delete failed", status: "error", duration: 2000, position: "bottom-right" });
      setIsDeleting(false);
    }
  };

  // ── Lightbox ───────────────────────────────────────────────
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  // ── Print Label ────────────────────────────────────────────
  const [isPrintLabelOpen, setIsPrintLabelOpen] = useState(false);

  const handlePrintLabel = () => {
    const qrPhoto = (machine?.photos ?? []).find((p) => p.description === "QR Code");
    if (!qrPhoto) return;
    const printWindow = window.open("", "_blank", "width=500,height=400");
    if (!printWindow) return;
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${machine?.code ?? "Machine Label"}</title>
          <style>
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body { font-family: Arial, sans-serif; background: white; }
            .label {
              width: 85mm;
              padding: 5mm;
              display: flex;
              align-items: center;
              gap: 4mm;
              border: 0.3mm solid #ccc;
            }
            .qr img { width: 22mm; height: 22mm; display: block; }
            .info { flex: 1; }
            .name { font-size: 10pt; font-weight: bold; margin-bottom: 1.5mm; }
            .detail { font-size: 7.5pt; color: #555; margin-bottom: 1mm; }
            @media print {
              @page { size: 85mm 36mm; margin: 0; }
              body { width: 85mm; }
            }
          </style>
        </head>
        <body>
          <div class="label">
            <div class="qr"><img src="${qrPhoto.file}" alt="QR" /></div>
            <div class="info">
              <div class="name">${machine?.name ?? "-"}</div>
              <div class="detail">Code: ${machine?.code ?? "-"}</div>
              <div class="detail">Location: ${machine?.location ?? "-"}</div>
            </div>
          </div>
          <script>
            window.onload = function() {
              window.print();
              window.onafterprint = function() { window.close(); };
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  // ── QR Code ────────────────────────────────────────────────
  const [isGeneratingQR, setIsGeneratingQR] = useState(false);
  const [isQRConfirmOpen, setIsQRConfirmOpen] = useState(false);
  const qrCancelRef = useRef<HTMLButtonElement>(null);

  const handleQRButtonClick = () => {
    const photos = machine?.photos ?? [];
    const hasQR = photos.some((p) => p.description === "QR Code");
    if (hasQR) {
      setIsQRConfirmOpen(true);
    } else {
      handleGenerateQR();
    }
  };

  const handleGenerateQR = async () => {
    setIsGeneratingQR(true);
    setIsQRConfirmOpen(false);
    try {
      const photos = machine?.photos ?? [];
      // 1) 기존 QR 삭제
      for (const p of photos.filter((p) => p.description === "QR Code")) {
        await deleteMachinePhoto({ machinePk: pk, photoPk: p.pk });
      }
      // 2) 현재 URL로 QR 데이터 URL 생성
      const dataUrl: string = await QRCode.toDataURL(window.location.href, {
        width: 400,
        margin: 2,
      });
      // 3) data URL → Blob → File
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      const qrFile = new File([blob], `machine-qr-${pk}.png`, { type: "image/png" });
      // 4) Cloudflare 업로드
      const urlData = await getUploadURL();
      const dt = new DataTransfer();
      dt.items.add(qrFile);
      const cfResult: any = await uploadImage({ file: dt.files, uploadURL: urlData.uploadURL });
      const cfUrl = `https://imagedelivery.net/mzmXhxWLR9jzdX8u9g4BBQ/${cfResult.result.id}/public`;
      // 5) Django 저장
      await createMachinePhoto({ file: cfUrl, machinePk: pk, description: "QR Code" });
      queryClient.invalidateQueries({ queryKey: ["machineDetail", pk] });
      toast({ title: "QR Code generated", status: "success", duration: 2000, position: "bottom-right" });
    } catch {
      toast({ title: "QR Code generation failed", status: "error", duration: 3000, position: "bottom-right" });
    } finally {
      setIsGeneratingQR(false);
    }
  };

  // ── Photo Upload ───────────────────────────────────────────
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [pendingPreviews, setPendingPreviews] = useState<string[]>([]);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setPendingFiles((prev) => [...prev, ...files]);
    setPendingPreviews((prev) => [...prev, ...files.map((f) => URL.createObjectURL(f))]);
    if (photoInputRef.current) photoInputRef.current.value = "";
  };

  const removePending = (idx: number) => {
    setPendingFiles((prev) => prev.filter((_, i) => i !== idx));
    setPendingPreviews((prev) => {
      URL.revokeObjectURL(prev[idx]);
      return prev.filter((_, i) => i !== idx);
    });
  };

  const uploadOnePhoto = async (file: File) => {
    const urlData = await getUploadURL();
    const dt = new DataTransfer();
    dt.items.add(file);
    const cfResult: any = await uploadImage({ file: dt.files, uploadURL: urlData.uploadURL });
    const cfUrl = `https://imagedelivery.net/mzmXhxWLR9jzdX8u9g4BBQ/${cfResult.result.id}/public`;
    await createMachinePhoto({ file: cfUrl, machinePk: pk, description: machine?.name ?? "" });
  };

  const handleUploadPhotos = async () => {
    if (!pendingFiles.length) return;
    setIsUploadingPhoto(true);
    try {
      for (const file of pendingFiles) {
        await uploadOnePhoto(file);
      }
      queryClient.invalidateQueries({ queryKey: ["machineDetail", pk] });
      setPendingFiles([]);
      setPendingPreviews([]);
      toast({ title: "Photos uploaded", status: "success", duration: 2000, position: "bottom-right" });
    } catch {
      toast({ title: "Upload failed", status: "error", duration: 2000, position: "bottom-right" });
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const handleDeletePhoto = async (photoPk: number) => {
    try {
      await deleteMachinePhoto({ machinePk: pk, photoPk });
      queryClient.invalidateQueries({ queryKey: ["machineDetail", pk] });
      toast({ title: "Photo deleted", status: "success", duration: 2000, position: "bottom-right" });
    } catch {
      toast({ title: "Delete failed", status: "error", duration: 2000, position: "bottom-right" });
    }
  };

  // ── IoT Machine picker ─────────────────────────────────────
  const [connectedIotId, setConnectedIotId] = useState<string | undefined>(undefined);
  const iot = usePressIoT(connectedIotId);
  const [iotMachineSearch, setIotMachineSearch] = useState("");
  const [iotSelectedMachine, setIotSelectedMachine] = useState<{ pk: number; code: string; name: string; machine_iot_id: string } | null>(null);
  const [showIotMachineSuggestions, setShowIotMachineSuggestions] = useState(false);
  const iotMachineBlurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { data: iotMachineSuggestions } = useQuery<IMachineListResponse>({
    queryKey: ["iotMachineSuggestions", iotMachineSearch],
    queryFn: () => getMachines({ search: iotMachineSearch }),
    enabled: isEditing && iotMachineSearch.length > 0,
  });

  const model3DInputRef = useRef<HTMLInputElement>(null);
  const [isUploading3D, setIsUploading3D] = useState(false);
  const [isRemoving3D, setIsRemoving3D] = useState(false);
  const [isDraggingOver3D, setIsDraggingOver3D] = useState(false);
  // Replace 후 같은 URL이라도 뷰어를 강제 재마운트하기 위한 키
  const [viewerKey, setViewerKey] = useState(0);

  const upload3DFile = async (file: File) => {
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!ext || !["glb", "gltf"].includes(ext)) {
      toast({ title: "GLB 또는 GLTF 파일만 업로드 가능합니다.", status: "warning", duration: 3000, position: "bottom-right" });
      return;
    }

    // 파일 내용 검증: GLB는 'glTF' magic bytes, GLTF는 '{' 로 시작해야 함
    const isValidFile = await new Promise<boolean>((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const buf = e.target?.result as ArrayBuffer;
        if (!buf || buf.byteLength < 4) { resolve(false); return; }
        const header = new Uint8Array(buf, 0, 4);
        const isGLB = header[0] === 0x67 && header[1] === 0x6C && header[2] === 0x54 && header[3] === 0x46; // 'glTF'
        const isGLTF = header[0] === 0x7B; // '{'
        resolve(isGLB || isGLTF);
      };
      reader.onerror = () => resolve(false);
      reader.readAsArrayBuffer(file.slice(0, 4));
    });

    if (!isValidFile) {
      toast({
        title: "유효하지 않은 3D 파일입니다.",
        description: "Blender에서 File → Export → glTF 2.0 (.glb/.gltf)로 내보낸 파일을 사용하세요.",
        status: "error",
        duration: 5000,
        position: "bottom-right",
        isClosable: true,
      });
      return;
    }

    setIsUploading3D(true);
    try {
      await uploadMachine3DModel({ machinePk: pk, file });
      await queryClient.invalidateQueries({ queryKey: ["machineDetail", pk] });
      setViewerKey((k) => k + 1); // 뷰어 강제 재마운트 (같은 URL이어도 새 파일 로드)
      toast({ title: "3D model uploaded", status: "success", duration: 2000, position: "bottom-right" });
    } catch {
      toast({ title: "3D upload failed", status: "error", duration: 2000, position: "bottom-right" });
    } finally {
      setIsUploading3D(false);
    }
  };

  const handleRemove3DModel = async () => {
    if (!pk) return;
    setIsRemoving3D(true);
    try {
      await deleteMachine3DModel(pk);
      await queryClient.invalidateQueries({ queryKey: ["machineDetail", pk] });
      toast({ title: "3D 모델이 제거되었습니다.", status: "info", duration: 2000, position: "bottom-right" });
    } catch {
      toast({ title: "제거 실패", status: "error", duration: 2000, position: "bottom-right" });
    } finally {
      setIsRemoving3D(false);
    }
  };

  const handleModel3DSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (model3DInputRef.current) model3DInputRef.current.value = "";
    await upload3DFile(file);
  };

  const handleDragOver3D = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver3D(true);
  };

  const handleDragLeave3D = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver3D(false);
  };

  const handleDrop3D = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver3D(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    await upload3DFile(file);
  };

  if (isLoading) return <Center minH="60vh"><Spinner size="xl" /></Center>;
  if (!machine) return <Center minH="60vh"><Text color="gray.400">Machine not found.</Text></Center>;

  const photos = machine.photos ?? [];

  return (
    <>
      <Helmet><title>{machine.code} — Machine Detail</title></Helmet>

      <Box bg={pageBg} minH="100vh" px={{ base: 4, md: 8, lg: 12 }} py={{ base: 6, md: 8 }}>
        <Box maxW="5xl" mx="auto">

          <HStack mb={4} justify="space-between">
            <Button leftIcon={<FaArrowLeft />} variant="ghost" size="sm" onClick={() => navigate(-1)}>
              Back
            </Button>
            <Button
              size="sm"
              colorScheme="teal"
              variant="outline"
              leftIcon={<AiOutlineQrcode />}
              isLoading={isGeneratingQR}
              loadingText="QR..."
              onClick={handleQRButtonClick}
            >
              QR Code
            </Button>
          </HStack>

          {/* 기본 정보 카드 */}
          <Box bg={cardBg} borderRadius="xl" border="1px solid" borderColor={borderColor} p={6} shadow="sm" mb={6}>
              {/* Code & Name + QR */}
              <HStack justify="space-between" align="flex-start" mb={6}>
              <HStack align="flex-end" spacing={4}>
                {isEditing ? (
                  <>
                    <InfoRow label="Code" labelColor={labelColor}>
                      <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })}
                        fontWeight="bold" fontSize="md" w="180px" placeholder="Code" />
                    </InfoRow>
                    <InfoRow label="Name" labelColor={labelColor}>
                      <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                        fontSize="md" placeholder="Name" minW="220px" />
                    </InfoRow>
                  </>
                ) : (
                  <>
                    <InfoRow label="Code" labelColor={labelColor}>
                      <Heading size="md">{machine.code}</Heading>
                    </InfoRow>
                    <InfoRow label="Name" labelColor={labelColor}>
                      <Text fontSize="lg" color="gray.500">{machine.name}</Text>
                    </InfoRow>
                  </>
                )}
              </HStack>
              {/* QR 이미지 — 카드 우상단, 클릭 시 프린트 모달 */}
              {(machine.photos ?? []).find((p) => p.description === "QR Code") && (
                <Box
                  cursor="pointer"
                  flexShrink={0}
                  onClick={() => setIsPrintLabelOpen(true)}
                >
                  <Image
                    src={(machine.photos ?? []).find((p) => p.description === "QR Code")!.file}
                    boxSize="80px"
                    objectFit="contain"
                    borderRadius="md"
                    border="1px solid"
                    borderColor={borderColor}
                    title="QR Code — click to enlarge"
                  />
                </Box>
              )}
              </HStack>

              {/* Row 1: Type, Category, Location */}
              <HStack spacing={8} flexWrap="wrap" align="flex-start" mb={6}>
                <InfoRow label="Type" labelColor={labelColor}>
                  {isEditing
                    ? <Input size="sm" value={form.machine_type} onChange={(e) => setForm({ ...form, machine_type: e.target.value })} w="160px" placeholder="Machine type" />
                    : <Text fontSize="sm">{machine.machine_type || "-"}</Text>}
                </InfoRow>
                <InfoRow label="Category" labelColor={labelColor}>
                  {isEditing
                    ? <Input size="sm" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} w="160px" placeholder="Category" />
                    : <Text fontSize="sm">{machine.category || "-"}</Text>}
                </InfoRow>
                <InfoRow label="Location" labelColor={labelColor}>
                  {isEditing
                    ? <Input size="sm" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} w="200px" placeholder="Location" />
                    : <Text fontSize="sm">{machine.location || "-"}</Text>}
                </InfoRow>
              </HStack>

              <Divider mb={5} />

              {/* Row 2: Model No, Serial No */}
              <HStack spacing={8} flexWrap="wrap" align="flex-start" mb={6}>
                <InfoRow label="Model No." labelColor={labelColor}>
                  {isEditing
                    ? <Input size="sm" value={form.model_number} onChange={(e) => setForm({ ...form, model_number: e.target.value })} w="180px" placeholder="Model number" />
                    : <Text fontSize="sm">{machine.model_number || "-"}</Text>}
                </InfoRow>
                <InfoRow label="Serial No." labelColor={labelColor}>
                  {isEditing
                    ? <Input size="sm" value={form.serial_number} onChange={(e) => setForm({ ...form, serial_number: e.target.value })} w="180px" placeholder="Serial number" />
                    : <Text fontSize="sm">{machine.serial_number || "-"}</Text>}
                </InfoRow>
                <InfoRow label="Machine IoT ID" labelColor={labelColor}>
                  {isEditing ? (
                    <VStack align="flex-start" spacing={2}>
                      {/* Machine picker — selects an SJ Machine and auto-fills its IoT ID */}
                      <Box position="relative" w="280px">
                        <Input
                          size="sm"
                          value={iotMachineSearch}
                          onChange={(e) => {
                            setIotMachineSearch(e.target.value);
                            setIotSelectedMachine(null);
                            setConnectedIotId(undefined);
                            setForm((f) => ({ ...f, machine_iot_id: "" }));
                          }}
                          onFocus={() => setShowIotMachineSuggestions(true)}
                          onBlur={() => {
                            iotMachineBlurTimer.current = setTimeout(() => setShowIotMachineSuggestions(false), 150);
                          }}
                          placeholder="Search SJ Machine by code / name…"
                        />
                        {iotSelectedMachine && (
                          <Text fontSize="xs" color="blue.400" mt={1}>
                            {iotSelectedMachine.code}{iotSelectedMachine.name ? ` — ${iotSelectedMachine.name}` : ""}
                            {" · IoT ID: "}<Text as="span" fontWeight="bold">{iotSelectedMachine.machine_iot_id || "(없음)"}</Text>
                          </Text>
                        )}
                        {showIotMachineSuggestions && iotMachineSuggestions && iotMachineSuggestions.results.length > 0 && (
                          <List
                            position="absolute"
                            zIndex={10}
                            bg={suggestionBg}
                            border="1px solid"
                            borderColor={suggestionBorderColor}
                            borderRadius="md"
                            w="full"
                            maxH="180px"
                            overflowY="auto"
                            shadow="md"
                          >
                            {iotMachineSuggestions.results.map((m) => (
                              <ListItem
                                key={m.pk}
                                px={3} py={2}
                                cursor="pointer"
                                fontSize="sm"
                                _hover={{ bg: suggestionHoverBg }}
                                onMouseDown={() => {
                                  if (iotMachineBlurTimer.current) clearTimeout(iotMachineBlurTimer.current);
                                  setIotSelectedMachine({ pk: m.pk, code: m.code, name: m.name, machine_iot_id: m.machine_iot_id });
                                  setIotMachineSearch(m.code);
                                  setShowIotMachineSuggestions(false);
                                  setConnectedIotId(undefined);
                                  setForm((f) => ({ ...f, machine_iot_id: m.machine_iot_id }));
                                }}
                              >
                                <Text as="span" fontWeight="semibold">{m.code}</Text>
                                {m.name && <Text as="span" color="gray.500"> — {m.name}</Text>}
                                {m.machine_iot_id && (
                                  <Text as="span" color="blue.400" ml={2} fontSize="xs">IoT: {m.machine_iot_id}</Text>
                                )}
                              </ListItem>
                            ))}
                          </List>
                        )}
                      </Box>
                      {/* Connect / status row — uses the auto-filled machine_iot_id */}
                      <HStack>
                        <Input
                          size="sm"
                          value={form.machine_iot_id}
                          onChange={(e) => setForm((f) => ({ ...f, machine_iot_id: e.target.value }))}
                          w="140px"
                          placeholder="IoT device ID"
                          isReadOnly={!!iotSelectedMachine}
                        />
                        <Button
                          size="sm"
                          colorScheme={connectedIotId ? "red" : "blue"}
                          onClick={() =>
                            connectedIotId
                              ? setConnectedIotId(undefined)
                              : setConnectedIotId(form.machine_iot_id.trim() || undefined)
                          }
                          isDisabled={!form.machine_iot_id.trim() && !connectedIotId}
                        >
                          {connectedIotId ? "Disconnect" : "Connect"}
                        </Button>
                        {connectedIotId && (
                          <Badge
                            colorScheme={
                              iot.status === "connected"
                                ? "green"
                                : iot.status === "connecting"
                                ? "yellow"
                                : "gray"
                            }
                          >
                            {iot.status === "connected"
                              ? "CONNECTED"
                              : iot.status === "connecting"
                              ? "CONNECTING…"
                              : "DISCONNECTED"}
                          </Badge>
                        )}
                      </HStack>
                      {connectedIotId && iot.latest && (
                        <Box
                          p={2}
                          borderRadius="md"
                          bg="gray.50"
                          border="1px solid"
                          borderColor="gray.200"
                          fontSize="sm"
                          _dark={{ bg: "gray.700", borderColor: "gray.600" }}
                        >
                          <HStack spacing={4}>
                            <Text color="red.500" fontWeight="600">🔥 {iot.latest.value_temp_1}°C</Text>
                            <Text color="blue.500" fontWeight="600">❄ {iot.latest.value_temp_2}°C</Text>
                            <Badge colorScheme={iot.latest.value_run_ok === 1 ? "green" : "red"}>
                              {iot.latest.value_run_ok === 1 ? "가동 중" : "정지"}
                            </Badge>
                          </HStack>
                        </Box>
                      )}
                    </VStack>
                  ) : (
                    <Text fontSize="sm">{machine.machine_iot_id || "-"}</Text>
                  )}
                </InfoRow>
              </HStack>

              <Divider mb={5} />

              {/* Row 3: Manufacturer, Supplier, Purchase Date */}
              <HStack spacing={8} flexWrap="wrap" align="flex-start" mb={6}>
                <InfoRow label="Manufacturer" labelColor={labelColor}>
                  {isEditing
                    ? <Input size="sm" value={form.manufacturer} onChange={(e) => setForm({ ...form, manufacturer: e.target.value })} w="180px" placeholder="Manufacturer" />
                    : <Text fontSize="sm">{machine.manufacturer || "-"}</Text>}
                </InfoRow>
                <InfoRow label="Supplier" labelColor={labelColor}>
                  {isEditing
                    ? <Input size="sm" value={form.supplier} onChange={(e) => setForm({ ...form, supplier: e.target.value })} w="180px" placeholder="Supplier" />
                    : <Text fontSize="sm">{machine.supplier || "-"}</Text>}
                </InfoRow>
                <InfoRow label="Purchase Date" labelColor={labelColor}>
                  {isEditing
                    ? (
                      <Box w="160px">
                        <LocalizedDateInput
                          size="sm"
                          value={form.purchase_date}
                          onChange={(v) => setForm({ ...form, purchase_date: v })}
                        />
                      </Box>
                    )
                    : <Text fontSize="sm">{machine.purchase_date ? fmtDate(machine.purchase_date) : "-"}</Text>}
                </InfoRow>
                <InfoRow label="Created" labelColor={labelColor}>
                  <Text fontSize="sm">{fmtDateTime(machine.created_at)}</Text>
                </InfoRow>
              </HStack>

              {/* Description */}
              <Divider mb={5} />
              <InfoRow label="Description" labelColor={labelColor}>
                {isEditing ? (
                  <Textarea mt={1} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                    placeholder="Notes" rows={3} fontSize="sm" />
                ) : (
                  <Box bg={textareaBg} borderRadius="md" p={3} mt={1} fontSize="sm"
                    whiteSpace="pre-wrap" lineHeight={1.7} minH="50px"
                    color={machine.description ? undefined : "gray.400"}>
                    {machine.description || "No description."}
                  </Box>
                )}
              </InfoRow>

              {/* Edit / Delete buttons — bottom center */}
              <Center mt={6}>
                <HStack spacing={3}>
                  {isEditing ? (
                    <>
                      <Button size="sm" variant="ghost" onClick={() => { setIsEditing(false); setConnectedIotId(undefined); setIotMachineSearch(""); setIotSelectedMachine(null); }}>Cancel</Button>
                      <Button size="sm" colorScheme="blue" isLoading={isSaving} onClick={handleSave}>Save</Button>
                    </>
                  ) : (
                    <>
                      <Button size="sm" leftIcon={<FaEdit />} variant="ghost" onClick={startEdit}>Edit</Button>
                      <Button size="sm" leftIcon={<FaTrash />} variant="ghost" colorScheme="red" onClick={onDeleteOpen}>Delete</Button>
                    </>
                  )}
                </HStack>
              </Center>
            </Box>

          {/* 3D 모델 섹션 */}
          <Box bg={cardBg} borderRadius="xl" border="1px solid" borderColor={borderColor} p={6} shadow="sm" mb={6}>
            <HStack justify="space-between" mb={4}>
              <HStack spacing={2}>
                <Heading size="sm">3D Model</Heading>
                {machine.model_3d_url
                  ? <Badge colorScheme="teal" fontSize="xs">GLB</Badge>
                  : <Badge colorScheme="gray" fontSize="xs">None</Badge>}
              </HStack>
              <HStack spacing={2}>
                {machine.model_3d_url && (
                  <Button
                    size="sm"
                    leftIcon={<FaTrash />}
                    colorScheme="red"
                    variant="ghost"
                    isLoading={isRemoving3D}
                    loadingText="Removing…"
                    onClick={handleRemove3DModel}
                  >
                    Remove
                  </Button>
                )}
                <Button
                  size="sm"
                  leftIcon={<FaCube />}
                  variant="outline"
                  isLoading={isUploading3D}
                  loadingText="Uploading…"
                  onClick={() => model3DInputRef.current?.click()}
                >
                  {machine.model_3d_url ? "Replace 3D Model" : "Upload 3D Model"}
                </Button>
              </HStack>
              <input
                ref={model3DInputRef}
                type="file"
                accept=".glb,.gltf"
                style={{ display: "none" }}
                onChange={handleModel3DSelect}
              />
            </HStack>
            <Divider mb={4} />

            {machine.model_3d_url ? (
              <Box
                borderRadius="lg" overflow="hidden" border="1px solid" borderColor={borderColor}
                onDragOver={handleDragOver3D}
                onDragLeave={handleDragLeave3D}
                onDrop={handleDrop3D}
                position="relative"
              >
                <Model3DViewer key={viewerKey} url={machine.model_3d_url} />
                {isDraggingOver3D && (
                  <Center position="absolute" inset={0} bg="blackAlpha.700" borderRadius="lg" pointerEvents="none">
                    <VStack spacing={2} color="white">
                      <FaCube size={36} />
                      <Text fontWeight="semibold">새 파일로 교체합니다</Text>
                    </VStack>
                  </Center>
                )}
                {isUploading3D && (
                  <Center position="absolute" inset={0} bg="blackAlpha.600" borderRadius="lg">
                    <VStack spacing={2} color="white">
                      <Spinner size="lg" />
                      <Text fontSize="sm">Uploading…</Text>
                    </VStack>
                  </Center>
                )}
              </Box>
            ) : (
              <Center
                h="180px"
                borderRadius="lg"
                border="2px dashed"
                borderColor={isDraggingOver3D ? "teal.400" : borderColor}
                bg={isDraggingOver3D ? "teal.50" : undefined}
                cursor="pointer"
                transition="all 0.15s"
                onClick={() => !isUploading3D && model3DInputRef.current?.click()}
                onDragOver={handleDragOver3D}
                onDragLeave={handleDragLeave3D}
                onDrop={handleDrop3D}
              >
                {isUploading3D ? (
                  <VStack spacing={2} color="gray.400">
                    <Spinner size="lg" />
                    <Text fontSize="sm">Uploading…</Text>
                  </VStack>
                ) : (
                  <VStack spacing={2} color={isDraggingOver3D ? "teal.500" : "gray.400"}>
                    <FaCube size={32} />
                    <Text fontSize="sm" fontWeight={isDraggingOver3D ? "semibold" : "normal"}>
                      {isDraggingOver3D ? "여기에 놓으세요" : "GLB 파일을 여기로 드래그하거나 클릭하여 업로드"}
                    </Text>
                  </VStack>
                )}
              </Center>
            )}
          </Box>

          {/* 사진 섹션 */}
          <Box bg={cardBg} borderRadius="xl" border="1px solid" borderColor={borderColor} p={6} shadow="sm">
            <HStack justify="space-between" mb={4}>
              <Heading size="sm">Photos</Heading>
              <Button
                size="sm"
                leftIcon={<FaCamera />}
                variant="outline"
                onClick={() => photoInputRef.current?.click()}
              >
                Add Photos
              </Button>
              <input
                ref={photoInputRef}
                type="file"
                accept="image/*"
                multiple
                style={{ display: "none" }}
                onChange={handlePhotoSelect}
              />
            </HStack>
            <Divider mb={4} />

            {/* 업로드 대기 중인 사진 미리보기 */}
            {pendingPreviews.length > 0 && (
              <Box mb={5}>
                <Text fontSize="xs" color={labelColor} fontWeight="semibold" mb={2}>
                  Pending upload ({pendingPreviews.length})
                </Text>
                <Grid templateColumns="repeat(auto-fill, minmax(120px, 1fr))" gap={3} mb={3}>
                  {pendingPreviews.map((src, idx) => (
                    <Box key={idx} position="relative" borderRadius="md" overflow="hidden"
                      border="2px dashed" borderColor="blue.300">
                      <Image src={src} w="full" h="100px" objectFit="cover" />
                      <Button
                        size="xs" colorScheme="red" position="absolute" top={1} right={1}
                        onClick={() => removePending(idx)}
                      >
                        <FaTrashAlt />
                      </Button>
                    </Box>
                  ))}
                </Grid>
                <Button size="sm" colorScheme="blue" isLoading={isUploadingPhoto}
                  loadingText="Uploading..." onClick={handleUploadPhotos}>
                  Upload {pendingPreviews.length} photo{pendingPreviews.length > 1 ? "s" : ""}
                </Button>
              </Box>
            )}

            {/* 저장된 사진 (QR 코드 제외) */}
            {photos.filter((p) => p.description !== "QR Code").length === 0 && pendingPreviews.length === 0 ? (
              <Text color="gray.400" textAlign="center" py={6}>No photos registered.</Text>
            ) : (
              <Grid templateColumns="repeat(auto-fill, minmax(150px, 1fr))" gap={4}>
                {photos.filter((p) => p.description !== "QR Code").map((photo) => (
                  <Box
                    key={photo.pk}
                    position="relative"
                    borderRadius="md"
                    overflow="hidden"
                    border="1px solid"
                    borderColor={photoBorderColor}
                    cursor="pointer"
                    onClick={() => setLightboxSrc(photo.file)}
                    _hover={{ opacity: 0.85 }}
                    transition="opacity 0.15s"
                  >
                    <Image src={photo.file} w="full" h="130px" objectFit="cover" />
                    <Button
                      size="xs" colorScheme="red" position="absolute" top={1} right={1}
                      onClick={(e) => { e.stopPropagation(); handleDeletePhoto(photo.pk); }}
                    >
                      <FaTrashAlt />
                    </Button>
                    {photo.description && (
                      <Text fontSize="xs" p={1} color="gray.500" noOfLines={1}>{photo.description}</Text>
                    )}
                  </Box>
                ))}
              </Grid>
            )}
          </Box>

        </Box>
      </Box>

      {/* QR 재생성 확인 다이얼로그 */}
      <AlertDialog isOpen={isQRConfirmOpen} leastDestructiveRef={qrCancelRef} onClose={() => setIsQRConfirmOpen(false)}>
        <AlertDialogOverlay>
          <AlertDialogContent>
            <AlertDialogHeader fontSize="lg" fontWeight="bold">Regenerate QR Code</AlertDialogHeader>
            <AlertDialogBody>
              이미 QR 코드가 존재합니다. 새로 생성하면 기존 QR 코드가 삭제됩니다. 계속하시겠습니까?
            </AlertDialogBody>
            <AlertDialogFooter>
              <Button ref={qrCancelRef} onClick={() => setIsQRConfirmOpen(false)}>Cancel</Button>
              <Button colorScheme="teal" ml={3} onClick={handleGenerateQR}>Regenerate</Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>

      {/* Print Label 미리보기 모달 */}
      {(() => {
        const qrPhoto = (machine?.photos ?? []).find((p) => p.description === "QR Code");
        return (
          <Modal isOpen={isPrintLabelOpen} onClose={() => setIsPrintLabelOpen(false)} isCentered size="sm">
            <ModalOverlay />
            <ModalContent>
              <ModalHeader fontSize="md">Print Label Preview</ModalHeader>
              <ModalCloseButton />
              <ModalBody pb={4}>
                <Box
                  border="1px solid"
                  borderColor="gray.300"
                  p={3}
                  display="flex"
                  alignItems="center"
                  gap={3}
                  maxW="85mm"
                  mx="auto"
                  rounded="sm"
                >
                  {qrPhoto && (
                    <Image src={qrPhoto.file} w="22mm" h="22mm" objectFit="contain" flexShrink={0} />
                  )}
                  <Box>
                    <Text fontWeight="bold" fontSize="sm" mb={1}>{machine?.name ?? "-"}</Text>
                    <Text fontSize="xs" color="gray.500">Code: {machine?.code ?? "-"}</Text>
                    <Text fontSize="xs" color="gray.500">Location: {machine?.location ?? "-"}</Text>
                  </Box>
                </Box>
              </ModalBody>
              <ModalFooter pt={0}>
                <Button variant="ghost" mr={2} onClick={() => setIsPrintLabelOpen(false)}>Cancel</Button>
                <Button colorScheme="teal" onClick={handlePrintLabel} isDisabled={!qrPhoto}>Print</Button>
              </ModalFooter>
            </ModalContent>
          </Modal>
        );
      })()}

      {/* Lightbox */}
      <Modal isOpen={!!lightboxSrc} onClose={() => setLightboxSrc(null)} isCentered size="4xl">
        <ModalOverlay bg="blackAlpha.800" />
        <ModalContent bg="transparent" shadow="none" onClick={() => setLightboxSrc(null)}>
          <Image
            src={lightboxSrc ?? ""}
            maxH="90vh"
            maxW="100%"
            objectFit="contain"
            borderRadius="lg"
            mx="auto"
          />
        </ModalContent>
      </Modal>

      {/* Delete 확인 다이얼로그 */}
      <AlertDialog isOpen={isDeleteOpen} leastDestructiveRef={cancelRef} onClose={onDeleteClose}>
        <AlertDialogOverlay>
          <AlertDialogContent>
            <AlertDialogHeader fontSize="lg" fontWeight="bold">Delete Machine</AlertDialogHeader>
            <AlertDialogBody>
              <strong>{machine.code}</strong>을(를) 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
            </AlertDialogBody>
            <AlertDialogFooter>
              <Button ref={cancelRef} onClick={onDeleteClose}>Cancel</Button>
              <Button colorScheme="red" ml={3} isLoading={isDeleting} onClick={handleDelete}>Delete</Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>
    </>
  );
}
