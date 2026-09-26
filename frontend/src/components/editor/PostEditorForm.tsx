"use client";

import React, { useEffect, useState, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Save,
  Send,
  Upload,
  Settings,
  FolderPlus,
  CheckCircle,
  AlertCircle,
  ExternalLink,
  GraduationCap,
  Layers,
  ArrowUp,
  ArrowDown,
  Link as LinkIcon,
  Unlink,
  ListOrdered,
  Check,
  Loader2,
  Plus,
  X,
  Eye,
  EyeOff,
  Monitor,
  Smartphone,
  FileText,
  AlertTriangle,
  Flame,
  Image as ImageIcon,
  Trash2,
  Sparkles,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useLoading } from "@/lib/loading-context";
import {
  createPost,
  updatePost,
  fetchPostById,
  fetchCategories,
  createCategory,
  fetchSeries,
  fetchWriteableSeries,
  fetchSeriesBySlug,
  uploadMedia,
  getFullImageUrl,
  addChapter,
} from "@/lib/api";
import { Category, Chapter, PostDetail, Series, SeriesDetail } from "@/lib/types";
import { TipTapEditor } from "@/components/editor/TipTapEditor";
import { Breadcrumbs } from "@/components/common/Breadcrumbs";
import { NotFoundState } from "@/components/common/NotFoundState";

interface PostEditorFormProps {
  postId?: string;
}

const slugify = (val: string) =>
  val
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, "d")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");

