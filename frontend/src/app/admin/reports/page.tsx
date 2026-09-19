"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { getAdminReports, updateReport } from "@/lib/api";
import { PostReport, REPORT_REASONS } from "@/lib/types";
import { Flag, CheckCircle, XCircle, AlertCircle, Clock } from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const STATUS_CONFIG = {
  pending: { label: "Chờ xét", color: "text-amber-600 bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800", icon: Clock },
  reviewed: { label: "Đã xem", color: "text-blue-600 bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800", icon: AlertCircle },
  dismissed: { label: "Bỏ qua", color: "text-stone-500 bg-stone-50 dark:bg-stone-800/50 border-stone-200 dark:border-stone-700", icon: XCircle },
  action_taken: { label: "Đã xử lý", color: "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800", icon: CheckCircle },
} as const;

export default function AdminReportsPage() {
  const { user, token } = useAuth();
  const router = useRouter();
  const [reports, setReports] = useState<PostReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [selected, setSelected] = useState<PostReport | null>(null);
  const [adminNote, setAdminNote] = useState("");
  const [newStatus, setNewStatus] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user || !(user.is_admin || user.role === "admin")) {
      router.push("/");
      return;
    }
    loadReports();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  const loadReports = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await getAdminReports(token, statusFilter || undefined);
      setReports(data);
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async () => {
    if (!selected || !token || !newStatus) return;
    setSaving(true);
    try {
      await updateReport(selected.id, newStatus, adminNote || undefined, token);
      setReports((prev) => prev.map((r) => r.id === selected.id ? { ...r, status: newStatus as PostReport["status"], admin_note: adminNote } : r));
      setSelected(null);
      setAdminNote("");
      setNewStatus("");
    } finally {
      setSaving(false);
    }
  };

  const pendingCount = reports.filter((r) => r.status === "pending").length;

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-rose-500 to-red-600 flex items-center justify-center shadow-lg">
            <Flag className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-stone-900 dark:text-white">Quản lý Tố cáo</h1>
            {pendingCount > 0 && (
              <p className="text-sm text-rose-600 font-medium">{pendingCount} báo cáo chờ xét duyệt</p>
            )}
          </div>
        </div>

        {/* Filter */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="text-sm px-3 py-2 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-700 dark:text-stone-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Tất cả</option>
          <option value="pending">Chờ xét</option>
          <option value="reviewed">Đã xem</option>
          <option value="dismissed">Bỏ qua</option>
          <option value="action_taken">Đã xử lý</option>
        </select>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-24 bg-stone-100 dark:bg-stone-800 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : reports.length === 0 ? (
        <div className="text-center py-16 text-stone-400">
          <Flag className="w-12 h-12 mx-auto mb-4 opacity-30" />
          <p className="text-lg font-medium">Không có báo cáo nào</p>
        </div>
      ) : (
        <div className="space-y-3">
          {reports.map((r) => {
            const sc = STATUS_CONFIG[r.status] || STATUS_CONFIG.pending;
            const StatusIcon = sc.icon;
            return (
              <div key={r.id} className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl p-5 hover:shadow-sm transition-shadow">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                      <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full border ${sc.color}`}>
                        <StatusIcon className="w-3.5 h-3.5" />
                        {sc.label}
                      </span>
                      <span className="text-xs px-2.5 py-1 rounded-full bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 font-medium">
                        {REPORT_REASONS[r.reason] || r.reason}
                      </span>
                    </div>

                    <div className="mb-2">
                      <span className="text-xs text-stone-400">Bài viết: </span>
                      <Link href={`/posts/${r.post_id}`} className="text-sm font-semibold text-stone-900 dark:text-white hover:text-blue-600 transition-colors">
                        {r.post_title || r.post_id}
                      </Link>
                    </div>

                    <p className="text-xs text-stone-500 mb-1">
                      Báo cáo bởi: <strong>{r.reporter_username || "Ẩn danh"}</strong> · {new Date(r.created_at).toLocaleString("vi-VN")}
                    </p>

                    {r.description && (
                      <p className="text-sm text-stone-600 dark:text-stone-400 italic bg-stone-50 dark:bg-stone-800/50 rounded-lg px-3 py-2 mt-2">
                        "{r.description}"
                      </p>
                    )}

                    {r.admin_note && (
                      <p className="text-xs text-blue-600 dark:text-blue-400 mt-2">
                        📝 Ghi chú admin: {r.admin_note}
                      </p>
                    )}
                  </div>

                  <button
                    onClick={() => { setSelected(r); setNewStatus(r.status); setAdminNote(r.admin_note || ""); }}
                    className="shrink-0 text-xs font-semibold px-3 py-1.5 rounded-xl border border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
                  >
                    Xử lý
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Action Modal */}
      {selected && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setSelected(null)}>
          <div className="bg-white dark:bg-stone-900 rounded-3xl border border-stone-200 dark:border-stone-800 p-6 w-full max-w-md shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-stone-900 dark:text-white mb-1">Xử lý báo cáo</h3>
            <p className="text-sm text-stone-500 mb-5">Bài: <strong>{selected.post_title}</strong></p>

            <div className="mb-4">
              <label className="block text-sm font-semibold text-stone-700 dark:text-stone-300 mb-2">Trạng thái</label>
              <select
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value)}
                className="w-full text-sm px-3 py-2.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-800 dark:text-stone-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="pending">Chờ xét</option>
                <option value="reviewed">Đã xem</option>
                <option value="dismissed">Bỏ qua (không vi phạm)</option>
                <option value="action_taken">Đã xử lý (vi phạm xác nhận)</option>
              </select>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-semibold text-stone-700 dark:text-stone-300 mb-2">Ghi chú Admin</label>
              <textarea
                value={adminNote}
                onChange={(e) => setAdminNote(e.target.value)}
                placeholder="Mô tả action đã thực hiện..."
                rows={3}
                className="w-full text-sm px-3 py-2.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-800 dark:text-stone-200 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>

            <div className="flex gap-3">
              <button onClick={() => setSelected(null)} className="flex-1 py-2.5 rounded-xl border border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-400 text-sm font-semibold hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors">
                Hủy
              </button>
              <button onClick={handleAction} disabled={saving} className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors disabled:opacity-50">
                {saving ? "Đang lưu..." : "Cập nhật"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
