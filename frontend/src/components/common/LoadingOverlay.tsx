"use client";

import React from "react";
import { Loader2 } from "lucide-react";

interface LoadingOverlayProps {
  isLoading: boolean;
  message?: string;
  className?: string;
  minHeight?: string | number;
  blur?: boolean;
  rounded?: string;
  opaque?: boolean;
}

export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({
  isLoading,
  message = "Đang tải dữ liệu...",
  className = "",
  minHeight,
  blur = true,
  rounded = "rounded-3xl",
  opaque = false,
}) => {
  if (!isLoading) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      style={{ minHeight }}
      className={`absolute inset-0 z-30 flex flex-col items-center justify-center p-4 transition-all duration-200 animate-in fade-in select-none ${
        opaque
          ? "bg-white dark:bg-stone-900"
          : blur
          ? "bg-white/70 dark:bg-stone-950/70 backdrop-blur-[2px]"
          : "bg-white/80 dark:bg-stone-950/80"
      } ${rounded} ${className}`}
    >
      <div className="flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-white/95 dark:bg-stone-900/95 shadow-xl border border-stone-200/80 dark:border-stone-800 text-xs font-semibold text-stone-700 dark:text-stone-200 animate-in zoom-in-95 duration-150">
        <div className="w-5 h-5 flex items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        </div>
        <span className="tracking-wide">{message}</span>
      </div>
    </div>
  );
};
