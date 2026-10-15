"""Unit tests for Series Progress Tracking.

Endpoints covered:
- GET /api/blog/series/{series_id}/progress
- POST /api/blog/series/{series_id}/progress/toggle
- DELETE /api/blog/series/{series_id}/progress
- GET /api/blog/series/{series_id}/admin/progress
"""
import sys
import os
import json
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock

# Ensure backend/ package root is importable
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from fastapi.testclient import TestClient
from app.main import app
from app.core.database import get_db
from app.modules.auth.deps import get_current_user


# ── Helpers & Mocks ────────────────────────────────────────────────────────────

def _make_user(user_id: str = "user-1", username: str = "alice", is_admin: bool = False, role: str = "member"):
    user = MagicMock()
    user.id = user_id
    user.username = username
    user.full_name = f"{username.capitalize()} Test"
    user.avatar_url = f"https://example.com/{username}.png"
    user.is_admin = is_admin
    user.role = role
    user.is_active = True
    return user


def _make_post(post_id: str, is_published: bool = True):
    post = MagicMock()
    post.id = post_id
    post.is_published = is_published
    return post


def _make_chapter(chapter_id: str, posts=None):
    ch = MagicMock()
    ch.id = chapter_id
    ch.posts = posts if posts is not None else []
    return ch


def _make_series(series_id: str = "series-1", owner_id: str = "owner-1", chapters=None, collaborators=None):
    series = MagicMock()
    series.id = series_id
    series.owner_id = owner_id
    series.chapters = chapters if chapters is not None else []
    series.collaborators = collaborators if collaborators is not None else []
    return series


def _make_progress(series_id: str, user_id: str, completed_ids: list):
    prog = MagicMock()
    prog.series_id = series_id
    prog.user_id = user_id
    prog.completed_lesson_ids = json.dumps(completed_ids)
    prog.updated_at = datetime.now(timezone.utc)
    return prog


def _apply_overrides(db_mock, user_mock=None):
    db_mock.add = MagicMock()
    async def _db_override():
        yield db_mock

    app.dependency_overrides[get_db] = _db_override
    if user_mock:
        async def _user_override():
            return user_mock
        app.dependency_overrides[get_current_user] = _user_override


def _clear_overrides():
    app.dependency_overrides.clear()


# ── Test Cases ─────────────────────────────────────────────────────────────────

def test_get_progress_series_not_found():
    """Returns 404 when the series does not exist."""
    user = _make_user()
    db_mock = AsyncMock()
    series_result = MagicMock()
    series_result.scalar_one_or_none.return_value = None
    db_mock.execute.return_value = series_result

    _apply_overrides(db_mock, user)
    try:
        with TestClient(app, raise_server_exceptions=False) as client:
            resp = client.get("/api/blog/series/non-existent/progress")
        assert resp.status_code == 404
        assert resp.json()["detail"] == "Series không tìm thấy"
    finally:
        _clear_overrides()


def test_get_progress_new_user_empty():
    """Returns 0% progress and total_lessons correctly when user has no prior record."""
    user = _make_user("u1")
    p1 = _make_post("post-1")
    p2 = _make_post("post-2")
    ch = _make_chapter("ch-1", [p1, p2])
    series = _make_series("series-1", "owner-1", [ch])

    db_mock = AsyncMock()
    series_res = MagicMock()
    series_res.scalar_one_or_none.return_value = series
    prog_res = MagicMock()
    prog_res.scalar_one_or_none.return_value = None

    db_mock.execute.side_effect = [series_res, prog_res]

    _apply_overrides(db_mock, user)
    try:
        with TestClient(app, raise_server_exceptions=False) as client:
            resp = client.get("/api/blog/series/series-1/progress")
        assert resp.status_code == 200
        data = resp.json()
        assert data["series_id"] == "series-1"
        assert data["user_id"] == "u1"
        assert data["completed_lesson_ids"] == []
        assert data["total_lessons"] == 2
        assert data["completed_count"] == 0
        assert data["percent"] == 0.0
    finally:
        _clear_overrides()


