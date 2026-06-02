import {
  Badge,
  Box,
  Button,
  Divider,
  Flex,
  FormControl,
  FormLabel,
  HStack,
  Icon,
  IconButton,
  Image,
  Input,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Select,
  Slider,
  SliderFilledTrack,
  SliderThumb,
  SliderTrack,
  Spinner,
  Switch,
  Text,
  Tooltip,
  useColorModeValue,
  useDisclosure,
  useToast,
  VStack
} from "@chakra-ui/react";
import Color from "@tiptap/extension-color";
import TiptapImage from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import TextAlign from "@tiptap/extension-text-align";
import { TextStyle } from "@tiptap/extension-text-style";
import Underline from "@tiptap/extension-underline";
import { Node } from "@tiptap/core";
import { EditorContent, NodeViewWrapper, ReactNodeViewRenderer, useEditor } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  FaAlignCenter,
  FaAlignLeft,
  FaAlignRight,
  FaArrowLeft,
  FaBold,
  FaCircle,
  FaEraser,
  FaHeading,
  FaImage,
  FaItalic,
  FaLink,
  FaListOl,
  FaListUl,
  FaLongArrowAltRight,
  FaPen,
  FaRegSquare,
  FaFont,
  FaSearch,
  FaTimes,
  FaTrash,
  FaUnderline,
  FaUndo,
  FaVideo
} from "react-icons/fa";
import { useNavigate, useParams } from "react-router-dom";
import {
  createKaizenPost,
  createKaizenPhoto,
  deleteKaizenPhoto,
  createKaizenVideo,
  deleteKaizenVideo,
  getKaizenPost,
  updateKaizenPost,
  getUploadURL,
  uploadImage,
  getUploadVideoURL,
  uploadVideo,
  getVideoData,
  getSjStyles,
  getSjNos,
  getProductionLines,
  getModules,
  getProcesses,
  type ISjStyle,
  type ISjNo,
  type IProductionLine,
  type IModule,
  type IProcess,
} from "../api";
import { IKaizenPhoto, IKaizenVideo, ISjKaizenPost, KaizenCategory } from "../types";

// ──────────────────────────────────────────────────────────────
// Tiptap 툴바
// ──────────────────────────────────────────────────────────────
function EditorToolbar({
  editor,
  onImageUpload,
  onVideoUpload,
}: {
  editor: ReturnType<typeof useEditor>;
  onImageUpload: (file: File) => Promise<void>;
  onVideoUpload: (file: File) => Promise<void>;
}) {
  const { t } = useTranslation();
  const toolbarBg = useColorModeValue("gray.50", "gray.700");
  const borderColor = useColorModeValue("gray.200", "gray.600");
  const [inlineUploading, setInlineUploading] = useState(false);
  const [inlineVideoUploading, setInlineVideoUploading] = useState(false);
  const inlineImageInputRef = useRef<HTMLInputElement>(null);
  const inlineVideoInputRef = useRef<HTMLInputElement>(null);

  if (!editor) return null;

  const ToolBtn = ({
    onClick,
    isActive,
    label,
    children,
    isLoading,
  }: {
    onClick: () => void;
    isActive?: boolean;
    label: string;
    children: React.ReactNode;
    isLoading?: boolean;
  }) => (
    <Tooltip label={label} hasArrow placement="top" openDelay={400}>
      <IconButton
        aria-label={label}
        icon={isLoading ? <Spinner size="xs" /> : <>{children}</>}
        size="xs"
        variant={isActive ? "solid" : "ghost"}
        colorScheme={isActive ? "blue" : undefined}
        isLoading={isLoading}
        onClick={onClick}
        borderRadius="md"
      />
    </Tooltip>
  );

  const handleInlineImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setInlineUploading(true);
    try {
      await onImageUpload(file);
    } finally {
      setInlineUploading(false);
      if (inlineImageInputRef.current) inlineImageInputRef.current.value = "";
    }
  };

  const handleInlineVideoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setInlineVideoUploading(true);
    try {
      await onVideoUpload(file);
    } finally {
      setInlineVideoUploading(false);
      if (inlineVideoInputRef.current) inlineVideoInputRef.current.value = "";
    }
  };

  const setLink = () => {
    const url = window.prompt("URL:");
    if (url) editor.chain().focus().setLink({ href: url }).run();
    else editor.chain().focus().unsetLink().run();
  };

  return (
    <Box
      bg={toolbarBg}
      borderWidth="1px"
      borderColor={borderColor}
      borderRadius="md"
      p={2}
      mb={2}
    >
      <Flex gap={1} flexWrap="wrap" align="center">
        {/* 텍스트 스타일 */}
        <ToolBtn
          onClick={() => editor.chain().focus().toggleBold().run()}
          isActive={editor.isActive("bold")}
          label={t("kaizen.bold")}
        >
          <Icon as={FaBold} boxSize={3} />
        </ToolBtn>
        <ToolBtn
          onClick={() => editor.chain().focus().toggleItalic().run()}
          isActive={editor.isActive("italic")}
          label={t("kaizen.italic")}
        >
          <Icon as={FaItalic} boxSize={3} />
        </ToolBtn>
        <ToolBtn
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          isActive={editor.isActive("underline")}
          label={t("kaizen.underline")}
        >
          <Icon as={FaUnderline} boxSize={3} />
        </ToolBtn>

        <Box h="18px" w="1px" bg={borderColor} mx={1} />

        {/* 헤딩 */}
        <ToolBtn
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          isActive={editor.isActive("heading", { level: 1 })}
          label="H1"
        >
          <HStack spacing={0.5}>
            <Icon as={FaHeading} boxSize={3} />
            <Text fontSize="8px" fontWeight="bold">1</Text>
          </HStack>
        </ToolBtn>
        <ToolBtn
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          isActive={editor.isActive("heading", { level: 2 })}
          label="H2"
        >
          <HStack spacing={0.5}>
            <Icon as={FaHeading} boxSize={2.5} />
            <Text fontSize="8px" fontWeight="bold">2</Text>
          </HStack>
        </ToolBtn>
        <ToolBtn
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          isActive={editor.isActive("heading", { level: 3 })}
          label="H3"
        >
          <HStack spacing={0.5}>
            <Icon as={FaHeading} boxSize={2} />
            <Text fontSize="8px" fontWeight="bold">3</Text>
          </HStack>
        </ToolBtn>

        <Box h="18px" w="1px" bg={borderColor} mx={1} />

        {/* 리스트 */}
        <ToolBtn
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          isActive={editor.isActive("bulletList")}
          label={t("kaizen.bulletList")}
        >
          <Icon as={FaListUl} boxSize={3} />
        </ToolBtn>
        <ToolBtn
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          isActive={editor.isActive("orderedList")}
          label={t("kaizen.orderedList")}
        >
          <Icon as={FaListOl} boxSize={3} />
        </ToolBtn>

        <Box h="18px" w="1px" bg={borderColor} mx={1} />

        {/* 정렬 */}
        <ToolBtn
          onClick={() => editor.chain().focus().setTextAlign("left").run()}
          isActive={editor.isActive({ textAlign: "left" })}
          label={t("kaizen.alignLeft")}
        >
          <Icon as={FaAlignLeft} boxSize={3} />
        </ToolBtn>
        <ToolBtn
          onClick={() => editor.chain().focus().setTextAlign("center").run()}
          isActive={editor.isActive({ textAlign: "center" })}
          label={t("kaizen.alignCenter")}
        >
          <Icon as={FaAlignCenter} boxSize={3} />
        </ToolBtn>
        <ToolBtn
          onClick={() => editor.chain().focus().setTextAlign("right").run()}
          isActive={editor.isActive({ textAlign: "right" })}
          label={t("kaizen.alignRight")}
        >
          <Icon as={FaAlignRight} boxSize={3} />
        </ToolBtn>

        <Box h="18px" w="1px" bg={borderColor} mx={1} />

        {/* 링크 / 이미지 */}
        <ToolBtn
          onClick={setLink}
          isActive={editor.isActive("link")}
          label={t("kaizen.link")}
        >
          <Icon as={FaLink} boxSize={3} />
        </ToolBtn>
        <ToolBtn
          onClick={() => inlineImageInputRef.current?.click()}
          label={t("kaizen.insertImage")}
          isLoading={inlineUploading}
        >
          <Icon as={FaImage} boxSize={3} />
        </ToolBtn>
        <input
          ref={inlineImageInputRef}
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          onChange={handleInlineImageSelect}
        />
        <ToolBtn
          onClick={() => inlineVideoInputRef.current?.click()}
          label={t("kaizen.insertVideo")}
          isLoading={inlineVideoUploading}
        >
          <Icon as={FaVideo} boxSize={3} />
        </ToolBtn>
        <input
          ref={inlineVideoInputRef}
          type="file"
          accept="video/*"
          style={{ display: "none" }}
          onChange={handleInlineVideoSelect}
        />
      </Flex>
    </Box>
  );
}


