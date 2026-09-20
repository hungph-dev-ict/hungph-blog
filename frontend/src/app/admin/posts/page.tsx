"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Plus,
  Edit,
  Trash2,
  ExternalLink,
  Eye,
  Calendar,
  CheckCircle,
  FileText,
  AlertCircle,
  Search,
  Filter,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Loader2,
  X,
  RefreshCw,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { fetchPosts, deletePost, updatePost, fetchCategories } from "@/lib/api";
import { Category, PostListItem } from "@/lib/types";
import { Breadcrumbs } from "@/components/common/Breadcrumbs";
import { AdminNav } from "@/components/admin/AdminNav";

export default function AdminPostsPage() {
  const router = useRouter();
  const { user, token, isLoading } = useAuth();
  const [posts, setPosts] = useState<PostListItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter & Search & Sort states
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<"all" | "published" | "draft">("all");
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "views" | "title">("newest");

  // Pagination state
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 10;

  // Concurrent action blocking states
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const isAdmin = user?.role === "admin" || user?.is_admin;
  const isProcessing = Boolean(actionLoadingId);

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/");
    }
  }, [user, isLoading, router]);

  const loadAllPosts = async () => {
    setLoading(true);
    try {
      const [postsData, catsData] = await Promise.all([
        fetchPosts({ limit: 100, include_drafts: true }),
        fetchCategories(),
      ]);
      setPosts(postsData.items);
      setCategories(catsData);
    } catch (err) {
      console.error("Lỗi khi tải bài viết:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      loadAllPosts();
    }
  }, [token]);

  // Handle Delete Post
  const handleDelete = async (id: string, title: string) => {
    if (!token || isProcessing) return;
    if (!window.confirm(`Bạn có chắc muốn xóa bài viết "${title}" không?`)) return;

    setActionLoadingId(id);
    try {
      await deletePost(id, token);
      setPosts((prev) => prev.filter((p) => p.id !== id));
    } catch (err: any) {
      alert(`Lỗi khi xóa bài viết: ${err.message}`);
    } finally {
      setActionLoadingId(null);
    }
  };

  // Handle Toggle Publish/Draft
  const handleTogglePublish = async (post: PostListItem) => {
    if (!token || isProcessing) return;
    const targetStatus = !post.is_published;
    const actionLabel = targetStatus ? "xuất bản" : "chuyển về bản nháp";

    if (!window.confirm(`Bạn có muốn ${actionLabel} bài viết "${post.title}"?`)) return;

    setActionLoadingId(post.id);
    try {
      const updated = await updatePost(
        post.id,
        {
          title: post.title,
          content_html: "", // Keep unchanged on backend if empty/optional
          is_published: targetStatus,
        },
        token
      );
      setPosts((prev) =>
        prev.map((p) => (p.id === post.id ? { ...p, is_published: updated.is_published } : p))
      );
    } catch (err: any) {
      alert(`Lỗi khi ${actionLabel}: ${err.message}`);
    } finally {
      setActionLoadingId(null);
    }
  };

  // Filter & Sort computation
  const filteredPosts = useMemo(() => {
    let result = isAdmin ? posts : posts.filter((p) => p.author?.id === user?.id);

    // Filter by search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          p.slug.toLowerCase().includes(q) ||
          (p.author?.full_name && p.author.full_name.toLowerCase().includes(q)) ||
          (p.author?.username && p.author.username.toLowerCase().includes(q)) ||
          (p.category?.name && p.category.name.toLowerCase().includes(q))
      );
    }

    // Filter by status
    if (selectedStatus === "published") {
      result = result.filter((p) => p.is_published);
    } else if (selectedStatus === "draft") {
      result = result.filter((p) => !p.is_published);
    }

    // Filter by category
    if (selectedCategory) {
      result = result.filter((p) => p.category?.slug === selectedCategory);
    }

    // Sort
    return [...result].sort((a, b) => {
      if (sortBy === "newest") {
        const dateA = new Date(a.published_at || a.created_at).getTime();
        const dateB = new Date(b.published_at || b.created_at).getTime();
        return dateB - dateA;
      }
      if (sortBy === "oldest") {
        const dateA = new Date(a.published_at || a.created_at).getTime();
        const dateB = new Date(b.published_at || b.created_at).getTime();
        return dateA - dateB;
      }
      if (sortBy === "views") {
        return (b.views_count || 0) - (a.views_count || 0);
      }
      if (sortBy === "title") {
        return a.title.localeCompare(b.title, "vi");
      }
      return 0;
    });
  }, [posts, isAdmin, user, searchQuery, selectedStatus, selectedCategory, sortBy]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedStatus, selectedCategory, sortBy]);

  // Pagination slice
  const totalPosts = filteredPosts.length;
  const totalPages = Math.max(1, Math.ceil(totalPosts / pageSize));
  const validPage = Math.min(Math.max(1, currentPage), totalPages);

  const paginatedPosts = useMemo(() => {
    const start = (validPage - 1) * pageSize;
    return filteredPosts.slice(start, start + pageSize);
  }, [filteredPosts, validPage, pageSize]);

  const startPost = totalPosts === 0 ? 0 : (validPage - 1) * pageSize + 1;
  const endPost = Math.min(validPage * pageSize, totalPosts);

  if (isLoading || !user) {
    return (
      <div className="py-20 text-center text-sm text-stone-500 animate-pulse">
        Đang kiểm tra quyền truy cập...
      </div>
    );
  }

  return (
    <div className="w-full space-y-6 pb-16">
      <Breadcrumbs
        items={[
          { label: "Quản trị", href: "/admin/posts" },
          { label: isAdmin ? "Quản lý bài viết" : "Bài viết của tôi" },
        ]}
      />

      {/* Top Bar Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-stone-200 dark:border-stone-800 pb-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-bold text-stone-900 dark:text-white">
              {isAdmin ? "Quản Lý Bài Viết" : "Bài Viết Của Tôi"}
            </h1>
            <span
              className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                isAdmin
                  ? "bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800"
                  : "bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300"
              }`}
            >
              {isAdmin ? "Admin" : "Thành viên"}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-stone-500 mt-1">
            Xin chào <span className="font-semibold text-blue-600">{user.full_name || user.username}</span>! Toàn bộ hệ thống hiện có <span className="font-bold text-stone-900 dark:text-white">{posts.length}</span> bài viết.
          </p>
        </div>

        {/* Unified Admin Nav Tab Bar with Highlight and Disable on Active Tab */}
        <AdminNav
          currentTab="posts"
          disabled={isProcessing}
          actionButton={
            <Link
              href="/admin/editor/new"
              className={`inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm shadow-blue-500/25 transition-all ${
                isProcessing ? "pointer-events-none opacity-50" : ""
              }`}
            >
              <Plus className="w-4 h-4" />
              <span>Viết bài mới</span>
            </Link>
          }
        />
      </div>

      {/* Search, Filter & Sort Controls Bar */}
      <div className="p-4 rounded-2xl border border-stone-200/80 dark:border-stone-800 bg-stone-50/50 dark:bg-stone-900/40 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3">
          {/* Search Box */}
          <div className="lg:col-span-5 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 pointer-events-none" />
            <input
              type="text"
              disabled={isProcessing}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm kiếm theo tiêu đề, tác giả, danh mục..."
              className="w-full pl-9 pr-8 py-2 text-xs rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all disabled:opacity-60"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Status Filter */}
          <div className="lg:col-span-3">
            <select
              disabled={isProcessing}
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value as any)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all disabled:opacity-60"
            >
              <option value="all">Tất cả trạng thái</option>
              <option value="published">Đã xuất bản</option>
              <option value="draft">Bản nháp</option>
            </select>
          </div>

          {/* Category Filter */}
          <div className="lg:col-span-2">
            <select
              disabled={isProcessing}
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all disabled:opacity-60"
            >
              <option value="">Tất cả danh mục</option>
              {categories.map((c) => (
                <option key={c.id} value={c.slug}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Sort By */}
          <div className="lg:col-span-2">
            <select
              disabled={isProcessing}
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all disabled:opacity-60"
            >
              <option value="newest">Mới nhất</option>
              <option value="oldest">Cũ nhất</option>
              <option value="views">Lượt xem nhiều</option>
              <option value="title">Tiêu đề (A–Z)</option>
            </select>
          </div>
        </div>

        {/* Results summary and Active Filters count */}
        <div className="flex items-center justify-between text-xs text-stone-500 pt-1 border-t border-stone-200/50 dark:border-stone-800/50">
          <div className="flex items-center gap-2">
            <span>
              {totalPosts === 0 ? "Không có bài viết phù hợp" : `Hiển thị ${startPost}–${endPost} / ${totalPosts} bài viết`}
            </span>
            {(searchQuery || selectedStatus !== "all" || selectedCategory) && (
              <button
                onClick={() => {
                  setSearchQuery("");
                  setSelectedStatus("all");
                  setSelectedCategory("");
                  setSortBy("newest");
                }}
                className="text-blue-600 hover:underline font-medium text-[11px]"
              >
                Xóa bộ lọc
              </button>
            )}
          </div>

          {isProcessing && (
            <div className="flex items-center gap-1.5 text-blue-600 text-[11px] font-medium animate-pulse">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Đang xử lý, vui lòng chờ...</span>
            </div>
          )}
        </div>
      </div>

      {/* Post Table Section */}
      {loading ? (
        <div className="space-y-3 animate-pulse">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-16 rounded-xl bg-stone-100 dark:bg-stone-800" />
          ))}
        </div>
      ) : filteredPosts.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-stone-200 dark:border-stone-800 rounded-3xl space-y-3">
          <FileText className="w-10 h-10 text-stone-400 mx-auto" />
          <h3 className="font-semibold text-stone-800 dark:text-stone-200">
            {posts.length === 0 ? "Chưa có bài viết nào" : "Không tìm thấy bài viết nào phù hợp"}
          </h3>
          <p className="text-sm text-stone-500">
            {posts.length === 0
              ? "Hãy bắt đầu viết bài đầu tiên của bạn!"
              : "Thử thay đổi từ khóa tìm kiếm hoặc làm mới bộ lọc."}
          </p>
          {posts.length === 0 ? (
            <Link
              href="/admin/editor/new"
              className="inline-block mt-2 text-xs font-semibold px-4 py-2 rounded-lg bg-blue-600 text-white"
            >
              Tạo bài viết ngay
            </Link>
          ) : (
            <button
              onClick={() => {
                setSearchQuery("");
                setSelectedStatus("all");
                setSelectedCategory("");
              }}
              className="inline-block mt-2 text-xs font-semibold px-4 py-2 rounded-lg border border-stone-300 dark:border-stone-700 text-stone-700 dark:text-stone-300 hover:bg-stone-100"
            >
              Đặt lại bộ lọc
            </button>
          )}
        </div>
      ) : (
        <div className="border border-stone-200 dark:border-stone-800 rounded-2xl overflow-hidden bg-white dark:bg-stone-900/60 shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-900 text-stone-500 text-xs font-semibold uppercase">
                <tr>
                  <th className="py-3.5 px-4">Tiêu đề bài viết</th>
                  {isAdmin && <th className="py-3.5 px-4">Tác giả</th>}
                  <th className="py-3.5 px-4">Trạng thái</th>
                  <th className="py-3.5 px-4">Danh mục</th>
                  <th className="py-3.5 px-4">Lượt xem</th>
                  <th className="py-3.5 px-4">Thời gian</th>
                  <th className="py-3.5 px-4 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 dark:divide-stone-800/60">
                {paginatedPosts.map((post) => {
                  const canManage = isAdmin || post.author?.id === user.id;
                  const isItemLoading = actionLoadingId === post.id;

                  return (
                    <tr
                      key={post.id}
                      className="hover:bg-stone-50/70 dark:hover:bg-stone-800/40 transition-colors"
                    >
                      <td className="py-4 px-4 font-semibold text-stone-900 dark:text-stone-100 max-w-xs truncate">
                        <span title={post.title}>{post.title}</span>
                      </td>

                      {isAdmin && (
                        <td className="py-4 px-4 text-xs text-stone-500 whitespace-nowrap">
                          {post.author?.full_name || post.author?.username || "Admin"}
                        </td>
                      )}

                      <td className="py-4 px-4 whitespace-nowrap">
                        <button
                          type="button"
                          disabled={isProcessing || !canManage}
                          onClick={() => handleTogglePublish(post)}
                          title={canManage ? "Bấm để đổi trạng thái" : undefined}
                          className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full transition-all ${
                            post.is_published
                              ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/60 hover:bg-emerald-100"
                              : "bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border border-amber-200/60 dark:border-amber-800/60 hover:bg-amber-100"
                          } ${isProcessing ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}`}
                        >
                          {isItemLoading ? (
                            <Loader2 className="w-3 h-3 animate-spin text-blue-600" />
                          ) : post.is_published ? (
                            <CheckCircle className="w-3 h-3" />
                          ) : (
                            <AlertCircle className="w-3 h-3" />
                          )}
                          <span>{post.is_published ? "Đã xuất bản" : "Bản nháp"}</span>
                        </button>
                      </td>

                      <td className="py-4 px-4 text-xs text-stone-500 whitespace-nowrap">
                        {post.category?.name || "—"}
                      </td>

                      <td className="py-4 px-4 text-xs text-stone-500 whitespace-nowrap">
                        <span className="flex items-center gap-1">
                          <Eye className="w-3.5 h-3.5 text-stone-400" />
                          {post.views_count}
                        </span>
                      </td>

                      <td className="py-4 px-4 text-xs text-stone-400 whitespace-nowrap">
                        {post.published_at
                          ? new Date(post.published_at).toLocaleDateString("vi-VN")
                          : "—"}
                      </td>

                      <td className="py-4 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          {post.is_published && (
                            <Link
                              href={`/posts/${post.slug}`}
                              target="_blank"
                              className={`p-1.5 rounded-lg text-stone-400 hover:text-blue-600 transition-colors ${
                                isProcessing ? "pointer-events-none opacity-40" : ""
                              }`}
                              title="Xem bài viết"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </Link>
                          )}
                          {canManage && (
                            <>
                              <Link
                                href={`/admin/editor/${post.id}`}
                                className={`p-1.5 rounded-lg text-stone-400 hover:text-stone-900 dark:hover:text-white transition-colors ${
                                  isProcessing ? "pointer-events-none opacity-40" : ""
                                }`}
                                title="Chỉnh sửa bài viết"
                              >
                                <Edit className="w-4 h-4" />
                              </Link>
                              <button
                                onClick={() => handleDelete(post.id, post.title)}
                                disabled={isProcessing}
                                className={`p-1.5 rounded-lg text-stone-400 hover:text-rose-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed`}
                                title="Xóa bài viết"
                              >
                                {isItemLoading ? (
                                  <Loader2 className="w-4 h-4 animate-spin text-rose-500" />
                                ) : (
                                  <Trash2 className="w-4 h-4" />
                                )}
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 border-t border-stone-100 dark:border-stone-800/80 bg-stone-50/40 dark:bg-stone-900/30">
              <span className="text-xs text-stone-500 font-medium">
                Trang {validPage} / {totalPages} (Tổng số {totalPosts} bài)
              </span>

              <div className="flex items-center gap-1.5">
                <button
                  disabled={validPage <= 1 || isProcessing}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-stone-200 dark:border-stone-700 text-xs font-semibold text-stone-700 dark:text-stone-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Trang trước</span>
                </button>

                {/* Page Number Buttons */}
                <div className="flex items-center gap-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNumber) => {
                    // Only show first, last, and around current page
                    if (
                      totalPages > 6 &&
                      pageNumber !== 1 &&
                      pageNumber !== totalPages &&
                      Math.abs(pageNumber - validPage) > 1
                    ) {
                      if (pageNumber === 2 || pageNumber === totalPages - 1) {
                        return (
                          <span key={pageNumber} className="px-1 text-xs text-stone-400">
                            ...
                          </span>
                        );
                      }
                      return null;
                    }

                    const isCurrent = pageNumber === validPage;

                    return (
                      <button
                        key={pageNumber}
                        disabled={isProcessing || isCurrent}
                        onClick={() => setCurrentPage(pageNumber)}
                        className={`w-7 h-7 rounded-lg text-xs font-semibold transition-all ${
                          isCurrent
                            ? "bg-blue-600 text-white shadow-xs pointer-events-none"
                            : "border border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800"
                        }`}
                      >
                        {pageNumber}
                      </button>
                    );
                  })}
                </div>

                <button
                  disabled={validPage >= totalPages || isProcessing}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-stone-200 dark:border-stone-700 text-xs font-semibold text-stone-700 dark:text-stone-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
                >
                  <span>Trang tiếp</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
