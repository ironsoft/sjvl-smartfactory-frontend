import { QueryFunctionContext } from "@tanstack/react-query";
import axios from "axios";
import Cookies from "js-cookie";
import { formatDate } from "./lib/utils";
// import Cookies from "js-cookie";
import {
  IBlog,
  IBlogForm,
  IBlogListResponse,
  IBookingDetail,
  IBookingList,
  IData,
  IEnglish,
  IReviewResponse,
  IRoomDetail,
  IRoomList,
  ITerm,
  ITermListResponse,
  ITranslateVariables,
  IUser,
  ISjKaizenPost,
  ISjKaizenListResponse,
  ISjKaizenPostForm,
  ISjKaizenMedia,
  IKaizenPhoto,
  IKaizenVideo,
  ICloudflareImageUploadResult,
  ICloudflareVideoUploadResult,
} from "./types";

/** 개발 시 브라우저 호스트와 API 호스트를 맞춤 (localhost vs 127.0.0.1 혼용 시 쿠키/CSRF 꼬임 방지) */
function getApiBaseURL(): string {
  if (process.env.NODE_ENV === "development") {
    if (typeof window !== "undefined" && window.location?.hostname) {
      return `http://${window.location.hostname}:8000/api/v1/`;
    }
    return "http://127.0.0.1:8000/api/v1/";
  }
  return "https://backend.sjinnovation.space/api/v1/";
}

// axios 인스턴스 생성
const instance = axios.create({
  baseURL: getApiBaseURL(),
  withCredentials: true
});

// 개발: 최초 번들 로드 시점에 window가 없으면 baseURL이 127.0.0.1로 고정될 수 있고,
// 이후 브라우저에서 localhost로 열면 로그인 쿠키 호스트와 API 호스트가 달라져 /users/me 가 403이 될 수 있음.
// 로그인 후 localStorage에 JWT 저장 → iOS Safari 크로스 사이트 쿠키 차단 우회
instance.interceptors.request.use((config) => {
  if (process.env.NODE_ENV === "development") {
    config.baseURL = getApiBaseURL();
  }
  const token = localStorage.getItem("jwt");
  if (token) {
    config.headers = config.headers || {};
    config.headers["jwt"] = token;
  }
  return config;
});

// 룸 리스트 가져오기
export const getRooms = async ({
  queryKey
}: QueryFunctionContext): Promise<IRoomList[]> => {
  // queryKey로부터 currentPage, searchQuery, selectedCategory를 가져온다.
  const [_, currentPage, searchQuery, selectedCategory] = queryKey;
  const currentPageString = currentPage ? `page=${currentPage}` : "";

  // 검색어가 있으면, 검색어를 쿼리스트링으로 만들어준다.
  const queryString = searchQuery ? `&search=${searchQuery}` : "";
  // 카테고리가 있으면, 카테고리를 쿼리스트링으로 만들어준다.
  const categoryString = selectedCategory
    ? `&category=${selectedCategory}`
    : "";
  try {
    const response = await instance.get(
      `rooms?${currentPageString}${queryString}${categoryString}`
    );
    return response.data as IRoomList[];
  } catch (error) {
    throw new Error("Failed to fetch room details");
  }
};

// 룸 디테일 데이터 가져오기
export const getRoom = async ({
  queryKey
}: QueryFunctionContext): Promise<IRoomDetail> => {
  const [_, roomPk] = queryKey;
  try {
    const response = await instance.get(`rooms/${roomPk}`);
    return response.data as IRoomDetail;
  } catch (error) {
    throw new Error("Failed to fetch room details");
  }
};

// 룸 리뷰 가져오기
export const getRoomReviews = async ({
  queryKey
}: QueryFunctionContext): Promise<IReviewResponse> => {
  const [_, roomPk, __, currentPage] = queryKey;
  try {
    const response = await instance.get(
      `rooms/${roomPk}/reviews?page=${currentPage}`
    );
    return response.data as IReviewResponse;
  } catch (error) {
    throw new Error("Failed to fetch review details.");
  }
};

interface ICreateReviewVariables {
  roomPk: string;
  payload: string;
  rating: number;
}

// 리뷰 작성 API
export const createReview = (variables: ICreateReviewVariables) =>
  instance
    .post(`rooms/${variables.roomPk}/reviews`, variables, {
      headers: {
        "X-CSRFToken": Cookies.get("csrftoken") || ""
      }
    })
    .then((response) => response.data);

interface IEditReviewVariables {
  reviewId: number;
  payload: string;
  rating: number;
  roomPk: string; // 이 줄을 추가
}

// 리뷰 편집 API
export const editReview = (variables: IEditReviewVariables) =>
  instance
    .put(`rooms/${variables.roomPk}/reviews/${variables.reviewId}`, variables, {
      headers: {
        "X-CSRFToken": Cookies.get("csrftoken") || ""
      }
    })
    .then((response) => response.data);

// 리뷰 삭제 API
export const deleteReview = (reviewId: number, roomPk: string) =>
  instance
    .delete(`rooms/${roomPk}/reviews/${reviewId}`, {
      headers: {
        "X-CSRFToken": Cookies.get("csrftoken") || ""
      }
    })
    .then((response) => response.data);

// 내 정보 가져오기
export const getMe = () =>
  instance.get(`users/me`).then((response) => response.data);

export interface IEditProfileVariables {
  name: string;
  email: string;
  avatar: string;
  password: string;
  username: string;
}

// user 정보 가져오기
export const getUserInformation = async ({
  queryKey
}: QueryFunctionContext): Promise<IUser> => {
  const [_, userId] = queryKey;
  console.log(userId);
  try {
    const response = await instance.get(`users/${userId}`);
    return response.data as IUser;
  } catch (error) {
    throw new Error("Failed to fetch room details");
  }
};

// users 리스트 가져오기
export const getUsers = async ({
  queryKey
}: QueryFunctionContext): Promise<IData> => {
  const [_, currentPage, searchQuery] = queryKey;
  console.log(currentPage);
  const queryString = searchQuery ? `&search=${searchQuery}` : "";
  try {
    const response = await instance.get(
      `users?page=${currentPage}${queryString}`
    );
    return response.data as IData;
  } catch (error) {
    throw new Error("Failed to fetch room details");
  }
};

// 내 정보 수정
export const editProfile = (variables: IEditProfileVariables) =>
  instance
    .put(`users/me`, variables, {
      headers: { "X-CSRFToken": Cookies.get("csrftoken") || "" }
    })
    .then((response) => response.data);

export interface IChangePasswordVariables {
  oldPassword: string;
  newPassword: string;
}

// 비밀번호 변경
export const changePassword = (variables: IChangePasswordVariables) =>
  instance
    .put(`users/change-password`, variables, {
      headers: { "X-CSRFToken": Cookies.get("csrftoken") || "" }
    })
    .then((response) => response.data);

// 로그아웃
export const logOut = () =>
  instance
    .post(`users/log-out`, null, {
      headers: {
        "X-CSRFToken": Cookies.get("csrftoken") || ""
      }
    })
    .then((response) => response.data);

// github 로그인
export const githubLogin = (code: string) =>
  instance
    .post(
      `/users/github`,
      { code },
      {
        headers: {
          "X-CSRFToken": Cookies.get("csrftoken") || ""
        }
      }
    )
    .then((response) => response.data);

// Kakao 로그인
export const KakaoLogin = (code: string) =>
  instance
    .post(
      `/users/kakao`,
      { code },
      {
        headers: {
          "X-CSRFToken": Cookies.get("csrftoken") || ""
        }
      }
    )
    .then((response) => response.data);

export interface IUsernameLoginVariables {
  username: string;
  password: string;
}

export interface IUsernameLoginSuccess {
  ok: string;
}

export interface IUsernameLoginError {
  error: string;
}

// 아이디/비번 로그인
export const usernameLogin = async ({
  username,
  password
}: IUsernameLoginVariables) => {
  try {
    const response = await instance.post(
      `/users/log-in`,
      { username, password },
      {
        headers: {
          "X-CSRFToken": Cookies.get("csrftoken") || ""
        }
      }
    );
    return response.data;
  } catch (error) {
    console.error(error);
    throw error;
  }
};

export interface IUserSignupVariables {
  name: string;
  username: string;
  email: string;
  password: string;
  password2: string;
}

export interface IUserSignupSuccess {
  ok: string;
}

export interface IUserSignupError {
  error: string;
}

// 회원가입
export const userSignup = ({
  name,
  username,
  email,
  password,
  password2
}: IUserSignupVariables) =>
  instance
    .post(
      `/users/sign-up`,
      { name, username, email, password, password2 },
      {
        headers: {
          "X-CSRFToken": Cookies.get("csrftoken") || ""
        }
      }
    )
    .then((response) => response.data);

// 방 아메니티 가져오기 API
export const getAmenities = () =>
  instance.get(`rooms/amenities`).then((response) => response.data);

// 방 카테고리 가져오기 API
export const getRoomCategories = () =>
  instance.get(`categories/rooms`).then((response) => response.data);

export interface IUploadRoomVariables {
  name: string;
  country: string;
  city: string;
  price: number;
  rooms: number;
  toilets: number;
  description: string;
  address: string;
  pet_friendly: boolean;
  kind: string;
  amenities: number[];
  category: number[];
  manager: string;
}

// 방 업로드 API
export const uploadRoom = (variables: IUploadRoomVariables) =>
  instance
    .post(`rooms/`, variables, {
      headers: {
        "X-CSRFToken": Cookies.get("csrftoken") || ""
      }
    })
    .then((response) => response.data);

// 방 비디오 업로드 URL 가져오기 API
export const getUploadVideoURL = () =>
  instance
    .post(`medias/videos/get-url`, null, {
      headers: {
        "X-CSRFToken": Cookies.get("csrftoken") || ""
      }
    })
    .then((response) => response.data);

// 클라우드플레어 이미지 업로드 URL 가져오기 API
export const getUploadURL = () =>
  instance
    .post(`medias/photos/get-url`, null, {
      headers: {
        "X-CSRFToken": Cookies.get("csrftoken") || ""
      }
    })
    .then((response) => response.data);

export interface IUploadVideoVariables {
  file: FileList;
  uploadURL: string;
}

// 클라우드플레어에 비디오 업로드 후 비디오 데이터 가져오기 API
export const getVideoData = (UID: string) => {
  console.log("uid", UID);
  return instance
    .post(
      `medias/videos/data`,
      { uid: UID },
      {
        headers: {
          "X-CSRFToken": Cookies.get("csrftoken") || ""
        }
      }
    )
    .then((response) => {
      console.log("Upload response:", response.data); // Check the response
      return response.data;
    })
    .catch((error) => {
      console.error("Upload error:", error); // Catch and log any error
    });
};




// 클라우드플레어 비디오 업로드 API
export const uploadVideo = async ({
  file,
  uploadURL
}: IUploadVideoVariables) => {
  // 자바스크립트 폼 만들기
  const form = new FormData();
  form.append("file", file[0]); // key, value 쌍으로 form 데이터 추가

  // 파일 크기가 200MB를 초과하는 경우 에러 처리
  if (file[0].size > 200 * 1024 * 1024) {
    console.error("File size exceeds the 200MB limit.");
    return;
  }

  try {
    const response = await axios.post(uploadURL, form, {
      headers: {
        "Content-Type": "multipart/form-data"
      }
    });

    // 업로드가 성공적으로 이루어진 경우 200 상태 코드를 반환
    if (response.status === 200) {
      console.log("Response", response);
      console.log("Upload successful:", response.data);
      return response.data;
    } else {
      // 업로드 제약 조건을 충족하지 못하거나 파일 크기가 200MB를 초과하는 경우 4xx 상태 코드를 반환
      console.error("Upload failed with status:", response.status);
    }
  } catch (error) {
    console.error("Upload error:", error); // Catch and log any error
    throw error; // Re-throw the error to be caught by the calling function
  }
};

export interface IUploadImageVariables {
  file: FileList;
  uploadURL: string;
}

// 클라우드플레어 이미지 업로드 API
export const uploadImage = ({ file, uploadURL }: IUploadImageVariables) => {
  // 자바스크립트 폼 만들기
  const form = new FormData();
  form.append("file", file[0]); // key, value 쌍으로 form 데이터 추가
  return axios
    .post(uploadURL, form, {
      headers: {
        "Content-Type": "multipart/form-data"
      }
    })
    .then((response) => {
      console.log("Upload response:", response.data); // Check the response
      return response.data;
    })
    .catch((error) => {
      console.error("Upload error:", error); // Catch and log any error
    });
};



export interface ICreateVideoVariables {
  VideoFile: string;
  ThumbnailFile: string;
  roomPk: string;
}

// 방 비디오 서버 DB에 저장 API
export const createVideo = ({
  VideoFile,
  ThumbnailFile,
  roomPk
}: ICreateVideoVariables) =>
  instance
    .post(
      `rooms/${roomPk}/videos`,
      { VideoFile, ThumbnailFile },
      {
        headers: {
          "X-CSRFToken": Cookies.get("csrftoken") || ""
        }
      }
    )
    .then((response) => response.data);

export interface ICreatePostVideoVariables {
  VideoFile: string;
  ThumbnailFile: string;
  blogId: string;
  description: string;
}

// 블로 포스트 비디오 서버 DB에 저장 API
export const createPostVideo = ({
  VideoFile,
  ThumbnailFile,
  blogId,
  description
}: ICreatePostVideoVariables) =>
  instance
    .post(
      `blogs/${blogId}/videos`,
      { VideoFile, ThumbnailFile, description },
      {
        headers: {
          "X-CSRFToken": Cookies.get("csrftoken") || ""
        }
      }
    )
    .then((response) => response.data);


export interface ICreatePhotoVariables {
  description: string;
  file: string;
  roomPk: string;
}

// 사진 업로드 API

export const createPhoto = ({
  description,
  file,
  roomPk
}: ICreatePhotoVariables) =>
  instance
    .post(
      `rooms/${roomPk}/photos`,
      { description, file },
      {
        headers: {
          "X-CSRFToken": Cookies.get("csrftoken") || ""
        }
      }
    )
    .then((response) => response.data);

interface ICreatePhotoTermVariables {
  description: string;
  file: string;
  termId: string;
}

export const createTermPhoto = ({
  description,
  file,
  termId
}: ICreatePhotoTermVariables) =>
  instance
    .post(
      `bagterms/${termId}/photos`,
      { description, file },
      {
        headers: {
          "X-CSRFToken": Cookies.get("csrftoken") || ""
        }
      }
    )
    .then((response) => response.data);

interface ICreatePostPhotoVariables {
  description: string;
  file: string;
  blogId: string;
}

export const createPostPhoto = ({
  description,
  file,
  blogId
}: ICreatePostPhotoVariables) =>
  instance
    .post(
      `blogs/${blogId}/photos`,
      { description, file },
      {
        headers: {
          "X-CSRFToken": Cookies.get("csrftoken") || ""
        }
      }
    )
    .then((response) => response.data);

type checkBookingQueryKey = [string, string?, Date[]?];

// 방 예약 가능 여부 확인 API
export const checkBooking = ({
  queryKey
}: QueryFunctionContext<checkBookingQueryKey>) => {
  const [_, roomPk, dates] = queryKey;
  if (dates) {
    const [firstDate, secondDate] = dates;
    const checkIn = formatDate(firstDate);
    console.log(checkIn, firstDate);
    const checkOut = formatDate(secondDate);
    return instance
      .get(
        `rooms/${roomPk}/bookings/check?check_in=${checkIn}&check_out=${checkOut}`
      )
      .then((response) => response.data);
  }
};

export interface IRoomBookingVariables {
  roomPk: string;
  check_in: string;
  check_out: string;
  guests: number;
  kind: string;
}

export interface IRoomBookingSuccess {
  check_in: string;
  check_out: string;
}

// 방 예약 API
export const roomBooking = (variables: IRoomBookingVariables) =>
  instance
    .post(`rooms/${variables.roomPk}/bookings`, variables, {
      headers: {
        "X-CSRFToken": Cookies.get("csrftoken") || ""
      }
    })
    .then((response) => response.data);

// 방 수정 변수
export interface IEditRoomVariables {
  roomPk: string;
  name: string;
  country: string;
  city: string;
  price: number;
  rooms: number;
  toilets: number;
  description: string;
  address: string;
  pet_friendly: boolean;
  kind: string;
  amenities: number[];
  category: number;
}

// 방 수정 API
export const editRoom = (variables: IEditRoomVariables) =>
  instance
    .put(`rooms/${variables.roomPk}`, variables, {
      headers: {
        "X-CSRFToken": Cookies.get("csrftoken") || ""
      }
    })
    .then((response) => response.data);

// 방 삭제 API
export const deleteRoom = (roomPk: string) =>
  instance
    .delete(`rooms/${roomPk}`, {
      headers: {
        "X-CSRFToken": Cookies.get("csrftoken") || ""
      }
    })
    .then((response) => response.data);

// 사용자 예약 가져오기 API
export const getUserBookings = async ({
  queryKey // queryKey: [string, string?, Date[]?]
}: QueryFunctionContext): Promise<IBookingList> => {
  const [_, currentPage] = queryKey;
  try {
    const response = await instance.get(`users/bookings?page=${currentPage}`);
    return response.data as IBookingList;
  } catch (error) {
    throw new Error("Failed to fetch booking details");
  }
};

// 예약 삭제 API
export const removeBooking = (bookingId: number) =>
  instance
    .delete(`bookings/${bookingId}`, {
      headers: {
        "X-CSRFToken": Cookies.get("csrftoken") || ""
      }
    })
    .then((response) => response.data);

// 예약 가져오기 API
export const getBooking = async ({
  queryKey
}: QueryFunctionContext): Promise<IBookingDetail> => {
  const [_, bookingId] = queryKey;
  try {
    const response = await instance.get(`bookings/${bookingId}`);
    return response.data as IBookingDetail;
  } catch (error) {
    throw new Error("Failed to fetch booking details");
  }
};

// 예약 수정 API
export const editBooking = (variables: IBookingDetail) =>
  instance
    .put(`bookings/${variables.pk}`, variables, {
      headers: {
        "X-CSRFToken": Cookies.get("csrftoken") || ""
      }
    })
    .then((response) => response.data);

export interface IFilePhotos {
  pk: string;
  name: string;
  type: string;
  file: string;
  description?: string;
  sjmedia?: number;
}

export interface ISjmediaStyleDetail {
  pk: number;
  code: string;
  style_name: string;
  bag_category?: string | null;
  buyer_brand?: string | null;
  body_material?: string | null;
  bag_type?: string | null;
}

export interface ISjmedia {
  pk: number;
  title: string;
  description?: string;
  sj_style?: number | null;
  sj_style_detail?: ISjmediaStyleDetail | null;
}

// 사진 가져오기 API
export const getRoomPhotos = async ({
  queryKey
}: QueryFunctionContext): Promise<IFilePhotos[]> => {
  const [_, roomPk] = queryKey;
  try {
    const response = await instance.get(`rooms/${roomPk}/photos`);
    return response.data as IFilePhotos[];
  } catch (error) {
    throw new Error("Failed to fetch room files");
  }
};

// Bagterm 사진 가져오기 API
export const getTermPhotos = async ({
  queryKey
}: QueryFunctionContext): Promise<IFilePhotos[]> => {
  const [_, termId] = queryKey;
  try {
    const response = await instance.get(`bagterms/${termId}/photos`);
    return response.data as IFilePhotos[];
  } catch (error) {
    throw new Error("Failed to fetch room files");
  }
};

// Blog Post 사진 가져오기 API
export const getPostPhotos = async ({
  queryKey
}: QueryFunctionContext): Promise<IFilePhotos[]> => {
  const [_, blogId] = queryKey;
  try {
    const response = await instance.get(`blogs/${blogId}/photos`);
    return response.data as IFilePhotos[];
  } catch (error) {
    throw new Error("Failed to fetch room files");
  }
}

export interface IFileVideos {
  VideoFile: string;
  ThumbnailFile: string;
  description: string;
  pk: string;
  sjmedia?: number;
}

// Post 비디오 가져오기 API
export const getPostVideo = ({
  queryKey
}: QueryFunctionContext): Promise<IFileVideos[]> => {
  const [_, blogId] = queryKey;
  return instance.get(`blogs/${blogId}/videos`).then((response) => response.data);
}

// 전체 사진 목록 가져오기 API
export const getPhotos = async (): Promise<IFilePhotos[]> => {
  const response = await instance.get(`medias/photos`);
  return response.data as IFilePhotos[];
};

// 전체 비디오 목록 가져오기 API
export const getVideos = async (): Promise<IFileVideos[]> => {
  const response = await instance.get(`medias/videos`);
  return response.data as IFileVideos[];
};

// 미디어 사진 생성 API (blogId 없이)
export const createMediaPhoto = (variables: { file: string; description: string }) =>
  instance
    .post(`medias/photos`, variables, {
      headers: { "X-CSRFToken": Cookies.get("csrftoken") || "" }
    })
    .then((res) => res.data);

// 미디어 비디오 생성 API (blogId 없이)
export const createMediaVideo = (variables: {
  VideoFile: string;
  ThumbnailFile: string;
  description: string;
}) =>
  instance
    .post(`medias/videos`, variables, {
      headers: { "X-CSRFToken": Cookies.get("csrftoken") || "" }
    })
    .then((res) => res.data);

// 사진 삭제 API
export const deletePhoto = (photoPk: string) =>
  instance
    .delete(`medias/photos/${photoPk}`, {
      headers: {
        "X-CSRFToken": Cookies.get("csrftoken") || ""
      }
    })
    .then((response) => response.data);

// 비디오 삭제 API
export const deleteVideo = (videoPk: string) =>
  instance
    .delete(`medias/videos/${videoPk}`, {
      headers: {
        "X-CSRFToken": Cookies.get("csrftoken") || ""
      }
    })
    .then((response) => response.data);

// 방 wishlist 추가 API
export const createWishlist = (roomPk: string) =>
  instance
    .post(
      `users/wishlists`,
      { rooms: [roomPk] }, // 배열로 넣어준다.
      {
        headers: {
          "X-CSRFToken": Cookies.get("csrftoken") || ""
        }
      }
    )
    .then((response) => {
      // 여기서는 response.data를 반환하지 않는다.
      return response;
    });

// 방 wishlist check API
export const checkWishlist = (roomPk: string) =>
  instance
    .get(`wishlists/rooms/check/${roomPk}`)
    .then((response) => response.data);

