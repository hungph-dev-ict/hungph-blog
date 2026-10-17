"""Unit tests for Multi-Knowledge-Base RAG & Series Visibility Changes.

Scope:
- KnowledgeBase model & effective posts resolution (direct posts + all series lessons)
- make_kb_unique_slug generation
- GET /api/rag/kb endpoint
- GET /api/blog/series endpoint (draft visibility for admin vs public)
"""
import sys
import os
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

# Ensure backend/ package root is importable
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from fastapi.testclient import TestClient
from app.main import app
from app.core.database import get_db
from app.modules.auth.deps import get_current_admin, get_optional_user
from app.modules.rag.router import make_kb_unique_slug, get_effective_posts_for_kb


# ── Helpers ───────────────────────────────────────────────────────────────────

def _make_mock_user(user_id="admin-001", username="admin", is_admin=True, role="admin"):
    user = MagicMock()
    user.id = user_id
    user.username = username
    user.is_admin = is_admin
    user.role = role
    user.is_active = True
    return user


def _make_mock_post(post_id="post-1", title="Bài 1", slug="bai-1", is_published=True):
    p = MagicMock()
    p.id = post_id
    p.title = title
    p.slug = slug
    p.summary = "Tóm tắt bài 1"
    p.content_html = "<p>Nội dung bài 1</p>"
    p.content_markdown = "Nội dung bài 1"
    p.is_published = is_published
    return p


# ── Test effective posts resolution ──────────────────────────────────────────

@pytest.mark.asyncio
async def test_get_effective_posts_unites_direct_posts_and_series():
    """Verify that get_effective_posts_for_kb collects both direct posts and series lessons without duplicates."""
    mock_db = AsyncMock()

    # Direct posts: post-1 (published), post-2 (unpublished - should be filtered)
    p1 = _make_mock_post("post-1", "Direct Post 1", "direct-1", is_published=True)
    p2 = _make_mock_post("post-2", "Direct Post 2", "direct-2", is_published=False)

    direct_result = MagicMock()
    # Mocking SQL return where only published post-1 is returned
    direct_result.scalars.return_value.all.return_value = [p1]

    # Series posts: series-1 has chapter with post-1 (duplicate) and post-3 (new)
    p3 = _make_mock_post("post-3", "Series Lesson 3", "series-3", is_published=True)

    chapter = MagicMock()
    chapter.posts = [p1, p3]

    series = MagicMock()
    series.id = "series-1"
    series.chapters = [chapter]
    series.posts = []

    series_result = MagicMock()
    series_result.scalars.return_value.all.return_value = [series]

    mock_db.execute.side_effect = [direct_result, series_result]

    effective = await get_effective_posts_for_kb(mock_db, ["post-1", "post-2"], ["series-1"])

    # Output must have post-1 and post-3, deduplicated
    assert len(effective) == 2
    ids = [item["id"] for item in effective]
    assert "post-1" in ids
    assert "post-3" in ids
    assert "post-2" not in ids


# ── Test unique slug generation ──────────────────────────────────────────────

@pytest.mark.asyncio
async def test_make_kb_unique_slug_generates_clean_slug():
    """Verify that make_kb_unique_slug returns slugified text."""
    mock_db = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = None
    mock_db.execute.return_value = mock_result

    slug = await make_kb_unique_slug(mock_db, "Kho Kiến Trúc AI & LLM")
    assert slug == "kho-kien-truc-ai-llm"


# ── Test GET /api/rag/kb endpoint ─────────────────────────────────────────────

