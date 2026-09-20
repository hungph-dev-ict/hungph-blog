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
} from "lucide-react";
import { getCollaborators, getFullImageUrl, requestCollaboration } from "@/lib/api";
import { SeriesDetail } from "@/lib/types";
import { useAuth } from "@/lib/auth-context";
import { buildChapterTree, flattenChapterTree } from "@/lib/tree-utils";

import { Breadcrumbs } from "@/components/common/Breadcrumbs";
import { useLoading } from "@/lib/loading-context";
import { SeriesCollaboratorsManager } from "@/components/series/SeriesCollaboratorsManager";

interface SeriesDetailClientProps {
  initialSeries: SeriesDetail;
}

export const SeriesDetailClient: React.FC<SeriesDetailClientProps> = ({ initialSeries: series }) => {
  const router = useRouter();
  const { user, token } = useAuth();
  const { withLoading } = useLoading();
  const [showCollabModal, setShowCollabModal] = useState(false);
  const [showManageCollabModal, setShowManageCollabModal] = useState(false);
  const [pendingCollabCount, setPendingCollabCount] = useState(0);
  const [collabMessage, setCollabMessage] = useState("");
  const [collabSubmitting, setCollabSubmitting] = useState(false);
  const [collabSuccess, setCollabSuccess] = useState(false);
  const [collabError, setCollabError] = useState("");
  const [isAlreadyCollaborator, setIsAlreadyCollaborator] = useState(false);

  const isAuthor = Boolean(user && series.author?.id && user.id === series.author.id);
  const isAdmin = Boolean(user && (user.is_admin || user.role === "admin"));
  const canManageCollab = isAuthor || isAdmin;
  const showCollabButton = !canManageCollab && !isAlreadyCollaborator;

  // Check if current user is already a collaborator and get pending count
  useEffect(() => {
    if (!user || !token) return;
    getCollaborators(series.id, token)
      .then((collabs) => {
        setIsAlreadyCollaborator(collabs.some((c) => c.user_id === user.id && c.status === "accepted"));
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
          { label: "Khóa học & Series", href: "/series" },
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
            </div>

            <div className="space-y-4">
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
                      <span className="text-xs font-medium text-stone-400 shrink-0">
                        {chapter.lessons?.length || 0} bài học
                      </span>
                    </div>

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
    </div>
  );
};

