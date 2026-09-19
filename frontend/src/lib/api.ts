import {
  Category,
  Chapter,
  Comment,
  LoginResponse,
  PaginatedPosts,
  PostDetail,
  PostListItem,
  Series,
  SeriesDetail,
  Tag,
  UploadResponse,
  User,
} from "./types";

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

export const SERVER_HOST =
  process.env.NEXT_PUBLIC_SERVER_HOST || "http://localhost:8000";

export function getFullImageUrl(url?: string | null): string {
  if (!url) return "https://images.unsplash.com/photo-1499750310107-5fef28a66643?auto=format&fit=crop&w=1200&q=80";
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }
  return `${SERVER_HOST}${url.startsWith("/") ? "" : "/"}${url}`;
}

function getHeaders(token?: string | null): HeadersInit {
  const headers: HeadersInit = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
}

// --- POSTS ---
export async function fetchPosts(params?: {
  page?: number;
  limit?: number;
  category?: string;
  tag?: string;
  search?: string;
  series_id?: string;
  include_drafts?: boolean;
}): Promise<PaginatedPosts> {
  const query = new URLSearchParams();
  if (params?.page) query.append("page", params.page.toString());
  if (params?.limit) query.append("limit", params.limit.toString());
  if (params?.category) query.append("category", params.category);
  if (params?.tag) query.append("tag", params.tag);
  if (params?.search) query.append("search", params.search);
  if (params?.series_id) query.append("series_id", params.series_id);
  if (params?.include_drafts) query.append("include_drafts", "true");

  const res = await fetch(`${API_BASE_URL}/blog/posts?${query.toString()}`, {
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch posts: ${res.statusText}`);
  }
  return res.json();
}

export async function fetchPostBySlug(slug: string): Promise<PostDetail> {
  const res = await fetch(`${API_BASE_URL}/blog/posts/${slug}`, {
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Post not found: ${slug}`);
  }
  return res.json();
}

export async function fetchPostById(id: string, token: string): Promise<PostDetail> {
  const res = await fetch(`${API_BASE_URL}/blog/posts/id/${id}`, {
    headers: getHeaders(token),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch post by ID`);
  }
  return res.json();
}

export async function createPost(
  data: {
    title: string;
    slug?: string;
    summary?: string;
    content_html: string;
    content_markdown?: string;
    cover_image?: string;
    is_published: boolean;
    category_id?: string;
    series_id?: string;
    chapter_id?: string;
    order_in_chapter?: number;
    tags: string[];
  },
  token: string
): Promise<PostDetail> {
  const res = await fetch(`${API_BASE_URL}/blog/posts`, {
    method: "POST",
    headers: getHeaders(token),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || "Failed to create post");
  }
  return res.json();
}

export async function updatePost(
  id: string,
  data: {
    title?: string;
    slug?: string;
    summary?: string;
    content_html?: string;
    content_markdown?: string;
    cover_image?: string;
    is_published?: boolean;
    category_id?: string;
    series_id?: string;
    chapter_id?: string;
    order_in_chapter?: number;
    tags?: string[];
  },
  token: string
): Promise<PostDetail> {
  const res = await fetch(`${API_BASE_URL}/blog/posts/${id}`, {
    method: "PUT",
    headers: getHeaders(token),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || "Failed to update post");
  }
  return res.json();
}

export async function deletePost(id: string, token: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/blog/posts/${id}`, {
    method: "DELETE",
    headers: getHeaders(token),
  });
  if (!res.ok) {
    throw new Error("Failed to delete post");
  }
}

// --- CATEGORIES & TAGS ---
export async function fetchCategories(): Promise<Category[]> {
  const res = await fetch(`${API_BASE_URL}/blog/categories`, { cache: "no-store" });
  if (!res.ok) return [];
  return res.json();
}

export async function createCategory(
  data: { name: string; description?: string },
  token: string
): Promise<Category> {
  const res = await fetch(`${API_BASE_URL}/blog/categories`, {
    method: "POST",
    headers: getHeaders(token),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || "Failed to create category");
  }
  return res.json();
}

export async function updateCategory(
  id: string,
  data: { name?: string; description?: string; slug?: string },
  token: string
): Promise<Category> {
  const res = await fetch(`${API_BASE_URL}/blog/categories/${id}`, {
    method: "PUT",
    headers: getHeaders(token),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || "Failed to update category");
  }
  return res.json();
}

export async function deleteCategory(id: string, token: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/blog/categories/${id}`, {
    method: "DELETE",
    headers: getHeaders(token),
  });
  if (!res.ok) {
    throw new Error("Failed to delete category");
  }
}

export async function fetchTags(): Promise<Tag[]> {
  const res = await fetch(`${API_BASE_URL}/blog/tags`, { cache: "no-store" });
  if (!res.ok) return [];
  return res.json();
}

// --- SERIES & COURSES ---
export async function fetchSeries(): Promise<Series[]> {
  const res = await fetch(`${API_BASE_URL}/blog/series`, { cache: "no-store" });
  if (!res.ok) return [];
  return res.json();
}

export async function fetchSeriesBySlug(slug: string): Promise<SeriesDetail> {
  const res = await fetch(`${API_BASE_URL}/blog/series/${slug}`, {
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Series not found: ${slug}`);
  }
  return res.json();
}

