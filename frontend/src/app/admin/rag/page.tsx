"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Bot,
  Plus,
  Search,
  Edit2,
  Trash2,
  X,
  Check,
  AlertCircle,
  Loader2,
  RefreshCw,
  GraduationCap,
  FileText,
  Layers,
  Sparkles,
  ExternalLink,
  Database,
  CheckCircle2,
  Clock,
  ChevronRight,
  BookOpen,
  Lock,
  Globe,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import {
  fetchKnowledgeBases,
  fetchKnowledgeBase,
  createKnowledgeBase,
  updateKnowledgeBase,
  deleteKnowledgeBase,
  triggerKBIndex,
  fetchKBOptionData,
  triggerRAGIndex,
  getRAGStatus,
  KnowledgeBase,
  KBOptionData,
} from "@/lib/api";
import { AdminGuard } from "@/components/admin/AdminGuard";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { LoadingOverlay } from "@/components/common/LoadingOverlay";

function formatLastIndexed(dateStr?: string | null): string {
  if (!dateStr) return "Chưa từng lập chỉ mục";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "Chưa từng lập chỉ mục";
    return d.toLocaleString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

export default function AdminRAGPage() {
  const { token } = useAuth();
  const [kbs, setKbs] = useState<KnowledgeBase[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [ragStatus, setRagStatus] = useState<any>(null);

  // Global re-index
  const [isReindexingGlobal, setIsReindexingGlobal] = useState(false);
  const [indexingKbId, setIndexingKbId] = useState<string | null>(null);

  // Processing overlay (for deletion)
  const [isProcessing, setIsProcessing] = useState(false);
  const [processMessage, setProcessMessage] = useState("");

  // Notification toast/banner state
  const [notification, setNotification] = useState<{
    type: "success" | "info" | "error";
    title?: string;
    message: string;
  } | null>(null);

  // Modal inline submission state
  const [isSubmittingModal, setIsSubmittingModal] = useState(false);
  const [backgroundIndexingIds, setBackgroundIndexingIds] = useState<string[]>([]);

  // Auto-dismiss notification after 7 seconds
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => {
        setNotification(null);
      }, 7000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  // Modal create/edit state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingKb, setEditingKb] = useState<KnowledgeBase | null>(null);
  const [optionsData, setOptionsData] = useState<KBOptionData>({ series: [], posts: [] });
  const [loadingOptions, setLoadingOptions] = useState(false);

  // Form fields
  const [formName, setFormName] = useState("");
  const [formSlug, setFormSlug] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formIsActive, setFormIsActive] = useState(true);
  const [selectedSeriesIds, setSelectedSeriesIds] = useState<string[]>([]);
  const [selectedPostIds, setSelectedPostIds] = useState<string[]>([]);
  const [formError, setFormError] = useState("");

  // Modal search filters
  const [seriesFilter, setSeriesFilter] = useState("");
  const [postFilter, setPostFilter] = useState("");

  const loadData = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [kbList, status] = await Promise.all([
        fetchKnowledgeBases(token, true),
        getRAGStatus().catch(() => null),
      ]);
      setKbs(kbList);
      setRagStatus(status);
    } catch (err: any) {
      console.error("Lỗi khi tải danh sách Kho Tri Thức:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [token]);

  const loadOptions = async () => {
    if (!token) return;
    setLoadingOptions(true);
    try {
      const data = await fetchKBOptionData(token);
      setOptionsData(data);
    } catch (err) {
      console.error("Lỗi tải danh mục chọn:", err);
    } finally {
      setLoadingOptions(false);
    }
  };

  // Open modal create
  const openCreateModal = () => {
    setEditingKb(null);
    setFormName("");
    setFormSlug("");
    setFormDescription("");
    setFormIsActive(true);
    setSelectedSeriesIds([]);
    setSelectedPostIds([]);
    setFormError("");
    setSeriesFilter("");
    setPostFilter("");
    setIsModalOpen(true);
    loadOptions();
  };

  // Open modal edit
  const openEditModal = (kb: KnowledgeBase) => {
    setEditingKb(kb);
    setFormName(kb.name);
    setFormSlug(kb.slug);
    setFormDescription(kb.description || "");
    setFormIsActive(kb.is_active);
    setSelectedSeriesIds(kb.series.map((s) => s.id));
    setSelectedPostIds(kb.posts.map((p) => p.id));
    setFormError("");
    setSeriesFilter("");
    setPostFilter("");
    setIsModalOpen(true);
    loadOptions();
  };

  // Toggle selection
  const toggleSeries = (id: string) => {
    setSelectedSeriesIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const togglePost = (id: string) => {
    setSelectedPostIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const selectAllSeries = () => {
    setSelectedSeriesIds(optionsData.series.map((s) => s.id));
  };

  const deselectAllSeries = () => {
    setSelectedSeriesIds([]);
  };

  // Calculate approximate effective post count in modal
  const estimatedEffectiveCount = useMemo(() => {
    let count = selectedPostIds.length;
    for (const sid of selectedSeriesIds) {
      const s = optionsData.series.find((item) => item.id === sid);
      if (s) count += s.lesson_count;
    }
    return count;
  }, [selectedSeriesIds, selectedPostIds, optionsData]);

  // Handle Save (Create / Update)
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    if (!formName.trim()) {
      setFormError("Vui lòng nhập tên kho tri thức");
      return;
    }

    setIsSubmittingModal(true);
    setFormError("");

    try {
      let savedKb: KnowledgeBase;
      const willIndex = selectedSeriesIds.length > 0 || selectedPostIds.length > 0;

      if (editingKb) {
        savedKb = await updateKnowledgeBase(
          editingKb.id,
          {
            name: formName.trim(),
            slug: formSlug.trim() || undefined,
            description: formDescription.trim() || undefined,
            is_active: formIsActive,
            series_ids: selectedSeriesIds,
            post_ids: selectedPostIds,
          },
          token
        );
        setIsModalOpen(false);
        setNotification({
          type: "success",
          title: "Cập nhật Kho Tri Thức thành công",
          message: willIndex
            ? `Kho tri thức "${savedKb.name}" đã được cập nhật! Quá trình lập chỉ mục Vector đang chạy ngầm trong nền.`
            : `Đã cập nhật thông tin kho tri thức "${savedKb.name}".`,
        });
      } else {
        savedKb = await createKnowledgeBase(
          {
            name: formName.trim(),
            slug: formSlug.trim() || undefined,
            description: formDescription.trim() || undefined,
            series_ids: selectedSeriesIds,
            post_ids: selectedPostIds,
          },
          token
        );
        setIsModalOpen(false);
        setNotification({
          type: "success",
          title: "Tạo Kho Tri Thức thành công",
          message: willIndex
            ? `Kho tri thức "${savedKb.name}" đã được tạo thành công! Hệ thống đang lập chỉ mục Vector (Embedding) trong nền.`
            : `Kho tri thức "${savedKb.name}" đã được tạo thành công! Bạn có thể thêm bài viết và lập chỉ mục bất kỳ lúc nào.`,
        });
      }

      if (willIndex && savedKb?.id) {
        const kbId = savedKb.id;
        setBackgroundIndexingIds((prev) => [...prev, kbId]);
        setTimeout(async () => {
          await loadData();
        }, 3500);
        setTimeout(async () => {
          await loadData();
          setBackgroundIndexingIds((prev) => prev.filter((id) => id !== kbId));
        }, 8000);
      }

      await loadData();
    } catch (err: any) {
      setFormError(err.message || "Đã xảy ra lỗi khi lưu kho tri thức");
    } finally {
      setIsSubmittingModal(false);
    }
  };

  // Handle Delete
  const handleDelete = async (kb: KnowledgeBase) => {
    if (!token) return;
    if (
      !window.confirm(
        `Bạn có chắc chắn muốn xóa kho tri thức "${kb.name}"? Dữ liệu vector index của kho này cũng sẽ bị xóa.`
      )
    ) {
      return;
    }

    setIsProcessing(true);
    setProcessMessage(`Đang xóa kho tri thức "${kb.name}"...`);
    try {
      await deleteKnowledgeBase(kb.id, token);
      setNotification({
        type: "info",
        title: "Đã xóa Kho Tri Thức",
        message: `Đã xóa hoàn toàn kho tri thức "${kb.name}".`,
      });
      await loadData();
    } catch (err: any) {
      alert(`Lỗi khi xóa: ${err.message}`);
    } finally {
      setIsProcessing(false);
      setProcessMessage("");
    }
  };

  // Handle Index single KB
  const handleIndexKB = async (kb: KnowledgeBase) => {
    if (!token) return;
    // Prevent double-click if already indexing
    if (indexingKbId === kb.id || backgroundIndexingIds.includes(kb.id)) return;
    setIndexingKbId(kb.id);
    try {
      const res = await triggerKBIndex(kb.id, token);
      setNotification({
        type: "info",
        title: "Đang lập chỉ mục Vector",
        message: res.message || `Đang lập chỉ mục cho kho tri thức "${kb.name}" trong nền. Trạng thái sẽ tự cập nhật.`,
      });
      // Poll every few seconds to detect when indexing completes
      const pollIntervals = [4000, 8000, 15000, 25000, 40000];
      let cleared = false;
      for (const delay of pollIntervals) {
        setTimeout(async () => {
          if (cleared) return;
          const freshList = await fetchKnowledgeBases(token, true).catch(() => null);
          if (freshList) {
            setKbs(freshList);
            const freshKb = freshList.find((k) => k.id === kb.id);
            // Clear indexing state once the KB is confirmed indexed
            if (freshKb?.is_indexed && freshKb?.last_indexed_at !== kb.last_indexed_at) {
              cleared = true;
              setIndexingKbId(null);
            }
          }
        }, delay);
      }
      // Safety fallback: clear after 50s regardless
      setTimeout(() => {
        if (!cleared) {
          setIndexingKbId(null);
          loadData();
        }
      }, 50000);
    } catch (err: any) {
      setNotification({
        type: "error",
        title: "Lỗi lập chỉ mục",
        message: err.message || "Không thể kích hoạt lập chỉ mục",
      });
      setIndexingKbId(null);
    }
  };

  // Handle Global Index
  const handleGlobalReindex = async () => {
    if (!token) return;
    if (!window.confirm("Bạn có muốn lập lại chỉ mục vector cho TOÀN BỘ bài viết trên blog?")) return;
    setIsReindexingGlobal(true);
    try {
      const res = await triggerRAGIndex(token);
      setNotification({
        type: "info",
        title: "Đang đồng bộ Vector toàn blog",
        message: res.message || "Hệ thống đang lập lại chỉ mục cho tất cả bài viết trong nền.",
      });
      setTimeout(loadData, 4000);
      setTimeout(loadData, 8000);
    } catch (err: any) {
      setNotification({
        type: "error",
        title: "Lỗi đồng bộ",
        message: err.message || "Không thể kích hoạt đồng bộ",
      });
    } finally {
      setIsReindexingGlobal(false);
    }
  };

  // Global Blog KB representation as first-class Knowledge Base
  const globalKb = useMemo<KnowledgeBase>(() => {
    const total = ragStatus?.total_posts_count ?? 0;
    const indexed = ragStatus?.indexed_posts_count ?? (ragStatus?.index_exists ? total : 0);
    const pending = ragStatus?.pending_posts_count ?? Math.max(0, total - indexed);
    const isIndexed = Boolean(ragStatus?.index_exists && (ragStatus?.num_vectors ?? 0) > 0);

    return {
      id: "global-blog-kb",
      name: "Toàn Bộ Blog (Global Knowledge Base)",
      slug: "global",
      description: "Kho tri thức hệ thống mặc định của toàn bộ blog. Tự động bao gồm tất cả các bài viết đã xuất bản và là phạm vi tìm kiếm mặc định của trợ lý AI.",
      is_active: true,
      is_system: true,
      created_at: ragStatus?.last_indexed_at || "",
      updated_at: ragStatus?.last_indexed_at || "",
      series_count: optionsData.series.length,
      direct_posts_count: total,
      effective_posts_count: total,
      is_indexed: isIndexed,
      num_vectors: ragStatus?.num_vectors ?? 0,
      indexed_posts_count: indexed,
      pending_posts_count: pending,
      last_indexed_at: ragStatus?.last_indexed_at ?? null,
      series: [],
      posts: [],
    };
  }, [ragStatus, optionsData.series.length]);

  const allKbs = useMemo(() => {
    return [globalKb, ...kbs];
  }, [globalKb, kbs]);

  // Filter list
  const filteredKbs = useMemo(() => {
    if (!searchQuery.trim()) return allKbs;
    const q = searchQuery.toLowerCase().trim();
    return allKbs.filter(
      (k) =>
        k.name.toLowerCase().includes(q) ||
        k.slug.toLowerCase().includes(q) ||
        (k.description && k.description.toLowerCase().includes(q))
    );
  }, [allKbs, searchQuery]);

  // Modal filtered options
  const filteredOptionsSeries = useMemo(() => {
    if (!seriesFilter.trim()) return optionsData.series;
    const q = seriesFilter.toLowerCase().trim();
    return optionsData.series.filter((s) => s.title.toLowerCase().includes(q));
  }, [optionsData.series, seriesFilter]);

  const filteredOptionsPosts = useMemo(() => {
    if (!postFilter.trim()) return optionsData.posts;
    const q = postFilter.toLowerCase().trim();
    return optionsData.posts.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        (p.series_title && p.series_title.toLowerCase().includes(q))
    );
  }, [optionsData.posts, postFilter]);

  return (
    <AdminGuard>
      <div className="w-full max-w-6xl mx-auto space-y-6 pb-20">
        <LoadingOverlay isLoading={isProcessing} message={processMessage} />

        <AdminPageHeader
          currentTab="rag"
          breadcrumbs={[
            { label: "Admin", href: "/admin" },
            { label: "Kho tri thức & RAG AI" },
          ]}
          title="Quản Lý Kho Tri Thức (RAG Knowledge Bases)"
          description="Thiết lập các kho tri thức độc lập theo từng chuyên đề, khóa học hoặc danh sách bài viết để trợ lý AI tìm kiếm và trả lời chính xác."
          icon={Bot}
          actionButton={
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={openCreateModal}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm transition-all shadow-blue-500/20"
              >
                <Plus className="w-4 h-4" />
                <span>Tạo Kho Tri Thức Mới</span>
              </button>
            </div>
          }
        />

        {/* Notification Banner */}
        {notification && (
          <div
            className={`p-4 rounded-2xl border flex items-start justify-between gap-3 shadow-xs transition-all ${
              notification.type === "success"
                ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-100"
                : notification.type === "error"
                ? "bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-900 dark:text-rose-100"
                : "bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800 text-blue-900 dark:text-blue-100"
            }`}
          >
            <div className="flex items-start gap-3">
              {notification.type === "success" ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              ) : notification.type === "error" ? (
                <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
              ) : (
                <RefreshCw className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5 animate-spin" />
              )}
              <div className="space-y-0.5 text-xs sm:text-sm">
                <div className="font-bold">{notification.title || "Thông báo"}</div>
                <div className="leading-relaxed opacity-90">
                  {notification.message}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setNotification(null)}
              className="p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition-colors shrink-0"
              title="Đóng thông báo"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Overview Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Total KBs (global + custom) */}
          <div className="p-4 rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900/60 space-y-1 shadow-xs">
            <div className="flex items-center justify-between text-stone-500 text-xs font-medium">
              <span>Tổng Kho Tri Thức</span>
              <Database className="w-4 h-4 text-blue-600" />
            </div>
            <div className="text-2xl font-black text-stone-900 dark:text-white">
              {allKbs.length}
            </div>
            <div className="text-[11px] text-stone-400">
              1 kho hệ thống &bull; {kbs.length} kho tuỳ chỉnh
            </div>
          </div>

          {/* Card 2: Indexed KBs (all, including global) */}
          <div className="p-4 rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900/60 space-y-1 shadow-xs">
            <div className="flex items-center justify-between text-stone-500 text-xs font-medium">
              <span>Kho Đã Có Vector Index</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
              {allKbs.filter((k) => k.is_indexed).length} / {allKbs.length}
            </div>
            <div className="text-[11px] text-stone-400">
              {allKbs.filter((k) => k.is_indexed).length === allKbs.length
                ? "Tất cả kho đã sẵn sàng"
                : `${allKbs.filter((k) => !k.is_indexed).length} kho chưa lập chỉ mục`}
            </div>
          </div>

          {/* Card 3: Global vectors */}
          <div className="p-4 rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900/60 space-y-1 shadow-xs">
            <div className="flex items-center justify-between text-stone-500 text-xs font-medium">
              <span>Vectors Kho Global</span>
              <Sparkles className="w-4 h-4 text-purple-600" />
            </div>
            <div className="text-2xl font-black text-purple-600 dark:text-purple-400">
              {ragStatus?.num_vectors || 0}
            </div>
            <div className="text-[11px] text-stone-400">
              {(ragStatus?.indexed_posts_count ?? 0)} đã index
              {(ragStatus?.pending_posts_count ?? 0) > 0
                ? ` · ${ragStatus.pending_posts_count} chờ index`
                : " · Đầy đủ"}
            </div>
          </div>

          {/* Card 4: AI model */}
          <div className="p-4 rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900/60 space-y-1 shadow-xs">
            <div className="flex items-center justify-between text-stone-500 text-xs font-medium">
              <span>Mô Hình AI Đang Chạy</span>
              <Bot className="w-4 h-4 text-amber-600" />
            </div>
            <div className="text-sm font-bold text-stone-900 dark:text-white truncate pt-1">
              Gemini 2.5 Flash
            </div>
            <div className="text-[11px] text-stone-400 truncate">
              Embedding: text-embedding-004
            </div>
          </div>
        </div>

        {/* Search Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white dark:bg-stone-900/60 p-3 rounded-2xl border border-stone-200 dark:border-stone-800">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm kiếm kho tri thức theo tên, slug, mô tả..."
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800/50 text-stone-900 dark:text-white focus:outline-hidden focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <span className="text-xs text-stone-500 shrink-0">
            Hiển thị <strong>{filteredKbs.length}</strong> kho tri thức
          </span>
        </div>

        {/* Knowledge Base Cards Grid */}
        <div className="relative min-h-[360px]">
          <LoadingOverlay
            isLoading={loading}
            message="Đang tải dữ liệu Kho Tri Thức..."
            rounded="rounded-3xl"
          />

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-pulse">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="p-5 rounded-3xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900/60 space-y-4"
                >
                  <div className="flex items-center justify-between">
                    <div className="h-5 w-28 rounded-full bg-stone-100 dark:bg-stone-800" />
                    <div className="h-4 w-16 rounded-full bg-stone-100 dark:bg-stone-800" />
                  </div>
                  <div className="space-y-2">
                    <div className="h-5 w-3/4 rounded-lg bg-stone-100 dark:bg-stone-800" />
                    <div className="h-3 w-full rounded-lg bg-stone-100 dark:bg-stone-800" />
                    <div className="h-3 w-5/6 rounded-lg bg-stone-100 dark:bg-stone-800" />
                  </div>
                  <div className="p-3 rounded-2xl bg-stone-50 dark:bg-stone-800/40 space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div className="h-14 rounded-xl bg-stone-100 dark:bg-stone-700/40" />
                      <div className="h-14 rounded-xl bg-stone-100 dark:bg-stone-700/40" />
                    </div>
                    <div className="h-3 w-2/3 rounded-lg bg-stone-100 dark:bg-stone-800 mx-auto" />
                  </div>
                  <div className="pt-3 border-t border-stone-100 dark:border-stone-800 flex items-center gap-2">
                    <div className="h-7 w-24 rounded-xl bg-stone-100 dark:bg-stone-800" />
                    <div className="h-7 w-16 rounded-xl bg-stone-100 dark:bg-stone-800" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredKbs.length === 0 ? (
          <div className="py-16 text-center border-2 border-dashed border-stone-200 dark:border-stone-800 rounded-3xl space-y-3 bg-white/40 dark:bg-stone-900/20">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 mx-auto flex items-center justify-center">
              <Database className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-sm text-stone-800 dark:text-stone-200">
              {searchQuery ? "Không tìm thấy kho tri thức phù hợp" : "Chưa có Kho Tri Thức nào"}
            </h3>
            <p className="text-xs text-stone-500 max-w-sm mx-auto">
              {searchQuery
                ? "Thử thay đổi từ khóa tìm kiếm."
                : "Bấm 'Tạo Kho Tri Thức Mới' để gom các bài viết hoặc khóa học lại thành một kho tra cứu AI chuyên đề."}
            </p>
            {!searchQuery && (
              <button
                type="button"
                onClick={openCreateModal}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700"
              >
                <Plus className="w-4 h-4" />
                <span>Tạo Kho Tri Thức Đầu Tiên</span>
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredKbs.map((kb) => {
              const isGlobal = Boolean(kb.is_system);
              const isGlobalReindexing = isGlobal && isReindexingGlobal;
              const isKbIndexing = !isGlobal && (indexingKbId === kb.id || backgroundIndexingIds.includes(kb.id));

              return (
                <div
                  key={kb.id}
                  className={`p-5 rounded-3xl border space-y-4 shadow-xs transition-all flex flex-col justify-between ${
                    isGlobal
                      ? "border-blue-300/80 dark:border-blue-800/80 bg-linear-to-br from-blue-50/40 via-white to-indigo-50/20 dark:from-stone-900 dark:via-stone-900/90 dark:to-blue-950/20 shadow-blue-500/5 hover:border-blue-400"
                      : "border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900/70 hover:border-blue-300 dark:hover:border-blue-800"
                  }`}
                >
                  <div className="space-y-3">
                    {/* Top Badges */}
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        {isGlobal ? (
                          <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 flex items-center gap-1">
                            <Globe className="w-3 h-3" />
                            <span>Kho Hệ Thống • Toàn Blog</span>
                          </span>
                        ) : (
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              kb.is_active
                                ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300"
                                : "bg-stone-100 dark:bg-stone-800 text-stone-500"
                            }`}
                          >
                            {kb.is_active ? "Đang kích hoạt" : "Tạm khóa"}
                          </span>
                        )}

                        {isGlobalReindexing || isKbIndexing ? (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 flex items-center gap-1 animate-pulse">
                            <RefreshCw className="w-3 h-3 text-blue-600 animate-spin" />
                            <span>Đang đồng bộ index...</span>
                          </span>
                        ) : kb.is_indexed ? (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3 text-blue-600" />
                            <span>{kb.num_vectors} vectors</span>
                          </span>
                        ) : (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 flex items-center gap-1">
                            <AlertCircle className="w-3 h-3 text-amber-600" />
                            <span>Chưa lập index</span>
                          </span>
                        )}
                      </div>

                      <span className="text-[11px] font-mono text-stone-400">
                        /{kb.slug}
                      </span>
                    </div>

                    {/* Title & Desc */}
                    <div>
                      <h3 className="font-bold text-base text-stone-900 dark:text-white flex items-center gap-2">
                        {isGlobal ? (
                          <Globe className="w-4 h-4 text-blue-600 shrink-0" />
                        ) : (
                          <Database className="w-4 h-4 text-blue-600 shrink-0" />
                        )}
                        <span>{kb.name}</span>
                      </h3>
                      {kb.description && (
                        <p className="text-xs text-stone-500 dark:text-stone-400 mt-1 line-clamp-2 leading-relaxed">
                          {kb.description}
                        </p>
                      )}
                    </div>

                    {/* Indexing Stats Progress Block */}
                    <div className="p-3 rounded-2xl bg-stone-50 dark:bg-stone-800/40 border border-stone-100 dark:border-stone-800 space-y-2.5">
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="p-2.5 rounded-xl bg-white dark:bg-stone-800/80 border border-stone-200/80 dark:border-stone-700/60">
                          <div className="text-[10px] uppercase font-bold tracking-wider text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span>Đã Index</span>
                          </div>
                          <div className="text-base font-black text-stone-900 dark:text-white mt-0.5">
                            {kb.indexed_posts_count ?? (kb.is_indexed ? kb.effective_posts_count : 0)}
                            <span className="text-[11px] font-normal text-stone-500 ml-1">bài viết</span>
                          </div>
                        </div>

                        <div
                          className={`p-2.5 rounded-xl border ${
                            (kb.pending_posts_count ?? 0) > 0
                              ? "bg-amber-50/80 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800/60"
                              : "bg-white dark:bg-stone-800/80 border-stone-200/80 dark:border-stone-700/60"
                          }`}
                        >
                          <div
                            className={`text-[10px] uppercase font-bold tracking-wider flex items-center gap-1 ${
                              (kb.pending_posts_count ?? 0) > 0
                                ? "text-amber-700 dark:text-amber-400"
                                : "text-stone-500"
                            }`}
                          >
                            <Clock className="w-3 h-3" />
                            <span>Chờ Index</span>
                          </div>
                          <div
                            className={`text-base font-black mt-0.5 ${
                              (kb.pending_posts_count ?? 0) > 0
                                ? "text-amber-900 dark:text-amber-200"
                                : "text-stone-900 dark:text-white"
                            }`}
                          >
                            {kb.pending_posts_count ?? 0}
                            <span className="text-[11px] font-normal text-stone-500 ml-1">bài viết</span>
                          </div>
                        </div>
                      </div>

                      {/* Lần index cuối cùng */}
                      <div className="pt-2 border-t border-stone-200/60 dark:border-stone-700/50 flex items-center justify-between text-[11px]">
                        <span className="text-stone-500 dark:text-stone-400 flex items-center gap-1">
                          <Clock className="w-3 h-3 text-stone-400" />
                          <span>Lần index cuối:</span>
                        </span>
                        <strong
                          className="text-stone-800 dark:text-stone-200 font-semibold truncate max-w-[210px]"
                          title={kb.last_indexed_at || undefined}
                        >
                          {formatLastIndexed(kb.last_indexed_at)}
                        </strong>
                      </div>

                      {/* Composition info for custom KBs */}
                      {!isGlobal && (
                        <div className="pt-2 border-t border-stone-200/60 dark:border-stone-700/50 flex items-center justify-between text-[11px]">
                          <span className="text-stone-500">Phạm vi nội dung:</span>
                          <span className="text-stone-700 dark:text-stone-300 font-medium">
                            {kb.series_count} khóa học • {kb.direct_posts_count} bài viết lẻ
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions Bar */}
                  <div className="pt-3 border-t border-stone-100 dark:border-stone-800 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      {isGlobal ? (
                        <button
                          type="button"
                          onClick={handleGlobalReindex}
                          disabled={isReindexingGlobal}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-stone-900 hover:bg-stone-800 dark:bg-stone-100 dark:hover:bg-white text-white dark:text-stone-900 text-xs font-semibold shadow-xs transition-all disabled:opacity-50"
                          title="Lập lại toàn bộ chỉ mục vector cho tất cả bài viết trên blog"
                        >
                          <RefreshCw
                            className={`w-3.5 h-3.5 ${
                              isReindexingGlobal ? "animate-spin text-blue-400 dark:text-blue-600" : ""
                            }`}
                          />
                          <span>{isReindexingGlobal ? "Đang index..." : "Re-index Toàn Blog"}</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleIndexKB(kb)}
                          disabled={isKbIndexing}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-stone-200 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-700 dark:text-stone-300 text-xs font-semibold transition-all disabled:opacity-50"
                          title="Lập lại chỉ mục vector riêng cho kho này"
                        >
                          <RefreshCw
                            className={`w-3 h-3 ${isKbIndexing ? "animate-spin text-blue-600" : ""}`}
                          />
                          <span>{isKbIndexing ? "Đang index..." : "Lập index"}</span>
                        </button>
                      )}

                      <Link
                        href={isGlobal ? "/rag" : `/rag?kb=${kb.id}`}
                        target="_blank"
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-xs font-semibold transition-all"
                        title="Mở giao diện chat RAG cho kho này"
                      >
                        <Sparkles className="w-3 h-3" />
                        <span>Chat thử</span>
                        <ExternalLink className="w-2.5 h-2.5 opacity-60" />
                      </Link>
                    </div>

                    <div className="flex items-center gap-1">
                      {isGlobal ? (
                        <span
                          className="inline-flex items-center gap-1 text-[11px] font-medium text-stone-400 dark:text-stone-500 px-2 py-1 rounded-lg bg-stone-100 dark:bg-stone-800"
                          title="Kho tri thức hệ thống mặc định — Không thể chỉnh sửa hoặc xóa"
                        >
                          <Lock className="w-3 h-3" />
                          <span>Hệ thống</span>
                        </span>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => openEditModal(kb)}
                            className="p-1.5 text-stone-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40 rounded-lg transition-colors"
                            title="Chỉnh sửa kho tri thức"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(kb)}
                            className="p-1.5 text-stone-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors"
                            title="Xóa kho tri thức"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Modal Create / Edit Knowledge Base */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs">
            <div className="relative w-full max-w-3xl max-h-[92vh] flex flex-col rounded-3xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
              {/* Modal Header */}
              <div className="px-6 py-4 border-b border-stone-200 dark:border-stone-800 flex items-center justify-between shrink-0 bg-stone-50/50 dark:bg-stone-800/40">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-blue-100 dark:bg-blue-950/80 text-blue-600">
                    <Database className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-stone-900 dark:text-white">
                      {editingKb ? `Chỉnh sửa: "${editingKb.name}"` : "Tạo Kho Tri Thức Mới"}
                    </h3>
                    <p className="text-[11px] text-stone-500">
                      Chọn các bài viết hoặc khóa học để tạo cơ sở dữ liệu tri thức riêng biệt
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="p-1.5 rounded-lg text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Modal Body */}
              <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-6 space-y-5">
                {formError && (
                  <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-xs text-rose-600 dark:text-rose-400 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{formError}</span>
                  </div>
                )}

                {/* Basic Information */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-stone-700 dark:text-stone-300">
                      Tên Kho Tri Thức <span className="text-rose-500">*</span>:
                    </label>
                    <input
                      type="text"
                      required
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      placeholder="VD: Kiến trúc Hệ thống & AI, DevOps & Cloud..."
                      className="w-full px-3 py-2 text-xs rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-white focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-stone-700 dark:text-stone-300">
                      Đường dẫn tĩnh (Slug):
                    </label>
                    <input
                      type="text"
                      value={formSlug}
                      onChange={(e) => setFormSlug(e.target.value)}
                      placeholder="Tự động tạo từ tên nếu để trống..."
                      className="w-full px-3 py-2 text-xs rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-white focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-stone-700 dark:text-stone-300">
                    Mô tả ngắn gọn về kho tri thức:
                  </label>
                  <textarea
                    rows={2}
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    placeholder="Mô tả phạm vi nội dung hoặc chủ đề của kho tri thức này..."
                    className="w-full px-3 py-2 text-xs rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-white focus:outline-hidden focus:ring-1 focus:ring-blue-500 resize-y"
                  />
                </div>

                <label className="flex items-center gap-2 text-xs font-medium text-stone-700 dark:text-stone-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formIsActive}
                    onChange={(e) => setFormIsActive(e.target.checked)}
                    className="rounded border-stone-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span>Kích hoạt kho tri thức (Cho phép người dùng chọn và hỏi đáp trên giao diện /rag)</span>
                </label>

                {/* ── Section 1: Khóa học / Series ── */}
                <div className="p-4 rounded-2xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-900/40 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <GraduationCap className="w-4 h-4 text-amber-600 shrink-0" />
                      <span className="text-xs font-bold text-amber-950 dark:text-amber-200">
                        1. Chọn Khóa Học / Series ({selectedSeriesIds.length} đã chọn):
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={selectAllSeries}
                        className="text-[11px] text-amber-700 dark:text-amber-400 hover:underline font-semibold"
                      >
                        Chọn tất cả
                      </button>
                      <span className="text-stone-300 dark:text-stone-700">•</span>
                      <button
                        type="button"
                        onClick={deselectAllSeries}
                        className="text-[11px] text-stone-500 hover:underline"
                      >
                        Bỏ chọn
                      </button>
                    </div>
                  </div>

                  <p className="text-[11px] text-amber-800/80 dark:text-amber-300/80 leading-relaxed bg-amber-100/40 dark:bg-amber-900/30 p-2 rounded-xl">
                    💡 <strong>Đặc quyền Khóa học:</strong> Khi chọn một khóa học, toàn bộ bài học (kể cả các chương phân cấp) bên trong khóa học đó sẽ tự động được gộp vào kho tri thức này mà không cần tích chọn thủ công từng bài lẻ.
                  </p>

                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-stone-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={seriesFilter}
                      onChange={(e) => setSeriesFilter(e.target.value)}
                      placeholder="Lọc khóa học..."
                      className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-amber-200 dark:border-amber-800 bg-white dark:bg-stone-900 text-stone-900 dark:text-white"
                    />
                  </div>

                  {loadingOptions ? (
                    <div className="py-4 text-center text-xs text-stone-500 flex items-center justify-center gap-2">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Đang tải danh sách khóa học...</span>
                    </div>
                  ) : filteredOptionsSeries.length === 0 ? (
                    <p className="text-xs text-stone-500 italic py-2">Không tìm thấy khóa học nào</p>
                  ) : (
                    <div className="max-h-44 overflow-y-auto space-y-1.5 pr-1 divide-y divide-amber-100 dark:divide-amber-950/40">
                      {filteredOptionsSeries.map((s) => {
                        const isChecked = selectedSeriesIds.includes(s.id);
                        return (
                          <label
                            key={s.id}
                            className={`flex items-center justify-between p-2 rounded-xl cursor-pointer transition-colors text-xs ${
                              isChecked
                                ? "bg-amber-100/60 dark:bg-amber-900/40 font-medium"
                                : "hover:bg-amber-50 dark:hover:bg-amber-950/20"
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0 pr-2">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => toggleSeries(s.id)}
                                className="rounded border-amber-300 text-amber-600 focus:ring-amber-500"
                              />
                              <span className="truncate text-stone-800 dark:text-stone-200">{s.title}</span>
                            </div>
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-amber-200/60 dark:bg-amber-900/80 text-amber-900 dark:text-amber-200 shrink-0">
                              {s.lesson_count} bài học
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* ── Section 2: Bài viết lẻ ── */}
                <div className="p-4 rounded-2xl bg-blue-50/40 dark:bg-blue-950/20 border border-blue-200/80 dark:border-blue-900/40 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-blue-600 shrink-0" />
                      <span className="text-xs font-bold text-blue-950 dark:text-blue-200">
                        2. Chọn Thêm Bài Viết Lẻ ({selectedPostIds.length} đã chọn):
                      </span>
                    </div>

                    {selectedPostIds.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setSelectedPostIds([])}
                        className="text-[11px] text-stone-500 hover:underline"
                      >
                        Bỏ chọn bài viết
                      </button>
                    )}
                  </div>

                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-stone-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={postFilter}
                      onChange={(e) => setPostFilter(e.target.value)}
                      placeholder="Lọc bài viết theo tiêu đề hoặc khóa học..."
                      className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-blue-200 dark:border-blue-800 bg-white dark:bg-stone-900 text-stone-900 dark:text-white"
                    />
                  </div>

                  {loadingOptions ? (
                    <div className="py-4 text-center text-xs text-stone-500 flex items-center justify-center gap-2">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Đang tải danh sách bài viết...</span>
                    </div>
                  ) : filteredOptionsPosts.length === 0 ? (
                    <p className="text-xs text-stone-500 italic py-2">Không tìm thấy bài viết nào</p>
                  ) : (
                    <div className="max-h-52 overflow-y-auto space-y-1.5 pr-1 divide-y divide-blue-100 dark:divide-blue-950/40">
                      {filteredOptionsPosts.map((p) => {
                        const isChecked = selectedPostIds.includes(p.id);
                        return (
                          <label
                            key={p.id}
                            className={`flex items-center justify-between p-2 rounded-xl cursor-pointer transition-colors text-xs ${
                              isChecked
                                ? "bg-blue-100/60 dark:bg-blue-900/40 font-medium"
                                : "hover:bg-blue-50 dark:hover:bg-blue-950/20"
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0 pr-2">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => togglePost(p.id)}
                                className="rounded border-blue-300 text-blue-600 focus:ring-blue-500"
                              />
                              <span className="truncate text-stone-800 dark:text-stone-200">{p.title}</span>
                            </div>
                            {p.series_title && (
                              <span className="text-[10px] text-stone-500 dark:text-stone-400 shrink-0 truncate max-w-[160px]">
                                Thuộc: {p.series_title}
                              </span>
                            )}
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Footer preview */}
                <div className="p-3 rounded-2xl bg-stone-100 dark:bg-stone-800/80 border border-stone-200 dark:border-stone-700 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="text-stone-600 dark:text-stone-300">
                    Tổng kết nội dung: <strong>{selectedSeriesIds.length}</strong> khóa học •{" "}
                    <strong>{selectedPostIds.length}</strong> bài viết lẻ
                  </div>
                  <div className="text-blue-600 dark:text-blue-400 font-bold">
                    ≈ {estimatedEffectiveCount} bài học dự kiến sẽ lập chỉ mục
                  </div>
                </div>

                {/* Buttons */}
                <div className="pt-2 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    disabled={isSubmittingModal}
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 text-xs text-stone-500 hover:text-stone-700 dark:hover:text-stone-300 font-medium disabled:opacity-50"
                  >
                    Hủy bỏ
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingModal}
                    className="px-5 py-2 text-xs font-semibold rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-sm shadow-blue-500/20 transition-all flex items-center gap-2 disabled:opacity-60"
                  >
                    {isSubmittingModal ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>{editingKb ? "Đang lưu..." : "Đang tạo..."}</span>
                      </>
                    ) : (
                      editingKb ? "Lưu thay đổi & Lập chỉ mục" : "Xác nhận tạo Kho Tri Thức"
                    )}
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
