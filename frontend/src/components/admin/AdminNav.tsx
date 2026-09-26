"use client";

import React from "react";
import Link from "next/link";
import { FileText, Users, GraduationCap, Layers, Flag, Activity } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

export type AdminTab = "posts" | "users" | "series" | "categories" | "reports" | "logs";

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
      label: "Bài viết",
      href: "/admin/posts",
      icon: FileText,
      adminOnly: true,
    },
    {
      key: "users",
      label: "Thành viên",
      href: "/admin/users",
      icon: Users,
      adminOnly: true,
    },
    {
      key: "series",
      label: "Series",
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
    {
      key: "logs",
      label: "Nhật ký",
      href: "/admin/logs",
      icon: Activity,
      adminOnly: true,
    },
  ];

  return (
    <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 overflow-x-auto no-scrollbar py-0.5 max-w-full">
      {tabs.map((tab) => {
        if (tab.adminOnly && !isAdmin) return null;

        const isActive = currentTab === tab.key;
        const Icon = tab.icon;

        if (isActive) {
          return (
            <span
              key={tab.key}
              aria-current="page"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-purple-300 dark:border-purple-800 bg-purple-100/90 dark:bg-purple-950/70 text-purple-800 dark:text-purple-200 text-xs font-bold shadow-xs cursor-default pointer-events-none select-none shrink-0 whitespace-nowrap"
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
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 text-xs font-semibold transition-colors shrink-0 whitespace-nowrap ${
              disabled ? "pointer-events-none opacity-50" : ""
            }`}
          >
            <Icon className="w-3.5 h-3.5 text-stone-500" />
            <span>{tab.label}</span>
          </Link>
        );
      })}

      {actionButton && (
        <div className="shrink-0">
          {actionButton}
        </div>
      )}
    </div>
  );
};
