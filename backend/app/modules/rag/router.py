from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import List, Optional
from app.core.database import get_db
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(prefix="/rag", tags=["RAG & AI"])


class RAGQueryRequest(BaseModel):
    query: str
    top_k: int = 4


class RAGSourceDocument(BaseModel):
    title: str
    slug: str
    similarity_score: float
    snippet: str


class RAGResponse(BaseModel):
    answer: str
    sources: List[RAGSourceDocument]
    model: str = "Placeholder (Sẵn sàng cắm LangChain / pgvector)"


@router.get("/status")
async def rag_status():
    """Kiểm tra trạng thái sẵn sàng của module RAG."""
    return {
        "status": "ready_for_extension",
        "vector_backend": "pgvector_compatible",
        "description": "Module này đã được cấu trúc sẵn để tích hợp LangChain/LlamaIndex và pgvector khi bạn kích hoạt."
    }


@router.post("/query", response_model=RAGResponse)
async def query_rag(req: RAGQueryRequest, db: AsyncSession = Depends(get_db)):
    """
    Endpoint RAG sẵn sàng nhận truy vấn từ bạn hoặc độc giả blog.
    Khi kết nối pgvector + OpenAI/Gemini, logic vector similarity search sẽ đặt tại đây.
    """
    return RAGResponse(
        answer=f"Hệ thống đã nhận câu hỏi: '{req.query}'. Module RAG đang ở chế độ chờ kích hoạt tích hợp LLM & embeddings.",
        sources=[
            RAGSourceDocument(
                title="Khởi tạo kiến trúc RAG cho Blog cá nhân",
                slug="khoi-tao-kien-truc-rag",
                similarity_score=0.98,
                snippet="Hướng dẫn thiết kế module RAG mở rộng trên nền tảng FastAPI và pgvector..."
            )
        ]
    )
