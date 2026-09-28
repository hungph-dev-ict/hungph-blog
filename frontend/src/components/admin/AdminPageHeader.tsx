"use client";

import React from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Breadcrumbs, BreadcrumbItem } from "@/components/common/Breadcrumbs";
import { AdminNav, AdminTab } from "@/components/admin/AdminNav";

export interface AdminPageHeaderProps {
  currentTab: AdminTab;
  breadcrumbs: BreadcrumbItem[];
  title: string;
  description?: string;
  icon?: React.ComponentType<{ className?: string }>;
  backHref?: string;
  backTitle?: string;
  badgeText?: string;
  badgeVariant?: "admin" | "member" | "info" | "purple";
  actionButton?: React.ReactNode;
  disabled?: boolean;
  extraHeaderContent?: React.ReactNode;
}

export const AdminPageHeader: React.FC<AdminPageHeaderProps> = ({
  currentTab,
  breadcrumbs,
  title,
  description,
  icon: Icon,
  backHref,
  backTitle = "Quay lại",
  badgeText,
  badgeVariant = "info",
  actionButton,
  disabled = false,
  extraHeaderContent,
}) => {
  const getBadgeStyle = () => {
    switch (badgeVariant) {
      case "admin":
      case "purple":
        return "bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800";
      case "member":
        return "bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 border border-stone-200 dark:border-stone-700";
      case "info":
      default:
        return "bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800";
    }
  };

  return (
    <div className="space-y-4">
      <Breadcrumbs items={breadcrumbs} />

      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-stone-200 dark:border-stone-800 pb-4">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {backHref && (
            <Link
              href={backHref}
              className="p-2 rounded-xl text-stone-500 hover:text-stone-900 dark:hover:text-white hover:bg-stone-200/60 dark:hover:bg-stone-800 transition-colors shrink-0"
              title={backTitle}
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
          )}

          <div className="min-w-0 flex-1">
            <h1 className="text-xl sm:text-2xl font-bold text-stone-900 dark:text-white flex items-center gap-2">
              {Icon && <Icon className="w-6 h-6 text-blue-600 dark:text-blue-400 shrink-0" />}
              <span className="truncate">{title}</span>
              {badgeText && (
                <span
                  className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full shrink-0 ${getBadgeStyle()}`}
                >
                  {badgeText}
                </span>
              )}
            </h1>
            {description && (
              <p className="text-xs text-stone-500 dark:text-stone-400 truncate max-w-xl mt-0.5">
                {description}
              </p>
            )}
          </div>
        </div>

        {/* Tab điều hướng dùng chung cho các màn quản lý */}
        <AdminNav
          currentTab={currentTab}
          disabled={disabled}
          actionButton={actionButton}
        />
      </div>

      {extraHeaderContent && <div>{extraHeaderContent}</div>}
    </div>
  );
};
