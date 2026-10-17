"""
RAG Router — Real implementation với Gemini + FAISS + Multi-Knowledge-Bases
"""
import asyncio
import logging
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Request, Query, status
from pydantic import BaseModel
from typing import List, Optional, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, desc
from sqlalchemy.orm import selectinload
from slugify import slugify

from app.core.database import get_db
from app.modules.auth.deps import get_current_admin, get_optional_user
from app.modules.auth.models import User
from app.modules.audit.service import record_audit_log
from app.modules.blog.models import Post, Series, Chapter
from app.modules.rag.models import KnowledgeBase, kb_posts, kb_series
from app.modules.rag.service import (
    search_similar,
    generate_answer,
    build_index_from_posts,
    build_index_for_kb,
    search_similar_kb,
    get_kb_status,
    delete_kb_index,
    FAISS_INDEX_PATH,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/rag", tags=["RAG & AI"])


# ── Schemas ────────────────────────────────────────────────────────────────

class RAGQueryRequest(BaseModel):
    query: str
    top_k: int = 5
    kb_id: Optional[str] = None


class RAGSourceDocument(BaseModel):
    title: str
    slug: str
    similarity_score: float
    snippet: str


class RAGResponse(BaseModel):
    answer: str
    sources: List[RAGSourceDocument]
    model: str = "gemini-2.5-flash + gemini-embedding-001"
    indexed_posts: Optional[int] = None
    kb_id: Optional[str] = None
    kb_name: Optional[str] = None


class IndexResponse(BaseModel):
    success: bool
    message: str
    num_posts: int = 0
    num_chunks: int = 0


class KnowledgeBaseCreate(BaseModel):
    name: str
    slug: Optional[str] = None
    description: Optional[str] = None
    post_ids: List[str] = []
    series_ids: List[str] = []


class KnowledgeBaseUpdate(BaseModel):
    name: Optional[str] = None
    slug: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None
    post_ids: Optional[List[str]] = None
    series_ids: Optional[List[str]] = None


class PostBriefItem(BaseModel):
    id: str
    title: str
    slug: str


class SeriesBriefItem(BaseModel):
    id: str
    title: str
    slug: str
    lesson_count: int = 0


class KnowledgeBaseResponse(BaseModel):
    id: str
    name: str
    slug: str
    description: Optional[str] = None
    is_active: bool = True
    created_at: Any
    updated_at: Any
    series_count: int = 0
    direct_posts_count: int = 0
    effective_posts_count: int = 0
    is_indexed: bool = False
    num_vectors: int = 0
    indexed_posts_count: int = 0
    pending_posts_count: int = 0
    last_indexed_at: Optional[str] = None
    is_system: bool = False
    series: List[SeriesBriefItem] = []
    posts: List[PostBriefItem] = []


# ── Helpers ────────────────────────────────────────────────────────────────

async def make_kb_unique_slug(db: AsyncSession, base_text: str, current_id: Optional[str] = None) -> str:
    base_slug = slugify(base_text) or "kb"
    slug = base_slug
    counter = 1
    while True:
        stmt = select(KnowledgeBase).where(KnowledgeBase.slug == slug)
        if current_id:
            stmt = stmt.where(KnowledgeBase.id != current_id)
        res = await db.execute(stmt)
        if not res.scalar_one_or_none():
            return slug
        slug = f"{base_slug}-{counter}"
        counter += 1


async def get_effective_posts_for_kb(db: AsyncSession, post_ids: List[str], series_ids: List[str]) -> List[dict]:
    """
    Tập hợp danh sách bài viết hiệu lực từ:
    1. Các bài viết lẻ được chọn trực tiếp (post_ids)
    2. Tất cả bài viết nằm trong các khóa học được chọn (series_ids)
    Chỉ lấy các bài viết đã xuất bản (is_published == True) và loại bỏ trùng lặp.
    """
    seen_ids = set()
    posts_data = []

    # 1. Bài viết trực tiếp
    if post_ids:
        direct_stmt = select(Post).where(Post.id.in_(post_ids), Post.is_published == True)
        res_direct = await db.execute(direct_stmt)
        for p in res_direct.scalars().all():
            if p.id not in seen_ids:
                seen_ids.add(p.id)
                posts_data.append({
                    "id": p.id,
                    "title": p.title,
                    "slug": p.slug,
                    "summary": p.summary or "",
                    "content_html": p.content_html or "",
                    "content_markdown": p.content_markdown or "",
                })

    # 2. Bài viết thuộc Series (Chương + bài trực tiếp thuộc series)
    if series_ids:
        series_stmt = (
            select(Series)
            .where(Series.id.in_(series_ids))
            .options(
                selectinload(Series.chapters).selectinload(Chapter.posts),
                selectinload(Series.posts),
            )
        )
        res_series = await db.execute(series_stmt)
        for s in res_series.scalars().all():
            for ch in (s.chapters or []):
                for p in (ch.posts or []):
                    if p.is_published and p.id not in seen_ids:
                        seen_ids.add(p.id)
                        posts_data.append({
                            "id": p.id,
                            "title": p.title,
                            "slug": p.slug,
                            "summary": p.summary or "",
                            "content_html": p.content_html or "",
                            "content_markdown": p.content_markdown or "",
                        })
            for p in (s.posts or []):
                if p.is_published and p.id not in seen_ids:
                    seen_ids.add(p.id)
                    posts_data.append({
                        "id": p.id,
                        "title": p.title,
                        "slug": p.slug,
                        "summary": p.summary or "",
                        "content_html": p.content_html or "",
                        "content_markdown": p.content_markdown or "",
                    })

    return posts_data


async def format_kb_response(db: AsyncSession, kb: KnowledgeBase) -> KnowledgeBaseResponse:
    kb_status = get_kb_status(kb.id)
    post_ids = [p.id for p in (kb.posts or [])]
    series_ids = [s.id for s in (kb.series or [])]
    effective_posts = await get_effective_posts_for_kb(db, post_ids, series_ids)

    indexed_count = kb_status.get("indexed_posts_count", 0)
    effective_count = len(effective_posts)
    pending_count = max(0, effective_count - indexed_count)

    series_items = [
        SeriesBriefItem(
            id=s.id,
            title=s.title,
            slug=s.slug,
            lesson_count=sum(len(ch.posts) for ch in (s.chapters or [])) + len(s.posts or []),
        )
        for s in (kb.series or [])
    ]
    post_items = [
        PostBriefItem(id=p.id, title=p.title, slug=p.slug)
        for p in (kb.posts or [])
    ]

    return KnowledgeBaseResponse(
        id=kb.id,
        name=kb.name,
        slug=kb.slug,
        description=kb.description,
        is_active=kb.is_active,
        created_at=kb.created_at,
        updated_at=kb.updated_at,
        series_count=len(kb.series or []),
        direct_posts_count=len(kb.posts or []),
        effective_posts_count=effective_count,
        is_indexed=kb_status.get("is_indexed", False),
        num_vectors=kb_status.get("num_vectors", 0),
        indexed_posts_count=indexed_count,
        pending_posts_count=pending_count,
        last_indexed_at=kb_status.get("last_indexed_at"),
        is_system=False,
        series=series_items,
        posts=post_items,
    )


# ── Knowledge Base Endpoints ──────────────────────────────────────────────

@router.get("/kb", response_model=List[KnowledgeBaseResponse])
async def list_knowledge_bases(
    include_inactive: bool = False,
    db: AsyncSession = Depends(get_db),
    optional_user: Optional[User] = Depends(get_optional_user)
):
    """Lấy danh sách các Kho Tri Thức (Knowledge Bases)."""
    stmt = (
        select(KnowledgeBase)
        .options(
            selectinload(KnowledgeBase.posts),
            selectinload(KnowledgeBase.series).selectinload(Series.chapters).selectinload(Chapter.posts),
            selectinload(KnowledgeBase.series).selectinload(Series.posts),
        )
        .order_by(desc(KnowledgeBase.created_at))
    )
    is_admin = bool(optional_user and (optional_user.is_admin or getattr(optional_user, "role", "") == "admin"))
    if not (include_inactive and is_admin):
        stmt = stmt.where(KnowledgeBase.is_active == True)

    res = await db.execute(stmt)
    kbs = res.scalars().all()
    output = []
    for kb in kbs:
        output.append(await format_kb_response(db, kb))
    return output


@router.get("/kb/{identifier}", response_model=KnowledgeBaseResponse)
async def get_knowledge_base(
    identifier: str,
    db: AsyncSession = Depends(get_db),
    optional_user: Optional[User] = Depends(get_optional_user)
):
    """Lấy chi tiết một Kho Tri Thức theo ID hoặc Slug."""
    stmt = (
        select(KnowledgeBase)
        .where(or_(KnowledgeBase.id == identifier, KnowledgeBase.slug == identifier))
        .options(
            selectinload(KnowledgeBase.posts),
            selectinload(KnowledgeBase.series).selectinload(Series.chapters).selectinload(Chapter.posts),
            selectinload(KnowledgeBase.series).selectinload(Series.posts),
        )
    )
    res = await db.execute(stmt)
    kb = res.scalar_one_or_none()
    if not kb:
        raise HTTPException(status_code=404, detail="Kho tri thức không tồn tại")
    is_admin = bool(optional_user and (optional_user.is_admin or getattr(optional_user, "role", "") == "admin"))
    if not kb.is_active and not is_admin:
        raise HTTPException(status_code=404, detail="Kho tri thức không tồn tại hoặc đã tạm khóa")
    return await format_kb_response(db, kb)


@router.post("/kb", response_model=KnowledgeBaseResponse, status_code=status.HTTP_201_CREATED)
async def create_knowledge_base(
    body: KnowledgeBaseCreate,
    background_tasks: BackgroundTasks,
    request: Request,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin)
):
    """[Admin Only] Tạo một Kho Tri Thức mới với các bài viết và khóa học đã chọn."""
    if not body.name.strip():
        raise HTTPException(status_code=400, detail="Tên kho tri thức không được để trống")

    slug = await make_kb_unique_slug(db, body.slug or body.name)
    kb = KnowledgeBase(
        name=body.name.strip(),
        slug=slug,
        description=body.description.strip() if body.description else None,
        is_active=True,
    )

    if body.post_ids:
        posts_res = await db.execute(select(Post).where(Post.id.in_(body.post_ids)))
        kb.posts = list(posts_res.scalars().all())

    if body.series_ids:
        series_res = await db.execute(select(Series).where(Series.id.in_(body.series_ids)))
        kb.series = list(series_res.scalars().all())

    db.add(kb)
    await db.commit()
    await db.refresh(kb)

    # Tự động lập chỉ mục trong nền nếu đã chọn nội dung (chạy hoàn toàn ngầm qua thread pool)
    effective_posts = await get_effective_posts_for_kb(db, body.post_ids, body.series_ids)
    if effective_posts:
        kb_id = kb.id
        def _run_kb_index():
            try:
                build_index_for_kb(kb_id, effective_posts)
            except Exception as e:
                logger.error(f"Lỗi build index KB '{kb_id}': {e}")
        asyncio.create_task(asyncio.to_thread(_run_kb_index))

    request.state.audit_logged = True
    await record_audit_log(
        db=db,
        action="CREATE_KNOWLEDGE_BASE",
        summary=f"Admin '{admin.username}' tạo Kho Tri Thức: '{kb.name}' ({len(effective_posts)} bài viết)",
        user=admin,
        target_type="knowledge_base",
        target_title=kb.name,
        details={"kb_id": kb.id, "slug": kb.slug, "effective_posts": len(effective_posts)},
        request=request,
    )

    return await get_knowledge_base(kb.id, db, admin)


