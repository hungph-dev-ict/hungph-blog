"use client";

import React, { useEffect, useState, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Save,
  Send,
  Upload,
  Settings,
  FolderPlus,
  CheckCircle,
  ExternalLink,
  GraduationCap,
  Layers,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import {
  createPost,
  updatePost,
  fetchPostById,
  fetchCategories,
  createCategory,
  fetchSeries,
  fetchSeriesBySlug,
  uploadMedia,
  getFullImageUrl,
} from "@/lib/api";
import { Category, Chapter, PostDetail, Series } from "@/lib/types";
import { TipTapEditor } from "@/components/editor/TipTapEditor";

interface PostEditorFormProps {
  postId?: string;
}

export const PostEditorForm: React.FC<PostEditorFormProps> = ({ postId }) => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, token, isLoading } = useAuth();
  const coverInputRef = useRef<HTMLInputElement>(null);

  // Form State
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [summary, setSummary] = useState("");
  const [contentHtml, setContentHtml] = useState("<p></p>");
  const [coverImage, setCoverImage] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [isPublished, setIsPublished] = useState(false);

  // Series & Chapter State
  const [seriesList, setSeriesList] = useState<Series[]>([]);
  const [seriesId, setSeriesId] = useState("");
  const [chapterList, setChapterList] = useState<Chapter[]>([]);
  const [chapterId, setChapterId] = useState("");
  const [orderInChapter, setOrderInChapter] = useState(1);

  // Aux state
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(!!postId);
  const [savedSlug, setSavedSlug] = useState<string | null>(null);
  const [showNewCatModal, setShowNewCatModal] = useState(false);
  const [newCatName, setNewCatName] = useState("");

  // Check auth
  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/admin/login");
    }
  }, [user, isLoading, router]);

  // Load categories & series
  useEffect(() => {
    fetchCategories().then(setCategories).catch(console.error);
    fetchSeries().then(setSeriesList).catch(console.error);
  }, []);

  // Pre-fill series and chapter from query params if new post
  useEffect(() => {
    if (!postId && searchParams) {
      const qSeries = searchParams.get("series_id");
      const qChapter = searchParams.get("chapter_id");
      if (qSeries) setSeriesId(qSeries);
      if (qChapter) setChapterId(qChapter);
    }
  }, [postId, searchParams]);

  // Load chapters whenever seriesId changes
  useEffect(() => {
    if (!seriesId) {
      setChapterList([]);
      setChapterId("");
      return;
    }
    const selected = seriesList.find((s) => s.id === seriesId);
    if (selected) {
      fetchSeriesBySlug(selected.slug)
        .then((detail) => {
          setChapterList(detail.chapters || []);
        })
        .catch(console.error);
    }
  }, [seriesId, seriesList]);

  // Load existing post if editing
  useEffect(() => {
    if (!postId || !token) return;
    setPageLoading(true);
    fetchPostById(postId, token)
      .then((data: PostDetail) => {
        setTitle(data.title);
        setSlug(data.slug);
        setSummary(data.summary || "");
        setContentHtml(data.content_html || "<p></p>");
        setCoverImage(data.cover_image || "");
        setCategoryId(data.category?.id || "");
        setTagsInput(data.tags.map((t) => t.name).join(", "));
        setIsPublished(data.is_published);
        setSavedSlug(data.slug);
        if (data.series_id) setSeriesId(data.series_id);
        if (data.chapter_id) setChapterId(data.chapter_id);
        if (data.order_in_chapter) setOrderInChapter(data.order_in_chapter);
      })
      .catch((err) => {
        alert(`Không thể tải bài viết: ${err.message}`);
        router.push("/admin/posts");
      })
      .finally(() => setPageLoading(false));
  }, [postId, token, router]);

  // Auto generate slug from title when typing new post
  const handleTitleChange = (val: string) => {
    setTitle(val);
    if (!postId) {
      const generated = val
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[đĐ]/g, "d")
        .replace(/[^a-z0-9\s-]/g, "")
        .trim()
        .replace(/\s+/g, "-");
      setSlug(generated);
    }
  };

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !token) return;

    try {
      const res = await uploadMedia(file, token);
      setCoverImage(res.url);
    } catch (err: any) {
      alert(`Lỗi upload ảnh cover: ${err.message}`);
    }
  };

  const handleAddCategory = async () => {
    if (!newCatName.trim() || !token) return;
    try {
      const newCat = await createCategory({ name: newCatName.trim() }, token);
      setCategories((prev) => [...prev, newCat]);
      setCategoryId(newCat.id);
      setNewCatName("");
      setShowNewCatModal(false);
    } catch (err: any) {
      alert(`Lỗi tạo danh mục: ${err.message}`);
    }
  };

  const handleSubmit = async (publishStatus: boolean) => {
    if (!title.trim()) {
      alert("Vui lòng nhập tiêu đề bài viết!");
      return;
    }
    if (!token) {
      alert("Phiên đăng nhập hết hạn, vui lòng đăng nhập lại.");
      router.push("/admin/login");
      return;
    }

    setLoading(true);
    const tagsArray = tagsInput
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    const payload = {
      title: title.trim(),
      slug: slug.trim() || undefined,
      summary: summary.trim() || undefined,
      content_html: contentHtml,
      cover_image: coverImage.trim() || undefined,
      category_id: categoryId || undefined,
      series_id: seriesId || undefined,
      chapter_id: chapterId || undefined,
      order_in_chapter: Number(orderInChapter) || 1,
      tags: tagsArray,
      is_published: publishStatus,
    };

    try {
      let savedPost: PostDetail;
      if (postId) {
        savedPost = await updatePost(postId, payload, token);
      } else {
        savedPost = await createPost(payload, token);
      }

      setSavedSlug(savedPost.slug);
      setIsPublished(savedPost.is_published);
      alert(
        publishStatus
          ? "🎉 Bài viết đã được xuất bản thành công!"
          : "Đã lưu bài viết vào bản nháp!"
      );
      if (!postId) {
        router.push(`/admin/editor/${savedPost.id}`);
      }
    } catch (err: any) {
      alert(`Lỗi khi lưu bài viết: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  if (pageLoading) {
    return (
      <div className="py-20 text-center text-sm text-stone-500 animate-pulse">
        Đang tải bài viết...
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-20">
      {/* Top action bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-stone-200 dark:border-stone-800 pb-4 sticky top-16 z-30 bg-stone-50/90 dark:bg-stone-950/90 backdrop-blur-md pt-2">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/posts"
            className="p-2 rounded-xl text-stone-500 hover:text-stone-900 dark:hover:text-white hover:bg-stone-200/60 dark:hover:bg-stone-800 transition-colors"
            title="Quay lại danh sách"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-lg font-bold text-stone-900 dark:text-white">
              {postId ? "Chỉnh Sửa Bài Viết" : "Tạo Bài Viết Mới"}
            </h1>
            <div className="flex items-center gap-2 text-xs text-stone-500">
              <span>Trạng thái:</span>
              {isPublished ? (
                <span className="text-emerald-600 font-semibold flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" /> Đã xuất bản
                </span>
              ) : (
                <span className="text-amber-600 font-medium">Bản nháp</span>
              )}
              {seriesId && (
                <span className="text-blue-600 font-medium flex items-center gap-1">
                  • <GraduationCap className="w-3 h-3" /> Thuộc Khóa học
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {savedSlug && isPublished && (
            <Link
              href={`/posts/${savedSlug}`}
              target="_blank"
              className="inline-flex items-center gap-1 text-xs font-semibold px-3 py-2 rounded-xl border border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Xem bài viết</span>
            </Link>
          )}

          <button
            type="button"
            disabled={loading}
            onClick={() => handleSubmit(false)}
            className="inline-flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-xl border border-stone-300 dark:border-stone-700 text-stone-700 dark:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 disabled:opacity-50 transition-colors"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Lưu nháp</span>
          </button>

          <button
            type="button"
            disabled={loading}
            onClick={() => handleSubmit(true)}
            className="inline-flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-sm shadow-blue-500/25 disabled:opacity-50 transition-all"
          >
            <Send className="w-3.5 h-3.5" />
            <span>{isPublished ? "Cập nhật xuất bản" : "Xuất bản ngay"}</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Main Editor Section */}
        <div className="lg:col-span-8 space-y-6">
          {/* Title Input */}
          <div>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => handleTitleChange(e.target.value)}
              placeholder="Nhập tiêu đề bài viết tại đây..."
              className="w-full text-2xl sm:text-3xl font-extrabold px-4 py-3 rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 text-stone-900 dark:text-white placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
            />
          </div>

          {/* TipTap Rich Text Editor */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-stone-500">
              Nội dung bài viết (WYSIWYG Editor)
            </label>
            <TipTapEditor
              content={contentHtml}
              onChange={setContentHtml}
              token={token}
            />
          </div>
        </div>

        {/* Sidebar Settings Section */}
        <div className="lg:col-span-4 space-y-6">
          <div className="p-5 rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900/60 shadow-sm space-y-5">
            <div className="flex items-center gap-2 font-bold text-sm text-stone-900 dark:text-white pb-3 border-b border-stone-100 dark:border-stone-800">
              <Settings className="w-4 h-4 text-blue-600" />
              <span>Cài đặt bài viết</span>
            </div>

            {/* Thuộc Khóa học / Tuyển tập (Series/Course) */}
            <div className="p-3.5 rounded-xl border border-blue-200/80 dark:border-blue-900/50 bg-blue-50/40 dark:bg-blue-950/20 space-y-2.5">
              <div className="flex items-center gap-1.5 text-xs font-bold text-blue-700 dark:text-blue-400">
                <GraduationCap className="w-4 h-4" />
                <span>Khóa học / Tuyển tập (Prep Course)</span>
              </div>
              <p className="text-[11px] text-stone-500">
                Gắn bài này vào một chương cụ thể để người đọc theo dõi theo outline lộ trình.
              </p>

              <select
                value={seriesId}
                onChange={(e) => setSeriesId(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900"
              >
                <option value="">-- Bài viết độc lập (Không thuộc khóa học) --</option>
                {seriesList.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title}
                  </option>
                ))}
              </select>

              {seriesId && (
                <>
                  <div className="space-y-1 pt-1">
                    <label className="text-[11px] font-semibold text-stone-600 dark:text-stone-300">
                      Thuộc chương:
                    </label>
                    <select
                      value={chapterId}
                      onChange={(e) => setChapterId(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900"
                    >
                      <option value="">-- Chọn chương --</option>
                      {chapterList.map((ch, idx) => (
                        <option key={ch.id} value={ch.id}>
                          Chương {idx + 1}: {ch.title}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-stone-600 dark:text-stone-300">
                      Thứ tự bài trong chương:
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={orderInChapter}
                      onChange={(e) => setOrderInChapter(parseInt(e.target.value) || 1)}
                      className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900"
                    />
                  </div>
                </>
              )}
            </div>

            {/* Slug */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-stone-700 dark:text-stone-300">
                Đường dẫn tĩnh (Slug URL)
              </label>
              <input
                type="text"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="duong-dan-bai-viet"
                className="w-full px-3 py-2 text-xs font-mono rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800/80 text-stone-800 dark:text-stone-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Category */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-stone-700 dark:text-stone-300">
                  Danh mục
                </label>
                <button
                  type="button"
                  onClick={() => setShowNewCatModal(true)}
                  className="text-[11px] text-blue-600 hover:underline flex items-center gap-0.5"
                >
                  <FolderPlus className="w-3 h-3" />
                  <span>Tạo mới</span>
                </button>
              </div>

              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800/80 text-stone-800 dark:text-stone-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">-- Chọn danh mục --</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>

              {showNewCatModal && (
                <div className="p-3 rounded-xl border border-blue-200 dark:border-blue-900 bg-blue-50/50 dark:bg-blue-950/30 space-y-2 mt-2">
                  <input
                    type="text"
                    value={newCatName}
                    onChange={(e) => setNewCatName(e.target.value)}
                    placeholder="Tên danh mục mới..."
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900"
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowNewCatModal(false)}
                      className="text-[11px] px-2 py-1 text-stone-500 hover:text-stone-700"
                    >
                      Hủy
                    </button>
                    <button
                      type="button"
                      onClick={handleAddCategory}
                      className="text-[11px] px-3 py-1 bg-blue-600 text-white rounded-lg font-semibold"
                    >
                      Thêm
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Tags */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-stone-700 dark:text-stone-300">
                Thẻ (phân cách bằng dấu phẩy)
              </label>
              <input
                type="text"
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                placeholder="NextJS, FastAPI, AI, Kiến trúc"
                className="w-full px-3 py-2 text-xs rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800/80 text-stone-800 dark:text-stone-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Cover Image */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-stone-700 dark:text-stone-300">
                  Ảnh bìa (Cover Image)
                </label>
                <button
                  type="button"
                  onClick={() => coverInputRef.current?.click()}
                  className="text-[11px] text-blue-600 hover:underline flex items-center gap-1"
                >
                  <Upload className="w-3 h-3" />
                  <span>Tải ảnh lên</span>
                </button>
              </div>

              <input
                type="file"
                ref={coverInputRef}
                onChange={handleCoverUpload}
                accept="image/*"
                className="hidden"
              />

              <input
                type="text"
                value={coverImage}
                onChange={(e) => setCoverImage(e.target.value)}
                placeholder="Dán URL ảnh hoặc tải lên..."
                className="w-full px-3 py-2 text-xs rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800/80 text-stone-800 dark:text-stone-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />

              {coverImage && (
                <div className="relative rounded-xl overflow-hidden border border-stone-200 dark:border-stone-700 h-32 bg-stone-100">
                  <img
                    src={getFullImageUrl(coverImage)}
                    alt="Cover preview"
                    className="w-full h-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => setCoverImage("")}
                    className="absolute top-1 right-1 px-1.5 py-0.5 rounded bg-black/60 text-white text-[10px]"
                  >
                    Xóa
                  </button>
                </div>
              )}
            </div>

            {/* Summary */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-stone-700 dark:text-stone-300">
                Tóm tắt ngắn (SEO & Card)
              </label>
              <textarea
                rows={3}
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                placeholder="Đoạn văn ngắn tóm tắt nội dung bài viết..."
                className="w-full px-3 py-2 text-xs rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800/80 text-stone-800 dark:text-stone-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
