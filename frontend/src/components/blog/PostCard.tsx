"use client";
import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Clock, Calendar, ArrowRight, Eye, Heart, GraduationCap, User as UserIcon } from "lucide-react";
import { PostListItem } from "@/lib/types";
import { getFullImageUrl, getLikeStatus, toggleLike } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

interface PostCardProps {
  post: PostListItem;
}

export const PostCard: React.FC<PostCardProps> = ({ post }) => {
  const { user, token } = useAuth();
  const [liked, setLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(post.likes_count ?? 0);
  const [likeLoading, setLikeLoading] = useState(false);

  useEffect(() => {
    if (post.likes_count !== undefined) {
      setLikesCount(post.likes_count);
    }
    // Nếu chưa đăng nhập, không cần gọi API like-status để tránh spam request làm chậm trang
    if (!token) return;

    getLikeStatus(post.id, token)
      .then((s) => {
        setLiked(s.liked);
        if (s.likes_count !== undefined) {
          setLikesCount(s.likes_count);
        }
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [post.id, post.likes_count, token]);

  const handleLike = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!user || !token) {
      alert("Vui lòng đăng nhập để thả tim");
      return;
    }
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

  const formattedDate = post.published_at
    ? new Date(post.published_at).toLocaleDateString("vi-VN", {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : "Chưa xuất bản";

  const authorName = post.author?.full_name || post.author?.username || "Tác giả";

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
          {/* Top Meta: Author • Date • Course • Category */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {/* Author */}
            {post.author ? (
              <Link
                href={`/profile/${post.author.username}`}
                className="inline-flex items-center gap-1.5 font-medium text-stone-700 dark:text-stone-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
              >
                {post.author.avatar_url ? (
                  <img
                    src={getFullImageUrl(post.author.avatar_url)}
                    alt={authorName}
                    className="w-4 h-4 rounded-full object-cover border border-stone-200 dark:border-stone-700"
                  />
                ) : (
                  <UserIcon className="w-3.5 h-3.5 text-stone-400" />
                )}
                <span>{authorName}</span>
              </Link>
            ) : null}

            {post.author && <span className="text-stone-300 dark:text-stone-700">•</span>}

            {/* Published Date */}
            <span className="flex items-center gap-1 text-stone-400 dark:text-stone-500">
              <Calendar className="w-3.5 h-3.5" />
              {formattedDate}
            </span>

            {/* Course / Series Name (if belongs to course) */}
            {post.series && (
              <>
                <span className="text-stone-300 dark:text-stone-700">•</span>
                <Link
                  href={`/series/${post.series.slug}`}
                  className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-medium text-[11px] bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200/60 dark:border-amber-800/60 hover:bg-amber-100 dark:hover:bg-amber-900/60 transition-colors shrink-0"
                  title={`Series: ${post.series.title}`}
                >
                  <GraduationCap className="w-3 h-3 text-amber-600 dark:text-amber-400 shrink-0" />
                  <span className="max-w-[140px] sm:max-w-[220px] truncate">
                    Khóa: {post.series.title}
                  </span>
                </Link>
              </>
            )}

            {/* Category */}
            {post.category && (
              <span className="px-2.5 py-0.5 rounded-full font-medium bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200/50 dark:border-blue-800/50 text-[11px]">
                {post.category.name}
              </span>
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

        {/* Tags & Metrics / Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-4 mt-2 border-t border-stone-100 dark:border-stone-800/80">
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

          <div className="flex items-center gap-2.5 sm:gap-3 text-xs text-stone-400 dark:text-stone-500">
            {/* Reading Time */}
            <span className="flex items-center gap-1" title="Thời gian đọc">
              <Clock className="w-3.5 h-3.5" />
              <span>{post.reading_time_minutes} phút</span>
            </span>

            <span className="text-stone-300 dark:text-stone-700">•</span>

            {/* Views */}
            <span className="flex items-center gap-1" title="Lượt xem">
              <Eye className="w-3.5 h-3.5" />
              <span>{post.views_count ?? 0}</span>
            </span>

            <span className="text-stone-300 dark:text-stone-700">•</span>

            {/* Likes */}
            <button
              onClick={handleLike}
              title={liked ? "Bỏ thích" : "Thích bài viết"}
              className={`flex items-center gap-1 font-medium transition-all ${
                liked
                  ? "text-rose-500"
                  : "text-stone-400 hover:text-rose-500"
              }`}
            >
              <Heart
                className={`w-3.5 h-3.5 transition-transform ${
                  liked ? "fill-rose-500 scale-110" : ""
                }`}
              />
              <span>{likesCount}</span>
            </button>

            {/* Read More */}
            <Link
              href={`/posts/${post.slug}`}
              className="inline-flex items-center gap-1 font-semibold text-blue-600 dark:text-blue-400 group-hover:translate-x-0.5 transition-transform ml-1"
            >
              <span>Đọc tiếp</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
};
