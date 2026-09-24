import {
  Category,
  Chapter,
  Collaborator,
  Comment,
  FollowStatus,
  LikeStatus,
  LoginResponse,
  Notification,
  PaginatedPosts,
  PostDetail,
  PostListItem,
  PostReport,
  Series,
  SeriesDetail,
  Tag,
  UploadResponse,
  User,
  UserProfile,
  AuditLog,
  AuditLogListResponse,
  AuditStats,
} from "./types";

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

export const SERVER_HOST =
  process.env.NEXT_PUBLIC_SERVER_HOST || "http://localhost:8000";

export function getFullImageUrl(url?: string | null): string {
  if (!url) return "/default-post.jpg";
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }
  return `${SERVER_HOST}${url.startsWith("/") ? "" : "/"}${url}`;
}

export function getFullCourseImageUrl(url?: string | null): string {
  if (!url) return "/default-course.jpg";
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
export async function fetchPosts(
  params?: {
    page?: number;
    limit?: number;
    category?: string;
    tag?: string;
    search?: string;
    series_id?: string;
    author_id?: string;
    include_drafts?: boolean;
  },
  token?: string | null
): Promise<PaginatedPosts> {
  const query = new URLSearchParams();
  if (params?.page) query.append("page", params.page.toString());
  if (params?.limit) query.append("limit", params.limit.toString());
  if (params?.category) query.append("category", params.category);
  if (params?.tag) query.append("tag", params.tag);
  if (params?.search) query.append("search", params.search);
  if (params?.series_id) query.append("series_id", params.series_id);
  if (params?.author_id) query.append("author_id", params.author_id);
  if (params?.include_drafts) query.append("include_drafts", "true");

  const res = await fetch(`${API_BASE_URL}/blog/posts?${query.toString()}`, {
    headers: getHeaders(token),
    ...(token ? { cache: "no-store" } : { next: { revalidate: 60 } }),
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch posts: ${res.statusText}`);
  }
  return res.json();
}

export async function fetchSpotlightPost(): Promise<PostListItem | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/blog/posts/spotlight`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function fetchWriteableSeries(token: string): Promise<Series[]> {
  const res = await fetch(`${API_BASE_URL}/blog/series/writeable`, {
    headers: getHeaders(token),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error("Failed to fetch writeable series");
  }
  return res.json();
}

export async function fetchPostBySlug(slug: string): Promise<PostDetail> {
  const res = await fetch(`${API_BASE_URL}/blog/posts/${slug}`, {
    next: { revalidate: 60 },
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
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    const error: any = new Error(err.detail || `Failed to fetch post by ID (${res.status})`);
    error.status = res.status;
    throw error;
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
  const res = await fetch(`${API_BASE_URL}/blog/categories`, { next: { revalidate: 300 } });
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
  const res = await fetch(`${API_BASE_URL}/blog/tags`, { next: { revalidate: 300 } });
  if (!res.ok) return [];
  return res.json();
}

// --- SERIES & COURSES ---
export async function fetchSeries(): Promise<Series[]> {
  const res = await fetch(`${API_BASE_URL}/blog/series`, { next: { revalidate: 120 } });
  if (!res.ok) return [];
  return res.json();
}

export async function fetchLatestSeries(): Promise<Series | null> {
  const series = await fetchSeries();
  if (!series || series.length === 0) return null;
  // Sort by created_at descending and return the first one
  return series.sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )[0];
}

export async function fetchSeriesBySlug(slug: string): Promise<SeriesDetail> {
  const res = await fetch(`${API_BASE_URL}/blog/series/${slug}`, {
    next: { revalidate: 60 },
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
    hierarchy_config?: string;
    attribution_text?: string;
    author_id?: string;
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
    hierarchy_config?: string;
    attribution_text?: string;
    author_id?: string;
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
  data: {
    title: string;
    order?: number;
    description?: string;
    parent_id?: string;
    level?: number;
  },
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
  data: {
    title?: string;
    order?: number;
    description?: string;
    parent_id?: string;
    level?: number;
  },
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
export async function getRAGStatus(): Promise<{
  status: string;
  gemini_api_configured: boolean;
  index_exists: boolean;
  num_vectors: number;
  embedding_model: string;
  llm_model: string;
  description: string;
}> {
  const res = await fetch(`${API_BASE_URL}/rag/status`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch RAG status");
  return res.json();
}

export async function queryRAG(query: string, top_k = 5): Promise<{
  answer: string;
  sources: Array<{ title: string; slug: string; similarity_score: number; snippet: string }>;
  model?: string;
}> {
  const res = await fetch(`${API_BASE_URL}/rag/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, top_k }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "RAG service unavailable");
  }
  return res.json();
}

export async function triggerRAGIndex(token: string): Promise<{ success: boolean; message: string; num_posts: number }> {
  const res = await fetch(`${API_BASE_URL}/rag/index`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to trigger RAG indexing");
  }
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

export async function updateComment(commentId: string, content: string, token: string): Promise<Comment> {
  const res = await fetch(`${API_BASE_URL}/blog/comments/${commentId}`, {
    method: "PUT",
    headers: getHeaders(token),
    body: JSON.stringify({ content }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || "Không thể cập nhật bình luận");
  }
  return res.json();
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

// --- USER & MEMBER MANAGEMENT ---
export async function fetchUsers(token: string): Promise<User[]> {
  const res = await fetch(`${API_BASE_URL}/auth/users`, {
    headers: getHeaders(token),
    cache: "no-store",
  });
  if (!res.ok) return [];
  return res.json();
}

export async function updateUserRole(
  userId: string,
  role: string,
  isActive: boolean | undefined,
  token: string
): Promise<User> {
  const res = await fetch(`${API_BASE_URL}/auth/users/${userId}/role`, {
    method: "PUT",
    headers: getHeaders(token),
    body: JSON.stringify({ role, is_active: isActive }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || "Không thể cập nhật quyền thành viên");
  }
  return res.json();
}

export async function deleteUser(userId: string, token: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/auth/users/${userId}`, {
    method: "DELETE",
    headers: getHeaders(token),
  });
  if (!res.ok) {
    throw new Error("Không thể xóa thành viên");
  }
}

// ── Social: Follow ────────────────────────────────────────────────

export async function toggleFollow(userId: string, token: string): Promise<FollowStatus> {
  const res = await fetch(`${API_BASE_URL}/social/follow/${userId}`, {
    method: "POST",
    headers: getHeaders(token),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getFollowStatus(userId: string, token?: string): Promise<FollowStatus> {
  const res = await fetch(`${API_BASE_URL}/social/follow-status/${userId}`, {
    headers: token ? getHeaders(token) : {},
  });
  return res.json();
}

export async function getUserProfile(username: string): Promise<UserProfile> {
  const res = await fetch(`${API_BASE_URL}/social/profile/${username}`);
  if (!res.ok) throw new Error("Không tìm thấy người dùng");
  return res.json();
}

// ── Social: Notifications ────────────────────────────────────────

export async function getNotifications(token: string, limit = 20, offset = 0): Promise<Notification[]> {
  const res = await fetch(`${API_BASE_URL}/notifications/?limit=${limit}&offset=${offset}`, {
    headers: getHeaders(token),
  });
  return res.json();
}

export async function getUnreadCount(token: string): Promise<number> {
  const res = await fetch(`${API_BASE_URL}/notifications/unread-count`, {
    headers: getHeaders(token),
  });
  const data = await res.json();
  return data.count ?? 0;
}

export async function markNotificationRead(id: string, token: string): Promise<void> {
  await fetch(`${API_BASE_URL}/notifications/${id}/read`, {
    method: "PUT",
    headers: getHeaders(token),
  });
}

export async function markAllNotificationsRead(token: string): Promise<void> {
  await fetch(`${API_BASE_URL}/notifications/read-all`, {
    method: "PUT",
    headers: getHeaders(token),
  });
}

// ── Social: Likes ───────────────────────────────────────────────

export async function toggleLike(postId: string, token: string): Promise<LikeStatus> {
  const res = await fetch(`${API_BASE_URL}/blog/posts/${postId}/like`, {
    method: "POST",
    headers: getHeaders(token),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getLikeStatus(postId: string, token?: string): Promise<LikeStatus> {
  const res = await fetch(`${API_BASE_URL}/blog/posts/${postId}/like-status`, {
    headers: token ? getHeaders(token) : {},
  });
  return res.json();
}

// ── Social: Reports ───────────────────────────────────────────

export async function reportPost(
  postId: string,
  reason: string,
  description: string | undefined,
  token: string
): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/blog/posts/${postId}/report`, {
    method: "POST",
    headers: getHeaders(token),
    body: JSON.stringify({ reason, description }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Không thể gửi tố cáo");
  }
}

export async function getAdminReports(token: string, status?: string): Promise<PostReport[]> {
  const url = status
    ? `${API_BASE_URL}/blog/admin/reports?status=${status}`
    : `${API_BASE_URL}/blog/admin/reports`;
  const res = await fetch(url, { headers: getHeaders(token) });
  return res.json();
}

export async function updateReport(
  reportId: string,
  status: string,
  adminNote: string | undefined,
  token: string
): Promise<PostReport> {
  const res = await fetch(`${API_BASE_URL}/blog/admin/reports/${reportId}`, {
    method: "PUT",
    headers: getHeaders(token),
    body: JSON.stringify({ status, admin_note: adminNote }),
  });
  return res.json();
}

// ── Collaboration ───────────────────────────────────────────────

export async function requestCollaboration(
  seriesId: string,
  message: string | undefined,
  token: string
): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/blog/series/${seriesId}/request-collaboration`, {
    method: "POST",
    headers: getHeaders(token),
    body: JSON.stringify({ message }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Không thể gửi yêu cầu");
  }
}

export async function getCollaborators(seriesId: string, token: string): Promise<Collaborator[]> {
  const res = await fetch(`${API_BASE_URL}/blog/series/${seriesId}/collaborators`, {
    headers: getHeaders(token),
  });
  if (!res.ok) return [];
  return res.json();
}

export async function addCollaboratorDirect(
  seriesId: string,
  userId: string,
  token: string
): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/blog/series/${seriesId}/collaborators`, {
    method: "POST",
    headers: getHeaders(token),
    body: JSON.stringify({ user_id: userId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Thêm cộng tác viên thất bại");
  }
}

export async function updateCollaborator(
  seriesId: string,
  userId: string,
  status: "accepted" | "rejected",
  token: string
): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/blog/series/${seriesId}/collaborators/${userId}`, {
    method: "PUT",
    headers: getHeaders(token),
    body: JSON.stringify({ status }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Cập nhật cộng tác viên thất bại");
  }
}

export async function removeCollaborator(seriesId: string, userId: string, token: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/blog/series/${seriesId}/collaborators/${userId}`, {
    method: "DELETE",
    headers: getHeaders(token),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Xóa cộng tác viên thất bại");
  }
}

export async function fetchLinkMetadata(url: string): Promise<{ url: string; title: string; site_name: string }> {
  try {
    const res = await fetch(`${API_BASE_URL}/utilities/link-metadata`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });
    if (!res.ok) {
      return { url, title: url, site_name: "" };
    }
    return res.json();
  } catch {
    return { url, title: url, site_name: "" };
  }
}

export async function updateMyProfile(
  data: { full_name?: string; avatar_url?: string; bio?: string },
  token: string
): Promise<User> {
  const res = await fetch(`${API_BASE_URL}/auth/me`, {
    method: "PUT",
    headers: getHeaders(token),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Cập nhật hồ sơ thất bại");
  }
  return res.json();
}

// ── Admin: Audit Logs ──────────────────────────────────────────

export async function getAuditLogs(
  params: {
    page?: number;
    limit?: number;
    action?: string;
    target_type?: string;
    search?: string;
  },
  token: string
): Promise<AuditLogListResponse> {
  const query = new URLSearchParams();
  if (params.page) query.set("page", String(params.page));
  if (params.limit) query.set("limit", String(params.limit));
  if (params.action) query.set("action", params.action);
  if (params.target_type) query.set("target_type", params.target_type);
  if (params.search) query.set("search", params.search);

  const qs = query.toString() ? `?${query.toString()}` : "";
  const res = await fetch(`${API_BASE_URL}/admin/audit-logs${qs}`, {
    headers: getHeaders(token),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Không thể tải nhật ký hệ thống");
  }
  return res.json();
}

export async function getAuditStats(token: string): Promise<AuditStats> {
  const res = await fetch(`${API_BASE_URL}/admin/audit-logs/stats`, {
    headers: getHeaders(token),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Không thể tải thống kê nhật ký");
  }
  return res.json();
}