// user wishlist 가져오기 API
export const getUserWishlists = () =>
  instance.get(`users/wishlists`).then((response) => response.data);

// Bag English Terminologies 가져오기 API
export const getEnglishBagTerminologies = async () => {
  try {
    const response = await instance.get(`terminologies/english`);
    return response.data;
  } catch (error) {
    throw new Error("Failed to fetch bag terminologies");
  }
};

// Bag English Terminology Detail 가져오기 API
export const getEnglishBagTermDetail = async ({
  queryKey
}: QueryFunctionContext): Promise<IEnglish> => {
  const [_, __, termId] = queryKey;
  console.log(termId);
  try {
    const response = await instance.get(`terminologies/english/${termId}`);
    return response.data;
  } catch (error) {
    throw new Error("Failed to fetch bag terminologies");
  }
};

// BagTerms 가져오기 API
export const getBagTerms = async ({
  queryKey
}: QueryFunctionContext): Promise<ITermListResponse> => {
  const [_, currentPage, searchQuery] = queryKey;
  // 페이지 번호가 있으면, 페이지 번호를 쿼리스트링으로 만들어준다.
  const currentPageString = currentPage ? `page=${currentPage}` : "";
  // 검색어가 있으면, 검색어를 쿼리스트링으로 만들어준다.
  const queryString = searchQuery ? `&search=${searchQuery}` : "";

  try {
    const response = await instance.get(
      `bagterms?${currentPageString}${queryString}`
    );
    return response.data;
  } catch (error) {
    throw new Error("Failed to fetch bag terminologies");
  }
};

// BagTermDetail 가져오기 API
export const getBagTermDetail = async ({
  queryKey
}: QueryFunctionContext): Promise<ITerm> => {
  const [_, termId] = queryKey;
  try {
    const response = await instance.get(`bagterms/${termId}`);
    return response.data;
  } catch (error) {
    throw new Error("Failed to fetch bag terminologies");
  }
};

// BagTerm 업로드 API
export const uploadBagTerm = (variables: ITerm) =>
  instance
    .post(`bagterms/`, variables, {
      headers: {
        "X-CSRFToken": Cookies.get("csrftoken") || ""
      }
    })
    .then((response) => response.data);

// BagTerm 수정 API
export const editBagTerm = (variables: ITerm) =>
  instance
    .put(`bagterms/${variables.id}`, variables, {
      headers: {
        "X-CSRFToken": Cookies.get("csrftoken") || ""
      }
    })
    .then((response) => response.data);

// BagTerm 삭제 API
export const deleteBagTerm = (termId: string) =>
  instance
    .delete(`bagterms/${termId}`, {
      headers: {
        "X-CSRFToken": Cookies.get("csrftoken") || ""
      }
    })
    .then((response) => response.data);

// Translation API
export const translate = async (variables: ITranslateVariables) => {
  try {
    const response = await instance.post(`bagterms/translate`, variables, {
      headers: {
        "X-CSRFToken": Cookies.get("csrftoken") || ""
      }
    });
    return response.data;
  } catch (error) {
    throw new Error("Failed to translate text");
  }
};

// 번역을 위한 Text에 포함된 BagTerm 용어 가져오기 API
export const getBagTermInText = async (text: string) => {
  try {
    const response = await instance.post(
      `bagterms/translate/extract`,
      { text },
      {
        headers: {
          "X-CSRFToken": Cookies.get("csrftoken") || ""
        }
      }
    );
    return response.data;
  } catch (error) {
    throw new Error("Failed to extract bag terms from text");
  }
};


// Blog 리스트 가져오기
export const getBlogs = async ({
  queryKey
}: QueryFunctionContext): Promise<IBlogListResponse> => {
  const [_, currentPage, searchQuery] = queryKey;
  // 페이지 번호가 있으면, 페이지 번호를 쿼리 스트링으로 만들어준다.
  const currentPageString = currentPage ? `page=${currentPage}` : "";
  // 검색어가 있으면, 검색어를 쿼리 스트링으로 만들어준다.
  const queryString = searchQuery ? `&search=${searchQuery}` : "";
  try {
    const response = await instance.get(`blogs?${currentPageString}${queryString}`);
    return response.data;
  } catch (error) {
    throw new Error("Failed to fetch blog");
  }
};

// Blog Detail 가져오기
export const getBlogDetail = async ({
  queryKey
}: QueryFunctionContext): Promise<IBlog> => {
  try {
    const [_, blogId] = queryKey;
    const response = await instance.get(`blogs/${blogId}`);
    return response.data;
  } catch (error) {
    throw new Error("Failed to fetch blog detail");
  }
};


// Blog 업로드 API
export const uploadBlog = (variables: IBlogForm) =>
  instance
    .post(`blogs/`, variables, {
      headers: {
        "X-CSRFToken": Cookies.get("csrftoken") || ""
      }
    })
    .then((response) => response.data);

// blog 수정 API
export const editBlog = (variables: IBlogForm) =>
  instance
    .put(`blogs/${variables.id}`, variables, {
      headers: {
        "X-CSRFToken": Cookies.get("csrftoken") || ""
      }
    })
    .then((response) => response.data);

// blog 삭제 API
export const deleteBlog = (blogId: string) =>
  instance
    .delete(`blogs/${blogId}`, {
      headers: {
        "X-CSRFToken": Cookies.get("csrftoken") || ""
      }
    })
    .then((response) => response.data);


// Tool 리스트 가져오기
export const getTools = async () => {
  try {
    const response = await instance.get(`tools`);
    return response.data;
  } catch (error) {
    throw new Error("Failed to fetch tools");
  }
};

// Tool Detail 가져오기
export const getToolDetail = async (toolId: string) => {
  try {
    const response = await instance.get(`tools/${toolId}`);
    return response.data;
  } catch (error) {
    throw new Error("Failed to fetch tool detail");
  }
};

interface IToolForm {
  id?: string | number;
  name: string;
  description?: string;
  category?: string;
  url?: string;
  location?: string;
}

// Tool Upload API
export const uploadTool = (variables: IToolForm) =>
  instance
    .post(`tools/`, variables, {
      headers: {
        "X-CSRFToken": Cookies.get("csrftoken") || ""
      }
    })
    .then((response) => response.data);

// Tool Edit API
export const editTool = (variables: IToolForm) =>
  instance
    .put(`tools/${variables.id}`, variables, {
      headers: {
        "X-CSRFToken": Cookies.get("csrftoken") || ""
      }
    })
    .then((response) => response.data);

// Tool Delete API
export const deleteTool = (toolId: string) =>
  instance
    .delete(`tools/${toolId}`, {
      headers: {
        "X-CSRFToken": Cookies.get("csrftoken") || ""
      }
    })
    .then((response) => response.data);

// Tool Light ON API
export const toolLightOn = (toolId: string) =>
  instance
    // 두 번째 인자(null)는 body, 세 번째 인자가 config(헤더)입니다.
    .post(
      `tools/${toolId}/light-on`,
      null,
      {
        headers: {
          "X-CSRFToken": Cookies.get("csrftoken") || ""
        }
      }
    )
    .then((response) => response.data);


// Jig 리스트 가져오기 (search, page 지원)
export interface IJigListResponse {
  jigs: unknown[];
  current_page: number;
  total_pages: number;
  total_results: number;
  kpi?: {
    total: number;
    handed_over: number;
    returned: number;
    not_returned: number;
  };
}
// Jig 리스트 가져오기 (search, page 지원)
export const getJigs = async (params?: {
  search?: string;
  page?: number;
  filter?: string;
  status?: string;
  shape?: string;
  material?: string;
}) => {
  try {
    const response = await instance.get(`jigs/`, { params });
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error(
        `Failed to fetch jigs: ${error.response?.status ?? ""} ${error.response?.data?.detail ?? error.message}`
      );
    }
    throw error;
  }
};

// Storage Location 리스트 가져오기
export interface IStorageLocation {
  id: number;
  code: string;
  zone: string;
  shelf: string;
  slot: number;
  description: string;
  is_occupied: boolean;
  led_on: boolean;
}

export const getStorageLocations = async (): Promise<IStorageLocation[]> => {
  try {
    const response = await instance.get(`storage-locations/`);
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error(
        `Failed to fetch storage locations: ${error.response?.status ?? ""} ${error.response?.data?.detail ?? error.message}`
      );
    }
    throw error;
  }
};

export const createStorageLocation = async (
  data: Omit<IStorageLocation, "id">
): Promise<IStorageLocation> => {
  try {
    const response = await instance.post(`storage-locations/`, data, {
      headers: { "X-CSRFToken": Cookies.get("csrftoken") || "" }
    });
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error(
        `Failed to create storage location: ${error.response?.status ?? ""} ${error.response?.data?.detail ?? error.message}`
      );
    }
    throw error;
  }
};

export const getStorageLocation = async (pk: number): Promise<IStorageLocation> => {
  try {
    const response = await instance.get(`storage-locations/${pk}/`);
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error(`Failed to fetch storage location: ${error.response?.status ?? ""} ${error.response?.data?.detail ?? error.message}`);
    }
    throw error;
  }
};

export const editStorageLocation = async (pk: number, data: Partial<IStorageLocation>): Promise<IStorageLocation> => {
  try {
    const response = await instance.put(`storage-locations/${pk}/`, data, {
      headers: { "X-CSRFToken": Cookies.get("csrftoken") || "" }
    });
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error(`Failed to update storage location: ${error.response?.status ?? ""} ${error.response?.data?.detail ?? error.message}`);
    }
    throw error;
  }
};

export const deleteStorageLocation = async (pk: number): Promise<void> => {
  try {
    await instance.delete(`storage-locations/${pk}/`, {
      headers: { "X-CSRFToken": Cookies.get("csrftoken") || "" }
    });
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error(`Failed to delete storage location: ${error.response?.status ?? ""} ${error.response?.data?.detail ?? error.message}`);
    }
    throw error;
  }
};

/** TG Binding Guide 전용 보관 위치 (jigs storage-locations 와 별도 테이블 · API: tg-binding-guides/tg-storage-locations/) */
export type ITgStorageLocation = IStorageLocation;

const tgBindingGuideStorageLocationsBase = "tg-binding-guides/tg-storage-locations";

export const getTgStorageLocations = async (): Promise<ITgStorageLocation[]> => {
  try {
    const response = await instance.get(`${tgBindingGuideStorageLocationsBase}/`);
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error(
        `Failed to fetch TG storage locations: ${error.response?.status ?? ""} ${error.response?.data?.detail ?? error.message}`
      );
    }
    throw error;
  }
};

export const createTgStorageLocation = async (data: Omit<ITgStorageLocation, "id">): Promise<ITgStorageLocation> => {
  try {
    const response = await instance.post(`${tgBindingGuideStorageLocationsBase}/`, data, {
      headers: { "X-CSRFToken": Cookies.get("csrftoken") || "" }
    });
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error(
        `Failed to create TG storage location: ${error.response?.status ?? ""} ${error.response?.data?.detail ?? error.message}`
      );
    }
    throw error;
  }
};

export const getTgStorageLocation = async (pk: number): Promise<ITgStorageLocation> => {
  try {
    const response = await instance.get(`${tgBindingGuideStorageLocationsBase}/${pk}/`);
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error(
        `Failed to fetch TG storage location: ${error.response?.status ?? ""} ${error.response?.data?.detail ?? error.message}`
      );
    }
    throw error;
  }
};

export const editTgStorageLocation = async (
  pk: number,
  data: Partial<ITgStorageLocation>
): Promise<ITgStorageLocation> => {
  try {
    const response = await instance.put(`${tgBindingGuideStorageLocationsBase}/${pk}/`, data, {
      headers: { "X-CSRFToken": Cookies.get("csrftoken") || "" }
    });
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error(
        `Failed to update TG storage location: ${error.response?.status ?? ""} ${error.response?.data?.detail ?? error.message}`
      );
    }
    throw error;
  }
};

export const deleteTgStorageLocation = async (pk: number): Promise<void> => {
  try {
    await instance.delete(`${tgBindingGuideStorageLocationsBase}/${pk}/`, {
      headers: { "X-CSRFToken": Cookies.get("csrftoken") || "" }
    });
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error(
        `Failed to delete TG storage location: ${error.response?.status ?? ""} ${error.response?.data?.detail ?? error.message}`
      );
    }
    throw error;
  }
};

// Jig 사진 삭제
export const deleteJigPhoto = ({
  jigId,
  photoPk
}: {
  jigId: string;
  photoPk: string;
}) =>
  instance
    .delete(`jigs/${jigId}/photos/${photoPk}/`, {
      headers: { "X-CSRFToken": Cookies.get("csrftoken") || "" }
    })
    .then((res) => res.data);

// Jig 사진 업로드
export const createJigPhoto = ({
  file,
  jigId,
  description = ""
}: {
  file: string;
  jigId: string;
  description?: string;
}) =>
  instance
    .post(
      `jigs/${jigId}/photos/`,
      { file, description },
      { headers: { "X-CSRFToken": Cookies.get("csrftoken") || "" } }
    )
    .then((response) => response.data);

// Jig 사진 가져오기
export const getJigPhotos = async (jigId: string): Promise<IFilePhotos[]> => {
  try {
    const response = await instance.get(`jigs/${jigId}/photos/`);
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error(`Failed to fetch jig photos: ${error.response?.status ?? ""} ${error.response?.data?.detail ?? error.message}`);
    }
    throw error;
  }
};

// Jig 비디오 가져오기
export const getJigVideos = async (jigId: string): Promise<IFileVideos[]> => {
  try {
    const response = await instance.get(`jigs/${jigId}/videos/`);
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error(`Failed to fetch jig videos: ${error.response?.status ?? ""} ${error.response?.data?.detail ?? error.message}`);
    }
    throw error;
  }
};

// Jig 비디오 생성
export const createJigVideo = ({
  VideoFile,
  ThumbnailFile,
  description,
  jigId
}: {
  VideoFile: string;
  ThumbnailFile: string;
  description?: string;
  jigId: string;
}) =>
  instance
    .post(
      `jigs/${jigId}/videos/`,
      { VideoFile, ThumbnailFile, description },
      { headers: { "X-CSRFToken": Cookies.get("csrftoken") || "" } }
    )
    .then((response) => response.data);

// Jig 비디오 삭제
export const deleteJigVideo = ({
  jigId,
  videoPk
}: {
  jigId: string;
  videoPk: string;
}) =>
  instance
    .delete(`jigs/${jigId}/videos/${videoPk}/`, {
      headers: { "X-CSRFToken": Cookies.get("csrftoken") || "" }
    })
    .then((response) => response.data);

// Jig Detail 가져오기
export const getJigDetail = async (jigId: string) => {
  try {
    const response = await instance.get(`jigs/${jigId}`);
    return response.data;
  } catch (error) {
    throw new Error("Failed to fetch jig detail");
  }
};

interface IJigForm {
  id: string;
  name?: string;
  serial_number?: string;
  status?: string;
  description?: string;
  buyer?: string;
  shape?: string;
  size?: string;
  material?: string;
  location?: number | null;
  sj_style?: number | null;
  manufactured_date?: string | null;
  handed_over_at?: string | null;
  handed_over_by?: string;
  handed_over_dept?: string;
  returned_at?: string | null;
  returned_by?: string;
  returned_dept?: string;
  memo?: string;
}

interface IJigCreateForm {
  name: string;
  serial_number: string;
  description?: string;
  buyer?: string;
  shape?: string;
  size?: string;
  material?: string;
  status?: string;
  location?: number | null;
  sj_style?: number | null;
}

// Jig Create API
export const createJig = (variables: IJigCreateForm) =>
  instance
    .post(`jigs/`, variables, {
      headers: {
        "X-CSRFToken": Cookies.get("csrftoken") || ""
      }
    })
    .then((response) => response.data);

// Jig Edit API
export const editJig = (variables: IJigForm) =>
  instance
    .put(`jigs/${variables.id}`, variables, {
      headers: {
        "X-CSRFToken": Cookies.get("csrftoken") || ""
      }
    })
    .then((response) => response.data);

// Jig Delete API
export const deleteJig = (jigId: string) =>
  instance
    .delete(`jigs/${jigId}`, {
      headers: {
        "X-CSRFToken": Cookies.get("csrftoken") || ""
      }
    })
    .then((response) => response.data);

// Jig Light ON API
export const jigLightOn = (jigId: string) =>
  instance
    .post(
      `jigs/${jigId}/light-on`,
      null,
      {
        headers: {
          "X-CSRFToken": Cookies.get("csrftoken") || ""
        }
      }
    )
    .then((response) => response.data);


// ──────────────────────────────────────────────
// TG Jig API (TG 공장 전용 — Sample Room jigs 와 분리)
// ──────────────────────────────────────────────

export interface ITgJigListResponse {
  jigs: unknown[];
  current_page: number;
  total_pages: number;
  total_results: number;
}

export const getTgJigs = async (params?: { search?: string; page?: number }) => {
  try {
    const response = await instance.get(`tg-jigs/`, { params });
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error(
        `Failed to fetch TG jigs: ${error.response?.status ?? ""} ${error.response?.data?.detail ?? error.message}`
      );
    }
    throw error;
  }
};

export type ITgJigStorageLocation = IStorageLocation;

const tgJigStorageLocationsBase = "tg-jigs/tg-storage-locations";

export const getTgJigStorageLocations = async (): Promise<ITgJigStorageLocation[]> => {
  try {
    const response = await instance.get(`${tgJigStorageLocationsBase}/`);
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error(
        `Failed to fetch TG jig storage locations: ${error.response?.status ?? ""} ${error.response?.data?.detail ?? error.message}`
      );
    }
    throw error;
  }
};

export const createTgJigStorageLocation = async (
  data: Omit<ITgJigStorageLocation, "id">
): Promise<ITgJigStorageLocation> => {
  try {
    const response = await instance.post(`${tgJigStorageLocationsBase}/`, data, {
      headers: { "X-CSRFToken": Cookies.get("csrftoken") || "" },
    });
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error(
        `Failed to create TG jig storage location: ${error.response?.status ?? ""} ${error.response?.data?.detail ?? error.message}`
      );
    }
    throw error;
  }
};

export const getTgJigStorageLocation = async (pk: number): Promise<ITgJigStorageLocation> => {
  try {
    const response = await instance.get(`${tgJigStorageLocationsBase}/${pk}/`);
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error(
        `Failed to fetch TG jig storage location: ${error.response?.status ?? ""} ${error.response?.data?.detail ?? error.message}`
      );
    }
    throw error;
  }
};

export const editTgJigStorageLocation = async (
  pk: number,
  data: Partial<ITgJigStorageLocation>
): Promise<ITgJigStorageLocation> => {
  try {
    const response = await instance.put(`${tgJigStorageLocationsBase}/${pk}/`, data, {
      headers: { "X-CSRFToken": Cookies.get("csrftoken") || "" },
    });
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error(
        `Failed to update TG jig storage location: ${error.response?.status ?? ""} ${error.response?.data?.detail ?? error.message}`
      );
    }
    throw error;
  }
};

export const deleteTgJigStorageLocation = async (pk: number): Promise<void> => {
  try {
    await instance.delete(`${tgJigStorageLocationsBase}/${pk}/`, {
      headers: { "X-CSRFToken": Cookies.get("csrftoken") || "" },
    });
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error(
        `Failed to delete TG jig storage location: ${error.response?.status ?? ""} ${error.response?.data?.detail ?? error.message}`
      );
    }
    throw error;
  }
};

export const deleteTgJigPhoto = ({
  tgJigId,
  photoPk,
}: {
  tgJigId: string;
  photoPk: string;
}) =>
  instance
    .delete(`tg-jigs/${tgJigId}/photos/${photoPk}/`, {
      headers: { "X-CSRFToken": Cookies.get("csrftoken") || "" },
    })
    .then((res) => res.data);

export const createTgJigPhoto = ({
  file,
  tgJigId,
  description = "",
}: {
  file: string;
  tgJigId: string;
  description?: string;
}) =>
  instance
    .post(`tg-jigs/${tgJigId}/photos/`, { file, description }, {
      headers: { "X-CSRFToken": Cookies.get("csrftoken") || "" },
    })
    .then((response) => response.data);

export const getTgJigPhotos = async (tgJigId: string): Promise<IFilePhotos[]> => {
  try {
    const response = await instance.get(`tg-jigs/${tgJigId}/photos/`);
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error(
        `Failed to fetch TG jig photos: ${error.response?.status ?? ""} ${error.response?.data?.detail ?? error.message}`
      );
    }
    throw error;
  }
};

export const getTgJigVideos = async (tgJigId: string): Promise<IFileVideos[]> => {
  try {
    const response = await instance.get(`tg-jigs/${tgJigId}/videos/`);
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error(
        `Failed to fetch TG jig videos: ${error.response?.status ?? ""} ${error.response?.data?.detail ?? error.message}`
      );
    }
    throw error;
  }
};

export const createTgJigVideo = ({
  VideoFile,
  ThumbnailFile,
  description,
  tgJigId,
}: {
  VideoFile: string;
  ThumbnailFile: string;
  description?: string;
  tgJigId: string;
}) =>
  instance
    .post(
      `tg-jigs/${tgJigId}/videos/`,
      { VideoFile, ThumbnailFile, description },
      { headers: { "X-CSRFToken": Cookies.get("csrftoken") || "" } }
    )
    .then((response) => response.data);

export const deleteTgJigVideo = ({
  tgJigId,
  videoPk,
}: {
  tgJigId: string;
  videoPk: string;
}) =>
  instance
    .delete(`tg-jigs/${tgJigId}/videos/${videoPk}/`, {
      headers: { "X-CSRFToken": Cookies.get("csrftoken") || "" },
    })
    .then((response) => response.data);

export const getTgJigDetail = async (tgJigId: string) => {
  try {
    const response = await instance.get(`tg-jigs/${tgJigId}`);
    return response.data;
  } catch (error) {
    throw new Error("Failed to fetch TG jig detail");
  }
};

interface ITgJigForm {
  id: string;
  name?: string;
  serial_number?: string;
  status?: string;
  description?: string;
  buyer?: string;
  shape?: string;
  size?: string;
  material?: string;
  location?: number | null;
  sj_style?: number | null;
}

interface ITgJigCreateForm {
  name: string;
  serial_number: string;
  description?: string;
  buyer?: string;
  shape?: string;
  size?: string;
  material?: string;
  status?: string;
  location?: number | null;
  sj_style?: number | null;
}

