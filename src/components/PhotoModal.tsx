import { useEffect, useMemo, useState } from "react";
import {
  Flex,
  Image,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalHeader,
  ModalOverlay,
  IconButton,
  HStack,
  Text,
  Box
} from "@chakra-ui/react";
import { useQuery } from "@tanstack/react-query";
import { FaMinus, FaPlus, FaChevronLeft, FaChevronRight } from "react-icons/fa";
import { getSjStylePhotos } from "../api";
import { resolveMediaUrl } from "../lib/resolveMediaUrl";

export interface PhotoModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** 단일 이미지 URL (기존 호환) */
  selectedImage?: string;
  /** SJ Style PK — 있으면 스타일 사진 API로 여러 장을 불러와 넘겨볼 수 있음 */
  sjStylePk?: number | null;
  /** API 없이 URL 목록만 넘길 때 */
  images?: string[];
}

export default function PhotoModal({
  isOpen,
  onClose,
  selectedImage,
  sjStylePk,
  images: imagesProp
}: PhotoModalProps) {
  const [scale, setScale] = useState(1);
  const [index, setIndex] = useState(0);

  const { data: stylePhotos = [] } = useQuery({
    queryKey: ["sjStylePhotos", sjStylePk],
    queryFn: () => getSjStylePhotos(sjStylePk!),
    enabled: isOpen && sjStylePk != null && sjStylePk > 0
  });

  const urls = useMemo(() => {
    const toAbs = (u: string) => resolveMediaUrl(u);
    if (imagesProp && imagesProp.length > 0) {
      return imagesProp.map(toAbs).filter(Boolean);
    }
    if (sjStylePk != null && sjStylePk > 0 && stylePhotos.length > 0) {
      return stylePhotos.map((p) => toAbs(p.file)).filter(Boolean);
    }
    if (selectedImage) return [toAbs(selectedImage)].filter(Boolean);
    return [];
  }, [imagesProp, sjStylePk, stylePhotos, selectedImage]);

  const urlsKey = urls.join("|");

  useEffect(() => {
    if (!isOpen || urls.length === 0) return;
    const i = selectedImage
      ? urls.findIndex((u) => u === selectedImage)
      : 0;
    setIndex(i >= 0 ? i : 0);
  }, [isOpen, urlsKey, selectedImage]);

  useEffect(() => {
    setScale(1);
  }, [index]);

  useEffect(() => {
    if (!isOpen) setIndex(0);
  }, [isOpen]);

  const zoomIn = () => setScale((s) => s + 0.1);
  const zoomOut = () => setScale((s) => Math.max(s - 0.1, 0.1));

  const current = urls[index] ?? "";
  const showGalleryNav = urls.length > 1;

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="xl" isCentered>
      <ModalOverlay />
      <ModalContent maxH="95vh">
        <ModalHeader />
        <ModalCloseButton />
        <ModalBody maxHeight="120vh" overflow="auto" pb={6}>
          <HStack spacing={4} mb={4}>
            <IconButton
              aria-label="Zoom In"
              icon={<FaPlus />}
              onClick={zoomIn}
            />
            <IconButton
              aria-label="Zoom Out"
              icon={<FaMinus />}
              onClick={zoomOut}
            />
            {showGalleryNav && (
              <Text fontSize="sm" color="gray.600" fontWeight="medium">
                {index + 1} / {urls.length}
              </Text>
            )}
          </HStack>
          <Box position="relative">
            <Flex justifyContent="center" alignItems="center" minH="200px">
              {current ? (
                <Image
                  src={current}
                  alt=""
                  maxWidth={`${100 * scale}%`}
                  maxHeight={`${80 * scale}vh`}
                  objectFit="contain"
                />
              ) : (
                <Text color="gray.400">No image</Text>
              )}
            </Flex>
            {showGalleryNav && current && (
              <>
                <IconButton
                  aria-label="Previous photo"
                  icon={<FaChevronLeft />}
                  position="absolute"
                  left={2}
                  top="50%"
                  transform="translateY(-50%)"
                  zIndex={2}
                  bg="blackAlpha.600"
                  color="white"
                  _hover={{ bg: "blackAlpha.700" }}
                  variant="solid"
                  isRound
                  size="md"
                  isDisabled={index <= 0}
                  onClick={(e) => {
                    e.stopPropagation();
                    setIndex((i) => (i > 0 ? i - 1 : i));
                  }}
                />
                <IconButton
                  aria-label="Next photo"
                  icon={<FaChevronRight />}
                  position="absolute"
                  right={2}
                  top="50%"
                  transform="translateY(-50%)"
                  zIndex={2}
                  bg="blackAlpha.600"
                  color="white"
                  _hover={{ bg: "blackAlpha.700" }}
                  variant="solid"
                  isRound
                  size="md"
                  isDisabled={index >= urls.length - 1}
                  onClick={(e) => {
                    e.stopPropagation();
                    setIndex((i) => (i < urls.length - 1 ? i + 1 : i));
                  }}
                />
              </>
            )}
          </Box>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}
