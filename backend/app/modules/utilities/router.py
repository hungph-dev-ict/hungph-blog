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


class LinkMetadataRequest(BaseModel):
    url: str


class LinkMetadataResponse(BaseModel):
    url: str
    title: str
    description: str = ""
    site_name: str = ""
    image: str = ""


@router.post("/link-metadata", response_model=LinkMetadataResponse)
async def get_link_metadata(payload: LinkMetadataRequest):
    """Trích xuất tiêu đề và thông tin OpenGraph của link để tự động hiển thị link đẹp."""
    import html
    import requests
    from urllib.parse import urlparse

    url = payload.url.strip()
    if not url.startswith("http://") and not url.startswith("https://"):
        url = "https://" + url

    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/123.0.0.0 Safari/537.36"
        ),
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "vi,en-US;q=0.9,en;q=0.8",
    }

    try:
        # Timeout 4s để đảm bảo phản hồi nhanh cho editor
        resp = requests.get(url, headers=headers, timeout=4, allow_redirects=True)
        resp.encoding = resp.apparent_encoding or "utf-8"
        html_text = resp.text

        title = ""
        # 1. Thử OpenGraph title
        og_match = re.search(r'<meta[^>]+property=["\']og:title["\'][^>]+content=["\']([^"\']+)["\']', html_text, re.IGNORECASE)
        if not og_match:
            og_match = re.search(r'<meta[^>]+content=["\']([^"\']+)["\'][^>]+property=["\']og:title["\']', html_text, re.IGNORECASE)
        if og_match:
            title = og_match.group(1).strip()

        # 2. Thử thẻ <title>
        if not title:
            t_match = re.search(r'<title[^>]*>(.*?)</title>', html_text, re.IGNORECASE | re.DOTALL)
            if t_match:
                title = t_match.group(1).strip()

        # 3. Thử Twitter title
        if not title:
            tw_match = re.search(r'<meta[^>]+name=["\']twitter:title["\'][^>]+content=["\']([^"\']+)["\']', html_text, re.IGNORECASE)
            if tw_match:
                title = tw_match.group(1).strip()

        title = html.unescape(title) if title else urlparse(url).netloc
        # Làm sạch khoảng trắng thừa
        title = re.sub(r'\s+', ' ', title).strip()

        return LinkMetadataResponse(
            url=url,
            title=title or url,
            site_name=urlparse(url).netloc
        )
    except Exception:
        # Fallback về hostname hoặc chính URL nếu trang không phản hồi
        hostname = urlparse(url).netloc or url
        return LinkMetadataResponse(
            url=url,
            title=hostname,
            site_name=hostname
        )
