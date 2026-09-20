"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { getNotifications, markNotificationRead, markAllNotificationsRead } from "@/lib/api";
import { Notification } from "@/lib/types";
import { Bell, CheckCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const NOTIF_ICONS: Record<string, string> = {
  collab_request: "🤝",
  collab_accepted: "✅",
  collab_rejected: "❌",
  new_follower: "👤",
  new_post: "📝",
};

const NOTIF_LABELS: Record<string, string> = {
  collab_request: "Yêu cầu cộng tác",
  collab_accepted: "Cộng tác được chấp nhận",
  collab_rejected: "Cộng tác bị từ chối",
  new_follower: "Người theo dõi mới",
  new_post: "Bài viết mới",
};

export default function NotificationsPage() {
  const { user, token } = useAuth();
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !token) { router.push("/"); return; }
    loadNotifications();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, token]);

  const loadNotifications = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await getNotifications(token, 50);
      setNotifications(data);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkRead = async (id: string) => {
    if (!token) return;
    await markNotificationRead(id, token);
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
  };

  const handleMarkAllRead = async () => {
    if (!token) return;
    await markAllNotificationsRead(token);
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
  };

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg">
            <Bell className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-stone-900 dark:text-white">Thông báo</h1>
            <p className="text-sm text-stone-500">{unreadCount} chưa đọc</p>
          </div>
        </div>
        {unreadCount > 0 && (
          <button onClick={handleMarkAllRead} className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium transition-colors">
            <CheckCheck className="w-4 h-4" />
            Đọc tất cả
          </button>
        )}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-20 bg-stone-100 dark:bg-stone-800 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : notifications.length === 0 ? (
        <div className="text-center py-16 text-stone-400">
          <Bell className="w-12 h-12 mx-auto mb-4 opacity-30" />
          <p className="text-lg font-medium">Chưa có thông báo nào</p>
          <p className="text-sm mt-1">Các thông báo sẽ xuất hiện ở đây khi có hoạt động mới</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map((n) => (
            <div
              key={n.id}
              onClick={() => !n.is_read && handleMarkRead(n.id)}
              className={`flex items-start gap-4 p-4 rounded-2xl border transition-all cursor-pointer hover:shadow-sm ${
                !n.is_read
                  ? "bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900"
                  : "bg-white dark:bg-stone-900 border-stone-200 dark:border-stone-800"
              }`}
            >
              <span className="text-2xl shrink-0 mt-0.5">{NOTIF_ICONS[n.type] || "🔔"}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wider">
                    {NOTIF_LABELS[n.type] || n.type}
                  </span>
                  {!n.is_read && <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />}
                </div>
                <p className="text-sm text-stone-800 dark:text-stone-200 leading-relaxed">{n.message}</p>
                {n.target_id && n.target_type === "series" && (
                  <Link
                    href={
                      n.type === "collab_request"
                        ? (user?.is_admin || user?.role === "admin"
                            ? `/admin/series?id=${n.target_id}&tab=collaborators`
                            : `/series?id=${n.target_id}&tab=collaborators`)
                        : `/series?id=${n.target_id}`
                    }
                    className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline mt-1.5 inline-flex items-center gap-1"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <span>
                      {n.type === "collab_request"
                        ? "Xem và phê duyệt yêu cầu cộng tác →"
                        : "Xem khóa học →"}
                    </span>
                  </Link>
                )}
                <p className="text-xs text-stone-400 mt-1">{new Date(n.created_at).toLocaleString("vi-VN")}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