// ──────────────────────────────────────────────────────────────
// 이미지 어노테이션 모달
// ──────────────────────────────────────────────────────────────
type DrawTool = "pen" | "arrow" | "rect" | "circle" | "text" | "eraser";

const COLORS = [
  "#EF4444", "#F97316", "#EAB308", "#22C55E",
  "#3B82F6", "#8B5CF6", "#EC4899", "#000000",
  "#FFFFFF", "#6B7280",
];

function drawArrow(
  ctx: CanvasRenderingContext2D,
  x1: number, y1: number,
  x2: number, y2: number,
  headLen = 16
) {
  const angle = Math.atan2(y2 - y1, x2 - x1);
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.lineTo(x2 - headLen * Math.cos(angle - Math.PI / 7), y2 - headLen * Math.sin(angle - Math.PI / 7));
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - headLen * Math.cos(angle + Math.PI / 7), y2 - headLen * Math.sin(angle + Math.PI / 7));
  ctx.stroke();
}

function ImageAnnotatorModal({
  isOpen,
  onClose,
  imageSrc,
  onSave,
}: {
  isOpen: boolean;
  onClose: () => void;
  imageSrc: string;
  onSave: (blob: Blob) => Promise<void>;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const snapshotRef = useRef<ImageData | null>(null);
  const historyRef = useRef<ImageData[]>([]);
  const isDrawingRef = useRef(false);
  const startRef = useRef({ x: 0, y: 0 });
  const scaleRef = useRef(1);

  const [tool, setTool] = useState<DrawTool>("pen");
  const [color, setColor] = useState("#EF4444");
  const [strokeWidth, setStrokeWidth] = useState(3);
  const [saving, setSaving] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  const toast = useToast();
  const toolbarBg = useColorModeValue("gray.50", "gray.800");
  const borderC = useColorModeValue("gray.200", "gray.600");

  // 이미지 로드 → canvas에 그리기
  // fetch → Blob → DataURL 방식으로 CORS 문제 없이 canvas에 로드
  useEffect(() => {
    if (!isOpen) return;
    setImageLoaded(false);
    historyRef.current = [];

    let cancelled = false;

    const loadImage = async () => {
      // 1) fetch로 이미지 바이트 취득 → DataURL 변환 (canvas tainted 방지)
      let dataUrl: string;
      try {
        const resp = await fetch(imageSrc, { mode: "cors", cache: "no-store" });
        if (!resp.ok) throw new Error("fetch failed");
        const blob = await resp.blob();
        dataUrl = await new Promise<string>((res, rej) => {
          const reader = new FileReader();
          reader.onload = () => res(reader.result as string);
          reader.onerror = rej;
          reader.readAsDataURL(blob);
        });
      } catch {
        // fetch 실패 시 직접 URL 사용 (getImageData는 tainted로 실패할 수 있음)
        dataUrl = imageSrc;
      }

      if (cancelled) return;

      // 2) canvas에 그리기
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const img = new window.Image();
      img.onload = () => {
        if (cancelled) return;
        const maxW = Math.min(window.innerWidth * 0.82, 960);
        const scale = img.naturalWidth > maxW ? maxW / img.naturalWidth : 1;
        scaleRef.current = scale;
        canvas.width = img.naturalWidth * scale;
        canvas.height = img.naturalHeight * scale;
        const ov = overlayRef.current;
        if (ov) { ov.width = canvas.width; ov.height = canvas.height; }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        try {
          historyRef.current = [ctx.getImageData(0, 0, canvas.width, canvas.height)];
        } catch {
          // DataURL 방식도 실패한 경우 undo 비활성
          historyRef.current = [];
        }
        setImageLoaded(true);
      };
      img.onerror = () => {
        if (!cancelled) setImageLoaded(true); // 오류라도 UI는 표시
      };
      img.src = dataUrl;
    };

    loadImage();
    return () => { cancelled = true; };
  }, [isOpen, imageSrc]);

  const getPos = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = overlayRef.current!.getBoundingClientRect();
    const scaleX = overlayRef.current!.width / rect.width;
    const scaleY = overlayRef.current!.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const applyStyle = (ctx: CanvasRenderingContext2D) => {
    ctx.strokeStyle = tool === "eraser" ? "rgba(0,0,0,0)" : color;
    ctx.lineWidth = tool === "eraser" ? strokeWidth * 4 : strokeWidth;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.globalCompositeOperation = tool === "eraser" ? "destination-out" : "source-over";
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!imageLoaded) return;
    const pos = getPos(e);
    isDrawingRef.current = true;
    startRef.current = pos;

    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;

    if (tool === "text") {
      const text = window.prompt("텍스트 입력:");
      if (!text) { isDrawingRef.current = false; return; }
      historyRef.current.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
      ctx.font = `bold ${strokeWidth * 6 + 12}px sans-serif`;
      ctx.fillStyle = color;
      ctx.globalCompositeOperation = "source-over";
      ctx.fillText(text, pos.x, pos.y);
      isDrawingRef.current = false;
      return;
    }

    // 모양 도구: 현재 상태 스냅샷 저장
    if (tool !== "pen" && tool !== "eraser") {
      snapshotRef.current = ctx.getImageData(0, 0, canvas.width, canvas.height);
    }

    // pen/eraser: 이전 완료 스냅샷 저장 (undo용)
    historyRef.current.push(ctx.getImageData(0, 0, canvas.width, canvas.height));

    if (tool === "pen" || tool === "eraser") {
      applyStyle(ctx);
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y);
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current || !imageLoaded) return;
    const pos = getPos(e);
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const ov = overlayRef.current!;
    const ovCtx = ov.getContext("2d")!;

    if (tool === "pen" || tool === "eraser") {
      applyStyle(ctx);
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
    } else {
      // 모양 도구: 오버레이에 프리뷰
      ovCtx.clearRect(0, 0, ov.width, ov.height);
      // 스냅샷 복원 (canvas에 직접 그렸다가 되돌리면 깜빡이므로 overlay 사용)
      ovCtx.strokeStyle = color;
      ovCtx.lineWidth = strokeWidth;
      ovCtx.lineCap = "round";
      const { x: x1, y: y1 } = startRef.current;
      const { x: x2, y: y2 } = pos;

      ovCtx.beginPath();
      if (tool === "arrow") {
        drawArrow(ovCtx, x1, y1, x2, y2);
      } else if (tool === "rect") {
        ovCtx.strokeRect(x1, y1, x2 - x1, y2 - y1);
      } else if (tool === "circle") {
        const rx = Math.abs(x2 - x1) / 2;
        const ry = Math.abs(y2 - y1) / 2;
        ovCtx.ellipse(x1 + (x2 - x1) / 2, y1 + (y2 - y1) / 2, rx, ry, 0, 0, Math.PI * 2);
        ovCtx.stroke();
      }
    }
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current || !imageLoaded) return;
    const pos = getPos(e);
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const ov = overlayRef.current!;
    const ovCtx = ov.getContext("2d")!;

    if (tool === "pen" || tool === "eraser") {
      ctx.closePath();
    } else if (snapshotRef.current) {
      // 스냅샷으로 되돌리고 최종 도형 그리기
      ctx.putImageData(snapshotRef.current, 0, 0);
      applyStyle(ctx);
      const { x: x1, y: y1 } = startRef.current;
      const { x: x2, y: y2 } = pos;

      ctx.beginPath();
      if (tool === "arrow") {
        drawArrow(ctx, x1, y1, x2, y2);
      } else if (tool === "rect") {
        ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
      } else if (tool === "circle") {
        const rx = Math.abs(x2 - x1) / 2;
        const ry = Math.abs(y2 - y1) / 2;
        ctx.ellipse(x1 + (x2 - x1) / 2, y1 + (y2 - y1) / 2, rx, ry, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      ovCtx.clearRect(0, 0, ov.width, ov.height);
    }

    isDrawingRef.current = false;
    ctx.globalCompositeOperation = "source-over";
  };

  const handleUndo = () => {
    if (historyRef.current.length <= 1) return;
    historyRef.current.pop();
    const prev = historyRef.current[historyRef.current.length - 1];
    const ctx = canvasRef.current?.getContext("2d");
    if (ctx && prev) ctx.putImageData(prev, 0, 0);
  };

  const handleClear = () => {
    if (historyRef.current.length < 1) return;
    const base = historyRef.current[0];
    const ctx = canvasRef.current?.getContext("2d");
    if (ctx && base) {
      ctx.putImageData(base, 0, 0);
      historyRef.current = [base];
    }
  };

  const handleSave = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setSaving(true);
    try {
      canvas.toBlob(
        async (blob) => {
          if (!blob) {
            toast({ title: "이미지 내보내기 실패", status: "error", duration: 2000 });
            setSaving(false);
            return;
          }
          try {
            await onSave(blob);
            onClose();
          } catch {
            toast({ title: "업로드 실패", status: "error", duration: 2000 });
          } finally {
            setSaving(false);
          }
        },
        "image/png"
      );
    } catch (e: any) {
      // canvas tainted (CORS) — DataURL 경로가 실패한 경우
      toast({
        title: "이미지 보안 오류",
        description: "이미지 CORS 설정으로 인해 저장할 수 없습니다.",
        status: "error",
        duration: 3000,
      });
      setSaving(false);
    }
  };

  const TOOLS: { id: DrawTool; icon: React.ElementType; label: string }[] = [
    { id: "pen",    icon: FaPen,               label: "펜" },
    { id: "arrow",  icon: FaLongArrowAltRight, label: "화살표" },
    { id: "rect",   icon: FaRegSquare,         label: "사각형" },
    { id: "circle", icon: FaCircle,            label: "원" },
    { id: "text",   icon: FaFont,              label: "텍스트" },
    { id: "eraser", icon: FaEraser,            label: "지우개" },
  ];

  const cursorMap: Record<DrawTool, string> = {
    pen:    "crosshair",
    arrow:  "crosshair",
    rect:   "crosshair",
    circle: "crosshair",
    text:   "text",
    eraser: "cell",
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="4xl" isCentered scrollBehavior="inside">
      <ModalOverlay />
      <ModalContent maxW="90vw">
        <ModalHeader fontSize="md" py={3}>이미지에 그리기</ModalHeader>
        <ModalCloseButton />

        {/* 툴바 */}
        <Box bg={toolbarBg} borderY="1px solid" borderColor={borderC} px={3} py={2}>
          <Flex gap={2} align="center" flexWrap="wrap">
            {/* 도구 */}
            <HStack spacing={1}>
              {TOOLS.map((t) => (
                <Tooltip key={t.id} label={t.label} hasArrow placement="top" openDelay={300}>
                  <IconButton
                    aria-label={t.label}
                    icon={<Icon as={t.icon} />}
                    size="sm"
                    variant={tool === t.id ? "solid" : "ghost"}
                    colorScheme={tool === t.id ? "blue" : undefined}
                    onClick={() => setTool(t.id)}
                  />
                </Tooltip>
              ))}
            </HStack>

            <Box h="28px" w="1px" bg={borderC} />

            {/* 색상 팔레트 */}
            <HStack spacing={1} flexWrap="wrap">
              {COLORS.map((c) => (
                <Box
                  key={c}
                  w={5} h={5}
                  borderRadius="full"
                  bg={c}
                  border="2px solid"
                  borderColor={color === c ? "blue.400" : "transparent"}
                  cursor="pointer"
                  boxShadow={color === c ? "0 0 0 2px var(--chakra-colors-blue-200)" : "none"}
                  onClick={() => setColor(c)}
                  flexShrink={0}
                />
              ))}
            </HStack>

            <Box h="28px" w="1px" bg={borderC} />

            {/* 굵기 */}
            <HStack spacing={2} minW="120px">
              <Text fontSize="xs" whiteSpace="nowrap">굵기 {strokeWidth}</Text>
              <Slider
                min={1} max={20} value={strokeWidth}
                onChange={(v) => setStrokeWidth(v)}
                w="80px"
              >
                <SliderTrack><SliderFilledTrack /></SliderTrack>
                <SliderThumb />
              </Slider>
            </HStack>

            <Box h="28px" w="1px" bg={borderC} />

            {/* Undo / 초기화 */}
            <HStack spacing={1}>
              <Tooltip label="실행 취소 (Undo)" hasArrow>
                <IconButton aria-label="undo" icon={<Icon as={FaUndo} />} size="sm" variant="ghost" onClick={handleUndo} />
              </Tooltip>
              <Tooltip label="전체 초기화" hasArrow>
                <IconButton aria-label="clear" icon={<Icon as={FaTrash} />} size="sm" variant="ghost" colorScheme="red" onClick={handleClear} />
              </Tooltip>
            </HStack>
          </Flex>
        </Box>

        {/* 캔버스 영역 */}
        <ModalBody p={4} overflowX="auto">
          {!imageLoaded && (
            <Flex justify="center" align="center" h="200px">
              <Spinner />
            </Flex>
          )}
          <Box position="relative" display={imageLoaded ? "inline-block" : "none"} lineHeight={0}>
            {/* 베이스 캔버스 (실제 그림) */}
            <canvas ref={canvasRef} style={{ display: "block", maxWidth: "100%" }} />
            {/* 오버레이 캔버스 (모양 프리뷰) */}
            <canvas
              ref={overlayRef}
              style={{
                position: "absolute",
                top: 0, left: 0,
                width: "100%", height: "100%",
                cursor: cursorMap[tool],
                pointerEvents: "auto",
              }}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            />
          </Box>
        </ModalBody>

        <ModalFooter gap={2}>
          <Button variant="ghost" onClick={onClose}>취소</Button>
          <Button
            colorScheme="blue"
            onClick={handleSave}
            isLoading={saving}
            loadingText="업로드 중..."
          >
            저장 후 삽입
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

// ──────────────────────────────────────────────────────────────
// 리사이즈 가능한 이미지 NodeView
// ──────────────────────────────────────────────────────────────
function ResizableImageView({ node, updateAttributes, selected, editor }: NodeViewProps) {
  const imgRef = useRef<HTMLImageElement>(null);
  const startXRef = useRef(0);
  const startWRef = useRef(0);
  const directionRef = useRef<"left" | "right">("right");
  const [resizing, setResizing] = useState(false);
  const { isOpen: isAnnotating, onOpen: openAnnotator, onClose: closeAnnotator } = useDisclosure();
  const toast = useToast();
  const borderColor = useColorModeValue("blue.400", "blue.300");
  const handleBg = useColorModeValue("white", "gray.700");

  const startResize = (e: React.MouseEvent, dir: "left" | "right") => {
    e.preventDefault();
    e.stopPropagation();
    directionRef.current = dir;
    startXRef.current = e.clientX;
    startWRef.current = imgRef.current?.offsetWidth ?? 300;
    setResizing(true);

    const onMove = (ev: MouseEvent) => {
      const delta = directionRef.current === "right"
        ? ev.clientX - startXRef.current
        : startXRef.current - ev.clientX;
      const newW = Math.max(60, startWRef.current + delta);
      updateAttributes({ width: newW });
    };

    const onUp = () => {
      setResizing(false);
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  };

  const handleAnnotationSave = async (blob: Blob) => {
    const file = new File([blob], "annotated.png", { type: "image/png" });
    const urlData = await getUploadURL();
    const dt = new DataTransfer();
    dt.items.add(file);
    const cfResult: any = await uploadImage({ file: dt.files, uploadURL: urlData.uploadURL });
    const cfUrl = `https://imagedelivery.net/mzmXhxWLR9jzdX8u9g4BBQ/${cfResult.result.id}/public`;
    updateAttributes({ src: cfUrl, width: null });
    toast({ title: "어노테이션 이미지가 저장되었습니다.", status: "success", duration: 2000, position: "bottom-right" });
  };

  const width = node.attrs.width ? `${node.attrs.width}px` : "auto";
  const maxW = node.attrs.width ? undefined : "100%";
  const handleStyle: React.CSSProperties = {
    position: "absolute",
    top: "50%",
    transform: "translateY(-50%)",
    width: 10,
    height: 32,
    borderRadius: 4,
    cursor: "ew-resize",
    background: handleBg,
    border: `2px solid`,
    borderColor: borderColor,
    zIndex: 10,
  };

  return (
    <NodeViewWrapper
      as="span"
      style={{
        display: "inline-block",
        position: "relative",
        lineHeight: 0,
        userSelect: "none",
        cursor: resizing ? "ew-resize" : "default",
      }}
    >
      <img
        ref={imgRef}
        src={node.attrs.src}
        alt={node.attrs.alt ?? ""}
        title={node.attrs.title ?? ""}
        draggable={false}
        style={{
          width,
          maxWidth: maxW,
          display: "block",
          borderRadius: 6,
          outline: selected ? `2px solid` : "none",
          outlineColor: selected ? "var(--chakra-colors-blue-400)" : "transparent",
          margin: "12px 0",
        }}
      />
      {selected && (
        <>
          {/* 왼쪽 핸들 */}
          <span
            style={{ ...handleStyle, left: -6 }}
            onMouseDown={(e) => startResize(e, "left")}
          />
          {/* 오른쪽 핸들 */}
          <span
            style={{ ...handleStyle, right: -6 }}
            onMouseDown={(e) => startResize(e, "right")}
          />
          {/* 상단 툴바: 그리기 버튼 + 너비 */}
          <span
            style={{
              position: "absolute",
              top: -34,
              left: "50%",
              transform: "translateX(-50%)",
              display: "flex",
              gap: 6,
              alignItems: "center",
              background: "rgba(0,0,0,0.7)",
              borderRadius: 6,
              padding: "3px 8px",
              whiteSpace: "nowrap",
              zIndex: 20,
              pointerEvents: "auto",
            }}
          >
            <button
              style={{
                background: "none",
                border: "none",
                color: "#fff",
                fontSize: 11,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 4,
              }}
              onMouseDown={(e) => { e.stopPropagation(); openAnnotator(); }}
            >
              ✏️ 그리기
            </button>
            {node.attrs.width && (
              <>
                <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 10 }}>|</span>
                <span style={{ color: "rgba(255,255,255,0.8)", fontSize: 10 }}>
                  {node.attrs.width}px
                </span>
              </>
            )}
          </span>
        </>
      )}

      {/* 어노테이션 모달 */}
      <ImageAnnotatorModal
        isOpen={isAnnotating}
        onClose={closeAnnotator}
        imageSrc={node.attrs.src}
        onSave={handleAnnotationSave}
      />
    </NodeViewWrapper>
  );
}

