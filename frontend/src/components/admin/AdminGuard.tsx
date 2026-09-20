"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { NotFoundState } from "@/components/common/NotFoundState";

interface AdminGuardProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
}

export const AdminGuard: React.FC<AdminGuardProps> = ({
  children,
  requireAdmin = false,
}) => {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const isAdmin = user?.role === "admin" || user?.is_admin;

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/");
    }
  }, [user, isLoading, router]);

  if (isLoading) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center gap-3 text-stone-400 py-20">
        <Loader2 className="w-7 h-7 animate-spin text-blue-600" />
        <span className="text-xs font-medium">Đang kiểm tra quyền truy cập...</span>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  if (requireAdmin && !isAdmin) {
    return (
      <NotFoundState
        title="404 • Không Tìm Thấy Trang"
        description="Đường dẫn bạn yêu cầu không tồn tại, đã bị gỡ bỏ hoặc bạn không có quyền truy cập vào nội dung này."
      />
    );
  }

  return <>{children}</>;
};
