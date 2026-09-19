import re
from fastapi import APIRouter
from pydantic import BaseModel
from typing import List, Dict, Any

router = APIRouter(prefix="/utilities", tags=["Utilities"])


class TextStatsRequest(BaseModel):
    text: str


class TextStatsResponse(BaseModel):
    characters: int
    words: int
    sentences: int
    paragraphs: int
    reading_time_minutes: int


@router.get("/")
async def list_available_utilities() -> Dict[str, Any]:
    """Danh sách các tiện ích cá nhân hiện có và sẵn sàng mở rộng."""
    return {
        "utilities": [
            {
                "id": "text-analyzer",
                "name": "Bộ phân tích văn bản & thời lượng đọc",
                "endpoint": "/api/utilities/text-stats"
            },
            {
                "id": "slug-generator",
                "name": "Công cụ sinh URL slug chuẩn SEO",
                "endpoint": "/api/utilities/slug"
            }
        ],
        "message": "Bạn có thể dễ dàng bổ sung thêm các endpoint utility tùy ý vào module này."
    }


@router.post("/text-stats", response_model=TextStatsResponse)
async def analyze_text(payload: TextStatsRequest):
    text = payload.text or ""
    clean = re.sub(r"<[^>]+>", " ", text)
    words = clean.split()
    sentences = re.split(r"[.!?]+", clean)
    paragraphs = [p for p in text.split("\n") if p.strip()]

    return TextStatsResponse(
        characters=len(clean),
        words=len(words),
        sentences=len([s for s in sentences if s.strip()]),
        paragraphs=len(paragraphs),
        reading_time_minutes=max(1, (len(words) + 199) // 200)
    )