export const createTgJig = (variables: ITgJigCreateForm) =>
  instance
    .post(`tg-jigs/`, variables, {
      headers: {
        "X-CSRFToken": Cookies.get("csrftoken") || "",
      },
    })
    .then((response) => response.data);

export const editTgJig = (variables: ITgJigForm) =>
  instance
    .put(`tg-jigs/${variables.id}`, variables, {
      headers: {
        "X-CSRFToken": Cookies.get("csrftoken") || "",
      },
    })
    .then((response) => response.data);

export const deleteTgJig = (tgJigId: string) =>
  instance
    .delete(`tg-jigs/${tgJigId}`, {
      headers: {
        "X-CSRFToken": Cookies.get("csrftoken") || "",
      },
    })
    .then((response) => response.data);

export const tgJigLightOn = (tgJigId: string) =>
  instance
    .post(`tg-jigs/${tgJigId}/light-on`, null, {
      headers: {
        "X-CSRFToken": Cookies.get("csrftoken") || "",
      },
    })
    .then((response) => response.data);


// ──────────────────────────────────────────────
// Binding Guide API
// ──────────────────────────────────────────────

export interface IBindingGuideListResponse {
  jigs: unknown[];
  current_page: number;
  total_pages: number;
  total_results: number;
  kpi?: {
    total: number;
    handed_over: number;
    returned: number;
    not_returned: number;
  };
}

export const getBindingGuides = async (params?: { search?: string; page?: number; filter?: string; status?: string; shape?: string; material?: string }) => {
  try {
    const response = await instance.get(`binding-guides/`, { params });
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error(
        `Failed to fetch binding guides: ${error.response?.status ?? ""} ${error.response?.data?.detail ?? error.message}`
      );
    }
    throw error;
  }
};

export const getBindingGuideDetail = async (id: string) => {
  try {
    const response = await instance.get(`binding-guides/${id}`);
    return response.data;
  } catch (error) {
    throw new Error("Failed to fetch binding guide detail");
  }
};

export const getBindingGuidePhotos = async (id: string): Promise<IFilePhotos[]> => {
  try {
    const response = await instance.get(`binding-guides/${id}/photos/`);
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error(`Failed to fetch binding guide photos: ${error.response?.status ?? ""} ${error.response?.data?.detail ?? error.message}`);
    }
    throw error;
  }
};

export const createBindingGuidePhoto = ({ file, bindingGuideId, description = "" }: { file: string; bindingGuideId: string; description?: string }) =>
  instance
    .post(`binding-guides/${bindingGuideId}/photos/`, { file, description }, { headers: { "X-CSRFToken": Cookies.get("csrftoken") || "" } })
    .then((response) => response.data);

export const deleteBindingGuidePhoto = ({ bindingGuideId, photoPk }: { bindingGuideId: string; photoPk: string }) =>
  instance
    .delete(`binding-guides/${bindingGuideId}/photos/${photoPk}/`, { headers: { "X-CSRFToken": Cookies.get("csrftoken") || "" } })
    .then((res) => res.data);

export const getBindingGuideVideos = async (id: string): Promise<IFileVideos[]> => {
  try {
    const response = await instance.get(`binding-guides/${id}/videos/`);
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error(`Failed to fetch binding guide videos: ${error.response?.status ?? ""} ${error.response?.data?.detail ?? error.message}`);
    }
    throw error;
  }
};

export const createBindingGuideVideo = ({ VideoFile, ThumbnailFile, description, bindingGuideId }: { VideoFile: string; ThumbnailFile: string; description?: string; bindingGuideId: string }) =>
  instance
    .post(`binding-guides/${bindingGuideId}/videos/`, { VideoFile, ThumbnailFile, description }, { headers: { "X-CSRFToken": Cookies.get("csrftoken") || "" } })
    .then((response) => response.data);

export const deleteBindingGuideVideo = ({ bindingGuideId, videoPk }: { bindingGuideId: string; videoPk: string }) =>
  instance
    .delete(`binding-guides/${bindingGuideId}/videos/${videoPk}/`, { headers: { "X-CSRFToken": Cookies.get("csrftoken") || "" } })
    .then((response) => response.data);

interface IBindingGuideForm {
  id: string;
  name?: string;
  serial_number?: string;
  status?: string;
  description?: string;
  buyer?: string;
  shape?: string;
  size?: string;
  material?: string;
  location?: number | null;
  sj_style?: number | null;
  manufactured_date?: string | null;
  handed_over_at?: string | null;
  handed_over_by?: string;
  handed_over_dept?: string;
  returned_at?: string | null;
  returned_by?: string;
  returned_dept?: string;
  memo?: string;
}

interface IBindingGuideCreateForm {
  name: string;
  serial_number: string;
  description?: string;
  buyer?: string;
  shape?: string;
  size?: string;
  material?: string;
  status?: string;
  location?: number | null;
  sj_style?: number | null;
}

export const createBindingGuide = (variables: IBindingGuideCreateForm) =>
  instance
    .post(`binding-guides/`, variables, { headers: { "X-CSRFToken": Cookies.get("csrftoken") || "" } })
    .then((response) => response.data);

export const editBindingGuide = (variables: IBindingGuideForm) =>
  instance
    .put(`binding-guides/${variables.id}`, variables, { headers: { "X-CSRFToken": Cookies.get("csrftoken") || "" } })
    .then((response) => response.data);

export const deleteBindingGuide = (id: string) =>
  instance
    .delete(`binding-guides/${id}`, { headers: { "X-CSRFToken": Cookies.get("csrftoken") || "" } })
    .then((response) => response.data);

export const bindingGuideLightOn = (id: string) =>
  instance
    .post(`binding-guides/${id}/light-on`, null, { headers: { "X-CSRFToken": Cookies.get("csrftoken") || "" } })
    .then((response) => response.data);

// ──────────────────────────────────────────────
// TG Binding Guide API (TG 공장 전용)
// ──────────────────────────────────────────────

export interface ITgBindingGuideListResponse {
  jigs: unknown[];
  current_page: number;
  total_pages: number;
  total_results: number;
}

export const getTgBindingGuides = async (params?: { search?: string; page?: number }) => {
  try {
    const response = await instance.get(`tg-binding-guides/`, { params });
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error(
        `Failed to fetch TG binding guides: ${error.response?.status ?? ""} ${error.response?.data?.detail ?? error.message}`
      );
    }
    throw error;
  }
};

export const getTgBindingGuideDetail = async (id: string) => {
  try {
    const response = await instance.get(`tg-binding-guides/${id}`);
    return response.data;
  } catch (error) {
    throw new Error("Failed to fetch TG binding guide detail");
  }
};

export const getTgBindingGuidePhotos = async (id: string): Promise<IFilePhotos[]> => {
  try {
    const response = await instance.get(`tg-binding-guides/${id}/photos/`);
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error(`Failed to fetch TG binding guide photos: ${error.response?.status ?? ""} ${error.response?.data?.detail ?? error.message}`);
    }
    throw error;
  }
};

export const createTgBindingGuidePhoto = ({
  file,
  tgBindingGuideId,
  description = ""
}: {
  file: string;
  tgBindingGuideId: string;
  description?: string;
}) =>
  instance
    .post(`tg-binding-guides/${tgBindingGuideId}/photos/`, { file, description }, { headers: { "X-CSRFToken": Cookies.get("csrftoken") || "" } })
    .then((response) => response.data);

export const deleteTgBindingGuidePhoto = ({ tgBindingGuideId, photoPk }: { tgBindingGuideId: string; photoPk: string }) =>
  instance
    .delete(`tg-binding-guides/${tgBindingGuideId}/photos/${photoPk}/`, { headers: { "X-CSRFToken": Cookies.get("csrftoken") || "" } })
    .then((res) => res.data);

export const getTgBindingGuideVideos = async (id: string): Promise<IFileVideos[]> => {
  try {
    const response = await instance.get(`tg-binding-guides/${id}/videos/`);
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error(`Failed to fetch TG binding guide videos: ${error.response?.status ?? ""} ${error.response?.data?.detail ?? error.message}`);
    }
    throw error;
  }
};

export const createTgBindingGuideVideo = ({
  VideoFile,
  ThumbnailFile,
  description,
  tgBindingGuideId
}: {
  VideoFile: string;
  ThumbnailFile: string;
  description?: string;
  tgBindingGuideId: string;
}) =>
  instance
    .post(`tg-binding-guides/${tgBindingGuideId}/videos/`, { VideoFile, ThumbnailFile, description }, { headers: { "X-CSRFToken": Cookies.get("csrftoken") || "" } })
    .then((response) => response.data);

export const deleteTgBindingGuideVideo = ({ tgBindingGuideId, videoPk }: { tgBindingGuideId: string; videoPk: string }) =>
  instance
    .delete(`tg-binding-guides/${tgBindingGuideId}/videos/${videoPk}/`, { headers: { "X-CSRFToken": Cookies.get("csrftoken") || "" } })
    .then((response) => response.data);

interface ITgBindingGuideForm {
  id: string;
  name?: string;
  serial_number?: string;
  status?: string;
  description?: string;
  buyer?: string;
  shape?: string;
  size?: string;
  material?: string;
  location?: number | null;
  sj_style?: number | null;
}

interface ITgBindingGuideCreateForm {
  name: string;
  serial_number: string;
  description?: string;
  buyer?: string;
  shape?: string;
  size?: string;
  material?: string;
  status?: string;
  location?: number | null;
  sj_style?: number | null;
}

export const createTgBindingGuide = (variables: ITgBindingGuideCreateForm) =>
  instance.post(`tg-binding-guides/`, variables, { headers: { "X-CSRFToken": Cookies.get("csrftoken") || "" } }).then((response) => response.data);

export const editTgBindingGuide = (variables: ITgBindingGuideForm) =>
  instance.put(`tg-binding-guides/${variables.id}`, variables, { headers: { "X-CSRFToken": Cookies.get("csrftoken") || "" } }).then((response) => response.data);

export const deleteTgBindingGuide = (id: string) =>
  instance.delete(`tg-binding-guides/${id}`, { headers: { "X-CSRFToken": Cookies.get("csrftoken") || "" } }).then((response) => response.data);

export const tgBindingGuideLightOn = (id: string) =>
  instance.post(`tg-binding-guides/${id}/light-on`, null, { headers: { "X-CSRFToken": Cookies.get("csrftoken") || "" } }).then((response) => response.data);

// ──────────────────────────────────────────────
// Aluminum Mold API
// ──────────────────────────────────────────────

export interface IAluminumMoldListResponse {
  jigs: unknown[];
  current_page: number;
  total_pages: number;
  total_results: number;
  kpi?: {
    total: number;
    handed_over: number;
    returned: number;
    not_returned: number;
  };
}

export const getAluminumMolds = async (params?: { search?: string; page?: number; filter?: string; status?: string; shape?: string; material?: string }) => {
  try {
    const response = await instance.get(`aluminum-molds/`, { params });
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error(
        `Failed to fetch aluminum molds: ${error.response?.status ?? ""} ${error.response?.data?.detail ?? error.message}`
      );
    }
    throw error;
  }
};

export const getAluminumMoldDetail = async (id: string) => {
  try {
    const response = await instance.get(`aluminum-molds/${id}`);
    return response.data;
  } catch (error) {
    throw new Error("Failed to fetch aluminum mold detail");
  }
};

export const getAluminumMoldPhotos = async (id: string): Promise<IFilePhotos[]> => {
  try {
    const response = await instance.get(`aluminum-molds/${id}/photos/`);
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error(`Failed to fetch aluminum mold photos: ${error.response?.status ?? ""} ${error.response?.data?.detail ?? error.message}`);
    }
    throw error;
  }
};

export const createAluminumMoldPhoto = ({
  file,
  aluminumMoldId,
  description = ""
}: {
  file: string;
  aluminumMoldId: string;
  description?: string;
}) =>
  instance
    .post(`aluminum-molds/${aluminumMoldId}/photos/`, { file, description }, { headers: { "X-CSRFToken": Cookies.get("csrftoken") || "" } })
    .then((response) => response.data);

export const deleteAluminumMoldPhoto = ({ aluminumMoldId, photoPk }: { aluminumMoldId: string; photoPk: string }) =>
  instance
    .delete(`aluminum-molds/${aluminumMoldId}/photos/${photoPk}/`, { headers: { "X-CSRFToken": Cookies.get("csrftoken") || "" } })
    .then((res) => res.data);

export const getAluminumMoldVideos = async (id: string): Promise<IFileVideos[]> => {
  try {
    const response = await instance.get(`aluminum-molds/${id}/videos/`);
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error(`Failed to fetch aluminum mold videos: ${error.response?.status ?? ""} ${error.response?.data?.detail ?? error.message}`);
    }
    throw error;
  }
};

export const createAluminumMoldVideo = ({
  VideoFile,
  ThumbnailFile,
  description,
  aluminumMoldId
}: {
  VideoFile: string;
  ThumbnailFile: string;
  description?: string;
  aluminumMoldId: string;
}) =>
  instance
    .post(`aluminum-molds/${aluminumMoldId}/videos/`, { VideoFile, ThumbnailFile, description }, { headers: { "X-CSRFToken": Cookies.get("csrftoken") || "" } })
    .then((response) => response.data);

export const deleteAluminumMoldVideo = ({ aluminumMoldId, videoPk }: { aluminumMoldId: string; videoPk: string }) =>
  instance
    .delete(`aluminum-molds/${aluminumMoldId}/videos/${videoPk}/`, { headers: { "X-CSRFToken": Cookies.get("csrftoken") || "" } })
    .then((response) => response.data);

interface IAluminumMoldForm {
  id: string;
  name?: string;
  serial_number?: string;
  status?: string;
  description?: string;
  buyer?: string;
  shape?: string;
  size?: string;
  material?: string;
  location?: number | null;
  sj_style?: number | null;
  manufactured_date?: string | null;
  handed_over_at?: string | null;
  handed_over_by?: string;
  handed_over_dept?: string;
  returned_at?: string | null;
  returned_by?: string;
  returned_dept?: string;
  memo?: string;
}

interface IAluminumMoldCreateForm {
  name: string;
  serial_number: string;
  description?: string;
  buyer?: string;
  shape?: string;
  size?: string;
  material?: string;
  status?: string;
  location?: number | null;
  sj_style?: number | null;
}

export const createAluminumMold = (variables: IAluminumMoldCreateForm) =>
  instance.post(`aluminum-molds/`, variables, { headers: { "X-CSRFToken": Cookies.get("csrftoken") || "" } }).then((response) => response.data);

export const editAluminumMold = (variables: IAluminumMoldForm) =>
  instance.put(`aluminum-molds/${variables.id}`, variables, { headers: { "X-CSRFToken": Cookies.get("csrftoken") || "" } }).then((response) => response.data);

export const deleteAluminumMold = (id: string) =>
  instance.delete(`aluminum-molds/${id}`, { headers: { "X-CSRFToken": Cookies.get("csrftoken") || "" } }).then((response) => response.data);

export const aluminumMoldLightOn = (id: string) =>
  instance.post(`aluminum-molds/${id}/light-on`, null, { headers: { "X-CSRFToken": Cookies.get("csrftoken") || "" } }).then((response) => response.data);

// Sjmedia Photo List API
export const getSjmediaPhotos = async () => {
  try {
    const response = await instance.get(`sjmedia/photos`);
    console.log("Sjmedia Photos:", response.data);
    return response.data;
  } catch (err) {
    throw new Error("Failed to fetch sjmedia photos");
  }
};

export interface ISjmediaListItem {
  pk: number;
  title: string;
  description?: string;
  sj_style?: number | null;
  sj_style_detail?: ISjmediaStyleDetail | null;
  photos: IFilePhotos[];
  videos: IFileVideos[];
}

export interface ISjmediaListResponse {
  sjmedia: ISjmediaListItem[];
  current_page: number;
  total_pages: number;
  total_results: number;
}

// Sjmedia List API (search + pagination + type filter)
export const getSjmediaList = async (params: {
  search?: string;
  page?: number;
  type?: "photo" | "video";
}): Promise<ISjmediaListResponse> => {
  const response = await instance.get("sjmedia/", { params });
  return response.data as ISjmediaListResponse;
};

// Sjmedia Photo Detail API
export const getSjmediaPhotoDetail = async (pk: string): Promise<IFilePhotos> => {
  try {
    const response = await instance.get(`sjmedia/photos/${pk}`);
    return response.data as IFilePhotos;
  } catch (err) {
    throw new Error("Failed to fetch sjmedia photo detail");
  }
};

// Sjmedia Video List API
export const getSjmediaVideos = async () => {
  try {
    const response = await instance.get(`sjmedia/videos`);
    console.log("Sjmedia Videos:", response.data);
    return response.data;
  } catch (err) {
    console.error("Failed to fetch sjmedia videos:", err);
    throw err;
  }
};

// Sjmedia Video Detail API
export const getSjmediaVideoDetail = async (pk: string): Promise<IFileVideos> => {
  try {
    const response = await instance.get(`sjmedia/videos/${pk}`);
    return response.data as IFileVideos;
  } catch (err) {
    throw new Error("Failed to fetch sjmedia video detail");
  }
};


// Sjmedia 단건 조회 API
export const getSjmedia = async (pk: number): Promise<ISjmedia> => {
  const response = await instance.get(`sjmedia/${pk}`);
  return response.data as ISjmedia;
};

// Sjmedia 수정 API (title, description = Related Style or Buyer)
export const editSjmedia = (pk: number, variables: Partial<ISjmedia>) =>
  instance
    .put(`sjmedia/${pk}`, variables, {
      headers: { "X-CSRFToken": Cookies.get("csrftoken") || "" }
    })
    .then((res) => res.data);

// Sjmedia 생성 API
export const createSjmedia = (variables: { title: string; description?: string; sj_style?: number | null }) =>
  instance
    .post(`sjmedia/`, variables, {
      headers: { "X-CSRFToken": Cookies.get("csrftoken") || "" }
    })
    .then((res) => res.data);

// Sjmedia Photo 등록 API (sjmedia/{pk}/photos)
export const createSjmediaPhoto = (pk: string, variables: { file: string; name?: string; description?: string }) =>
  instance
    .post(`sjmedia/${pk}/photos`, variables, {
      headers: { "X-CSRFToken": Cookies.get("csrftoken") || "" }
    })
    .then((res) => res.data);

// Sjmedia Video 등록 API (sjmedia/{pk}/videos)
export const createSjmediaVideo = (pk: string, variables: { VideoFile: string; ThumbnailFile: string; description?: string }) =>
  instance
    .post(`sjmedia/${pk}/videos`, variables, {
      headers: { "X-CSRFToken": Cookies.get("csrftoken") || "" }
    })
    .then((res) => res.data);

// Sjmedia Photo Edit API
export const editSjmediaPhoto = (pk: string, variables: Partial<IFilePhotos>) =>
  instance
    .put(`sjmedia/photos/${pk}`, variables, {
      headers: { "X-CSRFToken": Cookies.get("csrftoken") || "" }
    })
    .then((res) => res.data);

// Sjmedia Photo Delete API
export const deleteSjmediaPhoto = (pk: string) =>
  instance
    .delete(`sjmedia/photos/${pk}`, {
      headers: { "X-CSRFToken": Cookies.get("csrftoken") || "" }
    })
    .then((res) => res.data);

// Sjmedia Video Edit API
export const editSjmediaVideo = (pk: string, variables: Partial<IFileVideos>) =>
  instance
    .put(`sjmedia/videos/${pk}`, variables, {
      headers: { "X-CSRFToken": Cookies.get("csrftoken") || "" }
    })
    .then((res) => res.data);

// Sjmedia Video Delete API
export const deleteSjmediaVideo = (pk: string) =>
  instance
    .delete(`sjmedia/videos/${pk}`, {
      headers: { "X-CSRFToken": Cookies.get("csrftoken") || "" }
    })
    .then((res) => res.data);

// ─── SjStyles ────────────────────────────────────────────────────────────────

export interface ISjBagCategory {
  pk: number;
  code: string | null;
  name: string;
}

export interface ISjBodyMaterial {
  pk: number;
  code: string | null;
  name: string;
}

export interface ISjBuyerBrand {
  pk: number;
  code: string | null;
  name: string;
}

export interface ISjBagType {
  pk: number;
  code: string | null;
  name: string;
}

export interface ISjStyle {
  pk: number;
  code: string;
  style_name: string;
  buyer_style_code: string | null;
  internal_style_code: string | null;
  pattern_code: string | null;
  bag_category: ISjBagCategory | null;
  body_material: ISjBodyMaterial | null;
  buyer_brand: ISjBuyerBrand | null;
  bag_type: ISjBagType | null;
  sj_nos_count: number;
  created_at: string;
}

export interface ISjNo {
  pk: number;
  sj_no: string;
  style_name?: string;
  sj_style: number;
  sj_style_code: string | null;
  sj_style_name: string | null;
  sj_bag_category: ISjBagCategory | null;
  sj_body_material: ISjBodyMaterial | null;
  sj_buyer_brand: ISjBuyerBrand | null;
  sj_bag_type: ISjBagType | null;
  memo: string;
  cycle_time?: string | null;
  target_qty_per_hour?: number | null;
  daily_target_qty_8h?: number | null;
  module_count?: number;
  created_at: string;
}

export interface ISjStyleDetail extends Omit<ISjStyle, "sj_nos_count"> {
  description: string;
  sj_nos: ISjNo[];
  updated_at: string;
}

export interface ISjStyleListResponse {
  results: ISjStyle[];
  count: number;
  total_pages: number;
  current_page: number;
  total_results: number;
}

export interface ISjNoListResponse {
  results: ISjNo[];
  total_pages: number;
  current_page: number;
  total_results: number;
}

// SjStyle 리스트 가져오기
export const getSjStyles = async (params?: {
  search?: string;
  page?: number;
}) => {
  try {
    const response = await instance.get(`sj-styles/`, { params });
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error(
        `Failed to fetch sj styles: ${error.response?.status ?? ""} ${error.response?.data?.detail ?? error.message}`
      );
    }
    throw error;
  }
};

// SjNo 생성 (특정 SjStyle 하위)
export const createSjNo = (stylePk: number, data: { sj_no: string; style_name?: string; memo?: string }) =>
  instance
    .post(`sj-styles/${stylePk}/sj-nos`, data, {
      headers: { "X-CSRFToken": Cookies.get("csrftoken") || "" },
    })
    .then((r) => r.data as ISjNo);

