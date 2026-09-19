"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  GraduationCap,
  BookOpen,
  Clock,
  Play,
  CheckCircle2,
  Layers,
  ChevronRight,
} from "lucide-react";
import { fetchSeriesBySlug, getFullImageUrl } from "@/lib/api";
import { SeriesDetail } from "@/lib/types";

export default function SeriesDetailPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params?.slug as string;

  const [series, setSeries] = useState<SeriesDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug) return;
    fetchSeriesBySlug(slug)
      .then(setSeries)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto py-16 space-y-6 animate-pulse">
        <div className="h-6 w-32 bg-stone-200 dark:bg-stone-800 rounded-lg" />
        <div className="h-12 w-3/4 bg-stone-200 dark:bg-stone-800 rounded-xl" />
        <div className="h-48 w-full bg-stone-200 dark:bg-stone-800 rounded-3xl" />
      </div>
    );
  }

  if (!series) {
    return (
      <div className="max-w-md mx-auto py-20 text-center space-y-4">
        <h2 className="text-2xl font-bold text-stone-900 dark:text-white">
          Không tìm thấy khóa học
        </h2>
        <Link href="/series" className="inline-flex items-center gap-2 text-sm text-blue-600 hover:underline">
          <ArrowLeft className="w-4 h-4" />
          <span>Quay lại danh sách khóa học</span>
        </Link>
      </div>
    );
  }

  // Find first lesson for the "Start Course" button
  const firstLesson =
    series.chapters.length > 0 &&
    series.chapters[0].lessons &&
    series.chapters[0].lessons.length > 0
      ? series.chapters[0].lessons[0]
      : null;

  return (
    <div className="max-w-4xl mx-auto space-y-12 pb-20">
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

            {firstLesson && (
              <div className="pt-2">
                <Link
                  href={`/posts/${firstLesson.slug}`}
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold shadow-lg shadow-blue-500/25 transition-all"
                >
                  <Play className="w-4 h-4 fill-white" />
                  <span>Bắt đầu đọc (Từ Bài 1)</span>
                </Link>
              </div>
            )}
          </div>

          {series.cover_image && (
            <div className="md:col-span-4 rounded-2xl overflow-hidden shadow-md max-h-56 bg-stone-100">
              <img
                src={getFullImageUrl(series.cover_image)}
                alt={series.title}
                className="w-full h-full object-cover"
              />
            </div>
          )}
        </div>
      </section>

      {/* Course Outline / Syllabus */}
      <section className="space-y-6">
        <div className="flex items-center gap-2 border-b border-stone-200 dark:border-stone-800 pb-3">
          <Layers className="w-5 h-5 text-blue-600" />
          <h2 className="text-lg font-bold text-stone-900 dark:text-white">
            Dàn Outline Khóa Học (Curriculum)
          </h2>
        </div>

        <div className="space-y-6">
          {series.chapters.map((chapter, cIdx) => (
            <div
              key={chapter.id}
              className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900/40 overflow-hidden shadow-sm"
            >
              {/* Chapter Header */}
              <div className="p-5 bg-stone-50/70 dark:bg-stone-800/40 border-b border-stone-200 dark:border-stone-800 flex items-center justify-between">
                <div>
                  <div className="text-[11px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
                    Chương {cIdx + 1}
                  </div>
                  <h3 className="font-bold text-base text-stone-900 dark:text-white mt-0.5">
                    {chapter.title}
                  </h3>
                  {chapter.description && (
                    <p className="text-xs text-stone-500 mt-1">{chapter.description}</p>
                  )}
                </div>
                <span className="text-xs text-stone-400 font-medium">
                  {chapter.lessons?.length || 0} bài học
                </span>
              </div>

              {/* Lessons in Chapter */}
              <div className="divide-y divide-stone-100 dark:divide-stone-800/60">
                {chapter.lessons && chapter.lessons.length > 0 ? (
                  chapter.lessons.map((lesson, lIdx) => (
                    <Link
                      key={lesson.id}
                      href={`/posts/${lesson.slug}`}
                      className="group flex items-center justify-between p-4 hover:bg-stone-50 dark:hover:bg-stone-800/30 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-7 h-7 rounded-xl bg-stone-100 dark:bg-stone-800 text-stone-500 dark:text-stone-400 flex items-center justify-center text-xs font-semibold group-hover:bg-blue-600 group-hover:text-white transition-colors">
                          {cIdx + 1}.{lIdx + 1}
                        </div>
                        <span className="text-sm font-medium text-stone-800 dark:text-stone-200 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors truncate">
                          {lesson.title}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 text-xs text-stone-400 shrink-0 ml-4">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          {lesson.reading_time_minutes} phút
                        </span>
                        <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 group-hover:text-blue-600 transition-all" />
                      </div>
                    </Link>
                  ))
                ) : (
                  <div className="p-4 text-xs text-stone-400 italic">
                    Chương này đang chuẩn bị nội dung bài viết.
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
