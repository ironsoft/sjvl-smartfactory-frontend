import React from 'react';
import {
    Modal,
    ModalOverlay,
    ModalContent,
    ModalHeader,
    ModalBody,
    ModalCloseButton,
    Box,
    AspectRatio
} from '@chakra-ui/react';

export default function VideoModal({ isOpen, onClose, selectedVideo }: any) {
        console.log(selectedVideo);
    return (
        <Modal isOpen={isOpen} onClose={onClose} isCentered size="4xl">
            <ModalOverlay />
            <ModalContent>
                <ModalHeader>비디오 재생</ModalHeader>
                <ModalCloseButton />
                <ModalBody >
                    <AspectRatio ratio={4 / 3}>
                        <Box 
                            as="iframe"
                            src={selectedVideo}
                            allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;"
                            allowFullScreen={true}
                            border="none"
                            position="absolute"
                            top="0"
                            left="0"
                            height="100%"
                            width="100%"
                            />
                    </AspectRatio>
                </ModalBody>
            </ModalContent>
        </Modal>
    );
}