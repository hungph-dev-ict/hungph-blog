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
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronLeft,
  ChevronRight,
  Loader2,
  X,
  PenTool,
  Camera,
  Image as ImageIcon,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { fetchPosts, deletePost, updatePost, fetchCategories, getFullImageUrl } from "@/lib/api";
import { Category, PostListItem } from "@/lib/types";
import { Breadcrumbs } from "@/components/common/Breadcrumbs";
import { Pagination } from "@/components/common/Pagination";
import { LoadingOverlay } from "@/components/common/LoadingOverlay";
import { EditCoverModal } from "@/components/blog/EditCoverModal";

type SortColumn = "title" | "status" | "category" | "views" | "date";
type SortDirection = "asc" | "desc";

export default function MemberPostsManagePage() {
  const router = useRouter();
  const { user, token, isLoading } = useAuth();
  const [posts, setPosts] = useState<PostListItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [coverModalPost, setCoverModalPost] = useState<PostListItem | null>(null);

  // Filter & Search & Sort states
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<"all" | "published" | "draft">("all");
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [sortColumn, setSortColumn] = useState<SortColumn>("date");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  // Pagination state
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 10;

  // Concurrent action blocking states
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string>("");
  const isProcessing = Boolean(actionLoadingId);

  // Auth check
  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/login?redirect=/posts/manage");
    }
  }, [user, isLoading, router]);

  const loadMyPosts = async () => {
    if (!token || !user) return;
    setLoading(true);
    try {
      const [postsData, catsData] = await Promise.all([
        fetchPosts(
          {
            limit: 100,
            include_drafts: true,
            author_id: user.id,
          },
          token
        ),
        fetchCategories(),
      ]);
      setPosts(postsData.items);
      setCategories(catsData);
    } catch (err) {
      console.error("Lỗi khi tải bài viết cá nhân:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token && user) {
      loadMyPosts();
    }
  }, [token, user?.id]);

  // Handle Delete Post
  const handleDelete = async (id: string, title: string) => {
    if (!token || isProcessing) return;
    if (!window.confirm(`Bạn có chắc muốn xóa bài viết "${title}" không?`)) return;

    setActionLoadingId(id);
    setActionMessage("Đang xóa bài viết...");
    try {
      await deletePost(id, token);
      setPosts((prev) => prev.filter((p) => p.id !== id));
    } catch (err: any) {
      alert(`Lỗi khi xóa bài viết: ${err.message}`);
    } finally {
      setActionLoadingId(null);
      setActionMessage("");
    }
  };

  // Handle Toggle Publish/Draft
  const handleTogglePublish = async (post: PostListItem) => {
    if (!token || isProcessing) return;
    const targetStatus = !post.is_published;
    const actionLabel = targetStatus ? "xuất bản" : "chuyển về bản nháp";

    if (!window.confirm(`Bạn có muốn ${actionLabel} bài viết "${post.title}"?`)) return;

    setActionLoadingId(post.id);
    setActionMessage(targetStatus ? "Đang xuất bản bài viết..." : "Đang chuyển bài viết về bản nháp...");
    try {
      const updated = await updatePost(
        post.id,
        {
          title: post.title,
          content_html: "",
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
      setActionMessage("");
    }
  };

  // Sort handler
  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortColumn(column);
      setSortDirection(column === "date" || column === "views" ? "desc" : "asc");
    }
  };

  // Filter & Sort computation
  const filteredPosts = useMemo(() => {
    let result = posts.filter((p) => p.author?.id === user?.id || !p.author);

    // Filter by search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          p.slug.toLowerCase().includes(q) ||
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
      let comparison = 0;
      switch (sortColumn) {
        case "title":
          comparison = a.title.localeCompare(b.title, "vi");
          break;
        case "status": {
          const statusA = a.is_published ? 1 : 0;
          const statusB = b.is_published ? 1 : 0;
          comparison = statusA - statusB;
          break;
        }
        case "category": {
          const catA = a.category?.name || "";
          const catB = b.category?.name || "";
          comparison = catA.localeCompare(catB, "vi");
          break;
        }
        case "views": {
          const viewsA = a.views_count || 0;
          const viewsB = b.views_count || 0;
          comparison = viewsA - viewsB;
          break;
        }
        case "date": {
          const dateA = new Date(a.published_at || a.created_at).getTime();
          const dateB = new Date(b.published_at || b.created_at).getTime();
          comparison = dateA - dateB;
          break;
        }
        default:
          comparison = 0;
      }
      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [posts, user?.id, searchQuery, selectedStatus, selectedCategory, sortColumn, sortDirection]);

  // Reset page when filters or sorting change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedStatus, selectedCategory, sortColumn, sortDirection]);

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

  const renderSortHeader = (
    column: SortColumn,
    label: string,
    align: "left" | "right" = "left"
  ) => {
    const isActive = sortColumn === column;
    return (
      <th
        key={column}
        onClick={() => handleSort(column)}
        className={`py-3.5 px-4 cursor-pointer select-none group transition-colors hover:bg-stone-100 dark:hover:bg-stone-800 ${
          align === "right" ? "text-right" : "text-left"
        }`}
        title={`Sắp xếp theo ${label} (${
          isActive
            ? sortDirection === "asc"
              ? "Tăng dần (Bấm để giảm dần)"
              : "Giảm dần (Bấm để tăng dần)"
            : "Bấm để sắp xếp"
        })`}
      >
        <div
          className={`inline-flex items-center gap-1.5 font-semibold text-xs tracking-wider uppercase transition-colors ${
            isActive
              ? "text-blue-600 dark:text-blue-400"
              : "text-stone-500 hover:text-stone-800 dark:hover:text-stone-200"
          } ${align === "right" ? "flex-row-reverse" : ""}`}
        >
          <span>{label}</span>
          <span
            className={`p-0.5 rounded transition-all ${
              isActive
                ? "bg-blue-100/70 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400"
                : "text-stone-400 opacity-50 group-hover:opacity-100"
            }`}
          >
            {isActive ? (
              sortDirection === "asc" ? (
                <ArrowUp className="w-3.5 h-3.5 stroke-[2.5]" />
              ) : (
                <ArrowDown className="w-3.5 h-3.5 stroke-[2.5]" />
              )
            ) : (
              <ArrowUpDown className="w-3.5 h-3.5" />
            )}
          </span>
        </div>
      </th>
    );
  };

  if (isLoading) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center gap-3 text-stone-400 py-20">
        <Loader2 className="w-7 h-7 animate-spin text-blue-600" />
        <span className="text-xs font-medium">Đang tải danh sách bài viết...</span>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="w-full space-y-6 pb-16">
      {/* Breadcrumbs - Strictly no 'Quản trị' for member */}
      <Breadcrumbs
        items={[
          { label: "Trang chủ", href: "/" },
          { label: "Bài viết của tôi" },
        ]}
      />

      {/* Header & New Post Action Button */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-stone-200 dark:border-stone-800 pb-5">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-stone-900 dark:text-white">
            Bài Viết Của Tôi
          </h1>
          <p className="text-xs text-stone-500">
            Quản lý, chỉnh sửa và theo dõi trạng thái các bài viết do bạn biên soạn.
          </p>
        </div>

        <Link
          href="/editor/new"
          className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm shadow-blue-500/25 transition-all shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Viết bài mới</span>
        </Link>
      </div>

      {/* Search & Filter Controls Bar */}
      <div className="p-4 rounded-2xl border border-stone-200/80 dark:border-stone-800 bg-stone-50/50 dark:bg-stone-900/40 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3">
          {/* Search Box */}
          <div className="lg:col-span-6 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 pointer-events-none" />
            <input
              type="text"
              disabled={isProcessing}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm kiếm theo tiêu đề, danh mục..."
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
          <div className="lg:col-span-3">
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
        </div>

        {/* Results summary and Active Filters count */}
        <div className="flex items-center justify-between text-xs text-stone-500 pt-1 border-t border-stone-200/50 dark:border-stone-800/50">
          <div className="flex items-center gap-2">
            <span>
              {totalPosts === 0 ? "Không có bài viết phù hợp" : `Hiển thị ${startPost}–${endPost} / ${totalPosts} bài viết`}
            </span>
            {(searchQuery || selectedStatus !== "all" || selectedCategory || sortColumn !== "date" || sortDirection !== "desc") && (
              <button
                onClick={() => {
                  setSearchQuery("");
                  setSelectedStatus("all");
                  setSelectedCategory("");
                  setSortColumn("date");
                  setSortDirection("desc");
                }}
                className="text-blue-600 hover:underline font-medium text-[11px]"
              >
                Xóa bộ lọc & sắp xếp
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

      {/* Post Table Section with Local Loading Overlay */}
      <div className="relative min-h-[360px]">
        <LoadingOverlay
          isLoading={loading || isProcessing}
          message={isProcessing ? actionMessage : "Đang tải danh sách bài viết..."}
          rounded="rounded-2xl"
        />

        {loading && posts.length === 0 ? (
          <div className="space-y-3 animate-pulse">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-16 rounded-xl bg-stone-100 dark:bg-stone-800" />
            ))}
          </div>
        ) : filteredPosts.length === 0 ? (
          <div className="text-center py-16 border border-dashed border-stone-200 dark:border-stone-800 rounded-3xl space-y-3">
            <FileText className="w-10 h-10 text-stone-400 mx-auto" />
            <h3 className="font-semibold text-stone-800 dark:text-stone-200">
              {posts.length === 0 ? "Bạn chưa có bài viết nào" : "Không tìm thấy bài viết nào phù hợp"}
            </h3>
            <p className="text-sm text-stone-500">
              {posts.length === 0
                ? "Hãy bắt đầu chia sẻ kiến thức và viết bài đầu tiên của bạn!"
                : "Thử thay đổi từ khóa tìm kiếm hoặc làm mới bộ lọc."}
            </p>
            {posts.length === 0 ? (
              <Link
                href="/editor/new"
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
                  setSortColumn("date");
                  setSortDirection("desc");
                }}
                className="inline-block mt-2 text-xs font-semibold px-4 py-2 rounded-lg border border-stone-300 dark:border-stone-700 text-stone-700 dark:text-stone-300 hover:bg-stone-100"
              >
                Đặt lại bộ lọc & sắp xếp
              </button>
            )}
          </div>
        ) : (
          <div
            className={`border border-stone-200 dark:border-stone-800 rounded-2xl overflow-hidden bg-white dark:bg-stone-900/60 shadow-sm transition-opacity duration-200 ${
              loading || isProcessing ? "opacity-50 pointer-events-none" : "opacity-100"
            }`}
          >
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-900 text-stone-500 text-xs font-semibold uppercase">
                  <tr>
                    {renderSortHeader("title", "Tiêu đề bài viết")}
                    {renderSortHeader("status", "Trạng thái")}
                    {renderSortHeader("category", "Danh mục")}
                    {renderSortHeader("views", "Lượt xem")}
                    {renderSortHeader("date", "Thời gian")}
                    <th className="py-3.5 px-4 text-right select-none font-semibold text-xs tracking-wider uppercase text-stone-500">
                      Thao tác
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 dark:divide-stone-800/60">
                  {paginatedPosts.map((post) => {
                    const isItemLoading = actionLoadingId === post.id;

                    return (
                      <tr
                        key={post.id}
                        className="hover:bg-stone-50/70 dark:hover:bg-stone-800/40 transition-colors"
                      >
                        <td className="py-3 px-4 font-semibold text-stone-900 dark:text-stone-100 max-w-sm">
                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              onClick={() => setCoverModalPost(post)}
                              disabled={isProcessing}
                              className="relative w-12 h-9 sm:w-14 sm:h-10 rounded-lg overflow-hidden shrink-0 border border-stone-200 dark:border-stone-700 group/thumb bg-stone-100 dark:bg-stone-800 transition-transform active:scale-95 shadow-xs"
                              title="Bấm để đổi ảnh bìa"
                            >
                              <img
                                src={getFullImageUrl(post.cover_image)}
                                alt={post.title}
                                className="w-full h-full object-cover group-hover/thumb:scale-110 transition-transform duration-300"
                              />
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/thumb:opacity-100 flex items-center justify-center transition-opacity text-white">
                                <Camera className="w-3.5 h-3.5" />
                              </div>
                              {!post.cover_image && (
                                <span
                                  className="absolute bottom-1 right-1 w-2 h-2 rounded-full bg-amber-400 ring-1 ring-white dark:ring-stone-900"
                                  title="Đang dùng ảnh mặc định"
                                />
                              )}
                            </button>

                            <div className="min-w-0 flex-1">
                              <span className="truncate block text-sm" title={post.title}>
                                {post.title}
                              </span>
                              <span className="text-[11px] text-stone-400 font-normal">
                                {post.cover_image ? (
                                  <span className="text-emerald-600 dark:text-emerald-400">Ảnh riêng</span>
                                ) : (
                                  <span className="text-stone-400">Ảnh mặc định</span>
                                )}
                              </span>
                            </div>
                          </div>
                        </td>

                        <td className="py-4 px-4 whitespace-nowrap">
                          <button
                            type="button"
                            disabled={isProcessing}
                            onClick={() => handleTogglePublish(post)}
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

                        <td className="py-4 px-4 whitespace-nowrap text-stone-600 dark:text-stone-400 text-xs">
                          {post.category ? (
                            <span className="px-2 py-0.5 rounded-md bg-stone-100 dark:bg-stone-800">
                              {post.category.name}
                            </span>
                          ) : (
                            <span className="text-stone-400 italic">Chưa phân loại</span>
                          )}
                        </td>

                        <td className="py-4 px-4 whitespace-nowrap text-xs text-stone-500">
                          <div className="flex items-center gap-1">
                            <Eye className="w-3.5 h-3.5 text-stone-400" />
                            <span>{post.views_count?.toLocaleString() || 0}</span>
                          </div>
                        </td>

                        <td className="py-4 px-4 whitespace-nowrap text-xs text-stone-500">
                          <div className="flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5 text-stone-400" />
                            <span>
                              {new Date(post.published_at || post.created_at).toLocaleDateString("vi-VN")}
                            </span>
                          </div>
                        </td>

                        <td className="py-4 px-4 whitespace-nowrap text-right text-xs">
                          <div className="flex items-center justify-end gap-1">
                            {post.is_published && (
                              <Link
                                href={`/posts/${post.slug}`}
                                target="_blank"
                                className={`p-1.5 rounded-lg text-stone-400 hover:text-blue-600 transition-colors ${
                                  isProcessing ? "pointer-events-none opacity-40" : ""
                                }`}
                                title="Xem bài viết trên trang"
                              >
                                <ExternalLink className="w-4 h-4" />
                              </Link>
                            )}

                            <button
                              type="button"
                              onClick={() => setCoverModalPost(post)}
                              disabled={isProcessing}
                              className={`p-1.5 rounded-lg text-stone-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors ${
                                isProcessing ? "pointer-events-none opacity-40" : ""
                              }`}
                              title="Đổi ảnh bìa (Cover)"
                            >
                              <ImageIcon className="w-4 h-4" />
                            </button>

                            <Link
                              href={`/editor/${post.id}`}
                              className={`p-1.5 rounded-lg text-stone-400 hover:text-stone-900 dark:hover:text-white hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors ${
                                isProcessing ? "pointer-events-none opacity-40" : ""
                              }`}
                              title="Chỉnh sửa bài viết"
                            >
                              <Edit className="w-4 h-4" />
                            </Link>

                            <button
                              onClick={() => handleDelete(post.id, post.title)}
                              disabled={isProcessing}
                              className="p-1.5 rounded-lg text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                              title="Xóa bài viết"
                            >
                              {isItemLoading ? (
                                <Loader2 className="w-4 h-4 animate-spin text-rose-500" />
                              ) : (
                                <Trash2 className="w-4 h-4" />
                              )}
                            </button>
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
              <div className="p-4 border-t border-stone-200 dark:border-stone-800 bg-stone-50/50 dark:bg-stone-900/30">
                <Pagination
                  currentPage={validPage}
                  totalPages={totalPages}
                  totalItems={totalPosts}
                  itemsName="bài viết"
                  onPageChange={(p) => setCurrentPage(p)}
                  disabled={isProcessing}
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Standalone Quick Cover Edit Modal */}
      {coverModalPost && token && (
        <EditCoverModal
          isOpen={Boolean(coverModalPost)}
          onClose={() => setCoverModalPost(null)}
          postId={coverModalPost.id}
          postTitle={coverModalPost.title}
          currentCoverImage={coverModalPost.cover_image}
          token={token}
          onSuccess={(newCoverUrl) => {
            setPosts((prev) =>
              prev.map((p) =>
                p.id === coverModalPost.id ? { ...p, cover_image: newCoverUrl || undefined } : p
              )
            );
          }}
        />
      )}
    </div>
  );
}
