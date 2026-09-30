"""Tests for GET /api/blog/users/{username}/bookmarks pagination.

Scope: TRACE-20260928-feat-profile-pagination
Endpoint: GET /api/blog/users/{username}/bookmarks?page=1&limit=10
Response model: PaginatedPosts { items, total, page, limit, total_pages }
"""
import sys
import os

# Ensure backend/ package root is importable
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from unittest.mock import AsyncMock, MagicMock

# ── App import ────────────────────────────────────────────────────────────────
# Import must happen after sys.path is set
from fastapi.testclient import TestClient
from app.main import app
from app.core.database import get_db
from app.modules.auth.deps import get_optional_user


# ── Helpers ───────────────────────────────────────────────────────────────────

def _make_user(username: str = "alice", user_id: str = "user-001"):
    """Build a minimal SQLAlchemy-like User mock."""
    user = MagicMock()
    user.id = user_id
    user.username = username
    user.is_admin = False
    user.role = "member"
    user.is_active = True
    return user


def _make_db_override(target_user, total: int = 0, posts=None):
    """Return an async-generator override for get_db.

    Sets up db.execute side_effect in the exact order the endpoint calls it:
      1. select(User) by username            → scalar_one_or_none()
      2. select(func.count(Post.id))         → scalar_one()
      3. select(Post) with joins / options   → scalars().all()
    """
    if posts is None:
        posts = []

    user_result = MagicMock()
    user_result.scalar_one_or_none.return_value = target_user

    count_result = MagicMock()
    count_result.scalar_one.return_value = total

    posts_result = MagicMock()
    posts_result.scalars.return_value.all.return_value = posts

    mock_db = AsyncMock()
    mock_db.execute.side_effect = [user_result, count_result, posts_result]

    async def _get_db_override():
        yield mock_db

    return _get_db_override


def _make_optional_user_override(user=None):
    """Return an async override for get_optional_user (unauthenticated by default)."""
    async def _get_optional_user_override():
        return user

    return _get_optional_user_override


def _apply_overrides(db_override, user_override):
    app.dependency_overrides[get_db] = db_override
    app.dependency_overrides[get_optional_user] = user_override


def _clear_overrides():
    app.dependency_overrides.clear()


# ── Test 1: Response shape ────────────────────────────────────────────────────

def test_response_has_all_required_fields():
    """Response must include items, total, page, limit, total_pages."""
    target = _make_user("alice")
    _apply_overrides(
        _make_db_override(target, total=0),
        _make_optional_user_override(),
    )

    with TestClient(app, raise_server_exceptions=False) as client:
        resp = client.get("/api/blog/users/alice/bookmarks")

    _clear_overrides()

    assert resp.status_code == 200
    data = resp.json()
    for field in ("items", "total", "page", "limit", "total_pages"):
        assert field in data, f"Missing field: {field}"


# ── Test 2: Default params ────────────────────────────────────────────────────

def test_default_params_are_page1_limit10():
    """Calling without query params must yield page=1, limit=10 in response."""
    target = _make_user("alice")
    _apply_overrides(
        _make_db_override(target, total=0),
        _make_optional_user_override(),
    )

    with TestClient(app, raise_server_exceptions=False) as client:
        resp = client.get("/api/blog/users/alice/bookmarks")

    _clear_overrides()

    assert resp.status_code == 200
    data = resp.json()
    assert data["page"] == 1
    assert data["limit"] == 10


# ── Test 3: Custom params reflected in response ───────────────────────────────

def test_custom_params_reflected_in_response():
    """?page=2&limit=5 must be echoed back in page and limit fields."""
    target = _make_user("alice")
    _apply_overrides(
        _make_db_override(target, total=25),
        _make_optional_user_override(),
    )

    with TestClient(app, raise_server_exceptions=False) as client:
        resp = client.get("/api/blog/users/alice/bookmarks?page=2&limit=5")

    _clear_overrides()

    assert resp.status_code == 200
    data = resp.json()
    assert data["page"] == 2
    assert data["limit"] == 5


# ── Test 4: Validation — page=0 → 422 ────────────────────────────────────────

def test_validation_page_zero_returns_422():
    """page=0 violates Query(ge=1) — FastAPI must return 422."""
    _apply_overrides(
        _make_db_override(None),          # db won't be reached
        _make_optional_user_override(),
    )

    with TestClient(app, raise_server_exceptions=False) as client:
        resp = client.get("/api/blog/users/alice/bookmarks?page=0")

    _clear_overrides()

    assert resp.status_code == 422


# ── Test 5: Validation — limit=0 → 422 ───────────────────────────────────────

def test_validation_limit_zero_returns_422():
    """limit=0 violates Query(ge=1) — FastAPI must return 422."""
    _apply_overrides(
        _make_db_override(None),
        _make_optional_user_override(),
    )

    with TestClient(app, raise_server_exceptions=False) as client:
        resp = client.get("/api/blog/users/alice/bookmarks?limit=0")

    _clear_overrides()

    assert resp.status_code == 422


# ── Test 6: Validation — limit=101 → 422 ─────────────────────────────────────

def test_validation_limit_over_max_returns_422():
    """limit=101 violates Query(le=100) — FastAPI must return 422."""
    _apply_overrides(
        _make_db_override(None),
        _make_optional_user_override(),
    )

    with TestClient(app, raise_server_exceptions=False) as client:
        resp = client.get("/api/blog/users/alice/bookmarks?limit=101")

    _clear_overrides()

    assert resp.status_code == 422


# ── Test 7: total_pages=1 when total=0 (edge case) ───────────────────────────

def test_total_pages_is_one_when_no_bookmarks():
    """When total=0, total_pages must be 1 (not 0) — per ceil(0/n) edge case."""
    target = _make_user("alice")
    _apply_overrides(
        _make_db_override(target, total=0),
        _make_optional_user_override(),
    )

    with TestClient(app, raise_server_exceptions=False) as client:
        resp = client.get("/api/blog/users/alice/bookmarks")

    _clear_overrides()

    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 0
    assert data["total_pages"] == 1


# ── Test 8: Unknown username → 404 ───────────────────────────────────────────

def test_unknown_username_returns_404():
    """A username that does not exist in the DB must return 404."""
    # scalar_one_or_none() returns None → endpoint raises 404
    _apply_overrides(
        _make_db_override(None),          # user not found
        _make_optional_user_override(),
    )

    with TestClient(app, raise_server_exceptions=False) as client:
        resp = client.get("/api/blog/users/nobody_here/bookmarks")

    _clear_overrides()

    assert resp.status_code == 404
