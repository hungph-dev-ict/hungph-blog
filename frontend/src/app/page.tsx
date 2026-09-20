"use client";

import React, { useEffect, useState } from "react";
import { Search, Sparkles, Tag as TagIcon, Layers, PenLine, GraduationCap, ArrowRight, BookOpen, Clock, User as UserIcon } from "lucide-react";
import Link from "next/link";
import { fetchCategories, fetchPosts, fetchLatestSeries, getFullCourseImageUrl, getFullImageUrl } from "@/lib/api";
import { Category, PaginatedPosts, Series } from "@/lib/types";
import { PostCard } from "@/components/blog/PostCard";
import { useLoading } from "@/lib/loading-context";
import { Pagination } from "@/components/common/Pagination";

function formatCourseDuration(minutes?: number) {
  if (!minutes || minutes <= 0) return null;
  if (minutes < 60) return `${minutes} phút đọc`;
  const hours = Math.floor(minutes / 60);
  const remainingMins = minutes % 60;
  if (remainingMins === 0) return `${hours} giờ đọc`;
  return `${hours} giờ ${remainingMins}p đọc`;
}

export default function HomePage() {
  const { withLoading } = useLoading();
  const [postsData, setPostsData] = useState<PaginatedPosts | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [latestSeries, setLatestSeries] = useState<Series | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(true);
  const [seriesLoading, setSeriesLoading] = useState<boolean>(true);

  const loadPosts = async (
    targetPage = currentPage,
    targetCategory = selectedCategory,
    targetSearch = searchQuery,
    overlayMessage?: string
  ) => {
    const msg =
      overlayMessage ||
      (targetSearch
        ? "Đang tìm kiếm bài viết..."
        : targetCategory
        ? "Đang lọc bài viết..."
        : targetPage > 1
        ? `Đang tải trang ${targetPage}...`
        : "Đang tải bài viết mới nhất...");

    await withLoading(async () => {
      setLoading(true);
      try {
        const data = await fetchPosts({
          page: targetPage,
          limit: 8,
          category: targetCategory || undefined,
          search: targetSearch || undefined,
        });
        // Sort by published_at or created_at descending (newest first)
        data.items = data.items.sort((a, b) => {
          const dateA = new Date(a.published_at || a.created_at).getTime();
          const dateB = new Date(b.published_at || b.created_at).getTime();
          return dateB - dateA;
        });
        setPostsData(data);
      } catch (err) {
        console.error("Lỗi tải bài viết:", err);
      } finally {
        setLoading(false);
      }
    }, msg);
  };

  useEffect(() => {
    fetchCategories().then(setCategories).catch(console.error);
    // Fetch the latest series dynamically
    fetchLatestSeries()
      .then(setLatestSeries)
      .catch(console.error)
      .finally(() => setSeriesLoading(false));
  }, []);

  useEffect(() => {
    loadPosts(
      currentPage,
      selectedCategory,
      searchQuery,
      selectedCategory
        ? "Đang lọc bài viết..."
        : currentPage > 1
        ? `Đang tải trang ${currentPage}...`
        : "Đang tải bài viết mới nhất..."
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCategory, currentPage]);

  const handleSelectCategory = (catSlug: string) => {
    if (selectedCategory === catSlug) return;
    setSelectedCategory(catSlug);
    setCurrentPage(1);
  };

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
    window.scrollTo({ top: 350, behavior: "smooth" });
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
    loadPosts(1, selectedCategory, searchQuery, "Đang tìm kiếm bài viết...");
  };

  return (
    <div className="space-y-12 pb-12">
      {/* Hero Section */}
      <section className="relative overflow-hidden rounded-3xl p-8 sm:p-12 border border-stone-200/80 dark:border-stone-800 bg-gradient-to-b from-blue-50/50 via-white to-transparent dark:from-blue-950/20 dark:via-stone-900/40 dark:to-transparent">
        <div className="max-w-3xl space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-blue-100/80 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
            <Sparkles className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            <span>Kỹ Thuật • Kiến Trúc • Trí Tuệ Nhân Tạo</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-stone-900 dark:text-white leading-[1.15]">
            Ghi chép & Khám phá <br />
            <span className="bg-gradient-to-r from-blue-600 to-indigo-500 bg-clip-text text-transparent">
              Thế giới Công nghệ.
            </span>
          </h1>

          <p className="text-base sm:text-lg text-stone-600 dark:text-stone-400 leading-relaxed">
            Chào mừng bạn đến với blog cá nhân của Phạm Hoàng Hưng. Nơi chia sẻ về cuộc sống, IT và hành trình tự học mỗi ngày.
          </p>

          {/* Search Bar */}
          <form onSubmit={handleSearchSubmit} className="pt-2 flex items-center gap-2 max-w-lg">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm kiếm bài viết hoặc chủ đề..."
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 text-sm text-stone-900 dark:text-stone-100 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all shadow-sm"
              />
            </div>
            <button
              type="submit"
              className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors shadow-sm shadow-blue-500/20 shrink-0"
            >
              Tìm kiếm
            </button>
          </form>
        </div>
      </section>

      {/* Latest Series / Course Banner — Dynamic */}
      {seriesLoading ? (
        <section className="h-28 rounded-3xl border border-stone-200 dark:border-stone-800 bg-white/50 dark:bg-stone-900/50 animate-pulse" />
      ) : latestSeries ? (
        <section className="p-6 rounded-3xl border border-blue-200/80 dark:border-blue-900/60 bg-gradient-to-r from-blue-50/70 via-indigo-50/40 to-transparent dark:from-blue-950/40 dark:via-stone-900/40 dark:to-transparent flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 overflow-hidden relative">
          {/* Subtle background image */}
          <div
            className="absolute inset-0 opacity-5 bg-cover bg-center pointer-events-none"
            style={{ backgroundImage: `url(${getFullCourseImageUrl(latestSeries.cover_image)})` }}
          />
          <div className="flex items-center gap-4 relative z-10">
            <div className="w-14 h-14 rounded-2xl overflow-hidden shadow-md shadow-blue-500/20 shrink-0 border border-blue-200/50 dark:border-blue-800/50">
              <img
                src={getFullCourseImageUrl(latestSeries.cover_image)}
                alt={latestSeries.title}
                className="w-full h-full object-cover"
              />
            </div>
            <div>
              <div className="text-[11px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider flex items-center gap-1.5">
                <GraduationCap className="w-3.5 h-3.5" />
                Khóa Học & Tuyển Tập Bài Bản • Mới nhất
              </div>
              <h3 className="font-bold text-base text-stone-900 dark:text-white mt-0.5 line-clamp-1">
                {latestSeries.title}
              </h3>
              {latestSeries.summary && (
                <p className="text-xs text-stone-500 mt-0.5 line-clamp-1">
                  {latestSeries.summary}
                </p>
              )}
              {/* Meta info: Author • Chapters & Lessons • Reading duration */}
              <div className="flex flex-wrap items-center gap-2 sm:gap-3 mt-1.5 text-[11px] text-stone-500 dark:text-stone-400">
                {/* Author */}
                {(latestSeries.author?.full_name || latestSeries.author?.username) && (
                  <>
                    <span className="inline-flex items-center gap-1.5 font-medium text-stone-700 dark:text-stone-300">
                      {latestSeries.author?.avatar_url ? (
                        <img
                          src={getFullImageUrl(latestSeries.author.avatar_url)}
                          alt={latestSeries.author.full_name || latestSeries.author.username}
                          className="w-4 h-4 rounded-full object-cover border border-stone-200 dark:border-stone-700"
                        />
                      ) : (
                        <UserIcon className="w-3.5 h-3.5 text-blue-500" />
                      )}
                      <span>
                        {latestSeries.author?.full_name || latestSeries.author?.username}
                      </span>
                    </span>

                    <span className="text-stone-300 dark:text-stone-700">•</span>
                  </>
                )}

                {/* Chapters & Lessons */}
                <span className="inline-flex items-center gap-1">
                  <BookOpen className="w-3.5 h-3.5 text-stone-400" />
                  <span>{latestSeries.total_chapters} chương • {latestSeries.total_lessons} bài</span>
                </span>

                {/* Reading Duration */}
                {formatCourseDuration(latestSeries.total_reading_time_minutes) && (
                  <>
                    <span className="text-stone-300 dark:text-stone-700">•</span>
                    <span className="inline-flex items-center gap-1" title="Tổng thời lượng đọc">
                      <Clock className="w-3.5 h-3.5 text-stone-400" />
                      <span>{formatCourseDuration(latestSeries.total_reading_time_minutes)}</span>
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          <Link
            href={`/series/${latestSeries.slug}`}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shrink-0 shadow-sm shadow-blue-500/20 transition-all relative z-10"
          >
            <span>Khám phá Outline</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </section>
      ) : null}

      {/* Category Filter Pills */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-bold text-stone-800 dark:text-stone-200">
            <Layers className="w-4 h-4 text-blue-600" />
            <span>Chủ đề bài viết</span>
          </div>
          {selectedCategory && (
            <button
              onClick={() => handleSelectCategory("")}
              className="text-xs text-blue-600 hover:underline"
            >
              Xóa bộ lọc
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => handleSelectCategory("")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all ${selectedCategory === ""
                ? "bg-stone-900 dark:bg-white text-white dark:text-stone-900 shadow-sm"
                : "bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-700"
              }`}
          >
            Tất cả bài viết
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => handleSelectCategory(cat.slug)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all ${selectedCategory === cat.slug
                  ? "bg-blue-600 text-white shadow-sm shadow-blue-500/20"
                  : "bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-700"
                }`}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </section>

      {/* Articles List */}
      <section className="space-y-6">
        <div className="flex items-center justify-between border-b border-stone-200 dark:border-stone-800 pb-3">
          <div className="flex items-center gap-2 text-sm font-bold text-stone-800 dark:text-stone-200">
            <PenLine className="w-4 h-4 text-blue-600" />
            <span>
              {selectedCategory
                ? `Bài viết trong danh mục "${categories.find((c) => c.slug === selectedCategory)?.name || selectedCategory}"`
                : "Bài viết mới nhất"}
            </span>
          </div>
          {postsData && (
            <span className="text-xs font-medium text-stone-500 dark:text-stone-400">
              {postsData.total === 0
                ? "0 bài viết"
                : `${(postsData.page - 1) * postsData.limit + 1}–${Math.min(
                    postsData.page * postsData.limit,
                    postsData.total
                  )} / ${postsData.total} bài viết`}
            </span>
          )}
        </div>

        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-44 rounded-2xl border border-stone-200 dark:border-stone-800 bg-white/50 dark:bg-stone-900/50 p-6 animate-pulse"
              />
            ))}
          </div>
        ) : postsData && postsData.items.length > 0 ? (
          <div className="grid grid-cols-1 gap-5">
            {postsData.items.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
          </div>
        ) : (
          <div className="text-center py-16 border border-dashed border-stone-200 dark:border-stone-800 rounded-3xl space-y-3">
            <div className="w-12 h-12 mx-auto rounded-full bg-stone-100 dark:bg-stone-800 flex items-center justify-center text-stone-400">
              <TagIcon className="w-6 h-6" />
            </div>
            <h3 className="font-semibold text-stone-800 dark:text-stone-200">
              Chưa tìm thấy bài viết nào
            </h3>
            <p className="text-sm text-stone-500 dark:text-stone-400 max-w-sm mx-auto">
              Thử tìm kiếm với từ khóa khác hoặc quay lại danh mục "Tất cả bài viết".
            </p>
          </div>
        )}

        {/* Pagination Controls */}
        {postsData && postsData.total_pages > 1 && (
          <div className="pt-8">
            <Pagination
              currentPage={currentPage}
              totalPages={postsData.total_pages}
              totalItems={postsData.total}
              itemsName="bài viết"
              onPageChange={handlePageChange}
              disabled={loading}
            />
          </div>
        )}
      </section>
    </div>
  );
}
