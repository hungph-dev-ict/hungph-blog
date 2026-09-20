"use client";

import React, { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Flag,
  CheckCircle,
  XCircle,
  AlertCircle,
  Clock,
  ArrowLeft,
  Search,
  X,
  ExternalLink,
  ShieldAlert,
  MessageSquare,
  User,
  Check,
  RotateCcw,
  SlidersHorizontal,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { getAdminReports, updateReport } from "@/lib/api";
import { PostReport, REPORT_REASONS } from "@/lib/types";
import { Breadcrumbs } from "@/components/common/Breadcrumbs";
import { AdminNav } from "@/components/admin/AdminNav";
import { AdminGuard } from "@/components/admin/AdminGuard";
import { useLoading } from "@/lib/loading-context";
import { LoadingOverlay } from "@/components/common/LoadingOverlay";

const STATUS_CONFIG = {
  pending: {
    label: "Chờ xét duyệt",
    color: "text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800",
    badgeBg: "bg-amber-500",
    icon: Clock,
  },
  reviewed: {
    label: "Đã xem xét",
    color: "text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/40 border-blue-300 dark:border-blue-800",
    badgeBg: "bg-blue-500",
    icon: AlertCircle,
  },
  dismissed: {
    label: "Bỏ qua (Không vi phạm)",
    color: "text-stone-600 dark:text-stone-400 bg-stone-100 dark:bg-stone-800/60 border-stone-200 dark:border-stone-700",
    badgeBg: "bg-stone-400",
    icon: XCircle,
  },
  action_taken: {
    label: "Đã xử lý (Xác nhận vi phạm)",
    color: "text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800",
    badgeBg: "bg-emerald-500",
    icon: CheckCircle,
  },
} as const;

export default function AdminReportsPage() {
  const { user, token } = useAuth();
  const router = useRouter();
  const { withLoading } = useLoading();

  const [reports, setReports] = useState<PostReport[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [reasonFilter, setReasonFilter] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Action Modal State
  const [selected, setSelected] = useState<PostReport | null>(null);
  const [adminNote, setAdminNote] = useState("");
  const [newStatus, setNewStatus] = useState<PostReport["status"]>("pending");

  useEffect(() => {
    if (token && (user?.is_admin || user?.role === "admin")) {
      loadReports();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, user]);

  const loadReports = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await getAdminReports(token);
      setReports(data);
    } catch (err) {
      console.error("Lỗi khi tải danh sách báo cáo:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleActionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected || !token || !newStatus) return;

    await withLoading(async () => {
      try {
        await updateReport(selected.id, newStatus, adminNote.trim() || undefined, token);
        setReports((prev) =>
          prev.map((r) =>
            r.id === selected.id
              ? { ...r, status: newStatus, admin_note: adminNote.trim() || undefined }
              : r
          )
        );
        setSelected(null);
        setAdminNote("");
      } catch (err: unknown) {
        alert(err instanceof Error ? err.message : "Cập nhật báo cáo thất bại");
      }
    }, "Đang lưu xử lý báo cáo...");
  };

  const openActionModal = (report: PostReport) => {
    setSelected(report);
    setNewStatus(report.status);
    setAdminNote(report.admin_note || "");
  };

  // Metrics computation
  const pendingCount = useMemo(() => reports.filter((r) => r.status === "pending").length, [reports]);
  const reviewedCount = useMemo(() => reports.filter((r) => r.status === "reviewed").length, [reports]);
  const actionTakenCount = useMemo(() => reports.filter((r) => r.status === "action_taken").length, [reports]);
  const dismissedCount = useMemo(() => reports.filter((r) => r.status === "dismissed").length, [reports]);

  // Filtered reports
  const filteredReports = useMemo(() => {
    return reports.filter((r) => {
      if (statusFilter && r.status !== statusFilter) return false;
      if (reasonFilter && r.reason !== reasonFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const titleMatch = (r.post_title || "").toLowerCase().includes(q);
        const userMatch = (r.reporter_username || "").toLowerCase().includes(q);
        const descMatch = (r.description || "").toLowerCase().includes(q);
        const noteMatch = (r.admin_note || "").toLowerCase().includes(q);
        if (!titleMatch && !userMatch && !descMatch && !noteMatch) return false;
      }
      return true;
    });
  }, [reports, statusFilter, reasonFilter, searchQuery]);

  const hasActiveFilter = Boolean(statusFilter || reasonFilter || searchQuery.trim());

  return (
    <AdminGuard requireAdmin={true}>
      <div className="w-full space-y-6 pb-16">
        <Breadcrumbs
          items={[
            { label: "Quản trị", href: "/admin/posts" },
            { label: "Quản lý tố cáo & vi phạm" },
          ]}
        />

        {/* Top Bar Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-stone-200 dark:border-stone-800 pb-4">
          <div className="flex items-center gap-3">
            <Link
              href="/admin/posts"
              className="p-2 rounded-xl text-stone-500 hover:text-stone-900 dark:hover:text-white hover:bg-stone-200/60 dark:hover:bg-stone-800 transition-colors"
              title="Quay lại bài viết"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-stone-900 dark:text-white flex items-center gap-2">
                <Flag className="w-6 h-6 text-rose-600" />
                <span>Quản Lý Tố Cáo &amp; Vi Phạm</span>
              </h1>
              <p className="text-xs text-stone-500">
                Xét duyệt và xử lý các báo cáo vi phạm nội dung từ thành viên ({reports.length} báo cáo)
                {pendingCount > 0 && (
                  <span className="ml-2 font-bold text-rose-600 dark:text-rose-400">
                    • {pendingCount} báo cáo chờ xử lý
                  </span>
                )}
              </p>
            </div>
          </div>

          <AdminNav currentTab="reports" />
        </div>

        {/* Metric Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div
            onClick={() => setStatusFilter("")}
            className={`p-4 rounded-2xl border transition-all cursor-pointer shadow-xs ${
              statusFilter === ""
                ? "border-blue-500 bg-blue-50/50 dark:bg-blue-950/20"
                : "border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900/60 hover:border-blue-400"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-stone-500 uppercase tracking-wider">Tổng báo cáo</span>
              <Flag className="w-4 h-4 text-stone-400" />
            </div>
            <div className="mt-2 text-2xl font-black text-stone-900 dark:text-white">
              {reports.length}
            </div>
            <p className="text-[11px] text-stone-400 mt-0.5">Tất cả báo cáo đã nhận</p>
          </div>

          <div
            onClick={() => setStatusFilter("pending")}
            className={`p-4 rounded-2xl border transition-all cursor-pointer shadow-xs ${
              statusFilter === "pending"
                ? "border-amber-500 bg-amber-50/60 dark:bg-amber-950/30 ring-2 ring-amber-500/20"
                : "border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900/60 hover:border-amber-400"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wider">
                Chờ xét duyệt
              </span>
              <Clock className="w-4 h-4 text-amber-500" />
            </div>
            <div className="mt-2 text-2xl font-black text-amber-600 dark:text-amber-400 flex items-center gap-2">
              <span>{pendingCount}</span>
              {pendingCount > 0 && (
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              )}
            </div>
            <p className="text-[11px] text-amber-600/80 mt-0.5">Cần Admin kiểm tra</p>
          </div>

          <div
            onClick={() => setStatusFilter("action_taken")}
            className={`p-4 rounded-2xl border transition-all cursor-pointer shadow-xs ${
              statusFilter === "action_taken"
                ? "border-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/30 ring-2 ring-emerald-500/20"
                : "border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900/60 hover:border-emerald-400"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">
                Đã xử lý
              </span>
              <CheckCircle className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="mt-2 text-2xl font-black text-emerald-600 dark:text-emerald-400">
              {actionTakenCount}
            </div>
            <p className="text-[11px] text-emerald-600/80 mt-0.5">Xác nhận có vi phạm</p>
          </div>

          <div
            onClick={() => setStatusFilter("dismissed")}
            className={`p-4 rounded-2xl border transition-all cursor-pointer shadow-xs ${
              statusFilter === "dismissed"
                ? "border-stone-500 bg-stone-100 dark:bg-stone-800/80 ring-2 ring-stone-400/20"
                : "border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900/60 hover:border-stone-400"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-stone-500 uppercase tracking-wider">
                Bỏ qua
              </span>
              <XCircle className="w-4 h-4 text-stone-400" />
            </div>
            <div className="mt-2 text-2xl font-black text-stone-600 dark:text-stone-300">
              {dismissedCount}
            </div>
            <p className="text-[11px] text-stone-400 mt-0.5">Báo cáo không vi phạm</p>
          </div>
        </div>

        {/* Search & Filter Controls Bar */}
        <div className="p-4 rounded-2xl border border-stone-200/80 dark:border-stone-800 bg-stone-50/50 dark:bg-stone-900/40 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 items-center">
            {/* Search Box */}
            <div className="lg:col-span-6 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm kiếm theo tiêu đề bài viết, người báo cáo, ghi chú..."
                className="w-full pl-9 pr-8 py-2 text-xs rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Status Filter */}
            <div className="lg:col-span-3">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full py-2 px-3 text-xs rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-700 dark:text-stone-300 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium"
              >
                <option value="">Tất cả trạng thái</option>
                <option value="pending">Chờ xét duyệt ({pendingCount})</option>
                <option value="reviewed">Đã xem xét ({reviewedCount})</option>
                <option value="action_taken">Đã xử lý vi phạm ({actionTakenCount})</option>
                <option value="dismissed">Bỏ qua ({dismissedCount})</option>
              </select>
            </div>

            {/* Reason Filter */}
            <div className="lg:col-span-3">
              <select
                value={reasonFilter}
                onChange={(e) => setReasonFilter(e.target.value)}
                className="w-full py-2 px-3 text-xs rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-700 dark:text-stone-300 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium"
              >
                <option value="">Tất cả lý do báo cáo</option>
                {Object.entries(REPORT_REASONS).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {hasActiveFilter && (
            <div className="flex items-center justify-between pt-1 text-xs border-t border-stone-200/60 dark:border-stone-800">
              <span className="text-stone-500">
                Tìm thấy <strong>{filteredReports.length}</strong> kết quả phù hợp bộ lọc.
              </span>
              <button
                onClick={() => {
                  setStatusFilter("");
                  setReasonFilter("");
                  setSearchQuery("");
                }}
                className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700 dark:text-blue-400 font-semibold"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Xóa bộ lọc</span>
              </button>
            </div>
          )}
        </div>

        {/* Reports List */}
        <div className="relative min-h-[320px]">
          <LoadingOverlay isLoading={loading} message="Đang tải danh sách báo cáo..." />

          {loading && reports.length === 0 ? (
            <div className="space-y-3 animate-pulse">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-32 rounded-2xl bg-stone-100 dark:bg-stone-800" />
              ))}
            </div>
          ) : filteredReports.length === 0 ? (
            <div className="p-12 text-center border border-dashed border-stone-200 dark:border-stone-800 rounded-3xl text-xs text-stone-400 bg-white dark:bg-stone-900/40 space-y-2">
              <Flag className="w-10 h-10 mx-auto text-stone-300 dark:text-stone-700" />
              <p className="text-sm font-semibold text-stone-600 dark:text-stone-400">
                {hasActiveFilter ? "Không tìm thấy báo cáo phù hợp với bộ lọc" : "Hiện chưa có báo cáo vi phạm nào"}
              </p>
              {hasActiveFilter && (
                <button
                  onClick={() => {
                    setStatusFilter("");
                    setReasonFilter("");
                    setSearchQuery("");
                  }}
                  className="text-xs text-blue-600 hover:underline font-semibold"
                >
                  Đặt lại bộ lọc
                </button>
              )}
            </div>
          ) : (
            <div className={`space-y-3 transition-opacity duration-200 ${loading ? "opacity-40 pointer-events-none" : ""}`}>
              {filteredReports.map((r) => {
              const sc = STATUS_CONFIG[r.status] || STATUS_CONFIG.pending;
              const StatusIcon = sc.icon;
              const postHref = r.post_slug ? `/posts/${r.post_slug}` : `/posts/${r.post_id}`;

              return (
                <div
                  key={r.id}
                  className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-3xl p-5 hover:border-stone-300 dark:hover:border-stone-700 shadow-xs transition-all space-y-4"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    <div className="flex-1 min-w-0 space-y-2">
                      {/* Status and Reason tags */}
                      <div className="flex items-center gap-2 flex-wrap text-xs">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full font-bold border ${sc.color}`}>
                          <StatusIcon className="w-3.5 h-3.5" />
                          <span>{sc.label}</span>
                        </span>
                        <span className="px-3 py-1 rounded-full bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 font-semibold border border-stone-200 dark:border-stone-700">
                          {REPORT_REASONS[r.reason] || r.reason}
                        </span>
                        <span className="text-stone-400 text-[11px]">
                          {new Date(r.created_at).toLocaleString("vi-VN")}
                        </span>
                      </div>

                      {/* Reported Post Title */}
                      <div className="pt-1">
                        <span className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider block mb-0.5">
                          Bài viết bị báo cáo:
                        </span>
                        <Link
                          href={postHref}
                          target="_blank"
                          className="inline-flex items-center gap-1.5 text-base font-bold text-stone-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors group"
                        >
                          <span className="group-hover:underline">{r.post_title || r.post_id}</span>
                          <ExternalLink className="w-3.5 h-3.5 text-stone-400 group-hover:text-blue-600" />
                        </Link>
                      </div>

                      {/* Reporter */}
                      <div className="flex items-center gap-2 text-xs text-stone-500 dark:text-stone-400">
                        <User className="w-3.5 h-3.5 text-stone-400" />
                        <span>
                          Người báo cáo:{" "}
                          <strong className="font-semibold text-stone-700 dark:text-stone-300">
                            {r.reporter_username ? `@${r.reporter_username}` : "Ẩn danh"}
                          </strong>
                        </span>
                      </div>

                      {/* Report description */}
                      {r.description && (
                        <div className="p-3 rounded-2xl bg-stone-50 dark:bg-stone-800/50 border border-stone-200/80 dark:border-stone-700/80 text-xs text-stone-700 dark:text-stone-300 space-y-1">
                          <div className="flex items-center gap-1.5 text-[11px] font-bold text-stone-500 uppercase tracking-wider">
                            <MessageSquare className="w-3 h-3 text-stone-400" />
                            <span>Mô tả chi tiết từ thành viên:</span>
                          </div>
                          <p className="leading-relaxed italic pl-1">"{r.description}"</p>
                        </div>
                      )}

                      {/* Admin Note */}
                      {r.admin_note && (
                        <div className="p-3 rounded-2xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200/60 dark:border-blue-900/50 text-xs text-blue-900 dark:text-blue-300 space-y-1">
                          <div className="font-bold text-[11px] uppercase tracking-wider flex items-center gap-1.5 text-blue-700 dark:text-blue-400">
                            <ShieldAlert className="w-3 h-3" />
                            <span>Ghi chú xử lý của Quản trị viên:</span>
                          </div>
                          <p className="leading-relaxed pl-1">{r.admin_note}</p>
                        </div>
                      )}
                    </div>

                    {/* Action button */}
                    <div className="shrink-0 self-end sm:self-start">
                      <button
                        onClick={() => openActionModal(r)}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-800 dark:text-stone-200 text-xs font-bold transition-all border border-stone-300 dark:border-stone-700 hover:scale-[1.02]"
                      >
                        <ShieldAlert className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                        <span>Xử lý báo cáo</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        </div>

        {/* Action Modal */}
        {selected && (
          <div
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in"
            onClick={() => setSelected(null)}
          >
            <div
              className="bg-white dark:bg-stone-900 rounded-3xl border border-stone-200 dark:border-stone-800 p-6 w-full max-w-lg shadow-2xl space-y-5"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between pb-3 border-b border-stone-200 dark:border-stone-800">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center border border-rose-200/50">
                    <ShieldAlert className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-stone-900 dark:text-white">
                      Xử Lý Báo Cáo Vi Phạm
                    </h3>
                    <p className="text-xs text-stone-500">
                      Cập nhật kết quả giải quyết và ghi chú nội bộ
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSelected(null)}
                  className="p-1.5 rounded-xl text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Reported details summary */}
              <div className="p-3.5 rounded-2xl bg-stone-50 dark:bg-stone-800/40 border border-stone-200 dark:border-stone-700/60 text-xs space-y-1.5">
                <div>
                  <span className="text-stone-400">Bài viết: </span>
                  <strong className="text-stone-900 dark:text-white font-bold">{selected.post_title}</strong>
                </div>
                <div className="flex items-center gap-3">
                  <span>
                    Lý do: <strong className="text-stone-800 dark:text-stone-200">{REPORT_REASONS[selected.reason] || selected.reason}</strong>
                  </span>
                  <span>•</span>
                  <span>
                    Người báo: <strong className="text-stone-800 dark:text-stone-200">{selected.reporter_username || "Ẩn danh"}</strong>
                  </span>
                </div>
                {selected.description && (
                  <p className="italic text-stone-500 pt-1">"{selected.description}"</p>
                )}
              </div>

              <form onSubmit={handleActionSubmit} className="space-y-4">
                {/* Status Selector Options */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-stone-700 dark:text-stone-300 uppercase tracking-wider block">
                    Chọn trạng thái xử lý:
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {(["pending", "reviewed", "dismissed", "action_taken"] as const).map((st) => {
                      const cfg = STATUS_CONFIG[st];
                      const Icon = cfg.icon;
                      const isChosen = newStatus === st;
                      return (
                        <button
                          key={st}
                          type="button"
                          onClick={() => setNewStatus(st)}
                          className={`p-3 rounded-2xl border text-left flex items-start gap-2.5 transition-all text-xs ${
                            isChosen
                              ? "border-blue-500 bg-blue-50/60 dark:bg-blue-950/40 ring-2 ring-blue-500/20 font-bold"
                              : "border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 hover:border-stone-400"
                          }`}
                        >
                          <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${isChosen ? "text-blue-600 dark:text-blue-400" : "text-stone-400"}`} />
                          <div className="min-w-0">
                            <span className={isChosen ? "text-blue-900 dark:text-blue-200" : "text-stone-700 dark:text-stone-300"}>
                              {cfg.label}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Admin Note Textarea */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-stone-700 dark:text-stone-300 uppercase tracking-wider block">
                    Ghi chú của Quản trị viên (Admin Note):
                  </label>
                  <textarea
                    value={adminNote}
                    onChange={(e) => setAdminNote(e.target.value)}
                    placeholder="Mô tả hành động đã xử lý (Ví dụ: Đã gỡ bài viết, đã cảnh cáo tác giả, hoặc bài viết hợp lệ không vi phạm)..."
                    rows={3}
                    className="w-full text-xs p-3 rounded-2xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-white placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none font-medium leading-relaxed"
                  />
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-stone-100 dark:border-stone-800">
                  <button
                    type="button"
                    onClick={() => setSelected(null)}
                    className="px-4 py-2.5 rounded-xl border border-stone-200 dark:border-stone-700 text-xs font-semibold text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
                  >
                    Hủy bỏ
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md shadow-blue-500/20 transition-all hover:scale-[1.02]"
                  >
                    Lưu cập nhật
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AdminGuard>
  );
}
