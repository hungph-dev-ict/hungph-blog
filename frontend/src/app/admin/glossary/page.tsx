"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  BookMarked,
  Plus,
  Search,
  Edit2,
  Trash2,
  X,
  Check,
  AlertCircle,
  Loader2,
  RefreshCw,
  HelpCircle,
  FileText,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import {
  fetchGlossaryTerms,
  createGlossaryTerm,
  updateGlossaryTerm,
  deleteGlossaryTerm,
} from "@/lib/api";
import { GlossaryTerm } from "@/lib/types";
import { AdminGuard } from "@/components/admin/AdminGuard";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { LoadingOverlay } from "@/components/common/LoadingOverlay";

export default function AdminGlossaryPage() {
  const { token } = useAuth();
  const [terms, setTerms] = useState<GlossaryTerm[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Concurrent action / loading indicator
  const [isProcessing, setIsProcessing] = useState(false);
  const [processMessage, setProcessMessage] = useState("");

  // Modal create/edit state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTerm, setEditingTerm] = useState<GlossaryTerm | null>(null);
  const [formData, setFormData] = useState({ term: "", definition: "" });
  const [formError, setFormError] = useState("");

  const loadTerms = async () => {
    setLoading(true);
    try {
      const data = await fetchGlossaryTerms();
      setTerms(data);
    } catch (err: any) {
      console.error("Lỗi khi tải danh sách thuật ngữ:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTerms();
  }, []);

  // Filtered terms
  const filteredTerms = useMemo(() => {
    if (!searchQuery.trim()) return terms;
    const q = searchQuery.toLowerCase().trim();
    return terms.filter(
      (item) =>
        item.term.toLowerCase().includes(q) ||
        item.definition.toLowerCase().includes(q)
    );
  }, [terms, searchQuery]);

  const openCreateModal = () => {
    setEditingTerm(null);
    setFormData({ term: "", definition: "" });
    setFormError("");
    setIsModalOpen(true);
  };

  const openEditModal = (item: GlossaryTerm) => {
    setEditingTerm(item);
    setFormData({ term: item.term, definition: item.definition });
    setFormError("");
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingTerm(null);
    setFormData({ term: "", definition: "" });
    setFormError("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    const termTrimmed = formData.term.trim();
    const defTrimmed = formData.definition.trim();

    if (!termTrimmed) {
      setFormError("Vui lòng nhập thuật ngữ");
      return;
    }
    if (!defTrimmed) {
      setFormError("Vui lòng nhập giải thích thuật ngữ");
      return;
    }

    setIsProcessing(true);
    setProcessMessage(editingTerm ? "Đang cập nhật thuật ngữ..." : "Đang tạo thuật ngữ mới...");
    setFormError("");

    try {
      if (editingTerm) {
        const updated = await updateGlossaryTerm(
          editingTerm.id,
          { term: termTrimmed, definition: defTrimmed },
          token
        );
        setTerms((prev) =>
          prev.map((t) => (t.id === editingTerm.id ? updated : t))
        );
      } else {
        const created = await createGlossaryTerm(
          { term: termTrimmed, definition: defTrimmed },
          token
        );
        setTerms((prev) => [...prev, created]);
      }
      closeModal();
    } catch (err: any) {
      setFormError(err.message || "Đã xảy ra lỗi khi lưu thuật ngữ");
    } finally {
      setIsProcessing(false);
      setProcessMessage("");
    }
  };

  const handleDelete = async (id: string, termName: string) => {
    if (!token || isProcessing) return;
    if (!window.confirm(`Bạn có chắc chắn muốn xóa thuật ngữ "${termName}" không?`)) {
      return;
    }

    setIsProcessing(true);
    setProcessMessage(`Đang xóa thuật ngữ "${termName}"...`);
    try {
      await deleteGlossaryTerm(id, token);
      setTerms((prev) => prev.filter((t) => t.id !== id));
    } catch (err: any) {
      alert(`Lỗi khi xóa thuật ngữ: ${err.message}`);
    } finally {
      setIsProcessing(false);
      setProcessMessage("");
    }
  };

  return (
    <AdminGuard requireAdmin={true}>
      <LoadingOverlay isLoading={isProcessing} message={processMessage} />

      <div className="w-full space-y-6 pb-16">
        {/* Header dùng chung đồng bộ layout */}
        <AdminPageHeader
          currentTab="glossary"
          breadcrumbs={[
            { label: "Quản trị", href: "/admin/posts" },
            { label: "Quản lý thuật ngữ" },
          ]}
          title="Quản Lý Thuật Ngữ"
          description={`Tổng cộng ${terms.length} thuật ngữ. Tự động highlight và giải thích khi độc giả rê chuột hoặc chạm vào từ ngữ trong bài viết.`}
          icon={BookMarked}
          backHref="/admin/posts"
          backTitle="Về danh sách bài viết"
          badgeText="Glossary"
          badgeVariant="purple"
          actionButton={
            <button
              onClick={openCreateModal}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold shadow-xs hover:shadow-md transition-all active:scale-95"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Thêm Thuật Ngữ</span>
            </button>
          }
        />

        {/* Thanh tìm kiếm & thống kê */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 rounded-2xl border border-stone-200/80 dark:border-stone-800 bg-stone-50/50 dark:bg-stone-900/40">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm kiếm thuật ngữ hoặc định nghĩa..."
              className="w-full pl-9 pr-8 py-2 text-xs rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
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

          <div className="flex items-center gap-2 text-xs text-stone-500 dark:text-stone-400 w-full sm:w-auto justify-between sm:justify-end">
            <span>
              Hiển thị <strong className="text-stone-800 dark:text-stone-200">{filteredTerms.length}</strong> / {terms.length} thuật ngữ
            </span>
            <button
              onClick={loadTerms}
              disabled={loading}
              title="Tải lại danh sách"
              className="p-1.5 rounded-lg border border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-300 hover:bg-white dark:hover:bg-stone-800 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {/* Danh sách Thuật ngữ */}
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3 text-stone-500">
            <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
            <p className="text-xs font-medium">Đang tải danh sách thuật ngữ...</p>
          </div>
        ) : filteredTerms.length === 0 ? (
          <div className="py-16 px-4 text-center rounded-3xl border border-dashed border-stone-200 dark:border-stone-800 bg-stone-50/50 dark:bg-stone-900/20 space-y-3">
            <HelpCircle className="w-10 h-10 text-stone-400 mx-auto" />
            <div className="space-y-1">
              <p className="text-sm font-semibold text-stone-800 dark:text-stone-200">
                {searchQuery ? "Không tìm thấy thuật ngữ phù hợp" : "Chưa có thuật ngữ nào"}
              </p>
              <p className="text-xs text-stone-500 max-w-sm mx-auto">
                {searchQuery
                  ? "Hãy thử tìm kiếm với từ khóa khác hoặc xóa bộ lọc."
                  : "Thêm các thuật ngữ kỹ thuật để người đọc dễ dàng tra cứu kiến thức khi đọc bài."}
              </p>
            </div>
            {!searchQuery && (
              <button
                onClick={openCreateModal}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-purple-600 text-white hover:bg-purple-700 transition-colors shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Thêm ngay</span>
              </button>
            )}
          </div>
        ) : (
          <div className="rounded-2xl border border-stone-200/80 dark:border-stone-800 overflow-hidden bg-white dark:bg-stone-900 shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-stone-50 dark:bg-stone-800/60 border-b border-stone-200 dark:border-stone-800 text-stone-500 font-semibold tracking-wider uppercase text-[11px]">
                    <th className="py-3 px-4 w-48">Thuật ngữ</th>
                    <th className="py-3 px-4">Giải thích / Định nghĩa</th>
                    <th className="py-3 px-4 w-36 hidden sm:table-cell">Cập nhật</th>
                    <th className="py-3 px-4 w-28 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 dark:divide-stone-800/60 font-medium">
                  {filteredTerms.map((item) => (
                    <tr
                      key={item.id}
                      className="hover:bg-purple-50/30 dark:hover:bg-purple-950/20 transition-colors group"
                    >
                      <td className="py-3 px-4 align-top">
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-purple-50 dark:bg-purple-950/50 border border-purple-200/70 dark:border-purple-800 text-purple-700 dark:text-purple-300 font-bold text-xs">
                          <span>{item.term}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 align-top text-stone-700 dark:text-stone-300 leading-relaxed">
                        <p className="whitespace-pre-line text-xs">{item.definition}</p>
                      </td>
                      <td className="py-3 px-4 align-top text-stone-400 text-[11px] hidden sm:table-cell">
                        {item.updated_at
                          ? new Date(item.updated_at).toLocaleDateString("vi-VN", {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                            })
                          : "—"}
                      </td>
                      <td className="py-3 px-4 align-top text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => openEditModal(item)}
                            className="p-1.5 text-stone-500 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-lg transition-colors"
                            title="Chỉnh sửa thuật ngữ"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(item.id, item.term)}
                            className="p-1.5 text-stone-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors"
                            title="Xóa thuật ngữ"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Modal Thêm / Chỉnh sửa Thuật ngữ */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs animate-in fade-in duration-150">
            <div
              className="w-full max-w-lg rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-5 py-4 border-b border-stone-200 dark:border-stone-800">
                <div className="flex items-center gap-2 font-bold text-stone-900 dark:text-white text-sm">
                  <BookMarked className="w-4 h-4 text-purple-600" />
                  <span>{editingTerm ? "Chỉnh Sửa Thuật Ngữ" : "Thêm Thuật Ngữ Mới"}</span>
                </div>
                <button
                  onClick={closeModal}
                  className="p-1 text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 rounded-lg transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-5 space-y-4">
                {formError && (
                  <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{formError}</span>
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-stone-700 dark:text-stone-300">
                    Thuật ngữ (Từ khóa cần giải thích) *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.term}
                    onChange={(e) => setFormData({ ...formData, term: e.target.value })}
                    placeholder="Ví dụ: RAG, LLM, Vector Database..."
                    className="w-full px-3 py-2 text-xs rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800/80 text-stone-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                  />
                  <p className="text-[11px] text-stone-500">
                    Hệ thống sẽ tự động đối soát trong bài viết (không phân biệt hoa thường) để highlight từ ngữ này.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-stone-700 dark:text-stone-300">
                    Định nghĩa / Giải thích ngắn gọn *
                  </label>
                  <textarea
                    rows={4}
                    required
                    value={formData.definition}
                    onChange={(e) => setFormData({ ...formData, definition: e.target.value })}
                    placeholder="Nhập giải thích súc tích, dễ hiểu cho người đọc khi di chuột hoặc bấm vào..."
                    className="w-full px-3 py-2 text-xs rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800/80 text-stone-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50 resize-y"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-stone-100 dark:border-stone-800">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="px-3.5 py-1.5 rounded-xl border border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 text-xs font-semibold transition-colors"
                  >
                    Hủy bỏ
                  </button>
                  <button
                    type="submit"
                    disabled={isProcessing}
                    className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold shadow-xs transition-colors disabled:opacity-50"
                  >
                    {isProcessing ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Check className="w-3.5 h-3.5" />
                    )}
                    <span>{editingTerm ? "Lưu thay đổi" : "Tạo thuật ngữ"}</span>
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