// SjNo 단건 가져오기
export const getSjNoDetail = async (pk: number): Promise<ISjNo> => {
  const response = await instance.get(`sj-styles/sj-nos/${pk}`);
  return response.data as ISjNo;
};

// SjNo 리스트 가져오기 (검색 + 페이지네이션)
export const getSjNos = async (params?: { search?: string; page?: number }) => {
  try {
    const response = await instance.get(`sj-styles/sj-nos/`, { params });
    return response.data as ISjNoListResponse;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error(
        `Failed to fetch sj nos: ${error.response?.status ?? ""} ${error.response?.data?.detail ?? error.message}`
      );
    }
    throw error;
  }
};

// SjStyle 사진 가져오기
export const getSjStylePhotos = async (pk: number): Promise<IFilePhotos[]> => {
  try {
    const response = await instance.get(`sj-styles/${pk}/photos`);
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error(
        `Failed to fetch sj style photos: ${error.response?.status ?? ""} ${error.response?.data?.detail ?? error.message}`
      );
    }
    throw error;
  }
};

// SjStyle 사진 저장 (Cloudflare URL → Django)
export const createSjStylePhoto = (stylePk: number, file: string, description: string) =>
  instance
    .post(
      `sj-styles/${stylePk}/photos`,
      { file, description },
      { headers: { "X-CSRFToken": Cookies.get("csrftoken") || "" } }
    )
    .then((res) => res.data);

// SjStyle 디테일 가져오기
export const getSjStyleDetail = async (pk: number): Promise<ISjStyleDetail> => {
  try {
    const response = await instance.get(`sj-styles/${pk}`);
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error(
        `Failed to fetch sj style detail: ${error.response?.status ?? ""} ${error.response?.data?.detail ?? error.message}`
      );
    }
    throw error;
  }
};

// SjStyle 생성
export interface ISjStyleCreateForm {
  code: string;
  style_name: string;
  buyer_style_code?: string;
  internal_style_code?: string;
  pattern_code?: string;
  description?: string;
  bag_category?: number | null;
  body_material?: number | null;
  buyer_brand?: number | null;
  bag_type?: number | null;
}

export const createSjStyle = async (data: ISjStyleCreateForm) => {
  try {
    const response = await instance.post(`sj-styles/`, data, {
      headers: { "X-CSRFToken": Cookies.get("csrftoken") || "" }
    });
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error(
        `Failed to create sj style: ${error.response?.status ?? ""} ${error.response?.data?.detail ?? error.message}`
      );
    }
    throw error;
  }
};

// FK 선택지 목록
export const getBagCategories = async (): Promise<ISjBagCategory[]> => {
  const response = await instance.get(`sj-styles/meta/bag-categories`);
  return response.data;
};

export const getBodyMaterials = async (): Promise<ISjBodyMaterial[]> => {
  const response = await instance.get(`sj-styles/meta/body-materials`);
  return response.data;
};

export const getBuyerBrands = async (): Promise<ISjBuyerBrand[]> => {
  const response = await instance.get(`sj-styles/meta/buyer-brands`);
  return response.data;
};

export const getBagTypes = async (): Promise<ISjBagType[]> => {
  const response = await instance.get(`sj-styles/meta/bag-types`);
  return response.data;
};

// Meta CRUD helpers
const metaHeaders = () => ({ "X-CSRFToken": Cookies.get("csrftoken") || "" });

export const createBagCategory = (data: { name: string; code?: string }) =>
  instance.post(`sj-styles/meta/bag-categories`, data, { headers: metaHeaders() }).then((r) => r.data as ISjBagCategory);
export const updateBagCategory = (pk: number, data: { name?: string; code?: string }) =>
  instance.put(`sj-styles/meta/bag-categories/${pk}`, data, { headers: metaHeaders() }).then((r) => r.data as ISjBagCategory);
export const deleteBagCategory = (pk: number) =>
  instance.delete(`sj-styles/meta/bag-categories/${pk}`, { headers: metaHeaders() });

export const createBodyMaterial = (data: { name: string; code?: string }) =>
  instance.post(`sj-styles/meta/body-materials`, data, { headers: metaHeaders() }).then((r) => r.data as ISjBodyMaterial);
export const updateBodyMaterial = (pk: number, data: { name?: string; code?: string }) =>
  instance.put(`sj-styles/meta/body-materials/${pk}`, data, { headers: metaHeaders() }).then((r) => r.data as ISjBodyMaterial);
export const deleteBodyMaterial = (pk: number) =>
  instance.delete(`sj-styles/meta/body-materials/${pk}`, { headers: metaHeaders() });

export const createBuyerBrand = (data: { name: string; code?: string }) =>
  instance.post(`sj-styles/meta/buyer-brands`, data, { headers: metaHeaders() }).then((r) => r.data as ISjBuyerBrand);
export const updateBuyerBrand = (pk: number, data: { name?: string; code?: string }) =>
  instance.put(`sj-styles/meta/buyer-brands/${pk}`, data, { headers: metaHeaders() }).then((r) => r.data as ISjBuyerBrand);
export const deleteBuyerBrand = (pk: number) =>
  instance.delete(`sj-styles/meta/buyer-brands/${pk}`, { headers: metaHeaders() });

export const createBagType = (data: { name: string; code?: string }) =>
  instance.post(`sj-styles/meta/bag-types`, data, { headers: metaHeaders() }).then((r) => r.data as ISjBagType);
export const updateBagType = (pk: number, data: { name?: string; code?: string }) =>
  instance.put(`sj-styles/meta/bag-types/${pk}`, data, { headers: metaHeaders() }).then((r) => r.data as ISjBagType);
export const deleteBagType = (pk: number) =>
  instance.delete(`sj-styles/meta/bag-types/${pk}`, { headers: metaHeaders() });

// ── SjOrders ──────────────────────────────────────────────────────────────────

export interface IPOType {
  pk: number;
  code: string | null;
  name: string;
}

export interface ISjOrderListItem {
  pk: number;
  sj_po_number: string;
  order_date: string;
  destination: string;
  buyer_name: ISjBuyerBrand | null;
  ex_factory_date: string | null;
  sj_no: number | null;
  sj_no_value: string | null;
  sj_style: number | null;
  sj_style_code: string | null;
  style_name: string | null;
  color: string;
  size: string;
  order_qty: number;
  sample_qty: number;
  total_order_qty: number;
  po_type: IPOType | null;
  created_at: string;
  updated_at: string;
}

export interface ISjOrderDetail {
  pk: number;
  sj_po_number: string;
  order_date: string;
  destination: string;
  buyer_name: ISjBuyerBrand | null;
  ex_factory_date: string | null;
  sj_no: { pk: number; sj_no: string } | null;
  sj_style: { pk: number; code: string; style_name: string } | null;
  style_name: string | null;
  color: string;
  size: string;
  order_qty: number;
  sample_qty: number;
  total_order_qty: number;
  po_type: IPOType | null;
  created_at: string;
  updated_at: string;
}

export interface ISjOrderListResponse {
  results: ISjOrderListItem[];
  current_page: number;
  total_pages: number;
  total_results: number;
  total_qty_sum: number;
}

export const getPOTypes = async (): Promise<IPOType[]> => {
  const response = await instance.get("sj-orders/po-types/");
  return response.data as IPOType[];
};

export const getSjOrders = async (params?: { search?: string; page?: number }): Promise<ISjOrderListResponse> => {
  const response = await instance.get("sj-orders/", { params });
  return response.data as ISjOrderListResponse;
};

export const getSjOrderDetail = async (pk: number): Promise<ISjOrderDetail> => {
  const response = await instance.get(`sj-orders/${pk}`);
  return response.data as ISjOrderDetail;
};

export interface ISjOrderWritePayload extends Omit<Partial<ISjOrderDetail>, "buyer_name" | "sj_no" | "sj_style" | "po_type"> {
  buyer_name?: number | null;
  sj_no?: number | null;
  sj_style?: number | null;
  po_type?: number | null;
}

export const createSjOrder = (data: ISjOrderWritePayload) =>
  instance.post("sj-orders/", data, { headers: { "X-CSRFToken": Cookies.get("csrftoken") || "" } }).then((r) => r.data);

export const editSjOrder = (pk: number, data: ISjOrderWritePayload) =>
  instance.put(`sj-orders/${pk}`, data, { headers: { "X-CSRFToken": Cookies.get("csrftoken") || "" } }).then((r) => r.data);

export const deleteSjOrder = (pk: number) =>
  instance.delete(`sj-orders/${pk}`, { headers: { "X-CSRFToken": Cookies.get("csrftoken") || "" } });

// ── Workers ───────────────────────────────────────────────────────────────────

export interface IJobDuties {
  pk: number;
  name: string;
  code: string | null;
  description: string | null;
}

export interface IWorkerDept { pk: number; name: string; department_code: string | null; }
export interface IWorkerSection { pk: number; name: string; section_code: string | null; }
export interface IWorkerPosition { pk: number; name: string; position_code: string | null; }
export interface IWorkerRank { pk: number; name: string; rank_code: string | null; }
export interface IWorkerTeam { pk: number; name: string; team_code: string | null; }
export interface IWorkerFactory { pk: number; name: string; factory_code: string | null; nickname: string | null; country: string | null; }
export interface IWorkerCountry { pk: number; name: string; country_code: string | null; }
export interface IWorkerLine { pk: number; name: string; }

export interface IWorkerListItem {
  pk: number;
  company_id: string | null;
  name: string;
  nick_name: string | null;
  avatar: string | null;
  gender: string | null;
  department: IWorkerDept | null;
  section: IWorkerSection | null;
  position: IWorkerPosition | null;
  rank: IWorkerRank | null;
  factory: IWorkerFactory | null;
  job_duties: IJobDuties | null;
  is_resigned: string | null;
  is_indirect: string | null;
  joined_at_factory: string | null;
}

export interface IWorkerDetail {
  pk: number;
  company_id: string | null;
  name: string;
  nick_name: string | null;
  avatar: string | null;
  gender: string | null;
  bio: string | null;
  birthdate: string | null;
  age: number | null;
  nationality: number | null;
  nationality_detail: IWorkerCountry | null;
  start_career_date: string | null;
  experience_career: string | null;
  pervieous_company: string | null;
  joined_at_company: string | null;
  experience_at_company: string | null;
  joined_at_factory: string | null;
  experience_at_factory: string | null;
  is_resigned: string | null;
  resigned_date: string | null;
  is_indirect: string | null;
  factory: number | null;
  factory_detail: IWorkerFactory | null;
  department: number | null;
  department_detail: IWorkerDept | null;
  section: number | null;
  section_detail: IWorkerSection | null;
  line: number | null;
  line_detail: IWorkerLine | null;
  position: number | null;
  position_detail: IWorkerPosition | null;
  rank: number | null;
  rank_detail: IWorkerRank | null;
  team: number | null;
  team_detail: IWorkerTeam | null;
  job_title: string | null;
  job_description: string | null;
  job_duties: number | null;
  job_duties_detail: IJobDuties | null;
  remark: string | null;
  created_at: string;
  updated_at: string;
}

export interface IWorkerListResponse {
  results: IWorkerListItem[];
  current_page: number;
  total_pages: number;
  total_results: number;
}

export const getWorkers = async (params?: { search?: string; page?: number }): Promise<IWorkerListResponse> => {
  const response = await instance.get("workers/", { params });
  return response.data as IWorkerListResponse;
};

export const getWorkerDetail = async (pk: number): Promise<IWorkerDetail> => {
  const response = await instance.get(`workers/${pk}`);
  return response.data as IWorkerDetail;
};

export const editWorker = (pk: number, data: Partial<IWorkerDetail>) =>
  instance.put(`workers/${pk}`, data, { headers: { "X-CSRFToken": Cookies.get("csrftoken") || "" } }).then((r) => r.data);

export const deleteWorker = (pk: number) =>
  instance.delete(`workers/${pk}`, { headers: { "X-CSRFToken": Cookies.get("csrftoken") || "" } });

export const createWorker = (data: { name: string; company_id?: string; nick_name?: string; avatar?: string }) =>
  instance.post("workers/", data, { headers: { "X-CSRFToken": Cookies.get("csrftoken") || "" } }).then((r) => r.data);

export const getJobDuties = async (): Promise<IJobDuties[]> => {
  const response = await instance.get("workers/job-duties/");
  return response.data as IJobDuties[];
};

export const getWorkerDepartments = async (): Promise<IWorkerDept[]> =>
  instance.get("workers/meta/departments/").then((r) => r.data);
export const getWorkerSections = async (): Promise<IWorkerSection[]> =>
  instance.get("workers/meta/sections/").then((r) => r.data);
export const getWorkerPositions = async (): Promise<IWorkerPosition[]> =>
  instance.get("workers/meta/positions/").then((r) => r.data);
export const getWorkerRanks = async (): Promise<IWorkerRank[]> =>
  instance.get("workers/meta/ranks/").then((r) => r.data);
export const getWorkerTeams = async (): Promise<IWorkerTeam[]> =>
  instance.get("workers/meta/teams/").then((r) => r.data);
export const getWorkerFactories = async (): Promise<IWorkerFactory[]> =>
  instance.get("workers/meta/factories/").then((r) => r.data);
export const getWorkerCountries = async (): Promise<IWorkerCountry[]> =>
  instance.get("workers/meta/countries/").then((r) => r.data);
export const getWorkerLines = async (): Promise<IWorkerLine[]> =>
  instance.get("workers/meta/lines/").then((r) => r.data);
export const getWorkerMe = async (): Promise<IWorkerDetail> =>
  instance.get("workers/me/").then((r) => r.data);

// ── Production Process ──────────────────────────────────────

export interface IProcessVideo {
  pk: number;
  VideoFile: string;
  ThumbnailFile: string | null;
  description: string;
}

export interface IProcess {
  pk: number;
  module: number | { pk: number; code: string; name: string };
  module_code?: string;
  module_name?: string;
  sj_no_value?: string | null;
  sj_no_pk?: number | null;
  code: string;
  name: string;
  name_ko: string;
  name_en: string;
  description: string;
  flow: string;
  standard_work_video_url: string;
  cycle_time: string | null;
  target_qty_per_hour: number | null;
  daily_target_qty_8h: number | null;
  machine?: number | null;
  machine_pk?: number | null;
  machine_name?: string | null;
  photos?: IMachinePhoto[];
  videos?: IProcessVideo[];
  created_at: string;
  updated_at: string;
}

export interface IProcessListResponse {
  results: IProcess[];
  current_page: number;
  total_pages: number;
  total_results: number;
}

export interface IModuleCategoryDetail {
  pk: number;
  name: string;
  name_ko: string;
  name_vi?: string;
  applies_to: string;
  parent: {
    pk: number;
    name: string;
    name_ko: string;
    name_vi?: string;
    slug: string | null;
  } | null;
}

export interface IModule {
  pk: number;
  sj_no: number | { pk: number; sj_no: string };
  sj_no_value: string | null;
  sj_no_pk?: number | null;
  module_category?: number | null;
  category_detail?: IModuleCategoryDetail | null;
  module_category_name?: string;
  code: string;
  name: string;
  cycle_time?: string | null;
  target_qty_per_hour?: number | null;
  daily_target_qty_8h?: number | null;
  process_count?: number;
  thumbnail?: string | null;
  photos?: IMachinePhoto[];
  processes?: IProcess[];
  created_at: string;
  updated_at: string;
}

/** SJ Module 대·소분류 (Cutting / Preparation / …) */
export interface IModuleCategory {
  pk: number;
  parent: number | null;
  parent_name: string | null;
  name: string;
  name_ko: string;
  name_vi?: string;
  slug: string | null;
  sort_order: number;
  applies_to: string;
  children_count: number;
  created_at: string;
  updated_at: string;
}

export interface IModuleListResponse {
  results: IModule[];
  current_page: number;
  total_pages: number;
  total_results: number;
}

export const getModules = async ({
  search = "",
  page = 1,
  sj_no,
}: {
  search?: string;
  page?: number;
  sj_no?: number;
}): Promise<IModuleListResponse> => {
  const params: Record<string, any> = { page };
  if (search) params.search = search;
  if (sj_no) params.sj_no = sj_no;
  return instance.get("production-process/modules/", { params }).then((r) => r.data);
};

export const getModuleDetail = async (pk: number): Promise<IModule> =>
  instance.get(`production-process/modules/${pk}/`).then((r) => r.data);

export const createModule = async (data: {
  code: string;
  name?: string;
  sj_no?: number | null;
  module_category: number;
}): Promise<IModule> =>
  instance.post("production-process/modules/", data).then((r) => r.data);

export const editModule = async (
  pk: number,
  data: { code?: string; name?: string; sj_no?: number | null; module_category?: number | null; cycle_time?: string | number | null }
): Promise<IModule> =>
  instance.put(`production-process/modules/${pk}/`, data).then((r) => r.data);

export const getModuleCategories = (params?: {
  parent?: string | number | null;
  applies_to?: string;
}): Promise<IModuleCategory[]> => {
  const p: Record<string, string> = {};
  if (params?.parent !== undefined) {
    if (params.parent === null) p.parent = "null";
    else p.parent = String(params.parent);
  }
  if (params?.applies_to) p.applies_to = params.applies_to;
  return instance.get("production-process/module-categories/", { params: p }).then((r) => r.data);
};

export const createModuleCategory = (data: {
  parent?: number | null;
  name: string;
  name_ko?: string;
  name_vi?: string;
  slug?: string | null;
  sort_order?: number;
  applies_to?: string;
}): Promise<IModuleCategory> =>
  instance
    .post("production-process/module-categories/", data, {
      headers: { "X-CSRFToken": Cookies.get("csrftoken") || "" },
    })
    .then((r) => r.data);

export const updateModuleCategory = (
  pk: number,
  data: Partial<{
    parent: number | null;
    name: string;
    name_ko: string;
    name_vi: string;
    slug: string | null;
    sort_order: number;
    applies_to: string;
  }>
): Promise<IModuleCategory> =>
  instance
    .put(`production-process/module-categories/${pk}/`, data, {
      headers: { "X-CSRFToken": Cookies.get("csrftoken") || "" },
    })
    .then((r) => r.data);

export const deleteModuleCategory = (pk: number): Promise<void> =>
  instance
    .delete(`production-process/module-categories/${pk}/`, {
      headers: { "X-CSRFToken": Cookies.get("csrftoken") || "" },
    })
    .then((r) => r.data);

export const deleteModule = async (pk: number): Promise<void> =>
  instance.delete(`production-process/modules/${pk}/`).then((r) => r.data);

/** SJ 생산 라인 (Factory 하위) — EP Schedule 등 선택 UI */
export interface IProductionLine {
  pk: number;
  name: string;
  name_ko: string;
  factory: number;
  factory_name: string;
}

export const getProductionLines = (): Promise<IProductionLine[]> =>
  instance.get("production-process/production-lines/").then((r) => r.data);

export const getProcesses = async ({
  search = "",
  page = 1,
  module,
  sj_no,
}: {
  search?: string;
  page?: number;
  module?: number;
  sj_no?: number;
}): Promise<IProcessListResponse> => {
  const params: Record<string, any> = { page };
  if (search) params.search = search;
  if (module) params.module = module;
  if (sj_no) params.sj_no = sj_no;
  return instance.get("production-process/processes/", { params }).then((r) => r.data);
};

export const getProcessDetail = async (pk: number): Promise<IProcess> =>
  instance.get(`production-process/processes/${pk}/`).then((r) => r.data);

export const editProcess = async (
  pk: number,
  data: {
    module?: number;
    machine?: number | null;
    code?: string;
    name?: string;
    name_ko?: string;
    name_en?: string;
    description?: string;
    flow?: string;
    standard_work_video_url?: string;
    cycle_time?: number | null;
  }
): Promise<IProcess> =>
  instance.put(`production-process/processes/${pk}/`, data).then((r) => r.data);

export const deleteProcess = async (pk: number): Promise<void> =>
  instance.delete(`production-process/processes/${pk}/`).then((r) => r.data);

export const createProcess = async (data: {
  module: number;
  code: string;
  name?: string;
  name_ko?: string;
  name_en?: string;
  description?: string;
  flow?: string;
  standard_work_video_url?: string;
  cycle_time?: number | null;
}): Promise<IProcess> =>
  instance.post("production-process/processes/", data).then((r) => r.data);

// ── Machines ─────────────────────────────────────────────────

export interface IMachinePhoto {
  pk: number;
  file: string;
  description: string;
}

export interface IMachine {
  pk: number;
  code: string;
  name: string;
  model_number: string;
  serial_number: string;
  machine_type: string;
  category: string;
  location: string;
  description: string;
  manufacturer: string;
  supplier: string;
  purchase_date: string | null;
  machine_iot_id: string;
  model_3d_url: string;
  thumbnail?: string | null;
  photos?: IMachinePhoto[];
  created_at: string;
  updated_at: string;
}

export interface IMachineListResponse {
  results: IMachine[];
  current_page: number;
  total_pages: number;
  total_results: number;
}

export const getMachines = async ({
  search = "",
  page = 1,
}: {
  search?: string;
  page?: number;
}): Promise<IMachineListResponse> => {
  const params: Record<string, any> = { page };
  if (search) params.search = search;
  return instance.get("machines/machines/", { params }).then((r) => r.data);
};

export const getMachineDetail = async (pk: number): Promise<IMachine> =>
  instance.get(`machines/machines/${pk}/`).then((r) => r.data);

export const createMachine = async (data: {
  code: string;
  name: string;
  model_number?: string;
  serial_number?: string;
  machine_type?: string;
  category?: string;
  location?: string;
  description?: string;
  manufacturer?: string;
  supplier?: string;
  purchase_date?: string | null;
  model_3d_url?: string;
}): Promise<IMachine> =>
  instance.post("machines/machines/", data).then((r) => r.data);

export const editMachine = async (
  pk: number,
  data: Partial<{
    code: string;
    name: string;
    model_number: string;
    serial_number: string;
    machine_type: string;
    category: string;
    location: string;
    description: string;
    manufacturer: string;
    supplier: string;
    purchase_date: string | null;
    machine_iot_id: string;
    model_3d_url: string;
  }>
): Promise<IMachine> =>
  instance.put(`machines/machines/${pk}/`, data).then((r) => r.data);

