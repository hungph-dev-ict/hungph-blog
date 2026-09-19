"use client";

import React, { useEffect, useState } from "react";
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
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { fetchPosts, deletePost } from "@/lib/api";
import { PostListItem } from "@/lib/types";

export default function AdminPostsPage() {
  const router = useRouter();
  const { user, token, isLoading } = useAuth();
  const [posts, setPosts] = useState<PostListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const isAdmin = user?.role === "admin" || user?.is_admin;

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/");
    }
  }, [user, isLoading, router]);

  const loadAllPosts = async () => {
    setLoading(true);
    try {
      const data = await fetchPosts({ limit: 50, include_drafts: true });
      setPosts(data.items);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      loadAllPosts();
    }
  }, [token]);

  const handleDelete = async (id: string, title: string) => {
    if (!token) return;
    if (!window.confirm(`Bạn có chắc muốn xóa bài viết "${title}" không?`)) return;

    setDeletingId(id);
    try {
      await deletePost(id, token);
      setPosts((prev) => prev.filter((p) => p.id !== id));
    } catch (err: any) {
      alert(`Lỗi khi xóa bài viết: ${err.message}`);
    } finally {
      setDeletingId(null);
    }
  };

  if (isLoading || !user) {
    return (
      <div className="py-20 text-center text-sm text-stone-500 animate-pulse">
        Đang kiểm tra quyền truy cập...
      </div>
    );
  }

  const displayedPosts = isAdmin ? posts : posts.filter((p) => p.author?.id === user.id);

  return (
    <div className="w-full space-y-8 pb-16">
      {/* Top Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-stone-200 dark:border-stone-800 pb-6">
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
            Xin chào <span className="font-semibold text-blue-600">{user.full_name || user.username}</span>! Bạn đang có {displayedPosts.length} bài viết.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isAdmin && (
            <>
              <Link
                href="/admin/users"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-purple-200 dark:border-purple-800 bg-purple-50/50 dark:bg-purple-950/20 text-purple-700 dark:text-purple-300 hover:bg-purple-100 text-xs font-semibold transition-colors"
              >
                <span>Quản lý thành viên</span>
              </Link>
              <Link
                href="/admin/categories"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 text-xs font-semibold transition-colors"
              >
                <span>Danh mục</span>
              </Link>
              <Link
                href="/admin/series"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 text-xs font-semibold transition-colors"
              >
                <span>Khóa học</span>
              </Link>
            </>
          )}
          <Link
            href="/admin/editor/new"
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm shadow-blue-500/25 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Viết bài mới</span>
          </Link>
        </div>
      </div>

      {/* Post Table */}
      {loading ? (
        <div className="space-y-3 animate-pulse">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-16 rounded-xl bg-stone-100 dark:bg-stone-800" />
          ))}
        </div>
      ) : displayedPosts.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-stone-200 dark:border-stone-800 rounded-3xl space-y-3">
          <FileText className="w-10 h-10 text-stone-400 mx-auto" />
          <h3 className="font-semibold text-stone-800 dark:text-stone-200">Chưa có bài viết nào</h3>
          <p className="text-sm text-stone-500">Hãy bắt đầu viết bài đầu tiên của bạn!</p>
          <Link
            href="/admin/editor/new"
            className="inline-block mt-2 text-xs font-semibold px-4 py-2 rounded-lg bg-blue-600 text-white"
          >
            Tạo bài viết ngay
          </Link>
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
                {displayedPosts.map((post) => {
                  const canManage = isAdmin || post.author?.id === user.id;

                  return (
                    <tr
                      key={post.id}
                      className="hover:bg-stone-50/70 dark:hover:bg-stone-800/40 transition-colors"
                    >
                      <td className="py-4 px-4 font-semibold text-stone-900 dark:text-stone-100 max-w-xs truncate">
                        {post.title}
                      </td>

                      {isAdmin && (
                        <td className="py-4 px-4 text-xs text-stone-500 whitespace-nowrap">
                          {post.author?.full_name || post.author?.username || "Admin"}
                        </td>
                      )}

                      <td className="py-4 px-4 whitespace-nowrap">
                        {post.is_published ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/60">
                            <CheckCircle className="w-3 h-3" />
                            Đã xuất bản
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border border-amber-200/60 dark:border-amber-800/60">
                            <AlertCircle className="w-3 h-3" />
                            Bản nháp
                          </span>
                        )}
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
                              className="p-1.5 rounded-lg text-stone-400 hover:text-blue-600 transition-colors"
                              title="Xem bài viết"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </Link>
                          )}
                          {canManage && (
                            <>
                              <Link
                                href={`/admin/editor/${post.id}`}
                                className="p-1.5 rounded-lg text-stone-400 hover:text-stone-900 dark:hover:text-white transition-colors"
                                title="Chỉnh sửa"
                              >
                                <Edit className="w-4 h-4" />
                              </Link>
                              <button
                                onClick={() => handleDelete(post.id, post.title)}
                                disabled={deletingId === post.id}
                                className="p-1.5 rounded-lg text-stone-400 hover:text-rose-600 transition-colors"
                                title="Xóa bài viết"
                              >
                                <Trash2 className="w-4 h-4" />
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
        </div>
      )}
    </div>
  );
}