// ResizableImage Extension — TiptapImage를 확장해 width 속성 + NodeView 추가
const ResizableImage = TiptapImage.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
        parseHTML: (el) =>
          el.getAttribute("width") ||
          (el as HTMLElement).style.width?.replace("px", "") ||
          null,
        renderHTML: (attrs) =>
          attrs.width
            ? { width: attrs.width, style: `width: ${attrs.width}px; max-width: 100%;` }
            : {},
      },
    };
  },
  addNodeView() {
    return ReactNodeViewRenderer(ResizableImageView);
  },
});

// ──────────────────────────────────────────────────────────────
// 인라인 Video 노드 (Cloudflare Stream iframe)
// ──────────────────────────────────────────────────────────────
function VideoNodeView({ node, selected, updateAttributes }: NodeViewProps) {
  const startXRef = useRef(0);
  const startWRef = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const borderColor = useColorModeValue("blue.400", "blue.300");
  const overlayBg = useColorModeValue("gray.100", "gray.700");
  const [resizing, setResizing] = useState(false);

  const startResize = (e: React.MouseEvent, dir: "left" | "right") => {
    e.preventDefault();
    e.stopPropagation();
    startXRef.current = e.clientX;
    startWRef.current = containerRef.current?.offsetWidth ?? 560;
    setResizing(true);

    const onMove = (ev: MouseEvent) => {
      const delta = dir === "right"
        ? ev.clientX - startXRef.current
        : startXRef.current - ev.clientX;
      const newW = Math.max(200, startWRef.current + delta);
      updateAttributes({ width: newW });
    };
    const onUp = () => {
      setResizing(false);
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  };

  const width = node.attrs.width ? `${node.attrs.width}px` : "100%";
  const handleStyle: React.CSSProperties = {
    position: "absolute",
    top: "50%",
    transform: "translateY(-50%)",
    width: 10,
    height: 32,
    borderRadius: 4,
    cursor: "ew-resize",
    background: "white",
    border: "2px solid var(--chakra-colors-blue-400)",
    zIndex: 10,
  };

  return (
    <NodeViewWrapper as="div" style={{ margin: "16px 0", userSelect: "none" }}>
      <div
        ref={containerRef}
        style={{
          position: "relative",
          width,
          maxWidth: "100%",
          outline: selected ? "2px solid var(--chakra-colors-blue-400)" : "none",
          borderRadius: 8,
          overflow: "hidden",
          cursor: resizing ? "ew-resize" : "default",
        }}
      >
        {/* 16:9 iframe */}
        <div style={{ position: "relative", paddingBottom: "56.25%", height: 0 }}>
          <iframe
            src={node.attrs.src}
            style={{
              position: "absolute",
              top: 0, left: 0,
              width: "100%", height: "100%",
              border: "none",
            }}
            allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture"
            allowFullScreen
            title="video"
          />
          {/* 클릭 차단 오버레이 (편집 중 iframe이 마우스 이벤트를 가로채지 않도록) */}
          {selected && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: "transparent",
                zIndex: 5,
                cursor: "default",
              }}
            />
          )}
        </div>

        {/* 리사이즈 핸들 + 너비 표시 */}
        {selected && (
          <>
            <span style={{ ...handleStyle, left: -6 }} onMouseDown={(e) => startResize(e, "left")} />
            <span style={{ ...handleStyle, right: -6 }} onMouseDown={(e) => startResize(e, "right")} />
            {node.attrs.width && (
              <span style={{
                position: "absolute", bottom: 6, left: "50%",
                transform: "translateX(-50%)",
                fontSize: 10, background: "rgba(0,0,0,0.6)",
                color: "#fff", padding: "1px 6px", borderRadius: 3,
                pointerEvents: "none", zIndex: 20, whiteSpace: "nowrap",
              }}>
                {node.attrs.width}px
              </span>
            )}
          </>
        )}
      </div>
    </NodeViewWrapper>
  );
}

