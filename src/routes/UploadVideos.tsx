import { Box, Button, Container, FormControl, Heading, Input, VStack, useToast } from "@chakra-ui/react";
import HostOnlyPage from "../components/HostOnlyPage";
import ProtectedPage from "../components/ProtectPage";
import { useForm } from "react-hook-form";
import { useParams } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { createVideo, getUploadVideoURL, getVideoData, uploadVideo } from "../api";
import { useState } from "react";

interface IForm {
    file: FileList;
}

interface IUploadVideoURLResponse {
    id: string;
    uploadURL: string;  
}

export default function UploadVideos() {
    const { roomPk } = useParams();
    const {register, handleSubmit, watch, reset} = useForm<IForm>();
    
    // 업로드한 비디오 UID 저장
    const [videoUid, setVideoUid] = useState<string>("");

    const toast = useToast();

    // 비디오를 서버 DB에 저장하기 위한 Mutation
    const createVideoMutation = useMutation({
        mutationFn: createVideo,
        onSuccess: () => {
            toast({
                status: "success",
                isClosable: true,
                description: "비디오가 성공적으로 업로드 되었습니다."
            });
            reset();
        }
    });

    // 비디오 데이터를 받아옵니다.
    const getVideoDataMutation = useMutation({
        mutationFn: getVideoData,
        onSuccess: (data: any) => {
            console.log("비디오 데이터", data);
            const thumbnailURL = data.thumbnail;
            const videoURL = `https://customer-u4d1gjshe6uaaa9n.cloudflarestream.com/${data.uid}/iframe?muted=true&preload=true&loop=true&autoplay=true&poster=https%3A%2F%2Fcustomer-u4d1gjshe6uaaa9n.cloudflarestream.com%2F${data.uid}%2Fthumbnails%2Fthumbnail.jpg%3Ftime%3D%26height%3D600`

            if (roomPk) { // Check if roomPk is not undefined
                createVideoMutation.mutate({
                    roomPk: roomPk,
                    VideoFile: videoURL,
                    ThumbnailFile: thumbnailURL
                });
            }
        }
    });


    // 받아온 URL을 비디오 File과 함께 Cloudflare로 보내면 Cloudflare가 비디오를 저장합니다.
    const uploadVideoMutation = useMutation({
        mutationFn: uploadVideo,
        onSuccess: (data: any) => {
            console.log("cloudflare에 업로드 되었습니다");
            // 업로드한 비디오 데이터를 받아옵니다.
            getVideoDataMutation.mutate(videoUid);
        }
    });

    // Cloudflare로 부터 비디오를 업로드할 수 있는 URL을 받아옵니다.
    const uploadURLmutation = useMutation({
        mutationFn: getUploadVideoURL,
        onSuccess: (data: IUploadVideoURLResponse) => {
            // 받아온 URL을 이용하여 비디오를 클라우드플레어에 업로드합니다.
            uploadVideoMutation.mutate({
                file: watch("file"),
                uploadURL: data.uploadURL
            });
            // 비디오 UID를 videoUid로 저장
            setVideoUid(data.id);
            
        }
    });

    
    const onSubmit = (data: any) => {
        uploadURLmutation.mutate()
    }


   return (
       <ProtectedPage>
        <HostOnlyPage>
            <Box 
                pb={40}
                mt={10}
                px={{
                base: 10,
                lg: 40
                }}
            >
                <Container>
                    <Heading>Upload a Video</Heading>
                    <VStack
                        as="form"
                        onSubmit={handleSubmit(onSubmit)}
                        spacing={4}
                        mt={10}
                    >
                        <FormControl>
                            <Input {...register("file")} type="file" accept="video/*" />
                        </FormControl>
                        <Button 
                        isLoading={uploadURLmutation.isPending || uploadVideoMutation.isPending || getVideoDataMutation.isPending || createVideoMutation.isPending}
                        type="submit" w={"full"} colorScheme="teal">Upload</Button>
                    </VStack>
                </Container>
            </Box>
        </HostOnlyPage>
       </ProtectedPage>
     ); 
}