@router.put("/kb/{kb_id}", response_model=KnowledgeBaseResponse)
async def update_knowledge_base(
    kb_id: str,
    body: KnowledgeBaseUpdate,
    background_tasks: BackgroundTasks,
    request: Request,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin)
):
    """[Admin Only] Chỉnh sửa Kho Tri Thức và cập nhật danh sách bài viết/khóa học."""
    stmt = (
        select(KnowledgeBase)
        .where(KnowledgeBase.id == kb_id)
        .options(
            selectinload(KnowledgeBase.posts),
            selectinload(KnowledgeBase.series),
        )
    )
    res = await db.execute(stmt)
    kb = res.scalar_one_or_none()
    if not kb:
        raise HTTPException(status_code=404, detail="Kho tri thức không tồn tại")

    if body.name is not None and body.name.strip():
        kb.name = body.name.strip()
    if body.slug is not None and body.slug.strip():
        kb.slug = await make_kb_unique_slug(db, body.slug, current_id=kb.id)
    if body.description is not None:
        kb.description = body.description.strip() if body.description.strip() else None
    if body.is_active is not None:
        kb.is_active = body.is_active

    relations_changed = False
    if body.post_ids is not None:
        posts_res = await db.execute(select(Post).where(Post.id.in_(body.post_ids)))
        kb.posts = list(posts_res.scalars().all())
        relations_changed = True

    if body.series_ids is not None:
        series_res = await db.execute(select(Series).where(Series.id.in_(body.series_ids)))
        kb.series = list(series_res.scalars().all())
        relations_changed = True

    await db.commit()
    await db.refresh(kb)

    # Re-index nếu quan hệ thay đổi
    post_ids = [p.id for p in kb.posts]
    series_ids = [s.id for s in kb.series]
    effective_posts = await get_effective_posts_for_kb(db, post_ids, series_ids)
    if relations_changed and effective_posts:
        target_id = kb.id
        def _run_kb_index():
            try:
                build_index_for_kb(target_id, effective_posts)
            except Exception as e:
                logger.error(f"Lỗi re-index KB '{target_id}': {e}")
        asyncio.create_task(asyncio.to_thread(_run_kb_index))

    request.state.audit_logged = True
    await record_audit_log(
        db=db,
        action="UPDATE_KNOWLEDGE_BASE",
        summary=f"Admin '{admin.username}' cập nhật Kho Tri Thức: '{kb.name}'",
        user=admin,
        target_type="knowledge_base",
        target_title=kb.name,
        details={"kb_id": kb.id, "slug": kb.slug},
        request=request,
    )

    return await get_knowledge_base(kb.id, db, admin)


