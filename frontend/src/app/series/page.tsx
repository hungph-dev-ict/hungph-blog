"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { GraduationCap, BookOpen, Layers, ArrowRight, Clock } from "lucide-react";
import { fetchSeries, getFullImageUrl } from "@/lib/api";
import { Series } from "@/lib/types";

export default function SeriesListPage() {
  const [seriesList, setSeriesList] = useState<Series[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSeries()
      .then(setSeriesList)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="w-full space-y-12 pb-16">
      {/* Header */}
      <div className="space-y-4 max-w-3xl">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
          <GraduationCap className="w-4 h-4" />
          <span>Lộ Trình Học & Tuyển Tập</span>
        </div>
        <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-stone-900 dark:text-white">
          Khóa Học & Series
        </h1>
        <p className="text-base sm:text-lg text-stone-600 dark:text-stone-400 leading-relaxed">
          Các bài viết được đóng gói theo từng chương, từng bài học bài bản (Prep Course) giúp bạn tiếp thu kiến thức một cách có hệ thống như đọc một cuốn sách hoặc khóa học.
        </p>
      </div>

      {/* Series Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-pulse">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-64 rounded-3xl bg-stone-100 dark:bg-stone-800" />
          ))}
        </div>
      ) : seriesList.length === 0 ? (
        <div className="p-16 text-center border border-dashed border-stone-200 dark:border-stone-800 rounded-3xl space-y-3">
          <BookOpen className="w-12 h-12 mx-auto text-stone-400" />
          <h3 className="font-bold text-stone-800 dark:text-stone-200">Chưa có khóa học nào được xuất bản</h3>
          <p className="text-xs text-stone-500">Hãy đón chờ những series tiếp theo nhé!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {seriesList.map((series) => (
            <div
              key={series.id}
              className="group relative flex flex-col rounded-3xl border border-stone-200/80 dark:border-stone-800 bg-white dark:bg-stone-900/60 overflow-hidden shadow-sm hover:shadow-xl hover:border-blue-500/50 transition-all duration-300"
            >
              {/* Cover Image */}
              {series.cover_image && (
                <Link href={`/series/${series.slug}`} className="h-52 overflow-hidden block relative bg-stone-100 dark:bg-stone-800">
                  <img
                    src={getFullImageUrl(series.cover_image)}
                    alt={series.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                  <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between text-white text-xs font-semibold">
                    <span className="px-2.5 py-1 rounded-full bg-blue-600/90 backdrop-blur-md">
                      {series.total_chapters} chương • {series.total_lessons} bài học
                    </span>
                    {series.category && (
                      <span className="px-2.5 py-1 rounded-full bg-black/40 backdrop-blur-md">
                        {series.category.name}
                      </span>
                    )}
                  </div>
                </Link>
              )}

              {/* Content */}
              <div className="p-6 flex-1 flex flex-col justify-between space-y-4">
                <div className="space-y-2">
                  <h2 className="text-xl font-bold text-stone-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                    <Link href={`/series/${series.slug}`}>{series.title}</Link>
                  </h2>
                  {series.summary && (
                    <p className="text-sm text-stone-600 dark:text-stone-400 line-clamp-3 leading-relaxed">
                      {series.summary}
                    </p>
                  )}
                </div>

                <div className="pt-4 border-t border-stone-100 dark:border-stone-800 flex items-center justify-between">
                  <span className="text-xs text-stone-400 flex items-center gap-1">
                    <Layers className="w-3.5 h-3.5" />
                    Lộ trình outline hoàn chỉnh
                  </span>
                  <Link
                    href={`/series/${series.slug}`}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 dark:text-blue-400 group-hover:translate-x-1 transition-transform"
                  >
                    <span>Xem lộ trình</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
