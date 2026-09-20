"use client";

import React, {
  createContext,
  Suspense,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";

interface LoadingContextType {
  isLoading: boolean;
  message: string;
  showLoading: (msg?: string) => void;
  hideLoading: () => void;
  withLoading: <T>(action: () => Promise<T>, msg?: string) => Promise<T>;
}

const LoadingContext = createContext<LoadingContextType>({
  isLoading: false,
  message: "",
  showLoading: () => {},
  hideLoading: () => {},
  withLoading: async (action) => action(),
});

// Component theo dõi sự thay đổi của route để tự động ẩn overlay
function NavigationWatcher({ onRouteChanged }: { onRouteChanged: () => void }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    onRouteChanged();
  }, [pathname, searchParams, onRouteChanged]);

  return null;
}

export const LoadingProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [loadingCount, setLoadingCount] = useState(0);
  const [message, setMessage] = useState("Đang xử lý...");
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const showLoading = useCallback((msg?: string) => {
    if (msg) setMessage(msg);
    setLoadingCount((prev) => prev + 1);

    // Safety timeout: Tự động giải phóng sau 20s đề phòng mất kết nối
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      setLoadingCount(0);
    }, 20000);
  }, []);

  const hideLoading = useCallback(() => {
    setLoadingCount((prev) => Math.max(0, prev - 1));
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  // Reset hoàn toàn khi đổi trang xong
  const resetLoading = useCallback(() => {
    setLoadingCount(0);
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const withLoading = useCallback(
    async <T,>(action: () => Promise<T>, msg?: string): Promise<T> => {
      showLoading(msg);
      try {
        return await action();
      } finally {
        hideLoading();
      }
    },
    [showLoading, hideLoading]
  );

  // Global Link Click Interceptor: Bắt mọi cú click chuyển trang để hiện overlay chặn spam
  useEffect(() => {
    const handleGlobalClick = (e: MouseEvent) => {
      // Tìm thẻ <a> gần nhất
      const target = (e.target as HTMLElement)?.closest("a");
      if (!target) return;

      const href = target.getAttribute("href");
      if (!href) return;

      // Bỏ qua nếu: mở tab mới, phím tắt, link tải, link neo tại chỗ (#), link email/tel
      if (
        target.target === "_blank" ||
        target.hasAttribute("download") ||
        href.startsWith("mailto:") ||
        href.startsWith("tel:") ||
        href.startsWith("#") ||
        e.ctrlKey ||
        e.metaKey ||
        e.shiftKey ||
        e.altKey
      ) {
        return;
      }

      // Kiểm tra xem có phải link nội bộ không
      try {
        const targetUrl = new URL(href, window.location.origin);
        if (targetUrl.origin !== window.location.origin) return;

        // Nếu trùng đúng URL hiện tại (cả path lẫn query) thì bỏ qua
        const currentUrl = new URL(window.location.href);
        if (
          targetUrl.pathname === currentUrl.pathname &&
          targetUrl.search === currentUrl.search
        ) {
          return;
        }

        // Tùy biến thông điệp theo ngữ cảnh đường link
        let msg = "Đang chuyển trang...";
        if (targetUrl.pathname.startsWith("/posts/")) {
          msg = "Đang tải bài viết...";
        } else if (targetUrl.pathname.startsWith("/series/")) {
          msg = "Đang tải khóa học...";
        } else if (targetUrl.pathname.startsWith("/admin/")) {
          msg = "Đang vào trang quản trị...";
        }

        showLoading(msg);
      } catch {
        // href không hợp lệ thì bỏ qua
      }
    };

    const handlePopState = () => {
      showLoading("Đang chuyển trang...");
    };

    document.addEventListener("click", handleGlobalClick, { capture: true });
    window.addEventListener("popstate", handlePopState);

    return () => {
      document.removeEventListener("click", handleGlobalClick, { capture: true });
      window.removeEventListener("popstate", handlePopState);
    };
  }, [showLoading]);

  const isLoading = loadingCount > 0;

  // Lock scroll khi overlay xuất hiện
  useEffect(() => {
    if (isLoading) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isLoading]);

  return (
    <LoadingContext.Provider
      value={{ isLoading, message, showLoading, hideLoading, withLoading }}
    >
      <Suspense fallback={null}>
        <NavigationWatcher onRouteChanged={resetLoading} />
      </Suspense>

      {children}

      {/* Global Blocking Overlay Layer */}
      {isLoading && (
        <div
          role="status"
          aria-live="polite"
          aria-busy="true"
          className="fixed inset-0 z-[99999] flex flex-col items-center justify-center p-4 bg-stone-950/60 backdrop-blur-[3px] select-none transition-all animate-in fade-in duration-200"
          style={{ pointerEvents: "all" }}
        >
          <div className="bg-white/95 dark:bg-stone-900/95 backdrop-blur-md rounded-2xl shadow-2xl border border-stone-200/80 dark:border-stone-800 p-6 sm:px-8 sm:py-6 flex items-center gap-4 max-w-md w-full mx-auto transform animate-in zoom-in-95 duration-200">
            {/* Animated Spinner with Glow */}
            <div className="relative flex items-center justify-center w-12 h-12 shrink-0 rounded-2xl bg-blue-500/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-200/60 dark:border-blue-800/60">
              <Loader2 className="w-6 h-6 animate-spin text-blue-600 dark:text-blue-400" />
            </div>

            {/* Status Information */}
            <div className="flex-1 min-w-0">
              <h3 className="text-sm sm:text-base font-bold text-stone-900 dark:text-white truncate">
                {message || "Đang xử lý dữ liệu..."}
              </h3>
              <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                Vui lòng đợi giây lát, hệ thống đang tải...
              </p>
            </div>
          </div>
        </div>
      )}
    </LoadingContext.Provider>
  );
};

export const useLoading = () => useContext(LoadingContext);
