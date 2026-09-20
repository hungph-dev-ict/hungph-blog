"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Lock,
  User,
  ArrowRight,
  KeyRound,
  Mail,
  ArrowLeft,
  Loader2,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useLoading } from "@/lib/loading-context";
import { GoogleLoginButton } from "@/components/common/GoogleLoginButton";

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, login } = useAuth();
  const { withLoading } = useLoading();

  const [activeTab, setActiveTab] = useState<"google" | "password">("google");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const redirectUrl = searchParams?.get("redirect");

  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      if (redirectUrl) {
        router.replace(redirectUrl);
      } else if (user.role === "admin" || user.is_admin) {
        router.replace("/admin/posts");
      } else {
        router.replace("/posts/manage");
      }
    }
  }, [user, router, redirectUrl]);

  const handlePostLoginRedirect = (loggedInUser?: any) => {
    if (redirectUrl) {
      router.push(redirectUrl);
      return;
    }
    const targetUser = loggedInUser || user;
    if (targetUser?.role === "admin" || targetUser?.is_admin) {
      router.push("/admin/posts");
    } else {
      router.push("/posts/manage");
    }
  };

  const performPasswordLogin = async (idVal: string, passVal: string) => {
    setError("");
    setLoading(true);
    await withLoading(async () => {
      try {
        const loggedUser = await login(idVal, passVal);
        handlePostLoginRedirect(loggedUser);
      } catch (err: any) {
        setError(err.message || "Tên đăng nhập hoặc mật khẩu không chính xác");
      } finally {
        setLoading(false);
      }
    }, "Đang xác thực tài khoản...");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await performPasswordLogin(identifier, password);
  };

  return (
    <div className="max-w-md mx-auto py-12 px-4 space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs text-stone-500 hover:text-stone-900 dark:hover:text-stone-100 transition-colors mb-2"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Về trang chủ</span>
        </Link>

        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white mx-auto shadow-lg shadow-blue-500/25">
          <KeyRound className="w-6 h-6" />
        </div>
        <h1 className="text-2xl font-bold text-stone-900 dark:text-white tracking-tight">
          Đăng Nhập
        </h1>
        <p className="text-xs text-stone-500 max-w-xs mx-auto">
          Đăng nhập để viết bài, bình luận, và theo dõi các khóa học trên Hưng Phạm Blog.
        </p>
      </div>

      {/* Mode Switcher Tabs */}
      <div className="p-1 rounded-2xl bg-stone-100 dark:bg-stone-800/80 grid grid-cols-2 gap-1 text-xs font-semibold">
        <button
          type="button"
          onClick={() => setActiveTab("google")}
          className={`py-2 px-3 rounded-xl transition-all flex items-center justify-center gap-2 ${activeTab === "google"
              ? "bg-white dark:bg-stone-900 text-stone-900 dark:text-white shadow-sm"
              : "text-stone-500 hover:text-stone-800 dark:hover:text-stone-300"
            }`}
        >
          <Mail className="w-3.5 h-3.5 text-rose-500" />
          <span>Google (Gmail)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("password")}
          className={`py-2 px-3 rounded-xl transition-all flex items-center justify-center gap-2 ${activeTab === "password"
              ? "bg-white dark:bg-stone-900 text-stone-900 dark:text-white shadow-sm"
              : "text-stone-500 hover:text-stone-800 dark:hover:text-stone-300"
            }`}
        >
          <Lock className="w-3.5 h-3.5 text-blue-600" />
          <span>Tài khoản mật khẩu</span>
        </button>
      </div>

      {/* Mode 1: Google (Gmail) Login */}
      {activeTab === "google" && (
        <div className="p-7 rounded-3xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900/60 shadow-sm space-y-5 text-center">
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-stone-900 dark:text-stone-100">
              Đăng nhập 1 chạm với Google
            </h3>
            <p className="text-xs text-stone-500">
              Sử dụng tài khoản Gmail của bạn để truy cập an toàn và nhanh chóng.
            </p>
          </div>

          <div className="pt-2 flex justify-center">
            <GoogleLoginButton
              buttonText="Tiếp tục với Google"
              onSuccess={() => handlePostLoginRedirect()}
            />
          </div>

          <div className="pt-3 border-t border-stone-100 dark:border-stone-800/80 text-[11px] text-stone-400">
            Dành cho tất cả độc giả và thành viên hệ thống
          </div>
        </div>
      )}

      {/* Mode 2: Username & Password Login */}
      {activeTab === "password" && (
        <form
          onSubmit={handleSubmit}
          className="p-7 rounded-3xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900/60 shadow-sm space-y-4"
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
                placeholder="Nhập tên đăng nhập..."
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
      )}
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[50vh] flex flex-col items-center justify-center gap-3 text-stone-400 py-20">
          <Loader2 className="w-7 h-7 animate-spin text-blue-600" />
          <span className="text-xs font-medium">Đang tải trang đăng nhập...</span>
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
