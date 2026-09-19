"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
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
} from "lucide-react";
import { fetchPostBySlug, getFullImageUrl } from "@/lib/api";
import { PostDetail } from "@/lib/types";
import { TableOfContents } from "@/components/blog/TableOfContents";
import { ReadingProgressBar } from "@/components/blog/ReadingProgressBar";
import { CommentSection } from "@/components/blog/CommentSection";

export default function PostDetailPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params?.slug as string;

  const [post, setPost] = useState<PostDetail | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [copied, setCopied] = useState<boolean>(false);

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    fetchPostBySlug(slug)
      .then((data) => setPost(data))
      .catch((err) => {
        console.error("Lỗi khi mở bài viết:", err);
      })
      .finally(() => setLoading(false));
  }, [slug]);

  const copyShareLink = () => {
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto py-16 space-y-6 animate-pulse">
        <div className="h-6 w-32 bg-stone-200 dark:bg-stone-800 rounded-lg" />
        <div className="h-12 w-full bg-stone-200 dark:bg-stone-800 rounded-xl" />
        <div className="h-64 w-full bg-stone-200 dark:bg-stone-800 rounded-2xl" />
        <div className="space-y-3 pt-6">
          <div className="h-4 bg-stone-200 dark:bg-stone-800 rounded w-full" />
          <div className="h-4 bg-stone-200 dark:bg-stone-800 rounded w-5/6" />
        </div>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="max-w-md mx-auto py-20 text-center space-y-4">
        <h2 className="text-2xl font-bold text-stone-900 dark:text-white">
          Không tìm thấy bài viết
        </h2>
        <p className="text-sm text-stone-500">
          Bài viết có thể chưa được xuất bản hoặc đường dẫn không còn tồn tại.
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm font-semibold text-blue-600 hover:underline"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Về trang chủ</span>
        </Link>
      </div>
    );
  }

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
        {/* Navigation / Course Breadcrumb */}
        <div className="mb-6 flex items-center justify-between">
          <button
            onClick={() => router.back()}
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
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white font-bold text-sm shadow">
                {post.author?.full_name?.charAt(0) || post.author?.username?.charAt(0) || "H"}
              </div>
              <div>
                <div className="text-sm font-semibold text-stone-900 dark:text-stone-100">
                  {post.author?.full_name || post.author?.username || "Hung Pham Hoang"}
                </div>
                <div className="text-xs text-stone-500">Tác giả & Kỹ sư phần mềm</div>
              </div>
            </div>

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
          </div>
        </header>

        {/* Cover Image Banner */}
        {post.cover_image && (
          <div className="my-8 rounded-3xl overflow-hidden shadow-lg border border-stone-200 dark:border-stone-800 max-h-[480px]">
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

            {/* Post Tags */}
            {post.tags && post.tags.length > 0 && (
              <div className="pt-8 mt-8 border-t border-stone-200 dark:border-stone-800">
                <div className="flex items-center gap-2 text-xs font-semibold text-stone-500 uppercase tracking-wider mb-3">
                  <TagIcon className="w-3.5 h-3.5 text-blue-500" />
                  <span>Thẻ bài viết</span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {post.tags.map((tag) => (
                    <span
                      key={tag.id}
                      className="px-3 py-1 rounded-lg text-xs font-medium bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 border border-stone-200/60 dark:border-stone-700/60"
                    >
                      #{tag.name}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Comments Section (WordPress Style & Gmail Login) */}
            <CommentSection postId={post.id} />
          </article>

          {/* Sidebar */}
          <aside className="hidden lg:block lg:col-span-4 space-y-6">
            {/* If part of a course: Show Course Outline Tree */}
            {post.series_outline ? (
              <div className="p-4 rounded-2xl border border-stone-200 dark:border-stone-800 bg-white/60 dark:bg-stone-900/60 backdrop-blur-sm sticky top-20 max-h-[80vh] overflow-y-auto">
                <div className="flex items-center justify-between pb-3 mb-3 border-b border-stone-100 dark:border-stone-800">
                  <div className="flex items-center gap-2 font-bold text-xs uppercase tracking-wider text-blue-600 dark:text-blue-400">
                    <Layers className="w-4 h-4" />
                    <span>Lộ trình khóa học</span>
                  </div>
                  <Link
                    href={`/series/${post.series_outline.slug}`}
                    className="text-[11px] text-stone-400 hover:text-blue-600"
                  >
                    Xem tất cả
                  </Link>
                </div>

                <div className="space-y-4">
                  {post.series_outline.chapters.map((ch, cIdx) => (
                    <div key={ch.id} className="space-y-1.5">
                      <div className="text-xs font-bold text-stone-900 dark:text-stone-200">
                        Chương {cIdx + 1}: {ch.title}
                      </div>
                      <div className="space-y-1 pl-2 border-l-2 border-stone-200 dark:border-stone-700">
                        {ch.lessons?.map((les, lIdx) => {
                          const isCurrent = les.slug === post.slug;
                          return (
                            <Link
                              key={les.id}
                              href={`/posts/${les.slug}`}
                              className={`block text-xs py-1 px-2 rounded-lg transition-colors truncate ${
                                isCurrent
                                  ? "bg-blue-600 text-white font-semibold"
                                  : "text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-white hover:bg-stone-100 dark:hover:bg-stone-800"
                              }`}
                            >
                              Bài {cIdx + 1}.{lIdx + 1}: {les.title}
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              /* Standalone post: Show Table of Contents */
              <TableOfContents contentHtml={post.content_html} />
            )}
          </aside>
        </div>
      </div>
    </>
  );
}
