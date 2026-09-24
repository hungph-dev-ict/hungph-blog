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
  ChevronDown,
  ChevronUp,
  BookOpen,
  Heart,
  Flag,
  X,
  ShieldCheck,
  Edit3,
  Copy,
  Link2,
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
  const [showShareModal, setShowShareModal] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [reportDesc, setReportDesc] = useState("");
  const [reportLoading, setReportLoading] = useState(false);
  const [reportDone, setReportDone] = useState(false);

  // Quyền chỉnh sửa: Admin hoặc chính tác giả bài viết
  const isAdmin = Boolean(user && (user.is_admin || user.role === "admin"));
  const isAuthor = Boolean(user && post.author?.id && user.id === post.author.id);
  const canEdit = isAdmin || isAuthor;

  // Quản lý minimize / thu gọn cho Lộ trình bài giảng & Mục lục
  const [isOutlineCollapsedDesktop, setIsOutlineCollapsedDesktop] = useState(false);
  const [isOutlineCollapsedMobile, setIsOutlineCollapsedMobile] = useState(true);
  const [headingCount, setHeadingCount] = useState<number>(0);

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

            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap justify-end">
              {/* Nút Chỉnh sửa dành cho Tác giả / Admin */}
              {canEdit && (
                <Link
                  href={`/editor/${post.id}`}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-blue-200 dark:border-blue-800/80 bg-blue-50/80 dark:bg-blue-950/40 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/60 transition-colors shadow-xs"
                  title="Chỉnh sửa bài viết này"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Chỉnh sửa</span>
                </Link>
              )}

              <button
                onClick={() => setShowShareModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-stone-200 dark:border-stone-800 text-xs font-medium text-stone-600 dark:text-stone-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
                title="Chia sẻ bài viết"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>Chia sẻ</span>
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
          </div>
        </header>

        {/* Modern Social Share Modal */}
        {showShareModal && (
          <div
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
            onClick={() => setShowShareModal(false)}
          >
            <div
              className="bg-white dark:bg-stone-900 rounded-3xl border border-stone-200 dark:border-stone-800 p-6 w-full max-w-md shadow-2xl space-y-5"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between pb-3 border-b border-stone-100 dark:border-stone-800">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400">
                    <Share2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-stone-900 dark:text-white">Chia sẻ bài viết</h3>
                    <p className="text-xs text-stone-500">Lan tỏa kiến thức đến bạn bè & đồng nghiệp</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowShareModal(false)}
                  className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Grid of Platforms */}
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 text-center">
                {/* Facebook */}
                <button
                  type="button"
                  onClick={() => {
                    const url = typeof window !== "undefined" ? window.location.href : "";
                    window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, "_blank", "width=600,height=500");
                  }}
                  className="p-3 rounded-2xl border border-stone-200 dark:border-stone-800 hover:border-blue-500 hover:bg-blue-50/50 dark:hover:bg-blue-950/30 flex flex-col items-center gap-1.5 transition-all group"
                >
                  <div className="w-10 h-10 rounded-full bg-[#1877F2]/10 text-[#1877F2] flex items-center justify-center group-hover:scale-110 transition-transform font-bold">
                    <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                    </svg>
                  </div>
                  <span className="text-xs font-semibold text-stone-700 dark:text-stone-300">Facebook</span>
                </button>

                {/* X / Twitter */}
                <button
                  type="button"
                  onClick={() => {
                    const url = typeof window !== "undefined" ? window.location.href : "";
                    const text = `Đọc bài viết hay "${post.title}" trên HungPH Blog:`;
                    window.open(`https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`, "_blank", "width=600,height=500");
                  }}
                  className="p-3 rounded-2xl border border-stone-200 dark:border-stone-800 hover:border-stone-500 hover:bg-stone-50 dark:hover:bg-stone-800/60 flex flex-col items-center gap-1.5 transition-all group"
                >
                  <div className="w-10 h-10 rounded-full bg-stone-900/10 dark:bg-white/10 text-stone-900 dark:text-white flex items-center justify-center group-hover:scale-110 transition-transform">
                    <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                    </svg>
                  </div>
                  <span className="text-xs font-semibold text-stone-700 dark:text-stone-300">X (Twitter)</span>
                </button>

                {/* LinkedIn */}
                <button
                  type="button"
                  onClick={() => {
                    const url = typeof window !== "undefined" ? window.location.href : "";
                    window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`, "_blank", "width=600,height=500");
                  }}
                  className="p-3 rounded-2xl border border-stone-200 dark:border-stone-800 hover:border-blue-600 hover:bg-blue-50/50 dark:hover:bg-blue-950/30 flex flex-col items-center gap-1.5 transition-all group"
                >
                  <div className="w-10 h-10 rounded-full bg-[#0A66C2]/10 text-[#0A66C2] flex items-center justify-center group-hover:scale-110 transition-transform">
                    <svg className="w-4.5 h-4.5 fill-current" viewBox="0 0 24 24">
                      <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.88 8.56a1.68 1.68 0 0 0 1.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 0 0-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77z" />
                    </svg>
                  </div>
                  <span className="text-xs font-semibold text-stone-700 dark:text-stone-300">LinkedIn</span>
                </button>

                {/* Telegram */}
                <button
                  type="button"
                  onClick={() => {
                    const url = typeof window !== "undefined" ? window.location.href : "";
                    window.open(`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(post.title)}`, "_blank", "width=600,height=500");
                  }}
                  className="p-3 rounded-2xl border border-stone-200 dark:border-stone-800 hover:border-sky-500 hover:bg-sky-50/50 dark:hover:bg-sky-950/30 flex flex-col items-center gap-1.5 transition-all group"
                >
                  <div className="w-10 h-10 rounded-full bg-[#229ED9]/10 text-[#229ED9] flex items-center justify-center group-hover:scale-110 transition-transform">
                    <svg className="w-4.5 h-4.5 fill-current" viewBox="0 0 24 24">
                      <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
                    </svg>
                  </div>
                  <span className="text-xs font-semibold text-stone-700 dark:text-stone-300">Telegram</span>
                </button>

                {/* Reddit */}
                <button
                  type="button"
                  onClick={() => {
                    const url = typeof window !== "undefined" ? window.location.href : "";
                    window.open(`https://reddit.com/submit?url=${encodeURIComponent(url)}&title=${encodeURIComponent(post.title)}`, "_blank", "width=600,height=500");
                  }}
                  className="p-3 rounded-2xl border border-stone-200 dark:border-stone-800 hover:border-orange-500 hover:bg-orange-50/50 dark:hover:bg-orange-950/30 flex flex-col items-center gap-1.5 transition-all group"
                >
                  <div className="w-10 h-10 rounded-full bg-[#FF4500]/10 text-[#FF4500] flex items-center justify-center group-hover:scale-110 transition-transform">
                    <svg className="w-4.5 h-4.5 fill-current" viewBox="0 0 24 24">
                      <path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.703zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.197-2.512-.73a.326.326 0 0 0-.232-.095z" />
                    </svg>
                  </div>
                  <span className="text-xs font-semibold text-stone-700 dark:text-stone-300">Reddit</span>
                </button>

                {/* WhatsApp */}
                <button
                  type="button"
                  onClick={() => {
                    const url = typeof window !== "undefined" ? window.location.href : "";
                    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(`${post.title}: ${url}`)}`, "_blank", "width=600,height=500");
                  }}
                  className="p-3 rounded-2xl border border-stone-200 dark:border-stone-800 hover:border-emerald-500 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/30 flex flex-col items-center gap-1.5 transition-all group"
                >
                  <div className="w-10 h-10 rounded-full bg-[#25D366]/10 text-[#25D366] flex items-center justify-center group-hover:scale-110 transition-transform">
                    <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                      <path d="M12.031 0C5.385 0 .004 5.38.004 12.026c0 2.122.554 4.193 1.606 6.015L.004 24l6.148-1.611a12.008 12.008 0 0 0 5.879 1.53h.005c6.643 0 12.023-5.38 12.025-12.026A12.015 12.015 0 0 0 12.031 0zm-.005 21.983h-.004a9.98 9.98 0 0 1-5.088-1.393l-.365-.217-3.778.991 1.008-3.684-.237-.378a9.986 9.986 0 0 1-1.536-5.276c0-5.518 4.49-10.007 10.013-10.007 2.673 0 5.187 1.042 7.078 2.933a9.96 9.96 0 0 1 2.93 7.074c-.003 5.518-4.492 10.007-10.021 10.007zm5.492-7.498c-.301-.151-1.782-.88-2.059-.98-.276-.1-.478-.15-.68.151-.202.302-.782.98-.958 1.182-.177.202-.353.226-.654.076-.301-.151-1.272-.469-2.424-1.496-.895-.798-1.5-1.784-1.677-2.086-.176-.301-.019-.464.132-.614.136-.135.301-.352.452-.528.15-.176.201-.301.302-.503.1-.202.05-.378-.025-.528-.075-.151-.68-1.637-.931-2.242-.245-.589-.494-.509-.68-.518-.176-.009-.377-.01-.579-.01s-.528.076-.804.377c-.276.302-1.055 1.031-1.055 2.514 0 1.483 1.08 2.916 1.231 3.118.151.201 2.124 3.243 5.145 4.549.719.311 1.28.497 1.718.636.722.23 1.378.197 1.9.12.58-.087 1.782-.728 2.033-1.432.251-.703.251-1.306.176-1.432-.075-.125-.276-.201-.577-.352z" />
                    </svg>
                  </div>
                  <span className="text-xs font-semibold text-stone-700 dark:text-stone-300">WhatsApp</span>
                </button>

                {/* Email */}
                <button
                  type="button"
                  onClick={() => {
                    const url = typeof window !== "undefined" ? window.location.href : "";
                    const subject = encodeURIComponent(post.title);
                    const body = encodeURIComponent(`Chào bạn,\n\nMình thấy bài viết này rất hữu ích và muốn chia sẻ với bạn:\n\n${post.title}\n${url}\n\nChúc bạn ngày tốt lành!`);
                    window.location.href = `mailto:?subject=${subject}&body=${body}`;
                  }}
                  className="p-3 rounded-2xl border border-stone-200 dark:border-stone-800 hover:border-purple-500 hover:bg-purple-50/50 dark:hover:bg-purple-950/30 flex flex-col items-center gap-1.5 transition-all group"
                >
                  <div className="w-10 h-10 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <svg className="w-5 h-5 fill-none stroke-current" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect width="20" height="16" x="2" y="4" rx="2" />
                      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                    </svg>
                  </div>
                  <span className="text-xs font-semibold text-stone-700 dark:text-stone-300">Email</span>
                </button>
              </div>

              {/* Direct Link Copy Bar */}
              <div className="space-y-1.5 pt-2 border-t border-stone-100 dark:border-stone-800">
                <label className="text-[11px] font-semibold text-stone-500 uppercase tracking-wider">
                  Hoặc sao chép đường dẫn trực tiếp:
                </label>
                <div className="flex items-center gap-2 p-1.5 pl-3 rounded-2xl border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-950/60">
                  <Link2 className="w-4 h-4 text-stone-400 shrink-0" />
                  <input
                    type="text"
                    readOnly
                    value={typeof window !== "undefined" ? window.location.href : ""}
                    className="w-full text-xs bg-transparent text-stone-700 dark:text-stone-300 outline-none select-all truncate"
                  />
                  <button
                    type="button"
                    onClick={copyShareLink}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all shrink-0 ${
                      copied
                        ? "bg-emerald-600 text-white"
                        : "bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
                    }`}
                  >
                    {copied ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Đã chép!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Sao chép</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

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
        {(() => {
          const hasCourseOutline = Boolean(post.series_outline && chapterTree.length > 0);
          const hasTOC = headingCount > 0;
          const hasSidebarContent = hasCourseOutline || hasTOC;

          const renderCourseOutline = (isMobile = false) => {
            if (!hasCourseOutline) return null;
            const isCollapsed = isMobile ? isOutlineCollapsedMobile : isOutlineCollapsedDesktop;
            const setIsCollapsed = isMobile ? setIsOutlineCollapsedMobile : setIsOutlineCollapsedDesktop;

            return (
              <div className="p-4 sm:p-5 rounded-2xl border border-blue-200/90 dark:border-blue-900/60 bg-white/90 dark:bg-stone-900/80 shadow-sm space-y-3 transition-all">
                <button
                  type="button"
                  onClick={() => setIsCollapsed(!isCollapsed)}
                  className="w-full flex items-center justify-between text-left group cursor-pointer"
                  title={isCollapsed ? "Mở rộng lộ trình" : "Thu gọn lộ trình"}
                >
                  <div className="flex items-center gap-2 text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
                    <Layers className="w-4 h-4 shrink-0" />
                    <span>Lộ trình bài giảng</span>
                    <span className="text-[10px] text-stone-400 font-normal lowercase tracking-normal">
                      ({post.series_outline?.total_lessons} bài)
                    </span>
                  </div>
                  <div className="p-1 rounded-md text-stone-400 group-hover:bg-blue-50 dark:group-hover:bg-stone-800 transition-colors">
                    {isCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                  </div>
                </button>

                {!isCollapsed && (
                  <div className="pt-2 border-t border-blue-100 dark:border-blue-900/40 space-y-4 max-h-[380px] sm:max-h-[420px] overflow-y-auto pr-1 text-xs divide-y divide-stone-100 dark:divide-stone-800/60 animate-in fade-in duration-150">
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
                )}
              </div>
            );
          };

          return (
            <div className={`mt-8 ${hasSidebarContent ? "grid grid-cols-1 lg:grid-cols-12 gap-8" : "max-w-4xl mx-auto"}`}>
              <article className={`${hasSidebarContent ? "lg:col-span-8" : "w-full"} min-w-0`}>
                {/* On Mobile Only: Hiện Lộ trình bài giảng & Mục lục ở ĐẦU bài viết (Mặc định thu gọn) */}
                {hasSidebarContent && (
                  <div className="lg:hidden mb-8 space-y-4">
                    {hasCourseOutline && renderCourseOutline(true)}
                    <TableOfContents
                      contentHtml={post.content_html}
                      initialCollapsed={true}
                      onHeadingsFound={setHeadingCount}
                    />
                  </div>
                )}

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

              {/* Desktop Sticky Sidebar (Chỉ render khi có Lộ trình hoặc có Mục lục) */}
              {hasSidebarContent && (
                <aside className="hidden lg:block lg:col-span-4 space-y-8">
                  <div className="sticky top-24 space-y-6">
                    {hasCourseOutline && renderCourseOutline(false)}

                    {/* Table of Contents Desktop (Mặc định mở) */}
                    <TableOfContents
                      contentHtml={post.content_html}
                      initialCollapsed={false}
                      onHeadingsFound={setHeadingCount}
                    />
                  </div>
                </aside>
              )}
            </div>
          );
        })()}
      </div>
    </>
  );
};
