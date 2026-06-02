import { useState } from "react";
import {
  Flex,
  Image,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalHeader,
  ModalOverlay,
  Button,
  HStack,
  IconButton
} from "@chakra-ui/react";
import { FaMinus, FaPlus } from "react-icons/fa";

export default function PhotoModal({ isOpen, onClose, selectedImage }: any) {
  const [scale, setScale] = useState(1);

  const zoomIn = () => {
    setScale((prevScale) => prevScale + 0.1);
  };

  const zoomOut = () => {
    setScale((prevScale) => Math.max(prevScale - 0.1, 0.1));
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="xl">
      <ModalOverlay>
        <ModalContent>
          <ModalHeader></ModalHeader>
          <ModalCloseButton />
          <ModalBody maxHeight={"120vh"} overflow={"auto"} pb={"6"}>
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
            </HStack>
            <Flex
              justifyContent={"center"}
              alignItems={"center"}
              height={"100%"}
            >
              <Image
                src={selectedImage}
                alt="Room Image"
                maxWidth={`${100 * scale}%`}
                maxHeight={`${80 * scale}vh`}
                objectFit={"contain"}
              />
            </Flex>
          </ModalBody>
        </ModalContent>
      </ModalOverlay>
    </Modal>
  );
}
