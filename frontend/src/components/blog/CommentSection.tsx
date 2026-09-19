"use client";

import React, { useEffect, useState } from "react";
import { MessageSquare, Send, Reply, Trash2, LogOut, Edit2, Check, X } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { fetchComments, createComment, deleteComment, updateComment } from "@/lib/api";
import { Comment } from "@/lib/types";
import { GoogleLoginButton } from "@/components/common/GoogleLoginButton";

interface CommentSectionProps {
  postId: string;
}

export const CommentSection: React.FC<CommentSectionProps> = ({ postId }) => {
  const { user, token, logout } = useAuth();

  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);

  // Form state
  const [content, setContent] = useState("");
  const [authorName, setAuthorName] = useState("");
  const [authorEmail, setAuthorEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [replyToId, setReplyToId] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState("");

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [editSubmitting, setEditSubmitting] = useState(false);

  const loadComments = async () => {
    try {
      const data = await fetchComments(postId);
      setComments(data);
    } catch (e) {
      console.error("Lỗi khi tải bình luận:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadComments();
  }, [postId]);

  const handleSubmitComment = async (e: React.FormEvent, parentId?: string) => {
    e.preventDefault();
    const commentText = parentId ? replyContent.trim() : content.trim();
    if (!commentText) return;

    if (!user && !authorName.trim() && !parentId) {
      alert("Vui lòng nhập tên của bạn hoặc đăng nhập qua Gmail!");
      return;
    }

    setSubmitting(true);
    try {
      await createComment(
        postId,
        {
          content: commentText,
          author_name: user?.full_name || user?.username || authorName.trim() || undefined,
          author_email: user?.email || authorEmail.trim() || undefined,
          parent_id: parentId,
        },
        token
      );

      if (parentId) {
        setReplyContent("");
        setReplyToId(null);
      } else {
        setContent("");
      }
      await loadComments();
    } catch (err: any) {
      alert(`Lỗi: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (commentId: string) => {
    if (!token) return;
    if (!window.confirm("Bạn có chắc muốn thu hồi bình luận này?")) return;
    try {
      await deleteComment(commentId, token);
      await loadComments();
    } catch (err: any) {
      alert(`Lỗi: ${err.message}`);
    }
  };

  const handleStartEdit = (c: Comment) => {
    setEditingId(c.id);
    setEditContent(c.content);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditContent("");
  };

  const handleSaveEdit = async (commentId: string) => {
    if (!token || !editContent.trim()) return;
    setEditSubmitting(true);
    try {
      await updateComment(commentId, editContent.trim(), token);
      setEditingId(null);
      setEditContent("");
      await loadComments();
    } catch (err: any) {
      alert(`Lỗi khi cập nhật bình luận: ${err.message}`);
    } finally {
      setEditSubmitting(false);
    }
  };

  const canModify = (c: Comment) => {
    if (!user) return false;
    return Boolean(user.is_admin || (c.user_id && c.user_id === user.id));
  };

  const countTotalComments = (list: Comment[]): number => {
    return list.reduce((acc, c) => acc + 1 + (c.replies ? c.replies.length : 0), 0);
  };

  const formatRelativeTime = (dateStr: string) => {
    const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
    if (diff < 60) return "vừa xong";
    if (diff < 3600) return `${Math.floor(diff / 60)} phút trước`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} giờ trước`;
    if (diff < 2592000) return `${Math.floor(diff / 86400)} ngày trước`;
    return new Date(dateStr).toLocaleDateString("vi-VN");
  };

  return (
    <section className="pt-12 mt-12 border-t border-stone-200 dark:border-stone-800 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center">
            <MessageSquare className="w-4 h-4" />
          </div>
          <h2 className="text-xl font-bold text-stone-900 dark:text-white">
            Bình luận ({countTotalComments(comments)})
          </h2>
        </div>

        {/* User login / status bar */}
        <div className="flex items-center gap-2">
          {user ? (
            <div className="flex items-center gap-3 bg-stone-100 dark:bg-stone-800/80 px-3 py-1.5 rounded-full text-xs">
              {user.avatar_url ? (
                <img src={user.avatar_url} alt="" className="w-5 h-5 rounded-full object-cover" />
              ) : (
                <div className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] font-bold">
                  {user.full_name?.charAt(0) || user.username?.charAt(0) || "U"}
                </div>
              )}
              <span className="font-semibold text-stone-800 dark:text-stone-200">
                {user.full_name || user.username}
              </span>
              <button
                onClick={logout}
                className="text-stone-400 hover:text-rose-500 transition-colors ml-1"
                title="Đăng xuất"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <GoogleLoginButton onSuccess={loadComments} buttonText="Đăng nhập Gmail" />
          )}
        </div>
      </div>

      {/* Main Comment Box */}
      <form onSubmit={(e) => handleSubmitComment(e)} className="p-4 sm:p-5 rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900/50 space-y-3 shadow-sm">
        {!user && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pb-2 border-b border-stone-100 dark:border-stone-800">
            <input
              type="text"
              required
              value={authorName}
              onChange={(e) => setAuthorName(e.target.value)}
              placeholder="Tên của bạn *"
              className="px-3 py-2 text-xs rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="email"
              value={authorEmail}
              onChange={(e) => setAuthorEmail(e.target.value)}
              placeholder="Email (không công khai)..."
              className="px-3 py-2 text-xs rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        )}

        <textarea
          rows={3}
          required
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Viết bình luận, chia sẻ góc nhìn hoặc thảo luận về bài viết..."
          className="w-full p-3 text-sm rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-100 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
        />

        <div className="flex items-center justify-between pt-1">
          <span className="text-[11px] text-stone-400">
            Hỗ trợ bình luận văn minh và tôn trọng quan điểm đa chiều.
          </span>
          <button
            type="submit"
            disabled={submitting || !content.trim()}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold shadow-sm transition-all"
          >
            <Send className="w-3.5 h-3.5" />
            <span>{submitting ? "Đang gửi..." : "Gửi bình luận"}</span>
          </button>
        </div>
      </form>

      {/* Comments List */}
      <div className="space-y-4">
        {loading ? (
          <div className="space-y-3 animate-pulse">
            {[1, 2].map((i) => (
              <div key={i} className="h-20 rounded-2xl bg-stone-100 dark:bg-stone-800" />
            ))}
          </div>
        ) : comments.length === 0 ? (
          <div className="py-10 text-center border border-dashed border-stone-200 dark:border-stone-800 rounded-2xl text-stone-400 text-xs">
            Chưa có bình luận nào. Hãy là người đầu tiên chia sẻ suy nghĩ!
          </div>
        ) : (
          comments.map((comment) => (
            <div
              key={comment.id}
              className="p-4 sm:p-5 rounded-2xl border border-stone-200/80 dark:border-stone-800 bg-white dark:bg-stone-900/60 space-y-3 shadow-sm"
            >
              {/* Comment Author Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  {comment.author_avatar ? (
                    <img
                      src={comment.author_avatar}
                      alt={comment.author_name}
                      className="w-8 h-8 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center text-xs font-bold shadow-sm">
                      {comment.author_name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <div className="font-semibold text-xs text-stone-900 dark:text-stone-100 flex items-center gap-1.5">
                      <span>{comment.author_name}</span>
                      {comment.author_name.toLowerCase().includes("admin") && (
                        <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-300">
                          Tác giả
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-stone-400">
                      {formatRelativeTime(comment.created_at)}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setReplyToId(replyToId === comment.id ? null : comment.id)}
                    className="flex items-center gap-1 text-[11px] font-medium text-stone-500 hover:text-blue-600 transition-colors"
                  >
                    <Reply className="w-3 h-3" />
                    <span>Trả lời</span>
                  </button>
                  {canModify(comment) && (
                    <>
                      <button
                        onClick={() => handleStartEdit(comment)}
                        className="flex items-center gap-1 text-[11px] font-medium text-stone-500 hover:text-amber-600 transition-colors"
                        title="Chỉnh sửa bình luận"
                      >
                        <Edit2 className="w-3 h-3" />
                        <span>Sửa</span>
                      </button>
                      <button
                        onClick={() => handleDelete(comment.id)}
                        className="flex items-center gap-1 text-[11px] font-medium text-stone-400 hover:text-rose-500 transition-colors"
                        title="Thu hồi bình luận"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Thu hồi</span>
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Comment Content or Edit Form */}
              {editingId === comment.id ? (
                <div className="space-y-2 pt-1">
                  <textarea
                    rows={3}
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    className="w-full p-3 text-xs rounded-xl border border-blue-300 dark:border-blue-700 bg-blue-50/20 dark:bg-blue-950/20 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={handleCancelEdit}
                      className="px-3 py-1 text-xs text-stone-500 hover:text-stone-700"
                    >
                      Hủy
                    </button>
                    <button
                      type="button"
                      disabled={editSubmitting || !editContent.trim()}
                      onClick={() => handleSaveEdit(comment.id)}
                      className="flex items-center gap-1.5 px-3.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-all"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>{editSubmitting ? "Đang lưu..." : "Lưu thay đổi"}</span>
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-xs sm:text-sm text-stone-700 dark:text-stone-300 whitespace-pre-wrap leading-relaxed pl-1">
                  {comment.content}
                </p>
              )}

              {/* Inline Reply Form */}
              {replyToId === comment.id && (
                <form
                  onSubmit={(e) => handleSubmitComment(e, comment.id)}
                  className="mt-3 pl-4 border-l-2 border-blue-500 space-y-2 pt-2"
                >
                  <textarea
                    rows={2}
                    required
                    value={replyContent}
                    onChange={(e) => setReplyContent(e.target.value)}
                    placeholder={`Trả lời @${comment.author_name}...`}
                    className="w-full p-2.5 text-xs rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setReplyToId(null)}
                      className="px-3 py-1 text-xs text-stone-400 hover:text-stone-600"
                    >
                      Hủy
                    </button>
                    <button
                      type="submit"
                      disabled={submitting || !replyContent.trim()}
                      className="px-3.5 py-1 bg-blue-600 text-white rounded-lg text-xs font-semibold"
                    >
                      Gửi phản hồi
                    </button>
                  </div>
                </form>
              )}

              {/* Nested Replies */}
              {comment.replies && comment.replies.length > 0 && (
                <div className="mt-3 pl-4 sm:pl-6 border-l-2 border-stone-200 dark:border-stone-700 space-y-3 pt-2">
                  {comment.replies.map((reply) => (
                    <div key={reply.id} className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {reply.author_avatar ? (
                            <img
                              src={reply.author_avatar}
                              alt=""
                              className="w-6 h-6 rounded-full object-cover"
                            />
                          ) : (
                            <div className="w-6 h-6 rounded-full bg-stone-200 dark:bg-stone-700 text-stone-600 dark:text-stone-300 flex items-center justify-center text-[10px] font-bold">
                              {reply.author_name.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <span className="font-semibold text-xs text-stone-900 dark:text-stone-100">
                            {reply.author_name}
                          </span>
                          <span className="text-[10px] text-stone-400">
                            {formatRelativeTime(reply.created_at)}
                          </span>
                        </div>
                        {canModify(reply) && (
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => handleStartEdit(reply)}
                              className="p-1 text-stone-400 hover:text-amber-600"
                              title="Chỉnh sửa phản hồi"
                            >
                              <Edit2 className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => handleDelete(reply.id)}
                              className="p-1 text-stone-400 hover:text-rose-500"
                              title="Thu hồi phản hồi"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                      </div>
                      {editingId === reply.id ? (
                        <div className="space-y-2 pl-8 pt-1">
                          <textarea
                            rows={2}
                            value={editContent}
                            onChange={(e) => setEditContent(e.target.value)}
                            className="w-full p-2.5 text-xs rounded-xl border border-blue-300 dark:border-blue-700 bg-blue-50/20 dark:bg-blue-950/20 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                          />
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={handleCancelEdit}
                              className="px-2.5 py-0.5 text-xs text-stone-500 hover:text-stone-700"
                            >
                              Hủy
                            </button>
                            <button
                              type="button"
                              disabled={editSubmitting || !editContent.trim()}
                              onClick={() => handleSaveEdit(reply.id)}
                              className="flex items-center gap-1 px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-all"
                            >
                              <Check className="w-3 h-3" />
                              <span>Lưu</span>
                            </button>
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs text-stone-600 dark:text-stone-300 pl-8 whitespace-pre-wrap">
                          {reply.content}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </section>
  );
};
