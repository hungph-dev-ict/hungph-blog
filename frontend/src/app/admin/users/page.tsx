"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Users,
  Shield,
  UserCheck,
  Trash2,
  Lock,
  Unlock,
  BookOpen,
  FolderTree,
  GraduationCap,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { fetchUsers, updateUserRole, deleteUser } from "@/lib/api";
import { User } from "@/lib/types";
import { Breadcrumbs } from "@/components/common/Breadcrumbs";
import { AdminNav } from "@/components/admin/AdminNav";
import { AdminGuard } from "@/components/admin/AdminGuard";
import { useLoading } from "@/lib/loading-context";

export default function AdminUsersPage() {
  const router = useRouter();
  const { user: currentUser, token, isLoading } = useAuth();
  const { withLoading } = useLoading();

  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const isAdmin = currentUser?.is_admin || currentUser?.role === "admin";

  const loadUsers = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await fetchUsers(token);
      setUsers(data);
    } catch (err) {
      console.error("Lỗi khi tải danh sách thành viên:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token && isAdmin) {
      loadUsers();
    }
  }, [token, isAdmin]);

  const handleToggleRole = async (targetUser: User) => {
    if (!token) return;
    const newRole = targetUser.role === "admin" ? "member" : "admin";
    const actionText =
      newRole === "admin"
        ? `cấp quyền Quản Trị Viên (Admin) cho "${targetUser.full_name || targetUser.email}"`
        : `hạ quyền thành Thành Viên (Member) của "${targetUser.full_name || targetUser.email}"`;

    if (!window.confirm(`Bạn có chắc muốn ${actionText}?`)) return;

    setActionLoading(targetUser.id);
    await withLoading(async () => {
      try {
        await updateUserRole(targetUser.id, newRole, targetUser.is_active, token);
        await loadUsers();
      } catch (err: any) {
        alert(`Lỗi: ${err.message}`);
      } finally {
        setActionLoading(null);
      }
    }, `Đang cập nhật quyền của "${targetUser.full_name || targetUser.email}"...`);
  };

  const handleToggleActive = async (targetUser: User) => {
    if (!token) return;
    const newActive = !targetUser.is_active;
    const actionText = newActive ? "mở khóa" : "khóa tạm thời";

    if (!window.confirm(`Bạn có chắc muốn ${actionText} tài khoản này?`)) return;

    setActionLoading(targetUser.id);
    await withLoading(async () => {
      try {
        await updateUserRole(targetUser.id, targetUser.role || "member", newActive, token);
        await loadUsers();
      } catch (err: any) {
        alert(`Lỗi: ${err.message}`);
      } finally {
        setActionLoading(null);
      }
    }, `Đang ${actionText} tài khoản...`);
  };

  const handleDelete = async (targetUser: User) => {
    if (!token) return;
    if (!window.confirm(`Xóa vĩnh viễn tài khoản "${targetUser.email}"? Thao tác này không thể hoàn tác!`)) return;

    setActionLoading(targetUser.id);
    await withLoading(async () => {
      try {
        await deleteUser(targetUser.id, token);
        setUsers((prev) => prev.filter((u) => u.id !== targetUser.id));
      } catch (err: any) {
        alert(`Lỗi: ${err.message}`);
      } finally {
        setActionLoading(null);
      }
    }, `Đang xóa tài khoản "${targetUser.email}"...`);
  };

  if (isLoading || !currentUser || !isAdmin) {
    return (
      <div className="py-20 text-center text-sm text-stone-500 animate-pulse">
        Đang xác thực quyền Quản trị viên...
      </div>
    );
  }

  const totalAdmins = users.filter((u) => u.role === "admin" || u.is_admin).length;
  const totalMembers = users.length - totalAdmins;

  return (
    <AdminGuard requireAdmin={true}>
      <div className="w-full space-y-6 pb-16">
      <Breadcrumbs
        items={[
          { label: "Quản trị", href: "/admin/posts" },
          { label: "Quản lý thành viên" },
        ]}
      />

      {/* Top Bar */}
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
              <Users className="w-6 h-6 text-blue-600" />
              <span>Quản Lý Thành Viên & Cấp Quyền</span>
            </h1>
            <p className="text-xs text-stone-500">
              Quản trị người dùng đăng nhập qua Google SSO: Phân quyền Admin (sửa bài, duyệt bài) & Member (chỉ viết bài, bình luận).
            </p>
          </div>
        </div>

        {/* Admin Navigation */}
        <AdminNav currentTab="users" disabled={Boolean(actionLoading)} />
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900/60 space-y-1">
          <div className="text-xs text-stone-500">Tổng số người dùng</div>
          <div className="text-2xl font-bold text-stone-900 dark:text-white">{users.length}</div>
        </div>
        <div className="p-4 rounded-2xl border border-purple-200 dark:border-purple-900/50 bg-purple-50/50 dark:bg-purple-950/20 space-y-1">
          <div className="text-xs text-purple-700 dark:text-purple-300 font-medium">Quản trị viên (Admin)</div>
          <div className="text-2xl font-bold text-purple-900 dark:text-purple-100">{totalAdmins}</div>
        </div>
        <div className="p-4 rounded-2xl border border-blue-200 dark:border-blue-900/50 bg-blue-50/50 dark:bg-blue-950/20 space-y-1">
          <div className="text-xs text-blue-700 dark:text-blue-300 font-medium">Thành viên (Member)</div>
          <div className="text-2xl font-bold text-blue-900 dark:text-blue-100">{totalMembers}</div>
        </div>
      </div>

      {/* Users Table */}
      <div className="rounded-3xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900/60 overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-8 space-y-4 animate-pulse">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 rounded-xl bg-stone-100 dark:bg-stone-800" />
            ))}
          </div>
        ) : users.length === 0 ? (
          <div className="p-12 text-center text-xs text-stone-400">
            Chưa có thành viên nào khác trong hệ thống.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-800/40 text-stone-500 uppercase font-semibold">
                <tr>
                  <th className="px-6 py-3.5">Thành viên</th>
                  <th className="px-6 py-3.5">Vai trò (Role)</th>
                  <th className="px-6 py-3.5">Trạng thái</th>
                  <th className="px-6 py-3.5">Ngày tham gia</th>
                  <th className="px-6 py-3.5 text-right">Hành động</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
                {users.map((u) => {
                  const isUserAdmin = u.role === "admin" || u.is_admin;
                  const isCurrent = u.id === currentUser.id;

                  return (
                    <tr key={u.id} className="hover:bg-stone-50/50 dark:hover:bg-stone-800/30 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          {u.avatar_url ? (
                            <img src={u.avatar_url} alt="" className="w-9 h-9 rounded-full object-cover shrink-0" />
                          ) : (
                            <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-bold flex items-center justify-center text-xs shrink-0 shadow-sm">
                              {u.full_name?.charAt(0) || u.username?.charAt(0) || "U"}
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="font-bold text-stone-900 dark:text-white flex items-center gap-1.5 truncate">
                              <span>{u.full_name || u.username}</span>
                              {isCurrent && (
                                <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 font-semibold">
                                  Bạn
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-stone-400 truncate">{u.email}</div>
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        {isUserAdmin ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                            <Shield className="w-3 h-3" />
                            <span>Quản trị viên (Admin)</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 border border-stone-200 dark:border-stone-700">
                            <UserCheck className="w-3 h-3" />
                            <span>Thành viên (Member)</span>
                          </span>
                        )}
                      </td>

                      <td className="px-6 py-4">
                        {u.is_active !== false ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            <span>Hoạt động</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-rose-500">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                            <span>Đã khóa</span>
                          </span>
                        )}
                      </td>

                      <td className="px-6 py-4 text-stone-400 text-[11px]">
                        {new Date(u.created_at).toLocaleDateString("vi-VN")}
                      </td>

                      <td className="px-6 py-4 text-right">
                        {!isCurrent && (
                          <div className="flex items-center justify-end gap-2">
                            {/* Toggle Role Button */}
                            <button
                              disabled={actionLoading === u.id}
                              onClick={() => handleToggleRole(u)}
                              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all border ${
                                isUserAdmin
                                  ? "border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800"
                                  : "border-purple-300 dark:border-purple-800 bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 hover:bg-purple-100"
                              }`}
                            >
                              {isUserAdmin ? "Hạ thành Member" : "Nâng làm Admin"}
                            </button>

                            {/* Toggle Active Button */}
                            <button
                              disabled={actionLoading === u.id}
                              onClick={() => handleToggleActive(u)}
                              className="p-1.5 rounded-lg border border-stone-200 dark:border-stone-700 text-stone-500 hover:text-stone-800 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800"
                              title={u.is_active !== false ? "Khóa tài khoản" : "Mở khóa"}
                            >
                              {u.is_active !== false ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5 text-emerald-500" />}
                            </button>

                            {/* Delete User Button */}
                            <button
                              disabled={actionLoading === u.id}
                              onClick={() => handleDelete(u)}
                              className="p-1.5 rounded-lg border border-stone-200 dark:border-stone-700 text-stone-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                              title="Xóa tài khoản"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      </div>
    </AdminGuard>
  );
}