export const PostEditorForm: React.FC<PostEditorFormProps> = ({ postId }) => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, token, isLoading } = useAuth();
  const { withLoading } = useLoading();
  const coverInputRef = useRef<HTMLInputElement>(null);

  const isAdmin = user?.role === "admin" || user?.is_admin;
  const [isUnauthorized, setIsUnauthorized] = useState(false);

  // Form State
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [isSlugSynced, setIsSlugSynced] = useState(!postId); // Default auto-sync on new post, lock on edit unless toggled
  const [summary, setSummary] = useState("");
  const [contentHtml, setContentHtml] = useState("<p></p>");
  const [coverImage, setCoverImage] = useState("");
  const [coverTab, setCoverTab] = useState<"upload" | "url">("upload");
  const [isCoverDragOver, setIsCoverDragOver] = useState<boolean>(false);
  const [categoryId, setCategoryId] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [isPublished, setIsPublished] = useState(false);
  const [isSpotlight, setIsSpotlight] = useState(false);

  // Series & Chapter State
  const [seriesList, setSeriesList] = useState<Series[]>([]);
  const [seriesId, setSeriesId] = useState("");
  const [chapterList, setChapterList] = useState<Chapter[]>([]);
  const [chapterId, setChapterId] = useState("");
  const [orderInChapter, setOrderInChapter] = useState(1);
  const [selectedLevelIds, setSelectedLevelIds] = useState<string[]>([]);
  const [postSeriesDetail, setPostSeriesDetail] = useState<SeriesDetail | null>(null);

  // Aux state
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionType, setActionType] = useState<"draft" | "publish" | null>(null);
  const [pageLoading, setPageLoading] = useState(!!postId);
  const [savedSlug, setSavedSlug] = useState<string | null>(null);
  const [showNewCatModal, setShowNewCatModal] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewDeviceMode, setPreviewDeviceMode] = useState<"desktop" | "mobile">("desktop");

  // Khóa scroll của body và bắt phím Escape khi mở modal xem trước
  useEffect(() => {
    if (!showPreviewModal) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setShowPreviewModal(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [showPreviewModal]);

  // Track initial state to detect unsaved changes
  const initialDataRef = useRef<{
    title: string;
    slug: string;
    summary: string;
    contentHtml: string;
    coverImage: string;
    categoryId: string;
    seriesId: string;
    chapterId: string;
    tagsInput: string;
  }>({
    title: "",
    slug: "",
    summary: "",
    contentHtml: "<p></p>",
    coverImage: "",
    categoryId: "",
    seriesId: "",
    chapterId: "",
    tagsInput: "",
  });

  const [hasSavedSuccessfully, setHasSavedSuccessfully] = useState(false);
  const [showExitConfirmModal, setShowExitConfirmModal] = useState(false);
  const [pendingNavigationUrl, setPendingNavigationUrl] = useState<string | null>(null);

  // Compute if form has unsaved modifications
  const isDirty = React.useMemo(() => {
    if (hasSavedSuccessfully) return false;
    if (!postId) {
      // Bài mới: coi là có thay đổi nếu user nhập tiêu đề hoặc nội dung hoặc tóm tắt/ảnh bìa
      const cleanContent = contentHtml ? contentHtml.replace(/<[^>]*>/g, "").trim() : "";
      return (
        title.trim().length > 0 ||
        cleanContent.length > 0 ||
        summary.trim().length > 0 ||
        coverImage.trim().length > 0
      );
    }
    // Bài đang chỉnh sửa: so sánh với giá trị khởi tạo ban đầu
    const init = initialDataRef.current;
    return (
      title !== init.title ||
      slug !== init.slug ||
      summary !== init.summary ||
      contentHtml !== init.contentHtml ||
      coverImage !== init.coverImage ||
      categoryId !== init.categoryId ||
      seriesId !== init.seriesId ||
      chapterId !== init.chapterId ||
      tagsInput !== init.tagsInput
    );
  }, [
    postId,
    title,
    slug,
    summary,
    contentHtml,
    coverImage,
    categoryId,
    seriesId,
    chapterId,
    tagsInput,
    hasSavedSuccessfully,
  ]);

  // 1. Chặn đóng tab / reload trình duyệt khi có dữ liệu chưa lưu
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = "Bạn có chắc chắn muốn thoát không? Nội dung đang biên soạn sẽ không được lưu lại.";
        return e.returnValue;
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

  // 2. Chặn chuyển trang nội bộ (Click vào link hoặc nút chuyển trang)
  useEffect(() => {
    const handleAnchorClick = (e: MouseEvent) => {
      if (!isDirty) return;

      const target = (e.target as HTMLElement).closest("a");
      if (!target) return;

      const href = target.getAttribute("href");
      if (!href || href.startsWith("#") || target.target === "_blank") return;

      const currentPath = window.location.pathname + window.location.search;
      if (href === currentPath) return;

      e.preventDefault();
      e.stopPropagation();
      setPendingNavigationUrl(href);
      setShowExitConfirmModal(true);
    };

    document.addEventListener("click", handleAnchorClick, true);
    return () => document.removeEventListener("click", handleAnchorClick, true);
  }, [isDirty]);

  // 3. Chặn nút Back / Forward trình duyệt
  useEffect(() => {
    if (!isDirty) return;

    window.history.pushState(null, "", window.location.href);

    const handlePopState = () => {
      if (isDirty) {
        window.history.pushState(null, "", window.location.href);
        setPendingNavigationUrl("BACK");
        setShowExitConfirmModal(true);
      }
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [isDirty]);

  const handleConfirmExit = () => {
    setHasSavedSuccessfully(true);
    setShowExitConfirmModal(false);
    if (pendingNavigationUrl === "BACK") {
      window.history.go(-2);
    } else if (pendingNavigationUrl) {
      router.push(pendingNavigationUrl);
    }
  };

  // Toast Notification State
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error" | "info";
  } | null>(null);
  const toastTimerRef = useRef<NodeJS.Timeout | null>(null);

  const triggerToast = (message: string, type: "success" | "error" | "info" = "success") => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ message, type });
    toastTimerRef.current = setTimeout(() => {
      setToast(null);
    }, 4000);
  };

  // Tự động đọc và hiển thị toast nếu có từ trang trước (ví dụ chuyển từ /editor/new sang /editor/[id])
  useEffect(() => {
    try {
      const persisted = sessionStorage.getItem("editor_toast");
      if (persisted) {
        sessionStorage.removeItem("editor_toast");
        const parsed = JSON.parse(persisted);
        if (parsed?.message) {
          triggerToast(parsed.message, parsed.type || "success");
        }
      }
    } catch {}
  }, []);

  // Inline Chapter Creation state
  const [showAddChapterModal, setShowAddChapterModal] = useState(false);
  const [addingLevelIdx, setAddingLevelIdx] = useState<number | null>(null);
  const [newChapterTitle, setNewChapterTitle] = useState("");
  const [newChapterDesc, setNewChapterDesc] = useState("");
  const [newChapterOrder, setNewChapterOrder] = useState<number>(1);
  const [modalSiblingChapters, setModalSiblingChapters] = useState<Chapter[]>([]);
  const [isAddingChapter, setIsAddingChapter] = useState(false);
  const [addChapterError, setAddChapterError] = useState("");

  // Check auth
  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/login?redirect=/editor/new");
    }
  }, [user, isLoading, router]);

  // Load categories & writeable series
  useEffect(() => {
    fetchCategories().then(setCategories).catch(console.error);
    if (token) {
      fetchWriteableSeries(token).then(setSeriesList).catch(console.error);
    } else {
      fetchSeries().then(setSeriesList).catch(console.error);
    }
  }, [token]);

  // Pre-fill series and chapter from query params if new post
  useEffect(() => {
    if (!postId && searchParams && seriesList.length > 0) {
      const qSeries = searchParams.get("series_id");
      const qChapter = searchParams.get("chapter_id");
      if (qSeries) {
        setSeriesId(qSeries);
        const selected = seriesList.find((s) => s.id === qSeries);
        if (selected?.category_id) {
          setCategoryId(selected.category_id);
        }
      }
      if (qChapter) setChapterId(qChapter);
    }
  }, [postId, searchParams, seriesList]);

  // Load chapters and full series detail whenever seriesId changes
  useEffect(() => {
    if (!seriesId) {
      setChapterList([]);
      setChapterId("");
      setSelectedLevelIds([]);
      setPostSeriesDetail(null);
      return;
    }
    const selected = seriesList.find((s) => s.id === seriesId);
    const slugToFetch = selected?.slug || searchParams?.get("series_slug") || postSeriesDetail?.slug;

    if (slugToFetch) {
      fetchSeriesBySlug(slugToFetch)
        .then((detail) => {
          setPostSeriesDetail(detail);
          setChapterList(detail.chapters || []);
        })
        .catch(console.error);
    }
  }, [seriesId, seriesList, searchParams]);

  // Load existing post if editing
  useEffect(() => {
    if (!postId || !token) return;
    setPageLoading(true);
    fetchPostById(postId, token)
      .then((data: PostDetail) => {
        const postAuthorId = data.author?.id;
        if (!isAdmin && postAuthorId && user?.id && postAuthorId !== user.id) {
          setIsUnauthorized(true);
          return;
        }
        setTitle(data.title);
        setSlug(data.slug);
        setSummary(data.summary || "");
        setContentHtml(data.content_html || "<p></p>");
        setCoverImage(data.cover_image || "");
        setCategoryId(data.category?.id || "");
        setTagsInput(data.tags.map((t) => t.name).join(", "));
        setIsPublished(data.is_published);
        setIsSpotlight(data.is_spotlight ?? false);
        setSavedSlug(data.slug);
        if (data.series_id) setSeriesId(data.series_id);
        if (data.chapter_id) setChapterId(data.chapter_id);
        if (data.order_in_chapter) setOrderInChapter(data.order_in_chapter);
        if (data.series_outline) setPostSeriesDetail(data.series_outline);

        // Lưu bản gốc để theo dõi thay đổi chưa lưu
        initialDataRef.current = {
          title: data.title || "",
          slug: data.slug || "",
          summary: data.summary || "",
          contentHtml: data.content_html || "<p></p>",
          coverImage: data.cover_image || "",
          categoryId: data.category?.id || "",
          seriesId: data.series_id || "",
          chapterId: data.chapter_id || "",
          tagsInput: data.tags ? data.tags.map((t) => t.name).join(", ") : "",
        };
      })
      .catch((err) => {
        if (err.message?.includes("403") || err.message?.includes("quyền") || err.status === 403) {
          setIsUnauthorized(true);
          return;
        }
        alert(`Không thể tải bài viết: ${err.message}`);
        const qSeries = searchParams?.get("series_id");
        const qSlug = searchParams?.get("series_slug");
        if (isAdmin && qSlug) {
          router.push(`/admin/series?slug=${qSlug}`);
        } else if (isAdmin && qSeries) {
          router.push(`/admin/series?id=${qSeries}`);
        } else if (isAdmin) {
          router.push("/admin/posts");
        } else {
          router.push("/posts/manage");
        }
      })
      .finally(() => setPageLoading(false));
  }, [postId, token, router, searchParams, isAdmin, user?.id]);

  // Handle series selection & auto-inherit category
  const handleSeriesChange = (newSeriesId: string) => {
    setSeriesId(newSeriesId);
    setSelectedLevelIds([]);
    setChapterId("");
    setPostSeriesDetail(null);
    if (newSeriesId) {
      const selected = seriesList.find((s) => s.id === newSeriesId);
      if (selected?.category_id) {
        setCategoryId(selected.category_id);
      }
    }
  };

  // Selected series hierarchy config & details
  const selectedSeries =
    (postSeriesDetail && (postSeriesDetail.id === seriesId || !seriesId) ? postSeriesDetail : null) ||
    seriesList.find((s) => s.id === seriesId) ||
    postSeriesDetail ||
    (searchParams?.get("series_id") ? seriesList.find((s) => s.id === searchParams.get("series_id")) : null) ||
    null;

  const targetSeriesSlug = selectedSeries?.slug || searchParams?.get("series_slug") || "";
  const targetSeriesTitle = selectedSeries?.title || postSeriesDetail?.title || "";
  const isCoursePost = !!seriesId || !!searchParams?.get("series_id");

  const backHref = isAdmin
    ? (targetSeriesSlug
        ? `/admin/series?slug=${targetSeriesSlug}`
        : seriesId
        ? `/admin/series?id=${seriesId}`
        : "/admin/posts")
    : (targetSeriesSlug
        ? `/series/${targetSeriesSlug}`
        : "/posts/manage");

  const backTitle = targetSeriesTitle
    ? (isAdmin ? `Quay lại quản lý khóa học "${targetSeriesTitle}"` : `Xem khóa học "${targetSeriesTitle}"`)
    : isCoursePost
    ? (isAdmin ? "Quay lại quản lý khóa học" : "Quay lại danh sách bài viết")
    : (isAdmin ? "Quay lại quản lý bài viết" : "Quay lại bài viết của tôi");

  const hierarchyLevels: string[] = React.useMemo(() => {
    const raw =
      postSeriesDetail?.hierarchy_config ||
      selectedSeries?.hierarchy_config ||
      seriesList.find((s) => s.id === seriesId)?.hierarchy_config;

    if (!raw) return ["Chương"];
    try {
      const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((item) => String(item).trim() || "Cấp");
      }
    } catch (e) {}
    return ["Chương"];
  }, [selectedSeries, postSeriesDetail, seriesList, seriesId]);

  // Sync selected level states when chapterId is known
  useEffect(() => {
    if (!chapterId || chapterList.length === 0) return;
    const targetChapter = chapterList.find((c) => c.id === chapterId);
    if (!targetChapter) return;

    if (!postId) {
      const existingLessons = (targetChapter.lessons || []).filter((l) => l.id !== postId);
      setOrderInChapter(existingLessons.length + 1);
    }

    // Lần ngược từ targetChapter lên root để lấy toàn bộ chuỗi id
    const path: Chapter[] = [targetChapter];
    let curr = targetChapter;
    while (curr.parent_id) {
      const parent = chapterList.find((c) => c.id === curr.parent_id);
      if (parent) {
        path.unshift(parent);
        curr = parent;
      } else {
        break;
      }
    }

    setSelectedLevelIds(path.map((c) => c.id));
  }, [chapterId, chapterList, postId]);

  // Auto generate slug from title when typing
  const handleTitleChange = (val: string) => {
    setTitle(val);
    if (isSlugSynced) {
      setSlug(slugify(val));
    }
  };

  const handleCoverUploadFile = async (file: File) => {
    if (!file || !token) return;
    if (!file.type.startsWith("image/")) {
      triggerToast("Vui lòng chọn file định dạng hình ảnh (PNG, JPG, WEBP, GIF, SVG)", "error");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      triggerToast("Dung lượng ảnh tối đa là 10MB", "error");
      return;
    }

    await withLoading(async () => {
      try {
        const res = await uploadMedia(file, token);
        setCoverImage(res.url);
        triggerToast("Đã tải ảnh bìa lên thành công!", "success");
      } catch (err: any) {
        triggerToast(`Lỗi upload ảnh cover: ${err.message}`, "error");
      }
    }, "Đang tải ảnh bìa lên...");
  };

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await handleCoverUploadFile(file);
    }
  };

  const handleAddCategory = async () => {
    if (!newCatName.trim() || !token) return;
    await withLoading(async () => {
      try {
        const newCat = await createCategory({ name: newCatName.trim() }, token);
        setCategories((prev) => [...prev, newCat]);
        setCategoryId(newCat.id);
        setNewCatName("");
        setShowNewCatModal(false);
        triggerToast(`Đã tạo chuyên mục "${newCat.name}" thành công!`, "success");
      } catch (err: any) {
        triggerToast(`Lỗi tạo danh mục: ${err.message}`, "error");
      }
    }, "Đang tạo chuyên mục mới...");
  };

  const handleOpenAddChapter = (levelIdx: number) => {
    setAddingLevelIdx(levelIdx);
    setNewChapterTitle("");
    setNewChapterDesc("");
    setAddChapterError("");

    const parentId = levelIdx === 0 ? undefined : selectedLevelIds[levelIdx - 1];
    const siblings = chapterList
      .filter((c) => (levelIdx === 0 ? (!c.parent_id || c.level === 1) : c.parent_id === parentId))
      .sort((a, b) => a.order - b.order);
    setModalSiblingChapters(siblings);
    setNewChapterOrder(siblings.length + 1);

    setShowAddChapterModal(true);
  };

  const handleCreateChapterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !seriesId || addingLevelIdx === null) return;
    if (!newChapterTitle.trim()) {
      setAddChapterError("Vui lòng nhập tên.");
      return;
    }

    const lvlIdx = addingLevelIdx;
    const parentId = lvlIdx === 0 ? undefined : selectedLevelIds[lvlIdx - 1];
    const computedLevel = lvlIdx + 1;

    setIsAddingChapter(true);
    setAddChapterError("");

    try {
      const created = await addChapter(
        seriesId,
        {
          title: newChapterTitle.trim(),
          description: newChapterDesc.trim() || undefined,
          parent_id: parentId,
          level: computedLevel,
          order: newChapterOrder,
        },
        token
      );

      setChapterList((prev) => [...prev, created]);

      const updated = [...selectedLevelIds];
      updated[lvlIdx] = created.id;
      for (let i = lvlIdx + 1; i < hierarchyLevels.length; i++) {
        updated[i] = "";
      }
      setSelectedLevelIds(updated);

      if (lvlIdx === hierarchyLevels.length - 1) {
        setChapterId(created.id);
      } else {
        setChapterId("");
      }

      setShowAddChapterModal(false);
    } catch (err: unknown) {
      setAddChapterError(err instanceof Error ? err.message : "Tạo thất bại");
    } finally {
      setIsAddingChapter(false);
    }
  };

  const handleSubmit = async (publishStatus: boolean) => {
    if (!title.trim()) {
      triggerToast("Vui lòng nhập tiêu đề bài viết!", "error");
      return;
    }
    if (!token) {
      triggerToast("Phiên đăng nhập hết hạn, vui lòng đăng nhập lại.", "error");
      router.push("/login");
      return;
    }

    if (seriesId) {
      const isAllSelected =
        hierarchyLevels.length > 0 &&
        hierarchyLevels.every((_, idx) => !!selectedLevelIds[idx]);
      if (!isAllSelected || !chapterId) {
        triggerToast(
          `Series yêu cầu phân cấp ${hierarchyLevels.length} tầng. Vui lòng chọn đầy đủ cấp phân mục (${hierarchyLevels.join(" > ")})!`,
          "error"
        );
        return;
      }
    }

    if (loading) return;
    setLoading(true);
    setActionType(publishStatus ? "publish" : "draft");
    const tagsArray = tagsInput
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    const payload = {
      title: title.trim(),
      slug: slug.trim() || undefined,
      summary: summary.trim() || undefined,
      content_html: contentHtml,
      cover_image: coverImage.trim() || undefined,
      category_id: categoryId || undefined,
      series_id: seriesId || undefined,
      chapter_id: chapterId || undefined,
      order_in_chapter: Number(orderInChapter) || 1,
      tags: tagsArray,
      is_published: publishStatus,
      is_spotlight: isAdmin ? isSpotlight : undefined,
    };

    await withLoading(async () => {
      try {
        let savedPost: PostDetail;
        if (postId) {
          savedPost = await updatePost(postId, payload, token);
        } else {
          savedPost = await createPost(payload, token);
        }

        setSavedSlug(savedPost.slug);
        setIsPublished(savedPost.is_published);
        setHasSavedSuccessfully(true);

        initialDataRef.current = {
          title: savedPost.title || "",
          slug: savedPost.slug || "",
          summary: savedPost.summary || "",
          contentHtml: savedPost.content_html || "<p></p>",
          coverImage: savedPost.cover_image || "",
          categoryId: savedPost.category?.id || "",
          seriesId: savedPost.series_id || "",
          chapterId: savedPost.chapter_id || "",
          tagsInput: savedPost.tags ? savedPost.tags.map((t) => t.name).join(", ") : "",
        };

        const successMessage = publishStatus
          ? (isPublished ? "🎉 Bài viết đã được cập nhật thành công!" : "🎉 Bài viết đã được xuất bản công khai thành công!")
          : (isPublished ? "Đã chuyển bài viết về bản nháp riêng tư." : "Đã lưu bản nháp thành công!");

        if (!postId) {
          sessionStorage.setItem(
            "editor_toast",
            JSON.stringify({ message: successMessage, type: "success" })
          );
          const queryParams = new URLSearchParams();
          if (seriesId) queryParams.set("series_id", seriesId);
          if (targetSeriesSlug) queryParams.set("series_slug", targetSeriesSlug);
          const qs = queryParams.toString() ? `?${queryParams.toString()}` : "";
          router.push(`/editor/${savedPost.id}${qs}`);
        } else {
          triggerToast(successMessage, "success");
        }
      } catch (err: any) {
        triggerToast(`Lỗi khi lưu bài viết: ${err.message}`, "error");
      } finally {
        setLoading(false);
        setActionType(null);
      }
    }, publishStatus ? "Đang xuất bản bài viết..." : "Đang lưu bài viết...");
  };

  if (isUnauthorized) {
    return (
      <NotFoundState
        title="Không tìm thấy bài viết"
        description="Bài viết không tồn tại hoặc bạn không có quyền truy cập chỉnh sửa nội dung này."
      />
    );
  }

  if (pageLoading) {
    return (
      <div className="py-20 text-center text-sm text-stone-500 animate-pulse">
        Đang tải bài viết...
      </div>
    );
  }

  return (
    <div className="w-full space-y-4 pb-20">
      <Breadcrumbs
        items={[
          ...(isAdmin
            ? [{ label: "Quản trị", href: "/admin/posts" }]
            : [{ label: "Bài viết của tôi", href: "/posts/manage" }]),
          ...(isCoursePost
            ? [
                {
                  label: targetSeriesTitle ? `Series: ${targetSeriesTitle}` : "Series",
                  href: backHref,
                },
              ]
            : []),
          { label: postId ? "Chỉnh sửa bài viết" : "Viết bài mới" },
        ]}
      />

      {/* Top action bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-stone-200 dark:border-stone-800 pb-4 sticky top-16 z-30 bg-stone-50/90 dark:bg-stone-950/90 backdrop-blur-md pt-2">
        <div className="flex items-center gap-3">
          <Link
            href={backHref}
            className={`p-2 rounded-xl text-stone-500 hover:text-stone-900 dark:hover:text-white hover:bg-stone-200/60 dark:hover:bg-stone-800 transition-colors ${
              loading ? "pointer-events-none opacity-40 cursor-not-allowed" : ""
            }`}
            title={backTitle}
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-lg font-bold text-stone-900 dark:text-white">
              {postId ? "Chỉnh Sửa Bài Viết" : "Tạo Bài Viết Mới"}
            </h1>
            <div className="flex items-center gap-2 text-xs text-stone-500">
              <span>Trạng thái:</span>
              {isPublished ? (
                <span className="text-emerald-600 font-semibold flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" /> Đã xuất bản
                </span>
              ) : (
                <span className="text-amber-600 font-medium">Bản nháp</span>
              )}
              {isCoursePost && (
                <Link
                  href={backHref}
                  className={`text-blue-600 dark:text-blue-400 hover:underline font-medium flex items-center gap-1 ${
                    loading ? "pointer-events-none opacity-50" : ""
                  }`}
                  title={backTitle}
                >
                  • <GraduationCap className="w-3 h-3" /> {targetSeriesTitle ? `Series: ${targetSeriesTitle}` : "Thuộc Series"}
                </Link>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Nút Xem Trước (Preview Modal) */}
          <button
            type="button"
            onClick={() => setShowPreviewModal(true)}
            className="inline-flex items-center gap-1.5 text-xs font-semibold px-3.5 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors shadow-xs"
            title="Xem trước bài viết thực tế"
          >
            <Eye className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            <span>Xem trước</span>
          </button>

          {/* Xem bài viết thực tế (nếu đã từng xuất bản) */}
          {savedSlug && isPublished && (
            <Link
              href={`/posts/${savedSlug}`}
              target="_blank"
              className={`inline-flex items-center gap-1 text-xs font-semibold px-3 py-2 rounded-xl border border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors ${
                loading ? "pointer-events-none opacity-40" : ""
              }`}
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Xem trực tiếp</span>
            </Link>
          )}

          {/* Nếu bài đang ĐÃ XUẤT BẢN => Cho phép chuyển về Bản Nháp (Unpublish) */}
          {isPublished ? (
            <button
              type="button"
              disabled={loading}
              onClick={() => {
                if (window.confirm("Bạn có chắc chắn muốn chuyển bài viết này từ Đã xuất bản về Bản nháp không? (Người đọc thông thường sẽ không còn thấy bài viết này nữa)")) {
                  handleSubmit(false);
                }
              }}
              className="inline-flex items-center gap-1.5 text-xs font-semibold px-3.5 py-2 rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50/70 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/60 transition-colors disabled:opacity-50"
              title="Chuyển bài viết về trạng thái bản nháp"
            >
              {loading && actionType === "draft" ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <EyeOff className="w-3.5 h-3.5 text-amber-600" />
              )}
              <span>{loading && actionType === "draft" ? "Đang lưu..." : "Chuyển về bản nháp"}</span>
            </button>
          ) : (
            /* Nếu bài đang là Bản Nháp => Nút Lưu nháp thông thường */
            <button
              type="button"
              disabled={loading}
              onClick={() => handleSubmit(false)}
              className="inline-flex items-center gap-1.5 text-xs font-semibold px-3.5 py-2 rounded-xl border border-stone-300 dark:border-stone-700 text-stone-700 dark:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading && actionType === "draft" ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-stone-500" />
              ) : (
                <Save className="w-3.5 h-3.5" />
              )}
              <span>{loading && actionType === "draft" ? "Đang lưu..." : "Lưu nháp"}</span>
            </button>
          )}

          {/* Nút Xuất bản ngay / Cập nhật xuất bản */}
          <button
            type="button"
            disabled={loading}
            onClick={() => handleSubmit(true)}
            className="inline-flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-sm shadow-blue-500/25 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {loading && actionType === "publish" ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
            ) : (
              <Send className="w-3.5 h-3.5" />
            )}
            <span>
              {loading && actionType === "publish"
                ? "Đang lưu..."
                : isPublished
                ? "Cập nhật xuất bản"
                : "Xuất bản ngay"}
            </span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Main Editor Section */}
        <div className="lg:col-span-8 space-y-6">
          {/* Title Input */}
          <div>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => handleTitleChange(e.target.value)}
              placeholder="Nhập tiêu đề bài viết tại đây..."
              className="w-full text-2xl sm:text-3xl font-extrabold px-4 py-3 rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 text-stone-900 dark:text-white placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
            />
          </div>

          {/* TipTap Rich Text Editor */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-stone-500">
              Nội dung bài viết (WYSIWYG Editor)
            </label>
            <TipTapEditor
              content={contentHtml}
              onChange={setContentHtml}
              token={token}
            />
          </div>
        </div>

        {/* Sidebar Settings Section */}
        <div className="lg:col-span-4 space-y-6">
          <div className="p-5 rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900/60 shadow-sm space-y-5">
            <div className="flex items-center gap-2 font-bold text-sm text-stone-900 dark:text-white pb-3 border-b border-stone-100 dark:border-stone-800">
              <Settings className="w-4 h-4 text-blue-600" />
              <span>Cài đặt bài viết</span>
            </div>

            {/* Thuộc Series */}
            <div className="p-3.5 rounded-xl border border-blue-200/80 dark:border-blue-900/50 bg-blue-50/40 dark:bg-blue-950/20 space-y-2.5">
              <div className="flex items-center gap-1.5 text-xs font-bold text-blue-700 dark:text-blue-400">
                <GraduationCap className="w-4 h-4" />
                <span>Series</span>
              </div>
              <p className="text-[11px] text-stone-500">
                Gắn bài này vào một chương cụ thể để người đọc theo dõi theo outline lộ trình.
              </p>

              <select
                value={seriesId}
                onChange={(e) => handleSeriesChange(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 font-medium"
              >
                <option value="">-- Bài viết độc lập (Không thuộc series nào) --</option>
                {seriesList.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title}
                  </option>
                ))}
              </select>

              {seriesId && (
                <div className="space-y-3 pt-1 border-t border-blue-100 dark:border-blue-900/40">
                  {/* Status Banner */}
                  {(() => {
                    const selectedCount = hierarchyLevels.filter((_, idx) => !!selectedLevelIds[idx]).length;
                    const isAllSelected = selectedCount === hierarchyLevels.length && hierarchyLevels.length > 0;

                    return (
                      <div className={`p-2.5 rounded-xl text-xs flex items-center justify-between border ${
                        isAllSelected
                          ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200"
                          : "bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-200"
                      }`}>
                        <span className="font-semibold">
                          {isAllSelected
                            ? `✓ Đã chọn đủ ${hierarchyLevels.length}/${hierarchyLevels.length} cấp phân mục`
                            : `⚠️ Đã chọn: ${selectedCount}/${hierarchyLevels.length} cấp (Bắt buộc chọn đủ cả ${hierarchyLevels.length} cấp)`}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded-md font-bold uppercase tracking-wider bg-white/70 dark:bg-black/40">
                          {hierarchyLevels.length} Tầng
                        </span>
                      </div>
                    );
                  })()}

                  {/* Dynamic Multi-level Cascading Selectors */}
                  <div className="space-y-2.5">
                    {hierarchyLevels.map((lvlName, idx) => {
                      const prevSelectedId = idx === 0 ? null : selectedLevelIds[idx - 1];
                      const isEnabled = idx === 0 || !!prevSelectedId;
                      const currentVal = selectedLevelIds[idx] || "";

                      let availableChapters: Chapter[] = [];
                      if (idx === 0) {
                        availableChapters = chapterList.filter((c) => !c.parent_id || c.level === 1);
                      } else if (prevSelectedId) {
                        availableChapters = chapterList.filter((c) => c.parent_id === prevSelectedId);
                      }

                      return (
                        <div
                          key={idx}
                          style={{ paddingLeft: `${idx * 8}px` }}
                          className={`space-y-1 ${idx > 0 ? "border-l-2 border-blue-300 dark:border-blue-700" : ""}`}
                        >
                          <div className="flex items-center justify-between">
                            <label className="text-[11px] font-semibold text-stone-700 dark:text-stone-300 flex items-center gap-1">
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-stone-200 dark:bg-stone-700 font-bold">
                                Cấp {idx + 1}
                              </span>
                              <span>{lvlName}:</span>
                              {idx === hierarchyLevels.length - 1 && (
                                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">
                                  (Cấp bài viết)
                                </span>
                              )}
                            </label>
                            {isEnabled && (
                              <button
                                type="button"
                                onClick={() => handleOpenAddChapter(idx)}
                                className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:underline transition-colors"
                              >
                                <Plus className="w-3 h-3" />
                                <span>Thêm {lvlName}</span>
                              </button>
                            )}
                          </div>

                          <select
                            disabled={!isEnabled}
                            value={currentVal}
                            onChange={(e) => {
                              const val = e.target.value;
                              const updated = [...selectedLevelIds];
                              updated[idx] = val;
                              for (let i = idx + 1; i < hierarchyLevels.length; i++) {
                                updated[i] = "";
                              }
                              setSelectedLevelIds(updated);

                              if (idx === hierarchyLevels.length - 1 && val) {
                                setChapterId(val);
                                if (!postId) {
                                  const targetCh = chapterList.find((c) => c.id === val);
                                  const existingCount = (targetCh?.lessons || []).filter((l) => l.id !== postId).length;
                                  setOrderInChapter(existingCount + 1);
                                }
                              } else {
                                setChapterId("");
                              }
                            }}
                            className={`w-full px-2.5 py-1.5 text-xs rounded-lg border font-medium transition-colors ${
                              !isEnabled
                                ? "bg-stone-100 dark:bg-stone-800/50 border-stone-200 dark:border-stone-800 text-stone-400 cursor-not-allowed"
                                : currentVal
                                ? "bg-white dark:bg-stone-900 border-blue-400 dark:border-blue-600 text-stone-900 dark:text-white"
                                : "bg-white dark:bg-stone-900 border-stone-300 dark:border-stone-700 text-stone-600 dark:text-stone-300"
                            }`}
                          >
                            <option value="">
                              {!isEnabled
                                ? `-- Vui lòng chọn ${hierarchyLevels[idx - 1]} trước --`
                                : `-- Chọn ${lvlName} --`}
                            </option>
                            {availableChapters.map((ch, chIdx) => (
                              <option key={ch.id} value={ch.id}>
                                {lvlName} {chIdx + 1}: {ch.title}
                              </option>
                            ))}
                          </select>

                          {isEnabled && availableChapters.length === 0 && (
                            <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 flex items-center justify-between gap-2">
                              <p className="text-[10px] text-amber-700 dark:text-amber-400 italic">
                                Chưa có {lvlName} nào thuộc mục trên.
                              </p>
                              <button
                                type="button"
                                onClick={() => handleOpenAddChapter(idx)}
                                className="px-2 py-1 text-[10px] font-semibold bg-amber-600 hover:bg-amber-700 text-white rounded-md shrink-0 flex items-center gap-1 transition-colors shadow-xs"
                              >
                                <Plus className="w-3 h-3" />
                                <span>Tạo {lvlName} ngay</span>
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Ordering & Relative Placement in Chapter */}
                  {chapterId && (() => {
                    const currentChapter = chapterList.find((c) => c.id === chapterId);
                    const existingLessons = (currentChapter?.lessons || []).filter((l) => l.id !== postId);
                    const currentPos = Math.max(0, Math.min(orderInChapter - 1, existingLessons.length));

                    return (
                      <div className="space-y-2 pt-2 border-t border-blue-100 dark:border-blue-900/40">
                        <div className="flex items-center justify-between">
                          <label className="text-[11px] font-semibold text-stone-700 dark:text-stone-300 flex items-center gap-1">
                            <ListOrdered className="w-3.5 h-3.5 text-blue-600" />
                            <span>Vị trí trong chương:</span>
                          </label>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 font-bold">
                            Vị trí số: {orderInChapter}
                          </span>
                        </div>

                        {/* Relative Placement Dropdown */}
                        <div className="space-y-1">
                          <select
                            value={
                              currentPos === existingLessons.length
                                ? "end"
                                : currentPos === 0
                                ? "start"
                                : `before:${currentPos}`
                            }
                            onChange={(e) => {
                              const val = e.target.value;
                              if (val === "end") {
                                setOrderInChapter(existingLessons.length + 1);
                              } else if (val === "start") {
                                setOrderInChapter(1);
                              } else if (val.startsWith("before:")) {
                                const idx = parseInt(val.split(":")[1]);
                                setOrderInChapter(idx + 1);
                              } else if (val.startsWith("after:")) {
                                const idx = parseInt(val.split(":")[1]);
                                setOrderInChapter(idx + 2);
                              }
                            }}
                            className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 font-medium"
                          >
                            <option value="end">
                              📌 Cuối chương (Mặc định - Vị trí {existingLessons.length + 1})
                            </option>
                            <option value="start">📌 Đầu chương (Vị trí 1)</option>
                            {existingLessons.map((l, idx) => (
                              <React.Fragment key={l.id}>
                                <option value={`before:${idx}`}>
                                  ⬆️ Trước bài: &ldquo;{l.title.slice(0, 30)}{l.title.length > 30 ? "..." : ""}&rdquo;
                                </option>
                                <option value={`after:${idx}`}>
                                  ⬇️ Sau bài: &ldquo;{l.title.slice(0, 30)}{l.title.length > 30 ? "..." : ""}&rdquo;
                                </option>
                              </React.Fragment>
                            ))}
                          </select>
                        </div>

                        {/* Interactive Outline Preview */}
                        <div className="mt-2 space-y-1.5">
                          <div className="flex items-center justify-between text-[10px] text-stone-500 font-semibold uppercase tracking-wider">
                            <span>Sơ đồ thứ tự bài học</span>
                            <span>{existingLessons.length + 1} bài</span>
                          </div>

                          <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
                            {/* Items before current */}
                            {existingLessons.slice(0, currentPos).map((lesson, idx) => (
                              <div
                                key={lesson.id}
                                className="flex items-center justify-between px-2 py-1 rounded bg-stone-100 dark:bg-stone-800/60 text-[11px] text-stone-600 dark:text-stone-400"
                              >
                                <span className="truncate max-w-[170px]">
                                  {idx + 1}. {lesson.title}
                                </span>
                              </div>
                            ))}

                            {/* Current post item */}
                            <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg border-2 border-blue-500 bg-blue-50 dark:bg-blue-950/70 text-[11px] font-bold text-blue-700 dark:text-blue-300 shadow-sm animate-pulse-once">
                              <span className="truncate max-w-[130px]">
                                ★ {currentPos + 1}. {title.trim() || "Bài viết này"}
                              </span>
                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  type="button"
                                  disabled={currentPos === 0}
                                  onClick={() => setOrderInChapter(Math.max(1, currentPos))}
                                  title="Dời lên trên một vị trí"
                                  className="p-1 rounded hover:bg-blue-200 dark:hover:bg-blue-900 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                                >
                                  <ArrowUp className="w-3 h-3" />
                                </button>
                                <button
                                  type="button"
                                  disabled={currentPos >= existingLessons.length}
                                  onClick={() => setOrderInChapter(currentPos + 2)}
                                  title="Dời xuống dưới một vị trí"
                                  className="p-1 rounded hover:bg-blue-200 dark:hover:bg-blue-900 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                                >
                                  <ArrowDown className="w-3 h-3" />
                                </button>
                              </div>
                            </div>

                            {/* Items after current */}
                            {existingLessons.slice(currentPos).map((lesson, idx) => (
                              <div
                                key={lesson.id}
                                className="flex items-center justify-between px-2 py-1 rounded bg-stone-100 dark:bg-stone-800/60 text-[11px] text-stone-600 dark:text-stone-400"
                              >
                                <span className="truncate max-w-[170px]">
                                  {currentPos + 2 + idx}. {lesson.title}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>

            {/* Spotlight Headline (Admin Only) */}
            {isAdmin && postId && (
              <div className={`p-3.5 rounded-xl border space-y-1.5 transition-colors ${
                isSpotlight
                  ? "border-amber-400/70 dark:border-amber-600/60 bg-amber-50/60 dark:bg-amber-950/30"
                  : "border-stone-200 dark:border-stone-800 bg-stone-50/50 dark:bg-stone-900/30"
              }`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-amber-700 dark:text-amber-400">
                    <Flame className="w-4 h-4" />
                    <span>Spotlight Headline</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsSpotlight(!isSpotlight)}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${
                      isSpotlight ? "bg-amber-500" : "bg-stone-300 dark:bg-stone-600"
                    }`}
                  >
                    <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
                      isSpotlight ? "translate-x-4" : "translate-x-0.5"
                    }`} />
                  </button>
                </div>
                <p className="text-[11px] text-stone-500">
                  {isSpotlight
                    ? "✅ Bài viết này đang được hiển thị nổi bật trên trang chủ."
                    : "Bật để hiển thị bài viết này làm Spotlight trên trang chủ (chỉ 1 bài tại một thời điểm)."}
                </p>
              </div>
            )}

            {/* Slug URL */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-stone-700 dark:text-stone-300">
                  Đường dẫn tĩnh (Slug URL)
                </label>
                <button
                  type="button"
                  onClick={() => {
                    const next = !isSlugSynced;
                    setIsSlugSynced(next);
                    if (next && title) {
                      setSlug(slugify(title));
                    }
                  }}
                  className={`text-[11px] flex items-center gap-1 font-medium px-2 py-0.5 rounded-md border transition-colors ${
                    isSlugSynced
                      ? "text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-900/60 bg-blue-50/50 dark:bg-blue-950/30"
                      : "text-stone-500 dark:text-stone-400 border-stone-200 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800"
                  }`}
                  title={
                    isSlugSynced
                      ? "Đang tự động đổi slug khi sửa tiêu đề (Nhấn để gỡ liên kết và sửa tự do)"
                      : "Đang tùy chỉnh tự do (Nhấn để tự động tạo lại theo tiêu đề bài viết)"
                  }
                >
                  {isSlugSynced ? <LinkIcon className="w-3 h-3" /> : <Unlink className="w-3 h-3" />}
                  <span>{isSlugSynced ? "Tự động đổi theo tiêu đề" : "Tùy chỉnh tự do"}</span>
                </button>
              </div>
              <input
                type="text"
                value={slug}
                onChange={(e) => {
                  setSlug(e.target.value);
                  setIsSlugSynced(false);
                }}
                placeholder="duong-dan-bai-viet"
                className="w-full px-3 py-2 text-xs font-mono rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800/80 text-stone-800 dark:text-stone-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Category */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-stone-700 dark:text-stone-300">
                  Danh mục
                </label>
                <button
                  type="button"
                  onClick={() => setShowNewCatModal(true)}
                  className="text-[11px] text-blue-600 hover:underline flex items-center gap-0.5"
                >
                  <FolderPlus className="w-3 h-3" />
                  <span>Tạo mới</span>
                </button>
              </div>

              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800/80 text-stone-800 dark:text-stone-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">-- Chọn danh mục --</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>

              {/* Course Category Auto-Inheritance indicator */}
              {selectedSeries?.category && categoryId === selectedSeries.category_id && (
                <p className="text-[11px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1 pt-0.5 font-medium">
                  <CheckCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>Tự động chọn theo khóa học: <strong>{selectedSeries.category.name}</strong></span>
                </p>
              )}

              {showNewCatModal && (
                <div className="p-3 rounded-xl border border-blue-200 dark:border-blue-900 bg-blue-50/50 dark:bg-blue-950/30 space-y-2 mt-2">
                  <input
                    type="text"
                    value={newCatName}
                    onChange={(e) => setNewCatName(e.target.value)}
                    placeholder="Tên danh mục mới..."
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900"
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowNewCatModal(false)}
                      className="text-[11px] px-2 py-1 text-stone-500 hover:text-stone-700"
                    >
                      Hủy
                    </button>
                    <button
                      type="button"
                      onClick={handleAddCategory}
                      className="text-[11px] px-3 py-1 bg-blue-600 text-white rounded-lg font-semibold"
                    >
                      Thêm
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Tags */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-stone-700 dark:text-stone-300">
                Thẻ (phân cách bằng dấu phẩy)
              </label>
              <input
                type="text"
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                placeholder="NextJS, FastAPI, AI, Kiến trúc"
                className="w-full px-3 py-2 text-xs rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800/80 text-stone-800 dark:text-stone-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Cover Image */}
            <div className="space-y-2.5 p-3.5 rounded-2xl border border-stone-200 dark:border-stone-800 bg-stone-50/50 dark:bg-stone-900/40">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-stone-700 dark:text-stone-300 flex items-center gap-1.5">
                  <ImageIcon className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                  <span>Ảnh bìa (Cover Image)</span>
                </label>
                {coverImage.trim() ? (
                  <button
                    type="button"
                    onClick={() => setCoverImage("")}
                    className="text-[11px] text-rose-500 hover:text-rose-600 font-medium hover:underline flex items-center gap-1"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Dùng ảnh mặc định</span>
                  </button>
                ) : (
                  <span className="text-[11px] text-stone-400 font-medium flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-amber-500" />
                    <span>Ảnh mặc định</span>
                  </span>
                )}
              </div>

              {/* Cover Preview Box */}
              <div className="relative rounded-xl overflow-hidden border border-stone-200 dark:border-stone-700 aspect-video bg-stone-100 dark:bg-stone-800 shadow-inner group">
                <img
                  src={getFullImageUrl(coverImage)}
                  alt="Cover preview"
                  className="w-full h-full object-cover"
                />

                {/* Badge Overlay */}
                <div className="absolute top-2 left-2 flex items-center gap-1 rounded-full text-[10px] font-semibold shadow-xs">
                  {coverImage.trim() ? (
                    <span className="bg-emerald-500 text-white px-2 py-0.5 rounded-full flex items-center gap-1">
                      <Check className="w-2.5 h-2.5" /> Ảnh tùy chỉnh
                    </span>
                  ) : (
                    <span className="bg-stone-900/80 text-amber-300 px-2 py-0.5 rounded-full">
                      Ảnh mặc định hệ thống
                    </span>
                  )}
                </div>

                {!coverImage.trim() && (
                  <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/75 to-transparent p-2 text-[10px] text-stone-200">
                    Chưa chọn ảnh riêng • Đang dùng ảnh mặc định (/default-post.jpg)
                  </div>
                )}
              </div>

              {/* Switch Tabs: Upload vs URL */}
              <div className="grid grid-cols-2 p-0.5 bg-stone-200/70 dark:bg-stone-800 rounded-lg text-[11px] font-medium">
                <button
                  type="button"
                  onClick={() => setCoverTab("upload")}
                  className={`py-1 rounded-md flex items-center justify-center gap-1 transition-all ${
                    coverTab === "upload"
                      ? "bg-white dark:bg-stone-900 text-blue-600 dark:text-blue-400 shadow-xs font-semibold"
                      : "text-stone-600 dark:text-stone-400 hover:text-stone-900"
                  }`}
                >
                  <Upload className="w-3 h-3" />
                  <span>Tải ảnh lên</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCoverTab("url")}
                  className={`py-1 rounded-md flex items-center justify-center gap-1 transition-all ${
                    coverTab === "url"
                      ? "bg-white dark:bg-stone-900 text-blue-600 dark:text-blue-400 shadow-xs font-semibold"
                      : "text-stone-600 dark:text-stone-400 hover:text-stone-900"
                  }`}
                >
                  <LinkIcon className="w-3 h-3" />
                  <span>Dán URL ảnh</span>
                </button>
              </div>

              <input
                type="file"
                ref={coverInputRef}
                onChange={handleCoverUpload}
                accept="image/*"
                className="hidden"
              />

              {coverTab === "upload" ? (
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsCoverDragOver(true);
                  }}
                  onDragLeave={() => setIsCoverDragOver(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsCoverDragOver(false);
                    const file = e.dataTransfer.files?.[0];
                    if (file) handleCoverUploadFile(file);
                  }}
                  onClick={() => coverInputRef.current?.click()}
                  className={`border border-dashed rounded-xl p-3 text-center cursor-pointer transition-all ${
                    isCoverDragOver
                      ? "border-blue-500 bg-blue-50/50 dark:bg-blue-950/20"
                      : "border-stone-300 dark:border-stone-700 hover:border-blue-400 bg-white dark:bg-stone-900/60"
                  }`}
                >
                  <div className="flex items-center justify-center gap-2 text-stone-500">
                    <Upload className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                    <span className="text-[11px] font-medium">Bấm chọn ảnh hoặc kéo thả vào đây</span>
                  </div>
                  <p className="text-[10px] text-stone-400 mt-0.5">Hỗ trợ JPG, PNG, WEBP (tối đa 10MB)</p>
                </div>
              ) : (
                <div className="space-y-1">
                  <div className="relative">
                    <input
                      type="text"
                      value={coverImage}
                      onChange={(e) => setCoverImage(e.target.value)}
                      placeholder="https://images.unsplash.com/... hoặc link ảnh"
                      className="w-full pl-2.5 pr-7 py-1.5 text-xs rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    {coverImage && (
                      <button
                        type="button"
                        onClick={() => setCoverImage("")}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Summary */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-stone-700 dark:text-stone-300">
                Tóm tắt ngắn (SEO & Card)
              </label>
              <textarea
                rows={3}
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                placeholder="Đoạn văn ngắn tóm tắt nội dung bài viết..."
                className="w-full px-3 py-2 text-xs rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800/80 text-stone-800 dark:text-stone-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Inline Add Chapter/Module Modal */}
      {showAddChapterModal && addingLevelIdx !== null && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => !isAddingChapter && setShowAddChapterModal(false)}
        >
          <div
            className="bg-white dark:bg-stone-900 rounded-3xl border border-stone-200 dark:border-stone-800 p-6 sm:p-7 w-full max-w-md shadow-2xl space-y-5 animate-in fade-in zoom-in duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-stone-100 dark:border-stone-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
                  <Plus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-stone-900 dark:text-white">
                    Thêm {hierarchyLevels[addingLevelIdx] || "mục"} mới
                  </h3>
                  <p className="text-[11px] text-stone-500">
                    Cấp {addingLevelIdx + 1}: {hierarchyLevels[addingLevelIdx] || "Mục"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={isAddingChapter}
                onClick={() => setShowAddChapterModal(false)}
                className="p-1.5 rounded-xl text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {addingLevelIdx > 0 && selectedLevelIds[addingLevelIdx - 1] && (
              <div className="px-3 py-2 rounded-xl bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200/60 dark:border-blue-800/60 text-xs text-blue-800 dark:text-blue-300">
                <span className="font-semibold text-[11px] uppercase tracking-wider block text-blue-600 dark:text-blue-400 mb-0.5">
                  Mục cha ({hierarchyLevels[addingLevelIdx - 1]}):
                </span>
                <span className="font-medium">
                  {chapterList.find((c) => c.id === selectedLevelIds[addingLevelIdx - 1])?.title || "Đã chọn"}
                </span>
              </div>
            )}

            {addChapterError && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-600 font-medium">
                {addChapterError}
              </div>
            )}

            <form onSubmit={handleCreateChapterSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-stone-700 dark:text-stone-300">
                  Tên {hierarchyLevels[addingLevelIdx] || "mục"} <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={newChapterTitle}
                  onChange={(e) => setNewChapterTitle(e.target.value)}
                  placeholder={`Ví dụ: ${
                    addingLevelIdx === 0
                      ? "Phần 1: Khởi động"
                      : hierarchyLevels[addingLevelIdx] === "Chương"
                      ? "Chương 1: Cài đặt môi trường"
                      : "Mục 1: Giới thiệu"
                  }`}
                  className="w-full text-xs px-3 py-2.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800/80 text-stone-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Thứ tự & Vị trí hiển thị */}
              {(() => {
                const currentLvlName = hierarchyLevels[addingLevelIdx] || "mục";
                const parentName = addingLevelIdx > 0
                  ? chapterList.find((c) => c.id === selectedLevelIds[addingLevelIdx - 1])?.title
                  : null;
                const pos = Math.max(0, Math.min(newChapterOrder - 1, modalSiblingChapters.length));

                return (
                  <div className="space-y-2 p-3 rounded-xl bg-stone-50 dark:bg-stone-800/50 border border-stone-200 dark:border-stone-700/60">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-semibold text-stone-700 dark:text-stone-300">
                        Vị trí đặt {currentLvlName} {parentName ? `trong "${parentName}"` : "trong khóa học"}
                      </label>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 font-bold">
                        Vị trí số: {newChapterOrder}
                      </span>
                    </div>

                    <select
                      value={
                        pos === modalSiblingChapters.length
                          ? "end"
                          : pos === 0
                          ? "start"
                          : `before:${pos}`
                      }
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === "end") {
                          setNewChapterOrder(modalSiblingChapters.length + 1);
                        } else if (val === "start") {
                          setNewChapterOrder(1);
                        } else if (val.startsWith("before:")) {
                          const idx = parseInt(val.split(":")[1]);
                          setNewChapterOrder(idx + 1);
                        } else if (val.startsWith("after:")) {
                          const idx = parseInt(val.split(":")[1]);
                          setNewChapterOrder(idx + 2);
                        }
                      }}
                      className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 font-medium text-stone-900 dark:text-stone-100"
                    >
                      <option value="end">
                        📌 Ở cuối cùng (Mặc định - Vị trí {modalSiblingChapters.length + 1})
                      </option>
                      <option value="start">📌 Ở đầu tiên (Vị trí 1)</option>
                      {modalSiblingChapters.map((s, idx) => (
                        <React.Fragment key={s.id}>
                          <option value={`before:${idx}`}>
                            ⬆️ Trước: &ldquo;{s.title.slice(0, 30)}{s.title.length > 30 ? "..." : ""}&rdquo; (Vị trí {idx + 1})
                          </option>
                          <option value={`after:${idx}`}>
                            ⬇️ Sau: &ldquo;{s.title.slice(0, 30)}{s.title.length > 30 ? "..." : ""}&rdquo; (Vị trí {idx + 2})
                          </option>
                        </React.Fragment>
                      ))}
                    </select>

                    <div className="space-y-1 pt-1">
                      <div className="flex items-center justify-between text-[10px] text-stone-500 font-medium uppercase tracking-wider">
                        <span>Sơ đồ sắp xếp</span>
                        <span>{modalSiblingChapters.length + 1} {currentLvlName}</span>
                      </div>

                      <div className="space-y-1 max-h-32 overflow-y-auto pr-1">
                        {modalSiblingChapters.slice(0, pos).map((item, idx) => (
                          <div
                            key={item.id}
                            className="flex items-center justify-between px-2 py-1 rounded bg-stone-100 dark:bg-stone-800/60 text-[11px] text-stone-600 dark:text-stone-400"
                          >
                            <span className="truncate max-w-[240px]">
                              {idx + 1}. {item.title}
                            </span>
                          </div>
                        ))}

                        <div className="flex items-center justify-between px-2 py-1 rounded border border-blue-500 bg-blue-50 dark:bg-blue-950/70 text-[11px] font-bold text-blue-700 dark:text-blue-300">
                          <span className="truncate max-w-[190px]">
                            ★ {pos + 1}. {newChapterTitle.trim() || `[${currentLvlName} mới này]`}
                          </span>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              disabled={pos === 0}
                              onClick={() => setNewChapterOrder(Math.max(1, pos))}
                              title="Đẩy lên trước một vị trí"
                              className="p-0.5 rounded hover:bg-blue-200 dark:hover:bg-blue-900 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                            >
                              <ArrowUp className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              disabled={pos >= modalSiblingChapters.length}
                              onClick={() => setNewChapterOrder(pos + 2)}
                              title="Đẩy xuống sau một vị trí"
                              className="p-0.5 rounded hover:bg-blue-200 dark:hover:bg-blue-900 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                            >
                              <ArrowDown className="w-3 h-3" />
                            </button>
                          </div>
                        </div>

                        {modalSiblingChapters.slice(pos).map((item, idx) => (
                          <div
                            key={item.id}
                            className="flex items-center justify-between px-2 py-1 rounded bg-stone-100 dark:bg-stone-800/60 text-[11px] text-stone-600 dark:text-stone-400"
                          >
                            <span className="truncate max-w-[240px]">
                              {pos + idx + 2}. {item.title}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })()}

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-stone-700 dark:text-stone-300">
                  Mô tả ngắn (tùy chọn)
                </label>
                <textarea
                  rows={2}
                  value={newChapterDesc}
                  onChange={(e) => setNewChapterDesc(e.target.value)}
                  placeholder="Mô tả mục tiêu của phần này..."
                  className="w-full text-xs px-3 py-2 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800/80 text-stone-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  disabled={isAddingChapter}
                  onClick={() => setShowAddChapterModal(false)}
                  className="px-4 py-2 rounded-xl border border-stone-200 dark:border-stone-700 text-xs font-medium text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isAddingChapter || !newChapterTitle.trim()}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold shadow-md shadow-blue-500/20 transition-all"
                >
                  {isAddingChapter ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Đang tạo...</span>
                    </>
                  ) : (
                    <span>Tạo {hierarchyLevels[addingLevelIdx] || "mục"}</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL XEM TRƯỚC BÀI VIẾT (PREVIEW MODAL)                 */}
      {/* ========================================================= */}
      {showPreviewModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex flex-col overflow-hidden animate-in fade-in duration-200">
          {/* Top Bar điều khiển Xem trước */}
          <div className="bg-stone-900 border-b border-stone-800 px-4 py-3 flex items-center justify-between text-white shrink-0">
            <div className="flex items-center gap-3">
              <div className="p-1.5 rounded-lg bg-blue-500/20 text-blue-400">
                <Eye className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-stone-300 flex items-center gap-2">
                  <span>Chế độ xem trước (Preview)</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                    isPublished ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                  }`}>
                    {isPublished ? "Đang xuất bản" : "Bản nháp"}
                  </span>
                </div>
                <div className="text-[11px] text-stone-400 truncate max-w-xs sm:max-w-md">
                  {title || "Chưa đặt tiêu đề"}
                </div>
              </div>
            </div>

            {/* Switch chế độ Desktop / Mobile */}
            <div className="flex items-center gap-2">
              <div className="hidden sm:flex items-center bg-stone-800 p-1 rounded-xl border border-stone-700">
                <button
                  type="button"
                  onClick={() => setPreviewDeviceMode("desktop")}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                    previewDeviceMode === "desktop"
                      ? "bg-blue-600 text-white shadow-xs"
                      : "text-stone-400 hover:text-white"
                  }`}
                  title="Xem trên màn hình máy tính (Desktop)"
                >
                  <Monitor className="w-3.5 h-3.5" />
                  <span>Desktop</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewDeviceMode("mobile")}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                    previewDeviceMode === "mobile"
                      ? "bg-blue-600 text-white shadow-xs"
                      : "text-stone-400 hover:text-white"
                  }`}
                  title="Xem trên màn hình điện thoại (Mobile)"
                >
                  <Smartphone className="w-3.5 h-3.5" />
                  <span>Mobile</span>
                </button>
              </div>

              {/* Nút đóng */}
              <button
                type="button"
                onClick={() => setShowPreviewModal(false)}
                className="p-1.5 rounded-xl text-stone-400 hover:text-white hover:bg-stone-800 transition-colors"
                title="Đóng xem trước"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Vùng cuộn xem trước nội dung */}
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-3 sm:p-6 flex justify-center bg-stone-950/50">
            <div
              className={`bg-white dark:bg-stone-900 rounded-3xl border border-stone-200 dark:border-stone-800 shadow-2xl transition-all duration-200 overflow-hidden flex flex-col h-fit my-2 sm:my-6 ${
                previewDeviceMode === "mobile"
                  ? "w-full max-w-[420px]"
                  : "w-full max-w-4xl"
              }`}
            >
              {/* Header giả lập trình duyệt trên mobile */}
              {previewDeviceMode === "mobile" && (
                <div className="bg-stone-100 dark:bg-stone-800/80 px-4 py-2 border-b border-stone-200 dark:border-stone-700/60 flex items-center justify-between text-[11px] text-stone-500">
                  <div className="flex items-center gap-1.5 font-medium">
                    <span className="w-2 h-2 rounded-full bg-stone-300 dark:bg-stone-600" />
                    <span>hungph-blog.com</span>
                  </div>
                  <span>9:41 AM</span>
                </div>
              )}

              {/* Bài viết hiển thị như trang thật */}
              <div className="p-4 sm:p-8 md:p-10 space-y-6 sm:space-y-8 flex-1">
                {/* Giả lập breadcrumbs & categories */}
                <div className="flex items-center gap-2 flex-wrap text-xs text-stone-500">
                  <span>Trang chủ</span>
                  <span>/</span>
                  {selectedSeries?.title ? (
                    <>
                      <span className="text-blue-600 dark:text-blue-400 font-medium">
                        {selectedSeries.title}
                      </span>
                      <span>/</span>
                    </>
                  ) : categoryId ? (
                    <>
                      <span className="text-blue-600 dark:text-blue-400 font-medium">
                        {categories.find((c) => c.id === categoryId)?.name || "Chuyên mục"}
                      </span>
                      <span>/</span>
                    </>
                  ) : null}
                  <span className="text-stone-400 truncate max-w-[200px]">
                    {title || "Bài viết mới"}
                  </span>
                </div>

                {/* Tiêu đề bài viết */}
                <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-stone-900 dark:text-stone-100 tracking-tight leading-tight">
                  {title || (
                    <span className="text-stone-400 italic font-normal">
                      (Chưa nhập tiêu đề bài viết)
                    </span>
                  )}
                </h1>

                {/* Tóm tắt bài viết */}
                {summary && (
                  <p className="text-base sm:text-lg text-stone-600 dark:text-stone-300 leading-relaxed italic border-l-2 border-blue-500 pl-4 py-0.5">
                    {summary}
                  </p>
                )}

                {/* Tác giả & Ngày đăng */}
                <div className="flex items-center justify-between pt-2 border-t border-b border-stone-100 dark:border-stone-800/80 py-3">
                  <div className="flex items-center gap-3">
                    {user?.avatar_url ? (
                      <img
                        src={getFullImageUrl(user.avatar_url)}
                        alt={user.full_name || user.username || "Tác giả"}
                        className="w-10 h-10 rounded-full object-cover shadow"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white font-bold text-sm shadow">
                        {user?.full_name?.charAt(0) || user?.username?.charAt(0) || "U"}
                      </div>
                    )}
                    <div>
                      <div className="text-sm font-semibold text-stone-900 dark:text-stone-100">
                        {user?.full_name || user?.username || "Tác giả"}
                      </div>
                      <div className="text-xs text-stone-500">
                        Hôm nay • {isPublished ? "Đã công khai" : "Bản nháp xem trước"}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[11px] px-2.5 py-1 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 font-medium border border-blue-200/60 dark:border-blue-900/40">
                      Bản xem trước
                    </span>
                  </div>
                </div>

                {/* Ảnh bìa */}
                {coverImage && (
                  <div className="rounded-2xl sm:rounded-3xl overflow-hidden shadow-md border border-stone-200 dark:border-stone-800 max-h-[460px]">
                    <img
                      src={getFullImageUrl(coverImage)}
                      alt={title || "Ảnh bìa"}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}

                {/* Nội dung bài viết */}
                <div className="pt-2">
                  {contentHtml && contentHtml !== "<p></p>" ? (
                    <div
                      className="blog-content leading-relaxed"
                      dangerouslySetInnerHTML={{ __html: contentHtml }}
                    />
                  ) : (
                    <div className="py-12 text-center text-stone-400 dark:text-stone-500 italic border border-dashed border-stone-200 dark:border-stone-800 rounded-2xl">
                      (Nội dung bài viết đang trống. Hãy soạn thảo thêm nội dung trong trình soạn thảo.)
                    </div>
                  )}
                </div>

                {/* Tags */}
                {tagsInput && (
                  <div className="pt-6 border-t border-stone-100 dark:border-stone-800/80 flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-semibold text-stone-500">Thẻ:</span>
                    {tagsInput
                      .split(",")
                      .map((t) => t.trim())
                      .filter(Boolean)
                      .map((tag) => (
                        <span
                          key={tag}
                          className="px-2.5 py-1 rounded-lg bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 text-xs font-medium"
                        >
                          #{tag}
                        </span>
                      ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Footer Bar của Preview Modal */}
          <div className="bg-stone-900 border-t border-stone-800 px-4 py-3 flex items-center justify-between text-white shrink-0">
            <button
              type="button"
              onClick={() => setShowPreviewModal(false)}
              className="px-4 py-2 rounded-xl border border-stone-700 text-xs font-semibold text-stone-300 hover:text-white hover:bg-stone-800 transition-colors"
            >
              Tiếp tục soạn thảo
            </button>

            <div className="flex items-center gap-2">
              {isPublished ? (
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => {
                    setShowPreviewModal(false);
                    if (window.confirm("Bạn có chắc muốn chuyển bài viết về Bản nháp?")) {
                      handleSubmit(false);
                    }
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-amber-600 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 text-xs font-semibold transition-colors disabled:opacity-50"
                >
                  <EyeOff className="w-3.5 h-3.5" />
                  <span>Chuyển về bản nháp</span>
                </button>
              ) : (
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => {
                    setShowPreviewModal(false);
                    handleSubmit(false);
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-stone-700 bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-semibold transition-colors disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Lưu nháp</span>
                </button>
              )}

              <button
                type="button"
                disabled={loading}
                onClick={() => {
                  setShowPreviewModal(false);
                  handleSubmit(true);
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-md shadow-blue-500/20 transition-all disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{isPublished ? "Cập nhật bài viết" : "Xuất bản ngay"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TOAST NOTIFICATION NHẸ NHÀNG (KHÔNG DÙNG ALERT)           */}
      {/* ========================================================= */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed top-20 right-4 sm:right-8 z-50 flex items-center gap-3 px-4 py-3 rounded-2xl shadow-xl border backdrop-blur-md transition-all duration-300 animate-in fade-in slide-in-from-top-3 max-w-md bg-stone-900/95 dark:bg-stone-900/95 text-white border-stone-800"
        >
          {toast.type === "success" && (
            <div className="p-1 rounded-lg bg-emerald-500/20 text-emerald-400 shrink-0">
              <CheckCircle className="w-5 h-5" />
            </div>
          )}
          {toast.type === "error" && (
            <div className="p-1 rounded-lg bg-rose-500/20 text-rose-400 shrink-0">
              <AlertCircle className="w-5 h-5" />
            </div>
          )}
          {toast.type === "info" && (
            <div className="p-1 rounded-lg bg-blue-500/20 text-blue-400 shrink-0">
              <CheckCircle className="w-5 h-5" />
            </div>
          )}
          <div className="text-xs sm:text-sm font-medium leading-relaxed flex-1">
            {toast.message}
          </div>
          <button
            type="button"
            onClick={() => setToast(null)}
            className="p-1 text-stone-400 hover:text-white rounded-lg hover:bg-stone-800 transition-colors shrink-0"
            title="Đóng thông báo"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* DIALOG CẢNH BÁO THOÁT KHI CHƯA LƯU */}
      {showExitConfirmModal && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-stone-900 rounded-3xl border border-stone-200 dark:border-stone-800 p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-stone-900 dark:text-white">
                  Rời khỏi trình soạn thảo?
                </h3>
                <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                  Thay đổi chưa được lưu hoặc xuất bản
                </p>
              </div>
            </div>

            <p className="text-sm text-stone-600 dark:text-stone-300 leading-relaxed bg-stone-50 dark:bg-stone-800/50 p-3.5 rounded-xl border border-stone-100 dark:border-stone-800">
              Bạn có chắc chắn muốn thoát không? Nội dung đang biên soạn sẽ không được lưu lại.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowExitConfirmModal(false);
                  setPendingNavigationUrl(null);
                }}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors border border-stone-200 dark:border-stone-700 cursor-pointer"
              >
                Ở lại tiếp tục viết
              </button>
              <button
                type="button"
                onClick={handleConfirmExit}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 transition-colors shadow-sm shadow-rose-500/20 cursor-pointer"
              >
                Rời khỏi không lưu
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

