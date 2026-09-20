"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Home, FileText, ShieldAlert } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

interface NotFoundStateProps {
  title?: string;
  description?: string;
  showBack?: boolean;
}

export const NotFoundState: React.FC<NotFoundStateProps> = ({
  title = "Trang Không Tồn Tại",
  description = "Đường dẫn bạn yêu cầu không tồn tại, đã bị gỡ bỏ hoặc bạn không có quyền truy cập vào nội dung này.",
  showBack = true,
}) => {
  const router = useRouter();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin" || user?.is_admin;

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4 py-16">
      <div className="max-w-md w-full text-center space-y-6">
        {/* Glow ambient background & Badge */}
        <div className="relative inline-flex items-center justify-center">
          <div className="absolute inset-0 bg-gradient-to-tr from-purple-500/20 via-blue-500/20 to-amber-500/20 blur-2xl rounded-full" />
          <div className="relative w-20 h-20 rounded-3xl bg-white dark:bg-stone-900 border border-stone-200/80 dark:border-stone-800 shadow-xl shadow-stone-200/50 dark:shadow-none flex items-center justify-center">
            <ShieldAlert className="w-10 h-10 text-stone-400 dark:text-stone-500" />
          </div>
        </div>

        <div className="space-y-2">
          <div className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-stone-100 dark:bg-stone-800/80 text-stone-600 dark:text-stone-300 text-xs font-bold tracking-wider uppercase border border-stone-200 dark:border-stone-700">
            404 • Not Found
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-stone-900 dark:text-white tracking-tight">
            {title}
          </h1>
          <p className="text-xs sm:text-sm text-stone-500 dark:text-stone-400 leading-relaxed max-w-sm mx-auto">
            {description}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center justify-center gap-2.5 pt-2">
          {showBack && (
            <button
              onClick={() => router.back()}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-stone-200 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-700 dark:text-stone-200 text-xs font-semibold transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Quay lại</span>
            </button>
          )}

          <Link
            href="/"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-all shadow-sm shadow-blue-500/20"
          >
            <Home className="w-3.5 h-3.5" />
            <span>Về trang chủ</span>
          </Link>

          {user && (
            <Link
              href="/admin/posts"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-stone-200 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-700 dark:text-stone-200 text-xs font-semibold transition-colors"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>{isAdmin ? "Quản lý bài viết" : "Bài viết của tôi"}</span>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
};
