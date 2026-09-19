"use client";

import React, { useEffect, useState } from "react";
import { Search, Sparkles, Tag as TagIcon, Layers, PenLine, GraduationCap, ArrowRight } from "lucide-react";
import Link from "next/link";
import { fetchCategories, fetchPosts } from "@/lib/api";
import { Category, PaginatedPosts, PostListItem } from "@/lib/types";
import { PostCard } from "@/components/blog/PostCard";

export default function HomePage() {
  const [postsData, setPostsData] = useState<PaginatedPosts | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(true);

  const loadPosts = async () => {
    setLoading(true);
    try {
      const data = await fetchPosts({
        page: currentPage,
        limit: 8,
        category: selectedCategory || undefined,
        search: searchQuery || undefined,
      });
      setPostsData(data);
    } catch (err) {
      console.error("Lỗi tải bài viết:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories().then(setCategories).catch(console.error);
  }, []);

  useEffect(() => {
    loadPosts();
  }, [selectedCategory, currentPage]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
    loadPosts();
  };

  return (
    <div className="space-y-12 pb-12">
      {/* Hero Section */}
      <section className="relative overflow-hidden rounded-3xl p-8 sm:p-12 border border-stone-200/80 dark:border-stone-800 bg-gradient-to-b from-blue-50/50 via-white to-transparent dark:from-blue-950/20 dark:via-stone-900/40 dark:to-transparent">
        <div className="max-w-2xl space-y-4">
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
            Chào mừng bạn đến với blog cá nhân của Hung Pham Hoang. Nơi chia sẻ kinh nghiệm phát triển phần mềm, thiết kế hệ thống, AI RAG và hành trình tự học mỗi ngày.
          </p>

          {/* Search Bar */}
          <form onSubmit={handleSearchSubmit} className="pt-2 flex items-center gap-2 max-w-md">
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

      {/* Featured Series Banner */}
      <section className="p-6 rounded-3xl border border-blue-200/80 dark:border-blue-900/60 bg-gradient-to-r from-blue-50/70 via-indigo-50/40 to-transparent dark:from-blue-950/40 dark:via-stone-900/40 dark:to-transparent flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-blue-500/20">
            <GraduationCap className="w-6 h-6" />
          </div>
          <div>
            <div className="text-[11px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
              Khóa Học & Tuyển Tập Bài Bản
            </div>
            <h3 className="font-bold text-base text-stone-900 dark:text-white">
              Prep Course: Chinh Phục AI, RAG & Kiến Trúc Hệ Thống
            </h3>
            <p className="text-xs text-stone-500 mt-0.5">
              Học theo dàn outline từng chương, từng bài như đọc một cuốn sách hoặc khóa học hoàn chỉnh.
            </p>
          </div>
        </div>

        <Link
          href="/series/prep-course-chinh-phuc-ai-va-rag"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shrink-0 shadow-sm shadow-blue-500/20 transition-all"
        >
          <span>Khám phá Outline</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </section>

      {/* Category Filter Pills */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-bold text-stone-800 dark:text-stone-200">
            <Layers className="w-4 h-4 text-blue-600" />
            <span>Chủ đề bài viết</span>
          </div>
          {selectedCategory && (
            <button
              onClick={() => setSelectedCategory("")}
              className="text-xs text-blue-600 hover:underline"
            >
              Xóa bộ lọc
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => {
              setSelectedCategory("");
              setCurrentPage(1);
            }}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all ${
              selectedCategory === ""
                ? "bg-stone-900 dark:bg-white text-white dark:text-stone-900 shadow-sm"
                : "bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-700"
            }`}
          >
            Tất cả bài viết
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => {
                setSelectedCategory(cat.slug);
                setCurrentPage(1);
              }}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all ${
                selectedCategory === cat.slug
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
            <span className="text-xs text-stone-400">
              Tổng số: {postsData.total} bài
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
          <div className="flex items-center justify-center gap-2 pt-8">
            <button
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="px-3.5 py-1.5 rounded-lg border border-stone-200 dark:border-stone-700 text-xs font-semibold disabled:opacity-40 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
            >
              Trang trước
            </button>
            <span className="text-xs text-stone-500 font-medium px-2">
              Trang {currentPage} / {postsData.total_pages}
            </span>
            <button
              disabled={currentPage >= postsData.total_pages}
              onClick={() => setCurrentPage((p) => Math.min(postsData.total_pages, p + 1))}
              className="px-3.5 py-1.5 rounded-lg border border-stone-200 dark:border-stone-700 text-xs font-semibold disabled:opacity-40 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
            >
              Trang tiếp
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
