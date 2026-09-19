"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  GraduationCap,
  Plus,
  Trash2,
  ExternalLink,
  BookOpen,
  Edit,
  ArrowLeft,
  X,
  Check,
  Upload,
  Image as ImageIcon,
  Loader2,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import {
  fetchSeries,
  fetchSeriesBySlug,
  createSeries,
  updateSeries,
  deleteSeries,
  addChapter,
  updateChapter,
  deleteChapter,
  fetchCategories,
  getFullImageUrl,
  uploadMedia,
} from "@/lib/api";
import { Category, Series, SeriesDetail } from "@/lib/types";
import { Breadcrumbs } from "@/components/common/Breadcrumbs";

export default function AdminSeriesPage() {
  const router = useRouter();
  const { user, token, isLoading } = useAuth();

  const [seriesList, setSeriesList] = useState<Series[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  // New Series form
  const [showNewSeriesModal, setShowNewSeriesModal] = useState(false);
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [coverImage, setCoverImage] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Edit Series form
  const [editingSeries, setEditingSeries] = useState<Series | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editSummary, setEditSummary] = useState("");
  const [editCoverImage, setEditCoverImage] = useState("");
  const [editCategoryId, setEditCategoryId] = useState("");
  const [editIsPublished, setEditIsPublished] = useState(true);

  // Selected Series for Chapter inspection
  const [selectedSeriesSlug, setSelectedSeriesSlug] = useState<string | null>(null);
  const [selectedDetail, setSelectedDetail] = useState<SeriesDetail | null>(null);
  const [newChapterTitle, setNewChapterTitle] = useState("");

  // Edit Chapter state
  const [editingChapterId, setEditingChapterId] = useState<string | null>(null);
  const [editingChapterTitle, setEditingChapterTitle] = useState("");
  const [editingChapterDesc, setEditingChapterDesc] = useState("");

  // Upload cover state
  const [uploadingCover, setUploadingCover] = useState(false);

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>, isEdit: boolean) => {
    const file = e.target.files?.[0];
    if (!file || !token) return;
    setUploadingCover(true);
    try {
      const res = await uploadMedia(file, token);
      if (isEdit) {
        setEditCoverImage(res.url);
      } else {
        setCoverImage(res.url);
      }
    } catch (err: any) {
      alert(`Lỗi tải ảnh lên: ${err.message}`);
    } finally {
      setUploadingCover(false);
      // Reset input value so same file can be selected again if needed
      e.target.value = "";
    }
  };

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/admin/login");
    }
  }, [user, isLoading, router]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [sData, cData] = await Promise.all([fetchSeries(), fetchCategories()]);
      setSeriesList(sData);
      setCategories(cData);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateSeries = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !token) return;

    setSubmitting(true);
    try {
      await createSeries(
        {
          title: title.trim(),
          summary: summary.trim() || undefined,
          cover_image: coverImage.trim() || undefined,
          category_id: categoryId || undefined,
          is_published: true,
        },
        token
      );
      setTitle("");
      setSummary("");
      setCoverImage("");
      setShowNewSeriesModal(false);
      loadData();
    } catch (err: any) {
      alert(`Lỗi: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const openEditSeriesModal = (s: Series) => {
    setEditingSeries(s);
    setEditTitle(s.title);
    setEditSummary(s.summary || "");
    setEditCoverImage(s.cover_image || "");
    setEditCategoryId(s.category_id || "");
    setEditIsPublished(s.is_published);
  };

  const handleUpdateSeries = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSeries || !editTitle.trim() || !token) return;

    setSubmitting(true);
    try {
      await updateSeries(
        editingSeries.id,
        {
          title: editTitle.trim(),
          summary: editSummary.trim() || undefined,
          cover_image: editCoverImage.trim() ? editCoverImage.trim() : "",
          category_id: editCategoryId || undefined,
          is_published: editIsPublished,
        },
        token
      );
      setEditingSeries(null);
      await loadData();
      if (selectedSeriesSlug === editingSeries.slug) {
        inspectSeries(editingSeries.slug);
      }
    } catch (err: any) {
      alert(`Lỗi khi cập nhật khóa học: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteSeries = async (id: string, sTitle: string) => {
    if (!token) return;
    if (!window.confirm(`Bạn có chắc muốn xóa khóa học "${sTitle}" cùng toàn bộ chương bên trong?`)) return;

    try {
      await deleteSeries(id, token);
      setSeriesList((prev) => prev.filter((s) => s.id !== id));
      if (selectedDetail?.id === id) {
        setSelectedDetail(null);
        setSelectedSeriesSlug(null);
      }
    } catch (err: any) {
      alert(`Lỗi: ${err.message}`);
    }
  };

  const inspectSeries = async (slug: string) => {
    setSelectedSeriesSlug(slug);
    try {
      const detail = await fetchSeriesBySlug(slug);
      setSelectedDetail(detail);
    } catch (e) {
      console.error(e);
    }
  };

  const handleAddChapter = async (seriesId: string) => {
    if (!newChapterTitle.trim() || !token) return;
    try {
      const order = (selectedDetail?.chapters?.length || 0) + 1;
      await addChapter(seriesId, { title: newChapterTitle.trim(), order }, token);
      setNewChapterTitle("");
      if (selectedSeriesSlug) inspectSeries(selectedSeriesSlug);
      loadData();
    } catch (err: any) {
      alert(`Lỗi: ${err.message}`);
    }
  };

  const startEditChapter = (chapterId: string, currentTitle: string, currentDesc?: string) => {
    setEditingChapterId(chapterId);
    setEditingChapterTitle(currentTitle);
    setEditingChapterDesc(currentDesc || "");
  };

  const cancelEditChapter = () => {
    setEditingChapterId(null);
    setEditingChapterTitle("");
    setEditingChapterDesc("");
  };

  const handleSaveChapter = async (chapterId: string) => {
    if (!editingChapterTitle.trim() || !token) return;
    try {
      await updateChapter(
        chapterId,
        {
          title: editingChapterTitle.trim(),
          description: editingChapterDesc.trim() || undefined,
        },
        token
      );
      cancelEditChapter();
      if (selectedSeriesSlug) inspectSeries(selectedSeriesSlug);
    } catch (err: any) {
      alert(`Lỗi khi sửa chương: ${err.message}`);
    }
  };

  const handleDeleteChapter = async (chapterId: string) => {
    if (!token) return;
    if (!window.confirm("Bạn có chắc muốn xóa chương này? Các bài viết trong chương sẽ được tách ra ngoài.")) return;

    try {
      await deleteChapter(chapterId, token);
      if (selectedSeriesSlug) inspectSeries(selectedSeriesSlug);
      loadData();
    } catch (err: any) {
      alert(`Lỗi: ${err.message}`);
    }
  };

  if (isLoading || !user) {
    return <div className="py-20 text-center text-sm text-stone-500 animate-pulse">Đang kiểm tra quyền...</div>;
  }

  return (
    <div className="w-full space-y-6 pb-16">
      <Breadcrumbs
        items={[
          { label: "Quản trị", href: "/admin/posts" },
          { label: "Khóa học & Tuyển tập" },
        ]}
      />

      {/* Top Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-stone-200 dark:border-stone-800 pb-4">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/posts"
            className="p-2 rounded-xl text-stone-500 hover:text-stone-900 dark:hover:text-white hover:bg-stone-200/60 dark:hover:bg-stone-800 transition-colors"
            title="Quay lại bài viết"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-stone-900 dark:text-white flex items-center gap-2">
              <GraduationCap className="w-6 h-6 text-blue-600" />
              <span>Quản Lý Khóa Học & Tuyển Tập (Series)</span>
            </h1>
            <p className="text-xs text-stone-500">
              Thiết kế các bài viết theo dạng Outline từng chương, từng bài như sách hoặc khóa học
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/admin/categories"
            className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800"
          >
            Quản lý danh mục
          </Link>
          <button
            onClick={() => setShowNewSeriesModal(true)}
            className="flex items-center gap-1 text-xs font-semibold px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-sm shadow-blue-500/20"
          >
            <Plus className="w-4 h-4" />
            <span>Tạo Khóa học mới</span>
          </button>
        </div>
      </div>

      {/* Modal Tạo Series Mới */}
      {showNewSeriesModal && (
        <div className="p-6 rounded-3xl border border-blue-200 dark:border-blue-900 bg-blue-50/50 dark:bg-blue-950/30 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-stone-900 dark:text-white">Tạo Khóa học / Tuyển tập mới</h3>
            <button
              onClick={() => setShowNewSeriesModal(false)}
              className="text-stone-400 hover:text-stone-600"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <form onSubmit={handleCreateSeries} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Tiêu đề khóa học (Ví dụ: Prep Course: Chinh Phục AI)..."
                className="w-full px-3 py-2 text-xs rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900"
              />
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900"
              >
                <option value="">-- Thuộc danh mục (Tùy chọn) --</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <textarea
              rows={2}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="Tóm tắt lộ trình khóa học..."
              className="w-full px-3 py-2 text-xs rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900"
            />

            {/* Cover image input & upload */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={coverImage}
                  onChange={(e) => setCoverImage(e.target.value)}
                  placeholder="URL ảnh bìa (hoặc bấm nút tải ảnh từ máy)..."
                  className="flex-1 px-3 py-2 text-xs rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900"
                />
                <label className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-stone-200 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800 text-xs font-semibold cursor-pointer shrink-0 transition-colors">
                  {uploadingCover ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />
                  ) : (
                    <Upload className="w-3.5 h-3.5 text-blue-600" />
                  )}
                  <span>{uploadingCover ? "Đang tải..." : "Tải ảnh từ máy"}</span>
                  <input
                    type="file"
                    accept="image/*"
                    disabled={uploadingCover}
                    onChange={(e) => handleCoverUpload(e, false)}
                    className="hidden"
                  />
                </label>
              </div>

              {coverImage && (
                <div className="flex items-center gap-3 p-2 rounded-xl bg-stone-100 dark:bg-stone-800/80 border border-stone-200 dark:border-stone-700">
                  <img
                    src={getFullImageUrl(coverImage)}
                    alt="Preview"
                    className="w-16 h-12 object-cover rounded-lg"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] text-stone-500 truncate">{coverImage}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCoverImage("")}
                    className="text-xs text-rose-600 hover:underline px-2 py-1"
                  >
                    Xóa ảnh
                  </button>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowNewSeriesModal(false)}
                className="text-xs px-3 py-1.5 text-stone-500 hover:text-stone-700"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="text-xs font-semibold px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-sm"
              >
                {submitting ? "Đang tạo..." : "Xác nhận tạo"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal Chỉnh Sửa Series */}
      {editingSeries && (
        <div className="p-6 rounded-3xl border border-amber-200 dark:border-amber-900 bg-amber-50/50 dark:bg-amber-950/30 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-stone-900 dark:text-white flex items-center gap-1.5">
              <Edit className="w-4 h-4 text-amber-600" />
              <span>Chỉnh sửa thông tin khóa học: "{editingSeries.title}"</span>
            </h3>
            <button onClick={() => setEditingSeries(null)} className="text-stone-400 hover:text-stone-600">
              <X className="w-4 h-4" />
            </button>
          </div>
          <form onSubmit={handleUpdateSeries} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                type="text"
                required
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                placeholder="Tiêu đề khóa học..."
                className="w-full px-3 py-2 text-xs rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900"
              />
              <select
                value={editCategoryId}
                onChange={(e) => setEditCategoryId(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900"
              >
                <option value="">-- Thuộc danh mục --</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <textarea
              rows={2}
              value={editSummary}
              onChange={(e) => setEditSummary(e.target.value)}
              placeholder="Tóm tắt nội dung khóa học..."
              className="w-full px-3 py-2 text-xs rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900"
            />

            {/* Cover image input & upload for edit */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={editCoverImage}
                  onChange={(e) => setEditCoverImage(e.target.value)}
                  placeholder="URL ảnh bìa (hoặc bấm nút tải ảnh từ máy)..."
                  className="flex-1 px-3 py-2 text-xs rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900"
                />
                <label className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-stone-200 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800 text-xs font-semibold cursor-pointer shrink-0 transition-colors">
                  {uploadingCover ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-600" />
                  ) : (
                    <Upload className="w-3.5 h-3.5 text-amber-600" />
                  )}
                  <span>{uploadingCover ? "Đang tải..." : "Tải ảnh từ máy"}</span>
                  <input
                    type="file"
                    accept="image/*"
                    disabled={uploadingCover}
                    onChange={(e) => handleCoverUpload(e, true)}
                    className="hidden"
                  />
                </label>
              </div>

              {editCoverImage && (
                <div className="flex items-center gap-3 p-2 rounded-xl bg-amber-100/50 dark:bg-stone-800/80 border border-amber-200 dark:border-stone-700">
                  <img
                    src={getFullImageUrl(editCoverImage)}
                    alt="Preview"
                    className="w-16 h-12 object-cover rounded-lg"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] text-stone-500 truncate">{editCoverImage}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditCoverImage("")}
                    className="text-xs text-rose-600 hover:underline px-2 py-1 font-medium"
                  >
                    Xóa ảnh
                  </button>
                </div>
              )}

              <label className="flex items-center gap-2 text-xs font-medium text-stone-700 dark:text-stone-300 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={editIsPublished}
                  onChange={(e) => setEditIsPublished(e.target.checked)}
                  className="rounded border-stone-300 text-amber-600 focus:ring-amber-500"
                />
                <span>Xuất bản công khai khóa học</span>
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditingSeries(null)}
                className="text-xs px-3 py-1.5 text-stone-500 hover:text-stone-700"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="text-xs font-semibold px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl shadow-sm"
              >
                {submitting ? "Đang lưu..." : "Lưu thay đổi"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Main layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left: Danh sách Series */}
        <div className="lg:col-span-6 space-y-4">
          <div className="text-xs font-semibold text-stone-500 uppercase tracking-wider">
            Các khóa học hiện có ({seriesList.length})
          </div>

          {loading ? (
            <div className="space-y-3 animate-pulse">
              {[1, 2].map((i) => (
                <div key={i} className="h-28 rounded-2xl bg-stone-100 dark:bg-stone-800" />
              ))}
            </div>
          ) : seriesList.length === 0 ? (
            <div className="p-8 text-center border border-dashed border-stone-200 dark:border-stone-800 rounded-2xl text-xs text-stone-400">
              Chưa có khóa học nào. Hãy tạo khóa học đầu tiên ở nút phía trên!
            </div>
          ) : (
            <div className="space-y-3">
              {seriesList.map((s) => {
                const isSelected = selectedSeriesSlug === s.slug;
                return (
                  <div
                    key={s.id}
                    onClick={() => inspectSeries(s.slug)}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer shadow-sm ${
                      isSelected
                        ? "border-blue-500 bg-blue-50/40 dark:bg-blue-950/20"
                        : "border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900/60 hover:border-blue-400"
                    }`}
                  >
                    <div className="flex gap-4 items-start">
                      {/* Thumbnail or Fallback */}
                      <div className="w-16 h-16 rounded-xl overflow-hidden shrink-0 bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white">
                        {s.cover_image ? (
                          <img
                            src={getFullImageUrl(s.cover_image)}
                            alt={s.title}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <GraduationCap className="w-8 h-8 opacity-80" />
                        )}
                      </div>

                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300">
                            {s.total_chapters} chương • {s.total_lessons} bài học
                          </span>
                          {!s.is_published && (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300">
                              Bản nháp
                            </span>
                          )}
                        </div>
                        <h3 className="font-bold text-sm text-stone-900 dark:text-white truncate">
                          {s.title}
                        </h3>
                        {s.summary && (
                          <p className="text-xs text-stone-500 line-clamp-2">
                            {s.summary}
                          </p>
                        )}
                      </div>

                      <div className="flex flex-col gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => openEditSeriesModal(s)}
                          className="p-1 text-stone-400 hover:text-amber-600 transition-colors"
                          title="Chỉnh sửa thông tin khóa học"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <Link
                          href={`/series/${s.slug}`}
                          target="_blank"
                          className="p-1 text-stone-400 hover:text-blue-600 transition-colors"
                          title="Xem trang công khai"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </Link>
                        <button
                          onClick={() => handleDeleteSeries(s.id, s.title)}
                          className="p-1 text-stone-400 hover:text-rose-600 transition-colors"
                          title="Xóa khóa học"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right: Chi tiết Dàn Outline & Quản lý Chương */}
        <div className="lg:col-span-6 space-y-4">
          <div className="text-xs font-semibold text-stone-500 uppercase tracking-wider">
            Dàn Outline & Các Chương
          </div>

          {selectedDetail ? (
            <div className="p-6 rounded-3xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900/60 space-y-5 shadow-sm">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-bold text-base text-stone-900 dark:text-white">
                    {selectedDetail.title}
                  </h3>
                  <p className="text-xs text-stone-500 mt-0.5">
                    Thêm chương mới hoặc chỉnh sửa tên chương để thiết lập dàn bài học.
                  </p>
                </div>
                <button
                  onClick={() => openEditSeriesModal(selectedDetail)}
                  className="text-xs font-semibold text-blue-600 hover:underline flex items-center gap-1"
                >
                  <Edit className="w-3 h-3" /> Sửa khóa học
                </button>
              </div>

              {/* Add Chapter input */}
              <div className="flex items-center gap-2 pt-2 border-t border-stone-100 dark:border-stone-800">
                <input
                  type="text"
                  value={newChapterTitle}
                  onChange={(e) => setNewChapterTitle(e.target.value)}
                  placeholder="Tiêu đề chương mới (Ví dụ: Chương 1: Giới thiệu)..."
                  className="flex-1 px-3 py-1.5 text-xs rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800"
                />
                <button
                  type="button"
                  onClick={() => handleAddChapter(selectedDetail.id)}
                  className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shrink-0"
                >
                  Thêm chương
                </button>
              </div>

              {/* Chapters list */}
              <div className="space-y-3 pt-2">
                {selectedDetail.chapters && selectedDetail.chapters.length > 0 ? (
                  selectedDetail.chapters.map((ch, idx) => (
                    <div
                      key={ch.id}
                      className="p-4 rounded-2xl border border-stone-200 dark:border-stone-800 bg-stone-50/50 dark:bg-stone-800/40 space-y-2.5"
                    >
                      {editingChapterId === ch.id ? (
                        /* Inline Edit Chapter Form */
                        <div className="space-y-2">
                          <input
                            type="text"
                            value={editingChapterTitle}
                            onChange={(e) => setEditingChapterTitle(e.target.value)}
                            placeholder="Tiêu đề chương..."
                            className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-blue-400 bg-white dark:bg-stone-900"
                          />
                          <input
                            type="text"
                            value={editingChapterDesc}
                            onChange={(e) => setEditingChapterDesc(e.target.value)}
                            placeholder="Mô tả tóm tắt chương (Tùy chọn)..."
                            className="w-full px-2.5 py-1 text-xs rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900"
                          />
                          <div className="flex justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={cancelEditChapter}
                              className="text-xs px-2.5 py-1 rounded text-stone-500 hover:text-stone-700"
                            >
                              Hủy
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSaveChapter(ch.id)}
                              className="text-xs font-semibold px-3 py-1 bg-blue-600 text-white rounded-lg flex items-center gap-1"
                            >
                              <Check className="w-3 h-3" /> Lưu
                            </button>
                          </div>
                        </div>
                      ) : (
                        /* Chapter Display View */
                        <div className="flex items-center justify-between">
                          <div className="font-bold text-xs text-stone-900 dark:text-white flex items-center gap-1.5">
                            <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px]">
                              {idx + 1}
                            </span>
                            <span>{ch.title}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Link
                              href={`/admin/editor/new?series_id=${selectedDetail.id}&chapter_id=${ch.id}`}
                              className="text-[11px] font-semibold text-blue-600 hover:underline flex items-center gap-1"
                            >
                              <Plus className="w-3 h-3" /> Viết bài vào chương
                            </Link>
                            <button
                              onClick={() => startEditChapter(ch.id, ch.title, ch.description)}
                              className="p-1 text-stone-400 hover:text-amber-600 transition-colors"
                              title="Sửa tên chương"
                            >
                              <Edit className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => handleDeleteChapter(ch.id)}
                              className="p-1 text-stone-400 hover:text-rose-600 transition-colors"
                              title="Xóa chương"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Lessons list inside chapter */}
                      {ch.lessons && ch.lessons.length > 0 ? (
                        <div className="space-y-1.5 pl-6 border-l-2 border-stone-200 dark:border-stone-700 mt-2">
                          {ch.lessons.map((lesson, lIdx) => (
                            <div
                              key={lesson.id}
                              className="flex items-center justify-between text-xs py-1 text-stone-700 dark:text-stone-300"
                            >
                              <span className="truncate">
                                Bài {idx + 1}.{lIdx + 1}: {lesson.title}
                              </span>
                              <div className="flex items-center gap-2 shrink-0">
                                <span className="text-[10px] text-stone-400">
                                  {lesson.reading_time_minutes}p
                                </span>
                                <Link
                                  href={`/admin/editor/${lesson.id}`}
                                  className="text-stone-400 hover:text-blue-600"
                                >
                                  <Edit className="w-3 h-3" />
                                </Link>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-[11px] text-stone-400 italic pl-6">
                          Chưa có bài viết nào trong chương này.
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="p-6 text-center border border-dashed border-stone-200 dark:border-stone-800 rounded-2xl text-xs text-stone-400">
                    Khóa học này chưa có chương nào. Hãy nhập tiêu đề chương ở ô phía trên và bấm "Thêm chương"!
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="p-12 text-center border border-dashed border-stone-200 dark:border-stone-800 rounded-3xl text-xs text-stone-400">
              Chọn một khóa học bên trái để xem và quản lý dàn outline từng chương.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
