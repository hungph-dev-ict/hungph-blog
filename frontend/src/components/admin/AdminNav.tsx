"use client";

import React from "react";
import Link from "next/link";
import { FileText, Users, GraduationCap, Layers, Flag } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

export type AdminTab = "posts" | "users" | "series" | "categories" | "reports";

interface AdminNavProps {
  currentTab: AdminTab;
  actionButton?: React.ReactNode;
  disabled?: boolean;
}

export const AdminNav: React.FC<AdminNavProps> = ({
  currentTab,
  actionButton,
  disabled = false,
}) => {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin" || user?.is_admin;

  const tabs: { key: AdminTab; label: string; href: string; icon: React.ComponentType<{ className?: string }>; adminOnly: boolean }[] = [
    {
      key: "posts",
      label: isAdmin ? "Quản lý bài viết" : "Bài viết của tôi",
      href: "/admin/posts",
      icon: FileText,
      adminOnly: false,
    },
    {
      key: "users",
      label: "Quản lý thành viên",
      href: "/admin/users",
      icon: Users,
      adminOnly: true,
    },
    {
      key: "series",
      label: "Khóa học",
      href: "/admin/series",
      icon: GraduationCap,
      adminOnly: true,
    },
    {
      key: "categories",
      label: "Danh mục",
      href: "/admin/categories",
      icon: Layers,
      adminOnly: true,
    },
    {
      key: "reports",
      label: "Tố cáo",
      href: "/admin/reports",
      icon: Flag,
      adminOnly: true,
    },
  ];

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 w-full sm:w-auto">
      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
        {tabs.map((tab) => {
          if (tab.adminOnly && !isAdmin) return null;

          const isActive = currentTab === tab.key;
          const Icon = tab.icon;

          if (isActive) {
            return (
              <span
                key={tab.key}
                aria-current="page"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-purple-300 dark:border-purple-800 bg-purple-100/90 dark:bg-purple-950/70 text-purple-800 dark:text-purple-200 text-xs font-bold shadow-xs cursor-default pointer-events-none select-none"
              >
                <Icon className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                <span>{tab.label}</span>
              </span>
            );
          }

          return (
            <Link
              key={tab.key}
              href={tab.href}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 text-xs font-semibold transition-colors ${
                disabled ? "pointer-events-none opacity-50" : ""
              }`}
            >
              <Icon className="w-3.5 h-3.5 text-stone-500" />
              <span>{tab.label}</span>
            </Link>
          );
        })}
      </div>

      {actionButton && (
        <div className="shrink-0">
          {actionButton}
        </div>
      )}
    </div>
  );
};
