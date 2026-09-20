"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  FolderPlus,
  Trash2,
  Edit2,
  Folder,
  Check,
  X,
  FileText,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import {
  fetchCategories,
  createCategory,
  updateCategory,
  deleteCategory,
} from "@/lib/api";
import { Category } from "@/lib/types";
import { Breadcrumbs } from "@/components/common/Breadcrumbs";
import { AdminNav } from "@/components/admin/AdminNav";
import { AdminGuard } from "@/components/admin/AdminGuard";
import { useLoading } from "@/lib/loading-context";

export default function AdminCategoriesPage() {
  const router = useRouter();
  const { user, token, isLoading } = useAuth();
  const { withLoading } = useLoading();

  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  // New Category State
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Edit State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/admin/login");
    }
  }, [user, isLoading, router]);

  const loadData = async () => {
    try {
      const data = await fetchCategories();
      setCategories(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !token) return;

    setSubmitting(true);
    await withLoading(async () => {
      try {
        const newCat = await createCategory({ name: name.trim(), description }, token);
        setCategories((prev) => [...prev, newCat]);
        setName("");
        setDescription("");
        alert("Đã tạo danh mục mới thành công!");
      } catch (err: any) {
        alert(`Lỗi: ${err.message}`);
      } finally {
        setSubmitting(false);
      }
    }, "Đang tạo danh mục mới...");
  };

  const startEdit = (cat: Category) => {
    setEditingId(cat.id);
    setEditName(cat.name);
    setEditDescription(cat.description || "");
  };

  const handleUpdate = async (id: string) => {
    if (!editName.trim() || !token) return;
    await withLoading(async () => {
      try {
        const updated = await updateCategory(
          id,
          { name: editName.trim(), description: editDescription.trim() },
          token
        );
        setCategories((prev) => prev.map((c) => (c.id === id ? { ...c, ...updated } : c)));
        setEditingId(null);
      } catch (err: any) {
        alert(`Lỗi cập nhật: ${err.message}`);
      }
    }, "Đang cập nhật danh mục...");
  };

  const handleDelete = async (id: string, catName: string) => {
    if (!token) return;
    if (!window.confirm(`Bạn có chắc muốn xóa danh mục "${catName}" không?`)) return;

    await withLoading(async () => {
      try {
        await deleteCategory(id, token);
        setCategories((prev) => prev.filter((c) => c.id !== id));
      } catch (err: any) {
        alert(`Lỗi xóa danh mục: ${err.message}`);
      }
    }, "Đang xóa danh mục...");
  };

  if (isLoading || !user) {
    return <div className="py-20 text-center text-sm text-stone-500 animate-pulse">Đang kiểm tra quyền...</div>;
  }

  return (
    <AdminGuard requireAdmin={true}>
      <div className="w-full space-y-6 pb-16">
      <Breadcrumbs
        items={[
          { label: "Quản trị", href: "/admin/posts" },
          { label: "Danh mục bài viết" },
        ]}
      />

      {/* Top Bar */}
      <div className="flex items-center justify-between border-b border-stone-200 dark:border-stone-800 pb-4">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/posts"
            className="p-2 rounded-xl text-stone-500 hover:text-stone-900 dark:hover:text-white hover:bg-stone-200/60 dark:hover:bg-stone-800 transition-colors"
            title="Quay lại bài viết"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-stone-900 dark:text-white">
              Quản Lý Danh Mục
            </h1>
            <p className="text-xs text-stone-500">
              Tạo và phân loại chủ đề cho bài viết và các khóa học
            </p>
          </div>
        </div>

        <AdminNav currentTab="categories" disabled={submitting} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
        {/* Form Tạo Mới */}
        <div className="md:col-span-5 space-y-4">
          <form
            onSubmit={handleCreate}
            className="p-6 rounded-3xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900/60 space-y-4 shadow-sm"
          >
            <div className="flex items-center gap-2 text-sm font-bold text-stone-900 dark:text-white pb-2 border-b border-stone-100 dark:border-stone-800">
              <FolderPlus className="w-4 h-4 text-blue-600" />
              <span>Thêm Danh Mục Mới</span>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-stone-700 dark:text-stone-300">
                Tên danh mục *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ví dụ: AI & Data Science"
                className="w-full px-3 py-2 text-xs rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-stone-700 dark:text-stone-300">
                Mô tả ngắn
              </label>
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Mô tả chuyên mục này nói về điều gì..."
                className="w-full px-3 py-2 text-xs rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm shadow-blue-500/20 disabled:opacity-50 transition-colors"
            >
              {submitting ? "Đang tạo..." : "Tạo danh mục"}
            </button>
          </form>
        </div>

        {/* Danh Sách Danh Mục */}
        <div className="md:col-span-7 space-y-4">
          <div className="flex items-center justify-between text-xs font-semibold text-stone-500 uppercase tracking-wider">
            <span>Danh mục hiện có ({categories.length})</span>
          </div>

          {loading ? (
            <div className="space-y-2 animate-pulse">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-14 rounded-xl bg-stone-100 dark:bg-stone-800" />
              ))}
            </div>
          ) : categories.length === 0 ? (
            <div className="p-8 text-center border border-dashed border-stone-200 dark:border-stone-800 rounded-2xl text-xs text-stone-400">
              Chưa có danh mục nào. Hãy tạo danh mục đầu tiên bên trái!
            </div>
          ) : (
            <div className="space-y-2.5">
              {categories.map((cat) => (
                <div
                  key={cat.id}
                  className="p-4 rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900/60 flex items-start justify-between gap-3 shadow-sm hover:border-blue-500/40 transition-colors"
                >
                  {editingId === cat.id ? (
                    <div className="flex-1 space-y-2">
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="w-full px-2.5 py-1 text-xs rounded-lg border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800"
                      />
                      <input
                        type="text"
                        value={editDescription}
                        onChange={(e) => setEditDescription(e.target.value)}
                        placeholder="Mô tả..."
                        className="w-full px-2.5 py-1 text-xs rounded-lg border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800"
                      />
                      <div className="flex items-center gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => handleUpdate(cat.id)}
                          className="flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 bg-blue-600 text-white rounded-lg"
                        >
                          <Check className="w-3 h-3" /> Lưu
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          className="flex items-center gap-1 text-[11px] px-2.5 py-1 text-stone-500 hover:text-stone-700"
                        >
                          <X className="w-3 h-3" /> Hủy
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <Folder className="w-4 h-4 text-blue-600 shrink-0" />
                          <span className="font-bold text-sm text-stone-900 dark:text-white truncate">
                            {cat.name}
                          </span>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-stone-100 dark:bg-stone-800 text-stone-500">
                            /{cat.slug}
                          </span>
                        </div>
                        {cat.description && (
                          <p className="text-xs text-stone-500 dark:text-stone-400 line-clamp-1">
                            {cat.description}
                          </p>
                        )}
                        <div className="flex items-center gap-1 text-[11px] text-stone-400 pt-0.5">
                          <FileText className="w-3 h-3" />
                          <span>{cat.post_count || 0} bài viết</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => startEdit(cat)}
                          className="p-1.5 rounded-lg text-stone-400 hover:text-stone-900 dark:hover:text-white hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
                          title="Sửa danh mục"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(cat.id, cat.name)}
                          className="p-1.5 rounded-lg text-stone-400 hover:text-rose-600 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
                          title="Xóa danh mục"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      </div>
    </AdminGuard>
  );
}