def test_list_knowledge_bases_endpoint():
    """Verify GET /api/rag/kb returns knowledge bases list."""
    mock_kb = MagicMock()
    mock_kb.id = "kb-1"
    mock_kb.name = "Kho Tri Thức AI"
    mock_kb.slug = "kho-tri-thuc-ai"
    mock_kb.description = "Mô tả về AI"
    mock_kb.is_active = True
    mock_kb.created_at = "2026-10-17T00:00:00Z"
    mock_kb.updated_at = "2026-10-17T00:00:00Z"
    mock_kb.posts = []
    mock_kb.series = []

    mock_db = AsyncMock()
    kb_result = MagicMock()
    kb_result.scalars.return_value.all.return_value = [mock_kb]
    mock_db.execute.return_value = kb_result

    async def _override_db():
        yield mock_db

    app.dependency_overrides[get_db] = _override_db
    app.dependency_overrides[get_optional_user] = lambda: None

    try:
        client = TestClient(app)
        res = client.get("/api/rag/kb")
        assert res.status_code == 200
        data = res.json()
        assert isinstance(data, list)
        assert len(data) == 1
        assert data[0]["name"] == "Kho Tri Thức AI"
        assert data[0]["slug"] == "kho-tri-thuc-ai"
    finally:
        app.dependency_overrides.pop(get_db, None)
        app.dependency_overrides.pop(get_optional_user, None)


# ── Test Series Visibility: Public vs Admin Drafts ────────────────────────────

def test_series_list_public_only_shows_published():
    """Verify GET /api/blog/series without include_drafts returns published series."""
    published_series = MagicMock()
    published_series.id = "s-1"
    published_series.title = "Khóa học đã xuất bản"
    published_series.slug = "khoa-hoc-published"
    published_series.summary = "Mô tả"
    published_series.cover_image = None
    published_series.is_published = True
    published_series.category_id = None
    published_series.hierarchy_config = '["Chương"]'
    published_series.attribution_text = None
    published_series.created_at = "2026-10-17T00:00:00Z"
    published_series.category = None
    published_series.owner = None
    published_series.owner_id = None
    published_series.chapters = []
    published_series.posts = []

    mock_db = AsyncMock()
    series_result = MagicMock()
    series_result.scalars.return_value.all.return_value = [published_series]
    mock_db.execute.return_value = series_result

    async def _override_db():
        yield mock_db

    app.dependency_overrides[get_db] = _override_db
    app.dependency_overrides[get_optional_user] = lambda: None

    try:
        client = TestClient(app)
        res = client.get("/api/blog/series")
        assert res.status_code == 200
        data = res.json()
        assert len(data) == 1
        assert data[0]["is_published"] is True
    finally:
        app.dependency_overrides.pop(get_db, None)
        app.dependency_overrides.pop(get_optional_user, None)


def test_series_list_admin_with_include_drafts_shows_all():
    """Verify GET /api/blog/series?include_drafts=true for admin returns both published and draft series."""
    admin_user = _make_mock_user(is_admin=True)

    draft_series = MagicMock()
    draft_series.id = "s-2"
    draft_series.title = "Khóa học nháp"
    draft_series.slug = "khoa-hoc-nhap"
    draft_series.summary = "Mô tả nháp"
    draft_series.cover_image = None
    draft_series.is_published = False
    draft_series.category_id = None
    draft_series.hierarchy_config = '["Chương"]'
    draft_series.attribution_text = None
    draft_series.created_at = "2026-10-17T00:00:00Z"
    draft_series.category = None
    draft_series.owner = None
    draft_series.owner_id = None
    draft_series.chapters = []
    draft_series.posts = []

    mock_db = AsyncMock()
    series_result = MagicMock()
    series_result.scalars.return_value.all.return_value = [draft_series]
    mock_db.execute.return_value = series_result

    async def _override_db():
        yield mock_db

    app.dependency_overrides[get_db] = _override_db
    app.dependency_overrides[get_optional_user] = lambda: admin_user

    try:
        client = TestClient(app)
        res = client.get("/api/blog/series?include_drafts=true")
        assert res.status_code == 200
        data = res.json()
        assert len(data) == 1
        assert data[0]["is_published"] is False
    finally:
        app.dependency_overrides.pop(get_db, None)
        app.dependency_overrides.pop(get_optional_user, None)
