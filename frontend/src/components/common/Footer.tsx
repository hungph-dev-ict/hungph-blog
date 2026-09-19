import React from "react";
import Link from "next/link";
import { Globe, Heart, Share2, Code2 } from "lucide-react";

export const Footer: React.FC = () => {
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
                href="https://github.com"
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
                <Link href="/categories" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                  Danh mục & Thẻ
                </Link>
              </li>
              <li>
                <Link href="/rag" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                  Trợ lý AI (RAG Assistant)
                </Link>
              </li>
              <li>
                <Link href="/utilities" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                  Tiện ích cá nhân
                </Link>
              </li>
            </ul>
          </div>

          {/* Col 3: Architecture Badge */}
          <div className="space-y-3">
            <div className="font-semibold text-sm text-stone-900 dark:text-white">Kiến trúc hệ thống</div>
            <div className="p-3.5 rounded-xl border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-800/40 text-xs space-y-1.5 text-stone-600 dark:text-stone-300">
              <div className="flex items-center justify-between">
                <span>Frontend:</span>
                <span className="font-semibold text-blue-600 dark:text-blue-400">Next.js (Vercel)</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Backend:</span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">FastAPI (Render)</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Database:</span>
                <span className="font-semibold text-purple-600 dark:text-purple-400">PostgreSQL (pgvector)</span>
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