@router.delete("/kb/{kb_id}")
async def delete_knowledge_base(
    kb_id: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin)
):
    """[Admin Only] Xóa Kho Tri Thức và loại bỏ vector index tương ứng."""
    stmt = select(KnowledgeBase).where(KnowledgeBase.id == kb_id)
    res = await db.execute(stmt)
    kb = res.scalar_one_or_none()
    if not kb:
        raise HTTPException(status_code=404, detail="Kho tri thức không tồn tại")

    kb_name = kb.name
    delete_kb_index(kb.id)
    await db.delete(kb)
    await db.commit()

    request.state.audit_logged = True
    await record_audit_log(
        db=db,
        action="DELETE_KNOWLEDGE_BASE",
        summary=f"Admin '{admin.username}' xóa Kho Tri Thức: '{kb_name}'",
        user=admin,
        target_type="knowledge_base",
        target_title=kb_name,
        details={"kb_id": kb_id},
        request=request,
    )
    return {"success": True, "message": f"Đã xóa kho tri thức '{kb_name}' thành công"}


@router.post("/kb/{kb_id}/index", response_model=IndexResponse)
async def index_knowledge_base(
    kb_id: str,
    background_tasks: BackgroundTasks,
    request: Request,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin)
):
    """[Admin Only] Build/Rebuild Vector Index riêng biệt cho một Kho Tri Thức."""
    stmt = (
        select(KnowledgeBase)
        .where(KnowledgeBase.id == kb_id)
        .options(
            selectinload(KnowledgeBase.posts),
            selectinload(KnowledgeBase.series),
        )
    )
    res = await db.execute(stmt)
    kb = res.scalar_one_or_none()
    if not kb:
        raise HTTPException(status_code=404, detail="Kho tri thức không tồn tại")

    post_ids = [p.id for p in kb.posts]
    series_ids = [s.id for s in kb.series]
    effective_posts = await get_effective_posts_for_kb(db, post_ids, series_ids)

    if not effective_posts:
        return IndexResponse(
            success=False,
            message="Kho tri thức này chưa có bài viết nào đã xuất bản để lập chỉ mục.",
            num_posts=0,
            num_chunks=0
        )

    target_id = kb.id
    def _run_kb_index():
        try:
            n_posts, n_chunks = build_index_for_kb(target_id, effective_posts)
            logger.info(f"RAG: KB '{target_id}' index xong — {n_posts} bài, {n_chunks} chunks")
        except Exception as e:
            logger.error(f"RAG: Lỗi index KB '{target_id}': {e}")

    asyncio.create_task(asyncio.to_thread(_run_kb_index))

    request.state.audit_logged = True
    await record_audit_log(
        db=db,
        action="INDEX_KNOWLEDGE_BASE",
        summary=f"Admin '{admin.username}' kích hoạt Re-index Kho Tri Thức '{kb.name}' ({len(effective_posts)} bài viết)",
        user=admin,
        target_type="knowledge_base",
        target_title=kb.name,
        details={"kb_id": kb.id, "posts_count": len(effective_posts)},
        request=request,
    )

    return IndexResponse(
        success=True,
        message=f"Đang lập chỉ mục Vector cho {len(effective_posts)} bài viết trong kho tri thức '{kb.name}'.",
        num_posts=len(effective_posts),
        num_chunks=0
    )