export const uploadMachine3DModel = async ({
  machinePk,
  file,
}: {
  machinePk: number;
  file: File;
}): Promise<IMachine> => {
  const formData = new FormData();
  formData.append("model_3d", file);
  // Content-Type은 axios가 자동으로 boundary 포함해서 설정
  return instance
    .post(`machines/machines/${machinePk}/upload-3d/`, formData)
    .then((r) => r.data);
};

export const deleteMachine3DModel = async (machinePk: number): Promise<IMachine> =>
  instance.delete(`machines/machines/${machinePk}/upload-3d/`).then((r) => r.data);

export const deleteMachine = async (pk: number): Promise<void> =>
  instance.delete(`machines/machines/${pk}/`).then((r) => r.data);

export const createMachinePhoto = ({
  file,
  machinePk,
  description = "",
}: {
  file: string;
  machinePk: number;
  description?: string;
}) =>
  instance
    .post(
      `machines/machines/${machinePk}/photos/`,
      { file, description },
      { headers: { "X-CSRFToken": Cookies.get("csrftoken") || "" } }
    )
    .then((r) => r.data);

export const deleteMachinePhoto = ({
  machinePk,
  photoPk,
}: {
  machinePk: number;
  photoPk: number;
}) =>
  instance
    .delete(`machines/machines/${machinePk}/photos/${photoPk}/`, {
      headers: { "X-CSRFToken": Cookies.get("csrftoken") || "" },
    })
    .then((r) => r.data);

// ── Module Photos ──────────────────────────────────────────────
export const createModulePhoto = ({
  file,
  modulePk,
  description = "",
}: {
  file: string;
  modulePk: number;
  description?: string;
}) =>
  instance
    .post(
      `production-process/modules/${modulePk}/photos/`,
      { file, description, module: modulePk },
      { headers: { "X-CSRFToken": Cookies.get("csrftoken") || "" } }
    )
    .then((r) => r.data);

export const deleteModulePhoto = ({
  modulePk,
  photoPk,
}: {
  modulePk: number;
  photoPk: number;
}) =>
  instance
    .delete(`production-process/modules/${modulePk}/photos/${photoPk}/`, {
      headers: { "X-CSRFToken": Cookies.get("csrftoken") || "" },
    })
    .then((r) => r.data);

// ── Process Photos ─────────────────────────────────────────────
export const createProcessPhoto = ({
  file,
  processPk,
  description = "",
}: {
  file: string;
  processPk: number;
  description?: string;
}) =>
  instance
    .post(
      `production-process/processes/${processPk}/photos/`,
      { file, description, process: processPk },
      { headers: { "X-CSRFToken": Cookies.get("csrftoken") || "" } }
    )
    .then((r) => r.data);

export const deleteProcessPhoto = ({
  processPk,
  photoPk,
}: {
  processPk: number;
  photoPk: number;
}) =>
  instance
    .delete(`production-process/processes/${processPk}/photos/${photoPk}/`, {
      headers: { "X-CSRFToken": Cookies.get("csrftoken") || "" },
    })
    .then((r) => r.data);

// ── Process Videos ─────────────────────────────────────────────
export const createProcessVideo = ({
  VideoFile,
  ThumbnailFile = "",
  processPk,
  description = "",
}: {
  VideoFile: string;
  ThumbnailFile?: string;
  processPk: number;
  description?: string;
}) =>
  instance
    .post(
      `production-process/processes/${processPk}/videos/`,
      { VideoFile, ThumbnailFile, description, process: processPk },
      { headers: { "X-CSRFToken": Cookies.get("csrftoken") || "" } }
    )
    .then((r) => r.data);

export const deleteProcessVideo = ({
  processPk,
  videoPk,
}: {
  processPk: number;
  videoPk: number;
}) =>
  instance
    .delete(`production-process/processes/${processPk}/videos/${videoPk}/`, {
      headers: { "X-CSRFToken": Cookies.get("csrftoken") || "" },
    })
    .then((r) => r.data);

// ── EP Production ───────────────────────────────────────────────
export interface IEpProcessCopy {
  pk: number;
  code: string;
  name: string;
  name_ko: string;
  name_en: string;
  description: string;
  flow: string;
  machine?: number | null;
  machine_name?: string | null;
  standard_work_video_url?: string;
  cycle_time?: string | null;
  output_qty?: number | null;
  /** 일별 실적이 있으면 output_qty는 합계로만 관리 (인라인 수정 불가) */
  output_qty_locked?: boolean;
  total_qty?: number | null;
  status?: string;
  status_display?: string;
  target_qty_per_hour?: number | null;
  daily_target_qty_8h?: number | null;
  process_start_date?: string | null;
  process_finish_date?: string | null;
  process_lead_time_days?: number | null;
  /** EP 검사 기록 불량 수량 합계 (해당 공정 기준) */
  total_defect_qty?: number;
  override_fields?: string[];
  is_deleted?: boolean;
}

export interface IEpModuleCopy {
  pk: number;
  code: string;
  name: string;
  /** 상위 모듈 카테고리 (EN/KO/VI) */
  module_category_name?: string | null;
  module_category_name_ko?: string | null;
  module_category_name_vi?: string | null;
  module_sub_category_name?: string | null;
  module_sub_category_name_ko?: string | null;
  module_sub_category_name_vi?: string | null;
  output_qty?: number | null;
  total_qty?: number | null;
  status?: string;
  status_display?: string;
  process_start_date?: string | null;
  process_finish_date?: string | null;
  process_lead_time_days?: number | null;
  cycle_time?: string | null;
  target_qty_per_hour?: number | null;
  daily_target_qty_8h?: number | null;
  /** EP 검사 기록 불량 수량 합계 (해당 모듈 기준) */
  total_defect_qty?: number;
  override_fields?: string[];
  is_deleted?: boolean;
  ep_processes: IEpProcessCopy[];
}

export interface IEpSjNoCopy {
  pk: number;
  sj_no: string;
  output_qty?: number | null;
  total_qty?: number | null;
  /** VL 공장 배정 수량. 설정 시 목표·잔량 기준으로 사용 (total_qty 대신). */
  vl_qty?: number | null;
  /** 나머지 수량을 생산하는 외부 공장명 (예: BD, SJBD) */
  outsource_factory?: string | null;
  /** 외부 공장 배정 수량 */
  outsource_qty?: number | null;
  status?: string;
  status_display?: string;
  cycle_time?: string | null;
  target_qty_per_hour?: number | null;
  daily_target_qty_8h?: number | null;
  /** EP 검사 기록 불량 수량 합계 (해당 SJ No 기준) */
  total_defect_qty?: number;
  override_fields?: string[];
  is_deleted?: boolean;
  ep_modules: IEpModuleCopy[];
  /** 원본 SJ No에 연결된 스타일 썸네일 (백엔드 serializer에서 제공) */
  sj_style_thumbnail?: string | null;
  /** 원본 SJ No에 연결된 스타일명 */
  sj_style_name?: string | null;
  /** 원본 SJ No에 연결된 스타일 코드 */
  sj_style_code?: string | null;
}

// Legacy interfaces kept for sj_order_info.sj_no.modules (read-only reference)
export interface IEpProcess {
  pk: number;
  code: string;
  name: string;
  name_ko: string;
  name_en: string;
  description: string;
  flow: string;
  machine?: number | null;
  machine_name?: string | null;
  standard_work_video_url?: string;
  cycle_time?: string | null;
  target_qty_per_hour?: number | null;
  daily_target_qty_8h?: number | null;
  created_at?: string;
  updated_at?: string;
}

export interface IEpModule {
  pk: number;
  code: string;
  name: string;
  thumbnail?: string | null;
  created_at?: string;
  updated_at?: string;
  processes: IEpProcess[];
}

export interface ISjOrderInfo {
  pk: number;
  sj_po_number: string;
  order_date: string;
  ex_factory_date?: string | null;
  destination?: string;
  buyer_name?: { pk: number; code: string; name: string } | null;
  sj_no?: { pk: number; sj_no: string; modules: IEpModule[] } | null;
  sj_style?: { pk: number; code: string; style_name: string; thumbnail?: string | null } | null;
  style_name?: string | null;
  color?: string;
  size?: string;
  order_qty?: number;
  sample_qty?: number;
  total_order_qty?: number;
  po_type?: { pk: number; code: string; name: string } | null;
  /** 신규 — 수출 국가 */
  ex_country?: string | null;
  /** 신규 — 운송 수단 (By Air / By Vessel) */
  air_or_vessel?: string | null;
  /** 신규 — 오더 날짜 (po_date, 참고용) */
  po_date?: string | null;
  /** 신규 — 신규/리피트 구분 */
  newness_or_repeat?: string | null;
  /** 신규 — 공임 단가 (CMT 단가) */
  gong_in?: string | null;
  /** 신규 — 공임 총액 */
  total_cmt?: string | null;
  /** 신규 — 실제 공임 지급액 */
  actual_cmt?: string | null;
  /** 신규 — FOB 단가 */
  unit_fob?: string | null;
  /** 신규 — FOB 총액 */
  total_fob?: string | null;
  /** 신규 — 실제 FOB */
  actual_fob?: string | null;
}

export interface IEpSchedule {
  pk: number;
  sj_order: number;
  sj_order_info?: ISjOrderInfo | null;
  ep_sj_nos?: IEpSjNoCopy[];
  production_line?: number | null;
  production_line_name?: string | null;
  status: string;
  status_display: string;
  output_qty?: number | null;
  process_start_date?: string | null;
  process_finish_date?: string | null;
  process_lead_time_days?: number | null;
  process_sundays_excluded_count?: number;
  /** 일요일 안내와 겹치지 않게, 일요일이 아닌 등록 공휴일 일수(백엔드 plan_holidays 연동 시). */
  process_plan_holidays_excluded_count?: number;
  production_assembly_start_date?: string | null;
  production_assembly_finish_date?: string | null;
  production_assembly_output_qty?: number | null;
  production_assembly_lead_time?: number | null;
  production_assembly_sundays_excluded_count?: number;
  production_assembly_plan_holidays_excluded_count?: number;
  due_inbound_date_prep_material?: string | null;
  expected_prep_material_inbound_date?: string | null;
  actual_inbound_prep_material_qty?: number | null;
  remark?: string;
  /** 신규 — 2차 출고일 */
  ex_factory_2nd?: string | null;
  /** 신규 — 재단 시작일 */
  cutting_start_date?: string | null;
  /** 신규 — Trim + Laser 진행 상황 */
  vien_laser?: string | null;
  /** 신규 — Printing / Folding 진행 상황 */
  printing_folding?: string | null;
  /** 신규 — SUB TG 진행 상황 */
  sub_tg?: string | null;
  /** 신규 — SUB VL 진행 상황 */
  sub_vl?: string | null;
  /** 신규 — Pre 공정 진행 상황 */
  pre?: string | null;
  /** 신규 — SCOM 진행 상황 */
  scom?: string | null;
  /** 신규 — Expected Date / Finished */
  expected_date_finished?: string | null;
  /** 신규 — KEEP 여부/내용 */
  keep?: string | null;
  /** 신규 — 문제점 여부/내용 */
  issue_or_not?: string | null;
  /** 신규 — 최종 완료 여부/날짜 */
  final?: string | null;
  /** 신규 — 잔량 예상 완료일 */
  balance_expected_finish_date?: string | null;
  ex_factory_date?: string | null;
  /** 스케줄 생성 시 선택한 ModuleCategory PK 목록(저장됨) */
  module_category_selection?: number[] | null;
  created_at?: string;
  updated_at?: string;
}

export const getEpSchedules = ({
  search = "",
  year,
  month,
  sj_order,
}: {
  search?: string;
  year?: number;
  month?: number;
  /** SJ Order PK — EP 스케줄을 정확히 한 오더로 한정 (PO 중복 구분용) */
  sj_order?: number;
} = {}) => {
  const params = new URLSearchParams();
  if (search) params.set("search", search);
  if (year != null) params.set("year", String(year));
  if (month != null) params.set("month", String(month));
  if (sj_order != null) params.set("sj_order", String(sj_order));
  return instance
    .get(`ep-production/schedules/?${params.toString()}`)
    .then((r) => r.data as IEpSchedule[]);
};

export interface ISjOrderSearchResult {
  pk: number;
  sj_po_number: string;
  sj_no_value: string | null;
  sj_style_code?: string | null;
  style_name: string | null;
  has_vl_schedule?: boolean;
  vl_schedules?: { pk: number; line: string | null; start: string | null; finish: string | null }[];
  color: string | null;
  total_order_qty: number | null;
  ex_factory_date: string | null;
  buyer_name: { pk: number; code: string; name: string } | null;
}

export const searchSjOrders = (query: string) =>
  instance
    .get(`sj-orders/?search=${encodeURIComponent(query)}&page=1&page_size=100`)
    .then((r) => r.data.results as ISjOrderSearchResult[]);

export const getEpScheduleDetail = (pk: number) =>
  instance
    .get(`ep-production/schedules/${pk}/`)
    .then((r) => r.data as IEpSchedule);

export const getEpColumnPreference = () =>
  instance
    .get("ep-production/column-preferences/")
    .then((r) => r.data as { visible_columns: string[] });

export const saveEpColumnPreference = (visible_columns: string[]) =>
  instance.put(
    "ep-production/column-preferences/",
    { visible_columns },
    { headers: { "X-CSRFToken": Cookies.get("csrftoken") || "" } }
  );

export const createEpSchedule = (
  data: Partial<IEpSchedule> & {
    ex_factory_date?: string | null;
    /** 딥카피에 포함할 분류(ModuleCategory PK). 하위 분류는 서버에서 자동 확장 */
    module_category_ids: number[];
  }
) =>
  instance
    .post("ep-production/schedules/", data, {
      headers: { "X-CSRFToken": Cookies.get("csrftoken") || "" },
    })
    .then((r) => r.data as IEpSchedule);

export const editEpSchedule = (pk: number, data: Partial<IEpSchedule>) =>
  instance
    .patch(`ep-production/schedules/${pk}/`, data, {
      headers: { "X-CSRFToken": Cookies.get("csrftoken") || "" },
    })
    .then((r) => r.data as IEpSchedule);

export const deleteEpSchedule = (pk: number) =>
  instance
    .delete(`ep-production/schedules/${pk}/`, {
      headers: { "X-CSRFToken": Cookies.get("csrftoken") || "" },
    })
    .then((r) => r.data);

export const patchEpSjNo = (pk: number, data: Partial<IEpSjNoCopy>) =>
  instance
    .patch(`ep-production/sj-nos/${pk}/`, data, {
      headers: { "X-CSRFToken": Cookies.get("csrftoken") || "" },
    })
    .then((r) => r.data as IEpSjNoCopy);

export const patchEpModule = (pk: number, data: Partial<IEpModuleCopy>) =>
  instance
    .patch(`ep-production/modules/${pk}/`, data, {
      headers: { "X-CSRFToken": Cookies.get("csrftoken") || "" },
    })
    .then((r) => r.data as IEpModuleCopy);

export const patchEpProcess = (pk: number, data: Partial<IEpProcessCopy>) =>
  instance
    .patch(`ep-production/processes/${pk}/`, data, {
      headers: { "X-CSRFToken": Cookies.get("csrftoken") || "" },
    })
    .then((r) => r.data as IEpProcessCopy);

// ── EP soft-delete ─────────────────────────────────────────────────
export const deleteEpSjNo = (pk: number) =>
  instance.delete(`ep-production/sj-nos/${pk}/`, {
    headers: { "X-CSRFToken": Cookies.get("csrftoken") || "" },
  });

export const deleteEpModule = (pk: number) =>
  instance.delete(`ep-production/modules/${pk}/`, {
    headers: { "X-CSRFToken": Cookies.get("csrftoken") || "" },
  });

export const deleteEpProcess = (pk: number) =>
  instance.delete(`ep-production/processes/${pk}/`, {
    headers: { "X-CSRFToken": Cookies.get("csrftoken") || "" },
  });

// ── EP sync from source ────────────────────────────────────────────
export type EpProcessesSyncSummary = {
  created: number;
  updated: number;
  deleted: number;
  reactivated: number;
};

export type EpModuleSyncCascade = {
  module_pk: number;
  updated_fields: string[];
  processes_sync: EpProcessesSyncSummary;
};

export const syncEpSjNoFromSource = (pk: number, reset_fields?: string[]) =>
  instance
    .post(`ep-production/sj-nos/${pk}/sync-source/`, reset_fields ? { reset_fields } : {}, {
      headers: { "X-CSRFToken": Cookies.get("csrftoken") || "" },
    })
    .then(
      (r) =>
        r.data as IEpSjNoDetail & {
          updated_fields: string[];
          modules_sync: EpModuleSyncCascade[];
        }
    );

export const syncEpModuleFromSource = (pk: number, reset_fields?: string[]) =>
  instance
    .post(`ep-production/modules/${pk}/sync-source/`, reset_fields ? { reset_fields } : {}, {
      headers: { "X-CSRFToken": Cookies.get("csrftoken") || "" },
    })
    .then(
      (r) =>
        r.data as IEpModuleDetail & {
          updated_fields: string[];
          processes_sync: EpProcessesSyncSummary;
        }
    );

export const syncEpProcessFromSource = (pk: number, reset_fields?: string[]) =>
  instance
    .post(`ep-production/processes/${pk}/sync-source/`, reset_fields ? { reset_fields } : {}, {
      headers: { "X-CSRFToken": Cookies.get("csrftoken") || "" },
    })
    .then(
      (r) =>
        r.data as IEpProcessDetail & {
          updated_fields: string[];
          processes_sync: EpProcessesSyncSummary;
          synced_via_parent_module?: boolean;
        }
    );

// ── EP Detail interfaces (with source info) ────────────────────────

export interface IEpProcessDetail extends IEpProcessCopy {
  source_process_info: { pk: number; code: string; name: string } | null;
  ep_module_pk: number;
  ep_module_code: string;
  ep_sj_no_pk: number;
  ep_schedule_pk: number;
  deleted_at?: string | null;
}

export interface IEpModuleDetail extends Omit<IEpModuleCopy, "ep_processes"> {
  source_module_info: { pk: number; code: string; name: string } | null;
  ep_sj_no_pk: number;
  ep_sj_no_sj_no: string;
  deleted_at?: string | null;
  ep_processes: IEpProcessDetail[];
}

export interface IEpSjNoDetail extends Omit<IEpSjNoCopy, "ep_modules"> {
  source_sj_no_info: { pk: number; sj_no: string } | null;
  ep_schedule_pk: number;
  deleted_at?: string | null;
  ep_modules: IEpModuleDetail[];
}

export const getEpSjNoDetail = (pk: number) =>
  instance.get(`ep-production/sj-nos/${pk}/`).then((r) => r.data as IEpSjNoDetail);

export const getEpModuleDetail = (pk: number) =>
  instance.get(`ep-production/modules/${pk}/`).then((r) => r.data as IEpModuleDetail);

export const getEpProcessDetail = (pk: number) =>
  instance.get(`ep-production/processes/${pk}/`).then((r) => r.data as IEpProcessDetail);

// ── EP Production Daily Output (per-process quantity entries) ────────────────