def test_get_progress_with_existing_records_and_sanitization():
    """Returns filtered valid completed lessons and correct percentage."""
    user = _make_user("u1")
    p1 = _make_post("post-1")
    p2 = _make_post("post-2")
    ch = _make_chapter("ch-1", [p1, p2])
    series = _make_series("series-1", "owner-1", [ch])

    # progress has post-1 and an obsolete/deleted post-999
    existing_prog = _make_progress("series-1", "u1", ["post-1", "post-999"])

    db_mock = AsyncMock()
    series_res = MagicMock()
    series_res.scalar_one_or_none.return_value = series
    prog_res = MagicMock()
    prog_res.scalar_one_or_none.return_value = existing_prog

    db_mock.execute.side_effect = [series_res, prog_res]

    _apply_overrides(db_mock, user)
    try:
        with TestClient(app, raise_server_exceptions=False) as client:
            resp = client.get("/api/blog/series/series-1/progress")
        assert resp.status_code == 200
        data = resp.json()
        assert data["completed_lesson_ids"] == ["post-1"]  # post-999 filtered out
        assert data["total_lessons"] == 2
        assert data["completed_count"] == 1
        assert data["percent"] == 50.0
    finally:
        _clear_overrides()


def test_toggle_progress_mark_completed():
    """Toggling an uncompleted lesson adds it to completed_lesson_ids and updates percent."""
    user = _make_user("u1")
    p1 = _make_post("post-1")
    p2 = _make_post("post-2")
    ch = _make_chapter("ch-1", [p1, p2])
    series = _make_series("series-1", "owner-1", [ch])

    db_mock = AsyncMock()
    series_res = MagicMock()
    series_res.scalar_one_or_none.return_value = series
    prog_res = MagicMock()
    prog_res.scalar_one_or_none.return_value = None  # no existing progress row yet

    db_mock.execute.side_effect = [series_res, prog_res]

    _apply_overrides(db_mock, user)
    try:
        with TestClient(app, raise_server_exceptions=False) as client:
            resp = client.post(
                "/api/blog/series/series-1/progress/toggle",
                json={"lesson_id": "post-1"},
            )
        assert resp.status_code == 200
        data = resp.json()
        assert data["completed_lesson_ids"] == ["post-1"]
        assert data["completed_count"] == 1
        assert data["percent"] == 50.0
        assert db_mock.commit.called
    finally:
        _clear_overrides()


def test_toggle_progress_unmark_completed():
    """Toggling an already completed lesson removes it (unmarking)."""
    user = _make_user("u1")
    p1 = _make_post("post-1")
    p2 = _make_post("post-2")
    ch = _make_chapter("ch-1", [p1, p2])
    series = _make_series("series-1", "owner-1", [ch])
    existing_prog = _make_progress("series-1", "u1", ["post-1"])

    db_mock = AsyncMock()
    series_res = MagicMock()
    series_res.scalar_one_or_none.return_value = series
    prog_res = MagicMock()
    prog_res.scalar_one_or_none.return_value = existing_prog

    db_mock.execute.side_effect = [series_res, prog_res]

    _apply_overrides(db_mock, user)
    try:
        with TestClient(app, raise_server_exceptions=False) as client:
            resp = client.post(
                "/api/blog/series/series-1/progress/toggle",
                json={"lesson_id": "post-1"},
            )
        assert resp.status_code == 200
        data = resp.json()
        assert data["completed_lesson_ids"] == []
        assert data["completed_count"] == 0
        assert data["percent"] == 0.0
        assert db_mock.commit.called
    finally:
        _clear_overrides()


