"""
RAG Router — Real implementation với Gemini + FAISS
"""
import asyncio
import logging
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from pydantic import BaseModel
from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.modules.auth.deps import get_current_admin
from app.modules.auth.models import User

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
    from app.modules.rag.service import FAISS_INDEX_PATH, FAISS_METADATA_PATH, _faiss_index, _chunk_metadata, load_index
    from app.core.config import settings

    has_key = bool(settings.GEMINI_API_KEY)
    index_exists = FAISS_INDEX_PATH.exists()
    num_chunks = 0

    if index_exists:
        if _faiss_index is None:
            load_index()
        from app.modules.rag.service import _faiss_index as idx
        if idx is not None:
            num_chunks = idx.ntotal

    return {
        "status": "ready" if (has_key and index_exists) else ("no_key" if not has_key else "not_indexed"),
        "gemini_api_configured": has_key,
        "index_exists": index_exists,
        "num_vectors": num_chunks,
        "embedding_model": "models/gemini-embedding-001",
        "llm_model": "gemini-2.5-flash",
        "description": "RAG Module — Gemini Embeddings + FAISS Vector Store"
    }


@router.post("/index", response_model=IndexResponse)
async def rebuild_index(
    background_tasks: BackgroundTasks,
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
async def query_rag(req: RAGQueryRequest, db: AsyncSession = Depends(get_db)):
    """
    RAG Q&A — Tìm kiếm ngữ nghĩa + Gemini trả lời.
    """
    from app.modules.rag.service import search_similar, generate_answer, FAISS_INDEX_PATH
    from app.core.config import settings

    if not settings.GEMINI_API_KEY:
        raise HTTPException(status_code=503, detail="RAG chưa được cấu hình (thiếu GEMINI_API_KEY)")

    if not FAISS_INDEX_PATH.exists():
        raise HTTPException(
            status_code=503,
            detail="FAISS index chưa được build. Admin cần gọi POST /api/rag/index trước."
        )

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

        return RAGResponse(
            answer=answer,
            sources=sources,
            model="gemini-2.5-flash + gemini-embedding-001",
        )

    except ValueError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        logger.error(f"RAG query error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Lỗi xử lý RAG: {str(e)}")
