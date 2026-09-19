"use client";

import React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  GraduationCap,
  BookOpen,
  Play,
  CheckCircle2,
  ChevronRight,
} from "lucide-react";
import { getFullImageUrl } from "@/lib/api";
import { SeriesDetail } from "@/lib/types";

interface SeriesDetailClientProps {
  initialSeries: SeriesDetail;
}

export const SeriesDetailClient: React.FC<SeriesDetailClientProps> = ({ initialSeries: series }) => {
  const router = useRouter();

  // Find first lesson for the "Start Course" button
  const firstLesson =
    series.chapters.length > 0 &&
    series.chapters[0].lessons &&
    series.chapters[0].lessons.length > 0
      ? series.chapters[0].lessons[0]
      : null;

  return (
    <div className="w-full space-y-12 pb-20">
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
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-md shadow-blue-500/20 transition-all hover:scale-[1.02]"
                >
                  <Play className="w-4 h-4 fill-white" />
                  <span>Bắt đầu học (Bài 1: {firstLesson.title})</span>
                </Link>
              </div>
            )}
          </div>

          {/* Cover image or illustration */}
          <div className="md:col-span-4 flex justify-center">
            {series.cover_image ? (
              <img
                src={getFullImageUrl(series.cover_image)}
                alt={series.title}
                className="w-full max-w-[280px] h-48 object-cover rounded-2xl shadow-md border border-stone-200 dark:border-stone-800"
              />
            ) : (
              <div className="w-44 h-44 rounded-3xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white shadow-xl">
                <GraduationCap className="w-20 h-20 opacity-80" />
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Chapters & Lessons Syllabus */}
      <section className="space-y-6">
        <div className="flex items-center justify-between border-b border-stone-200 dark:border-stone-800 pb-3">
          <div className="flex items-center gap-2 font-bold text-lg text-stone-900 dark:text-white">
            <BookOpen className="w-5 h-5 text-blue-600" />
            <span>Đề Cương Chi Tiết ({series.chapters.length} Chương)</span>
          </div>
        </div>

        <div className="space-y-4">
          {series.chapters.map((chapter, index) => (
            <div
              key={chapter.id}
              className="rounded-2xl border border-stone-200/80 dark:border-stone-800 bg-white dark:bg-stone-900/40 p-6 space-y-4"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
                    Chương {index + 1}
                  </div>
                  <h2 className="text-lg font-bold text-stone-900 dark:text-white">
                    {chapter.title}
                  </h2>
                  {chapter.description && (
                    <p className="text-xs text-stone-500 dark:text-stone-400">
                      {chapter.description}
                    </p>
                  )}
                </div>
                <span className="text-xs font-medium text-stone-400 shrink-0">
                  {chapter.lessons?.length || 0} bài học
                </span>
              </div>

              {/* Lessons in this chapter */}
              {chapter.lessons && chapter.lessons.length > 0 ? (
                <div className="grid grid-cols-1 gap-2 pt-2 border-t border-stone-100 dark:border-stone-800">
                  {chapter.lessons.map((lesson, lIdx) => (
                    <Link
                      key={lesson.id}
                      href={`/posts/${lesson.slug}`}
                      className="group flex items-center justify-between p-3 rounded-xl hover:bg-stone-50 dark:hover:bg-stone-800/60 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <CheckCircle2 className="w-4 h-4 text-stone-300 dark:text-stone-600 group-hover:text-blue-500 transition-colors" />
                        <div>
                          <span className="text-xs text-stone-400 mr-2 font-medium">
                            {index + 1}.{lIdx + 1}
                          </span>
                          <span className="text-sm font-medium text-stone-800 dark:text-stone-200 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                            {lesson.title}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {lesson.reading_time_minutes > 0 && (
                          <span className="text-[11px] text-stone-400 hidden sm:inline">
                            {lesson.reading_time_minutes} phút
                          </span>
                        )}
                        <ChevronRight className="w-4 h-4 text-stone-400 group-hover:translate-x-0.5 transition-transform" />
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="text-xs italic text-stone-400 pt-2">
                  Chưa có bài học nào được thêm vào chương này.
                </p>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};
