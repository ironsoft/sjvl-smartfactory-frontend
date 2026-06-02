export interface IRoomPhotos {
  pk: string;
  file: string;
  description: string;
}

export interface IRoomVideos {
  pk: string;
  VideoFile: string;
  ThumbnailFile: string;
  description: string;
}

export interface IRoomList {
  pk: number;
  name: string;
  country: string;
  city: string;
  price: number;
  rating: number;
  is_owner: boolean;
  photos: IRoomPhotos[];
  videos: IRoomVideos[];
}

export interface IRoomListResponse {
  rooms: IRoomList[];
  hasMore: boolean;
}

export interface IRoomOwner {
  pk: number;
  name: string;
  avatar: string;
  username: string;
}

export interface IAmenity {
  pk: number;
  name: string;
  description: string;
}

export interface ICategory {
  pk: number;
  name: string;
  kind: string;
}

export interface IRoomDetail extends IRoomList {
  id: number;
  created_at: string;
  updated_at: string;
  rooms: number;
  toilets: number;
  description: string;
  address: string;
  pet_friendly: true;
  kind: string;
  is_owner: boolean;
  is_liked: boolean;
  category: ICategory;
  owner: IRoomOwner;
  amenities: IAmenity[];
  manager: IUser;
}

export interface IReview {
  payload: string;
  rating: number;
  user: IRoomOwner;
  id: number;
  pk: number;
  created_at: string;
}

export interface IReviewResponse {
  reviews: IReview[];
  total_pages: number;
  review_count: number;
  average_rating: number;
}

export interface IData {
  users: IUser[];
  currentPage: number;
  totalPages: number;
  totalResults: number;
}

export interface IUser {
  pk: number;
  id: number;
  last_login: string;
  username: string;
  email: string;
  date_joined: string;
  avatar: string;
  name: string;
  is_host: boolean;
  gender: string;
  language: string;
  currency: string;
  role: "admin" | "worker" | "user";
  worker_id: number | null;
  /** 공장별 접근 권한 코드 (예: "BD", "VL", "TG", "DEVELOPMENT"). null이면 전체 접근 */
  factory_access: string | null;
}

export interface IUserBookingList {
  pk: number;
  check_in: string;
  check_out: string;
  guests: number;
  room: IRoomList;
  user: IUser;
  created_at: string;
  updated_at: string;
}

export interface IBookingList {
  bookings: IUserBookingList[];
  totalPages: number;
  currentPage: number;
  totalResults: number;
}

export interface IBookingDetail extends IUserBookingList {
  kind: string;
  experience_time: string;
}

export interface IVietnamese {
  pk: number;
  name: string;
  category: string;
  representitive: boolean;
}

export interface IIndonesian {
  pk: number;
  name: string;
  category: string;
  representitive: boolean;
}

export interface IChinese {
  pk: number;
  name: string;
  category: string;
  representitive: boolean;
}

export interface IKorean {
  pk: number;
  name: string;
  category: string;
  representitive: boolean;
}

export interface ISynonym {
  id: number;
  name: string;
  representitive: boolean;
}

export interface IEnglish {
  pk: number;
  name: string;
  description: string;
  name_ko: IKorean;
  synonym_1: ISynonym;
  synonym_2: ISynonym;
  synonym_3: ISynonym;
  ko_en: IKorean[];
  vn_en: IVietnamese[];
  cn_en: IChinese[];
  in_en: IIndonesian[];
}

export interface IEnglishListResponse extends IEnglish {
  results: IEnglish[];
  total_page: number;
  count: number;
}

export interface ITerm {
  id: number;
  name: string;
  language: string;
  category: string;
  material: string;
  description: string;
  representitive: boolean;
  english_term: ITerm;
  korean_term: ITerm;
  chinese_term: ITerm;
  vietnamese_term: ITerm;
  indonesian_term: ITerm;
  synonym_1: ITerm;
  synonym_2: ITerm;
  synonym_3: ITerm;
  synonym_4: ITerm;
  synonym_5: ITerm;
  synonym_6: ITerm;
  synonym_7: ITerm;
  synonym_8: ITerm;
  synonym_9: ITerm;
  synonym_10: ITerm;
  photo: string;
  photos: IRoomPhotos[];
}

export interface ITermListResponse {
  bagterms: ITerm[];
  totalPages: number;
  currentPage: number;
}

export interface ITranslateVariables {
  text: string;
  source: string;
  target: string;
}

export interface IArticle {
  id: number;
  content: string;
  category: string;
  photos: IRoomPhotos[];
  videos: IRoomVideos[];
}


export interface IBlog {
  id: number;
  title: string;
  description: string;
  created_at: string;
  updated_at: string;
  author: IUser;
  category: string;
  photos: IRoomPhotos[];
  videos: IRoomVideos[];
  articles: IArticle[];
}

export interface IBlogListResponse {
  blogs: IBlog[];
  total_pages: number;
  current_page: number;
}

export interface IBlogForm {
  id: number;
  title: string;
  description: string;
  category: string;
}

export interface IArticleForm {
  id: number;
  content: string;
  category: string;
}

// ──────────────────────────────────────────────────────────────
// SJ Kaizen
// ──────────────────────────────────────────────────────────────

export type KaizenCategory =
  | "process"
  | "quality"
  | "safety"
  | "equipment"
  | "other";

export interface ISjKaizenMedia {
  id: number;
  post: number;
  media_type: "image" | "video";
  file_url: string;
  video_url: string;
  thumbnail_url: string;
  caption: string;
  order: number;
  created_at: string;
}

export interface IKaizenPhoto {
  pk: number;
  file: string;
  description: string;
  kaizen_post: number | null;
}

export interface IKaizenVideo {
  pk: number;
  VideoFile: string;
  ThumbnailFile: string | null;
  description: string | null;
  kaizen_post: number | null;
}

export interface ISjKaizenPost {
  id: number;
  title: string;
  content: Record<string, unknown>;
  category: KaizenCategory;
  author: number | null;
  author_name: string | null;
  thumbnail_url: string;
  sj_style: number | null;
  sj_style_code: string | null;
  sj_style_name: string | null;
  sj_style_thumbnail: string | null;
  sj_no: number | null;
  sj_no_value: string | null;
  factory: number | null;
  factory_name: string | null;
  production_line: number | null;
  production_line_name: string | null;
  module: number | null;
  module_info: { pk: number; code: string; name: string } | null;
  process: number | null;
  process_info: { pk: number; code: string; name: string } | null;
  is_published: boolean;
  media_items: ISjKaizenMedia[];
  photos: IKaizenPhoto[];
  videos: IKaizenVideo[];
  media_count?: number;
  created_at: string;
  updated_at: string;
}

export interface ISjKaizenListResponse {
  results: ISjKaizenPost[];
  current_page: number;
  total_pages: number;
  total_results: number;
}

export interface ISjKaizenPostForm {
  title: string;
  content: Record<string, unknown>;
  category: KaizenCategory;
  author?: number | null;
  thumbnail_url?: string;
  sj_style?: number | null;
  sj_no?: number | null;
  factory?: number | null;
  production_line?: number | null;
  module?: number | null;
  process?: number | null;
  is_published?: boolean;
}

export interface ICloudflareImageUploadResult {
  upload_url: string;
  id: string;
}

export interface ICloudflareVideoUploadResult {
  upload_url: string;
  stream_media_id: string;
}