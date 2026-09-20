"use client";

import React, { useEffect, useState } from "react";
import { ArrowUp } from "lucide-react";

export const ScrollToTop: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      const scrollHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;

      if (scrollHeight > 0) {
        const progress = Math.min(100, Math.max(0, (scrollTop / scrollHeight) * 100));
        setScrollProgress(progress);
      }

      // Hiện nút khi cuộn quá 250px
      if (scrollTop > 250) {
        setIsVisible(true);
      } else {
        setIsVisible(false);
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();

    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  // Tính toán chu vi vòng tròn SVG
  const radius = 22;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (scrollProgress / 100) * circumference;

  return (
    <div
      className={`fixed bottom-6 right-6 sm:bottom-8 sm:right-8 z-50 transition-all duration-300 ease-out ${
        isVisible
          ? "opacity-100 translate-y-0 scale-100 pointer-events-auto"
          : "opacity-0 translate-y-6 scale-75 pointer-events-none"
      }`}
    >
      <div className="relative group flex items-center justify-center">
        {/* Tooltip hiển thị phần trăm khi hover */}
        <div className="absolute right-full mr-3 px-2.5 py-1 rounded-xl text-xs font-semibold whitespace-nowrap opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200 pointer-events-none shadow-md backdrop-blur-md bg-stone-900/90 dark:bg-stone-100/90 text-white dark:text-stone-900 border border-stone-800/40 dark:border-stone-200/40">
          <span>{Math.round(scrollProgress)}% • Lên đầu trang</span>
          <div className="absolute top-1/2 -right-1 -translate-y-1/2 w-2 h-2 rotate-45 bg-stone-900/90 dark:bg-stone-100/90 border-t border-r border-stone-800/40 dark:border-stone-200/40" />
        </div>

        {/* Ambient Glow Aura */}
        <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-blue-500/20 to-indigo-500/30 blur-md group-hover:blur-lg group-hover:scale-110 transition-all duration-300 opacity-60 group-hover:opacity-100" />

        {/* Button chính */}
        <button
          onClick={scrollToTop}
          aria-label="Cuộn lên đầu trang"
          className="relative w-12 h-12 rounded-full flex items-center justify-center backdrop-blur-xl bg-white/85 dark:bg-stone-900/85 border border-stone-200/90 dark:border-stone-700/80 shadow-lg shadow-blue-500/10 hover:shadow-xl hover:shadow-blue-500/25 transition-all duration-300 hover:scale-105 active:scale-95 group-hover:border-blue-400 dark:group-hover:border-blue-500/60"
        >
          {/* Circular Progress Bar SVG */}
          <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 52 52">
            <defs>
              <linearGradient id="scrollProgressGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#3b82f6" />
                <stop offset="50%" stopColor="#6366f1" />
                <stop offset="100%" stopColor="#8b5cf6" />
              </linearGradient>
            </defs>

            {/* Vòng nền mờ */}
            <circle
              cx="26"
              cy="26"
              r={radius}
              fill="none"
              strokeWidth="2.5"
              className="stroke-stone-200/70 dark:stroke-stone-800/80"
            />

            {/* Vòng tiến độ gradient */}
            <circle
              cx="26"
              cy="26"
              r={radius}
              fill="none"
              stroke="url(#scrollProgressGradient)"
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray={circumference}
              style={{
                strokeDashoffset,
                transition: "stroke-dashoffset 150ms cubic-bezier(0.4, 0, 0.2, 1)",
              }}
            />
          </svg>

          {/* Mũi tên hướng lên với hiệu ứng nhấc nhẹ khi hover */}
          <ArrowUp className="w-5 h-5 text-stone-700 dark:text-stone-200 group-hover:text-blue-600 dark:group-hover:text-blue-400 group-hover:-translate-y-1 transition-all duration-300 relative z-10 stroke-[2.5]" />
        </button>
      </div>
    </div>
  );
};