const VideoNode = Node.create({
  name: "video",
  group: "block",
  atom: true,

  addAttributes() {
    return {
      src:       { default: null },
      thumbnail: { default: null },
      width:     { default: null },
    };
  },

  parseHTML() {
    return [{ tag: "div[data-video-src]" }];
  },

  renderHTML({ HTMLAttributes }) {
    const { src, width } = HTMLAttributes;
    const style = [
      "position:relative;padding-bottom:56.25%;height:0;overflow:hidden;border-radius:8px;",
      width ? `width:${width}px;max-width:100%;` : "width:100%;",
    ].join("");
    return [
      "div",
      { "data-video-src": src ?? "", style },
      [
        "iframe",
        {
          src: src ?? "",
          style: "position:absolute;top:0;left:0;width:100%;height:100%;border:none;",
          allow: "accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture",
          allowfullscreen: "true",
          frameborder: "0",
        },
      ],
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(VideoNodeView);
  },
});

// ──────────────────────────────────────────────────────────────
// 범용 검색+선택 컴포넌트 (SearchSelect)
// ──────────────────────────────────────────────────────────────
function SearchSelect<T extends { pk: number }>({
  selected,
  onSelect,
  onClear,
  options,
  isLoading,
  placeholder,
  onQueryChange,
  renderLabel,
  renderOption,
}: {
  selected: T | null;
  onSelect: (item: T) => void;
  onClear: () => void;
  options: T[];
  isLoading?: boolean;
  placeholder: string;
  onQueryChange: (q: string) => void;
  renderLabel: (item: T) => string;
  renderOption?: (item: T) => React.ReactNode;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const borderColor = useColorModeValue("gray.200", "gray.600");
  const dropBg = useColorModeValue("white", "gray.700");
  const hoverBg = useColorModeValue("blue.50", "blue.800");
  const selectedBg = useColorModeValue("blue.50", "blue.900");

  // 외부 클릭 시 닫기
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as globalThis.Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const q = e.target.value;
    setQuery(q);
    onQueryChange(q);
    setOpen(true);
  };

  const handleSelect = (item: T) => {
    onSelect(item);
    setQuery("");
    setOpen(false);
  };

  return (
    <Box ref={wrapRef} position="relative">
      {selected ? (
        <HStack
          spacing={2}
          px={2}
          py={1}
          borderWidth="1px"
          borderColor="blue.300"
          borderRadius="md"
          bg={selectedBg}
          fontSize="sm"
        >
          <Text flex={1} noOfLines={1}>{renderLabel(selected)}</Text>
          <IconButton
            aria-label="clear"
            icon={<Icon as={FaTimes} boxSize={3} />}
            size="xs"
            variant="ghost"
            onClick={onClear}
            flexShrink={0}
          />
        </HStack>
      ) : (
        <HStack
          borderWidth="1px"
          borderColor={borderColor}
          borderRadius="md"
          px={2}
          py={0.5}
        >
          <Icon as={FaSearch} color="gray.400" boxSize={3} />
          <Input
            variant="unstyled"
            size="sm"
            placeholder={placeholder}
            value={query}
            onChange={handleInput}
            onFocus={() => { onQueryChange(query); setOpen(true); }}
          />
          {isLoading && <Spinner size="xs" />}
        </HStack>
      )}

      {open && !selected && (
        <Box
          position="absolute"
          top="100%"
          left={0}
          right={0}
          zIndex={200}
          mt={1}
          maxH="200px"
          overflowY="auto"
          bg={dropBg}
          borderWidth="1px"
          borderColor={borderColor}
          borderRadius="md"
          boxShadow="lg"
        >
          {options.length === 0 ? (
            <Text px={3} py={2} fontSize="sm" color="gray.400">
              {isLoading ? "검색 중..." : "결과 없음"}
            </Text>
          ) : (
            options.map((item) => (
              <Box
                key={item.pk}
                px={3}
                py={2}
                fontSize="sm"
                cursor="pointer"
                _hover={{ bg: hoverBg }}
                onMouseDown={(e) => { e.preventDefault(); handleSelect(item); }}
              >
                {renderOption ? renderOption(item) : renderLabel(item)}
              </Box>
            ))
          )}
        </Box>
      )}
    </Box>
  );
}

// ──────────────────────────────────────────────────────────────
// 에디터 드래그앤드랍 래퍼 (Tiptap handleDrop 외에 시각 피드백용)
// ──────────────────────────────────────────────────────────────
function EditorDropZone({
  children,
  editorBg,
  borderColor,
  onImageUpload,
}: {
  children: React.ReactNode;
  editorBg: string;
  borderColor: string;
  onImageUpload: (file: File) => Promise<void>;
}) {
  const [isDragging, setIsDragging] = useState(false);
  const dragCountRef = useRef(0);

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    dragCountRef.current += 1;
    const hasMediaFile = Array.from(e.dataTransfer.items).some(
      (item) => item.kind === "file" && (item.type.startsWith("image/") || item.type.startsWith("video/"))
    );
    if (hasMediaFile) setIsDragging(true);
  };

  const handleDragLeave = () => {
    dragCountRef.current -= 1;
    if (dragCountRef.current === 0) setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    dragCountRef.current = 0;
    setIsDragging(false);
    // 실제 업로드는 Tiptap editorProps.handleDrop에서 처리
  };

  return (
    <Box
      bg={editorBg}
      borderWidth="2px"
      borderColor={isDragging ? "blue.400" : borderColor}
      borderStyle={isDragging ? "dashed" : "solid"}
      borderRadius="xl"
      p={4}
      minH="400px"
      position="relative"
      transition="border-color 0.15s"
      onDragEnter={handleDragEnter}
      onDragOver={(e) => e.preventDefault()}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {isDragging && (
        <Box
          position="absolute"
          inset={0}
          borderRadius="xl"
          bg="blue.50"
          opacity={0.4}
          pointerEvents="none"
          zIndex={1}
        />
      )}
      {isDragging && (
        <Flex
          position="absolute"
          inset={0}
          align="center"
          justify="center"
          pointerEvents="none"
          zIndex={2}
        >
          <VStack spacing={2}>
            <Icon as={FaImage} boxSize={8} color="blue.400" />
            <Text fontWeight="semibold" color="blue.500" fontSize="sm">
              이미지 / 영상을 여기에 놓으면 업로드됩니다
            </Text>
          </VStack>
        </Flex>
      )}
      {children}
    </Box>
  );
}

