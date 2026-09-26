"""
RAG Router — Real implementation với Gemini + FAISS
"""
import asyncio
import logging
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Request
from pydantic import BaseModel
from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.modules.auth.deps import get_current_admin, get_optional_user
from app.modules.auth.models import User
from app.modules.audit.service import record_audit_log

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/rag", tags=["RAG & AI"])


# ── Schemas ────────────────────────────────────────────────────────────────

class RAGQueryRequest(BaseModel):
    query: str
    top_k: int = 5


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


class IndexResponse(BaseModel):
    success: bool
    message: str
    num_posts: int = 0
    num_chunks: int = 0


# ── Endpoints ──────────────────────────────────────────────────────────────

@router.get("/status")
async def rag_status():
    """Kiểm tra trạng thái RAG module."""
    from app.core.config import settings
    has_key = bool(settings.GEMINI_API_KEY)

    try:
        from app.modules.rag.service import FAISS_INDEX_PATH, FAISS_METADATA_PATH, _faiss_index, _chunk_metadata, load_index
        index_exists = FAISS_INDEX_PATH.exists()
        num_chunks = 0

        if index_exists:
            if _faiss_index is None:
                load_index()
            from app.modules.rag.service import _faiss_index as idx
            if idx is not None:
                num_chunks = idx.ntotal

        return {
            "status": "ready" if (has_key and index_exists and num_chunks > 0) else ("no_key" if not has_key else "not_indexed"),
            "gemini_api_configured": has_key,
            "index_exists": index_exists,
            "num_vectors": num_chunks,
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
    from app.modules.blog.models import Post

    # Lấy tất cả bài published
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

    # Ghi nhận audit log cho thao tác rebuild index
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

    # Chạy index trong background
    def _run_index():
        from app.modules.rag.service import build_index_from_posts
        try:
            n_posts, n_chunks = build_index_from_posts(posts_data)
            logger.info(f"RAG: Background index hoàn thành — {n_posts} bài, {n_chunks} chunks")
        except Exception as e:
            logger.error(f"RAG: Lỗi build index: {e}")

    background_tasks.add_task(_run_index)

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
    Kiểm soát và ghi nhật ký hệ thống toàn bộ người dùng (thành viên hoặc khách vãng lai).
    """
    # Đánh dấu để middleware không ghi log trùng lặp
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

    try:
        from app.modules.rag.service import search_similar, generate_answer, FAISS_INDEX_PATH
    except ImportError as e:
        logger.error(f"RAG import error: {e}")
        await record_audit_log(
            db=db,
            action="RAG_QUERY_FAILED",
            summary=f"RAG thất bại (Lỗi thư viện AI): \"{req.query}\"",
            user=current_user,
            actor_name=actor_name,
            actor_email=actor_email,
            target_type="rag",
            target_title=req.query[:255],
            details={"query": req.query, "error": str(e)},
            request=request,
        )
        raise HTTPException(
            status_code=503,
            detail=f"Thư viện AI trên server đang cập nhật ({str(e)}). Vui lòng thử lại sau vài phút."
        )

    # Tự động khởi tạo index nếu chưa tồn tại (ví dụ sau khi Render deploy lại)
    if not FAISS_INDEX_PATH.exists():
        try:
            from app.modules.blog.models import Post
            from app.modules.rag.service import build_index_from_posts
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
                build_index_from_posts(posts_data)
        except Exception as e:
            logger.warning(f"RAG: Auto build index warning: {e}")

    try:
        # Tìm chunks liên quan
        similar_chunks = search_similar(req.query, top_k=req.top_k)

        # Tạo câu trả lời
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

        # Ghi nhật ký hệ thống chi tiết cho truy vấn RAG
        summary_text = (
            f"'{actor_name}' tìm kiếm RAG AI: \"{req.query}\" ({len(sources)} tài liệu liên quan)"
            if current_user
            else f"Khách vãng lai tìm kiếm RAG AI: \"{req.query}\" ({len(sources)} tài liệu liên quan)"
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
