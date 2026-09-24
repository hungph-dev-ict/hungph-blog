"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Sparkles,
  Bot,
  ArrowRight,
  Database,
  Cpu,
  Search,
  CheckCircle2,
  RefreshCw,
  ExternalLink,
  BookOpen,
  Layers,
  Terminal,
  Zap,
  Info,
} from "lucide-react";
import { queryRAG, getRAGStatus, triggerRAGIndex } from "@/lib/api";
import { Breadcrumbs } from "@/components/common/Breadcrumbs";
import { useAuth } from "@/lib/auth-context";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

const SUGGESTED_PROMPTS = [
  "Tại sao RAG lại là tương lai của ứng dụng AI?",
  "Tích hợp vector search và pgvector trên PostgreSQL thế nào?",
  "Kiến trúc Modular Monolith trong FastAPI được thiết kế ra sao?",
  "Làm thế nào để xây dựng hệ thống AI có trách nhiệm và tuân thủ?",
];

function RAGContent() {
  const { user, token } = useAuth();
  const searchParams = useSearchParams();
  const initialQ = searchParams?.get("q") || "";
  const isAdmin = user?.role === "admin" || user?.is_admin;

  const [query, setQuery] = useState(initialQ);
  const [loading, setLoading] = useState(false);
  const [reindexing, setReindexing] = useState(false);
  const [reindexMsg, setReindexMsg] = useState<string | null>(null);
  const [status, setStatus] = useState<any>(null);
  const [result, setResult] = useState<{
    answer: string;
    sources: Array<{ title: string; slug: string; similarity_score: number; snippet: string }>;
    model?: string;
  } | null>(null);

  useEffect(() => {
    fetchStatus();
    if (initialQ.trim()) {
      handleQuery(undefined, initialQ);
    }
  }, [initialQ]);

  const fetchStatus = async () => {
    try {
      const s = await getRAGStatus();
      setStatus(s);
    } catch {
      setStatus(null);
    }
  };

  const handleQuery = async (e?: React.FormEvent, customQuery?: string) => {
    if (e) e.preventDefault();
    const q = customQuery || query;
    if (!q.trim()) return;

    if (customQuery) setQuery(customQuery);
    setLoading(true);
    setResult(null);

    try {
      const data = await queryRAG(q);
      setResult(data);
    } catch (err: any) {
      alert(`Lỗi kết nối RAG: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleReindex = async () => {
    if (!token) return;
    setReindexing(true);
    setReindexMsg(null);
    try {
      const res = await triggerRAGIndex(token);
      setReindexMsg(res.message);
      setTimeout(fetchStatus, 3000);
    } catch (err: any) {
      setReindexMsg(`Lỗi re-index: ${err.message}`);
    } finally {
      setReindexing(false);
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto space-y-8 pb-16">
      <Breadcrumbs items={[{ label: "Trợ lý AI (RAG Assistant)" }]} />

      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-3xl p-6 sm:p-10 border border-blue-200/60 dark:border-blue-900/40 bg-gradient-to-br from-blue-50/80 via-white to-purple-50/80 dark:from-stone-900/90 dark:via-stone-900/60 dark:to-blue-950/40 shadow-sm backdrop-blur-xl">
        <div className="absolute top-0 right-0 -mt-12 -mr-12 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-12 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
              <Sparkles className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <span>HungPH.Blog Semantic Intelligence • MVP Ready</span>
            </div>

            {/* Status indicator */}
            {status && (
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>
                  {status.status === "ready" ? "Hệ thống RAG sẵn sàng" : "Chưa hoàn tất index"} • {status.num_vectors || 0} vectors
                </span>
              </div>
            )}
          </div>

          <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-stone-900 dark:text-white">
            Trợ Lý AI & Tìm Kiếm Ngữ Nghĩa
          </h1>

          <p className="text-stone-600 dark:text-stone-300 text-sm sm:text-base max-w-3xl leading-relaxed">
            Hệ thống RAG (Retrieval-Augmented Generation) tìm kiếm trực tiếp trong toàn bộ kho tri thức bài viết của blog bằng vector embedding đa chiều và tổng hợp câu trả lời chính xác, kèm trích dẫn nguồn minh bạch.
          </p>

          {/* Admin Reindex trigger */}
          {isAdmin && (
            <div className="pt-2 flex items-center gap-3">
              <button
                onClick={handleReindex}
                disabled={reindexing}
                className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-stone-900 hover:bg-stone-800 dark:bg-stone-100 dark:hover:bg-white text-white dark:text-stone-900 text-xs font-semibold transition-all disabled:opacity-50 shadow-xs"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${reindexing ? "animate-spin" : ""}`} />
                <span>{reindexing ? "Đang đồng bộ..." : "Re-index kho bài viết (Admin)"}</span>
              </button>
              {reindexMsg && (
                <span className="text-xs text-stone-500 dark:text-stone-400 italic">
                  {reindexMsg}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Interactive Playground */}
      <div className="p-6 sm:p-8 rounded-3xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900/60 shadow-sm space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-stone-900 dark:text-white flex items-center gap-2">
              <span>Hỏi đáp cùng Trợ Lý AI</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-600 dark:text-blue-300 font-bold uppercase">
                Gemini 2.5 Flash
              </span>
            </h2>
            <p className="text-xs text-stone-500">Tra cứu ngữ nghĩa thực tế từ toàn bộ nội dung các bài viết trên blog</p>
          </div>
        </div>

        {/* Search input form */}
        <form onSubmit={(e) => handleQuery(e)} className="space-y-3">
          <div className="relative">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Đặt câu hỏi về kiến trúc phần mềm, RAG, pgvector, FastAPI..."
              className="w-full pl-4 pr-28 py-3.5 rounded-2xl border border-stone-200 dark:border-stone-700 bg-stone-50/50 dark:bg-stone-800/60 text-sm text-stone-900 dark:text-white placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all shadow-inner"
            />
            <button
              type="submit"
              disabled={loading || !query.trim()}
              className="absolute right-2 top-1/2 -translate-y-1/2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold disabled:opacity-50 transition-all shadow-md shadow-blue-500/20 flex items-center gap-1.5"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Đang suy luận...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Hỏi AI</span>
                </>
              )}
            </button>
          </div>
        </form>

        {/* Suggested Prompts */}
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-xs text-stone-400">
            <Zap className="w-3 h-3 text-amber-500" />
            <span>Câu hỏi gợi ý nhanh:</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {SUGGESTED_PROMPTS.map((prompt, idx) => (
              <button
                key={idx}
                onClick={() => handleQuery(undefined, prompt)}
                disabled={loading}
                className="text-left text-xs px-3 py-1.5 rounded-xl border border-stone-200 dark:border-stone-700 hover:border-blue-300 dark:hover:border-blue-700 bg-stone-50 dark:bg-stone-800/40 hover:bg-blue-50/50 dark:hover:bg-blue-950/30 text-stone-700 dark:text-stone-300 transition-all shadow-2xs"
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>

        {/* AI Answer & Source Documents */}
        {result && (
          <div className="p-6 rounded-2xl border border-blue-200 dark:border-blue-900/60 bg-blue-50/30 dark:bg-blue-950/20 space-y-5 animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="flex items-center justify-between border-b border-blue-200/60 dark:border-blue-900/40 pb-3">
              <div className="flex items-center gap-2 text-xs font-bold text-blue-700 dark:text-blue-400 uppercase tracking-wider">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                <span>Câu trả lời từ RAG</span>
              </div>
              <span className="text-[11px] text-stone-400 font-mono">
                {result.model || "Gemini 2.5 Flash + FAISS"}
              </span>
            </div>

            {/* Formatted Answer */}
            <div className="prose prose-sm dark:prose-invert max-w-none text-stone-800 dark:text-stone-200 text-sm leading-relaxed whitespace-pre-line">
              {result.answer}
            </div>

            {/* Citations / Sources */}
            {result.sources && result.sources.length > 0 && (
              <div className="pt-4 border-t border-stone-200 dark:border-stone-800/80 space-y-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-stone-700 dark:text-stone-300">
                  <BookOpen className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                  <span>Bài viết nguồn được trích dẫn ({result.sources.length} tài liệu):</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {result.sources.map((s, idx) => (
                    <Link
                      key={idx}
                      href={`/posts/${s.slug}`}
                      className="group p-3.5 rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 hover:border-blue-300 dark:hover:border-blue-700 transition-all shadow-2xs hover:shadow-xs space-y-1.5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-semibold text-xs text-stone-900 dark:text-stone-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors line-clamp-1">
                          {s.title}
                        </span>
                        <div className="shrink-0 flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/60">
                          {Math.round(s.similarity_score * 100)}% khớp
                        </div>
                      </div>
                      <p className="text-stone-500 dark:text-stone-400 text-[11px] line-clamp-2 leading-relaxed">
                        {s.snippet}
                      </p>
                      <div className="flex items-center gap-1 text-[11px] text-blue-600 dark:text-blue-400 font-medium pt-1">
                        <span>Đọc toàn văn bài viết</span>
                        <ExternalLink className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Architecture Highlights */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold text-stone-900 dark:text-white flex items-center gap-2">
          <Layers className="w-5 h-5 text-blue-600" />
          <span>Kiến Trúc RAG Hoạt Động Như Thế Nào?</span>
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="p-5 rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900/60 space-y-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center text-blue-600">
              <Database className="w-4 h-4" />
            </div>
            <h3 className="font-bold text-sm text-stone-900 dark:text-white">1. Chunking & Embedding</h3>
            <p className="text-xs text-stone-500 leading-relaxed">
              Mỗi bài viết được làm sạch, chia thành các đoạn 400 từ và chuyển hóa thành vector 3072 chiều bằng Google Gemini Embedding.
            </p>
          </div>

          <div className="p-5 rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900/60 space-y-2.5">
            <div className="w-9 h-9 rounded-xl bg-purple-100 dark:bg-purple-900/50 flex items-center justify-center text-purple-600">
              <Cpu className="w-4 h-4" />
            </div>
            <h3 className="font-bold text-sm text-stone-900 dark:text-white">2. FAISS Vector Search</h3>
            <p className="text-xs text-stone-500 leading-relaxed">
              Thư viện FAISS (Facebook AI Similarity Search) lập chỉ mục L2/Cosine, tìm kiếm tức thì các đoạn văn bản tương đồng ngữ nghĩa nhất.
            </p>
          </div>

          <div className="p-5 rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900/60 space-y-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center text-emerald-600">
              <Search className="w-4 h-4" />
            </div>
            <h3 className="font-bold text-sm text-stone-900 dark:text-white">3. Gemini Flash Generation</h3>
            <p className="text-xs text-stone-500 leading-relaxed">
              Mô hình Gemini 2.5 Flash tiếp nhận ngữ cảnh thực tế được truy xuất và tổng hợp câu trả lời tiếng Việt chính xác, không hallucination.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function RAGPage() {
  return (
    <Suspense fallback={<div className="py-20 text-center text-sm text-stone-400">Đang tải Trợ lý AI...</div>}>
      <RAGContent />
    </Suspense>
  );
}
