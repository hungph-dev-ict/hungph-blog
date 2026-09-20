export interface User {
  id: string;
  email: string;
  username: string;
  full_name?: string;
  avatar_url?: string;
  role?: string;
  is_admin: boolean;
  is_active?: boolean;
  created_at: string;
}

export interface Comment {
  id: string;
  post_id: string;
  user_id?: string;
  author_name: string;
  author_avatar?: string;
  content: string;
  parent_id?: string;
  created_at: string;
  replies?: Comment[];
}

export interface Tag {
  id: string;
  name: string;
  slug: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string;
  created_at: string;
  post_count?: number;
}

export interface AuthorBrief {
  id: string;
  username: string;
  full_name?: string;
  avatar_url?: string;
}

export interface LessonBrief {
  id: string;
  title: string;
  slug: string;
  reading_time_minutes: number;
  is_published: boolean;
  order_in_chapter: number;
}

export interface Chapter {
  id: string;
  series_id: string;
  parent_id?: string;
  level?: number;
  title: string;
  order: number;
  description?: string;
  created_at: string;
  lessons?: LessonBrief[];
  sub_chapters?: Chapter[];
}

export interface SeriesBrief {
  id: string;
  title: string;
  slug: string;
}

export interface Series {
  id: string;
  title: string;
  slug: string;
  summary?: string;
  cover_image?: string;
  is_published: boolean;
  category_id?: string;
  hierarchy_config?: string;
  attribution_text?: string;
  created_at: string;
  category?: Category;
  author?: AuthorBrief;
  author_id?: string;
  total_chapters: number;
  total_lessons: number;
  total_reading_time_minutes?: number;
}

export interface SeriesDetail extends Series {
  chapters: Chapter[];
}

export interface PostListItem {
  id: string;
  title: string;
  slug: string;
  summary?: string;
  cover_image?: string;
  is_published: boolean;
  published_at?: string;
  reading_time_minutes: number;
  views_count: number;
  likes_count?: number;
  category?: Category;
  tags: Tag[];
  author?: AuthorBrief;
  series_id?: string;
  series?: SeriesBrief;
  chapter_id?: string;
  order_in_chapter?: number;
  created_at: string;
  updated_at: string;
}

export interface PostDetail extends PostListItem {
  content_html: string;
  content_markdown?: string;
  series_outline?: SeriesDetail;
  prev_post?: LessonBrief;
  next_post?: LessonBrief;
}

export interface PaginatedPosts {
  items: PostListItem[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export interface UploadResponse {
  url: string;
  filename: string;
}

// ── Social Features ───────────────────────────────────────────

export interface UserBrief {
  id: string;
  username: string;
  full_name?: string;
  avatar_url?: string;
}

export interface UserProfile extends UserBrief {
  created_at: string;
  followers_count: number;
  following_count: number;
}

export interface FollowStatus {
  is_following: boolean;
  followers_count: number;
  following_count: number;
}

export interface Notification {
  id: string;
  type: "collab_request" | "collab_accepted" | "collab_rejected" | "new_follower" | "new_post";
  actor_id?: string;
  actor?: UserBrief;
  target_id?: string;
  target_type?: "series" | "post";
  message?: string;
  is_read: boolean;
  created_at: string;
}

export interface LikeStatus {
  liked: boolean;
  likes_count: number;
}

export interface Collaborator {
  id: string;
  user_id: string;
  username: string;
  full_name?: string;
  avatar_url?: string;
  status: "pending" | "accepted" | "rejected";
  message?: string;
  created_at: string;
}

export interface PostReport {
  id: string;
  post_id: string;
  post_title?: string;
  post_slug?: string;
  reporter_id?: string;
  reporter_username?: string;
  reason: string;
  description?: string;
  status: "pending" | "reviewed" | "dismissed" | "action_taken";
  admin_note?: string;
  created_at: string;
}

export const REPORT_REASONS: Record<string, string> = {
  spam: "Spam / Quảng cáo",
  inappropriate: "Nội dung không phù hợp",
  misinformation: "Thông tin sai lệch",
  copyright: "Vi phạm bản quyền",
  other: "Lý do khác",
};