@router.get("/kb-options")
async def get_kb_options(
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin)
):
    """[Admin Only] Trả về danh sách khóa học và bài viết để admin chọn khi tạo/sửa Kho Tri Thức."""
    series_stmt = (
        select(Series)
        .options(
            selectinload(Series.chapters).selectinload(Chapter.posts),
            selectinload(Series.posts),
        )
        .order_by(desc(Series.created_at))
    )
    series_res = await db.execute(series_stmt)
    series_list = []
    for s in series_res.scalars().all():
        total_lessons = sum(len(ch.posts) for ch in (s.chapters or [])) + len(s.posts or [])
        series_list.append({
            "id": s.id,
            "title": s.title,
            "slug": s.slug,
            "lesson_count": total_lessons,
            "is_published": s.is_published,
        })

    posts_stmt = (
        select(Post)
        .options(selectinload(Post.series))
        .order_by(desc(Post.created_at))
    )
    posts_res = await db.execute(posts_stmt)
    posts_list = []
    for p in posts_res.scalars().all():
        posts_list.append({
            "id": p.id,
            "title": p.title,
            "slug": p.slug,
            "is_published": p.is_published,
            "series_title": p.series.title if p.series else None,
        })

    return {
        "series": series_list,
        "posts": posts_list,
    }


