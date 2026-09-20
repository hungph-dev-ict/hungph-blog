"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Calendar,
  Clock,
  Eye,
  Share2,
  Check,
  Tag as TagIcon,
  GraduationCap,
  Layers,
  ChevronLeft,
  ChevronRight,
  BookOpen,
  Heart,
  Flag,
  X,
  ShieldCheck,
} from "lucide-react";
import { getFullImageUrl, getLikeStatus, toggleLike, reportPost } from "@/lib/api";
import { PostDetail, REPORT_REASONS } from "@/lib/types";
import { TableOfContents } from "@/components/blog/TableOfContents";
import { ReadingProgressBar } from "@/components/blog/ReadingProgressBar";
import { CommentSection } from "@/components/blog/CommentSection";
import { useAuth } from "@/lib/auth-context";

import { Breadcrumbs } from "@/components/common/Breadcrumbs";
import { useLoading } from "@/lib/loading-context";
import { buildChapterTree, ChapterNode } from "@/lib/tree-utils";

interface PostDetailClientProps {
  initialPost: PostDetail;
}

export const PostDetailClient: React.FC<PostDetailClientProps> = ({ initialPost: post }) => {
  const router = useRouter();
  const { user, token } = useAuth();
  const { withLoading } = useLoading();
  const [copied, setCopied] = useState<boolean>(false);
  const [liked, setLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(0);
  const [likeLoading, setLikeLoading] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [reportDesc, setReportDesc] = useState("");
  const [reportLoading, setReportLoading] = useState(false);
  const [reportDone, setReportDone] = useState(false);

  const levels = React.useMemo(() => {
    try {
      if (post.series_outline?.hierarchy_config) {
        const parsed = JSON.parse(post.series_outline.hierarchy_config);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return ["Chương"];
  }, [post.series_outline?.hierarchy_config]);

  const chapterTree = React.useMemo(() => {
    if (!post.series_outline?.chapters) return [];
    return buildChapterTree(post.series_outline.chapters, levels);
  }, [post.series_outline?.chapters, levels]);

  useEffect(() => {
    getLikeStatus(post.id, token || undefined)
      .then((s) => {
        setLiked(s.liked);
        if (s.likes_count !== undefined) {
          setLikesCount(s.likes_count);
        }
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [post.id, token]);

  const handleLike = async () => {
    if (!user || !token) { alert("Vui lòng đăng nhập để thả tim"); return; }
    if (likeLoading) return;
    setLikeLoading(true);
    try {
      const result = await toggleLike(post.id, token);
      setLiked(result.liked);
      setLikesCount(result.likes_count);
    } finally {
      setLikeLoading(false);
    }
  };

  const handleReport = async () => {
    if (!user || !token) { alert("Vui lòng đăng nhập để tố cáo"); return; }
    if (!reportReason) { alert("Vui lòng chọn lý do"); return; }
    setReportLoading(true);
    await withLoading(async () => {
      try {
        await reportPost(post.id, reportReason, reportDesc || undefined, token);
        setReportDone(true);
        setTimeout(() => { setShowReport(false); setReportDone(false); setReportReason(""); setReportDesc(""); }, 2000);
      } catch (e: unknown) {
        alert(e instanceof Error ? e.message : "Lỗi không xác định");
      } finally {
        setReportLoading(false);
      }
    }, "Đang gửi báo cáo bài viết...");
  };

  const copyShareLink = () => {
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const formattedDate = post.published_at
    ? new Date(post.published_at).toLocaleDateString("vi-VN", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "Bản nháp";

  return (
    <>
      <ReadingProgressBar />

      <div className="w-full pb-16">
        {/* Breadcrumbs Navigation */}
        <Breadcrumbs
          items={[
            ...(post.series_outline
              ? [
                  { label: "Khóa học", href: "/series" },
                  { label: post.series_outline.title, href: `/series/${post.series_outline.slug}` },
                ]
              : post.category
              ? [{ label: post.category.name, href: `/?category=${post.category.slug}` }]
              : []),
            { label: post.title },
          ]}
        />

        <div className="mb-6 flex items-center justify-between">
          <button
            onClick={() => {
              if (window.history.length > 1) {
                router.back();
              } else if (post.series_outline?.slug) {
                router.push(`/series/${post.series_outline.slug}`);
              } else {
                router.push("/");
              }
            }}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-stone-500 hover:text-stone-900 dark:text-stone-400 dark:hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Quay lại</span>
          </button>

          {post.series_outline && (
            <Link
              href={`/series/${post.series_outline.slug}`}
              className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 border border-blue-200/60 dark:border-blue-800/60 hover:bg-blue-100 transition-colors"
            >
              <GraduationCap className="w-3.5 h-3.5" />
              <span>Xem toàn bộ dàn outline khóa học</span>
            </Link>
          )}
        </div>

        {/* Course Banner (nếu bài viết thuộc một Course / Series) */}
        {post.series_outline && (
          <div className="mb-6 p-4 rounded-2xl border border-blue-200/80 dark:border-blue-900/60 bg-blue-50/60 dark:bg-blue-950/30 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                <BookOpen className="w-4 h-4" />
              </div>
              <div>
                <div className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
                  Khóa học / Tuyển tập
                </div>
                <div className="text-sm font-bold text-stone-900 dark:text-white">
                  {post.series_outline.title}
                </div>
              </div>
            </div>
            <Link
              href={`/series/${post.series_outline.slug}`}
              className="text-xs font-semibold text-blue-600 hover:underline hidden sm:block"
            >
              Xem mục lục
            </Link>
          </div>
        )}

        {/* Post Header */}
        <header className="space-y-5 border-b border-stone-200 dark:border-stone-800 pb-8">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {post.category && (
              <span className="px-3 py-1 rounded-full font-semibold bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200/60 dark:border-blue-800/60">
                {post.category.name}
              </span>
            )}
            <span className="flex items-center gap-1 text-stone-400">
              <Calendar className="w-3.5 h-3.5" />
              {formattedDate}
            </span>
            <span className="text-stone-300 dark:text-stone-700">•</span>
            <span className="flex items-center gap-1 text-stone-400">
              <Clock className="w-3.5 h-3.5" />
              {post.reading_time_minutes} phút đọc
            </span>
            <span className="text-stone-300 dark:text-stone-700">•</span>
            <span className="flex items-center gap-1 text-stone-400">
              <Eye className="w-3.5 h-3.5" />
              {post.views_count} lượt xem
            </span>
          </div>

          <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-stone-900 dark:text-white leading-[1.2]">
            {post.title}
          </h1>

          {post.summary && (
            <p className="text-lg text-stone-600 dark:text-stone-300 leading-relaxed italic border-l-2 border-blue-500 pl-4">
              {post.summary}
            </p>
          )}

          {/* Author & Share Bar */}
          <div className="flex items-center justify-between pt-2">
            <Link
              href={post.author?.username ? `/profile/${post.author.username}` : "#"}
              className="flex items-center gap-3 group"
              title="Xem trang cá nhân & theo dõi"
            >
              {post.author?.avatar_url ? (
                <img
                  src={post.author.avatar_url}
                  alt={post.author.username}
                  className="w-10 h-10 rounded-full object-cover shadow group-hover:ring-2 group-hover:ring-blue-500 transition-all"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white font-bold text-sm shadow group-hover:scale-105 transition-transform">
                  {post.author?.full_name?.charAt(0) || post.author?.username?.charAt(0) || "H"}
                </div>
              )}
              <div>
                <div className="text-sm font-semibold text-stone-900 dark:text-stone-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors flex items-center gap-1.5">
                  <span>{post.author?.full_name || post.author?.username || "Hung Pham Hoang"}</span>
                </div>
                <div className="text-xs text-stone-500">Tác giả & Kỹ sư phần mềm • <span className="text-blue-500 font-medium">Xem hồ sơ</span></div>
              </div>
            </Link>

            <button
              onClick={copyShareLink}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-stone-200 dark:border-stone-800 text-xs font-medium text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
              title="Sao chép liên kết"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-500" />
                  <span className="text-emerald-500 font-semibold">Đã chép!</span>
                </>
              ) : (
                <>
                  <Share2 className="w-3.5 h-3.5" />
                  <span>Chia sẻ</span>
                </>
              )}
            </button>

            {/* Like Button */}
            <button
              onClick={handleLike}
              title={liked ? "Bỏ thích" : "Thích bài viết"}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                liked
                  ? "border-rose-300 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400"
                  : "border-stone-200 dark:border-stone-800 text-stone-600 dark:text-stone-300 hover:border-rose-300 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20"
              }`}
            >
              <Heart className={`w-3.5 h-3.5 transition-transform ${liked ? "fill-rose-500 scale-110" : ""}`} />
              <span>{liked ? "Đã thích" : "Thích"}</span>
              {likesCount > 0 && <span className="font-bold">{likesCount}</span>}
            </button>

            {/* Report Button */}
            {user && (
              <button
                onClick={() => setShowReport(true)}
                title="Tố cáo bài viết"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-stone-200 dark:border-stone-800 text-xs font-medium text-stone-400 hover:text-rose-600 hover:border-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-all"
              >
                <Flag className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Tố cáo</span>
              </button>
            )}
          </div>
        </header>

        {/* Report Modal */}
        {showReport && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowReport(false)}>
            <div className="bg-white dark:bg-stone-900 rounded-3xl border border-stone-200 dark:border-stone-800 p-6 w-full max-w-md shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Flag className="w-5 h-5 text-rose-500" />
                  <h3 className="text-lg font-bold text-stone-900 dark:text-white">Tố cáo bài viết</h3>
                </div>
                <button onClick={() => setShowReport(false)} className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {reportDone ? (
                <div className="text-center py-6">
                  <div className="text-4xl mb-2">✅</div>
                  <p className="font-semibold text-stone-900 dark:text-white">Tố cáo đã được gửi!</p>
                  <p className="text-sm text-stone-500 mt-1">Chúng tôi sẽ xem xét sớm nhất có thể.</p>
                </div>
              ) : (
                <>
                  <p className="text-sm text-stone-500 mb-4">Chọn lý do tố cáo bài viết này:</p>

                  <div className="space-y-2 mb-4">
                    {Object.entries(REPORT_REASONS).map(([key, label]) => (
                      <label key={key} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border cursor-pointer transition-all ${
                        reportReason === key
                          ? "border-rose-400 bg-rose-50 dark:bg-rose-950/30"
                          : "border-stone-200 dark:border-stone-700 hover:border-stone-300 dark:hover:border-stone-600"
                      }`}>
                        <input
                          type="radio"
                          name="report_reason"
                          value={key}
                          checked={reportReason === key}
                          onChange={() => setReportReason(key)}
                          className="accent-rose-500"
                        />
                        <span className="text-sm text-stone-800 dark:text-stone-200">{label}</span>
                      </label>
                    ))}
                  </div>

                  <textarea
                    value={reportDesc}
                    onChange={(e) => setReportDesc(e.target.value)}
                    placeholder="Mô tả thêm (tùy chọn)..."
                    rows={3}
                    className="w-full text-sm px-3 py-2.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-800 dark:text-stone-200 focus:outline-none focus:ring-2 focus:ring-rose-400 resize-none mb-4"
                  />

                  <div className="flex gap-3">
                    <button onClick={() => setShowReport(false)} className="flex-1 py-2.5 rounded-xl border border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-400 text-sm font-semibold hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors">
                      Hủy
                    </button>
                    <button onClick={handleReport} disabled={reportLoading || !reportReason} className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold transition-colors disabled:opacity-50">
                      {reportLoading ? "Đang gửi..." : "Gửi tố cáo"}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}


        {/* Cover Image Banner */}
        {post.cover_image && (
          <div className="my-8 rounded-3xl overflow-hidden shadow-lg border border-stone-200 dark:border-stone-800 max-h-[500px]">
            <img
              src={getFullImageUrl(post.cover_image)}
              alt={post.title}
              className="w-full h-full object-cover"
            />
          </div>
        )}

        {/* Main Content Layout with Sidebar */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mt-8">
          <article className="lg:col-span-8 min-w-0">
            <div
              className="blog-content leading-relaxed"
              dangerouslySetInnerHTML={{ __html: post.content_html }}
            />

            {/* Course Attribution & Copyright Notice */}
            {Boolean(post.series_outline?.attribution_text?.trim()) && (
              <div className="mt-8 p-4 sm:p-5 rounded-2xl border border-amber-200/90 dark:border-amber-900/50 bg-gradient-to-r from-amber-50/70 to-orange-50/40 dark:from-amber-950/20 dark:to-orange-950/10 flex items-start gap-3.5 text-xs shadow-sm">
                <div className="p-2 rounded-xl bg-amber-500/10 text-amber-700 dark:text-amber-400 shrink-0 border border-amber-200 dark:border-amber-800/80">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div className="space-y-1 flex-1">
                  <div className="font-bold text-amber-950 dark:text-amber-200 text-[11px] uppercase tracking-wider">
                    Bản quyền &amp; Nguồn tài liệu gốc
                  </div>
                  <p className="text-amber-900/85 dark:text-amber-300/85 leading-relaxed text-xs">
                    {post.series_outline?.attribution_text}
                  </p>
                </div>
              </div>
            )}

            {/* Course Navigation Buttons (Bài trước / Bài tiếp theo) */}
            {post.series_outline && (
              <div className="mt-12 pt-8 border-t border-stone-200 dark:border-stone-800 grid grid-cols-1 sm:grid-cols-2 gap-4">
                {post.prev_post ? (
                  <Link
                    href={`/posts/${post.prev_post.slug}`}
                    className="p-4 rounded-2xl border border-stone-200 dark:border-stone-800 hover:border-blue-500 hover:bg-stone-50 dark:hover:bg-stone-900/60 transition-all text-left space-y-1 group"
                  >
                    <div className="flex items-center gap-1 text-[11px] font-semibold text-stone-400 group-hover:text-blue-600">
                      <ChevronLeft className="w-3.5 h-3.5" />
                      <span>Bài trước</span>
                    </div>
                    <div className="text-sm font-bold text-stone-900 dark:text-white line-clamp-1">
                      {post.prev_post.title}
                    </div>
                  </Link>
                ) : (
                  <div />
                )}

                {post.next_post ? (
                  <Link
                    href={`/posts/${post.next_post.slug}`}
                    className="p-4 rounded-2xl border border-stone-200 dark:border-stone-800 hover:border-blue-500 hover:bg-stone-50 dark:hover:bg-stone-900/60 transition-all text-right space-y-1 group sm:col-start-2"
                  >
                    <div className="flex items-center justify-end gap-1 text-[11px] font-semibold text-stone-400 group-hover:text-blue-600">
                      <span>Bài tiếp theo</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </div>
                    <div className="text-sm font-bold text-stone-900 dark:text-white line-clamp-1">
                      {post.next_post.title}
                    </div>
                  </Link>
                ) : null}
              </div>
            )}

            {/* Tags */}
            {post.tags && post.tags.length > 0 && (
              <div className="mt-12 pt-8 border-t border-stone-200 dark:border-stone-800 flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold text-stone-400 flex items-center gap-1.5 mr-2">
                  <TagIcon className="w-3.5 h-3.5" /> Thẻ bài viết:
                </span>
                {post.tags.map((tag) => (
                  <Link
                    key={tag.id}
                    href={`/?tag=${tag.slug}`}
                    className="px-3 py-1 rounded-lg text-xs font-medium bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-950 dark:hover:text-blue-400 transition-colors"
                  >
                    #{tag.name}
                  </Link>
                ))}
              </div>
            )}

            {/* Author Bio Box */}
            <div className="mt-10 p-6 rounded-2xl border border-stone-200 dark:border-stone-800 bg-stone-100/50 dark:bg-stone-900/40 flex flex-col sm:flex-row items-center sm:items-start gap-4 text-center sm:text-left">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white font-bold text-xl shadow-md shrink-0">
                {post.author?.full_name?.charAt(0) || post.author?.username?.charAt(0) || "H"}
              </div>
              <div className="space-y-1.5 flex-1">
                <div className="text-base font-bold text-stone-900 dark:text-white">
                  {post.author?.full_name || post.author?.username || "Hung Pham Hoang"}
                </div>
                <p className="text-xs text-stone-500 dark:text-stone-400 leading-relaxed">
                  Kỹ sư phần mềm đam mê kiến trúc phân tán, backend hiệu năng cao, AI RAG và xây dựng các sản phẩm số tinh tế.
                </p>
              </div>
            </div>

            {/* WordPress-style & Gmail Comments Section */}
            <CommentSection postId={post.slug} />
          </article>

          {/* Sticky Sidebar */}
          <aside className="lg:col-span-4 space-y-8">
            <div className="sticky top-24 space-y-6">
              {/* Course Outline Sidebar (nếu có) */}
              {post.series_outline && chapterTree.length > 0 && (
                <div className="p-5 rounded-2xl border border-blue-200/80 dark:border-blue-900/60 bg-white dark:bg-stone-900/70 shadow-sm space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
                      <Layers className="w-4 h-4" />
                      <span>Lộ trình bài giảng</span>
                    </div>
                    <span className="text-[11px] text-stone-400 font-medium">
                      {post.series_outline.total_lessons} bài
                    </span>
                  </div>

                  <div className="space-y-4 max-h-[420px] overflow-y-auto pr-1 text-xs divide-y divide-stone-100 dark:divide-stone-800/60">
                    {chapterTree.map((rootNode) => (
                      <div key={rootNode.id} className="pt-3 first:pt-0 space-y-2">
                        {/* Cấp to (Level 1: Chương / Phần) */}
                        <div className="font-bold text-stone-900 dark:text-stone-100 text-xs flex items-baseline gap-1.5">
                          <span className="text-blue-600 dark:text-blue-400 font-semibold shrink-0">
                            {levels[0] || "Chương"} {rootNode.displayNumber}.
                          </span>
                          <span className="leading-snug">{rootNode.title}</span>
                        </div>

                        {/* Bài viết trực tiếp thuộc Cấp to (nếu có) */}
                        {rootNode.lessons && rootNode.lessons.length > 0 && (
                          <ul className="space-y-1 pl-3 border-l-2 border-stone-200 dark:border-stone-800 ml-1">
                            {rootNode.lessons.map((les, lIdx) => {
                              const isCurrent = les.slug === post.slug;
                              return (
                                <li key={les.id}>
                                  <Link
                                    href={`/posts/${les.slug}`}
                                    className={`group flex items-center justify-between py-1 px-2 rounded-lg transition-colors text-xs ${
                                      isCurrent
                                        ? "font-bold bg-blue-50 dark:bg-blue-950/80 text-blue-600 dark:text-blue-400 border border-blue-200/60 dark:border-blue-800/60"
                                        : "text-stone-500 hover:text-stone-900 dark:hover:text-white hover:bg-stone-50 dark:hover:bg-stone-800/50"
                                    }`}
                                  >
                                    <div className="flex items-center gap-1.5 min-w-0">
                                      {isCurrent ? (
                                        <span className="w-1.5 h-1.5 rounded-full bg-blue-600 dark:bg-blue-400 shrink-0" />
                                      ) : (
                                        <span className="text-[10px] text-stone-400 shrink-0">
                                          {rootNode.displayNumber}.{lIdx + 1}
                                        </span>
                                      )}
                                      <span className="truncate">{les.title}</span>
                                    </div>
                                  </Link>
                                </li>
                              );
                            })}
                          </ul>
                        )}

                        {/* Cấp bé hơn (Sub-chapters: Module / Bài / Mục) */}
                        {rootNode.children && rootNode.children.length > 0 && (
                          <div className="space-y-2.5 pl-2.5 ml-1 border-l-2 border-stone-200/80 dark:border-stone-800">
                            {rootNode.children.map((subNode) => {
                              const subLevelName = levels[(subNode.level || 2) - 1] || "Mục";
                              return (
                                <div key={subNode.id} className="space-y-1.5 pl-1">
                                  {/* Cấp bé header */}
                                  <div className="font-semibold text-stone-700 dark:text-stone-300 text-[11px] flex items-baseline gap-1.5">
                                    <span className="text-blue-500/80 dark:text-blue-400/80 font-medium shrink-0">
                                      {subLevelName} {subNode.displayNumber}:
                                    </span>
                                    <span className="leading-snug">{subNode.title}</span>
                                  </div>

                                  {/* Bài viết thuộc cấp bé */}
                                  {subNode.lessons && subNode.lessons.length > 0 && (
                                    <ul className="space-y-1 pl-2.5 border-l border-blue-200/60 dark:border-blue-900/50 ml-1">
                                      {subNode.lessons.map((les, lIdx) => {
                                        const isCurrent = les.slug === post.slug;
                                        return (
                                          <li key={les.id}>
                                            <Link
                                              href={`/posts/${les.slug}`}
                                              className={`group flex items-center justify-between py-1 px-2 rounded-lg transition-colors text-xs ${
                                                isCurrent
                                                  ? "font-bold bg-blue-50 dark:bg-blue-950/80 text-blue-600 dark:text-blue-400 border border-blue-200/60 dark:border-blue-800/60"
                                                  : "text-stone-500 hover:text-stone-900 dark:hover:text-white hover:bg-stone-50 dark:hover:bg-stone-800/50"
                                              }`}
                                            >
                                              <div className="flex items-center gap-1.5 min-w-0">
                                                {isCurrent ? (
                                                  <span className="w-1.5 h-1.5 rounded-full bg-blue-600 dark:bg-blue-400 shrink-0" />
                                                ) : (
                                                  <span className="text-[10px] text-stone-400 shrink-0">
                                                    {subNode.displayNumber}.{lIdx + 1}
                                                  </span>
                                                )}
                                                <span className="truncate">{les.title}</span>
                                              </div>
                                            </Link>
                                          </li>
                                        );
                                      })}
                                    </ul>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Table of Contents */}
              <div className="p-5 rounded-2xl border border-stone-200/80 dark:border-stone-800 bg-white dark:bg-stone-900/50 shadow-sm">
                <TableOfContents contentHtml={post.content_html} />
              </div>
            </div>
          </aside>
        </div>
      </div>
    </>
  );
};
