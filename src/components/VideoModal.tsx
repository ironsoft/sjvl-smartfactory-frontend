import React from "react";
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
  Box,
  AspectRatio
} from "@chakra-ui/react";
import {
  resolveMediaUrl,
  isDirectVideoFileUrl
} from "../lib/resolveMediaUrl";

type VideoModalProps = {
  isOpen: boolean;
  onClose: () => void;
  selectedVideo?: string | null;
};

export default function VideoModal({
  isOpen,
  onClose,
  selectedVideo
}: VideoModalProps) {
  const src = selectedVideo ? resolveMediaUrl(selectedVideo) : "";
  const useNativeVideo = src ? isDirectVideoFileUrl(src) : false;

  return (
    <Modal isOpen={isOpen} onClose={onClose} isCentered size="4xl">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>비디오 재생</ModalHeader>
        <ModalCloseButton />
        <ModalBody pb={6}>
          {src ? (
            useNativeVideo ? (
              <video
                key={src}
                src={src}
                controls
                playsInline
                style={{ width: "100%", maxHeight: "70vh" }}
              />
            ) : (
              <AspectRatio ratio={16 / 10}>
                <Box
                  as="iframe"
                  key={src}
                  src={src}
                  title="Video"
                  allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;"
                  allowFullScreen
                  border="none"
                />
              </AspectRatio>
            )
          ) : null}
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}
