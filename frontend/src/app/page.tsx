"use client";

import React, { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  Search,
  Sparkles,
  Tag as TagIcon,
  Layers,
  PenLine,
  GraduationCap,
  ArrowRight,
  BookOpen,
  Clock,
  User as UserIcon,
  Cpu,
  Flame,
  Binary,
  Compass,
  Zap,
  Calendar,
  Eye,
  Heart,
  ExternalLink,
  Bot,
  Database,
  CheckCircle2,
} from "lucide-react";
import Link from "next/link";
import {
  fetchCategories,
  fetchPosts,
  fetchLatestSeries,
  fetchSpotlightPost,
  getFullCourseImageUrl,
  getFullImageUrl,
  getLikeStatus,
  toggleLike,
} from "@/lib/api";
import { Category, PaginatedPosts, PostListItem, Series } from "@/lib/types";
import { PostCard } from "@/components/blog/PostCard";
import { Pagination } from "@/components/common/Pagination";
import { LoadingOverlay } from "@/components/common/LoadingOverlay";
import { useAuth } from "@/lib/auth-context";

function formatCourseDuration(minutes?: number) {
  if (!minutes || minutes <= 0) return null;
  if (minutes < 60) return `${minutes} phút đọc`;
  const hours = Math.floor(minutes / 60);
  const remainingMins = minutes % 60;
  if (remainingMins === 0) return `${hours} giờ đọc`;
  return `${hours} giờ ${remainingMins}p đọc`;
}

