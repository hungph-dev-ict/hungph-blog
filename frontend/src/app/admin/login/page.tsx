"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, User, ArrowRight, ShieldCheck, Crown, Sparkles, Check } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useLoading } from "@/lib/loading-context";

export default function AdminLoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const { withLoading } = useLoading();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const performLogin = async (idVal: string, passVal: string) => {
    setError("");
    setLoading(true);
    await withLoading(async () => {
      try {
        await login(idVal, passVal);
        router.push("/admin/posts");
      } catch (err: any) {
        setError(err.message || "Tên đăng nhập hoặc mật khẩu không chính xác");
      } finally {
        setLoading(false);
      }
    }, "Đang xác thực tài khoản...");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await performLogin(identifier, password);
  };

  const handleQuickLogin = (idVal: string, passVal: string) => {
    setIdentifier(idVal);
    setPassword(passVal);
    performLogin(idVal, passVal);
  };

  return (
    <div className="max-w-md mx-auto py-12 px-4 space-y-6">
      <div className="text-center space-y-2">
        <div className="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center text-white mx-auto shadow-lg shadow-blue-500/25">
          <ShieldCheck className="w-6 h-6" />
        </div>
        <h1 className="text-2xl font-bold text-stone-900 dark:text-white">
          Đăng Nhập Hệ Thống
        </h1>
        <p className="text-sm text-stone-500">
          Truy cập khu vực quản lý bài viết và điều hành nền tảng blog.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="p-7 rounded-3xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900/60 shadow-sm space-y-5"
      >
        {error && (
          <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 text-xs font-medium border border-rose-200 dark:border-rose-900">
            {error}
          </div>
        )}

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-stone-700 dark:text-stone-300">
            Tài khoản hoặc Email
          </label>
          <div className="relative">
            <User className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              required
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="admin hoặc member_demo..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-stone-700 dark:text-stone-300">
            Mật khẩu
          </label>
          <div className="relative">
            <Lock className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold flex items-center justify-center gap-2 shadow-sm shadow-blue-500/25 transition-all disabled:opacity-50"
        >
          <span>{loading ? "Đang xác thực..." : "Đăng nhập"}</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </form>

      {/* Local Demo Test Accounts Box */}
      <div className="p-5 rounded-3xl border border-blue-200/80 dark:border-blue-900/50 bg-blue-50/50 dark:bg-blue-950/20 space-y-3.5">
        <div className="flex items-center gap-2 text-xs font-bold text-blue-700 dark:text-blue-400">
          <Sparkles className="w-4 h-4" />
          <span>Tài Khoản Test Local (Phân Quyền RBAC)</span>
        </div>
        <p className="text-[11px] text-stone-500 dark:text-stone-400 leading-relaxed">
          Bấm để đăng nhập nhanh với từng vai trò nhằm kiểm tra phân quyền &amp; màn hình 404:
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {/* Admin Role Demo Button */}
          <button
            type="button"
            disabled={loading}
            onClick={() => handleQuickLogin("admin", "Admin@123456")}
            className="p-3 rounded-2xl border border-purple-200 dark:border-purple-900 bg-white/80 dark:bg-stone-900/80 hover:bg-purple-50 dark:hover:bg-purple-950/40 text-left transition-all group"
          >
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1.5 font-bold text-xs text-purple-700 dark:text-purple-300">
                <Crown className="w-3.5 h-3.5" />
                <span>Admin</span>
              </div>
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 font-bold uppercase">
                Toàn quyền
              </span>
            </div>
            <div className="text-[11px] text-stone-600 dark:text-stone-300 font-mono">
              user: <span className="font-semibold text-stone-900 dark:text-white">admin</span>
            </div>
            <div className="text-[10px] text-stone-400 font-mono">pass: Admin@123456</div>
            <div className="mt-2 text-[10px] text-purple-600 font-medium group-hover:underline">
              ⚡ Bấm đăng nhập ngay →
            </div>
          </button>

          {/* Member Role Demo Button */}
          <button
            type="button"
            disabled={loading}
            onClick={() => handleQuickLogin("member_demo", "Member@123456")}
            className="p-3 rounded-2xl border border-blue-200 dark:border-blue-900 bg-white/80 dark:bg-stone-900/80 hover:bg-blue-50 dark:hover:bg-blue-950/40 text-left transition-all group"
          >
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1.5 font-bold text-xs text-blue-700 dark:text-blue-300">
                <User className="w-3.5 h-3.5" />
                <span>Thành viên</span>
              </div>
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-bold uppercase">
                Member
              </span>
            </div>
            <div className="text-[11px] text-stone-600 dark:text-stone-300 font-mono">
              user: <span className="font-semibold text-stone-900 dark:text-white">member_demo</span>
            </div>
            <div className="text-[10px] text-stone-400 font-mono">pass: Member@123456</div>
            <div className="mt-2 text-[10px] text-blue-600 font-medium group-hover:underline">
              ⚡ Bấm đăng nhập ngay →
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