export async function createSeries(
  data: {
    title: string;
    slug?: string;
    summary?: string;
    cover_image?: string;
    is_published?: boolean;
    category_id?: string;
  },
  token: string
): Promise<Series> {
  const res = await fetch(`${API_BASE_URL}/blog/series`, {
    method: "POST",
    headers: getHeaders(token),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || "Failed to create series");
  }
  return res.json();
}

export async function updateSeries(
  id: string,
  data: {
    title?: string;
    slug?: string;
    summary?: string;
    cover_image?: string;
    is_published?: boolean;
    category_id?: string;
  },
  token: string
): Promise<Series> {
  const res = await fetch(`${API_BASE_URL}/blog/series/${id}`, {
    method: "PUT",
    headers: getHeaders(token),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || "Failed to update series");
  }
  return res.json();
}

export async function deleteSeries(id: string, token: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/blog/series/${id}`, {
    method: "DELETE",
    headers: getHeaders(token),
  });
  if (!res.ok) {
    throw new Error("Failed to delete series");
  }
}

export async function addChapter(
  seriesId: string,
  data: { title: string; order?: number; description?: string },
  token: string
): Promise<Chapter> {
  const res = await fetch(`${API_BASE_URL}/blog/series/${seriesId}/chapters`, {
    method: "POST",
    headers: getHeaders(token),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || "Failed to create chapter");
  }
  return res.json();
}

export async function updateChapter(
  chapterId: string,
  data: { title?: string; order?: number; description?: string },
  token: string
): Promise<Chapter> {
  const res = await fetch(`${API_BASE_URL}/blog/chapters/${chapterId}`, {
    method: "PUT",
    headers: getHeaders(token),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || "Failed to update chapter");
  }
  return res.json();
}

export async function deleteChapter(chapterId: string, token: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/blog/chapters/${chapterId}`, {
    method: "DELETE",
    headers: getHeaders(token),
  });
  if (!res.ok) {
    throw new Error("Failed to delete chapter");
  }
}

// --- MEDIA UPLOAD ---
export async function uploadMedia(file: File, token: string): Promise<UploadResponse> {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(`${API_BASE_URL}/media/upload`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Upload failed" }));
    throw new Error(err.detail || "Failed to upload image");
  }
  return res.json();
}

// --- AUTH ---
export async function loginUser(
  identifier: string,
  password: string
): Promise<LoginResponse> {
  const res = await fetch(`${API_BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username_or_email: identifier, password }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Invalid credentials" }));
    throw new Error(err.detail || "Login failed");
  }
  return res.json();
}

export async function fetchMyProfile(token: string): Promise<User> {
  const res = await fetch(`${API_BASE_URL}/auth/me`, {
    headers: getHeaders(token),
  });
  if (!res.ok) throw new Error("Unauthorized");
  return res.json();
}

// --- UTILITIES & RAG ---
export async function queryRAG(query: string): Promise<{ answer: string; sources: any[] }> {
  const res = await fetch(`${API_BASE_URL}/rag/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  if (!res.ok) throw new Error("RAG service unavailable");
  return res.json();
}

export async function analyzeText(text: string): Promise<any> {
  const res = await fetch(`${API_BASE_URL}/utilities/text-stats`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) throw new Error("Text analysis failed");
  return res.json();
}

// --- COMMENTS (WordPress Style & Gmail Login) ---
export async function fetchComments(postIdOrSlug: string): Promise<Comment[]> {
  const res = await fetch(`${API_BASE_URL}/blog/posts/${postIdOrSlug}/comments`, {
    cache: "no-store",
  });
  if (!res.ok) return [];
  return res.json();
}

export async function createComment(
  postIdOrSlug: string,
  data: {
    content: string;
    author_name?: string;
    author_email?: string;
    parent_id?: string;
  },
  token?: string | null
): Promise<Comment> {
  const res = await fetch(`${API_BASE_URL}/blog/posts/${postIdOrSlug}/comments`, {
    method: "POST",
    headers: getHeaders(token),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || "Không thể gửi bình luận");
  }
  return res.json();
}

export async function deleteComment(commentId: string, token: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/blog/comments/${commentId}`, {
    method: "DELETE",
    headers: getHeaders(token),
  });
  if (!res.ok) {
    throw new Error("Không thể xóa bình luận");
  }
}

export async function loginWithGoogle(payload: {
  credential?: string;
  email?: string;
  name?: string;
  picture?: string;
}): Promise<LoginResponse> {
  const res = await fetch(`${API_BASE_URL}/auth/google`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || "Đăng nhập Google thất bại");
  }
  return res.json();
}