# ── Global Endpoints ───────────────────────────────────────────────────────

@router.get("/status")
async def rag_status(db: AsyncSession = Depends(get_db)):
    """Kiểm tra trạng thái RAG module và thống kê index toàn blog."""
    from app.core.config import settings
    from sqlalchemy import func
    has_key = bool(settings.GEMINI_API_KEY)

    try:
        from app.modules.rag.service import get_global_index_stats
        stats = get_global_index_stats()

        stmt_count = select(func.count(Post.id)).where(Post.is_published == True)
        res_count = await db.execute(stmt_count)
        total_published = res_count.scalar() or 0

        indexed_count = stats.get("indexed_posts_count", 0)
        pending_count = max(0, total_published - indexed_count)
        index_exists = stats.get("is_indexed", False)
        num_vectors = stats.get("num_vectors", 0)

        return {
            "status": "ready" if (has_key and index_exists and num_vectors > 0) else ("no_key" if not has_key else "not_indexed"),
            "gemini_api_configured": has_key,
            "index_exists": index_exists,
            "num_vectors": num_vectors,
            "total_posts_count": total_published,
            "indexed_posts_count": indexed_count,
            "pending_posts_count": pending_count,
            "last_indexed_at": stats.get("last_indexed_at"),
            "embedding_model": "models/gemini-embedding-001",
            "llm_model": "gemini-2.5-flash",
            "description": "RAG Module — Gemini Embeddings + FAISS Vector Store"
        }
    except Exception as e:
        logger.error(f"RAG status check error: {e}")
        return {
            "status": "not_ready",
            "gemini_api_configured": has_key,
            "index_exists": False,
            "num_vectors": 0,
            "total_posts_count": 0,
            "indexed_posts_count": 0,
            "pending_posts_count": 0,
            "last_indexed_at": None,
            "error": str(e),
            "description": f"RAG Module đang khởi tạo: {str(e)}"
        }


