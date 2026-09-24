"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  Search,
  RefreshCw,
  ShieldAlert,
  MessageSquare,
  FileText,
  Flag,
  LogIn,
  Trash2,
  Edit3,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Info,
  X,
  Globe,
  Terminal,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { getAuditLogs, getAuditStats } from "@/lib/api";
import { AuditLog, AuditStats } from "@/lib/types";
import { AdminNav } from "@/components/admin/AdminNav";
import { Breadcrumbs } from "@/components/common/Breadcrumbs";

const ACTION_CONFIG: Record<
  string,
  { label: string; color: string; icon: React.ComponentType<{ className?: string }> }
> = {
  POST_CREATE: {
    label: "Đăng bài mới",
    color: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800",
    icon: FileText,
  },
  POST_UPDATE: {
    label: "Cập nhật bài viết",
    color: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-800",
    icon: Edit3,
  },
  POST_PUBLISH: {
    label: "Xuất bản bài viết",
    color: "bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/40 dark:text-teal-400 dark:border-teal-800",
    icon: FileText,
  },
  POST_UNPUBLISH: {
    label: "Chuyển về nháp",
    color: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800",
    icon: Edit3,
  },
  POST_DELETE: {
    label: "Xóa bài viết",
    color: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800",
    icon: Trash2,
  },
  COMMENT_CREATE: {
    label: "Bình luận mới",
    color: "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-400 dark:border-purple-800",
    icon: MessageSquare,
  },
  COMMENT_DELETE: {
    label: "Thu hồi bình luận",
    color: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800",
    icon: Trash2,
  },
  POST_REPORT: {
    label: "Tố cáo vi phạm",
    color: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-800",
    icon: Flag,
  },
  USER_LOGIN: {
    label: "Đăng nhập",
    color: "bg-stone-100 text-stone-700 border-stone-200 dark:bg-stone-800 dark:text-stone-300 dark:border-stone-700",
    icon: LogIn,
  },
  USER_UPDATE_PROFILE: {
    label: "Cập nhật hồ sơ",
    color: "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-400 dark:border-indigo-800",
    icon: Edit3,
  },
};

