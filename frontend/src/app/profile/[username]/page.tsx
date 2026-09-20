"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useLoading } from "@/lib/loading-context";
import { getUserProfile, getFollowStatus, toggleFollow, fetchPosts } from "@/lib/api";
import { UserProfile, FollowStatus, PostListItem } from "@/lib/types";
import { Users, UserCheck, Calendar, BookOpen, Plus, FileText, ArrowLeft } from "lucide-react";
import { PostCard } from "@/components/blog/PostCard";
import { Breadcrumbs } from "@/components/common/Breadcrumbs";
import { LoadingOverlay } from "@/components/common/LoadingOverlay";
import Link from "next/link";

export default function ProfilePage() {
  const { username } = useParams<{ username: string }>();
  const { user, token } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [followStatus, setFollowStatus] = useState<FollowStatus | null>(null);
  const [posts, setPosts] = useState<PostListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [followLoading, setFollowLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!username) return;
    loadProfile();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [username, token]);

  const loadProfile = async () => {
    setLoading(true);
    setError("");
    try {
      const p = await getUserProfile(username);
      setProfile(p);
      const [status, postData] = await Promise.all([
        getFollowStatus(p.id, token || undefined),
        fetchPosts({ author_id: p.id, limit: 20, page: 1 }),
      ]);
      setFollowStatus(status);
      setPosts(postData.items || []);
    } catch {
      setError("Không tìm thấy thông tin người dùng này.");
    } finally {
      setLoading(false);
    }
  };

  const handleFollow = async () => {
    if (!token || !profile) return;
    setFollowLoading(true);
    try {
      const result = await toggleFollow(profile.id, token);
      setFollowStatus(result);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Lỗi không xác định");
    } finally {
      setFollowLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-12 space-y-6">
        <div className="h-4 bg-stone-200 dark:bg-stone-800 rounded-lg animate-pulse w-48" />
        <div className="rounded-3xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-8 space-y-4">
          <div className="flex items-center gap-6">
            <div className="w-24 h-24 rounded-2xl bg-stone-200 dark:bg-stone-800 animate-pulse shrink-0" />
            <div className="space-y-2.5 flex-1">
              <div className="h-6 bg-stone-200 dark:bg-stone-800 rounded-lg animate-pulse w-48" />
              <div className="h-4 bg-stone-200 dark:bg-stone-800 rounded-lg animate-pulse w-32" />
              <div className="h-4 bg-stone-200 dark:bg-stone-800 rounded-lg animate-pulse w-64" />
            </div>
          </div>
        </div>
        <div className="h-44 rounded-2xl border border-stone-200 dark:border-stone-800 bg-white/50 dark:bg-stone-900/50 animate-pulse" />
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-16 text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-stone-100 dark:bg-stone-800 flex items-center justify-center text-stone-400 mx-auto">
          <Users className="w-8 h-8 opacity-40" />
        </div>
        <h2 className="text-xl font-bold text-stone-900 dark:text-white">
          {error || "Không tìm thấy người dùng"}
        </h2>
        <p className="text-sm text-stone-500 max-w-sm mx-auto">
          Tài khoản này có thể không tồn tại hoặc đã bị vô hiệu hóa.
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-stone-900 dark:bg-white text-white dark:text-stone-900 text-xs font-semibold hover:opacity-90 transition-opacity"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Về trang chủ</span>
        </Link>
      </div>
    );
  }

  const isOwnProfile = user?.username === profile.username;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      {/* Breadcrumbs */}
      <Breadcrumbs
        items={[
          { label: "Trang chủ", href: "/" },
          { label: "Thành viên", href: "/" },
          { label: profile.full_name || `@${profile.username}` },
        ]}
      />

      {/* Profile Header Card */}
      <div className="rounded-3xl border border-stone-200/80 dark:border-stone-800 bg-white dark:bg-stone-900/80 shadow-sm overflow-hidden">
        {/* Banner with subtle ambient gradient */}
        <div className="h-32 sm:h-40 bg-gradient-to-r from-blue-600/20 via-purple-600/15 to-indigo-600/25 relative" />

        <div className="px-6 sm:px-8 pb-8 pt-0 relative">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 -mt-14 sm:-mt-16 mb-6">
            {/* Avatar */}
            <div className="relative shrink-0">
              {profile.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt={profile.username}
                  className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl object-cover border-4 border-white dark:border-stone-900 shadow-lg bg-stone-100 dark:bg-stone-800"
                />
              ) : (
                <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl bg-gradient-to-br from-blue-500 via-indigo-600 to-purple-600 flex items-center justify-center text-white text-3xl sm:text-4xl font-extrabold border-4 border-white dark:border-stone-900 shadow-lg">
                  {(profile.full_name || profile.username).charAt(0).toUpperCase()}
                </div>
              )}
            </div>

            {/* Action Button: Edit My Posts or Follow */}
            <div className="flex items-center gap-2.5">
              {isOwnProfile ? (
                <div className="flex items-center gap-2">
                  <Link
                    href={user?.role === "admin" || user?.is_admin ? "/admin/posts" : "/posts/manage"}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-stone-300 dark:border-stone-700 text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 text-xs font-semibold transition-colors shadow-xs"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Bài viết của tôi</span>
                  </Link>
                  <Link
                    href="/editor/new"
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-all shadow-sm shadow-blue-500/25"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Viết bài mới</span>
                  </Link>
                </div>
              ) : user ? (
                <button
                  onClick={handleFollow}
                  disabled={followLoading}
                  className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold transition-all shadow-xs ${
                    followStatus?.is_following
                      ? "bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40 border border-stone-200 dark:border-stone-700"
                      : "bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/20"
                  }`}
                >
                  {followStatus?.is_following ? (
                    <>
                      <UserCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      <span>Đang theo dõi</span>
                    </>
                  ) : (
                    <>
                      <Users className="w-4 h-4" />
                      <span>Theo dõi tác giả</span>
                    </>
                  )}
                </button>
              ) : (
                <Link
                  href="/login"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-stone-200 dark:border-stone-700 hover:bg-stone-50 dark:hover:bg-stone-800 text-xs font-semibold text-stone-600 dark:text-stone-300 transition-colors"
                >
                  <span>Đăng nhập để theo dõi</span>
                </Link>
              )}
            </div>
          </div>

          {/* User Details */}
          <div className="space-y-3">
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-stone-900 dark:text-white">
                {profile.full_name || profile.username}
              </h1>
              <p className="text-sm font-medium text-stone-500 mt-0.5">
                @{profile.username}
              </p>
            </div>

            {/* Stats Bar */}
            <div className="flex flex-wrap items-center gap-4 sm:gap-6 text-xs sm:text-sm text-stone-600 dark:text-stone-400 pt-2 border-t border-stone-100 dark:border-stone-800/80">
              <div className="flex items-center gap-1.5">
                <BookOpen className="w-4 h-4 text-blue-600" />
                <span>
                  <strong className="text-stone-900 dark:text-white">{posts.length}</strong> bài viết
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <Users className="w-4 h-4 text-purple-600" />
                <span>
                  <strong className="text-stone-900 dark:text-white">{followStatus?.followers_count ?? 0}</strong> người theo dõi
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <UserCheck className="w-4 h-4 text-emerald-600" />
                <span>
                  <strong className="text-stone-900 dark:text-white">{followStatus?.following_count ?? 0}</strong> đang theo dõi
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-stone-400">
                <Calendar className="w-4 h-4" />
                <span>Tham gia {new Date(profile.created_at).toLocaleDateString("vi-VN", { month: "long", year: "numeric" })}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Posts Feed Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-stone-200 dark:border-stone-800 pb-3">
          <h2 className="flex items-center gap-2 text-lg sm:text-xl font-bold text-stone-900 dark:text-white">
            <BookOpen className="w-5 h-5 text-blue-600" />
            <span>Bài viết đã xuất bản ({posts.length})</span>
          </h2>
          {isOwnProfile && (
            <Link
              href="/editor/new"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Viết bài mới</span>
            </Link>
          )}
        </div>

        <div className="relative min-h-[220px]">
          <LoadingOverlay isLoading={loading} message="Đang tải bài viết của tác giả..." />

          {posts.length === 0 ? (
            <div className="text-center py-16 px-4 border border-dashed border-stone-200 dark:border-stone-800 rounded-3xl space-y-3 bg-stone-50/40 dark:bg-stone-900/30">
              <div className="w-12 h-12 mx-auto rounded-full bg-stone-100 dark:bg-stone-800 flex items-center justify-center text-stone-400">
                <BookOpen className="w-6 h-6" />
              </div>
              <h3 className="font-semibold text-stone-800 dark:text-stone-200">
                Chưa có bài viết nào
              </h3>
              <p className="text-sm text-stone-500 dark:text-stone-400 max-w-sm mx-auto">
                {isOwnProfile
                  ? "Bạn chưa xuất bản bài viết nào. Hãy bấm viết bài để chia sẻ kiến thức đầu tiên của bạn!"
                  : "Tác giả này hiện chưa xuất bản bài viết nào."}
              </p>
              {isOwnProfile && (
                <div className="pt-2">
                  <Link
                    href="/editor/new"
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm shadow-blue-500/25 transition-all"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Tạo bài viết đầu tiên</span>
                  </Link>
                </div>
              )}
            </div>
          ) : (
            <div className={`grid grid-cols-1 gap-5 transition-opacity duration-200 ${loading ? "opacity-40 pointer-events-none" : ""}`}>
              {posts.map((post) => (
                <PostCard key={post.id} post={post} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