def test_toggle_progress_invalid_lesson():
    """Returns 400 if the lesson ID is not part of this series."""
    user = _make_user("u1")
    p1 = _make_post("post-1")
    ch = _make_chapter("ch-1", [p1])
    series = _make_series("series-1", "owner-1", [ch])

    db_mock = AsyncMock()
    series_res = MagicMock()
    series_res.scalar_one_or_none.return_value = series
    db_mock.execute.return_value = series_res

    _apply_overrides(db_mock, user)
    try:
        with TestClient(app, raise_server_exceptions=False) as client:
            resp = client.post(
                "/api/blog/series/series-1/progress/toggle",
                json={"lesson_id": "alien-lesson"},
            )
        assert resp.status_code == 400
        assert resp.json()["detail"] == "Bài học không thuộc series này"
    finally:
        _clear_overrides()


def test_reset_progress():
    """Resets progress back to 0% and empty completed_lesson_ids."""
    user = _make_user("u1")
    p1 = _make_post("post-1")
    ch = _make_chapter("ch-1", [p1])
    series = _make_series("series-1", "owner-1", [ch])
    existing_prog = _make_progress("series-1", "u1", ["post-1"])

    db_mock = AsyncMock()
    series_res = MagicMock()
    series_res.scalar_one_or_none.return_value = series
    prog_res = MagicMock()
    prog_res.scalar_one_or_none.return_value = existing_prog

    db_mock.execute.side_effect = [series_res, prog_res]

    _apply_overrides(db_mock, user)
    try:
        with TestClient(app, raise_server_exceptions=False) as client:
            resp = client.delete("/api/blog/series/series-1/progress")
        assert resp.status_code == 200
        data = resp.json()
        assert data["completed_lesson_ids"] == []
        assert data["completed_count"] == 0
        assert data["percent"] == 0.0
        assert db_mock.commit.called
    finally:
        _clear_overrides()


def test_admin_progress_as_owner():
    """Series owner can view progress of all members, sorted descending by percentage."""
    owner = _make_user("owner-1", "author_bob")
    p1 = _make_post("p1")
    p2 = _make_post("p2")
    ch = _make_chapter("ch-1", [p1, p2])
    series = _make_series("series-1", owner_id="owner-1", chapters=[ch])

    # 2 learners: student A (100%), student B (50%)
    learner_a = _make_user("u-a", "learner_a")
    prog_a = _make_progress("series-1", "u-a", ["p1", "p2"])
    prog_a.user = learner_a

    learner_b = _make_user("u-b", "learner_b")
    prog_b = _make_progress("series-1", "u-b", ["p1"])
    prog_b.user = learner_b

    db_mock = AsyncMock()
    series_res = MagicMock()
    series_res.scalar_one_or_none.return_value = series
    all_prog_res = MagicMock()
    all_prog_res.scalars.return_value.all.return_value = [prog_b, prog_a]  # unsorted

    db_mock.execute.side_effect = [series_res, all_prog_res]

    _apply_overrides(db_mock, owner)
    try:
        with TestClient(app, raise_server_exceptions=False) as client:
            resp = client.get("/api/blog/series/series-1/admin/progress")
        assert resp.status_code == 200
        entries = resp.json()
        assert len(entries) == 2
        # Student A should be first (100% > 50%)
        assert entries[0]["user_id"] == "u-a"
        assert entries[0]["percent"] == 100.0
        assert entries[0]["completed_count"] == 2
        assert entries[1]["user_id"] == "u-b"
        assert entries[1]["percent"] == 50.0
    finally:
        _clear_overrides()


def test_admin_progress_forbidden_for_regular_user():
    """Regular member cannot access the admin progress overview."""
    stranger = _make_user("stranger-1", "stranger", is_admin=False, role="member")
    series = _make_series("series-1", owner_id="author-1", chapters=[], collaborators=[])

    db_mock = AsyncMock()
    series_res = MagicMock()
    series_res.scalar_one_or_none.return_value = series
    db_mock.execute.return_value = series_res

    _apply_overrides(db_mock, stranger)
    try:
        with TestClient(app, raise_server_exceptions=False) as client:
            resp = client.get("/api/blog/series/series-1/admin/progress")
        assert resp.status_code == 403
        assert resp.json()["detail"] == "Không có quyền xem tiến độ thành viên"
    finally:
        _clear_overrides()
