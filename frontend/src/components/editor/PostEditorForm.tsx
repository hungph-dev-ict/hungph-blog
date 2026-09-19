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
  ArrowUp,
  ArrowDown,
  Link as LinkIcon,
  Unlink,
  ListOrdered,
  Check,
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
import { Category, Chapter, PostDetail, Series, SeriesDetail } from "@/lib/types";
import { TipTapEditor } from "@/components/editor/TipTapEditor";
import { Breadcrumbs } from "@/components/common/Breadcrumbs";

interface PostEditorFormProps {
  postId?: string;
}

const slugify = (val: string) =>
  val
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, "d")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");

export const PostEditorForm: React.FC<PostEditorFormProps> = ({ postId }) => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, token, isLoading } = useAuth();
  const coverInputRef = useRef<HTMLInputElement>(null);

  // Form State
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [isSlugSynced, setIsSlugSynced] = useState(!postId); // Default auto-sync on new post, lock on edit unless toggled
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
  const [selectedLevelIds, setSelectedLevelIds] = useState<string[]>([]);
  const [postSeriesDetail, setPostSeriesDetail] = useState<SeriesDetail | null>(null);

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
    if (!postId && searchParams && seriesList.length > 0) {
      const qSeries = searchParams.get("series_id");
      const qChapter = searchParams.get("chapter_id");
      if (qSeries) {
        setSeriesId(qSeries);
        const selected = seriesList.find((s) => s.id === qSeries);
        if (selected?.category_id) {
          setCategoryId(selected.category_id);
        }
      }
      if (qChapter) setChapterId(qChapter);
    }
  }, [postId, searchParams, seriesList]);

  // Load chapters and full series detail whenever seriesId changes
  useEffect(() => {
    if (!seriesId) {
      setChapterList([]);
      setChapterId("");
      setSelectedLevelIds([]);
      setPostSeriesDetail(null);
      return;
    }
    const selected = seriesList.find((s) => s.id === seriesId);
    const slugToFetch = selected?.slug || searchParams?.get("series_slug") || postSeriesDetail?.slug;

    if (slugToFetch) {
      fetchSeriesBySlug(slugToFetch)
        .then((detail) => {
          setPostSeriesDetail(detail);
          setChapterList(detail.chapters || []);
        })
        .catch(console.error);
    }
  }, [seriesId, seriesList, searchParams]);

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
        if (data.series_outline) setPostSeriesDetail(data.series_outline);
      })
      .catch((err) => {
        alert(`Không thể tải bài viết: ${err.message}`);
        const qSeries = searchParams?.get("series_id");
        const qSlug = searchParams?.get("series_slug");
        if (qSlug) {
          router.push(`/admin/series?slug=${qSlug}`);
        } else if (qSeries) {
          router.push(`/admin/series?id=${qSeries}`);
        } else {
          router.push("/admin/posts");
        }
      })
      .finally(() => setPageLoading(false));
  }, [postId, token, router, searchParams]);

  // Handle series selection & auto-inherit category
  const handleSeriesChange = (newSeriesId: string) => {
    setSeriesId(newSeriesId);
    setSelectedLevelIds([]);
    setChapterId("");
    setPostSeriesDetail(null);
    if (newSeriesId) {
      const selected = seriesList.find((s) => s.id === newSeriesId);
      if (selected?.category_id) {
        setCategoryId(selected.category_id);
      }
    }
  };

  // Selected series hierarchy config & details
  const selectedSeries =
    (postSeriesDetail && (postSeriesDetail.id === seriesId || !seriesId) ? postSeriesDetail : null) ||
    seriesList.find((s) => s.id === seriesId) ||
    postSeriesDetail ||
    (searchParams?.get("series_id") ? seriesList.find((s) => s.id === searchParams.get("series_id")) : null) ||
    null;

  const targetSeriesSlug = selectedSeries?.slug || searchParams?.get("series_slug") || "";
  const targetSeriesTitle = selectedSeries?.title || postSeriesDetail?.title || "";
  const isCoursePost = !!seriesId || !!searchParams?.get("series_id");

  const backHref = targetSeriesSlug
    ? `/admin/series?slug=${targetSeriesSlug}`
    : seriesId
    ? `/admin/series?id=${seriesId}`
    : "/admin/posts";

  const backTitle = targetSeriesTitle
    ? `Quay lại khóa học "${targetSeriesTitle}"`
    : isCoursePost
    ? "Quay lại quản lý khóa học"
    : "Quay lại danh sách bài viết";

  const hierarchyLevels: string[] = React.useMemo(() => {
    const raw =
      postSeriesDetail?.hierarchy_config ||
      selectedSeries?.hierarchy_config ||
      seriesList.find((s) => s.id === seriesId)?.hierarchy_config;

    if (!raw) return ["Chương"];
    try {
      const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((item) => String(item).trim() || "Cấp");
      }
    } catch (e) {}
    return ["Chương"];
  }, [selectedSeries, postSeriesDetail, seriesList, seriesId]);

  // Sync selected level states when chapterId is known
  useEffect(() => {
    if (!chapterId || chapterList.length === 0) return;
    const targetChapter = chapterList.find((c) => c.id === chapterId);
    if (!targetChapter) return;

    // Lần ngược từ targetChapter lên root để lấy toàn bộ chuỗi id
    const path: Chapter[] = [targetChapter];
    let curr = targetChapter;
    while (curr.parent_id) {
      const parent = chapterList.find((c) => c.id === curr.parent_id);
      if (parent) {
        path.unshift(parent);
        curr = parent;
      } else {
        break;
      }
    }

    setSelectedLevelIds(path.map((c) => c.id));
  }, [chapterId, chapterList]);

  // Auto generate slug from title when typing
  const handleTitleChange = (val: string) => {
    setTitle(val);
    if (isSlugSynced) {
      setSlug(slugify(val));
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

    if (seriesId) {
      const isAllSelected =
        hierarchyLevels.length > 0 &&
        hierarchyLevels.every((_, idx) => !!selectedLevelIds[idx]);
      if (!isAllSelected || !chapterId) {
        alert(
          `Khóa học này yêu cầu phân cấp ${hierarchyLevels.length} tầng. Vui lòng chọn đầy đủ cả ${hierarchyLevels.length} cấp phân mục (${hierarchyLevels.join(" > ")}) trước khi lưu bài viết!`
        );
        return;
      }
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
        const queryParams = new URLSearchParams();
        if (seriesId) queryParams.set("series_id", seriesId);
        if (targetSeriesSlug) queryParams.set("series_slug", targetSeriesSlug);
        const qs = queryParams.toString() ? `?${queryParams.toString()}` : "";
        router.push(`/admin/editor/${savedPost.id}${qs}`);
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
    <div className="w-full space-y-4 pb-20">
      <Breadcrumbs
        items={[
          { label: "Quản trị", href: "/admin/posts" },
          ...(isCoursePost
            ? [
                {
                  label: targetSeriesTitle ? `Khóa học: ${targetSeriesTitle}` : "Khóa học",
                  href: backHref,
                },
              ]
            : []),
          { label: postId ? "Chỉnh sửa bài viết" : "Tạo bài viết mới" },
        ]}
      />

      {/* Top action bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-stone-200 dark:border-stone-800 pb-4 sticky top-16 z-30 bg-stone-50/90 dark:bg-stone-950/90 backdrop-blur-md pt-2">
        <div className="flex items-center gap-3">
          <Link
            href={backHref}
            className="p-2 rounded-xl text-stone-500 hover:text-stone-900 dark:hover:text-white hover:bg-stone-200/60 dark:hover:bg-stone-800 transition-colors"
            title={backTitle}
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
              {isCoursePost && (
                <Link
                  href={backHref}
                  className="text-blue-600 dark:text-blue-400 hover:underline font-medium flex items-center gap-1"
                  title={backTitle}
                >
                  • <GraduationCap className="w-3 h-3" /> {targetSeriesTitle ? `Khóa học: ${targetSeriesTitle}` : "Thuộc Khóa học"}
                </Link>
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
                onChange={(e) => handleSeriesChange(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 font-medium"
              >
                <option value="">-- Bài viết độc lập (Không thuộc khóa học) --</option>
                {seriesList.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title}
                  </option>
                ))}
              </select>

              {seriesId && (
                <div className="space-y-3 pt-1 border-t border-blue-100 dark:border-blue-900/40">
                  {/* Status Banner */}
                  {(() => {
                    const selectedCount = hierarchyLevels.filter((_, idx) => !!selectedLevelIds[idx]).length;
                    const isAllSelected = selectedCount === hierarchyLevels.length && hierarchyLevels.length > 0;

                    return (
                      <div className={`p-2.5 rounded-xl text-xs flex items-center justify-between border ${
                        isAllSelected
                          ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200"
                          : "bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-200"
                      }`}>
                        <span className="font-semibold">
                          {isAllSelected
                            ? `✓ Đã chọn đủ ${hierarchyLevels.length}/${hierarchyLevels.length} cấp phân mục`
                            : `⚠️ Đã chọn: ${selectedCount}/${hierarchyLevels.length} cấp (Bắt buộc chọn đủ cả ${hierarchyLevels.length} cấp)`}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded-md font-bold uppercase tracking-wider bg-white/70 dark:bg-black/40">
                          {hierarchyLevels.length} Tầng
                        </span>
                      </div>
                    );
                  })()}

                  {/* Dynamic Multi-level Cascading Selectors */}
                  <div className="space-y-2.5">
                    {hierarchyLevels.map((lvlName, idx) => {
                      const prevSelectedId = idx === 0 ? null : selectedLevelIds[idx - 1];
                      const isEnabled = idx === 0 || !!prevSelectedId;
                      const currentVal = selectedLevelIds[idx] || "";

                      let availableChapters: Chapter[] = [];
                      if (idx === 0) {
                        availableChapters = chapterList.filter((c) => !c.parent_id || c.level === 1);
                      } else if (prevSelectedId) {
                        availableChapters = chapterList.filter((c) => c.parent_id === prevSelectedId);
                      }

                      return (
                        <div
                          key={idx}
                          style={{ paddingLeft: `${idx * 8}px` }}
                          className={`space-y-1 ${idx > 0 ? "border-l-2 border-blue-300 dark:border-blue-700" : ""}`}
                        >
                          <label className="text-[11px] font-semibold text-stone-700 dark:text-stone-300 flex items-center gap-1">
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-stone-200 dark:bg-stone-700 font-bold">
                              Cấp {idx + 1}
                            </span>
                            <span>{lvlName}:</span>
                            {idx === hierarchyLevels.length - 1 && (
                              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">
                                (Cấp bài viết)
                              </span>
                            )}
                          </label>

                          <select
                            disabled={!isEnabled}
                            value={currentVal}
                            onChange={(e) => {
                              const val = e.target.value;
                              const updated = [...selectedLevelIds];
                              updated[idx] = val;
                              for (let i = idx + 1; i < hierarchyLevels.length; i++) {
                                updated[i] = "";
                              }
                              setSelectedLevelIds(updated);

                              if (idx === hierarchyLevels.length - 1 && val) {
                                setChapterId(val);
                              } else {
                                setChapterId("");
                              }
                            }}
                            className={`w-full px-2.5 py-1.5 text-xs rounded-lg border font-medium transition-colors ${
                              !isEnabled
                                ? "bg-stone-100 dark:bg-stone-800/50 border-stone-200 dark:border-stone-800 text-stone-400 cursor-not-allowed"
                                : currentVal
                                ? "bg-white dark:bg-stone-900 border-blue-400 dark:border-blue-600 text-stone-900 dark:text-white"
                                : "bg-white dark:bg-stone-900 border-stone-300 dark:border-stone-700 text-stone-600 dark:text-stone-300"
                            }`}
                          >
                            <option value="">
                              {!isEnabled
                                ? `-- Vui lòng chọn ${hierarchyLevels[idx - 1]} trước --`
                                : `-- Chọn ${lvlName} --`}
                            </option>
                            {availableChapters.map((ch, chIdx) => (
                              <option key={ch.id} value={ch.id}>
                                {lvlName} {chIdx + 1}: {ch.title}
                              </option>
                            ))}
                          </select>

                          {isEnabled && availableChapters.length === 0 && (
                            <p className="text-[10px] text-amber-600 dark:text-amber-400 pl-1 italic">
                              Chưa có {lvlName} nào được tạo thuộc mục trên. Vui lòng vào{" "}
                              <Link
                                href={`/admin/series`}
                                target="_blank"
                                className="underline font-semibold"
                              >
                                Quản lý Khóa học
                              </Link>{" "}
                              để tạo {lvlName}!
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Ordering & Relative Placement in Chapter */}
                  {chapterId && (() => {
                    const currentChapter = chapterList.find((c) => c.id === chapterId);
                    const existingLessons = (currentChapter?.lessons || []).filter((l) => l.id !== postId);
                    const currentPos = Math.max(0, Math.min(orderInChapter - 1, existingLessons.length));

                    return (
                      <div className="space-y-2 pt-2 border-t border-blue-100 dark:border-blue-900/40">
                        <div className="flex items-center justify-between">
                          <label className="text-[11px] font-semibold text-stone-700 dark:text-stone-300 flex items-center gap-1">
                            <ListOrdered className="w-3.5 h-3.5 text-blue-600" />
                            <span>Vị trí trong chương:</span>
                          </label>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 font-bold">
                            Vị trí số: {orderInChapter}
                          </span>
                        </div>

                        {/* Relative Placement Dropdown */}
                        <div className="space-y-1">
                          <select
                            value={
                              currentPos === existingLessons.length
                                ? "end"
                                : currentPos === 0
                                ? "start"
                                : `before:${currentPos}`
                            }
                            onChange={(e) => {
                              const val = e.target.value;
                              if (val === "end") {
                                setOrderInChapter(existingLessons.length + 1);
                              } else if (val === "start") {
                                setOrderInChapter(1);
                              } else if (val.startsWith("before:")) {
                                const idx = parseInt(val.split(":")[1]);
                                setOrderInChapter(idx + 1);
                              } else if (val.startsWith("after:")) {
                                const idx = parseInt(val.split(":")[1]);
                                setOrderInChapter(idx + 2);
                              }
                            }}
                            className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 font-medium"
                          >
                            <option value="end">
                              📌 Cuối chương (Mặc định - Vị trí {existingLessons.length + 1})
                            </option>
                            <option value="start">📌 Đầu chương (Vị trí 1)</option>
                            {existingLessons.map((l, idx) => (
                              <React.Fragment key={l.id}>
                                <option value={`before:${idx}`}>
                                  ⬆️ Trước bài: &ldquo;{l.title.slice(0, 30)}{l.title.length > 30 ? "..." : ""}&rdquo;
                                </option>
                                <option value={`after:${idx}`}>
                                  ⬇️ Sau bài: &ldquo;{l.title.slice(0, 30)}{l.title.length > 30 ? "..." : ""}&rdquo;
                                </option>
                              </React.Fragment>
                            ))}
                          </select>
                        </div>

                        {/* Interactive Outline Preview */}
                        <div className="mt-2 space-y-1.5">
                          <div className="flex items-center justify-between text-[10px] text-stone-500 font-semibold uppercase tracking-wider">
                            <span>Sơ đồ thứ tự bài học</span>
                            <span>{existingLessons.length + 1} bài</span>
                          </div>

                          <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
                            {/* Items before current */}
                            {existingLessons.slice(0, currentPos).map((lesson, idx) => (
                              <div
                                key={lesson.id}
                                className="flex items-center justify-between px-2 py-1 rounded bg-stone-100 dark:bg-stone-800/60 text-[11px] text-stone-600 dark:text-stone-400"
                              >
                                <span className="truncate max-w-[170px]">
                                  {idx + 1}. {lesson.title}
                                </span>
                              </div>
                            ))}

                            {/* Current post item */}
                            <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg border-2 border-blue-500 bg-blue-50 dark:bg-blue-950/70 text-[11px] font-bold text-blue-700 dark:text-blue-300 shadow-sm animate-pulse-once">
                              <span className="truncate max-w-[130px]">
                                ★ {currentPos + 1}. {title.trim() || "Bài viết này"}
                              </span>
                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  type="button"
                                  disabled={currentPos === 0}
                                  onClick={() => setOrderInChapter(Math.max(1, currentPos))}
                                  title="Dời lên trên một vị trí"
                                  className="p-1 rounded hover:bg-blue-200 dark:hover:bg-blue-900 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                                >
                                  <ArrowUp className="w-3 h-3" />
                                </button>
                                <button
                                  type="button"
                                  disabled={currentPos >= existingLessons.length}
                                  onClick={() => setOrderInChapter(currentPos + 2)}
                                  title="Dời xuống dưới một vị trí"
                                  className="p-1 rounded hover:bg-blue-200 dark:hover:bg-blue-900 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                                >
                                  <ArrowDown className="w-3 h-3" />
                                </button>
                              </div>
                            </div>

                            {/* Items after current */}
                            {existingLessons.slice(currentPos).map((lesson, idx) => (
                              <div
                                key={lesson.id}
                                className="flex items-center justify-between px-2 py-1 rounded bg-stone-100 dark:bg-stone-800/60 text-[11px] text-stone-600 dark:text-stone-400"
                              >
                                <span className="truncate max-w-[170px]">
                                  {currentPos + 2 + idx}. {lesson.title}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>

            {/* Slug URL */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-stone-700 dark:text-stone-300">
                  Đường dẫn tĩnh (Slug URL)
                </label>
                <button
                  type="button"
                  onClick={() => {
                    const next = !isSlugSynced;
                    setIsSlugSynced(next);
                    if (next && title) {
                      setSlug(slugify(title));
                    }
                  }}
                  className={`text-[11px] flex items-center gap-1 font-medium px-2 py-0.5 rounded-md border transition-colors ${
                    isSlugSynced
                      ? "text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-900/60 bg-blue-50/50 dark:bg-blue-950/30"
                      : "text-stone-500 dark:text-stone-400 border-stone-200 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800"
                  }`}
                  title={
                    isSlugSynced
                      ? "Đang tự động đổi slug khi sửa tiêu đề (Nhấn để gỡ liên kết và sửa tự do)"
                      : "Đang tùy chỉnh tự do (Nhấn để tự động tạo lại theo tiêu đề bài viết)"
                  }
                >
                  {isSlugSynced ? <LinkIcon className="w-3 h-3" /> : <Unlink className="w-3 h-3" />}
                  <span>{isSlugSynced ? "Tự động đổi theo tiêu đề" : "Tùy chỉnh tự do"}</span>
                </button>
              </div>
              <input
                type="text"
                value={slug}
                onChange={(e) => {
                  setSlug(e.target.value);
                  setIsSlugSynced(false);
                }}
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

              {/* Course Category Auto-Inheritance indicator */}
              {selectedSeries?.category && categoryId === selectedSeries.category_id && (
                <p className="text-[11px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1 pt-0.5 font-medium">
                  <CheckCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>Tự động chọn theo khóa học: <strong>{selectedSeries.category.name}</strong></span>
                </p>
              )}

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