// ──────────────────────────────────────────────────────────────
// 메인 에디터
// ──────────────────────────────────────────────────────────────
export default function SjKaizenEditor() {
  const { t } = useTranslation();
  const { kaizenId } = useParams<{ kaizenId: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();
  const isEdit = !!kaizenId;

  // 폼 상태
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<KaizenCategory>("other");
  const [isPublished, setIsPublished] = useState(false);

  // 연결 링크 (SearchSelect)
  const [selectedStyle, setSelectedStyle] = useState<ISjStyle | null>(null);
  const [selectedSjNo, setSelectedSjNo] = useState<ISjNo | null>(null);
  const [selectedFactory, setSelectedFactory] = useState<{ pk: number; name: string } | null>(null);
  const [selectedLine, setSelectedLine] = useState<IProductionLine | null>(null);
  const [selectedModule, setSelectedModule] = useState<IModule | null>(null);
  const [selectedProcess, setSelectedProcess] = useState<IProcess | null>(null);

  // 검색 쿼리 상태
  const [styleQuery, setStyleQuery] = useState("");
  const [sjNoQuery, setSjNoQuery] = useState("");
  const [moduleQuery, setModuleQuery] = useState("");
  const [processQuery, setProcessQuery] = useState("");

  const [photos, setPhotos] = useState<IKaizenPhoto[]>([]);
  const [videos, setVideos] = useState<IKaizenVideo[]>([]);

  // 이미지 — 선택 후 대기 상태 (SJ Process 패턴)
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [pendingPreviews, setPendingPreviews] = useState<string[]>([]);
  const [imageUploading, setImageUploading] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

  // 비디오 — 선택 후 대기 상태 (SJ Process 패턴)
  const [pendingVideoFile, setPendingVideoFile] = useState<File | null>(null);
  const [videoUploading, setVideoUploading] = useState(false);
  const videoInputRef = useRef<HTMLInputElement>(null);

  // ── 검색 데이터 쿼리 ─────────────────────────────────────────
  const { data: styleResults, isFetching: styleFetching } = useQuery({
    queryKey: ["kaizen-style-search", styleQuery],
    queryFn: () => getSjStyles({ search: styleQuery }),
    enabled: styleQuery.length > 0,
    staleTime: 10000,
  });

  const { data: sjNoResults, isFetching: sjNoFetching } = useQuery({
    queryKey: ["kaizen-sjno-search", sjNoQuery, selectedStyle?.pk],
    queryFn: () => getSjNos({ search: sjNoQuery }),
    enabled: sjNoQuery.length > 0,
    staleTime: 10000,
  });

  const { data: productionLinesData } = useQuery({
    queryKey: ["production-lines"],
    queryFn: getProductionLines,
    staleTime: 60000,
  });

  // 고유 공장 목록 (생산라인 데이터에서 파생)
  const factories = useCallback(() => {
    const lines = productionLinesData ?? [];
    const seen = new Set<number>();
    const result: { pk: number; name: string }[] = [];
    lines.forEach((l) => {
      if (!seen.has(l.factory)) {
        seen.add(l.factory);
        result.push({ pk: l.factory, name: l.factory_name });
      }
    });
    return result;
  }, [productionLinesData]);

  // 선택한 공장의 라인만 필터
  const filteredLines = (productionLinesData ?? []).filter(
    (l) => !selectedFactory || l.factory === selectedFactory.pk
  );

  const { data: moduleResults, isFetching: moduleFetching } = useQuery({
    queryKey: ["kaizen-module-search", moduleQuery],
    queryFn: () => getModules({ search: moduleQuery }),
    enabled: moduleQuery.length > 0,
    staleTime: 10000,
  });

  const { data: processResults, isFetching: processFetching } = useQuery({
    queryKey: ["kaizen-process-search", processQuery, selectedModule?.pk],
    queryFn: () => getProcesses({ search: processQuery, module: selectedModule?.pk }),
    enabled: processQuery.length > 0,
    staleTime: 10000,
  });

  // editorProps 안에서 upload 함수를 참조하기 위한 ref (선언 순서 문제 해결)
  const uploadInlineImageRef = useRef<((file: File) => Promise<void>) | null>(null);
  const uploadInlineVideoRef = useRef<((file: File) => Promise<void>) | null>(null);

  // Tiptap 에디터
  const editor = useEditor({
    extensions: [
      StarterKit,
      ResizableImage.configure({ inline: true, allowBase64: false }),
      VideoNode,
      Underline,
      TextStyle,
      Color,
      Link.configure({ openOnClick: false }),
      Placeholder.configure({ placeholder: t("kaizen.editorContentPlaceholder") }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
    ],
    content: "",
    editorProps: {
      // 에디터 영역에 파일 드래그앤드랍 (이미지 + 영상)
      handleDrop(_view, event) {
        const files = event.dataTransfer?.files;
        if (!files?.length) return false;
        const imageFiles = Array.from(files).filter((f) => f.type.startsWith("image/"));
        const videoFiles = Array.from(files).filter((f) => f.type.startsWith("video/"));
        if (!imageFiles.length && !videoFiles.length) return false;
        event.preventDefault();
        imageFiles.forEach((f) => uploadInlineImageRef.current?.(f));
        videoFiles.forEach((f) => uploadInlineVideoRef.current?.(f));
        return true;
      },
      // 클립보드 붙여넣기 (스크린샷 등)
      handlePaste(_view, event) {
        const files = event.clipboardData?.files;
        if (!files?.length) return false;
        const imageFiles = Array.from(files).filter((f) => f.type.startsWith("image/"));
        if (!imageFiles.length) return false;
        imageFiles.forEach((f) => uploadInlineImageRef.current?.(f));
        return true;
      },
    },
  });

  // 에디터 인라인 이미지 업로드 (툴바 버튼 + 드래그앤드랍 + 붙여넣기 공용)
  const uploadInlineImage = useCallback(
    async (file: File) => {
      if (!editor) return;
      try {
        const urlData = await getUploadURL();
        const dt = new DataTransfer();
        dt.items.add(file);
        const cfResult: any = await uploadImage({ file: dt.files, uploadURL: urlData.uploadURL });
        const cfUrl = `https://imagedelivery.net/mzmXhxWLR9jzdX8u9g4BBQ/${cfResult.result.id}/public`;
        editor.chain().focus().setImage({ src: cfUrl }).run();
      } catch {
        toast({ title: t("kaizen.uploadError"), status: "error", duration: 2000, position: "bottom-right" });
      }
    },
    [editor, toast, t]
  );
  // ref를 최신 함수로 항상 동기화
  uploadInlineImageRef.current = uploadInlineImage;

  // 에디터 인라인 비디오 업로드 (툴바 버튼 + 드래그앤드랍 공용)
  const uploadInlineVideo = useCallback(
    async (file: File) => {
      if (!editor) return;
      try {
        // 1) Cloudflare Stream 업로드 URL 발급
        const urlData = await getUploadVideoURL();
        const uid: string = urlData.id;
        // 2) Cloudflare Stream에 직접 업로드
        const dt = new DataTransfer();
        dt.items.add(file);
        await uploadVideo({ file: dt.files, uploadURL: urlData.uploadURL });
        // 3) 업로드 완료 후 메타데이터(thumbnail) 조회
        const videoData: any = await getVideoData(uid);
        const src = `https://customer-kc2gx0yn68qxte35.cloudflarestream.com/${videoData.uid}/iframe`;
        const thumbnail = videoData?.thumbnail ?? "";
        // 4) 에디터에 video 노드 삽입
        editor.chain().focus().insertContent({
          type: "video",
          attrs: { src, thumbnail },
        }).run();
      } catch {
        toast({ title: t("kaizen.uploadError"), status: "error", duration: 3000, position: "bottom-right" });
      }
    },
    [editor, toast, t]
  );
  uploadInlineVideoRef.current = uploadInlineVideo;

  // 기존 포스트 로드 (편집 모드)
  const { data: existingPost } = useQuery<ISjKaizenPost>({
    queryKey: ["kaizenPost", kaizenId],
    queryFn: () => getKaizenPost(Number(kaizenId)),
    enabled: isEdit
  });

  useEffect(() => {
    if (existingPost && editor) {
      setTitle(existingPost.title);
      setCategory(existingPost.category);
      setIsPublished(existingPost.is_published);
      setPhotos(existingPost.photos || []);
      setVideos(existingPost.videos || []);

      // 연결 링크 복원
      if (existingPost.sj_style && existingPost.sj_style_code) {
        setSelectedStyle({
          pk: existingPost.sj_style,
          code: existingPost.sj_style_code,
          style_name: existingPost.sj_style_name ?? "",
        } as ISjStyle);
      }
      if (existingPost.sj_no && existingPost.sj_no_value) {
        setSelectedSjNo({
          pk: existingPost.sj_no,
          sj_no: existingPost.sj_no_value,
          sj_style: existingPost.sj_style ?? 0,
        } as ISjNo);
      }
      if (existingPost.factory && existingPost.factory_name) {
        setSelectedFactory({ pk: existingPost.factory, name: existingPost.factory_name });
      }
      if (existingPost.production_line && existingPost.production_line_name) {
        setSelectedLine({
          pk: existingPost.production_line,
          name: existingPost.production_line_name,
          factory: existingPost.factory ?? 0,
          factory_name: existingPost.factory_name ?? "",
        } as IProductionLine);
      }
      if (existingPost.module_info) {
        setSelectedModule({ pk: existingPost.module_info.pk, code: existingPost.module_info.code, name: existingPost.module_info.name } as IModule);
      }
      if (existingPost.process_info) {
        setSelectedProcess({ pk: existingPost.process_info.pk, code: existingPost.process_info.code, name: existingPost.process_info.name } as IProcess);
      }

      if (existingPost.content && Object.keys(existingPost.content).length > 0) {
        editor.commands.setContent(existingPost.content as Parameters<typeof editor.commands.setContent>[0]);
      }
    }
  }, [existingPost, editor]);

  // 저장
  const saveMutation = useMutation({
    mutationFn: async (publish: boolean) => {
      const content = editor?.getJSON() ?? {};
      const payload = {
        title,
        content,
        category,
        is_published: publish,
        sj_style: selectedStyle?.pk ?? null,
        sj_no: selectedSjNo?.pk ?? null,
        factory: selectedFactory?.pk ?? null,
        production_line: selectedLine?.pk ?? null,
        module: selectedModule?.pk ?? null,
        process: selectedProcess?.pk ?? null,
      };
      if (isEdit) {
        return updateKaizenPost(Number(kaizenId), payload);
      }
      return createKaizenPost(payload);
    },
    onSuccess: (data) => {
      toast({
        title: isEdit ? "포스트가 업데이트되었습니다." : "포스트가 작성되었습니다.",
        status: "success",
        duration: 2500
      });
      queryClient.invalidateQueries({ queryKey: ["kaizenPosts"] });
      navigate(`/kaizen/${data.id}`);
    },
    onError: () => {
      toast({ title: "저장 중 오류가 발생했습니다.", status: "error", duration: 3000 });
    }
  });

  // ── 이미지: 파일 선택 (SJ Process 방식) ──────────────────────
  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setPendingFiles((prev) => [...prev, ...files]);
    setPendingPreviews((prev) => [...prev, ...files.map((f) => URL.createObjectURL(f))]);
    if (photoInputRef.current) photoInputRef.current.value = "";
  };

  const removePendingPhoto = (idx: number) => {
    setPendingFiles((prev) => prev.filter((_, i) => i !== idx));
    setPendingPreviews((prev) => {
      URL.revokeObjectURL(prev[idx]);
      return prev.filter((_, i) => i !== idx);
    });
  };

  // ── 이미지: Cloudflare 업로드 (SJ Process와 동일 흐름) ────────
  const handleUploadPhotos = async () => {
    if (!pendingFiles.length || !isEdit) return;
    setImageUploading(true);
    try {
      for (const file of pendingFiles) {
        // 1) Django → Cloudflare 일회용 URL 발급
        const urlData = await getUploadURL();
        // 2) Cloudflare에 직접 업로드
        const dt = new DataTransfer();
        dt.items.add(file);
        const cfResult: any = await uploadImage({ file: dt.files, uploadURL: urlData.uploadURL });
        // 3) CDN URL 조합
        const cfUrl = `https://imagedelivery.net/mzmXhxWLR9jzdX8u9g4BBQ/${cfResult.result.id}/public`;
        // 4) Django(kaizen) DB 저장
        const photo = await createKaizenPhoto({
          file: cfUrl,
          postPk: Number(kaizenId),
          description: file.name,
        });
        setPhotos((prev) => [...prev, photo]);
      }
      setPendingFiles([]);
      setPendingPreviews([]);
      toast({ title: t("kaizen.uploadSuccess"), status: "success", duration: 2000, position: "bottom-right" });
    } catch {
      toast({ title: t("kaizen.uploadError"), status: "error", duration: 2000, position: "bottom-right" });
    } finally {
      setImageUploading(false);
    }
  };

  const handleDeletePhoto = async (photoPk: number) => {
    if (!isEdit) return;
    try {
      await deleteKaizenPhoto({ postPk: Number(kaizenId), photoPk });
      setPhotos((prev) => prev.filter((p) => p.pk !== photoPk));
    } catch {
      toast({ title: "삭제 실패", status: "error", duration: 1500 });
    }
  };

  // ── 비디오: 파일 선택 (SJ Process 방식) ──────────────────────
  const handleVideoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPendingVideoFile(file);
    if (videoInputRef.current) videoInputRef.current.value = "";
  };

  // ── 비디오: Cloudflare Stream 업로드 (SJ Process와 동일 흐름) ─
  const handleUploadVideo = async () => {
    if (!pendingVideoFile || !isEdit) return;
    setVideoUploading(true);
    try {
      // 1) Django → Cloudflare Stream 일회용 URL + uid 발급
      const urlData = await getUploadVideoURL();
      const uid: string = urlData.id;
      // 2) Cloudflare Stream에 직접 업로드 (multipart/form-data)
      const dt = new DataTransfer();
      dt.items.add(pendingVideoFile);
      await uploadVideo({ file: dt.files, uploadURL: urlData.uploadURL });
      // 3) 업로드 완료 후 비디오 메타데이터(thumbnail) 조회
      const videoData: any = await getVideoData(uid);
      const VideoFile = `https://customer-kc2gx0yn68qxte35.cloudflarestream.com/${videoData.uid}/iframe`;
      const ThumbnailFile = videoData?.thumbnail ?? "";
      // 4) Django(kaizen) DB 저장
      const video = await createKaizenVideo({
        VideoFile,
        ThumbnailFile,
        postPk: Number(kaizenId),
        description: pendingVideoFile.name,
      });
      setVideos((prev) => [...prev, video]);
      setPendingVideoFile(null);
      toast({ title: t("kaizen.uploadSuccess"), status: "success", duration: 2000, position: "bottom-right" });
    } catch {
      toast({ title: t("kaizen.uploadError"), status: "error", duration: 3000, position: "bottom-right" });
    } finally {
      setVideoUploading(false);
    }
  };

  const handleDeleteVideo = async (videoPk: number) => {
    if (!isEdit) return;
    try {
      await deleteKaizenVideo({ postPk: Number(kaizenId), videoPk });
      setVideos((prev) => prev.filter((v) => v.pk !== videoPk));
    } catch {
      toast({ title: "삭제 실패", status: "error", duration: 1500 });
    }
  };

  const bgPage = useColorModeValue("gray.50", "gray.900");
  const bgCard = useColorModeValue("white", "gray.800");
  const borderColor = useColorModeValue("gray.200", "gray.700");
  const editorBg = useColorModeValue("white", "gray.800");
  const textMuted = useColorModeValue("gray.500", "gray.400");
  const sidebarBg = useColorModeValue("gray.50", "gray.800");
  const videoFallbackBg = useColorModeValue("gray.100", "gray.700");

  return (
    <Box bg={bgPage} minH="100vh" pb={16}>
      {/* 상단 바 */}
      <Box
        bg={bgCard}
        borderBottomWidth="1px"
        borderColor={borderColor}
        py={3}
        px={{ base: 4, lg: 8 }}
        position="sticky"
        top={0}
        zIndex={10}
      >
        <Flex justify="space-between" align="center">
          <Button
            variant="ghost"
            size="sm"
            leftIcon={<Icon as={FaArrowLeft} />}
            onClick={() => navigate(isEdit ? `/kaizen/${kaizenId}` : "/kaizen")}
          >
            {t("kaizen.back")}
          </Button>
          <HStack spacing={3}>
            <HStack spacing={2}>
              <Text fontSize="xs" color={textMuted}>{t("kaizen.draft")}</Text>
              <Switch
                size="sm"
                isChecked={isPublished}
                onChange={(e) => setIsPublished(e.target.checked)}
                colorScheme="green"
              />
              <Text fontSize="xs" color={isPublished ? "green.500" : textMuted}>
                {isPublished ? t("kaizen.published") : t("kaizen.draft")}
              </Text>
            </HStack>
            <Button
              size="sm"
              variant="outline"
              isLoading={saveMutation.isPending && !isPublished}
              onClick={() => saveMutation.mutate(false)}
            >
              {t("kaizen.editorSaveDraft")}
            </Button>
            <Button
              size="sm"
              colorScheme="blue"
              isLoading={saveMutation.isPending && isPublished}
              onClick={() => saveMutation.mutate(true)}
            >
              {isEdit ? t("kaizen.editorUpdate") : t("kaizen.editorPublish")}
            </Button>
          </HStack>
        </Flex>
      </Box>

      {/* 본문 레이아웃 */}
      <Flex
        px={{ base: 4, lg: 8 }}
        pt={6}
        gap={6}
        align="flex-start"
        maxW="1200px"
        mx="auto"
        direction={{ base: "column", xl: "row" }}
      >
        {/* 왼쪽: 에디터 */}
        <Box flex={1} minW={0}>
          {/* 제목 */}
          <Input
            variant="unstyled"
            fontSize="2xl"
            fontWeight="bold"
            placeholder={t("kaizen.editorTitlePlaceholder")}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            mb={4}
            px={4}
            py={3}
            borderWidth="1px"
            borderColor={borderColor}
            borderRadius="xl"
            bg={bgCard}
          />

          {/* Tiptap 편집기 */}
          <EditorDropZone
            editorBg={editorBg}
            borderColor={borderColor}
            onImageUpload={uploadInlineImage}
          >
            <EditorToolbar
              editor={editor}
              onImageUpload={uploadInlineImage}
              onVideoUpload={uploadInlineVideo}
            />
            <Box
              sx={{
                ".ProseMirror": {
                  minH: "300px",
                  outline: "none",
                  fontSize: "md",
                  lineHeight: "1.8",
                  "h1, h2, h3": { fontWeight: "bold", mt: 4, mb: 2 },
                  h1: { fontSize: "2xl" },
                  h2: { fontSize: "xl" },
                  h3: { fontSize: "lg" },
                  "ul, ol": { pl: 6, mb: 3 },
                  ul: { listStyleType: "disc" },
                  ol: { listStyleType: "decimal" },
                  img: { borderRadius: "md", my: 3, maxW: "100%", cursor: "default" },
                  a: { color: "blue.400", textDecoration: "underline" },
                  ".is-editor-empty:first-child::before": {
                    content: "attr(data-placeholder)",
                    color: textMuted,
                    pointerEvents: "none",
                    position: "absolute",
                    float: "left",
                    height: 0
                  }
                }
              }}
            >
              <EditorContent editor={editor} />
            </Box>
          </EditorDropZone>

          {/* 미디어 갤러리 */}
          <Box
            bg={bgCard}
            borderWidth="1px"
            borderColor={borderColor}
            borderRadius="xl"
            p={4}
            mt={4}
          >
            <Text fontWeight="bold" fontSize="md" mb={3}>
              {t("kaizen.editorMediaGallery")}
            </Text>

            {!isEdit ? (
              <Text fontSize="xs" color={textMuted}>
                포스트를 먼저 저장(초안)하면 미디어를 업로드할 수 있습니다.
              </Text>
            ) : (
              <>
                {/* ── 이미지 섹션 ── */}
                <HStack mb={2} justify="space-between">
                  <Text fontSize="sm" fontWeight="semibold">{t("kaizen.uploadImage")}</Text>
                  <HStack>
                    <Button size="xs" leftIcon={<Icon as={FaImage} />} variant="outline"
                      onClick={() => photoInputRef.current?.click()}>
                      {t("kaizen.editorAddImage")}
                    </Button>
                    {pendingFiles.length > 0 && (
                      <Button size="xs" colorScheme="blue"
                        isLoading={imageUploading} loadingText={t("kaizen.uploading")}
                        onClick={handleUploadPhotos}>
                        업로드 {pendingFiles.length}장
                      </Button>
                    )}
                  </HStack>
                </HStack>
                <input ref={photoInputRef} type="file" accept="image/*" multiple
                  style={{ display: "none" }} onChange={handlePhotoSelect} />

                {/* 대기 중 미리보기 */}
                {pendingPreviews.length > 0 && (
                  <Box
                    display="grid"
                    gridTemplateColumns="repeat(auto-fill, minmax(100px, 1fr))"
                    gap={2} mb={3}
                  >
                    {pendingPreviews.map((src, idx) => (
                      <Box key={idx} position="relative" borderRadius="md" overflow="hidden"
                        border="2px dashed" borderColor="blue.300">
                        <Image src={src} w="full" h="80px" objectFit="cover" />
                        <IconButton aria-label="remove" icon={<Icon as={FaTrash} />}
                          size="xs" colorScheme="red" position="absolute" top={1} right={1}
                          onClick={() => removePendingPhoto(idx)} />
                      </Box>
                    ))}
                  </Box>
                )}

                {/* 저장된 사진 */}
                {photos.length > 0 && (
                  <Box
                    display="grid"
                    gridTemplateColumns="repeat(auto-fill, minmax(120px, 1fr))"
                    gap={2} mb={4}
                  >
                    {photos.map((photo) => (
                      <Box key={photo.pk} position="relative" borderRadius="md" overflow="hidden"
                        border="1px solid" borderColor={borderColor}>
                        <Image src={photo.file} w="full" h="90px" objectFit="cover" />
                        <IconButton aria-label="delete" icon={<Icon as={FaTrash} />}
                          size="xs" colorScheme="red" position="absolute" top={1} right={1}
                          onClick={() => handleDeletePhoto(photo.pk)} />
                      </Box>
                    ))}
                  </Box>
                )}

                {/* ── 비디오 섹션 ── */}
                <HStack mb={2} justify="space-between">
                  <Text fontSize="sm" fontWeight="semibold">{t("kaizen.uploadVideo")}</Text>
                  <HStack>
                    {pendingVideoFile && (
                      <Text fontSize="xs" color="blue.400" maxW="140px" noOfLines={1}>
                        {pendingVideoFile.name}
                      </Text>
                    )}
                    <Button size="xs" leftIcon={<Icon as={FaVideo} />} variant="outline"
                      onClick={() => videoInputRef.current?.click()}>
                      {t("kaizen.editorAddVideo")}
                    </Button>
                    {pendingVideoFile && (
                      <Button size="xs" colorScheme="blue"
                        isLoading={videoUploading} loadingText={t("kaizen.uploading")}
                        onClick={handleUploadVideo}>
                        업로드
                      </Button>
                    )}
                  </HStack>
                </HStack>
                <input ref={videoInputRef} type="file" accept="video/*"
                  style={{ display: "none" }} onChange={handleVideoSelect} />

                {/* 저장된 비디오 */}
                {videos.length > 0 && (
                  <Box
                    display="grid"
                    gridTemplateColumns="repeat(auto-fill, minmax(160px, 1fr))"
                    gap={2}
                  >
                    {videos.map((video) => (
                      <Box key={video.pk} borderRadius="md" overflow="hidden"
                        border="1px solid" borderColor={borderColor} bg={videoFallbackBg}>
                        <Box position="relative">
                          {video.ThumbnailFile ? (
                            <Image src={video.ThumbnailFile} w="full" h="90px" objectFit="cover" />
                          ) : (
                            <Flex h="90px" align="center" justify="center" bg={videoFallbackBg}>
                              <Icon as={FaVideo} color="gray.400" boxSize={6} />
                            </Flex>
                          )}
                          <IconButton aria-label="delete" icon={<Icon as={FaTrash} />}
                            size="xs" colorScheme="red" position="absolute" top={1} right={1}
                            onClick={() => handleDeleteVideo(video.pk)} />
                        </Box>
                        <Text fontSize="xs" color={textMuted} px={2} py={1} noOfLines={1}>
                          {video.description || "video"}
                        </Text>
                      </Box>
                    ))}
                  </Box>
                )}
              </>
            )}
          </Box>
        </Box>

        {/* 오른쪽: 메타데이터 사이드바 */}
        <Box
          w={{ base: "full", xl: "300px" }}
          flexShrink={0}
          bg={sidebarBg}
          borderWidth="1px"
          borderColor={borderColor}
          borderRadius="xl"
          p={4}
          position={{ xl: "sticky" }}
          top={{ xl: "80px" }}
        >
          <VStack align="stretch" spacing={4}>
            {/* 카테고리 */}
            <FormControl>
              <FormLabel fontSize="sm" fontWeight="semibold">{t("kaizen.editorCategory")}</FormLabel>
              <Select size="sm" value={category} onChange={(e) => setCategory(e.target.value as KaizenCategory)} borderRadius="md">
                <option value="process">{t("kaizen.categoryProcess")}</option>
                <option value="quality">{t("kaizen.categoryQuality")}</option>
                <option value="safety">{t("kaizen.categorySafety")}</option>
                <option value="equipment">{t("kaizen.categoryEquipment")}</option>
                <option value="other">{t("kaizen.categoryOther")}</option>
              </Select>
            </FormControl>

            <Divider />

            {/* Style No */}
            <FormControl>
              <FormLabel fontSize="sm" fontWeight="semibold">
                Style No <Text as="span" color="gray.400" fontWeight="normal">(선택)</Text>
              </FormLabel>
              <SearchSelect<ISjStyle>
                selected={selectedStyle}
                onSelect={(s) => { setSelectedStyle(s); setSelectedSjNo(null); }}
                onClear={() => { setSelectedStyle(null); setSelectedSjNo(null); }}
                options={(styleResults?.results ?? []) as ISjStyle[]}
                isLoading={styleFetching}
                placeholder="코드 또는 이름 검색..."
                onQueryChange={setStyleQuery}
                renderLabel={(s) => `${s.code} — ${s.style_name}`}
                renderOption={(s) => (
                  <VStack align="start" spacing={0}>
                    <Text fontWeight="semibold">{s.code}</Text>
                    <Text fontSize="xs" color="gray.500">{s.style_name}</Text>
                  </VStack>
                )}
              />
            </FormControl>

            {/* SJ No (Style 선택 후 활성) */}
            <FormControl>
              <FormLabel fontSize="sm" fontWeight="semibold">
                SJ No <Text as="span" color="gray.400" fontWeight="normal">(선택)</Text>
              </FormLabel>
              <SearchSelect<ISjNo>
                selected={selectedSjNo}
                onSelect={setSelectedSjNo}
                onClear={() => setSelectedSjNo(null)}
                options={(sjNoResults?.results ?? []) as ISjNo[]}
                isLoading={sjNoFetching}
                placeholder="SJ No 검색..."
                onQueryChange={setSjNoQuery}
                renderLabel={(n) => `${n.sj_no}${n.sj_style_code ? ` (${n.sj_style_code})` : ""}`}
                renderOption={(n) => (
                  <VStack align="start" spacing={0}>
                    <Text fontWeight="semibold">{n.sj_no}</Text>
                    {n.sj_style_code && <Text fontSize="xs" color="gray.500">{n.sj_style_code}</Text>}
                  </VStack>
                )}
              />
            </FormControl>

            <Divider />

            {/* 생산공장 */}
            <FormControl>
              <FormLabel fontSize="sm" fontWeight="semibold">
                생산공장 <Text as="span" color="gray.400" fontWeight="normal">(선택)</Text>
              </FormLabel>
              <SearchSelect<{ pk: number; name: string }>
                selected={selectedFactory}
                onSelect={(f) => { setSelectedFactory(f); setSelectedLine(null); }}
                onClear={() => { setSelectedFactory(null); setSelectedLine(null); }}
                options={factories()}
                placeholder="공장 선택..."
                onQueryChange={() => {}}
                renderLabel={(f) => f.name}
              />
            </FormControl>

            {/* 공장 라인 */}
            <FormControl>
              <FormLabel fontSize="sm" fontWeight="semibold">
                공장 라인 <Text as="span" color="gray.400" fontWeight="normal">(선택)</Text>
              </FormLabel>
              <SearchSelect<IProductionLine>
                selected={selectedLine}
                onSelect={setSelectedLine}
                onClear={() => setSelectedLine(null)}
                options={filteredLines}
                placeholder={selectedFactory ? "라인 선택..." : "공장을 먼저 선택하세요"}
                onQueryChange={() => {}}
                renderLabel={(l) => `${l.name} (${l.factory_name})`}
              />
            </FormControl>

            <Divider />

            {/* 모듈 */}
            <FormControl>
              <FormLabel fontSize="sm" fontWeight="semibold">
                모듈 <Text as="span" color="gray.400" fontWeight="normal">(선택)</Text>
              </FormLabel>
              <SearchSelect<IModule>
                selected={selectedModule}
                onSelect={(m) => { setSelectedModule(m); setSelectedProcess(null); }}
                onClear={() => { setSelectedModule(null); setSelectedProcess(null); }}
                options={(moduleResults?.results ?? []) as IModule[]}
                isLoading={moduleFetching}
                placeholder="모듈 코드 또는 이름 검색..."
                onQueryChange={setModuleQuery}
                renderLabel={(m) => `${m.code}${m.name ? ` — ${m.name}` : ""}`}
                renderOption={(m) => (
                  <VStack align="start" spacing={0}>
                    <Text fontWeight="semibold">{m.code}</Text>
                    {m.name && <Text fontSize="xs" color="gray.500">{m.name}</Text>}
                  </VStack>
                )}
              />
            </FormControl>

            {/* 공정 (모듈 선택 후 활성) */}
            <FormControl>
              <FormLabel fontSize="sm" fontWeight="semibold">
                공정 <Text as="span" color="gray.400" fontWeight="normal">(선택)</Text>
              </FormLabel>
              <SearchSelect<IProcess>
                selected={selectedProcess}
                onSelect={setSelectedProcess}
                onClear={() => setSelectedProcess(null)}
                options={(processResults?.results ?? []) as IProcess[]}
                isLoading={processFetching}
                placeholder="공정 코드 또는 이름 검색..."
                onQueryChange={setProcessQuery}
                renderLabel={(p) => `${p.code} — ${p.name_ko || p.name}`}
                renderOption={(p) => (
                  <VStack align="start" spacing={0}>
                    <Text fontWeight="semibold">{p.code}</Text>
                    <Text fontSize="xs" color="gray.500">{p.name_ko || p.name}</Text>
                  </VStack>
                )}
              />
            </FormControl>

            <Divider />

            {/* 발행 상태 */}
            <HStack justify="space-between">
              <Text fontSize="sm" fontWeight="semibold">{t("kaizen.publishToggle")}</Text>
              <Switch colorScheme="green" isChecked={isPublished} onChange={(e) => setIsPublished(e.target.checked)} />
            </HStack>
            <Badge colorScheme={isPublished ? "green" : "yellow"} borderRadius="full" px={3} py={1} textAlign="center">
              {isPublished ? t("kaizen.published") : t("kaizen.draft")}
            </Badge>
          </VStack>
        </Box>
      </Flex>
    </Box>
  );
}