// ──────────────────────────────────────────────────────────────
// Spotlight Featured Post Component
// ──────────────────────────────────────────────────────────────
function SpotlightHeroPost({ post }: { post: PostListItem }) {
  const { user, token } = useAuth();
  const [liked, setLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(post.likes_count ?? 0);
  const [likeLoading, setLikeLoading] = useState(false);

  useEffect(() => {
    if (post.likes_count !== undefined) {
      setLikesCount(post.likes_count);
    }
    if (!token) return;

    getLikeStatus(post.id, token)
      .then((s) => {
        setLiked(s.liked);
        if (s.likes_count !== undefined) {
          setLikesCount(s.likes_count);
        }
      })
      .catch(() => { });
  }, [post.id, post.likes_count, token]);

  const handleLike = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!user || !token) {
      alert("Vui lòng đăng nhập để thả tim bài viết!");
      return;
    }
    if (likeLoading) return;
    setLikeLoading(true);
    try {
      const result = await toggleLike(post.id, token);
      setLiked(result.liked);
      setLikesCount(result.likes_count);
    } finally {
      setLikeLoading(false);
    }
  };

  const formattedDate = post.published_at
    ? new Date(post.published_at).toLocaleDateString("vi-VN", {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
    : "Chưa xuất bản";

  const authorName = post.author?.full_name || post.author?.username || "Tác giả";

  return (
    <article className="group relative overflow-hidden rounded-3xl border border-stone-200/90 dark:border-stone-800 bg-white/80 dark:bg-stone-900/80 backdrop-blur-xl p-6 sm:p-8 hover:border-blue-500/50 hover:shadow-2xl hover:shadow-blue-500/10 transition-all duration-500">
      {/* Subtle Glowing Radial Background */}
      <div className="absolute -top-20 -right-20 w-80 h-80 bg-gradient-to-br from-blue-500/10 via-indigo-500/10 to-cyan-500/5 dark:from-blue-600/20 dark:via-indigo-600/15 dark:to-transparent rounded-full blur-3xl pointer-events-none" />

      <div className="flex flex-col lg:flex-row gap-6 lg:gap-8 items-stretch relative z-10">
        {/* Cover Image */}
        <Link
          href={`/posts/${post.slug}`}
          className="lg:w-1/2 min-h-[240px] sm:min-h-[290px] rounded-2xl overflow-hidden relative block bg-stone-100 dark:bg-stone-800 shadow-md group-hover:shadow-xl transition-all shrink-0"
        >
          <img
            src={getFullImageUrl(post.cover_image)}
            alt={post.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
            loading="eager"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-stone-950/60 via-transparent to-transparent opacity-60 group-hover:opacity-40 transition-opacity" />
          <div className="absolute top-3 left-3 flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-stone-950/70 backdrop-blur-md text-cyan-300 border border-cyan-500/30 shadow-xs">
            <Flame className="w-3.5 h-3.5 text-cyan-400 fill-cyan-400/30" />
            <span>SPOTLIGHT HEADLINE</span>
          </div>
        </Link>

        {/* Content Details */}
        <div className="flex flex-col justify-between flex-1 py-1 space-y-4">
          <div className="space-y-3">
            {/* Meta Row */}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              {post.category && (
                <span className="px-2.5 py-0.5 rounded-full font-semibold bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200/60 dark:border-blue-800/60 text-[11px]">
                  {post.category.name}
                </span>
              )}

              {post.series && (
                <Link
                  href={`/series/${post.series.slug}`}
                  className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-semibold text-[11px] bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200/60 dark:border-amber-800/60 hover:bg-amber-100 transition-colors"
                >
                  <GraduationCap className="w-3 h-3 text-amber-600" />
                  <span className="truncate max-w-[160px] sm:max-w-[220px]">Series: {post.series.title}</span>
                </Link>
              )}

              <span className="text-stone-300 dark:text-stone-700">•</span>

              <span className="inline-flex items-center gap-1 text-stone-400 dark:text-stone-500 font-medium">
                <Calendar className="w-3.5 h-3.5" />
                {formattedDate}
              </span>

              {post.reading_time_minutes ? (
                <>
                  <span className="text-stone-300 dark:text-stone-700">•</span>
                  <span className="inline-flex items-center gap-1 text-stone-400 dark:text-stone-500 font-medium">
                    <Clock className="w-3.5 h-3.5" />
                    {post.reading_time_minutes} phút đọc
                  </span>
                </>
              ) : null}
            </div>

            {/* Title */}
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-stone-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors leading-snug">
              <Link href={`/posts/${post.slug}`}>{post.title}</Link>
            </h2>

            {/* Summary */}
            {post.summary && (
              <p className="text-stone-600 dark:text-stone-300 text-sm sm:text-base leading-relaxed line-clamp-3">
                {post.summary}
              </p>
            )}

            {/* Tags */}
            {post.tags && post.tags.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                {post.tags.slice(0, 4).map((tag) => (
                  <span
                    key={tag.id}
                    className="text-[11px] font-medium text-stone-500 dark:text-stone-400 bg-stone-100 dark:bg-stone-800/80 px-2.5 py-0.5 rounded-lg border border-stone-200/50 dark:border-stone-700/50"
                  >
                    #{tag.name}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Bottom Actions & Author */}
          <div className="flex items-center justify-between pt-4 border-t border-stone-100 dark:border-stone-800/80">
            {/* Author */}
            {post.author ? (
              <Link
                href={`/profile/${post.author.username}`}
                className="inline-flex items-center gap-2.5 font-medium text-stone-800 dark:text-stone-200 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
              >
                {post.author.avatar_url ? (
                  <img
                    src={getFullImageUrl(post.author.avatar_url)}
                    alt={authorName}
                    className="w-7 h-7 rounded-full object-cover border border-stone-200 dark:border-stone-700 shadow-xs"
                  />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white text-xs font-bold">
                    {authorName.charAt(0).toUpperCase()}
                  </div>
                )}
                <span className="text-xs font-bold">{authorName}</span>
              </Link>
            ) : (
              <div />
            )}

            {/* Interaction Buttons */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1 text-xs text-stone-400">
                <Eye className="w-3.5 h-3.5" />
                <span>{post.views_count?.toLocaleString() || 0}</span>
              </div>

              <button
                type="button"
                onClick={handleLike}
                disabled={likeLoading}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${liked
                    ? "bg-rose-50 text-rose-600 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-900"
                    : "border-stone-200 dark:border-stone-700 text-stone-500 hover:text-rose-600 hover:border-rose-200"
                  }`}
              >
                <Heart className={`w-3.5 h-3.5 ${liked ? "fill-rose-500 text-rose-500" : ""}`} />
                <span>{likesCount}</span>
              </button>

              <Link
                href={`/posts/${post.slug}`}
                className="inline-flex items-center gap-1 px-3 py-1 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs shadow-blue-500/20 transition-all"
              >
                <span>Đọc bài</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

// ──────────────────────────────────────────────────────────────
// RAG Interactive Showcase Component
// ──────────────────────────────────────────────────────────────
function RAGShowcaseSection() {
  const router = useRouter();
  const [interactiveQ, setInteractiveQ] = useState("");
  const [activeStep, setActiveStep] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveStep((prev) => (prev + 1) % 4);
    }, 2800);
    return () => clearInterval(timer);
  }, []);

  const handleLaunch = (q?: string) => {
    const queryToUse = q || interactiveQ;
    if (queryToUse.trim()) {
      router.push(`/rag?q=${encodeURIComponent(queryToUse.trim())}`);
    } else {
      router.push("/rag");
    }
  };

  const steps = [
    {
      title: "Tri Thức Bài Viết",
      sub: "28+ bài viết Markdown & HTML",
      icon: BookOpen,
      color: "from-blue-500 to-cyan-500",
      border: "border-blue-500/40",
      bg: "bg-blue-500/10",
      text: "text-blue-500",
    },
    {
      title: "Vector 3072D",
      sub: "Gemini text-embedding-001",
      icon: Cpu,
      color: "from-indigo-500 to-purple-500",
      border: "border-indigo-500/40",
      bg: "bg-indigo-500/10",
      text: "text-indigo-500",
    },
    {
      title: "FAISS Index",
      sub: "Cosine Similarity < 5ms",
      icon: Database,
      color: "from-purple-500 to-pink-500",
      border: "border-purple-500/40",
      bg: "bg-purple-500/10",
      text: "text-purple-500",
    },
    {
      title: "Gemini 2.5 Flash",
      sub: "Tổng hợp không ảo giác",
      icon: Sparkles,
      color: "from-emerald-500 to-teal-500",
      border: "border-emerald-500/40",
      bg: "bg-emerald-500/10",
      text: "text-emerald-500",
    },
  ];

  const quickPrompts = [
    "Kiến trúc RAG trên Blog gồm những bước nào?",
    "Tại sao chọn pgvector thay vì thuê Vector DB?",
    "Modular Monolith trong FastAPI là gì?",
  ];

  return (
    <section className="relative overflow-hidden rounded-3xl border border-blue-200/80 dark:border-blue-900/50 bg-gradient-to-br from-blue-50/70 via-indigo-50/30 to-purple-50/50 dark:from-stone-900/90 dark:via-blue-950/30 dark:to-purple-950/20 backdrop-blur-xl p-6 sm:p-8 shadow-lg shadow-blue-500/5 space-y-6">
      {/* Background glow effects */}
      <div className="absolute top-0 right-1/4 -mt-10 w-72 h-72 bg-blue-500/10 dark:bg-blue-500/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-0 -mb-10 w-72 h-72 bg-purple-500/10 dark:bg-purple-500/20 rounded-full blur-3xl pointer-events-none" />

      {/* Top Banner Row */}
      <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-5 border-b border-stone-200/70 dark:border-stone-800/80 pb-6">
        <div className="space-y-2 max-w-2xl">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-xs">
              <Bot className="w-3.5 h-3.5" />
              <span>RAG Engine Live</span>
            </span>
            <span className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>FAISS Flat-IP Vector Index • 78 Chunks</span>
            </span>
          </div>

          <h2 className="text-xl sm:text-2xl font-black tracking-tight text-stone-900 dark:text-white flex items-center gap-2">
            <span>Tìm Kiếm Ngữ Nghĩa &amp; Trợ Lý AI</span>
            <span className="text-blue-600 dark:text-cyan-400">RAG</span>
          </h2>

          <p className="text-xs sm:text-sm text-stone-600 dark:text-stone-300 leading-relaxed">
            Hỏi đáp trực tiếp với kho tri thức của blog. Mô hình trích xuất các đoạn văn bản tương đồng nhất và đối chiếu với Gemini 2.5 Flash để trả lời trung thực, kèm theo phần trăm khớp nguồn.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <Link
            href="/posts/kien-truc-rag-retrieval-augmented-generation-cua-blog"
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 hover:border-blue-400 dark:hover:border-blue-600 bg-white/80 dark:bg-stone-800/80 hover:bg-stone-50 dark:hover:bg-stone-800 text-stone-800 dark:text-stone-200 text-xs font-semibold transition-all shadow-xs"
          >
            <BookOpen className="w-3.5 h-3.5 text-blue-600 dark:text-cyan-400" />
            <span>Đọc bài viết kiến trúc</span>
          </Link>

          <Link
            href="/rag"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white text-xs font-bold shadow-md shadow-blue-500/25 transition-all hover:scale-[1.02]"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Mở Trợ lý AI</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {/* Animated Pipeline Nodes */}
      <div className="relative z-10 space-y-2">
        <div className="text-[11px] font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider flex items-center gap-1.5">
          <Zap className="w-3.5 h-3.5 text-amber-500" />
          <span>Quy trình truy vấn thời gian thực (Real-time Pipeline)</span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {steps.map((step, idx) => {
            const Icon = step.icon;
            const isCurrent = activeStep === idx;
            return (
              <div
                key={idx}
                onClick={() => setActiveStep(idx)}
                className={`relative p-4 rounded-2xl border transition-all duration-300 cursor-pointer overflow-hidden ${
                  isCurrent
                    ? `${step.border} ${step.bg} shadow-md scale-[1.02] ring-2 ring-blue-500/20`
                    : "border-stone-200/60 dark:border-stone-800/80 bg-white/60 dark:bg-stone-900/40 hover:border-stone-300 dark:hover:border-stone-700"
                }`}
              >
                {/* Active progress bar */}
                {isCurrent && (
                  <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 animate-pulse" />
                )}

                <div className="flex items-center gap-2.5 mb-2">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${step.bg} ${step.text} shrink-0`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] font-mono font-bold text-stone-400">
                    BƯỚC 0{idx + 1}
                  </span>
                </div>

                <div className="font-bold text-xs text-stone-900 dark:text-white leading-tight">
                  {step.title}
                </div>
                <div className="text-[11px] text-stone-500 dark:text-stone-400 leading-snug mt-1">
                  {step.sub}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Interactive Query Launcher */}
      <div className="relative z-10 p-4 sm:p-5 rounded-2xl bg-white/70 dark:bg-stone-900/70 border border-stone-200 dark:border-stone-800/80 space-y-3 shadow-inner">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleLaunch();
          }}
          className="flex flex-col sm:flex-row gap-2"
        >
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={interactiveQ}
              onChange={(e) => setInteractiveQ(e.target.value)}
              placeholder="Nhập câu hỏi thử nghiệm để xem RAG trích xuất tri thức..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800/80 text-xs sm:text-sm text-stone-900 dark:text-white placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
            />
          </div>
          <button
            type="submit"
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm transition-all shrink-0 cursor-pointer"
          >
            <span>Hỏi RAG ngay</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </form>

        <div className="flex flex-wrap items-center gap-1.5 text-xs text-stone-500">
          <span className="text-[11px] text-stone-400 mr-1">Thử nhanh:</span>
          {quickPrompts.map((p, i) => (
            <button
              key={i}
              type="button"
              onClick={() => handleLaunch(p)}
              className="text-[11px] px-2.5 py-1 rounded-lg border border-stone-200 dark:border-stone-700 hover:border-blue-400 dark:hover:border-blue-600 bg-stone-100/80 dark:bg-stone-800/60 hover:bg-blue-50 dark:hover:bg-blue-950/40 text-stone-700 dark:text-stone-300 transition-colors cursor-pointer"
            >
              {p}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

// ──────────────────────────────────────────────────────────────
// Home Content Inner Component
// ──────────────────────────────────────────────────────────────
function HomeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialCategory = searchParams?.get("category") || "";
  const initialTag = searchParams?.get("tag") || "";
  const initialSearch = searchParams?.get("search") || "";

  const [postsData, setPostsData] = useState<PaginatedPosts | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [latestSeries, setLatestSeries] = useState<Series | null>(null);
  const [spotlightPost, setSpotlightPost] = useState<PostListItem | null>(null);
  const [spotlightLoaded, setSpotlightLoaded] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>(initialCategory);
  const [searchQuery, setSearchQuery] = useState<string>(initialTag || initialSearch);
  const [searchPlaceholder, setSearchPlaceholder] = useState<string>("Tìm kiếm...");
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadingMessage, setLoadingMessage] = useState<string>("Đang tải bài viết mới nhất...");
  const [seriesLoading, setSeriesLoading] = useState<boolean>(true);
  const [categoriesLoading, setCategoriesLoading] = useState<boolean>(true);

  // Responsive Search Placeholder (gọn gàng 'Tìm kiếm...' trên mobile để không bị cụt chữ)
  useEffect(() => {
    const updatePlaceholder = () => {
      if (window.innerWidth >= 640) {
        setSearchPlaceholder("Tìm kiếm chủ đề, giải pháp kiến trúc, Claude RAG, distributed cache...");
      } else {
        setSearchPlaceholder("Tìm kiếm...");
      }
    };
    updatePlaceholder();
    window.addEventListener("resize", updatePlaceholder);
    return () => window.removeEventListener("resize", updatePlaceholder);
  }, []);

  // Sync state from URL query parameters (category, tag, search)
  useEffect(() => {
    const urlCategory = searchParams?.get("category") || "";
    const urlTag = searchParams?.get("tag");
    const urlSearch = searchParams?.get("search");

    let changed = false;
    if (urlCategory !== selectedCategory) {
      setSelectedCategory(urlCategory);
      changed = true;
    }

    const queryTarget = urlTag !== null ? urlTag : (urlSearch !== null ? urlSearch : null);
    if (queryTarget !== null && queryTarget !== searchQuery) {
      setSearchQuery(queryTarget);
      changed = true;
    }

    if (changed) {
      setCurrentPage(1);
    }

    // Smooth scroll to articles feed if arriving with category or search/tag filter
    if (urlCategory || urlTag || urlSearch) {
      setTimeout(() => {
        document.getElementById("articles-feed")?.scrollIntoView({ behavior: "smooth" });
      }, 350);
    }
  }, [searchParams]);

  const loadPosts = async (
    targetPage = currentPage,
    targetCategory = selectedCategory,
    targetSearch = searchQuery,
    customMessage?: string
  ) => {
    const msg =
      customMessage ||
      (targetSearch
        ? "Đang tìm kiếm bài viết..."
        : targetCategory
          ? "Đang lọc bài viết..."
          : targetPage > 1
            ? `Đang tải trang ${targetPage}...`
            : "Đang tải bài viết mới nhất...");

    setLoadingMessage(msg);
    setLoading(true);
    try {
      const data = await fetchPosts({
        page: targetPage,
        limit: 8,
        category: targetCategory || undefined,
        search: targetSearch || undefined,
      });
      // Sort newest first
      data.items = data.items.sort((a, b) => {
        const dateA = new Date(a.published_at || a.created_at).getTime();
        const dateB = new Date(b.published_at || b.created_at).getTime();
        return dateB - dateA;
      });
      setPostsData(data);
    } catch (err) {
      console.error("Lỗi tải bài viết:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories()
      .then(setCategories)
      .catch(console.error)
      .finally(() => setCategoriesLoading(false));

    fetchLatestSeries()
      .then(setLatestSeries)
      .catch(console.error)
      .finally(() => setSeriesLoading(false));

    fetchSpotlightPost()
      .then(setSpotlightPost)
      .catch(console.error)
      .finally(() => setSpotlightLoaded(true));
  }, []);

  useEffect(() => {
    loadPosts(
      currentPage,
      selectedCategory,
      searchQuery,
      selectedCategory
        ? "Đang lọc bài viết..."
        : currentPage > 1
          ? `Đang tải trang ${currentPage}...`
          : "Đang tải bài viết mới nhất..."
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCategory, currentPage]);

  const handleSelectCategory = (catSlug: string) => {
    if (selectedCategory === catSlug) return;
    setSelectedCategory(catSlug);
    setCurrentPage(1);

    const params = new URLSearchParams(searchParams ? searchParams.toString() : "");
    if (catSlug) {
      params.set("category", catSlug);
    } else {
      params.delete("category");
    }
    params.delete("page");
    const qs = params.toString();
    router.push(qs ? `/?${qs}` : "/", { scroll: false });
  };

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
    window.scrollTo({ top: 400, behavior: "smooth" });
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);

    const params = new URLSearchParams(searchParams ? searchParams.toString() : "");
    if (searchQuery.trim()) {
      params.set("search", searchQuery.trim());
    } else {
      params.delete("search");
    }
    params.delete("tag");
    params.delete("page");
    const qs = params.toString();
    router.push(qs ? `/?${qs}` : "/", { scroll: false });

    loadPosts(1, selectedCategory, searchQuery, "Đang tìm kiếm bài viết...");
  };

  const handleQuickTagClick = (tag: string) => {
    setSearchQuery(tag);
    setCurrentPage(1);

    const params = new URLSearchParams(searchParams ? searchParams.toString() : "");
    params.set("tag", tag);
    params.delete("search");
    params.delete("page");
    const qs = params.toString();
    router.push(qs ? `/?${qs}` : "/", { scroll: false });

    loadPosts(1, selectedCategory, tag, `Đang lọc theo chủ đề "${tag}"...`);
  };

  const isBrowsingAllNewest = currentPage === 1 && !selectedCategory && !searchQuery.trim();
  // If a spotlight post is configured by admin, use it as headline; otherwise fall back to newest post
  const headlinePost = isBrowsingAllNewest
    ? (spotlightLoaded && spotlightPost
        ? spotlightPost
        : (postsData?.items && postsData.items.length > 0 ? postsData.items[0] : null))
    : null;
  // Remove spotlight post from the list to avoid duplication
  const standardPosts = headlinePost && postsData
    ? postsData.items.filter(p => p.id !== headlinePost.id)
    : postsData?.items || [];

  return (
    <div className="space-y-12 pb-16">
      {/* ══════════════════════════════════════════════════════════════ */}
      {/* 1. HERO SECTION — FUTURISTIC ARCHITECTURE & CYBER-AESTHETIC  */}
      {/* ══════════════════════════════════════════════════════════════ */}
      <section className="relative overflow-hidden rounded-3xl border border-stone-200/90 dark:border-stone-800 bg-white/70 dark:bg-stone-900/60 backdrop-blur-2xl p-8 sm:p-12 lg:p-16 shadow-xl shadow-stone-200/40 dark:shadow-none">
        {/* Futuristic Background Mesh & Glow Orbs */}
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-cyan-500/15 dark:bg-cyan-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-1/2 -right-32 w-96 h-96 bg-indigo-500/15 dark:bg-indigo-600/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute inset-0 bg-[radial-gradient(#3b82f615_1px,transparent_1px)] [background-size:24px_24px] pointer-events-none" />

        <div className="relative z-10 max-w-4xl space-y-6">
          {/* Cyber Status Indicator */}
          <div className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-stone-900/5 dark:bg-stone-800/80 text-stone-800 dark:text-stone-200 border border-stone-200 dark:border-stone-700/80 shadow-xs">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <span className="tracking-wide uppercase text-[11px] font-mono">
              Action Over Theory • Build To Learn
            </span>
          </div>

          {/* Main Slogan */}
          <div className="space-y-1">
            <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black tracking-tight leading-[1.08]">
              <span className="block text-stone-900/40 dark:text-stone-400/80">
                Đừng đọc
              </span>
              <span className="block bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-500 dark:from-cyan-300 dark:via-blue-400 dark:to-indigo-300 bg-clip-text text-transparent font-black">
                Hãy làm
              </span>
            </h1>
          </div>

          {/* Command Prompt Search Bar */}
          <form onSubmit={handleSearchSubmit} className="pt-2 max-w-2xl">
            <div className="relative flex items-center group">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center gap-2 pointer-events-none text-stone-400 group-focus-within:text-blue-500 transition-colors">
                <Search className="w-4 h-4" />
                <span className="text-stone-300 dark:text-stone-700">|</span>
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full pl-11 pr-24 sm:pr-28 py-3 sm:py-3.5 rounded-2xl border border-stone-200 dark:border-stone-700 bg-white/90 dark:bg-stone-950/80 text-sm text-stone-900 dark:text-white placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-blue-500/60 focus:border-blue-500 transition-all shadow-sm"
              />
              <button
                type="submit"
                className="absolute right-2 top-1/2 -translate-y-1/2 px-3 sm:px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-semibold shadow-md shadow-blue-500/20 transition-all cursor-pointer flex items-center gap-1.5"
              >
                <span>Tìm kiếm</span>
                <ArrowRight className="w-3.5 h-3.5 hidden sm:inline" />
              </button>
            </div>

            {/* Quick Keyword Pills */}
            <div className="flex flex-wrap items-center gap-1.5 pt-3 text-xs text-stone-500 dark:text-stone-400">
              <span className="text-[11px] font-medium mr-1 text-stone-400">Gợi ý nhanh:</span>
              {[
                "Claude-Architect",
                "RAG",
                "AI-Agent",
                "Multi-Agent",
                "Distributed-Systems",
                "FastAPI",
                "NextJS",
              ].map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => handleQuickTagClick(tag)}
                  className="px-2.5 py-1 rounded-lg text-[11px] font-mono bg-stone-100 dark:bg-stone-800/80 text-stone-600 dark:text-stone-300 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-950/40 dark:hover:text-cyan-400 border border-stone-200/60 dark:border-stone-700/60 transition-colors cursor-pointer"
                >
                  #{tag}
                </button>
              ))}
            </div>
          </form>

          {/* Futuristic Highlights Matrix */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 pt-4 border-t border-stone-200/60 dark:border-stone-800/80 max-w-3xl">
            <div className="flex items-center gap-3 p-3 rounded-2xl bg-white/40 dark:bg-stone-900/40 border border-stone-200/50 dark:border-stone-800/50 backdrop-blur-sm">
              <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                <Cpu className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-bold text-stone-900 dark:text-white">Kiến Trúc Phân Tán</p>
                <p className="text-[11px] text-stone-500">Reliable • High Throughput</p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 rounded-2xl bg-white/40 dark:bg-stone-900/40 border border-stone-200/50 dark:border-stone-800/50 backdrop-blur-sm">
              <div className="w-9 h-9 rounded-xl bg-cyan-50 dark:bg-cyan-950/60 text-cyan-600 dark:text-cyan-400 flex items-center justify-center shrink-0">
                <Zap className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-bold text-stone-900 dark:text-white">AI &amp; RAG Vector</p>
                <p className="text-[11px] text-stone-500">Autonomous Multi-Agent</p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 rounded-2xl bg-white/40 dark:bg-stone-900/40 border border-stone-200/50 dark:border-stone-800/50 backdrop-blur-sm">
              <div className="w-9 h-9 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
                <Binary className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-bold text-stone-900 dark:text-white">Thực Chiến Chuyên Sâu</p>
                <p className="text-[11px] text-stone-500">Case Studies &amp; Blueprints</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════ */}
      {/* 2. SPOTLIGHT COURSE SHOWCASE                                  */}
      {/* ══════════════════════════════════════════════════════════════ */}
      {seriesLoading ? (
        <section className="h-32 rounded-3xl border border-stone-200 dark:border-stone-800 bg-white/50 dark:bg-stone-900/50 animate-pulse" />
      ) : latestSeries ? (
        <section className="relative overflow-hidden rounded-3xl border border-blue-300/70 dark:border-blue-800/60 bg-gradient-to-br from-blue-50/80 via-indigo-50/40 to-cyan-50/30 dark:from-blue-950/50 dark:via-stone-900/70 dark:to-cyan-950/30 backdrop-blur-xl p-6 sm:p-7 shadow-lg shadow-blue-500/5">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5 relative z-10">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 sm:w-18 sm:h-18 rounded-2xl overflow-hidden shadow-lg shadow-blue-500/20 shrink-0 border-2 border-white dark:border-stone-800">
                <img
                  src={getFullCourseImageUrl(latestSeries.cover_image)}
                  alt={latestSeries.title}
                  className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
                />
              </div>

              <div className="space-y-1">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-blue-600 text-white shadow-xs">
                  <GraduationCap className="w-3 h-3" />
                  <span>SPOTLIGHT SERIES • LỘ TRÌNH BÀI BẢN</span>
                </div>

                <h3 className="font-bold text-base sm:text-lg text-stone-900 dark:text-white line-clamp-1">
                  <Link href={`/series/${latestSeries.slug}`} className="hover:text-blue-600 transition-colors">
                    {latestSeries.title}
                  </Link>
                </h3>

                {latestSeries.summary && (
                  <p className="text-xs text-stone-600 dark:text-stone-300 line-clamp-1 max-w-xl">
                    {latestSeries.summary}
                  </p>
                )}

                {/* Course Metadata */}
                <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-[11px] text-stone-500 dark:text-stone-400 pt-0.5">
                  {(latestSeries.author?.full_name || latestSeries.author?.username) && (
                    <>
                      <span className="font-semibold text-stone-700 dark:text-stone-300">
                        {latestSeries.author?.full_name || latestSeries.author?.username}
                      </span>
                      <span className="text-stone-300 dark:text-stone-700">•</span>
                    </>
                  )}

                  <span className="inline-flex items-center gap-1">
                    <BookOpen className="w-3.5 h-3.5 text-stone-400" />
                    <span>{latestSeries.total_chapters} chương • {latestSeries.total_lessons} bài học</span>
                  </span>

                  {formatCourseDuration(latestSeries.total_reading_time_minutes) && (
                    <>
                      <span className="text-stone-300 dark:text-stone-700">•</span>
                      <span className="inline-flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-stone-400" />
                        <span>{formatCourseDuration(latestSeries.total_reading_time_minutes)}</span>
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>

            <Link
              href={`/series/${latestSeries.slug}`}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-bold shrink-0 shadow-md shadow-blue-500/25 transition-all hover:scale-[1.02] cursor-pointer"
            >
              <span>Xem Series</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </section>
      ) : null}

      {/* ══════════════════════════════════════════════════════════════ */}
      {/* 2.5. FUTURISTIC RAG SHOWCASE ANIMATION                       */}
      {/* ══════════════════════════════════════════════════════════════ */}
      <RAGShowcaseSection />

      {/* ══════════════════════════════════════════════════════════════ */}
      {/* 3. CATEGORY NAVIGATOR PILLS                                    */}
      {/* ══════════════════════════════════════════════════════════════ */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-bold text-stone-800 dark:text-stone-200">
            <Compass className="w-4 h-4 text-blue-600 dark:text-cyan-400" />
            <span>Khám phá theo chuyên đề</span>
          </div>

          {selectedCategory && (
            <button
              onClick={() => handleSelectCategory("")}
              className="text-xs text-blue-600 dark:text-cyan-400 hover:underline cursor-pointer font-medium"
            >
              Xóa lọc danh mục
            </button>
          )}
        </div>

        <div className="relative min-h-[44px]">
          <LoadingOverlay isLoading={categoriesLoading} message="Đang tải chủ đề..." />

          {categoriesLoading && categories.length === 0 ? (
            <div className="flex flex-wrap items-center gap-2 animate-pulse">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-9 w-28 rounded-xl bg-stone-100 dark:bg-stone-800" />
              ))}
            </div>
          ) : (
            <div
              className={`flex flex-wrap items-center gap-2 transition-opacity duration-200 ${categoriesLoading ? "opacity-40 pointer-events-none" : ""
                }`}
            >
              <button
                onClick={() => handleSelectCategory("")}
                className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${selectedCategory === ""
                    ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/20 scale-[1.02]"
                    : "bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800"
                  }`}
              >
                Tất cả bài viết
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => handleSelectCategory(cat.slug)}
                  className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${selectedCategory === cat.slug
                      ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/20 scale-[1.02]"
                      : "bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800"
                    }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════ */}
      {/* 4. ARTICLES FEED (HEADLINE HERO + FEED CARDS)                 */}
      {/* ══════════════════════════════════════════════════════════════ */}
      <section id="articles-feed" className="space-y-6 scroll-mt-20">
        <div className="flex items-center justify-between border-b border-stone-200 dark:border-stone-800 pb-3">
          <div className="flex items-center gap-2 text-sm font-bold text-stone-900 dark:text-white">
            <PenLine className="w-4 h-4 text-blue-600 dark:text-cyan-400" />
            <span>
              {searchQuery
                ? `Kết quả tìm kiếm cho "${searchQuery}"`
                : selectedCategory
                  ? `Chủ đề: ${categories.find((c) => c.slug === selectedCategory)?.name || selectedCategory}`
                  : "Bài viết mới nhất"}
            </span>
          </div>

          {postsData && (
            <span className="text-xs font-medium text-stone-500 dark:text-stone-400">
              {postsData.total === 0
                ? "0 bài viết"
                : `${(postsData.page - 1) * postsData.limit + 1}–${Math.min(
                  postsData.page * postsData.limit,
                  postsData.total
                )} / ${postsData.total} bài viết`}
            </span>
          )}
        </div>

        <div className="relative min-h-[360px] space-y-6">
          <LoadingOverlay isLoading={loading} message={loadingMessage} rounded="rounded-3xl" />

          {!postsData && loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-44 rounded-3xl border border-stone-200 dark:border-stone-800 bg-white/50 dark:bg-stone-900/50 p-6 animate-pulse"
                />
              ))}
            </div>
          ) : postsData && postsData.items.length > 0 ? (
            <div className={`space-y-6 transition-opacity duration-200 ${loading ? "opacity-50 pointer-events-none" : "opacity-100"}`}>
              {/* Highlight Hero Post on page 1 without filters */}
              {headlinePost && <SpotlightHeroPost post={headlinePost} />}

              {/* Feed Grid of remaining posts */}
              {standardPosts.length > 0 && (
                <div className="space-y-5">
                  {headlinePost && (
                    <div className="text-xs font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider pt-2">
                      Tuyển tập các bài viết tiếp theo
                    </div>
                  )}
                  <div className="grid grid-cols-1 gap-5">
                    {standardPosts.map((post) => (
                      <PostCard key={post.id} post={post} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-20 border border-dashed border-stone-200 dark:border-stone-800 rounded-3xl space-y-4 bg-white/40 dark:bg-stone-900/30">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-stone-100 dark:bg-stone-800 flex items-center justify-center text-stone-400">
                <TagIcon className="w-7 h-7" />
              </div>
              <div className="space-y-1">
                <h3 className="font-bold text-base text-stone-800 dark:text-stone-200">
                  Không tìm thấy bài viết nào
                </h3>
                <p className="text-xs sm:text-sm text-stone-500 dark:text-stone-400 max-w-sm mx-auto">
                  Thử tìm kiếm với từ khóa khác hoặc quay lại danh mục &ldquo;Tất cả bài viết&rdquo;.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  setSelectedCategory("");
                  setCurrentPage(1);
                }}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
              >
                Đặt lại bộ lọc
              </button>
            </div>
          )}
        </div>

        {/* Pagination */}
        {postsData && postsData.total_pages > 1 && (
          <div className="pt-6">
            <Pagination
              currentPage={currentPage}
              totalPages={postsData.total_pages}
              totalItems={postsData.total}
              itemsName="bài viết"
              onPageChange={handlePageChange}
              disabled={loading}
            />
          </div>
        )}
      </section>

      {/* ══════════════════════════════════════════════════════════════ */}
      {/* 5. FUTURE ARCHITECT MANIFESTO & QUICK GATEWAYS                */}
      {/* ══════════════════════════════════════════════════════════════ */}
      <section className="relative overflow-hidden rounded-3xl border border-stone-200 dark:border-stone-800 bg-stone-900 text-white p-8 sm:p-10 shadow-xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-xl">
            <span className="text-[11px] font-mono text-cyan-400 uppercase tracking-widest">
              Architect Philosophy
            </span>
            <blockquote className="text-lg sm:text-xl font-bold tracking-tight text-white leading-relaxed">
              &ldquo;Kiến trúc phần mềm không đơn thuần là những dòng mã — đó là nghệ thuật quản trị sự phức tạp và kiến tạo tương lai số.&rdquo;
            </blockquote>
            <p className="text-xs text-stone-400">
              — Chia sẻ từ hành trình xây dựng giải pháp công nghệ và tự học mỗi ngày.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <Link
              href="/series"
              className="px-4 py-2.5 rounded-xl bg-white text-stone-900 hover:bg-stone-100 text-xs font-bold transition-all shadow-md flex items-center gap-1.5"
            >
              <GraduationCap className="w-4 h-4 text-blue-600" />
              <span>Series</span>
            </Link>
            <Link
              href="/rag"
              className="px-4 py-2.5 rounded-xl border border-stone-700 bg-stone-800/80 hover:bg-stone-700 text-white text-xs font-bold transition-all flex items-center gap-1.5"
            >
              <Cpu className="w-4 h-4 text-cyan-400" />
              <span>Trợ lý RAG</span>
            </Link>
            <Link
              href="/categories"
              className="px-4 py-2.5 rounded-xl border border-stone-700 hover:border-stone-500 text-stone-300 hover:text-white text-xs font-semibold transition-all"
            >
              <span>Xem Chủ đề</span>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// HomePage Export Wrapped in Suspense
// ──────────────────────────────────────────────────────────────
export default function HomePage() {
  return (
    <Suspense fallback={<div className="p-12 text-center text-xs text-stone-400">Đang khởi tạo trang chủ...</div>}>
      <HomeContent />
    </Suspense>
  );
}
