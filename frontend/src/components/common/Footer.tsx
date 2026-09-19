"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Globe, Heart, Code2, Clock } from "lucide-react";

export const Footer: React.FC = () => {
  const [times, setTimes] = useState<{ tokyo: string; hanoi: string; dateTokyo: string; dateHanoi: string }>({
    tokyo: "--:--:--",
    hanoi: "--:--:--",
    dateTokyo: "",
    dateHanoi: "",
  });

  useEffect(() => {
    const updateTimes = () => {
      const now = new Date();
      const timeFmt: Intl.DateTimeFormatOptions = {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      };
      const dateFmt: Intl.DateTimeFormatOptions = {
        weekday: "short",
        day: "numeric",
        month: "short",
      };

      setTimes({
        tokyo: new Intl.DateTimeFormat("en-GB", { ...timeFmt, timeZone: "Asia/Tokyo" }).format(now),
        hanoi: new Intl.DateTimeFormat("en-GB", { ...timeFmt, timeZone: "Asia/Bangkok" }).format(now),
        dateTokyo: new Intl.DateTimeFormat("vi-VN", { ...dateFmt, timeZone: "Asia/Tokyo" }).format(now),
        dateHanoi: new Intl.DateTimeFormat("vi-VN", { ...dateFmt, timeZone: "Asia/Bangkok" }).format(now),
      });
    };

    updateTimes();
    const interval = setInterval(updateTimes, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <footer className="border-t border-stone-200 dark:border-stone-800 bg-white/50 dark:bg-stone-900/50 mt-20 transition-colors">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
          {/* Col 1 */}
          <div className="space-y-3">
            <div className="font-bold text-lg text-stone-900 dark:text-white">
              HungPH<span className="text-blue-600">.</span>blog
            </div>
            <p className="text-sm text-stone-500 dark:text-stone-400 leading-relaxed">
              Không gian cá nhân ghi chép về kỹ thuật phần mềm, thiết kế hệ thống, AI, và những suy tư hàng ngày.
            </p>
            <div className="flex items-center gap-3 text-stone-400">
              <a
                href="https://github.com/hungph-dev-ict/hungph-blog"
                target="_blank"
                rel="noreferrer"
                className="hover:text-stone-900 dark:hover:text-white transition-colors"
                aria-label="Code Repository"
              >
                <Code2 className="w-4 h-4" />
              </a>
              <a
                href="https://hungph.dev"
                target="_blank"
                rel="noreferrer"
                className="hover:text-blue-500 transition-colors"
                aria-label="Website"
              >
                <Globe className="w-4 h-4" />
              </a>
            </div>
          </div>

          {/* Col 2 */}
          <div className="space-y-2 text-sm">
            <div className="font-semibold text-stone-900 dark:text-white">Khám phá</div>
            <ul className="space-y-1.5 text-stone-600 dark:text-stone-400">
              <li>
                <Link href="/" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                  Tất cả bài viết
                </Link>
              </li>
              <li>
                <Link href="/series" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                  Khóa học & Tuyển tập
                </Link>
              </li>
              <li>
                <Link href="/categories" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                  Danh mục chủ đề
                </Link>
              </li>
              <li>
                <Link href="/rag" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                  Trợ lý AI (RAG Assistant)
                </Link>
              </li>
            </ul>
          </div>

          {/* Col 3: Tokyo & Hanoi World Clocks */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="font-semibold text-sm text-stone-900 dark:text-white flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span>Múi Giờ Hiện Tại</span>
              </div>
              <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live
              </span>
            </div>

            <div className="p-3.5 rounded-2xl border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-800/40 text-xs space-y-3">
              {/* Tokyo */}
              <div className="flex items-center justify-between border-b border-stone-200/60 dark:border-stone-700/60 pb-2">
                <div>
                  <div className="font-medium text-stone-800 dark:text-stone-200 flex items-center gap-1.5">
                    <span>🇯🇵</span>
                    <span>Tokyo, Nhật Bản</span>
                  </div>
                  <div className="text-[10px] text-stone-400">JST (UTC+9) • {times.dateTokyo}</div>
                </div>
                <div className="font-mono font-bold text-sm text-blue-600 dark:text-blue-400 tabular-nums">
                  {times.tokyo}
                </div>
              </div>

              {/* Hanoi */}
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium text-stone-800 dark:text-stone-200 flex items-center gap-1.5">
                    <span>🇻🇳</span>
                    <span>Hà Nội, Việt Nam</span>
                  </div>
                  <div className="text-[10px] text-stone-400">ICT (UTC+7) • {times.dateHanoi}</div>
                </div>
                <div className="font-mono font-bold text-sm text-emerald-600 dark:text-emerald-400 tabular-nums">
                  {times.hanoi}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="pt-8 border-t border-stone-200 dark:border-stone-800 flex flex-col sm:flex-row items-center justify-between text-xs text-stone-400 gap-4">
          <p>© {new Date().getFullYear()} Hung Pham Hoang. All rights reserved.</p>
          <p className="flex items-center gap-1">
            Built with <Heart className="w-3 h-3 text-rose-500 fill-rose-500" /> for reading & writing.
          </p>
        </div>
      </div>
    </footer>
  );
};