@router.post("/index", response_model=IndexResponse)
async def rebuild_index(
    background_tasks: BackgroundTasks,
    request: Request,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin)
):
    """
    [Admin Only] Build/Rebuild toàn bộ FAISS index từ tất cả bài viết đã xuất bản.
    Chạy trong background — không block request.
    """
    stmt = select(Post).where(Post.is_published == True)
    result = await db.execute(stmt)
    posts = result.scalars().all()

    if not posts:
        return IndexResponse(
            success=False,
            message="Không có bài viết nào đã xuất bản để index.",
        )

    posts_data = [
        {
            "id": p.id,
            "title": p.title,
            "slug": p.slug,
            "summary": p.summary or "",
            "content_html": p.content_html or "",
            "content_markdown": p.content_markdown or "",
        }
        for p in posts
    ]

    request.state.audit_logged = True
    await record_audit_log(
        db=db,
        action="RAG_REBUILD_INDEX",
        summary=f"Quản trị viên '{admin.username}' kích hoạt tạo lại Vector Index cho {len(posts)} bài viết",
        user=admin,
        target_type="rag",
        target_title=f"{len(posts)} bài viết",
        details={"num_posts": len(posts)},
        request=request,
    )

    def _run_index():
        try:
            n_posts, n_chunks = build_index_from_posts(posts_data)
            logger.info(f"RAG: Background index hoàn thành — {n_posts} bài, {n_chunks} chunks")
        except Exception as e:
            logger.error(f"RAG: Lỗi build index: {e}")

    asyncio.create_task(asyncio.to_thread(_run_index))

    return IndexResponse(
        success=True,
        message=f"Đang build index cho {len(posts)} bài viết trong nền. Kiểm tra /status sau vài phút.",
        num_posts=len(posts),
        num_chunks=0,
    )


