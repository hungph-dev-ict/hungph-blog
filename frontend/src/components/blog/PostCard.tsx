import React from "react";
import Link from "next/link";
import { Clock, Calendar, ArrowRight, Eye } from "lucide-react";
import { PostListItem } from "@/lib/types";
import { getFullImageUrl } from "@/lib/api";

interface PostCardProps {
  post: PostListItem;
}

export const PostCard: React.FC<PostCardProps> = ({ post }) => {
  const formattedDate = post.published_at
    ? new Date(post.published_at).toLocaleDateString("vi-VN", {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : "Chưa xuất bản";

  return (
    <article className="group relative flex flex-col sm:flex-row gap-6 p-5 rounded-2xl border border-stone-200/80 dark:border-stone-800 bg-white dark:bg-stone-900/60 hover:border-blue-500/40 dark:hover:border-blue-500/40 hover:shadow-xl hover:shadow-blue-500/5 transition-all duration-300">
      {/* Cover Image - Always shown, uses branded default if no cover_image */}
      <Link
        href={`/posts/${post.slug}`}
        className="sm:w-64 md:w-72 lg:w-80 h-48 sm:h-auto min-h-[190px] shrink-0 overflow-hidden rounded-xl relative block bg-stone-100 dark:bg-stone-800"
      >
        <img
          src={getFullImageUrl(post.cover_image)}
          alt={post.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          loading="lazy"
        />
      </Link>

      {/* Content */}
      <div className="flex flex-col justify-between flex-1 min-w-0">
        <div className="space-y-2.5">
          {/* Category & Meta */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {post.category && (
              <span className="px-2.5 py-0.5 rounded-full font-medium bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200/50 dark:border-blue-800/50">
                {post.category.name}
              </span>
            )}
            <span className="flex items-center gap-1 text-stone-400 dark:text-stone-500">
              <Calendar className="w-3.5 h-3.5" />
              {formattedDate}
            </span>
            <span className="text-stone-300 dark:text-stone-700">•</span>
            <span className="flex items-center gap-1 text-stone-400 dark:text-stone-500">
              <Clock className="w-3.5 h-3.5" />
              {post.reading_time_minutes} phút đọc
            </span>
            {post.views_count > 0 && (
              <>
                <span className="text-stone-300 dark:text-stone-700">•</span>
                <span className="flex items-center gap-1 text-stone-400 dark:text-stone-500">
                  <Eye className="w-3.5 h-3.5" />
                  {post.views_count}
                </span>
              </>
            )}
          </div>

          {/* Title */}
          <h2 className="text-xl font-bold tracking-tight text-stone-900 dark:text-stone-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors line-clamp-2">
            <Link href={`/posts/${post.slug}`}>{post.title}</Link>
          </h2>

          {/* Summary */}
          {post.summary && (
            <p className="text-sm text-stone-600 dark:text-stone-400 line-clamp-2 leading-relaxed">
              {post.summary}
            </p>
          )}
        </div>

        {/* Tags & Action */}
        <div className="flex items-center justify-between pt-4 mt-2 border-t border-stone-100 dark:border-stone-800/80">
          <div className="flex flex-wrap items-center gap-1.5">
            {post.tags.slice(0, 3).map((tag) => (
              <span
                key={tag.id}
                className="text-[11px] font-medium text-stone-500 dark:text-stone-400 bg-stone-100 dark:bg-stone-800 px-2 py-0.5 rounded-md"
              >
                #{tag.name}
              </span>
            ))}
          </div>

          <Link
            href={`/posts/${post.slug}`}
            className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 dark:text-blue-400 group-hover:translate-x-0.5 transition-transform"
          >
            <span>Đọc tiếp</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    </article>
  );
};
