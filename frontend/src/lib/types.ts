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
  title: string;
  order: number;
  description?: string;
  created_at: string;
  lessons?: LessonBrief[];
}

export interface Series {
  id: string;
  title: string;
  slug: string;
  summary?: string;
  cover_image?: string;
  is_published: boolean;
  category_id?: string;
  created_at: string;
  category?: Category;
  total_chapters: number;
  total_lessons: number;
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
  category?: Category;
  tags: Tag[];
  author?: AuthorBrief;
  series_id?: string;
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
