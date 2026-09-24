"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  GraduationCap,
  BookOpen,
  Play,
  CheckCircle2,
  ChevronRight,
  Users,
  Send,
  X,
  ShieldCheck,
  Plus,
  Edit3,
  Trash2,
  FilePlus,
  Loader2,
  Clock,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import {
  getCollaborators,
  getFullImageUrl,
  requestCollaboration,
  addChapter,
  updateChapter,
  deleteChapter,
  fetchSeriesBySlug,
} from "@/lib/api";
import { Chapter, SeriesDetail } from "@/lib/types";
import { useAuth } from "@/lib/auth-context";
import { buildChapterTree, flattenChapterTree } from "@/lib/tree-utils";

import { Breadcrumbs } from "@/components/common/Breadcrumbs";
import { useLoading } from "@/lib/loading-context";
import { SeriesCollaboratorsManager } from "@/components/series/SeriesCollaboratorsManager";
import { LoadingOverlay } from "@/components/common/LoadingOverlay";

interface SeriesDetailClientProps {
  initialSeries: SeriesDetail;
}

export const SeriesDetailClient: React.FC<SeriesDetailClientProps> = ({ initialSeries }) => {
  const router = useRouter();
  const { user, token } = useAuth();
  const { withLoading } = useLoading();

  const [series, setSeries] = useState<SeriesDetail>(initialSeries);
  const [outlineActionLoading, setOutlineActionLoading] = useState<string | null>(null);
  useEffect(() => {
    setSeries(initialSeries);
  }, [initialSeries]);

  const hierarchyLevels: string[] = React.useMemo(() => {
    try {
      if (series.hierarchy_config) {
        const parsed = JSON.parse(series.hierarchy_config);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return ["Chương"];
  }, [series.hierarchy_config]);

  const [activeTab, setActiveTab] = useState<"content" | "info">("content");
  const [isEnrolled, setIsEnrolled] = useState(false);

  // Collaborator state
  const [isAlreadyCollaborator, setIsAlreadyCollaborator] = useState(false);
  const [isPendingCollaborator, setIsPendingCollaborator] = useState(false);
  const [pendingCollabCount, setPendingCollabCount] = useState(0);
  const [showManageCollabModal, setShowManageCollabModal] = useState(false);

  // Request Collab modal state
  const [showCollabModal, setShowCollabModal] = useState(false);
  const [collabMessage, setCollabMessage] = useState("");
  const [collabSubmitting, setCollabSubmitting] = useState(false);
  const [collabSuccess, setCollabSuccess] = useState(false);
  const [collabError, setCollabError] = useState("");

  const isAuthor = Boolean(user && series.author?.id && user.id === series.author.id);
  const isAdmin = Boolean(user && (user.is_admin || user.role === "admin"));
  const canManageCollab = isAuthor || isAdmin;
  const canEditOutline = isAuthor || isAdmin || isAlreadyCollaborator;
  const showCollabButton = !canManageCollab && !isAlreadyCollaborator && !isPendingCollaborator;

  // Chapter outline management state
  const [showCreateChapterModal, setShowCreateChapterModal] = useState(false);
  const [createChapterLevel, setCreateChapterLevel] = useState<number>(1);
  const [parentChapter, setParentChapter] = useState<Chapter | null>(null);
  const [chapterTitleInput, setChapterTitleInput] = useState("");
  const [chapterDescInput, setChapterDescInput] = useState("");
  const [createChapterOrder, setCreateChapterOrder] = useState<number>(1);
  const [createSiblingChapters, setCreateSiblingChapters] = useState<Chapter[]>([]);
  const [isCreatingChapter, setIsCreatingChapter] = useState(false);
  const [createChapterError, setCreateChapterError] = useState("");

  const [showEditChapterModal, setShowEditChapterModal] = useState(false);
  const [editingChapterId, setEditingChapterId] = useState<string | null>(null);
  const [editChapterTitle, setEditChapterTitle] = useState("");
  const [editChapterDesc, setEditChapterDesc] = useState("");
  const [editChapterOrder, setEditChapterOrder] = useState<number>(1);
  const [editSiblingChapters, setEditSiblingChapters] = useState<Chapter[]>([]);
  const [isUpdatingChapter, setIsUpdatingChapter] = useState(false);
  const [editChapterError, setEditChapterError] = useState("");

  // Check if current user is already a collaborator and get pending count
  useEffect(() => {
    if (!user || !token) return;
    getCollaborators(series.id, token)
      .then((collabs) => {
        setIsAlreadyCollaborator(collabs.some((c) => c.user_id === user.id && c.status === "accepted"));
        setIsPendingCollaborator(collabs.some((c) => c.user_id === user.id && c.status === "pending"));
        const pending = collabs.filter((c) => c.status === "pending").length;
        setPendingCollabCount(pending);
      })
      .catch(() => {
        // ignore – non-critical
      });
  }, [user, token, series.id]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get("tab");
      if ((tab === "collaborators" || tab === "collab") && canManageCollab) {
        setShowManageCollabModal(true);
      }
    }
  }, [canManageCollab]);

  const handleCollabSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) {
      alert("Vui lòng đăng nhập để gửi yêu cầu cộng tác!");
      return;
    }
    setCollabSubmitting(true);
    setCollabError("");
    await withLoading(async () => {
      try {
        await requestCollaboration(series.id, collabMessage.trim() || undefined, token);
        setCollabSuccess(true);
        setTimeout(() => {
          setShowCollabModal(false);
          setCollabSuccess(false);
          setCollabMessage("");
        }, 2500);
      } catch (err: unknown) {
        setCollabError(err instanceof Error ? err.message : "Gửi yêu cầu thất bại");
      } finally {
        setCollabSubmitting(false);
      }
    }, "Đang gửi yêu cầu cộng tác...");
  };

  const handleOpenCreateChapter = (level: number, parent?: Chapter) => {
    setCreateChapterLevel(level);
    setParentChapter(parent || null);
    setChapterTitleInput("");
    setChapterDescInput("");
    setCreateChapterError("");

    // Siblings in the same parent level
    const siblings = (series.chapters || [])
      .filter((c) => (parent ? c.parent_id === parent.id : (!c.parent_id || c.level === 1)))
      .sort((a, b) => a.order - b.order);
    setCreateSiblingChapters(siblings);
    setCreateChapterOrder(siblings.length + 1);

    setShowCreateChapterModal(true);
  };

  const handleCreateChapterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !chapterTitleInput.trim()) return;
    setIsCreatingChapter(true);
    setCreateChapterError("");
    setOutlineActionLoading("Đang tạo mục mới...");

    try {
      await addChapter(
        series.id,
        {
          title: chapterTitleInput.trim(),
          description: chapterDescInput.trim() || undefined,
          parent_id: parentChapter?.id || undefined,
          level: createChapterLevel,
          order: createChapterOrder,
        },
        token
      );
      setShowCreateChapterModal(false);
      const refreshed = await fetchSeriesBySlug(series.slug);
      setSeries(refreshed);
    } catch (err: unknown) {
      setCreateChapterError(err instanceof Error ? err.message : "Tạo thất bại");
    } finally {
      setIsCreatingChapter(false);
      setOutlineActionLoading(null);
    }
  };

  const handleOpenEditChapter = (ch: Chapter) => {
    setEditingChapterId(ch.id);
    setEditChapterTitle(ch.title);
    setEditChapterDesc(ch.description || "");
    setEditChapterError("");

    // Siblings excluding this chapter
    const siblings = (series.chapters || [])
      .filter((c) => (ch.parent_id ? c.parent_id === ch.parent_id : (!c.parent_id || c.level === 1)) && c.id !== ch.id)
      .sort((a, b) => a.order - b.order);
    setEditSiblingChapters(siblings);
    setEditChapterOrder(ch.order || 1);

    setShowEditChapterModal(true);
  };

  const handleEditChapterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !editingChapterId || !editChapterTitle.trim()) return;
    setIsUpdatingChapter(true);
    setEditChapterError("");
    setOutlineActionLoading("Đang cập nhật mục...");

    try {
      await updateChapter(
        editingChapterId,
        {
          title: editChapterTitle.trim(),
          description: editChapterDesc.trim() || undefined,
          order: editChapterOrder,
        },
        token
      );
      setShowEditChapterModal(false);
      const refreshed = await fetchSeriesBySlug(series.slug);
      setSeries(refreshed);
    } catch (err: unknown) {
      setEditChapterError(err instanceof Error ? err.message : "Cập nhật thất bại");
    } finally {
      setIsUpdatingChapter(false);
      setOutlineActionLoading(null);
    }
  };

  const handleDeleteChapter = async (chapterId: string, title: string) => {
    if (!token) return;
    if (!window.confirm(`Bạn có chắc chắn muốn xóa mục "${title}"?`)) return;

    setOutlineActionLoading("Đang xóa mục...");
    try {
      await deleteChapter(chapterId, token);
      const refreshed = await fetchSeriesBySlug(series.slug);
      setSeries(refreshed);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Xóa thất bại");
    } finally {
      setOutlineActionLoading(null);
    }
  };

  // Find first lesson for the "Start Course" button
  const firstLesson =
    series.chapters.length > 0 &&
    series.chapters[0].lessons &&
    series.chapters[0].lessons.length > 0
      ? series.chapters[0].lessons[0]
      : null;

  return (
    <div className="w-full space-y-6 pb-20">
      <Breadcrumbs
        items={[
          { label: "Series", href: "/series" },
          { label: series.title },
        ]}
      />

      {/* Back button */}
      <div>
        <button
          onClick={() => router.back()}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-stone-500 hover:text-stone-900 dark:text-stone-400 dark:hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Quay lại</span>
        </button>
      </div>

      {/* Course Hero Banner */}
      <section className="relative rounded-3xl p-8 sm:p-10 border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900/60 overflow-hidden shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
          <div className="md:col-span-8 space-y-4">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              {series.category && (
                <span className="px-3 py-1 rounded-full font-semibold bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 border border-blue-200/50">
                  {series.category.name}
                </span>
              )}
              <span className="text-stone-500 font-medium">
                {series.total_chapters} chương • {series.total_lessons} bài học
              </span>
            </div>

            <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-stone-900 dark:text-white leading-[1.2]">
              {series.title}
            </h1>

            {series.summary && (
              <p className="text-sm sm:text-base text-stone-600 dark:text-stone-400 leading-relaxed">
                {series.summary}
              </p>
            )}

            <div className="pt-2 flex flex-wrap items-center gap-3">
              {firstLesson && (
                <Link
                  href={`/posts/${firstLesson.slug}`}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-md shadow-blue-500/20 transition-all hover:scale-[1.02]"
                >
                  <Play className="w-4 h-4 fill-white" />
                  <span>Bắt đầu học (Bài 1: {firstLesson.title})</span>
                </Link>
              )}
              {canManageCollab && (
                <button
                  onClick={() => setShowManageCollabModal(true)}
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 dark:hover:bg-amber-900/50 text-amber-800 dark:text-amber-200 font-semibold text-sm transition-all border border-amber-300 dark:border-amber-800 hover:scale-[1.02] shadow-xs"
                >
                  <Users className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  <span>Quản lý Cộng tác viên</span>
                  {pendingCollabCount > 0 && (
                    <span className="px-1.5 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-500 text-white animate-pulse">
                      {pendingCollabCount} chờ duyệt
                    </span>
                  )}
                </button>
              )}
              {isAlreadyCollaborator && (
                <div className="inline-flex items-center gap-2 px-4 py-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-xs font-semibold border border-emerald-300 dark:border-emerald-800 shadow-xs">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>Bạn là Cộng tác viên biên soạn</span>
                </div>
              )}
              {isPendingCollaborator && (
                <div className="inline-flex items-center gap-2 px-4 py-3 rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 text-xs font-semibold border border-amber-300 dark:border-amber-800 shadow-xs">
                  <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  <span>Yêu cầu cộng tác đang chờ tác giả duyệt</span>
                </div>
              )}
              {showCollabButton && (
                <button
                  onClick={() => {
                    if (!user) {
                      alert("Vui lòng đăng nhập để gửi yêu cầu cộng tác!");
                      return;
                    }
                    setShowCollabModal(true);
                  }}
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-200 font-semibold text-sm transition-all border border-stone-200 dark:border-stone-700 hover:scale-[1.02]"
                >
                  <Users className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <span>Xin cộng tác biên soạn</span>
                </button>
              )}
            </div>
          </div>

          {/* Cover image or illustration */}
          <div className="md:col-span-4 flex justify-center">
            {series.cover_image ? (
              <img
                src={getFullImageUrl(series.cover_image)}
                alt={series.title}
                className="w-full max-w-[280px] h-48 object-cover rounded-2xl shadow-md border border-stone-200 dark:border-stone-800"
              />
            ) : (
              <div className="w-full max-w-[280px] h-48 rounded-2xl bg-gradient-to-tr from-blue-700 via-indigo-600 to-sky-500 flex flex-col items-center justify-center text-white shadow-xl p-6 text-center">
                <div className="w-14 h-14 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center mb-2 shadow-inner">
                  <GraduationCap className="w-8 h-8 text-white" />
                </div>
                <span className="text-xs font-bold uppercase tracking-wider text-blue-100">
                  Lộ Trình Khóa Học
                </span>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Attribution & Copyright Banner */}
      {(() => {
        const attribution = series.attribution_text?.trim();
        if (!attribution) return null;

        return (
          <div className="rounded-3xl p-6 border border-amber-200/90 dark:border-amber-900/50 bg-gradient-to-r from-amber-50/80 via-orange-50/40 to-yellow-50/60 dark:from-amber-950/25 dark:via-orange-950/15 dark:to-yellow-950/20 shadow-sm flex flex-col sm:flex-row items-start sm:items-center gap-4 text-xs">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-700 dark:text-amber-400 flex items-center justify-center shrink-0 border border-amber-200/80 dark:border-amber-800">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div className="space-y-1 flex-1">
              <div className="font-bold text-amber-950 dark:text-amber-200 text-xs uppercase tracking-wider flex items-center gap-1.5">
                <span>Bản quyền &amp; Nguồn gốc tài liệu tham khảo</span>
              </div>
              <p className="text-amber-900/85 dark:text-amber-300/85 leading-relaxed text-xs">
                {attribution}
              </p>
            </div>
          </div>
        );
      })()}

      {/* Chapters & Lessons Syllabus */}
      {(() => {
        let levels = ["Chương"];
        try {
          if (series.hierarchy_config) {
            const parsed = JSON.parse(series.hierarchy_config);
            if (Array.isArray(parsed) && parsed.length > 0) levels = parsed;
          }
        } catch (e) {}

        const tree = buildChapterTree(series.chapters || [], levels);
        const flatList = flattenChapterTree(tree);

        return (
          <section className="space-y-6">
            <div className="flex items-center justify-between border-b border-stone-200 dark:border-stone-800 pb-3">
              <div className="flex items-center gap-2 font-bold text-lg text-stone-900 dark:text-white">
                <BookOpen className="w-5 h-5 text-blue-600" />
                <span>
                  Đề Cương Chi Tiết ({tree.length} {levels[0]})
                </span>
              </div>
              {canEditOutline && (
                <button
                  type="button"
                  onClick={() => handleOpenCreateChapter(1, undefined)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Thêm {levels[0]} mới</span>
                </button>
              )}
            </div>

            <div className="relative min-h-[220px]">
              <LoadingOverlay
                isLoading={Boolean(outlineActionLoading)}
                message={outlineActionLoading || "Đang tải đề cương..."}
              />

              {flatList.length === 0 && (
                <div className="text-center py-12 px-4 rounded-3xl border border-dashed border-stone-200 dark:border-stone-800 space-y-3">
                  <p className="text-sm text-stone-500">Series này chưa có nội dung lộ trình nào.</p>
                  {canEditOutline && (
                    <button
                      type="button"
                      onClick={() => handleOpenCreateChapter(1, undefined)}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Tạo {levels[0]} đầu tiên</span>
                    </button>
                  )}
                </div>
              )}

              <div className={`space-y-4 transition-opacity duration-200 ${outlineActionLoading ? "opacity-40 pointer-events-none" : ""}`}>
                {flatList.map((chapter) => {
                const lvl = chapter.level || 1;
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

                return (
                  <div
                    key={chapter.id}
                    style={{ marginLeft: `${indentPx}px` }}
                    className={`rounded-2xl border ${
                      lvl > 1
                        ? `border-l-4 ${borderColors[colorIdx]} ${bgColors[colorIdx]} border-stone-200 dark:border-stone-800`
                        : "border-stone-200/80 dark:border-stone-800 bg-white dark:bg-stone-900/40"
                    } p-5 space-y-3 transition-all`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-1">
                        <div className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider flex items-center gap-2">
                          <span>
                            {lvlName} {chapter.displayNumber}
                          </span>
                          {lvl > 1 && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 font-semibold lowercase">
                              thuộc cấp trên
                            </span>
                          )}
                        </div>
                        <h2 className="text-base font-bold text-stone-900 dark:text-white">
                          {chapter.title}
                        </h2>
                        {chapter.description && (
                          <p className="text-xs text-stone-500 dark:text-stone-400">
                            {chapter.description}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs font-medium text-stone-400">
                          {chapter.lessons?.length || 0} bài học
                        </span>
                        {canEditOutline && (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleOpenEditChapter(chapter)}
                              title="Sửa tên mục"
                              className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            {(!chapter.lessons || chapter.lessons.length === 0) && (!chapter.children || chapter.children.length === 0) && (
                              <button
                                type="button"
                                onClick={() => handleDeleteChapter(chapter.id, chapter.title)}
                                title="Xóa mục trống"
                                className="p-1.5 rounded-lg text-stone-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Author / Collaborator Quick Actions */}
                    {canEditOutline && (
                      <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-stone-100 dark:border-stone-800">
                        <Link
                          href={`/editor/new?series_id=${series.id}&series_slug=${series.slug}&chapter_id=${chapter.id}`}
                          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/50 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 text-xs font-semibold border border-blue-200 dark:border-blue-800/80 transition-colors"
                        >
                          <FilePlus className="w-3.5 h-3.5" />
                          <span>Viết bài vào mục này</span>
                        </Link>

                        {lvl < levels.length && (
                          <button
                            type="button"
                            onClick={() => handleOpenCreateChapter(lvl + 1, chapter)}
                            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 text-xs font-semibold border border-stone-200 dark:border-stone-700 transition-colors"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Thêm {levels[lvl]} con</span>
                          </button>
                        )}
                      </div>
                    )}

                    {/* Lessons in this chapter */}
                    {chapter.lessons && chapter.lessons.length > 0 ? (
                      <div className="grid grid-cols-1 gap-1.5 pt-2 border-t border-stone-100 dark:border-stone-800">
                        {chapter.lessons.map((lesson, lIdx) => (
                          <Link
                            key={lesson.id}
                            href={`/posts/${lesson.slug}`}
                            className="group flex items-center justify-between p-2.5 rounded-xl hover:bg-stone-50 dark:hover:bg-stone-800/60 transition-colors"
                          >
                            <div className="flex items-center gap-2.5">
                              <CheckCircle2 className="w-4 h-4 text-stone-300 dark:text-stone-600 group-hover:text-blue-500 transition-colors shrink-0" />
                              <div>
                                <span className="text-xs text-stone-400 mr-2 font-medium">
                                  {chapter.displayNumber}.{lIdx + 1}
                                </span>
                                <span className="text-xs font-medium text-stone-800 dark:text-stone-200 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                                  {lesson.title}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {lesson.reading_time_minutes > 0 && (
                                <span className="text-[11px] text-stone-400 hidden sm:inline">
                                  {lesson.reading_time_minutes} phút
                                </span>
                              )}
                              <ChevronRight className="w-4 h-4 text-stone-400 group-hover:translate-x-0.5 transition-transform" />
                            </div>
                          </Link>
                        ))}
                      </div>
                    ) : null}
                  </div>
                );
              })}
              </div>
            </div>
          </section>
        );
      })()}

      {/* Collaboration Request Modal */}
      {showCollabModal && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setShowCollabModal(false)}
        >
          <div
            className="bg-white dark:bg-stone-900 rounded-3xl border border-stone-200 dark:border-stone-800 p-6 sm:p-8 w-full max-w-lg shadow-2xl space-y-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-stone-900 dark:text-white">
                    Xin cộng tác biên soạn
                  </h3>
                  <p className="text-xs text-stone-500">
                    Khoá học: {series.title}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowCollabModal(false)}
                className="p-2 rounded-xl text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {collabSuccess ? (
              <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-center space-y-2">
                <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                  🎉 Yêu cầu đã được gửi thành công!
                </p>
                <p className="text-xs text-emerald-600/80">
                  Tác giả sở hữu khoá học sẽ nhận được thông báo để phê duyệt quyền biên soạn cho bạn.
                </p>
              </div>
            ) : (
              <form onSubmit={handleCollabSubmit} className="space-y-4">
                <p className="text-xs text-stone-600 dark:text-stone-400 leading-relaxed">
                  Khi được tác giả chấp thuận, bạn sẽ có quyền đồng biên soạn, thêm bài viết mới và sắp xếp lộ trình trong khoá học này.
                </p>

                {collabError && (
                  <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-600 font-medium">
                    {collabError}
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-stone-700 dark:text-stone-300">
                    Lời nhắn gửi tác giả (tuỳ chọn)
                  </label>
                  <textarea
                    rows={4}
                    value={collabMessage}
                    onChange={(e) => setCollabMessage(e.target.value)}
                    placeholder="Giới thiệu bản thân, chủ đề bạn dự định đóng góp hoặc kinh nghiệm liên quan..."
                    className="w-full text-sm p-3.5 rounded-2xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800/50 text-stone-900 dark:text-white placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all resize-none"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowCollabModal(false)}
                    className="px-4 py-2.5 rounded-xl border border-stone-200 dark:border-stone-700 text-xs font-semibold text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
                  >
                    Hủy bỏ
                  </button>
                  <button
                    type="submit"
                    disabled={collabSubmitting}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-md shadow-blue-500/20 disabled:opacity-50 transition-all"
                  >
                    {collabSubmitting ? (
                      <span>Đang gửi...</span>
                    ) : (
                      <>
                        <Send className="w-3.5 h-3.5" />
                        <span>Gửi yêu cầu</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Modal Quản Lý Cộng Tác Viên (Dành cho Tác giả & Admin) */}
      {showManageCollabModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-stone-900 rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-stone-200 dark:border-stone-800 max-h-[90vh] overflow-y-auto">
            <SeriesCollaboratorsManager
              seriesId={series.id}
              seriesTitle={series.title}
              token={token || ""}
              onCountChange={(pending) => setPendingCollabCount(pending)}
              onClose={() => setShowManageCollabModal(false)}
            />
          </div>
        </div>
      )}

      {/* Modal Thêm Chương / Module Mới */}
      {showCreateChapterModal && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in"
          onClick={() => !isCreatingChapter && setShowCreateChapterModal(false)}
        >
          <div
            className="bg-white dark:bg-stone-900 rounded-3xl border border-stone-200 dark:border-stone-800 p-6 sm:p-8 w-full max-w-lg shadow-2xl space-y-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-stone-100 dark:border-stone-800 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
                  <Plus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-stone-900 dark:text-white">
                    Thêm mục mới
                  </h3>
                  <p className="text-xs text-stone-500">
                    Cấp {createChapterLevel}
                    {parentChapter ? ` • Thuộc: ${parentChapter.title}` : ""}
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={isCreatingChapter}
                onClick={() => setShowCreateChapterModal(false)}
                className="p-2 rounded-xl text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {createChapterError && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-600 font-medium">
                {createChapterError}
              </div>
            )}

            <form onSubmit={handleCreateChapterSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-stone-700 dark:text-stone-300">
                  Tên mục <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={chapterTitleInput}
                  onChange={(e) => setChapterTitleInput(e.target.value)}
                  placeholder="Ví dụ: Giới thiệu & Cài đặt"
                  className="w-full text-sm p-3 rounded-2xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800/50 text-stone-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Bộ chọn Vị trí & Thứ tự hiển thị */}
              {(() => {
                const createLvlName = hierarchyLevels[createChapterLevel - 1] || "mục";
                const createPos = Math.max(0, Math.min(createChapterOrder - 1, createSiblingChapters.length));

                return (
                  <div className="space-y-2 p-3.5 rounded-2xl bg-stone-50 dark:bg-stone-800/40 border border-stone-200 dark:border-stone-700/60">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-stone-700 dark:text-stone-300">
                        Vị trí đặt {createLvlName} {parentChapter ? `trong "${parentChapter.title}"` : "trong khóa học"}
                      </label>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 font-bold">
                        Vị trí số: {createChapterOrder}
                      </span>
                    </div>

                    <select
                      value={
                        createPos === createSiblingChapters.length
                          ? "end"
                          : createPos === 0
                          ? "start"
                          : `before:${createPos}`
                      }
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === "end") {
                          setCreateChapterOrder(createSiblingChapters.length + 1);
                        } else if (val === "start") {
                          setCreateChapterOrder(1);
                        } else if (val.startsWith("before:")) {
                          const idx = parseInt(val.split(":")[1]);
                          setCreateChapterOrder(idx + 1);
                        } else if (val.startsWith("after:")) {
                          const idx = parseInt(val.split(":")[1]);
                          setCreateChapterOrder(idx + 2);
                        }
                      }}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 font-medium text-stone-900 dark:text-stone-100"
                    >
                      <option value="end">
                        📌 Ở cuối cùng (Mặc định - Vị trí {createSiblingChapters.length + 1})
                      </option>
                      <option value="start">📌 Ở đầu tiên (Vị trí 1)</option>
                      {createSiblingChapters.map((s, idx) => (
                        <React.Fragment key={s.id}>
                          <option value={`before:${idx}`}>
                            ⬆️ Trước: &ldquo;{s.title.slice(0, 32)}{s.title.length > 32 ? "..." : ""}&rdquo; (Vị trí {idx + 1})
                          </option>
                          <option value={`after:${idx}`}>
                            ⬇️ Sau: &ldquo;{s.title.slice(0, 32)}{s.title.length > 32 ? "..." : ""}&rdquo; (Vị trí {idx + 2})
                          </option>
                        </React.Fragment>
                      ))}
                    </select>

                    <div className="space-y-1.5 pt-1">
                      <div className="flex items-center justify-between text-[10px] text-stone-500 font-medium uppercase tracking-wider">
                        <span>Sơ đồ sắp xếp</span>
                        <span>{createSiblingChapters.length + 1} {createLvlName}</span>
                      </div>

                      <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
                        {createSiblingChapters.slice(0, createPos).map((item, idx) => (
                          <div
                            key={item.id}
                            className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-stone-100 dark:bg-stone-800/60 text-[11px] text-stone-600 dark:text-stone-400"
                          >
                            <span className="truncate max-w-[280px]">
                              {idx + 1}. {item.title}
                            </span>
                          </div>
                        ))}

                        <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg border-2 border-blue-500 bg-blue-50 dark:bg-blue-950/70 text-[11px] font-bold text-blue-700 dark:text-blue-300 shadow-sm">
                          <span className="truncate max-w-[220px]">
                            ★ {createPos + 1}. {chapterTitleInput.trim() || `[${createLvlName} mới này]`}
                          </span>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              disabled={createPos === 0}
                              onClick={() => setCreateChapterOrder(Math.max(1, createPos))}
                              title="Đẩy lên trước một vị trí"
                              className="p-1 rounded hover:bg-blue-200 dark:hover:bg-blue-900 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                            >
                              <ArrowUp className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              disabled={createPos >= createSiblingChapters.length}
                              onClick={() => setCreateChapterOrder(createPos + 2)}
                              title="Đẩy xuống sau một vị trí"
                              className="p-1 rounded hover:bg-blue-200 dark:hover:bg-blue-900 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                            >
                              <ArrowDown className="w-3 h-3" />
                            </button>
                          </div>
                        </div>

                        {createSiblingChapters.slice(createPos).map((item, idx) => (
                          <div
                            key={item.id}
                            className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-stone-100 dark:bg-stone-800/60 text-[11px] text-stone-600 dark:text-stone-400"
                          >
                            <span className="truncate max-w-[280px]">
                              {createPos + idx + 2}. {item.title}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })()}

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-stone-700 dark:text-stone-300">
                  Mô tả ngắn (tùy chọn)
                </label>
                <textarea
                  rows={3}
                  value={chapterDescInput}
                  onChange={(e) => setChapterDescInput(e.target.value)}
                  placeholder="Mô tả mục tiêu của phần này..."
                  className="w-full text-sm p-3 rounded-2xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800/50 text-stone-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  disabled={isCreatingChapter}
                  onClick={() => setShowCreateChapterModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-stone-200 dark:border-stone-700 text-xs font-semibold text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={isCreatingChapter || !chapterTitleInput.trim()}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-md shadow-blue-500/20 disabled:opacity-50 transition-all"
                >
                  {isCreatingChapter ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Đang tạo...</span>
                    </>
                  ) : (
                    <span>Tạo mục</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Chỉnh Sửa Tên Mục */}
      {showEditChapterModal && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in"
          onClick={() => !isUpdatingChapter && setShowEditChapterModal(false)}
        >
          <div
            className="bg-white dark:bg-stone-900 rounded-3xl border border-stone-200 dark:border-stone-800 p-6 sm:p-8 w-full max-w-lg shadow-2xl space-y-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-stone-100 dark:border-stone-800 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
                  <Edit3 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-stone-900 dark:text-white">
                    Chỉnh sửa mục
                  </h3>
                  <p className="text-xs text-stone-500">
                    Cập nhật tên, vị trí và mô tả mục
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={isUpdatingChapter}
                onClick={() => setShowEditChapterModal(false)}
                className="p-2 rounded-xl text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {editChapterError && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-600 font-medium">
                {editChapterError}
              </div>
            )}

            <form onSubmit={handleEditChapterSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-stone-700 dark:text-stone-300">
                  Tên mục <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={editChapterTitle}
                  onChange={(e) => setEditChapterTitle(e.target.value)}
                  className="w-full text-sm p-3 rounded-2xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800/50 text-stone-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Bộ chọn Vị trí thứ tự khi sửa */}
              {(() => {
                const editingCh = series.chapters?.find((c) => c.id === editingChapterId);
                const editLvlName = editingCh ? hierarchyLevels[(editingCh.level || 1) - 1] || "mục" : "mục";
                const editPos = Math.max(0, Math.min(editChapterOrder - 1, editSiblingChapters.length));

                if (editSiblingChapters.length === 0) return null;

                return (
                  <div className="space-y-2 p-3.5 rounded-2xl bg-stone-50 dark:bg-stone-800/40 border border-stone-200 dark:border-stone-700/60">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-stone-700 dark:text-stone-300">
                        Vị trí thứ tự của {editLvlName}
                      </label>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 font-bold">
                        Vị trí số: {editChapterOrder}
                      </span>
                    </div>

                    <select
                      value={
                        editPos === editSiblingChapters.length
                          ? "end"
                          : editPos === 0
                          ? "start"
                          : `before:${editPos}`
                      }
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === "end") {
                          setEditChapterOrder(editSiblingChapters.length + 1);
                        } else if (val === "start") {
                          setEditChapterOrder(1);
                        } else if (val.startsWith("before:")) {
                          const idx = parseInt(val.split(":")[1]);
                          setEditChapterOrder(idx + 1);
                        } else if (val.startsWith("after:")) {
                          const idx = parseInt(val.split(":")[1]);
                          setEditChapterOrder(idx + 2);
                        }
                      }}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 font-medium text-stone-900 dark:text-stone-100"
                    >
                      <option value="end">
                        📌 Ở cuối cùng (Vị trí {editSiblingChapters.length + 1})
                      </option>
                      <option value="start">📌 Ở đầu tiên (Vị trí 1)</option>
                      {editSiblingChapters.map((s, idx) => (
                        <React.Fragment key={s.id}>
                          <option value={`before:${idx}`}>
                            ⬆️ Trước: &ldquo;{s.title.slice(0, 32)}{s.title.length > 32 ? "..." : ""}&rdquo; (Vị trí {idx + 1})
                          </option>
                          <option value={`after:${idx}`}>
                            ⬇️ Sau: &ldquo;{s.title.slice(0, 32)}{s.title.length > 32 ? "..." : ""}&rdquo; (Vị trí {idx + 2})
                          </option>
                        </React.Fragment>
                      ))}
                    </select>

                    <div className="space-y-1.5 pt-1">
                      <div className="flex items-center justify-between text-[10px] text-stone-500 font-medium uppercase tracking-wider">
                        <span>Sơ đồ sắp xếp</span>
                        <span>{editSiblingChapters.length + 1} {editLvlName}</span>
                      </div>

                      <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
                        {editSiblingChapters.slice(0, editPos).map((item, idx) => (
                          <div
                            key={item.id}
                            className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-stone-100 dark:bg-stone-800/60 text-[11px] text-stone-600 dark:text-stone-400"
                          >
                            <span className="truncate max-w-[280px]">
                              {idx + 1}. {item.title}
                            </span>
                          </div>
                        ))}

                        <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg border-2 border-amber-500 bg-amber-50 dark:bg-amber-950/70 text-[11px] font-bold text-amber-800 dark:text-amber-200 shadow-sm">
                          <span className="truncate max-w-[220px]">
                            ★ {editPos + 1}. {editChapterTitle.trim() || "[Mục này]"}
                          </span>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              disabled={editPos === 0}
                              onClick={() => setEditChapterOrder(Math.max(1, editPos))}
                              title="Đẩy lên trước một vị trí"
                              className="p-1 rounded hover:bg-amber-200 dark:hover:bg-amber-900 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                            >
                              <ArrowUp className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              disabled={editPos >= editSiblingChapters.length}
                              onClick={() => setEditChapterOrder(editPos + 2)}
                              title="Đẩy xuống sau một vị trí"
                              className="p-1 rounded hover:bg-amber-200 dark:hover:bg-amber-900 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                            >
                              <ArrowDown className="w-3 h-3" />
                            </button>
                          </div>
                        </div>

                        {editSiblingChapters.slice(editPos).map((item, idx) => (
                          <div
                            key={item.id}
                            className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-stone-100 dark:bg-stone-800/60 text-[11px] text-stone-600 dark:text-stone-400"
                          >
                            <span className="truncate max-w-[280px]">
                              {editPos + idx + 2}. {item.title}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })()}

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-stone-700 dark:text-stone-300">
                  Mô tả ngắn (tùy chọn)
                </label>
                <textarea
                  rows={3}
                  value={editChapterDesc}
                  onChange={(e) => setEditChapterDesc(e.target.value)}
                  className="w-full text-sm p-3 rounded-2xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800/50 text-stone-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  disabled={isUpdatingChapter}
                  onClick={() => setShowEditChapterModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-stone-200 dark:border-stone-700 text-xs font-semibold text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={isUpdatingChapter || !editChapterTitle.trim()}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-md shadow-blue-500/20 disabled:opacity-50 transition-all"
                >
                  {isUpdatingChapter ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Đang lưu...</span>
                    </>
                  ) : (
                    <span>Lưu thay đổi</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

