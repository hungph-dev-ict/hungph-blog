"use client";

import React, { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
  Users,
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
  fetchUsers,
  getFullImageUrl,
  uploadMedia,
  getCollaborators,
} from "@/lib/api";
import { Category, Chapter, Series, SeriesDetail, User } from "@/lib/types";
import { Breadcrumbs } from "@/components/common/Breadcrumbs";
import { AdminNav } from "@/components/admin/AdminNav";
import { AdminGuard } from "@/components/admin/AdminGuard";
import { HierarchyConfigEditor } from "@/components/series/HierarchyConfigEditor";
import { ChapterNode, buildChapterTree, flattenChapterTree } from "@/lib/tree-utils";
import { useLoading } from "@/lib/loading-context";
import { SeriesCollaboratorsManager } from "@/components/series/SeriesCollaboratorsManager";
import { LoadingOverlay } from "@/components/common/LoadingOverlay";

function AdminSeriesContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const slugParam = searchParams.get("slug");
  const idParam = searchParams.get("id");
  const tabParam = searchParams.get("tab");
  const { user, token, isLoading } = useAuth();
  const { withLoading } = useLoading();

  const [seriesList, setSeriesList] = useState<Series[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [inspectorTab, setInspectorTab] = useState<"outline" | "collaborators">(
    tabParam === "collaborators" || tabParam === "collab" ? "collaborators" : "outline"
  );
  const [pendingCollabCounts, setPendingCollabCounts] = useState<Record<string, number>>({});

  // New Series form
  const [showNewSeriesModal, setShowNewSeriesModal] = useState(false);
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [coverImage, setCoverImage] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [hierarchyConfig, setHierarchyConfig] = useState('["Chương"]');
  const [attributionText, setAttributionText] = useState("");
  const [authorId, setAuthorId] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Edit Series form
  const [editingSeries, setEditingSeries] = useState<Series | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editSummary, setEditSummary] = useState("");
  const [editCoverImage, setEditCoverImage] = useState("");
  const [editCategoryId, setEditCategoryId] = useState("");
  const [editHierarchyConfig, setEditHierarchyConfig] = useState('["Chương"]');
  const [editAttributionText, setEditAttributionText] = useState("");
  const [editAuthorId, setEditAuthorId] = useState("");
  const [editIsPublished, setEditIsPublished] = useState(true);

  // Selected Series for Chapter inspection
  const [selectedSeriesSlug, setSelectedSeriesSlug] = useState<string | null>(null);
  const [selectedDetail, setSelectedDetail] = useState<SeriesDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [newChapterTitle, setNewChapterTitle] = useState("");
  const [newChapterParentId, setNewChapterParentId] = useState("");

  const inspectSeries = React.useCallback(async (slug: string) => {
    if (!slug) return;
    const cleanSlug = decodeURIComponent(slug.trim());
    setSelectedSeriesSlug(cleanSlug);
    setDetailLoading(true);
    try {
      const detail = await fetchSeriesBySlug(cleanSlug);
      setSelectedDetail(detail);
      if (typeof window !== "undefined") {
        const currentUrl = new URL(window.location.href);
        if (currentUrl.searchParams.get("slug") !== cleanSlug) {
          currentUrl.searchParams.set("slug", cleanSlug);
          currentUrl.searchParams.delete("id");
          window.history.replaceState(null, "", currentUrl.toString());
        }
      }
    } catch (e) {
      console.error("Lỗi tải chi tiết khóa học:", e);
    } finally {
      setDetailLoading(false);
    }
  }, []);

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
    await withLoading(async () => {
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
        e.target.value = "";
      }
    }, "Đang tải ảnh bìa khóa học lên...");
  };

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/login");
    }
  }, [user, isLoading, router]);

  useEffect(() => {
    if (tabParam === "collaborators" || tabParam === "collab") {
      setInspectorTab("collaborators");
    }
  }, [tabParam]);

  const loadPendingCounts = async (list: Series[], tok: string) => {
    const counts: Record<string, number> = {};
    await Promise.all(
      list.map(async (s) => {
        try {
          const collabs = await getCollaborators(s.id, tok);
          const p = collabs.filter((c) => c.status === "pending").length;
          if (p > 0) counts[s.id] = p;
        } catch (e) {
          // ignore
        }
      })
    );
    setPendingCollabCounts(counts);
  };

  const loadData = async (targetSlug?: string | null) => {
    setLoading(true);
    try {
      const promises: [Promise<Series[]>, Promise<Category[]>, Promise<User[]>] = [
        fetchSeries(),
        fetchCategories(),
        token ? fetchUsers(token).catch(() => []) : Promise.resolve([]),
      ];
      const [sData, cData, uData] = await Promise.all(promises);
      setSeriesList(sData);
      setCategories(cData);
      if (uData && uData.length > 0) {
        setUsers(uData);
      }

      if (token) {
        loadPendingCounts(sData, token);
      }

      // Xác định khóa học cần chọn từ query parameters ngay khi load xong dữ liệu
      let slugToSelect = targetSlug;
      if (!slugToSelect && typeof window !== "undefined") {
        const currentParams = new URLSearchParams(window.location.search);
        slugToSelect = currentParams.get("slug");
        if (!slugToSelect) {
          const id = currentParams.get("id");
          if (id) {
            const match = sData.find((s: Series) => s.id === id);
            if (match) slugToSelect = match.slug;
          }
        }
      }
      if (!slugToSelect && slugParam) {
        slugToSelect = slugParam;
      }
      if (!slugToSelect && idParam) {
        const match = sData.find((s: Series) => s.id === idParam);
        if (match) slugToSelect = match.slug;
      }

      if (slugToSelect) {
        inspectSeries(slugToSelect);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (token && users.length === 0) {
      fetchUsers(token).then(setUsers).catch(() => {});
    }
  }, [token, users.length]);

  // Lắng nghe thay đổi của searchParams khi điều hướng client-side
  useEffect(() => {
    const currentSlug = slugParam || (typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("slug") : null);
    const currentId = idParam || (typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("id") : null);

    if (currentSlug && currentSlug !== selectedSeriesSlug) {
      inspectSeries(currentSlug);
    } else if (currentId && !currentSlug && seriesList.length > 0) {
      const match = seriesList.find((s) => s.id === currentId);
      if (match && match.slug !== selectedSeriesSlug) {
        inspectSeries(match.slug);
      }
    }
  }, [slugParam, idParam, selectedSeriesSlug, seriesList, inspectSeries]);

  const handleCreateSeries = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !token) return;

    setSubmitting(true);
    await withLoading(async () => {
      try {
        await createSeries(
          {
            title: title.trim(),
            summary: summary.trim() || undefined,
            cover_image: coverImage.trim() || undefined,
            category_id: categoryId || undefined,
            hierarchy_config: hierarchyConfig,
            attribution_text: attributionText.trim() || undefined,
            author_id: authorId || undefined,
            is_published: true,
          },
          token
        );
        setTitle("");
        setSummary("");
        setCoverImage("");
        setAttributionText("");
        setAuthorId("");
        setHierarchyConfig('["Chương"]');
        setShowNewSeriesModal(false);
        loadData();
      } catch (err: any) {
        alert(`Lỗi: ${err.message}`);
      } finally {
        setSubmitting(false);
      }
    }, "Đang tạo khóa học mới...");
  };

  const openEditSeriesModal = (s: Series) => {
    setEditingSeries(s);
    setEditTitle(s.title);
    setEditSummary(s.summary || "");
    setEditCoverImage(s.cover_image || "");
    setEditCategoryId(s.category_id || "");
    setEditHierarchyConfig(s.hierarchy_config || '["Chương"]');
    setEditAttributionText(s.attribution_text || "");
    setEditIsPublished(s.is_published);
    setEditAuthorId(s.author?.id || s.author_id || "");
  };

  const handleUpdateSeries = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSeries || !editTitle.trim() || !token) return;

    setSubmitting(true);
    await withLoading(async () => {
      try {
        await updateSeries(
          editingSeries.id,
          {
            title: editTitle.trim(),
            summary: editSummary.trim() || undefined,
            cover_image: editCoverImage.trim() ? editCoverImage.trim() : "",
            category_id: editCategoryId || undefined,
            hierarchy_config: editHierarchyConfig,
            attribution_text: editAttributionText.trim() || undefined,
            is_published: editIsPublished,
            author_id: editAuthorId || undefined,
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
    }, "Đang lưu thay đổi khóa học...");
  };

  const handleDeleteSeries = async (id: string, sTitle: string) => {
    if (!token) return;
    if (!window.confirm(`Bạn có chắc muốn xóa khóa học "${sTitle}" cùng toàn bộ chương bên trong?`)) return;

    await withLoading(async () => {
      try {
        await deleteSeries(id, token);
        setSeriesList((prev) => prev.filter((s) => s.id !== id));
        if (selectedDetail?.id === id) {
          setSelectedDetail(null);
          setSelectedSeriesSlug(null);
          if (typeof window !== "undefined") {
            const currentUrl = new URL(window.location.href);
            currentUrl.searchParams.delete("slug");
            currentUrl.searchParams.delete("id");
            window.history.replaceState(null, "", currentUrl.pathname);
          }
        }
      } catch (err: any) {
        alert(`Lỗi: ${err.message}`);
      }
    }, "Đang xóa khóa học...");
  };

  const handleAddChapter = async (seriesId: string) => {
    if (!newChapterTitle.trim() || !token) return;
    await withLoading(async () => {
      try {
        const siblings = (selectedDetail?.chapters || []).filter((c) =>
          newChapterParentId ? c.parent_id === newChapterParentId : (!c.parent_id || c.level === 1)
        );
        const order = siblings.length + 1;
        let level = 1;
        if (newChapterParentId) {
          const parentCh = selectedDetail?.chapters?.find((c) => c.id === newChapterParentId);
          level = parentCh ? (parentCh.level || 1) + 1 : 2;
        }
        await addChapter(
          seriesId,
          {
            title: newChapterTitle.trim(),
            order,
            parent_id: newChapterParentId || undefined,
            level,
          },
          token
        );
        setNewChapterTitle("");
        if (selectedSeriesSlug) inspectSeries(selectedSeriesSlug);
        loadData();
      } catch (err: any) {
        alert(`Lỗi: ${err.message}`);
      }
    }, "Đang thêm chương học mới...");
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
    await withLoading(async () => {
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
    }, "Đang lưu chương học...");
  };

  const handleDeleteChapter = async (chapterId: string) => {
    if (!token) return;
    if (!window.confirm("Bạn có chắc muốn xóa chương này? Các bài viết trong chương sẽ được tách ra ngoài.")) return;

    await withLoading(async () => {
      try {
        await deleteChapter(chapterId, token);
        if (selectedSeriesSlug) inspectSeries(selectedSeriesSlug);
        loadData();
      } catch (err: any) {
        alert(`Lỗi: ${err.message}`);
      }
    }, "Đang xóa chương học...");
  };

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

        <AdminNav
          currentTab="series"
          actionButton={
            <button
              onClick={() => setShowNewSeriesModal(true)}
              className="flex items-center gap-1 text-xs font-semibold px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-sm shadow-blue-500/20"
            >
              <Plus className="w-4 h-4" />
              <span>Tạo Khóa học mới</span>
            </button>
          }
        />
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
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
              <select
                value={authorId}
                onChange={(e) => setAuthorId(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900"
              >
                <option value="">-- Tác giả (Mặc định: Bạn) --</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.full_name ? `${u.full_name} (@${u.username})` : u.username} {u.is_admin ? "⭐ (Admin)" : "• Thành viên"}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-stone-700 dark:text-stone-300">
                Mô tả khóa học:
              </label>
              <textarea
                rows={4}
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                placeholder="Tóm tắt lộ trình và mục tiêu khóa học..."
                className="w-full px-3 py-2.5 text-xs rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 min-h-[100px] leading-relaxed resize-y"
              />
            </div>

            {/* Phân cấp nội dung động */}
            <HierarchyConfigEditor
              value={hierarchyConfig}
              onChange={setHierarchyConfig}
            />

            {/* Bản quyền / Nguồn gốc */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-semibold text-stone-700 dark:text-stone-300">
                  Bản quyền &amp; Nguồn gốc (Attribution):
                </label>
                <button
                  type="button"
                  onClick={() =>
                    setAttributionText(
                      "Khóa học được biên dịch và tổng hợp từ tài liệu đào tạo chính thức của Anthropic PBC (Claude Certified Architect). Bản quyền nội dung gốc thuộc về Anthropic PBC. Bản dịch tiếng Việt và ghi chú thực hành bởi HungPH Blog."
                    )
                  }
                  className="text-[10px] text-blue-600 dark:text-blue-400 hover:underline font-semibold"
                >
                  + Mẫu bản quyền Anthropic
                </button>
              </div>
              <textarea
                rows={2}
                value={attributionText}
                onChange={(e) => setAttributionText(e.target.value)}
                placeholder="Nhập ghi chú bản quyền gốc (VD: Anthropic Claude Architect)..."
                className="w-full px-3 py-2 text-xs rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900"
              />
            </div>

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
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-stone-700 dark:text-stone-300">
                  Tiêu đề khóa học:
                </label>
                <input
                  type="text"
                  required
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  placeholder="Tiêu đề khóa học..."
                  className="w-full px-3 py-2 text-xs rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-stone-700 dark:text-stone-300">
                  Thuộc danh mục:
                </label>
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
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-stone-700 dark:text-stone-300 flex items-center justify-between">
                  <span>Tác giả khóa học:</span>
                  {editAuthorId && (
                    <span className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold">
                      Đã chọn
                    </span>
                  )}
                </label>
                <select
                  value={editAuthorId}
                  onChange={(e) => setEditAuthorId(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-900 dark:text-white font-medium"
                >
                  <option value="">-- Chưa gán tác giả --</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.full_name ? `${u.full_name} (@${u.username})` : u.username} {u.is_admin ? "⭐ (Admin)" : "• Thành viên"}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-stone-700 dark:text-stone-300">
                Mô tả khóa học:
              </label>
              <textarea
                rows={5}
                value={editSummary}
                onChange={(e) => setEditSummary(e.target.value)}
                placeholder="Tóm tắt nội dung và lộ trình khóa học..."
                className="w-full px-3 py-2.5 text-xs rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 min-h-[140px] leading-relaxed resize-y"
              />
            </div>

            {/* Phân cấp nội dung động cho edit */}
            <HierarchyConfigEditor
              value={editHierarchyConfig}
              onChange={setEditHierarchyConfig}
            />

            {/* Bản quyền / Nguồn gốc cho edit */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-semibold text-stone-700 dark:text-stone-300">
                  Bản quyền &amp; Nguồn gốc (Attribution):
                </label>
                <button
                  type="button"
                  onClick={() =>
                    setEditAttributionText(
                      "Khóa học được biên dịch và tổng hợp từ tài liệu đào tạo chính thức của Anthropic PBC (Claude Certified Architect). Bản quyền nội dung gốc thuộc về Anthropic PBC. Bản dịch tiếng Việt và ghi chú thực hành bởi HungPH Blog."
                    )
                  }
                  className="text-[10px] text-amber-600 dark:text-amber-400 hover:underline font-semibold"
                >
                  + Mẫu bản quyền Anthropic
                </button>
              </div>
              <textarea
                rows={2}
                value={editAttributionText}
                onChange={(e) => setEditAttributionText(e.target.value)}
                placeholder="Nhập ghi chú bản quyền gốc (VD: Anthropic Claude Architect)..."
                className="w-full px-3 py-2 text-xs rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900"
              />
            </div>

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

          <div className="relative min-h-[300px]">
            <LoadingOverlay isLoading={loading} message="Đang tải danh sách khóa học..." />

            {loading && seriesList.length === 0 ? (
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
              <div className={`space-y-3 transition-opacity duration-200 ${loading ? "opacity-40 pointer-events-none" : ""}`}>
                {seriesList.map((s) => {
                const isSelected = selectedSeriesSlug === s.slug || selectedDetail?.slug === s.slug || selectedDetail?.id === s.id;
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
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300">
                            {s.total_chapters} chương • {s.total_lessons} bài học
                          </span>
                          {!s.is_published && (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300">
                              Bản nháp
                            </span>
                          )}
                          {pendingCollabCounts[s.id] > 0 && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500 text-white animate-pulse flex items-center gap-1">
                              <Users className="w-2.5 h-2.5" />
                              <span>{pendingCollabCounts[s.id]} chờ duyệt</span>
                            </span>
                          )}
                        </div>
                        <h3 className="font-bold text-sm text-stone-900 dark:text-white truncate">
                          {s.title}
                        </h3>
                        {s.author && (
                          <div className="flex items-center gap-1.5 text-[11px] text-stone-500 dark:text-stone-400">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                            <span className="truncate">
                              Tác giả: <strong className="font-medium text-stone-700 dark:text-stone-300">{s.author.full_name || s.author.username}</strong>
                            </span>
                          </div>
                        )}
                        {s.summary && (
                          <p className="text-xs text-stone-500 line-clamp-2">
                            {s.summary}
                          </p>
                        )}
                      </div>

                      <div className="flex flex-col gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => {
                            inspectSeries(s.slug);
                            setInspectorTab("collaborators");
                          }}
                          className={`p-1 transition-colors ${
                            pendingCollabCounts[s.id] > 0
                              ? "text-amber-600 hover:text-amber-700 animate-pulse"
                              : "text-stone-400 hover:text-blue-600"
                          }`}
                          title="Quản lý cộng tác viên & phê duyệt"
                        >
                          <Users className="w-3.5 h-3.5" />
                        </button>
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
        </div>

        {/* Right: Chi tiết Dàn Outline & Quản lý Chương */}
        <div className="lg:col-span-6 space-y-4">
          <div className="text-xs font-semibold text-stone-500 uppercase tracking-wider">
            Dàn Outline & Các Chương
          </div>

          <div className="relative min-h-[360px]">
            <LoadingOverlay isLoading={detailLoading} message="Đang tải dàn bài học..." />

            {!selectedDetail && !detailLoading ? (
              <div className="p-12 text-center border border-dashed border-stone-200 dark:border-stone-800 rounded-3xl text-xs text-stone-400">
                Chọn một khóa học bên trái để xem và quản lý dàn outline từng chương.
              </div>
            ) : !selectedDetail && detailLoading ? (
              <div className="p-12 text-center border border-stone-200 dark:border-stone-800 rounded-3xl text-xs text-stone-500 bg-white dark:bg-stone-900/40 space-y-3">
                <div className="h-24 rounded-2xl bg-stone-100 dark:bg-stone-800 animate-pulse" />
                <div className="h-40 rounded-2xl bg-stone-100 dark:bg-stone-800 animate-pulse" />
              </div>
            ) : selectedDetail ? (
              <div className={`p-6 rounded-3xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900/60 space-y-5 shadow-sm transition-opacity duration-200 ${detailLoading ? "opacity-40 pointer-events-none" : ""}`}>
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-bold text-base text-stone-900 dark:text-white">
                    {selectedDetail.title}
                  </h3>
                  {selectedDetail.author && (
                    <p className="text-xs text-stone-500 mt-1 flex items-center gap-1.5">
                      <span>Tác giả:</span>
                      <strong className="font-semibold text-stone-800 dark:text-stone-200">
                        {selectedDetail.author.full_name || selectedDetail.author.username}
                      </strong>
                    </p>
                  )}
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

              {/* Attribution display if present */}
              {selectedDetail.attribution_text && (
                <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 text-xs text-amber-900 dark:text-amber-200 space-y-1">
                  <div className="font-bold flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-amber-700 dark:text-amber-400">
                    <span>Bản quyền &amp; Nguồn gốc tài liệu</span>
                  </div>
                  <p className="text-[11px] leading-relaxed opacity-90">{selectedDetail.attribution_text}</p>
                </div>
              )}

              {/* Tab Switcher: Outline vs Collaborators */}
              <div className="flex items-center gap-2 border-b border-stone-200 dark:border-stone-800 pb-3">
                <button
                  type="button"
                  onClick={() => setInspectorTab("outline")}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                    inspectorTab === "outline"
                      ? "bg-blue-600 text-white shadow-sm shadow-blue-500/20"
                      : "text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800"
                  }`}
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>Dàn bài &amp; Các chương ({selectedDetail.chapters?.length || 0})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setInspectorTab("collaborators")}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                    inspectorTab === "collaborators"
                      ? "bg-blue-600 text-white shadow-sm shadow-blue-500/20"
                      : "text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800"
                  }`}
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>Cộng tác viên &amp; Phê duyệt</span>
                  {pendingCollabCounts[selectedDetail.id] > 0 && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-500 text-white animate-pulse">
                      {pendingCollabCounts[selectedDetail.id]} chờ duyệt
                    </span>
                  )}
                </button>
              </div>

              {inspectorTab === "collaborators" ? (
                <SeriesCollaboratorsManager
                  seriesId={selectedDetail.id}
                  seriesTitle={selectedDetail.title}
                  token={token || ""}
                  users={users}
                  onCountChange={(pending) => {
                    setPendingCollabCounts((prev) => ({ ...prev, [selectedDetail.id]: pending }));
                  }}
                />
              ) : (
                <>
                  {/* Multi-level Chapter / Section Add Section */}
                  {(() => {
                    let levels = ["Chương"];
                    try {
                      if (selectedDetail.hierarchy_config) {
                        const parsed = JSON.parse(selectedDetail.hierarchy_config);
                        if (Array.isArray(parsed) && parsed.length > 0) levels = parsed;
                      }
                    } catch (e) {}

                    const tree = buildChapterTree(selectedDetail.chapters || [], levels);
                    const flatList = flattenChapterTree(tree);

                    // Parent node selected (if any)
                    const parentNode = flatList.find((n) => n.id === newChapterParentId);
                    const targetLevelIdx = parentNode ? (parentNode.level || 1) : 0;
                    const targetLevelName = levels[targetLevelIdx] || `Cấp ${targetLevelIdx + 1}`;

                    return (
                      <div className="space-y-4 pt-2 border-t border-stone-100 dark:border-stone-800">
                        <div className="space-y-2 p-3.5 rounded-2xl bg-stone-50 dark:bg-stone-800/50 border border-stone-200 dark:border-stone-700/80">
                          <div className="flex items-center justify-between text-xs font-semibold text-stone-700 dark:text-stone-300">
                            <span className="flex items-center gap-1.5">
                              <Plus className="w-3.5 h-3.5 text-blue-600" />
                              <span>Thêm mục mới vào dàn bài học:</span>
                            </span>
                            <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 font-bold">
                              Cấp {targetLevelIdx + 1}: {targetLevelName}
                            </span>
                          </div>

                          {levels.length > 1 && (
                            <div className="space-y-1">
                              <label className="text-[11px] font-medium text-stone-500">
                                Vị trí phân cấp (Chọn mục cha):
                              </label>
                              <select
                                value={newChapterParentId}
                                onChange={(e) => setNewChapterParentId(e.target.value)}
                                className="w-full px-2.5 py-1.5 text-xs rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 font-medium"
                              >
                                <option value="">+ Tạo {levels[0]} mới (Cấp 1 - Gốc)</option>
                                {flatList
                                  .filter((ch) => (ch.level || 1) < levels.length)
                                  .map((ch) => {
                                    const nextLvl = (ch.level || 1) + 1;
                                    const nextName = levels[nextLvl - 1] || `Cấp ${nextLvl}`;
                                    const indent = "— ".repeat((ch.level || 1) - 1);
                                    return (
                                      <option key={ch.id} value={ch.id}>
                                        {indent}↳ Thêm [{nextName}] vào: {ch.displayNumber} - {ch.title}
                                      </option>
                                    );
                                  })}
                              </select>
                            </div>
                          )}

                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={newChapterTitle}
                              onChange={(e) => setNewChapterTitle(e.target.value)}
                              placeholder={`Tiêu đề ${targetLevelName} mới (Ví dụ: ${targetLevelName} 1: Giới thiệu)...`}
                              className="flex-1 px-3 py-1.5 text-xs rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900"
                            />
                            <button
                              type="button"
                              onClick={() => handleAddChapter(selectedDetail.id)}
                              className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shrink-0 shadow-xs"
                            >
                              Thêm {targetLevelName}
                            </button>
                          </div>
                        </div>

                        {/* Chapters Tree List */}
                        <div className="space-y-2.5 pt-1">
                          {flatList.length > 0 ? (
                            flatList.map((ch) => {
                              const lvl = ch.level || 1;
                              const lvlName = levels[lvl - 1] || `Cấp ${lvl}`;
                              const indentPx = Math.min((lvl - 1) * 20, 100);

                              const borderColors = [
                                "border-blue-400 dark:border-blue-600",
                                "border-indigo-400 dark:border-indigo-600",
                                "border-purple-400 dark:border-purple-600",
                                "border-amber-400 dark:border-amber-600",
                                "border-emerald-400 dark:border-emerald-600",
                              ];
                              const bgColors = [
                                "bg-white dark:bg-stone-900/40",
                                "bg-blue-50/20 dark:bg-blue-950/10",
                                "bg-indigo-50/20 dark:bg-indigo-950/10",
                                "bg-purple-50/20 dark:bg-purple-950/10",
                                "bg-emerald-50/20 dark:bg-emerald-950/10",
                              ];
                              const colorIdx = Math.min(lvl - 1, borderColors.length - 1);

                          const isLeaf = lvl === levels.length;

                          return (
                            <div
                              key={ch.id}
                              style={{ marginLeft: `${indentPx}px` }}
                              className={`p-3.5 rounded-2xl border ${
                                lvl > 1
                                  ? `border-l-4 ${borderColors[colorIdx]} ${bgColors[colorIdx]} border-stone-200 dark:border-stone-800`
                                  : "border-stone-200 dark:border-stone-800 bg-stone-50/50 dark:bg-stone-800/40"
                              } space-y-2 transition-all`}
                            >
                              {editingChapterId === ch.id ? (
                                <div className="space-y-2">
                                  <input
                                    type="text"
                                    value={editingChapterTitle}
                                    onChange={(e) => setEditingChapterTitle(e.target.value)}
                                    placeholder={`Tiêu đề ${lvlName}...`}
                                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-blue-400 bg-white dark:bg-stone-900"
                                  />
                                  <input
                                    type="text"
                                    value={editingChapterDesc}
                                    onChange={(e) => setEditingChapterDesc(e.target.value)}
                                    placeholder="Mô tả tóm tắt (Tùy chọn)..."
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
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex-1 min-w-0 flex items-center gap-2">
                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-stone-200 dark:bg-stone-700 text-stone-800 dark:text-stone-200 shrink-0">
                                      {lvlName} {ch.displayNumber}
                                    </span>
                                    <span className="font-bold text-xs text-stone-900 dark:text-white truncate">
                                      {ch.title}
                                    </span>
                                  </div>

                                  <div className="flex items-center gap-1.5 shrink-0">
                                    {!isLeaf && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setNewChapterParentId(ch.id);
                                          window.scrollTo({ top: 300, behavior: "smooth" });
                                        }}
                                        className="text-[11px] font-semibold text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/60 px-2 py-1 rounded-lg transition-colors flex items-center gap-1"
                                        title={`Thêm ${levels[lvl] || "mục con"} thuộc ${ch.title}`}
                                      >
                                        <Plus className="w-3 h-3" /> Thêm {levels[lvl] || "mục con"}
                                      </button>
                                    )}

                                    {isLeaf && (
                                      <Link
                                        href={`/editor/new?series_id=${selectedDetail.id}&series_slug=${selectedDetail.slug}&chapter_id=${ch.id}`}
                                        className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/60 px-2 py-1 rounded-lg transition-colors flex items-center gap-1"
                                      >
                                        <Plus className="w-3 h-3" /> Viết bài vào {lvlName}
                                      </Link>
                                    )}

                                    <button
                                      onClick={() => startEditChapter(ch.id, ch.title, ch.description)}
                                      className="p-1 text-stone-400 hover:text-amber-600 transition-colors rounded-md"
                                      title="Sửa tên mục"
                                    >
                                      <Edit className="w-3 h-3" />
                                    </button>
                                    <button
                                      onClick={() => handleDeleteChapter(ch.id)}
                                      className="p-1 text-stone-400 hover:text-rose-600 transition-colors rounded-md"
                                      title="Xóa mục"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  </div>
                                </div>
                              )}

                              {ch.description && (
                                <p className="text-[11px] text-stone-500 pl-1">{ch.description}</p>
                              )}

                              {/* Lessons list inside chapter */}
                              {ch.lessons && ch.lessons.length > 0 && (
                                <div className="space-y-1 pl-4 border-l-2 border-stone-200 dark:border-stone-700 mt-2">
                                  {ch.lessons.map((lesson, lIdx) => (
                                    <div
                                      key={lesson.id}
                                      className="flex items-center justify-between text-xs py-1 text-stone-700 dark:text-stone-300"
                                    >
                                      <span className="truncate">
                                        Bài {ch.displayNumber}.{lIdx + 1}: {lesson.title}
                                      </span>
                                      <div className="flex items-center gap-2 text-[11px]">
                                        <Link
                                          href={`/editor/${lesson.id}?series_id=${selectedDetail.id}&series_slug=${selectedDetail.slug}`}
                                          className="text-stone-400 hover:text-blue-600"
                                        >
                                          Sửa
                                        </Link>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })
                      ) : (
                        <div className="text-center py-6 text-xs text-stone-400 italic">
                          Khóa học này chưa có mục nào trong dàn bài học. Hãy thêm {levels[0]} đầu tiên ở trên!
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}
                </>
              )}
            </div>
          ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AdminSeriesPage() {
  return (
    <AdminGuard requireAdmin={true}>
      <Suspense fallback={<div className="p-8 text-center text-xs text-stone-400">Đang tải quản lý khóa học...</div>}>
        <AdminSeriesContent />
      </Suspense>
    </AdminGuard>
  );
}
