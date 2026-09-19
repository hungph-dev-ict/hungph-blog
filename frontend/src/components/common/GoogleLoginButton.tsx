"use client";

import React, { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { User } from "lucide-react";

declare global {
  interface Window {
    google?: any;
  }
}

interface GoogleLoginButtonProps {
  onSuccess?: () => void;
  className?: string;
  buttonText?: string;
}

export const GoogleLoginButton: React.FC<GoogleLoginButtonProps> = ({
  onSuccess,
  className = "",
  buttonText = "Đăng nhập bằng Google",
}) => {
  const { loginGoogle } = useAuth();
  const googleBtnContainerRef = useRef<HTMLDivElement>(null);
  const [googleLoaded, setGoogleLoaded] = useState(false);
  const [showFallbackModal, setShowFallbackModal] = useState(false);
  const [fallbackEmail, setFallbackEmail] = useState("");
  const [fallbackName, setFallbackName] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";

  useEffect(() => {
    // Load Google Identity Services script
    if (typeof window === "undefined") return;

    if (window.google?.accounts?.id) {
      setGoogleLoaded(true);
      return;
    }

    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => {
      setGoogleLoaded(true);
    };
    document.head.appendChild(script);
  }, []);

  useEffect(() => {
    if (!googleLoaded || !clientId || !window.google?.accounts?.id) return;

    try {
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: async (response: any) => {
          if (response?.credential) {
            setLoading(true);
            try {
              await loginGoogle({ credential: response.credential });
              if (onSuccess) onSuccess();
            } catch (err: any) {
              alert(`Lỗi đăng nhập Google: ${err.message}`);
            } finally {
              setLoading(false);
            }
          }
        },
        auto_select: false,
        cancel_on_tap_outside: true,
      });

      if (googleBtnContainerRef.current) {
        googleBtnContainerRef.current.innerHTML = "";
        window.google.accounts.id.renderButton(googleBtnContainerRef.current, {
          type: "standard",
          shape: "pill",
          theme: "outline",
          text: "signin_with",
          size: "medium",
          logo_alignment: "left",
        });
      }
    } catch (e) {
      console.warn("Google SSO Init warning:", e);
    }
  }, [googleLoaded, clientId, loginGoogle, onSuccess]);

  const handleCustomClick = () => {
    if (clientId && window.google?.accounts?.id) {
      window.google.accounts.id.prompt();
    } else {
      setShowFallbackModal(true);
    }
  };

  const handleFallbackSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    const email = fallbackEmail.trim().toLowerCase();
    if (!email || !email.includes("@")) {
      setErrorMsg("Vui lòng nhập email hợp lệ!");
      return;
    }

    setLoading(true);
    try {
      await loginGoogle({
        email,
        name: fallbackName.trim() || email.split("@")[0],
      });
      setShowFallbackModal(false);
      setFallbackEmail("");
      setFallbackName("");
      if (onSuccess) onSuccess();
    } catch (err: any) {
      setErrorMsg(err.message || "Đăng nhập thất bại");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {clientId ? (
        <div className="inline-block">
          {/* Container nơi Google tự render nút chuẩn */}
          <div ref={googleBtnContainerRef} />
        </div>
      ) : (
        <button
          type="button"
          onClick={handleCustomClick}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 hover:border-blue-500 text-xs font-semibold text-stone-700 dark:text-stone-300 shadow-sm hover:shadow transition-all ${className}`}
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
            />
          </svg>
          <span>{loading ? "Đang xác thực..." : buttonText}</span>
        </button>
      )}

      {/* Fallback modal khi chưa cấu hình GOOGLE_CLIENT_ID trên môi trường */}
      {showFallbackModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-stone-900 rounded-3xl p-6 max-w-sm w-full border border-stone-200 dark:border-stone-800 shadow-2xl space-y-4">
            <div className="text-center space-y-1">
              <div className="w-10 h-10 rounded-2xl bg-blue-50 dark:bg-blue-950/60 flex items-center justify-center mx-auto text-blue-600 mb-2">
                <User className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-base text-stone-900 dark:text-white">
                Đăng Nhập Google SSO
              </h3>
              <p className="text-xs text-stone-500">
                Nhập địa chỉ Gmail để đăng nhập vào hệ thống ngay lập tức (phân quyền Admin & Member tự động).
              </p>
            </div>

            {errorMsg && (
              <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 text-xs border border-rose-200 dark:border-rose-900">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleFallbackSubmit} className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-stone-700 dark:text-stone-300">
                  Địa chỉ Gmail *
                </label>
                <input
                  type="email"
                  required
                  value={fallbackEmail}
                  onChange={(e) => setFallbackEmail(e.target.value)}
                  placeholder="name@gmail.com"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-stone-700 dark:text-stone-300">
                  Họ tên hiển thị
                </label>
                <input
                  type="text"
                  value={fallbackName}
                  onChange={(e) => setFallbackName(e.target.value)}
                  placeholder="Ví dụ: Hoàng Hùng..."
                  className="w-full px-3 py-2 text-xs rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 text-[11px] text-amber-800 dark:text-amber-300">
                💡 Để bật nút Google 1-Click SSO chính thức, bạn chỉ cần gán biến <code>NEXT_PUBLIC_GOOGLE_CLIENT_ID</code> trên Vercel.
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowFallbackModal(false)}
                  className="px-3 py-2 text-xs text-stone-400 hover:text-stone-600"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold transition-colors"
                >
                  {loading ? "Đang xác thực..." : "Đăng nhập ngay"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
