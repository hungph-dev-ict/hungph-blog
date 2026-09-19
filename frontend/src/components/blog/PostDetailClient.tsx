"use client";

import React, { useState } from "react";
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
} from "lucide-react";
import { getFullImageUrl } from "@/lib/api";
import { PostDetail } from "@/lib/types";
import { TableOfContents } from "@/components/blog/TableOfContents";
import { ReadingProgressBar } from "@/components/blog/ReadingProgressBar";
import { CommentSection } from "@/components/blog/CommentSection";

interface PostDetailClientProps {
  initialPost: PostDetail;
}

export const PostDetailClient: React.FC<PostDetailClientProps> = ({ initialPost: post }) => {
  const router = useRouter();
  const [copied, setCopied] = useState<boolean>(false);

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
              {post.series_outline && (
                <div className="p-5 rounded-2xl border border-blue-200/80 dark:border-blue-900/60 bg-white dark:bg-stone-900/70 shadow-sm space-y-4">
                  <div className="flex items-center gap-2 text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
                    <Layers className="w-4 h-4" />
                    <span>Lộ trình bài giảng</span>
                  </div>

                  <div className="space-y-4 max-h-[380px] overflow-y-auto pr-1 text-xs">
                    {post.series_outline.chapters.map((chap, cIdx) => (
                      <div key={chap.id} className="space-y-1.5">
                        <div className="font-semibold text-stone-700 dark:text-stone-300">
                          {cIdx + 1}. {chap.title}
                        </div>
                        <ul className="space-y-1 pl-3 border-l border-stone-200 dark:border-stone-800">
                          {chap.lessons?.map((les) => {
                            const isCurrent = les.slug === post.slug;
                            return (
                              <li key={les.id}>
                                <Link
                                  href={`/posts/${les.slug}`}
                                  className={`block py-1 px-2 rounded-lg transition-colors ${
                                    isCurrent
                                      ? "font-bold bg-blue-50 dark:bg-blue-950/80 text-blue-600 dark:text-blue-400"
                                      : "text-stone-500 hover:text-stone-900 dark:hover:text-white"
                                  }`}
                                >
                                  {les.title}
                                </Link>
                              </li>
                            );
                          })}
                        </ul>
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