@router.post("/query", response_model=RAGResponse)
async def query_rag(
    req: RAGQueryRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user)
):
    """
    RAG Q&A — Tìm kiếm ngữ nghĩa + Gemini trả lời.
    Hỗ trợ truy vấn theo từng Kho Tri Thức (Knowledge Base) hoặc toàn bộ blog.
    """
    request.state.audit_logged = True

    actor_name = "Khách vãng lai"
    actor_email = None
    action = "ANONYMOUS_RAG_QUERY"

    if current_user:
        actor_name = current_user.full_name or current_user.username
        actor_email = current_user.email
        action = "RAG_QUERY"

    from app.core.config import settings
    if not settings.GEMINI_API_KEY:
        await record_audit_log(
            db=db,
            action="RAG_QUERY_FAILED",
            summary=f"RAG thất bại (Chưa cấu hình GEMINI_API_KEY): \"{req.query}\"",
            user=current_user,
            actor_name=actor_name,
            actor_email=actor_email,
            target_type="rag",
            target_title=req.query[:255],
            details={"query": req.query, "error": "Missing GEMINI_API_KEY"},
            request=request,
        )
        raise HTTPException(
            status_code=503,
            detail="Hệ thống RAG chưa được cấu hình khóa GEMINI_API_KEY trên server backend."
        )

    # Kiểm tra Knowledge Base nếu có
    target_kb = None
    if req.kb_id and req.kb_id.strip():
        kb_id_clean = req.kb_id.strip()
        kb_stmt = (
            select(KnowledgeBase)
            .where(or_(KnowledgeBase.id == kb_id_clean, KnowledgeBase.slug == kb_id_clean))
            .options(
                selectinload(KnowledgeBase.posts),
                selectinload(KnowledgeBase.series),
            )
        )
        target_kb = (await db.execute(kb_stmt)).scalar_one_or_none()

    try:
        # Nếu chỉ định KB
        if target_kb:
            kb_status = get_kb_status(target_kb.id)
            if not kb_status.get("is_indexed"):
                post_ids = [p.id for p in target_kb.posts]
                series_ids = [s.id for s in target_kb.series]
                eff_posts = await get_effective_posts_for_kb(db, post_ids, series_ids)
                if eff_posts:
                    target_id = target_kb.id
                    asyncio.create_task(asyncio.to_thread(build_index_for_kb, target_id, eff_posts))
                return RAGResponse(
                    answer=f"Kho tri thức '{target_kb.name}' ({len(eff_posts)} bài viết) hiện chưa hoàn tất chỉ mục vector. Hệ thống đã tự động kích hoạt lập chỉ mục trong nền, bạn vui lòng quay lại hỏi đáp sau 1-2 phút!",
                    sources=[],
                    kb_id=target_kb.id,
                    kb_name=target_kb.name,
                )

            similar_chunks = search_similar_kb(target_kb.id, req.query, top_k=req.top_k)
            answer = generate_answer(req.query, similar_chunks, kb_name=target_kb.name)
        else:
            # Tự động khởi tạo index toàn bộ trong nền nếu chưa tồn tại
            if not FAISS_INDEX_PATH.exists():
                stmt = select(Post).where(Post.is_published == True)
                res = await db.execute(stmt)
                posts = res.scalars().all()
                if posts:
                    posts_data = [
                        {
                            "id": p.id,
                            "title": p.title,
                            "slug": p.slug,
                            "summary": p.summary or "",
                            "content_html": p.content_html or "",
                            "content_markdown": p.content_markdown or "",
                        }
                        for p in posts
                    ]
                    asyncio.create_task(asyncio.to_thread(build_index_from_posts, posts_data))
                return RAGResponse(
                    answer="Chỉ mục vector toàn blog đang được khởi tạo trong nền. Vui lòng thử lại sau ít phút!",
                    sources=[],
                )

            similar_chunks = search_similar(req.query, top_k=req.top_k)
            answer = generate_answer(req.query, similar_chunks)

        sources = [
            RAGSourceDocument(
                title=chunk["title"],
                slug=chunk["slug"],
                similarity_score=round(chunk["similarity_score"], 4),
                snippet=chunk["snippet"],
            )
            for chunk in similar_chunks
        ]

        kb_label = f" (Kho tri thức: '{target_kb.name}')" if target_kb else ""
        summary_text = (
            f"'{actor_name}' tìm kiếm RAG AI{kb_label}: \"{req.query}\" ({len(sources)} tài liệu liên quan)"
            if current_user
            else f"Khách vãng lai tìm kiếm RAG AI{kb_label}: \"{req.query}\" ({len(sources)} tài liệu liên quan)"
        )

        await record_audit_log(
            db=db,
            action=action,
            summary=summary_text,
            user=current_user,
            actor_name=actor_name,
            actor_email=actor_email,
            target_type="rag",
            target_title=req.query[:255],
            details={
                "query": req.query,
                "top_k": req.top_k,
                "kb_id": target_kb.id if target_kb else None,
                "kb_name": target_kb.name if target_kb else None,
                "sources_count": len(sources),
                "sources": [
                    {
                        "title": s.title,
                        "slug": s.slug,
                        "similarity_score": s.similarity_score,
                        "snippet": s.snippet[:200]
                    }
                    for s in sources
                ],
                "answer_preview": answer[:300] + ("..." if len(answer) > 300 else ""),
                "model": "gemini-2.5-flash + gemini-embedding-001",
            },
            request=request,
        )

        return RAGResponse(
            answer=answer,
            sources=sources,
            model="gemini-2.5-flash + gemini-embedding-001",
            kb_id=target_kb.id if target_kb else None,
            kb_name=target_kb.name if target_kb else None,
        )

    except ValueError as e:
        await record_audit_log(
            db=db,
            action="RAG_QUERY_FAILED",
            summary=f"RAG thất bại (ValueError): \"{req.query}\" - {str(e)}",
            user=current_user,
            actor_name=actor_name,
            actor_email=actor_email,
            target_type="rag",
            target_title=req.query[:255],
            details={"query": req.query, "error": str(e)},
            request=request,
        )
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        logger.error(f"RAG query error: {e}", exc_info=True)
        await record_audit_log(
            db=db,
            action="RAG_QUERY_FAILED",
            summary=f"RAG lỗi hệ thống: \"{req.query}\" - {str(e)}",
            user=current_user,
            actor_name=actor_name,
            actor_email=actor_email,
            target_type="rag",
            target_title=req.query[:255],
            details={"query": req.query, "error": str(e)},
            request=request,
        )
        raise HTTPException(status_code=500, detail=f"Lỗi xử lý RAG: {str(e)}")