export interface IEpProductionDailyOutput {
  pk: number;
  ep_process: number;
  /** 동일 공정 일별 레코드 qty 합계로 반영된 EpProcess.output_qty */
  ep_process_output_qty?: number | null;
  /** 공정 Total Qty (상한 기준); null이면 상한 미설정 */
  ep_process_total_qty?: number | null;
  /** 이 행 저장 직후 당시 공정 누적(합); 이후 다른 실적 변경 시에도 당시 값 유지 */
  process_cumulative_snapshot?: number | null;
  ep_process_code: string;
  ep_module_code: string;
  ep_sj_no: string;
  ep_schedule_pk: number;
  sj_po_number: string;
  qty: number;
  recorded_at: string;
  remark: string;
  recorded_by: number | null;
  recorded_by_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface IEpProductionDailyOutputListResponse {
  results: IEpProductionDailyOutput[];
  current_page: number;
  total_pages: number;
  total_results: number;
}

export const getEpProductionDailyOutputs = (params?: {
  schedule?: number;
  ep_process?: number;
  date_from?: string;
  date_to?: string;
  /** Free text: PO, SJ No, module/process codes & names, style, remark, user, etc. */
  search?: string;
  /** 1-based page index */
  page?: number;
  /** page size (default 20, max 100 on server) */
  page_size?: number;
}) => {
  const q = new URLSearchParams();
  if (params?.schedule != null) q.set("schedule", String(params.schedule));
  if (params?.ep_process != null) q.set("ep_process", String(params.ep_process));
  if (params?.date_from) q.set("date_from", params.date_from);
  if (params?.date_to) q.set("date_to", params.date_to);
  if (params?.search?.trim()) q.set("search", params.search.trim());
  if (params?.page != null) q.set("page", String(params.page));
  if (params?.page_size != null) q.set("page_size", String(params.page_size));
  const qs = q.toString();
  return instance
    .get(`ep-production/daily-outputs/${qs ? `?${qs}` : ""}`)
    .then((r) => r.data as IEpProductionDailyOutputListResponse);
};

export const createEpProductionDailyOutput = (data: {
  ep_process: number;
  qty: number;
  recorded_at?: string;
  remark?: string;
}) =>
  instance
    .post("ep-production/daily-outputs/", data, {
      headers: { "X-CSRFToken": Cookies.get("csrftoken") || "" },
    })
    .then((r) => r.data as IEpProductionDailyOutput);

export const getEpProductionDailyOutput = (pk: number) =>
  instance
    .get(`ep-production/daily-outputs/${pk}/`)
    .then((r) => r.data as IEpProductionDailyOutput);

export const patchEpProductionDailyOutput = (
  pk: number,
  data: Partial<Pick<IEpProductionDailyOutput, "qty" | "recorded_at" | "remark">>
) =>
  instance
    .patch(`ep-production/daily-outputs/${pk}/`, data, {
      headers: { "X-CSRFToken": Cookies.get("csrftoken") || "" },
    })
    .then((r) => r.data as IEpProductionDailyOutput);

export const deleteEpProductionDailyOutput = (pk: number) =>
  instance.delete(`ep-production/daily-outputs/${pk}/`, {
    headers: { "X-CSRFToken": Cookies.get("csrftoken") || "" },
  });

// ── EP QC Inspections (sj_inspections) ─────────────────────────────────────

export interface IDefectCategory {
  id: number;
  code: string;
  name_ko: string;
  name_en: string;
  name_vi: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export const getDefectCategories = (params?: { include_inactive?: boolean }) => {
  const q = new URLSearchParams();
  if (params?.include_inactive) q.set("include_inactive", "1");
  const qs = q.toString();
  return instance
    .get(`sj-inspections/defect-categories/${qs ? `?${qs}` : ""}`)
    .then((r) => r.data as IDefectCategory[]);
};

export const createDefectCategory = (data: {
  code: string;
  name_ko?: string;
  name_en?: string;
  name_vi?: string;
  sort_order?: number;
  is_active?: boolean;
}) =>
  instance
    .post("sj-inspections/defect-categories/", data, {
      headers: { "X-CSRFToken": Cookies.get("csrftoken") || "" },
    })
    .then((r) => r.data as IDefectCategory);

export const patchDefectCategory = (pk: number, data: Partial<IDefectCategory>) =>
  instance
    .patch(`sj-inspections/defect-categories/${pk}/`, data, {
      headers: { "X-CSRFToken": Cookies.get("csrftoken") || "" },
    })
    .then((r) => r.data as IDefectCategory);

export const deleteDefectCategory = (pk: number) =>
  instance.delete(`sj-inspections/defect-categories/${pk}/`, {
    headers: { "X-CSRFToken": Cookies.get("csrftoken") || "" },
  });

export interface IEpInspectionListRow {
  id: number;
  target_kind:
    | "ep_process"
    | "ep_module"
    | "ep_sj_no"
    | "vl_process"
    | "vl_module"
    | "vl_sj_no"
    /** @deprecated 서버가 ep_* / vl_* 로 통일하기 전 값 */
    | "process"
    | "module"
    | "sj_no";
  target_label: string;
  inspected_qty: number;
  defect_qty: number;
  defect_category: Pick<
    IDefectCategory,
    "id" | "code" | "name_ko" | "name_en" | "name_vi" | "is_active" | "sort_order"
  > | null;
  inspected_at: string;
  created_at: string;
}

export interface IEpInspectionUserBrief {
  id: number;
  username: string;
  display_name: string;
}

/** 검사 범위 공정에 대한 생산 실적(EpProductionDailyOutput) 행 (상세 API, 최근 N건) */
export interface IEpProcessOutputRecord {
  id: number;
  system?: "ep" | "vl";
  ep_process_id?: number;
  ep_process_code?: string;
  ep_process_name?: string;
  vl_assembly_process_id?: number;
  vl_assembly_process_code?: string;
  vl_assembly_process_name?: string;
  qty: number;
  recorded_at: string | null;
  remark: string;
  recorded_by: IEpInspectionUserBrief | null;
}

export interface IEpInspectionInspectorWorkerBrief {
  id: number;
  name: string;
  nick_name: string;
}

export interface IEpInspectionDetail extends IEpInspectionListRow {
  ep_process: number | null;
  ep_module: number | null;
  ep_sj_no: number | null;
  vl_assembly_process: number | null;
  vl_assembly_module: number | null;
  vl_assembly_sj_no: number | null;
  description: string;
  photo_image_ids: string[];
  video_stream_uids: string[];
  inspector: number | null;
  inspector_worker: IEpInspectionInspectorWorkerBrief | null;
  created_by: number | null;
  created_by_user: IEpInspectionUserBrief | null;
  /** 검사 범위 EpProcess에 생산 실적을 입력한 계정(일별 실적 recorded_by, 중복 제거) */
  process_output_recording_users: IEpInspectionUserBrief[];
  /** 검사 범위 공정의 생산 실적 행(최근순, 서버에서 건수 제한) */
  process_output_records: IEpProcessOutputRecord[];
  /** 실적이 제한 건수를 넘으면 true (더 많은 행이 있음) */
  process_output_records_truncated: boolean;
  updated_at: string;
}

/** 상세 API가 필드를 생략해도 되도록(구버전/캐시) 받는 타입 */
export type IEpInspectionDetailRaw = Omit<
  IEpInspectionDetail,
  | "process_output_recording_users"
  | "process_output_records"
  | "process_output_records_truncated"
  | "vl_assembly_process"
  | "vl_assembly_module"
  | "vl_assembly_sj_no"
> & {
  process_output_recording_users?: IEpInspectionUserBrief[];
  process_output_records?: IEpProcessOutputRecord[];
  process_output_records_truncated?: boolean;
  vl_assembly_process?: number | null;
  vl_assembly_module?: number | null;
  vl_assembly_sj_no?: number | null;
};

/** 생산 실적 관련 필드 기본값 — 상세 GET/POST/PATCH 응답에 공통 적용 */
export function normalizeEpInspectionDetail(raw: IEpInspectionDetailRaw): IEpInspectionDetail {
  return {
    ...raw,
    vl_assembly_process: raw.vl_assembly_process ?? null,
    vl_assembly_module: raw.vl_assembly_module ?? null,
    vl_assembly_sj_no: raw.vl_assembly_sj_no ?? null,
    process_output_recording_users: raw.process_output_recording_users ?? [],
    process_output_records: raw.process_output_records ?? [],
    process_output_records_truncated: raw.process_output_records_truncated ?? false,
  };
}

export interface IEpInspectionListResponse {
  results: IEpInspectionListRow[];
  current_page: number;
  total_pages: number;
  total_results: number;
}

export const getEpInspections = (params?: {
  ep_process?: number;
  ep_module?: number;
  ep_sj_no?: number;
  /** EP Schedule PK — Daily Output 목록과 동일 */
  schedule?: number;
  /** inspected_at 날짜 하한 (YYYY-MM-DD) */
  date_from?: string;
  /** inspected_at 날짜 상한 (YYYY-MM-DD) */
  date_to?: string;
  search?: string;
  page?: number;
  page_size?: number;
}) => {
  const q = new URLSearchParams();
  if (params?.ep_process != null) q.set("ep_process", String(params.ep_process));
  if (params?.ep_module != null) q.set("ep_module", String(params.ep_module));
  if (params?.ep_sj_no != null) q.set("ep_sj_no", String(params.ep_sj_no));
  if (params?.schedule != null) q.set("schedule", String(params.schedule));
  if (params?.date_from?.trim()) q.set("date_from", params.date_from.trim());
  if (params?.date_to?.trim()) q.set("date_to", params.date_to.trim());
  if (params?.search?.trim()) q.set("search", params.search.trim());
  if (params?.page != null) q.set("page", String(params.page));
  if (params?.page_size != null) q.set("page_size", String(params.page_size));
  const qs = q.toString();
  return instance
    .get(`sj-inspections/inspections/${qs ? `?${qs}` : ""}`)
    .then((r) => r.data as IEpInspectionListResponse);
};

export const getEpInspection = (pk: number) =>
  instance
    .get(`sj-inspections/inspections/${pk}/`)
    .then((r) => normalizeEpInspectionDetail(r.data as IEpInspectionDetailRaw));

export type IEpInspectionWritePayload = {
  ep_process?: number | null;
  ep_module?: number | null;
  ep_sj_no?: number | null;
  vl_assembly_process?: number | null;
  vl_assembly_module?: number | null;
  vl_assembly_sj_no?: number | null;
  inspected_qty: number;
  defect_qty?: number;
  defect_category?: number | null;
  description?: string;
  photo_image_ids?: string[];
  video_stream_uids?: string[];
  inspector?: number | null;
  inspected_at?: string;
};

export const createEpInspection = (data: IEpInspectionWritePayload) =>
  instance
    .post("sj-inspections/inspections/", data, {
      headers: { "X-CSRFToken": Cookies.get("csrftoken") || "" },
    })
    .then((r) => normalizeEpInspectionDetail(r.data as IEpInspectionDetailRaw));

export const patchEpInspection = (pk: number, data: Partial<IEpInspectionWritePayload>) =>
  instance
    .patch(`sj-inspections/inspections/${pk}/`, data, {
      headers: { "X-CSRFToken": Cookies.get("csrftoken") || "" },
    })
    .then((r) => normalizeEpInspectionDetail(r.data as IEpInspectionDetailRaw));

export const deleteEpInspection = (pk: number) =>
  instance.delete(`sj-inspections/inspections/${pk}/`, {
    headers: { "X-CSRFToken": Cookies.get("csrftoken") || "" },
  });

export const getVlAssemblyInspections = (params?: {
  vl_assembly_process?: number;
  vl_assembly_module?: number;
  vl_assembly_sj_no?: number;
  schedule?: number;
  date_from?: string;
  date_to?: string;
  search?: string;
  page?: number;
  page_size?: number;
}) => {
  const q = new URLSearchParams();
  if (params?.vl_assembly_process != null) q.set("vl_assembly_process", String(params.vl_assembly_process));
  if (params?.vl_assembly_module != null) q.set("vl_assembly_module", String(params.vl_assembly_module));
  if (params?.vl_assembly_sj_no != null) q.set("vl_assembly_sj_no", String(params.vl_assembly_sj_no));
  if (params?.schedule != null) q.set("schedule", String(params.schedule));
  if (params?.date_from?.trim()) q.set("date_from", params.date_from.trim());
  if (params?.date_to?.trim()) q.set("date_to", params.date_to.trim());
  if (params?.search?.trim()) q.set("search", params.search.trim());
  if (params?.page != null) q.set("page", String(params.page));
  if (params?.page_size != null) q.set("page_size", String(params.page_size));
  const qs = q.toString();
  return instance
    .get(`vl-assembly-production/inspections/${qs ? `?${qs}` : ""}`)
    .then((r) => r.data as IEpInspectionListResponse);
};

export const getVlAssemblyInspection = (pk: number) =>
  instance
    .get(`vl-assembly-production/inspections/${pk}/`)
    .then((r) => normalizeEpInspectionDetail(r.data as IEpInspectionDetailRaw));

export const createVlAssemblyInspection = (data: IEpInspectionWritePayload) =>
  instance
    .post("vl-assembly-production/inspections/", data, {
      headers: { "X-CSRFToken": Cookies.get("csrftoken") || "" },
    })
    .then((r) => normalizeEpInspectionDetail(r.data as IEpInspectionDetailRaw));

export const patchVlAssemblyInspection = (pk: number, data: Partial<IEpInspectionWritePayload>) =>
  instance
    .patch(`vl-assembly-production/inspections/${pk}/`, data, {
      headers: { "X-CSRFToken": Cookies.get("csrftoken") || "" },
    })
    .then((r) => normalizeEpInspectionDetail(r.data as IEpInspectionDetailRaw));

export const deleteVlAssemblyInspection = (pk: number) =>
  instance.delete(`vl-assembly-production/inspections/${pk}/`, {
    headers: { "X-CSRFToken": Cookies.get("csrftoken") || "" },
  });

// ── EP Daily Output Report ───────────────────────────────────────────────────

export interface IEpDailyOutputReportKpi {
  total_qty_today: number;
  record_count: number;
  active_styles_count: number;
  active_schedules_count: number;
  active_workers_count: number;
  top_worker_name: string | null;
  peak_hour: number | null;
}

export interface IEpDailyOutputReportProcess {
  process_code: string;
  process_name: string;
  qty_today: number;
}

export interface IEpDailyOutputReportStyleRow {
  schedule_pk: number;
  sj_po_number: string;
  style_name: string | null;
  style_code: string | null;
  qty_today: number;
  record_count: number;
  sj_nos: string[];
  worker_names: string[];
  processes: IEpDailyOutputReportProcess[];
}

export interface IEpDailyOutputReportHourlyRow {
  hour: number | null;
  hour_label: string | null;
  qty: number;
  record_count: number;
}

export interface IEpDailyOutputReportWorkerRow {
  worker_name: string;
  qty: number;
  record_count: number;
}

export interface IEpDailyOutputReport {
  report_date: string;
  kpi: IEpDailyOutputReportKpi;
  by_style: IEpDailyOutputReportStyleRow[];
  hourly_breakdown: IEpDailyOutputReportHourlyRow[];
  by_worker: IEpDailyOutputReportWorkerRow[];
}

export const getEpDailyOutputReport = (date?: string) => {
  const qs = date ? `?date=${date}` : "";
  return instance
    .get(`ep-production/daily-output-report/${qs}`)
    .then((r) => r.data as IEpDailyOutputReport);
};

// ── EP Daily Inspection Report ───────────────────────────────────────────────

export interface IEpDailyInspectionReportKpi {
  total_inspected_qty: number;
  total_defect_qty: number;
  defect_rate: number;
  record_count: number;
  active_styles_count: number;
  active_schedules_count: number;
  active_inspectors_count: number;
  peak_hour: number | null;
}

export interface IEpDailyInspectionReportDefectCategory {
  category_code: string;
  category_name_ko: string;
  category_name_en: string;
  category_name_vi: string;
  defect_qty: number;
  record_count: number;
  defect_rate_of_total: number;
}

export interface IEpInspectionPhotoPreview {
  inspection_id: number;
  photo_image_ids: string[];
  defect_category_name_ko: string;
  defect_category_name_en: string;
  defect_category_name_vi: string;
  defect_qty: number;
  inspected_at: string | null;
}

export interface IEpDailyInspectionReportStyleRow {
  schedule_pk: number;
  sj_po_number: string;
  style_name: string | null;
  style_code: string | null;
  inspected_qty: number;
  defect_qty: number;
  defect_rate: number;
  record_count: number;
  sj_nos: string[];
  inspector_names: string[];
  defect_categories: IEpDailyInspectionReportDefectCategory[];
  photo_previews: IEpInspectionPhotoPreview[];
}

export interface IEpDailyInspectionReportInspectorRow {
  inspector_name: string;
  inspected_qty: number;
  defect_qty: number;
  defect_rate: number;
  record_count: number;
}

export interface IEpDailyInspectionReportHourlyRow {
  hour: number | null;
  hour_label: string | null;
  inspected_qty: number;
  defect_qty: number;
  record_count: number;
}

export interface IEpDailyInspectionReport {
  report_date: string;
  kpi: IEpDailyInspectionReportKpi;
  by_style: IEpDailyInspectionReportStyleRow[];
  by_defect_category: IEpDailyInspectionReportDefectCategory[];
  by_inspector: IEpDailyInspectionReportInspectorRow[];
  hourly_breakdown: IEpDailyInspectionReportHourlyRow[];
}

export const getEpDailyInspectionReport = (date?: string) => {
  const qs = date ? `?date=${date}` : "";
  return instance
    .get(`sj-inspections/daily-inspection-report/${qs}`)
    .then((r) => r.data as IEpDailyInspectionReport);
};

// ── VL Assembly Production ─────────────────────────────────────────

export type IVlAssemblyProcessCopy = IEpProcessCopy;
export type IVlAssemblyModuleCopy = IEpModuleCopy;
export type IVlAssemblySjNoCopy = IEpSjNoCopy;
export type IVlAssemblySchedule = Omit<IEpSchedule, "sj_order"> & {
  sj_order?: number | null;
  vl_assembly_sj_nos?: IVlAssemblySjNoCopy[];
};

export type IVlAssemblyProcessDetail = IEpProcessDetail & {
  vl_assembly_module_pk?: number;
  vl_assembly_sj_no_pk?: number;
  vl_assembly_schedule_pk?: number;
};

export type IVlAssemblyModuleDetail = IEpModuleDetail & {
  vl_assembly_sj_no_pk?: number;
  vl_assembly_processes?: IVlAssemblyProcessDetail[];
};

export type IVlAssemblySjNoDetail = IEpSjNoDetail & {
  vl_assembly_schedule_pk?: number;
  vl_assembly_modules?: IVlAssemblyModuleDetail[];
};

export type IVlAssemblyProductionDailyOutput = IEpProductionDailyOutput & {
  vl_assembly_process?: number;
  vl_assembly_process_output_qty?: number | null;
  vl_assembly_process_total_qty?: number | null;
  vl_assembly_process_code?: string;
  vl_assembly_module_code?: string;
  vl_assembly_sj_no?: string;
  vl_assembly_schedule_pk?: number;
};

export type IVlAssemblyProductionDailyOutputListResponse = IEpProductionDailyOutputListResponse;
export type IVlAssemblyDailyOutputReportKpi = IEpDailyOutputReportKpi;
export type IVlAssemblyDailyOutputReportProcess = IEpDailyOutputReportProcess;
export type IVlAssemblyDailyOutputReportStyleRow = IEpDailyOutputReportStyleRow;
export type IVlAssemblyDailyOutputReportHourlyRow = IEpDailyOutputReportHourlyRow;
export type IVlAssemblyDailyOutputReportWorkerRow = IEpDailyOutputReportWorkerRow;
export type IVlAssemblyDailyOutputReport = IEpDailyOutputReport;

export interface IVlAssemblyModuleProductionDailyOutput {
  pk: number;
  vl_assembly_module: number;
  vl_assembly_module_output_qty?: number | null;
  vl_assembly_module_total_qty?: number | null;
  module_cumulative_snapshot?: number | null;
  vl_assembly_module_code: string;
  vl_assembly_sj_no: string;
  vl_assembly_schedule_pk: number;
  sj_po_number: string;
  qty: number;
  recorded_at: string;
  remark: string;
  recorded_by: number | null;
  recorded_by_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface IVlAssemblyModuleProductionDailyOutputListResponse {
  results: IVlAssemblyModuleProductionDailyOutput[];
  current_page: number;
  total_pages: number;
  total_results: number;
}

export interface IVlAssemblyModuleDailyOutputReportModuleRow {
  module_code: string;
  module_name: string;
  qty_today: number;
}

export interface IVlAssemblyModuleDailyOutputReportStyleRow {
  schedule_pk: number;
  sj_po_number: string;
  style_name: string | null;
  style_code: string | null;
  qty_today: number;
  record_count: number;
  sj_nos: string[];
  worker_names: string[];
  modules: IVlAssemblyModuleDailyOutputReportModuleRow[];
}

export interface IVlAssemblyModuleDailyOutputReport {
  report_date: string;
  kpi: IVlAssemblyDailyOutputReportKpi;
  by_style: IVlAssemblyModuleDailyOutputReportStyleRow[];
  hourly_breakdown: IVlAssemblyDailyOutputReportHourlyRow[];
  by_worker: IVlAssemblyDailyOutputReportWorkerRow[];
}

export interface IVlAssemblyDailyInspectionReportKpi extends IEpDailyInspectionReportKpi {
  defect_qty_vl_sj_no: number;
  defect_qty_vl_module: number;
  defect_qty_vl_process: number;
}

export interface IVlAssemblyDailyInspectionReport extends Omit<IEpDailyInspectionReport, "kpi"> {
  kpi: IVlAssemblyDailyInspectionReportKpi;
}

export type VlAssemblyProcessesSyncSummary = EpProcessesSyncSummary;
export type VlAssemblyModuleSyncCascade = EpModuleSyncCascade;

function normalizeVlAssemblyProcess(p: any): any {
  if (!p) return p;
  return {
    ...p,
    ep_module_pk: p.ep_module_pk ?? p.vl_assembly_module_pk,
    ep_module_code: p.ep_module_code ?? p.vl_assembly_module_code ?? "",
    ep_sj_no_pk: p.ep_sj_no_pk ?? p.vl_assembly_sj_no_pk,
    ep_schedule_pk: p.ep_schedule_pk ?? p.vl_assembly_schedule_pk,
  };
}

function normalizeVlAssemblyModule(m: any): any {
  if (!m) return m;
  const processes = m.ep_processes ?? m.vl_assembly_processes ?? [];
  return {
    ...m,
    ep_sj_no_pk: m.ep_sj_no_pk ?? m.vl_assembly_sj_no_pk,
    ep_sj_no_sj_no:
      m.ep_sj_no_sj_no ?? m.vl_assembly_sj_no ?? m.vl_assembly_sj_no_sj_no ?? "",
    ep_processes: processes.map(normalizeVlAssemblyProcess),
  };
}

function normalizeVlAssemblySjNo(sj: any): any {
  if (!sj) return sj;
  const modules = sj.ep_modules ?? sj.vl_assembly_modules ?? [];
  return {
    ...sj,
    ep_schedule_pk: sj.ep_schedule_pk ?? sj.vl_assembly_schedule_pk,
    ep_modules: modules.map(normalizeVlAssemblyModule),
  };
}

function normalizeVlAssemblySchedule(s: any): any {
  if (!s) return s;
  const sjNos = s.ep_sj_nos ?? s.vl_assembly_sj_nos ?? [];
  return {
    ...s,
    ep_sj_nos: sjNos.map(normalizeVlAssemblySjNo),
  };
}

export const getVlAssemblySchedules = ({
  search = "",
  year,
  month,
  sj_order,
  /** 목록 필터: 이 기간(YMD)과 production_assembly_start~finish가 겹치는 행만 (백엔드 구현 필요) */
  date_from,
  date_to,
}: {
  search?: string;
  year?: number;
  month?: number;
  sj_order?: number;
  date_from?: string;
  date_to?: string;
} = {}) => {
  const params = new URLSearchParams();
  if (search) params.set("search", search);
  if (year != null) params.set("year", String(year));
  if (month != null) params.set("month", String(month));
  if (sj_order != null) params.set("sj_order", String(sj_order));
  if (date_from) params.set("date_from", date_from);
  if (date_to) params.set("date_to", date_to);
  return instance
    .get(`vl-assembly-production/schedules/?${params.toString()}`)
    .then((r) => (Array.isArray(r.data) ? r.data.map(normalizeVlAssemblySchedule) : []) as IVlAssemblySchedule[]);
};

export interface IVlAssemblySchedulesPage {
  results: IVlAssemblySchedule[];
  current_page: number;
  total_pages: number;
  total_results: number;
}

export const getVlAssemblySchedulesPaginated = ({
  search = "",
  year,
  month,
  page = 1,
  page_size = 20,
}: {
  search?: string;
  year?: number;
  month?: number;
  page?: number;
  page_size?: number;
} = {}) => {
  const params = new URLSearchParams();
  if (search) params.set("search", search);
  if (year != null) params.set("year", String(year));
  if (month != null) params.set("month", String(month));
  params.set("page", String(page));
  params.set("page_size", String(page_size));
  return instance
    .get(`vl-assembly-production/schedules/?${params.toString()}`)
    .then((r) => {
      const data = r.data as { results: unknown[]; current_page: number; total_pages: number; total_results: number };
      return {
        results: (data.results ?? []).map(normalizeVlAssemblySchedule) as IVlAssemblySchedule[],
        current_page: data.current_page,
        total_pages: data.total_pages,
        total_results: data.total_results,
      } as IVlAssemblySchedulesPage;
    });
};

/** VL 조립 생산 — 계획 근무일에서 제외할 등록 공휴일(일요일은 프론트에서 별도 제외) */
export interface IVlPlanHoliday {
  pk: number;
  date: string;
  name: string;
  created_at?: string;
  updated_at?: string;
}

function normalizeVlPlanHolidayRow(row: Record<string, unknown>): IVlPlanHoliday {
  const rawPk = row.pk ?? row.id;
  const pk = typeof rawPk === "number" ? rawPk : Number(rawPk);
  return {
    pk: Number.isFinite(pk) ? pk : 0,
    date: String(row.date ?? "").slice(0, 10),
    name: typeof row.name === "string" ? row.name : "",
    created_at:
      row.created_at != null ? String(row.created_at) : undefined,
    updated_at:
      row.updated_at != null ? String(row.updated_at) : undefined,
  };
}

export const getVlPlanHolidays = (params?: {
  date_from?: string;
  date_to?: string;
  year?: number;
}) => {
  const q = new URLSearchParams();
  if (params?.date_from) q.set("date_from", params.date_from);
  if (params?.date_to) q.set("date_to", params.date_to);
  if (params?.year != null) q.set("year", String(params.year));
  const qs = q.toString();
  const suffix = qs ? `?${qs}` : "";
  return instance
    .get(`vl-assembly-production/plan-holidays/${suffix}`)
    .then((r) => {
      const d = r.data as { results?: Record<string, unknown>[] };
      const list = Array.isArray(d?.results) ? d.results : [];
      return list.map((row) => normalizeVlPlanHolidayRow(row));
    });
};

export const upsertVlPlanHoliday = (body: { date: string; name?: string }) =>
  instance
    .post(`vl-assembly-production/plan-holidays/`, body, {
      headers: { "X-CSRFToken": Cookies.get("csrftoken") || "" },
    })
    .then((r) => normalizeVlPlanHolidayRow(r.data as Record<string, unknown>));

export const deleteVlPlanHoliday = (pk: number) =>
  instance.delete(`vl-assembly-production/plan-holidays/${pk}/`, {
    headers: { "X-CSRFToken": Cookies.get("csrftoken") || "" },
  });

export const getVlAssemblyScheduleDetail = (pk: number) =>
  instance.get(`vl-assembly-production/schedules/${pk}/`).then((r) => normalizeVlAssemblySchedule(r.data) as IVlAssemblySchedule);
export const getVlAssemblyColumnPreference = () => instance.get("vl-assembly-production/column-preferences/").then((r) => r.data as { visible_columns: string[] });
export const saveVlAssemblyColumnPreference = (visible_columns: string[]) => instance.put("vl-assembly-production/column-preferences/", { visible_columns }, { headers: { "X-CSRFToken": Cookies.get("csrftoken") || "" } });

export type IVlAssemblyScheduleCreate = Partial<IVlAssemblySchedule> & {
  ex_factory_date?: string | null;
  module_category_ids: number[];
  /** 다중 SJ Order 선택 (권장). 단일 `sj_order` 도 하위 호환으로 지원 */
  sj_order_ids?: number[];
};

export const createVlAssemblySchedule = (data: IVlAssemblyScheduleCreate) =>
  instance.post("vl-assembly-production/schedules/", data, { headers: { "X-CSRFToken": Cookies.get("csrftoken") || "" } }).then((r) => r.data as IVlAssemblySchedule);

export const addSjNoToVlAssemblySchedule = (
  schedulePk: number,
  data: { sj_order: number; module_category_ids?: number[] },
) =>
  instance
    .post(`vl-assembly-production/schedules/${schedulePk}/add-sj-no/`, data, {
      headers: { "X-CSRFToken": Cookies.get("csrftoken") || "" },
    })
    .then((r) => normalizeVlAssemblySchedule(r.data) as IVlAssemblySchedule);

export type IVlAssemblySjNoMovePayload =
  | { target_schedule: number; create_new_schedule?: false }
  | {
      create_new_schedule: true;
      target_schedule?: never;
      production_line?: number | null;
      status?: string;
    };

export const moveVlAssemblySjNo = (sjNoPk: number, data: IVlAssemblySjNoMovePayload) =>
  instance
    .patch(`vl-assembly-production/sj-nos/${sjNoPk}/move/`, data, {
      headers: { "X-CSRFToken": Cookies.get("csrftoken") || "" },
    })
    .then((r) => r.data as {
      sj_no: IVlAssemblySjNoDetail;
      source_schedule_pk: number;
      target_schedule_pk: number;
    });
/** PATCH 본문: 스케줄 필드 + `ex_factory_date`/CMT·FOB 등 SJ Order write_only 필드 */
export type IVlAssemblySchedulePatch = Partial<IVlAssemblySchedule> &
  Partial<
    Pick<
      ISjOrderInfo,
      | "ex_country"
      | "air_or_vessel"
      | "po_date"
      | "newness_or_repeat"
      | "gong_in"
      | "total_cmt"
      | "actual_cmt"
      | "unit_fob"
      | "total_fob"
      | "actual_fob"
    >
  > & {
    /** 백엔드 write_only — 연결 SJ Order 의 선적일 갱신 */
    ex_factory_date?: string | null;
  };

export const editVlAssemblySchedule = (pk: number, data: IVlAssemblySchedulePatch) =>
  instance.patch(`vl-assembly-production/schedules/${pk}/`, data, { headers: { "X-CSRFToken": Cookies.get("csrftoken") || "" } }).then((r) => r.data as IVlAssemblySchedule);
export const deleteVlAssemblySchedule = (pk: number) =>
  instance.delete(`vl-assembly-production/schedules/${pk}/`, { headers: { "X-CSRFToken": Cookies.get("csrftoken") || "" } }).then((r) => r.data);

export const patchVlAssemblySjNo = (pk: number, data: Partial<IVlAssemblySjNoCopy>) =>
  instance.patch(`vl-assembly-production/sj-nos/${pk}/`, data, { headers: { "X-CSRFToken": Cookies.get("csrftoken") || "" } }).then((r) => r.data as IVlAssemblySjNoCopy);
export const patchVlAssemblyModule = (pk: number, data: Partial<IVlAssemblyModuleCopy>) =>
  instance.patch(`vl-assembly-production/modules/${pk}/`, data, { headers: { "X-CSRFToken": Cookies.get("csrftoken") || "" } }).then((r) => r.data as IVlAssemblyModuleCopy);
export const patchVlAssemblyProcess = (pk: number, data: Partial<IVlAssemblyProcessCopy>) =>
  instance.patch(`vl-assembly-production/processes/${pk}/`, data, { headers: { "X-CSRFToken": Cookies.get("csrftoken") || "" } }).then((r) => r.data as IVlAssemblyProcessCopy);

export const deleteVlAssemblySjNo = (pk: number) => instance.delete(`vl-assembly-production/sj-nos/${pk}/`, { headers: { "X-CSRFToken": Cookies.get("csrftoken") || "" } });
export const deleteVlAssemblyModule = (pk: number) => instance.delete(`vl-assembly-production/modules/${pk}/`, { headers: { "X-CSRFToken": Cookies.get("csrftoken") || "" } });
export const deleteVlAssemblyProcess = (pk: number) => instance.delete(`vl-assembly-production/processes/${pk}/`, { headers: { "X-CSRFToken": Cookies.get("csrftoken") || "" } });

export const syncVlAssemblySjNoFromSource = (pk: number, reset_fields?: string[]) =>
  instance
    .post(`vl-assembly-production/sj-nos/${pk}/sync-source/`, reset_fields ? { reset_fields } : {}, { headers: { "X-CSRFToken": Cookies.get("csrftoken") || "" } })
    .then((r) => normalizeVlAssemblySjNo(r.data) as IVlAssemblySjNoDetail & { updated_fields: string[]; modules_sync: VlAssemblyModuleSyncCascade[] });
export const syncVlAssemblyModuleFromSource = (pk: number, reset_fields?: string[]) =>
  instance
    .post(`vl-assembly-production/modules/${pk}/sync-source/`, reset_fields ? { reset_fields } : {}, { headers: { "X-CSRFToken": Cookies.get("csrftoken") || "" } })
    .then((r) => normalizeVlAssemblyModule(r.data) as IVlAssemblyModuleDetail & { updated_fields: string[]; processes_sync: VlAssemblyProcessesSyncSummary });
export const syncVlAssemblyProcessFromSource = (pk: number, reset_fields?: string[]) =>
  instance
    .post(`vl-assembly-production/processes/${pk}/sync-source/`, reset_fields ? { reset_fields } : {}, { headers: { "X-CSRFToken": Cookies.get("csrftoken") || "" } })
    .then((r) => normalizeVlAssemblyProcess(r.data) as IVlAssemblyProcessDetail & { updated_fields: string[]; processes_sync: VlAssemblyProcessesSyncSummary; synced_via_parent_module?: boolean });

export const getVlAssemblySjNoDetail = (pk: number) =>
  instance.get(`vl-assembly-production/sj-nos/${pk}/`).then((r) => normalizeVlAssemblySjNo(r.data) as IVlAssemblySjNoDetail);
export const getVlAssemblyModuleDetail = (pk: number) =>
  instance.get(`vl-assembly-production/modules/${pk}/`).then((r) => normalizeVlAssemblyModule(r.data) as IVlAssemblyModuleDetail);
export const getVlAssemblyProcessDetail = (pk: number) =>
  instance.get(`vl-assembly-production/processes/${pk}/`).then((r) => normalizeVlAssemblyProcess(r.data) as IVlAssemblyProcessDetail);

export const getVlAssemblyProductionDailyOutputs = (params?: { schedule?: number; vl_assembly_process?: number; ep_process?: number; date_from?: string; date_to?: string; search?: string; page?: number; page_size?: number; }) => {
  const q = new URLSearchParams();
  if (params?.schedule != null) q.set("schedule", String(params.schedule));
  if (params?.vl_assembly_process != null) q.set("vl_assembly_process", String(params.vl_assembly_process));
  if (params?.ep_process != null) q.set("vl_assembly_process", String(params.ep_process));
  if (params?.date_from) q.set("date_from", params.date_from);
  if (params?.date_to) q.set("date_to", params.date_to);
  if (params?.search?.trim()) q.set("search", params.search.trim());
  if (params?.page != null) q.set("page", String(params.page));
  if (params?.page_size != null) q.set("page_size", String(params.page_size));
  const qs = q.toString();
  return instance.get(`vl-assembly-production/daily-outputs/${qs ? `?${qs}` : ""}`).then((r) => r.data as IVlAssemblyProductionDailyOutputListResponse);
};

export const createVlAssemblyProductionDailyOutput = (data: { vl_assembly_process?: number; ep_process?: number; qty: number; recorded_at?: string; remark?: string; }) =>
  instance.post(
    "vl-assembly-production/daily-outputs/",
    {
      ...data,
      vl_assembly_process: data.vl_assembly_process ?? data.ep_process,
    },
    { headers: { "X-CSRFToken": Cookies.get("csrftoken") || "" } }
  ).then((r) => r.data as IVlAssemblyProductionDailyOutput);
export const getVlAssemblyProductionDailyOutput = (pk: number) =>
  instance.get(`vl-assembly-production/daily-outputs/${pk}/`).then((r) => r.data as IVlAssemblyProductionDailyOutput);
export const patchVlAssemblyProductionDailyOutput = (pk: number, data: Partial<Pick<IVlAssemblyProductionDailyOutput, "qty" | "recorded_at" | "remark">>) =>
  instance.patch(`vl-assembly-production/daily-outputs/${pk}/`, data, { headers: { "X-CSRFToken": Cookies.get("csrftoken") || "" } }).then((r) => r.data as IVlAssemblyProductionDailyOutput);
export const deleteVlAssemblyProductionDailyOutput = (pk: number) =>
  instance.delete(`vl-assembly-production/daily-outputs/${pk}/`, { headers: { "X-CSRFToken": Cookies.get("csrftoken") || "" } });

/** 스케줄(VLAssemblySchedule) 단위 조립 생산 실적 — admin: vlassemblyproductiondailyoutput. REST: `schedule-daily-outputs/` (공정 단위는 `daily-outputs/`) */
export interface IVlAssemblyScheduleProductionDailyOutput {
  pk: number;
  vl_assembly_schedule: number;
  vl_assembly_sj_no: number | null;
  vl_assembly_sj_no_sj_no: string | null;
  sj_po_number?: string | null;
  production_line_name?: string | null;
  qty: number;
  schedule_cumulative_snapshot: number | null;
  recorded_at: string;
  remark: string;
  recorded_by: number | null;
  recorded_by_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface IVlAssemblyScheduleProductionDailyOutputListResponse {
  results: IVlAssemblyScheduleProductionDailyOutput[];
  current_page: number;
  total_pages: number;
  total_results: number;
}

function normalizeVlAssemblyScheduleProductionDailyOutput(
  data: any
): IVlAssemblyScheduleProductionDailyOutput {
  if (!data) return data;
  return {
    ...data,
    vl_assembly_schedule:
      data.vl_assembly_schedule ?? data.ep_schedule_pk ?? data.schedule
  };
}

export const getVlAssemblyScheduleProductionDailyOutputs = (params?: {
  schedule?: number;
  vl_assembly_schedule?: number;
  date_from?: string;
  date_to?: string;
  search?: string;
  page?: number;
  page_size?: number;
}) => {
  const q = new URLSearchParams();
  const sched = params?.schedule ?? params?.vl_assembly_schedule;
  if (sched != null) q.set("schedule", String(sched));
  if (params?.date_from) q.set("date_from", params.date_from);
  if (params?.date_to) q.set("date_to", params.date_to);
  if (params?.search?.trim()) q.set("search", params.search.trim());
  if (params?.page != null) q.set("page", String(params.page));
  if (params?.page_size != null) q.set("page_size", String(params.page_size));
  const qs = q.toString();
  return instance
    .get(
      `vl-assembly-production/schedule-daily-outputs/${qs ? `?${qs}` : ""}`
    )
    .then(
      (r) =>
        ({
          ...r.data,
          results: (r.data?.results ?? []).map(
            normalizeVlAssemblyScheduleProductionDailyOutput
          )
        }) as IVlAssemblyScheduleProductionDailyOutputListResponse
    );
};

export const createVlAssemblyScheduleProductionDailyOutput = (data: {
  vl_assembly_schedule: number;
  vl_assembly_sj_no?: number;
  qty: number;
  recorded_at?: string;
  remark?: string;
}) =>
  instance
    .post("vl-assembly-production/schedule-daily-outputs/", data, {
      headers: { "X-CSRFToken": Cookies.get("csrftoken") || "" }
    })
    .then((r) => normalizeVlAssemblyScheduleProductionDailyOutput(r.data));

export const getVlAssemblyScheduleProductionDailyOutput = (pk: number) =>
  instance
    .get(`vl-assembly-production/schedule-daily-outputs/${pk}/`)
    .then((r) => normalizeVlAssemblyScheduleProductionDailyOutput(r.data));

export const patchVlAssemblyScheduleProductionDailyOutput = (
  pk: number,
  data: Partial<
    Pick<
      IVlAssemblyScheduleProductionDailyOutput,
      "qty" | "recorded_at" | "remark"
    >
  >
) =>
  instance
    .patch(
      `vl-assembly-production/schedule-daily-outputs/${pk}/`,
      data,
      { headers: { "X-CSRFToken": Cookies.get("csrftoken") || "" } }
    )
    .then((r) => normalizeVlAssemblyScheduleProductionDailyOutput(r.data));

export const deleteVlAssemblyScheduleProductionDailyOutput = (pk: number) =>
  instance.delete(
    `vl-assembly-production/schedule-daily-outputs/${pk}/`,
    { headers: { "X-CSRFToken": Cookies.get("csrftoken") || "" } }
  );

export const getVlAssemblyDailyOutputReport = (date?: string) => {
  const qs = date ? `?date=${date}` : "";
  return instance.get(`vl-assembly-production/daily-output-report/${qs}`).then((r) => r.data as IVlAssemblyDailyOutputReport);
};

export const getVlAssemblyModuleProductionDailyOutputs = (params?: {
  schedule?: number;
  vl_assembly_module?: number;
  date_from?: string;
  date_to?: string;
  search?: string;
  page?: number;
  page_size?: number;
}) => {
  const q = new URLSearchParams();
  if (params?.schedule != null) q.set("schedule", String(params.schedule));
  if (params?.vl_assembly_module != null) q.set("vl_assembly_module", String(params.vl_assembly_module));
  if (params?.date_from) q.set("date_from", params.date_from);
  if (params?.date_to) q.set("date_to", params.date_to);
  if (params?.search?.trim()) q.set("search", params.search.trim());
  if (params?.page != null) q.set("page", String(params.page));
  if (params?.page_size != null) q.set("page_size", String(params.page_size));
  const qs = q.toString();
  return instance
    .get(`vl-assembly-production/module-daily-outputs/${qs ? `?${qs}` : ""}`)
    .then((r) => r.data as IVlAssemblyModuleProductionDailyOutputListResponse);
};

export const createVlAssemblyModuleProductionDailyOutput = (data: {
  vl_assembly_module: number;
  qty: number;
  recorded_at?: string;
  remark?: string;
}) =>
  instance
    .post("vl-assembly-production/module-daily-outputs/", data, {
      headers: { "X-CSRFToken": Cookies.get("csrftoken") || "" },
    })
    .then((r) => r.data as IVlAssemblyModuleProductionDailyOutput);

export const getVlAssemblyModuleProductionDailyOutput = (pk: number) =>
  instance
    .get(`vl-assembly-production/module-daily-outputs/${pk}/`)
    .then((r) => r.data as IVlAssemblyModuleProductionDailyOutput);

export const patchVlAssemblyModuleProductionDailyOutput = (
  pk: number,
  data: Partial<Pick<IVlAssemblyModuleProductionDailyOutput, "qty" | "recorded_at" | "remark">>
) =>
  instance
    .patch(`vl-assembly-production/module-daily-outputs/${pk}/`, data, {
      headers: { "X-CSRFToken": Cookies.get("csrftoken") || "" },
    })
    .then((r) => r.data as IVlAssemblyModuleProductionDailyOutput);

export const deleteVlAssemblyModuleProductionDailyOutput = (pk: number) =>
  instance.delete(`vl-assembly-production/module-daily-outputs/${pk}/`, {
    headers: { "X-CSRFToken": Cookies.get("csrftoken") || "" },
  });

export const getVlAssemblyModuleDailyOutputReport = (date?: string) => {
  const qs = date ? `?date=${date}` : "";
  return instance
    .get(`vl-assembly-production/module-daily-output-report/${qs}`)
    .then((r) => r.data as IVlAssemblyModuleDailyOutputReport);
};

export const getVlAssemblyDailyInspectionReport = (date?: string) => {
  const qs = date ? `?date=${date}` : "";
  return instance
    .get(`vl-assembly-production/daily-inspection-report/${qs}`)
    .then((r) => r.data as IVlAssemblyDailyInspectionReport);
};

// ──────────────────────────────────────────────────────────────
// SJ Kaizen
// ──────────────────────────────────────────────────────────────

export const getKaizenPosts = (params?: {
  search?: string;
  category?: string;
  sj_style?: number;
  sj_no?: number;
  published?: boolean;
  date_from?: string;
  date_to?: string;
  page?: number;
}) => {
  const q = new URLSearchParams();
  if (params?.search?.trim()) q.set("search", params.search.trim());
  if (params?.category) q.set("category", params.category);
  if (params?.sj_style != null) q.set("sj_style", String(params.sj_style));
  if (params?.sj_no != null) q.set("sj_no", String(params.sj_no));
  if (params?.published != null) q.set("published", params.published ? "true" : "false");
  if (params?.date_from) q.set("date_from", params.date_from);
  if (params?.date_to) q.set("date_to", params.date_to);
  if (params?.page != null) q.set("page", String(params.page));
  const qs = q.toString();
  return instance
    .get(`kaizen/posts/${qs ? `?${qs}` : ""}`)
    .then((r) => r.data as ISjKaizenListResponse);
};

export const getKaizenPost = (pk: number) =>
  instance.get(`kaizen/posts/${pk}/`).then((r) => r.data as ISjKaizenPost);

export const createKaizenPost = (data: ISjKaizenPostForm) =>
  instance
    .post("kaizen/posts/", data, {
      headers: { "X-CSRFToken": Cookies.get("csrftoken") || "" },
    })
    .then((r) => r.data as ISjKaizenPost);

export const updateKaizenPost = (pk: number, data: Partial<ISjKaizenPostForm>) =>
  instance
    .put(`kaizen/posts/${pk}/`, data, {
      headers: { "X-CSRFToken": Cookies.get("csrftoken") || "" },
    })
    .then((r) => r.data as ISjKaizenPost);

export const deleteKaizenPost = (pk: number) =>
  instance.delete(`kaizen/posts/${pk}/`, {
    headers: { "X-CSRFToken": Cookies.get("csrftoken") || "" },
  });

export const getKaizenPostMedia = (pk: number) =>
  instance
    .get(`kaizen/posts/${pk}/media/`)
    .then((r) => r.data as ISjKaizenMedia[]);

export const addKaizenMedia = (
  postPk: number,
  data: Omit<ISjKaizenMedia, "id" | "post" | "created_at">
) =>
  instance
    .post(`kaizen/posts/${postPk}/media/`, { ...data, post: postPk }, {
      headers: { "X-CSRFToken": Cookies.get("csrftoken") || "" },
    })
    .then((r) => r.data as ISjKaizenMedia);

export const updateKaizenMedia = (
  postPk: number,
  mediaPk: number,
  data: Partial<ISjKaizenMedia>
) =>
  instance
    .put(`kaizen/posts/${postPk}/media/${mediaPk}/`, data, {
      headers: { "X-CSRFToken": Cookies.get("csrftoken") || "" },
    })
    .then((r) => r.data as ISjKaizenMedia);

export const deleteKaizenMedia = (postPk: number, mediaPk: number) =>
  instance.delete(`kaizen/posts/${postPk}/media/${mediaPk}/`, {
    headers: { "X-CSRFToken": Cookies.get("csrftoken") || "" },
  });

// ── Kaizen Photos (SJ Process 방식과 동일) ──────────────────────
export const createKaizenPhoto = ({
  file,
  postPk,
  description = "",
}: {
  file: string;
  postPk: number;
  description?: string;
}) =>
  instance
    .post(
      `kaizen/posts/${postPk}/photos/`,
      { file, description, kaizen_post: postPk },
      { headers: { "X-CSRFToken": Cookies.get("csrftoken") || "" } }
    )
    .then((r) => r.data as IKaizenPhoto);

export const deleteKaizenPhoto = ({
  postPk,
  photoPk,
}: {
  postPk: number;
  photoPk: number;
}) =>
  instance.delete(`kaizen/posts/${postPk}/photos/${photoPk}/`, {
    headers: { "X-CSRFToken": Cookies.get("csrftoken") || "" },
  });

// ── Kaizen Videos (SJ Process 방식과 동일) ──────────────────────
export const createKaizenVideo = ({
  VideoFile,
  ThumbnailFile = "",
  postPk,
  description = "",
}: {
  VideoFile: string;
  ThumbnailFile?: string;
  postPk: number;
  description?: string;
}) =>
  instance
    .post(
      `kaizen/posts/${postPk}/videos/`,
      { VideoFile, ThumbnailFile, description, kaizen_post: postPk },
      { headers: { "X-CSRFToken": Cookies.get("csrftoken") || "" } }
    )
    .then((r) => r.data as IKaizenVideo);

export const deleteKaizenVideo = ({
  postPk,
  videoPk,
}: {
  postPk: number;
  videoPk: number;
}) =>
  instance.delete(`kaizen/posts/${postPk}/videos/${videoPk}/`, {
    headers: { "X-CSRFToken": Cookies.get("csrftoken") || "" },
  });

// ─── Public (no-auth) API ─────────────────────────────────────────────────────
// QR 스캔 시 로그인 없이 접근 가능한 공개 엔드포인트.
// 백엔드가 AllowAny + CORS_ALLOW_CREDENTIALS=True 이므로
// 기존 instance(withCredentials:true)를 그대로 사용 — 쿠키가 없으면 AnonymousUser로 처리됨.
export const getJigDetailPublic = async (jigId: string) => {
  const response = await instance.get(`jigs/${jigId}/`);
  return response.data;
};

export const getJigPhotosPublic = async (jigId: string): Promise<IFilePhotos[]> => {
  const response = await instance.get(`jigs/${jigId}/photos/`);
  return response.data;
};

export const getBindingGuideDetailPublic = async (id: string) => {
  const response = await instance.get(`binding-guides/${id}/`);
  return response.data;
};

export const getBindingGuidePhotosPublic = async (id: string): Promise<IFilePhotos[]> => {
  const response = await instance.get(`binding-guides/${id}/photos/`);
  return response.data;
};

export const getTgBindingGuideDetailPublic = async (id: string) => {
  const response = await instance.get(`tg-binding-guides/${id}/`);
  return response.data;
};

export const getTgBindingGuidePhotosPublic = async (id: string): Promise<IFilePhotos[]> => {
  const response = await instance.get(`tg-binding-guides/${id}/photos/`);
  return response.data;
};

export const getTgJigDetailPublic = async (tgJigId: string) => {
  const response = await instance.get(`tg-jigs/${tgJigId}/`);
  return response.data;
};

export const getTgJigPhotosPublic = async (tgJigId: string): Promise<IFilePhotos[]> => {
  const response = await instance.get(`tg-jigs/${tgJigId}/photos/`);
  return response.data;
};

export const getAluminumMoldDetailPublic = async (id: string) => {
  const response = await instance.get(`aluminum-molds/${id}/`);
  return response.data;
};

export const getAluminumMoldPhotosPublic = async (id: string): Promise<IFilePhotos[]> => {
  const response = await instance.get(`aluminum-molds/${id}/photos/`);
  return response.data;
};

// ── Hot & Cold Press IoT ─────────────────────────────────────────────────────

export interface IHotColdPressSetup {
  id: number;
  machine_iot_id: string;
  std_hot_temp_c: string;
  std_cold_temp_c: string;
  std_hot_duration_s: string;
  std_cold_duration_s: string;
  std_cycle_duration_s: string;
  tolerance_temp_c: string;
  tolerance_duration_s: string;
  last_heartbeat_at: string | null;
  is_connected: boolean;
  created_at: string;
  updated_at: string;
}

export interface IHotColdPressCycle {
  id: number;
  cycle_no: number;
  started_at: string;
  ended_at: string;
  duration_s: string;
  hot_temp_avg_c: string | null;
  hot_temp_max_c: string | null;
  hot_duration_s: string | null;
  cold_temp_avg_c: string | null;
  cold_temp_max_c: string | null;
  cold_duration_s: string | null;
  temp_max_c: string;
  temp_avg_c: string;
  current_max_a: string;
  hot_temp_avg_diff: number | null;
  cold_temp_avg_diff: number | null;
  hot_duration_diff: number | null;
  cold_duration_diff: number | null;
  cycle_duration_diff: number | null;
}

export const getEpProcessIoTSetup = async (
  processPk: number
): Promise<IHotColdPressSetup | null> => {
  const r = await instance.get(`ep-production/processes/${processPk}/iot-setup/`);
  return r.data ?? null;
};

export const saveEpProcessIoTSetup = async (
  processPk: number,
  data: {
    machine_iot_id: string;
    std_hot_temp_c: string;
    std_cold_temp_c: string;
    std_hot_duration_s: string;
    std_cold_duration_s: string;
    std_cycle_duration_s: string;
    tolerance_temp_c: string;
  }
): Promise<IHotColdPressSetup> => {
  const r = await instance.post(`ep-production/processes/${processPk}/iot-setup/`, data, {
    headers: { "X-CSRFToken": Cookies.get("csrftoken") || "" },
  });
  return r.data;
};

export const disconnectIoTSetup = async (processPk: number): Promise<void> => {
  await instance.delete(`ep-production/processes/${processPk}/iot-setup/`, {
    headers: { "X-CSRFToken": Cookies.get("csrftoken") || "" },
  });
};

export interface IIotConnectionCheckResult {
  machine_iot_id: string;
  is_connected: boolean;
  last_heartbeat_at: string | null;
  registered: boolean;
}

export const checkIotConnection = async (
  machineIoTId: string
): Promise<IIotConnectionCheckResult> => {
  const r = await instance.get("ep-production/iot-connection-check/", {
    params: { machine_iot_id: machineIoTId },
  });
  return r.data;
};

export const getEpProcessIoTCycles = async (
  processPk: number,
  params: { limit?: number; date?: string } = {}
): Promise<IHotColdPressCycle[]> => {
  const { limit = 50, date } = params;
  const r = await instance.get(`ep-production/processes/${processPk}/iot-cycles/`, {
    params: date ? { date } : { limit },
  });
  return r.data;
};

export const pressIotLight = async (
  machineIotId: string,
  color: "green" | "red" | "off"
): Promise<void> => {
  await instance.post("ep-production/iot-light/", {
    machine_iot_id: machineIotId,
    color,
  });
};

// ── Global IoT Cycle List / Detail / CRUD ────────────────────────────────────

export interface IHotColdPressCycleListItem extends IHotColdPressCycle {
  machine_iot_id: string;
  process_pk: number;
  process_code: string;
  setup_id: number;
}

export const getHotColdPressCycleList = async (params: {
  date?: string;
  machine_iot_id?: string;
}): Promise<IHotColdPressCycleListItem[]> => {
  const r = await instance.get("ep-production/iot-cycles/", { params });
  return r.data;
};

export const getHotColdPressCycleDetail = async (
  cycleId: number
): Promise<IHotColdPressCycleListItem> => {
  const r = await instance.get(`ep-production/iot-cycles/${cycleId}/`);
  return r.data;
};

export const updateHotColdPressCycle = async (
  cycleId: number,
  data: Partial<{
    hot_temp_avg_c: string;
    hot_temp_max_c: string;
    cold_temp_avg_c: string;
    cold_temp_max_c: string;
    hot_duration_s: string;
    cold_duration_s: string;
    duration_s: string;
    temp_max_c: string;
    temp_avg_c: string;
    current_max_a: string;
  }>
): Promise<IHotColdPressCycleListItem> => {
  const r = await instance.patch(`ep-production/iot-cycles/${cycleId}/`, data);
  return r.data;
};

export const deleteHotColdPressCycle = async (cycleId: number): Promise<void> => {
  await instance.delete(`ep-production/iot-cycles/${cycleId}/`);
};

export interface IIotLastCycle {
  id: number;
  cycle_no: number;
  started_at: string;
  hot_temp_avg_c: string | null;
  hot_temp_avg_diff: number | null;
  cold_temp_avg_c: string | null;
  cold_temp_avg_diff: number | null;
  duration_s: string | null;
  cycle_duration_diff: number | null;
  is_pass: boolean;
}

export interface IIotProcessStatus {
  process_pk: number;
  machine_iot_id: string | null;
  is_connected: boolean;
  last_cycle: IIotLastCycle | null;
}

export const getHotColdPressIoTBulkStatus = async (
  processPks: number[]
): Promise<IIotProcessStatus[]> => {
  if (!processPks.length) return [];
  const r = await instance.get("ep-production/iot-process-status/", {
    params: { pks: processPks.join(",") },
  });
  return r.data;
};

// ── Welding Room ─────────────────────────────────────────────

export interface IMachinePlacement {
  pk: number;
  machine: number;
  machine_pk: number;
  machine_code: string;
  machine_name: string;
  machine_type: string;
  machine_iot_id: string;
  model_3d_url: string;
  thumbnail?: string | null;
  style_thumbnail?: string | null;
  style_code?: string | null;
  style_name?: string | null;
  ep_process_pk?: number | null;
  ep_process_code?: string | null;
  iot_std_hot_temp_c?: number | null;
  iot_std_cold_temp_c?: number | null;
  iot_tolerance_temp_c?: number | null;
  iot_std_hot_duration_s?: number | null;
  iot_std_cold_duration_s?: number | null;
  iot_tolerance_duration_s?: number | null;
  pos_x: number;
  pos_z: number;
  rot_y: number;
  scale: number;
  card_offset_x: number;
  card_offset_y: number;
}

export interface IWeldingRoom {
  pk: number;
  name: string;
  width: number;
  depth: number;
  placements: IMachinePlacement[];
}

export const getWeldingRoom = (): Promise<IWeldingRoom> =>
  instance.get("welding-room/room/").then((r) => r.data);

export const addMachinePlacement = (data: {
  machine: number;
  pos_x?: number;
  pos_z?: number;
  rot_y?: number;
  scale?: number;
}): Promise<IMachinePlacement> =>
  instance.post("welding-room/placements/", data).then((r) => r.data);

export const updateMachinePlacement = (
  pk: number,
  data: Partial<{ pos_x: number; pos_z: number; rot_y: number; scale: number; card_offset_x: number; card_offset_y: number }>
): Promise<IMachinePlacement> =>
  instance.patch(`welding-room/placements/${pk}/`, data).then((r) => r.data);

export const removeMachinePlacement = (pk: number): Promise<void> =>
  instance.delete(`welding-room/placements/${pk}/`).then((r) => r.data);

// ── AI Analysis ──────────────────────────────────────────────────────────────

export interface IHotColdPressAnalysisRequest {
  machine_iot_id: string;
  hot_temp: number;
  cold_temp: number;
  hot_duration: number | null;
  cold_duration: number | null;
  cycle_count: number | null;
  std_hot_temp: number;
  std_cold_temp: number;
  std_hot_duration: number;
  std_cold_duration: number;
  tolerance_temp?: number;
  tolerance_duration?: number;
  language?: string;
}

export interface IHotColdPressAnalysisResponse {
  severity: "ok" | "warning" | "critical";
  summary: string;
  issues: string[];
  recommendations: string[];
}

export const analyzeHotColdPress = async (
  data: IHotColdPressAnalysisRequest
): Promise<IHotColdPressAnalysisResponse> => {
  const r = await instance.post("ai-analysis/hot-cold-press/", data, {
    headers: { "X-CSRFToken": Cookies.get("csrftoken") || "" },
  });
  return r.data;
};

export interface IFactoryMachineInput {
  machine_name: string;
  machine_iot_id: string;
  hot_temp: number | null;
  cold_temp: number | null;
  std_hot_temp: number | null;
  std_cold_temp: number | null;
  tolerance_temp?: number;
  is_connected: boolean;
}

export interface IFactoryMachineIssue {
  machine_name: string;
  machine_iot_id: string;
  severity: "ok" | "warning" | "critical";
  issues: string[];
}

export interface IFactoryOverviewAnalysisResponse {
  overall_severity: "ok" | "warning" | "critical";
  summary: string;
  machine_issues: IFactoryMachineIssue[];
  recommendations: string[];
}

export const analyzeFactoryOverview = async (
  machines: IFactoryMachineInput[],
  language = "ko"
): Promise<IFactoryOverviewAnalysisResponse> => {
  const r = await instance.post(
    "ai-analysis/factory-overview/",
    { machines, language },
    { headers: { "X-CSRFToken": Cookies.get("csrftoken") || "" } }
  );
  return r.data;
};

export type FactoryStreamEvent =
  | { type: "delta"; text: string }
  | { type: "done"; result: IFactoryOverviewAnalysisResponse }
  | { type: "error"; text: string };

export async function* streamFactoryOverview(
  machines: IFactoryMachineInput[],
  language = "ko"
): AsyncGenerator<FactoryStreamEvent> {
  const baseURL = getApiBaseURL();
  const jwtToken = localStorage.getItem("jwt") || "";
  const response = await fetch(`${baseURL}ai-analysis/factory-overview/stream/`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      "X-CSRFToken": Cookies.get("csrftoken") || "",
      ...(jwtToken ? { jwt: jwtToken } : {}),
    },
    body: JSON.stringify({ machines, language }),
  });

