"use client";

import React, { useState } from "react";
import { Wrench, Type, Link as LinkIcon, Code2, Copy, Check } from "lucide-react";
import { analyzeText } from "@/lib/api";
import { Breadcrumbs } from "@/components/common/Breadcrumbs";

export default function UtilitiesPage() {
  // Text Stats Tool
  const [inputText, setInputText] = useState("");
  const [stats, setStats] = useState<any>(null);

  // Slug Generator Tool
  const [rawTitle, setRawTitle] = useState("");
  const [slugOutput, setSlugOutput] = useState("");
  const [copied, setCopied] = useState(false);

  const handleAnalyze = async (val: string) => {
    setInputText(val);
    if (!val.trim()) {
      setStats(null);
      return;
    }
    try {
      const res = await analyzeText(val);
      setStats(res);
    } catch {
      // fallback local calculation
      const words = val.trim().split(/\s+/).filter(Boolean).length;
      setStats({
        characters: val.length,
        words,
        sentences: val.split(/[.!?]+/).filter(Boolean).length,
        paragraphs: val.split(/\n+/).filter(Boolean).length,
        reading_time_minutes: Math.ceil(words / 200),
      });
    }
  };

  const handleGenerateSlug = (val: string) => {
    setRawTitle(val);
    const generated = val
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[đĐ]/g, "d")
      .replace(/[^a-z0-9\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-");
    setSlugOutput(generated);
  };

  const copySlug = () => {
    navigator.clipboard.writeText(slugOutput);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6 pb-16">
      <Breadcrumbs items={[{ label: "Tiện Ích Cá Nhân (Utilities)" }]} />

      <div className="space-y-3">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
          <Wrench className="w-3.5 h-3.5" />
          <span>Tiện Ích Cá Nhân (Utilities)</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-stone-900 dark:text-white">
          Bộ Công Cụ Tiện Ích
        </h1>
        <p className="text-stone-600 dark:text-stone-400">
          Các tiện ích nhỏ hỗ trợ cho quá trình viết lách, tối ưu bài viết và làm việc hàng ngày.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Tool 1: Text & Read Time Analyzer */}
        <div className="p-6 rounded-3xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900/60 space-y-4 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-bold text-stone-900 dark:text-white">
            <Type className="w-4 h-4 text-blue-600" />
            <span>Phân tích văn bản & Thời lượng đọc</span>
          </div>
          <textarea
            rows={5}
            value={inputText}
            onChange={(e) => handleAnalyze(e.target.value)}
            placeholder="Dán hoặc nhập đoạn văn bản của bạn vào đây để phân tích..."
            className="w-full p-3 text-sm rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800/60 text-stone-900 dark:text-stone-100 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />

          {stats && (
            <div className="grid grid-cols-2 gap-3 pt-2">
              <div className="p-3 rounded-xl bg-stone-50 dark:bg-stone-800/80 text-center">
                <div className="text-2xl font-bold text-blue-600">{stats.words}</div>
                <div className="text-xs text-stone-500">Số từ</div>
              </div>
              <div className="p-3 rounded-xl bg-stone-50 dark:bg-stone-800/80 text-center">
                <div className="text-2xl font-bold text-emerald-600">~{stats.reading_time_minutes} phút</div>
                <div className="text-xs text-stone-500">Thời gian đọc</div>
              </div>
              <div className="p-3 rounded-xl bg-stone-50 dark:bg-stone-800/80 text-center">
                <div className="text-lg font-bold text-stone-700 dark:text-stone-300">{stats.characters}</div>
                <div className="text-xs text-stone-500">Ký tự</div>
              </div>
              <div className="p-3 rounded-xl bg-stone-50 dark:bg-stone-800/80 text-center">
                <div className="text-lg font-bold text-stone-700 dark:text-stone-300">{stats.paragraphs}</div>
                <div className="text-xs text-stone-500">Đoạn văn</div>
              </div>
            </div>
          )}
        </div>

        {/* Tool 2: Slug Generator */}
        <div className="p-6 rounded-3xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900/60 space-y-4 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-bold text-stone-900 dark:text-white">
            <LinkIcon className="w-4 h-4 text-indigo-600" />
            <span>Tạo URL Slug Chuẩn SEO Tiếng Việt</span>
          </div>
          <input
            type="text"
            value={rawTitle}
            onChange={(e) => handleGenerateSlug(e.target.value)}
            placeholder="Nhập tiêu đề tiếng Việt có dấu..."
            className="w-full p-3 text-sm rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800/60 text-stone-900 dark:text-stone-100 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />

          {slugOutput && (
            <div className="space-y-2 pt-2">
              <div className="text-xs font-semibold text-stone-500">Kết quả Slug:</div>
              <div className="flex items-center gap-2 p-3 rounded-xl bg-stone-100 dark:bg-stone-800 text-xs font-mono text-stone-800 dark:text-stone-200 overflow-x-auto">
                <span className="flex-1 truncate">{slugOutput}</span>
                <button
                  onClick={copySlug}
                  className="p-1.5 rounded-lg hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors"
                  title="Sao chép"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          )}

          <div className="p-4 rounded-xl border border-dashed border-stone-200 dark:border-stone-800 text-xs text-stone-500 leading-relaxed">
            Hỗ trợ xử lý ký tự đặc biệt, tự động chuyển đổi chữ đ/Đ thành d và loại bỏ các dấu thanh tiếng Việt để tối ưu URL bài viết.
          </div>
        </div>
      </div>
    </div>
  );
}
