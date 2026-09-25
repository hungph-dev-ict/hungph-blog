"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  X,
  Upload,
  Link as LinkIcon,
  Image as ImageIcon,
  Check,
  Loader2,
  Trash2,
  Sparkles,
  AlertCircle,
  ExternalLink,
} from "lucide-react";
import { uploadMedia, updatePost, getFullImageUrl } from "@/lib/api";

interface EditCoverModalProps {
  isOpen: boolean;
  onClose: () => void;
  postId: string;
  postTitle: string;
  currentCoverImage?: string | null;
  token: string;
  onSuccess: (newCoverUrl: string) => void;
}

export const EditCoverModal: React.FC<EditCoverModalProps> = ({
  isOpen,
  onClose,
  postId,
  postTitle,
  currentCoverImage,
  token,
  onSuccess,
}) => {
  const [coverUrl, setCoverUrl] = useState<string>(currentCoverImage || "");
  const [activeTab, setActiveTab] = useState<"upload" | "url">("upload");
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [isDragOver, setIsDragOver] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setCoverUrl(currentCoverImage || "");
      setErrorMsg("");
      setIsUploading(false);
      setIsSaving(false);
      setIsDragOver(false);
    }
  }, [isOpen, currentCoverImage]);

  if (!isOpen) return null;

  const handleFileUpload = async (file: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setErrorMsg("Vui lòng chọn file định dạng hình ảnh (PNG, JPG, WEBP, GIF, SVG).");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setErrorMsg("Dung lượng ảnh tối đa là 10MB.");
      return;
    }

    setErrorMsg("");
    setIsUploading(true);
    try {
      const res = await uploadMedia(file, token);
      setCoverUrl(res.url);
    } catch (err: any) {
      setErrorMsg(err.message || "Tải ảnh lên thất bại. Vui lòng thử lại.");
    } finally {
      setIsUploading(false);
    }
  };

  const onFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
  };

  const handleSave = async () => {
    setErrorMsg("");
    setIsSaving(true);
    try {
      const trimmed = coverUrl.trim();
      await updatePost(postId, { cover_image: trimmed }, token);
      onSuccess(trimmed);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || "Không thể cập nhật ảnh bìa. Vui lòng thử lại.");
    } finally {
      setIsSaving(false);
    }
  };

  const hasCustomImage = Boolean(coverUrl.trim());

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={() => !isSaving && !isUploading && onClose()}
    >
      <div
        className="bg-white dark:bg-stone-900 rounded-3xl border border-stone-200 dark:border-stone-800 w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-stone-100 dark:border-stone-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
              <ImageIcon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-stone-900 dark:text-white">
                Ảnh bìa bài viết (Cover)
              </h3>
              <p className="text-xs text-stone-500 max-w-sm truncate" title={postTitle}>
                {postTitle}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isSaving || isUploading}
            className="p-1.5 rounded-xl text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {/* Visual Preview Box */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-stone-700 dark:text-stone-300">
                Xem trước ảnh bìa:
              </span>
              {hasCustomImage ? (
                <button
                  type="button"
                  onClick={() => setCoverUrl("")}
                  className="inline-flex items-center gap-1 text-[11px] text-rose-500 hover:text-rose-600 font-medium hover:underline"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Dùng ảnh mặc định</span>
                </button>
              ) : (
                <span className="text-[11px] text-amber-600 dark:text-amber-400 font-medium flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  <span>Đang dùng ảnh mặc định</span>
                </span>
              )}
            </div>

            <div className="relative rounded-2xl overflow-hidden border border-stone-200 dark:border-stone-700 aspect-video bg-stone-100 dark:bg-stone-800 group shadow-inner">
              <img
                src={getFullImageUrl(coverUrl)}
                alt="Cover preview"
                className="w-full h-full object-cover"
              />

              {/* Status Badge */}
              <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold backdrop-blur-md shadow-sm">
                {hasCustomImage ? (
                  <span className="bg-emerald-500/90 text-white px-2 py-0.5 rounded-full flex items-center gap-1">
                    <Check className="w-3 h-3" /> Ảnh tùy chỉnh
                  </span>
                ) : (
                  <span className="bg-stone-900/80 text-amber-300 px-2 py-0.5 rounded-full flex items-center gap-1">
                    Ảnh mặc định hệ thống
                  </span>
                )}
              </div>

              {/* Quick info caption */}
              <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-3 text-white text-[11px]">
                {hasCustomImage ? (
                  <p className="truncate">Ảnh này sẽ xuất hiện ngoài trang chủ & thẻ OpenGraph</p>
                ) : (
                  <p className="text-stone-300">
                    Chưa có ảnh bìa riêng. Hệ thống tự động dùng ảnh mặc định thương hiệu.
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Mode Switcher Tabs */}
          <div className="grid grid-cols-2 p-1 bg-stone-100 dark:bg-stone-800 rounded-xl text-xs font-semibold">
            <button
              type="button"
              onClick={() => setActiveTab("upload")}
              className={`py-2 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                activeTab === "upload"
                  ? "bg-white dark:bg-stone-900 text-blue-600 dark:text-blue-400 shadow-sm"
                  : "text-stone-600 dark:text-stone-400 hover:text-stone-900"
              }`}
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Tải ảnh lên</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("url")}
              className={`py-2 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                activeTab === "url"
                  ? "bg-white dark:bg-stone-900 text-blue-600 dark:text-blue-400 shadow-sm"
                  : "text-stone-600 dark:text-stone-400 hover:text-stone-900"
              }`}
            >
              <LinkIcon className="w-3.5 h-3.5" />
              <span>Dán liên kết URL</span>
            </button>
          </div>

          {/* Tab 1: Upload Dropzone */}
          {activeTab === "upload" && (
            <div className="space-y-2">
              <input
                type="file"
                ref={fileInputRef}
                onChange={onFileInputChange}
                accept="image/*"
                className="hidden"
              />

              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragOver(true);
                }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={handleDrop}
                onClick={() => !isUploading && fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${
                  isDragOver
                    ? "border-blue-500 bg-blue-50/50 dark:bg-blue-950/20 scale-[1.01]"
                    : "border-stone-200 dark:border-stone-700 hover:border-blue-400 bg-stone-50/50 dark:bg-stone-800/30"
                } ${isUploading ? "opacity-60 pointer-events-none" : ""}`}
              >
                {isUploading ? (
                  <div className="flex flex-col items-center gap-2 py-2">
                    <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                    <span className="text-xs font-medium text-stone-600 dark:text-stone-300">
                      Đang tải ảnh lên Cloudinary...
                    </span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <div className="p-2.5 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400">
                      <Upload className="w-5 h-5" />
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-xs font-semibold text-stone-800 dark:text-stone-200">
                        Bấm để chọn file hoặc kéo thả ảnh vào đây
                      </p>
                      <p className="text-[11px] text-stone-400">
                        Hỗ trợ PNG, JPG, WEBP, GIF (tối đa 10MB)
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Tab 2: URL Input */}
          {activeTab === "url" && (
            <div className="space-y-2">
              <label className="text-xs font-semibold text-stone-700 dark:text-stone-300">
                Đường dẫn ảnh trực tiếp (URL)
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={coverUrl}
                  onChange={(e) => setCoverUrl(e.target.value)}
                  placeholder="https://images.unsplash.com/... hoặc link ảnh bất kỳ"
                  className="w-full pl-3 pr-9 py-2.5 text-xs rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800/80 text-stone-800 dark:text-stone-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {coverUrl && (
                  <button
                    type="button"
                    onClick={() => setCoverUrl("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
              <p className="text-[11px] text-stone-400">
                Gợi ý: Bạn có thể lấy link ảnh chất lượng cao từ Unsplash hoặc lưu trữ ngoài.
              </p>
            </div>
          )}

          {/* Error Message */}
          {errorMsg && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-600 dark:text-rose-400 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-2.5 p-4 border-t border-stone-100 dark:border-stone-800 bg-stone-50/50 dark:bg-stone-900/50">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving || isUploading}
            className="px-4 py-2 text-xs font-semibold rounded-xl border border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors disabled:opacity-50"
          >
            Hủy bỏ
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving || isUploading}
            className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-semibold rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-sm shadow-blue-500/25 transition-all disabled:opacity-50"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Đang lưu...</span>
              </>
            ) : (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>Lưu ảnh bìa</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
