"use client";

import React, { useEffect, useState, useCallback } from "react";
import {
  Users,
  Check,
  X,
  Trash2,
  Clock,
  UserCheck,
  UserPlus,
  ShieldAlert,
  Loader2,
  RefreshCw,
  MessageSquare,
  AlertCircle,
} from "lucide-react";
import {
  getCollaborators,
  updateCollaborator,
  removeCollaborator,
  addCollaboratorDirect,
  getFullImageUrl,
} from "@/lib/api";
import { Collaborator, User } from "@/lib/types";
import { LoadingOverlay } from "@/components/common/LoadingOverlay";

interface SeriesCollaboratorsManagerProps {
  seriesId: string;
  seriesTitle: string;
  token: string;
  users?: User[]; // for direct adding
  onCountChange?: (pendingCount: number, totalCount: number) => void;
  onClose?: () => void;
  compact?: boolean;
}

export function SeriesCollaboratorsManager({
  seriesId,
  seriesTitle,
  token,
  users = [],
  onCountChange,
  onClose,
  compact = false,
}: SeriesCollaboratorsManagerProps) {
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [selectedUserIdToAdd, setSelectedUserIdToAdd] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [showRejected, setShowRejected] = useState(false);

  const loadData = useCallback(async () => {
    if (!token || !seriesId) return;
    setLoading(true);
    setActionError(null);
    try {
      const data = await getCollaborators(seriesId, token);
      setCollaborators(data);
      const pending = data.filter((c) => c.status === "pending").length;
      const total = data.length;
      if (onCountChange) {
        onCountChange(pending, total);
      }
    } catch (err: unknown) {
      console.error("Lỗi tải danh sách cộng tác viên:", err);
      setActionError(err instanceof Error ? err.message : "Không thể tải danh sách cộng tác viên");
    } finally {
      setLoading(false);
    }
  }, [seriesId, token, onCountChange]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleUpdateStatus = async (
    userId: string,
    userName: string,
    status: "accepted" | "rejected"
  ) => {
    setActionError(null);
    setActionSuccess(null);
    const label = status === "accepted" ? "Phê duyệt" : "Từ chối";
    setActionLoading(`Đang ${label.toLowerCase()} yêu cầu...`);
    try {
      await updateCollaborator(seriesId, userId, status, token);
      setActionSuccess(`Đã ${label.toLowerCase()} yêu cầu của "${userName}" thành công.`);
      await loadData();
      setTimeout(() => setActionSuccess(null), 3500);
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : `${label} thất bại`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleRemove = async (userId: string, userName: string) => {
    if (!window.confirm(`Bạn có chắc chắn muốn gỡ quyền cộng tác của "${userName}"?`)) {
      return;
    }
    setActionError(null);
    setActionSuccess(null);
    setActionLoading("Đang gỡ quyền cộng tác viên...");
    try {
      await removeCollaborator(seriesId, userId, token);
      setActionSuccess(`Đã gỡ quyền cộng tác của "${userName}".`);
      await loadData();
      setTimeout(() => setActionSuccess(null), 3500);
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : "Gỡ cộng tác viên thất bại");
    } finally {
      setActionLoading(null);
    }
  };

  const handleDirectAdd = async () => {
    if (!selectedUserIdToAdd) return;
    setActionError(null);
    setActionSuccess(null);
    setActionLoading("Đang thêm cộng tác viên...");
    try {
      await addCollaboratorDirect(seriesId, selectedUserIdToAdd, token);
      setSelectedUserIdToAdd("");
      setActionSuccess("Đã thêm cộng tác viên thành công.");
      await loadData();
      setTimeout(() => setActionSuccess(null), 3500);
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : "Thêm cộng tác viên thất bại");
    } finally {
      setActionLoading(null);
    }
  };

  const pendingList = collaborators.filter((c) => c.status === "pending");
  const acceptedList = collaborators.filter((c) => c.status === "accepted");
  const rejectedList = collaborators.filter((c) => c.status === "rejected");

  // Filter users not already in collaborators
  const existingUserIds = new Set(collaborators.map((c) => c.user_id));
  const availableUsersToAdd = users.filter((u) => !existingUserIds.has(u.id));

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-stone-200 dark:border-stone-800">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 border border-blue-200/50">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-stone-900 dark:text-white flex items-center gap-2">
              <span>Cộng Tác Viên &amp; Phê Duyệt</span>
              {pendingList.length > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500 text-white animate-pulse">
                  {pendingList.length} yêu cầu mới
                </span>
              )}
            </h4>
            <p className="text-xs text-stone-500 truncate max-w-md">
              Khoá học: <strong className="font-semibold text-stone-700 dark:text-stone-300">{seriesTitle}</strong>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
          <button
            onClick={loadData}
            disabled={loading}
            className="p-1.5 rounded-lg border border-stone-200 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-500 transition-colors"
            title="Làm mới danh sách"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-blue-600" : ""}`} />
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg border border-stone-200 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-400 hover:text-stone-600 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Action alerts */}
      {actionError && (
        <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
          <span>{actionError}</span>
        </div>
      )}

      {actionSuccess && (
        <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
          <Check className="w-4 h-4 shrink-0 text-emerald-600" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* Main Content Loading */}
      <div className="relative min-h-[180px]">
        <LoadingOverlay
          isLoading={loading || Boolean(actionLoading)}
          message={actionLoading || "Đang tải cộng tác viên..."}
        />

        {loading && collaborators.length === 0 ? (
          <div className="space-y-3 animate-pulse">
            {[1, 2].map((i) => (
              <div key={i} className="h-20 rounded-2xl bg-stone-100 dark:bg-stone-800" />
            ))}
          </div>
        ) : (
          <div
            className={`space-y-6 transition-opacity duration-200 ${
              loading || actionLoading ? "opacity-40 pointer-events-none" : ""
            }`}
          >
          {/* 1. YÊU CẦU CHỜ DUYỆT (PENDING REQUESTS) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider">
                <Clock className="w-3.5 h-3.5" />
                <span>Yêu cầu chờ phê duyệt ({pendingList.length})</span>
              </div>
            </div>

            {pendingList.length === 0 ? (
              <div className="p-4 rounded-2xl border border-dashed border-stone-200 dark:border-stone-800 bg-stone-50/50 dark:bg-stone-900/30 text-center text-xs text-stone-400">
                Hiện không có yêu cầu xin cộng tác nào đang chờ xử lý.
              </div>
            ) : (
              <div className="space-y-2.5">
                {pendingList.map((c) => {
                  const displayName = c.full_name || c.username;
                  return (
                    <div
                      key={c.id}
                      className="p-4 rounded-2xl border border-amber-200/90 dark:border-amber-900/60 bg-gradient-to-r from-amber-50/80 via-white to-amber-50/40 dark:from-amber-950/20 dark:via-stone-900 dark:to-amber-950/10 shadow-xs space-y-3 transition-all"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          {c.avatar_url ? (
                            <img
                              src={getFullImageUrl(c.avatar_url)}
                              alt={displayName}
                              className="w-10 h-10 rounded-xl object-cover border border-amber-200 dark:border-amber-800 shrink-0"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 text-white font-bold flex items-center justify-center text-sm shrink-0 shadow-xs">
                              {displayName.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div className="min-w-0">
                            <h5 className="font-bold text-xs sm:text-sm text-stone-900 dark:text-white truncate">
                              {displayName}
                            </h5>
                            <p className="text-[11px] text-stone-500 truncate">@{c.username}</p>
                            <p className="text-[10px] text-stone-400 mt-0.5">
                              Gửi lúc: {new Date(c.created_at).toLocaleString("vi-VN")}
                            </p>
                          </div>
                        </div>

                        {/* Approval / Rejection Action Buttons */}
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={() => handleUpdateStatus(c.user_id, displayName, "rejected")}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-rose-300 dark:border-rose-800 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs font-semibold transition-colors"
                            title="Từ chối yêu cầu"
                          >
                            <X className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Từ chối</span>
                          </button>
                          <button
                            onClick={() => handleUpdateStatus(c.user_id, displayName, "accepted")}
                            className="inline-flex items-center gap-1 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs shadow-emerald-600/20 transition-all hover:scale-[1.02]"
                            title="Phê duyệt quyền cộng tác"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Phê duyệt</span>
                          </button>
                        </div>
                      </div>

                      {/* Optional message from member */}
                      {c.message && (
                        <div className="p-2.5 rounded-xl bg-white/80 dark:bg-stone-800/80 border border-amber-200/60 dark:border-amber-900/40 text-xs text-stone-700 dark:text-stone-300 flex items-start gap-2">
                          <MessageSquare className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                          <div className="leading-relaxed">
                            <span className="font-semibold text-[11px] text-stone-500 uppercase tracking-wider block mb-0.5">
                              Lời nhắn từ thành viên:
                            </span>
                            <span className="italic">"{c.message}"</span>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 2. CỘNG TÁC VIÊN CHÍNH THỨC (ACTIVE COLLABORATORS) */}
          <div className="space-y-3 pt-2 border-t border-stone-200 dark:border-stone-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-stone-700 dark:text-stone-300 uppercase tracking-wider">
                <UserCheck className="w-3.5 h-3.5 text-blue-600" />
                <span>Cộng tác viên đang hoạt động ({acceptedList.length})</span>
              </div>
            </div>

            {acceptedList.length === 0 ? (
              <div className="p-4 rounded-2xl border border-stone-200 dark:border-stone-800 bg-stone-50/50 dark:bg-stone-900/30 text-center text-xs text-stone-400">
                Chưa có cộng tác viên nào. Bạn có thể thêm thành viên trực tiếp bên dưới hoặc chờ thành viên gửi yêu cầu.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {acceptedList.map((c) => {
                  const displayName = c.full_name || c.username;
                  return (
                    <div
                      key={c.id}
                      className="p-3 rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 flex items-center justify-between gap-3 shadow-xs hover:border-blue-300 dark:hover:border-blue-700 transition-all"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        {c.avatar_url ? (
                          <img
                            src={getFullImageUrl(c.avatar_url)}
                            alt={displayName}
                            className="w-8 h-8 rounded-xl object-cover border border-stone-200 dark:border-stone-700 shrink-0"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white font-bold flex items-center justify-center text-xs shrink-0">
                            {displayName.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div className="min-w-0">
                          <h6 className="font-bold text-xs text-stone-900 dark:text-white truncate">
                            {displayName}
                          </h6>
                          <p className="text-[10px] text-stone-500 truncate">@{c.username}</p>
                        </div>
                      </div>

                      <button
                        onClick={() => handleRemove(c.user_id, displayName)}
                        className="p-1.5 rounded-lg text-stone-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                        title="Gỡ quyền cộng tác viên"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 3. THÊM CỘNG TÁC VIÊN TRỰC TIẾP */}
          {users.length > 0 && (
            <div className="space-y-2.5 p-3.5 rounded-2xl bg-stone-50 dark:bg-stone-800/40 border border-stone-200 dark:border-stone-700/70">
              <label className="text-xs font-semibold text-stone-700 dark:text-stone-300 flex items-center gap-1.5">
                <UserPlus className="w-3.5 h-3.5 text-blue-600" />
                <span>Thêm trực tiếp cộng tác viên từ danh sách thành viên:</span>
              </label>

              <div className="flex items-center gap-2">
                <select
                  value={selectedUserIdToAdd}
                  onChange={(e) => setSelectedUserIdToAdd(e.target.value)}
                  className="flex-1 px-3 py-1.5 text-xs rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                >
                  <option value="">-- Chọn thành viên để thêm quyền cộng tác --</option>
                  {availableUsersToAdd.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.full_name ? `${u.full_name} (@${u.username})` : `@${u.username}`}
                      {u.is_admin ? " [Quản trị viên]" : ""}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  disabled={!selectedUserIdToAdd}
                  onClick={handleDirectAdd}
                  className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold shrink-0 shadow-xs transition-colors flex items-center gap-1"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Thêm</span>
                </button>
              </div>
              <p className="text-[10px] text-stone-500">
                Thành viên được thêm sẽ có toàn quyền biên soạn bài viết và sắp xếp chương trong khoá học này.
              </p>
            </div>
          )}

          {/* 4. DANH SÁCH ĐÃ TỪ CHỐI (OPTIONAL TOGGLE) */}
          {rejectedList.length > 0 && (
            <div className="space-y-2 pt-2">
              <button
                type="button"
                onClick={() => setShowRejected(!showRejected)}
                className="text-[11px] font-semibold text-stone-500 hover:text-stone-800 dark:hover:text-stone-200 flex items-center gap-1 transition-colors"
              >
                <span>{showRejected ? "Ẩn" : "Xem"} {rejectedList.length} yêu cầu đã từ chối</span>
              </button>

              {showRejected && (
                <div className="space-y-2 pl-2 border-l-2 border-stone-200 dark:border-stone-800">
                  {rejectedList.map((c) => {
                    const displayName = c.full_name || c.username;
                    return (
                      <div
                        key={c.id}
                        className="p-2.5 rounded-xl bg-stone-100/60 dark:bg-stone-800/40 text-xs flex items-center justify-between gap-3 text-stone-500"
                      >
                        <div className="truncate">
                          <span className="font-semibold text-stone-700 dark:text-stone-300">
                            {displayName}
                          </span>{" "}
                          <span className="text-[10px]">(@{c.username})</span>
                          <span className="text-[10px] text-rose-500 ml-2 font-medium">Đã từ chối</span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={() => handleUpdateStatus(c.user_id, displayName, "accepted")}
                            className="text-[10px] font-bold text-blue-600 hover:underline"
                          >
                            Phê duyệt lại
                          </button>
                          <button
                            onClick={() => handleRemove(c.user_id, displayName)}
                            className="text-[10px] text-stone-400 hover:text-rose-600"
                          >
                            Xóa
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
        )}
      </div>
    </div>
  );
}
