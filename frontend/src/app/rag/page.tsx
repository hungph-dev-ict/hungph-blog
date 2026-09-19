"use client";

import React, { useState } from "react";
import { Sparkles, Bot, ArrowRight, Database, Cpu, Search, CheckCircle2 } from "lucide-react";
import { queryRAG } from "@/lib/api";

export default function RAGAssistantPage() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleAsk = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    try {
      const data = await queryRAG(query);
      setResult(data);
    } catch (err: any) {
      alert(`Lỗi kết nối RAG: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-10 pb-16">
      {/* Header */}
      <div className="space-y-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Tính năng mở rộng (Giai đoạn 2)</span>
        </div>
        <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-stone-900 dark:text-white">
          AI Tra Cứu & RAG Assistant
        </h1>
        <p className="text-stone-600 dark:text-stone-400 text-base sm:text-lg leading-relaxed">
          Nền tảng được thiết kế sẵn sàng để bạn cắm mô hình LLM (Gemini/OpenAI) và cơ sở dữ liệu vector (<code className="text-purple-600 font-mono text-sm">pgvector</code>). Độc giả có thể tra cứu thông tin ngữ nghĩa trong toàn bộ các bài viết của blog.
        </p>
      </div>

      {/* Architecture Highlights */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="p-5 rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900/60 space-y-2">
          <div className="w-8 h-8 rounded-xl bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center text-blue-600">
            <Database className="w-4 h-4" />
          </div>
          <h3 className="font-bold text-sm text-stone-900 dark:text-white">PostgreSQL + pgvector</h3>
          <p className="text-xs text-stone-500 leading-relaxed">
            Lưu trữ vector embeddings trực tiếp trong cùng DB Postgres trên Render/Neon mà không tốn chi phí thuê ngoài.
          </p>
        </div>

        <div className="p-5 rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900/60 space-y-2">
          <div className="w-8 h-8 rounded-xl bg-purple-100 dark:bg-purple-900/50 flex items-center justify-center text-purple-600">
            <Cpu className="w-4 h-4" />
          </div>
          <h3 className="font-bold text-sm text-stone-900 dark:text-white">FastAPI Backend</h3>
          <p className="text-xs text-stone-500 leading-relaxed">
            Module <code className="font-mono text-purple-500">app/modules/rag</code> được tổ chức độc lập, sẵn sàng cắm LangChain hoặc LlamaIndex.
          </p>
        </div>

        <div className="p-5 rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900/60 space-y-2">
          <div className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center text-emerald-600">
            <Search className="w-4 h-4" />
          </div>
          <h3 className="font-bold text-sm text-stone-900 dark:text-white">Semantic Search</h3>
          <p className="text-xs text-stone-500 leading-relaxed">
            Tìm kiếm theo ngữ nghĩa và trích dẫn trực tiếp liên kết nguồn của bài viết liên quan.
          </p>
        </div>
      </div>

      {/* Interactive Playground */}
      <div className="p-6 sm:p-8 rounded-3xl border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-900/40 space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center text-white shadow-md">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-stone-900 dark:text-white">Trải nghiệm tương tác RAG</h2>
            <p className="text-xs text-stone-500">Gửi câu hỏi để kiểm tra kết nối API RAG từ FastAPI Backend</p>
          </div>
        </div>

        <form onSubmit={handleAsk} className="space-y-3">
          <div className="relative">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ví dụ: Tác giả đã chia sẻ bài viết nào về kiến trúc hệ thống?"
              className="w-full pl-4 pr-28 py-3 rounded-2xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 text-sm text-stone-900 dark:text-white placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all shadow-sm"
            />
            <button
              type="submit"
              disabled={loading}
              className="absolute right-2 top-1/2 -translate-y-1/2 px-4 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold disabled:opacity-50 transition-colors shadow-sm"
            >
              {loading ? "Đang xử lý..." : "Hỏi AI"}
            </button>
          </div>
        </form>

        {result && (
          <div className="p-5 rounded-2xl border border-purple-200/80 dark:border-purple-900/60 bg-white dark:bg-stone-900 space-y-4">
            <div className="flex items-center gap-2 text-xs font-bold text-purple-600 uppercase tracking-wider">
              <CheckCircle2 className="w-4 h-4" />
              <span>Phản hồi từ RAG Module</span>
            </div>

            <p className="text-sm text-stone-800 dark:text-stone-200 leading-relaxed font-medium">
              {result.answer}
            </p>

            {result.sources && result.sources.length > 0 && (
              <div className="pt-3 border-t border-stone-100 dark:border-stone-800 space-y-2">
                <div className="text-xs font-semibold text-stone-500">Nguồn trích dẫn giả lập:</div>
                <div className="grid grid-cols-1 gap-2">
                  {result.sources.map((s: any, idx: number) => (
                    <div
                      key={idx}
                      className="p-3 rounded-xl bg-stone-50 dark:bg-stone-800/60 text-xs space-y-1"
                    >
                      <div className="font-semibold text-stone-900 dark:text-stone-100">{s.title}</div>
                      <p className="text-stone-500 text-[11px]">{s.snippet}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
