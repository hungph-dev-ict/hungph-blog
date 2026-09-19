"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { getUserProfile, getFollowStatus, toggleFollow, fetchPosts } from "@/lib/api";
import { UserProfile, FollowStatus, PostListItem } from "@/lib/types";
import { Users, UserCheck, Calendar, BookOpen } from "lucide-react";
import { PostCard } from "@/components/blog/PostCard";
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
    try {
      const p = await getUserProfile(username);
      setProfile(p);
      const [status, postData] = await Promise.all([
        getFollowStatus(p.id, token || undefined),
        fetchPosts({ limit: 6, page: 1 }),
      ]);
      setFollowStatus(status);
      // Filter posts by this user
      setPosts(postData.items || []);
    } catch {
      setError("Không tìm thấy người dùng này");
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
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <div className="w-24 h-24 rounded-full bg-stone-200 dark:bg-stone-700 animate-pulse mx-auto mb-4" />
        <div className="h-6 bg-stone-200 dark:bg-stone-700 rounded-lg animate-pulse w-48 mx-auto mb-2" />
        <div className="h-4 bg-stone-200 dark:bg-stone-700 rounded-lg animate-pulse w-32 mx-auto" />
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center text-stone-500">
        <Users className="w-12 h-12 mx-auto mb-4 opacity-30" />
        <p className="text-lg font-medium">{error || "Không tìm thấy người dùng"}</p>
        <Link href="/" className="text-blue-600 hover:underline mt-4 inline-block">← Về trang chủ</Link>
      </div>
    );
  }

  const isOwnProfile = user?.username === profile.username;

  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      {/* Profile Card */}
      <div className="bg-white dark:bg-stone-900 rounded-3xl border border-stone-200 dark:border-stone-800 p-8 mb-8 shadow-sm">
        <div className="flex items-start gap-6">
          {/* Avatar */}
          <div className="shrink-0">
            {profile.avatar_url ? (
              <img src={profile.avatar_url} alt={profile.username} className="w-20 h-20 rounded-2xl object-cover shadow-md" />
            ) : (
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-3xl font-bold shadow-md">
                {(profile.full_name || profile.username).charAt(0).toUpperCase()}
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold text-stone-900 dark:text-white mb-0.5">
              {profile.full_name || profile.username}
            </h1>
            <p className="text-stone-500 text-sm mb-4">@{profile.username}</p>

            {/* Stats */}
            <div className="flex items-center gap-6 text-sm text-stone-600 dark:text-stone-400 mb-4">
              <div className="flex items-center gap-1.5">
                <Users className="w-4 h-4" />
                <span><strong className="text-stone-900 dark:text-white">{followStatus?.followers_count ?? 0}</strong> người theo dõi</span>
              </div>
              <div className="flex items-center gap-1.5">
                <UserCheck className="w-4 h-4" />
                <span><strong className="text-stone-900 dark:text-white">{followStatus?.following_count ?? 0}</strong> đang theo dõi</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Calendar className="w-4 h-4" />
                <span>Tham gia {new Date(profile.created_at).getFullYear()}</span>
              </div>
            </div>

            {/* Follow Button */}
            {!isOwnProfile && user && (
              <button
                onClick={handleFollow}
                disabled={followLoading}
                className={`flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold transition-all ${
                  followStatus?.is_following
                    ? "bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/30"
                    : "bg-blue-600 hover:bg-blue-700 text-white shadow-sm shadow-blue-500/20"
                }`}
              >
                {followStatus?.is_following ? (
                  <><UserCheck className="w-4 h-4" /> Đang theo dõi</>
                ) : (
                  <><Users className="w-4 h-4" /> Theo dõi</>
                )}
              </button>
            )}

            {!user && (
              <p className="text-sm text-stone-400">
                <Link href="/" className="text-blue-600 hover:underline">Đăng nhập</Link> để theo dõi
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Posts Section */}
      <div>
        <h2 className="flex items-center gap-2 text-lg font-bold text-stone-900 dark:text-white mb-4">
          <BookOpen className="w-5 h-5 text-blue-600" />
          Bài viết gần đây
        </h2>
        {posts.length === 0 ? (
          <p className="text-stone-400 text-sm">Chưa có bài viết nào.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {posts.slice(0, 4).map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
