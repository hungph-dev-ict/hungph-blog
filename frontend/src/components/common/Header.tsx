"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import {
  Bell,
  BookOpen,
  Compass,
  GraduationCap,
  Moon,
  PenTool,
  Sun,
  LogOut,
  Flag,
} from "lucide-react";
import { GoogleLoginButton } from "./GoogleLoginButton";
import { getUnreadCount, getNotifications, markAllNotificationsRead, markNotificationRead } from "@/lib/api";
import { Notification } from "@/lib/types";

const NOTIF_ICONS: Record<string, string> = {
  collab_request: "🤝",
  collab_accepted: "✅",
  collab_rejected: "❌",
  new_follower: "👤",
  new_post: "📝",
};

export const Header: React.FC = () => {
  const pathname = usePathname();
  const router = useRouter();
  const { user, token, logout } = useAuth();
  const [isDark, setIsDark] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifs, setShowNotifs] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const notifRef = useRef<HTMLDivElement>(null);

  const handleLogout = () => {
    logout();
    router.push("/");
  };

  useEffect(() => {
    const savedTheme = localStorage.getItem("theme");
    const systemPrefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    if (savedTheme === "dark" || (!savedTheme && systemPrefersDark)) {
      document.documentElement.classList.add("dark");
      setIsDark(true);
    } else {
      document.documentElement.classList.remove("dark");
      setIsDark(false);
    }
  }, []);

  // Poll unread notifications count every 30s
  useEffect(() => {
    if (!user || !token) return;
    const fetchCount = async () => {
      try {
        const count = await getUnreadCount(token);
        setUnreadCount(count);
      } catch {}
    };
    fetchCount();
    const interval = setInterval(fetchCount, 30000);
    return () => clearInterval(interval);
  }, [user, token]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotifs(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleOpenNotifs = async () => {
    if (!token) return;
    setShowNotifs((v) => !v);
    if (!showNotifs) {
      try {
        const notifs = await getNotifications(token, 10);
        setNotifications(notifs);
        if (unreadCount > 0) {
          await markAllNotificationsRead(token);
          setUnreadCount(0);
        }
      } catch {}
    }
  };

  const handleNotificationClick = (n: Notification) => {
    setShowNotifs(false);
    if (n.type === "collab_request" && n.target_id) {
      if (user?.is_admin || user?.role === "admin") {
        router.push(`/admin/series?id=${n.target_id}&tab=collaborators`);
      } else {
        router.push(`/series?id=${n.target_id}&tab=collaborators`);
      }
    } else if (n.type === "collab_accepted" && n.target_id) {
      router.push(`/series?id=${n.target_id}`);
    } else if (n.type === "new_post" && n.target_id) {
      router.push(`/posts/${n.target_id}`);
    }
  };

  const toggleTheme = () => {
    if (isDark) {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
      setIsDark(false);
    } else {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
      setIsDark(true);
    }
  };

  const navLinks = [
    { href: "/", label: "Bài viết", icon: BookOpen },
    { href: "/series", label: "Khóa học / Series", icon: GraduationCap, badge: "Outline" },
    { href: "/categories", label: "Chủ đề", icon: Compass },
  ];

  const isAdmin = user?.role === "admin" || user?.is_admin;

  return (
    <header className="sticky top-0 z-50 backdrop-blur-md bg-white/80 dark:bg-stone-900/80 border-b border-stone-200 dark:border-stone-800 transition-colors">
      <div className="max-w-7xl 2xl:max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 sm:gap-2.5 group shrink-0" title="HungPH. Blog">
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl overflow-hidden shadow-md shadow-blue-500/20 group-hover:scale-105 transition-transform shrink-0">
            <img src="/logo.jpg" alt="HungPH Blog Logo" className="w-full h-full object-cover" />
          </div>
          <div className="hidden sm:flex flex-col">
            <span className="font-bold text-base sm:text-lg tracking-tight text-stone-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
              HungPH<span className="text-blue-600">.</span>
            </span>
            <span className="hidden md:block text-[11px] text-stone-500 dark:text-stone-400 font-medium -mt-1">
              Tech &amp; Thoughts
            </span>
          </div>
        </Link>

        {/* Navigation Links */}
        <nav className="hidden md:flex items-center gap-1 text-sm font-medium text-stone-600 dark:text-stone-300">
          {navLinks.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                  isActive
                    ? "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 font-semibold"
                    : "hover:text-stone-900 dark:hover:text-white hover:bg-stone-100 dark:hover:bg-stone-800/60"
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{item.label}</span>
                {item.badge && (
                  <span className="ml-0.5 text-[10px] px-1.5 py-0.5 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold">
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Right Actions */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
          {/* Theme Switcher */}
          <button
            onClick={toggleTheme}
            aria-label="Toggle theme"
            className="p-1.5 sm:p-2 rounded-lg text-stone-500 hover:text-stone-900 dark:text-stone-400 dark:hover:text-white hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
          >
            {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>

          {/* Notification Bell */}
          {user && (
            <div ref={notifRef} className="relative">
              <button
                onClick={handleOpenNotifs}
                aria-label="Thông báo"
                className="relative p-1.5 sm:p-2 rounded-lg text-stone-500 hover:text-stone-900 dark:text-stone-400 dark:hover:text-white hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
              >
                <Bell className="w-4 h-4" />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[15px] h-3.5 px-0.5 flex items-center justify-center rounded-full bg-rose-500 text-white text-[9px] font-bold leading-none">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
              </button>

              {/* Notification Dropdown */}
              {showNotifs && (
                <div className="absolute right-0 top-full mt-2 w-80 max-w-[calc(100vw-2rem)] bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-2xl shadow-xl shadow-black/10 overflow-hidden z-50">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-stone-100 dark:border-stone-800">
                    <span className="font-semibold text-stone-900 dark:text-white text-sm">Thông báo</span>
                    <Link
                      href="/notifications"
                      className="text-xs text-blue-600 hover:underline"
                      onClick={() => setShowNotifs(false)}
                    >
                      Xem tất cả
                    </Link>
                  </div>
                  {notifications.length === 0 ? (
                    <div className="px-4 py-8 text-center text-stone-400 text-sm">
                      Chưa có thông báo nào
                    </div>
                  ) : (
                    <ul className="max-h-72 overflow-y-auto divide-y divide-stone-100 dark:divide-stone-800">
                      {notifications.map((n) => (
                        <li
                          key={n.id}
                          onClick={() => handleNotificationClick(n)}
                          className={`px-4 py-3 flex items-start gap-3 hover:bg-stone-50 dark:hover:bg-stone-800/50 transition-colors cursor-pointer ${
                            !n.is_read ? "bg-blue-50/50 dark:bg-blue-950/20" : ""
                          }`}
                        >
                          <span className="text-xl mt-0.5 shrink-0">{NOTIF_ICONS[n.type] || "🔔"}</span>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm text-stone-800 dark:text-stone-200 leading-snug">
                              {n.message}
                            </p>
                            <div className="flex items-center justify-between mt-1">
                              <p className="text-[11px] text-stone-400">
                                {new Date(n.created_at).toLocaleDateString("vi-VN", {
                                  day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit"
                                })}
                              </p>
                              {n.type === "collab_request" && (
                                <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 hover:underline">
                                  Xem &amp; duyệt →
                                </span>
                              )}
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          )}

          {/* User Authentication & Role Actions */}
          {user ? (
            <div className="flex items-center gap-1 sm:gap-2">
              <Link
                href="/admin/editor/new"
                className="hidden md:flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white transition-all shadow-sm shadow-blue-500/20"
              >
                <PenTool className="w-3.5 h-3.5" />
                <span>Viết bài</span>
              </Link>

              {/* Profile & Role Badge - Avatar only on small mobile */}
              <Link
                href={`/profile/${user.username}`}
                title={`Trang cá nhân: ${user.full_name || user.username}`}
                className="flex items-center sm:gap-2 bg-stone-100 dark:bg-stone-800/80 p-0.5 sm:pl-2 sm:pr-3 sm:py-1 rounded-full text-xs hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors shrink-0"
              >
                {user.avatar_url ? (
                  <img src={user.avatar_url} alt="" className="w-7 h-7 sm:w-6 sm:h-6 rounded-full object-cover ring-1 ring-stone-200 dark:ring-stone-700" />
                ) : (
                  <div className="w-7 h-7 sm:w-6 sm:h-6 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center font-bold text-[11px]">
                    {user.full_name?.charAt(0) || user.username?.charAt(0) || "U"}
                  </div>
                )}
                <span className="hidden sm:inline font-semibold text-stone-900 dark:text-white max-w-[90px] sm:max-w-[120px] truncate">
                  {user.full_name || user.username}
                </span>

                {isAdmin ? (
                  <span className="hidden sm:inline text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                    Admin
                  </span>
                ) : (
                  <span className="hidden md:inline text-[9px] font-medium px-1.5 py-0.5 rounded-md bg-stone-200 dark:bg-stone-700 text-stone-600 dark:text-stone-300">
                    Thành viên
                  </span>
                )}
              </Link>

              {/* Nút Quản lý: Khi đang ở bất kỳ trang admin nào (/admin/*) thì hiển thị màu tím và disable theo phương châm UI thống nhất */}
              {pathname.startsWith("/admin") ? (
                <span
                  aria-current="page"
                  className="inline-flex items-center text-xs font-bold px-2.5 py-1.5 rounded-xl border border-purple-300 dark:border-purple-800 bg-purple-100/90 dark:bg-purple-950/70 text-purple-800 dark:text-purple-200 shadow-xs cursor-default pointer-events-none select-none shrink-0"
                >
                  Quản lý
                </span>
              ) : (
                <Link
                  href="/admin/posts"
                  className="text-xs font-semibold px-2.5 py-1.5 rounded-xl border border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors shrink-0"
                >
                  {isAdmin ? "Quản lý" : "Bài viết"}
                </Link>
              )}

              <button
                onClick={handleLogout}
                title="Đăng xuất"
                className="p-1.5 sm:p-2 rounded-lg text-stone-400 hover:text-rose-600 transition-colors shrink-0"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <GoogleLoginButton buttonText="Đăng nhập" />
          )}
        </div>
      </div>
    </header>
  );
};