  if (!response.ok || !response.body) {
    yield { type: "error", text: `HTTP ${response.status}` };
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      try {
        const event = JSON.parse(line.slice(6)) as FactoryStreamEvent;
        yield event;
      } catch {}
    }
  }
}

// ── AI Analysis Reports ────────────────────────────────────────────────────

export interface IAIAnalysisLangContent {
  summary: string;
  machine_issues: IFactoryMachineIssue[];
  recommendations: string[];
}

export interface IAIAnalysisReport {
  id: number;
  source_page: "ep_dashboard" | "welding_room";
  overall_severity: "ok" | "warning" | "critical";
  machine_count: number;
  primary_language: string;
  content: Record<string, IAIAnalysisLangContent>;
  created_at: string;
  created_by: number | null;
  created_by_username: string | null;
}

export interface ISaveAIAnalysisReportParams {
  source_page: "ep_dashboard" | "welding_room";
  overall_severity: string;
  summary: string;
  machine_issues: IFactoryMachineIssue[];
  recommendations: string[];
  language: string;
  machine_count: number;
}

export const saveAIAnalysisReport = async (
  data: ISaveAIAnalysisReportParams
): Promise<IAIAnalysisReport> => {
  const r = await instance.post("ai-analysis/reports/", data, {
    headers: { "X-CSRFToken": Cookies.get("csrftoken") || "" },
  });
  return r.data;
};

export const getAIAnalysisReports = async (): Promise<IAIAnalysisReport[]> => {
  const r = await instance.get("ai-analysis/reports/");
  return r.data;
};

export const getAIAnalysisReport = async (id: number): Promise<IAIAnalysisReport> => {
  const r = await instance.get(`ai-analysis/reports/${id}/`);
  return r.data;
};

export const deleteAIAnalysisReport = async (id: number): Promise<void> => {
  await instance.delete(`ai-analysis/reports/${id}/`, {
    headers: { "X-CSRFToken": Cookies.get("csrftoken") || "" },
  });
};

export const getVlFactoryLiveDashboard = (date?: string): Promise<{
  ErrCode: string;
  Data: {
    LINE_NAME: string;
    H_TARGET: string | number;
    MP_NO: string;
    STYLE_NO: string;
    EXFTY1: string;
    ORDER_Q: string | number;
    Bal_Qty: string | number;
    TD_PROD_QTY: string | number;
    TIME_NO: string | number;
    target_per: string | number;
    ACT_Q01?: string | number;
    ACT_Q02?: string | number;
    ACT_Q03?: string | number;
    ACT_Q04?: string | number;
    ACT_Q05?: string | number;
    ACT_Q06?: string | number;
    ACT_Q07?: string | number;
    ACT_Q08?: string | number;
    ACT_Q09?: string | number;
    ACT_Q10?: string | number;
    ACT_Q11?: string | number;
    ACT_Q12?: string | number;
    ACT_Q13?: string | number;
    [key: string]: string | number | undefined;
  }[];
  error?: string;
}> =>
  instance
    .get("vl-assembly-production/factory-live/", { params: date ? { date } : {} })
    .then((r) => r.data);

export type VlLiveSjNo = { pk: number; sj_no: string; output_qty: number; total_qty: number | null; vl_qty?: number | null; outsource_factory?: string | null; outsource_qty?: number | null; target_qty_per_hour: number | null };
export type VlLiveHourly = { h: number; qty: number };
export type VlLiveModuleInstance = { pk: number; sj_no: string; total_qty: number; output_qty: number };
export type VlLiveModule = { code: string; name: string; total_qty: number; output_qty: number; status: string; target_qty_per_hour: number | null; hourly: VlLiveHourly[]; instances: VlLiveModuleInstance[] };
export type VlLiveSchedule = {
  pk: number;
  po_no: string;
  style_name: string;
  style_code: string | null;
  ex_factory_date: string;
  thumbnail: string | null;
  total_order_qty: number;
  vl_effective_qty: number;
  assembly_output_qty: number;
  assembly_target_qty_per_hour: number | null;
  output_qty: number;
  status: string;
  progress_pct: number;
  assembly_start: string;
  assembly_end: string;
  hourly: VlLiveHourly[];
  sj_nos: VlLiveSjNo[];
  modules_by_code: VlLiveModule[];
};
export type VlLiveLine = { line_name: string; schedules: VlLiveSchedule[] };
export type VlLiveScheduleResponse = { date: string; lines: VlLiveLine[] };

export const getVlFactoryLiveSchedules = (date?: string): Promise<VlLiveScheduleResponse> =>
  instance
    .get("vl-assembly-production/factory-live/schedules/", { params: date ? { date } : {} })
    .then((r) => r.data);

export type VlLiveScheduleDetailResponse = {
  date: string;
  line_name: string;
  schedule: VlLiveSchedule;
};

export const getVlFactoryLiveScheduleDetail = (
  pk: number,
  date?: string,
): Promise<VlLiveScheduleDetailResponse> =>
  instance
    .get(`vl-assembly-production/factory-live/schedules/${pk}/`, { params: date ? { date } : {} })
    .then((r) => r.data);

export const getVlFactoryLiveAIAnalysis = (date?: string): Promise<{
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  analysis: any;
  date: string;
  schedule_count: number;
}> =>
  instance
    .get("vl-assembly-production/factory-live/ai-analysis/", { params: date ? { date } : {} })
    .then((r) => r.data);

export type VlLiveAIStreamEvent =
  | { type: "text"; delta: string }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  | { type: "done"; result: any }
  | { type: "error"; text: string };

export async function* streamVlFactoryLiveAIAnalysis(date?: string): AsyncGenerator<VlLiveAIStreamEvent> {
  const baseURL = getApiBaseURL();
  const jwtToken = localStorage.getItem("jwt") || "";
  const params = date ? `?date=${encodeURIComponent(date)}` : "";
  const response = await fetch(
    `${baseURL}vl-assembly-production/factory-live/ai-analysis-stream/${params}`,
    {
      method: "GET",
      credentials: "include",
      headers: {
        "X-CSRFToken": Cookies.get("csrftoken") || "",
        ...(jwtToken ? { jwt: jwtToken } : {}),
      },
    }
  );

  if (!response.ok || !response.body) {
    yield { type: "error", text: `HTTP ${response.status}` };
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      try {
        const event = JSON.parse(line.slice(6)) as VlLiveAIStreamEvent;
        yield event;
      } catch {}
    }
  }
}