export default function AdminAuditLogsPage() {
  const router = useRouter();
  const { user, token, isLoading: authLoading } = useAuth();
  const isAdmin = user?.role === "admin" || user?.is_admin;

  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const limit = 25;
  const [actionFilter, setActionFilter] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<AuditStats | null>(null);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  // Authentication Guard
  useEffect(() => {
    if (!authLoading && (!user || !isAdmin)) {
      router.push("/login?redirect=/admin/logs");
    }
  }, [user, isAdmin, authLoading, router]);

  // Load Stats
  const loadStats = useCallback(async () => {
    if (!token) return;
    try {
      const data = await getAuditStats(token);
      setStats(data);
    } catch (err) {
      console.error("Failed to load audit stats:", err);
    }
  }, [token]);

  // Load Logs
  const loadLogs = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await getAuditLogs(
        {
          page,
          limit,
          action: actionFilter || undefined,
          search: searchQuery.trim() || undefined,
        },
        token
      );
      setLogs(res.items);
      setTotal(res.total);
    } catch (err) {
      console.error("Failed to load audit logs:", err);
    } finally {
      setLoading(false);
    }
  }, [token, page, actionFilter, searchQuery]);

  useEffect(() => {
    if (isAdmin && token) {
      loadLogs();
      loadStats();
    }
  }, [isAdmin, token, loadLogs, loadStats]);

  const totalPages = Math.ceil(total / limit);

  if (authLoading || (!user && !authLoading)) {
    return <div className="p-8 text-center text-xs text-stone-400">Đang xác thực quyền truy cập...</div>;
  }

  return (
    <div className="max-w-7xl 2xl:max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Breadcrumbs */}
      <Breadcrumbs
        items={[
          { label: "Trang chủ", href: "/" },
          { label: "Quản trị", href: "/admin/posts" },
          { label: "Nhật ký hệ thống & Điều tra" },
        ]}
      />

      {/* Header & Nav */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-stone-900 dark:text-white flex items-center gap-2.5">
              <Activity className="w-7 h-7 text-blue-600 dark:text-blue-400" />
              <span>Nhật Ký Hoạt Động &amp; Điều Tra</span>
            </h1>
            <p className="text-xs sm:text-sm text-stone-500 dark:text-stone-400 mt-1">
              Theo dõi toàn diện các sự kiện hệ thống: ai đăng bài, ai bình luận bài của ai, lịch sử truy cập và tố cáo.
            </p>
          </div>
          <button
            onClick={() => {
              loadLogs();
              loadStats();
            }}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 text-stone-700 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-800 text-xs font-semibold shadow-xs transition-colors self-start sm:self-auto cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-blue-600" : ""}`} />
            <span>Làm mới dữ liệu</span>
          </button>
        </div>

        <AdminNav currentTab="logs" />
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="p-4 rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900/60 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-stone-500">Hoạt động hôm nay</span>
              <Activity className="w-4 h-4 text-blue-500" />
            </div>
            <p className="text-2xl font-bold text-stone-900 dark:text-white mt-1">
              {stats.today_activities.toLocaleString()}
            </p>
          </div>

          <div className="p-4 rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900/60 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-stone-500">Bài viết đã tạo</span>
              <FileText className="w-4 h-4 text-emerald-500" />
            </div>
            <p className="text-2xl font-bold text-stone-900 dark:text-white mt-1">
              {stats.total_posts_created.toLocaleString()}
            </p>
          </div>

          <div className="p-4 rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900/60 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-stone-500">Tổng bình luận</span>
              <MessageSquare className="w-4 h-4 text-purple-500" />
            </div>
            <p className="text-2xl font-bold text-stone-900 dark:text-white mt-1">
              {stats.total_comments.toLocaleString()}
            </p>
          </div>

          <div className="p-4 rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900/60 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-stone-500">Tổng lượt tố cáo</span>
              <Flag className="w-4 h-4 text-red-500" />
            </div>
            <p className="text-2xl font-bold text-stone-900 dark:text-white mt-1">
              {stats.total_reports.toLocaleString()}
            </p>
          </div>
        </div>
      )}

      {/* Filter Bar */}
      <div className="p-4 rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900/60 shadow-xs flex flex-col sm:flex-row items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(1);
            }}
            placeholder="Tìm theo người thực hiện, email, IP, tên bài, nội dung..."
            className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Action Filter */}
        <div className="w-full sm:w-64">
          <select
            value={actionFilter}
            onChange={(e) => {
              setActionFilter(e.target.value);
              setPage(1);
            }}
            className="w-full px-3 py-2 text-xs rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
          >
            <option value="">Tất cả hành động ({total})</option>
            <option value="COMMENT_CREATE">💬 Bình luận mới</option>
            <option value="COMMENT_DELETE">🗑️ Thu hồi bình luận</option>
            <option value="POST_CREATE">📝 Đăng bài mới</option>
            <option value="POST_UPDATE">✏️ Cập nhật bài viết</option>
            <option value="POST_PUBLISH">🚀 Xuất bản bài viết</option>
            <option value="POST_UNPUBLISH">📦 Chuyển về nháp</option>
            <option value="POST_DELETE">❌ Xóa bài viết</option>
            <option value="POST_REPORT">🚩 Tố cáo vi phạm</option>
            <option value="USER_LOGIN">🔑 Đăng nhập</option>
            <option value="USER_UPDATE_PROFILE">👤 Cập nhật hồ sơ</option>
          </select>
        </div>
      </div>

      {/* Table Logs */}
      <div className="border border-stone-200 dark:border-stone-800 rounded-2xl overflow-hidden bg-white dark:bg-stone-900/60 shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-900/80 text-stone-500 uppercase font-semibold">
              <tr>
                <th className="py-3 px-4">Thời gian</th>
                <th className="py-3 px-4">Người thực hiện</th>
                <th className="py-3 px-4">Hành động</th>
                <th className="py-3 px-4">Nội dung tóm tắt</th>
                <th className="py-3 px-4">Địa chỉ IP / Thiết bị</th>
                <th className="py-3 px-4 text-right">Chi tiết</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 dark:divide-stone-800/60">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-stone-400">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-blue-500" />
                    <span>Đang tải nhật ký kiểm tra...</span>
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-stone-400">
                    Không tìm thấy bản ghi nhật ký nào phù hợp.
                  </td>
                </tr>
              ) : (
                logs.map((log) => {
                  const conf = ACTION_CONFIG[log.action] || {
                    label: log.action,
                    color: "bg-stone-100 text-stone-700 border-stone-200 dark:bg-stone-800 dark:text-stone-300",
                    icon: Activity,
                  };
                  const Icon = conf.icon;

                  return (
                    <tr
                      key={log.id}
                      className="hover:bg-stone-50/70 dark:hover:bg-stone-800/40 transition-colors"
                    >
                      {/* Timestamp */}
                      <td className="py-3 px-4 whitespace-nowrap text-stone-500 font-mono text-[11px]">
                        {new Date(log.created_at).toLocaleString("vi-VN", {
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                        })}
                      </td>

                      {/* Actor */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="font-semibold text-stone-900 dark:text-white">
                          {log.actor_name || "Ẩn danh / Khách"}
                        </div>
                        {log.actor_email && (
                          <div className="text-[10px] text-stone-400 truncate max-w-[150px]">
                            {log.actor_email}
                          </div>
                        )}
                      </td>

                      {/* Action Badge */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold border ${conf.color}`}
                        >
                          <Icon className="w-3 h-3" />
                          <span>{conf.label}</span>
                        </span>
                      </td>

                      {/* Summary */}
                      <td className="py-3 px-4 max-w-md">
                        <p className="text-stone-800 dark:text-stone-200 font-medium leading-relaxed">
                          {log.summary}
                        </p>
                        {log.target_title && log.target_id && log.target_type === "post" && (
                          <a
                            href={`/posts/${log.target_id}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] text-blue-600 dark:text-blue-400 hover:underline mt-0.5"
                          >
                            <span>Xem bài viết</span>
                            <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        )}
                      </td>

                      {/* IP & UA */}
                      <td className="py-3 px-4 whitespace-nowrap text-[11px] text-stone-500">
                        <div className="flex items-center gap-1 font-mono text-stone-700 dark:text-stone-300">
                          <Globe className="w-3 h-3 text-stone-400" />
                          <span>{log.ip_address || "N/A"}</span>
                        </div>
                        {log.user_agent && (
                          <div className="text-[10px] text-stone-400 truncate max-w-[160px]" title={log.user_agent}>
                            {log.user_agent}
                          </div>
                        )}
                      </td>

                      {/* Details Button */}
                      <td className="py-3 px-4 whitespace-nowrap text-right">
                        <button
                          onClick={() => setSelectedLog(log)}
                          className="px-2.5 py-1 rounded-lg border border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 font-medium transition-colors cursor-pointer"
                        >
                          Xem payload
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-stone-200 dark:border-stone-800 flex items-center justify-between">
            <span className="text-xs text-stone-500">
              Trang <span className="font-semibold">{page}</span> / {totalPages} (Tổng {total} bản ghi)
            </span>
            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(p - 1, 1))}
                className="p-1.5 rounded-lg border border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 disabled:opacity-40 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
                className="p-1.5 rounded-lg border border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 disabled:opacity-40 cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Log Payload Modal */}
      {selectedLog && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setSelectedLog(null)}
        >
          <div
            className="bg-white dark:bg-stone-900 rounded-3xl border border-stone-200 dark:border-stone-800 p-6 max-w-2xl w-full shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-stone-100 dark:border-stone-800">
              <div className="flex items-center gap-2">
                <Terminal className="w-5 h-5 text-blue-600" />
                <h3 className="text-base font-bold text-stone-900 dark:text-white">
                  Chi Tiết Log Hoạt Động (Điều Tra)
                </h3>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="p-1.5 text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2 p-3 rounded-xl bg-stone-50 dark:bg-stone-800/50">
                <div>
                  <span className="text-stone-400">Mã log:</span>
                  <p className="font-mono text-stone-900 dark:text-white select-all">{selectedLog.id}</p>
                </div>
                <div>
                  <span className="text-stone-400">Thời gian tạo:</span>
                  <p className="font-medium text-stone-900 dark:text-white">
                    {new Date(selectedLog.created_at).toLocaleString("vi-VN")}
                  </p>
                </div>
                <div>
                  <span className="text-stone-400">Hành động:</span>
                  <p className="font-semibold text-blue-600 dark:text-blue-400">{selectedLog.action}</p>
                </div>
                <div>
                  <span className="text-stone-400">Người thực hiện:</span>
                  <p className="font-semibold text-stone-900 dark:text-white">
                    {selectedLog.actor_name || "Ẩn danh"} {selectedLog.actor_email ? `(${selectedLog.actor_email})` : ""}
                  </p>
                </div>
                <div>
                  <span className="text-stone-400">Địa chỉ IP:</span>
                  <p className="font-mono text-stone-900 dark:text-white select-all">{selectedLog.ip_address || "N/A"}</p>
                </div>
                <div>
                  <span className="text-stone-400">User Agent:</span>
                  <p className="truncate text-stone-900 dark:text-white" title={selectedLog.user_agent}>
                    {selectedLog.user_agent || "N/A"}
                  </p>
                </div>
              </div>

              <div>
                <span className="text-stone-400 block mb-1">Tóm tắt sự kiện:</span>
                <p className="p-3 rounded-xl bg-stone-100 dark:bg-stone-800 text-stone-900 dark:text-white font-medium">
                  {selectedLog.summary}
                </p>
              </div>

              {selectedLog.details && (
                <div>
                  <span className="text-stone-400 block mb-1">Dữ liệu chi tiết (Payload JSON):</span>
                  <pre className="p-3 rounded-xl bg-stone-950 text-emerald-400 font-mono text-[11px] overflow-x-auto max-h-56">
                    {(() => {
                      try {
                        return JSON.stringify(JSON.parse(selectedLog.details), null, 2);
                      } catch {
                        return selectedLog.details;
                      }
                    })()}
                  </pre>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSelectedLog(null)}
                className="px-4 py-2 rounded-xl bg-stone-900 dark:bg-white text-white dark:text-stone-900 text-xs font-semibold hover:opacity-90 transition-opacity cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