export const createVlAssemblyDailyOutput = (data: {
  vl_assembly_schedule: number;
  vl_assembly_sj_no?: number | null;
  qty: number;
  remark?: string;
}) =>
  instance
    .post("vl-assembly-production/schedule-daily-outputs/", data, {
      headers: { "X-CSRFToken": Cookies.get("csrftoken") || "" },
    })
    .then((r) => r.data);

export const createVlModuleDailyOutput = (data: {
  vl_assembly_module: number;
  qty: number;
  remark?: string;
}) =>
  instance
    .post("vl-assembly-production/module-daily-outputs/", data, {
      headers: { "X-CSRFToken": Cookies.get("csrftoken") || "" },
    })
    .then((r) => r.data);

// ── Welding Room Press Jobs ───────────────────────────────────────────────────

export interface IWeldingPressJob {
  pk: number;
  machine_iot_id: string;
  process_name: string;
  style_number: string;
  std_hot_temp_c: string;
  std_cold_temp_c: string;
  std_hot_duration_s: string;
  std_cold_duration_s: string;
  std_cycle_duration_s: string;
  tolerance_temp_c: string;
  tolerance_duration_s: string;
  started_at: string;
  ended_at: string | null;
  created_by_username: string;
}

export const getWeldingPressJobs = async (
  machineIotId: string
): Promise<IWeldingPressJob[]> => {
  const r = await instance.get("welding-room/press-jobs/", {
    params: { machine_iot_id: machineIotId },
  });
  return r.data;
};

export const getActiveWeldingPressJob = async (
  machineIotId: string
): Promise<IWeldingPressJob | null> => {
  const r = await instance.get("welding-room/press-jobs/", {
    params: { machine_iot_id: machineIotId, active: "true" },
  });
  return Array.isArray(r.data) ? (r.data[0] ?? null) : null;
};

export const createWeldingPressJob = async (data: {
  machine_iot_id: string;
  process_name: string;
  style_number?: string;
  std_hot_temp_c: string;
  std_cold_temp_c: string;
  std_hot_duration_s: string;
  std_cold_duration_s: string;
  std_cycle_duration_s: string;
  tolerance_temp_c: string;
  tolerance_duration_s: string;
}): Promise<IWeldingPressJob> => {
  const r = await instance.post("welding-room/press-jobs/", data, {
    headers: { "X-CSRFToken": Cookies.get("csrftoken") || "" },
  });
  return r.data;
};

export const endWeldingPressJob = async (pk: number): Promise<IWeldingPressJob> => {
  const r = await instance.patch(
    `welding-room/press-jobs/${pk}/`,
    { ended_at: new Date().toISOString() },
    { headers: { "X-CSRFToken": Cookies.get("csrftoken") || "" } }
  );
  return r.data;
};
